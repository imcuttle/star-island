/* 体感界面在手机 / 平板上的「一屏放下」和沉浸体验
   体感时人站在 2 米外，没法拖滚动条，所以：
   · UI.fit(box)：弹窗内容放不下时整体等比缩小（不低于 min），宽度同步放宽，尽量一屏放下
   · UI.scroller(el)：还是放不下的区域，隐藏滚动条，在边缘放「手放这里往下翻」的翻页条——体感光标停上去就自动滚，点一下翻一页；触屏照常手指滑
   · UI.steppers(root)：滑块（体感光标拖不动）换成 − / + 按钮
   · 生命周期：离开体感区就关摄像头和麦克风；切到后台 / 手机竖过来时游戏自动暂停；回到前台摄像头断了就重新打开
   · 触屏保护：体感页面禁止下拉刷新、长按菜单、双击缩放、选中文字 */
(function () {
  const M = window.Motion, U = M.U;
  const UI = M.UI = M.UI || {};
  const compact = () => innerHeight <= 520;
  UI.compact = compact;
  // 体感画面实际占的区域（投屏铺满时是居中的 16:9，不是整个窗口）
  UI.area = () => { const a = document.getElementById('app'); return a ? a.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight }; };

  /* ---------- 弹窗等比缩放 ---------- */
  UI.fit = function (box, o) {
    o = o || {}; const min = o.min || .74, pad = o.pad == null ? 12 : o.pad;
    let w0 = null;
    const run = () => {
      if (!box.isConnected) return;
      box.style.scale = ''; box.style.width = ''; box.style.maxHeight = '';
      w0 = box.getBoundingClientRect().width;
      const ar = UI.area(), aw = ar.width - pad * 2, ah = ar.height - pad * 2;
      let s = 1;
      for (let i = 0; i < 3; i++) {
        const h = box.scrollHeight; const want = U.clamp(Math.min(ah / h, aw / Math.max(1, w0)), min, 1);
        if (Math.abs(want - s) < .01 && i) break; s = want;
        box.style.width = Math.min(aw, w0) / s + 'px';
      }
      if (s >= .995) { box.style.width = ''; s = 1; }
      box.style.maxHeight = ah / s + 'px';
      box.style.scale = s < 1 ? s.toFixed(3) : ''; // 用独立的 scale 属性，不和弹出动画的 transform 打架
      box.dataset.fit = s.toFixed(2);
    };
    run(); requestAnimationFrame(run); setTimeout(run, 400); // 等字体、图片、canvas 尺寸就位
    const ro = new ResizeObserver(() => { clearTimeout(box._fitT); box._fitT = setTimeout(run, 120); });
    ro.observe(document.documentElement); addEventListener('resize', run);
    return { refit: run, stop: () => { ro.disconnect(); removeEventListener('resize', run); } };
  };

  /* ---------- 体感翻页条（代替滚动条） ---------- */
  UI.scroller = function (el, o) {
    o = o || {}; if (el._scroller) return el._scroller;
    el.classList.add('m-scr');
    const host = o.host || el.closest('.m-layer') || el.closest('.screen') || document.body;
    const mk = dir => {
      const b = U.h('button', 'm-pg ' + dir, '<i>' + (dir === 'up' ? '▲' : '▼') + '</i>' + U.E('✋') + '<span>' + (dir === 'up' ? '往上翻' : '往下翻') + '</span>');
      b.onclick = () => { el.scrollBy({ top: (dir === 'up' ? -1 : 1) * el.clientHeight * .8, behavior: 'smooth' }); M.Synth.sfx('pop', .3); };
      host.appendChild(b); return b;
    };
    const up = mk('up'), dn = mk('dn'); let first = true;
    const place = () => {
      const r = el.getBoundingClientRect(), hr = host.getBoundingClientRect(), max = el.scrollHeight - el.clientHeight;
      const more = max > 4 && r.height > 40 && U.visible(el);
      const canUp = more && el.scrollTop > 4, canDn = more && el.scrollTop < max - 4;
      el.classList.toggle('m-fade-t', canUp); el.classList.toggle('m-fade-b', canDn);
      // 有更多内容时右边留出一条「翻页轨」（不盖住内容）：上半是 ▲，下半是 ▼
      if (more) el.classList.add('m-scr-on'); else if (max <= 0) el.classList.remove('m-scr-on');
      const h = Math.max(44, (r.height - 18) / 2);
      [[up, canUp, r.top - hr.top + 6], [dn, canDn, r.bottom - hr.top - 6 - h]].forEach(([b, on, y]) => {
        b.classList.toggle('in', more); b.classList.toggle('dim', !on);
        if (!more) return;
        b.style.height = h + 'px'; b.style.left = (r.right - hr.left - 56) + 'px'; b.style.top = y + 'px';
      });
      // 第一次发现有更多内容：翻页条跳两下，提醒「下面还有」
      if (canDn && first) { first = false; dn.classList.add('hint'); setTimeout(() => dn.classList.remove('hint'), 2600); }
    };
    let last = 0;
    const lp = M.loop((dt, t) => {
      if (!el.isConnected) { stop(); return; }
      // 体感光标停在翻页条上：持续滚动（越停越快）
      [[up, -1], [dn, 1]].forEach(([b, s]) => {
        if (b.classList.contains('m-hover') && b.classList.contains('in')) { b._h = (b._h || 0) + dt; el.scrollTop += s * el.clientHeight * Math.min(1.6, .5 + b._h * .6) * dt; } else b._h = 0;
      });
      if (t - last > 150) {
        last = t; place();
        // 体感光标停在半露出来的按钮上：把它滚进来
        const hv = el.querySelector('.m-hover');
        if (hv && hv !== el._hv) { const r = hv.getBoundingClientRect(), er = el.getBoundingClientRect(); if (r.top < er.top || r.bottom > er.bottom) hv.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        el._hv = hv;
      }
    });
    const stop = () => { lp.stop(); up.remove(); dn.remove(); el._scroller = null; };
    el.addEventListener('scroll', place, { passive: true }); place();
    return (el._scroller = { stop, place });
  };

  /* ---------- 滑块 → − / + 按钮 ---------- */
  UI.steppers = function (root) {
    root.querySelectorAll('input[type=range]:not([data-st])').forEach(r => {
      r.dataset.st = '1';
      const st = (+r.max - +r.min) / 8, fmt = v => (+v).toFixed(String(r.step).split('.')[1] ? String(r.step).split('.')[1].length : 0);
      const w = U.h('span', 'm-stepper', '<button class="m-stb" data-d="-1">−</button><b class="m-stv"></b><button class="m-stb" data-d="1">+</button>');
      r.after(w); r.style.display = 'none';
      const show = () => { w.querySelector('.m-stv').textContent = fmt(r.value); const k = (r.value - r.min) / (r.max - r.min); w.style.setProperty('--k', k); };
      w.onclick = e => { const b = e.target.closest('.m-stb'); if (!b) return; e.preventDefault(); r.value = U.clamp(+r.value + b.dataset.d * st, +r.min, +r.max); r.dispatchEvent(new Event('input', { bubbles: true })); show(); M.Synth.sfx('pop', .3); };
      r.addEventListener('input', show); show();
    });
  };

  /* ---------- 生命周期 ---------- */
  const inMotion = () => /^(motion|mgame)$/.test(document.documentElement.dataset.screen || '');

  /* ---------- 全屏 / 横屏 / 投屏铺满 ----------
     · 手机 / 平板网页版：点进体感（点击当下）自动全屏、隐藏地址栏、锁定横屏；离开体感区自动退出（只退我们自己开的）
     · iPhone 的 Safari 不支持网页全屏：提示「添加到主屏幕」，从桌面打开就是全屏
     · 投屏铺满：镜像投屏是把手机画面原样搬到电视，手机屏幕比电视「长」，电视上一定有黑边。
       打开后体感画面变成和电视一样的 16:9（居中，两边是装饰底色），再把电视 / 投屏软件的画面比例调成「全屏 / 缩放」，
       电视放大后正好裁掉两边的装饰，游戏铺满整个电视、没有黑边、也不变形 */
  const D = document, de = D.documentElement;
  const isFS = UI.isFS = () => !!(D.fullscreenElement || D.webkitFullscreenElement);
  UI.canFS = () => !!(D.fullscreenEnabled || D.webkitFullscreenEnabled);
  UI.standalone = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
  UI.touch = () => matchMedia('(pointer: coarse)').matches;
  const lockLand = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
  const unlock = () => { try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {} };
  let autoFS = false;
  // 必须在点击事件里调用（浏览器只允许用户操作时进全屏）
  UI.immerse = function () {
    if (!M.web || !UI.touch()) return;
    if (!isFS() && UI.canFS()) { autoFS = true; M.fullscreen(true); } else lockLand();
  };
  D.addEventListener(D.onfullscreenchange !== undefined ? 'fullscreenchange' : 'webkitfullscreenchange', () => {
    de.classList.toggle('m-isfs', isFS());
    if (isFS() && inMotion()) lockLand(); if (!isFS()) autoFS = false;
    UI.tvApply(); M.emit('fullscreen', isFS());
  });
  const TV = 16 / 9; let tvBusy = false;
  UI.tvApply = function () {
    const on = !!M.cfg.tvFill && inMotion(), was = de.classList.contains('m-tvfill');
    de.classList.toggle('m-tvfill', on);
    if (on) {
      const W = innerWidth, H = innerHeight; let x = 0, y = 0;
      if (W / H > TV + .01) x = Math.floor((W - H * TV) / 2); else if (W / H < TV - .01) y = Math.floor((H - W / TV) / 2);
      de.style.setProperty('--tvx', x + 'px'); de.style.setProperty('--tvy', y + 'px');
    }
    // 画面区域变了：让游戏画布重新量尺寸
    if (on !== was && !tvBusy) { tvBusy = true; dispatchEvent(new Event('resize')); tvBusy = false; }
  };
  UI.tvToggle = function (v) { M.cfg.tvFill = v == null ? !M.cfg.tvFill : !!v; M.save(); UI.tvApply(); tvBusy = true; dispatchEvent(new Event('resize')); tvBusy = false; M.emit('tv', M.cfg.tvFill); };
  addEventListener('resize', () => { if (!tvBusy) UI.tvApply(); });
  new MutationObserver(() => {
    UI.tvApply();
    if (!inMotion()) { unlock(); if (autoFS && isFS()) { autoFS = false; M.fullscreen(false); } }
  }).observe(de, { attributes: true, attributeFilter: ['data-screen'] });

  // 投屏指南：动画说明为什么有黑边、怎么去掉，各平台怎么投
  UI.cast = function () {
    if (D.querySelector('.m-castl')) return;
    const L = U.h('div', 'm-layer top m-castl');
    const ios = M.ios, iphone = ios && !/iPad/.test(navigator.userAgent) && !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    L.innerHTML = '<div class="m-cbox"><button class="mclose m-x">✕</button><h2>' + U.E('📺') + ' 投屏到电视</h2>' +
      '<div class="m-cdemo"><div class="m-cph"><i></i></div><b class="m-carrow">→</b><div class="m-ctv"><div class="m-ctvin"><i></i></div></div></div>' +
      '<p class="m-cwhy">手机屏幕比电视更「长」，镜像投屏时电视上下会有黑边。打开<b>投屏铺满</b>，再把电视的画面比例调成<b>「全屏 / 缩放」</b>（不要选「拉伸」），黑边就没了，画面也不会变形。</p>' +
      '<div class="m-crow"><button class="m-opt m-ctog"><b></b><small>游戏画面变成电视的 16:9</small></button>' +
      (UI.canFS() ? '<button class="m-opt m-cfs"><b></b><small>隐藏地址栏，锁定横屏</small></button>' : '') + '</div>' +
      '<div class="m-csteps">' + [
        ios ? ['📱', (iphone ? 'iPhone' : 'iPad') + '：从右上角下拉控制中心 →「屏幕镜像」→ 选电视 / Apple TV'] : ['📱', '安卓：下拉通知栏 →「投屏 / 无线显示 / 多屏互动」→ 选电视'],
        ['🔄', '手机<b>横过来</b>立稳，' + (iphone && !UI.standalone() ? '点分享 →「添加到主屏幕」，从桌面打开就是全屏' : '点上面的「全屏」')],
        ['📺', '电视遥控器：设置 →「画面比例 / 显示比例」选「全屏」或「缩放」；投屏软件（如乐播）里选「铺满」'],
        ['💡', '华为 / 荣耀「电脑模式」、三星 DeX：电视单独显示网页，本来就铺满，不用开投屏铺满'],
      ].map(s => '<div class="m-cs">' + U.E(s[0]) + '<span>' + s[1] + '</span></div>').join('') + '</div></div>';
    (D.querySelector('#app .screen') || D.body).appendChild(L); Core.hydrate(L);
    const ft = UI.fit(L.querySelector('.m-cbox'));
    const mark = () => {
      const t = L.querySelector('.m-ctog'); t.classList.toggle('on', !!M.cfg.tvFill); t.querySelector('b').innerHTML = U.E('📺') + (M.cfg.tvFill ? ' 投屏铺满：开' : ' 投屏铺满：关');
      const f = L.querySelector('.m-cfs'); if (f) { f.classList.toggle('on', isFS()); f.querySelector('b').innerHTML = U.E('🖥️') + (isFS() ? ' 已全屏' : ' 全屏'); }
      L.querySelector('.m-cdemo').classList.toggle('fill', !!M.cfg.tvFill); Core.hydrate(L);
    };
    L.querySelector('.m-ctog').onclick = () => { UI.tvToggle(); mark(); ft.refit(); M.Synth.sfx('pop', .4); };
    const f = L.querySelector('.m-cfs'); if (f) f.onclick = () => { if (isFS()) M.fullscreen(false); else { autoFS = true; M.fullscreen(true); } };
    const offs = [M.on('fullscreen', mark), M.on('tv', mark)];
    const close = () => { offs.forEach(o => o()); ft.stop(); L.remove(); };
    L.querySelector('.m-x').onclick = close; L.addEventListener('pointerdown', e => { if (e.target === L) close(); });
    mark();
  };
  // 离开体感区（回主地图等）2 秒后关掉摄像头、麦克风、识别：省电，也不让摄像头灯一直亮着
  let sleepT = 0;
  M.sleep = function () {
    if (inMotion()) return;
    const src = M.Input.src;
    if (!src || src.kind === 'cam' || src.kind === 'file') { M.Input.stopVideo(); M.Input.status = 'off'; M.Input.emit('change'); }
    if (M.Input.stopAudio) { M.Input.stopAudio(); M.Input.audioStatus = 'off'; }
    if (M.Ears.detach) M.Ears.detach();
    M.Tracker.stop(); M.Cursor.enable(false); M.keepAwake(false);
  };
  new MutationObserver(() => { clearTimeout(sleepT); if (!inMotion()) sleepT = setTimeout(M.sleep, 2000); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-screen'] });

  const G = () => { const g = window.__MG; return g && g.el && g.el.isConnected && g.started && !g.over ? g : null; };
  // 切到后台（接电话、回桌面、锁屏）：暂停游戏；回来以后摄像头被系统收回的话重新打开
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { const g = G(); if (g && !g.paused) g.pause(true); return; }
    if (!inMotion()) return;
    const s = M.Input.stream, dead = s && s.getVideoTracks().some(t => t.readyState === 'ended');
    if (dead || (M.Input.src && M.Input.src.kind === 'cam' && !M.Input.live() && M.Input.status !== 'starting')) { M.Input.status = 'off'; M.ensureRunning && M.ensureRunning(); }
  });
  // 手机 / 平板竖过来：游戏暂停（画面会提示横过来），横回来后在暂停菜单里继续
  const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
  const onPortrait = () => { if (portrait.matches) { const g = G(); if (g && !g.paused) g.pause(true); } };
  portrait.addEventListener ? portrait.addEventListener('change', onPortrait) : portrait.addListener(onPortrait);

  // 体感页面里的长按菜单（会弹出「保存图片」等）
  document.addEventListener('contextmenu', e => { if (inMotion() && matchMedia('(pointer: coarse)').matches) e.preventDefault(); });
})();
