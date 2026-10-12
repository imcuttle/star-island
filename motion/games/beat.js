/* 星光节拍（复刻抖音爆火的体感节奏游戏，类似 Beat Saber 体感版）
   · 深蓝霓虹隧道，红 / 绿方块踩着拍子从远处飞来：红色用左手打、绿色用右手打，打中碎成一地发光碎片
   · 绿色天花板墙压下来要蹲下，橙色斜墙从一侧铺过来要侧身躲开；左边白色火柴人实时跟着你动，右上角大连击数
   · 知识小节：顶部出题，飞来的方块上印着选项，打中正确答案的方块（金色大爆炸）
   · 轻松：慢、没有墙、哪只手都行；标准：有下蹲 / 侧身墙；挑战：更快、要按箭头方向挥 */
(function () {
  const M = window.Motion, U = M.U;
  // 每个难度：bpm、小节数、方块飞行时间（秒）、判定窗口（秒）、出手最低速度、撞墙 / 漏打扣能量
  const CFG = {
    easy: { bpm: 120, bars: 46, travel: 2.5, win: .42, spd: .45, perfect: .12, great: .24, miss: 3, wall: 0, arrows: false, anyHand: true, pad: 34, noFail: true },
    std: { bpm: 124, bars: 50, travel: 2.1, win: .32, spd: .8, perfect: .09, great: .19, miss: 5, wall: 15, arrows: false, pad: 24 },
    hard: { bpm: 128, bars: 56, travel: 1.7, win: .27, spd: 1.05, perfect: .08, great: .16, miss: 6, wall: 16, arrows: true, pad: 18 },
  };
  const RED = '#ff2d55', GREEN = '#2bff88', GOLD = '#ffd166', GREY = '#8a93b8';
  const QC = ['#ffd166', '#4cc9ff', '#d77dff'];               // 知识方块（选项）颜色，和题卡一致
  const Z_HIT = -3, Z_FAR = -78, CAM_Y = 1.6, TW = 2.7, TH = 4.4, TOP_Y = 1.15;
  const COLX = [-1.6, -.55, .55, 1.6], ROWY = [.95, 1.85], LAT = .08; // LAT：识别延迟补偿

  // 生成谱面：普通方块 + 墙 + 知识小节（都以拍为单位）
  function chart(mode, c) {
    const notes = [], walls = [], quiz = [], blocked = [];
    for (let b = 6; b <= c.bars - 5; b += 8) { const ask = b * 4 + 2, arrive = ask + (mode === 'easy' ? 10 : 8); quiz.push({ ask, arrive }); blocked.push([ask + 1, arrive + 1.5]); }
    if (mode !== 'easy') {
      const seq = mode === 'hard' ? ['left', 'right', 'top', 'right', 'left', 'top'] : ['top', 'left', 'top', 'right']; let wi = 0;
      for (let b = 6; b < c.bars - 2; b++) {
        const m = b % 8, on = mode === 'hard' ? (m === 2 || m === 4 || m === 5) : ((m === 2 && b >= 10) || (m === 4 && b >= 20));
        if (on) { walls.push({ beat: b * 4, type: seq[wi++ % seq.length] }); blocked.push([b * 4 - 1.5, b * 4 + 1.5]); }
      }
    }
    const free = B => B < c.bars * 4 && !blocked.some(r => B >= r[0] && B <= r[1]);
    const dirOf = { L: 6, R: 6 }; let hi = 0;
    const alt = () => (hi++ % 2 ? 'R' : 'L');
    const add = (B, hand, row) => {
      if (!free(B)) return;
      let dir = null; if (c.arrows) { dir = dirOf[hand] = dirOf[hand] === 2 ? 6 : 2; if (Math.random() < .2) dir = hand === 'L' ? 4 : 0; }
      notes.push({ beat: B, hand, col: hand === 'L' ? (Math.random() < .5 ? 0 : 1) : (Math.random() < .5 ? 3 : 2), row: row != null ? row : (Math.random() < (mode === 'easy' ? .2 : .35) ? 1 : 0), dir });
    };
    const pair = B => { const r = Math.random() < .3 ? 1 : 0; add(B, 'L', r); add(B, 'R', r); };
    for (let b = 2; b < c.bars; b++) {
      const B0 = b * 4;
      if (mode === 'easy') (b >= 24 && b % 2 ? [0, 1, 2] : [0, 2]).forEach(k => add(B0 + k, alt()));
      else if (mode === 'std') { if (b < 6) [0, 2].forEach(k => add(B0 + k, alt())); else if (b % 4 === 3) [0, 2].forEach(k => pair(B0 + k)); else [0, 1, 2, 3].forEach(k => add(B0 + k, alt())); }
      else { if (b % 4 === 3) [0, 1, 2, 3].forEach(k => k % 2 ? add(B0 + k, alt()) : pair(B0 + k)); else [0, 1, 2, 2.5, 3].forEach(k => add(B0 + k, alt())); }
    }
    return { notes, walls, quiz };
  }

  M.game({
    id: 'beat', name: '星光节拍', icon: '🎵', color: '#4cc9ff', tag: '复刻', demo: 'slice',
    short: '跟着节拍打碎飞来的方块，蹲下侧身躲墙！', desc: '红色方块用左手打、绿色方块用右手打，踩着音乐节拍把它们打碎；绿墙压下来要蹲下，橙色斜墙来了要侧身躲开。知识小节里打中写着正确答案的方块！',
    origin: '致敬抖音爆火的体感版《节奏光剑》：霓虹隧道、红绿方块按拍飞来、碎裂粒子、下蹲墙和斜墙、右上角大连击、左边火柴人跟着你动。',
    how: [['slice', '红块左手、绿块右手，挥过去打碎'], ['squat', '绿墙压下来，蹲下'], ['lanes', '橙色斜墙来了，侧身躲开']],
    modes: [{ id: 'std', name: '标准', icon: '⭐', desc: '有下蹲墙和斜墙' }, { id: 'easy', name: '轻松', icon: '🌱', desc: '慢一点、没有墙、哪只手都行' }, { id: 'hard', name: '挑战', icon: '🔥', desc: '更快，按箭头方向挥' }],
    qOpts: { maxLen: 4, maxCh: 3 },
    pip: false, // 左边已经有镜像火柴人
    sayHow: '红色方块用左手打，绿色方块用右手打，看到墙要蹲下或者侧身躲开',
    start(G) {
      const mode = CFG[G.mode] ? G.mode : 'std', c = CFG[mode];
      const T3 = G.three({ fov: 65, exposure: 1.05, far: 200 }), THREE = T3.THREE, scene = T3.scene, cam = T3.camera;
      const O = G.canvas({ dpr: 1.5 }), x = O.ctx;
      const V = (a, b, d) => new THREE.Vector3(a, b, d);
      const speed = (Z_HIT - Z_FAR) / c.travel;
      G.hud.hide('combo');

      /* ---------- 贴图（canvas 生成） ---------- */
      const ctex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
      const glowTex = ctex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
      const ringTex = ctex(128, 128, g => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.shadowColor = '#fff'; g.shadowBlur = 14; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.stroke(); });
      const dotTex = ctex(128, 128, g => { g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 18; g.beginPath(); g.arc(64, 64, 26, 0, 7); g.fill(); });
      const arrowTex = ctex(128, 128, g => { g.strokeStyle = '#fff'; g.lineWidth = 20; g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 16; g.beginPath(); g.moveTo(44, 26); g.lineTo(88, 64); g.lineTo(44, 102); g.stroke(); });

      /* ---------- 霓虹隧道 ---------- */
      scene.background = new THREE.Color(0x02030f); scene.fog = new THREE.Fog(0x02030f, 26, 80);
      cam.position.set(0, CAM_Y, 0); cam.lookAt(0, CAM_Y, -10);
      const refCam = cam.clone(); refCam.updateMatrixWorld(); // 判定用的静止相机（真相机会随身体晃动）
      scene.add(new THREE.AmbientLight(0x7080ff, .7)); const dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(0, 3, 3); scene.add(dl);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(TW * 2, 120), new THREE.MeshBasicMaterial({ color: 0x050a1e })); floor.rotation.x = -Math.PI / 2; floor.position.z = -55; scene.add(floor);
      const lineMat = (col, op) => new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: op != null, opacity: op == null ? 1 : op });
      const brightMat = lineMat(0x45b4ff), dimMat = lineMat(0x2050c8, .7);
      const longBox = (px, py, w, h, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 120), m); b.position.set(px, py, -58); scene.add(b); return b; };
      [-1, 1].forEach(s => { longBox(s * TW, .02, .08, .03, brightMat); longBox(s * TW, TH, .06, .06, brightMat); longBox(s * .95, .01, .03, .01, dimMat); longBox(s * TW, 2.2, .03, .03, dimMat); });
      // 一圈圈的光框，跟方块同速飞来，按节拍闪
      const frameMat = lineMat(0x2a6bff, .5), frames = [];
      for (let i = 0; i < 10; i++) {
        const g = new THREE.Group(), t = .05;
        [[TW * 2, t, 0, TH], [TW * 2, t, 0, 0], [t, TH, -TW, TH / 2], [t, TH, TW, TH / 2]].forEach(([w, h, px, py]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), frameMat); m.position.set(px, py, 0); g.add(m); });
        g.position.z = -i * 8; scene.add(g); frames.push(g);
      }
      // 两侧墙上飞驰的光条
      const streakMat = lineMat(0x66d0ff), streaks = [];
      for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, U.rand(1.5, 4)), streakMat); const side = i % 2 ? 1 : -1; s.position.set(side * (TW - .03), U.rand(.3, TH - .2), U.rand(Z_FAR, 0)); scene.add(s); streaks.push(s); }
      // 远处中央的蓝色光柱 + 频谱条
      const spr = (col, op, fog) => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: !!fog, toneMapped: false }));
      const farGlow = spr(0x2a5cff, .9); farGlow.position.set(0, 2.1, -90); farGlow.scale.set(10, 22, 1); scene.add(farGlow);
      const farCore = spr(0x9cc4ff, .9); farCore.position.set(0, 2.1, -89); farCore.scale.set(2.4, 9, 1); scene.add(farCore);
      const floorGlow = spr(0x2a6bff, .55, true); floorGlow.position.set(0, .05, -7); floorGlow.scale.set(3.4, 1.2, 1); scene.add(floorGlow);
      const eq = [];
      for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.13, 1, .05), new THREE.MeshBasicMaterial({ color: i % 3 === 1 ? 0x3355ff : 0xff3355, toneMapped: false, fog: false })); m.position.set(-2.1 + i * .247, 3.3, -62); scene.add(m); eq.push(m); }

      /* ---------- 方块（对象池） ---------- */
      const boxGeo = new THREE.BoxGeometry(1, 1, 1), edgeGeo = new THREE.EdgesGeometry(boxGeo), planeGeo = new THREE.PlaneGeometry(1, 1);
      const stdMat = col => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .85, roughness: .35, metalness: .15 });
      const boxMats = { L: stdMat(RED), R: stdMat(GREEN), q: QC.map(stdMat) };
      const glowMats = {}; const glowMat = col => glowMats[col] || (glowMats[col] = new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, toneMapped: false });
      const faceDot = new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, toneMapped: false });
      const faceArrow = new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, depthWrite: false, toneMapped: false });
      const pool = [];
      function getCube() {
        let g = pool.pop();
        if (!g) {
          g = new THREE.Group(); const glow = new THREE.Sprite(glowMat(RED)), box = new THREE.Mesh(boxGeo, boxMats.L), edge = new THREE.LineSegments(edgeGeo, edgeMat), face = new THREE.Mesh(planeGeo, faceDot);
          glow.scale.setScalar(2.9); face.position.z = .503; g.add(glow, box, edge, face); g.userData = { glow, box, face }; scene.add(g);
        }
        g.visible = true; g.scale.setScalar(1); return g;
      }
      function freeCube(g) { const f = g.userData.face; if (f.material._own) { f.material.map.dispose(); f.material.dispose(); } f.material = faceDot; f.rotation.z = 0; g.visible = false; pool.push(g); }
      // 知识方块正面：白底彩框 + 选项文字 / 表情
      function quizFace(ch, col) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        const draw = () => {
          g.clearRect(0, 0, 256, 256); g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(12, 12, 232, 232, 40); g.fill(); g.lineWidth = 14; g.strokeStyle = col; g.stroke();
          if (ch.t) { const n = [...ch.t].length, fs = n <= 1 ? 170 : n === 2 ? 118 : n === 3 ? 82 : 62; g.fillStyle = '#1b2150'; g.font = '900 ' + fs + 'px ' + U.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch.t, 128, 136, 220); }
          else if (ch.e) { const im = U.emoImg(ch.e); if (im.complete && im.naturalWidth) g.drawImage(im, 38, 38, 180, 180); }
          tex.needsUpdate = true;
        };
        draw(); if (!ch.t && ch.e) { const im = U.emoImg(ch.e); if (!im.complete) im.addEventListener('load', draw, { once: true }); }
        const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }); m._own = true; return m;
      }

      /* ---------- 墙（每种一个，循环用） ---------- */
      const wallObj = {};
      ['top', 'left', 'right'].forEach(type => {
        const g = new THREE.Group();
        if (type === 'top') {
          const h = TH - TOP_Y, m = new THREE.Mesh(new THREE.BoxGeometry(TW * 2, h, .7), new THREE.MeshBasicMaterial({ color: 0xb8ff3c, transparent: true, opacity: .85, toneMapped: false }));
          m.position.y = TOP_Y + h / 2; g.add(m);
          const e = new THREE.Mesh(new THREE.BoxGeometry(TW * 2, .09, .76), new THREE.MeshBasicMaterial({ color: 0xf4ffd0, toneMapped: false })); e.position.y = TOP_Y; g.add(e);
        } else {
          const s = type === 'left' ? 1 : -1, sh = new THREE.Shape();
          sh.moveTo(-TW * s, 0); sh.lineTo(.6 * s, 0); sh.lineTo(-.35 * s, TH); sh.lineTo(-TW * s, TH); sh.closePath();
          const geo = new THREE.ExtrudeGeometry(sh, { depth: .6, bevelEnabled: false }); geo.translate(0, 0, -.3);
          g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: .88, toneMapped: false })));
          g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffd6b8, toneMapped: false })));
        }
        g.visible = false; scene.add(g); wallObj[type] = g;
      });

      /* ---------- 碎块（InstancedMesh）、火花（Points）、冲击环 ---------- */
      const NDB = 480, db = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), NDB);
      db.instanceMatrix.setUsage(THREE.DynamicDrawUsage); db.frustumCulled = false; scene.add(db);
      const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), white = new THREE.Color(1, 1, 1), tmpC = new THREE.Color(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();
      const dbs = []; for (let i = 0; i < NDB; i++) { db.setMatrixAt(i, ZERO); db.setColorAt(i, white); dbs.push({ life: 0, max: 1, p: V(0, 0, 0), v: V(0, 0, 0), q: new THREE.Quaternion(), ax: V(0, 1, 0), w: 0, s: .1 }); }
      let dbI = 0;
      const NSP = 600, spPos = new Float32Array(NSP * 3).fill(-999), spCol = new Float32Array(NSP * 3), sps = [];
      for (let i = 0; i < NSP; i++) sps.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 });
      const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
      const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: .2, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      sparks.frustumCulled = false; scene.add(sparks); let spI = 0;
      const rings = []; for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.visible = false; scene.add(s); rings.push({ s, life: 0, max: .4, size: 2 }); }
      let ringI = 0;

      // 打碎：碎块朝挥手方向和镜头飞散 + 火花 + 冲击环
      function shatter(pos, col, o) {
        o = o || {}; const c3 = new THREE.Color(col), sz = o.size || .5, dir = o.dir || { x: 0, y: 0 }, n = o.n || 26;
        for (let i = 0; i < n; i++) {
          const k = dbI = (dbI + 1) % NDB, d = dbs[k];
          d.life = d.max = U.rand(.8, 1.4); d.p.set(pos.x + U.rand(-.5, .5) * sz, pos.y + U.rand(-.5, .5) * sz, pos.z + U.rand(-.5, .5) * sz);
          d.v.set(dir.x * U.rand(1.5, 5) + U.rand(-3, 3), dir.y * U.rand(1.5, 5) + U.rand(-1, 4), U.rand(.3, 2.5)); d.s = U.rand(.05, .16) * (o.big ? 1.4 : 1) * sz * 2;
          d.w = U.rand(4, 14); d.ax.set(U.rand(-1, 1), U.rand(-1, 1), U.rand(-1, 1)).normalize(); d.q.identity();
          tmpC.copy(c3).offsetHSL(0, 0, U.rand(-.12, .22)); db.setColorAt(k, Math.random() < .12 ? white : tmpC);
        }
        db.instanceColor.needsUpdate = true;
        const m = o.sparks || 26;
        for (let i = 0; i < m; i++) {
          const s = sps[spI = (spI + 1) % NSP], a = U.rand(0, 6.28), e = U.rand(-1, 1), v = U.rand(3, 10) * (o.big ? 1.4 : 1);
          s.life = s.max = U.rand(.35, .75); s.x = pos.x; s.y = pos.y; s.z = pos.z;
          s.vx = Math.cos(a) * Math.sqrt(1 - e * e) * v + dir.x * 3; s.vy = e * v + dir.y * 3; s.vz = Math.sin(a) * Math.sqrt(1 - e * e) * v * .6 + 2;
          const w = Math.random() < .3 ? 1 : 0; s.r = w ? 1 : c3.r; s.g = w ? 1 : c3.g; s.b = w ? 1 : c3.b;
        }
        const r = rings[ringI = (ringI + 1) % rings.length]; r.life = r.max = o.big ? .55 : .35; r.size = o.big ? 5 : 2.4; r.s.visible = true; r.s.position.copy(pos); r.s.material.color.set(col);
      }

      /* ---------- 谱面与状态 ---------- */
      const song = G.song({ bpm: c.bpm, style: 'neon', intro: 2 }), spb = 60 / c.bpm;
      const ch = chart(mode, c);
      const pending = ch.notes.map(n => Object.assign(n, { t: n.beat * spb, state: 0 })), live = [];
      const walls = ch.walls.map(w => Object.assign(w, { t: w.beat * spb, state: 0, frames: 0, safe: 0 }));
      const quizzes = ch.quiz.map(q => Object.assign(q, { t: q.ask * spb, started: false, done: false }));
      const endT = (c.bars * 4 + 3) * spb;
      const st = { notes: ch.notes.length, hit: 0, judged: 0, perfect: 0, great: 0, good: 0, miss: 0, wallN: walls.length, wallOk: 0, wallJ: 0, maxCombo: 0 };
      let combo = 0, comboBump = 0, energy = 70, pulse = 0, shake = 0, flash = 0, flashCol = '#fff', finished = false, banner = 0, now = -1;
      let cx = null, camX = 0, camY = CAM_Y; const texts = [], trails = { L: [], R: [] };
      song.onBeat(() => { pulse = 1; });
      song.start(.2);
      G._beat = { live, walls, proj: (a, b2, d) => proj(a, b2, d), get now() { return now; }, Z_HIT }; // 自测用（自动玩）

      const S = () => Math.min(O.W, O.H * 1.6) / 1100;
      const v3 = new THREE.Vector3();
      const proj = (wx, wy, wz) => { v3.set(wx, wy, wz).project(refCam); return { x: (v3.x * .5 + .5) * O.W, y: (-v3.y * .5 + .5) * O.H }; };
      const colX = col => COLX[col] * Math.min(1, cam.aspect / 1.7);
      const segDist = (ax, ay, bx, by, px, py) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; const k = U.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(ax + dx * k - px, ay + dy * k - py); };
      const say = (t, xx, yy, col, big) => texts.push({ t, x: xx, y: yy, col, life: .8, max: .8, big });
      const label = chh => chh.t || chh.e || '';

      function spawn(n) {
        const g = n.g = getCube(), u = g.userData;
        if (n.quiz) {
          n.tx = n.qx * Math.min(1, cam.aspect / 1.7); n.ty = 1.35; n.size = .8; n.col = QC[n.idx % QC.length];
          u.box.material = boxMats.q[n.idx % QC.length]; u.glow.material = glowMat(n.col); u.face.material = quizFace(n.ch, n.col); u.face.scale.setScalar(.92);
        } else {
          n.tx = colX(n.col); n.ty = ROWY[n.row]; n.size = .5; n.colr = n.hand === 'L' ? RED : GREEN;
          u.box.material = boxMats[n.hand]; u.glow.material = glowMat(n.colr);
          if (n.dir != null) { u.face.material = faceArrow; u.face.rotation.z = -n.dir * Math.PI / 4; u.face.scale.setScalar(.8); } else { u.face.material = faceDot; u.face.scale.setScalar(.7); }
        }
        g.scale.setScalar(n.size); n.state = 1; live.push(n);
      }
      function kill(n) { if (n.g) { freeCube(n.g); n.g = null; } }

      function addCombo() { combo++; comboBump = 1; st.maxCombo = Math.max(st.maxCombo, combo); if (combo % 20 === 0) { G.sfx('combo'); G.pop(combo + ' 连击！', 'combo'); } }
      function breakCombo() { if (combo >= 10) G.sfx('miss', .4); combo = 0; }
      function hurt(dmg) { if (!dmg) return; energy = Math.max(0, energy - dmg); if (energy <= 0 && !c.noFail) finish(true); }

      // 打中普通方块
      function hitNote(n, sd, rem, h, tp) {
        const a = Math.abs(rem), j = a < c.perfect ? 0 : a < c.great ? 1 : 2;
        const pts = [100, 70, 40][j] * (1 + Math.min(4, Math.floor(combo / 10)) * .5);
        st.hit++; st.judged++; st[['perfect', 'great', 'good'][j]]++; addCombo(); G.hud.add(Math.round(pts));
        energy = Math.min(100, energy + (j ? 2 : 3));
        const sp = Math.max(.01, h.speed), dir = { x: h.vel.x / sp, y: -h.vel.y / sp };
        shatter(n.g.position, n.colr, { dir, size: n.size, n: j ? 22 : 30 });
        say(['完美!', '很棒!', '不错'][j], tp.x, tp.y - 40 * S(), [GOLD, '#7ef9ff', '#b9ff7a'][j]);
        G.sfx('slice', .8); if (!j) G.sfx('hit', .6);
        shake = Math.max(shake, j ? .15 : .28); n.state = 2; kill(n);
      }
      // 打中知识方块
      function hitQuiz(n, h, tp) {
        const qz = n.quiz; if (qz.done) return; qz.done = true;
        const sp = Math.max(.01, h.speed), dir = { x: h.vel.x / sp, y: -h.vel.y / sp };
        if (n.ok) {
          shatter(n.g.position, GOLD, { dir, size: n.size, n: 46, sparks: 70, big: true }); G.right(tp.x, tp.y); G.sfx('magic'); G.sfx('slice');
          G.hud.add(300); addCombo(); energy = Math.min(100, energy + 8); say('答对啦! +300', tp.x, tp.y - 50 * S(), GOLD, true); shake = .5; flash = .35; flashCol = GOLD;
        } else {
          shatter(n.g.position, GREY, { dir, size: n.size, n: 30 }); G.wrong(); G.sfx('shatter'); breakCombo(); say('不对哦', tp.x, tp.y + 90 * S(), '#ff8fa0', true);
          flash = .25; flashCol = '#ff3355';
          const right = qz.notes.find(o => o.ok); if (right) G.pop('正确答案：' + (right.ch.t ? U.esc(right.ch.t) : U.E(right.ch.e)), 'miss');
        }
        qz.notes.forEach(o => { if (o === n || o.state !== 1) return; if (o.ok && !n.ok) o.reveal = true; else { shatter(o.g.position, GREY, { size: o.size, n: 12, sparks: 8 }); o.state = 2; kill(o); } });
        n.state = 2; kill(n); G.after(1, () => G.ask(null));
      }

      function startQuiz(qz) {
        qz.started = true; const q = qz.q = G.q(mode === 'easy' ? { maxCh: 2 } : null);
        G.ask(q, { options: true, colors: QC });
        const k = q.ch.length, xs = k === 2 ? [-1.05, 1.05] : k === 3 ? [-1.55, 0, 1.55] : q.ch.map((_, i) => -1.6 + 3.2 * i / Math.max(1, k - 1));
        qz.notes = q.ch.map((cc, i) => ({ beat: qz.arrive, t: qz.arrive * spb, quiz: qz, idx: i, ch: cc, ok: !!cc.ok, qx: xs[i], state: 0 }));
        pending.push(...qz.notes); pending.sort((a, b) => a.t - b.t);
        banner = 1.8; G.sfx('chime', .7);
      }

      function finish(fail) {
        if (finished) return; finished = true;
        const total = fail ? Math.max(1, st.judged) : st.notes, acc = st.hit / Math.max(1, total);
        const qAcc = G.stats.total ? G.stats.correct / G.stats.total : null, mix = qAcc == null ? acc : acc * .7 + qAcc * .3;
        let stars = mix >= .85 ? 3 : mix >= .6 ? 2 : mix >= .3 ? 1 : 0; if (fail) stars = Math.min(stars, 1);
        const lines = [U.E('🎯') + ' 命中 <b>' + st.hit + '/' + total + '</b>（' + Math.round(acc * 100) + '%）', U.E('✨') + ' 完美 <b>' + st.perfect + '</b> · 很棒 <b>' + st.great + '</b> · 不错 <b>' + st.good + '</b>', U.E('🔥') + ' 最高连击 <b>' + st.maxCombo + '</b>'];
        if (st.wallN) lines.push(U.E('🧱') + ' 躲墙 <b>' + st.wallOk + '/' + (fail ? st.wallJ : st.wallN) + '</b>');
        G.after(fail ? 1 : 1.6, () => G.end({ score: G.hud.scoreV, stars, title: fail ? '能量用完啦！' : undefined, lines }));
      }

      /* ---------- 每帧 ---------- */
      G.loop(dt => {
        const W = O.W, H = O.H, s = S();
        if (refCam.aspect !== cam.aspect) { refCam.aspect = cam.aspect; refCam.updateProjectionMatrix(); }
        now = song.time();
        const p = G.player(0), b = p && p.body && p.body.ready ? p.body : null;

        // 出题 / 生成方块 / 墙
        quizzes.forEach(q => { if (!q.started && now >= q.t) startQuiz(q); });
        while (pending.length && pending[0].t - now <= c.travel + .3) spawn(pending.shift());
        if (!finished && now > endT) finish(false);

        // 站位基线：没有墙快到时慢慢跟随，侧移量 = 相对基线
        const wallNear = walls.some(w => w.state < 2 && w.t - now < 2.4 && w.t - now > -.6);
        if (b && b.T) { if (cx == null) cx = b.hip.x; if (!wallNear) cx += (b.hip.x - cx) * Math.min(1, dt * 1.5); }
        const off = b && cx != null ? (b.hip.x - cx) / b.T : 0;

        // 手：位置用 reach 映射到全屏，保留 0.12 秒轨迹
        const hands = {};
        ['L', 'R'].forEach(sd => {
          const tr = trails[sd], h = b && b.hands[sd];
          if (h && h.visible) { const px = h.reach.x * W, py = h.reach.y * H, l = tr[tr.length - 1]; if (!l || Math.hypot(px - l.x, py - l.y) > 1) tr.push({ x: px, y: py, t: G.t }); hands[sd] = { h, x: px, y: py, x0: tr[0] ? tr[0].x : px, y0: tr[0] ? tr[0].y : py }; }
          while (tr.length > 1 && G.t - tr[0].t > .12) tr.shift();
        });

        // 方块：位置由音乐时钟决定（严格对拍）
        for (let i = live.length - 1; i >= 0; i--) {
          const n = live[i], rem = n.t - now;
          if (n.g) {
            const k = U.clamp(1 - rem / c.travel, 0, 1), sp = .25 + .75 * (1 - Math.pow(1 - Math.min(1, k / .6), 3));
            n.g.position.set(n.tx * sp, CAM_Y + (n.ty - CAM_Y) * sp, Z_HIT - rem * speed);
            n.g.scale.setScalar(n.size * (1 + pulse * .06 + (n.reveal ? Math.sin(G.t * 20) * .12 : 0)));
            if (n.reveal) n.g.userData.glow.material = glowMat(GOLD);
            if (n.g.position.z > 1.2) kill(n);
          }
          const re = rem + LAT;
          if (n.state === 1 && n.g && Math.abs(re) <= (n.quiz ? .5 : c.win)) {
            const tp = proj(n.tx, n.ty, Z_HIT), r = Math.abs(proj(n.tx + n.size / 2, n.ty, Z_HIT).x - tp.x), R = r * (n.quiz ? 1.2 : 1.25) + c.pad * s;
            for (const sd of ['L', 'R']) {
              const hd = hands[sd]; if (!hd || hd.h.speed < (n.quiz ? .3 : c.spd)) continue;
              if ((n.quiz ? Math.hypot(hd.x - tp.x, hd.y - tp.y) : segDist(hd.x0, hd.y0, hd.x, hd.y, tp.x, tp.y)) > R) continue; // 知识方块挨得近：只看手当前位置，免得拖尾扫到错的
              if (n.quiz) { if (!n.quiz.done) hitQuiz(n, hd.h, tp); break; }
              if (!c.anyHand && n.hand !== sd) { n.wrongHand = true; continue; } // 手用反了：漏掉时再提示
              if (n.dir != null) {
                const a = n.dir * Math.PI / 4, v = hd.h.vel, dot = (v.x * Math.cos(a) + v.y * Math.sin(a)) / Math.max(.01, hd.h.speed);
                if (dot < .34) { st.judged++; st.miss++; breakCombo(); hurt(3); shatter(n.g.position, GREY, { size: n.size, n: 14 }); say('方向反了', tp.x, tp.y - 40 * s, '#ff8fa0'); G.sfx('wrong', .5); n.state = 2; kill(n); break; }
              }
              hitNote(n, sd, re, hd.h, tp); break;
            }
          }
          if (n.state === 1 && re < -(n.quiz ? .5 : c.win)) {
            n.state = 3;
            if (n.quiz) { const qz = n.quiz; if (!qz.done && n.ok) { qz.done = true; G.pop('正确答案：' + (n.ch.t ? U.esc(n.ch.t) : U.E(n.ch.e)), 'miss'); G.after(1, () => G.ask(null)); } }
            else { st.judged++; st.miss++; breakCombo(); hurt(c.miss); const tp = proj(n.tx, n.ty, Z_HIT); say(n.wrongHand ? (n.hand === 'L' ? '要用左手!' : '要用右手!') : '漏了', tp.x, tp.y, n.wrongHand ? n.colr : '#ff8fa0'); G.sfx('miss', .35); }
          }
          if (!n.g && n.state !== 1) live.splice(i, 1);
        }

        // 墙：提醒 → 经过时检查蹲下 / 侧移
        walls.forEach(w => {
          const rem = w.t - now, o = wallObj[w.type];
          if (w.state === 0 && rem < c.travel + .3) w.state = 1;
          if (w.state !== 1) return;
          o.visible = rem > -.15; o.position.set(0, 0, -rem * speed);
          if (!w.warned && rem < 1.6) { w.warned = true; G.sfx('zap', .4); if (w.type === 'top') G.say('蹲下'); else if (w.type === 'left') G.say('往右躲'); else G.say('往左躲'); }
          if (rem < .15 && rem > -.3 && b) { w.frames++; const ok = w.type === 'top' ? (b.crouch || b.drop > .24) : w.type === 'left' ? (off > .28 || b.lean > .45) : (off < -.28 || b.lean < -.45); if (ok) w.safe++; }
          if (rem <= -.3) {
            w.state = 2; o.visible = false; st.wallJ++;
            if (w.frames && w.safe >= w.frames * .35) { st.wallOk++; G.hud.add(50); G.sfx('whoosh'); say('躲开啦 +50', W / 2, H * .42, '#7ef9ff', true); }
            else { breakCombo(); hurt(c.wall); G.sfx('wall'); shake = .9; flash = .55; flashCol = w.type === 'top' ? '#c8ff3c' : '#ff6a3a'; say('撞到啦!', W / 2, H * .42, '#ff8fa0', true); }
          }
        });

        // 碎块 / 火花 / 冲击环
        for (let i = 0; i < NDB; i++) {
          const d = dbs[i]; if (d.life <= 0) continue;
          d.life -= dt; if (d.life <= 0 || d.p.z > -.9) { d.life = 0; db.setMatrixAt(i, ZERO); continue; } // 飞到镜头前就消失，免得糊脸
          d.v.y -= 9 * dt; d.p.addScaledVector(d.v, dt); d.q.multiply(tmpQ.setFromAxisAngle(d.ax, d.w * dt));
          const k = Math.min(1, d.life / d.max * 2.5); tmpS.setScalar(d.s * k); db.setMatrixAt(i, tmpM.compose(d.p, d.q, tmpS));
        }
        db.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < NSP; i++) {
          const q = sps[i], j = i * 3; if (q.life <= 0) { if (spPos[j + 1] !== -999) { spPos[j + 1] = -999; } continue; }
          q.life -= dt; q.vy -= 6 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; const k = Math.max(0, q.life / q.max);
          spPos[j] = q.x; spPos[j + 1] = q.life > 0 ? q.y : -999; spPos[j + 2] = q.z; spCol[j] = q.r * k; spCol[j + 1] = q.g * k; spCol[j + 2] = q.b * k;
        }
        spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
        rings.forEach(r => { if (r.life <= 0) return; r.life -= dt; const k = 1 - r.life / r.max; r.s.scale.setScalar(.4 + r.size * k); r.s.material.opacity = Math.max(0, 1 - k); if (r.life <= 0) r.s.visible = false; });

        // 隧道动起来
        pulse = Math.max(0, pulse - dt * 3); shake = Math.max(0, shake - dt * 2.2); flash = Math.max(0, flash - dt * 1.8); comboBump = Math.max(0, comboBump - dt * 5); banner = Math.max(0, banner - dt);
        frames.forEach(f => { f.position.z += speed * dt; if (f.position.z > 1) f.position.z -= 80; });
        frameMat.opacity = .3 + pulse * .55;
        streaks.forEach(m => { m.position.z += speed * 1.3 * dt; if (m.position.z > -2.5) { m.position.z = Z_FAR + U.rand(-8, 0); m.position.y = U.rand(.3, TH - .2); } });
        farGlow.scale.set(10 + pulse * 2, 22 + pulse * 4, 1); farCore.material.opacity = .65 + pulse * .35; floorGlow.material.opacity = .35 + pulse * .4;
        eq.forEach((m, i) => { const hgt = .15 + (.5 + .5 * Math.sin(G.t * 7 + i * 1.9)) * (.25 + pulse * .9); m.scale.y = hgt; m.position.y = 3.3 + hgt / 2; });
        // 相机跟着身体：侧移、下蹲（视觉上真的躲过墙）
        const tx = U.clamp(off * 1.6 + (b ? b.lean * .3 : 0), -.9, .9), ty = CAM_Y - (b ? U.clamp((b.crouch ? .5 : 0) + Math.max(0, b.drop) * .4, 0, .6) : 0);
        camX += (tx - camX) * Math.min(1, dt * 8); camY += (ty - camY) * Math.min(1, dt * 8);
        cam.position.set(camX + (Math.random() - .5) * shake * .14, camY + (Math.random() - .5) * shake * .14, 0);
        T3.render();

        /* ---- 2D 覆盖层 ---- */
        x.clearRect(0, 0, W, H); x.save();
        if (shake > .3) x.translate((Math.random() - .5) * shake * 16, (Math.random() - .5) * shake * 16);
        // 目标圈：方块快到时在击打位置收缩，告诉小朋友手放哪儿
        live.forEach(n => {
          if (n.state !== 1 || !n.g) return; const rem = n.t - now; if (rem > 1.1 || rem < -.1) return;
          const tp = proj(n.tx, n.ty, Z_HIT), r = Math.abs(proj(n.tx + n.size / 2, n.ty, Z_HIT).x - tp.x), k = U.clamp(1 - rem / 1.1, 0, 1), col = n.quiz ? n.col : n.colr;
          x.globalAlpha = k * .85; x.strokeStyle = col; x.lineWidth = 3 * s; x.beginPath(); x.arc(tp.x, tp.y, r * (1.05 + Math.max(0, rem) * (n.quiz ? .7 : 1.4)), 0, 7); x.stroke();
          if (rem < .2) { x.globalAlpha = .18; x.fillStyle = col; x.beginPath(); x.arc(tp.x, tp.y, r * 1.1, 0, 7); x.fill(); }
        });
        x.globalAlpha = 1;
        // 两只手：发光球 + 拖尾
        [['L', RED], ['R', GREEN]].forEach(([sd, col]) => {
          const tr = trails[sd], hd = hands[sd]; if (!hd) return;
          if (tr.length > 1) { x.strokeStyle = col; x.lineCap = 'round'; for (let i = 1; i < tr.length; i++) { const k = i / tr.length; x.globalAlpha = .15 + .5 * k; x.lineWidth = (6 + 16 * k) * s; x.beginPath(); x.moveTo(tr[i - 1].x, tr[i - 1].y); x.lineTo(tr[i].x, tr[i].y); x.stroke(); } x.globalAlpha = 1; }
          x.save(); x.shadowColor = col; x.shadowBlur = 24 * s; x.fillStyle = col; x.beginPath(); x.arc(hd.x, hd.y, 17 * s, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(hd.x, hd.y, 8 * s, 0, 7); x.fill(); x.restore();
        });
        // 左边的白色火柴人：实时镜像玩家姿势
        const fx = W * .11, footY = H * .9;
        x.save(); x.shadowColor = '#4cc9ff'; x.shadowBlur = 16; x.fillStyle = 'rgba(80,170,255,.8)'; x.fillRect(fx - 60 * s, footY + 6 * s, 120 * s, 5 * s); x.restore();
        if (p && b && b.T && p.lm) {
          const sc = H * .4 / (3.6 * b.T), w = sc * b.A, hh = sc;
          M.Tracker.draw(x, p, { x: fx - (cx != null ? cx : b.hip.x) / b.A * w, y: footY - 1.9 * b.T * sc - b.baseHip * hh, w, h: hh, color: '#ffffff', lw: Math.max(2.5, 3.4 * s), glow: 14, lColor: RED, rColor: GREEN });
        }
        // 判定飘字
        for (let i = texts.length - 1; i >= 0; i--) {
          const t = texts[i]; t.life -= dt; if (t.life <= 0) { texts.splice(i, 1); continue; }
          const k = 1 - t.life / t.max, sc2 = k < .15 ? .6 + k / .15 * .5 : 1.1 - Math.min(.1, (k - .15));
          x.save(); x.globalAlpha = Math.min(1, t.life / .3); x.translate(t.x, t.y - k * 40 * s); x.scale(sc2, sc2);
          x.font = '900 ' + (t.big ? 52 : 36) * s + 'px ' + U.FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.lineWidth = 6 * s; x.strokeStyle = 'rgba(0,0,20,.7)'; x.strokeText(t.t, 0, 0); x.shadowColor = t.col; x.shadowBlur = 16; x.fillStyle = t.col; x.fillText(t.t, 0, 0); x.restore();
        }
        // 右上角大连击数
        if (combo > 0) {
          const cxr = W - 40 * s, cy = Math.max(150, H * .22), bs = 1 + comboBump * .25;
          x.save(); x.translate(cxr, cy); x.scale(bs, bs); x.textAlign = 'right'; x.textBaseline = 'alphabetic';
          x.font = '900 ' + 86 * s + 'px ' + U.FONT; x.shadowColor = '#4cc9ff'; x.shadowBlur = 22; x.fillStyle = '#ffffff'; x.fillText(combo, 0, 0);
          x.shadowBlur = 0; x.font = '800 ' + 20 * s + 'px ' + U.FONT; x.fillStyle = '#9fd8ff'; x.fillText('COMBO 连击', 0, 26 * s); x.restore();
        }
        // 能量条（左上）
        const ew = Math.min(300, W * .22), ex = 22, ey = 82, low = energy < 25 && !c.noFail;
        x.save(); x.fillStyle = 'rgba(0,10,40,.55)'; x.beginPath(); x.roundRect(ex, ey, ew, 16, 8); x.fill();
        const eg = x.createLinearGradient(ex, 0, ex + ew, 0); eg.addColorStop(0, low ? '#ff3355' : '#2b7bff'); eg.addColorStop(1, low ? '#ff8fa0' : '#7ef9ff');
        x.globalAlpha = low ? .6 + .4 * Math.sin(G.t * 14) : 1; x.fillStyle = eg; x.shadowColor = low ? '#ff3355' : '#4cc9ff'; x.shadowBlur = 12; x.beginPath(); x.roundRect(ex + 2, ey + 2, Math.max(0, (ew - 4) * energy / 100), 12, 6); x.fill();
        x.globalAlpha = 1; x.shadowBlur = 0; x.fillStyle = '#cfe8ff'; x.font = '800 ' + 14 + 'px ' + U.FONT; x.textBaseline = 'top'; x.fillText('⚡ 能量', ex, ey + 20); x.restore();
        // 进度条（底部）
        x.fillStyle = 'rgba(126,249,255,.18)'; x.fillRect(0, H - 4, W, 4); x.fillStyle = '#7ef9ff'; x.fillRect(0, H - 4, W * U.clamp(now / endT, 0, 1), 4);
        // 墙的提醒：边缘闪光 + 大字箭头
        walls.forEach(w => {
          const rem = w.t - now; if (w.state !== 1 || rem > 1.6 || rem < -.2) return;
          const blink = .5 + .5 * Math.sin(G.t * 18), col = w.type === 'top' ? '#c8ff3c' : '#ff7a45';
          x.save(); x.globalAlpha = .35 + blink * .35;
          const gr = w.type === 'top' ? x.createLinearGradient(0, 0, 0, H * .3) : w.type === 'left' ? x.createLinearGradient(0, 0, W * .3, 0) : x.createLinearGradient(W, 0, W * .7, 0);
          gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
          x.globalAlpha = 1; x.font = '900 ' + 60 * s + 'px ' + U.FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8 * s; x.strokeStyle = 'rgba(0,0,20,.75)'; x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 20;
          const txt = w.type === 'top' ? '⬇ 蹲下！' : w.type === 'left' ? '往右躲 ➡' : '⬅ 往左躲', ty2 = H * .3 + (w.type === 'top' ? blink * 10 * s : 0), tx2 = W / 2 + (w.type === 'left' ? blink * 14 * s : w.type === 'right' ? -blink * 14 * s : 0);
          x.strokeText(txt, tx2, ty2); x.fillText(txt, tx2, ty2); x.restore();
        });
        // 知识小节横幅
        if (banner > 0) {
          const k = Math.min(1, banner / .3, (1.8 - banner) / .2);
          x.save(); x.globalAlpha = k; x.font = '900 ' + 46 * s + 'px ' + U.FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = GOLD; x.shadowBlur = 24; x.fillStyle = GOLD;
          x.fillText('✦ 知识小节 ✦', W / 2, H * .36); x.shadowBlur = 0; x.font = '800 ' + 24 * s + 'px ' + U.FONT; x.fillStyle = '#fff'; x.lineWidth = 5 * s; x.strokeStyle = 'rgba(0,0,20,.8)'; x.strokeText('打中写着正确答案的方块', W / 2, H * .36 + 46 * s); x.fillText('打中写着正确答案的方块', W / 2, H * .36 + 46 * s); x.restore();
        }
        if (flash > 0) { x.globalAlpha = Math.min(.6, flash); x.fillStyle = flashCol; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
        x.restore();
      });
    },
  });
})();
