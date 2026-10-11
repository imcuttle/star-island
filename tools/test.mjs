// 冒烟测试：node tools/test.mjs <年级,年级...> [玩法1,玩法2,...] [-j 并发数]
// 每种玩法挑一个适合该年级的关卡，在无头浏览器里自动通关（用各引擎的 S.auto 钩子）
// · 多个页面并行跑（默认 CPU 核数的一半），每局都用全新的页面，互不影响
// · 失败的玩法自动单独重跑一次，两次都失败才算失败
// · 语音 / 音乐请求直接拦掉，减少加载时间
import { createRequire } from 'module';
import path from 'path';
import os from 'os';
const require = createRequire('/Users/cuttleyu/lemo-opuscar/package.json');
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2), jIdx = args.indexOf('-j');
const jobsN = jIdx >= 0 ? +args.splice(jIdx, 2)[1] : Math.max(2, Math.min(8, Math.floor(os.cpus().length / 2)));
const grades = (args[0] || '1').split(',').map(Number), only = args[1] || '';
const TIMEOUT = 180000;
const t00 = Date.now();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const errs = new Set();

async function newPage(grade) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.addInitScript(() => { window.__TEST_LITE = 1; }); // 不渲染主地图 3D 浮岛和角色立绘
  await page.route(/assets\/(voice|music)\//, r => r.abort());
  page.on('pageerror', e => errs.add('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/voice-manifest|ERR_FILE_NOT_FOUND|ERR_FAILED|net::/.test(m.text())) errs.add('CONSOLE ' + m.text().slice(0, 200)); });
  await page.goto('file://' + root + '/index.html');
  await page.evaluate(g => { localStorage.clear(); Core.Store.load(); Core.Store.newProfile('测试', g, 'k-pink'); const p = Core.Store.p; Object.assign(p.settings, { voice: false, music: false }); p.signed.push(Core.today()); Core.Store.save(); }, grade);
  await page.waitForFunction(() => window.App && window.CATALOG && Core.Store.p, null, { timeout: 15000 });
  return { ctx, page };
}

// 在页面里自动玩一局，返回结果文字
async function playOne(page, id) {
  return page.evaluate(async id => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const g = CATALOG.GAMES.find(x => x.id === id);
    App.startGame(g);
    for (let i = 0; i < 60 && !document.querySelector('.modal .go'); i++) await sleep(100);
    document.querySelector('.modal .go').click(); await sleep(700);
    const fast = Engines.REALTIME.has(g.eng);
    for (let steps = 0; steps < 2400; steps++) {
      if (document.querySelector('.result')) break;
      const S = window.__S;
      if (S && S.auto && !S.over) { try { S.auto(); } catch (e) { return g.eng + ' AUTO-ERR ' + e.message; } }
      else if (S && !S.over) { // 第一批玩法没有 auto 钩子：模拟点击
        const st = document.querySelector('.stage'); if (!st) { await sleep(300); continue; }
        const bk = st.querySelector('.catchfield');
        if (bk) { const it = st.querySelector('.drop-item[data-ok="1"]:not(.caught-item)'); if (it) { const r = it.getBoundingClientRect(); bk.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width / 2, clientY: 10 })); } await sleep(100); continue; }
        const ok = st.querySelector('[data-ok="1"]:not(.popped):not(.good)' + (st.querySelector('.hole') ? '.up' : ''));
        if (ok) { ok.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 1, clientY: 1 })); window.dispatchEvent(new PointerEvent('pointerup', { clientX: 1, clientY: 1 })); if (!ok.classList.contains('food')) ok.click(); await sleep(1300); continue; }
        const mc = st.querySelectorAll('.mcard:not(.matched)');
        if (mc.length) { const a = mc[0], b = [...mc].find(x => x !== a && x.dataset.i === a.dataset.i); a.click(); await sleep(80); b && b.click(); await sleep(1000); continue; }
        const ln = st.querySelector('.cnode.l:not(.done)');
        if (ln) { ln.click(); await sleep(80); st.querySelector('.cnode.r[data-i="' + ln.dataset.i + '"]').click(); await sleep(450); continue; }
        const si = st.querySelector('.sortitem');
        if (si && !si.classList.contains('fly-in')) { st.querySelectorAll('.bin')[+si.dataset.b].click(); await sleep(550); continue; }
        const tiles = [...st.querySelectorAll('.tile:not(.used)')];
        if (tiles.length) { const ans = st.querySelector('.tray').dataset.ans.split('|'); const k = st.querySelectorAll('.slot.filled').length; const t = tiles.find(t => t.querySelector('.ctxt').textContent === ans[k]); if (t) t.click(); await sleep(k === ans.length - 1 ? 1400 : 120); continue; }
        const okb = st.querySelector('.clockctl .go');
        if (okb) { const [th, tm] = st.querySelector('.qtext b').textContent.split(':').map(Number); for (let i = 0; i < 40; i++) { const [hh, mm] = st.querySelector('.cc-time').textContent.split(':').map(Number); if (hh === th && mm === tm) break; st.querySelector(hh !== th ? '[data-a="h+"]' : '[data-a="m+"]').click(); await sleep(20); } okb.click(); await sleep(1400); continue; }
      }
      await sleep(fast ? 100 : 350);
    }
    await sleep(300);
    const r = document.querySelector('.result');
    return g.eng + ':' + g.name + ' -> ' + (r ? r.querySelectorAll('.r-stars i.on').length + '★ ' + r.querySelector('.r-stat').textContent.trim() : 'NO RESULT');
  }, id).catch(e => id + ' EVAL-ERR ' + e.message.slice(0, 120));
}
const bad = res => /NO RESULT|TIMEOUT|ERR|0★/.test(res);
async function runJob(job) {
  const t0 = Date.now(); let pg;
  try {
    pg = await newPage(job.grade);
    const res = await Promise.race([playOne(pg.page, job.id), new Promise(r => setTimeout(() => r(job.id + ' TIMEOUT'), TIMEOUT))]);
    return { res, sec: Math.round((Date.now() - t0) / 1000) };
  } catch (e) { return { res: job.id + ' SETUP-ERR ' + e.message.slice(0, 100), sec: Math.round((Date.now() - t0) / 1000) }; }
  finally { if (pg) pg.ctx.close().catch(() => {}); }
}

// 列出要跑的玩法
const { ctx: c0, page: p0 } = await newPage(grades[0]);
const jobs = [];
for (const grade of grades) {
  const ids = await p0.evaluate(([grade, only]) => { const seen = new Set(); return CATALOG.GAMES.filter(g => grade >= g.g0 && grade <= g.g1 && (!only || only.split(',').includes(g.eng)) && !seen.has(g.eng) && seen.add(g.eng)).map(g => [g.id, Engines.BIG.has(g.eng)]); }, [grade, only]);
  ids.forEach(([id, big]) => jobs.push({ grade, id, big }));
}
await c0.close();
console.log(jobs.length + ' 局，年级 ' + grades.join(',') + '，并发 ' + jobsN);

const results = [];
async function pool(list, n, label) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => {
    while (i < list.length) { const job = list[i++]; const r = await runJob(job); job.r = r; results.push(job); console.log((label || '') + 'G' + job.grade + ' ' + r.res + ' (' + r.sec + 's)'); }
  }));
}
// 大游戏（3D / 物理）最吃 CPU：最多同时跑 2 个，其余小游戏另开一个池子并行
const bigN = Math.min(2, jobsN - 1);
await Promise.all([pool(jobs.filter(j => j.big), bigN), pool(jobs.filter(j => !j.big), Math.max(1, jobsN - bigN))]);
// 失败的单独重跑一次（实时类玩法偶尔会因为 CPU 抢占失手）
const retry = jobs.filter(j => bad(j.r.res));
if (retry.length) { console.log('— 重跑 ' + retry.length + ' 个失败的玩法 —'); retry.forEach(j => j.first = j.r.res); await pool(retry, Math.min(3, jobsN), '[重跑] '); }
const fails = jobs.filter(j => bad(j.r.res));
console.log('\n用时 ' + Math.round((Date.now() - t00) / 1000) + 's · ' + jobs.length + ' 局 · 失败 ' + fails.length + (retry.length ? ' · 重跑后通过 ' + (retry.length - fails.length) : ''));
fails.forEach(j => console.log('  ✗ G' + j.grade + ' ' + j.r.res));
console.log('FAILS', fails.length, 'ERRORS:\n' + [...errs].slice(0, 30).join('\n'));
await browser.close();
process.exit(fails.length ? 1 : 0);
