/* 暗影战（回合制 · 怪盗风）
   · 我方：主角 + 队长宠物 + 最多 2 只同行宠物（出门前在「队伍」里选）；敌方：1-3 只戴面具的暗影（就是还没被收服的宠物）
   · 主角：攻击 / 枪击 / 技能（答对题目才能放出魔法）/ 防御 / 道具 / 逃跑
   · 宠物：每只都有自己的技能组 —— 属性魔法、物理技（消耗 HP）、辅助（治疗 / 加攻 / 加防 / 减攻）、群体魔法、专属绝招
     可以手动指挥，也可以打开 AUTO 让它们自己判断
   · 打中弱点 / 暴击 → 敌人倒地，「再动一次」，还可以「接力」给伙伴（伤害提升）
   · 敌人也会放属性魔法：打中伙伴的弱点会让伙伴倒地
   · 敌人全部倒地 → 包围！总攻击，或者交涉：答对题目就能把暗影收为宠物
   · 键盘：A 攻击 G 枪击 S 技能 D 防御 I 道具 R 逃跑，数字键选目标和答案 */
(function () {
  const { h, sleep, esc, Store, Audio2, Voice, E, hydrate, UI } = Core;
  const R = CONTENT.R;
  const P = () => Store.p, save = () => Store.save();
  const ELEM = [
    { k: 'fire', n: '火焰', e: '🔥', c: '#ff5a1f', sk: '烈焰冲击', ma: '烈焰风暴' }, { k: 'ice', n: '冰霜', e: '❄️', c: '#6fd8ff', sk: '寒冰之枪', ma: '冰河世纪' },
    { k: 'elec', n: '雷电', e: '⚡', c: '#ffe23f', sk: '落雷', ma: '雷霆万钧' }, { k: 'wind', n: '疾风', e: '🌪️', c: '#7dff9a', sk: '旋风刃', ma: '狂风乱舞' }, { k: 'light', n: '光明', e: '✨', c: '#fff3a0', sk: '圣光', ma: '圣光普照' },
  ];
  const PHYS = { k: 'phys', n: '物理', e: '👊', c: '#ffffff' }, GUN = { k: 'gun', n: '枪击', e: '🔫', c: '#d0d0d0' };
  const hash = s => Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const elemOf = id => ELEM[hash(id) % ELEM.length];
  const weakOf = id => { const o = elemOf(id); let w = ELEM[(hash(id) >>> 5) % ELEM.length]; if (w === o) w = ELEM[(ELEM.indexOf(o) + 2) % ELEM.length]; return w; };
  const SP_COST = 6, BULLETS = 3;
  const PHYS_N = ['猛烈冲撞', '连环踢', '飞扑', '头槌', '回旋斩', '疾风突刺'];
  const SUP = {
    heal: { id: 'heal', n: '治愈之风', e: '💚', sp: 6, tgt: 'party', kind: 'heal', pow: .3, d: '全队回复 HP' },
    atk: { id: 'atk', n: '战意高扬', e: '🔺', sp: 7, tgt: 'party', kind: 'buff', buf: 'atk', d: '全队攻击提升 3 回合' },
    def: { id: 'def', n: '守护之壁', e: '🛡️', sp: 7, tgt: 'party', kind: 'buff', buf: 'def', d: '全队防御提升 3 回合' },
    deb: { id: 'deb', n: '恐惧之眼', e: '🔻', sp: 7, tgt: 'all', kind: 'debuff', d: '敌人全体攻击下降 3 回合' },
  };

  /* ---------- 宠物技能组 ---------- */
  function skillsOf(kind, lv) {
    const K = Home.dex(kind), el = elemOf(kind), hs = hash(kind), t = K.t; lv = lv || 1;
    const sk = [
      { id: 'basic', n: el.sk, e: el.e, el, pow: 1.3, sp: 4, tgt: 'one', kind: 'atk', d: el.n + '属性 · 单体' },
      { id: 'phys', n: PHYS_N[hs % PHYS_N.length], e: '💥', el: PHYS, pow: 1.6, hp: .08, tgt: 'one', kind: 'atk', melee: true, d: '物理 · 消耗 HP' },
      Object.assign({}, SUP[['heal', 'atk', 'def', 'deb'][(hs >>> 3) % 4]]),
      { id: 'ma', n: el.ma, e: el.e, el, pow: .95, sp: 10, tgt: 'all', kind: 'atk', need: t >= 2 ? 1 : 4, d: el.n + '属性 · 敌全体' },
      { id: 'sig', n: K.sk, e: K.e, el, pow: 2.1 + t * .18, sp: 12, tgt: 'one', kind: 'atk', sig: true, need: t >= 2 ? 1 : 3, d: '专属绝招 · ' + el.n },
    ];
    sk.forEach(s => s.lock = s.need && lv < s.need ? s.need : 0);
    return sk;
  }
  const heroSkills = lv => ELEM.map(el => ({ id: el.k, n: el.sk, e: el.e, el, pow: 1, sp: SP_COST, tgt: 'one', kind: 'atk', quiz: 1, d: el.n + '属性 · 答题' }))
    .concat([{ id: 'hma', n: '万象星爆', e: '🌟', el: null, pow: .9, sp: 14, tgt: 'all', kind: 'atk', quiz: 1, lock: lv < 6 ? 6 : 0, d: '万能 · 敌全体 · 答题' }, { id: 'hheal', n: '星光治愈', e: '💖', sp: 8, tgt: 'party', kind: 'heal', pow: .4, quiz: 1, d: '全队回复 · 答题' }]);

  // 按场景等级抽一组暗影
  function rollEnemies(lv, n) {
    const dist = lv >= 10 ? [10, 25, 35, 22, 8] : lv >= 8 ? [20, 35, 30, 13, 2] : lv >= 5 ? [35, 40, 20, 5, 0] : lv >= 3 ? [55, 35, 10, 0, 0] : [75, 25, 0, 0, 0];
    return Array.from({ length: n }, () => { let r = Math.random() * 100, t = 0; for (let i = 0; i < 5; i++) { r -= dist[i]; if (r < 0) { t = i; break; } } const pool = Home.PETDEX.filter(x => x.t === t && Home.petModel(x.id)); return (R.pick(pool.length ? pool : Home.PETDEX.filter(x => Home.petModel(x.id)))).id; });
  }

  /* ================= 战斗 ================= */
  // opt: { kinds?, lv, adv: 'player'|'enemy'|null, scene, onEnd(res) }
  function start(opt) {
    const p = Home.ensure(), lv = opt.lv || 1, bfx = Bond.fx(), gfx = Home.gearFx(p);
    const kinds = opt.kinds || rollEnemies(lv, p.grade <= 1 ? R.int(1, 2) : R.int(1, 3));
    const heroLv = p.lv || 1;
    const party = [{ id: 'hero', hero: true, n: p.name, mhp: 40 + heroLv * 3 + gfx.heart * 6, msp: 30 + heroLv * 2 + (bfx.sp || 0), atk: 7 + heroLv + gfx.sword * 2, mag: 14 + heroLv * 1.5, model: App.heroModel(p), h: 1.7, skills: heroSkills(heroLv), ammo: BULLETS }];
    if (p.pet) {
      [p.pet.kind].concat(window.Explore ? Explore.party(p) : []).forEach((k, i) => {
        const K = Home.dex(k), po = i === 0 ? p.pet : (p.petStore && p.petStore[k]) || Home.newPetObj(k), plv = po.lv || 1, star = (p.petStars[k] || 1) - 1;
        party.push({ id: 'pet' + i, pet: po, kind: k, n: i === 0 ? p.pet.name : po.name || K.n, lv: plv, mhp: 26 + plv * 3 + K.t * 8 + star * 3, msp: 14 + plv * 2 + K.t * 5, atk: 5 + plv + K.t * 2 + star, mag: (5 + plv + K.t * 2 + star) * 1.45, elem: elemOf(k), weak: weakOf(k), model: Home.petModel(k), h: K.h, skills: skillsOf(k, plv), K });
      });
    }
    party.forEach(m => { m.hp = m.mhp; m.sp = m.msp; m.buf = { atk: 0, def: 0 }; m.guard = false; m.down = false; });
    const foes = kinds.map((k, i) => {
      const K = Home.dex(k), own = elemOf(k); const r = Math.random(); const weak = r < .14 ? PHYS : r < .28 ? GUN : weakOf(k);
      return { i, kind: k, n: K.n + '之影', t: K.t, mhp: Math.round((34 + K.t * 18 + Math.max(lv, heroLv) * 4) * (p.grade <= 1 ? .8 : 1)), atk: 3 + K.t * 2 + Math.ceil(Math.max(lv, heroLv * .6) / 2), weak, resist: own, el: own, down: false, dead: false, knownWeak: !!bfx.scan, deb: 0, model: Home.petModel(k), h: K.h };
    });
    foes.forEach(f => f.hp = f.mhp);
    const B = { party, foes, over: false, turn: 0, opt, lv, auto: !!(p.settings && p.settings.b5auto) };
    App.show('battle5', el => build(el, B));
    Audio2.playMusic('smore');
  }

  const PPOS = [[-1.3, 0, 1.3], [-2.5, 0, .1], [-.1, 0, 2.6], [-3.6, 0, -1.1]], FPOS = [[1.4, 0, -1.5], [2.8, 0, -.3], [.2, 0, -2.8]];
  const CAM0 = { pos: [-4.6, 3, 7.4], look: [.6, .6, -1] };
  function build(el, B) {
    el.classList.add('p3', 'b5');
    el.innerHTML = '<canvas class="b5-bg"></canvas><div class="b5-3d"></div><div class="b5-lab"></div>' +
      '<div class="b5-top"><div class="b5-enc">' + Home.ransom('暗影出现') + '</div><div class="b5-turn"></div></div>' +
      '<button class="b5-auto' + (B.auto ? ' on' : '') + '" data-tip="宠物自动战斗">AUTO</button>' +
      '<div class="b5-skn"></div><div class="b5-party"></div><div class="b5-menu"></div><div class="b5-q"></div><div class="b5-fx"></div>';
    paintBg(el.querySelector('.b5-bg'));
    const T = THREE, A = Avatar3D;
    const stage = A.stage(el.querySelector('.b5-3d'), { style: 'p5', fov: 34, camZ: 6, camY: 2.2, lookY: .8 });
    const cam = stage.cam, camT = { pos: new T.Vector3(...CAM0.pos), look: new T.Vector3(...CAM0.look) };
    cam.position.copy(camT.pos); cam.lookAt(camT.look);
    const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); for (let r = 256; r > 0; r -= 24) { x.fillStyle = (r / 24) % 2 ? '#1a0004' : '#000'; x.beginPath(); x.arc(256, 256, r, 0, 7); x.fill(); } x.strokeStyle = '#e60012'; x.lineWidth = 4; for (let r = 250; r > 40; r -= 48) { x.beginPath(); x.arc(256, 256, r, 0, 7); x.stroke(); } const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
    const ground = new T.Mesh(new T.CircleGeometry(10, 64), new T.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: .95 })); ground.rotation.x = -Math.PI / 2; stage.scene.add(ground);
    B.party.forEach((m, i) => { m.home = new T.Vector3(...PPOS[i]); if (m.model) stage.add(m.model, { style: m.hero ? undefined : 'anime', height: m.hero ? 1.7 : m.h * 1.4, x: m.home.x, z: m.home.z, ry: .9, hat: m.hero ? P().equip.hat : null, wand: m.hero ? P().equip.wand : null }).then(av => { if (av) m.av = av; }); });
    B.foes.forEach((f, i) => { f.home = new T.Vector3(...FPOS[i]); if (f.model) stage.add(f.model, { height: f.h * 1.7, x: f.home.x, z: f.home.z, ry: -2.3, style: 'shadow', mask: true }).then(av => { if (!av) return; f.av = av; av.scale.setScalar(.01); grow(av); }); });
    const grow = av => { const t0 = performance.now(); const f = () => { const k = Math.min(1, (performance.now() - t0) / 500); av.scale.setScalar(.01 + k * .99); if (k < 1) requestAnimationFrame(f); }; f(); };
    const lab = el.querySelector('.b5-lab'), v = new T.Vector3();
    stage.actors.push({ update() {}, tick(dt) {
      cam.position.lerp(camT.pos, Math.min(1, dt * 4)); B._look = (B._look || camT.look.clone()).lerp(camT.look, Math.min(1, dt * 4)); cam.lookAt(B._look);
      const r = stage.renderer.domElement.getBoundingClientRect();
      B.foes.forEach(f => { if (!f.lab || !f.av) return; v.copy(f.av.position); v.y += f.h * 1.9; v.project(cam); f.lab.style.transform = 'translate(' + ((v.x + 1) / 2 * r.width) + 'px,' + ((1 - v.y) / 2 * r.height) + 'px)'; });
      B.fxs = (B.fxs || []).filter(f => f(dt) !== false);
    } });
    B.foes.forEach(f => { f.lab = h('div', 'b5-flab'); lab.appendChild(f.lab); });
    B.cam = camT; B.el = el; B.stage = stage;
    el.querySelector('.b5-auto').onclick = e => { B.auto = !B.auto; e.currentTarget.classList.toggle('on', B.auto); const p = P(); p.settings.b5auto = B.auto; save(); Audio2.sfx('select', .4); UI.toast(B.auto ? '宠物会自己判断出招' : '宠物的行动由你指挥', 1200); };
    drawFoes(B); drawParty(B);
    run(B);
  }
  function paintBg(cv) {
    const W = cv.width = 1280, H = cv.height = 800, x = cv.getContext('2d');
    const g = x.createRadialGradient(W * .6, H * .4, 40, W * .6, H * .4, W * .8); g.addColorStop(0, '#5a0010'); g.addColorStop(.5, '#1a0004'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.save(); x.translate(W * .6, H * .4); for (let i = 0; i < 28; i++) { x.rotate(Math.PI * 2 / 28); x.fillStyle = i % 2 ? 'rgba(230,0,18,.18)' : 'rgba(0,0,0,.3)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, -40); x.lineTo(W, 40); x.fill(); } x.restore();
    x.fillStyle = 'rgba(255,255,255,.06)'; for (let yy = 0; yy < H; yy += 14) for (let xx = (yy / 14 % 2) * 7; xx < W; xx += 14) { const r = 1 + (xx / W) * 3; x.beginPath(); x.arc(xx, yy, r, 0, 7); x.fill(); }
  }

  /* ---------- 界面 ---------- */
  function drawFoes(B) {
    B.foes.forEach(f => {
      if (!f.lab) return; f.lab.classList.toggle('dead', f.dead); f.lab.classList.toggle('down', f.down);
      f.lab.innerHTML = '<b>' + esc(f.n) + '</b><div class="fl-hp"><i style="width:' + Math.max(0, f.hp / f.mhp * 100) + '%"></i></div><div class="fl-w">' + (f.knownWeak ? '弱 ' + E(f.weak.e) : '弱 ？') + ' · 耐 ' + E(f.resist.e) + (f.deb ? ' · ' + E('🔻') : '') + '</div>' + (f.down ? '<em>倒地</em>' : '');
      hydrate(f.lab);
    });
  }
  const bufIcons = m => (m.buf.atk ? E('🔺') : '') + (m.buf.def ? E('🛡️') : '') + (m.down ? '<em class="dn">倒地</em>' : '');
  function drawParty(B) {
    const box = B.el.querySelector('.b5-party');
    if (box.children.length === B.party.length) { B.party.forEach((m, i) => { const c = box.children[i]; c.classList.toggle('ko', m.hp <= 0); c.classList.toggle('act', B.active === m); const hp = c.querySelector('.hp'); hp.firstChild.style.width = m.hp / m.mhp * 100 + '%'; hp.lastChild.textContent = m.hp; const sp = c.querySelector('.sp'); sp.firstChild.style.width = m.sp / m.msp * 100 + '%'; sp.lastChild.textContent = m.sp; const bf = c.querySelector('.pc-bf'); bf.innerHTML = bufIcons(m); hydrate(bf); }); return; }
    box.innerHTML = B.party.map(m => '<div class="b5-pc ' + (m.hp <= 0 ? 'ko ' : '') + (B.active === m ? 'act' : '') + '"><div class="pc-por">' + (m.hero ? '<img src="' + Core.emoSrc('🧒') + '" data-av="' + (m.model || '') + '" data-style="p5" data-frame="bust" data-size="160">' : Home.petImg(m.kind, { size: 160, style: 'p5', frame: 'bust' })) + '</div><div class="pc-m"><b>' + esc(m.n) + (m.hero ? '' : ' <small>Lv.' + m.lv + '</small>') + '</b><div class="pc-bar hp"><i style="width:' + m.hp / m.mhp * 100 + '%"></i><span>' + m.hp + '</span></div><div class="pc-bar sp"><i style="width:' + m.sp / m.msp * 100 + '%"></i><span>' + m.sp + '</span></div><div class="pc-el">' + (m.hero ? E('🔫') + '×' + m.ammo : E(m.elem.e) + '<small>弱</small>' + E(m.weak.e)) + '<span class="pc-bf">' + bufIcons(m) + '</span></div></div></div>').join('');
    hydrate(box);
  }
  const ammoDraw = B => { const c = B.el.querySelector('.b5-party').children[0]; if (c) { const e = c.querySelector('.pc-el'); e.innerHTML = E('🔫') + '×' + B.party[0].ammo + '<span class="pc-bf">' + bufIcons(B.party[0]) + '</span>'; hydrate(e); } };
  let curEl = null;
  function banner(text, sub, cls) {
    const b = h('div', 'b5-ban ' + (cls || '')); b.innerHTML = '<div class="bb-strip"></div><div class="bb-t">' + Home.ransom(text) + '</div>' + (sub ? '<div class="bb-s">' + esc(sub) + '</div>' : '');
    curEl.querySelector('.b5-fx').appendChild(b); Audio2.sfx('whoosh', .5); setTimeout(() => b.remove(), 1500); return sleep(1100);
  }
  // 切入：主角或宠物的立绘 + 技能名
  function cutIn(B, m, text) {
    const c = h('div', 'b5-cut' + (m.hero ? '' : ' pet'));
    const por = m.hero ? '<img src="' + Core.emoSrc('🧒') + '" data-av="' + (m.model || '') + '" data-style="p5" data-frame="bust" data-size="320">' : Home.petImg(m.kind, { size: 320, style: 'p5', frame: 'bust', pose: 'attack' });
    c.innerHTML = '<div class="ct-band"></div><div class="ct-por">' + por + '</div><div class="ct-t">' + Home.ransom(text) + '</div>';
    B.el.querySelector('.b5-fx').appendChild(c); hydrate(c); Avatar3D.hydrate(c); Audio2.sfx('magic', .5); setTimeout(() => c.remove(), 1300); return sleep(1000);
  }
  // 左上角技能名牌
  function skillTag(B, m, sk) {
    const t = B.el.querySelector('.b5-skn'); t.innerHTML = '<i>' + E(sk.e) + '</i><b>' + esc(sk.n) + '</b><small>' + esc(m.n) + '</small>'; hydrate(t);
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1600);
  }
  function dmgPop(B, target, txt, cls) {
    const T = THREE, v = new T.Vector3(); const av = target.av; if (!av) return;
    v.copy(av.position); v.y += (target.h || 1) * 1.2; v.project(B.stage.cam); const r = B.stage.renderer.domElement.getBoundingClientRect();
    const d = h('div', 'b5-dmg ' + (cls || ''), txt); d.style.left = ((v.x + 1) / 2 * r.width) + 'px'; d.style.top = ((1 - v.y) / 2 * r.height) + 'px';
    B.el.querySelector('.b5-fx').appendChild(d); setTimeout(() => d.remove(), 1200);
  }
  const shake = B => { B.el.classList.remove('shake'); void B.el.offsetWidth; B.el.classList.add('shake'); };
  function menu(B, items, title) {
    return new Promise(res => {
      const m = B.el.querySelector('.b5-menu');
      m.innerHTML = (title ? '<div class="bm-t">' + esc(title) + '</div>' : '') + items.map((it, i) => '<button class="b5-cmd' + (it.dis ? ' dis' : '') + '" data-i="' + i + '" data-key="' + it.key + '" data-say="' + esc(it.say || it.n) + '" style="--i:' + i + '">' + E(it.e) + '<b>' + it.n + '</b>' + (it.sub ? '<small>' + it.sub + '</small>' : '') + (it.cost ? '<em class="cost">' + it.cost + '</em>' : '') + '</button>').join('');
      hydrate(m); m.classList.add('show');
      m.onclick = e => { const b = e.target.closest('.b5-cmd'); if (!b) return; const it = items[+b.dataset.i]; if (it.dis) { Audio2.sfx('wrong', .3); if (it.why) UI.toast(it.why, 1200); return; } Audio2.sfx('select', .4); m.classList.remove('show'); m.onclick = null; res(it.v); };
    });
  }
  // 答题：返回是否答对
  function ask(B, title) {
    return new Promise(res => {
      const q = Home.pickQ(); if (!q) return res(true);
      const box = B.el.querySelector('.b5-q'); box.innerHTML = '<div class="bq-t">' + esc(title) + '</div>'; const QP = Engines.qPanel(q); box.appendChild(QP.el);
      const grid = h('div', 'choices compact n' + q.ch.length); box.appendChild(grid); box.classList.add('show'); let done = false;
      q.ch.forEach(c => { const b = h('button', 'choice pop-in', Engines.choiceHTML(c, q.latinCh)); b.dataset.ok = c.ok ? 1 : 0; b.onclick = async () => {
        if (done) return; done = true; if (c.ok) { b.classList.add('good'); Audio2.sfx('right', .5); } else { b.classList.add('bad'); grid.children[q.ch.findIndex(x => x.ok)].classList.add('reveal'); Audio2.sfx('wrong', .4); if (q.ex) Voice.say('正确答案：' + q.ex); }
        await sleep(c.ok ? 500 : 1400); box.classList.remove('show'); res(c.ok);
      }; grid.appendChild(b); });
      hydrate(box); QP.speak();
    });
  }
  const tween = (obj, to, ms) => new Promise(r => { const from = obj.position.clone(), t0 = performance.now(); const f = () => { const k = Math.min(1, (performance.now() - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; obj.position.lerpVectors(from, to, e); if (k < 1) requestAnimationFrame(f); else r(); }; f(); });
  const camTo = (B, pos, look) => { B.cam.pos.set(...pos); B.cam.look.set(...look); };
  const camReset = B => camTo(B, CAM0.pos, CAM0.look);
  // 轮到谁：镜头移到他的肩后
  const camBehind = (B, m) => { camTo(B, [m.home.x - 2.3, 1.5 + (m.hero ? .7 : m.h * .6), m.home.z + 3.6], [1.3, .8, -1.5]); if (m.av) m.av.lookAt(1.4, 0, -1.4); };

  /* ---------- 3D 特效 ---------- */
  function vfx(B, kind, pos, col) {
    const T = THREE, sc = B.stage.scene, g = new T.Group(); g.position.copy(pos); sc.add(g);
    const add = (geo, c, op) => { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op == null ? .95 : op, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); g.add(m); return m; };
    const parts = []; let life = .9, t = 0;
    const light = new T.PointLight(col || 0xffffff, 14, 7); light.position.set(0, 1, 0); g.add(light);
    const C = new T.Color(col || 0xffffff);
    if (kind === 'fire') { for (let i = 0; i < 30; i++) { const m = add(new T.ConeGeometry(.1 + Math.random() * .12, .5, 5), i % 3 ? 0xff6a1a : 0xffd040); m.position.set((Math.random() - .5) * .8, Math.random() * .3, (Math.random() - .5) * .8); parts.push({ m, v: new T.Vector3((Math.random() - .5) * 1.2, 2 + Math.random() * 3, (Math.random() - .5) * 1.2), s: 1 }); } const r = add(new T.RingGeometry(.2, .5, 32), 0xff5a1f); r.rotation.x = -Math.PI / 2; r.position.y = .05; parts.push({ m: r, grow: 5 }); }
    else if (kind === 'ice') { for (let i = 0; i < 8; i++) { const a = i / 8 * 7, d = .2 + Math.random() * .5, m = add(new T.ConeGeometry(.14, 1.4 + Math.random(), 5), i % 2 ? 0xbff4ff : 0x5fd0ff); m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); m.rotation.set(Math.sin(a) * .5, 0, Math.cos(a) * .5); m.scale.y = .01; parts.push({ m, rise: 1 }); } for (let i = 0; i < 14; i++) { const m = add(new T.OctahedronGeometry(.08), 0xffffff); m.position.y = .8; parts.push({ m, v: new T.Vector3((Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 4), s: 1, g: 6, delay: .35 }); } }
    else if (kind === 'elec') { life = .8; for (let k = 0; k < 2; k++) { let p0 = new T.Vector3((Math.random() - .5) * .6, 7, (Math.random() - .5) * .6); for (let i = 0; i < 9; i++) { const p1 = i === 8 ? new T.Vector3(0, .6, 0) : new T.Vector3((Math.random() - .5) * .9, 7 - (i + 1) * .75, (Math.random() - .5) * .9); const d = p1.clone().sub(p0), m = add(new T.BoxGeometry(.09, d.length(), .09), k ? 0xffffff : 0xffe23f); m.position.copy(p0).add(p1).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); parts.push({ m, flick: 1 }); p0 = p1; } } const r = add(new T.RingGeometry(.1, .4, 24), 0xffe23f); r.rotation.x = -Math.PI / 2; r.position.y = .05; parts.push({ m: r, grow: 6 }); }
    else if (kind === 'wind') { for (let i = 0; i < 3; i++) { const m = add(new T.TorusGeometry(.6 + i * .25, .05, 6, 32), 0x7dff9a, .8); m.rotation.x = Math.PI / 2; m.position.y = .3 + i * .5; parts.push({ m, spin: 8 + i * 3, up: 1.2, grow: 1 }); } for (let i = 0; i < 16; i++) { const m = add(new T.PlaneGeometry(.18, .08), 0xc8ffd8); const a = Math.random() * 7; m.position.set(Math.cos(a) * .8, Math.random() * 1.6, Math.sin(a) * .8); parts.push({ m, orb: a, r: .8, up: 1.5, spin: 10 }); } }
    else if (kind === 'light') { const m = add(new T.CylinderGeometry(.6, .6, 9, 24, 1, true), 0xfff3a0, .7); m.position.y = 4.5; m.scale.x = m.scale.z = .01; parts.push({ m, pillar: 1 }); for (let i = 0; i < 20; i++) { const s = add(new T.OctahedronGeometry(.07), 0xffffff); s.position.set((Math.random() - .5) * 1.4, Math.random() * 3, (Math.random() - .5) * 1.4); parts.push({ m: s, v: new T.Vector3(0, 1 + Math.random() * 2, 0), s: 1 }); } }
    else if (kind === 'phys' || kind === 'gun') { life = .45; [-.7, .7].forEach((a, i) => { const m = add(new T.BoxGeometry(2.2, .07, .07), 0xffffff); m.position.y = 1; m.rotation.z = a; m.rotation.y = .6; m.scale.x = .01; parts.push({ m, slash: 1, delay: i * .08 }); }); for (let i = 0; i < 10; i++) { const s = add(new T.TetrahedronGeometry(.08), 0xffd040); s.position.y = 1; parts.push({ m: s, v: new T.Vector3((Math.random() - .5) * 6, Math.random() * 4, (Math.random() - .5) * 6), s: 1, g: 9 }); } }
    else if (kind === 'heal') { const r = add(new T.RingGeometry(.4, .55, 32), 0x5fff9a); r.rotation.x = -Math.PI / 2; r.position.y = .05; parts.push({ m: r, grow: 2 }); for (let i = 0; i < 16; i++) { const s = add(new T.OctahedronGeometry(.06), i % 2 ? 0x5fff9a : 0xffffff); const a = Math.random() * 7; s.position.set(Math.cos(a) * .5, Math.random() * .4, Math.sin(a) * .5); parts.push({ m: s, v: new T.Vector3(0, 1.2 + Math.random() * 1.5, 0), s: 1 }); } }
    else if (kind === 'buff' || kind === 'def' || kind === 'debuff') { const c = kind === 'buff' ? 0xff3a3a : kind === 'def' ? 0x3a8aff : 0x6a5aff, dn = kind === 'debuff'; for (let i = 0; i < 6; i++) { const m = add(new T.ConeGeometry(.12, .4, 4), c); const a = i / 6 * 7; m.position.set(Math.cos(a) * .55, dn ? 2 : .2, Math.sin(a) * .55); if (dn) m.rotation.x = Math.PI; parts.push({ m, v: new T.Vector3(0, dn ? -1.8 : 1.8, 0), s: 0 }); } if (kind === 'def') { const hx = add(new T.CylinderGeometry(.9, .9, 1.8, 6, 1, true), c, .35); hx.position.y = .9; parts.push({ m: hx, spin: 1 }); } }
    else if (kind === 'omni') { for (let i = 0; i < 3; i++) { const r = add(new T.RingGeometry(.2, .45, 32), [0xff5fa8, 0x3fd0ff, 0xffd23f][i]); r.position.y = 1; r.lookAt(B.stage.cam.position.clone().sub(pos).add(r.position)); parts.push({ m: r, grow: 4 + i * 2, delay: i * .1 }); } }
    B.fxs = B.fxs || [];
    B.fxs.push(dt => {
      t += dt; const k = t / life;
      parts.forEach(q => {
        const tt = t - (q.delay || 0); if (tt < 0) { q.m.visible = false; return; } q.m.visible = true;
        if (q.v) { q.m.position.addScaledVector(q.v, dt); if (q.g) q.v.y -= q.g * dt; if (q.s) q.m.rotation.x += dt * 8; }
        if (q.grow) q.m.scale.setScalar(1 + tt * q.grow);
        if (q.rise) q.m.scale.y = Math.min(1, tt * 6);
        if (q.spin) q.m.rotation.z += dt * q.spin;
        if (q.up) q.m.position.y += dt * q.up;
        if (q.orb != null) { q.orb += dt * 6; q.m.position.x = Math.cos(q.orb) * q.r; q.m.position.z = Math.sin(q.orb) * q.r; }
        if (q.flick) q.m.visible = Math.sin(t * 60) > -.2;
        if (q.pillar) { const s = tt < .25 ? tt / .25 : Math.max(0, 1 - (tt - .25) / .6); q.m.scale.x = q.m.scale.z = .01 + s; }
        if (q.slash) q.m.scale.x = Math.min(1, tt * 10);
        q.m.material.opacity = Math.max(0, (q.m.material.userData.o0 || (q.m.material.userData.o0 = q.m.material.opacity)) * (1 - Math.max(0, k - .45) / .55));
      });
      light.intensity = Math.max(0, 14 * (1 - k));
      if (t >= life) { sc.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); return false; }
    });
    const ov = h('div', 'b5-flash'); ov.style.setProperty('--c', '#' + C.getHexString()); B.el.querySelector('.b5-fx').appendChild(ov); setTimeout(() => ov.remove(), 500);
  }
  const elKind = el => !el ? 'omni' : el.k;
  const elCol = el => !el ? 0xffffff : new THREE.Color(el.c).getHex();

  /* ---------- 伤害 ---------- */
  function hurtFoe(B, f, dmg, cls) {
    f.hp = Math.max(0, f.hp - dmg); dmgPop(B, f, (cls === 'weak' ? 'WEAK! ' : cls === 'resist' ? '耐性 ' : cls === 'crit' ? '暴击 ' : '') + dmg, cls);
    if (f.av && f.hp > 0) f.av.once('hit');
    if (f.hp <= 0 && !f.dead) { f.dead = true; f.down = false; if (f.av) { f.av.play('die', { once: true }); setTimeout(() => f.av.fade(0, 700), 600); } }
    drawFoes(B);
  }
  // 对一个敌人结算一次攻击，返回是否让它倒地
  function strike(B, me, f, el, pow, boost, opt) {
    opt = opt || {};
    const phys = el === PHYS || el === GUN;
    const weak = !!el && f.weak === el, res = !!el && f.resist === el;
    let crit = phys && Math.random() < (el === GUN ? .25 : .1);
    let dmg = (phys ? me.atk : me.mag) * pow * (weak ? 1.5 : res ? .5 : 1) * (crit ? 1.6 : 1) * (f.down && phys ? 1.25 : 1) * (1 + .5 * (boost || 0)) * (me.buf && me.buf.atk ? 1.3 : 1) * (.9 + Math.random() * .2);
    dmg = Math.max(1, Math.round(dmg));
    hurtFoe(B, f, dmg, weak ? 'weak' : crit ? 'crit' : res ? 'resist' : '');
    if (weak) f.knownWeak = true;
    const knock = (weak || crit) && !f.dead && !f.down;
    if (knock) { f.down = true; if (f.av) f.av.once('hit'); drawFoes(B); }
    if (!opt.quiet) { Audio2.sfx(weak ? 'gem' : 'hit', .6); shake(B); }
    return knock;
  }
  async function meleeTo(me, f) { const T = THREE; if (!me.av) return; me.av.play('run'); me.av.lookAt(f.home.x, 0, f.home.z); await tween(me.av, f.home.clone().add(new T.Vector3(-.9, 0, .7)), 300); me.av.once(me.av.has('attack') ? 'attack' : 'jump'); await sleep(240); }
  async function meleeBack(me) { if (!me.av) return; await sleep(260); me.av.play('run'); me.av.lookAt(me.home.x, 0, me.home.z); await tween(me.av, me.home, 300); me.av.play('idle'); me.av.lookAt(1, 0, -1); }
  const castAnim = me => { if (me.av) me.av.once(me.hero ? 'wave' : me.av.has('attack') ? 'attack' : 'jump'); };

  // 通用：执行一个技能（返回是否让敌人倒地 → 再动一次）
  async function useSkill(B, me, sk, tgt, boost) {
    skillTag(B, me, sk);
    if (sk.sp) { me.sp -= sk.sp; }
    if (sk.hp) { const c = Math.max(1, Math.round(me.mhp * sk.hp)); me.hp = Math.max(1, me.hp - c); }
    drawParty(B);
    if (sk.kind === 'heal') {
      castAnim(me); await sleep(300);
      B.party.forEach(m => { if (m.hp <= 0 && !me.hero) return; const was = m.hp; m.hp = Math.min(m.mhp, Math.max(m.hp, 0) + Math.round(m.mhp * sk.pow)); if (m.av) { vfx(B, 'heal', m.home, 0x5fff9a); if (was <= 0 && m.hp > 0) m.av.play('idle'); } dmgPop(B, m, '+' + (m.hp - Math.max(0, was)), 'heal'); });
      Audio2.sfx('magic', .5); drawParty(B); await sleep(800); return false;
    }
    if (sk.kind === 'buff') {
      castAnim(me); await sleep(300); B.party.forEach(m => { if (m.hp > 0) { m.buf[sk.buf] = 3; vfx(B, sk.buf === 'atk' ? 'buff' : 'def', m.home, sk.buf === 'atk' ? 0xff3a3a : 0x3a8aff); dmgPop(B, m, sk.buf === 'atk' ? '攻击↑' : '防御↑', 'info'); } });
      Audio2.sfx('levelup', .4); drawParty(B); await sleep(800); return false;
    }
    if (sk.kind === 'debuff') {
      castAnim(me); await sleep(300); B.foes.forEach(f => { if (!f.dead) { f.deb = 3; vfx(B, 'debuff', f.home, 0x6a5aff); dmgPop(B, f, '攻击↓', 'info'); } });
      Audio2.sfx('magic', .4); drawFoes(B); await sleep(800); return false;
    }
    // 攻击类
    if (sk.melee) {
      await meleeTo(me, tgt); vfx(B, 'phys', tgt.home, 0xffffff);
      const kn = strike(B, me, tgt, PHYS, sk.pow, boost); await meleeBack(me); return kn;
    }
    if (sk.sig || me.hero) await cutIn(B, me, sk.n);
    castAnim(me);
    const targets = sk.tgt === 'all' ? B.foes.filter(f => !f.dead) : [tgt];
    if (sk.tgt === 'all') camTo(B, [-1.2, 2.6, 4.6], [1.5, .6, -1.6]); else camTo(B, [tgt.home.x - 2.6, 1.6, tgt.home.z + 3.2], [tgt.home.x, .8, tgt.home.z]);
    await sleep(350);
    let kn = false;
    for (const f of targets) { vfx(B, elKind(sk.el), f.home, elCol(sk.el)); if (sk.tgt === 'all') await sleep(120); }
    await sleep(250);
    targets.forEach((f, i) => { if (strike(B, me, f, sk.el, (me.hero ? 1 : 1) * sk.pow, boost, { quiet: i > 0 })) kn = true; });
    await sleep(650);
    return kn && B.foes.some(f => !f.dead);
  }
  async function physical(B, me, f, boost) {
    skillTag(B, me, { e: '🗡️', n: '攻击' });
    await meleeTo(me, f); vfx(B, 'phys', f.home, 0xffffff);
    const kn = strike(B, me, f, PHYS, 1, boost); await meleeBack(me); return kn;
  }
  async function shoot(B, me, f, boost) {
    const T = THREE; me.ammo--; ammoDraw(B); skillTag(B, me, { e: '🔫', n: '枪击' });
    if (me.av) { me.av.lookAt(f.home.x, 0, f.home.z); me.av.once('attack'); }
    camTo(B, [me.home.x - 1.6, 1.5, me.home.z + 2.2], [f.home.x, .9, f.home.z]);
    await sleep(250);
    for (let i = 0; i < 3; i++) { // 三连射：曳光弹
      const a = me.home.clone().setY(1.1), b = f.home.clone().setY(.8 + Math.random() * .4), d = b.clone().sub(a);
      const m = new T.Mesh(new T.BoxGeometry(.04, .04, d.length()), new T.MeshBasicMaterial({ color: 0xffe080, transparent: true, blending: T.AdditiveBlending })); m.position.copy(a).add(b).multiplyScalar(.5); m.lookAt(b); B.stage.scene.add(m);
      Audio2.sfx('pop', .4); setTimeout(() => { B.stage.scene.remove(m); m.geometry.dispose(); }, 90); await sleep(110);
    }
    vfx(B, 'gun', f.home, 0xffe080);
    const kn = strike(B, me, f, GUN, 1.1, boost); await sleep(500); camReset(B); if (me.av) me.av.lookAt(1, 0, -1); return kn;
  }

  /* ---------- 敌人行动 ---------- */
  async function enemyPhase(B) {
    camReset(B);
    for (const f of B.foes) {
      if (B.over || f.dead) continue;
      if (f.down) { f.down = false; drawFoes(B); dmgPop(B, f, '起身', 'info'); await sleep(500); continue; }
      const alive = B.party.filter(m => m.hp > 0); if (!alive.length) break; const tg = R.pick(alive);
      const atkMul = f.deb ? .7 : 1; if (f.deb) f.deb--;
      const useMagic = Math.random() < .35;
      if (useMagic) {
        skillTag(B, { n: f.n }, { e: f.el.e, n: f.el.sk });
        if (f.av) f.av.once(f.av.has('attack') ? 'attack' : 'jump'); await sleep(350);
        vfx(B, f.el.k, tg.home, elCol(f.el)); await sleep(350);
        const weak = tg.weak === f.el && !tg.guard, res = tg.elem === f.el;
        let d = Math.round(f.atk * 1.2 * atkMul * (weak ? 1.5 : res ? .5 : 1) * (.85 + Math.random() * .3)); if (tg.guard) d = Math.round(d * (Bond.fx().guard ? .3 : .5)); if (tg.buf.def) d = Math.round(d * .7);
        tg.hp = Math.max(0, tg.hp - d); dmgPop(B, tg, (weak ? 'WEAK! ' : res ? '耐性 ' : '-') + d, weak ? 'weak' : 'hurt'); Audio2.sfx(weak ? 'gem' : 'hurt', .5); shake(B);
        if (weak && tg.hp > 0) { tg.down = true; dmgPop(B, tg, '倒地', 'info'); }
        if (tg.av) tg.av.once(tg.hp > 0 ? 'hit' : 'die');
        drawParty(B); await sleep(500);
      } else {
        if (f.av) { f.av.play('run'); f.av.lookAt(tg.home.x, 0, tg.home.z); await tween(f.av, tg.home.clone().add(new THREE.Vector3(.9, 0, -.6)), 320); f.av.once(f.av.has('attack') ? 'attack' : 'jump'); await sleep(280); }
        const dodge = tg.hero && Math.random() < Home.socRank(P(), 'de') * .04;
        if (dodge) { dmgPop(B, tg, 'MISS', 'info'); Audio2.sfx('whoosh', .4); }
        else { let d = Math.round(f.atk * atkMul * (.8 + Math.random() * .4) * (tg.down ? 1.3 : 1)); if (tg.guard) d = Math.round(d * (Bond.fx().guard ? .3 : .5)); if (tg.buf.def) d = Math.round(d * .7); tg.hp = Math.max(0, tg.hp - d); dmgPop(B, tg, '-' + d, 'hurt'); Audio2.sfx('hurt', .5); shake(B); vfx(B, 'phys', tg.home, 0xff3040); if (tg.av) tg.av.once(tg.hp > 0 ? 'hit' : 'die'); }
        drawParty(B);
        if (f.av) { await sleep(250); f.av.play('run'); f.av.lookAt(f.home.x, 0, f.home.z); await tween(f.av, f.home, 320); f.av.play('idle'); f.av.lookAt(-1.5, 0, 1); }
      }
      await sleep(250);
      if (B.party[0].hp <= 0) { B.over = 'lose'; return; }
    }
    B.party.forEach(m => { m.guard = false; if (m.buf.atk) m.buf.atk--; if (m.buf.def) m.buf.def--; }); drawParty(B);
  }

  /* ---------- 回合 ---------- */
  async function run(B) {
    curEl = B.el; await sleep(700);
    await banner(B.opt.adv === 'player' ? '先制攻击' : B.opt.adv === 'enemy' ? '被偷袭了' : '战斗开始', B.foes.length + ' 只暗影' + (B.opt.adv === 'player' ? ' · 我方先动' : B.opt.adv === 'enemy' ? ' · 敌人先动' : ''));
    if (B.opt.adv === 'enemy') await enemyPhase(B);
    while (!B.over) {
      B.turn++;
      const queue = B.party.slice();
      while (queue.length && !B.over) {
        const m = queue.shift();
        if (m.hp <= 0) continue;
        if (m.down) { m.down = false; dmgPop(B, m, '起身', 'info'); drawParty(B); await sleep(500); continue; }
        let actor = m, boost = 0;
        for (;;) {
          const more = await act(B, actor, boost);
          if (B.over || checkWin(B)) break;
          if (allDown(B)) { await holdUp(B); break; }
          if (!more) break;
          // 再动一次 / 接力
          const mates = queue.filter(x => x.hp > 0 && !x.down);
          const nx = await oneMore(B, actor, mates);
          if (nx !== actor) { queue.splice(queue.indexOf(nx), 1); boost++; await batonFx(B, actor, nx); }
          actor = nx;
        }
        if (B.over || checkWin(B)) break;
      }
      if (B.over || checkWin(B)) break;
      B.active = null; drawParty(B);
      await enemyPhase(B);
    }
    await finish(B);
  }
  const allDown = B => { const a = B.foes.filter(f => !f.dead); return a.length && a.every(f => f.down); };
  const checkWin = B => { if (B.foes.every(f => f.dead)) { B.over = B.over || 'win'; return true; } return false; };
  async function oneMore(B, me, mates) {
    await cutIn(B, me, '再动一次');
    if ((!me.hero && B.auto) || !mates.length) return me;
    return menu(B, [{ n: '再动一次', e: '🔁', key: '1', v: me, sub: me.n + ' 继续行动' }].concat(mates.map((x, i) => ({ n: '接力 → ' + x.n, e: '🤚', key: String(i + 2), v: x, sub: '伤害提升！' }))), 'ONE MORE');
  }
  async function batonFx(B, from, to) {
    const b = h('div', 'b5-baton'); b.innerHTML = '<div class="bt-hand"></div><div class="bt-t">' + Home.ransom('接力') + '</div><small>' + esc(from.n) + ' → ' + esc(to.n) + '</small>';
    B.el.querySelector('.b5-fx').appendChild(b); Audio2.sfx('pop', .6); if (from.av) from.av.once('wave'); setTimeout(() => b.remove(), 1100); await sleep(900);
  }
  async function pickTarget(B, why) {
    const alive = B.foes.filter(f => !f.dead); if (alive.length === 1) return alive[0];
    return menu(B, alive.map((f, i) => ({ n: f.n, e: f.knownWeak ? f.weak.e : '❓', sub: 'HP ' + f.hp + '/' + f.mhp + (f.down ? ' · 倒地' : ''), key: String(i + 1), v: f })).concat([{ n: '返回', e: '↩️', key: 'Escape', v: null }]), why || '选择目标');
  }
  const skillItems = (me, list) => list.map((s, i) => {
    const noSp = s.sp && me.sp < s.sp, noHp = s.hp && me.hp <= Math.round(me.mhp * s.hp);
    return { n: s.n, e: s.e, sub: s.lock ? 'Lv.' + s.lock + ' 解锁' : s.d, cost: s.lock ? '' : s.sp ? 'SP ' + s.sp : s.hp ? 'HP ' + Math.round(me.mhp * s.hp) : '', key: String(i + 1), v: s, dis: !!(s.lock || noSp || noHp), why: s.lock ? '升到 Lv.' + s.lock + ' 才能使用' : noSp ? 'SP 不够了' : 'HP 不够了' };
  }).concat([{ n: '返回', e: '↩️', key: 'Escape', v: null }]);
  // 一个角色的行动；返回是否触发「再动一次」
  async function act(B, me, boost) {
    B.active = me; drawParty(B); camBehind(B, me);
    B.el.querySelector('.b5-turn').innerHTML = Home.ransom(me.hero ? '你的回合' : me.n + '的回合');
    if (me.av) me.av.once(me.av.has('yes') ? 'yes' : 'idle');
    if (boost) dmgPop(B, me, '接力 ×' + (1 + .5 * boost).toFixed(1), 'info');
    const r = me.hero ? await heroTurn(B, me, boost) : B.auto ? await petAI(B, me, boost) : await petTurn(B, me, boost);
    camReset(B); return r;
  }
  async function heroTurn(B, me, boost) {
    const p = P();
    for (;;) {
      const c = await menu(B, [
        { n: '攻击', e: '🗡️', key: 'a', v: 'atk', sub: '物理 · 普通攻击' },
        { n: '枪击', e: '🔫', key: 'g', v: 'gun', sub: '三连射 · 剩 ' + me.ammo + ' 发', dis: me.ammo <= 0, why: '子弹打光了' },
        { n: '技能', e: '🔮', key: 's', v: 'skill', sub: '答对题目放魔法' },
        { n: '防御', e: '🛡️', key: 'd', v: 'guard', sub: '减伤 · 不会被打倒' },
        { n: '道具', e: '🧪', key: 'i', v: 'item', sub: '回血药水 ×' + (p.inv.potion || 0), dis: !p.inv.potion, why: '没有回血药水' },
        { n: '逃跑', e: '🏃', key: 'r', v: 'run', sub: '离开战斗' },
      ]);
      if (c === 'atk') { const f = await pickTarget(B); if (!f) continue; return physical(B, me, f, boost); }
      if (c === 'gun') { const f = await pickTarget(B, '瞄准谁？'); if (!f) continue; return shoot(B, me, f, boost); }
      if (c === 'skill') {
        const sk = await menu(B, skillItems(me, me.skills), '人格面具 · 技能'); if (!sk) continue;
        let f = null; if (sk.tgt === 'one') { f = await pickTarget(B, '对谁使用「' + sk.n + '」？'); if (!f) continue; }
        me.sp -= sk.sp; drawParty(B);
        const ok = await ask(B, '答对就能放出「' + sk.n + '」！');
        if (!ok) { dmgPop(B, f || me, 'MISS', 'info'); await sleep(600); return false; }
        const s2 = Object.assign({}, sk, { sp: 0 });
        return useSkill(B, me, s2, f, boost);
      }
      if (c === 'guard') { me.guard = true; dmgPop(B, me, '防御', 'info'); vfx(B, 'def', me.home, 0x3a8aff); if (me.av) me.av.once('yes'); await sleep(500); return false; }
      if (c === 'item') { p.inv.potion--; save(); B.party.forEach(m => { if (m.hp <= 0) return; const heal = Math.round(m.mhp * .5); m.hp = Math.min(m.mhp, m.hp + heal); dmgPop(B, m, '+' + heal, 'heal'); vfx(B, 'heal', m.home, 0x5fff9a); }); Audio2.sfx('magic', .5); drawParty(B); await sleep(700); return false; }
      if (c === 'run') { if (B.opt.adv === 'player' || Math.random() < .7) { B.over = 'run'; await banner('撤退成功'); } else { await banner('没能逃掉'); } return false; }
    }
  }
  async function petTurn(B, me, boost) {
    for (;;) {
      const c = await menu(B, [
        { n: '攻击', e: '🐾', key: 'a', v: 'atk', sub: '物理 · 普通攻击' },
        { n: '技能', e: me.elem.e, key: 's', v: 'skill', sub: me.skills.filter(s => !s.lock).length + ' 个技能 · SP ' + me.sp },
        { n: '防御', e: '🛡️', key: 'd', v: 'guard', sub: '减伤 · 不会被打倒' },
        { n: '交给它', e: '🤖', key: 'q', v: 'ai', sub: '这回合让它自己判断' },
      ], me.n + ' · ' + me.elem.n + '属性');
      if (c === 'atk') { const f = await pickTarget(B); if (!f) continue; return physical(B, me, f, boost); }
      if (c === 'ai') return petAI(B, me, boost);
      if (c === 'guard') { me.guard = true; dmgPop(B, me, '防御', 'info'); vfx(B, 'def', me.home, 0x3a8aff); await sleep(500); return false; }
      const sk = await menu(B, skillItems(me, me.skills), me.n + ' 的技能'); if (!sk) continue;
      let f = null; if (sk.tgt === 'one') { f = await pickTarget(B, '对谁使用「' + sk.n + '」？'); if (!f) continue; }
      return useSkill(B, me, sk, f, boost);
    }
  }
  // 宠物 AI：有人残血先治疗；知道弱点就打弱点；敌人多就放群体；否则物理 / 普通魔法
  async function petAI(B, me, boost) {
    await sleep(250);
    const can = s => !s.lock && (!s.sp || me.sp >= s.sp) && (!s.hp || me.hp > me.mhp * (s.hp + .25));
    const alive = B.foes.filter(f => !f.dead && !f.down), any = alive.length ? alive : B.foes.filter(f => !f.dead);
    const heal = me.skills.find(s => s.kind === 'heal' && can(s)), low = B.party.some(m => m.hp > 0 && m.hp < m.mhp * .4);
    if (heal && low) return useSkill(B, me, heal, null, boost);
    const buff = me.skills.find(s => (s.kind === 'buff' || s.kind === 'debuff') && can(s));
    if (buff && B.turn === 1 && Math.random() < .5) return useSkill(B, me, buff, null, boost);
    const weakT = any.find(f => (f.knownWeak || Math.random() < .3) && f.weak === me.elem);
    const sig = me.skills.find(s => s.sig && can(s)), basic = me.skills.find(s => s.id === 'basic' && can(s)), ma = me.skills.find(s => s.id === 'ma' && can(s)), ph = me.skills.find(s => s.id === 'phys' && can(s));
    if (weakT) return useSkill(B, me, sig && Math.random() < .5 ? sig : basic || sig || ma, weakT, boost);
    if (ma && any.length >= 2 && Math.random() < .6) return useSkill(B, me, ma, null, boost);
    const tg = any.find(f => f.knownWeak && f.weak === PHYS) || R.pick(any);
    if (ph && Math.random() < .35) return useSkill(B, me, ph, tg, boost);
    if (basic && Math.random() < .5) return useSkill(B, me, basic, tg, boost);
    return physical(B, me, tg, boost);
  }

  /* ---------- 包围：总攻击 / 交涉 ---------- */
  async function holdUp(B) {
    await banner('包围', '敌人全部倒地了！', 'hold');
    camTo(B, [-.4, 2.0, 4.6], [1.4, .6, -1.5]);
    B.party.forEach(m => { if (m.av && m.hp > 0) m.av.play('idle'); });
    const c = await menu(B, [{ n: '总攻击', e: '💥', key: 'a', v: 'aoa', sub: '大家一起冲上去！' }, { n: '交涉', e: '💬', key: 's', v: 'talk', sub: '答对题目，把暗影收为伙伴' }, { n: '继续战斗', e: '↩️', key: 'Escape', v: 'no' }], '要怎么做？');
    if (c === 'no') { B.foes.forEach(f => { if (!f.dead) f.down = false; }); drawFoes(B); camReset(B); return; }
    if (c === 'aoa') return allOut(B);
    return negotiate(B);
  }
  async function allOut(B) {
    const fx = B.el.querySelector('.b5-fx'), ov = h('div', 'b5-aoa');
    ov.innerHTML = '<div class="ao-cloud"></div>' + Array.from({ length: 9 }, (_, i) => '<i class="ao-sl" style="--i:' + i + ';--r:' + R.int(-60, 60) + 'deg"></i>').join('') + '<div class="ao-t">' + Home.ransom('总攻击') + '</div>';
    fx.appendChild(ov); Audio2.sfx('whoosh', .6);
    B.party.forEach(m => { if (m.av && m.hp > 0) m.av.play('run'); });
    for (let i = 0; i < 7; i++) { await sleep(180); Audio2.sfx('hit', .5); shake(B); const f = R.pick(B.foes.filter(x => !x.dead) || B.foes); if (f) vfx(B, 'phys', f.home, 0xffffff); }
    const pw = B.party.filter(m => m.hp > 0).reduce((a, m) => a + m.atk, 0) * 2.4 * (1 + (Bond.fx().aoa || 0) / 100);
    B.foes.forEach(f => { if (!f.dead) hurtFoe(B, f, Math.round(pw * (.9 + Math.random() * .2)), 'crit'); });
    await sleep(500); ov.classList.add('out');
    const fin = h('div', 'b5-finish'); const hero = B.party[0];
    fin.innerHTML = '<div class="fi-bg"></div><div class="fi-por"><img src="' + Core.emoSrc('🧒') + '" data-av="' + (hero.model || '') + '" data-style="p5" data-frame="full" data-size="420" data-pose="wave"></div><div class="fi-t">' + Home.ransom('胜利就在眼前') + '</div>';
    fx.appendChild(fin); hydrate(fin); Audio2.sfx('victory', .5); await sleep(1700); fin.remove(); ov.remove();
    B.party.forEach(m => { if (m.av && m.hp > 0) m.av.play('idle'); });
    B.foes.forEach(f => { if (!f.dead) f.down = false; }); drawFoes(B); camReset(B);
  }
  async function negotiate(B) {
    const p = P(), alive = B.foes.filter(f => !f.dead);
    const f = alive.length === 1 ? alive[0] : await menu(B, alive.map((x, i) => ({ n: x.n, e: Home.dex(x.kind).e, sub: Home.TIERS[x.t].id + ' ' + Home.TIERS[x.t].n + (p.petsOwned.includes(x.kind) ? ' · 已拥有' : ' · 新伙伴！'), key: String(i + 1), v: x })), '和谁交涉？');
    camTo(B, [f.home.x - 1.8, 1.4, f.home.z + 2.6], [f.home.x, .8, f.home.z]);
    const want = await menu(B, [{ n: '成为我的伙伴吧', e: '🤝', key: '1', v: 'pet', sub: '收为宠物（答对 ' + need() + ' 题）' }, { n: '把金币交出来', e: '🪙', key: '2', v: 'coin', sub: '答对 1 题' }, { n: '给我点道具', e: '🎁', key: '3', v: 'item', sub: '答对 1 题' }], '「' + f.n + '」：……你想要什么？');
    function need() { let n = 2; if (Home.socRank(p, 'ch') >= 3) n--; n -= Bond.fx().nego || 0; return Math.max(1, n); }
    const total = want === 'pet' ? need() : 1, chances = total + (Home.socRank(p, 'ki') >= 4 ? 1 : 0);
    let ok = 0;
    for (let i = 0; i < chances && ok < total; i++) {
      const good = await ask(B, '「' + f.n + '」的问题（' + (ok + 1) + '/' + total + '）'); if (good) ok++;
      dmgPop(B, f, good ? '♪' : '……', good ? 'heal' : 'info');
    }
    if (ok < total) { await banner('交涉失败', '暗影站起来了！'); B.foes.forEach(x => { if (!x.dead) x.down = false; }); drawFoes(B); await enemyPhase(B); return; }
    if (want === 'coin') { const c = R.int(15, 30) + f.t * 10; App.addCoins(c); await banner('拿到金币', '+' + c + ' 金币'); f.dead = true; if (f.av) f.av.fade(0, 600); drawFoes(B); checkWin(B); return; }
    if (want === 'item') { const it = R.pick(['potion', 'hint']); p.inv[it] = (p.inv[it] || 0) + 1; save(); await banner('拿到道具', it === 'potion' ? '回血药水 ×1' : '提示卡 ×1'); f.dead = true; if (f.av) f.av.fade(0, 600); drawFoes(B); checkWin(B); return; }
    // 收服：面具碎裂，暗影变回宠物
    if (f.av) { f.av.traverse(o => { if (o.isSprite) o.visible = false; }); vfx(B, 'light', f.home, 0xfff3a0); }
    const K = Home.dex(f.kind), dup = p.petsOwned.includes(f.kind);
    if (dup) p.petStars[f.kind] = Math.min(5, (p.petStars[f.kind] || 1) + 1 + (Bond.fx().catch || 0)); else { p.petsOwned.push(f.kind); p.petStars[f.kind] = Math.min(5, 1 + (Bond.fx().catch || 0)); }
    save(); App.checkBadges && App.checkBadges();
    const sk = skillsOf(f.kind, 1);
    const cap = h('div', 'b5-cap'); cap.innerHTML = '<div class="cp-bg"></div><div class="cp-in"><div class="cp-q">「我是你内心的力量……从今天起，我就是你的伙伴！」</div><div class="cp-por">' + Home.petImg(f.kind, { size: 320, style: 'p5', pose: 'wave' }) + '</div><div class="cp-n">' + Home.tierBadge(K.t) + ' <b>' + K.n + '</b> ' + (dup ? '星级提升！' : '加入了队伍！') + '</div>' + Home.stars(p.petStars[f.kind]) + '<div class="cp-sk">' + sk.map(s => '<span class="' + (s.lock ? 'lk' : '') + '">' + E(s.e) + esc(s.n) + '</span>').join('') + '</div><div class="cp-tap">' + (dup ? '' : '出门前在「队伍」里可以带上它 · ') + '点击继续</div></div>';
    B.el.querySelector('.b5-fx').appendChild(cap); hydrate(cap); Avatar3D.hydrate(cap); Audio2.sfx('hatch', .7); UI.confetti(90); Voice.say('我就是你的伙伴！');
    await new Promise(r => { cap.onclick = r; setTimeout(r, 6000); }); cap.remove();
    f.dead = true; f.caught = true; if (f.av) f.av.fade(0, 500); drawFoes(B);
    const rest = B.foes.filter(x => !x.dead); if (rest.length) { await banner('其余暗影逃走了'); rest.forEach(x => { x.dead = true; if (x.av) x.av.fade(0, 500); }); }
    B.over = 'win';
  }

  /* ---------- 结算 ---------- */
  function partyXP(B, xp) {
    const p = P(), learned = [];
    B.party.forEach((m, i) => {
      if (m.hero) return;
      const before = skillsOf(m.kind, m.lv).filter(s => !s.lock).length;
      if (i === 1) App.petXP && App.petXP(xp);
      else { const po = m.pet; po.xp = (po.xp || 0) + xp; while (po.xp >= 40 + po.lv * 20) { po.xp -= 40 + po.lv * 20; po.lv++; UI.toast(E(Home.dex(m.kind).e) + ' ' + esc(m.n) + ' 升到 ' + po.lv + ' 级啦！'); } p.petStore = p.petStore || {}; p.petStore[m.kind] = po; }
      const lv = i === 1 ? p.pet.lv : m.pet.lv, now = skillsOf(m.kind, lv); if (now.filter(s => !s.lock).length > before) learned.push(m.n + ' 学会了「' + now.filter(s => !s.lock).slice(-1)[0].n + '」');
    });
    save(); return learned;
  }
  async function finish(B) {
    const p = P(), opt = B.opt; B.el.querySelector('.b5-menu').classList.remove('show');
    if (B.over === 'run') { opt.onEnd && opt.onEnd({ run: true }); return; }
    if (B.over === 'lose') {
      await banner('撤退……', '大家都累坏了，先回去休息吧');
      const m = UI.modal('<div class="p5-res lose">' + Home.ransom('战斗失败') + '<p>暗影太强了……多学习、提升能力再来挑战吧！</p><div class="r-btns"><button class="btn" data-key="Enter">回去</button></div></div>', { cls: 'p3m', noClose: true });
      m.el.querySelector('.btn').onclick = () => { m.close(); opt.onEnd && opt.onEnd({ lose: true }); }; return;
    }
    B.party.forEach(m => { if (m.av && m.hp > 0) m.av.play(m.av.has('dance') ? 'dance' : 'wave'); });
    camTo(B, [1.6, 1.7, 5], [-1.8, .9, .9]); B.party.forEach(m => { if (m.av) m.av.lookAt(1.6, 0, 5); });
    await sleep(600);
    const gfx = Home.gearFx(p), defeated = B.foes.filter(f => f.dead), caught = defeated.filter(f => f.caught);
    const xp = Math.round(defeated.reduce((a, f) => a + 12 + f.t * 8, 0) * (1 + gfx.book / 100)), coins = Math.round(defeated.reduce((a, f) => a + 6 + f.t * 5, 0) * (1 + gfx.magnet / 100));
    App.addXP && App.addXP(xp); App.addCoins(coins);
    const learned = partyXP(B, Math.round(xp / 2));
    const gear = Home.rollDrop('boss');
    const m = UI.modal('<div class="p5-res">' + Home.ransom('战斗胜利') + '<div class="pr-rows"><div><span>经验</span><b>+' + xp + '</b></div><div><span>宠物经验</span><b>+' + Math.round(xp / 2) + ' ×' + (B.party.length - 1) + '</b></div><div><span>金币</span><b>+' + coins + '</b></div>' + (caught.length ? '<div><span>收服</span><b>' + caught.map(f => Home.dex(f.kind).n).join('、') + '</b></div>' : '') + learned.map(t => '<div class="new"><span>新技能</span><b>' + esc(t) + '</b></div>').join('') + '</div>' + (gear ? Home.gearCard(gear, 'on') : '') + '<div class="r-btns"><button class="btn" data-key="Enter">继续探索</button></div></div>', { cls: 'p3m', noClose: true });
    hydrate(m.el); Audio2.sfx('victory', .6);
    m.el.querySelector('.btn').onclick = () => { m.close(); opt.onEnd && opt.onEnd({ win: true, caught: caught.map(f => f.kind) }); };
  }

  window.Battle5 = { start, rollEnemies, ELEM, elemOf, weakOf, skillsOf };
})();
