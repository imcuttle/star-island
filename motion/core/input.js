/* 输入源：本机摄像头 / 麦克风、手机（WebRTC，连不上时退回 WebSocket 传 JPEG 帧）、局域网 IP 摄像头（MJPEG）、视频文件（演示 / 测试）
   Input.video：当前可以拿去识别、也可以直接显示的画面元素（<video> 或 <canvas>）
   Input.frameStamp()：画面有新帧时数值会变，识别器据此跳过重复帧 */
(function () {
  const M = window.Motion, U = M.U;

  /* ================= 手机连接 ================= */
  const Phone = M.Phone = M.emitter({
    ws: null, phones: new Map(), info: null, connected: false,
    async init() {
      if (this.ws || M.web) return; // 网页版没有本机中转服务
      try { this.info = M.native ? await M.native.info() : await fetch('/api/info').then(r => r.json()); } catch (e) { this.info = null; }
      this.connect();
    },
    connect() {
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?role=host');
      ws.binaryType = 'arraybuffer'; this.ws = ws;
      ws.onopen = () => { this.connected = true; this.emit('status'); };
      ws.onclose = () => { this.connected = false; this.emit('status'); if (this.ws === ws) { this.ws = null; setTimeout(() => this.connect(), 1500); } };
      ws.onmessage = e => {
        if (typeof e.data !== 'string') return this.onFrame(e.data);
        let m; try { m = JSON.parse(e.data); } catch (er) { return; }
        this.onMsg(m);
      };
    },
    send(id, m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(Object.assign({ to: id }, m))); },
    get(id) { return this.phones.get(+id); },
    list() { return [...this.phones.values()]; },
    ensure(id, meta) {
      let p = this.phones.get(id);
      if (!p) {
        p = { id, meta: meta || {}, name: (meta && meta.name) || '手机', caps: {}, mode: 'none', pc: null, stream: null, video: null, canvas: null, frames: 0, level: 0, fps: 0, lastFrameT: 0, decoding: false, rtcT: 0 };
        this.phones.set(id, p);
      }
      if (meta) { p.meta = meta; p.name = meta.name || p.name; }
      return p;
    },
    onMsg(m) {
      const id = m.from;
      if (m.type === 'hello') { (m.phones || []).forEach(x => this.ensure(x.id, x)); this.emit('change'); return; }
      if (m.type === 'phone-join') { this.ensure(id, m.meta); this.emit('join', this.get(id)); this.emit('change'); return; }
      if (m.type === 'phone-leave') { const p = this.get(id); if (p) { this.drop(p); this.phones.delete(id); this.emit('leave', p); this.emit('change'); } return; }
      const p = typeof id === 'number' ? this.ensure(id) : null; if (!p) return;
      switch (m.type) {
        case 'caps': p.caps = m; p.name = m.name || p.name; this.emit('change'); break;
        case 'offer': this.answer(p, m.sdp); break;
        case 'ice': if (p.pc && m.c) p.pc.addIceCandidate(m.c).catch(() => {}); break;
        case 'mode': if (m.mode === 'jpeg') { this.closePC(p); p.mode = 'jpeg'; this.ensureCanvas(p); this.emit('stream', p); this.emit('change'); } else if (m.mode === 'none') { this.drop(p); this.emit('change'); } break;
        case 'speech': this.emit('speech', { phone: p, text: m.text || '', final: !!m.final, lang: m.lang }); break;
        case 'speech-state': p.speech = m.state; this.emit('change'); break;
        case 'level': p.level = +m.v || 0; this.emit('level', p); break;
        case 'key': this.emit('key', { phone: p, key: m.key }); break;
        case 'tilt': this.emit('tilt', { phone: p, a: m.a, b: m.b, g: m.g }); break;
      }
    },
    // 手机发来 offer：电脑这边应答。局域网直连不需要 STUN；8 秒还没连上就请手机改用 JPEG 兜底
    async answer(p, sdp) {
      this.closePC(p);
      const pc = new RTCPeerConnection({ iceServers: [] }); p.pc = pc; p.mode = 'rtc-wait'; p.rtcT = U.now();
      pc.onicecandidate = e => { if (e.candidate) this.send(p.id, { type: 'ice', c: e.candidate }); };
      pc.ontrack = e => {
        const s = e.streams[0] || new MediaStream([e.track]); p.stream = s;
        if (e.track.kind === 'video') {
          const v = p.video || (p.video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true }));
          v.srcObject = s; v.play().catch(() => {});
        }
        this.emit('change');
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') { p.mode = 'rtc'; this.emit('stream', p); this.emit('change'); }
        if ((st === 'failed' || st === 'disconnected') && p.pc === pc) { this.fallback(p, 'rtc ' + st); }
      };
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp });
        const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
        this.send(p.id, { type: 'answer', sdp: pc.localDescription.sdp });
      } catch (e) { console.warn('rtc answer', e); this.fallback(p, 'rtc error'); return; }
      setTimeout(() => { if (p.pc === pc && pc.connectionState !== 'connected') this.fallback(p, 'rtc timeout'); }, 8000);
    },
    fallback(p, why) {
      console.warn('[phone] 改用 JPEG 兜底：', why);
      this.closePC(p); p.mode = 'jpeg'; this.ensureCanvas(p);
      this.send(p.id, { type: 'jpeg', on: true, fps: 15, w: 480 });
      this.emit('change');
    },
    ensureCanvas(p) { if (!p.canvas) { p.canvas = document.createElement('canvas'); p.canvas.width = 480; p.canvas.height = 360; p.ctx = p.canvas.getContext('2d'); } },
    closePC(p) { if (p.pc) { try { p.pc.close(); } catch (e) {} p.pc = null; } },
    drop(p) { this.closePC(p); p.stream = null; if (p.video) { p.video.srcObject = null; } p.mode = 'none'; },
    onFrame(buf) {
      const u8 = new Uint8Array(buf), p = this.get(u8[0]); if (!p) return;
      if (p.mode !== 'jpeg') { p.mode = 'jpeg'; this.ensureCanvas(p); this.emit('stream', p); this.emit('change'); }
      if (p.decoding) return; p.decoding = true;
      createImageBitmap(new Blob([u8.subarray(1)], { type: 'image/jpeg' })).then(bm => {
        p.decoding = false; this.ensureCanvas(p);
        if (p.canvas.width !== bm.width || p.canvas.height !== bm.height) { p.canvas.width = bm.width; p.canvas.height = bm.height; }
        p.ctx.drawImage(bm, 0, 0); bm.close && bm.close();
        const t = U.now(); if (p.lastFrameT) p.fps = p.fps * .9 + 1000 / Math.max(1, t - p.lastFrameT) * .1; p.lastFrameT = t; p.frames++;
      }).catch(() => { p.decoding = false; });
    },
    want(p, w) { this.send(p.id, Object.assign({ type: 'want' }, w)); },
    async qr(url) { if (M.native) return M.native.qr(url); return ''; },
    urls() { const i = this.info; return i ? { https: i.phoneUrls || [], http: i.phoneHttpUrls || [] } : { https: [], http: [] }; },
  });

  /* ================= 输入源 ================= */
  const Input = M.Input = M.emitter({
    video: null, vw: 0, vh: 0, status: 'idle', error: '', src: null, stream: null,
    audioStream: null, audioSrc: null, audioStatus: 'idle', audioError: '',
    _img: null, _ipCanvas: null, _ipT: 0, _stamp: 0,

    async devices() {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        return { cams: all.filter(d => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || '摄像头 ' + (i + 1) })), mics: all.filter(d => d.kind === 'audioinput' && d.deviceId !== 'communications').map((d, i) => ({ id: d.deviceId, label: d.label || '麦克风 ' + (i + 1) })) };
      } catch (e) { return { cams: [], mics: [] }; }
    },
    errText(e, what) {
      const n = e && e.name;
      if ((n === 'NotAllowedError' || n === 'SecurityError') && M.web) return what + '权限被拒绝了：' + (M.ios ? '到「设置 → Safari → ' + what + '」改成允许，' : '点地址栏左边的 🔒 / ⓘ →「网站设置」把' + what + '改成允许，') + '然后刷新页面' + (M.wechat ? '（微信里不行的话，点右上角「…」→ 在浏览器打开）' : '');
      if (n === 'NotAllowedError' || n === 'SecurityError') return what + '权限被拒绝了：请在系统设置里允许「星星岛」使用' + what;
      if (n === 'NotFoundError' || n === 'OverconstrainedError') return '没有找到' + what + '，请检查是否插好';
      if (n === 'NotReadableError' || n === 'AbortError') return what + '被别的程序占用了，关掉视频会议等软件再试';
      return what + '打不开：' + ((e && e.message) || e);
    },
    stopVideo() {
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      this.stream = null; this.video = null; this.vw = this.vh = 0;
      if (this._img) { this._img.src = ''; this._img = null; }
      if (this._own) { this._own.srcObject = null; this._own.removeAttribute('src'); }
    },
    // src：{kind:'cam', id} / {kind:'phone', id} / {kind:'ipcam', url} / {kind:'file', url}
    async start(src) {
      src = src || M.cfg.video; this.stopVideo(); this.src = src; this.status = 'starting'; this.error = ''; this.emit('change');
      try {
        if (src.kind === 'cam') {
          if (M.native) await M.native.mediaAccess('camera');
          // 手机 / 平板：前置摄像头（人要看着屏幕），分辨率低一点省电省算力
          const base = M.mobile ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 30 }, facingMode: src.facing || 'user' } : { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 } };
          let s;
          try { s = await navigator.mediaDevices.getUserMedia({ video: Object.assign(base, src.id ? { deviceId: { exact: src.id } } : {}) }); }
          catch (e) { if (src.id && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) s = await navigator.mediaDevices.getUserMedia({ video: base }); else throw e; }
          this.stream = s; const v = this.ownVideo(); v.srcObject = s; await v.play().catch(() => {});
          await this.waitVideo(v); this.video = v;
          const tr = s.getVideoTracks()[0]; this.label = tr ? tr.label : '摄像头';
        } else if (src.kind === 'phone') {
          await Phone.init();
          const p = Phone.get(src.id); if (!p) throw new Error('手机还没有连上');
          Phone.want(p, { video: true });
          this.label = p.name; this.bindPhone(p);
          // 8 秒还没有画面（WebRTC 建不起来）：请手机改用 JPEG 图片流
          setTimeout(() => { if (this.src === src && !this.video && p.mode !== 'jpeg' && Phone.get(p.id)) Phone.fallback(p, 'no video'); }, 8000);
        } else if (src.kind === 'ipcam') {
          const img = new Image(); img.crossOrigin = 'anonymous'; this._img = img;
          img.src = '/proxy/mjpeg?url=' + encodeURIComponent(src.url);
          await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('IP 摄像头连不上，检查地址和是否在同一个 Wi-Fi')); setTimeout(() => rej(new Error('IP 摄像头连接超时')), 9000); });
          const c = this._ipCanvas || (this._ipCanvas = document.createElement('canvas')); c.width = img.naturalWidth || 640; c.height = img.naturalHeight || 480; this._ipCtx = c.getContext('2d');
          this.video = c; this.label = 'IP 摄像头';
        } else if (src.kind === 'file') {
          const v = this.ownVideo(); v.src = src.url; v.loop = true; await v.play().catch(() => {}); await this.waitVideo(v); this.video = v; this.label = '演示视频';
        }
        if (this.video) { this.measure(); this.status = 'live'; }
      } catch (e) {
        this.status = 'error'; this.error = e && e.name ? this.errText(e, '摄像头') : String(e.message || e); console.warn(e);
      }
      this.emit('change');
      return this.status === 'live' || (src.kind === 'phone' && this.status !== 'error');
    },
    bindPhone(p) {
      const bind = () => {
        if (!this.src || this.src.kind !== 'phone' || +this.src.id !== p.id) return;
        const el = p.mode === 'rtc' ? p.video : p.mode === 'jpeg' ? p.canvas : null;
        if (el && el !== this.video) { this.video = el; this.status = 'live'; this.measure(); this.emit('change'); }
        if (!el) { this.status = 'starting'; this.emit('change'); }
      };
      if (this._unbind) this._unbind();
      const a = Phone.on('stream', q => q === p && bind()), b = Phone.on('change', bind), c = Phone.on('leave', q => { if (q === p && this.src && this.src.kind === 'phone') { this.video = null; this.status = 'error'; this.error = '手机断开了'; this.emit('change'); } });
      this._unbind = () => { a(); b(); c(); };
      bind();
    },
    ownVideo() { if (!this._own) { this._own = document.createElement('video'); this._own.muted = true; this._own.playsInline = true; } return this._own; },
    waitVideo(v) { return v.readyState >= 2 && v.videoWidth ? Promise.resolve() : new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('摄像头没有画面')), 8000); v.addEventListener('loadeddata', () => { clearTimeout(t); res(); }, { once: true }); }); },
    measure() { const v = this.video; if (!v) return; this.vw = v.videoWidth || v.width || 640; this.vh = v.videoHeight || v.height || 480; },
    // 每帧调用：IP 摄像头把 <img> 当前帧画到 canvas；返回帧戳
    frameStamp() {
      const v = this.video; if (!v) return -1;
      if (this._img && this._ipCtx) { const t = U.now(); if (t - this._ipT > 45) { this._ipT = t; try { this._ipCtx.drawImage(this._img, 0, 0, v.width, v.height); this._stamp++; } catch (e) {} } return this._stamp; }
      if (v.tagName === 'VIDEO') { if (v.videoWidth && (v.videoWidth !== this.vw || v.videoHeight !== this.vh)) this.measure(); return v.readyState >= 2 ? v.currentTime : -1; }
      const p = this.src && this.src.kind === 'phone' && Phone.get(this.src.id); if (p) { if (v.width !== this.vw) this.measure(); return p.frames; }
      return this._stamp++;
    },
    live() { return this.status === 'live' && !!this.video; },
    // 画面亮度（0-255）：太暗时提示开灯
    brightness() {
      const v = this.video; if (!v) return 0;
      const c = this._bc || (this._bc = Object.assign(document.createElement('canvas'), { width: 32, height: 18 })), x = this._bx || (this._bx = c.getContext('2d', { willReadFrequently: true }));
      try { x.drawImage(v, 0, 0, 32, 18); const d = x.getImageData(0, 0, 32, 18).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; return s / (d.length / 4); } catch (e) { return 0; }
    },

    /* ---------- 声音 ---------- */
    stopAudio() { if (this.audioStream && this._ownAudio) this.audioStream.getTracks().forEach(t => t.stop()); this.audioStream = null; this._ownAudio = false; },
    async startAudio(src) {
      src = src || M.cfg.audio; this.stopAudio(); this.audioSrc = src; this.audioStatus = 'starting'; this.audioError = ''; this.emit('audio');
      try {
        if (src.kind === 'none') { this.audioStatus = 'off'; }
        else if (src.kind === 'cam') {
          if (M.native) await M.native.mediaAccess('microphone');
          const c = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
          let s; try { s = await navigator.mediaDevices.getUserMedia({ audio: Object.assign(c, src.id ? { deviceId: { exact: src.id } } : {}) }); }
          catch (e) { if (src.id) s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); else throw e; }
          this.audioStream = s; this._ownAudio = true; this.audioStatus = 'live';
          const tr = s.getAudioTracks()[0]; this.audioLabel = tr ? tr.label : '麦克风';
        } else if (src.kind === 'phone') {
          await Phone.init(); const p = Phone.get(src.id); if (!p) throw new Error('手机还没有连上');
          Phone.want(p, { audio: true }); this.audioLabel = p.name + ' 的麦克风';
          const pick = () => { const tr = p.stream && p.stream.getAudioTracks()[0]; if (tr) { this.audioStream = new MediaStream([tr]); this.audioStatus = 'live'; } else this.audioStatus = p.mode === 'jpeg' ? 'phone-level' : 'starting'; this.emit('audio'); };
          if (this._unA) this._unA(); this._unA = Phone.on('change', pick); pick();
        }
      } catch (e) { this.audioStatus = 'error'; this.audioError = e && e.name ? this.errText(e, '麦克风') : String(e.message || e); console.warn(e); }
      this.emit('audio');
      return this.audioStatus === 'live';
    },
  });
})();
