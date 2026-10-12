/* 动态火柴人示范：在 <canvas data-move="jump"> 里循环播放动作，教小朋友「怎么动」
   姿势用 8 段肢体的方向角描述（0° 向右、90° 向下，画面是镜子视角：玩家的左手在画面左边），关键帧之间缓动插值
   也给墙洞游戏画目标剪影：Puppet.drawPose(ctx, angles, opts) */
(function () {
  const M = window.Motion, U = M.U;
  const LEN = { lUA: 15, lFA: 14, rUA: 15, rFA: 14, lTh: 19, lSh: 19, rTh: 19, rSh: 19 };
  const BASE = { lUA: 105, lFA: 95, rUA: 75, rFA: 85, lTh: 95, lSh: 91, rTh: 85, rSh: 89 };
  const up = (l, r) => ({ lUA: l, lFA: l, rUA: r, rFA: r });
  const P = M.Puppet = { BASE, LEN };

  // 动作库：关键帧 [时长秒, 角度覆盖, 额外{dy 身体上下, dx 左右, sl 肢体缩短（出拳朝镜头）, fist 拳头放大, fx 特效}]
  const MOVES = P.MOVES = {
    idle: [[.9, {}, { dy: 0 }], [.9, { lUA: 100, rUA: 80 }, { dy: .6 }]],
    jump: [[.35, {}, {}], [.25, { lTh: 115, lSh: 70, rTh: 65, rSh: 110 }, { dy: 6 }], [.28, up(-120, -60), { dy: -16, fx: 'up' }], [.28, up(-125, -55), { dy: -14 }], [.25, {}, { dy: 0 }], [.4, {}, {}]],
    squat: [[.4, {}, {}], [.4, { lTh: 140, lSh: 70, rTh: 40, rSh: 110, lUA: 160, lFA: 175, rUA: 20, rFA: 5 }, { dy: 16, fx: 'down' }], [.6, { lTh: 140, lSh: 70, rTh: 40, rSh: 110, lUA: 160, lFA: 175, rUA: 20, rFA: 5 }, { dy: 16 }], [.4, {}, {}]],
    punchR: [[.35, { rUA: 110, rFA: -120 }, {}], [.14, { rUA: 50, rFA: 50 }, { sl: { rUA: .55, rFA: .45 }, fist: 'R', fx: 'pow' }], [.35, { rUA: 50, rFA: 50 }, { sl: { rUA: .55, rFA: .45 }, fist: 'R' }], [.3, { rUA: 110, rFA: -120 }, {}]],
    punchL: [[.35, { lUA: 70, lFA: -60 }, {}], [.14, { lUA: 130, lFA: 130 }, { sl: { lUA: .55, lFA: .45 }, fist: 'L', fx: 'pow' }], [.35, { lUA: 130, lFA: 130 }, { sl: { lUA: .55, lFA: .45 }, fist: 'L' }], [.3, { lUA: 70, lFA: -60 }, {}]],
    punch: [[.3, { rUA: 110, rFA: -120, lUA: 70, lFA: -60 }, {}], [.12, { rUA: 50, rFA: 50, lUA: 70, lFA: -60 }, { sl: { rUA: .55, rFA: .45 }, fist: 'R', fx: 'pow' }], [.3, { rUA: 110, rFA: -120, lUA: 70, lFA: -60 }, {}], [.12, { lUA: 130, lFA: 130, rUA: 110, rFA: -120 }, { sl: { lUA: .55, lFA: .45 }, fist: 'L', fx: 'pow' }], [.3, { rUA: 110, rFA: -120, lUA: 70, lFA: -60 }, {}]],
    stepL: [[.5, {}, { dx: 0 }], [.4, { lTh: 115, rTh: 95 }, { dx: -16, fx: 'left' }], [.6, {}, { dx: -16 }], [.4, {}, { dx: 0 }]],
    stepR: [[.5, {}, { dx: 0 }], [.4, { rTh: 65, lTh: 85 }, { dx: 16, fx: 'right' }], [.6, {}, { dx: 16 }], [.4, {}, { dx: 0 }]],
    lanes: [[.5, {}, { dx: 0 }], [.35, { lTh: 112 }, { dx: -16, fx: 'left' }], [.5, {}, { dx: -16 }], [.35, {}, { dx: 0 }], [.3, {}, { dx: 0 }], [.35, { rTh: 68 }, { dx: 16, fx: 'right' }], [.5, {}, { dx: 16 }], [.35, {}, { dx: 0 }]],
    handsUp: [[.5, {}, {}], [.4, up(-115, -65), { fx: 'up' }], [.8, up(-112, -68), {}], [.4, {}, {}]],
    wave: [[.25, { rUA: -40, rFA: -100 }, {}], [.25, { rUA: -40, rFA: -60 }, {}], [.25, { rUA: -40, rFA: -100 }, {}], [.25, { rUA: -40, rFA: -60 }, {}], [.5, {}, {}]],
    clap: [[.3, { lUA: 150, lFA: 170, rUA: 30, rFA: 10 }, {}], [.12, { lUA: 120, lFA: 10, rUA: 60, rFA: 170 }, { fx: 'clap' }], [.3, { lUA: 150, lFA: 170, rUA: 30, rFA: 10 }, {}], [.12, { lUA: 120, lFA: 10, rUA: 60, rFA: 170 }, { fx: 'clap' }], [.4, {}, {}]],
    run: [[.2, { lTh: 140, lSh: 95, lUA: 60, lFA: -40, rUA: 100, rFA: 120 }, { dy: -1 }], [.2, { rTh: 40, rSh: 85, rUA: 120, rFA: -140, lUA: 80, lFA: 60 }, { dy: -1 }]],
    tpose: [[.5, {}, {}], [.4, up(180, 0), {}], [.8, up(180, 0), {}], [.4, {}, {}]],
    slice: [[.3, { rUA: -50, rFA: -40 }, {}], [.16, { rUA: 120, rFA: 140 }, { fx: 'slash' }], [.3, { rUA: 110, rFA: 120 }, {}], [.3, { lUA: -130, lFA: -140 }, {}], [.16, { lUA: 60, lFA: 40 }, { fx: 'slashL' }], [.3, {}, {}]],
    swipeU: [[.35, { rUA: 70, rFA: 80 }, {}], [.15, { rUA: -70, rFA: -80 }, { fx: 'up' }], [.4, { rUA: -70, rFA: -80 }, {}], [.3, {}, {}]],
    swipeD: [[.35, { rUA: -70, rFA: -80 }, {}], [.15, { rUA: 70, rFA: 85 }, { fx: 'down' }], [.4, {}, {}], [.3, {}, {}]],
    swipeL: [[.35, { rUA: 10, rFA: 0 }, {}], [.15, { rUA: 150, rFA: 170 }, { fx: 'left' }], [.4, { rUA: 150, rFA: 170 }, {}], [.3, {}, {}]],
    swipeR: [[.35, { lUA: 170, lFA: 180 }, {}], [.15, { lUA: 20, lFA: 10 }, { fx: 'right' }], [.4, { lUA: 20, lFA: 10 }, {}], [.3, {}, {}]],
    swipe: [[.3, { rUA: -60, rFA: -70 }, {}], [.14, { rUA: 75, rFA: 85 }, { fx: 'down' }], [.3, {}, {}], [.3, { lUA: 170, lFA: 180 }, {}], [.14, { lUA: 20, lFA: 10 }, { fx: 'right' }], [.3, {}, {}]],
    dance: [[.25, up(-130, 60), { dx: -3 }], [.25, up(120, -50), { dx: 3 }], [.25, up(180, 0), { dy: 2 }], [.25, up(-110, -70), { dy: -2 }]],
    push: [[.5, { lUA: 120, lFA: 20, rUA: 60, rFA: 160 }, { dy: 2, fx: 'charge' }], [.15, { lUA: 115, lFA: 115, rUA: 65, rFA: 65 }, { sl: { lUA: .5, lFA: .4, rUA: .5, rFA: .4 }, fist: 'LR', fx: 'beam' }], [.5, { lUA: 115, lFA: 115, rUA: 65, rFA: 65 }, { sl: { lUA: .5, lFA: .4, rUA: .5, rFA: .4 }, fist: 'LR' }], [.4, {}, {}]],
    point: [[.6, { rUA: -20, rFA: -60 }, { fx: 'draw' }], [.6, { rUA: -5, rFA: -20 }, { fx: 'draw' }], [.6, { rUA: 10, rFA: -50 }, { fx: 'draw' }], [.4, { rUA: -20, rFA: -60 }, {}]],
    armsX: [[.5, {}, {}], [.4, { lUA: 60, lFA: -30, rUA: 120, rFA: -150 }, {}], [.8, { lUA: 60, lFA: -30, rUA: 120, rFA: -150 }, { fx: 'pause' }], [.4, {}, {}]],
    head: [[.5, {}, {}], [.4, { lUA: -150, lFA: -20, rUA: -30, rFA: -160 }, {}], [.8, { lUA: -150, lFA: -20, rUA: -30, rFA: -160 }, {}], [.4, {}, {}]],
    hips: [[.5, {}, {}], [.4, { lUA: 140, lFA: 40, rUA: 40, rFA: 140 }, {}], [.8, { lUA: 140, lFA: 40, rUA: 40, rFA: 140 }, {}], [.4, {}, {}]],
    oneLeg: [[.5, {}, {}], [.4, { rTh: 20, rSh: 100, lUA: 180, lFA: 180, rUA: 0, rFA: 0 }, {}], [1, { rTh: 20, rSh: 100, lUA: 180, lFA: 180, rUA: 0, rFA: 0 }, {}], [.4, {}, {}]],
    shout: [[.5, {}, { fx: 'mic' }], [.5, { lUA: 150, lFA: -150, rUA: 30, rFA: -30 }, { fx: 'mic' }], [.5, {}, {}]],
    raiseL: [[.5, {}, {}], [.4, { lUA: -115, lFA: -110 }, {}], [.8, { lUA: -115, lFA: -110 }, {}], [.4, {}, {}]],
    raiseR: [[.5, {}, {}], [.4, { rUA: -65, rFA: -70 }, {}], [.8, { rUA: -65, rFA: -70 }, {}], [.4, {}, {}]],
    cursor: [[.5, { rUA: 20, rFA: -60 }, { fx: 'cursor' }], [.6, { rUA: 0, rFA: -40 }, { fx: 'cursor' }], [.6, { rUA: 30, rFA: -80 }, { fx: 'cursor' }]],
  };

  // 角度 → 关节坐标（100 × 110 的盒子，脚踩在 y=104）
  P.joints = function (a, o) {
    o = o || {}; const sl = o.sl || {}, dx = o.dx || 0, dy = o.dy || 0;
    const nk = [50 + dx, 30 + dy], ls = [41 + dx, 33 + dy], rs = [59 + dx, 33 + dy], lh = [45 + dx, 62 + dy], rh = [55 + dx, 62 + dy];
    const seg = (from, k) => { const ang = (a[k] == null ? BASE[k] : a[k]) * Math.PI / 180, L = LEN[k] * (sl[k] || 1); return [from[0] + Math.cos(ang) * L, from[1] + Math.sin(ang) * L]; };
    const le = seg(ls, 'lUA'), lw = seg(le, 'lFA'), re = seg(rs, 'rUA'), rw = seg(re, 'rFA');
    const lk = seg(lh, 'lTh'), la = seg(lk, 'lSh'), rk = seg(rh, 'rTh'), ra = seg(rk, 'rSh');
    return { hd: [50 + dx, 19 + dy], nk, ls, rs, le, lw, re, rw, lh, rh, lk, la, rk, ra };
  };
  // 画一个姿势。o：{ x, y, s 缩放, color, lw, glow, fist, alpha, fill（剪影描粗） }
  P.drawPose = function (ctx, a, o) {
    o = o || {}; const J = P.joints(a, o), s = o.s || 1, ox = o.x || 0, oy = o.y || 0;
    const X = p => ox + p[0] * s, Y = p => oy + p[1] * s;
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = o.color || '#fff'; ctx.fillStyle = o.color || '#fff'; ctx.lineWidth = (o.lw || 4.2) * s;
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || '#fff'; ctx.shadowBlur = o.glow * s; }
    const line = (...pts) => { ctx.beginPath(); ctx.moveTo(X(pts[0]), Y(pts[0])); pts.slice(1).forEach(p => ctx.lineTo(X(p), Y(p))); ctx.stroke(); };
    // 躯干：肩 - 髋梯形
    if (o.fill) { ctx.beginPath(); ctx.moveTo(X(J.ls), Y(J.ls)); ctx.lineTo(X(J.rs), Y(J.rs)); ctx.lineTo(X(J.rh), Y(J.rh)); ctx.lineTo(X(J.lh), Y(J.lh)); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { line(J.nk, [(J.lh[0] + J.rh[0]) / 2, J.lh[1]]); line(J.ls, J.rs); line(J.lh, J.rh); }
    line(J.ls, J.le, J.lw); line(J.rs, J.re, J.rw); line(J.lh, J.lk, J.la); line(J.rh, J.rk, J.ra);
    ctx.beginPath(); ctx.arc(X(J.hd), Y(J.hd), 8 * s, 0, 7); if (o.fill) ctx.fill(); else { ctx.lineWidth = 3.6 * s; ctx.stroke(); }
    const fist = o.fist || '';
    [['L', J.lw, o.lColor || '#ff5d73'], ['R', J.rw, o.rColor || '#4cc9ff']].forEach(([k, p, c]) => { ctx.fillStyle = o.handColor || c; ctx.beginPath(); ctx.arc(X(p), Y(p), (fist.includes(k) ? 6.5 : 3.6) * s, 0, 7); ctx.fill(); });
    ctx.restore();
    return J;
  };
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  // 某一时刻的姿势
  P.sample = function (name, time) {
    const ks = MOVES[name] || MOVES.idle, total = ks.reduce((s, k) => s + k[0], 0);
    let t = time % total, i = 0; while (t > ks[i][0] && i < ks.length - 1) { t -= ks[i][0]; i++; }
    const a = ks[(i - 1 + ks.length) % ks.length], b = ks[i], k = ease(Math.min(1, t / b[0]));
    const ang = {}; for (const key in BASE) { const va = a[1][key] == null ? BASE[key] : a[1][key], vb = b[1][key] == null ? BASE[key] : b[1][key]; let d = vb - va; if (d > 180) d -= 360; if (d < -180) d += 360; ang[key] = va + d * k; }
    const ea = a[2] || {}, eb = b[2] || {}, sl = {};
    for (const key in LEN) { const x = (ea.sl && ea.sl[key]) || 1, y = (eb.sl && eb.sl[key]) || 1; sl[key] = x + (y - x) * k; }
    return { a: ang, dy: (ea.dy || 0) + ((eb.dy || 0) - (ea.dy || 0)) * k, dx: (ea.dx || 0) + ((eb.dx || 0) - (ea.dx || 0)) * k, sl, fist: k > .4 ? eb.fist : ea.fist, fx: eb.fx, fxk: k };
  };
  // 特效：箭头、冲击、拍手星星、光束
  function fx(ctx, f, k, J, s) {
    if (!f) return; ctx.save(); const al = Math.sin(Math.min(1, k) * Math.PI); ctx.globalAlpha = .4 + al * .6;
    const arrow = (x, y, ang) => { ctx.save(); ctx.translate(x * s, y * s); ctx.rotate(ang); ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(10 * s, 0); ctx.lineTo(-4 * s, -8 * s); ctx.lineTo(-4 * s, 8 * s); ctx.closePath(); ctx.fill(); ctx.fillRect(-12 * s, -3 * s, 9 * s, 6 * s); ctx.restore(); };
    if (f === 'up') arrow(86, 30 - k * 10, -Math.PI / 2);
    if (f === 'down') arrow(86, 60 + k * 10, Math.PI / 2);
    if (f === 'left') arrow(14 - k * 6, 50, Math.PI);
    if (f === 'right') arrow(86 + k * 6, 50, 0);
    if (f === 'pow' || f === 'beam') { ctx.fillStyle = f === 'beam' ? '#7ef9ff' : '#ffd166'; ctx.font = 'bold ' + 14 * s + 'px ' + U.FONT; ctx.textAlign = 'center'; ctx.fillText(f === 'beam' ? '波!' : 'POW', 50 * s, 12 * s); }
    if (f === 'clap') { ctx.fillStyle = '#ffd166'; for (let i = 0; i < 6; i++) { const an = i / 6 * 6.28; ctx.beginPath(); ctx.arc((50 + Math.cos(an) * 14 * k) * s, (44 + Math.sin(an) * 14 * k) * s, 2 * s, 0, 7); ctx.fill(); } }
    if (f === 'slash' || f === 'slashL') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * s; ctx.beginPath(); if (f === 'slash') { ctx.moveTo(90 * s, 10 * s); ctx.lineTo((90 - 60 * k) * s, (10 + 70 * k) * s); } else { ctx.moveTo(10 * s, 10 * s); ctx.lineTo((10 + 60 * k) * s, (10 + 70 * k) * s); } ctx.stroke(); }
    if (f === 'charge') { ctx.strokeStyle = '#7ef9ff'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(50 * s, 52 * s, (4 + 6 * k) * s, 0, 7); ctx.stroke(); }
    if (f === 'mic') { ctx.fillStyle = '#ffd166'; ctx.font = 'bold ' + 12 * s + 'px ' + U.FONT; ctx.fillText('哇!', 64 * s, 14 * s); [0, 1, 2].forEach(i => { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(50 * s, 22 * s, (12 + i * 5 + k * 4) * s, -.5, .5); ctx.stroke(); }); }
    if (f === 'pause') { ctx.fillStyle = '#ffd166'; ctx.fillRect(80 * s, 10 * s, 4 * s, 14 * s); ctx.fillRect(88 * s, 10 * s, 4 * s, 14 * s); }
    if (f === 'draw') { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.arc(J.rw[0] * s, J.rw[1] * s, 3 * s, 0, 7); ctx.stroke(); }
    if (f === 'cursor') { ctx.strokeStyle = '#7ef9ff'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(J.rw[0] * s, J.rw[1] * s, 6 * s, -1.57, -1.57 + 6.28 * k); ctx.stroke(); }
    ctx.restore();
  }
  P.frame = function (ctx, name, time, o) {
    o = o || {}; const W = ctx.canvas.width, H = ctx.canvas.height, s = Math.min(W / 100, H / 110);
    ctx.clearRect(0, 0, W, H);
    const st = P.sample(name, time);
    ctx.save(); ctx.translate((W - 100 * s) / 2, (H - 110 * s) / 2);
    // 地面影子
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse((50 + st.dx) * s, 105 * s, 18 * s * (1 - Math.max(0, -st.dy) / 40), 3 * s, 0, 0, 7); ctx.fill();
    const J = P.drawPose(ctx, st.a, { s, dx: st.dx, dy: st.dy, sl: st.sl, fist: st.fist, color: o.color || '#ffffff', glow: o.glow == null ? 6 : o.glow, glowColor: o.glowColor || '#7ef9ff' });
    fx(ctx, st.fx, st.fxk, J, s);
    ctx.restore();
  };
  // 让容器里所有 canvas[data-move] 动起来；返回停止函数
  P.mountAll = function (root) {
    const cvs = [...root.querySelectorAll('canvas[data-move]')]; if (!cvs.length) return () => {};
    cvs.forEach(c => { const r = c.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1); c.width = Math.max(60, (r.width || 100) * d); c.height = Math.max(66, (r.height || 110) * d); c._t0 = Math.random() * .3; });
    let last = 0, vis = 0;
    const lp = M.loop((dt, t) => {
      if (t - last < 32) return; last = t; // 示范动画 30 帧就够
      const check = t - vis > 400; if (check) vis = t; // 可见性每 0.4 秒查一次
      cvs.forEach(c => { if (!c.isConnected) return; if (check) c._vis = U.visible(c); if (!c._vis) return; const x = c.getContext('2d'); P.frame(x, c.dataset.move, t / 1000 + c._t0, { color: c.dataset.color, glowColor: c.dataset.glow }); });
      if (!cvs.some(c => c.isConnected)) lp.stop();
    });
    return () => lp.stop();
  };
})();
