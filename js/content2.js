/* 第二批题库：艺术、地理、国学、逻辑、职业，以及描红/天平题目 */
(function () {
  const D = window.DATA, { G, R, card, N } = CONTENT;
  const byG = (arr, g, idx) => { const f = arr.filter(x => (x[idx] || 0) <= g); return f.length >= 4 ? f : arr.slice(0, Math.max(4, f.length)); };
  const opts = (right, wrongs) => R.shuffle([Object.assign({}, right, { ok: true })].concat(wrongs.map(w => Object.assign({}, w, { ok: false }))));
  const uniq = (arr, key) => { const s = new Set(); return arr.filter(x => { const k = key(x); if (s.has(k)) return false; s.add(k); return true; }); };
  const Q = (p, ch, extra) => Object.assign({ p, ch }, extra || {});
  // 从池中出题，干扰项取 key 不同的元素
  function pickQ(pool, n, key, make) {
    const qs = [], picked = R.sample(pool, Math.min(n, pool.length));
    while (picked.length < n) picked.push(R.pick(pool));
    picked.forEach(it => { const others = R.sample(uniq(pool.filter(x => key(x) !== key(it)), key), 3); qs.push(make(it, others)); });
    return qs;
  }
  const kq = list => g => R.sample(byG(list, g, 3), Math.min(N, byG(list, g, 3).length)).map(k => Q(k[0], opts(card(k[1]), k[2].map(x => card(x))), { pe: k[4] || '💡', ps: k[0], small: k[0].length > 12 }));
  const sw = c => 'html:<i class="swatch" style="--c:' + c + '"></i>';

  /* ================= 艺术剧院 ================= */
  const COLORS = { 红: '#ff3b3b', 黄: '#ffd23f', 蓝: '#3d7bff', 橙: '#ff9f2e', 紫: '#9b5cf6', 绿: '#2ecc71', 白: '#ffffff', 粉: '#ff9fc7', 黑: '#222222', 灰: '#9aa0aa', 浅蓝: '#9fd4ff', 棕: '#8b5a2b' };
  const MIX = [['红', '黄', '橙', 0], ['红', '蓝', '紫', 0], ['黄', '蓝', '绿', 0], ['红', '白', '粉', 1], ['黑', '白', '灰', 1], ['蓝', '白', '浅蓝', 1]];
  G.mix_q = g => pickQ(byG(MIX, g, 3), N, x => x[2], (m, o) => Q(m[0] + '色 + ' + m[1] + '色 = ?', opts(card(m[2] + '色', sw(COLORS[m[2]])), o.map(x => card(x[2] + '色', sw(COLORS[x[2]])))), { pe: 'html:<div class="mixrow">' + sw(COLORS[m[0]]).slice(5) + '<b>+</b>' + sw(COLORS[m[1]]).slice(5) + '</div>', ps: m[0] + '色加' + m[1] + '色，会变成什么颜色' }));
  G.s_warmcool = g => ({ bins: [card('暖色', '🔥'), card('冷色', '❄️')], items: R.shuffle([['红', 0], ['橙', 0], ['黄', 0], ['粉', 0], ['棕', 0], ['蓝', 1], ['绿', 1], ['紫', 1], ['浅蓝', 1]].map(x => Object.assign(card(x[0] + '色', sw(COLORS[x[0]])), { b: x[1] }))) });
  G.color_name = g => pickQ(Object.keys(COLORS).map(k => [k]), N, x => x[0], (c, o) => Q('这是什么颜色？', opts(card(c[0] + '色'), o.map(x => card(x[0] + '色'))), { pe: sw(COLORS[c[0]]), ps: '这是什么颜色' }));
  const FAM = [['🎸', '吉他', 0], ['🎻', '小提琴', 0], ['🪕', '班卓琴', 0], ['🥁', '鼓', 1], ['🪘', '手鼓', 1], ['🔔', '铃铛', 1], ['🎺', '小号', 2], ['🎷', '萨克斯', 2], ['🪈', '笛子', 2], ['🎹', '钢琴', 3], ['🪗', '手风琴', 3]];
  const FAMB = [['〰️', '弦乐器'], ['🥁', '打击乐器'], ['🌬️', '管乐器'], ['🎹', '键盘乐器']];
  G.s_instr = g => ({ bins: FAMB.map(b => card(b[1], b[0])), items: R.sample(FAM, 9).map(x => Object.assign(card(x[1], x[0]), { b: x[2] })) });
  G.instr_fam = g => pickQ(FAM, N, x => x[2], (x) => Q(x[1] + '属于哪一类乐器？', opts(card(FAMB[x[2]][1], FAMB[x[2]][0]), FAMB.filter((_, i) => i !== x[2]).map(b => card(b[1], b[0]))), { pe: x[0], ps: x[1] + '属于哪一类乐器' }));
  const NOTES = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
  G.note_next = g => Array.from({ length: N }, () => { const i = R.int(0, 5); return Q(NOTES[i] + ' 后面是哪个音？', opts(card(NOTES[i + 1], '', NOTES[i + 1], 'en'), R.sample(NOTES.filter((_, k) => k !== i + 1), 3).map(x => card(x, '', x, 'en'))), { pt: NOTES[i] + ' → ?', latin: true, latinCh: true, ps: '后面是哪个音' }); });
  G.o_notes = g => Array.from({ length: 4 }, () => { const i = R.int(0, 2); return { p: '按音阶顺序排一排', items: NOTES.slice(i, i + 5).map(x => card(x, '', x, 'en')) }; });
  const PAINT = [['蒙娜丽莎', '达·芬奇', '🖼️', 2], ['向日葵', '梵高', '🌻', 2], ['星月夜', '梵高', '🌌', 3], ['清明上河图', '张择端', '🏯', 3], ['虾', '齐白石', '🦐', 2], ['奔马', '徐悲鸿', '🐎', 2], ['墨竹', '郑板桥', '🎋', 3], ['睡莲', '莫奈', '🪷', 3], ['富春山居图', '黄公望', '⛰️', 4]];
  G.paint_q = g => pickQ(byG(PAINT, g, 3), N, x => x[1], (x, o) => Q('名画《' + x[0] + '》是谁画的？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[2], ps: '名画' + x[0] + '，是谁画的' }));
  G.p_paint = g => R.sample(uniq(byG(PAINT, g, 3), x => x[1]), 5).map(x => [card('《' + x[0] + '》', x[2], x[0]), card(x[1])]);
  const SONGS = [['一闪一闪亮晶晶', '满天都是小星星', '⭐', 0], ['挂在天上放光明', '好像许多小眼睛', '✨', 0], ['两只老虎，两只老虎', '跑得快，跑得快', '🐯', 0], ['一只没有耳朵', '一只没有尾巴', '🐯', 0], ['小燕子，穿花衣', '年年春天来这里', '🐦', 1], ['我在马路边', '捡到一分钱', '🪙', 1], ['世上只有妈妈好', '有妈的孩子像块宝', '👩', 1], ['找呀找呀找朋友', '找到一个好朋友', '🤝', 0], ['小兔子乖乖', '把门儿开开', '🐰', 0], ['门前大桥下', '游过一群鸭', '🦆', 1], ['拔萝卜，拔萝卜', '嘿哟嘿哟拔萝卜', '🥕', 0], ['让我们荡起双桨', '小船儿推开波浪', '🚣', 3]];
  G.song_next = g => pickQ(byG(SONGS, g, 3), N, x => x[1], (x, o) => Q('「' + x[0] + '」下一句唱什么？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[2], ps: x[0] + '，下一句唱什么', small: true }));
  G.p_song = g => R.sample(byG(SONGS, g, 3), 5).map(x => [card(x[0]), card(x[1])]);
  const TOOLS_ART = [['🖍️', '蜡笔', '涂颜色'], ['🖌️', '毛笔', '写书法、画国画'], ['🎨', '调色盘', '调颜色'], ['✏️', '铅笔', '画草稿'], ['✂️', '剪刀', '剪纸'], ['📏', '尺子', '画直线'], ['🧶', '毛线', '编织'], ['🖊️', '钢笔', '写字']];
  G.arttool_q = g => pickQ(TOOLS_ART, N, x => x[1], (x, o) => Q('想要「' + x[2] + '」，用什么？', opts(card(x[1], x[0]), o.map(y => card(y[1], y[0]))), { ps: '想要' + x[2] + '，用什么' }));
  G.arttool_pic = g => pickQ(TOOLS_ART, N, x => x[1], (x, o) => Q('这是什么？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[0], ps: '这是什么' }));
  const ART_KNOW = [
    ['美术里的三原色是？', '红黄蓝', ['红绿蓝', '黑白灰', '橙紫绿'], 2, '🎨'], ['五线谱一共有几条线？', '5条', ['3条', '4条', '6条'], 2, '🎼'],
    ['钢琴一般有多少个琴键？', '88个', ['66个', '100个', '52个'], 3, '🎹'], ['二胡有几根弦？', '2根', ['1根', '4根', '6根'], 3, '🎻'],
    ['国画主要用什么来画？', '毛笔和墨', ['蜡笔', '铅笔', '油画棒'], 2, '🖌️'], ['京剧是哪个国家的戏曲？', '中国', ['日本', '法国', '美国'], 1, '🎭'],
    ['用彩纸剪出图案的传统艺术是？', '剪纸', ['折纸', '泥塑', '刺绣'], 1, '✂️'], ['《天鹅湖》是一部什么舞剧？', '芭蕾舞剧', ['京剧', '街舞', '民族舞'], 3, '🦢'],
    ['《命运交响曲》的作者是？', '贝多芬', ['莫扎特', '巴赫', '肖邦'], 4, '🎼'], ['京剧里的红脸通常代表？', '忠诚勇敢', ['奸诈', '胆小', '调皮'], 3, '🎭'],
    ['京剧里的黑脸通常代表？', '正直无私', ['阴险', '懒惰', '贪吃'], 3, '🎭'], ['小提琴是用什么拉响的？', '琴弓', ['鼓槌', '手指弹', '嘴吹'], 1, '🎻'],
    ['把黄色和蓝色混在一起会变成？', '绿色', ['紫色', '橙色', '黑色'], 1, '🟩'], ['唱歌时要注意什么？', '用自然好听的声音', ['越大声越好', '捂着嘴唱', '一直喊叫'], 0, '🎤']];
  G.art_know = kq(ART_KNOW);

  /* ================= 地理航线 ================= */
  const FLAGS = [['🇨🇳', '中国', 0], ['🇯🇵', '日本', 1], ['🇰🇷', '韩国', 1], ['🇺🇸', '美国', 1], ['🇬🇧', '英国', 1], ['🇫🇷', '法国', 1], ['🇩🇪', '德国', 2], ['🇮🇹', '意大利', 2], ['🇨🇦', '加拿大', 2], ['🇦🇺', '澳大利亚', 2], ['🇧🇷', '巴西', 2], ['🇷🇺', '俄罗斯', 2], ['🇮🇳', '印度', 3], ['🇪🇬', '埃及', 3], ['🇪🇸', '西班牙', 3], ['🇲🇽', '墨西哥', 3], ['🇳🇿', '新西兰', 3], ['🇸🇬', '新加坡', 3], ['🇹🇭', '泰国', 3], ['🇿🇦', '南非', 4], ['🇬🇷', '希腊', 4], ['🇦🇷', '阿根廷', 4], ['🇳🇱', '荷兰', 4], ['🇨🇭', '瑞士', 4]];
  G.flag_q = g => pickQ(byG(FLAGS, g, 2), N, x => x[1], (x, o) => Q('这是哪个国家的国旗？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[0], ps: '这是哪个国家的国旗' }));
  G.flag_pic = g => pickQ(byG(FLAGS, g, 2), N, x => x[1], (x, o) => Q(x[1] + '的国旗是哪一面？', opts(card('', x[0], x[1]), o.map(y => card('', y[0], y[1]))), { pt: x[1], ps: x[1] + '的国旗是哪一面' }));
  G.p_flag = g => R.sample(byG(FLAGS, g, 2), 6).map(x => [card('', x[0], x[1]), card(x[1])]);
  const CONT = [['中国', 0], ['日本', 0], ['印度', 0], ['泰国', 0], ['韩国', 0], ['法国', 1], ['英国', 1], ['德国', 1], ['意大利', 1], ['西班牙', 1], ['埃及', 2], ['南非', 2], ['美国', 3], ['加拿大', 3], ['墨西哥', 3], ['巴西', 4], ['阿根廷', 4], ['澳大利亚', 5], ['新西兰', 5]];
  const CONTN = [['🌏', '亚洲'], ['🏰', '欧洲'], ['🦁', '非洲'], ['🗽', '北美洲'], ['🦜', '南美洲'], ['🦘', '大洋洲'], ['🐧', '南极洲']];
  const flagOf = n => (FLAGS.find(f => f[1] === n) || ['🏳️'])[0];
  G.cont_q = g => pickQ(CONT, N, x => x[1], x => Q(x[0] + '在哪个大洲？', opts(card(CONTN[x[1]][1], CONTN[x[1]][0]), R.sample(CONTN.filter((_, i) => i !== x[1]), 3).map(b => card(b[1], b[0]))), { pe: flagOf(x[0]), ps: x[0] + '在哪个大洲' }));
  G.s_cont = g => { const bs = R.sample([0, 1, 2, 3, 4, 5], 3).sort(); return { bins: bs.map(i => card(CONTN[i][1], CONTN[i][0])), items: R.shuffle(CONT.filter(c => bs.includes(c[1]))).slice(0, 9).map(c => Object.assign(card(c[0], flagOf(c[0])), { b: bs.indexOf(c[1]) })) }; };
  const LANDMARK = [['🗼', '埃菲尔铁塔', '法国', 1], ['🗽', '自由女神像', '美国', 1], ['🧱', '长城', '中国', 0], ['🐫', '金字塔', '埃及', 1], ['🗻', '富士山', '日本', 2], ['🕰️', '大本钟', '英国', 2], ['🎭', '悉尼歌剧院', '澳大利亚', 2], ['🕌', '泰姬陵', '印度', 3], ['🏟️', '罗马斗兽场', '意大利', 3], ['🏯', '故宫', '中国', 0]];
  G.landmark_q = g => pickQ(byG(LANDMARK, g, 3), N, x => x[2], (x, o) => Q(x[1] + '在哪个国家？', opts(card(x[2], flagOf(x[2])), o.map(y => card(y[2], flagOf(y[2])))), { pe: x[0], ps: x[1] + '在哪个国家' }));
  G.p_landmark = g => R.sample(uniq(LANDMARK, x => x[2]), 5).map(x => [card(x[1], x[0]), card(x[2], flagOf(x[2]))]);
  const CAPITAL = [['中国', '北京'], ['日本', '东京'], ['韩国', '首尔'], ['美国', '华盛顿'], ['英国', '伦敦'], ['法国', '巴黎'], ['德国', '柏林'], ['意大利', '罗马'], ['俄罗斯', '莫斯科'], ['埃及', '开罗'], ['澳大利亚', '堪培拉'], ['加拿大', '渥太华'], ['泰国', '曼谷'], ['西班牙', '马德里']];
  G.capital_q = g => pickQ(CAPITAL, N, x => x[1], (x, o) => Q(x[0] + '的首都是？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: flagOf(x[0]), ps: x[0] + '的首都是哪里' }));
  G.p_capital = g => R.sample(CAPITAL, 6).map(x => [card(x[0], flagOf(x[0])), card(x[1])]);
  const PROV = [['广东', '粤', '广州'], ['四川', '川', '成都'], ['山东', '鲁', '济南'], ['江苏', '苏', '南京'], ['浙江', '浙', '杭州'], ['湖南', '湘', '长沙'], ['湖北', '鄂', '武汉'], ['河南', '豫', '郑州'], ['河北', '冀', '石家庄'], ['福建', '闽', '福州'], ['云南', '云', '昆明'], ['陕西', '陕', '西安'], ['安徽', '皖', '合肥'], ['江西', '赣', '南昌'], ['贵州', '贵', '贵阳'], ['黑龙江', '黑', '哈尔滨'], ['辽宁', '辽', '沈阳'], ['吉林', '吉', '长春'], ['山西', '晋', '太原']];
  G.prov_abbr = g => pickQ(PROV, N, x => x[1], (x, o) => Q(x[0] + '省的简称是？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: '🗺️', ps: x[0] + '省的简称是什么' }));
  G.prov_cap = g => pickQ(PROV, N, x => x[2], (x, o) => Q(x[0] + '省的省会是？', opts(card(x[2]), o.map(y => card(y[2]))), { pe: '🏙️', ps: x[0] + '省的省会是哪里' }));
  G.p_prov = g => R.sample(PROV, 6).map(x => [card(x[0]), card(x[2])]);
  const CITY = [['兵马俑', '西安', '🗿', 2], ['西湖', '杭州', '🏞️', 2], ['东方明珠塔', '上海', '🗼', 2], ['故宫', '北京', '🏯', 1], ['大熊猫基地', '成都', '🐼', 1], ['桂林山水', '桂林', '⛰️', 3], ['黄鹤楼', '武汉', '🏯', 3], ['趵突泉', '济南', '⛲', 4]];
  G.city_q = g => pickQ(byG(CITY, g, 3), N, x => x[1], (x, o) => Q('「' + x[0] + '」在哪座城市？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[2], ps: x[0] + '在哪座城市' }));
  const LANDFORM = [['🏜️', '沙漠'], ['🏔️', '雪山'], ['🌋', '火山'], ['🏝️', '海岛'], ['🌊', '大海'], ['🏞️', '河流'], ['🌲', '森林'], ['🧊', '冰川'], ['🌾', '田野'], ['🏖️', '沙滩']];
  G.landform_q = g => pickQ(LANDFORM, N, x => x[1], (x, o) => Q('图上是什么地方？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[0], ps: '图上是什么地方' }));
  G.p_landform = g => R.sample(LANDFORM, 6).map(x => [card('', x[0], x[1]), card(x[1])]);
  // 方向：上北下南左西右东
  G.dir_q = g => Array.from({ length: N }, () => {
    const things = R.sample(['🐱', '🌳', '🏠', '🚗', '🐶', '🌸', '⚽', '🍎'], 4), D4 = ['北', '东', '南', '西'], cells = [1, 5, 7, 3];
    const grid = Array(9).fill(''); grid[4] = '⭐'; things.forEach((t, i) => grid[cells[i]] = t);
    const k = R.int(0, 3);
    const html = 'html:<div class="dirmap"><b class="n">北</b><b class="s">南</b><b class="w">西</b><b class="e">东</b><div class="dg">' + grid.map(x => '<span>' + (x ? '<i data-emo="' + x + '"></i>' : '') + '</span>').join('') + '</div></div>';
    return Q(Engines_dirName(things[k]) + '在⭐的哪一边？', opts(card(D4[k] + '边'), D4.filter((_, i) => i !== k).map(x => card(x + '边'))), { pe: html, ps: '它在星星的哪一边' });
  });
  const EMN = { '🐱': '小猫', '🌳': '大树', '🏠': '房子', '🚗': '汽车', '🐶': '小狗', '🌸': '花朵', '⚽': '足球', '🍎': '苹果' };
  function Engines_dirName(e) { return EMN[e] || e; }
  const GEO_KNOW = [
    ['世界上最大的大洋是？', '太平洋', ['大西洋', '印度洋', '北冰洋'], 2, '🌊'], ['地球上一共有几个大洲？', '7个', ['5个', '4个', '9个'], 2, '🌍'],
    ['最冷的大洲是？', '南极洲', ['亚洲', '非洲', '欧洲'], 2, '🐧'], ['世界上最长的河是？', '尼罗河', ['长江', '黄河', '亚马孙河'], 3, '🏞️'],
    ['世界最高的山峰是？', '珠穆朗玛峰', ['富士山', '泰山', '阿尔卑斯山'], 2, '🏔️'], ['中国的首都是？', '北京', ['上海', '广州', '深圳'], 0, '🏯'],
    ['中国最长的河流是？', '长江', ['黄河', '珠江', '淮河'], 2, '🏞️'], ['被称为“母亲河”的是？', '黄河', ['长江', '珠江', '黑龙江'], 2, '🌊'],
    ['大熊猫的老家在哪个省？', '四川', ['海南', '黑龙江', '广东'], 2, '🐼'], ['地图上的“上”通常是哪个方向？', '北', ['南', '东', '西'], 1, '🧭'],
    ['太阳从哪个方向升起？', '东', ['西', '南', '北'], 0, '🌅'], ['地球是什么形状？', '球体', ['正方体', '圆柱', '平面'], 0, '🌍'],
    ['地球自转一圈大约是？', '一天', ['一个月', '一年', '一小时'], 2, '🔄'], ['地球绕太阳转一圈大约是？', '一年', ['一天', '一个月', '一星期'], 2, '☀️'],
    ['火山喷出的红色液体叫？', '岩浆', ['果汁', '河水', '石油'], 2, '🌋'], ['赤道附近的天气通常？', '炎热', ['寒冷', '常下雪', '结冰'], 3, '🌡️'],
    ['人口最多的大洲是？', '亚洲', ['欧洲', '非洲', '大洋洲'], 3, '🌏'], ['袋鼠生活在哪个大洲？', '大洋洲', ['非洲', '欧洲', '亚洲'], 1, '🦘'],
    ['世界上最大的热带沙漠是？', '撒哈拉沙漠', ['戈壁沙漠', '塔克拉玛干沙漠', '阿拉伯沙漠'], 4, '🏜️'], ['长城主要建在中国的？', '北方', ['南方', '海上', '岛上'], 3, '🧱']];
  G.geo_know = kq(GEO_KNOW);

  /* ================= 国学文化馆 ================= */
  const ZOD = [['🐭', '鼠'], ['🐮', '牛'], ['🐯', '虎'], ['🐰', '兔'], ['🐲', '龙'], ['🐍', '蛇'], ['🐴', '马'], ['🐑', '羊'], ['🐵', '猴'], ['🐔', '鸡'], ['🐶', '狗'], ['🐷', '猪']];
  G.zod_next = g => Array.from({ length: N }, () => { const i = R.int(0, 10); return Q('十二生肖里，' + ZOD[i][1] + '的后面是？', opts(card(ZOD[i + 1][1], ZOD[i + 1][0]), R.sample(ZOD.filter((_, k) => k !== i + 1), 3).map(z => card(z[1], z[0]))), { pe: ZOD[i][0], ps: '十二生肖里，' + ZOD[i][1] + '的后面是谁' }); });
  G.zod_pic = g => pickQ(ZOD, N, x => x[1], (x, o) => Q('这是哪个生肖？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[0], ps: '这是哪个生肖' }));
  G.o_zod = g => Array.from({ length: 4 }, () => { const i = R.int(0, 7); return { p: '按十二生肖的顺序排一排', items: ZOD.slice(i, i + 5).map(z => card(z[1], z[0])) }; });
  G.zod_first = g => kq([['十二生肖排第一的是？', '鼠', ['牛', '龙', '虎'], 0, '🐭'], ['十二生肖排最后的是？', '猪', ['狗', '鸡', '羊'], 0, '🐷'], ['十二生肖一共有几个？', '12个', ['10个', '7个', '24个'], 0, '🐲'], ['龙排在第几位？', '第5位', ['第1位', '第3位', '第8位'], 1, '🐲'], ['猴排在第几位？', '第9位', ['第5位', '第7位', '第12位'], 2, '🐵'], ['在鸡和猪中间的是？', '狗', ['猴', '鼠', '牛'], 1, '🐶'], ['在虎和龙中间的是？', '兔', ['牛', '蛇', '马'], 1, '🐰'], ['在马和猴中间的是？', '羊', ['蛇', '鸡', '狗'], 1, '🐑']])(g);
  const FEST = [['春节', '正月初一', '🧧', '饺子', '贴春联、放鞭炮', 0], ['元宵节', '正月十五', '🏮', '汤圆', '赏花灯、猜灯谜', 0], ['清明节', '四月五日前后', '🌿', '青团', '扫墓、踏青', 1], ['端午节', '五月初五', '🐲', '粽子', '赛龙舟', 0], ['七夕节', '七月初七', '🌌', '巧果', '看牛郎织女星', 2], ['中秋节', '八月十五', '🥮', '月饼', '赏月、团圆', 0], ['重阳节', '九月初九', '⛰️', '重阳糕', '登高、敬老', 2], ['腊八节', '腊月初八', '🥣', '腊八粥', '喝腊八粥', 2]];
  G.fest_food = g => pickQ(byG(FEST, g, 5), N, x => x[3], (x, o) => Q(x[0] + '要吃什么？', opts(card(x[3]), o.map(y => card(y[3]))), { pe: x[2], ps: x[0] + '要吃什么' }));
  G.fest_custom = g => pickQ(byG(FEST, g, 5), N, x => x[0], (x, o) => Q('「' + x[4] + '」是哪个节日的习俗？', opts(card(x[0], x[2]), o.map(y => card(y[0], y[2]))), { ps: x[4] + '，是哪个节日的习俗' }));
  G.fest_date = g => pickQ(FEST, N, x => x[1], (x, o) => Q(x[0] + '是农历哪一天？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[2], ps: x[0] + '是哪一天' }));
  G.p_fest = g => R.sample(byG(FEST, g, 5), 6).map(x => [card(x[0], x[2]), card(x[3])]);
  G.o_fest = g => Array.from({ length: 3 }, () => { const s = R.sample([0, 1, 2, 3, 4, 5, 6, 7], 4).sort((a, b) => a - b); return { p: '按一年里的先后顺序排节日', items: s.map(i => card(FEST[i][0], FEST[i][2])) }; });
  const JIEQI = [['立春', '雨水', '惊蛰', '春分', '清明', '谷雨'], ['立夏', '小满', '芒种', '夏至', '小暑', '大暑'], ['立秋', '处暑', '白露', '秋分', '寒露', '霜降'], ['立冬', '小雪', '大雪', '冬至', '小寒', '大寒']];
  const SEA4 = [['🌸', '春'], ['☀️', '夏'], ['🍁', '秋'], ['⛄', '冬']];
  G.s_jieqi = g => ({ bins: SEA4.map(s => card(s[1] + '季', s[0])), items: R.shuffle(JIEQI.flatMap((l, i) => R.sample(l, 3).map(j => Object.assign(card(j), { b: i })))) });
  G.jieqi_q = g => Array.from({ length: N }, () => { const si = R.int(0, 3), j = R.pick(JIEQI[si]); return Q('节气「' + j + '」在哪个季节？', SEA4.map((s, i) => Object.assign(card(s[1] + '季', s[0]), { ok: i === si })), { pt: j, ps: j + '，在哪个季节' }); });
  G.o_jieqi = g => JIEQI.map((l, i) => ({ p: SEA4[i][1] + '季的节气，按顺序排一排', items: l.slice(0, 5).map(j => card(j)) })).slice(0, 4);
  const PEOPLE = [['蔡伦', '改进造纸术', 2], ['毕昇', '发明活字印刷术', 3], ['张衡', '发明地动仪', 3], ['祖冲之', '精确计算圆周率', 4], ['李时珍', '写了《本草纲目》', 4], ['鲁班', '木匠的祖师', 3], ['孔子', '伟大的教育家', 2], ['司马迁', '写了《史记》', 4]];
  G.people_q = g => pickQ(byG(PEOPLE, g, 2), N, x => x[0], (x, o) => Q('谁「' + x[1] + '」？', opts(card(x[0]), o.map(y => card(y[0]))), { pe: '📜', ps: '谁' + x[1] }));
  G.p_people = g => R.sample(byG(PEOPLE, g, 2), 5).map(x => [card(x[0]), card(x[1])]);
  G.invent_q = g => kq([['中国古代四大发明不包括？', '电灯', ['造纸术', '火药', '指南针'], 2, '💡'], ['指南针可以用来？', '辨别方向', ['计算时间', '称重量', '照明'], 1, '🧭'], ['四大发明中能写字画画的是？', '造纸术', ['火药', '指南针', '印刷术'], 2, '📜'], ['火药最早常被用来做？', '烟花爆竹', ['做饭', '写字', '织布'], 2, '🎆'], ['活字印刷术是谁发明的？', '毕昇', ['蔡伦', '张衡', '李白'], 3, '🔠'], ['造纸术是谁改进的？', '蔡伦', ['毕昇', '鲁班', '孔子'], 3, '📄']])(g);
  const STORY = [['孔融让梨', '孔融', '懂得谦让', '🍐', 0], ['司马光砸缸', '司马光', '遇事冷静又机智', '🏺', 0], ['曹冲称象', '曹冲', '善于动脑筋', '🐘', 1], ['凿壁偷光', '匡衡', '勤奋学习', '🕯️', 2], ['铁杵磨成针', '李白', '做事要坚持', '🪡', 1], ['程门立雪', '杨时', '尊敬老师', '❄️', 3], ['闻鸡起舞', '祖逖', '勤奋努力', '🐓', 3], ['精卫填海', '精卫', '意志坚定', '🐦', 2], ['愚公移山', '愚公', '坚持不懈', '⛰️', 2], ['大禹治水', '大禹', '一心为大家', '🌊', 2], ['乌鸦喝水', '乌鸦', '动脑筋想办法', '🐦‍⬛', 0], ['小马过河', '小马', '要自己亲自试一试', '🐴', 0], ['龟兔赛跑', '乌龟', '坚持就能成功', '🐢', 0]];
  G.story_who = g => pickQ(byG(STORY, g, 4), N, x => x[1], (x, o) => Q('「' + x[0] + '」的主人公是？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[3], ps: x[0] + '的主人公是谁' }));
  G.story_lesson = g => pickQ(byG(STORY, g, 4), N, x => x[2], (x, o) => Q('「' + x[0] + '」告诉我们？', opts(card(x[2]), o.map(y => card(y[2]))), { pe: x[3], ps: x[0] + '告诉我们什么道理' }));
  G.p_story = g => R.sample(uniq(byG(STORY, g, 4), x => x[2]), 5).map(x => [card(x[0], x[3]), card(x[2])]);
  const SANZI = [['人之初', '性本善', 0], ['性相近', '习相远', 0], ['苟不教', '性乃迁', 1], ['教之道', '贵以专', 1], ['昔孟母', '择邻处', 1], ['子不学', '断机杼', 2], ['养不教', '父之过', 1], ['教不严', '师之惰', 1], ['玉不琢', '不成器', 1], ['人不学', '不知义', 1], ['香九龄', '能温席', 2], ['融四岁', '能让梨', 2], ['弟子规', '圣人训', 2], ['首孝悌', '次谨信', 3]];
  G.sanzi_next = g => pickQ(byG(SANZI, g, 2), N, x => x[1], (x, o) => Q('「' + x[0] + '」的下一句是？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: '📖', ps: x[0] + '，下一句是' }));
  G.p_sanzi = g => R.sample(byG(SANZI, g, 2), 6).map(x => [card(x[0]), card(x[1])]);
  G.sp_sanzi = g => R.sample(byG(SANZI, g, 2), 6).map(x => { const ans = (x[0] + x[1]).split(''); const extra = R.sample('天地人上下大小日月山水'.split('').filter(c => !ans.includes(c)), 2); return { p: '拼出《三字经》：' + x[0] + '……', pe: '📖', ans, pool: R.shuffle(ans.concat(extra)), s: x[0] + '，' + x[1], l: 'zh' }; });
  const CULT = [['🏮', '灯笼'], ['🧧', '红包'], ['🥢', '筷子'], ['🪁', '风筝'], ['🍵', '茶'], ['🧨', '鞭炮'], ['🐉', '龙'], ['🥮', '月饼'], ['🪭', '扇子'], ['🥟', '饺子'], ['🎋', '竹子'], ['🫖', '茶壶']];
  G.cult_pic = g => pickQ(CULT, N, x => x[1], (x, o) => Q('这是什么？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[0], ps: '这是什么' }));
  G.cult_find = g => pickQ(CULT, N, x => x[1], (x, o) => Q('找一找：' + x[1], opts(card('', x[0], x[1]), o.map(y => card('', y[0], y[1]))), { pt: x[1], ps: '找一找，' + x[1] }));

  /* ================= 逻辑实验室 ================= */
  const PAT_E = ['🍎', '🍌', '🍇', '⭐', '🌙', '❤️', '🔵', '🟥', '🐱', '🐶', '🌸', '🍀', '⚽', '🎈'];
  G.pattern_q = g => Array.from({ length: N }, () => {
    const types = g <= 0 ? ['AB', 'AAB'] : g <= 1 ? ['AB', 'AAB', 'ABB', 'ABC'] : ['ABC', 'AABB', 'ABBC', 'ABCB', 'AAB'];
    const t = R.pick(types), sym = R.sample(PAT_E, 3), seq = [];
    while (seq.length < 8) seq.push(...t.split('').map(c => sym[c.charCodeAt(0) - 65]));
    const len = R.int(5, 7), ans = seq[len];
    const html = 'html:<div class="seqrow">' + seq.slice(0, len).map(e => '<i data-emo="' + e + '"></i>').join('') + '<b>?</b></div>';
    const wrongs = uniq(sym.filter(e => e !== ans).concat(R.sample(PAT_E.filter(e => !sym.includes(e)), 2)), e => e).slice(0, 3);
    return Q('找规律：下一个是什么？', opts(card('', ans), wrongs.map(e => card('', e))), { pe: html, ps: '找规律，下一个是什么' });
  });
  const ODD = ['fruit', 'animal', 'traffic', 'food', 'thing', 'veg', 'clothes'];
  G.odd_q = g => Array.from({ length: N }, () => {
    const [a, b] = R.sample(ODD.filter(k => D.W[k].g <= g + 1), 2), A = R.sample(D.W[a].items.filter(x => x[4] <= g + 1), 3), B = R.pick(D.W[b].items);
    return Q('哪一个和其他的不是一类？', opts(card(B[1], B[0]), A.map(x => card(x[1], x[0]))), { ps: '哪一个和其他的不是一类', ex: '其他都是' + D.W[a].n });
  });
  G.analogy_q = g => Array.from({ length: N }, () => {
    if (Math.random() < .5) { const [a, b] = R.sample(D.EAT, 2), wr = R.sample(D.EAT.filter(x => x !== b && x[3] !== b[3] && x[3] !== a[3]), 3); return Q(a[1] + '爱吃' + a[3] + '，那' + b[1] + '爱吃？', opts(card(b[3], b[2]), wr.map(x => card(x[3], x[2]))), { pe: 'html:<div class="seqrow"><i data-emo="' + a[0] + '"></i><b>→</b><i data-emo="' + a[2] + '"></i><b>，</b><i data-emo="' + b[0] + '"></i><b>→ ?</b></div>', ps: a[1] + '爱吃' + a[3] + '，那' + b[1] + '爱吃什么' }); }
    const pool = D.FANYI.filter(x => x[2] <= g + 1 && x[0].length === 1), [a, b] = R.sample(pool, 2), wr = R.sample(pool.filter(x => x !== b && x !== a), 3);
    return Q('「' + a[0] + '」对「' + a[1] + '」，那么「' + b[0] + '」对？', opts(card(b[1]), wr.map(x => card(x[1]))), { pt: a[0] + ' → ' + a[1] + '，' + b[0] + ' → ?', ps: a[0] + '对' + a[1] + '，那么' + b[0] + '对什么' });
  });
  // 机器人编程：选择能走到星星的指令
  const ARW = { R: '→', L: '←', U: '↑', D: '↓' };
  const runCode = (s, x, y) => { for (const c of s) { if (c === 'R') x++; if (c === 'L') x--; if (c === 'U') y--; if (c === 'D') y++; } return [x, y]; };
  G.code_q = g => Array.from({ length: N }, () => {
    const S = g <= 1 ? 4 : 5; let x0, y0, x1, y1;
    do { x0 = R.int(0, S - 1); y0 = R.int(0, S - 1); x1 = R.int(0, S - 1); y1 = R.int(0, S - 1); } while (Math.abs(x1 - x0) + Math.abs(y1 - y0) < 2 || (g <= 0 && Math.abs(x1 - x0) + Math.abs(y1 - y0) > 4));
    const hs = (x1 > x0 ? 'R' : 'L').repeat(Math.abs(x1 - x0)), vs = (y1 > y0 ? 'D' : 'U').repeat(Math.abs(y1 - y0)), ans = hs + vs;
    const flip = c => ({ R: 'L', L: 'R', U: 'D', D: 'U' })[c];
    const cands = uniq([hs.split('').map(flip).join('') + vs, hs + vs.split('').map(flip).join(''), hs.slice(1) + vs, hs + vs + (vs ? vs[0] : hs[0]), vs.split('').map(flip).join('') + hs, hs + 'R' + vs, (vs + hs).replace(/./, m => flip(m))].filter(s => s && s !== ans), s => s).filter(s => { const [a, b] = runCode(s, x0, y0); return a !== x1 || b !== y1; });
    const cell = (x, y) => x === x0 && y === y0 ? '<i data-emo="🤖"></i>' : x === x1 && y === y1 ? '<i data-emo="⭐"></i>' : '';
    const html = 'html:<div class="codemap" style="--n:' + S + '">' + Array.from({ length: S * S }, (_, i) => '<span>' + cell(i % S, Math.floor(i / S)) + '</span>').join('') + '</div>';
    const show = s => s.split('').map(c => ARW[c]).join('');
    return Q('哪组指令能让机器人走到⭐？', opts(card(show(ans), '', '这一组'), R.sample(cands, 3).map(s => card(show(s), '', '这一组'))), { pe: html, ps: '哪组指令能让机器人走到星星', latinCh: true });
  });
  // 迷你数独
  G.sudoku_q = g => Array.from({ length: N }, () => {
    const n = g >= 3 ? 4 : 3, sym = R.sample(['🍎', '🍌', '🍇', '🍓', '⭐', '🌙', '❤️', '🔷'], n);
    const rows = R.shuffle([...Array(n).keys()]), cols = R.shuffle([...Array(n).keys()]);
    const grid = rows.map(r => cols.map(c => sym[(r + c) % n]));
    const qx = R.int(0, n - 1), qy = R.int(0, n - 1), ans = grid[qy][qx];
    const blanks = new Set([qy * n + qx]); if (g >= 2) { while (blanks.size < (g >= 3 ? 3 : 2)) { const b = R.int(0, n * n - 1); const by = Math.floor(b / n), bx = b % n; if (by !== qy && bx !== qx) blanks.add(b); } }
    const html = 'html:<div class="sudoku" style="--n:' + n + '">' + grid.flat().map((e, i) => '<span>' + (i === qy * n + qx ? '<b>?</b>' : blanks.has(i) ? '' : '<i data-emo="' + e + '"></i>') + '</span>').join('') + '</div>';
    return Q('每行每列都不能重复，问号处是？', opts(card('', ans), sym.filter(e => e !== ans).slice(0, 3).map(e => card('', e))), { pe: html, ps: '每一行每一列都不能重复，问号处是什么' });
  });
  const NAMES = ['小明', '小红', '小刚', '小美', '小乐'];
  G.compare_logic = g => Array.from({ length: N }, () => {
    const k = g >= 4 ? 4 : 3, ppl = R.sample(NAMES, k), adj = R.pick([['高', '矮'], ['快', '慢'], ['大', '小'], ['重', '轻']]);
    const facts = []; for (let i = 0; i < k - 1; i++) facts.push(ppl[i] + '比' + ppl[i + 1] + adj[0]);
    const askTop = Math.random() < .5, ans = askTop ? ppl[0] : ppl[k - 1];
    const word = adj[0] === '大' ? (askTop ? '年龄最大' : '年龄最小') : '最' + (askTop ? adj[0] : adj[1]);
    const t = R.shuffle(facts).join('，') + '。谁' + word + '？';
    return Q(t, opts(card(ans), R.sample(ppl.filter(x => x !== ans), Math.min(3, k - 1)).map(x => card(x))), { pe: '🤔', ps: t, small: true });
  });
  const WD = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
  G.weekday_q = g => Array.from({ length: N }, () => {
    const t = R.int(0, 6), offs = g <= 1 ? R.pick([[1, '明天'], [-1, '昨天']]) : g === 2 ? R.pick([[1, '明天'], [-1, '昨天'], [2, '后天'], [-2, '前天']]) : (n => [n, n + '天后'])(R.int(3, 10));
    const a = ((t + offs[0]) % 7 + 7) % 7;
    return Q('今天是' + WD[t] + '，' + offs[1] + '是？', opts(card(WD[a]), R.sample(WD.filter((_, i) => i !== a), 3).map(x => card(x))), { pe: '📅', ps: '今天是' + WD[t] + '，' + offs[1] + '是星期几' });
  });
  G.s_fly = g => ({ bins: [card('会飞', '🪽'), card('不会飞', '🦶')], items: R.shuffle([['🐦', '小鸟', 0], ['🦋', '蝴蝶', 0], ['🐝', '蜜蜂', 0], ['🦅', '老鹰', 0], ['🦇', '蝙蝠', 0], ['🦉', '猫头鹰', 0], ['🐧', '企鹅', 1], ['🐶', '小狗', 1], ['🐢', '乌龟', 1], ['🐘', '大象', 1], ['🦒', '长颈鹿', 1], ['🐟', '小鱼', 1]]).slice(0, 10).map(x => Object.assign(card(x[1], x[0]), { b: x[2] })) });
  const SIZES = [[['🐜', '蚂蚁'], ['🐭', '老鼠'], ['🐱', '小猫'], ['🐴', '马'], ['🐘', '大象']], [['🌰', '种子'], ['🌱', '小芽'], ['🌿', '小苗'], ['🌳', '大树']], [['🥚', '鸡蛋'], ['🍎', '苹果'], ['🍉', '西瓜'], ['🚗', '汽车'], ['🏠', '房子']], [['🐛', '毛毛虫'], ['🐸', '青蛙'], ['🐶', '小狗'], ['🦁', '狮子'], ['🐋', '鲸鱼']]];
  G.o_size = g => R.shuffle(SIZES).slice(0, 4).map(s => ({ p: '从小到大排一排', items: s.map(x => card(x[1], x[0])) }));

  /* ================= 职业体验城 ================= */
  const JOBS = [['🧑‍⚕️', '医生', '听诊器', '🩺', '医院', 0], ['🧑‍🍳', '厨师', '锅', '🍳', '厨房', 0], ['🧑‍🚒', '消防员', '灭火器', '🧯', '消防站', 0], ['👮', '警察', '警车', '🚓', '派出所', 0], ['🧑‍🏫', '老师', '课本', '📚', '学校', 0], ['🧑‍🎨', '画家', '调色盘', '🎨', '画室', 1], ['🧑‍🌾', '农民', '稻谷', '🌾', '农田', 0], ['🧑‍🚀', '宇航员', '火箭', '🚀', '太空', 0], ['🧑‍✈️', '飞行员', '飞机', '✈️', '机场', 1], ['🧑‍🔬', '科学家', '显微镜', '🔬', '实验室', 1], ['🧑‍🎤', '歌手', '话筒', '🎤', '舞台', 1], ['🧑‍💻', '程序员', '电脑', '💻', '办公室', 2], ['🧑‍🔧', '修理工', '扳手', '🔧', '修理厂', 1], ['💇', '理发师', '剪刀', '✂️', '理发店', 1], ['🧑‍🏭', '工人', '机器', '⚙️', '工厂', 2]];
  G.job_tool = g => pickQ(byG(JOBS, g, 5), N, x => x[2], (x, o) => Q(x[1] + '工作时用什么？', opts(card(x[2], x[3]), o.map(y => card(y[2], y[3]))), { pe: x[0], ps: x[1] + '工作时用什么' }));
  G.job_place = g => pickQ(byG(JOBS, g, 5), N, x => x[4], (x, o) => Q(x[1] + '在哪里工作？', opts(card(x[4]), o.map(y => card(y[4]))), { pe: x[0], ps: x[1] + '在哪里工作' }));
  G.job_pic = g => pickQ(byG(JOBS, g, 5), N, x => x[1], (x, o) => Q('图上的人是做什么工作的？', opts(card(x[1]), o.map(y => card(y[1]))), { pe: x[0], ps: '图上的人是做什么工作的' }));
  G.job_who = g => pickQ(byG(JOBS, g, 5), N, x => x[1], (x, o) => Q('谁会用「' + x[2] + '」？', opts(card(x[1], x[0]), o.map(y => card(y[1], y[0]))), { pe: x[3], ps: '谁会用' + x[2] }));
  G.p_job = g => R.sample(byG(JOBS, g, 5), 6).map(x => [card(x[1], x[0]), card(x[2], x[3])]);
  G.p_job_place = g => R.sample(uniq(byG(JOBS, g, 5), x => x[4]), 6).map(x => [card(x[1], x[0]), card(x[4])]);
  G.s_job = g => ({ bins: [card('治病救人', '🏥'), card('保护安全', '🛡️'), card('提供食物', '🍚')], items: R.shuffle([['🧑‍⚕️', '医生', 0], ['💉', '护士', 0], ['🦷', '牙医', 0], ['👮', '警察', 1], ['🧑‍🚒', '消防员', 1], ['💂', '保安', 1], ['🧑‍🌾', '农民', 2], ['🧑‍🍳', '厨师', 2], ['🎣', '渔民', 2]]).map(x => Object.assign(card(x[1], x[0]), { b: x[2] })) });
  const PLACES = [['🏥', '医院', '生病了要看医生'], ['🏫', '学校', '要上课学习'], ['🏦', '银行', '要把钱存起来'], ['🛒', '超市', '要买菜买零食'], ['🏤', '邮局', '要寄信寄包裹'], ['📚', '图书馆', '想借书看书'], ['🏞️', '公园', '想散步玩耍'], ['⛽', '加油站', '汽车没油了'], ['💈', '理发店', '头发太长了'], ['🍽️', '餐厅', '想吃饭'], ['🚉', '火车站', '要坐火车'], ['🦁', '动物园', '想看大老虎']];
  G.place_q = g => pickQ(PLACES, N, x => x[1], (x, o) => Q(x[2] + '，应该去哪里？', opts(card(x[1], x[0]), o.map(y => card(y[1], y[0]))), { ps: x[2] + '，应该去哪里' }));
  G.p_place = g => R.sample(PLACES, 6).map(x => [card(x[2]), card(x[1], x[0])]);
  const TOOLS = [['✂️', '剪刀', '剪纸'], ['🔨', '锤子', '钉钉子'], ['📏', '尺子', '量长度'], ['⚖️', '秤', '称重量'], ['🌡️', '温度计', '量体温'], ['🔍', '放大镜', '看清小东西'], ['🧹', '扫帚', '扫地'], ['🪣', '水桶', '装水'], ['🔦', '手电筒', '在黑暗里照亮'], ['🧲', '磁铁', '吸起铁钉'], ['🪛', '螺丝刀', '拧螺丝'], ['⏰', '闹钟', '按时叫醒我们']];
  G.tool_q = g => pickQ(TOOLS, N, x => x[1], (x, o) => Q('想要「' + x[2] + '」，用什么工具？', opts(card(x[1], x[0]), o.map(y => card(y[1], y[0]))), { ps: '想要' + x[2] + '，用什么工具' }));
  G.p_tool = g => R.sample(TOOLS, 6).map(x => [card(x[1], x[0]), card(x[2])]);
  const GOODS = [['✏️', '铅笔', 2], ['📒', '本子', 5], ['🧃', '果汁', 4], ['🍦', '冰淇淋', 6], ['🎈', '气球', 3], ['🧸', '玩具熊', 25], ['⚽', '足球', 30], ['📚', '故事书', 18], ['🍎', '苹果', 3], ['🍞', '面包', 8], ['🖍️', '蜡笔', 12], ['🪁', '风筝', 20]];
  G.budget_q = g => Array.from({ length: N }, () => {
    const it = R.sample(uniq(R.shuffle(GOODS), x => x[2]), 4).sort((a, b) => a[2] - b[2]), t = R.int(0, 2);
    if (t === 0) return Q('哪一样最便宜？', it.map((x, i) => Object.assign(card(x[1] + ' ' + x[2] + '元', x[0], x[1] + x[2] + '元'), { ok: i === 0 })), { ps: '哪一样最便宜', latinCh: false });
    if (t === 1) return Q('哪一样最贵？', it.map((x, i) => Object.assign(card(x[1] + ' ' + x[2] + '元', x[0], x[1] + x[2] + '元'), { ok: i === 3 })), { ps: '哪一样最贵' });
    const money = it[0][2] + R.int(0, it[1][2] - it[0][2] - 1 >= 0 ? it[1][2] - it[0][2] - 1 : 0);
    return Q('你有' + money + '元，买得起哪一样？', R.shuffle(it.map((x, i) => Object.assign(card(x[1] + ' ' + x[2] + '元', x[0], x[1] + x[2] + '元'), { ok: i === 0 }))), { pe: '👛', ps: '你有' + money + '元，买得起哪一样' });
  });
  const MONEY_TF = [['把零花钱存进储蓄罐是好习惯', true, '存钱可以买更想要的东西。', 0, '🐷'], ['想要的东西都必须马上买', false, '先想想是需要的还是想要的。', 1, '🛍️'], ['钱是爸爸妈妈辛苦工作换来的', true, '要珍惜家人的劳动。', 0, '💼'], ['可以随便拿别人的钱', false, '别人的东西不能随便拿。', 0, '🚫'], ['买东西前可以比一比价格', true, '货比三家更划算。', 2, '🏷️'], ['捡到钱要交给警察或老师', true, '拾金不昧。', 0, '👮'], ['银行是存钱的地方', true, '钱存在银行很安全。', 1, '🏦'], ['钱越多越要乱花', false, '花钱要有计划。', 1, '💸'], ['零花钱可以记账', true, '记账能知道钱花在哪里。', 3, '📒']];
  G.money_tf = g => pickQ(byG(MONEY_TF, g, 3), N, x => x[0], f => Q(f[0], [Object.assign(card('对', '✅', '对'), { ok: f[1] }), Object.assign(card('不对', '❌', '不对'), { ok: !f[1] })], { pe: f[4], ps: f[0], ex: f[2], small: true, tf: true }));

  /* ================= 描红 / 天平 ================= */
  G.tr_hz = g => R.sample(byG(D.HANZI, g, 3), 5).map(x => ({ ch: x[0], sub: x[1], e: x[2], s: x[0], l: 'zh' }));
  G.tr_abc = g => R.sample('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), 5).map(L => ({ ch: g >= 1 && Math.random() < .5 ? L.toLowerCase() : L, s: L, l: 'en', font: 'latin' }));
  G.tr_num = g => R.sample('0123456789'.split(''), 5).map(n => ({ ch: n, s: n, l: 'zh', font: 'latin' }));
  G.tr_sz = g => R.sample(D.ZODIAC_CH || ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'], 5).map(c => ({ ch: c, s: c, l: 'zh' }));
  G.bal = g => Array.from({ length: 6 }, () => {
    const ws = g <= 0 ? [1, 2, 3, 4, 5] : g === 1 ? [1, 2, 3, 5, 6, 8, 10] : g === 2 ? [2, 3, 5, 10, 15, 20, 25] : [3, 5, 7, 10, 12, 20, 25, 50];
    const sol = R.sample(ws, R.int(2, 3)), target = sol.reduce((a, b) => a + b, 0);
    const extra = R.sample(ws.filter(w => !sol.includes(w)), Math.min(3, ws.length - sol.length));
    let show = String(target);
    if (g >= 3 && Math.random() < .6) { const f = []; for (let a = 2; a <= 12; a++) if (target % a === 0 && target / a >= 2 && target / a <= 12) f.push(a); if (f.length) { const a = R.pick(f); show = a + ' × ' + (target / a); } }
    else if (g >= 1 && Math.random() < .5) { const a = R.int(1, target - 1); show = a + ' + ' + (target - a); }
    return { target, show, sol, weights: R.shuffle(sol.concat(extra)) };
  });
})();
