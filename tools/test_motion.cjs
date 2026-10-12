// 体感版冒烟测试：用视频文件当假摄像头启动 Electron，打开指定页面 / 游戏并截图
// 用法：node tools/test_motion.cjs <视频.mjpeg|y4m> <目标：hub|setup:move|游戏id> [秒数] [输出目录]
//   需要 playwright-core（PW_DIR 指向装了它的目录，默认 /tmp/pw）
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const { _electron } = createRequire(path.join(process.env.PW_DIR || '/tmp/pw', 'package.json'))('playwright-core');

const [cam, target = 'hub', secs = '8', out = '/tmp/mg/shots'] = process.argv.slice(2);
const root = path.resolve(__dirname, '..');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const app = await _electron.launch({ executablePath: require(path.join(root, 'node_modules/electron')), args: [root].concat(process.env.HEADED ? [] : ['--hidden'], ['--fake-cam=' + cam]).concat(process.env.FAKE_MIC ? ['--fake-mic=' + process.env.FAKE_MIC] : []), cwd: root, timeout: 60000 });
  const page = await app.firstWindow();
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /\[motion\]|\[test\]/.test(t)) console.log('[' + m.type() + ']', t.slice(0, 400)); });
  page.on('response', r => { if (r.status() >= 400) console.log('[http ' + r.status() + ']', r.url()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await page.setViewportSize ? null : null;
  await page.waitForFunction(() => window.Core && window.App && window.Motion && window.Motion.booted, null, { timeout: 30000 });
  // 没有存档时建一个
  const hasP = await page.evaluate(() => !!Core.Store.p);
  if (!hasP) { await page.evaluate(() => { Core.Store.newProfile('小测试', 2, App.HEROES[0].id); }); await page.reload(); await page.waitForFunction(() => window.Motion && window.Motion.booted, null, { timeout: 30000 }); }
  await page.evaluate(w => { Motion.cfg.worker = w; }, process.env.WORKER !== '0');
  // THROTTLE=4：主线程降速 4 倍，模拟低端设备
  if (process.env.THROTTLE) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.THROTTLE }); }
  await page.evaluate(() => { Motion.cfg.firstRun = false; Motion.Cursor.click = () => {}; /* 测试视频里的人会乱指，禁用光标点击 */ Motion.cfg.video = { kind: 'cam', id: '' }; Motion.save(); });
  await page.waitForFunction(() => document.querySelector('#app .screen.in'), null, { timeout: 30000 });
  const [t, sub] = target.split(':');
  if (t === 'hub') await page.evaluate(() => Motion.UI.hub());
  else if (t === 'setup') { await page.evaluate(() => Motion.UI.hub()); await page.waitForTimeout(2500); await page.evaluate(s => { document.querySelector('.m-setup') && document.querySelector('.m-setup').remove(); Motion.UI.setup(s); }, sub || 'input'); }
  else await page.evaluate(([id, mode]) => Motion.play(id, { zone: 'math', mode: mode || undefined }), [t, sub]);
  const n = +secs;
  for (let i = 1; i <= n; i++) {
    await page.waitForTimeout(1000);
    await page.evaluate(() => document.querySelectorAll('#fx .modal-bg .mclose').forEach(b => b.click()));
    if (process.env.EVAL) await page.evaluate(process.env.EVAL).catch(e => console.log('[eval]', e.message));
    // 进入游戏后自动点「开始」（假摄像头里的人不会举双手）
    if (i === 3) await page.evaluate(() => { const g = document.querySelector('.mg-intro .go'); if (g) g.click(); });
    if (i % 2 === 0 || i === n) await page.screenshot({ path: path.join(out, target.replace(/[:]/g, '_') + '_' + String(i).padStart(2, '0') + '.png') });
  }
  const st = await page.evaluate(() => ({ fps: Motion.Tracker.fps, ms: Motion.Tracker.ms, people: Motion.Tracker.people.length, input: Motion.Input.status, err: Motion.Input.error, tr: Motion.Tracker.error, deleg: Motion.Tracker.delegate, mode: Motion.Tracker.mode, mainMs: +Motion.Tracker.mainMs.toFixed(2), score: window.__MG && __MG.hud.scoreV }));
  console.log('[test] state', JSON.stringify(st));
  await app.close();
})().catch(e => { console.error(e); process.exit(1); });
