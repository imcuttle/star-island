/* 体感游戏运行时：题库接入、一局游戏的生命周期（介绍 → 倒计时 → 进行 → 暂停 / 离开画面 → 结算奖励）、HUD、画中画、3D / 2D 画布
   每个游戏：M.game({ id, name, icon, tag, desc, how:[[动作, 说明]], needs:{ people, hands, voice }, modes:[{id,name,desc}], qOpts, start(G) })
   start(G) 里用：
     G.canvas() / G.three()       画布（自动铺满、自动随窗口缩放、离开时释放）
     G.loop(fn(dt, t))           每帧（暂停时不调用）；G.t 是不含暂停的游戏时间（秒）
     G.on('jump' | 'squat' | 'swipe' | 'punch' | 'clap' | 'step' | 'handsUp' | 'pinch' | 'mic:clap' | 'mic:shout', fn)
     G.player(i)                 第 i 个玩家（person，含 body）；G.q() 下一道题；G.ask(q) 在顶部显示题卡
     G.hud.score / combo / timer / hearts / pop(文字)；G.say(文字)；G.sfx(名字)；G.song({bpm, style})
     G.listen({choices})         语音答题（有识别时）；G.end({score, correct, total, stars}) 结束并结算 */
(function () {
  const M = window.Motion, U = M.U;

  /* ================= 题库 ================= */
  const Q = M.Q = {
    _gens: {},
    subjects() { return (window.CATALOG ? CATALOG.ZONES : []).map(z => ({ id: z.id, name: z.name, icon: z.icon, color: z.color })); },
    grade() { const p = window.Core && Core.Store.p; return p ? p.grade : 1; },
    // 这个区域里能出「单选题」的生成器（运行时探测，题库更新后自动适配）
    gens(zone, grade) {
      const k = zone + '|' + grade; if (this._gens[k]) return this._gens[k];
      const seen = new Set(), out = [];
      (CATALOG.GAMES || []).forEach(g => {
        if ((zone !== 'mix' && g.zone !== zone) || seen.has(g.gen) || grade < g.g0 || grade > g.g1) return; seen.add(g.gen);
        try { const d = CONTENT.G[g.gen](grade); if (Array.isArray(d) && d.length && d.every(q => q && Array.isArray(q.ch) && q.ch.length >= 2 && q.ch.filter(c => c.ok).length === 1)) out.push(g.gen); } catch (e) {}
      });
      return (this._gens[k] = out);
    },
    _pool: {},
    // o：{ zone, grade, maxLen 选项最多几个字, maxCh 最多几个选项, text 选项必须有文字, minCh }
    next(o) {
      o = o || {}; const zone = o.zone || 'math', grade = o.grade == null ? this.grade() : o.grade;
      const key = [zone, grade, o.maxLen || 0, o.maxCh || 0, o.text ? 1 : 0, o.emojiOk === false ? 0 : 1].join('|');
      const pool = this._pool[key] || (this._pool[key] = []);
      for (let tries = 0; !pool.length && tries < 12; tries++) {
        let gens = this.gens(zone, grade); if (!gens.length) gens = this.gens('math', grade);
        const gen = U.pick(gens);
        let d = []; try { d = CONTENT.G[gen](grade) || []; } catch (e) {}
        d.forEach(q => { const n = this.norm(q, o, gen); if (n) pool.push(n); });
        U.shuffle(pool).forEach((x, i) => pool[i] = x);
      }
      return pool.shift() || { p: '1 + 1 = ?', say: '', ch: [{ t: '2', ok: true }, { t: '3', ok: false }], ans: 0, gen: 'fallback' };
    },
    norm(q, o, gen) {
      const strip = s => String(s || '').replace(/<[^>]+>/g, '').trim();
      let ch = q.ch.filter(c => !(c.e && c.e.startsWith('html:') && !c.t)).map(c => ({ t: strip(c.t), e: c.e && !c.e.startsWith('html:') ? c.e : '', s: c.s, l: c.l || 'zh', ok: !!c.ok, sub: c.sub }));
      if (!ch.some(c => c.ok) || ch.length < (o.minCh || 2)) return null;
      if (o.text && ch.some(c => !c.t)) return null;
      if (o.emojiOk === false && ch.some(c => !c.t)) return null;
      if (o.maxLen && ch.some(c => c.t.length > o.maxLen)) return null;
      if (o.maxCh && ch.length > o.maxCh) { const right = ch.find(c => c.ok); ch = U.shuffle([right].concat(U.shuffle(ch.filter(c => !c.ok)).slice(0, o.maxCh - 1))); }
      const pe = q.pe || '';
      return { p: strip(q.p), say: q.ps || strip(q.p), pe, peHtml: pe ? Core.vis(pe, 'q-pe') : '', peEmoji: pe && !pe.startsWith('html:') ? pe : '', ch, ans: ch.findIndex(c => c.ok), gen, small: q.small, lang: ch.every(c => /^[\x00-\x7f]*$/.test(c.t)) && ch.some(c => /[a-z]/i.test(c.t)) ? 'en' : 'zh' };
    },
    label(c) { return c.t || c.e || ''; },
  };

  /* ================= 注册表 ================= */
  M.games = [];
  M.game = def => { def.needs = Object.assign({ people: 1, hands: false, voice: false }, def.needs || {}); M.games.push(def); return def; };
  M.gameById = id => M.games.find(g => g.id === id);

  /* ================= 一局游戏 ================= */
  function Session(def, opts, el) {
    this.def = def; this.opts = opts; this.el = el; this.mode = opts.mode || (def.modes && def.modes[0] && def.modes[0].id) || 'std';
    this.zone = opts.zone || 'math'; this.grade = Q.grade(); this.t = 0; this.paused = false; this.started = false; this.over = false;
    this._loops = []; this._offs = []; this._songs = []; this._disp = []; this._timers = []; this.stats = { correct: 0, total: 0 };
    this.players = Math.max(1, opts.players || def.needs.people || 1);
    el.classList.add('mg', 'mg-' + def.id);
    el.innerHTML = '<div class="m-rotate"><i></i><b>把手机横过来玩</b></div><div class="mg-stage"></div><div class="mg-hud">' +
      '<div class="mg-tl"><button class="back mg-pause" data-tip="暂停（双手在胸前交叉也能暂停）">' + U.E('⏸️') + '</button><div class="mg-title">' + U.E(def.icon) + '<b>' + U.esc(def.name) + '</b></div></div>' +
      '<div class="mg-qwrap"></div>' +
      '<div class="mg-tr"><div class="mg-score"><small>得分</small><b>0</b></div><div class="mg-combo"><b>0</b><small>连击</small></div><div class="mg-timer"></div><div class="mg-hearts"></div></div>' +
      '<div class="mg-pops"></div><div class="mg-pipw"><canvas class="mg-pip"></canvas><button class="mg-pipb" data-key="v" data-tip="实时小人：线框 / 摄像头 / 关闭（V 键）"></button></div><div class="mg-xhint">' + U.E('🙅') + ' 双手交叉暂停</div><div class="m-vpad"></div><div class="m-vhint"></div></div>';
    this.stage = el.querySelector('.mg-stage'); this.hudEl = el.querySelector('.mg-hud');
    el.querySelector('.mg-pause').onclick = () => this.started && !this.over ? this.pause(true) : this.quit();
    const self = this, $ = s => el.querySelector(s);
    let score = 0, combo = 0;
    this.hud = {
      get scoreV() { return score; },
      score(n, add) { score = Math.max(0, add ? score + n : n); const b = $('.mg-score b'); b.textContent = Math.round(score); b.parentNode.classList.remove('bump'); void b.offsetWidth; b.parentNode.classList.add('bump'); return score; },
      add(n) { return this.score(n, true); },
      combo(n) { combo = n; const c = $('.mg-combo'); c.querySelector('b').textContent = n; c.classList.toggle('on', n >= 2); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); if (n && n % 10 === 0) { M.Synth.sfx('combo'); self.pop(n + ' 连击！', 'combo'); } return n; },
      get comboV() { return combo; },
      timer(sec) { const t = $('.mg-timer'); if (sec == null) { t.style.display = 'none'; return; } t.style.display = ''; const s = Math.max(0, Math.ceil(sec)); t.innerHTML = U.E('⏱️') + '<b>' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '</b>'; t.classList.toggle('low', s <= 10); },
      hearts(n, max) { const h = $('.mg-hearts'); if (n == null) { h.innerHTML = ''; return; } h.innerHTML = Array.from({ length: max }, (_, i) => '<i class="' + (i < n ? 'on' : '') + '">' + U.E(i < n ? '❤️' : '🤍') + '</i>').join(''); },
      hide(part, on) { const e = $('.mg-' + part); if (e) e.style.display = on === false ? '' : 'none'; },
    };
    this.hud.timer(null);
    if (!def.score) { /* 默认显示分数 */ }
    Core.onLeave(() => this.dispose());
    // 画中画：右下角小窗显示摄像头和骨架（可在设置里关）
    this.pipCv = el.querySelector('.mg-pip'); this.pipW = el.querySelector('.mg-pipw');
    if (def.pip === false) this.pipW.style.display = 'none';
    const pipB = el.querySelector('.mg-pipb'), PIPS = ['figure', 'camera', 'off'], PIPN = { figure: '🧍', camera: '📷', off: '🙈' };
    const markPip = () => { this.pipW.dataset.m = M.cfg.pip; pipB.innerHTML = U.E(PIPN[M.cfg.pip] || '🧍'); };
    pipB.onclick = () => { M.cfg.pip = PIPS[(PIPS.indexOf(M.cfg.pip) + 1) % 3]; M.save(); markPip(); M.Synth.sfx('pop', .4); };
    markPip();
    // 动作事件让小人面板闪一下（跳、蹲、出拳、挥手都有反馈）
    this._offs.push(M.Body.on('any', e => { if (!/^(jump|squat|punch|swipe|clap)$/.test(e.type)) return; this._pipFx = { t: U.now(), type: e.type, slot: e.slot, hand: e.hand }; }));
    this._pip = M.loop((dt, t) => this.drawPip(t));
    this.buildPad();
    // 双手交叉 1.2 秒 = 暂停
    let xT = 0;
    this._xLoop = M.loop(dt => {
      const p = M.Tracker.main(); const x = p && p.body && p.body.pose && p.body.pose.armsX && this.started && !this.paused && !this.over && !def.noXPause;
      xT = x ? xT + dt : 0; el.querySelector('.mg-xhint').classList.toggle('in', xT > .3);
      if (xT > 1.2) { xT = 0; this.pause(true); }
    });
  }
  const SP = Session.prototype;
  /* ---------- 键鼠 / 触屏兜底：屏幕按钮条和按键提示 ---------- */
  // 按游戏的动作演示（how）推出需要哪些按钮；游戏也可以用 def.pad 自己指定
  const PAD = { jump: ['jump', '⬆️', '跳'], squat: ['squat', '⬇️', '蹲'], lanes: ['left right', '', ''], stepL: ['left right', '', ''], stepR: ['left right', '', ''], punch: ['punch', '👊', '出拳'], punchR: ['punch', '👊', '出拳'], punchL: ['punch', '👊', '出拳'],
    push: ['push', '🌊', '推'], clap: ['clap', '👏', '拍手'], run: ['run', '🏃', '跑'], handsUp: ['upBoth', '🙌', '举手'], raiseL: ['upL', '🫲', '左手'], raiseR: ['upR', '🫱', '右手'], tpose: ['tpose', '✈️', '平举'], head: ['head', '🙆', '摸头'], hips: ['hips', '🧍', '叉腰'], oneLeg: ['oneLeg', '🦩', '单脚'], shout: ['shout', '📣', '大喊'] };
  const PADX = { left: ['left', '⬅️', '左'], right: ['right', '➡️', '右'], upL: PAD.raiseL, upR: PAD.raiseR, upBoth: PAD.handsUp, legs: ['legs', '🦵', '张腿'], mirror: ['mirror', '🪞', '对称'] };
  SP.buildPad = function () {
    const def = this.def, pad = this.el.querySelector('.m-vpad'), hint = this.el.querySelector('.m-vhint');
    let acts = def.pad;
    if (!acts) { const s = new Set(); (def.how || []).forEach(h => { const p = PAD[h[0]]; if (p) p[0].split(' ').forEach(a => s.add(a)); }); acts = [...s]; }
    const info = a => PADX[a] || Object.values(PAD).find(p => p[0] === a) || [a, '❔', a];
    const left = acts.filter(a => a === 'left'), right = acts.filter(a => a === 'right'), mid = acts.filter(a => a !== 'left' && a !== 'right');
    const btn = a => { const i = info(a); return '<button class="m-vb" data-a="' + a + '">' + U.E(i[1]) + '<small>' + i[2] + '</small></button>'; };
    pad.innerHTML = '<div class="m-vgrp">' + left.map(btn).join('') + '</div><div class="m-vgrp">' + mid.map(btn).join('') + '</div><div class="m-vgrp">' + right.map(btn).join('') + '</div>';
    pad.addEventListener('pointerdown', e => { const b = e.target.closest('.m-vb'); if (!b) return; e.preventDefault(); b.classList.add('on'); if (b.dataset.a === 'squat') M.Virtual.keys.add('squat'); M.Virtual.act(b.dataset.a, 'touch'); });
    const up = e => { pad.querySelectorAll('.m-vb.on').forEach(b => { b.classList.remove('on'); if (b.dataset.a === 'squat') M.Virtual.keys.delete('squat'); }); };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); pad.addEventListener('pointerleave', up);
    // 键鼠提示：第一次用键盘 / 鼠标时出现几秒
    const KEYN = { left: '←', right: '→', jump: '↑', squat: '↓', punch: '空格 / 点击', push: 'F', clap: 'C', run: 'R', upL: '1', upR: '2', upBoth: '3', head: '4', hips: '5', tpose: '6', oneLeg: '7', legs: '8' };
    hint.innerHTML = U.E('⌨️') + ' <b>鼠标 = 手</b>（快速划动 = 挥手）' + acts.filter(a => KEYN[a]).map(a => ' · ' + KEYN[a] + ' ' + info(a)[2]).join('') + (def.vmode === 'mirror' ? ' · M 切换对称' : '');
    let shown = 0;
    const lp = M.loop(() => {
      const V = M.Virtual, on = V.active, touch = on && V.touch;
      const showPad = touch || (M.mobile && !M.Virtual.camOk()); pad.classList.toggle('in', showPad); this.hudEl.classList.toggle('vpad', showPad);
      if (on && !touch && !shown) { shown = U.now(); hint.classList.add('in'); }
      if (shown && U.now() - shown > 7000) hint.classList.remove('in');
    });
    this._disp.push(() => lp.stop());
  };
  SP.W = function () { return this.stage.clientWidth || innerWidth; };
  SP.H = function () { return this.stage.clientHeight || innerHeight; };
  SP.player = function (i) { return M.Tracker.person(i || 0) || (i ? null : M.Tracker.main()); };
  SP.people = function () { return M.Tracker.people.filter(p => p && p.present); };
  SP.q = function (o) { return Q.next(Object.assign({ zone: this.zone, grade: this.grade }, this.def.qOpts || {}, o || {})); };
  SP.say = function (t, lang) { return t ? Core.Voice.say(t, lang) : Promise.resolve(); };
  // 合成音效优先；文件音效（assets/sfx）用 G.fileSfx
  SP.sfx = function (n, v) { M.Synth.sfx(n, v); };
  SP.fileSfx = function (n, v) { Core.Audio2.sfx(n, v); };
  SP.on = function (type, fn) {
    const wrap = e => { if (!this.started || this.paused || this.over) return; fn(e); };
    const off = type.startsWith('mic:') ? M.Ears.on(type.slice(4), wrap) : M.Body.on(type, wrap);
    this._offs.push(off); return off;
  };
  SP.loop = function (fn) { const l = { fn }; this._loops.push(l); if (!this._main) this._main = M.loop((dt, t) => { if (!this.started || this.paused || this.over) return; this.t += dt; this._loops.forEach(x => x.fn(dt, t)); }); return () => { const i = this._loops.indexOf(l); if (i >= 0) this._loops.splice(i, 1); }; };
  SP.after = function (sec, fn) { const t0 = this.t + sec, off = this.loop(() => { if (this.t >= t0) { off(); fn(); } }); return off; };
  SP.onDispose = function (f) { this._disp.push(f); };
  SP.song = function (o) { const s = M.Synth.song(o); this._songs.push(s); return s; };
  SP.listen = function (o) { if (!M.Ears.available()) return null; const h = M.Ears.listen(o); this._disp.push(() => h.stop()); return h; };

  // 2D 画布：返回 { cv, ctx, W, H, dpr }，尺寸跟随舞台
  SP.canvas = function (o) {
    o = o || {}; const cv = U.h('canvas', 'mg-cv ' + (o.cls || '')); this.stage.appendChild(cv);
    const ctx = cv.getContext('2d'); const r = { cv, ctx, W: 0, H: 0, dpr: 1 };
    const fit = () => { const dpr = Math.min(devicePixelRatio || 1, o.dpr || 2); r.W = this.W(); r.H = this.H(); r.dpr = dpr; cv.width = Math.round(r.W * dpr); cv.height = Math.round(r.H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (o.onResize) o.onResize(r); };
    fit(); addEventListener('resize', fit); this._disp.push(() => removeEventListener('resize', fit));
    return r;
  };
  // 3D：返回 { THREE, renderer, scene, camera, render() }
  SP.three = function (o) {
    o = o || {}; const T = window.THREE;
    const rd = Core.Perf && Core.Perf.renderer ? Core.Perf.renderer({ antialias: true, alpha: !!o.alpha, powerPreference: 'high-performance' }, { dpr: o.dpr || 1.75, shadows: !!o.shadows }) : new T.WebGLRenderer({ antialias: true });
    rd.outputColorSpace = T.SRGBColorSpace; if (o.tone !== false) { rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = o.exposure || 1; }
    rd.domElement.className = 'mg-cv mg-3d'; this.stage.appendChild(rd.domElement);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(o.fov || 60, 1, o.near || .1, o.far || 400);
    const fit = () => { const w = this.W(), h = this.H(); rd.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (o.onResize) o.onResize(w, h); };
    fit(); addEventListener('resize', fit);
    this._disp.push(() => { removeEventListener('resize', fit); scene.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) [].concat(x.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); try { rd.dispose(); rd.forceContextLoss(); } catch (e) {} rd.domElement.remove(); });
    // 卡通角色描边：按画布像素设置描边宽度（不设会糊成很粗的黑边）
    const render = () => { if (window.Avatar3D && Avatar3D.outlineU) { const c = rd.domElement; Avatar3D.setViewport(c.width, c.height); Avatar3D.outlineU.uOl.value = 2.2 / Math.max(1, c.height) * Math.min(devicePixelRatio || 1, 1.75); } rd.render(scene, camera); };
    return { THREE: T, renderer: rd, scene, camera, render, fit };
  };

  /* ---------- 题卡（顶部，DOM，支持钟面 / 点图等题图） ---------- */
  SP.ask = function (q, o) {
    o = o || {}; const w = this.el.querySelector('.mg-qwrap');
    if (!q) { w.classList.remove('in'); return; }
    w.innerHTML = '<div class="mg-q' + (o.cls ? ' ' + o.cls : '') + '">' + (q.peHtml ? '<div class="mg-qpe">' + q.peHtml + '</div>' : '') + '<div class="mg-qt">' + U.esc(q.p) + '</div>' +
      (o.options ? '<div class="mg-qopts">' + q.ch.map((c, i) => '<span class="mg-qo" style="--oc:' + (o.colors ? o.colors[i] : '') + '">' + (o.keys ? '<i>' + o.keys[i] + '</i>' : '') + (c.e ? U.E(c.e) : '') + (c.t ? '<b>' + U.esc(c.t) + '</b>' : '') + '</span>').join('') + '</div>' : '') +
      (o.mic ? '<div class="mg-qmic">' + U.E('🎤') + '<span>说出答案</span><i class="mg-heard"></i></div>' : '') + '</div>';
    Core.hydrate(w); requestAnimationFrame(() => w.classList.add('in'));
    if (o.say !== false) this.say(q.say);
    this.stats.total++;
    return w.firstChild;
  };
  SP.heard = function (text) { const e = this.el.querySelector('.mg-heard'); if (e) e.textContent = text ? '「' + text + '」' : ''; };
  SP.right = function (x, y) { this.stats.correct++; Core.Audio2.sfx('right', .6); if (x != null) Core.UI.burst(x, y, '⭐', 10); };
  SP.wrong = function () { Core.Audio2.sfx('wrong', .5); M.Store.wrong(this); };

  // 屏幕中间的飘字：完美 / 跳！/ +100
  SP.pop = function (text, cls, x, y) {
    // 样式类加 pp- 前缀：主游戏的全局 .good / .bad / .combo 会给飘字加上底色方框
    const p = U.h('div', 'mg-pop ' + String(cls || '').split(/\s+/).filter(Boolean).map(c => 'pp-' + c).join(' '), text); const box = this.el.querySelector('.mg-pops');
    if (x != null) { p.style.left = x + 'px'; p.style.top = y + 'px'; p.classList.add('pp-at'); }
    box.appendChild(p); setTimeout(() => p.remove(), 1100);
  };
  // 大提示（动作图标 + 文字），例：酷跑里的「出拳 PUNCH」
  SP.cue = function (icon, text, ms) {
    let c = this.el.querySelector('.mg-cue'); if (!c) { c = U.h('div', 'mg-cue'); this.hudEl.appendChild(c); }
    c.innerHTML = '<div class="mg-cue-ic">' + icon + '</div><b>' + text + '</b>'; c.classList.remove('in'); void c.offsetWidth; c.classList.add('in');
    clearTimeout(this._cueT); this._cueT = setTimeout(() => c.classList.remove('in'), ms || 1200);
  };

  /* ---------- 画中画 ---------- */
  SP.drawPip = function (t) {
    const cv = this.pipCv, mode = M.cfg.pip; if (mode === 'off' || this.pipW.style.display === 'none') return;
    const v = M.Input.video, ps = this.people(), d = Math.min(2, devicePixelRatio || 1);
    const w = mode === 'camera' ? 220 : 170, h = mode === 'camera' ? (v && M.Input.vw ? Math.round(w * M.Input.vh / M.Input.vw) : 124) : 210;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    const x = cv.getContext('2d'), W = cv.width, H = cv.height; x.clearRect(0, 0, W, H);
    this.pipW.classList.toggle('lost', !ps.length);
    if (mode === 'camera') {
      if (t - (this._pipT || 0) < 50) return; this._pipT = t;
      if (v && M.Input.live()) { x.save(); if (M.cfg.mirror) { x.translate(W, 0); x.scale(-1, 1); } try { x.drawImage(v, 0, 0, W, H); } catch (e) {} x.restore(); x.fillStyle = 'rgba(10,20,40,.35)'; x.fillRect(0, 0, W, H); }
      ps.forEach((p, i) => M.Tracker.draw(x, p, { w: W, h: H, color: i ? '#ffd166' : '#7ef9ff', lw: 2.5 * d }));
      return;
    }
    // 线框小人（舞力全开式）：以髋部为中心、躯干长度为尺子归一化，人走远走近小人大小不变；脚下有光圈
    const fx = this._pipFx && t - this._pipFx.t < 350 ? this._pipFx : null, k = fx ? 1 - (t - fx.t) / 350 : 0;
    const n = Math.max(1, ps.length);
    x.save(); x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.ellipse(W / 2, H * .93, W * .36, H * .035, 0, 0, 7); x.fill(); x.restore();
    if (!ps.length) { x.fillStyle = 'rgba(255,255,255,.5)'; x.font = 13 * d + 'px ' + U.FONT; x.textAlign = 'center'; x.fillText('回到画面里', W / 2, H / 2); return; }
    ps.forEach((p, i) => {
      const b = p.body; if (!b || !b.ready || !p.lm) return;
      const A = b.A || 16 / 9, cx = b.hip.x / A, cy = b.hip.y, T = b.T || .2;
      const sc = H * .27 / T, ox = W * (n > 1 ? (i ? .72 : .28) : .5), oy = H * .53;
      const P = p.lm.map(q => ({ x: ox + (q.x - cx) * A * sc / (n > 1 ? 1.6 : 1), y: oy + (q.y - cy) * sc / (n > 1 ? 1.6 : 1), v: q.v }));
      const col = i ? '#ffd166' : '#7ef9ff', ok = q => q.v > .35;
      x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
      if (fx && fx.slot === p.slot) { x.shadowColor = '#fff'; x.shadowBlur = 30 * k * d; }
      // 外发光 + 白色芯，粗线条更像「小人」
      [[col, 9 * d, .35], ['#fff', 4.2 * d, 1]].forEach(([c, lw, al]) => {
        x.globalAlpha = al; x.strokeStyle = c; x.lineWidth = lw * (n > 1 ? .8 : 1);
        x.beginPath(); M.BONES.forEach(([a, bb]) => { const p1 = P[a], p2 = P[bb]; if (!ok(p1) || !ok(p2) || a >= 15 && a <= 22 && bb >= 17) return; x.moveTo(p1.x, p1.y); x.lineTo(p2.x, p2.y); }); x.stroke();
        const nk = { x: (P[11].x + P[12].x) / 2, y: (P[11].y + P[12].y) / 2 }, r = Math.hypot(P[11].x - P[12].x, P[11].y - P[12].y) * .36 + 3 * d;
        x.beginPath(); x.moveTo(nk.x, nk.y); x.lineTo(P[0].x, P[0].y + r * .9); x.stroke();
        x.beginPath(); x.arc(P[0].x, P[0].y, r, 0, 7); x.stroke();
      });
      x.globalAlpha = 1; x.shadowBlur = 0;
      // 手：左红右蓝；出拳 / 挥手时放大
      [[15, 'L', '#ff5d73'], [16, 'R', '#4cc9ff']].forEach(([j, sd, c]) => { const q = P[j]; if (!ok(q)) return; const big = fx && fx.slot === p.slot && fx.hand === sd ? 1 + k : 1; x.fillStyle = c; x.beginPath(); x.arc(q.x, q.y, 5.5 * d * big, 0, 7); x.fill(); });
      x.restore();
      if (fx && fx.slot === p.slot) { const lab = { jump: '跳!', squat: '蹲!', punch: '拳!', swipe: '挥!', clap: '啪!' }[fx.type]; x.save(); x.globalAlpha = k; x.fillStyle = '#ffd166'; x.font = '900 ' + 18 * d + 'px ' + U.FONT; x.textAlign = 'center'; x.fillText(lab, ox, 20 * d + (1 - k) * -8 * d); x.restore(); }
    });
  };

  /* ---------- 生命周期 ---------- */
  SP.prepare = async function () {
    const n = this.def.needs, L = Core.Preload && Preload.Loader ? Preload.Loader.hold('正在准备动作识别…') : null;
    try {
      if (M.ensureRunning) await M.ensureRunning();
      if (!M.Input.live()) await M.Input.start();
      await M.Tracker.configure({ people: this.players, hands: !!n.hands }); M.Tracker.start();
      if (n.voice || n.mic) { if (!M.Input.audioStream && M.cfg.audio.kind !== 'none') { await M.Input.startAudio(); M.Ears.attach(M.Input.audioStream); } if (n.voice) await M.Ears.prepare(this.def.lang || 'zh'); }
      if (this.def.preload) await this.def.preload(this);
    } finally { if (L) L.done(); }
  };
  // 开始前的介绍卡：动作演示 + 举起双手开始
  SP.intro = function () {
    const d = this.def, el = U.h('div', 'm-layer top mg-intro');
    const subj = Q.subjects().find(z => z.id === this.zone);
    el.innerHTML = '<div class="mg-ibox"><div class="mg-ihead">' + U.E(d.icon, 'mg-iic') + '<div><h2>' + U.esc(d.name) + '</h2><p>' + U.esc(d.desc) + '</p></div></div>' +
      '<div class="mg-how">' + (d.how || []).map(hw => '<div class="mg-howi"><canvas data-move="' + hw[0] + '"></canvas><b>' + U.esc(hw[1]) + '</b></div>').join('') + '</div>' +
      '<div class="mg-imeta">' + (subj && !d.noQuiz ? '<span>' + U.E(subj.icon) + ' ' + subj.name + '</span>' : '') + (d.modes ? '<span>' + U.E('🎮') + ' ' + U.esc((d.modes.find(m => m.id === this.mode) || {}).name || '') + '</span>' : '') + (this.players > 1 ? '<span>' + U.E('👫') + ' 双人</span>' : '') + '</div>' +
      '<div class="mg-istart"><div class="mg-hup"><div class="mg-hupfig"><canvas data-move="handsUp"></canvas></div><div><b>举起双手开始</b><div class="mg-hupbar"><i></i></div></div></div><button class="btn big go">开始</button></div>' +
      '<div class="mg-iwarn"></div></div>';
    this.el.appendChild(el); Core.hydrate(el);
    const stopP = M.Puppet ? M.Puppet.mountAll(el) : () => {};
    this.say(d.name).then(() => { if (d.sayHow && el.isConnected) this.say(d.sayHow); });
    M.Cursor.setMode('on');
    return new Promise(res => {
      let hold = 0, done = false;
      const go = () => { if (done) return; done = true; lp.stop(); stopP(); el.classList.add('out'); setTimeout(() => el.remove(), 300); M.Synth.sfx('go'); res(); };
      el.querySelector('.go').onclick = go;
      const warn = el.querySelector('.mg-iwarn');
      const lp = M.loop(dt => {
        const ps = this.people();
        const up = ps.some(p => p.body && p.body.hands.L.up && p.body.hands.R.up);
        hold = up ? hold + dt : Math.max(0, hold - dt * 2);
        el.querySelector('.mg-hupbar i').style.width = Math.min(100, hold / .9 * 100) + '%';
        if (hold > .9) go();
        warn.innerHTML = !M.Input.live() ? U.E('📷') + ' 摄像头没有画面，<button class="btn sm m-open-setup">去设置</button>　也可以直接用' + (matchMedia('(pointer: coarse)').matches ? '触屏' : '键盘鼠标') + '玩，点「开始」' : !ps.length ? U.E('🙋') + ' 没看到人，请站到摄像头前面（离 2 米左右，露出上半身）' : (this.players > 1 && ps.length < 2 ? U.E('👫') + ' 还差一位小伙伴，两个人一左一右站好' : '');
        const b = warn.querySelector('.m-open-setup'); if (b) b.onclick = () => M.UI && M.UI.setup();
      });
      this.el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  };
  SP.countdown = async function () {
    const c = U.h('div', 'mg-count'); this.el.appendChild(c);
    for (const n of ['3', '2', '1']) { c.innerHTML = '<b>' + n + '</b>'; c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick'); M.Synth.sfx('count'); await U.sleep(700); }
    c.innerHTML = '<b class="go">GO!</b>'; c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick'); M.Synth.sfx('go');
    setTimeout(() => c.remove(), 600);
  };
  SP.run = async function () {
    M._awake = true; M.keepAwake(true);
    await this.prepare();
    if (!this.el.isConnected) return;
    await this.intro(); if (!this.el.isConnected) return;
    M.Cursor.setMode('off');
    if (this.def.beforeCountdown) await this.def.beforeCountdown(this);
    await this.countdown(); if (!this.el.isConnected) return;
    this.started = true; this.t = 0;
    // 人离开画面：自动暂停，回来后自动继续
    let lostT = 0, backT = 0;
    this._watch = M.loop(dt => {
      if (!this.started || this.over) return;
      const need = this.def.noQuiz && this.def.needs.people === 0 ? 0 : 1, here = this.people().length >= need;
      if (!this.paused) { lostT = here ? 0 : lostT + dt; if (lostT > 1.6) this.pause(false); }
      else if (this._autoPaused) { backT = here ? backT + dt : 0; const e = this.el.querySelector('.mg-lost b'); if (e) e.textContent = here ? '准备好了，马上继续…' : '回到画面里就继续'; if (backT > 1.2) { backT = 0; this.resume(); } }
    });
    try { await this.def.start(this); } catch (e) { console.error(e); }
  };
  SP.pause = function (menu) {
    if (this.paused || this.over || !this.started) return;
    this.paused = true; this._autoPaused = !menu;
    this._songs.forEach(s => s.playing && s.pause());
    if (this.def.onPause) this.def.onPause(this, true);
    const el = U.h('div', 'm-layer top mg-pausel' + (menu ? '' : ' mg-lost'));
    el.innerHTML = menu ? '<div class="mg-pbox"><h2>' + U.E('⏸️') + ' 暂停中</h2><div class="mg-pbtns"><button class="btn big go m-resume">' + U.E('▶️') + ' 继续</button><button class="btn m-restart">' + U.E('🔁') + ' 重新开始</button><button class="btn ghost m-quit">' + U.E('🚪') + ' 退出</button></div><p>举起手用光标点按钮，也可以说「继续」</p></div>'
      : '<div class="mg-pbox"><div class="mg-lostfig"><canvas data-move="wave"></canvas></div><h2>咦，你去哪儿啦？</h2><b>回到画面里就继续</b><div class="mg-pbtns"><button class="btn ghost m-quit">' + U.E('🚪') + ' 退出</button></div></div>';
    this.el.appendChild(el); Core.hydrate(el); this._pl = el; this._plStop = M.Puppet ? M.Puppet.mountAll(el) : null;
    const q = s => el.querySelector(s);
    if (q('.m-resume')) q('.m-resume').onclick = () => this.resume();
    if (q('.m-restart')) q('.m-restart').onclick = () => this.restart();
    q('.m-quit').onclick = () => this.quit();
    M.Cursor.setMode('on');
    if (menu && M.Ears.available()) this._pauseListen = M.Ears.listen({ choices: [{ t: '继续', alts: ['继续游戏', '开始'] }, { t: '退出', alts: ['不玩了'] }], onResult: r => { if (r.idx === 0) this.resume(); else if (r.idx === 1) this.quit(); } });
  };
  SP.resume = async function () {
    if (!this.paused) return;
    if (this._pauseListen) { this._pauseListen.stop(); this._pauseListen = null; }
    if (this._plStop) this._plStop();
    if (this._pl) { this._pl.remove(); this._pl = null; }
    M.Cursor.setMode('off');
    await this.countdownShort();
    this.paused = false; this._autoPaused = false;
    this._songs.forEach(s => !s.playing && s.resume && s.resume());
    if (this.def.onPause) this.def.onPause(this, false);
  };
  SP.countdownShort = async function () { const c = U.h('div', 'mg-count sm'); this.el.appendChild(c); for (const n of ['3', '2', '1']) { c.innerHTML = '<b>' + n + '</b>'; c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick'); M.Synth.sfx('count', .6); await U.sleep(450); } c.remove(); };
  SP.restart = function () { M.play(this.def.id, this.opts); };
  SP.quit = function () { this.over = true; M.UI.hub(); };

  // 结算：星星、分数、奖励金币和经验
  SP.end = function (r) {
    if (this.over) return; this.over = true; r = r || {};
    this._songs.forEach(s => s.stop()); M.Ears.stop();
    const score = Math.round(r.score != null ? r.score : this.hud.scoreV), total = r.total != null ? r.total : this.stats.total, correct = r.correct != null ? r.correct : this.stats.correct;
    const acc = total ? correct / total : (r.acc != null ? r.acc : 1);
    const stars = r.stars != null ? r.stars : acc >= .9 ? 3 : acc >= .65 ? 2 : acc >= .3 ? 1 : 0;
    const coins = 6 + stars * 6 + Math.min(12, Math.floor(score / 1500)), xp = 12 + stars * 8;
    const best = M.Store.record(this.def.id, score, stars);
    try { App.addCoins(coins); App.addXP(xp); } catch (e) {}
    const el = U.h('div', 'm-layer top mg-result');
    el.innerHTML = '<div class="mg-rbox"><div class="mg-rstars">' + [0, 1, 2].map(i => '<i class="' + (i < stars ? 'on' : '') + '" style="--d:' + (i * .25 + .3) + 's">★</i>').join('') + '</div>' +
      '<h2>' + (r.title || (stars >= 3 ? '太厉害了！' : stars >= 2 ? '真棒！' : stars >= 1 ? '不错哦！' : '再来一次吧！')) + '</h2>' +
      '<div class="mg-rnum"><b>' + score + '</b><small>分' + (best.isBest && score > 0 ? ' · 新纪录！' : ' · 最高 ' + best.best) + '</small></div>' +
      '<div class="mg-rrows">' + (total ? '<div>' + U.E('✅') + ' 答对 <b>' + correct + '/' + total + '</b></div>' : '') + (r.lines || []).map(l => '<div>' + l + '</div>').join('') + '<div>' + U.E('🪙') + ' 金币 <b>+' + coins + '</b></div><div>' + U.E('✨') + ' 经验 <b>+' + xp + '</b></div></div>' +
      '<div class="mg-pbtns"><button class="btn big go m-again">' + U.E('🔁') + ' 再玩一次</button><button class="btn ghost m-quit">' + U.E('🏠') + ' 返回体感乐园</button></div></div>';
    this.el.appendChild(el); Core.hydrate(el);
    el.querySelector('.m-again').onclick = () => this.restart();
    el.querySelector('.m-quit').onclick = () => M.UI.hub();
    if (stars >= 2) { Core.UI.confetti(90); Core.Audio2.sfx('victory', .6); } else Core.Audio2.sfx(stars ? 'win' : 'fail', .5);
    this.say(stars >= 3 ? '太厉害了' : stars >= 2 ? '真棒' : stars >= 1 ? '不错哦' : '再来一次吧');
    M.Cursor.setMode('on');
    if (M.Ears.available()) M.Ears.listen({ choices: [{ t: '再玩一次', alts: ['再来一次', '再来'] }, { t: '返回', alts: ['退出', '不玩了'] }], onResult: x => { if (x.idx === 0) this.restart(); else if (x.idx === 1) M.UI.hub(); } });
  };
  SP.dispose = function () {
    this.over = true; this.started = false;
    [this._main, this._pip, this._watch, this._xLoop].forEach(l => l && l.stop());
    this._offs.forEach(f => f()); this._songs.forEach(s => s.stop()); this._disp.forEach(f => { try { f(); } catch (e) {} });
    M.Ears.stop(); M.Cursor.setMode('on'); M._awake = false; M.keepAwake(false);
    if (this.def.dispose) try { this.def.dispose(this); } catch (e) {}
  };

  /* ---------- 体感存档（挂在当前角色存档上） ---------- */
  M.Store = {
    get() { const p = Core.Store.p; if (!p) return { best: {}, stars: {}, plays: 0, wrong: [] }; return p.motion || (p.motion = { best: {}, stars: {}, plays: 0 }); },
    record(id, score, stars) { const m = this.get(); const old = m.best[id] || 0; m.best[id] = Math.max(old, score); m.stars[id] = Math.max(m.stars[id] || 0, stars); m.plays = (m.plays || 0) + 1; Core.Store.save(); return { best: m.best[id], isBest: score > old }; },
    wrong() {},
  };

  /* ---------- 开一局 ---------- */
  M.play = function (id, opts) {
    const def = typeof id === 'string' ? M.gameById(id) : id; if (!def) return;
    opts = Object.assign({}, opts); M.lastPlay = { id: def.id, opts };
    Core.Audio2.stopMusic();
    return App.show('mgame', el => { const G = new Session(def, opts, el); el._G = G; window.__MG = G; }, {}).then(el => { if (el && el._G) el._G.run(); });
  };
  M.Session = Session;
})();
