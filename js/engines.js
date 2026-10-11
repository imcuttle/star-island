/* 小游戏引擎：同一题库可套用不同玩法 */
(function () {
  const { h, sleep, E, vis, hydrate, clockSVG, UI, Audio2, Voice, esc } = Core;
  const R = CONTENT.R;
  const PRAISE = ['太棒了！', '答对啦！', '真聪明！', '你真厉害！', '完全正确！', '好样的！'];
  const OOPS = ['再想想哦', '没关系，继续加油'];
  const isKid = () => Core.theme() === 'kid';

  // 主题相关精灵：童趣版用 Kenney 卡通，进阶版用 3D 表情
  const SP = {
    fish(i) { return isKid() ? '<img class="spr" src="assets/img/enemy/' + ['fish_blue_swim_a', 'fish_yellow_swim_a', 'fish_purple_rest'][i % 3] + '.png">' : E(['🐠', '🐟', '🐡', '🦈'][i % 4]); },
    ufo(i) { return isKid() ? '<img class="spr" src="assets/img/ship/' + ['shipPink_manned', 'shipGreen_manned', 'shipBlue_manned', 'shipYellow_manned', 'shipBeige_manned'][i % 5] + '.png">' : E('🛸'); },
    mole(i) { return isKid() ? '<img class="spr" src="assets/img/char/character_' + ['green', 'pink', 'purple', 'yellow', 'beige'][i % 5] + '_front.png">' : E(['🐹', '🦫', '🐭', '🦔'][i % 4]); },
    frog() { return isKid() ? '<img class="spr" src="assets/img/enemy/frog_idle.png">' : E('🐸'); },
    frogJump() { return isKid() ? '<img class="spr" src="assets/img/enemy/frog_jump.png">' : E('🐸'); },
    monster() { return isKid() ? '<img class="spr" src="assets/img/enemy/slime_normal_rest.png">' : E('👾'); },
    car(me) { return E(me ? '🏎️' : '🚙'); },
  };

  /* ---------- 题目面板 ---------- */
  let curQ = null; // 当前题目：听音题不给选项配朗读（否则直接泄露答案）
  // 依次朗读页面上的全部选项，并高亮正在读的那一个；被其他语音打断就停
  async function readChoices(root) {
    const cs = $$('.csay', root || document).filter(c => c.isConnected);
    for (const c of cs) {
      if (!c.isConnected) return;
      const host = c.parentElement; host.classList.add('reading');
      const pr = Voice.say(c.dataset.say, c.dataset.l), tok = Voice.tok; await pr;
      host.classList.remove('reading'); if (Voice.tok !== tok) return; await sleep(160); if (Voice.tok !== tok) return;
    }
  }
  function qPanel(q) {
    curQ = q;
    const p = h('div', 'qpanel' + (q.small ? ' small' : ''));
    let visual = '';
    if (q.listen) visual = '<button class="bigspeaker" data-key="r" data-tip="再听一遍">' + E('🔊') + '</button>';
    else if (q.pe) visual = '<div class="qvis">' + vis(q.pe, 'qemo') + '</div>';
    if (q.pt && !q.listen) visual += '<div class="qbig ' + (q.latin ? 'latin' : '') + '">' + esc(q.pt) + '</div>';
    const canRead = !q.listen && q.ch && q.ch.some(c => c.s);
    p.innerHTML = '<div class="qtext">' + esc(q.p) + ' <button class="say" data-key="q" data-tip="读题目">' + E('🔊') + '</button>' + (canRead ? '<button class="sayall" data-key="e" data-tip="读选项">' + E('👂') + '<small>读选项</small></button>' : '') + '</div><div class="qmain">' + visual + '</div>';
    hydrate(p);
    // 学前 / 一年级：读完题目自动把选项也读一遍（选项全是图片时不用读）
    const autoRead = () => { const pp = Core.Store.p; return canRead && pp && pp.grade <= 1 && Core.ReadAloud.on() && q.ch.some(c => c.t && !c.e); };
    const speak = () => { const pr = Voice.say(q.ps || q.p, q.psl || 'zh'), tok = Voice.tok; if (autoRead()) pr.then(() => { if (Voice.tok === tok && p.isConnected) readChoices(p.parentElement); }); return pr; };
    p.querySelector('.say').onclick = speak;
    const sa = p.querySelector('.sayall'); if (sa) sa.onclick = () => readChoices(p.parentElement);
    const bs = p.querySelector('.bigspeaker'); if (bs) bs.onclick = () => Voice.say(q.listen, q.psl || 'zh');
    return { el: p, speak };
  }
  function choiceHTML(c, latin) {
    const sayT = c.s || '', speaker = sayT && !(curQ && curQ.listen) ? '<span class="csay" data-say="' + esc(sayT) + '" data-l="' + (c.l || 'zh') + '" aria-label="朗读">' + E('🔊') + '</span>' : '';
    return (c.e ? '<div class="cvis">' + vis(c.e, 'cemo') + '</div>' : '') + (c.t ? '<div class="ctxt ' + (latin ? 'latin' : '') + (c.t.length > 6 ? ' long' : '') + (c.t.length > 12 ? ' xlong' : '') + '">' + esc(c.t) + '</div>' : '') + (c.sub ? '<div class="csub">' + esc(c.sub) + '</div>' : '') + speaker;
  }

  /* ---------- 会话 ---------- */
  class Session {
    constructor(game, data, grade, root, onEnd) {
      Object.assign(this, { game, data, grade, root, onEnd }); curQ = null;
      this.right = 0; this.wrong = 0; this.total = 0; this.combo = 0; this.maxCombo = 0;
      const gfx = window.Home ? Home.gearFx() : {}; this.gfx = gfx;
      this.hearts = 3 + (Core.Store.p && Core.Store.p.equip.cape ? 1 : 0) + (gfx.heart || 0); this.over = false; this.wrongs = [];
      this.shield = gfx.shield || 0; this.heal = gfx.potion || 0; this.eye = gfx.eye || 0;
    }
    setProgress(i, n) { this.root.querySelector('.gprog').innerHTML = Array.from({ length: n }, (_, k) => '<i class="' + (k < i ? 'done' : k === i ? 'cur' : '') + '"></i>').join(''); }
    renderHearts() { this.root.querySelector('.ghearts').innerHTML = Array.from({ length: this.hearts }, () => E('❤️', 'heart')).join('') || ''; }
    async good(el, q) {
      this.right++; this.total++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      Audio2.sfx('right', .5);
      if (el) { const r = el.getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top + r.height / 2, '⭐', 7); el.classList.add('good'); }
      if (this.combo >= 3 && this.combo % 3 === 0) { this.comboFx(); }
      const say = q && q.ex ? q.ex : (Math.random() < .55 ? R.pick(PRAISE) : null);
      if (say) await Voice.say(say); else await sleep(450);
    }
    async bad(el, q, correctEl) {
      this.wrong++; this.total++; this.combo = 0; Audio2.sfx('wrong', .5);
      if (q) this.wrongs.push(q.p + (q.ch ? ' → ' + (q.ch.find(c => c.ok) || {}).t : ''));
      if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake', 'bad'); }
      if (correctEl) correctEl.classList.add('reveal');
      if (this.shield > 0) { this.shield--; UI.toast(Core.E('🛡️') + ' 守护之盾：这次不扣心！', 1200); }
      else {
        this.hearts--; if (this.hearts === 1 && this.heal > 0) { this.hearts += this.heal; this.heal = 0; Audio2.sfx('magic', .5); UI.toast(Core.E('⛲') + ' 治愈之泉回复了生命！', 1400); }
        this.renderHearts();
        const hp = this.root.querySelector('.ghearts'); hp.classList.remove('hit'); void hp.offsetWidth; hp.classList.add('hit');
      }
      if (q && q.ex) await Voice.say('正确答案：' + q.ex); else await Voice.say(R.pick(OOPS));
      await sleep(300);
      if (this.hearts <= 0) { this.end(true); return false; }
      return true;
    }
    comboFx() { const c = h('div', 'combo', '连对 ×' + this.combo + '！'); this.root.appendChild(c); Audio2.sfx('magic', .4); setTimeout(() => c.remove(), 1300); }
    end(failed, forceStars) {
      if (this.over) return; this.over = true; Voice.stop();
      const acc = this.total ? this.right / this.total : 0;
      let stars = failed ? 0 : forceStars || (acc >= .9 ? 3 : acc >= .7 ? 2 : 1);
      this.onEnd({ stars, right: this.right, wrong: this.wrong, failed: !!failed, maxCombo: this.maxCombo, wrongs: this.wrongs });
    }
  }

  // 依次处理选择题，renderer(q, i) 返回 Promise<{ok, el, correctEl}>
  async function runQs(S, qs, renderer, after) {
    for (let i = 0; i < qs.length; i++) {
      if (S.over) return;
      S.setProgress(i, qs.length);
      const q = qs[i];
      const pr = renderer(q, i);
      if (S.eye > 0 && q && q.ch && q.ch.length > 2) { S.eye--; setTimeout(() => { const ws = $$('[data-ok="0"]:not(.hinted)', S.stage); if (ws.length) { R.pick(ws).classList.add('hinted'); } }, 350); }
      const res = await pr;
      if (S.over) return;
      if (res.ok) await S.good(res.el, q); else { const cont = await S.bad(res.el, q, res.correctEl); if (!cont) return; }
      if (after) await after(res, q, i);
    }
    S.setProgress(qs.length, qs.length);
    await sleep(300); S.end(false);
  }

  /* ---------- 1. 卡片选择 quiz / tf ---------- */
  function quiz(S, qs, opt) {
    const st = S.stage; opt = opt || {};
    return runQs(S, qs, q => new Promise(res => {
      st.innerHTML = '';
      const P = qPanel(q); st.appendChild(P.el);
      const grid = h('div', 'choices n' + q.ch.length + (q.tf ? ' tf' : '') + (q.wide ? ' wide' : ''));
      let timer;
      if (opt.timer) { const bar = h('div', 'timer', '<i></i>'); st.appendChild(bar); bar.firstChild.style.animationDuration = opt.timer + 's'; timer = setTimeout(() => finish(-1), opt.timer * 1000 + 300); }
      q.ch.forEach((c, k) => {
        const b = h('button', 'choice pop-in', choiceHTML(c, q.latinCh)); b.style.animationDelay = k * 70 + 'ms';
        b.dataset.ok = c.ok ? 1 : 0; b.onclick = () => finish(k, b);
        grid.appendChild(b);
      });
      hydrate(grid); st.appendChild(grid); P.speak();
      let done = false;
      function finish(k, b) {
        if (done) return; done = true; clearTimeout(timer);
        const ci = q.ch.findIndex(c => c.ok), cEl = grid.children[ci];
        if (b && q.ch[k].s && !q.ch[k].ok) Voice.say(q.ch[k].s, q.ch[k].l);
        res({ ok: k === ci, el: b || null, correctEl: cEl });
      }
    }), async () => sleep(250));
  }

  /* ---------- 2. 漂浮物：泡泡 / 气球 / 飞碟 ---------- */
  function floaters(S, qs, skin) {
    const st = S.stage;
    return runQs(S, qs, q => new Promise(res => {
      st.innerHTML = ''; st.className = 'stage scene-' + skin;
      const P = qPanel(q); st.appendChild(P.el);
      const field = h('div', 'field'); st.appendChild(field);
      let done = false, tries = 0;
      const cols = R.shuffle([0, 1, 2, 3, 4].slice(0, Math.max(q.ch.length, 3)));
      q.ch.forEach((c, k) => {
        const f = h('div', 'floater fl-' + skin);
        const inner = skin === 'ufo' ? '<div class="ship">' + SP.ufo(k) + '</div><div class="flabel">' + choiceHTML(c, q.latinCh) + '</div>'
          : skin === 'balloon' ? '<div class="bal" style="--hue:' + (k * 83 + 10) + '">' + choiceHTML(c, q.latinCh) + '</div><div class="string"></div>'
          : '<div class="bub">' + choiceHTML(c, q.latinCh) + '</div>';
        f.innerHTML = inner; f.dataset.ok = c.ok ? 1 : 0;
        const n = q.ch.length; f.style.left = (6 + cols[k] * (88 / n)) + '%';
        f.style.animationDuration = (skin === 'ufo' ? 7 : 9) + R.int(0, 30) / 10 + 's'; f.style.animationDelay = (-R.int(0, 40) / 10) + 's';
        f.onpointerdown = (e) => {
          if (done || f.classList.contains('popped')) return;
          const ok = c.ok;
          if (skin === 'ufo') laser(st, f);
          if (ok) { done = true; f.classList.add('popped'); Audio2.sfx(skin === 'ufo' ? 'hit' : 'pop', .6); res({ ok: true, el: f }); }
          else { tries++; Audio2.sfx('bump', .5); f.classList.add('popped', 'wrongpop'); if (c.s) Voice.say(c.s, c.l); done = true; res({ ok: false, el: f, correctEl: field.children[q.ch.findIndex(x => x.ok)] }); }
        };
        field.appendChild(f);
      });
      hydrate(field); P.speak();
    }), () => sleep(500));
  }
  function laser(st, target) {
    const r = target.getBoundingClientRect(), s = st.getBoundingClientRect();
    const l = h('div', 'laser'); const x0 = s.width / 2, y0 = s.height, x1 = r.left - s.left + r.width / 2, y1 = r.top - s.top + r.height / 2;
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
    Object.assign(l.style, { left: x0 + 'px', top: y0 + 'px', width: len + 'px', transform: 'rotate(' + ang + 'deg)' });
    st.appendChild(l); Audio2.sfx('throw', .4); setTimeout(() => l.remove(), 350);
  }

  /* ---------- 3. 打地鼠 ---------- */
  function whack(S, qs) {
    const st = S.stage;
    return runQs(S, qs, q => new Promise(res => {
      st.innerHTML = ''; st.className = 'stage scene-whack';
      const P = qPanel(q); st.appendChild(P.el);
      const grid = h('div', 'holes'); st.appendChild(grid);
      const holes = []; for (let i = 0; i < 6; i++) { const ho = h('div', 'hole', '<div class="mole"></div><div class="dirt"></div>'); grid.appendChild(ho); holes.push(ho); }
      let done = false, tick;
      const show = () => {
        if (done) return;
        const pos = R.sample([0, 1, 2, 3, 4, 5], q.ch.length);
        holes.forEach(ho => { ho.classList.remove('up'); delete ho.dataset.ok; });
        setTimeout(() => {
          if (done) return;
          q.ch.forEach((c, k) => { const ho = holes[pos[k]]; const m = ho.querySelector('.mole'); m.innerHTML = '<div class="sign">' + choiceHTML(c, q.latinCh) + '</div><div class="mspr">' + SP.mole(k) + '</div>'; hydrate(m); m.dataset.k = k; ho.dataset.ok = c.ok ? 1 : 0; ho.classList.add('up'); });
        }, 260);
        tick = setTimeout(show, 3600);
      };
      holes.forEach(ho => ho.onpointerdown = () => {
        if (done || !ho.classList.contains('up')) return;
        const k = +ho.querySelector('.mole').dataset.k, c = q.ch[k]; done = true; clearTimeout(tick);
        ho.classList.add('bonk'); Audio2.sfx('bump', .6);
        if (!c.ok && c.s) Voice.say(c.s, c.l);
        const ci = q.ch.findIndex(x => x.ok); const cHole = holes.find(x => x.classList.contains('up') && +x.querySelector('.mole').dataset.k === ci);
        res({ ok: c.ok, el: ho, correctEl: cHole });
      });
      show(); P.speak();
    }), () => sleep(450));
  }

  /* ---------- 4. 钓鱼 ---------- */
  function fish(S, qs) {
    const st = S.stage;
    return runQs(S, qs, q => new Promise(res => {
      st.innerHTML = ''; st.className = 'stage scene-sea';
      const P = qPanel(q); st.appendChild(P.el);
      const sea = h('div', 'sea', '<div class="rod"></div><div class="line"></div><div class="waves"></div>'); st.appendChild(sea);
      let done = false;
      q.ch.forEach((c, k) => {
        const f = h('div', 'fish ' + (k % 2 ? 'rtl' : 'ltr'), '<div class="fspr">' + SP.fish(k) + '</div><div class="flabel">' + choiceHTML(c, q.latinCh) + '</div>');
        f.dataset.ok = c.ok ? 1 : 0; f.style.top = (12 + k * (78 / q.ch.length)) + '%'; f.style.animationDuration = (8 + R.int(0, 40) / 10) + 's'; f.style.animationDelay = (-R.int(0, 60) / 10) + 's';
        f.onpointerdown = () => {
          if (done) return; done = true;
          const line = sea.querySelector('.line'); const r = f.getBoundingClientRect(), s = sea.getBoundingClientRect();
          line.style.left = (r.left - s.left + r.width / 2) + 'px'; line.style.height = (r.top - s.top + 20) + 'px'; line.classList.add('drop');
          f.style.animationPlayState = 'paused'; Audio2.sfx('drop', .5);
          setTimeout(() => {
            if (c.ok) { f.classList.add('caught'); Audio2.sfx('pluck', .6); } else { f.classList.add('escape'); if (c.s) Voice.say(c.s, c.l); }
            res({ ok: c.ok, el: f, correctEl: sea.querySelectorAll('.fish')[q.ch.findIndex(x => x.ok)] });
          }, 420);
        };
        sea.appendChild(f);
      });
      hydrate(sea); P.speak();
    }), () => sleep(500));
  }

  /* ---------- 5. 青蛙跳荷叶 ---------- */
  function frog(S, qs) {
    const st = S.stage;
    let frogEl;
    return runQs(S, qs, q => new Promise(res => {
      st.innerHTML = ''; st.className = 'stage scene-pond';
      const P = qPanel(q); st.appendChild(P.el);
      const pond = h('div', 'pond'); st.appendChild(pond);
      const pads = h('div', 'pads'); pond.appendChild(pads);
      frogEl = h('div', 'frog', SP.frog()); pond.appendChild(frogEl);
      let done = false;
      q.ch.forEach((c, k) => {
        const p = h('div', 'pad pop-in', '<div class="leaf"></div><div class="plabel">' + choiceHTML(c, q.latinCh) + '</div>'); p.style.animationDelay = k * 80 + 'ms'; p.dataset.ok = c.ok ? 1 : 0;
        p.onpointerdown = () => {
          if (done) return; done = true;
          const r = p.getBoundingClientRect(), s = pond.getBoundingClientRect(), fr = frogEl.getBoundingClientRect();
          frogEl.innerHTML = SP.frogJump(); frogEl.classList.add('jumping'); Audio2.sfx('jump', .5);
          frogEl.style.transform = 'translate(' + (r.left - fr.left + r.width / 2 - fr.width / 2) + 'px,' + (r.top - fr.top + r.height / 2 - fr.height / 2 - 20) + 'px)';
          setTimeout(() => {
            frogEl.innerHTML = SP.frog();
            if (!c.ok) { p.classList.add('sink'); frogEl.classList.add('splash'); Audio2.sfx('drop', .6); if (c.s) Voice.say(c.s, c.l); }
            res({ ok: c.ok, el: p, correctEl: pads.children[q.ch.findIndex(x => x.ok)] });
          }, 560);
        };
        pads.appendChild(p);
      });
      hydrate(pond); P.speak();
    }), () => sleep(450));
  }

  /* ---------- 6. 宝箱 ---------- */
  function chest(S, qs) {
    const st = S.stage;
    return runQs(S, qs, q => new Promise(res => {
      st.innerHTML = ''; st.className = 'stage scene-cave';
      const P = qPanel(q); st.appendChild(P.el);
      const row = h('div', 'chests n' + q.ch.length); st.appendChild(row);
      let done = false;
      q.ch.forEach((c, k) => {
        const b = h('div', 'chest pop-in', '<div class="ch-lid"></div><div class="ch-body"></div><div class="ch-out"></div><div class="clabel">' + choiceHTML(c, q.latinCh) + '</div>');
        b.style.animationDelay = k * 90 + 'ms'; b.dataset.ok = c.ok ? 1 : 0;
        b.onclick = () => {
          if (done) return; done = true; b.classList.add('open');
          b.querySelector('.ch-out').innerHTML = c.ok ? E('💎') : E('💨');
          Audio2.sfx(c.ok ? 'gem' : 'poof', .6); if (!c.ok && c.s) Voice.say(c.s, c.l);
          res({ ok: c.ok, el: b, correctEl: row.children[q.ch.findIndex(x => x.ok)] });
        };
        row.appendChild(b);
      });
      hydrate(row); P.speak();
    }), () => sleep(600));
  }

  /* ---------- 7. 赛车 ---------- */
  function race(S, qs) {
    const st = S.stage; st.className = 'stage scene-race';
    let me = 0, rival = 0; const n = qs.length;
    const track = h('div', 'track', '<div class="lane"><div class="car me">' + SP.car(true) + '</div></div><div class="lane"><div class="car rival">' + SP.car(false) + '</div></div><div class="finish">🏁</div>');
    const rivalTimer = setInterval(() => { if (S.over) return clearInterval(rivalTimer); rival = Math.min(n, rival + .045); upd(); }, 300);
    function upd() { track.querySelector('.me').style.left = (me / n * 86) + '%'; track.querySelector('.rival').style.left = (rival / n * 86) + '%'; }
    return runQs(S, qs, q => new Promise(res => {
      st.innerHTML = ''; st.appendChild(track); hydrate(track);
      const P = qPanel(q); st.appendChild(P.el);
      const grid = h('div', 'choices n' + q.ch.length + ' compact'); st.appendChild(grid);
      let done = false;
      q.ch.forEach((c, k) => { const b = h('button', 'choice pop-in', choiceHTML(c, q.latinCh)); b.dataset.ok = c.ok ? 1 : 0; b.onclick = () => { if (done) return; done = true; if (!c.ok && c.s) Voice.say(c.s, c.l); res({ ok: c.ok, el: b, correctEl: grid.children[q.ch.findIndex(x => x.ok)] }); }; grid.appendChild(b); });
      hydrate(grid); P.speak();
    }), async (r) => { if (r.ok) { me++; Audio2.sfx('whoosh', .4); track.querySelector('.me').classList.add('boost'); setTimeout(() => track.querySelector('.me').classList.remove('boost'), 600); } upd(); await sleep(350); }).finally(() => clearInterval(rivalTimer));
  }

  /* ---------- 8. 喂怪兽（拖拽或点击） ---------- */
  function feed(S, qs) {
    const st = S.stage;
    return runQs(S, qs, q => new Promise(res => {
      st.innerHTML = ''; st.className = 'stage scene-feed';
      const P = qPanel(q); st.appendChild(P.el);
      const area = h('div', 'feedarea'); st.appendChild(area);
      const mon = h('div', 'monster drop', '<div class="mbody">' + SP.monster() + '</div><div class="mouth"></div><div class="mhint">拖给我吃！</div>'); area.appendChild(mon);
      const plate = h('div', 'plate'); area.appendChild(plate);
      let done = false;
      const pick = (c, el) => {
        if (done) return; done = true;
        if (c.ok) { el.classList.add('eaten'); mon.classList.add('munch'); Audio2.sfx('pluck', .6); }
        else { el.classList.add('spit'); mon.classList.add('yuck'); if (c.s) Voice.say(c.s, c.l); }
        res({ ok: c.ok, el, correctEl: plate.children[q.ch.findIndex(x => x.ok)] });
      };
      q.ch.forEach((c, k) => {
        const f = h('div', 'food pop-in', choiceHTML(c, q.latinCh)); f.style.animationDelay = k * 80 + 'ms'; f.dataset.ok = c.ok ? 1 : 0;
        drag(f, { onDrop: t => { if (t === mon) pick(c, f); }, onTap: () => { Audio2.sfx('select', .3); pick(c, f); } });
        plate.appendChild(f);
      });
      hydrate(area); P.speak();
    }), () => sleep(500));
  }

  // 拖拽工具：短按视为点击
  function drag(el, o) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => {
      if (el.classList.contains('locked')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY; let moved = false, ghost;
      const mv = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) > 8) { moved = true; ghost = el.cloneNode(true); ghost.classList.add('drag-ghost'); Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); document.body.appendChild(ghost); el.classList.add('dragging'); }
        if (moved) { ghost.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + Math.max(-12, Math.min(12, dx / 20)) + 'deg) scale(1.08)'; const t = target(ev); $$('.drop.over').forEach(d => d !== t && d.classList.remove('over')); if (t) t.classList.add('over'); }
      };
      const target = ev => { if (ghost) ghost.style.display = 'none'; const t = document.elementFromPoint(ev.clientX, ev.clientY); if (ghost) ghost.style.display = ''; return t && t.closest('.drop'); };
      const up = ev => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        $$('.drop.over').forEach(d => d.classList.remove('over'));
        if (moved) { const t = target(ev); ghost.remove(); el.classList.remove('dragging'); if (t && o.onDrop) o.onDrop(t); }
        else if (o.onTap) o.onTap();
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
  }

  /* ---------- 9. 翻翻乐 memory ---------- */
  function memory(S, pairs) {
    const st = S.stage; st.className = 'stage scene-memory';
    return new Promise(resolve => {
      st.innerHTML = '<div class="qpanel slim"><div class="qtext">翻开两张卡片，找到一对朋友！</div></div>';
      const cards = R.shuffle(pairs.flatMap((p, i) => [{ c: p[0], i }, { c: p[1], i }]));
      const grid = h('div', 'mgrid n' + cards.length); st.appendChild(grid);
      let open = [], found = 0, lock = false;
      S.setProgress(0, pairs.length);
      cards.forEach((x, k) => {
        const el = h('div', 'mcard', '<div class="mface back">' + (isKid() ? E('⭐') : '<span class="mlogo">?</span>') + '</div><div class="mface front">' + choiceHTML(x.c) + '</div>');
        el.style.animationDelay = k * 40 + 'ms'; el.dataset.i = x.i;
        el.onclick = async () => {
          if (lock || el.classList.contains('flip')) return;
          el.classList.add('flip'); Audio2.sfx('select', .35); if (x.c.s) Voice.say(x.c.s, x.c.l);
          open.push({ el, x });
          if (open.length === 2) {
            lock = true; const [a, b] = open; open = [];
            await sleep(650);
            if (a.x.i === b.x.i) { a.el.classList.add('matched'); b.el.classList.add('matched'); found++; S.right++; S.total++; Audio2.sfx('right', .5); const r = b.el.getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top + r.height / 2, '✨', 6); S.setProgress(found, pairs.length); if (found === pairs.length) { await Voice.say(R.pick(PRAISE)); const m = S.miss || 0; S.end(false, m <= pairs.length * .7 ? 3 : m <= pairs.length * 1.5 ? 2 : 1); resolve(); } }
            else { a.el.classList.remove('flip'); b.el.classList.remove('flip'); S.miss = (S.miss || 0) + 1; Audio2.sfx('tick', .4); }
            lock = false;
          }
        };
        grid.appendChild(el);
      });
      hydrate(grid);
    });
  }

  /* ---------- 10. 连连看 connect ---------- */
  function connect(S, pairs) {
    const st = S.stage; st.className = 'stage scene-connect';
    return new Promise(resolve => {
      st.innerHTML = '<div class="qpanel slim"><div class="qtext">先点左边，再点右边，把它们连起来！</div></div>';
      const box = h('div', 'cbox'); st.appendChild(box);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('clines'); box.appendChild(svg);
      const L = h('div', 'ccol'), Rr = h('div', 'ccol'); box.appendChild(L); box.appendChild(Rr);
      const left = pairs.map((p, i) => ({ c: p[0], i })), right = R.shuffle(pairs.map((p, i) => ({ c: p[1], i })));
      let sel = null, done = 0; S.setProgress(0, pairs.length);
      const mk = (x, side) => { const b = h('button', 'cnode ' + side, choiceHTML(x.c)); b.dataset.i = x.i; b.onclick = () => tap(b, x, side); return b; };
      left.forEach(x => L.appendChild(mk(x, 'l'))); right.forEach(x => Rr.appendChild(mk(x, 'r')));
      hydrate(box);
      function line(a, b, cls) {
        const br = box.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const x1 = ra.right - br.left, y1 = ra.top + ra.height / 2 - br.top, x2 = rb.left - br.left, y2 = rb.top + rb.height / 2 - br.top;
        ln.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + (x1 + 60) + ' ' + y1 + ',' + (x2 - 60) + ' ' + y2 + ',' + x2 + ' ' + y2);
        ln.setAttribute('class', cls); svg.appendChild(ln); return ln;
      }
      async function tap(b, x, side) {
        if (b.classList.contains('done')) return;
        if (x.c.s) Voice.say(x.c.s, x.c.l);
        if (!sel || sel.side === side) { if (sel) sel.b.classList.remove('sel'); sel = { b, x, side }; b.classList.add('sel'); Audio2.sfx('select', .3); return; }
        const a = side === 'r' ? sel.b : b, c = side === 'r' ? b : sel.b; sel.b.classList.remove('sel');
        const ok = sel.x.i === x.i; sel = null;
        if (ok) { line(a, c, 'ok'); a.classList.add('done'); c.classList.add('done'); done++; S.right++; S.total++; Audio2.sfx('right', .5); S.setProgress(done, pairs.length); if (done === pairs.length) { await Voice.say(R.pick(PRAISE)); S.end(false); resolve(); } }
        else { const ln = line(a, c, 'no'); setTimeout(() => ln.remove(), 600); a.classList.add('shake'); c.classList.add('shake'); setTimeout(() => { a.classList.remove('shake'); c.classList.remove('shake'); }, 500); S.wrong++; S.total++; Audio2.sfx('wrong', .4); S.hearts--; S.renderHearts(); if (S.hearts <= 0) { S.end(true); resolve(); } }
      }
    });
  }

  /* ---------- 11. 分类 sort ---------- */
  function sort(S, data) {
    const st = S.stage; st.className = 'stage scene-sort';
    return new Promise(resolve => {
      st.innerHTML = '<div class="qpanel slim"><div class="qtext">把它们送到正确的地方（拖过去或点一下下面的篮子）</div></div>';
      const cur = h('div', 'sortcur'); st.appendChild(cur);
      const bins = h('div', 'bins n' + data.bins.length); st.appendChild(bins);
      data.bins.forEach((b, i) => { const el = h('div', 'bin drop', '<div class="bin-ico">' + vis(b.e) + '</div><div class="bin-t">' + esc(b.t) + '</div>' + (b.sub ? '<div class="csub">' + esc(b.sub) + '</div>' : '') + '<div class="bin-count"></div>'); el.dataset.i = i; bins.appendChild(el); });
      hydrate(bins);
      let k = 0;
      const next = () => {
        if (S.over) return resolve();
        S.setProgress(k, data.items.length);
        if (k >= data.items.length) { Voice.say(R.pick(PRAISE)); S.end(false); return resolve(); }
        const it = data.items[k]; cur.innerHTML = '';
        const el = h('div', 'sortitem pop-in', choiceHTML(it, it.l === 'en')); el.dataset.b = it.b; cur.appendChild(el); hydrate(cur);
        if (it.s) Voice.say(it.s, it.l);
        let done = false;
        const put = async (binEl) => {
          if (done) return; const bi = +binEl.dataset.i;
          if (bi === it.b) {
            done = true; el.classList.add('fly-in'); S.right++; S.total++; Audio2.sfx('drop', .5); binEl.classList.add('gulp'); setTimeout(() => binEl.classList.remove('gulp'), 400);
            const cnt = binEl.querySelector('.bin-count'); cnt.innerHTML += vis(it.e, 'mini') || '<span class="mini-t">' + esc(it.t) + '</span>'; hydrate(cnt);
            k++; await sleep(380); next();
          } else {
            S.wrong++; S.total++; Audio2.sfx('wrong', .4); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); binEl.classList.add('nope'); setTimeout(() => binEl.classList.remove('nope'), 500);
            S.hearts--; S.renderHearts(); if (S.hearts <= 0) { S.end(true); resolve(); }
          }
        };
        drag(el, { onDrop: t => put(t) });
        $$('.bin', bins).forEach(b => b.onclick = () => put(b));
      };
      next();
    });
  }

  /* ---------- 12. 排序 / 拼字 seq ---------- */
  function seq(S, rounds, spell) {
    const st = S.stage; st.className = 'stage scene-seq';
    return new Promise(async resolve => {
      for (let r = 0; r < rounds.length; r++) {
        if (S.over) return resolve();
        S.setProgress(r, rounds.length);
        const rd = rounds[r];
        const ans = spell ? rd.ans.map(t => ({ t, s: t, l: rd.l })) : rd.items;
        const pool = spell ? rd.pool.map(t => ({ t, s: t, l: rd.l })) : R.shuffle(rd.items.map(x => x));
        if (!spell && pool.every((x, i) => x === ans[i])) pool.reverse();
        st.innerHTML = '';
        const P = h('div', 'qpanel slim', '<div class="qtext">' + esc(rd.p) + ' <button class="say">' + E('🔊') + '</button></div>' + (rd.pe ? '<div class="qvis sm">' + vis(rd.pe, 'qemo') + '</div>' : ''));
        st.appendChild(P); hydrate(P);
        const sayAll = () => Voice.say(spell ? rd.s : (rd.join != null ? ans.map(a => a.s).join(rd.join) : rd.p), spell ? rd.l : (rd.l || 'zh'));
        P.querySelector('.say').onclick = sayAll;
        const slots = h('div', 'slots' + (spell ? ' spell' : '')); st.appendChild(slots);
        ans.forEach(() => slots.appendChild(h('div', 'slot')));
        const tray = h('div', 'tray' + (spell ? ' spell' : '')); st.appendChild(tray);
        tray.dataset.ans = ans.map(a => a.t).join('|');
        await new Promise(done => {
          let k = 0;
          pool.forEach(item => {
            const b = h('button', 'tile pop-in', choiceHTML(item, item.l === 'en'));
            b.onclick = async () => {
              if (b.classList.contains('used') || S.over) return;
              const want = ans[k];
              const ok = spell ? item.t === want.t : item === want;
              if (ok) {
                b.classList.add('used'); const sl = slots.children[k]; sl.innerHTML = choiceHTML(item, item.l === 'en'); hydrate(sl); sl.classList.add('filled'); Audio2.sfx('select', .4);
                if (item.s && !spell) Voice.say(item.s, item.l);
                k++;
                if (k === ans.length) { S.right++; S.total++; slots.classList.add('complete'); Audio2.sfx('right', .5); const rr = slots.getBoundingClientRect(); UI.burst(rr.left + rr.width / 2, rr.top + rr.height / 2, '⭐', 10); await sleep(300); await sayAll(); await sleep(250); done(); }
              } else {
                b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); Audio2.sfx('wrong', .35); S.wrong++; S.total++;
                if (S.wrong % 2 === 0) { S.hearts--; S.renderHearts(); if (S.hearts <= 0) { S.end(true); done(); } }
              }
            };
            tray.appendChild(b);
          });
          hydrate(tray);
          if (spell) Voice.say(rd.p.replace(/^.*：/, ''), 'zh'); else Voice.say(rd.p);
        });
      }
      if (!S.over) { S.setProgress(rounds.length, rounds.length); S.total = Math.max(S.total, 1); S.end(false); }
      resolve();
    });
  }

  /* ---------- 13. 拨钟 ---------- */
  function clockset(S, grade) {
    const st = S.stage; st.className = 'stage scene-clock';
    const step = grade <= 1 ? 30 : grade === 2 ? 15 : 5;
    const rounds = Array.from({ length: 6 }, () => [R.int(1, 12), R.int(0, 60 / step - 1) * step]);
    return new Promise(async resolve => {
      for (let r = 0; r < rounds.length; r++) {
        if (S.over) return resolve();
        S.setProgress(r, rounds.length);
        const [th, tm] = rounds[r]; let hh = 12, mm = 0;
        st.innerHTML = '';
        const P = h('div', 'qpanel slim', '<div class="qtext">把钟拨到 <b class="latin">' + CONTENT.tstr(th, tm) + '</b>（' + CONTENT.tsay(th, tm) + '）<button class="say">' + E('🔊') + '</button></div>');
        st.appendChild(P); hydrate(P);
        P.querySelector('.say').onclick = () => Voice.say('把钟拨到' + CONTENT.tsay(th, tm));
        Voice.say('把钟拨到' + CONTENT.tsay(th, tm));
        const wrap = h('div', 'clockwrap'); st.appendChild(wrap);
        const face = h('div', 'bigclock'); wrap.appendChild(face);
        const ctr = h('div', 'clockctl', '<div class="cc-row"><span>时针</span><button class="btn sm" data-a="h-">−1时</button><button class="btn sm" data-a="h+">+1时</button></div><div class="cc-row"><span>分针</span><button class="btn sm" data-a="m-">−' + step + '分</button><button class="btn sm" data-a="m+">+' + step + '分</button></div><div class="cc-time latin"></div><button class="btn big go" data-a="ok">拨好了 ✓</button>');
        wrap.appendChild(ctr);
        const draw = () => { face.innerHTML = clockSVG(hh, mm); ctr.querySelector('.cc-time').textContent = CONTENT.tstr(hh, mm); bindDrag(); };
        const bindDrag = () => {
          const svg = face.querySelector('svg');
          const onMove = e => { const rc = svg.getBoundingClientRect(); const a = Math.atan2(e.clientX - rc.left - rc.width / 2, -(e.clientY - rc.top - rc.height / 2)); let deg = (a * 180 / Math.PI + 360) % 360; const nm = Math.round(deg / 6 / step) * step % 60; if (nm !== mm) { if (mm > 45 && nm < 15) hh = hh % 12 + 1; else if (mm < 15 && nm > 45) hh = (hh + 10) % 12 + 1; mm = nm; Audio2.sfx('tick', .2); draw(); } };
          svg.onpointerdown = e => { e.preventDefault(); const up = () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', up); }; addEventListener('pointermove', onMove); addEventListener('pointerup', up); };
        };
        draw();
        await new Promise(done => {
          ctr.onclick = async e => {
            const a = e.target.dataset && e.target.dataset.a; if (!a) return; Audio2.sfx('tick', .3);
            if (a === 'h+') hh = hh % 12 + 1; if (a === 'h-') hh = (hh + 10) % 12 + 1;
            if (a === 'm+') { mm += step; if (mm >= 60) { mm = 0; hh = hh % 12 + 1; } }
            if (a === 'm-') { mm -= step; if (mm < 0) { mm = 60 - step; hh = (hh + 10) % 12 + 1; } }
            if (a === 'ok') {
              if (hh === th && mm === tm) { S.right++; S.total++; Audio2.sfx('right', .5); face.classList.add('good'); await Voice.say(R.pick(PRAISE)); return done(); }
              S.wrong++; S.total++; Audio2.sfx('wrong', .4); face.classList.remove('shake'); void face.offsetWidth; face.classList.add('shake');
              S.hearts--; S.renderHearts(); Voice.say('还不对哦，再看看'); if (S.hearts <= 0) { S.end(true); return done(); }
              return;
            }
            draw();
          };
        });
      }
      if (!S.over) S.end(false);
      resolve();
    });
  }

  /* ---------- 14. 接接乐：移动篮子接住正确答案 ---------- */
  function catcher(S, qs) {
    const st = S.stage;
    return runQs(S, qs, q => new Promise(res => {
      st.innerHTML = ''; st.className = 'stage scene-catch';
      const P = qPanel(q); st.appendChild(P.el);
      const field = h('div', 'field catchfield'); st.appendChild(field);
      const basket = h('div', 'basket', E(isKid() ? '🧺' : '🛸')); field.appendChild(basket);
      hydrate(field);
      let bx = .5, done = false, items = [], raf, t0 = performance.now();
      const W = () => field.clientWidth, H = () => field.clientHeight;
      const spawn = () => {
        items.forEach(it => it.el.remove()); items = [];
        const lanes = R.shuffle([0, 1, 2, 3].slice(0, q.ch.length));
        q.ch.forEach((c, k) => {
          const el = h('div', 'drop-item', choiceHTML(c, q.latinCh)); el.dataset.ok = c.ok ? 1 : 0; field.appendChild(el); hydrate(el);
          items.push({ el, c, x: (lanes[k] + .5) / q.ch.length, y: -50 - k * 55 - R.int(0, 40), v: 95 + S.grade * 14 + R.int(0, 25) });
        });
      };
      const move = e => { const r = field.getBoundingClientRect(); bx = Math.max(.06, Math.min(.94, (e.clientX - r.left) / r.width)); };
      const key = e => { if (e.key === 'ArrowLeft') bx = Math.max(.06, bx - .08); if (e.key === 'ArrowRight') bx = Math.min(.94, bx + .08); };
      field.addEventListener('pointermove', move); field.addEventListener('pointerdown', move); addEventListener('keydown', key);
      const finish = (ok, el) => { done = true; cancelAnimationFrame(raf); removeEventListener('keydown', key); if (!ok) { const it = items.find(i => i.c.ok); if (it) it.el.classList.add('reveal'); } res({ ok, el, correctEl: (items.find(i => i.c.ok) || {}).el }); };
      let last = performance.now();
      const loop = now => {
        if (done || S.over || !field.isConnected) return;
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        basket.style.left = (bx * 100) + '%';
        const bw = basket.offsetWidth, bxp = bx * W(), by = H() - 70;
        let alive = 0;
        for (const it of items) {
          if (it.gone) continue;
          it.y += it.v * dt;
          it.el.style.transform = 'translate(' + (it.x * W() - it.el.offsetWidth / 2) + 'px,' + it.y + 'px)';
          const cx = it.x * W(), cy = it.y + it.el.offsetHeight;
          if (cy > by && cy < by + 50 && Math.abs(cx - bxp) < bw / 2 + it.el.offsetWidth / 3) {
            it.gone = true; it.el.classList.add('caught-item'); Audio2.sfx(it.c.ok ? 'pluck' : 'bump', .5);
            if (!it.c.ok && it.c.s) Voice.say(it.c.s, it.c.l);
            return finish(it.c.ok, it.el);
          }
          if (it.y > H()) { it.gone = true; it.el.style.opacity = 0; } else alive++;
        }
        if (!alive) spawn();
        raf = requestAnimationFrame(loop);
      };
      spawn(); P.speak(); raf = requestAnimationFrame(loop);
    }), () => sleep(400));
  }

  const ENGINES = {
    catch: catcher,
    quiz: (S, d) => quiz(S, d), tf: (S, d) => quiz(S, d, { timer: S.grade >= 3 ? 10 : 14 }),
    bubble: (S, d) => floaters(S, d, 'bubble'), balloon: (S, d) => floaters(S, d, 'balloon'), ufo: (S, d) => floaters(S, d, 'ufo'),
    whack, fish, frog, chest, race, feed, memory, connect, sort,
    order: (S, d) => seq(S, d, false), spell: (S, d) => seq(S, d, true), clockset: (S) => clockset(S, S.grade),
  };
  const ENG_NAMES = { catch: '接接乐', quiz: '选一选', tf: '判断快答', bubble: '戳泡泡', balloon: '射气球', ufo: '星际射击', whack: '打地鼠', fish: '钓鱼', frog: '青蛙跳', chest: '开宝箱', race: '赛车', feed: '喂怪兽', memory: '翻翻乐', connect: '连连看', sort: '分类', order: '排序', spell: '拼拼乐', clockset: '拨钟' };

  window.Engines = { ENGINES, ENG_NAMES, Session, qPanel, choiceHTML, drag, SP, PRAISE, runQs };
})();
