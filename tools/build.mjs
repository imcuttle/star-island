// 把可发布的文件复制到 dist/（不含 tools、node_modules 等）
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import crypto from 'crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'assets', 'motion'];
// 体感模块（网页版）：https 下浏览器能开摄像头时才出现入口。只发布网页用得到的部分：
// 手机输入端页面、Vosk 离线语音、测试录音是桌面版专用的
const MOTION_SKIP = /^motion\/(phone\/|vendor\/(vosk|models\/vosk|test-))/;
const SKIP = /(^|\/)(\.DS_Store|Thumbs\.db)$/;
const MAX_FILE = 25 * 1048576; // Cloudflare Pages 单文件上限

// 先刷新场景素材清单（各场景代码里写死的语音 / 表情 / 图片，供切场景前预加载）
execFileSync(process.execPath, [path.join(root, 'tools/scene_assets.cjs')], { stdio: 'inherit' });
// 体感识别模型不在仓库里（motion/vendor 已 gitignore），没有就先下载；下载不了就不发布体感模块，网页版照常
let motion = fs.existsSync(path.join(root, 'motion/boot.js'));
if (motion && !['models/pose_lite.task', 'vision_worker_bundle.js'].every(f => fs.existsSync(path.join(root, 'motion/vendor', f)))) {
  try { execFileSync(process.execPath, [path.join(root, 'tools/fetch_motion_assets.mjs'), '--web'], { stdio: 'inherit' }); }
  catch (e) { console.warn('体感识别模型下载失败，本次不发布体感模块'); motion = false; }
}
// 只发布语音清单里用得到的语音文件（重新生成后留下的旧文件不发布，Cloudflare Pages 单次最多 2 万个文件）
const vm = fs.readFileSync(path.join(root, 'js/voice-manifest.js'), 'utf8');
const voiceUsed = new Set(Object.values(JSON.parse(vm.slice(vm.indexOf('{'), vm.lastIndexOf('}') + 1))).map(f => f + '.mp3'));
const voiceDir = path.join(root, 'assets/voice');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
let files = 0, bytes = 0;
const hash = crypto.createHash('sha1'); // 发布内容的指纹：写进 sw.js，内容一变离线缓存就整个换新
function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      if (src === voiceDir && !voiceUsed.has(f)) continue;
      const rel = path.relative(root, path.join(src, f)).split(path.sep).join('/');
      if (rel.startsWith('motion') && (!motion || MOTION_SKIP.test(rel + (fs.statSync(path.join(src, f)).isDirectory() ? '/' : '')))) continue;
      copy(path.join(src, f), path.join(dst, f));
    }
  } else if (!SKIP.test(src)) {
    if (st.size > MAX_FILE) { console.error('文件超过 25MB（Cloudflare Pages 上限）：' + path.relative(root, src)); process.exit(1); }
    const buf = fs.readFileSync(src); fs.writeFileSync(dst, buf); files++; bytes += st.size;
    hash.update(path.relative(root, src)); hash.update(buf);
  }
}
INCLUDE.forEach(f => (f !== 'motion' || motion) && fs.existsSync(path.join(root, f)) && copy(path.join(root, f), path.join(dist, f)));
if (!motion) { const ix = path.join(dist, 'index.html'); fs.writeFileSync(ix, fs.readFileSync(ix, 'utf8').replace(/\n?<script src="motion\/boot\.js"[^>]*><\/script>/, '')); }
const swFile = path.join(dist, 'sw.js'), ver = hash.digest('hex').slice(0, 12);
fs.writeFileSync(swFile, fs.readFileSync(swFile, 'utf8').replace("const VERSION = 'dev';", "const VERSION = '" + ver + "';"));
// 静态资源长缓存（断网后已下载过的图片 / 模型仍能从缓存读出），页面与脚本每次重新验证
fs.writeFileSync(path.join(dist, '_headers'), [
  '/assets/*', '  Cache-Control: public, max-age=2592000, immutable', '',
  '/motion/vendor/*', '  Cache-Control: public, max-age=2592000', '',
  '/motion/voice/*', '  Cache-Control: public, max-age=2592000', '',
  // 允许网页调用摄像头和麦克风（只限本站）
  '/*', '  Permissions-Policy: camera=(self), microphone=(self), fullscreen=(self), screen-wake-lock=(self)', '',
  '/js/*', '  Cache-Control: public, max-age=0, must-revalidate', '',
  '/css/*', '  Cache-Control: public, max-age=0, must-revalidate', '',
  '/sw.js', '  Cache-Control: no-cache', '',
  '/manifest.webmanifest', '  Content-Type: application/manifest+json', '  Cache-Control: public, max-age=0, must-revalidate', '',
].join('\n'));
console.log(`dist: ${files} files, ${(bytes / 1048576).toFixed(1)} MB, version ${ver}${motion ? '，含体感模块（网页版）' : ''}`);
if (files > 19900) { console.error('文件数超过 Cloudflare Pages 上限（20000）'); process.exit(1); }
