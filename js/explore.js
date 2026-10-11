/* 出门探索：带宠物和伙伴出门（星星小镇 / 霓虹都市 / 萤火森林 / 月光海滩 / 影时间之塔）
   · 支持 WebGL 时进入 3D 怪盗风场景（Explore3D：自由行走、潜行、突袭暗影、第三只眼）
   · 不支持时退回 2D 手绘多层视差横版场景
   · 地点互动（寻宝、购物、许愿、休息、答题、拍照……）由 makeActs 统一实现，2D / 3D 共用 */
(function () {
  const { h, sleep, esc, Store, Audio2, Voice, E, hydrate, UI } = Core;
  const R = CONTENT.R;
  const P = () => Store.p, save = () => Store.save();
  const SC = () => Sketch.SCENES;
  const unlocked = (p, s) => Core.free() || p.lv >= s.lv;
  const ACT_N = { find: '寻宝', shop: '购物', wish: '许愿', sit: '休息', quiz: '答题', play: '玩耍', pet: '摸摸', photo: '拍照' };

  /* ---------- 队伍：当前宠物 + 最多 2 只同行伙伴 ---------- */
  const PARTY_MAX = 2;
  function party(p) {
    p = p || P(); if (!p.pet) return [];
    p.party = (p.party || []).filter(k => k !== p.pet.kind && p.petsOwned.includes(k)).slice(0, PARTY_MAX);
    return p.party;
  }

  /* ---------- 场景选择 ---------- */
  function pick() {
    const p = Home.ensure();
    if (!p.pet) { Home.dialog('提示', '先孵出一只宠物，再带它出门吧！'); return; }
    const ids = Object.keys(SC());
    const m = UI.modal('<div class="p3-mh"><b>GO OUT</b><span>出门探索 · 带上 ' + esc(p.pet.name) + '</span></div><div class="ex-list">' + ids.map((id, i) => {
      const s = SC()[id], ok = unlocked(p, s), used = Object.keys(p.hm.spots).filter(k => k.startsWith(id + ':')).length, sec = (p.hm.sec || {})[id] || 0;
      return '<button class="ex-card' + (ok ? '' : ' lock') + '" data-id="' + id + '" data-key="' + (i + 1) + '" data-say="' + s.n + '" style="--i:' + i + '"><canvas class="ex-thumb" data-id="' + id + '"></canvas><div class="ex-t"><b>' + E(s.e) + ' ' + s.n + '</b><small>' + (ok ? s.spots.length + ' 个地点 · 今天探索了 ' + used + (sec ? ' · 警戒 ' + sec + '%' : '') : E('🔒') + ' Lv.' + s.lv + ' 解锁') + '</small></div></button>';
    }).join('') + '</div><div class="ex-party"><div class="ep-h">' + Home.ransom('PARTY') + '<small>选择最多 ' + PARTY_MAX + ' 只伙伴一起出门（战斗时一起上阵）</small></div><div class="ep-list"></div></div>', { cls: 'wide p3m' });
    $$('.ex-thumb', m.el).forEach(cv => { const id = cv.dataset.id, W = 360, Hh = 150; cv.width = W; cv.height = Hh; const c = cv.getContext('2d'); c.drawImage(Sketch.paintLayer(id, 'sky', W, Hh), 0, 0); c.drawImage(Sketch.paintLayer(id, 'far', W * 2, Hh), 0, 0, W * 2, Hh, 0, 0, W * 1.3, Hh); c.drawImage(Sketch.paintLayer(id, 'mid', W * 3, Hh), 0, 0, W * 3, Hh, 0, 0, W * 1.8, Hh); });
    $$('.ex-card', m.el).forEach(b => b.onclick = () => { const s = SC()[b.dataset.id]; if (!unlocked(p, s)) { UI.toast('角色升到 Lv.' + s.lv + ' 才能去' + s.n); Audio2.sfx('wrong', .3); return; } m.close(); go(b.dataset.id); });
    const list = m.el.querySelector('.ep-list');
    const draw = () => {
      const pt = party(p);
      list.innerHTML = [p.pet.kind].concat(p.petsOwned.filter(k => k !== p.pet.kind)).map(k => {
        const K = Home.dex(k), on = k === p.pet.kind || pt.includes(k), sk = window.Battle5 ? Battle5.skillsOf(k, (p.petStore && p.petStore[k] || {}).lv || (k === p.pet.kind ? p.pet.lv : 1)) : [];
        return '<button class="ep-pet' + (on ? ' on' : '') + (k === p.pet.kind ? ' lead' : '') + '" data-k="' + k + '" data-tip="' + esc(sk.map(s => s.n).join(' / ')) + '">' + Home.petImg(k, { size: 120, style: 'p5', frame: 'bust' }) + '<b>' + esc(k === p.pet.kind ? p.pet.name : K.n) + '</b>' + Home.tierBadge(K.t) + (k === p.pet.kind ? '<em>队长</em>' : on ? '<em>同行</em>' : '') + '</button>';
      }).join('') || '<p class="dim">还没有别的宠物，去探索里收服暗影吧！</p>';
      hydrate(list); if (window.Avatar3D) Avatar3D.hydrate(list);
      $$('.ep-pet', list).forEach(b => b.onclick = () => {
        const k = b.dataset.k; if (k === p.pet.kind) { UI.toast('队长是当前的宠物，在家里「换宠物」可以更换'); return; }
        const pt = party(p), i = pt.indexOf(k);
        if (i >= 0) pt.splice(i, 1); else if (pt.length >= PARTY_MAX) { UI.toast('最多带 ' + PARTY_MAX + ' 只伙伴'); Audio2.sfx('wrong', .3); return; } else pt.push(k);
        p.party = pt; save(); Audio2.sfx('select', .4); draw();
      });
    };
    draw();
  }

  /* ---------- 场景 ---------- */
  function go(id, resume) {
    if (window.Explore3D && Explore3D.supported()) return Explore3D.go(id, resume);
    const p = Home.ensure(), S = SC()[id];
    App.show('explore', el => {
      el.classList.add('p3');
      el.innerHTML = '<canvas class="ex-bg"></canvas><div class="ex-3d"></div><canvas class="ex-fg"></canvas><div class="ex-marks"></div><div class="ex-ents"></div>' +
        '<div class="p3-top"><button class="back p3-back" data-tip="回家">' + E('🏠') + '</button><div class="p3-title"><b>' + Home.ransom(id.toUpperCase()) + '</b><span>' + S.n + '</span></div></div>' +
        '<div class="ex-help">' + (matchMedia('(pointer: coarse)').matches ? '点地面走过去 · 靠近地点点「互动」' : '<kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> 走 · <kbd>Shift</kbd> 跑 · <kbd>E</kbd> 互动 · 也可以点地面') + '</div>' +
        '<button class="ex-act" data-key="e" data-tip="互动"></button>' +
        '<div class="p3-dialog"><div class="pd-name"></div><div class="pd-text"></div></div>';
      el.querySelector('.back').onclick = () => Home.open();
      run(el, id, S, p, resume || {});
    });
    Audio2.playMusic(S.music || 'quaint');
  }

  /* ---------- 共用：对话框 ---------- */
  function dialogBox(dlg) {
    return function dialog(who, text, voice) {
      if (!dlg || !dlg.isConnected) return;
      dlg.querySelector('.pd-name').textContent = who; const tx = dlg.querySelector('.pd-text'); tx.innerHTML = ''; dlg.classList.add('show');
      let i = 0; const t = String(text); const tick = () => { if (!dlg.isConnected) return; tx.textContent = t.slice(0, ++i); if (i < t.length) setTimeout(tick, 26); }; tick();
      if (voice !== false && Voice.has(t)) Voice.say(t);
      clearTimeout(dlg._t); dlg._t = setTimeout(() => dlg.classList.remove('show'), 2400 + t.length * 120);
    };
  }

  /* ---------- 共用：地点互动 ----------
     env: { dialog, heroOnce(n), petOnce(n), petGoto(s), petFollow(), sit(on), burst(s, emo, n), snap() → canvas, marks() } */
  function makeActs(id, S, p, env) {
    const used = s => !!p.hm.spots[id + ':' + s.id];
    const markUsed = s => { p.hm.spots[id + ':' + s.id] = 1; save(); env.marks && env.marks(); };
    async function interact(s) {
      const pet0 = p.pet, dialog = env.dialog;
      if (s.act === 'find') {
        env.petGoto(s); dialog(pet0.name, '这里有好东西！');
        await sleep(900); await env.petOnce('eat');
        if (used(s)) dialog(pet0.name, '什么也没找到，明天再来吧');
        else {
          markUsed(s); const g = Home.rollDrop('explore');
          if (g) { Home.dropToast(g, pet0.name); env.burst(s, '✨', 12); }
          else if (Math.random() < .55) { const f = R.pick(id === 'forest' ? ['🫐', '🍄'] : id === 'beach' ? ['🐟', '🍎'] : ['🍪', '🍎', '🥛']); p.inv.food[f] = (p.inv.food[f] || 0) + 1; save(); env.burst(s, f, 6); dialog(pet0.name, '我找到好东西啦！'); UI.toast('找到了 ' + E(f) + ' ' + (Home.foodInfo(f)[1] || '') + ' ×1'); }
          else { const c = R.int(6, 16); App.addCoins && App.addCoins(c); env.burst(s, '🪙', 8); UI.toast(E('🪙') + ' 找到 ' + c + ' 金币'); }
          pet0.joy = Math.min(100, pet0.joy + 5); App.petXP && App.petXP(3); save();
        }
        env.petFollow();
      } else if (s.act === 'shop') {
        const it = s.item; dialog(s.n, '欢迎光临！');
        const ok = await UI.confirm(E(it[0]) + ' ' + it[1] + '：' + it[2] + ' 金币，要买一个吗？<br><small>饱食 +' + it[3] + '　心情 +' + it[4] + '</small>');
        if (ok) { if (p.coins < it[2]) { UI.toast('金币不够哦'); Audio2.sfx('wrong', .4); } else { p.coins -= it[2]; p.inv.food[it[0]] = (p.inv.food[it[0]] || 0) + 1; save(); Audio2.sfx('coin', .6); env.burst(s, it[0], 5); UI.toast('买到了 ' + E(it[0]) + ' ' + it[1] + '，回家可以喂宠物'); } }
      } else if (s.act === 'wish') {
        dialog(s.n, '许个愿吧！'); const ok = await UI.confirm('投 5 枚金币许个愿？');
        if (ok) { if (p.coins < 5) UI.toast('金币不够哦'); else { p.coins -= 5; save(); Audio2.sfx('coin', .5); await env.heroOnce('attack'); env.burst(s, '✨', 10); const g = Math.random() < .25 ? Home.rollDrop('explore', true) : null; if (g) Home.dropToast(g, '许愿池'); else { const luck = R.pick(['大吉：今天答题一定很顺利！', '中吉：宠物今天特别开心！', '小吉：会遇到好朋友！', '吉：坚持就是胜利！']); dialog('许愿喷泉', luck, false); pet0.joy = Math.min(100, pet0.joy + 8); save(); } } }
      } else if (s.act === 'sit') {
        dialog(pet0.name, '坐下来休息一下吧'); env.sit(true); await sleep(2600); env.sit(false);
        if (!used(s)) { markUsed(s); pet0.bond = Math.min(100, (pet0.bond || 0) + 5); pet0.joy = Math.min(100, pet0.joy + 10); save(); env.burst(s, '💗', 8); UI.toast(E('💗') + ' 亲密度 +5'); }
      } else if (s.act === 'play' || s.act === 'pet') {
        dialog(pet0.name, '一起玩吧！'); env.petGoto(s); await sleep(800); await env.petOnce('dance'); env.burst(s, s.act === 'pet' ? '💗' : '⭐', 8); await env.heroOnce('wave'); env.petFollow();
        if (!used(s)) { markUsed(s); pet0.joy = Math.min(100, pet0.joy + 12); App.petXP && App.petXP(4); save(); }
      } else if (s.act === 'photo') {
        await env.heroOnce('wave'); photo(s); if (!used(s)) { markUsed(s); App.addCoins && App.addCoins(8); }
      } else if (s.act === 'quiz') {
        await quiz(s);
      }
    }
    // NPC 出题（按年级随机挑一道选择题）
    function quiz(s) {
      return new Promise(res => {
        if (used(s)) { env.dialog(s.npc, '今天的题目已经答过啦，明天再来吧！', false); return res(); }
        const q = Home.pickQ(); if (!q) return res();
        const m = UI.modal('<div class="npc-q"><div class="npc-h">' + E(s.npcE || '🧑') + '<div><b>' + s.npc + '</b><small>答对有奖励哦</small></div></div><div class="npc-body"></div></div>', { cls: 'wide p3m', onClose: () => res() });
        const body = m.el.querySelector('.npc-body'); const QP = Engines.qPanel(q); body.appendChild(QP.el);
        const grid = h('div', 'choices compact n' + q.ch.length); body.appendChild(grid); let done = false;
        q.ch.forEach(c => { const b = h('button', 'choice pop-in', Engines.choiceHTML(c, q.latinCh)); b.dataset.ok = c.ok ? 1 : 0; b.onclick = async () => {
          if (done) return; done = true; markUsed(s);
          if (c.ok) { b.classList.add('good'); Audio2.sfx('right', .5); Voice.say('答对啦！奖励给你！'); App.addCoins && App.addCoins(15, b); p.pet.bond = Math.min(100, (p.pet.bond || 0) + 3); save(); const g = Math.random() < .3 ? Home.rollDrop('explore', true) : null; if (g) setTimeout(() => Home.dropToast(g, s.npc), 600); }
          else { b.classList.add('bad'); grid.children[q.ch.findIndex(x => x.ok)].classList.add('reveal'); Audio2.sfx('wrong', .4); if (q.ex) Voice.say('正确答案：' + q.ex); else Voice.say('再想想哦，明天再来挑战吧'); }
          await sleep(1600); m.close();
        }; grid.appendChild(b); });
        hydrate(body); QP.speak();
      });
    }
    function photo(s) {
      const src = env.snap(), c = document.createElement('canvas'); c.width = 960; c.height = 720; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 960, 720);
      x.save(); x.beginPath(); x.rect(30, 30, 900, 580); x.clip(); const k = Math.max(900 / src.width, 580 / src.height); const dw = src.width * k, dh = src.height * k;
      x.drawImage(src, 30 + (900 - dw) / 2, 30 + (580 - dh) / 2, dw, dh); x.restore();
      x.fillStyle = '#e60012'; x.fillRect(30, 628, 900, 6); x.fillStyle = '#000'; x.font = "34px 'ZK', sans-serif"; x.textAlign = 'center'; x.fillText(S.n + ' · ' + s.n + ' · ' + new Date().toLocaleDateString(), 480, 680);
      const url = c.toDataURL('image/jpeg', .9); const fl = h('div', 'flash'); document.body.appendChild(fl); setTimeout(() => fl.remove(), 500); Audio2.sfx('pop', .6);
      UI.modal('<div class="p3-mh"><b>PHOTO</b><span>' + S.n + '</span></div><img class="polaroid" src="' + url + '"><div class="r-btns"><a class="btn" download="星星岛-' + S.n + '.jpg" href="' + url + '">保存照片</a></div>', { cls: 'wide p3m' });
      env.dialog('拍照', '咔嚓！拍得真好！');
    }
    return { interact, used, quiz };
  }

  /* ================= 2D 横版（不支持 WebGL 时） ================= */
  function run(el, id, S, p, resume) {
    const T = THREE, A = Avatar3D;
    const bg = el.querySelector('.ex-bg'), fg = el.querySelector('.ex-fg'), box = el.querySelector('.ex-3d'), marks = el.querySelector('.ex-marks'), actBtn = el.querySelector('.ex-act');
    let VW = 0, VH = 0, L = 0, layers = null, dead = false;
    const DPR = Math.min(devicePixelRatio, 1.5);
    const build = () => {
      const r = el.getBoundingClientRect(); VW = r.width; VH = r.height; const Hc = Math.round(Math.min(900, VH) * DPR), k = Hc / VH;
      L = VW * S.len;
      bg.width = fg.width = Math.round(VW * DPR); bg.height = fg.height = Math.round(VH * DPR);
      layers = { k, sky: Sketch.paintLayer(id, 'sky', Math.round(VW * k * 1.15), Hc), far: Sketch.paintLayer(id, 'far', Math.round((L * .4 + VW) * k), Hc), mid: Sketch.paintLayer(id, 'mid', Math.round(L * k), Hc), fore: Sketch.paintLayer(id, 'fore', Math.round((L * 1.25 + VW) * k), Hc) };
      drawMarks();
    };
    const rd = A && A.supported() ? new T.WebGLRenderer({ antialias: true, alpha: true }) : null;
    let sc, cam, hero = null, pet = null, petEmo = null; const actors = [];
    const U = () => VH / 7.2;
    if (rd) {
      rd.setPixelRatio(Math.min(devicePixelRatio, 2)); rd.outputColorSpace = T.SRGBColorSpace; box.appendChild(rd.domElement);
      sc = new T.Scene(); A.lightsFor(sc, 'p5', id === 'tower' ? .8 : 1);
      cam = new T.OrthographicCamera(-1, 1, 1, -1, -50, 50);
      const heroKey = App.heroModel ? App.heroModel(p) : null;
      if (heroKey) A.make(heroKey, { height: 1.7, style: 'p5', hat: p.equip.hat, wand: p.equip.wand }).then(av => { if (dead) return; hero = av; sc.add(av); actors.push(av); }).catch(() => {});
      const K = Home.dex(p.pet.kind), pm = Home.petModel(p.pet.kind);
      if (pm) A.make(pm, { height: K.h * 1.45, style: 'anime' }).then(av => { if (dead) return; pet = av; sc.add(av); actors.push(av); }).catch(() => {});
      else { const t = A.emojiTex(K.e); const sp = new T.Sprite(new T.SpriteMaterial({ map: t })); sp.center.set(.5, 0); sp.scale.set(K.h * 1.3, K.h * 1.3, 1); petEmo = new T.Group(); petEmo.add(sp); sc.add(petEmo); }
    }
    const st = { hx: resume.x || 160, px: (resume.x || 160) - 100, dir: 1, tgt: null, run: false, near: null, busy: false, petState: 'follow', petT: 0 };
    const keys = new Set();
    const kd = e => { if ($('#fx .modal-bg') || /INPUT/.test(e.target.tagName)) return; const k = e.key.toLowerCase(); if (['a', 'd', 'arrowleft', 'arrowright', 'shift'].includes(k)) { keys.add(k); st.tgt = null; e.preventDefault(); } };
    const ku = e => keys.delete(e.key.toLowerCase());
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    const camX = () => Math.max(0, Math.min(L - VW, st.hx - VW * .42));
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('button, .ex-mark, .p3-dialog, .choice')) return;
      st.tgt = camX() + e.clientX - el.getBoundingClientRect().left; st.run = Math.abs(st.tgt - st.hx) > VW * .35;
    });
    function drawMarks() {
      marks.innerHTML = S.spots.map(s => { const done = p.hm.spots[id + ':' + s.id]; return '<div class="ex-mark' + (done ? ' done' : '') + '" data-s="' + s.id + '"><i>' + E(s.e) + '</i><b>' + s.n + '</b></div>'; }).join('');
      hydrate(marks);
      $$('.ex-mark', marks).forEach(m => m.onclick = () => { const s = S.spots.find(x => x.id === m.dataset.s); st.tgt = s.x * L; st.run = Math.abs(st.tgt - st.hx) > VW * .35; st.autoAct = s.id; });
    }
    const k8 = () => VH / 800, ents = [], entBox = el.querySelector('.ex-ents');
    { const r0 = el.getBoundingClientRect(); VW = r0.width; VH = r0.height; L = VW * S.len; }
    const mkEnt = (o) => { const en = Object.assign({ x: o.x0, dir: Math.random() < .5 ? 1 : -1, t: 0, pause: 0 }, o); en.lab = h('div', 'ex-ent ' + o.type); entBox.appendChild(en.lab); ents.push(en);
      if (rd) A.make(o.model, { height: o.hgt, style: o.type === 'shadow' ? 'shadow' : 'p5', mask: o.type === 'shadow' }).then(av => { if (dead) return; en.av = av; av.position.z = -1.2; sc.add(av); actors.push(av); }).catch(() => {});
      return en; };
    Bond.NPCS.filter(N => N.scene === id).forEach(N => { const b = Bond.st(N.id), r = Bond.rankOf(b.pts); const en = mkEnt({ type: 'npc', npc: N, model: N.m, hgt: 1.7, x0: N.x * L }); en.lab.innerHTML = '<b>' + N.n + '</b><i>' + (b.known ? N.card + ' ' + r : '初次见面') + '</i>' + (p.hm.met[N.id] ? '' : '<em>!</em>'); });
    const SLOTS = [.3, .62, .86, .16].slice(0, S.lv >= 5 ? 3 : 2), defeated = p.hm.shd[id] || [];
    SLOTS.forEach((x, i) => { if (defeated.includes(i)) return; const kinds = Battle5.rollEnemies(S.lv, p.grade <= 1 ? 1 : R.int(1, 3)); const lead = Home.dex(kinds[0]); const en = mkEnt({ type: 'shadow', slot: i, kinds, model: Home.petModel(kinds[0]), hgt: lead.h * 1.5, x0: x * L }); en.lab.innerHTML = '<b>暗影</b><i>×' + kinds.length + '</i>'; });
    let fighting = false;
    function fight(en, adv) {
      if (fighting) return; fighting = true; st.busy = true; keys.clear();
      if (Bond.fx().first && adv === 'enemy' && Math.random() < .5) adv = null;
      const fl = h('div', 'p5-wipe'); document.body.appendChild(fl); Audio2.sfx('whoosh', .6);
      setTimeout(() => {
        fl.remove();
        Battle5.start({ kinds: en.kinds, lv: S.lv, adv, scene: id, onEnd: r => {
          if (r.win) { p.hm.shd[id] = (p.hm.shd[id] || []).concat([en.slot]); save(); }
          if (r.lose) return Home.open();
          go(id, { x: st.hx + (r.run ? -180 : 0) });
        } });
      }, 650);
    }
    function entTick(dt) {
      const k = k8();
      ents.forEach(en => {
        if (en.gone) return;
        const d = st.hx - en.x, ad = Math.abs(d); let mv = 0;
        if (en.type === 'shadow') {
          if (!st.busy && !fighting && ad < 330 * k) en.chase = true;
          if (en.chase && !st.busy && !fighting) { mv = Math.sign(d); en.x += mv * 170 * k * dt; if (ad < 50 * k) { const toward = Math.sign(en.x - st.hx) === st.moveDir; fight(en, toward ? 'player' : 'enemy'); } if (ad > 600 * k) en.chase = false; }
          else { if (Math.abs(en.x - en.x0) > 150 * k) en.dir = Math.sign(en.x0 - en.x); mv = en.dir; en.x += mv * 55 * k * dt; }
          en.lab.classList.toggle('alert', !!en.chase);
        } else {
          en.t -= dt; if (en.t <= 0) { en.pause = Math.random() < .45; en.dir = Math.random() < .5 ? 1 : -1; en.t = 2 + Math.random() * 3; }
          if (ad < 140 * k) { en.pause = true; en.face = Math.sign(d); }
          if (!en.pause) { if (Math.abs(en.x + en.dir * 40 * k * dt - en.x0) > 160 * k) en.dir *= -1; mv = en.dir; en.x += mv * 45 * k * dt; }
        }
        if (en.av) { en.av.play(mv ? (en.chase ? 'run' : 'walk') : 'idle'); const face = mv || en.face || 1; en.av.position.x = (en.x - camX() - VW / 2) / U(); en.av.rotation.y = face > 0 ? 1.15 : -1.15; }
        const x = en.x - camX(); en.lab.style.transform = 'translate(' + x + 'px,' + (VH * .8 - U() * (en.hgt + .5)) + 'px) translate(-50%,-100%)'; en.lab.style.display = x < -80 || x > VW + 80 ? 'none' : '';
      });
    }
    const nearEnt = () => { const k = k8(); let best = null, bd = 1e9; ents.forEach(en => { if (en.gone) return; const ad = Math.abs(en.x - st.hx), lim = (en.type === 'shadow' ? 150 : 100) * k + 20; if (ad < lim && ad < bd) { bd = ad; best = en; } }); return best; };
    function entAct(en) { if (en.type === 'shadow') return fight(en, 'player'); st.busy = true; keys.clear(); Bond.meet(en.npc.id).then(() => { st.busy = false; const b = Bond.st(en.npc.id); en.lab.innerHTML = '<b>' + en.npc.n + '</b><i>' + en.npc.card + ' ' + Bond.rankOf(b.pts) + '</i>'; }); }
    ents.forEach(en => { en.lab.onclick = () => { st.tgt = en.x - (en.x > st.hx ? 60 : -60) * k8(); st.run = true; st.autoEnt = en; }; });
    actBtn.onclick = () => { if (st.busy) return; if (st.near && st.near.type) return entAct(st.near); if (st.near) interact(st.near); };

    const parts = [];
    const spawnPart = () => {
      if (S.fireflies || id === 'tower') parts.push({ x: Math.random() * VW, y: VH * (.3 + Math.random() * .6), vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 14, life: 4 + Math.random() * 4, t: 0, c: id === 'tower' ? '#b6ff6a' : '#d8ffa0', r: 2 + Math.random() * 2 });
      else if (id === 'beach') parts.push({ x: Math.random() * VW, y: VH * (.55 + Math.random() * .2), vx: 0, vy: 0, life: 1.5, t: 0, c: '#ffffff', r: 1.5, tw: 1 });
      else if (id === 'town') { if (Math.random() < .3) parts.push({ x: Math.random() * VW, y: -10, vx: 20 + Math.random() * 20, vy: 30 + Math.random() * 20, life: 12, t: 0, c: '#ffc8dc', r: 3, petal: 1 }); }
      else if (id === 'city') parts.push({ x: Math.random() * VW, y: VH * Math.random() * .6, vx: 0, vy: 0, life: 1, t: 0, c: R.pick(['#3fd0ff', '#ff5fa8', '#ffe35f']), r: 1.5, tw: 1 });
    };

    const dialog = dialogBox(el.querySelector('.p3-dialog'));
    async function hopEmo() { if (!petEmo) return; for (let i = 0; i <= 12; i++) { petEmo.position.y = Math.sin(i / 12 * Math.PI) * .5; await sleep(28); } petEmo.position.y = 0; }
    const ACTS = makeActs(id, S, p, {
      dialog, marks: drawMarks,
      heroOnce: n => hero ? hero.once(n) : sleep(600),
      petOnce: n => pet ? pet.once(n === 'dance' && !pet.has('dance') ? 'jump' : n) : hopEmo(),
      petGoto: s => { st.petState = 'goto'; st.petGoal = s.x * L; }, petFollow: () => { st.petState = 'follow'; },
      sit: on => { if (hero) hero.play(on ? 'sit' : 'idle'); if (pet) pet.play(on && pet.has('sit') ? 'sit' : 'idle'); },
      burst: (s, emo, n) => { const r = el.getBoundingClientRect(); UI.burst(r.left + s.x * L - camX(), r.top + VH * .8 - U() * 1.2, emo, n || 7); },
      snap: () => { const c = document.createElement('canvas'); c.width = bg.width; c.height = bg.height; const x = c.getContext('2d'); x.drawImage(bg, 0, 0); if (rd) { render(); x.drawImage(rd.domElement, 0, 0, c.width, c.height); } x.drawImage(fg, 0, 0); return c; },
    });
    async function interact(s) {
      if (st.busy) return; st.busy = true; st.tgt = null; keys.clear(); st.dir = s.x * L >= st.hx ? 1 : -1;
      try { await ACTS.interact(s); } finally { st.busy = false; }
    }

    let last = performance.now(), raf = 0, partT = 0;
    const fit = () => { build(); if (rd) { rd.setSize(VW, VH); const u = U(); cam.left = -VW / 2 / u; cam.right = VW / 2 / u; cam.top = VH * .8 / u; cam.bottom = -VH * .2 / u; cam.position.set(0, 0, 10); cam.updateProjectionMatrix(); } };
    fit(); addEventListener('resize', fit);
    function render() {
      if (!rd) return; const cx = camX(), u = U();
      const put = (o, wx, face) => { if (!o) return; o.position.x = (wx - cx - VW / 2) / u; o.rotation.y = face; };
      put(hero, st.hx, st.dir > 0 ? 1.15 : -1.15); put(pet || petEmo, st.px, st.pdir > 0 ? 1.15 : -1.15);
      if (petEmo) petEmo.rotation.y = 0;
      A.setViewport(rd.domElement.width, rd.domElement.height); A.outlineU.uOl.value = 2 / Math.max(1, rd.domElement.height) * Math.min(devicePixelRatio, 2) * 1.1;
      rd.render(sc, cam);
    }
    function loop() {
      if (dead) return; if (!el.isConnected) return dispose(); raf = requestAnimationFrame(loop);
      const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
      let mv = 0; if (!st.busy) { if (keys.has('a') || keys.has('arrowleft')) mv -= 1; if (keys.has('d') || keys.has('arrowright')) mv += 1; }
      let running = keys.has('shift');
      if (!mv && st.tgt != null && !st.busy) { const d = st.tgt - st.hx; if (Math.abs(d) < 8) { st.tgt = null; if (st.autoAct) { const s = S.spots.find(x => x.id === st.autoAct); st.autoAct = null; if (s) interact(s); } } else { mv = Math.sign(d); running = st.run; } }
      const sp = (running ? 520 : 240) * (VH / 800);
      st.moveDir = mv; if (mv) { st.dir = mv; st.hx = Math.max(60, Math.min(L - 60, st.hx + mv * sp * dt)); }
      if (st.autoEnt && st.tgt == null && !st.busy) { const en = st.autoEnt; st.autoEnt = null; st.dir = Math.sign(en.x - st.hx) || st.dir; entAct(en); }
      if (hero && !st.busy) hero.play(mv ? (running ? 'run' : 'walk') : (hero.curName === 'sit' ? 'sit' : 'idle'));
      const goal = st.petState === 'goto' ? st.petGoal : st.hx - st.dir * 90 * (VH / 800);
      const pd = goal - st.px; let pmv = 0;
      if (Math.abs(pd) > 14) { pmv = Math.sign(pd); st.pdir = pmv; const psp = Math.min(Math.abs(pd) * 3, 600 * (VH / 800)); st.px += pmv * Math.max(120 * (VH / 800), psp) * dt; }
      if (pet && !pet.curName?.match(/eat|jump|dance|wave|yes|sit|attack|hit/)) pet.play(pmv ? (Math.abs(pd) > 160 ? 'run' : 'walk') : 'idle');
      else if (pet && pmv && pet.cur && !pet.cur.isRunning()) pet.play('walk');
      if (petEmo) petEmo.children[0].position.y = pmv ? Math.abs(Math.sin(now / 120)) * .15 : 0;
      st.petT += dt; if (st.petT > 9 && !st.busy && !mv && st.petState === 'follow') { st.petT = 0; if (pet) pet.once(R.pick(['idle2', 'eat', 'jump', 'yes'].filter(n => pet.has(n))) || 'idle'); }
      actors.forEach(a => a.update(dt));
      entTick(dt);
      let near = nearEnt(); if (!near) S.spots.forEach(s => { if (Math.abs(s.x * L - st.hx) < 90 * (VH / 800) + 30) near = s; });
      if (near !== st.near) { st.near = near; actBtn.classList.toggle('show', !!near); if (near && near.type) { actBtn.innerHTML = near.type === 'shadow' ? E('⚔️') + '<b>突袭暗影</b><small>先下手为强！</small>' : E('💬') + '<b>' + near.npc.n + '</b><small>聊天</small>'; hydrate(actBtn); actBtn.classList.toggle('danger', near.type === 'shadow'); } else if (near) { actBtn.classList.remove('danger'); actBtn.innerHTML = E(near.e) + '<b>' + near.n + '</b><small>' + ACT_N[near.act] + '</small>'; hydrate(actBtn); } }
      const cx = camX(), k = layers.k, d = DPR, ctx = bg.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, bg.width, bg.height);
      ctx.drawImage(layers.sky, cx * .03 * k, 0, VW * k, layers.sky.height, 0, 0, bg.width, bg.height);
      ctx.drawImage(layers.far, cx * .4 * k, 0, VW * k, layers.far.height, 0, 0, bg.width, bg.height);
      ctx.drawImage(layers.mid, cx * k, 0, VW * k, layers.mid.height, 0, 0, bg.width, bg.height);
      ctx.fillStyle = 'rgba(5,10,40,.28)'; [[st.hx, 34], [st.px, 22]].forEach(([wx, r]) => { ctx.beginPath(); ctx.ellipse((wx - cx) * d, VH * .8 * d + 2, r * d * (VH / 800), r * .28 * d * (VH / 800), 0, 0, 7); ctx.fill(); });
      const fx = fg.getContext('2d'); fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fg.width, fg.height);
      fx.drawImage(layers.fore, cx * 1.25 * k, 0, VW * k, layers.fore.height, 0, 0, fg.width, fg.height);
      partT += dt; if (partT > .12) { partT = 0; if (parts.length < 60) spawnPart(); }
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t += dt; if (q.t > q.life) { parts.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; if (q.petal) q.x += Math.sin(q.t * 2) * .6; const a = q.tw ? Math.sin(q.t / q.life * Math.PI) : Math.min(1, q.t, q.life - q.t); fx.globalAlpha = Math.max(0, a); fx.fillStyle = q.c; if (!q.petal && !q.tw) { fx.shadowColor = q.c; fx.shadowBlur = 10; } fx.beginPath(); fx.arc(q.x * d, q.y * d, q.r * d, 0, 7); fx.fill(); fx.shadowBlur = 0; }
      fx.globalAlpha = 1;
      $$('.ex-mark', marks).forEach(m => { const s = S.spots.find(x => x.id === m.dataset.s); const x = s.x * L - cx; m.style.transform = 'translate(' + x + 'px,' + (VH * .8 - U() * 2.7) + 'px) translate(-50%,-100%)'; m.classList.toggle('near', s === st.near); m.style.display = x < -80 || x > VW + 80 ? 'none' : ''; });
      render();
    }
    loop();
    function dispose() { if (dead) return; dead = true; cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keydown', kd); removeEventListener('keyup', ku); if (rd) { try { rd.dispose(); rd.forceContextLoss(); } catch (e) {} } }
    Core.onLeave(dispose);
    setTimeout(() => dialog(p.pet.name, '一起出去走走吧！'), 600);
  }

  window.Explore = { pick, go, makeActs, dialogBox, party, ACT_N };
})();
