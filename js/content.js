/* 题目生成器：纯函数，不依赖 DOM。所有生成器 (grade) => 数据 */
(function () {
  const D = window.DATA;
  const R = {
    int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
    pick: (a) => a[Math.floor(Math.random() * a.length)],
    shuffle: (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    sample: (a, n) => R.shuffle(a).slice(0, n),
  };
  // 卡片: t 文本, e 图(emoji 或 html:), s 朗读, l 语言, sub 小字
  const card = (t, e, s, l, sub) => ({ t: t == null ? '' : String(t), e: e || '', s: s == null ? (t == null ? '' : String(t)) : s, l: l || 'zh', sub: sub || '' });
  const N = 8; // 每局题数
  const byG = (arr, g, idx) => { const f = arr.filter(x => (x[idx] || 0) <= g); return f.length >= 4 ? f : arr.slice(0, Math.max(4, f.length)); };
  const allWords = (g, cats) => {
    let out = [];
    (cats || Object.keys(D.W)).forEach(k => { const c = D.W[k]; c.items.forEach(it => { if (it[4] <= g) out.push({ k, e: it[0], zh: it[1], py: it[2], en: it[3] }); }); });
    return out;
  };
  // 通用：从池中出选择题
  function choiceQ(pool, n, make, nc) {
    nc = nc || 4;
    const qs = [], picked = R.sample(pool, Math.min(n, pool.length));
    while (picked.length < n) picked.push(R.pick(pool));
    picked.forEach(item => {
      const others = R.sample(pool.filter(x => x !== item), nc - 1);
      qs.push(make(item, others));
    });
    return qs;
  }
  const opts = (right, wrongs) => R.shuffle([Object.assign({}, right, { ok: true })].concat(wrongs.map(w => Object.assign({}, w, { ok: false }))));
  const uniq = (arr, key) => { const s = new Set(); return arr.filter(x => { const k = key(x); if (s.has(k)) return false; s.add(k); return true; }); };

  const html = {
    dots: (n, e) => 'html:<div class="dots">' + Array.from({ length: n }, () => '<i data-emo="' + e + '"></i>').join('') + '</div>',
    clock: (h, m) => 'html:<div class="aclock" data-h="' + h + '" data-m="' + m + '"></div>',
    shape: (s) => 'html:<div class="shape shape-' + s + '"></div>',
    pie: (a, b) => 'html:<div class="pie" data-a="' + a + '" data-b="' + b + '"></div>',
    big: (t) => 'html:<div class="bigtxt">' + t + '</div>',
  };
  const numSay = (n) => String(n);

  const G = {};
  const Q = (p, ch, extra) => Object.assign({ p, ch }, extra || {});

  /* ================= 语文 ================= */
  G.hz_pic = g => choiceQ(byG(D.HANZI, g, 3), N, (h, o) => Q('这幅图是哪个字？', opts(card(h[0], '', h[0], 'zh', h[1]), o.map(x => card(x[0], '', x[0], 'zh', x[1]))), { pe: h[2], ps: '这幅图是哪个字', big: true }));
  G.hz_read = g => choiceQ(byG(D.HANZI, g, 3), N, (h, o) => Q('「' + h[0] + '」是哪一幅图？', opts(card('', h[2], h[0]), o.map(x => card('', x[2], x[0]))), { pt: h[0], ps: h[0] + '，是哪一幅图' }));
  const hzU = g => uniq(byG(D.HANZI, g, 3), x => x[1]);
  G.py_hz = g => choiceQ(hzU(g), N, (h, o) => Q('拼音「' + h[1] + '」是哪个字？', opts(card(h[0]), o.map(x => card(x[0]))), { pt: h[1], ps: h[0], latin: true }));
  G.hz_py = g => choiceQ(hzU(g), N, (h, o) => Q('「' + h[0] + '」的拼音是？', opts(card(h[1], '', h[0]), o.map(x => card(x[1], '', x[0]))), { pt: h[0], ps: h[0] + '，的拼音是', latinCh: true }));
  G.sm_listen = g => choiceQ(D.SHENGMU, N, (s, o) => Q('听一听，是哪个声母？', opts(card(s[0], '', s[1]), o.map(x => card(x[0], '', x[1]))), { listen: s[1], ps: s[1], latinCh: true }));
  G.ym_listen = g => choiceQ(D.YUNMU, N, (s, o) => Q('听一听，是哪个韵母？', opts(card(s[0], '', s[1]), o.map(x => card(x[0], '', x[1]))), { listen: s[1], ps: s[1], latinCh: true }));
  G.pindu = g => choiceQ(D.PINDU, N, (s, o) => Q(s[0] + ' + ' + s[1] + ' = ?', opts(card(s[2], '', s[3]), o.map(x => card(x[2], '', x[3]))), { pt: s[0] + ' + ' + s[1], ps: '拼一拼', latin: true, latinCh: true, ex: s[2] + '，' + s[3] }));
  G.py_pic = g => choiceQ(D.PINDU, N, (s, o) => Q('拼读「' + s[2] + '」，选出对应的图', opts(card('', s[4], s[3]), o.map(x => card('', x[4], x[3]))), { pt: s[2], ps: s[3], latin: true }));
  G.fanyi = g => choiceQ(byG(D.FANYI, g, 2), N, (p, o) => { const flip = Math.random() < .5, a = flip ? p[1] : p[0], b = flip ? p[0] : p[1]; return Q('「' + a + '」的反义词是？', opts(card(b), o.map(x => card(flip ? x[0] : x[1]))), { pt: a, ps: a + '，的反义词是' }); });
  G.jinyi = g => choiceQ(byG(D.JINYI, g, 2), N, (p, o) => Q('「' + p[0] + '」的近义词是？', opts(card(p[1]), o.map(x => card(x[1]))), { pt: p[0], ps: p[0] + '，的近义词是' }));
  G.liangci = g => { const pool = byG(D.LIANGCI, g, 3); return choiceQ(pool, N, (p) => { const ws = R.sample(uniq(pool.filter(x => x[0] !== p[0]), x => x[0]), 3); return Q('一（ ）' + p[1], opts(card(p[0]), ws.map(x => card(x[0]))), { pe: p[2], ps: '一什么' + p[1], ex: '一' + p[0] + p[1] }); }); };
  const poemLines = g => { const ps = D.POEMS.filter(p => p.g <= g); return (ps.length ? ps : D.POEMS.slice(0, 3)); };
  G.poem_next = g => { const ps = poemLines(g); const qs = []; for (let i = 0; i < N; i++) { const p = R.pick(ps), k = R.int(0, p.l.length - 2); const wrong = R.sample(ps.flatMap(x => x.l).filter(l => l !== p.l[k + 1] && l.length === p.l[k + 1].length), 3); qs.push(Q('「' + p.l[k] + '」的下一句是？', opts(card(p.l[k + 1]), wrong.map(w => card(w))), { pe: p.e, ps: p.l[k] + '，下一句是', ex: '《' + p.t + '》' + p.a })); } return qs; };
  G.poem_fill = g => { const ps = poemLines(g); const qs = []; for (let i = 0; i < N; i++) { const p = R.pick(ps), line = R.pick(p.l), k = R.int(0, line.length - 1), ch = line[k]; const pool = uniq(ps.flatMap(x => x.l.join('').split('')).filter(c => c !== ch), c => c); qs.push(Q(line.slice(0, k) + '（ ）' + line.slice(k + 1), opts(card(ch), R.sample(pool, 3).map(c => card(c))), { pe: p.e, ps: '填一填', ex: '《' + p.t + '》：' + line })); } return qs; };
  G.poem_author = g => { const ps = poemLines(g); const authors = uniq(D.POEMS.map(p => p.a), a => a); return choiceQ(ps, N, p => Q('《' + p.t + '》的作者是？', opts(card(p.a), R.sample(authors.filter(a => a !== p.a), 3).map(a => card(a))), { pe: p.e, ps: p.t + '，的作者是', ex: p.l.join('，') })); };
  G.poem_title = g => { const ps = poemLines(g); return choiceQ(ps, N, (p, o) => Q('「' + R.pick(p.l) + '」出自哪首诗？', opts(card('《' + p.t + '》', '', p.t), o.map(x => card('《' + x.t + '》', '', x.t))), { pe: p.e, ps: '出自哪首诗' })); };
  const cyPool = g => byG(D.CHENGYU, g, 3);
  G.cy_fill = g => { const pool = cyPool(g); const chars = uniq(D.CHENGYU.map(c => c[0]).join('').split(''), c => c); return choiceQ(pool, N, c => { const k = R.int(0, 3), ch = c[0][k]; return Q(c[0].slice(0, k) + '（ ）' + c[0].slice(k + 1), opts(card(ch), R.sample(chars.filter(x => x !== ch), 3).map(x => card(x))), { pe: c[2].trim(), ps: '成语填空', ex: c[0] + '：' + c[1] }); }); };
  G.cy_mean = g => choiceQ(cyPool(g), N, (c, o) => Q('「' + c[0] + '」是什么意思？', opts(card(c[1]), o.map(x => card(x[1]))), { pe: c[2].trim(), ps: c[0] + '，是什么意思', small: true }));
  G.cy_guess = g => choiceQ(cyPool(g), N, (c, o) => Q('「' + c[1] + '」，是哪个成语？', opts(card(c[0]), o.map(x => card(x[0]))), { pe: c[2].trim(), ps: c[1] + '，是哪个成语' }));
  G.bushou_q = g => { const qs = []; for (let i = 0; i < N; i++) { const b = R.pick(D.BUSHOU), ch = R.pick(b.c); const o = R.sample(D.BUSHOU.filter(x => x !== b), 3); qs.push(Q('「' + ch + '」是什么偏旁？', opts(card(b.r, '', b.n, 'zh', b.n), o.map(x => card(x.r, '', x.n, 'zh', x.n))), { pt: ch, ps: ch + '，是什么偏旁', ex: b.n + '：' + b.m })); } return qs; };
  G.word_pic = g => choiceQ(allWords(g).filter(w => w.zh.length >= 2), N, (w, o) => Q('看图选词语', opts(card(w.zh, '', w.zh, 'zh', w.py), o.map(x => card(x.zh, '', x.zh, 'zh', x.py))), { pe: w.e, ps: '看图选词语' }));
  // 配对
  G.p_fanyi = g => R.sample(byG(D.FANYI, g, 2), 6).map(p => [card(p[0]), card(p[1])]);
  G.p_jinyi = g => R.sample(byG(D.JINYI, g, 2), 6).map(p => [card(p[0]), card(p[1])]);
  G.p_hz_pic = g => R.sample(byG(D.HANZI, g, 3), 6).map(h => [card(h[0]), card('', h[2], h[0])]);
  G.p_py_hz = g => R.sample(uniq(byG(D.HANZI, g, 3), x => x[1]), 6).map(h => [card(h[1], '', h[0]), card(h[0])]);
  G.p_poem = g => { const ps = poemLines(g); const pairs = []; R.shuffle(ps).forEach(p => { if (pairs.length < 5) { const k = R.pick([0, 2]); pairs.push([card(p.l[k]), card(p.l[k + 1])]); } }); return pairs; };
  G.p_cy = g => R.sample(cyPool(g), 5).map(c => [card(c[0]), card(c[1])]);
  G.s_bushou = g => { const bs = R.sample(D.BUSHOU, 3); const items = []; bs.forEach((b, i) => R.sample(b.c, 4).forEach(c => items.push(Object.assign(card(c), { b: i })))); return { bins: bs.map(b => card(b.r, '', b.n, 'zh', b.n)), items: R.shuffle(items) }; };
  G.o_sentence = g => R.sample(byG(D.SENTENCES, g, 1), 5).map(s => ({ p: '把词语排成一句通顺的话', items: s[0].map(w => card(w)), join: '' }));
  G.o_poem = g => R.sample(poemLines(g), 4).map(p => ({ p: '给《' + p.t + '》排顺序', items: p.l.map(l => card(l)), pe: p.e, join: '，' }));
  G.sp_cy = g => R.sample(cyPool(g), 6).map(c => { const ans = c[0].split(''); const extra = R.sample(uniq(D.CHENGYU.map(x => x[0]).join('').split('').filter(x => !ans.includes(x)), x => x), 2); return { p: '拼出成语：' + c[1], pe: c[2].trim(), ans, pool: R.shuffle(ans.concat(extra)), s: c[0], l: 'zh' }; });
  G.sp_poem = g => R.sample(poemLines(g), 6).map(p => { const line = R.pick(p.l); const ans = line.split(''); const extra = R.sample(uniq(p.l.join('').split('').filter(x => !ans.includes(x)), x => x), 2); return { p: '《' + p.t + '》拼出诗句', pe: p.e, ans, pool: R.shuffle(ans.concat(extra)), s: line, l: 'zh' }; });

  /* ================= 数学 ================= */
  const EM = ['🍎','🍓','⭐','🐟','🎈','🍬','🐥','🌸','🚗','⚽','🧁','🦋'];
  const numOpts = (ans, spread, min) => { min = min == null ? 0 : min; const s = new Set([ans]); let guard = 0; while (s.size < 4 && guard++ < 100) { const v = ans + R.int(-spread, spread); if (v >= min) s.add(v); } let k = 1; while (s.size < 4) s.add(ans + spread + k++); return R.shuffle([...s]).map(v => Object.assign(card(v, '', numSay(v)), { ok: v === ans })); };
  const arith = (gen) => () => Array.from({ length: N }, gen);
  G.count = g => Array.from({ length: N }, () => { const n = R.int(1, g === 0 ? 10 : 20), e = R.pick(EM); return Q('数一数，有几个？', numOpts(n, 3, 1), { pe: html.dots(n, e), ps: '数一数，有几个' }); });
  G.compare = g => Array.from({ length: N }, () => { const m = [10, 20, 100, 1000, 10000][Math.min(g, 4)]; const a = R.int(0, m), b = Math.random() < .2 ? a : R.int(0, m); const r = a > b ? '>' : a < b ? '<' : '='; return Q(a + ' ○ ' + b, ['>', '<', '='].map(x => Object.assign(card(x, '', x === '>' ? '大于' : x === '<' ? '小于' : '等于'), { ok: x === r })), { pt: a + ' ○ ' + b, ps: '比一比大小' }); });
  const addQ = (max, minA) => () => { const a = R.int(minA || 0, max), b = R.int(0, max - a); return Q(a + ' + ' + b + ' = ?', numOpts(a + b, 3), { pt: a + ' + ' + b, ps: a + '加' + b + '等于几' }); };
  const subQ = (max) => () => { const a = R.int(1, max), b = R.int(0, a); return Q(a + ' - ' + b + ' = ?', numOpts(a - b, 3), { pt: a + ' − ' + b, ps: a + '减' + b + '等于几' }); };
  G.add10 = g => arith(addQ(10))(); G.sub10 = g => arith(subQ(10))();
  G.add20 = g => arith(addQ(20, 3))(); G.sub20 = g => arith(subQ(20))();
  G.add100 = g => arith(addQ(100, 10))(); G.sub100 = g => arith(subQ(100))();
  G.mul = g => Array.from({ length: N }, () => { const a = R.int(2, 9), b = R.int(1, 9); return Q(a + ' × ' + b + ' = ?', numOpts(a * b, 6, 1), { pt: a + ' × ' + b, ps: a + '乘' + b + '等于几' }); });
  G.div = g => Array.from({ length: N }, () => { const b = R.int(2, 9), c = R.int(1, 9); return Q((b * c) + ' ÷ ' + b + ' = ?', numOpts(c, 3, 1), { pt: (b * c) + ' ÷ ' + b, ps: (b * c) + '除以' + b + '等于几' }); });
  G.mix = g => Array.from({ length: N }, () => { const t = R.int(0, 3); let a, b, c, e, v; if (t === 0) { a = R.int(2, 9); b = R.int(2, 9); c = R.int(1, 20); e = a + ' × ' + b + ' + ' + c; v = a * b + c; } else if (t === 1) { a = R.int(20, 99); b = R.int(1, 20); c = R.int(1, 20); e = a + ' − ' + b + ' + ' + c; v = a - b + c; } else if (t === 2) { a = R.int(2, 9); b = R.int(2, 9); c = R.int(1, a * b); e = a + ' × ' + b + ' − ' + c; v = a * b - c; } else { a = R.int(2, 9); b = R.int(1, 9); c = R.int(2, 5); e = '(' + a + ' + ' + b + ') × ' + c; v = (a + b) * c; } return Q(e + ' = ?', numOpts(v, 6), { pt: e, ps: '算一算' }); });
  G.missing = g => Array.from({ length: N }, () => { const m = g <= 1 ? 20 : 100; const a = R.int(0, m / 2), b = R.int(0, m / 2), t = R.int(0, 2); if (t === 0) return Q('□ + ' + b + ' = ' + (a + b), numOpts(a, 3), { pt: '□ + ' + b + ' = ' + (a + b), ps: '方框里填几' }); if (t === 1) return Q(a + ' + □ = ' + (a + b), numOpts(b, 3), { pt: a + ' + □ = ' + (a + b), ps: '方框里填几' }); return Q((a + b) + ' − □ = ' + a, numOpts(b, 3), { pt: (a + b) + ' − □ = ' + a, ps: '方框里填几' }); });
  G.seq = g => Array.from({ length: N }, () => { const step = R.pick(g <= 1 ? [1, 2] : g === 2 ? [2, 3, 5, 10] : [3, 4, 5, 9, 11, 25]); const st = R.int(0, 20); const arr = [0, 1, 2, 3, 4].map(i => st + i * step); const k = R.int(1, 4); const ans = arr[k]; const shown = arr.map((v, i) => i === k ? '?' : v).join(', '); return Q('找规律：' + shown, numOpts(ans, step + 2), { pt: shown, ps: '找规律，问号是几', ex: '每次加' + step }); });
  G.oddeven = g => Array.from({ length: N }, () => { const n = R.int(1, g <= 2 ? 30 : 200), odd = n % 2 === 1; return Q(n + ' 是单数还是双数？', [Object.assign(card('单数（奇数）', '', '单数'), { ok: odd }), Object.assign(card('双数（偶数）', '', '双数'), { ok: !odd })], { pt: String(n), ps: n + '，是单数还是双数' }); });
  const tstr = (h, m) => h + ':' + String(m).padStart(2, '0');
  const tsay = (h, m) => h + '点' + (m === 0 ? '整' : m === 30 ? '半' : m + '分');
  G.clock_read = g => Array.from({ length: N }, () => { const step = g <= 1 ? 30 : g === 2 ? 15 : 5; const h = R.int(1, 12), m = R.int(0, 60 / step - 1) * step; const s = new Set([tstr(h, m)]); while (s.size < 4) { const hh = R.int(1, 12), mm = R.int(0, 60 / step - 1) * step; s.add(tstr(Math.random() < .5 ? h : hh, mm)); } return Q('现在是几点？', R.shuffle([...s]).map(x => { const [hh, mm] = x.split(':').map(Number); return Object.assign(card(x, '', tsay(hh, mm)), { ok: x === tstr(h, m) }); }), { pe: html.clock(h, m), ps: '现在是几点' }); });
  const yuan = (j) => (j >= 10 ? Math.floor(j / 10) + '元' : '') + (j % 10 ? (j % 10) + '角' : '') || '0元';
  G.money = g => Array.from({ length: N }, () => { const t = R.int(0, 2); if (t === 0) { const a = R.int(1, 9); return Q('1元 = ? 角', numOpts(10, 3, 1).map(c => Object.assign(c, { t: c.t + '角', s: c.t + '角' })), { pe: '💴', ps: '一元等于几角' }); } const items = [['✏️', '铅笔'], ['📒', '本子'], ['🧃', '果汁'], ['🍦', '冰淇淋'], ['🎈', '气球'], ['🧸', '玩具熊']]; const it = R.pick(items), p1 = R.int(2, g <= 1 ? 9 : 50), p2 = R.int(1, Math.min(p1, 10)); if (t === 1) { const ans = p1 + p2; return Q(it[1] + p1 + '元，再买' + p2 + '元的糖，一共多少元？', numOpts(ans, 3, 1).map(c => Object.assign(c, { t: c.t + '元', s: c.t + '元' })), { pe: it[0], ps: it[1] + p1 + '元，再买' + p2 + '元的糖，一共多少元', small: true }); } const pay = Math.ceil((p1 + 1) / 10) * 10; return Q(it[1] + p1 + '元，付' + pay + '元，找回多少元？', numOpts(pay - p1, 3, 0).map(c => Object.assign(c, { t: c.t + '元', s: c.t + '元' })), { pe: it[0], ps: it[1] + p1 + '元，付' + pay + '元，找回多少元', small: true }); });
  const SHAPES = [['circle', '圆形', 0], ['square', '正方形', 0], ['triangle', '三角形', 0], ['rect', '长方形', 0], ['star', '五角星', 1], ['heart', '心形', 0], ['oval', '椭圆形', 1], ['diamond', '菱形', 2], ['hexagon', '六边形', 2], ['pentagon', '五边形', 3], ['trapezoid', '梯形', 3]];
  G.shape = g => choiceQ(byG(SHAPES, g, 2), N, (s, o) => Q('这是什么图形？', opts(card(s[1]), o.map(x => card(x[1]))), { pe: html.shape(s[0]), ps: '这是什么图形' }));
  G.sides = g => { const P = [['triangle', 3], ['square', 4], ['rect', 4], ['pentagon', 5], ['hexagon', 6], ['diamond', 4], ['trapezoid', 4]]; return Array.from({ length: N }, () => { const s = R.pick(P); return Q('这个图形有几条边？', numOpts(s[1], 2, 0), { pe: html.shape(s[0]), ps: '这个图形有几条边' }); }); };
  const UNITS = [['一支铅笔长约18（ ）', '厘米', ['米', '千米', '毫米'], '✏️'], ['教室门高约2（ ）', '米', ['厘米', '千米', '克'], '🚪'], ['一个苹果重约200（ ）', '克', ['千克', '吨', '米'], '🍎'], ['一个小朋友重约25（ ）', '千克', ['克', '吨', '米'], '🧒'],
    ['一头大象重约5（ ）', '吨', ['千克', '克', '米'], '🐘'], ['从家到学校约2（ ）', '千米', ['米', '厘米', '千克'], '🏫'], ['一节课40（ ）', '分钟', ['小时', '秒', '天'], '🔔'], ['跑50米约10（ ）', '秒', ['分钟', '小时', '天'], '🏃'],
    ['一天睡觉约9（ ）', '小时', ['分钟', '秒', '月'], '😴'], ['一本书厚约1（ ）', '厘米', ['米', '分米', '千米'], '📖'], ['一瓶水约500（ ）', '毫升', ['升', '千克', '米'], '🧴'], ['一桶油约5（ ）', '升', ['毫升', '克', '米'], '🛢️']];
  G.unit = g => choiceQ(UNITS, N, u => Q(u[0], opts(card(u[1]), u[2].map(x => card(x))), { pe: u[3], ps: u[0].replace('（ ）', '什么') }));
  G.fraction = g => Array.from({ length: N }, () => { const b = R.int(2, g <= 3 ? 6 : 8), a = R.int(1, b - 1); const s = new Set([a + '/' + b]); while (s.size < 4) { const bb = R.int(2, 8), aa = R.int(1, bb - 1); s.add(aa + '/' + bb); } return Q('涂色部分是几分之几？', R.shuffle([...s]).map(x => { const [p, q] = x.split('/'); return Object.assign(card(x, '', q + '分之' + p), { ok: x === a + '/' + b }); }), { pe: html.pie(a, b), ps: '涂色部分是几分之几' }); });
  G.compose10 = g => Array.from({ length: N }, () => { const t = g <= 0 ? 10 : R.pick([10, 10, 20]), a = R.int(1, t - 1); return Q(a + ' 和几凑成 ' + t + '？', numOpts(t - a, 3, 0), { pt: a + ' + ? = ' + t, ps: a + '和几凑成' + t }); });
  G.groups = g => Array.from({ length: N }, () => { const e1 = R.pick(EM), e2 = R.pick(EM.filter(x => x !== e1)); let a = R.int(1, 9), b = R.int(1, 9); if (a === b) b = a % 9 + 1; return Q('哪边多？', [Object.assign(card('', 'html:<div class="dots sm">' + '<i data-emo="' + e1 + '"></i>'.repeat(a) + '</div>', '左边'), { ok: a > b }), Object.assign(card('', 'html:<div class="dots sm">' + '<i data-emo="' + e2 + '"></i>'.repeat(b) + '</div>', '右边'), { ok: b > a })], { ps: '哪边多', wide: true }); });
  const WP = [
    g => { const a = R.int(2, 9), b = R.int(1, 9); return ['树上有' + a + '只小鸟，又飞来' + b + '只，现在有几只？', a + b, '🐦']; },
    g => { const a = R.int(5, 15), b = R.int(1, a); return ['盘子里有' + a + '个苹果，吃掉' + b + '个，还剩几个？', a - b, '🍎']; },
    g => { const a = R.int(2, 9), b = R.int(2, 6); return ['每个盒子装' + a + '支笔，' + b + '个盒子一共几支？', a * b, '✏️']; },
    g => { const b = R.int(2, 6), c = R.int(2, 9); return [b * c + '块糖平均分给' + b + '个小朋友，每人几块？', c, '🍬']; },
    g => { const a = R.int(10, 40), b = R.int(5, 30); return ['小明有' + a + '张卡片，小红比他多' + b + '张，小红有几张？', a + b, '🃏']; },
    g => { const a = R.int(3, 9); return ['一只小猫有4条腿，' + a + '只小猫有几条腿？', 4 * a, '🐱']; },
    g => { const a = R.int(20, 60), b = R.int(5, 19); return ['图书馆有' + a + '本故事书，借走' + b + '本，还剩几本？', a - b, '📚']; }];
  G.wordprob = g => Array.from({ length: N }, () => { const f = g <= 1 ? R.pick(WP.slice(0, 2)) : R.pick(WP); const [t, v, e] = f(g); return Q(t, numOpts(v, 4, 0), { pe: e, ps: t, small: true }); });
  G.bignum = g => Array.from({ length: N }, () => { const n = R.int(1000, g >= 4 ? 99999 : 9999); const k = R.int(0, String(n).length - 1); const names = ['个', '十', '百', '千', '万']; const s = String(n); const pos = s.length - 1 - k; return Q(n + ' 的' + names[pos] + '位上是几？', numOpts(Number(s[k]), 3, 0), { pt: String(n), ps: n + '，的' + names[pos] + '位上是几' }); });
  G.timeconv = g => { const T = [['1小时 = ? 分', 60, '⏰'], ['1分 = ? 秒', 60, '⏱️'], ['1天 = ? 小时', 24, '📅'], ['1星期 = ? 天', 7, '🗓️'], ['1年 = ? 个月', 12, '🎆'], ['2小时 = ? 分', 120, '⏰'], ['半小时 = ? 分', 30, '⏰'], ['1米 = ? 厘米', 100, '📏'], ['1千克 = ? 克', 1000, '⚖️'], ['1元 = ? 角', 10, '💴'], ['1千米 = ? 米', 1000, '🛣️'], ['1分米 = ? 厘米', 10, '📏']]; return choiceQ(T, N, t => Q(t[0], numOpts(t[1], t[1] >= 100 ? 50 : 6, 1), { pe: t[2], ps: t[0].replace('?', '多少') })); };
  G.double = g => Array.from({ length: N }, () => { const a = R.int(2, 9), k = R.int(2, 5); return Q(a + ' 的 ' + k + ' 倍是多少？', numOpts(a * k, 5, 1), { pt: a + ' × ' + k, ps: a + '的' + k + '倍是多少' }); });
  // 配对 / 排序 / 归类
  G.p_add = g => { const m = g <= 0 ? 10 : 20; const used = new Set(), pairs = []; let guard = 0; while (pairs.length < 6 && guard++ < 200) { const a = R.int(0, m), b = R.int(0, m - a); if (used.has(a + b)) continue; used.add(a + b); pairs.push([card(a + ' + ' + b, '', a + '加' + b), card(a + b)]); } return pairs; };
  G.p_mul = g => { const used = new Set(), pairs = []; let guard = 0; while (pairs.length < 6 && guard++ < 200) { const a = R.int(2, 9), b = R.int(2, 9); if (used.has(a * b)) continue; used.add(a * b); pairs.push([card(a + ' × ' + b, '', a + '乘' + b), card(a * b)]); } return pairs; };
  G.p_clock = g => { const used = new Set(), pairs = []; while (pairs.length < 5) { const h = R.int(1, 12), m = g <= 1 ? R.pick([0, 30]) : R.pick([0, 15, 30, 45]); const k = tstr(h, m); if (used.has(k)) continue; used.add(k); pairs.push([card('', html.clock(h, m), tsay(h, m)), card(k, '', tsay(h, m))]); } return pairs; };
  G.p_shape = g => R.sample(byG(SHAPES, g, 2), 6).map(s => [card('', html.shape(s[0]), s[1]), card(s[1])]);
  G.s_oddeven = g => { const items = R.sample(Array.from({ length: g <= 1 ? 20 : 99 }, (_, i) => i + 1), 10).map(n => Object.assign(card(n), { b: n % 2 })); return { bins: [card('双数', '', '双数'), card('单数', '', '单数')], items }; };
  G.s_shape = g => { const cur = ['circle', 'oval', 'heart'], st = ['square', 'triangle', 'rect', 'diamond', 'hexagon', 'pentagon', 'star', 'trapezoid']; const items = R.shuffle(cur.map(s => Object.assign(card('', html.shape(s), ''), { b: 0 })).concat(R.sample(st, 5).map(s => Object.assign(card('', html.shape(s), ''), { b: 1 })))); return { bins: [card('有弯曲的边'), card('全是直直的边')], items }; };
  G.o_num = g => Array.from({ length: 5 }, () => { const m = [20, 50, 100, 1000, 10000][Math.min(g, 4)]; const ns = uniq(Array.from({ length: 5 }, () => R.int(0, m)), x => x); while (ns.length < 5) ns.push(ns[ns.length - 1] + 1); ns.sort((a, b) => a - b); return { p: '从小到大排一排', items: ns.map(n => card(n)) }; });
  G.o_num_desc = g => G.o_num(g).map(r => ({ p: '从大到小排一排', items: r.items.reverse() }));

  /* ================= 英语 ================= */
  const enPool = (g, cats) => allWords(g + 1, cats).filter(w => w.en);
  const enQ = (cats, mode) => g => choiceQ(uniq(enPool(g, cats), w => w.en), N, (w, o) => {
    if (mode === 'pic') return Q('Which one is「' + w.en + '」?', opts(card('', w.e, w.en, 'en'), o.map(x => card('', x.e, x.en, 'en'))), { pt: w.en, ps: w.en, psl: 'en', latin: true });
    if (mode === 'listen') return Q('Listen and choose 听音选图', opts(card('', w.e, w.en, 'en'), o.map(x => card('', x.e, x.en, 'en'))), { listen: w.en, ps: w.en, psl: 'en' });
    if (mode === 'word') return Q('What is it? 这是什么？', opts(card(w.en, '', w.en, 'en'), o.map(x => card(x.en, '', x.en, 'en'))), { pe: w.e, ps: 'What is it?', psl: 'en', latinCh: true });
    if (mode === 'cn') return Q('「' + w.en + '」的中文是？', opts(card(w.zh), o.map(x => card(x.zh))), { pt: w.en, ps: w.en, psl: 'en', latin: true });
    return Q('「' + w.zh + '」用英语怎么说？', opts(card(w.en, '', w.en, 'en'), o.map(x => card(x.en, '', x.en, 'en'))), { pt: w.zh, ps: w.zh + '，用英语怎么说', latinCh: true });
  });
  G.en_pic = enQ(null, 'pic'); G.en_listen = enQ(null, 'listen'); G.en_word = enQ(null, 'word'); G.en_cn = enQ(null, 'cn'); G.cn_en = enQ(null, 'en');
  ['fruit', 'animal', 'color', 'num', 'body', 'food', 'traffic', 'family', 'clothes', 'feel', 'action', 'thing', 'nature', 'veg'].forEach(k => { G['en_' + k] = enQ([k], 'word'); G['enl_' + k] = enQ([k], 'listen'); });
  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  G.letter_case = g => choiceQ(AZ, N, (L, o) => Q('「' + L + '」的小写字母是？', opts(card(L.toLowerCase(), '', L, 'en'), o.map(x => card(x.toLowerCase(), '', x, 'en'))), { pt: L, ps: L, psl: 'en', latin: true, latinCh: true }));
  G.letter_listen = g => choiceQ(AZ, N, (L, o) => Q('Listen! 听，是哪个字母？', opts(card(L + L.toLowerCase(), '', L, 'en'), o.map(x => card(x + x.toLowerCase(), '', x, 'en'))), { listen: L, ps: L, psl: 'en', latinCh: true }));
  G.letter_first = g => choiceQ(AZ, N, (L, o) => { const w = D.LETTER_WORDS[L]; return Q(w[1] + ' 以哪个字母开头？', opts(card(L, '', L, 'en'), o.map(x => card(x, '', x, 'en'))), { pe: w[0], ps: w[1], psl: 'en', latinCh: true }); });
  G.letter_next = g => Array.from({ length: N }, () => { const i = R.int(0, 24), L = AZ[i]; return Q(L + ' 后面是哪个字母？', opts(card(AZ[i + 1], '', AZ[i + 1], 'en'), R.sample(AZ.filter(x => x !== AZ[i + 1]), 3).map(x => card(x, '', x, 'en'))), { pt: L + ' → ?', ps: L, psl: 'en', latin: true, latinCh: true }); });
  G.en_phrase = g => choiceQ(byG(D.EN_PHRASES, g, 3), N, (p, o) => Q('「' + p[1] + '」用英语怎么说？', opts(card(p[0], '', p[0], 'en'), o.map(x => card(x[0], '', x[0], 'en'))), { pe: p[2], ps: p[1], small: true, latinCh: true }));
  G.en_phrase_cn = g => choiceQ(byG(D.EN_PHRASES, g, 3), N, (p, o) => Q(p[0], opts(card(p[1]), o.map(x => card(x[1]))), { pe: p[2], pt: p[0], ps: p[0], psl: 'en', latin: true, small: true }));
  G.en_howmany = g => Array.from({ length: N }, () => { const n = R.int(1, 10), e = R.pick(EM); const nums = D.W.num.items; return Q('How many? 有几个？', opts(card(nums[n - 1][3], '', nums[n - 1][3], 'en'), R.sample(nums.filter((_, i) => i !== n - 1), 3).map(x => card(x[3], '', x[3], 'en'))), { pe: html.dots(n, e), ps: 'How many?', psl: 'en', latinCh: true }); });
  G.en_miss = g => choiceQ(uniq(enPool(g).filter(w => /^[a-z]{3,8}$/.test(w.en)), w => w.en), N, w => { const k = R.int(0, w.en.length - 1), L = w.en[k]; return Q(w.en.slice(0, k) + '_' + w.en.slice(k + 1), opts(card(L, '', L, 'en'), R.sample('abcdefghijklmnopqrstuvwxyz'.split('').filter(x => x !== L), 3).map(x => card(x, '', x, 'en'))), { pe: w.e, pt: w.en.slice(0, k) + '_' + w.en.slice(k + 1), ps: w.en, psl: 'en', latin: true, latinCh: true, ex: w.en }); });
  G.p_en_pic = g => R.sample(uniq(enPool(g), w => w.en), 6).map(w => [card(w.en, '', w.en, 'en'), card('', w.e, w.en, 'en')]);
  G.p_case = g => R.sample(AZ, 6).map(L => [card(L, '', L, 'en'), card(L.toLowerCase(), '', L, 'en')]);
  G.p_en_cn = g => R.sample(uniq(enPool(g), w => w.en), 6).map(w => [card(w.en, '', w.en, 'en'), card(w.zh)]);
  G.s_en_cat = g => { const ks = R.sample(['fruit', 'animal', 'color', 'traffic', 'food', 'body'], 3); const items = []; ks.forEach((k, i) => R.sample(D.W[k].items.filter(x => x[4] <= g + 1), 4).forEach(it => items.push(Object.assign(card(it[3], it[0], it[3], 'en'), { b: i })))); return { bins: ks.map(k => card(D.W[k].en, '', D.W[k].en, 'en', D.W[k].n)), items: R.shuffle(items) }; };
  G.o_abc = g => Array.from({ length: 5 }, () => { const i = R.int(0, 21); return { p: '按字母顺序排一排', items: AZ.slice(i, i + 5).map(L => card(L, '', L, 'en')) }; });
  G.o_en_sent = g => R.sample(byG(D.EN_SENT, g, 1), 5).map(s => ({ p: 'Make a sentence 排成句子', items: s[0].map(w => card(w, '', w, 'en')), join: ' ', l: 'en' }));
  G.sp_en = g => R.sample(uniq(enPool(g).filter(w => /^[a-z]{3,7}$/.test(w.en)), w => w.en), 6).map(w => { const ans = w.en.split(''); const extra = R.sample('abcdefghijklmnopqrstuvwxyz'.split('').filter(x => !ans.includes(x)), 2); return { p: '拼出单词：' + w.zh, pe: w.e, ans, pool: R.shuffle(ans.concat(extra)), s: w.en, l: 'en' }; });

  /* ================= 常识 ================= */
  const binQ = (B, prompt) => g => choiceQ(byG(B.items, g, 2), N, it => { const right = B.bins.find((b, i) => i === B.items.indexOf(it) || false); return null; });
  // 分类数据 → 选择题
  const sortToQ = (B, prompt, binsIdx) => g => { const items = byG(B.items, g, 2); return Array.from({ length: N }, () => { const it = R.pick(items); const bi = binsIdx(it, B); return Q(prompt(it), B.bins.map((b, i) => Object.assign(card(b[1], b[0], b[1]), { ok: i === bi })), { pe: it[0], ps: prompt(it) }); }); };
  const homeBin = (it, B) => { const n = it[1]; if (['鲸鱼','海豚','鲨鱼','章鱼','螃蟹'].includes(n)) return 0; if (['老虎','熊','狐狸','松鼠','猫头鹰'].includes(n)) return 1; if (['奶牛','猪','鸡','羊','马'].includes(n)) return 2; return 3; };
  G.home_q = sortToQ(D.HOME, it => it[1] + '住在哪里？', homeBin);
  G.s_home = g => { const items = byG(D.HOME.items, g, 2); return { bins: D.HOME.bins.map(b => card(b[1], b[0])), items: R.sample(items, 10).map(it => Object.assign(card(it[1], it[0]), { b: homeBin(it) })) }; };
  G.eat_q = g => choiceQ(D.EAT, N, (a, o) => Q(a[1] + '最爱吃什么？', opts(card(a[3], a[2]), o.map(x => card(x[3], x[2]))), { pe: a[0], ps: a[1] + '最爱吃什么' }));
  G.p_eat = g => R.sample(D.EAT, 6).map(a => [card(a[1], a[0]), card(a[3], a[2])]);
  G.sound_q = g => choiceQ(D.SOUNDS, N, (a, o) => Q('谁会「' + a[2] + '」地叫？', opts(card(a[1], a[0]), o.map(x => card(x[1], x[0]))), { pt: a[2] + '～', ps: a[2] + a[2] + '，是谁在叫' }));
  G.p_sound = g => R.sample(D.SOUNDS, 6).map(a => [card(a[1], a[0]), card(a[2])]);
  G.baby_q = g => choiceQ(D.BABY, 6, (a, o) => Q(a[2] + '长大后会变成？', opts(card(a[1], a[0]), o.map(x => card(x[1], x[0]))), { pt: a[2], ps: a[2] + '长大后会变成什么' }));
  G.fact_tf = g => choiceQ(byG(D.FACTS, g, 3), N, f => Q(f[0], [Object.assign(card('对', '✅', '对'), { ok: f[1] }), Object.assign(card('错', '❌', '错'), { ok: !f[1] })], { pe: f[4], ps: f[0], ex: f[2], small: true, tf: true }));
  G.know_q = g => choiceQ(byG(D.KNOW, g, 3), N, k => Q(k[0], opts(card(k[1]), k[2].map(x => card(x))), { pe: k[4], ps: k[0] }));
  G.planet_q = g => { const T = [['离太阳第几近的是地球？', '第3', ['第1', '第5', '第8']], ['太阳系有几颗行星？', '8颗', ['5颗', '9颗', '12颗']], ['哪颗行星有漂亮光环？', '土星', ['火星', '水星', '金星']], ['我们住在哪颗星球？', '地球', ['火星', '月球', '木星']],
    ['最大的行星是？', '木星', ['地球', '水星', '火星']], ['离太阳最远的行星是？', '海王星', ['地球', '水星', '金星']], ['被叫做「红色星球」的是？', '火星', ['地球', '土星', '海王星']], ['最亮的行星（启明星）是？', '金星', ['火星', '木星', '海王星']]];
    return choiceQ(T, N, t => Q(t[0], opts(card(t[1]), t[2].map(x => card(x))), { pe: '🪐', ps: t[0] })); };
  G.o_planet = g => [{ p: '从离太阳最近开始，给行星排队', items: D.PLANETS.slice(0, 4).map(p => card(p[1], p[0])) }, { p: '继续排：更远的行星', items: D.PLANETS.slice(4).map(p => card(p[1], p[0])) }, { p: '从近到远排一排', items: R.sample([0, 1, 2, 3, 4, 5, 6, 7], 5).sort((a, b) => a - b).map(i => card(D.PLANETS[i][1], D.PLANETS[i][0])) }];
  const seasonBin = it => { const m = { '放风筝': 0, '郁金香开': 0, '种小树': 0, '吃西瓜': 1, '游泳': 1, '吃冰淇淋': 1, '蚊子多': 1, '落叶': 2, '收稻子': 2, '吃月饼': 2, '摘葡萄': 2, '滑雪': 3, '戴围巾': 3, '戴手套': 3, '熊冬眠': 3 }; return m[it[1]]; };
  G.season_q = sortToQ(D.SEASON, it => '「' + it[1] + '」是什么季节？', seasonBin);
  G.s_season = g => ({ bins: D.SEASON.bins.map(b => card(b[1], b[0])), items: R.sample(byG(D.SEASON.items, g, 2), 10).map(it => Object.assign(card(it[1], it[0]), { b: seasonBin(it) })) });
  const floatBin = it => ['石头', '钥匙', '硬币', '螺丝', '铁勺', '铁锚'].includes(it[1]) ? 1 : 0;
  G.float_q = sortToQ(D.FLOAT, it => it[1] + '放进水里会怎样？', floatBin);
  G.s_float = g => ({ bins: D.FLOAT.bins.map(b => card(b[1], b[0])), items: R.sample(byG(D.FLOAT.items, g, 2), 8).map(it => Object.assign(card(it[1], it[0]), { b: floatBin(it) })) });
  G.instr_q = g => choiceQ(D.INSTR, N, (a, o) => Q('这是什么乐器？', opts(card(a[1]), o.map(x => card(x[1]))), { pe: a[0], ps: '这是什么乐器' }));
  G.p_baby = g => D.BABY.map(a => [card(a[2]), card(a[1], a[0])]).slice(0, 6);
  G.o_cycle = g => R.sample(D.CYCLES.filter(c => c.g <= g + 1), 4).map(c => ({ p: '排一排：' + c.n, items: c.s.map(s => card(s[1], s[0])) }));
  G.animal_pic = g => choiceQ(allWords(g, ['animal']), N, (w, o) => Q('这是什么动物？', opts(card(w.zh, w.e === '' ? '' : ''), o.map(x => card(x.zh))), { pe: w.e, ps: '这是什么动物' }));

  /* ================= 生活 ================= */
  const trashBin = it => { const i = D.TRASH.items.indexOf(it); return i < 6 ? 0 : i < 12 ? 1 : i < 17 ? 2 : 3; };
  G.trash_q = g => { const items = byG(D.TRASH.items, g, 2); return Array.from({ length: N }, () => { const it = R.pick(items); return Q(it[1] + '属于什么垃圾？', D.TRASH.bins.map((b, i) => Object.assign(card(b[1], b[0]), { ok: i === trashBin(it) })), { pe: it[0], ps: it[1] + '属于什么垃圾' }); }); };
  G.s_trash = g => ({ bins: D.TRASH.bins.map(b => card(b[1], b[0])), items: R.sample(byG(D.TRASH.items, g, 2), 10).map(it => Object.assign(card(it[1], it[0]), { b: trashBin(it) })) });
  G.safe_tf = g => choiceQ(byG(D.SAFETY, g, 3), N, f => Q(f[0], [Object.assign(card('对', '✅', '对'), { ok: f[1] }), Object.assign(card('不对', '❌', '不对'), { ok: !f[1] })], { pe: f[4], ps: f[0], ex: f[2], small: true, tf: true }));
  G.manner_q = g => choiceQ(byG(D.MANNER, g, 3), N, k => Q(k[0], opts(card(k[1]), k[2].map(x => card(x))), { pe: k[4], ps: k[0], small: true }));
  const healthyBin = it => D.HEALTHY.items.indexOf(it) < 8 ? 0 : 1;
  G.s_healthy = g => ({ bins: D.HEALTHY.bins.map(b => card(b[1], b[0])), items: R.sample(byG(D.HEALTHY.items, g, 2), 10).map(it => Object.assign(card(it[1], it[0]), { b: healthyBin(it) })) });
  G.healthy_q = g => Array.from({ length: N }, () => { const good = R.pick(D.HEALTHY.items.slice(0, 8)); const bad = R.sample(D.HEALTHY.items.slice(8), 3); return Q('哪个更健康，可以多吃？', opts(card(good[1], good[0]), bad.map(b => card(b[1], b[0]))), { ps: '哪个更健康，可以多吃' }); });
  G.s_need = g => ({ bins: D.NEED.bins.map(b => card(b[1], b[0])), items: R.shuffle(D.NEED.items.map((it, i) => Object.assign(card(it[1], it[0]), { b: i < 5 ? 0 : 1 }))) });
  G.o_day = g => [0, 1, 2].map(k => { const st = R.int(0, D.DAY.length - 5); return { p: '一天的顺序，排一排', items: D.DAY.slice(st, st + 5).map(d => card(d[1], d[0])) }; });
  G.o_wash = g => [{ p: '正确洗手的步骤', items: D.WASH.map(d => card(d[1], d[0])) }, { p: '再来一次：洗手步骤', items: D.WASH.map(d => card(d[1], d[0])) }];
  G.kin_q = g => choiceQ(byG(D.KIN, g, 3), N, k => Q(k[0], opts(card(k[1]), k[2].map(x => card(x))), { pe: '👨‍👩‍👧', ps: k[0] }));
  G.wear_q = g => choiceQ(D.WEATHER_WEAR, 6, w => Q(w[1] + '，应该怎么办？', opts(card(w[3], w[2]), w[4].map(x => card('', x, ''))), { pe: w[0], ps: w[1] + '，应该怎么办' }));
  G.emo_q = g => choiceQ(D.EMO_DO, 6, w => Q(w[1] + '，怎么做比较好？', opts(card(w[2]), w[3].map(x => card(x))), { pe: w[0], ps: w[1] + '，怎么做比较好', small: true }));
  G.emo_face = g => choiceQ(allWords(4, ['feel']), 6, (w, o) => Q('这个表情是什么心情？', opts(card(w.zh), o.map(x => card(x.zh))), { pe: w.e, ps: '这个表情是什么心情' }));
  const EMG = [['🚒', '着火了', '119'], ['🚑', '有人受伤、生病', '120'], ['🚓', '遇到坏人', '110']];
  G.phone_q = g => Array.from({ length: 6 }, () => { const e = R.pick(EMG); return Q(e[1] + '，要打什么电话？', EMG.map(x => Object.assign(card(x[2], '', x[2].split('').join(' ')), { ok: x === e })).concat([Object.assign(card('114', '', '1 1 4'), { ok: false })]), { pe: e[0], ps: e[1] + '，要打什么电话' }); });
  G.p_phone = g => EMG.map(e => [card(e[1], e[0]), card(e[2], '', e[2].split('').join(' '))]).concat([[card('天气冷', '🥶'), card('穿外套', '🧥')], [card('下雨', '🌧️'), card('带雨伞', '☂️')]]);
  G.p_manner = g => R.sample(D.MANNER.slice(0, 8), 5).map(m => [card(m[0].replace('，应该说？', '').replace('，你可以说？', '').replace('，应该？', '').replace('？', ''), m[4]), card(m[1])]);

  window.CONTENT = { G, R, card, html, N, allWords, tstr, tsay };
})();
