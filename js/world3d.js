/* 3D 星星岛：three.js 程序化建模的浮岛世界 */
(function () {
  const W = {};
  let T, renderer, scene, camera, raf, container, labelsEl, clock, ocean, oceanBase, clouds = [], spinners = [], zoneObjs = {}, anchors = [], sparkles, onPick, hovered = null, opts;
  let yaw = 0.6, pitch = 0.7, dist = 110, tYaw = 0.6, tDist = 82, autoRot = true, lastInteract = 0;

  const PALETTE = {
    kid: { skyTop: 0x5ec8ff, skyBot: 0xdff6ff, fog: 0xcfefff, sea: 0x2fb5e8, seaDeep: 0x1678c2, sun: 0xffffff, sunI: 2.2, hemiSky: 0xbfe9ff, hemiGround: 0x8fd18f, hemiI: 1.25, grass: 0x6ccf5a, sand: 0xf3d99b, exposure: 1.05, night: 0 },
    mid: { skyTop: 0x3d8fe0, skyBot: 0xffe2b8, fog: 0xf7dcc0, sea: 0x2a9bd1, seaDeep: 0x0f5c99, sun: 0xfff1d6, sunI: 2.4, hemiSky: 0xcfe6ff, hemiGround: 0x9a8a6a, hemiI: 1.0, grass: 0x5cb04e, sand: 0xe9cf95, exposure: 1.0, night: .2 },
    pixel: { skyTop: 0x4aa8ff, skyBot: 0xb8ecff, fog: 0xa8e0ff, sea: 0x2f8fff, seaDeep: 0x1050b0, sun: 0xffffff, sunI: 2.3, hemiSky: 0xcfefff, hemiGround: 0x7acb5a, hemiI: 1.3, grass: 0x58d040, sand: 0xffd88a, exposure: 1.05, night: 0, pixelate: .28 },
    ink: { skyTop: 0xd9d4c4, skyBot: 0xf6f1e4, fog: 0xebe5d6, sea: 0x93a8a3, seaDeep: 0x5f726e, sun: 0xfffaf0, sunI: 2.0, hemiSky: 0xf2eee2, hemiGround: 0x8c8a7c, hemiI: 1.25, grass: 0x6f8f6a, sand: 0xd8cfb6, exposure: 1.0, night: 0, post: 'ink', fogNear: 45, fogFar: 150 },
    neon: { skyTop: 0x05020f, skyBot: 0x3a0b5a, fog: 0x1a0630, sea: 0x14093a, seaDeep: 0x05020f, sun: 0xd0b0ff, sunI: 1.4, hemiSky: 0x5a3aff, hemiGround: 0x200030, hemiI: .7, grass: 0x1b3a5a, sand: 0x2a1a4a, exposure: 1.2, night: .9, post: 'neon' },
    paper: { skyTop: 0xffd6e0, skyBot: 0xfff4e6, fog: 0xffeedd, sea: 0x8fd3e8, seaDeep: 0x5fb3cf, sun: 0xffffff, sunI: 2.0, hemiSky: 0xffffff, hemiGround: 0xe8d8c0, hemiI: 1.5, grass: 0x9edc8a, sand: 0xffe3b0, exposure: 1.0, night: 0, post: 'paper' },
    sketch: { skyTop: 0xfdfbf2, skyBot: 0xfffef8, fog: 0xfdfbf2, sea: 0xbfe0f5, seaDeep: 0x9cc8e6, sun: 0xffffff, sunI: 1.6, hemiSky: 0xffffff, hemiGround: 0xdcd6c6, hemiI: 1.8, grass: 0xc8eab0, sand: 0xfff0c8, exposure: 1.0, night: 0, post: 'sketch' },
    sticker: { skyTop: 0xc9b8ff, skyBot: 0xffe0f2, fog: 0xf5e8ff, sea: 0x6fd0ff, seaDeep: 0x3aa0e8, sun: 0xffffff, sunI: 2.2, hemiSky: 0xffffff, hemiGround: 0xd8c8ff, hemiI: 1.4, grass: 0x7fe07a, sand: 0xffe39a, exposure: 1.05, night: 0, post: 'sticker' },
    water: { skyTop: 0xbfdcf5, skyBot: 0xfbf3e6, fog: 0xf6efe3, sea: 0x9fcde8, seaDeep: 0x7fb0d0, sun: 0xfff8ee, sunI: 1.8, hemiSky: 0xfffaf0, hemiGround: 0xd9cdb8, hemiI: 1.5, grass: 0xa8d8a0, sand: 0xf3e0bc, exposure: 1.0, night: 0, post: 'water', fogNear: 50, fogFar: 170 },
    clay: { skyTop: 0xffc9b0, skyBot: 0xffeedd, fog: 0xffe6d6, sea: 0x8fd6e0, seaDeep: 0x60b0c4, sun: 0xfff2e6, sunI: 2.1, hemiSky: 0xfff2ea, hemiGround: 0xd8b8a0, hemiI: 1.4, grass: 0x9ad890, sand: 0xffd9a8, exposure: 1.02, night: 0, post: 'clay' },
    pro: { skyTop: 0x1a1f4a, skyBot: 0xff9a6b, fog: 0x6a5a8a, sea: 0x24507e, seaDeep: 0x0c1d3a, sun: 0xffc59a, sunI: 2.6, hemiSky: 0x7c86d6, hemiGround: 0x3a2d4a, hemiI: .8, grass: 0x4f9a52, sand: 0xd7b98a, exposure: 1.1, night: .75 },
  };

  // 只探测一次（以前每进一次主地图都新建一个 WebGL 上下文又不释放），探测用的上下文马上释放
  let sup = null;
  W.supported = function () { if (window.__TEST_LITE || !window.THREE) return false; if (sup != null) return sup; try { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'), l = gl && gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); sup = !!gl; } catch (e) { sup = false; } return sup; };

  W.init = function (el, o) {
    T = window.THREE; container = el; opts = o; onPick = o.onPick;
    const P = PALETTE[o.theme] || PALETTE.kid;
    renderer = Perf.renderer({ antialias: !P.pixelate, alpha: false, powerPreference: 'high-performance' }, { dpr: P.pixelate || 2, fixed: !!P.pixelate, shadows: true });
    if (P.pixelate) renderer.domElement.style.imageRendering = 'pixelated';
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = P.exposure;
    renderer.outputColorSpace = T.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    labelsEl = document.createElement('div'); labelsEl.className = 'w3-labels'; el.appendChild(labelsEl);
    scene = new T.Scene(); scene.fog = new T.Fog(P.fog, P.fogNear || 80, P.fogFar || 220);
    camera = new T.PerspectiveCamera(42, 1, .5, 600);
    clock = new T.Clock();

    // 天空
    const skyGeo = new T.SphereGeometry(300, 32, 16);
    const skyMat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new T.Color(P.skyTop) }, bot: { value: new T.Color(P.skyBot) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+.15,0.,1.); gl_FragColor = vec4(mix(bot, top, pow(h,.8)),1.); }' });
    scene.add(new T.Mesh(skyGeo, skyMat));
    if (P.night > .3) addStars(P.night);

    // 光照
    scene.add(new T.HemisphereLight(P.hemiSky, P.hemiGround, P.hemiI));
    const sun = new T.DirectionalLight(P.sun, P.sunI);
    sun.position.set(o.theme === 'pro' ? -40 : 30, o.theme === 'pro' ? 22 : 50, 25); sun.castShadow = true;
    sun.shadow.mapSize.setScalar(Perf.shadowSize(2048)); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 }); sun.shadow.bias = -0.0005;
    scene.add(sun);
    if (o.theme === 'pro') { const rim = new T.DirectionalLight(0x8fa8ff, .6); rim.position.set(40, 20, -30); scene.add(rim); }

    buildOcean(P);
    buildWorld(P, o);
    buildClouds(P);
    buildSparkles(o.theme);
    if (P.post) stylize(P.post);

    resize(); addEventListener('resize', resize);
    if (o.cinematic) { pitch = .26; tDist = dist = 64; yaw = tYaw = 2.2; renderer.domElement.style.pointerEvents = 'none'; } else { pitch = .7; yaw = tYaw = .6; dist = 110; resize(); bindInput(); }
    autoRot = true; loop();
  };

  function mat(color, extra) { return new T.MeshStandardMaterial(Object.assign({ color, roughness: .78, metalness: 0, flatShading: true }, extra || {})); }
  function mesh(geo, m, x, y, z, cast) { const me = new T.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); me.castShadow = cast !== false; me.receiveShadow = true; return me; }

  function addStars(k) {
    const g = new T.BufferGeometry(), n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * .45; pos[i * 3] = 280 * Math.cos(th) * Math.sin(ph + .1); pos[i * 3 + 1] = 280 * Math.cos(ph) * .9 + 20; pos[i * 3 + 2] = 280 * Math.sin(th) * Math.sin(ph + .1); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: k, fog: false })));
  }

  function buildOcean(P) {
    const seg = Perf.tier() ? 110 : 56, g = new T.PlaneGeometry(420, 420, seg, seg); g.rotateX(-Math.PI / 2); // 省电档海面网格减半（每帧都要重算顶点和法线）
    oceanBase = g.attributes.position.array.slice();
    const m = new T.MeshStandardMaterial({ color: P.sea, roughness: .25, metalness: .15, flatShading: true, transparent: true, opacity: .96 });
    ocean = new T.Mesh(g, m); ocean.receiveShadow = true; ocean.position.y = -0.4; scene.add(ocean);
    const deep = new T.Mesh(new T.PlaneGeometry(420, 420), new T.MeshBasicMaterial({ color: P.seaDeep })); deep.rotation.x = -Math.PI / 2; deep.position.y = -3; scene.add(deep);
  }

  // 一座小岛：不规则顶面 + 沙滩 + 岩石底
  function island(r, P, seed) {
    const g = new T.Group();
    const top = new T.CylinderGeometry(r, r * 1.08, 1.6, 22, 2);
    const pa = top.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y > .7) pa.setY(i, y + Math.sin(pa.getX(i) * .9 + seed) * .25 + Math.cos(pa.getZ(i) * .7 + seed) * .25); }
    top.computeVertexNormals();
    g.add(mesh(top, mat(P.grass), 0, 1.2, 0, false));
    g.add(mesh(new T.CylinderGeometry(r * 1.1, r * 1.25, .9, 22), mat(P.sand), 0, .15, 0, false));
    const rock = new T.ConeGeometry(r * 1.05, r * 1.3, 9); rock.rotateX(Math.PI);
    g.add(mesh(rock, mat(0x8a7a6a), 0, -r * .65, 0, false));
    return g;
  }
  function tree(P, s) {
    const g = new T.Group(); s = s || 1;
    g.add(mesh(new T.CylinderGeometry(.18 * s, .25 * s, 1.2 * s, 6), mat(0x8b5a2b), 0, .6 * s, 0));
    const c = P.night > .5 ? 0x3d8a4a : 0x46b14f;
    g.add(mesh(new T.ConeGeometry(1 * s, 1.8 * s, 7), mat(c), 0, 1.8 * s, 0));
    g.add(mesh(new T.ConeGeometry(.75 * s, 1.4 * s, 7), mat(c), 0, 2.6 * s, 0));
    return g;
  }
  function roundTree(P, s, col) { const g = new T.Group(); s = s || 1; g.add(mesh(new T.CylinderGeometry(.15 * s, .22 * s, 1.3 * s, 6), mat(0x7a4a22), 0, .65 * s, 0)); g.add(mesh(new T.IcosahedronGeometry(.95 * s, 0), mat(col || 0x5cc062), 0, 1.9 * s, 0)); return g; }
  function house(w, d, hgt, wall, roof, P) {
    const g = new T.Group();
    g.add(mesh(new T.BoxGeometry(w, hgt, d), mat(wall), 0, hgt / 2, 0));
    const rf = new T.ConeGeometry(Math.max(w, d) * .78, hgt * .8, 4); rf.rotateY(Math.PI / 4);
    g.add(mesh(rf, mat(roof), 0, hgt + hgt * .4, 0));
    const win = new T.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffc94a, emissiveIntensity: P.night > .3 ? 1.6 : .15 });
    g.add(mesh(new T.BoxGeometry(w * .28, hgt * .28, .05), win, -w * .2, hgt * .55, d / 2 + .01, false));
    g.add(mesh(new T.BoxGeometry(w * .22, hgt * .45, .05), mat(0x7a4a22), w * .22, hgt * .23, d / 2 + .01, false));
    return g;
  }

  // 糊涂龙城堡：缩放 s、离中心水平距离 r、高度 h、标签锚点相对城堡底座的高度 top（未缩放）
  const DRAGON = { s: .6, r: 56, h: 16, top: 12 };
  let dragonPivot = null, dragonAnchor = null;
  let ZPOS = {};
  const layout = ids => { ZPOS = {}; ids.forEach((id, i) => { const a = i / ids.length * Math.PI * 2 - Math.PI * .75, r = ids.length > 6 ? 31 : 24; ZPOS[id] = [Math.cos(a) * r, 0, Math.sin(a) * r]; }); };
  function buildWorld(P, o) {
    const world = new T.Group(); scene.add(world);
    // 中央岛：家园 + 星星树
    const home = island(9, P, 1); world.add(home);
    const bigTree = new T.Group();
    bigTree.add(mesh(new T.CylinderGeometry(.6, 1, 4.5, 8), mat(0x8b5a2b), 0, 4, 0));
    [[0, 7, 0, 2.8], [-1.6, 6.2, .6, 1.9], [1.7, 6.4, -.4, 2], [.3, 8.6, .2, 1.8]].forEach(a => bigTree.add(mesh(new T.IcosahedronGeometry(a[3], 1), mat(P.night > .5 ? 0x3f9a58 : 0x58c46a), a[0], a[1], a[2])));
    const star = starMesh(1.1, 0xffd23f); star.position.set(.3, 11, .2); bigTree.add(star); spinners.push({ o: star, s: 1.2, bob: .3, y: 11 });
    const starLight = new T.PointLight(0xffd23f, P.night > .3 ? 40 : 10, 20); starLight.position.set(0, 11, 0); bigTree.add(starLight);
    bigTree.position.set(-1.5, 1.5, -1.5); world.add(bigTree);
    const hm = house(3.2, 2.6, 2.4, 0xfff4e0, 0xe8505b, P); hm.position.set(3.6, 1.6, 2.6); hm.rotation.y = -.5; world.add(hm);
    const petHouse = house(1.8, 1.6, 1.4, 0xffd6a5, 0x5b7cfa, P); petHouse.position.set(-4.6, 1.6, 3.6); petHouse.rotation.y = .6; world.add(petHouse);
    [[5.5, -3.5], [-6, -2], [1, 6], [-2.5, 6.4]].forEach((p, i) => { const t = roundTree(P, .8 + i * .1, [0x5cc062, 0xf28fb0, 0xffb347, 0x5cc062][i]); t.position.set(p[0], 1.6, p[1]); world.add(t); });
    registerZone('home', home, [0, 13.5, 0], world);

    // 五个区域
    layout(o.zones || ['cn', 'math', 'en', 'sci', 'life']);
    const builders = { cn: buildCN, math: buildMath, en: buildEN, sci: buildSci, life: buildLife, art: buildArt, geo: buildGeo, cul: buildCul, logic: buildLogic, job: buildJob };
    Object.keys(ZPOS).forEach((id, i) => {
      const g = island(6.2, P, i * 3 + 2); const [x, y, z] = ZPOS[id]; g.position.set(x, y, z);
      (builders[id] || buildLife)(g, P);
      world.add(g);
      // 桥
      const from = new T.Vector3(0, 0, 0), to = new T.Vector3(x, 0, z), dir = to.clone().sub(from), len = dir.length();
      const n = Math.floor((len - 14.5) / .9);
      for (let k = 0; k < n; k++) { const p = from.clone().add(dir.clone().multiplyScalar((8.6 + k * .9 + .45) / len)); const pl = mesh(new T.BoxGeometry(2, .18, .7), mat(0xb07a45), p.x, .55 + Math.sin(k / n * Math.PI) * .5, p.z); pl.rotation.y = -Math.atan2(dir.z, dir.x) + Math.PI / 2; world.add(pl); }
      // 宝石
      const has = o.gems && o.gems[id];
      const gem = new T.Mesh(new T.OctahedronGeometry(.9, 0), new T.MeshStandardMaterial({ color: has ? new T.Color(o.zoneColors[id]) : 0x9aa3b5, emissive: has ? new T.Color(o.zoneColors[id]) : 0x000000, emissiveIntensity: has ? .8 : 0, metalness: .3, roughness: .2, flatShading: true, transparent: !has, opacity: has ? 1 : .55 }));
      gem.position.set(x, 11, z); gem.castShadow = true; world.add(gem); spinners.push({ o: gem, s: 1.5, bob: .4, y: 11 });
      registerZone(id, g, [x, 12.6, z], world);
    });

    // 糊涂龙浮空城堡
    const sky = new T.Group();
    const rock = new T.ConeGeometry(6, 9, 8); rock.rotateX(Math.PI);
    sky.add(mesh(rock, mat(0x6b5b7b), 0, -4.5, 0));
    sky.add(mesh(new T.CylinderGeometry(6, 6, 1, 8), mat(0x7b8a6a), 0, .5, 0));
    const dark = mat(o.dragon ? 0xf5e6ff : 0x4a3a6a), roofM = mat(o.dragon ? 0xffd23f : 0x2a1a4a);
    [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].forEach(p => { sky.add(mesh(new T.CylinderGeometry(.9, 1, 5, 8), dark, p[0], 3.5, p[1])); sky.add(mesh(new T.ConeGeometry(1.2, 2, 8), roofM, p[0], 7, p[1])); });
    sky.add(mesh(new T.BoxGeometry(5, 3.5, 5), dark, 0, 2.75, 0));
    sky.add(mesh(new T.CylinderGeometry(1.4, 1.5, 7, 8), dark, 0, 5, 0)); sky.add(mesh(new T.ConeGeometry(1.9, 3, 8), roofM, 0, 10, 0));
    const glow = new T.PointLight(o.dragon ? 0xffd23f : 0xb05cff, 60, 30); glow.position.set(0, 6, 4); sky.add(glow);
    // 固定位置时它总在画面外，所以外层 pivot 每帧摆到镜头正对面、岛环后方的天空里（见 loop）
    dragonPivot = new T.Group(); dragonPivot.scale.setScalar(DRAGON.s); dragonPivot.add(sky); world.add(dragonPivot);
    spinners.push({ o: sky, s: 0, bob: .8, y: 0 });
    registerZone('dragon', sky, [0, DRAGON.h + DRAGON.top * DRAGON.s, -DRAGON.r], world);
    dragonAnchor = anchors[anchors.length - 1].p;

    // 远处小岛装饰
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + .3, r = 78 + (i % 3) * 14; const g = island(2 + (i % 3), P, i); g.position.set(Math.cos(a) * r, -.2, Math.sin(a) * r); const t = (i % 2 ? tree : roundTree)(P, .8); t.position.y = 1.6; g.add(t); world.add(g); }
  }
  function starMesh(r, col) {
    const s = new T.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .45 : r; const x = Math.cos(a) * rr, y = -Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
    const g = new T.ExtrudeGeometry(s, { depth: .35, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 1 }); g.center();
    return new T.Mesh(g, new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .6, metalness: .3, roughness: .3 }));
  }
  function buildCN(g, P) { // 古亭 + 竹林 + 书卷
    const red = mat(0xc8382e), roof = mat(0x2f5d50), gold = mat(0xe8b84a);
    const pav = new T.Group();
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(p => pav.add(mesh(new T.CylinderGeometry(.16, .16, 2.4, 8), red, p[0], 1.2, p[1])));
    pav.add(mesh(new T.BoxGeometry(3.6, .25, 3.6), mat(0xd9c7a5), 0, .12, 0));
    for (let k = 0; k < 3; k++) { const r = new T.ConeGeometry(2.9 - k * .8, .9, 4); r.rotateY(Math.PI / 4); pav.add(mesh(r, roof, 0, 2.7 + k * .75, 0)); }
    pav.add(mesh(new T.SphereGeometry(.22, 8, 6), gold, 0, 4.6, 0));
    pav.position.set(.5, 1.9, .5); g.add(pav);
    for (let i = 0; i < 9; i++) { const b = mesh(new T.CylinderGeometry(.1, .1, 3 + Math.random() * 2, 5), mat(0x7cc46a), -3.4 + Math.random() * 1.5, 3.2, -2.5 + Math.random() * 5); b.rotation.z = (Math.random() - .5) * .2; g.add(b); }
    const t1 = tree(P, .9); t1.position.set(3.4, 1.9, -2.4); g.add(t1); const t2 = roundTree(P, .8, 0xf28fb0); t2.position.set(3.2, 1.9, 2.8); g.add(t2);
  }
  function buildMath(g, P) { // 城堡
    const wall = mat(0xe8ecf7), roof = mat(0x5b7cfa), flag = mat(0xffd23f);
    [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]].forEach(p => { g.add(mesh(new T.CylinderGeometry(.85, .95, 4.2, 10), wall, p[0], 4, p[1])); g.add(mesh(new T.ConeGeometry(1.15, 2, 10), roof, p[0], 7.1, p[1])); });
    g.add(mesh(new T.BoxGeometry(4.8, 2.6, 4.8), wall, 0, 3.2, 0));
    g.add(mesh(new T.CylinderGeometry(1.3, 1.4, 5.5, 10), wall, 0, 4.6, 0)); g.add(mesh(new T.ConeGeometry(1.7, 2.6, 10), roof, 0, 8.6, 0));
    const fl = mesh(new T.BoxGeometry(.9, .55, .05), flag, .45, 10.4, 0); g.add(fl); g.add(mesh(new T.CylinderGeometry(.04, .04, 1.4, 4), mat(0x555555), 0, 10.3, 0));
    const win = new T.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffc94a, emissiveIntensity: P.night > .3 ? 1.5 : .1 });
    g.add(mesh(new T.BoxGeometry(.9, 1.4, .1), mat(0x7a4a22), 0, 2.6, 2.42, false)); g.add(mesh(new T.BoxGeometry(.5, .7, .1), win, 0, 5.2, 1.36, false));
    // 数字方块
    ['1', '2', '3'].forEach((n, i) => { const c = mesh(new T.BoxGeometry(.9, .9, .9), mat([0xff5d73, 0xffd23f, 0x3ec1d3][i]), -3.5 + i * 1.1, 2.4, 3.6); c.rotation.y = i * .4; g.add(c); });
  }
  function buildEN(g, P) { // 灯塔 + 小船
    for (let k = 0; k < 6; k++) g.add(mesh(new T.CylinderGeometry(1.1 - k * .1, 1.2 - k * .1, 1.2, 14), mat(k % 2 ? 0xffffff : 0xe8505b), -1, 2.5 + k * 1.2, -1));
    g.add(mesh(new T.CylinderGeometry(.7, .7, 1, 10), new T.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffd23f, emissiveIntensity: 1.2 }), -1, 9.9, -1));
    g.add(mesh(new T.ConeGeometry(.95, 1, 10), mat(0x2b3a67), -1, 10.9, -1));
    const beam = new T.PointLight(0xffe08a, 50, 35); beam.position.set(-1, 10, -1); g.add(beam);
    const hs = house(2.2, 1.8, 1.8, 0xd9f2ff, 0x22a6c9, P); hs.position.set(2.4, 1.9, 1.2); g.add(hs);
    const boat = new T.Group();
    const hull = new T.CylinderGeometry(.9, .5, 3.2, 8, 1, false, 0, Math.PI); hull.rotateZ(Math.PI / 2); hull.rotateX(Math.PI);
    boat.add(mesh(hull, mat(0xb0683a), 0, 0, 0)); boat.add(mesh(new T.CylinderGeometry(.06, .06, 2.6, 4), mat(0x6a4a2a), 0, 1.3, 0));
    const sail = new T.ConeGeometry(1, 2, 3); boat.add(mesh(sail, mat(0xffffff), .35, 1.5, 0));
    boat.position.set(5.5, .1, 5.5); g.add(boat); spinners.push({ o: boat, s: 0, bob: .15, y: .1, rock: true });
    const t = roundTree(P, .7); t.position.set(2.8, 1.9, -2.8); g.add(t);
  }
  function buildSci(g, P) { // 天文台 + 行星
    g.add(mesh(new T.CylinderGeometry(2.4, 2.6, 2.6, 16), mat(0xf2f2f7), 0, 3.1, 0));
    const dome = new T.SphereGeometry(2.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    g.add(mesh(dome, mat(0x8a5cf6, { metalness: .4, roughness: .35 }), 0, 4.4, 0));
    const tel = mesh(new T.CylinderGeometry(.28, .4, 3, 10), mat(0x2b3a67), .9, 6, .4); tel.rotation.z = -.8; g.add(tel);
    const planet = new T.Group(); planet.add(mesh(new T.SphereGeometry(1, 20, 14), mat(0xffb347, { flatShading: false }), 0, 0, 0));
    const ring = new T.Mesh(new T.TorusGeometry(1.7, .12, 6, 40), mat(0xffe0a3, { flatShading: false })); ring.rotation.x = 1.2; planet.add(ring);
    planet.position.set(-2.8, 8, -1.5); g.add(planet); spinners.push({ o: planet, s: .6, bob: .5, y: 8 });
    const moon = mesh(new T.SphereGeometry(.45, 12, 8), mat(0xc9d1ff, { flatShading: false }), 2.8, 7.5, 2); g.add(moon); spinners.push({ o: moon, s: 0, bob: .35, y: 7.5 });
    const t = tree(P, .8); t.position.set(3.4, 1.9, -2.6); g.add(t);
    for (let i = 0; i < 3; i++) { const c = mesh(new T.OctahedronGeometry(.4 + i * .1), new T.MeshStandardMaterial({ color: 0x7af0ff, emissive: 0x3ac8ff, emissiveIntensity: .7, roughness: .1 }), -3 + i * .7, 2.3, 3 - i * .4); g.add(c); }
  }
  function buildLife(g, P) { // 小镇
    const cols = [[0xffe8c2, 0xf29a2e], [0xd7f5d0, 0x3fb27f], [0xffd6e0, 0xe8505b], [0xdde6ff, 0x5b7cfa]];
    [[-2.4, -1.8, 0], [1.2, -2.6, .4], [2.9, .9, -.3], [-1.6, 2.2, .2]].forEach((p, i) => { const hs = house(1.9 + (i % 2) * .4, 1.8, 1.7 + (i % 3) * .4, cols[i][0], cols[i][1], P); hs.position.set(p[0], 1.9, p[1]); hs.rotation.y = p[2] + Math.atan2(p[0], p[1]); g.add(hs); });
    g.add(mesh(new T.CylinderGeometry(1, 1.1, .5, 14), mat(0xd8d8e0), .4, 2.1, .2)); g.add(mesh(new T.CylinderGeometry(.8, .8, .1, 14), new T.MeshStandardMaterial({ color: 0x6fd3ff, roughness: .1 }), .4, 2.36, .2));
    const t = roundTree(P, .75, 0xffb347); t.position.set(-3.6, 1.9, .8); g.add(t);
  }


  function buildArt(g, P) { // 剧院 + 调色盘 + 画架
    const stage = new T.Group();
    stage.add(mesh(new T.CylinderGeometry(3, 3.2, .6, 20, 1, false, 0, Math.PI), mat(0x8b4a2b), 0, .3, 0));
    stage.add(mesh(new T.BoxGeometry(6.4, 4, .3), mat(0x7a1f3d), 0, 2.6, -.2));
    [-2.6, 2.6].forEach(x => { const c = mesh(new T.CylinderGeometry(.5, .8, 4, 8), mat(0xd6335a), x, 2.4, .2); stage.add(c); });
    stage.add(mesh(new T.BoxGeometry(6.6, .6, .8), mat(0xe8b84a), 0, 4.7, 0));
    stage.position.set(-.6, 1.9, -1.4); g.add(stage);
    const pal = new T.Group(); pal.add(mesh(new T.CylinderGeometry(1.5, 1.5, .2, 18), mat(0xf3d9a4), 0, 0, 0));
    [0xff4d4d, 0xffd23f, 0x3d7bff, 0x2ecc71, 0x9b5cf6].forEach((c, i) => { const a = i / 5 * Math.PI * 1.6; pal.add(mesh(new T.SphereGeometry(.28, 10, 8), mat(c, { flatShading: false }), Math.cos(a) * 1, .18, Math.sin(a) * 1)); });
    pal.position.set(3.2, 2.2, 2.6); pal.rotation.x = -.3; g.add(pal);
    const ea = new T.Group(); [-.5, .5].forEach(x => ea.add(mesh(new T.BoxGeometry(.12, 2.6, .12), mat(0x8b5a2b), x, 1.3, 0))); ea.add(mesh(new T.BoxGeometry(1.6, 1.2, .08), mat(0xffffff), 0, 1.8, .1)); ea.add(mesh(new T.BoxGeometry(1.2, .8, .02), mat(0x5ec8ff), 0, 1.85, .16));
    ea.position.set(-3.6, 1.9, 2.4); ea.rotation.y = .6; g.add(ea);
    const note = new T.Group(); note.add(mesh(new T.SphereGeometry(.5, 12, 8), mat(0x2b3a67, { flatShading: false }), 0, 0, 0)); note.add(mesh(new T.BoxGeometry(.12, 1.8, .12), mat(0x2b3a67), .45, .9, 0));
    note.position.set(2.8, 7, -1); g.add(note); spinners.push({ o: note, s: 1, bob: .4, y: 7 });
  }
  function buildGeo(g, P) { // 地球仪 + 小飞机 + 山
    const globe = new T.Group();
    globe.add(mesh(new T.CylinderGeometry(.8, 1.2, .5, 12), mat(0x8b5a2b), 0, .25, 0));
    globe.add(mesh(new T.CylinderGeometry(.12, .12, 1.4, 6), mat(0xc9a14a), 0, 1, 0));
    const ball = new T.Group(); ball.add(mesh(new T.SphereGeometry(2, 20, 14), mat(0x2f8fe0, { flatShading: false, roughness: .4 }), 0, 0, 0));
    for (let i = 0; i < 7; i++) { const a = i * 1.7, b = (i % 3 - 1) * .6; const land = mesh(new T.SphereGeometry(.7 + (i % 3) * .2, 8, 6), mat(0x4fbf5a), Math.cos(a) * Math.cos(b) * 1.75, Math.sin(b) * 1.75, Math.sin(a) * Math.cos(b) * 1.75); land.scale.set(1, .5, 1); land.lookAt(0, 0, 0); ball.add(land); }
    ball.position.y = 3.6; globe.add(ball); spinners.push({ o: ball, s: .5, bob: 0, y: 3.6 });
    const ring = new T.Mesh(new T.TorusGeometry(2.3, .07, 6, 40, Math.PI * 1.4), mat(0xc9a14a)); ring.position.y = 3.6; ring.rotation.z = .4; globe.add(ring);
    globe.position.set(0, 1.9, -.5); g.add(globe);
    const plane = new T.Group(); plane.add(mesh(new T.CylinderGeometry(.3, .2, 2.4, 8), mat(0xffffff), 0, 0, 0)); plane.children[0].rotation.z = Math.PI / 2;
    plane.add(mesh(new T.BoxGeometry(.6, .06, 2.6), mat(0xe8505b), 0, 0, 0)); plane.add(mesh(new T.BoxGeometry(.4, .7, .06), mat(0xe8505b), -1.1, .35, 0));
    plane.position.set(3.4, 6.5, 2); g.add(plane); spinners.push({ o: plane, s: .8, bob: .5, y: 6.5 });
    [[-3.4, -2.2, 1.6], [-2.4, -3.2, 1.1]].forEach(m => { g.add(mesh(new T.ConeGeometry(m[2], m[2] * 2.2, 6), mat(0x9a8a7a), m[0], 1.9 + m[2] * 1.1, m[1])); g.add(mesh(new T.ConeGeometry(m[2] * .4, m[2] * .8, 6), mat(0xffffff), m[0], 1.9 + m[2] * 1.9, m[1])); });
  }
  function buildCul(g, P) { // 宝塔 + 牌坊 + 灯笼
    const red = mat(0xc8382e), roof = mat(0x2f3d5c), gold = mat(0xe8b84a);
    for (let k = 0; k < 4; k++) { const w = 2.6 - k * .45; g.add(mesh(new T.BoxGeometry(w, 1.3, w), red, -1, 2.55 + k * 1.6, -1)); const r = new T.ConeGeometry(w * .95, .8, 4); r.rotateY(Math.PI / 4); g.add(mesh(r, roof, -1, 3.5 + k * 1.6, -1)); }
    g.add(mesh(new T.ConeGeometry(.2, 1.2, 6), gold, -1, 9.2, -1));
    const gate = new T.Group(); [-1.4, 1.4].forEach(x => gate.add(mesh(new T.CylinderGeometry(.18, .18, 3, 8), red, x, 1.5, 0))); gate.add(mesh(new T.BoxGeometry(3.8, .35, .5), roof, 0, 3.1, 0)); gate.add(mesh(new T.BoxGeometry(3.2, .3, .3), gold, 0, 2.6, 0));
    gate.position.set(2.6, 1.9, 2.4); gate.rotation.y = -.7; g.add(gate);
    const lmat = new T.MeshStandardMaterial({ color: 0xff3b2e, emissive: 0xff5a2e, emissiveIntensity: P.night > .3 ? 1.4 : .45, roughness: .5 });
    [[3.4, -1.6], [1.8, -3.2], [-3.6, 2.6]].forEach(l => { const lan = mesh(new T.SphereGeometry(.45, 10, 8), lmat, l[0], 4, l[1]); lan.scale.y = .8; g.add(lan); spinners.push({ o: lan, s: 0, bob: .2, y: 4 }); });
  }
  function buildLogic(g, P) { // 魔方 + 齿轮 + 机器人
    const cols = [0xff4d4d, 0xffd23f, 0x3d7bff, 0x2ecc71, 0xff9f2e, 0xffffff];
    const cube = new T.Group();
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) cube.add(mesh(new T.BoxGeometry(.9, .9, .9), mat(cols[(x + y * 2 + z * 3 + 9) % 6]), x, y, z));
    cube.position.set(-1.2, 6.2, -1); cube.rotation.set(.5, .6, 0); g.add(cube); spinners.push({ o: cube, s: .6, bob: .4, y: 6.2 });
    g.add(mesh(new T.CylinderGeometry(.5, .8, 3.2, 8), mat(0x6c7a8a), -1.2, 3.4, -1));
    const gear = new T.Group(); gear.add(mesh(new T.CylinderGeometry(1.1, 1.1, .4, 16), mat(0x14b8a6), 0, 0, 0));
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; gear.add(mesh(new T.BoxGeometry(.4, .4, .4), mat(0x14b8a6), Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25)); }
    gear.rotation.x = Math.PI / 2; gear.position.set(2.8, 3.6, -2.2); g.add(gear); spinners.push({ o: gear, s: 1.2, bob: 0, y: 3.6 });
    const bot = new T.Group(); bot.add(mesh(new T.BoxGeometry(1.4, 1.6, 1), mat(0xc9d1e0), 0, .8, 0)); bot.add(mesh(new T.BoxGeometry(1.1, .9, .9), mat(0xdfe6f2), 0, 2.1, 0));
    const eye = new T.MeshStandardMaterial({ color: 0x5ef0ff, emissive: 0x3ac8ff, emissiveIntensity: 1 });
    [-.25, .25].forEach(x => bot.add(mesh(new T.SphereGeometry(.13, 8, 6), eye, x, 2.15, .46)));
    bot.add(mesh(new T.CylinderGeometry(.04, .04, .5, 4), mat(0x555555), 0, 2.8, 0)); bot.add(mesh(new T.SphereGeometry(.12, 8, 6), mat(0xff4d4d), 0, 3.1, 0));
    bot.position.set(2.6, 1.9, 2.4); bot.rotation.y = -.6; g.add(bot);
  }
  function buildJob(g, P) { // 城市：医院、高楼、消防车
    const win = new T.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffc94a, emissiveIntensity: P.night > .3 ? 1.3 : .1 });
    [[-2.6, -1.6, 1.8, 5, 0x9fb3d8], [-.4, -2.8, 1.6, 6.5, 0xc9d1e0], [1.6, -2, 1.5, 4, 0xa8d8c8]].forEach(b => { g.add(mesh(new T.BoxGeometry(b[2], b[3], b[2]), mat(b[4]), b[0], 1.9 + b[3] / 2, b[1])); for (let k = 1; k < b[3]; k += 1.1) g.add(mesh(new T.BoxGeometry(b[2] * .7, .35, .05), win, b[0], 1.9 + k, b[1] + b[2] / 2 + .01, false)); });
    const hosp = new T.Group(); hosp.add(mesh(new T.BoxGeometry(2.6, 2, 2), mat(0xffffff), 0, 1, 0));
    hosp.add(mesh(new T.BoxGeometry(.9, .3, .06), mat(0xe8505b), 0, 1.4, 1.02, false)); hosp.add(mesh(new T.BoxGeometry(.3, .9, .06), mat(0xe8505b), 0, 1.4, 1.03, false));
    hosp.position.set(-2.4, 1.9, 2.2); hosp.rotation.y = .5; g.add(hosp);
    const truck = new T.Group(); truck.add(mesh(new T.BoxGeometry(2.2, .9, 1), mat(0xe8302e), 0, .7, 0)); truck.add(mesh(new T.BoxGeometry(.8, .7, .95), mat(0xe8302e), 1.3, .65, 0)); truck.add(mesh(new T.BoxGeometry(2, .12, .2), mat(0xcccccc), -.1, 1.25, 0));
    [[-.7, .5], [-.7, -.5], [1.2, .5], [1.2, -.5]].forEach(w => { const wh = mesh(new T.CylinderGeometry(.28, .28, .2, 10), mat(0x222222), w[0], .28, w[1]); wh.rotation.x = Math.PI / 2; truck.add(wh); });
    truck.position.set(2.6, 1.9, 2.6); truck.rotation.y = -.9; g.add(truck);
  }
  // 画风后处理：水墨去饱和、霓虹发光描边、纸艺粉彩
  function stylize(kind) {
    const gray = new T.Color(0xcfcabd), white = new T.Color(0xffffff);
    const lines = [];
    scene.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.color || o.material.isShaderMaterial) return;
      const m = o.material = o.material.clone();
      if (kind === 'ink') { const l = m.color.getHSL({}).l; m.color.lerp(gray, .72).offsetHSL(0, 0, (l - .5) * .5); m.roughness = 1; }
      if (kind === 'paper') { m.color.lerp(white, .3); m.roughness = 1; m.metalness = 0; }
      if (kind === 'water') { m.color.lerp(white, .35).offsetHSL(0, -.12, 0); m.roughness = 1; m.flatShading = false; m.transparent = true; m.opacity = .93; }
      if (kind === 'clay') { m.color.lerp(white, .18); m.roughness = 1; m.metalness = 0; m.flatShading = false; }
      if ((kind === 'sketch' || kind === 'sticker') && o.geometry && o.geometry.attributes.position.count < 3000 && o.parent !== scene) {
        if (kind === 'sketch') { m.color.lerp(white, .55); m.roughness = 1; } else { m.color.offsetHSL(0, .15, .05); m.roughness = .5; }
        lines.push([o, new T.LineSegments(new T.EdgesGeometry(o.geometry, 25), new T.LineBasicMaterial({ color: kind === 'sketch' ? 0x2c2a33 : 0xffffff }))]);
      }
      if (kind === 'neon' && o.geometry && o.geometry.attributes.position.count < 3000 && o.parent !== scene) {
        const c = m.color.clone().offsetHSL(0, .3, .15); m.emissive = c.clone().multiplyScalar(.25); m.color.multiplyScalar(.35);
        lines.push([o, new T.LineSegments(new T.EdgesGeometry(o.geometry, 30), new T.LineBasicMaterial({ color: c.offsetHSL(0, 0, .2), transparent: true, opacity: .9 }))]);
      }
    });
    lines.forEach(([o, l]) => o.add(l));
  }

  function registerZone(id, obj, anchor, world) {
    obj.traverse(m => { if (m.isMesh) m.userData.zone = id; });
    zoneObjs[id] = obj; anchors.push({ id, p: new T.Vector3(anchor[0], anchor[1], anchor[2]) });
  }

  function buildClouds(P) {
    const m = new T.MeshStandardMaterial({ color: P.night > .5 ? 0xd8c8e8 : 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: .95 });
    for (let i = 0; i < 12; i++) {
      const c = new T.Group(); const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) { const s = mesh(new T.IcosahedronGeometry(1.4 + Math.random() * 1.2, 1), m, k * 1.8 - n, Math.random() * .8, Math.random() * 1.2, false); c.add(s); }
      const a = Math.random() * Math.PI * 2, r = 75 + Math.random() * 60;
      c.position.set(Math.cos(a) * r, 22 + Math.random() * 16, Math.sin(a) * r); c.userData = { a, r, v: .01 + Math.random() * .02 };
      scene.add(c); clouds.push(c);
    }
  }
  function buildSparkles(theme) {
    const n = 160, g = new T.BufferGeometry(), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 70; pos[i * 3 + 1] = 2 + Math.random() * 18; pos[i * 3 + 2] = (Math.random() - .5) * 70; }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    sparkles = new T.Points(g, new T.PointsMaterial({ color: theme === 'pro' ? 0xffe6a8 : 0xffffff, size: .28, transparent: true, opacity: .8, depthWrite: false }));
    scene.add(sparkles);
  }

  function resize() {
    if (!renderer) return; const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    tDist = opts && opts.cinematic ? (w < h ? 96 : 62) : w < h ? 118 : w < 900 ? 122 : 110; // 十个区的岛环半径 31，镜头要拉远并抬高视点，顶部才放得下糊涂龙城堡
  }

  const ray = new (window.THREE ? THREE.Raycaster : Object)(), mouse = { x: 0, y: 0 };
  function pickAt(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    const v = new T.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, camera);
    const hit = ray.intersectObjects(Object.values(zoneObjs), true)[0];
    return hit ? hit.object.userData.zone : null;
  }
  function bindInput() {
    const el = renderer.domElement; let down = null, moved = false;
    el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw: tYaw }; moved = false; autoRot = false; lastInteract = performance.now(); el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (down) { const dx = e.clientX - down.x; if (Math.abs(dx) > 6) moved = true; tYaw = down.yaw - dx * .006; lastInteract = performance.now(); }
      else { const z = pickAt(e.clientX, e.clientY); setHover(z); el.style.cursor = z ? 'pointer' : 'grab'; }
    });
    el.addEventListener('pointerup', e => { if (down && !moved) { const z = pickAt(e.clientX, e.clientY); if (z && onPick) onPick(z); } down = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); tDist = Math.max(40, Math.min(130, tDist + e.deltaY * .05)); }, { passive: false });
  }
  function setHover(z) {
    if (hovered === z) return; hovered = z;
    Object.entries(zoneObjs).forEach(([id, o]) => { o.userData.hover = id === z; });
    labelsEl.querySelectorAll('.w3-label').forEach(l => l.classList.toggle('hot', l.dataset.z === z));
  }

  W.setLabels = function (list) { // [{id, html}]
    labelsEl.innerHTML = '';
    list.forEach(L => { const d = document.createElement('div'); d.className = 'w3-label'; d.dataset.z = L.id; d.innerHTML = L.html; d.onclick = () => onPick && onPick(L.id); d.onpointerenter = () => setHover(L.id); labelsEl.appendChild(d); });
  };
  W.focus = function (id) { const a = anchors.find(x => x.id === id); if (!a) return; tYaw = Math.atan2(a.p.x, a.p.z); autoRot = false; lastInteract = performance.now(); };

  const tmp = () => new T.Vector3();
  function loop() {
    if (!renderer) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    if (!autoRot && performance.now() - lastInteract > 6000) autoRot = true;
    if (autoRot) tYaw += dt * (opts.cinematic ? .025 : .05);
    yaw += (tYaw - yaw) * .08; dist += (tDist - dist) * .08;
    camera.position.set(Math.sin(yaw) * dist * Math.cos(pitch), dist * Math.sin(pitch), Math.cos(yaw) * dist * Math.cos(pitch));
    camera.lookAt(0, opts.cinematic ? 6 : 12, 0);
    if (dragonPivot) {
      const dx = -Math.sin(yaw) * DRAGON.r, dz = -Math.cos(yaw) * DRAGON.r;
      dragonPivot.position.set(dx, DRAGON.h, dz); dragonPivot.rotation.y = yaw;
      dragonAnchor.set(dx, DRAGON.h + DRAGON.top * DRAGON.s, dz);
    }
    // 海浪
    const pa = ocean.geometry.attributes.position, arr = pa.array;
    for (let i = 0; i < arr.length; i += 3) { const x = oceanBase[i], z = oceanBase[i + 2]; arr[i + 1] = Math.sin(x * .12 + t * 1.1) * .35 + Math.cos(z * .15 + t * .8) * .3; }
    pa.needsUpdate = true; ocean.geometry.computeVertexNormals();
    spinners.forEach(s => { if (s.s) s.o.rotation.y += dt * s.s; s.o.position.y = s.y + Math.sin(t * 1.4 + s.y) * s.bob; if (s.rock) s.o.rotation.z = Math.sin(t * 1.2) * .08; });
    clouds.forEach(c => { c.userData.a += dt * c.userData.v; c.position.x = Math.cos(c.userData.a) * c.userData.r; c.position.z = Math.sin(c.userData.a) * c.userData.r; });
    if (sparkles) { sparkles.rotation.y += dt * .02; sparkles.material.opacity = .5 + Math.sin(t * 2) * .3; }
    Object.values(zoneObjs).forEach(o => { const k = o.userData.hover ? 1.06 : 1; o.scale.x += (k - o.scale.x) * .15; o.scale.y = o.scale.z = o.scale.x; });
    renderer.render(scene, camera);
    // 标签
    const w = container.clientWidth, hh = container.clientHeight;
    labelsEl.querySelectorAll('.w3-label').forEach(l => {
      const a = anchors.find(x => x.id === l.dataset.z); if (!a) return;
      const v = a.p.clone(); if (a.id !== 'home' && a.id !== 'dragon') v.y += Math.sin(t * 1.4 + 11) * .4;
      v.project(camera);
      const vis = v.z < 1;
      l.style.transform = 'translate(-50%,-100%) translate(' + ((v.x + 1) / 2 * w) + 'px,' + ((1 - v.y) / 2 * hh) + 'px)';
      l.style.opacity = vis ? 1 : 0; l.style.zIndex = Math.round((1 - v.z) * 1000);
    });
  }

  W.dispose = function () {
    cancelAnimationFrame(raf); removeEventListener('resize', resize);
    if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); renderer.domElement.remove(); }
    if (labelsEl) labelsEl.remove();
    renderer = scene = camera = null; clouds = []; spinners = []; zoneObjs = {}; anchors = []; hovered = null; dragonPivot = dragonAnchor = null;
  };
  W.resize = resize;
  window.World3D = W;
})();
