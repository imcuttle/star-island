/* 星星大冒险：经典横版跳跃
   超级蘑菇变大、火焰花发火球、无敌星、水管 + 食人花、乌龟壳、弹簧、砖块、金币砖、阶梯、旗杆和城堡。
   关卡由若干「段落」随机拼成；生成后用和游戏完全相同的物理把所有跳法模拟一遍，
   碰不到的金币直接删掉、顶不到的问号砖改成空砖，保证每一枚金币都吃得到。 */
(function () {
  const { h, E, hydrate, UI, Audio2, Voice } = Core;
  const R = CONTENT.R;
  const A = window.Arcade;

  /* ---------- 物理（游戏和可达性检测共用同一份） ---------- */
  const DT = 1 / 60, G = 38, JUMP = 18.6, WALK = 5.6, RUN = 7.6, MAXF = 20, SPRING = [21, 27];
  // 碰撞盒＝画面上看到的身体：小个子 1.5 格高，吃蘑菇后 2.35 格高（画的时候按不透明像素的范围对齐到这个盒子）
  const SMALL = { w: .62, h: 1.5 }, BIG = { w: .8, h: 2.35 };
  // 「够得着」的标准：至少有 MIN_WAYS 种不同的跳法能吃到 / 顶到（只有一种极限操作才行的不算）
  const MIN_WAYS = 3;
  const GD = 1, BR = 2, QK = 3, US = 4, HD = 5, QC = 6, MC = 7, PP = 8, SP = 9;
  function phys(P, ax, jumpEdge, hold, run, M) {
    P.jb = jumpEdge ? .12 : P.jb - DT;
    P.runT = P.on ? (ax && Math.sign(ax) === Math.sign(P.vx || ax) ? P.runT + DT : 0) : P.runT;
    const max = run || P.runT > .5 ? RUN : WALK;
    P.vx += (ax * max - P.vx) * Math.min(1, DT * (P.on ? (ax ? 10 : 14) : 5));
    P.coy = P.on ? .1 : P.coy - DT; P.jumped = false;
    if (P.jb > 0 && P.coy > 0) { P.vy = -JUMP; P.coy = 0; P.jb = 0; P.on = false; P.jumped = true; }
    if (!hold && P.vy < -7) P.vy = -7;
    P.vy = Math.min(MAXF, P.vy + G * DT);
    // 横向
    P.x += P.vx * DT;
    const y0 = Math.floor(P.y + .05), y1 = Math.floor(P.y + P.h - .05);
    for (let cy = y0; cy <= y1; cy++) {
      if (P.vx > 0 && M.solid(Math.floor(P.x + P.w), cy)) { P.x = Math.floor(P.x + P.w) - P.w - .001; P.vx = 0; }
      else if (P.vx < 0 && M.solid(Math.floor(P.x), cy)) { P.x = Math.floor(P.x) + 1.001; P.vx = 0; }
    }
    // 纵向
    P.y += P.vy * DT; P.on = false; P.head = -1; P.spring = false;
    const x0 = Math.floor(P.x + .04), x1 = Math.floor(P.x + P.w - .04);
    if (P.vy >= 0) {
      const cy = Math.floor(P.y + P.h);
      for (let cx = x0; cx <= x1; cx++) if (M.solid(cx, cy)) { P.y = cy - P.h; P.vy = 0; P.on = true; if (M.tile(cx, cy) === SP) { P.spring = true; P.springX = cx; } }
      if (P.spring) { P.vy = -(hold ? SPRING[1] : SPRING[0]); P.on = false; P.coy = 0; }
    } else {
      const cy = Math.floor(P.y), hit = [];
      for (let cx = x0; cx <= x1; cx++) if (M.solid(cx, cy)) hit.push(cx);
      if (hit.length) {
        // 只蹭到砖块一点边角：把人轻推过去，不打断跳跃
        let slid = false;
        if (hit.length === 1 && x0 !== x1) {
          const nx = hit[0] === x0 ? x0 + 1.01 : x1 - P.w - .01;
          if (Math.abs(nx - P.x) < .26) {
            let free = true; const r0 = Math.floor(P.y + .05), r1 = Math.floor(P.y + P.h - .05);
            for (let cx = Math.floor(nx + .04); cx <= Math.floor(nx + P.w - .04); cx++) for (let r = r0; r <= r1; r++) if (M.solid(cx, r)) free = false;
            if (free) { P.x = nx; slid = true; }
          }
        }
        if (!slid) {
          const mid = P.x + P.w / 2; hit.sort((a, b) => Math.abs(a + .5 - mid) - Math.abs(b + .5 - mid));
          P.y = cy + 1; P.vy = 0; P.head = hit[0]; P.headY = cy;
        }
      }
    }
  }
  // 敌人 / 道具 / 火球：简单的重力 + 碰墙
  function move(e, M) {
    e.vy = Math.min(MAXF, (e.vy || 0) + G * DT); let wall = false;
    e.x += e.vx * DT;
    const y0 = Math.floor(e.y + .05), y1 = Math.floor(e.y + e.h - .05);
    for (let cy = y0; cy <= y1; cy++) {
      if (e.vx > 0 && M.solid(Math.floor(e.x + e.w), cy)) { e.x = Math.floor(e.x + e.w) - e.w - .001; wall = true; }
      else if (e.vx < 0 && M.solid(Math.floor(e.x), cy)) { e.x = Math.floor(e.x) + 1.001; wall = true; }
    }
    e.y += e.vy * DT; e.on = false;
    const x0 = Math.floor(e.x + .04), x1 = Math.floor(e.x + e.w - .04);
    if (e.vy >= 0) { const cy = Math.floor(e.y + e.h); for (let cx = x0; cx <= x1; cx++) if (M.solid(cx, cy)) { e.y = cy - e.h; e.vy = 0; e.on = true; } }
    else { const cy = Math.floor(e.y); for (let cx = x0; cx <= x1; cx++) if (M.solid(cx, cy)) { e.y = cy + 1; e.vy = 0; } }
    return wall;
  }
  const coinHit = (P, c) => Math.abs(c.x - (P.x + P.w / 2)) < P.w / 2 + .3 && Math.abs(c.y - (P.y + P.h / 2)) < P.h / 2 + .3;
  const overlap = (a, b, m) => a.x + m < b.x + b.w && a.x + a.w - m > b.x && a.y + m < b.y + b.h && a.y + a.h - m > b.y;
  const mapper = L => ({
    solid: (cx, cy) => cx < 0 || cx >= L.W ? true : cy >= 0 && cy < L.HT && L.map[cy][cx] > 0,
    tile: (cx, cy) => cx >= 0 && cx < L.W && cy >= 0 && cy < L.HT ? L.map[cy][cx] : 0,
  });

  /* ---------- 关卡生成：段落拼装 ---------- */
  function gen(g) {
    const HT = 15, GY = 12, LOW = GY - 4, UP = GY - 8, MAXW = 640;
    const map = Array.from({ length: HT }, () => new Uint8Array(MAXW));
    const L = { HT, GY, map, coins: [], foes: [], pipes: [], deco: [], g };
    let x = 0;
    const gr = (a, b) => { for (let cx = a; cx < b; cx++) for (let y = GY; y < HT; y++) map[y][cx] = GD; };
    const put = (cx, cy, v) => { map[cy][cx] = v; };
    const coin = (cx, cy) => L.coins.push({ x: cx, y: cy });
    const foe = (kind, fx, feet) => L.foes.push({ kind, x: fx, feet: feet == null ? GY : feet });
    const deco = (a, b) => { for (let cx = a + 1; cx < b - 1; cx += R.int(3, 6)) L.deco.push([cx, R.pick(['bush', 'bush', 'bush', 'grass', 'rock', 'mushroom_red', 'mushroom_brown'])]); };
    const C = {
      flat(n) { gr(x, x + n); deco(x, x + n); if (n >= 7 && Math.random() < .6) { const a = x + R.int(1, n - 5); for (let k = 0; k < 4; k++) coin(a + k + .5, GY - 2.6); } x += n; },
      intro() { gr(0, 18); deco(0, 18); put(9, LOW, QK); for (let k = 0; k < 3; k++) coin(13 + k + .5, GY - 2.6); x = 18; },
      // 经典开场：一个问号砖，再来一排「砖 ? 砖 ? 砖」，上面还有一个
      qrow() { gr(x, x + 15); deco(x, x + 15); put(x + 2, LOW, QK); [BR, QK, BR, QC, BR].forEach((v, k) => put(x + 7 + k, LOW, v)); put(x + 9, UP, g >= 1 ? QK : QC); foe('goomba', x + 12.5); x += 15; },
      // 一高一高的绿水管，管子里可能有食人花
      pipes() {
        const hs = g <= 0 ? [2, 3] : g <= 1 ? [2, 3, 3] : [2, 3, 4], n = 3 + hs.length * 7;
        gr(x, x + n);
        hs.forEach((ph, k) => {
          const px = x + 3 + k * 7; for (let y = GY - ph; y < GY; y++) { put(px, y, PP); put(px + 1, y, PP); }
          const plant = g >= 1 && (k > 0 || g >= 2) && Math.random() < .6;
          L.pipes.push({ x: px, top: GY - ph, plant, t: Math.random() * 2, py: 0 });
          if (!plant) { coin(px + .5, GY - ph - 1.5); coin(px + 1.5, GY - ph - 1.5); }
          if (k < hs.length - 1 || g >= 2) foe(k % 2 && g >= 2 ? 'snail' : 'goomba', px + 3.6);
        });
        x += n;
      },
      // 深坑，上面一道金币弧线
      pit() {
        const w = g <= 0 ? 2 : g <= 2 ? R.int(2, 3) : g === 3 ? R.int(3, 4) : 4; gr(x, x + 4); const a = x + 4;
        for (let k = 0; k <= w + 1; k++) coin(a - 1 + k + .5, GY - 1.2 - 3 * Math.sin(Math.PI * (k + .5) / (w + 2)));
        x = a + w; gr(x, x + 4); deco(x, x + 4); x += 4;
      },
      // 空中砖桥：顶上一排金币，桥上有小怪
      bridge() {
        gr(x, x + 14); deco(x, x + 14); const a = x + 3, n = 7;
        for (let k = 0; k < n; k++) put(a + k, LOW, k === 2 ? QC : k === 5 ? MC : BR);
        for (let k = 1; k < n - 1; k++) coin(a + k + .5, LOW - .6);
        foe('goomba', a + 3, LOW); x += 14;
      },
      // 乌龟壳保龄球：踩一下乌龟，再踢壳撞倒后面一排小怪
      shell() { gr(x, x + 18); deco(x, x + 18); foe('snail', x + 5); foe('goomba', x + 11); foe('goomba', x + 12.6); if (g >= 2) foe('goomba', x + 14.2); for (let k = 0; k < 4; k++) coin(x + 8 + k + .5, GY - 2.6); x += 18; },
      // 弹簧把人弹上云端的金币平台
      spring() {
        gr(x, x + 15); deco(x, x + 15); put(x + 3, GY - 1, SP);
        for (let k = 0; k < 5; k++) { put(x + 6 + k, 5, HD); coin(x + 6 + k + .5, 4.4); }
        coin(x + 3.5, 6.5); coin(x + 3.5, 4.5); x += 15;
      },
      // 硬砖阶梯（高年级中间有坑）
      stairs() {
        const hh = g <= 1 ? 3 : 4, gap = g >= 2 ? 2 : 0;
        gr(x, x + 2 + hh); x += 2;
        for (let i = 0; i < hh; i++) for (let y = GY - 1 - i; y < GY; y++) put(x + i, y, HD);
        x += hh;
        if (gap) { for (let k = 0; k < gap; k++) coin(x + k + .5, GY - hh - 1.6); x += gap; } else { gr(x, x + 2); for (let k = 0; k < 2; k++) coin(x + k + .5, GY - hh - 1); x += 2; }
        gr(x, x + hh + 3);
        for (let i = 0; i < hh; i++) for (let y = GY - hh + i; y < GY; y++) put(x + i, y, HD);
        x += hh + 3;
      },
      // 金币砖：一顶一个金币，多顶几次还有
      coinblocks() { gr(x, x + 11); deco(x, x + 11); put(x + 3, LOW, QC); put(x + 4, LOW, MC); put(x + 5, LOW, QC); foe('goomba', x + 8); x += 11; },
      // 会飞的小蜜蜂
      flyers() { gr(x, x + 15); deco(x, x + 15); foe('bee', x + 7, 9); foe('bee', x + 12, 7.5); for (let k = 0; k < 3; k++) coin(x + 9 + k + .5, GY - 2.6); x += 15; },
      // 终点：大阶梯 → 旗杆 → 城堡
      final() {
        const hh = Math.min(8, 5 + g); gr(x, x + hh + 2);
        for (let i = 0; i <= hh; i++) { const hgt = Math.min(hh, i + 1); for (let y = GY - hgt; y < GY; y++) put(x + i, y, HD); }
        x += hh + 1; gr(x, x + 24); L.FX = x + 4; put(L.FX, GY - 1, HD); L.castle = x + 11; x += 24; L.W = x;
      },
    };
    C.intro();
    const pool = ['qrow', 'pipes', 'pit', 'bridge', 'shell', 'stairs', 'coinblocks', 'spring', 'pit'];
    if (g >= 2) pool.push('pipes'); if (g >= 3) pool.push('flyers'); if (g >= 4) pool.push('pit', 'shell', 'flyers');
    const seq = R.shuffle(pool); seq.splice(Math.floor(seq.length / 2) + 1, 0, 'qrow');
    L.seq = []; seq.forEach(k => { L.seq.push([k, x]); C[k](); C.flat(R.int(3, 6)); });
    C.final();
    return L;
  }

  /* ---------- 可达性检测：模拟所有跳法，找出够得着的金币和问号砖 ---------- */
  const MACS = [];
  [.1, .22, 1].forEach(hold => [-1, 0, 1].forEach(d1 => [-1, 0, 1].forEach(d2 => { if (hold > .1 || d1 === d2) MACS.push({ hold, d1, d2, ts: d1 === d2 ? 9 : .28 }); })));
  [-1, 1].forEach(d => MACS.push({ hold: 0, d1: d, d2: d, ts: 9, walk: true }));
  function analyze(L, dims) {
    const D = dims || SMALL;
    const M = mapper(L), { HT } = L;
    const stand = (cx, cy) => M.solid(cx, cy) && cy > 0 && !M.solid(cx, cy - 1) && cx >= 0 && cx < L.W;
    const cg = new Map(); L.coins.forEach((c, i) => { const k = Math.floor(c.x) * 64 + Math.floor(c.y); (cg.get(k) || cg.set(k, []).get(k)).push(i); });
    const nC = L.coins.length, ways = new Uint16Array(nC), lastSim = new Int32Array(nC).fill(-1), heads = new Map(), headSim = new Map(), seen = new Set(), Q = [];
    let simId = 0;
    const push = (cx, cy) => { const k = cx * 64 + cy; if (!seen.has(k) && stand(cx, cy)) { seen.add(k); Q.push([cx, cy]); if (!goal && cx > L.FX) { goal = true; left--; } } };
    // 要确认的东西：每枚金币、每个问号砖 / 金币砖、终点；全部确认就提前结束
    const want = new Set(); for (let cy = 0; cy < HT; cy++) for (let cx = 0; cx < L.W; cx++) { const v = L.map[cy][cx]; if (v === QK || v === QC || v === MC) want.add(cx * 64 + cy); }
    let goal = false, left = L.coins.length + want.size + 1;
    const coinCol = new Uint8Array(L.W + 12); L.coins.forEach(c => coinCol[Math.floor(c.x)] = 1);
    const plain = (cx, cy) => { for (let k = cx - 5; k <= cx + 5; k++) if (coinCol[k]) return false; for (let k = cx - 4; k <= cx + 4; k++) for (let r = Math.max(0, cy - 7); r < cy; r++) if (M.solid(k, r)) return false; return true; };
    const P = {};
    const touch = () => {
      for (let cx = Math.floor(P.x - .4); cx <= Math.floor(P.x + P.w + .4); cx++) for (let cy = Math.floor(P.y - .4); cy <= Math.floor(P.y + P.h + .4); cy++) {
        const l = cg.get(cx * 64 + cy); if (l) l.forEach(i => { if (lastSim[i] !== simId && coinHit(P, L.coins[i])) { lastSim[i] = simId; if (++ways[i] === MIN_WAYS) left--; } });
      }
    };
    const springs = new Set();
    const run = m => {
      simId++;
      for (let i = 0; i < 240; i++) {
        const t = i * DT;
        phys(P, t < m.ts ? m.d1 : m.d2, i === 0 && m.hold > 0 && !m.air, t < m.hold, P.run, M);
        touch(); if (P.head >= 0) { const hk = P.head * 64 + P.headY; if (headSim.get(hk) !== simId) { headSim.set(hk, simId); const n = (heads.get(hk) || 0) + 1; heads.set(hk, n); if (n === MIN_WAYS && want.has(hk)) left--; } }
        if (P.spring) { if (!springs.has(P.springX)) { springs.add(P.springX); Q.push([P.springX, -1]); } return; }
        if (P.y > HT) return;
        if (P.on && (m.walk || i > 2)) {
          const cy = Math.floor(P.y + P.h + .01); let cx = Math.floor(P.x + P.w / 2);
          if (!M.solid(cx, cy)) cx = M.solid(Math.floor(P.x + .04), cy) ? Math.floor(P.x + .04) : Math.floor(P.x + P.w - .04);
          push(cx, cy); if (!m.walk || t > .45) return;
        }
      }
    };
    const sim = (x0, feet, vx0, m) => { Object.assign(P, { x: x0, y: feet - D.h, w: D.w, h: D.h, vx: vx0, vy: 0, on: true, coy: .1, jb: 0, runT: vx0 ? 1 : 0, run: vx0 !== 0 }); run(m); };
    // 弹簧：从弹起那一刻开始，分别试「弹起后马上 / 稍后 / 到顶再」往左右移动
    const simSpring = cx => [true, false].forEach(strong => [-1, 0, 1].forEach(d1 => [-1, 0, 1].forEach(d2 => [.2, .45, .7].forEach(ts => {
      if (d1 === d2 && ts > .2) return;
      Object.assign(P, { x: cx + (1 - D.w) / 2, y: L.GY - 1 - D.h, w: D.w, h: D.h, vx: 0, vy: -SPRING[strong ? 1 : 0], on: false, coy: 0, jb: 0, runT: 0, run: false });
      run({ hold: strong ? 9 : 0, d1, d2, ts, air: true });
    }))));
    push(4, L.GY);
    while (Q.length && left > 0) {
      const [cx, cy] = Q.pop();
      if (cy < 0) { simSpring(cx); continue; }
      // 长长的平地中间、附近没有金币也没有头顶上的砖：直接走过去，不用在这里起跳（其余每一格都要试）
      const inner = stand(cx - 1, cy) && stand(cx + 1, cy) && stand(cx - 2, cy) && stand(cx + 2, cy);
      if (inner && plain(cx, cy)) { push(cx - 1, cy); push(cx + 1, cy); continue; }
      const runway = d => { let k = 1; while (k < 4 && stand(cx - d * k, cy)) k++; return k >= 4; };
      (inner ? [cx + .14] : [cx + .03, cx + 1 - D.w - .03]).forEach(x0 => MACS.forEach(m => {
        sim(x0, cy, 0, m);
        if (m.d1 && !m.walk && runway(m.d1)) sim(x0, cy, m.d1 * RUN, m);
      }));
    }
    const got = Array.from(ways, n => n >= MIN_WAYS ? 1 : 0), okHead = k => (heads.get(k) || 0) >= MIN_WAYS;
    return { got, ways, heads, okHead, reachGoal: goal, seen };
  }
  function build(g) {
    let L = null;
    for (let tries = 0; tries < 6; tries++) {
      L = gen(g); const r = analyze(L); L.stats = { coins0: L.coins.length, cut: L.coins.filter((c, i) => !r.got[i]), tries: tries + 1 };
      L.coins = L.coins.filter((c, i) => r.got[i]);
      L.stats.qkCut = [];
      for (let cy = 0; cy < L.HT; cy++) for (let cx = 0; cx < L.W; cx++) { const v = L.map[cy][cx]; if ((v === QK || v === QC || v === MC) && !r.okHead(cx * 64 + cy)) { L.map[cy][cx] = US; L.stats.qkCut.push([cx, cy]); } }
      if (r.reachGoal) break;
    }
    return L;
  }


  /* ---------- 精灵的「看得见的部分」：画的时候把它对齐到碰撞盒 ---------- */
  const BOUNDS = {"terrain_grass_block_top":[0.0,0.0,1.0,1.0],"terrain_grass_block_center":[0.0,0.0,1.0,1.0],"terrain_grass_block_top_left":[0.0,0.0,1.0,1.0],"terrain_grass_block_top_right":[0.0,0.0,1.0,1.0],"terrain_grass_block_left":[0.0,0.0,1.0,1.0],"terrain_grass_block_right":[0.0,0.0,1.0,1.0],"bricks_brown":[0.0,0.0,1.0,1.0],"brick_brown":[0.25,0.312,0.5,0.375],"block_coin":[0.0,0.0,1.0,1.0],"block_empty":[0.0,0.0,1.0,1.0],"block_strong_empty":[0.0,0.0,1.0,1.0],"coin_gold":[0.203,0.188,0.594,0.625],"coin_gold_side":[0.375,0.188,0.25,0.625],"star":[0.188,0.203,0.625,0.594],"heart":[0.219,0.25,0.562,0.5],"fireball":[0.25,0.234,0.5,0.531],"spring":[0.0,0.312,1.0,0.688],"spring_out":[0.0,0.0,1.0,1.0],"bush":[0.0,0.375,1.0,0.625],"grass":[0.172,0.5,0.656,0.5],"mushroom_red":[0.281,0.625,0.438,0.375],"mushroom_brown":[0.281,0.562,0.438,0.438],"rock":[0.0,0.312,0.984,0.688],"slime_normal_walk_a":[0.062,0.344,0.875,0.656],"slime_normal_walk_b":[0.0,0.438,1.0,0.562],"mouse_walk_a":[0.0,0.266,1.0,0.734],"mouse_walk_b":[0.031,0.234,0.953,0.766],"ladybug_walk_a":[0.0,0.219,0.984,0.781],"ladybug_walk_b":[0.031,0.188,0.953,0.812],"snail_walk_a":[0.0,0.203,1.0,0.797],"snail_walk_b":[0.0,0.172,1.0,0.828],"snail_shell":[0.078,0.375,0.844,0.625],"slime_normal_flat":[0.047,0.688,0.906,0.312],"mouse_rest":[0.0,0.344,1.0,0.656],"ladybug_rest":[0.0,0.219,0.984,0.781],"bee_a":[0.031,0.094,0.938,0.797],"bee_b":[0.0,0.203,0.969,0.625]};
  function bbox(im) {
    if (!im) return [0, 0, 1, 1];
    if (im._bb) return im._bb;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; if (!iw || !ih) return [0, 0, 1, 1];
    const name = (im.src || '').split('/').pop().replace(/\.png.*$/, '');
    if (BOUNDS[name]) return (im._bb = BOUNDS[name]);
    try {
      const c = document.createElement('canvas'), w = Math.min(iw, 256), hh = Math.round(ih * w / iw); c.width = w; c.height = hh;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, hh); const d = x.getImageData(0, 0, w, hh).data;
      let x0 = w, y0 = hh, x1 = -1, y1 = -1;
      for (let y = 0; y < hh; y++) for (let k = 0; k < w; k++) if (d[(y * w + k) * 4 + 3] > 24) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      im._bb = x1 < 0 ? [0, 0, 1, 1] : [x0 / w, y0 / hh, (x1 - x0 + 1) / w, (y1 - y0 + 1) / hh];
    } catch (e) { im._bb = [0, 0, 1, 1]; }
    return im._bb;
  }
  // 把图片 im 画成：看得见的部分正好填满 (bx, by, bw, bh)（单位：像素）
  function fitDraw(c, im, bx, by, bw, bh) { const [u, v, uw, vh] = bbox(im), iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; c.drawImage(im, u * iw, v * ih, uw * iw, vh * ih, bx, by, bw, bh); }

  /* ---------- 程序绘制的经典造型（缓存成小画布） ---------- */
  const SPR = {};
  const spr = (key, w, hh, paint) => { if (!SPR[key]) { const c = document.createElement('canvas'); c.width = w; c.height = hh; paint(c.getContext('2d'), w, hh); SPR[key] = c; } return SPR[key]; };
  const rr = (c, x, y, w, hh, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const qBlock = f => spr('q' + f, 64, 64, (c, w) => {
    rr(c, 0, 0, w, w, 9); c.fillStyle = '#8a3c00'; c.fill();
    const gd = c.createLinearGradient(0, 0, 0, w); gd.addColorStop(0, '#ffe38a'); gd.addColorStop(.5, '#fbbf24'); gd.addColorStop(1, '#e68a00');
    rr(c, 3, 3, w - 6, w - 6, 7); c.fillStyle = gd; c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(7, 6, w - 14, 4); c.fillStyle = 'rgba(120,50,0,.35)'; c.fillRect(7, w - 10, w - 14, 4);
    c.fillStyle = '#8a3c00'; [[10, 10], [w - 10, 10], [10, w - 10], [w - 10, w - 10]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); });
    c.font = '900 42px "Arial Black", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#8a3c00'; c.fillText('?', w / 2 + 2, w / 2 + 4); c.fillStyle = ['#fffbea', '#ffe9a8', '#ffd35c'][f]; c.fillText('?', w / 2, w / 2 + 1);
  });
  const mushroom = () => spr('mush', 64, 64, c => {
    c.fillStyle = '#fbe3b8'; rr(c, 15, 30, 34, 30, 10); c.fill(); c.strokeStyle = '#6b3a12'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#222'; [[26, 44], [38, 44]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 3, 6, 0, 0, 7); c.fill(); });
    c.beginPath(); c.moveTo(3, 36); c.bezierCurveTo(2, 4, 62, 4, 61, 36); c.closePath(); c.fillStyle = '#e8302a'; c.fill(); c.strokeStyle = '#5a0f0a'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#fff'; [[32, 17, 9], [12, 28, 5.5], [52, 28, 5.5]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
  });
  const flower = () => spr('flower', 64, 64, c => {
    c.fillStyle = '#2e9e3a'; c.fillRect(29, 34, 6, 30);
    [[-1, 1], [1, 1]].forEach(([s]) => { c.beginPath(); c.ellipse(32 + s * 11, 52, 11, 5, s * -.5, 0, 7); c.fill(); });
    [['#ff5a1f', 27, 16], ['#ffd23f', 19, 11], ['#fff7e0', 11, 7]].forEach(([col, rx, ry]) => { c.fillStyle = col; c.beginPath(); c.ellipse(32, 20, rx, ry + 5, 0, 0, 7); c.fill(); });
    c.fillStyle = '#222'; [[28, 20], [36, 20]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 2, 4, 0, 0, 7); c.fill(); });
  });
  const piranha = f => spr('pir' + f, 64, 96, c => {
    c.fillStyle = '#2e9e3a'; c.fillRect(28, 46, 8, 50);
    c.beginPath(); c.ellipse(18, 70, 13, 6, -.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(46, 78, 13, 6, .5, 0, 7); c.fill();
    const op = f ? .55 : .18;
    [[-1, '#e8302a'], [1, '#d62820']].forEach(([s, col]) => {
      c.save(); c.translate(32, 36); c.rotate(s * op);
      c.beginPath(); c.arc(0, 0, 24, s < 0 ? Math.PI : 0, s < 0 ? Math.PI * 2 : Math.PI); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = '#5a0f0a'; c.lineWidth = 2.5; c.stroke();
      c.fillStyle = '#fff'; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * 8 - 3, 0); c.lineTo(k * 8 + 3, 0); c.lineTo(k * 8, s * -6); c.fill(); }
      [[-11, s * -12], [9, s * -15], [0, s * -6]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 3.2, 0, 7); c.fill(); });
      c.restore();
    });
  });
  const flagSpr = () => spr('flag', 96, 64, c => {
    c.beginPath(); c.moveTo(96, 4); c.lineTo(96, 60); c.lineTo(2, 32); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#d4d9e6'; c.lineWidth = 3; c.stroke();
    c.font = '30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffb000'; c.fillText('★', 66, 33);
  });
  // 终点城堡：砖墙、城垛、拱门、窗户、塔顶小旗
  const castleSpr = () => spr('castle', 320, 384, c => {
    const B = 32, brick = (x, y, w, hh) => {
      c.fillStyle = '#c8602a'; c.fillRect(x, y, w, hh);
      c.strokeStyle = '#7a2e0e'; c.lineWidth = 2;
      for (let r = 0; r * 16 < hh; r++) { const yy = y + r * 16; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); for (let k = (r % 2) * 16; k < w; k += 32) { c.beginPath(); c.moveTo(x + k, yy); c.lineTo(x + k, Math.min(y + hh, yy + 16)); c.stroke(); } }
      c.fillStyle = 'rgba(255,220,180,.18)'; c.fillRect(x, y, w, 4); c.strokeStyle = '#5a1f08'; c.lineWidth = 3; c.strokeRect(x, y, w, hh);
    };
    const crenel = (x, y, w) => { for (let k = 0; k < w; k += B) if ((k / B) % 2 === 0) brick(x + k, y - 24, B, 24); };
    brick(0, 192, 320, 192); crenel(0, 192, 320);
    brick(80, 64, 160, 128); crenel(80, 64, 160);
    c.fillStyle = '#1a0d06'; c.beginPath(); c.moveTo(128, 384); c.lineTo(128, 300); c.arc(160, 300, 32, Math.PI, 0); c.lineTo(192, 384); c.closePath(); c.fill();
    [[104, 104], [184, 104]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x, y + 48); c.lineTo(x, y + 14); c.arc(x + 16, y + 14, 16, Math.PI, 0); c.lineTo(x + 32, y + 48); c.closePath(); c.fill(); });
    c.fillStyle = '#ffd36b'; [[104, 104], [184, 104]].forEach(([x, y]) => c.fillRect(x + 6, y + 22, 20, 20));
    c.fillStyle = '#5a1f08'; c.fillRect(158, 0, 4, 40); c.beginPath(); c.moveTo(162, 2); c.lineTo(200, 14); c.lineTo(162, 26); c.closePath(); c.fillStyle = '#ff4d6d'; c.fill();
    c.font = '18px sans-serif'; c.fillStyle = '#ffd23f'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', 176, 14);
  });
  const pipeGrad = (c, X, w, light) => { const g2 = c.createLinearGradient(X, 0, X + w, 0); g2.addColorStop(0, '#0e5a1a'); g2.addColorStop(.12, light ? '#3fbf46' : '#2fa83a'); g2.addColorStop(.3, '#a6f58e'); g2.addColorStop(.45, light ? '#5fd85a' : '#4cc94a'); g2.addColorStop(.85, '#1f8a2c'); g2.addColorStop(1, '#0c4a16'); return g2; };

  // 敌人贴图 1.05 格一张；碰撞盒＝参考帧里看得见的部分
  const FOE_SCALE = 1.05, FOE_REF = { slime_normal: 'slime_normal_walk_a', mouse: 'mouse_walk_a', ladybug: 'ladybug_walk_a', snail: 'snail_walk_a', bee: 'bee_a', snail_shell: 'snail_shell' };
  const FOE_BOX = sk => { const b = BOUNDS[FOE_REF[sk]]; return [+(b[2] * FOE_SCALE).toFixed(3), +(b[3] * FOE_SCALE).toFixed(3)]; };
  const POLE = .08, PIR_H = 1.5, VH = 10.5;

  /* =====================================================================
     游戏本体
     ===================================================================== */
  function platform(S, data) {
    return new Promise(resolve => {
      const { wrap, hud } = A.arena(S, 'pf');
      const { cv, ctx, fit } = (() => { const cv = document.createElement('canvas'); cv.className = 'ar-cv'; wrap.insertBefore(cv, hud); const ctx = cv.getContext('2d'); return { cv, ctx, fit: () => { const r = wrap.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(10, r.width * d); cv.height = Math.max(10, r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); return { w: r.width, h: r.height }; } }; })();
      const nextQ = A.feeder(S, data), g = Math.max(0, Math.min(4, S.grade));
      const L = build(g), { map, HT, GY, W } = L, M = mapper(L);
      const IMG = k => A.img('assets/img/' + k + '.png'), T = k => IMG('tile/' + k), ok = A.ok;
      // 金币看得见的部分：直径 .6 格，正好是吃金币的判定范围
      const drawCoin = (x, y, side) => { const im = T(side ? 'coin_gold_side' : 'coin_gold'); if (!ok(im)) return; const w = side ? .25 : .6; fitDraw(ctx, im, (x - w / 2 - camX) * SC, (y - .3) * SC, w * SC, .6 * SC); };
      // ---- 状态 ----
      const P = { x: 3, y: GY - SMALL.h, w: SMALL.w, h: SMALL.h, vx: 0, vy: 0, on: true, coy: 0, jb: 0, runT: 0, face: 1, pw: 0, inv: 0, star: 0, grow: 0, state: 'play', safe: { x: 3, feet: GY } };
      const SK = { goomba: () => R.pick(['slime_normal', 'mouse', 'ladybug']), snail: () => 'snail', bee: () => 'bee' };
      const foes = L.foes.map(f => { const sk = SK[f.kind](), sz = FOE_BOX(sk); return { kind: f.kind, sk, x: f.x - sz[0] / 2, y: f.feet - sz[1], y0: f.feet - sz[1], x0: f.x, w: sz[0], h: sz[1], vx: 0, vy: 0, dir: -1, t: Math.random() * 9, state: 'walk', act: false, dead: false, grace: 0 }; });
      const items = [], balls = [], fx = [], bumps = new Map(), mcHits = new Map();
      let camX = 0, camY = GY + 2 - VH, SC = 1, paused = false, done = false, nCoins = 0, deaths = 0, qTotal = 0, walkT = 0, last = performance.now(), acc = 0, flagY = 2.2, springAt = { x: -1, t: 0 }, endT = 0;
      const IN = A.Input(wrap, { stick: 'lr', buttons: [
        { id: 'jump', icon: '⬆️', label: '跳', keys: [' ', 'w', 'W', 'ArrowUp', 'k', 'K'], big: true },
        { id: 'fire', icon: '🔥', label: '火球', keys: ['j', 'J', 'x', 'X', 'Enter'] },
        { id: 'run', icon: '💨', label: '冲刺', keys: ['Shift'], hidden: true },
      ] });
      // 角色立绘：3D 渲染还没好就先用表情，渲染好了立刻换上
      let fr = A.heroFrames();
      if (!fr.sprite && window.App && App.prepHeroShots && Core.Store.p) App.prepHeroShots(Core.Store.p).then(() => { const f2 = A.heroFrames(); if (f2.sprite) fr = f2; }).catch(() => {});
      const PW_ICON = ['', '🍄', '🌼'];
      const drawHud = () => {
        hud.innerHTML = '<span>' + E('❤️') + ' <b class="latin">' + Math.max(0, S.hearts) + '</b></span><span>' + E('🪙') + ' <b class="latin">' + nCoins + '</b></span><span>' + E('❓') + ' <b class="latin">' + S.right + '/' + qTotal + '</b></span>'
          + (P.pw ? '<span>' + E(PW_ICON[P.pw]) + (P.pw === 2 ? ' 火球' : ' 变大') + '</span>' : '') + (P.star > 0 ? '<span class="pf-star">' + E('⭐') + ' 无敌</span>' : '')
          + '<div class="ar-prog"><i style="width:' + Math.min(100, P.x / L.FX * 100) + '%"></i></div>';
        hydrate(hud); wrap.classList.toggle('fire', P.pw === 2);
      };
      const setSize = big => { const z = big ? BIG : SMALL; P.y += P.h - z.h; P.x += (P.w - z.w) / 2; P.h = z.h; P.w = z.w; };
      const power = kind => {
        if (kind === 'mush') { if (P.pw === 0) { P.pw = 1; setSize(true); P.grow = .7; Audio2.sfx('levelup', .5); Voice.say('变大啦！'); } else { nCoins += 5; Audio2.sfx('coin', .5); } }
        else if (kind === 'flower') { if (P.pw === 0) { setSize(true); P.grow = .7; } P.pw = 2; Audio2.sfx('magic', .6); Voice.say('火焰花！按火球键发射'); }
        else if (kind === 'star') { P.star = 8; Audio2.sfx('magic', .6); Voice.say('无敌星星！'); }
        else if (kind === 'heart') { S.hearts = Math.min(5, S.hearts + 1); S.renderHearts(); Audio2.sfx('levelup', .5); Voice.say('生命加一！'); }
        drawHud();
      };
      const addCoin = n => { const before = Math.floor(nCoins / 50); nCoins += n || 1; if (Math.floor(nCoins / 50) > before) power('heart'); };
      const hurt = () => {
        if (P.inv > 0 || P.star > 0 || S.god || P.state !== 'play') return;
        if (P.pw > 0) { P.pw = 0; setSize(false); P.inv = 2; P.grow = .5; Audio2.sfx('hurt', .5); drawHud(); return; }
        S.hearts--; S.renderHearts(); deaths++; P.inv = 2; P.vy = -9; P.vx = -P.face * 4; Audio2.sfx('hurt', .5); drawHud();
        if (S.hearts <= 0) end(true);
      };
      const fall = () => {
        if (!S.god) { S.hearts--; S.renderHearts(); deaths++; Audio2.sfx('hurt', .5); }
        if (S.hearts <= 0) return end(true);
        Object.assign(P, { x: P.safe.x, y: P.safe.feet - P.h, vx: 0, vy: 0, inv: 2.5 }); drawHud();
      };
      const kill = (e, vx) => { if (e.dead) return; e.dead = true; e.flip = true; e.vy = -9; e.vx = vx || 0; e.dt = 0; Audio2.sfx('hit', .45); addCoin(1); drawHud(); };
      const coinPop = (cx, cy) => { fx.push({ k: 'coin', x: cx + .5, y: cy - .2, vy: -13, t: 0 }); addCoin(1); Audio2.sfx('coin', .35); drawHud(); };
      const bumpTop = (cx, cy) => {
        foes.forEach(e => { if (!e.dead && e.x + e.w > cx && e.x < cx + 1 && Math.abs(e.y + e.h - cy) < .25) kill(e, e.x + e.w / 2 < cx + .5 ? -2 : 2); });
        L.coins.forEach(c => { if (!c.got && Math.floor(c.x) === cx && c.y < cy && c.y > cy - 1.2) { c.got = true; coinPop(cx, cy - 1); } });
      };
      const askBlock = async (cx, cy) => {
        paused = true; IN.release(); qTotal++;
        const okk = await A.ask(S, nextQ(), wrap, { title: E('❓') + ' 知识问号砖：答对了有宝贝' });
        if (okk) {
          const kind = S.hearts <= 1 && Math.random() < .5 ? 'heart' : P.pw === 0 ? (Math.random() < .85 ? 'mush' : 'star') : P.pw === 1 ? (Math.random() < .8 ? 'flower' : 'star') : R.pick(['star', 'heart', 'mush']);
          items.push({ kind, x: cx + .1, y: cy, by: cy, w: .8, h: .8, vx: 0, vy: 0, rise: 0, dir: P.x + P.w / 2 < cx + .5 ? 1 : -1 });
          Audio2.sfx('pop', .5);
        } else A.banner(wrap, E('💪') + ' 下一个问号砖再试试！', 1100);
        last = performance.now(); acc = 0; paused = false; drawHud();
      };
      const hitBlock = (cx, cy) => {
        const v = map[cy][cx], k = cx * 64 + cy; bumps.set(k, .18);
        if (v === BR) { if (P.pw > 0) { map[cy][cx] = 0; bumps.delete(k); for (let i = 0; i < 4; i++) fx.push({ k: 'deb', x: cx + .25 + (i % 2) * .5, y: cy + .25 + (i > 1) * .5, vx: (i % 2 ? 1 : -1) * 3.5, vy: i > 1 ? -9 : -13, t: 0, r: 0 }); Audio2.sfx('poof', .5); } else Audio2.sfx('bump', .4); bumpTop(cx, cy); }
        else if (v === MC) { coinPop(cx, cy); const n = (mcHits.get(k) || 0) + 1; mcHits.set(k, n); if (n >= 6) map[cy][cx] = US; bumpTop(cx, cy); }
        else if (v === QC) { map[cy][cx] = US; coinPop(cx, cy); bumpTop(cx, cy); }
        else if (v === QK) { map[cy][cx] = US; Audio2.sfx('question', .5); bumpTop(cx, cy); askBlock(cx, cy); }
        else { bumps.delete(k); Audio2.sfx('bump', .2); }
      };
      const end = failed => {
        if (done) return; done = true; IN.destroy();
        if (failed) { S.end(true); return resolve(); }
        const rate = qTotal ? S.right / qTotal : 1;
        S.end(false, deaths === 0 && rate >= .8 ? 3 : rate >= .5 && deaths <= 2 ? 2 : 1); resolve();
      };
      // ---- 每一步（固定 1/60 秒） ----
      const update = () => {
        if (P.grow > 0) { P.grow -= DT; return; } // 变身时全场定格
        const view = size.w / (size.h / VH);
        if (P.state === 'play') {
          P.inv = Math.max(0, P.inv - DT); if (P.star > 0) { P.star -= DT; if (P.star <= 0) drawHud(); }
          const ax = IN.ax();
          phys(P, ax, IN.take('jump'), !!IN.btn.jump, !!IN.btn.run, M);
          if (ax) P.face = ax > 0 ? 1 : -1;
          if (P.jumped) Audio2.sfx('jump', .25);
          if (P.spring) { springAt = { x: P.springX, t: .25 }; Audio2.sfx('jump', .5); }
          if (P.head >= 0) hitBlock(P.head, P.headY);
          if (P.on && M.solid(Math.floor(P.x + .04), Math.floor(P.y + P.h + .01)) && M.solid(Math.floor(P.x + P.w - .04), Math.floor(P.y + P.h + .01))) P.safe = { x: P.x, feet: P.y + P.h };
          if (P.y > HT + 1) return fall();
          if (IN.take('fire') && P.pw === 2 && balls.length < 2) { balls.push({ x: P.x + P.w / 2 + P.face * .4 - .2, y: P.y + P.h * .4, w: .4, h: .4, vx: P.face * 12, vy: 3, life: 2.5 }); Audio2.sfx('whoosh', .3); }
          // 旗杆
          if (P.x + P.w > L.FX + .5 - POLE && P.y < GY) {
            P.state = 'flag'; P.x = L.FX + .5 - POLE - P.w; P.vx = P.vy = 0;
            const bonus = 1 + Math.max(0, Math.round((GY - 1 - (P.y + P.h)) * 1.5)); addCoin(bonus);
            Audio2.sfx('levelup', .6); A.banner(wrap, E('🚩') + ' 摸到旗杆！奖励 ' + bonus + ' ' + E('🪙'), 1600); drawHud();
          }
        } else if (P.state === 'flag') {
          P.y = Math.min(GY - 1 - P.h, P.y + 9 * DT); flagY = Math.min(GY - 2, flagY + 9 * DT);
          if (P.y >= GY - 1 - P.h - .001 && flagY >= GY - 2) { endT += DT; if (endT > .35) { P.state = 'walk'; P.x = L.FX + .5 + POLE; P.face = 1; } }
        } else if (P.state === 'walk') {
          phys(P, .72, false, false, false, M); walkT += .06;
          if (P.x > L.castle + 2.1) { P.state = 'in'; Audio2.sfx('victory', .6); UI.confetti(120); Voice.say('到达终点啦！'); setTimeout(() => end(false), 1300); }
        }
        // 敌人
        const live = foes.filter(e => !e.dead);
        foes.forEach(e => {
          if (e.dead) { e.dt += DT; if (e.flip) { e.vy += G * DT; e.y += e.vy * DT; e.x += e.vx * DT; } return; }
          if (!e.act) { if (e.x < camX + view + 1.5) e.act = true; else return; }
          e.t += DT; e.grace -= DT;
          if (e.kind === 'bee') { e.x += e.dir * 1.6 * DT; if (Math.abs(e.x - e.x0) > 3) e.dir = e.x > e.x0 ? -1 : 1; e.y = e.y0 + Math.sin(e.t * 2.2) * 1.3; }
          else {
            e.vx = e.state === 'shell' ? 0 : e.state === 'kick' ? e.dir * 10 : e.dir * (e.kind === 'snail' ? 1.3 : 1.7);
            if (move(e, M)) { e.dir *= -1; if (e.state === 'kick' && Math.abs(e.x - P.x) < view) Audio2.sfx('bump', .3); }
            if (e.y > HT + 2) { e.dead = true; e.dt = 9; return; }
          }
          // 踢出去的壳撞倒别的怪
          if (e.state === 'kick') live.forEach(o => { if (o !== e && !o.dead && overlap(e, o, .05)) kill(o, e.dir * 3); });
          else if (e.kind !== 'bee') live.forEach(o => { if (o !== e && !o.dead && o.kind !== 'bee' && o.state === 'walk' && e.state === 'walk' && overlap(e, o, .05) && (e.x - o.x) * e.dir < 0) { e.dir *= -1; o.dir *= -1; } });
          if (P.state !== 'play' || P.grow > 0 || !overlap(P, e, .08)) return;
          if (P.star > 0) return kill(e, P.face * 3);
          const stomp = P.vy > 0 && P.y + P.h - e.y < .6;
          if (e.state === 'shell') { e.state = 'kick'; e.dir = P.x + P.w / 2 < e.x + e.w / 2 ? 1 : -1; e.grace = .3; Audio2.sfx('hit', .45); if (stomp) P.vy = -10; return; }
          if (stomp) {
            P.vy = IN.btn.jump ? -15 : -10; P.on = false; Audio2.sfx('hit', .5);
            if (e.kind === 'snail') { if (e.state === 'walk') { const [sw, sh] = FOE_BOX('snail_shell'); e.state = 'shell'; e.y += e.h - sh; e.x += (e.w - sw) / 2; e.w = sw; e.h = sh; } else { e.state = 'shell'; } e.grace = .2; addCoin(1); drawHud(); }
            else if (e.kind === 'bee') kill(e, 0);
            else { e.dead = true; e.flat = true; e.dt = 0; addCoin(1); drawHud(); }
            return;
          }
          if (!(e.state === 'kick' && e.grace > 0)) hurt();
        });
        // 食人花：人站在水管旁边或上面时不出来
        L.pipes.forEach(p => {
          if (!p.plant || p.dead) return;
          const near = Math.abs(P.x + P.w / 2 - (p.x + 1)) < 2.3;
          const ph0 = p.t % 4.2; if (!(ph0 < 1.6 && near)) p.t += DT;
          const ph = p.t % 4.2; p.py = ph < 1.6 ? 0 : ph < 2.2 ? (ph - 1.6) / .6 : ph < 3.6 ? 1 : 1 - (ph - 3.6) / .6;
          if (p.py > .15) { const box = { x: p.x + .5 + .06, y: p.top - PIR_H * p.py, w: .88, h: PIR_H * p.py }; p.box = box; if (P.state === 'play' && overlap(P, box, .1)) { if (P.star > 0) { p.dead = true; Audio2.sfx('hit', .5); addCoin(1); drawHud(); } else hurt(); } } else p.box = null;
        });
        // 火球
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i]; b.life -= DT; const wall = move(b, M); if (b.on) b.vy = -8;
          let gone = wall || b.life <= 0 || b.y > HT;
          if (!gone) for (const e of foes) if (!e.dead && overlap(b, e, 0)) { kill(e, Math.sign(b.vx) * 3); gone = true; break; }
          if (!gone) for (const p of L.pipes) if (p.box && !p.dead && overlap(b, p.box, 0)) { p.dead = true; Audio2.sfx('hit', .5); addCoin(1); drawHud(); gone = true; break; }
          if (gone) { fx.push({ k: 'puff', x: b.x + .2, y: b.y + .2, t: 0 }); balls.splice(i, 1); }
        }
        // 道具
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (it.rise < 1) { it.rise = Math.min(1, it.rise + DT / .65); it.y = it.by - it.h * it.rise; if (it.rise >= 1) it.vx = it.kind === 'flower' ? 0 : (it.kind === 'star' ? 4 : 3) * it.dir; continue; }
          if (it.kind !== 'flower') { if (move(it, M)) it.vx = -it.vx; if (it.kind === 'star' && it.on) it.vy = -11; }
          if (it.y > HT + 1) { items.splice(i, 1); continue; }
          if (P.state === 'play' && overlap(P, it, .05)) { items.splice(i, 1); power(it.kind); }
        }
        // 金币
        if (P.state === 'play') L.coins.forEach(c => { if (!c.got && coinHit(P, c)) { c.got = true; addCoin(1); Audio2.sfx('coin', .2); drawHud(); } });
        // 特效
        for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += DT; if (f.k === 'coin' || f.k === 'deb') { f.vy += G * DT; f.y += f.vy * DT; if (f.vx) f.x += f.vx * DT; } if ((f.k === 'coin' && f.t > .5) || (f.k === 'deb' && f.y > HT + 1) || (f.k === 'puff' && f.t > .3)) fx.splice(i, 1); }
        bumps.forEach((t, k) => { t -= DT; if (t <= 0) bumps.delete(k); else bumps.set(k, t); });
        springAt.t -= DT;
        if (Math.floor(P.x) !== Math.floor(P.x - P.vx * DT)) drawHud();
      };
      // ---- 绘制 ----
      let size = fit(); const onR = () => { if (cv.isConnected) size = fit(); }; addEventListener('resize', onR); Core.onLeave(() => removeEventListener('resize', onR));
      const HILLS = [0, 1].map(li => { const a = []; for (let hx = R.int(0, 8); hx < W * (li ? .6 : .3) + 40; hx += R.int(10, 22)) a.push({ x: hx, w: R.int(4, 7) * (li ? 1 : 1.4), h: (li ? 1.6 : 2.6) + Math.random() * 1.6 }); return a; });
      const clouds = [IMG('bg/el_cloud2'), IMG('bg/el_cloud5'), IMG('bg/el_cloud3')];
      const draw = now => {
        // 镜头：一屏显示 VH 行（比整张地图矮一些，人物和砖块都更大），上下跟着人走
        const { w: cw, h: ch } = size, s = ch / VH, view = cw / s; SC = s;
        const tx = P.x - view * .4; camX += (tx - camX) * .12; camX = Math.max(0, Math.min(W - view, camX));
        const ty = Math.max(0, Math.min(GY + 2 - VH, P.y + P.h / 2 - VH * .58)); camY += (ty - camY) * .1; // 地面只露两行土
        const X = v => (v - camX) * s;
        const gr = ctx.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, '#4f8df7'); gr.addColorStop(.6, '#8cc4ff'); gr.addColorStop(1, '#cfeaff'); ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
        clouds.forEach((c, i) => { if (ok(c)) { const cx = ((i * 520 + now / 70 - camX * s * .12) % (cw + 320)) - 160; ctx.drawImage(c, cx, 30 + i * 52 - camY * s * .3, 170, 100); } });
        ctx.save(); ctx.translate(0, -camY * s);
        // 远山 + 近处的小山丘（视差滚动）
        [[.25, '#9fd8a8', '#86c993', 1.25], [.55, '#5fca6a', '#3fa84e', 1]].forEach(([par, col, spot, k], li) => HILLS[li].forEach(hl => {
          const hx = (hl.x - camX * par) * s, hw = hl.w * s * k, hh = hl.h * s * k; if (hx + hw < -10 || hx - hw > cw + 10) return;
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(hx - hw, GY * s); ctx.bezierCurveTo(hx - hw * .6, GY * s - hh * 1.35, hx + hw * .6, GY * s - hh * 1.35, hx + hw, GY * s); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(0,60,20,.25)'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = spot; [[-.3, .45], [.1, .7], [.35, .4]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.ellipse(hx + dx * hw, GY * s - hh * dy, s * .14 * k, s * .3 * k, 0, 0, 7); ctx.fill(); });
        }));
        const x0 = Math.max(0, Math.floor(camX) - 1), x1 = Math.min(W, Math.ceil(camX + view) + 2);
        // 城堡
        if (L.castle + 5 > x0 && L.castle < x1) ctx.drawImage(castleSpr(), X(L.castle), (GY - 6) * s, 5 * s, 6 * s);
        // 装饰
        L.deco.forEach(d => { if (d[0] >= x0 && d[0] <= x1 && map[GY][d[0]] && !map[GY - 1][d[0]]) { const im = T(d[1]); if (ok(im)) ctx.drawImage(im, X(d[0]), (GY - 1) * s, s, s); } });
        // 水坑
        for (let cx = x0; cx < x1; cx++) if (!map[HT - 1][cx]) { const wg = ctx.createLinearGradient(0, (HT - 1.4) * s, 0, HT * s); wg.addColorStop(0, '#5ec8ff'); wg.addColorStop(1, '#1f6fc2'); ctx.fillStyle = wg; ctx.fillRect(X(cx) - .5, (HT - 1.4 + Math.sin(now / 400 + cx) * .05) * s, s + 1, ch); }
        // 道具（冒出来时在砖块后面）
        const drawItem = it => {
          const im = it.kind === 'mush' ? mushroom() : it.kind === 'flower' ? flower() : it.kind === 'star' ? T('star') : T('heart');
          if (it.kind !== 'mush' && it.kind !== 'flower' && !ok(im)) return;
          ctx.save(); if (it.kind === 'star') { ctx.shadowColor = 'hsl(' + (now / 3 % 360) + ',100%,60%)'; ctx.shadowBlur = 18; }
          fitDraw(ctx, im, X(it.x), it.y * s, it.w * s, it.h * s); ctx.restore();
        };
        items.forEach(it => { if (it.rise < 1) drawItem(it); });
        // 食人花（在水管后面）
        L.pipes.forEach(p => { if (!p.plant || p.dead || p.py <= 0 || p.x + 2 < x0 || p.x > x1) return; const im = piranha(Math.floor(now / 220) % 2); fitDraw(ctx, im, X(p.x + .5), (p.top - PIR_H * p.py) * s, s, PIR_H * s); });
        // 水管
        L.pipes.forEach(p => {
          if (p.x + 2 < x0 || p.x > x1) return;
          const px = X(p.x), top = p.top * s, bot = GY * s, lw = Math.max(1.5, s * .05);
          ctx.fillStyle = pipeGrad(ctx, px + s * .05, s * 1.9, false); ctx.fillRect(px + s * .05, top + s * .5, s * 1.9, bot - top - s * .5);
          ctx.strokeStyle = '#0a3d12'; ctx.lineWidth = lw; ctx.strokeRect(px + s * .05, top + s * .5, s * 1.9, bot - top - s * .5);
          ctx.fillStyle = pipeGrad(ctx, px, s * 2, true); rr(ctx, px, top, s * 2, s * .56, s * .08); ctx.fill(); ctx.stroke();
        });
        // 砖块
        const qf = [0, 1, 2, 1][Math.floor(now / 260) % 4];
        for (let y = 0; y < HT; y++) for (let cx = x0; cx < x1; cx++) {
          const v = map[y][cx]; if (!v || v === PP) continue;
          const bt = bumps.get(cx * 64 + y), oy = bt ? -Math.sin((1 - bt / .18) * Math.PI) * .32 : 0, dx = X(cx), dy = (y + oy) * s;
          if (v === QK) {
            ctx.save(); ctx.shadowColor = 'rgba(255,240,120,' + (.55 + Math.sin(now / 220) * .35) + ')'; ctx.shadowBlur = s * .45; ctx.drawImage(qBlock(qf), dx, dy, s + .5, s + .5); ctx.restore(); continue;
          }
          if (v === SP) { const out = springAt.t > 0 && springAt.x === cx, im = T(out ? 'spring_out' : 'spring'); if (ok(im)) fitDraw(ctx, im, dx, dy - (out ? .45 * s : 0), s, s * (out ? 1.45 : 1)); continue; } // 弹簧顶面＝碰撞面
          let k;
          if (v === GD) { const top = y === 0 || map[y - 1][cx] !== GD, le = cx > 0 && !map[y][cx - 1], re = cx < W - 1 && !map[y][cx + 1]; k = 'terrain_grass_block_' + (top ? 'top' : '') + (le ? (top ? '_left' : 'left') : re ? (top ? '_right' : 'right') : top ? '' : 'center'); }
          else k = v === BR || v === MC ? 'bricks_brown' : v === QC ? 'block_coin' : v === US ? 'block_empty' : 'block_strong_empty';
          const im = T(k); if (ok(im)) ctx.drawImage(im, dx, dy, s + .5, s + .5);
        }
        // 金币
        L.coins.forEach(c => { if (c.got || c.x < x0 - 1 || c.x > x1) return; drawCoin(c.x, c.y, Math.floor(now / 160 + c.x * 2) % 5 === 0); });
        items.forEach(it => { if (it.rise >= 1) drawItem(it); });
        // 旗杆 + 旗子
        { const pxl = X(L.FX + .5); ctx.fillStyle = '#e8f5e9'; ctx.fillRect(pxl - s * .06, 1.6 * s, s * .12, (GY - 2.6) * s); ctx.fillStyle = '#2fa83a'; ctx.fillRect(pxl - s * .03, 1.6 * s, s * .06, (GY - 2.6) * s);
          ctx.beginPath(); ctx.arc(pxl, 1.5 * s, s * .24, 0, 7); ctx.fillStyle = '#2fa83a'; ctx.fill(); ctx.strokeStyle = '#0a3d12'; ctx.lineWidth = 2; ctx.stroke();
          ctx.drawImage(flagSpr(), pxl - s * 1.5, flagY * s, s * 1.5, s); }
        // 敌人
        foes.forEach(e => {
          if (e.x < x0 - 1 || e.x > x1 || (e.dead && (e.flat ? e.dt > .5 : e.dt > 2))) return;
          let k = e.sk + '_' + (e.kind === 'bee' ? (Math.floor(e.t * 10) % 2 ? 'a' : 'b') : 'walk_' + (Math.floor(e.t * 6) % 2 ? 'a' : 'b'));
          if (e.state !== 'walk' && e.kind === 'snail') k = 'snail_shell';
          if (e.flat) k = e.sk === 'slime_normal' ? 'slime_normal_flat' : e.sk + '_rest';
          const im = IMG('enemy/' + k); if (!ok(im)) return;
          // 贴图按固定比例画：参考帧里看得见的身体中心对准碰撞盒中心、脚底对准碰撞盒底边
          const ref = BOUNDS[e.state !== 'walk' && e.kind === 'snail' ? 'snail_shell' : FOE_REF[e.sk]], S = FOE_SCALE * s, cy = e.kind === 'bee' || e.state === 'kick';
          ctx.save(); ctx.translate(X(e.x + e.w / 2), (cy ? e.y + e.h / 2 : e.y + e.h) * s);
          if (e.dir > 0 && e.state === 'walk') ctx.scale(-1, 1);
          if (e.state === 'kick') ctx.rotate(e.t * 14 * e.dir);
          if (e.flip) { ctx.translate(0, -e.h * s / 2); ctx.scale(1, -1); ctx.translate(0, e.h * s / 2); }
          if (e.flat && e.sk !== 'slime_normal') ctx.scale(1, .45);
          ctx.drawImage(im, -(ref[0] + ref[2] / 2) * S, -(cy ? ref[1] + ref[3] / 2 : ref[1] + ref[3]) * S, S, S); ctx.restore();
        });
        // 火球
        balls.forEach(b => { const im = T('fireball'); if (ok(im)) { ctx.save(); ctx.translate(X(b.x + b.w / 2), (b.y + b.h / 2) * s); ctx.rotate(now / 60); fitDraw(ctx, im, -b.w / 2 * s, -b.h / 2 * s, b.w * s, b.h * s); ctx.restore(); } });
        // 玩家
        walkT += Math.abs(P.vx) * .016;
        if (P.state !== 'in') {
          const im = !P.on && P.state !== 'flag' ? fr.jump : Math.abs(P.vx) > .5 || P.state === 'walk' ? fr.walk[Math.floor(walkT * 1.4) % 2] : fr.idle;
          if (ok(im) && !(P.inv > 0 && P.grow <= 0 && Math.floor(now / 90) % 2)) {
            const big = P.grow > 0 ? Math.floor(now / 80) % 2 === 0 : P.pw > 0;
            ctx.save(); ctx.translate(X(P.x + P.w / 2), (P.y + P.h) * s); if (P.face < 0) ctx.scale(-1, 1);
            if (P.star > 0) { ctx.shadowColor = 'hsl(' + (now / 3 % 360) + ',100%,60%)'; ctx.shadowBlur = 26; }
            else if (P.pw === 2) { ctx.shadowColor = 'rgba(255,120,30,.9)'; ctx.shadowBlur = 16; }
            // 立绘按「看得见的身体」对齐碰撞盒：idle 帧的身体高度＝碰撞盒高度，每一帧的脚底都踩在碰撞盒底边上（不悬空、不陷地）
            const hb = P.grow > 0 ? (big ? BIG : SMALL) : P, ref = bbox(fr.idle), fb = bbox(im);
            let S = hb.h * s / ref[3]; if (fr.sprite && ref[2] * S > hb.w * 1.45 * s) S = hb.w * 1.45 * s / ref[2]; if (!fr.sprite) S = hb.h * s * .92;
            ctx.drawImage(im, -(ref[0] + ref[2] / 2) * S, -(fb[1] + fb[3]) * S, S, S); ctx.restore();
          }
        }
        // 调试：window.__PF_BOXES = 1 时画出所有碰撞盒，用来核对画面和碰撞是否一致
        if (window.__PF_BOXES) {
          ctx.lineWidth = 2; const box = (o, col) => { ctx.strokeStyle = col; ctx.strokeRect(X(o.x), o.y * s, o.w * s, o.h * s); };
          box(P, '#ff00ff'); foes.forEach(e => !e.dead && box(e, '#ff2020')); items.forEach(it => box(it, '#00c0ff')); balls.forEach(b => box(b, '#ffa000'));
          L.pipes.forEach(p => p.box && box(p.box, '#ff2020')); L.coins.forEach(c => !c.got && box({ x: c.x - .3, y: c.y - .3, w: .6, h: .6 }, '#ffe000'));
        }
        // 特效
        fx.forEach(f => {
          if (f.k === 'coin') drawCoin(f.x, f.y, Math.floor(f.t * 20) % 2);
          else if (f.k === 'deb') { const im = T('brick_brown'); if (ok(im)) { ctx.save(); ctx.translate(X(f.x), f.y * s); ctx.rotate(f.t * 12); ctx.drawImage(im, -s * .25, -s * .25, s * .5, s * .5); ctx.restore(); } }
          else { ctx.fillStyle = 'rgba(255,200,120,' + (1 - f.t / .3) + ')'; ctx.beginPath(); ctx.arc(X(f.x), f.y * s, s * (.2 + f.t), 0, 7); ctx.fill(); }
        });
        ctx.restore();
      };
      const loop = now => {
        if (!A.live(S, cv) || done) { IN.destroy(); return; }
        const el = Math.min(.1, (now - last) / 1000); last = now;
        if (!paused) { acc += el; while (acc >= DT) { acc -= DT; update(); if (paused || done) { acc = 0; break; } } }
        draw(now); requestAnimationFrame(loop);
      };
      S.pf = { P, L, items, foes, power, IN }; // 测试用
      drawHud(); requestAnimationFrame(loop);
      Voice.say('跑到终点插旗子！顶一顶问号砖，答对题有奖励');
      // 测试用：自动奔跑
      S.auto = () => {
        S.god = true; if (P.state !== 'play') return;
        const nowT = performance.now(); if (!S._px || P.x > S._px + .5) { S._px = P.x; S._pt = nowT; } else if (nowT - S._pt > 1800) { P.x += 2; P.y -= 3; P.vy = 0; S._pt = nowT; }
        const cx = Math.floor(P.x + P.w + .3), fy = Math.floor(P.y + P.h + .2);
        const gapAhead = !M.solid(cx + 1, fy) || !M.solid(cx, fy), wall = M.solid(cx, Math.floor(P.y + P.h - .3)) || M.solid(cx + 1, Math.floor(P.y + P.h - .3)), enemy = foes.some(e => !e.dead && e.x - P.x > 0 && e.x - P.x < 2.4);
        IN.sx = 1;
        if (P.on && (gapAhead || wall || enemy || Math.random() < .15)) { IN.edge.jump = true; IN.btn.jump = true; } else if (!P.on && P.vy > 0) IN.btn.jump = false;
        if (P.pw === 2 && Math.random() < .1) IN.edge.fire = true;
      };
    });
  }

  Engines.ENGINES.platform = platform;
  window.Platformer = { gen, analyze, build, phys, SMALL, BIG, MIN_WAYS, DT, mapper };
})();
