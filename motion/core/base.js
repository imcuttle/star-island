/* 体感模块公共层：命名空间、事件、配置、滤波与几何小工具（只在 Electron 版加载） */
(function () {
  const M = window.Motion = window.Motion || {};

  // 极简事件
  M.emitter = function (o) {
    const map = new Map();
    o.on = (k, f) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(f); return () => o.off(k, f); };
    o.off = (k, f) => { const s = map.get(k); if (s) s.delete(f); };
    o.emit = (k, a, b) => { const s = map.get(k); if (s) [...s].forEach(f => { try { f(a, b); } catch (e) { console.error(e); } }); };
    return o;
  };
  M.emitter(M);

  /* ---------- 配置：存在 localStorage，和游戏存档分开 ---------- */
  const KEY = 'star-motion-cfg-v1';
  const DEF = {
    video: { kind: 'cam', id: '' },          // cam(deviceId) / phone(手机编号，按名字记) / ipcam(url)
    audio: { kind: 'cam', id: '' },          // cam 本机麦克风 / phone 手机麦克风 / none
    asr: 'auto',                             // auto / vosk / phone / web / off
    mirror: true, model: 'lite', people: 1,  // 识别模型：lite 快 / full 准
    sens: { jump: 1, squat: 1, swipe: 1, punch: 1 }, // 灵敏度倍数（越大越容易触发）
    cursor: { dwell: 1.1, hand: 'auto', global: false },
    pip: 'figure', debug: false, firstRun: true,     // 游戏里的实时小人：figure 线框小人 / camera 摄像头画面 + 骨架 / off 关闭
    phoneName: '',
  };
  M.cfg = (() => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return Object.assign({}, DEF); } })();
  if (M.cfg.pip === true) M.cfg.pip = 'figure'; if (M.cfg.pip === false) M.cfg.pip = 'off';
  M.cfg.sens = Object.assign({}, DEF.sens, M.cfg.sens); M.cfg.cursor = Object.assign({}, DEF.cursor, M.cfg.cursor);
  M.save = () => { try { localStorage.setItem(KEY, JSON.stringify(M.cfg)); } catch (e) {} M.emit('cfg'); };

  /* ---------- 工具 ---------- */
  const U = M.U = {
    clamp: (v, a, b) => v < a ? a : v > b ? b : v,
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    mid: (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 }),
    ang: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
    // 三点夹角（b 为顶点），度
    joint: (a, b, c) => { const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y; const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1; return Math.acos(U.clamp((v1x * v2x + v1y * v2y) / d, -1, 1)) * 180 / Math.PI; },
    rand: (a, b) => a + Math.random() * (b - a),
    pick: a => a[Math.floor(Math.random() * a.length)],
    shuffle: a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    h: (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
    esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    E: (ch, cls) => window.Core ? Core.E(ch, cls) : ch,
    emoSrc: ch => window.Core ? Core.emoSrc(ch) : '',
    now: () => performance.now(),
    FONT: "'Fredoka','ZK','PingFang SC','Microsoft YaHei',sans-serif",
  };

  // 表情图片缓存（canvas 里画 emoji 用项目自带的 Twemoji / Fluent 3D 图，各平台一致）
  const imgCache = new Map();
  U.emoImg = (ch, style) => {
    const k = ch + '|' + (style || '');
    if (imgCache.has(k)) return imgCache.get(k);
    const img = new Image(); img.decoding = 'async';
    const code = window.Core ? Core.emoCode(ch) : '';
    // 水果、炸弹这类主角图优先用 3D 版（Fluent 3D），没有就用 Twemoji
    img.src = style === '3d' && window.EMOJI3D && EMOJI3D[code] ? 'assets/emoji/3d/' + code + '.webp' : (window.Core ? Core.emoSrc(ch) : '');
    imgCache.set(k, img); return img;
  };

  /* ---------- One Euro 滤波：静止时稳、快速移动时跟手 ---------- */
  function LowPass() { this.y = null; }
  LowPass.prototype.f = function (x, a) { this.y = this.y == null ? x : a * x + (1 - a) * this.y; return this.y; };
  M.OneEuro = function (minCut, beta, dCut) {
    this.minCut = minCut || 1.2; this.beta = beta || 0.02; this.dCut = dCut || 1; this.x = new LowPass(); this.dx = new LowPass(); this.t = 0; this.prev = null;
  };
  M.OneEuro.prototype.alpha = function (cut, dt) { const tau = 1 / (2 * Math.PI * cut); return 1 / (1 + tau / dt); };
  M.OneEuro.prototype.f = function (v, t) {
    const dt = this.t ? Math.max(1e-3, (t - this.t) / 1000) : 1 / 30; this.t = t;
    const d = this.prev == null ? 0 : (v - this.prev) / dt; this.prev = v;
    const ed = this.dx.f(d, this.alpha(this.dCut, dt));
    return this.x.f(v, this.alpha(this.minCut + this.beta * Math.abs(ed), dt));
  };
  M.OneEuro.prototype.reset = function () { this.x.y = null; this.dx.y = null; this.prev = null; this.t = 0; };

  /* ---------- 动态 rAF 循环（离开页面自动停） ---------- */
  M.loop = function (fn) {
    let raf = 0, last = U.now(), dead = false;
    const step = () => { if (dead) return; raf = requestAnimationFrame(step); const t = U.now(), dt = Math.min(.05, (t - last) / 1000); last = t; try { fn(dt, t); } catch (e) { console.error(e); dead = true; } };
    raf = requestAnimationFrame(step);
    return { stop() { dead = true; cancelAnimationFrame(raf); } };
  };

  // 这个元素现在看得见吗：不在屏幕内、被上层弹层（设置 / 选关 / 暂停）盖住、页面在后台时都不用重画，省下 GPU 给识别
  U.visible = el => {
    if (!el || !el.isConnected || document.hidden) return false;
    const tops = document.querySelectorAll('.m-layer.top'), top = tops[tops.length - 1];
    if (top && !top.contains(el)) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  // 资源地址（相对 index.html）
  M.url = p => new URL(p, location.href).href;
  M.native = window.StarNative || null;
  // 网页版（https 静态站）：用本机摄像头 / 麦克风，没有手机扫码、IP 摄像头和离线语音
  M.web = !M.native;
  M.mobile = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
  M.ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  M.wechat = /MicroMessenger/i.test(navigator.userAgent);
  M.fullscreen = on => {
    if (M.native) return M.native.fullscreen(on);
    const d = document, el = d.documentElement, cur = !!(d.fullscreenElement || d.webkitFullscreenElement);
    if (on == null) on = !cur; if (on === cur) return Promise.resolve(cur);
    try { const p = on ? (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' }) : (d.exitFullscreen || d.webkitExitFullscreen).call(d); return Promise.resolve(p).then(() => { if (on && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); return on; }).catch(() => cur); } catch (e) { return Promise.resolve(cur); }
  };
  // 屏幕常亮（手机立在一边玩，不能自动锁屏）
  let wake = null;
  M.keepAwake = on => { try { if (on && !wake && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => {}); else if (!on && wake) { wake.release(); wake = null; } } catch (e) {} };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && M._awake) M.keepAwake(true); });
})();
