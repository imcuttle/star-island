// 体感界面适配体检：在多种手机 / 平板尺寸下打开体感的每个界面，找出滚动条、出屏、被裁切的内容和太小的按钮，并截图
// 用法：node tools/audit_motion_ui.cjs [ui|games] [视口名,视口名…]
//   ui：大厅、选关、设置 5 步、介绍卡、游戏中、暂停、结算；games：9 个游戏各玩几秒截图
//   直接托管源码目录（需要 motion/vendor 已下载），截图在 /tmp/mg/audit/
const path = require('path');
const http = require('http');
const fs = require('fs');
const { createRequire } = require('module');
const pw = createRequire(path.join(process.env.PW_DIR || '/tmp/pw', 'package.json'))('playwright-core');
const [what = 'ui', only = ''] = process.argv.slice(2);
const root = path.resolve(__dirname, '..'), out = '/tmp/mg/audit', cam = process.env.CAM || '/tmp/mg/fake.mjpeg';
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.json': 'application/json', '.glb': 'model/gltf-binary', '.vrm': 'model/gltf-binary', '.jpg': 'image/jpeg' };
const VIEWS = {
  se: { width: 667, height: 375, mobile: true },          // iPhone SE 横屏
  phone: { width: 844, height: 390, mobile: true },       // iPhone 14 横屏
  android: { width: 740, height: 360, mobile: true },     // 小安卓横屏
  ipad: { width: 1024, height: 768, mobile: true },       // iPad 横屏
  air: { width: 1180, height: 820, mobile: true },        // iPad Air 横屏
  pro: { width: 1366, height: 1024, mobile: true },       // iPad Pro 横屏
  ipadP: { width: 820, height: 1180, mobile: true },      // iPad 竖屏
  phoneP: { width: 390, height: 844, mobile: true },      // 手机竖屏
};
const GAMES = [['beat', 'std'], ['dance', 'party'], ['run', 'quiz'], ['fruit', 'quiz'], ['wall', 'quiz'], ['sky', 'math'], ['spell', 'gesture'], ['simon', 'zh'], ['kame', 'quiz']];

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0, '127.0.0.1', run);

// 在页面里检查：滚动容器、出屏、被 overflow:hidden 裁掉的内容、太小的点击目标
function check() {
  const W = innerWidth, H = innerHeight, r = { scroll: [], off: [], clip: [], small: [], doc: '' };
  const se = document.scrollingElement; if (se.scrollHeight > H + 1 || se.scrollWidth > W + 1) r.doc = se.scrollWidth + 'x' + se.scrollHeight;
  const nm = e => { const c = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(x => !/^(in|on|out|m-hover)$/.test(x)).slice(0, 2).join('.') : ''; return e.tagName.toLowerCase() + (c ? '.' + c : '') + (e.textContent && e.children.length < 3 ? '「' + e.textContent.trim().slice(0, 10) + '」' : ''); };
  const scope = document.querySelector('#app .screen.in'); if (!scope) return r;
  const rot = scope.querySelector('.m-rotate'); if (rot && getComputedStyle(rot).display !== 'none') { r.rotate = true; return r; } // 竖屏：整屏提示横过来，下面的内容不用看
  const vis = e => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > .05; };
  const all = [...scope.querySelectorAll('*')].filter(e => !e.closest('.mg-stage,.m-bg,canvas,svg,.m-rotate,.m-hpage:not(.cur)') && e.getClientRects().length);
  const top = [...scope.querySelectorAll('.m-layer.top')].pop();
  for (const e of all) {
    if (top && !top.contains(e)) continue; // 只看最上层的弹层
    if (!vis(e)) continue;
    const cs = getComputedStyle(e), b = e.getBoundingClientRect();
    if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) (e.classList.contains('m-scr-on') ? r.paged || (r.paged = []) : r.scroll).push(nm(e).split('「')[0] + ' ↕' + e.scrollHeight + '/' + e.clientHeight);
    if (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2) r.scroll.push(nm(e) + ' ↔' + e.scrollWidth + '/' + e.clientWidth);
    if (b.width < 2 || b.height < 2) continue;
    const inScroll = (() => { for (let p = e.parentElement; p && p !== scope; p = p.parentElement) { const c = getComputedStyle(p).overflowY; if (/(auto|scroll)/.test(c)) return true; } return false; })();
    const leaf = !e.children.length || /^(BUTTON|B|SMALL|SPAN|P|H2|H3|LABEL|IMG)$/.test(e.tagName);
    if (leaf && !inScroll && (b.right > W + 2 || b.bottom > H + 2 || b.left < -2 || b.top < -2)) r.off.push(nm(e) + ' @' + Math.round(b.left) + ',' + Math.round(b.top) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
    // 被祖先 overflow:hidden 裁掉（文字 / 按钮看不全）
    if (leaf && !inScroll) for (let p = e.parentElement; p && p !== scope; p = p.parentElement) {
      const pc = getComputedStyle(p); if (!/(hidden|clip)/.test(pc.overflowY + pc.overflowX)) continue;
      const pb = p.getBoundingClientRect(); if (b.bottom > pb.bottom + 3 || b.right > pb.right + 3 || b.top < pb.top - 3) r.clip.push(nm(e) + ' 被 ' + nm(p).split('「')[0] + ' 裁掉 ' + Math.round(Math.max(b.bottom - pb.bottom, b.right - pb.right, pb.top - b.top)) + 'px');
      break;
    }
    if (/^(BUTTON)$/.test(e.tagName) && (b.width < 36 || b.height < 36)) r.small.push(nm(e) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
  }
  for (const k of ['scroll', 'off', 'clip', 'small']) r[k] = [...new Set(r[k])].slice(0, 10);
  return r;
}

let issues = 0;
// 生命周期：签到弹窗不盖住体感；离开体感区关摄像头；切后台暂停游戏
async function life(page, vn) {
  const st = () => page.evaluate(() => ({ screen: document.documentElement.dataset.screen, cam: Motion.Input.status, stream: !!Motion.Input.stream, tracker: Motion.Tracker.running, modal: !!document.querySelector('#fx .modal-bg.in'), paused: !!(window.__MG && __MG.paused) }));
  const log = async (k, ok) => { const s = await st(); const pass = ok(s); if (!pass) issues++; console.log('[' + vn + '] ' + (pass ? '✓ ' : '✗ ') + k + ' ' + JSON.stringify(s)); };
  await page.evaluate(() => { Motion.cfg.firstRun = false; Motion.save(); Motion.Cursor.click = () => {}; Motion.UI.hub(); });
  await page.waitForTimeout(3000);
  await log('进体感大厅：摄像头开着、没有签到弹窗', s => s.cam === 'live' && s.tracker && !s.modal);
  await page.evaluate(() => Motion.play('fruit', { zone: 'math', mode: 'arcade' }));
  await page.waitForFunction(() => document.querySelector('.mg-intro .go'), null, { timeout: 40000 }); await page.evaluate(() => document.querySelector('.mg-intro .go').click());
  await page.waitForTimeout(4500);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(500);
  await log('切到后台：游戏自动暂停', s => s.paused);
  await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
  await page.evaluate(() => App.hub()); await page.waitForTimeout(3500);
  await log('回主地图：摄像头和识别都关了，签到弹窗现在才出来', s => s.cam === 'off' && !s.stream && !s.tracker && s.modal);
  await page.evaluate(() => document.querySelectorAll('#fx .modal-bg .mclose').forEach(b => b.click()));
  await page.evaluate(() => Motion.UI.hub()); await page.waitForTimeout(3000);
  await log('再进体感：摄像头自动重新打开', s => s.cam === 'live' && s.stream && s.tracker);
}
async function run() {
  const port = srv.address().port;
  const br = await pw.chromium.launch({ channel: 'chrome', headless: !process.env.HEADED, // 默认不弹窗口；HEADED=1 显示浏览器
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + cam, '--autoplay-policy=no-user-gesture-required'] });
  const views = only ? only.split(',') : Object.keys(VIEWS).filter(v => what === 'ui' || ['phone', 'se', 'ipad', 'pro'].includes(v));
  for (const vn of views) {
    const v = VIEWS[vn];
    const ctx = await br.newContext({ viewport: { width: v.width, height: v.height }, screen: { width: v.width, height: v.height }, deviceScaleFactor: 2, isMobile: v.mobile, hasTouch: v.mobile, permissions: ['camera', 'microphone'], userAgent: v.width > 1000 || v.height > 1000 ? 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('[' + vn + '][pageerror]', e.message));
    await page.goto('http://localhost:' + port + '/');
    await page.waitForFunction(() => window.Core && window.App, null, { timeout: 30000 });
    if (!(await page.evaluate(() => !!Core.Store.p))) { await page.evaluate(() => Core.Store.newProfile('小测试', 2, App.HEROES[0].id)); await page.reload(); }
    await page.waitForFunction(() => window.Motion && Motion.booted && document.querySelector('#app .screen.in'), null, { timeout: 40000 });
    if (what === 'life') { await life(page, vn); await ctx.close(); continue; }
    await page.evaluate(() => { document.querySelectorAll('#fx .modal-bg .mclose').forEach(b => b.click()); Motion.cfg.firstRun = false; Motion.save(); Motion.Cursor.click = () => {}; });
    const shot = async (name, wait) => {
      await page.waitForTimeout(wait || 1200);
      await page.evaluate(() => document.querySelectorAll('#fx .modal-bg .mclose').forEach(b => b.click()));
      const r = await page.evaluate(check);
      if (r.rotate) { console.log('[' + vn + '] ' + name + '  ↻ 竖屏，显示「把手机横过来」'); await page.screenshot({ path: out + '/' + vn + '_' + name + '.png' }); return; }
      const bad = [r.doc && '整页滚动 ' + r.doc, ...(r.paged || []).map(x => '（体感翻页）' + x), ...r.scroll.map(x => '滚动 ' + x), ...r.off.map(x => '出屏 ' + x), ...r.clip.map(x => '裁切 ' + x), ...r.small.map(x => '小按钮 ' + x)].filter(Boolean);
      console.log('[' + vn + ' ' + v.width + 'x' + v.height + '] ' + name + (bad.length ? '\n    ' + bad.join('\n    ') : '  ✓'));
      if (bad.some(b => !b.startsWith('（'))) issues++;
      if (process.env.DUMP) console.log('    [dump]', await page.evaluate(process.env.DUMP).catch(e => e.message)); // 调试：DUMP='表达式' 每个界面打印一次
      await page.screenshot({ path: out + '/' + vn + '_' + name + '.png' });
    };
    if (what === 'ui') {
      await page.evaluate(() => Motion.UI.hub()); await shot('hub', 2500);
      await page.evaluate(() => Motion.UI.pick(Motion.gameById('dance'))); await shot('pick');
      await page.evaluate(() => document.querySelector('.m-pick .m-x').click());
      for (const s of ['input', 'place', 'move', 'voice', 'cursor']) { await page.evaluate(s => { document.querySelectorAll('.m-setup').forEach(l => l.remove()); Motion.UI.setup(s); }, s); await shot('setup_' + s, 1800); }
      await page.evaluate(() => { const x = document.querySelector('.m-setup .mclose, .m-setup .m-x'); if (x) x.click(); else document.querySelectorAll('.m-setup').forEach(l => l.remove()); });
      await page.evaluate(() => Motion.play('dance', { zone: 'math', mode: 'quiz' })); await page.waitForFunction(() => document.querySelector('.mg-intro'), null, { timeout: 40000 }).catch(() => {});
      await shot('intro', 1500);
      await page.evaluate(() => { const g = document.querySelector('.mg-intro .go'); if (g) g.click(); }); await shot('play', 6000);
      await page.evaluate(() => __MG.pause(true)); await shot('pause');
      await page.evaluate(() => { __MG.resume(); }); await page.waitForTimeout(1800);
      await page.evaluate(() => __MG.end({ lines: ['🎯 完美 <b>12</b>', '🔥 最大连击 <b>21</b>', '🏆 红队 1200 : 蓝队 900'] })); await shot('result', 1500);
    } else {
      for (const [g, m] of GAMES) {
        await page.evaluate(([g, m]) => Motion.play(g, { zone: 'math', mode: m }), [g, m]);
        await page.waitForFunction(() => document.querySelector('.mg-intro'), null, { timeout: 40000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await page.evaluate(() => { const go = document.querySelector('.mg-intro .go'); if (go) go.click(); });
        await shot(g, 9000);
      }
    }
    await ctx.close();
  }
  await br.close(); srv.close();
  console.log(issues ? '有 ' + issues + ' 个界面需要处理' : '全部通过（滚动区都有体感翻页）');
}
