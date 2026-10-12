// 本地 https 静态服务：手机浏览器只有在 https 下才能开摄像头 / 麦克风，用它在局域网里测网页版体感
// 用法：npm run serve:https                    先构建再托管 dist/
//       node tools/serve_https.mjs --src        直接托管源码目录（改完刷新就生效，不用构建）
//       node tools/serve_https.mjs --port=9443  指定端口（默认 8443，被占用就往后找）
// 自签名证书（含 localhost 和本机局域网 IP）缓存在 node_modules/.cache/star-https.json；手机第一次打开提示不安全时点「高级 → 继续访问」
import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import selfsigned from 'selfsigned';
import QRCode from 'qrcode';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const src = args.includes('--src');
const dir = src ? root : path.join(root, 'dist');
const port0 = +((args.find(a => a.startsWith('--port=')) || '').split('=')[1] || 8443);
if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error(dir + ' 下没有 index.html，先运行 npm run build'); process.exit(1); }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
  '.task': 'application/octet-stream', '.gz': 'application/gzip', '.ico': 'image/x-icon',
};

// 局域网 IPv4（排除虚拟网卡）
const ips = Object.entries(os.networkInterfaces()).flatMap(([n, l]) => (l || []).filter(a => a.family === 'IPv4' && !a.internal && !/^(utun|awdl|llw|bridge|vmnet|vboxnet|docker|veth)/i.test(n)).map(a => a.address));

// 证书：IP 变了或快过期就重新生成
async function cert() {
  const f = path.join(root, 'node_modules/.cache/star-https.json');
  try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); if (c.ips === ips.join(',') && c.until > Date.now() + 86400e3) return c; } catch (e) {}
  const until = Date.now() + 360 * 86400e3;
  const p = await selfsigned.generate([{ name: 'commonName', value: 'star-island.local' }], {
    keySize: 2048, algorithm: 'sha256', notAfterDate: new Date(until),
    extensions: [{ name: 'basicConstraints', cA: false }, { name: 'keyUsage', digitalSignature: true, keyEncipherment: true }, { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }].concat(ips.map(ip => ({ type: 7, ip }))) }],
  });
  const c = { key: p.private, cert: p.cert, ips: ips.join(','), until };
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(c));
  return c;
}

function handler(req, res) {
  let p; try { p = decodeURIComponent(new URL(req.url, 'https://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  if (src && /^\/(node_modules|electron|tools|dist|release|\.git)(\/|$)/.test(p)) { res.writeHead(403); return res.end(); }
  const f = path.normalize(path.join(dir, p));
  if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    const head = { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes',
      'Permissions-Policy': 'camera=(self), microphone=(self), fullscreen=(self), screen-wake-lock=(self)' };
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const s = range[1] ? +range[1] : 0, e = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
      res.writeHead(206, Object.assign(head, { 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 }));
      return fs.createReadStream(f, { start: s, end: e }).pipe(res);
    }
    res.writeHead(200, Object.assign(head, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(f).pipe(res);
  });
}

const c = await cert();
const server = https.createServer({ key: c.key, cert: c.cert }, handler);
const listen = p => new Promise((ok, bad) => { server.once('error', e => e.code === 'EADDRINUSE' && p < port0 + 30 ? ok(listen(p + 1)) : bad(e)); server.listen(p, '0.0.0.0', () => ok(p)); });
const port = await listen(port0);
const urls = ['https://localhost:' + port + '/'].concat(ips.map(ip => 'https://' + ip + ':' + port + '/'));
console.log('\n星星岛 https 静态服务（' + (src ? '源码目录' : 'dist/') + '）');
urls.forEach(u => console.log('  ' + u));
if (ips.length) {
  console.log('\n手机连同一个 Wi-Fi，扫码打开（提示证书不安全时点「高级 → 继续访问」）：');
  console.log(await QRCode.toString(urls[1], { type: 'terminal', small: true }));
}
console.log('按 Ctrl+C 停止');
