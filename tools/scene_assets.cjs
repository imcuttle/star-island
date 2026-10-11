// 静态扫描每个脚本里写死的字符串 → js/scene-assets.js
// 进入某个场景前，预加载器按这里的清单把该场景代码里会用到的语音、表情图片、图片全部下载好（断网后场景里也都能用）
// 构建（npm run build）时自动运行；改了台词 / 语音包后也可以单独运行：node tools/scene_assets.cjs
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), JS = path.join(root, 'js');
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(JS, 'voice-manifest.js'), 'utf8'), ctx);
const V = ctx.VOICE || {};
const EMO_RE = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*)/gu;
const out = {};
const files = fs.readdirSync(JS).filter(f => /\.js$/.test(f) && !/manifest|scene-assets|voiceseg|netload/.test(f));
for (const f of files) {
  const src = fs.readFileSync(path.join(JS, f), 'utf8');
  const v = new Set(), e = new Set(), i = new Set();
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.){1,400})'|"((?:[^"\\\n]|\\.){1,400})"|`([^`]{1,400})`/g)) {
    const s = (m[1] || m[2] || m[3] || '').replace(/\\'/g, "'");
    if (!s) continue;
    for (const l of ['zh', 'en']) if (V[l + '|' + s.trim()]) v.add(V[l + '|' + s.trim()]);
    (s.match(EMO_RE) || []).forEach(ch => { if (!/^[#*0-9]$/.test(ch)) e.add(ch); });
    for (const p of s.matchAll(/assets\/img\/[\w\/.-]+\.(?:png|jpe?g|webp|svg)/g)) i.add(p[0]);
  }
  out[f.replace(/\.js$/, '')] = { v: [...v], e: [...e].join(' '), i: [...i] };
}
fs.writeFileSync(path.join(JS, 'scene-assets.js'), '/* 自动生成：node tools/scene_assets.cjs */\nwindow.SCENE_ASSETS=' + JSON.stringify(out) + ';\n');
console.log('scene-assets:', Object.entries(out).map(([k, x]) => k + ' v' + x.v.length + ' e' + x.e.split(' ').filter(Boolean).length + ' i' + x.i.length).join(', '));
