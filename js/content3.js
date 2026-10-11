/* 第三批题库：益智/模拟/创作类玩法的关卡生成器（纯数据，不依赖 DOM） */
(function () {
  const D = window.DATA, { G, R } = CONTENT;
  const CN = '零一二三四五六七八九十';
  const cnNum = n => n <= 10 ? CN[n] : n < 20 ? '十' + (n % 10 ? CN[n % 10] : '') : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  const liang = n => n === 2 ? '两' : cnNum(n);
  const EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const plural = w => /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|ch|sh|o)$/.test(w) ? w + 'es' : w + 's';
  const gi = g => Math.max(0, Math.min(4, g));

  /* 合十消除 */
  G.make10 = g => Object.assign({ cols: g <= 0 ? 4 : 5, rows: g <= 0 ? 4 : 5, goal: g <= 0 ? 6 : 8, time: 110 + g * 10 },
    [{ t: 5, max: 4, op: '+' }, { t: 10, max: 9, op: '+' }, { t: 15, max: 9, op: '+' }, { t: 20, max: 12, op: '+' }, { t: 24, max: 8, op: '×' }][gi(g)]);

  /* 收银台（金额单位：角） */
  const SHOPI = [['🍎', '苹果'], ['🍌', '香蕉'], ['✏️', '铅笔'], ['📒', '本子'], ['🧃', '果汁'], ['🍦', '冰淇淋'], ['🎈', '气球'], ['🧸', '玩具熊'], ['⚽', '足球'], ['📚', '故事书'], ['🍞', '面包'], ['🖍️', '蜡笔'], ['🪁', '风筝'], ['🥛', '牛奶'], ['🍪', '饼干'], ['🧢', '帽子']];
  const CUST = ['👵', '👴', '👩', '👨', '🧒', '👧', '👦', '🐻', '🐰', '🐼', '🦊', '🐵'];
  const priceFor = g => g <= 0 ? R.int(2, 10) * 10 : g === 1 ? R.int(3, 20) * 10 : g === 2 ? R.int(8, 60) * 10 : g === 3 ? R.int(12, 95) * 10 + R.pick([0, 5]) : R.int(20, 98) * 10 + R.int(0, 9);
  const denFor = g => g <= 0 ? [10, 50, 100] : g === 1 ? [10, 50, 100, 200] : g === 2 ? [10, 50, 100, 200, 500] : [1, 5, 10, 50, 100, 200, 500, 1000];
  G.cash_pay = g => ({ mode: 'pay', den: denFor(g), show: g <= 1, rounds: R.sample(SHOPI, 6).map(x => ({ e: x[0], n: x[1], price: priceFor(g), cust: R.pick(CUST) })) });
  G.cash_change = g => { g = Math.max(2, g); return { mode: 'change', den: denFor(g), show: false, rounds: R.sample(SHOPI, 6).map(x => { const price = Math.min(priceFor(g), 990), pay = [100, 200, 500, 1000].find(b => b > price); return { e: x[0], n: x[1], price, pay, cust: R.pick(CUST) }; }) }; };

  /* 猜单词 */
  G.hang_en = g => {
    const pool = CONTENT.allWords(Math.min(4, g + 1)).filter(w => /^[a-z]{3,8}$/.test(w.en));
    const u = [...new Map(pool.map(w => [w.en, w])).values()], len = g <= 1 ? [3, 5] : g === 2 ? [3, 6] : [4, 8];
    const f = u.filter(w => w.en.length >= len[0] && w.en.length <= len[1]);
    return R.sample(f.length >= 5 ? f : u, 5).map(w => ({ w: w.en, zh: w.zh, e: w.e, s: w.en, l: 'en' }));
  };

  /* 连点成画 */
  const heart = () => Array.from({ length: 12 }, (_, i) => { const t = i / 12 * Math.PI * 2, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); return [50 + x * 2.5, 20 + (5 - y) * 3.4]; });
  const star = () => Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 19 : 44; return [50 + Math.cos(a) * r, 54 + Math.sin(a) * r]; });
  const SHAPES = [
    { n: '星星', en: 'star', e: '⭐', c: '#ffd23f', p: star() }, { n: '爱心', en: 'heart', e: '❤️', c: '#ff5d73', p: heart() },
    { n: '房子', en: 'house', e: '🏠', c: '#ff9f43', p: [[20, 90], [20, 50], [10, 50], [50, 14], [90, 50], [80, 50], [80, 90], [60, 90], [60, 66], [40, 66], [40, 90]] },
    { n: '小鱼', en: 'fish', e: '🐟', c: '#3ec1d3', p: [[10, 50], [30, 30], [55, 25], [75, 40], [92, 25], [88, 50], [92, 75], [75, 60], [55, 75], [30, 70]] },
    { n: '火箭', en: 'rocket', e: '🚀', c: '#a78bfa', p: [[50, 5], [65, 25], [65, 65], [80, 86], [62, 80], [55, 93], [45, 93], [38, 80], [20, 86], [35, 65], [35, 25]] },
    { n: '帆船', en: 'boat', e: '⛵', c: '#5b7cfa', p: [[10, 60], [46, 60], [46, 8], [78, 56], [52, 56], [52, 60], [90, 60], [75, 86], [25, 86]] },
    { n: '大树', en: 'tree', e: '🌲', c: '#3ccf7e', p: [[50, 5], [75, 35], [62, 35], [82, 60], [55, 60], [55, 92], [45, 92], [45, 60], [18, 60], [38, 35], [25, 35]] },
    { n: '小猫', en: 'cat', e: '🐱', c: '#ff8fc7', p: [[20, 90], [20, 35], [16, 8], [38, 24], [62, 24], [84, 8], [80, 35], [80, 90]] }];
  const densify = (pts, n) => { pts = pts.map(p => p.slice()); while (pts.length < n) { let bi = 0, bd = -1; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > bd) { bd = d; bi = i; } }); const p = pts[bi], q = pts[(bi + 1) % pts.length]; pts.splice(bi + 1, 0, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); } return pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]); };
  const dotRounds = (g, lab, l) => R.sample(SHAPES.filter(sh => sh.p.length <= lab(99).length), 3).map(sh => { const n = Math.max(sh.p.length, [8, 12, 14, 15, 16][gi(g)]); const labels = lab(Math.min(n, lab(99).length)); return { pts: densify(sh.p, labels.length), labels, n: sh.n, en: sh.en, e: sh.e, c: sh.c, s: l === 'en' ? sh.en : sh.n, l: l || 'zh' }; });
  G.dots_num = g => dotRounds(g, n => Array.from({ length: Math.min(n, g <= 0 ? 10 : 20) }, (_, i) => String(i + 1)));
  G.dots_skip = g => { const step = R.pick(g <= 1 ? [2] : g === 2 ? [2, 5, 10] : g === 3 ? [3, 4, 5] : [6, 7, 8, 9]); return dotRounds(g, n => Array.from({ length: Math.min(n, 12) }, (_, i) => String(step * (i + 1)))); };
  G.dots_abc = g => dotRounds(g, n => Array.from({ length: Math.min(n, 26) }, (_, i) => { const L = String.fromCharCode(65 + i); return g >= 1 ? L.toLowerCase() : L; }), 'en');
  G.dots_cn = g => dotRounds(g, n => Array.from({ length: Math.min(n, g <= 0 ? 10 : 20) }, (_, i) => cnNum(i + 1)));

  /* 汉字积木：偏旁 + 部件 */
  const HZF = [
    { c: '青', m: [['氵', '清', '清水'], ['日', '晴', '晴天'], ['讠', '请', '请坐'], ['忄', '情', '心情'], ['目', '睛', '眼睛'], ['虫', '蜻', '蜻蜓']], d: ['土', '女', '足', '火'] },
    { c: '包', m: [['扌', '抱', '拥抱'], ['足', '跑', '跑步'], ['氵', '泡', '泡泡'], ['饣', '饱', '吃饱'], ['火', '炮', '鞭炮']], d: ['日', '女', '木', '目'] },
    { c: '马', m: [['女', '妈', '妈妈'], ['口', '吗', '好吗'], ['虫', '蚂', '蚂蚁'], ['石', '码', '号码']], d: ['氵', '木', '日', '扌'] },
    { c: '也', m: [['亻', '他', '他们'], ['女', '她', '她们'], ['土', '地', '土地'], ['氵', '池', '水池']], d: ['口', '木', '日', '目'] },
    { c: '巴', m: [['口', '吧', '好吧'], ['扌', '把', '一把伞'], ['父', '爸', '爸爸'], ['爪', '爬', '爬山']], d: ['氵', '女', '木', '日'] },
    { c: '交', m: [['木', '校', '学校'], ['饣', '饺', '饺子'], ['口', '咬', '咬一口'], ['月', '胶', '胶水']], d: ['氵', '女', '日', '目'] },
    { c: '生', m: [['女', '姓', '姓名'], ['日', '星', '星星'], ['牛', '牲', '牲口'], ['月', '胜', '胜利']], d: ['氵', '口', '木', '足'] },
    { c: '方', m: [['讠', '访', '访问'], ['纟', '纺', '纺织'], ['阝', '防', '防火'], ['艹', '芳', '芳香'], ['方', '放', '放学']], d: ['日', '口', '木', '足'] },
    { c: '工', m: [['氵', '江', '长江'], ['纟', '红', '红色'], ['力', '功', '功课'], ['穴', '空', '天空']], d: ['女', '日', '木', '足'] },
    { c: '主', m: [['亻', '住', '住在'], ['氵', '注', '注意'], ['木', '柱', '柱子']], d: ['女', '口', '日', '足'] },
    { c: '木', m: [['木', '林', '树林'], ['亻', '休', '休息'], ['口', '呆', '发呆'], ['日', '杲', '日出杲杲']], d: ['女', '足', '纟', '讠'] }];
  HZF.forEach(f => { if (f.c === '方') f.m = f.m.filter(x => x[1] !== '放'); if (f.c === '木') f.m = f.m.filter(x => x[1] !== '杲'); });
  G.hz_build = g => R.sample(HZF, 4).map(f => ({ comp: f.c, made: R.sample(f.m, Math.min(f.m.length, g <= 1 ? 3 : 4)).map(m => ({ r: m[0], ch: m[1], w: m[2], s: m[2], l: 'zh' })), decoys: R.sample(f.d, 2) }));

  /* 水管接通 */
  const rotCW = m => ((m << 1) | (m >> 3)) & 15;
  const rotN = (m, r) => { for (let i = 0; i < ((r % 4) + 4) % 4; i++) m = rotCW(m); return m; };
  function pipeFlow(P, rot) {
    const n = P.n, cur = P.base.map((m, i) => rotN(m, rot[i])), wet = new Set(), s = P.sy * n;
    if (!(cur[s] & 8)) return { wet, ok: false, cur };
    const q = [s]; wet.add(s);
    while (q.length) {
      const i = q.shift(), x = i % n, y = Math.floor(i / n), m = cur[i];
      for (const [b, dx, dy, ob] of [[1, 0, -1, 4], [2, 1, 0, 8], [4, 0, 1, 1], [8, -1, 0, 2]]) {
        if (!(m & b)) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx; if (wet.has(j) || !(cur[j] & ob)) continue; wet.add(j); q.push(j);
      }
    }
    const e = P.ey * n + n - 1; return { wet, ok: wet.has(e) && !!(cur[e] & 2), cur };
  }
  function walk(n, sy, ey, minLen) {
    const path = [[0, sy]], seen = new Set(['0,' + sy]); let it = 0;
    const rec = () => {
      if (++it > 20000) return false;
      const [x, y] = path[path.length - 1];
      if (x === n - 1 && y === ey) return path.length >= minLen;
      for (const [dx, dy] of R.shuffle([[1, 0], [0, 1], [0, -1], [-1, 0]])) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || seen.has(k)) continue;
        seen.add(k); path.push([nx, ny]); if (rec()) return true; path.pop(); seen.delete(k);
      }
      return false;
    };
    return rec() ? path : null;
  }
  const DIRB = { '0,-1': 1, '1,0': 2, '0,1': 4, '-1,0': 8 };
  function pipeRound(n, g) {
    for (let t = 0; t < 60; t++) {
      const sy = R.int(0, n - 1), ey = R.int(0, n - 1), path = walk(n, sy, ey, n + (n > 3 ? 2 : 0));
      if (!path) continue;
      const base = Array(n * n).fill(0), onPath = Array(n * n).fill(false);
      path.forEach((p, i) => {
        const pr = i ? path[i - 1] : [p[0] - 1, p[1]], nx = i < path.length - 1 ? path[i + 1] : [p[0] + 1, p[1]];
        base[p[1] * n + p[0]] = DIRB[(pr[0] - p[0]) + ',' + (pr[1] - p[1])] | DIRB[(nx[0] - p[0]) + ',' + (nx[1] - p[1])]; onPath[p[1] * n + p[0]] = true;
      });
      const fill = g >= 3 ? [5, 10, 3, 6, 12, 9, 7, 11, 13, 14] : [5, 10, 3, 6, 12, 9];
      base.forEach((m, i) => { if (!onPath[i]) base[i] = R.pick(fill); });
      const P = { n, sy, ey, base, path: onPath }, rot = base.map(() => R.int(0, 3));
      let guard = 0; while (pipeFlow(P, rot).ok && guard++ < 20) { const i = R.pick(onPath.map((v, k) => v ? k : -1).filter(k => k >= 0)); rot[i] = (rot[i] + 1) % 4; }
      P.rot = rot; return P;
    }
  }
  G.pipes = g => [0, 1, 2].map(r => pipeRound([3, 4, 4, 5, 6][gi(g)] + (r === 2 && g >= 1 && g < 4 ? 1 : 0), g));

  /* 点亮星星 */
  const lightsState = (n, press) => { const lit = Array(n * n).fill(true); press.forEach(i => { const x = i % n, y = Math.floor(i / n); [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < n && ny < n) lit[ny * n + nx] = !lit[ny * n + nx]; }); }); return lit; };
  G.lights = g => Array.from({ length: 3 }, (_, r) => {
    const n = g <= 1 ? 3 : g <= 3 ? 4 : 5, k = [2, 3, 4, 5, 6][gi(g)] + (r === 2 ? 1 : 0);
    let press, lit; do { press = R.sample([...Array(n * n).keys()], Math.min(n * n - 1, k)); lit = lightsState(n, press); } while (lit.every(Boolean));
    return { n, press, lit };
  });

  /* 音乐记忆 */
  const SOL = [['do', 261.6, '#ff5d73'], ['re', 293.7, '#ff9f43'], ['mi', 329.6, '#ffd23f'], ['sol', 392, '#3ec1d3'], ['la', 440, '#a78bfa']];
  const GONG = [['宫', 261.6, '#c8382e'], ['商', 293.7, '#e8b84a'], ['角', 329.6, '#3f7d5a'], ['徵', 392, '#2f5d8a'], ['羽', 440, '#6a3f8a']];
  G.simon = g => ({ notes: SOL.slice(0, g <= 0 ? 3 : g <= 2 ? 4 : 5), start: 2, len: [4, 5, 6, 7, 8][gi(g)], latin: true });
  G.simon_gong = g => ({ notes: GONG.slice(0, g <= 0 ? 3 : g <= 2 ? 4 : 5), start: 2, len: [4, 5, 6, 7, 8][gi(g)] });

  /* 小厨师点单 */
  const MW = { 香蕉: '根', 黄瓜: '根', 胡萝卜: '根', 玉米: '根', 葡萄: '串', 饼干: '块', 蛋糕: '块', 披萨: '块', 糖果: '颗', 草莓: '颗', 樱桃: '颗' };
  const FOODP = () => ['fruit', 'veg'].flatMap(k => D.W[k].items).concat(D.W.food.items.filter(x => ['egg', 'cake', 'cookie', 'candy', 'dumpling', 'pizza', 'hamburger'].includes(x[3])));
  function cook(g, mode) {
    const pool = [...new Map(FOODP().filter(x => x[4] <= Math.max(1, g + 1) && !/\s/.test(x[3])).map(x => [x[3], x])).values()];
    return Array.from({ length: 5 }, () => {
      const shelf = R.sample(pool, 6), kinds = g <= 0 ? 1 : g <= 2 ? R.int(1, 2) : R.int(2, 3), maxN = mode === 'en' ? Math.min(10, 3 + g * 2) : [3, 5, 6, 8, 9][gi(g)];
      const items = R.sample(shelf, kinds).map(x => ({ e: x[0], zh: x[1], en: x[3], n: R.int(1, maxN) }));
      let text, say, l = 'zh';
      if (mode === 'en') { l = 'en'; text = items.map(it => (it.n === 1 ? (/^[aeiou]/.test(it.en) ? 'an ' : 'a ') + it.en : EN_NUM[it.n] + ' ' + plural(it.en))).join(' and ') + ', please!'; text = text[0].toUpperCase() + text.slice(1); say = text; }
      else if (mode === 'cn') { text = '我要' + items.map(it => liang(it.n) + (MW[it.zh] || '个') + it.zh).join('和') + '！'; say = text; }
      else { text = null; say = '我要' + items.map(it => liang(it.n) + (MW[it.zh] || '个') + it.zh).join('和'); }
      return { shelf: shelf.map(x => ({ e: x[0], zh: x[1], en: x[3] })), items, text, say, l, cust: R.pick(CUST), noPre: true };
    });
  }
  G.cook_math = g => ({ mode: 'math', time: [70, 60, 55, 50, 45][gi(g)], rounds: cook(g, 'math') });
  G.cook_cn = g => ({ mode: 'cn', time: [80, 70, 60, 55, 50][gi(g)], rounds: cook(g, 'cn') });
  G.cook_en = g => ({ mode: 'en', time: [80, 70, 60, 55, 50][gi(g)], rounds: cook(g, 'en') });

  /* 对称画 */
  const SYM_COL = ['#ff5d73', '#3ec1d3', '#ffd23f'];
  G.sym = g => Array.from({ length: 3 }, (_, r) => {
    const [w, hh, k] = [[4, 4, 1], [6, 5, 1], [6, 6, 2], [8, 6, 2], [8, 8, 3]][gi(g)];
    const axis = g >= 3 && r === 2 ? 'h' : 'v', C = w, RW = axis === 'h' ? (hh % 2 ? hh + 1 : hh) : hh;
    let cells;
    do {
      cells = Array(C * RW).fill(0);
      for (let y = 0; y < RW; y++) for (let x = 0; x < C; x++) { const src = axis === 'v' ? x < C / 2 : y < RW / 2; if (src && Math.random() < .45) cells[y * C + x] = R.int(1, k); }
    } while (cells.filter(Boolean).length < 3);
    return { C, R: RW, axis, colors: SYM_COL.slice(0, k), cells };
  });

  /* 算式建造 */
  const eqEval = (nums, ops) => {
    const a = [nums[0]], o = [];
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i], n = nums[i + 1];
      if (op === '×' || op === '÷') { const l = a.pop(); if (op === '÷' && (n === 0 || l % n)) return NaN; a.push(op === '×' ? l * n : l / n); }
      else { a.push(n); o.push(op); }
    }
    return o.reduce((v, op, i) => op === '+' ? v + a[i + 1] : v - a[i + 1], a[0]);
  };
  G.eq_build = g => Array.from({ length: 5 }, () => {
    const cfg = [{ k: 2, ops: ['+'], max: 6, extra: 2, tmax: 10 }, { k: 2, ops: ['+', '−'], max: 10, extra: 2, tmax: 20 }, { k: 3, ops: ['+', '−'], max: 12, extra: 1, tmax: 30 }, { k: 3, ops: ['+', '−', '×'], max: 9, extra: 1, tmax: 60 }, { k: 4, ops: ['+', '−', '×', '÷'], max: 9, extra: 0, tmax: 99 }][gi(g)];
    for (let t = 0; t < 400; t++) {
      const nums = Array.from({ length: cfg.k }, () => R.int(1, cfg.max)), ops = Array.from({ length: cfg.k - 1 }, () => R.pick(cfg.ops));
      const v = eqEval(nums, ops);
      if (!Number.isInteger(v) || v <= 0 || v > cfg.tmax) continue;
      if (cfg.k >= 3 && ops.every(o => o === ops[0]) && Math.random() < .6) continue;
      const cards = R.shuffle(nums.concat(Array.from({ length: cfg.extra }, () => R.int(1, cfg.max))));
      return { cards, target: v, k: cfg.k, ops: cfg.ops, sol: { nums, ops } };
    }
    return { cards: [2, 3, 5], target: 5, k: 2, ops: ['+'], sol: { nums: [2, 3], ops: ['+'] } };
  });

  /* 过马路 */
  G.traffic = g => ({ n: g <= 1 ? 3 : 4, lanes: g <= 1 ? 2 : 3, green: [7, 6.5, 6, 5.5, 5][gi(g)], red: 4, speed: .2 + g * .02 });

  /* 拼图 */
  const JIG = [['elephant', '大象'], ['giraffe', '长颈鹿'], ['hippo', '河马'], ['monkey', '猴子'], ['panda', '熊猫'], ['parrot', '鹦鹉'], ['penguin', '企鹅'], ['pig', '猪'], ['rabbit', '兔子'], ['snake', '蛇']];
  const jig = (g, l) => R.sample(JIG, 3).map((x, r) => ({ img: 'assets/img/jig/' + x[0] + '.png', zh: x[1], en: x[0], n: [2, 3, 3, 4, 4][gi(g)] + (r === 2 && g >= 1 && g < 4 ? 1 : 0), s: l === 'en' ? x[0] : x[1], l }));
  G.jig_zh = g => jig(g, 'zh');
  G.jig_en = g => jig(g, 'en');

  Object.assign(CONTENT, { pipeFlow, rotN, eqEval, lightsState, cnNum });
})();
