// 截图：node tools/shots.mjs grade theme
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs';
const require = createRequire('/Users/cuttleyu/lemo-opuscar/package.json'); const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const out = '/tmp/si-shots'; fs.mkdirSync(out, { recursive: true });
const grade = +(process.argv[2] || 1), theme = process.argv[3] || 'auto', which = (process.argv[4] || 'hub,zone,quiz,whack,fish,memory,sort,battle,home,shop').split(',');
const vw = process.argv[5] ? process.argv[5].split('x').map(Number) : [1280, 800];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: vw[0], height: vw[1] } });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('requestfailed', r => { if (!r.url().includes('voice-manifest')) errs.push('REQFAIL ' + r.url()); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(500);
await page.evaluate(([g, t]) => { localStorage.clear(); Core.Store.load(); Core.Store.newProfile('小星', g, g >= 3 ? 'f-astro' : 'k-pink'); const p = Core.Store.p; p.settings.voice = false; p.settings.music = false; p.settings.theme = t; p.signed.push(Core.today()); p.coins = 888; p.pet = { kind: 'panda', name: '团团', lv: 6, xp: 10, food: 70, joy: 80, last: Date.now() }; p.petsOwned = ['panda']; p.room = ['🪴', '🧸', '🖼️', '🛋️']; p.owned = ['hat:🎩', 'wand:🪄']; p.equip = { hat: '🎩', wand: '🪄' }; p.stars = { 'cn-hz_pic-quiz': 3 }; Core.Store.save(); location.reload(); }, [grade, theme]);
await page.waitForTimeout(2500);
await page.waitForFunction(() => !window.App || !App.heroShot || App.heroShot('idle') || !Avatar3D.supported(), null, { timeout: 60000 }).catch(() => {});
const tag = 'g' + grade + '-' + theme + '-' + vw[0];
for (const w of which) {
  if (w === 'hub') { await page.evaluate(() => App.hub()); await page.waitForTimeout(2500); }
  else if (w === 'zone') { await page.evaluate(() => App.zoneScreen('math')); await page.waitForTimeout(1200); }
  else if (w === 'battle') { await page.evaluate(() => App.battle('cn', 0)); await page.waitForTimeout(1800); }
  else if (w === 'home' || w === 'shop') { await page.evaluate(w => { document.querySelector('.d-' + w) ? document.querySelector('.d-' + w).click() : App.hub(); }, w); await page.waitForTimeout(400); if (w === 'home' || w === 'shop') { await page.evaluate(() => App.hub()); await page.waitForTimeout(800); await page.click('.d-' + w); await page.waitForTimeout(4500); } }
  else { await page.evaluate(eng => { const p = Core.Store.p; const g = CATALOG.GAMES.find(x => x.eng === eng && p.grade >= x.g0 && p.grade <= x.g1) || CATALOG.GAMES.find(x => x.eng === eng); App.startGame(g); setTimeout(() => document.querySelector('.modal .go').click(), 200); }, w); await page.waitForTimeout(2200); }
  await page.screenshot({ path: out + '/' + tag + '-' + w + '.png' });
}
console.log('errors:', errs.slice(0, 10)); await browser.close();
