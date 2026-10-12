/* 星星岛 Electron 版：和静态网页版用同一份 index.html / js / assets，另外注入体感游戏模块（motion/）
   · 本机页面走 http://127.0.0.1（安全上下文，摄像头 / 麦克风可用）
   · 手机输入端走局域网 https（自签名证书；手机浏览器只有在 https 下才允许打开摄像头和麦克风）
   · 同一个 WebSocket 中转：电脑页面（host）⇄ 手机（phone），用来做 WebRTC 信令，以及 WebRTC 连不上时的 JPEG 帧 / 语音文字兜底通道
   · /proxy/mjpeg：把局域网「IP 摄像头」App 的 MJPEG 视频流转成同源地址（跨域画面不能拿去做动作识别） */
const { app, BrowserWindow, ipcMain, session, systemPreferences, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const ROOT = path.resolve(__dirname, '..');
const PHONE_DIR = path.join(ROOT, 'motion/phone');
const argv = process.argv.slice(1);
const arg = k => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : (argv.includes('--' + k) ? true : null); };

// 测试用：--fake-cam=视频.y4m（或 .mjpeg）当作摄像头；--fake-mic=声音.wav
const fakeCam = arg('fake-cam') || process.env.STAR_FAKE_CAM;
const fakeMic = arg('fake-mic') || process.env.STAR_FAKE_MIC;
if (fakeCam || fakeMic) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  if (typeof fakeCam === 'string') app.commandLine.appendSwitch('use-file-for-fake-video-capture', path.resolve(fakeCam));
  if (typeof fakeMic === 'string') app.commandLine.appendSwitch('use-file-for-fake-audio-capture', path.resolve(fakeMic));
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// 测试模式（假摄像头）：每次用独立的临时用户目录，可以同时开多个实例
if (fakeCam || fakeMic) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'star-test-')));
else if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.gz': 'application/gzip', '.ico': 'image/x-icon',
};

/* ---------- 局域网地址 ---------- */
function lanIPs() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) {
    if (a.family !== 'IPv4' || a.internal) continue;
    if (/^(utun|awdl|llw|bridge|vmnet|vboxnet|docker|veth)/i.test(name)) continue;
    out.push({ ip: a.address, name });
  }
  // 常见的家用网段排前面（en0 / wlan）
  out.sort((a, b) => (/^(en0|wlan|wi-?fi|eth0)/i.test(b.name) ? 1 : 0) - (/^(en0|wlan|wi-?fi|eth0)/i.test(a.name) ? 1 : 0));
  return out;
}
const isPrivateHost = h => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.|localhost$)/.test(h) || /\.local$/.test(h);

/* ---------- 自签名证书（存到用户目录，局域网 IP 变了就重新生成） ---------- */
async function certFor(ips) {
  const file = path.join(app.getPath('userData'), 'lan-cert.json');
  try { const c = JSON.parse(fs.readFileSync(file, 'utf8')); if (c.ips === ips.join(',') && c.until > Date.now() + 86400e3) return c; } catch (e) {}
  const selfsigned = require('selfsigned');
  const until = Date.now() + 360 * 86400e3;
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'star-island.local' }, { name: 'organizationName', value: 'Star Island' }], {
    keySize: 2048, algorithm: 'sha256', notAfterDate: new Date(until),
    extensions: [{ name: 'basicConstraints', cA: false }, { name: 'keyUsage', digitalSignature: true, keyEncipherment: true }, { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }].concat(ips.map(ip => ({ type: 7, ip }))) }],
  });
  const c = { key: pems.private, cert: pems.cert, fingerprint: pems.fingerprint, ips: ips.join(','), until };
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(c)); } catch (e) {}
  return c;
}

/* ---------- 静态文件 ---------- */
function sendFile(res, file, req) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const head = { 'Content-Type': type, 'Cache-Control': /\/(assets|motion\/vendor)\//.test(file.replace(/\\/g, '/')) ? 'public, max-age=86400' : 'no-cache', 'Accept-Ranges': 'bytes',
      'Cross-Origin-Resource-Policy': 'cross-origin' };
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const s = range[1] ? +range[1] : 0, e = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
      res.writeHead(206, Object.assign(head, { 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 }));
      return fs.createReadStream(file, { start: s, end: e }).pipe(res);
    }
    res.writeHead(200, Object.assign(head, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function safeJoin(base, rel) { const p = path.normalize(path.join(base, rel)); return p.startsWith(base) ? p : null; }

let state = { token: crypto.randomBytes(6).toString('hex'), httpPort: 0, httpsPort: 0, lanHttpPort: 0, ips: [], fingerprint: '' };

// 电脑页面：整个项目目录
function hostHandler(req, res) {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/proxy/mjpeg') return proxyMjpeg(u.searchParams.get('url'), req, res);
  if (p === '/api/info') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(info())); }
  if (p.startsWith('/phone')) return phoneHandler(req, res);
  if (p === '/') p = '/index.html';
  if (/^\/(node_modules|electron|tools|\.git)/.test(p)) { res.writeHead(403); return res.end(); }
  const f = safeJoin(ROOT, p); if (!f) { res.writeHead(403); return res.end(); }
  sendFile(res, f, req);
}
// 手机端：只开放 /phone/ 下的页面
function phoneHandler(req, res) {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/' || p === '/phone') { res.writeHead(302, { Location: '/phone/' + (u.search || '') }); return res.end(); }
  if (!p.startsWith('/phone/')) { res.writeHead(404); return res.end(); }
  p = p.slice('/phone/'.length) || 'index.html';
  const f = safeJoin(PHONE_DIR, p); if (!f) { res.writeHead(403); return res.end(); }
  sendFile(res, f, req);
}
// MJPEG 中转：只允许局域网地址
function proxyMjpeg(target, req, res) {
  let t; try { t = new URL(target); } catch (e) { res.writeHead(400); return res.end('bad url'); }
  if (!/^https?:$/.test(t.protocol) || !isPrivateHost(t.hostname)) { res.writeHead(403); return res.end('only LAN cameras'); }
  const mod = t.protocol === 'https:' ? https : http;
  const up = mod.get(t, { rejectUnauthorized: false, timeout: 8000 }, r => {
    res.writeHead(r.statusCode || 502, { 'Content-Type': r.headers['content-type'] || 'multipart/x-mixed-replace', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
    r.pipe(res);
  });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  up.on('timeout', () => up.destroy());
  req.on('close', () => up.destroy());
}

/* ---------- WebSocket 中转 ----------
   host：电脑页面（只能从 127.0.0.1 连接）；phone：手机（带 token 校验）
   文本消息是 JSON：{to, type, ...}，中转时补上 from；二进制消息（手机 JPEG 帧）前面加 1 字节手机编号再转给 host */
const peers = new Map(); let hostWs = null, nextId = 1;
function attachWS(server, isLocal) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4 * 1024 * 1024 });
  wss.on('connection', (ws, req) => {
    const u = new URL(req.url, 'http://x');
    const role = u.searchParams.get('role');
    const remote = req.socket.remoteAddress || '';
    if (role === 'host') {
      if (!isLocal || !/127\.0\.0\.1|::1/.test(remote)) return ws.close(4003, 'host only local');
      if (hostWs) try { hostWs.close(4000, 'replaced'); } catch (e) {}
      hostWs = ws; ws.isHost = true;
      ws.send(JSON.stringify({ type: 'hello', role: 'host', phones: [...peers.values()].map(p => p.meta) }));
      ws.on('message', (data, bin) => {
        if (bin) return;
        let m; try { m = JSON.parse(data); } catch (e) { return; }
        const to = peers.get(m.to); if (to && to.ws.readyState === 1) to.ws.send(JSON.stringify(Object.assign(m, { from: 'host' })));
      });
      ws.on('close', () => { if (hostWs === ws) hostWs = null; peers.forEach(p => p.ws.readyState === 1 && p.ws.send(JSON.stringify({ type: 'host-left' }))); });
      return;
    }
    if (u.searchParams.get('t') !== state.token) return ws.close(4001, 'bad token');
    let id = (nextId++ % 250) + 1; while (peers.has(id)) id = (nextId++ % 250) + 1;
    const meta = { id, ua: String(req.headers['user-agent'] || '').slice(0, 200), name: (u.searchParams.get('name') || '手机').slice(0, 20), ip: remote.replace('::ffff:', '') };
    peers.set(id, { ws, meta });
    ws.send(JSON.stringify({ type: 'hello', role: 'phone', id, host: !!hostWs }));
    const toHost = obj => hostWs && hostWs.readyState === 1 && hostWs.send(JSON.stringify(obj));
    toHost({ type: 'phone-join', from: id, meta });
    ws.on('message', (data, bin) => {
      if (!hostWs || hostWs.readyState !== 1) return;
      if (bin) { if (hostWs.bufferedAmount > 2e6) return; const b = Buffer.allocUnsafe(data.length + 1); b[0] = id; data.copy(b, 1); hostWs.send(b, { binary: true }); return; }
      let m; try { m = JSON.parse(data); } catch (e) { return; }
      m.from = id; hostWs.send(JSON.stringify(m));
    });
    ws.on('close', () => { peers.delete(id); toHost({ type: 'phone-leave', from: id }); });
  });
  // 保活：手机锁屏 / 切后台时清理断开的连接
  setInterval(() => wss.clients.forEach(c => { if (c.alive === false) return c.terminate(); c.alive = false; try { c.ping(); } catch (e) {} }), 15000);
  wss.on('connection', c => { c.alive = true; c.on('pong', () => { c.alive = true; }); });
}

function info() {
  return {
    token: state.token, httpPort: state.httpPort, httpsPort: state.httpsPort, lanHttpPort: state.lanHttpPort, fingerprint: state.fingerprint,
    ips: state.ips.map(x => x.ip),
    phoneUrls: state.ips.map(x => `https://${x.ip}:${state.httpsPort}/phone/?t=${state.token}`),
    phoneHttpUrls: state.ips.map(x => `http://${x.ip}:${state.lanHttpPort}/phone/?t=${state.token}&s=${state.httpsPort}`),
    platform: process.platform, version: app.getVersion(), fake: !!(fakeCam || fakeMic),
  };
}

function listen(server, port, host) {
  return new Promise((res, rej) => {
    const tryPort = p => { server.once('error', e => { if (e.code === 'EADDRINUSE' && p < port + 30) tryPort(p + 1); else rej(e); }); server.listen(p, host, () => res(server.address().port)); };
    tryPort(port);
  });
}

async function startServers() {
  state.ips = lanIPs();
  const local = http.createServer(hostHandler);
  state.httpPort = await listen(local, 47810, '127.0.0.1');
  attachWS(local, true);
  try {
    const c = await certFor(state.ips.map(x => x.ip)); state.fingerprint = c.fingerprint;
    const lan = https.createServer({ key: c.key, cert: c.cert }, phoneHandler);
    state.httpsPort = await listen(lan, 47843, '0.0.0.0'); attachWS(lan, false);
  } catch (e) { console.error('https 启动失败', e); }
  // 兼容：不支持自签名证书的环境，用 http 打开手机页（只能当遥控器 / 语音按钮，浏览器不给摄像头）
  try { const lanHttp = http.createServer(phoneHandler); state.lanHttpPort = await listen(lanHttp, 47880, '0.0.0.0'); attachWS(lanHttp, false); } catch (e) {}
}

/* ---------- 窗口 ---------- */
let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 560, backgroundColor: '#5ec8ff', title: '星星岛大冒险 · 体感版', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  if (arg('fullscreen')) win.setFullScreen(true);
  const start = arg('start'); // 测试：--start=motion 直接进体感大厅
  win.loadURL(`http://127.0.0.1:${state.httpPort}/index.html${start ? '#motion=' + start : ''}`);
  // 网页里的「离开前确认」在桌面版用原生对话框
  win.webContents.on('will-prevent-unload', e => {
    if (fakeCam || fakeMic) return e.preventDefault(); // 测试模式不弹确认框
    const r = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['退出', '再玩一会'], defaultId: 1, cancelId: 1, title: '星星岛', message: '要退出星星岛吗？', detail: '进度已经自动保存。' });
    if (r === 0) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'f' && input.meta && input.control)) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F12' || (input.key === 'I' && input.shift && (input.meta || input.control))) { win.webContents.toggleDevTools(); e.preventDefault(); }
  });
  if (arg('devtools')) win.webContents.openDevTools({ mode: 'detach' });
  win.on('closed', () => { win = null; });
}

ipcMain.handle('star:info', () => info());
ipcMain.handle('star:qr', async (e, text, opts) => require('qrcode').toDataURL(String(text), Object.assign({ margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#1b2a4a', light: '#ffffff' } }, opts || {})));
ipcMain.handle('star:media-access', async (e, kind) => {
  if (process.platform !== 'darwin') return 'granted';
  const st = systemPreferences.getMediaAccessStatus(kind);
  if (st === 'granted') return st;
  if (st === 'not-determined') return (await systemPreferences.askForMediaAccess(kind)) ? 'granted' : 'denied';
  return st;
});
ipcMain.handle('star:open-privacy', (e, kind) => {
  if (process.platform === 'darwin') shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_' + (kind === 'microphone' ? 'Microphone' : 'Camera'));
  else if (process.platform === 'win32') shell.openExternal(kind === 'microphone' ? 'ms-settings:privacy-microphone' : 'ms-settings:privacy-webcam');
});
ipcMain.handle('star:fullscreen', (e, on) => { if (win) win.setFullScreen(on == null ? !win.isFullScreen() : !!on); return win && win.isFullScreen(); });
ipcMain.handle('star:new-token', () => { state.token = crypto.randomBytes(6).toString('hex'); peers.forEach(p => p.ws.close(4002, 'token changed')); return info(); });

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const ok = origin => /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => {
    const origin = (() => { try { return new URL(details.requestingUrl || wc.getURL()).origin; } catch (e) { return ''; } })();
    cb(ok(origin) && ['media', 'fullscreen', 'speaker-selection', 'clipboard-sanitized-write', 'notifications'].includes(perm));
  });
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => ok(origin) && ['media', 'fullscreen', 'speaker-selection'].includes(perm));
  await startServers();
  createWindow();
  console.log('[star] 本机', `http://127.0.0.1:${state.httpPort}/`, ' 手机', info().phoneUrls[0] || '(无局域网)');
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
