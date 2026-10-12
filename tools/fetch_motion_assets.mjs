// 体感游戏（仅 Electron 版）用到的第三方大文件：MediaPipe 视觉推理库与模型、Vosk 离线语音识别与中 / 英文小模型
// 输出到 motion/vendor/（已 gitignore）。已存在的文件会跳过。用法：node tools/fetch_motion_assets.mjs [--web]
//   --web：只要网页版用到的（MediaPipe），不下载 Vosk 离线语音（网页版用浏览器自带识别；Vosk 模型超过 Cloudflare 单文件 25MB 上限）
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'motion/vendor');
const nm = path.join(root, 'node_modules');
fs.mkdirSync(path.join(out, 'models'), { recursive: true });
fs.mkdirSync(path.join(out, 'wasm'), { recursive: true });

const MP = 'https://storage.googleapis.com/mediapipe-models';
const MODELS = {
  'models/pose_lite.task': MP + '/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  'models/pose_full.task': MP + '/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
  'models/hand.task': MP + '/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
};
const VOSK = {
  'models/vosk-cn.tar.gz': 'https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip',
  'models/vosk-en.tar.gz': 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
};

const have = f => fs.existsSync(path.join(out, f)) && fs.statSync(path.join(out, f)).size > 1000;
async function download(url, dst) {
  process.stdout.write('下载 ' + url + ' … ');
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(dst, buf);
  console.log((buf.length / 1048576).toFixed(1) + ' MB');
}
function copy(src, dst) { if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size) fs.copyFileSync(src, dst); }

// 1) 库文件：从 node_modules 拷贝（npm i 之后就有）
const tv = path.join(nm, '@mediapipe/tasks-vision');
if (!fs.existsSync(tv)) { console.error('缺少 @mediapipe/tasks-vision，先运行 npm i'); process.exit(1); }
copy(path.join(tv, 'vision_bundle.mjs'), path.join(out, 'vision_bundle.mjs'));
// 识别 Worker 用（经典 Worker 只能加载非模块脚本）；改成 .js 后缀：有的静态托管把 .cjs 当二进制下发，importScripts 会拒绝
copy(path.join(tv, 'vision_bundle.cjs'), path.join(out, 'vision_worker_bundle.js'));
for (const f of fs.readdirSync(path.join(tv, 'wasm'))) copy(path.join(tv, 'wasm', f), path.join(out, 'wasm', f));

// 2) 模型
for (const [f, url] of Object.entries(MODELS)) if (!have(f)) await download(url, path.join(out, f));
// Vosk 官方发布 zip，vosk-browser 需要 tar.gz（里面一层模型目录）
const WEB = process.argv.includes('--web');
if (!WEB) copy(path.join(nm, 'vosk-browser/dist/vosk.js'), path.join(out, 'vosk.js'));
for (const [f, url] of Object.entries(WEB ? {} : VOSK)) {
  if (have(f)) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vosk-'));
  try {
    const zip = path.join(tmp, 'm.zip'); await download(url, zip);
    execFileSync('unzip', ['-q', zip, '-d', tmp]);
    const dir = fs.readdirSync(tmp).find(d => d.startsWith('vosk-model'));
    execFileSync('tar', ['-czf', path.join(out, f), '-C', tmp, dir]);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
console.log('motion/vendor 就绪');
