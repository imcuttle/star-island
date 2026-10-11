/* 第三批玩法：不是选择题的益智 / 模拟 / 创作玩法 */
(function () {
  const { h, sleep, E, hydrate, UI, Audio2, Voice, esc } = Core;
  const { PRAISE } = Engines;
  const R = CONTENT.R;
  const live = (S, el) => !S.over && el.isConnected;
  const starsBy = (m, a, b) => m <= a ? 3 : m <= b ? 2 : 1;

  function head(st, html, say, l) {
    const P = h('div', 'qpanel slim', '<div class="qtext">' + html + ' <button class="say">' + E('🔊') + '</button></div>');
    st.appendChild(P); hydrate(P);
    const sp = () => Voice.say(say, l || 'zh'); P.querySelector('.say').onclick = sp; return { P, sp };
  }
  async function seqRounds(S, list, fn, stars) {
    S.miss = S.miss || 0;
    for (let i = 0; i < list.length; i++) { if (S.over) return; S.setProgress(i, list.length); await fn(list[i], i); }
    if (!S.over) { S.setProgress(list.length, list.length); S.end(false, stars ? stars() : starsBy(S.miss, 1, 4)); }
  }
  const scene = (S, name) => { const st = S.stage; st.className = 'stage scene-' + name; st.innerHTML = ''; return st; };
  const win = async (el, say, l) => { Audio2.sfx('right', .5); if (el) { const r = el.getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top + r.height / 2, '⭐', 10); } await Voice.say(say || R.pick(PRAISE), l); };
  const nudge = el => { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  function heroTok(pose) { const p = Core.Store.p, H = p && App.HEROES.find(x => x.id === p.hero), sh = App.heroShot && App.heroShot(pose || 'front'); if (sh) return '<img class="spr" src="' + sh + '" draggable="false">'; return H && H.img ? '<img class="spr" src="assets/img/' + H.img + '_' + (pose || 'front') + '.png" draggable="false">' : E(H && H.e ? H.e : '🧒'); }
  function petTok() { const p = Core.Store.p; if (p && p.pet) { const K = App.PETS.find(x => x.id === p.pet.kind); if (K) return E(K.e); } return E('🐤'); }
  let actx;
  function tone(f, d) {
    const p = Core.Store.p; if (p && !p.settings.sfx) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime, o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain(), g2 = actx.createGain();
      o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2; g2.gain.value = .15;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + (d || .6));
      o2.connect(g2); g2.connect(g); o.connect(g); g.connect(actx.destination); o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
    } catch (e) {}
  }

  /* ========== 1 合十消除 ========== */
  function make10(S, d) {
    return new Promise(resolve => {
      const st = scene(S, 'make10'); S.miss = 0;
      const mul = d.op === '×', C = d.cols, RW = d.rows;
      head(st, '连起相邻的数字，' + (mul ? '乘起来' : '加起来') + '正好等于 <b class="latin m10-t">' + d.t + '</b> 就能消除！', '连起相邻的数字，凑出目标数就能消除');
      const bar = h('div', 'm10-bar', '<div class="m10-cur">现在：<b class="latin">0</b></div><div class="m10-time"><i></i></div><div class="m10-goal">消除 <b class="latin">0</b> / ' + d.goal + '</div>');
      const grid = h('div', 'm10-grid'); grid.style.setProperty('--c', C); grid.style.setProperty('--r', RW); grid.style.touchAction = 'none';
      st.append(bar, grid);
      const comb = a => mul ? a.reduce((x, y) => x * y, 1) : a.reduce((x, y) => x + y, 0);
      const pairs = []; for (let v = 1; v <= d.max; v++) for (let w = 1; w <= d.max; w++) if (comb([v, w]) === d.t) pairs.push([v, w]);
      const B = Array.from({ length: RW }, () => Array.from({ length: C }, () => R.int(1, d.max)));
      const fresh = new Set();
      const findPair = () => { for (let y = 0; y < RW; y++) for (let x = 0; x < C; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) { const nx = x + dx, ny = y + dy; if (nx < C && ny < RW && comb([B[y][x], B[ny][nx]]) === d.t) return [[x, y], [nx, ny]]; } return null; };
      const ensure = () => { if (findPair()) return; const p = R.pick(pairs); if (Math.random() < .5) { const x = R.int(0, C - 2), y = R.int(0, RW - 1); B[y][x] = p[0]; B[y][x + 1] = p[1]; } else { const x = R.int(0, C - 1), y = R.int(0, RW - 2); B[y][x] = p[0]; B[y + 1][x] = p[1]; } };
      let path = [], down = false, score = 0, done = false; const t0 = performance.now();
      const cellEl = (x, y) => grid.children[y * C + x];
      const mark = () => { [...grid.children].forEach(c => c.classList.remove('sel')); path.forEach(([x, y]) => cellEl(x, y).classList.add('sel')); bar.querySelector('.m10-cur b').textContent = path.length ? comb(path.map(([x, y]) => B[y][x])) : 0; };
      const render = () => { grid.innerHTML = ''; for (let y = 0; y < RW; y++) for (let x = 0; x < C; x++) { const c = h('div', 'm10-cell' + (fresh.has(x + ',' + y) ? ' fall' : ''), '<b class="latin">' + B[y][x] + '</b>'); c.dataset.x = x; c.dataset.y = y; c.style.setProperty('--h', (B[y][x] * 37) % 360); grid.appendChild(c); } fresh.clear(); mark(); };
      const touch = (c, start) => {
        if (!c || done || !c.dataset) return; const x = +c.dataset.x, y = +c.dataset.y, i = path.findIndex(p => p[0] === x && p[1] === y);
        if (i >= 0) { if (i === path.length - 2) { path.pop(); Audio2.sfx('tick', .15); } else if (start && path.length === 1) path = []; mark(); return; }
        const last = path[path.length - 1];
        if (last && Math.abs(last[0] - x) + Math.abs(last[1] - y) === 1) path.push([x, y]); else if (start) path = [[x, y]]; else return;
        Audio2.sfx('select', .2); mark();
      };
      const finish = timeout => {
        if (done) return; done = true; S.right = score; S.total = score + S.miss;
        const frac = (performance.now() - t0) / (d.time * 1000);
        if (!timeout) { UI.confetti(80); Voice.say('全部消除，太厉害了！'); S.end(false, frac < .5 ? 3 : frac < .8 ? 2 : 1); }
        else if (score >= d.goal / 2) { Voice.say('时间到啦！'); S.end(false, 1); } else S.end(true);
        resolve();
      };
      const evaluate = () => {
        if (path.length < 2 || done) return; const v = comb(path.map(([x, y]) => B[y][x]));
        if (v === d.t) {
          const last = cellEl(...path[path.length - 1]); const r = last.getBoundingClientRect(); UI.burst(r.left + r.width / 2, r.top + r.height / 2, '✨', 8); Audio2.sfx('gem', .5);
          path.forEach(([x, y]) => B[y][x] = null);
          for (let x = 0; x < C; x++) { const col = []; for (let y = RW - 1; y >= 0; y--) if (B[y][x] != null) col.push(B[y][x]); for (let y = RW - 1, k = 0; y >= 0; y--, k++) { if (k < col.length) B[y][x] = col[k]; else { B[y][x] = R.int(1, d.max); fresh.add(x + ',' + y); } } }
          path = []; score++; ensure(); render(); bar.querySelector('.m10-goal b').textContent = score; S.setProgress(score, d.goal);
          if (score >= d.goal) finish(false);
        } else if (v > d.t) { S.miss++; Audio2.sfx('wrong', .3); path.forEach(([x, y]) => nudge(cellEl(x, y))); UI.toast('超过 ' + d.t + ' 啦，重新连', 900); path = []; setTimeout(mark, 300); }
      };
      grid.addEventListener('pointerdown', e => { down = true; touch(e.target.closest('.m10-cell'), true); });
      grid.addEventListener('pointermove', e => { if (!down) return; const t = document.elementFromPoint(e.clientX, e.clientY); touch(t && t.closest('.m10-cell'), false); });
      const up = () => { if (!grid.isConnected) return removeEventListener('pointerup', up); if (down) { down = false; evaluate(); } };
      addEventListener('pointerup', up);
      const loop = now => { if (done || !live(S, grid)) return; const f = (now - t0) / (d.time * 1000); bar.querySelector('.m10-time i').style.width = Math.max(0, 100 - f * 100) + '%'; if (f >= 1) return finish(true); requestAnimationFrame(loop); };
      ensure(); render(); S.setProgress(0, d.goal); requestAnimationFrame(loop); Voice.say('连起相邻的数字，凑出目标数就能消除');
      S.auto = () => { const p = findPair(); if (p) { path = p; evaluate(); } };
    });
  }

  /* ========== 2 小小收银员 ========== */
  const DEN = { 1: ['1角', 'coin c1'], 5: ['5角', 'coin c5'], 10: ['1元', 'coin c10'], 50: ['5元', 'note n50'], 100: ['10元', 'note n100'], 200: ['20元', 'note n200'], 500: ['50元', 'note n500'], 1000: ['100元', 'note n1000'] };
  const fmtM = j => ((j >= 10 ? Math.floor(j / 10) + '元' : '') + (j % 10 ? (j % 10) + '角' : '')) || '0元';
  function cashier(S, d) {
    return seqRounds(S, d.rounds, r => new Promise(next => {
      const st = scene(S, 'cashier'), need = d.mode === 'pay' ? r.price : r.pay - r.price;
      const txt = d.mode === 'pay' ? '这个<b>' + r.n + '</b>要 <b class="latin">' + fmtM(r.price) + '</b>，拿出正好的钱放进托盘' : '顾客买 <b>' + r.n + '</b>（' + fmtM(r.price) + '），付了 <b class="latin">' + fmtM(r.pay) + '</b>，要找回多少？';
      head(st, txt, d.mode === 'pay' ? '拿出正好的钱，放进托盘' : '算一算要找回多少钱，放进托盘');
      const top = h('div', 'cs-top', '<div class="cs-cust">' + E(r.cust) + '<div class="cs-face">' + E('🙂') + '</div></div><div class="cs-item">' + E(r.e) + '<b>' + r.n + '</b><span class="cs-tag latin">' + fmtM(r.price) + '</span></div>' + (d.mode === 'change' ? '<div class="cs-paid">' + E('💴') + '<span class="latin">付了 ' + fmtM(r.pay) + '</span></div>' : ''));
      const tray = h('div', 'cs-tray', '<div class="cs-in"></div><div class="cs-sum latin"></div>');
      const wallet = h('div', 'cs-wallet'), ctl = h('div', 'cs-ctl', '<button class="btn ghost sm cs-clear">清空</button><button class="btn cs-ok">' + (d.mode === 'pay' ? '付好了 ✓' : '找好了 ✓') + '</button>');
      st.append(top, tray, wallet, ctl); hydrate(st);
      let put = [], tries = 0, done = false;
      const draw = () => {
        const inEl = tray.querySelector('.cs-in'); inEl.innerHTML = '';
        put.forEach((v, i) => { const m = h('button', 'money ' + DEN[v][1] + ' pop-in', '<span>' + DEN[v][0] + '</span>'); m.onclick = () => { put.splice(i, 1); Audio2.sfx('pop', .2); draw(); }; inEl.appendChild(m); });
        const sum = put.reduce((a, b) => a + b, 0); tray.querySelector('.cs-sum').textContent = d.show ? '托盘里：' + fmtM(sum) : put.length ? '放了 ' + put.length + ' 张/枚' : '把钱放到这里';
      };
      d.den.slice().reverse().forEach(v => { const m = h('button', 'money ' + DEN[v][1], '<span>' + DEN[v][0] + '</span>'); m.onclick = () => { if (put.length >= 16) return; put.push(v); put.sort((a, b) => b - a); Audio2.sfx('coin', .25); draw(); }; wallet.appendChild(m); });
      ctl.querySelector('.cs-clear').onclick = () => { put = []; draw(); };
      const ok = async () => {
        if (done) return; const sum = put.reduce((a, b) => a + b, 0);
        if (sum === need) { done = true; S.right++; S.total++; top.querySelector('.cs-face').innerHTML = E('😄'); hydrate(top); await win(tray); return setTimeout(next, 300); }
        tries++; S.miss++; S.total++; Audio2.sfx('wrong', .4); nudge(tray);
        UI.toast(sum < need ? '还差 ' + fmtM(need - sum) + ' 哦' : '多了 ' + fmtM(sum - need) + ' 哦', 1400);
        if (tries >= 3) { done = true; S.auto(true); await sleep(1400); next(); }
      };
      ctl.querySelector('.cs-ok').onclick = ok; draw();
      S.auto = show => { put = []; let rest = need; d.den.slice().sort((a, b) => b - a).forEach(v => { while (rest >= v) { put.push(v); rest -= v; } }); draw(); if (!show) ok(); };
      Voice.say(d.mode === 'pay' ? '拿出正好的钱，放进托盘' : '算一算要找回多少钱，放进托盘');
    }), () => starsBy(S.miss, 1, 4));
  }

  /* ========== 3 气球猜单词 ========== */
  function hangman(S, list) {
    return seqRounds(S, list, r => new Promise(next => {
      const st = scene(S, 'hang'), LIVES = 6;
      head(st, '猜猜这个单词 ' + (S.grade <= 2 ? '（' + esc(r.zh) + '）' : ''), r.w, 'en');
      const sky = h('div', 'hg-sky', '<div class="hg-balloons">' + Array.from({ length: LIVES }, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</div><div class="hg-basket">' + petTok() + '</div><div class="hg-pic">' + E(r.e) + '</div>');
      const slots = h('div', 'hg-word latin'); r.w.split('').forEach(() => slots.appendChild(h('span', '', '_')));
      const kb = h('div', 'hg-kb latin'); 'abcdefghijklmnopqrstuvwxyz'.split('').forEach(L => { const b = h('button', '', L); b.dataset.l = L; b.onclick = () => guess(L); kb.appendChild(b); });
      st.append(sky, slots, kb); hydrate(st);
      let miss = 0, done = false; const got = new Set();
      const keyf = e => { if (/^[a-z]$/i.test(e.key)) guess(e.key.toLowerCase()); };
      addEventListener('keydown', keyf);
      const guess = async L => {
        if (done || !live(S, kb)) return removeEventListener('keydown', keyf);
        const b = kb.querySelector('[data-l="' + L + '"]'); if (!b || b.disabled) return; b.disabled = true;
        if (r.w.includes(L)) {
          b.classList.add('ok'); got.add(L); Audio2.sfx('select', .3);
          r.w.split('').forEach((c, i) => { if (c === L) { slots.children[i].textContent = c; slots.children[i].classList.add('pop-in'); } });
          if (r.w.split('').every(c => got.has(c))) { done = true; removeEventListener('keydown', keyf); S.right++; S.total++; sky.classList.add('fly'); await win(slots, r.w, 'en'); setTimeout(next, 500); }
        } else {
          b.classList.add('no'); miss++; S.miss++; Audio2.sfx('pop', .4); const bl = sky.querySelectorAll('.hg-balloons i:not(.gone)'); if (bl.length) bl[bl.length - 1].classList.add('gone');
          sky.style.setProperty('--drop', miss);
          if (miss >= LIVES) { done = true; removeEventListener('keydown', keyf); S.wrong++; S.total++; r.w.split('').forEach((c, i) => slots.children[i].textContent = c); slots.classList.add('reveal'); await Voice.say(r.w, 'en'); await sleep(700); next(); }
        }
      };
      Voice.say(r.w, 'en');
      S.auto = () => { const L = r.w.split('').find(c => !got.has(c)); if (L) guess(L); };
    }), () => starsBy(S.miss, 3, 9));
  }

  /* ========== 4 连点成画 ========== */
  function dots(S, list) {
    return seqRounds(S, list, r => new Promise(next => {
      const st = scene(S, 'dots');
      head(st, '按顺序连一连：<b class="latin">' + esc(r.labels[0]) + ' → ' + esc(r.labels[1]) + ' → ' + esc(r.labels[2]) + ' …</b> 看看会画出什么？', '按顺序连一连，看看会画出什么');
      const field = h('div', 'dt-field', '<svg viewBox="0 0 100 100"><polygon class="dt-fill" points=""/><g class="dt-lines"></g></svg><div class="dt-reveal">' + E(r.e) + '<b>' + esc(r.l === 'en' ? r.en : r.n) + '</b></div>');
      st.appendChild(field);
      const lines = field.querySelector('.dt-lines'), pts = r.pts, cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      let k = 0, idle;
      const dots = pts.map((p, i) => {
        const dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy) || 1;
        const b = h('button', 'dt-dot', '<i></i><span class="latin" style="transform:translate(' + (dx / L * 16) + 'px,' + (dy / L * 14) + 'px)">' + esc(r.labels[i]) + '</span>');
        b.style.left = (6 + p[0] * .88) + '%'; b.style.top = (6 + p[1] * .88) + '%'; b.onpointerdown = e => { e.preventDefault(); tap(i); }; field.appendChild(b); return b;
      });
      const line = (a, b) => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('x1', pts[a][0]); l.setAttribute('y1', pts[a][1]); l.setAttribute('x2', pts[b][0]); l.setAttribute('y2', pts[b][1]); lines.appendChild(l); };
      const hint = () => { clearTimeout(idle); idle = setTimeout(() => { if (dots[k] && live(S, field)) dots[k].classList.add('hint'); }, 5000); };
      const tap = async i => {
        if (k >= pts.length) return;
        if (i !== k) { S.miss++; nudge(dots[i]); Audio2.sfx('tick', .3); return; }
        dots[i].classList.remove('hint'); dots[i].classList.add('on'); tone(330 * Math.pow(2, (k % 12) / 12), .3); if (k > 0) line(k - 1, k); k++; hint();
        if (k === pts.length) {
          clearTimeout(idle); line(k - 1, 0); field.querySelector('.dt-fill').setAttribute('points', pts.map(p => p.join(',')).join(' ')); field.style.setProperty('--fc', r.c);
          field.classList.add('done'); S.right++; S.total++; await win(field, r.s, r.l); await sleep(500); next();
        }
      };
      dots[0].classList.add('start'); hint(); hydrate(field);
      Voice.say('按顺序连一连，看看会画出什么');
      S.auto = () => tap(k);
    }), () => starsBy(S.miss, 1, 5));
  }

  /* ========== 5 汉字积木 ========== */
  function hzbuild(S, list) {
    return seqRounds(S, list, r => new Promise(next => {
      const st = scene(S, 'hzb');
      head(st, '给「<b>' + r.comp + '</b>」找偏旁朋友，拼成 <b class="latin">' + r.made.length + '</b> 个新字！', '给这个字找偏旁朋友，拼成新的字');
      const bench = h('div', 'hb-bench', '<div class="hb-slot drop">?</div><div class="hb-plus">+</div><div class="hb-comp">' + r.comp + '</div><div class="hb-eq">=</div><div class="hb-out">?</div>');
      const found = h('div', 'hb-found'); r.made.forEach(() => found.appendChild(h('div', 'hb-f', '?')));
      const tray = h('div', 'hb-tray');
      const rads = R.shuffle(r.made.map(m => ({ r: m.r, m })).concat(r.decoys.map(x => ({ r: x }))));
      st.append(bench, found, tray);
      let got = 0, busy = false;
      const tryRad = async (it, b) => {
        if (busy || b.disabled) return; busy = true; b.disabled = true;
        bench.querySelector('.hb-slot').textContent = it.r; bench.classList.remove('ok', 'no'); void bench.offsetWidth; Audio2.sfx('drop', .4);
        const out = bench.querySelector('.hb-out');
        if (it.m) {
          out.textContent = it.m.ch; bench.classList.add('ok'); b.classList.add('used');
          const f = found.children[got++]; f.innerHTML = '<b>' + it.m.ch + '</b><small>' + esc(it.m.w) + '</small>'; f.classList.add('on', 'pop-in');
          S.right++; S.total++; Audio2.sfx('gem', .5); await Voice.say(it.m.s);
          if (got === r.made.length) { await win(found, '全部找到啦！'); await sleep(300); busy = false; return next(); }
        } else { out.textContent = '✗'; bench.classList.add('no'); b.classList.add('bad'); S.miss++; Audio2.sfx('wrong', .35); await Voice.say('这不是一个字哦'); }
        await sleep(300); bench.querySelector('.hb-slot').textContent = '?'; out.textContent = '?'; bench.classList.remove('ok', 'no'); busy = false;
      };
      rads.forEach(it => { const b = h('button', 'hb-rad', it.r); b.onclick = () => tryRad(it, b); Engines.drag(b, { onDrop: t => { if (t.classList.contains('hb-slot')) tryRad(it, b); }, onTap: () => tryRad(it, b) }); tray.appendChild(b); });
      Voice.say('给这个字找偏旁朋友，拼成新的字');
      S.auto = () => { const i = rads.findIndex((it, k) => it.m && !tray.children[k].disabled); if (i >= 0 && !busy) tryRad(rads[i], tray.children[i]); };
    }), () => starsBy(S.miss, 0, 3));
  }

  /* ========== 6 水管工 ========== */
  const PIPE_SVG = m => '<svg viewBox="0 0 100 100">' + [[1, '50,50 50,-2'], [2, '50,50 102,50'], [4, '50,50 50,102'], [8, '50,50 -2,50']].filter(x => m & x[0]).map(x => '<polyline class="po" points="' + x[1] + '"/><polyline class="pi" points="' + x[1] + '"/>').join('') + '<circle class="po" cx="50" cy="50" r="15"/><circle class="pi" cx="50" cy="50" r="8"/></svg>';
  function pipes(S, list) {
    let taps = 0, need = 0;
    return seqRounds(S, list, P => new Promise(next => {
      const st = scene(S, 'pipes'), n = P.n, rot = P.rot.slice(), deg = rot.map(r => r * 90);
      head(st, '点一点水管让它转动，把水引到小花那里！', '点一点水管让它转动，把水引到小花那里');
      const wrap = h('div', 'pp-wrap'), grid = h('div', 'pp-grid'); grid.style.setProperty('--n', n);
      const src = h('div', 'pp-src', E('🚰')), sink = h('div', 'pp-sink', E('🌱'));
      src.style.top = ((P.sy + .5) / n * 100) + '%'; sink.style.top = ((P.ey + .5) / n * 100) + '%';
      wrap.append(src, grid, sink); st.appendChild(wrap);
      P.base.forEach((m, i) => { const t = h('button', 'pp-tile', '<div class="pp-r">' + PIPE_SVG(m) + '</div>'); t.querySelector('.pp-r').style.transform = 'rotate(' + deg[i] + 'deg)'; t.onclick = () => turn(i); grid.appendChild(t); });
      P.path.forEach((on, i) => { if (!on) return; let k = 0; while (k < 4 && CONTENT.rotN(P.base[i], rot[i] + k) !== P.base[i]) k++; need += k; });
      let done = false;
      const flow = () => { const f = CONTENT.pipeFlow(P, rot); [...grid.children].forEach((t, i) => t.classList.toggle('wet', f.wet.has(i))); return f.ok; };
      const turn = async i => {
        if (done) return; rot[i] = (rot[i] + 1) % 4; deg[i] += 90; taps++;
        grid.children[i].querySelector('.pp-r').style.transform = 'rotate(' + deg[i] + 'deg)'; Audio2.sfx('click', .25);
        if (flow()) { done = true; sink.innerHTML = E('🌻'); hydrate(sink); sink.classList.add('bloom'); wrap.classList.add('ok'); S.right++; S.total++; await win(sink, '水流过去了，小花开啦！'); await sleep(400); next(); }
      };
      hydrate(wrap); flow(); Voice.say('点一点水管让它转动，把水引到小花那里');
      S.auto = () => { const i = P.path.findIndex((on, k) => on && CONTENT.rotN(P.base[k], rot[k]) !== P.base[k]); if (i >= 0) turn(i); };
    }), () => starsBy(Math.max(0, taps - need), 4, 14));
  }

  /* ========== 7 点亮星空 ========== */
  function lights(S, list) {
    let presses = 0, minP = 0;
    return seqRounds(S, list, L => new Promise(next => {
      const st = scene(S, 'lights'), n = L.n; let lit = L.lit.slice(), sol = new Set(L.press); minP += L.press.length;
      head(st, '点一颗星，它和上下左右的星都会变化。把所有星星都点亮！', '点一颗星，它和上下左右的星星都会变化，把所有星星都点亮');
      const grid = h('div', 'lt-grid'); grid.style.setProperty('--n', n);
      const ctl = h('div', 'lt-ctl', '<span class="lt-count">已点 <b class="latin">0</b> 次</span><button class="btn ghost sm lt-reset">重来</button>');
      st.append(grid, ctl);
      let cnt = 0, done = false;
      const draw = () => [...grid.children].forEach((c, i) => c.classList.toggle('on', lit[i]));
      lit.forEach(() => grid.appendChild(h('button', 'lt-star', E('⭐'))));
      [...grid.children].forEach((c, i) => c.onclick = () => press(i));
      const press = async i => {
        if (done) return; const x = i % n, y = Math.floor(i / n);
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < n && ny < n) { const j = ny * n + nx; lit[j] = !lit[j]; grid.children[j].classList.remove('flip'); void grid.children[j].offsetWidth; grid.children[j].classList.add('flip'); } });
        sol.has(i) ? sol.delete(i) : sol.add(i); cnt++; presses++; ctl.querySelector('b').textContent = cnt; tone(392 + (i % 5) * 60, .25); draw();
        if (lit.every(Boolean)) { done = true; grid.classList.add('ok'); S.right++; S.total++; await win(grid, '整片星空都亮啦！'); await sleep(400); next(); }
      };
      ctl.querySelector('.lt-reset').onclick = () => { lit = L.lit.slice(); sol = new Set(L.press); draw(); Audio2.sfx('poof', .3); };
      hydrate(grid); draw(); Voice.say('点一颗星，它和上下左右的星星都会变化，把所有星星都点亮');
      S.auto = () => { const i = [...sol][0]; if (i != null) press(i); };
    }), () => starsBy(presses - minP, 2, 10));
  }

  /* ========== 8 音乐记忆 ========== */
  function simon(S, d) {
    return new Promise(async resolve => {
      const st = scene(S, 'simon'); S.miss = 0;
      head(st, '仔细听，记住音符的顺序，再按同样的顺序弹出来！', '仔细听，记住音符的顺序，再按同样的顺序弹出来');
      const pads = h('div', 'sm-pads'), info = h('div', 'sm-info', '<b class="latin">0</b> / ' + d.len);
      d.notes.forEach((nt, i) => { const b = h('button', 'sm-pad' + (d.latin ? ' latin' : ''), '<span>' + nt[0] + '</span>'); b.style.setProperty('--pc', nt[2]); b.onpointerdown = e => { e.preventDefault(); input(i); }; pads.appendChild(b); });
      st.append(info, pads); hydrate(st);
      const seq = []; let pos = 0, accepting = false, waiter = null;
      const flash = async (i, ms) => { const b = pads.children[i]; b.classList.add('lit'); tone(d.notes[i][1], .5); await sleep(ms); b.classList.remove('lit'); };
      const input = async i => {
        if (!accepting) return; await flash(i, 180);
        if (i === seq[pos]) { pos++; if (pos === seq.length) { accepting = false; waiter && waiter(true); } }
        else { accepting = false; waiter && waiter(false); }
      };
      while (seq.length < d.start) seq.push(R.int(0, d.notes.length - 1));
      await Voice.say('仔细听，记住音符的顺序，再按同样的顺序弹出来');
      while (!S.over) {
        info.querySelector('b').textContent = seq.length - 1; S.setProgress(Math.max(0, seq.length - d.start), d.len - d.start + 1);
        pads.classList.add('listen'); await sleep(500);
        for (const i of seq) { if (S.over) return; await flash(i, Math.max(260, 520 - seq.length * 25)); await sleep(140); }
        pads.classList.remove('listen'); pos = 0; accepting = true;
        S.auto = () => input(seq[pos]);
        const ok = await new Promise(r => waiter = r);
        if (S.over) return;
        if (ok) {
          S.right++; S.total++; Audio2.sfx('right', .4);
          if (seq.length >= d.len) { info.querySelector('b').textContent = seq.length; S.setProgress(1, 1); UI.confetti(80); await Voice.say('你的耳朵真厉害！'); S.end(false, starsBy(S.miss, 0, 2)); return resolve(); }
          seq.push(R.int(0, d.notes.length - 1)); await sleep(600);
        } else {
          S.miss++; S.wrong++; S.total++; Audio2.sfx('wrong', .4); nudge(pads); S.hearts--; S.renderHearts();
          if (S.hearts <= 0) { S.end(true); return resolve(); }
          await Voice.say('再听一遍'); await sleep(300);
        }
      }
      resolve();
    });
  }

  /* ========== 9 小厨师点单 ========== */
  function cook(S, d) {
    return seqRounds(S, d.rounds, r => new Promise(next => {
      const st = scene(S, 'cook');
      const order = d.mode === 'math' ? r.items.map(it => '<span class="ck-o"><b class="latin">' + it.n + '</b>' + E(it.e) + '</span>').join('<i>+</i>') : '<span class="ck-txt' + (d.mode === 'en' ? ' latin' : '') + '">' + esc(r.text) + '</span>';
      const top = h('div', 'ck-top', '<div class="ck-cust">' + E(r.cust) + '</div><div class="ck-bubble">' + order + ' <button class="say">' + E('🔊') + '</button></div><div class="ck-pat"><i></i></div>');
      const plate = h('div', 'ck-plate drop', '<div class="ck-in"></div><small>点盘子里的食物可以拿走</small>');
      const shelf = h('div', 'ck-shelf'), ctl = h('div', 'cs-ctl', '<button class="btn ghost sm ck-clear">清空</button><button class="btn ck-ok">上菜 ' + E('🛎️') + '</button>');
      st.append(top, plate, shelf, ctl);
      const cnt = {}; let done = false;
      const draw = () => { const inEl = plate.querySelector('.ck-in'); inEl.innerHTML = ''; Object.entries(cnt).forEach(([e, n]) => { for (let k = 0; k < n; k++) { const f = h('button', 'ck-food pop-in', E(e)); f.onclick = () => { cnt[e]--; if (!cnt[e]) delete cnt[e]; Audio2.sfx('pop', .2); draw(); }; inEl.appendChild(f); } }); hydrate(inEl); };
      r.shelf.forEach(x => { const b = h('button', 'ck-item', E(x.e)); b.onclick = () => { if (Object.values(cnt).reduce((a, c) => a + c, 0) >= 20) return; cnt[x.e] = (cnt[x.e] || 0) + 1; Audio2.sfx('select', .25); draw(); }; shelf.appendChild(b); });
      ctl.querySelector('.ck-clear').onclick = () => { Object.keys(cnt).forEach(k => delete cnt[k]); draw(); };
      const sp = () => Voice.say(r.say, r.l); top.querySelector('.say').onclick = sp;
      const serve = async () => {
        if (done) return;
        const want = {}; r.items.forEach(it => want[it.e] = it.n);
        const okk = Object.keys(want).every(e => cnt[e] === want[e]) && Object.keys(cnt).every(e => want[e]);
        if (okk) { done = true; S.right++; S.total++; top.querySelector('.ck-cust').innerHTML = E('😋'); hydrate(top); await win(plate, '谢谢你，真好吃！'); return setTimeout(next, 300); }
        S.miss++; S.total++; Audio2.sfx('wrong', .4); nudge(plate);
        const wrongE = Object.keys(want).find(e => (cnt[e] || 0) !== want[e]) || Object.keys(cnt).find(e => !want[e]);
        UI.toast(!want[wrongE] ? '我没有点这个哦' : (cnt[wrongE] || 0) < want[wrongE] ? '数量不够哦' : '放太多啦', 1300);
      };
      ctl.querySelector('.ck-ok').onclick = serve;
      const T = d.time * 1000, t0 = performance.now();
      const loop = now => {
        if (done || !live(S, top)) return; const f = (now - t0) / T; top.querySelector('.ck-pat i').style.width = Math.max(0, 100 - f * 100) + '%';
        if (f >= 1) { done = true; S.miss++; S.total++; top.querySelector('.ck-cust').innerHTML = E('😤'); hydrate(top); Audio2.sfx('fail', .4); UI.toast('客人等太久走掉了…', 1300); return setTimeout(next, 1400); }
        requestAnimationFrame(loop);
      };
      hydrate(st); sp(); requestAnimationFrame(loop);
      S.auto = () => { Object.keys(cnt).forEach(k => delete cnt[k]); r.items.forEach(it => cnt[it.e] = it.n); draw(); serve(); };
    }), () => starsBy(S.miss, 0, 3));
  }

  /* ========== 10 对称画 ========== */
  function sym(S, list) {
    return seqRounds(S, list, r => new Promise(next => {
      const st = scene(S, 'sym'), { C } = r, RW = r.R, v = r.axis === 'v';
      head(st, '照着' + (v ? '左边' : '上面') + '，在' + (v ? '右边' : '下面') + '画出对称的图案！', v ? '照着左边，在右边画出对称的图案' : '照着上面，在下面画出对称的图案');
      const grid = h('div', 'sy-grid ' + r.axis); grid.style.setProperty('--c', C); grid.style.setProperty('--r', RW);
      const pal = h('div', 'sy-pal'), ctl = h('div', 'cs-ctl', '<button class="btn ghost sm sy-check">帮我检查</button>');
      st.append(grid, pal, ctl);
      const mirror = i => { const x = i % C, y = Math.floor(i / C); return v ? y * C + (C - 1 - x) : (RW - 1 - y) * C + x; };
      const isSrc = i => v ? (i % C) < C / 2 : Math.floor(i / C) < RW / 2;
      const want = Array(C * RW).fill(0); r.cells.forEach((c, i) => { if (c) want[mirror(i)] = c; });
      const mine = Array(C * RW).fill(0); let col = 1, done = false;
      r.colors.forEach((c, k) => { const b = h('button', 'sy-sw' + (k === 0 ? ' on' : ''), ''); b.style.background = c; b.onclick = () => { col = k + 1; [...pal.children].forEach(x => x.classList.toggle('on', x === b)); Audio2.sfx('select', .3); }; pal.appendChild(b); });
      if (r.colors.length < 2) pal.style.display = 'none';
      r.cells.forEach((c, i) => { const el = h('div', 'sy-cell' + (isSrc(i) ? ' src' : ' dst')); if (c) el.style.background = r.colors[c - 1]; grid.appendChild(el); });
      const check = async () => {
        if (done) return;
        if (mine.every((c, i) => isSrc(i) || c === want[i])) { done = true; grid.classList.add('ok'); S.right++; S.total++; await win(grid, '对称图案画好啦！'); await sleep(400); next(); }
      };
      grid.style.touchAction = 'none';
      let painting = null;
      const paint = (el, start) => {
        if (!el || done) return; const i = [...grid.children].indexOf(el); if (i < 0 || isSrc(i)) return;
        if (start) painting = mine[i] === col ? 0 : col;
        if (mine[i] === painting) return;
        mine[i] = painting; el.style.background = painting ? r.colors[painting - 1] : ''; Audio2.sfx('pop', .12); check();
      };
      grid.onpointerdown = e => paint(e.target.closest('.sy-cell'), true);
      grid.onpointermove = e => { if (painting == null) return; const t = document.elementFromPoint(e.clientX, e.clientY); paint(t && t.closest('.sy-cell'), false); };
      const up = () => { painting = null; if (!grid.isConnected) removeEventListener('pointerup', up); }; addEventListener('pointerup', up);
      ctl.querySelector('.sy-check').onclick = () => { S.miss++; let bad = 0; [...grid.children].forEach((el, i) => { if (!isSrc(i) && mine[i] !== want[i]) { bad++; el.classList.remove('wrongc'); void el.offsetWidth; el.classList.add('wrongc'); } }); UI.toast(bad ? '还有 ' + bad + ' 个格子不对，看闪烁的地方' : '全对！', 1400); };
      Voice.say(v ? '照着左边，在右边画出对称的图案' : '照着上面，在下面画出对称的图案');
      S.auto = () => { want.forEach((c, i) => { if (!isSrc(i) && mine[i] !== c) { mine[i] = c; grid.children[i].style.background = c ? r.colors[c - 1] : ''; } }); check(); };
    }), () => starsBy(S.miss, 0, 2));
  }

  /* ========== 11 算式建造 ========== */
  function equation(S, list) {
    return seqRounds(S, list, r => new Promise(next => {
      const st = scene(S, 'eq');
      head(st, '用数字卡片拼出一个算式，结果要等于 <b class="latin">' + r.target + '</b>', '用数字卡片拼出算式，结果要等于目标数');
      const row = h('div', 'eq-row latin'), res = h('div', 'eq-res latin'), cards = h('div', 'eq-cards latin'), ctl = h('div', 'cs-ctl', '<button class="btn ghost sm eq-hint">' + E('💡') + ' 提示</button>');
      st.append(row, res, cards, ctl);
      const slot = Array(r.k).fill(null), ops = Array(r.k - 1).fill(r.ops[0]); let done = false, hinted = 0;
      const vals = () => slot.map(i => r.cards[i]);
      const draw = () => {
        row.innerHTML = '';
        for (let i = 0; i < r.k; i++) {
          const s = h('button', 'eq-slot' + (slot[i] != null ? ' full' : ''), slot[i] != null ? String(r.cards[slot[i]]) : ''); s.onclick = () => { if (slot[i] == null || done) return; slot[i] = null; Audio2.sfx('pop', .2); draw(); }; row.appendChild(s);
          if (i < r.k - 1) { const o = h('button', 'eq-op' + (r.ops.length > 1 ? ' cyc' : ''), ops[i]); o.onclick = () => { if (r.ops.length < 2 || done) return; ops[i] = r.ops[(r.ops.indexOf(ops[i]) + 1) % r.ops.length]; Audio2.sfx('switch', .3); draw(); }; row.appendChild(o); }
        }
        row.appendChild(h('span', 'eq-eq', '=')); row.appendChild(h('span', 'eq-target', String(r.target)));
        [...cards.children].forEach((c, i) => c.classList.toggle('used', slot.includes(i)));
        if (slot.every(x => x != null)) {
          const v = CONTENT.eqEval(vals(), ops); res.textContent = '现在算出来是 ' + (Number.isNaN(v) ? '除不尽' : v);
          res.className = 'eq-res latin' + (v === r.target ? ' ok' : ' no');
          if (v === r.target && !done) { done = true; S.right++; S.total++; row.classList.add('ok'); win(row).then(() => setTimeout(next, 500)); }
        } else { res.textContent = '把卡片放进空格里'; res.className = 'eq-res'; }
      };
      r.cards.forEach((n, i) => { const c = h('button', 'eq-card', String(n)); c.onclick = () => { if (done || slot.includes(i)) return; const k = slot.indexOf(null); if (k < 0) return; slot[k] = i; Audio2.sfx('select', .3); draw(); }; cards.appendChild(c); });
      const fillSol = upto => {
        slot.fill(null); const used = new Set();
        r.sol.nums.forEach((n, k) => { if (k >= upto) return; const i = r.cards.findIndex((c, j) => c === n && !used.has(j)); used.add(i); slot[k] = i; });
        r.sol.ops.forEach((o, k) => ops[k] = o); draw();
      };
      ctl.querySelector('.eq-hint').onclick = () => { if (done) return; hinted++; S.miss++; fillSol(Math.min(r.k - 1, hinted)); Audio2.sfx('magic', .4); };
      draw(); Voice.say('用数字卡片拼出算式，结果要等于目标数');
      S.auto = () => fillSol(r.k);
    }), () => starsBy(S.miss, 0, 2));
  }

  /* ========== 12 安全过马路 ========== */
  const GOALS = [['🏫', '学校'], ['🏥', '医院'], ['🛒', '超市'], ['🏠', '家'], ['📚', '图书馆'], ['🏞️', '公园']];
  function traffic(S, d) {
    return new Promise(resolve => {
      const st = scene(S, 'traffic'); S.miss = 0;
      head(st, '先左右看，等<b style="color:#2ecc71">绿灯</b>亮了再过马路，安全到达目的地！', '先左右看一看，等绿灯亮了再过马路');
      const L = d.lanes, field = h('div', 'tf-field'); field.style.setProperty('--rows', L + 2);
      field.innerHTML = '<div class="tf-walk top"><div class="tf-goal"></div></div>' + Array.from({ length: L }, (_, i) => '<div class="tf-lane" data-l="' + (L - 1 - i) + '"><div class="tf-zebra"></div></div>').join('') + '<div class="tf-walk bot"></div><div class="tf-light"><div class="tf-red">' + E('🧍') + '</div><div class="tf-green">' + E('🚶') + '</div><b class="latin"></b></div><div class="tf-kid">' + heroTok() + '</div>';
      const ctl = h('div', 'tf-ctl', '<button class="btn ghost tf-look">' + E('👀') + ' 左右看</button><button class="btn tf-step">' + E('⬆️') + ' 走一步</button>');
      st.append(field, ctl); hydrate(st);
      const kid = field.querySelector('.tf-kid'), light = field.querySelector('.tf-light'), lanes = [...field.querySelectorAll('.tf-lane')].reverse();
      const CARS = ['🚗', '🚕', '🚙', '🚌', '🚚', '🚓'];
      const cars = lanes.map((ln, li) => Array.from({ length: 3 }, (_, k) => { const el = h('div', 'tf-car' + (li % 2 ? ' rev' : ''), E(R.pick(CARS))); ln.appendChild(el); return { el, x: k / 3 + Math.random() * .1, dir: li % 2 ? -1 : 1 }; }));
      hydrate(field);
      let row = 0, looked = false, crossed = 0, phase = 'red', pt = performance.now(), dur = 3, done = false, lastWarn = 0, warnedRed = false;
      const goal = () => { const g = GOALS[crossed % GOALS.length]; field.querySelector('.tf-goal').innerHTML = E(g[0]) + '<b>' + g[1] + '</b>'; hydrate(field); };
      const place = () => { kid.style.bottom = (row / (L + 2) * 100 + 100 / (L + 2) * .12) + '%'; };
      const warn = (t, cost) => { const now = performance.now(); if (cost !== false) { S.miss++; S.wrong++; } Audio2.sfx('bong', .4); nudge(kid); if (now - lastWarn > 1500) { lastWarn = now; UI.toast(t, 1600); Voice.say(t); } };
      const flashing = () => phase === 'green' && (performance.now() - pt) / 1000 > dur - 2;
      const look = () => { if (done) return; if (row !== 0) return; looked = true; kid.classList.remove('looking'); void kid.offsetWidth; kid.classList.add('looking'); Audio2.sfx('whoosh', .2); };
      const step = async () => {
        if (done) return;
        if (row === 0) {
          if (!looked) return warn('过马路前要先左看看、右看看哦');
          if (phase === 'red') return warn('红灯停！等绿灯亮了再走');
          if (flashing()) return warn('绿灯在闪了，等下一次绿灯吧');
        }
        row++; Audio2.sfx('jump', .2); place();
        if (row === L + 1) {
          crossed++; S.right++; S.total++; S.setProgress(crossed, d.n); await win(kid, '安全到达！');
          if (crossed >= d.n) { done = true; S.end(false, starsBy(S.miss, 0, 2)); return resolve(); }
          row = 0; looked = false; warnedRed = false; place(); goal();
        }
      };
      ctl.querySelector('.tf-look').onclick = look; ctl.querySelector('.tf-step').onclick = step;
      const keyf = e => { if (!live(S, field)) return removeEventListener('keydown', keyf); if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); step(); } if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') look(); };
      addEventListener('keydown', keyf);
      let last = performance.now();
      const loop = now => {
        if (done || !live(S, field)) return removeEventListener('keydown', keyf);
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        const el = (now - pt) / 1000;
        if (el >= dur) { phase = phase === 'red' ? 'green' : 'red'; pt = now; dur = phase === 'green' ? d.green : d.red; if (phase === 'red' && row > 0 && row <= L && !warnedRed) { warnedRed = true; warn('红灯了！下次绿灯一闪就不要再走了'); } }
        light.classList.toggle('go', phase === 'green'); light.classList.toggle('flash', flashing());
        light.querySelector('b').textContent = Math.ceil(dur - (now - pt) / 1000);
        const kidLane = row - 1, stop = phase === 'green' || (kidLane >= 0 && kidLane < L);
        cars.forEach((lc, li) => {
          lc.sort((a, b) => a.dir > 0 ? b.x - a.x : a.x - b.x);
          lc.forEach((c, k) => {
            let nx = c.x + c.dir * d.speed * dt;
            const lineX = c.dir > 0 ? .34 : .66, before = c.dir > 0 ? c.x <= lineX + .001 : c.x >= lineX - .001;
            if (stop && before) nx = c.dir > 0 ? Math.min(nx, lineX) : Math.max(nx, lineX);
            const ahead = lc[k - 1]; if (ahead) nx = c.dir > 0 ? Math.min(nx, ahead.x - .13) : Math.max(nx, ahead.x + .13);
            if (c.dir > 0 ? nx > 1.12 : nx < -.12) { nx = c.dir > 0 ? -.12 : 1.12; c.el.innerHTML = E(R.pick(CARS)); hydrate(c.el); }
            c.x = c.dir > 0 ? Math.max(c.x, nx) : Math.min(c.x, nx); c.el.style.left = (c.x * 100) + '%';
          });
        });
        requestAnimationFrame(loop);
      };
      goal(); place(); requestAnimationFrame(loop); Voice.say('先左右看一看，等绿灯亮了再过马路');
      S.auto = () => { if (row === 0 && !looked) look(); else if (row > 0 || (phase === 'green' && !flashing())) step(); };
    });
  }

  /* ========== 13 拼图 ========== */
  function jigsaw(S, list) {
    let swaps = 0, minS = 0;
    return seqRounds(S, list, r => new Promise(next => {
      const st = scene(S, 'jig'), n = r.n, N = n * n;
      head(st, '点两块拼图交换位置，把图片拼完整！', '点两块拼图交换位置，把图片拼完整');
      const wrap = h('div', 'jg-wrap'), grid = h('div', 'jg-grid'), peek = h('div', 'jg-peek'); grid.style.setProperty('--n', n);
      peek.style.backgroundImage = 'url(' + r.img + ')'; wrap.append(grid, peek); st.appendChild(wrap);
      let ord; do { ord = R.shuffle([...Array(N).keys()]); } while (ord.filter((p, i) => p === i).length > N / 3);
      const seen = new Set(); ord.forEach((_, i) => { if (seen.has(i)) return; let j = i, len = 0; while (!seen.has(j)) { seen.add(j); j = ord[j]; len++; } minS += len - 1; });
      let sel = -1, done = false;
      const draw = () => {
        grid.innerHTML = '';
        ord.forEach((p, i) => {
          const t = h('button', 'jg-tile' + (i === sel ? ' sel' : '') + (p === i ? ' right' : ''));
          t.style.backgroundImage = 'url(' + r.img + ')'; t.style.backgroundSize = (n * 100) + '% ' + (n * 100) + '%';
          t.style.backgroundPosition = ((p % n) / (n - 1) * 100) + '% ' + (Math.floor(p / n) / (n - 1) * 100) + '%';
          t.onclick = () => tap(i); grid.appendChild(t);
        });
      };
      const tap = async i => {
        if (done) return;
        if (sel < 0) { sel = i; Audio2.sfx('select', .3); return draw(); }
        if (sel === i) { sel = -1; return draw(); }
        [ord[sel], ord[i]] = [ord[i], ord[sel]]; sel = -1; swaps++; Audio2.sfx('drop', .3); draw();
        if (ord.every((p, k) => p === k)) { done = true; grid.classList.add('ok'); const lb = h('div', 'jg-name', '<b>' + esc(r.zh) + '</b><span class="latin">' + esc(r.en) + '</span>'); wrap.appendChild(lb); S.right++; S.total++; await win(grid, r.s, r.l); await sleep(700); next(); }
      };
      draw(); Voice.say('点两块拼图交换位置，把图片拼完整');
      S.auto = () => { const i = ord.findIndex((p, k) => p !== k); if (i < 0) return; const j = ord.indexOf(i); sel = j; tap(i); };
    }), () => starsBy(swaps - minS, 2, 8));
  }

  Object.assign(Engines.ENGINES, { make10, cashier, hangman, dots, hzbuild, pipes, lights, simon, cook, sym, equation, traffic, jigsaw });
  Object.assign(Engines.ENG_NAMES, { make10: '合十消除', cashier: '小小收银员', hangman: '气球猜词', dots: '连点成画', hzbuild: '汉字积木', pipes: '水管工', lights: '点亮星空', simon: '音乐记忆', cook: '小厨师', sym: '对称画', equation: '算式建造', traffic: '安全过马路', jigsaw: '拼图' });
  Object.assign(Engines.HELP2, {
    make10: '手指划过相邻的数字，凑出目标数就能消除！', cashier: '点钱币放进托盘，凑出正好的钱。', hangman: '一个一个猜字母，气球全飞走前猜出单词！',
    dots: '按顺序点数字，连出一幅画！', hzbuild: '把偏旁拖到字的旁边，拼出新的汉字！', pipes: '转动水管，让水流到小花那里！', lights: '点一颗星，周围的星星也会变，把它们全部点亮！',
    simon: '听音乐，记住顺序，再弹出来！', cook: '看客人点了什么，把食物放进盘子上菜！', sym: '照着另一半，画出对称的图案！',
    equation: '用数字卡片和符号，拼出等于目标的算式！', traffic: '先左右看，绿灯亮了再一步一步过马路！', jigsaw: '交换拼图块，把图片拼完整！',
  });
  ['make10', 'cashier', 'hangman', 'dots', 'hzbuild', 'pipes', 'lights', 'simon', 'cook', 'sym', 'equation', 'traffic', 'jigsaw'].forEach(k => Engines.NONQ.add(k));
  ['make10', 'traffic', 'cook'].forEach(k => Engines.REALTIME.add(k));
  Engines.PLAY = new Set(['make10', 'cashier', 'hangman', 'dots', 'hzbuild', 'pipes', 'lights', 'simon', 'cook', 'sym', 'equation', 'traffic', 'jigsaw', 'balance', 'pixel', 'trace', 'wsearch', 'clockset', 'memory', 'connect', 'sort', 'order', 'spell']);
})();
