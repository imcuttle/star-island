/* 羁绊伙伴（JRPG 好感养成）
   · 8 位伙伴住在不同的探索场景里，各有一张塔罗牌；羁绊等级 1-10
   · 每天能和每位伙伴「共度时光」一次：对话里选回应——说到心坎上 +3、还不错 +1、说错话 -1
   · 送礼：喜欢的 +3、普通 +1、讨厌的 -2；太久不见（4 天以上）会生气，扣好感
   · 魅力越高好感涨得越快；每升一级都解锁实打实的效果（多一颗心、金币加成、交涉更容易……） */
(function () {
  const { h, sleep, today, esc, Store, Audio2, Voice, E, hydrate, UI } = Core;
  const R = CONTENT.R;
  const P = () => Store.p, save = () => Store.save();
  const TH = [0, 3, 7, 12, 18, 25, 33, 42, 52, 63]; // 达到第 n 级需要的累计好感
  const rankOf = pts => { let r = 1; TH.forEach((t, i) => { if (pts >= t) r = i + 1; }); return r; };
  const day = () => Math.floor(Date.now() / 864e5);

  /* ---------- 伙伴 ----------
     perks: [解锁等级, 效果 key, 数值, 说明]
     talk: 每次见面轮流使用的对话；o 里第二项是得分（3 / 1 / -1） */
  const NPCS = [
    { id: 'lin', n: '林老师', m: 'wizard', card: '女祭司', ce: '📜', scene: 'town', x: .47, c: '#7a5cff', likes: ['🍰', '🥛'], hates: ['🍖'], intro: '我是小镇图书馆的林老师，书里藏着整个世界哦。',
      perks: [[2, 'study', 1, '学习时知识额外 +1'], [4, 'eye', 1, '每局多去掉 1 个错误选项'], [6, 'book', 15, '经验 +15%'], [8, 'eye', 1, '每局再多去掉 1 个错误选项'], [10, 'heart', 1, '每局多 1 颗心']],
      talk: [
        { s: '你最近在读什么书呀？', o: [['在读恐龙的书！', 3], ['没怎么读……', -1], ['在读漫画', 1]] },
        { s: '遇到不会的题，你会怎么做？', o: [['先想一想，再问老师', 3], ['直接跳过', -1], ['看看提示', 1]] },
        { s: '图书馆今天好安静，你喜欢安静吗？', o: [['喜欢，可以专心看书', 3], ['还好吧', 1], ['好无聊呀', -1]] },
        { s: '如果能和书里的人物见面，你想见谁？', o: [['想见勇敢的探险家', 3], ['想见会魔法的人', 3], ['不知道', -1]] },
      ] },
    { id: 'hao', n: '阿浩', m: 'kid_boy3', card: '战车', ce: '🏎️', scene: 'town', x: .12, c: '#ff6a2a', likes: ['🥐', '🍖'], hates: ['🥕'], intro: '我是面包房的学徒阿浩！以后要当最强的面包师兼冒险家！',
      perks: [[2, 'sword', 1, '暗影战 / Boss 战攻击 +1'], [4, 'first', 1, '碰到暗影时更容易先制攻击'], [6, 'sword', 1, '攻击再 +1'], [8, 'aoa', 50, '总攻击伤害 +50%'], [10, 'sword', 2, '攻击再 +2']],
      talk: [
        { s: '今天的面包是我烤的，好吃吗？', o: [['超级好吃！', 3], ['有点焦……', -1], ['还不错', 1]] },
        { s: '我想去打败暗影，你觉得我行吗？', o: [['我们一起去！', 3], ['太危险了吧', 1], ['你肯定不行', -1]] },
        { s: '跑步比赛我又输了……', o: [['下次一定能赢！', 3], ['没关系啦', 1], ['哈哈哈', -1]] },
        { s: '你最喜欢吃什么面包？', o: [['你做的都喜欢', 3], ['可颂', 1], ['我不爱吃面包', -1]] },
      ] },
    { id: 'yue', n: '小月', m: 'kid_girl2', card: '魔术师', ce: '🎩', scene: 'city', x: .2, c: '#ff3d8a', likes: ['🧁', '🍦'], hates: ['🐟'], intro: '游戏厅的高手就是我，小月！要不要来比一局？',
      perks: [[2, 'game', 1, '打游戏灵巧额外 +1'], [4, 'magnet', 10, '金币 +10%'], [6, 'sp', 10, '暗影战 SP +10'], [8, 'magnet', 15, '金币再 +15%'], [10, 'ap', 1, '每天多 1 点空闲时间']],
      talk: [
        { s: '我刚刚刷新了最高分！厉害吧？', o: [['太厉害了！教教我', 3], ['我也可以', 1], ['那有什么', -1]] },
        { s: '玩游戏输了你会生气吗？', o: [['不会，再来一局就好', 3], ['会有一点', 1], ['会摔手柄！', -1]] },
        { s: '你觉得魔术是真的吗？', o: [['是很厉害的技巧', 3], ['是真的魔法！', 1], ['都是骗人的', -1]] },
        { s: '要一起去吃冰淇淋吗？', o: [['好呀！', 3], ['下次吧', 1], ['不想去', -1]] },
      ] },
    { id: 'doc', n: '吴博士', m: 'scientist', card: '隐者', ce: '🔭', scene: 'city', x: .58, c: '#3fd0ff', likes: ['🍪', '🧃'], hates: ['🍦'], intro: '我是研究暗影的吴博士。嗯……你身上有很特别的力量。',
      perks: [[2, 'scan', 1, '暗影战自动看穿弱点'], [4, 'book', 10, '经验 +10%'], [6, 'clover', 5, '宠物掉落装备率 +5%'], [8, 'book', 15, '经验再 +15%'], [10, 'heal', 1, '每场暗影战后全员回满']],
      talk: [
        { s: '你知道为什么天空是蓝色的吗？', o: [['阳光被空气散开了', 3], ['因为海是蓝的', 1], ['不想知道', -1]] },
        { s: '实验失败了好多次，我该放弃吗？', o: [['不要放弃，再试一次！', 3], ['休息一下吧', 1], ['放弃吧', -1]] },
        { s: '暗影最怕什么，你发现了吗？', o: [['每个暗影弱点不一样', 3], ['怕光', 1], ['它们不可怕', -1]] },
        { s: '帮我记一下数据好吗？', o: [['好的，交给我！', 3], ['等一下哦', 1], ['好麻烦', -1]] },
      ] },
    { id: 'elf', n: '森守', m: 'elf', card: '星星', ce: '⭐', scene: 'forest', x: .5, c: '#5fe08a', likes: ['🫐', '🍄'], hates: ['🍣'], intro: '……森林在低语。你是来倾听它的人吗？',
      perks: [[2, 'clover', 5, '宠物掉落装备率 +5%'], [4, 'nego', 1, '交涉少答 1 题'], [6, 'petxp', 30, '宠物经验 +30%'], [8, 'clover', 10, '掉落率再 +10%'], [10, 'pity', 10, '孵蛋保底提前 10 次']],
      talk: [
        { s: '你听见萤火虫的声音了吗？', o: [['好像听见了！', 3], ['萤火虫不会叫吧', 1], ['什么也没有', -1]] },
        { s: '有人在森林里乱扔垃圾……', o: [['我们一起捡起来', 3], ['真过分', 1], ['无所谓啦', -1]] },
        { s: '你会和你的宠物说话吗？', o: [['每天都说！', 3], ['偶尔', 1], ['它又听不懂', -1]] },
        { s: '星星为什么一闪一闪的？', o: [['因为空气在流动', 3], ['它们在眨眼', 1], ['不知道', -1]] },
      ] },
    { id: 'cap', n: '铁锚船长', m: 'superhero', card: '皇帝', ce: '⚓', scene: 'beach', x: .63, c: '#ffd23f', likes: ['🐟', '🍣'], hates: ['🧁'], intro: '哈哈！我是铁锚船长，大海就是我的家！',
      perks: [[2, 'ap', 1, '每天多 1 点空闲时间'], [4, 'guard', 1, '暗影战防御减伤更多'], [6, 'shield', 1, '每局多 1 次守护'], [8, 'heart', 1, '每局多 1 颗心'], [10, 'shield', 1, '再多 1 次守护']],
      talk: [
        { s: '风浪很大的时候，船长要怎么办？', o: [['冷静，握紧舵！', 3], ['赶紧回家', 1], ['跳海', -1]] },
        { s: '我年轻时也怕过大海，你有怕的东西吗？', o: [['有，但我会勇敢面对', 3], ['怕黑', 1], ['我什么都不怕！', -1]] },
        { s: '帮我把缆绳收起来吧！', o: [['嘿哟！收好了', 3], ['好重啊', 1], ['我不要', -1]] },
        { s: '看，海鸥！你知道它们去哪儿吗？', o: [['去找吃的', 3], ['回家', 1], ['不关心', -1]] },
      ] },
    { id: 'tie', n: '小铁', m: 'robot', card: '命运之轮', ce: '⚙️', scene: 'tower', x: .3, c: '#b6ff6a', likes: ['🧃', '🥛'], hates: ['🍰'], intro: '哔——识别到新朋友。我是守塔机器人小铁。',
      perks: [[2, 'sp', 10, '暗影战 SP +10'], [4, 'catch', 1, '收服的宠物直接 +1 星'], [6, 'potion', 1, '每局多 1 次治愈'], [8, 'heal', 1, '每场暗影战后全员回满'], [10, 'aoa', 50, '总攻击伤害 +50%']],
      talk: [
        { s: '哔……机器人可以有朋友吗？', o: [['当然可以，我就是你的朋友！', 3], ['也许吧', 1], ['不可以', -1]] },
        { s: '我的程序出错了，你能帮我算一算吗？', o: [['我来帮你！', 3], ['我也不会', 1], ['自己算', -1]] },
        { s: '人类为什么会笑？', o: [['因为开心呀', 3], ['因为好笑', 1], ['不知道', -1]] },
        { s: '这座塔里有很多暗影，你害怕吗？', o: [['有你在就不怕', 3], ['有一点', 1], ['好可怕，我要走了', -1]] },
      ] },
    { id: 'sky', n: '星野姐姐', m: 'astronaut', card: '太阳', ce: '☀️', scene: 'city', x: .72, c: '#ff9a3a', likes: ['🍦', '🍰'], hates: ['🍄'], intro: '我是在观景台工作的宇航员星野，总有一天要飞到月亮上！',
      perks: [[2, 'petxp', 20, '宠物经验 +20%'], [4, 'heart', 1, '每局多 1 颗心'], [6, 'magnet', 10, '金币 +10%'], [8, 'nego', 1, '交涉少答 1 题'], [10, 'book', 25, '经验 +25%']],
      talk: [
        { s: '你觉得月亮上有兔子吗？', o: [['说不定有呢！', 3], ['只有石头', 1], ['好幼稚', -1]] },
        { s: '训练好辛苦，我有点想放弃……', o: [['你一定能飞上太空！', 3], ['休息一下', 1], ['那就放弃吧', -1]] },
        { s: '如果你去太空，会带什么？', o: [['带上我的宠物', 3], ['带零食', 1], ['我不去', -1]] },
        { s: '从这里能看到整个星星岛哦！', o: [['好美啊！', 3], ['好高', 1], ['没意思', -1]] },
      ] },
  ];
  const npc = id => NPCS.find(x => x.id === id);
  const st = id => { const p = P(); p.bond = p.bond || {}; return p.bond[id] || (p.bond[id] = { pts: 0, met: 0, last: 0, talk: 0, known: false }); };

  // 汇总已解锁的效果（被 Home.gearFx 调用，不能反过来调用 Home.ensure）
  function fx() {
    const p = P(), out = {}; if (!p || !p.bond) return out;
    NPCS.forEach(N => { const b = p.bond[N.id]; if (!b || !b.known) return; const r = rankOf(b.pts); N.perks.forEach(([lv, k, v]) => { if (r >= lv) out[k] = (out[k] || 0) + v; }); });
    return out;
  }
  const chBonus = () => 1 + (Home.socRank(P(), 'ch') - 1) * .1;

  /* ---------- 改变好感（带等级变化演出） ---------- */
  async function change(N, d, why) {
    const b = st(N.id), r0 = rankOf(b.pts);
    if (d > 0) d = Math.round(d * chBonus());
    b.pts = Math.max(TH[r0 - 1], b.pts + d); save(); // 不会掉级
    const r1 = rankOf(b.pts);
    floatNotes(d, why);
    if (r1 > r0) { await sleep(900); await rankCard(N, r1); }
    return r1;
  }
  function floatNotes(d, why) {
    const el = h('div', 'bd-notes ' + (d >= 3 ? 'great' : d > 0 ? 'ok' : 'bad'));
    el.innerHTML = (d >= 3 ? '♪♪♪' : d > 0 ? '♪' : '……') + '<small>' + esc(why || (d > 0 ? '好感上升' : '好感下降')) + '</small>';
    document.body.appendChild(el); Audio2.sfx(d >= 3 ? 'star' : d > 0 ? 'pop' : 'wrong', .5);
    setTimeout(() => el.remove(), 1800);
  }
  // 塔罗牌升级演出
  function cardArt(N, r) {
    return '<div class="bd-card" style="--c:' + N.c + '"><div class="bc-num">' + toRoman(r) + '</div>' + E(N.ce, 'bc-ic') + '<div class="bc-name">' + N.card + '</div><div class="bc-who">' + N.n + '</div></div>';
  }
  const toRoman = n => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || n;
  function rankCard(N, r) {
    return new Promise(res => {
      const perk = N.perks.find(x => x[0] === r);
      const el = h('div', 'bd-rank'); el.innerHTML = '<div class="br-bg"></div><div class="br-in">' + cardArt(N, r) + '<div class="br-t">' + Home.ransom('RANK UP') + '</div><div class="br-l">与「' + N.n + '」的羁绊加深了！ 等级 ' + r + '</div>' + (perk ? '<div class="br-p">' + E('🔓') + ' 解锁：' + esc(perk[3]) + '</div>' : '') + '<div class="br-tap">点击继续</div></div>';
      hydrate(el); document.body.appendChild(el); Audio2.sfx('levelup', .6); UI.confetti(80); Voice.say('羁绊加深了！');
      const done = () => { el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 350); };
      el.onclick = done; setTimeout(done, 5000);
    });
  }

  /* ---------- 共度时光（P5 式对话） ---------- */
  function scene(N) {
    const el = h('div', 'bd-scene'); el.style.setProperty('--c', N.c);
    el.innerHTML = '<div class="bs-bg"></div><div class="bs-por"><img src="' + Core.emoSrc(N.ce) + '" data-av="' + N.m + '" data-style="p5" data-frame="bust" data-size="360" data-yaw="-.2"></div>' +
      '<div class="bs-card">' + cardArt(N, rankOf(st(N.id).pts)) + '</div>' +
      '<div class="bs-box"><div class="bs-name">' + N.n + '<small>' + N.card + ' · 等级 ' + rankOf(st(N.id).pts) + '</small></div><div class="bs-text"></div></div><div class="bs-opts"></div>';
    document.body.appendChild(el); hydrate(el); requestAnimationFrame(() => el.classList.add('in'));
    const text = el.querySelector('.bs-text'), opts = el.querySelector('.bs-opts');
    const api = {
      el,
      say: (t, voice) => new Promise(res => { text.textContent = ''; let i = 0; const s = String(t); const tick = () => { if (!el.isConnected) return res(); text.textContent = s.slice(0, ++i); if (i < s.length) setTimeout(tick, 30); else res(); }; tick(); if (voice !== false && Voice.has(s)) Voice.say(s); }),
      ask: list => new Promise(res => {
        opts.innerHTML = list.map((o, i) => '<button class="bs-o" data-i="' + i + '" data-key="' + (i + 1) + '" data-say="' + esc(o[0]) + '" style="--i:' + i + '">' + esc(o[0]) + '</button>').join('');
        opts.classList.add('show');
        opts.onclick = e => { const b = e.target.closest('.bs-o'); if (!b) return; opts.classList.remove('show'); Audio2.sfx('select', .4); res(+b.dataset.i); };
      }),
      tap: () => new Promise(res => { const f = () => { el.removeEventListener('click', f); res(); }; setTimeout(() => el.addEventListener('click', f), 200); setTimeout(f, 3500); }),
      close: () => new Promise(res => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 350); }),
    };
    return api;
  }
  async function meet(id) {
    const N = npc(id), p = Home.ensure(), b = st(id); if (!N) return;
    const S = scene(N);
    // 第一次见面
    if (!b.known) {
      b.known = true; b.last = day(); save();
      await S.say(N.intro); await S.tap();
      await S.say('（和「' + N.n + '」结下了羁绊。塔罗牌「' + N.card + '」……）', false); Audio2.sfx('magic', .5); await S.tap();
      await S.say('以后常来找我玩吧！每天都可以来哦。'); await S.tap();
    }
    // 太久没见：生气（惩罚）
    const gap = day() - (b.last || day());
    if (gap >= 4 && b.met) { await S.say(R.pick(['你好久没来看我了……我还以为你忘了我。', '哼，这么多天都不来找我！'])); await change(N, -2, '太久没见面，好感下降'); await S.tap(); }
    b.last = day(); save();
    const used = p.hm.met[id], gave = p.hm.gave[id];
    while (true) {
      const menu = [[used ? '今天已经一起玩过了' : '一起度过时光', 'hang'], [gave ? '今天已经送过礼物了' : '送礼物', 'gift'], ['查看羁绊', 'info'], ['再见', 'bye']];
      await S.say(R.pick(['嗨，' + p.name + '！', '今天要做什么呢？', '又见面啦！']), false);
      const k = menu[await S.ask(menu)][1];
      if (k === 'bye') break;
      if (k === 'info') { await S.close(); return panel(id); }
      if (k === 'hang') {
        if (p.hm.met[id]) { await S.say('明天再来找我玩吧！'); await S.tap(); continue; }
        p.hm.met[id] = 1; b.met = (b.met || 0) + 1; save();
        const T0 = N.talk[(b.talk || 0) % N.talk.length]; b.talk = (b.talk || 0) + 1;
        await S.say(T0.s);
        const order = R.shuffle(T0.o.map((o, i) => i)); const ch = order[await S.ask(order.map(i => T0.o[i]))], score = T0.o[ch][1];
        await S.say(score >= 3 ? R.pick(['嘿嘿，我就知道你懂我！', '说得太好了！', '和你聊天真开心！']) : score > 0 ? R.pick(['嗯嗯，也对。', '原来你是这么想的。']) : R.pick(['……是吗。', '唔，有点难过……', '你怎么能这么说！']));
        const r = await change(N, score + 1, score >= 3 ? '说到心坎上了！' : score > 0 ? '聊得还不错' : '说错话了……');
        // 共度时光也会提升人格能力
        const k2 = { lin: 'kn', hao: 'gu', yue: 'de', doc: 'kn', elf: 'ki', cap: 'gu', tie: 'de', sky: 'ch' }[id]; const g = Home.addSoc(p, k2, score > 0 ? 2 : 1);
        if (g.r1 > g.r0) Home.rankUp(k2, g.r1);
        if (score < 0 && Math.random() < .5) { await S.say('（要好好想想再回答哦。）', false); }
        void r; await S.tap();
      }
      if (k === 'gift') {
        if (p.hm.gave[id]) { await S.say('谢谢你，今天已经收到礼物啦！'); await S.tap(); continue; }
        const foods = Object.entries(p.inv.food || {}).filter(x => x[1] > 0);
        if (!foods.length) { await S.say('（背包里没有可以送的东西。去商店或者出门逛逛吧。）', false); await S.tap(); continue; }
        await S.say('（要送什么呢？）', false);
        const list = foods.slice(0, 5).map(f => [f[0] + ' ' + (Home.foodInfo(f[0])[1] || '') + ' ×' + f[1], f[0]]).concat([['还是算了', null]]);
        const pick = list[await S.ask(list)][1]; if (!pick) continue;
        p.inv.food[pick]--; p.hm.gave[id] = 1; save();
        if (N.likes.includes(pick)) { await S.say('哇！这是我最喜欢的！谢谢你！'); await change(N, 3, '收到了最喜欢的礼物！'); }
        else if (N.hates.includes(pick)) { await S.say('呃……我不太喜欢这个……'); await change(N, -2, '送了讨厌的东西……'); }
        else { await S.say('谢谢你的礼物！'); await change(N, 1, '收到了礼物'); }
        await S.tap();
      }
    }
    await S.say(R.pick(['下次见！', '拜拜～', '路上小心哦！'])); await sleep(700); await S.close();
  }

  /* ---------- 羁绊一览 ---------- */
  const SCN = { town: '星星小镇', city: '霓虹都市', forest: '萤火森林', beach: '月光海滩', tower: '影时间之塔' };
  function panel(focusId) {
    const p = P();
    const m = UI.modal('<div class="p3-mh"><b>CONFIDANT</b><span>羁绊伙伴</span></div><p class="dim">在各个探索场景里能遇到伙伴。每天和他们共度时光、送礼物能加深羁绊；说错话、送讨厌的东西、太久不见会让好感下降。</p><div class="bd-grid">' + NPCS.map(N => {
      const b = (p.bond || {})[N.id] || {}, r = rankOf(b.pts || 0), nx = TH[r] || TH[9], lo = TH[r - 1];
      if (!b.known) return '<div class="bd-item lock" style="--c:' + N.c + '"><div class="bd-card mini q">?</div><div class="bi-m"><b>？？？</b><small>在「' + SCN[N.scene] + '」能遇到</small></div></div>';
      return '<div class="bd-item' + (N.id === focusId ? ' focus' : '') + '" style="--c:' + N.c + '">' + cardArt(N, r).replace('bd-card', 'bd-card mini') + '<div class="bi-m"><b>' + N.n + ' <i>Lv.' + r + '</i></b><div class="bi-bar"><i style="width:' + (r >= 10 ? 100 : Math.round(((b.pts || 0) - lo) / (nx - lo) * 100)) + '%"></i></div>' +
        '<div class="bi-likes">喜欢 ' + N.likes.map(x => E(x)).join('') + ' · 讨厌 ' + N.hates.map(x => E(x)).join('') + '</div>' +
        '<ul>' + N.perks.map(([lv, , , d]) => '<li class="' + (r >= lv ? 'on' : '') + '"><em>' + lv + '</em>' + esc(d) + '</li>').join('') + '</ul><small>' + SCN[N.scene] + (p.hm.met && p.hm.met[N.id] ? ' · 今天见过了' : '') + '</small></div></div>';
    }).join('') + '</div>', { cls: 'wide p3m' });
    hydrate(m.el);
  }

  window.Bond = { NPCS, npc, fx, meet, panel, rankOf, st, change };
})();
