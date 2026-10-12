/* 合成音乐与音效（Web Audio，零素材）：节奏游戏需要和节拍严格同步的音乐，所以现场合成
   M.Synth.song({ bpm, style }) → { start(), stop(), beat()（从开始算的拍数，含小数）, onBeat(fn) }
   M.Synth.sfx(name, vol, pitch)：slice / splat / hit / perfect / good / miss / boom / whoosh / punch / zap / pop / chime / count / go / combo / wall / coin / wrong / magic
     怪兽和道具：roar 怪兽吼 / groan 僵尸哼 / ghost 幽灵呜 / poof 吓跑 / flap 蝙蝠扑翅 / rumble 滚石轰隆 / fire 火球 / alarm 警报 / power 拿到道具 / shield 护盾挡住 / fever 狂热 / step 脚步
     pitch：半音偏移（连续吃金币越吃越高）
   M.Synth.wind()：随速度变化的风声（{ set(0-1), stop() }） */
(function () {
  const M = window.Motion, U = M.U;
  const S = M.Synth = {};
  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  function ac() {
    if (ctx) return ctx;
    ctx = (window.Core && Core.Bank.ac()) || new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = .004; comp.release.value = .18;
    master = ctx.createGain(); master.gain.value = .9; master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(master); sfxBus = ctx.createGain(); sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    vols();
    return ctx;
  }
  function vols() {
    if (!ctx) return; const p = window.Core && Core.Store.p, set = p && p.settings;
    const v = k => window.Core ? Core.Audio2.vol(k) : .7;
    musicBus.gain.value = set && !set.music ? 0 : v('music') * 1.1;
    sfxBus.gain.value = set && !set.sfx ? 0 : v('sfx') * 1.2;
  }
  S.ac = ac; S.vols = vols;
  S.now = () => ac().currentTime;
  if (ctx && ctx.state !== 'running') ctx.resume();

  /* ---------- 乐器 ---------- */
  function env(g, t, a, d, peak, sus, rel) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(.0001, sus), t + a + d); if (rel) g.gain.exponentialRampToValueAtTime(.0001, t + a + d + rel); }
  function osc(type, f, t, dur, vol, dest, o) {
    o = o || {}; const c = ctx, s = c.createOscillator(), g = c.createGain(); s.type = type; s.frequency.setValueAtTime(f, t);
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur)); if (o.detune) s.detune.value = o.detune;
    let n = s; if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); fl.Q.value = o.q || 1; s.connect(fl); n = fl; }
    n.connect(g); g.connect(dest);
    env(g, t, o.a || .005, o.d || dur * .6, vol, o.sus || vol * .4, o.r || dur * .4);
    s.start(t); s.stop(t + dur + (o.r || dur * .4) + .05);
    return s;
  }
  function noise(t, dur, vol, dest, o) {
    o = o || {}; const c = ctx, s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); s.buffer = noiseBuf; s.loop = true;
    f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.f || 6000, t); if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur); f.Q.value = o.q || .7;
    s.connect(f); f.connect(g); g.connect(dest);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || .002)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  }
  const kick = (t, v, d) => { osc('sine', 150, t, .32, v || .9, d, { to: 42, glide: .12, a: .002, d: .1, sus: .3, r: .2 }); osc('triangle', 900, t, .02, .25, d, { to: 120, glide: .02, a: .001, d: .01, sus: .01, r: .01 }); };
  const snare = (t, v, d) => { noise(t, .18, (v || .5), d, { type: 'bandpass', f: 1800, q: .6 }); osc('triangle', 220, t, .08, (v || .5) * .6, d, { to: 160, a: .001, d: .04, sus: .05, r: .05 }); };
  const clap = (t, v, d) => { [0, .012, .024].forEach(o => noise(t + o, .12, (v || .45), d, { type: 'bandpass', f: 1400, q: 1.2 })); };
  const hat = (t, v, d, open) => noise(t, open ? .22 : .045, v || .18, d, { type: 'highpass', f: 8000 });
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);

  /* ---------- 曲风：和弦进行 + 鼓型 ---------- */
  const STYLES = {
    // 霓虹光剑：小调、四踩、锯齿琶音
    neon: { prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], drum: 'four', lead: 'sawtooth', arp: [0, 1, 2, 1, 0, 2, 1, 2], bass: 'sawtooth', pad: true },
    // 派对斗舞：大调、拍手、方波
    party: { prog: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], drum: 'party', lead: 'square', arp: [0, 2, 1, 2, 0, 2, 1, 2], bass: 'square', pad: false },
    // 酷跑：快节奏、碎拍
    run: { prog: [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]], drum: 'break', lead: 'triangle', arp: [0, 1, 2, 0, 1, 2, 1, 0], bass: 'sawtooth', pad: true },
    // 轻松（模仿 / 写字）：钢琴感
    calm: { prog: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], drum: 'soft', lead: 'triangle', arp: [0, 1, 2, 1], bass: 'triangle', pad: true },
  };
  S.song = function (o) {
    ac(); vols(); o = o || {};
    const st = STYLES[o.style] || STYLES.neon, bpm = o.bpm || 120, spb = 60 / bpm, step = spb / 4; // 16 分音符
    let t0 = 0, nextStep = 0, timer = 0, playing = false, bar = 0; const beatFns = []; let lastBeat = -1;
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(musicBus);
    function schedule() {
      const ahead = ctx.currentTime + .14;
      while (t0 + nextStep * step < ahead) {
        const t = t0 + nextStep * step, i = nextStep % 16, b = Math.floor(nextStep / 16); bar = b;
        const ch = st.prog[b % st.prog.length], intro = b < (o.intro || 0);
        // 鼓
        if (st.drum === 'four') { if (i % 4 === 0) kick(t, .9, bus); if (i === 4 || i === 12) snare(t, .35, bus); if (i % 2 === 0) hat(t, i % 4 === 2 ? .16 : .08, bus, i % 4 === 2); }
        else if (st.drum === 'party') { if (i % 4 === 0) kick(t, .85, bus); if (i === 4 || i === 12) clap(t, .5, bus); if (i % 2 === 1) hat(t, .12, bus); if (i === 14 && b % 2) snare(t, .2, bus); }
        else if (st.drum === 'break') { if (i === 0 || i === 6 || i === 10) kick(t, .9, bus); if (i === 4 || i === 12) snare(t, .45, bus); if (i % 2 === 0) hat(t, .1, bus); if (i === 15) snare(t, .15, bus); }
        else { if (i === 0 || i === 8) kick(t, .5, bus); if (i === 12) clap(t, .2, bus); if (i % 4 === 2) hat(t, .05, bus); }
        if (!intro) {
          // 贝斯：每拍根音，八分切分
          if (i % 2 === 0) osc(st.bass, NOTE(ch[0] - 24 + (i % 8 === 6 ? 12 : 0)), t, step * 1.6, .22, bus, { lp: 900, lpTo: 300, a: .004, d: .08, sus: .1, r: .06 });
          // 琶音
          const a = st.arp[i % st.arp.length]; if (i % (st.arp.length === 4 ? 4 : 2) === 0) osc(st.lead, NOTE(ch[a] + 12), t, step * 1.5, .07, bus, { lp: 3800, lpTo: 1500, a: .003, d: .06, sus: .02, r: .1, detune: 6 });
          // 铺底和弦
          if (st.pad && i === 0) ch.forEach((n, k) => { osc('sawtooth', NOTE(n), t, spb * 4, .03, bus, { lp: 1200, a: .25, d: 1, sus: .02, r: .6, detune: (k - 1) * 8 }); });
        }
        nextStep++;
      }
      // 每拍回调（拍点对齐的视觉，比如灯光闪烁）
      const bt = (ctx.currentTime - t0) / spb, bi = Math.floor(bt); if (bi !== lastBeat && bi >= 0) { lastBeat = bi; beatFns.forEach(f => f(bi)); }
    }
    const api = {
      bpm, spb, get bar() { return bar; },
      start(delay) { if (playing) return api; playing = true; t0 = ctx.currentTime + (delay || .1); nextStep = 0; timer = setInterval(schedule, 20); schedule(); return api; },
      stop() { playing = false; clearInterval(timer); try { bus.gain.setTargetAtTime(0, ctx.currentTime, .08); setTimeout(() => bus.disconnect(), 600); } catch (e) {} },
      pause() { clearInterval(timer); bus.gain.setTargetAtTime(0, ctx.currentTime, .05); api._pausedBeat = api.beat(); playing = false; },
      resume() { if (playing) return; playing = true; bus.gain.setTargetAtTime(1, ctx.currentTime, .05); const b = api._pausedBeat || 0; t0 = ctx.currentTime + .1 - b * spb; nextStep = Math.ceil(b * 4); timer = setInterval(schedule, 20); },
      beat() { return (ctx.currentTime - t0) / spb; },        // 拍数（开始前为负）
      time() { return ctx.currentTime - t0; },
      timeOfBeat(b) { return t0 + b * spb; },
      onBeat(f) { beatFns.push(f); },
      get playing() { return playing; },
    };
    return api;
  };

  // 风声：一直循环的噪声，跑得越快越响、越尖
  S.wind = function () {
    ac(); const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = .5; g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
    return {
      set(k) { const t = ctx.currentTime; k = Math.max(0, Math.min(1.5, k)); g.gain.setTargetAtTime(k * .1, t, .25); f.frequency.setTargetAtTime(280 + k * 1500, t, .25); },
      stop() { g.gain.setTargetAtTime(0, ctx.currentTime, .08); setTimeout(() => { try { src.stop(); src.disconnect(); } catch (e) {} }, 500); },
    };
  };

  /* ---------- 音效 ---------- */
  S.sfx = function (name, vol, pitch) {
    ac(); vols(); if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const t = ctx.currentTime + .005, d = sfxBus, v = vol == null ? 1 : vol, k = pitch || 0;
    switch (name) {
      case 'roar': osc('sawtooth', 120, t, 1.1, .45 * v, d, { to: 52, glide: 1, lp: 1100, lpTo: 260, a: .06, sus: .3 }); osc('sawtooth', 127, t, 1.1, .3 * v, d, { to: 55, glide: 1, lp: 800, a: .08 }); noise(t, 1.1, .45 * v, d, { type: 'bandpass', f: 700, fTo: 180, q: .8, a: .1 }); break;
      case 'groan': osc('sawtooth', 160, t, .75, .1 * v, d, { to: 92, glide: .7, lp: 650, a: .12, sus: .06 }); break;
      case 'ghost': osc('sine', 540, t, 1, .11 * v, d, { to: 360, glide: .9, a: .25, sus: .08 }); osc('sine', 548, t + .04, 1, .07 * v, d, { to: 366, glide: .9, a: .3 }); break;
      case 'poof': noise(t, .32, .32 * v, d, { type: 'highpass', f: 1800, fTo: 9000 }); osc('sine', 700, t, .22, .12 * v, d, { to: 2100, glide: .2 }); break;
      case 'flap': for (let i = 0; i < 6; i++) noise(t + i * .055, .045, .22 * v, d, { type: 'bandpass', f: 650 + i * 70, q: 2.2 }); break;
      case 'rumble': noise(t, 1.3, .6 * v, d, { type: 'lowpass', f: 260, fTo: 110, q: .9, a: .25 }); osc('sine', 46, t, 1.3, .45 * v, d, { a: .3, sus: .3 }); break;
      case 'fire': noise(t, .55, .42 * v, d, { type: 'lowpass', f: 2200, fTo: 260, a: .04 }); osc('sawtooth', 240, t, .45, .07 * v, d, { to: 85, lp: 1300 }); break;
      case 'alarm': for (let i = 0; i < 4; i++) osc('square', i % 2 ? 620 : 880, t + i * .24, .22, .08 * v, d, { lp: 3200, sus: .07 }); break;
      case 'power': for (let i = 0; i < 6; i++) osc('square', NOTE(72 + [0, 4, 7, 12, 16, 19][i]), t + i * .045, .12, .07 * v, d, { lp: 5200 }); osc('sine', 400, t, .4, .1 * v, d, { to: 1600, glide: .35 }); break;
      case 'shield': osc('triangle', 880, t, .45, .16 * v, d, { to: 1760, glide: .3 }); osc('sine', 1320, t + .05, .5, .08 * v, d); noise(t, .2, .15 * v, d, { type: 'highpass', f: 5000 }); break;
      case 'fever': for (let i = 0; i < 10; i++) osc(i % 2 ? 'square' : 'triangle', NOTE(67 + [0, 4, 7, 12, 16, 19, 24, 19, 24, 28][i]), t + i * .05, .14, .07 * v, d, { lp: 6000 }); for (let i = 0; i < 5; i++) noise(t + .2 + i * .05, .5, .06 * v, d, { type: 'bandpass', f: 1000 + Math.random() * 1500, q: 1.5, a: .05 }); break;
      case 'step': osc('sine', 88, t, .07, .2 * v, d, { to: 52, a: .002, d: .04, sus: .02, r: .04 }); noise(t, .04, .07 * v, d, { type: 'lowpass', f: 1000 }); break;
      case 'slice': noise(t, .16, .5 * v, d, { type: 'bandpass', f: 1200, fTo: 6000, q: 1.5 }); osc('sawtooth', 900, t, .08, .06 * v, d, { to: 2400, lp: 5000 }); break;
      case 'splat': noise(t, .22, .55 * v, d, { type: 'lowpass', f: 1400, fTo: 200, q: 2 }); osc('sine', 260, t, .14, .3 * v, d, { to: 80 }); break;
      case 'hit': noise(t, .09, .5 * v, d, { type: 'bandpass', f: 2600, q: .8 }); osc('square', 520, t, .07, .12 * v, d, { to: 260, lp: 3000 }); break;
      case 'punch': osc('sine', 180, t, .18, .8 * v, d, { to: 50, glide: .1 }); noise(t, .08, .4 * v, d, { type: 'lowpass', f: 2000 }); break;
      case 'perfect': [0, 4, 7, 12].forEach((n, i) => osc('triangle', NOTE(76 + n), t + i * .045, .18, .16 * v, d, { a: .003, d: .08, sus: .04, r: .15 })); break;
      case 'good': [0, 7].forEach((n, i) => osc('triangle', NOTE(72 + n), t + i * .05, .14, .14 * v, d)); break;
      case 'miss': osc('sawtooth', 200, t, .22, .12 * v, d, { to: 90, lp: 900 }); break;
      case 'wrong': osc('square', 196, t, .12, .1 * v, d, { lp: 1200 }); osc('square', 147, t + .12, .2, .1 * v, d, { lp: 1200 }); break;
      case 'boom': noise(t, 1.1, .9 * v, d, { type: 'lowpass', f: 900, fTo: 60, q: .8, a: .005 }); osc('sine', 90, t, .7, .9 * v, d, { to: 30, glide: .6 }); break;
      case 'whoosh': noise(t, .35, .35 * v, d, { type: 'bandpass', f: 400, fTo: 3000, q: 2, a: .12 }); break;
      case 'zap': osc('sawtooth', 1400, t, .25, .12 * v, d, { to: 200, lp: 6000 }); noise(t, .2, .2 * v, d, { type: 'highpass', f: 3000 }); break;
      case 'pop': osc('sine', 600, t, .08, .4 * v, d, { to: 1400, glide: .05 }); break;
      case 'chime': [0, 7, 12, 16].forEach((n, i) => osc('sine', NOTE(84 + n), t + i * .07, .5, .1 * v, d, { a: .002, d: .3, sus: .02, r: .4 })); break;
      case 'count': osc('square', 660, t, .1, .12 * v, d, { lp: 3000 }); break;
      case 'go': osc('square', 990, t, .3, .14 * v, d, { lp: 4000 }); osc('square', 1320, t + .02, .3, .08 * v, d, { lp: 4000 }); break;
      case 'combo': [0, 5, 9, 12, 16].forEach((n, i) => osc('square', NOTE(79 + n), t + i * .035, .1, .06 * v, d, { lp: 5000 })); break;
      case 'wall': osc('sawtooth', 70, t, .5, .3 * v, d, { to: 45, lp: 400 }); noise(t, .4, .3 * v, d, { type: 'lowpass', f: 500 }); break;
      case 'coin': osc('square', NOTE(88 + k), t, .06, .08 * v, d, { lp: 6000 }); osc('square', NOTE(95 + k), t + .06, .18, .08 * v, d, { lp: 6000 }); break;
      case 'magic': for (let i = 0; i < 8; i++) osc('sine', NOTE(84 + [0, 4, 7, 11, 12, 16, 19, 24][i]), t + i * .04, .25, .06 * v, d); break;
      case 'jump': osc('square', 300, t, .16, .1 * v, d, { to: 700, glide: .12, lp: 3000 }); break;
      case 'land': osc('sine', 120, t, .12, .4 * v, d, { to: 60 }); break;
      case 'tick': osc('sine', 1800, t, .02, .08 * v, d); break;
      case 'shatter': for (let i = 0; i < 4; i++) noise(t + i * .02, .12, .25 * v, d, { type: 'bandpass', f: 3000 + i * 1500, q: 3 }); osc('triangle', 1600, t, .1, .1 * v, d, { to: 600 }); break;
      case 'cheer': for (let i = 0; i < 6; i++) noise(t + i * .05, .5, .07 * v, d, { type: 'bandpass', f: 1000 + Math.random() * 1500, q: 1.5, a: .05 }); break;
      case 'laser': osc('sawtooth', 2400, t, .18, .1 * v, d, { to: 300, glide: .16, lp: 7000 }); break;
      case 'charge': osc('sawtooth', 120, t, .8, .08 * v, d, { to: 900, glide: .8, lp: 2000 }); break;
    }
  };
})();
