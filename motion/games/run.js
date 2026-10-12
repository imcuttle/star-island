/* 体感酷跑（复刻抖音「释放电量」体感酷跑）：第一人称奔跑在卡通草地赛道上
   · 身体左右移动换三条跑道，原地跑越快速度越快（左边的电量条）
   · 举纱门的小僵尸 → 出拳打飞；地刺 → 跳；横杆气球 → 蹲下滑铲；来不及就撞上
   · 知识跑酷：「答案门」跑进写着正确答案的拱门；「答题僵尸」只打举着正确答案的那个；答完 8 题结束（撞了不扣心，只减速掉金币）
   · 无尽挑战：只有动作障碍，越跑越快，撞 3 次结束 */
(function () {
  const M = window.Motion, U = M.U;
  const LANE = 1.8, RW = LANE * 3 + 1, SPAWN_Z = -92, CAM_Y = 1.45, LOW_Y = .7, JUMP = .85, QN = 6;
  const GATE_COL = ['#ff5d8f', '#ffb21f', '#2fa8ff'];
  // 动作提示：火柴人动画 + 中文 + 小字英文（原作 PUNCH / JUMP / SLIDE）
  const ACT = { punch: { mv: 'punch', zh: '出拳', en: 'PUNCH' }, jump: { mv: 'jump', zh: '跳', en: 'JUMP' }, squat: { mv: 'squat', zh: '蹲', en: 'SLIDE' }, gate: { mv: 'lanes', zh: '选门', en: 'GO' } };

  function css() {
    if (document.getElementById('mg-run-css')) return;
    const s = document.createElement('style'); s.id = 'mg-run-css';
    s.textContent = `
.mg-run .mg-cue b small { font-size: 14px; margin-left: 8px; letter-spacing: 1px; opacity: .85; }
.mg-run.qon .mg-cue { top: 33%; }
.mg-run-st { position: absolute; left: calc(18px + env(safe-area-inset-left)); top: calc(84px + env(safe-area-inset-top)); display: flex; gap: 14px; align-items: flex-start; }
.mg-run-bat { position: relative; width: 42px; height: 116px; border: 4px solid #fff; border-radius: 12px; background: rgba(0,0,0,.3); box-shadow: 0 4px 14px rgba(0,0,0,.3); }
.mg-run-bat:before { content: ''; position: absolute; left: 50%; top: -11px; width: 16px; height: 7px; margin-left: -8px; background: #fff; border-radius: 3px 3px 0 0; }
.mg-run-bat i { position: absolute; left: 3px; right: 3px; bottom: 3px; height: 10%; border-radius: 6px; background: linear-gradient(0deg, #2fd162, #c8ff4d); transition: height .15s; }
.mg-run-bat.hi i { background: linear-gradient(0deg, #ff9d00, #fff36b); box-shadow: 0 0 18px #ffd23f; }
.mg-run-bat span { position: absolute; inset: 0; display: grid; place-items: center; }
.mg-run-bat span .emo { width: 26px; height: 26px; filter: drop-shadow(0 2px 2px rgba(0,0,0,.5)); }
.mg-run-bat.hi span .emo { animation: mg-bump .3s infinite; }
.mg-run-bat em { position: absolute; left: 50%; bottom: -26px; transform: translateX(-50%); font-style: normal; font-size: 14px; font-weight: 900; white-space: nowrap; text-shadow: 0 2px 3px rgba(0,0,0,.6); }
.mg-run-nums { display: flex; flex-direction: column; gap: 8px; }
.mg-run-nums div { display: flex; align-items: center; gap: 6px; padding: 4px 14px 4px 8px; border-radius: 999px; background: rgba(0,0,0,.32); font-size: 15px; text-shadow: 0 2px 3px rgba(0,0,0,.5); }
.mg-run-nums b { font-size: 26px; line-height: 1.1; font-family: 'Fredoka', var(--font); }
.mg-run-nums .emo { width: 28px; height: 28px; }
.mg-run-nums .bump b { animation: mg-bump .25s; }`;
    document.head.appendChild(s);
  }

  // 搭场景（倒计时前就搭好，倒计时时能看到赛道）；go() 开跑
  function build(G) {
    css();
    const T3 = G.three({ fov: 62, tone: false, far: 420 }), T = T3.THREE, scene = T3.scene, cam = T3.camera;
    const C = G.canvas({ dpr: 1.25 }), cx = C.ctx;
    const quiz = G.mode !== 'endless';

    /* ---------- 贴图 ---------- */
    const ctex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
    scene.background = ctex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0f93ea'); g.addColorStop(.45, '#4fbdfb'); g.addColorStop(.62, '#9edcff'); g.addColorStop(1, '#d6f2ff'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    scene.fog = new T.Fog('#c9ecff', 40, 150);
    scene.add(new T.HemisphereLight('#ffffff', '#7fcf63', 2.1));
    const sun = new T.DirectionalLight('#fff4d8', 1.7); sun.position.set(-6, 12, 8); scene.add(sun);

    // 草地：割草条纹 + 草尖
    const grassT = ctex(256, 256, (c, w, h) => { c.fillStyle = '#55c935'; c.fillRect(0, 0, w, h); c.fillStyle = '#63d443'; c.fillRect(0, 0, w, h / 2); for (let i = 0; i < 300; i++) { c.fillStyle = Math.random() < .5 ? 'rgba(30,120,20,.3)' : 'rgba(190,255,130,.3)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 5); } }, true);
    const GT = 400 / 60; grassT.repeat.set(60, 60);
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshLambertMaterial({ map: grassT })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.02, -150); scene.add(ground);
    // 跑道：浅绿色宽条纹 + 白色分道线
    const roadT = ctex(256, 512, (c, w, h) => {
      c.fillStyle = '#b4ef7a'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#a3e466'; c.fillRect(0, h / 2, w, h / 2);
      c.fillStyle = '#fff'; c.fillRect(0, 0, 9, h); c.fillRect(w - 9, 0, 9, h);
      c.fillStyle = 'rgba(255,255,255,.8)'; [.5 - LANE / 2 / RW, .5 + LANE / 2 / RW].forEach(f => c.fillRect(f * w - 4, 40, 8, h / 2 - 80));
      for (let i = 0; i < 160; i++) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 4); }
    }, true);
    roadT.repeat.set(1, 30);
    const road = new T.Mesh(new T.PlaneGeometry(RW, 240), new T.MeshLambertMaterial({ map: roadT })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -110); scene.add(road);
    // 两侧白色木栅栏（一张透明贴图滚动）
    const fenceT = ctex(256, 128, (c, w, h) => {
      c.fillStyle = '#fff'; c.strokeStyle = '#c3cfdc'; c.lineWidth = 3;
      [44, 90].forEach(y => { c.fillRect(0, y, w, 12); c.beginPath(); c.moveTo(0, y + 12); c.lineTo(w, y + 12); c.stroke(); });
      for (let i = 0; i < 4; i++) { const px = i * 64 + 16; c.beginPath(); c.moveTo(px, h); c.lineTo(px, 22); c.lineTo(px + 16, 5); c.lineTo(px + 32, 22); c.lineTo(px + 32, h); c.closePath(); c.fill(); c.stroke(); }
    }, true);
    fenceT.repeat.set(120, 1);
    const fenceM = new T.MeshBasicMaterial({ map: fenceT, alphaTest: .5, side: T.DoubleSide });
    [-1, 1].forEach(s => { const f = new T.Mesh(new T.PlaneGeometry(240, 1.1), fenceM); f.rotation.y = Math.PI / 2; f.position.set(s * (RW / 2 + .4), .55, -110); scene.add(f); });
    // 远处灌木带 + 天空光柱（不受雾影响）
    const backT = ctex(1024, 256, (c, w, h) => {
      for (let i = 0; i < 7; i++) { const g = c.createLinearGradient(0, 0, 0, h * .6); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.13)'); c.fillStyle = g; const px = U.rand(0, w); c.beginPath(); c.moveTo(px, 0); c.lineTo(px + U.rand(30, 70), 0); c.lineTo(px + U.rand(10, 50), h * .64); c.lineTo(px - 20, h * .64); c.fill(); }
      const layer = (y0, r0, r1, step, col, hi) => { for (let px = -20; px < w + 40; px += step * U.rand(.7, 1.2)) { const r = U.rand(r0, r1), py = y0 + U.rand(-8, 8); c.fillStyle = col; c.beginPath(); c.arc(px, py, r, 0, 7); c.fill(); if (hi) { c.fillStyle = hi; c.beginPath(); c.arc(px - r * .25, py - r * .3, r * .55, 0, 7); c.fill(); } } c.fillStyle = col; c.fillRect(0, y0, w, h - y0); };
      layer(h * .7, 30, 52, 44, '#93dd6f', null); layer(h * .8, 22, 40, 34, '#4fc23a', 'rgba(140,235,100,.5)'); layer(h * .92, 14, 24, 22, '#3cae2e', 'rgba(120,225,90,.45)');
    });
    const back = new T.Mesh(new T.PlaneGeometry(560, 60), new T.MeshBasicMaterial({ map: backT, transparent: true, fog: false, depthWrite: false })); back.position.set(0, 21, -190); scene.add(back);
    // 云朵（精灵）
    const cloudT = ctex(256, 128, (c, w, h) => { c.fillStyle = '#fff'; [[70, 82, 38], [122, 62, 50], [176, 78, 40], [100, 94, 32], [150, 96, 34], [208, 94, 27], [44, 98, 24]].forEach(([a, b, r]) => { c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); }); c.globalCompositeOperation = 'source-atop'; const g = c.createLinearGradient(0, 50, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(150,195,235,.45)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const clouds = Array.from({ length: 8 }, () => { const s = new T.Sprite(new T.SpriteMaterial({ map: cloudT, fog: false, depthWrite: false })); const k = U.rand(20, 36); s.scale.set(k, k / 2, 1); s.position.set(U.rand(-170, 170), U.rand(24, 46), U.rand(-150, -180)); s.v = U.rand(.6, 1.6); scene.add(s); return s; });

    /* ---------- 共享材质 / 几何体 ---------- */
    const L = c => new T.MeshLambertMaterial({ color: c }), PH = (c, o) => new T.MeshPhongMaterial(Object.assign({ color: c, shininess: 80, specular: '#ffffff' }, o || {}));
    const meshT = ctex(128, 128, (c, w) => { c.strokeStyle = 'rgba(55,65,80,.9)'; c.lineWidth = 3; for (let i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, w); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } }, true); meshT.repeat.set(4, 5);
    const stripeT = ctex(64, 64, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff3b4e'; c.fillRect(0, 0, w, h / 2); }, true); stripeT.repeat.set(1, 14);
    const MAT = {
      skin: L('#8fd46a'), skinD: L('#5fae43'), coat: L('#8b5e3c'), tie: L('#ff4f5e'), pants: L('#4b5a8a'), shoe: L('#3a2a22'), white: L('#ffffff'), black: PH('#1b1b2a'),
      frame: PH('#eef2f7'), frameY: PH('#ffc93c'), wood: L('#d08c45'), steel: PH('#e6ebf2', { shininess: 120 }), red: PH('#ff3048'), yellow: PH('#ffd23f'), pink: PH('#ff7ab8'),
      gold: PH('#ffc933', { emissive: '#8a5400', shininess: 70, specular: '#fff6c0' }), hedge: L('#3fae3a'), flower: L('#ff9fd0'),
      shadow: new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .18, depthWrite: false }),
      mesh: new T.MeshBasicMaterial({ map: meshT, transparent: true, side: T.DoubleSide, depthWrite: false }),
      stripe: new T.MeshLambertMaterial({ map: stripeT }), gate: GATE_COL.map(c => PH(c)),
    };
    const GEO = {
      body: new T.CapsuleGeometry(.3, .42, 4, 12), head: new T.SphereGeometry(.38, 20, 16), ball: new T.SphereGeometry(1, 16, 12), leg: new T.CylinderGeometry(.09, .1, .5, 8),
      shoe: new T.BoxGeometry(.17, .1, .28), arm: new T.CylinderGeometry(.07, .07, .5, 8), box: new T.BoxGeometry(1, 1, 1), mouth: new T.TorusGeometry(.11, .028, 6, 14, Math.PI),
      tuft: new T.ConeGeometry(.07, .22, 6), shadow: new T.CircleGeometry(1, 20).rotateX(-Math.PI / 2), spike: new T.ConeGeometry(.11, .45, 8), post: new T.CylinderGeometry(.1, .1, 1, 10),
      bar: new T.CylinderGeometry(.11, .11, RW + 1, 14), coin: new T.CylinderGeometry(.32, .32, .08, 22).rotateX(Math.PI / 2), string: new T.CylinderGeometry(.01, .01, 1, 4),
      torus: new T.TorusGeometry(.8, .11, 8, 28, Math.PI), plane: new T.PlaneGeometry(1, 1),
    };
    const mk = (geo, mat, x, y, z, sx, sy, sz) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); return m; };
    // 答案牌贴图（文字或表情）
    function signTex(c, col) {
      const w = 512, h = 272, t = ctex(w, h, () => {}), g = t.image.getContext('2d');
      const draw = () => {
        g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(12, 12, w - 24, h - 24, 44); g.fill(); g.lineWidth = 18; g.strokeStyle = col; g.stroke();
        if (c.t) { let fs = 180; const f = () => g.font = '900 ' + fs + 'px ' + U.FONT; f(); while (g.measureText(c.t).width > w - 80 && fs > 40) { fs -= 8; f(); } g.fillStyle = '#2a2350'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.t, w / 2, h / 2 + fs * .06); }
        else if (c.e) { const im = U.emoImg(c.e, '3d'); if (im.complete && im.naturalWidth) g.drawImage(im, w / 2 - 95, h / 2 - 95, 190, 190); else im.addEventListener('load', () => { draw(); t.needsUpdate = true; }, { once: true }); }
        t.needsUpdate = true;
      };
      draw(); return t;
    }

    /* ---------- 路边：树、灌木 ---------- */
    const trees = [];
    const fallbackTree = () => { const g = new T.Group(); g.add(mk(GEO.post, L('#8a5a33'), 0, .8, 0, 1.6, 1.6, 1.6)); g.add(mk(GEO.ball, L('#3fb33a'), 0, 2.4, 0, 1.3)); return g; };
    for (let i = 0; i < 28; i++) {
      const k = i % 3 ? 'tree' : 'pine', m = (window.Models && Models.make(k, k === 'pine' ? U.rand(3.8, 5.2) : U.rand(3.2, 4.4), 'y')) || fallbackTree();
      const s = i % 2 ? 1 : -1; m.position.set(s * U.rand(6.5, 26), 0, U.rand(-150, 12)); m.rotation.y = U.rand(0, 6); scene.add(m); trees.push(m);
    }
    const NB = 70, bush = new T.InstancedMesh(new T.IcosahedronGeometry(1, 2), new T.MeshLambertMaterial({ color: '#ffffff' }), NB), bushD = [], col = new T.Color(), dummy = new T.Object3D();
    for (let i = 0; i < NB; i++) { const s = i % 2 ? 1 : -1; bushD.push({ x: s * U.rand(RW / 2 + 1.2, RW / 2 + 2.8), z: 12 - (i / NB) * 162 + U.rand(-1, 1), s: U.rand(.55, 1.1) }); bush.setColorAt(i, col.setHSL(U.rand(.26, .33), .62, U.rand(.34, .46))); }
    scene.add(bush);
    const updBush = d => { bushD.forEach((b, i) => { b.z += d; if (b.z > 12) b.z -= 162; dummy.position.set(b.x, b.s * .45, b.z); dummy.scale.set(b.s, b.s * .8, b.s); dummy.updateMatrix(); bush.setMatrixAt(i, dummy.matrix); }); bush.instanceMatrix.needsUpdate = true; };
    updBush(0);

    /* ---------- 障碍物 ---------- */
    // 举着纱门的绿色小僵尸（可爱版：大眼睛、一颗牙、头顶一撮毛）；choice 有值时纱门上挂答案牌
    function makeZombie(choice, color) {
      const g = new T.Group(), body = new T.Group(); g.add(body);
      g.add(mk(GEO.shadow, MAT.shadow, 0, .01, .2, .75));
      [-1, 1].forEach(s => { body.add(mk(GEO.leg, MAT.pants, s * .13, .3, 0)); body.add(mk(GEO.shoe, MAT.shoe, s * .13, .05, .05)); });
      body.add(mk(GEO.body, MAT.coat, 0, .92, 0)); body.add(mk(GEO.box, MAT.tie, 0, 1.04, .29, .09, .28, .03));
      const head = new T.Group(); head.position.set(0, 1.62, 0); body.add(head);
      head.add(mk(GEO.head, MAT.skin, 0, 0, 0, 1, .94, .94));
      [[-.14, .08, .16], [.15, .06, .13]].forEach(([ex, ey, r]) => { head.add(mk(GEO.ball, MAT.white, ex, ey, .27, r)); head.add(mk(GEO.ball, MAT.black, ex + .01, ey - .01, .27 + r * .82, r * .45)); });
      const mo = mk(GEO.mouth, MAT.black, 0, -.13, .33); mo.rotation.z = Math.PI; head.add(mo);
      head.add(mk(GEO.box, MAT.white, .04, -.2, .33, .06, .07, .03));
      const tf = mk(GEO.tuft, MAT.skinD, .05, .4, 0); tf.rotation.z = -.35; head.add(tf);
      // 两只手往前伸，抓住门框两边
      [-1, 1].forEach(s => { const pv = new T.Group(); pv.position.set(s * .3, 1.2, 0); pv.rotation.y = s * .56; const a = mk(GEO.arm, MAT.skin, 0, 0, .355, 1, 1.42, 1); a.rotation.x = Math.PI / 2; pv.add(a); body.add(pv); body.add(mk(GEO.ball, MAT.skin, s * .68, 1.2, .6, .1)); });
      const door = new T.Group(); door.position.z = .62; body.add(door);
      [2.1, 1.2, .3].forEach(y => door.add(mk(GEO.box, MAT.frame, 0, y, 0, 1.4, .09, .09)));
      [-1, 1].forEach(s => { door.add(mk(GEO.box, MAT.frame, s * .7, 1.2, 0, .09, 1.8, .09)); [.3, 2.1].forEach(y => door.add(mk(GEO.box, MAT.frameY, s * .7, y, 0, .15, .15, .15))); });
      door.add(mk(GEO.plane, MAT.mesh, 0, 1.2, 0, 1.3, 1.72));
      let tex = null;
      if (choice) { tex = signTex(choice, color); door.add(mk(GEO.plane, new T.MeshBasicMaterial({ map: tex }), 0, .98, .07, 1.3, .69)); }
      return { g, body, door, head, tex };
    }
    function makeSpikes() {
      const g = new T.Group(); g.add(mk(GEO.box, MAT.wood, 0, .08, 0, 1.5, .16, .72));
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const px = -.54 + i * .36, pz = -.17 + j * .34; g.add(mk(GEO.spike, MAT.steel, px, .38, pz)); g.add(mk(GEO.ball, MAT.red, px, .6, pz, .05)); }
      return g;
    }
    // 横杆 + 一排红气球（要蹲下钻过去）
    function makeBar() {
      const g = new T.Group(), balloons = [];
      [-1, 1].forEach(s => { g.add(mk(GEO.post, MAT.yellow, s * (RW / 2 + .2), 1.25, 0, 1, 2.5, 1)); g.add(mk(GEO.ball, MAT.yellow, s * (RW / 2 + .2), 2.55, 0, .16)); });
      const bar = mk(GEO.bar, MAT.stripe, 0, 1.3, 0); bar.rotation.z = Math.PI / 2; g.add(bar);
      for (let i = 0; i < 6; i++) { const px = -2.7 + i * 1.08, b = new T.Group(); b.position.set(px, 1.3, 0); b.add(mk(GEO.string, MAT.white, 0, .3, 0, 1, .6, 1)); b.add(mk(GEO.ball, [MAT.red, MAT.pink, MAT.red, MAT.yellow][i % 4], 0, .82, 0, .26, .31, .26)); b.ph = i; g.add(b); balloons.push(b); }
      g.balloons = balloons; return g;
    }
    function makeGate(choice, color, mat) {
      const g = new T.Group();
      [-1, 1].forEach(s => g.add(mk(GEO.post, mat, s * .8, 1.3, 0, 1, 2.6, 1)));
      g.add(mk(GEO.torus, mat, 0, 2.6, 0));
      const tex = signTex(choice, color); g.add(mk(GEO.plane, new T.MeshBasicMaterial({ map: tex }), 0, 2.72, .15, 1.6, .85));
      const cur = mk(GEO.plane, new T.MeshBasicMaterial({ color, transparent: true, opacity: .2, side: T.DoubleSide, depthWrite: false }), 0, 1.28, 0, 1.5, 2.55); g.add(cur); g.curtain = cur;
      g.add(mk(GEO.shadow, MAT.shadow, 0, .01, 0, .9));
      return { g, tex };
    }
    function makeHedge() { const g = new T.Group(); g.add(mk(GEO.box, MAT.hedge, 0, .65, 0, 1.5, 1.3, .9)); for (let i = 0; i < 6; i++) g.add(mk(GEO.ball, MAT.flower, U.rand(-.6, .6), U.rand(.4, 1.25), .46, .08)); return g; }

    /* ---------- 状态 ---------- */
    const P = { lane: 0, x: 0, cy: CAM_Y, h: 0, jumpT: -9, squatT: -9, hitT: -9, invT: 0, boostT: -9, slowT: -9, speed: 0, energy: 0, dist: 0, coins: 0, hearts: 3, hits: 0, bonus: 0, phase: 0, dead: false };
    const objs = [], events = [], debris = [], sparks = [], pows = [], lines = [];
    let spawnCur = 0, nextZ = null, sinceQuiz = 0, nextQuizAfter = 3, qAsked = 0, qDone = 0, cur = null, seqI = 0, lastKind = '', lastBL = null, flash = 0, shake = 0, fist = null, ko = 0, said = {}, hudT = 0, lastHud = {};
    const curLane = () => U.clamp(Math.round(P.x / LANE), -1, 1);
    const v3 = new T.Vector3();
    const scr = (o, dy) => { o.updateMatrixWorld(true); o.getWorldPosition(v3); v3.y += dy || 0; v3.project(cam); return { x: (v3.x + 1) / 2 * C.W, y: (1 - v3.y) / 2 * C.H }; };
    const add = (o, ev) => { o.z = o.g.position.z; scene.add(o.g); objs.push(o); if (ev) { o.ev = ev; ev.objs.push(o); } return o; };
    const remove = o => { scene.remove(o.g); if (o.tex) o.tex.dispose(); };

    function coinRow(lane, z0, n, arc, y0) {
      for (let i = 0; i < n; i++) { const y = (y0 || .8) + (arc ? Math.sin(i / (n - 1) * Math.PI) * 1.5 : 0), g = mk(GEO.coin, MAT.gold, lane * LANE, y, z0 + i * 2.2); g.rotation.y = i * .5; add({ kind: 'coin', g, lane, y, hitZ: -.2 }); }
    }
    function spawnAction(kind, z) {
      z = z || SPAWN_Z; const ev = { act: kind === 'zombie' ? 'punch' : kind === 'spikes' ? 'jump' : 'squat', objs: [] }; events.push(ev);
      if (kind === 'zombie') {
        const n = seqI <= 1 ? 3 : U.pick([1, 2, 3, 3]), ls = U.shuffle([-1, 0, 1]).slice(0, n);
        ls.forEach(l => { const zb = makeZombie(); zb.g.position.set(l * LANE, 0, z); add(Object.assign(zb, { kind: 'zombie', lane: l, hitZ: -.6, walk: 1, ph: U.rand(0, 6) }), ev); });
        const free = [-1, 0, 1].filter(l => !ls.includes(l)); if (free.length) coinRow(U.pick(free), z - 6, 6);
      } else if (kind === 'spikes') {
        const ls = Math.random() < .65 || seqI <= 2 ? [-1, 0, 1] : U.shuffle([-1, 0, 1]).slice(0, 2);
        ls.forEach(l => { const g = makeSpikes(); g.position.set(l * LANE, 0, z); add({ kind: 'spikes', g, lane: l, hitZ: 0 }, ev); });
        coinRow(U.pick(ls), z - 3.3, 4, true, .9);
      } else {
        const g = makeBar(); g.position.set(0, 0, z); add({ kind: 'bar', g, lane: 0, hitZ: 0 }, ev);
        coinRow(U.pick([-1, 0, 1]), z - 2.2, 3, false, .5);
      }
    }
    function pickKind() {
      const seq = ['zombie', 'spikes', 'bar']; if (seqI < 3) return seq[seqI];
      let k; do k = U.pick(['zombie', 'zombie', 'spikes', 'spikes', 'bar']); while (k === lastKind && Math.random() < .6); return k;
    }
    // 出一道题：答案门（跑进正确的门）或答题僵尸（打举着正确答案的那个）
    function spawnQuiz(z) {
      const q = G.q(), ch = q.ch.slice(0, 3), n = ch.length, lanes = n >= 3 ? [-1, 0, 1] : [-1, 1], cols = n >= 3 ? GATE_COL : [GATE_COL[0], GATE_COL[2]];
      const kind = qAsked % 2 ? 'qzombie' : 'gate', ev = { act: kind === 'gate' ? 'gate' : 'punch', objs: [], quiz: true }; events.push(ev);
      cur = { q, kind, done: false, ev }; qAsked++;
      ch.forEach((c, i) => {
        const l = lanes[i], ci = n >= 3 ? i : i * 2;
        if (kind === 'gate') { const o = makeGate(c, cols[i], MAT.gate[ci]); o.g.position.set(l * LANE, 0, z); add(Object.assign(o, { kind: 'gate', lane: l, choice: c, hitZ: 0 }), ev); }
        else { const zb = makeZombie(c, cols[i]); zb.g.position.set(l * LANE, 0, z); add(Object.assign(zb, { kind: 'zombie', lane: l, choice: c, hitZ: -.6, walk: .5, ph: U.rand(0, 6) }), ev); }
      });
      if (kind === 'gate' && n < 3) { const g = makeHedge(); g.position.set(0, 0, z); add({ kind: 'hedge', g, lane: 0, hitZ: 99 }, ev); }
      const ask = say => G.ask(q, { options: true, keys: n >= 3 ? ['左', '中', '右'] : ['左', '右'], colors: cols, say });
      // 第一次见到这种玩法先讲规则，再读题
      if (!said[kind]) { said[kind] = 1; ask(false); (kind === 'gate' ? G.say('跑进正确答案的门！') : G.say('打飞举着正确答案的僵尸！')).then(() => !G.over && cur && cur.q === q && !cur.done && G.say(q.say)); }
      else ask();
      G.el.classList.add('qon'); spawnCur = -1e9;
    }
    function resolveQuiz(ok, sx, sy) {
      if (!cur || cur.done) return; cur.done = true; qDone++;
      const q = cur.q;
      if (ok) {
        G.right(sx, sy); G.hud.combo(G.hud.comboV + 1); P.coins += 5; P.bonus += 50; P.boostT = G.t + 2.4; G.sfx('magic'); G.pop('答对啦！+5', 'perfect');
        burst(C.W / 2, C.H * .5, 40, ['#ffd166', '#7ef9ff', '#ff9fe0', '#9bff7a']);
      } else {
        G.wrong(); G.hud.combo(0); P.slowT = G.t + 1.6; const r = q.ch.find(c => c.ok); G.pop(r && r.t ? '答案是 ' + r.t : '不对哦', 'bad');
      }
      G.after(1.3, () => { if (cur && cur.done) { G.ask(null); G.el.classList.remove('qon'); } });
      spawnCur = 1e3; nextZ = -Math.max(30, P.speed * 3.5); // 答完马上来下一个障碍，不空跑
      if (qDone >= QN) { P.endT = G.t + 1.8; }
    }

    /* ---------- 动作结果 ---------- */
    function burst(px, py, n, cols, sp) { for (let i = 0; i < n; i++) { const a = U.rand(0, 6.28), v = U.rand(120, 520) * (sp || 1); sparks.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 160, life: U.rand(.5, 1), r: U.rand(3, 8), col: U.pick(cols) }); } }
    function fly(m, vx, vy, vz, life) { debris.push({ m, vx, vy, vz, rx: U.rand(-9, 9), ry: U.rand(-9, 9), rz: U.rand(-9, 9), life }); }
    // 撞上：无尽模式扣心（3 次结束）；知识跑酷不会中途结束，只减速、掉 2 枚金币
    function hit() {
      if (G.t < P.invT || P.dead) return false;
      P.hitT = G.t; P.invT = G.t + 1.5; flash = 1; shake = 1; G.hud.combo(0); P.hits++;
      G.fileSfx('hurt', .7); G.sfx('wall'); G.pop('哎呀！', 'bad');
      if (quiz) { P.coins = Math.max(0, P.coins - 2); return true; }
      P.hearts--; G.hud.hearts(Math.max(0, P.hearts), 3);
      if (P.hearts <= 0) { P.dead = true; G.after(1.1, () => finish('撞了 3 次，休息一下吧')); }
      return true;
    }
    function nice(ev) { if (ev.nice) return; ev.nice = true; P.bonus += 10; G.hud.combo(G.hud.comboV + 1); G.pop(U.pick(['漂亮！', '好样的！', '完美！']), 'perfect'); G.sfx('perfect', .5); }
    // 打飞：僵尸翻滚着飞走，纱门散成碎片
    function knock(o) {
      o.knocked = true; o.passed = true; o.g.updateMatrixWorld(true);
      o.door.children.slice().forEach(p => { scene.attach(p); fly(p, U.rand(-5, 5), U.rand(3, 9), -P.speed - U.rand(2, 10), 1.6); });
      o.fly = { vx: U.rand(-2, 2) + o.lane * 2.5, vy: 8, vz: -P.speed - 9, t: 0 };
    }
    function punch(hand) {
      fist = { t: 0, hand }; G.sfx('whoosh', .5);
      const range = Math.max(12, P.speed * 1.75), cl = curLane(); let best = null;
      objs.forEach(o => { if (o.kind === 'zombie' && !o.knocked && !o.flee && o.lane === cl && o.z > -range && o.z < .4 && (!best || o.z > best.z)) best = o; });
      if (!best) return;
      const s = scr(best.g, 1.5); knock(best);
      pows.push({ x: s.x, y: s.y, life: .6, t: U.pick(['砰！', 'POW!', '啪！']) }); burst(s.x, s.y, 16, ['#ffffff', '#ffd166', '#9bff7a'], .8);
      G.sfx('punch'); G.fileSfx('hit', .6); shake = Math.max(shake, .35); ko++;
      if (best.choice) {
        if (best.choice.ok) { resolveQuiz(true, s.x, s.y); best.ev.objs.forEach(o => { if (o !== best && !o.knocked) { o.flee = true; o.passed = true; } }); }
        else if (cur && !cur.done && cur.ev === best.ev) resolveQuiz(false);
      } else { P.bonus += 20; G.hud.combo(G.hud.comboV + 1); G.pop(U.pick(['打飞！', '一拳！', '厉害！']), 'good'); }
    }
    function pass(o, air, low) {
      const cl = curLane();
      if (o.kind === 'coin') { if (Math.abs(P.x - o.lane * LANE) < .95 && (o.y < 1.5 || P.h > .55)) { const s = scr(o.g); P.coins++; G.sfx('coin', .45); burst(s.x, s.y, 8, ['#ffd166', '#fff3a0'], .5); o.dead = true; } return; }
      if (o.kind === 'zombie') {
        if (o.choice && o.choice.ok && cur && cur.ev === o.ev && !cur.done) { resolveQuiz(false); }
        if (o.lane === cl && hit()) { knock(o); G.sfx('punch', .5); } // 撞上也把它撞飞，镜头不会穿模
        return;
      }
      if (o.kind === 'spikes') { if (o.lane === cl) { if (air) nice(o.ev); else hit(); } return; }
      if (o.kind === 'bar') { if (low) nice(o.ev); else { if (hit()) o.g.balloons.forEach(b => { b.visible = false; }); } return; }
      if (o.kind === 'gate' && !o.ev.judged) {
        o.ev.judged = true; const g = o.ev.objs.find(x => x.kind === 'gate' && x.lane === cl);
        if (g) g.g.curtain.material.opacity = .6;
        resolveQuiz(!!(g && g.choice.ok), C.W / 2, C.H * .55);
      }
    }
    function cue(act) {
      const A = ACT[act]; G.cue('<canvas data-move="' + A.mv + '" data-color="#2b2266" data-glow="#a48bff"></canvas>', A.zh + '<small>' + A.en + '</small>', 1500);
      const el = G.el.querySelector('.mg-cue'); if (el && M.Puppet) M.Puppet.mountAll(el);
      // 前两次念出来教动作（答题时不打断读题）
      said[act] = (said[act] || 0) + 1;
      if (said[act] <= 2 && !(cur && !cur.done)) { if (act === 'punch') G.say('出拳！'); else if (act === 'jump') G.say('跳起来！'); else if (act === 'squat') G.say('蹲下！'); }
      else G.sfx('zap', .3);
    }
    function score() { return Math.floor(P.dist) + P.coins * 10 + P.bonus; }
    function finish(title) {
      if (G.over) return; Core.Audio2.stopMusic();
      const lines = [U.E('🏃') + ' 奔跑 <b>' + Math.floor(P.dist) + ' 米</b>', U.E('💰') + ' 收集金币 <b>' + P.coins + '</b>', U.E('👊') + ' 打飞僵尸 <b>' + ko + '</b>'];
      if (quiz) lines.push(U.E('💥') + ' 撞到 <b>' + P.hits + ' 次</b>');
      const sc = score(), d = P.dist;
      if (quiz) G.end({ score: sc, lines, title: qDone >= QN ? null : title });
      else G.end({ score: sc, lines, title, stars: d >= 2000 ? 3 : d >= 1000 ? 2 : d >= 400 ? 1 : 0 });
    }

    /* ---------- 画面叠加层：速度线、拳头、砰、火花、受伤红闪 ---------- */
    const fistImg = U.emoImg('👊', '3d');
    function overlay(dt) {
      const W = C.W, H = C.H; cx.clearRect(0, 0, W, H);
      const boost = G.t < P.boostT, sp = U.clamp((P.speed - 10) / 9, 0, 1) + (boost ? .7 : 0);
      while (lines.length < sp * 34) lines.push({ a: U.rand(0, 6.28), r: U.rand(.12, .3) * W, v: U.rand(1.4, 2.4) * W, l: U.rand(.05, .12) * W });
      cx.save(); cx.lineCap = 'round'; cx.strokeStyle = boost ? '#fff6b0' : '#ffffff';
      for (let i = lines.length - 1; i >= 0; i--) {
        const s = lines[i]; s.r += s.v * dt; if (s.r > W * .85) { lines.splice(i, 1); continue; }
        const c = Math.cos(s.a), sn = Math.sin(s.a) * .7, ox = W / 2, oy = H * .44;
        cx.globalAlpha = Math.min(.55, sp * .5) * Math.min(1, (s.r / W - .1) * 4); cx.lineWidth = 2 + s.r / W * 4;
        cx.beginPath(); cx.moveTo(ox + c * s.r, oy + sn * s.r); cx.lineTo(ox + c * (s.r + s.l), oy + sn * (s.r + s.l)); cx.stroke();
      }
      cx.restore();
      // 拳头：从屏幕下方冲向前
      if (fist) {
        fist.t += dt; const k = fist.t / .32; if (k >= 1) fist = null;
        else if (fistImg.complete && fistImg.naturalWidth) { const R = fist.hand !== 'L', e = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3), sz = H * (.36 - .12 * e), fx = U.lerp(W * (R ? .78 : .22), W * (R ? .56 : .44), e), fy = U.lerp(H * 1.05, H * .6, e); cx.save(); cx.globalAlpha = k > .65 ? (1 - k) / .35 : 1; cx.translate(fx, fy); cx.rotate(R ? -.2 : .2); cx.drawImage(fistImg, -sz / 2, -sz / 2, sz, sz); cx.restore(); }
      }
      // 砰！
      for (let i = pows.length - 1; i >= 0; i--) {
        const p = pows[i]; p.life -= dt; if (p.life <= 0) { pows.splice(i, 1); continue; }
        const k = 1 - p.life / .6, sc = k < .2 ? k / .2 * 1.25 : 1.25 - (k - .2) * .3, r = H * .1 * sc;
        cx.save(); cx.translate(p.x, p.y); cx.globalAlpha = Math.min(1, p.life * 3); cx.rotate(-.15);
        cx.fillStyle = '#fff'; cx.beginPath(); for (let j = 0; j < 20; j++) { const rr = j % 2 ? r * .6 : r * 1.15, a = j / 20 * 6.28; cx.lineTo(Math.cos(a) * rr * 1.3, Math.sin(a) * rr); } cx.closePath(); cx.fill();
        cx.font = '900 ' + r * .75 + 'px ' + U.FONT; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineWidth = r * .14; cx.strokeStyle = '#c4122f'; cx.strokeText(p.t, 0, 0); cx.fillStyle = '#ffd23f'; cx.fillText(p.t, 0, 0);
        cx.restore();
      }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; } s.vy += 700 * dt; s.x += s.vx * dt; s.y += s.vy * dt; cx.globalAlpha = Math.min(1, s.life * 2); cx.fillStyle = s.col; cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 7); cx.fill(); }
      cx.globalAlpha = 1;
      if (boost) { const g = cx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .7); g.addColorStop(0, 'rgba(255,230,90,0)'); g.addColorStop(1, 'rgba(255,210,60,' + (.28 * Math.min(1, (P.boostT - G.t))) + ')'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
      if (flash > 0) { const g = cx.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, W * .7); g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, 'rgba(255,20,40,' + flash * .55 + ')'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
    }

    /* ---------- HUD：电量条、金币、距离 ---------- */
    const st = U.h('div', 'mg-run-st', '<div class="mg-run-bat"><i></i><span>' + U.E('⚡') + '</span><em>电量</em></div><div class="mg-run-nums"><div class="c">' + U.E('🪙') + '<b>0</b></div><div class="d">' + U.E('🏃') + '<b>0</b><small>米</small></div></div>');
    G.hudEl.appendChild(st);
    const batI = st.querySelector('.mg-run-bat i'), bat = st.querySelector('.mg-run-bat'), cB = st.querySelector('.c b'), dB = st.querySelector('.d b');
    function hud(dt) {
      const e = Math.round(Math.max(.08, P.energy) * 100);
      if (e !== lastHud.e) { lastHud.e = e; batI.style.height = 'calc(' + e + '% - 6px)'; }
      const hi = P.energy > .7 || G.t < P.boostT; if (hi !== lastHud.hi) { lastHud.hi = hi; bat.classList.toggle('hi', hi); }
      if (P.coins !== lastHud.c) { lastHud.c = P.coins; cB.textContent = P.coins; const p = cB.parentNode; p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
      const d = Math.floor(P.dist); if (d !== lastHud.d) { lastHud.d = d; dB.textContent = d; }
      hudT -= dt; if (hudT <= 0) { hudT = .3; const s = score(); if (s !== lastHud.s) { lastHud.s = s; G.hud.score(s); } }
    }

    /* ---------- 每帧 ---------- */
    function frame(dt) {
      dt = Math.min(dt, .05);
      const me = G.player(0), b = me && me.body;
      if (b && b.lane !== lastBL) { lastBL = b.lane; P.lane = b.lane; }
      // 速度：原地跑步频 → 电量 → 速度
      const cad = b ? b.cadence : 0; P.energy += (U.clamp(cad / 2.6, 0, 1) - P.energy) * Math.min(1, dt * 1.5);
      const lvl = quiz ? 0 : Math.min(1, G.t / 150);
      let tgt = (quiz ? 8 : 8.5 + lvl * 8) + P.energy * 7;
      if (cur && !cur.done) tgt *= .8;
      if (G.t < P.boostT) tgt += 6;
      if (G.t < P.slowT) tgt *= .7;
      if (G.t - P.hitT < 1) tgt *= .4;
      if (P.dead) tgt = 0;
      P.speed += (tgt - P.speed) * Math.min(1, dt * 1.8);
      const d = P.speed * dt; P.dist += d;
      roadT.offset.y += d / 8; grassT.offset.y += d / GT; fenceT.offset.x += d / 2;
      trees.forEach(t => { t.position.z += d; if (t.position.z > 14) { t.position.z -= 166; t.position.x = (t.position.x > 0 ? 1 : -1) * U.rand(6.5, 26); } });
      updBush(d);
      clouds.forEach(c => { c.position.x += c.v * dt; if (c.position.x > 190) c.position.x = -190; });
      // 生成：障碍间距随速度变化，保证 ~2 秒以上的反应时间
      if (!P.dead && P.endT == null) {
        spawnCur += d; const gap = Math.max(17, P.speed * (quiz ? 2.7 : U.lerp(2.7, 1.9, lvl)));
        if (spawnCur >= gap) {
          if (quiz && sinceQuiz >= nextQuizAfter && qAsked < QN) {
            // 题目在 ~7 秒路程外出现：等前面的障碍都过去一段再出题，留出读题和换道时间
            const qz = Math.max(46, P.speed * 7), far = objs.reduce((m, o) => o.passed ? m : Math.min(m, o.z), 0);
            if (far > -qz + 16) { spawnCur = 0; spawnQuiz(-qz); sinceQuiz = 0; nextQuizAfter = U.pick([2, 2, 3]); }
          } else { spawnCur = 0; const k = pickKind(); spawnAction(k, nextZ); nextZ = null; lastKind = k; seqI++; sinceQuiz++; }
        }
      }
      if (P.endT != null && G.t >= P.endT) { P.endT = Infinity; finish(); }
      // 状态
      const jk = (G.t - P.jumpT) / JUMP; P.h = jk >= 0 && jk < 1 ? Math.sin(jk * Math.PI) * 1.25 : 0;
      const air = P.h > .3 || !!(b && b.air), low = G.t - P.squatT < .85 || !!(b && b.crouch);
      // 物体
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        o.z += (P.speed + (o.knocked ? o.fly.vz : o.walk || 0)) * dt; o.g.position.z = o.z;
        if (o.kind === 'zombie') {
          if (o.knocked) { const f = o.fly; f.t += dt; f.vy -= 22 * dt; o.g.position.x += f.vx * dt; o.g.position.y = Math.max(-3, o.g.position.y + f.vy * dt); o.g.rotation.x -= 9 * dt; o.g.rotation.z += f.vx * .6 * dt; if (f.t > 2.2) o.dead = true; }
          else if (o.flee) { o.g.position.x += (o.lane || 1) * 6 * dt; o.g.rotation.z -= (o.lane || 1) * 3 * dt; o.g.position.y -= 2 * dt; }
          else { const tt = G.t * 8 + o.ph; o.body.position.y = Math.abs(Math.sin(tt)) * .07; o.body.rotation.z = Math.sin(tt * .5) * .07; o.head.rotation.z = Math.sin(tt * .5 + 1) * .12; }
        } else if (o.kind === 'coin') o.g.rotation.y += dt * 4;
        else if (o.kind === 'bar') o.g.balloons.forEach(bl => { bl.rotation.z = Math.sin(G.t * 2.5 + bl.ph) * .12; });
        else if (o.kind === 'gate') o.g.curtain.material.opacity += ((o.ev.judged ? .05 : .16 + Math.sin(G.t * 5) * .06) - o.g.curtain.material.opacity) * Math.min(1, dt * 3);
        if (!o.passed && o.z >= o.hitZ) { o.passed = true; pass(o, air, low); }
        if (o.dead || o.z > 8) { remove(o); objs.splice(i, 1); }
      }
      for (let i = debris.length - 1; i >= 0; i--) { const p = debris[i]; p.life -= dt; p.vy -= 20 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += (p.vz + P.speed) * dt; p.m.rotation.x += p.rx * dt; p.m.rotation.y += p.ry * dt; p.m.rotation.z += p.rz * dt; if (p.life <= 0) { scene.remove(p.m); debris.splice(i, 1); } }
      // 动作提示：离到达还有 ~1.75 秒时出现
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i], o = ev.objs[0]; if (!o || o.z > 2) { events.splice(i, 1); continue; }
        if (!ev.cued && -o.z / Math.max(4, P.speed) < (ev.quiz ? 2.4 : 1.75)) { ev.cued = true; cue(ev.act); }
      }
      // 镜头：换道平移 + 跑步颠簸 + 跳 / 蹲 + 晃动
      const tx = P.lane * LANE; P.x += (tx - P.x) * Math.min(1, dt * 9);
      P.cy += ((low ? LOW_Y : CAM_Y) - P.cy) * Math.min(1, dt * 12);
      P.phase += dt * (6 + P.speed * .45);
      const bob = P.h > 0 ? 0 : Math.sin(P.phase) * .05 * U.clamp(P.speed / 10, .3, 1.6);
      flash = Math.max(0, flash - dt * 1.8); shake = Math.max(0, shake - dt * 2.4);
      const sx = shake ? U.rand(-1, 1) * shake * .18 : 0, sy = shake ? U.rand(-1, 1) * shake * .14 : 0;
      cam.position.set(P.x + sx, P.cy + P.h + bob + sy, 0);
      cam.lookAt(P.x * .9, P.cy + P.h * .6 - .4, -18);
      cam.rotation.z += (P.x - tx) * .025 + Math.sin(P.phase * .5) * .005;
      const fov = 62 + Math.max(0, P.speed - 8) * .55 + (G.t < P.boostT ? 6 : 0);
      if (Math.abs(cam.fov - fov) > .05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
      T3.render(); overlay(dt); hud(dt);
    }

    // 先摆一帧静止画面给倒计时看
    cam.position.set(0, CAM_Y, 0); cam.lookAt(0, CAM_Y - .4, -18); T3.render();


    return {
      go() {
        if (!quiz) G.hud.hearts(3, 3); Core.Audio2.playMusic('race');
        G.onDispose(() => Core.Audio2.stopMusic());
        G.on('punch', e => punch(e.hand));
        G.on('jump', () => { if (G.t - P.jumpT > JUMP * .8) { P.jumpT = G.t; G.sfx('whoosh', .4); } });
        G.on('squat', () => { P.squatT = G.t; G.sfx('whoosh', .3); });
        G.on('step', () => { P.energy = Math.min(1, P.energy + .05); });
        G.say('原地跑步可以加速哦！');
        spawnAction('zombie', -58); lastKind = 'zombie'; seqI = 1; sinceQuiz = 1;
        G.loop(frame);
      },
    };
  }

  M.game({
    id: 'run', name: '体感酷跑', icon: '🏃', color: '#3fc06a', tag: '复刻', demo: 'run',
    short: '出拳打僵尸、跳过地刺、蹲下钻杆，原地跑释放电量！',
    desc: '在草地赛道上奔跑！左右移动换跑道，看到提示就出拳、跳起来或者蹲下。原地跑得越快速度越快。知识模式里跑进写着正确答案的门！',
    origin: '致敬抖音「释放电量」体感酷跑：第一人称草地赛道、举纱门的小僵尸要出拳打飞、地刺要跳、横杆要蹲，顶部白色圆形动作图标 + 紫色标签提示。',
    how: [['punch', '打飞拦路僵尸'], ['jump', '跳过地刺'], ['squat', '蹲下钻过横杆'], ['lanes', '左右移动换跑道'], ['run', '原地跑加速']],
    modes: [{ id: 'quiz', name: '知识跑酷', icon: '🧠', desc: '跑进正确答案的门，答完 8 题' }, { id: 'endless', name: '无尽挑战', icon: '♾️', desc: '越跑越快，撞 3 次结束' }],
    qOpts: { maxLen: 5, maxCh: 3 },
    sayHow: '看到提示就出拳、跳起来或者蹲下，左右移动换跑道',
    async preload() { if (window.Models) await Models.ready(); },
    beforeCountdown(G) { G._run = build(G); },
    start(G) { (G._run || (G._run = build(G))).go(); },
    onPause(G, on) { const a = Core.Audio2.music; if (!a) return; try { if (on) a.pause(); else { const p = a.play(); if (p && p.catch) p.catch(() => {}); } } catch (e) {} },
  });
})();
