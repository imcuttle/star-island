// 打包带骨骼动画的角色 / 宠物模型 → assets/models/c/<key>.js（base64，按需用 <script> 加载，file:// 可用）+ index.js
// 用法：node tools/pack_chars.cjs <素材目录>    （目录下 heroes/*.glb、pets/*.glb，映射见下方 LIST）
// 会先去掉用不到的动作（拿枪、侧移等），再用 gltf-transform 清理未引用数据、合并重复、重采样动画
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const SRC = process.argv[2] || '/tmp/si-assets';
const OUT = path.join(__dirname, '../assets/models/c'); fs.mkdirSync(OUT, { recursive: true });
const DROP = /gun|shoot|pointing|run_back|run_left|run_right|_holding|assembly|chop_|pan_|weapon|idle_sword|wheelchair|roll$|duck$|fast_flying/i;
// key: [文件, 额外信息]
const LIST = {
  kid_boy1: ['heroes/kid_boy1.glb'], kid_boy2: ['heroes/kid_boy2.glb'], kid_boy3: ['heroes/kid_boy3.glb'],
  kid_girl1: ['heroes/kid_girl1.glb'], kid_girl2: ['heroes/kid_girl2.glb'], kid_girl3: ['heroes/kid_girl3.glb'],
  wizard: ['heroes/wizard.glb'], superhero: ['heroes/superhero.glb'], ninja: ['heroes/ninja.glb'], astronaut: ['heroes/astronaut.glb'],
  elf: ['heroes/elf.glb'], scientist: ['heroes/scientist.glb'], robot: ['heroes/robot.glb'], fox: ['pets/fox.glb'],
  bunny: ['pets/bunny.glb'], panda: ['pets/panda.glb'], cat: ['pets/cat.glb'], chick: ['pets/chick.glb'], frog: ['pets/frog.glb'],
  shiba: ['pets/shiba.glb'], husky: ['pets/husky.glb'], deer: ['pets/deer.glb'], stag: ['pets/stag.glb'], alpaca: ['pets/alpaca.glb'],
  pony: ['pets/pony.glb'], unicorn: ['pets/unicorn_base.glb'], dragon: ['pets/dragon.glb'], dragon_king: ['pets/dragon_king.glb'],
  ghost: ['pets/ghost.glb'], slime_green: ['pets/slime_green.glb'], slime_pink: ['pets/slime_pink.glb'], bluebird: ['pets/bluebird.glb'],
  puffbird: ['pets/puffbird.glb'], mushroom: ['pets/mushroom.glb'], cactus: ['pets/cactus.glb'], yeti: ['pets/yeti.glb'], alpaking: ['pets/alpaking.glb'],
};
const extra = fs.existsSync(path.join(SRC, 'extra.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'extra.json'), 'utf8')) : {};
Object.assign(LIST, extra);
const pad4 = n => (n + 3) & ~3;
function dropAnims(file, out) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString());
  const rest = b.slice(20 + jl);
  const keep = (json.animations || []).filter(a => !DROP.test(a.name.replace(/^.*\|/, '')));
  json.animations = keep.length ? keep : json.animations;
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc(pad4(js.length) - js.length, 0x20)]);
  const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + rest.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.write('JSON', 4);
  fs.writeFileSync(out, Buffer.concat([head, c1, js, rest]));
}
const index = {}; let total = 0;
for (const [key, [rel, meta]] of Object.entries(LIST)) {
  const src = path.join(SRC, rel); if (!fs.existsSync(src)) { console.log('skip', key); continue; }
  const t1 = '/tmp/pc_' + key + '_a.glb', t2 = '/tmp/pc_' + key + '_b.glb';
  dropAnims(src, t1);
  try { execSync('npx -y @gltf-transform/cli@4 prune ' + t1 + ' ' + t2 + ' && npx -y @gltf-transform/cli@4 dedup ' + t2 + ' ' + t2 + ' && npx -y @gltf-transform/cli@4 resample ' + t2 + ' ' + t2, { stdio: 'pipe' }); } catch (e) { fs.copyFileSync(t1, t2); }
  const buf = fs.readFileSync(t2); total += buf.length;
  fs.writeFileSync(path.join(OUT, key + '.js'), '__CH(' + JSON.stringify(key) + ',"' + buf.toString('base64') + '");');
  const j = JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString());
  index[key] = Object.assign({ anims: (j.animations || []).map(a => a.name) }, meta || {});
  console.log(key, (fs.statSync(src).size / 1024 | 0) + 'K ->', (buf.length / 1024 | 0) + 'K', index[key].anims.length, 'anims');
}
fs.writeFileSync(path.join(OUT, 'index.js'), 'window.CHAR_INDEX=' + JSON.stringify(index) + ';');
console.log(Object.keys(index).length, 'models', (total / 1048576).toFixed(1), 'MB raw');
