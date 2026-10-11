/* 第二批玩法引擎：动作、策略、创作 */
(function () {
  const { h, sleep, E, vis, hydrate, UI, Audio2, Voice, esc } = Core;
  const { runQs, qPanel, choiceHTML, PRAISE } = Engines;
  const R = CONTENT.R;
  const lbl = (c, q) => choiceHTML(c, q && q.latinCh);
  const live = (S, el) => !S.over && el.isConnected;
  const okIdx = q => q.ch.findIndex(c => c.ok);

  function scene(S, q, name) {
    const st = S.stage; st.innerHTML = ''; st.className = 'stage scene-' + name;
    const P = qPanel(q); st.appendChild(P.el); return { st, P };
  }
  function trimCh(q, n) {
    if (q.ch.length > n) { const ok = q.ch.find(c => c.ok); q.ch = R.shuffle([ok].concat(q.ch.filter(c => !c.ok).slice(0, n - 1))); }
    return q.ch;
  }
  function heroTok(pose) {
    const p = Core.Store.p, H = p && window.App && App.HEROES.find(x => x.id === p.hero);
    const sh = App.heroShot && App.heroShot(pose || 'front'); if (sh) return '<img class="spr" src="' + sh + '" draggable="false">';
    if (H && H.img) return '<img class="spr" src="assets/img/' + H.img + '_' + (pose || 'front') + '.png" draggable="false">';
    return E(H && H.e ? H.e : '🧒');
  }
  function petTok() {
    const p = Core.Store.p;
    if (p && p.pet && window.App) { const K = App.PETS.find(x => x.id === p.pet.kind); if (K) return E(K.e); }
    return E('🐤');
  }
  const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], ' ': [0, -1] };
  function onKeys(fn) {
    const f = e => { const m = KEYS[e.key]; if (m) { e.preventDefault(); fn(m, e); } };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  }
  function dpad(fn) {
    const d = h('div', 'dpad', '<button data-d="0,-1">▲</button><button data-d="-1,0">◀</button><button data-d="1,0">▶</button><button data-d="0,1">▼</button>');
    d.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); Audio2.sfx('click', .12); fn(b.dataset.d.split(',').map(Number)); });
    return d;
  }
  const tip = (field, t) => { const el = h('div', 'field-tip', t); field.appendChild(el); return el; };
  // 回合制玩法里的答题区
  function ask(S, box, q) {
    return new Promise(resv => {
      box.innerHTML = ''; const QP = qPanel(q); box.appendChild(QP.el);
      const grid = h('div', 'choices compact n' + q.ch.length); box.appendChild(grid);
      let done = false;
      q.ch.forEach(c => {
        const b = h('button', 'choice pop-in', lbl(c, q)); b.dataset.ok = c.ok ? 1 : 0;
        b.onclick = () => { if (done) return; done = true; if (!c.ok && c.s) Voice.say(c.s, c.l); resv({ ok: c.ok, el: b, correctEl: grid.children[okIdx(q)] }); };
        grid.appendChild(b);
      });
      hydrate(box); QP.speak();
      S.auto = () => { const b = grid.querySelector('[data-ok="1"]'); b && b.click(); };
      resv.grid = grid;
    });
  }
  const nextQFrom = (S, qs) => { const pool = qs.slice(); return () => pool.length ? pool.shift() : R.pick(S.more ? S.more() : qs); };
  const accStars = S => { const a = S.total ? S.right / S.total : 1; return a >= .9 ? 3 : a >= .7 ? 2 : 1; };

  /* 1. 贪吃蛇 */
  function snake(S, qs) {
    return runQs(S, qs, q => new Promise(res => {
      const { st, P } = scene(S, q, 'snake');
      const C = 12, RW = 7;
      const field = h('div', 'sn-field'); field.style.setProperty('--c', C); field.style.setProperty('--r', RW); st.appendChild(field);
      st.appendChild(dpad(d => turn(d)));
      let body = [[3, 3], [2, 3], [1, 3]], dir = [1, 0], next = [1, 0], done = false, timer = null, started = false;
      const cand = []; for (let x = 1; x < C; x++) for (let y = 0; y < RW; y++) if (!(y === 3 && x < 7)) cand.push([x, y]);
      const picked = [];
      R.shuffle(cand).forEach(p => { if (picked.length < q.ch.length && picked.every(o => Math.abs(o[0] - p[0]) + Math.abs(o[1] - p[1]) > 2)) picked.push(p); });
      const put = (el, p) => { el.style.left = (p[0] / C * 100) + '%'; el.style.top = (p[1] / RW * 100) + '%'; };
      const items = q.ch.map((c, k) => { const el = h('div', 'sn-item pop-in', lbl(c, q)); el.dataset.ok = c.ok ? 1 : 0; put(el, picked[k]); field.appendChild(el); return { c, p: picked[k], el }; });
      const segs = [];
      const draw = () => {
        while (segs.length < body.length) { const s = h('div', 'sn-seg'); field.appendChild(s); segs.push(s); }
        body.forEach((p, i) => { put(segs[i], p); segs[i].className = 'sn-seg' + (i === 0 ? ' head d' + dir.join('_') : ''); });
      };
      const t0 = tip(field, '点一点方向，带小蛇吃掉正确答案！');
      const turn = d => { if (done) return; if (d[0] === -dir[0] && d[1] === -dir[1]) return; next = d; if (!started) start(); };
      const stop = () => { clearInterval(timer); offK(); };
      const step = () => {
        if (done || !live(S, field)) return stop();
        dir = next;
        const hd = [(body[0][0] + dir[0] + C) % C, (body[0][1] + dir[1] + RW) % RW];
        body.unshift(hd);
        const hit = items.find(it => it.p[0] === hd[0] && it.p[1] === hd[1]);
        if (!(hit && hit.c.ok)) body.pop();
        draw();
        if (hit) {
          done = true; stop(); hit.el.classList.add('eaten-item'); Audio2.sfx(hit.c.ok ? 'pluck' : 'bump', .5);
          if (!hit.c.ok && hit.c.s) Voice.say(hit.c.s, hit.c.l);
          res({ ok: hit.c.ok, el: hit.el, correctEl: items.find(i => i.c.ok).el });
        }
      };
      const start = () => { started = true; t0.remove(); timer = setInterval(step, Math.max(160, 320 - S.grade * 30)); };
      const offK = onKeys(d => { if (!live(S, field)) return offK(); turn(d); });
      field.addEventListener('pointerdown', e => {
        const r = field.getBoundingClientRect(), cx = (e.clientX - r.left) / r.width * C, cy = (e.clientY - r.top) / r.height * RW;
        const dx = cx - body[0][0] - .5, dy = cy - body[0][1] - .5;
        turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
      });
      setTimeout(() => { if (!started && !done) start(); }, 3000);
      draw(); hydrate(field); P.speak();
      S.auto = () => {
        const t = items.find(i => i.c.ok).p, hd = body[0];
        const bad = d => { const n = [(hd[0] + d[0] + C) % C, (hd[1] + d[1] + RW) % RW]; return items.some(i => !i.c.ok && i.p[0] === n[0] && i.p[1] === n[1]); };
        const opts = []; if (t[0] !== hd[0]) opts.push([Math.sign(t[0] - hd[0]), 0]); if (t[1] !== hd[1]) opts.push([0, Math.sign(t[1] - hd[1])]);
        opts.push([dir[1], dir[0]], [-dir[1], -dir[0]]);
        const d = opts.find(o => !(o[0] === -dir[0] && o[1] === -dir[1]) && !bad(o)) || dir;
        turn(d);
      };
    }), () => sleep(400));
  }

  /* 2. 迷宫 */
  function maze(S, qs) {
    return runQs(S, qs, q => new Promise(res => {
      trimCh(q, 4);
      const { st, P } = scene(S, q, 'maze');
      const W = S.grade <= 1 ? 7 : 9, H = S.grade <= 1 ? 5 : 6;
      const D = { n: [0, -1, 's'], s: [0, 1, 'n'], e: [1, 0, 'w'], w: [-1, 0, 'e'] };
      const start = [Math.floor(W / 2), Math.floor(H / 2)], CORN = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].slice(0, Math.max(q.ch.length, 2));
      const gen = () => {
        const wl = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ n: 1, s: 1, e: 1, w: 1 })));
        const seen = new Set(['0,0']), stack = [[0, 0]];
        while (stack.length) {
          const [x, y] = stack[stack.length - 1];
          const nb = Object.entries(D).filter(([, [dx, dy]]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && !seen.has(nx + ',' + ny); });
          if (!nb.length) { stack.pop(); continue; }
          const [k, [dx, dy, op]] = R.pick(nb); wl[y][x][k] = 0; wl[y + dy][x + dx][op] = 0; seen.add((x + dx) + ',' + (y + dy)); stack.push([x + dx, y + dy]);
        }
        for (let i = 0; i < Math.floor(W * H / 7); i++) { const x = R.int(0, W - 2), y = R.int(0, H - 1); wl[y][x].e = 0; wl[y][x + 1].w = 0; }
        return wl;
      };
      // 每个角都要能从起点走到、且路上不经过别的答案（否则正确答案可能被错误答案「堵死」）
      const reach = (wl, goal) => { const block = new Set(CORN.filter(c => c !== goal).map(c => c + '')), seen = new Set([start + '']), Q = [start]; while (Q.length) { const c = Q.shift(); if (c[0] === goal[0] && c[1] === goal[1]) return true; for (const [k, [dx, dy]] of Object.entries(D)) { if (wl[c[1]][c[0]][k]) continue; const n = [c[0] + dx, c[1] + dy], nk = n + ''; if (seen.has(nk) || block.has(nk)) continue; seen.add(nk); Q.push(n); } } return false; };
      let wall = gen(); for (let i = 0; i < 40 && !CORN.every(c => reach(wall, c)); i++) wall = gen();
      // 极少数仍不满足：把角落格子的多余开口封上，只留一个通向里面的口
      if (!CORN.every(c => reach(wall, c))) CORN.forEach(([x, y]) => { const c = wall[y][x], inner = x === 0 ? 'e' : 'w', other = y === 0 ? 's' : 'n'; c[inner] = 0; wall[y][x + (inner === 'e' ? 1 : -1)][inner === 'e' ? 'w' : 'e'] = 0; c[other] = 1; wall[y + (other === 's' ? 1 : -1)][x][other === 's' ? 'n' : 's'] = 1; });
      const field = h('div', 'mz-field'); field.style.setProperty('--c', W); field.style.setProperty('--r', H); st.appendChild(field);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = wall[y][x]; field.appendChild(h('div', 'mz-cell' + (c.n ? ' wn' : '') + (c.s ? ' ws' : '') + (c.e ? ' we' : '') + (c.w ? ' ww' : ''))); }
      const put = (el, p) => { el.style.left = ((p[0] + .5) / W * 100) + '%'; el.style.top = ((p[1] + .5) / H * 100) + '%'; };
      const corners = R.shuffle(CORN.slice());
      const toks = q.ch.map((c, k) => { const el = h('div', 'mz-tok pop-in', lbl(c, q)); el.dataset.ok = c.ok ? 1 : 0; put(el, corners[k]); field.appendChild(el); return { c, p: corners[k], el }; });
      let pos = start.slice(), done = false;
      const me = h('div', 'mz-me', heroTok()); put(me, pos); field.appendChild(me);
      st.appendChild(dpad(d => move(d)));
      const key = d => d[0] === 1 ? 'e' : d[0] === -1 ? 'w' : d[1] === 1 ? 's' : 'n';
      const move = (d, n) => {
        if (done) return;
        for (let i = 0; i < (n || 1); i++) {
          if (wall[pos[1]][pos[0]][key(d)]) { if (i === 0) { me.classList.remove('bumpw'); void me.offsetWidth; me.classList.add('bumpw'); Audio2.sfx('bump', .2); } break; }
          pos = [pos[0] + d[0], pos[1] + d[1]]; put(me, pos); Audio2.sfx('tick', .12);
          const t = toks.find(t => t.p[0] === pos[0] && t.p[1] === pos[1]);
          if (t) {
            done = true; offK(); t.el.classList.add(t.c.ok ? 'found' : 'wrongfound'); Audio2.sfx(t.c.ok ? 'gem' : 'bump', .5);
            if (!t.c.ok && t.c.s) Voice.say(t.c.s, t.c.l);
            setTimeout(() => res({ ok: t.c.ok, el: t.el, correctEl: toks.find(z => z.c.ok).el }), 250); return;
          }
        }
      };
      const offK = onKeys(d => { if (!live(S, field)) return offK(); move(d); });
      field.addEventListener('pointerdown', e => {
        const r = field.getBoundingClientRect(), cx = Math.floor((e.clientX - r.left) / r.width * W), cy = Math.floor((e.clientY - r.top) / r.height * H);
        const dx = cx - pos[0], dy = cy - pos[1]; if (!dx && !dy) return;
        if (Math.abs(dx) >= Math.abs(dy)) move([Math.sign(dx), 0], Math.abs(dx)); else move([0, Math.sign(dy)], Math.abs(dy));
      });
      hydrate(field); P.speak();
      S.auto = () => {
        const goal = toks.find(t => t.c.ok).p, prev = {}, Q = [pos], k0 = pos + '';
        prev[k0] = null;
        while (Q.length) {
          const c = Q.shift(); if (c[0] === goal[0] && c[1] === goal[1]) break;
          for (const [k, [dx, dy]] of Object.entries(D)) { if (wall[c[1]][c[0]][k]) continue; const n = [c[0] + dx, c[1] + dy]; if (n + '' in prev) continue; if (toks.some(t => !t.c.ok && t.p + '' === n + '')) continue; prev[n + ''] = c; Q.push(n); }
        }
        let cur = goal, p = prev[goal + ''];
        while (p && p + '' !== k0) { cur = p; p = prev[p + '']; }
        if (p !== undefined) move([cur[0] - pos[0], cur[1] - pos[1]]);
      };
    }), () => sleep(400));
  }

  /* 3. 跑酷 */
  function runner(S, qs) {
    return runQs(S, qs, q => new Promise(res => {
      trimCh(q, 3); const n = q.ch.length;
      const { st, P } = scene(S, q, 'runner');
      const field = h('div', 'rn-field', '<div class="rn-road"><i></i><i></i><i></i></div><div class="rn-side l"></div><div class="rn-side r"></div>');
      st.appendChild(field);
      const laneX = (i, z) => 50 + (i - (n - 1) / 2) * (9 + 24 * z);
      const gates = q.ch.map(c => { const g = h('div', 'rn-gate', '<div class="rg-arch">' + lbl(c, q) + '</div>'); g.dataset.ok = c.ok ? 1 : 0; field.appendChild(g); return g; });
      const me = h('div', 'rn-me', heroTok('walk_a')); field.appendChild(me);
      let lane = Math.floor(n / 2), done = false, frame = 0;
      const setLane = i => { i = Math.max(0, Math.min(n - 1, i)); if (i !== lane) Audio2.sfx('whoosh', .15); lane = i; me.style.left = laneX(lane, 1) + '%'; };
      setLane(lane); me.style.left = laneX(lane, 1) + '%';
      gates.forEach((g, i) => g.addEventListener('pointerdown', e => { e.stopPropagation(); setLane(i); }));
      field.addEventListener('pointerdown', e => { const r = field.getBoundingClientRect(); setLane(lane + ((e.clientX - r.left) < r.width / 2 ? -1 : 1)); });
      const offK = onKeys(d => { if (d[0]) setLane(lane + d[0]); });
      const T = Math.max(3.4, 7 - S.grade * .7) * 1000, t0 = performance.now() + 900;
      const img = me.querySelector('img');
      const loop = now => {
        if (done || !live(S, field)) return offK();
        if (img && ++frame % 9 === 0) img.src = img.src.includes('walk_a') ? img.src.replace('walk_a', 'walk_b') : img.src.replace('walk_b', 'walk_a');
        const z = Math.max(0, Math.min(1, (now - t0) / T));
        gates.forEach((g, i) => { g.style.left = laneX(i, z) + '%'; g.style.top = (16 + Math.pow(z, 1.4) * 58) + '%'; g.style.transform = 'translate(-50%,-100%) scale(' + (.3 + .75 * z) + ')'; g.style.opacity = Math.min(1, z * 4); });
        if (z >= 1) {
          done = true; offK(); const c = q.ch[lane], g = gates[lane];
          g.classList.add(c.ok ? 'pass' : 'crash'); me.classList.add(c.ok ? 'cheer' : 'trip'); Audio2.sfx(c.ok ? 'coin' : 'bump', .5);
          if (!c.ok && c.s) Voice.say(c.s, c.l);
          return res({ ok: c.ok, el: g, correctEl: gates[okIdx(q)] });
        }
        requestAnimationFrame(loop);
      };
      tip(field, '左右切换跑道，穿过正确答案的门！');
      hydrate(field); P.speak(); requestAnimationFrame(loop);
      S.auto = () => setLane(okIdx(q));
    }), () => sleep(500));
  }

  /* 4. 飞跃之门 */
  function flappy(S, qs) {
    return runQs(S, qs, q => new Promise(res => {
      trimCh(q, 4); const n = q.ch.length;
      const { st, P } = scene(S, q, 'flappy');
      const field = h('div', 'fp-field', '<div class="fp-hills"></div>'); st.appendChild(field);
      const bird = h('div', 'fp-bird', petTok()); field.appendChild(bird);
      const wall = h('div', 'fp-wall');
      q.ch.forEach(c => { const s = h('div', 'fp-slot', lbl(c, q)); s.dataset.ok = c.ok ? 1 : 0; wall.appendChild(s); });
      field.appendChild(wall);
      const t0 = tip(field, '点击屏幕让我飞，从正确答案的门穿过去！');
      let y = .5, vy = 0, x = 1.05, started = false, done = false, last = performance.now(), idle = performance.now();
      const flap = () => { if (done) return; if (!started) { started = true; t0.remove(); } vy = -1.0; Audio2.sfx('jump', .2); bird.classList.remove('flap'); void bird.offsetWidth; bird.classList.add('flap'); };
      field.addEventListener('pointerdown', flap);
      const offK = onKeys(d => { if (d[1] === -1) flap(); });
      const loop = now => {
        if (done || !live(S, field)) return offK();
        const dt = Math.min(.04, (now - last) / 1000); last = now;
        if (!started && now - idle > 3500) { started = true; t0.remove(); }
        if (started) { vy += 2.5 * dt; y += vy * dt; x -= (.13 + S.grade * .018) * dt; } else y = .5 + Math.sin(now / 300) * .03;
        if (y < .05) { y = .05; vy = 0; } if (y > .95) { y = .95; vy = 0; }
        bird.style.top = (y * 100) + '%'; bird.style.transform = 'translate(-50%,-50%) rotate(' + Math.max(-25, Math.min(50, vy * 40)) + 'deg)';
        wall.style.left = (x * 100) + '%';
        if (x <= .2) {
          done = true; offK(); const i = Math.min(n - 1, Math.floor(y * n)), c = q.ch[i], el = wall.children[i];
          el.classList.add(c.ok ? 'pass' : 'crash'); Audio2.sfx(c.ok ? 'coin' : 'bump', .5);
          if (!c.ok && c.s) Voice.say(c.s, c.l);
          return res({ ok: c.ok, el, correctEl: wall.children[okIdx(q)] });
        }
        requestAnimationFrame(loop);
      };
      hydrate(field); P.speak(); requestAnimationFrame(loop);
      S.auto = () => { const ty = (okIdx(q) + .5) / n; if (!started) flap(); else if (y > ty + .02 && vy > -.3) flap(); };
    }), () => sleep(400));
  }

  /* 5. 神箭手 */
  function archery(S, qs) {
    return runQs(S, qs, q => new Promise(res => {
      trimCh(q, 4); const n = q.ch.length;
      const { st, P } = scene(S, q, 'archery');
      const field = h('div', 'ar-field'); st.appendChild(field);
      const targets = q.ch.map((c, i) => { const el = h('div', 'ar-target', '<div class="ar-board"></div><div class="ar-label">' + lbl(c, q) + '</div>'); el.dataset.ok = c.ok ? 1 : 0; field.appendChild(el); return { c, el, base: (i + .5) / n, x: (i + .5) / n }; });
      const bow = h('div', 'ar-bow', '<div class="ar-aim"></div>' + E('🏹')); field.appendChild(bow);
      const arrow = h('div', 'ar-arrow'); field.appendChild(arrow);
      const t0 = tip(field, '瞄准正确答案，点一下射箭！');
      const TY = .2, BY = .86, amp = S.grade >= 2 ? .05 : 0;
      let ang = 0, fly = null, done = false, frozen = false, last = performance.now(), t = 0;
      const fire = () => { if (done || fly) return; t0.remove(); fly = { a: ang, y: BY, x: .5 }; Audio2.sfx('throw', .4); };
      field.addEventListener('pointerdown', fire);
      const offK = onKeys(d => { if (d[1] === -1) fire(); });
      const loop = now => {
        if (done || !live(S, field)) return offK();
        const dt = Math.min(.04, (now - last) / 1000); last = now; t += dt;
        const W = field.clientWidth, H = field.clientHeight;
        if (!frozen) ang = Math.sin(t * (1.2 + S.grade * .15)) * .9;
        targets.forEach((tg, i) => { if (!frozen) tg.x = tg.base + Math.sin(t * .8 + i * 1.7) * amp; tg.el.style.left = (tg.x * 100) + '%'; });
        bow.style.transform = 'translate(-50%,-50%) rotate(' + ang + 'rad)';
        if (fly) {
          fly.y -= 2.4 * dt; fly.x = .5 + Math.tan(fly.a) * (BY - fly.y) * H / W;
          Object.assign(arrow.style, { display: 'block', left: (fly.x * 100) + '%', top: (fly.y * 100) + '%', transform: 'translate(-50%,-50%) rotate(' + fly.a + 'rad)' });
          if (fly.y <= TY && fly.y > TY - .1) {
            const hw = targets[0].el.offsetWidth / 2 / W;
            const hit = targets.find(tg => Math.abs(tg.x - fly.x) < hw);
            if (hit) {
              done = true; offK(); hit.el.classList.add(hit.c.ok ? 'hit-ok' : 'hit-bad'); arrow.classList.add('stuck'); Audio2.sfx(hit.c.ok ? 'hit' : 'bump', .6);
              if (!hit.c.ok && hit.c.s) Voice.say(hit.c.s, hit.c.l);
              return res({ ok: hit.c.ok, el: hit.el, correctEl: targets.find(z => z.c.ok).el });
            }
          }
          if (fly.y < -.1 || fly.x < -.1 || fly.x > 1.1) { fly = null; arrow.style.display = 'none'; frozen = false; UI.toast('没射中，再来一次！', 900); }
        }
        requestAnimationFrame(loop);
      };
      hydrate(field); P.speak(); requestAnimationFrame(loop);
      S.auto = () => { if (fly) return; const tg = targets.find(z => z.c.ok), W = field.clientWidth, H = field.clientHeight; frozen = true; ang = Math.atan((tg.x - .5) * W / ((BY - TY) * H)); fire(); };
    }), () => sleep(500));
  }

  /* 6. 拆弹专家 */
  function bomb(S, qs) {
    const COLS = ['#ff4d4d', '#3d8bff', '#ffd23f', '#2ecc71'];
    return runQs(S, qs, q => new Promise(res => {
      trimCh(q, 4);
      const { st, P } = scene(S, q, 'bomb');
      const T = Math.max(9, 18 - S.grade * 2);
      const box = h('div', 'bm-box', '<div class="bm-bomb"><div class="bm-body">' + E('💣') + '</div><div class="bm-time latin">' + T + '</div></div><svg class="bm-wires"></svg><div class="bm-ends"></div>');
      st.appendChild(box);
      const ends = box.querySelector('.bm-ends'), svg = box.querySelector('svg'), body = box.querySelector('.bm-body');
      q.ch.forEach((c, i) => { const e = h('button', 'bm-end', '<i style="background:' + COLS[i] + '"></i><div>' + lbl(c, q) + '</div>'); e.dataset.ok = c.ok ? 1 : 0; e.onclick = () => cut(i); ends.appendChild(e); });
      hydrate(box);
      const drawWires = () => {
        if (!box.isConnected) return;
        const br = box.getBoundingClientRect(), b = body.getBoundingClientRect();
        svg.setAttribute('viewBox', '0 0 ' + br.width + ' ' + br.height);
        svg.innerHTML = [...ends.children].map((e, i) => {
          const r = e.getBoundingClientRect(), x1 = b.right - br.left - 12, y1 = b.top - br.top + b.height / 2 + (i - (q.ch.length - 1) / 2) * 12, x2 = r.left - br.left + 4, y2 = r.top - br.top + r.height / 2;
          return '<path data-i="' + i + '" d="M' + x1 + ' ' + y1 + ' C' + (x1 + 90) + ' ' + y1 + ',' + (x2 - 90) + ' ' + y2 + ',' + x2 + ' ' + y2 + '" stroke="' + COLS[i] + '"/>';
        }).join('');
        svg.querySelectorAll('path').forEach(p => p.onclick = () => cut(+p.dataset.i));
      };
      setTimeout(drawWires, 60);
      let done = false, t0 = 0, lastSec = T;
      const boom = () => { box.classList.add('boom'); body.innerHTML = E('💥'); hydrate(body); Audio2.sfx('hurt', .5); };
      const cut = i => {
        if (done) return; done = true; const c = q.ch[i], p = svg.querySelector('path[data-i="' + i + '"]'); if (p) p.classList.add('cut');
        Audio2.sfx('pluck', .5);
        setTimeout(() => {
          if (c.ok) { box.classList.add('defused'); body.innerHTML = E('🎉'); hydrate(body); } else { boom(); if (c.s) Voice.say(c.s, c.l); }
          res({ ok: c.ok, el: ends.children[i], correctEl: ends.children[okIdx(q)] });
        }, 350);
      };
      const tick = now => {
        if (done || !live(S, box)) return;
        if (!t0) t0 = now;
        const left = T - (now - t0) / 1000, sec = Math.max(0, Math.ceil(left));
        if (sec !== lastSec) { lastSec = sec; box.querySelector('.bm-time').textContent = sec; if (sec <= 3) { box.classList.add('hurry'); Audio2.sfx('tick', .4); } }
        if (left <= 0) { done = true; boom(); UI.toast('时间到！', 900); return res({ ok: false, el: null, correctEl: ends.children[okIdx(q)] }); }
        requestAnimationFrame(tick);
      };
      setTimeout(() => requestAnimationFrame(tick), 700);
      P.speak();
      S.auto = () => cut(okIdx(q));
    }), () => sleep(600));
  }

  /* 7. 井字棋 */
  async function tictac(S, qs) {
    const st = S.stage; st.className = 'stage scene-tictac'; st.innerHTML = '';
    const ME = '⭐', AI = '🌙';
    const head = h('div', 'vs-head', '<span>' + heroTok() + '<b>你 ' + E(ME) + '</b></span><i class="latin">VS</i><span>' + E('🤖') + '<b>小智 ' + E(AI) + '</b></span>');
    const wrap = h('div', 'tt-wrap'), board = h('div', 'tt-board'), side = h('div', 'tt-side');
    for (let i = 0; i < 9; i++) board.appendChild(h('button', 'tt-cell'));
    wrap.appendChild(board); wrap.appendChild(side); st.appendChild(head); st.appendChild(wrap); hydrate(st);
    const cells = [...board.children], B = Array(9).fill(null);
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const empty = () => B.map((v, i) => v ? null : i).filter(i => i != null);
    const winner = () => { for (const l of LINES) if (B[l[0]] && B[l[0]] === B[l[1]] && B[l[1]] === B[l[2]]) return { w: B[l[0]], l }; return empty().length ? null : { w: 'draw' }; };
    const mark = (i, who) => { B[i] = who; cells[i].innerHTML = E(who === 'me' ? ME : AI); cells[i].classList.add('on', who); Audio2.sfx(who === 'me' ? 'select' : 'drop', .4); };
    const best = who => {
      const other = who === 'me' ? 'ai' : 'me';
      for (const w of [who, other]) for (const l of LINES) { const v = l.map(i => B[i]); if (v.filter(x => x === w).length === 2 && v.includes(null)) return l[v.indexOf(null)]; }
      if (!B[4]) return 4; const cs = [0, 2, 6, 8].filter(i => !B[i]); return cs.length ? R.pick(cs) : R.pick(empty());
    };
    const aiMove = async () => { if (!empty().length) return; await sleep(450); mark(Math.random() < .5 + S.grade * .08 ? best('ai') : R.pick(empty()), 'ai'); };
    const nextQ = nextQFrom(S, qs);
    let turn = 0;
    while (!S.over) {
      const w = winner();
      if (w) {
        if (w.l) w.l.forEach(i => cells[i].classList.add('win'));
        await sleep(600);
        if (w.w === 'me') { UI.confetti(70); await Voice.say('你赢了！'); S.end(false, accStars(S)); }
        else if (w.w === 'draw') { await Voice.say('平局！'); S.end(false, accStars(S) >= 2 ? 2 : 1); }
        else { await Voice.say('这次小智赢了，再来一局吧！'); S.end(false, 1); }
        return;
      }
      S.setProgress(Math.min(turn++, 5), 5);
      const q = nextQ();
      const r = await ask(S, side, q);
      if (S.over) return;
      if (r.ok) {
        await S.good(r.el, q);
        side.innerHTML = '<div class="tt-place">' + E('👆') + ' 答对啦！点棋盘放下你的 ' + E(ME) + '</div>'; hydrate(side);
        await new Promise(resv => {
          board.classList.add('pick');
          cells.forEach((c, i) => c.onclick = () => { if (B[i]) return; board.classList.remove('pick'); cells.forEach(x => x.onclick = null); mark(i, 'me'); resv(); });
          S.auto = () => { if (!empty().length) return; const c = cells[best('me')]; c && c.click(); };
        });
        if (winner()) continue;
        await aiMove();
      } else {
        if (!await S.bad(r.el, q, r.correctEl)) return;
        await aiMove();
      }
    }
  }

  /* 8. 打砖块 */
  function breakout(S, qs) {
    return runQs(S, qs, q => new Promise(res => {
      trimCh(q, 4); const n = q.ch.length;
      const { st, P } = scene(S, q, 'breakout');
      const field = h('div', 'bo-field'); st.appendChild(field);
      const deco = h('div', 'bo-deco'); for (let i = 0; i < 24; i++) deco.appendChild(h('i')); field.appendChild(deco);
      const bricks = q.ch.map((c, i) => { const b = h('div', 'bo-brick', lbl(c, q)); b.dataset.ok = c.ok ? 1 : 0; b.style.left = (i / n * 100) + '%'; b.style.width = (100 / n) + '%'; b.style.setProperty('--hue', i * 80 + 200); field.appendChild(b); return b; });
      const pad = h('div', 'bo-paddle'), ball = h('div', 'bo-ball'); field.appendChild(pad); field.appendChild(ball);
      const t0 = tip(field, '移动挡板，点一下发球，打中正确答案的砖块！');
      const PW = 130, BR = 11;
      let px = .5, bx = 0, by = 0, vx = 0, vy = 0, held = true, done = false, last = performance.now();
      const launch = a => { if (!held || done) return; held = false; t0.remove(); const sp = 430 + S.grade * 40; a = a != null ? a : (Math.random() - .5) * .9; vx = Math.sin(a) * sp; vy = -Math.cos(a) * sp; Audio2.sfx('throw', .3); };
      const setPx = e => { const r = field.getBoundingClientRect(); px = (e.clientX - r.left) / r.width; };
      field.addEventListener('pointermove', setPx);
      field.addEventListener('pointerdown', e => { setPx(e); launch(); });
      const offK = onKeys(d => { if (d[0]) px = Math.max(0, Math.min(1, px + d[0] * .08)); if (d[1] === -1) launch(); });
      const loop = now => {
        if (done || !live(S, field)) return offK();
        const dt = Math.min(.025, (now - last) / 1000); last = now;
        const W = field.clientWidth, H = field.clientHeight, padX = Math.max(PW / 2, Math.min(W - PW / 2, px * W)), padY = H - 26;
        pad.style.left = padX + 'px';
        if (held) { bx = padX; by = padY - 12 - BR; }
        else {
          bx += vx * dt; by += vy * dt;
          if (bx < BR) { bx = BR; vx = Math.abs(vx); } if (bx > W - BR) { bx = W - BR; vx = -Math.abs(vx); } if (by < BR) { by = BR; vy = Math.abs(vy); }
          if (vy > 0 && by + BR >= padY - 8 && by < padY + 10 && Math.abs(bx - padX) < PW / 2 + BR) {
            const sp = Math.hypot(vx, vy), a = (bx - padX) / (PW / 2) * 1.05; vx = Math.sin(a) * sp; vy = -Math.cos(a) * sp; by = padY - 8 - BR;
            Audio2.sfx('bump', .2); pad.classList.remove('bop'); void pad.offsetWidth; pad.classList.add('bop');
          }
          const fr = field.getBoundingClientRect();
          for (let i = 0; i < n; i++) {
            const r = bricks[i].getBoundingClientRect(), x0 = r.left - fr.left, y0 = r.top - fr.top;
            if (bx + BR > x0 && bx - BR < x0 + r.width && by + BR > y0 && by - BR < y0 + r.height) {
              done = true; offK(); const c = q.ch[i]; bricks[i].classList.add(c.ok ? 'smash' : 'crack'); ball.style.opacity = 0; Audio2.sfx(c.ok ? 'hit' : 'bump', .6);
              if (!c.ok && c.s) Voice.say(c.s, c.l);
              return res({ ok: c.ok, el: bricks[i], correctEl: bricks[okIdx(q)] });
            }
          }
          if (by > H + 20) { held = true; UI.toast('球掉啦，再发一次！', 900); }
        }
        ball.style.transform = 'translate(' + (bx - BR) + 'px,' + (by - BR) + 'px)';
        requestAnimationFrame(loop);
      };
      hydrate(field); P.speak(); requestAnimationFrame(loop);
      S.auto = () => { if (!held) return; const r = bricks[okIdx(q)].getBoundingClientRect(), fr = field.getBoundingClientRect(); px = (r.left - fr.left + r.width / 2) / fr.width; setTimeout(() => launch(0), 80); };
    }), () => sleep(500));
  }

  /* 9. 飞行棋 */
  async function board(S, qs) {
    const st = S.stage; st.className = 'stage scene-board'; st.innerHTML = '';
    const N = 24, COLS = 8, ROWS = 3, JUMP = { 3: 10, 8: 14, 15: 20 }, SLIDE = { 12: 5, 18: 11, 22: 16 };
    const head = h('div', 'vs-head', '<span>' + heroTok() + '<b>你</b></span><i class="latin">VS</i><span>' + E('🤖') + '<b>小智</b></span>');
    const bd = h('div', 'bd-board');
    for (let i = 0; i < N; i++) {
      const row = Math.floor(i / COLS), col = row % 2 ? COLS - 1 - (i % COLS) : i % COLS;
      const c = h('div', 'bd-cell' + (JUMP[i] ? ' up' : '') + (SLIDE[i] ? ' down' : '') + (i === N - 1 ? ' goal' : '') + (i === 0 ? ' start' : ''), '<small class="latin">' + (i + 1) + '</small>' + (JUMP[i] ? E('🚀') : SLIDE[i] ? E('🌀') : i === N - 1 ? E('🏆') : i === 0 ? E('🚩') : ''));
      c.style.gridColumn = col + 1; c.style.gridRow = ROWS - row; bd.appendChild(c);
    }
    const side = h('div', 'bd-side'), wrap = h('div', 'bd-wrap'); wrap.appendChild(bd); wrap.appendChild(side);
    st.appendChild(head); st.appendChild(wrap);
    const cellsEl = [...bd.children], me = h('div', 'bd-tok me', heroTok()), ai = h('div', 'bd-tok ai', E('🤖'));
    const pos = { me: 0, ai: 0 }, place = (tok, i) => cellsEl[i].appendChild(tok);
    place(me, 0); place(ai, 0); hydrate(st);
    const dice = () => new Promise(resv => {
      side.innerHTML = '<button class="bd-dice">' + E('🎲') + '<b>掷骰子</b></button>'; hydrate(side);
      const b = side.querySelector('.bd-dice');
      b.onclick = async () => { if (b.disabled) return; b.disabled = true; Audio2.sfx('scroll', .4); let v = 1; for (let k = 0; k < 9; k++) { v = R.int(1, 6); b.innerHTML = '<span class="bd-num latin">' + v + '</span>'; await sleep(70); } await sleep(300); resv(v); };
      S.auto = () => b.click();
    });
    const walk = async (who, steps) => {
      const tok = who === 'me' ? me : ai, name = who === 'me' ? '你' : '小智';
      for (let k = 0; k < steps && pos[who] < N - 1; k++) { pos[who]++; place(tok, pos[who]); Audio2.sfx('tick', .25); await sleep(220); }
      const p = pos[who];
      if (JUMP[p]) { await sleep(250); pos[who] = JUMP[p]; place(tok, pos[who]); Audio2.sfx('magic', .4); UI.toast(E('🚀') + ' ' + name + '坐火箭飞到第 ' + (pos[who] + 1) + ' 格！', 1100); }
      else if (SLIDE[p]) { await sleep(250); pos[who] = SLIDE[p]; place(tok, pos[who]); Audio2.sfx('poof', .4); UI.toast(E('🌀') + ' ' + name + '掉进漩涡，退回第 ' + (pos[who] + 1) + ' 格', 1100); }
      await sleep(300);
    };
    const nextQ = nextQFrom(S, qs);
    for (let turn = 0; turn < 40 && !S.over; turn++) {
      S.setProgress(Math.round(pos.me / (N - 1) * 8), 8);
      const q = nextQ(), r = await ask(S, side, q);
      if (S.over) return;
      if (r.ok) { await S.good(r.el, q); await walk('me', await dice()); }
      else if (!await S.bad(r.el, q, r.correctEl)) return;
      if (pos.me >= N - 1) { S.setProgress(8, 8); UI.confetti(90); await Voice.say('你第一个到达终点！'); return S.end(false, accStars(S)); }
      side.innerHTML = '<div class="tt-place">' + E('🤖') + ' 小智掷骰子…</div>'; hydrate(side); await sleep(500);
      const v2 = R.int(1, S.grade >= 3 ? 5 : 4); UI.toast('小智掷出了 ' + v2, 800); await walk('ai', v2);
      if (pos.ai >= N - 1) { await Voice.say('小智先到终点啦，下次加油！'); return S.end(false, 1); }
    }
  }

  /* 10. 找一找 */
  const DECOY = ['🍎', '🍌', '🍇', '🍉', '🍓', '🐱', '🐶', '🐰', '🐼', '🦁', '🐸', '🐟', '🚗', '🚌', '✈️', '⚽', '🎈', '🌸', '🌳', '⭐', '🌙', '☀️', '🍄', '🧸', '🎁', '🦋', '🐝', '🍦', '🍩', '🥕', '🌽', '🐢', '🐧', '🦒', '🚀', '📚', '✏️', '🎨', '🎵', '🔑', '🐘', '🐵', '🍒', '🍋', '🚲', '☂️', '🧢', '👟'];
  function findit(S, qs) {
    return runQs(S, qs, q => new Promise(res => {
      const { st, P } = scene(S, q, 'findit');
      const field = h('div', 'fd-field'); st.appendChild(field);
      const C = S.grade <= 1 ? 7 : 9, RW = S.grade <= 1 ? 4 : 5;
      const used = new Set(q.ch.map(c => c.e)), decoys = DECOY.filter(e => !used.has(e));
      let done = false;
      R.shuffle([...Array(C * RW).keys()]).slice(0, Math.floor(C * RW * .85)).forEach((ci, k) => {
        const isCh = k < q.ch.length, c = isCh ? q.ch[k] : null;
        const el = h('div', 'fd-it' + (isCh ? ' ch' : ''), isCh ? lbl(c, q) : E(R.pick(decoys)));
        el.style.left = ((ci % C + .5 + (Math.random() - .5) * .5) / C * 100) + '%';
        el.style.top = ((Math.floor(ci / C) + .5 + (Math.random() - .5) * .4) / RW * 100) + '%';
        el.style.setProperty('--r', R.int(-25, 25) + 'deg'); el.style.setProperty('--s', (.8 + Math.random() * .45).toFixed(2));
        if (isCh) el.dataset.ok = c.ok ? 1 : 0;
        el.onpointerdown = () => {
          if (done) return;
          if (!isCh) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); Audio2.sfx('tick', .3); return; }
          done = true; el.classList.add(c.ok ? 'found' : 'wrongfound'); Audio2.sfx(c.ok ? 'gem' : 'bump', .5);
          if (!c.ok && c.s) Voice.say(c.s, c.l);
          res({ ok: c.ok, el, correctEl: field.querySelector('.fd-it.ch[data-ok="1"]') });
        };
        field.appendChild(el);
      });
      hydrate(field); P.speak();
      S.auto = () => { const el = field.querySelector('.fd-it.ch[data-ok="1"]'); el && el.onpointerdown(); };
    }), () => sleep(400));
  }

  /* 11. 描红写字 */
  function trace(S, rounds) {
    const st = S.stage; st.className = 'stage scene-trace';
    return new Promise(async resolve => {
      if (document.fonts) await document.fonts.ready;
      for (let r = 0; r < rounds.length; r++) {
        if (S.over) return resolve();
        S.setProgress(r, rounds.length);
        const rd = rounds[r]; st.innerHTML = '';
        const P = h('div', 'qpanel slim', '<div class="qtext">描一描：<b class="' + (rd.font === 'latin' ? 'latin' : '') + '">' + esc(rd.ch) + '</b>' + (rd.sub ? ' <small class="latin">' + esc(rd.sub) + '</small>' : '') + (rd.e ? ' ' + E(rd.e) : '') + ' <button class="say">' + E('🔊') + '</button></div>');
        st.appendChild(P); hydrate(P); P.querySelector('.say').onclick = () => Voice.say(rd.s, rd.l); Voice.say(rd.s, rd.l);
        const wrap = h('div', 'tr-wrap'); st.appendChild(wrap);
        const pad = h('div', 'tr-pad'), guide = document.createElement('canvas'), ink = document.createElement('canvas'); pad.appendChild(guide); pad.appendChild(ink); wrap.appendChild(pad);
        const ctl = h('div', 'tr-ctl', '<div class="tr-meter"><i></i></div><button class="btn ghost sm tr-clear">擦掉重写</button><button class="btn tr-done">写好了 ✓</button>'); wrap.appendChild(ctl);
        const size = Math.max(220, Math.min(wrap.clientWidth - 40, st.clientHeight - P.offsetHeight - 60, 420));
        const dpr = devicePixelRatio || 1;
        [guide, ink].forEach(c => { c.width = c.height = Math.round(size * dpr); c.style.width = c.style.height = size + 'px'; });
        pad.style.width = pad.style.height = size + 'px';
        const g = guide.getContext('2d'); g.scale(dpr, dpr);
        g.strokeStyle = 'rgba(220,60,60,.6)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, size - 3, size - 3);
        g.setLineDash([8, 8]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(size / 2, 0); g.lineTo(size / 2, size); g.moveTo(0, size / 2); g.lineTo(size, size / 2); g.moveTo(0, 0); g.lineTo(size, size); g.moveTo(size, 0); g.lineTo(0, size); g.stroke(); g.setLineDash([]);
        const latin = rd.font === 'latin', fam = latin ? 'Fredoka, sans-serif' : '"Kaiti SC","STKaiti","KaiTi","BiauKai","ZK",serif';
        const fontAt = px => (latin ? '600 ' : '') + px + 'px ' + fam, fs = latin ? .74 : .8;
        g.fillStyle = 'rgba(120,130,160,.3)'; g.font = fontAt(size * fs); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(rd.ch, size / 2, size / 2 + size * .03);
        const GN = 48, mc = document.createElement('canvas'); mc.width = mc.height = GN;
        const m = mc.getContext('2d'); m.font = fontAt(GN * fs); m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillText(rd.ch, GN / 2, GN / 2 + GN * .03);
        const md = m.getImageData(0, 0, GN, GN).data, glyph = new Uint8Array(GN * GN); let gTot = 0;
        for (let i = 0; i < GN * GN; i++) if (md[i * 4 + 3] > 100) { glyph[i] = 1; gTot++; }
        const near = new Uint8Array(GN * GN);
        for (let y = 0; y < GN; y++) for (let x = 0; x < GN; x++) if (glyph[y * GN + x]) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < GN && yy < GN) near[yy * GN + xx] = 1; }
        const painted = new Uint8Array(GN * GN);
        const k = ink.getContext('2d'); k.scale(dpr, dpr); k.lineCap = k.lineJoin = 'round'; k.lineWidth = size * .075;
        k.strokeStyle = k.fillStyle = (getComputedStyle(document.body).getPropertyValue('--brush') || '').trim() || '#1d2340';
        const stamp = (x, y) => { const gx = Math.floor(x / size * GN), gy = Math.floor(y / size * GN), rr = 2; for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const xx = gx + dx, yy = gy + dy; if (xx >= 0 && yy >= 0 && xx < GN && yy < GN && dx * dx + dy * dy <= rr * rr) painted[yy * GN + xx] = 1; } };
        const score = () => { let cov = 0, out = 0, tot = 0; for (let i = 0; i < GN * GN; i++) if (painted[i]) { tot++; if (glyph[i]) cov++; else if (!near[i]) out++; } return { cov: cov / Math.max(1, gTot), out: tot ? out / tot : 0 }; };
        const meter = () => { ctl.querySelector('.tr-meter i').style.width = Math.min(100, score().cov / .55 * 100) + '%'; };
        let last = null;
        const pt = e => { const b = ink.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * size, (e.clientY - b.top) / b.height * size]; };
        ink.style.touchAction = 'none';
        ink.onpointerdown = e => { ink.setPointerCapture(e.pointerId); last = pt(e); stamp(last[0], last[1]); k.beginPath(); k.arc(last[0], last[1], k.lineWidth / 2, 0, 7); k.fill(); };
        ink.onpointermove = e => { if (!last) return; const p = pt(e); k.beginPath(); k.moveTo(last[0], last[1]); k.lineTo(p[0], p[1]); k.stroke(); const n = Math.ceil(Math.hypot(p[0] - last[0], p[1] - last[1]) / 3); for (let s = 1; s <= n; s++) stamp(last[0] + (p[0] - last[0]) * s / n, last[1] + (p[1] - last[1]) * s / n); last = p; meter(); };
        ink.onpointerup = ink.onpointercancel = () => { last = null; meter(); };
        let tries = 0, finished = false;
        await new Promise(done => {
          ctl.querySelector('.tr-clear').onclick = () => { k.clearRect(0, 0, size, size); painted.fill(0); meter(); Audio2.sfx('poof', .3); };
          const check = async () => {
            if (finished) return;
            const sc = score();
            if (sc.cov >= .55 && sc.out <= .32) {
              finished = true; S.right++; S.total++; pad.classList.add('good'); Audio2.sfx('right', .5);
              const b = pad.getBoundingClientRect(); UI.burst(b.left + b.width / 2, b.top + b.height / 2, '✨', 10);
              await Voice.say(R.pick(PRAISE)); return done();
            }
            tries++; S.wrong++; S.total++; Audio2.sfx('wrong', .4); pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake');
            if (tries >= 3) { finished = true; UI.toast('没关系，下一个继续加油！'); await sleep(900); return done(); }
            Voice.say(sc.out > .32 ? '写到外面啦，沿着灰色的字描哦' : '还没描满，把灰色的字都描黑吧');
          };
          ctl.querySelector('.tr-done').onclick = check;
          S.auto = () => { painted.set(glyph); check(); };
        });
      }
      if (!S.over) { S.setProgress(rounds.length, rounds.length); S.end(false); }
      resolve();
    });
  }

  /* 12. 天平平衡 */
  function balance(S, rounds) {
    const st = S.stage; st.className = 'stage scene-balance';
    return new Promise(async resolve => {
      let overs = 0;
      for (let r = 0; r < rounds.length; r++) {
        if (S.over) return resolve();
        S.setProgress(r, rounds.length);
        const rd = rounds[r]; st.innerHTML = '';
        const P = h('div', 'qpanel slim', '<div class="qtext">往右边放砝码，让天平平衡！ <button class="say">' + E('🔊') + '</button></div>');
        P.querySelector('.say').onclick = () => Voice.say('往右边放砝码，让天平平衡');
        const sc = h('div', 'bl-scale', '<div class="bl-post"></div><div class="bl-beam"><div class="bl-pan l"><div class="bl-load"><div class="bl-target latin">' + esc(rd.show) + '</div></div></div><div class="bl-pan r"><div class="bl-load rload"></div></div></div><div class="bl-sum latin"></div>');
        const tray = h('div', 'bl-tray');
        rd.weights.forEach(w => { const b = h('button', 'bl-w', '<b class="latin">' + w + '</b>'); b.dataset.w = w; tray.appendChild(b); });
        st.appendChild(P); st.appendChild(sc); st.appendChild(tray); hydrate(st);
        if (r === 0) Voice.say('往右边放砝码，让天平平衡');
        const on = [];
        await new Promise(done => {
          let finished = false;
          const upd = async added => {
            const sum = on.reduce((a, b) => a + b, 0), diff = sum - rd.target;
            sc.style.setProperty('--ang', Math.max(-16, Math.min(16, diff / Math.max(4, rd.target * .4) * 16)) + 'deg');
            const s = sc.querySelector('.bl-sum'); s.textContent = sum + (diff === 0 ? ' = ' : diff > 0 ? ' > ' : ' < ') + rd.show; s.className = 'bl-sum latin' + (diff > 0 ? ' heavy' : diff === 0 ? ' even' : '');
            if (diff === 0 && !finished) {
              finished = true; S.right++; S.total++; sc.classList.add('ok'); Audio2.sfx('right', .5);
              const b = sc.getBoundingClientRect(); UI.burst(b.left + b.width / 2, b.top + b.height / 3, '⭐', 10);
              await Voice.say('平衡啦！'); await sleep(300); done();
            } else if (diff > 0 && added) { overs++; Audio2.sfx('bump', .3); }
          };
          tray.onclick = e => {
            const b = e.target.closest('.bl-w'); if (!b || b.classList.contains('used') || finished) return;
            b.classList.add('used'); const w = +b.dataset.w; on.push(w);
            const blk = h('button', 'bl-w on pop-in', '<b class="latin">' + w + '</b>');
            blk.onclick = ev => { ev.stopPropagation(); if (finished) return; on.splice(on.indexOf(w), 1); blk.remove(); b.classList.remove('used'); Audio2.sfx('pop', .3); upd(false); };
            sc.querySelector('.rload').appendChild(blk); Audio2.sfx('drop', .4); upd(true);
          };
          S.auto = () => {
            const extra = on.filter(w => !rd.sol.includes(w)); if (extra.length) { [...sc.querySelectorAll('.rload .bl-w')].find(x => +x.textContent === extra[0]).click(); return; }
            const need = rd.sol.filter(w => !on.includes(w)); if (!need.length) return;
            const b = [...tray.children].find(x => +x.dataset.w === need[0] && !x.classList.contains('used')); b && b.click();
          };
          upd(false);
        });
      }
      if (!S.over) { S.setProgress(rounds.length, rounds.length); S.end(false, overs <= 1 ? 3 : overs <= 4 ? 2 : 1); }
      resolve();
    });
  }

  /* 13. 像素涂色 */
  const ARTS = [
    { n: '爱心', c: ['#ff4d6d', '#ffd6e0'], p: ['.11..11.', '12111111', '11111111', '11111111', '.111111.', '..1111..', '...11...', '........'] },
    { n: '小鱼', c: ['#ff9f43', '#2b3a67'], p: ['........', '..111..1', '.1121.11', '11111111', '.1111.11', '..111..1', '........', '........'] },
    { n: '小猫', c: ['#a0a7b8', '#ff8fb1', '#2b3a67'], p: ['1......1', '12....21', '11111111', '13111131', '11111111', '11122111', '.111111.', '..1111..'] },
    { n: '蘑菇', c: ['#ff4d4d', '#ffffff', '#f3d9a4'], p: ['..1111..', '.112211.', '11211211', '11111111', '..3333..', '..3333..', '..3333..', '........'] },
    { n: '小花', c: ['#ff6fae', '#ffd23f', '#3cb371'], p: ['..1..1..', '.111111.', '..1221..', '.112211.', '..1111..', '...33...', '.3.33.3.', '..3333..'] },
    { n: '苹果树', c: ['#3cb371', '#8b5a2b', '#ff4d4d'], p: ['...11...', '..1131..', '.111111.', '11311131', '.111111.', '...22...', '...22...', '..2222..'] },
    { n: '小房子', c: ['#e8505b', '#ffd23f', '#8b5a2b', '#5ec8ff'], p: ['...11...', '..1111..', '.111111.', '11111111', '.244222.', '.244232.', '.222232.', '.222232.'] },
    { n: '火箭', c: ['#c9d1e0', '#5ec8ff', '#ff4d4d', '#ffb02e'], p: ['...11...', '..1111..', '..1221..', '..1111..', '..1111..', '.311113.', '33.11.33', '...44...'] },
  ];
  function pixel(S, pairs) {
    const st = S.stage; st.className = 'stage scene-pixel';
    return new Promise(resolve => {
      const m = Math.min(4, pairs.length), art = R.pick(ARTS.filter(a => a.c.length <= m)), used = pairs.slice(0, art.c.length);
      st.innerHTML = '<div class="qpanel slim"><div class="qtext">像素涂色：先选一个颜色，再涂上和它配对的格子！</div></div>';
      const wrap = h('div', 'px-wrap'), grid = h('div', 'px-grid'), pal = h('div', 'px-pal');
      wrap.appendChild(grid); wrap.appendChild(pal); st.appendChild(wrap);
      const tag = c => c.e ? vis(c.e, 'pxemo') : '<span class="pxt' + (c.l === 'en' ? ' latin' : '') + '">' + esc(c.t) + '</span>';
      let sel = 0, miss = 0, left = 0, total = 0, down = false, finished = false;
      art.p.forEach(row => [...row].forEach(ch => { const k = ch === '.' ? 0 : +ch; const c = h('div', 'px-cell' + (k ? ' q' : ''), k ? tag(used[k - 1][0]) : ''); c.dataset.k = k; if (k) { left++; total++; } grid.appendChild(c); }));
      used.forEach((pr, i) => {
        const b = h('button', 'px-sw', '<i style="background:' + art.c[i] + '"></i><div>' + choiceHTML(pr[1]) + '</div>');
        b.onclick = () => { sel = i + 1; [...pal.children].forEach(x => x.classList.toggle('on', x === b)); Audio2.sfx('select', .3); if (pr[1].s) Voice.say(pr[1].s, pr[1].l); };
        pal.appendChild(b);
      });
      hydrate(wrap); S.setProgress(0, 8);
      const finish = async () => {
        if (finished) return; finished = true; grid.classList.add('reveal'); Audio2.sfx('win', .5); UI.confetti(70);
        S.right = total; S.total = total + miss; S.wrong = miss;
        await Voice.say('画好啦！是' + art.n); S.end(false, miss <= 2 ? 3 : miss <= 6 ? 2 : 1); resolve();
      };
      const paint = (c, tapped) => {
        if (!c || !c.classList.contains('q') || c.classList.contains('done') || finished) return;
        if (!sel) { if (tapped) UI.toast('先在右边选一个颜色哦', 900); return; }
        const k = +c.dataset.k;
        if (k === sel) { c.classList.add('done'); c.style.background = art.c[k - 1]; left--; Audio2.sfx('pop', .15); S.setProgress(Math.round((total - left) / total * 8), 8); if (!left) finish(); }
        else if (tapped) { miss++; c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); Audio2.sfx('wrong', .25); }
      };
      grid.style.touchAction = 'none';
      grid.onpointerdown = e => { down = true; paint(e.target.closest('.px-cell'), true); };
      grid.onpointermove = e => { if (!down) return; const t = document.elementFromPoint(e.clientX, e.clientY); paint(t && t.closest('.px-cell'), false); };
      const up = () => { down = false; if (!grid.isConnected) removeEventListener('pointerup', up); };
      addEventListener('pointerup', up);
      S.auto = () => { [...grid.querySelectorAll('.px-cell.q:not(.done)')].forEach(c => { sel = +c.dataset.k; paint(c, true); }); };
    });
  }

  /* 14. 节奏大师 */
  function rhythm(S, qs) {
    return runQs(S, qs, q => new Promise(res => {
      trimCh(q, 4); const n = q.ch.length;
      const { st, P } = scene(S, q, 'rhythm');
      const field = h('div', 'rh-field'); field.style.setProperty('--n', n); st.appendChild(field);
      for (let i = 0; i < n; i++) { const l = h('div', 'rh-lane'); l.style.left = (i / n * 100) + '%'; l.style.width = (100 / n) + '%'; field.appendChild(l); }
      field.appendChild(h('div', 'rh-line'));
      const pads = h('div', 'rh-pads');
      q.ch.forEach((c, i) => { const b = h('button', 'rh-pad'); b.style.setProperty('--hue', i * 90 + 10); b.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); hitLane(i); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }; pads.appendChild(b); });
      field.appendChild(pads);
      tip(field, '音符落到线上时点它！只点正确答案哦');
      const beat = Math.max(.6, 1.05 - S.grade * .08), fall = Math.max(2, 2.8 - S.grade * .15), HIT = .8;
      let notes = [], t0 = performance.now() + 900, k = 0, order = [], done = false;
      const yOf = (nt, now) => (now - nt.born) / 1000 / fall;
      const judge = nt => {
        if (done) return; const y = yOf(nt, performance.now());
        if (Math.abs(y - HIT) > .12) { nt.el.classList.remove('early'); void nt.el.offsetWidth; nt.el.classList.add('early'); return; }
        done = true; nt.el.classList.add(nt.c.ok ? 'hitok' : 'hitbad');
        if (nt.c.ok) field.appendChild(h('div', 'rh-judge latin', Math.abs(y - HIT) < .04 ? 'PERFECT!' : 'GOOD!'));
        Audio2.sfx(nt.c.ok ? 'gem' : 'bump', .5); if (!nt.c.ok && nt.c.s) Voice.say(nt.c.s, nt.c.l);
        res({ ok: nt.c.ok, el: nt.el, correctEl: null });
      };
      const spawn = now => {
        if (!order.length) order = R.shuffle([...Array(n).keys()]);
        const i = order.shift(), c = q.ch[i], el = h('div', 'rh-note', lbl(c, q));
        el.dataset.ok = c.ok ? 1 : 0; el.style.left = ((i + .5) / n * 100) + '%'; el.style.setProperty('--hue', i * 90 + 10);
        field.appendChild(el); hydrate(el);
        const nt = { i, c, el, born: now };
        el.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); judge(nt); };
        notes.push(nt);
      };
      const hitLane = i => { const now = performance.now(); const c = notes.filter(nt => nt.i === i).sort((a, b) => Math.abs(yOf(a, now) - HIT) - Math.abs(yOf(b, now) - HIT))[0]; if (c) judge(c); };
      const KEYMAP = { d: 0, f: 1, j: 2, k: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
      const kf = e => { if (KEYMAP[e.key] != null && KEYMAP[e.key] < n) hitLane(KEYMAP[e.key]); };
      addEventListener('keydown', kf);
      const loop = now => {
        if (done || !live(S, field)) return removeEventListener('keydown', kf);
        if (now >= t0 + k * beat * 1000) { spawn(now); k++; Audio2.sfx('tick', .1); }
        notes.forEach(nt => { const y = yOf(nt, now); nt.el.style.top = (y * 100) + '%'; if (y > 1.05) { nt.gone = true; nt.el.remove(); } });
        notes = notes.filter(nt => !nt.gone);
        requestAnimationFrame(loop);
      };
      hydrate(field); P.speak(); requestAnimationFrame(loop);
      S.auto = () => { const now = performance.now(), nt = notes.find(x => x.c.ok && Math.abs(yOf(x, now) - HIT) < .09); if (nt) judge(nt); };
    }), () => sleep(450));
  }

  /* 15. 叠高塔 */
  function tower(S, qs) {
    const st = S.stage; st.className = 'stage scene-tower'; st.innerHTML = '';
    const wrap = h('div', 'tw-wrap'), area = h('div', 'tw-area', '<div class="tw-stack"><div class="tw-base"></div></div><div class="tw-crane"><div class="tw-rope"></div><div class="tw-hook"></div></div><div class="tw-h">高度 <b class="latin">0</b> 层</div>'), side = h('div', 'tw-side');
    wrap.appendChild(area); wrap.appendChild(side); st.appendChild(wrap);
    const stack = area.querySelector('.tw-stack'), crane = area.querySelector('.tw-crane'), hook = area.querySelector('.tw-hook');
    let top = { x: .5, w: .36 }, floors = 0;
    const FH = 34;
    return runQs(S, qs, q => ask(S, side, q), async (r, q) => {
      if (!r.ok || S.over) return;
      side.innerHTML = '<div class="tt-place">' + E('🏗️') + ' 点一下放下积木，对得越齐越好！</div>'; hydrate(side);
      const ans = (q.ch.find(c => c.ok) || {}).t || '';
      const blk = h('div', 'tw-blk', '<span>' + esc(ans) + '</span>'); blk.style.setProperty('--hue', (floors * 47 + 10) % 360);
      blk.style.width = (top.w * area.clientWidth) + 'px'; hook.appendChild(blk);
      await new Promise(done => {
        let t = Math.random() * 6, last = performance.now(), x = .5, dropped = false, force = null;
        const go = () => {
          if (dropped) return; dropped = true; area.onpointerdown = null; if (force != null) x = force;
          const a0 = x - top.w / 2, a1 = x + top.w / 2, b0 = top.x - top.w / 2, b1 = top.x + top.w / 2, ov = Math.min(a1, b1) - Math.max(a0, b0);
          blk.remove();
          if (ov < top.w * .25) {
            const f = h('div', 'tw-fall', '<span>' + esc(ans) + '</span>'); f.style.setProperty('--hue', blk.style.getPropertyValue('--hue')); f.style.left = (a0 * 100) + '%'; f.style.width = (top.w * 100) + '%'; f.style.bottom = (FH * (floors + 1)) + 'px'; stack.appendChild(f);
            Audio2.sfx('poof', .4); UI.toast('哎呀，掉下去了！', 900); setTimeout(() => f.remove(), 900);
          } else {
            const perfect = Math.abs(x - top.x) < .02;
            if (perfect) top = { x: top.x, w: top.w }; else top = { x: (Math.max(a0, b0) + Math.min(a1, b1)) / 2, w: ov };
            if (top.w < .1) top = { x: .5, w: .3 };
            floors++;
            const f = h('div', 'tw-floor land', '<span>' + esc(ans) + '</span>'); f.style.setProperty('--hue', blk.style.getPropertyValue('--hue'));
            f.style.left = ((top.x - top.w / 2) * 100) + '%'; f.style.width = (top.w * 100) + '%'; f.style.bottom = (FH * floors) + 'px'; stack.appendChild(f);
            stack.style.transform = 'translateY(' + Math.max(0, (floors - 5) * FH) + 'px)';
            area.querySelector('.tw-h b').textContent = floors;
            Audio2.sfx(perfect ? 'star' : 'drop', .45); if (perfect) UI.toast('完美对齐！', 800);
          }
          setTimeout(done, 450);
        };
        area.onpointerdown = go;
        const loop = now => {
          if (dropped || !live(S, area)) return;
          t += Math.min(.04, (now - last) / 1000) * (1.1 + S.grade * .2); last = now;
          x = .5 + Math.sin(t) * .32; crane.style.left = (x * 100) + '%';
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
        S.auto = () => { force = top.x; go(); };
      });
    });
  }

  /* 16. 抢答擂台 */
  async function duel(S, qs) {
    const st = S.stage; st.className = 'stage scene-duel'; st.innerHTML = '';
    const GOAL = S.grade <= 1 ? 4 : 5;
    const top = h('div', 'du-top', '<div class="du-p me">' + heroTok() + '<b>你</b><div class="du-score latin">0</div></div><div class="du-vs latin">VS</div><div class="du-p ai">' + E('🤖') + '<b>智多星</b><div class="du-score latin">0</div></div>');
    const bar = h('div', 'du-bar', '<i></i><span>智多星正在思考…</span>'), box = h('div', 'du-box');
    st.appendChild(top); st.appendChild(bar); st.appendChild(box); hydrate(st);
    let me = 0, ai = 0;
    const nextQ = nextQFrom(S, qs), T = Math.max(4.5, 11 - S.grade * 1.4) * 1000, P_AI = .6 + S.grade * .05;
    const score = () => { top.querySelector('.me .du-score').textContent = me; top.querySelector('.ai .du-score').textContent = ai; };
    while (!S.over && me < GOAL && ai < GOAL) {
      S.setProgress(me, GOAL);
      const q = nextQ(), fill = bar.querySelector('i');
      fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth; fill.style.transition = 'width ' + T + 'ms linear'; fill.style.width = '100%';
      const pr = ask(S, box, q);
      const r = await Promise.race([pr, sleep(T + 200).then(() => ({ timeout: true }))]);
      fill.style.transition = 'none';
      if (S.over) return;
      const grid = box.querySelector('.choices');
      if (r.timeout) {
        grid.style.pointerEvents = 'none'; S.total++;
        const ce = grid.children[okIdx(q)];
        if (Math.random() < P_AI) { ai++; ce.classList.add('reveal'); top.querySelector('.ai').classList.add('pop'); Audio2.sfx('bong', .4); await Voice.say('智多星抢先答对了！'); }
        else { ce.classList.add('reveal'); Audio2.sfx('wrong', .3); await Voice.say('智多星答错了！'); }
        top.querySelector('.ai').classList.remove('pop');
      } else if (r.ok) { me++; top.querySelector('.me').classList.add('pop'); await S.good(r.el, q); top.querySelector('.me').classList.remove('pop'); }
      else { ai++; if (!await S.bad(r.el, q, r.correctEl)) return; }
      score(); await sleep(250);
    }
    if (S.over) return;
    S.setProgress(GOAL, GOAL);
    if (me >= GOAL) { UI.confetti(90); await Voice.say('你赢了擂台赛！'); S.end(false, accStars(S)); }
    else { await Voice.say('这次智多星赢了，下次加油！'); S.end(false, 1); }
  }

  /* 17. 字词寻宝格 */
  const ZHPOOL = '天地人你我他上下大小山水日月田口耳目手足火木花草鸟虫鱼云雨风雪春夏秋冬东南西北左右前后高低长短多少来去出入开关心头生学字书本笔画家国中天子王白红绿青蓝黄黑金石土光明星千万百年时分方圆正半';
  function wsearch(S, rounds) {
    const st = S.stage; st.className = 'stage scene-wsearch';
    return new Promise(async resolve => {
      let miss = 0;
      for (let r = 0; r < rounds.length; r++) {
        if (S.over) return resolve();
        S.setProgress(r, rounds.length);
        const rd = rounds[r], ans = rd.ans, L = ans.length, en = rd.l === 'en';
        const dirs = S.grade <= 1 ? [[1, 0]] : S.grade === 2 ? [[1, 0], [0, 1]] : [[1, 0], [0, 1], [1, 1]];
        const N = Math.min(8, Math.max(L + 1, S.grade <= 1 ? 5 : 6));
        let path; for (let t = 0; t < 200; t++) { const d = R.pick(dirs), x0 = R.int(0, N - 1 - d[0] * (L - 1)), y0 = R.int(0, N - 1 - d[1] * (L - 1)); path = ans.map((_, k) => [x0 + d[0] * k, y0 + d[1] * k]); break; }
        const pool = en ? 'abcdefghijklmnopqrstuvwxyz'.split('') : ZHPOOL.split('').concat(rd.pool || []);
        const G = Array.from({ length: N }, () => Array.from({ length: N }, () => R.pick(pool)));
        path.forEach((p, k) => G[p[1]][p[0]] = ans[k]);
        st.innerHTML = '';
        const P = h('div', 'qpanel slim', '<div class="qtext">' + esc(rd.p) + ' <button class="say">' + E('🔊') + '</button></div>' + (rd.pe ? '<div class="qvis sm">' + vis(rd.pe, 'qemo') + '</div>' : ''));
        st.appendChild(P); P.querySelector('.say').onclick = () => Voice.say(rd.s, rd.l);
        const slots = h('div', 'slots spell'); ans.forEach(() => slots.appendChild(h('div', 'slot'))); st.appendChild(slots);
        const grid = h('div', 'ws-grid'); grid.style.setProperty('--n', N); st.appendChild(grid);
        G.forEach((row, y) => row.forEach((ch, x) => { const c = h('div', 'ws-cell' + (en ? ' latin' : ''), esc(ch)); c.dataset.x = x; c.dataset.y = y; grid.appendChild(c); }));
        hydrate(st); Voice.say(rd.p.replace(/^.*：/, ''), 'zh');
        await new Promise(done => {
          let sel = [], dir = null, down = false, finished = false;
          const clear = () => { sel.forEach(c => c.classList.remove('sel')); sel = []; dir = null; [...slots.children].forEach(s => { s.innerHTML = ''; s.classList.remove('filled'); }); };
          const tap = async c => {
            if (!c || finished || sel.includes(c)) return;
            const x = +c.dataset.x, y = +c.dataset.y, k = sel.length, ch = c.textContent;
            let ok = ch === ans[k];
            if (ok && k === 1) { const px = +sel[0].dataset.x, py = +sel[0].dataset.y, dx = x - px, dy = y - py; ok = Math.abs(dx) <= 1 && Math.abs(dy) <= 1; if (ok) dir = [dx, dy]; }
            if (ok && k >= 2) { const lx = +sel[k - 1].dataset.x, ly = +sel[k - 1].dataset.y; ok = x - lx === dir[0] && y - ly === dir[1]; }
            if (!ok) {
              if (k > 0 || ch !== ans[0]) { miss++; S.wrong++; c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); Audio2.sfx('wrong', .25); }
              clear(); if (ch === ans[0]) tap(c); return;
            }
            sel.push(c); c.classList.add('sel'); const sl = slots.children[k]; sl.innerHTML = '<div class="ctxt' + (en ? ' latin' : '') + '">' + esc(ch) + '</div>'; sl.classList.add('filled'); Audio2.sfx('select', .3);
            if (sel.length === L) {
              finished = true; S.right++; S.total++; sel.forEach(z => z.classList.add('found')); slots.classList.add('complete'); Audio2.sfx('right', .5);
              await Voice.say(rd.s, rd.l); await sleep(300); done();
            }
          };
          grid.style.touchAction = 'none';
          grid.onpointerdown = e => { down = true; tap(e.target.closest('.ws-cell')); };
          grid.onpointermove = e => { if (!down) return; const t = document.elementFromPoint(e.clientX, e.clientY); tap(t && t.closest('.ws-cell')); };
          grid.onpointerup = grid.onpointerleave = () => { down = false; };
          S.auto = () => { if (finished) return; clear(); path.forEach(p => tap(grid.children[p[1] * N + p[0]])); };
        });
      }
      if (!S.over) { S.setProgress(rounds.length, rounds.length); S.end(false, miss <= 2 ? 3 : miss <= 6 ? 2 : 1); }
      resolve();
    });
  }

  /* 18. 弹弓大作战 */
  function sling(S, qs) {
    return runQs(S, qs, q => new Promise(res => {
      trimCh(q, 4); const n = q.ch.length;
      const { st, P } = scene(S, q, 'sling');
      const field = h('div', 'sl-field', '<svg class="sl-path"></svg><div class="sl-ground"></div><div class="sl-fork"></div>'); st.appendChild(field);
      const ball = h('div', 'sl-ball', petTok()); field.appendChild(ball);
      const svg = field.querySelector('.sl-path');
      const spots = R.shuffle([[.5, .7], [.64, .4], [.78, .66], [.9, .32], [.66, .14]]).slice(0, n);
      const targets = q.ch.map((c, i) => { const el = h('div', 'sl-target', '<div class="sl-crate">' + lbl(c, q) + '</div>'); el.dataset.ok = c.ok ? 1 : 0; el.style.left = (spots[i][0] * 100) + '%'; el.style.top = (spots[i][1] * 100) + '%'; field.appendChild(el); return { c, el }; });
      const t0 = tip(field, '按住小球往后拉，松手发射！');
      const G = 1200, K = 13, MAXP = 120, BR = 22;
      let W = 0, H = 0, A = { x: 0, y: 0 }, bx = 0, by = 0, vx = 0, vy = 0, state = 'rest', done = false, last = performance.now();
      const measure = () => { W = field.clientWidth; H = field.clientHeight; A = { x: W * .15, y: H * .6 }; };
      const show = () => { ball.style.transform = 'translate(' + (bx - BR) + 'px,' + (by - BR) + 'px)'; };
      const rest = () => { measure(); state = 'rest'; bx = A.x; by = A.y; show(); svg.innerHTML = ''; };
      const preview = (pvx, pvy) => {
        const dots = S.grade <= 1 ? 16 : S.grade === 2 ? 9 : 5; let s = '';
        for (let i = 1; i <= dots; i++) { const t = i * .06, x = A.x + pvx * t, y = A.y + pvy * t + .5 * G * t * t; s += '<circle cx="' + x + '" cy="' + y + '" r="' + (5 - i * 3 / dots) + '"/>'; }
        s += '<line x1="' + (W * .15 - 16) + '" y1="' + (A.y - 8) + '" x2="' + bx + '" y2="' + by + '"/><line x1="' + (W * .15 + 16) + '" y1="' + (A.y - 8) + '" x2="' + bx + '" y2="' + by + '"/>';
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = s;
      };
      const launch = (pvx, pvy) => { if (done) return; t0.remove(); vx = pvx; vy = pvy; bx = A.x; by = A.y; state = 'fly'; svg.innerHTML = ''; Audio2.sfx('throw', .5); };
      field.addEventListener('pointerdown', e => {
        if (state !== 'rest' || done) return;
        const r = field.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (Math.hypot(x - A.x, y - A.y) > 110) return;
        field.setPointerCapture(e.pointerId); state = 'aim';
      });
      field.addEventListener('pointermove', e => {
        if (state !== 'aim') return;
        const r = field.getBoundingClientRect(); let dx = e.clientX - r.left - A.x, dy = e.clientY - r.top - A.y;
        const d = Math.hypot(dx, dy); if (d > MAXP) { dx *= MAXP / d; dy *= MAXP / d; }
        bx = A.x + dx; by = A.y + dy; show(); preview(-dx * K, -dy * K);
      });
      field.addEventListener('pointerup', () => { if (state !== 'aim') return; const dx = bx - A.x, dy = by - A.y; if (Math.hypot(dx, dy) < 15) return rest(); launch(-dx * K, -dy * K); });
      const loop = now => {
        if (done || !live(S, field)) return;
        const dt = Math.min(.025, (now - last) / 1000); last = now;
        if (state === 'fly') {
          vy += G * dt; bx += vx * dt; by += vy * dt; show();
          const fr = field.getBoundingClientRect();
          for (const tg of targets) {
            const r = tg.el.getBoundingClientRect(), x0 = r.left - fr.left, y0 = r.top - fr.top;
            if (bx + BR * .7 > x0 && bx - BR * .7 < x0 + r.width && by + BR * .7 > y0 && by - BR * .7 < y0 + r.height) {
              done = true; tg.el.classList.add(tg.c.ok ? 'knock' : 'wobble'); Audio2.sfx(tg.c.ok ? 'hit' : 'bump', .6);
              if (!tg.c.ok && tg.c.s) Voice.say(tg.c.s, tg.c.l);
              return res({ ok: tg.c.ok, el: tg.el, correctEl: targets.find(z => z.c.ok).el });
            }
          }
          if (bx > W + 40 || bx < -40 || by > H * .9) { UI.toast('没打中，再试一次！', 800); Audio2.sfx('drop', .3); rest(); }
        }
        requestAnimationFrame(loop);
      };
      hydrate(field); requestAnimationFrame(() => { rest(); requestAnimationFrame(loop); }); P.speak();
      S.auto = () => {
        if (state !== 'rest') return; measure();
        const tg = targets.find(z => z.c.ok).el, fr = field.getBoundingClientRect(), r = tg.getBoundingClientRect();
        const dx = r.left - fr.left + r.width / 2 - A.x, dy = r.top - fr.top + r.height / 2 - A.y;
        for (let t = .4; t < 2; t += .05) { const pvx = dx / t, pvy = (dy - .5 * G * t * t) / t; if (Math.hypot(pvx, pvy) / K <= MAXP) return launch(pvx, pvy); }
      };
    }), () => sleep(500));
  }

  Object.assign(Engines.ENGINES, { snake, maze, runner, flappy, archery, bomb, tictac, breakout, board, findit, trace, balance, pixel, rhythm, tower, duel, wsearch, sling });
  Object.assign(Engines.ENG_NAMES, { snake: '贪吃蛇', maze: '迷宫寻宝', runner: '跑酷冲刺', flappy: '飞跃之门', archery: '神箭手', bomb: '拆弹专家', tictac: '井字棋', breakout: '打砖块', board: '飞行棋', findit: '找一找', trace: '描红写字', balance: '天平平衡', pixel: '像素涂色', rhythm: '节奏大师', tower: '叠高塔', duel: '抢答擂台', wsearch: '字词寻宝', sling: '弹弓大作战' });
  Engines.HELP2 = {
    snake: '点屏幕或方向键控制小蛇，吃掉正确答案！', maze: '在迷宫里走到写着正确答案的角落！', runner: '左右切换跑道，穿过正确答案的大门！',
    flappy: '点屏幕让小鸟飞起来，从正确答案的门穿过去！', archery: '弓箭会左右摆动，瞄准正确答案时点一下射箭！', bomb: '时间有限，剪断连着正确答案的那根线！',
    tictac: '答对题目才能下棋，三个连成一线就赢了！', breakout: '移动挡板接住小球，打中正确答案的砖块！', board: '答对题目就能掷骰子前进，比小智先到终点！',
    findit: '在一大堆东西里找出正确答案！', trace: '用手指沿着灰色的字描一描！', balance: '往天平右边放砝码，让两边一样重！',
    pixel: '先选颜色，再涂上和它配对的格子，画出一幅像素画！', rhythm: '音符落到线上时，点正确答案的那个！', tower: '答对一题就能放一块积木，叠得越高越好！',
    duel: '和智多星比赛抢答，先得到分数的赢！', wsearch: '在字格里按顺序找出答案，连成一线！', sling: '把小球往后拉，松手打中正确答案的箱子！',
  };
  Engines.REALTIME = new Set(['snake', 'maze', 'runner', 'flappy', 'archery', 'breakout', 'rhythm', 'sling', 'catch']);
  Engines.NONQ = new Set(['memory', 'connect', 'sort', 'order', 'spell', 'clockset', 'trace', 'balance', 'pixel', 'wsearch']);
})();
