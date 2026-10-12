/* 动作识别：MediaPipe PoseLandmarker（全身 33 点，最多 2 人）+ 可选 HandLandmarker（手指 21 点）
   · 坐标统一换成「镜像」画面坐标（玩家抬右手，画面右边的手动），0-1
   · 两个人时按画面左右分配固定座位（slot 0 在左、1 在右），跟踪中按就近原则保持身份
   · 每个 person：lm（轻度平滑）、raw（原始）、world（以髋部为原点的米制坐标）、body（Body 模块算出的动作状态） */
(function () {
  const M = window.Motion, U = M.U;
  const LM = M.LM = { nose: 0, lEye: 2, rEye: 5, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lPi: 17, rPi: 18, lIn: 19, rIn: 20, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28, lHe: 29, rHe: 30, lFt: 31, rFt: 32 };
  const BONES = M.BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [27, 29], [28, 30], [15, 19], [16, 20]];
  const HAND_BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

  const NONE = [];
  const T = M.Tracker = M.emitter({
    ready: false, loading: null, error: '', pose: null, hand: null, vision: null, fileset: null,
    people: [], hands: [], fps: 0, ms: 0, running: false, needHands: false, numPoses: 1, modelName: '',
    // 体感光标「张开手掌 → 握拳」点击：光标那只手附近裁一块小图，单独看手指（grabWant 由光标每帧设置：{ slot, side } 或 null）
    grabWant: null, grabReady: false, grab: null, _roiFly: null,
    _lastTs: 0, _lastStamp: null, _loop: null, _lastT: 0, _slots: [],

    /* ---------- 后台线程（Worker）识别：推理不占主线程，画面和游戏逻辑更顺 ----------
       主线程每帧只做一次 createImageBitmap（缩到 640 宽，交给 Worker 时零拷贝转移），结果回来再做平滑和动作判断
       Worker 起不来（老浏览器、OffscreenCanvas 不可用等）或者运行中出错，自动退回主线程识别 */
    mode: '', worker: null, busy: false, mainMs: 0, _wq: null,
    // 配置请求排队：同一时间只有一个在等回复（两个界面同时改配置也不会串）
    _wchain: Promise.resolve(),
    wcall(msg) {
      const run = () => new Promise((res, rej) => {
        const w = this.worker; if (!w) return rej(new Error('worker gone'));
        const t = setTimeout(() => { this._wq = null; rej(new Error('识别线程启动超时')); }, 30000);
        this._wq = { res: d => { clearTimeout(t); res(d); }, rej: e => { clearTimeout(t); rej(e); } };
        w.postMessage(msg);
      });
      const p = this._wchain.then(run, run); this._wchain = p.catch(() => {}); return p;
    },
    wopts() { return { base: M.url('motion/vendor/'), model: M.cfg.model, people: this.numPoses, hands: this.needHands, grab: true }; },
    async startWorker() {
      if (M.cfg.worker === false || typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') return false;
      try {
        const w = this.worker = new Worker(M.url('motion/core/pose-worker.js'));
        w.onmessage = e => this.onWorker(e.data);
        w.onerror = e => { console.warn('识别线程出错，改用主线程', e.message); this.dropWorker(); };
        const r = await this.wcall(Object.assign({ type: 'init' }, this.wopts()));
        this.delegate = r.delegate + ' · 后台线程'; this.mode = 'worker'; this.grabReady = !!r.grab; this.modelName = M.cfg.model + this.numPoses + (this.needHands ? 'h' : '');
        return true;
      } catch (e) { console.warn('识别线程不可用，改用主线程：', e.message || e); this.dropWorker(); return false; }
    },
    dropWorker() {
      if (this.worker) { try { this.worker.terminate(); } catch (e) {} } this.worker = null; this.busy = false;
      if (this._wq) { this._wq.rej(new Error('worker gone')); this._wq = null; }
      if (this.mode === 'worker') { this.mode = ''; this.ready = false; this.loading = null; this.load().then(() => this.configure({})); }
    },
    onWorker(d) {
      if (d.type === 'ready' || d.type === 'error') { const q = this._wq; this._wq = null; if (q) d.type === 'ready' ? q.res(d) : q.rej(new Error(d.message)); return; }
      if (d.type === 'frame-error') { this._ferr = (this._ferr || 0) + 1; if (this._ferr > 20) { console.warn('识别线程连续出错，改用主线程：', d.message); this.dropWorker(); } return; }
      if (d.type !== 'result') return;
      this.busy = false; this._ferr = 0;
      const t = U.now(), dtF = this._lastT ? t - this._lastT : 33; this._lastT = t;
      this.fps = this.fps * .9 + (1000 / Math.max(1, dtF)) * .1; this.ms = this.ms * .9 + d.ms * .1;
      if (!this.ready || !M.Input.live()) return;
      this.ingest({ landmarks: d.poses.map(p => p.lm), worldLandmarks: d.poses.map(p => p.world) }, this.needHands ? { landmarks: d.hands } : null, t);
      const roi = this._roiFly; this._roiFly = null; if (roi) this.ingestGrab(d.grab, roi, t);
    },
    sendFrame(v, ts) {
      const vw = v.videoWidth || v.width, vh = v.videoHeight || v.height; if (!vw || !vh) return;
      const t0 = U.now(), k = Math.min(1, 640 / vw), roi = this.grabReady ? this.roiRect(vw, vh) : null;
      this.busy = true;
      Promise.all([
        createImageBitmap(v, k < 1 ? { resizeWidth: Math.round(vw * k), resizeHeight: Math.round(vh * k), resizeQuality: 'low' } : {}),
        roi ? createImageBitmap(v, roi.sx, roi.sy, roi.s, roi.s, { resizeWidth: 256, resizeHeight: 256, resizeQuality: 'medium' }).catch(() => null) : null,
      ]).then(([bm, rb]) => {
        this.mainMs = this.mainMs * .9 + (U.now() - t0) * .1;
        if (!this.worker) { bm.close(); if (rb) rb.close(); return; }
        const msg = { type: 'frame', bitmap: bm, ts }, tr = [bm];
        if (rb) { msg.roi = rb; tr.push(rb); this._roiFly = roi; } else this._roiFly = null;
        this.worker.postMessage(msg, tr);
      }).catch(() => { this.busy = false; });
      // 兜底：结果迟迟不回（Worker 卡住）就放行下一帧
      clearTimeout(this._busyT); this._busyT = setTimeout(() => { this.busy = false; }, 600);
    },

    async load() {
      if (this.ready) return true;
      if (this.loading) return this.loading;
      this.loading = (async () => {
        try {
          if (await this.startWorker()) { this.ready = true; this.emit('ready'); return true; }
          this.mode = 'main';
          this.vision = await import(M.url('motion/vendor/vision_bundle.mjs'));
          this.fileset = await this.vision.FilesetResolver.forVisionTasks(M.url('motion/vendor/wasm'));
          await this.makePose();
          this.ready = true; this.emit('ready'); return true;
        } catch (e) { console.error(e); this.error = '动作识别加载失败：' + (e.message || e); this.loading = null; return false; }
      })();
      return this.loading;
    },
    async makePose() {
      const model = M.cfg.model === 'full' ? 'pose_full' : 'pose_lite', n = Math.max(1, Math.min(2, this.numPoses));
      if (this.pose && this.modelName === model + n) return;
      if (this.pose) { try { this.pose.close(); } catch (e) {} this.pose = null; }
      const opts = d => ({ baseOptions: { modelAssetPath: M.url('motion/vendor/models/' + model + '.task'), delegate: d }, runningMode: 'VIDEO', numPoses: n, minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5 });
      try { this.pose = await this.vision.PoseLandmarker.createFromOptions(this.fileset, opts('GPU')); this.delegate = 'GPU'; }
      catch (e) { console.warn('GPU 不可用，改用 CPU', e); this.pose = await this.vision.PoseLandmarker.createFromOptions(this.fileset, opts('CPU')); this.delegate = 'CPU'; }
      this.modelName = model + n; this._lastTs = 0;
    },
    async makeHand() {
      if (this.hand || this._handLoading) return this._handLoading;
      this._handLoading = (async () => {
        const opts = d => ({ baseOptions: { modelAssetPath: M.url('motion/vendor/models/hand.task'), delegate: d }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .5, minHandPresenceConfidence: .5, minTrackingConfidence: .5 });
        try { this.hand = await this.vision.HandLandmarker.createFromOptions(this.fileset, opts('GPU')); } catch (e) { this.hand = await this.vision.HandLandmarker.createFromOptions(this.fileset, opts('CPU')); }
      })();
      return this._handLoading;
    },
    // 需要几个人、要不要手指：游戏开始前调用
    async configure(o) {
      o = o || {};
      if (o.people != null) this.numPoses = o.people;
      if (o.hands != null) this.needHands = !!o.hands;
      if (!(await this.load())) return false;
      if (this.mode === 'worker') {
        const name = M.cfg.model + this.numPoses + (this.needHands ? 'h' : '');
        if (name !== this.modelName) { try { const r = await this.wcall(Object.assign({ type: 'config' }, this.wopts())); this.delegate = r.delegate + ' · 后台线程'; this.modelName = name; } catch (e) { console.warn(e); } }
        return true;
      }
      await this.makePose();
      if (this.needHands) await this.makeHand();
      await this.makeGrab();
      return true;
    },
    async makeGrab() {
      if (this.grabLm || this._grabLoading) return this._grabLoading;
      this._grabLoading = (async () => {
        const opts = d => ({ baseOptions: { modelAssetPath: M.url('motion/vendor/models/hand.task'), delegate: d }, runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: .4, minHandPresenceConfidence: .4, minTrackingConfidence: .4 });
        try { this.grabLm = await this.vision.HandLandmarker.createFromOptions(this.fileset, opts('GPU')); } catch (e) { try { this.grabLm = await this.vision.HandLandmarker.createFromOptions(this.fileset, opts('CPU')); } catch (e2) { this.grabLm = null; } }
        this.grabReady = !!this.grabLm;
      })();
      return this._grabLoading;
    },
    // 光标那只手的裁剪框（视频像素，正方形）：以姿态模型的手腕 → 手指方向为中心，边长按手的大小和躯干长度估计
    roiRect(vw, vh) {
      const w = this.grabWant; if (!w) return null;
      const p = this.people.find(q => q && q.present && q.slot === w.slot && q.raw && q.body && !q.virtual); if (!p) return null;
      const R = p.raw, mir = M.cfg.mirror, wi = w.side === 'L' ? 15 : 16, pi = wi + 2, ii = wi + 4;
      if (!R[wi] || R[wi].v < .3) return null;
      const X = q => (mir ? 1 - q.x : q.x) * vw, Y = q => q.y * vh, wx = X(R[wi]), wy = Y(R[wi]);
      let fx = wx, fy = wy, span = 0;
      if (R[ii].v > .2 && R[pi].v > .2) { const mx = (X(R[ii]) + X(R[pi])) / 2, my = (Y(R[ii]) + Y(R[pi])) / 2; span = Math.hypot(mx - wx, my - wy); fx = wx + (mx - wx) * .8; fy = wy + (my - wy) * .8; }
      let s = Math.max(span * 3.4, (p.body.T || .2) * vh * .8, 56); s = Math.round(Math.min(s, vw, vh, Math.max(160, vh * .7)));
      return { sx: Math.round(U.clamp(fx - s / 2, 0, vw - s)), sy: Math.round(U.clamp(fy - s / 2, 0, vh - s)), s, vw, vh, mir, slot: p.slot, side: w.side };
    },
    // 裁剪小图里的 21 个手指点 → 张开程度（0 握拳 ～ 1 五指张开），挂到 person.grab
    ingestGrab(pts, roi, t) {
      const p = this.people.find(q => q && q.slot === roi.slot && q.present); if (!p) return;
      if (!pts || pts.length < 21) return; // 没看到手：person.grab 保持旧值，光标按时间判断「看不清手」
      const raw = M.Body.openness(pts), g = p.grab, prev = g && g.side === roi.side && t - g.t < 300 ? g.open : raw;
      const full = pts.map(q => { const x = (roi.sx + q.x * roi.s) / roi.vw; return { x: roi.mir ? 1 - x : x, y: (roi.sy + q.y * roi.s) / roi.vh }; });
      // 捏合：拇指尖到食指尖的距离 ÷ 手掌长度，换成 0 捏住 ～ 1 分开
      const palm = Math.hypot(pts[0].x - pts[9].x, pts[0].y - pts[9].y) || .1, pin = U.clamp((Math.hypot(pts[4].x - pts[8].x, pts[4].y - pts[8].y) / palm - .22) / .45, 0, 1);
      const pp = g && g.side === roi.side && t - g.t < 300 ? g.pin : pin;
      p.grab = { side: roi.side, open: prev + (raw - prev) * .6, raw, pin: pp + (pin - pp) * .6, pts: full, t };
      this.grab = p.grab;
    },
    start() {
      if (this.running) return; this.running = true;
      this._loop = M.loop((dt, t) => this.tick(t));
    },
    stop() { this.running = false; if (this._loop) this._loop.stop(); this._loop = null; },

    tick(t) {
      if (!this.ready || !M.Input.live()) { this.camPeople = NONE; return this.virt(t); }
      // 识别最多 30 帧 / 秒，画面没有新帧就跳过
      // 后台线程模式按「发出去的时间」限速：算完马上就能发下一帧，不用等结果回来再等一个间隔
      if (t - (this.mode === 'worker' ? this._lastSend || 0 : this._lastT) < (M.mobile ? 39 : 31)) return this.virt(t);
      const stamp = M.Input.frameStamp(); if (stamp === this._lastStamp || stamp < 0) return this.virt(t);
      this._lastStamp = stamp;
      if (this.mode === 'worker' && this.busy) return this.virt(t); // 上一帧还没算完：不排队，保证低延迟
      const v = M.Input.video; let ts = Math.round(t); if (ts <= this._lastTs) ts = this._lastTs + 1; this._lastTs = ts;
      if (this.mode === 'worker') { this._lastStamp = stamp; this._lastSend = t; this.sendFrame(v, ts); return this.virt(t); }
      const t0 = U.now(); let res;
      try { res = this.pose.detectForVideo(v, ts); } catch (e) { console.warn(e); return; }
      let hres = null;
      if (this.needHands && this.hand) { try { hres = this.hand.detectForVideo(v, ts); } catch (e) {} }
      // 光标手：裁一块画到小画布上再看手指
      const vw = M.Input.vw, vh = M.Input.vh, roi = this.grabLm ? this.roiRect(vw, vh) : null; let gp = null;
      if (roi) { try { const c = this._rc || (this._rc = Object.assign(document.createElement('canvas'), { width: 256, height: 256 })), cx = this._rcx || (this._rcx = c.getContext('2d')); cx.drawImage(v, roi.sx, roi.sy, roi.s, roi.s, 0, 0, 256, 256); const h = this.grabLm.detectForVideo(c, ts); gp = h.landmarks && h.landmarks[0]; } catch (e) {} }
      const dtF = this._lastT ? t - this._lastT : 33; this._lastT = t;
      this.fps = this.fps * .9 + (1000 / Math.max(1, dtF)) * .1; this.ms = this.ms * .9 + (U.now() - t0) * .1;
      this.ingest(res, hres, t);
      if (roi) this.ingestGrab(gp, roi, t);
    },

    // 键鼠 / 触屏兜底：虚拟小人（见 virtual.js）
    virt(t) {
      const base = this.camPeople || NONE, ps = M.Virtual ? M.Virtual.merge(base, t) : base;
      if (ps === this.people) return; const was = this.people; this.people = ps;
      if (ps.length || was.length) this.emit('frame', ps);
    },
    ingest(res, hres, t) {
      const mir = M.cfg.mirror;
      const found = (res.landmarks || []).map((l, i) => ({ raw: l.map(p => ({ x: mir ? 1 - p.x : p.x, y: p.y, z: p.z, v: p.visibility == null ? 1 : p.visibility })), world: (res.worldLandmarks && res.worldLandmarks[i]) ? res.worldLandmarks[i].map(p => ({ x: mir ? -p.x : p.x, y: p.y, z: p.z })) : null }));
      // 镜像后左右手互换：MediaPipe 的「左」是人自己的左；画面镜像后人的左手出现在画面左边，正好对上，不需要交换
      found.forEach(f => { const a = f.raw[23], b = f.raw[24]; f.cx = (a.x + b.x) / 2; f.cy = (a.y + b.y) / 2; });
      // 分配座位
      const n = Math.max(1, this.numPoses), slots = this._slots;
      const out = new Array(n).fill(null);
      const prev = slots.map(s => s && s.alive ? s : null);
      const used = new Set();
      // 先和上一帧就近匹配
      prev.forEach((s, si) => {
        if (!s || si >= n) return; let best = -1, bd = .25;
        found.forEach((f, fi) => { if (used.has(fi)) return; const d = Math.hypot(f.cx - s.cx, f.cy - s.cy); if (d < bd) { bd = d; best = fi; } });
        if (best >= 0) { used.add(best); out[si] = found[best]; }
      });
      // 新出现的人按左右位置补空位
      found.map((f, fi) => fi).filter(fi => !used.has(fi)).sort((a, b) => found[a].cx - found[b].cx).forEach(fi => {
        const f = found[fi]; let si = -1;
        if (n === 2) { const want = f.cx < .5 ? 0 : 1; si = !out[want] ? want : !out[1 - want] ? 1 - want : -1; } else si = out.indexOf(null);
        if (si >= 0) out[si] = f;
      });
      const people = [];
      for (let si = 0; si < n; si++) {
        let s = slots[si]; const f = out[si];
        if (!f) { if (s && s.alive && t - s.t > 600) { s.alive = false; s.present = false; this.emit('lost', s); } if (s && s.alive) people.push(s); continue; }
        if (!s) { s = slots[si] = { slot: si, filters: [], lm: [], alive: false, body: null }; }
        if (!s.alive) { s.filters.forEach(fl => { fl[0].reset(); fl[1].reset(); }); s.alive = true; s.present = true; s.since = t; this.emit('found', s); }
        s.raw = f.raw; s.world = f.world; s.cx = f.cx; s.cy = f.cy; s.t = t; s.present = true;
        s.lm = f.raw.map((p, i) => {
          const fl = s.filters[i] || (s.filters[i] = [new M.OneEuro(2.2, 1.2), new M.OneEuro(2.2, 1.2)]);
          return { x: fl[0].f(p.x, t), y: fl[1].f(p.y, t), z: p.z, v: p.v };
        });
        if (M.Body) M.Body.update(s, t);
        people.push(s);
      }
      this.camPeople = people; this.people = M.Virtual ? M.Virtual.merge(people, t) : people;
      // 手指：按离谁的手腕近分给对应的人、对应的手
      this.hands = [];
      if (hres && hres.landmarks) hres.landmarks.forEach(l => {
        const pts = l.map(p => ({ x: mir ? 1 - p.x : p.x, y: p.y, z: p.z }));
        let owner = null, side = 'R', bd = .18;
        people.forEach(pp => { ['L', 'R'].forEach(sd => { const w = pp.lm[sd === 'L' ? 15 : 16]; const d = Math.hypot(w.x - pts[0].x, w.y - pts[0].y); if (d < bd) { bd = d; owner = pp; side = sd; } }); });
        const hd = { pts, owner, side, t };
        if (M.Body) M.Body.hand(hd, t);
        this.hands.push(hd);
        if (owner) { owner.fingers = owner.fingers || {}; owner.fingers[side] = hd; }
      });
      people.forEach(pp => { if (pp.fingers) ['L', 'R'].forEach(sd => { const hd = pp.fingers[sd]; if (hd && t - hd.t > 300) delete pp.fingers[sd]; }); });
      this.emit('frame', this.people);
    },
    main() { return this.people.find(p => p && p.present) || null; },
    person(i) { return this.people.find(p => p && p.slot === i && p.present) || null; },

    /* ---------- 画骨架（调试 / 画中画 / 游戏里的火柴人） ---------- */
    draw(ctx, person, o) {
      o = o || {}; if (!person || !person.lm) return;
      const W = o.w || ctx.canvas.width, H = o.h || ctx.canvas.height, ox = o.x || 0, oy = o.y || 0, P = o.raw ? person.raw : person.lm;
      const X = p => ox + p.x * W, Y = p => oy + p.y * H, ok = p => p && p.v > .35;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = o.color || '#7ef9ff'; ctx.lineWidth = o.lw || Math.max(2, W / 120);
      if (o.glow) { ctx.shadowColor = o.color || '#7ef9ff'; ctx.shadowBlur = o.glow; }
      ctx.beginPath();
      BONES.forEach(([a, b]) => { const p = P[a], q = P[b]; if (!ok(p) || !ok(q)) return; ctx.moveTo(X(p), Y(p)); ctx.lineTo(X(q), Y(q)); });
      ctx.stroke();
      // 头
      const n = P[0], ls = P[11], rs = P[12];
      if (ok(n) && ok(ls) && ok(rs)) { const r = Math.hypot(X(ls) - X(rs), Y(ls) - Y(rs)) * .32; ctx.beginPath(); ctx.arc(X(n), Y(n), Math.max(4, r), 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(n), Y(n) + r); ctx.lineTo((X(ls) + X(rs)) / 2, (Y(ls) + Y(rs)) / 2); ctx.stroke(); }
      if (o.joints !== false) {
        ctx.shadowBlur = 0;
        [15, 16].forEach(i => { const p = P[i]; if (!ok(p)) return; ctx.fillStyle = i === 15 ? (o.lColor || '#ff5d73') : (o.rColor || '#4cc9ff'); ctx.beginPath(); ctx.arc(X(p), Y(p), Math.max(4, W / 70), 0, 7); ctx.fill(); });
      }
      if (o.fingers && person.fingers) ['L', 'R'].forEach(sd => { const hd = person.fingers[sd]; if (!hd) return; ctx.strokeStyle = '#ffe066'; ctx.lineWidth = Math.max(1.5, W / 260); ctx.beginPath(); HAND_BONES.forEach(([a, b]) => { const p = hd.pts[a], q = hd.pts[b]; ctx.moveTo(ox + p.x * W, oy + p.y * H); ctx.lineTo(ox + q.x * W, oy + q.y * H); }); ctx.stroke(); });
      ctx.restore();
    },
  });
})();
