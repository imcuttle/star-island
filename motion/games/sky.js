/* 空中神笔（原创）：手指就是神笔，在夜空里用星光墨水写字画画，写完的字变成星座飞上天
   · 算式神笔：顶部出算术题，在空中写出答案数字 → 自制 $P 点云识别（多模板 + 笔画数 / 宽高比校正）→ 对了放烟花
   · 描红神笔：按笔顺描汉字 / 大写字母，起点闪烁、偏离提示、描完一笔自动吸附点亮，整字完成变金色并朗读
   · 你画我猜：按提示词自由画，简单形状识别（圆 / 三角 / 方 / 星 / 线）后电脑来猜
   手势：伸食指或捏合 = 落笔，张开手掌 = 抬笔，握拳 2 秒 = 清空；没有手指数据时用手腕（手举到胸口以上落笔）；鼠标也能写
   识别器自测（node）：node motion/games/sky.js；游戏中：__skySim.test() / __skySim.auto() 模拟笔迹跑完整流程 */
(function () {
  'use strict';
  /* ================= 识别器与字形数据（纯函数，node 也能跑） ================= */
  const D2R = Math.PI / 180;
  // 椭圆弧（角度制，y 向下：-90 是正上方）
  const ARC = (cx, cy, rx, ry, a0, a1, n) => { n = n || Math.max(8, Math.round(Math.abs(a1 - a0) / 12)); const o = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D2R; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return o; };
  // 把若干点 / 点列拼成一笔
  const S = (...parts) => parts.reduce((o, p) => typeof p[0] === 'number' ? (o.push(p), o) : o.concat(p), []);
  const EIGHT = () => { const o = []; for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2; o.push([.5 + .3 * Math.sin(2 * t), .5 - .45 * Math.cos(t)]); } return o; };

  // 数字模板：每个数字若干种写法，每种写法是若干笔，每笔是 0-1 方框里的点
  const DIGITS = {
    0: [[ARC(.5, .5, .32, .45, -90, -450)], [ARC(.5, .5, .2, .45, -90, -450)], [ARC(.5, .5, .4, .45, -120, -480)]],
    1: [[[[.5, .05], [.5, .95]]], [[[.3, .25], [.5, .05], [.5, .95]]], [[[.3, .22], [.5, .05], [.5, .95]], [[.28, .95], [.72, .95]]]],
    2: [[S(ARC(.5, .3, .3, .25, -170, 10), [.62, .6], [.15, .95], [.85, .95])], [[[.2, .2], [.5, .05], [.8, .2], [.75, .4], [.15, .95], [.85, .95]]], [S(ARC(.5, .32, .32, .27, -180, 20), [.15, .95], [.85, .95])]],
    3: [[S(ARC(.5, .27, .3, .22, -160, 90), ARC(.5, .72, .33, .24, -90, 160))], [S([.15, .05], [.85, .05], [.45, .42], ARC(.5, .68, .33, .27, -100, 150))], [S(ARC(.48, .26, .28, .21, -170, 80), ARC(.48, .72, .34, .23, -80, 170))]],
    4: [[[[.62, .05], [.12, .66], [.9, .66]], [[.66, .3], [.66, .95]]], [[[.2, .05], [.15, .55], [.85, .55]], [[.68, .05], [.68, .95]]], [[[.66, .95], [.66, .05], [.12, .66], [.9, .66]]]],
    5: [[S([.25, .05], [.2, .45], ARC(.48, .66, .32, .28, -130, 150)), [[.25, .05], [.82, .05]]], [S([.82, .05], [.25, .05], [.2, .45], ARC(.48, .66, .32, .28, -130, 150))], [S([.22, .05], [.2, .42], ARC(.48, .68, .33, .27, -140, 165)), [[.24, .05], [.8, .08]]]],
    6: [[S([.7, .05], [.3, .5], ARC(.5, .72, .27, .23, 180, -180))], [[[.75, .1], [.5, .05], [.28, .25], [.18, .55], [.22, .8], [.45, .95], [.7, .88], [.8, .68], [.68, .5], [.45, .48], [.25, .62]]]],
    7: [[[[.15, .05], [.85, .05], [.4, .95]]], [[[.15, .05], [.85, .05], [.4, .95]], [[.3, .5], [.75, .5]]], [[[.15, .05], [.85, .05], [.6, .45], [.45, .95]]], [[[.15, .2], [.15, .05], [.85, .05], [.45, .95]]]],
    8: [[EIGHT()], [ARC(.5, .28, .24, .22, 90, 450), ARC(.5, .73, .3, .24, -90, 270)]],
    9: [[S(ARC(.5, .3, .28, .25, 0, -360), [.76, .95])], [S(ARC(.5, .3, .28, .25, 0, -360), [.72, .7], [.5, .95])], [ARC(.5, .3, .28, .25, -20, -380), [[.78, .3], [.76, .95]]]],
  };

  // 描红汉字：按笔顺，每笔一组点（0-1 方框）
  const CN = {
    '一': [[[.12, .5], [.88, .5]]],
    '二': [[[.25, .32], [.75, .32]], [[.12, .7], [.88, .7]]],
    '三': [[[.22, .2], [.78, .2]], [[.3, .5], [.7, .5]], [[.12, .82], [.88, .82]]],
    '十': [[[.1, .45], [.9, .45]], [[.5, .08], [.5, .94]]],
    '人': [[[.52, .08], [.5, .35], [.38, .65], [.12, .9]], [[.5, .4], [.66, .68], [.9, .9]]],
    '大': [[[.1, .38], [.9, .38]], [[.5, .06], [.48, .42], [.36, .7], [.1, .92]], [[.52, .46], [.68, .72], [.92, .92]]],
    '天': [[[.22, .18], [.78, .18]], [[.1, .45], [.9, .45]], [[.5, .18], [.47, .55], [.34, .76], [.1, .94]], [[.53, .55], [.7, .78], [.92, .94]]],
    '口': [[[.2, .2], [.2, .85]], [[.2, .2], [.8, .2], [.8, .85]], [[.2, .8], [.8, .8]]],
    '日': [[[.25, .08], [.25, .94]], [[.25, .08], [.75, .08], [.75, .94]], [[.25, .5], [.75, .5]], [[.25, .9], [.75, .9]]],
    '月': [[[.3, .08], [.3, .6], [.24, .8], [.12, .94]], [[.3, .08], [.76, .08], [.76, .86], [.66, .94]], [[.3, .36], [.76, .36]], [[.3, .6], [.76, .6]]],
    '山': [[[.5, .08], [.5, .84]], [[.16, .34], [.16, .84], [.84, .84]], [[.84, .34], [.84, .84]]],
    '水': [[[.5, .06], [.5, .88], [.4, .8]], [[.14, .36], [.38, .36], [.14, .74]], [[.8, .24], [.56, .46]], [[.56, .44], [.72, .68], [.92, .88]]],
    '火': [[[.24, .3], [.32, .5]], [[.78, .26], [.68, .46]], [[.5, .08], [.48, .5], [.3, .78], [.1, .94]], [[.52, .56], [.7, .78], [.92, .94]]],
    '木': [[[.1, .34], [.9, .34]], [[.5, .06], [.5, .94]], [[.48, .36], [.3, .64], [.1, .82]], [[.52, .36], [.7, .62], [.9, .8]]],
    '土': [[[.2, .42], [.8, .42]], [[.5, .12], [.5, .86]], [[.1, .86], [.9, .86]]],
    '上': [[[.44, .08], [.44, .86]], [[.44, .46], [.8, .46]], [[.1, .86], [.9, .86]]],
    '下': [[[.1, .14], [.9, .14]], [[.46, .14], [.46, .94]], [[.56, .42], [.72, .6]]],
    '中': [[[.18, .3], [.18, .68]], [[.18, .3], [.82, .3], [.82, .68]], [[.18, .66], [.82, .66]], [[.5, .06], [.5, .95]]],
    '小': [[[.5, .06], [.5, .88], [.4, .8]], [[.3, .36], [.14, .68]], [[.7, .36], [.86, .66]]],
    '王': [[[.18, .14], [.82, .14]], [[.24, .5], [.76, .5]], [[.5, .14], [.5, .86]], [[.1, .86], [.9, .86]]],
    '田': [[[.16, .12], [.16, .9]], [[.16, .12], [.84, .12], [.84, .9]], [[.16, .5], [.84, .5]], [[.5, .12], [.5, .9]], [[.16, .88], [.84, .88]]],
  };
  // 大写字母
  const EN = {
    A: [[[.5, .06], [.12, .94]], [[.5, .06], [.88, .94]], [[.27, .62], [.73, .62]]],
    B: [[[.22, .06], [.22, .94]], S([.22, .06], [.55, .06], ARC(.55, .27, .2, .21, -90, 90), [.22, .48]), S([.22, .48], [.58, .48], ARC(.58, .71, .24, .23, -90, 90), [.22, .94])],
    C: [ARC(.55, .5, .38, .44, -40, -320)],
    D: [[[.22, .06], [.22, .94]], S([.22, .06], [.45, .06], ARC(.45, .5, .38, .44, -90, 90), [.22, .94])],
    E: [[[.24, .06], [.24, .94]], [[.24, .06], [.8, .06]], [[.24, .5], [.7, .5]], [[.24, .94], [.82, .94]]],
    F: [[[.26, .06], [.26, .94]], [[.26, .06], [.82, .06]], [[.26, .48], [.7, .48]]],
    G: [S(ARC(.52, .5, .38, .44, -45, -345), [.89, .52], [.6, .52])],
    H: [[[.2, .06], [.2, .94]], [[.8, .06], [.8, .94]], [[.2, .5], [.8, .5]]],
    I: [[[.5, .06], [.5, .94]], [[.28, .06], [.72, .06]], [[.28, .94], [.72, .94]]],
    J: [S([.72, .06], [.72, .66], ARC(.47, .66, .25, .26, 0, 180))],
    K: [[[.22, .06], [.22, .94]], [[.8, .06], [.22, .58]], [[.42, .42], [.84, .94]]],
    L: [[[.26, .06], [.26, .94], [.82, .94]]],
    M: [[[.12, .94], [.12, .06]], [[.12, .06], [.5, .66], [.88, .06], [.88, .94]]],
    N: [[[.18, .94], [.18, .06]], [[.18, .06], [.82, .94], [.82, .06]]],
    O: [ARC(.5, .5, .38, .44, -90, -450)],
    P: [[[.22, .06], [.22, .94]], S([.22, .06], [.55, .06], ARC(.55, .29, .24, .23, -90, 90), [.22, .52])],
    Q: [ARC(.5, .48, .38, .42, -90, -450), [[.58, .7], [.88, .96]]],
    R: [[[.22, .06], [.22, .94]], S([.22, .06], [.55, .06], ARC(.55, .28, .22, .22, -90, 90), [.22, .5]), [[.46, .5], [.82, .94]]],
    S: [S(ARC(.5, .28, .3, .22, -25, -270), ARC(.5, .72, .32, .22, -90, 145))],
    T: [[[.1, .06], [.9, .06]], [[.5, .06], [.5, .94]]],
    U: [S([.2, .06], [.2, .62], ARC(.5, .62, .3, .32, 180, 0), [.8, .06])],
    V: [[[.12, .06], [.5, .94]], [[.5, .94], [.88, .06]]],
    W: [[[.06, .06], [.27, .94], [.5, .34], [.73, .94], [.94, .06]]],
    X: [[[.16, .06], [.84, .94]], [[.84, .06], [.16, .94]]],
    Y: [[[.14, .06], [.5, .5]], [[.86, .06], [.5, .5], [.5, .94]]],
    Z: [[[.14, .06], [.86, .06], [.14, .94], [.86, .94]]],
  };
  // 你画我猜：提示词和它大概由哪些形状组成
  const DRAW = [
    { w: '太阳', e: '☀️', need: { circle: 1, line: 3 } },
    { w: '房子', e: '🏠', need: { triangle: 1, rect: 1 } },
    { w: '鱼', e: '🐟', need: { circle: 1, triangle: 1 } },
    { w: '星星', e: '⭐', need: { star: 1 } },
    { w: '苹果', e: '🍎', need: { circle: 1, line: 1 } },
    { w: '气球', e: '🎈', need: { circle: 1, curve: 1 } },
    { w: '雪人', e: '⛄', need: { circle: 2 } },
    { w: '小船', e: '⛵', need: { triangle: 1, line: 1 } },
    { w: '冰淇淋', e: '🍦', need: { triangle: 1, circle: 1 } },
    { w: '月亮', e: '🌙', need: { curve: 1 } },
    { w: '花朵', e: '🌸', need: { circle: 4 } },
    { w: '雨伞', e: '☂️', need: { curve: 2, line: 1 } },
  ];
  const SHAPE_NAME = { circle: '⭕ 圆', triangle: '🔺 三角', rect: '⬜ 方块', star: '⭐ 星形', line: '➖ 直线', curve: '〰️ 曲线' };

  /* ---------- 几何小工具（点都是 {x,y}） ---------- */
  const pd = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const P2 = s => s.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p);
  const polyLen = p => { let d = 0; for (let i = 1; i < p.length; i++) d += pd(p[i - 1], p[i]); return d; };
  const bbox = pts => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; pts.forEach(p => { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }); return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
  // 单笔等距重采样成 n 个点
  function resampleOne(p, n) {
    const L = polyLen(p); if (p.length < 2 || !L) return Array.from({ length: n }, () => ({ x: p[0].x, y: p[0].y }));
    const I = L / (n - 1), out = [{ x: p[0].x, y: p[0].y }]; let D = 0, prev = p[0];
    for (let i = 1; i < p.length; i++) {
      let cur = p[i], d = pd(prev, cur);
      while (D + d >= I && out.length < n) { const t = (I - D) / d, q = { x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) }; out.push(q); prev = q; d = pd(prev, cur); D = 0; }
      D += d; prev = cur;
    }
    while (out.length < n) out.push({ x: p[p.length - 1].x, y: p[p.length - 1].y });
    return out;
  }
  // 按固定步长加密（描红路径、模拟笔迹）
  function dens(p, step) { const n = Math.max(2, Math.ceil(polyLen(p) / step) + 1); return resampleOne(p, n); }

  /* ---------- $P 点云识别器：和笔顺、方向、笔画数无关，适合小朋友 ---------- */
  const REC = (() => {
    const N = 32, tpl = [];
    const flat = strokes => { const o = []; strokes.forEach((s, i) => P2(s).forEach(p => o.push({ x: p.x, y: p.y, id: i }))); return o; };
    function resample(pts, n) {
      let L = 0; for (let i = 1; i < pts.length; i++) if (pts[i].id === pts[i - 1].id) L += pd(pts[i - 1], pts[i]);
      const I = L / (n - 1), src = pts.slice(), out = [src[0]]; let D = 0;
      if (!I) { while (out.length < n) out.push(src[0]); return out; }
      for (let i = 1; i < src.length; i++) {
        if (src[i].id !== src[i - 1].id) continue;
        const d = pd(src[i - 1], src[i]);
        if (D + d >= I && d > 0) { const t = (I - D) / d, q = { x: src[i - 1].x + t * (src[i].x - src[i - 1].x), y: src[i - 1].y + t * (src[i].y - src[i - 1].y), id: src[i].id }; out.push(q); src.splice(i, 0, q); D = 0; }
        else D += d;
      }
      while (out.length < n) out.push(src[src.length - 1]);
      return out.slice(0, n);
    }
    function norm(pts) {
      const b = bbox(pts), s = Math.max(b.w, b.h) || 1; let cx = 0, cy = 0;
      const o = pts.map(p => ({ x: (p.x - b.x0) / s, y: (p.y - b.y0) / s })); o.forEach(p => { cx += p.x; cy += p.y; }); cx /= o.length; cy /= o.length;
      return o.map(p => ({ x: p.x - cx, y: p.y - cy }));
    }
    function cloud(a, b, start) {
      const n = a.length, used = new Uint8Array(n); let sum = 0, i = start;
      do {
        let mi = 0, md = Infinity;
        for (let j = 0; j < n; j++) if (!used[j]) { const dx = a[i].x - b[j].x, dy = a[i].y - b[j].y, d = dx * dx + dy * dy; if (d < md) { md = d; mi = j; } }
        used[mi] = 1; sum += (1 - ((i - start + n) % n) / n) * Math.sqrt(md); i = (i + 1) % n;
      } while (i !== start);
      return sum;
    }
    function match(a, b) { const n = a.length, step = Math.floor(Math.sqrt(n)); let m = Infinity; for (let i = 0; i < n; i += step) m = Math.min(m, cloud(a, b, i), cloud(b, a, i)); return m; }
    const prep = strokes => norm(resample(flat(strokes), N));
    const add = (name, strokes, tag) => tpl.push({ name, pts: prep(strokes), n: strokes.length, tag });
    Object.keys(DIGITS).forEach(d => DIGITS[d].forEach((v, i) => add(d, v, d + ':' + i)));
    // strokes：[[{x,y}|[x,y]...]...] → [{ name, d 距离, conf 0-1 }]，按可能性排序
    function recognize(strokes, o) {
      o = o || {}; strokes = strokes.map(P2).filter(s => s.length);
      if (!strokes.length) return [];
      const all = [].concat(...strokes), b = bbox(all), asp = b.w / (b.h || 1e-6), P = prep(strokes), best = {};
      tpl.forEach(t => {
        if (o.exclude === t.tag) return;
        let d = match(P, t.pts); if (t.n === strokes.length) d *= .92; // 笔画数一样的写法优先
        if (best[t.name] == null || d < best[t.name]) best[t.name] = d;
      });
      // 宽高比：又细又长的一竖就是 1；胖的不会是 1
      if (best[1] != null) { if (asp < .3) best[1] *= .6; else if (asp > .55) best[1] *= 1.35; }
      if (asp < .3) ['0', '2', '3', '5', '6', '8', '9'].forEach(k => { if (best[k] != null) best[k] *= 1.15; });
      const list = Object.keys(best).map(k => ({ name: k, d: best[k] })).sort((a, c) => a.d - c.d);
      const d0 = list[0].d, tau = d0 * .2 + .05; let sum = 0;
      list.forEach(c => { c.w = Math.exp(-(c.d - d0) / tau); sum += c.w; });
      const q = Math.max(.3, Math.min(1, 1.55 - d0 * .45)); // 离所有模板都远：整体没把握
      list.forEach(c => { c.conf = c.w / sum * q; });
      return list;
    }
    return { recognize, N, templates: tpl };
  })();

  /* ---------- 简单形状识别（你画我猜） ---------- */
  function corners(r, closed) {
    const n = r.length, K = 3, ang = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let a = i - K, b = i + K;
      if (closed) { a = (a + n) % n; b %= n; } else if (a < 0 || b >= n) continue;
      const v1x = r[i].x - r[a].x, v1y = r[i].y - r[a].y, v2x = r[b].x - r[i].x, v2y = r[b].y - r[i].y, l = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
      if (l > 0) ang[i] = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / l))) / D2R;
    }
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (ang[i] < 50) continue; let mx = true;
      for (let j = -K; j <= K; j++) { if (!j) continue; let q = i + j; if (closed) q = (q + n) % n; else if (q < 0 || q >= n) continue; if (ang[q] > ang[i] || (ang[q] === ang[i] && j < 0)) { mx = false; break; } }
      if (mx) c++;
    }
    return c;
  }
  function shapeOf(st) {
    st = P2(st); const len = polyLen(st), b = bbox(st), diag = Math.hypot(b.w, b.h);
    if (len < 18 || diag < 14) return 'dot';
    let r = resampleOne(st, 48); const closeD = pd(r[0], r[r.length - 1]);
    const chord = pd(r[0], r[r.length - 1]), closed = closeD < Math.max(diag * .22, len * .08), straight = chord / len;
    // 直线：首尾连线够长，且整笔离连线最远不超过连线长的 12%（手抖也算直）
    let dev = 0; if (chord > 0) r.forEach(p => { dev = Math.max(dev, Math.abs((p.x - r[0].x) * (r[r.length - 1].y - r[0].y) - (p.y - r[0].y) * (r[r.length - 1].x - r[0].x)) / chord); });
    if (!closed && (straight > .88 || (straight > .6 && dev < chord * .12))) return 'line';
    if (closed) r = r.slice(0, -1);
    const cor = corners(r, closed);
    if (closed) {
      let cx = 0, cy = 0; r.forEach(p => { cx += p.x; cy += p.y; }); cx /= r.length; cy /= r.length;
      const rs = r.map(p => Math.hypot(p.x - cx, p.y - cy)), m = rs.reduce((a, v) => a + v, 0) / rs.length, cv = Math.sqrt(rs.reduce((a, v) => a + (v - m) * (v - m), 0) / rs.length) / (m || 1);
      if (cor <= 2 && cv < .3) return 'circle';
      if (cor >= 5) return 'star';
      if (cor === 3) return 'triangle';
      if (cor === 4) return 'rect';
      return 'circle';
    }
    if (cor >= 5 && len > diag * 2.5) return 'star';
    if (cor === 2 && len > diag * 1.6 && closeD < diag * .45) return 'triangle';
    return 'curve';
  }
  // 画得像不像：需要的形状数量满足了多少（相近的形状给部分分）
  function drawScore(shapes, need) {
    const have = {}; shapes.forEach(s => { have[s] = (have[s] || 0) + 1; });
    const h = k => have[k] || 0, ALT = { circle: h('curve') * .5 + h('rect') * .3, line: h('curve') * .6, curve: h('line') * .5 + h('circle') * .5, triangle: h('rect') * .4 + h('curve') * .3, rect: h('triangle') * .4 + h('circle') * .3, star: h('triangle') * .3 + h('rect') * .2 };
    let sum = 0, tot = 0;
    for (const k in need) { const n = need[k]; sum += Math.min(n, h(k) + (ALT[k] || 0)); tot += n; }
    let sc = tot ? sum / tot : 0; if (shapes.length - tot > 2) sc *= .85;
    return sc;
  }

  /* ---------- 自测：模板加扰动（缩放 / 旋转 / 斜切 / 抖动 / 反向 / 乱序），留一法看准确率 ---------- */
  function seeded(s) { return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function perturb(strokes, rnd) {
    rnd = rnd || Math.random; const sx = .8 + rnd() * .4, sy = .8 + rnd() * .4, rot = (rnd() - .5) * 24 * D2R, sh = (rnd() - .5) * .3, c = Math.cos(rot), s = Math.sin(rot);
    let out = strokes.map(st => dens(P2(st), .02).map(p => { const x0 = (p.x - .5) * sx + (p.y - .5) * sh, y0 = (p.y - .5) * sy; return { x: .5 + x0 * c - y0 * s + (rnd() - .5) * .03, y: .5 + x0 * s + y0 * c + (rnd() - .5) * .03 }; }));
    out = out.map(st => rnd() < .3 ? st.reverse() : st); if (out.length > 1 && rnd() < .3) out.reverse();
    return out;
  }
  function test(log) {
    log = log || (typeof console !== 'undefined' ? console.log.bind(console) : () => {});
    const rnd = seeded(12345), conf = {}; let n = 0, ok = 0, ok3 = 0, okFull = 0;
    Object.keys(DIGITS).forEach(dg => DIGITS[dg].forEach((v, vi) => {
      for (let k = 0; k < 14; k++) {
        const s = perturb(v, rnd), r = REC.recognize(s, { exclude: dg + ':' + vi }), rf = REC.recognize(s);
        n++; if (r[0].name === dg) ok++; else conf[dg + '→' + r[0].name] = (conf[dg + '→' + r[0].name] || 0) + 1;
        if (r.slice(0, 3).some(c => c.name === dg)) ok3++; if (rf[0].name === dg) okFull++;
      }
    }));
    // 形状
    const star = []; for (let i = 0; i <= 5; i++) { const a = (-90 + 144 * i) * D2R; star.push([.5 + .45 * Math.cos(a), .5 + .45 * Math.sin(a)]); }
    const SH = { circle: [ARC(.5, .5, .4, .4, 0, 360)], triangle: [[[.5, .05], [.95, .9], [.05, .9], [.5, .05]]], rect: [[[.1, .1], [.9, .1], [.9, .9], [.1, .9], [.1, .1]]], star: [star], line: [[[.1, .2], [.9, .8]]], curve: [ARC(.5, .5, .4, .4, 180, 360)] };
    let sn = 0, sok = 0; const sconf = {};
    Object.keys(SH).forEach(k => { for (let i = 0; i < 12; i++) { const s = perturb(SH[k], rnd)[0], r = shapeOf(s.map(p => ({ x: p.x * 300, y: p.y * 300 }))); sn++; if (r === k) sok++; else sconf[k + '→' + r] = (sconf[k + '→' + r] || 0) + 1; } });
    const res = { digitsLOO: +(ok / n).toFixed(3), top3LOO: +(ok3 / n).toFixed(3), digitsFull: +(okFull / n).toFixed(3), confusions: conf, shapes: +(sok / sn).toFixed(3), shapeConf: sconf };
    log('[sky test]', JSON.stringify(res));
    return res;
  }

  // node 下：导出识别器 / 直接运行时自测；页面里不做任何额外的事
  if (typeof window === 'undefined') {
    const api = { REC, shapeOf, drawScore, test, perturb, DIGITS, CN, EN, DRAW }; globalThis.__skyRec = api; // package 是 ESM 时 require 拿不到 exports，就从全局取
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof process !== 'undefined' && /sky\.js$/.test(process.argv[1] || '')) test(); // node motion/games/sky.js
    return;
  }
  if (!window.Motion) return;

  /* ================= 游戏 ================= */
  const M = window.Motion, U = M.U;
  const ease = t => 1 - Math.pow(1 - t, 3);
  // 示范动作：张开手掌举起 / 胸前握拳
  if (M.Puppet) {
    M.Puppet.MOVES.skyOpen = [[.5, {}, {}], [.4, { rUA: -40, rFA: -95 }, {}], [.9, { rUA: -40, rFA: -95 }, { fx: 'up' }], [.4, {}, {}]];
    M.Puppet.MOVES.skyFist = [[.4, { rUA: 60, rFA: -110 }, {}], [.3, { rUA: 60, rFA: -110 }, { fist: 'R' }], [1.2, { rUA: 60, rFA: -110 }, { fist: 'R', fx: 'charge' }], [.4, {}, {}]];
  }
  function injectCss() {
    if (document.getElementById('mg-sky-css')) return;
    const st = document.createElement('style'); st.id = 'mg-sky-css';
    st.textContent = '.sky-pen{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:8px 22px;border-radius:999px;background:rgba(8,12,40,.78);color:#fff;font-size:20px;font-weight:800;box-shadow:0 0 0 2px rgba(126,249,255,.55),0 0 26px rgba(126,249,255,.3);transition:box-shadow .2s,background .2s;white-space:nowrap;backdrop-filter:blur(6px)}' +
      '.sky-pen .emo{width:28px;height:28px}.sky-pen small{font-size:14px;font-weight:600;opacity:.72;margin-left:4px}' +
      '.sky-pen.down{box-shadow:0 0 0 2px #ffd166,0 0 34px rgba(255,209,102,.65);background:rgba(40,28,10,.8)}.sky-pen.fist{box-shadow:0 0 0 2px #ff7aa8,0 0 34px rgba(255,122,168,.6)}.sky-pen.none{opacity:.85}.sky-qe .emo{width:58px;height:58px}';
    document.head.appendChild(st);
  }

  M.game({
    id: 'sky', name: '空中神笔', icon: '🪄', color: '#7c6cff', tag: '原创', demo: 'point',
    short: '伸出食指，在夜空里写字画画！',
    desc: '手指就是神笔：伸出食指落笔、张开手掌抬笔、握拳清空。空中写出算式答案、按笔顺描字、画画让电脑来猜，写完的字会变成星座飞上夜空！',
    how: [['point', '伸出食指写字'], ['skyOpen', '张开手掌抬笔'], ['skyFist', '握拳 2 秒清空']],
    needs: { hands: true },
    modes: [{ id: 'math', name: '算式神笔', icon: '🔢', desc: '空中写出答案数字' }, { id: 'trace', name: '描红神笔', icon: '✍️', desc: '按笔顺描汉字和字母' }, { id: 'draw', name: '你画我猜', icon: '🎨', desc: '画出提示的东西' }],
    sayHow: '伸出食指就能写字，张开手掌抬笔',
    start(G) {
      injectCss();
      const mode = G.mode, QN = mode === 'draw' ? 6 : 10;
      let ready = false;
      const C = G.canvas({ dpr: 1.5, onResize: () => { if (ready) layout(); } }), x = C.ctx;
      const L = { k: 1, box: { x: 0, y: 0, w: 1, h: 1 }, cx: 0, cy: 0 };
      const bg = document.createElement('canvas'), inkCv = document.createElement('canvas'), ink = inkCv.getContext('2d');
      const twinkles = [], parts = [], rockets = [], meteors = [], consts = [];
      let inkStrokes = [], live = null, hue = 190, shake = 0, flash = 0, strokesTotal = 0, constTotal = 0, meteorT = 2, fistT = 0;
      // 星座停靠位置（避开题卡、画板和右下角画中画）
      const SLOTS = [[.92, .27], [.07, .5], [.93, .44], [.07, .7], [.2, .87], [.7, .9]];

      /* ---------- 发光贴图（预渲染，比 shadowBlur 快） ---------- */
      const SPR = new Map();
      const spr = h => { h = ((Math.round(h / 10) * 10) % 360 + 360) % 360; let c = SPR.get(h); if (c) return c; c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'hsla(' + h + ',100%,72%,.9)'); gr.addColorStop(.45, 'hsla(' + h + ',100%,60%,.25)'); gr.addColorStop(1, 'hsla(' + h + ',100%,50%,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); SPR.set(h, c); return c; };
      const glow = (px, py, r, h, a) => { if (a <= 0 || r <= 0) return; x.globalAlpha = Math.min(1, a); x.drawImage(spr(h), px - r, py - r, r * 2, r * 2); };

      /* ---------- 布局 / 背景 / 墨水层 ---------- */
      function layout() {
        const W = C.W, H = C.H; L.k = Math.min(W, H * 1.7) / 1100;
        if (mode === 'draw') { const w = Math.min(W * .6, H * 1.05), h = Math.min(H * .56, w * .72); L.box = { x: (W - w) / 2, y: H * .59 - h / 2, w, h }; }
        else { const s = mode === 'trace' ? Math.min(H * .56, W * .42) : Math.min(H * .5, W * .3); L.box = { x: (W - s) / 2, y: H * .59 - s / 2, w: s, h: s }; }
        L.cx = L.box.x + L.box.w / 2; L.cy = L.box.y + L.box.h / 2;
        drawBg();
        inkCv.width = bg.width; inkCv.height = bg.height; ink.setTransform(C.dpr, 0, 0, C.dpr, 0, 0); inkRedraw();
        if (MODE && MODE.layout) MODE.layout();
      }
      function drawBg() {
        const W = C.W, H = C.H, d = C.dpr; bg.width = Math.round(W * d); bg.height = Math.round(H * d); const b = bg.getContext('2d'); b.setTransform(d, 0, 0, d, 0, 0);
        const g = b.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#040824'); g.addColorStop(.55, '#11164a'); g.addColorStop(1, '#2b1d5e'); b.fillStyle = g; b.fillRect(0, 0, W, H);
        // 星云
        [[.25, .3, '120,90,255'], [.78, .22, '40,200,255'], [.55, .55, '255,90,200']].forEach(([fx, fy, c]) => { const r = b.createRadialGradient(W * fx, H * fy, 0, W * fx, H * fy, W * .45); r.addColorStop(0, 'rgba(' + c + ',.16)'); r.addColorStop(1, 'rgba(' + c + ',0)'); b.fillStyle = r; b.fillRect(0, 0, W, H); });
        // 银河：斜向的细碎星带
        for (let i = 0; i < 800; i++) { const t = Math.random(), off = (Math.random() + Math.random() + Math.random() - 1.5) * H * .12; b.fillStyle = 'rgba(255,255,255,' + (Math.random() * .35).toFixed(2) + ')'; b.fillRect(t * W, H * .78 - t * H * .62 + off, 1.2, 1.2); }
        for (let i = 0; i < 240; i++) { const r = Math.random() < .9 ? Math.random() * 1.1 + .3 : Math.random() * 1.6 + 1; b.fillStyle = 'rgba(255,' + (225 + Math.random() * 30 | 0) + ',' + (200 + Math.random() * 55 | 0) + ',' + (.35 + Math.random() * .65).toFixed(2) + ')'; b.beginPath(); b.arc(Math.random() * W, Math.random() * H * .85, r, 0, 7); b.fill(); }
        // 月亮
        const mx = W * .085, my = H * .27, mr = H * .062;
        let r = b.createRadialGradient(mx, my, mr * .8, mx, my, mr * 4.5); r.addColorStop(0, 'rgba(255,236,190,.35)'); r.addColorStop(1, 'rgba(255,236,190,0)'); b.fillStyle = r; b.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
        r = b.createRadialGradient(mx - mr * .35, my - mr * .35, mr * .1, mx, my, mr); r.addColorStop(0, '#fffbe8'); r.addColorStop(1, '#f0d585'); b.fillStyle = r; b.beginPath(); b.arc(mx, my, mr, 0, 7); b.fill();
        b.fillStyle = 'rgba(185,150,80,.32)'; [[-.3, -.2, .22], [.28, .15, .16], [-.05, .45, .12], [.35, -.38, .1], [-.45, .25, .08]].forEach(([dx, dy, rr]) => { b.beginPath(); b.arc(mx + dx * mr, my + dy * mr, rr * mr, 0, 7); b.fill(); });
        // 远山剪影 + 小房子的灯
        [['#1b1648', .86, 38], ['#0c0a28', .93, 24]].forEach(([c, base, amp], li) => {
          b.fillStyle = c; b.beginPath(); b.moveTo(0, H);
          for (let px = 0; px <= W + 20; px += 20) b.lineTo(px, H * base - (Math.sin(px / W * 7 + li * 2) * .6 + Math.sin(px / W * 17 + li) * .4) * amp * L.k);
          b.lineTo(W, H); b.closePath(); b.fill();
        });
        for (let i = 0; i < 9; i++) { const px = Math.random() * W, py = H * (.94 + Math.random() * .04); b.fillStyle = 'rgba(255,200,110,.75)'; b.fillRect(px, py, 3, 3); }
        twinkles.length = 0;
        for (let i = 0; i < 70; i++) twinkles.push({ x: Math.random() * W, y: Math.random() * H * .82, r: U.rand(4, 11), ph: Math.random() * 7, sp: U.rand(1.2, 3.5), h: U.pick([50, 200, 280, 330]) });
      }
      function pathOf(g, pts) {
        g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
        if (pts.length < 3) { const l = pts[pts.length - 1]; g.lineTo(l.x + .1, l.y + .1); return; }
        for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
        const l = pts[pts.length - 1]; g.lineTo(l.x, l.y);
      }
      // 星光墨水：外层彩色光晕 + 中层亮色 + 白色笔芯
      function strokeInk(g, pts, h, liveS, sc) {
        const k = L.k * (sc || 1); g.save(); g.lineCap = g.lineJoin = 'round'; g.globalCompositeOperation = 'lighter';
        pathOf(g, pts);
        if (!liveS) { g.shadowColor = 'hsl(' + h + ',100%,60%)'; g.shadowBlur = 22 * k; }
        g.strokeStyle = 'hsla(' + h + ',100%,60%,' + (liveS ? .3 : .42) + ')'; g.lineWidth = 22 * k; g.stroke();
        g.shadowBlur = 0; g.strokeStyle = 'hsl(' + h + ',100%,72%)'; g.lineWidth = 8 * k; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.8 * k; g.stroke();
        g.restore();
      }
      function inkRedraw() { ink.clearRect(0, 0, C.W, C.H); inkStrokes.forEach(s => strokeInk(ink, s.pts, s.hue)); }
      function inkAdd(s) { inkStrokes.push(s); strokeInk(ink, s.pts, s.hue); }
      // 清掉墨水：dust 变成星尘散开；fly 变成星座飞上天
      function inkClear(how, label) {
        if (!inkStrokes.length) return;
        if (how === 'fly') makeConst(inkStrokes.map(s => s.pts), label, inkStrokes[0].hue);
        else if (how === 'dust') inkStrokes.forEach(s => dens(s.pts, 14).forEach(p => emit(p.x, p.y, s.hue, 1, { v0: 10, v1: 70, vy: -30, l0: .5, l1: 1.1, r0: 4, r1: 9 })));
        inkStrokes = []; inkRedraw();
      }
      const tiny = s => s.pts.length < 3 && polyLen(s.pts) < 12;

      /* ---------- 粒子 / 烟花 / 流星 / 星座 ---------- */
      function emit(px, py, h, n, o) {
        o = o || {};
        for (let i = 0; i < n && parts.length < 900; i++) { const a = Math.random() * 6.283, v = U.rand(o.v0 || 20, o.v1 || 120) * L.k, life = U.rand(o.l0 || .4, o.l1 || .9); parts.push({ x: px, y: py, vx: Math.cos(a) * v + (o.vx || 0) * L.k, vy: Math.sin(a) * v + (o.vy || 0) * L.k, life, max: life, r: U.rand(o.r0 || 4, o.r1 || 10) * L.k, h: o.rh ? h + U.rand(-o.rh, o.rh) : h, g: (o.g || 0) * L.k, drag: o.drag || 1.5 }); }
      }
      function fireworks(n) {
        G.sfx('whoosh', .4);
        for (let i = 0; i < n; i++) G.after(i * .22, () => rockets.push({ x: C.W * U.rand(.15, .85), y: C.H + 10, ty: C.H * U.rand(.14, .45), h: U.pick([0, 40, 50, 160, 200, 280, 320]), v: U.rand(950, 1250) * L.k }));
      }
      function makeConst(sts, label, h) {
        sts = sts.filter(s => s.length); if (!sts.length) return;
        const b = bbox([].concat(...sts)), bw = Math.max(b.w, b.h, 1), mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2, nodes = [], edges = [];
        sts.forEach(p => {
          const n = Math.max(2, Math.min(9, Math.round(polyLen(p) / (bw * .16)) + 1)), rs = resampleOne(p, n), base = nodes.length;
          rs.forEach((q, i) => { nodes.push({ sx: q.x, sy: q.y, ox: (q.x - mx) / bw, oy: (q.y - my) / bw, ph: Math.random() * 7, r: U.rand(.7, 1.25) }); if (i) edges.push([base + i - 1, base + i]); });
        });
        const si = constTotal++ % SLOTS.length; consts.forEach(c => { if (c.slot === si && !c.dying) c.dying = G.t; });
        consts.push({ nodes, edges, t0: G.t, slot: si, size: 100 * L.k, label, h: h == null ? 50 : h });
        G.sfx('chime', .5);
      }

      /* ---------- 笔：手指 → 手腕兜底 → 鼠标 → 模拟 ---------- */
      const pen = { x: C.W / 2, y: C.H / 2, down: false, vis: false, src: 'none', side: 'R', dnF: 0, upF: 0, lastHT: 0, isFist: false, fT: -1e9, out: false };
      const fX = new M.OneEuro(1.6, .006), fY = new M.OneEuro(1.6, .006);
      const mouse = { x: 0, y: 0, down: false, t: -1e9 }, sim = [];
      let simOn = false, prevSrc = '';
      const setPos = (px, py, now) => { pen.x = fX.f(U.clamp(px, 0, C.W), now); pen.y = fY.f(U.clamp(py, 0, C.H), now); };
      const mpos = e => { const r = C.cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.t = performance.now(); };
      C.cv.addEventListener('pointerdown', e => { mpos(e); mouse.down = true; });
      C.cv.addEventListener('pointermove', e => { mpos(e); });
      const mup = () => { mouse.down = false; }; addEventListener('pointerup', mup); G.onDispose(() => removeEventListener('pointerup', mup));
      function readPen() {
        const now = performance.now();
        if (sim.length || simOn) { simOn = true; const s = sim.shift(); if (s) { pen.x = s.x; pen.y = s.y; pen.down = s.down; } else pen.down = false; pen.vis = true; pen.src = 'sim'; pen.isFist = false; return; }
        if (now - mouse.t < 1500) { pen.src = 'mouse'; pen.vis = true; pen.down = mouse.down; pen.isFist = false; pen.x = mouse.x; pen.y = mouse.y; return; }
        const p = G.player(0), b = p && p.body;
        if (!b || !b.ready) { pen.vis = false; pen.down = false; pen.src = 'none'; return; }
        const F = p.fingers || {};
        // 手指短暂没识别到（< 0.7 秒）：笔停在原地保持状态，不切到手腕，免得一笔断成几截
        if (!F.L && !F.R && pen.src === 'finger' && now - pen.fT < 700) return;
        let sd = F[pen.side] ? pen.side : F.R ? 'R' : F.L ? 'L' : null;
        // 两只手都在：换到正在伸食指 / 捏合的那只
        if (F.L && F.R) { const a = F[pen.side], o = pen.side === 'L' ? 'R' : 'L'; if (a && !(a.point || a.pinch) && (F[o].point || F[o].pinch)) sd = o; }
        if (sd) {
          const hd = F[sd]; if (sd !== pen.side) { pen.dnF = pen.upF = 0; } pen.side = sd; pen.src = 'finger'; pen.vis = true; pen.fT = now;
          if (hd.t !== pen.lastHT) {
            // 每个识别帧计一次，连续 2 帧才切换（防抖）
            pen.lastHT = hd.t;
            if (hd.point || hd.pinch) { pen.dnF++; pen.upF = 0; } else if (hd.open || hd.fist) { pen.upF++; pen.dnF = 0; }
            if (!pen.down && pen.dnF >= 2) pen.down = true; if (pen.down && pen.upF >= 2) pen.down = false;
            pen.isFist = hd.fist;
          }
          // 以写字那只手的肩膀稍内侧为中心，同一把尺缩放（字不变形）
          const A = b.A, T = b.T, shx = p.lm[sd === 'L' ? 11 : 12].x * A, cx = shx + (sd === 'L' ? .3 : -.3) * T, cy = b.sh.y + .15 * T, kk = C.H / (1.6 * T);
          setPos(C.W / 2 + (hd.index.x * A - cx) * kk, C.H / 2 + (hd.index.y - cy) * kk, now);
          return;
        }
        // 没有手指数据：用举得更高的那只手，手到胸口以上算落笔
        const HL = b.hands.L, HR = b.hands.R, h = HL.visible && HR.visible ? (HL.rawA.y < HR.rawA.y ? HL : HR) : HR.visible ? HR : HL.visible ? HL : null;
        if (!h) { pen.vis = false; pen.down = false; pen.src = 'none'; return; }
        pen.src = 'wrist'; pen.vis = true; pen.isFist = false;
        pen.down = h.rawA.y < b.sh.y + (pen.down ? .42 : .3) * b.T;
        setPos(h.reach.x * C.W, h.reach.y * C.H, now);
      }
      let wasDown = false;
      function penTick(dt) {
        readPen();
        if (pen.src !== prevSrc) { if (live) { const s = live; live = null; if (!tiny(s)) MODE.stroke(s); } wasDown = false; if (pen.src !== 'sim' && pen.src !== 'mouse') { fX.reset(); fY.reset(); } prevSrc = pen.src; return; }
        // 只在画板附近落墨：框外举着手不会乱画（写到一半稍微出框也不断）
        const b = L.box, m = Math.min(b.w, b.h) * (live ? .3 : .12);
        pen.out = pen.x < b.x - m || pen.x > b.x + b.w + m || pen.y < b.y - m || pen.y > b.y + b.h + m;
        const dn = pen.down && pen.vis && !pen.out;
        if (dn && !wasDown) { hue = (hue + 47) % 360; live = { pts: [{ x: pen.x, y: pen.y }], hue }; G.sfx('pop', .25); if (MODE.down) MODE.down(); }
        else if (dn && live) { const l = live.pts[live.pts.length - 1]; if (Math.hypot(pen.x - l.x, pen.y - l.y) > 2.5) { live.pts.push({ x: pen.x, y: pen.y }); emit(pen.x, pen.y, live.hue, 1, { v0: 10, v1: 60, l0: .3, l1: .7, r0: 3, r1: 8, rh: 20 }); } }
        else if (!dn && wasDown && live) { const s = live; live = null; if (!tiny(s)) { strokesTotal++; MODE.stroke(s); } }
        wasDown = dn;
        // 握拳 2 秒 = 清空
        if (pen.isFist && pen.vis) { if (fistT >= 0) { fistT += dt; if (fistT > 2) { fistT = -1; MODE.clear(); G.sfx('whoosh', .6); G.pop('清空啦', 'good'); } } } else fistT = 0;
      }
      // 截断当前这一笔（描红吸附后，手还没抬也不再记）
      const cutLive = () => { if (live) live.pts = [live.pts[live.pts.length - 1]]; };
      // 模拟一笔（自测用）：落笔走完，抬笔停 wait 帧
      function simStroke(pts, wait) { const d = dens(P2(pts), 9); d.forEach(p => sim.push({ x: p.x, y: p.y, down: true })); const l = d[d.length - 1]; for (let i = 0; i < (wait || 1) + 1; i++) sim.push({ x: l.x, y: l.y, down: false }); }
      const inBox = (p, pad) => { const b = L.box, s = Math.min(b.w, b.h) * (1 - 2 * (pad || .15)); return { x: L.cx + (p.x - .5) * s, y: L.cy + (p.y - .5) * s }; };

      /* ---------- 状态条（底部） ---------- */
      const pill = U.h('div', 'sky-pen'); G.hudEl.appendChild(pill); let pillKey = '';
      function pillUpd() {
        const st = !pen.vis ? 'none' : fistT > .15 ? 'fist' : pen.down && !pen.out ? 'down' : 'up', key = st + pen.src + (pen.down && pen.out); if (key === pillKey) return; pillKey = key;
        pill.className = 'sky-pen ' + st;
        const tip = pen.src === 'wrist' ? '没看到手指：手举到胸口以上就落笔' : pen.src === 'mouse' ? '鼠标：按住拖动写字' : '伸食指落笔 · 张开手掌抬笔 · 握拳 2 秒清空';
        pill.innerHTML = st === 'none' ? U.E('🙋') + '<b>把手举到胸前</b><small>伸出食指就能写字</small>' : (st === 'down' ? U.E('✍️') + '<b>落笔中</b>' : st === 'fist' ? U.E('✊') + '<b>握拳清空中…</b>' : U.E('✋') + '<b>' + (pen.down && pen.out ? '到框里写' : '抬笔') + '</b>') + '<small>' + tip + '</small>';
      }

      /* ---------- 公共绘制 ---------- */
      function rr(px, py, w, h, r) { x.beginPath(); x.roundRect(px, py, w, h, r); }
      // 圆体中文字体只有一种字重，加粗会被合成，小字（如「星」）糊成一团：中文大字用常规字重，小字换系统黑体
      const SMALL_FONT = "'Fredoka','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
      function text(t, px, py, size, col, o) { o = o || {}; const cn = /[\u3000-\u9fff\uff00-\uffef]/.test(t); x.font = cn && size < 24 ? '600 ' + size + 'px ' + SMALL_FONT : (cn ? 400 : o.w || 800) + ' ' + size + 'px ' + U.FONT; x.textAlign = o.al || 'center'; x.textBaseline = 'middle'; if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = o.blur || 16; } x.fillStyle = col; x.fillText(t, px, py); x.shadowBlur = 0; }
      function drawPad(grid) {
        const b = L.box, k = L.k; x.save();
        rr(b.x, b.y, b.w, b.h, 26 * k); x.fillStyle = 'rgba(30,40,120,.22)'; x.fill();
        x.setLineDash([16 * k, 12 * k]); x.lineDashOffset = -G.t * 18; x.lineWidth = 3 * k; x.strokeStyle = 'rgba(126,249,255,.55)'; x.shadowColor = '#7ef9ff'; x.shadowBlur = 14 * k; x.stroke(); x.shadowBlur = 0;
        if (grid === 'tian') { x.setLineDash([8 * k, 10 * k]); x.lineWidth = 1.6 * k; x.strokeStyle = 'rgba(255,140,170,.28)'; x.beginPath(); x.moveTo(b.x, L.cy); x.lineTo(b.x + b.w, L.cy); x.moveTo(L.cx, b.y); x.lineTo(L.cx, b.y + b.h); x.moveTo(b.x, b.y); x.lineTo(b.x + b.w, b.y + b.h); x.moveTo(b.x + b.w, b.y); x.lineTo(b.x, b.y + b.h); x.stroke(); }
        if (grid === 'lines') { x.setLineDash([8 * k, 10 * k]); x.lineWidth = 1.6 * k; x.strokeStyle = 'rgba(255,140,170,.3)'; x.beginPath(); [.06, .5, .94].forEach(f => { x.moveTo(b.x, b.y + b.h * f); x.lineTo(b.x + b.w, b.y + b.h * f); }); x.stroke(); }
        x.setLineDash([]);
        // 四角小星
        x.globalCompositeOperation = 'lighter'; [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(([px, py], i) => glow(px, py, (14 + 5 * Math.sin(G.t * 3 + i)) * k, 190, .9));
        x.restore();
      }
      function drawCursor() {
        if (!pen.vis) return; const k = L.k, px = pen.x, py = pen.y, h = live ? live.hue : 190;
        x.save(); x.globalCompositeOperation = 'lighter';
        if (pen.down && !pen.out) { glow(px, py, (44 + 4 * Math.sin(G.t * 12)) * k, h, 1); glow(px, py, 18 * k, 50, 1); } else glow(px, py, 26 * k, 190, .35);
        x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
        x.lineWidth = 3 * k; x.strokeStyle = pen.down && !pen.out ? '#fff' : 'rgba(126,249,255,.95)'; x.beginPath(); x.arc(px, py, (pen.down && !pen.out ? 9 : 17) * k, 0, 7); x.stroke();
        if (!pen.down || pen.out) { x.fillStyle = 'rgba(126,249,255,.95)'; x.beginPath(); x.arc(px, py, 3 * k, 0, 7); x.fill(); }
        if (fistT > .15) { x.strokeStyle = '#ff7aa8'; x.lineWidth = 5 * k; x.beginPath(); x.arc(px, py, 28 * k, -Math.PI / 2, -Math.PI / 2 + Math.min(1, fistT / 2) * 6.283); x.stroke(); }
        if (MODE.offTrack && MODE.offTrack()) { x.strokeStyle = 'rgba(255,90,120,' + (.5 + .5 * Math.sin(G.t * 20)) + ')'; x.lineWidth = 4 * k; x.beginPath(); x.arc(px, py, 34 * k, 0, 7); x.stroke(); }
        text(pen.down && pen.out ? '到框里写' : pen.down ? '落笔中' : fistT > .15 ? '清空中…' : '抬笔', px + 24 * k, py - 22 * k, 15 * k, pen.down ? '#ffe9a8' : 'rgba(200,240,255,.85)', { al: 'left', w: 700 });
        x.restore();
      }
      function finish() {
        if (G.over) return; G.ask(null); G.hud.timer(null);
        G.end({ score: G.hud.scoreV, lines: [U.E('✍️') + ' 写了 <b>' + strokesTotal + '</b> 笔', U.E('🌌') + ' 点亮星座 <b>' + constTotal + '</b> 个'] });
      }

      /* ================= 玩法 1：算式神笔 ================= */
      function mathQ() {
        for (let i = 0; i < 40; i++) { const q = G.q({ zone: 'math' }), c = q.ch[q.ans]; if (c && q.gen !== 'fallback' && /^\d{1,2}$/.test(c.t)) return q; }
        // 题库里没有合适的：自己出加减法
        const gr = M.Q.grade(), mx = gr <= 1 ? 10 : gr === 2 ? 20 : 50, plus = Math.random() < .55;
        let a = 1 + Math.floor(Math.random() * mx), b = Math.floor(Math.random() * mx); if (plus && a + b > 99) b = 99 - a; if (!plus && b > a) [a, b] = [b, a];
        const r = plus ? a + b : a - b;
        return { p: a + (plus ? ' + ' : ' - ') + b + ' = ?', say: a + (plus ? '加' : '减') + b + '等于几', ch: [{ t: String(r), ok: true }], ans: 0, peHtml: '' };
      }
      function MathMode() {
        let q = null, ans = '', slots = [], cur = [], phase = 'idle', pend = null, lastUp = 0, tries = 0, qT = 0, done = 0, said = 0, listenH = null, unsureT = -99;
        const stopL = () => { if (listenH) { try { listenH.stop(); } catch (e) {} listenH = null; } };
        const slotGeom = () => { const n = Math.max(1, ans.length), ss = Math.min(L.box.w * .36, 130 * L.k), gap = 14 * L.k, x0 = L.box.x + L.box.w + 70 * L.k; return { n, ss, gap, x0, y0: L.cy - ss / 2, at: i => ({ x: x0 + i * (ss + gap), y: L.cy - ss / 2 }) }; };
        // 把一位数字的笔迹缩放进答案格
        function inSlot(strokes, i) {
          const g = slotGeom(), o = g.at(i), b = bbox([].concat(...strokes)), s = g.ss * .72 / Math.max(b.w, b.h, 1), mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
          return strokes.map(st => st.map(p => ({ x: o.x + g.ss / 2 + (p.x - mx) * s, y: o.y + g.ss / 2 + (p.y - my) * s })));
        }
        function next() {
          stopL(); if (done >= QN) return finish();
          q = mathQ(); ans = String(q.ch[q.ans].t); slots = []; cur = []; pend = null; tries = 0; qT = G.t; phase = 'write';
          inkClear('dust'); G.ask(q);
          if (done === 0) G.after(2.4, () => G.say('在空中写出答案'));
        }
        function recog() {
          const res = REC.recognize(cur.map(s => s.pts));
          // 太没把握（乱涂 / 笔画太多）：不瞎猜，请小朋友重写
          if (!res.length || res[0].conf < .2 || cur.length > 4) { cur = []; inkClear('dust'); G.pop('没看清，再写一次', 'bad'); if (G.t - unsureT > 10) { unsureT = G.t; G.say('没看清，再写一次吧'); } return; }
          pend = { c: res.slice(0, 3), t0: G.t, dur: res[0].conf > .7 ? 1.7 : 2.6 }; phase = 'confirm'; G.sfx('magic', .5);
          if (said++ < 2) G.say('是这个数吗');
          stopL();
          listenH = G.listen({ choices: [{ t: '对', alts: ['对的', '是的', '是', '没错', '正确'] }, { t: '不对', alts: ['不是', '错了', '重写', '不对不对'] }], onResult: r => { if (!pend || !r || !r.text) return; if (/不|错|重/.test(r.text)) reject(true); else if (r.idx >= 0) accept(); } });
        }
        function accept() {
          if (!pend) return; stopL(); const d = pend.c[0].name; pend = null;
          slots.push({ d, strokes: cur.map(s => s.pts), hue: cur[0] ? cur[0].hue : 50 }); cur = []; inkStrokes = []; inkRedraw();
          const g = slotGeom(), o = g.at(slots.length - 1); emit(o.x + g.ss / 2, o.y + g.ss / 2, 50, 24, { v0: 60, v1: 220, l0: .4, l1: .8 }); G.sfx('coin', .6);
          if (slots.length >= ans.length) check(); else phase = 'write';
        }
        function reject(voice) { stopL(); pend = null; cur = []; inkClear('dust'); phase = 'write'; if (voice) { G.pop('那就重新写一遍', 'good'); G.say('那就重新写一遍'); } }
        function reveal() { done++; phase = 'reveal'; stopL(); pend = null; G.pop('答案是 ' + ans, 'miss'); G.after(2.8, next); }
        function check() {
          const val = slots.map(s => s.d).join(''), g = slotGeom();
          if (val === ans) {
            done++; phase = 'result'; const o = g.at((slots.length - 1) / 2), cx = o.x + g.ss / 2, cy = o.y + g.ss / 2;
            const cb = G.hud.combo(G.hud.comboV + 1); G.hud.add(100 + Math.min(5, cb - 1) * 20); G.right(cx, cy);
            G.pop(U.pick(['答对啦！', '太棒了！', '神笔！']), 'perfect'); G.say('写对了，真棒'); fireworks(2 + Math.min(4, cb)); shake = .45;
            G.after(1.3, () => { const sts = []; slots.forEach((s, i) => inSlot(s.strokes, i).forEach(st => sts.push(st))); makeConst(sts, ans, 50); slots = []; });
            G.after(2.8, next);
          } else {
            tries++; G.wrong(); G.hud.combo(0); shake = .6;
            if (tries < 2) { phase = 'result'; G.pop('再想想哦', 'bad'); G.say('再想想哦'); G.after(1.4, () => { slots = []; phase = 'write'; }); }
            else reveal();
          }
        }
        return {
          next,
          down() { if (phase === 'confirm') reject(false); },
          stroke(s) { if (phase !== 'write') return; cur.push(s); inkAdd(s); lastUp = G.t; },
          clear() {
            if (pend) reject(false); else if (cur.length) { cur = []; inkClear('dust'); }
            else if (slots.length && phase === 'write') { slots.pop(); G.pop('擦掉一位', 'good'); }
          },
          tick() {
            if (phase === 'write' && cur.length && !pen.down && G.t - lastUp > 1.0) recog();
            if (phase === 'confirm' && pend && G.t - pend.t0 > pend.dur) accept();
            if ((phase === 'write' || phase === 'confirm') && G.t - qT > 75) reveal();
          },
          draw() {
            drawPad();
            const k = L.k, b = L.box;
            if (phase === 'write' && !cur.length && !live) text('在框里写第 ' + (slots.length + 1) + ' 位数字', L.cx, L.cy, 20 * k, 'rgba(200,230,255,' + (.35 + .15 * Math.sin(G.t * 3)) + ')', { w: 700 });
            if (ans.length > 1) text('第 ' + Math.min(ans.length, slots.length + 1) + ' / ' + ans.length + ' 位', b.x + 16 * k, b.y + 22 * k, 15 * k, 'rgba(200,230,255,.7)', { al: 'left', w: 700 });
            // 答案格
            const g = slotGeom();
            text('=', g.x0 - 36 * k, L.cy, 54 * k, '#ffe9a8', { glow: '#ffb020' });
            for (let i = 0; i < g.n; i++) {
              const o = g.at(i), filled = slots[i], isP = !filled && pend && i === slots.length, act = !filled && i === slots.length && phase === 'write';
              x.save(); rr(o.x, o.y, g.ss, g.ss, 18 * k); x.fillStyle = 'rgba(20,24,70,.6)'; x.fill();
              x.lineWidth = 3 * k; x.strokeStyle = phase === 'reveal' ? '#ffd166' : isP ? 'rgba(255,209,102,' + (.5 + .5 * Math.sin(G.t * 8)) + ')' : act ? 'rgba(126,249,255,' + (.55 + .35 * Math.sin(G.t * 4)) + ')' : 'rgba(126,249,255,.35)';
              if (isP || act) x.setLineDash([10 * k, 8 * k]); x.stroke(); x.restore();
              if (phase === 'reveal') text(ans[i], o.x + g.ss / 2, o.y + g.ss / 2 + 3 * k, g.ss * .7, '#ffd166', { glow: '#ff9f1a', blur: 24 });
              else if (filled) inSlot(filled.strokes, i).forEach(st => strokeInk(x, st, filled.hue, true, .55));
              else if (isP) text(pend.c[0].name + '?', o.x + g.ss / 2, o.y + g.ss / 2 + 3 * k, g.ss * .5, 'rgba(255,233,168,.85)');
            }
            // 识别候选（前三 + 置信度）
            if (pend) {
              const pw = 190 * k, ch = 58 * k, gp = 12 * k, px = Math.max(12, b.x - pw - 34 * k), py = L.cy - (ch * 3 + gp * 2) / 2;
              text('我认出的是', px + pw / 2, py - 26 * k, 18 * k, '#bfe9ff', { w: 700 });
              pend.c.forEach((c, i) => {
                const y = py + i * (ch + gp); x.save(); rr(px, y, pw, ch, 14 * k); x.fillStyle = i ? 'rgba(20,24,70,.7)' : 'rgba(60,44,10,.8)'; x.fill(); x.lineWidth = (i ? 2 : 3) * k; x.strokeStyle = i ? 'rgba(126,249,255,.35)' : '#ffd166'; x.stroke(); x.restore();
                text(c.name, px + 32 * k, y + ch / 2 + 2 * k, 40 * k, i ? '#cfe8ff' : '#ffe9a8', i ? null : { glow: '#ffb020' });
                const bw = pw - 110 * k, bx = px + 62 * k, by = y + ch / 2 - 6 * k; x.fillStyle = 'rgba(255,255,255,.12)'; rr(bx, by, bw, 12 * k, 6 * k); x.fill();
                x.fillStyle = i ? '#7ef9ff' : '#ffd166'; rr(bx, by, Math.max(4, bw * c.conf), 12 * k, 6 * k); x.fill();
                text(Math.round(c.conf * 100) + '%', px + pw - 24 * k, y + ch / 2 + 1 * k, 15 * k, '#fff', { w: 700 });
                if (!i) { x.strokeStyle = '#ffd166'; x.lineWidth = 3 * k; x.beginPath(); x.arc(px + 32 * k, y + ch / 2, 25 * k, -Math.PI / 2, -Math.PI / 2 + Math.min(1, (G.t - pend.t0) / pend.dur) * 6.283); x.stroke(); }
              });
              text('说「对」或等一下就确认', px + pw / 2, py + ch * 3 + gp * 2 + 22 * k, 14 * k, 'rgba(200,230,255,.75)', { w: 600 });
              text('不对？直接重写 / 说「不对」', px + pw / 2, py + ch * 3 + gp * 2 + 44 * k, 14 * k, 'rgba(200,230,255,.75)', { w: 600 });
            }
          },
          // 自测：写出正确答案（第一题第一次故意写错一次）
          auto() {
            if (phase !== 'write' || cur.length || live) return;
            const want = done === 0 && tries === 0 && slots.length === 0 ? String((+ans[0] + 1) % 10) : ans[slots.length]; if (want == null) return;
            const v = perturb(U.pick(DIGITS[want])), sts = v.map(st => st.map(p => inBox(p, .2)));
            sts.forEach((st, i) => simStroke(st, i < sts.length - 1 ? 6 : 2));
          },
          state: () => ({ phase, ans, slots: slots.map(s => s.d).join(''), done, pend: pend && pend.c.map(c => c.name + ':' + c.conf.toFixed(2)).join(' ') }),
        };
      }

      /* ================= 玩法 2：描红神笔 ================= */
      function TraceMode() {
        const zone = G.zone, cnK = Object.keys(CN), enK = Object.keys(EN);
        const byN = (a, b) => (CN[a] || EN[a]).length - (CN[b] || EN[b]).length;
        const list = (zone === 'en' ? U.shuffle(enK).slice(0, QN) : zone === 'mix' ? U.shuffle(cnK).slice(0, QN / 2).concat(U.shuffle(enK).slice(0, QN / 2)) : U.shuffle(cnK).slice(0, QN)).sort(byN);
        let gi = -1, g = null, paths = [], k = 0, prog = 0, on = false, offT = 0, warnT = -9, hintT = -9, sayT = -9, phase = 'idle', t0 = 0, snapT = [], goldT = 0;
        function setup() { if (!g) return; const b = L.box; paths = g.strokes.map(st => dens(P2(st).map(p => ({ x: b.x + p.x * b.w, y: b.y + p.y * b.h })), b.w / 45)); }
        function next() {
          gi++; if (gi >= list.length) return finish();
          const ch = list[gi]; g = { ch, strokes: CN[ch] || EN[ch], lang: CN[ch] ? 'zh' : 'en', hidden: false }; setup(); k = 0; prog = 0; on = false; offT = 0; snapT = []; phase = 'trace'; t0 = G.t;
          inkClear('dust');
          G.ask({ p: '描一描「' + ch + '」 共 ' + g.strokes.length + ' 笔', say: '' }, { say: false });
          if (Core.Voice.has(ch, g.lang)) G.say(ch, g.lang);
          if (gi === 0) G.after(1.4, () => G.say('跟着虚线描一描'));
        }
        function strokeDone() {
          const P = paths[k]; snapT[k] = G.t; k++; prog = 0; on = false; offT = 0;
          G.sfx('chime', .7); G.hud.add(10); P.forEach((p, i) => { if (i % 3 === 0) emit(p.x, p.y, 190 + k * 25, 2, { v0: 20, v1: 90, l0: .4, l1: .8 }); });
          inkStrokes = []; inkRedraw(); cutLive(); // 吸附：手写的笔迹换成标准笔画
          if (k >= paths.length) charDone();
        }
        function charDone() {
          phase = 'done'; goldT = G.t; const cb = G.hud.combo(G.hud.comboV + 1);
          G.hud.add(50 + Math.max(0, Math.round(30 - (G.t - t0)))); G.right(L.cx, L.cy);
          G.pop(U.pick(['写得真漂亮！', '金光闪闪！', '神笔小画家！']), 'perfect');
          if (Core.Voice.has(g.ch, g.lang)) G.say(g.ch, g.lang); else G.say('写得真漂亮');
          fireworks(2 + Math.min(3, cb)); shake = .35; flash = .25;
          G.after(2.2, () => { makeConst(paths, g.ch, 45); g.hidden = true; });
          G.after(2.8, next);
        }
        const hint = (t, sayIt) => { if (G.t - hintT < 2.5) return; hintT = G.t; G.pop(t, 'good'); if (sayIt && G.t - sayT > 8) { sayT = G.t; sayIt(); } };
        return {
          next, layout: setup,
          offTrack: () => on && offT > .35,
          down() {}, stroke(s) { if (phase === 'trace') inkAdd(s); },
          clear() { if (phase !== 'trace') return; k = 0; prog = 0; on = false; snapT = []; inkClear('dust'); },
          tick(dt) {
            if (phase !== 'trace') return;
            if (G.t - t0 > 50) { phase = 'skip'; G.pop('我们看下一个', 'miss'); G.after(1.5, next); return; }
            const P = paths[k]; if (!P) return;
            const tol = L.box.w * .12, tolS = L.box.w * .15;
            if (!(pen.down && pen.vis)) { on = false; return; }
            if (!on) {
              if (pd(pen, P[prog]) < tolS) { on = true; offT = 0; }
              else if (prog === 0) {
                // 起笔放宽：前 20% 的任何位置都行
                let bi = -1, bd = tol; for (let i = 0; i <= Math.floor(P.length * .2); i++) { const d = pd(pen, P[i]); if (d < bd) { bd = d; bi = i; } }
                if (bi >= 0) { on = true; prog = bi; offT = 0; } else hint('从闪烁的小圆点开始', () => G.say('从闪烁的小圆点开始'));
              } else hint('从闪烁的小圆点接着写');
            }
            if (on) {
              const end = Math.min(P.length - 1, prog + Math.ceil(P.length * .3) + 3); let bi = prog, bd = Infinity;
              for (let i = prog; i <= end; i++) { const d = pd(pen, P[i]); if (d < bd) { bd = d; bi = i; } }
              if (bd < tol) { prog = Math.max(prog, bi); offT = 0; }
              else { offT += dt; if (offT > .35 && G.t - warnT > 2.5) { warnT = G.t; G.pop('沿着虚线写哦', 'bad'); G.sfx('miss', .35); if (G.t - sayT > 8) { sayT = G.t; G.say('沿着虚线写哦'); } } }
              if (prog >= P.length - 1 - Math.max(1, Math.floor(P.length * .08))) strokeDone();
            }
          },
          draw() {
            drawPad(g && g.lang === 'en' ? 'lines' : 'tian');
            if (!g || g.hidden) return;
            const kk = L.k, gold = phase === 'done', w = L.box.w;
            x.save(); x.lineCap = x.lineJoin = 'round';
            const line = P => { x.beginPath(); x.moveTo(P[0].x, P[0].y); for (let i = 1; i < P.length; i++) x.lineTo(P[i].x, P[i].y); };
            // 底字（描红模板）
            paths.forEach(P => { line(P); x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = w * .09; x.stroke(); });
            paths.forEach((P, i) => {
              if (i < k || gold) {
                const age = G.t - (snapT[i] || 0), pop = age < .4 ? 1 + (.4 - age) * 1.2 : 1, hh = gold ? 45 : 190 + i * 25;
                if (gold) { x.shadowColor = '#ffb020'; x.shadowBlur = (24 + 10 * Math.sin((G.t - goldT) * 6)) * kk; }
                line(P); x.strokeStyle = gold ? 'rgba(255,190,60,.55)' : 'hsla(' + hh + ',100%,60%,.4)'; x.lineWidth = w * .075 * pop; x.stroke(); x.shadowBlur = 0;
                line(P); x.strokeStyle = gold ? '#ffe9a8' : 'hsl(' + hh + ',100%,78%)'; x.lineWidth = w * .03 * pop; x.stroke();
              } else if (i === k) {
                x.setLineDash([w * .035, w * .03]); x.lineDashOffset = -G.t * 60; line(P); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = w * .022; x.stroke(); x.setLineDash([]);
                if (prog > 0) { line(P.slice(0, prog + 1)); x.strokeStyle = 'rgba(126,249,255,.45)'; x.lineWidth = w * .07; x.stroke(); line(P.slice(0, prog + 1)); x.strokeStyle = '#e8fdff'; x.lineWidth = w * .025; x.stroke(); }
                // 起点 / 续写点：闪烁小圆点 + 方向箭头 + 笔画序号
                const sp = P[prog], bl = .5 + .5 * Math.sin(G.t * 8), ah = P[Math.min(P.length - 1, prog + 4)], an = Math.atan2(ah.y - sp.y, ah.x - sp.x);
                x.globalCompositeOperation = 'lighter'; glow(sp.x, sp.y, (30 + 14 * bl) * kk, 50, .9); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
                x.fillStyle = '#ffd166'; x.beginPath(); x.arc(sp.x, sp.y, (9 + 4 * bl) * kk, 0, 7); x.fill();
                x.strokeStyle = '#fff'; x.lineWidth = 2.5 * kk; x.beginPath(); x.arc(sp.x, sp.y, (18 + 8 * bl) * kk, 0, 7); x.stroke();
                if (prog === 0 || !on) { const ax = sp.x + Math.cos(an) * 40 * kk, ay = sp.y + Math.sin(an) * 40 * kk; x.save(); x.translate(ax, ay); x.rotate(an); x.fillStyle = 'rgba(255,233,168,.9)'; x.beginPath(); x.moveTo(12 * kk, 0); x.lineTo(-6 * kk, -9 * kk); x.lineTo(-6 * kk, 9 * kk); x.closePath(); x.fill(); x.restore(); }
                text(String(i + 1), sp.x - 26 * kk, sp.y - 26 * kk, 18 * kk, '#ffe9a8', { glow: '#000', blur: 6 });
              } else { x.setLineDash([w * .02, w * .03]); line(P); x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = w * .014; x.stroke(); x.setLineDash([]); }
            });
            x.restore();
            text('第 ' + Math.min(k + 1, paths.length) + ' / ' + paths.length + ' 笔', L.box.x + 16 * kk, L.box.y + 22 * kk, 15 * kk, 'rgba(200,230,255,.75)', { al: 'left', w: 700 });
          },
          auto() {
            if (phase !== 'trace' || sim.length || live) return; const P = paths[k]; if (!P) return;
            simStroke(P.slice(prog).map(p => ({ x: p.x + U.rand(-4, 4), y: p.y + U.rand(-4, 4) })), 4);
          },
          state: () => ({ phase, ch: g && g.ch, k, n: paths.length, prog, gi }),
        };
      }

      /* ================= 玩法 3：你画我猜 ================= */
      function DrawMode() {
        const list = U.shuffle(DRAW).slice(0, QN); let gi = -1, item = null, phase = 'idle', t0 = 0, lastUp = 0, strokes = [], res = null;
        function next() {
          gi++; if (gi >= list.length) return finish();
          item = list[gi]; strokes = []; res = null; inkClear('dust'); phase = 'draw'; t0 = G.t; lastUp = G.t;
          G.ask({ p: '画一画：' + item.w, say: item.w, peHtml: '<div class="sky-qe">' + U.E(item.e) + '</div>' });
          if (gi === 0) G.after(1.6, () => G.say('画好了就举起双手'));
        }
        function judge() {
          if (phase !== 'draw') return; phase = 'judge'; G.hud.timer(null);
          const shapes = strokes.map(s => shapeOf(s.pts)).filter(t => t !== 'dot'), sc = shapes.length ? drawScore(shapes, item.need) : 0;
          let guess = item, gs = sc + .1; DRAW.forEach(d => { const v = drawScore(shapes, d.need); if (v > gs) { gs = v; guess = d; } });
          res = { shapes, sc, guess, t: G.t, stars: sc >= .75 ? 3 : sc >= .45 ? 2 : shapes.length ? 1 : 0 };
          if (shapes.length && sc >= .3) {
            const cb = G.hud.combo(G.hud.comboV + 1); G.right(L.cx, L.cy); G.hud.add(Math.round(40 + 60 * sc));
            G.pop(sc >= .75 ? '画得太像了！' : '好有创意！', 'perfect'); G.say('画得真棒'); fireworks(sc >= .75 ? 4 : 2); shake = .3;
          } else { G.hud.combo(0); G.pop(shapes.length ? '好有想象力！' : '还没画呢', 'good'); }
          G.after(3, () => inkClear('fly', item.w));
          G.after(3.6, next);
        }
        return {
          next,
          down() {},
          stroke(s) { if (phase !== 'draw') return; strokes.push(s); inkAdd(s); lastUp = G.t; },
          clear() { if (phase === 'draw') { strokes = []; inkClear('dust'); lastUp = G.t; } },
          handsUp() { if (phase === 'draw' && strokes.length) judge(); },
          tick() {
            if (phase !== 'draw') return; const left = 35 - (G.t - t0); G.hud.timer(left);
            if (left <= 0 || (strokes.length && !pen.down && G.t - lastUp > 3.5)) judge();
          },
          draw() {
            drawPad(); const k = L.k, b = L.box;
            if (!item) return;
            const im = U.emoImg(item.e, '3d'); if (im.complete && im.naturalWidth) { x.globalAlpha = phase === 'draw' && !strokes.length ? .9 : .5; x.drawImage(im, b.x + 14 * k, b.y + 14 * k, 64 * k, 64 * k); x.globalAlpha = 1; }
            text(item.w, b.x + 90 * k, b.y + 46 * k, 26 * k, '#ffe9a8', { al: 'left', glow: '#ff9f1a' });
            if (phase === 'draw' && !strokes.length && !live) text('在框里画一个' + item.w, L.cx, L.cy, 22 * k, 'rgba(200,230,255,' + (.35 + .15 * Math.sin(G.t * 3)) + ')', { w: 700 });
            // 停笔倒计时：停 3.5 秒算画好
            if (phase === 'draw' && strokes.length && !pen.down) { const p = Math.min(1, (G.t - lastUp) / 3.5), px = b.x + b.w - 40 * k, py = b.y + 40 * k; x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 5 * k; x.beginPath(); x.arc(px, py, 20 * k, 0, 7); x.stroke(); x.strokeStyle = '#ffd166'; x.beginPath(); x.arc(px, py, 20 * k, -Math.PI / 2, -Math.PI / 2 + p * 6.283); x.stroke(); text('停笔交卷', px - 30 * k, py, 14 * k, 'rgba(255,233,168,.85)', { al: 'right', w: 700 }); }
          },
          drawTop() {
            if (!res) return; const k = L.k, b = L.box, a = Math.min(1, (G.t - res.t) * 3), sc = .8 + .2 * ease(a);
            const w = Math.min(b.w * .9, 560 * k), h = 150 * k, px = L.cx - w / 2, py = b.y + b.h - h - 18 * k;
            x.save(); x.globalAlpha = a; x.translate(L.cx, py + h / 2); x.scale(sc, sc); x.translate(-L.cx, -(py + h / 2));
            rr(px, py, w, h, 22 * k); x.fillStyle = 'rgba(12,14,48,.86)'; x.fill(); x.lineWidth = 3 * k; x.strokeStyle = '#ffd166'; x.stroke();
            const gim = U.emoImg(res.guess.e, '3d'); if (gim.complete && gim.naturalWidth) x.drawImage(gim, px + 20 * k, py + 22 * k, 70 * k, 70 * k);
            text(res.guess === item ? '我猜你画的是：' + item.w + '！' : '我猜是' + res.guess.w + '？原来是' + item.w + '！', px + 104 * k, py + 40 * k, 24 * k, '#fff', { al: 'left' });
            const cnt = {}; res.shapes.forEach(s => { cnt[s] = (cnt[s] || 0) + 1; });
            text(Object.keys(cnt).map(s => SHAPE_NAME[s] + '×' + cnt[s]).join('  ') || '还没有画哦', px + 104 * k, py + 78 * k, 17 * k, '#bfe9ff', { al: 'left', w: 600 });
            text('★★★'.slice(0, res.stars) + '☆☆☆'.slice(0, 3 - res.stars), px + 104 * k, py + 116 * k, 30 * k, '#ffd166', { al: 'left', glow: '#ff9f1a' });
            x.restore();
          },
          auto() {
            if (phase !== 'draw' || strokes.length || sim.length || live) return;
            const C2 = (cx, cy, r) => ARC(cx, cy, r, r, -90, 270).map(p => ({ x: p[0], y: p[1] }));
            const SH = { circle: i => C2(.35 + i * .12, .4 + (i % 2) * .15, .14), line: i => [{ x: .7, y: .2 + i * .15 }, { x: .92, y: .25 + i * .15 }], curve: i => ARC(.5, .5 + i * .1, .3, .2, 180, 360).map(p => ({ x: p[0], y: p[1] })), triangle: () => [{ x: .5, y: .1 }, { x: .8, y: .45 }, { x: .2, y: .45 }, { x: .5, y: .1 }], rect: () => [{ x: .25, y: .5 }, { x: .75, y: .5 }, { x: .75, y: .9 }, { x: .25, y: .9 }, { x: .25, y: .5 }], star: () => { const o = []; for (let i = 0; i <= 5; i++) { const a = (-90 + 144 * i) * D2R; o.push({ x: .5 + .4 * Math.cos(a), y: .5 + .4 * Math.sin(a) }); } return o; } };
            const b = L.box, map = p => ({ x: b.x + b.w * (.1 + p.x * .8), y: b.y + b.h * (.1 + p.y * .8) });
            Object.keys(item.need).forEach(kk => { for (let i = 0; i < item.need[kk]; i++) simStroke(SH[kk](i).map(map), 8); });
          },
          state: () => ({ phase, w: item && item.w, n: strokes.length, res: res && { sc: +res.sc.toFixed(2), shapes: res.shapes.join(','), guess: res.guess.w } }),
        };
      }

      const MODE = mode === 'trace' ? TraceMode() : mode === 'draw' ? DrawMode() : MathMode();
      ready = true; layout();
      G.on('handsUp', () => { if (MODE.handsUp) MODE.handsUp(); });
      Core.Audio2.playMusic('magic');
      window.__skySim = { auto: () => { if (!simOn) { simOn = true; live = null; wasDown = false; } if (!G.over && !sim.length && MODE.auto) MODE.auto(); }, state: () => Object.assign({ mode, sim: sim.length, pen: pen.src + (pen.down ? ':down' : ':up') }, MODE.state()), test };
      G.onDispose(() => { delete window.__skySim; });

      /* ---------- 每帧 ---------- */
      G.loop(dt => {
        penTick(dt); MODE.tick(dt); pillUpd();
        shake = Math.max(0, shake - dt * 1.8); flash = Math.max(0, flash - dt * 1.5);
        // 墨水闪烁：沿笔迹随机冒星光
        for (let i = 0; i < 2 && inkStrokes.length; i++) { const s = U.pick(inkStrokes), p = U.pick(s.pts); parts.push({ x: p.x + U.rand(-6, 6), y: p.y + U.rand(-6, 6), vx: 0, vy: -10, life: .7, max: .7, r: U.rand(6, 13) * L.k, h: s.hue, g: 0, drag: 0 }); }
        parts.forEach(p => { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
        for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
        rockets.forEach(r => {
          r.y -= r.v * dt; emit(r.x, r.y, r.h, 1, { v0: 5, v1: 30, l0: .2, l1: .45, r0: 3, r1: 6 });
          if (r.y <= r.ty) { r.dead = 1; emit(r.x, r.y, r.h, 70, { v0: 80, v1: 360, l0: .8, l1: 1.6, g: 170, drag: 1.3, r0: 5, r1: 11, rh: 30 }); emit(r.x, r.y, 50, 18, { v0: 20, v1: 120, l0: .3, l1: .6, r0: 8, r1: 16 }); G.sfx('pop', .5); }
        });
        for (let i = rockets.length - 1; i >= 0; i--) if (rockets[i].dead) rockets.splice(i, 1);
        meteorT -= dt; if (meteorT <= 0) { meteorT = U.rand(3, 7); meteors.push({ x: C.W * U.rand(.3, 1.05), y: C.H * U.rand(0, .3), vx: -U.rand(600, 900) * L.k, vy: U.rand(220, 360) * L.k, life: 1.1 }); }
        meteors.forEach(m => { m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt; }); for (let i = meteors.length - 1; i >= 0; i--) if (meteors[i].life <= 0) meteors.splice(i, 1);
        for (let i = consts.length - 1; i >= 0; i--) if (consts[i].dying && G.t - consts[i].dying > .8) consts.splice(i, 1);

        // ---- 画 ----
        const k = L.k; x.save();
        if (shake) x.translate(U.rand(-1, 1) * shake * 14 * k, U.rand(-1, 1) * shake * 14 * k);
        x.drawImage(bg, 0, 0, C.W, C.H);
        x.globalCompositeOperation = 'lighter';
        twinkles.forEach(t => { const a = Math.pow(.5 + .5 * Math.sin(G.t * t.sp + t.ph), 2); glow(t.x, t.y, t.r * (.6 + a * .6) * k, t.h, .25 + a * .7); });
        meteors.forEach(m => { const a = Math.min(1, m.life * 2); x.globalAlpha = a; const gr = x.createLinearGradient(m.x, m.y, m.x - m.vx * .14, m.y - m.vy * .14); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(126,249,255,0)'); x.strokeStyle = gr; x.lineWidth = 3 * k; x.lineCap = 'round'; x.beginPath(); x.moveTo(m.x, m.y); x.lineTo(m.x - m.vx * .14, m.y - m.vy * .14); x.stroke(); glow(m.x, m.y, 12 * k, 200, a); });
        // 星座
        consts.forEach(c => {
          const p = ease(U.clamp((G.t - c.t0) / 1.6, 0, 1)), sl = SLOTS[c.slot], tx = sl[0] * C.W, ty = sl[1] * C.H, fade = c.dying ? Math.max(0, 1 - (G.t - c.dying) / .8) : 1;
          const pos = c.nodes.map(n => [U.lerp(n.sx, tx + n.ox * c.size, p), U.lerp(n.sy, ty + n.oy * c.size, p) - Math.sin(p * Math.PI) * 90 * k]);
          x.globalAlpha = (.25 + .3 * p) * fade; x.strokeStyle = 'hsl(' + c.h + ',100%,82%)'; x.lineWidth = (1.4 + 3 * (1 - p)) * k; x.beginPath(); c.edges.forEach(([a, b]) => { x.moveTo(pos[a][0], pos[a][1]); x.lineTo(pos[b][0], pos[b][1]); }); x.stroke();
          c.nodes.forEach((n, i) => { const tw = .65 + .35 * Math.sin(G.t * 3 + n.ph); glow(pos[i][0], pos[i][1], (7 + 12 * (1 - p)) * k * n.r * (.8 + tw * .4), c.h, fade * tw); });
          if (p >= 1 && c.label) { x.globalCompositeOperation = 'source-over'; x.globalAlpha = .75 * fade; text(c.label, tx, ty + c.size * .62 + 10 * k, 15 * k, '#ffe9a8', { w: 700 }); x.globalCompositeOperation = 'lighter'; }
        });
        x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
        MODE.draw();
        // 墨水层（轻微呼吸）+ 正在写的这一笔
        x.globalCompositeOperation = 'lighter'; x.globalAlpha = .88 + .12 * Math.sin(G.t * 2.6); x.drawImage(inkCv, 0, 0, C.W, C.H); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        if (live && live.pts.length) strokeInk(x, live.pts, live.hue, true);
        if (MODE.drawTop) MODE.drawTop();
        x.globalCompositeOperation = 'lighter';
        parts.forEach(p => { const a = p.life / p.max; glow(p.x, p.y, p.r * (.5 + .5 * a), p.h, a); });
        rockets.forEach(r => glow(r.x, r.y, 14 * k, r.h, 1));
        x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
        drawCursor();
        if (flash) { x.fillStyle = 'rgba(255,240,200,' + flash + ')'; x.fillRect(0, 0, C.W, C.H); }
        x.restore();
      });
      MODE.next();
    },
  });
})();
