/* 星球保卫战 · 星星能量波（原创）：守护脚下的「星星岛」小星球，打掉从深空飘下来的飞碟和陨石
   · 手的位置就是准星（左右手各一个）；出拳 = 从准星方向发射光弹（带自动瞄准）
   · 双手在胸前合拢蓄力（大喊能加速）→ 双手推开 / 向前推，放出星星能量波，横扫一条直线；推出后移动双手还能扫射
   · 跳一下 = 星球护盾，挡住陨石和子弹；左右移动身体躲母舰的子弹
   · 知识保卫战：顶部出题，用光弹打下写着正确答案的飞碟（能量波打不动答案飞碟，要动脑选）；打错的飞碟分裂成两只捣蛋小怪
     第 8 题外星母舰来袭，要 3 次能量波才能打败；双人合作时两人同时推出 = 彩虹「合体能量波」全屏清怪
   · 自由射击：90 秒纯打陨石刷分 */
(function () {
  const M = window.Motion, U = M.U;
  const PCOL = [{ L: '#ff5d9e', R: '#4cc9ff', glow: '#7ef9ff', name: 'P1' }, { L: '#ffd166', R: '#7bd389', glow: '#ffe28a', name: 'P2' }];
  const OPT_COL = ['#ff5d9e', '#4cc9ff', '#ffd166', '#7bd389'];
  const RAINBOW = ['#ff5d73', '#ff9f1a', '#ffd166', '#7bd389', '#4cc9ff', '#7c5cff', '#ff7ae0'];

  // 发光贴图 / 星形贴图缓存（粒子用 drawImage + lighter，比 shadowBlur 快得多）
  const SPR = {};
  function glow(col) {
    const k = 'g' + col; if (SPR[k]) return SPR[k];
    if (col.length === 4) col = '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3];
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#fff'); r.addColorStop(.18, col); r.addColorStop(.5, col + '55'); r.addColorStop(1, col + '00');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return (SPR[k] = c);
  }
  function starSpr(col) {
    const k = 's' + col; if (SPR[k]) return SPR[k];
    const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d');
    g.translate(24, 24); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 17; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.fillStyle = '#fff'; g.globalAlpha = .7; g.beginPath(); g.arc(-3, -4, 3.5, 0, 7); g.fill();
    return (SPR[k] = c);
  }

  M.game({
    id: 'kame', name: '星球保卫战', icon: '🛸', color: '#7c5cff', tag: '原创', demo: 'push',
    short: '出拳打飞碟，双手推出星星能量波！', desc: '守护星星岛！出拳发射光弹打下正确答案的飞碟，双手合拢蓄力再推出，放出超级星星能量波横扫陨石和外星母舰。',
    how: [['punch', '出拳发射光弹'], ['push', '双手合拢蓄力，推出能量波'], ['jump', '跳一下开护盾']],
    modes: [{ id: 'quiz', name: '知识保卫战', icon: '🧠', desc: '打下正确答案的飞碟' }, { id: 'free', name: '自由射击 90 秒', icon: '☄️', desc: '打陨石刷高分' }],
    duo: true, needs: { people: 1, mic: true },
    qOpts: { maxLen: 5, maxCh: 4 },
    sayHow: '出拳发射光弹，双手合拢蓄力，推出能量波',
    onPause(G, p) { const a = Core.Audio2.music; if (a) p ? a.pause() : a.play().catch(() => {}); },
    start(G) {
      const C = G.canvas(), x = C.ctx, mode = G.mode, duo = G.players > 1, NP = duo ? 2 : 1, def = G.def;
      let s = 1; const P = { cx: 0, cy: 0, R: 1, top: 0 };
      const IM = { ufo: U.emoImg('🛸', '3d'), rock: U.emoImg('🪨', '3d'), imp: U.emoImg('👾', '3d'), alien: U.emoImg('👽', '3d'), hero: U.emoImg('🧑‍🚀', '3d') };
      const ok = im => im.complete && im.naturalWidth;
      const surfY = px => P.cy - Math.sqrt(Math.max(0, P.R * P.R - (px - P.cx) * (px - P.cx)));

      /* ---------- 背景（深空 + 星云）和星球：离屏画一次 ---------- */
      const bg = document.createElement('canvas'), pl = document.createElement('canvas');
      function layout() {
        s = Math.min(C.W, C.H * 1.6) / 1100;
        P.R = Math.max(C.W * 1.6, 900); P.top = C.H * .83; P.cx = C.W / 2; P.cy = P.top + P.R;
        const d = C.dpr;
        bg.width = C.W; bg.height = C.H; const b = bg.getContext('2d');
        const g = b.createLinearGradient(0, 0, 0, C.H); g.addColorStop(0, '#04021a'); g.addColorStop(.55, '#0f0a38'); g.addColorStop(1, '#2a1660'); b.fillStyle = g; b.fillRect(0, 0, C.W, C.H);
        b.globalCompositeOperation = 'lighter';
        [['#7c5cff', .2, .3, .5], ['#ff5d9e', .78, .22, .4], ['#20c9c9', .55, .6, .45], ['#4c6bff', .1, .75, .35], ['#ff9f1a', .92, .62, .25]].forEach(([c, px, py, rr]) => {
          for (let k = 0; k < 3; k++) { const cx = (px + U.rand(-.06, .06)) * C.W, cy = (py + U.rand(-.06, .06)) * C.H, r = rr * C.W * U.rand(.4, .7); const n = b.createRadialGradient(cx, cy, 0, cx, cy, r); n.addColorStop(0, c + '30'); n.addColorStop(.5, c + '14'); n.addColorStop(1, c + '00'); b.fillStyle = n; b.fillRect(0, 0, C.W, C.H); }
        });
        b.globalCompositeOperation = 'source-over';
        // 远处的环形行星
        const rx = C.W * .86, ry = C.H * .2, rr = 46 * s; const pg = b.createRadialGradient(rx - rr * .4, ry - rr * .4, rr * .1, rx, ry, rr); pg.addColorStop(0, '#ffcf9e'); pg.addColorStop(1, '#a24f7a'); b.fillStyle = pg; b.beginPath(); b.arc(rx, ry, rr, 0, 7); b.fill();
        b.strokeStyle = 'rgba(255,220,180,.55)'; b.lineWidth = 5 * s; b.beginPath(); b.ellipse(rx, ry, rr * 1.9, rr * .45, -.35, .15, Math.PI - .15); b.stroke();
        // 星球（按设备像素画，边缘清晰）
        pl.width = Math.round(C.W * d); pl.height = Math.round(C.H * d); const p = pl.getContext('2d'); p.setTransform(d, 0, 0, d, 0, 0);
        const at = p.createRadialGradient(P.cx, P.cy, P.R - 10, P.cx, P.cy, P.R + 70 * s); at.addColorStop(0, 'rgba(126,249,255,.55)'); at.addColorStop(.35, 'rgba(124,92,255,.25)'); at.addColorStop(1, 'rgba(124,92,255,0)');
        p.fillStyle = at; p.beginPath(); p.arc(P.cx, P.cy, P.R + 70 * s, 0, 7); p.fill();
        const body = p.createLinearGradient(0, P.top, 0, C.H); body.addColorStop(0, '#45e0b8'); body.addColorStop(.25, '#1c9a9a'); body.addColorStop(1, '#173a6e');
        p.fillStyle = body; p.beginPath(); p.arc(P.cx, P.cy, P.R, 0, 7); p.fill();
        p.save(); p.beginPath(); p.arc(P.cx, P.cy, P.R, 0, 7); p.clip();
        for (let i = 0; i < 26; i++) { const cx = U.rand(0, C.W), cy = surfY(cx) + U.rand(18, C.H - P.top + 40) * s, r = U.rand(10, 34) * s; p.fillStyle = 'rgba(10,40,70,.28)'; p.beginPath(); p.ellipse(cx, cy, r, r * .45, 0, 0, 7); p.fill(); p.fillStyle = 'rgba(255,255,255,.08)'; p.beginPath(); p.ellipse(cx, cy - r * .12, r * .8, r * .3, 0, Math.PI, 0); p.fill(); }
        p.restore();
        p.strokeStyle = '#9dffb0'; p.lineWidth = 5 * s; p.beginPath(); p.arc(P.cx, P.cy, P.R, Math.PI * 1.2, Math.PI * 1.8); p.stroke();
        // 星星岛上的小房子、树、旗子
        const deco = (px, fn) => { const py = surfY(px); p.save(); p.translate(px, py); p.rotate(Math.asin((px - P.cx) / P.R)); fn(); p.restore(); };
        const house = (c, h) => () => { p.fillStyle = c; p.fillRect(-14 * s, -h * s, 28 * s, h * s); p.fillStyle = '#ff6b6b'; p.beginPath(); p.moveTo(-18 * s, -h * s); p.lineTo(0, -(h + 16) * s); p.lineTo(18 * s, -h * s); p.fill(); p.fillStyle = '#ffe28a'; p.fillRect(-5 * s, -h * .6 * s, 10 * s, 9 * s); };
        const tree = h => () => { p.fillStyle = '#7a4a1c'; p.fillRect(-3 * s, -h * s, 6 * s, h * s); p.fillStyle = '#3fd27a'; p.beginPath(); p.arc(0, -h * s, 13 * s, 0, 7); p.fill(); p.fillStyle = '#7bff9e'; p.beginPath(); p.arc(-4 * s, -(h + 4) * s, 5 * s, 0, 7); p.fill(); };
        const flag = () => { p.strokeStyle = '#fff'; p.lineWidth = 3 * s; p.beginPath(); p.moveTo(0, 0); p.lineTo(0, -54 * s); p.stroke(); p.fillStyle = '#ffd166'; p.beginPath(); p.moveTo(0, -54 * s); p.lineTo(30 * s, -46 * s); p.lineTo(0, -38 * s); p.fill(); p.drawImage(starSpr('#fff'), 4 * s, -54 * s, 14 * s, 14 * s); };
        [[.06, tree(22)], [.13, house('#7c5cff', 26)], [.2, tree(16)], [.33, tree(20)], [.4, house('#4cc9ff', 22)], [.6, house('#ff9fe0', 24)], [.67, tree(18)], [.8, tree(24)], [.87, house('#ffb52e', 28)], [.94, tree(15)], [.5, flag]].forEach(([f, fn]) => deco(C.W * f, fn));
      }
      layout(); addEventListener('resize', layout); G.onDispose(() => removeEventListener('resize', layout));
      const stars = Array.from({ length: 170 }, () => ({ x: Math.random(), y: Math.random(), z: Math.floor(Math.random() * 3), tw: U.rand(1, 4), ph: U.rand(0, 6) }));
      const SPD = [5, 13, 30];

      /* ---------- 状态 ---------- */
      const obs = [], bolts = [], beams = [], parts = [], rings = [], texts = [], bullets = [], scorch = [], meteorsBg = [];
      const ps = Array.from({ length: NP }, (_, i) => ({ i, hand: { L: { x: C.W / 2, y: C.H / 2, vis: false }, R: { x: C.W / 2, y: C.H / 2, vis: false } }, ax: C.W * (duo ? .25 + .5 * i : .5), ch: 0, hold: 0, out: 0, z0: 0, lock: false, full: false, lastBeam: -9, sfxT: 0, noShoot: 0, here: false, aimX: C.W / 2 }));
      const st = { rocks: 0, beams: 0, combos: 0, kills: 0 };
      let en = 100, lastHurt = -9, shieldT = 0, shieldReady = 0, shake = 0, flash = 0, hurtV = 0, slow = 0, shoutT = -9, rainbow = null, ended = false, saidShield = false, nextRock = 4, nextGold = 12, nextMeteorBg = 2;
      let q = null, qIdx = 0, qDone = 0, firstOK = 0, nextQ = mode === 'quiz' ? 3.6 : 1e9, respawnT = 0, boss = null, bossOn = false, bossDone = false;
      let timeLeft = mode === 'free' ? 90 : null, cardB = 0;
      // 题卡底边（飞碟和母舰排在题卡下面，不被挡住）
      const measureCard = () => { const w = G.el.querySelector('.mg-qwrap'); if (w && w.firstChild) cardB = w.offsetTop + w.offsetHeight + 10; };
      const QN = 10, lvl = () => Math.min(1, G.t / (mode === 'free' ? 80 : 160));
      G.hud.hearts(null);
      Core.Audio2.playMusic('battle');
      G.onDispose(() => { Core.Audio2.stopMusic(); def.noXPause = false; });
      G.say('出拳发射光弹，双手合拢蓄力，推出能量波');

      const person = i => duo ? M.Tracker.person(i) : G.player(0);
      const addScore = (n, px, py, col) => { G.hud.add(n); if (px != null) texts.push({ t: '+' + n, x: px, y: py, life: 1, col: col || '#fff', sz: 30 }); };
      const kick = () => { G.hud.combo(G.hud.comboV + 1); };
      const popAt = (txt, cls, px, py) => G.pop(txt, cls, U.clamp(px, 170 * s, C.W - 170 * s), py);

      /* ---------- 粒子 ---------- */
      function burst(px, py, cols, n, sp, o) {
        o = o || {}; for (let i = 0; i < n; i++) { const a = U.rand(0, 6.283), v = U.rand(.25, 1) * sp * s, life = U.rand(.4, 1) * (o.life || .8);
          parts.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0) * s, life, max: life, sz: U.rand(.6, 1.2) * (o.sz || 14) * s, col: Array.isArray(cols) ? U.pick(cols) : cols, g: (o.g || 0) * s, t: o.type || 'g' }); }
        if (parts.length > 650) parts.splice(0, parts.length - 650);
      }
      const ring = (px, py, col, r1, w, life) => rings.push({ x: px, y: py, r: 4 * s, r1: r1 * s, w: w * s, col, life: life || .5, max: life || .5 });
      function explode(px, py, kind, big) {
        const k = big ? 1.8 : 1;
        if (kind === 'rock') { burst(px, py, ['#ffb52e', '#ff6b3b', '#ffd166'], 22 * k, 380 * k, { sz: 20 * k }); burst(px, py, ['#8a6a55', '#5e4636', '#b08a6a'], 12 * k, 300, { type: 'd', g: 900, sz: 7, life: 1 }); ring(px, py, '#ffb52e', 90 * k, 8, .45); }
        else if (kind === 'imp') { burst(px, py, ['#b06bff', '#ff7ae0', '#7c5cff'], 20 * k, 340, { sz: 16 }); ring(px, py, '#c77dff', 70, 6, .4); }
        else if (kind === 'star') { burst(px, py, RAINBOW, 36, 520, { type: 's', sz: 22, life: 1.3, g: 260 }); burst(px, py, ['#fff', '#ffd166'], 16, 260, { sz: 26 }); ring(px, py, '#ffd166', 160, 10, .6); ring(px, py, '#ff7ae0', 110, 6, .5); }
        else if (kind === 'boss') { burst(px, py, ['#ff5d73', '#ffd166', '#fff', '#ff9f1a'], 40, 700, { sz: 30, life: 1.2 }); burst(px, py, RAINBOW, 30, 600, { type: 's', sz: 24, life: 1.6, g: 200 }); ring(px, py, '#fff', 320, 16, .8); ring(px, py, '#ff7ae0', 220, 10, .7); }
        else { burst(px, py, ['#7ef9ff', '#fff'], 10, 260, { sz: 12 }); }
      }

      /* ---------- 生成目标 ---------- */
      function spawnRock() {
        const big = Math.random() < .15 + lvl() * .25, r = (big ? U.rand(36, 44) : U.rand(22, 32)) * s, x0 = U.rand(.06, .94) * C.W, tx = U.rand(.1, .9) * C.W, vy = (70 + 80 * lvl() + U.rand(0, 30)) * s * (mode === 'free' ? 1.15 : 1);
        const tt = (P.top + 40 * s) / vy;
        obs.push({ k: 'rock', x: x0, y: -r - 10, vx: (tx - x0) / tt, vy, r, hp: big ? 2 : 1, big, rot: U.rand(0, 6), vr: U.rand(-2, 2), hurt: 0 });
      }
      function spawnImp(px, py, dir) { obs.push({ k: 'imp', x: px, y: py, vx: dir * 150 * s, vy: (55 + 40 * lvl()) * s, r: 26 * s, hp: 1, zig: U.rand(.5, .8), zt: 0, ph: U.rand(0, 6), born: G.t, hurt: 0 }); }
      function spawnGold() { const fromL = Math.random() < .5; obs.push({ k: 'gold', x: fromL ? -60 : C.W + 60, y: U.rand(.22, .45) * C.H, vx: (fromL ? 1 : -1) * U.rand(220, 300) * s, vy: 0, r: 40 * s, hp: 1, ph: U.rand(0, 6), born: G.t, hurt: 0 }); }
      function spawnWave() {
        const n = q.ch.length, lo = .16, hi = .84, order = U.shuffle(q.ch.map((_, i) => i));
        order.forEach((ci, k) => {
          const px = C.W * (n === 1 ? .5 : lo + (hi - lo) * k / (n - 1)), py = Math.max(C.H * .26, cardB + 60 * s) + U.rand(-14, 14) * s;
          obs.push({ k: 'ufo', x: px, x0: px, y: py, vx: 0, vy: (26 + 22 * lvl()) * s, r: 52 * s, hp: 1, label: q.ch[ci], ok: q.ch[ci].ok, col: OPT_COL[ci % 4], ph: U.rand(0, 6), born: G.t + k * .12, hurt: 0, sh: 0 });
          ring(px, py, OPT_COL[ci % 4], 120, 6, .6);
        });
        G.sfx('magic', .5);
      }
      function askNext() {
        if (qIdx === QN - 3 && !bossOn) { spawnBoss(); nextQ = G.t + 4; return; }
        qIdx++; q = G.q(); q.missed = false;
        G.ask(q, { options: true, colors: OPT_COL }); measureCard();
        spawnWave();
      }
      function spawnBoss() {
        bossOn = true; boss = { x: C.W / 2, y: -220 * s, hp: 3, max: 3, t: 0, shootT: 3, hurt: 0, dying: 0, w: Math.min(C.W * .4, 500 * s), lights: 0 };
        G.say('母舰来了，用能量波打败它'); G.pop('外星母舰来袭！', 'bad'); G.sfx('wall'); shake = .6;
      }

      /* ---------- 命中与结算 ---------- */
      function damage(n, px) {
        en = Math.max(0, en - n); hurtV = 1; lastHurt = G.t; shake = Math.max(shake, .7); G.sfx('boom', .6); G.hud.combo(0);
        scorch.push({ x: px, life: 1.4 });
        if (!saidShield && shieldReady <= G.t) { saidShield = true; G.say('跳一下开护盾'); }
        if (en <= 0) finish(true);
      }
      function kill(o, by) {
        o.dead = true;
        if (o.k === 'rock') { explode(o.x, o.y, 'rock', o.big); G.sfx('punch', .8); st.rocks++; kick(); addScore((o.big ? 20 : 10) + Math.min(10, G.hud.comboV) * 2, o.x, o.y - o.r, '#ffd166'); }
        else if (o.k === 'imp') { explode(o.x, o.y, 'imp'); G.sfx('pop'); kick(); addScore(15, o.x, o.y - o.r, '#ff9fe0'); }
        else if (o.k === 'gold') { explode(o.x, o.y, 'star'); G.fileSfx('coin', .6); kick(); addScore(50, o.x, o.y - o.r, '#ffd166'); }
        else if (o.k === 'ufo') {
          if (o.ok) {
            explode(o.x, o.y, 'star'); G.right(o.x, o.y); G.sfx('perfect'); kick();
            if (!q.missed) firstOK++;
            addScore(100 + Math.min(10, G.hud.comboV) * 10, o.x, o.y - o.r, '#ffd166'); G.pop(q.missed ? '答对啦！' : '太棒了！', 'perfect');
            en = Math.min(100, en + 5);
            obs.forEach(u => { if (u.k === 'ufo' && !u.dead) u.flee = true; });
            q = null; qDone++; G.ask(null); nextQ = G.t + 1.8;
            if (qDone >= QN) checkDone();
          } else {
            q.missed = true; G.wrong(); G.hud.combo(0); explode(o.x, o.y, 'imp'); G.sfx('wrong');
            popAt('不对哦，再找找', 'bad', o.x, o.y - o.r);
            spawnImp(o.x - 20 * s, o.y, -1); spawnImp(o.x + 20 * s, o.y, 1);
          }
        }
        st.kills++;
      }
      function hitObj(o, dmg, by) {
        if (o.dead || o.flee) return false;
        o.hp -= dmg; o.hurt = .15;
        if (o.hp <= 0) kill(o, by); else { burst(o.x, o.y, ['#fff', '#ffd166'], 8, 240, { sz: 10 }); G.sfx('hit', .6); }
        return true;
      }
      function hitBoss(dmg, px, py, big) {
        if (!boss || boss.dying) return;
        boss.hp = Math.max(0, boss.hp - dmg); boss.hurt = big ? .5 : .12;
        if (big) { explode(px, py, 'boss'); shake = 1; flash = Math.max(flash, .5); slow = .25; G.sfx('boom'); G.pop('命中母舰！', 'perfect'); addScore(100, px, py, '#ff9fe0'); }
        else { burst(px, py, ['#fff', '#7ef9ff'], 6, 200, { sz: 9 }); G.sfx('hit', .4); }
        if (boss.hp <= 0.001) { boss.dying = 1.8; G.sfx('boom'); }
      }
      function checkDone() {
        if (mode !== 'quiz' || qDone < QN) return;
        if (boss && !bossDone) { G.pop('打败母舰！', 'bad'); return; }
        finish(false);
      }
      function finish(fail) {
        if (ended) return; ended = true;
        const sc = G.hud.scoreV, lines = [U.E('☄️') + ' 打掉陨石 <b>' + st.rocks + '</b>', U.E('🌟') + ' 能量波 <b>' + st.beams + '</b> 次'];
        if (st.combos) lines.push(U.E('🌈') + ' 合体能量波 <b>' + st.combos + '</b> 次');
        if (bossOn) lines.push(U.E('🛸') + ' 外星母舰 <b>' + (bossDone ? '已击败' : '没打败') + '</b>');
        lines.push(U.E('🌏') + ' 星球能量 <b>' + Math.round(en) + '%</b>');
        const title = fail ? '星球能量用完啦' : undefined;
        if (fail) { G.pop('星球能量用完啦', 'bad'); flash = .8; }
        setTimeout(() => {
          Core.Audio2.stopMusic();
          G.end(mode === 'quiz' ? { score: sc, correct: firstOK, total: G.stats.total, lines, title }
            : { score: sc, stars: fail ? (sc >= 800 ? 1 : 0) : sc >= 1400 ? 3 : sc >= 800 ? 2 : sc >= 300 ? 1 : 0, lines, title });
        }, fail ? 1400 : 1000);
      }

      /* ---------- 光弹：出拳从准星方向射出，自动锁定准星附近的目标 ---------- */
      function targetNear(px, py, rad) {
        let best = null, bd = rad;
        obs.forEach(o => { if (o.dead || o.flee || (o.born && o.k === 'ufo' && G.t < o.born)) return; const d = Math.hypot(o.x - px, o.y - py) - o.r * .6; if (d < bd) { bd = d; best = o; } });
        bullets.forEach(b => { const d = Math.hypot(b.x - px, b.y - py); if (d < bd) { bd = d; best = b; } });
        if (boss && !boss.dying && !best) { const d = Math.hypot((boss.x - px) / 1.8, boss.y - py) - boss.w * .2; if (d < bd) best = boss; }
        return best;
      }
      function shoot(i, sd) {
        const p = ps[i], h = p.hand[sd], col = PCOL[i][sd], ox = p.ax + (sd === 'L' ? -16 : 16) * s, oy = surfY(p.ax) - 52 * s;
        const tg = targetNear(h.x, h.y, 150 * s);
        const dx = h.x - ox, dy = h.y - oy, l = Math.hypot(dx, dy) || 1;
        bolts.push({ x: ox, y: oy, vx: dx / l, vy: dy / l, tg, col, tr: [], life: 1.2 });
        burst(ox, oy, [col, '#fff'], 6, 160, { sz: 10, life: .3 });
        G.sfx('laser', .55);
      }
      G.on('punch', e => {
        const i = duo ? U.clamp(e.slot || 0, 0, 1) : 0, p = ps[i];
        if (!p || G.t < p.noShoot || p.ch > .25 || !p.hand[e.hand]) return;
        shoot(i, e.hand);
      });
      G.on('jump', () => {
        if (G.t < shieldReady) return;
        shieldT = 2.6; shieldReady = G.t + 4.5; G.sfx('magic'); G.fileSfx('magic', .4); G.pop('护盾！', 'good'); ring(P.cx, P.top, '#7ef9ff', 400, 10, .6);
      });
      G.on('mic:shout', () => { shoutT = G.t; });

      /* ---------- 能量波 ---------- */
      function fire(i) {
        const p = ps[i], pw = Math.max(.45, p.ch);
        p.ch = 0; p.lock = true; p.full = false; p.lastBeam = G.t; p.noShoot = G.t + .6; st.beams++;
        const oy = surfY(p.ax) - 48 * s;
        beams.push({ i, t: 0, dur: .7 + pw * .4, pw, x0: p.ax, y0: oy, ax: p.aimX, w: (70 + 120 * pw) * s, hitBoss: false });
        G.sfx('zap'); G.sfx('whoosh'); G.sfx('boom', .4); shake = Math.max(shake, .45 + .45 * pw); flash = Math.max(flash, .25);
        burst(p.ax, oy, [PCOL[i].glow, '#fff'], 24, 420, { sz: 18, life: .5 });
        ring(p.ax, oy, PCOL[i].glow, 110, 8, .4);
        G.pop('星星能量波！', 'perfect');
        // 双人：两人在 0.8 秒内先后推出 = 合体能量波
        if (duo && !rainbow && G.t - ps[1 - i].lastBeam < .8) comboBeam();
      }
      function comboBeam() {
        st.combos++; rainbow = { t: 0, r: 0, hitBoss: false };
        G.say('合体能量波'); G.pop('合体能量波！', 'big'); G.sfx('chime'); G.sfx('boom'); G.fileSfx('magic', .6);
        shake = 1.2; flash = .8; slow = .3;
      }

      /* ---------- 每个玩家：准星、站位、蓄力 ---------- */
      function readPlayer(p, dt) {
        const per = person(p.i), b = per && per.body;
        p.here = !!(b && b.ready);
        if (!p.here) { p.ch = Math.max(0, p.ch - dt); p.hold = 0; p.hand.L.vis = p.hand.R.vis = false; return; }
        const k = Math.min(1, dt * 16);
        ['L', 'R'].forEach(sd => {
          const h = b.hands[sd], c = p.hand[sd], rx = U.clamp(h.reach.x, 0, 1);
          const tx = (duo ? p.i * .5 + rx * .5 : rx) * C.W, ty = 14 * s + U.clamp(h.reach.y, 0, 1) * (P.top - 40 * s);
          c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.vis = h.visible;
        });
        const lane = b.lane || 0, tax = duo ? C.W * (.25 + .5 * p.i) + lane * C.W * .12 : C.W * .5 + lane * C.W * .26;
        p.ax += (tax - p.ax) * Math.min(1, dt * 7);
        p.aimX += ((p.hand.L.x + p.hand.R.x) / 2 - p.aimX) * Math.min(1, dt * 6);
        // 蓄力：双手都看得见、在胸前、靠得很近
        const HL = b.hands.L, HR = b.hands.R, midY = (HL.reach.y + HR.reach.y) / 2;
        const close = HL.visible && HR.visible && b.handGap < .62 && midY > .12 && midY < 1.02;
        const zf = ((HL.zf || 0) + (HR.zf || 0)) / 2;
        if (!close) p.lock = false;
        if (close && !p.lock) {
          p.hold += dt; p.out = 0;
          if (p.hold > .18) {
            if (p.ch === 0) p.z0 = zf;
            p.ch = Math.min(1, p.ch + (G.t - shoutT < 1.2 ? 2.4 : 1) / 1.3 * dt);
            if (G.t - p.sfxT > .75 && p.ch < 1) { p.sfxT = G.t; G.sfx('charge', .7); }
            if (p.ch >= 1 && !p.full) { p.full = true; G.sfx('chime', .6); }
            if (p.ch >= .5 && zf - p.z0 > .2) fire(p.i); // 双手一起向前推
          }
        } else {
          p.hold = 0;
          if (p.ch > 0) {
            p.out += dt; const spd = (HL.speed + HR.speed) / 2;
            if (p.ch >= .45 && p.out < .5 && (b.handGap > 1 || spd > 2.6)) fire(p.i); // 双手快速推开
            else if (p.out > .5) { p.ch = Math.max(0, p.ch - dt * 1.5); p.full = false; }
          }
        }
        // 真正双手交叉才允许暂停（胸前合掌蓄力也算「靠近」，不能误触暂停）
        return b.hands.L.rawA && b.hands.R.rawA && b.hands.L.rawA.x - b.hands.R.rawA.x > .15 * b.T;
      }

      // 线段到点的距离（能量波判定）
      const lineDist = (bm, px, py) => { const dx = bm.ax - bm.x0, dy = -60 - bm.y0, l = Math.hypot(dx, dy) || 1; return { d: Math.abs((px - bm.x0) * dy - (py - bm.y0) * dx) / l, along: ((px - bm.x0) * dx + (py - bm.y0) * dy) / l }; };
      const beamK = bm => { const u = bm.t / bm.dur; return u < .12 ? u / .12 : u > .7 ? Math.max(0, (1 - u) / .3) : 1; };

      /* ================= 每帧 ================= */
      G.loop((dt0, now) => {
        if (timeLeft != null && !ended) { timeLeft -= dt0; G.hud.timer(timeLeft); if (timeLeft <= 0) { timeLeft = 0; finish(false); } }
        slow = Math.max(0, slow - dt0); const dt = slow > 0 ? dt0 * .3 : dt0, t = G.t;
        let crossed = false; ps.forEach(p => { if (readPlayer(p, dt0)) crossed = true; });
        def.noXPause = !crossed;

        // 3 秒没被撞，星球能量慢慢恢复
        if (!ended && en > 0 && t - lastHurt > 3) en = Math.min(100, en + 1.5 * dt0);
        // 出题 / 刷怪
        if (!ended) {
          if (mode === 'quiz') {
            if (!q && qDone < QN && t >= nextQ) askNext();
            if (q && Math.floor(t * 2) !== Math.floor((t - dt0) * 2)) measureCard();
            if (q && t >= respawnT && !obs.some(o => o.k === 'ufo' && !o.dead && !o.flee)) spawnWave();
          }
          if (t >= nextRock) { spawnRock(); if (mode === 'free' && Math.random() < lvl() * .3) spawnRock(); nextRock = t + (mode === 'free' ? Math.max(.95, 2.1 - 1.1 * lvl()) : Math.max(2.4, 5 - 2.6 * lvl())) * (boss ? 1.4 : 1); }
          if (mode === 'free' && t >= nextGold) { spawnGold(); nextGold = t + U.rand(7, 11); }
          if (mode === 'free' && t > 12 && Math.random() < dt * .08 * lvl()) spawnImp(U.rand(.2, .8) * C.W, -30, Math.random() < .5 ? -1 : 1);
          if (mode === 'free' && !bossOn && t >= 40) spawnBoss();
        }
        if (t >= nextMeteorBg) { meteorsBg.push({ x: U.rand(.1, 1) * C.W, y: U.rand(0, .4) * C.H, life: .9 }); nextMeteorBg = t + U.rand(2.5, 5); }

        // 目标移动
        const shR = P.R + 90 * s;
        obs.forEach(o => {
          o.hurt = Math.max(0, o.hurt - dt); if (o.dead) return;
          if (o.flee) { o.vy -= 900 * s * dt; o.x += (o.x > C.W / 2 ? 1 : -1) * 200 * s * dt; o.y += o.vy * dt; if (o.y < -200) o.dead = true; return; }
          if (o.k === 'ufo') { if (t < o.born) return; o.y += o.vy * dt; o.x = o.x0 + Math.sin(t * .9 + o.ph) * 34 * s; o.sh = Math.max(0, o.sh - dt); }
          else if (o.k === 'imp') { o.zt += dt; if (o.zt > o.zig) { o.zt = 0; o.vx = -o.vx; } o.x += o.vx * dt; o.y += o.vy * dt; o.x = U.clamp(o.x, 30 * s, C.W - 30 * s); }
          else if (o.k === 'gold') { o.x += o.vx * dt; o.y += Math.sin(t * 3 + o.ph) * 40 * s * dt; if (o.x < -100 || o.x > C.W + 100) o.dead = true; if (Math.random() < .5) burst(o.x, o.y, ['#ffd166', '#fff'], 1, 40, { sz: 10, life: .5 }); }
          else { o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt; }
          const sy = surfY(o.x);
          if (o.k === 'ufo') {
            // 正确答案飞碟快落地还没被打下：溜走，整波重来（不扣分）
            if (o.y > sy - 130 * s) {
              obs.forEach(u => { if (u.k === 'ufo' && !u.dead) u.flee = true; });
              if (q) { q.missed = true; respawnT = t + 1.4; G.pop('答案飞碟溜走啦，再来一次', 'miss'); G.sfx('whoosh'); }
            }
            return;
          }
          if (shieldT > 0 && o.k !== 'gold' && Math.hypot(o.x - P.cx, o.y - P.cy) < shR) { o.dead = true; explode(o.x, o.y, o.k === 'imp' ? 'imp' : 'rock'); G.sfx('shatter', .6); addScore(5, o.x, o.y - 20 * s, '#7ef9ff'); return; }
          if (o.y + o.r * .4 > sy) { o.dead = true; explode(o.x, sy, 'rock', true); damage(o.k === 'imp' ? 6 : o.big ? 12 : 9, o.x); popAt('星球被撞到了！', 'bad', o.x, sy - 80 * s); }
        });
        for (let i = obs.length - 1; i >= 0; i--) if (obs[i].dead) obs.splice(i, 1);

        // 母舰
        if (boss) {
          const B = boss; B.t += dt; B.hurt = Math.max(0, B.hurt - dt);
          const ty = Math.max(C.H * .3, cardB + B.w * .22); B.y += (ty - B.y) * Math.min(1, dt * 1.2); B.x = C.W / 2 + Math.sin(B.t * .45) * C.W * .24;
          if (B.dying) {
            B.dying -= dt; if (Math.random() < dt * 14) { const ex = B.x + U.rand(-.45, .45) * B.w, ey = B.y + U.rand(-.12, .12) * B.w; explode(ex, ey, 'rock'); G.sfx('punch', .5); shake = Math.max(shake, .5); }
            if (B.dying <= 0) { explode(B.x, B.y, 'boss'); explode(B.x - B.w * .3, B.y, 'star'); explode(B.x + B.w * .3, B.y, 'star'); flash = 1; shake = 1.3; G.sfx('boom'); G.fileSfx('victory', .5); addScore(500, B.x, B.y - 60 * s, '#ffd166'); G.pop('打败母舰！+500', 'big'); G.say('母舰被打败啦'); boss = null; bossDone = true; setTimeout(checkDone, 1500); }
          } else if (B.y > ty - 40 * s) {
            B.shootT -= dt;
            if (B.shootT <= 0) {
              B.shootT = Math.max(1.5, 2.6 - lvl()); const tp = U.pick(ps.filter(p => p.here)) || ps[0], tx = tp.ax, ty2 = surfY(tx) - 40 * s, bx = B.x, by = B.y + B.w * .12;
              const l = Math.hypot(tx - bx, ty2 - by) || 1, sp = (130 + 50 * lvl()) * s;
              bullets.push({ x: bx, y: by, vx: (tx - bx) / l * sp, vy: (ty2 - by) / l * sp, r: 15 * s, ph: U.rand(0, 6) }); G.sfx('laser', .4); burst(bx, by, ['#ff5d9e', '#fff'], 8, 160, { sz: 12, life: .4 });
            }
          }
        }
        // 母舰子弹：慢速，左右移动躲开；护盾能挡
        bullets.forEach(b => {
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (shieldT > 0 && Math.hypot(b.x - P.cx, b.y - P.cy) < shR) { b.dead = true; explode(b.x, b.y); G.sfx('shatter', .5); return; }
          const sy = surfY(b.x);
          const hitP = ps.find(p => p.here && Math.abs(p.ax - b.x) < 40 * s && b.y > surfY(p.ax) - 90 * s);
          if (hitP) { b.dead = true; burst(b.x, b.y, ['#ff5d9e', '#fff'], 18, 300, { sz: 14 }); damage(8, b.x); popAt('被打中了，左右躲开！', 'bad', b.x, b.y - 60 * s); }
          else if (b.y > sy - 6 * s) { b.dead = true; burst(b.x, sy, ['#ff5d9e', '#ffb3d1'], 10, 180, { sz: 10 }); G.sfx('pop', .4); }
        });
        for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].dead) bullets.splice(i, 1);

        // 光弹：有目标就追踪，没有就沿着准星方向飞
        const bsp = 2300 * s;
        bolts.forEach(b => {
          b.life -= dt; b.tr.push({ x: b.x, y: b.y }); if (b.tr.length > 7) b.tr.shift();
          const tg = b.tg && !b.tg.dead && !b.tg.flee && (b.tg !== boss || (boss && !boss.dying)) ? b.tg : null;
          if (tg) { const dx = tg.x - b.x, dy = tg.y - b.y, l = Math.hypot(dx, dy) || 1; b.vx = dx / l; b.vy = dy / l;
            if (l < bsp * dt + (tg.r || 30 * s) * .5) {
              b.dead = true;
              if (tg === boss) hitBoss(.06, b.x, b.y);
              else if (bullets.includes(tg)) { tg.dead = true; explode(tg.x, tg.y); G.sfx('pop'); addScore(5, tg.x, tg.y, '#7ef9ff'); }
              else hitObj(tg, 1, 'bolt');
              burst(b.x, b.y, [b.col, '#fff'], 10, 260, { sz: 12, life: .35 }); return;
            }
          } else {
            const o = obs.find(o => !o.dead && !o.flee && (o.k !== 'ufo' || t >= o.born) && Math.hypot(o.x - b.x, o.y - b.y) < o.r + 8 * s);
            if (o) { b.dead = true; hitObj(o, 1, 'bolt'); burst(b.x, b.y, [b.col, '#fff'], 10, 260, { sz: 12, life: .35 }); return; }
          }
          b.x += b.vx * bsp * dt; b.y += b.vy * bsp * dt;
          if (b.life <= 0 || b.y < -40 || b.x < -40 || b.x > C.W + 40) b.dead = true;
        });
        for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].dead) bolts.splice(i, 1);

        // 能量波：推出后仍跟着双手扫射；答案飞碟有护罩（要用光弹认真选）
        beams.forEach(bm => {
          bm.t += dt; const p = ps[bm.i]; bm.x0 += (p.ax - bm.x0) * Math.min(1, dt * 8); bm.ax += (p.aimX - bm.ax) * Math.min(1, dt * 5);
          const k = beamK(bm), hw = bm.w * .5 * k;
          if (k < .2) return;
          obs.forEach(o => {
            if (o.dead || o.flee) return; const L = lineDist(bm, o.x, o.y); if (L.along < 0 || L.d > hw + o.r * .7) return;
            if (o.k === 'ufo') { if (o.sh <= 0) { G.sfx('tick'); } o.sh = .3; return; }
            hitObj(o, 9, 'beam');
          });
          bullets.forEach(b => { const L = lineDist(bm, b.x, b.y); if (!b.dead && L.along > 0 && L.d < hw + b.r) { b.dead = true; explode(b.x, b.y); } });
          if (boss && !boss.dying && !bm.hitBoss) { const L = lineDist(bm, boss.x, boss.y); if (L.along > 0 && L.d < hw + boss.w * .32) { bm.hitBoss = true; hitBoss(1, boss.x + (bm.ax - boss.x) * .2, boss.y + boss.w * .05, true); } }
          if (Math.random() < .7) { const L = Math.random(), px = U.lerp(bm.x0, bm.ax, L), py = U.lerp(bm.y0, -60, L); burst(px + U.rand(-hw, hw), py, bm.i ? ['#ffe28a', '#fff'] : ['#7ef9ff', '#fff'], 1, 120, { sz: 12, life: .4 }); }
        });
        for (let i = beams.length - 1; i >= 0; i--) if (beams[i].t >= beams[i].dur) beams.splice(i, 1);

        // 合体能量波：彩虹冲击环从星球扩散到全屏，清掉所有怪
        if (rainbow) {
          rainbow.t += dt; rainbow.r = rainbow.t * 1500 * s;
          obs.forEach(o => { if (!o.dead && !o.flee && o.k !== 'ufo' && Math.hypot(o.x - P.cx, o.y - P.top) < rainbow.r) hitObj(o, 9, 'beam'); });
          bullets.forEach(b => { if (Math.hypot(b.x - P.cx, b.y - P.top) < rainbow.r) { b.dead = true; explode(b.x, b.y); } });
          if (boss && !boss.dying && !rainbow.hitBoss && Math.hypot(boss.x - P.cx, boss.y - P.top) < rainbow.r) { rainbow.hitBoss = true; hitBoss(1, boss.x, boss.y, true); }
          if (rainbow.t > 1.4) rainbow = null;
        }

        // 粒子等
        parts.forEach(p => { p.vy += p.g * dt; p.vx *= .985; p.vy *= .985; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
        for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
        rings.forEach(r => { r.life -= dt; r.r = r.r1 * (1 - Math.pow(r.life / r.max, 2)); }); for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1);
        texts.forEach(tx => { tx.life -= dt0; tx.y -= 50 * s * dt0; }); for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1);
        scorch.forEach(c => c.life -= dt0); for (let i = scorch.length - 1; i >= 0; i--) if (scorch[i].life <= 0) scorch.splice(i, 1);
        meteorsBg.forEach(m => m.life -= dt0); for (let i = meteorsBg.length - 1; i >= 0; i--) if (meteorsBg[i].life <= 0) meteorsBg.splice(i, 1);
        shieldT = Math.max(0, shieldT - dt0); shake = Math.max(0, shake - dt0 * 2.2); flash = Math.max(0, flash - dt0 * 2); hurtV = Math.max(0, hurtV - dt0 * 1.6);

        draw(t, dt0);
      });

      /* ================= 画 ================= */
      function draw(t) {
        x.save();
        if (shake) x.translate(U.rand(-1, 1) * shake * 14 * s, U.rand(-1, 1) * shake * 14 * s);
        x.drawImage(bg, -20, -20, C.W + 40, C.H + 40);
        // 视差星空（向下流动 = 星球在宇宙里前进）
        x.fillStyle = '#fff';
        stars.forEach(st0 => {
          const y = ((st0.y * C.H + t * SPD[st0.z] * s) % C.H), sz = (st0.z + 1) * .9 * s;
          x.globalAlpha = .35 + .5 * Math.abs(Math.sin(t * st0.tw + st0.ph)) * (st0.z === 2 ? 1 : .7);
          x.fillRect(st0.x * C.W, y, sz, sz * (st0.z === 2 ? 2.4 : 1));
        });
        x.globalAlpha = 1;
        // 流星
        meteorsBg.forEach(m => { const k = 1 - m.life / .9, hx = m.x - k * 300 * s, hy = m.y + k * 150 * s; const g = x.createLinearGradient(hx, hy, hx + 90 * s, hy - 45 * s); g.addColorStop(0, 'rgba(255,255,255,' + m.life + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.strokeStyle = g; x.lineWidth = 2 * s; x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx + 90 * s, hy - 45 * s); x.stroke(); });

        if (boss) drawBoss(t);
        obs.forEach(o => drawObj(o, t));
        bullets.forEach(b => { x.globalCompositeOperation = 'lighter'; const r = b.r * (1 + Math.sin(t * 12 + b.ph) * .15); x.drawImage(glow('#ff5d9e'), b.x - r * 2.4, b.y - r * 2.4, r * 4.8, r * 4.8); x.globalCompositeOperation = 'source-over'; x.fillStyle = '#fff'; x.beginPath(); x.arc(b.x, b.y, r * .45, 0, 7); x.fill(); });

        // 星球
        x.drawImage(pl, 0, 0, C.W, C.H);
        scorch.forEach(c => { const sy = surfY(c.x), a = c.life / 1.4; x.globalCompositeOperation = 'lighter'; x.globalAlpha = a; x.drawImage(glow('#ff6b3b'), c.x - 80 * s, sy - 50 * s, 160 * s, 100 * s); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; });
        if (shieldT > 0) drawShield(t);
        ps.forEach(p => drawHero(p, t));
        // 光弹
        x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
        bolts.forEach(b => {
          for (let i = 1; i < b.tr.length; i++) { const k = i / b.tr.length; x.strokeStyle = b.col; x.globalAlpha = k * .8; x.lineWidth = (4 + 10 * k) * s; x.beginPath(); x.moveTo(b.tr[i - 1].x, b.tr[i - 1].y); x.lineTo(b.tr[i].x, b.tr[i].y); x.stroke(); }
          x.globalAlpha = 1; x.drawImage(glow(b.col), b.x - 26 * s, b.y - 26 * s, 52 * s, 52 * s);
        });
        x.globalAlpha = 1;
        beams.forEach(bm => drawBeam(bm, t));
        if (rainbow) drawRainbow();
        // 粒子
        parts.forEach(p => {
          const a = Math.min(1, p.life / p.max * 1.6);
          if (p.t === 'd') { x.globalCompositeOperation = 'source-over'; x.globalAlpha = a; x.fillStyle = p.col; x.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); x.globalCompositeOperation = 'lighter'; return; }
          x.globalAlpha = a; const im = p.t === 's' ? starSpr(p.col) : glow(p.col), z = p.sz * (p.t === 's' ? 1 : 1.6);
          x.drawImage(im, p.x - z / 2, p.y - z / 2, z, z);
        });
        rings.forEach(r => { x.globalAlpha = r.life / r.max; x.strokeStyle = r.col; x.lineWidth = r.w * (r.life / r.max) + 1; x.beginPath(); x.arc(r.x, r.y, r.r, 0, 7); x.stroke(); });
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        // 飘字
        x.textAlign = 'center'; x.textBaseline = 'middle';
        texts.forEach(tx => { x.globalAlpha = Math.min(1, tx.life * 1.5); x.font = '900 ' + tx.sz * s * (1 + (1 - tx.life) * .3) + 'px ' + U.FONT; x.lineWidth = 5 * s; x.strokeStyle = 'rgba(20,10,50,.8)'; x.strokeText(tx.t, tx.x, tx.y); x.fillStyle = tx.col; x.fillText(tx.t, tx.x, tx.y); });
        x.globalAlpha = 1;
        ps.forEach(p => drawAim(p, t));
        drawHud(t);
        if (hurtV) { const g = x.createRadialGradient(C.W / 2, C.H / 2, C.H * .35, C.W / 2, C.H / 2, C.W * .7); g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, 'rgba(255,40,60,' + hurtV * .5 + ')'); x.fillStyle = g; x.fillRect(0, 0, C.W, C.H); }
        if (flash) { x.fillStyle = 'rgba(255,255,255,' + flash * .7 + ')'; x.fillRect(0, 0, C.W, C.H); }
        x.restore();
      }

      function drawObj(o, t) {
        if (o.k === 'ufo') return drawUfo(o, t);
        x.save();
        if (o.flee) x.globalAlpha = .5;
        if (o.k === 'rock') {
          // 火焰拖尾
          x.globalCompositeOperation = 'lighter'; const l = Math.hypot(o.vx, o.vy) || 1, ux = -o.vx / l, uy = -o.vy / l;
          for (let i = 6; i >= 0; i--) { const d = i * o.r * .45, z = o.r * (2.6 - i * .28); x.globalAlpha = .55 - i * .06; x.drawImage(glow(i < 2 ? '#ffd166' : i < 4 ? '#ff9f1a' : '#ff4d3b'), o.x + ux * d - z / 2, o.y + uy * d - z / 2, z, z); }
          x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
          x.translate(o.x, o.y); x.rotate(o.rot);
          if (ok(IM.rock)) x.drawImage(IM.rock, -o.r, -o.r, o.r * 2, o.r * 2); else { x.fillStyle = '#7a5a48'; x.beginPath(); x.arc(0, 0, o.r, 0, 7); x.fill(); }
          if (o.big) { x.strokeStyle = '#ff9f1a'; x.lineWidth = 3 * s; x.globalAlpha = .6 + Math.sin(t * 10) * .3; x.beginPath(); x.arc(0, 0, o.r * 1.05, 0, 7); x.stroke(); }
        } else if (o.k === 'imp' || o.k === 'gold') {
          const gc = o.k === 'imp' ? '#c77dff' : '#ffd166', im = o.k === 'imp' ? IM.imp : IM.ufo, r = o.r * (1 + Math.sin(t * 8 + o.ph) * .06);
          x.globalCompositeOperation = 'lighter'; x.globalAlpha = .7; x.drawImage(glow(gc), o.x - r * 2, o.y - r * 2, r * 4, r * 4); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
          x.translate(o.x, o.y + Math.sin(t * 6 + o.ph) * 4 * s); x.rotate(Math.sin(t * 5 + o.ph) * .2);
          if (ok(im)) x.drawImage(im, -r, -r, r * 2, r * 2);
        }
        if (o.hurt > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = o.hurt / .15; x.drawImage(glow('#ffffff'), -o.r * 1.4, -o.r * 1.4, o.r * 2.8, o.r * 2.8); }
        x.restore();
      }
      function drawUfo(o, t) {
        if (t < o.born) return;
        const age = t - o.born, k = Math.min(1, age / .4), e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2), r = o.r * e;
        x.save(); if (o.flee) x.globalAlpha = .6;
        const ly = o.y + r * .95, lab = M.Q.label(o.label);
        // 牵引光束：从飞碟照到答案牌
        x.globalCompositeOperation = 'lighter';
        const g = x.createLinearGradient(0, o.y, 0, ly + 20 * s); g.addColorStop(0, o.col + '88'); g.addColorStop(1, o.col + '00');
        x.fillStyle = g; x.beginPath(); x.moveTo(o.x - r * .3, o.y + r * .2); x.lineTo(o.x + r * .3, o.y + r * .2); x.lineTo(o.x + r * .9, ly + 20 * s); x.lineTo(o.x - r * .9, ly + 20 * s); x.fill();
        x.globalAlpha = (o.flee ? .3 : .55) + Math.sin(t * 4 + o.ph) * .15; x.drawImage(glow(o.col), o.x - r * 1.8, o.y - r * 1.5, r * 3.6, r * 3);
        x.globalAlpha = o.flee ? .6 : 1; x.globalCompositeOperation = 'source-over';
        x.save(); x.translate(o.x, o.y); x.rotate(Math.sin(t * 2 + o.ph) * .1);
        if (ok(IM.ufo)) x.drawImage(IM.ufo, -r, -r, r * 2, r * 2);
        // 飞碟边缘的跑马灯
        for (let i = 0; i < 6; i++) { const a = Math.PI * (.15 + .7 * i / 5), on = Math.floor(t * 8 + i) % 3 === 0; x.fillStyle = on ? '#fff' : o.col; x.beginPath(); x.arc(Math.cos(a) * r * .78, r * .18 + Math.sin(a) * r * .12, (on ? 4 : 2.6) * s, 0, 7); x.fill(); }
        x.restore();
        // 答案牌
        if (k > .5) {
          const fs = (lab.length > 3 ? 28 : 36) * s; x.font = '900 ' + fs + 'px ' + U.FONT;
          const w = Math.max(76 * s, (o.label.t ? x.measureText(lab).width : 40 * s) + 34 * s), h = 52 * s, bx = o.x - w / 2;
          x.globalCompositeOperation = 'lighter'; x.globalAlpha = .45; x.drawImage(glow(o.col), bx - 20 * s, ly - 20 * s, w + 40 * s, h + 40 * s); x.globalCompositeOperation = 'source-over'; x.globalAlpha = o.flee ? .6 : 1;
          x.fillStyle = 'rgba(14,10,46,.88)'; x.strokeStyle = o.col; x.lineWidth = 4 * s; x.beginPath(); x.roundRect(bx, ly, w, h, 16 * s); x.fill(); x.stroke();
          if (o.label.t) { x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lab, o.x, ly + h / 2 + 2 * s); }
          else { const im = U.emoImg(o.label.e); if (ok(im)) x.drawImage(im, o.x - 20 * s, ly + 6 * s, 40 * s, 40 * s); }
        }
        // 被能量波扫到：答案飞碟的护罩闪一下
        if (o.sh > 0) { x.strokeStyle = '#bff'; x.globalAlpha = o.sh / .3; x.lineWidth = 3 * s; x.beginPath(); x.arc(o.x, o.y + r * .4, r * 1.4, 0, 7); x.stroke(); }
        if (o.hurt > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = o.hurt / .15; x.drawImage(glow('#ffffff'), o.x - r * 1.4, o.y - r * 1.4, r * 2.8, r * 2.8); }
        x.restore();
      }
      function drawBoss(t) {
        const B = boss, w = B.w, h = w * .3;
        x.save(); x.translate(B.x, B.y + Math.sin(t * 1.3) * 6 * s);
        if (B.dying) x.rotate(Math.sin(t * 30) * .03);
        // 底部光核与气场
        x.globalCompositeOperation = 'lighter'; x.globalAlpha = .6 + Math.sin(t * 5) * .2; x.drawImage(glow('#ff5d9e'), -w * .7, -h * 1.2, w * 1.4, h * 2.6);
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        // 玻璃罩 + 外星人
        const dg = x.createRadialGradient(-w * .06, -h * .55, 4, 0, -h * .35, w * .2); dg.addColorStop(0, 'rgba(200,255,255,.9)'); dg.addColorStop(1, 'rgba(80,140,255,.35)');
        x.fillStyle = dg; x.beginPath(); x.ellipse(0, -h * .3, w * .2, h * .75, 0, Math.PI, 0); x.fill();
        if (ok(IM.alien)) x.drawImage(IM.alien, -w * .09, -h * .95, w * .18, w * .18);
        // 船身
        const hg = x.createLinearGradient(0, -h * .4, 0, h * .5); hg.addColorStop(0, '#c9c3ff'); hg.addColorStop(.45, '#6b5bd6'); hg.addColorStop(1, '#2a1f6e');
        x.fillStyle = hg; x.beginPath(); x.ellipse(0, 0, w * .5, h * .42, 0, 0, 7); x.fill();
        x.fillStyle = '#3b2c99'; x.beginPath(); x.ellipse(0, h * .14, w * .34, h * .26, 0, 0, Math.PI); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2 * s; x.beginPath(); x.ellipse(0, -h * .05, w * .46, h * .28, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
        // 跑马灯
        for (let i = 0; i < 14; i++) { const a = Math.PI * (.08 + .84 * i / 13), on = Math.floor(t * 10 - i) % 4 === 0; const lx = -Math.cos(a) * w * .44, ly = Math.sin(a) * h * .22; x.fillStyle = on ? '#fff' : RAINBOW[i % 7]; x.beginPath(); x.arc(lx, ly, (on ? 6 : 4) * s, 0, 7); x.fill(); }
        // 炮口
        x.globalCompositeOperation = 'lighter'; const cr = (18 + Math.sin(t * 8) * 4) * s * (B.shootT < .5 ? 1.6 : 1); x.drawImage(glow('#ff5d9e'), -cr * 1.5, h * .3 - cr * 1.5, cr * 3, cr * 3);
        if (B.hurt > 0) { x.globalAlpha = Math.min(1, B.hurt * 3); x.drawImage(glow('#ffffff'), -w * .6, -h * 1.1, w * 1.2, h * 2.2); }
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        x.restore();
        // 血条：3 格
        if (!B.dying) {
          const bw = 64 * s, gap = 8 * s, tot = bw * 3 + gap * 2, bx = B.x - tot / 2, by = B.y + h * .78;
          x.font = '900 ' + 18 * s + 'px ' + U.FONT; x.textAlign = 'center'; x.fillStyle = '#ffb3d1'; x.fillText('外星母舰', B.x, by + 32 * s);
          for (let i = 0; i < 3; i++) { const f = U.clamp(B.hp - i, 0, 1); x.fillStyle = 'rgba(20,10,50,.8)'; x.beginPath(); x.roundRect(bx + i * (bw + gap), by, bw, 14 * s, 7 * s); x.fill(); if (f > 0) { x.fillStyle = '#ff5d9e'; x.beginPath(); x.roundRect(bx + i * (bw + gap), by, bw * f, 14 * s, 7 * s); x.fill(); } }
        }
      }
      function drawShield(t) {
        const a = Math.min(1, shieldT / .4), r = P.R + 90 * s;
        x.save(); x.globalCompositeOperation = 'lighter';
        x.globalAlpha = .18 * a; x.strokeStyle = '#7ef9ff'; x.lineWidth = 70 * s; x.beginPath(); x.arc(P.cx, P.cy, r - 35 * s, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
        x.globalAlpha = (.7 + Math.sin(t * 14) * .2) * a; x.lineWidth = 5 * s; x.beginPath(); x.arc(P.cx, P.cy, r, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
        // 六边形光点在护罩上流动
        for (let i = 0; i < 28; i++) { const px = ((i / 28 + t * .05) % 1) * C.W, py = P.cy - Math.sqrt(Math.max(0, r * r - (px - P.cx) ** 2)); x.globalAlpha = a * (.4 + .4 * Math.sin(t * 6 + i)); x.drawImage(glow('#bff'), px - 12 * s, py - 12 * s, 24 * s, 24 * s); }
        x.restore();
      }
      function drawHero(p, t) {
        const sy = surfY(p.ax), ang = Math.asin((p.ax - P.cx) / P.R), hs = 78 * s, col = PCOL[p.i].glow;
        x.save(); x.translate(p.ax, sy); x.rotate(ang);
        x.globalCompositeOperation = 'lighter'; x.globalAlpha = .5 + p.ch * .5; x.drawImage(glow(col), -60 * s, -30 * s, 120 * s, 50 * s); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        x.globalAlpha = p.here ? 1 : .4;
        const bob = Math.sin(t * 4 + p.i) * 2 * s;
        if (ok(IM.hero)) x.drawImage(IM.hero, -hs / 2, -hs + bob, hs, hs); else { x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -hs / 2, hs / 3, 0, 7); x.fill(); }
        // 蓄力环
        if (p.ch > 0) { x.strokeStyle = p.full ? '#fff' : col; x.lineWidth = 6 * s; x.lineCap = 'round'; x.beginPath(); x.arc(0, -hs / 2, hs * .66, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.ch); x.stroke(); }
        if (duo) { x.font = '900 ' + 18 * s + 'px ' + U.FONT; x.textAlign = 'center'; x.fillStyle = col; x.fillText(PCOL[p.i].name, 0, -hs - 10 * s); }
        x.restore();
      }
      // 能量波：从小人身上射向双手方向的发光渐变柱
      function drawBeam(bm, t) {
        const k = beamK(bm); if (k <= 0) return;
        const dx = bm.ax - bm.x0, dy = -60 - bm.y0, L = Math.hypot(dx, dy) + 200, ang = Math.atan2(dy, dx) + Math.PI / 2;
        const w = bm.w * k * (1 + Math.sin(t * 50) * .06), c1 = bm.i ? '#ffd166' : '#4cc9ff', c2 = bm.i ? '#ff9f1a' : '#7c5cff';
        x.save(); x.translate(bm.x0, bm.y0); x.rotate(ang); x.globalCompositeOperation = 'lighter';
        const outer = x.createLinearGradient(-w * 1.2, 0, w * 1.2, 0); outer.addColorStop(0, c2 + '00'); outer.addColorStop(.5, c2 + '66'); outer.addColorStop(1, c2 + '00');
        x.fillStyle = outer; x.fillRect(-w * 1.2, -L, w * 2.4, L);
        const g = x.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, c1 + '00'); g.addColorStop(.25, c1 + 'cc'); g.addColorStop(.45, '#ffffff'); g.addColorStop(.55, '#ffffff'); g.addColorStop(.75, c1 + 'cc'); g.addColorStop(1, c1 + '00');
        x.fillStyle = g; x.fillRect(-w / 2, -L, w, L);
        // 沿着光柱往上跑的能量环
        x.strokeStyle = '#fff'; x.lineWidth = 3 * s;
        for (let i = 0; i < 6; i++) { const yy = -((t * 900 * s + i * L / 6) % L); x.globalAlpha = .5 * k; x.beginPath(); x.ellipse(0, yy, w * .62, w * .14, 0, 0, 7); x.stroke(); }
        x.globalAlpha = .9; const mz = w * .55; x.drawImage(glow('#ffffff'), -mz, -mz, mz * 2, mz * 2); x.globalAlpha = .6; x.drawImage(glow(c1), -mz * 1.6, -mz * 1.6, mz * 3.2, mz * 3.2);
        x.restore();
      }
      function drawRainbow() {
        const r = rainbow.r, a = Math.max(0, 1 - rainbow.t / 1.4);
        x.save(); x.globalCompositeOperation = 'lighter';
        RAINBOW.forEach((c, i) => { x.globalAlpha = a * .7; x.strokeStyle = c; x.lineWidth = 22 * s; x.beginPath(); x.arc(P.cx, P.top, Math.max(1, r - i * 22 * s), Math.PI, 0); x.stroke(); });
        x.globalAlpha = a * .25; x.fillStyle = '#fff'; x.beginPath(); x.arc(P.cx, P.top, r, Math.PI, 0); x.fill();
        x.restore();
      }
      // 准星 + 蓄力能量球
      function drawAim(p, t) {
        if (!p.here) return;
        const L = p.hand.L, R = p.hand.R;
        if (p.ch > 0 || p.hold > .18) {
          const bx = (L.x + R.x) / 2, by = (L.y + R.y) / 2, r = (16 + 50 * p.ch) * s * (1 + Math.sin(t * (p.full ? 24 : 12)) * .08), col = PCOL[p.i].glow;
          x.save(); x.globalCompositeOperation = 'lighter';
          x.drawImage(glow(col), bx - r * 2.6, by - r * 2.6, r * 5.2, r * 5.2); x.drawImage(glow('#ffffff'), bx - r, by - r, r * 2, r * 2);
          // 电光
          x.strokeStyle = '#e8ffff'; x.lineWidth = 2 * s; x.globalAlpha = .9;
          for (let i = 0; i < 3 + Math.floor(p.ch * 4); i++) { let a = Math.random() * 6.28, px = bx, py = by; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { a += U.rand(-.8, .8); px += Math.cos(a) * r * .45; py += Math.sin(a) * r * .45; x.lineTo(px, py); } x.stroke(); }
          x.restore();
          if (Math.random() < .6) { const a = Math.random() * 6.28, d = U.rand(90, 140) * s; parts.push({ x: bx + Math.cos(a) * d, y: by + Math.sin(a) * d, vx: -Math.cos(a) * d * 3, vy: -Math.sin(a) * d * 3, life: .3, max: .3, sz: 10 * s, col, g: 0, t: 'g' }); }
          if (p.full) { x.font = '900 ' + 30 * s + 'px ' + U.FONT; x.textAlign = 'center'; x.lineWidth = 6 * s; x.strokeStyle = 'rgba(20,10,50,.85)'; x.strokeText('推出去！', bx, by - r - 26 * s); x.fillStyle = '#fff'; x.fillText('推出去！', bx, by - r - 26 * s); }
          // 双人：两人都在蓄力时连一道彩虹线，提示一起推
          if (duo && p.i === 0 && ps[1] && ps[1].ch > .3 && p.ch > .3) {
            const o = ps[1], ox = (o.hand.L.x + o.hand.R.x) / 2, oy = (o.hand.L.y + o.hand.R.y) / 2, g = x.createLinearGradient(bx, by, ox, oy);
            RAINBOW.forEach((c, i) => g.addColorStop(i / 6, c)); x.save(); x.globalAlpha = .7; x.strokeStyle = g; x.lineWidth = 5 * s; x.setLineDash([14 * s, 10 * s]); x.lineDashOffset = -t * 80; x.beginPath(); x.moveTo(bx, by); x.lineTo(ox, oy); x.stroke(); x.restore();
            x.font = '900 ' + 28 * s + 'px ' + U.FONT; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('一起推出 = 合体能量波！', (bx + ox) / 2, (by + oy) / 2 - 24 * s);
          }
          return;
        }
        ['L', 'R'].forEach(sd => {
          const c = p.hand[sd]; if (!c.vis) return; const col = PCOL[p.i][sd], r = (24 + Math.sin(t * 5 + (sd === 'L' ? 0 : 1.5)) * 3) * s;
          const tg = targetNear(c.x, c.y, 150 * s);
          if (tg) { const tr = (tg.r || boss && tg === boss && 60 * s || 20 * s) * 1.25, tx = tg.x, ty = tg.y; x.strokeStyle = col; x.lineWidth = 3 * s; x.globalAlpha = .8; const q4 = tr * .4;
            [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { x.beginPath(); x.moveTo(tx + a * tr, ty + b * (tr - q4)); x.lineTo(tx + a * tr, ty + b * tr); x.lineTo(tx + a * (tr - q4), ty + b * tr); x.stroke(); }); x.globalAlpha = 1; }
          x.save(); x.translate(c.x, c.y);
          x.globalCompositeOperation = 'lighter'; x.globalAlpha = .5; x.drawImage(glow(col), -r * 1.6, -r * 1.6, r * 3.2, r * 3.2); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
          x.strokeStyle = col; x.lineWidth = 3.5 * s; x.lineCap = 'round';
          x.save(); x.rotate(t * 1.6 * (sd === 'L' ? 1 : -1)); for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(0, 0, r, i * Math.PI / 2 + .3, (i + 1) * Math.PI / 2 - .3); x.stroke(); } x.restore();
          x.strokeStyle = '#fff'; x.lineWidth = 2.5 * s; x.beginPath(); [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([a, b]) => { x.moveTo(a * r * .45, b * r * .45); x.lineTo(a * r * 1.25, b * r * 1.25); }); x.stroke();
          x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 3.5 * s, 0, 7); x.fill();
          x.restore();
        });
      }
      function drawHud(t) {
        // 底部：星球能量条 + 护盾状态
        const bw = Math.min(360 * s, C.W * .32), bh = 18 * s, bx = C.W / 2 - bw / 2, by = C.H - 44 * s;
        x.fillStyle = 'rgba(10,8,40,.7)'; x.beginPath(); x.roundRect(bx - 4 * s, by - 4 * s, bw + 8 * s, bh + 8 * s, 12 * s); x.fill();
        const f = en / 100, g = x.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, f < .3 ? '#ff5d73' : '#45e0b8'); g.addColorStop(1, f < .3 ? '#ff9f1a' : '#7ef9ff');
        x.fillStyle = g; x.beginPath(); x.roundRect(bx, by, Math.max(bh, bw * f), bh, 9 * s); x.fill();
        if (f < .3) { x.globalAlpha = .4 + Math.sin(t * 10) * .3; x.strokeStyle = '#ff5d73'; x.lineWidth = 3 * s; x.beginPath(); x.roundRect(bx - 4 * s, by - 4 * s, bw + 8 * s, bh + 8 * s, 12 * s); x.stroke(); x.globalAlpha = 1; }
        x.font = '900 ' + 15 * s + 'px ' + U.FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText('星球能量 ' + Math.round(en) + '%', C.W / 2, by + bh / 2 + 1 * s);
        // 护盾
        const sx = bx - 40 * s, syy = by + bh / 2, rd = G.t >= shieldReady, cr = 16 * s;
        x.fillStyle = 'rgba(10,8,40,.7)'; x.beginPath(); x.arc(sx, syy, cr + 5 * s, 0, 7); x.fill();
        x.strokeStyle = rd ? '#7ef9ff' : 'rgba(126,249,255,.35)'; x.lineWidth = 4 * s; x.beginPath(); x.arc(sx, syy, cr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (rd ? 1 : 1 - (shieldReady - G.t) / 4.5)); x.stroke();
        x.fillStyle = rd ? '#7ef9ff' : 'rgba(255,255,255,.4)'; x.font = '900 ' + 13 * s + 'px ' + U.FONT; x.fillText('盾', sx, syy + 1 * s);
        if (mode === 'quiz') { x.textAlign = 'left'; x.font = '900 ' + 18 * s + 'px ' + U.FONT; x.fillStyle = '#ffd166'; x.fillText('第 ' + Math.min(QN, Math.max(1, qIdx)) + ' / ' + QN + ' 题', bx + bw + 24 * s, syy); }
      }
    },
  });
})();
