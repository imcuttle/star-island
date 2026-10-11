// 主角预渲染图：每个角色一张大头照（webp）+ 一段挥手动图（animated webp）
// 封面、存档卡片、选角色弹窗只加载这些小图，不用先下载 3D 模型（每个 2-4MB）；增改 HEROES 后要重新跑
// 用法：node tools/hero_cards.mjs [角色id,...]
//   需要 playwright-core（PW_DIR 指向装了它的目录，默认 /tmp/pw）、本机 Chrome（CHROME 可改路径）、python3 + Pillow
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import { execFileSync } from 'child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'assets/img/hero'); fs.mkdirSync(out, { recursive: true });
const tmp = '/tmp/si-hero'; fs.mkdirSync(tmp, { recursive: true });
const { chromium } = createRequire(path.join(process.env.PW_DIR || '/tmp/pw', 'package.json'))('playwright-core');

// 角色列表直接从 app.js 里读，免得两处不同步
const src = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const HEROES = Function('return ' + src.match(/const HEROES = (\[[\s\S]*?\]);/)[1])();
const only = process.argv[2] ? process.argv[2].split(',') : null;
const W = 300, H = 330, FPS = 15;

const HTML = '<!doctype html><body><script>window.Core={theme:()=>"kid",onLeave(){}};</script>' +
  ['js/vendor/three.min.js', 'js/vendor/three-gltf.min.js', 'js/vendor/three-vrm.min.js', 'assets/models/c/index.js', 'assets/models/c/vrm-index.js', 'js/avatar3d.js'].map(s => '<script src="/' + s + '"></script>').join('') + '</body>';

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: (process.env.CHROME_ARGS || '').split(' ').filter(Boolean) }); // 默认用本机 GPU，比软件渲染快几十倍
// 每个角色开一个新页面渲染：VRM 模型很大，全塞在一个页面里渲染到第七八个会把页面撑崩
async function open() {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.route('http://hero.local/**', r => {
    const p = decodeURIComponent(new URL(r.request().url()).pathname);
    if (p === '/') return r.fulfill({ contentType: 'text/html', body: HTML });
    return r.fulfill({ path: path.join(root, p) });
  });
  await page.goto('http://hero.local/');
  await page.waitForFunction(() => window.Avatar3D && Avatar3D.supported());
  return page;
}

for (const hero of HEROES) {
  if (only && !only.includes(hero.id)) continue;
  const t0 = Date.now(), page = await open();
  const r = await page.evaluate(async ([key, W, H, FPS]) => {
    const A = Avatar3D, T = THREE;
    // ① 网格里的大头照：和游戏里 HUD 头像同一套参数（正脸、站立）
    const head = await A.portrait(key, { pose: 'idle', t: .35, yaw: 0, frame: 'head', size: 160, style: 'kid' });
    // ② 预览动图：站着 → 挥手 → 回到站立（首尾都接近站立动作开头的姿势，循环播放基本看不出接缝）
    const rd = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    rd.setPixelRatio(1); rd.setSize(W, H, false); rd.outputColorSpace = T.SRGBColorSpace; rd.toneMapping = T.NoToneMapping; rd.setClearColor(0, 0);
    const sc = new T.Scene(); A.lightsFor(sc, 'kid');
    const cam = new T.PerspectiveCamera(30, W / H, .05, 100); cam.position.set(0, .95, 3.75); cam.lookAt(0, .82, 0);
    const av = await A.make(key, { height: 1.6, style: 'kid' });
    av.rotation.y = .35; sc.add(av);
    A.setViewport(W, H); A.outlineU.uOl.value = 2 / H;
    const dt = 1 / FPS, frames = [];
    const snap = () => { rd.render(sc, cam); frames.push(rd.domElement.toDataURL('image/png')); };
    // 先把头发、裙摆等弹簧骨骼晃稳
    av.play('idle', { fade: 0, restart: true }); for (let i = 0; i < 60; i++) av.update(1 / 30);
    av.play('idle', { fade: 0, restart: true }); av.update(0);
        const wave = av.has('wave') ? 'wave' : av.has('yes') ? 'yes' : 'idle';
    const wDur = av.play(wave, { restart: true, fade: .3 });
    for (let t = 0; t < wDur - .05; t += dt) { snap(); av.update(dt); }
    av.play('idle', { restart: true, fade: .4 });
    for (let t = 0; t < .5; t += dt) { snap(); av.update(dt); }
    rd.dispose(); rd.forceContextLoss(); sc.remove(av);
    return { head, frames, wave, wDur };
  }, [hero.m, W, H, FPS]);
  await page.close();
  const dir = path.join(tmp, hero.id); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  r.frames.forEach((u, i) => fs.writeFileSync(path.join(dir, String(i).padStart(4, '0') + '.png'), Buffer.from(u.split(',')[1], 'base64')));
  fs.writeFileSync(path.join(dir, 'head.png'), Buffer.from(r.head.split(',')[1], 'base64'));
  // 用 Pillow 编码：大头照静态 webp，预览 animated webp（带透明，比 GIF 清晰得多、也更小）
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
d, o, hid, fps = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
Image.open(d + '/head.png').save(o + '/' + hid + '_head.webp', 'WEBP', quality=88, method=6)
fr = [Image.open(f).convert('RGBA') for f in sorted(glob.glob(d + '/0*.png'))]
fr[0].save(o + '/' + hid + '.webp', 'WEBP', save_all=True, append_images=fr[1:], duration=round(1000 / fps), loop=0, quality=72, method=6, minimize_size=True, allow_mixed=True)
`, dir, out, hero.id, String(FPS)]);
  const kb = f => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + 'KB';
  console.log(hero.id, hero.m, r.wave, r.wDur.toFixed(2) + 's', r.frames.length + 'f', 'head ' + kb(hero.id + '_head.webp'), 'anim ' + kb(hero.id + '.webp'), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close();
