/* 资源加载统计：记下当前页正在加载的全部资源（脚本、样式、图片、音频、字体、fetch、CSS 背景图），
   供切场景 / 弹窗判断"是不是都加载完了"（进度统一显示在屏幕中间的加载层，见 preload.js 的 Loader）。
   必须放在 <head> 里、所有样式和脚本之前加载。 */
(function () {
  'use strict';
  const ITEM_TIMEOUT = 30000;
  const pending = new Map(); // key -> timeout id
  const doneUrls = new Set(); // 已加载完成的 URL（来自 Resource Timing 或加载事件）
  let total = 0, done = 0;

  // 首屏：window.load 之前一直视为加载中，避免脚本之间的空档被当成加载完了（不计入数量）
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
      case 'SCRIPT': if (n.src && !n.dataset.bg) trackEl(n, n.src, ['load', 'error']); break; // data-bg：后台加载的 3D 模型，不拦场景
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

  function update() { if (!busy()) { total = pending.size; done = 0; } }

  // 供场景切换使用：等到没有任何资源在加载、并且安静 quiet 毫秒（连锁加载的下一步也算进来）
  window.NetLoad = {
    pending: () => pending.size + (pageHold ? 1 : 0),
    keys: () => [...pending.keys()],
    idle(quiet) {
      quiet = quiet == null ? 250 : quiet;
      return new Promise(res => { let calm = 0, last = performance.now(); const f = () => { const now = performance.now(); calm = busy() ? 0 : calm + (now - last); last = now; if (calm >= quiet) res(); else setTimeout(f, 50); }; f(); });
    },
  };

})();
