// 收集所有可预生成的朗读文本 → /tmp/voice_all.json，然后运行 python3 tools/gen_voice.py /tmp/voice_all.json
// 含数字 / 动态内容的句子不整句录音，而是拆成「小句片段 + 数字」（规则见 js/voiceseg.js），运行时拼接播放
const fs = require('fs'), path = require('path'), vm = require('vm');
const c = require('./load.cjs'); const { G } = c.CONTENT;
const sctx = {}; sctx.window = sctx; vm.createContext(sctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/voiceseg.js'), 'utf8'), sctx);
const VSEG = sctx.VSEG;
const set = new Set();
const frag = t => VSEG.fragKeys(t).forEach(k => { if (k.length <= 40) set.add('zh|' + k); });
// 高频的「数字 + 文字」句子另外整句录音（拼接听起来生硬），按出现次数取前 FULL_N 个；运行时优先用整句
const FULL_N = 3000, fullCnt = new Map();
const countFull = t => { const n = VSEG.norm(t); if (n.length > 40) return; let k = 0; VSEG.pieces(n).forEach(x => { if (x.t) k++; if (x.n) k += VSEG.numKeys(x.n, x.liang).length; }); if (k >= 2) fullCnt.set(n, (fullCnt.get(n) || 0) + 1); };
const add = (t, l) => {
  if (!t || typeof t !== 'string') return; t = t.trim(); if (!t) return; l = l || 'zh';
  if (l === 'zh' && /\d/.test(t)) { countFull(t); return frag(t); }
  set.add(l + '|' + t);
  if (l === 'zh' && /[，。！？、；：]/.test(t.replace(/[。！？]$/, ''))) frag(t); // 长句也备好小句，供动态拼接
};
// 数字：0-999 整读，万 / 千 / 两 / 点 等拼接用片段
for (let i = 0; i <= 999; i++) set.add('zh|#' + i);
['两', '点', '万'].forEach(k => set.add('zh|#' + k));
for (let i = 1; i <= 9; i++) { set.add('zh|#' + i + '千'); set.add('zh|#' + i + '万'); }
// 递归收集：题目字段 + 所有 {s, l} 卡片
const walk = (o, depth) => {
  if (!o || typeof o !== 'object' || depth > 6 || o.noPre) return;
  if (Array.isArray(o)) return o.forEach(x => walk(x, depth + 1));
  if (o.ch) { add(o.ps || o.p, o.psl); if (o.listen) add(o.listen, o.psl); if (o.ex) { add(o.ex); add('正确答案：' + o.ex); } o.ch.forEach(x => { if (!x.s && x.t) add(x.t, x.l); }); }
  if (o.items && o.p && !o.ch) { add(o.p); if (o.join != null) add(o.items.map(a => a.s).join(o.join), o.l || 'zh'); }
  if (o.ans && o.p) { add(o.s, o.l); add(o.p.replace(/^.*：/, '')); }
  if (typeof o.s === 'string') add(o.s, o.l);
  Object.values(o).forEach(v => { if (v && typeof v === 'object') walk(v, depth + 1); });
};
for (const gm of c.CATALOG.GAMES) { const f = G[gm.gen]; if (!f) continue; for (let g = gm.g0; g <= gm.g1; g++) for (let k = 0; k < 80; k++) { try { walk(f(g), 0); } catch (e) {} } }
[...fullCnt].sort((a, b) => b[1] - a[1]).slice(0, FULL_N).forEach(([n]) => set.add('zh|' + n));
const js = n => fs.readFileSync(path.join(__dirname, '../js', n), 'utf8');
const files = fs.readdirSync(path.join(__dirname, '../js')).filter(f => /\.js$/.test(f) && !/manifest|voiceseg/.test(f));
const src = files.map(js).join('\n');
// Voice.say(...) 里的所有字符串字面量（含拼接模板的固定部分）
for (const m of src.matchAll(/Voice\.say\(([^;]*?)\)(?:[;,.)]|\s)/g)) for (const s of m[1].matchAll(/'([^'\\]+)'/g)) if (!/^(zh|en)$/.test(s[1])) add(s[1]);
// 界面上的点读文字：data-say="..." / say: '...' / SAY_LIST
for (const m of src.matchAll(/data-say="([^"<>+]+)"/g)) add(m[1]);
for (const m of src.matchAll(/\bsay: '([^'\\]+)'/g)) add(m[1]);
for (const m of src.matchAll(/SAY_LIST = (\[[\s\S]*?\]);/g)) JSON.parse(m[1].replace(/'/g, '"')).forEach(t => add(t));
// 家园 / 探索：宠物、装备、场景、地点的名字（悬停点读）和固定台词
const homeSrc = ['home.js', 'sketch.js', 'explore.js', 'bond.js', 'battle5.js'].filter(f => fs.existsSync(path.join(__dirname, '../js', f))).map(js).join('\n');
for (const m of homeSrc.matchAll(/\bn: '([^'\\]+)'/g)) add(m[1]);
for (const m of homeSrc.matchAll(/\bnpc: '([^'\\]+)'/g)) add(m[1]);
for (const m of homeSrc.matchAll(/dialog\([^,()]+, '([^'\\]+)'/g)) add(m[1]);
// 伙伴对话：开场白、提问、回应选项、各种反应（S.say / R.pick 里的字符串）
for (const m of homeSrc.matchAll(/\b(?:intro|s): '([^'\\]+)'/g)) add(m[1]);
for (const m of homeSrc.matchAll(/\['([^'\\]{2,30})', -?\d\]/g)) add(m[1]);
for (const m of homeSrc.matchAll(/S\.say\(([^;]*?)\)/g)) for (const t of m[1].matchAll(/'([^'\\]+)'/g)) add(t[1]);
for (const m of homeSrc.matchAll(/R\.pick\(\[([^\]]*)\]\)/g)) for (const t of m[1].matchAll(/'([^'\\]+)'/g)) if (!/^[a-z_]+$/.test(t[1])) add(t[1]);
['知识提升了！', '胆量提升了！', '灵巧提升了！', '温柔提升了！', '魅力提升了！', '羁绊加深了！', '我就是你的伙伴！'].forEach(t => add(t));
const eng = js('engines.js');
['PRAISE', 'OOPS'].forEach(k => JSON.parse(eng.match(new RegExp('const ' + k + ' = (\\[.*?\\]);'))[1].replace(/'/g, '"')).forEach(t => add(t)));
['完美通关！', '很棒！再努力一点就三星啦', '通关啦！继续加油', '别灰心，再试一次一定行！', '把它们送到正确的地方', '取消', '确定', '要退出这一局吗？', '要逃跑吗？'].forEach(t => add(t));
// 所有玩法说明（HELP / HELP2 对象里的字符串）
const HELP = {};
for (const blk of src.matchAll(/HELP2? = \{([\s\S]*?)\n?\s*\};|HELP2, \{([\s\S]*?)\n\s*\}\);/g)) for (const m of (blk[1] || blk[2]).matchAll(/(\w+): '([^']+)'/g)) HELP[m[1]] = m[2];
c.CATALOG.GAMES.forEach(g => { if (HELP[g.eng]) add(g.name + '。' + HELP[g.eng]); add(g.name); });
Object.values(HELP).forEach(t => add(t));
c.CATALOG.ZONES.forEach(z => { add(z.name); add(z.boss.name); add(z.boss.name + '出现了！答对题目就能攻击它！'); });
// 家园、宠物等模块的台词表（由 js/home.js 导出 window.HOME_LINES，这里直接解析源码里的 SAY_LIST）
fs.writeFileSync('/tmp/voice_all.json', JSON.stringify([...set])); console.log(set.size, 'texts;', Object.keys(HELP).length, 'help entries');
