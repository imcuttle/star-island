/* 疯狂兔子斗舞派对（复刻《疯狂兔子：奇遇派对》斗舞）：夜晚派对舞台、红色聚光灯、迪斯科球、火盆、4 条透视箭头轨道
   · 箭头滑到判定圈的拍点，朝箭头方向挥手：完美 / 不错 / 错过，每条轨道上的兔子有自己的连击
   · 左 2 条红队、右 2 条蓝队；双人一左一右各管一队（左轨道左手、右轨道右手），单人时蓝队由电脑兔子跳
   · 答题舞步：每隔几个小节出一道题，4 个选项对应 ↑→↓← 四张大箭头卡，朝正确答案的方向挥手全队大加分
   · 模式：派对（4 方向、中速）、高手（8 方向、更快）、答题斗舞（题目更多） */
(function () {
  const M = window.Motion, U = M.U;
  const KEYS = ['↑', '→', '↓', '←'], KEYC = ['#ff5d73', '#ffb020', '#3fbf6a', '#2fa8ff'], QDIR = [6, 0, 2, 4];
  const TEAM = [{ name: '红队', c: '#ff3d5e', c2: '#ffb3c0', d: '#b8002a', hex: 0xff3d5e }, { name: '蓝队', c: '#2fa8ff', c2: '#b8ecff', d: '#0050c8', hex: 0x2fa8ff }];
  const MODES = {
    party: { bpm: 112, lead: 4, dirs: 4, secs: [6, 'q', 6, 'q', 5] },
    pro: { bpm: 124, lead: 3.2, dirs: 8, secs: [8, 'q', 8, 'q', 6] },
    quiz: { bpm: 110, lead: 4, dirs: 4, secs: [2, 'q', 2, 'q', 2, 'q', 2, 'q', 2, 'q', 2] },
  };
  // 每小节的节奏型：[拍偏移, 0 左手轨道 / 1 右手轨道]
  const POOL_EASY = [[[0, 0], [2, 1]], [[0, 1], [2, 0]], [[0, 0], [2, 0]], [[0, 1], [2, 1]]];
  const POOL_MID = [[[0, 0], [1, 1], [2, 0]], [[0, 1], [1, 0], [2, 1], [3, 0]], [[0, 0], [0, 1], [2, 0]]];
  const POOL_PRO = [[[0, 0], [1, 1], [2, 0], [3, 1]], [[0, 0], [1.5, 1], [2, 0], [3, 1]], [[0, 0], [0, 1], [2, 0], [2, 1]], [[0, 0], [1, 0], [2, 1], [3, 1]], [[0, 1], [.5, 0], [2, 1], [2.5, 0]]];
  // 方向池（左手轨道偏左、右手轨道偏右）：0 右 2 下 4 左 6 上，奇数是斜向
  const DIRP = { 4: [[6, 6, 2, 4, 4, 0], [6, 6, 2, 0, 0, 4]], 8: [[6, 2, 4, 5, 3, 7, 1, 4, 5], [6, 2, 0, 7, 1, 5, 3, 0, 7]] };
  // 轨道几何：判定圈 z、远端 z、5 条分隔线的近端 / 远端 x
  const RZ = 2.6, FZ = -16, BN = [-4.4, -2.2, 0, 2.2, 4.4], BF = [-1.25, -.62, 0, .62, 1.25];
  const lx = (b, z) => BN[b] + (BF[b] - BN[b]) * (RZ - z) / (RZ - FZ);
  const laneX = (l, z) => (lx(l, z) + lx(l + 1, z)) / 2;
  const teamX = (t, z) => (lx(t * 2, z) + lx(t * 2 + 2, z)) / 2;
  const PERFECT = .14, GOOD = .3, LAT = .08, QBARS = 5; // 判定窗口（秒），LAT 识别延迟补偿

  function css() {
    if (document.getElementById('mg-dance-css')) return;
    const s = document.createElement('style'); s.id = 'mg-dance-css';
    s.textContent = `
.mg-dance .mg-pipw { bottom: auto; top: calc(84px + env(safe-area-inset-top)); }
.mg-dance .mg-pop.pp-at { font-size: 40px; }
.mg-dance .mg-pop.pp-qok { top: 44%; font-size: 72px; color: #ffd166; text-shadow: 0 0 26px #ffb020, 0 5px 0 #8a4b00; }
.dn-team { position: absolute; bottom: calc(16px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 10px; height: 58px; min-width: 230px; padding: 0 22px; border-radius: 14px; color: #fff; font-family: 'Fredoka', var(--font); text-shadow: 0 2px 0 rgba(0,0,0,.35); box-shadow: 0 6px 20px rgba(0,0,0,.4), inset 0 0 0 3px rgba(255,255,255,.35); transition: transform .2s; }
.dn-team.red { left: calc(16px + env(safe-area-inset-left)); background: linear-gradient(100deg, #8a001e, #ff3d5e); transform: skewX(-10deg); }
.dn-team.blue { right: calc(16px + env(safe-area-inset-right)); background: linear-gradient(260deg, #003a9c, #2fa8ff); transform: skewX(10deg); flex-direction: row-reverse; }
.dn-team .emo { width: 34px; height: 34px; }
.dn-team div { display: flex; flex-direction: column; line-height: 1; }
.dn-team.blue div { align-items: flex-end; }
.dn-team small { font-size: 13px; opacity: .9; font-weight: 700; }
.dn-team b { font-size: 34px; font-weight: 900; }
.dn-team.lead { box-shadow: 0 0 26px rgba(255,209,102,.8), inset 0 0 0 3px #ffd166; }
.dn-team.lead::after { content: '👑'; position: absolute; top: -22px; font-size: 26px; }
.dn-team.red.lead::after { left: 12px; } .dn-team.blue.lead::after { right: 12px; }
.dn-tug { position: absolute; left: 50%; bottom: calc(30px + env(safe-area-inset-bottom)); width: min(30vw, 360px); height: 14px; transform: translateX(-50%); border-radius: 999px; overflow: hidden; background: #2fa8ff; box-shadow: 0 0 0 3px rgba(255,255,255,.5), 0 0 18px rgba(0,0,0,.5); }
.dn-tug i { position: absolute; left: 0; top: 0; bottom: 0; width: 50%; background: linear-gradient(90deg, #ff3d5e, #ff7a8e); transition: width .3s; }
.dn-tug i::after { content: ''; position: absolute; right: -3px; top: -4px; bottom: -4px; width: 6px; background: #fff; border-radius: 3px; box-shadow: 0 0 10px #fff; }
.dn-banner { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%) scale(.3); opacity: 0; font: 900 92px 'Fredoka', var(--font); white-space: nowrap; transition: transform .5s cubic-bezier(.2, 1.6, .4, 1), opacity .3s; text-shadow: 0 0 30px currentColor, 0 6px 0 rgba(0,0,0,.4); -webkit-text-stroke: 3px #fff; }
.dn-banner.in { transform: translate(-50%, -50%) scale(1); opacity: 1; }
.dn-banner small { display: block; text-align: center; font-size: 30px; -webkit-text-stroke: 0; color: #fff; }
`;
    document.head.appendChild(s);
  }

  M.game({
    id: 'dance', name: '疯狂兔子斗舞', icon: '🐰', color: '#ff3d8b', tag: '复刻', demo: 'dance', duo: true,
    short: '朝箭头方向挥手，和兔子们斗舞！', desc: '箭头滑到兔子脚下的圆圈时，朝箭头方向挥手！左手管左边轨道、右手管右边轨道。答题时朝正确答案的方向挥手，全队大加分！',
    origin: '致敬《疯狂兔子：奇遇派对》斗舞模式：夜晚派对舞台、红色聚光灯、迪斯科球、红蓝两队 4 条箭头轨道、完美连击、队伍比分。',
    how: [['swipeU', '朝箭头方向挥手'], ['swipeR', '左右手分管两条轨道'], ['dance', '跟着音乐摇摆']],
    modes: [{ id: 'party', name: '派对', icon: '🎉', desc: '4 方向 · 中速' }, { id: 'pro', name: '高手', icon: '🔥', desc: '8 方向 · 更快' }, { id: 'quiz', name: '答题斗舞', icon: '🧠', desc: '题目更多' }],
    qOpts: { maxLen: 5, maxCh: 4 },
    sayHow: '箭头滑到圆圈的时候，朝箭头方向挥手',
    preload() { if (window.Avatar3D && Avatar3D.supported()) return Avatar3D.load('bunny').catch(() => {}); },
    start(G) {
      css();
      const md = MODES[G.mode] || MODES.party, grade = G.grade || 1, duo = G.players > 1;
      let camBase = null;
      const T3 = G.three({ fov: 52, exposure: 1.05, onResize: (w, h) => fitCam(w / h) });
      const { THREE: T, scene, camera } = T3;
      const V = (x, y, z) => new T.Vector3(x, y, z);
      function fitCam(a) { if (!camBase) return; camBase.pos.set(0, 4.2, 9.6 + Math.max(0, 1.78 - a) * 4.5); }
      camBase = { pos: V(0, 4.2, 9.6), look: V(0, 1.5, -4) }; T3.fit();
      scene.fog = new T.Fog(0x1a2a7a, 22, 60);

      /* ---------- 贴图工具 ---------- */
      const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.userData.cv = c; return t; };
      const radial = (stops) => mk(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(s => g.addColorStop(s[0], s[1])); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
      const glowTex = radial([[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']]);
      const haloTex = mk(256, 256, x => { x.translate(128, 128); const g = x.createRadialGradient(0, 0, 70, 0, 0, 126); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.55, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 126, 0, 7); x.fill(); });
      const sparkTex = mk(128, 128, x => { x.translate(64, 64); const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill(); x.fillStyle = '#fff'; [0, 1].forEach(k => { x.save(); x.rotate(k * Math.PI / 2); x.beginPath(); x.moveTo(-62, 0); x.quadraticCurveTo(0, -6, 62, 0); x.quadraticCurveTo(0, 6, -62, 0); x.fill(); x.restore(); }); });
      const ringTex = mk(256, 256, x => { x.translate(128, 128); x.shadowColor = '#fff'; x.shadowBlur = 22; x.strokeStyle = '#fff'; x.lineWidth = 20; x.beginPath(); x.arc(0, 0, 96, 0, 7); x.stroke(); x.shadowBlur = 0; x.lineWidth = 5; x.globalAlpha = .7; x.beginPath(); x.arc(0, 0, 70, 0, 7); x.stroke(); const g = x.createRadialGradient(0, 0, 0, 0, 0, 96); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.globalAlpha = 1; x.fillStyle = g; x.beginPath(); x.arc(0, 0, 96, 0, 7); x.fill(); });
      const addM = (o) => Object.assign({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false }, o);
      // 箭头（指向右，按方向旋转）：队伍色渐变 + 白描边 + 外发光
      const arrowTex = TEAM.map(tm => mk(256, 256, x => {
        x.translate(128, 128); const path = () => { x.beginPath(); x.moveTo(-78, -28); x.lineTo(8, -28); x.lineTo(8, -70); x.lineTo(92, 0); x.lineTo(8, 70); x.lineTo(8, 28); x.lineTo(-78, 28); x.closePath(); };
        x.lineJoin = 'round'; path(); x.shadowColor = tm.c; x.shadowBlur = 28; x.strokeStyle = tm.c; x.lineWidth = 26; x.stroke(); x.shadowBlur = 0;
        const g = x.createLinearGradient(0, -70, 0, 70); g.addColorStop(0, tm.c2); g.addColorStop(.5, tm.c); g.addColorStop(1, tm.d); path(); x.fillStyle = g; x.fill();
        x.strokeStyle = '#fff'; x.lineWidth = 9; path(); x.stroke();
        x.globalAlpha = .55; x.fillStyle = '#fff'; x.beginPath(); x.moveTo(-66, -18); x.lineTo(16, -18); x.lineTo(16, -48); x.lineTo(50, -18); x.closePath(); x.fill();
      }));

      /* ---------- 背景：夜空、城市剪影、两侧彩色树林（画一次） ---------- */
      const bgTex = mk(2048, 1024, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#060c38'); g.addColorStop(.4, '#13308f'); g.addColorStop(.72, '#2a5ad0'); g.addColorStop(1, '#4f86ff'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 260; i++) { x.globalAlpha = U.rand(.3, 1); x.fillStyle = '#fff'; const r = U.rand(.6, 2.2); x.beginPath(); x.arc(U.rand(0, w), U.rand(0, h * .55), r, 0, 7); x.fill(); } x.globalAlpha = 1;
        const gl = x.createRadialGradient(w / 2, h * .5, 0, w / 2, h * .5, 700); gl.addColorStop(0, 'rgba(255,90,200,.35)'); gl.addColorStop(1, 'rgba(255,90,200,0)'); x.fillStyle = gl; x.fillRect(0, 0, w, h);
        // 城市剪影
        for (let i = 0; i < 26; i++) { const bw = U.rand(40, 110), bh = U.rand(90, 330), bx = 520 + i * 40 + U.rand(-20, 20), by = h * .8 - bh; x.fillStyle = i % 2 ? '#162a7a' : '#1c3490'; x.fillRect(bx, by, bw, bh + 200); x.fillStyle = 'rgba(140,220,255,.55)'; for (let yy = by + 12; yy < h * .8; yy += 18) for (let xx = bx + 8; xx < bx + bw - 8; xx += 14) if (Math.random() < .35) x.fillRect(xx, yy, 5, 7); }
        // 远处山丘
        x.fillStyle = '#122a74'; x.beginPath(); x.moveTo(0, h); for (let xx = 0; xx <= w; xx += 40) x.lineTo(xx, h * .8 + Math.sin(xx / 160) * 30 + Math.sin(xx / 47) * 10); x.lineTo(w, h); x.fill();
        // 两侧树林：一团团发光的彩色树冠
        const COL = ['#1fc8b8', '#7a3cff', '#ff4fa3', '#2f6bff', '#24a87a', '#b44cff'];
        [[0, 560], [w - 560, w]].forEach(([a, b]) => { for (let i = 0; i < 46; i++) { const cx = U.rand(a, b), cy = U.rand(h * .15, h * .95), r = U.rand(50, 130), c = U.pick(COL); const rg = x.createRadialGradient(cx - r * .3, cy - r * .3, r * .1, cx, cy, r); rg.addColorStop(0, '#ffffff'); rg.addColorStop(.12, c); rg.addColorStop(1, 'rgba(10,20,80,.9)'); x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); } });
        for (let i = 0; i < 60; i++) { x.fillStyle = U.pick(['#ffe066', '#ff9fe0', '#9ff']); x.globalAlpha = U.rand(.5, 1); x.beginPath(); x.arc(U.rand(0, w), U.rand(h * .2, h), U.rand(2, 4), 0, 7); x.fill(); } x.globalAlpha = 1;
      });
      const bg = new T.Mesh(new T.PlaneGeometry(96, 48), new T.MeshBasicMaterial({ map: bgTex, fog: false, toneMapped: false }));
      bg.position.set(0, 12, -36); scene.add(bg);

      /* ---------- 灯光 ---------- */
      scene.add(new T.HemisphereLight(0x9ab4ff, 0x3a2060, 1.4));
      const sun = new T.DirectionalLight(0xffffff, 1.7); sun.position.set(2, 7, 9); scene.add(sun);
      [-1, 1].forEach(s => { const p = new T.PointLight(0xff2a5a, 9, 14, 1.4); p.position.set(s * 3.5, 4.5, 1); scene.add(p); });

      /* ---------- 舞台地面 ---------- */
      const ground = new T.Mesh(new T.PlaneGeometry(120, 80), new T.MeshLambertMaterial({ color: 0x232070 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.02, -20); scene.add(ground);
      const stageTex = mk(1024, 1024, (x, w) => {
        x.translate(512, 512); const g = x.createRadialGradient(0, 0, 0, 0, 0, 512); g.addColorStop(0, '#6a4fd8'); g.addColorStop(.6, '#4a36b0'); g.addColorStop(1, '#2a1f78'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 510, 0, 7); x.fill();
        x.strokeStyle = 'rgba(190,170,255,.55)'; [500, 420, 300, 180, 90].forEach((r, i) => { x.lineWidth = i ? 5 : 14; x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); });
        x.lineWidth = 3; for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; x.beginPath(); x.moveTo(Math.cos(a) * 300, Math.sin(a) * 300); x.lineTo(Math.cos(a) * 420, Math.sin(a) * 420); x.stroke(); }
        x.fillStyle = 'rgba(255,220,255,.18)'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.beginPath(); x.arc(Math.cos(a) * 460, Math.sin(a) * 460, 18, 0, 7); x.fill(); }
      });
      const stage = new T.Mesh(new T.CircleGeometry(11, 72), new T.MeshLambertMaterial({ map: stageTex })); stage.rotation.x = -Math.PI / 2; stage.position.set(0, 0, -2); scene.add(stage);
      // 四边形（地面上，任意 4 点）：近左、近右、远右、远左
      function quad(p, y, mat) {
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([p[0][0], y, p[0][1], p[1][0], y, p[1][1], p[2][0], y, p[2][1], p[3][0], y, p[3][1]], 3));
        g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]); const m = new T.Mesh(g, mat); scene.add(m); return m;
      }
      const vGrad = mk(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
      const hGrad = mk(64, 4, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
      const ZN = RZ + 1.2;
      // 轨道底色：红队 / 蓝队
      const laneMats = [];
      for (let l = 0; l < 4; l++) { const m = new T.MeshBasicMaterial(addM({ map: vGrad, color: TEAM[l >> 1].hex, opacity: .28 })); laneMats.push(m); quad([[lx(l, ZN) + .05, ZN], [lx(l + 1, ZN) - .05, ZN], [lx(l + 1, FZ) - .02, FZ], [lx(l, FZ) + .02, FZ]], .01, m); }
      // 黄色发光分隔线
      const lineMats = [];
      for (let b = 0; b < 5; b++) {
        [[.09, .03, 1], [.5, .16, .35]].forEach(([wn, wf, op]) => { const m = new T.MeshBasicMaterial(addM({ map: hGrad, color: 0xffd84a, opacity: op })); lineMats.push([m, op]); quad([[lx(b, ZN) - wn, ZN], [lx(b, ZN) + wn, ZN], [lx(b, FZ) + wf, FZ], [lx(b, FZ) - wf, FZ]], .02, m); });
      }
      // 判定横线
      [[.05, 1], [.3, .35]].forEach(([wd, op]) => { const m = new T.MeshBasicMaterial(addM({ map: vGrad, color: 0xffd84a, opacity: op })); lineMats.push([m, op]); quad([[lx(0, RZ) - .3, RZ + wd], [lx(4, RZ) + .3, RZ + wd], [lx(4, RZ) + .3, RZ - wd], [lx(0, RZ) - .3, RZ - wd]], .015, m); });

      /* ---------- 判定圈 + 手提示 ---------- */
      const rings = [];
      for (let l = 0; l < 4; l++) {
        const m = new T.MeshBasicMaterial(addM({ map: ringTex, color: TEAM[l >> 1].hex })); const r = new T.Mesh(new T.PlaneGeometry(1.9, 1.9), m); r.rotation.x = -Math.PI / 2; r.position.set(laneX(l, RZ), .04, RZ); scene.add(r);
        const fm = new T.MeshBasicMaterial(addM({ map: haloTex, color: 0xffd166, opacity: 0 })); const f = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), fm); f.rotation.x = -Math.PI / 2; f.position.copy(r.position); f.position.y = .05; scene.add(f);
        const lab = mk(256, 96, x => { x.font = '900 54px ' + U.FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = TEAM[l >> 1].d; const s = l % 2 ? '右手 ✋' : '✋ 左手'; x.strokeText(s, 128, 50); x.fillStyle = '#fff'; x.fillText(s, 128, 50); });
        const lb = new T.Mesh(new T.PlaneGeometry(1.3, .49), new T.MeshBasicMaterial({ map: lab, transparent: true, depthWrite: false, toneMapped: false, opacity: .9 })); lb.rotation.x = -Math.PI / 2.6; lb.position.set(laneX(l, RZ + 1.25), .2, RZ + 1.25); scene.add(lb);
        rings.push({ mesh: r, flash: f, fl: 0, hit: 0 });
      }

      /* ---------- 迪斯科球：小方块拼成，随拍闪烁 ---------- */
      const DISCO = { pos: V(0, 5.3, -9), R: 1.7 };
      const ball = new T.Group(); ball.position.copy(DISCO.pos); ball.scale.set(1, 1.22, 1); scene.add(ball);
      ball.add(new T.Mesh(new T.SphereGeometry(DISCO.R * .97, 32, 24), new T.MeshStandardMaterial({ color: 0x0c1440, metalness: .7, roughness: .35 })));
      const NT = 620, tiles = new T.InstancedMesh(new T.BoxGeometry(.2, .2, .05), new T.MeshBasicMaterial({ toneMapped: false }), NT); ball.add(tiles);
      const dmy = new T.Object3D(), PAL = [0x18225a, 0x18225a, 0x1e2c70, 0x2a3c9a, 0xff3d8b, 0x3df0ff, 0x5a6cff, 0xffffff], col = new T.Color();
      for (let i = 0; i < NT; i++) { const y = 1 - 2 * (i + .5) / NT, r = Math.sqrt(1 - y * y), a = i * 2.39996; const p = V(Math.cos(a) * r, y, Math.sin(a) * r); dmy.position.copy(p).multiplyScalar(DISCO.R); dmy.lookAt(p.multiplyScalar(DISCO.R * 2)); dmy.updateMatrix(); tiles.setMatrixAt(i, dmy.matrix); tiles.setColorAt(i, col.setHex(U.pick(PAL))); }
      const flickerDisco = (n) => { for (let i = 0; i < n; i++) tiles.setColorAt(Math.floor(Math.random() * NT), col.setHex(U.pick(PAL))); tiles.instanceColor.needsUpdate = true; };
      const ballGlow = new T.Sprite(new T.SpriteMaterial(addM({ map: glowTex, color: 0x8a6cff, opacity: .55 }))); ballGlow.scale.set(9, 9, 1); ballGlow.position.copy(DISCO.pos).add(V(0, 0, -1)); scene.add(ballGlow);
      const wire = new T.Mesh(new T.CylinderGeometry(.03, .03, 6), new T.MeshBasicMaterial({ color: 0x0a0f30 })); wire.position.set(0, DISCO.pos.y + 4.8, DISCO.pos.z); scene.add(wire);

      /* ---------- 红色聚光灯：灯罩 + 加法混合光锥，随拍晃动 ---------- */
      const beamMat = () => new T.ShaderMaterial({
        uniforms: { uC: { value: new T.Color(0xff2a4a) }, uI: { value: .7 }, uH: { value: 10 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
        vertexShader: 'uniform float uH; varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = -position.y / uH; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uI; varying float vH; varying vec3 vN; varying vec3 vV; void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(1.0 - vH, 1.4) * pow(f, 2.2) * uI * smoothstep(0.0, 0.06, vH); gl_FragColor = vec4(uC, a); }',
      });
      const truss = new T.Mesh(new T.BoxGeometry(18, .25, .25), new T.MeshStandardMaterial({ color: 0x1a1a2a, metalness: .8, roughness: .4 })); truss.position.set(0, 7.9, -4.5); scene.add(truss);
      const lamps = [[-6.2, 7.4, -4.5, -2.6, 0, 1.2], [-2.6, 7.4, -4.5, -1, 0, 2.6], [2.6, 7.4, -4.5, 1, 0, 2.6], [6.2, 7.4, -4.5, 2.6, 0, 1.2]].map((a, i) => {
        const sway = new T.Group(); sway.position.set(a[0], a[1], a[2]); scene.add(sway);
        const aim = new T.Group(); sway.add(aim); const dir = V(a[3] - a[0], a[4] - a[1], a[5] - a[2]).normalize(); aim.quaternion.setFromUnitVectors(V(0, -1, 0), dir);
        const house = new T.Mesh(new T.CylinderGeometry(.42, .5, 1.1, 20), new T.MeshStandardMaterial({ color: 0x15151f, metalness: .6, roughness: .45 })); house.position.y = .5; aim.add(house);
        const lens = new T.Mesh(new T.CircleGeometry(.4, 24), new T.MeshBasicMaterial({ color: 0xffd6e0, toneMapped: false })); lens.rotation.x = Math.PI / 2; lens.position.y = -.06; aim.add(lens);
        const lg = new T.Sprite(new T.SpriteMaterial(addM({ map: glowTex, color: 0xff4a6a, opacity: .9 }))); lg.scale.set(2.2, 2.2, 1); lg.position.y = -.2; aim.add(lg);
        const H = 10, cg = new T.ConeGeometry(2.4, H, 28, 1, true); cg.translate(0, -H / 2, 0); const bm = beamMat(); bm.uniforms.uH.value = H; const beam = new T.Mesh(cg, bm); beam.position.y = -.05; aim.add(beam);
        const pool = new T.Mesh(new T.CircleGeometry(1.6, 24), new T.MeshBasicMaterial(addM({ map: glowTex, color: 0xff2a5a, opacity: .5 }))); pool.rotation.x = -Math.PI / 2; pool.position.set(a[3], .03, a[5]); scene.add(pool);
        return { sway, bm, lens, lg, ph: i * 1.3, pool, base: V(a[3], .03, a[5]), src: V(a[0], a[1], a[2]) };
      });

      /* ---------- 两侧 3D 树丛 + 火盆 ---------- */
      const TREEC = [0x1fc8b8, 0x7a3cff, 0xff4fa3, 0x2f6bff, 0x24a87a, 0xb44cff];
      const leafG = new T.IcosahedronGeometry(1, 1);
      [-1, 1].forEach(s => { for (let i = 0; i < 7; i++) {
        const tx = s * U.rand(8, 14), tz = U.rand(-16, -2), hgt = U.rand(1.5, 3.2), c = U.pick(TREEC);
        const tr = new T.Mesh(new T.CylinderGeometry(.18, .26, hgt, 8), new T.MeshLambertMaterial({ color: 0x2a1a40 })); tr.position.set(tx, hgt / 2, tz); scene.add(tr);
        for (let k = 0; k < 3; k++) { const lf = new T.Mesh(leafG, new T.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: .35, flatShading: true })); const r = U.rand(1, 1.8); lf.scale.setScalar(r); lf.position.set(tx + U.rand(-.8, .8), hgt + U.rand(-.2, 1.2), tz + U.rand(-.6, .6)); scene.add(lf); }
      } });
      const fires = [-1, 1].map(s => {
        const x0 = s * 5.9, z0 = -.6;
        const stand = new T.Mesh(new T.CylinderGeometry(.1, .25, 1.1, 10), new T.MeshStandardMaterial({ color: 0x2a2030, metalness: .6, roughness: .5 })); stand.position.set(x0, .55, z0); scene.add(stand);
        const bowl = new T.Mesh(new T.CylinderGeometry(.6, .32, .45, 16), new T.MeshStandardMaterial({ color: 0x3a2a30, metalness: .7, roughness: .4, emissive: 0x401000 })); bowl.position.set(x0, 1.3, z0); scene.add(bowl);
        const N = 46, pos = new Float32Array(N * 3), cl = new Float32Array(N * 3), ps = [];
        for (let i = 0; i < N; i++) ps.push({ life: Math.random() * .8, max: .8, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(cl, 3));
        const pts = new T.Points(g, new T.PointsMaterial(addM({ size: .7, map: glowTex, vertexColors: true }))); pts.frustumCulled = false; scene.add(pts);
        const light = new T.PointLight(0xff8a2a, 6, 7, 1.5); light.position.set(x0, 2.2, z0); scene.add(light);
        return { x0, y0: 1.5, z0, ps, pos, cl, g, light };
      });
      function fireTick(dt) {
        fires.forEach(f => {
          f.ps.forEach((p, i) => {
            p.life -= dt; if (p.life <= 0) { p.max = p.life = U.rand(.45, .9); const a = U.rand(0, 6.28), r = U.rand(0, .35); p.x = f.x0 + Math.cos(a) * r; p.z = f.z0 + Math.sin(a) * r; p.y = f.y0; p.vx = -Math.cos(a) * r * .6; p.vz = -Math.sin(a) * r * .6; p.vy = U.rand(1.4, 2.6); }
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const k = p.life / p.max;
            f.pos[i * 3] = p.x; f.pos[i * 3 + 1] = p.y; f.pos[i * 3 + 2] = p.z;
            f.cl[i * 3] = k; f.cl[i * 3 + 1] = k * k * .75; f.cl[i * 3 + 2] = k * k * k * .3;
          });
          f.g.attributes.position.needsUpdate = true; f.g.attributes.color.needsUpdate = true; f.light.intensity = 5 + Math.random() * 2.5;
        });
      }
      // 空中漂浮的小光点
      const NS = 140, spos = new Float32Array(NS * 3); for (let i = 0; i < NS; i++) { spos[i * 3] = U.rand(-12, 12); spos[i * 3 + 1] = U.rand(0, 9); spos[i * 3 + 2] = U.rand(-16, 3); }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(spos, 3));
      const sparkles = new T.Points(sg, new T.PointsMaterial(addM({ size: .14, map: glowTex, color: 0xffd6ff, opacity: .8 }))); sparkles.frustumCulled = false; scene.add(sparkles);

      /* ---------- 特效池：光环 / 星星 / 彩带 ---------- */
      const fx = [];
      for (let i = 0; i < 110; i++) { const s = new T.Sprite(new T.SpriteMaterial(addM({ map: sparkTex, depthTest: false }))); s.visible = false; s.renderOrder = 20; scene.add(s); fx.push({ s, life: 0 }); }
      function spawn(o) {
        const f = fx.find(f => f.life <= 0); if (!f) return; const s = f.s;
        s.material.map = o.tex || sparkTex; s.material.color.set(o.color || 0xffffff); s.material.blending = o.normal ? T.NormalBlending : T.AdditiveBlending; s.material.rotation = o.rot || 0; s.material.needsUpdate = true;
        s.position.copy(o.pos); s.visible = true; Object.assign(f, { life: o.life || .6, max: o.life || .6, v: o.v || V(0, 0, 0), g: o.g || 0, s0: o.s0 || .3, s1: o.s1 == null ? (o.s0 || .3) : o.s1, vr: o.vr || 0 });
      }
      function fxTick(dt) {
        fx.forEach(f => { if (f.life <= 0) return; f.life -= dt; const s = f.s; if (f.life <= 0) { s.visible = false; return; } const k = 1 - f.life / f.max;
          f.v.y -= f.g * dt; s.position.addScaledVector(f.v, dt); const sc = f.s0 + (f.s1 - f.s0) * (1 - Math.pow(1 - k, 2)); s.scale.set(sc, sc, 1); s.material.opacity = Math.min(1, (1 - k) * 1.6); s.material.rotation += f.vr * dt; });
      }
      function burst(p, kind, color) {
        const gold = kind === 'perfect', c = color || (gold ? 0xffd166 : kind === 'good' ? 0x7ef9ff : 0x8890b0);
        spawn({ tex: haloTex, pos: p, color: c, life: gold ? .55 : .4, s0: .6, s1: gold ? 3.4 : 2.2 });
        if (gold) spawn({ tex: haloTex, pos: p, color: 0xffffff, life: .35, s0: .4, s1: 2.2 });
        const n = gold ? 12 : kind === 'good' ? 6 : 0;
        for (let i = 0; i < n; i++) { const a = U.rand(0, 6.28); spawn({ pos: p.clone(), color: gold ? U.pick([0xffd166, 0xffffff, 0xffb020]) : c, life: U.rand(.4, .7), v: V(Math.cos(a) * U.rand(1.5, 3.5), U.rand(2, 5), Math.sin(a) * 1.2), g: 9, s0: U.rand(.3, .5), s1: .1, vr: U.rand(-4, 4) }); }
      }
      function confetti(team, n) {
        for (let i = 0; i < n; i++) { const t = team == null ? i % 2 : team; spawn({ pos: V(teamX(t, 0) + U.rand(-3, 3), U.rand(5, 8), U.rand(-3, 2)), color: U.pick([TEAM[t].hex, 0xffd166, 0xffffff, 0xff9fe0, 0x7ef9ff]), life: U.rand(1.6, 2.6), v: V(U.rand(-1, 1), U.rand(-1, 1), 0), g: 1.6, s0: U.rand(.25, .4), vr: U.rand(-6, 6) }); }
      }

      /* ---------- 兔子：每条轨道一只，站在判定圈上 ---------- */
      const HATS = ['🎀', '👑', '🧢', '🎩'], bunnies = [null, null, null, null], badges = [];
      for (let l = 0; l < 4; l++) {
        const bx = laneX(l, RZ), base = V(bx, .04, RZ - .1);
        if (window.Avatar3D && Avatar3D.supported()) Avatar3D.make('bunny', { height: 1.3, hat: HATS[l], style: Avatar3D.styleOf(Core.theme()) }).then(av => {
          if (G.over && !G.started) return;
          const tc = new T.Color(TEAM[l >> 1].hex);
          av.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.side !== T.BackSide && o.material.color) { o.material = o.material.clone(); o.material.color.lerp(tc, .22); } });
          av.position.copy(base); av.rotation.y = l < 2 ? .18 : -.18; av.userData.base = base; scene.add(av); bunnies[l] = av;
        }).catch(e => console.warn('[dance] bunny', e));
        else { const s = new T.Sprite(new T.SpriteMaterial({ map: window.Avatar3D && Avatar3D.emojiTex ? Avatar3D.emojiTex('🐰') : glowTex })); s.scale.set(1.1, 1.1, 1); s.position.copy(base).add(V(0, .6, 0)); scene.add(s); }
        // 连击徽章：盾牌 + 数字（数字变了才重画）
        const bt = mk(128, 150, () => {}), bs = new T.Sprite(new T.SpriteMaterial({ map: bt, transparent: true, depthWrite: false, toneMapped: false })); bs.scale.set(.62, .73, 1); bs.position.set(bx, 2.12, RZ - .1); bs.visible = false; bs.renderOrder = 15; scene.add(bs);
        badges.push({ s: bs, t: bt, n: -1 });
      }
      function badge(l, n) {
        const b = badges[l]; if (b.n === n) return; b.n = n; b.s.visible = n > 0; if (!n) return;
        const x = b.t.userData.cv.getContext('2d'), tm = TEAM[l >> 1]; x.clearRect(0, 0, 128, 150);
        x.beginPath(); x.moveTo(14, 18); x.lineTo(114, 18); x.lineTo(114, 86); x.quadraticCurveTo(114, 124, 64, 144); x.quadraticCurveTo(14, 124, 14, 86); x.closePath();
        const g = x.createLinearGradient(0, 18, 0, 144); g.addColorStop(0, tm.c2); g.addColorStop(.4, tm.c); g.addColorStop(1, tm.d); x.fillStyle = g; x.fill(); x.lineWidth = 8; x.strokeStyle = '#ffd166'; x.stroke();
        x.font = '900 ' + (n > 99 ? 46 : 62) + 'px ' + U.FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.45)'; x.strokeText(n, 64, 80); x.fillStyle = '#fff'; x.fillText(n, 64, 80);
        b.t.needsUpdate = true; b.pop = 1;
      }
      const act = (l, name) => { const b = bunnies[l]; if (b && !fin) b.once(name, 'idle'); };

      /* ---------- 谱面：按小节生成，红蓝两队同一套舞步 ---------- */
      const spb = 60 / md.bpm, notes = [], quizzes = [];
      const pool = G.mode === 'pro' ? POOL_PRO.concat(POOL_MID) : grade >= 3 && G.mode === 'party' ? POOL_EASY.concat(POOL_MID) : POOL_EASY;
      const missRate = U.clamp(.3 - grade * .025, .1, .3) + (G.mode === 'pro' ? .05 : 0);
      let bar = 2;
      md.secs.forEach((sec, si) => {
        if (sec === 'q') { quizzes.push({ b0: bar * 4, state: 0 }); bar += QBARS; return; }
        for (let k = 0; k < sec; k++) {
          const last = k === sec - 1 && md.secs[si + 1] === 'q', pat = last ? [[0, 0], [2, 1]] : U.pick(pool);
          pat.forEach(([off, li]) => { const dir = U.pick(DIRP[md.dirs][li]); [0, 1].forEach(t => notes.push({ lane: t * 2 + li, team: t, beat: (bar + k) * 4 + off, dir, st: 0, spr: null, ai: { hit: Math.random() > missRate, perf: Math.random() < .55, off: U.rand(-.1, .12) } })); });
        }
        bar += sec;
      });
      notes.sort((a, b) => a.beat - b.beat);
      let endBeat = bar * 4 + 1;

      /* ---------- 状态 ---------- */
      const score = [0, 0], shown = [0, 0], combo = [0, 0, 0, 0], st = { perfect: 0, good: 0, miss: 0, maxCombo: 0, human: 0 };
      let fin = false, pulse = 0, lastBi = -99, shake = 0, qNow = null;
      const aiBlue = !duo; // 单人：蓝队由电脑兔子跳
      const hud = U.h('div', 'dn-hud'); G.hudEl.appendChild(hud);
      hud.innerHTML = '<div class="dn-team red">' + U.E('🐰') + '<div><small></small><b>0</b></div></div><div class="dn-tug"><i></i></div><div class="dn-team blue">' + U.E('🐰') + '<div><small></small><b>0</b></div></div><div class="dn-banner"></div>';
      Core.hydrate(hud);
      const $t = [hud.querySelector('.dn-team.red'), hud.querySelector('.dn-team.blue')], $tug = hud.querySelector('.dn-tug i');
      G.hud.hide('score'); G.hud.hide('combo');
      const song = G.song({ bpm: md.bpm, style: 'party', intro: 2 }).start(.25);
      G._dn = { notes, quizzes, song, spb, LAT, mode: G.mode }; // 自测用

      // 世界坐标 → 屏幕像素（飘字位置）
      const scr = (p) => { const v = p.clone().project(camera); return [(v.x + 1) / 2 * G.W(), (1 - v.y) / 2 * G.H()]; };
      const headPos = l => V(laneX(l, RZ), 2.8, RZ); // 飘字在连击徽章上方

      function judge(n, q) {
        n.st = q === 'miss' ? 2 : 1; const l = n.lane, t = n.team, human = t === 0 || !aiBlue;
        if (human) { st.human++; st[q]++; }
        if (q === 'miss') {
          combo[l] = 0; badge(l, 0); act(l, 'no');
          const [sx, sy] = scr(headPos(l)); G.pop('错过', 'miss', sx, sy); if (human) G.sfx('miss', .5);
          return;
        }
        combo[l]++; if (human) st.maxCombo = Math.max(st.maxCombo, combo[l]);
        const add = q === 'perfect' ? 100 + Math.min(combo[l], 30) * 4 : 50; score[t] += add;
        badge(l, combo[l]); rings[l].fl = 1;
        burst(V(laneX(l, RZ), .5, RZ), q); if (n.spr) { freeArrow(n.spr); n.spr = null; }
        const [sx, sy] = scr(headPos(l));
        G.pop(q === 'perfect' ? '完美！' + (combo[l] > 1 ? '×' + combo[l] : '') : '不错', q === 'perfect' ? 'perfect' : 'good', sx, sy);
        if (human) G.sfx(q === 'perfect' ? 'perfect' : 'good', t === 0 ? .7 : .5);
        act(l, q === 'perfect' ? U.pick(['jump', 'attack', 'wave']) : 'yes');
        if (combo[l] && combo[l] % 10 === 0) { shake = .5; G.sfx('combo'); confetti(t, 14); }
      }

      /* ---------- 箭头精灵池 ---------- */
      const arrows = [];
      function getArrow(n) {
        let a = arrows.find(a => !a.used); if (!a) { const s = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, toneMapped: false })); s.renderOrder = 10; scene.add(s); a = { s, used: false }; arrows.push(a); }
        a.used = true; a.s.visible = true; a.s.material.map = arrowTex[n.team]; a.s.material.rotation = -n.dir * Math.PI / 4; a.s.material.opacity = 0; a.s.material.needsUpdate = true; return a;
      }
      function freeArrow(a) { a.used = false; a.s.visible = false; }

      /* ---------- 挥手判定 ---------- */
      const cardinal = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 4) : (dy > 0 ? 2 : 6);
      G.on('swipe', e => {
        if (fin) return;
        const team = duo && e.slot === 1 ? 1 : 0; if (team === 1 && aiBlue) return;
        const bNow = song.beat() - LAT / spb;
        if (qNow && quizSwipe(qNow, team, e, bNow)) return;
        const prefer = team * 2 + (e.hand === 'R' ? 1 : 0), cd = cardinal(e.dx || 0, e.dy || 0);
        let best = null, bq = null;
        for (const n of notes) {
          if (n.beat - bNow > GOOD / spb + .1) break;
          if (n.st || n.team !== team) continue;
          const dt = Math.abs(bNow - n.beat) * spb; if (dt > GOOD) continue;
          let ok, q;
          if (md.dirs === 4) { ok = cd === n.dir; q = dt < PERFECT ? 'perfect' : 'good'; }
          else { let df = Math.abs(e.dir - n.dir) % 8; if (df > 4) df = 8 - df; ok = df <= 1; q = df === 0 && dt < PERFECT ? 'perfect' : 'good'; }
          if (!ok) continue;
          // 同一只手的轨道优先，其次时间最近
          const sc = (n.lane === prefer ? 0 : 1) + dt;
          if (!best || sc < best.sc) { best = { n, sc }; bq = q; }
        }
        if (best) judge(best.n, bq);
      });

      /* ---------- 答题舞步：4 张大箭头卡（十字排开）沿队伍中线滑过来 ---------- */
      const ZH = -1.4, YH = 2.5, DQ = 1.02, CS = 1.32, OFF = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      function cardTex(c, i) {
        const t = mk(256, 256, () => {}); const cv = t.userData.cv, x = cv.getContext('2d');
        const paint = () => {
          x.clearRect(0, 0, 256, 256); x.save(); x.translate(128, 128);
          // 箭头尖：朝选项方向伸出
          const a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][i]; x.save(); x.rotate(a); x.fillStyle = KEYC[i]; x.shadowColor = KEYC[i]; x.shadowBlur = 18; x.beginPath(); x.moveTo(96, -46); x.lineTo(126, 0); x.lineTo(96, 46); x.closePath(); x.fill(); x.restore();
          x.shadowColor = KEYC[i]; x.shadowBlur = 24; x.fillStyle = KEYC[i]; x.beginPath(); x.roundRect(-100, -100, 200, 200, 34); x.fill(); x.shadowBlur = 0;
          x.fillStyle = '#fff'; x.beginPath(); x.roundRect(-84, -84, 168, 168, 24); x.fill();
          x.fillStyle = KEYC[i]; x.font = '900 34px ' + U.FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
          const kp = [[0, -66], [66, 0], [0, 66], [-66, 0]][i]; x.fillText(KEYS[i], kp[0], kp[1]);
          if (c.t) { let fs = 78; x.font = '900 ' + fs + 'px ' + U.FONT; while (x.measureText(c.t).width > 130 && fs > 26) { fs -= 4; x.font = '900 ' + fs + 'px ' + U.FONT; } x.fillStyle = '#22305e'; x.fillText(c.t, 0, 4); }
          else if (c.e) { const im = U.emoImg(c.e); if (im.complete && im.naturalWidth) x.drawImage(im, -52, -52, 104, 104); else im.addEventListener('load', () => { paint(); t.needsUpdate = true; }, { once: true }); }
          x.restore(); t.needsUpdate = true;
        };
        paint(); return t;
      }
      function quizStart(Q) {
        const q = Q.q = G.q(), n = q.ch.length;
        G.ask(q, { options: true, keys: KEYS.slice(0, n), colors: KEYC.slice(0, n) });
        const texs = q.ch.map((c, i) => cardTex(c, i));
        Q.groups = [0, 1].map(t => { const g = new T.Group(); scene.add(g); g.userData.cards = q.ch.map((c, i) => { const s = new T.Sprite(new T.SpriteMaterial({ map: texs[i], transparent: true, depthWrite: false, depthTest: false, toneMapped: false })); s.position.set(OFF[i][0] * DQ, OFF[i][1] * DQ, 0); s.renderOrder = 12; g.add(s); return s; }); return g; });
        // 两队各答各的：res 0 未答 / 1 答对 / -1 答错；先答对的一队有抢答加分
        Q.res = [0, 0]; Q.at = [0, 0]; Q.tries = [0, 0]; Q.cool = [0, 0]; Q.first = -1; Q.state = 1; Q.aiT = Q.b0 + U.rand(6, 13); Q.aiOk = Math.random() < U.clamp(.45 + grade * .05, .45, .8);
        qNow = Q; G.sfx('whoosh');
      }
      function quizSwipe(Q, team, e, bNow) {
        if (Q.state !== 1 || bNow < Q.b0 + 2 || Q.res[team] || bNow < Q.cool[team]) return Q.state === 1;
        const idx = QDIR.indexOf(cardinal(e.dx || 0, e.dy || 0)); if (idx < 0 || idx >= Q.q.ch.length) return true;
        if (Q.groups[team].userData.cards[idx].userData.out) return true; // 已经排除的卡片不算
        quizAnswer(Q, team, idx, bNow, true); return true;
      }
      function quizAnswer(Q, team, idx, bNow, human) {
        if (Q.res[team]) return;
        const card = Q.groups[team].userData.cards[idx], wp = card.getWorldPosition(V(0, 0, 0)), [sx, sy] = scr(wp);
        Q.at[team] = bNow;
        if (idx === Q.q.ans) {
          Q.res[team] = 1; const first = Q.first < 0; if (first) Q.first = team;
          const onBeat = Math.abs(bNow - Math.round(bNow)) < .22, add = (Q.tries[team] ? 250 : 400) + (first ? 200 : 0) + (onBeat ? 100 : 0); score[team] += add;
          if (human) { G.right(sx, sy); G.say('答对啦'); } else G.sfx('good');
          G.pop((human ? '答对！' : TEAM[team].name + '答对！') + ' +' + add, 'qok');
          if (first && duo) G.pop(TEAM[team].name + '抢答成功！', 'combo'); else if (onBeat) G.pop('踩点加分！', 'combo');
          burst(wp, 'perfect'); confetti(team, 26); shake = .6; G.sfx('cheer');
          for (let l = team * 2; l < team * 2 + 2; l++) { rings[l].fl = 1.4; setTimeout(() => act(l, 'jump'), (l % 2) * 120); }
          bunnies.forEach((bn, l) => { if ((l >> 1) !== team) setTimeout(() => act(l, 'wave'), 200); });
        } else if (human && !Q.tries[team]++) {
          // 第一次答错：这张卡变灰，再给一次机会
          card.material.color.set(0x666677); card.userData.out = true; Q.cool[team] = bNow + 1; Q.at[team] = 0;
          G.wrong(); G.pop('再想想！', 'bad', sx, sy); G.say('再想想');
          for (let l = team * 2; l < team * 2 + 2; l++) act(l, 'no');
          return;
        } else {
          Q.res[team] = -1; card.material.color.set(0x666677);
          if (human) { G.wrong(); G.pop('正确答案是 ' + KEYS[Q.q.ans] + ' ' + M.Q.label(Q.q.ch[Q.q.ans]), 'good'); }
          else G.pop(TEAM[team].name + '答错了', 'bad', sx, sy);
          for (let l = team * 2; l < team * 2 + 2; l++) act(l, 'no');
        }
        // 单人：小朋友答完后电脑兔子也很快作答，不让人干等
        if (human && aiBlue && Q.res[1] === 0) Q.aiT = Math.min(Q.aiT, bNow + 1.5);
        if (Q.res[0] && Q.res[1]) { Q.state = 2; Q.doneB = bNow; skipAhead(Q); }
      }
      // 题目提前答完：后面的谱面整体提前若干小节，免得空等（按整小节挪，仍然踩在音乐拍子上）
      function skipAhead(Q) {
        const next = Q.b0 + QBARS * 4, shift = next - Math.ceil((Q.doneB + 3) / 4) * 4;
        if (shift < 4) return;
        notes.forEach(n => { if (n.beat >= next) n.beat -= shift; });
        quizzes.forEach(o => { if (o.b0 >= next) o.b0 -= shift; });
        endBeat -= shift;
      }
      function quizTick(Q, b, dt) {
        if (Q.state === 0) { if (b >= Q.b0 - .5) quizStart(Q); return; }
        if (Q.state === 3) return;
        const u = U.clamp((b - Q.b0) / 4, 0, 1), e = 1 - Math.pow(1 - u, 3), open = Q.state === 1 && b >= Q.b0 + 2;
        if (open && !Q.opened) { Q.opened = true; G.pop('朝正确答案的方向挥手！', 'combo', G.W() / 2, G.H() * .72); G.sfx('pop'); }
        // 电脑蓝队答题
        if (Q.state === 1 && aiBlue && !Q.res[1] && b >= Q.aiT) { let idx = Q.q.ans; if (!Q.aiOk) { const n = Q.q.ch.length; idx = (Q.q.ans + 1 + Math.floor(Math.random() * (n - 1))) % n; } quizAnswer(Q, 1, idx, b, false); }
        // 超时：没答的队伍算没答上，亮出正确答案
        if (Q.state === 1 && b >= Q.b0 + QBARS * 4 - 3) {
          [0, 1].forEach(t => { if (!Q.res[t]) { Q.res[t] = -1; Q.at[t] = b; } });
          G.pop('正确答案是 ' + KEYS[Q.q.ans] + ' ' + M.Q.label(Q.q.ch[Q.q.ans]), 'good'); G.sfx('miss', .5);
          Q.state = 2; Q.doneB = b;
        }
        Q.groups.forEach((g, t) => {
          const z = FZ + (ZH - FZ) * e; g.position.set(teamX(t, z), .9 + (YH - .9) * e + Math.sin(b * Math.PI) * .05, z);
          const r = Q.res[t], k = r ? U.clamp((b - Q.at[t]) / 1.2, 0, 1) : 0;
          g.userData.cards.forEach((s, i) => {
            const ok = i === Q.q.ans, pk = open && !r ? Math.max(0, 1 - (b % 1) * 3) : 0;
            let sc = CS + pk * .12, op = Math.min(1, u * 3);
            // 答完：正确答案的卡片放大移到中间（答错的队也能看到正确答案），其余淡出
            if (r) { if (ok) { sc = CS + (r > 0 ? .7 : .4) * Math.sin(Math.min(1, k * 2) * Math.PI / 2); s.position.set(OFF[i][0] * DQ * (1 - k), OFF[i][1] * DQ * (1 - k), 0); } else op = 1 - k * .85; }
            if (Q.state === 2) op *= 1 - U.clamp((b - Q.doneB - 1.5) / 1, 0, 1);
            s.scale.set(sc, sc, 1); s.material.opacity = op;
          });
        });
        if (Q.state === 2 && b >= Q.doneB + 2.5) { Q.state = 3; G.ask(null); Q.groups.forEach(g => g.visible = false); qNow = null; }
      }

      /* ---------- 结束：比分高的一队赢，赢家欢呼、输家倒地 ---------- */
      function finale() {
        fin = true; const w = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
        notes.forEach(n => { if (n.spr) { freeArrow(n.spr); n.spr = null; } });
        bunnies.forEach((b, l) => { if (!b) return; if (w < 0 || (l >> 1) === w) b.play('jump'); else b.play('die', { once: true }); });
        const bn = hud.querySelector('.dn-banner');
        bn.style.color = w < 0 ? '#ffd166' : TEAM[w].c;
        bn.innerHTML = (w < 0 ? '平局！' : TEAM[w].name + '获胜！') + '<small>' + Math.round(score[0]) + ' : ' + Math.round(score[1]) + '</small>';
        requestAnimationFrame(() => bn.classList.add('in'));
        if (w === 0) G.say('红队获胜'); else if (w === 1) G.say('蓝队获胜'); else G.say('平局，大家都很棒');
        G.sfx('cheer'); confetti(w < 0 ? null : w, 60); shake = .4;
        G.after(3.6, () => {
          const acc = st.human ? (st.perfect + st.good * .6) / st.human : 0, tq = G.stats.total, qa = tq ? G.stats.correct / tq : acc;
          const k = acc * .55 + qa * .45, stars = k >= .8 ? 3 : k >= .55 ? 2 : k >= .25 ? 1 : 0;
          G.end({
            score: duo ? Math.max(score[0], score[1]) : score[0], stars,
            title: duo ? (w < 0 ? '平局！两队都很棒' : TEAM[w].name + '赢得斗舞！') : (w === 0 ? '红队赢得斗舞！' : w < 0 ? '平局！' : '蓝队赢了，再来一次！'),
            lines: [U.E('🎯') + ' 完美 <b>' + st.perfect + '</b> · 不错 <b>' + st.good + '</b> · 错过 <b>' + st.miss + '</b>', U.E('🔥') + ' 最大连击 <b>' + st.maxCombo + '</b>', U.E('🐰') + ' 红队 <b>' + Math.round(score[0]) + '</b> : <b>' + Math.round(score[1]) + '</b> 蓝队'],
          });
        });
      }

      /* ---------- 每帧 ---------- */
      const cam0 = camBase;
      G.loop(dt => {
        const bRaw = song.beat(), b = bRaw - LAT / spb;
        // 拍点：灯光、迪斯科球、圆圈脉动
        const bi = Math.floor(bRaw); if (bi !== lastBi && bRaw >= 0) { lastBi = bi; pulse = 1; flickerDisco(bi % 4 === 0 ? 220 : 90); }
        pulse = Math.max(0, pulse - dt * 3.2);
        if (!fin) G.hud.timer(Math.max(0, (endBeat - bRaw) * spb));

        // 音符：生成、移动、错过、AI
        if (!fin) for (const n of notes) {
          if (n.beat - b > md.lead + .2) break;
          if (n.st) continue;
          if (n.team === 1 && aiBlue && n.ai.hit && (b - n.beat) * spb >= n.ai.off) { judge(n, n.ai.perf ? 'perfect' : 'good'); continue; }
          if ((b - n.beat) * spb > GOOD + .02) { judge(n, 'miss'); if (n.spr) n.spr.fade = 1; continue; }
          if (!n.spr && n.beat - b <= md.lead) n.spr = getArrow(n);
          if (n.spr) {
            const u = 1 - (n.beat - b) / md.lead, z = FZ + (RZ - FZ) * u, s = n.spr.s;
            s.position.set(laneX(n.lane, z), .55, z); const sc = 1.05 * (1 + Math.max(0, 1 - Math.abs(n.beat - b) * 4) * .15); s.scale.set(sc, sc, 1);
            s.material.opacity = Math.min(1, u * 4);
          }
        }
        // 已判定为错过的箭头：继续滑出并淡出
        notes.forEach(n => { if (n.st === 2 && n.spr) { const s = n.spr.s; s.position.z += dt * (RZ - FZ) / md.lead / spb; s.position.x = laneX(n.lane, s.position.z); s.material.opacity -= dt * 3; if (s.material.opacity <= 0) { freeArrow(n.spr); n.spr = null; } } });
        quizzes.forEach(Q => quizTick(Q, b, dt));
        if (!fin && bRaw >= endBeat) finale();

        // 灯光 / 舞台动画
        lamps.forEach((L, i) => {
          L.sway.rotation.z = Math.sin(bRaw * Math.PI / 2 + L.ph) * .22; L.sway.rotation.x = Math.cos(bRaw * Math.PI / 4 + L.ph) * .08;
          L.bm.uniforms.uI.value = .55 + pulse * .45; L.lg.material.opacity = .6 + pulse * .4;
          const d = L.base.clone().sub(L.src); d.applyAxisAngle(V(0, 0, 1), L.sway.rotation.z); d.applyAxisAngle(V(1, 0, 0), L.sway.rotation.x); const k = -L.src.y / d.y; L.pool.position.set(L.src.x + d.x * k, .03, L.src.z + d.z * k);
        });
        ball.rotation.y += dt * .35; ballGlow.material.opacity = .4 + pulse * .35;
        rings.forEach((r, l) => { r.fl = Math.max(0, r.fl - dt * 2.5); const sc = 1 + pulse * .08 + r.fl * .15; r.mesh.scale.set(sc, sc, 1); r.mesh.material.opacity = .75 + pulse * .25; r.flash.material.opacity = Math.min(1, r.fl); const fs = 1 + (1 - Math.min(1, r.fl)) * .6; r.flash.scale.set(fs, fs, 1); });
        laneMats.forEach(m => m.opacity = .22 + pulse * .1);
        lineMats.forEach(([m, op]) => m.opacity = op * (.75 + pulse * .25));
        badges.forEach(bd => { if (bd.pop) { bd.pop = Math.max(0, bd.pop - dt * 4); const s = 1 + bd.pop * .35; bd.s.scale.set(.62 * s, .73 * s, 1); } });
        // 兔子跟拍摇摆
        bunnies.forEach((av, l) => { if (!av) return; av.update(dt); if (!fin) { const ph = bRaw * Math.PI; av.position.y = av.userData.base.y + Math.abs(Math.sin(ph)) * .06; av.rotation.z = Math.sin(ph) * .05; } });
        fireTick(dt); fxTick(dt);
        for (let i = 0; i < NS; i++) { spos[i * 3 + 1] += dt * .3; if (spos[i * 3 + 1] > 9) spos[i * 3 + 1] = 0; } sg.attributes.position.needsUpdate = true;

        // 比分条（数字滚动）
        [0, 1].forEach(t => { const d = score[t] - shown[t]; if (Math.abs(d) > .5) { shown[t] += d * Math.min(1, dt * 8); $t[t].querySelector('b').textContent = Math.round(shown[t]); } });
        const tot = score[0] + score[1]; $tug.style.width = (tot ? 15 + 70 * score[0] / tot : 50) + '%';
        $t[0].classList.toggle('lead', score[0] > score[1]); $t[1].classList.toggle('lead', score[1] > score[0]);
        const lb = duo ? ['玩家 1 · 红队', '玩家 2 · 蓝队'] : ['你 · 红队', '电脑 · 蓝队'];
        [0, 1].forEach(t => { const s = $t[t].querySelector('small'); if (s.textContent !== lb[t]) s.textContent = lb[t]; });

        // 镜头：随拍轻晃 + 震动
        shake = Math.max(0, shake - dt * 1.8);
        camera.position.copy(cam0.pos).add(V(Math.sin(bRaw * Math.PI / 4) * .12 + U.rand(-1, 1) * shake * .25, Math.abs(Math.sin(bRaw * Math.PI)) * .04 + U.rand(-1, 1) * shake * .2, 0));
        camera.lookAt(cam0.look);
        // 卡通描边粗细按画布像素设置（SDK 的 render 没设，默认值在小兔子上会糊成一大圈黑边）
        if (window.Avatar3D && Avatar3D.outlineU) { const cv = T3.renderer.domElement; Avatar3D.setViewport(cv.width, cv.height); Avatar3D.outlineU.uOl.value = 2.2 / Math.max(1, cv.height) * Math.min(devicePixelRatio || 1, 1.75); }
        T3.render();
      });
    },
  });
})();
