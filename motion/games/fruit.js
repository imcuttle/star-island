/* 水果忍者（复刻）：挥手当刀，切开抛上来的水果，别碰炸弹
   · 经典：漏掉 3 个水果或切到炸弹就结束
   · 街机：60 秒，冰冻香蕉（慢动作）、狂热香蕉（水果雨）、双倍香蕉
   · 知识切切乐：顶部出题，带答案牌的水果一起抛上来，切开正确答案 */
(function () {
  const M = window.Motion, U = M.U;
  const FRUITS = [['🍉', '#ff4d5e', 1.25], ['🍊', '#ff9f1a', 1], ['🍎', '#ff3b3b', 1], ['🍍', '#ffd23f', 1.15], ['🥝', '#8bd346', .95], ['🍋', '#ffe14d', .95], ['🍑', '#ff9a8a', 1], ['🍐', '#c8e04a', 1], ['🥭', '#ffb52e', 1.05], ['🍇', '#9b59d0', 1], ['🍓', '#ff3355', .85], ['🥥', '#f4efe6', 1.05]];
  const SPECIAL = { freeze: ['🍌', '#7ef9ff', '冰冻'], frenzy: ['🍌', '#ffd166', '狂热'], double: ['🍌', '#ff9fe0', '双倍'] };

  M.game({
    id: 'fruit', name: '水果忍者', icon: '🍉', color: '#ff7a45', tag: '复刻', demo: 'slice',
    short: '挥手当刀切水果，别碰炸弹！', desc: '双手就是两把忍者刀，快速挥手切开飞上来的水果。知识模式里切开写着正确答案的水果！',
    origin: '致敬经典《水果忍者》：抛物线水果、切开分成两半、果汁溅到木板上、连切加分、炸弹、三次失误。',
    how: [['slice', '快速挥手就是出刀'], ['swipe', '一刀切多个有连切奖励'], ['idle', '看见炸弹手别碰']],
    modes: [{ id: 'quiz', name: '知识切切乐', icon: '🧠', desc: '切开正确答案' }, { id: 'classic', name: '经典', icon: '🍉', desc: '3 次失误结束' }, { id: 'arcade', name: '街机 60 秒', icon: '⏱️', desc: '特殊香蕉' }],
    qOpts: { maxLen: 5, maxCh: 3 },
    sayHow: '快速挥手就能切水果，小心炸弹哦',
    start(G) {
      const C = G.canvas(), x = C.ctx;
      const S = () => Math.min(C.W, C.H * 1.6) / 1100; // 尺寸基准
      const mode = G.mode, items = [], halves = [], drops = [], stains = [], blades = { L: [], R: [] }, texts = [];
      let misses = 0, lives = 3, slowT = 0, frenzyT = 0, doubleT = 0, timeLeft = mode === 'arcade' ? 60 : null, nextWave = 1, q = null, qWave = 0, qDone = 0, flash = 0, shake = 0;
      const QN = 10; let bladeCombo = { n: 0, t: 0, x: 0, y: 0 };
      if (mode === 'classic') G.hud.hearts(3, 3); if (mode === 'quiz') G.hud.hearts(lives, 3);
      // 木板背景（离屏画一次）
      const bg = document.createElement('canvas'); const drawBg = () => {
        bg.width = C.W; bg.height = C.H; const b = bg.getContext('2d'); const pw = Math.max(90, C.W / 9);
        for (let i = 0; i * pw < C.W; i++) {
          const g = b.createLinearGradient(i * pw, 0, (i + 1) * pw, 0); const base = 38 + (i % 3) * 6; g.addColorStop(0, 'hsl(28,45%,' + (base - 4) + '%)'); g.addColorStop(.5, 'hsl(30,48%,' + base + '%)'); g.addColorStop(1, 'hsl(26,42%,' + (base - 6) + '%)');
          b.fillStyle = g; b.fillRect(i * pw, 0, pw, C.H);
          b.strokeStyle = 'rgba(60,30,10,.25)'; b.lineWidth = 1.2;
          for (let k = 0; k < 9; k++) { b.beginPath(); const sx = i * pw + U.rand(8, pw - 8); b.moveTo(sx, 0); for (let y = 0; y < C.H; y += 40) b.lineTo(sx + Math.sin(y / 120 + k) * 6, y); b.stroke(); }
          b.fillStyle = 'rgba(20,8,0,.55)'; b.fillRect(i * pw - 2, 0, 4, C.H);
          [.25, .75].forEach(f => { b.fillStyle = 'rgba(40,20,5,.6)'; b.beginPath(); b.ellipse(i * pw + pw * f, C.H * U.rand(.2, .8), 10, 6, 0, 0, 7); b.fill(); });
        }
        const v = b.createRadialGradient(C.W / 2, C.H / 2, C.H * .3, C.W / 2, C.H / 2, C.W * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); b.fillStyle = v; b.fillRect(0, 0, C.W, C.H);
      };
      drawBg(); addEventListener('resize', drawBg);
      Core.Audio2.playMusic('race');

      function launch(kind, opt) {
        opt = opt || {}; const s = S();
        const f = kind === 'bomb' ? ['💣', '#333', 1] : kind === 'special' ? SPECIAL[opt.sp] : U.pick(FRUITS);
        const r = 62 * s * (f[2] || 1) * (opt.label ? 1.15 : 1);
        const x0 = opt.x != null ? opt.x : U.rand(C.W * .15, C.W * .85), tx = U.rand(C.W * .3, C.W * .7);
        const g = 1500 * s, peak = U.rand(C.H * .48, C.H * .72), vy = -Math.sqrt(2 * g * peak), tUp = -vy / g;
        items.push({ kind, sp: opt.sp, e: f[0], col: f[1], r, x: x0, y: C.H + r, vx: (tx - x0) / (tUp * 1.6), vy, g, rot: U.rand(0, 6), vr: U.rand(-3, 3), label: opt.label, ok: opt.ok, img: U.emoImg(f[0], '3d'), born: G.t });
      }
      function wave() {
        if (mode === 'quiz') {
          if (!q) { q = G.q(); G.ask(q); qWave = 0; }
          // 答案水果一起飞上来，间隔排开
          const n = q.ch.length; const xs = U.shuffle(Array.from({ length: n }, (_, i) => C.W * (.2 + .6 * (n === 1 ? .5 : i / (n - 1)))));
          q.ch.forEach((c, i) => setTimeout(() => !G.over && launch('fruit', { label: c, ok: c.ok, x: xs[i] }), i * 160));
          if (qWave++ > 0 && Math.random() < .5) launch('fruit');
          nextWave = G.t + 3.4;
          return;
        }
        const lvl = Math.min(1, G.t / 90), n = frenzyT > 0 ? 6 : 1 + Math.floor(Math.random() * (2 + lvl * 3));
        for (let i = 0; i < n; i++) setTimeout(() => !G.over && launch('fruit'), i * (frenzyT > 0 ? 90 : 220));
        if (Math.random() < .18 + lvl * .25 && frenzyT <= 0) setTimeout(() => !G.over && launch('bomb'), 300);
        if (mode === 'arcade' && Math.random() < .12) setTimeout(() => !G.over && launch('special', { sp: U.pick(Object.keys(SPECIAL)) }), 500);
        nextWave = G.t + (frenzyT > 0 ? .7 : U.rand(1.4, 2.4) - lvl * .5);
      }
      // 线段与圆相交
      const segHit = (ax, ay, bx, by, cx, cy, r) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; let t = ((cx - ax) * dx + (cy - ay) * dy) / l2; t = U.clamp(t, 0, 1); const px = ax + dx * t, py = ay + dy * t; return Math.hypot(px - cx, py - cy) < r; };
      function cut(it, ang, sd) {
        it.dead = true; const s = S();
        if (it.kind === 'bomb') {
          G.sfx('boom'); flash = 1; shake = 1;
          if (mode === 'classic') { setTimeout(() => G.end({ score: G.hud.scoreV, stars: G.hud.scoreV >= 120 ? 3 : G.hud.scoreV >= 60 ? 2 : G.hud.scoreV >= 20 ? 1 : 0, title: '砰！切到炸弹了' }), 900); }
          else if (mode === 'quiz') { lives--; G.hud.hearts(lives, 3); if (lives <= 0) setTimeout(finish, 900); }
          else G.hud.add(-10);
          G.pop('砰！', 'bad'); return;
        }
        // 两半
        [-1, 1].forEach(sg => halves.push({ img: it.img, e: it.e, x: it.x, y: it.y, r: it.r, ang, side: sg, vx: it.vx * .5 + Math.cos(ang + Math.PI / 2) * sg * 260 * s, vy: it.vy * .3 + Math.sin(ang + Math.PI / 2) * sg * 200 * s - 200 * s, g: it.g, rot: it.rot, vr: sg * U.rand(2, 5), life: 2.5 }));
        for (let i = 0; i < 18; i++) { const a = U.rand(0, 6.28), v = U.rand(120, 520) * s; drops.push({ x: it.x, y: it.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150 * s, r: U.rand(3, 9) * s, col: it.col, life: U.rand(.4, .9) }); }
        stains.push({ x: it.x, y: it.y, r: it.r * U.rand(.9, 1.2), col: it.col, life: 3.5, seed: Math.random() * 100, ang });
        G.sfx('slice'); G.sfx('splat', .7);
        // 连切
        if (G.t - bladeCombo.t < .3) bladeCombo.n++; else bladeCombo.n = 1; bladeCombo.t = G.t; bladeCombo.x = it.x; bladeCombo.y = it.y;
        const mul = doubleT > 0 ? 2 : 1;
        if (it.kind === 'special') { if (it.sp === 'freeze') slowT = 5; if (it.sp === 'frenzy') { frenzyT = 5; nextWave = G.t; } if (it.sp === 'double') doubleT = 8; G.pop(SPECIAL[it.sp][2] + '！', 'perfect'); G.sfx('magic'); return; }
        if (it.label) {
          if (it.ok) {
            G.hud.add(10 * mul); G.right(it.x, it.y); G.pop('答对！+10', 'perfect', it.x, it.y - it.r);
            G.hud.combo(G.hud.comboV + 1); texts.push({ t: '✔', x: it.x, y: it.y, life: 1, col: '#7bd389' });
            items.forEach(o => { if (o.label && !o.dead) { o.dead = true; o.fade = 1; halves.push({ img: o.img, e: o.e, x: o.x, y: o.y, r: o.r, ang: 0, side: 0, vx: 0, vy: 0, g: o.g * .3, rot: o.rot, vr: 0, life: .6, ghost: true }); } });
            q = null; qDone++; G.ask(null); if (qDone >= QN) setTimeout(finish, 900); else nextWave = G.t + 1.4;
          } else {
            G.wrong(); G.hud.combo(0); lives--; G.hud.hearts(lives, 3); G.pop('不对哦', 'bad', it.x, it.y - it.r); texts.push({ t: '✘', x: it.x, y: it.y, life: 1, col: '#ff5d73' });
            if (lives <= 0) setTimeout(finish, 900);
          }
          return;
        }
        G.hud.add(1 * mul);
        if (bladeCombo.n >= 3) { G.hud.add(bladeCombo.n * mul); G.pop(bladeCombo.n + ' 连切！+' + bladeCombo.n, 'combo', it.x, it.y - 40); G.sfx('combo'); }
      }
      function finish() { const sc = G.hud.scoreV; G.end(mode === 'quiz' ? { score: sc, correct: qDone, total: G.stats.total } : { score: sc, stars: sc >= 150 ? 3 : sc >= 80 ? 2 : sc >= 25 ? 1 : 0 }); }

      // 刀光：手速快时才是「刀」，慢时只显示一个小光点
      function bladeTick(dt) {
        const people = G.people();
        ['L', 'R'].forEach(sd => {
          const tr = blades[sd]; const p = people[0]; const h = p && p.body && p.body.hands[sd];
          if (h && h.visible) {
            const px = h.reach.x * C.W, py = h.reach.y * C.H, fast = h.speed > 2.2;
            tr.push({ x: px, y: py, t: G.t, fast });
            if (fast && tr.length > 1) {
              const a = tr[tr.length - 2], ang = Math.atan2(py - a.y, px - a.x);
              items.forEach(it => { if (!it.dead && it.y < C.H + it.r * .5 && segHit(a.x, a.y, px, py, it.x, it.y, it.r * .9)) cut(it, ang, sd); });
            }
          }
          while (tr.length && G.t - tr[0].t > .14) tr.shift();
        });
      }
      function drawBlade(tr, col) {
        // 去掉重复点（识别 30 帧、画面 60 帧），再画成由细到粗的发光刀痕
        const pts = []; tr.forEach(p => { const l = pts[pts.length - 1]; if (!l || Math.hypot(p.x - l.x, p.y - l.y) > 2) pts.push(p); });
        const last = pts[pts.length - 1]; if (!last) return;
        const fast = pts.filter(p => p.fast).length >= 2;
        if (!fast || pts.length < 2) { x.save(); x.fillStyle = col; x.globalAlpha = .55; x.shadowColor = col; x.shadowBlur = 14; x.beginPath(); x.arc(last.x, last.y, 11 * S(), 0, 7); x.fill(); x.restore(); return; }
        // 中点二次曲线平滑
        const sm = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; sm.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); } sm.push(last);
        x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
        [[col, 22, 26], ['#fff', 9, 0]].forEach(([c, w, blur]) => {
          x.strokeStyle = c; x.shadowColor = col; x.shadowBlur = blur;
          for (let i = 1; i < sm.length; i++) { const k = i / (sm.length - 1); x.globalAlpha = .25 + .75 * k; x.lineWidth = Math.max(1, w * k * S()); x.beginPath(); x.moveTo(sm[i - 1].x, sm[i - 1].y); x.lineTo(sm[i].x, sm[i].y); x.stroke(); }
        });
        x.restore();
      }
      const drawFruit = (it) => {
        x.save(); x.translate(it.x, it.y); x.rotate(it.rot);
        if (it.kind === 'special') { x.shadowColor = SPECIAL[it.sp][1]; x.shadowBlur = 30; }
        if (it.kind === 'bomb') { x.shadowColor = '#ff3b3b'; x.shadowBlur = 20 + Math.sin(G.t * 20) * 10; }
        if (it.img.complete && it.img.naturalWidth) x.drawImage(it.img, -it.r, -it.r, it.r * 2, it.r * 2); else { x.font = it.r * 1.6 + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.e, 0, 0); }
        x.restore();
        if (it.label) {
          // 答案牌：挂在水果下面的木牌
          const s = S(), t = M.Q.label(it.label), fs = (t.length > 3 ? 30 : 38) * s; x.save(); x.font = '700 ' + fs + 'px ' + U.FONT;
          const w = Math.max(70 * s, x.measureText(t).width + 30 * s), h = 52 * s, bx = it.x - w / 2, by = it.y + it.r * .75;
          x.fillStyle = '#fff6e0'; x.strokeStyle = '#7a4a1c'; x.lineWidth = 4 * s; x.beginPath(); x.roundRect(bx, by, w, h, 14 * s); x.fill(); x.stroke();
          if (it.label.t) { x.fillStyle = '#3b2410'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, it.x, by + h / 2 + 2 * s); }
          else { const im = U.emoImg(it.label.e); if (im.complete) x.drawImage(im, it.x - 20 * s, by + 6 * s, 40 * s, 40 * s); }
          x.restore();
        }
      };

      G.loop(dt0 => {
        if (timeLeft != null) { timeLeft -= dt0; G.hud.timer(timeLeft); if (timeLeft <= 0) { timeLeft = null; finish(); return; } }
        const k = slowT > 0 ? .35 : 1, dt = dt0 * k;
        slowT = Math.max(0, slowT - dt0); frenzyT = Math.max(0, frenzyT - dt0); doubleT = Math.max(0, doubleT - dt0);
        if (G.t >= nextWave && !(mode === 'quiz' && items.some(i => i.label && !i.dead))) wave();
        bladeTick(dt);
        items.forEach(it => { it.vy += it.g * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
          if (!it.dead && it.vy > 0 && it.y > C.H + it.r * 1.2) { it.dead = true;
            if (it.kind === 'fruit' && !it.label && mode === 'classic') { misses++; G.hud.hearts(3 - misses, 3); G.sfx('miss'); texts.push({ t: '✘', x: it.x, y: C.H - 60, life: 1.2, col: '#ff5d73' }); if (misses >= 3) setTimeout(finish, 500); }
            if (it.label && it.ok && mode === 'quiz') { nextWave = G.t + .5; G.pop('正确答案掉下去啦，再来！', 'miss'); }
          } });
        for (let i = items.length - 1; i >= 0; i--) if (items[i].dead && !items[i].fade) items.splice(i, 1);
        halves.forEach(hf => { hf.vy += hf.g * dt; hf.x += hf.vx * dt; hf.y += hf.vy * dt; hf.rot += hf.vr * dt; hf.life -= dt; });
        for (let i = halves.length - 1; i >= 0; i--) if (halves[i].life <= 0 || halves[i].y > C.H + 300) halves.splice(i, 1);
        drops.forEach(d => { d.vy += 900 * S() * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }); for (let i = drops.length - 1; i >= 0; i--) if (drops[i].life <= 0) drops.splice(i, 1);
        stains.forEach(s => s.life -= dt0); for (let i = stains.length - 1; i >= 0; i--) if (stains[i].life <= 0) stains.splice(i, 1);
        texts.forEach(t => { t.life -= dt0; t.y -= 40 * dt0; }); for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1);
        flash = Math.max(0, flash - dt0 * 1.6); shake = Math.max(0, shake - dt0 * 2);

        // ---- 画 ----
        x.save(); if (shake) x.translate(U.rand(-1, 1) * shake * 18, U.rand(-1, 1) * shake * 18);
        x.drawImage(bg, 0, 0, C.W, C.H);
        // 果汁印
        stains.forEach(s => { x.save(); x.globalAlpha = Math.min(1, s.life / 1.5) * .5; x.fillStyle = s.col; x.translate(s.x, s.y); for (let i = 0; i < 9; i++) { const a = s.seed + i * 2.4, d = s.r * (i ? .35 + .45 * Math.abs(Math.sin(s.seed * 3 + i)) : 0), rr = s.r * (i ? .14 + .16 * Math.abs(Math.cos(s.seed + i * 1.3)) : .42); x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, 7); x.fill(); } x.restore(); });
        // 半个水果：按切线裁剪
        halves.forEach(hf => {
          x.save(); x.globalAlpha = Math.min(1, hf.life / .5) * (hf.ghost ? .5 : 1); x.translate(hf.x, hf.y); x.rotate(hf.rot);
          if (hf.side) { x.beginPath(); const a = hf.ang - hf.rot + (hf.side > 0 ? 0 : Math.PI); x.arc(0, 0, hf.r * 1.2, a, a + Math.PI); x.closePath(); x.clip(); }
          if (hf.img.complete && hf.img.naturalWidth) x.drawImage(hf.img, -hf.r, -hf.r, hf.r * 2, hf.r * 2);
          x.restore();
        });
        items.forEach(it => !it.dead && drawFruit(it));
        drops.forEach(d => { x.globalAlpha = Math.min(1, d.life * 2); x.fillStyle = d.col; x.beginPath(); x.arc(d.x, d.y, d.r, 0, 7); x.fill(); }); x.globalAlpha = 1;
        texts.forEach(t => { x.save(); x.globalAlpha = Math.min(1, t.life); x.fillStyle = t.col; x.font = '900 ' + 64 * S() + 'px ' + U.FONT; x.textAlign = 'center'; x.fillText(t.t, t.x, t.y); x.restore(); });
        drawBlade(blades.L, '#ff5d9e'); drawBlade(blades.R, '#4cc9ff');
        if (slowT > 0) { x.fillStyle = 'rgba(126,249,255,.12)'; x.fillRect(0, 0, C.W, C.H); }
        if (frenzyT > 0) { x.fillStyle = 'rgba(255,209,102,.08)'; x.fillRect(0, 0, C.W, C.H); }
        if (flash) { x.fillStyle = 'rgba(255,255,255,' + flash + ')'; x.fillRect(0, 0, C.W, C.H); }
        x.restore();
      });
      G.onDispose(() => removeEventListener('resize', drawBg));
    },
  });
})();
