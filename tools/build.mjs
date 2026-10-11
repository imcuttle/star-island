// 把可发布的文件复制到 dist/（不含 tools、node_modules 等）
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const INCLUDE = ['index.html', 'css', 'js', 'assets'];
const SKIP = /(^|\/)(\.DS_Store|Thumbs\.db)$/;

// 先刷新场景素材清单（各场景代码里写死的语音 / 表情 / 图片，供切场景前预加载）
execFileSync(process.execPath, [path.join(root, 'tools/scene_assets.cjs')], { stdio: 'inherit' });
// 只发布语音清单里用得到的语音文件（重新生成后留下的旧文件不发布，Cloudflare Pages 单次最多 2 万个文件）
const vm = fs.readFileSync(path.join(root, 'js/voice-manifest.js'), 'utf8');
const voiceUsed = new Set(Object.values(JSON.parse(vm.slice(vm.indexOf('{'), vm.lastIndexOf('}') + 1))).map(f => f + '.mp3'));
const voiceDir = path.join(root, 'assets/voice');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
let files = 0, bytes = 0;
function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      if (src === voiceDir && !voiceUsed.has(f)) continue;
      copy(path.join(src, f), path.join(dst, f));
    }
  } else if (!SKIP.test(src)) {
    fs.copyFileSync(src, dst); files++; bytes += st.size;
  }
}
INCLUDE.forEach(f => copy(path.join(root, f), path.join(dist, f)));
// 静态资源长缓存（断网后已下载过的图片 / 模型仍能从缓存读出），页面与脚本每次重新验证
fs.writeFileSync(path.join(dist, '_headers'), [
  '/assets/*', '  Cache-Control: public, max-age=2592000, immutable', '',
  '/js/*', '  Cache-Control: public, max-age=0, must-revalidate', '',
  '/css/*', '  Cache-Control: public, max-age=0, must-revalidate', '',
].join('\n'));
console.log(`dist: ${files} files, ${(bytes / 1048576).toFixed(1)} MB`);
if (files > 19900) { console.error('文件数超过 Cloudflare Pages 上限（20000）'); process.exit(1); }
