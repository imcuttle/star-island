/* 3D 角色 / 宠物：带骨骼动画的 GLB 模型（assets/models/c/<key>.js，base64，按需加载，file:// 可用）
   · 按画风换材质：卡通描边、清新三阶色、精致 PBR + 轮廓光、像素、水墨、霓虹、黏土、P3 冷色赛璐璐
   · portrait()：离屏渲染立绘截图（共用一个 WebGL 上下文），用于 HUD、卡片、弹窗
   · make()：创建可在场景里播放动作的实例（idle / walk / run / jump / wave / attack / hit / die / dance / sit / eat …） */
(function () {
  const A = {};
  let T = null;
  const raw = {}, waiters = {}, gltfP = {};
  // 模型文件脚本调用 __CH(key, base64)
  window.__CH = (k, b64) => { raw[k] = b64; (waiters[k] || []).forEach(f => f()); delete waiters[k]; };
  A.supported = () => { try { if (!window.THREE || !THREE.GLTFLoader) return false; if (A._sup != null) return A._sup; const c = document.createElement('canvas'); return (A._sup = !!(c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } };
  A.has = k => !!(window.CHAR_INDEX && CHAR_INDEX[k]);

  function loadRaw(k) {
    if (raw[k]) return Promise.resolve();
    return new Promise((res, rej) => {
      (waiters[k] = waiters[k] || []).push(res);
      if (waiters[k].length > 1) return;
      const s = document.createElement('script'); s.src = 'assets/models/c/' + k + '.js'; s.async = true;
      s.onerror = () => { delete waiters[k]; rej(new Error('model ' + k)); };
      document.head.appendChild(s);
    });
  }
  A.load = function (k) {
    if (gltfP[k]) return gltfP[k];
    T = window.THREE;
    return (gltfP[k] = loadRaw(k).then(() => new Promise((res, rej) => {
      const b = atob(raw[k]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      new T.GLTFLoader().parse(u.buffer, '', g => { delete raw[k]; res(g); }, rej);
    })));
  };

  // 个别模型的修正：飞行类离地、给白马加独角
  // 动漫眼的虹膜色相（0-1）
  const EYE_HUE = { cat: .1, slime_green: .3, slime_pink: .92, mushroom: .55, cactus: .28, chick: .07, puffbird: .78, ghost: .97, yeti: .54, alpaking: .12, dragon: .04, dragon_king: .08, frog: .2, bluebird: .6 };
  const META = { unicorn: { horn: [0, .1, .06, .5] }, dragon: { fly: .3 }, dragon_king: { fly: .3 }, ghost: { fly: .2 }, alpaking: { fly: .25 } };
  /* ---------- 动作名归一化 ---------- */
  const ANIM = {
    idle: [/^idle$/i, /\|idle$/i, /idle(?!.*(hit|react|eat|attack|sit|2|_b))/i, /stand/i, /static/i],
    idle2: [/idle.?2|idle_b|idle_look|look.?around|idle_eating|idle.?headlow/i],
    walk: [/^walk$/i, /\|walk$/i, /walk(?!.*(back|left|right|carry|gun))/i, /move/i],
    run: [/^run$/i, /\|run$/i, /run(?!.*(back|left|right|gun|shoot))/i, /gallop(?!.*jump)/i, /sprint/i, /trot/i, /fly/i, /swim/i],
    jump: [/^jump$/i, /jump(?!.*(land|idle|toidle))/i, /jump/i, /bounce/i],
    wave: [/wave/i, /yes/i, /emote.?yes/i, /victory/i, /celebrat/i, /cheer/i],
    yes: [/yes/i, /nod/i, /wave/i],
    no: [/no$/i, /\bno\b/i, /emote.?no/i, /shake/i],
    attack: [/punch/i, /attack/i, /sword|slash/i, /headbutt/i, /kick/i, /bite/i, /shoot/i, /spell|cast/i],
    hit: [/hit.?react|recieve|receive|hit(?!.*react)|hurt|damage/i],
    die: [/death|die|dead/i],
    dance: [/dance/i, /victory/i, /celebrat/i, /spin/i, /jump/i],
    sit: [/sit(?!.*(wheel|up))/i, /crouch/i, /idle.?headlow|eat/i],
    eat: [/eat/i, /idle.?headlow/i, /pick.?up/i, /interact/i],
  };
  function animMap(clips) {
    const out = {}, names = clips.map(c => c.name);
    Object.entries(ANIM).forEach(([k, pats]) => { for (const p of pats) { const n = names.find(x => p.test(x.replace(/^.*\|/, '')) || p.test(x)); if (n) { out[k] = n; break; } } });
    if (!out.idle && names.length) out.idle = names[0];
    if (!out.walk) out.walk = out.run || out.idle; if (!out.run) out.run = out.walk;
    return out;
  }

  /* ---------- 画风材质 ---------- */
  const STYLE = {
    kid: { m: 'toon', steps: 3, ol: 2.6, olc: 0x3d4f86, sat: 1.18, light: 1.25 },
    mid: { m: 'toon', steps: 3, ol: 1.6, olc: 0x1f2a4d, sat: 1.05, rim: [0xffffff, .35] },
    pro: { m: 'pbr', ol: 0, rim: [0x9fb4ff, .9], light: 1.0 },
    paper: { m: 'toon', steps: 2, ol: 2.2, olc: 0x5a4636, sat: .95 },
    sketch: { m: 'toon', steps: 2, ol: 2.6, olc: 0x333333, sat: .55, light: 1.15 },
    sticker: { m: 'toon', steps: 3, ol: 3.2, olc: 0xffffff, sat: 1.2 },
    water: { m: 'toon', steps: 4, ol: 1.2, olc: 0x6a6070, sat: .8, light: 1.1 },
    clay: { m: 'clay', ol: 0, sat: 1.1 },
    pixel: { m: 'toon', steps: 2, ol: 1, olc: 0x101020, sat: 1.2, pixel: 4 },
    ink: { m: 'toon', steps: 2, ol: 3, olc: 0x111111, sat: 0, light: 1.15 },
    neon: { m: 'pbr', ol: 1.4, olc: 0x00f0ff, rim: [0xff3df2, 1.6], dark: .55 },
    p3: { m: 'toon', steps: 2, ol: 2.4, olc: 0x050a1e, sat: 1.0, rim: [0x6fe0ff, .55], shadow: 0x2a4c9a },
    // 怪盗风：粗黑描边 + 两阶赛璐璐 + 红色轮廓光
    p5: { m: 'toon', steps: 2, ol: 3, olc: 0x000000, sat: 1.08, rim: [0xff2a3a, .5], shadow: 0x3a1018, light: 1.05 },
    // 暗影（敌人）：几乎全黑的身体 + 血红描边与轮廓光
    shadow: { m: 'toon', steps: 2, ol: 3.4, olc: 0xe60012, sat: .15, dark: .22, rim: [0xff0a28, 1.5] },
    // 精致动漫风：和 VRoid 角色同一套 MToon 着色（柔和两阶 + 偏紫的阴影色 + 淡淡的边缘光 + 同色系细描边）
    anime: { m: 'mtoon', ol: 1.25, sat: 1.22, lift: 1.12, smooth: true, eyes: true },
    // 家园家具：同一套 MToon，细描边、阴影更柔
    room: { m: 'mtoon', ol: .9, sat: 1.0, shift: -.18, toony: .78, rimc: 0x3a3048 },
  };
  A.styleOf = theme => STYLE[theme] ? theme : 'kid';
  const grads = {};
  function gradTex(n) {
    T = window.THREE;
    if (grads[n]) return grads[n];
    const d = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { const v = n === 2 ? (i ? 255 : 120) : Math.round(90 + 165 * i / (n - 1)); d.set([v, v, v, 255], i * 4); }
    const t = new T.DataTexture(d, n, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return (grads[n] = t);
  }
  const outlineU = { uOl: { value: .004 }, uAspect: { value: 1 } };
  A.setViewport = (w, hh) => { outlineU.uAspect.value = w / Math.max(1, hh); A._vh = hh; };
  // 低多边形模型的硬边法线会让描边裂开：按顶点位置平均出一套平滑法线专供描边用
  function smoothNormals(g) {
    T = window.THREE;
    if (g.attributes.smoothNormal || !g.attributes.normal) return;
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count, map = new Map(), acc = new Float32Array(n * 3);
    const key = i => Math.round(pos.getX(i) * 1e4) + ',' + Math.round(pos.getY(i) * 1e4) + ',' + Math.round(pos.getZ(i) * 1e4);
    for (let i = 0; i < n; i++) { const k = key(i); let a = map.get(k); if (!a) map.set(k, a = [0, 0, 0]); a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); }
    for (let i = 0; i < n; i++) { const a = map.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; acc[i * 3] = a[0] / l; acc[i * 3 + 1] = a[1] / l; acc[i * 3 + 2] = a[2] / l; }
    g.setAttribute('smoothNormal', new T.BufferAttribute(acc, 3));
  }
  function outlineMat(color, px) {
    const m = new T.MeshLambertMaterial({ color: 0x000000, emissive: color, side: T.BackSide });
    m.userData.px = px;
    m.onBeforeCompile = sh => {
      sh.uniforms.uOl = outlineU.uOl; sh.uniforms.uAspect = outlineU.uAspect; sh.uniforms.uPx = { value: px };
      sh.vertexShader = 'uniform float uOl; uniform float uAspect; uniform float uPx;\nattribute vec3 smoothNormal;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = smoothNormal;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif').replace('#include <project_vertex>', '#include <project_vertex>\n vec3 vnO = normalize(normalMatrix * objectNormal); vec2 offO = (projectionMatrix * vec4(vnO, 0.0)).xy; offO = normalize(offO + vec2(1e-5)); offO.x /= uAspect; gl_Position.xy += offO * uOl * uPx * gl_Position.w;');
    };
    m.customProgramCacheKey = () => 'ol' + px;
    return m;
  }
  function addRim(m, color, k) {
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = sh => {
      prev && prev(sh);
      sh.uniforms.uRim = { value: new T.Color(color) }; sh.uniforms.uRimK = { value: k };
      sh.fragmentShader = 'uniform vec3 uRim; uniform float uRimK;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight += uRim * uRimK * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'rim' + color + k;
  }
  function tint(c, st) {
    const col = c.clone(); if (st.sat != null && st.sat !== 1) { const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s * st.sat), hsl.l); }
    if (st.dark) col.multiplyScalar(st.dark); return col;
  }
  function desatTex(tex, st) {
    if (!tex || !tex.image || (st.sat == null || st.sat === 1)) return tex;
    try {
      const img = tex.image, w = img.width, hh = img.height; if (!w || w > 2048) return tex;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, w, hh), a = d.data, s = st.sat;
      for (let i = 0; i < a.length; i += 4) { const l = a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11; a[i] = Math.max(0, Math.min(255, l + (a[i] - l) * s)); a[i + 1] = Math.max(0, Math.min(255, l + (a[i + 1] - l) * s)); a[i + 2] = Math.max(0, Math.min(255, l + (a[i + 2] - l) * s)); }
      x.putImageData(d, 0, 0); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.flipY = tex.flipY; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.minFilter = tex.minFilter; t.magFilter = st.pixel ? T.NearestFilter : tex.magFilter; return t;
    } catch (e) { return tex; }
  }
  /* ---------- MToon（动漫赛璐璐）材质：宠物、家园家具和 VRoid 角色共用 ---------- */
  // 阴影色：同色相、偏冷偏紫、压暗（动漫里的阴影不是变黑而是变「冷」）
  function shadeOf(c) { const hsl = {}; c.getHSL(hsl); const s = new T.Color().setHSL((hsl.h + .965) % 1, Math.min(1, hsl.s * 1.08 + .06), hsl.l * .62); return s.lerp(new T.Color(.30, .24, .42), .22); }
  A.mtoon = function (color, o) {
    T = window.THREE; o = o || {};
    const c = color && color.isColor ? color.clone() : new T.Color(color != null ? color : 0xffffff);
    const MT = window.THREE_VRM && THREE_VRM.MToonMaterial;
    if (!MT) return new T.MeshToonMaterial({ color: c, map: o.map || null, gradientMap: gradTex(3) });
    const m = new MT({
      color: c, map: o.map || null, shadeColorFactor: o.shade ? new T.Color(o.shade) : shadeOf(c), shadeMultiplyTexture: o.map || null,
      shadingShiftFactor: o.shift != null ? o.shift : -.08, shadingToonyFactor: o.toony != null ? o.toony : .86, giEqualizationFactor: .85,
      parametricRimColorFactor: new T.Color(o.rim != null ? o.rim : 0x6a5a80), parametricRimFresnelPowerFactor: 3.6, parametricRimLiftFactor: .02, rimLightingMixFactor: .55,
      emissive: o.emissive != null ? new T.Color(o.emissive) : new T.Color(0, 0, 0), emissiveIntensity: o.emissiveIntensity != null ? o.emissiveIntensity : 1,
      transparent: !!o.transparent, side: o.side != null ? o.side : T.FrontSide,
    });
    if (o.alphaTest) m.alphaTest = o.alphaTest; if (o.opacity != null) m.opacity = o.opacity;
    m.ignoreVertexColor = !o.vertexColors;
    m.userData.mtoon = true;
    return m;
  };
  // 描边颜色：取材质主色压暗（暖棕 / 深紫），不用纯黑，和 VRoid 的描边一致
  function inkOf(c) { const hsl = {}; c.getHSL(hsl); return new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * .7 + .1), Math.min(.16, hsl.l * .35 + .04)).getHex(); }
  // 宠物眼睛加高光（动漫眼的灵魂）：找到「Eye_Black / Pupil」网格，按左右两团各贴一颗白色小高光，跟着头骨动
  // 动漫眼贴图：竖椭圆虹膜（上深下亮的渐变）+ 瞳孔 + 两颗高光 + 上眼线
  const eyeTexC = {};
  function animeEyeTex(hue) {
    const k = Math.round(hue * 24); if (eyeTexC[k]) return eyeTexC[k];
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), h0 = k / 24 * 360;
    x.save(); x.beginPath(); x.ellipse(64, 66, 40, 52, 0, 0, 7); x.clip();
    const g = x.createLinearGradient(0, 14, 0, 118); g.addColorStop(0, 'hsl(' + h0 + ',45%,10%)'); g.addColorStop(.45, 'hsl(' + h0 + ',70%,26%)'); g.addColorStop(1, 'hsl(' + (h0 + 20) + ',85%,62%)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'hsla(' + h0 + ',60%,6%,.9)'; x.beginPath(); x.ellipse(64, 62, 17, 25, 0, 0, 7); x.fill();
    x.strokeStyle = 'hsla(' + (h0 + 30) + ',90%,75%,.55)'; x.lineWidth = 3; x.beginPath(); x.ellipse(64, 84, 26, 22, 0, .25, Math.PI - .25); x.stroke();
    x.restore();
    x.lineWidth = 5; x.strokeStyle = 'hsl(' + h0 + ',40%,8%)'; x.beginPath(); x.ellipse(64, 66, 40, 52, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(48, 42, 14, 17, -.4, 0, 7); x.fill(); x.beginPath(); x.ellipse(82, 92, 6, 7, 0, 0, 7); x.fill();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return (eyeTexC[k] = t);
  }
  // 骨骼蒙皮网格在当前姿态下的顶点世界坐标 + 绑定最多的骨骼
  function meshPts(o) {
    const pos = o.geometry.attributes.position, si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, votes = {}, pts = [], v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); if (o.isSkinnedMesh) o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); pts.push(v.clone());
      if (si) for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > .3) { const b = si.getComponent(i, k); votes[b] = (votes[b] || 0) + w; } }
    }
    const bi = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
    return { pts, bone: o.isSkinnedMesh && bi != null ? o.skeleton.bones[+bi] : o };
  }
  const split2 = pts => { const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length; return [pts.filter(p => p.x < cx), pts.filter(p => p.x >= cx)].filter(g => g.length > 2); };
  function addCatchlights(root, hue) {
    const pupils = [], whites = [];
    root.traverse(o => { if (!o.isMesh || o.userData.isOutline) return; const n = [].concat(o.material).map(m => m.name || '').join(' '); if (/eye.?black|pupil/i.test(n)) pupils.push(o); else if (/eye.?white/i.test(n)) whites.push(o); });
    if (!pupils.length && !whites.length) return;
    root.updateMatrixWorld(true);
    // 卡通怪兽：大眼白 + 细缝瞳孔 → 换成整颗动漫眼（虹膜贴在眼白正前方）
    if (whites.length) {
      const W = whites.map(meshPts), pts = W.flatMap(w => w.pts), bone = W[0].bone, groups = split2(pts);
      const mid = new T.Box3().setFromPoints(pts).getCenter(new T.Vector3());
      const tex = animeEyeTex(hue != null ? hue : .58);
      groups.forEach(g => {
        const b = new T.Box3().setFromPoints(g), c = b.getCenter(new T.Vector3()), s = b.getSize(new T.Vector3()), r = Math.max(s.x, s.y) / 2;
        if (r <= 1e-4) return;
        const dir = new T.Vector3((c.x - mid.x) / Math.max(r, 1e-4) * .3, .04, 1).normalize();
        const front = g.reduce((a, p) => Math.max(a, p.clone().sub(c).dot(dir)), 0);
        const m = new T.Mesh(new T.CircleGeometry(r * .8, 24), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false }));
        m.scale.set(.86, 1.04, 1); m.position.copy(c).addScaledVector(dir, front + r * .02); m.lookAt(m.position.clone().add(dir));
        m.userData.isOutline = true; m.renderOrder = 2; root.attach(m); bone.attach(m);
      });
      pupils.forEach(o => { o.visible = false; if (o.userData.ol) o.userData.ol.visible = false; });
      return;
    }
    // 写实小动物：黑眼珠上点两颗高光
    const P0 = pupils.map(meshPts), pts = P0.flatMap(p => p.pts), bone = P0[0].bone;
    if (pts.length < 4) return;
    const mid = new T.Box3().setFromPoints(pts).getCenter(new T.Vector3());
    const mat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    split2(pts).forEach(g => {
      const b = new T.Box3().setFromPoints(g), c = b.getCenter(new T.Vector3()), s = b.getSize(new T.Vector3()), r = Math.max(s.x, s.y, s.z) * .5;
      if (r <= 1e-4) return;
      const dir = new T.Vector3(c.x - mid.x, 0, 0).normalize().multiplyScalar(.8).add(new T.Vector3(0, .1, .6)).normalize();
      const front = g.reduce((a, p) => Math.max(a, p.clone().sub(c).dot(dir)), 0);
      const up = new T.Vector3(0, 1, 0), side = new T.Vector3().crossVectors(up, dir).normalize();
      [[.3, .32, .3], [-.25, -.3, .14]].forEach(([dx, dy, k]) => {
        const sp = new T.Mesh(new T.SphereGeometry(r * k, 10, 8), mat); sp.userData.isOutline = true; sp.castShadow = false;
        sp.position.copy(c).addScaledVector(dir, front).addScaledVector(side, dx * r).addScaledVector(up, dy * r); root.attach(sp); bone.attach(sp);
      });
    });
  }
  function stylize(root, styleName) {
    T = window.THREE;
    const st = STYLE[styleName] || STYLE.kid; const meshes = [];
    root.traverse(o => { if (o.isMesh && !o.userData.isOutline && !o.userData.keep) meshes.push(o); });
    const texCache = new Map();
    meshes.forEach(o => {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const nm = mats.map(src => {
        let map = src.map || null; if (map) { if (!texCache.has(map)) texCache.set(map, desatTex(map, st)); map = texCache.get(map); }
        const color = tint(src.color || new T.Color(1, 1, 1), st);
        let m;
        if (st.m === 'mtoon') {
          // 低多边形模型原色偏灰：提亮一点；眼白直接用白色
          if (st.lift) color.multiplyScalar(st.lift);
          if (/eye.?white/i.test(src.name || '')) color.setRGB(.96, .96, 1);
          m = A.mtoon(color, { map, transparent: !!src.transparent, side: src.side, alphaTest: src.alphaTest, vertexColors: !!src.vertexColors, emissive: src.emissive && src.emissive.getHex() ? src.emissive : null, emissiveIntensity: src.emissiveIntensity, shift: st.shift, toony: st.toony, rim: st.rimc });
          m.userData.ink = inkOf(map ? new T.Color(.55, .42, .4) : color);
          m.name = src.name;
        }
        else if (st.m === 'pbr') m = new T.MeshStandardMaterial({ map, color, roughness: Math.min(.75, src.roughness != null ? src.roughness : .6), metalness: Math.min(.3, src.metalness || 0), emissive: src.emissive ? src.emissive.clone() : 0, emissiveMap: src.emissiveMap || null });
        else if (st.m === 'clay') m = new T.MeshStandardMaterial({ map, color, roughness: 1, metalness: 0 });
        else m = new T.MeshToonMaterial({ map, color, gradientMap: gradTex(st.steps || 3) });
        if (st.m !== 'mtoon') { m.transparent = !!src.transparent; m.opacity = src.opacity != null ? src.opacity : 1; m.alphaTest = src.alphaTest || 0; m.side = src.side; m.vertexColors = !!src.vertexColors; }
        if (st.rim) addRim(m, st.rim[0], st.rim[1]);
        return m;
      });
      o.material = Array.isArray(o.material) ? nm : nm[0];
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      // 动漫风：用平滑法线着色，去掉低多边形的硬折面（只对角色 / 宠物，家具保持硬边）
      if (st.smooth && o.isSkinnedMesh) { const g0 = o.geometry; smoothNormals(g0); if (!g0.userData.sm) { const g = g0.clone(); g.setAttribute('normal', g0.attributes.smoothNormal.clone()); g0.userData.sm = g; } o.geometry = g0.userData.sm; }
      if (st.ol && !o.userData.noOl) {
        smoothNormals(o.geometry);
        if (st.m === 'mtoon') { const om = outlineMat(nm[0].userData.ink, st.ol); const ol = o.isSkinnedMesh ? new T.SkinnedMesh(o.geometry, om) : new T.Mesh(o.geometry, om); if (o.isSkinnedMesh) ol.bind(o.skeleton, o.bindMatrix); ol.userData.isOutline = true; ol.frustumCulled = false; ol.castShadow = false; ol.renderOrder = -1; o.userData.ol = ol; if (o.parent) { ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale); o.parent.add(ol); } else o.add(ol); return; }
        const add = (color, px) => {
          const om = outlineMat(color, px);
          const ol = o.isSkinnedMesh ? new T.SkinnedMesh(o.geometry, om) : new T.Mesh(o.geometry, om);
          if (o.isSkinnedMesh) ol.bind(o.skeleton, o.bindMatrix);
          ol.userData.isOutline = true; ol.frustumCulled = false; ol.castShadow = false; ol.renderOrder = -1;
          if (o.parent) { ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale); o.parent.add(ol); } else o.add(ol);
        };
        add(st.olc, st.ol); if (st.ol2) add(0x2b3a67, st.ol + st.ol2);
      }
    });
    if (st.eyes) try { addCatchlights(root, root.userData.eyeHue); } catch (e) { console.warn('catchlight', e); }
    root.userData.style = styleName;
  }
  A.stylize = stylize;
  A.lightsFor = function (scene, styleName, strength) {
    T = window.THREE;
    const st = STYLE[styleName] || STYLE.kid, k = (st.light || 1) * (strength || 1), g = new T.Group();
    if (styleName === 'p5' || styleName === 'shadow') { g.add(new T.HemisphereLight(0xfff2ea, st.shadow || 0x200008, 1.5 * k)); const d = new T.DirectionalLight(0xffffff, 2.3 * k); d.position.set(2, 4, 3); g.add(d); const b = new T.DirectionalLight(0xff3040, 1.6 * k); b.position.set(-3, 2, -2); g.add(b); }
    else if (styleName === 'p3') { g.add(new T.HemisphereLight(0xcfe8ff, st.shadow, 1.5 * k)); const d = new T.DirectionalLight(0xffffff, 2.2 * k); d.position.set(2, 4, 3); g.add(d); const b = new T.DirectionalLight(0x5ad2ff, 1.4 * k); b.position.set(-3, 2, -2); g.add(b); }
    else if (styleName === 'anime') { g.add(new T.HemisphereLight(0xfff6f0, 0xbcb2dc, 1.25 * k)); const d = new T.DirectionalLight(0xfff4ea, 2.4 * k); d.position.set(2, 4, 3); g.add(d); const b = new T.DirectionalLight(0xc8d6ff, .9 * k); b.position.set(-3, 2, -2); g.add(b); }
    else if (styleName === 'neon') { g.add(new T.HemisphereLight(0x6040ff, 0x100020, 1.1)); const d = new T.DirectionalLight(0xff60e0, 1.6); d.position.set(3, 3, 2); g.add(d); const b = new T.DirectionalLight(0x00f0ff, 2); b.position.set(-3, 2, -1); g.add(b); }
    else if (st.m === 'pbr') { g.add(new T.HemisphereLight(0xdfe6ff, 0x302840, 1.3 * k)); const d = new T.DirectionalLight(0xffe2c8, 2.6 * k); d.position.set(2, 4, 3); g.add(d); const b = new T.DirectionalLight(0x8fa8ff, 1.2); b.position.set(-3, 2, -2); g.add(b); }
    else { g.add(new T.HemisphereLight(0xffffff, 0xb8c4e0, 1.6 * k)); const d = new T.DirectionalLight(0xffffff, 2.0 * k); d.position.set(2, 4, 3); g.add(d); }
    g.children.forEach(l => { if (l.isDirectionalLight) { l.castShadow = false; } });
    scene.add(g); return g;
  };

  /* ---------- 实例 ---------- */
  // opts: { height: 世界高度, style, face: 朝向弧度 }
  /* ---------- VRM 动漫角色（VRoid）：MToon 赛璐璐材质，动作从 Quaternius 骨架重定向 ---------- */
  const isVRM = k => !!(window.CHAR_INDEX && CHAR_INDEX[k] && CHAR_INDEX[k].vrm);
  const vrmBytes = {};
  function vrmParse(k) {
    return (vrmBytes[k] ? Promise.resolve() : loadRaw(k).then(() => { const b = atob(raw[k]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); vrmBytes[k] = u.buffer; delete raw[k]; }))
      .then(() => new Promise((res, rej) => { const L = new T.GLTFLoader(); L.register(p => new THREE_VRM.VRMLoaderPlugin(p)); L.parse(vrmBytes[k].slice(0), '', g => res(g.userData.vrm), rej); }));
  }
  // 动作来源：① Ready Player Me 动捕动作包（anim_f / anim_m，站立、走、跑、跳、跳舞、表情动作）
  //          ② Quaternius 骨架（kid_boy1：出拳、踢、受击、倒地、拿东西）③ 少量程序动作（坐下）
  const Q_MAP = { hips: 'Hips', spine: 'Abdomen', chest: 'Torso', upperChest: 'Chest', neck: 'Neck', head: 'Head',
    leftShoulder: 'ShoulderL', leftUpperArm: 'UpperArmL', leftLowerArm: 'LowerArmL', leftHand: 'WristL',
    rightShoulder: 'ShoulderR', rightUpperArm: 'UpperArmR', rightLowerArm: 'LowerArmR', rightHand: 'WristR',
    leftUpperLeg: 'UpperLegL', leftLowerLeg: 'LowerLegL', leftFoot: 'FootL', rightUpperLeg: 'UpperLegR', rightLowerLeg: 'LowerLegR', rightFoot: 'FootR' };
  const R_MAP = (() => {
    const m = { hips: 'Hips', spine: 'Spine', chest: 'Spine1', upperChest: 'Spine2', neck: 'Neck', head: 'Head' };
    [['left', 'Left'], ['right', 'Right']].forEach(([v, r]) => {
      Object.assign(m, { [v + 'Shoulder']: r + 'Shoulder', [v + 'UpperArm']: r + 'Arm', [v + 'LowerArm']: r + 'ForeArm', [v + 'Hand']: r + 'Hand',
        [v + 'UpperLeg']: r + 'UpLeg', [v + 'LowerLeg']: r + 'Leg', [v + 'Foot']: r + 'Foot', [v + 'Toes']: r + 'ToeBase',
        [v + 'ThumbMetacarpal']: r + 'HandThumb1', [v + 'ThumbProximal']: r + 'HandThumb2', [v + 'ThumbDistal']: r + 'HandThumb3' });
      [['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Little', 'Pinky']].forEach(([a, b]) => {
        m[v + a + 'Proximal'] = r + 'Hand' + b + '1'; m[v + a + 'Intermediate'] = r + 'Hand' + b + '2'; m[v + a + 'Distal'] = r + 'Hand' + b + '3';
      });
    });
    return m;
  })();
  // 用来求骨骼朝向的子骨骼（对齐两边静止姿态的细微差异）
  const BCHILD = (() => {
    const c = { hips: 'spine', spine: 'chest', chest: 'upperChest', upperChest: 'neck', neck: 'head' };
    ['left', 'right'].forEach(v => {
      Object.assign(c, { [v + 'Shoulder']: v + 'UpperArm', [v + 'UpperArm']: v + 'LowerArm', [v + 'LowerArm']: v + 'Hand', [v + 'Hand']: v + 'MiddleProximal',
        [v + 'UpperLeg']: v + 'LowerLeg', [v + 'LowerLeg']: v + 'Foot', [v + 'Foot']: v + 'Toes', [v + 'ThumbMetacarpal']: v + 'ThumbProximal', [v + 'ThumbProximal']: v + 'ThumbDistal' });
      ['Index', 'Middle', 'Ring', 'Little'].forEach(f => { c[v + f + 'Proximal'] = v + f + 'Intermediate'; c[v + f + 'Intermediate'] = v + f + 'Distal'; });
    });
    return c;
  })();
  const BPARENT = {}; Object.entries(BCHILD).forEach(([p, ch]) => { if (!BPARENT[ch]) BPARENT[ch] = p; });
  const ORDER = Object.keys(R_MAP); // 父 → 子
  const Q_CLIPS = { attack: 'Punch_Right', kick: 'Kick_Right', slash: 'Sword_Slash', hit: 'HitRecieve', die: 'Death', eat: 'Interact' };
  // 动作包里的表情动作 → 规范名（挑过的）
  const R_ALIAS = { wave: 'wave', yes: 'yes', no: 'no', cheer: 'cheer', think: 'think', clap: 'clap' };
  const vrmClips = {};
  function bakeVRM(key, vrm) {
    if (vrmClips[key]) return vrmClips[key];
    const gender = (CHAR_INDEX[key] && CHAR_INDEX[key].g) || 'f';
    return (vrmClips[key] = Promise.all([A.load('anim_' + gender).catch(() => null), A.load('kid_boy1').catch(() => null)]).then(([gR, gQ]) => {
      const H = vrm.humanoid, nodeOf = n => H.getNormalizedBoneNode(n);
      const wq = o => o.getWorldQuaternion(new T.Quaternion()), wp = o => o.getWorldPosition(new T.Vector3());
      vrm.scene.updateMatrixWorld(true);
      const tNames = ORDER.filter(n => nodeOf(n)), tRest = {};
      tNames.forEach(n => tRest[n] = wq(nodeOf(n)));
      const hipsT = nodeOf('hips'), hipsRest = hipsT.position.clone(), tHip0 = wp(hipsT);
      hipsT.parent.updateMatrixWorld(true);
      const toLocal = new T.Matrix4().extractRotation(new T.Matrix4().copy(hipsT.parent.matrixWorld).invert());
      const clips = {}, FPS = 30;
      const bake = (name, dur, poseAt, loop) => {
        const n = Math.max(2, Math.round(dur * FPS) + 1), times = new Float32Array(n), qs = {}, ps = new Float32Array(n * 3);
        tNames.forEach(b => qs[b] = new Float32Array(n * 4));
        const hipsArr = [];
        for (let i = 0; i < n; i++) {
          const t = Math.min(dur, i / FPS); times[i] = t; const pose = poseAt(t);
          tNames.forEach(b => {
            const node = nodeOf(b); node.parent.updateWorldMatrix(true, false);
            const local = wq(node.parent).invert().multiply(pose.q[b] || tRest[b]); node.quaternion.copy(local); node.updateMatrixWorld();
            local.toArray(qs[b], i * 4);
          });
          hipsArr.push((pose.hip || new T.Vector3()).clone());
        }
        // 去掉整体位移（原地动作）：水平方向按首尾线性去漂移；循环动作的高度也首尾对齐
        const h0 = hipsArr[0].clone(), h1 = hipsArr[n - 1].clone();
        hipsArr.forEach((d, i) => { const k = i / (n - 1); d.x -= h0.x + (h1.x - h0.x) * k; d.z -= h0.z + (h1.z - h0.z) * k; d.applyMatrix4(toLocal); hipsRest.clone().add(d).toArray(ps, i * 3); });
        tNames.forEach(b => nodeOf(b).quaternion.identity()); hipsT.position.copy(hipsRest);
        const tracks = tNames.map(b => new T.QuaternionKeyframeTrack(nodeOf(b).name + '.quaternion', times, qs[b]));
        tracks.push(new T.VectorKeyframeTrack(hipsT.name + '.position', times, ps));
        clips[name] = new T.AnimationClip(name, dur, tracks);
      };
      // 从任一骨架烘焙：目标世界旋转 = 源世界旋转 × 源静止⁻¹ × 朝向修正 × 目标静止
      const retarget = (g, map, list) => {
        if (!g) return;
        const src = THREE.SkeletonUtils.clone(g.scene); src.updateMatrixWorld(true);
        const sb = {}; src.traverse(o => { sb[o.name.replace(/[^A-Za-z0-9_]/g, '')] = o; });
        const names = tNames.filter(n => map[n] && sb[map[n]]), sRestInv = {}, C = {};
        names.forEach(n => {
          sRestInv[n] = wq(sb[map[n]]).invert(); C[n] = new T.Quaternion();
          const ch = BCHILD[n];
          if (ch && names.includes(ch)) { const dt = wp(nodeOf(ch)).sub(wp(nodeOf(n))), ds = wp(sb[map[ch]]).sub(wp(sb[map[n]])); if (dt.lengthSq() > 1e-8 && ds.lengthSq() > 1e-8) C[n].setFromUnitVectors(dt.normalize(), ds.normalize()); }
          else if (BPARENT[n] && C[BPARENT[n]]) C[n].copy(C[BPARENT[n]]);
        });
        const hipsS = sb[map.hips], sHip0 = wp(hipsS), k = tHip0.y / Math.max(.01, sHip0.y);
        const mixer = new T.AnimationMixer(src);
        Object.entries(list).forEach(([nm, cn]) => {
          const clip = g.animations.find(a => a.name === cn || a.name.endsWith('|' + cn)); if (!clip) return;
          mixer.stopAllAction(); const act = mixer.clipAction(clip); act.setLoop(T.LoopOnce, 1); act.clampWhenFinished = true; act.reset().play();
          bake(nm, clip.duration, t => {
            mixer.setTime(Math.min(t, clip.duration - 1e-4)); src.updateMatrixWorld(true);
            const q = {}; names.forEach(b => { q[b] = wq(sb[map[b]]).multiply(sRestInv[b]).multiply(C[b]).multiply(tRest[b]); });
            return { q, hip: wp(hipsS).sub(sHip0).multiplyScalar(k) };
          });
          act.stop();
        });
      };
      if (gR) { const list = {}; gR.animations.forEach(a => list[a.name] = a.name); retarget(gR, R_MAP, list); }
      // 动捕表情前后有较长的站立，裁掉只留动作本身（帧号按 30fps）
      const TRIM = { wave: [55, 160], bow: [20, 120] };
      Object.entries(TRIM).forEach(([n, [a, b]]) => { const c = clips[n]; if (c && c.duration * FPS > b) clips[n] = T.AnimationUtils.subclip(c, n, a, b, FPS); });
      if (gQ) { const list = {}; Object.entries(Q_CLIPS).forEach(([n, c]) => { if (!clips[n]) list[n] = c; }); if (!clips.idle) Object.assign(list, { idle: 'Idle', walk: 'Walk', run: 'Run', wave: 'Wave' }); retarget(gQ, Q_MAP, list); }
      // 程序动作：坐下（世界空间增量 × 静止姿态，角色朝 +Z、左手 +X）
      const Q = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z, 'XYZ'));
      const CHAIN = { leftLowerArm: 'leftUpperArm', leftHand: 'leftLowerArm', rightLowerArm: 'rightUpperArm', rightHand: 'rightLowerArm', leftLowerLeg: 'leftUpperLeg', leftFoot: 'leftLowerLeg', rightLowerLeg: 'rightUpperLeg', rightFoot: 'rightLowerLeg', leftToes: 'leftFoot', rightToes: 'rightFoot' };
      const proc = (name, dur, f) => bake(name, dur, t => { const o = f(t / dur), dq = Object.assign({}, o.q); Object.keys(CHAIN).forEach(b => { if (!dq[b] && dq[CHAIN[b]]) dq[b] = dq[CHAIN[b]]; }); const q = {}; tNames.forEach(b => { q[b] = (dq[b] || new T.Quaternion()).clone().multiply(tRest[b]); }); return { q, hip: o.hip }; });
      const hipH = tHip0.y;
      if (!clips.sit) proc('sit', 2.0, p => ({ hip: new T.Vector3(0, -hipH * .44, -hipH * .1), q: { spine: Q(.08, 0, 0), leftUpperLeg: Q(-1.45, -.12, 0), rightUpperLeg: Q(-1.45, .12, 0), leftLowerLeg: Q(-.05, 0, 0), rightLowerLeg: Q(-.05, 0, 0), leftUpperArm: Q(-.35, 0, -1.3), rightUpperArm: Q(-.35, 0, 1.3), leftLowerArm: Q(-.9, 0, -1.3), rightLowerArm: Q(-.9, 0, 1.3), head: Q(.08 + Math.sin(p * Math.PI * 2) * .03, Math.sin(p * Math.PI * 2) * .08, 0) } }));
      // 用「静止方向 → 目标方向」写姿势更直观：手臂静止朝 ±X（T 姿势），腿朝 -Y，脊柱朝 +Y；角色面朝 +Z
      const V = (x, y, z) => new T.Vector3(x, y, z).normalize(), Dq = (from, to) => new T.Quaternion().setFromUnitVectors(from, to);
      const LX = V(1, 0, 0), RX = V(-1, 0, 0);
      const arms = (lu, ll, extra) => Object.assign({ leftUpperArm: Dq(LX, V(...lu)), rightUpperArm: Dq(RX, V(-lu[0], lu[1], lu[2])), leftLowerArm: Dq(LX, V(...ll)), rightLowerArm: Dq(RX, V(-ll[0], ll[1], ll[2])) }, extra || {});
      const sitLegs = { leftUpperLeg: Q(-1.45, -.06, 0), rightUpperLeg: Q(-1.45, .06, 0), leftLowerLeg: Q(-.08, 0, 0), rightLowerLeg: Q(-.08, 0, 0) };
      const sitHip = () => new T.Vector3(0, -hipH * .44, -hipH * .1);
      // 躺下：配合外层 rotation.x = -π/2 使用；手放身体两侧、头微微抬起（枕头），胸口轻轻起伏
      if (!clips.lie) proc('lie', 4, p => { const b = Math.sin(p * Math.PI * 2); return { q: arms([.22, -1, -.06], [.16, -1, .1], { chest: Q(-.02 + b * .025, 0, 0), head: Q(.16, .22, 0), leftUpperLeg: Q(0, 0, -.04), rightUpperLeg: Q(0, 0, .04), leftFoot: Q(-.25, 0, -.15), rightFoot: Q(-.25, 0, .15) }) }; });
      // 坐在书桌前打字：前倾、双手搭在桌面、手指交替敲
      if (!clips.sitwork) proc('sitwork', 1.6, p => { const a = Math.sin(p * Math.PI * 8), b = Math.sin(p * Math.PI * 8 + 1.6); return { hip: sitHip(), q: Object.assign(arms([.1, -.5, .86], [-.32, .1, .94], { spine: Q(.2, 0, 0), chest: Q(.22, 0, 0), head: Q(.2, Math.sin(p * Math.PI * 2) * .06, 0) }), sitLegs, { leftHand: Dq(LX, V(-.2, -.3 + a * .14, .93)), rightHand: Dq(RX, V(.2, -.3 + b * .14, .93)) }) }; });
      // 站着捧书读：双手在胸前合拢，低头
      if (!clips.read) proc('read', 3, p => ({ q: arms([.06, -.86, .5], [-.5, .32, .8], { head: Q(.38, Math.sin(p * Math.PI * 2) * .1, 0), chest: Q(.06, 0, 0) }) }));
      // 坐着发呆（沙发 / 床边）：手放膝盖
      if (!clips.sitrest) proc('sitrest', 3, p => ({ hip: sitHip(), q: Object.assign(arms([.16, -.9, .4], [.08, -.4, .91], { spine: Q(-.06 + Math.sin(p * Math.PI * 2) * .015, 0, 0), head: Q(.04, Math.sin(p * Math.PI * 2) * .12, 0) }), sitLegs) }));
      if (!clips.no) proc('no', 1.2, p => ({ q: { head: Q(0, Math.sin(p * Math.PI * 4) * .4 * (1 - p), 0), leftUpperArm: Q(0, 0, -1.3), rightUpperArm: Q(0, 0, 1.3) } }));
      return clips;
    }));
  }
  function makeVRM(key, opts) {
    return vrmParse(key).then(vrm => {
      THREE_VRM.VRMUtils.rotateVRM0(vrm); // VRM0 默认朝 -Z，转成和其他模型一样朝 +Z
      THREE_VRM.VRMUtils.removeUnnecessaryVertices && THREE_VRM.VRMUtils.removeUnnecessaryVertices(vrm.scene);
      return bakeVRM(key, vrm).then(clips => {
        const o = vrm.scene; o.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(o), d = box.getSize(new T.Vector3());
        const k = (opts.height || 1) / (d.y || 1);
        o.scale.multiplyScalar(k); o.position.y = -box.min.y * k;
        const wrap = new T.Group(); wrap.add(o); wrap.userData.key = key; wrap.userData.h = d.y * k; wrap.vrm = vrm;
        // 缩放后要重新记录弹簧骨骼（头发、裙摆）的初始状态，不然第一帧会被甩飞
        wrap.updateMatrixWorld(true); const sbm = vrm.springBoneManager; if (sbm) { sbm.setInitState && sbm.setInitState(); sbm.reset && sbm.reset(); }
        o.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; } });
        // 帽子 / 魔法杖挂在原始骨骼上
        if (opts.hat || opts.wand) {
          const Hh = opts.height || 1, head = vrm.humanoid.getRawBoneNode('head'), hand = vrm.humanoid.getRawBoneNode('rightHand'); o.updateMatrixWorld(true);
          const stick = (bone, ch, sz, dy, dz) => { if (!bone || !ch) return; const sp = new T.Sprite(new T.SpriteMaterial({ map: A.emojiTex(ch), depthTest: true })); const wp = new T.Vector3(); bone.getWorldPosition(wp); wrap.worldToLocal(wp); sp.position.set(wp.x, wp.y + dy * Hh, wp.z + dz * Hh); sp.scale.set(sz * Hh, sz * Hh, 1); wrap.add(sp); bone.attach(sp); };
          stick(head, opts.hat, .26, .14, .01); stick(hand, opts.wand, .18, .02, .05);
        }
        const mixer = new T.AnimationMixer(o);
        wrap.mixer = mixer; wrap.anims = {}; Object.keys(clips).forEach(n => wrap.anims[n] = n); wrap.clipNames = Object.keys(clips);
        ['attack', 'hit', 'die', 'walk', 'run', 'idle'].forEach(n => { if (!clips[n]) wrap.anims[n] = 'idle'; });
        wrap.anims.idle2 = clips.idle2 ? 'idle2' : 'idle';
        wrap.has = n => !!clips[wrap.anims[n] || n];
        wrap.clipDur = n => { const c = clips[wrap.anims[n] || n]; return c ? c.duration : 0; };
        wrap.play = (n, o2) => {
          o2 = o2 || {}; const clip = clips[wrap.anims[n] || n]; if (!clip) return 0;
          const act = mixer.clipAction(clip);
          if (wrap.cur === act && !o2.restart) return clip.duration;
          act.reset(); act.setLoop(o2.once ? T.LoopOnce : T.LoopRepeat, Infinity); act.clampWhenFinished = !!o2.once; act.timeScale = o2.speed || 1;
          if (wrap.cur && wrap.cur !== act) act.crossFadeFrom(wrap.cur, o2.fade != null ? o2.fade : .2, false);
          act.play(); wrap.cur = act; wrap.curName = n;
          const em = vrm.expressionManager; if (em) { em.setValue('happy', /wave|dance|yes|jump|cheer|victory|bow/.test(n) ? .8 : 0); em.setValue('sad', n === 'hit' || n === 'die' ? .6 : 0); }
          return clip.duration / (o2.speed || 1);
        };
        wrap.once = (n, back, speed) => { const dur = wrap.play(n, { once: true, restart: true, speed }); if (!dur) return Promise.resolve(); return new Promise(r => setTimeout(() => { if (wrap.curName === n) wrap.play(back || 'idle'); r(); }, dur * 1000 - 120)); };
        let blinkT = 2 + Math.random() * 2;
        // 截图用：直接跳到某一帧，头发等弹簧骨骼用小步长稳定下来（大步长会甩飞）
        wrap.pose = (n, t) => { mixer.stopAllAction(); wrap.cur = null; wrap.play(n, { fade: 0, restart: true }); mixer.setTime(t || 0); vrm.springBoneManager && vrm.springBoneManager.reset && vrm.springBoneManager.reset(); for (let i = 0; i < 12; i++) vrm.update(1 / 30); };
        let springFresh = true; // 放进场景、摆好位置后的第一帧再把弹簧骨骼归位
        wrap.update = dt => {
          dt = Math.min(dt, 1 / 20); mixer.update(dt);
          if (springFresh && vrm.springBoneManager) { springFresh = false; wrap.updateMatrixWorld(true); vrm.springBoneManager.reset && vrm.springBoneManager.reset(); }
          const em = vrm.expressionManager; if (em) { blinkT -= dt; const b = blinkT < 0 ? Math.max(0, 1 - Math.abs(blinkT + .08) / .08) : 0; em.setValue('blink', b); if (blinkT < -.16) blinkT = 2 + Math.random() * 3; }
          vrm.update(dt);
        };
        wrap.fade = (to, ms) => new Promise(r => { const mats = []; wrap.traverse(x => { if (x.material) [].concat(x.material).forEach(m => { m.transparent = true; mats.push(m); }); }); const t0 = performance.now(), from = mats.length ? mats[0].opacity : 1; const f = () => { const kk = Math.min(1, (performance.now() - t0) / (ms || 500)); mats.forEach(m => m.opacity = from + (to - from) * kk); if (kk < 1) requestAnimationFrame(f); else r(); }; f(); });
        wrap.play('idle'); mixer.update(0); vrm.update(0);
        return wrap;
      });
    });
  }
  A.isVRM = isVRM;

  A.make = function (key, opts) {
    opts = opts || {};
    T = window.THREE;
    if (isVRM(key)) return window.THREE_VRM ? makeVRM(key, opts) : Promise.reject(new Error('three-vrm missing'));
    return A.load(key).then(g => {
      T = window.THREE;
      const o = g.animations.length ? THREE.SkeletonUtils.clone(g.scene) : g.scene.clone(true);
      o.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(o), d = box.getSize(new T.Vector3());
      const meta = Object.assign({}, (window.CHAR_INDEX && CHAR_INDEX[key]) || {}, META[key] || {});
      const k = (opts.height || 1) / (d.y || 1) * (meta.s || 1);
      o.scale.multiplyScalar(k); o.position.y = -box.min.y * k; o.position.x = -(box.min.x + box.max.x) / 2 * k; o.position.z = -(box.min.z + box.max.z) / 2 * k;
      if (meta.ry) o.rotation.y = meta.ry;
      if (meta.fly) o.position.y += meta.fly * (opts.height || 1);
      if (meta.horn) { o.updateMatrixWorld(true); let head = null; o.traverse(b => { if (!head && b.isBone && /^head$/i.test(b.name)) head = b; }); if (!head) o.traverse(b => { if (!head && b.isBone && /head/i.test(b.name)) head = b; }); if (head) { const Hh = opts.height || 1, hp = new T.Vector3(); head.getWorldPosition(hp); const horn = new T.Mesh(new T.ConeGeometry(.035 * Hh, .2 * Hh, 12), new T.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb020, emissiveIntensity: .5, roughness: .3 })); horn.position.set(hp.x + meta.horn[0] * Hh, hp.y + meta.horn[1] * Hh, hp.z + meta.horn[2] * Hh); horn.rotation.x = meta.horn[3] || .6; head.attach(horn); } }
      const wrap = new T.Group(); wrap.add(o); wrap.userData.key = key; wrap.userData.h = d.y * k;
      o.userData.eyeHue = EYE_HUE[key]; stylize(o, opts.style || 'kid');
      // 帽子 / 魔法杖：表情贴图挂到头骨和右手骨上，跟着动作一起动
      if (opts.hat || opts.wand) {
        o.updateMatrixWorld(true); const Hh = opts.height || 1; let head = null, hand = null;
        o.traverse(b => { if (!b.isBone) return; if (!head && /^head$/i.test(b.name)) head = b; if (!hand && /(wrist|palm\d?|hand)\.?_?r$/i.test(b.name)) hand = b; });
        const stick = (bone, ch, sz, dy, dz) => { if (!bone || !ch) return; const sp = new T.Sprite(new T.SpriteMaterial({ map: A.emojiTex(ch), depthTest: true })); const wp = new T.Vector3(); bone.getWorldPosition(wp); sp.position.set(wp.x, wp.y + dy * Hh, wp.z + dz * Hh); sp.scale.set(sz * Hh, sz * Hh, 1); bone.attach(sp); };
        stick(head, opts.hat, .3, .17, .01); stick(hand, opts.wand, .2, .04, .06);
      }
      // 暗影的白色面具 + 发光红眼：贴在头骨上
      if (opts.mask) {
        o.updateMatrixWorld(true); let head = null; o.traverse(b => { if (!head && b.isBone && /^head$/i.test(b.name)) head = b; });
        const Hh = opts.height || 1, sp = new T.Sprite(new T.SpriteMaterial({ map: maskTex(), depthTest: false })); sp.renderOrder = 5;
        const wp = new T.Vector3(); if (head) head.getWorldPosition(wp); else wp.set(0, Hh * .8, 0);
        sp.position.set(wp.x, wp.y + .05 * Hh, wp.z + .18 * Hh); sp.scale.set(.42 * Hh, .3 * Hh, 1);
        if (head) head.attach(sp); else o.add(sp);
      }
      const mixer = new T.AnimationMixer(o); const clips = {}; g.animations.forEach(c => clips[c.name] = c);
      const map = Object.assign(animMap(g.animations), meta.anim || {});
      wrap.mixer = mixer; wrap.anims = map; wrap.clipNames = Object.keys(clips);
      wrap.has = n => !!(map[n] && clips[map[n]]);
      wrap.play = (n, o2) => {
        o2 = o2 || {}; const cn = map[n] || (clips[n] ? n : null); const clip = cn && clips[cn]; if (!clip) return 0;
        const act = mixer.clipAction(clip);
        if (wrap.cur === act && !o2.restart) return clip.duration;
        act.reset(); act.setLoop(o2.once ? T.LoopOnce : T.LoopRepeat, Infinity); act.clampWhenFinished = !!o2.once; act.timeScale = o2.speed || 1;
        if (wrap.cur && wrap.cur !== act) { act.crossFadeFrom(wrap.cur, o2.fade != null ? o2.fade : .2, false); }
        act.play(); wrap.cur = act; wrap.curName = n;
        return clip.duration / (o2.speed || 1);
      };
      // 播一次再回到 loopName
      wrap.once = (n, back, speed) => { const dur = wrap.play(n, { once: true, restart: true, speed }); if (!dur) return Promise.resolve(); return new Promise(r => setTimeout(() => { if (wrap.curName === n) wrap.play(back || 'idle'); r(); }, dur * 1000 - 120)); };
      wrap.update = dt => mixer.update(dt);
      wrap.fade = (to, ms) => new Promise(r => { const mats = []; wrap.traverse(x => { if (x.material) [].concat(x.material).forEach(m => { m.transparent = true; mats.push(m); }); }); const t0 = performance.now(), from = mats.length ? mats[0].opacity : 1; const f = () => { const k = Math.min(1, (performance.now() - t0) / (ms || 500)); mats.forEach(m => m.opacity = from + (to - from) * k); if (k < 1) requestAnimationFrame(f); else r(); }; f(); });
      wrap.play('idle');
      return wrap;
    });
  };

  /* ---------- 立绘截图 ---------- */
  let pr = null; const shotCache = new Map(); let queue = Promise.resolve();
  function shotRenderer() {
    if (pr) return pr;
    const rd = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    rd.setPixelRatio(1); rd.outputColorSpace = T.SRGBColorSpace; rd.toneMapping = T.NoToneMapping;
    return (pr = { rd, cam: new T.PerspectiveCamera(28, 1, .05, 100) });
  }
  // 截图用的实例按 模型+画风+装备 复用（VRM 每次解析较慢），最多留 4 个
  const insts = new Map();
  function inst(key, o) {
    const k = [key, o.style, o.hat || '', o.wand || ''].join('|');
    if (!insts.has(k)) { insts.set(k, A.make(key, o)); if (insts.size > 4) insts.delete(insts.keys().next().value); }
    return insts.get(k).then(av => { av.rotation.set(0, 0, 0); return av; });
  }
  // opts: { pose:'idle', t: 动画时间, size: 像素, style, frame:'full'|'bust'|'head', yaw }
  // 立绘持久缓存（IndexedDB）：第二次打开直接出图，不用再等 3D 渲染
  const SHOT_VER = 'v5';
  let idbP = null;
  function idb() {
    if (idbP) return idbP;
    return (idbP = new Promise(res => { try { const r = indexedDB.open('si-shots', 1); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }));
  }
  const idbGet = k => idb().then(db => db && new Promise(res => { try { const q = db.transaction('s').objectStore('s').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }));
  const idbPut = (k, v) => idb().then(db => { try { db && db.transaction('s', 'readwrite').objectStore('s').put(v, k); } catch (e) {} });
  A.portrait = function (key, opts) {
    opts = opts || {};
    const style = opts.style || 'kid', size = opts.size || 256, frame = opts.frame || 'full', pose = opts.pose || 'idle';
    const ck = [key, style, size, frame, pose, opts.yaw || 0, opts.t || 0, opts.hat || '', opts.wand || ''].join('|');
    if (shotCache.has(ck)) return shotCache.get(ck);
    const p0 = idbGet(SHOT_VER + '|' + ck).then(hit => hit || render().then(u => { if (u) idbPut(SHOT_VER + '|' + ck, u); return u; }));
    shotCache.set(ck, p0); return p0;
    function render() { return queue = queue.then(() => inst(key, { height: 1, style, hat: opts.hat, wand: opts.wand }).then(av => {
      const { rd, cam } = shotRenderer(); const st = STYLE[style] || STYLE.kid;
      const px = st.pixel ? Math.max(48, Math.round(size / st.pixel)) : size;
      rd.setSize(px, px, false); A.setViewport(px, px); outlineU.uOl.value = 2 / px * (st.pixel ? .8 : Math.max(.9, px / 120));
      const sc = new T.Scene(); A.lightsFor(sc, style); sc.add(av);
      av.rotation.y = opts.yaw != null ? opts.yaw : -.35;
      if (av.pose) av.pose(pose, opts.t != null ? opts.t : .35);
      else { av.mixer.stopAllAction(); av.cur = null; av.play(pose, { fade: 0, restart: true }); av.update(opts.t != null ? opts.t : .35); }
      av.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(av), c = box.getCenter(new T.Vector3()), s = box.getSize(new T.Vector3());
      let hgt = s.y, cy = c.y;
      if (frame === 'bust') { hgt = s.y * .52; cy = box.max.y - hgt * .52; }
      // 大头照：按头骨定位（头顶到头骨的距离 ≈ 头的大小），机器人、狐狸这类比例特殊的也能框准
      let head = av.vrm ? av.vrm.humanoid.getRawBoneNode('head') : null;
      if (!head) av.traverse(o => { if (!head && o.isBone && /^head$/i.test(o.name)) head = o; });
      if (!head) av.traverse(o => { if (!head && o.isBone && /head/i.test(o.name)) head = o; });
      let fit, fx = c.x, fz = c.z;
      if (frame === 'head' && head) {
        const hp = head.getWorldPosition(new T.Vector3()), hs = Math.max(.08, box.max.y - hp.y);
        fit = Math.max(hs * 2.1, .2); cy = hp.y + hs * .28; fx = hp.x; fz = hp.z;
      } else {
        if (frame === 'head') { hgt = s.y * .3; cy = box.max.y - hgt * .52; }
        fit = Math.max(hgt, Math.max(s.x, s.z) * (frame === 'full' ? .95 : .7)) * (frame === 'full' ? 1.16 : 1.05);
      }
      const dist = fit / 2 / Math.tan(cam.fov * Math.PI / 360);
      cam.aspect = 1; cam.position.set(fx, cy + fit * .04, fz + dist); cam.lookAt(fx, cy, fz); cam.updateProjectionMatrix();
      if (frame === 'full') { // 按投影后的实际范围再收紧一次
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new T.Vector3();
        for (let i = 0; i < 8; i++) { v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
        const ext = Math.max(x1 - x0, y1 - y0) / 2 * 1.12, cxN = (x0 + x1) / 2, cyN = (y0 + y1) / 2;
        const tan = Math.tan(cam.fov * Math.PI / 360) * dist; const shiftX = cxN * tan, shiftY = cyN * tan;
        const right = new T.Vector3(1, 0, 0), nd = dist * ext; const lookP = new T.Vector3(c.x + shiftX * right.x, cy + shiftY, c.z);
        cam.position.set(lookP.x, lookP.y + fit * .04 * ext, lookP.z + nd); cam.lookAt(lookP); cam.updateProjectionMatrix();
      }
      rd.setClearColor(0x000000, 0); rd.render(sc, cam);
      const url = rd.domElement.toDataURL('image/png');
      sc.remove(av); av.position.set(0, 0, 0);
      return url;
    })).catch(e => { console.warn('portrait', key, e); return null; }); }
  };
  // <img data-av="key" data-style data-pose data-frame data-size>：异步换成 3D 立绘
  A.hydrate = function (root) {
    if (!A.supported() || window.__TEST_LITE) return; // 冒烟测试时不渲染立绘，省 CPU
    (root || document).querySelectorAll('img[data-av]:not([data-avd])').forEach(img => {
      img.dataset.avd = 1; const k = img.dataset.av; if (!A.has(k)) { img.classList.remove('av-wait'); if (img.dataset.fb && img.src.startsWith('data:image/gif')) img.src = img.dataset.fb; return; }
      A.portrait(k, { hat: img.dataset.hat, wand: img.dataset.wand, style: img.dataset.style || A.styleOf(Core.theme()), pose: img.dataset.pose || 'idle', frame: img.dataset.frame || 'full', size: +img.dataset.size || 256, yaw: img.dataset.yaw != null ? +img.dataset.yaw : undefined })
        .then(u => { if (!img.isConnected) return; img.classList.remove('av-wait'); if (u) { img.src = u; img.classList.add('av3d'); if (/pixel/.test(img.dataset.style || Core.theme())) img.style.imageRendering = 'pixelated'; } else if (img.dataset.fb) img.src = img.dataset.fb; });
    });
  };

  /* ---------- 小舞台：在一个 canvas 里实时播放若干角色（战斗、角色选择等） ---------- */
  A.stage = function (el, opts) {
    T = window.THREE; opts = opts || {};
    const style = opts.style || A.styleOf(Core.theme()), st = STYLE[style] || STYLE.kid;
    const rd = Perf.renderer({ antialias: !st.pixel, alpha: true }, { dpr: st.pixel ? 1 / st.pixel : 2, fixed: !!st.pixel }); rd.outputColorSpace = T.SRGBColorSpace;
    if (st.pixel) rd.domElement.style.imageRendering = 'pixelated';
    rd.domElement.className = 'av-stage'; el.appendChild(rd.domElement);
    const sc = new T.Scene(); A.lightsFor(sc, style);
    const cam = new T.PerspectiveCamera(opts.fov || 30, 1, .05, 100); cam.position.set(0, opts.camY || .9, opts.camZ || 4.2); cam.lookAt(0, opts.lookY || .7, 0);
    const actors = []; let raf = 0, last = performance.now(), dead = false;
    const fit = () => { const r = rd.domElement.getBoundingClientRect(); if (!r.width) return; rd.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); };
    const loop = () => {
      if (dead) return; if (!rd.domElement.isConnected) return api.dispose(); raf = requestAnimationFrame(loop);
      const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
      actors.forEach(a => { a.update(dt); a.tick && a.tick(dt); });
      const r = rd.domElement; A.setViewport(r.width, r.height); outlineU.uOl.value = 2 / Math.max(1, r.height) * (st.pixel ? .6 : 1) * (opts.olScale || 1);
      rd.render(sc, cam);
    };
    const api = {
      scene: sc, cam, renderer: rd, actors,
      add(key, o) { o = o || {}; return A.make(key, { height: o.height || 1, style: o.style || style, hat: o.hat, wand: o.wand, mask: o.mask }).then(av => { if (dead) return null; av.position.set(o.x || 0, o.y || 0, o.z || 0); av.rotation.y = o.ry || 0; sc.add(av); actors.push(av); return av; }); },
      dispose() { if (dead) return; dead = true; cancelAnimationFrame(raf); removeEventListener('resize', fit); try { rd.dispose(); rd.forceContextLoss(); } catch (e) {} rd.domElement.remove(); },
    };
    addEventListener('resize', fit); fit(); setTimeout(fit, 60); loop();
    Core.onLeave(api.dispose);
    return api;
  };
  // 表情贴图：用系统彩色表情字体画到 canvas（file:// 下图片贴图会被跨域拦截）
  const emoCache = {};
  A.emojiTex = function (ch) {
    T = window.THREE; if (emoCache[ch]) return emoCache[ch];
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.font = '104px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 64, 70);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return (emoCache[ch] = t);
  };
  let maskT = null;
  function maskTex() {
    if (maskT) return maskT; const c = document.createElement('canvas'); c.width = 256; c.height = 180; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 8; x.beginPath(); x.moveTo(10, 60); x.quadraticCurveTo(128, -20, 246, 60); x.quadraticCurveTo(230, 150, 128, 170); x.quadraticCurveTo(26, 150, 10, 60); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#000'; [[80, 1], [176, -1]].forEach(([ex, d]) => { x.beginPath(); x.moveTo(ex - 38 * d, 66); x.lineTo(ex + 34 * d, 52); x.lineTo(ex + 20 * d, 96); x.lineTo(ex - 30 * d, 92); x.closePath(); x.fill(); });
    x.fillStyle = '#ff1030'; x.shadowColor = '#ff0020'; x.shadowBlur = 18; [[80, 1], [176, -1]].forEach(([ex]) => { x.beginPath(); x.arc(ex, 76, 12, 0, 7); x.fill(); });
    x.shadowBlur = 0; x.strokeStyle = '#e60012'; x.lineWidth = 6; x.beginPath(); x.moveTo(128, 20); x.lineTo(128, 50); x.stroke();
    maskT = new T.CanvasTexture(c); maskT.colorSpace = T.SRGBColorSpace; return maskT;
  }
  A.outlineU = outlineU;
  // 记录正在加载 / 解析的模型与立绘，场景切换时等它们全部完成再揭开画面（见 Preload.settle）
  let busyN = 0; const busyW = [];
  const track = f => function () { const p = f.apply(this, arguments); if (p && p.then) { busyN++; const fin = () => { if (--busyN === 0) busyW.splice(0).forEach(r => r()); }; p.then(fin, fin); } return p; };
  A.make = track(A.make); A.portrait = track(A.portrait);
  A.idle = () => busyN === 0 ? Promise.resolve() : new Promise(r => busyW.push(r));
  A._busy = () => busyN;
  window.Avatar3D = A;
})();
