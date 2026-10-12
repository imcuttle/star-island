/* 体感模块入口：只由 Electron 的 preload 注入（静态网页版不会加载这个文件，也就没有任何体感入口）
   依次加载样式和脚本，然后在主地图底部 dock 里加一个「体感乐园」按钮 */
(function () {
  // 桌面版（StarNative）一定加载；网页版只在安全上下文（https / localhost）且浏览器能开摄像头时加载，否则什么都不做、页面上不出现体感入口
  const web = !window.StarNative, ok = !web || (window.isSecureContext && /^https?:$/.test(location.protocol) && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  if (!ok || window.__motionBoot) return; window.__motionBoot = true;
  const V = '?v=' + Date.now().toString(36).slice(-4);
  const FILES = ['core/base.js', 'core/input.js', 'core/tracker.js', 'core/body.js', 'core/virtual.js', 'core/ears.js', 'core/cursor.js', 'core/synth.js', 'core/sdk.js', 'ui/puppet.js', 'ui/fit.js', 'ui/hub.js', 'ui/setup.js', 'voice/manifest.js',
    'games/beat.js', 'games/dance.js', 'games/run.js', 'games/fruit.js', 'games/wall.js', 'games/sky.js', 'games/spell.js', 'games/simon.js', 'games/kame.js'];
  const base = (document.currentScript && document.currentScript.src.replace(/boot\.js.*$/, '')) || 'motion/';
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'motion.css' + V; document.head.appendChild(css);
  const load = f => new Promise(res => { const s = document.createElement('script'); s.src = base + f + V; s.onload = res; s.onerror = () => { console.warn('[motion] 缺少', f); res(); }; document.head.appendChild(s); });
  (async () => {
    for (const f of FILES) await load(f);
    const M = window.Motion; if (!M) return; M.booted = true;
    document.documentElement.classList.add('has-motion');

    // 按配置打开输入（大厅 / 设置页进来时调用；已经开着就不动）
    let starting = null; const v0 = () => M.cfg.video;
    M.ensureRunning = () => starting || (starting = (async () => {
      M.Phone.init();
      if (!M.Input.live() && M.Input.status !== 'starting') {
        const v = M.web && v0().kind !== 'cam' ? { kind: 'cam', id: '' } : v0();
        // 上次用的是手机：等它重新连上再切过去，先用电脑摄像头
        if (v.kind === 'phone') { const p = M.Phone.list().find(x => x.name === M.cfg.phoneName); if (p) await M.Input.start({ kind: 'phone', id: p.id }); else await M.Input.start({ kind: 'cam', id: '' }); }
        else await M.Input.start(v);
      }
      if (!M.Input.audioStream && M.cfg.audio.kind !== 'none') { const a = M.web && M.cfg.audio.kind === 'phone' ? { kind: 'cam', id: '' } : M.cfg.audio; await M.Input.startAudio(a.kind === 'phone' && !M.Phone.get(a.id) ? { kind: 'cam', id: '' } : a); }
      if (M.Input.audioStream && !M.Ears.stream) M.Ears.attach(M.Input.audioStream);
      M.Input.on('audio', () => { if (M.Input.audioStream && M.Ears.stream !== M.Input.audioStream) M.Ears.attach(M.Input.audioStream); });
      await M.Tracker.configure({}); M.Tracker.start();
      starting = null;
    })());
    // 记住的手机重新连上时自动切回手机画面
    if (M.native) M.Phone.on('join', p => { if (M.cfg.video.kind === 'phone' && p.name === M.cfg.phoneName && !(M.Input.src && M.Input.src.kind === 'phone')) setTimeout(() => M.Input.start({ kind: 'phone', id: p.id }), 600); });
    // 手机遥控器：方向键 / 确定 / 返回 当作键盘
    if (M.native) M.Phone.on('key', e => { const k = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', ok: 'Enter', back: 'Escape' }[e.key] || e.key; dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); if (k === 'Enter' && M.Cursor.target) M.Cursor.click(); });

    // 主地图 dock 里加入口；地图每次重建都补上
    const addBtn = () => {
      const dock = document.querySelector('#app .s-hub .dock'); if (!dock || dock.querySelector('.d-motion')) return;
      const b = document.createElement('button'); b.className = 'dbtn d-motion'; b.dataset.key = 'm'; b.dataset.say = '体感乐园';
      b.innerHTML = Core.E('🕺') + '<span>体感</span>';
      b.addEventListener('click', e => { e.stopPropagation(); Core.Audio2.sfx('click', .4); M.UI.hub(); }, true);
      dock.insertBefore(b, dock.firstChild);
    };
    new MutationObserver(addBtn).observe(document.getElementById('app'), { childList: true, subtree: true });
    addBtn();

    // 测试入口：#motion=hub / setup / 游戏 id
    const h = /motion=([\w-]+)/.exec(location.hash);
    if (h) {
      const wait = () => new Promise(r => { const t = setInterval(() => { if (window.Core && Core.Store.p && document.querySelector('#app .screen.in')) { clearInterval(t); r(); } }, 200); });
      await wait();
      if (h[1] === 'setup') { await M.UI.hub(); }
      else if (h[1] === 'hub') M.UI.hub();
      else if (M.gameById(h[1])) { M.cfg.firstRun = false; M.play(h[1], { zone: (/zone=(\w+)/.exec(location.hash) || [])[1] || 'math', mode: (/mode=(\w+)/.exec(location.hash) || [])[1], players: +((/players=(\d)/.exec(location.hash) || [])[1] || 1) }); }
    }
  })();
})();
