/* 体感光标：举起一只手就出现，手移到按钮上停一会儿（圆环走满）就点下去；向前推手 / 捏合手指可以立刻点
   · 光标有「磁吸」：靠近按钮会被吸到按钮中心，小朋友不用指得很准
   · 自动隐藏：手放下、人离开、玩法进行中（mode = 'off'）、或者刚用过鼠标时都会淡出，不打扰沉浸感
   · 点击用 el.click()，现有界面的按钮也都能点 */
(function () {
  const M = window.Motion, U = M.U;
  const SEL = 'button:not([disabled]), .btn, [data-m], .m-card, .choice, .dbtn, .pcard, [data-ok], .tile, .m-opt, a[href], .mclose, .back';
  const C = M.Cursor = M.emitter({
    on: false, mode: 'on', el: null, x: innerWidth / 2, y: innerHeight / 2, vis: false, side: null, target: null, prog: 0, cool: 0, lastSeen: 0, mouseT: 0,
    fx: new M.OneEuro(1.1, .008), fy: new M.OneEuro(1.1, .008), _loop: null, _cands: [], _candT: 0, hintT: 0,

    build() {
      if (this.el) return;
      const el = this.el = U.h('div', 'm-cursor', '<div class="mc-trail"></div><svg class="mc-ring" viewBox="0 0 100 100"><circle class="mc-bg" cx="50" cy="50" r="44"/><circle class="mc-fg" cx="50" cy="50" r="44" pathLength="100"/></svg><div class="mc-dot">' + U.E('✋', 'mc-emo') + '</div>');
      document.body.appendChild(el);
      this.trail = [];
      const tr = el.querySelector('.mc-trail'); for (let i = 0; i < 7; i++) { const d = U.h('i'); tr.appendChild(d); this.trail.push({ el: d, x: this.x, y: this.y }); }
      this.hint = U.h('div', 'm-cursor-hint', U.E('✋') + '<span>举起一只手，就能用手控制光标；停在按钮上就会点下去</span>'); document.body.appendChild(this.hint);
      addEventListener('mousemove', e => { if (e.isTrusted && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) this.mouseT = U.now(); }, true);
    },
    enable(on) {
      this.build(); this.on = on !== false;
      if (this.on && !this._loop) this._loop = M.loop((dt, t) => this.tick(dt, t));
      if (!this.on) { if (this._loop) this._loop.stop(); this._loop = null; this.show(false); this.setTarget(null); this.hint.classList.remove('in'); }
    },
    setMode(m) { this.mode = m; if (m === 'off') { this.show(false); this.setTarget(null); } },
    show(v) { if (this.vis === v) return; this.vis = v; this.el.classList.toggle('in', v); if (!v) { this.prog = 0; this.ring(0); } },
    ring(p) { const fg = this.el.querySelector('.mc-fg'); fg.style.strokeDashoffset = String(100 - p * 100); this.el.classList.toggle('dwell', p > 0); },
    pickHand(person) {
      const b = person.body; if (!b || !b.ready) return null;
      const ok = sd => { const h = b.hands[sd]; return h.visible && h.rawA && h.rawA.y < b.hip.y - .05 * b.T; }; // 手抬到腰以上
      if (this.side && ok(this.side)) return this.side;
      const want = M.cfg.cursor.hand; if (want === 'L' || want === 'R') return ok(want) ? want : null;
      const l = ok('L'), r = ok('R'); if (l && r) return b.hands.L.rawA.y < b.hands.R.rawA.y ? 'L' : 'R';
      return l ? 'L' : r ? 'R' : null;
    },
    tick(dt, t) {
      const W = innerWidth, H = innerHeight;
      const person = M.Tracker.main();
      const side = person && this.mode !== 'off' && !document.hidden && t - this.mouseT > 1500 ? this.pickHand(person) : null;
      if (side) {
        const b = person.body, h = b.hands[side], T = b.T;
        // 舒适区：以这只手的肩膀为中心偏外一点，宽 2T，按屏幕宽高比定高度
        const cx = b.sh.x + (side === 'R' ? .55 : -.55) * T, cy = b.sh.y + .02 * T, hw = 1.0 * T, hh = hw * H / W * 1.1;
        let nx = .5 + (h.rawA.x - cx) / (2 * hw), ny = .5 + (h.rawA.y - cy) / (2 * hh);
        nx = U.clamp(nx, -.02, 1.02); ny = U.clamp(ny, -.02, 1.02);
        let px = this.fx.f(nx * W, t), py = this.fy.f(ny * H, t);
        // 磁吸
        const tg = this.nearest(px, py, t);
        if (tg) { const r = tg.r, tx = r.left + r.width / 2, ty = r.top + r.height / 2; const inside = px > r.left && px < r.right && py > r.top && py < r.bottom; const k = inside ? .35 : .2; px += (tx - px) * k; py += (ty - py) * k; }
        this.x = px; this.y = py; this.side = side; this.lastSeen = t;
        this.show(true); this.hint.classList.remove('in'); this.hintT = 0;
        this.setTarget(tg ? tg.el : null);
        if (this.target && t > this.cool) {
          this.prog += dt / Math.max(.4, M.cfg.cursor.dwell);
          if (this.prog >= 1) this.click();
        } else this.prog = Math.max(0, this.prog - dt * 3);
        this.ring(this.target ? this.prog : 0);
      } else {
        if (this.vis && t - this.lastSeen > 700) { this.show(false); this.setTarget(null); this.side = null; this.fx.reset(); this.fy.reset(); }
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
  // 推手 / 捏合：立即点击当前悬停的按钮
  const fast = e => { if (C.on && C.vis && C.target && C.side === e.hand && U.now() > C.cool) C.click(); };
  M.Body.on('punch', fast); M.Body.on('pinch', fast);
})();
