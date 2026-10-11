// 把 Kenney GLB（外链 Textures/colormap.png）打包成自带贴图的 GLB，再汇总成 assets/models/models.js（base64，file:// 也能用）
// 用法：node tools/pack_models.cjs <源目录> 名字=相对路径 ...
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '../assets/models/models.js');
const pad4 = n => (n + 3) & ~3;
function embed(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString());
  const binStart = 20 + pad4(jl), binLen = b.length > binStart ? b.readUInt32LE(binStart) : 0;
  let bin = binLen ? b.slice(binStart + 8, binStart + 8 + binLen) : Buffer.alloc(0);
  (json.images || []).forEach(img => {
    if (!img.uri) return;
    const png = fs.readFileSync(path.join(path.dirname(file), decodeURIComponent(img.uri)));
    const off = pad4(bin.length); bin = Buffer.concat([bin, Buffer.alloc(off - bin.length), png]);
    json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: png.length }); img.bufferView = json.bufferViews.length - 1; img.mimeType = 'image/png'; delete img.uri;
  });
  if (!json.buffers || !json.buffers.length) json.buffers = [{ byteLength: 0 }];
  bin = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length)]); json.buffers[0].byteLength = bin.length; delete json.buffers[0].uri;
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc(pad4(js.length) - js.length, 0x20)]);
  const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.write('JSON', 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([head, c1, js, c2, bin]);
}
const [src, ...pairs] = process.argv.slice(2);
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8').replace(/^window\.MODELS=/, '').replace(/;\s*$/, '')) : {};
pairs.forEach(p => { const [name, rel] = p.split('='); old[name] = embed(path.join(src, rel)).toString('base64'); });
fs.writeFileSync(OUT, 'window.MODELS=' + JSON.stringify(old) + ';');
console.log(Object.keys(old).length, 'models', (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB');
