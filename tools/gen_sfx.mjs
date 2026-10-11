// 合成答对 / 奖励类音效（上行大调琶音 + 铃音 + 闪光），输出 assets/sfx/*.mp3
// 用法：node tools/gen_sfx.mjs [名字 ...]   需要先 npm i（devDependencies 里的 lamejs）
import fs from 'fs';
import path from 'path';
import { Mp3Encoder } from '@breezystack/lamejs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SR = 44100;
const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI 音高 → Hz
const C5 = 72, C6 = 84;

function buf(sec) { return new Float32Array(Math.ceil(sec * SR)); }
// 种子随机数：每次生成结果一致
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// 铃音：基音 + 衰减更快的泛音，轻微双音失谐让声音更"亮"
function bell(out, f, t0, dur, amp, bright = 1) {
  const parts = [[1, 1, 1], [2, .42 * bright, 1.8], [3, .16 * bright, 2.6], [4.2, .06 * bright, 4]];
  const i0 = Math.floor(t0 * SR), n = Math.min(out.length - i0, Math.floor((dur + .6) * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR, att = Math.min(1, t / .004);
    let v = 0;
    for (const [r, a, k] of parts) { if (f * r > 16000) continue; const e = Math.exp(-t * k / dur * 3.2); v += a * e * (Math.sin(2 * Math.PI * f * r * t) + .5 * Math.sin(2 * Math.PI * f * r * 1.0035 * t)); }
    out[i0 + i] += v * att * amp / 1.5;
  }
}
// 方波味的电子音（金币 / 升级），限带合成避免刺耳
function chip(out, f, t0, dur, amp, decay = 6) {
  const i0 = Math.floor(t0 * SR), n = Math.min(out.length - i0, Math.floor((dur + .25) * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR, att = Math.min(1, t / .003), e = t < dur ? Math.exp(-t * decay * .35) : Math.exp(-dur * decay * .35) * Math.exp(-(t - dur) * 30);
    let v = 0; for (let k = 1; k <= 9; k += 2) { if (f * k > 15000) break; v += Math.sin(2 * Math.PI * f * k * t) / k * Math.exp(-k * .18); }
    out[i0 + i] += v * att * e * amp;
  }
}
// 铜管：锯齿波泛音，起音时由暗变亮，稍带颤音
function brass(out, f, t0, dur, amp) {
  const i0 = Math.floor(t0 * SR), n = Math.min(out.length - i0, Math.floor((dur + .15) * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR, att = Math.min(1, t / .03), rel = t > dur ? Math.exp(-(t - dur) * 28) : 1;
    const br = Math.min(1, .35 + t * 9), vib = 1 + (t > .15 ? .004 * Math.sin(2 * Math.PI * 5.5 * t) : 0);
    let v = 0; for (let k = 1; k <= 12; k++) { if (f * k > 12000) break; v += Math.sin(2 * Math.PI * f * k * vib * t) / k * Math.exp(-(k - 1) * (1.1 - br)); }
    out[i0 + i] += v * att * rel * (.85 + .15 * Math.exp(-t * 4)) * amp;
  }
}
// 定音鼓式的低音"咚"
function boom(out, f, t0, amp) {
  const i0 = Math.floor(t0 * SR), n = Math.min(out.length - i0, Math.floor(.5 * SR));
  let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, ff = f * (1 + .6 * Math.exp(-t * 30)); ph += 2 * Math.PI * ff / SR; out[i0 + i] += Math.sin(ph) * Math.exp(-t * 7) * Math.min(1, t / .002) * amp; }
}
// 闪光：一串随机的高音小铃（只用 C 大调五声音阶，不会出现不和谐音）
const PENTA = [0, 2, 4, 7, 9];
function sparkle(out, t0, dur, count, amp) {
  for (let j = 0; j < count; j++) { const t = t0 + rnd() * dur, f = N(96 + PENTA[Math.floor(rnd() * 5)] + (rnd() < .35 ? 12 : 0)); bell(out, f, t, .12 + rnd() * .1, amp * (.5 + rnd() * .5), .4); }
}
// 简单混响（4 个梳状 + 2 个全通）
function reverb(x, wet) {
  const combs = [1557, 1617, 1491, 1422].map(d => ({ b: new Float32Array(d), i: 0, f: .78, s: 0 }));
  const aps = [225, 556].map(d => ({ b: new Float32Array(d), i: 0 }));
  const y = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let s = 0;
    for (const c of combs) { const o = c.b[c.i]; c.s = o * .6 + c.s * .4; c.b[c.i] = x[n] * .3 + c.s * c.f; c.i = (c.i + 1) % c.b.length; s += o; }
    for (const a of aps) { const o = a.b[a.i]; const v = -s * .5 + o; a.b[a.i] = s + o * .5; a.i = (a.i + 1) % a.b.length; s = v; }
    y[n] = x[n] + s * wet * .25;
  }
  return y;
}
function finish(x, wet = .5) {
  let y = reverb(x, wet), pk = 0;
  for (let i = 0; i < y.length; i++) pk = Math.max(pk, Math.abs(y[i]));
  const g = .85 / (pk || 1);
  // 结尾淡出，去掉多余的静音
  let end = y.length; while (end > 0 && Math.abs(y[end - 1] * g) < .0015) end--;
  y = y.subarray(0, Math.min(y.length, end + Math.floor(.02 * SR)));
  const fo = Math.floor(.03 * SR);
  for (let i = 0; i < y.length; i++) { y[i] *= g; if (i > y.length - fo) y[i] *= (y.length - i) / fo; }
  return y;
}

const SOUNDS = {
  // 答对：叮叮叮～ 上行大三和弦琶音
  right() {
    const o = buf(1.2); [C6, C6 + 4, C6 + 7, C6 + 12].forEach((m, i) => bell(o, N(m), i * .055, i === 3 ? .5 : .22, i === 3 ? 1 : .75));
    sparkle(o, .17, .3, 5, .12); return finish(o, .45);
  },
  // 金币：经典的上行四度"叮～"
  coin() { const o = buf(.7); chip(o, N(83), 0, .07, .5, 2); chip(o, N(88), .07, .32, .55, 9); bell(o, N(88), .07, .3, .35); return finish(o, .3); },
  // 星星 / 成就：一串上行的闪亮铃音
  star() {
    const o = buf(1.6); [0, 2, 4, 7, 9, 12, 16].forEach((d, i) => bell(o, N(C6 + d), i * .04, i === 6 ? .55 : .25, .7 + i * .04));
    bell(o, N(C6 + 12), .28, .6, .5); sparkle(o, .2, .7, 12, .14); return finish(o, .6);
  },
  // 通关：短号角 + 和弦
  win() {
    const o = buf(1.8), ns = [C5 - 5, C5, C5 + 4, C5 + 7];
    ns.forEach((m, i) => { const last = i === 3; brass(o, N(m), i * .1, last ? .55 : .085, last ? .32 : .28); bell(o, N(m + 12), i * .1, last ? .6 : .2, last ? .5 : .32); });
    brass(o, N(C5 + 4 - 12), .3, .55, .16); brass(o, N(C5 - 12), .3, .55, .14);
    sparkle(o, .35, .5, 8, .12); return finish(o, .6);
  },
  // 大胜利：号角进行曲 ta-ta-ta-TA～ ta-TAAA！
  victory() {
    const o = buf(2.8);
    const seq = [[C5, 0, .085], [C5 + 4, .1, .085], [C5 + 7, .2, .085], [C5 + 12, .3, .3], [C5 + 9, .66, .12], [C5 + 12, .8, .85]];
    seq.forEach(([m, t, d]) => { brass(o, N(m), t, d, .3); bell(o, N(m + 12), t, Math.max(.2, d), .35); });
    [[C5 - 12, .3, .3], [C5 - 5, .3, .3], [C5 - 7, .66, .12], [C5 - 12, .8, .85], [C5 - 8, .8, .85], [C5 - 5, .8, .85]].forEach(([m, t, d]) => brass(o, N(m), t, d, .13));
    boom(o, N(48), .3, .5); boom(o, N(48), .8, .6);
    sparkle(o, .85, .9, 16, .13); return finish(o, .7);
  },
  // 升级：飞快的上行音阶 + 亮闪闪的和弦
  levelup() {
    const o = buf(2), sc = [0, 4, 7, 12, 16, 19, 24];
    sc.forEach((d, i) => { chip(o, N(C5 + d), i * .05, .06, .22, 4); bell(o, N(C5 + d + 12), i * .05, .18, .4); });
    [C5 + 12, C5 + 16, C5 + 19, C5 + 24].forEach(m => bell(o, N(m), .36, .7, .4));
    sparkle(o, .4, .7, 12, .13); return finish(o, .6);
  },
};

function mp3(x) {
  const enc = new Mp3Encoder(1, SR, 96), pcm = new Int16Array(x.length), chunks = [];
  for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
  for (let i = 0; i < pcm.length; i += 1152) { const c = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (c.length) chunks.push(Buffer.from(c)); }
  const e = enc.flush(); if (e.length) chunks.push(Buffer.from(e));
  return Buffer.concat(chunks);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOUNDS);
for (const n of names) {
  if (!SOUNDS[n]) { console.error('没有这个音效：' + n); process.exit(1); }
  seed = 7; const data = mp3(SOUNDS[n]()), f = path.join(root, 'assets/sfx', n + '.mp3');
  fs.writeFileSync(f, data); console.log(n + '.mp3', (data.length / 1024).toFixed(1) + ' KB');
}
