/* 我的家园（JRPG · P3 风格）：3D 卡通描边小屋 + 桌宠式自主行为 + 宠物分级 / 装备掉落 / 出门探索
   · 宠物 5 个稀有度（N / R / SR / SSR / UR），孵化概率不同，30 抽保底 SSR 以上
   · 宠物按稀有度以不同概率掉落「外设装备」（多一颗心、护盾、金币磁铁……），装备后在所有游戏 / Boss 战里生效
   · 小屋里宠物会自己闲逛、打盹、看月亮、追蝴蝶、追尾巴、偷偷叼来礼物……点地板让主角走过去，点宠物互动 */
(function () {
  const { h, sleep, today, esc, Store, Audio2, Voice, E, hydrate, UI } = Core;
  const R = CONTENT.R;
  const P = () => Store.p, save = () => Store.save();

  /* ================= 稀有度 ================= */
  const TIERS = [
    { id: 'N', n: '普通', c: '#a9bdd6', p: .50 },
    { id: 'R', n: '稀有', c: '#4fc3ff', p: .30 },
    { id: 'SR', n: '超稀有', c: '#b77bff', p: .14 },
    { id: 'SSR', n: '传说', c: '#ffc23d', p: .05 },
    { id: 'UR', n: '神话', c: '#ff5fa8', p: .01 },
  ];
  const PITY = 30;

  /* ================= 宠物图鉴 =================
     m：3D 模型 key（assets/models/c/），没有模型时用 3D 表情 e；h：在场景里的高度（米）；sk：Boss 战技能名 */
  const PETDEX = [
    { id: 'rabbit', n: '兔兔', e: '🐰', t: 0, h: .6, m: 'bunny', sk: '萝卜飞弹' },
    { id: 'chick', n: '小黄鸡', e: '🐤', t: 0, h: .5, m: 'chick', sk: '啄啄攻击' },
    { id: 'frog', n: '呱呱蛙', e: '🐸', t: 0, h: .55, m: 'frog', sk: '长舌头' },
    { id: 'slime', n: '果冻史莱姆', e: '🟢', t: 0, h: .45, m: 'slime_green', sk: '弹弹撞击' },
    { id: 'shroom', n: '蘑菇仔', e: '🍄', t: 0, h: .5, m: 'mushroom', sk: '孢子喷嚏' },
    { id: 'cactus', n: '仙人球', e: '🌵', t: 0, h: .5, m: 'cactus', sk: '小刺刺' },
    { id: 'cat', n: '喵喵球', e: '🐱', t: 1, h: .55, m: 'cat', sk: '猫猫拳' },
    { id: 'shiba', n: '柴犬', e: '🐕', t: 1, h: .65, m: 'shiba', sk: '旋风尾巴' },
    { id: 'panda', n: '熊猫', e: '🐼', t: 1, h: .7, m: 'panda', sk: '竹子棍法' },
    { id: 'parrot', n: '蓝蓝鸟', e: '🐦', t: 1, h: .5, m: 'bluebird', sk: '学舌干扰' },
    { id: 'alpaca', n: '羊驼', e: '🦙', t: 1, h: .9, m: 'alpaca', sk: '口水炮' },
    { id: 'pinky', n: '粉团子', e: '🩷', t: 1, h: .45, m: 'slime_pink', sk: '甜甜治愈' },
    { id: 'fox', n: '狐狸', e: '🦊', t: 2, h: .65, m: 'fox', sk: '狐火' },
    { id: 'husky', n: '哈士奇', e: '🐺', t: 2, h: .75, m: 'husky', sk: '拆家冲锋' },
    { id: 'deer', n: '小鹿', e: '🦌', t: 2, h: .95, m: 'deer', sk: '森林祝福' },
    { id: 'puff', n: '胖胖鸟', e: '🐧', t: 2, h: .55, m: 'puffbird', sk: '圆滚滚冲击' },
    { id: 'ghost', n: '幽幽', e: '👻', t: 2, h: .7, m: 'ghost', sk: '隐身术' },
    { id: 'yeti', n: '雪怪宝宝', e: '❄️', t: 2, h: .8, m: 'yeti', sk: '暴风雪' },
    { id: 'horse', n: '天马', e: '🐴', t: 3, h: 1.1, m: 'pony', sk: '流星蹄' },
    { id: 'stag', n: '月光鹿王', e: '🦌', t: 3, h: 1.15, m: 'stag', sk: '月下长鸣' },
    { id: 'unicorn', n: '独角兽', e: '🦄', t: 3, h: 1.05, m: 'unicorn', sk: '彩虹光束' },
    { id: 'alpaking', n: '羊驼国王', e: '👑', t: 3, h: .85, m: 'alpaking', sk: '王之号令' },
    { id: 'dragon', n: '小龙', e: '🐲', t: 4, h: .8, m: 'dragon', sk: '智慧龙息' },
    { id: 'dragonk', n: '龙王', e: '🐉', t: 4, h: 1.0, m: 'dragon_king', sk: '龙王咆哮' },
  ];
  // 旧版本的宠物没有 3D 模型：读档时换成同稀有度、外形相近的 3D 伙伴（已拥有就给它升一星）
  const LEGACY = { penguin: 'puff', pig: 'pinky', monkey: 'frog', elephant: 'yeti', giraffe: 'alpaca', hippo: 'slime', snake: 'cactus' };
  const OLD_NAMES = { penguin: '企鹅', pig: '小猪', monkey: '猴猴', elephant: '小象', giraffe: '长颈鹿', hippo: '河马', snake: '小蛇' };
  // 模型映射（由 assets/models/c/index.js 的 CHAR_INDEX 提供；没有就用表情）
  const petModel = id => { const K = dex(id); const m = K.m || (window.CHAR_PETS && CHAR_PETS[id]); return m && window.Avatar3D && Avatar3D.has(m) ? m : null; };
  const dex = id => PETDEX.find(x => x.id === id) || PETDEX[0];
  const tierOf = id => TIERS[dex(id).t];

  /* ================= 外设装备 ================= */
  const GEAR = [
    { k: 'heart', n: '心之护符', e: '💖', v: [1, 1, 2, 2, 3], d: v => '每局多 ' + v + ' 颗心' },
    { k: 'shield', n: '守护之盾', e: '🛡️', v: [1, 1, 1, 2, 3], d: v => '每局前 ' + v + ' 次答错不扣心' },
    { k: 'potion', n: '治愈之泉', e: '⛲', v: [1, 1, 2, 2, 3], d: v => '只剩 1 颗心时回复 ' + v + ' 颗（每局一次）' },
    { k: 'eye', n: '洞察之眼', e: '👁️', v: [1, 2, 3, 4, 6], d: v => '每局前 ' + v + ' 题自动去掉一个错误选项' },
    { k: 'magnet', n: '金币磁铁', e: '🧲', v: [10, 20, 30, 50, 80], d: v => '金币 +' + v + '%' },
    { k: 'book', n: '智慧之书', e: '📘', v: [10, 20, 30, 50, 80], d: v => '经验 +' + v + '%' },
    { k: 'sword', n: '勇气之剑', e: '🗡️', v: [1, 1, 2, 2, 3], d: v => 'Boss 战攻击 +' + v },
    { k: 'clover', n: '幸运四叶草', e: '🍀', v: [3, 5, 8, 12, 20], d: v => '宠物掉落装备概率 +' + v + '%' },
  ];
  const GEAR_SLOTS = 3;
  // 宠物稀有度 → 掉落的装备稀有度分布（%）
  const DROP_TIER = [[70, 25, 5, 0, 0], [50, 35, 13, 2, 0], [30, 40, 22, 7, 1], [15, 35, 30, 16, 4], [5, 25, 35, 25, 10]];
  // 宠物稀有度 → 基础掉落概率
  const DROP_CHANCE = [.12, .16, .21, .27, .34];
  const SRC_MULT = { pet: .35, explore: 1, game: .3, boss: 1.6, gift: 4 };
  const gearDef = k => GEAR.find(g => g.k === k);
  const gearVal = g => gearDef(g.k).v[g.t];

  /* ================= 存档迁移 ================= */
  function ensure(p) {
    p = p || P(); if (!p) return p;
    p.gear = p.gear || []; p.gearOn = (p.gearOn || []).filter(id => p.gear.some(g => g.id === id)).slice(0, GEAR_SLOTS);
    p.pity = p.pity || 0; p.petStars = p.petStars || {}; p.petsOwned = p.petsOwned || [];
    p.hm = p.hm || {}; if (p.hm.date !== today()) p.hm = { date: today(), pet: 0, coin: 0, gift: 0, spots: {}, ap: 5 + (bondFx().ap || 0), met: {}, gave: {}, shd: {} };
    ['spots', 'met', 'gave', 'shd'].forEach(k => p.hm[k] = p.hm[k] || {}); if (p.hm.ap == null) p.hm.ap = 5; p.soc = p.soc || {}; p.bond = p.bond || {};
    const mig = k => LEGACY[k] || (PETDEX.some(x => x.id === k) ? k : 'rabbit');
    let moved = null;
    if (p.pet && mig(p.pet.kind) !== p.pet.kind) { const old = p.pet.kind; p.pet.kind = mig(old); if (!p.pet.name || p.pet.name === OLD_NAMES[old]) p.pet.name = dex(p.pet.kind).n; moved = p.pet.kind; }
    if (p.pet) p.pet.bond = p.pet.bond || 0;
    if (p.petStore) Object.keys(p.petStore).forEach(k => { const n = mig(k); if (n !== k) { const v = p.petStore[k]; delete p.petStore[k]; if (!p.petStore[n]) { v.kind = n; if (v.name === OLD_NAMES[k]) v.name = dex(n).n; p.petStore[n] = v; } } });
    const own = [];
    p.petsOwned.forEach(k => { const n = mig(k); if (own.includes(n)) p.petStars[n] = Math.min(5, (p.petStars[n] || 1) + 1); else { own.push(n); if (n !== k) p.petStars[n] = Math.max(p.petStars[n] || 1, p.petStars[k] || 1); } });
    p.petsOwned = own;
    if (moved) { save(); setTimeout(() => UI.toast(E('✨') + ' 你的宠物进化成了 3D 伙伴「' + esc(dex(moved).n) + '」！', 2600), 800); }
    return p;
  }

  /* ================= 装备效果（供游戏调用） ================= */
  function gearFx(p) {
    p = p || P(); const fx = { heart: 0, shield: 0, potion: 0, eye: 0, magnet: 0, book: 0, sword: 0, clover: 0 };
    if (!p || !p.gear) return fx;
    (p.gearOn || []).forEach(id => { const g = p.gear.find(x => x.id === id); if (g) fx[g.k] += gearVal(g); });
    // 人格能力 + 伙伴羁绊 + 睡眠
    fx.eye += Math.floor(socRank(p, 'kn') / 2); fx.sword += socRank(p, 'gu') - 1;
    const b = bondFx(); ['heart', 'shield', 'potion', 'eye', 'magnet', 'book', 'sword', 'clover'].forEach(k => fx[k] += b[k] || 0);
    if (p.hm && p.hm.date === today() && p.hm.rested) fx.heart += 1;
    return fx;
  }
  function rollTier(dist) { let r = Math.random() * 100; for (let i = 0; i < dist.length; i++) { r -= dist[i]; if (r < 0) return i; } return 0; }
  function makeGear(t, k) { return { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), k: k || R.pick(GEAR).k, t }; }
  // 掉落判定：src = pet / explore / game / boss / gift；返回装备或 null
  function rollDrop(src, force) {
    const p = ensure(); if (!p || !p.pet) return null;
    const t = dex(p.pet.kind).t, star = (p.petStars[p.pet.kind] || 1) - 1, fx = gearFx(p);
    const chance = Math.min(.95, (DROP_CHANCE[t] + star * .03 + fx.clover / 100) * (SRC_MULT[src] || 1));
    if (!force && Math.random() >= chance) return null;
    const g = makeGear(rollTier(DROP_TIER[t]));
    p.gear.push(g); if (p.gearOn.length < GEAR_SLOTS) p.gearOn.push(g.id); save();
    return g;
  }
  function gearCard(g, extra) {
    const G = gearDef(g.k), T = TIERS[g.t];
    return '<div class="gcard t' + g.t + ' ' + (extra || '') + '" data-id="' + g.id + '" style="--tc:' + T.c + '"><i class="gc-tier">' + T.id + '</i>' + E(G.e, 'gc-ico') + '<b>' + G.n + '</b><small>' + G.d(gearVal(g)) + '</small></div>';
  }
  function dropToast(g, who) {
    if (!g) return; const G = gearDef(g.k), T = TIERS[g.t];
    Audio2.sfx(g.t >= 3 ? 'victory' : 'gem', .55); if (g.t >= 2) UI.confetti(40 + g.t * 25);
    UI.toast('<div class="drop-toast" style="--tc:' + T.c + '">' + E(G.e) + '<div><small>' + (who || '宠物') + ' 带回了装备！</small><b>【' + T.id + '】' + G.n + '</b><small>' + G.d(gearVal(g)) + '</small></div></div>', 3200);
  }

  /* ================= 孵化（抽卡） ================= */
  function hatchRoll() {
    const p = ensure(); p.pity++;
    let t; if (p.pity >= PITY) t = Math.random() < .83 ? 3 : 4; else { let r = Math.random(); t = 0; for (let i = 0; i < TIERS.length; i++) { r -= TIERS[i].p; if (r < 0) { t = i; break; } } }
    if (t >= 3) p.pity = 0;
    const pool = PETDEX.filter(x => x.t === t); const K = R.pick(pool);
    const dup = p.petsOwned.includes(K.id);
    if (dup) p.petStars[K.id] = Math.min(5, (p.petStars[K.id] || 1) + 1); else { p.petsOwned.push(K.id); p.petStars[K.id] = 1; }
    return { K, t, dup };
  }
  function newPetObj(k) { return { kind: k, name: dex(k).n, lv: 1, xp: 0, food: 80, joy: 90, bond: 0, last: Date.now() }; }
  function switchPet(k) {
    const p = P(); p.petStore = p.petStore || {};
    if (p.pet) p.petStore[p.pet.kind] = p.pet;
    p.pet = p.petStore[k] || newPetObj(k); save();
  }

  /* ================= 3D 表情 / 立绘 HTML ================= */
  function petImg(kind, o) {
    o = o || {}; const K = dex(kind), m = petModel(kind);
    const fb = Core.emoSrc(K.e);
    return '<img class="pimg ' + (o.cls || '') + '" src="' + fb + '"' + (m ? ' data-av="' + m + '" data-style="anime" data-pose="' + (o.pose || 'idle') + '" data-size="' + (o.size || 256) + '"' + (o.yaw != null ? ' data-yaw="' + o.yaw + '"' : '') : '') + ' draggable="false" alt="' + K.n + '">';
  }
  const tierBadge = t => '<i class="tbadge t' + t + '" style="--tc:' + TIERS[t].c + '">' + TIERS[t].id + '</i>';
  const stars = n => '<span class="pstars">' + '★'.repeat(n || 1) + '<em>' + '★'.repeat(5 - (n || 1)) + '</em></span>';

  /* ================= 人格能力（五维） =================
     在家里的活动、和伙伴相处会提升；每升一阶解锁实际效果 */
  const SOC = [
    { k: 'kn', n: '知识', e: '📚', c: '#ffd23f', ranks: ['普通', '有学问', '博学', '学霸', '百科全书'], perk: r => '每局前 ' + Math.floor(r / 2) + ' 题自动去掉一个错误选项' },
    { k: 'gu', n: '胆量', e: '🔥', c: '#ff4a3a', ranks: ['还行', '靠得住', '勇敢', '无畏', '狮子心'], perk: r => '暗影战 / Boss 战攻击 +' + (r - 1) },
    { k: 'de', n: '灵巧', e: '🛠️', c: '#5fe0ff', ranks: ['笨手笨脚', '有点巧', '灵活', '匠人', '魔术手'], perk: r => '暗影战闪避 ' + r * 4 + '%' + (r >= 3 ? ' · 手工一次做 2 个' : '') },
    { k: 'ki', n: '温柔', e: '🌸', c: '#ff8fc8', ranks: ['腼腆', '体贴', '温暖', '包容', '天使'], perk: r => '宠物亲密度获得 +' + (r - 1) * 20 + '%' + (r >= 4 ? ' · 交涉多一次机会' : '') },
    { k: 'ch', n: '魅力', e: '✨', c: '#b77bff', ranks: ['普通', '有型', '迷人', '闪耀', '万人迷'], perk: r => (r >= 3 ? '交涉少答 1 题 · ' : '') + '伙伴好感 +' + (r - 1) * 10 + '%' },
  ];
  const SOC_NEED = [0, 6, 16, 32, 56];
  const socPts = (p, k) => ((p.soc || {})[k] || 0);
  const socRank = (p, k) => { const v = socPts(p, k); let r = 1; SOC_NEED.forEach((n, i) => { if (v >= n) r = i + 1; }); return r; };
  function addSoc(p, k, n) { p.soc = p.soc || {}; const r0 = socRank(p, k); p.soc[k] = socPts(p, k) + n; save(); const r1 = socRank(p, k); return { k, n, r0, r1 }; }
  // 伙伴（羁绊）效果：Bond 模块提供
  const bondFx = () => (window.Bond ? Bond.fx() : {});

  /* ---------- 活动结果卡（P5 式斜切卡片 + 能力上升提示） ---------- */
  function actCard(what, ic, note, gains) {
    const box = h('div', 'act-card');
    box.innerHTML = '<div class="ac-head">' + E(ic) + '<b>' + esc(what) + '</b></div><div class="ac-note">' + esc(note || '') + '</div>' + (gains || []).map(g => { const S0 = SOC.find(x => x.k === g.k); return '<div class="ac-g" style="--c:' + S0.c + '">' + E(S0.e) + '<span>' + S0.n + '</span><i>' + '▲'.repeat(Math.min(3, Math.ceil(g.n / 2))) + '</i><b>+' + g.n + '</b></div>'; }).join('');
    hydrate(box); document.body.appendChild(box); Audio2.sfx('star', .45);
    setTimeout(() => box.classList.add('out'), 2600); setTimeout(() => box.remove(), 3100);
    (gains || []).forEach((g, i) => { if (g.r1 > g.r0) setTimeout(() => rankUp(g.k, g.r1), 900 + i * 1800); });
    if (gains && gains.length) { const S0 = SOC.find(x => x.k === gains[0].k); Voice.say(S0.n + '提升了！'); }
  }
  function rankUp(k, r) {
    const S0 = SOC.find(x => x.k === k), el = h('div', 'rank-up');
    el.innerHTML = '<div class="ru-burst"></div><div class="ru-in" style="--c:' + S0.c + '">' + E(S0.e, 'ru-ic') + ransom(S0.n + ' RANK UP') + '<div class="ru-r">第 ' + r + ' 阶「' + S0.ranks[r - 1] + '」</div><div class="ru-p">' + esc(S0.perk(r)) + '</div></div>';
    hydrate(el); document.body.appendChild(el); Audio2.sfx('levelup', .6); UI.confetti(60);
    el.onclick = () => el.remove(); setTimeout(() => el.classList.add('out'), 2800); setTimeout(() => el.remove(), 3300);
  }
  // 勒索信式标题：每个字随机字体 / 底色 / 角度
  function ransom(t) {
    const F = ["'Fredoka'", "'ZK'", "'InkBrush'", "'Hand'", "'PixelZH'"], BG = ['#fff', '#000', '#e60012', '#fff', '#000'];
    let seed = 0; for (const c of t) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
    return '<span class="ransom">' + Array.from(t).map(c => { if (c === ' ') return '<i class="sp"></i>'; const b = BG[(rnd() * 5) | 0], fg = b === '#fff' ? '#000' : '#fff'; return '<em style="font-family:' + F[(rnd() * 5) | 0] + ';background:' + b + ';color:' + fg + ';transform:rotate(' + ((rnd() - .5) * 16).toFixed(1) + 'deg) translateY(' + ((rnd() - .5) * 6).toFixed(1) + 'px);font-size:' + (0.9 + rnd() * .35).toFixed(2) + 'em">' + esc(c) + '</em>'; }).join('') + '</span>';
  }
  // 天亮：P5 式日历翻页
  function dayCard() {
    return new Promise(res => {
      const d = new Date(), wk = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
      const el = h('div', 'p5-cal'); el.innerHTML = '<div class="pc-bg"></div><div class="pc-strip"></div><div class="pc-date"><b>' + (d.getMonth() + 1) + '/' + d.getDate() + '</b><i>' + wk + '</i></div><div class="pc-tod"><span class="t0">夜晚</span><span class="t1">早上</span></div><div class="pc-msg">新的一天开始了</div>';
      document.body.appendChild(el); Audio2.sfx('whoosh', .5);
      setTimeout(() => { el.classList.add('flip'); Audio2.sfx('magic', .4); }, 1100);
      setTimeout(() => { el.classList.add('out'); res(); }, 2600); setTimeout(() => el.remove(), 3200);
    });
  }
  // 小测验：n 题，P5 风格题板，返回答对数
  function pickQ() {
    const p = P(); const pool = CATALOG.GAMES.filter(g => p.grade >= g.g0 && p.grade <= g.g1 && !Engines.NONQ.has(g.eng) && !Engines.BIG.has(g.eng));
    for (let i = 0; i < 16; i++) { try { const g = R.pick(pool); const qs = CONTENT.G[g.gen](p.grade); const c = Array.isArray(qs) ? R.shuffle(qs.filter(x => x && x.ch && x.ch.length >= 2 && !x.listen))[0] : null; if (c) return c; } catch (e) {} }
    return null;
  }
  function quizRound(n, title, sub, opt) {
    opt = opt || {};
    return new Promise(res => {
      let i = 0, ok = 0; const m = UI.modal('<div class="p5-qhead">' + ransom(title) + '<small>' + esc(sub || '') + '</small><div class="p5-qdots"></div></div><div class="p5-qbody"></div>', { cls: 'wide p3m p5q', noClose: !!opt.noClose, onClose: () => res(ok) });
      const body = m.el.querySelector('.p5-qbody'), dots = m.el.querySelector('.p5-qdots');
      const next = () => {
        dots.innerHTML = Array.from({ length: n }, (_, k) => '<i class="' + (k < i ? (k < ok + (i - ok) && body.dataset['r' + k] === '1' ? 'ok' : 'no') : k === i ? 'cur' : '') + '"></i>').join('');
        if (i >= n) { setTimeout(() => m.close(), 400); return; }
        const q = pickQ(); if (!q) { m.close(); return; }
        body.innerHTML = ''; const QP = Engines.qPanel(q); body.appendChild(QP.el);
        const grid = h('div', 'choices compact n' + q.ch.length); body.appendChild(grid); let done = false;
        q.ch.forEach(c => { const b = h('button', 'choice pop-in', Engines.choiceHTML(c, q.latinCh)); b.dataset.ok = c.ok ? 1 : 0; b.onclick = async () => {
          if (done) return; done = true;
          if (c.ok) { ok++; body.dataset['r' + i] = '1'; b.classList.add('good'); Audio2.sfx('right', .5); opt.onRight && opt.onRight(); }
          else { b.classList.add('bad'); grid.children[q.ch.findIndex(x => x.ok)].classList.add('reveal'); Audio2.sfx('wrong', .4); opt.onWrong && opt.onWrong(); if (q.ex) Voice.say('正确答案：' + q.ex); }
          await sleep(c.ok ? 700 : 1500); i++; next();
        }; grid.appendChild(b); });
        hydrate(body); QP.speak();
      };
      next();
    });
  }
  const BOOKS = [
    ['海洋的秘密', '海洋覆盖了地球表面的大约十分之七，最深的地方比珠穆朗玛峰还要深。'],
    ['会发光的生物', '萤火虫、水母和一些深海鱼都会自己发光，这叫作生物发光。'],
    ['月亮的脸', '月亮总是用同一面对着地球，所以我们从来看不到月亮的背面。'],
    ['恐龙图鉴', '霸王龙的牙齿有香蕉那么大，但它的前爪却非常短小。'],
    ['蜜蜂的舞蹈', '蜜蜂会跳摇摆舞，告诉同伴花朵在哪个方向、有多远。'],
    ['宇宙有多大', '光一秒钟能绕地球七圈半，但从太阳照到地球也要八分钟。'],
    ['会变色的动物', '变色龙会根据心情和温度改变身体的颜色。'],
    ['古代的发明', '造纸术、印刷术、指南针和火药，是中国古代的四大发明。'],
    ['植物喝水', '植物用根吸水，水会顺着茎一直走到叶子上。'],
    ['企鹅爸爸', '帝企鹅爸爸会把蛋放在脚背上，一动不动地孵两个多月。'],
  ];
  function bookCard(b) {
    const el = h('div', 'book-card'); el.innerHTML = '<div class="bk-t">' + E('📖') + '《' + esc(b[0]) + '》</div><div class="bk-x">' + esc(b[1]) + '</div>';
    hydrate(el); document.body.appendChild(el); setTimeout(() => el.classList.add('out'), 5200); setTimeout(() => el.remove(), 5700);
  }
  function statsPanel() {
    const p = P();
    const m = UI.modal('<div class="p3-mh"><b>STATUS</b><span>人格能力</span></div><div class="soc-wrap"><canvas class="soc-radar" width="300" height="300"></canvas><div class="soc-list">' + SOC.map(S0 => {
      const r = socRank(p, S0.k), v = socPts(p, S0.k), lo = SOC_NEED[r - 1], hi = SOC_NEED[r] || lo + 1;
      return '<div class="soc-row" style="--c:' + S0.c + '">' + E(S0.e) + '<div class="sr-m"><div class="sr-h"><b>' + S0.n + '</b><span>Lv.' + r + ' 「' + S0.ranks[r - 1] + '」</span></div><div class="sr-bar"><i style="width:' + (r >= 5 ? 100 : Math.round((v - lo) / (hi - lo) * 100)) + '%"></i></div><small>' + esc(S0.perk(r)) + '</small></div></div>';
    }).join('') + '</div></div><p class="dim c">在家里的书桌、电脑、书架、电视、手工台、盆栽、窗户、镜子都能提升能力；每天有 ' + 5 + ' 点空闲时间，睡觉能恢复。今天还剩 <b>' + p.hm.ap + '</b> 点。</p>', { cls: 'wide p3m' });
    hydrate(m.el);
    const cv = m.el.querySelector('.soc-radar'), x = cv.getContext('2d'), cx = 150, cy = 155, R0 = 110;
    const pt = (i, k) => [cx + Math.cos(-Math.PI / 2 + i / 5 * Math.PI * 2) * R0 * k, cy + Math.sin(-Math.PI / 2 + i / 5 * Math.PI * 2) * R0 * k];
    for (let ring = 5; ring >= 1; ring--) { x.beginPath(); for (let i = 0; i < 5; i++) { const [a, b] = pt(i, ring / 5); i ? x.lineTo(a, b) : x.moveTo(a, b); } x.closePath(); x.fillStyle = ring % 2 ? '#1a1a1a' : '#000'; x.fill(); x.strokeStyle = '#444'; x.stroke(); }
    x.beginPath(); SOC.forEach((S0, i) => { const [a, b] = pt(i, socRank(p, S0.k) / 5); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.fillStyle = 'rgba(230,0,18,.75)'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke();
    x.font = "bold 18px 'ZK',sans-serif"; x.textAlign = 'center'; x.fillStyle = '#fff'; SOC.forEach((S0, i) => { const [a, b] = pt(i, 1.22); x.fillText(S0.n, a, b + 6); });
  }

  /* ================= 台词（预生成语音） ================= */
  const SAY_LIST = ['欢迎回家！', '今天也辛苦啦！', '要和我一起玩吗？', '肚子咕咕叫了…', '好舒服呀～', '真好吃！', '再来一次！', '我找到好东西啦！', '月亮好圆呀…', '呼…呼…好困…', '抓到你啦！', '看我的绝招！', '一起出去走走吧！', '这是送给你的礼物！', '影时间到了…好神秘…', '阿嚏！', '嘿嘿，转圈圈！', '我最喜欢你了！', '出门探索', '宠物图鉴', '装备', '孵蛋', '摸摸', '喂食', '玩球', '训练', '拍照', '换宠物', '换装', '没有食物了，去商店或者出门逛逛吧', '这里有好东西！', '什么也没找到，明天再来吧', '答对啦！奖励给你！', '再想想哦，明天再来挑战吧', '许个愿吧！', '坐下来休息一下吧', '咔嚓！拍得真好！', '一起玩吧！', '欢迎光临！', '孵化成功！', '是传说级的宠物！', '是神话级的宠物！', '星级提升了！'];

  /* ================= 家园主界面 ================= */
  let H = null; // 当前家园实例
  function open() {
    const p = ensure(); App.decayPet && App.decayPet(p); save();
    App.show('home', el => {
      el.classList.add('p3');
      el.innerHTML = '<div class="hm-3d"></div><div class="hm-fx"></div><div class="hm-labels"></div>' +
        '<div class="p3-top"><button class="back p3-back" data-tip="返回地图">' + E('⬅️') + '</button><div class="p3-title"><b>' + ransom('MY ROOM') + '</b><span>我的家园</span></div></div>' +
        '<div class="p3-date"></div>' +
        '<div class="p3-menu"></div>' +
        '<div class="p3-status"></div>' +
        '<div class="p3-dialog"><div class="pd-name"></div><div class="pd-text"></div></div>' +
        '<div class="hm-hint">点地板走过去 · 点宠物摸摸它 · 拖动转视角</div>';
      el.querySelector('.back').onclick = () => App.hub();
      drawDate(el); drawMenu(el); drawStatus(el);
      H = Room(el.querySelector('.hm-3d'), el);
      if (!p.pet && p.eggs) setTimeout(() => dialog('小提示', '你有 ' + p.eggs + ' 个宠物蛋，点右边的「孵蛋」把它孵出来吧！'), 900);
      else setTimeout(() => { dialog(p.pet ? p.pet.name : '家园', p.pet ? (p.pet.food < 30 ? '肚子咕咕叫了…' : R.pick(['欢迎回家！', '今天也辛苦啦！', '要和我一起玩吗？'])) : '还没有宠物哦，升级、签到、打败 Boss 都能拿到宠物蛋！', true); }, 700);
    }, { music: 'quaint' });
  }

  /* ---------- 日期 / 月相（致敬 P3 右上角） ---------- */
  function moonPhase(d) { const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) / 864e5; const age = ((d.getTime() / 864e5 - ref) % syn + syn) % syn; return age / syn; }
  function drawDate(el) {
    const d = new Date(), wk = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()], hr = d.getHours();
    const ph = moonPhase(d), moonE = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][Math.round(ph * 8) % 8];
    const tod = hr === 0 ? '影时间' : hr < 6 ? '深夜' : hr < 12 ? '早上' : hr < 14 ? '中午' : hr < 17 ? '放学后' : hr < 20 ? '傍晚' : '夜晚';
    el.querySelector('.p3-date').innerHTML = '<div class="pdt-d"><b>' + (d.getMonth() + 1) + '/' + d.getDate() + '</b><i>' + wk + '</i></div><div class="pdt-m">' + E(moonE) + '<span>' + tod + '</span></div>';
    if (hr === 0) el.classList.add('darkhour');
  }

  /* ---------- 指令菜单 ---------- */
  const MENU = [
    ['pat', '摸摸', '🤚', '1'], ['feed', '喂食', '🍖', '2'], ['ball', '玩球', '⚽', '3'], ['trick', '训练', '🎯', '4'], ['photo', '拍照', '📸', '5'],
    ['explore', '出门探索', '🗺️', '6'], ['gear', '装备', '🧰', '7'], ['dex', '宠物图鉴', '📖', '8'], ['egg', '孵蛋', '🥚', '9'], ['swap', '换宠物', '🔁', 'c'], ['dress', '换装', '👒', 'o'], ['stats', '人格能力', '📊', 'v'], ['bond', '羁绊伙伴', '🤝', 'n'], ['sleep', '睡觉', '🌙', 'z'],
  ];
  function drawMenu(el) {
    const p = P(), m = el.querySelector('.p3-menu');
    m.innerHTML = MENU.map((x, i) => {
      const dis = (!p.pet && /pat|feed|ball|trick|photo|explore/.test(x[0])) || (x[0] === 'egg' && !p.eggs) || (x[0] === 'swap' && p.petsOwned.length < 2);
      return '<button class="p3-item hm-item' + (dis ? ' dis' : '') + '" data-a="' + x[0] + '" data-key="' + x[3] + '" data-say="' + x[1] + '" style="--i:' + i + '"><i>' + E(x[2]) + '</i><b>' + x[1] + '</b>' + (x[0] === 'egg' && p.eggs ? '<em>×' + p.eggs + '</em>' : '') + (x[0] === 'gear' ? '<em>' + (p.gearOn || []).length + '/' + GEAR_SLOTS + '</em>' : '') + '</button>';
    }).join('');
    hydrate(m);
    m.onclick = e => { const b = e.target.closest('.p3-item'); if (!b) return; if (b.classList.contains('dis')) { Audio2.sfx('wrong', .3); if (!P().pet) dialog('提示', '先孵出一只宠物吧！'); return; } Audio2.sfx('select', .4); act(b.dataset.a, el); };
  }
  function drawStatus(el) {
    const p = P(), s = el.querySelector('.p3-status');
    if (!p.pet) { s.innerHTML = '<div class="ps-empty">' + E('🥚', 'ps-egg') + '<b>还没有宠物</b><small>宠物蛋 ×' + (p.eggs || 0) + '</small></div>'; hydrate(s); return; }
    const pet = p.pet, K = dex(pet.kind), need = 40 + pet.lv * 20, st = p.petStars[pet.kind] || 1;
    s.innerHTML = '<div class="ps-card" style="--tc:' + TIERS[K.t].c + '"><div class="ps-por">' + petImg(pet.kind, { frame: 'bust', size: 192, style: 'p5' }) + '</div>' +
      '<div class="ps-info"><div class="ps-name">' + tierBadge(K.t) + '<b>' + esc(pet.name) + '</b><button class="ps-ren" data-tip="改名">✎</button></div><div class="ps-sub">' + K.n + ' · Lv.' + pet.lv + ' ' + stars(st) + '</div>' +
      '<div class="ps-bars">' + [['饱食', pet.food, '#ffb02e'], ['心情', pet.joy, '#ff6fa8'], ['亲密', pet.bond || 0, '#5fd8ff'], ['成长', pet.xp / need * 100, '#8fff9a']].map(b => '<div class="ps-bar"><span>' + b[0] + '</span><div><i style="width:' + Math.max(0, Math.min(100, b[2 - 1])) + '%;background:' + b[2] + '"></i></div></div>').join('') + '</div>' +
      '<div class="ps-skill">技能 <b>' + K.sk + '</b> · 掉落率 ' + Math.round(Math.min(.95, DROP_CHANCE[K.t] + (st - 1) * .03 + gearFx(p).clover / 100) * 100) + '%</div></div></div>';
    hydrate(s); Avatar3D && Avatar3D.hydrate(s);
    s.querySelector('.ps-ren').onclick = () => renameDialog(pet, () => { drawStatus(el); H && H.petReact('trick'); });
  }
  // 改名：P3 风格面板，带宠物立绘、推荐名字（小朋友不用打字）和随机骰子
  const NAME_A = ['小', '阿', '团', '豆', '糖', '星', '月', '果', '布', '咕'], NAME_B = ['团', '豆', '宝', '球', '丸', '糖', '仔', '咪', '喵', '布丁', '奶昔', '饭团', '米粒', '泡芙', '可可', '芝麻', '星星', '月饼', '闪电', '旋风'];
  const randName = () => R.pick(NAME_A) + R.pick(NAME_B);
  function renameDialog(pet, done) {
    const K = dex(pet.kind), sugg = () => [K.n].concat(Array.from({ length: 5 }, randName)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 6);
    const m = UI.modal('<div class="p3-mh"><b>NAME</b><span>给宠物起名字</span></div>' +
      '<div class="pn-wrap"><div class="pn-por" style="--tc:' + TIERS[K.t].c + '">' + petImg(pet.kind, { size: 220, style: 'p5', pose: 'wave' }) + '</div>' +
      '<div class="pn-main"><div class="pn-field"><input class="pn-in" maxlength="8" value="' + esc(pet.name) + '" spellcheck="false" autocomplete="off"><button class="pn-dice" data-tip="随机一个" data-say="换一个">' + E('🎲') + '</button></div>' +
      '<div class="pn-sub">推荐名字</div><div class="pn-chips"></div>' +
      '<div class="r-btns"><button class="btn ghost pn-no" data-key="Escape">取消</button><button class="btn pn-ok" data-key="Enter">就叫这个</button></div></div></div>', { cls: 'p3m pn-m' });
    const inp = m.el.querySelector('.pn-in'), chips = m.el.querySelector('.pn-chips');
    const fill = () => { chips.innerHTML = sugg().map(n => '<button class="pn-chip" data-say="' + esc(n) + '">' + esc(n) + '</button>').join(''); };
    fill(); Avatar3D && Avatar3D.hydrate(m.el);
    chips.onclick = e => { const c = e.target.closest('.pn-chip'); if (!c) return; inp.value = c.textContent; Audio2.sfx('select', .4); inp.classList.remove('flash-in'); void inp.offsetWidth; inp.classList.add('flash-in'); };
    m.el.querySelector('.pn-dice').onclick = () => { inp.value = randName(); fill(); Audio2.sfx('pop', .4); };
    const ok = () => { const n = inp.value.trim(); if (!n) { inp.focus(); inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); return; } pet.name = n.slice(0, 8); save(); Audio2.sfx('star', .5); m.close(); done && done(); dialog(pet.name, '我最喜欢你了！'); };
    m.el.querySelector('.pn-ok').onclick = ok; m.el.querySelector('.pn-no').onclick = () => m.close();
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') m.close(); });
    setTimeout(() => { inp.focus(); inp.select(); }, 250);
  }
  let dlgT = 0;
  function dialog(who, text, voice) {
    const el = $('.s-home .p3-dialog'); if (!el) return;
    el.querySelector('.pd-name').textContent = who; const tx = el.querySelector('.pd-text'); tx.textContent = '';
    el.classList.add('show'); clearTimeout(dlgT);
    let i = 0; const t = String(text); const tick = () => { if (!el.isConnected) return; tx.textContent = t.slice(0, ++i); if (i < t.length) setTimeout(tick, 28); }; tick();
    if (voice !== false && Voice.has(t)) Voice.say(t);
    dlgT = setTimeout(() => el.classList.remove('show'), 2600 + t.length * 120);
  }

  /* ---------- 指令 ---------- */
  function act(a, el) {
    const p = P(), pet = p.pet;
    const refresh = () => { drawStatus(el); drawMenu(el); };
    if (a === 'pat') { H && H.petReact('pat'); pet.joy = Math.min(100, pet.joy + 6); pet.bond = Math.min(100, (pet.bond || 0) + 2); App.petXP && App.petXP(1); petDropMaybe(el); save(); refresh(); return; }
    if (a === 'feed') return feedMenu(el);
    if (a === 'ball') { if (pet.food < 10) { dialog(pet.name, '太饿了，跑不动…'); return; } H && H.throwBall(); pet.joy = Math.min(100, pet.joy + 12); pet.food = Math.max(0, pet.food - 5); pet.bond = Math.min(100, (pet.bond || 0) + 3); App.petXP && App.petXP(3); petDropMaybe(el); save(); refresh(); return; }
    if (a === 'trick') { H && H.petReact('trick'); pet.bond = Math.min(100, (pet.bond || 0) + 2); App.petXP && App.petXP(2); save(); refresh(); return; }
    if (a === 'photo') return H && H.photo();
    if (a === 'explore') return window.Explore && Explore.pick();
    if (a === 'gear') return gearPanel(el);
    if (a === 'dex') return dexPanel();
    if (a === 'egg') return hatchFlow(el);
    if (a === 'swap') return swapPanel(el);
    if (a === 'dress') return dressPanel(el);
    if (a === 'stats') return statsPanel();
    if (a === 'bond') return window.Bond && Bond.panel();
    if (a === 'sleep') return H && H.goAct('bed', 'sleep');
  }
  function petDropMaybe(el) {
    const p = P(); if (p.hm.pet >= 6) return; p.hm.pet++;
    const g = rollDrop('pet'); if (g) { dropToast(g, p.pet.name); H && H.petReact('gift'); drawMenu(el); }
  }
  function feedMenu(el) {
    const p = P(), pet = p.pet; p.inv.food = p.inv.food || {};
    const foods = Object.entries(p.inv.food).filter(x => x[1] > 0);
    if (!foods.length) { dialog('提示', '没有食物了，去商店或者出门逛逛吧'); return; }
    const m = UI.modal('<div class="p3-mh"><b>FEED</b><span>喂食</span></div><div class="feedgrid">' + foods.map(f => { const info = foodInfo(f[0]); return '<button class="food-b" data-f="' + f[0] + '" data-say="' + esc(info[1] || '食物') + '">' + E(f[0]) + '<b>×' + f[1] + '</b><small>' + (info[1] || '') + '</small></button>'; }).join('') + '</div>', { cls: 'p3m' });
    $$('.food-b', m.el).forEach(b => b.onclick = () => {
      const f = b.dataset.f, info = foodInfo(f);
      if (pet.food >= 100) { dialog(pet.name, '吃不下啦～'); return; }
      p.inv.food[f]--; pet.food = Math.min(100, pet.food + info[3]); pet.joy = Math.min(100, pet.joy + info[4]); pet.bond = Math.min(100, (pet.bond || 0) + 1); App.petXP && App.petXP(4); save(); App.taskProgress && App.taskProgress('feed');
      m.close(); H && H.feed(f); dialog(pet.name, '真好吃！'); drawStatus(el);
    });
  }
  const EXTRA_FOOD = [['🥐', '可颂面包', 8, 18, 6], ['🧃', '果汁', 6, 10, 12], ['🧁', '纸杯蛋糕', 12, 20, 15], ['🍦', '冰淇淋', 10, 12, 16], ['🍧', '刨冰', 9, 12, 14], ['🫐', '浆果', 0, 12, 8], ['🍄', '蘑菇', 0, 14, 4], ['🐟', '小鱼干', 0, 22, 10]];
  const foodInfo = f => (App.SHOP.food.concat(EXTRA_FOOD)).find(x => x[0] === f) || [f, '', 0, 15, 3];

  /* ---------- 装备面板 ---------- */
  function gearPanel(el) {
    const p = ensure();
    const draw = m => {
      const on = p.gearOn.map(id => p.gear.find(g => g.id === id)).filter(Boolean), off = p.gear.filter(g => !p.gearOn.includes(g.id)).sort((a, b) => b.t - a.t);
      const fx = gearFx(p), sum = GEAR.filter(G => fx[G.k]).map(G => E(G.e) + G.d(fx[G.k])).join(' · ');
      m.el.innerHTML = '<div class="p3-mh"><b>EQUIP</b><span>外设装备</span></div><p class="dim c">装备后在所有游戏和 Boss 战中生效。宠物稀有度越高，越容易带回高级装备。</p>' +
        '<div class="gslots">' + Array.from({ length: GEAR_SLOTS }, (_, i) => on[i] ? gearCard(on[i], 'on') : '<div class="gcard empty">空槽位</div>').join('') + '</div>' +
        '<div class="gsum">' + (sum || '<span class="dim">还没有装备生效</span>') + '</div>' +
        '<div class="p3-sub">背包 <small>' + off.length + '</small> <button class="btn sm ghost g-sell" ' + (off.length ? '' : 'disabled') + '>分解多余的普通装备</button></div><div class="gbag">' + (off.map(g => gearCard(g)).join('') || '<p class="dim c">背包是空的。和宠物互动、出门探索、玩游戏都有机会掉落装备！</p>') + '</div>' +
        '<details class="ptable"><summary>掉落概率公示</summary>' + probTable() + '</details>';
      hydrate(m.el);
      const x = h('button', 'mclose', '✕'); x.onclick = () => m.close(); m.el.appendChild(x);
      $$('.gcard[data-id]', m.el).forEach(c => c.onclick = () => {
        const id = c.dataset.id;
        if (p.gearOn.includes(id)) p.gearOn = p.gearOn.filter(x => x !== id);
        else { if (p.gearOn.length >= GEAR_SLOTS) { UI.toast('槽位满了，先点上面的装备卸下一个'); return; } p.gearOn.push(id); }
        save(); Audio2.sfx('switch', .4); draw(m); drawMenu(el);
      });
      const sell = m.el.querySelector('.g-sell'); if (sell) sell.onclick = () => { const junk = off.filter(g => g.t === 0); if (!junk.length) { UI.toast('没有可分解的普通装备'); return; } p.gear = p.gear.filter(g => !junk.includes(g)); save(); App.addCoins && App.addCoins(junk.length * 8, sell); UI.toast('分解了 ' + junk.length + ' 件，获得 ' + junk.length * 8 + ' 金币'); draw(m); };
    };
    const m = UI.modal('', { cls: 'wide p3m' }); draw(m);
  }
  function probTable() {
    return '<table><tr><th>宠物</th>' + TIERS.map(t => '<th style="color:' + t.c + '">' + t.id + '装备</th>').join('') + '<th>基础掉率</th></tr>' +
      TIERS.map((t, i) => '<tr><td style="color:' + t.c + '">' + t.id + ' ' + t.n + '</td>' + DROP_TIER[i].map(v => '<td>' + v + '%</td>').join('') + '<td>' + Math.round(DROP_CHANCE[i] * 100) + '%</td></tr>').join('') + '</table>' +
      '<p class="dim">宠物每升 1 星，掉率 +3%。互动每天最多判定 6 次；探索、通关、Boss 战另有判定。</p>';
  }

  /* ---------- 图鉴 ---------- */
  function dexPanel() {
    const p = ensure();
    const m = UI.modal('<div class="p3-mh"><b>PET DEX</b><span>宠物图鉴 ' + p.petsOwned.length + '/' + PETDEX.length + '</span></div>' +
      '<div class="hatchrate">' + TIERS.map(t => '<span style="--tc:' + t.c + '">' + tierBadge(TIERS.indexOf(t)) + ' ' + t.n + ' <b>' + Math.round(t.p * 100) + '%</b></span>').join('') + '<span class="dim">保底：' + PITY + ' 次内必出 SSR 以上（已 ' + p.pity + ' 次）</span></div>' +
      TIERS.map((t, i) => '<div class="dex-row"><div class="dex-h" style="--tc:' + t.c + '">' + tierBadge(i) + '<b>' + t.n + '</b></div><div class="dex-g">' + PETDEX.filter(x => x.t === i).map(K => {
        const own = p.petsOwned.includes(K.id);
        return '<div class="dex-c' + (own ? '' : ' miss') + '" style="--tc:' + t.c + '" data-k="' + K.id + '">' + (own ? petImg(K.id, { size: 160, style: 'p5' }) : '<div class="dex-q">?</div>') + '<b>' + (own ? K.n : '？？？') + '</b>' + (own ? stars(p.petStars[K.id] || 1) : '') + '</div>';
      }).join('') + '</div></div>').join(''), { cls: 'wide p3m' });
    Avatar3D && Avatar3D.hydrate(m.el);
  }

  /* ---------- 孵化演出 ---------- */
  function hatchFlow(el) {
    const p = ensure(); if (!p.eggs) return;
    const m = UI.modal('<div class="hatch-stage"><div class="h-rays"></div><div class="h-egg">' + E('🥚') + '</div><p class="h-tip">点蛋 3 下孵化</p><div class="h-pity">保底进度 ' + p.pity + '/' + PITY + '</div></div>', { cls: 'p3m hatch-m', noClose: false });
    const egg = m.el.querySelector('.h-egg'), st = m.el.querySelector('.hatch-stage'); let taps = 0, res = null;
    egg.onclick = async () => {
      if (res) return; taps++; Audio2.sfx('tick', .5); egg.classList.remove('crack' + (taps - 1)); egg.classList.add('crack' + taps);
      if (taps === 1) { res = null; }
      if (taps < 3) return;
      p.eggs--; res = hatchRoll(); const { K, t, dup } = res;
      if (!p.pet) p.pet = newPetObj(K.id); save(); App.checkBadges && App.checkBadges();
      st.style.setProperty('--tc', TIERS[t].c); st.classList.add('glow', 't' + t);
      Audio2.sfx('magic', .6); await sleep(t >= 3 ? 1600 : 900);
      Audio2.sfx('hatch', .7); UI.confetti(50 + t * 40);
      st.innerHTML = '<div class="h-rays on"></div><div class="h-res">' + petImg(K.id, { size: 320, style: 'p5', pose: 'wave' }) + '</div><div class="h-tier">' + tierBadge(t) + ' <b>' + TIERS[t].n + '</b></div><div class="mtitle">' + (dup ? K.n + ' 星级提升！' : '孵出了 ' + K.n + '！') + '</div>' + (dup ? stars(p.petStars[K.id]) : '') + '<p class="dim">技能：' + K.sk + ' · 基础掉落率 ' + Math.round(DROP_CHANCE[t] * 100) + '%</p><div class="r-btns"><button class="btn ghost h-keep" data-key="Escape">好的</button>' + (p.pet.kind !== K.id ? '<button class="btn h-use" data-key="Enter">让它出战</button>' : '') + (p.eggs ? '<button class="btn h-more" data-key="e">再孵一个（×' + p.eggs + '）</button>' : '') + '</div>';
      hydrate(st); Avatar3D && Avatar3D.hydrate(st);
      Voice.say(t === 4 ? '是神话级的宠物！' : t === 3 ? '是传说级的宠物！' : dup ? '星级提升了！' : '孵化成功！');
      const done = () => { m.close(); drawMenu(el); drawStatus(el); H && H.reloadPet(); };
      st.querySelector('.h-keep').onclick = done;
      const u = st.querySelector('.h-use'); if (u) u.onclick = () => { switchPet(K.id); done(); };
      const mo = st.querySelector('.h-more'); if (mo) mo.onclick = () => { done(); setTimeout(() => hatchFlow(el), 300); };
    };
  }
  function swapPanel(el) {
    const p = ensure();
    const m = UI.modal('<div class="p3-mh"><b>PARTNER</b><span>选择出战宠物</span></div><div class="dex-g swap">' + p.petsOwned.slice().sort((a, b) => dex(b).t - dex(a).t).map(k => '<button class="dex-c hopt" data-k="' + k + '" style="--tc:' + tierOf(k).c + '" data-say="' + dex(k).n + '">' + petImg(k, { size: 160, style: 'p5' }) + '<b>' + dex(k).n + '</b>' + tierBadge(dex(k).t) + stars(p.petStars[k] || 1) + '</button>').join('') + '</div>', { cls: 'wide p3m' });
    Avatar3D && Avatar3D.hydrate(m.el);
    $$('.hopt', m.el).forEach(b => b.onclick = () => { switchPet(b.dataset.k); m.close(); drawStatus(el); H && H.reloadPet(); });
  }
  function dressPanel(el) {
    const p = P(), own = p.owned;
    const slot = (type, list) => list.filter(x => own.includes(type + ':' + x[0])).map(x => '<button class="wd' + (p.equip[type] === x[0] ? ' on' : '') + '" data-t="' + type + '" data-v="' + x[0] + '" data-say="' + x[1] + '">' + E(x[0]) + '</button>').join('');
    const s = slot('hat', App.SHOP.hat) + slot('wand', App.SHOP.wand) + slot('cape', App.SHOP.cape);
    const m = UI.modal('<div class="p3-mh"><b>WARDROBE</b><span>换装</span></div><div class="wardrobe">' + (s || '<span class="dim">去商店买帽子和魔法杖吧</span>') + '</div>', { cls: 'p3m' });
    $$('.wd', m.el).forEach(b => b.onclick = () => { const t = b.dataset.t, v = b.dataset.v; p.equip[t] = p.equip[t] === v ? null : v; save(); Audio2.sfx('switch', .4); $$('.wd', m.el).forEach(x => x.classList.toggle('on', p.equip[x.dataset.t] === x.dataset.v)); H && H.reloadHero(); });
  }

  /* ================= 3D 小屋 ================= */
  function Room(box, root) {
    const T = THREE, A = Avatar3D;
    if (!A || !A.supported()) { box.innerHTML = '<div class="hm-flat">' + (P().pet ? petImg(P().pet.kind, { size: 256 }) : '') + '</div>'; hydrate(box); return null; }
    const rd = Perf.renderer({ antialias: true }, { dpr: 2, shadows: true }); rd.outputColorSpace = T.SRGBColorSpace;
    box.appendChild(rd.domElement);
    const sc = new T.Scene(); const dark = root.classList.contains('darkhour');
    const morning = () => P().hm.morning;
    sc.background = new T.Color(dark ? 0x04100a : 0x120c10); sc.fog = new T.Fog(sc.background, 20, 36);
    const cam = new T.PerspectiveCamera(36, 1, .1, 80); let yaw = .72, tYaw = .72, pitch = .5, dist = 13.5, tDist = 13.5;
    const look = new T.Vector3(0, 1.1, 0), tLook = look.clone();
    const placeCam = () => { cam.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(look); };
    // 光：暖色室内灯 + 窗外冷月光；所有家具 / 宠物 / 角色都是同一套 MToon 两阶着色，阴影偏冷紫
    const hemi = new T.HemisphereLight(dark ? 0xc8ffd8 : 0xfff0e2, dark ? 0x204838 : 0x5a4a6e, dark ? .95 : 1.1); sc.add(hemi);
    const moon = new T.DirectionalLight(dark ? 0xa8ffc0 : 0xb8c8ff, dark ? 1.3 : 1.05); moon.position.set(-1.2, 6.5, -7.5); moon.target.position.set(.4, 0, 1.2); sc.add(moon.target);
    moon.castShadow = true; moon.shadow.mapSize.setScalar(Perf.shadowSize(2048)); Object.assign(moon.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 22 }); moon.shadow.bias = -.0015; moon.shadow.normalBias = .02; sc.add(moon);
    const key = new T.DirectionalLight(0xffe6cc, 1.35); key.position.set(5, 8, 6); sc.add(key);
    const lampL = new T.PointLight(0xffb870, 5, 5, 1.6); lampL.position.set(3.25, 1.3, -3.95); sc.add(lampL);
    const bulb = new T.PointLight(0xffd29a, 5.5, 10, 1.3); bulb.position.set(0, 3.0, 0); sc.add(bulb);
    const fairy = new T.PointLight(0xffb8d8, 2.6, 4.5, 1.5); fairy.position.set(-3.3, 2.7, -3.4); sc.add(fairy);
    const setMood = m => { // night / sleep / morning
      const k = m === 'sleep' ? .28 : 1; hemi.intensity = (m === 'morning' ? 1.55 : 1.1) * k; key.intensity = (m === 'morning' ? 1.9 : 1.35) * k;
      lampL.intensity = m === 'sleep' ? 0 : 5; bulb.intensity = m === 'sleep' ? 0 : m === 'morning' ? 2.5 : 5.5; fairy.intensity = m === 'sleep' ? 1.6 : 2.6;
      moon.color.set(m === 'morning' ? 0xfff0d0 : 0xb8c8ff); moon.intensity = m === 'sleep' ? 1.5 : m === 'morning' ? 2.6 : 1.05;
      sc.background.set(m === 'morning' ? 0x3a2a26 : m === 'sleep' ? 0x05060e : 0x120c10); sc.fog.color.copy(sc.background);
      win.material.map = m === 'morning' ? winTexDay : winTex; win.material.needsUpdate = true;
      shaft.material.color.set(m === 'morning' ? 0xfff0c8 : 0xb8ccff); shaft.material.opacity = m === 'morning' ? .5 : .32;
      glows.forEach(g => { g.material.opacity = (m === 'sleep' ? .25 : 1) * g.userData.o0; });
    };

    /* ---- 动漫风手绘贴图（干净线条 + 柔和渐变） ---- */
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const cvTex = (w, hh, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; draw(c.getContext('2d'), w, hh); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t; };
    // 木地板：一块块长条木板，每块有中间亮两边暗的渐变、细木纹、深色缝和一道浅色反光
    const floorTex = cvTex(1024, 1024, (c, w, hh) => {
      const PW = 64; const cols = dark ? ['#4a6a54', '#456250', '#507258', '#41604c'] : ['#c08250', '#b47646', '#c98c58', '#ad7042', '#bb7c4c'];
      for (let y = 0; y < hh; y += PW) for (let x = -((y / PW) % 3) * 140; x < w; x += 300 + ((y / PW) % 2) * 60) {
        const L = 300 + ((y / PW) % 2) * 60, base = cols[(Math.abs(x) / 20 + y / PW * 3 | 0) % cols.length];
        const g = c.createLinearGradient(0, y, 0, y + PW); g.addColorStop(0, base); g.addColorStop(.45, 'rgba(255,236,210,.10)'); g.addColorStop(1, base);
        c.fillStyle = base; c.fillRect(x, y, L, PW); c.fillStyle = g; c.fillRect(x, y, L, PW);
        c.strokeStyle = 'rgba(90,48,24,.16)'; c.lineWidth = 1.2; for (let k = 0; k < 4; k++) { const yy = y + 10 + k * 13 + rnd() * 4; c.beginPath(); c.moveTo(x + 6, yy); c.bezierCurveTo(x + L * .3, yy + (rnd() - .5) * 6, x + L * .7, yy + (rnd() - .5) * 6, x + L - 6, yy + (rnd() - .5) * 3); c.stroke(); }
        if (rnd() < .35) { c.fillStyle = 'rgba(90,48,24,.18)'; c.beginPath(); c.ellipse(x + 40 + rnd() * (L - 80), y + 20 + rnd() * 24, 9, 4, 0, 0, 7); c.fill(); }
        c.fillStyle = 'rgba(60,28,14,.55)'; c.fillRect(x, y, 2, PW); c.fillRect(x, y, L, 2);
        c.fillStyle = 'rgba(255,240,220,.22)'; c.fillRect(x, y + 2, L, 1.5);
      }
    });
    // 墙：上面是米色灰泥（柔和斑驳 + 上暗下亮），下面是木质护墙板 + 白色腰线
    const wallTex = cvTex(1024, 512, (c, w, hh) => {
      const g = c.createLinearGradient(0, 0, 0, hh * .66); g.addColorStop(0, dark ? '#2c4a3a' : '#cdb8a4'); g.addColorStop(1, dark ? '#4a6e58' : '#efe1cf');
      c.fillStyle = g; c.fillRect(0, 0, w, hh * .66);
      for (let i = 0; i < 260; i++) { c.fillStyle = 'rgba(' + (dark ? '20,40,30' : '150,110,80') + ',' + (.025 + rnd() * .03) + ')'; c.beginPath(); c.ellipse(rnd() * w, rnd() * hh * .66, 10 + rnd() * 40, 6 + rnd() * 20, rnd() * 3, 0, 7); c.fill(); }
      const by = hh * .66; c.fillStyle = dark ? '#2e4a3a' : '#8c5c3e'; c.fillRect(0, by, w, hh - by);
      for (let x = 8; x < w; x += 128) { const pg = c.createLinearGradient(0, by + 18, 0, hh - 14); pg.addColorStop(0, dark ? '#3a5a48' : '#9c6a48'); pg.addColorStop(1, dark ? '#2a4434' : '#7e5236'); c.fillStyle = pg; c.fillRect(x + 6, by + 22, 112, hh - by - 40); c.strokeStyle = 'rgba(40,20,10,.45)'; c.lineWidth = 2; c.strokeRect(x + 6, by + 22, 112, hh - by - 40); c.strokeStyle = 'rgba(255,230,200,.18)'; c.strokeRect(x + 8, by + 24, 108, hh - by - 44); }
      c.fillStyle = dark ? '#d8f0e0' : '#f4ebe0'; c.fillRect(0, by - 6, w, 14); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, by + 8, w, 3);
    });
    wallTex.wrapS = T.RepeatWrapping; floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping;
    const mkWin = (id) => { const w = 512, hh = 512, c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d'); x.drawImage(Sketch.paintLayer(id, 'sky', w, hh), 0, 0); x.drawImage(Sketch.paintLayer(id, 'far', w * 2, hh), -w * .4, hh * .18, w * 1.6, hh * .82); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
    const winTex = mkWin(dark ? 'tower' : 'city'), winTexDay = mkWin('beach');
    // 怪盗海报（保留一点 P5 的红黑）
    const posterTex = cvTex(256, 360, (c, w, hh) => { c.fillStyle = '#d0102a'; c.fillRect(0, 0, w, hh); c.fillStyle = '#16080c'; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(w / 2, hh * .42); const a = i / 12 * Math.PI * 2; c.lineTo(w / 2 + Math.cos(a) * 400, hh * .42 + Math.sin(a) * 400); c.lineTo(w / 2 + Math.cos(a + .2) * 400, hh * .42 + Math.sin(a + .2) * 400); c.fill(); } c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, hh * .42, 56, 0, 7); c.fill(); c.fillStyle = '#d0102a'; c.font = "bold 76px 'Fredoka',sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', w / 2, hh * .43); c.fillStyle = '#fff'; c.font = "44px 'ZK',sans-serif"; c.save(); c.translate(w / 2, hh * .82); c.rotate(-.08); c.fillText('星星岛', 0, 0); c.restore(); c.strokeStyle = '#fff'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, hh - 8); });
    const calTex = cvTex(200, 240, (c, w, hh) => { c.fillStyle = '#fffaf2'; c.fillRect(0, 0, w, hh); c.fillStyle = '#e0485a'; c.fillRect(0, 0, w, 62); const d = new Date(); c.fillStyle = '#fff'; c.font = "34px 'ZK',sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((d.getMonth() + 1) + '月', w / 2, 33); c.fillStyle = '#3a2a30'; c.font = "bold 110px 'Fredoka',sans-serif"; c.fillText(String(d.getDate()), w / 2, 152); c.fillStyle = '#c8b8b0'; for (let i = 0; i < 6; i++) c.fillRect(20 + i * 28, 214, 18, 6); });
    const mirTex = cvTex(160, 320, (c, w, hh) => { const g = c.createLinearGradient(0, 0, w, hh); g.addColorStop(0, '#b8d4f4'); g.addColorStop(.5, '#eef6ff'); g.addColorStop(1, '#8ea8d0'); c.fillStyle = g; c.fillRect(0, 0, w, hh); c.globalAlpha = .65; c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineWidth = 10; c.beginPath(); c.moveTo(24, 80); c.lineTo(90, 26); c.stroke(); c.lineWidth = 5; c.beginPath(); c.moveTo(34, 124); c.lineTo(124, 50); c.stroke(); });
    const quiltTex = cvTex(256, 256, (c, w, hh) => { c.fillStyle = '#c23848'; c.fillRect(0, 0, w, hh); c.fillStyle = 'rgba(70,10,24,.42)'; for (let i = 0; i < w; i += 64) { c.fillRect(i, 0, 22, hh); c.fillRect(0, i, w, 22); } c.fillStyle = 'rgba(255,236,226,.34)'; for (let i = 30; i < w; i += 64) { c.fillRect(i, 0, 4, hh); c.fillRect(0, i, w, 4); } c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, 0, w, hh / 2); });
    const rugTex = cvTex(512, 512, (c, w) => { const r = w / 2; [['#3a3458', 1], ['#efe2d0', .94], ['#d8828e', .86], ['#efe2d0', .8], ['#4a4470', .55], ['#efe2d0', .5], ['#e8a0a8', .3]].forEach(([col, k]) => { c.fillStyle = col; c.beginPath(); c.arc(r, r, r * k, 0, 7); c.fill(); }); c.fillStyle = '#efe2d0'; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; c.beginPath(); c.arc(r + Math.cos(a) * r * .68, r + Math.sin(a) * r * .68, 9, 0, 7); c.fill(); } for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.save(); c.translate(r + Math.cos(a) * r * .4, r + Math.sin(a) * r * .4); c.rotate(a); c.fillStyle = '#d8828e'; c.beginPath(); c.ellipse(0, 0, 22, 9, 0, 0, 7); c.fill(); c.restore(); } });
    const glowTex = cvTex(128, 128, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
    const shaftTex = cvTex(64, 256, (c, w, hh) => { const g = c.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, hh); const g2 = c.createLinearGradient(0, 0, w, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(.2, 'rgba(0,0,0,0)'); g2.addColorStop(.8, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = g2; c.fillRect(0, 0, w, hh); });

    /* ---- 家具：圆角几何 + MToon，每件家具带 TAG 用于「调查」，OBST 是走路要绕开的占地 ---- */
    const room = new T.Group(); sc.add(room); let TAG = '';
    const tagged = {}; const reg = m => { m.name = TAG; if (TAG) (tagged[TAG] = tagged[TAG] || []).push(m); return m; };
    const OBST = []; // [x0, z0, x1, z1, 高度]
    const foot = (x0, z0, x1, z1, hgt) => OBST.push([x0, z0, x1, z1, hgt || 1]);
    const M = (col, o) => new T.MeshToonMaterial(Object.assign({ color: col }, o || {}));
    // 圆角盒子：把细分盒子的顶点推到「内盒 + 半径 r」的表面上，法线就是推出去的方向
    const RG = {};
    function rgeo(w, hh, d, r) {
      const k = [w, hh, d, r].join(); if (RG[k]) return RG[k];
      const s = 3, n = 2 * s + 1, g = new T.BoxGeometry(1, 1, 1, n, n, n), P0 = g.attributes.position, N0 = g.attributes.normal, half = [w / 2, hh / 2, d / 2];
      r = Math.max(.002, Math.min(r, half[0] - .001, half[1] - .001, half[2] - .001));
      const map = (v, hf) => { const i = Math.round((v + .5) * n); return i <= s ? -hf + r * i / s : i >= n - s ? hf - r + r * (i - (n - s)) / s : 0; };
      const v = new T.Vector3(), inner = new T.Vector3();
      for (let i = 0; i < P0.count; i++) {
        v.set(map(P0.getX(i), half[0]), map(P0.getY(i), half[1]), map(P0.getZ(i), half[2]));
        inner.set(Math.max(-half[0] + r, Math.min(half[0] - r, v.x)), Math.max(-half[1] + r, Math.min(half[1] - r, v.y)), Math.max(-half[2] + r, Math.min(half[2] - r, v.z)));
        const dv = v.clone().sub(inner); if (dv.lengthSq() < 1e-12) dv.set(N0.getX(i), N0.getY(i), N0.getZ(i)); dv.normalize();
        P0.setXYZ(i, inner.x + dv.x * r, inner.y + dv.y * r, inner.z + dv.z * r); N0.setXYZ(i, dv.x, dv.y, dv.z);
      }
      return (RG[k] = g);
    }
    const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; room.add(m); return reg(m); };
    // y 是底面高度
    const rbox = (w, hh, d, col, x, y, z, o) => add(new T.Mesh(rgeo(w, hh, d, (o && o.r) != null ? o.r : Math.min(w, hh, d) * .18), M(col, o && o.mat)), x, y + hh / 2, z);
    const cyl = (r1, r2, hh, col, x, y, z, seg, o) => add(new T.Mesh(new T.CylinderGeometry(r1, r2, hh, seg || 28), M(col, o)), x, y + hh / 2, z);
    const plane = (w, hh, map, x, y, z, ry) => { const m = add(new T.Mesh(new T.PlaneGeometry(w, hh), M(0xffffff, { map })), x, y, z); m.rotation.y = ry || 0; m.userData.noOl = true; m.castShadow = false; return m; };
    const glows = [];
    const halo = (col, x, y, z, s, op) => { const g = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: op || .6, blending: T.AdditiveBlending, depthWrite: false })); g.position.set(x, y, z); g.scale.set(s, s, 1); g.userData.o0 = op || .6; sc.add(g); glows.push(g); return g; };

    // 地板 / 墙 / 踢脚线 / 房梁
    const floor = new T.Mesh(new T.PlaneGeometry(9, 9), M(0xffffff, { map: floorTex })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor'; floor.userData.noOl = true; room.add(floor); floorTex.repeat.set(2, 2);
    const wallB = new T.Mesh(new T.PlaneGeometry(9, 4.2), M(0xffffff, { map: wallTex })); wallB.position.set(0, 2.1, -4.5); wallB.receiveShadow = true; wallB.userData.noOl = true; room.add(wallB);
    const wallL = new T.Mesh(new T.PlaneGeometry(9, 4.2), M(0xffffff, { map: wallTex })); wallL.rotation.y = Math.PI / 2; wallL.position.set(-4.5, 2.1, 0); wallL.receiveShadow = true; wallL.userData.noOl = true; room.add(wallL);
    const trim = dark ? 0xd8f0e0 : 0xf4ebe0, wood = dark ? 0x3e5e4a : 0x6e4630, woodL = dark ? 0x5a7a62 : 0xb47a4e;
    rbox(9, .16, .07, trim, 0, 0, -4.46, { r: .02 }).userData.noOl = true; rbox(.07, .16, 9, trim, -4.46, 0, 0, { r: .02 }).userData.noOl = true;
    [-3, -1, 1, 3].forEach(x => { const b = rbox(.2, .2, 1.4, wood, x, 3.85, -3.8, { r: .03 }); b.castShadow = false; }); [-3, -1, 1, 3].forEach(z => { const b = rbox(1.4, .2, .2, wood, -3.8, 3.85, z, { r: .03 }); b.castShadow = false; });
    rbox(9, .26, .26, wood, 0, 3.5, -4.3, { r: .04 }).castShadow = false; rbox(.26, .26, 9, wood, -4.3, 3.5, 0, { r: .04 }).castShadow = false;
    // 吊灯：电线 + 布灯罩 + 发光灯泡
    cyl(.012, .012, .7, 0x2a2024, 0, 3.15, 0, 6).userData.noOl = true;
    const shadeM = cyl(.34, .16, .3, 0xf2dcc0, 0, 2.86, 0, 32, { side: T.DoubleSide, emissive: 0xffb060, emissiveIntensity: .35 }); shadeM.geometry = new T.CylinderGeometry(.16, .34, .3, 32, 1, true); shadeM.castShadow = false;
    const bulbM = add(new T.Mesh(new T.SphereGeometry(.08, 16, 12), new T.MeshBasicMaterial({ color: 0xfff2cc })), 0, 2.86, 0); bulbM.userData.keep = true; bulbM.castShadow = false;
    halo(0xffd090, 0, 2.86, 0, 1.6, .55);

    // 窗 + 夜景 + 窗帘 + 月光光柱
    TAG = 'window';
    const win = new T.Mesh(new T.PlaneGeometry(2.6, 1.9), new T.MeshBasicMaterial({ map: winTex })); win.position.set(-.6, 2.35, -4.47); win.userData.keep = true; win.userData.noOl = true; room.add(win); reg(win);
    const glass = new T.Mesh(new T.PlaneGeometry(2.6, 1.9), new T.MeshBasicMaterial({ map: cvTex(256, 190, (c, w, hh) => { c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 16; c.beginPath(); c.moveTo(40, hh); c.lineTo(110, 0); c.stroke(); c.lineWidth = 7; c.beginPath(); c.moveTo(90, hh); c.lineTo(150, 0); c.stroke(); }), transparent: true, blending: T.AdditiveBlending, depthWrite: false })); glass.position.set(-.6, 2.35, -4.455); glass.userData.keep = true; glass.userData.noOl = true; room.add(glass);
    rbox(2.84, .12, .16, trim, -.6, 1.3, -4.42, { r: .03 }); rbox(2.84, .12, .16, trim, -.6, 3.28, -4.42, { r: .03 }); rbox(.12, 2.1, .16, trim, -1.96, 1.3, -4.42, { r: .03 }); rbox(.12, 2.1, .16, trim, .76, 1.3, -4.42, { r: .03 }); rbox(.07, 1.9, .1, trim, -.6, 1.4, -4.4, { r: .02 });
    rbox(3.0, .08, .36, trim, -.6, 1.3, -4.27, { r: .03 });
    const curtainGeo = (() => { const g = new T.PlaneGeometry(.62, 2.5, 18, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin((x + .31) / .62 * Math.PI * 4) * .045); } g.computeVertexNormals(); return g; })();
    const curtain = x => { const c = new T.Mesh(curtainGeo, M(0xc4404c, { side: T.DoubleSide })); add(c, x, 2.2, -4.33); };
    curtain(-2.2); curtain(1.0);
    cyl(.025, .025, 3.6, 0xd8b070, -.6, 3.42, -4.3, 10).rotation.z = Math.PI / 2;
    TAG = '';
    const moonGlow = new T.PointLight(dark ? 0x9fffb0 : 0xa8c0ff, 2.4, 6, 2); moonGlow.position.set(-.6, 2.4, -3.8); sc.add(moonGlow);
    const shaft = new T.Mesh(new T.PlaneGeometry(2.4, 4.4), new T.MeshBasicMaterial({ map: shaftTex, color: 0xb8ccff, transparent: true, opacity: .32, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    shaft.position.set(-.45, 1.25, -3.05); shaft.rotation.set(-.62, 0, 0); shaft.userData.keep = true; shaft.userData.noOl = true; room.add(shaft);
    // 光柱里飘的小灰尘
    const dustG = new T.BufferGeometry(), DN = 70, dp = new Float32Array(DN * 3); for (let i = 0; i < DN; i++) { dp[i * 3] = -1.6 + rnd() * 2.4; dp[i * 3 + 1] = .3 + rnd() * 2.6; dp[i * 3 + 2] = -4 + rnd() * 2.6; } dustG.setAttribute('position', new T.BufferAttribute(dp, 3));
    const dust = new T.Points(dustG, new T.PointsMaterial({ map: glowTex, color: 0xdfe8ff, size: .06, transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false })); sc.add(dust);

    // 床：木床架 + 床垫 + 格子被 + 翻折的被头 + 大枕头 + 小熊；床头上方一串小彩灯
    TAG = 'bed';
    // 单人床（2.2m × 1.46m）：x 中心 BED.x，床头在 z = -4.24；床垫顶面 .68，平铺的被子顶面 BED.top
    const BED = { x: -3.62, w: 1.46, z0: -4.18, z1: -1.96, top: .8, pillowZ: -3.82 };
    const bz = (BED.z0 + BED.z1) / 2, bl = BED.z1 - BED.z0;
    rbox(BED.w + .1, .32, bl + .12, woodL, BED.x, .08, bz, { r: .05 }); [[-1, BED.z0 + .02], [1, BED.z0 + .02], [-1, BED.z1 - .02], [1, BED.z1 - .02]].forEach(([sx, z]) => rbox(.1, .1, .1, wood, BED.x + sx * (BED.w / 2), 0, z, { r: .02 }));
    rbox(BED.w + .1, 1.16, .14, woodL, BED.x, 0, -4.27, { r: .06 }); rbox(BED.w + .1, .12, .2, wood, BED.x, 1.12, -4.27, { r: .05 });
    rbox(BED.w - .04, .28, bl - .04, 0xf6f0e8, BED.x, .4, bz, { r: .1 });
    rbox(BED.w + .02, .14, 1.5, 0xffffff, BED.x, .66, BED.z1 - .74, { r: .07, mat: { map: quiltTex } });
    rbox(BED.w, .1, .28, 0xfaf4ec, BED.x, .72, BED.z1 - 1.46, { r: .05 });
    const pillow = rbox(.9, .19, .5, 0xffffff, BED.x, .66, BED.pillowZ, { r: .1 }); pillow.rotation.x = -.1;
    [[0, .18, .13, 0xc89a6a], [0, .34, .095, 0xc89a6a], [-.075, .42, .042, 0xc89a6a], [.075, .42, .042, 0xc89a6a], [0, .19, .065, 0xf0dcc0]].forEach(([dx, dy, r, col], i) => { const s2 = add(new T.Mesh(new T.SphereGeometry(r, 16, 12), M(col)), BED.x + .52 + dx, .78 + dy, BED.pillowZ + .02 + (i === 4 ? .11 : 0)); if (i === 0) s2.scale.y = .9; });
    // 睡觉时盖上的蓬松被子（平时藏起来）
    const comforter = rbox(BED.w + .06, .3, 1, 0xffffff, BED.x, .74, bz, { r: .12, mat: { map: quiltTex } }); comforter.visible = false; comforter.name = ''; comforter.raycast = () => {};
    foot(BED.x - BED.w / 2 - .1, -4.5, BED.x + BED.w / 2 + .1, BED.z1 + .06, .9);
    TAG = '';
    const fairyBulbs = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, x = -4.38 + t * 2.3, y = 3.05 - Math.sin(t * Math.PI) * .32; const b = new T.Mesh(new T.SphereGeometry(.035, 8, 6), new T.MeshBasicMaterial({ color: [0xffd27a, 0xff9ac0, 0xa8e0ff, 0xfff0b0][i % 4] })); b.position.set(x, y, -4.42); b.userData.keep = true; room.add(b); fairyBulbs.push(b); halo(b.material.color.getHex(), x, y, -4.38, .32, .7); }
    // 书桌 + 抽屉柜 + 显示器 + 键盘 + 台灯 + 书；椅子
    TAG = 'desk';
    rbox(2.1, .06, .92, woodL, 2.6, .72, -3.9, { r: .02 }); rbox(.52, .72, .86, wood, 3.36, 0, -3.9, { r: .03 }); [.12, .36].forEach(y => rbox(.44, .2, .02, woodL, 3.36, y + .06, -3.46, { r: .01 })); [[1.62, -4.28], [1.62, -3.52]].forEach(([x, z]) => rbox(.06, .72, .06, wood, x, 0, z, { r: .015 }));
    for (let i = 0; i < 3; i++) rbox(.34, .06, .46, [0xe0485a, 0xf4ebe0, 0x5a6aa8][i], 1.92, .78 + i * .06, -4.05 + i * .02, { r: .015 });
    cyl(.1, .13, .04, 0x3a3038, 3.25, .78, -4.08, 20); const arm = cyl(.016, .016, .46, 0x3a3038, 3.25, .8, -4.08, 8); arm.userData.noOl = true;
    const shade = cyl(.07, .17, .18, 0xe0485a, 3.25, 1.18, -4.0, 24, { emissive: 0xff7050, emissiveIntensity: .45 }); halo(0xffb060, 3.25, 1.12, -3.95, .9, .55);
    rbox(.12, .2, .04, 0xffffff, 3.0, .78, -3.62, { r: .02 });
    TAG = 'pc'; rbox(.84, .5, .05, 0x2a2630, 2.45, .9, -4.15, { r: .02 }); rbox(.06, .14, .06, 0x2a2630, 2.45, .78, -4.18, { r: .01 }); rbox(.3, .02, .18, 0x2a2630, 2.45, .78, -4.18, { r: .01 });
    const pcs = rbox(.76, .42, .01, 0x1a1830, 2.45, .94, -4.122, { r: .004, mat: { emissive: 0x4a68c8, emissiveIntensity: .55 } }); pcs.userData.noOl = true; const pcGlow = halo(0x6a88ff, 2.45, 1.15, -4.0, 1.1, .35);
    rbox(.52, .025, .17, 0xf4ebe0, 2.45, .78, -3.58, { r: .008 }); rbox(.08, .025, .12, 0xf4ebe0, 2.82, .78, -3.56, { r: .01 });
    foot(1.52, -4.5, 3.7, -3.4, .8);
    TAG = 'desk';
    // 椅子：坐垫顶面 0.45m，靠背在 +Z（人坐下面朝书桌 -Z）
    const CHAIR = { x: 2.45, z: -3.1, top: .45 };
    rbox(.5, .07, .48, 0xc8484e, CHAIR.x, .38, CHAIR.z, { r: .03 }); rbox(.48, .5, .06, woodL, CHAIR.x, .45, CHAIR.z + .24, { r: .03 }); [[-.21, -.2], [.21, -.2], [-.21, .2], [.21, .2]].forEach(([a, b]) => rbox(.045, .38, .045, wood, CHAIR.x + a, 0, CHAIR.z + b, { r: .01 }));
    foot(CHAIR.x - .27, CHAIR.z - .26, CHAIR.x + .27, CHAIR.z + .3, .95);
    // 书架（左墙前侧）：柜体 + 三层板 + 一排排彩色的书（有的歪着）+ 小盆栽
    TAG = 'shelf';
    rbox(.06, 2.3, 1.62, woodL, -4.42, 0, 1.6, { r: .02 }); rbox(.5, 2.3, .06, woodL, -4.17, 0, .82, { r: .02 }); rbox(.5, 2.3, .06, woodL, -4.17, 0, 2.38, { r: .02 }); rbox(.52, .06, 1.62, woodL, -4.17, 2.26, 1.6, { r: .02 });
    const BK = [0xe0485a, 0x5a6aa8, 0xf4c860, 0x6ab08a, 0xf4ebe0, 0xb87ac8, 0x4a3a50, 0xe88a60];
    [.04, .6, 1.16, 1.72].forEach((y, row) => { rbox(.48, .05, 1.52, wood, -4.17, y, 1.6, { r: .015 }); if (row === 3) return; let z = .92; for (let i = 0; z < 2.2; i++) { const t = .06 + rnd() * .05, hh = .34 + rnd() * .14, b = rbox(.32, hh, t, BK[(i + row * 3) % BK.length], -4.2, y + .05, z + t / 2, { r: .01 }); if (rnd() < .12) { b.rotation.x = .25; b.position.z += .04; } z += t + .012; } });
    cyl(.07, .06, .12, 0xc8744a, -4.17, 1.77, 2.15, 14); add(new T.Mesh(new T.SphereGeometry(.12, 12, 10), M(0x5cb874)), -4.17, 1.98, 2.15);
    foot(-4.5, .78, -3.88, 2.42, 2.3);
    // 门（左墙最前）
    TAG = 'door';
    rbox(.1, 2.62, 1.26, trim, -4.45, 0, 3.4, { r: .03 }); rbox(.08, 2.46, 1.04, 0x9a6444, -4.4, .04, 3.4, { r: .03 }); [[.62, 3.4], [1.72, 3.4]].forEach(([y, z]) => rbox(.04, .8, .78, 0xa87250, -4.35, y - .4, z, { r: .03 }));
    const knob = add(new T.Mesh(new T.SphereGeometry(.055, 14, 10), M(0xf0c860, { emissive: 0x402800, emissiveIntensity: .3 })), -4.32, 1.1, 3.02);
    // 地毯 / 宠物窝 / 食盆 / 电视
    TAG = ''; const rug = add(new T.Mesh(new T.CircleGeometry(1.7, 64), M(0xffffff, { map: rugTex })), .4, .012, .6); rug.rotation.x = -Math.PI / 2; rug.userData.noOl = true; rug.castShadow = false;
    // 宠物窝：圆形软垫（外圈是一圈鼓起的软边），坐进去的高度 PETBED.top
    const PETBED = { x: 2.35, z: 2.85, top: .1 };
    TAG = 'petbed'; const rim = add(new T.Mesh(new T.TorusGeometry(.44, .13, 14, 36), M(0xf0a0b4)), PETBED.x, .13, PETBED.z); rim.rotation.x = Math.PI / 2; cyl(.46, .46, .09, 0xfff0e8, PETBED.x, .01, PETBED.z, 32);
    foot(PETBED.x - .58, PETBED.z - .58, PETBED.x + .58, PETBED.z + .58, .3);
    TAG = 'bowl'; const BOWL = { x: 3.55, z: 2.95 };
    const bowlM = add(new T.Mesh(new T.LatheGeometry([[.1, 0], [.18, .02], [.22, .1], [.21, .12], [.16, .1], [.14, .05]].map(p => new T.Vector2(p[0], p[1])), 28), M(0xfaf6ff, { side: T.DoubleSide })), BOWL.x, 0, BOWL.z);
    add(new T.Mesh(new T.CylinderGeometry(.15, .15, .02, 24), M(0xa86a3a)), BOWL.x, .08, BOWL.z).userData.noOl = true; void bowlM;
    foot(BOWL.x - .28, BOWL.z - .28, BOWL.x + .28, BOWL.z + .28, .2);
    TAG = 'tv'; rbox(2.24, .48, .56, 0xf4ebe0, .2, .04, -4.15, { r: .04 }); [-.62, .2, 1.02].forEach(x => rbox(.66, .3, .02, 0xe8dccc, .2 + (x - .2), .12, -3.865, { r: .02 })); [[-.85, -4.38], [1.25, -4.38], [-.85, -3.92], [1.25, -3.92]].forEach(([x, z]) => rbox(.05, .05, .05, wood, x, 0, z, { r: .01 }));
    rbox(1.36, .8, .06, 0x24202a, .2, .66, -4.2, { r: .02 }); rbox(.3, .06, .2, 0x24202a, .2, .52, -4.2, { r: .02 }); rbox(.06, .16, .04, 0x24202a, .2, .55, -4.22, { r: .01 });
    const tvs = rbox(1.26, .7, .01, 0x16141e, .2, .71, -4.168, { r: .004, mat: { emissive: 0x302848, emissiveIntensity: .7 } }); tvs.userData.noOl = true; const tvGlow = halo(0x8a7aff, .2, 1.05, -3.95, 1.6, .18);
    foot(-.95, -4.5, 1.35, -3.82, .55);
    // 沙发（右侧，面朝 -X）：底座 + 两块坐垫 + 靠背 + 扶手 + 抱枕；坐垫顶面 SOFA.top
    TAG = 'sofa'; const SOFA = { x: 3.62, z0: -.5, z1: 1.3, top: .46 };
    rbox(.98, .24, 2.06, 0xa83440, 3.76, .08, .4, { r: .06 }); [[-.54], [.5]].forEach(([dz]) => rbox(.78, .15, .98, 0xc84450, 3.66, .31, .4 + dz, { r: .07 }));
    rbox(.3, .62, 2.06, 0xa83440, 4.12, .3, .4, { r: .1 }); [-.66, 1.46].forEach(z => rbox(.98, .32, .24, 0xb03a46, 3.76, .3, z, { r: .1 }));
    [[.0, 0xf4ebe0], [.85, 0xf4c860]].forEach(([z, col]) => { const pl = rbox(.14, .36, .36, col, 3.9, .44, z, { r: .07 }); pl.rotation.z = .25; pl.rotation.y = .2; });
    [[3.34, -.6], [4.18, -.6], [3.34, 1.4], [4.18, 1.4]].forEach(([x, z]) => rbox(.06, .08, .06, wood, x, 0, z, { r: .01 }));
    foot(3.24, -.82, 4.5, 1.62, .95);
    // 手工台（左前）
    TAG = 'craft';
    rbox(1.24, .06, .72, woodL, -2.5, .74, 3.3, { r: .02 }); [[-.55, -.29], [.55, -.29], [-.55, .29], [.55, .29]].forEach(([a, b]) => rbox(.05, .74, .05, wood, -2.5 + a, 0, 3.3 + b, { r: .01 }));
    rbox(.3, .18, .22, 0xe0485a, -2.82, .8, 3.26, { r: .03 }); cyl(.06, .06, .22, 0xf4ebe0, -2.3, .8, 3.42, 16); rbox(.28, .02, .38, 0xf4c860, -2.12, .8, 3.14, { r: .005 }); rbox(.2, .02, .26, 0x8ac8f0, -2.5, .8, 3.12, { r: .005 });
    foot(-3.17, 2.9, -1.83, 3.7, .8);
    // 盆栽（右后）：陶盆 + 一团团叶子
    TAG = 'plant';
    cyl(.26, .2, .44, 0xc8744a, 3.8, 0, -1.6, 24); cyl(.28, .27, .06, 0xb8643a, 3.8, .42, -1.6, 24);
    const leaf = new T.Group(); leaf.position.set(3.8, .5, -1.6); room.add(leaf);
    [[0, .42, 0, .3], [.18, .3, .1, .22], [-.17, .32, -.05, .22], [.05, .62, -.12, .2], [-.08, .55, .15, .19], [.16, .52, -.14, .17]].forEach(([x, y, z, r], i) => { const l = new T.Mesh(new T.IcosahedronGeometry(r, 2), M([0x5cb874, 0x4aa864, 0x6cc884][i % 3])); l.position.set(x, y, z); l.scale.y = .85; l.castShadow = true; l.receiveShadow = true; l.name = 'plant'; leaf.add(l); (tagged.plant = tagged.plant || []).push(l); });
    foot(3.48, -1.92, 4.12, -1.28, 1.2);
    // 海报 / 日历 / 镜子
    TAG = 'poster'; plane(.8, 1.12, posterTex, 2.0, 2.2, -4.46);
    TAG = 'mirror'; rbox(.08, 1.78, .98, trim, -4.44, .1, -.4, { r: .04 }); const mir = new T.Mesh(new T.PlaneGeometry(.8, 1.58), new T.MeshBasicMaterial({ map: mirTex })); mir.position.set(-4.39, 1.0, -.4); mir.rotation.y = Math.PI / 2; mir.userData.keep = true; mir.userData.noOl = true; room.add(mir); reg(mir);
    foot(-4.5, -.92, -4.2, .12, 1.9);
    TAG = 'calendar'; plane(.44, .54, calTex, 3.25, 1.75, -4.46);
    TAG = '';
    A.stylize(room, 'room');
    leaf.scale.setScalar(1 + (P().plantLv || 0) * .07);
    if (P().hm.morning) setMood('morning');
    // 商店买的摆件：3D 表情公告板
    // 摆放位置都放在家具台面上或者不挡路的墙角
    const decoSlots = [[1.88, .78, -3.62], [-4.17, 2.32, 1.15], [-4.17, 2.32, 2.0], [-.72, .52, -4.08], [1.12, .52, -4.08], [-1.35, 1.38, -4.25], [-2.6, 0, 1.15], [1.3, 0, 3.6], [-1.6, 0, 3.55], [-3.95, 0, .45], [2.2, 0, -1.75], [-2.6, 0, -.5], [3.0, 0, -.95], [-4.0, 0, 2.75]];
    const decos = [];
    const emoTex = ch => A.emojiTex(ch);
    P().room.forEach((d, i) => { const s = decoSlots[i % decoSlots.length]; const sp = new T.Sprite(new T.SpriteMaterial({ map: emoTex(d), transparent: true })); const sz = s[1] < .1 ? .8 : .5; sp.scale.set(sz, sz, 1); sp.position.set(s[0], s[1] + sz / 2, s[2]); sp.userData.deco = d; sc.add(sp); decos.push(sp); const sh = new T.Mesh(new T.CircleGeometry(sz * .32, 20), new T.MeshBasicMaterial({ color: 0x2a1a20, transparent: true, opacity: .28, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(s[0], s[1] + .015, s[2]); sc.add(sh); });

    /* ---- 角色 ---- */
    let hero = null, pet = null, petEmo = null; const actors = [];
    const heroKey = App.heroModel ? App.heroModel(P()) : null;
    const loadHero = () => { if (!heroKey) return; A.make(heroKey, { height: 1.55, style: 'p5', hat: P().equip.hat, wand: P().equip.wand }).then(av => { if (dead) return; hero = av; av.position.set(-1, 0, 1.6); av.rotation.y = .4; sc.add(av); actors.push(av); av.traverse(o => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; }); }).catch(() => {}); };
    const loadPet = () => {
      if (pet) { sc.remove(pet); actors.splice(actors.indexOf(pet), 1); pet = null; } if (petEmo) { sc.remove(petEmo); petEmo = null; }
      const p = P(); if (!p.pet) return; const K = dex(p.pet.kind), m = petModel(p.pet.kind);
      const place = o => { o.position.set(.6, 0, 2.2); o.rotation.y = -.3; sc.add(o); };
      if (m) A.make(m, { height: K.h * 1.4, style: 'anime' }).then(av => { if (dead) return; pet = av; place(av);
        // 寻路半径按模型实际占地（长身子的马、鹿要离家具远一点，转身时头尾才不会戳进去）
        { av.rotation.y = 0; av.updateMatrixWorld(true); const sz = new T.Box3().setFromObject(av).getSize(new T.Vector3()); av.rotation.y = -.3; av.userData.fr = Math.max(.16, Math.min(.62, Math.max(sz.x, sz.z) * .45)); } actors.push(av); if (dex(p.pet.kind).t >= 3) addAura(av, TIERS[K.t].c); }).catch(() => {});
      else { const sp = new T.Sprite(new T.SpriteMaterial({ map: emoTex(K.e) })); sp.scale.set(K.h * 1.2, K.h * 1.2, 1); sp.center.set(.5, 0); const g = new T.Group(); g.add(sp); g.userData.emo = true; petEmo = g; place(g); }
    };
    const addAura = (av, col) => { const ring = new T.Mesh(new T.RingGeometry(.45, .6, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .02; av.add(ring); av.userData.aura = ring; };
    loadHero(); loadPet();
    const petObj = () => pet || petEmo;

    /* ---- 移动 / 行为：网格 A* 寻路（绕开家具占地，按体型留出半径），主角和宠物互不穿模 ---- */
    const RB = { x0: -4.42, x1: 4.3, z0: -4.42, z1: 4.15 }; // 可走范围（左墙 / 后墙在 -4.5）
    const blockedR = (x, z, r) => x < RB.x0 + r || x > RB.x1 - r || z < RB.z0 + r || z > RB.z1 - r || OBST.some(o => x > o[0] - r && x < o[2] + r && z > o[1] - r && z < o[3] + r);
    const blocked = (x, z) => blockedR(x, z, .2);
    // 寻路时把「另一个角色」当成临时的圆形障碍（主角站着时宠物绕着走，不会从身体里穿过去）
    let AV = null; const hitAV = (x, z, r) => AV && Math.hypot(x - AV[0], z - AV[1]) < AV[2] + r;
    const CS = .12, GX = Math.ceil((RB.x1 - RB.x0) / CS), GZ = Math.ceil((RB.z1 - RB.z0) / CS);
    const grids = {};
    const gridFor = r => { const k = r.toFixed(2); if (grids[k]) return grids[k]; const g = new Uint8Array(GX * GZ); for (let i = 0; i < GX; i++) for (let j = 0; j < GZ; j++) g[i + j * GX] = blockedR(RB.x0 + (i + .5) * CS, RB.z0 + (j + .5) * CS, r) ? 1 : 0; return (grids[k] = g); };
    const cellOf = (x, z) => [Math.max(0, Math.min(GX - 1, Math.floor((x - RB.x0) / CS))), Math.max(0, Math.min(GZ - 1, Math.floor((z - RB.z0) / CS)))];
    const cellPos = (i, j) => [RB.x0 + (i + .5) * CS, RB.z0 + (j + .5) * CS];
    // 离 (x,z) 最近的可站位置
    function nearestFree(x, z, r) {
      if (!blockedR(x, z, r)) return [x, z];
      const g = gridFor(r), [ci, cj] = cellOf(x, z); let best = null, bd = 1e9;
      for (let rad = 1; rad < 40 && !best; rad++) for (let i = ci - rad; i <= ci + rad; i++) for (let j = cj - rad; j <= cj + rad; j++) { if (i < 0 || j < 0 || i >= GX || j >= GZ || g[i + j * GX]) continue; const [px, pz] = cellPos(i, j), d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; best = [px, pz]; } }
      return best || [x, z];
    }
    const free = (x, z, r) => nearestFree(x, z, r || .24);
    const clearLine = (ax, az, bx, bz, r) => { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / .06); for (let k = 1; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (blockedR(x, z, r) || hitAV(x, z, r)) return false; } return true; };
    function findPath(ax, az, bx, bz, r) {
      if (clearLine(ax, az, bx, bz, r)) return [[bx, bz]];
      const g = gridFor(r), [si, sj] = cellOf(ax, az), [ti, tj] = cellOf(bx, bz), N = GX * GZ;
      const gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), open = [];
      const id = (i, j) => i + j * GX, hh = (i, j) => Math.hypot(i - ti, j - tj);
      const s0 = id(si, sj); gs[s0] = 0; open.push([hh(si, sj), s0]);
      let found = -1, it = 0;
      while (open.length && it++ < 9000) {
        let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
        const [, cur] = open.splice(bi, 1)[0]; if (closed[cur]) continue; closed[cur] = 1;
        const ci = cur % GX, cj = (cur / GX) | 0; if (ci === ti && cj === tj) { found = cur; break; }
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue;
          const n = id(ni, nj); if (closed[n] || (g[n] && n !== id(ti, tj))) continue; if (AV && n !== id(ti, tj)) { const [cx2, cz2] = cellPos(ni, nj); if (hitAV(cx2, cz2, r)) continue; } if (di && dj && (g[id(ci + di, cj)] || g[id(ci, cj + dj)])) continue;
          const ng = gs[cur] + (di && dj ? 1.414 : 1); if (ng < gs[n]) { gs[n] = ng; from[n] = cur; open.push([ng + hh(ni, nj), n]); }
        }
      }
      if (found < 0) return null;
      const cells = []; for (let c = found; c >= 0 && c !== s0; c = from[c]) cells.unshift(cellPos(c % GX, (c / GX) | 0));
      cells[cells.length - 1] = [bx, bz];
      // 拉直：能直接看到的拐点都跳过
      const out = []; let cx = ax, cz = az, k = 0;
      while (k < cells.length) { let far = k; for (let m = cells.length - 1; m > k; m--) if (clearLine(cx, cz, cells[m][0], cells[m][1], r * .92)) { far = m; break; } out.push(cells[far]); [cx, cz] = cells[far]; k = far + 1; }
      return out;
    }
    const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
    function mover(getObj, speed, radius, other) {
      return { tgt: null, path: null, cb: null, run: false, r: radius,
        go(x, z, cb, run) {
          const o = getObj(); if (!o) { cb && cb(); return; }
          this.r = typeof radius === 'function' ? radius() : radius;
          if (o.userData.rising) return;
          if (o.userData.seat && o.vrm) { this.tgt = null; standUp(o).then(() => this.go(x, z, cb, run)); return; }
          if (o.userData.seat) { const st = o.userData.seat; o.userData.seat = null; hopTo(o, st[0], 0, st[1], 380).then(() => { o.position.y = 0; this.go(x, z, cb, run); }); return; }
          getUp(o);
          let [fx, fz] = nearestFree(x, z, this.r);
          // 宠物的目的地别和主角站在一起（反之亦然）
          const ot = other && other(), otR = ot ? (ot.userData.fr || heroR) : 0; if (ot && ot !== o) { const dx = fx - ot.position.x, dz = fz - ot.position.z, d = Math.hypot(dx, dz), need = this.r + otR + .1; if (d < need) { const k = d > 1e-3 ? need / d : 1; [fx, fz] = nearestFree(ot.position.x + (d > 1e-3 ? dx : .5) * k, ot.position.z + (d > 1e-3 ? dz : .3) * k, this.r); } }
          const [sx, sz] = blockedR(o.position.x, o.position.z, this.r) ? nearestFree(o.position.x, o.position.z, this.r) : [o.position.x, o.position.z];
          if (sx !== o.position.x || sz !== o.position.z) { o.position.x = sx; o.position.z = sz; }
          // 对方站着不动（或坐着）时才当障碍；在走的话让它自己让开
          const otMv = ot === hero ? heroMv : petMv; AV = ot && ot !== o && !(otMv && otMv.tgt) && Math.hypot(sx - ot.position.x, sz - ot.position.z) > otR + this.r ? [ot.position.x, ot.position.z, otR] : null;
          let path = findPath(sx, sz, fx, fz, this.r); if (!path && AV) { AV = null; path = findPath(sx, sz, fx, fz, this.r); } AV = null;
          if (!path) { this.tgt = null; cb && cb(); return; }
          this.path = path; this.tgt = new T.Vector3(path[0][0], 0, path[0][1]); this.cb = cb; this.run = !!run;
          if (o.play) o.play(run ? 'run' : 'walk');
        },
        stop() { this.tgt = null; this.path = null; const o = getObj(); if (o && o.play) o.play('idle'); },
        tick(dt) {
          const o = getObj(); if (!o || !this.tgt) return;
          const d = this.tgt.clone().sub(o.position); d.y = 0; const L = d.length();
          if (L < .05) {
            this.path.shift();
            if (this.path.length) { this.tgt.set(this.path[0][0], 0, this.path[0][1]); return; }
            const cb = this.cb; this.tgt = null; this.cb = null; this.path = null; if (o.play) o.play('idle'); cb && cb(); return;
          }
          const sp = (this.run ? speed * 2.1 : speed) * dt, ang = Math.atan2(d.x, d.z);
          o.rotation.y = lerpAng(o.rotation.y, ang, Math.min(1, dt * 9));
          // 先转向再走：转角大时原地转身，不会「横着滑」
          const turn = Math.abs(((ang - o.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
          const k = turn > 1.2 ? .15 : 1;
          o.position.x += d.x / L * Math.min(sp * k, L); o.position.z += d.z / L * Math.min(sp * k, L);
        } };
    }
    // 从沙发 / 床 / 椅子 / 宠物窝上下来：回到地面、身体摆正
    function getUp(o) { if (!o || (!o.position.y && !o.rotation.x && !o.userData.seat)) return; const st = o.userData.seat; o.position.y = 0; o.rotation.x = 0; o.rotation.z = 0; if (st) { const [x, z] = nearestFree(st[0], st[1], .26); o.position.x = x; o.position.z = z; } o.userData.seat = null; }
    // 跳上 / 跳下（抛物线），用于宠物上沙发、进窝
    const hopTo = (o, x, y, z, ms) => new Promise(r => { if (!o) return r(); const a = o.position.clone(), t0 = performance.now(), D = ms || 420, top = Math.max(a.y, y) + .35; const f = () => { const k = Math.min(1, (performance.now() - t0) / D), e = k * k * (3 - 2 * k); o.position.set(a.x + (x - a.x) * e, a.y + (y - a.y) * k + Math.sin(k * Math.PI) * (top - Math.max(a.y, y)), a.z + (z - a.z) * e); if (k < 1) requestAnimationFrame(f); else r(); }; f(); });
    const heroR = .24, petR = () => { const o = petObj(); if (o && o.userData.fr) return o.userData.fr; const K = P().pet ? dex(P().pet.kind) : null; return K ? Math.max(.16, Math.min(.34, K.h * .38)) : .2; };
    const heroMv = mover(() => hero, 1.6, heroR, () => pet || petEmo), petMv = mover(petObj, 1.4, petR, () => hero);
    const faceTo = (o, x, z) => { if (o) o.rotation.y = Math.atan2(x - o.position.x, z - o.position.z); };
    /* ---- 坐 / 躺 / 捧东西：按姿势里骨骼的真实位置对齐家具，避免陷进坐垫或悬空 ---- */
    const bone = (o, n) => o && o.vrm ? o.vrm.humanoid.getRawBoneNode(n) : null;
    const wpos = b => b.getWorldPosition(new T.Vector3());
    const easeIO = k => k * k * (3 - 2 * k);
    const tween = (ms, f) => new Promise(r => { const t0 = performance.now(); const g = () => { const k = Math.min(1, (performance.now() - t0) / ms); f(easeIO(k), k); if (k < 1 && !dead) requestAnimationFrame(g); else r(); }; g(); });
    // 在 (0,0,0)、给定朝向下采样一次姿势，拿到髋骨 / 头的相对位置
    function sampleBones(o, pose, ry, rx) {
      const p0 = o.position.clone(), r0 = o.rotation.clone(), back = o.curName || 'idle';
      o.mixer.stopAllAction(); o.cur = null; o.play(pose, { restart: true }); o.mixer.update(1 / 60); o.vrm && o.vrm.humanoid.update();
      o.position.set(0, 0, 0); o.rotation.set(rx || 0, ry, 0); o.updateMatrixWorld(true);
      const out = { hip: wpos(bone(o, 'hips')), head: wpos(bone(o, 'head')) };
      o.position.copy(p0); o.rotation.copy(r0);
      o.mixer.stopAllAction(); o.cur = null; o.play(back === pose ? 'idle' : back, { restart: true }); o.mixer.update(1 / 60); o.updateMatrixWorld(true);
      return out;
    }
    // 慢慢坐下 / 躺下：姿势淡入的同时把身体移到位（arc：先抬高一点再落下，避免蹭到床沿）
    async function settle(o, pose, ry, rx, where, ms, arc) {
      if (!o || !o.vrm) return;
      const m = sampleBones(o, pose, ry, rx), hipT = where(m), tgt = new T.Vector3(hipT.x - m.hip.x, hipT.y - m.hip.y, hipT.z - m.hip.z);
      const p0 = o.position.clone(), y0 = o.rotation.y, x0 = o.rotation.x; o.userData.seat = [p0.x, p0.z];
      o.play(pose, { fade: (ms || 600) / 1000 });
      if (Math.abs(rx || 0) > .5) hairFlow(o, m.head.clone().sub(m.hip));
      await tween(ms || 600, e => { o.position.lerpVectors(p0, tgt, e); if (arc) o.position.y += Math.sin(e * Math.PI) * arc; o.rotation.y = lerpAng(y0, ry, e); o.rotation.x = x0 + ((rx || 0) - x0) * e; });
    }
    // 躺下时弹簧骨骼的重力不再朝下（会穿过枕头和床垫）：头发铺向头顶那边的枕头上，裙摆 / 衣角顺着腿往脚那边
    function hairFlow(o, toHead) {
      const sbm = o && o.vrm && o.vrm.springBoneManager; if (!sbm || !sbm.joints) return;
      const hd = toHead ? toHead.clone().setY(0).normalize().setY(.3).normalize() : null, ft = toHead ? toHead.clone().setY(0).normalize().multiplyScalar(-1).setY(.25).normalize() : null;
      sbm.joints.forEach(j => { const st = j.settings; if (!st || !st.gravityDir) return; j.__g0 = j.__g0 || [st.gravityDir.clone(), st.gravityPower];
        if (toHead) { st.gravityDir.copy(/hair|bang|tail|ahoge/i.test(j.bone && j.bone.name || '') ? hd : ft); st.gravityPower = Math.max(j.__g0[1], .3); } else { st.gravityDir.copy(j.__g0[0]); st.gravityPower = j.__g0[1]; } });
    }
    // 起身：回到坐下前站的位置
    async function standUp(o) {
      const st = o && o.userData.seat; if (!st) return;
      const p0 = o.position.clone(), x0 = o.rotation.x, lying = Math.abs(x0) > .5, [ax, az] = nearestFree(st[0], st[1], .26);
      o.userData.seat = null; o.userData.rising = true; if (o.play) o.play('idle', { fade: .45 }); hairFlow(o, null);
      await tween(lying ? 650 : 450, e => { o.position.set(p0.x + (ax - p0.x) * e, p0.y * (1 - e) + (lying ? Math.sin(e * Math.PI) * .25 : 0), p0.z + (az - p0.z) * e); o.rotation.x = x0 * (1 - e); });
      o.position.y = 0; o.rotation.x = 0; o.userData.rising = false;
    }
    // 宠物跳上家具（沙发 / 宠物窝 / 床尾）；体型太大的就坐在旁边地上
    async function petPerch(x, y, z, face, from) {
      const o = petObj(); if (!o) return false;
      const big = P().pet && dex(P().pet.kind).h > .8; if (big) return false;
      o.userData.seat = from || [o.position.x, o.position.z];
      o.rotation.y = Math.atan2(x - o.position.x, z - o.position.z); if (pet && pet.has('jump')) pet.play('jump', { once: true, restart: true });
      await hopTo(o, x, y, z, 460); o.rotation.y = face; playP('sit') || playP('idle'); return true;
    }
    // 手里拿个小道具（书 / 浇水壶）：放在两手中间，挂到右手骨上跟着动；返回移除函数
    function holdProp(o, mesh) {
      const rh = bone(o, 'rightHand'), lh = bone(o, 'leftHand'); if (!rh) return () => {};
      o.updateMatrixWorld(true); const a = wpos(rh), b = lh ? wpos(lh) : a.clone(), mid = a.clone().add(b).multiplyScalar(.5), head = wpos(bone(o, 'head'));
      mesh.position.copy(mid); mesh.lookAt(head); sc.add(mesh); rh.attach(mesh);
      return () => { mesh.parent && mesh.parent.remove(mesh); };
    }
    const bookMesh = () => { const g = new T.Group(), col = R.pick([0xe0485a, 0x5a6aa8, 0x6ab08a, 0xf4c860]); const c1 = new T.Mesh(new T.BoxGeometry(.13, .19, .012), A.mtoon(col)); c1.position.set(-.066, 0, 0); c1.rotation.y = .35; const c2 = c1.clone(); c2.position.x = .066; c2.rotation.y = -.35; const pg = new T.Mesh(new T.BoxGeometry(.24, .175, .02), A.mtoon(0xfaf4e8)); pg.position.z = .012; g.add(c1, c2, pg); return g; };

    // 3D 头顶气泡
    const labels = root.querySelector('.hm-labels');
    function bubble(obj, html, ms, cls) {
      if (!obj) return; const b = h('div', 'hm-bub ' + (cls || ''), html); labels.appendChild(b); hydrate(b);
      b._obj = obj; b._h = (obj.userData.h || (obj.userData.emo ? .8 : 1)) + .25; setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 300); }, ms || 2000);
    }
    const fxLayer = root.querySelector('.hm-fx');
    function particles(obj, emo, n, up) { if (!obj) return; const v = obj.position.clone(); v.y += (obj.userData.h || .6) * .8; const s = v.project(cam), r = rd.domElement.getBoundingClientRect(); UI.burst(r.left + (s.x + 1) / 2 * r.width, r.top + (1 - s.y) / 2 * r.height - (up || 0), emo, n || 6); }

    // 宠物自主行为（彩蛋）
    let busy = false, nextIdle = performance.now() + 3500, sleeping = false, butterfly = null, ballObj = null;
    const petSay = (t, ms) => bubble(petObj(), esc(t), ms);
    const playP = (n, o) => { const p = pet; return p ? p.play(n, o) : 0; };
    const onceP = (n, back) => pet ? pet.once(n, back) : sleep(800);
    const EGGS = [
      // [权重, 名字, 函数]
      [10, 'wander', async () => { const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.4; await goP(Math.cos(a) * r + .5, Math.sin(a) * r + .8); }],
      [6, 'follow', async () => { if (!hero) return; await goP(hero.position.x + .7, hero.position.z + .5); faceTo(petObj(), hero.position.x, hero.position.z); bubble(petObj(), E('💗'), 1400); }],
      [5, 'nap', async () => { await goP(PETBED.x - .75, PETBED.z); const ok = await petPerch(PETBED.x, PETBED.top, PETBED.z, -.6); if (!ok) { faceTo(petObj(), PETBED.x, PETBED.z); } sleeping = true; playP('sit') || playP('idle'); petSay('呼…呼…好困…', 2500); for (let i = 0; i < 6 && sleeping; i++) { bubble(petObj(), '<b class="zzz">Z<small>z</small></b>', 1500, 'zz'); await sleep(1800); } sleeping = false; playP('idle'); }],
      [5, 'moon', async () => { await goP(-.5, -3.2); faceTo(petObj(), -.6, -5); playP('sit') || playP('idle'); await sleep(600); petSay(new Date().getHours() === 0 ? '影时间到了…好神秘…' : '月亮好圆呀…', 2400); await sleep(2600); }],
      [4, 'tv', async () => { await goP(.2, -2.7); faceTo(petObj(), .2, -5); playP('sit') || playP('idle'); bubble(petObj(), E('📺') + E('✨'), 2000); await sleep(2800); }],
      [4, 'tail', async () => { const o = petObj(); bubble(o, '嘿嘿，转圈圈！', 1600); playP('run'); const t0 = performance.now(); while (performance.now() - t0 < 1500 && o) { o.rotation.y += .25; await sleep(16); } playP('idle'); }],
      [3, 'zoomies', async () => { bubble(petObj(), E('💨'), 1000); for (let i = 0; i < 4; i++) { const a = Math.random() * Math.PI * 2; await goP(Math.cos(a) * 2.6 + .4, Math.sin(a) * 2 + .8, true); } }],
      [3, 'sneeze', async () => { petSay('阿嚏！', 1200); Audio2.sfx('pop', .4); particles(petObj(), '💦', 5); await onceP('hit'); }],
      [4, 'butterfly', async () => { spawnButterfly(); bubble(petObj(), E('❗'), 900); for (let i = 0; i < 5 && butterfly; i++) { await goP(butterfly.position.x, butterfly.position.z, true); if (pet && pet.has('jump')) await onceP('jump'); } if (butterfly) { sc.remove(butterfly); butterfly = null; } petSay('抓到你啦！', 1500); }],
      [3, 'sofa', async () => { await goP(2.85, .9); await petPerch(SOFA.x, SOFA.top, .9, -Math.PI / 2); bubble(petObj(), E('🛋️') + E('💤'), 1800); await sleep(3200); }],
      [3, 'sniff', async () => { if (!decos.length) return; const d = R.pick(decos); await goP(d.position.x + .5, Math.max(-3, d.position.z + .6)); faceTo(petObj(), d.position.x, d.position.z); await onceP('eat'); bubble(petObj(), E(d.userData.deco), 1400); }],
      [2, 'coin', async () => { const p = P(); if (p.hm.coin >= 5) return; await onceP('eat'); p.hm.coin++; save(); petSay('我找到好东西啦！', 1500); particles(petObj(), '🪙', 6); App.addCoins && App.addCoins(5); }],
      [1, 'gift', async () => { const p = P(); if (p.hm.gift >= 1) return; p.hm.gift++; save(); if (hero) { await goP(hero.position.x + .6, hero.position.z + .6); faceTo(petObj(), hero.position.x, hero.position.z); } petSay('这是送给你的礼物！', 2000); await onceP('wave'); const g = rollDrop('gift'); if (g) dropToast(g, P().pet.name); else { App.addCoins && App.addCoins(10); UI.toast(E('🎁') + ' 宠物送来 10 金币'); } drawMenu(root); drawStatus(root); }],
      [3, 'look', async () => { const o = petObj(); if (!o) return; faceTo(o, cam.position.x, cam.position.z); bubble(o, E('💗'), 1500); await onceP('yes'); }],
      [3, 'dance', async () => { if (!pet || !pet.has('dance')) return; bubble(petObj(), E('🎵') + E('🎶'), 2000); await onceP('dance'); }],
    ];
    const goP = (x, z, run) => new Promise(r => { if (!petObj()) return r(); petMv.go(x, z, r, run); setTimeout(r, 6000); });
    function spawnButterfly() { butterfly = new T.Sprite(new T.SpriteMaterial({ map: emoTex('🦋'), transparent: true })); butterfly.scale.set(.35, .35, 1); butterfly.position.set(1, 1, 1); butterfly.userData.t = 0; sc.add(butterfly); }
    async function idleEgg() {
      if (busy || !petObj()) return; busy = true;
      try { const tot = EGGS.reduce((a, e) => a + e[0], 0); let r = Math.random() * tot, pick = EGGS[0]; for (const e of EGGS) { r -= e[0]; if (r < 0) { pick = e; break; } } await pick[2](); } catch (e) { console.warn(e); }
      busy = false; nextIdle = performance.now() + 3500 + Math.random() * 6000;
    }
    // 主角偶尔也有小动作
    let heroNext = performance.now() + 8000;
    async function heroIdle() { if (!hero || heroMv.tgt) return; if (hero.userData.seat) { if (Math.random() < .5) heroMv.go(hero.userData.seat[0], hero.userData.seat[1]); heroNext = performance.now() + 8000 + Math.random() * 6000; return; } const r = Math.random(); if (r < .3) { const [x, z] = free(-2 + Math.random() * 4, -1 + Math.random() * 3.5); heroMv.go(x, z); } else if (r < .55 && petObj()) { heroMv.go(petObj().position.x - .6, petObj().position.z + .4, () => { faceTo(hero, petObj().position.x, petObj().position.z); hero.once('wave'); bubble(hero, E('🤚') + E('💗'), 1200); }); } else if (r < .75) hero.once(R.pick(['wave', 'yes', 'idle2'])); heroNext = performance.now() + 7000 + Math.random() * 7000; }

    /* ---- 输入：点地板走、点宠物摸摸、拖动转视角 ---- */
    const ray = new T.Raycaster(), mp = new T.Vector2(); let down = null, dragged = false;
    rd.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, yaw]; dragged = false; });
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
    function onMove(e) { if (!down) return; const dx = e.clientX - down[0]; if (Math.abs(dx) > 6) dragged = true; if (dragged) tYaw = Math.max(.15, Math.min(1.35, down[2] - dx * .005)); }
    function onUp(e) {
      if (!down) return; const wasDrag = dragged; down = null; if (wasDrag || e.target !== rd.domElement) return;
      const r = rd.domElement.getBoundingClientRect(); mp.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mp, cam);
      const po = petObj(); if (po) { const hit = ray.intersectObject(po, true); if (hit.length) { act('pat', root); showRing(); return; } }
      if (hero) { const hit = ray.intersectObject(hero, true); if (hit.length) { api.heroReact('wave'); return; } }
      const dh = ray.intersectObjects(decos); if (dh.length) { const d = dh[0].object; petMv.go(d.position.x + .5, d.position.z + .6, () => { faceTo(petObj(), d.position.x, d.position.z); bubble(petObj(), E(d.userData.deco) + E('❓'), 1300); }); return; }
      const hits = ray.intersectObjects(room.children, false);
      if (hits.length && HS[hits[0].object.name]) { investigate(hits[0].object.name, e.clientX, e.clientY); return; }
      if (hits.length) { const n = hits[0].object.name; if (n === 'window') { petMv.go(-.5, -3.2, () => { faceTo(petObj(), -.6, -5); petSay('月亮好圆呀…'); }); return; } if (n === 'bowl') return feedMenu(root); if (n === 'petbed') { petMv.go(PETBED.x - .75, PETBED.z, async () => { await petPerch(PETBED.x, PETBED.top, PETBED.z, -.6); petSay('呼…呼…好困…'); }); return; } if (n === 'tv') { petMv.go(.2, -2.7, () => { faceTo(petObj(), .2, -5); bubble(petObj(), E('📺'), 1500); }); return; } }
      const fh = ray.intersectObject(floor); if (fh.length && hero) { const pt = fh[0].point; heroMv.go(pt.x, pt.z, null, Math.hypot(pt.x - hero.position.x, pt.z - hero.position.z) > 3); ring(pt); if (petObj() && !busy) setTimeout(() => petMv.go(pt.x + .6, pt.z + .5), 400); }
    }
    // 点宠物：在它身边弹出一圈快捷指令（P3 式环形菜单），3 秒后自动收起
    const ringEl = h('div', 'pet-ring'); labels.appendChild(ringEl); let ringT = 0;
    const RING = [['feed', '🍖', '喂食'], ['ball', '⚽', '玩球'], ['trick', '🎯', '训练'], ['photo', '📸', '拍照'], ['explore', '🗺️', '出门']];
    function showRing() {
      ringEl.innerHTML = RING.map((r, i) => '<button class="pr-b" data-a="' + r[0] + '" data-say="' + r[2] + '" style="--a:' + (-90 + (i - (RING.length - 1) / 2) * 38) + 'deg;--i:' + i + '">' + E(r[1]) + '<b>' + r[2] + '</b></button>').join('');
      hydrate(ringEl); ringEl.classList.remove('show'); void ringEl.offsetWidth; ringEl.classList.add('show'); ringEl._obj = petObj();
      clearTimeout(ringT); ringT = setTimeout(() => ringEl.classList.remove('show'), 3600);
    }
    ringEl.addEventListener('pointerdown', e => e.stopPropagation());
    ringEl.onclick = e => { const b = e.target.closest('.pr-b'); if (!b) return; ringEl.classList.remove('show'); Audio2.sfx('select', .4); act(b.dataset.a, root); };
    // 悬停在宠物身上：变成手形光标，宠物转头看你、冒爱心
    let hoverPet = false, hoverT = 0;
    rd.domElement.addEventListener('pointermove', e => {
      if (down || e.pointerType !== 'mouse') return; const po = petObj(); if (!po || performance.now() < hoverT) return; hoverT = performance.now() + 120;
      const r = rd.domElement.getBoundingClientRect(); mp.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mp, cam);
      const on = ray.intersectObject(po, true).length > 0;
      if (on !== hoverPet) { hoverPet = on; rd.domElement.style.cursor = on ? 'pointer' : ''; if (on && !busy && !petMv.tgt) { faceTo(po, cam.position.x, cam.position.z); bubble(po, E('💗'), 900); if (pet && Math.random() < .5) pet.once(pet.has('yes') ? 'yes' : 'idle2'); } }
    });
    /* ---- 调查：家具热点 ---- */
    // at：走到哪里站着；face：面朝哪里（都在家具占地外面，寻路能到）
    const HS = {
      bed: { n: '床', at: [-2.5, -2.9], face: [-3.62, -2.9], acts: [['sleep', '睡觉', '🌙']] },
      desk: { n: '书桌', at: [3.05, -2.72], face: [2.45, -3.9], acts: [['study', '学习', '📖']] },
      pc: { n: '电脑', at: [3.05, -2.72], face: [2.45, -3.9], acts: [['game', '打游戏', '🎮']] },
      shelf: { n: '书架', at: [-3.5, 1.6], face: [-4.4, 1.6], acts: [['read', '读书', '📚']] },
      tv: { n: '电视', at: [.2, -2.9], face: [.2, -4.2], acts: [['tv', '看电视', '📺']] },
      sofa: { n: '沙发', at: [2.85, .15], face: [3.7, .15], acts: [['rest', '和宠物窝着', '🛋️']] },
      craft: { n: '手工台', at: [-2.5, 2.52], face: [-2.5, 3.4], acts: [['craft', '做道具', '🛠️']] },
      plant: { n: '盆栽', at: [3.08, -1.6], face: [3.8, -1.6], acts: [['water', '浇水', '💧']] },
      window: { n: '窗户', at: [-.6, -3.15], face: [-.6, -5], acts: [['moon', '看夜景', '🌃']] },
      mirror: { n: '镜子', at: [-3.62, -.4], face: [-4.5, -.4], acts: [['mirror', '照镜子', '🪞'], ['stats', '查看能力', '📊']] },
      calendar: { n: '日历', at: [3.25, -3.0], face: [3.25, -4.5], acts: [['calendar', '看日程', '📅']] },
      poster: { n: '海报', at: [1.55, -3.05], face: [2.0, -4.5], acts: [['poster', '看海报', '👀']] },
      door: { n: '门', at: [-3.7, 3.4], face: [-4.5, 3.4], acts: [['out', '出门探索', '🗺️'], ['bond', '羁绊伙伴', '🤝']] },
      petbed: { n: '宠物窝', at: [1.45, 2.85], face: [PETBED.x, PETBED.z], acts: [['nap', '让宠物午睡', '💤']] },
      bowl: { n: '食盆', at: [2.95, 2.35], face: [BOWL.x, BOWL.z], acts: [['feed', '喂食', '🍖']] },
    };
    // 悬停高亮 + 名牌
    const tag = h('div', 'hs-tag'); root.appendChild(tag); let hovTag = null, hovT = 0;
    const glow = (t, on) => (tagged[t] || []).forEach(m => [].concat(m.material).forEach(mt => { if (!mt.emissive) return; if (on) { if (!mt.userData.e0) mt.userData.e0 = [mt.emissive.getHex(), mt.emissiveIntensity]; mt.emissive.set(0xffa070); mt.emissiveIntensity = .32; } else if (mt.userData.e0) { mt.emissive.setHex(mt.userData.e0[0]); mt.emissiveIntensity = mt.userData.e0[1]; } }));
    rd.domElement.addEventListener('pointermove', e => {
      if (down || performance.now() < hovT) return; hovT = performance.now() + 60;
      const r = rd.domElement.getBoundingClientRect(); mp.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mp, cam);
      const hit = ray.intersectObjects(room.children, false)[0], t = hit && HS[hit.object.name] ? hit.object.name : null;
      if (t !== hovTag) { if (hovTag) glow(hovTag, false); hovTag = t; if (t) { glow(t, true); tag.innerHTML = '<b>' + HS[t].n + '</b>' + HS[t].acts.map(a => '<i>' + E(a[2]) + a[1] + '</i>').join(''); hydrate(tag); Audio2.sfx('tick', .15); } tag.classList.toggle('show', !!t); rd.domElement.style.cursor = t ? 'pointer' : ''; }
      if (t) { tag.style.left = (e.clientX - root.getBoundingClientRect().left + 18) + 'px'; tag.style.top = (e.clientY - root.getBoundingClientRect().top - 10) + 'px'; }
    });
    rd.domElement.addEventListener('pointerleave', () => { if (hovTag) glow(hovTag, false); hovTag = null; tag.classList.remove('show'); });
    // 多个选项：P5 式「调查」弹出菜单
    const pop = h('div', 'hs-pop'); root.appendChild(pop);
    pop.addEventListener('pointerdown', e => e.stopPropagation());
    function investigate(t, cx, cy) {
      const H0 = HS[t]; tag.classList.remove('show');
      if (H0.acts.length === 1) return doAct(t, H0.acts[0][0]);
      const rr = root.getBoundingClientRect();
      pop.innerHTML = '<div class="hp-t">' + H0.n + '</div>' + H0.acts.map((a, i) => '<button class="hp-b" data-a="' + a[0] + '" data-key="' + (i + 1) + '" data-say="' + a[1] + '" style="--i:' + i + '">' + E(a[2]) + '<b>' + a[1] + '</b></button>').join('') + '<button class="hp-b hp-x" data-key="Escape">取消</button>';
      hydrate(pop); pop.style.left = Math.min(rr.width - 240, cx - rr.left + 10) + 'px'; pop.style.top = Math.min(rr.height - 240, cy - rr.top - 20) + 'px'; pop.classList.add('show'); Audio2.sfx('open', .3);
      pop.onclick = ev => { const b = ev.target.closest('.hp-b'); if (!b) return; pop.classList.remove('show'); if (b.dataset.a) doAct(t, b.dataset.a); };
    }
    addEventListener('pointerdown', () => pop.classList.remove('show'));
    // 走过去 → 面向家具 → 执行；镜头推近
    let actBusy = false;
    const walkHero = (x, z) => new Promise(r => { if (!hero) return r(); heroMv.go(x, z, r, Math.hypot(x - hero.position.x, z - hero.position.z) > 3); setTimeout(r, 7000); });
    const focus = (x, z, d) => { tLook.set(x, 1.0, z); tDist = d || 8.5; }, unfocus = () => { tLook.set(0, 1.1, 0); tDist = cam.aspect < 1 ? 15 : 13.5; };
    async function doAct(t, a) {
      if (actBusy) return; const H0 = HS[t]; tag.classList.remove('show'); if (hovTag) { glow(hovTag, false); hovTag = null; }
      if (a === 'feed') return feedMenu(root);
      if (a === 'out') return window.Explore && Explore.pick();
      if (a === 'bond') return window.Bond && Bond.panel();
      if (a === 'stats') return statsPanel();
      actBusy = true; busy = true; sleeping = false;
      try {
        focus((H0.at[0] + H0.face[0]) / 2, (H0.at[1] + H0.face[1]) / 2, t === 'window' ? 7 : 8.5);
        await walkHero(H0.at[0], H0.at[1]); if (hero) faceTo(hero, H0.face[0], H0.face[1]);
        await ACTS[a](H0);
      } catch (e) { console.warn(e); }
      actBusy = false; busy = false; unfocus(); nextIdle = performance.now() + 4000; drawStatus(root); drawMenu(root);
    }
    const heroAnim = async (n, ms) => { if (hero) { if (ms) { hero.play(n); await sleep(ms); hero.play('idle'); } else await hero.once(n); } else await sleep(ms || 800); };
    const petNear = (x, z) => goP(x, z);
    const H15 = () => hero ? (hero.userData.h || 1.55) / 1.55 : 1; // 按身高缩放「髋骨离座面」的距离
    // 坐到椅子上面朝书桌（髋骨在座面上方一点，身体略靠后，膝盖伸到桌子下面）
    const sitChair = () => settle(hero, 'sitwork', Math.PI, 0, () => new T.Vector3(CHAIR.x, CHAIR.top + .085 * H15(), CHAIR.z + .02), 650);
    const ACTS = {
      sleep: () => sleepSeq(),
      study: async () => { await sitChair(); const n = await quizRound(3, '学习时间', '把今天的知识复习一下吧！'); gainAct('kn', 1 + n + (bondFx().study || 0), '学习', '📖', n ? '答对了 ' + n + ' 题' : '有点难呢……'); },
      game: async () => { await sitChair(); const M0 = pcs.material, e0 = M0.emissive.getHex(), i0 = M0.emissiveIntensity; M0.emissiveIntensity = 1.2; pcGlow.material.opacity = .7; const blink = setInterval(() => { M0.emissive.setHSL(Math.random(), .8, .45); pcGlow.material.color.copy(M0.emissive); }, 160); await sleep(2600); clearInterval(blink); M0.emissive.setHex(e0); M0.emissiveIntensity = i0; pcGlow.material.color.set(0x6a88ff); pcGlow.material.opacity = pcGlow.userData.o0; const c = Math.random() < .4 ? R.int(5, 15) : 0; if (c) App.addCoins(c); gainAct('de', 2 + (bondFx().game || 0), '打游戏', '🎮', c ? '还赢了 ' + c + ' 金币！' : '手指越来越灵活了'); },
      read: async () => { const b = R.pick(BOOKS); if (hero) { hero.play('interact'); await sleep(700); hero.play('read', { fade: .4 }); await sleep(450); } const drop = hero ? holdProp(hero, bookMesh()) : () => {}; bookCard(b); await Voice.say(b[1]); await sleep(600); drop(); if (hero) hero.play('idle', { fade: .4 }); gainAct('kn', 1, '读书', '📚', '《' + b[0] + '》', 'ki'); },
      tv: async () => { petNear(-.55, -2.75).then(() => { faceTo(petObj(), .2, -4.2); playP('sit') || playP('idle'); }); const M0 = tvs.material, e0 = M0.emissive.getHex(); tvGlow.material.opacity = .5; const blink = setInterval(() => { M0.emissive.setHSL(Math.random(), .7, .4); tvGlow.material.color.copy(M0.emissive); }, 300); bubble(hero, E('📺') + E('✨'), 2400); await sleep(2800); clearInterval(blink); M0.emissive.setHex(e0); tvGlow.material.opacity = tvGlow.userData.o0; gainAct('ch', 2, '看电视', '📺', R.pick(['学会了明星的笑容', '学会了一个新笑话', '看了一集怪盗动画'])); },
      // 和宠物窝在沙发上：主角坐左边坐垫，宠物跳上右边坐垫
      rest: async () => {
        const pz = .92, petGo = petObj() ? goP(2.85, pz + .1).then(() => petPerch(SOFA.x, SOFA.top, pz, -Math.PI / 2)) : Promise.resolve();
        await settle(hero, 'sitrest', -Math.PI / 2, 0, () => new T.Vector3(SOFA.x + .1, SOFA.top + .085 * H15(), .02), 650);
        await petGo; particles(petObj(), '💗', 8); await sleep(2200);
        const pt = P().pet; if (pt) { pt.joy = Math.min(100, pt.joy + 10); pt.bond = Math.min(100, (pt.bond || 0) + 3); save(); } gainAct('ki', 2, '和宠物窝着', '🛋️', '心情 +10 · 亲密 +3');
      },
      craft: async () => { await heroAnim('interact', 600); for (let i = 0; i < 4; i++) { Audio2.sfx('hit', .3); particles(hero, '✨', 3); await sleep(450); } const p = P(), dr = socRank(p, 'de'), n = dr >= 3 ? 2 : 1, it = R.pick(['potion', 'hint']); p.inv[it] = (p.inv[it] || 0) + n; save(); gainAct('de', 2, '做道具', '🛠️', '做出了 ' + (it === 'potion' ? '🧪 回血药水' : '💡 提示卡') + ' ×' + n); },
      water: async () => { await heroAnim('interact', 1200); particles(leaf, '💧', 8); const p = P(); p.plantLv = Math.min(10, (p.plantLv || 0) + (p.hm.water ? 0 : 1)); p.hm.water = 1; save(); leaf.scale.setScalar(1 + (p.plantLv || 0) * .07); gainAct('ki', 2, '浇水', '💧', '盆栽长大了一点'); },
      moon: async () => { if (petObj()) petNear(.15, -3.15).then(() => faceTo(petObj(), -.6, -5)); await sleep(2200); bubble(hero, new Date().getHours() < 18 && !dark ? '城市好热闹…' : '月亮好圆…', 1600); await sleep(1200); gainAct('gu', 2, '看夜景', '🌃', '黑夜也不怕啦'); },
      mirror: async () => { await heroAnim('wave'); bubble(hero, R.pick(['今天也很帅气！', '笑一个！', '我是最棒的！']), 1500); await sleep(600); gainAct('ch', 1, '照镜子', '🪞', '自信满满'); },
      calendar: async () => { const p = P(); bubble(hero, E('📅'), 1000); await sleep(500); dialog('日程', '今天还剩 ' + p.hm.ap + ' 点空闲时间。' + (p.hm.rested ? '睡过觉了，精神饱满！' : '累了就去床上睡一觉吧。'), false); },
      poster: async () => { bubble(hero, R.pick(['是怪盗的预告信！', '星星岛的宣传海报', '总有一天我也要上海报！']), 1800); await sleep(1600); },
      nap: async () => { await petNear(PETBED.x - .75, PETBED.z); if (!(await petPerch(PETBED.x, PETBED.top, PETBED.z, -.6))) faceTo(petObj(), PETBED.x, PETBED.z); sleeping = true; playP('sit') || playP('idle'); for (let i = 0; i < 3; i++) { bubble(petObj(), '<b class="zzz">Z<small>z</small></b>', 1300, 'zz'); await sleep(1200); } sleeping = false; const pt = P().pet; if (pt) { pt.joy = Math.min(100, pt.joy + 6); save(); } dialog(pt ? pt.name : '宠物', '呼…呼…好困…'); },
    };
    function gainAct(k, n, what, ic, note, k2) {
      const p = P(); if (p.hm.ap <= 0) { dialog('提示', '今天已经很累了，去床上睡一觉吧！'); return; }
      p.hm.ap--; save();
      const r1 = addSoc(p, k, n), r2 = k2 ? addSoc(p, k2, 1) : null;
      actCard(what, ic, note, [r1, r2].filter(Boolean));
    }
    // 睡觉：从床边爬上床，仰面躺好、头枕在枕头上；宠物跳到床尾的被子上蜷着
    async function sleepSeq() {
      const p = P(); if (!hero) return;
      bubble(hero, '晚安～', 1000); await sleep(300);
      const petDone = petObj() ? goP(BED.x + BED.w / 2 + .45, BED.z1 + .35).then(() => petPerch(BED.x + .3, BED.top + .24, BED.z1 - .32, Math.PI * .85)).then(ok => { if (!ok) faceTo(petObj(), BED.x, BED.z1 - .5); sleeping = true; }) : null;
      await settle(hero, 'lie', 0, -Math.PI / 2, m => { const d = m.head.z - m.hip.z; return new T.Vector3(BED.x - .08, BED.top + .1 * H15(), BED.pillowZ + .1 - d); }, 900, .45);
      // 盖好被子：从胸口一直盖到床尾
      { hero.updateMatrixWorld(true); const ch = wpos(bone(hero, 'chest')), z0 = ch.z + .06, z1 = BED.z1 + .02; comforter.scale.z = z1 - z0; comforter.position.z = (z0 + z1) / 2; comforter.position.y = BED.top - .06 + .15; comforter.visible = true; comforter.scale.y = .01; await tween(450, e => { comforter.scale.y = .01 + e * .99; }); }
      focus(-3.2, -2.4, 8); await sleep(700); setMood('sleep'); Audio2.duck(true);
      for (let i = 0; i < 3; i++) { bubble(hero, '<b class="zzz">Z<small>z</small></b>', 1200, 'zz'); await sleep(900); }
      await dayCard(); setMood('morning');
      await tween(300, e => { comforter.scale.y = 1 - e * .99; }); comforter.visible = false;
      { const po = petObj(); if (po && po.position.y > BED.top + .05) po.position.y = BED.top; }
      await standUp(hero); faceTo(hero, 0, 2); sleeping = false; Audio2.duck(false);
      const first = !p.hm.rested; p.hm.morning = 1;
      if (first) { p.hm.rested = 1; p.hm.ap += 2; if (p.pet) { p.pet.joy = Math.min(100, p.pet.joy + 15); p.pet.bond = Math.min(100, (p.pet.bond || 0) + 4); } }
      save(); await hero.once('wave');
      if (first) actCard('睡个好觉', '🌞', '精神饱满！今天每局 +1 颗心，空闲时间 +2', []); else dialog(p.name, '睡得好香呀～');
    }
    let ringM = null; function ring(pt) { if (ringM) sc.remove(ringM); ringM = new T.Mesh(new T.RingGeometry(.15, .24, 24), new T.MeshBasicMaterial({ color: 0x3fd0ff, transparent: true })); ringM.rotation.x = -Math.PI / 2; ringM.position.set(pt.x, .03, pt.z); ringM.userData.t = 0; sc.add(ringM); }
    // 键盘：WASD 移动主角
    const keys = new Set(); const kd = e => { if (/INPUT|TEXTAREA/.test(e.target.tagName) || $('#fx .modal-bg')) return; const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1 || /arrow/.test(k)) { keys.add(k); e.preventDefault(); } }; const ku = e => keys.delete(e.key.toLowerCase());
    addEventListener('keydown', kd); addEventListener('keyup', ku);

    /* ---- 循环 ---- */
    let dead = false, last = performance.now(), raf = 0; const lp = new T.Vector3();
    const fit = () => { const r = box.getBoundingClientRect(); rd.setSize(r.width, r.height); cam.aspect = r.width / Math.max(1, r.height); cam.fov = cam.aspect < 1 ? 50 : 36; tDist = dist = cam.aspect < 1 ? 15 : 13.5; cam.updateProjectionMatrix(); };
    fit(); addEventListener('resize', fit);
    function loop() {
      if (dead) return; if (!rd.domElement.isConnected) return dispose(); raf = requestAnimationFrame(loop);
      const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
      yaw += (tYaw - yaw) * Math.min(1, dt * 6); look.lerp(tLook, Math.min(1, dt * 3)); dist += (tDist - dist) * Math.min(1, dt * 3); placeCam();
      // 键盘移动
      if (hero && keys.size) { let mx = 0, mz = 0; keys.forEach(k => { if (k === 'a' || k === 'arrowleft') mx -= 1; if (k === 'd' || k === 'arrowright') mx += 1; if (k === 'w' || k === 'arrowup') mz -= 1; if (k === 's' || k === 'arrowdown') mz += 1; }); if (mx || mz) { const cy = Math.cos(yaw), sy = Math.sin(yaw); const wx = mx * cy + mz * sy, wz = -mx * sy + mz * cy, L = Math.hypot(wx, wz); heroMv.go(hero.position.x + wx / L * .6, hero.position.z + wz / L * .6); } }
      heroMv.tick(dt); petMv.tick(dt);
      actors.forEach(a => a.update(dt));
      if (petEmo) { petEmo.children[0].position.y = Math.abs(Math.sin(now / 260)) * (petMv.tgt ? .12 : .04); }
      if (pet && pet.userData.aura) { pet.userData.aura.rotation.z += dt; pet.userData.aura.material.opacity = .35 + Math.sin(now / 300) * .15; }
      if (butterfly) { butterfly.userData.t += dt; const t = butterfly.userData.t; butterfly.position.set(Math.sin(t * .9) * 2.4 + .4, 1 + Math.sin(t * 3) * .3, Math.cos(t * .7) * 2 + .8); }
      if (ballObj) {
        // 球会落在矮家具（沙发 / 床 / 桌子）上弹，撞到高家具（书架 / 盆栽 / 墙）会反弹，不会穿进去
        const B = ballObj.position, v = ballObj.userData.v, px = B.x, pz = B.z; v.y -= 9.8 * dt; B.addScaledVector(v, dt);
        let ground = 0; for (const o of OBST) { if (B.x > o[0] && B.x < o[2] && B.z > o[1] && B.z < o[3]) { if (o[4] >= 1.2 || B.y < o[4] - .05) { if (px <= o[0] || px >= o[2]) v.x *= -.6; if (pz <= o[1] || pz >= o[3]) v.z *= -.6; B.x = px; B.z = pz; } else ground = Math.max(ground, o[4]); } }
        if (B.y < ground + .15) { B.y = ground + .15; v.y *= -.55; v.x *= .8; v.z *= .8; }
        if (B.x < -4.3 || B.x > 4.2) { v.x *= -.6; B.x = Math.max(-4.3, Math.min(4.2, B.x)); } if (B.z < -4.3 || B.z > 4.0) { v.z *= -.6; B.z = Math.max(-4.3, Math.min(4.0, B.z)); }
        ballObj.rotation.x += dt * 8;
      }
      if (ringM) { ringM.userData.t += dt; ringM.scale.setScalar(1 + ringM.userData.t * 2); ringM.material.opacity = 1 - ringM.userData.t * 1.5; if (ringM.userData.t > .7) { sc.remove(ringM); ringM = null; } }
      if (!busy && !actBusy && now > nextIdle && !$('#fx .modal-bg')) idleEgg();
      if (!actBusy && now > heroNext && !$('#fx .modal-bg')) heroIdle();
      // 气泡跟随
      const r = rd.domElement.getBoundingClientRect();
      if (ringEl._obj && ringEl.classList.contains('show')) { lp.copy(ringEl._obj.position); lp.y += (ringEl._obj.userData.h || .6) * .6; lp.project(cam); ringEl.style.transform = 'translate(' + ((lp.x + 1) / 2 * r.width) + 'px,' + ((1 - lp.y) / 2 * r.height) + 'px)'; }
      labels.querySelectorAll('.hm-bub').forEach(b => { if (!b._obj) return; lp.copy(b._obj.position); lp.y += b._h; lp.project(cam); b.style.transform = 'translate(' + ((lp.x + 1) / 2 * r.width) + 'px,' + ((1 - lp.y) / 2 * r.height) + 'px) translate(-50%,-100%)'; });
      A.setViewport(rd.domElement.width, rd.domElement.height); A.outlineU.uOl.value = 2 / Math.max(1, rd.domElement.height) * Math.min(devicePixelRatio, 2) * .9;
      rd.render(sc, cam);
    }
    loop();
    function dispose() { if (dead) return; dead = true; cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('keydown', kd); removeEventListener('keyup', ku); try { rd.dispose(); rd.forceContextLoss(); } catch (e) {} if (H === api) H = null; }
    Core.onLeave(dispose);

    const api = {
      petReact: async (kind) => {
        const o = petObj(); if (!o) return; sleeping = false;
        if (kind === 'pat') { Audio2.sfx('pluck', .5); particles(o, '💗', 6); bubble(o, R.pick(['好舒服呀～', '我最喜欢你了！', '嘿嘿']), 1500); if (hero) { heroMv.go(o.position.x - .7, o.position.z + .3, () => { faceTo(hero, o.position.x, o.position.z); hero.once('wave'); }); } faceTo(o, cam.position.x, cam.position.z); if (pet) await pet.once(pet.has('yes') ? 'yes' : 'jump'); }
        if (kind === 'trick') { const seq = ['jump', 'dance', 'attack', 'wave', 'sit'].filter(n => pet && pet.has(n)); const n = R.pick(seq.length ? seq : ['jump']); bubble(o, '看我的绝招！', 1400); Audio2.sfx('jump', .4); if (pet) await pet.once(n); else { for (let i = 0; i < 12; i++) { o.position.y = Math.sin(i / 11 * Math.PI) * .6; await sleep(30); } o.position.y = 0; } particles(o, '⭐', 8); }
        if (kind === 'gift') { bubble(o, E('🎁') + '！', 1500); if (pet) pet.once('wave'); }
      },
      heroReact: n => { if (!hero) return; if (!hero.userData.seat) hero.once(n || 'wave'); bubble(hero, R.pick(['今天也要加油！', '嘿！', E('😊')]), 1300); },
      throwBall: () => {
        const o = petObj(); if (!o) return; if (ballObj) sc.remove(ballObj);
        ballObj = new T.Mesh(new T.SphereGeometry(.15, 16, 12), new T.MeshToonMaterial({ color: 0xffffff })); const from = hero ? hero.position : new T.Vector3(0, 0, 2);
        ballObj.position.set(from.x, 1.2, from.z); const a = Math.random() * Math.PI * 2; ballObj.userData.v = new T.Vector3(Math.cos(a) * 3, 4, Math.sin(a) * 2.5 - 1); A.stylize(ballObj, 'anime'); sc.add(ballObj);
        if (hero && !hero.userData.seat) hero.once('attack'); Audio2.sfx('throw', .5); busy = true;
        setTimeout(() => petMv.go(ballObj.position.x, ballObj.position.z, async () => { if (pet) await pet.once('jump'); bubble(o, '再来一次！', 1400); if (ballObj) { sc.remove(ballObj); ballObj = null; } busy = false; }, true), 700);
        const myBall = ballObj; setTimeout(() => { busy = false; if (ballObj === myBall) { sc.remove(ballObj); ballObj = null; } }, 6500);
      },
      feed: f => { const o = petObj(); if (!o) return; busy = true; petMv.go(BOWL.x - .5, BOWL.z - .32, async () => { faceTo(petObj(), BOWL.x, BOWL.z); const sp = new T.Sprite(new T.SpriteMaterial({ map: emoTex(f) })); sp.scale.set(.3, .3, 1); sp.position.set(BOWL.x, .26, BOWL.z); sc.add(sp); if (pet) await pet.once('eat'); else await sleep(900); sc.remove(sp); particles(o, '✨', 6); busy = false; }); setTimeout(() => busy = false, 6000); },
      reloadPet: loadPet,
      goAct: doAct,
      // 自动化测试用：拿到场景里的对象
      _dbg: () => ({ freeze: () => { nextIdle = heroNext = 1e15; }, findPath, blockedR, nearestFree, hero, pet: petObj(), cam, sc, OBST, settle, petPerch, focus, unfocus, setMood, heroMv, petMv, SOFA, PETBED, CHAIR, BED }),
      reloadHero: () => { if (hero) { const pos = hero.position.clone(), ry = hero.rotation.y; sc.remove(hero); actors.splice(actors.indexOf(hero), 1); hero = null; A.make(heroKey, { height: 1.55, style: 'p5', hat: P().equip.hat, wand: P().equip.wand }).then(av => { if (dead) return; hero = av; av.position.copy(pos); av.rotation.y = ry; sc.add(av); actors.push(av); av.once('wave'); }); } },
      photo: () => {
        rd.renderNow(sc, cam); const src = rd.domElement; const c = document.createElement('canvas'); c.width = 900; c.height = 680; const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 680); const sw = src.width, sh = src.height, k = Math.max(840 / sw, 560 / sh); x.save(); x.beginPath(); x.rect(30, 30, 840, 560); x.clip(); x.drawImage(src, 30 + (840 - sw * k) / 2, 30 + (560 - sh * k) / 2, sw * k, sh * k); x.restore();
        x.fillStyle = '#0a3d91'; x.font = "32px 'ZK', sans-serif"; x.textAlign = 'center'; x.fillText((P().pet ? P().pet.name + ' 和 ' : '') + P().name + ' · ' + new Date().toLocaleDateString(), 450, 638);
        const url = c.toDataURL('image/jpeg', .9); Audio2.sfx('pop', .6); const fl = h('div', 'flash'); document.body.appendChild(fl); setTimeout(() => fl.remove(), 500);
        const m = UI.modal('<div class="p3-mh"><b>PHOTO</b><span>拍照</span></div><img class="polaroid" src="' + url + '"><div class="r-btns"><a class="btn" download="星星岛-家园.jpg" href="' + url + '">保存照片</a></div>', { cls: 'wide p3m' }); void m; dialog('拍照', '咔嚓！拍得真好！');
      },
    };
    return api;
  }

  window.Home = { room: () => H, socRank, addSoc, SOC, ransom, quizRound, pickQ, actCard, rankUp, statsPanel, open, ensure, gearFx, rollDrop, dropToast, gearCard, hatchRoll, newPetObj, switchPet, petImg, petModel, tierBadge, TIERS, PETDEX, GEAR, dex, dialog, SAY_LIST, EXTRA_FOOD, foodInfo, stars };
})();
