/* 魔法咒语学院（原创）：魔法城堡塔顶的夜晚，捣蛋小怪举着题目气泡一只只飞向城堡
   · 语音魔法：说出答案，魔杖放闪电击中小怪；举手指向两侧的魔法水晶停 1 秒也能选（没有语音识别时的兜底）
   · 手势魔法：只用手指水晶
   · 大声公：低龄模式，按指令拍手 / 大喊 / 举手 / 跳一下 / 双手前推就能攻击
   连对 3 题蓄满能量（大喊也能充能），双手向前推放终极魔法清屏；第 10 只是大魔王，要答对 3 题才能打败
   小怪飞到城堡扣一颗心；答错小怪会嘲笑并加速 */
(function () {
  const M = window.Motion, U = M.U;
  const QN = 10, HMAX = 5;
  const CRY = ['#ff5d9e', '#4cc9ff', '#ffd166', '#7bd389'];
  // 水晶位置（画面比例）：排在两侧，手臂伸出去就能指到，垂手时碰不到
  const SLOTS = { 2: [[.12, .46], [.88, .46]], 3: [[.12, .34], [.12, .62], [.88, .46]], 4: [[.12, .36], [.12, .64], [.88, .33], [.88, .555]] };
  const SLIME = ['#5ee36a', '#4cc9ff', '#ff8fd0', '#ffb347', '#b48cff'];
  const RAINBOW = ['#ff5d73', '#ffd166', '#7bd389', '#4cc9ff', '#b48cff', '#ff9fe0'];
  const TAUNT = ['略略略~', '嘿嘿，答错啦', '哈哈，打不着我', '再想想吧~'];
  const CANDY = ['⭐', '🍬', '🍭', '🌟', '🍫', '🍩'];
  const CMDS = [{ k: 'clap', n: 3, txt: '拍手 3 下', ic: '👏' }, { k: 'clap', n: 2, txt: '拍手 2 下', ic: '👏' }, { k: 'shout', txt: '大声喊「哇」', ic: '📣', mic: 1 }, { k: 'up', txt: '举起双手', ic: '🙌' }, { k: 'jump', txt: '跳一下', ic: '🦘' }, { k: 'push', txt: '双手向前推', ic: '✋' }];
  const GEM = [[0, -1.3], [.82, -.42], [.82, .45], [0, 1.25], [-.82, .45], [-.82, -.42]];
  const dark = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.round(v * k); return 'rgb(' + f(n >> 16) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')'; };
  const easeBack = k => k <= 0 ? 0 : 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
  // 发光贴图（按颜色缓存，'lighter' 叠加，比 shadowBlur 省得多）
  const glows = {};
  function glow(col) {
    if (glows[col]) return glows[col];
    const c = document.createElement('canvas'); c.width = c.height = 64; const b = c.getContext('2d'), r = b.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, '#fff'); r.addColorStop(.2, col); r.addColorStop(1, 'rgba(0,0,0,0)'); b.fillStyle = r; b.fillRect(0, 0, 64, 64);
    return (glows[col] = c);
  }
  // 题卡：题干已经写在怪物气泡里，顶部只留题图（没有题图就整个隐藏）
  function css() {
    if (document.getElementById('mg-spell-css')) return;
    const st = U.h('style'); st.id = 'mg-spell-css';
    st.textContent = '.mg-q.sp-q .mg-qt{display:none}.mg-q.sp-q{padding:8px 18px}.mg-q.sp-empty{display:none}';
    document.head.appendChild(st);
  }

  M.game({
    id: 'spell', name: '魔法咒语学院', icon: '🪄', color: '#9b6bff', tag: '原创', demo: 'shout',
    short: '说出答案念咒语，魔杖放闪电打小怪！',
    desc: '捣蛋小怪举着题目飞向魔法城堡！说出答案或举手指向魔法水晶就能放魔法；连对 3 题蓄满能量，双手向前推放终极魔法。第 10 只是大魔王！',
    how: [['shout', '说出答案施魔法'], ['raiseR', '举手指向水晶也能选'], ['push', '双手前推放大招']],
    needs: { voice: true },
    modes: [{ id: 'voice', name: '语音魔法', icon: '🎤', desc: '说出答案，手势兜底' }, { id: 'gesture', name: '手势魔法', icon: '✋', desc: '举手指向水晶' }, { id: 'shout', name: '大声公', icon: '📣', desc: '拍手大喊就能打' }],
    qOpts: { maxLen: 6, maxCh: 4 },
    sayHow: '说出答案，或者举手指向水晶，就能放魔法打败小怪物',
    // 暂停菜单会占用语音识别，回来后重新听
    onPause(G, on) { if (!on && G._spRelisten) G._spRelisten(); },
    start(G) {
      css();
      let bgDirty = true;
      const C = G.canvas({ onResize: () => { bgDirty = true; } }), g = C.ctx;
      const S = () => Math.min(C.W, C.H * 1.6) / 1100, R0 = () => 64 * S(), floorY = () => C.H * .845;
      const mode = G.mode, quiz = mode !== 'shout';
      const hasMic = !!(M.Ears.stream || (M.Input.audioSrc && M.Input.audioSrc.kind === 'phone'));
      const voice = mode === 'voice' && M.Ears.available();
      const cmdPool = CMDS.filter(c => hasMic || !c.mic);
      let mon = null, q = null, cmd = null, lastCmd = null, lastKind = '', crystals = [], lst = null, busy = true, fin = false;
      let n = 0, defeated = 0, hearts = HMAX, energy = 0, combo = 0, ultN = 0, saidFull = false, qT = 0;
      let shake = 0, flash = 0, flashCol = '#fff', heard = '', heardT = -9, heardBad = false;
      let wandAng = -Math.PI / 2, lv = 0, qBottom = 70, qbT = 0, pushHold = 0, lastPush = -9, lastClap = -9, minT = 7, noEnT = -9;
      const tip = { x: C.W * .5, y: C.H * .8 }, punchT = { L: -9, R: -9 }, cur = { L: null, R: null };
      const beams = [], rings = [], parts = [], drops = [], minions = [], motes = [], twinkles = [];
      G.hud.hearts(hearts, HMAX);
      Core.Audio2.playMusic('magic');
      for (let i = 0; i < 26; i++) twinkles.push({ x: Math.random(), y: Math.pow(Math.random(), 1.3) * .6, ph: U.rand(0, 6), sp: U.rand(1.5, 4), r: U.rand(12, 26) });
      for (let i = 0; i < 18; i++) motes.push({ x: Math.random(), y: Math.random(), sp: U.rand(.02, .06), ph: U.rand(0, 6), col: Math.random() < .5 ? '#ffd166' : '#b48cff' });

      /* ---------- 背景（离屏画一次）：夜空 + 月亮；前景：远山、远处城堡、塔顶城垛 ---------- */
      const sky = document.createElement('canvas'), front = document.createElement('canvas');
      function drawBg() {
        bgDirty = false; const W = C.W, H = C.H, s = S();
        [sky, front].forEach(c => { c.width = W; c.height = H; });
        let b = sky.getContext('2d'), gr = b.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, '#05031a'); gr.addColorStop(.45, '#1a0f4a'); gr.addColorStop(.7, '#43206e'); gr.addColorStop(.84, '#8a4a8e'); gr.addColorStop(1, '#2a1240');
        b.fillStyle = gr; b.fillRect(0, 0, W, H); b.fillStyle = '#fff';
        for (let i = 0; i < 240; i++) { b.globalAlpha = U.rand(.25, .9); b.beginPath(); b.arc(U.rand(0, W), Math.pow(Math.random(), 1.4) * H * .7, U.rand(.4, 1.5) * s, 0, 7); b.fill(); }
        b.globalAlpha = 1;
        const mx = W * .84, my = H * .17, mr = 56 * s;
        gr = b.createRadialGradient(mx, my, mr * .8, mx, my, mr * 4); gr.addColorStop(0, 'rgba(255,236,190,.35)'); gr.addColorStop(1, 'rgba(255,236,190,0)'); b.fillStyle = gr; b.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
        gr = b.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr); gr.addColorStop(0, '#fffdf0'); gr.addColorStop(1, '#f2d38f'); b.fillStyle = gr; b.beginPath(); b.arc(mx, my, mr, 0, 7); b.fill();
        b.fillStyle = 'rgba(190,150,90,.28)'; [[-.3, -.2, .22], [.35, .1, .16], [-.05, .45, .12], [.2, -.45, .09]].forEach(([a, c, r]) => { b.beginPath(); b.arc(mx + a * mr, my + c * mr, r * mr, 0, 7); b.fill(); });
        b = front.getContext('2d');
        const ridge = (y0, amp, col, seed) => { b.fillStyle = col; b.beginPath(); b.moveTo(0, H); for (let xx = 0; xx <= W + 20; xx += 20) b.lineTo(xx, y0 - Math.abs(Math.sin(xx / W * 5 + seed)) * amp - Math.sin(xx / W * 13 + seed * 2) * amp * .25); b.lineTo(W, H); b.closePath(); b.fill(); };
        ridge(H * .7, H * .09, '#2c1856', 1.3);
        const tower = (tx, tw, th) => { const ty = H * .68 - th; b.fillStyle = '#24124a'; b.fillRect(tx - tw / 2, ty, tw, th + H * .05); b.beginPath(); b.moveTo(tx - tw * .7, ty); b.lineTo(tx, ty - tw * 1.6); b.lineTo(tx + tw * .7, ty); b.closePath(); b.fill(); b.fillStyle = '#ffd166'; b.fillRect(tx - tw * .12, ty + th * .3, tw * .24, tw * .34); };
        [[.2, 22, 60], [.25, 30, 100], [.3, 20, 50]].forEach(([fx, tw, th]) => tower(W * fx, tw * s, th * s));
        ridge(H * .78, H * .06, '#1a0b38', 4.1);
        const fy = floorY(), mh = 44 * s, mw = 74 * s, gap = 50 * s;
        gr = b.createLinearGradient(0, fy - mh, 0, H); gr.addColorStop(0, '#6d5a9e'); gr.addColorStop(.25, '#4a3a75'); gr.addColorStop(1, '#221838');
        b.fillStyle = gr; b.fillRect(0, fy, W, H - fy);
        for (let xx = -mw / 2; xx < W; xx += mw + gap) { b.beginPath(); b.roundRect(xx, fy - mh, mw, mh + 2, [6 * s, 6 * s, 0, 0]); b.fill(); }
        b.strokeStyle = 'rgba(10,0,30,.35)'; b.lineWidth = 2 * s; const bh = 26 * s;
        for (let r = 0, yy = fy; yy < H; r++, yy += bh) { b.beginPath(); b.moveTo(0, yy); b.lineTo(W, yy); for (let xx = (r % 2) * 40 * s; xx < W; xx += 80 * s) { b.moveTo(xx, yy); b.lineTo(xx, yy + bh); } b.stroke(); }
        b.fillStyle = 'rgba(200,180,255,.35)'; b.fillRect(0, fy, W, 3 * s); for (let xx = -mw / 2; xx < W; xx += mw + gap) b.fillRect(xx, fy - mh, mw, 3 * s);
      }

      /* ---------- 小工具 ---------- */
      function star(x0, y0, r, rot) { g.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .45 : r, a = rot + i * Math.PI / 5 - Math.PI / 2; g.lineTo(x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr); } g.closePath(); g.fill(); }
      function sparks(px, py, k, cols, spd, life) { const s = S(); for (let i = 0; i < k && parts.length < 500; i++) { const a = U.rand(0, 6.283), v = U.rand(.25, 1) * spd * s; parts.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: U.rand(.5, 1) * life, max: life, r: U.rand(8, 20) * s, col: U.pick(cols) }); } }
      function candies(px, py, k) { const s = S(); for (let i = 0; i < k; i++) drops.push({ img: U.emoImg(U.pick(CANDY), '3d'), x: px, y: py, vx: U.rand(-320, 320) * s, vy: U.rand(-650, -250) * s, rot: U.rand(0, 6), vr: U.rand(-6, 6), r: U.rand(20, 32) * s, life: 2.4 }); }
      const ansHtml = qq => { const c = qq.ch[qq.ans]; return c.t ? U.esc(c.t) : U.E(c.e); };
      function wrapT(t, mw) { const toks = t.match(/[\x21-\x7e]+|\s+|./gsu) || [], out = []; let line = ''; toks.forEach(k => { const tr = line + k; if (line.trim() && g.measureText(tr).width > mw) { out.push(line.trim()); line = k.trim(); } else line = tr; }); if (line.trim()) out.push(line.trim()); return out; }
      // 怪物位置：从远处城堡上空飞来，越近越大；左右飘
      function pos(m) {
        const k = m.p * m.p * .4 + m.p * .6, sc = U.lerp(.42, 1.12, k) * (m.boss ? 1.45 : 1);
        const px = C.W * .5 + Math.sin(G.t * .6 + m.wob) * C.W * (m.boss ? .08 : .17) * (1 - k * .55);
        const py = U.lerp(C.H * .42, C.H * .6, k) + Math.sin(G.t * 2.3 + m.wob) * 8 * S();
        return { x: px, y: py, s: sc, R: R0() * sc };
      }
      const bpos = o => o.p != null ? pos(o) : { x: o.x, y: o.cy != null ? o.cy : o.y };

      /* ---------- 怪物（2D 手绘）：史莱姆 / 蝙蝠 / 幽灵 / 大魔王 ---------- */
      function face(R, cy, m, o) {
        o = o || {};
        const laugh = m.mood === 'taunt', hurt = G.t - m.hitT < .35, ex = R * .34, ey = cy - R * .06, er = R * .19;
        g.lineCap = 'round';
        if (laugh || hurt) {
          // 嘲笑 ^ ^，被打 > <
          g.strokeStyle = '#1b1030'; g.lineWidth = R * .08;
          [-1, 1].forEach(s => { g.beginPath();
            if (laugh) { g.moveTo(s * ex - er * .8, ey + er * .25); g.quadraticCurveTo(s * ex, ey - er * 1.1, s * ex + er * .8, ey + er * .25); }
            else { g.moveTo(s * ex + s * er * .7, ey - er * .7); g.lineTo(s * ex - s * er * .5, ey); g.lineTo(s * ex + s * er * .7, ey + er * .7); }
            g.stroke(); });
        } else {
          const lx = Math.sin(G.t * .9 + m.wob) * .35, ly = .35;
          [-1, 1].forEach(s => {
            g.fillStyle = '#fff'; g.beginPath(); g.ellipse(s * ex, ey, er, er * 1.15, 0, 0, 7); g.fill();
            g.fillStyle = o.angry ? '#ff2a4a' : '#1b1030'; g.beginPath(); g.arc(s * ex + lx * er * .35, ey + ly * er * .35, er * .6, 0, 7); g.fill();
            g.fillStyle = '#fff'; g.beginPath(); g.arc(s * ex + lx * er * .35 - er * .22, ey + ly * er * .35 - er * .25, er * .2, 0, 7); g.fill();
          });
          if (o.angry) { g.strokeStyle = '#1b1030'; g.lineWidth = R * .09; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * (ex + er * 1.1), ey - er * 1.6); g.lineTo(s * (ex - er * .8), ey - er * .95); g.stroke(); }); }
        }
        g.fillStyle = 'rgba(255,110,150,.45)'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(s * R * .6, cy + R * .16, R * .13, R * .08, 0, 0, 7); g.fill(); });
        const my = cy + R * .24;
        if (laugh || o.grin) {
          g.fillStyle = '#5a1030'; g.beginPath(); g.moveTo(-R * .22, my); g.quadraticCurveTo(0, my + R * .42, R * .22, my); g.closePath(); g.fill();
          g.fillStyle = '#ff6f91'; g.beginPath(); g.ellipse(0, my + R * .19, R * .1, R * .06, 0, 0, 7); g.fill();
          if (o.fangs) { g.fillStyle = '#fff'; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * R * .17, my); g.lineTo(s * R * .07, my); g.lineTo(s * R * .12, my + R * .11); g.closePath(); g.fill(); }); }
        } else {
          g.strokeStyle = '#1b1030'; g.lineWidth = R * .06; g.beginPath(); g.arc(0, my - R * .06, R * .12, .3, Math.PI - .3); g.stroke();
          if (o.fangs) { g.fillStyle = '#fff'; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * R * .11, my + R * .03); g.lineTo(s * R * .03, my + R * .04); g.lineTo(s * R * .07, my + R * .14); g.closePath(); g.fill(); }); }
        }
      }
      function wing(R, side, col, sc, sp) {
        const a = Math.sin(G.t * (sp || 13)) * .45;
        g.save(); g.scale(side, 1); g.translate(R * .5, -R * .1); g.rotate(-.15 - a); g.scale(sc, sc);
        g.fillStyle = col; g.beginPath(); g.moveTo(0, -R * .15);
        g.quadraticCurveTo(R * .5, -R * .95, R * 1.2, -R * .4); g.quadraticCurveTo(R * .95, -R * .1, R * .8, R * .12);
        g.quadraticCurveTo(R * .6, -R * .05, R * .42, R * .24); g.quadraticCurveTo(R * .25, R * .02, 0, R * .2);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = R * .03; g.beginPath(); g.moveTo(0, 0); g.lineTo(R * 1.15, -R * .38); g.moveTo(R * .1, R * .05); g.lineTo(R * .8, R * .1); g.stroke();
        g.restore();
      }
      function blob(R, m, c0, c1, c2) {
        const sq = Math.sin(G.t * 5 + m.wob) * .07, sx = 1 + sq, sy = 1 - sq;
        const gr = g.createRadialGradient(-R * .35, -R * .5, R * .1, 0, 0, R * 1.2); gr.addColorStop(0, c0); gr.addColorStop(.3, c1); gr.addColorStop(1, c2);
        g.fillStyle = gr; g.beginPath(); g.moveTo(-R * sx, R * .55 * sy);
        g.bezierCurveTo(-R * 1.05 * sx, -R * 1.15 * sy, R * 1.05 * sx, -R * 1.15 * sy, R * sx, R * .55 * sy);
        g.quadraticCurveTo(0, R * .8 * sy, -R * sx, R * .55 * sy); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-R * .45, -R * .45, R * .2, R * .12, -.6, 0, 7); g.fill();
      }
      function slime(R, m) {
        // 史莱姆扇着一对小天使翅膀
        [-1, 1].forEach(s => { g.save(); g.translate(s * R * .85, -R * .25); g.rotate(s * (.5 + Math.sin(G.t * 16 + m.wob) * .4)); g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.ellipse(s * R * .25, -R * .1, R * .34, R * .17, 0, 0, 7); g.fill(); g.restore(); });
        blob(R, m, '#fff', m.col, m.col2);
        face(R, R * .05, m);
      }
      function bat(R, m) {
        [-1, 1].forEach(s => wing(R, s, m.col2, 1));
        g.fillStyle = m.col2; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * R * .2, -R * .5); g.lineTo(s * R * .55, -R * 1.05); g.lineTo(s * R * .62, -R * .35); g.closePath(); g.fill(); });
        const gr = g.createRadialGradient(-R * .25, -R * .3, R * .1, 0, 0, R * .8); gr.addColorStop(0, '#d9c4ff'); gr.addColorStop(.4, m.col); gr.addColorStop(1, m.col2);
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, R * .72, R * .68, 0, 0, 7); g.fill();
        face(R * .9, 0, m, { fangs: true });
      }
      function ghost(R, m) {
        const gr = g.createLinearGradient(0, -R, 0, R * .9); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, m.col);
        g.globalAlpha *= .94; g.fillStyle = gr; g.beginPath(); g.moveTo(-R * .8, -R * .05); g.arc(0, -R * .05, R * .8, Math.PI, 0, false); g.lineTo(R * .8, R * .6);
        for (let i = 0; i < 4; i++) { const x0 = R * .8 - (i + 1) * R * .4, ww = Math.sin(G.t * 6 + i + m.wob) * R * .1; g.quadraticCurveTo(x0 + R * .2, R * .95 + ww, x0, R * .6); }
        g.closePath(); g.fill();
        [-1, 1].forEach(s => { g.beginPath(); g.ellipse(s * R * .86, R * .15 + Math.sin(G.t * 4 + s) * R * .05, R * .14, R * .22, s * .5, 0, 7); g.fill(); });
        face(R * .9, -R * .1, m);
      }
      function boss(R, m) {
        [-1, 1].forEach(s => wing(R * 1.15, s, '#2a0a45', 1.25, 5));
        g.fillStyle = '#ffd166'; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * R * .35, -R * .7); g.quadraticCurveTo(s * R * .95, -R * 1.0, s * R * .85, -R * 1.45); g.quadraticCurveTo(s * R * .62, -R * 1.05, s * R * .1, -R * .82); g.closePath(); g.fill(); });
        blob(R, m, '#d7a8ff', '#8a3dff', '#2a0a45');
        // 王冠 + 红宝石
        const cy = -R * .76; g.fillStyle = '#ffd166'; g.beginPath(); g.moveTo(-R * .3, cy); g.lineTo(-R * .34, cy - R * .32); g.lineTo(-R * .15, cy - R * .14); g.lineTo(0, cy - R * .4); g.lineTo(R * .15, cy - R * .14); g.lineTo(R * .34, cy - R * .32); g.lineTo(R * .3, cy); g.closePath(); g.fill();
        g.fillStyle = '#ff3355'; g.beginPath(); g.arc(0, cy - R * .1, R * .07, 0, 7); g.fill();
        face(R, R * .05, m, { angry: true, grin: true, fangs: true });
      }
      const DRAW = { slime, bat, ghost, boss };
      function drawMonster(m) {
        const P = pos(m); let sc = 1, al = Math.min(1, (G.t - m.born) * 2);
        if (m.dying) { const k = (G.t - m.dying) / .35; if (k >= 1) return; sc = 1 + k * .5; al *= 1 - k; }
        const R = P.R, hit = G.t - m.hitT, s = S();
        g.save(); g.translate(P.x, P.y);
        // 身后光晕（快到城堡时变红）
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = al * .4; const gs = R * 3.4; g.drawImage(glow(m.p > .7 ? '#ff3355' : m.glow), -gs / 2, -gs / 2, gs, gs);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = al;
        g.save(); g.scale(sc, sc);
        if (m.mood === 'taunt') g.rotate(Math.sin(G.t * 18) * .14);
        if (hit < .25) g.scale(1 + (.25 - hit) * 1.2, 1 - (.25 - hit) * .8);
        DRAW[m.kind](R, m);
        if (hit < .15) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (.15 - hit) / .15; g.drawImage(glow('#ffffff'), -R * 1.3, -R * 1.3, R * 2.6, R * 2.6); }
        g.restore();
        // 大魔王血量
        if (m.boss && !m.dying) for (let i = 0; i < m.maxHp; i++) { const hx = (i - (m.maxHp - 1) / 2) * 34 * s, hy = R * .95 + 26 * s; g.fillStyle = i < m.hp ? '#ff3355' : 'rgba(255,255,255,.25)'; g.strokeStyle = '#fff'; g.lineWidth = 2.5 * s; g.beginPath(); g.arc(hx, hy, 11 * s, 0, 7); g.fill(); g.stroke(); }
        g.restore();
        // 嘲笑台词
        if (m.mood === 'taunt' && m.taunt) { g.save(); g.font = '900 ' + 30 * s + 'px ' + U.FONT; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 6 * s; g.strokeStyle = '#2a0a45'; const tx = P.x + R * 1.05, ty = P.y - R * .4 + Math.sin(G.t * 12) * 4 * s; g.strokeText(m.taunt, tx, ty); g.fillStyle = '#ffd166'; g.fillText(m.taunt, tx, ty); g.restore(); }
      }
      // 题目气泡：怪物头顶举着
      function drawBubble(m) {
        if (m.dying) return;
        const text = quiz ? (q ? q.p : '') : (cmd ? cmd.txt : ''); if (!text) return;
        const P = pos(m), s = S();
        if (!m.bub || m.bub.key !== text + '|' + C.W) {
          let fs = 34 * s, lines;
          for (;;) { g.font = '800 ' + fs + 'px ' + U.FONT; lines = wrapT(text, 440 * s); if (lines.length <= 2 || fs < 24 * s) break; fs -= 3 * s; }
          if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = lines[2].slice(0, -1) + '…'; }
          m.bub = { key: text + '|' + C.W, lines, fs, w: Math.max(...lines.map(l => g.measureText(l).width)) + 44 * s, h: lines.length * fs * 1.25 + 24 * s };
        }
        const B = m.bub, ic = !quiz && cmd ? U.emoImg(cmd.ic, '3d') : null, isz = ic ? B.fs * 1.5 : 0;
        const bw = B.w + (ic ? isz + 10 * s : 0), bh = Math.max(B.h, isz + 20 * s) + (!quiz && cmd && cmd.n ? 26 * s : 0);
        const by = Math.max(P.y - P.R * 1.05 - 26 * s - bh - (m.boss ? 30 * s : 0), qBottom + 8), bx = U.clamp(P.x - bw / 2, 12, C.W - bw - 12);
        const k = easeBack(Math.min(1, (G.t - qT) / .35)), danger = m.p > .7;
        g.save(); g.translate(bx + bw / 2, by + bh); g.scale(.5 + .5 * k, .5 + .5 * k); g.translate(-(bx + bw / 2), -(by + bh));
        g.fillStyle = '#fff'; g.strokeStyle = danger && Math.sin(G.t * 10) > 0 ? '#ff3355' : '#9b6bff'; g.lineWidth = 4 * s;
        g.beginPath(); g.roundRect(bx, by, bw, bh, 20 * s); g.fill(); g.stroke();
        const tx = U.clamp(P.x, bx + 30 * s, bx + bw - 30 * s), ty = Math.min(P.y - P.R * .85, by + bh + 26 * s);
        if (ty > by + bh + 6 * s) { g.beginPath(); g.moveTo(tx - 13 * s, by + bh); g.lineTo(tx, ty); g.lineTo(tx + 13 * s, by + bh); g.fill(); g.stroke(); g.fillRect(tx - 11 * s, by + bh - 5 * s, 22 * s, 6 * s); }
        let lx = bx + bw / 2;
        if (ic) { if (ic.complete && ic.naturalWidth) g.drawImage(ic, bx + 18 * s, by + (B.h - isz) / 2 + 2 * s, isz, isz); lx += (isz + 10 * s) / 2; }
        g.font = '800 ' + B.fs + 'px ' + U.FONT; g.fillStyle = '#2a1660'; g.textAlign = 'center'; g.textBaseline = 'middle';
        B.lines.forEach((l, i) => g.fillText(l, lx, by + 12 * s + B.fs * 1.25 * (i + .5)));
        // 拍手计数
        if (!quiz && cmd && cmd.n) for (let i = 0; i < cmd.n; i++) { g.fillStyle = i < cmd.got ? '#ffb020' : '#e2d8ff'; g.beginPath(); g.arc(lx + (i - (cmd.n - 1) / 2) * 30 * s, by + bh - 20 * s, 9 * s, 0, 7); g.fill(); }
        g.restore();
      }
      function drawMinion(mi) {
        const R = R0() * mi.sc; g.save(); g.translate(mi.x, mi.cy);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = .3; g.drawImage(glow('#9b6bff'), -R * 1.5, -R * 1.5, R * 3, R * 3);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, (G.t - mi.born) * 2); bat(R, mi); g.restore();
      }

      /* ---------- 魔法水晶（选项） ---------- */
      function drawCrystal(cr) {
        const s = S(), R = 44 * s; let sc = easeBack(U.clamp((G.t - cr.born) / .45, 0, 1));
        if (cr.out) sc *= 1 - U.clamp((G.t - cr.out - .4) / .3, 0, 1);
        if (sc <= 0) return;
        const cx = cr.x * C.W, cy = cr.y * C.H + Math.sin(G.t * 2 + cr.i * 1.7) * 6 * s; cr.px = cx; cr.py = cy;
        const dead = cr.dead, col = dead ? '#77708a' : cr.col;
        g.save(); g.translate(cx, cy); g.scale(sc, sc);
        if (!dead) { g.globalCompositeOperation = 'lighter'; const gs = R * (3.2 + cr.charge * 2 + cr.flash * 3 + Math.sin(G.t * 3 + cr.i) * .2); g.globalAlpha = .55 + cr.charge * .45; g.drawImage(glow(cr.col), -gs / 2, -gs / 2, gs, gs); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
        else g.globalAlpha = .45;
        g.save(); g.rotate(Math.sin(G.t * 1.3 + cr.i) * .08);
        const gr = g.createLinearGradient(-R, -R, R, R); gr.addColorStop(0, '#fff'); gr.addColorStop(.35, col); gr.addColorStop(1, dark(col, .4));
        g.fillStyle = gr; g.beginPath(); GEM.forEach(([a, b], i) => i ? g.lineTo(a * R, b * R) : g.moveTo(a * R, b * R)); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2 * s; g.beginPath();
        g.moveTo(-.82 * R, -.42 * R); g.lineTo(-.3 * R, -.15 * R); g.lineTo(.3 * R, -.15 * R); g.lineTo(.82 * R, -.42 * R);
        g.moveTo(-.3 * R, -.15 * R); g.lineTo(0, -1.3 * R); g.lineTo(.3 * R, -.15 * R); g.moveTo(-.3 * R, -.15 * R); g.lineTo(0, 1.25 * R); g.lineTo(.3 * R, -.15 * R); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(-.82 * R, -.42 * R); g.lineTo(0, -1.3 * R); g.lineTo(-.3 * R, -.15 * R); g.closePath(); g.fill();
        if (dead) { g.strokeStyle = '#1b1030'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(-.2 * R, -1.1 * R); g.lineTo(.15 * R, -.4 * R); g.lineTo(-.15 * R, .1 * R); g.lineTo(.2 * R, .8 * R); g.moveTo(.15 * R, -.4 * R); g.lineTo(.6 * R, -.2 * R); g.stroke(); }
        g.restore();
        if (cr.c.e) { const im = U.emoImg(cr.c.e, '3d'); if (im.complete && im.naturalWidth) g.drawImage(im, -R * .62, -R * .62, R * 1.24, R * 1.24); }
        if (cr.c.t) {
          g.font = '800 ' + 28 * s + 'px ' + U.FONT; const tw = Math.max(56 * s, g.measureText(cr.c.t).width + 28 * s), th = 42 * s, ty = R * 1.12;
          g.fillStyle = 'rgba(30,14,70,.9)'; g.strokeStyle = col; g.lineWidth = 3 * s; g.beginPath(); g.roundRect(-tw / 2, ty, tw, th, th / 2); g.fill(); g.stroke();
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cr.c.t, 0, ty + th / 2 + s);
        }
        // 蓄力环：手停在水晶上 1 秒
        if (cr.charge > 0 && !dead) { g.strokeStyle = '#fff'; g.lineWidth = 7 * s; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, R * 1.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cr.charge)); g.stroke(); }
        g.restore();
      }

      /* ---------- 魔杖 + 手（屏幕下方，杖尖对准目标） ---------- */
      function drawWand(dt, t) {
        const s = S(), bx = C.W * .66, by = C.H + 30 * s;
        let tg = { x: C.W * .5, y: C.H * .4 };
        const hc = crystals.filter(c => c.charge > 0 && !c.dead && c.px != null).sort((a, b) => b.charge - a.charge)[0];
        if (hc) tg = { x: hc.px, y: hc.py }; else if (mon && !mon.dying) tg = pos(mon);
        const a = U.clamp(Math.atan2(tg.y - by, tg.x - bx), -Math.PI * .9, -Math.PI * .12);
        wandAng += (a - wandAng) * Math.min(1, dt * 7);
        const kick = beams.some(b => !b.small && t - b.t < .15) ? 22 : 0, L = (250 + kick) * s, cs = Math.cos(wandAng), sn = Math.sin(wandAng);
        tip.x = bx + cs * L; tip.y = by + sn * L;
        // 指向水晶时画一条瞄准虚线
        if (hc) { g.save(); g.strokeStyle = hc.col; g.globalAlpha = .3 + hc.charge * .6; g.lineWidth = 4 * s; g.setLineDash([8 * s, 12 * s]); g.lineDashOffset = -t * 60; g.beginPath(); g.moveTo(tip.x, tip.y); g.lineTo(hc.px, hc.py); g.stroke(); g.restore(); }
        g.save(); g.translate(bx, by); g.rotate(wandAng);
        let gr = g.createLinearGradient(0, -50 * s, 0, 50 * s); gr.addColorStop(0, '#8a66f0'); gr.addColorStop(1, '#3a2290');
        g.fillStyle = gr; g.beginPath(); g.roundRect(-140 * s, -48 * s, 210 * s, 96 * s, 30 * s); g.fill();
        g.fillStyle = '#ffd166'; [[-60, -18], [-20, 22], [20, -24], [-100, 20]].forEach(([u, v]) => star(u * s, v * s, 8 * s, 0));
        g.fillStyle = '#fff3d6'; g.beginPath(); g.roundRect(55 * s, -50 * s, 26 * s, 100 * s, 12 * s); g.fill();
        gr = g.createLinearGradient(0, -8 * s, 0, 8 * s); gr.addColorStop(0, '#c08a50'); gr.addColorStop(1, '#4a2a10');
        g.fillStyle = gr; g.beginPath(); g.moveTo(90 * s, -10 * s); g.lineTo(L, -4 * s); g.lineTo(L, 4 * s); g.lineTo(90 * s, 10 * s); g.closePath(); g.fill();
        g.fillStyle = '#ffd166'; [.58, .66].forEach(k => g.fillRect(L * k, -7 * s, 8 * s, 14 * s));
        g.fillStyle = '#ffd2a8'; g.beginPath(); g.ellipse(112 * s, 0, 34 * s, 30 * s, 0, 0, 7); g.fill();
        g.fillStyle = '#f5b98a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse((96 + i * 13) * s, -22 * s, 8 * s, 11 * s, 0, 0, 7); g.fill(); }
        g.restore();
        // 杖尖：能量满了变彩虹；音量光环（说话 / 喊叫时变大）
        const full = energy >= 1, tc = full ? 'hsl(' + (Math.floor(t * 6) % 12) * 30 + ',100%,65%)' : '#b48cff';
        g.save(); g.globalCompositeOperation = 'lighter';
        const z = (100 + lv * 110 + (full ? 40 : 0) + Math.sin(t * 5) * 8) * s; g.drawImage(glow(tc), tip.x - z / 2, tip.y - z / 2, z, z);
        if (hasMic) { const rr = (30 + lv * 55) * s; g.strokeStyle = full ? tc : '#ffd166'; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a0 = t * (2 + i) * (i % 2 ? -1 : 1) + i * 2.1; g.lineWidth = (3 + lv * 5) * s; g.globalAlpha = .35 + lv * .65; g.beginPath(); g.arc(tip.x, tip.y, rr + i * 8 * s, a0, a0 + 1.3 + lv * 2.2); g.stroke(); } }
        g.globalAlpha = 1; const ne = Math.floor(energy * 6 + .001);
        for (let i = 0; i < ne; i++) { const an = t * 3 + i / 6 * 6.283, oz = 26 * s; g.drawImage(glow(RAINBOW[i]), tip.x + Math.cos(an) * 46 * s - oz / 2, tip.y + Math.sin(an) * 46 * s - oz / 2, oz, oz); }
        g.restore();
        g.fillStyle = '#fff7c2'; star(tip.x, tip.y, 20 * s, t * 1.5);
      }
      function torch(tx, t) {
        const s = S(), fy = floorY(), top = fy - 70 * s;
        g.fillStyle = '#3a2a1a'; g.fillRect(tx - 5 * s, top, 10 * s, 70 * s);
        g.fillStyle = '#7b5a30'; g.beginPath(); g.moveTo(tx - 15 * s, top); g.lineTo(tx + 15 * s, top); g.lineTo(tx + 8 * s, top + 12 * s); g.lineTo(tx - 8 * s, top + 12 * s); g.closePath(); g.fill();
        const fl = 1 + Math.sin(t * 17 + tx) * .08 + Math.sin(t * 29) * .05, fy2 = top - 2 * s;
        g.save(); g.globalCompositeOperation = 'lighter'; const z = 160 * s * fl; g.globalAlpha = .5; g.drawImage(glow('#ff8a2a'), tx - z / 2, fy2 - z / 2 - 14 * s, z, z); g.globalAlpha = 1;
        [['#ff6a1a', 1], ['#ffd166', .62], ['#fff6d0', .32]].forEach(([c, k]) => { const hh = 48 * s * k * fl, ww = 18 * s * k; g.fillStyle = c; g.beginPath(); g.moveTo(tx, fy2 - hh); g.quadraticCurveTo(tx + ww * 1.3, fy2 - hh * .3, tx, fy2 + 4 * s); g.quadraticCurveTo(tx - ww * 1.3, fy2 - hh * .3, tx, fy2 - hh); g.fill(); });
        g.restore();
      }
      function drawAmbient(t, dt) {
        const W = C.W, H = C.H, s = S();
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        // 极光
        [['rgba(90,255,200,.07)', .2, 0], ['rgba(190,120,255,.08)', .28, 2]].forEach(([col, y0, ph]) => {
          g.strokeStyle = col;
          [70, 34].forEach(lw => { g.lineWidth = lw * s; g.beginPath(); for (let i = 0; i <= 24; i++) { const xx = i / 24 * W, yy = H * y0 + Math.sin(i / 24 * 6 + t * .4 + ph) * H * .05 + Math.sin(i / 24 * 15 + t * .9) * H * .012; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); });
        });
        twinkles.forEach(w => { const a = .5 + .5 * Math.sin(t * w.sp + w.ph); if (a < .15) return; const z = w.r * s * a; g.globalAlpha = a; g.drawImage(glow('#cfe0ff'), w.x * W - z / 2, w.y * H - z / 2, z, z); });
        motes.forEach(o => { o.y -= o.sp * dt; if (o.y < -.05) { o.y = 1.02; o.x = Math.random(); } const z = 16 * s; g.globalAlpha = .5 + .3 * Math.sin(t * 2 + o.ph); g.drawImage(glow(o.col), (o.x + Math.sin(t + o.ph) * .01) * W - z / 2, o.y * H - z / 2, z, z); });
        g.restore();
      }
      function drawBeam(b) {
        const t = G.t, age = t - b.t, A = b.from || tip, B = bpos(b.to), s = S();
        const grow = Math.min(1, age / .1), al = 1 - Math.max(0, age - .15) / .35; if (al <= 0) return;
        const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, N = b.small ? 6 : 12, amp = (b.small ? 12 : 26) * s;
        const pts = []; for (let i = 0; i <= N; i++) { const k = i / N * grow, j = i && i < N ? U.rand(-1, 1) * amp * Math.sin(i / N * Math.PI) : 0; pts.push([A.x + dx * k + nx * j, A.y + dy * k + ny * j]); }
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
        [[22, .3], [9, .75], [3.5, 1]].forEach(([w, a], pi) => {
          g.lineWidth = w * s * (b.small ? .6 : 1);
          if (b.rainbow && pi < 2) { g.globalAlpha = al; for (let i = 1; i < pts.length; i++) { g.strokeStyle = 'hsla(' + Math.round((i * 30 + t * 600) % 360) + ',100%,62%,' + a + ')'; g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke(); } }
          else { g.strokeStyle = pi === 2 ? '#fff' : b.col; g.globalAlpha = al * a; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
        });
        const E = pts[pts.length - 1], z = (b.small ? 60 : 150) * s; g.globalAlpha = al; g.drawImage(glow(b.col), E[0] - z / 2, E[1] - z / 2, z, z);
        g.restore();
      }
      function drawHud(t) {
        // 底部有触屏按钮条时，能量条挪到左上角暂停键旁边（底部留给按钮和语音字幕，也不压住左边的水晶）
        const lift = G.safeB() > 0, sa = lift ? M.UI.safe() : null;
        const s = S(), bw = 260 * s, bh = 22 * s, bx = lift ? sa.l + 80 : 24 * s, by = lift ? sa.t + 34 : C.H - 40 * s;
        g.save(); g.font = '800 ' + 19 * s + 'px ' + U.FONT; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#e8dcff';
        // 能量满了：标题换成闪烁的「双手前推」提示（不和语音字幕抢位置）
        const full = energy >= 1;
        if (full) { g.font = '900 ' + 23 * s + 'px ' + U.FONT; g.fillStyle = Math.sin(t * 8) > -.3 ? '#ffd166' : '#fff'; }
        g.fillText(full ? '终极魔法满了！双手向前推' : (n >= QN ? '大魔王来袭' : '小怪 ' + Math.max(1, n) + ' / ' + QN) + '  ·  终极魔法', bx, by - 10 * s);
        g.fillStyle = 'rgba(20,10,50,.78)'; g.strokeStyle = 'rgba(200,170,255,.6)'; g.lineWidth = 2 * s; g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.fill(); g.stroke();
        if (energy > 0) {
          const gr = g.createLinearGradient(bx, 0, bx + bw, 0);
          if (energy >= 1) for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, 'hsl(' + Math.round((i * 60 + t * 200) % 360) + ',100%,65%)'); else { gr.addColorStop(0, '#7c5cff'); gr.addColorStop(1, '#ff9fe0'); }
          g.fillStyle = gr; g.beginPath(); g.roundRect(bx + 3 * s, by + 3 * s, Math.max(bh - 6 * s, (bw - 6 * s) * energy), bh - 6 * s, (bh - 6 * s) / 2); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,.5)'; [1 / 3, 2 / 3].forEach(k => g.fillRect(bx + bw * k - s, by + 4 * s, 2 * s, bh - 8 * s));
        // 语音字幕：「我听到：xxx」
        if (voice && quiz) {
          const listening = !!lst && M.Ears.listening === lst && !busy, fresh = heard && t - heardT < 2.5;
          if (listening || fresh) {
            const txt = fresh ? (heard === '没听清' ? '没听清，再说一次~' : '我听到：' + heard + (heardBad ? '  再说一次~' : '')) : '说出答案念咒语…';
            g.font = '800 ' + 24 * s + 'px ' + U.FONT; const isz = 30 * s, tw = g.measureText(txt).width + isz + 44 * s, th = 48 * s, px = C.W * .42 - tw / 2, py = Math.min(C.H * .905, C.H - G.safeB() - th - 6 * s);
            g.fillStyle = 'rgba(25,10,60,.85)'; g.strokeStyle = fresh && heardBad ? '#ff8fa0' : '#ffd166'; g.lineWidth = 3 * s; g.beginPath(); g.roundRect(px, py, tw, th, th / 2); g.fill(); g.stroke();
            const im = U.emoImg('🎤'), ps = isz * (1 + lv * .35); if (im.complete && im.naturalWidth) g.drawImage(im, px + 16 * s + (isz - ps) / 2, py + (th - ps) / 2, ps, ps);
            g.fillStyle = fresh ? '#fff' : 'rgba(255,255,255,.7)'; g.textBaseline = 'middle'; g.fillText(txt, px + isz + 26 * s, py + th / 2 + s);
          }
        }
        g.restore();
      }
      function drawCursors(t) {
        const s = S();
        ['L', 'R'].forEach(sd => {
          const c = cur[sd]; if (!c || c.y > C.H * .9) return;
          g.save(); g.globalCompositeOperation = 'lighter'; const z = 70 * s; g.drawImage(glow(sd === 'L' ? '#ff9fe0' : '#7ef9ff'), c.x - z / 2, c.y - z / 2, z, z); g.restore();
          g.fillStyle = '#fff'; star(c.x, c.y, 11 * s, t * 3 * (sd === 'L' ? -1 : 1));
        });
      }

      /* ---------- 流程 ---------- */
      function spawn() {
        if (fin) return; n++;
        const isBoss = n >= QN, kind = isBoss ? 'boss' : U.pick(['slime', 'bat', 'ghost'].filter(k => k !== lastKind)); lastKind = kind;
        const col = kind === 'slime' ? U.pick(SLIME) : kind === 'bat' ? '#7a4dff' : kind === 'ghost' ? '#cfc6ff' : '#8a3dff';
        mon = { kind, boss: isBoss, col, col2: dark(col, .45), glow: isBoss ? '#ff3355' : col, p: 0, dur: (isBoss ? 48 : Math.max(16, 26 - n)) * (quiz ? 1 : 1.15), spd: 1, hp: isBoss ? 3 : 1, maxHp: isBoss ? 3 : 1, wob: U.rand(0, 6), born: G.t, hitT: -9, mood: '', moodT: 0, dying: 0 };
        q = null; cmd = null; crystals = []; busy = true; G.sfx('whoosh');
        if (isBoss) { shake = .8; G.sfx('boom', .6); G.cue(U.E('😈'), '大魔王来了！答对 3 题打败它', 2600); G.say('大魔王来了，连续答对三题打败它'); G.after(3, newQ); }
        else newQ();
      }
      function newQ() {
        if (fin || !mon) return;
        qT = G.t; heard = ''; busy = false;
        if (!quiz) {
          const c0 = U.pick(cmdPool.filter(c => c !== lastCmd)); lastCmd = c0; cmd = Object.assign({ got: 0, armT: G.t + 3 }, c0);
          // 提示语念完再开始判定（免得喇叭声被当成喊叫）
          const my = cmd; sayCmd(cmd).then(() => { my.armT = Math.min(my.armT, G.t + .2); });
          return;
        }
        q = G.q(voice ? { text: true } : null); G._spq = q;
        G.ask(q, { cls: q.p.length <= 30 ? 'sp-q' + (q.peHtml ? '' : ' sp-empty') : '', say: false });
        const sl = SLOTS[q.ch.length] || SLOTS[4];
        crystals = q.ch.map((c, i) => ({ i, c, col: CRY[i % 4], x: sl[i][0], y: sl[i][1], charge: 0, dead: false, flash: 0, born: G.t + .15 + i * .08, px: null, py: null, out: 0 }));
        // 读完题再开始听，免得把朗读声识别成答案
        const myQ = q; G.say(q.say).then(() => { if (q === myQ) G.after(.15, listen); });
      }
      function sayCmd(c) {
        if (c.k === 'clap') return c.n === 3 ? G.say('拍手三下') : G.say('拍手两下');
        if (c.k === 'shout') return G.say('大声喊哇');
        if (c.k === 'up') return G.say('举起双手');
        if (c.k === 'jump') return G.say('跳一下');
        return G.say('双手向前推');
      }
      function listen() {
        stopListen(); if (!voice || !q || busy || fin) return;
        const myQ = q;
        lst = G.listen({ choices: q.ch, lang: q.lang === 'en' ? 'en' : 'zh',
          onPartial: t => { t = clean(t); if (t && q === myQ && !G.paused) { heard = t; heardT = G.t; heardBad = false; } },
          onResult: r => {
            if (q !== myQ || G.paused || busy) return;
            // 离线识别听不懂时返回 [unk]：显示「没听清」
            heard = clean(r.text) || '没听清'; heardT = G.t; heardBad = r.idx < 0;
            if (r.idx < 0) return;
            // 说了已经碎掉的水晶：提示再说一次，重新听
            if (crystals[r.idx] && crystals[r.idx].dead) { heardBad = true; G.after(.3, listen); return; }
            answer(r.idx);
          } });
      }
      const clean = t => String(t || '').replace(/\[unk\]/gi, '').trim();
      function stopListen() { if (lst) { lst.stop(); lst = null; } }
      G._spRelisten = () => { if (!busy && !fin && q) listen(); };
      function answer(i) {
        if (busy || !q || !mon || fin) return; const cr = crystals[i]; if (!cr || cr.dead) return;
        if (cr.c.ok) { cast(cr); return; }
        // 答错：水晶碎掉，小怪嘲笑并加速
        G.wrong(); cr.dead = true; combo = 0; G.hud.combo(0); energy = Math.max(0, energy - .2);
        if (cr.px != null) sparks(cr.px, cr.py, 16, ['#9990b0', '#d8d0f0', cr.col], 300, .6);
        sparks(tip.x, tip.y, 10, ['#888', '#bbb'], 140, .5);
        mon.mood = 'taunt'; mon.moodT = G.t + 1.6; mon.taunt = U.pick(TAUNT); mon.spd *= 1.35; shake = Math.max(shake, .25);
        if (mon.boss && mon.hp < mon.maxHp) { mon.hp++; G.pop('魔王回血了！', 'bad'); } else G.pop('不对哦，小怪加速了！', 'bad');
        G.after(.6, listen);
      }
      // 放魔法：闪电从杖尖射向小怪
      function cast(cr) {
        if (busy || !mon || fin) return; busy = true; stopListen();
        if (cr) cr.flash = 1;
        beams.push({ to: mon, t: G.t, rainbow: combo >= 2 || mon.boss, col: cr ? cr.col : '#7ef9ff' });
        G.sfx('zap'); G.fileSfx('magic', .5);
        G.after(.22, () => strike('cast'));
      }
      function strike(via) {
        const m = mon; if (!m || m.dying || fin) return;
        const P = pos(m), s = S();
        m.hitT = G.t; shake = Math.max(shake, m.boss ? .9 : .55); flash = Math.max(flash, .25); flashCol = '#b48cff';
        sparks(P.x, P.y, m.boss ? 46 : 30, RAINBOW, 700, .9); rings.push({ x: P.x, y: P.y, t: G.t });
        crystals.forEach(cr => { if (cr.c.ok) cr.flash = 1; cr.out = G.t; });
        if (quiz) { if (via === 'ult' && q) G.pop('答案是 ' + ansHtml(q), 'good', C.W / 2, C.H * .5); G.right(P.x, P.y); }
        else G.fileSfx('star', .6);
        G.sfx('hit'); combo++; G.hud.combo(combo);
        const pts = (m.boss ? 200 : 100) + Math.min(10, combo) * 20 + Math.round((1 - m.p) * 60);
        G.hud.add(pts); G.pop('+' + pts, 'perfect', P.x, P.y - P.R - 20 * s);
        const filled = via !== 'ult' && addEnergy(.34), wait = filled ? 1.8 : 0;
        // 闪电顺带劈中一只小蝙蝠
        const mi = minions.find(z => !z.dead); if (mi) { beams.push({ from: { x: P.x, y: P.y }, to: mi, t: G.t, col: '#7ef9ff', small: true }); G.after(.15, () => killMinion(mi)); }
        q = null; cmd = null; G.ask(null);
        if (m.boss && --m.hp > 0) { m.p = Math.max(0, m.p - .22); m.spd = 1; G.pop('魔王受伤了！还差 ' + m.hp + ' 下', 'combo', P.x, P.y + P.R + 70 * s); G.after(1.4 + wait, newQ); return; }
        m.dying = G.t; defeated++; G.sfx('pop'); candies(P.x, P.y, m.boss ? 26 : 10);
        if (m.boss) { flash = 1; flashCol = '#fff'; shake = 1.5; G.sfx('boom'); rings.push({ x: P.x, y: P.y, t: G.t, big: true }); G.pop('打败大魔王！', 'perfect big'); }
        G.after((m.boss ? 2.2 : 1.5) + wait, () => { mon = null; if (m.boss) finish(true); else spawn(); });
      }
      // 小怪飞到城堡：扣一颗心
      function breach() {
        const m = mon; busy = true; stopListen();
        hearts--; G.hud.hearts(hearts, HMAX); shake = 1.3; flash = .8; flashCol = '#ff3355'; combo = 0; G.hud.combo(0);
        G.fileSfx('hurt'); G.sfx('boom', .7); G.say('小怪物冲进城堡啦');
        const P = pos(m); sparks(P.x, P.y + P.R * .5, 40, ['#ff5d73', '#ffd166', '#fff'], 600, .8);
        G.pop(m.boss ? '大魔王撞到城堡啦！' : '小怪冲进城堡啦！', 'bad');
        if (quiz && q) G.pop('答案是 ' + ansHtml(q), 'good', C.W / 2, C.H * .52);
        q = null; cmd = null; G.ask(null); crystals.forEach(cr => cr.out = G.t);
        if (hearts <= 0) { m.dying = G.t; G.after(1.4, () => finish(false)); return; }
        if (m.boss) { m.p = .15; m.spd = 1; m.mood = 'taunt'; m.moodT = G.t + 1.6; m.taunt = '哈哈哈！'; G.after(1.8, newQ); return; }
        m.dying = G.t; G.after(1.8, () => { mon = null; spawn(); });
      }
      function addEnergy(v) {
        const was = energy; energy = Math.min(1, energy + v);
        if (was >= 1 || energy < 1) return false;
        G.sfx('magic'); sparks(tip.x, tip.y, 30, RAINBOW, 500, .8);
        // 第一次蓄满才弹提示卡 + 语音，之后只靠能量条标题闪烁提醒（不挡题目）
        if (saidFull) return false; saidFull = true; G.cue(U.E('🙌'), '能量满了！双手向前推', 2400);
        if (!(lst && M.Ears.listening === lst)) { G.say('能量满了，双手向前推，释放终极魔法'); return true; }
        return false;
      }
      function push() {
        if (G.t - lastPush < 1.2 || fin) return; lastPush = G.t;
        if (energy >= 1) return ultimate();
        if (cmdHit('push')) return;
        if (G.t - noEnT > 4) { noEnT = G.t; G.pop('能量还没满哦', 'miss', C.W * .5, C.H * .68); }
      }
      // 终极魔法：彩虹冲击波清屏
      function ultimate() {
        energy = 0; ultN++; flash = 1; flashCol = '#ffffff'; shake = 1.3;
        G.sfx('boom'); G.fileSfx('magic'); G.pop('终极魔法！', 'perfect big');
        rings.push({ x: tip.x, y: tip.y, t: G.t, big: true }); sparks(tip.x, tip.y, 70, RAINBOW, 900, 1.1);
        minions.slice().forEach(killMinion);
        if (mon && !busy && !mon.dying) { busy = true; stopListen(); beams.push({ to: mon, t: G.t + .1, rainbow: true, col: '#ffffff' }); G.after(.35, () => strike('ult')); }
      }
      function cmdHit(k) {
        if (quiz || busy || !mon || !cmd || cmd.k !== k || G.t < cmd.armT) return false;
        if (k === 'clap') { cmd.got++; G.sfx('pop'); sparks(tip.x, tip.y, 12, ['#ffd166', '#fff'], 260, .5); if (cmd.got < cmd.n) return true; }
        cast(null); return true;
      }
      function spawnMinion() { const side = Math.random() < .5 ? -1 : 1, s = S(); minions.push({ x: side < 0 ? -80 * s : C.W + 80 * s, y: U.rand(.16, .42) * C.H, cy: 0, vx: -side * U.rand(80, 140) * s, sc: U.rand(.3, .42), col: '#6a3df0', col2: '#2e1470', wob: U.rand(0, 6), born: G.t, hitT: -9, mood: '', dead: false }); }
      function killMinion(mi) { if (mi.dead) return; mi.dead = true; sparks(mi.x, mi.cy, 16, ['#b48cff', '#fff', '#ffd166'], 380, .6); candies(mi.x, mi.cy, 3); G.hud.add(30); G.sfx('pop', .7); G.pop('+30', 'good', mi.x, mi.cy - 30); }
      function finish(win) {
        if (fin) return; fin = true; stopListen();
        const lines = [U.E('👾') + ' 打败小怪 <b>' + defeated + '</b>', U.E('❤️') + ' 剩余生命 <b>' + Math.max(0, hearts) + '</b>'];
        if (ultN) lines.push(U.E('🌈') + ' 终极魔法 <b>' + ultN + '</b> 次');
        const title = win ? '魔法学院毕业啦！' : '小怪物攻进城堡啦';
        if (quiz) G.end({ score: G.hud.scoreV, title, lines });
        else G.end({ score: G.hud.scoreV, title, lines, stars: win ? (hearts >= 4 ? 3 : hearts >= 2 ? 2 : 1) : (defeated >= 5 ? 1 : 0) });
      }

      /* ---------- 手：指向水晶蓄力 + 双手前推 ---------- */
      function handsTick(dt) {
        const p = G.player(0), b = p && p.body, s = S();
        crystals.forEach(cr => cr.hover = false);
        ['L', 'R'].forEach(sd => {
          const h = b && b.hands[sd];
          if (!h || !h.visible) { cur[sd] = null; return; }
          const tx = h.reach.x * C.W, ty = h.reach.y * C.H;
          if (!cur[sd]) cur[sd] = { x: tx, y: ty }; else { const k = Math.min(1, dt * 16); cur[sd].x += (tx - cur[sd].x) * k; cur[sd].y += (ty - cur[sd].y) * k; }
          if (!quiz || busy || !q || G.t - qT < .5) return;
          const hr = Math.max(95 * s, C.W * .075);
          crystals.forEach(cr => { if (!cr.dead && cr.px != null && Math.hypot(cur[sd].x - cr.px, cur[sd].y - cr.py) < hr) cr.hover = true; });
        });
        crystals.forEach(cr => {
          cr.charge = cr.hover ? cr.charge + dt : Math.max(0, cr.charge - dt * 2);
          if (cr.hover && Math.random() < .25) sparks(cr.px, cr.py, 1, [cr.col, '#fff'], 160, .5);
          if (cr.charge >= 1) { cr.charge = 0; answer(cr.i); }
        });
        // 双手同时明显伸向镜头、都在胸前高度 = 前推（出拳事件之外的兜底）
        const L = b && b.hands.L, R = b && b.hands.R;
        const fwd = L && R && L.visible && R.visible && L.zf > .3 && R.zf > .3 && L.reach.y > .2 && R.reach.y > .2 && L.reach.y < .85 && R.reach.y < .85 && Math.abs(L.reach.x - R.reach.x) < .5;
        pushHold = fwd ? pushHold + dt : 0; if (pushHold > .18) { pushHold = 0; push(); }
      }

      /* ---------- 事件 ---------- */
      const onClap = () => { if (G.t - lastClap < .22) return; lastClap = G.t; rings.push({ x: tip.x, y: tip.y, t: G.t, small: true }); cmdHit('clap'); };
      G.on('clap', onClap); G.on('mic:clap', onClap);
      G.on('mic:shout', e => { addEnergy(.06 + (e.level || .6) * .08); cmdHit('shout'); });
      G.on('handsUp', () => cmdHit('up'));
      G.on('jump', () => cmdHit('jump'));
      G.on('punch', e => { punchT[e.hand] = G.t; if (Math.abs(punchT.L - punchT.R) < .45) { punchT.L = punchT.R = -9; push(); } });
      // 键盘：1-4 选答案，P 前推（def.ownKeys 告诉虚拟小人别再处理）
      G.def.ownKeys = '1234p';
      const onKey = e => { if (!G.started || G.paused || G.over) return; const k = +e.key; if (k >= 1 && k <= 4) answer(k - 1); else if (e.key === 'p') push(); };
      addEventListener('keydown', onKey); G.onDispose(() => removeEventListener('keydown', onKey));

      let delay = 1.6;
      if (mode === 'voice' && !voice) { G.cue(U.E('🙋'), '没有语音识别，用手势选择也可以哦', 3200); G.say('没有语音识别，用手势选择也可以哦'); delay = 3.4; }
      else if (mode === 'voice') G.cue(U.E('🎤'), '说出答案施魔法', 1800);
      else if (mode === 'gesture') G.cue(U.E('☝️'), '举手指向答案水晶', 1800);
      else G.cue(U.E('📣'), '听指令拍手、大喊', 1800);
      G.after(delay, spawn);

      G.loop(dt => {
        const t = G.t, s = S();
        if (bgDirty) drawBg();
        lv += (M.Ears.level - lv) * Math.min(1, dt * 12);
        // 大喊充能：越大声越快
        if (hasMic && M.Ears.level > .62) addEnergy(dt * (M.Ears.level - .5) * .45);
        if (mon && !mon.dying && !busy) {
          mon.p += dt / mon.dur * mon.spd;
          if (mon.p >= 1) { mon.p = 1; breach(); }
        }
        if (mon && mon.mood && t > mon.moodT) mon.mood = '';
        if (t > minT) { minT = t + U.rand(5, 9); if (minions.length < 2) spawnMinion(); }
        minions.forEach(mi => { mi.x += mi.vx * dt; mi.cy = mi.y + Math.sin(t * 3 + mi.wob) * 22 * s; });
        for (let i = minions.length - 1; i >= 0; i--) { const mi = minions[i]; if (mi.dead || mi.x < -120 * s || mi.x > C.W + 120 * s) minions.splice(i, 1); }
        handsTick(dt);
        crystals.forEach(cr => cr.flash = Math.max(0, cr.flash - dt * 2));
        parts.forEach(p => { p.vx *= .96; p.vy = p.vy * .96 + 300 * s * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
        for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
        const fy = floorY();
        drops.forEach(d => { d.vy += 1400 * s * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; d.life -= dt; if (d.y > fy - d.r * .5 && d.vy > 0) { d.y = fy - d.r * .5; d.vy *= -.45; d.vx *= .7; d.vr *= .6; } });
        for (let i = drops.length - 1; i >= 0; i--) if (drops[i].life <= 0) drops.splice(i, 1);
        for (let i = beams.length - 1; i >= 0; i--) if (t - beams[i].t > .5) beams.splice(i, 1);
        for (let i = rings.length - 1; i >= 0; i--) if (t - rings[i].t > 1) rings.splice(i, 1);
        shake = Math.max(0, shake - dt * 2.2); flash = Math.max(0, flash - dt * 2);
        // 顶部题卡（题图）的下沿，气泡不要挡住它
        if (t > qbT) { qbT = t + .5; const w = G.el.querySelector('.mg-qwrap'), r = w && w.classList.contains('in') ? w.getBoundingClientRect() : null; qBottom = Math.max(70, r && r.height ? r.bottom - C.cv.getBoundingClientRect().top : 0); }

        // ---- 画 ----
        g.save(); if (shake > 0) g.translate(U.rand(-1, 1) * shake * 14 * s, U.rand(-1, 1) * shake * 14 * s);
        g.drawImage(sky, 0, 0, C.W, C.H);
        drawAmbient(t, dt);
        g.drawImage(front, 0, 0, C.W, C.H);
        torch(C.W * .2, t); torch(C.W * .8, t);
        minions.forEach(drawMinion);
        if (mon) drawMonster(mon);
        if (mon && !mon.dying && mon.p > .7) { const k = (mon.p - .7) / .3 * (.6 + .4 * Math.sin(t * 9)), vg = g.createRadialGradient(C.W / 2, C.H / 2, C.H * .35, C.W / 2, C.H / 2, C.W * .7); vg.addColorStop(0, 'rgba(255,0,60,0)'); vg.addColorStop(1, 'rgba(255,0,60,' + (.45 * k).toFixed(3) + ')'); g.fillStyle = vg; g.fillRect(0, 0, C.W, C.H); }
        beams.forEach(b => t >= b.t && drawBeam(b));
        if (mon) drawBubble(mon);
        crystals.forEach(drawCrystal);
        g.save(); g.globalCompositeOperation = 'lighter';
        rings.forEach(r => { const age = t - r.t, life = r.big ? 1 : r.small ? .35 : .55, k = age / life; if (k >= 1) return; const rad = (r.big ? 1500 : r.small ? 90 : 260) * s * (1 - Math.pow(1 - k, 3)); g.globalAlpha = 1 - k; g.lineWidth = (r.big ? 34 : r.small ? 5 : 12) * s * (1 - k * .6); g.strokeStyle = r.big ? 'hsl(' + Math.round(age * 500 % 360) + ',100%,65%)' : r.small ? '#ffd166' : '#d6b8ff'; g.beginPath(); g.arc(r.x, r.y, rad, 0, 7); g.stroke(); if (r.big) { g.strokeStyle = 'hsl(' + Math.round((age * 500 + 180) % 360) + ',100%,65%)'; g.beginPath(); g.arc(r.x, r.y, rad * .7, 0, 7); g.stroke(); } });
        parts.forEach(p => { const k = p.life / p.max, z = p.r * 2 * k; g.globalAlpha = Math.min(1, k * 1.5); g.drawImage(glow(p.col), p.x - z / 2, p.y - z / 2, z, z); });
        g.restore();
        drops.forEach(d => { if (!d.img.complete || !d.img.naturalWidth) return; g.save(); g.globalAlpha = Math.min(1, d.life * 1.5); g.translate(d.x, d.y); g.rotate(d.rot); g.drawImage(d.img, -d.r, -d.r, d.r * 2, d.r * 2); g.restore(); });
        drawWand(dt, t);
        drawCursors(t);
        drawHud(t);
        if (flash > 0) { g.globalAlpha = flash * .55; g.fillStyle = flashCol; g.fillRect(-50, -50, C.W + 100, C.H + 100); g.globalAlpha = 1; }
        g.restore();
      });
    },
  });
})();
