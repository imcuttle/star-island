/* 资源加载进度角标：仅在 Wi-Fi（或有线）网络下显示，流量网络不显示。
   统计当前页正在加载的全部资源（脚本、样式、图片、音频、字体、CSS 背景图），全部完成后自动消失。
   必须放在 <head> 里、所有样式和脚本之前加载。 */
(function () {
  'use strict';
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  // type 可读时：只有 wifi / ethernet 才显示；读不到（iOS、桌面 Safari/Firefox 等）时按非流量处理，开启省流量则不显示
  function allowed() {
    if (!conn) return true;
    if (conn.type) return conn.type === 'wifi' || conn.type === 'ethernet';
    return !conn.saveData;
  }

  const SHOW_DELAY = 400, HIDE_DELAY = 600, ITEM_TIMEOUT = 30000;
  const pending = new Map(); // key -> timeout id
  const doneUrls = new Set(); // 已加载完成的 URL（来自 Resource Timing 或加载事件）
  let total = 0, done = 0, el = null, bar = null, txt = null, visible = false, showT = 0, hideT = 0;

  // 首屏：window.load 之前一直视为加载中，避免脚本之间的空档让角标闪烁（不计入数量）
  let pageHold = document.readyState !== 'complete';
  if (pageHold) addEventListener('load', () => { pageHold = false; update(); });
  const busy = () => pending.size > 0 || pageHold;

  const abs = u => { try { return new URL(u, location.href).href; } catch (e) { return ''; } };
  const skip = u => !u || /^(data|blob|about|javascript):/.test(u);

  function finish(key) {
    const t = pending.get(key);
    if (t === undefined) return;
    clearTimeout(t); pending.delete(key); done++;
    if (key[0] !== '#') doneUrls.add(key);
    update();
  }
  function start(key) {
    if (pending.has(key)) return false;
    pending.set(key, setTimeout(() => finish(key), ITEM_TIMEOUT)); total++;
    update();
    return true;
  }
  function trackEl(node, url, events) {
    if (skip(url)) return;
    const key = abs(url);
    if (!key || doneUrls.has(key)) return;
    start(key);
    const f = () => { events.forEach(e => node.removeEventListener(e, f)); finish(key); };
    events.forEach(e => node.addEventListener(e, f));
  }

  const IMG_EV = ['load', 'error', 'abort'];
  const MEDIA_EV = ['canplaythrough', 'loadeddata', 'suspend', 'error', 'abort'];
  function trackImg(img) { const u = img.currentSrc || img.src; if (u && !img.complete) trackEl(img, u, IMG_EV); }
  function trackMedia(m) { const u = m.currentSrc || m.src; if (u && m.readyState < 2) trackEl(m, u, MEDIA_EV); }
  function trackNode(n) {
    switch (n.tagName) {
      case 'IMG': trackImg(n); break;
      case 'SCRIPT': if (n.src) trackEl(n, n.src, ['load', 'error']); break;
      case 'LINK': if (/stylesheet/i.test(n.rel) && n.href && !n.sheet) trackEl(n, n.href, ['load', 'error']); break;
      case 'AUDIO': case 'VIDEO': trackMedia(n); break;
    }
  }
  function scan(n) {
    if (n.nodeType !== 1) return;
    trackNode(n);
    if (n.firstElementChild) n.querySelectorAll('img,script[src],link[rel~=stylesheet],audio,video').forEach(trackNode);
  }

  // 1) DOM 中新增的元素（解析 HTML、innerHTML、appendChild）
  new MutationObserver(list => {
    for (const r of list) for (const n of r.addedNodes) scan(n);
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan(document.documentElement);

  // 2) 脚本里直接设置 src（new Image()、audio.src = ...）
  function hookSrc(proto, fn) {
    const d = Object.getOwnPropertyDescriptor(proto, 'src');
    if (!d || !d.set) return;
    Object.defineProperty(proto, 'src', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set(v) { d.set.call(this, v); fn(this); },
    });
  }
  hookSrc(HTMLImageElement.prototype, trackImg);
  hookSrc(HTMLMediaElement.prototype, trackMedia);
  // new Audio(url) 不走 src setter，单独包一层
  const NativeAudio = window.Audio;
  if (NativeAudio) {
    const A = function (src) { const a = arguments.length ? new NativeAudio(src) : new NativeAudio(); if (src) trackMedia(a); return a; };
    A.prototype = NativeAudio.prototype;
    window.Audio = A;
  }

  // fetch（开局预加载用它下载音频）
  const nativeFetch = window.fetch;
  if (nativeFetch) {
    let rid = 0;
    window.fetch = function (input) {
      const p = nativeFetch.apply(this, arguments), k = '#fetch' + (rid++);
      start(k);
      // 等响应体也读完才算完成：克隆一份读到底，不影响调用方
      p.then(r => r.clone().arrayBuffer()).catch(() => {}).then(() => finish(k));
      return p;
    };
  }

  // 3) 字体
  if (document.fonts && document.fonts.addEventListener) {
    let fid = 0; const fkeys = new Map();
    document.fonts.addEventListener('loading', e => e.fontfaces.forEach(ff => { const k = '#font' + (fid++); fkeys.set(ff, k); start(k); }));
    const ffDone = e => e.fontfaces.forEach(ff => { const k = fkeys.get(ff); if (k) { fkeys.delete(ff); finish(k); } });
    document.fonts.addEventListener('loadingdone', ffDone);
    document.fonts.addEventListener('loadingerror', ffDone);
  }

  // 4) Resource Timing：兜底标记完成，并把事先无法预知的 CSS 背景图也计入
  if (window.PerformanceObserver) {
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          const u = e.name;
          if (pending.has(u)) { finish(u); continue; }
          const known = doneUrls.has(u); doneUrls.add(u);
          if (!known && busy() && e.initiatorType === 'css' && !/\.(woff2?|ttf|otf)(\?|$)/i.test(u)) { total++; done++; update(); }
        }
      }).observe({ type: 'resource', buffered: true });
    } catch (e) {}
  }

  /* ---------- 角标 UI ---------- */
  function build() {
    const st = document.createElement('style');
    st.textContent =
      '#netload{position:fixed;left:calc(10px + env(safe-area-inset-left));bottom:calc(10px + env(safe-area-inset-bottom));z-index:2147483000;' +
      'display:flex;align-items:center;gap:8px;padding:6px 12px 6px 10px;border-radius:999px;background:rgba(255,255,255,.92);color:#3b4a6b;' +
      'font:600 12px/1.2 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;box-shadow:0 2px 10px rgba(0,40,90,.18);' +
      'pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .3s,transform .3s}' +
      '#netload.on{opacity:1;transform:none}' +
      '#netload .nl-track{width:72px;height:6px;border-radius:3px;background:#e3ecf7;overflow:hidden}' +
      '#netload .nl-bar{height:100%;width:0;border-radius:3px;background:linear-gradient(90deg,#5ec8ff,#7be495);transition:width .25s}' +
      '#netload .nl-txt{font-variant-numeric:tabular-nums;white-space:nowrap}';
    document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'netload'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="nl-track"><div class="nl-bar"></div></div><span class="nl-txt"></span>';
    bar = el.firstChild.firstChild; txt = el.lastChild;
  }
  function render() {
    const all = Math.max(1, total), ok = Math.min(all, done), on = busy();
    const pct = on ? Math.min(99, Math.floor(ok / all * 100)) : 100;
    bar.style.width = pct + '%';
    txt.textContent = on ? '资源加载中 ' + pct + '%  ' + ok + '/' + all : '加载完成';
  }
  function show() {
    showT = 0;
    if (!allowed() || !busy() || !document.body) return;
    if (!el) build();
    if (!el.isConnected) document.body.appendChild(el);
    render();
    void el.offsetWidth; el.classList.add('on'); visible = true;
  }
  function reset() { total = pending.size; done = 0; }
  function update() {
    if (busy()) {
      if (hideT) { clearTimeout(hideT); hideT = 0; }
      if (visible) render();
      else if (!showT) showT = setTimeout(show, SHOW_DELAY);
      return;
    }
    if (showT) { clearTimeout(showT); showT = 0; }
    if (!visible) { reset(); return; }
    render();
    if (!hideT) hideT = setTimeout(() => {
      hideT = 0; if (busy()) return;
      el.classList.remove('on'); visible = false; reset();
    }, HIDE_DELAY);
  }

  // 供场景切换使用：等到没有任何资源在加载、并且安静 quiet 毫秒（连锁加载的下一步也算进来）
  window.NetLoad = {
    pending: () => pending.size + (pageHold ? 1 : 0),
    keys: () => [...pending.keys()],
    idle(quiet) {
      quiet = quiet == null ? 250 : quiet;
      return new Promise(res => { let calm = 0, last = performance.now(); const f = () => { const now = performance.now(); calm = busy() ? 0 : calm + (now - last); last = now; if (calm >= quiet) res(); else setTimeout(f, 50); }; f(); });
    },
  };

  if (conn && conn.addEventListener) conn.addEventListener('change', () => {
    if (!allowed() && el) { el.classList.remove('on'); visible = false; }
    else if (allowed() && busy() && !visible && !showT) showT = setTimeout(show, SHOW_DELAY);
  });
})();
