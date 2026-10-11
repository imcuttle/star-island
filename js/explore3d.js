/* 出门探索 · 3D 怪盗风（三渲二描边 + 红黑白 UI）
   · 第三人称自由行走：WASD / 方向键 移动，Shift 冲刺，拖动转视角，滚轮拉近，点地面自动走过去
   · 地点互动、伙伴聊天、宝箱（金色宝箱要答题开锁）
   · 潜行：暗影带着视野巡逻，被看到会出现「？」→「！」并追过来；从背后靠近按 E 突袭 = 先制攻击
   · 躲藏：靠近掩体按 空格 躲起来，暗影看不见你；躲着时暗影走近可以「跳跃突袭」
   · 第三只眼：按住 Q（或点按钮），世界变灰，宝物 / 暗影强弱 / 视野一览无余
   · 警戒度：被发现、被偷袭会上升，100% 会被赶出去；突袭成功、打赢会下降 */
(function () {
  const { h, sleep, esc, Store, Audio2, E, hydrate, UI } = Core;
  const R = CONTENT.R;
  const P = () => Store.p, save = () => Store.save();
  const X = {};
  let T = null;
  X.supported = () => !window.__TEST_LITE && !!(window.Avatar3D && Avatar3D.supported());

  /* ================= 场景主题 ================= */
  const TH = {
    town: { sky: [0x1d1650, 0xff7a4a], fog: [0x6a4a6a, 30, 110], ground: 0x55663f, road: 0x8f877a, walk: 0xb9ad98, hemi: [0xffd8c0, 0x3a2a4a, 1.05], sun: [0xffb080, 2.1, [-30, 22, 18]], night: .35, tex: 'cobble',
      walls: [0xe8d8c0, 0xd8a890, 0xc8d0d8, 0xe0c8a0, 0xb8c8a8, 0xf0e0d0], roofs: [0xa83a32, 0x34466a, 0x6a3a2a, 0x2a5a4a, 0x8a2a3a], parts: 'petal', moon: 0 },
    city: { sky: [0x05030f, 0x4a0a40], fog: [0x1a0a24, 22, 95], ground: 0x2a2830, road: 0x1b1a20, walk: 0x3d3a44, hemi: [0x7a80ff, 0x200818, .85], sun: [0xff9ad0, 1.0, [20, 30, 25]], night: 1, tex: 'asphalt',
      walls: [0x2a2e3a, 0x3a3446, 0x22303a, 0x40363a, 0x302a40], neon: [0xff2a6a, 0x2ae0ff, 0xffe23a, 0xb04aff], parts: 'none', moon: 1 },
    forest: { sky: [0x02060e, 0x12352c], fog: [0x0a1a16, 12, 62], ground: 0x1d3a22, road: 0x4a3a28, walk: 0x2a4a2a, hemi: [0x90c0ff, 0x0a1a0a, .75], sun: [0xa0c0ff, 1.2, [10, 30, -10]], night: .9, tex: 'dirt', parts: 'firefly', moon: 1 },
    beach: { sky: [0x2a2a7a, 0xffa060], fog: [0xe8a888, 40, 150], ground: 0xe6cf98, road: 0xa87a4a, walk: 0xdcc088, hemi: [0xfff0e0, 0x806040, 1.25], sun: [0xffc890, 2.3, [-30, 18, -30]], night: .2, tex: 'plank', parts: 'none', moon: 0, sea: true },
    tower: { sky: [0x000000, 0x3a0006], fog: [0x22000a, 18, 75], ground: 0x111111, road: 0x9a0012, walk: 0x1a1a1a, hemi: [0xffc8c8, 0x200000, .85], sun: [0xff7070, 1.4, [10, 30, 20]], night: 1, tex: 'checker', parts: 'ember', moon: 2, palace: true },
  };

  /* ================= 材质 / 几何小工具 ================= */
  const grads = {};
  function gradTex(n) { if (grads[n]) return grads[n]; const d = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { const v = Math.round(80 + 175 * i / (n - 1)); d.set([v, v, v, 255], i * 4); } const t = new T.DataTexture(d, n, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return (grads[n] = t); }
  let OLM = null; const mc = new Map();
  function mat(col, o) {
    o = o || {}; const k = !o.map && !o.emissive && !o.transparent ? col + '|' + (o.flat ? 1 : 0) : null;
    if (k && mc.has(k)) return mc.get(k);
    const m = new T.MeshToonMaterial(Object.assign({ color: col, gradientMap: gradTex(3) }, o.map ? { map: o.map } : {}, o.emissive != null ? { emissive: o.emissive, emissiveIntensity: o.ei == null ? 1 : o.ei } : {}, o.emissiveMap ? { emissiveMap: o.emissiveMap } : {}, o.transparent ? { transparent: true, opacity: o.opacity, depthWrite: o.depthWrite !== false } : {}));
    if (o.side) m.side = o.side;
    if (k) mc.set(k, m); return m;
  }
  const glow = (col, op) => new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op == null ? .9 : op, blending: T.AdditiveBlending, depthWrite: false, fog: false });
  function outline(m, t) {
    const g = m.geometry; g.computeBoundingBox(); const s = g.boundingBox.getSize(new T.Vector3());
    const ol = new T.Mesh(g, OLM); ol.scale.set(1 + 2 * t / Math.max(s.x, .05), 1 + 2 * t / Math.max(s.y, .05), 1 + 2 * t / Math.max(s.z, .05));
    ol.castShadow = false; ol.receiveShadow = false; ol.userData.ol = 1; m.add(ol);
  }
  function mesh(par, geo, material, x, y, z, o) {
    o = o || {}; const m = new T.Mesh(geo, material); m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
    if (o.ol !== false) outline(m, o.olw || .06);
    if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
    par.add(m); return m;
  }
  const box = (par, w, hh, d, col, x, y, z, o) => mesh(par, new T.BoxGeometry(w, hh, d), typeof col === 'number' ? mat(col, o) : col, x, (y || 0) + hh / 2, z, o);
  const cyl = (par, r0, r1, hh, col, x, y, z, o) => mesh(par, new T.CylinderGeometry(r0, r1, hh, (o && o.seg) || 12), typeof col === 'number' ? mat(col, o) : col, x, (y || 0) + hh / 2, z, o);
  function canvasTex(w, hh, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = hh; draw(c.getContext('2d'), w, hh); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  // 怪盗风招牌：斜切底 + 粗体字
  function signTex(text, bg, fg, vert) {
    const W = vert ? 128 : 512, H = vert ? 512 : 128;
    return canvasTex(W, H, (x) => {
      x.fillStyle = bg; x.beginPath(); if (vert) { x.moveTo(10, 0); x.lineTo(W, 14); x.lineTo(W - 10, H); x.lineTo(0, H - 14); } else { x.moveTo(14, 4); x.lineTo(W, 0); x.lineTo(W - 14, H); x.lineTo(0, H - 6); } x.fill();
      x.strokeStyle = fg; x.lineWidth = 6; x.stroke();
      x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (vert) { const cs = Array.from(text).slice(0, 5), fs = Math.min(96, 460 / cs.length); x.font = '900 ' + fs + "px 'ZK','PingFang SC',sans-serif"; cs.forEach((c, i) => x.fillText(c, W / 2, H / 2 + (i - (cs.length - 1) / 2) * fs * 1.02)); }
      else { const fs = Math.min(84, 900 / Math.max(2, Array.from(text).length)); x.font = '900 ' + fs + "px 'ZK','PingFang SC',sans-serif"; x.fillText(text, W / 2, H / 2 + 4); }
    });
  }
  function winTex(lit, night, base) {
    return canvasTex(128, 256, (x, W, H) => {
      x.fillStyle = base; x.fillRect(0, 0, W, H);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const on = Math.random() < lit; x.fillStyle = on ? (night > .5 ? R.pick(['#ffe8a0', '#bfe8ff', '#ffd0f0', '#fff4c8']) : '#cfe6ff') : 'rgba(10,10,20,.85)'; x.fillRect(10 + c * 29, 10 + r * 30, 20, 20); }
    });
  }
  function groundTex(kind, col) {
    const c = hex(col);
    return canvasTex(256, 256, (x, W, H) => {
      x.fillStyle = c; x.fillRect(0, 0, W, H);
      if (kind === 'cobble') { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; for (let r = 0; r < 8; r++) for (let k = 0; k < 6; k++) { x.beginPath(); x.ellipse(k * 46 + (r % 2) * 23, r * 34 + 16, 20, 14, 0, 0, 7); x.stroke(); } }
      if (kind === 'asphalt') { for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(255,255,255,' + Math.random() * .06 + ')'; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); } }
      if (kind === 'dirt') { for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(0,0,0,' + Math.random() * .2 + ')'; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 0, 7); x.fill(); } }
      if (kind === 'plank') { x.strokeStyle = 'rgba(40,20,0,.5)'; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, H); x.stroke(); } }
      if (kind === 'checker') { for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { x.fillStyle = (r + k) % 2 ? '#0c0c0c' : '#5a0010'; x.fillRect(k * 64, r * 64, 64, 64); } x.strokeStyle = '#c8a040'; x.lineWidth = 2; x.strokeRect(0, 0, W, H); }
    }, [1, 1]);
  }

  /* ================= 场景搭建 ================= */
  // 坐标：主街沿 X 轴（0..LX），车道 |z|<3，人行道 3<|z|<7.2；-z 侧是建筑立面（z=-8），+z 侧是矮小的街景
  function buildScene(sc, id, S, p, th) {
    const W = { occ: [], boxes: [], circles: [], covers: [], chests: [], rects: [], anim: [], spotPos: {}, pick: [], LX: Math.max(48, S.spots.length * 8 + 12) };
    const LX = W.LX, night = th.night;
    const world = new T.Group(); sc.add(world);
    // 天空 + 月亮 + 星星
    const sky = new T.Mesh(new T.SphereGeometry(240, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new T.Color(th.sky[0]) }, bot: { value: new T.Color(th.sky[1]) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+.1,0.,1.); gl_FragColor = vec4(mix(bot, top, pow(h,.7)),1.); }' }));
    sc.add(sky); W.sky = sky;
    if (night > .3) { const g = new T.BufferGeometry(), n = 600, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * 7, b = .15 + Math.random() * 1.2; pos.set([Math.cos(a) * Math.cos(b) * 220, Math.sin(b) * 220, Math.sin(a) * Math.cos(b) * 220], i * 3); } g.setAttribute('position', new T.BufferAttribute(pos, 3)); sky.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: night }))); }
    if (th.moon) {
      const mt = canvasTex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 30, 128, 128, 128); const c = th.moon === 2 ? ['#ffe0e0', 'rgba(255,40,60,.6)'] : ['#fffbe8', 'rgba(200,220,255,.35)']; g.addColorStop(0, c[0]); g.addColorStop(.33, c[0]); g.addColorStop(.36, c[1]); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); });
      const moon = new T.Sprite(new T.SpriteMaterial({ map: mt, fog: false, depthWrite: false, transparent: true })); moon.scale.set(60, 60, 1); moon.position.set(-40, 80, -170); sky.add(moon);
    }
    // 地面 / 道路 / 人行道
    let gm = mat(th.ground); if (th.tex === 'checker') { const gt = groundTex('checker', th.ground); gt.repeat.set(60, 60); gm = mat(0xffffff, { map: gt }); }
    const ground = mesh(world, new T.PlaneGeometry(400, 400), gm, LX / 2, 0, 0, { ol: false, cast: false, rx: -Math.PI / 2 });
    const rt = groundTex(th.tex, th.road); rt.repeat.set((LX + 40) / 4, 1.5);
    mesh(world, new T.PlaneGeometry(LX + 40, 6), mat(0xffffff, { map: rt }), LX / 2, .02, 0, { ol: false, cast: false, rx: -Math.PI / 2 });
    [-1, 1].forEach(sd => { const b = box(world, LX + 40, .14, 4.2, th.walk, LX / 2, 0, sd * 5.1, { ol: false, cast: false }); b.receiveShadow = true; box(world, LX + 40, .16, .25, th.palace ? 0xc8a040 : 0x6a6a6a, LX / 2, 0, sd * 3.05, { ol: false, cast: false }); });
    W.ground = ground;
    // 路面装饰
    if (id === 'city') { for (let x = 2; x < LX; x += 4) box(world, 1.8, .03, .18, 0xffe23a, x, .03, 0, { ol: false, cast: false }); const cx = LX * .5; [cx - 7, cx + 7].forEach(x0 => { for (let i = 0; i < 6; i++) box(world, 3.2, .03, .5, 0xf2f2f2, x0, .03, -2.5 + i, { ol: false, cast: false }); }); }
    if (th.palace) { [-1, 1].forEach(sd => box(world, LX + 40, .04, .2, 0xe8c050, LX / 2, .02, sd * 2.7, { ol: false, cast: false })); }
    if (id === 'town') for (let x = 3; x < LX; x += 6) box(world, 2, .02, .2, 0xffffff, x, .03, 0, { ol: false, cast: false });

    const spotX = s => 5 + s.x * (LX - 10);
    const sideOf = s => /shop|quiz|photo/.test(s.act) ? -1 : 1;
    const busy = [];
    S.spots.forEach(s => { const sd = sideOf(s), x = spotX(s); W.spotPos[s.id] = new T.Vector3(x, 0, sd < 0 ? -6.2 : 5.2); busy.push([x, sd]); });
    const nearSpot = (x, sd, r) => busy.some(([bx, bs]) => bs === sd && Math.abs(bx - x) < r);

    /* ---- -z 侧：建筑立面 ---- */
    const facade = (x0, w) => {
      const hh = th.palace ? 11 : id === 'city' ? 9 + Math.random() * 16 : id === 'town' ? 4.5 + Math.random() * 3 : 0;
      if (id === 'town') {
        const col = R.pick(th.walls), d = 7, z = -8 - d / 2, wt = winTex(.5, night, hex(col));
        const b = mesh(world, new T.BoxGeometry(w - .3, hh, d), [mat(col), mat(col), mat(col), mat(col), mat(0xffffff, { map: wt, emissive: 0xffd890, emissiveMap: wt, ei: night * .9 }), mat(col)], x0 + w / 2, hh / 2, z);
        void b;
        const sh = new T.Shape(); sh.moveTo(-d / 2 - .4, 0); sh.lineTo(0, 2.4); sh.lineTo(d / 2 + .4, 0); sh.closePath();
        const rg = new T.ExtrudeGeometry(sh, { depth: w - .1, bevelEnabled: false }); rg.center();
        mesh(world, rg, mat(R.pick(th.roofs)), x0 + w / 2, hh + 1.2, z, { ry: Math.PI / 2 });
        W.rects.push([x0, x0 + w, -8 - d, -8, 0x6a5a50]);
      } else if (id === 'city') {
        const col = R.pick(th.walls), d = 9, z = -8 - d / 2, wt = winTex(.55, 1, hex(col)); wt.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(hh / 8)));
        mesh(world, new T.BoxGeometry(w - .4, hh, d), [mat(col), mat(col), mat(0x14141a), mat(col), mat(0xffffff, { map: wt, emissive: 0xffffff, emissiveMap: wt, ei: .9 }), mat(col)], x0 + w / 2, hh / 2, z);
        if (Math.random() < .7) { const nc = R.pick(th.neon), txt = R.pick(['星星', '怪盗', 'GAME', 'CAFE', '书店', '电玩', '拉面', 'KARAOKE', '影']); const sg = new T.Mesh(new T.PlaneGeometry(1.1, 4.2), new T.MeshBasicMaterial({ map: signTex(txt, '#000', hex(nc), true), transparent: true, fog: false })); sg.position.set(x0 + .9, 4 + Math.random() * 4, -7.4); sg.rotation.y = Math.PI / 2 * .0; world.add(sg); W.anim.push({ k: 'neon', o: sg, s: Math.random() * 6 }); }
        // 底商发光带
        box(world, w - .6, .5, .2, R.pick(th.neon), x0 + w / 2, 3.2, -7.95, { ol: false, emissive: R.pick(th.neon), ei: 1.2 });
        W.rects.push([x0, x0 + w, -8 - d, -8, 0x3a3a50]);
      } else if (id === 'forest') {
        for (let i = 0; i < 3; i++) pine(world, x0 + Math.random() * w, -9 - Math.random() * 6, 1.3 + Math.random() * .8);
        W.rects.push([x0, x0 + w, -16, -8, 0x1a3a1a]);
      } else if (id === 'beach') {
        if (Math.random() < .5) palm(world, x0 + w / 2, -9.5);
        W.rects.push([x0, x0 + w, -16, -9, 0x3a8ac8]);
      } else if (th.palace) {
        const d = 2, z = -9.5;
        box(world, w, hh, d, 0x1a0a0e, x0 + w / 2, 0, z, { olw: .04 });
        pillar(world, x0 + .6, -8.2, hh);
        if (w > 5) painting(world, x0 + w / 2, 4.6, -8.45, Math.min(w - 2.4, 4.4), 3.2);
        box(world, w, .6, d + .4, 0xc8a040, x0 + w / 2, hh - .6, z, { ol: false });
        W.rects.push([x0, x0 + w, -10.5, -8.5, 0x5a0010]);
      }
    };
    for (let x = -14; x < LX + 14;) { const w = id === 'city' ? 6 + Math.random() * 4 : th.palace ? 6 : 5 + Math.random() * 3; facade(x, w); x += w; }
    W.boxes.push({ x0: -50, x1: LX + 50, z0: -60, z1: th.palace ? -8.4 : -8 });
    if (id === 'beach') { // 海
      const g = new T.PlaneGeometry(LX + 160, 120, 90, 50); g.rotateX(-Math.PI / 2); const base = g.attributes.position.array.slice();
      const sea = mesh(world, g, mat(0x2a7ab8, { transparent: true, opacity: .93 }), LX / 2, -.25, -70, { ol: false, cast: false });
      sea.material.flatShading = true; W.anim.push({ k: 'sea', o: sea, base });
      box(world, LX + 160, .1, 1.2, 0xffffff, LX / 2, -.1, -9.6, { ol: false, cast: false, transparent: true, opacity: .7 });
      lighthouse(world, LX * .78, -26);
    }
    /* ---- +z 侧：远处的楼 + 路边小品 ---- */
    if (id === 'town' || id === 'city') for (let x = -20; x < LX + 20;) { const w = 6 + Math.random() * 5, hh = id === 'city' ? 10 + Math.random() * 22 : 5 + Math.random() * 4, col = R.pick(th.walls); const wt = winTex(.4, night, hex(col)); wt.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(hh / 8))); mesh(world, new T.BoxGeometry(w - .5, hh, 8), [mat(col), mat(col), mat(col), mat(col), mat(col), mat(0xffffff, { map: wt, emissive: 0xffffff, emissiveMap: wt, ei: night * .8 })], x + w / 2, hh / 2, 26, { olw: .08 }); x += w; }
    if (id === 'forest' || id === 'beach' || id === 'town') for (let x = -10; x < LX + 10; x += 3 + Math.random() * 3) { const z = 19 + Math.random() * 12; if (id === 'forest') W.occ.push(pine(world, x, z, 1 + Math.random() * .9)); else if (id === 'beach') { if (Math.random() < .5) W.occ.push(palm(world, x, z)); } else if (Math.random() < .4) W.occ.push(roundTree(world, x, z, 1 + Math.random() * .4)); }
    if (th.palace) { for (let x = -10; x < LX + 10; x += 6) W.occ.push(pillar(world, x, 9.5, 11)); box(world, LX + 60, 14, 1, 0x1a0a0e, LX / 2, 0, 30, {}); for (let x = 4; x < LX; x += 10) chandelier(world, x, 0); }
    // 路灯 / 树 / 栏杆
    for (let x = 4; x < LX; x += 10) [-1, 1].forEach(sd => { if (nearSpot(x, sd, 3)) return; const o = th.palace ? candle(world, x, sd * 7.2) : id === 'forest' ? (sd > 0 ? lantern(world, x, 7.4) : null) : lamp(world, x, sd * 7.4, sd); if (o) W.occ.push(o); });
    if (id === 'town') for (let x = 9; x < LX; x += 10) if (!nearSpot(x, 1, 3)) W.occ.push(roundTree(world, x, 7.6, .9));
    if (id === 'forest') for (let x = 2; x < LX; x += 3.4) { [-1, 1].forEach(sd => { if (!nearSpot(x, sd, 2.4) && Math.random() < .55) { const m = mushroom(world, x + Math.random(), sd * (7.6 + Math.random() * 1.5)); void m; } }); }

    /* ---- 地点地标 ---- */
    S.spots.forEach(s => { const v = W.spotPos[s.id], sd = v.z < 0 ? -1 : 1; const g = new T.Group(); g.position.set(v.x, 0, sd < 0 ? -8 : s.act === 'wish' ? 8.9 : 8.6); world.add(g); landmark(g, s, sd, id, th, W); g.traverse(o => { if (o.isMesh) o.userData.spot = s.id; }); W.pick.push(g); W.occ.push(g); });
    /* ---- 掩体 ---- */
    const SLOT = [.3, .62, .86, .46];
    SLOT.forEach((f, i) => { const x = 5 + f * (LX - 10); [[-3.2, i % 2 ? 4.6 : -4.7], [3.4, i % 2 ? -4.7 : 4.6]].forEach(([dx, z]) => { const cx = x + dx; if (busy.some(([bx]) => Math.abs(bx - cx) < 2.2)) return; cover(world, cx, z, id, th); W.covers.push({ x: cx, z, r: 1.1 }); W.circles.push({ x: cx, z, r: 1 }); }); });
    /* ---- 宝箱 ---- */
    [[.48, -7.95, 0], [.97, 8.3, 1], [.05, 8.3, 0]].forEach(([f, z, gold], i) => { const x = 3 + f * (LX - 6); if (busy.some(([bx]) => Math.abs(bx - x) < 2)) return; const c = chest(world, x, z, gold, z < 0); W.chests.push({ i, x, z, gold, g: c, open: !!p.hm.spots[id + ':chest' + i] }); W.circles.push({ x, z, r: z < 0 ? .5 : .8 }); c.traverse(o => { if (o.isMesh) o.userData.chest = i; }); W.pick.push(c); });
    W.chests.forEach(c => { if (c.open) c.g.userData.lid.rotation.x = -1.9; });
    /* ---- 出口 ---- */
    const ex = new T.Group(); ex.position.set(1.4, 0, 0); world.add(ex);
    const ring = new T.Mesh(new T.RingGeometry(1, 1.35, 40), glow(0xe60012, .85)); ring.rotation.x = -Math.PI / 2; ring.position.y = .06; ex.add(ring); W.anim.push({ k: 'spin', o: ring, s: 1.2 });
    const sg = new T.Mesh(new T.PlaneGeometry(3, .75), new T.MeshBasicMaterial({ map: signTex('出口 EXIT', '#e60012', '#fff'), transparent: true, side: T.DoubleSide })); sg.position.set(0, 3.2, 0); sg.rotation.y = Math.PI / 2; ex.add(sg); W.anim.push({ k: 'bob', o: sg, y: 3.2 });
    W.exit = new T.Vector3(1.4, 0, 0);
    /* ---- 粒子 ---- */
    if (th.parts !== 'none') {
      const n = th.parts === 'petal' ? 160 : 220, g = new T.BufferGeometry(), pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set([Math.random() * (LX + 20) - 10, Math.random() * 9, (Math.random() - .5) * 24], i * 3);
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      const col = th.parts === 'petal' ? 0xffb8d0 : th.parts === 'firefly' ? 0xd8ff7a : 0xff3a2a;
      const pts = new T.Points(g, new T.PointsMaterial({ color: col, size: th.parts === 'petal' ? .16 : .12, transparent: true, opacity: .9, blending: th.parts === 'petal' ? T.NormalBlending : T.AdditiveBlending, depthWrite: false }));
      world.add(pts); W.anim.push({ k: 'parts', o: pts, kind: th.parts, LX });
    }
    // 边界
    W.bounds = { x0: .6, x1: LX - .6, z0: -6.7, z1: 6.9 };
    return W;
  }

  /* ---- 小品 ---- */
  function pine(P0, x, z, s) { const par = new T.Group(); P0.add(par); const c = [0x1f5a3a, 0x2a6a40, 0x184a30][Math.floor(Math.random() * 3)]; cyl(par, .18 * s, .28 * s, 1.4 * s, 0x5a3a22, x, 0, z, { seg: 6 }); for (let k = 0; k < 3; k++) mesh(par, new T.ConeGeometry((1.6 - k * .4) * s, 1.9 * s, 8), mat(c), x, (1.6 + k * 1.1) * s, z);  return par; }
  function roundTree(P0, x, z, s) { const par = new T.Group(); P0.add(par); cyl(par, .16 * s, .24 * s, 1.6 * s, 0x6a4a2a, x, 0, z, { seg: 6 }); mesh(par, new T.IcosahedronGeometry(1.3 * s, 0), mat(R.pick([0x4a8a3a, 0x5a9a42, 0xd87a9a])), x, 2.4 * s, z);  return par; }
  function palm(P0, x, z) { const par = new T.Group(); P0.add(par); const g = new T.Group(); g.position.set(x, 0, z); par.add(g); let px = 0, py = 0; for (let i = 0; i < 6; i++) { const m = cyl(g, .16, .2, 1, 0x9a7a4a, px, py, 0, { seg: 6 }); m.rotation.z = -i * .06; px += i * .06; py += .98; } for (let i = 0; i < 6; i++) { const lf = mesh(g, new T.ConeGeometry(.35, 2.6, 4), mat(0x2f8a3a), px, py, 0); lf.rotation.set(Math.PI / 2 - .5, i / 6 * Math.PI * 2, 0, 'YXZ'); lf.position.add(new T.Vector3(Math.sin(i / 6 * 7) * 1, -.3, Math.cos(i / 6 * 7) * 1)); }  return par; }
  function lamp(P0, x, z, sd) { const par = new T.Group(); P0.add(par); cyl(par, .07, .1, 4, 0x2a2a2a, x, 0, z, { seg: 6 }); box(par, .14, .14, 1, 0x2a2a2a, x, 3.9, z - sd * .4); mesh(par, new T.SphereGeometry(.2, 10, 8), glow(0xffe0a0, 1), x, 3.75, z - sd * .85, { ol: false, cast: false });  return par; }
  function lantern(P0, x, z) { const par = new T.Group(); P0.add(par); cyl(par, .06, .06, 2.2, 0x3a2a1a, x, 0, z, { seg: 5 }); mesh(par, new T.SphereGeometry(.28, 10, 8), glow(0xffa040, 1), x, 2.3, z, { ol: false, cast: false });  return par; }
  function candle(P0, x, z) { const par = new T.Group(); P0.add(par); cyl(par, .3, .4, 1.6, 0xc8a040, x, 0, z, { seg: 8 }); mesh(par, new T.ConeGeometry(.12, .35, 6), glow(0xff8030, 1), x, 1.8, z, { ol: false, cast: false });  return par; }
  function mushroom(par, x, z) { cyl(par, .06, .08, .35, 0xf0e8d0, x, 0, z, { seg: 6, ol: false }); return mesh(par, new T.SphereGeometry(.22, 10, 6, 0, 7, 0, 1.6), new T.MeshToonMaterial({ color: 0x40e0ff, emissive: 0x20a0ff, emissiveIntensity: 1.1, gradientMap: gradTex(3) }), x, .32, z, { olw: .03 }); }
  function pillar(P0, x, z, hh) { const par = new T.Group(); P0.add(par); box(par, 1.3, .5, 1.3, 0xc8a040, x, 0, z); cyl(par, .45, .5, hh - 1, 0xe8d8c0, x, .5, z, { seg: 14 }); box(par, 1.3, .5, 1.3, 0xc8a040, x, hh - .5, z);  return par; }
  function painting(par, x, y, z, w, hh) {
    box(par, w + .4, hh + .4, .2, 0xc8a040, x, y - (hh + .4) / 2, z, { ol: false });
    const t = canvasTex(256, 192, (c) => { c.fillStyle = '#100'; c.fillRect(0, 0, 256, 192); for (let i = 0; i < 9; i++) { c.fillStyle = R.pick(['#e60012', '#000', '#fff', '#5a0010']); c.beginPath(); c.moveTo(Math.random() * 256, Math.random() * 192); for (let k = 0; k < 3; k++) c.lineTo(Math.random() * 256, Math.random() * 192); c.fill(); } c.fillStyle = '#fff'; c.beginPath(); c.arc(128, 90, 30, 0, 7); c.fill(); c.fillStyle = '#000'; c.fillRect(110, 80, 12, 8); c.fillRect(134, 80, 12, 8); });
    const pl = new T.Mesh(new T.PlaneGeometry(w, hh), new T.MeshBasicMaterial({ map: t })); pl.position.set(x, y, z + .12); par.add(pl);
  }
  function chandelier(par, x, z) { const g = new T.Group(); g.position.set(x, 8.2, z); par.add(g); const r = new T.Mesh(new T.TorusGeometry(1.2, .08, 6, 24), mat(0xc8a040)); r.rotation.x = Math.PI / 2; g.add(r); for (let i = 0; i < 8; i++) { const a = i / 8 * 7; const b = new T.Mesh(new T.SphereGeometry(.12, 8, 6), glow(0xffd080, 1)); b.position.set(Math.cos(a) * 1.2, .15, Math.sin(a) * 1.2); g.add(b); } cyl(g, .03, .03, 3, 0xc8a040, 0, 0, 0, { ol: false, seg: 4 }); }
  function lighthouse(par, x, z) { for (let k = 0; k < 6; k++) cyl(par, 1.6 - k * .14, 1.7 - k * .14, 2, k % 2 ? 0xffffff : 0xd8303a, x, k * 2, z, { seg: 16 }); cyl(par, 1, 1, 1.4, 0xfff0a0, x, 12, z, { seg: 12, emissive: 0xffd040, ei: 1 }); mesh(par, new T.ConeGeometry(1.3, 1.4, 12), mat(0x2a2a3a), x, 14.1, z); }
  function cover(par, x, z, id, th) {
    if (id === 'city') { if (Math.random() < .5) { const g = new T.Group(); g.position.set(x, 0, z); par.add(g); box(g, 2.6, .9, 1.4, R.pick([0xd8303a, 0x2a6ad8, 0xf0f0f0]), 0, .3, 0); box(g, 1.4, .6, 1.2, 0x223, -.1, 1.2, 0); [[-.8, .65], [.8, .65], [-.8, -.65], [.8, -.65]].forEach(([a, b]) => { const w = cyl(g, .3, .3, .2, 0x111111, a, .3, b, { seg: 10 }); w.rotation.x = Math.PI / 2; w.position.y = .3; }); } else { box(par, 1.1, 2, .9, 0xd8303a, x, 0, z); box(par, .9, 1.2, .05, 0xffffff, x, .6, z + .46 * Math.sign(-z || 1), { ol: false, emissive: 0xaee8ff, ei: .8 }); } }
    else if (id === 'forest' || id === 'beach') mesh(par, new T.DodecahedronGeometry(1, 0), mat(id === 'beach' ? 0x9a8a7a : 0x5a6a5a), x, .6, z, { ry: Math.random() * 3 }).scale.set(1.1, .85, 1);
    else if (th.palace) { box(par, 1, .4, 1, 0xc8a040, x, 0, z); mesh(par, new T.CylinderGeometry(.35, .45, 1.6, 10), mat(0xe8e0d8), x, 1.2, z); mesh(par, new T.SphereGeometry(.42, 12, 10), mat(0xe8e0d8), x, 2.3, z); }
    else { box(par, 1, 1, 1, 0xb07a45, x - .5, 0, z); box(par, 1, 1, 1, 0xa06a3a, x + .55, 0, z + .1); box(par, 1, 1, 1, 0xb88250, x, 1, z - .05); }
  }
  function chest(par, x, z, gold, back) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = back ? 0 : Math.PI; par.add(g);
    const c = gold ? 0xe8b830 : 0x8a4a22, t = gold ? 0xfff0a0 : 0xd8a040;
    box(g, 1.1, .55, .7, c, 0, 0, 0); box(g, 1.14, .08, .74, t, 0, .4, 0, { ol: false });
    const lid = new T.Group(); lid.position.set(0, .55, -.35); g.add(lid);
    const lg = new T.CylinderGeometry(.35, .35, 1.1, 12, 1, false, 0, Math.PI); lg.rotateZ(Math.PI / 2); lg.translate(0, 0, .35);
    mesh(lid, lg, mat(c), 0, 0, 0, { olw: .04 });
    box(g, .2, .26, .06, gold ? 0x222222 : t, 0, .3, .37, { ol: false });
    if (gold) { const gl = new T.Mesh(new T.SphereGeometry(1.1, 12, 8), glow(0xffd040, .12)); gl.position.y = .5; g.add(gl); }
    g.userData.lid = lid; return g;
  }
  function landmark(g, s, sd, id, th, W) {
    const face = sd < 0 ? 0 : Math.PI;
    const signAt = (txt, y, bg, fg) => { const m = new T.Mesh(new T.PlaneGeometry(3.4, .85), new T.MeshBasicMaterial({ map: signTex(txt, bg || '#000', fg || '#fff'), transparent: true })); m.position.set(0, y, .3 * -sd); m.rotation.y = face; g.add(m); };
    if (s.act === 'shop' || s.act === 'quiz' || s.act === 'photo') {
      if (id === 'forest' || id === 'beach') { // 小木屋
        box(g, 3.6, 2.6, 2.6, id === 'beach' ? 0xf0e0c0 : 0x7a5a3a, 0, 0, -.6); const sh = new T.Shape(); sh.moveTo(-1.8, 0); sh.lineTo(0, 1.4); sh.lineTo(1.8, 0); sh.closePath(); const rg = new T.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false }); rg.center(); mesh(g, rg, mat(id === 'beach' ? 0x2a8ad8 : 0x3a5a2a), 0, 3.3, -.6);
        box(g, 1, 1.8, .1, 0x3a2414, 0, 0, .7, { ol: false, emissive: 0xffa040, ei: .3 }); signAt(s.n, 3, '#e60012', '#fff');
      } else {
        box(g, 1.3, 2.2, .12, 0x1a1012, 0, 0, .1, { ol: false, emissive: 0xffc070, ei: th.night * .5 });
        if (s.act === 'shop') { const aw = box(g, 3.6, .14, 1.4, R.pick([0xe60012, 0x2a6ad8, 0xffc040]), 0, 2.7, .7); aw.rotation.x = .25; box(g, 2.6, .9, .5, 0xe8e0d0, 0, 0, .55); }
        if (s.act === 'photo') { cyl(g, .04, .04, 1.4, 0x222222, 1.2, 0, .5, { seg: 4 }); box(g, .5, .35, .3, 0x222222, 1.2, 1.4, .5); }
        signAt(s.n, 3.4, s.act === 'quiz' ? '#fff' : '#000', s.act === 'quiz' ? '#000' : '#fff');
      }
    } else if (s.act === 'wish') {
      cyl(g, 1.7, 1.8, .6, 0xd8d0c0, 0, 0, 0, { seg: 20 }); mesh(g, new T.CircleGeometry(1.55, 24), new T.MeshToonMaterial({ color: 0x40a8ff, emissive: 0x2060c0, emissiveIntensity: .6, gradientMap: gradTex(3) }), 0, .62, 0, { rx: -Math.PI / 2, ol: false });
      cyl(g, .22, .3, 1.6, 0xd8d0c0, 0, .6, 0); cyl(g, .8, .5, .3, 0xd8d0c0, 0, 2.1, 0, { seg: 16 });
      const jet = new T.Mesh(new T.ConeGeometry(.4, 1.4, 10, 1, true), glow(0xaee8ff, .35)); jet.position.y = 2.9; g.add(jet); W.anim.push({ k: 'pulse', o: jet });
      W.circles.push({ x: g.position.x, z: g.position.z, r: 1.5 });
    } else if (s.act === 'sit') {
      if (id === 'beach') { cyl(g, .05, .05, 2.4, 0xffffff, 0, 0, 0, { seg: 5 }); mesh(g, new T.ConeGeometry(1.6, .7, 10), mat(0xe8303a), 0, 2.5, 0); box(g, 1.8, .1, .8, 0x2ac0d8, 0, .1, -.6, { ol: false }); }
      else { box(g, 2.4, .12, .7, th.palace ? 0x8a0012 : 0x8a5a32, 0, .5, 0); box(g, 2.4, .7, .1, th.palace ? 0x8a0012 : 0x8a5a32, 0, .6, .35); [-1, 1].forEach(a => box(g, .1, .5, .6, 0x2a2a2a, a, 0, 0)); }
      W.circles.push({ x: g.position.x, z: g.position.z, r: 1.2 });
    } else if (s.act === 'find') {
      if (id === 'beach') for (let i = 0; i < 5; i++) mesh(g, new T.ConeGeometry(.2, .3, 6), mat(R.pick([0xffd0c0, 0xfff0e0, 0xffb0b0])), (Math.random() - .5) * 2, .15, (Math.random() - .5) * 1.2, { rx: Math.PI / 2, olw: .02 });
      else if (th.palace) { box(g, .8, 1, .8, 0x1a0a0e, 0, 0, 0); mesh(g, new T.OctahedronGeometry(.4), new T.MeshToonMaterial({ color: 0x80ffe0, emissive: 0x40c0a0, emissiveIntensity: 1, gradientMap: gradTex(3) }), 0, 1.5, 0); }
      else { mesh(g, new T.IcosahedronGeometry(1, 0), mat(id === 'forest' ? 0x2a5a2a : 0x4a8a3a), 0, .6, 0).scale.set(1.3, .7, 1); for (let i = 0; i < 6; i++) mesh(g, new T.SphereGeometry(.12, 6, 5), mat(R.pick([0xff6a8a, 0xffd23f, 0xffffff, 0x8a5aff])), (Math.random() - .5) * 2, 1, (Math.random() - .5) * 1.2, { ol: false }); }
      const sp = new T.Sprite(new T.SpriteMaterial({ map: sparkTex(), color: 0xffe080, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); sp.scale.set(1.2, 1.2, 1); sp.position.y = 1.6; g.add(sp); g.userData.spark = sp; W.anim.push({ k: 'spark', o: sp });
      W.circles.push({ x: g.position.x, z: g.position.z, r: 1 });
    } else if (s.act === 'pet' || s.act === 'play') {
      const key = { cat: 'cat', deer: 'deer', crab: null }[s.id]; const m = key && Avatar3D.has(key) ? key : null;
      if (m) Avatar3D.make(m, { height: s.id === 'deer' ? 1.3 : .6, style: 'anime' }).then(av => { av.rotation.y = face + Math.PI; g.add(av); W.anim.push({ k: 'av', o: av }); }).catch(() => {});
      else if (s.id === 'stream') mesh(g, new T.PlaneGeometry(3, 2), new T.MeshToonMaterial({ color: 0x40a8ff, emissive: 0x2050a0, emissiveIntensity: .7, gradientMap: gradTex(3) }), 0, .05, 0, { rx: -Math.PI / 2, ol: false });
      else if (s.id === 'arcade') { box(g, 1.1, 2.2, .9, 0x3a1a6a, 0, 0, 0); box(g, .8, .6, .05, 0x000000, 0, 1.3, -.46 * sd, { ol: false, emissive: 0x2ae0ff, ei: 1.2 }); }
      else { const sp = new T.Sprite(new T.SpriteMaterial({ map: Avatar3D.emojiTex(s.e) })); sp.scale.set(.9, .9, 1); sp.position.y = .45; g.add(sp); W.anim.push({ k: 'bob', o: sp, y: .45 }); }
      W.circles.push({ x: g.position.x, z: g.position.z, r: .9 });
    }
  }
  let spT = null;
  function sparkTex() { if (spT) return spT; spT = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,230,140,.8)'); g.addColorStop(1, 'rgba(255,200,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.fillRect(30, 4, 4, 56); x.fillRect(4, 30, 56, 4); }); return spT; }

  /* ================= 进入场景 ================= */
  X.go = function (id, resume) {
    T = window.THREE; OLM = OLM || new T.MeshBasicMaterial({ color: 0x000000, side: T.BackSide });
    const p = Home.ensure(), S = Sketch.SCENES[id], th = TH[id] || TH.town; resume = resume || {};
    p.hm.sec = p.hm.sec || {};
    App.show('explore', el => {
      el.classList.add('p3', 'x3');
      const d = new Date(), wk = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
      el.innerHTML = '<div class="x3-gl"></div><div class="x3-labs"></div><div class="x3-fx"></div>' +
        '<div class="p3-top"><button class="back p3-back" data-tip="回家">' + E('🏠') + '</button><div class="p3-title"><b>' + Home.ransom(S.n) + '</b><span>' + (th.palace ? '怪盗殿堂' : 'EXPLORE') + ' · ' + id.toUpperCase() + '</span></div></div>' +
        '<div class="x3-date"><b>' + (d.getMonth() + 1) + '/' + d.getDate() + '</b><i>' + wk + '</i><span>' + (d.getHours() < 17 ? '放学后' : '夜晚') + '</span></div>' +
        '<div class="x3-sec"><i>' + E('🎭') + '</i><div><small>警戒度</small><b>0%</b></div><div class="xs-bar"><u></u></div></div>' +
        '<canvas class="x3-map" width="360" height="360"></canvas>' +
        '<div class="x3-prompt"><div class="xp-main"></div><div class="xp-sub"></div></div>' +
        '<div class="x3-hide">' + Home.ransom('隐藏中') + '</div>' +
        '<div class="x3-btns"><button class="x3-b eye" data-tip="第三只眼（按住 Q）">' + E('👁️') + '<b>第三只眼</b></button><button class="x3-b run" data-tip="冲刺（Shift）">' + E('💨') + '<b>冲刺</b></button></div>' +
        '<div class="x3-joy"><i></i></div>' +
        '<div class="ex-help x3-help">' + (matchMedia('(pointer: coarse)').matches ? '摇杆走路 · 拖动转视角 · 靠近点「互动」' : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 走 · <kbd>Shift</kbd> 冲刺 · <kbd>E</kbd> 互动 / 突袭 · <kbd>空格</kbd> 躲藏 · 按住 <kbd>Q</kbd> 第三只眼 · 拖动转视角') + '</div>' +
        '<div class="p3-dialog"><div class="pd-name"></div><div class="pd-text"></div></div>';
      el.querySelector('.back').onclick = () => Home.open();
      run(el, id, S, p, th, resume);
    });
    Audio2.playMusic(S.music || 'quaint');
  };

  function run(el, id, S, p, th, resume) {
    const A = Avatar3D, gl = el.querySelector('.x3-gl'), labs = el.querySelector('.x3-labs');
    let dead = false;
    document.body.classList.add('kgame');
    const rd = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    rd.setPixelRatio(Math.min(devicePixelRatio, 1.5)); rd.outputColorSpace = T.SRGBColorSpace; rd.shadowMap.enabled = true; rd.shadowMap.type = T.PCFSoftShadowMap;
    rd.toneMapping = T.NoToneMapping;
    gl.appendChild(rd.domElement);
    const sc = new T.Scene(); sc.fog = new T.Fog(th.fog[0], th.fog[1], th.fog[2]);
    const cam = new T.PerspectiveCamera(46, 1, .1, 400);
    sc.add(new T.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2] * .8));
    const sun = new T.DirectionalLight(th.sun[0], th.sun[1]); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 }); sun.shadow.bias = -.0006; sc.add(sun); sc.add(sun.target);
    const rim = new T.DirectionalLight(th.palace || id === 'city' ? 0xff2a4a : 0x8ab0ff, .7); rim.position.set(0, 10, -30); sc.add(rim);
    const W = buildScene(sc, id, S, p, th);
    const LX = W.LX;

    /* ---- 角色 ---- */
    const st = { pos: new T.Vector3(resume.x != null ? resume.x : 4.5, 0, resume.z != null ? resume.z : 1.2), face: resume.face != null ? resume.face : Math.PI / 2, yaw: resume.yaw != null ? resume.yaw : .3, pitch: .34, dist: 8.8, busy: false, hidden: null, run: false, tgt: null, auto: null, eye: false, grace: resume.grace ? 3 : 2 };
    const actors = []; let hero = null; const team = [];
    const heroKey = App.heroModel ? App.heroModel(p) : null;
    const heroG = new T.Group(); sc.add(heroG);
    if (heroKey) A.make(heroKey, { height: 1.7, style: 'p5', hat: p.equip.hat, wand: p.equip.wand }).then(av => { if (dead) return; hero = av; heroG.add(av); actors.push(av); }).catch(() => {});
    else { const sp = new T.Sprite(new T.SpriteMaterial({ map: A.emojiTex('🧒') })); sp.center.set(.5, 0); sp.scale.set(1.6, 1.6, 1); heroG.add(sp); }
    [p.pet.kind].concat(Explore.party(p)).forEach((k, i) => {
      const K = Home.dex(k), pm = Home.petModel(k), g = new T.Group(); g.position.copy(st.pos).add(new T.Vector3(-1.2 - i * 1.1, 0, .4)); sc.add(g);
      const m = { k, g, av: null, h: K.h * 1.45, i };
      if (pm) A.make(pm, { height: m.h, style: 'anime' }).then(av => { if (dead) return; m.av = av; g.add(av); actors.push(av); }).catch(() => {});
      else { const sp = new T.Sprite(new T.SpriteMaterial({ map: A.emojiTex(K.e) })); sp.center.set(.5, 0); sp.scale.set(K.h * 1.3, K.h * 1.3, 1); g.add(sp); }
      team.push(m);
    });
    const lead = team[0];

    /* ---- 伙伴 NPC ---- */
    const npcs = Bond.NPCS.filter(N => N.scene === id).map((N, i) => {
      const x = 5 + N.x * (LX - 10), z = i % 2 ? 4.2 : -4.6, g = new T.Group(); g.position.set(x, 0, z); sc.add(g);
      const n = { N, g, home: new T.Vector3(x, 0, z), tgt: null, t: 0, av: null };
      A.make(N.m, { height: 1.7, style: 'p5' }).then(av => { if (dead) return; n.av = av; g.add(av); actors.push(av); av.traverse(o => { if (o.isMesh) o.userData.npc = N.id; }); W.pick.push(av); }).catch(() => {});
      n.circ = { x, z, r: .6 };
      return n;
    });

    /* ---- 暗影 ---- */
    const SLOT = [.3, .62, .86, .46].slice(0, S.lv >= 5 ? 4 : S.lv >= 3 ? 3 : 2), defeated = p.hm.shd[id] || [];
    const shadows = [];
    SLOT.forEach((f, i) => {
      if (defeated.includes(i)) return;
      const kinds = Battle5.rollEnemies(S.lv, p.grade <= 1 ? 1 : R.int(1, 3)), K = Home.dex(kinds[0]);
      const x = 5 + f * (LX - 10), z = [0, -1.5, 1.5, -.5][i];
      const g = new T.Group(); g.position.set(x + (Math.random() - .5) * 4, 0, z); sc.add(g);
      const sh = { i, kinds, K, g, a: { x: x - 5, z }, b: { x: x + 5, z: z + (i % 2 ? 2.5 : -2.5) }, leg: 0, face: 0, state: 'patrol', sus: 0, lost: 0, wait: 0, av: null, hgt: Math.max(1.2, K.h * 1.7) };
      // 暗红光环 + 黑烟
      const aura = new T.Mesh(new T.CircleGeometry(1.1, 24), glow(0xe60012, .5)); aura.rotation.x = -Math.PI / 2; aura.position.y = .05; g.add(aura); sh.aura = aura;
      const cone = new T.Mesh(new T.CircleGeometry(VIS_R, 28, -VIS_A, VIS_A * 2), glow(0xff2030, .18)); cone.rotation.x = -Math.PI / 2; cone.position.y = .08; cone.visible = false; g.add(cone); sh.cone = cone;
      const pm = Home.petModel(kinds[0]);
      if (pm) A.make(pm, { height: sh.hgt, style: 'shadow', mask: true }).then(av => { if (dead) return; sh.av = av; g.add(av); actors.push(av); av.traverse(o => { if (o.isMesh) o.userData.shadow = i; }); W.pick.push(av); }).catch(() => {});
      shadows.push(sh);
    });
    const strength = sh => { const v = sh.K.t * 2 + S.lv / 2 + sh.kinds.length - (p.lv || 1) / 2; return v <= 1 ? 'weak' : v <= 4 ? 'even' : 'strong'; };

    /* ---- 标签 ---- */
    const labels = [];
    const mkLab = (cls, html, pos, maxD, onclick) => { const d = h('div', 'x3-lab ' + cls, html); labs.appendChild(d); hydrate(d); const L = { el: d, pos, maxD: maxD || 18 }; if (onclick) d.onclick = onclick; labels.push(L); return L; };
    const spotLab = {};
    const drawSpotLabs = () => S.spots.forEach(s => { const used = !!p.hm.spots[id + ':' + s.id]; if (!spotLab[s.id]) spotLab[s.id] = mkLab('spot', '', () => W.spotPos[s.id].clone().setY(W.spotPos[s.id].z < 0 ? 3.9 : 2.6), 20, () => walkTo(W.spotPos[s.id], { spot: s })); spotLab[s.id].hideNear = 1; const L = spotLab[s.id]; L.el.classList.toggle('done', used); L.el.innerHTML = '<i>' + E(s.e) + '</i><b>' + esc(s.n) + '</b><small>' + Explore.ACT_N[s.act] + '</small>'; hydrate(L.el); });
    drawSpotLabs();
    npcs.forEach(n => { const b = Bond.st(n.N.id); n.lab = mkLab('npc', '<b>' + n.N.n + '</b><i>' + (b.known ? n.N.card + ' ' + Bond.rankOf(b.pts) : '初次见面') + '</i>' + (p.hm.met[n.N.id] ? '' : '<em>!</em>'), () => n.g.position.clone().setY(2.3), 16, () => walkTo(n.g.position, { npc: n })); });
    shadows.forEach(sh => { sh.lab = mkLab('shd ' + strength(sh), '<em></em><b>' + esc(sh.K.n) + '之影</b><i>×' + sh.kinds.length + '</i>', () => sh.g.position.clone().setY(sh.hgt + .9), 14); });
    W.chests.forEach(c => { c.lab = mkLab('chest' + (c.gold ? ' gold' : ''), '<b>' + (c.gold ? '金色宝箱' : '宝箱') + '</b>', () => new T.Vector3(c.x, 1.6, c.z), 9, () => walkTo(new T.Vector3(c.x, 0, c.z), { chest: c })); });
    mkLab('exit', '<b>出口</b><i>回家</i>', () => W.exit.clone().setY(2.1), 12, () => walkTo(W.exit, { exit: 1 }));

    const dialog = Explore.dialogBox(el.querySelector('.p3-dialog'));
    const toScreen = v => { const q = v.clone().project(cam), r = rd.domElement.getBoundingClientRect(); return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height, vis: q.z < 1 }; };
    const ACTS = Explore.makeActs(id, S, p, {
      dialog, marks: drawSpotLabs,
      heroOnce: n => hero ? hero.once(n) : sleep(500),
      petOnce: n => lead.av ? lead.av.once(n === 'dance' && !lead.av.has('dance') ? 'jump' : n) : sleep(500),
      petGoto: s => { lead.goal = W.spotPos[s.id].clone(); }, petFollow: () => { lead.goal = null; },
      sit: on => { if (hero) hero.play(on ? 'sit' : 'idle'); team.forEach(m => m.av && m.av.play(on && m.av.has('sit') ? 'sit' : 'idle')); },
      burst: (s, emo, n) => { const q = toScreen(W.spotPos[s.id].clone().setY(1.2)); UI.burst(q.x, q.y, emo, n || 7); const L = W.pick.find(g => g.userData && g.userData.spark && g.children && g.position.x === W.spotPos[s.id].x); if (L && L.userData.spark) L.userData.spark.visible = false; },
      snap: () => { render(); const c = document.createElement('canvas'); c.width = rd.domElement.width; c.height = rd.domElement.height; c.getContext('2d').drawImage(rd.domElement, 0, 0); return c; },
    });
    W.pick.forEach(g => { if (g.userData.spark && g.children[0] && g.children[0].userData.spot && p.hm.spots[id + ':' + g.children[0].userData.spot]) g.userData.spark.visible = false; });

    /* ---- 输入 ---- */
    const keys = new Set();
    // 中文输入法开着时 e.key 是 'Process'：按物理键位 e.code 识别
    const CODE = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyQ: 'q', Space: ' ', Enter: 'enter', ShiftLeft: 'shift', ShiftRight: 'shift', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright' };
    const keyOf = e => CODE[e.code] || String(e.key || '').toLowerCase();
    const blocked = () => st.busy || !!$('#fx .modal-bg') || !!document.querySelector('.bd-scene, .rank-up, .bd-rank');
    const kd = e => {
      if (/INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
      const k = keyOf(e);
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { keys.add(k); st.tgt = null; st.auto = null; e.preventDefault(); return; }
      if (e.repeat || blocked()) return;
      if (k === 'e' || k === 'enter') { e.preventDefault(); doMain(); }
      else if (k === ' ') { e.preventDefault(); doCover(); }
      else if (k === 'q') setEye(true);
    };
    const ku = e => { const k = keyOf(e); keys.delete(k); if (k === 'q') setEye(false); };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    const cv = rd.domElement; let drag = null;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 7) drag.moved = true; if (drag.moved) { st.yaw = drag.yaw - dx * .006; st.pitch = Math.max(.15, Math.min(.95, drag.pitch + dy * .004)); } });
    cv.addEventListener('pointerup', e => { const d0 = drag; drag = null; if (!d0 || d0.moved || blocked()) return; clickAt(e.clientX, e.clientY); });
    cv.addEventListener('wheel', e => { e.preventDefault(); st.dist = Math.max(5, Math.min(15, st.dist + e.deltaY * .01)); }, { passive: false });
    const ray = new T.Raycaster(), gplane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    function clickAt(cx, cy) {
      const r = cv.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), cam);
      const hit = ray.intersectObjects(W.pick, true).find(x => !x.object.userData.ol);
      if (hit) { const u = hit.object.userData; let o = null;
        if (u.spot) { const s = S.spots.find(x => x.id === u.spot); return walkTo(W.spotPos[s.id], { spot: s }); }
        if (u.chest != null) { const c = W.chests.find(x => x.i === u.chest); return walkTo(new T.Vector3(c.x, 0, c.z), { chest: c }); }
        if (u.npc) { o = npcs.find(n => n.N.id === u.npc); if (o) return walkTo(o.g.position, { npc: o }); }
        if (u.shadow != null) { o = shadows.find(s => s.i === u.shadow); if (o) return walkTo(o.g.position, { shadow: o }); }
      }
      const pt = new T.Vector3(); if (ray.ray.intersectPlane(gplane, pt)) { walkTo(pt, null); ripple(pt); }
    }
    function walkTo(v, auto) { if (blocked()) return; leaveCover(); st.tgt = v.clone ? v.clone() : v; st.tgt.y = 0; st.auto = auto; st.run = st.pos.distanceTo(st.tgt) > 9; }
    function ripple(pt) { const m = new T.Mesh(new T.RingGeometry(.2, .35, 24), glow(0xffffff, .9)); m.rotation.x = -Math.PI / 2; m.position.copy(pt).setY(.08); sc.add(m); const t0 = performance.now(); const f = () => { const k = (performance.now() - t0) / 500; if (k >= 1 || dead) { sc.remove(m); return; } m.scale.setScalar(1 + k * 2); m.material.opacity = .9 * (1 - k); requestAnimationFrame(f); }; f(); }
    // 摇杆
    const joy = el.querySelector('.x3-joy'), knob = joy.querySelector('i'); const jv = { x: 0, y: 0, on: false };
    joy.addEventListener('pointerdown', e => { jv.on = true; joy.setPointerCapture(e.pointerId); jmove(e); st.tgt = null; });
    joy.addEventListener('pointermove', e => { if (jv.on) jmove(e); });
    joy.addEventListener('pointerup', () => { jv.on = false; jv.x = jv.y = 0; knob.style.transform = ''; });
    function jmove(e) { const r = joy.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), l = Math.min(1, Math.hypot(dx, dy) / (r.width / 2)), a = Math.atan2(dy, dx); jv.x = Math.cos(a) * l; jv.y = Math.sin(a) * l; knob.style.transform = 'translate(' + jv.x * 34 + 'px,' + jv.y * 34 + 'px)'; }
    const eyeB = el.querySelector('.x3-b.eye'), runB = el.querySelector('.x3-b.run');
    eyeB.onclick = () => setEye(!st.eye); runB.onclick = () => { st.runT = !st.runT; runB.classList.toggle('on', st.runT); };
    function setEye(on) { if (st.eye === on) return; st.eye = on; el.classList.toggle('teye', on); eyeB.classList.toggle('on', on); shadows.forEach(s => s.cone.visible = on || s.state !== 'patrol'); if (on) Audio2.sfx('magic', .3); }
    const prompt = el.querySelector('.x3-prompt'), pMain = prompt.querySelector('.xp-main'), pSub = prompt.querySelector('.xp-sub');
    pMain.onclick = () => !blocked() && doMain(); pSub.onclick = () => !blocked() && doCover();

    /* ---- 警戒度 ---- */
    const secEl = el.querySelector('.x3-sec');
    const secDraw = () => { const v = p.hm.sec[id] || 0; secEl.querySelector('b').textContent = v + '%'; secEl.querySelector('u').style.width = v + '%'; secEl.classList.toggle('hi', v >= 50); secEl.classList.toggle('max', v >= 80); };
    function secAdd(n) { const v0 = p.hm.sec[id] || 0, v = Math.max(0, Math.min(100, v0 + n)); p.hm.sec[id] = v; save(); secDraw(); if (n > 0) { secEl.classList.remove('bump'); void secEl.offsetWidth; secEl.classList.add('bump'); } if (v >= 100 && v0 < 100) kicked(); }
    async function kicked() {
      st.busy = true; Audio2.sfx('fail', .5);
      await banner('警戒度 100%', '暗影们全都戒备起来了，先撤退吧！');
      p.hm.sec[id] = 60; save(); Home.open();
    }
    secDraw();

    /* ---- 动作 ---- */
    let fighting = false;
    function current() {
      // 突袭 / 迎战
      let best = null, bd = 1e9;
      shadows.forEach(sh => { if (sh.gone) return; const d = sh.g.position.distanceTo(st.pos); if (d < bd) { bd = d; best = sh; } });
      if (best && st.hidden && bd < 5.5 && best.state !== 'alert') return { k: 'jump', sh: best, e: '🦅', n: '跳跃突袭', s: '从掩体扑上去！' };
      if (best && bd < 2.4) return best.state === 'alert' ? { k: 'fight', sh: best, e: '⚔️', n: '迎战', s: '正面交锋' } : { k: 'amb', sh: best, e: '🗡️', n: '突袭', s: '撕下暗影的面具！' };
      const n = npcs.find(n => n.g.position.distanceTo(st.pos) < 2.2); if (n) return { k: 'npc', npc: n, e: n.N.ce || '💬', n: n.N.n, s: '聊天' };
      const c = W.chests.find(c => !c.open && Math.hypot(c.x - st.pos.x, c.z - st.pos.z) < 2.2); if (c) return { k: 'chest', c, e: c.gold ? '🔐' : '🎁', n: c.gold ? '金色宝箱' : '宝箱', s: c.gold ? '答题开锁' : '打开' };
      const s = S.spots.find(s => W.spotPos[s.id].distanceTo(st.pos) < 2.4); if (s) return { k: 'spot', spot: s, e: s.e, n: s.n, s: Explore.ACT_N[s.act] };
      if (W.exit.distanceTo(st.pos) < 1.8) return { k: 'exit', e: '🚪', n: '出口', s: '回家' };
      return null;
    }
    const nearCover = () => W.covers.find(c => Math.hypot(c.x - st.pos.x, c.z - st.pos.z) < 2.1);
    function doMain() {
      const a = current(); if (!a) return;
      if (a.k === 'amb') return startFight(a.sh, 'player', true);
      if (a.k === 'jump') return jumpAmbush(a.sh);
      if (a.k === 'fight') return startFight(a.sh, null);
      if (a.k === 'npc') { const n = a.npc; st.busy = true; keys.clear(); faceTo(n.g.position); Bond.meet(n.N.id).catch(e => console.error(e)).then(() => { st.busy = false; const b = Bond.st(n.N.id); n.lab.el.innerHTML = '<b>' + n.N.n + '</b><i>' + n.N.card + ' ' + Bond.rankOf(b.pts) + '</i>'; }); return; }
      if (a.k === 'chest') return openChest(a.c);
      if (a.k === 'spot') return doSpot(a.spot);
      if (a.k === 'exit') return Home.open();
    }
    async function doSpot(s) { st.busy = true; st.tgt = null; keys.clear(); try { faceTo(W.spotPos[s.id]); await ACTS.interact(s); } catch (e) { console.error(e); } finally { st.busy = false; } }
    function faceTo(v) { st.face = Math.atan2(v.x - st.pos.x, v.z - st.pos.z); }
    async function openChest(c) {
      st.busy = true; keys.clear(); faceTo(new T.Vector3(c.x, 0, c.z));
      try {
        if (c.gold) { const ok = await Home.quizRound(1, '开锁', '金色宝箱上了锁：答对题目才能打开'); if (!ok) { dialog(p.pet.name, '锁没打开……明天再来试试吧'); c.open = true; p.hm.spots[id + ':chest' + c.i] = 1; save(); c.lab.el.classList.add('done'); return; } }
        if (hero) hero.once('eat'); Audio2.sfx('open', .6);
        const lid = c.g.userData.lid, t0 = performance.now(); await new Promise(r => { const f = () => { const k = Math.min(1, (performance.now() - t0) / 450); lid.rotation.x = -1.9 * (1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(f); else r(); }; f(); });
        c.open = true; p.hm.spots[id + ':chest' + c.i] = 1; save(); c.lab.el.classList.add('done');
        const q = toScreen(new T.Vector3(c.x, 1, c.z));
        const g = c.gold || Math.random() < .25 ? Home.rollDrop('explore', c.gold) : null;
        if (g) { Home.dropToast(g, '宝箱'); UI.burst(q.x, q.y, '✨', 14); }
        else if (Math.random() < .5) { p.inv.potion = (p.inv.potion || 0) + 1; save(); UI.burst(q.x, q.y, '🧪', 6); UI.toast(E('🧪') + ' 得到 回血药水 ×1（战斗中使用）'); }
        else { const n = R.int(15, 35) * (c.gold ? 2 : 1); App.addCoins && App.addCoins(n); UI.burst(q.x, q.y, '🪙', 10); UI.toast(E('🪙') + ' 宝箱里有 ' + n + ' 金币'); }
        dialog(p.pet.name, '我找到好东西啦！');
      } finally { st.busy = false; }
    }
    function doCover() {
      if (st.hidden) return leaveCover();
      const c = nearCover(); if (!c) return;
      // 躲到掩体背对最近暗影的一侧
      let best = null, bd = 1e9; shadows.forEach(sh => { if (sh.gone) return; const d = sh.g.position.distanceTo(st.pos); if (d < bd) { bd = d; best = sh; } });
      const away = best ? new T.Vector3(c.x - best.g.position.x, 0, c.z - best.g.position.z).normalize() : new T.Vector3(st.pos.x - c.x, 0, st.pos.z - c.z).normalize();
      st.pos.set(c.x + away.x * 1.35, 0, c.z + away.z * 1.35); st.pos.z = Math.max(W.bounds.z0, Math.min(W.bounds.z1, st.pos.z));
      st.face = Math.atan2(c.x - st.pos.x, c.z - st.pos.z) + Math.PI; st.hidden = c; st.tgt = null;
      el.classList.add('hiding'); if (hero) hero.play('sit'); Audio2.sfx('whoosh', .35);
    }
    function leaveCover() { if (!st.hidden) return; st.hidden = null; el.classList.remove('hiding'); if (hero) hero.play('idle'); }
    async function jumpAmbush(sh) {
      st.busy = true; leaveCover(); keys.clear();
      const from = st.pos.clone(), to = sh.g.position.clone().add(st.pos.clone().sub(sh.g.position).setY(0).normalize().multiplyScalar(.9)); faceTo(sh.g.position);
      if (hero) hero.play('jump', { once: true, restart: true }); Audio2.sfx('jump', .5);
      const t0 = performance.now(); await new Promise(r => { const f = () => { const k = Math.min(1, (performance.now() - t0) / 480); st.pos.lerpVectors(from, to, k); heroG.position.y = Math.sin(k * Math.PI) * 2.2; if (k < 1) requestAnimationFrame(f); else { heroG.position.y = 0; r(); } }; f(); });
      startFight(sh, 'player', true);
    }
    async function startFight(sh, adv, ambush) {
      if (fighting) return; fighting = true; st.busy = true; keys.clear(); st.tgt = null;
      if (Bond.fx().first && adv === 'enemy' && Math.random() < .5) adv = null;
      if (adv === 'enemy') secAdd(12); else if (ambush) secAdd(-5);
      if (hero) { faceTo(sh.g.position); hero.once('attack'); }
      if (ambush) {
        // 撕面具：面具飞出去 + 红色斜切横幅
        if (sh.av) sh.av.traverse(o => { if (o.isSprite) o.visible = false; });
        const m = h('div', 'x3-mask'); m.innerHTML = '<i></i>'; const q = toScreen(sh.g.position.clone().setY(sh.hgt * .85)); m.style.left = q.x + 'px'; m.style.top = q.y + 'px'; document.body.appendChild(m); setTimeout(() => m.remove(), 1100);
        await banner('突袭', '撕下面具，先制攻击！', 'amb');
      } else if (adv === 'enemy') await banner('被发现了', '暗影抢先出手！', 'warn');
      const fl = h('div', 'p5-wipe'); document.body.appendChild(fl); Audio2.sfx('whoosh', .6);
      await sleep(620); fl.remove();
      const back = { x: st.pos.x, z: st.pos.z, face: st.face, yaw: st.yaw };
      Battle5.start({ kinds: sh.kinds, lv: S.lv, adv, scene: id, onEnd: r => {
        if (r.win) { p.hm.shd[id] = (p.hm.shd[id] || []).concat([sh.i]); p.hm.sec[id] = Math.max(0, (p.hm.sec[id] || 0) - 5); save(); }
        if (r.lose) return Home.open();
        if (r.run) { const dx = st.pos.x - sh.g.position.x; back.x = Math.max(1, Math.min(LX - 1, back.x + (dx >= 0 ? 4 : -4))); back.grace = 1; }
        X.go(id, back);
      } });
    }
    function banner(t, sub, cls) {
      const b = h('div', 'x3-ban ' + (cls || '')); b.innerHTML = '<div class="xb-strip"></div><div class="xb-t">' + Home.ransom(t) + '</div><div class="xb-s">' + esc(sub || '') + '</div>';
      el.querySelector('.x3-fx').appendChild(b); Audio2.sfx('whoosh', .5); setTimeout(() => b.remove(), 1500); return sleep(1100);
    }

    /* ---- 碰撞 ---- */
    // 碰撞：圆形 / 轴对齐盒子，把点推出障碍物
    function collide(v, r) {
      const B = W.bounds; v.x = Math.max(B.x0, Math.min(B.x1, v.x)); v.z = Math.max(B.z0, Math.min(B.z1, v.z));
      W.circles.forEach(c => { const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { v.x = c.x + dx / d * m; v.z = c.z + dz / d * m; } });
      W.boxes.forEach(b => { if (v.x > b.x0 - r && v.x < b.x1 + r && v.z > b.z0 - r && v.z < b.z1 + r) { const o = [v.x - (b.x0 - r), b.x1 + r - v.x, v.z - (b.z0 - r), b.z1 + r - v.z], m = Math.min(...o); if (m === o[0]) v.x = b.x0 - r; else if (m === o[1]) v.x = b.x1 + r; else if (m === o[2]) v.z = b.z0 - r; else v.z = b.z1 + r; } });
      v.x = Math.max(B.x0, Math.min(B.x1, v.x)); v.z = Math.max(B.z0, Math.min(B.z1, v.z));
    }
    // 移动：直走被挡住时，依次尝试向左右偏转的方向（优先上次绕行的那一侧），自动绕开障碍物和墙角
    const DEFL = [0, .4, .8, 1.2, 1.57, 1.9];
    function moveStep(v, dir, step, mem) {
      const tmp = new T.Vector3(), B = W.bounds;
      // 贴着边界斜着走：去掉朝墙里的分量，沿墙走
      let ddx = dir.x, ddz = dir.z;
      const nearZ = (v.z >= B.z1 - .05 && ddz > 0) || (v.z <= B.z0 + .05 && ddz < 0) || (Math.abs(ddz) < Math.abs(ddx) && ((v.z > B.z1 - 1.3 && ddz > 0) || (v.z < B.z0 + 1.3 && ddz < 0)) && mem.blk > 2);
      const nearX = (v.x >= B.x1 - .05 && ddx > 0) || (v.x <= B.x0 + .05 && ddx < 0);
      if (nearZ) ddz = 0; if (nearX) ddx = 0;
      const dl = Math.hypot(ddx, ddz); if (dl < .2) return false; dir = { x: ddx / dl, z: ddz / dl };
      // 没有记住绕行方向时，优先往场地中间绕（不往墙角钻）
      const pref = mem.side || (Math.abs(dir.x) >= Math.abs(dir.z) ? -Math.sign(v.z || 1) * Math.sign(dir.x || 1) : Math.sign(dir.z || 1) * Math.sign((v.x - (B.x0 + B.x1) / 2) || 1));
      // 先试「沿障碍物表面滑动」：去掉被推回来的那个法线分量
      { const ex = v.x + dir.x * step, ez = v.z + dir.z * step; tmp.set(ex, 0, ez); collide(tmp, .45);
        const px = tmp.x - ex, pz = tmp.z - ez, pl = Math.hypot(px, pz);
        if (pl < 1e-5 || ((tmp.x - v.x) * dir.x + (tmp.z - v.z) * dir.z) > step * .55) { v.x = tmp.x; v.z = tmp.z; mem.blk = Math.max(0, (mem.blk || 0) - .2); return true; }
        mem.blk = Math.min(30, (mem.blk || 0) + 1);
        const nx = px / pl, nz = pz / pl, dn = dir.x * nx + dir.z * nz; let tx = dir.x - nx * dn, tz = dir.z - nz * dn, tl = Math.hypot(tx, tz);
        if (tl < .35) { tx = -nz * pref; tz = nx * pref; if (tx * (-(B.x0 + B.x1) / 2 + v.x) > 0 && Math.abs(dir.z) > .7) { tx = -tx; tz = -tz; } tl = 1; }
        tx /= tl; tz /= tl; tmp.set(v.x + tx * step, 0, v.z + tz * step); collide(tmp, .45);
        if (Math.hypot(tmp.x - v.x, tmp.z - v.z) > step * .4) { mem.side = (nx * tz - nz * tx) > 0 ? 1 : -1; v.x = tmp.x; v.z = tmp.z; return true; } }
      for (const a of DEFL) {
        for (const sg of a ? [pref, -pref] : [0]) {
          const ang = a * sg, cx = Math.cos(ang), sx = Math.sin(ang), dx = dir.x * cx - dir.z * sx, dz = dir.x * sx + dir.z * cx;
          tmp.set(v.x + dx * step, 0, v.z + dz * step); collide(tmp, .45);
          const mx = tmp.x - v.x, mz = tmp.z - v.z, moved = Math.hypot(mx, mz), proj = mx * dir.x + mz * dir.z;
          // 直走：前进够多就行；偏转：要真的挪动了（沿障碍物边缘滑），并且不能明显往回走
          if (a === 0 ? proj > step * .55 : moved > step * .45 && proj > -step * (a > 1.5 ? .85 : .35)) { v.x = tmp.x; v.z = tmp.z; mem.side = a ? sg : mem.side; if (!a) mem.clear = (mem.clear || 0) + 1; else mem.clear = 0; if (mem.clear > 20) mem.side = 0; return true; }
        }
      }
      return false;
    }
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
    const turn = (cur, to, k) => cur + angDiff(to, cur) * Math.min(1, k);

    /* ---- 暗影 AI ---- */
    function shadowTick(sh, dt) {
      if (sh.gone) return;
      const g = sh.g, d = g.position.distanceTo(st.pos), toH = Math.atan2(st.pos.x - g.position.x, st.pos.z - g.position.z);
      const canSee = !st.hidden && !st.busy && st.grace <= 0 && d < VIS_R && Math.abs(angDiff(toH, sh.face)) < VIS_A;
      const hear = !st.hidden && !st.busy && st.grace <= 0 && st.moving && st.running && d < 3.6;
      let mv = 0;
      if (sh.state === 'patrol' || sh.state === 'sus' || sh.state === 'search') {
        if (canSee || hear) { sh.sus = Math.min(1, sh.sus + dt * (hear && !canSee ? .7 : .55 + (VIS_R - d) / VIS_R * 1.2) * (st.running ? 1.6 : 1)); if (sh.state !== 'sus') { sh.state = 'sus'; Audio2.sfx('question', .35); } }
        else sh.sus = Math.max(0, sh.sus - dt * .35);
        if (sh.state === 'sus') { sh.face = turn(sh.face, toH, dt * 3); if (sh.sus <= 0) sh.state = 'patrol'; if (sh.sus >= 1) { sh.state = 'alert'; sh.lost = 0; Audio2.sfx('bong', .5); secAdd(8); } }
        else if (sh.state === 'search') { sh.wait -= dt; sh.face += dt * 1.6; if (sh.wait <= 0) sh.state = 'patrol'; }
        else { const w = sh.leg ? sh.b : sh.a, dx = w.x - g.position.x, dz = w.z - g.position.z, l = Math.hypot(dx, dz); if (sh.wait > 0) sh.wait -= dt; else if (l < .3) { sh.leg ^= 1; sh.wait = 1 + Math.random() * 1.5; } else { sh.face = turn(sh.face, Math.atan2(dx, dz), dt * 4); g.position.x += Math.sin(sh.face) * 1.5 * dt; g.position.z += Math.cos(sh.face) * 1.5 * dt; mv = 1; } }
      } else if (sh.state === 'alert') {
        if (canSee || d < 4) sh.lost = 0; else sh.lost += dt;
        if (sh.lost > 2.6 || d > 16 || st.hidden) { sh.state = 'search'; sh.wait = 2.2; sh.sus = .5; }
        else if (!st.busy && !fighting) { sh.face = turn(sh.face, toH, dt * 6); g.position.x += Math.sin(sh.face) * 4.6 * dt; g.position.z += Math.cos(sh.face) * 4.6 * dt; mv = 2; if (d < 1.15) startFight(sh, 'enemy'); }
      }
      collide(g.position, .5);
      if (sh.av) { sh.av.play(mv === 2 ? 'run' : mv ? 'walk' : 'idle'); sh.av.rotation.y = turn(sh.av.rotation.y, sh.face, dt * 10); }
      sh.cone.rotation.z = sh.face - Math.PI / 2; sh.cone.visible = st.eye || sh.state !== 'patrol'; sh.cone.material.opacity = sh.state === 'alert' ? .32 : sh.state === 'sus' ? .22 : .14;
      sh.cone.material.color.setHex(sh.state === 'patrol' ? 0xffd040 : 0xff2030);
      sh.aura.material.opacity = .35 + Math.sin(performance.now() / 200 + sh.i) * .15;
      const em = sh.lab.el.querySelector('em'), mark = sh.state === 'alert' ? '!' : sh.state === 'sus' || sh.state === 'search' ? '?' : '';
      if (em.textContent !== mark) { em.textContent = mark; sh.lab.el.dataset.st = sh.state; }
      if (sh.state === 'sus') em.style.setProperty('--k', sh.sus);
    }

    /* ---- 主循环 ---- */
    const clock = new T.Clock(); let raf = 0;
    const fit = () => { const r = el.getBoundingClientRect(); rd.setSize(r.width, r.height); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); };
    fit(); addEventListener('resize', fit);
    const mapCv = el.querySelector('.x3-map'), mx = mapCv.getContext('2d');
    let lastAct = null, mapT = 0, labT = 0;
    function render() { A.setViewport(rd.domElement.width, rd.domElement.height); A.outlineU.uOl.value = 2.4 / Math.max(1, rd.domElement.height) * Math.min(devicePixelRatio, 1.75); rd.render(sc, cam); }
    function loop() {
      if (dead) return; if (!el.isConnected) return dispose(); raf = requestAnimationFrame(loop);
      const dt = Math.min(.1, clock.getDelta()), t = clock.elapsedTime; X._frames = (X._frames || 0) + 1;
      if (st.grace > 0) st.grace -= dt;
      // 输入 → 移动（相对镜头）
      let ix = 0, iz = 0; const B = blocked();
      if (!B) { if (keys.has('a') || keys.has('arrowleft')) ix -= 1; if (keys.has('d') || keys.has('arrowright')) ix += 1; if (keys.has('w') || keys.has('arrowup')) iz += 1; if (keys.has('s') || keys.has('arrowdown')) iz -= 1; if (jv.on) { ix += jv.x; iz -= jv.y; } }
      const fw = new T.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw)), rt = new T.Vector3(Math.cos(st.yaw), 0, -Math.sin(st.yaw));
      let mv = fw.multiplyScalar(iz).add(rt.multiplyScalar(ix)); let running = keys.has('shift') || st.runT || (jv.on && Math.hypot(jv.x, jv.y) > .92);
      if (mv.lengthSq() < .01 && st.tgt && !B) { const d = st.tgt.clone().sub(st.pos).setY(0), l = d.length(); const reach = st.auto ? (st.auto.shadow ? 1.6 : st.auto.npc ? 1.6 : st.auto.chest ? 1.4 : 1.2) : .25;
        if (l < reach) { const a = st.auto; st.tgt = null; st.auto = null; if (a) { if (a.spot) doSpot(a.spot); else if (a.chest) { if (!a.chest.open) openChest(a.chest); } else if (a.npc) doMain(); else if (a.shadow) startFight(a.shadow, a.shadow.state === 'alert' ? null : 'player', a.shadow.state !== 'alert'); else if (a.exit) Home.open(); } }
        else { mv = d.normalize(); running = st.run; if (st.auto && st.auto.shadow) st.tgt.copy(st.auto.shadow.g.position); } }
      st.moving = mv.lengthSq() > .01;
      if (st.moving && st.hidden) leaveCover();
      if (st.moving) { const l = Math.min(1, mv.length()); mv.normalize(); const sp = (running ? 6.6 : 3.4) * l; st.mem = st.mem || {}; const p0x = st.pos.x, p0z = st.pos.z; moveStep(st.pos, mv, sp * dt, st.mem); const fx = st.pos.x - p0x, fz = st.pos.z - p0z; st.face = turn(st.face, Math.hypot(fx, fz) > 1e-3 ? Math.atan2(fx, fz) : Math.atan2(mv.x, mv.z), dt * 12); }
      st.running = running && st.moving;
      collide(st.pos, .45);
      // 点地面自动走：一秒内几乎没前进就放弃，免得原地踏步
      if (st.tgt && st.moving) { st.prog = st.prog || { t: 0, d: 1e9 }; const dd = st.pos.distanceTo(st.tgt); if (dd < st.prog.d - .3) st.prog = { t: 0, d: dd }; else if ((st.prog.t += dt) > 1) { st.tgt = null; st.auto = null; st.prog = null; } } else st.prog = null;
      el.classList.toggle('dash', st.running);
      heroG.position.x = st.pos.x; heroG.position.z = st.pos.z; heroG.rotation.y = st.face;
      if (hero && !st.busy && !st.hidden) hero.play(st.moving ? (running ? 'run' : 'walk') : 'idle');
      // 宠物队列
      team.forEach((m, i) => {
        const ld = i ? team[i - 1].g.position : st.pos, goal = m.goal || ld.clone().add(new T.Vector3(-Math.sin(i ? team[i - 1].g.rotation.y : st.face), 0, -Math.cos(i ? team[i - 1].g.rotation.y : st.face)).multiplyScalar(i ? 1.1 : 1.3 + m.h * .3));
        const d = goal.clone().sub(m.g.position).setY(0), l = d.length(); let pm = 0;
        if (l > .25) { const sp = Math.min(9, Math.max(2.4, l * 3.2)); m.g.position.addScaledVector(d.normalize(), Math.min(l, sp * dt)); m.g.rotation.y = turn(m.g.rotation.y, Math.atan2(d.x, d.z), dt * 10); pm = sp > 5 ? 2 : 1; }
        if (st.hidden) m.g.visible = false; else m.g.visible = true;
        if (m.av && !(m.av.curName || '').match(/eat|jump|dance|wave|yes|sit|attack|hit/)) m.av.play(pm === 2 ? 'run' : pm ? 'walk' : 'idle');
        else if (m.av && pm && m.av.cur && !m.av.cur.isRunning()) m.av.play('walk');
      });
      if (!st.moving && !B && Math.random() < dt * .08 && lead.av) { const n = R.pick(['idle2', 'eat', 'jump', 'yes'].filter(x => lead.av.has(x))); if (n) lead.av.once(n); }
      // NPC 漫步 / 看向主角
      npcs.forEach(n => {
        const d = n.g.position.distanceTo(st.pos); let m = 0;
        if (d < 3) { n.g.rotation.y = turn(n.g.rotation.y, Math.atan2(st.pos.x - n.g.position.x, st.pos.z - n.g.position.z), dt * 5); }
        else { n.t -= dt; if (n.t <= 0) { n.t = 3 + Math.random() * 4; n.tgt = Math.random() < .5 ? null : n.home.clone().add(new T.Vector3((Math.random() - .5) * 5, 0, (Math.random() - .5) * 2)); } if (n.tgt) { const v = n.tgt.clone().sub(n.g.position), l = v.length(); if (l < .2) n.tgt = null; else { n.g.position.addScaledVector(v.normalize(), 1.1 * dt); n.g.rotation.y = turn(n.g.rotation.y, Math.atan2(v.x, v.z), dt * 6); m = 1; } } }
        n.circ.x = n.g.position.x; n.circ.z = n.g.position.z;
        if (n.av) n.av.play(m ? 'walk' : 'idle');
      });
      shadows.forEach(sh => shadowTick(sh, dt));
      actors.forEach(a => a.update(dt));
      W.anim.forEach(a => {
        if (a.k === 'spin') a.o.rotation.z += dt * a.s; else if (a.k === 'bob') a.o.position.y = a.y + Math.sin(t * 2) * .15;
        else if (a.k === 'neon') a.o.material.opacity = (Math.sin(t * 7 + a.s) > -.85 || Math.random() < .5) ? 1 : .35;
        else if (a.k === 'pulse') a.o.scale.set(1, 1 + Math.sin(t * 6) * .12, 1);
        else if (a.k === 'spark') { a.o.material.rotation = t; a.o.scale.setScalar(1 + Math.sin(t * 4) * .25); }
        else if (a.k === 'av') a.o.update(dt);
        else if (a.k === 'sea') { const pa = a.o.geometry.attributes.position, arr = pa.array; for (let i = 0; i < arr.length; i += 3) arr[i + 1] = Math.sin(a.base[i] * .2 + t * 1.3) * .25 + Math.cos(a.base[i + 2] * .25 + t) * .2; pa.needsUpdate = true; a.o.geometry.computeVertexNormals(); }
        else if (a.k === 'parts') { const pa = a.o.geometry.attributes.position, arr = pa.array; for (let i = 0; i < arr.length; i += 3) { if (a.kind === 'petal') { arr[i] += dt * .8; arr[i + 1] -= dt * .7; arr[i + 2] += Math.sin(t + i) * dt * .3; if (arr[i + 1] < 0) { arr[i + 1] = 9; arr[i] = Math.random() * (a.LX + 20) - 10; } } else if (a.kind === 'ember') { arr[i + 1] += dt * .6; if (arr[i + 1] > 10) arr[i + 1] = 0; arr[i] += Math.sin(t * 2 + i) * dt * .2; } else { arr[i] += Math.sin(t * .8 + i) * dt * .4; arr[i + 1] = 1 + Math.abs(Math.sin(t * .5 + i * .1)) * 3; } } pa.needsUpdate = true; if (a.kind === 'firefly') a.o.material.opacity = .6 + Math.sin(t * 3) * .3; }
      });
      // 镜头
      const dist = st.hidden ? st.dist * .75 : st.dist, pit = st.hidden ? Math.max(.2, st.pitch - .12) : st.pitch;
      const want = new T.Vector3(st.pos.x + Math.sin(st.yaw) * Math.cos(pit) * dist, 1.3 + Math.sin(pit) * dist, st.pos.z + Math.cos(st.yaw) * Math.cos(pit) * dist);
      if (want.z < -7.6) { const k = (st.pos.z + 7.6) / Math.max(.01, st.pos.z - want.z); want.lerpVectors(new T.Vector3(st.pos.x, 1.3, st.pos.z), want, Math.max(.15, k)); }
      cam.position.lerp(want, Math.min(1, dt * 7)); cam.lookAt(st.pos.x, 1.2, st.pos.z);
      W.sky.position.copy(cam.position);
      // 挡在镜头和主角之间的路边小品先藏起来
      const ax = st.pos.x, az = st.pos.z, bx = cam.position.x - ax, bz = cam.position.z - az, bl = bx * bx + bz * bz || 1;
      W.occ.forEach(g => { const u = g.userData; if (!u.c) { const b = new T.Box3().setFromObject(g), c = b.getCenter(new T.Vector3()); u.c = c; u.r = Math.max(1, Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2); } const tt = ((u.c.x - ax) * bx + (u.c.z - az) * bz) / bl; const qx = ax + bx * tt - u.c.x, qz = az + bz * tt - u.c.z; const lat = Math.sqrt(qx * qx + qz * qz), dc = Math.hypot(u.c.x - cam.position.x, u.c.z - cam.position.z); g.visible = !((tt > .12 && tt < 1.25 && lat < u.r + .9 + tt * 2.2) || dc < u.r + 3.5); });
      sun.position.set(st.pos.x + th.sun[2][0], th.sun[2][1], st.pos.z + th.sun[2][2]); sun.target.position.copy(st.pos);
      render();
      // 互动提示
      const a = B ? null : current(), cv0 = B || st.hidden ? null : nearCover();
      const key = a ? a.k + (a.n || '') : '', ck = (cv0 ? 'c' : '') + (st.hidden ? 'h' : '');
      if (key + ck !== lastAct) { lastAct = key + ck;
        pMain.dataset.tip = '快捷键 E'; pMain.innerHTML = a ? E(a.e) + '<b>' + esc(a.n) + '</b><small>' + esc(a.s) + '</small>' : ''; pMain.className = 'xp-main' + (a ? ' show' : '') + (a && /amb|jump|fight/.test(a.k) ? ' danger' : '');
        pSub.dataset.tip = '快捷键 空格'; pSub.innerHTML = st.hidden ? '<b>离开掩体</b>' : cv0 ? E('🫥') + '<b>躲藏</b>' : ''; pSub.className = 'xp-sub' + (st.hidden || cv0 ? ' show' : '');
        hydrate(prompt);
      }
      // 标签（每两帧一次）
      if ((labT ^= 1)) {
        const r = cv.getBoundingClientRect();
        labels.forEach(L => { const wp = L.pos(), d = wp.distanceTo(st.pos); const q = wp.project(cam); const vis = q.z < 1 && (d < L.maxD || st.eye) && !(L.hideNear && d < 3.2) && q.x > -1.2 && q.x < 1.2;
          L.el.style.display = vis ? '' : 'none'; if (!vis) return; L.el.style.transform = 'translate(' + ((q.x + 1) / 2 * r.width).toFixed(1) + 'px,' + ((1 - q.y) / 2 * r.height).toFixed(1) + 'px) translate(-50%,-100%) scale(' + Math.max(.6, Math.min(1.1, 9 / d)).toFixed(2) + ')'; L.el.style.zIndex = 1000 - Math.round(d * 10); });
      }
      mapT += dt; if (mapT > .08) { mapT = 0; drawMap(); }
    }
    function drawMap() {
      const S0 = 360, c = S0 / 2, k = 7.5; mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, S0, S0);
      mx.save(); mx.beginPath(); mx.arc(c, c, c - 6, 0, 7); mx.clip(); mx.fillStyle = 'rgba(0,0,0,.82)'; mx.fillRect(0, 0, S0, S0);
      mx.translate(c, c); mx.rotate(st.yaw); mx.scale(k, k); mx.translate(-st.pos.x, -st.pos.z);
      mx.fillStyle = '#3a3a3a'; mx.fillRect(-20, -3, LX + 40, 6); mx.fillStyle = '#262626'; mx.fillRect(-20, -7.2, LX + 40, 4.2); mx.fillRect(-20, 3, LX + 40, 4.2);
      W.rects.forEach(rc => { mx.fillStyle = hex(rc[4]); mx.fillRect(rc[0], rc[2], rc[1] - rc[0] - .3, rc[3] - rc[2]); });
      W.covers.forEach(cv1 => { mx.fillStyle = '#8a8a8a'; mx.fillRect(cv1.x - .6, cv1.z - .6, 1.2, 1.2); });
      S.spots.forEach(s => { const v = W.spotPos[s.id]; mx.save(); mx.translate(v.x, v.z); mx.rotate(Math.PI / 4); mx.fillStyle = p.hm.spots[id + ':' + s.id] ? '#777' : '#fff'; mx.fillRect(-.7, -.7, 1.4, 1.4); mx.restore(); });
      W.chests.forEach(ch => { if (ch.open) return; mx.fillStyle = ch.gold ? '#ffd040' : '#e0a040'; mx.fillRect(ch.x - .6, ch.z - .5, 1.2, 1); });
      npcs.forEach(n => { mx.fillStyle = '#3fd0ff'; mx.beginPath(); mx.arc(n.g.position.x, n.g.position.z, .6, 0, 7); mx.fill(); });
      shadows.forEach(sh => { if (sh.gone) return; const g = sh.g.position; if (sh.state !== 'patrol' || st.eye) { mx.fillStyle = sh.state === 'alert' ? 'rgba(255,30,50,.35)' : 'rgba(255,200,60,.25)'; mx.beginPath(); mx.moveTo(g.x, g.z); const a0 = Math.PI / 2 - sh.face; mx.arc(g.x, g.z, VIS_R, a0 - VIS_A, a0 + VIS_A); mx.closePath(); mx.fill(); } mx.fillStyle = '#e60012'; mx.beginPath(); mx.arc(g.x, g.z, .8, 0, 7); mx.fill(); mx.strokeStyle = '#fff'; mx.lineWidth = .2; mx.stroke(); });
      mx.fillStyle = '#e60012'; mx.fillRect(W.exit.x - 1, W.exit.z - .6, 2, 1.2);
      mx.restore();
      // 主角箭头（地图随镜头旋转 → 箭头指向 = 朝向 - 镜头）
      mx.save(); mx.translate(c, c); mx.rotate(-(st.face - st.yaw) + Math.PI); mx.fillStyle = '#fff'; mx.strokeStyle = '#e60012'; mx.lineWidth = 3; mx.beginPath(); mx.moveTo(0, -14); mx.lineTo(10, 10); mx.lineTo(0, 4); mx.lineTo(-10, 10); mx.closePath(); mx.fill(); mx.stroke(); mx.restore();
      mx.strokeStyle = '#fff'; mx.lineWidth = 6; mx.beginPath(); mx.arc(c, c, c - 6, 0, 7); mx.stroke(); mx.strokeStyle = '#e60012'; mx.lineWidth = 3; mx.beginPath(); mx.arc(c, c, c - 12, 0, 7); mx.stroke();
    }
    loop();
    function dispose() {
      if (dead) return; dead = true; cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keydown', kd); removeEventListener('keyup', ku); document.body.classList.remove('kgame');
      try { sc.traverse(o => { if (o.geometry) o.geometry.dispose(); }); rd.dispose(); rd.forceContextLoss(); } catch (e) {}
    }
    Core.onLeave(dispose);
    if (resume.x == null) setTimeout(() => dialog(p.pet.name, th.palace ? '这里……好像是谁内心的殿堂。小心暗影！' : '一起出去走走吧！'), 700);
    X._dbg = { st, shadows, npcs, collide, moveStep, current, W, cam, sc, render, heroG, get hero() { return hero; } };
  }
  const VIS_R = 7.5, VIS_A = .85;

  window.Explore3D = X;
})();
