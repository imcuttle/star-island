/* 快乐乐园 · 自由玩耍空间（按角色等级解锁，家长中心「放开全部限制」后全部可玩）
   泡泡乐园 / 烟花夜空 / 万花筒 / 积木物理 / 魔法水族箱
   全部用 canvas 实时绘制 + WebAudio 合成音效，不需要额外素材；表情贴图走 Core.emoSrc（本地 Twemoji / Fluent 3D） */
(function () {
  const { E, hydrate, Store, Audio2, emoSrc, UI } = Core;
  const $$ = (s, r) => Array.from(r.querySelectorAll(s));
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
  const TAU = Math.PI * 2;

  const SPACES = [
    { id: 'bubble', n: '泡泡乐园', e: '🫧', lv: 2, sub: '吹出彩虹泡泡，戳破会掉出小惊喜' },
    { id: 'fire', n: '烟花夜空', e: '🎆', lv: 3, sub: '点一点夜空，放出爱心、星星、萌宠烟花' },
    { id: 'kaleido', n: '万花筒', e: '🔮', lv: 5, sub: '随手一画就是对称的魔法图案，还会唱歌' },
    { id: 'phys', n: '积木物理', e: '🧱', lv: 7, sub: '堆积木、扔皮球、玩跷跷板，还能改变重力' },
    { id: 'aqua', n: '魔法水族箱', e: '🐠', lv: 10, sub: '养一缸自己的海洋伙伴，喂食、摸摸、开夜灯' },
  ];

  /* ---------- 表情贴图：预先栅格化到离屏 canvas，逐帧绘制更快 ---------- */
  const SPR = {};
  function spr(ch) {
    const src = emoSrc(ch); let s = SPR[src];
    if (!s) { s = SPR[src] = { ok: false, cv: document.createElement('canvas') }; s.cv.width = s.cv.height = 128; const i = new Image(); i.onload = () => { s.cv.getContext('2d').drawImage(i, 0, 0, 128, 128); s.ok = true; }; i.src = src; }
    return s.ok ? s.cv : null;
  }
  function drawE(ctx, ch, x, y, size, rot, flip, alpha) {
    const c = spr(ch); if (!c) return;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1); if (alpha != null) ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(c, -size / 2, -size / 2, size, size); ctx.restore();
  }

  /* ---------- 合成音效（遵循「音效开关」） ---------- */
  let AC;
  const ac = () => { const p = Store.p; if (p && !p.settings.sfx) return null; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { return null; } return AC; };
  function blip(f, d, type, vol, slide) {
    const a = ac(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .15, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .05);
  }
  function noise(d, vol, freq) {
    const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq || 800; g.gain.value = vol || .3;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880, 1046.5];

  /* ---------- 通用舞台：工具条 + 自适应 canvas + 动画循环 ---------- */
  const tb = (k, e, n, on, v) => '<button class="ftb' + (on ? ' on' : '') + '" data-k="' + k + '"' + (v != null ? ' data-v="' + v + '"' : '') + ' data-say="' + n + '" data-tip="' + n + '">' + (e ? E(e) : '') + '<span>' + n + '</span></button>';
  const sep = '<span class="sep"></span>';
  function stage(box, tools) {
    box.classList.add('fun');
    box.innerHTML = '<div class="dtools ftools">' + tools + '</div><div class="fwrap"><canvas class="fcv"></canvas><div class="fhint"></div></div>';
    hydrate(box);
    const cv = box.querySelector('.fcv'), ctx = cv.getContext('2d');
    const S = { cv, ctx, W: 1, H: 1, dpr: 1, tools: box.querySelector('.ftools') };
    const fit = () => { const r = cv.getBoundingClientRect(); S.dpr = Math.min(2, devicePixelRatio || 1); S.W = Math.max(1, r.width); S.H = Math.max(1, r.height); cv.width = Math.round(S.W * S.dpr); cv.height = Math.round(S.H * S.dpr); ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); if (S.onResize) S.onResize(); };
    const ro = new ResizeObserver(fit); ro.observe(cv); fit();
    let raf = 0, dead = false, last = performance.now();
    S.loop = f => { const step = t => { if (dead) return; if (!cv.isConnected) return S.stop(); const dt = Math.min(.05, Math.max(0, (t - last) / 1000)); last = t; f(dt, t / 1000); raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); };
    S.stop = () => { if (dead) return; dead = true; cancelAnimationFrame(raf); ro.disconnect(); if (S.onStop) S.onStop(); };
    S.pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    S.hint = t => { const el = box.querySelector('.fhint'); el.textContent = t; el.classList.remove('out'); clearTimeout(S.ht); S.ht = setTimeout(() => el.classList.add('out'), 4000); };
    S.on = fn => S.tools.addEventListener('click', e => { const b = e.target.closest('.ftb'); if (b) { Audio2.sfx('click', .3); fn(b.dataset.k, b); } });
    S.radio = (b, sel) => $$(sel || '.ftb[data-k="' + b.dataset.k + '"]', S.tools).forEach(x => x.classList.toggle('on', x === b));
    return S;
  }

  /* =================== 1. 泡泡乐园 =================== */
  function bubble(box) {
    const GIFTS = ['⭐', '🍬', '🍭', '🌸', '🐱', '🐶', '🐰', '🦄', '❤️', '🎈', '🍩', '💎'];
    const S = stage(box, tb('machine', '🌀', '泡泡机') + tb('gift', '🎁', '藏惊喜', true) + tb('giant', '🫧', '超大泡泡') + sep + '<span class="fcount">戳破 <b>0</b> 个</span>');
    const { ctx } = S; let bubs = [], drops = [], fx = [], machine = false, gift = true, giant = false, popped = 0, mt = 0;
    const cnt = S.tools.querySelector('.fcount b');
    const add = (x, y, r, vx, vy) => { if (bubs.length > 90) bubs.shift(); bubs.push({ x, y, r, vx: vx || rnd(-20, 20), vy: vy || rnd(-40, -15), hue: rnd(0, 360), ph: rnd(0, TAU), age: 0, life: rnd(10, 16), g: gift && Math.random() < .45 ? pick(GIFTS) : null }); };
    const pop = (b, quiet) => {
      bubs.splice(bubs.indexOf(b), 1); popped++; cnt.textContent = popped;
      fx.push({ x: b.x, y: b.y, r: b.r, t: 0, hue: b.hue });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; fx.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, t: 0, d: 1, hue: b.hue }); }
      if (!quiet) blip(Math.max(300, 1500 - b.r * 12), .09, 'sine', .18, Math.max(150, 700 - b.r * 6));
      if (b.g) { if (drops.length > 40) drops.shift(); drops.push({ e: b.g, x: b.x, y: b.y, vx: rnd(-60, 60), vy: -120, rot: 0, vr: rnd(-4, 4), age: 0, sz: Math.max(30, b.r * 1.1) }); }
      if (popped % 50 === 0) { Audio2.sfx('win', .4); UI.confetti(40); UI.toast('已经戳破 ' + popped + ' 个泡泡啦！'); }
    };
    const hit = (x, y) => { for (let i = bubs.length - 1; i >= 0; i--) { const b = bubs[i]; if (Math.hypot(b.x - x, b.y - y) < b.r + 6) return b; } return null; };
    S.on((k, b) => {
      if (k === 'machine') { machine = !machine; b.classList.toggle('on', machine); S.hint(machine ? '泡泡机开动啦！' : '泡泡机关掉了'); }
      if (k === 'gift') { gift = !gift; b.classList.toggle('on', gift); S.hint(gift ? '有的泡泡里藏着小惊喜哦' : '只吹普通泡泡'); }
      if (k === 'giant') { giant = !giant; b.classList.toggle('on', giant); S.hint(giant ? '按住不放，泡泡会越吹越大！' : '回到普通泡泡棒'); }
    });
    let drag = null;
    S.cv.onpointerdown = e => {
      S.cv.setPointerCapture(e.pointerId); const [x, y] = S.pt(e), b = hit(x, y);
      if (b) { pop(b); drag = { mode: 'pop' }; return; }
      if (giant) { add(x, y, 12, 0, 0); drag = { mode: 'grow', b: bubs[bubs.length - 1] }; return; }
      drag = { mode: 'blow', x, y, t: 0 }; add(x, y, rnd(16, 40));
    };
    S.cv.onpointermove = e => {
      if (!drag) return; const [x, y] = S.pt(e);
      if (drag.mode === 'pop') { const b = hit(x, y); if (b) pop(b); }
      else if (drag.mode === 'grow') { drag.b.x = x; drag.b.y = y; }
      else { const d = Math.hypot(x - drag.x, y - drag.y); if (d > 26) { add(x, y, rnd(10, 36), (x - drag.x) * 2, (y - drag.y) * 2 - 30); drag.x = x; drag.y = y; blip(rnd(600, 900), .05, 'sine', .03); } }
    };
    S.cv.onpointerup = S.cv.onpointercancel = () => { if (drag && drag.mode === 'grow' && drag.b) { drag.b.vy = -25; } drag = null; };
    for (let i = 0; i < 10; i++) add(rnd(40, 600), rnd(80, 400), rnd(16, 44));
    S.hint('按住拖动吹泡泡，戳一戳把它们弄破！');
    S.loop((dt, t) => {
      const { W, H } = S;
      if (drag && drag.mode === 'grow' && drag.b && bubs.includes(drag.b)) { drag.b.r = Math.min(Math.min(W, H) * .32, drag.b.r + 40 * dt); drag.b.age = 0; }
      if (machine && (mt -= dt) < 0) { mt = .22; const side = Math.random() < .5; add(side ? 30 : W - 30, H - 30, rnd(12, 34), side ? rnd(40, 140) : rnd(-140, -40), rnd(-120, -60)); }
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9fd8ff'); g.addColorStop(.6, '#ffe3f1'); g.addColorStop(1, '#fff5d6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; [[.15, .14, 1], [.62, .1, 1.3], [.86, .22, .9]].forEach(c => { const cx = ((c[0] * W + t * 8 * c[2]) % (W + 160)) - 80, cy = c[1] * H, s = 26 * c[2]; ctx.beginPath(); ctx.arc(cx, cy, s, 0, TAU); ctx.arc(cx + s, cy - s * .4, s * 1.2, 0, TAU); ctx.arc(cx + s * 2.1, cy, s * .9, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#9be38f'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 18 - Math.sin(x / 70) * 6); ctx.lineTo(W, H); ctx.fill();
      for (let i = bubs.length - 1; i >= 0; i--) {
        const b = bubs[i]; b.age += dt; b.ph += dt * 2;
        if (!(drag && drag.b === b)) { b.vy += (-14 - 300 / b.r) * dt; b.vx += Math.sin(b.ph) * 12 * dt; b.vx *= .985; b.vy *= .985; b.x += b.vx * dt; b.y += b.vy * dt; }
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * .6; } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * .6; }
        if (b.y < -b.r * 2 || b.y > H + b.r * 2) { bubs.splice(i, 1); continue; }
        if (b.age > b.life) { pop(b, true); continue; }
        const { x, y, r } = b, hue = b.hue + t * 40;
        if (b.g) drawE(ctx, b.g, x, y + Math.sin(b.ph) * 2, r * 1.05, Math.sin(b.ph * .7) * .2, false, .9);
        const rg = ctx.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
        rg.addColorStop(0, 'rgba(255,255,255,.04)'); rg.addColorStop(.7, 'hsla(' + hue + ',90%,80%,.12)'); rg.addColorStop(.92, 'hsla(' + (hue + 70) + ',95%,70%,.38)'); rg.addColorStop(1, 'hsla(' + (hue + 140) + ',95%,75%,.6)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'hsla(' + (hue + 200) + ',90%,85%,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x - r * .38, y - r * .42, r * .2, r * .11, -.7, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x + r * .42, y + r * .38, r * .07, 0, TAU); ctx.fill();
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.age += dt; d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
        const fl = H - 20 - d.sz / 2; if (d.y > fl) { d.y = fl; d.vy = -Math.abs(d.vy) * .45; d.vx *= .8; d.vr *= .7; if (Math.abs(d.vy) > 60) blip(rnd(200, 300), .05, 'triangle', .05); }
        if (d.x < d.sz / 2 || d.x > W - d.sz / 2) d.vx *= -1;
        if (d.age > 7) { drops.splice(i, 1); continue; }
        drawE(ctx, d.e, d.x, d.y, d.sz, d.rot, false, d.age > 6 ? 7 - d.age : 1);
      }
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i]; f.t += dt;
        if (f.d) { if (f.t > .35) { fx.splice(i, 1); continue; } f.x += f.vx * dt; f.y += f.vy * dt; ctx.fillStyle = 'hsla(' + f.hue + ',90%,75%,' + (1 - f.t / .35) + ')'; ctx.beginPath(); ctx.arc(f.x, f.y, 2.5, 0, TAU); ctx.fill(); }
        else { if (f.t > .25) { fx.splice(i, 1); continue; } ctx.strokeStyle = 'rgba(255,255,255,' + (1 - f.t / .25) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + f.t * 2), 0, TAU); ctx.stroke(); }
      }
    });
    return S.stop;
  }

  /* =================== 2. 烟花夜空 =================== */
  function fire(box) {
    const PETS = ['🐱', '🐶', '🐰', '🦄', '⭐', '❤️', '🌸', '🍭'];
    const S = stage(box, tb('shape', '🌸', '圆形', true, 'peony') + tb('shape', '❤️', '爱心', false, 'heart') + tb('shape', '⭐', '星星', false, 'star') + tb('shape', '🪐', '光环', false, 'ring') + tb('shape', '🐱', '萌宠', false, 'emoji') + tb('shape', '🌈', '随机', false, 'mix') + sep + tb('auto', '🎆', '自动表演'));
    const { ctx } = S; let shape = 'peony', auto = false, at = 0, rockets = [], parts = [], flash = 0, stars = [];
    const mkStars = () => { stars = Array.from({ length: 90 }, () => ({ x: Math.random() * S.W, y: Math.random() * S.H * .7, s: rnd(.5, 1.8), p: rnd(0, TAU) })); };
    S.onResize = () => { ctx.fillStyle = '#0a0c28'; ctx.fillRect(0, 0, S.W, S.H); mkStars(); };
    S.onResize();
    S.on((k, b) => { if (k === 'shape') { shape = b.dataset.v; S.radio(b); } if (k === 'auto') { auto = !auto; b.classList.toggle('on', auto); S.hint(auto ? '烟花表演开始啦！' : '表演结束，自己来放吧'); } });
    const launch = (tx, ty, sh) => {
      const x0 = Math.max(20, Math.min(S.W - 20, tx + rnd(-60, 60)));
      rockets.push({ x: x0, y: S.H - 30, x0, y0: S.H - 30, tx, ty, t: 0, d: rnd(.65, .95), hue: rnd(0, 360), sh: sh === 'mix' ? pick(['peony', 'heart', 'star', 'ring', 'emoji', 'willow']) : sh });
      blip(rnd(350, 450), .7, 'sine', .04, rnd(1100, 1500));
    };
    const explode = r => {
      const N = 90, sp = Math.min(S.W, S.H) * rnd(.28, .36), add = (vx, vy, o) => parts.push(Object.assign({ x: r.x, y: r.y, vx, vy, life: rnd(1.2, 1.8), max: 1.8, hue: r.hue + rnd(-15, 15), sz: rnd(1.6, 2.6) }, o));
      if (r.sh === 'heart') for (let i = 0; i < N; i++) { const t = i / N * TAU, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); add(x / 17 * sp, -y / 17 * sp, { hue: 340 + rnd(-10, 10) }); }
      else if (r.sh === 'star') for (let i = 0; i < N; i++) { const k = i / N * 10, s = Math.floor(k), f = k - s, a0 = s / 10 * TAU - Math.PI / 2, a1 = (s + 1) / 10 * TAU - Math.PI / 2, r0 = s % 2 ? .45 : 1, r1 = s % 2 ? 1 : .45, x = Math.cos(a0) * r0 * (1 - f) + Math.cos(a1) * r1 * f, y = Math.sin(a0) * r0 * (1 - f) + Math.sin(a1) * r1 * f; add(x * sp, y * sp, { hue: 50 + rnd(-10, 10) }); }
      else if (r.sh === 'ring') { for (let i = 0; i < 70; i++) { const a = i / 70 * TAU; add(Math.cos(a) * sp, Math.sin(a) * sp * .45); } for (let i = 0; i < 30; i++) { const a = rnd(0, TAU), v = rnd(0, .3) * sp; add(Math.cos(a) * v, Math.sin(a) * v, { hue: r.hue + 180 }); } }
      else if (r.sh === 'emoji') { const em = pick(PETS); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; add(Math.cos(a) * sp * .8, Math.sin(a) * sp * .8, { em, sz: 30, life: 2, max: 2 }); } for (let i = 0; i < 50; i++) { const a = rnd(0, TAU), v = rnd(.3, 1) * sp; add(Math.cos(a) * v, Math.sin(a) * v); } }
      else if (r.sh === 'willow') for (let i = 0; i < N; i++) { const a = rnd(0, TAU), v = rnd(.4, 1) * sp * .8; add(Math.cos(a) * v, Math.sin(a) * v, { hue: 42, life: rnd(2.2, 3), max: 3, willow: 1 }); }
      else for (let i = 0; i < N; i++) { const a = rnd(0, TAU), v = rnd(.55, 1) * sp; add(Math.cos(a) * v, Math.sin(a) * v); }
      flash = .35; noise(1, .45, 500); setTimeout(() => noise(.4, .12, 3000), 380);
    };
    S.cv.onpointerdown = e => { const [x, y] = S.pt(e); launch(x, Math.min(y, S.H - 80), shape); };
    S.hint('点一点夜空，在那里放一朵烟花！');
    S.loop((dt, t) => {
      const { W, H } = S;
      if (auto && (at -= dt) < 0) { at = rnd(.35, .9); launch(rnd(W * .1, W * .9), rnd(H * .12, H * .45), 'mix'); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10,12,40,.24)'; ctx.fillRect(0, 0, W, H);
      stars.forEach(s => { ctx.fillStyle = 'rgba(255,255,240,' + (.4 + .4 * Math.sin(t * 2 + s.p)) + ')'; ctx.fillRect(s.x, s.y, s.s, s.s); });
      ctx.globalCompositeOperation = 'lighter';
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]; r.t += dt; const k = Math.min(1, r.t / r.d), e = 1 - Math.pow(1 - k, 2);
        r.x = r.x0 + (r.tx - r.x0) * e; r.y = r.y0 + (r.ty - r.y0) * e;
        ctx.fillStyle = 'hsl(' + r.hue + ',100%,80%)'; ctx.beginPath(); ctx.arc(r.x, r.y, 2.6, 0, TAU); ctx.fill();
        parts.push({ x: r.x, y: r.y, vx: rnd(-15, 15), vy: rnd(10, 40), life: .4, max: .4, hue: 40, sz: 1.4 });
        if (k >= 1) { rockets.splice(i, 1); explode(r); }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
        const drag = p.willow ? .965 : .975; p.vx *= Math.pow(drag, dt * 60); p.vy = p.vy * Math.pow(drag, dt * 60) + (p.willow ? 70 : 55) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const a = p.life / p.max;
        if (p.em) { ctx.globalCompositeOperation = 'source-over'; drawE(ctx, p.em, p.x, p.y, p.sz * (.6 + a * .6), 0, false, a); ctx.globalCompositeOperation = 'lighter'; continue; }
        ctx.fillStyle = 'hsla(' + p.hue + ',100%,' + (55 + a * 25) + '%,' + (a * (.7 + Math.random() * .3)) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (.5 + a * .7), 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (flash > 0) { flash -= dt; ctx.fillStyle = 'rgba(255,240,220,' + flash * .15 + ')'; ctx.fillRect(0, 0, W, H); }
      // 远山 + 小房子剪影（窗户亮着灯）
      ctx.fillStyle = '#0d0f2e'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H - 50 - Math.sin(x / 120) * 22 - Math.sin(x / 47) * 8); ctx.lineTo(W, H); ctx.fill();
      ctx.fillStyle = '#070818';
      for (let i = 0, n = Math.ceil(W / 120); i < n; i++) { const x = i * 120 + 30, hh = 34 + (i * 37 % 22); ctx.fillRect(x, H - hh, 46, hh); ctx.beginPath(); ctx.moveTo(x - 6, H - hh); ctx.lineTo(x + 23, H - hh - 20); ctx.lineTo(x + 52, H - hh); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,214,120,.85)'; for (let i = 0, n = Math.ceil(W / 120); i < n; i++) { const x = i * 120 + 30, hh = 34 + (i * 37 % 22); ctx.fillRect(x + 9, H - hh + 9, 10, 10); if (i % 2) ctx.fillRect(x + 27, H - hh + 9, 10, 10); }
    });
    return S.stop;
  }

  /* =================== 3. 万花筒 =================== */
  function kaleido(box) {
    const S = stage(box, tb('n', '', '4 瓣', false, 4) + tb('n', '', '6 瓣', true, 6) + tb('n', '', '8 瓣', false, 8) + tb('n', '', '12 瓣', false, 12) + sep +
      tb('brush', '✨', '光线', true, 'line') + tb('brush', '🌟', '星点', false, 'dot') + tb('brush', '🌸', '花朵', false, 'emoji') + sep +
      tb('spin', '🌀', '旋转') + tb('music', '🎵', '音乐', true) + tb('clear', '🧽', '清空'));
    const { ctx } = S; let n = 6, brush = 'line', spin = false, music = true, ang = 0, hue = 0, last = null, acc = 0, nt = 0;
    const FL = ['🌸', '⭐', '🦋', '❤️', '🍭', '🌈'];
    const L = document.createElement('canvas'), lc = L.getContext('2d'); let D = 0;
    const ensure = () => {
      const need = Math.ceil(Math.hypot(S.W, S.H) * S.dpr) + 4; if (need <= D) return;
      const old = D ? (() => { const c = document.createElement('canvas'); c.width = c.height = D; c.getContext('2d').drawImage(L, 0, 0); return c; })() : null;
      const oD = D; D = need; L.width = L.height = D; if (old) lc.drawImage(old, (D - oD) / 2, (D - oD) / 2);
    };
    S.onResize = ensure; ensure();
    S.on((k, b) => {
      if (k === 'n') { n = +b.dataset.v; S.radio(b); }
      if (k === 'brush') { brush = b.dataset.v; S.radio(b); }
      if (k === 'spin') { spin = !spin; b.classList.toggle('on', spin); }
      if (k === 'music') { music = !music; b.classList.toggle('on', music); }
      if (k === 'clear') { lc.clearRect(0, 0, D, D); Audio2.sfx('whoosh', .3); }
    });
    // 屏幕坐标 → 以中心为原点、抵消旋转后的画布坐标（设备像素）
    const loc = (x, y) => { const dx = x - S.W / 2, dy = y - S.H / 2, c = Math.cos(-ang), s = Math.sin(-ang); return [(dx * c - dy * s) * S.dpr, (dx * s + dy * c) * S.dpr]; };
    const sym = f => { for (let k = 0; k < n; k++) { const a = k / n * TAU; for (const m of [1, -1]) { lc.save(); lc.translate(D / 2, D / 2); lc.rotate(a); lc.scale(1, m); f(); lc.restore(); } } };
    const note = (a) => { if (!music) return; const now = performance.now(); if (now - nt < 110) return; nt = now; const r = Math.hypot(a[0], a[1]) / S.dpr, i = Math.min(PENTA.length - 1, Math.floor(r / (Math.min(S.W, S.H) / 2) * PENTA.length)); blip(PENTA[PENTA.length - 1 - i], .5, 'triangle', .07); };
    const paint = (a, b) => {
      const col = 'hsl(' + hue + ',100%,62%)', d = S.dpr;
      lc.globalCompositeOperation = 'lighter';
      if (brush === 'line') sym(() => { lc.strokeStyle = col; lc.shadowColor = col; lc.shadowBlur = 10 * d; lc.lineWidth = 3.2 * d; lc.lineCap = 'round'; lc.beginPath(); lc.moveTo(a[0], a[1]); lc.lineTo(b[0], b[1]); lc.stroke(); });
      else if (brush === 'dot') { const r = rnd(1.5, 6) * d, j = [b[0] + rnd(-6, 6) * d, b[1] + rnd(-6, 6) * d]; sym(() => { lc.fillStyle = col; lc.shadowColor = col; lc.shadowBlur = 14 * d; lc.beginPath(); lc.arc(j[0], j[1], r, 0, TAU); lc.fill(); }); }
      else { lc.globalCompositeOperation = 'source-over'; const c = spr(pick(FL)); if (c) { const s = rnd(22, 40) * d, rot = rnd(0, TAU); sym(() => { lc.translate(b[0], b[1]); lc.rotate(rot); lc.drawImage(c, -s / 2, -s / 2, s, s); }); } }
      lc.shadowBlur = 0; lc.globalCompositeOperation = 'source-over';
      hue = (hue + 2.5) % 360; note(b);
    };
    S.cv.onpointerdown = e => { S.cv.setPointerCapture(e.pointerId); last = loc(...S.pt(e)); acc = 0; paint(last, [last[0] + .1, last[1]]); };
    S.cv.onpointermove = e => {
      if (!last) return; const p = loc(...S.pt(e)), dd = Math.hypot(p[0] - last[0], p[1] - last[1]) / S.dpr;
      if (brush === 'line') { paint(last, p); last = p; return; }
      acc += dd; const step = brush === 'dot' ? 10 : 42; if (acc >= step) { acc = 0; paint(last, p); } last = p;
    };
    S.cv.onpointerup = S.cv.onpointercancel = () => { last = null; };
    S.hint('随便画一笔，看看会变出什么魔法图案！');
    S.loop(dt => {
      const { W, H } = S; if (spin) ang += dt * .35;
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, '#1c1446'); g.addColorStop(1, '#05040f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang);
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; const R = Math.hypot(W, H) / 2;
      for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
      ctx.drawImage(L, -D / 2 / S.dpr, -D / 2 / S.dpr, D / S.dpr, D / S.dpr);
      ctx.restore();
    });
    return S.stop;
  }

  /* =================== 4. 积木物理 =================== */
  function phys(box) {
    const M = window.Matter;
    if (!M) { box.innerHTML = '<p class="dim">物理引擎没有加载成功，刷新一下试试吧</p>'; return null; }
    const ITEMS = { '⚽': { r: 22, rest: .75, den: .001, f: 520 }, '🧱': { box: 46, rest: .05, den: .002, f: 160 }, '🍉': { r: 32, rest: .25, den: .003, f: 140 }, '🧸': { r: 27, rest: .35, den: .0012, f: 300 }, '🦆': { r: 21, rest: .92, den: .0008, f: 780 }, '🥚': { r: 18, rest: .5, den: .0012, f: 640 }, '🪀': { r: 17, rest: .85, den: .0009, f: 900 } };
    const GRAV = [[1, '🌍', '正常重力'], [0, '🪐', '太空失重'], [-1, '🎈', '反重力']];
    const S = stage(box, Object.keys(ITEMS).map((k, i) => tb('item', k, ['皮球', '积木', '西瓜', '小熊', '小黄鸭', '鸡蛋', '悠悠球'][i], i === 1, k)).join('') + sep + tb('grav', '🌍', '正常重力') + tb('quake', '🌋', '大地震') + tb('rain', '🌈', '玩具雨') + tb('clear', '🧽', '清空'));
    const { ctx } = S, eng = M.Engine.create(), W0 = eng.world; let item = '🧱', gi = 0, statics = [], plank = null, pivot = null, dragC = null, lastSnd = 0, accT = 0, shake = 0;
    eng.gravity.y = 1;
    const build = () => {
      const { W, H } = S; M.Composite.remove(W0, statics); if (plank) M.Composite.remove(W0, [plank, pivot]);
      const o = { isStatic: true, friction: .8, restitution: .2 };
      statics = [M.Bodies.rectangle(W / 2, H + 30, W * 3, 80, o), M.Bodies.rectangle(-30, H / 2, 60, H * 3, o), M.Bodies.rectangle(W + 30, H / 2, 60, H * 3, o), M.Bodies.rectangle(W / 2, -30, W * 3, 60, o),
        M.Bodies.rectangle(W * .17, H * .36, W * .26, 14, Object.assign({ angle: .3 }, o)), M.Bodies.rectangle(W * .83, H * .3, W * .26, 14, Object.assign({ angle: -.3 }, o))];
      statics.forEach((b, i) => { b.vis = i >= 4; b.len = W * .26; });
      M.Composite.add(W0, statics);
      const py = H - 70; plank = M.Bodies.rectangle(W / 2, py, Math.min(420, W * .42), 14, { density: .002, friction: .9 }); plank.isPlank = true;
      pivot = M.Constraint.create({ pointA: { x: W / 2, y: py }, bodyB: plank, length: 0, stiffness: 1 }); pivot.py = py;
      M.Composite.add(W0, [plank, pivot]);
    };
    S.onResize = build; build();
    const dyn = () => M.Composite.allBodies(W0).filter(b => !b.isStatic && !b.isPlank);
    const spawn = (k, x, y, vx, vy) => {
      const D = ITEMS[k], o = { restitution: D.rest, density: D.den, friction: .5, frictionAir: .008 };
      const b = D.box ? M.Bodies.rectangle(x, y, D.box, D.box, o) : M.Bodies.circle(x, y, D.r, o);
      b.em = k; b.sz = D.box ? D.box : D.r * 2.2; b.sf = D.f; M.Body.setAngle(b, rnd(-.3, .3)); if (vx != null) M.Body.setVelocity(b, { x: vx, y: vy });
      M.Composite.add(W0, b); const all = dyn(); if (all.length > 70) M.Composite.remove(W0, all[0]);
    };
    S.on((k, b) => {
      if (k === 'item') { item = b.dataset.v; S.radio(b); }
      if (k === 'grav') { gi = (gi + 1) % GRAV.length; const g = GRAV[gi]; eng.gravity.y = g[0]; b.innerHTML = E(g[1]) + '<span>' + g[2] + '</span>'; dyn().forEach(x => { x.frictionAir = g[0] ? .008 : .002; if (!g[0]) M.Body.setVelocity(x, { x: x.velocity.x + rnd(-1.5, 1.5), y: x.velocity.y + rnd(-1.5, 1.5) }); }); S.hint(g[2] + '！'); }
      if (k === 'quake') { dyn().concat(plank).forEach(x => M.Body.setVelocity(x, { x: x.velocity.x + rnd(-9, 9), y: x.velocity.y - rnd(4, 11) * (eng.gravity.y || 1) })); noise(.8, .5, 220); shake = .5; }
      if (k === 'rain') { const ks = Object.keys(ITEMS); for (let i = 0; i < 16; i++) setTimeout(() => S.cv.isConnected && spawn(pick(ks), rnd(40, S.W - 40), eng.gravity.y < 0 ? S.H - 40 : 30, rnd(-2, 2), 0), i * 70); }
      if (k === 'clear') { M.Composite.remove(W0, dyn()); Audio2.sfx('whoosh', .3); }
    });
    S.cv.onpointerdown = e => {
      S.cv.setPointerCapture(e.pointerId); const [x, y] = S.pt(e);
      const hit = M.Query.point(dyn().concat(plank), { x, y })[0];
      if (hit) { const lp = { x: x - hit.position.x, y: y - hit.position.y }, c = Math.cos(-hit.angle), s = Math.sin(-hit.angle); dragC = M.Constraint.create({ pointA: { x, y }, bodyB: hit, pointB: { x: lp.x * c - lp.y * s, y: lp.x * s + lp.y * c }, stiffness: .12, damping: .08, length: 0 }); M.Composite.add(W0, dragC); blip(500, .06, 'sine', .06); return; }
      spawn(item, x, y); Audio2.sfx('pop', .3);
    };
    S.cv.onpointermove = e => { if (!dragC) return; const [x, y] = S.pt(e); dragC.pointA.x = x; dragC.pointA.y = y; };
    S.cv.onpointerup = S.cv.onpointercancel = () => { if (dragC) { M.Composite.remove(W0, dragC); dragC = null; } };
    M.Events.on(eng, 'collisionStart', ev => {
      const now = performance.now(); if (now - lastSnd < 45) return;
      for (const pr of ev.pairs) { const a = pr.bodyA, b = pr.bodyB, v = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y); if (v < 3.5) continue; const it = a.em ? a : b.em ? b : null; if (!it) continue; lastSnd = now; blip(it.sf * rnd(.9, 1.1), .12, it.em === '🧱' ? 'square' : 'triangle', Math.min(.12, v * .012), it.sf * .6); break; }
    });
    S.onStop = () => { M.Events.off(eng); M.Composite.clear(W0, false); M.Engine.clear(eng); };
    ['⚽', '🧱', '🧱', '🧱', '🦆', '🧸'].forEach((k, i) => spawn(k, S.W * (.25 + i * .1), 40 + i * 20));
    S.hint('点空白处放玩具，按住玩具可以拖着甩出去！');
    const plankDraw = (b, w, hgt, col) => { ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -hgt / 2, w, hgt, 7) : ctx.rect(-w / 2, -hgt / 2, w, hgt); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-w / 2 + 6, -hgt / 2 + 2, w - 12, 3); ctx.restore(); };
    S.loop((dt, t) => {
      const { W, H } = S;
      accT += dt * 1000; let k = 0; while (accT >= 1000 / 60 && k++ < 4) { M.Engine.update(eng, 1000 / 60); accT -= 1000 / 60; } if (k >= 4) accT = 0;
      dyn().forEach(b => { if (b.position.y > H + 300 || b.position.y < -300 || b.position.x < -300 || b.position.x > W + 300) M.Composite.remove(W0, b); });
      let sx = 0; if (shake > 0) { shake -= dt; sx = Math.sin(t * 60) * 6 * shake; }
      ctx.save(); ctx.translate(sx, 0);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff3d9'); g.addColorStop(.75, '#ffe1c2'); g.addColorStop(.75, '#e9b07a'); g.addColorStop(1, '#d39456');
      ctx.fillStyle = g; ctx.fillRect(-10, 0, W + 20, H);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 20; x < W; x += 70) for (let y = 20; y < H * .7; y += 70) { ctx.beginPath(); ctx.arc(x + (y / 70 % 2) * 35, y, 4, 0, TAU); ctx.fill(); }
      statics.forEach(b => { if (b.vis) plankDraw(b, b.len, 14, '#c98a4c'); });
      ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.moveTo(W / 2, pivot.py); ctx.lineTo(W / 2 - 30, H); ctx.lineTo(W / 2 + 30, H); ctx.fill();
      plankDraw(plank, Math.min(420, W * .42), 14, '#ff9f43');
      ctx.fillStyle = '#5b3a1a'; ctx.beginPath(); ctx.arc(W / 2, pivot.py, 5, 0, TAU); ctx.fill();
      dyn().forEach(b => drawE(ctx, b.em, b.position.x, b.position.y, b.sz, b.angle));
      if (dragC) { const b = dragC.bodyB, c = Math.cos(b.angle), s = Math.sin(b.angle), px = b.position.x + dragC.pointB.x * c - dragC.pointB.y * s, py = b.position.y + dragC.pointB.x * s + dragC.pointB.y * c; ctx.strokeStyle = 'rgba(91,124,250,.7)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(dragC.pointA.x, dragC.pointA.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#5b7cfa'; ctx.beginPath(); ctx.arc(dragC.pointA.x, dragC.pointA.y, 6, 0, TAU); ctx.fill(); }
      ctx.restore();
    });
    return S.stop;
  }

  /* =================== 5. 魔法水族箱 =================== */
  function aqua(box) {
    const KINDS = { '🐠': { n: '小丑鱼', sp: 70, sz: 46 }, '🐟': { n: '小蓝鱼', sp: 80, sz: 42 }, '🐡': { n: '河豚', sp: 40, sz: 48 }, '🐙': { n: '章鱼', sp: 35, sz: 54, bob: 1 }, '🦑': { n: '鱿鱼', sp: 55, sz: 50, bob: 1 }, '🐢': { n: '海龟', sp: 30, sz: 60 }, '🦀': { n: '螃蟹', sp: 45, sz: 40, floor: 1 }, '🐳': { n: '鲸鱼', sp: 35, sz: 84 }, '🦈': { n: '鲨鱼', sp: 95, sz: 76 } };
    const p = Store.p; p.fun = p.fun || {}; if (!p.fun.aqua || !p.fun.aqua.length) p.fun.aqua = ['🐠', '🐟', '🐡'];
    const S = stage(box, Object.keys(KINDS).map((k, i) => tb('kind', k, KINDS[k].n, i === 0, k)).join('') + sep + tb('mode', '🍞', '喂食', false, 'feed') + tb('mode', '❤️', '摸摸', false, 'pet') + tb('night', '🌙', '夜灯') + tb('free', '🌊', '放回大海') + sep + '<span class="fcount">伙伴 <b>0</b>/24</span>');
    const { ctx } = S; let kind = '🐠', mode = 'add', night = false, fish = [], food = [], fx = [], bubs = [], weeds = [];
    const cnt = S.tools.querySelector('.fcount b');
    const sand = () => S.H - 46;
    const mk = (k, x, y) => { const K = KINDS[k]; return { k, x, y, vx: rnd(-1, 1) * K.sp, vy: 0, tx: x, ty: y, tt: 0, ph: rnd(0, TAU), grow: 1, spin: 0, face: Math.random() < .5 ? -1 : 1 }; };
    const persist = () => { p.fun.aqua = fish.map(f => f.k); Store.save(); cnt.textContent = fish.length; };
    const mkWeeds = () => { weeds = Array.from({ length: Math.max(4, Math.round(S.W / 140)) }, (_, i) => ({ x: (i + .5) / Math.max(4, Math.round(S.W / 140)) * S.W + rnd(-30, 30), h: rnd(.25, .5) * S.H, ph: rnd(0, TAU), c: pick(['#2fbf71', '#3fd38a', '#1e9e60', '#7bd389']) })); };
    S.onResize = mkWeeds;
    fish = p.fun.aqua.slice(0, 24).map(k => mk(k, rnd(60, S.W - 60), KINDS[k].floor ? sand() : rnd(60, sand() - 60))); persist(); mkWeeds();
    const say = (f, e) => fx.push({ x: f.x, y: f.y - KINDS[f.k].sz * .6, vy: -40, t: 0, e, sz: 22 });
    S.on((k, b) => {
      if (k === 'kind') { kind = b.dataset.v; mode = 'add'; S.radio(b, '.ftb[data-k="kind"],.ftb[data-k="mode"]'); S.hint('点水里，放一只' + KINDS[kind].n + '进去'); }
      if (k === 'mode') { mode = b.dataset.v; S.radio(b, '.ftb[data-k="kind"],.ftb[data-k="mode"]'); S.hint(mode === 'feed' ? '点水面撒鱼食，看谁游得最快！' : '点一点海洋伙伴，摸摸它'); }
      if (k === 'night') { night = !night; b.classList.toggle('on', night); S.hint(night ? '夜灯亮起来，伙伴们会发光哦' : '天亮啦'); }
      if (k === 'free') { if (!fish.length) return; fish.forEach(f => { f.leave = 1; f.vx = (f.x < S.W / 2 ? -1 : 1) * 260; }); Audio2.sfx('whoosh', .4); S.hint('伙伴们游回大海啦，再放新的进来吧'); }
    });
    S.cv.onpointerdown = e => {
      const [x, y] = S.pt(e);
      if (mode === 'feed') { for (let i = 0; i < 4; i++) food.push({ x: x + rnd(-16, 16), y: Math.min(y, 40) + rnd(-6, 6), vy: rnd(20, 35), ph: rnd(0, TAU), t: 0 }); blip(900, .08, 'sine', .06, 600); return; }
      const hit = fish.slice().reverse().find(f => !f.leave && Math.hypot(f.x - x, f.y - y) < KINDS[f.k].sz * .55 * f.grow);
      if (mode === 'pet' || hit) {
        if (!hit) return; hit.spin = 1; hit.vx += (hit.x - x || 1) * 6; hit.vy -= 60; say(hit, '❤️'); for (let i = 0; i < 4; i++) bubs.push({ x: hit.x + rnd(-10, 10), y: hit.y, r: rnd(2, 5), s: rnd(40, 70) });
        PENTA.slice(4, 8).forEach((f, i) => setTimeout(() => blip(f, .2, 'triangle', .07), i * 70)); return;
      }
      if (fish.filter(f => !f.leave).length >= 24) { UI.toast('水族箱满啦，先放一些伙伴回大海吧'); return; }
      const f = mk(kind, x, KINDS[kind].floor ? sand() : Math.min(y, sand() - 30)); f.grow = .2; fish.push(f); persist(); say(f, '✨'); blip(520, .25, 'sine', .1, 1040);
    };
    S.hint('选一只海洋伙伴，点水里放进去！');
    S.loop((dt, t) => {
      const { W, H } = S, SY = sand();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      if (night) { g.addColorStop(0, '#0a1a3a'); g.addColorStop(1, '#020611'); } else { g.addColorStop(0, '#5fd3f3'); g.addColorStop(.55, '#1f8fd1'); g.addColorStop(1, '#0d4f8f'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) { const x = (i + .5) / 5 * W + Math.sin(t * .4 + i) * 40; ctx.fillStyle = night ? 'rgba(120,160,255,.03)' : 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 140, H); ctx.lineTo(x + 40, H); ctx.fill(); }
      if (night) for (let i = 0; i < 40; i++) { const x = (i * 97.3 + t * 6) % W, y = (i * 53.7 + Math.sin(t + i) * 20) % SY; ctx.fillStyle = 'hsla(' + (170 + i * 5) + ',100%,70%,' + (.3 + .3 * Math.sin(t * 2 + i)) + ')'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); }
      ctx.restore();
      // 水草
      weeds.forEach(w => { ctx.strokeStyle = w.c; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w.x, SY + 10); const sw = Math.sin(t * 1.2 + w.ph) * 26; ctx.bezierCurveTo(w.x + sw * .3, SY - w.h * .35, w.x - sw * .6, SY - w.h * .7, w.x + sw, SY - w.h); ctx.stroke(); });
      // 沙地
      ctx.fillStyle = night ? '#3a3350' : '#f2d49b'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, SY + Math.sin(x / 60) * 5); ctx.lineTo(W, H); ctx.fill();
      drawE(ctx, '🐚', W * .12, SY + 18, 30, -.3); drawE(ctx, '🐚', W * .74, SY + 22, 24, .4); drawE(ctx, '🌿', W * .4, SY - 4, 40);
      // 气泡石
      [W * .25, W * .9].forEach(x => { if (Math.random() < dt * 5) bubs.push({ x, y: SY, r: rnd(2, 6), s: rnd(40, 80) }); });
      for (let i = bubs.length - 1; i >= 0; i--) { const b = bubs[i]; b.y -= b.s * dt; b.x += Math.sin(b.y / 20) * .4; if (b.y < -10) { bubs.splice(i, 1); continue; } ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); }
      // 鱼食
      for (let i = food.length - 1; i >= 0; i--) { const f = food[i]; f.t += dt; if (f.y < SY - 3) { f.y += f.vy * dt; f.x += Math.sin(t * 3 + f.ph) * .4; } if (f.t > 10) { food.splice(i, 1); continue; } ctx.fillStyle = 'rgba(196,122,52,' + Math.min(1, 10 - f.t) + ')'; ctx.beginPath(); ctx.arc(f.x, f.y, 3.5, 0, TAU); ctx.fill(); }
      // 伙伴
      for (let i = fish.length - 1; i >= 0; i--) {
        const f = fish[i], K = KINDS[f.k], sz = K.sz * f.grow; f.ph += dt * 3; if (f.grow < 1) f.grow = Math.min(1, f.grow + dt * 1.8);
        if (f.leave) { f.x += f.vx * dt; if (f.x < -100 || f.x > W + 100) { fish.splice(i, 1); persist(); } else drawE(ctx, f.k, f.x, f.y, sz, 0, f.vx > 0); continue; }
        let tgt = null; if (food.length) { let bd = 280; food.forEach(fd => { const d = Math.hypot(fd.x - f.x, fd.y - f.y); if (d < bd) { bd = d; tgt = fd; } }); }
        if (tgt) { f.tx = tgt.x; f.ty = tgt.y; if (Math.hypot(tgt.x - f.x, tgt.y - f.y) < sz * .45) { food.splice(food.indexOf(tgt), 1); f.full = Math.min(.35, (f.full || 0) + .05); say(f, pick(['❤️', '✨', '⭐'])); blip(rnd(700, 900), .1, 'sine', .07, 1200); } }
        else if ((f.tt -= dt) < 0) { f.tt = rnd(2, 5); f.tx = rnd(40, W - 40); f.ty = K.floor ? SY : rnd(40, SY - 50); }
        const dx = f.tx - f.x, dy = (K.floor ? SY - sz * .3 : f.ty) - f.y, d = Math.hypot(dx, dy) || 1, spd = K.sp * (tgt ? 1.8 : 1);
        f.vx += (dx / d * spd - f.vx) * dt * 1.5; f.vy += ((K.floor ? dy * 3 : dy / d * spd) - f.vy) * dt * 1.5;
        if (K.bob) f.vy += Math.sin(f.ph * 1.3) * 30 * dt;
        f.x = Math.max(20, Math.min(W - 20, f.x + f.vx * dt)); f.y = Math.max(20, Math.min(SY - (K.floor ? 0 : 10), f.y + f.vy * dt));
        if (Math.abs(f.vx) > 8) f.face = f.vx > 0 ? 1 : -1;
        let rot = K.floor ? Math.sin(f.ph * 2) * .1 : Math.max(-.4, Math.min(.4, f.vy / (spd + 1) * .5)) * (f.face > 0 ? 1 : -1);
        if (f.spin > 0) { f.spin = Math.max(0, f.spin - dt * 1.6); rot += (1 - f.spin) * TAU; }
        const s2 = sz * (1 + (f.full || 0)) * (1 + Math.sin(f.ph) * .03);
        if (night) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, s2); rg.addColorStop(0, 'rgba(120,220,255,.35)'); rg.addColorStop(1, 'rgba(120,220,255,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(f.x, f.y, s2, 0, TAU); ctx.fill(); ctx.restore(); }
        drawE(ctx, f.k, f.x, f.y, s2, rot, !K.floor && f.face > 0);
        if (f.full > 0) f.full = Math.max(0, f.full - dt * .01);
      }
      for (let i = fx.length - 1; i >= 0; i--) { const e = fx[i]; e.t += dt; if (e.t > 1) { fx.splice(i, 1); continue; } e.y += e.vy * dt; drawE(ctx, e.e, e.x, e.y, e.sz, 0, false, 1 - e.t); }
      if (night) { ctx.fillStyle = 'rgba(0,0,20,.25)'; ctx.fillRect(0, SY, W, H - SY); }
    });
    return S.stop;
  }

  const OPEN = { bubble, fire, kaleido, phys, aqua };
  window.Playland = { SPACES, open: (id, box) => OPEN[id](box) };
})();
