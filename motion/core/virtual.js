/* 虚拟身体：键鼠 / 触屏兜底操作
   没有摄像头、画面里没人、或者刚用过鼠标 / 触屏 / 键盘时，合成一套 33 个关键点的「虚拟小人」当 0 号玩家，
   交给同一套 Body 动作识别（跳、蹲、左右、姿势、手的位置和速度都按真实身体那样算出来），所以所有体感游戏不用改就能玩
   · 鼠标 / 手指 = 手（够得着范围映射到全屏）；快速划动 = 挥手 / 切；点一下 = 出拳；第二根手指 = 另一只手
   · 键盘：←→ / AD 左右移动，↑ / W 跳，↓ / S 蹲（方向键同时算右手挥动、WASD 算左手挥动），空格 出拳，F 双手前推，C 拍手，R 原地跑，
     1 举左手 2 举右手 3 举双手 4 摸头 5 叉腰 6 平举 7 单脚站 8 张开腿，M 两只手镜像 / 同一点
   · 触屏另有屏幕按钮条（SDK 里按游戏显示） */
(function () {
  const M = window.Motion, U = M.U;
  const T = .2; // 虚拟小人的躯干长度（占画面高度）
  const V = M.Virtual = M.emitter({
    active: false, lastInput: -1e9, touch: false, kb: false, mode: 'same', // same：两只手都跟着指针；mirror：另一只手镜像
    ptr: null, ptr2: null, inside: false, lane: 0, laneX: 0, keys: new Set(), acts: [], pose: null, poseUntil: 0, legs: false,
    person: null, lastT: 0, A: 16 / 9,

    camOk() { return M.Input.live() && M.Tracker.ready; },
    recent(t) { return (t || U.now()) - this.lastInput < 4000; },
    mark(kind) { this.lastInput = U.now(); if (kind === 'touch') this.touch = true; if (kind === 'mouse') this.touch = false; if (kind === 'key') this.kb = true; if (M.Cursor) M.Cursor.mouseT = U.now(); },
    // 当前在不在游戏画面里（大厅、设置页里鼠标就是鼠标，不需要虚拟小人）
    inGame() { return !!document.querySelector('#app .s-mgame'); },

    /* ---------- 合成关键点 ---------- */
    build(t) {
      const A = this.A = (M.Input.vw && M.Input.vh) ? M.Input.vw / M.Input.vh : 16 / 9;
      // 动作动画
      let rise = 0, drop = 0, kneeL = 0, kneeR = 0, push = 0, clap = -1, punchL = 0, punchR = 0;
      this.acts = this.acts.filter(a => t - a.t0 < a.dur);
      this.acts.forEach(a => {
        const k = (t - a.t0) / a.dur;
        if (a.k === 'jump') rise = Math.max(rise, Math.sin(Math.PI * k) * .62);
        if (a.k === 'squat') drop = Math.max(drop, Math.min(1, k * 6, (1 - k) * 6) * .7);
        if (a.k === 'run') { const ph = Math.sin(k * a.dur / 1000 * Math.PI * 2 * 3); kneeL = Math.max(0, ph) * .45; kneeR = Math.max(0, -ph) * .45; }
        if (a.k === 'push') push = k < .8 ? 1 : 2;
        if (a.k === 'clap') clap = k;
        if (a.k === 'punchL') punchL = Math.sin(Math.PI * k);
        if (a.k === 'punchR') punchR = Math.sin(Math.PI * k);
      });
      if (this.keys.has('squat')) drop = .7;
      // 左右：平滑移到目标跑道
      this.laneX += (this.lane * .85 - this.laneX) * .35;
      const cx = A / 2 + this.laneX * T, hy = .56 - rise * T + drop * T * .55, sy = hy - T + drop * T * .25;
      const P = {};
      const put = (i, x, y) => { P[i] = { x, y }; };
      put(11, cx - .28 * T, sy); put(12, cx + .28 * T, sy); put(23, cx - .17 * T, hy); put(24, cx + .17 * T, hy);
      const nx = cx, ny = sy - .45 * T; put(0, nx, ny);
      [[1, -.05, -.04], [2, -.07, -.05], [3, -.09, -.04], [4, .05, -.04], [5, .07, -.05], [6, .09, -.04], [7, -.14, 0], [8, .14, 0], [9, -.04, .08], [10, .04, .08]].forEach(([i, dx, dy]) => put(i, nx + dx * T, ny + dy * T));
      // 腿
      const sq = drop > .3, spread = this.legs || this.pose === 'legs';
      const leg = (hip, side, lift) => {
        const sgn = side === 'L' ? -1 : 1;
        if (sq) return [{ x: hip.x + sgn * .3 * T, y: hip.y + .32 * T }, { x: hip.x + sgn * .12 * T, y: hip.y + .62 * T }];
        if (spread) return [{ x: hip.x + sgn * .25 * T, y: hip.y + .5 * T }, { x: hip.x + sgn * .5 * T, y: hip.y + 1.02 * T }];
        return [{ x: hip.x, y: hip.y + .55 * T - lift * T }, { x: hip.x, y: hip.y + 1.1 * T - lift * T * 1.4 }];
      };
      const oneLeg = this.pose === 'oneLeg' ? .45 : 0;
      const [lk, la] = leg(P[23], 'L', Math.max(kneeL, oneLeg)), [rk, ra] = leg(P[24], 'R', kneeR);
      put(25, lk.x, lk.y); put(27, la.x, la.y); put(26, rk.x, rk.y); put(28, ra.x, ra.y);
      put(29, la.x - .03 * T, la.y + .04 * T); put(31, la.x + .05 * T, la.y + .06 * T); put(30, ra.x + .03 * T, ra.y + .04 * T); put(32, ra.x - .05 * T, ra.y + .06 * T);
      // 手：姿势 > 动作 > 指针 > 自然下垂
      const shm = { x: cx, y: sy }, ls = P[11], rs = P[12];
      const fromReach = r => ({ x: shm.x + (r.x - .5) * 3 * T, y: shm.y - 1.25 * T + r.y * 2.3 * T });
      let wl = { x: ls.x - .08 * T, y: hy + .05 * T }, wr = { x: rs.x + .08 * T, y: hy + .05 * T };
      const p1 = this.ptr && this.inside ? fromReach(this.ptr) : null, p2 = this.ptr2 ? fromReach(this.ptr2) : null;
      const mode = (window.__MG && __MG.def && __MG.def.vmode) || this.mode; // 拼字墙默认镜像：一只鼠标摆出对称的字母
      if (p1) { wr = p1; wl = p2 || (mode === 'mirror' ? { x: 2 * cx - p1.x, y: p1.y } : { x: p1.x - .02 * T, y: p1.y }); }
      const pose = t < this.poseUntil || this.keys.has('pose') ? this.pose : null;
      const POSE = {
        upL: () => { wl = { x: ls.x - .3 * T, y: ny - .5 * T }; }, upR: () => { wr = { x: rs.x + .3 * T, y: ny - .5 * T }; },
        upBoth: () => { wl = { x: ls.x - .3 * T, y: ny - .5 * T }; wr = { x: rs.x + .3 * T, y: ny - .5 * T }; },
        head: () => { wl = { x: nx - .3 * T, y: ny - .15 * T }; wr = { x: nx + .3 * T, y: ny - .15 * T }; },
        hips: () => { wl = { x: P[23].x - .12 * T, y: hy }; wr = { x: P[24].x + .12 * T, y: hy }; },
        tpose: () => { wl = { x: ls.x - 1.3 * T, y: sy }; wr = { x: rs.x + 1.3 * T, y: sy }; },
      };
      if (pose && POSE[pose]) POSE[pose]();
      if (push === 1) { wl = { x: cx - .1 * T, y: sy + .4 * T }; wr = { x: cx + .1 * T, y: sy + .4 * T }; }
      if (push === 2) { wl = { x: cx - .75 * T, y: sy + .2 * T }; wr = { x: cx + .75 * T, y: sy + .2 * T }; }
      if (clap >= 0) { const g = clap < .5 ? 1.1 : .1; wl = { x: cx - g * .5 * T, y: sy + .45 * T }; wr = { x: cx + g * .5 * T, y: sy + .45 * T }; }
      put(15, wl.x, wl.y); put(16, wr.x, wr.y);
      const elbow = (s, w, sgn) => ({ x: (s.x + w.x) / 2 + sgn * .08 * T, y: (s.y + w.y) / 2 + .06 * T });
      const el = elbow(ls, wl, -1), er = elbow(rs, wr, 1); put(13, el.x, el.y); put(14, er.x, er.y);
      [17, 19, 21].forEach(i => put(i, wl.x, wl.y)); [18, 20, 22].forEach(i => put(i, wr.x, wr.y));
      const lm = []; for (let i = 0; i < 33; i++) lm.push({ x: P[i].x / A, y: P[i].y, z: 0, v: 1 });
      // 世界坐标（米）：出拳时手腕往前（z 变小），Body 据此判定出拳
      // 世界坐标（米）：z 恒为 0，出拳由按键 / 点击直接触发，不靠深度识别（避免一次出拳算两次）
      const world = lm.map(p => ({ x: (p.x - .5) * A * 2.2, y: (p.y - .5) * 2.2, z: 0 }));
      void punchL; void punchR;
      return { lm, world };
    },
    // Tracker 每帧调用：需要时把虚拟小人放进 0 号座位
    merge(people, t) {
      // 游戏里：刚用过键鼠 / 触屏，或者没有摄像头画面时，由虚拟小人当 0 号玩家
      const on = this.inGame() && (this.recent(t) || !this.camOk());
      if (on !== this.active) { this.active = on; this.emit('active', on); }
      if (!on) return people;
      if (t - this.lastT < 30 && this.person) return [this.person].concat(people.filter(p => p && p.slot !== 0));
      this.lastT = t;
      const s = this.person || (this.person = { slot: 0, virtual: true, alive: true, present: true, filters: [], body: null });
      const g = this.build(t);
      s.lm = g.lm; s.raw = g.lm; s.world = g.world; s.t = t; s.present = true; s.alive = true;
      const a = s.lm[23], b = s.lm[24]; s.cx = (a.x + b.x) / 2; s.cy = (a.y + b.y) / 2;
      M.Body.update(s, t);
      return [s].concat(people.filter(p => p && p.slot !== 0));
    },

    /* ---------- 动作 ---------- */
    fire(type, extra) { const s = this.person; if (!s || !this.active) return; M.Body.fire(type, s, extra); },
    act(name, held) {
      const t = U.now(); this.mark(held === 'touch' ? 'touch' : 'key');
      const add = (k, dur) => this.acts.push({ k, t0: t, dur });
      const sw = (hand, dir) => { const h = this.person && this.person.body && this.person.body.hands[hand]; const ang = dir * Math.PI / 4; this.fire('swipe', { hand, dir, dx: Math.cos(ang), dy: Math.sin(ang), speed: 6, x: h ? h.raw.x : .5, y: h ? h.raw.y : .5, rx: h ? h.reach.x : .5, ry: h ? h.reach.y : .5 }); };
      const m = /^sw:([LR]):(\d)$/.exec(name);
      if (m) return sw(m[1], +m[2]);
      switch (name) {
        case 'left': this.lane = Math.max(-1, this.lane - 1); break;
        case 'right': this.lane = Math.min(1, this.lane + 1); break;
        case 'center': this.lane = 0; break;
        case 'jump': add('jump', 520); break;
        case 'squat': add('squat', 900); break;
        case 'run': add('run', 2200); break;
        case 'clap': add('clap', 300); break; // 两手先分开再合拢，Body 自己识别出拍手
        case 'punch': case 'punchR': case 'punchL': { const hd = name === 'punchL' ? 'L' : 'R'; add('punch' + hd, 240); setTimeout(() => { const h = this.person && this.person.body && this.person.body.hands[hd]; this.fire('punch', { hand: hd, x: h ? h.raw.x : .5, y: h ? h.raw.y : .5 }); }, 60); break; }
        case 'push': add('push', 1500); setTimeout(() => { ['L', 'R'].forEach(hd => { const h = this.person && this.person.body && this.person.body.hands[hd]; this.fire('punch', { hand: hd, x: h ? h.raw.x : .5, y: h ? h.raw.y : .5 }); }); }, 1220); break;
        case 'shout': M.Ears.emit('shout', { level: .9 }); break;
        case 'legs': this.legs = !this.legs; break;
        case 'mirror': { const g = window.__MG && __MG.def; const cur = (g && g.vmode) || this.mode, nx = cur === 'mirror' ? 'same' : 'mirror'; if (g && g.vmode) g.vmode = nx; else this.mode = nx; break; }
        default: if (/^(upL|upR|upBoth|head|hips|tpose|oneLeg)$/.test(name)) { this.pose = name; this.poseUntil = t + 1600; }
      }
    },
  });

  /* ---------- 指针（鼠标 / 触屏） ---------- */
  const PAD = '.m-vpad, .mg-tl, .mg-pipw, .m-layer, .mg-tr button';
  const toReach = e => { const a = M.UI && M.UI.area ? M.UI.area() : { left: 0, top: 0, width: innerWidth, height: innerHeight }; return { x: U.clamp((e.clientX - a.left) / a.width, 0, 1), y: U.clamp((e.clientY - a.top) / a.height, 0, 1) }; };
  const touches = new Map();
  const onPtr = e => {
    if (!V.inGame() || (e.target.closest && e.target.closest(PAD))) return;
    if (e.pointerType === 'touch') {
      if (e.type === 'pointerdown') touches.set(e.pointerId, { t0: U.now(), x0: e.clientX, y0: e.clientY });
      const ids = [...touches.keys()];
      if (e.type === 'pointerup' || e.type === 'pointercancel') {
        const tc = touches.get(e.pointerId); touches.delete(e.pointerId);
        if (tc && U.now() - tc.t0 < 260 && Math.hypot(e.clientX - tc.x0, e.clientY - tc.y0) < 18) V.act('punch', 'touch'); // 点一下 = 出拳
        if (!touches.size) { V.ptr2 = null; } else if (ids[1] === e.pointerId) V.ptr2 = null;
        V.mark('touch'); return;
      }
      if (ids[1] === e.pointerId) V.ptr2 = toReach(e); else V.ptr = toReach(e);
      V.inside = true; V.mark('touch');
    } else {
      if (e.type === 'pointerdown' && e.button === 0) V.act('punch', 'mouse');
      if (e.type === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 1) return;
      V.ptr = toReach(e); V.inside = true; V.mark('mouse');
    }
  };
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(k => addEventListener(k, onPtr, true));
  document.addEventListener('pointerleave', () => { V.inside = false; });
  addEventListener('blur', () => { V.inside = false; V.keys.clear(); });

  /* ---------- 键盘 ---------- */
  const KEYS = { ArrowLeft: ['left', 'sw:R:4'], ArrowRight: ['right', 'sw:R:0'], ArrowUp: ['jump', 'sw:R:6'], ArrowDown: ['squat', 'sw:R:2'], a: ['left', 'sw:L:4'], d: ['right', 'sw:L:0'], w: ['jump', 'sw:L:6'], s: ['squat', 'sw:L:2'],
    ' ': ['punch'], f: ['push'], c: ['clap'], r: ['run'], j: ['punchL'], k: ['punchR'], m: ['mirror'], x: ['legs'], 1: ['upL'], 2: ['upR'], 3: ['upBoth'], 4: ['head'], 5: ['hips'], 6: ['tpose'], 7: ['oneLeg'], 8: ['legs'] };
  addEventListener('keydown', e => {
    if (!V.inGame() || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
    const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (!k) return;
    const own = window.__MG && __MG.def && __MG.def.ownKeys; if (own && own.includes(e.key.toLowerCase())) return;
    if (e.key === ' ') e.preventDefault();
    if (e.repeat) { if (k[0] === 'squat') V.keys.add('squat'); if (/^(upL|upR|upBoth|head|hips|tpose|oneLeg)$/.test(k[0])) V.poseUntil = U.now() + 400; return; }
    k.forEach(a => V.act(a, 'key'));
    if (k[0] === 'squat') V.keys.add('squat');
  }, true);
  addEventListener('keyup', e => { const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (k && k[0] === 'squat') V.keys.delete('squat'); }, true);
})();
