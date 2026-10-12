// 网页版体感联调：本地起静态服务器托管 dist/，用 Chrome（假摄像头）以手机横屏 / 桌面打开
// 用法：node tools/test_web.cjs <假摄像头.mjpeg> [mobile|desktop] [目标：hub|setup:input|游戏id[:模式]] [秒数]
//   localhost 是安全上下文（等同 https），能开摄像头；另外用局域网 IP 的 http 地址验证「不安全时不出现体感入口」
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { createRequire } = require('module');
const pw = createRequire(path.join(process.env.PW_DIR || '/tmp/pw', 'package.json'))('playwright-core');
const [cam = '/tmp/mg/fake.mjpeg', dev = 'mobile', target = 'hub', secs = '10'] = process.argv.slice(2);
const dist = path.resolve(__dirname, '../dist'), out = '/tmp/mg/web';
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.woff': 'font/woff', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dist, p); if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0, '0.0.0.0', run);

async function run() {
  const port = srv.address().port;
  const lan = Object.values(os.networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal);
  // cam = none：模拟没有摄像头 / 拒绝了权限，验证键鼠 / 触屏兜底
  const noCam = cam === 'none';
  const br = await pw.chromium.launch({ channel: 'chrome', headless: false, args: noCam ? ['--autoplay-policy=no-user-gesture-required', '--deny-permission-prompts'] : ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + cam, '--autoplay-policy=no-user-gesture-required'] });
  const mobile = dev === 'mobile';
  const ctx = await br.newContext(mobile ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: noCam ? [] : ['camera', 'microphone'], userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' } : { viewport: { width: 1280, height: 760 }, permissions: noCam ? [] : ['camera', 'microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('response', r => { if (r.status() >= 400) console.log('[http ' + r.status() + ']', r.url()); });
  page.on('console', m => { if (/\[test\]|识别线程/.test(m.text()) || m.type() === 'error') console.log('[' + m.type() + '] ' + m.text().slice(0, 300)); });
  await page.addInitScript(() => { window.onbeforeunload = null; addEventListener('beforeunload', e => e.stopImmediatePropagation(), true); });
  const home = process.env.URL || ('http://localhost:' + port + '/');
  await page.goto(home);
  await page.waitForFunction(() => window.Core && window.App, null, { timeout: 30000 });
  if (!(await page.evaluate(() => !!Core.Store.p))) { await page.evaluate(() => Core.Store.newProfile('小测试', 2, App.HEROES[0].id)); await page.reload(); }
  await page.waitForFunction(() => window.Motion && Motion.booted && document.querySelector('#app .screen.in'), null, { timeout: 40000 });
  await page.evaluate(() => document.querySelectorAll('#fx .modal-bg .mclose').forEach(b => b.click()));
  await page.waitForTimeout(1500);
  console.log('[test] dock 体感按钮:', await page.evaluate(() => !!document.querySelector('.d-motion')), ' web:', await page.evaluate(() => Motion.web), ' mobile:', await page.evaluate(() => Motion.mobile));
  await page.screenshot({ path: out + '/' + dev + '_map.png' });
  const [t, sub] = target.split(':');
  await page.evaluate(() => { Motion.cfg.firstRun = false; Motion.save(); Motion.Cursor.click = () => {}; });
  if (t === 'hub') await page.evaluate(() => Motion.UI.hub());
  else if (t === 'setup') { await page.evaluate(() => Motion.UI.hub()); await page.waitForTimeout(2500); await page.evaluate(s => Motion.UI.setup(s), sub || 'input'); }
  else await page.evaluate(([id, mode]) => Motion.play(id, { zone: 'math', mode }), [t, sub]);
  for (let i = 1; i <= +secs; i++) {
    await page.waitForTimeout(1000);
    if (i === 3) await page.evaluate(() => { const g = document.querySelector('.mg-intro .go'); if (g) g.click(); });
    // ACT=mouse：鼠标来回快速划；ACT=keys：方向键 / 空格；ACT=touch：手指划动 + 点屏幕按钮
    const act = process.env.ACT;
    await page.evaluate(() => document.querySelectorAll('#fx .modal-bg .mclose').forEach(b => b.click()));
    if (i > 4 && act === 'mouse') for (let k = 0; k < 6; k++) { const y = 150 + Math.random() * 400; await page.mouse.move(200, y); await page.mouse.move(1080, y - 120, { steps: 4 }); await page.waitForTimeout(80); }
    if (i > 5 && act === 'keys') for (const k of ['ArrowLeft', 'ArrowUp', 'Space', 'ArrowRight', 'ArrowDown']) { await page.keyboard.press(k); await page.waitForTimeout(160); }
    if (i > 5 && act === 'touch') { const b = await page.$$('.m-vb'); for (const x of b) { await x.tap().catch(() => {}); await page.waitForTimeout(120); } await page.touchscreen.tap(420, 200); }
    if (i % 3 === 0 || i === +secs) await page.screenshot({ path: out + '/' + dev + '_' + target.replace(':', '_') + '_' + String(i).padStart(2, '0') + '.png' });
  }
  console.log('[test] state', JSON.stringify(await page.evaluate(() => ({ input: Motion.Input.status, err: Motion.Input.error, people: Motion.Tracker.people.length, virtual: Motion.Virtual.active, pad: !!document.querySelector('.m-vpad.in'), score: window.__MG && __MG.hud.scoreV, fps: Math.round(Motion.Tracker.fps), ms: +Motion.Tracker.ms.toFixed(1), asr: Motion.Ears.pick(), mode: Motion.Tracker.mode, mainMs: +Motion.Tracker.mainMs.toFixed(2) }))));
  // 不安全的 http（局域网 IP）：不应该出现体感入口
  if (lan && !process.env.URL) {
    const p2 = await ctx.newPage(); await p2.goto('http://' + lan.address + ':' + port + '/');
    await p2.waitForFunction(() => window.Core && document.querySelector('#app .screen.in'), null, { timeout: 30000 }).catch(() => {});
    await p2.waitForTimeout(2500);
    console.log('[test] http 局域网地址：secure=', await p2.evaluate(() => isSecureContext), ' Motion=', await p2.evaluate(() => !!window.Motion), ' 体感按钮=', await p2.evaluate(() => !!document.querySelector('.d-motion')));
  }
  await br.close(); srv.close();
}
