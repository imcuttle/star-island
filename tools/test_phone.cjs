// 手机输入端联调：Electron 当电脑，本机 Chrome 模拟手机（假摄像头视频），扫码地址直接打开
// 用法：node tools/test_phone.cjs <手机端假摄像头.mjpeg> [rtc|jpeg]   jpeg：强制走 JPEG 兜底通道
const path = require('path');
const { createRequire } = require('module');
const pw = createRequire(path.join(process.env.PW_DIR || '/tmp/pw', 'package.json'))('playwright-core');
const [cam = '/tmp/mg/fake3.mjpeg', via = 'rtc'] = process.argv.slice(2);
const root = path.resolve(__dirname, '..');
const out = '/tmp/mg/shots';

(async () => {
  const app = await pw._electron.launch({ executablePath: require(path.join(root, 'node_modules/electron')), args: [root, '--fake-cam=/tmp/mg/fake.mjpeg'], cwd: root });
  const host = await app.firstWindow();
  host.on('pageerror', e => console.log('[host pageerror]', e.message));
  host.on('console', m => { if (/phone|rtc|JPEG/i.test(m.text())) console.log('[host]', m.text().slice(0, 200)); });
  await host.waitForFunction(() => window.Motion && Motion.booted, null, { timeout: 30000 });
  if (!(await host.evaluate(() => !!Core.Store.p))) { await host.evaluate(() => Core.Store.newProfile('小测试', 2, App.HEROES[0].id)); await host.reload(); await host.waitForFunction(() => window.Motion && Motion.booted); }
  await host.evaluate(() => { Motion.cfg.firstRun = false; Motion.Cursor.click = () => {}; /* 测试视频里的人会乱指，禁用光标点击 */ Motion.save(); });
  await host.waitForTimeout(1500);
  await host.evaluate(() => { document.querySelectorAll('#fx .modal-bg .mclose').forEach(b => b.click()); Motion.UI.hub(); });
  await host.waitForTimeout(2000);
  await host.evaluate(() => { document.querySelectorAll('#fx .modal-bg .mclose').forEach(b => b.click()); Motion.UI.setup('input'); });
  const info = await host.evaluate(() => StarNative.info());
  const url = info.phoneUrls[0].replace(/https:\/\/[^:]+:/, 'https://127.0.0.1:');
  console.log('[test] phone url', url);
  const br = await pw.chromium.launch({ channel: 'chrome', headless: false, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + cam, '--ignore-certificate-errors', '--window-size=420,860'] });
  const ctx = await br.newContext({ ignoreHTTPSErrors: true, viewport: { width: 400, height: 820 }, permissions: ['camera', 'microphone'] });
  const ph = await ctx.newPage();
  ph.on('console', m => console.log('[phone]', m.text().slice(0, 200)));
  if (via === 'jpeg') await ph.addInitScript(() => { window.RTCPeerConnection = function () { throw new Error('no rtc'); }; });
  await ph.goto(url);
  await ph.waitForTimeout(1500);
  await host.screenshot({ path: out + '/phone_host_qr.png' });
  await ph.click('#mCam');
  await ph.waitForTimeout(2500);
  // 电脑端选这台手机当摄像头
  await host.evaluate(() => { const b = document.querySelector('[data-ph]'); if (b) b.click(); });
  await host.waitForTimeout(via === 'jpeg' ? 6000 : 5000);
  await ph.screenshot({ path: out + '/phone_' + via + '.png' });
  await host.evaluate(() => Motion.UI.setup && (document.querySelector('.m-setup .m-step[data-i="2"]') || {}).click && document.querySelector('.m-setup .m-step[data-i="2"]').click());
  await host.waitForTimeout(4000);
  await host.screenshot({ path: out + '/phone_host_' + via + '.png' });
  const st = await host.evaluate(() => ({ phones: Motion.Phone.list().map(p => ({ id: p.id, name: p.name, mode: p.mode, fps: p.fps, frames: p.frames })), input: Motion.Input.status, label: Motion.Input.label, people: Motion.Tracker.people.length, fps: Motion.Tracker.fps }));
  console.log('[test] state', JSON.stringify(st));
  await br.close(); await app.close();
})().catch(e => { console.error(e); process.exit(1); });
