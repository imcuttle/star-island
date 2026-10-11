/* 手绘风场景绘制：墨线抖动描边 + 水彩晕染 + 排线阴影（P3 式冷蓝色调）
   画出可横向滚动的多层视差背景：天空 / 远景 / 主景（含可互动地点）/ 前景 */
(function () {
  const S = {};
  // 可复现随机
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  S.rng = rng;

  function Pen(ctx, seed, o) {
    o = o || {};
    const r = rng(seed || 7), ink = o.ink || '#0b1638', J = o.jitter == null ? 1.6 : o.jitter;
    const P = {
      ctx, r, ink,
      j: (k) => (r() - .5) * 2 * J * (k || 1),
      line(x1, y1, x2, y2, w, col, passes) {
        ctx.save(); ctx.strokeStyle = col || ink; ctx.lineCap = 'round';
        const len = Math.hypot(x2 - x1, y2 - y1), n = passes || 2;
        for (let p = 0; p < n; p++) {
          ctx.lineWidth = (w || 2) * (p ? .55 : 1) * (.85 + r() * .3); ctx.globalAlpha = p ? .55 : .95;
          const bx = (r() - .5) * len * .025, by = (r() - .5) * len * .025;
          ctx.beginPath(); ctx.moveTo(x1 + P.j(), y1 + P.j());
          ctx.quadraticCurveTo((x1 + x2) / 2 + bx + P.j(), (y1 + y2) / 2 + by + P.j(), x2 + P.j(), y2 + P.j()); ctx.stroke();
        }
        ctx.restore();
      },
      path(pts, closed, w, col) { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; P.line(a[0], a[1], b[0], b[1], w, col); } },
      // 水彩填充：底色 + 若干晕染斑 + 边缘加深
      wash(pts, col, o2) {
        o2 = o2 || {}; ctx.save(); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0] + P.j(.6), p[1] + P.j(.6)) : ctx.moveTo(p[0], p[1])); ctx.closePath();
        ctx.fillStyle = col; ctx.globalAlpha = o2.a == null ? .95 : o2.a; ctx.fill(); ctx.clip();
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const w = x1 - x0, hh = y1 - y0, n = Math.min(14, 3 + Math.round(w * hh / 9000));
        for (let i = 0; i < n; i++) {
          const cx = x0 + r() * w, cy = y0 + r() * hh, rr = 10 + r() * Math.max(w, hh) * .35;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr); const dark = r() < .5;
          g.addColorStop(0, dark ? 'rgba(10,20,60,.10)' : 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
        }
        if (o2.shade !== false) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(8,16,50,.22)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, hh); }
        if (o2.hatch) P.hatch(x0, y0, w, hh, o2.hatch);
        ctx.restore();
        if (o2.line !== false) P.path(pts, true, o2.lw || 2.2, o2.lc);
      },
      hatch(x, y, w, hh, a) { ctx.save(); ctx.strokeStyle = ink; ctx.globalAlpha = a || .12; ctx.lineWidth = 1; for (let k = -hh; k < w; k += 7 + r() * 3) { ctx.beginPath(); ctx.moveTo(x + k + P.j(), y + hh + P.j()); ctx.lineTo(x + k + hh * .6 + P.j(), y + P.j()); ctx.stroke(); } ctx.restore(); },
      rect(x, y, w, hh, col, o2) { P.wash([[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]], col, o2); },
      circle(cx, cy, rr, col, o2) { const pts = []; const n = Math.max(12, Math.round(rr / 2)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } P.wash(pts, col, o2); },
      ellipse(cx, cy, rx, ry, col, o2) { const pts = []; const n = 22; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } P.wash(pts, col, o2); },
      text(t, x, y, size, col, o2) { o2 = o2 || {}; ctx.save(); ctx.font = (o2.weight || '') + ' ' + size + 'px ' + (o2.font || "'ZK','Hand','PingFang SC',sans-serif"); ctx.textAlign = o2.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col || ink; if (o2.rot) { ctx.translate(x, y); ctx.rotate(o2.rot); x = 0; y = 0; } if (o2.glow) { ctx.shadowColor = o2.glow; ctx.shadowBlur = size * .6; } ctx.fillText(t, x, y); ctx.restore(); },
      glow(cx, cy, rr, col, a) { ctx.save(); const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = a == null ? .6 : a; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); ctx.restore(); },
    };
    return P;
  }
  S.Pen = Pen;

  /* ---------- 调色板 ---------- */
  const PAL = {
    town: { sky: ['#0f2a6b', '#2f6fc4', '#9fd8ff'], moon: '#fff7d6', far: '#244e9a', far2: '#3a6fbf', ground: '#1d3f7d', road: '#294f8f', wall: ['#e9f1ff', '#bcd4f5', '#9ec0ee', '#ffe9c8', '#d6e6ff'], roof: ['#1f4fa8', '#e2556b', '#2a9bd8', '#3e5fb8'], win: '#ffd98a', tree: '#2a7fa0', accent: '#4fd2ff' },
    city: { sky: ['#050d2e', '#14307a', '#3d7fd6'], moon: '#f2fbff', far: '#11265e', far2: '#1b3c86', ground: '#0d1d4a', road: '#16295c', wall: ['#2a4a9a', '#335bb3', '#1f3d85', '#3d6cc8', '#27448f'], roof: ['#0f2363', '#183072'], win: '#8fe6ff', tree: '#1e5f8a', accent: '#3fd0ff', neon: ['#3fd0ff', '#ff5fa8', '#ffe35f', '#7dff9a'] },
    forest: { sky: ['#071d3a', '#11507a', '#5ec3c8'], moon: '#fbffe8', far: '#0f3f5e', far2: '#16597a', ground: '#0f3a4e', road: '#1d5468', wall: ['#d8efe8', '#bfe3d8'], roof: ['#1d6f7a', '#2f8f7f'], win: '#ffe08a', tree: '#1b6f72', accent: '#8fffc8' },
    beach: { sky: ['#1a2f7a', '#5b7fe0', '#ffc1a6'], moon: '#fff4e0', far: '#3b5fb8', far2: '#5a86d8', ground: '#e8d4b0', road: '#d8c098', wall: ['#ffffff', '#ffe2e8', '#dff2ff'], roof: ['#3a8ff0', '#ff7a8a', '#3fc1c9'], win: '#ffe7a8', tree: '#2a9f8a', accent: '#5fe0ff', sea: ['#2a5fc8', '#5fb8f0'] },
    tower: { sky: ['#020a06', '#0d3b22', '#56c07a'], moon: '#f6ffd0', far: '#0a2a1a', far2: '#12402a', ground: '#06150e', road: '#0d2a1c', wall: ['#163a2a', '#1d4a36'], roof: ['#0a2016'], win: '#d8ff8a', tree: '#0f3a26', accent: '#b6ff6a' },
  };
  S.PAL = PAL;

  /* ---------- 元件 ---------- */
  function sky(P, w, hh, pal, o) {
    const c = P.ctx, g = c.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, pal.sky[0]); g.addColorStop(.6, pal.sky[1]); g.addColorStop(1, pal.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, w, hh);
    // 水彩云层
    for (let i = 0; i < 26; i++) { const x = P.r() * w, y = P.r() * hh * .55, rx = 60 + P.r() * 220, ry = 10 + P.r() * 26; c.save(); c.globalAlpha = .08 + P.r() * .08; c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    // 星星
    for (let i = 0; i < (o.stars || 0); i++) { const x = P.r() * w, y = P.r() * hh * .6, s = P.r() * 1.8 + .4; c.fillStyle = 'rgba(255,255,255,' + (.4 + P.r() * .6) + ')'; c.fillRect(x, y, s, s); if (P.r() < .08) { P.line(x - 5, y, x + 5, y, 1, '#fff', 1); P.line(x, y - 5, x, y + 5, 1, '#fff', 1); } }
    // 大月亮（P3 标志性的满月）
    if (o.moon) {
      const [mx, my, mr] = o.moon; P.glow(mx, my, mr * 3.2, pal.moon, .35); P.glow(mx, my, mr * 1.7, pal.moon, .5);
      c.save(); c.fillStyle = pal.moon; c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
      c.globalAlpha = .12; c.fillStyle = '#7a8fb8'; [[-.3, -.2, .22], [.25, .1, .16], [-.05, .35, .12], [.35, -.35, .09]].forEach(([dx, dy, rr]) => { c.beginPath(); c.arc(mx + dx * mr, my + dy * mr, rr * mr, 0, Math.PI * 2); c.fill(); }); c.restore();
      P.ctx.save(); P.ctx.globalAlpha = .5; const pp = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; pp.push([mx + Math.cos(a) * mr, my + Math.sin(a) * mr]); } P.path(pp, true, 1.4, '#ffffff'); P.ctx.restore();
    }
  }
  function hills(P, w, y, hh, col, n, lw) {
    const pts = [[0, y + hh]]; for (let i = 0; i <= n; i++) pts.push([i / n * w, y + (P.r() * .8 + .2) * hh * (i % 2 ? .4 : 1) * .7]); pts.push([w, y + hh]);
    P.wash(pts, col, { lw: lw || 1.6, a: .95 });
  }
  function skyline(P, x0, x1, base, pal, o) {
    o = o || {}; let x = x0;
    while (x < x1) {
      const bw = 40 + P.r() * (o.wide || 90), bh = (o.min || 60) + P.r() * (o.max || 220), col = o.col || pal.far2;
      P.rect(x, base - bh, bw, bh, col, { lw: 1.4, a: .96, hatch: o.hatch });
      if (o.wins) { P.ctx.save(); for (let wy = base - bh + 10; wy < base - 8; wy += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 11) if (P.r() < o.wins) { P.ctx.fillStyle = pal.win; P.ctx.globalAlpha = .55 + P.r() * .45; P.ctx.fillRect(wx, wy, 5, 7); } P.ctx.restore(); }
      if (o.antenna && P.r() < .3) P.line(x + bw / 2, base - bh, x + bw / 2, base - bh - 26, 1.4);
      x += bw + (o.gap || 0) + P.r() * 6;
    }
  }
  function house(P, x, base, w, hh, pal, o) {
    o = o || {}; const wall = o.wall || pal.wall[(P.r() * pal.wall.length) | 0], roof = o.roof || pal.roof[(P.r() * pal.roof.length) | 0];
    P.rect(x, base - hh, w, hh, wall, { hatch: .06 });
    // 屋顶
    const rh = o.flat ? 14 : hh * .38; if (o.flat) P.rect(x - 8, base - hh - rh, w + 16, rh, roof); else P.wash([[x - 14, base - hh], [x + w / 2, base - hh - rh], [x + w + 14, base - hh]], roof, { hatch: .1 });
    // 窗
    const rows = Math.max(1, Math.floor((hh - 50) / 52)), cols = Math.max(1, Math.floor(w / 58));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const wx = x + (c + .5) * w / cols - 15, wy = base - hh + 18 + r * 52; P.rect(wx, wy, 30, 30, P.r() < .7 ? pal.win : '#5e7fb8', { lw: 1.6, shade: false }); P.line(wx + 15, wy, wx + 15, wy + 30, 1.1); P.line(wx, wy + 15, wx + 30, wy + 15, 1.1); if (P.r() < .6) P.glow(wx + 15, wy + 15, 34, pal.win, .25); }
    // 门
    if (!o.noDoor) { const dx = x + w * (o.doorX || .5) - 15; P.rect(dx, base - 50, 30, 50, o.door || '#3a5fae', { lw: 2 }); P.ctx.fillStyle = '#ffe08a'; P.ctx.fillRect(dx + 23, base - 26, 3, 3); }
    // 招牌
    if (o.sign) { const sw = Math.max(70, o.sign.length * 26 + 20); P.rect(x + w / 2 - sw / 2, base - hh - (o.flat ? 52 : 8) - (o.flat ? 0 : 0), sw, 34, o.signCol || '#0a3d91', { lw: 2, shade: false }); P.text(o.sign, x + w / 2, base - hh - (o.flat ? 35 : -9), 22, '#ffffff'); }
    // 遮阳棚
    if (o.awning) { const ac = o.awning; for (let i = 0; i < 6; i++) P.wash([[x + i * w / 6, base - 70], [x + (i + 1) * w / 6, base - 70], [x + (i + 1) * w / 6, base - 54], [x + (i + .5) * w / 6, base - 48], [x + i * w / 6, base - 54]], i % 2 ? '#ffffff' : ac, { lw: 1.4, shade: false }); }
  }
  function tree(P, x, base, s, col, kind) {
    s = s || 1; P.rect(x - 5 * s, base - 46 * s, 10 * s, 46 * s, '#5a4a6a', { lw: 1.6 });
    if (kind === 'pine') { for (let i = 0; i < 3; i++) P.wash([[x - (34 - i * 8) * s, base - (40 + i * 26) * s], [x, base - (86 + i * 26) * s], [x + (34 - i * 8) * s, base - (40 + i * 26) * s]], col, { hatch: .12 }); return; }
    if (kind === 'palm') { P.line(x, base, x + 8 * s, base - 90 * s, 7 * s, '#7a5a4a'); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .55; P.wash([[x + 8 * s, base - 90 * s], [x + 8 * s + Math.cos(a - .15) * 54 * s, base - 90 * s + Math.sin(a - .15) * 30 * s + 18 * s], [x + 8 * s + Math.cos(a) * 64 * s, base - 90 * s + Math.sin(a) * 34 * s + 26 * s]], col, { lw: 1.4 }); } return; }
    [[0, -70, 34], [-22, -54, 24], [22, -56, 26], [0, -92, 24]].forEach(([dx, dy, r]) => P.circle(x + dx * s, base + dy * s, r * s, col, { hatch: .1, lw: 1.8 }));
  }
  function lamp(P, x, base, pal, s) { s = s || 1; P.line(x, base, x, base - 120 * s, 3.4 * s); P.line(x, base - 120 * s, x + 18 * s, base - 126 * s, 2.4 * s); P.rect(x + 12 * s, base - 128 * s, 16 * s, 10 * s, '#e8f4ff', { lw: 1.6, shade: false }); P.glow(x + 20 * s, base - 116 * s, 70 * s, pal.win, .45); }
  function fence(P, x0, x1, base, col) { P.line(x0, base - 24, x1, base - 24, 2); P.line(x0, base - 12, x1, base - 12, 2); for (let x = x0; x <= x1; x += 22) P.rect(x - 3, base - 34, 6, 34, col || '#e8f0ff', { lw: 1.4, shade: false }); }
  function bench(P, x, base) { P.rect(x - 40, base - 30, 80, 8, '#c98a5a', { lw: 1.8, shade: false }); P.rect(x - 40, base - 50, 80, 7, '#c98a5a', { lw: 1.6, shade: false }); P.line(x - 34, base - 22, x - 34, base, 2.2); P.line(x + 34, base - 22, x + 34, base, 2.2); }
  function fountain(P, x, base, pal) { P.ellipse(x, base - 12, 80, 18, '#9ec8f0'); P.rect(x - 10, base - 70, 20, 58, '#dbe8ff'); P.ellipse(x, base - 70, 34, 9, '#9ec8f0'); for (let i = -2; i <= 2; i++) P.line(x, base - 92, x + i * 22, base - 66, 1.6, '#e8fbff', 1); P.glow(x, base - 60, 90, pal.accent, .22); }
  function vending(P, x, base, pal) { P.rect(x - 28, base - 110, 56, 110, '#e2405a', { lw: 2.2 }); P.rect(x - 22, base - 100, 44, 52, '#cfefff', { lw: 1.6, shade: false }); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { P.ctx.fillStyle = ['#ffd23f', '#3fd0ff', '#7bd389', '#ff9f43'][(r + c) % 4]; P.ctx.fillRect(x - 19 + c * 10, base - 96 + r * 16, 7, 12); } P.rect(x - 16, base - 36, 32, 14, '#202848', { lw: 1.4, shade: false }); P.glow(x, base - 70, 80, '#cfefff', .3); }
  function car(P, x, base, col) { P.wash([[x - 60, base - 14], [x - 56, base - 38], [x - 30, base - 40], [x - 18, base - 62], [x + 28, base - 62], [x + 44, base - 40], [x + 62, base - 34], [x + 62, base - 14]], col, { lw: 2 }); P.rect(x - 12, base - 58, 18, 18, '#cfefff', { lw: 1.2, shade: false }); P.rect(x + 10, base - 58, 18, 18, '#cfefff', { lw: 1.2, shade: false }); P.circle(x - 34, base - 12, 12, '#1a2448'); P.circle(x + 36, base - 12, 12, '#1a2448'); }
  function stall(P, x, base, col, label) { P.rect(x - 50, base - 60, 100, 60, '#f3e6d0', { hatch: .06 }); for (let i = 0; i < 5; i++) P.wash([[x - 60 + i * 24, base - 100], [x - 36 + i * 24, base - 100], [x - 36 + i * 24, base - 82], [x - 48 + i * 24, base - 76], [x - 60 + i * 24, base - 82]], i % 2 ? '#fff' : col, { lw: 1.3, shade: false }); P.line(x - 56, base - 100, x - 56, base, 2.4); P.line(x + 56, base - 100, x + 56, base, 2.4); if (label) P.text(label, x, base - 34, 20, '#0b1638'); }
  function shrine(P, x, base, pal) { const red = '#e0455a'; P.rect(x - 70, base - 150, 12, 150, red); P.rect(x + 58, base - 150, 12, 150, red); P.rect(x - 92, base - 168, 184, 16, red); P.rect(x - 80, base - 136, 160, 10, red); P.glow(x, base - 80, 120, pal.accent, .15); }
  function tartarus(P, x, base, pal) {
    // 层层盘旋的高塔（剪影 + 发光窗）
    let y = base, w = 260;
    for (let i = 0; i < 9; i++) { const hh = 70 - i * 3; P.wash([[x - w / 2, y], [x - w / 2 + 10, y - hh], [x + w / 2 - 10, y - hh], [x + w / 2, y]], i % 2 ? pal.wall[0] : pal.wall[1], { lw: 1.8, hatch: .15 }); for (let k = 0; k < 6; k++) if (P.r() < .7) { P.ctx.fillStyle = pal.win; P.ctx.globalAlpha = .8; P.ctx.fillRect(x - w / 2 + 20 + k * (w - 40) / 6, y - hh / 2 - 5, 8, 12); P.ctx.globalAlpha = 1; } y -= hh; w *= .86; }
    P.wash([[x - w / 2, y], [x, y - 120], [x + w / 2, y]], pal.wall[1], { lw: 2 }); P.glow(x, y - 60, 160, pal.accent, .25);
  }
  function lighthouse(P, x, base) { P.wash([[x - 34, base], [x - 22, base - 200], [x + 22, base - 200], [x + 34, base]], '#ffffff', { hatch: .06 }); [60, 130].forEach(y => P.wash([[x - 32 + y * .06, base - y], [x + 32 - y * .06, base - y], [x + 30 - (y + 26) * .06, base - y - 26], [x - 30 + (y + 26) * .06, base - y - 26]], '#e2405a', { lw: 1.4, shade: false })); P.rect(x - 26, base - 236, 52, 36, '#ffe9a8'); P.wash([[x - 32, base - 236], [x, base - 262], [x + 32, base - 236]], '#e2405a'); P.glow(x, base - 218, 160, '#fff2b0', .45); }
  function sea(P, w, top, base, pal) { const c = P.ctx, g = c.createLinearGradient(0, top, 0, base); g.addColorStop(0, pal.sea[0]); g.addColorStop(1, pal.sea[1]); c.fillStyle = g; c.fillRect(0, top, w, base - top); for (let i = 0; i < 90; i++) { const x = P.r() * w, y = top + P.r() * (base - top), l = 20 + P.r() * 60; P.line(x, y, x + l, y + P.j(.4), 1.2, 'rgba(255,255,255,.55)', 1); } }
  const LIB = { house, tree, lamp, fence, bench, fountain, vending, car, stall, shrine, tartarus, lighthouse };
  S.LIB = LIB;

  /* ---------- 场景定义：x 为 0..1（主景宽度比例） ---------- */
  // spots：可互动地点（id、名字、图标、x、动作类型）
  S.SCENES = {
    town: {
      n: '星星小镇', e: '🏘️', len: 3.2, lv: 1, music: 'town', moon: true, stars: 60,
      spots: [
        { id: 'bakery', n: '面包房', e: '🥐', x: .08, act: 'shop', item: ['🥐', '可颂面包', 8, 18, 6] },
        { id: 'fountain', n: '许愿喷泉', e: '⛲', x: .22, act: 'wish' },
        { id: 'bench', n: '长椅', e: '🪑', x: .33, act: 'sit' },
        { id: 'library', n: '小镇图书馆', e: '📚', x: .45, act: 'quiz', npc: '图书馆阿姨', npcE: '👩‍🏫' },
        { id: 'flower', n: '花坛', e: '🌷', x: .57, act: 'find' },
        { id: 'vending', n: '自动贩卖机', e: '🥤', x: .68, act: 'shop', item: ['🧃', '果汁', 6, 10, 12] },
        { id: 'cat', n: '橘猫', e: '🐈', x: .79, act: 'pet' },
        { id: 'post', n: '邮局', e: '📮', x: .9, act: 'quiz', npc: '邮递员', npcE: '🧑‍✈️' },
      ],
      paint(P, W, H, pal, layer) {
        if (layer === 'far') { hills(P, W, H * .42, H * .25, pal.far, 10, 1.2); skyline(P, 0, W, H * .66, pal, { col: pal.far2, min: 40, max: 120, wins: .25 }); return; }
        if (layer === 'mid') {
          const g = H * .8; P.rect(-10, g, W + 20, H - g + 10, pal.ground, { lw: 2, hatch: .08 }); P.rect(-10, g + 18, W + 20, 26, pal.road, { lw: 1.4, shade: false });
          house(P, W * .03, g, 200, 170, pal, { sign: '面包房', awning: '#e2556b', roof: '#e2556b' }); tree(P, W * .15, g, 1.1, pal.tree);
          fountain(P, W * .22, g, pal); lamp(P, W * .28, g, pal); bench(P, W * .33, g); tree(P, W * .37, g, .9, pal.tree);
          house(P, W * .41, g, 240, 230, pal, { sign: '图书馆', flat: true, wall: '#e9f1ff', roof: '#1f4fa8' }); fence(P, W * .53, W * .61, g);
          for (let i = 0; i < 9; i++) P.circle(W * .54 + i * 26, g - 40 - (i % 3) * 6, 9, ['#ff7a9a', '#ffd23f', '#ffffff'][i % 3], { lw: 1.2, shade: false });
          house(P, W * .62, g, 150, 140, pal, { roof: '#2a9bd8' }); vending(P, W * .68, g, pal); lamp(P, W * .72, g, pal);
          house(P, W * .74, g, 180, 160, pal, { noDoor: false }); P.rect(W * .79 - 30, g - 70, 60, 12, '#ffd28a', { lw: 1.4 });
          house(P, W * .85, g, 210, 180, pal, { sign: '邮局', wall: '#d6e6ff', roof: '#e2556b' }); P.rect(W * .9 + 70, g - 60, 22, 60, '#e2405a');
          tree(P, W * .97, g, 1.2, pal.tree); return;
        }
        if (layer === 'fore') { for (let i = 0; i < 7; i++) tree(P, (i + .5) * W / 7 + P.j(30), H * 1.06, 1.6, '#123a72'); }
      },
    },
    city: {
      n: '霓虹都市', e: '🏙️', len: 3.6, lv: 3, music: 'magic', moon: true, stars: 30,
      spots: [
        { id: 'station', n: '电车站', e: '🚉', x: .07, act: 'quiz', npc: '站务员', npcE: '👮' },
        { id: 'arcade', n: '游戏厅', e: '🕹️', x: .2, act: 'play' },
        { id: 'cafe', n: '咖啡馆', e: '☕', x: .33, act: 'shop', item: ['🧁', '纸杯蛋糕', 12, 20, 15] },
        { id: 'screen', n: '大屏幕', e: '📺', x: .45, act: 'find' },
        { id: 'bookstore', n: '书店', e: '📖', x: .57, act: 'quiz', npc: '书店店长', npcE: '🧑‍💼' },
        { id: 'tower', n: '观景台', e: '🗼', x: .7, act: 'photo' },
        { id: 'busstop', n: '公交站', e: '🚌', x: .82, act: 'sit' },
        { id: 'crepe', n: '可丽饼车', e: '🍦', x: .93, act: 'shop', item: ['🍦', '冰淇淋', 10, 12, 16] },
      ],
      paint(P, W, H, pal, layer) {
        if (layer === 'far') { skyline(P, 0, W, H * .7, pal, { col: pal.far, min: 120, max: 330, wins: .35, antenna: true, wide: 70 }); skyline(P, 0, W, H * .74, pal, { col: pal.far2, min: 60, max: 180, wins: .5 }); return; }
        if (layer === 'mid') {
          const g = H * .8; P.rect(-10, g, W + 20, H - g + 10, pal.ground, { lw: 2 }); P.rect(-10, g + 10, W + 20, 40, pal.road, { lw: 1.4, shade: false }); for (let x = 0; x < W; x += 80) P.line(x, g + 30, x + 40, g + 30, 3, '#ffe35f', 1);
          const neon = (x, y, t, c) => { P.text(t, x, y, 26, '#ffffff', { glow: c }); P.glow(x, y, 90, c, .35); };
          house(P, W * .02, g, 230, 200, pal, { flat: true, wall: '#2a4a9a', sign: '星星站', signCol: '#0a3d91' }); P.rect(W * .02 + 10, g - 26, 210, 10, '#ffe35f');
          house(P, W * .15, g, 200, 260, pal, { flat: true, wall: '#3d2a8a' }); neon(W * .2, g - 200, 'GAME', pal.neon[1]);
          house(P, W * .28, g, 210, 180, pal, { flat: true, wall: '#335bb3', awning: '#3fd0ff' }); neon(W * .33, g - 150, '咖啡', pal.neon[2]);
          P.rect(W * .4, g - 330, 260, 150, '#0a1440', { lw: 3 }); P.glow(W * .45, g - 255, 200, pal.neon[0], .35); neon(W * .45, g - 255, '星星岛 ★ 学习大冒险', pal.neon[0]); P.line(W * .45, g - 180, W * .45, g, 6);
          house(P, W * .52, g, 220, 220, pal, { flat: true, wall: '#27448f', sign: '书店' });
          house(P, W * .66, g, 130, 380, pal, { flat: true, wall: '#1f3d85', noDoor: true }); P.wash([[W * .66 + 20, g - 380], [W * .66 + 65, g - 470], [W * .66 + 110, g - 380]], '#1f3d85'); P.glow(W * .66 + 65, g - 470, 60, '#ff5fa8', .7);
          car(P, W * .76, g + 40, '#ff5fa8'); P.rect(W * .82 - 50, g - 120, 100, 10, '#3fd0ff'); P.line(W * .82 - 44, g - 110, W * .82 - 44, g, 3); P.line(W * .82 + 44, g - 110, W * .82 + 44, g, 3); bench(P, W * .82, g);
          stall(P, W * .93, g, '#ff7ab8', '冰淇淋'); lamp(P, W * .12, g, pal); lamp(P, W * .62, g, pal); lamp(P, W * .88, g, pal); return;
        }
        if (layer === 'fore') { for (let i = 0; i < 6; i++) { const x = (i + .5) * W / 6; P.line(x, H, x, H * .6, 8, '#081236'); P.rect(x - 30, H * .6, 60, 22, '#081236', { lw: 2 }); } }
      },
    },
    forest: {
      n: '萤火森林', e: '🌲', len: 3, lv: 5, music: 'cave', moon: true, stars: 120, fireflies: true,
      spots: [
        { id: 'mushroom', n: '蘑菇圈', e: '🍄', x: .1, act: 'find' },
        { id: 'owl', n: '猫头鹰博士', e: '🦉', x: .24, act: 'quiz', npc: '猫头鹰博士', npcE: '🦉' },
        { id: 'stream', n: '小溪', e: '💧', x: .38, act: 'play' },
        { id: 'cabin', n: '林间小屋', e: '🛖', x: .52, act: 'sit' },
        { id: 'berry', n: '浆果丛', e: '🫐', x: .66, act: 'find' },
        { id: 'stump', n: '树桩舞台', e: '🎵', x: .8, act: 'photo' },
        { id: 'deer', n: '小鹿', e: '🦌', x: .92, act: 'pet' },
      ],
      paint(P, W, H, pal, layer) {
        if (layer === 'far') { hills(P, W, H * .36, H * .3, pal.far, 8, 1.2); for (let i = 0; i < 40; i++) tree(P, P.r() * W, H * .72, .9 + P.r() * .6, pal.far2, 'pine'); return; }
        if (layer === 'mid') {
          const g = H * .8; P.rect(-10, g, W + 20, H - g + 10, pal.ground, { lw: 2, hatch: .1 });
          for (let i = 0; i < 22; i++) tree(P, (i + P.r()) * W / 22, g + 4, 1.4 + P.r() * .8, i % 2 ? pal.tree : '#155a68', i % 3 ? 'pine' : null);
          for (let i = 0; i < 6; i++) { const x = W * .1 + Math.cos(i) * 60, y = g - 6; P.circle(x, y - 14, 14, '#e2405a', { lw: 1.4 }); P.rect(x - 4, y - 6, 8, 12, '#fff', { lw: 1 }); }
          P.wash([[W * .38 - 120, g + 6], [W * .38 + 120, g + 6], [W * .38 + 90, g + 40], [W * .38 - 90, g + 40]], '#5fb8f0', { lw: 1.6 });
          house(P, W * .52 - 90, g, 180, 120, pal, { wall: '#c98a5a', roof: '#2f8f7f' });
          for (let i = 0; i < 8; i++) P.circle(W * .66 + (i - 4) * 18, g - 26 - (i % 2) * 10, 10, '#4a5fd8', { lw: 1.2 });
          P.ellipse(W * .8, g - 22, 70, 18, '#9a6a4a'); P.rect(W * .8 - 70, g - 22, 140, 22, '#7a5a3a');
          return;
        }
        if (layer === 'fore') { for (let i = 0; i < 12; i++) { const x = P.r() * W; P.wash([[x - 60, H], [x - 20, H * .82], [x + 10, H * .9], [x + 50, H * .8], [x + 70, H]], '#0a2a3a', { lw: 1.4 }); } }
      },
    },
    beach: {
      n: '月光海滩', e: '🏖️', len: 3, lv: 8, music: 'summer', moon: true, stars: 40,
      spots: [
        { id: 'shell', n: '贝壳沙滩', e: '🐚', x: .1, act: 'find' },
        { id: 'umbrella', n: '遮阳伞', e: '⛱️', x: .23, act: 'sit' },
        { id: 'ice', n: '刨冰店', e: '🍧', x: .36, act: 'shop', item: ['🍧', '刨冰', 9, 12, 14] },
        { id: 'crab', n: '螃蟹', e: '🦀', x: .5, act: 'play' },
        { id: 'pier', n: '码头', e: '⚓', x: .63, act: 'quiz', npc: '老船长', npcE: '🧑‍✈️' },
        { id: 'castle', n: '沙堡', e: '🏰', x: .77, act: 'photo' },
        { id: 'light', n: '灯塔', e: '🗼', x: .92, act: 'find' },
      ],
      paint(P, W, H, pal, layer) {
        if (layer === 'far') { sea(P, W, H * .5, H * .82, pal); hills(P, W, H * .38, H * .14, pal.far, 6, 1.2); return; }
        if (layer === 'mid') {
          const g = H * .8; P.wash([[-10, g - 10], [W + 10, g - 4], [W + 10, H + 10], [-10, H + 10]], pal.ground, { lw: 2, hatch: .05 });
          for (let i = 0; i < 40; i++) { const x = P.r() * W; P.line(x, g + 20 + P.r() * 60, x + 6, g + 22 + P.r() * 60, 1, '#b89a70', 1); }
          for (let i = 0; i < 7; i++) tree(P, (i + .3) * W / 7, g, 1.3, pal.tree, 'palm');
          for (let i = 0; i < 5; i++) P.ellipse(W * .1 + i * 22, g + 10, 8, 5, ['#ffd6e0', '#ffffff', '#ffe2b0'][i % 3]);
          P.line(W * .23, g, W * .23 + 10, g - 120, 3); P.wash([[W * .23 - 80, g - 100], [W * .23 + 10, g - 140], [W * .23 + 100, g - 96]], '#ff7a8a');
          stall(P, W * .36, g, '#3fc1c9', '刨冰');
          P.rect(W * .6, g - 30, 260, 14, '#9a6a4a'); for (let i = 0; i < 6; i++) P.line(W * .6 + 10 + i * 48, g - 16, W * .6 + 10 + i * 48, g + 30, 4, '#7a5a3a');
          P.wash([[W * .77 - 60, g], [W * .77 - 50, g - 50], [W * .77 - 20, g - 50], [W * .77 - 20, g - 80], [W * .77 + 20, g - 80], [W * .77 + 20, g - 50], [W * .77 + 50, g - 50], [W * .77 + 60, g]], '#e8c890', { hatch: .1 });
          lighthouse(P, W * .92, g); return;
        }
        if (layer === 'fore') { for (let i = 0; i < 8; i++) { const x = P.r() * W; P.wash([[x - 40, H], [x - 10, H * .86], [x + 30, H]], '#2a6f6a', { lw: 1.2 }); } }
      },
    },
    tower: {
      n: '影时间之塔', e: '🌕', len: 2.6, lv: 10, music: 'smore', moon: true, stars: 0, green: true,
      spots: [
        { id: 'gate', n: '塔门', e: '🚪', x: .14, act: 'quiz', npc: '神秘的蓝衣人', npcE: '🧑‍🎤' },
        { id: 'clock', n: '停止的钟', e: '🕛', x: .32, act: 'find' },
        { id: 'velvet', n: '蓝色的门', e: '🟦', x: .5, act: 'photo' },
        { id: 'crystal', n: '月光水晶', e: '💠', x: .7, act: 'find' },
        { id: 'top', n: '塔顶入口', e: '🌕', x: .88, act: 'quiz', npc: '守塔人', npcE: '🧙' },
      ],
      paint(P, W, H, pal, layer) {
        if (layer === 'far') { skyline(P, 0, W, H * .78, pal, { col: pal.far, min: 80, max: 260, wins: .04 }); tartarus(P, W * .5, H * .78, pal); return; }
        if (layer === 'mid') {
          const g = H * .8; P.rect(-10, g, W + 20, H - g + 10, pal.ground, { lw: 2, hatch: .14 });
          for (let i = 0; i < 14; i++) { const x = (i + .5) * W / 14; P.ctx.save(); P.ctx.globalAlpha = .5; P.wash([[x - 20, g], [x - 10, g - 30 - P.r() * 30], [x + 10, g - 20], [x + 20, g]], '#6a1a2a', { lw: 1, shade: false }); P.ctx.restore(); }
          P.rect(W * .14 - 50, g - 150, 100, 150, '#1d4a36', { hatch: .2 }); P.glow(W * .14, g - 75, 80, pal.accent, .3);
          P.circle(W * .32, g - 160, 40, '#e8ffd8'); P.line(W * .32, g - 160, W * .32, g - 190, 3); P.line(W * .32, g - 160, W * .32 + 22, g - 160, 3); P.line(W * .32, g - 120, W * .32, g, 4);
          P.rect(W * .5 - 34, g - 120, 68, 120, '#1a3fa8', { lw: 2.4 }); P.glow(W * .5, g - 60, 100, '#5fa8ff', .5); P.circle(W * .5 + 20, g - 60, 4, '#ffe08a');
          for (let i = 0; i < 5; i++) P.wash([[W * .7 + (i - 2) * 26 - 10, g], [W * .7 + (i - 2) * 26, g - 40 - (i % 3) * 22], [W * .7 + (i - 2) * 26 + 10, g]], '#a8ffe8', { lw: 1.2 });
          P.glow(W * .7, g - 30, 90, '#a8ffe8', .45);
          P.rect(W * .88 - 70, g - 40, 140, 40, '#1d4a36'); P.rect(W * .88 - 50, g - 70, 100, 30, '#163a2a'); return;
        }
        if (layer === 'fore') { }
      },
    },
  };

  /* ---------- 绘制一层到画布 ---------- */
  S.paintLayer = function (id, layer, W, H, seed) {
    const sc = S.SCENES[id], pal = PAL[id], cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const P = Pen(cv.getContext('2d'), (seed || 11) + layer.length * 101, { ink: id === 'tower' ? '#020a06' : '#0b1638' });
    if (layer === 'sky') sky(P, W, H, pal, { stars: sc.stars, moon: sc.moon ? [W * .72, H * .2, H * .11] : null });
    else sc.paint(P, W, H, pal, layer);
    // 纸张纹理
    const c = cv.getContext('2d'); c.save(); c.globalAlpha = layer === 'sky' ? .05 : .035; for (let i = 0; i < W * H / 900; i++) { c.fillStyle = Math.random() < .5 ? '#fff' : '#000'; c.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); } c.restore();
    return cv;
  };
  window.Sketch = S;
})();
