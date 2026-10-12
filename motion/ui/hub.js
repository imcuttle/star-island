/* 体感乐园大厅 + 选关面板 + 实时预览小窗 */
(function () {
  const M = window.Motion, U = M.U;
  const UI = M.UI = M.UI || {};

  // 实时预览：镜像画面 + 骨架；o.guide 画站位框；o.fingers 画手指
  UI.preview = function (box, o) {
    o = o || {}; const cv = U.h('canvas', 'm-prev-cv'); box.appendChild(cv);
    const x = cv.getContext('2d');
    const lp = M.loop((dt, t) => {
      if (!cv.isConnected) return lp.stop();
      if (t - (cv._vt || 0) > 400) { cv._vt = t; cv._vis = U.visible(cv); } if (!cv._vis) return;
      const r = box.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1), W = Math.max(10, Math.round(r.width * d)), H = Math.max(10, Math.round(r.height * d));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      x.clearRect(0, 0, W, H);
      const v = M.Input.video, vw = M.Input.vw || 16, vh = M.Input.vh || 9;
      const k = Math.min(W / vw, H / vh), dw = vw * k, dh = vh * k, ox = (W - dw) / 2, oy = (H - dh) / 2;
      if (v && M.Input.live()) {
        x.save(); if (M.cfg.mirror) { x.translate(ox + dw, oy); x.scale(-1, 1); } else x.translate(ox, oy);
        try { x.drawImage(v, 0, 0, dw, dh); } catch (e) {}
        x.restore();
        if (o.dim) { x.fillStyle = 'rgba(8,16,40,' + o.dim + ')'; x.fillRect(ox, oy, dw, dh); }
      } else {
        x.fillStyle = '#1c2850'; x.fillRect(0, 0, W, H); x.fillStyle = '#9fb3e8'; x.font = 14 * d + 'px ' + U.FONT; x.textAlign = 'center';
        x.fillText(M.Input.status === 'starting' ? '正在打开摄像头…' : M.Input.status === 'error' ? M.Input.error.slice(0, 30) : '还没有选择摄像头', W / 2, H / 2);
      }
      if (o.guide) {
        // 站位框：人应该在中间，头顶到脚都在框里
        const gw = dw * .36, gh = dh * .86, gx = ox + (dw - gw) / 2, gy = oy + dh * .07, ok = o.guideOk ? o.guideOk() : false;
        x.save(); x.setLineDash([10 * d, 8 * d]); x.lineWidth = 3 * d; x.strokeStyle = ok ? '#7bd389' : 'rgba(255,255,255,.75)'; x.strokeRect(gx, gy, gw, gh); x.restore();
      }
      M.Tracker.people.forEach((p, i) => p && p.present && M.Tracker.draw(x, p, { x: ox, y: oy, w: dw, h: dh, color: i ? '#ffd166' : '#7ef9ff', lw: o.lw ? o.lw * d : 3.5 * d, glow: 8 * d, fingers: o.fingers }));
      if (o.after) o.after(x, { ox, oy, dw, dh, d, W, H, t });
    });
    return { cv, stop: () => lp.stop() };
  };

  // 状态小标签
  UI.chips = function () {
    const i = M.Input, ph = M.Phone.list();
    const cam = i.live() ? ['ok', '📷', i.label || '摄像头'] : i.status === 'starting' ? ['wait', '📷', '连接中'] : ['bad', '📷', '未连接'];
    const mic = i.audioStatus === 'live' || i.audioStatus === 'phone-level' ? ['ok', '🎤', '麦克风'] : i.audioStatus === 'off' ? ['off', '🎤', '已关闭'] : ['bad', '🎤', '未连接'];
    const asr = M.Ears.pick(); const sp = asr ? ['ok', '🗣️', asr === 'vosk' ? '离线语音' : asr === 'phone' ? '手机语音' : '语音'] : ['off', '🗣️', '无语音识别'];
    const pc = ph.length ? ['ok', '📱', ph.length + ' 台手机'] : null;
    return [cam, mic, sp, pc].filter(Boolean).map(c => '<span class="m-chip ' + c[0] + '">' + U.E(c[1]) + c[2] + '</span>').join('');
  };

  /* ---------- 大厅 ---------- */
  UI.hub = function () {
    M.Cursor.enable(true); M.Cursor.setMode('on');
    return App.show('motion', el => {
      el.classList.add('m-hub');
      const m = M.Store.get();
      const cards = M.games.map(g => '<button class="m-card" data-g="' + g.id + '" style="--gc:' + (g.color || '#5b7cfa') + '">' +
        '<div class="m-card-art"><canvas data-move="' + (g.demo || (g.how && g.how[0] && g.how[0][0]) || 'idle') + '" data-glow="' + (g.color || '#7ef9ff') + '"></canvas><span class="m-card-ic">' + U.E(g.icon) + '</span></div>' +
        '<div class="m-card-txt"><b>' + U.esc(g.name) + '</b><small>' + U.esc(g.short || g.desc) + '</small></div>' +
        '<div class="m-card-meta"><span class="m-tag ' + (g.tag === '复刻' ? 'rep' : 'new') + '">' + (g.tag || '原创') + '</span>' + (g.needs.voice ? '<span class="m-tag v">' + U.E('🎤') + '语音</span>' : '') + (g.needs.people > 1 || g.duo ? '<span class="m-tag d">' + U.E('👫') + '双人</span>' : '') +
        '<span class="m-stars">' + [0, 1, 2].map(i => '<i class="' + (i < (m.stars[g.id] || 0) ? 'on' : '') + '">★</i>').join('') + '</span></div></button>');
      el.innerHTML = '<div class="m-rotate"><i></i><b>把手机横过来玩</b></div><div class="m-bg"><i></i><i></i><i></i></div>' +
        '<div class="m-top"><button class="back" data-say="返回">' + U.E('⬅️') + '</button><div class="m-ttl">' + U.E('🕺') + '<b>体感乐园</b><small>边动边学 · 跳出屏幕的快乐</small></div><div class="m-chips"></div>' +
        '<button class="btn m-setup-b" data-key="o" data-tip="体感设置：选摄像头、连手机、测试动作和语音">' + U.E('⚙️') + ' 体感设置</button>' + (M.web ? '<button class="btn ghost m-cast-b" data-tip="投屏到电视：全屏、横屏、电视没有黑边">' + U.E('📺') + '<span> 投屏</span></button>' : '') + '<button class="btn ghost m-fs" data-key="f" data-tip="全屏">' + U.E('🖥️') + '</button></div>' +
        '<div class="m-main"><div class="m-side"><div class="m-prev"></div><div class="m-prev-tip"></div><div class="m-howto"><div><canvas data-move="cursor"></canvas><span>举起手当光标<br>停在卡片上就会选中</span></div><div><canvas data-move="armsX"></canvas><span>游戏中双手交叉<br>就能暂停</span></div></div></div>' +
        '<div class="m-gridw"><button class="m-hpg prev" data-say="上一页"><i>◀</i><small>上一页</small></button><div class="m-grid"><div class="m-htrack"></div></div><button class="m-hpg next" data-say="下一页"><i>▶</i><small>下一页</small></button><div class="m-hdots"></div></div></div>';
      el.querySelector('.back').onclick = () => { M.Cursor.enable(false); App.hub(); };
      el.querySelector('.m-setup-b').onclick = () => UI.setup();
      el.querySelector('.m-fs').onclick = () => M.fullscreen();
      const cb = el.querySelector('.m-cast-b'); if (cb) cb.onclick = () => UI.cast();
      el.querySelector('.m-grid').onclick = e => { const c = e.target.closest('.m-card'); if (c && !(U.now() - (grid._swiped || 0) < 300)) UI.pick(M.gameById(c.dataset.g)); };
      const chips = el.querySelector('.m-chips'), tip = el.querySelector('.m-prev-tip');
      const upd = () => { chips.innerHTML = UI.chips(); Core.hydrate(chips); };
      upd(); const offs = [M.Input.on('change', upd), M.Input.on('audio', upd), M.Phone.on('change', upd)];
      const pv = UI.preview(el.querySelector('.m-prev'), { dim: .1 });
      // 卡片按屏幕大小排成一页一页（不滚动）：放不下就分页，左右大按钮翻页（体感光标指着停一下就翻），触屏左右滑
      const gw = el.querySelector('.m-gridw'), grid = el.querySelector('.m-grid'), track = el.querySelector('.m-htrack'), dots = el.querySelector('.m-hdots');
      let page = 0, pages = 1, key = '', stopCards = () => {};
      const flip = d => { if (pages < 2) return; page = (page + d + pages) % pages; markPage(); M.Synth.sfx('whoosh', .3); };
      const markPage = () => {
        track.style.transform = 'translateX(' + (-page * 100) + '%)';
        track.querySelectorAll('.m-hpage').forEach((pg, i) => pg.classList.toggle('cur', i === page));
        dots.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => '<i class="' + (i === page ? 'on' : '') + '"></i>').join('') : '';
      };
      const layout = () => {
        if (!grid.isConnected) return;
        const cmp = UI.compact(), gap = cmp ? 10 : 16, minW = cmp ? 148 : 176, minH = cmp ? 140 : 196, n = cards.length;
        const fit = paged => { gw.classList.toggle('paged', paged); const r = grid.getBoundingClientRect(); return { cols: Math.max(1, Math.floor((r.width + gap) / (minW + gap))), rows: Math.max(1, Math.floor((r.height + gap) / (minH + gap))) }; };
        let { cols, rows } = fit(false);
        if (cols * rows < n) ({ cols, rows } = fit(true));
        else { rows = Math.ceil(n / cols); cols = Math.ceil(n / rows); } // 一页放得下：行列尽量均匀
        const per = Math.min(n, cols * rows); pages = Math.ceil(n / per);
        gw.classList.toggle('paged', pages > 1);
        const k = cols + 'x' + rows; if (k === key) return; key = k;
        stopCards();
        track.innerHTML = Array.from({ length: pages }, (_, i) => '<div class="m-hpage" style="gap:' + gap + 'px;grid-template-columns:repeat(' + cols + ',1fr);grid-template-rows:repeat(' + rows + ',1fr)">' + cards.slice(i * per, (i + 1) * per).join('') + '</div>').join('');
        Core.hydrate(track); page = Math.min(page, pages - 1); markPage();
        requestAnimationFrame(() => { stopCards = M.Puppet.mountAll(track); });
      };
      layout();
      const ro = new ResizeObserver(() => { clearTimeout(ro._t); ro._t = setTimeout(layout, 120); }); ro.observe(grid);
      el.querySelector('.m-hpg.prev').onclick = () => flip(-1); el.querySelector('.m-hpg.next').onclick = () => flip(1);
      let sx = null; grid.addEventListener('pointerdown', e => { sx = e.clientX; }); grid.addEventListener('pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 60) { flip(e.clientX < sx ? 1 : -1); grid._swiped = U.now(); } sx = null; });
      const onKey = e => { if (document.querySelector('.m-layer.top')) return; if (e.key === 'ArrowRight' || e.key === 'PageDown') flip(1); if (e.key === 'ArrowLeft' || e.key === 'PageUp') flip(-1); };
      addEventListener('keydown', onKey);
      const stopP = M.Puppet.mountAll(el.querySelector('.m-side'));
      const tl = M.loop(() => { const n = M.Tracker.people.filter(p => p && p.present).length; tip.textContent = !M.Input.live() ? '摄像头未连接' : n ? '看到 ' + n + ' 个人' + (M.Tracker.fps ? ' · ' + Math.round(M.Tracker.fps) + ' 帧/秒' : '') : '站到摄像头前面，让它看见你'; });
      Core.onLeave(() => { offs.forEach(f => f()); pv.stop(); stopP(); stopCards(); tl.stop(); ro.disconnect(); removeEventListener('keydown', onKey); });
      M.ensureRunning();
      Core.Voice.say('体感乐园');
    }, { music: 'happy' }).then(el => { if (M.cfg.firstRun) UI.setup(); return el; });
  };

  /* ---------- 选关面板：学科、模式、人数 ---------- */
  UI.pick = function (g) {
    if (!g) return;
    const last = (M.cfg.last && M.cfg.last[g.id]) || {};
    const st = { zone: last.zone || 'math', mode: last.mode || (g.modes ? g.modes[0].id : ''), players: last.players || 1 };
    const L = U.h('div', 'm-layer top m-pick');
    const subj = [{ id: 'mix', name: '混合挑战', icon: '🌈' }].concat(M.Q.subjects());
    L.innerHTML = '<div class="m-pbox2" style="--gc:' + (g.color || '#5b7cfa') + '"><button class="mclose m-x">✕</button>' +
      '<div class="m-phead"><div class="m-pdemo"><canvas data-move="' + (g.demo || 'idle') + '"></canvas></div><div><h2>' + U.E(g.icon) + ' ' + U.esc(g.name) + '</h2><p>' + U.esc(g.desc) + '</p>' + (g.origin ? '<p class="m-origin">' + U.esc(g.origin) + '</p>' : '') + '</div></div>' +
      (g.modes && g.modes.length > 1 ? '<div class="m-prow"><label>玩法</label><div class="m-opts" data-k="mode">' + g.modes.map(m => '<button class="m-opt" data-v="' + m.id + '">' + (m.icon ? U.E(m.icon) : '') + '<b>' + U.esc(m.name) + '</b>' + (m.desc ? '<small>' + U.esc(m.desc) + '</small>' : '') + '</button>').join('') + '</div></div>' : '') +
      (g.noQuiz ? '' : '<div class="m-prow"><label>学科</label><div class="m-opts subj" data-k="zone">' + subj.map(z => '<button class="m-opt" data-v="' + z.id + '" style="--zc:' + (z.color || '#a78bfa') + '">' + U.E(z.icon) + '<b>' + z.name.replace(/(森林|城堡|港湾|星台|小镇|剧院|航线|文化馆|实验室|体验城)$/, '') + '</b></button>').join('') + '</div></div>') +
      (g.duo ? '<div class="m-prow"><label>人数</label><div class="m-opts" data-k="players"><button class="m-opt" data-v="1">' + U.E('🙋') + '<b>单人</b><small>和电脑比</small></button><button class="m-opt" data-v="2">' + U.E('👫') + '<b>双人对战</b><small>一左一右站</small></button></div></div>' : '') +
      '<div class="m-pgo"><button class="btn big go">' + U.E('▶️') + ' 开始</button></div></div>';
    document.querySelector('#app .screen').appendChild(L); Core.hydrate(L);
    const box = L.querySelector('.m-pbox2'), ft = UI.fit(box), sc = UI.scroller(box);
    const mark = () => L.querySelectorAll('.m-opts').forEach(o => o.querySelectorAll('.m-opt').forEach(b => b.classList.toggle('on', String(st[o.dataset.k]) === b.dataset.v)));
    L.querySelectorAll('.m-opts').forEach(o => o.onclick = e => {
      const b = e.target.closest('.m-opt'); if (!b) return; st[o.dataset.k] = o.dataset.k === 'players' ? +b.dataset.v : b.dataset.v; mark(); M.Synth.sfx('pop', .5);
      if (o.dataset.k === 'mode' && g.modes) { const md = g.modes.find(x => x.id === st.mode); if (md && md.players) st.players = md.players; mark(); }
    });
    mark();
    const stopP = M.Puppet.mountAll(L);
    const close = () => { stopP(); ft.stop(); sc.stop(); L.remove(); };
    L.querySelector('.m-x').onclick = close;
    L.addEventListener('pointerdown', e => { if (e.target === L) close(); });
    L.querySelector('.go').onclick = () => { M.cfg.last = Object.assign({}, M.cfg.last, { [g.id]: st }); M.save(); close(); UI.immerse(); M.play(g.id, st); };
    Core.Voice.say(g.name);
  };
})();
