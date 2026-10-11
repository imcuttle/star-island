/* 设备适配：屏蔽浏览器手势（下拉刷新、滑动返回、双指缩放、双击 / 长按放大、长按菜单）、返回键、横竖屏、PWA、3D 画质档位
   必须在 core.js 之前加载 */
(function () {
  'use strict';
  const D = document, ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const mobile = isIOS || /Android|Mobile/i.test(ua);
  const standalone = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;

  /* ---------- 1. 屏蔽浏览器自带手势 ---------- */
  const editable = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  // 手指按下处最近的、真的能滚动的容器（弹窗里的长列表等）
  function scroller(el) {
    for (; el && el.nodeType === 1 && el !== D.body; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY + ' ' + s.overflowX)) return el;
      }
    }
    return null;
  }
  let scr = null, sx = 0, sy = 0;
  D.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; const t = e.touches[0]; scr = scroller(e.target); sx = t.clientX; sy = t.clientY; }, { passive: true });
  // 单指拖动只交给能滚动的容器，而且滚到头不再往外"拉"（否则整页回弹 / 下拉刷新 / 左右滑动翻页）；双指一律拦下（缩放）
  D.addEventListener('touchmove', e => {
    if (!e.cancelable) return;
    if (e.touches.length > 1) { e.preventDefault(); return; }
    if (editable(e.target)) return;
    if (!scr) { e.preventDefault(); return; }
    const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    const out = Math.abs(dy) >= Math.abs(dx)
      ? (dy > 0 && scr.scrollTop <= 0) || (dy < 0 && scr.scrollTop + scr.clientHeight >= scr.scrollHeight - 1)
      : (dx > 0 && scr.scrollLeft <= 0) || (dx < 0 && scr.scrollLeft + scr.clientWidth >= scr.scrollWidth - 1);
    if (out) e.preventDefault();
  }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => D.addEventListener(ev, e => e.preventDefault())); // iOS 双指缩放
  D.addEventListener('dblclick', e => { if (!editable(e.target)) e.preventDefault(); }, { passive: false }); // 双击放大
  D.addEventListener('contextmenu', e => { if (!editable(e.target)) e.preventDefault(); }); // 长按 / 右键菜单
  // 长按选字（iPhone 会弹出放大镜）：不让开始选，万一选上了也马上清掉
  const elOf = n => n && (n.nodeType === 1 ? n : n.parentElement);
  D.addEventListener('selectstart', e => { if (!editable(elOf(e.target))) e.preventDefault(); });
  D.addEventListener('selectionchange', () => { const s = getSelection(); if (s && s.rangeCount && !s.isCollapsed && !editable(D.activeElement) && !editable(elOf(s.anchorNode))) s.removeAllRanges(); });
  D.addEventListener('dragstart', e => { if (e.target && e.target.tagName === 'IMG') e.preventDefault(); });
  addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false }); // 触控板捏合缩放

  /* ---------- 2. 返回键 / 边缘滑动返回：留在游戏里，当作点了「返回 / 关闭」 ---------- */
  // 浏览器只认用户操作后加的历史记录，所以每次手指 / 键盘操作时补一条
  let armed = false;
  const arm = () => { if (armed) return; armed = true; try { history.pushState({ si: 1 }, ''); } catch (e) {} };
  addEventListener('pointerdown', arm, true); addEventListener('keydown', arm, true);
  addEventListener('popstate', () => {
    armed = false;
    const C = window.Core; if (!C || !C.Keys || D.body.classList.contains('locked')) return;
    const K = C.Keys, sc = K.scope(); if (!sc) return;
    const el = sc.querySelector('.mclose') || (sc.id === 'app' ? Array.from(sc.querySelectorAll('.back')).find(b => K.visible(b)) : null);
    if (el) K.fire(el);
  });

  /* ---------- 3. 横竖屏切换：iOS 转屏后尺寸要过一会儿才更新，多补几次 resize ---------- */
  let kicks = [];
  const kick = () => { kicks.forEach(clearTimeout); kicks = [80, 300, 700].map(t => setTimeout(() => { if (scrollY || scrollX) scrollTo(0, 0); dispatchEvent(new Event('resize')); }, t)); };
  addEventListener('orientationchange', kick);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', kick);

  /* ---------- 4. PWA：添加到主屏幕后全屏打开，离线也能玩已经下载过的内容 ---------- */
  if (standalone()) D.documentElement.classList.add('pwa');
  if (isIOS) D.documentElement.classList.add('ios');
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  /* ---------- 5. 3D 画质：按设备分档，运行中按帧率自动降分辨率 / 帧率，降低发热 ---------- */
  // 档位：0 省电（1 倍分辨率、无抗锯齿、无阴影、30 帧）· 1 均衡 · 2 高清
  const TIERS = [
    { dpr: 1, aa: false, shadow: 0, fps: 30, map: 512 },
    { dpr: 1.5, aa: true, shadow: 1, fps: 60, map: 1024 },
    { dpr: 2, aa: true, shadow: 2, fps: 60, map: 2048 },
  ];
  // 自动档里的降级台阶：分辨率倍数 s、帧率上限 f
  const STEPS = [[{ s: 1, f: 30 }, { s: .8, f: 30 }, { s: .65, f: 30 }], [{ s: 1, f: 60 }, { s: .85, f: 60 }, { s: .7, f: 60 }, { s: .7, f: 30 }, { s: .6, f: 30 }], [{ s: 1, f: 60 }, { s: .85, f: 60 }, { s: .7, f: 60 }, { s: .7, f: 30 }]];
  const LS = 'si-perf';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })();
  let gpuName = null;
  function gpu() {
    if (gpuName != null) return gpuName; gpuName = '';
    try {
      const gl = D.createElement('canvas').getContext('webgl');
      if (gl) { const x = gl.getExtension('WEBGL_debug_renderer_info'); gpuName = String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); const l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); }
    } catch (e) {}
    return gpuName;
  }
  const SOFT_GPU = /SwiftShader|llvmpipe|softpipe|Software/i;
  const LOW_GPU = /Mali-[2-4]\d\d|Mali-T|Mali-G(31|51|52|57|68|71|72)\b|Adreno \(TM\) ([1-5]\d\d|6[0-1]\d)\b|PowerVR|GE8\d{3}|Intel.*(HD Graphics( [2-5]\d{2,3})?\b|GMA)/i;
  function autoTier() {
    if (saved.auto != null && saved.gpu === gpu()) return saved.auto;
    const g = gpu(), mem = navigator.deviceMemory || 0, cores = navigator.hardwareConcurrency || 0;
    const t = SOFT_GPU.test(g) ? 0 : mobile ? (LOW_GPU.test(g) || (mem && mem <= 3) || (!isIOS && cores && cores <= 4) ? 0 : 1) : (LOW_GPU.test(g) || (cores && cores <= 2) ? 1 : 2);
    saved.auto = t; saved.gpu = g; store(); return t;
  }
  function store() { try { localStorage.setItem(LS, JSON.stringify(saved)); } catch (e) {} }
  const choice = () => { const p = window.Core && Core.Store.p; return (p && p.settings.gfx) || 'auto'; };
  const tierIdx = () => { const c = choice(); return c === 'low' ? 0 : c === 'mid' ? 1 : c === 'high' ? 2 : autoTier(); };

  const live = new Set();
  let paused = false, step = 0, stepTier = -1, lastChange = 0, acc = { sum: 0, n: 0 }, good = 0, fails = 0;
  const steps = () => STEPS[tierIdx()];
  function syncStep() { const t = tierIdx(); if (t !== stepTier) { stepTier = t; step = choice() === 'auto' ? Math.min(saved['step' + t] || 0, STEPS[t].length - 1) : 0; } return steps()[step]; }
  const interval = () => 1000 / syncStep().f;
  // 自动降分辨率也有下限：均衡 / 高清档不低于 1 倍（再低就糊了），省电档不低于 0.75 倍
  const scaled = (base, s) => Math.min(base, Math.max(tierIdx() ? 1 : .75, base * s));
  function apply() {
    const s = syncStep().s;
    live.forEach(r => { if (!r.rd.domElement.isConnected && r.attached) { live.delete(r); return; } if (!r.fixed) r.setPR(scaled(r.base, s)); });
  }
  function setStep(n) { n = Math.max(0, Math.min(steps().length - 1, n)); if (n === step) return; step = n; saved['step' + stepTier] = n; store(); lastChange = performance.now(); acc = { sum: 0, n: 0 }; good = 0; apply(); }
  // 每约 90 帧看一次平均帧间隔：明显跟不上就降一级，一直很流畅才慢慢升回来（降过的次数越多，升回来越谨慎）
  function sample(dt, r, now) {
    if (choice() !== 'auto' || dt > 250 || now - r.born < 3000 || now - lastChange < 3000) return;
    acc.sum += dt; acc.n++; if (acc.n < 90) return;
    const avg = acc.sum / acc.n, T = 1000 / steps()[step].f; acc = { sum: 0, n: 0 };
    if (avg > T * 1.45) { fails++; good = 0; setStep(step + 1); }
    else if (avg < T * 1.12 && step > 0) { if (++good >= 4 * Math.min(8, Math.pow(2, fails))) setStep(step - 1); }
    else good = 0;
  }
  function allow(r) {
    if (paused) return false;
    const now = performance.now();
    if (now - r.skip < 5) return false; // 这一帧已经决定跳过（同一帧里的多次渲染一起跳）
    const dt = now - r.last;
    if (dt < 5) return true;
    if (dt < interval() * .75) { r.skip = now; return false; } // 高刷屏 / 30 帧档：隔帧渲染
    r.last = now; sample(dt, r, now); return true;
  }

  const Perf = {
    tier: () => tierIdx(),
    choice,
    // 创建 WebGLRenderer：o 是 three 的参数；c.dpr 期望的最大像素比，c.fixed 固定像素比（像素风），c.shadows 是否要阴影
    renderer(o, c) {
      const T = window.THREE, t = TIERS[tierIdx()]; c = c || {};
      o = Object.assign({}, o); if (!t.aa) o.antialias = false;
      const rd = new T.WebGLRenderer(o);
      const r = { rd, base: 1, fixed: !!c.fixed, last: -1e9, skip: -1e9, born: performance.now(), attached: false, setPR: rd.setPixelRatio.bind(rd) };
      rd.setPixelRatio = v => { r.base = r.fixed ? v : Math.min(v, t.dpr); r.setPR(r.fixed ? v : scaled(r.base, syncStep().s)); };
      rd.setPixelRatio(c.fixed ? c.dpr : Math.min(devicePixelRatio || 1, c.dpr || 2));
      if (c.shadows) { rd.shadowMap.enabled = t.shadow > 0; rd.shadowMap.type = t.shadow > 1 ? T.PCFSoftShadowMap : T.PCFShadowMap; }
      const render = rd.render.bind(rd), dispose = rd.dispose.bind(rd);
      rd.renderNow = render; // 拍照等需要立刻出图的地方用
      rd.render = (s, cam) => { r.attached = r.attached || rd.domElement.isConnected; if (allow(r)) render(s, cam); };
      rd.dispose = () => { live.delete(r); dispose(); };
      live.add(r);
      return rd;
    },
    // 阴影贴图尺寸按档位封顶
    shadowSize: n => Math.min(n, TIERS[tierIdx()].map),
    // 锁屏等全屏遮罩期间暂停所有 3D 渲染
    pause(on) { paused = !!on; },
    // 家长中心改了画质：已有画面立即按新档位调整分辨率
    refresh() { stepTier = -1; const t = TIERS[tierIdx()]; live.forEach(r => { if (!r.fixed) r.base = Math.min(r.base, t.dpr); }); apply(); },
  };
  window.Perf = Perf;
})();
