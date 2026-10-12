// 体感模块的固定提示语录音：扫描 motion/ 里 say('…') / say('…', 'en') 的字面量、游戏的 name / sayHow，
// 已在主语音包里的跳过，其余用 edge-tts（和主语音包同一音色）生成到 motion/voice/，并写 motion/voice/manifest.js
// 用法：node tools/motion_voice.mjs   （需要 python3 + edge-tts，联网）
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const mdir = path.join(root, 'motion'), out = path.join(mdir, 'voice');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (f === 'vendor' || f === 'phone' || f === 'voice') continue; if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); } })(mdir);
const keys = new Set();
const RE = /\bsay\(\s*(['"])((?:\\.|(?!\1).)+?)\1\s*(?:,\s*(['"])(en|zh)\3\s*)?\)/g;
const RE2 = /\b(?:sayHow|say)\s*:\s*(['"])((?:\\.|(?!\1).)+?)\1|\bid\s*:\s*'[\w-]+'\s*,\s*name\s*:\s*(['"])((?:\\.|(?!\3).)+?)\3/g;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(RE)) keys.add((m[4] || 'zh') + '|' + m[2].replace(/\\(.)/g, '$1'));
  for (const m of s.matchAll(RE2)) { const t = m[2] || m[4]; if (/[\u4e00-\u9fa5]/.test(t)) keys.add('zh|' + t.replace(/\\(.)/g, '$1')); }
  // 数组形式的口令表：/*say*/['…', '…']
  for (const m of s.matchAll(/\/\*say(?::(en|zh))?\*\/\s*\[([^\]]+)\]/g)) for (const t of m[2].matchAll(/(['"])((?:\\.|(?!\1).)+?)\1/g)) keys.add((m[1] || 'zh') + '|' + t[2]);
}
const vm = fs.readFileSync(path.join(root, 'js/voice-manifest.js'), 'utf8');
const have = JSON.parse(vm.slice(vm.indexOf('{'), vm.lastIndexOf('}') + 1));
const need = [...keys].filter(k => !have[k] && k.split('|')[1].trim());
fs.mkdirSync(out, { recursive: true });
const fid = k => crypto.createHash('md5').update('m1|' + k).digest('hex').slice(0, 10);
const todo = need.filter(k => !fs.existsSync(path.join(out, fid(k) + '.mp3')));
console.log(`提示语 ${keys.size} 条，主语音包已有 ${keys.size - need.length} 条，需要 ${need.length} 条，待生成 ${todo.length} 条`);
if (todo.length) {
  const list = path.join(out, '.todo.json'); fs.writeFileSync(list, JSON.stringify(todo.map(k => [k, fid(k)])));
  execFileSync('python3', ['-c', `
import asyncio, json, os, sys, edge_tts
V = {'zh': ('zh-CN-XiaoyiNeural', '-6%', '+15Hz', '+60%'), 'en': ('en-US-EmmaNeural', '-10%', '+0Hz', '+0%')}
items = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]
async def one(k, f, sem):
    lang, text = k.split('|', 1); v, r, p, vol = V[lang]; path = os.path.join(out, f + '.mp3')
    async with sem:
        for i in range(4):
            try:
                await edge_tts.Communicate(text, v, rate=r, pitch=p, volume=vol).save(path)
                if os.path.getsize(path) > 500: return
            except Exception as e: await asyncio.sleep(1.5 * (i + 1))
        print('fail', k)
async def main():
    sem = asyncio.Semaphore(8); await asyncio.gather(*[one(k, f, sem) for k, f in items])
asyncio.run(main())
`, list, out], { stdio: 'inherit' });
  fs.rmSync(list, { force: true });
}
// 去掉首尾静音（和主语音包一致），有 ffmpeg 才做
const map = {};
for (const k of need) { const f = fid(k); if (fs.existsSync(path.join(out, f + '.mp3'))) map[k] = '../../motion/voice/' + f; }
// 不再用到的旧录音删掉
const keep = new Set(Object.values(map).map(v => path.basename(v) + '.mp3'));
for (const f of fs.readdirSync(out)) if (f.endsWith('.mp3') && !keep.has(f)) fs.rmSync(path.join(out, f));
fs.writeFileSync(path.join(out, 'manifest.js'), '/* 自动生成：node tools/motion_voice.mjs —— 体感模块的提示语录音（路径相对 assets/voice/） */\nObject.assign(window.VOICE = window.VOICE || {}, ' + JSON.stringify(map) + ');\n');
console.log('motion/voice/manifest.js：' + Object.keys(map).length + ' 条');
