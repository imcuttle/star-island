/* 3D 大游戏：星星卡丁车、喷射涂涂战、星星滚球（three.js，全部程序化建模，不依赖外部贴图） */
(function () {
  const { h, sleep, E, hydrate, UI, Audio2, Voice } = Core;
  const R = CONTENT.R;
  const A = window.Arcade;

  /* ---------- Kenney GLB 模型库（base64 内嵌，按需加载，file:// 也可用） ---------- */
  const Models = {
    _p: null, gltf: {},
    ready() {
      if (this._p) return this._p;
      this._p = new Promise(res => {
        if (window.MODELS) return res(true);
        const s = document.createElement('script'); s.src = 'assets/models/models.js'; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
      }).then(ok => ok && window.THREE.GLTFLoader ? Promise.all(Object.keys(window.MODELS).map(k => new Promise(r => {
        const b = atob(window.MODELS[k]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        new THREE.GLTFLoader().parse(u.buffer, '', g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); this.gltf[k] = g; r(); }, () => r());
      }))).then(() => true) : false);
      return this._p;
    },
    // 克隆并缩放到指定尺寸（size 按最长边或指定轴）
    make(name, size, axis) {
      const g = this.gltf[name]; if (!g) return null;
      const o = g.animations.length ? THREE.SkeletonUtils.clone(g.scene) : g.scene.clone(true);
      const box = new THREE.Box3().setFromObject(o), d = box.getSize(new THREE.Vector3());
      const k = size / (axis === 'y' ? d.y : axis === 'z' ? d.z : Math.max(d.x, d.y, d.z)); o.scale.multiplyScalar(k);
      const wrap = new THREE.Group(); wrap.add(o); o.position.y = -box.min.y * k;
      if (g.animations.length) { wrap.mixer = new THREE.AnimationMixer(o); wrap.clips = {}; g.animations.forEach(c => wrap.clips[c.name] = wrap.mixer.clipAction(c)); wrap.play = n => { const a = wrap.clips[n]; if (!a || wrap.cur === a) return; if (wrap.cur) wrap.cur.fadeOut(.15); a.reset().fadeIn(.15).play(); wrap.cur = a; }; }
      return wrap;
    },
  };
  window.Models = Models;

  function renderer3d(wrap) {
    const T = THREE, rd = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    rd.setPixelRatio(Math.min(devicePixelRatio, 1.75)); rd.shadowMap.enabled = true; rd.shadowMap.type = T.PCFSoftShadowMap;
    rd.toneMapping = T.ACESFilmicToneMapping; rd.outputColorSpace = T.SRGBColorSpace; rd.domElement.className = 'ar-cv';
    wrap.insertBefore(rd.domElement, wrap.firstChild);
    const cam = new T.PerspectiveCamera(62, 1, .3, 900);
    const fit = () => { const r = wrap.getBoundingClientRect(); rd.setSize(r.width, r.height); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); return r; };
    let size = fit(); const onR = () => { if (rd.domElement.isConnected) size = fit(); }; addEventListener('resize', onR);
    const dispose = () => { removeEventListener('resize', onR); rd.dispose(); rd.forceContextLoss && rd.forceContextLoss(); };
    Core.onLeave(dispose);
    return { T, rd, cam, size: () => size, dispose };
  }
  const tex = (w, hh, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; paint(c.getContext('2d'), w, hh); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .7 }, o || {}));
  const mesh = (g, m, x, y, z) => { const me = new THREE.Mesh(g, m); me.position.set(x || 0, y || 0, z || 0); me.castShadow = true; me.receiveShadow = true; return me; };
  function lights(scene, T, sky) {
    scene.add(new T.HemisphereLight(0xdff2ff, 0x6a8a4a, 1.3));
    const s = new T.DirectionalLight(0xffffff, 2.2); s.position.set(60, 90, 40); s.castShadow = true; s.shadow.mapSize.set(2048, 2048);
    Object.assign(s.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, far: 300 }); scene.add(s); scene.add(s.target);
    scene.background = new T.Color(sky); scene.fog = new T.Fog(sky, 120, 380);
    return s;
  }
  function tree(T, x, z, s) { const g = new T.Group(); g.add(mesh(new T.CylinderGeometry(.35 * s, .5 * s, 2.4 * s, 6), mat(0x8b5a2b), 0, 1.2 * s, 0)); const c = R.pick([0x4fbf5a, 0x3fa34d, 0x6fd16a]); g.add(mesh(new T.ConeGeometry(2 * s, 3.6 * s, 7), mat(c, { flatShading: true }), 0, 3.6 * s, 0)); g.add(mesh(new T.ConeGeometry(1.5 * s, 2.8 * s, 7), mat(c, { flatShading: true }), 0, 5.2 * s, 0)); g.position.set(x, 0, z); return g; }
  // 投影标签
  function project(v, cam, size, el, dy) { const p = v.clone(); p.project(cam); const vis = p.z < 1 && Math.abs(p.x) < 1.3 && Math.abs(p.y) < 1.3; el.style.opacity = vis ? 1 : 0; el.style.transform = 'translate(-50%,-100%) translate(' + ((p.x + 1) / 2 * size.width) + 'px,' + ((1 - p.y) / 2 * size.height - (dy || 0)) + 'px)'; return p; }


  /* ---------- 持枪骨骼：枪握在右手里、左手扶枪、手臂跟着准星抬起，墨水罐背在背上 ---------- */
  const BONE_ALIAS = {
    rUp: ['rightupperarm', 'upperarmr', 'rightarm', 'armr'], rLo: ['rightlowerarm', 'lowerarmr', 'rightforearm', 'forearmr'], rHand: ['righthand', 'wristr', 'handr'],
    lUp: ['leftupperarm', 'upperarml', 'leftarm', 'arml'], lLo: ['leftlowerarm', 'lowerarml', 'leftforearm', 'forearml'], lHand: ['lefthand', 'wristl', 'handl'],
    chest: ['upperchest', 'chest', 'spine2', 'spine1', 'torso', 'spine', 'abdomen'],
  };
  const VRM_BONE = { rUp: 'rightUpperArm', rLo: 'rightLowerArm', rHand: 'rightHand', lUp: 'leftUpperArm', lLo: 'leftLowerArm', lHand: 'leftHand' };
  function findBones(av) {
    const out = {};
    if (av.vrm) { const H = av.vrm.humanoid; Object.keys(VRM_BONE).forEach(k => out[k] = H.getRawBoneNode(VRM_BONE[k])); out.chest = H.getRawBoneNode('upperChest') || H.getRawBoneNode('chest') || H.getRawBoneNode('spine'); return out; }
    const bones = []; av.traverse(o => { if (o.isBone) bones.push(o); });
    const norm = n => n.toLowerCase().replace(/^mixamorig/, '').replace(/[^a-z0-9]/g, '');
    Object.keys(BONE_ALIAS).forEach(k => { for (const c of BONE_ALIAS[k]) { const b = bones.find(x => norm(x.name) === c) || bones.find(x => norm(x.name).endsWith(c)); if (b) { out[k] = b; break; } } });
    return out;
  }
  const _v = () => new THREE.Vector3(), _q = () => new THREE.Quaternion();
  // 转动 bone，让它的子骨骼 child 指向 target（世界坐标）
  function aimBone(bone, child, target) {
    const bp = bone.getWorldPosition(_v()), cur = child.getWorldPosition(_v()).sub(bp), want = target.clone().sub(bp);
    if (cur.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) return;
    const dq = _q().setFromUnitVectors(cur.normalize(), want.normalize()), wq = bone.getWorldQuaternion(_q()), pq = bone.parent.getWorldQuaternion(_q()).invert();
    bone.quaternion.copy(pq.multiply(dq.multiply(wq))); bone.updateMatrixWorld(true);
  }
  // 两节手臂 IK：肩 → 肘 → 手，手腕落到 target，手肘往 pole 方向弯
  function ik2(up, lo, hand, target, pole) {
    const S = up.getWorldPosition(_v()), E = lo.getWorldPosition(_v()), Hn = hand.getWorldPosition(_v());
    const l1 = S.distanceTo(E), l2 = E.distanceTo(Hn), d = target.clone().sub(S), dist = Math.max(.01, Math.min((l1 + l2) * .995, d.length())), dir = d.normalize();
    const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))));
    const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)); if (perp.lengthSq() < 1e-6) perp.set(0, -1, 0); perp.normalize();
    aimBone(up, lo, S.clone().addScaledVector(dir, Math.cos(a) * l1).addScaledVector(perp, Math.sin(a) * l1));
    aimBone(lo, hand, S.clone().addScaledVector(dir, dist));
  }
  function gunRig(scene, av, H, col) {
    const T = THREE, B = findBones(av), hasArms = B.rUp && B.rLo && B.rHand;
    const pivot = new T.Group(); scene.add(pivot);
    const gun = window.Models && Models.make('blaster', H * .25);
    let len = H * .25, gh = H * .1;
    if (gun) { const bx = new T.Box3().setFromObject(gun), c = bx.getCenter(_v()), sz = bx.getSize(_v()); len = sz.z; gh = sz.y; gun.position.sub(c).add(new T.Vector3(0, -gh * .1, len * .12)); pivot.add(gun); }
    else pivot.add(mesh(new T.BoxGeometry(H * .05, H * .06, len), mat(0x333344), 0, 0, len * .12));
    const flash = new T.Mesh(new T.SphereGeometry(H * .035, 10, 8), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .9 })); flash.position.set(0, gh * .1, len * .66); flash.visible = false; pivot.add(flash);
    // 墨水罐：罐身是自己队伍的颜色，有发光的墨水窗、白色罐盖、两条背带
    const tank = new T.Group(); scene.add(tank);
    const r = H * .062, th = H * .2;
    tank.add(mesh(new T.CylinderGeometry(r, r, th, 18), mat(0xf4f6fb, { roughness: .35, metalness: .1 })));
    const ink = mesh(new T.CylinderGeometry(r * 1.02, r * 1.02, th * .62, 18), mat(col, { emissive: col, emissiveIntensity: .55, roughness: .25, transparent: true, opacity: .92 }), 0, -th * .12, 0); tank.add(ink);
    tank.add(mesh(new T.CylinderGeometry(r * .55, r * .7, th * .12, 14), mat(0x2b2f3a), 0, th * .56, 0));
    [-1, 1].forEach(sd => { const st = mesh(new T.BoxGeometry(H * .018, th * .95, H * .1), mat(0x2b2f3a), sd * r * .7, 0, r * .9); tank.add(st); });
    // 罐子贴着后背：按身体实际厚度往后放（机器人这类胖身材不会把罐子埋进身体里）
    av.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(av), depth = bb.getSize(_v()).z, back = Math.max(H * .115, depth * .5 + r * .6);
    let kick = 0;
    const aim = _v(), up = new T.Vector3(0, 1, 0), muzzle = _v();
    return {
      // 每帧在动画之后调用：yaw 是人物朝向，aimPt 是准星指向的世界坐标
      update(dt, yaw, aimPt) {
        av.updateMatrixWorld(true); kick = Math.max(0, kick - dt);
        const fwd = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), right = new T.Vector3(-fwd.z, 0, fwd.x);
        const chest = (B.chest ? B.chest.getWorldPosition(_v()) : av.getWorldPosition(_v()).add(new T.Vector3(0, H * .68, 0)));
        const sh = hasArms ? B.rUp.getWorldPosition(_v()) : chest.clone().addScaledVector(right, H * .09);
        aim.copy(aimPt).sub(sh).normalize();
        // 防止枪口朝身后：准星在身后时只取水平朝前的分量
        if (aim.dot(fwd) < .2) aim.addScaledVector(fwd, .2 - aim.dot(fwd)).normalize();
        const reach = hasArms ? (B.rUp.getWorldPosition(_v()).distanceTo(B.rLo.getWorldPosition(_v())) + B.rLo.getWorldPosition(_v()).distanceTo(B.rHand.getWorldPosition(_v()))) : H * .3;
        const grip = sh.clone().addScaledVector(aim, reach * .72).addScaledVector(right, -H * .035).addScaledVector(up, -H * .03).addScaledVector(aim, -kick * H * .5);
        if (hasArms) {
          ik2(B.rUp, B.rLo, B.rHand, grip, right.clone().multiplyScalar(.6).add(new T.Vector3(0, -1, 0)));
          const hp = B.rHand.getWorldPosition(_v()); if (hp.distanceTo(grip) < H * .12) grip.copy(hp); // 骨骼比例特殊、手够不到时枪就停在胸前
        }
        pivot.position.copy(grip); pivot.lookAt(grip.clone().add(aim));
        if (B.lUp && B.lLo && B.lHand) { const fore = pivot.localToWorld(new T.Vector3(0, -gh * .2, len * .3)); ik2(B.lUp, B.lLo, B.lHand, fore, right.clone().multiplyScalar(-.6).add(new T.Vector3(0, -1, 0))); }
        flash.visible = kick > .04; flash.scale.setScalar(.7 + Math.random() * .6);
        tank.position.copy(chest).addScaledVector(fwd, -back).addScaledVector(up, -H * .04); tank.rotation.set(0, yaw, 0); tank.rotateX(-.12);
      },
      fire() { kick = .09; },
      muzzle() { return pivot.localToWorld(muzzle.set(0, gh * .1, len * .62)); },
      dispose() { scene.remove(pivot); scene.remove(tank); },
    };
  }

  /* =====================================================================
     星星卡丁车
     ===================================================================== */
  const LAYOUTS = [
    [[0, -78], [52, -66], [84, -22], [62, 18], [86, 58], [44, 82], [2, 54], [-36, 76], [-80, 44], [-62, 2], [-86, -40], [-46, -74]],
    [[0, -80], [60, -80], [90, -40], [70, 0], [95, 45], [55, 80], [-10, 70], [-20, 30], [-60, 40], [-90, 10], [-80, -50], [-40, -60]],
  ];
  const RIVALS = [['🐼', 0x2ecc71, '熊猫'], ['🦊', 0xff9f2e, '狐狸'], ['🐰', 0x9b5cf6, '兔兔']];
  function kart(S, data) {
    return new Promise(async resolve => {
      const { wrap, hud, labels } = A.arena(S, 'kt');
      const G3 = renderer3d(wrap), { T, rd, cam } = G3, scene = new T.Scene();
      const sun = lights(scene, T, 0x8fd8ff);
      const HAS = await Models.ready();
      const nextQ = A.feeder(S, data), LAPS = S.grade <= 1 ? 2 : 3, ROADW = 9;
      // 赛道
      const curve = new T.CatmullRomCurve3(R.pick(LAYOUTS).map(p => new T.Vector3(p[0] * 1.3, 0, p[1] * 1.3)), true, 'catmullrom', .5);
      const N = 700, P = curve.getSpacedPoints(N).slice(0, N), TG = P.map((p, i) => P[(i + 1) % N].clone().sub(P[(i + N - 1) % N]).normalize());
      const NRM = TG.map(t => new T.Vector3(-t.z, 0, t.x)), LEN = curve.getLength();
      const ribbon = (w0, w1, y, m, rep) => {
        const pos = [], uv = [], idx = [];
        for (let i = 0; i <= N; i++) { const k = i % N, p = P[k], n = NRM[k]; pos.push(p.x + n.x * w0, y, p.z + n.z * w0, p.x + n.x * w1, y, p.z + n.z * w1); const v = i / N * LEN / rep; uv.push(0, v, 1, v); if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
        m.side = T.DoubleSide; m.polygonOffset = true; m.polygonOffsetFactor = -1 - y * 10; const me = new T.Mesh(g, m); me.receiveShadow = true; scene.add(me); return me;
      };
      const roadT = tex(128, 256, (c, w, hh) => { c.fillStyle = '#555a66'; c.fillRect(0, 0, w, hh); for (let i = 0; i < 900; i++) { c.fillStyle = 'rgba(255,255,255,' + Math.random() * .06 + ')'; c.fillRect(Math.random() * w, Math.random() * hh, 2, 2); } c.fillStyle = '#fff'; c.fillRect(w / 2 - 3, 0, 6, hh * .5); });
      roadT.wrapS = roadT.wrapT = T.RepeatWrapping;
      ribbon(-ROADW, ROADW, .02, new T.MeshStandardMaterial({ map: roadT, roughness: .9 }), 12);
      const curbT = tex(16, 64, (c, w, hh) => { c.fillStyle = '#ff3b3b'; c.fillRect(0, 0, w, hh / 2); c.fillStyle = '#fff'; c.fillRect(0, hh / 2, w, hh / 2); }); curbT.wrapS = curbT.wrapT = T.RepeatWrapping;
      const cm = new T.MeshStandardMaterial({ map: curbT }); ribbon(ROADW, ROADW + 1.6, .04, cm, 3); ribbon(-ROADW - 1.6, -ROADW, .04, cm, 3);
      const ground = new T.Mesh(new T.CircleGeometry(420, 48), mat(0x7ccf5a)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const ckT = tex(64, 16, (c, w, hh) => { for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 8, y * 8, 8, 8); } });
      const start = new T.Mesh(new T.PlaneGeometry(ROADW * 2, 3), new T.MeshStandardMaterial({ map: ckT })); start.rotation.x = -Math.PI / 2; start.rotation.z = -Math.atan2(TG[0].x, TG[0].z); start.position.set(P[0].x, .05, P[0].z); scene.add(start);
      const arch = new T.Group(); [-1, 1].forEach(s => arch.add(mesh(new T.CylinderGeometry(.5, .5, 9, 8), mat(0xff5d73), s * (ROADW + 2), 4.5, 0))); arch.add(mesh(new T.BoxGeometry(ROADW * 2 + 5, 1.6, .8), mat(0xffd23f), 0, 9, 0));
      arch.position.copy(P[0]); arch.rotation.y = Math.atan2(NRM[0].x, NRM[0].z) + Math.PI / 2; scene.add(arch);
      // 装饰
      for (let i = 0; i < 160; i++) {
        const x = R.int(-240, 240), z = R.int(-240, 240); let dmin = 1e9; for (let k = 0; k < N; k += 7) dmin = Math.min(dmin, Math.hypot(P[k].x - x, P[k].z - z));
        if (dmin > ROADW + 7) { const tm = HAS && Models.make(R.pick(['tree', 'pine']), 6 + Math.random() * 5, 'y'); if (tm) { tm.position.set(x, 0, z); tm.rotation.y = Math.random() * 6; scene.add(tm); } else scene.add(tree(T, x, z, .8 + Math.random() * .8)); }
      }
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = 300; const m = mesh(new T.ConeGeometry(40 + i % 3 * 15, 70 + i % 4 * 20, 6), mat(0x9aa8c8, { flatShading: true }), Math.cos(a) * r, 30, Math.sin(a) * r); scene.add(m); const cap = mesh(new T.ConeGeometry(16, 24, 6), mat(0xffffff, { flatShading: true }), Math.cos(a) * r, 64 + i % 4 * 10, Math.sin(a) * r); scene.add(cap); }
      // 加速带 + 道具箱
      const boostT = tex(64, 64, (c, w, hh) => { c.fillStyle = '#ffb000'; c.fillRect(0, 0, w, hh); c.fillStyle = '#fff6c0'; for (let k = 0; k < 2; k++) { c.beginPath(); c.moveTo(12, 34 - k * 26 + 20); c.lineTo(32, 14 - k * 26 + 20); c.lineTo(52, 34 - k * 26 + 20); c.lineTo(52, 44 - k * 26 + 20); c.lineTo(32, 24 - k * 26 + 20); c.lineTo(12, 44 - k * 26 + 20); c.fill(); } });
      const pads = [Math.floor(N * .22), Math.floor(N * .58), Math.floor(N * .84)].map(i => { const m = new T.Mesh(new T.PlaneGeometry(5, 7), new T.MeshStandardMaterial({ map: boostT, emissive: 0xff8a00, emissiveIntensity: .5 })); const lat = R.pick([-4, 0, 4]); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(TG[i].x, TG[i].z) + Math.PI; m.position.set(P[i].x + NRM[i].x * lat, .06, P[i].z + NRM[i].z * lat); scene.add(m); return { i, lat, m }; });
      const qT = tex(64, 64, (c, w, hh) => { const g = c.createLinearGradient(0, 0, w, hh); g.addColorStop(0, '#ff5dc8'); g.addColorStop(.5, '#ffd23f'); g.addColorStop(1, '#3ec1d3'); c.fillStyle = g; c.fillRect(0, 0, w, hh); c.fillStyle = '#fff'; c.font = 'bold 48px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 32, 35); });
      const boxes = [];
      if (HAS) { // 看台、旗塔、广告牌、路灯、锥桶
        const deco = (name, size, i, side, dist, rot) => { const m = Models.make(name, size); if (!m) return; const p0 = P[i % N], n = NRM[i % N]; m.position.set(p0.x + n.x * side * dist, 0, p0.z + n.z * side * dist); m.rotation.y = Math.atan2(n.x * -side, n.z * -side) + (rot || 0); scene.add(m); };
        [8, 30, 50].forEach(i => deco('standC', 14, i, 1, ROADW + 10)); [N - 30, N - 10].forEach(i => deco('stand', 12, i, -1, ROADW + 9));
        for (let i = 0; i < N; i += 60) { deco(i % 120 ? 'tower' : 'towerG', 7, i, i % 120 ? 1 : -1, ROADW + 4); deco('lamp', 7, i + 30, -1, ROADW + 3.5); }
        [Math.floor(N * .3), Math.floor(N * .65)].forEach(i => deco('billboard', 10, i, 1, ROADW + 8));
        for (let i = 15; i < N; i += 45) deco('cone', 1.2, i, R.pick([-1, 1]), ROADW + 2.2);
        const gate = Models.make('gate', ROADW * 2 + 4, 'x'); if (gate) { gate.position.copy(P[0]); gate.rotation.y = Math.atan2(TG[0].x, TG[0].z); scene.add(gate); arch.visible = false; }
      }
      [Math.floor(N * .12), Math.floor(N * .4), Math.floor(N * .7)].forEach(i => [-6, -2, 2, 6].forEach(lat => { const m = (HAS && Models.make('itembox', 2.2)) || new T.Mesh(new T.BoxGeometry(2, 2, 2), new T.MeshStandardMaterial({ map: qT, transparent: true, opacity: .92, emissive: 0x442266, emissiveIntensity: .4 })); m.position.set(P[i].x + NRM[i].x * lat, 1.6, P[i].z + NRM[i].z * lat); m.castShadow = true; scene.add(m); boxes.push({ m, t: 0 }); }));
      // 卡丁车
      const CARS = ['car1', 'car2', 'car3', 'car4'], DRIVERS = ['girl1', 'boy1', 'girl2', 'boy2'];
      const makeKart = (color, k) => {
        if (HAS && Models.gltf[CARS[k]]) {
          const g = new T.Group(), body = new T.Group(); g.add(body); g.col = color;
          const car = Models.make(CARS[k], 3.6, 'z'); car.rotation.y = 0; body.add(car);
          const drv = Models.make(DRIVERS[k], 1.9, 'y'); if (drv) { drv.position.set(0, .35, -.25); drv.play && drv.play('drive'); body.add(drv); g.drv = drv; }
          const ring = new T.Mesh(new T.RingGeometry(1.7, 2.1, 24), new T.MeshBasicMaterial({ color, transparent: true, opacity: .6 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .06; g.add(ring);
          const wheels = []; car.traverse(o => { if (/wheel/i.test(o.name) && !o.isMesh) wheels.push(o); });
          scene.add(g); return { g, body, wheels, col: color };
        }
        const g = new T.Group(), body = new T.Group(); g.add(body);
        body.add(mesh(new T.BoxGeometry(2.2, .6, 3.4), mat(color, { roughness: .35, metalness: .2 }), 0, .7, 0));
        body.add(mesh(new T.BoxGeometry(1.8, .5, 1.2), mat(color, { roughness: .35 }), 0, .9, 1.6));
        body.add(mesh(new T.BoxGeometry(2.6, .2, .5), mat(0x333344), 0, 1.05, -1.6));
        body.add(mesh(new T.BoxGeometry(1.2, .7, 1), mat(0x222233), 0, 1.2, -.5));
        body.add(mesh(new T.SphereGeometry(.62, 16, 12), mat(color, { roughness: .2, metalness: .3 }), 0, 2, -.4));
        body.add(mesh(new T.BoxGeometry(.9, .3, .1), mat(0x9fe8ff, { roughness: .1, metalness: .5 }), 0, 2.05, .2));
        const wheels = [[-1.15, .45, 1.2], [1.15, .45, 1.2], [-1.15, .45, -1.2], [1.15, .45, -1.2]].map(w => { const m = mesh(new T.CylinderGeometry(.48, .48, .45, 14), mat(0x1d1d24), w[0], w[1], w[2]); m.rotation.z = Math.PI / 2; g.add(m); return m; });
        scene.add(g); return { g, body, wheels, col: color };
      };
      const p = Core.Store.p, HERO = App.HEROES.find(x => x.id === p.hero) || App.HEROES[0];
      const heroCol = { 'k-green': 0x3ccf7e, 'k-pink': 0xff6fae, 'k-purple': 0x9b5cf6, 'k-yellow': 0xffd23f, 'k-beige': 0xf3c79a }[HERO.id] || 0xff4d4d;
      const me = Object.assign(makeKart(heroCol, 0), { idx: 0, lap: 0, pos: P[0].clone().add(NRM[0].clone().multiplyScalar(-3)).sub(TG[0].clone().multiplyScalar(4)), hd: Math.atan2(TG[0].x, TG[0].z), sp: 0, boost: 0, star: 0, item: null, prog: 0, finish: 0 });
      const ais = RIVALS.map((rv, k) => Object.assign(makeKart(rv[1], k + 1), { e: rv[0], name: rv[2], t: N - 6 - k * 4, lat: [3, -3, 0][k], tl: 0, base: 22 + S.grade * 1.5 + k * .8, lap: -1, prog: 0, boost: 0, finish: 0 }));
      const mkLabel = (html, cls) => { const el = h('div', 'kt-tag ' + (cls || ''), html); labels.appendChild(el); hydrate(el); return el; };
      me.tag = mkLabel(App.heroShot('front') ? '<img src="' + App.heroShot('front') + '">' : HERO.img ? '<img src="assets/img/' + HERO.img + '_front.png">' : E(HERO.e), 'me');
      ais.forEach(a => a.tag = mkLabel(E(a.e)));
      const mm = document.createElement('canvas'); mm.className = 'kt-map'; mm.width = 150; mm.height = 150; wrap.appendChild(mm); const mx = mm.getContext('2d');
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; P.forEach(q => { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minZ = Math.min(minZ, q.z); maxZ = Math.max(maxZ, q.z); });
      const mapXY = v => [10 + (v.x - minX) / (maxX - minX) * 130, 10 + (v.z - minZ) / (maxZ - minZ) * 130];
      const IN = A.Input(wrap, { stick: 'lr', buttons: [{ id: 'item', icon: '🍄', label: '道具', keys: [' ', 'Enter', 'Shift'], big: true }, { id: 'brake', icon: '🛑', label: '刹车', keys: ['ArrowDown', 's', 'S'] }] });
      const ORD = ['🥇', '🥈', '🥉', '4️⃣'];
      let paused = true, done = false, last = performance.now(), rank = 4;
      const near = (pos, idx) => { let bi = idx, bd = 1e9; for (let k = -25; k <= 25; k++) { const i = (idx + k + N) % N, d = (P[i].x - pos.x) ** 2 + (P[i].z - pos.z) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
      const drawHud = () => { hud.innerHTML = '<span>第 <b class="latin">' + Math.min(LAPS, me.lap + 1) + '</b>/' + LAPS + ' 圈</span><span class="kt-rank">' + E(ORD[rank - 1]) + '</span><span class="kt-item">' + (me.item ? E(me.item) : '<i>空</i>') + '</span><span>' + E('❓') + ' <b class="latin">' + S.right + '</b></span>'; hydrate(hud); };
      const hitBox = async b => {
        b.t = 5; b.m.visible = false; paused = true; IN.release(); Audio2.sfx('pop', .5);
        const okk = await A.ask(S, nextQ(), wrap, { title: E('🎁') + ' 道具箱！答对就能拿到道具' });
        if (okk) { me.item = Math.random() < .3 ? '⭐' : '🍄'; Audio2.sfx('magic', .5); A.banner(wrap, '获得 ' + E(me.item) + '！按「道具」使用', 1300); }
        last = performance.now(); paused = false; drawHud();
      };
      const finish = () => {
        if (done) return; done = true; IN.destroy(); const r = rank;
        A.banner(wrap, E(ORD[r - 1]) + ' 第 ' + r + ' 名！', 2200); Audio2.sfx(r === 1 ? 'victory' : 'win', .6); if (r === 1) UI.confetti(120);
        Voice.say(r === 1 ? '冠军！你是第一名！' : '比赛结束，你是第' + r + '名');
        setTimeout(() => { S.setProgress(1, 1); S.end(false, r === 1 ? 3 : r === 2 ? 2 : 1); resolve(); }, 2000);
      };
      const loop = now => {
        if (!A.live(S, rd.domElement) && !done) { IN.destroy(); return; }
        if (!rd.domElement.isConnected) return;
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        if (!paused && !done) {
          // 玩家
          if (IN.take('item') && me.item) { if (me.item === '⭐') me.star = 4; me.boost = 2.2; Audio2.sfx('whoosh', .6); me.item = null; drawHud(); }
          me.boost = Math.max(0, me.boost - dt); me.star = Math.max(0, me.star - dt);
          me.idx = near(me.pos, me.idx); const off = me.pos.clone().sub(P[me.idx]), lat = off.dot(NRM[me.idx]);
          const offroad = Math.abs(lat) > ROADW + 1 && !me.star;
          const max = (me.boost > 0 ? 40 : 27 + S.grade) * (offroad ? .45 : 1), acc = IN.btn.brake ? -30 : 16;
          me.sp = Math.max(0, Math.min(max, me.sp + acc * dt)); if (me.sp > max) me.sp -= 30 * dt;
          const steer = IN.ax(); me.hd -= steer * dt * 1.9 * Math.min(1, .35 + me.sp / 25);
          me.pos.x += Math.sin(me.hd) * me.sp * dt; me.pos.z += Math.cos(me.hd) * me.sp * dt;
          if (Math.abs(lat) > ROADW + 7) { me.pos.copy(P[me.idx]).add(NRM[me.idx].clone().multiplyScalar(Math.sign(lat) * (ROADW + 6.5))); me.sp *= .6; }
          pads.forEach(pd => { const pp = pd.m.position; if (Math.hypot(pp.x - me.pos.x, pp.z - me.pos.z) < 3.5 && me.boost < 1) { me.boost = 1.4; Audio2.sfx('whoosh', .4); } });
          boxes.forEach(b => { if (b.t > 0) { b.t -= dt; if (b.t <= 0) b.m.visible = true; return; } if (Math.hypot(b.m.position.x - me.pos.x, b.m.position.z - me.pos.z) < 2.6) hitBox(b); });
          const prevIdx = me.lastIdx == null ? me.idx : me.lastIdx;
          if (prevIdx > N * .8 && me.idx < N * .2 && me.half) { me.lap++; me.half = false; if (me.lap < LAPS) { A.banner(wrap, me.lap === LAPS - 1 ? '最后一圈！' : '第 ' + (me.lap + 1) + ' 圈', 1200); Audio2.sfx('levelup', .4); } }
          if (me.idx > N * .45 && me.idx < N * .55) me.half = true;
          me.lastIdx = me.idx; me.prog = me.lap * N + (me.lap === 0 && !me.half && me.idx > N * .8 ? me.idx - N : me.idx);
          me.g.position.copy(me.pos); me.g.rotation.y = me.hd; me.body.rotation.z = steer * .08; me.body.position.y = Math.sin(now / 60) * .03 * me.sp / 20;
          me.wheels.forEach(w => w.rotation.x += me.sp * dt);
          // AI
          ais.forEach((a, k) => {
            const gap = (me.prog - a.prog) / N, rub = Math.max(-.25, Math.min(.35, gap * .9));
            a.boost = Math.max(0, a.boost - dt); if (Math.random() < dt * .05) a.boost = 1.2;
            const sp = a.base * (1 + rub) * (a.boost > 0 ? 1.35 : 1);
            a.t += sp * dt / (LEN / N); if (a.t >= N) { a.t -= N; a.lap++; }
            if (Math.random() < dt * .4) a.tl = R.int(-6, 6); a.lat += (a.tl - a.lat) * dt * .8;
            const i = Math.floor(a.t) % N, pos = P[i].clone().add(NRM[i].clone().multiplyScalar(a.lat));
            if (pos.distanceTo(me.pos) < 2.8) { const push = me.pos.clone().sub(pos).setY(0).normalize(); me.pos.add(push.multiplyScalar(me.star ? 0 : .4)); if (me.star) a.lat += 3; Audio2.sfx('bump', .15); }
            a.g.position.copy(pos); a.g.rotation.y = Math.atan2(TG[i].x, TG[i].z); a.wheels.forEach(w => w.rotation.x += sp * dt); a.prog = a.lap * N + a.t;
          });
          rank = 1 + ais.filter(a => a.prog > me.prog).length;
          if (me.lap >= LAPS) finish();
          if (Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) drawHud();
        }
        [me].concat(ais).forEach(k => k.g.drv && k.g.drv.mixer && k.g.drv.mixer.update(dt));
        boxes.forEach(b => { b.m.rotation.y += dt * 1.5; if (!b.m.isGroup) b.m.rotation.x += dt; b.m.position.y = 1.6 + Math.sin(now / 300 + b.m.position.x) * .3; });
        // 镜头
        const back = new T.Vector3(-Math.sin(me.hd), 0, -Math.cos(me.hd)), want = me.pos.clone().add(back.multiplyScalar(10 + me.sp * .05)).add(new T.Vector3(0, 4.6, 0));
        cam.position.lerp(want, .12); cam.lookAt(me.pos.x + Math.sin(me.hd) * 6, 1.4, me.pos.z + Math.cos(me.hd) * 6);
        cam.fov += ((me.boost > 0 ? 75 : 62) - cam.fov) * .1; cam.updateProjectionMatrix();
        sun.position.set(me.pos.x + 60, 90, me.pos.z + 40); sun.target.position.copy(me.pos);
        rd.render(scene, cam);
        const sz = G3.size(); project(me.pos.clone().setY(2.9), cam, sz, me.tag, 0); ais.forEach(a => project(a.g.position.clone().setY(2.9), cam, sz, a.tag, 0));
        mx.clearRect(0, 0, 150, 150); mx.fillStyle = 'rgba(255,255,255,.75)'; mx.beginPath(); mx.arc(75, 75, 74, 0, 7); mx.fill(); mx.strokeStyle = '#555a66'; mx.lineWidth = 7; mx.beginPath(); P.forEach((q, i) => { const [x, y] = mapXY(q); i ? mx.lineTo(x, y) : mx.moveTo(x, y); }); mx.closePath(); mx.stroke();
        ais.forEach(a => { const [x, y] = mapXY(a.g.position); mx.fillStyle = '#' + new T.Color(a.col).getHexString(); mx.beginPath(); mx.arc(x, y, 5, 0, 7); mx.fill(); });
        const [x, y] = mapXY(me.pos); mx.fillStyle = '#ff3b3b'; mx.strokeStyle = '#fff'; mx.lineWidth = 2; mx.beginPath(); mx.arc(x, y, 7, 0, 7); mx.fill(); mx.stroke();
        requestAnimationFrame(loop);
      };
      drawHud(); requestAnimationFrame(loop);
      await A.countdown(wrap); last = performance.now(); paused = false; Voice.say('出发！');
      S.auto = () => {
        const tg = P[(me.idx + 14) % N], want = Math.atan2(tg.x - me.pos.x, tg.z - me.pos.z); let d = want - me.hd; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        IN.sx = Math.max(-1, Math.min(1, -d * 3)); if (me.item) IN.edge.item = true;
      };
    });
  }

  /* =====================================================================
     喷射涂涂战：第三人称涂地射击，打中正确答案的气球
     ===================================================================== */
  function splat(S, data) {
    return new Promise(async resolve => {
      const { wrap, hud, labels } = A.arena(S, 'sp');
      const G3 = renderer3d(wrap), { T, rd, cam } = G3, scene = new T.Scene();
      lights(scene, T, 0xb8e4ff);
      const HAS = await Models.ready();
      const nextQ = A.feeder(S, data), TIME = 100 + (S.grade >= 3 ? 20 : 0), SZ = 70, GR = 80;
      const MY = '#ff3fa4', RV = '#2fd0ff', MYC = new T.Color(MY), RVC = new T.Color(RV);
      // 地面 + 颜料画布
      const pc = document.createElement('canvas'); pc.width = pc.height = 512; const px = pc.getContext('2d');
      px.fillStyle = '#e9edf3'; px.fillRect(0, 0, 512, 512); px.strokeStyle = 'rgba(0,0,0,.06)'; px.lineWidth = 2; for (let i = 0; i <= 512; i += 32) { px.beginPath(); px.moveTo(i, 0); px.lineTo(i, 512); px.moveTo(0, i); px.lineTo(512, i); px.stroke(); }
      const ptex = new T.CanvasTexture(pc); ptex.colorSpace = T.SRGBColorSpace;
      const floor = new T.Mesh(new T.PlaneGeometry(SZ, SZ), new T.MeshStandardMaterial({ map: ptex, roughness: .55 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      const own = new Uint8Array(GR * GR);
      const splash = (x, z, r, team) => {
        const cx = (x / SZ + .5) * 512, cy = (z / SZ + .5) * 512, rp = r / SZ * 512;
        px.fillStyle = team === 1 ? MY : RV;
        px.beginPath(); px.arc(cx, cy, rp, 0, 7); px.fill();
        for (let k = 0; k < 6; k++) { const a = Math.random() * 7, d = rp * (.8 + Math.random() * .6); px.beginPath(); px.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rp * (.15 + Math.random() * .25), 0, 7); px.fill(); }
        ptex.needsUpdate = true;
        const g0 = Math.floor((x / SZ + .5) * GR), g1 = Math.floor((z / SZ + .5) * GR), gr = Math.ceil(r / SZ * GR);
        for (let gy = g1 - gr; gy <= g1 + gr; gy++) for (let gx = g0 - gr; gx <= g0 + gr; gx++) if (gx >= 0 && gy >= 0 && gx < GR && gy < GR && (gx - g0) ** 2 + (gy - g1) ** 2 <= gr * gr) own[gy * GR + gx] = team;
      };
      const cover = () => { let a = 0, b = 0; for (let i = 0; i < own.length; i++) { if (own[i] === 1) a++; else if (own[i] === 2) b++; } return [a / own.length, b / own.length]; };
      // 场景：围墙 + 箱子 + 高台
      const wallM = mat(0x8a96b8), crateM = mat(0xffb347, { roughness: .6 }), solids = [];
      const box = (x, z, w, d, hh, m) => { let me; if (HAS && m === crateM) { me = Models.make(w > d * 1.4 ? 'crateW' : 'crate', 1, 'y'); if (me) { const b3 = new T.Box3().setFromObject(me).getSize(new T.Vector3()); me.scale.set(w / b3.x, hh / b3.y, d / b3.z); me.position.set(x, 0, z); } } if (!me) me = mesh(new T.BoxGeometry(w, hh, d), m, x, hh / 2, z); scene.add(me); solids.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: hh }); return me; };
      [[0, -SZ / 2, SZ + 2, 1], [0, SZ / 2, SZ + 2, 1], [-SZ / 2, 0, 1, SZ], [SZ / 2, 0, 1, SZ]].forEach(w => box(w[0], w[1], w[2], w[3], 3, wallM));
      for (let i = 0; i < 9; i++) { const x = R.int(-24, 24), z = R.int(-24, 24); if (Math.hypot(x, z - 22) < 8) continue; box(x, z, R.pick([3, 4, 6]), R.pick([3, 4]), R.pick([2, 3, 4]), crateM); }
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, tm = HAS && Models.make(i % 2 ? 'tree' : 'pine', 8 + (i % 3) * 2, 'y'); if (tm) { tm.position.set(Math.cos(a) * 48, 0, Math.sin(a) * 48); scene.add(tm); } else scene.add(tree(T, Math.cos(a) * 48, Math.sin(a) * 48, 1.4)); }
      // 角色
      const makeBuddy = (col, who) => {
        const ch = HAS && Models.make(who, 2.3, 'y');
        if (ch) {
          const g = new T.Group(); g.add(ch); g.ch = ch; ch.play('idle');
          const tank = mesh(new T.CylinderGeometry(.3, .3, .8, 12), mat(col, { emissive: col, emissiveIntensity: .35, roughness: .3 }), 0, 1.25, -.42); g.add(tank); g.tank = tank;
          const gun = Models.make('blaster', .9); if (gun) { gun.position.set(.42, 1.05, .45); g.add(gun); g.gun = gun; }
          const ring = new T.Mesh(new T.RingGeometry(.7, .95, 24), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .7 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .05; g.add(ring);
          scene.add(g); return g;
        } const g = new T.Group(); g.add(mesh(new T.CapsuleGeometry(.55, .9, 6, 12), mat(col, { roughness: .4 }), 0, 1.05, 0)); g.add(mesh(new T.SphereGeometry(.55, 16, 12), mat(0xffe0c8), 0, 2.15, 0)); const hair = mesh(new T.SphereGeometry(.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(col, { roughness: .3 }), 0, 2.2, 0); g.add(hair); g.add(mesh(new T.CylinderGeometry(.35, .35, .9, 10), mat(col, { emissive: col, emissiveIntensity: .25 }), 0, 1.3, -.55)); const gun = mesh(new T.BoxGeometry(.25, .25, 1.1), mat(0x333344), .45, 1.2, .55); g.add(gun); scene.add(g); return g; };
      const me = { g: makeBuddy(MYC, Core.Store.p && /pink|purple/.test(Core.Store.p.hero) ? 'girl1' : 'boy1'), x: 0, z: 22, y: 0, vy: 0, yaw: Math.PI, pitch: .12, ink: 100, cd: 0 };
      const bots = (S.grade <= 1 ? [0] : [0, 1]).map(k => ({ g: makeBuddy(RVC, k ? 'girl2' : 'boy2'), x: -10 + k * 20, z: -22, tx: 0, tz: 0, cd: 0, t: 0 }));
      // 换成玩家选的 3D 角色（带骨骼动作，跟随画风），加载好之前先用默认小人
      const hk = window.App && App.heroModel && App.heroModel(Core.Store.p); let rig = null;
      if (hk && me.g.ch && window.Avatar3D) Avatar3D.make(hk, { height: 2.2, style: Avatar3D.styleOf(Core.theme()) }).then(av => {
        if (!me.g.parent) return; me.g.ch.visible = false; me.g.add(av);
        // 默认小人的罐子和枪去掉，换成挂在新角色骨骼上的
        [me.g.tank, me.g.gun].forEach(o => o && me.g.remove(o));
        rig = gunRig(scene, av, 2.2, MYC);
        // 腿照常播走 / 跑 / 跳，手臂由持枪 IK 接管（不再播出拳动作）
        const MAP = { sprint: 'run', 'holding-right-shoot': 'idle', jump: av.has('jump') ? 'jump' : 'run' };
        me.g.ch = { play: n => av.play(MAP[n] || n), mixer: { update: dt => av.update(dt) } };
      }).catch(() => {});
      // 墨弹
      const shots = [], shotG = new T.SphereGeometry(.28, 8, 6), shotM = [null, new T.MeshStandardMaterial({ color: MYC, emissive: MYC, emissiveIntensity: .5 }), new T.MeshStandardMaterial({ color: RVC, emissive: RVC, emissiveIntensity: .5 })];
      const fire = (o, dir, team, sp) => { const m = new T.Mesh(shotG, shotM[team]); m.position.copy(o); scene.add(m); shots.push({ m, v: dir.clone().multiplyScalar(sp), team, life: 2.5 }); };
      // 气球
      let balloons = [], q = null, qn = 0;
      const qBox = h('div', 'dn-q sp-q'); wrap.appendChild(qBox);
      const newQ = () => {
        balloons.forEach(b => { scene.remove(b.m); b.lb.remove(); }); balloons = [];
        q = nextQ(); qn++; if (q.ch.length > 4) q.ch = R.shuffle([q.ch.find(c => c.ok)].concat(q.ch.filter(c => !c.ok).slice(0, 3)));
        qBox.innerHTML = ''; const QP = Engines.qPanel(q); qBox.appendChild(QP.el); QP.speak();
        const spots = R.shuffle([[-18, -8], [18, -8], [-14, 10], [14, 10], [0, -16], [0, 4]]);
        q.ch.forEach((c, i) => {
          const col = new T.Color().setHSL((i * .23 + .05) % 1, .8, .6), g = new T.Group();
          g.add(mesh(new T.SphereGeometry(1.4, 20, 16), mat(col, { roughness: .25, metalness: .1 }), 0, 0, 0)); g.children[0].scale.y = 1.15;
          g.add(mesh(new T.CylinderGeometry(.02, .02, 3, 4), mat(0x666666), 0, -2.4, 0));
          g.position.set(spots[i][0], 4.5 + i % 2, spots[i][1]); scene.add(g);
          const lb = h('div', 'sp-label', Engines.choiceHTML(c, q.latinCh)); labels.appendChild(lb);
          balloons.push({ m: g, c, lb, y0: g.position.y, alive: true });
        });
        hydrate(labels);
      };
      const IN = A.Input(wrap, { stick: 'xy', look: true, lockEl: rd.domElement, mouseFire: 'fire', buttons: [{ id: 'fire', icon: '🔫', label: '喷射', keys: ['j', 'J', 'f', 'F'], big: true }, { id: 'jump', icon: '⬆️', label: '跳', keys: [' '] }] });
      const cross = h('div', 'sp-cross'); wrap.appendChild(cross);
      let paused = true, done = false, last = performance.now(), tLeft = TIME, popped = 0, hint = h('div', 'sp-hint', IN.mode === 'kbm' ? '点击画面锁定鼠标 · WASD移动 · 鼠标瞄准 · 左键喷射 · 空格跳' : '左摇杆移动 · 右边拖动瞄准 · 按住🔫喷射'); wrap.appendChild(hint); setTimeout(() => hint.remove(), 6000);
      const drawHud = () => { const [a, b] = cover(); hud.innerHTML = '<span class="sp-time latin">' + Math.ceil(tLeft) + 's</span><div class="sp-bar"><i style="width:' + a * 100 + '%;background:' + MY + '"></i><i style="width:' + b * 100 + '%;background:' + RV + ';margin-left:auto"></i></div><span class="latin">' + Math.round(a * 100) + '% : ' + Math.round(b * 100) + '%</span><div class="sp-ink"><i style="height:' + me.ink + '%"></i></div>'; hydrate(hud); };
      const collide = (x, z, r) => { for (const s of solids) if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return s; return null; };
      const end = () => {
        if (done) return; done = true; IN.destroy(); if (document.pointerLockElement) document.exitPointerLock();
        const [a, b] = cover(), win = a > b;
        A.banner(wrap, win ? E('🏆') + ' 涂地胜利！' : E('💪') + ' 下次加油！', 2400); Audio2.sfx(win ? 'victory' : 'win', .6); if (win) UI.confetti(120);
        Voice.say(win ? '我们涂得更多，胜利啦！' : '对手涂得更多，下次加油');
        setTimeout(() => { S.setProgress(1, 1); S.end(false, win && S.right >= Math.max(1, S.total - 1) ? 3 : win ? 2 : 1); resolve(); }, 2200);
      };
      const tmp = new T.Vector3();
      const aimPoint = () => { const d = new T.Vector3(); cam.getWorldDirection(d); return cam.position.clone().addScaledVector(d, 30); };
      const loop = now => {
        if (!rd.domElement.isConnected) return;
        if (S.over && !done) { IN.destroy(); return; }
        const dt = Math.min(.05, (now - last) / 1000); loop.prev = last; last = now;
        if (!paused && !done) {
          tLeft -= Math.min(.25, (now - (loop.prev || now)) / 1000); if (tLeft <= 0) { tLeft = 0; end(); }
          const [ldx, ldy] = IN.look(); me.yaw -= ldx * .0032; me.pitch = Math.max(-.35, Math.min(.75, me.pitch + ldy * .0026));
          const mxi = IN.ax(), mzi = IN.ay(), fw = new T.Vector3(Math.sin(me.yaw), 0, Math.cos(me.yaw)), rt = new T.Vector3(-fw.z, 0, fw.x);
          const mv = fw.clone().multiplyScalar(-mzi).add(rt.clone().multiplyScalar(mxi)); if (mv.lengthSq() > 1) mv.normalize();
          const nx = me.x + mv.x * 9 * dt, nz = me.z + mv.z * 9 * dt;
          const sx = collide(nx, me.z, .6), sz2 = collide(me.x, nz, .6);
          if (!sx || me.y >= sx.h - .05) me.x = nx; if (!sz2 || me.y >= sz2.h - .05) me.z = nz;
          const under = collide(me.x, me.z, .3), floorY = under ? under.h : 0;
          if (IN.take('jump') && me.y <= floorY + .01) me.vy = 9;
          me.vy -= 24 * dt; me.y += me.vy * dt; if (me.y < floorY) { me.y = floorY; me.vy = 0; }
          me.g.position.set(me.x, me.y, me.z); me.g.rotation.y = me.yaw;
          if (me.g.ch) { me.g.ch.play(me.y > floorY + .05 ? 'jump' : mv.lengthSq() > .05 ? 'sprint' : IN.btn.fire ? 'holding-right-shoot' : 'idle'); me.g.ch.mixer.update(dt); }
          me.cd -= dt;
          if (IN.btn.fire && me.ink > 2 && me.cd <= 0) {
            me.cd = .09; me.ink -= 1.6; Audio2.sfx('pop', .08);
            // 墨弹从枪口射出，飞向准星对准的地方
            const o = rig ? rig.muzzle() : new T.Vector3(me.x, me.y + 1.4, me.z).add(fw.clone().multiplyScalar(.9)).add(rt.clone().multiplyScalar(.45));
            const dir = aimPoint().sub(o).normalize(); dir.y += .06; dir.normalize(); if (rig) rig.fire();
            fire(o, dir.add(new T.Vector3((Math.random() - .5) * .04, (Math.random() - .5) * .04, (Math.random() - .5) * .04)).normalize(), 1, 30);
          } me.ink = Math.min(100, me.ink + (IN.btn.fire ? 8 : 32) * dt);
          // 对手机器人
          bots.forEach(b => {
            b.t -= dt; if (b.t <= 0 || Math.hypot(b.tx - b.x, b.tz - b.z) < 2) { b.tx = R.int(-30, 30); b.tz = R.int(-30, 30); b.t = 4; }
            const d = Math.hypot(b.tx - b.x, b.tz - b.z) || 1, vx = (b.tx - b.x) / d * 6, vz = (b.tz - b.z) / d * 6;
            if (!collide(b.x + vx * dt, b.z + vz * dt, .6)) { b.x += vx * dt; b.z += vz * dt; } else b.t = 0;
            b.g.position.set(b.x, 0, b.z); b.g.rotation.y = Math.atan2(vx, vz); if (b.g.ch) { b.g.ch.play('sprint'); b.g.ch.mixer.update(dt); }
            b.cd -= dt; if (b.cd <= 0) { b.cd = .6 + (S.grade <= 1 ? .2 : 0); const a = Math.atan2(vx, vz) + (Math.random() - .5) * .8; fire(new T.Vector3(b.x, 1.4, b.z), new T.Vector3(Math.sin(a), .25, Math.cos(a)).normalize(), 2, 16); }
          });
          // 墨弹飞行
          for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i]; s.v.y -= (s.team === 1 ? 7 : 16) * dt; s.m.position.addScaledVector(s.v, dt); s.life -= dt;
            const p = s.m.position; let gone = false;
            if (s.team === 1) for (const b of balloons) { if (b.alive && p.distanceTo(b.m.position) < 2.3) { gone = true; popBalloon(b); break; } }
            const so = collide(p.x, p.z, 0);
            if (!gone && (p.y <= 0 || (so && p.y < so.h) || s.life <= 0)) { gone = true; if (p.y <= .5) splash(p.x, p.z, s.team === 1 ? 2.4 : 1.1, s.team); }
            if (gone) { scene.remove(s.m); shots.splice(i, 1); }
          }
          if (Math.floor(now / 400) !== Math.floor((now - dt * 1000) / 400)) drawHud();
        }
        balloons.forEach((b, i) => { if (b.alive) b.m.position.y = b.y0 + Math.sin(now / 600 + i) * .4; else { b.m.scale.multiplyScalar(1 + dt * 6); if (b.m.scale.x > 2) b.m.visible = false; } });
        // 第三人称镜头
        const fw = new T.Vector3(Math.sin(me.yaw) * Math.cos(me.pitch), -Math.sin(me.pitch), Math.cos(me.yaw) * Math.cos(me.pitch));
        const head = new T.Vector3(me.x, me.y + 2.2, me.z), rt = new T.Vector3(-Math.cos(me.yaw), 0, Math.sin(me.yaw));
        tmp.copy(head).addScaledVector(fw, -5.5).addScaledVector(rt, -1.1).add(new T.Vector3(0, .8, 0)); if (tmp.y < .6) tmp.y = .6;
        cam.position.lerp(tmp, .35); cam.lookAt(head.clone().addScaledVector(fw, 12));
        if (rig) rig.update(dt, me.yaw, aimPoint());
        if (window.__SP_SIDE) { const sv = cam.position.clone(), sq = cam.quaternion.clone(); cam.position.set(me.x, me.y + 1.6, me.z).addScaledVector(rt, -2.6).addScaledVector(new T.Vector3(Math.sin(me.yaw), 0, Math.cos(me.yaw)), 1.6); cam.lookAt(me.x, me.y + 1.3, me.z); rd.render(scene, cam); cam.position.copy(sv); cam.quaternion.copy(sq); } else // 测试用：从侧面看持枪姿势
        rd.render(scene, cam);
        const sz = G3.size(); balloons.forEach(b => { if (b.alive) project(b.m.position.clone().add(new T.Vector3(0, 1.8, 0)), cam, sz, b.lb, 0); else b.lb.style.opacity = 0; });
        requestAnimationFrame(loop);
      };
      const popBalloon = async b => {
        b.alive = false; Audio2.sfx('pop', .6); const p = b.m.position;
        if (b.c.ok) { S.right++; S.total++; popped++; splash(p.x, p.z, 7, 1); Audio2.sfx('right', .5); A.banner(wrap, E('💥') + ' 答对啦！超级墨水炸弹！', 1100); balloons.forEach(o => { if (o.alive && o !== b) { o.alive = false; } }); setTimeout(() => { if (!done) newQ(); }, 900); }
        else { S.wrong++; S.total++; S.wrongs.push(q.p + ' → ' + (q.ch.find(c => c.ok) || {}).t); splash(p.x, p.z, 5, 2); Audio2.sfx('wrong', .4); UI.toast('打错啦，被对手的颜色占领了', 1200); }
        drawHud();
      };
      S.sp = { me, IN, cam, rig: () => rig }; // 测试用
      newQ(); drawHud(); requestAnimationFrame(loop);
      await A.countdown(wrap); last = performance.now(); paused = false; Voice.say('涂地开始！');
      S.auto = () => {
        const b = balloons.find(z => z.alive && z.c.ok); IN.sx = Math.sin(now2()) * .6; IN.sy = -.4; IN.btn.fire = true;
        if (b && Math.floor(now2() * 2) % 3) { const head = new T.Vector3(me.x, me.y + 1.4, me.z), d = b.m.position.clone().sub(head), dx = Math.hypot(d.x, d.z), v = 30, g = 7, disc = v ** 4 - g * (g * dx * dx + 2 * d.y * v * v);
          me.yaw = Math.atan2(d.x, d.z); const th = disc > 0 ? Math.atan((v * v - Math.sqrt(disc)) / (g * dx)) : Math.atan2(d.y, dx); me.pitch = Math.max(-.35, Math.min(.75, -th + .02)); }
        else me.pitch = .45;
      };
      const now2 = () => performance.now() / 1500;
    });
  }

  /* =====================================================================
     星星滚球：推着水晶球滚过空中跑道，滚进写着正确答案的终点圈
     ===================================================================== */
  const ROLL_PAL = [['#7be0a8', '#5cc98c'], ['#ffd27a', '#ffbf4d'], ['#a7c8ff', '#86b0ff'], ['#ffb3d1', '#ff94bd'], ['#c9b5ff', '#b199ff']];
  function roll(S, data) {
    return new Promise(async resolve => {
      const { wrap, hud, labels } = A.arena(S, 'rl');
      const G3 = renderer3d(wrap), { T, rd, cam } = G3, scene = new T.Scene(), SKY = 0xa8dcff;
      const sun = lights(scene, T, SKY); scene.fog = new T.Fog(SKY, 45, 170);
      Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, far: 160 }); sun.shadow.camera.updateProjectionMatrix();
      const HAS = await Models.ready();
      const g = Math.max(0, Math.min(4, S.grade)), nextQ = A.feeder(S, data), ROUNDS = g <= 1 ? 4 : 5, C = 4, BR = .8, NW = 1.8;
      const RAIL = [1, 1, .6, .4, .3][g];
      const qBox = h('div', 'dn-q sp-q'); wrap.appendChild(qBox);
      // 远景：云海 + 漂浮小岛 + 云朵
      const sea = new T.Mesh(new T.PlaneGeometry(900, 900), mat(0xf4f9ff, { roughness: 1 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -34; scene.add(sea);
      const puffM = mat(0xffffff, { roughness: 1, flatShading: true });
      for (let k = 0; k < 26; k++) { const cl = new T.Group(); for (let n = 0; n < 4; n++) cl.add(mesh(new T.SphereGeometry(2 + Math.random() * 2.5, 7, 5), puffM, n * 2.6 - 4, Math.random(), Math.random() * 2)); cl.position.set(R.int(-70, 70), R.int(-16, -7), R.int(-30, 110)); if (Math.abs(cl.position.x) < 14) cl.position.x += 30 * Math.sign(cl.position.x || 1); scene.add(cl); }
      for (let k = 0; k < 9; k++) {
        const isl = new T.Group(), s = 3 + Math.random() * 4;
        isl.add(mesh(new T.ConeGeometry(s, s * 1.6, 7), mat(0x9a7a5a, { flatShading: true }), 0, -s * .8, 0)); isl.children[0].rotation.x = Math.PI;
        isl.add(mesh(new T.CylinderGeometry(s, s, .6, 7), mat(0x7ccf5a, { flatShading: true }), 0, .3, 0));
        const tm = HAS && Models.make(R.pick(['tree', 'pine']), s * 1.1, 'y'); if (tm) { tm.position.y = .6; isl.add(tm); } else isl.add(tree(T, 0, 0, s * .25));
        isl.position.set(R.pick([-1, 1]) * R.int(22, 55), R.int(-10, 6), R.int(-10, 100)); scene.add(isl);
      }
      // 水晶球 + 球里的小人
      const p = Core.Store.p, HERO = App.HEROES.find(x => x.id === p.hero) || App.HEROES[0];
      const heroCol = { 'k-green': 0x3ccf7e, 'k-pink': 0xff6fae, 'k-purple': 0x9b5cf6, 'k-yellow': 0xffd23f, 'k-beige': 0xf3c79a }[HERO.id] || 0x3ec1d3;
      const ball = new T.Group(), shell = new T.Group(); ball.add(shell); scene.add(ball);
      const glass = new T.Mesh(new T.SphereGeometry(BR, 32, 24), new T.MeshStandardMaterial({ color: 0xe8f7ff, roughness: .05, metalness: .1, transparent: true, opacity: .3, depthWrite: false }));
      glass.castShadow = true; shell.add(glass);
      const bandM = mat(heroCol, { emissive: heroCol, emissiveIntensity: .35, roughness: .3 });
      [0, Math.PI / 2].forEach(a => { const b = new T.Mesh(new T.TorusGeometry(BR * .99, .05, 8, 48), bandM); b.rotation.y = a; shell.add(b); });
      const kidBox = new T.Group(); kidBox.position.y = -BR + .04; ball.add(kidBox);
      let kid = null;
      const k0 = HAS && Models.make(/pink|purple/.test(p.hero) ? 'girl1' : 'boy1', 1.15, 'y');
      if (k0) { kidBox.add(k0); kid = { play: n => k0.play(n), update: dt => k0.mixer.update(dt) }; kid.play('idle'); }
      else { kidBox.add(mesh(new T.CapsuleGeometry(.22, .35, 4, 8), mat(heroCol), 0, .45, 0)); kidBox.add(mesh(new T.SphereGeometry(.24, 12, 10), mat(0xffe0c8), 0, .95, 0)); }
      const hk = window.App && App.heroModel && App.heroModel(p);
      if (hk && window.Avatar3D) Avatar3D.make(hk, { height: 1.15, style: Avatar3D.styleOf(Core.theme()) }).then(av => {
        if (!ball.parent) return; kidBox.clear(); kidBox.add(av);
        kid = { play: n => av.play(n === 'sprint' ? 'run' : n), update: dt => av.update(dt) }; kid.play('idle');
      }).catch(() => {});
      // 关卡（每一关一条新跑道）
      const B = { x: 0, y: BR, z: 0, vx: 0, vy: 0, vz: 0, on: true };
      const key = (i, j) => i + ',' + j;
      let course = null, cells = new Map(), rails = new Set(), goals = [], coins = [], sweeps = [], way = [], wi = 0, q = null;
      let r = -1, won = 0, falls = 0, nCoins = 0, paused = true, done = false, roundDone = true, safe = { x: 0, z: 0 }, tilt = 0, bumpT = 0;
      const build = rn => {
        if (course) scene.remove(course); labels.innerHTML = '';
        course = new T.Group(); scene.add(course); cells = new Map(); rails = new Set(); goals = []; coins = []; sweeps = []; way = []; wi = 0;
        q = nextQ(); if (q.ch.length > 4) q.ch = R.shuffle([q.ch.find(c => c.ok)].concat(q.ch.filter(c => !c.ok).slice(0, 3)));
        // 路径：只往前或往旁边走，不会绕回来
        const L = 6 + g + rn, path = [[0, 0]]; let i = 0, j = 0, run = 0, sd = 0;
        for (let k = 1; k < L; k++) {
          if (run > 0) { i += sd; run--; } else if (k > 1 && k < L - 2 && Math.random() < .32) { sd = R.pick([-1, 1]); run = R.int(0, 1); i += sd; } else j++;
          path.push([i, j]);
        }
        j++; path.push([i, j]);
        const add = (ci, cj, o) => { const c = Object.assign({ i: ci, j: cj, rail: Math.random() < RAIL }, o || {}); cells.set(key(ci, cj), c); return c; };
        path.forEach(([ci, cj], k) => {
          const pv = path[k - 1], nx = path[k + 1], straight = pv && nx && pv[0] === ci && nx[0] === ci;
          const narrow = g >= 2 && k >= 2 && k < path.length - 1 && straight && Math.random() < .3;
          add(ci, cj, { narrow, rail: k === 0 || (!narrow && Math.random() < RAIL), k, straight });
        });
        const n = q.ch.length, jh = j + 1, cols = q.ch.map((_, m) => i + Math.round((m - (n - 1) / 2) * 2));
        for (let ci = Math.min(...cols); ci <= Math.max(...cols); ci++) add(ci, jh, { hub: true });
        // 终点圈
        q.ch.forEach((c, m) => {
          add(cols[m], jh + 1, {}); const gc = add(cols[m], jh + 2, { rail: true });
          const col = new T.Color().setHSL((m * .23 + .02) % 1, .85, .58), gx = cols[m] * C, gz = (jh + 2) * C;
          const rm = mat(col, { emissive: col, emissiveIntensity: .45, roughness: .25, metalness: .2 });
          const ring = mesh(new T.TorusGeometry(1.45, .22, 12, 40), rm, gx, 1.75, gz);
          const pad = new T.Mesh(new T.CircleGeometry(1.5, 32), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .55 })); pad.rotation.x = -Math.PI / 2; pad.position.set(gx, .02, gz);
          course.add(ring, pad);
          const lb = h('div', 'sp-label rl-label', Engines.choiceHTML(c, q.latinCh)); lb.style.borderColor = '#' + col.getHexString(); labels.appendChild(lb);
          gc.goal = { c, ring, rm, pad, lb, x: gx, z: gz, hex: '#' + col.getHexString() }; goals.push(gc.goal);
        });
        hydrate(labels);
        // 自动测试用路点
        path.forEach(([ci, cj]) => way.push([ci * C, cj * C]));
        const okc = cols[q.ch.findIndex(c => c.ok)]; way.push([i * C, jh * C], [okc * C, jh * C], [okc * C, (jh + 2) * C]);
        // 旋转挡杆的位置：彼此至少隔两格，所在格子一定有栏杆
        const sweepCells = [];
        R.shuffle([...cells.values()].filter(c => c.k >= 2 && c.k < path.length - 2 && c.straight && !c.narrow)).forEach(c => { if (sweepCells.length < (g >= 3 ? 2 : g >= 2 ? 1 : 0) && sweepCells.every(o => Math.abs(o.k - c.k) > 2)) { c.rail = true; sweepCells.push(c); } });
        // 地块 + 栏杆
        const [ca, cb] = ROLL_PAL[rn % ROLL_PAL.length];
        const topM = new T.MeshStandardMaterial({ roughness: .6, map: tex(64, 64, (c, w, hh) => { c.fillStyle = ca; c.fillRect(0, 0, w, hh); c.fillStyle = cb; c.fillRect(0, 0, w / 2, hh / 2); c.fillRect(w / 2, hh / 2, w / 2, hh / 2); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, hh - 3); }) });
        const sideM = mat(0x8a6a4a, { flatShading: true }), railM = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: .15, roughness: .4 }), postM = mat(heroCol);
        const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        cells.forEach(c => {
          const w = c.narrow ? NW : C, x = c.i * C, z = c.j * C;
          course.add(mesh(new T.BoxGeometry(w, .6, C), [sideM, sideM, topM, sideM, sideM, sideM], x, -.3, z));
          if (!c.narrow) { const cone = mesh(new T.ConeGeometry(C * .55, 2.2, 6), sideM, x, -1.7, z); cone.rotation.x = Math.PI; course.add(cone); } // 浮岛底
          if (c.narrow || !c.rail) return;
          DIRS.forEach(([di, dj]) => {
            if (cells.has(key(c.i + di, c.j + dj))) return;
            rails.add(key(c.i, c.j) + '>' + key(c.i + di, c.j + dj));
            const rx = x + di * (C / 2 - .12), rz = z + dj * (C / 2 - .12);
            course.add(mesh(new T.BoxGeometry(di ? .24 : C, .22, dj ? .24 : C), railM, rx, .55, rz));
            [-1, 1].forEach(sg => course.add(mesh(new T.CylinderGeometry(.09, .09, .6, 6), postM, rx + (dj ? sg * (C / 2 - .15) : 0), .3, rz + (di ? sg * (C / 2 - .15) : 0))));
          });
        });
        // 金币
        path.forEach(([ci, cj], k) => { if (k && Math.random() < .55) { const m = (HAS && Models.make('coin', .8)) || mesh(new T.CylinderGeometry(.35, .35, .1, 16), mat(0xffd23f, { metalness: .6, roughness: .3 })); if (!m.isGroup) m.rotation.x = Math.PI / 2; m.position.set(ci * C, .35, cj * C); course.add(m); coins.push({ m, x: ci * C, z: cj * C }); } });
        // 旋转挡杆（高年级）
        sweepCells.forEach(c => {
          const x = c.i * C, z = c.j * C, m = new T.Group(); m.position.set(x, 0, z);
          m.add(mesh(new T.CylinderGeometry(.25, .3, 1, 10), mat(0x555a66), 0, .5, 0));
          const bar = mesh(new T.BoxGeometry(C * .86, .32, .32), mat(0xff4d6d, { roughness: .4 }), 0, .55, 0); m.add(bar);
          course.add(m); sweeps.push({ m, x, z, a: Math.random() * 6, w: (1 + g * .15) * R.pick([-1, 1]), len: C * .86, cd: 0 });
          coins = coins.filter(o => { if (o.x === x && o.z === z) { course.remove(o.m); return false; } return true; }); // 挡杆格子上的金币够不着，直接去掉
        });
      };
      const cellAt = (x, z) => cells.get(key(Math.round(x / C), Math.round(z / C)));
      const support = (x, z) => { const c = cellAt(x, z); return !!c && (!c.narrow || Math.abs(x - c.i * C) < NW / 2); };
      const railed = (x, z, px, pz) => { const a = key(Math.round(x / C), Math.round(z / C)), b = key(Math.round(px / C), Math.round(pz / C)); return a !== b && rails.has(a + '>' + b); };
      const drawHud = () => { hud.innerHTML = '<span>第 <b class="latin">' + Math.min(ROUNDS, r + 1) + '</b>/' + ROUNDS + ' 关</span><span>' + E('❤️') + ' <b class="latin">' + Math.max(0, S.hearts) + '</b></span><span>' + E('🪙') + ' <b class="latin">' + nCoins + '</b></span><span>' + E('❓') + ' <b class="latin">' + S.right + '/' + S.total + '</b></span>'; hydrate(hud); };
      const IN = A.Input(wrap, { stick: 'xy', buttons: [{ id: 'brake', icon: '🛑', label: '刹车', keys: [' ', 'Shift'], big: true }] });
      const end = failed => {
        if (done) return; done = true; IN.destroy(); S.setProgress(ROUNDS, ROUNDS);
        if (failed) S.end(true); else S.end(false, won === ROUNDS && falls <= 1 ? 3 : won >= ROUNDS - 1 ? 2 : 1);
        resolve();
      };
      const nextRound = () => {
        if (done || S.over) return;
        r++; S.setProgress(r, ROUNDS); if (r >= ROUNDS) return end(false);
        build(r); Object.assign(B, { x: 0, y: BR, z: 0, vx: 0, vy: 0, vz: 0, on: true }); safe = { x: 0, z: 0 }; shell.quaternion.identity();
        qBox.innerHTML = ''; const QP = Engines.qPanel(q); qBox.appendChild(QP.el);
        const keys = h('div', 'rl-keys', [...goals].sort((a, b) => a.x - b.x).reverse().map(gl => '<span class="rl-key" style="border-color:' + gl.hex + '"><i style="background:' + gl.hex + '"></i>' + Engines.choiceHTML(gl.c, q.latinCh) + '</span>').join('')); qBox.appendChild(keys); hydrate(keys); QP.speak();
        A.banner(wrap, '第 ' + (r + 1) + ' / ' + ROUNDS + ' 关', 1100); roundDone = false; drawHud();
      };
      const pick = async gl => {
        if (roundDone) return; roundDone = true; IN.release();
        if (gl.c.ok) { won++; S.right++; S.total++; Audio2.sfx('right', .5); Audio2.sfx('victory', .4); UI.confetti(70); A.banner(wrap, E('🎉') + ' 滚进去啦！答对了！', 1200); drawHud(); await Voice.say(R.pick(Engines.PRAISE)); }
        else {
          S.wrong++; S.total++; S.wrongs.push(q.p + ' → ' + (q.ch.find(c => c.ok) || {}).t); Audio2.sfx('wrong', .4); drawHud();
          const okG = goals.find(x => x.c.ok); okG.glow = true; okG.lb.classList.add('reveal'); okG.rm.emissive.set(0x3cff7a); okG.rm.emissiveIntensity = 1;
          UI.toast('滚错圈啦！发光的才是正确答案', 1500); await Voice.say(q.ex || '发光的才是正确答案'); await sleep(500);
        }
        await sleep(500); nextRound();
      };
      const fall = () => {
        falls++; Audio2.sfx('hurt', .5);
        if (!S.god) { S.hearts--; S.renderHearts(); if (S.hearts <= 0) { drawHud(); return end(true); } }
        Object.assign(B, { x: safe.x, y: BR + 2, z: safe.z, vx: 0, vy: 0, vz: 0, on: false });
        let bi = 0, bd = 1e9; way.forEach((w, k) => { const d = Math.hypot(w[0] - safe.x, w[1] - safe.z); if (d < bd) { bd = d; bi = k; } }); wi = bi;
        A.banner(wrap, E('💫') + ' 掉下去啦！小心点哦', 1100); drawHud();
      };
      const step = dt => {
        let fx = 0, fz = 0, brake = roundDone;
        if (!roundDone) { fx = -IN.ax(); fz = -IN.ay(); const fl = Math.hypot(fx, fz); if (fl > 1) { fx /= fl; fz /= fl; } brake = !!IN.btn.brake; }
        tilt += (fx * .06 - tilt) * Math.min(1, dt * 6);
        if (B.on) {
          B.vx += fx * 15 * dt; B.vz += fz * 15 * dt;
          const dm = Math.exp(-(brake ? 4.5 : .8) * dt); B.vx *= dm; B.vz *= dm;
          const sp = Math.hypot(B.vx, B.vz), MAX = 10 + g; if (sp > MAX) { B.vx *= MAX / sp; B.vz *= MAX / sp; }
        } else { B.vx += fx * 3 * dt; B.vz += fz * 3 * dt; }
        bumpT -= dt;
        const bump = v => { if (Math.abs(v) > 2.5 && bumpT <= 0) { Audio2.sfx('bump', .25); bumpT = .25; } };
        let nx = B.x + B.vx * dt; if (B.on && railed(B.x, B.z, nx + Math.sign(B.vx) * BR, B.z)) { bump(B.vx); B.vx *= -.45; nx = B.x; } B.x = nx;
        let nz = B.z + B.vz * dt; if (B.on && railed(B.x, B.z, B.x, nz + Math.sign(B.vz) * BR)) { bump(B.vz); B.vz *= -.45; nz = B.z; } B.z = nz;
        // 旋转挡杆
        sweeps.forEach(s => {
          s.a += s.w * dt; s.m.rotation.y = s.a; s.cd -= dt;
          const dx = Math.cos(s.a), dz = -Math.sin(s.a), rx = B.x - s.x, rz = B.z - s.z, t = Math.max(-s.len / 2, Math.min(s.len / 2, rx * dx + rz * dz));
          const px = rx - t * dx, pz = rz - t * dz, d = Math.hypot(px, pz);
          if (B.y < 1.5 && d < BR + .18 && d > 1e-4) { const ux = px / d, uz = pz / d; B.x += ux * (BR + .18 - d); B.z += uz * (BR + .18 - d); const kick = 3 + Math.abs(s.w * t) * .8; B.vx += ux * kick; B.vz += uz * kick; if (s.cd <= 0) { Audio2.sfx('hit', .35); s.cd = .3; } }
        });
        const sup = support(B.x, B.z);
        if (B.on && !sup) { B.on = false; B.vy = 0; }
        if (!B.on) {
          B.vy -= 26 * dt; B.y += B.vy * dt;
          if (sup && B.vy < 0 && B.y <= BR && B.y > BR - .35) { B.y = BR; B.vy = 0; B.on = true; Audio2.sfx('drop', .25); }
          if (B.y < -16) return fall();
        }
        if (!B.on || roundDone) return;
        const c = cellAt(B.x, B.z);
        if (c && !c.goal && !c.narrow && !sweeps.some(s => s.x === c.i * C && s.z === c.j * C)) safe = { x: c.i * C, z: c.j * C };
        coins.forEach(o => { if (!o.got && Math.hypot(o.x - B.x, o.z - B.z) < 1.1) { o.got = true; o.m.visible = false; nCoins++; Audio2.sfx('coin', .3); drawHud(); } });
        if (c && c.goal && B.z > c.j * C - .8) pick(c.goal);
      };
      const look = new T.Vector3(0, 0, 4), want = new T.Vector3(), axis = new T.Vector3(), qt = new T.Quaternion();
      let last = performance.now(), kidYaw = 0;
      const loop = now => {
        if (!rd.domElement.isConnected) return;
        if (S.over && !done) { IN.destroy(); return; }
        const dt = Math.min(.033, (now - last) / 1000); last = now;
        if (!paused && !done && course) step(dt);
        // 球的滚动 + 小人朝向
        ball.position.set(B.x, B.y, B.z);
        const sp = Math.hypot(B.vx, B.vz);
        if (sp > .02) {
          axis.set(B.vz, 0, -B.vx).normalize(); qt.setFromAxisAngle(axis, sp * dt / BR); shell.quaternion.premultiply(qt);
          let d = Math.atan2(B.vx, B.vz) - kidYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; kidYaw += d * Math.min(1, dt * 8); kidBox.rotation.y = kidYaw;
        }
        if (kid) { kid.play(sp > 1.5 ? 'sprint' : 'idle'); kid.update(dt); }
        coins.forEach(o => { o.m.rotation.y += dt * 3; });
        goals.forEach((gl, k) => { gl.ring.rotation.y = Math.sin(now / 700 + k) * .35; const s = gl.glow ? 1 + Math.sin(now / 90) * .08 : 1 + Math.sin(now / 400 + k) * .03; gl.ring.scale.setScalar(s); });
        // 镜头：跟在球后上方，推摇杆时轻微倾斜
        want.set(B.x, Math.max(B.y, -3) + 10.5, B.z - 7.8); cam.position.lerp(want, B.on ? .1 : .05);
        look.lerp(want.set(B.x, Math.max(B.y, -4), B.z + 7), .16); cam.lookAt(look); cam.rotateZ(tilt);
        sun.position.set(B.x + 18, 40, B.z - 6); sun.target.position.set(B.x, 0, B.z + 4);
        rd.render(scene, cam);
        const sz = G3.size(); goals.forEach(gl => project(new T.Vector3(gl.x, 3.4, gl.z), cam, sz, gl.lb, 0));
        requestAnimationFrame(loop);
      };
      nextRound(); requestAnimationFrame(loop);
      const hint = h('div', 'sp-hint', IN.mode === 'kbm' ? 'WASD / 方向键 滚动水晶球 · 空格 刹车' : '左边摇杆滚动水晶球 · 🛑 刹车'); wrap.appendChild(hint); setTimeout(() => hint.remove(), 6000);
      await A.countdown(wrap); last = performance.now(); paused = false; Voice.say('滚起来吧！');
      S.auto = () => {
        S.god = true; if (!way.length || roundDone || !B.on) { IN.sx = IN.sy = 0; return; }
        while (wi < way.length - 1 && Math.hypot(way[wi][0] - B.x, way[wi][1] - B.z) < 1.2) wi++;
        const [wx, wz] = way[wi], dx = wx - B.x, dz = wz - B.z, d = Math.hypot(dx, dz) || 1, tv = Math.min(4.5, d * 2.2);
        let fx = dx / d * tv - B.vx, fz = dz / d * tv - B.vz; const f = Math.hypot(fx, fz) || 1;
        IN.sx = -fx / f; IN.sy = -fz / f;
      };
    });
  }

  Object.assign(Engines.ENGINES, { kart, splat, roll });
})();
