/* 体感光标：举起一只手就出现，移到按钮上做一个「点击手势」就点下去。点击方式在设置里选（M.cfg.cursor.click）：
   · grab  握拳（默认）：张开手掌 → 握拳。光标那只手附近裁一块小图单独看手指（Tracker.grabWant → person.grab），
           必须先看到「张开」再变成「握拳」才算一次，一直握着拳不会连点；握拳过程中光标定住，不会滑到别的按钮
   · pinch 捏合：拇指和食指张开 → 捏在一起（同样看裁剪小图里的手指）
   · push  推手：手向前推一下（只用身体姿态，离得远、光线暗也行）
   · dwell 停留：停在按钮上圆环走满就点
   握拳 / 捏合看不清手指时（离太远、太暗）自动退回停留点击；推手在任何方式下都能用。
   停留计时只在识别结果是新的时候才走：识别卡住一下（掉帧、画面冻住）光标会停在原地，但不会因此误点
   · 光标有「磁吸」：靠近按钮会被吸到按钮中心，小朋友不用指得很准
   · 自动隐藏：手放下、人离开、玩法进行中（mode = 'off'）、或者刚用过鼠标时都会淡出，不打扰沉浸感
   · 点击用 el.click()，现有界面的按钮也都能点 */
(function () {
  const M = window.Motion, U = M.U;
  const SEL = 'button:not([disabled]), .btn, [data-m], .m-card, .choice, .dbtn, .pcard, [data-ok], .tile, .m-opt, a[href], .mclose, .back';
  const C = M.Cursor = M.emitter({
    on: false, mode: 'on', el: null, x: innerWidth / 2, y: innerHeight / 2, vis: false, side: null, target: null, prog: 0, cool: 0, lastSeen: 0, mouseT: 0,
    sideT: 0, gSeen: -1e9, armed: false, openT: 0, grabbing: false, skinK: '',
    fx: new M.OneEuro(1.1, .008), fy: new M.OneEuro(1.1, .008), _loop: null, _cands: [], _candT: 0, hintT: 0,

    build() {
      if (this.el) return;
      const el = this.el = U.h('div', 'm-cursor', '<div class="mc-trail"></div><svg class="mc-ring" viewBox="0 0 100 100"><circle class="mc-bg" cx="50" cy="50" r="44"/><circle class="mc-fg" cx="50" cy="50" r="44" pathLength="100"/></svg><div class="mc-dot"></div><div class="mc-tip"></div>');
      document.body.appendChild(el);
      this.trail = [];
      const tr = el.querySelector('.mc-trail'); for (let i = 0; i < 7; i++) { const d = U.h('i'); tr.appendChild(d); this.trail.push({ el: d, x: this.x, y: this.y }); }
      this.hint = U.h('div', 'm-cursor-hint', U.E('✋') + '<span>举起一只手张开手掌，就能移动光标；对准按钮握一下拳头就点下去</span>'); document.body.appendChild(this.hint);
      addEventListener('mousemove', e => { if (e.isTrusted && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) this.mouseT = U.now(); }, true);
    },
    enable(on) {
      this.build(); this.on = on !== false;
      if (this.on && !this._loop) this._loop = M.loop((dt, t) => this.tick(dt, t));
      if (!this.on) { if (this._loop) this._loop.stop(); this._loop = null; this.show(false); this.setTarget(null); this.hint.classList.remove('in'); M.Tracker.grabWant = null; }
    },
    setMode(m) { this.mode = m; if (m === 'off') { this.show(false); this.setTarget(null); M.Tracker.grabWant = null; } },
    show(v) { if (this.vis === v) return; this.vis = v; this.el.classList.toggle('in', v); if (!v) { this.prog = 0; this.ring(0); } },
    ring(p) { const fg = this.el.querySelector('.mc-fg'); fg.style.strokeDashoffset = String(100 - p * 100); this.el.classList.toggle('dwell', p > 0); },
    // 手势点击的样子：松开 / 捏紧两个图标，对准按钮时下面提示怎么点
    setGrab(on, fist, tip) { const c = this.el.classList; c.toggle('grab', on); c.toggle('fist', fist); c.toggle('tip', tip && on); this.grabbing = on; },
    skin(k) {
      if (k === this.skinK) return; this.skinK = k; const S = SKIN[k] || SKIN.dwell;
      this.el.querySelector('.mc-dot').innerHTML = U.E(S[0], 'mc-emo mc-open') + U.E(S[1], 'mc-emo mc-fist');
      this.el.querySelector('.mc-tip').innerHTML = S[2] ? U.E(S[3] || S[1]) + S[2] : '';
      this.hint.querySelector('span').textContent = S[4];
    },
    pickHand(person) {
      const b = person.body; if (!b || !b.ready) return null;
      const ok = sd => { const h = b.hands[sd]; return h.visible && h.rawA && h.rawA.y < b.hip.y - .05 * b.T; }; // 手抬到腰以上
      if (this.side && ok(this.side)) return this.side;
      const want = M.cfg.cursor.hand; if (want === 'L' || want === 'R') return ok(want) ? want : null;
      const l = ok('L'), r = ok('R'); if (l && r) return b.hands.L.rawA.y < b.hands.R.rawA.y ? 'L' : 'R';
      return l ? 'L' : r ? 'R' : null;
    },
    tick(dt, t) {
      const ar = M.UI && M.UI.area ? M.UI.area() : { left: 0, top: 0, width: innerWidth, height: innerHeight }, W = ar.width, H = ar.height;
      const person = M.Tracker.main();
      const busy = window.Preload && Preload.Loader && Preload.Loader.busy(); // 正在加载（进度框盖着）：不能点到下面的按钮
      const side = person && this.mode !== 'off' && !busy && !document.hidden && t - this.mouseT > 1500 ? this.pickHand(person) : null;
      if (side) {
        const b = person.body, h = b.hands[side], T = b.T;
        if (side !== this.side || !this.vis) { this.sideT = t; this.armed = false; }
        // 握拳 / 捏合：让识别模块盯着这只手的手指
        const cm = M.cfg.cursor.click || 'grab', virt = !!person.virtual, finger = (cm === 'grab' || cm === 'pinch') && !virt && M.Tracker.grabReady;
        const g = person.grab, gf = finger && !!(g && g.side === side && t - g.t < 500);
        M.Tracker.grabWant = finger ? { slot: person.slot, side } : null;
        if (gf) this.gSeen = t;
        const grabMode = finger && (gf || t - this.gSeen < 1200 || t - this.sideT < 1500);
        // 统一成「松开程度」：1 松开（手掌张开 / 两指分开）～ 0 捏紧（握拳 / 两指捏住）
        const open = gf ? (cm === 'pinch' ? g.pin : g.open) : null;
        this.skin(grabMode ? cm : cm === 'push' ? 'push' : finger ? 'lost' : 'dwell');
        // 张开过以后正在握拳：光标和目标定住（握拳时手腕会动一下）
        const hold = grabMode && this.armed && open != null && open < .55 && this.target;
        // 舒适区：以这只手的肩膀为中心偏外一点，宽 2T，按屏幕宽高比定高度
        const cx = b.sh.x + (side === 'R' ? .55 : -.55) * T, cy = b.sh.y + .02 * T, hw = 1.0 * T, hh = hw * H / W * 1.1;
        let nx = .5 + (h.rawA.x - cx) / (2 * hw), ny = .5 + (h.rawA.y - cy) / (2 * hh);
        nx = U.clamp(nx, -.02, 1.02); ny = U.clamp(ny, -.02, 1.02);
        let px = this.fx.f(ar.left + nx * W, t), py = this.fy.f(ar.top + ny * H, t);
        // 磁吸
        const tg = hold ? null : this.nearest(px, py, t);
        if (tg) { const r = tg.r, tx = r.left + r.width / 2, ty = r.top + r.height / 2; const inside = px > r.left && px < r.right && py > r.top && py < r.bottom; const k = inside ? .35 : .2; px += (tx - px) * k; py += (ty - py) * k; }
        if (!hold) { this.x = px; this.y = py; }
        this.side = side; this.lastSeen = t;
        this.show(true); this.hint.classList.remove('in'); this.hintT = 0;
        if (!hold) this.setTarget(tg ? tg.el : null);
        if (grabMode) {
          // 先张开（> .6）再握紧（< .25）= 点一下；一直握着拳、或者没张开过就握拳，都不算
          this.prog = 0;
          if (open != null) {
            if (open > .6) { this.armed = true; this.openT = t; }
            else if (open < .25) { if (this.armed && t - this.openT < 1500 && this.target && t > this.cool) this.click(); this.armed = false; }
          }
          const grip = this.armed && open != null ? U.clamp((.6 - open) / .35, 0, 1) : 0;
          this.ring(this.target ? grip : 0);
          this.setGrab(true, open != null && open < .35, !!this.target && t > this.cool);
        } else if (cm === 'push') {
          this.prog = 0; this.ring(0); this.setGrab(true, false, !!this.target && t > this.cool); // 推手由下面的 punch 事件点击
        } else {
          // 停留：只有识别结果是新的（150 毫秒内）才计时，识别卡住时光标冻在按钮上也不会误点
          const fresh = virt || (person.t && t - person.t < 150);
          if (this.target && t > this.cool && fresh) {
            this.prog += dt / Math.max(.4, M.cfg.cursor.dwell);
            if (this.prog >= 1) this.click();
          } else if (!fresh) this.prog = Math.max(0, this.prog - dt);
          else this.prog = Math.max(0, this.prog - dt * 3);
          this.ring(this.target ? this.prog : 0);
          this.setGrab(false, false, false);
        }
      } else {
        M.Tracker.grabWant = null; this.armed = false;
        if (this.vis && t - this.lastSeen > 700) { this.show(false); this.setTarget(null); this.side = null; this.fx.reset(); this.fy.reset(); this.setGrab(false, false, false); }
        // 人在画面里但一直没举手：底部提示怎么用
        if (person && this.mode !== 'off' && t - this.mouseT > 4000) { this.hintT += dt; if (this.hintT > 4) this.hint.classList.add('in'); } else { this.hintT = 0; this.hint.classList.remove('in'); }
      }
      this.el.style.transform = 'translate(' + this.x + 'px,' + this.y + 'px)';
      let lx = this.x, ly = this.y;
      this.trail.forEach((p, i) => { p.x += (lx - p.x) * .45; p.y += (ly - p.y) * .45; lx = p.x; ly = p.y; p.el.style.transform = 'translate(' + (p.x - this.x) + 'px,' + (p.y - this.y) + 'px) scale(' + (1 - i * .11) + ')'; });
    },
    // 离光标最近的可点元素（90px 以内）
    nearest(x, y, t) {
      if (t - this._candT > 300) {
        this._candT = t;
        const root = document.querySelector('.m-layer.top') || document.querySelector('#fx .modal-bg.in') || document;
        this._cands = [...root.querySelectorAll(SEL)].filter(e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return false;
          const sc = e.closest('.m-scr'); if (sc) { const q = sc.getBoundingClientRect(); if (Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) < r.height * .5) return false; } // 滚动区外看不见的不算
          if (e.closest('.m-hpage:not(.cur)')) return false; // 大厅别的页
          const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.pointerEvents !== 'none' && !e.closest('.m-noclick'); });
      }
      let best = null, bd = 90;
      this._cands.forEach(e => {
        const r = e.getBoundingClientRect(); if (!r.width) return;
        const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom), d = Math.hypot(dx, dy);
        if (d < bd || (d === 0 && best && best.d === 0 && r.width * r.height < best.r.width * best.r.height)) { bd = d; best = { el: e, r, d }; }
      });
      return best;
    },
    setTarget(el) {
      if (el === this.target) return;
      if (this.target) this.target.classList.remove('m-hover');
      this.target = el; this.prog = 0;
      if (el) { el.classList.add('m-hover'); if (window.Core) Core.Audio2.sfx('tick', .15); this.emit('hover', el); }
    },
    click() {
      const el = this.target; if (!el) return;
      this.prog = 0; this.cool = U.now() + 900; this.ring(0);
      this.el.classList.remove('clicked'); void this.el.offsetWidth; this.el.classList.add('clicked');
      if (window.Core) Core.Audio2.sfx('click', .5);
      el.classList.add('m-pressed'); setTimeout(() => el.classList.remove('m-pressed'), 260);
      try { el.focus && el.focus({ preventScroll: true }); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: this.x, clientY: this.y, pointerType: 'touch' })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: this.x, clientY: this.y, pointerType: 'touch' })); el.click(); } catch (e) { console.warn(e); }
      this.emit('click', el); this._candT = 0;
    },
  });
  // 各点击方式的样子：[松开图标, 捏紧图标, 对准按钮时的提示, 提示图标, 没举手时底部的说明]
  const SKIN = {
    grab: ['✋', '✊', '握拳点一下', '✊', '举起一只手张开手掌，就能移动光标；对准按钮握一下拳头就点下去'],
    pinch: ['✋', '🤏', '捏一下手指', '🤏', '举起一只手，就能移动光标；对准按钮拇指和食指捏一下就点下去'],
    push: ['✋', '✋', '向前推一下手', '👊', '举起一只手，就能移动光标；对准按钮向前推一下手就点下去'],
    lost: ['✋', '✋', '', '', '举起一只手，就能移动光标；离近一点让摄像头看清手指，或者停在按钮上不动'],
    dwell: ['✋', '✋', '', '', '举起一只手，就能移动光标；停在按钮上圆圈转满就点下去'],
  };
  // 推手 / 捏合：立即点击当前悬停的按钮
  const fast = e => { if (C.on && C.vis && C.target && C.side === e.hand && U.now() > C.cool) C.click(); };
  M.Body.on('punch', fast); M.Body.on('pinch', fast);
})();
