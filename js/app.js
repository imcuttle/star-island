/* 星星岛大冒险 · 主程序：角色、地图、关卡、战斗、宠物、商店、扭蛋、任务、家长 */
(function () {
  const { h, sleep, today, esc, Store, Audio2, Voice, E, vis, hydrate, UI } = Core;
  const { ZONES, GAMES } = CATALOG;
  const R = CONTENT.R;
  const app = () => $('#app');

  /* ================= 配置 ================= */
  const GRADES = ['学前班', '一年级', '二年级', '三年级', '四年级'];
  const AGES = ['5-6岁', '6-7岁', '7-8岁', '8-9岁', '9-10岁'];
  // 动漫风 3D 角色（VRoid CC0 / VRoid 官方样例 / VRoid Hub 允许再分发的模型），全部是人类角色
  // id 保持不变，老存档自动换成新形象（f-robot / f-fox 原来是机器人和小狐狸）
  const HEROES = [
    { id: 'k-green', n: '阿晨', e: '🧒', m: 'vr_hairm', t: '男孩', d: '黑色碎发，宽松白卫衣配黑长裤，安静又靠谱。' },
    { id: 'k-pink', n: '桃桃', e: '👧', m: 'vr_hairf', t: '女孩', d: '黑色双马尾戴猫耳发箍，白色蓬蓬裙，元气满满。' },
    { id: 'k-purple', n: '紫苑', e: '👧', m: 'vr_sample_b', t: '女孩', d: '紫色长发、小麦色皮肤，棒球外套配粉色短裙，酷酷的。' },
    { id: 'k-yellow', n: '樱太', e: '🧒', m: 'vr_fumiriya', t: '男孩', d: '粉色头发的阳光男孩，衬衫马甲校服，爱笑爱闹。' },
    { id: 'k-beige', n: '栗子', e: '👧', m: 'vr_vivi', t: '女孩', d: '栗色蘑菇头，绿色背带裙和小皮靴，像森林里的小精灵。' },
    { id: 'k-blue', n: '蓝心', e: '👧', m: 'vr_shino', t: '女孩', d: '深蓝长发扎发带，水手领校服，认真的班长。' },
    { id: 'f-mage', n: '星光魔法师', e: '🧙', m: 'vr_victoria', t: '魔法', d: '金色短发，粉色蓬蓬裙，配上魔法杖就能变魔术。' },
    { id: 'f-hero', n: '酷影', e: '🦸', m: 'vr_sample_c', t: '男孩', d: '黑发少年，灰色卫衣外套加工装裤，帅气的街头风。' },
    { id: 'f-ninja', n: '青空', e: '🧒', m: 'vr_male', t: '男孩', d: '青绿色短发，校服男孩，跑步最快。' },
    { id: 'f-astro', n: '星际少女', e: '🧑‍🚀', m: 'vr_vita', t: '未来', d: '银白头发戴猫耳，蓝色未来战衣，来自星星的另一边。' },
    { id: 'f-elf', n: '小雅', e: '👧', m: 'vr_sample_a', t: '女孩', d: '棕色短发，白色开衫配黑丝袜，温柔的学姐。' },
    { id: 'f-sci', n: '小澄', e: '👧', m: 'vr_shibu', t: '女孩', d: '黑色齐肩短发别发夹，校服配蝴蝶结，爱做实验。' },
    { id: 'f-robot', n: '墨言', e: '🧑‍🔬', m: 'vr_savi_doc', t: '男孩', d: '黑框眼镜配白大褂，爱拆装小机器的发明家少年。' },
    { id: 'f-fox', n: '爱丽', e: '👧', m: 'vr_sample_m', t: '女孩', d: '樱粉长发，爱丽丝风蓝白围裙裙，喜欢读童话书。' },
    { id: 'f-kungfu', n: '龙小武', e: '🧒', m: 'vr_savi_cn', t: '男孩', d: '红色盘扣唐装，会一点功夫，热心又讲义气。' }];
  // 宠物图鉴、稀有度、装备都在 js/home.js
  const PETS = Home.PETDEX;
  const SHOP = {
    food: [['🍎', '苹果', 5, 15, 3], ['🍌', '香蕉', 5, 15, 3], ['🥕', '胡萝卜', 5, 15, 2], ['🥛', '牛奶', 8, 22, 4], ['🍪', '饼干', 6, 10, 10], ['🍖', '大肉排', 12, 40, 5], ['🍰', '蛋糕', 15, 20, 18], ['🍣', '寿司', 18, 45, 8]],
    hat: [['🎀', '蝴蝶结', 30], ['🧢', '棒球帽', 40], ['👒', '草帽', 60], ['🎩', '魔术帽', 80], ['⛑️', '探险帽', 90], ['🎓', '博士帽', 120], ['👑', '王冠', 300]],
    wand: [['🪄', '魔法棒', 60, 1], ['🌟', '星光杖', 150, 2], ['⚡', '雷电杖', 260, 3], ['🌈', '彩虹杖', 400, 4]],
    cape: [['🛡️', '守护盾', 180, 1]],
    item: [['🧪', '回血药水', 20, 'potion'], ['💡', '提示卡', 15, 'hint'], ['🥚', '宠物蛋', 120, 'egg']],
    decor: [['🪀', '溜溜球', 20], ['🪴', '盆栽', 25], ['🧸', '泰迪熊', 35], ['🖼️', '挂画', 40], ['🕰️', '老座钟', 50], ['🛋️', '沙发', 60], ['🐠', '鱼缸', 80], ['🌈', '彩虹灯', 100], ['🎪', '小帐篷', 120], ['🎹', '钢琴', 140], ['🎠', '旋转木马', 160], ['🏆', '奖杯', 200], ['🚀', '火箭模型', 240], ['🏰', '城堡模型', 300]],
  };
  const STICKERS = [
    { n: '动物园', s: ['🦁', '🐯', '🐻', '🐨', '🐼', '🦒', '🦓', '🦘', '🦛', '🦏'] }, { n: '海洋馆', s: ['🐳', '🐬', '🦈', '🐙', '🦑', '🦀', '🐠', '🐡', '🦭', '🐢'] },
    { n: '恐龙谷', s: ['🦖', '🦕', '🐊', '🦎', '🐉', '🥚', '🌋', '🦴', '🪨', '🌿'] }, { n: '太空站', s: ['🚀', '🛸', '🪐', '🌍', '🌙', '☄️', '⭐', '👽', '🛰️', '🔭'] },
    { n: '美食街', s: ['🍕', '🍔', '🍟', '🍩', '🍦', '🧁', '🍭', '🍉', '🍓', '🥟'] }, { n: '交通城', s: ['🚗', '🚌', '🚓', '🚒', '🚑', '🚜', '🚂', '✈️', '🚁', '⛵'] },
    { n: '节日屋', s: ['🧧', '🏮', '🎆', '🎄', '🎃', '🎂', '🎁', '🎈', '🥮', '🎐'] }, { n: '魔法屋', s: ['🦄', '🧚', '🧜', '🔮', '🪄', '💎', '🌈', '🍀', '🧞', '👑'] }];
  const ALLSTK = STICKERS.flatMap(x => x.s);
  const RARE = ['🦄', '💎', '👑', '🐉', '🧞', '🔮'];
  const BADGES = [
    ['first', '初次冒险', '完成第一局游戏', p => p.totalGames >= 1], ['g10', '小小探险家', '完成10局游戏', p => p.totalGames >= 10], ['g50', '勤奋之星', '完成50局游戏', p => p.totalGames >= 50],
    ['g100', '百战勇士', '完成100局游戏', p => p.totalGames >= 100], ['s30', '星星收集者', '获得30颗星', p => totalStars(p) >= 30], ['s100', '星光璀璨', '获得100颗星', p => totalStars(p) >= 100],
    ['s250', '银河之子', '获得250颗星', p => totalStars(p) >= 250], ['gem1', '宝石猎人', '夺回第一颗知识宝石', p => Object.keys(p.gems).length >= 1], ['gem5', '十宝石守护者', '夺回全部10颗宝石', p => Object.keys(p.gems).length >= ZONES.length],
    ['dragon', '屠…不，感化糊涂龙', '战胜最终Boss糊涂龙', p => p.dragon], ['pet', '宠物伙伴', '孵化第一只宠物', p => p.petsOwned.length >= 1], ['pet10', '宠物大师', '宠物升到10级', p => p.pet && p.pet.lv >= 10],
    ['stk20', '贴纸达人', '收集20种贴纸', p => Object.keys(p.stickers).length >= 20], ['stk80', '贴纸博物馆', '集齐全部贴纸', p => Object.keys(p.stickers).length >= ALLSTK.length], ['lv10', '十级高手', '角色升到10级', p => p.lv >= 10],
    ['all5', '全能小学霸', '十个区域都拿到星星', p => ZONES.every(z => zoneStars(p, z.id) > 0)], ['combo8', '连对王', '一局连对8题', p => p.maxCombo >= 8], ['streak7', '坚持一周', '连续签到7天', p => (p.streak || 0) >= 7]];
  const BOSS_T = [6, 24, 54];

  /* ================= 工具 ================= */
  const P = () => Store.p;
  const save = () => Store.save();
  const totalStars = p => Object.values(p.stars).reduce((a, b) => a + b, 0);
  const zoneStars = (p, z) => GAMES.filter(g => g.zone === z).reduce((a, g) => a + (p.stars[g.id] || 0), 0);
  const xpNeed = lv => 60 + (lv - 1) * 40;
  const THEMES = [['kid', '童趣卡通', '🧸', 0], ['mid', '清新立体', '🫧', 0], ['pro', '精致3D', '💎', 0], ['paper', '纸片立体', '✂️', 120], ['sketch', '手绘涂鸦', '🖍️', 120], ['sticker', '贴纸拼贴', '🏷️', 120], ['water', '水彩绘本', '🎨', 150], ['clay', '黏土软萌', '🧸', 150], ['pixel', '像素复古', '👾', 150], ['ink', '水墨国风', '🖌️', 150], ['neon', '霓虹赛博', '🌃', 200]];
  const themeOf = p => { if (!p) return 'kid'; const t = p.settings.theme; if (t && t !== 'auto' && THEMES.some(x => x[0] === t)) return t; return p.grade <= 1 ? 'kid' : p.grade === 2 ? 'mid' : 'pro'; };
  function applyTheme() { document.body.dataset.theme = themeOf(P()); }
  const heroOf = id => HEROES.find(x => x.id === id) || HEROES[0];
  // 封面、存档卡片、选角色用预渲染好的图（tools/hero_cards.mjs）：大头照 + 挥手动图，不用为了看一眼先下载 3D 模型（每个 2-4MB）
  const heroCard = (H, kind) => 'assets/img/hero/' + H.id + (kind === 'head' ? '_head' : '') + '.webp';
  // 3D 立绘：先显示 2D 图，Avatar3D 渲染好后自动替换（跟随当前画风）
  const heroModel = p => { const H = heroOf(p && p.hero); return H.m && window.Avatar3D && Avatar3D.has(H.m) ? H.m : null; };
  function heroAvatar(H, pose, cls) {
    const m = H.m && window.Avatar3D && Avatar3D.has(H.m) ? H.m : null, frame = /head/.test(cls || '') ? 'head' : /xs/.test(cls || '') ? 'bust' : 'full', size = /big/.test(cls || '') ? 320 : /xs|head/.test(cls || '') ? 128 : 200;
    const fb = H.img ? 'assets/img/' + H.img + '_' + (pose === 'front' ? 'front' : pose || 'idle') + '.png' : Core.emoSrc(H.e);
    const pose3 = /jump|walk/.test(pose || '') ? 'wave' : pose === 'hit' ? 'hit' : 'idle';
    // 会渲染 3D 立绘时先放透明占位（带一点呼吸光），渲染好淡入；渲染失败才退回表情，避免「先黄脸再换人」的闪烁
    // 头像 / 半身（HUD 等）有预渲染的大头照：直接先显示它，3D 立绘在后台渲染（data-bg），场景不用等模型下载
    const wait = m && Avatar3D.supported() && !window.__TEST_LITE, ph = wait && frame !== 'full';
    const src = ph ? heroCard(H, 'head') : wait ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' : fb;
    return '<img class="' + (H.img ? 'hero-img' : 'emo hero-emo') + (wait && !ph ? ' av-wait' : '') + '" src="' + src + '" data-fb="' + fb + '" draggable="false"' + (ph ? ' data-bg="1"' : '') + (m ? ' data-av="' + m + '" data-pose="' + pose3 + '" data-frame="' + frame + '" data-size="' + size + '"' + (pose === 'front' ? ' data-yaw="0"' : '') : '') + '>';
  }
  // 2D 小游戏用的角色精灵：从同一个 3D 模型渲染几个姿势（侧身朝右），保证头像 / 家园 / 小游戏是同一个人
  // 后台渲染，主地图不等它；开小游戏前由 Preload.forGame 等它渲染好
  const SHOT_POSES = { idle: ['idle', .35, .9], front: ['idle', .35, 0], walk_a: ['walk', .15, .9], walk_b: ['walk', .55, .9], jump: ['jump', .55, .9], hit: ['hit', .25, .9] };
  const SHOTS = {};
  function prepHeroShots(p) {
    const H = heroOf(p && p.hero), m = heroModel(p); if (!m || !Avatar3D.supported() || window.__TEST_LITE) return Promise.resolve(null);
    const k = H.id + '|' + (p.equip.hat || '') + '|' + (p.equip.wand || ''); if (SHOTS[k]) return SHOTS[k];
    return (SHOTS[k] = Promise.all(Object.entries(SHOT_POSES).map(([n, [pose, t, yaw]]) => Avatar3D.portrait(m, { pose, t, yaw, size: 192, style: 'kid', hat: p.equip.hat, wand: p.equip.wand, bg: true }).then(u => [n, u])))
      .then(list => { const o = {}; list.forEach(([n, u]) => { if (u) o[n] = u; }); if (!o.idle) { delete SHOTS[k]; return null; } SHOTS[k].done = o; return o; })); // 模型还没加载好导致渲染失败时，下次再试，不把失败结果缓存住
  }
  // 同步取：已经渲染好就返回 dataURL，否则 null（调用方退回表情）
  function heroShot(pose) { const p = P(); if (!p) return null; const H = heroOf(p.hero), s = SHOTS[H.id + '|' + (p.equip.hat || '') + '|' + (p.equip.wand || '')]; return s && s.done ? s.done[pose] || s.done.front || null : null; }
  function heroHTML(p, pose, cls) {
    const H = heroOf(p.hero), is3 = heroModel(p);
    // 3D 模型：帽子和魔法杖直接挂在骨骼上一起渲染；2D 图仍用叠加的表情
    if (is3) return '<div class="hero h3d ' + (cls || '') + '">' + heroAvatar(H, pose, cls).replace('<img ', '<img data-hat="' + (p.equip.hat || '') + '" data-wand="' + (p.equip.wand || '') + '" ') + '</div>';
    const hat = p.equip.hat ? '<div class="hat">' + E(p.equip.hat) + '</div>' : '';
    const body = heroAvatar(H, pose, cls);
    return '<div class="hero ' + (cls || '') + '">' + hat + body + (p.equip.wand ? '<div class="wand">' + E(p.equip.wand) + '</div>' : '') + '</div>';
  }
  const petKind = id => PETS.find(x => x.id === id) || PETS[0];
  function petHTML(pet, cls) {
    if (!pet) return '';
    const K = petKind(pet.kind), st = pet.lv >= 10 ? 3 : pet.lv >= 5 ? 2 : 1;
    const body = Home.petImg(pet.kind, { cls: 'pet-img', size: /big/.test(cls || '') ? 280 : 160 });
    return '<div class="pet st' + st + ' ' + (cls || '') + '">' + (st === 3 ? '<div class="pet-aura"></div>' : '') + body + (st >= 2 ? '<div class="pet-acc">' + E(st === 3 ? '👑' : '🎀') + '</div>' : '') + '</div>';
  }
  function decayPet(p) {
    if (!p.pet) return; const now = Date.now(), hrs = (now - (p.pet.last || now)) / 3600000;
    if (hrs > 0) { p.pet.food = Math.max(0, p.pet.food - hrs * 5); p.pet.joy = Math.max(0, p.pet.joy - hrs * 4); p.pet.last = now; }
  }
  function addCoins(n, fromEl) { const p = P(); p.coins += n; save(); updateHUD(); if (fromEl && n > 0) UI.fly(fromEl, '.hud-coins', '🪙', Math.min(8, Math.ceil(n / 10))); }
  function addXP(n) {
    const p = P(); p.xp += n; let ups = 0;
    while (p.xp >= xpNeed(p.lv)) { p.xp -= xpNeed(p.lv); p.lv++; ups++; p.coins += 20; if (p.lv % 3 === 0) p.eggs++; }
    save(); updateHUD(); return ups;
  }
  function petXP(n) { const p = P(); if (!p.pet) return; p.pet.xp += n; while (p.pet.xp >= 40 + p.pet.lv * 20) { p.pet.xp -= 40 + p.pet.lv * 20; p.pet.lv++; UI.toast(E(petKind(p.pet.kind).e) + ' ' + esc(p.pet.name) + ' 升到 ' + p.pet.lv + ' 级啦！'); } }
  function checkBadges() {
    const p = P(); BADGES.forEach(b => { if (!p.badges.includes(b[0]) && b[3](p)) { p.badges.push(b[0]); setTimeout(() => { Audio2.sfx('star', .5); UI.toast('<b>🏅 获得成就：' + b[1] + '</b><br>' + b[2], 2600); }, 600); } }); save();
  }

  /* ================= 每日任务 / 签到 ================= */
  const TASKS = [
    ['zone:cn', '玩3局语文游戏', 3], ['zone:math', '玩3局数学游戏', 3], ['zone:en', '玩3局英语游戏', 3], ['zone:sci', '玩2局科学游戏', 2], ['zone:life', '玩2局生活游戏', 2],
    ['stars', '获得8颗星星', 8], ['feed', '喂宠物1次', 1], ['perfect', '拿到1次三星', 1], ['combo', '一局连对5题', 1], ['new', '尝试1个新游戏', 1], ['boss', '挑战1次Boss', 1]];
  function ensureDaily(p) {
    if (p.daily && p.daily.date === today()) return;
    const pick = R.sample(TASKS.filter(t => !t[0].startsWith('zone:')), 2).concat(R.sample(TASKS.filter(t => t[0].startsWith('zone:')), 1));
    p.daily = { date: today(), tasks: pick.map(t => ({ k: t[0], n: t[1], goal: t[2], cur: 0, claimed: false })), bonus: false };
    save();
  }
  function taskProgress(key, n) { const p = P(); ensureDaily(p); p.daily.tasks.forEach(t => { if (t.k === key && t.cur < t.goal) { t.cur = Math.min(t.goal, t.cur + (n || 1)); if (t.cur >= t.goal) setTimeout(() => UI.toast('📋 任务完成：' + t.n + '，快去领奖励！'), 900); } }); save(); updateHUD(); }

  /* ================= 屏幕切换 ================= */
  let curScreen = null, showTok = 0, showing = 0; const shownW = [];
  // 后台的 3D 立绘（HUD 头像、小游戏精灵）等场景切换完、淡入以后再开工，不和新场景抢主线程（见 Avatar3D.portrait 的 bg）
  if (window.Avatar3D) Avatar3D.bgGate = () => showing ? new Promise(r => shownW.push(r)) : Promise.resolve();
  // 切换场景：① 先停在当前画面，把新场景要用的素材全部下载好（Preload.forScene，进度框）
  //          ② 再搭建新场景，等它自己发起的加载（立绘、3D 模型、贴图）也全部完成才淡入；el.ready 在淡入时 resolve，玩法 / 计时从这之后开始
  //          ③ extra.music 在淡入时开始播放；返回的 Promise 在场景真正显示出来后 resolve（被更新的切换取代则不 resolve）
  function show(name, build, extra) {
    const tok = ++showTok; showing++;
    const fin = () => { if (--showing) return; setTimeout(() => { if (!showing) shownW.splice(0).forEach(r => r()); }, 600); };
    return new Promise(done => Preload.gate(Preload.forScene(name, extra), () => {
      if (tok !== showTok) return fin();
      if ((curScreen === 'hub' || curScreen === 'title') && window.World3D) World3D.dispose();
      Voice.stop(); Core.leave(); curScreen = name; document.documentElement.dataset.screen = name; // 安全区（刘海 / 底部横条）的底色跟着场景换
      const el = h('div', 'screen s-' + name); app().innerHTML = ''; app().appendChild(el);
      let ready; el.ready = new Promise(r => { ready = r; });
      try { build(el); hydrate(el); } catch (e) { console.error(e); }
      Preload.settle(el).then(() => {
        if (!el.isConnected) return fin(); requestAnimationFrame(() => el.classList.add('in'));
        if (extra && extra.music) Audio2.playMusic(extra.music);
        ready(el); done(el); fin();
      });
    }));
  }

  /* ================= 标题 & 角色 ================= */
  function titleScreen() {
    document.body.dataset.theme = 'kid';
    show('title', el => {
      // 封面：背景是游戏里同一座 3D 浮岛（低机位慢慢环绕），右边是自己的角色和两位伙伴；左边一块磨砂玻璃面板放标题和存档
      const profs = Object.values(Store.db.profiles);
      el.innerHTML = '<div class="title-bg"><div class="sky"></div><div class="t-world"></div><div class="t-vignette"></div><div class="t-cast"></div></div>' +
        '<div class="t-panel"><div class="t-badge">' + E('⭐') + ' 5–10 岁 · 边玩边学</div><div class="logo"><span class="l1">星星岛</span><span class="l2">大冒险</span></div>' +
        '<div class="slogan">语文 · 数学 · 英语 · 科学 · 生活</div>' +
        (profs.length ? '<div class="t-sub">选择你的冒险者</div>' : '<div class="t-sub">创造一位属于你的冒险者，出发吧！</div>') + '<div class="plist"></div>' +
        '<button class="btn big newp">' + (profs.length ? '＋ 新的冒险者' : '开始冒险') + '</button></div><div class="credit-link">素材致谢</div>';
      const list = el.querySelector('.plist');
      profs.forEach(p => {
        const c = h('button', 'pcard', '<div class="hero sm head"><img class="hero-img" src="' + heroCard(heroOf(p.hero), 'head') + '" draggable="false"></div>' + '<div class="pc-info"><div class="pc-name">' + esc(p.name) + '</div><div class="pc-meta">Lv.' + p.lv + ' · ' + GRADES[p.grade] + ' · ⭐' + totalStars(p) + '</div></div><span class="pc-go">▶</span>');
        c.onclick = () => { Store.db.cur = p.id; save(); enter(); };
        list.appendChild(c);
      });
      el.querySelector('.newp').onclick = createProfile;
      el.querySelector('.credit-link').onclick = credits;
      const startWorld = () => {
        if (!el.isConnected || !window.World3D || !World3D.supported()) return;
        World3D.init(el.querySelector('.t-world'), { zones: ZONES.map(z => z.id), theme: 'kid', gems: {}, dragon: false, zoneColors: Object.fromEntries(ZONES.map(z => [z.id, z.color])), cinematic: true });
        el.querySelector('.title-bg').classList.add('has3d');
      };
      if (document.readyState === 'complete') setTimeout(startWorld, 60); else addEventListener('load', startWorld, { once: true });
      const cur = Store.db.cur && Store.db.profiles[Store.db.cur] || profs[profs.length - 1];
      // 封面显示出来以后，后台先把主地图的素材下好（结果留在缓存里，不弹进度框），起名字、挑角色的工夫就下完了
      el.ready.then(() => { titleCast(el.querySelector('.t-cast'), cur && cur.hero); setTimeout(() => el.isConnected && Preload.forScene('hub'), 1500); });
    }, { music: 'happy' });
  }
  // 封面演员：主角站中间（有存档就是自己的角色），两位伙伴在身后两侧；用预渲染的挥手动图，不加载 3D 模型
  // 画面淡入后才开始下载，三个人错开出场，挥手也就错开了
  function titleCast(box, mine) {
    const main = HEROES.find(H => H.id === mine) || heroOf('k-pink');
    const mates = [main.id === 'k-green' ? 'k-beige' : 'k-green', main.id === 'f-astro' ? 'k-yellow' : 'f-astro'].map(heroOf);
    [[main, 0], [mates[0], 700], [mates[1], 1500]].forEach(([H, delay], i) => setTimeout(() => {
      if (!box.isConnected) return;
      const a = h('div', 't-actor a' + i), img = new Image(); img.draggable = false;
      img.onload = () => a.classList.add('in');
      img.src = heroCard(H); a.appendChild(img); box.appendChild(a);
    }, delay));
  }
  function credits() {
    UI.modal('<div class="mtitle">素材致谢</div><div class="credits">美术、音效与 3D 模型：<b>Kenney.nl</b>（CC0，含 Toy Car / Racing / Mini Characters / Blaster / Physics 等素材包）<br>物理引擎：Matter.js（MIT）<br>表情图标：<b>Twemoji</b>（CC-BY 4.0, Twitter/X & jdecked）、<b>Microsoft Fluent Emoji</b>（MIT）<br>背景音乐：OpenGameArt.org CC0 —— tinyworlds《Happy Adventure》、neonarkade《Quaint Town》、lushogames《SummerTown》《FrogTown》、controllerhead《Magic Town》、cynicmusic《Battle Theme A》《Town Theme RPG》《Crystal Cave》、Zane Little Music《Pixel Sprinter》《Detour》<br>3D 引擎：three.js（MIT）<br>字体：站酷快乐体、马善政、龙藏体、Fredoka、Gaegu、Fusion Pixel（OFL）<br>带骨骼动画的 3D 角色与宠物：<b>Quaternius</b>（CC0；魔法师、科学家两个模型为 CC-BY 3.0，作者 Quaternius，经 poly.pizza 获取）<br>动漫风 3D 角色：<b>VRoid Project（pixiv）</b>官方样例与预设模型（CC0 / VRoid 样例模型使用条款，允许改编与再分发）；<b>siroihakumai</b>「Savi China」「Savi doctor」（VRoid Hub，允许再分发与修改）；three-vrm（MIT）<br>真人动捕动作：<b>Ready Player Me Animation Library</b>（免费使用）<br>语音：Microsoft Edge 神经网络语音「晓晓 / Ava」（预生成）</div>');
  }
  function createProfile() {
    const st = { name: '', grade: 1, hero: 'k-green' };
    const m = UI.modal('<div class="mtitle">创建你的冒险者</div><div class="cp"><label>名字</label><input class="inp" maxlength="8" placeholder="输入你的名字"><label>年级</label><div class="gsel"></div><label>选择角色</label><div class="hpick"><div class="hsel"></div><div class="hprev"><div class="hp-stage"></div><div class="hp-info"></div></div></div><button class="btn big go">开始冒险！</button></div>', { cls: 'wide' });
    const gs = m.el.querySelector('.gsel'), hs = m.el.querySelector('.hsel'), hpStage = m.el.querySelector('.hp-stage'), hpInfo = m.el.querySelector('.hp-info');
    GRADES.forEach((g, i) => { const b = h('button', 'chip' + (i === st.grade ? ' on' : ''), g + '<small>' + AGES[i] + '</small>'); b.onclick = () => { st.grade = i; $$('.chip', gs).forEach(x => x.classList.remove('on')); b.classList.add('on'); document.body.dataset.theme = i <= 1 ? 'kid' : i === 2 ? 'mid' : 'pro'; }; gs.appendChild(b); });
    // 网格只放大头照；右侧是选中角色的挥手动图（只下载点到的那一张，也不等它下载完就先显示弹窗）并说明差异
    // 进游戏以后才加载选中角色的 3D 模型
    function preview(H) {
      const has3 = H.m && window.Avatar3D && Avatar3D.has(H.m);
      hpInfo.innerHTML = '<div class="hp-name">' + esc(H.n) + '<span class="hp-tag">' + esc(H.t) + '</span></div><div class="hp-desc">' + esc(H.d) + '</div>' +
        '<ul class="hp-diff"><li>3D 场景：' + (has3 ? (Avatar3D.isVRM(H.m) ? '动漫风全身 3D 模型，会走、跑、跳、跳舞、挥手、眨眼' : '全身 3D 模型，带走、跑、跳、挥手动作') : '平面形象') + '</li><li>2D 小游戏：同一个角色的立绘</li><li>帽子、魔法杖都能戴，能力和其他角色完全一样</li></ul>';
      const img = new Image(); img.className = 'hp-anim'; img.draggable = false; img.dataset.nowait = 1;
      img.onload = () => img.classList.add('in');
      img.src = heroCard(H);
      hpStage.innerHTML = ''; hpStage.appendChild(img);
    }
    HEROES.forEach(H => { const b = h('button', 'hopt' + (H.id === st.hero ? ' on' : ''), '<img class="hero-img" src="' + heroCard(H, 'head') + '" draggable="false"><span>' + H.n + '</span>'); b.onclick = () => { st.hero = H.id; $$('.hopt', hs).forEach(x => x.classList.remove('on')); b.classList.add('on'); Audio2.sfx('select', .4); preview(H); }; hs.appendChild(b); });
    preview(heroOf(st.hero));
    m.el.querySelector('.go').onclick = () => {
      const name = m.el.querySelector('.inp').value.trim();
      if (!name) { m.el.querySelector('.inp').classList.add('shake'); Voice.say('先写下你的名字吧'); return; }
      Store.newProfile(name, st.grade, st.hero); m.close(); enter(true);
    };
  }
  function enter(isNew) {
    const p = P(); applyTheme(); decayPet(p); ensureDaily(p); save(); prepHeroShots(p);
    // 主地图完全显示出来以后再弹故事 / 签到
    hub().then(() => { checkLock(); if (lockM) return; setTimeout(isNew ? story : signIn, 300); });
  }
  function story() {
    const m = UI.modal('<div class="story"><div class="st-pic">' + E('🐲', 'st-dragon') + '</div><div class="st-text">很久很久以前，星星岛上有十颗<b>知识宝石</b>，让岛上充满智慧的光芒。<br><br>可是，爱捣蛋的<b>糊涂龙</b>把宝石都偷走了，还派小怪兽守在十个区域！<br><br>勇敢的 <b>' + esc(P().name) + '</b>，快去闯关、打败守关怪兽，夺回宝石吧！</div><button class="btn big go">出发！</button></div>', { cls: 'wide' });
    Voice.say('很久很久以前，星星岛上有十颗知识宝石。可是，爱捣蛋的糊涂龙把宝石都偷走了！勇敢的小冒险家，快去闯关，夺回宝石吧！');
    m.el.querySelector('.go').onclick = () => { m.close(); Voice.stop(); signIn(); };
  }
  function signIn() {
    const p = P(); if (p.signed.includes(today())) return;
    const y = new Date(Date.now() - 864e5); const yk = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    p.streak = p.signed.includes(yk) ? (p.streak || 0) + 1 : 1;
    const reward = 10 + Math.min(p.streak, 7) * 5;
    const days = Array.from({ length: 7 }, (_, i) => '<div class="sday' + (i < Math.min(p.streak, 7) ? ' on' : '') + '">' + E(i === 6 ? '🎁' : '🪙') + '<small>第' + (i + 1) + '天</small></div>').join('');
    const m = UI.modal('<div class="mtitle">每日签到</div><div class="sdays">' + days + '</div><p class="c">已连续签到 <b>' + p.streak + '</b> 天，今天奖励 <b>' + reward + '</b> 金币' + (p.streak % 7 === 0 ? '，还有一个宠物蛋！' : '') + '</p><button class="btn big go">签到领取</button>');
    m.el.querySelector('.go').onclick = e => { p.signed.push(today()); if (p.signed.length > 60) p.signed = p.signed.slice(-60); if (p.streak % 7 === 0) p.eggs++; addCoins(reward, e.target); Audio2.sfx('coin', .6); checkBadges(); m.close(); };
  }

  /* ================= HUD ================= */
  function hudHTML() {
    return '<div class="hud"><div class="hud-me">' + '<div class="hud-av"></div><div><div class="hud-name"></div><div class="hud-lv"><span></span><div class="xpbar"><i></i></div></div></div></div>' +
      '<div class="hud-right"><div class="hud-pill hud-coins">' + E('🪙') + '<b></b></div><div class="hud-pill hud-gems">' + E('💎') + '<b></b></div><div class="hud-pill hud-stars">' + E('⭐') + '<b></b></div><button class="hud-btn hud-set" data-key="," data-tip="设置 · 声音 · 家长中心">' + E('⚙️') + '</button></div></div>';
  }
  function updateHUD() {
    const p = P(); if (!p) return;
    const av = $('.hud-av'); if (!av) return;
    av.innerHTML = heroHTML(p, 'front', 'xs'); hydrate(av); prepHeroShots(p);
    $('.hud-name').textContent = p.name; $('.hud-lv span').textContent = 'Lv.' + p.lv;
    $('.hud-lv i').style.width = (p.xp / xpNeed(p.lv) * 100) + '%';
    $('.hud-coins b').textContent = p.coins; $('.hud-gems b').textContent = Object.keys(p.gems).length + '/' + ZONES.length; $('.hud-stars b').textContent = totalStars(p);
    const dot = $('.dock .d-task'); if (dot) { ensureDaily(p); dot.classList.toggle('has-dot', p.daily.tasks.some(t => t.cur >= t.goal && !t.claimed)); }
    const eg = $('.dock .d-home'); if (eg) eg.classList.toggle('has-dot', p.eggs > 0 || (p.pet && p.pet.food < 30));
  }
  function bindHUD(el) {
    el.querySelector('.hud-set').onclick = parentGate;
    el.querySelector('.hud-me').onclick = profilePanel;
  }

  /* ================= 主地图 ================= */
  function hub() {
    applyTheme();
    return show('hub', el => {
      el.innerHTML = '<div class="world"></div>' + hudHTML() +
        '<div class="dock">' + [['home', '🏠', '家园', 'h'], ['shop', '🛒', '商店', 's'], ['gacha', '🎰', '扭蛋', 'g'], ['album', '📒', '图鉴', 'b'], ['task', '📋', '任务', 't'], ['play', '🎹', '乐园', 'p'], ['badge', '🏅', '成就', 'c']].map(d => '<button class="dbtn d-' + d[0] + '" data-d="' + d[0] + '" data-key="' + d[3] + '" data-say="' + d[2] + '">' + E(d[1]) + '<span>' + d[2] + '</span></button>').join('') + '</div>' +
        '<div class="hub-tip"></div>';
      bindHUD(el);
      el.querySelector('.dock').onclick = e => { const b = e.target.closest('.dbtn'); if (!b) return; Audio2.sfx('click', .4); ({ home: homeScreen, shop: shopScreen, gacha: gachaScreen, album: albumScreen, task: taskPanel, play: playground, badge: badgePanel })[b.dataset.d](); };
      updateHUD();
      const p = P(); const W = el.querySelector('.world');
      const labels = [{ id: 'home', html: '<div class="lb home">' + E('🏠') + '<b>我的家园</b></div>' }]
        .concat(ZONES.map(z => ({ id: z.id, html: '<div class="lb" style="--zc:' + z.color + '">' + E(z.icon) + '<b>' + z.name + '</b><small>' + E('⭐') + zoneStars(p, z.id) + (p.gems[z.id] ? ' ' + E('💎') : '') + '</small></div>' })))
        .concat([(lk => ({ id: 'dragon', html: '<div class="lb dragon' + (lk ? ' locked' : '') + '">' + E(lk ? '🔒' : '🐲') + '<b>糊涂龙城堡</b>' + (lk ? '<small>集齐' + ZONES.length + '颗宝石解锁</small>' : '<small>最终决战！</small>') + '</div>' }))(!Core.free() && Object.keys(p.gems).length < ZONES.length)]);
      if (World3D.supported()) {
        try {
          World3D.init(W, { zones: ZONES.map(z => z.id), theme: Core.theme(), gems: p.gems, dragon: p.dragon, zoneColors: Object.fromEntries(ZONES.map(z => [z.id, z.color])), onPick: pickZone });
          World3D.setLabels(labels);
        } catch (e) { console.error(e); flatMap(W, labels); }
      } else flatMap(W, labels);
      const tip = el.querySelector('.hub-tip'); tip.innerHTML = '点一点小岛开始冒险 · 拖动可以旋转'; setTimeout(() => tip.classList.add('out'), 4500);
    }, { music: 'happy' });
  }
  function flatMap(W, labels) { W.classList.add('flat'); W.innerHTML = '<div class="flatgrid">' + labels.map(l => '<div class="flatcell" data-z="' + l.id + '">' + l.html + '</div>').join('') + '</div>'; hydrate(W); W.onclick = e => { const c = e.target.closest('.flatcell'); if (c) pickZone(c.dataset.z); }; }
  function pickZone(id) {
    Audio2.sfx('select', .5);
    if (id === 'home') return homeScreen();
    if (id === 'dragon') { const p = P(); if (!Core.free() && Object.keys(p.gems).length < ZONES.length) { UI.toast('🔒 还差 ' + (ZONES.length - Object.keys(p.gems).length) + ' 颗知识宝石才能挑战糊涂龙！'); Voice.say('集齐全部知识宝石，才能挑战糊涂龙哦'); return; } return battle('dragon', 0); }
    zoneScreen(id);
  }

  /* ================= 区域 ================= */
  let zoneFilter = 'fit';
  function zoneScreen(zid) {
    const z = CATALOG.zone(zid), p = P();
    show('zone', el => {
      el.style.setProperty('--zc', z.color);
      const zs = zoneStars(p, zid);
      el.innerHTML = '<div class="zone-bg z-' + zid + '"></div><div class="ztop"><button class="back">' + E('⬅️') + '</button><div class="ztitle">' + E(z.icon) + '<div><b>' + z.name + '</b><small>' + z.sub + '</small></div></div><div class="hud-pill">' + E('⭐') + '<b>' + zs + '</b></div><div class="hud-pill hud-coins">' + E('🪙') + '<b>' + p.coins + '</b></div></div>' +
        '<div class="bossbar"></div><div class="ztabs"><button data-f="fit">适合我的</button><button data-f="big">大游戏 🎮</button><button data-f="play">动手玩 ✨</button><button data-f="all">全部 ' + GAMES.filter(g => g.zone === zid).length + ' 个</button></div><div class="levels"></div>';
      el.querySelector('.back').onclick = () => { Audio2.sfx('back', .4); hub(); };
      const bb = el.querySelector('.bossbar');
      BOSS_T.forEach((t, i) => {
        const beaten = (p.boss[zid] || 0) > i, open = Core.free() || (zs >= t && (p.boss[zid] || 0) >= i);
        const b = h('button', 'bossnode' + (beaten ? ' beaten' : '') + (open ? ' open' : ''), '<div class="bn-ico">' + bossVis(z.boss, i, 'bn') + '</div><div class="bn-t"><b>' + z.boss.name + ' ' + ['Ⅰ', 'Ⅱ', 'Ⅲ'][i] + '</b><small>' + (beaten ? '已击败 ✓' : open ? '可以挑战！' : '需要 ⭐' + t) + '</small></div>');
        b.onclick = () => { if (!open && !beaten) { UI.toast('再收集 ' + (t - zs) + ' 颗星星才能挑战！'); return; } battle(zid, i); };
        bb.appendChild(b);
      });
      const draw = () => {
        $$('.ztabs button', el).forEach(b => b.classList.toggle('on', b.dataset.f === zoneFilter));
        const lv = el.querySelector('.levels'); lv.innerHTML = '';
        let list = GAMES.filter(g => g.zone === zid);
        if (zoneFilter !== 'all') list = list.filter(g => p.grade >= g.g0 && p.grade <= g.g1);
        if (zoneFilter === 'play') list = list.filter(g => Engines.PLAY.has(g.eng) && !Engines.BIG.has(g.eng));
        if (zoneFilter === 'big') list = list.filter(g => Engines.BIG.has(g.eng));
        list.sort((a, b) => (Math.abs(a.g0 - p.grade) - Math.abs(b.g0 - p.grade)) || a.idx - b.idx);
        if (zoneFilter === 'fit') { const Bg = list.filter(g => Engines.BIG.has(g.eng)); list = list.filter(g => !Engines.BIG.has(g.eng)); const A = list.filter(g => Engines.PLAY.has(g.eng)), Bq = list.filter(g => !Engines.PLAY.has(g.eng)), mix = []; while (A.length || Bq.length) { if (A.length) mix.push(A.shift()); if (Bq.length) mix.push(Bq.shift()); } list = Bg.concat(mix); }
        list.forEach((g, k) => {
          const s = p.stars[g.id] || 0, fit = p.grade >= g.g0 && p.grade <= g.g1;
          const c = h('button', 'lvcard pop-in' + (s ? ' played' : ''), '<div class="lv-ico">' + E(g.icon) + '</div><div class="lv-name">' + g.name + '</div><div class="lv-eng">' + Engines.ENG_NAMES[g.eng] + (fit ? '' : ' · ' + (g.g0 > p.grade ? '挑战' : '复习')) + '</div><div class="lv-stars">' + [0, 1, 2].map(i => '<i class="' + (i < s ? 'on' : '') + '">★</i>').join('') + '</div>' + (!p.plays[g.id] ? '<div class="lv-new">NEW</div>' : '') + (Engines.BIG.has(g.eng) ? '<div class="lv-tag big">大游戏</div>' : Engines.PLAY.has(g.eng) ? '<div class="lv-tag">动手玩</div>' : ''));
          c.style.animationDelay = Math.min(k * 25, 600) + 'ms';
          c.onclick = () => startGame(g);
          tilt(c);
          lv.appendChild(c);
        });
        hydrate(lv);
      };
      el.querySelector('.ztabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; zoneFilter = b.dataset.f; Audio2.sfx('switch', .3); draw(); };
      draw();
    }, { music: z.music });
    Voice.say(z.name);
  }
  function tilt(el) {
    el.addEventListener('pointermove', e => { if (Core.theme() === 'kid' || e.pointerType !== 'mouse') return; const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = 'perspective(600px) rotateY(' + x * 14 + 'deg) rotateX(' + -y * 14 + 'deg) translateZ(6px)'; });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  }
  function bossVis(b, tier, cls) {
    if (Core.theme() === 'kid') return '<img class="boss-spr ' + cls + ' t' + tier + '" src="assets/img/enemy/' + b.sprite + (b.sprite.endsWith('_rest') || b.sprite.endsWith('_idle') ? '' : '') + '.png" draggable="false">';
    return E(b.e, 'boss-emo ' + cls + ' t' + tier);
  }

  /* ================= 游戏会话 ================= */
  // 出题 + 开始预加载这一局的素材
  function prepGame(g) {
    let data;
    try { data = g.eng === 'clockset' ? null : CONTENT.G[g.gen](P().grade); } catch (e) { console.error(e); UI.toast('题目加载失败'); return null; }
    return { data, job: Preload.forGame(g, data) };
  }
  function playGame(g, prep) { if (prep) Preload.gate(prep.job, () => runGame(g, prep.data)); }
  function startGame(g) {
    const p = P(), prep = prepGame(g);
    if (!prep) return;
    const intro = UI.modal('<div class="intro"><div class="in-ico">' + E(g.icon) + '</div><div class="mtitle">' + g.name + '</div><div class="in-eng">玩法：' + Engines.ENG_NAMES[g.eng] + '</div><div class="in-help">' + HELP[g.eng] + '</div>' + (Engines.BIG.has(g.eng) ? '<div class="ctrl-sel">操作方式：<button data-c="touch">' + E('👆') + ' 触屏按钮</button><button data-c="kbm">' + E('⌨️') + ' 键盘鼠标</button></div>' : '') + '<div class="in-best">最好成绩：' + [0, 1, 2].map(i => '<i class="' + (i < (p.stars[g.id] || 0) ? 'on' : '') + '">★</i>').join('') + '</div><button class="btn big go">开始！</button></div>');
    Voice.say(g.name + '。' + HELP[g.eng]);
    const cs = intro.el.querySelector('.ctrl-sel');
    if (cs) { const mark = () => $$('button', cs).forEach(b => b.classList.toggle('on', b.dataset.c === Arcade.ctrlMode())); mark(); cs.onclick = e => { const b = e.target.closest('button'); if (!b) return; p.settings.ctrl = b.dataset.c; save(); Audio2.sfx('switch', .3); mark(); }; }
    intro.el.querySelector('.go').onclick = () => { intro.close(); playGame(g, prep); };
  }
  const HELP = { catch: '左右移动篮子，接住正确答案！', quiz: '仔细看题，点出正确答案。', tf: '判断对还是错，要快哦！', bubble: '泡泡会往上飘，戳破正确的那个！', balloon: '射中写着正确答案的气球！', ufo: '瞄准正确答案的飞船，发射激光！', whack: '地鼠举着答案冒出来，敲正确的那只！', fish: '小鱼游来游去，钓起正确答案！', frog: '帮小青蛙跳到正确的荷叶上！', chest: '打开藏着宝石的宝箱！', race: '答对一题，赛车就冲一段，超过对手！', feed: '把正确答案拖给怪兽吃（也可以点一下）。', memory: '翻开卡片，找出成对的朋友。', connect: '把左右两边相配的连起来。', sort: '把东西拖进正确的篮子里。', order: '按正确的顺序依次点击。', spell: '按顺序点出字母或文字，拼成答案。', clockset: '拖动指针或按按钮，把钟拨到指定时间。' };
  Object.assign(HELP, Engines.HELP2 || {});
  function runGame(g, data) {
    const p = P(), z = CATALOG.zone(g.zone);
    show('game', el => {
      el.style.setProperty('--zc', z.color);
      el.innerHTML = '<div class="gtop"><button class="back">' + E('✖️') + '</button><div class="gtitle">' + E(g.icon) + '<b>' + g.name + '</b></div><div class="gprog"></div><div class="ghearts"></div>' + (p.inv.hint ? '<button class="hintbtn" data-key="h" data-tip="提示卡：去掉一个错误选项">' + E('💡') + '<b>' + p.inv.hint + '</b></button>' : '') + '</div><div class="stage"></div>';
      const S = new Engines.Session(g, data, p.grade, el, res => gameOver(g, res, S));
      S.stage = el.querySelector('.stage'); S.renderHearts(); S.more = () => CONTENT.G[g.gen](p.grade); window.__S = S;
      el.querySelector('.back').onclick = async () => { if (await UI.confirm('要退出这一局吗？')) { S.over = true; Voice.stop(); zoneScreen(g.zone); } };
      const hb = el.querySelector('.hintbtn');
      if (hb) hb.onclick = () => { const wrongs = $$('[data-ok="0"]:not(.hinted)', S.stage); if (!wrongs.length || !P().inv.hint) return; const w = R.pick(wrongs); w.classList.add('hinted'); P().inv.hint--; save(); hb.querySelector('b').textContent = P().inv.hint; Audio2.sfx('magic', .4); if (!P().inv.hint) hb.remove(); };
      // 画面和素材全部就绪后才开始玩法（计时 / 倒计时都在玩法里）
      el.ready.then(() => setTimeout(() => { if (!S.over && el.isConnected) Engines.ENGINES[g.eng](S, data); }, 300));
    }, { music: CATALOG.gameMusic(g) });
  }
  function gameOver(g, res, S) {
    const p = P();
    const first = !p.plays[g.id];
    p.plays[g.id] = (p.plays[g.id] || 0) + 1; p.totalGames++;
    const prev = p.stars[g.id] || 0; p.stars[g.id] = Math.max(prev, res.stars);
    const st = p.stats[g.zone] || (p.stats[g.zone] = { r: 0, w: 0, n: 0 }); st.r += res.right; st.w += Math.round(res.wrong); st.n++;
    p.maxCombo = Math.max(p.maxCombo || 0, res.maxCombo);
    res.wrongs.forEach(w => p.wrong.unshift({ t: w, g: g.name, d: today() })); p.wrong = p.wrong.slice(0, 60);
    const gfx = Home.gearFx(p);
    const coins = Math.round((res.failed ? 3 : 5 + res.stars * 5 + (res.stars > prev ? (res.stars - prev) * 5 : 0)) * (1 + gfx.magnet / 100));
    const xp = Math.round((res.failed ? 5 : 10 + res.stars * 10) * (1 + gfx.book / 100));
    const gearDrop = !res.failed && p.pet ? Home.rollDrop('game') : null;
    p.inv.food = p.inv.food || {};
    // 宠物
    if (p.pet) { petXP(res.stars * 4 + 2); p.pet.joy = Math.min(100, p.pet.joy + 3); }
    save();
    taskProgress('zone:' + g.zone); taskProgress('stars', res.stars); if (res.stars === 3) taskProgress('perfect'); if (res.maxCombo >= 5) taskProgress('combo'); if (first) taskProgress('new');
    const ups = addXP(xp);
    const bonusDrop = !res.failed && Math.random() < .12 ? R.pick(['🍎', '🍪', '🥛', '🍌']) : null;
    if (bonusDrop) { p.inv.food[bonusDrop] = (p.inv.food[bonusDrop] || 0) + 1; save(); }
    const msg = res.failed ? '别灰心，再试一次一定行！' : res.stars === 3 ? '完美通关！' : res.stars === 2 ? '很棒！再努力一点就三星啦' : '通关啦！继续加油';
    const m = UI.modal('<div class="result"><div class="r-stars">' + [0, 1, 2].map(i => '<i class="' + (i < res.stars ? 'on' : '') + '" style="animation-delay:' + (0.3 + i * .35) + 's">★</i>').join('') + '</div><div class="mtitle">' + msg + '</div>' +
      '<div class="r-stat">答对 <b>' + res.right + '</b>' + (res.wrong ? ' · 答错 <b>' + Math.round(res.wrong) + '</b>' : '') + (res.maxCombo >= 3 ? ' · 最高连对 <b>' + res.maxCombo + '</b>' : '') + '</div>' +
      '<div class="r-gain"><span>' + E('🪙') + ' +' + coins + '</span><span>' + E('✨') + ' +' + xp + ' 经验</span>' + (bonusDrop ? '<span>' + E(bonusDrop) + ' +1</span>' : '') + '</div>' +
      '<div class="r-btns"><button class="btn ghost b-back" data-key="Escape">返回</button><button class="btn b-again" data-key="r">再玩一次</button><button class="btn b-next" data-key="Enter n" data-say="下一个">下一个 ▶</button></div></div>', { noClose: true, cls: 'result-m' });
    Audio2.sfx(res.failed ? 'fail' : res.stars === 3 ? 'victory' : 'win', .6);
    if (!res.failed) { setTimeout(() => UI.confetti(res.stars * 30), 300); }
    Voice.say(msg);
    setTimeout(() => addCoins(coins, m.el.querySelector('.r-gain span')), 700);
    m.el.querySelector('.b-back').onclick = () => { m.close(); zoneScreen(g.zone); };
    m.el.querySelector('.b-again').onclick = () => { m.close(); playGame(g, prepGame(g)); };
    m.el.querySelector('.b-next').onclick = () => {
      m.close(); const list = GAMES.filter(x => x.zone === g.zone && p.grade >= x.g0 && p.grade <= x.g1);
      const next = list.find(x => !p.plays[x.id]) || list[(list.indexOf(g) + 1) % list.length] || g; startGame(next);
    };
    if (ups) setTimeout(() => levelUp(), 1500);
    if (gearDrop) setTimeout(() => Home.dropToast(gearDrop, p.pet.name), 1200);
    checkBadges();
  }
  function levelUp() {
    const p = P(); Audio2.sfx('levelup', .6); UI.confetti(80);
    UI.modal('<div class="lvup"><div class="lvup-hero">' + heroHTML(p, 'jump') + '</div><div class="mtitle">升级啦！Lv.' + p.lv + '</div><p>奖励 ' + E('🪙') + ' 20 金币' + (p.lv % 3 === 0 ? '，还有一个 ' + E('🥚') + ' 宠物蛋！' : '') + '</p><p class="dim">攻击力和智慧都提升了！</p></div>');
    Voice.say('升级啦！你现在是' + p.lv + '级');
  }

  /* ================= Boss 战斗 ================= */
  const DRAGON = { id: 'dragon', name: '糊涂龙城堡', color: '#8a5cf6', music: 'smore', boss: { name: '糊涂龙', e: '🐲', sprite: 'barnacle_attack_rest', hp: 16 } };
  const battlePool = zid => { const p = P(), isDragon = zid === 'dragon'; return GAMES.filter(g => (isDragon || g.zone === zid) && !Engines.NONQ.has(g.eng) && g.eng !== 'catch' && p.grade >= g.g0 - (isDragon ? 0 : 1) && p.grade <= g.g1); };
  // Boss 战的题目先出好一批，连同图片和语音一起预加载，打的时候不再等网络
  function battleQs(pool, n) { const out = []; for (let i = 0; i < n * 3 && out.length < n; i++) { const g = R.pick(pool); try { const q = R.pick(CONTENT.G[g.gen](P().grade)); if (q && q.ch) out.push(q); } catch (e) {} } return out; }
  function battle(zid, tier) {
    const z = zid === 'dragon' ? DRAGON : CATALOG.zone(zid), bank = battleQs(battlePool(zid), 40);
    Preload.gate(Preload.forBattle(z, z.boss.sprite, bank), () => battleRun(zid, tier, bank));
  }
  function battleRun(zid, tier, bank) {
    const p = P(); const isDragon = zid === 'dragon';
    const z = isDragon ? DRAGON : CATALOG.zone(zid);
    const maxHp = isDragon ? 16 : z.boss.hp + tier * 3;
    const wand = SHOP.wand.find(w => w[0] === p.equip.wand), gfx = Home.gearFx(p); const atk = 1 + (wand ? Math.ceil(wand[3] / 2) : 0) + gfx.sword;
    const maxHearts = 3 + (p.equip.cape ? 1 : 0) + gfx.heart;
    const pool = battlePool(zid); bank = bank || [];
    const B = { hp: maxHp, hearts: maxHearts, charge: 0, combo: 0, over: false, shield: gfx.shield, heal: gfx.potion };
    taskProgress('boss');
    show('battle', el => {
      el.style.setProperty('--zc', z.color);
      el.innerHTML = '<div class="arena a-' + z.id + '"><div class="ar-floor"></div></div><div class="btop"><button class="back">' + E('🏳️') + '</button><div class="bt-name">' + E('⚔️') + ' ' + z.boss.name + (isDragon ? '' : ' ' + ['Ⅰ', 'Ⅱ', 'Ⅲ'][tier]) + '</div></div>' +
        '<div class="fighters"><div class="f-me"><div class="hpbar me"><i></i><span></span></div><div class="f-body">' + heroHTML(p, 'idle', 'big') + '</div>' + (p.pet ? '<div class="f-pet">' + petHTML(p.pet, 'mini') + '</div>' : '') + '</div>' +
        '<div class="vs">VS</div><div class="f-boss"><div class="hpbar boss"><i></i><span></span></div><div class="f-body boss-body">' + bossVis(z.boss, tier, 'big') + '</div></div></div>' +
        '<div class="bpanel"></div><div class="bskills"><button class="sk sk-pet" data-key="z" data-tip="宠物技能（答对3题充满）" ' + (p.pet ? '' : 'disabled') + '>' + E(p.pet ? petKind(p.pet.kind).e : '🐾') + '<b>宠物技能</b><i class="chg"></i></button><button class="sk sk-pot" data-key="x" data-tip="喝药水回复2颗心">' + E('🧪') + '<b>药水 ×<span>' + (p.inv.potion || 0) + '</span></b></button></div>';
      el.querySelector('.back').onclick = async () => { if (await UI.confirm('要逃跑吗？')) { B.over = true; isDragon ? hub() : zoneScreen(zid); } };
      const upd = () => {
        el.querySelector('.hpbar.boss i').style.width = (B.hp / maxHp * 100) + '%'; el.querySelector('.hpbar.boss span').textContent = B.hp + '/' + maxHp;
        el.querySelector('.hpbar.me i').style.width = (B.hearts / maxHearts * 100) + '%'; el.querySelector('.hpbar.me span').textContent = '❤ ' + Math.max(0, B.hearts) + '/' + maxHearts;
        el.querySelector('.chg').style.width = Math.min(100, B.charge / 3 * 100) + '%'; el.querySelector('.sk-pet').classList.toggle('ready', B.charge >= 3 && !!p.pet);
        el.querySelector('.sk-pot span').textContent = p.inv.potion || 0; hydrate(el.querySelector('.hpbar.me'));
      };
      upd();
      // 实时 3D 主角 + 宠物（攻击 / 受伤 / 胜利都有骨骼动作）
      const hk = heroModel(p);
      if (hk && window.Avatar3D && Avatar3D.supported()) {
        const fb = el.querySelector('.f-me .f-body'), st3 = Avatar3D.stage(fb, { camZ: 5.4, camY: 1.2, lookY: .95, fov: 30 });
        st3.add(hk, { height: 1.6, x: p.pet ? .25 : 0, ry: .55, hat: p.equip.hat, wand: p.equip.wand }).then(av => { if (!av) return; B.av = av; const im = fb.querySelector('.hero-img, .hero-emo'); if (im) im.style.visibility = 'hidden'; });
        const pm = p.pet && Home.petModel(p.pet.kind);
        if (pm) st3.add(pm, { height: Home.dex(p.pet.kind).h * .9, x: -.75, z: .3, ry: .7 }).then(av => { if (!av) return; B.pav = av; const fp = el.querySelector('.f-pet'); if (fp) fp.style.visibility = 'hidden'; });
        fb.classList.add('has3d');
      }
      const dmgFx = (target, n, crit) => { const d = h('div', 'dmg' + (crit ? ' crit' : ''), (crit ? '暴击 ' : '') + '-' + n); target.appendChild(d); setTimeout(() => d.remove(), 1000); };
      const attack = async (n, crit, petAtk) => {
        const me = el.querySelector('.f-me .f-body'), boss = el.querySelector('.boss-body');
        me.classList.add('lunge'); Audio2.sfx('throw', .5); if (B.av) B.av.once(petAtk ? 'wave' : 'attack'); if (petAtk && B.pav) B.pav.once(B.pav.has('attack') ? 'attack' : 'jump');
        const pr = h('div', 'proj', E(petAtk ? petKind(p.pet.kind).e : (p.equip.wand || '⭐'))); el.querySelector('.fighters').appendChild(pr); hydrate(pr);
        await sleep(420); pr.remove(); me.classList.remove('lunge');
        boss.classList.remove('hit'); void boss.offsetWidth; boss.classList.add('hit'); Audio2.sfx('hit', .6); dmgFx(el.querySelector('.f-boss'), n, crit);
        const r = boss.getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top + r.height / 2, crit ? '💥' : '✨', crit ? 12 : 7);
        B.hp = Math.max(0, B.hp - n); upd(); await sleep(400);
      };
      const hurt = async () => {
        const boss = el.querySelector('.boss-body'), me = el.querySelector('.f-me .f-body');
        boss.classList.add('lunge-l'); await sleep(300); boss.classList.remove('lunge-l');
        if (B.shield > 0) { B.shield--; UI.toast(E('🛡️') + ' 守护之盾挡住了攻击！', 1200); Audio2.sfx('bump', .5); boss.classList.remove('lunge-l'); return; }
        me.classList.remove('hit'); void me.offsetWidth; me.classList.add('hit'); Audio2.sfx('hurt', .6); B.hearts--; if (B.av) B.av.once('hit');
        if (B.hearts === 1 && B.heal > 0) { B.hearts += B.heal; B.heal = 0; Audio2.sfx('magic', .5); UI.toast(E('⛲') + ' 治愈之泉回复了生命！', 1400); }
        upd();
        el.classList.remove('quake'); void el.offsetWidth; el.classList.add('quake'); await sleep(400);
      };
      el.querySelector('.sk-pet').onclick = async () => { if (B.charge < 3 || B.over || B.busy) return; B.charge = 0; B.busy = true; Voice.say(p.pet.name + '，上吧！'); await attack(atk * 2 + 1 + Home.dex(p.pet.kind).t, true, true); B.busy = false; upd(); check(); };
      el.querySelector('.sk-pot').onclick = () => { if (!p.inv.potion || B.over) return; const mx = maxHearts; if (B.hearts >= mx) { UI.toast('生命值已经满啦'); return; } p.inv.potion--; save(); B.hearts = Math.min(mx, B.hearts + 2); Audio2.sfx('magic', .5); upd(); };
      const check = () => {
        if (B.over) return true;
        if (B.hp <= 0) { B.over = true; if (B.av) B.av.play('wave'); if (B.pav) B.pav.play(B.pav.has('dance') ? 'dance' : 'jump'); setTimeout(() => battleWin(zid, tier, isDragon, z), 500); return true; }
        if (B.hearts <= 0) { B.over = true; if (B.av) B.av.play('die', { once: true }); setTimeout(() => battleLose(zid, isDragon, z), 500); return true; }
        return false;
      };
      const ask = () => {
        if (check()) return;
        const q = bank.shift() || battleQs(pool, 1)[0]; if (!q) return;
        const bp = el.querySelector('.bpanel'); bp.innerHTML = '';
        const QP = Engines.qPanel(q); bp.appendChild(QP.el);
        const grid = h('div', 'choices n' + q.ch.length + ' compact'); bp.appendChild(grid);
        let done = false;
        q.ch.forEach(c => { const b = h('button', 'choice pop-in', Engines.choiceHTML(c, q.latinCh)); b.dataset.ok = c.ok ? 1 : 0; b.onclick = async () => {
          if (done || B.busy) return; done = true; B.busy = true;
          if (c.ok) { b.classList.add('good'); B.combo++; B.charge++; const crit = B.combo >= 3 && B.combo % 3 === 0; Audio2.sfx('right', .4); await attack(atk + (crit ? 1 : 0), crit); }
          else { b.classList.add('bad', 'shake'); grid.children[q.ch.findIndex(x => x.ok)].classList.add('reveal'); B.combo = 0; if (c.s) Voice.say(c.s, c.l); await sleep(500); await hurt(); if (q.ex) await Voice.say(q.ex); }
          B.busy = false; upd(); setTimeout(ask, 300);
        }; grid.appendChild(b); });
        hydrate(bp); QP.speak();
      };
      // 场景素材全部就绪、画面揭开以后才开场
      el.ready.then(() => Voice.say(isDragon ? '糊涂龙出现了！用你的智慧打败它！' : z.boss.name + '出现了！答对题目就能攻击它！')).then(() => setTimeout(ask, 200));
    }, { music: 'battle' });
  }
  function battleWin(zid, tier, isDragon, z) {
    const p = P(); let rewards = [];
    let coins = isDragon ? 300 : 60 + tier * 40;
    if (isDragon) { if (!p.dragon) { p.dragon = true; if (!p.petsOwned.includes('dragon')) p.petsOwned.push('dragon'); if (!p.owned.includes('hat:👑')) p.owned.push('hat:👑'); rewards.push(E('🐲') + ' 小龙宠物', E('👑') + ' 王冠'); } }
    else {
      const prev = p.boss[zid] || 0;
      if (prev <= tier) { p.boss[zid] = tier + 1; if (tier === 0) { p.gems[zid] = true; p.eggs++; rewards.push(E('💎') + ' 知识宝石', E('🥚') + ' 宠物蛋'); } if (tier === 1) { const hat = R.pick(SHOP.hat.slice(0, 6).filter(x => !p.owned.includes('hat:' + x[0]))) || SHOP.hat[0]; p.owned.push('hat:' + hat[0]); rewards.push(E(hat[0]) + ' ' + hat[1]); } if (tier === 2) { p.inv.potion = (p.inv.potion || 0) + 3; rewards.push(E('🧪') + ' 药水×3'); } }
      else coins = 20;
    }
    save(); addXP(isDragon ? 200 : 40 + tier * 30); if (p.pet) petXP(15);
    const gearDrop = p.pet ? Home.rollDrop('boss') : null; if (gearDrop) setTimeout(() => Home.dropToast(gearDrop, p.pet.name), 1400);
    Audio2.sfx('victory', .7); UI.confetti(120);
    const text = isDragon ? '你用智慧感化了糊涂龙！它把所有宝石还给了星星岛，还想和你做朋友！' : '打败了' + z.boss.name + '！';
    const m = UI.modal('<div class="result"><div class="r-boss">' + bossVis(z.boss, tier, 'defeated') + '</div><div class="mtitle">胜利！</div><p>' + text + '</p><div class="r-gain"><span>' + E('🪙') + ' +' + coins + '</span>' + rewards.map(r => '<span>' + r + '</span>').join('') + '</div><button class="btn big go">太好了！</button></div>', { noClose: true });
    Voice.say('胜利！' + text);
    setTimeout(() => addCoins(coins, m.el.querySelector('.r-gain span')), 600);
    m.el.querySelector('.go').onclick = () => { m.close(); checkBadges(); if (isDragon) ending(); else if (tier === 0) gemCeremony(zid); else zoneScreen(zid); };
  }
  function gemCeremony(zid) {
    const p = P(), n = Object.keys(p.gems).length, z = CATALOG.zone(zid);
    const m = UI.modal('<div class="gemc"><div class="gem-big" style="--zc:' + z.color + '">' + E('💎') + '</div><div class="mtitle">夺回了「' + z.name + '」的知识宝石！</div><p>已收集 ' + n + ' / ' + ZONES.length + ' 颗' + (n === ZONES.length ? '，糊涂龙城堡已经打开！' : '') + '</p><button class="btn big go">回到地图</button></div>', { noClose: true });
    Audio2.sfx('star', .6); Voice.say(n === ZONES.length ? '宝石全部集齐！糊涂龙城堡打开了！' : '夺回了知识宝石！还差' + (ZONES.length - n) + '颗');
    m.el.querySelector('.go').onclick = () => { m.close(); hub(); };
  }
  function ending() {
    UI.confetti(200);
    const m = UI.modal('<div class="story"><div class="st-pic">' + E('🐲', 'st-dragon') + E('💎') + E('🌟') + '</div><div class="st-text">星星岛重新闪耀起智慧的光芒！<br><br>原来糊涂龙只是因为不爱学习，才变得糊里糊涂。和你一起冒险后，它决定每天都认真学习。<br><br>恭喜你成为<b>星星岛守护者</b>！你还可以继续挑战所有关卡，收集全部星星和贴纸哦！</div><button class="btn big go">继续冒险</button></div>', { cls: 'wide', noClose: true });
    Voice.say('星星岛重新闪耀起智慧的光芒！恭喜你成为星星岛守护者！');
    m.el.querySelector('.go').onclick = () => { m.close(); hub(); };
  }
  function battleLose(zid, isDragon, z) {
    addCoins(5);
    const m = UI.modal('<div class="result"><div class="mtitle">差一点点！</div><p>多玩几局' + (isDragon ? '' : z.name) + '的游戏，变得更强再来挑战吧！<br>小提示：商店里的魔法杖能提高攻击力，药水能回血哦。</p><div class="r-btns"><button class="btn ghost b1" data-key="Escape">回去练习</button><button class="btn b2" data-key="Enter r">再挑战</button></div></div>', { noClose: true });
    Audio2.sfx('fail', .6); Voice.say('差一点点！再练练，一定能打败它！');
    m.el.querySelector('.b1').onclick = () => { m.close(); isDragon ? hub() : zoneScreen(zid); };
    m.el.querySelector('.b2').onclick = () => { m.close(); battle(zid, isDragon ? 0 : (P().boss[zid] || 0)); };
  }

  /* ================= 家园 & 宠物 ================= */
  function homeScreen() { return Home.open(); }
  /* ================= 商店 ================= */
  let shopTab = 'food';
  function shopScreen() {
    const p = P();
    show('shop', el => {
      el.innerHTML = '<div class="shop-bg"></div><div class="ztop"><button class="back">' + E('⬅️') + '</button><div class="ztitle">' + E('🛒') + '<div><b>星星商店</b><small>用金币换好东西</small></div></div><div class="hud-pill hud-coins">' + E('🪙') + '<b>' + p.coins + '</b></div></div>' +
        '<div class="ztabs">' + [['food', '宠物食物'], ['item', '道具'], ['style', '画风'], ['hat', '帽子'], ['wand', '魔法杖'], ['cape', '护盾'], ['decor', '家具']].map(t => '<button data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '</div><div class="goods"></div>';
      el.querySelector('.back').onclick = () => hub();
      const draw = () => {
        $$('.ztabs button', el).forEach(b => b.classList.toggle('on', b.dataset.t === shopTab));
        const g = el.querySelector('.goods'); g.innerHTML = '';
        if (shopTab === 'style') {
          THEMES.forEach(t => {
            const own = !t[3] || p.owned.includes('style:' + t[0]), on = themeOf(p) === t[0];
            const c = h('div', 'good style-card pop-in' + (on ? ' owned' : ''), '<div class="style-prev sp-' + t[0] + '">' + E(t[2]) + '<i></i><i></i><i></i></div><div class="g-n">' + t[1] + '</div><div class="g-d">' + ({ kid: '明亮卡通，适合小小朋友', mid: '清新通透的立体风', pro: '暗色玻璃质感的3D风', paper: '一层层叠起来的纸片立体风', sketch: '蜡笔铅笔手绘的涂鸦本', sticker: '白边闪亮的贴纸拼贴', water: '晕染柔和的水彩绘本', clay: '软乎乎的黏土玩具风', pixel: '8-bit 复古游戏机风', ink: '宣纸水墨的中国风', neon: '夜色霓虹的科幻风' })[t[0]] + '</div><button class="btn sm buy">' + (on ? '使用中' : own ? '换上' : E('🪙') + t[3]) + '</button>');
            c.querySelector('.buy').onclick = () => {
              if (on) return;
              if (!own) { if (p.coins < t[3]) { Audio2.sfx('wrong', .4); UI.toast('金币不够哦，去玩游戏赚金币吧！'); return; } p.coins -= t[3]; p.owned.push('style:' + t[0]); Audio2.sfx('coin', .6); }
              p.settings.theme = t[0]; save(); applyTheme(); Audio2.sfx('magic', .5); UI.toast('画风换成「' + t[1] + '」啦！'); shopScreen();
            };
            g.appendChild(c);
          });
          hydrate(g); return;
        }
        SHOP[shopTab].forEach(it => {
          const [e, n, price] = it; const key = shopTab + ':' + e;
          const owned = ['hat', 'wand', 'cape'].includes(shopTab) && p.owned.includes(key);
          const placed = shopTab === 'decor' && p.room.includes(e);
          const have = shopTab === 'food' ? (p.inv.food[e] || 0) : shopTab === 'item' ? (it[3] === 'egg' ? p.eggs : p.inv[it[3]] || 0) : null;
          const desc = shopTab === 'food' ? '饱食+' + it[3] + ' 心情+' + it[4] : shopTab === 'wand' ? 'Boss战攻击力提升' : shopTab === 'cape' ? '每局多一颗心' : shopTab === 'item' ? ({ potion: 'Boss战中回复2颗心', hint: '游戏中去掉一个错误选项', egg: '孵出一只新宠物' })[it[3]] : shopTab === 'decor' ? '摆进你的小屋' : '戴在头上超好看';
          const c = h('div', 'good pop-in' + (owned || placed ? ' owned' : ''), '<div class="g-ico">' + E(e) + '</div><div class="g-n">' + n + '</div><div class="g-d">' + desc + '</div>' + (have != null ? '<div class="g-have">拥有 ' + have + '</div>' : '') + '<button class="btn sm buy">' + (owned || placed ? '已拥有' : E('🪙') + price) + '</button>');
          tilt(c);
          c.querySelector('.buy').onclick = (ev) => {
            if (owned || placed) return;
            if (p.coins < price) { Audio2.sfx('wrong', .4); UI.toast('金币不够哦，去玩游戏赚金币吧！'); return; }
            p.coins -= price;
            if (shopTab === 'food') p.inv.food[e] = (p.inv.food[e] || 0) + 1;
            else if (shopTab === 'item') { if (it[3] === 'egg') p.eggs++; else p.inv[it[3]] = (p.inv[it[3]] || 0) + 1; }
            else if (shopTab === 'decor') { p.room.push(e); }
            else { p.owned.push(key); p.equip[shopTab] = e; }
            save(); Audio2.sfx('coin', .6); const r = ev.target.getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top, '✨', 8); UI.toast('买到了 ' + E(e) + ' ' + n + '！');
            el.querySelector('.hud-coins b').textContent = p.coins; draw();
          };
          g.appendChild(c);
        });
        hydrate(g);
      };
      el.querySelector('.ztabs').onclick = e => { const b = e.target.closest('button'); if (b) { shopTab = b.dataset.t; Audio2.sfx('switch', .3); draw(); } };
      draw();
    }, { music: 'town' });
  }

  /* ================= 扭蛋 & 图鉴 ================= */
  /* 扭蛋：投币 → 转把手 → 扭蛋滚出 → 点三下敲开（中途可能「变色升级」）→ 按稀有度分级开奖 → 随机加送惊喜
     稀有度：普通 / 稀有（RARE 里的贴纸）/ 闪光（任意贴纸 8%）/ 传说（稀有 + 闪光）；连续 9 次没出好东西，第 10 次必出稀有 */
  const GTIER = [
    { n: '普通', c1: '#4fc3ff', c2: '#e8f7ff', ray: 'rgba(120,200,255,.55)', sfx: 'star' },
    { n: '稀有', c1: '#b26bff', c2: '#f3e8ff', ray: 'rgba(190,120,255,.7)', sfx: 'gem' },
    { n: '闪光', c1: '#ffc83d', c2: '#fff6d6', ray: 'rgba(255,210,80,.8)', sfx: 'gem' },
    { n: '传说', c1: 'conic-gradient(from 0deg, #ff5d73, #ffd23f, #7bd389, #3ec1d3, #a78bfa, #ff5d73)', c2: '#fff', ray: 'rgba(255,255,255,.85)', sfx: 'victory', rainbow: true }];
  function gachaRoll(p) {
    p.gpity = p.gpity || 0; p.shiny = p.shiny || {};
    let s = R.pick(ALLSTK); if (RARE.includes(s) && Math.random() < .5) s = R.pick(ALLSTK);
    if (p.gpity >= 9 && !RARE.includes(s)) s = R.pick(RARE); // 保底
    const shiny = Math.random() < .08, rare = RARE.includes(s);
    const tier = rare && shiny ? 3 : shiny ? 2 : rare ? 1 : 0;
    p.gpity = tier ? 0 : p.gpity + 1;
    const r = Math.random(), bonus = r < .03 ? 'egg' : r < .1 ? 'coins' : r < .18 ? 'double' : null;
    return { s, tier, shiny, bonus };
  }
  function gachaScreen() {
    const p = P(), cost = 20;
    show('gacha', el => {
      // 扭蛋在球罩底部堆成一堆（四排，越往上越少）
      const ROWS = [[5, 74], [4, 56], [4, 38], [3, 22]];
      const balls = ROWS.flatMap(([n, top], r) => Array.from({ length: n }, (_, k) => [6 + (r % 2) * 9 + k * (88 - (r % 2) * 18) / n + Math.random() * 4, top + Math.random() * 5])).map(([l, t], i) => '<i style="--i:' + i + ';--h:' + (i * 47 % 360) + ';left:' + l.toFixed(1) + '%;top:' + t.toFixed(1) + '%"></i>').join('');
      el.innerHTML = '<div class="shop-bg g"></div><div class="g-stars"></div><div class="ztop"><button class="back">' + E('⬅️') + '</button><div class="ztitle">' + E('🎰') + '<div><b>贴纸扭蛋机</b><small>' + ALLSTK.length + ' 种贴纸等你收集</small></div></div><div class="hud-pill hud-coins">' + E('🪙') + '<b>' + p.coins + '</b></div></div>' +
        '<div class="gacha"><div class="machine"><div class="m-crown">' + E('⭐') + '</div><div class="globe"><div class="g-gloss"></div>' + balls + '</div>' +
        '<div class="mbody"><div class="m-label">星星扭蛋</div><div class="coin-slot"><i></i></div><div class="knob"><b></b></div><div class="chute"><div class="chute-ball"></div></div><div class="m-lights">' + '<i></i>'.repeat(7) + '</div></div><div class="m-foot"></div></div>' +
        '<div class="g-side"><div class="g-count">已收集 <b>' + Object.keys(p.stickers).length + '</b> / ' + ALLSTK.length + '</div>' +
        '<div class="g-pity"><div class="gp-t">幸运能量 <small></small></div><div class="gp-bar"><i></i></div></div>' +
        '<div class="g-odds"><span class="t0">普通</span><span class="t1">稀有</span><span class="t2">闪光</span><span class="t3">传说</span></div>' +
        '<button class="btn big spin">' + E('🪙') + ' ' + cost + ' 扭一次</button><button class="btn ghost toal">打开图鉴 ' + E('📒') + '</button></div></div>';
      hydrate(el);
      const mc = el.querySelector('.machine'), spinBtn = el.querySelector('.spin');
      const drawPity = () => { const n = p.gpity || 0; el.querySelector('.gp-bar i').style.width = (n / 9 * 100) + '%'; el.querySelector('.gp-t small').textContent = n >= 9 ? '满了！下一次必出稀有' : '再扭 ' + (10 - n) + ' 次必出稀有'; el.querySelector('.g-pity').classList.toggle('full', n >= 9); };
      drawPity();
      el.querySelector('.back').onclick = () => hub();
      el.querySelector('.toal').onclick = albumScreen;
      let busy = false;
      const spin = async () => {
        if (busy) return;
        if (p.coins < cost) { UI.toast('金币不够哦！去闯关赚金币吧'); Audio2.sfx('wrong', .4); return; }
        busy = true; spinBtn.disabled = true;
        p.coins -= cost; save(); updateHUD(); el.querySelector('.hud-coins b').textContent = p.coins;
        const res = gachaRoll(p); save();
        // 1) 投币 2) 转把手 + 扭蛋翻滚 3) 从出口滚出来
        mc.classList.add('coin'); Audio2.sfx('coin', .5); await sleep(450);
        mc.classList.add('shaking'); Audio2.sfx('whoosh', .5); setTimeout(() => Audio2.sfx('tick', .5), 300); setTimeout(() => Audio2.sfx('tick', .5), 650);
        if (res.tier >= 2) mc.classList.add('glow'); // 机器自己先激动起来：好东西的预兆
        await sleep(1300); mc.classList.remove('shaking', 'coin');
        mc.classList.add('drop'); Audio2.sfx('drop', .55); await sleep(550); mc.classList.remove('drop', 'glow');
        await gachaOpen(res, mc.querySelector('.chute'));
        drawPity(); el.querySelector('.g-count b').textContent = Object.keys(p.stickers).length; el.querySelector('.hud-coins b').textContent = p.coins;
        busy = false; spinBtn.disabled = false;
      };
      spinBtn.onclick = spin;
      el.querySelector('.knob').onclick = spin;
      gachaScreen.again = spin;
    });
  }
  // 开扭蛋的全屏演出
  function gachaOpen(res, fromEl) {
    const p = P(), T = GTIER[res.tier], set = STICKERS.find(x => x.s.includes(res.s));
    // 好东西有一半概率「伪装」成普通扭蛋，敲到第二下才变色 —— 惊喜
    const disguise = res.tier > 0 && Math.random() < .55, show0 = disguise ? GTIER[0] : T;
    const ov = h('div', 'gx t' + res.tier, '<div class="gx-dim"></div><div class="gx-rays"></div><div class="gx-flash"></div>' +
      '<div class="gx-cap"><div class="gx-top"></div><div class="gx-bot"></div><div class="gx-band"></div><div class="gx-crack c1"></div><div class="gx-crack c2"></div><div class="gx-gloss"></div></div>' +
      '<div class="gx-hint">点一点，敲开扭蛋！<small>（还要 3 下）</small></div><div class="gx-prize"></div>');
    const cap = ov.querySelector('.gx-cap'), hint = ov.querySelector('.gx-hint');
    const paint = t => { cap.style.setProperty('--c1', t.c1); cap.style.setProperty('--c2', t.c2); cap.classList.toggle('rainbow', !!t.rainbow); };
    paint(show0);
    if (fromEl) { const r = fromEl.getBoundingClientRect(); cap.style.setProperty('--fx', (r.left + r.width / 2 - innerWidth / 2) + 'px'); cap.style.setProperty('--fy', (r.top + r.height / 2 - innerHeight / 2) + 'px'); }
    $('#fx').appendChild(ov); hydrate(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    return new Promise(done => {
      let taps = 0, opened = false, auto = setTimeout(() => open(), 7000);
      const capCenter = () => { const r = cap.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
      ov.addEventListener('pointerdown', e => {
        if (opened || e.target.closest('.gx-prize')) return;
        taps++; clearTimeout(auto); auto = setTimeout(() => open(), 5000);
        cap.classList.remove('wob'); void cap.offsetWidth; cap.classList.add('wob'); cap.dataset.c = taps;
        const [x, y] = capCenter(); UI.burst(x, y, taps === 1 ? '✨' : '⭐', 4 + taps * 3); Audio2.sfx(taps < 3 ? 'pop' : 'pluck', .4 + taps * .1);
        if (taps === 2 && disguise) { // 变色升级！
          ov.classList.add('upflash'); setTimeout(() => ov.classList.remove('upflash'), 500);
          paint(T); Audio2.sfx('magic', .7); hint.innerHTML = '咦？！它在变色！<small>' + T.n + '扭蛋！再敲一下！</small>'; Voice.say('咦？它在变色！');
          return;
        }
        if (taps >= 3) return open();
        hint.innerHTML = (taps === 1 ? '咔！裂开一点了' : '快开了快开了！') + '<small>（还要 ' + (3 - taps) + ' 下）</small>';
      });
      async function open() {
        if (opened) return; opened = true; clearTimeout(auto);
        if (disguise && taps < 2) paint(T);
        const isNew = !p.stickers[res.s], shinyNew = res.shiny && !p.shiny[res.s];
        p.stickers[res.s] = (p.stickers[res.s] || 0) + 1; if (res.shiny) p.shiny[res.s] = 1; save();
        ov.classList.add('open'); hint.remove();
        const [x, y] = capCenter();
        Audio2.sfx('hatch', .6); Audio2.sfx(T.sfx, .7); if (res.tier) setTimeout(() => Audio2.sfx('magic', .5), 250);
        UI.confetti([40, 90, 120, 180][res.tier], x, y); UI.burst(x, y, res.tier >= 2 ? '🌟' : '⭐', 10 + res.tier * 6);
        if (res.tier >= 2) setTimeout(() => UI.confetti(80, innerWidth * .2, innerHeight * .2), 400), setTimeout(() => UI.confetti(80, innerWidth * .8, innerHeight * .2), 700);
        const dupCoins = isNew || shinyNew ? 0 : 5 + res.tier * 10;
        const title = res.tier === 3 ? '传说贴纸！！' : res.tier === 2 ? (shinyNew ? '闪闪发光的贴纸！' : '闪光贴纸！') : isNew ? (res.tier ? '稀有新贴纸！' : '新贴纸！') : '又见面啦';
        const pz = ov.querySelector('.gx-prize');
        pz.innerHTML = '<div class="gz-stk' + (res.shiny ? ' shiny' : '') + '">' + E(res.s) + ((isNew || shinyNew) ? '<span class="gz-new">NEW</span>' : '') + '</div>' +
          '<div class="gz-tier">' + '★'.repeat(res.tier + 1) + ' ' + T.n + '</div><div class="gz-title">' + title + '</div><div class="gz-sub">' + set.n + '系列' + (dupCoins ? ' · 重复的变成 <b>' + dupCoins + '</b> 金币' : '') + '</div><div class="gz-bonus"></div>' +
          '<div class="gz-btns"><button class="btn ghost gz-ok" data-key="Escape">收下</button><button class="btn gz-again" data-key="Enter">' + E('🪙') + ' 再扭一次</button></div>';
        hydrate(pz);
        Voice.say(res.tier === 3 ? '哇！传说贴纸！太幸运啦！' : res.tier === 2 ? '哇！闪光贴纸！' : res.tier === 1 ? '是稀有贴纸！' : isNew ? '新贴纸！' : '又见面啦');
        if (dupCoins) addCoins(dupCoins, pz.querySelector('.gz-sub'));
        // 加送惊喜
        if (res.bonus) {
          await sleep(1100); if (!ov.isConnected) return;
          const bz = pz.querySelector('.gz-bonus'); let html = '';
          if (res.bonus === 'egg') { p.eggs = (p.eggs || 0) + 1; save(); html = E('🥚') + ' 扭蛋里还藏着一个<b>宠物蛋</b>！'; }
          else if (res.bonus === 'coins') { html = E('🪙') + ' 金币雨！<b>+30</b>'; addCoins(30, bz); UI.burst(innerWidth / 2, innerHeight / 2, '🪙', 16); }
          else { const s2 = R.pick(ALLSTK.filter(x => !RARE.includes(x))); const n2 = !p.stickers[s2]; p.stickers[s2] = (p.stickers[s2] || 0) + 1; save(); html = E('🎁') + ' 双黄蛋！还送了 ' + E(s2) + (n2 ? ' <b>NEW</b>' : ''); }
          bz.innerHTML = '<div class="gzb-in"><b class="gzb-t">惊喜加送</b>' + html + '</div>'; hydrate(bz); Audio2.sfx('magic', .6); UI.confetti(40);
        }
        checkBadges();
        const close = () => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 300); done(); };
        pz.querySelector('.gz-ok').onclick = close;
        const ag = pz.querySelector('.gz-again'); if (P().coins < 20) ag.disabled = true;
        ag.onclick = () => { close(); setTimeout(() => gachaScreen.again && gachaScreen.again(), 350); };
      }
    });
  }
  function albumScreen() {
    const p = P();
    show('album', el => {
      el.innerHTML = '<div class="shop-bg a"></div><div class="ztop"><button class="back">' + E('⬅️') + '</button><div class="ztitle">' + E('📒') + '<div><b>贴纸图鉴</b><small>' + Object.keys(p.stickers).length + ' / ' + ALLSTK.length + '</small></div></div><button class="btn sm toga">去扭蛋 ' + E('🎰') + '</button></div><div class="album"></div>';
      el.querySelector('.back').onclick = () => hub(); el.querySelector('.toga').onclick = gachaScreen;
      const al = el.querySelector('.album');
      STICKERS.forEach(set => {
        const got = set.s.filter(s => p.stickers[s]).length;
        const pg = h('div', 'apage', '<div class="ap-h"><b>' + set.n + '</b><small>' + got + '/' + set.s.length + (got === set.s.length ? ' ' + E('🏆') : '') + '</small></div><div class="ap-g">' + set.s.map(s => '<div class="stk' + (p.stickers[s] ? '' : ' miss') + (p.shiny && p.shiny[s] ? ' shiny' : '') + '" data-s="' + s + '">' + E(s) + (p.stickers[s] > 1 ? '<b>×' + p.stickers[s] + '</b>' : '') + '</div>').join('') + '</div>');
        al.appendChild(pg);
      });
      hydrate(al);
      al.onclick = e => { const s = e.target.closest('.stk'); if (s && !s.classList.contains('miss')) { Audio2.sfx('pop', .4); s.classList.remove('boing'); void s.offsetWidth; s.classList.add('boing'); } };
    });
  }

  /* ================= 任务 / 成就 / 档案 ================= */
  function taskPanel() {
    const p = P(); ensureDaily(p);
    const draw = (m) => {
      const allDone = p.daily.tasks.every(t => t.claimed);
      m.el.innerHTML = '<div class="mtitle">' + E('📋') + ' 今日任务</div><div class="tasks">' + p.daily.tasks.map((t, i) => '<div class="task' + (t.claimed ? ' claimed' : t.cur >= t.goal ? ' ready' : '') + '"><div class="tk-n">' + t.n + '</div><div class="tk-bar"><i style="width:' + (t.cur / t.goal * 100) + '%"></i><span>' + t.cur + '/' + t.goal + '</span></div><button class="btn sm" data-i="' + i + '">' + (t.claimed ? '已领取' : t.cur >= t.goal ? E('🪙') + '20 领取' : '进行中') + '</button></div>').join('') + '</div>' +
        '<div class="tk-bonus' + (allDone ? ' ready' : '') + '">' + E('🎁') + ' 全部完成额外奖励：50金币 + 提示卡 <button class="btn sm bonus" ' + (allDone && !p.daily.bonus ? '' : 'disabled') + '>' + (p.daily.bonus ? '已领取' : '领取') + '</button></div><p class="dim c">每天都会刷新新任务哦</p>';
      hydrate(m.el);
      $$('button[data-i]', m.el).forEach(b => b.onclick = ev => { const t = p.daily.tasks[+b.dataset.i]; if (t.claimed || t.cur < t.goal) return; t.claimed = true; addCoins(20, ev.target); Audio2.sfx('coin', .6); draw(m); });
      const bb = m.el.querySelector('.bonus'); bb.onclick = ev => { if (p.daily.bonus || !allDone) return; p.daily.bonus = true; p.inv.hint = (p.inv.hint || 0) + 1; addCoins(50, ev.target); UI.confetti(60); draw(m); };
      const x = h('button', 'mclose', '✕'); x.onclick = () => m.close(); m.el.appendChild(x);
    };
    const m = UI.modal('', { cls: 'wide' }); draw(m);
  }
  function badgePanel() {
    const p = P();
    UI.modal('<div class="mtitle">' + E('🏅') + ' 成就勋章 <small>' + p.badges.length + '/' + BADGES.length + '</small></div><div class="badges">' + BADGES.map((b, i) => '<div class="badge' + (p.badges.includes(b[0]) ? ' on' : '') + '"><img src="assets/img/medal/flatshadow_medal' + (i % 9 + 1) + '.png"><b>' + b[1] + '</b><small>' + b[2] + '</small></div>').join('') + '</div>', { cls: 'wide' });
  }
  function profilePanel() {
    const p = P();
    const rows = ZONES.map(z => { const s = p.stats[z.id] || { r: 0, w: 0, n: 0 }, acc = s.r + s.w ? Math.round(s.r / (s.r + s.w) * 100) : 0, all = GAMES.filter(g => g.zone === z.id).length * 3; return '<div class="prow"><span>' + E(z.icon) + z.name + '</span><div class="pbar"><i style="width:' + (zoneStars(p, z.id) / all * 100) + '%;background:' + z.color + '"></i></div><small>⭐' + zoneStars(p, z.id) + '/' + all + ' · 正确率' + acc + '%</small></div>'; }).join('');
    const m = UI.modal('<div class="prof"><div class="prof-hero">' + heroHTML(p, 'front', 'big') + '</div><div><div class="mtitle">' + esc(p.name) + ' <small>Lv.' + p.lv + ' · ' + GRADES[p.grade] + '</small></div><div class="dim">已玩 ' + p.totalGames + ' 局 · 星星 ' + totalStars(p) + ' · 宝石 ' + Object.keys(p.gems).length + '/' + ZONES.length + '</div></div></div>' + rows +
      '<div class="r-btns"><button class="btn ghost wb">' + E('📕') + ' 错题本</button><button class="btn ghost sw">切换角色</button></div>', { cls: 'wide' });
    m.el.querySelector('.sw').onclick = () => { m.close(); Audio2.stopMusic(); titleScreen(); };
    m.el.querySelector('.wb').onclick = () => { m.close(); UI.modal('<div class="mtitle">' + E('📕') + ' 错题本</div><div class="wrongs">' + (p.wrong.length ? p.wrong.map(w => '<div class="wrow"><small>' + esc(w.g) + ' · ' + w.d + '</small><div>' + esc(w.t) + '</div></div>').join('') : '<p class="c dim">还没有错题，真棒！</p>') + '</div>', { cls: 'wide' }); };
  }

  /* ================= 家长中心 ================= */
  // 家长验证题：两位数 × 两位数，小朋友不容易算出来
  function parentQuiz() { const a = R.int(12, 29), b = R.int(12, 19); return { html: '请家长回答：<b class="latin">' + a + ' × ' + b + ' = ?</b>', ok: v => String(v).trim() !== '' && +v === a * b }; }
  // 齿轮设置：声音（开关 + 音量）小朋友自己就能调；下面是需要家长验证的家长中心
  const SOUNDS = [['music', '🎵', '🔇', '音乐'], ['voice', '🗣️', '🤐', '朗读'], ['sfx', '🔔', '🔕', '音效']];
  function parentGate() {
    const pq = parentQuiz(), p = P();
    const m = UI.modal('<div class="mtitle">' + E('⚙️') + ' 设置</div><div class="vols">' + SOUNDS.map(v => '<div class="vrow" data-v="' + v[0] + '"><button class="vtog" aria-label="' + v[3] + '开关"></button><span>' + v[3] + '</span><input type="range" min="0" max="100" step="5" value="' + Math.round(Audio2.vol(v[0]) * 100) + '"><b>' + Math.round(Audio2.vol(v[0]) * 100) + '</b></div>').join('') + '</div>' +
      '<div class="pg-sep">' + E('👨‍👩‍👧') + ' 家长中心</div><p class="c">' + pq.html + '</p><input class="inp c" inputmode="numeric" maxlength="3"><button class="btn big go">进入</button>');
    const turn = (k, on) => { p.settings[k] = on; save(); if (k === 'music') on ? Audio2.playMusic(Audio2.musicName || 'happy') : Audio2.stopMusic(); };
    $$('.vrow', m.el).forEach(row => {
      const k = row.dataset.v, s = SOUNDS.find(v => v[0] === k), tog = row.querySelector('.vtog'), r = row.querySelector('input');
      const lab = () => { tog.innerHTML = E(p.settings[k] ? s[1] : s[2]); row.classList.toggle('off', !p.settings[k]); };
      lab();
      tog.onclick = () => { turn(k, !p.settings[k]); lab(); };
      r.oninput = () => { Audio2.setVol(k, +r.value); r.nextElementSibling.textContent = r.value; if (!p.settings[k] && +r.value > 0) { turn(k, true); lab(); } };
      r.onchange = () => { if (k === 'voice') Voice.say(R.pick(Engines.PRAISE)); else if (k === 'sfx') Audio2.sfx('right', .5); };
    });
    m.el.querySelector('.go').onclick = () => { if (pq.ok(m.el.querySelector('.inp').value)) { m.close(); parentPanel(); } else shakeInp(m.el.querySelector('.inp')); };
  }
  function shakeInp(i) { i.classList.remove('shake'); void i.offsetWidth; i.classList.add('shake'); i.value = ''; Audio2.sfx('wrong', .3); }
  function parentPanel() {
    const p = P();
    const m = UI.modal('<div class="mtitle">家长中心</div><div class="pset">' +
      '<label>年级（影响题目难度与画面风格）</label><div class="gsel">' + GRADES.map((g, i) => '<button class="chip' + (p.grade === i ? ' on' : '') + '" data-g="' + i + '">' + g + '</button>').join('') + '</div>' +
      '<label>画面风格</label><div class="gsel th">' + [['auto', '跟随年级']].concat(THEMES.map(t => [t[0], t[1]])).map(t => '<button class="chip' + (p.settings.theme === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<label>点读（悬停 / 长按题目选项时朗读，适合还不识字的小朋友）</label><div class="gsel ra">' + [['auto', '跟随年级'], ['on', '开'], ['off', '关']].map(t => '<button class="chip' + ((p.settings.readAloud == null ? 'auto' : p.settings.readAloud ? 'on' : 'off') === t[0] ? ' on' : '') + '" data-r="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<label>大游戏操作方式</label><div class="gsel ctl">' + [['auto', '自动识别'], ['touch', '触屏按钮'], ['kbm', '键盘鼠标']].map(t => '<button class="chip' + ((p.settings.ctrl || 'auto') === t[0] ? ' on' : '') + '" data-k="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<label>3D 画质（手机发热、卡顿时选「省电流畅」）</label><div class="gsel gfx">' + [['auto', '自动'], ['low', '省电流畅'], ['mid', '均衡'], ['high', '高清']].map(t => '<button class="chip' + ((p.settings.gfx || 'auto') === t[0] ? ' on' : '') + '" data-q="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<label>每日游戏时长（时间到了会锁住，家长验证后才能继续玩）</label><div class="gsel lim">' + [[15, '15分钟'], [30, '30分钟'], [45, '45分钟'], [60, '60分钟'], [0, '不限制']].map(t => '<button class="chip' + (p.settings.limit === t[0] ? ' on' : '') + '" data-l="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<label>放开全部限制（等级解锁、Boss 星星要求、糊涂龙宝石要求、休息提醒都不再限制）</label><div class="gsel fre">' + [[1, '🔓 全部放开'], [0, '正常限制']].map(t => '<button class="chip' + (!!p.settings.free === !!t[0] ? ' on' : '') + '" data-f="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<p class="dim pt-line"></p><div class="r-btns pt-btns"><button class="btn ghost sm pt-add">今天多玩 15 分钟</button><button class="btn ghost sm pt-zero">今日时长清零</button></div>' +
      '<div class="r-btns"><button class="btn ghost ex">导出存档</button><button class="btn ghost im">导入存档</button><button class="btn ghost del">删除此角色</button></div></div>', { cls: 'wide' });
    m.el.querySelector('.gsel').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; p.grade = +b.dataset.g; save(); m.close(); applyTheme(); hub(); UI.toast('已切换到' + GRADES[p.grade]); };
    m.el.querySelector('.th').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; p.settings.theme = b.dataset.t; save(); m.close(); applyTheme(); hub(); };
    m.el.querySelector('.ctl').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; p.settings.ctrl = b.dataset.k; save(); $$('.ctl .chip', m.el).forEach(x => x.classList.toggle('on', x === b)); };
    m.el.querySelector('.gfx').onclick = e => { const b = e.target.closest('[data-q]'); if (!b) return; p.settings.gfx = b.dataset.q; save(); Core.Perf.refresh(); $$('.gfx .chip', m.el).forEach(x => x.classList.toggle('on', x === b)); UI.toast('画质已切换，下一个 3D 场景完全生效'); };
    m.el.querySelector('.ra').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; p.settings.readAloud = b.dataset.r === 'auto' ? null : b.dataset.r === 'on'; save(); $$('.ra .chip', m.el).forEach(x => x.classList.toggle('on', x === b)); };
    m.el.querySelector('.fre').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; p.settings.free = b.dataset.f === '1'; save(); $$('.fre .chip', m.el).forEach(x => x.classList.toggle('on', x === b)); UI.toast(p.settings.free ? '已放开全部限制' : '已恢复正常限制'); if (curScreen === 'hub') hub(); else if (curScreen === 'play') playground(); };
    const ptLine = () => { const al = allowMin(p); m.el.querySelector('.pt-line').textContent = '今日已玩 ' + Math.round(usedMin(p)) + ' 分钟' + (al < Infinity ? '（今天可玩 ' + Math.round(al) + ' 分钟）' : '') + ' · 累计 ' + p.totalGames + ' 局'; };
    ptLine();
    m.el.querySelector('.lim').onclick = e => { const b = e.target.closest('[data-l]'); if (!b) return; p.settings.limit = +b.dataset.l; save(); $$('.lim .chip', m.el).forEach(x => x.classList.toggle('on', x === b)); ptLine(); };
    m.el.querySelector('.pt-add').onclick = () => { extendTime(p, 15); ptLine(); UI.toast('今天多玩 15 分钟'); };
    m.el.querySelector('.pt-zero').onclick = () => { resetTime(p); ptLine(); UI.toast('今日游戏时长已清零'); };
    m.el.querySelector('.ex').onclick = () => { const blob = new Blob([Store.exportJSON()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'star-island-save-' + today() + '.json'; a.click(); };
    m.el.querySelector('.im').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = () => { const r = new FileReader(); r.onload = () => { try { Store.importJSON(r.result); UI.toast('导入成功'); m.close(); titleScreen(); } catch (e) { UI.toast('文件不正确'); } }; r.readAsText(i.files[0]); }; i.click(); };
    m.el.querySelector('.del').onclick = async () => { if (await UI.confirm('确定删除「' + esc(p.name) + '」的全部进度吗？')) { delete Store.db.profiles[p.id]; Store.db.cur = null; save(); m.close(); titleScreen(); } };
  }
  /* ================= 每日时长：到时间锁住，家长验证后解锁 ================= */
  // playtime：{ date, ms 今日已玩, extra 家长加的分钟, off 今天不再限制 }，跨天自动重置
  const ptToday = p => { if (p.playtime.date !== today()) p.playtime = { date: today(), ms: 0 }; return p.playtime; };
  const usedMin = p => ptToday(p).ms / 60000;
  const allowMin = p => { const t = ptToday(p); return !p.settings.limit || t.off ? Infinity : p.settings.limit + (t.extra || 0); };
  const timeUp = p => !!p && !Core.free() && usedMin(p) >= allowMin(p);
  function extendTime(p, n) { const t = ptToday(p); t.extra = Math.max(0, usedMin(p) - (p.settings.limit || 0)) + n; t.off = false; save(); }
  function resetTime(p) { p.playtime = { date: today(), ms: 0 }; save(); }
  let lockM = null, warned = '';
  // 锁住期间拦下键盘，免得在遮罩后面继续操作游戏（遮罩里的输入框照常能打字）
  addEventListener('keydown', e => { if (lockM && !(e.target.closest && e.target.closest('.tlock-bg'))) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  function checkLock() {
    const p = P(); if (lockM || !p || curScreen === 'title' || !timeUp(p)) return;
    Voice.stop(); Audio2.stopMusic(); if (document.pointerLockElement) document.exitPointerLock();
    if (Core.Perf) Core.Perf.pause(true);
    document.body.classList.add('locked');
    lockM = UI.modal('<div class="tlock"><div class="rest-ico">' + E('🌙') + E('😴') + '</div><div class="mtitle">今天的游戏时间到啦</div><p>今天已经玩了 <b>' + Math.round(usedMin(p)) + '</b> 分钟，让眼睛休息一下，明天再来玩吧！</p><button class="btn ghost tl-parent">' + E('🔐') + ' 家长解锁</button></div>', { noClose: true, cls: 'tlock-m', instant: true });
    lockM.el.parentElement.classList.add('tlock-bg');
    Voice.say('今天已经玩了 ' + Math.round(usedMin(p)) + ' 分钟啦，休息一下，保护眼睛吧！');
    lockM.el.querySelector('.tl-parent').onclick = () => parentVerify(unlockPanel);
  }
  function unlock(msg) {
    if (!lockM) return; lockM.close(); lockM = null; document.body.classList.remove('locked');
    if (Core.Perf) Core.Perf.pause(false);
    if (Audio2.musicName) Audio2.playMusic(Audio2.musicName);
    sessionStart = Date.now(); if (msg) UI.toast(msg);
  }
  // 家长验证（叠在锁屏上面）
  function parentVerify(onOk) {
    const pq = parentQuiz();
    const m = UI.modal('<div class="mtitle">' + E('🔐') + ' 家长验证</div><p class="c">' + pq.html + '</p><input class="inp c" inputmode="numeric" maxlength="3"><button class="btn big go">确定</button>', { cls: 'tlock-m' });
    m.el.parentElement.classList.add('tlock-bg', 'tlock-top');
    const inp = m.el.querySelector('.inp'); setTimeout(() => inp.focus(), 60);
    const go = () => { if (pq.ok(inp.value)) { m.close(); onOk(); } else shakeInp(inp); };
    m.el.querySelector('.go').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  function unlockPanel() {
    const p = P();
    const m = UI.modal('<div class="mtitle">' + E('⏰') + ' 延长今天的游戏时间</div><p class="c dim">今日已玩 ' + Math.round(usedMin(p)) + ' 分钟 · 每日上限 ' + (p.settings.limit || '不限') + ' 分钟</p><div class="r-btns tl-opts"><button class="btn" data-n="15">再玩 15 分钟</button><button class="btn" data-n="30">再玩 30 分钟</button><button class="btn ghost" data-n="0">今日时长清零</button><button class="btn ghost" data-n="-1">今天不限时</button></div><button class="btn ghost sm tl-set">' + E('⚙️') + ' 家长中心（修改每日时长）</button>', { cls: 'tlock-m' });
    m.el.parentElement.classList.add('tlock-bg', 'tlock-top');
    m.el.querySelector('.tl-opts').onclick = e => {
      const b = e.target.closest('[data-n]'); if (!b) return; const n = +b.dataset.n; m.close();
      if (n > 0) { extendTime(p, n); unlock('可以再玩 ' + n + ' 分钟啦'); }
      else if (n === 0) { resetTime(p); unlock('今日游戏时长已清零'); }
      else { ptToday(p).off = true; save(); unlock('今天不再限制游戏时长'); }
    };
    m.el.querySelector('.tl-set').onclick = () => { m.close(); unlock(); parentPanel(); };
  }
  // 每 15 秒记一次时长；锁住时不计时
  let lastTick = Date.now(), sessionStart = Date.now();
  setInterval(() => {
    const p = P(); const now = Date.now(); const dt = now - lastTick; lastTick = now;
    if (!p || document.hidden || curScreen === 'title' || lockM) return;
    ptToday(p).ms += Math.min(dt, 20000); save();
    if (Core.free()) { sessionStart = now; return; }
    if (timeUp(p)) return checkLock();
    const left = allowMin(p) - usedMin(p), wk = today() + '|' + allowMin(p);
    if (left <= 5 && warned !== wk) { warned = wk; UI.toast(E('⏰') + ' 今天还能玩 ' + Math.max(1, Math.round(left)) + ' 分钟哦', 3000); }
    else if (now - sessionStart > 20 * 60000) { sessionStart = now; restModal('已经连续玩了20分钟，看看远处的绿色植物，眨眨眼睛吧～'); }
  }, 15000);
  function restModal(t) { const m = UI.modal('<div class="c"><div class="rest-ico">' + E('👀') + E('🌳') + '</div><div class="mtitle">休息一下</div><p>' + t + '</p><button class="btn big go">我知道啦</button></div>', { noClose: true }); Voice.say(t); m.el.querySelector('.go').onclick = () => m.close(); }

  /* ================= 乐园：钢琴 / 画板 ================= */
  function playground() {
    show('play', el => {
      const p = P(), SP = Playland.SPACES, open = s => Core.free() || p.lv >= s.lv;
      el.innerHTML = '<div class="shop-bg p"></div><div class="ztop"><button class="back">' + E('⬅️') + '</button><div class="ztitle">' + E('🎹') + '<div><b>快乐乐园</b><small>自由玩耍，放松一下 · 升级解锁更多玩法</small></div></div></div><div class="ptabs"><button class="btn on" data-p="piano">' + E('🎹') + ' 小钢琴</button><button class="btn" data-p="draw">' + E('🎨') + ' 涂鸦板</button>' +
        SP.map(s => '<button class="btn' + (open(s) ? '' : ' lock') + '" data-p="' + s.id + '" data-say="' + s.n + '" data-tip="' + s.sub + '">' + E(open(s) ? s.e : '🔒') + ' ' + s.n + (open(s) ? '' : '<small>Lv.' + s.lv + '</small>') + '</button>').join('') + '</div><div class="pbox"></div>';
      const box = el.querySelector('.pbox');
      let stop = null; const run = f => { if (stop) stop(); stop = null; box.className = 'pbox'; stop = f(box) || null; };
      Core.onLeave(() => { if (stop) stop(); stop = null; });
      el.querySelector('.back').onclick = () => hub();
      el.querySelector('.ptabs').onclick = e => {
        const b = e.target.closest('button'); if (!b) return; const id = b.dataset.p, s = SP.find(x => x.id === id);
        if (s && !open(s)) { Audio2.sfx('wrong', .3); UI.toast('🔒 角色升到 Lv.' + s.lv + ' 就能解锁「' + s.n + '」啦！'); Voice.say('升到' + s.lv + '级就能玩' + s.n + '啦'); return; }
        Audio2.sfx('click', .3); $$('.ptabs .btn', el).forEach(x => x.classList.toggle('on', x === b));
        run(id === 'piano' ? piano : id === 'draw' ? drawBoard : bx => Playland.open(id, bx));
      };
      run(piano);
    });
    Audio2.stopMusic();
  }
  let actx;
  function tone(f, d) {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + (d || 1.2));
    const g2 = actx.createGain(); g2.gain.value = .15; o2.connect(g2); g2.connect(g);
    o.connect(g); g.connect(actx.destination); o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 1.3);
  }
  function piano(box) {
    const notes = [['C', 'do', 261.6, '🔴'], ['D', 're', 293.7, '🟠'], ['E', 'mi', 329.6, '🟡'], ['F', 'fa', 349.2, '🟢'], ['G', 'sol', 392, '🔵'], ['A', 'la', 440, '🟣'], ['B', 'si', 493.9, '🩷'], ['C2', 'do', 523.3, '🔴']];
    // 只有 C4–C5 八个白键：旋律超出 do–do' 的（如王老先生、月光下）整体移到 F 调，低音 sol 落在 C 键上
    const songs = {
      '小星星': [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0], '两只老虎': [0, 1, 2, 0, 0, 1, 2, 0, 2, 3, 4, 2, 3, 4], '欢乐颂': [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1],
      '热面包': [2, 1, 0, 2, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 1, 0],
      '玛丽的小羊': [2, 1, 0, 1, 2, 2, 2, 1, 1, 1, 2, 4, 4, 2, 1, 0, 1, 2, 2, 2, 2, 1, 1, 2, 1, 0],
      '小鸭子': [0, 1, 2, 3, 4, 4, 5, 5, 5, 5, 4, 5, 5, 5, 5, 4, 3, 3, 3, 3, 2, 2, 1, 1, 1, 1, 0],
      '粉刷匠': [4, 2, 4, 2, 4, 2, 0, 1, 3, 2, 1, 4, 4, 2, 4, 2, 4, 2, 0, 1, 3, 2, 1, 0, 1, 1, 3, 3, 2, 0, 4, 1, 3, 2, 1, 4, 4, 2, 4, 2, 4, 2, 0, 1, 3, 2, 1, 0],
      '划小船': [0, 0, 0, 1, 2, 2, 1, 2, 3, 4, 7, 7, 7, 4, 4, 4, 2, 2, 2, 0, 0, 0, 4, 3, 2, 1, 0],
      '伦敦桥': [4, 5, 4, 3, 2, 3, 4, 1, 2, 3, 2, 3, 4, 4, 5, 4, 3, 2, 3, 4, 1, 4, 2, 0],
      '小蜜蜂': [4, 2, 2, 3, 1, 1, 0, 1, 2, 3, 4, 4, 4, 4, 2, 2, 3, 1, 1, 0, 2, 4, 4, 2, 1, 1, 1, 1, 1, 2, 3, 2, 2, 2, 2, 2, 3, 4, 4, 2, 2, 3, 1, 1, 0, 2, 4, 4, 0],
      '三只熊': [0, 0, 0, 0, 0, 2, 4, 4, 2, 0, 4, 4, 2, 4, 4, 2, 0, 0, 0, 4, 4, 2, 0, 4, 4, 4, 4, 4, 2, 0, 4, 4, 4, 4, 4, 2, 0, 4, 4, 4, 5, 4, 7, 4, 7, 4, 2, 1, 0],
      '月光下': [3, 3, 3, 4, 5, 4, 3, 5, 4, 4, 3, 3, 3, 3, 4, 5, 4, 3, 5, 4, 4, 3, 4, 4, 4, 4, 1, 1, 4, 3, 2, 1, 0, 3, 3, 3, 4, 5, 4, 3, 5, 4, 4, 3],
      '这个老人': [4, 2, 4, 4, 2, 4, 5, 4, 3, 2, 1, 2, 3, 2, 3, 4, 0, 0, 0, 0, 0, 1, 2, 3, 4, 4, 1, 1, 3, 2, 1, 0],
      '圣者进行曲': [0, 2, 3, 4, 0, 2, 3, 4, 0, 2, 3, 4, 2, 0, 2, 1, 2, 2, 1, 0, 0, 2, 4, 4, 3, 2, 3, 4, 2, 0, 1, 0],
      '念故乡': [2, 4, 4, 2, 1, 0, 1, 2, 4, 2, 1, 2, 4, 4, 2, 1, 0, 1, 2, 1, 0, 0],
      '小毛驴': [0, 0, 0, 2, 4, 4, 4, 4, 5, 5, 5, 7, 4, 3, 3, 3, 5, 2, 2, 2, 2, 1, 1, 1, 1, 4, 0, 0, 0, 2, 4, 4, 4, 4, 5, 5, 5, 7, 4, 3, 3, 3, 5, 2, 2, 2, 2, 1, 1, 1, 2, 0],
      '王老先生': [3, 3, 3, 0, 1, 1, 0, 5, 5, 4, 4, 3, 0, 3, 3, 3, 0, 1, 1, 0, 5, 5, 4, 4, 3, 0, 0, 3, 3, 3, 0, 0, 3, 3, 3, 3, 3, 3, 0, 1, 1, 0, 5, 5, 4, 4, 3],
      '洋娃娃跳舞': [0, 1, 2, 3, 4, 4, 4, 3, 2, 3, 3, 3, 2, 1, 0, 2, 4, 0, 1, 2, 3, 4, 4, 4, 3, 2, 3, 3, 3, 2, 1, 0, 2, 0],
      '铃儿响叮当': [2, 2, 2, 2, 2, 2, 2, 4, 0, 1, 2, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 2, 1, 4, 2, 2, 2, 2, 2, 2, 2, 4, 0, 1, 2, 3, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 3, 1, 0],
      '噢苏珊娜': [0, 1, 2, 4, 4, 5, 4, 2, 0, 1, 2, 2, 1, 0, 1, 3, 3, 5, 5, 5, 4, 4, 2, 0, 1, 0, 1, 2, 4, 4, 5, 4, 2, 0, 1, 2, 2, 1, 1, 0],
      '茉莉花': [2, 2, 4, 5, 7, 7, 5, 4, 4, 5, 4, 2, 2, 4, 5, 7, 7, 5, 4, 4, 5, 4, 4, 4, 4, 2, 4, 5, 5, 4, 2, 1, 2, 4, 2, 1, 0, 0, 1, 0],
      '康康舞': [0, 1, 3, 2, 1, 4, 4, 4, 5, 2, 3, 1, 1, 1, 3, 2, 1, 0, 7, 6, 5, 4, 3, 2, 1, 0, 1, 3, 2, 1, 4, 4, 4, 5, 2, 3, 1, 3, 2, 1, 0, 4, 1, 2, 0],
      '摇篮曲': [2, 2, 4, 2, 2, 4, 2, 4, 7, 6, 5, 5, 4, 1, 2, 3, 1, 1, 2, 3, 1, 3, 6, 5, 4, 6, 7, 0, 0, 7, 5, 3, 4, 2, 0, 3, 4, 5, 4, 0, 0, 7, 5, 3, 4, 2, 0, 3, 2, 1, 0],
    };
    box.innerHTML = '<div class="songs">跟着弹：' + Object.keys(songs).map(s => '<button class="chip" data-s="' + s + '">' + s + '</button>').join('') + '<button class="chip" data-s="">自由弹</button></div><div class="guide"></div><div class="keys">' + notes.map((n, i) => '<button class="key" data-i="' + i + '" style="--kc:' + ['#ff5d73', '#ff9f43', '#ffd23f', '#7bd389', '#3ec1d3', '#a78bfa', '#ff8fc7', '#ff5d73'][i] + '"><span class="kn">' + n[1] + '</span><span class="kl latin">' + n[0][0] + '</span></button>').join('') + '</div>';
    let song = null, pos = 0;
    const guide = box.querySelector('.guide');
    const showGuide = () => { if (!song) { guide.innerHTML = '随便弹弹，创作你自己的音乐吧！'; $$('.key', box).forEach(k => k.classList.remove('next')); return; } guide.innerHTML = song.map((n, i) => '<i class="' + (i < pos ? 'done' : i === pos ? 'cur' : '') + '">' + notes[n][1] + '</i>').join(''); $$('.key', box).forEach(k => k.classList.toggle('next', +k.dataset.i === song[pos])); };
    box.querySelector('.songs').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; song = b.dataset.s ? songs[b.dataset.s] : null; pos = 0; $$('.songs .chip', box).forEach(x => x.classList.toggle('on', x === b)); showGuide(); };
    $$('.key', box).forEach(k => k.onpointerdown = e => {
      e.preventDefault(); const i = +k.dataset.i; tone(notes[i][2]); k.classList.add('down'); setTimeout(() => k.classList.remove('down'), 180);
      const r = k.getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top + 20, R.pick(['🎵', '🎶', '✨']), 3);
      if (song && i === song[pos]) { pos++; if (pos >= song.length) { Audio2.sfx('win', .5); UI.confetti(50); pos = 0; UI.toast('弹得真棒！'); } showGuide(); }
    });
    showGuide();
  }
  function drawBoard(box) {
    const cols = ['#222', '#ff5d73', '#ff9f43', '#ffd23f', '#7bd389', '#3ec1d3', '#5b7cfa', '#a78bfa', '#ff8fc7', '#8b5a2b', '#fff'];
    const stamps = ['⭐', '❤️', '🌸', '🐱', '🌈', '☀️', '🦋', '🍎'];
    box.innerHTML = '<div class="dtools">' + cols.map((c, i) => '<button class="dc' + (i === 1 ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>').join('') + '<span class="sep"></span><button class="dsz on" data-z="6">●</button><button class="dsz" data-z="14">⬤</button><span class="sep"></span>' + stamps.map(s => '<button class="dst" data-s="' + s + '">' + E(s) + '</button>').join('') + '<span class="sep"></span><button class="dst der" data-er="1" data-tip="橡皮" data-say="橡皮">' + E('🧽') + '</button><button class="btn sm dclear">清空</button></div><canvas class="dcanvas"></canvas>';
    hydrate(box);
    const cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
    const fit = () => { const r = cv.getBoundingClientRect(); const img = cv.width ? ctx.getImageData(0, 0, cv.width, cv.height) : null; cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); if (img) ctx.putImageData(img, 0, 0); };
    setTimeout(fit, 50);
    let color = cols[1], size = 6, stamp = null, erase = false, last = null;
    const pick = b => { $$('.dc,.dst', box).forEach(x => x.classList.toggle('on', x === b)); cv.classList.toggle('erasing', erase); };
    box.querySelector('.dtools').onclick = e => {
      const b = e.target.closest('button'); if (!b) return; Audio2.sfx('click', .3);
      if (b.dataset.c) { color = b.dataset.c; stamp = null; erase = false; pick(b); }
      if (b.dataset.z) { size = +b.dataset.z; $$('.dsz', box).forEach(x => x.classList.toggle('on', x === b)); }
      if (b.dataset.s) { stamp = b.dataset.s; erase = false; pick(b); }
      if (b.dataset.er) { stamp = null; erase = true; pick(b); }
      if (b.classList.contains('dclear')) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
    };
    const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio]; };
    // 橡皮用白色涂抹（画布底色就是白色），笔刷比画笔粗 3 倍，方便小朋友擦
    const stroke = (a, b) => { ctx.strokeStyle = erase ? '#fff' : color; ctx.lineWidth = size * (erase ? 3 : 1) * devicePixelRatio; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
    cv.onpointerdown = e => {
      cv.setPointerCapture(e.pointerId); const [x, y] = pt(e);
      if (stamp) { const img = new Image(); img.onload = () => ctx.drawImage(img, x - 40 * devicePixelRatio, y - 40 * devicePixelRatio, 80 * devicePixelRatio, 80 * devicePixelRatio); img.src = box.querySelector('.dst[data-s="' + stamp + '"] img').src; Audio2.sfx('pop', .4); return; }
      last = [x, y]; stroke(last, [x + .01, y]);
    };
    cv.onpointermove = e => { if (!last) return; const q = pt(e); stroke(last, q); last = q; };
    cv.onpointerup = cv.onpointercancel = () => { last = null; };
  }

  /* ================= 启动 ================= */
  function boot() {
    Store.load();
    const start = () => { document.removeEventListener('pointerdown', start); Audio2.unlocked = true; if (Audio2.musicName) Audio2.playMusic(Audio2.musicName); };
    document.addEventListener('pointerdown', start);
    Core.ReadAloud.init(); Core.Keys.init();
    // 关闭 / 刷新页面前二次确认，防止小朋友误触关掉（浏览器只允许显示自带的确认框，文字不能自定义）
    addEventListener('beforeunload', e => { if (!Store.p) return; save(); e.preventDefault(); e.returnValue = ''; return ''; });
    if (Store.p) enter(false); else titleScreen();
  }
  window.App = { HELP, heroShot, heroHTML, prepHeroShots, boot, hub, zoneScreen, titleScreen, startGame, battle, themeOf, HEROES, PETS, SHOP, THEMES, show, decayPet, petXP, taskProgress, addCoins, checkBadges, heroModel, heroOf, addXP };
  document.addEventListener('DOMContentLoaded', boot);
})();
