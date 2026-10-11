/* 大游戏公共层：操作方式（触屏 / 键鼠）、半透明虚拟按键、游戏内答题、图片缓存
   以及 2D 大游戏：弹弓物理大作战（星星大冒险在 platform.js） */
(function () {
  const { h, sleep, E, hydrate, UI, Audio2, Voice, esc } = Core;
  const R = CONTENT.R;
  const live = (S, el) => !S.over && el.isConnected;

  /* ---------- 操作方式 ---------- */
  function ctrlMode() {
    const p = Core.Store.p, c = p && p.settings.ctrl;
    if (c === 'touch' || c === 'kbm') return c;
    return matchMedia('(pointer: coarse)').matches ? 'touch' : 'kbm';
  }
  const KX = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 }, KY = { ArrowUp: -1, w: -1, W: -1, ArrowDown: 1, s: 1, S: 1 };
  // cfg: { stick: 'xy' | 'lr' | false, buttons: [{ id, icon, label, keys:[] }], look: bool, mouseFire: id, lockEl }
  function Input(root, cfg) {
    const I = { kx: 0, ky: 0, sx: 0, sy: 0, btn: {}, edge: {}, ldx: 0, ldy: 0, mode: ctrlMode() };
    const keys = new Set(), bmap = {};
    cfg.buttons.forEach(b => (b.keys || []).forEach(k => bmap[k] = b.id));
    const press = (id, on) => { if (on && !I.btn[id]) I.edge[id] = true; I.btn[id] = on; };
    const recalc = () => { let x = 0, y = 0; keys.forEach(k => { x += KX[k] || 0; y += KY[k] || 0; }); I.kx = Math.max(-1, Math.min(1, x)); I.ky = Math.max(-1, Math.min(1, y)); };
    const kd = e => {
      if (!root.isConnected) return destroy();
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      keys.add(e.key); const id = bmap[e.key] || bmap[e.code]; if (id) press(id, true);
      if (id || KX[e.key] != null || KY[e.key] != null) e.preventDefault(); recalc();
    };
    const ku = e => { keys.delete(e.key); const id = bmap[e.key] || bmap[e.code]; if (id) press(id, false); recalc(); };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    // 鼠标：锁定指针后转视角、左键开火
    const lockEl = cfg.lockEl;
    const mm = e => { if (document.pointerLockElement === lockEl) { I.ldx += e.movementX; I.ldy += e.movementY; } };
    const md = e => { if (I.mode !== 'kbm' || !lockEl) return; if (cfg.look && document.pointerLockElement !== lockEl) { lockEl.requestPointerLock && lockEl.requestPointerLock(); return; } if (cfg.mouseFire && e.button === 0) press(cfg.mouseFire, true); };
    const mu = e => { if (cfg.mouseFire && e.button === 0) press(cfg.mouseFire, false); };
    if (lockEl) { addEventListener('mousemove', mm); lockEl.addEventListener('mousedown', md); addEventListener('mouseup', mu); }
    // 触屏覆盖层
    let ov = null;
    function buildTouch() {
      if (ov) ov.remove(); ov = null; I.sx = I.sy = 0;
      if (I.mode !== 'touch') return;
      ov = h('div', 'tc'); root.appendChild(ov);
      if (cfg.stick === 'xy') {
        const z = h('div', 'tc-stick', '<i></i>'); ov.appendChild(z); const knob = z.firstChild;
        let id = null, ox = 0, oy = 0;
        z.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; z.setPointerCapture(id); const r = z.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; mv(e); });
        const mv = e => { if (e.pointerId !== id) return; let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy), m = 54; if (d > m) { dx *= m / d; dy *= m / d; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; I.sx = dx / m; I.sy = dy / m; };
        z.addEventListener('pointermove', mv);
        const up = e => { if (e.pointerId !== id) return; id = null; I.sx = I.sy = 0; knob.style.transform = ''; };
        z.addEventListener('pointerup', up); z.addEventListener('pointercancel', up);
      } else if (cfg.stick === 'lr') {
        [['-1', '◀'], ['1', '▶']].forEach(([v, t]) => {
          const b = h('button', 'tc-lr', t); ov.appendChild(b);
          b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); I.sx = +v; b.classList.add('on'); });
          const up = () => { if (I.sx === +v) I.sx = 0; b.classList.remove('on'); };
          b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
        });
      }
      if (cfg.look) {
        const lz = h('div', 'tc-look'); ov.appendChild(lz); let lid = null, lx = 0, ly = 0;
        lz.addEventListener('pointerdown', e => { lid = e.pointerId; lz.setPointerCapture(lid); lx = e.clientX; ly = e.clientY; });
        lz.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; I.ldx += (e.clientX - lx) * 1.6; I.ldy += (e.clientY - ly) * 1.6; lx = e.clientX; ly = e.clientY; });
        const up = e => { if (e.pointerId === lid) lid = null; }; lz.addEventListener('pointerup', up); lz.addEventListener('pointercancel', up);
      }
      const bs = h('div', 'tc-btns'); ov.appendChild(bs);
      cfg.buttons.filter(b => !b.hidden).forEach(b => {
        const el = h('button', 'tc-btn' + (b.big ? ' big' : ''), E(b.icon) + '<small>' + esc(b.label) + '</small>'); el.dataset.b = b.id; bs.appendChild(el);
        el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); press(b.id, true); el.classList.add('on'); });
        const up = () => { press(b.id, false); el.classList.remove('on'); }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
      hydrate(ov);
    }
    // 右上角切换按钮
    const sw = h('button', 'tc-switch'); root.appendChild(sw);
    const label = () => { sw.innerHTML = I.mode === 'touch' ? E('👆') + '触屏' : E('⌨️') + '键鼠'; hydrate(sw); };
    sw.onclick = () => { I.mode = I.mode === 'touch' ? 'kbm' : 'touch'; const p = Core.Store.p; if (p) { p.settings.ctrl = I.mode; Core.Store.save(); } if (document.pointerLockElement) document.exitPointerLock(); label(); buildTouch(); UI.toast(I.mode === 'touch' ? '已切换为触屏操作' : '已切换为键盘鼠标操作', 1000); };
    sw.dataset.tip = '切换触屏 / 键鼠操作';
    // 键鼠模式：左下角常驻按键说明
    const KN = { ' ': '空格', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Shift: 'Shift' };
    const legend = h('div', 'kb-legend'); root.appendChild(legend);
    const drawLegend = () => {
      legend.style.display = I.mode === 'kbm' ? '' : 'none'; if (I.mode !== 'kbm') return;
      const rows = [];
      if (cfg.stick === 'xy') rows.push(['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>', '移动']);
      else if (cfg.stick === 'lr') rows.push(['<kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd>', '左右移动']);
      if (cfg.look) rows.push(['<kbd>🖱 移动</kbd>', '瞄准（先点一下画面）']);
      cfg.buttons.forEach(b => { const ks = [...new Set((b.keys || []).map(k => KN[k] || k.toUpperCase()))].slice(0, 3); if (cfg.mouseFire === b.id) ks.unshift('🖱 左键'); if (ks.length) rows.push([ks.map(k => '<kbd>' + esc(k) + '</kbd>').join(''), esc(b.label)]); });
      rows.push(['<kbd>1</kbd>-<kbd>4</kbd>', '答题时选答案'], ['<kbd>Esc</kbd>', '退出']);
      legend.innerHTML = rows.map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    };
    const oldClick = sw.onclick; sw.onclick = () => { oldClick(); drawLegend(); };
    document.body.classList.add('kgame');
    label(); buildTouch(); drawLegend();
    I.ax = () => I.sx || I.kx; I.ay = () => I.sy || I.ky;
    I.take = id => { const v = I.edge[id]; I.edge[id] = false; return !!v; };
    I.look = () => { const d = [I.ldx, I.ldy]; I.ldx = I.ldy = 0; return d; };
    I.release = () => { keys.clear(); recalc(); Object.keys(I.btn).forEach(k => I.btn[k] = false); I.sx = I.sy = 0; };
    function destroy() { document.body.classList.remove('kgame'); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (document.pointerLockElement) document.exitPointerLock(); }
    I.destroy = destroy; Core.onLeave(destroy);
    return I;
  }

  /* ---------- 游戏内答题（暂停游戏，弹出题板） ---------- */
  function ask(S, q, host, opt) {
    opt = opt || {};
    return new Promise(res => {
      if (document.pointerLockElement) document.exitPointerLock();
      const ov = h('div', 'ar-ask'), box = h('div', 'ar-askbox'); ov.appendChild(box); host.appendChild(ov);
      if (opt.title) box.appendChild(h('div', 'ar-asktitle', opt.title));
      const QP = Engines.qPanel(q); box.appendChild(QP.el);
      const grid = h('div', 'choices compact n' + q.ch.length); box.appendChild(grid);
      const prev = S.auto; let done = false;
      q.ch.forEach(c => {
        const b = h('button', 'choice pop-in', Engines.choiceHTML(c, q.latinCh)); b.dataset.ok = c.ok ? 1 : 0;
        b.onclick = async () => {
          if (done) return; done = true;
          if (c.ok) { b.classList.add('good'); S.right++; S.total++; Audio2.sfx('right', .5); }
          else { b.classList.add('bad'); grid.children[q.ch.findIndex(x => x.ok)].classList.add('reveal'); S.wrong++; S.total++; S.wrongs.push(q.p + ' → ' + (q.ch.find(x => x.ok) || {}).t); Audio2.sfx('wrong', .4); if (q.ex) Voice.say(q.ex); }
          await sleep(c.ok ? 550 : 1400); ov.classList.add('out'); await sleep(200); ov.remove(); S.auto = prev; res(c.ok);
        };
        grid.appendChild(b);
      });
      hydrate(box); QP.speak();
      S.auto = () => { const b = grid.querySelector('[data-ok="1"]'); b && b.click(); };
    });
  }
  const feeder = (S, data) => { let pool = (data || []).slice(); return () => { if (!pool.length) pool = (S.more ? S.more() : data).slice(); return pool.shift(); }; };

  /* ---------- 资源 ---------- */
  const IMG = {};
  const img = src => { if (!IMG[src]) { const i = new Image(); i.src = src; IMG[src] = i; } return IMG[src]; };
  const emoImg = ch => img(Core.emoSrc(ch));
  const ok = i => i && i.complete && i.naturalWidth > 0;
  function heroFrames() {
    const p = Core.Store.p, H = p && App.HEROES.find(x => x.id === p.hero);
    const sh = App.heroShot && App.heroShot('idle');
    if (sh) { const f = k => img(App.heroShot(k)); return { idle: f('idle'), walk: [f('walk_a'), f('walk_b')], jump: f('jump'), hit: f('hit'), sprite: true, tall: true }; }
    if (H && H.img) { const f = k => img('assets/img/' + H.img + '_' + k + '.png'); return { idle: f('idle'), walk: [f('walk_a'), f('walk_b')], jump: f('jump'), hit: f('hit'), sprite: true }; }
    const e = emoImg(H && H.e ? H.e : '🧒'); return { idle: e, walk: [e, e], jump: e, hit: e, sprite: false };
  }
  function petEmoji() { const p = Core.Store.p; if (p && p.pet) { const K = App.PETS.find(x => x.id === p.pet.kind); if (K) return K.e; } return '🐤'; }
  function canvasIn(wrap) {
    const cv = document.createElement('canvas'); cv.className = 'ar-cv'; wrap.appendChild(cv);
    const ctx = cv.getContext('2d');
    const fit = () => { const r = wrap.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(10, r.width * d); cv.height = Math.max(10, r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); return { w: r.width, h: r.height }; };
    return { cv, ctx, fit };
  }
  function arena(S, cls) {
    const st = S.stage; st.className = 'stage scene-arcade'; st.innerHTML = '';
    const wrap = h('div', 'ar-wrap ' + (cls || '')); st.appendChild(wrap);
    const hud = h('div', 'ar-hud'); wrap.appendChild(hud);
    const labels = h('div', 'ar-labels'); wrap.appendChild(labels);
    return { st, wrap, hud, labels };
  }
  const banner = (wrap, t, ms) => { const b = h('div', 'ar-banner', t); wrap.appendChild(b); hydrate(b); setTimeout(() => b.remove(), ms || 1600); };
  // 倒计时前先等 3D 角色、贴图等全部加载完，避免开跑了模型还没出来
  async function countdown(wrap) { if (window.Avatar3D && Avatar3D.idle) await Avatar3D.idle(); if (window.NetLoad) await NetLoad.idle(150); for (const t of ['3', '2', '1', 'GO!']) { banner(wrap, '<b class="latin">' + t + '</b>', 700); Audio2.sfx(t === 'GO!' ? 'whoosh' : 'tick', .5); await sleep(750); } }

  /* =====================================================================
     2) 弹弓物理大作战（Matter.js）：打下举着正确答案的小怪
     ===================================================================== */
  function bird(S, data) {
    return new Promise(async resolve => {
      const M = window.Matter; const { wrap, hud, labels } = arena(S, 'bd');
      const { cv, ctx, fit } = canvasIn(wrap); wrap.insertBefore(cv, hud);
      const qBox = h('div', 'dn-q'); wrap.appendChild(qBox);
      const nextQ = feeder(S, data), ROUNDS = 4, BIRDS = 4, WW = 1600, WH = 900, GY = 820, A = { x: 270, y: 600 };
      const IN = Input(wrap, { stick: false, buttons: [{ id: 'fire', icon: '🚀', label: '发射', keys: [' ', 'Enter'], big: true }] });
      let size = fit(); addEventListener('resize', () => { if (cv.isConnected) size = fit(); });
      const view = () => { const sc = Math.min(size.w / WW, size.h / WH); return { sc, ox: (size.w - WW * sc) / 2, oy: size.h - WH * sc }; };
      const MAT = { wood: { d: .0018, img: 'wood' }, stone: { d: .004, img: 'stone' }, glass: { d: .0012, img: 'glass' } };
      const bgs = ['colored_grass', 'colored_desert', 'colored_shroom', 'colored_land'];
      let won = 0, done = false, birdsUsed = 0;
      for (let r = 0; r < ROUNDS && !S.over; r++) {
        S.setProgress(r, ROUNDS);
        const engine = M.Engine.create(); engine.gravity.y = 1; const world = engine.world;
        M.Composite.add(world, [M.Bodies.rectangle(WW / 2, GY + 60, WW * 3, 120, { isStatic: true, friction: 1, label: 'ground' })]);
        const q = nextQ(); if (q.ch.length > 3) q.ch = R.shuffle([q.ch.find(c => c.ok)].concat(q.ch.filter(c => !c.ok).slice(0, 2)));
        qBox.innerHTML = ''; const QP = Engines.qPanel(q); qBox.appendChild(QP.el); QP.speak();
        labels.innerHTML = '';
        const blocks = [], targets = [], bgI = img('assets/img/phys/' + bgs[r % bgs.length] + '.jpg');
        const block = (x, y, w, hh, m) => { const b = M.Bodies.rectangle(x, y, w, hh, { density: MAT[m].d, friction: .8, restitution: .05 }); b.kind = m; b.w = w; b.h = hh; blocks.push(b); return b; };
        const xs = R.shuffle([920, 1150, 1380]).slice(0, q.ch.length).sort((a, b) => a - b);
        q.ch.forEach((c, i) => {
          const x0 = xs[i], m = R.pick(['wood', 'wood', 'stone', 'glass']), lv = R.int(1, 2); let y = GY;
          for (let k = 0; k < lv; k++) { const ph = 130 - k * 20; block(x0 - 55, y - ph / 2, 26, ph, m); block(x0 + 55, y - ph / 2, 26, ph, m); y -= ph; block(x0, y - 13, 160, 26, m); y -= 26; }
          const t = M.Bodies.circle(x0, y - 32, 30, { density: .0015, friction: .6, restitution: .3, label: 'target' }); t.c = c; t.alive = true; t.img = img('assets/img/phys/alien' + ['Green', 'Pink', 'Blue', 'Yellow', 'Beige'][i] + '_round.png');
          t.lb = h('div', 'bd-label', Engines.choiceHTML(c, q.latinCh)); labels.appendChild(t.lb); targets.push(t);
        });
        hydrate(labels);
        M.Composite.add(world, blocks.concat(targets));
        // 稳定一下结构
        for (let k = 0; k < 90; k++) M.Engine.update(engine, 1000 / 60);
        let acc = 0, birdBody = null, aiming = false, pull = { x: 0, y: 0 }, kAng = -.7, kPow = .7, left = BIRDS, flying = 0, still = 0, roundDone = false, killCorrect = false;
        const birdE = petEmoji(), birdImg = emoImg(birdE);
        const kill = t => { if (!t.alive) return; t.alive = false; t.dead = 0; Audio2.sfx('poof', .5); M.Composite.remove(world, t); t.lb.classList.add('gone'); if (t.c.ok) killCorrect = true; else { S.wrong++; S.total++; UI.toast('打错啦！要打举着正确答案的小怪', 1400); Audio2.sfx('wrong', .4); } };
        M.Events.on(engine, 'collisionStart', ev => ev.pairs.forEach(p => {
          [p.bodyA, p.bodyB].forEach((b, i) => { if (b.label !== 'target' || !b.alive) return; const o = i ? p.bodyA : p.bodyB; const rv = Math.hypot(b.velocity.x - o.velocity.x, b.velocity.y - o.velocity.y); if (rv > (o.label === 'bird' ? 3 : 4.2)) kill(b); });
        }));
        const toWorld = (cx, cy) => { const v = view(), r0 = cv.getBoundingClientRect(); return { x: (cx - r0.left - v.ox) / v.sc, y: (cy - r0.top - v.oy) / v.sc }; };
        const launch = (vx, vy) => {
          if (birdBody || left <= 0 || roundDone) return;
          birdBody = M.Bodies.circle(A.x, A.y, 26, { density: .006, restitution: .4, friction: .5, label: 'bird' }); M.Composite.add(world, birdBody);
          M.Body.setVelocity(birdBody, { x: vx, y: vy }); left--; birdsUsed++; flying = 0; still = 0; Audio2.sfx('throw', .6);
        };
        const pullToVel = pl => ({ x: -pl.x * .21, y: -pl.y * .21 });
        const pd = e => { if (birdBody || roundDone) return; const w = toWorld(e.clientX, e.clientY); if (Math.hypot(w.x - A.x, w.y - A.y) < 120) { aiming = true; cv.setPointerCapture(e.pointerId); } };
        const pm = e => { if (!aiming) return; const w = toWorld(e.clientX, e.clientY); let dx = w.x - A.x, dy = w.y - A.y; const d = Math.hypot(dx, dy); if (d > 160) { dx *= 160 / d; dy *= 160 / d; } pull = { x: dx, y: dy }; };
        const pu = () => { if (!aiming) return; aiming = false; if (Math.hypot(pull.x, pull.y) > 20) { const v = pullToVel(pull); launch(v.x, v.y); } pull = { x: 0, y: 0 }; };
        cv.addEventListener('pointerdown', pd); cv.addEventListener('pointermove', pm); cv.addEventListener('pointerup', pu);
        await new Promise(next => {
          let last = performance.now();
          const finishRound = async ok => {
            if (roundDone) return; roundDone = true;
            if (ok) { won++; S.right++; S.total++; Audio2.sfx('victory', .5); UI.confetti(60); await Voice.say(R.pick(Engines.PRAISE)); }
            else { S.wrong++; S.total++; S.wrongs.push(q.p); targets.find(t => t.c.ok).lb.classList.add('reveal'); Audio2.sfx('fail', .4); await Voice.say('小鸟用完啦'); }
            await sleep(700); next();
          };
          const loop = now => {
            if (!live(S, cv)) { IN.destroy(); return next(); }
            const dt = Math.min(50, now - last); last = now;
            if (!roundDone) {
              if (!birdBody && !aiming) { // 键盘瞄准
                const ax = IN.ax(), ay = IN.ay(); kAng = Math.max(-1.45, Math.min(.2, kAng + ay * dt * .0015)); kPow = Math.max(.2, Math.min(1, kPow - ax * dt * -.0008));
                if (IN.mode === 'kbm' && (ax || ay)) pull = { x: -Math.cos(kAng) * 160 * kPow, y: -Math.sin(kAng) * 160 * kPow };
                if (IN.take('fire')) { const pl = Math.hypot(pull.x, pull.y) > 20 ? pull : { x: -Math.cos(kAng) * 160 * kPow, y: -Math.sin(kAng) * 160 * kPow }; const v = pullToVel(pl); launch(v.x, v.y); pull = { x: 0, y: 0 }; }
              }
              acc += dt; while (acc >= 16.67) { M.Engine.update(engine, 1000 / 60); acc -= 16.67; }
              targets.forEach(t => { if (t.alive && (t.position.y > GY + 40 || Math.abs(t.angularVelocity) > .5 && t.speed > 5)) kill(t); });
              if (birdBody) {
                flying += dt; still = birdBody.speed < .25 ? still + dt : 0;
                const out = birdBody.position.x > WW + 100 || birdBody.position.x < -100 || birdBody.position.y > WH + 100;
                if (killCorrect) { finishRound(true); }
                else if (out || still > 600 || flying > 6500) { M.Composite.remove(world, birdBody); birdBody = null; if (left <= 0) finishRound(false); }
              } else if (killCorrect) finishRound(true);
            }
            // 绘制
            const { w: cw, h: ch } = size, v = view();
            ctx.fillStyle = '#cdeefc'; ctx.fillRect(0, 0, cw, ch);
            if (ok(bgI)) { const bw = WH * v.sc * 1.05; for (let bx = v.ox - bw * .3; bx < cw; bx += bw) ctx.drawImage(bgI, bx, v.oy - bw * .02, bw, bw); }
            ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.sc, v.sc);
            const grass = img('assets/img/phys/grass.png'), dirt = img('assets/img/phys/dirt.png');
            for (let x = -200; x < WW + 200; x += 70) { if (ok(grass)) ctx.drawImage(grass, x, GY, 70, 70); if (ok(dirt)) ctx.drawImage(dirt, x, GY + 70, 70, 70); }
            // 弹弓
            ctx.fillStyle = '#6b3f1f'; ctx.fillRect(A.x - 10, A.y, 20, GY - A.y); ctx.fillRect(A.x - 34, A.y - 40, 14, 60); ctx.fillRect(A.x + 20, A.y - 40, 14, 60);
            blocks.forEach(b => { const im = img('assets/img/phys/' + MAT[b.kind].img + (b.w > b.h * 1.5 ? '_h' : b.h > b.w * 1.5 ? '_v' : '_s') + '.png'); ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle); if (ok(im)) ctx.drawImage(im, -b.w / 2, -b.h / 2, b.w, b.h); else { ctx.fillStyle = '#c98a4c'; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); } ctx.restore(); });
            targets.forEach(t => {
              if (!t.alive) { t.dead += dt; if (t.dead > 500) return; }
              ctx.save(); ctx.translate(t.position.x, t.position.y); ctx.rotate(t.angle); ctx.globalAlpha = t.alive ? 1 : 1 - t.dead / 500; const sc = t.alive ? 1 : 1 + t.dead / 300; ctx.scale(sc, sc); if (ok(t.img)) ctx.drawImage(t.img, -32, -32, 64, 64); ctx.restore(); ctx.globalAlpha = 1;
              const sx = v.ox + t.position.x * v.sc, sy = v.oy + (t.position.y - 40) * v.sc; t.lb.style.transform = 'translate(-50%,-100%) translate(' + sx + 'px,' + sy + 'px)';
            });
            const drawBird = (x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a || 0); if (ok(birdImg)) ctx.drawImage(birdImg, -30, -30, 60, 60); else { ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.fill(); } ctx.restore(); };
            if (birdBody) drawBird(birdBody.position.x, birdBody.position.y, birdBody.angle);
            else if (!roundDone && left > 0) {
              const px = A.x + pull.x, py = A.y + pull.y;
              ctx.strokeStyle = '#3a1f0a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(A.x - 27, A.y - 34); ctx.lineTo(px, py); ctx.lineTo(A.x + 27, A.y - 34); ctx.stroke();
              drawBird(px, py, 0);
              if (Math.hypot(pull.x, pull.y) > 20) { const vv = pullToVel(pull); let x = A.x, y = A.y, vx = vv.x, vy = vv.y; ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let k = 0; k < (S.grade <= 1 ? 60 : 30); k++) { x += vx; vy += .2778; y += vy; vx *= .99; vy *= .99; if (k % 3 === 0) { ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); } } }
            }
            for (let k = 0; k < left - (birdBody || roundDone ? 0 : 1); k++) drawBird(A.x - 80 - k * 60, GY - 30, 0);
            ctx.restore();
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
          S.auto = () => {
            if (birdBody || roundDone || aiming) return; const t = targets.find(z => z.alive && z.c.ok); if (!t) return;
            let best = null;
            for (let ang = -1.35; ang < -.2; ang += .02) for (let p = .3; p <= 1.001; p += .05) {
              const vv = pullToVel({ x: -Math.cos(ang) * 160 * p, y: -Math.sin(ang) * 160 * p }); let x = A.x, y = A.y, vx = vv.x, vy = vv.y;
              for (let k = 0; k < 300; k++) { x += vx; vy += .2778; y += vy; vx *= .99; vy *= .99; const d = Math.hypot(x - t.position.x, y - t.position.y); if (d < 30 && (!best || ang < best.ang)) { best = { vx: vv.x, vy: vv.y, ang }; break; } if (y > GY) break; }
            }
            if (best) launch(best.vx, best.vy); else launch(16, -18);
          };
        });
        cv.removeEventListener('pointerdown', pd); cv.removeEventListener('pointermove', pm); cv.removeEventListener('pointerup', pu);
        M.Engine.clear(engine);
      }
      IN.destroy();
      if (!S.over) { S.setProgress(ROUNDS, ROUNDS); S.end(false, won === ROUNDS && birdsUsed <= ROUNDS * 2 ? 3 : won >= ROUNDS - 1 ? 2 : 1); }
      resolve();
    });
  }

  Object.assign(Engines.ENGINES, { bird });
  Object.assign(Engines.ENG_NAMES, { platform: '星星大冒险', bird: '弹弓物理战', kart: '星星卡丁车', splat: '喷射涂涂战', roll: '星星滚球' });
  Object.assign(Engines.HELP2, {
    platform: '左右跑、按跳跃！踩扁小怪、踢乌龟壳，顶知识问号砖答对了能拿到蘑菇、火焰花和无敌星，越过水管和深坑，最后跳上旗杆！',
    bird: '把小鸟往后拉，松手发射！打下举着正确答案的小怪。', kart: '左右转弯，撞道具箱答题拿蘑菇加速，冲向第一名！',
    splat: '移动、瞄准、喷射颜料！把地面涂成你的颜色，打中正确答案的气球有墨水炸弹。',
    roll: '推动摇杆滚动水晶球，别从空中跑道掉下去！把球滚进写着正确答案的终点圈。',
  });
  Engines.BIG = new Set(['platform', 'bird', 'kart', 'splat', 'roll']);
  Engines.BIG.forEach(k => { Engines.NONQ.add(k); Engines.REALTIME.add(k); Engines.PLAY.add(k); });
  window.Arcade = { Input, ask, feeder, img, emoImg, ok, heroFrames, petEmoji, arena, banner, countdown, ctrlMode, live };
})();
