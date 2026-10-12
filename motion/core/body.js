/* 动作状态与手势识别（每个人每帧更新 person.body）
   所有距离都用「躯干长度 T」（肩中点到髋中点）做单位，远近、大人小孩都一样灵敏；x 先乘画面宽高比，横竖同一把尺
   连续量：hands.L/R（raw 画面坐标、reach 以身体为中心的够得着范围 0-1、vel 速度）、x / lane（左右站位）、crouch / air、cadence（原地跑步频）
   离散事件（M.Body.on）：jump、squat、land、swipe(dir 0-7)、punch、clap、step、handsUp、pinch / release（手指模型开启时） */
(function () {
  const M = window.Motion, U = M.U;
  const B = M.Body = M.emitter({});
  const DIRS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  B.DIRS = DIRS;
  // 8 方向：0 右 1 右下 2 下 3 左下 4 左 5 左上 6 上 7 右上（画面坐标，y 向下）
  B.dirOf = (dx, dy) => ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;

  function fresh() {
    return {
      T: 0, baseHip: null, baseSh: null, baseNose: null, cx0: null, x: .5, lane: 0, lean: 0, crouch: false, air: false, ready: false,
      hands: { L: hs(), R: hs() }, steps: [], cadence: 0, lastKnee: 0, kneeSign: 0, clapArmed: false, clapT: 0,
      upHold: 0, handsUp: false, lastT: 0, full: false, upper: false, dist: 'ok', jumpT: 0, squatT: 0, swipeCool: 0,
      angles: {}, poseT: 0,
    };
  }
  function hs() { return { raw: { x: .5, y: .5 }, reach: { x: .5, y: .5 }, vel: { x: 0, y: 0 }, speed: 0, up: false, coolSwipe: 0, coolPunch: 0, zf: 0, zfHist: [], hist: [], visible: false }; }

  B.update = function (s, t) {
    const b = s.body || (s.body = fresh());
    const L = s.lm, R = s.raw, A = (M.Input.vw && M.Input.vh) ? M.Input.vw / M.Input.vh : 16 / 9;
    const P = i => ({ x: L[i].x * A, y: L[i].y, v: L[i].v });
    const Q = i => ({ x: R[i].x * A, y: R[i].y, v: R[i].v });
    const dt = b.lastT ? Math.min(.1, (t - b.lastT) / 1000) : 1 / 30; b.lastT = t;
    const lsh = P(11), rsh = P(12), lhp = P(23), rhp = P(24), nose = P(0);
    const sh = U.mid(lsh, rsh), hip = U.mid(lhp, rhp);
    const tl = Math.max(.02, U.dist(sh, hip));
    // 躯干长度：站着不动时慢慢更新，跳跃 / 下蹲时冻结
    if (!b.T) b.T = tl; else if (!b.air && !b.crouch) b.T += (tl - b.T) * .04;
    const T = b.T, sens = M.cfg.sens;
    b.upper = lsh.v > .5 && rsh.v > .5; b.full = b.upper && P(27).v > .45 && P(28).v > .45;
    // 远近：躯干占画面高度的比例
    const frac = T; b.dist = frac > .42 ? 'near' : frac < .12 ? 'far' : 'ok';
    b.sh = sh; b.hip = hip; b.A = A;

    /* ---- 站姿基线 ---- */
    if (b.baseHip == null) { b.baseHip = hip.y; b.baseSh = sh.y; b.baseNose = nose.y; }
    if (!b.air && !b.crouch) { const k = .03; b.baseHip += (hip.y - b.baseHip) * k; b.baseSh += (sh.y - b.baseSh) * k; b.baseNose += (nose.y - b.baseNose) * k; }
    if (b.cx0 == null) b.cx0 = A / 2;

    /* ---- 跳跃：髋部和肩膀一起明显升高 ---- */
    const rise = (b.baseHip - hip.y) / T, riseSh = (b.baseSh - sh.y) / T;
    const jumpTh = .2 / sens.jump;
    if (!b.air && !b.crouch && rise > jumpTh && riseSh > jumpTh * .7 && t - b.jumpT > 350) { b.air = true; b.jumpT = t; fire('jump', s, { power: rise }); }
    else if (b.air && rise < jumpTh * .35) { b.air = false; fire('land', s); }
    if (b.air && t - b.jumpT > 1500) b.air = false; // 兜底

    /* ---- 下蹲：头和肩明显下降（腿不在画面里也能识别），膝盖弯曲加分 ---- */
    const drop = (sh.y - b.baseSh) / T, dropN = (nose.y - b.baseNose) / T;
    let knee = 180; if (P(25).v > .5 && P(27).v > .5) knee = Math.min(U.joint(P(23), P(25), P(27)), P(26).v > .5 && P(28).v > .5 ? U.joint(P(24), P(26), P(28)) : 180);
    const sqTh = .38 / sens.squat;
    const down = (drop > sqTh && dropN > sqTh * .8) || (knee < 115 && drop > sqTh * .5);
    if (!b.crouch && !b.air && down) { b.crouch = true; b.squatT = t; fire('squat', s); }
    else if (b.crouch && drop < sqTh * .4 && knee > 140) { b.crouch = false; fire('stand', s); }
    b.knee = knee; b.drop = drop; b.rise = rise;

    /* ---- 左右站位 / 侧身 ---- */
    b.x = hip.x / A; // 0-1 画面坐标
    const off = (hip.x - b.cx0) / T;
    b.offset = off;
    const th = .55;
    if (b.lane === 0) { if (off < -th) b.lane = -1; else if (off > th) b.lane = 1; }
    else if (b.lane === -1 && off > -th * .55) b.lane = off > th ? 1 : 0;
    else if (b.lane === 1 && off < th * .55) b.lane = off < -th ? -1 : 0;
    b.lean = U.clamp((sh.x - hip.x) / T / .35, -1, 1);

    /* ---- 双手 ---- */
    ['L', 'R'].forEach(sd => {
      const h = b.hands[sd], wi = sd === 'L' ? 15 : 16, ii = sd === 'L' ? 19 : 20, ei = sd === 'L' ? 13 : 14, si = sd === 'L' ? 11 : 12;
      const w = Q(wi), ix = Q(ii), sp = P(wi);
      h.visible = R[wi].v > .4;
      // 手掌中心：手腕和食指根之间（比手腕更像「手」）
      const hx = ix.v > .3 ? (w.x * .55 + ix.x * .45) : w.x, hy = ix.v > .3 ? (w.y * .55 + ix.y * .45) : w.y;
      const px = h.rawA ? h.rawA.x : hx, py = h.rawA ? h.rawA.y : hy;
      h.rawA = { x: hx, y: hy };
      const vx = (hx - px) / dt / T, vy = (hy - py) / dt / T;
      h.vel.x += (vx - h.vel.x) * .55; h.vel.y += (vy - h.vel.y) * .55; h.speed = Math.hypot(h.vel.x, h.vel.y);
      h.raw = { x: hx / A, y: hy };
      // 够得着范围：以肩膀为中心，左右各 1.5T、上 1.25T、下 1.05T 映射到 0-1
      h.reach = { x: U.clamp(.5 + (hx - sh.x) / (3 * T), -.05, 1.05), y: U.clamp((hy - (sh.y - 1.25 * T)) / (2.3 * T), -.05, 1.05) };
      h.smooth = { x: sp.x / A, y: sp.y };
      h.up = R[wi].v > .4 && w.y < nose.y;
      h.hist.push({ t, x: hx, y: hy }); while (h.hist.length && t - h.hist[0].t > 160) h.hist.shift();
      // 挥动（8 方向）：速度越过阈值的瞬间，用最近 160ms 的位移定方向
      const swTh = 3.4 / sens.swipe;
      if (h.visible && h.speed > swTh && t > h.coolSwipe && h.hist.length > 2) {
        const a = h.hist[0], dx = hx - a.x, dy = hy - a.y;
        if (Math.hypot(dx, dy) / T > .35) { h.coolSwipe = t + 300; fire('swipe', s, { hand: sd, dir: B.dirOf(dx, dy), dx, dy, speed: h.speed, x: h.raw.x, y: h.raw.y, rx: h.reach.x, ry: h.reach.y }); }
      }
      // 出拳：世界坐标里手腕比肩膀明显靠前（z 越小越靠近镜头），且向前冲得快；或者画面里快速伸直到胸前
      let zf = 0; if (s.world) { zf = s.world[si].z - s.world[wi].z; }
      h.zfHist.push({ t, v: zf }); while (h.zfHist.length && t - h.zfHist[0].t > 220) h.zfHist.shift();
      const zfRise = zf - (h.zfHist[0] ? h.zfHist[0].v : zf);
      const elbow = U.joint(P(si), P(ei), P(wi));
      const chest = hy > sh.y - .45 * T && hy < hip.y + .1 * T;
      const pTh = 1 / sens.punch;
      if (h.visible && t > h.coolPunch && ((zf > .28 * pTh && zfRise > .16 * pTh) || (h.speed > 4.2 * pTh && chest && elbow > 135))) { h.coolPunch = t + 380; fire('punch', s, { hand: sd, x: h.raw.x, y: h.raw.y }); }
      h.zf = zf; h.elbow = elbow;
    });
    const HL = b.hands.L, HR = b.hands.R;

    /* ---- 双手举高（「举起双手开始」） ---- */
    const both = HL.up && HR.up;
    b.upHold = both ? b.upHold + dt : 0;
    if (both && !b.handsUp && b.upHold > .35) { b.handsUp = true; fire('handsUp', s); } else if (!both) b.handsUp = false;

    /* ---- 拍手：双手从分开到快速合拢 ---- */
    const hd = Math.hypot(HL.rawA.x - HR.rawA.x, HL.rawA.y - HR.rawA.y) / T;
    if (hd > .9) { b.clapArmed = true; b.clapT = t; }
    if (b.clapArmed && hd < .32 && t - b.clapT < 600 && HL.visible && HR.visible) { b.clapArmed = false; fire('clap', s, { x: (HL.raw.x + HR.raw.x) / 2, y: (HL.raw.y + HR.raw.y) / 2 }); }
    b.handGap = hd;

    /* ---- 原地跑 / 高抬腿：两膝高低交替 ---- */
    if (P(25).v > .45 && P(26).v > .45) {
      const dk = (P(25).y - P(26).y) / T, sg = dk > .12 ? 1 : dk < -.12 ? -1 : 0;
      if (sg && sg !== b.kneeSign) { if (b.kneeSign) { b.steps.push(t); fire('step', s, { side: sg }); } b.kneeSign = sg; }
    } else {
      // 腿不在画面里：用肩膀上下弹动估计
      const bob = (b.baseSh - sh.y) / T, sg = bob > .05 ? 1 : bob < -.03 ? -1 : 0;
      if (sg && sg !== b.kneeSign) { if (sg === 1) { b.steps.push(t); fire('step', s, { side: 0 }); } b.kneeSign = sg; }
    }
    while (b.steps.length && t - b.steps[0] > 2000) b.steps.shift();
    const cad = b.steps.length / 2; b.cadence += (cad - b.cadence) * .1;

    /* ---- 静态姿势 ---- */
    const near = (a, c, r) => Math.hypot(a.x - c.x, a.y - c.y) / T < r;
    b.pose = {
      tpose: HL.visible && HR.visible && Math.abs(HL.rawA.y - lsh.y) / T < .3 && Math.abs(HR.rawA.y - rsh.y) / T < .3 && Math.abs(HL.rawA.x - HR.rawA.x) / T > 2.2,
      head: near(HL.rawA, nose, .75) && near(HR.rawA, nose, .75) && HL.rawA.y < sh.y && HR.rawA.y < sh.y,
      hips: near(HL.rawA, lhp, .45) && near(HR.rawA, rhp, .45),
      upL: HL.up && !HR.up, upR: HR.up && !HL.up, upBoth: both,
      oneLeg: P(27).v > .45 && P(28).v > .45 && Math.abs(P(27).y - P(28).y) / T > .3,
      // 双手真正交叉（左手跑到右手右边），胸前合掌不算
      armsX: HL.visible && HR.visible && (HL.rawA.x - HR.rawA.x) / T > .15 && HL.rawA.y < hip.y && HR.rawA.y < hip.y && HL.rawA.y > nose.y - .2 * T,
    };
    b.angles = angles(P);
    b.ready = true;
  };

  /* ---------- 姿势匹配（墙洞、模仿）：8 段肢体的方向角 ---------- */
  const SEG = { lUA: [11, 13], lFA: [13, 15], rUA: [12, 14], rFA: [14, 16], lTh: [23, 25], lSh: [25, 27], rTh: [24, 26], rSh: [26, 28] };
  B.SEG = SEG;
  function angles(P) { const o = {}; for (const k in SEG) { const a = P(SEG[k][0]), c = P(SEG[k][1]); o[k] = (a.v > .35 && c.v > .35) ? Math.atan2(c.y - a.y, c.x - a.x) * 180 / Math.PI : null; } return o; }
  // target：{ lUA: 角度, ... }（画面坐标：0 = 向右，90 = 向下，-90 = 向上）。返回 0-1 和每段的得分
  B.match = function (s, target) {
    if (!s || !s.body) return { score: 0, parts: {} };
    const a = s.body.angles; let sum = 0, n = 0; const parts = {};
    for (const k in target) {
      if (target[k] == null) continue;
      const v = a[k];
      if (v == null) { parts[k] = .4; sum += .4; n++; continue; } // 看不到的肢体（如腿出画）给个中间分
      let d = Math.abs(v - target[k]) % 360; if (d > 180) d = 360 - d;
      const sc = d < 18 ? 1 : d > 75 ? 0 : 1 - (d - 18) / 57; parts[k] = sc; sum += sc; n++;
    }
    return { score: n ? sum / n : 0, parts };
  };

  /* ---------- 手指（HandLandmarker）：捏合 / 握拳 / 伸食指 ---------- */
  const hstate = new Map();
  B.hand = function (hd, t) {
    const p = hd.pts, palm = Math.hypot(p[0].x - p[9].x, p[0].y - p[9].y) || .05;
    const ext = (tip, pip) => Math.hypot(p[tip].x - p[0].x, p[tip].y - p[0].y) > Math.hypot(p[pip].x - p[0].x, p[pip].y - p[0].y) * 1.12;
    const pinchD = Math.hypot(p[4].x - p[8].x, p[4].y - p[8].y) / palm;
    const fingers = [ext(8, 6), ext(12, 10), ext(16, 14), ext(20, 18)];
    hd.index = { x: p[8].x, y: p[8].y };
    hd.open = fingers.every(Boolean);
    hd.fist = !fingers.some(Boolean);
    hd.point = fingers[0] && !fingers[1] && !fingers[2] && !fingers[3];
    hd.pinchD = pinchD;
    const key = (hd.owner ? hd.owner.slot : 'x') + hd.side;
    const st = hstate.get(key) || { pinch: false, t: 0 };
    if (!st.pinch && pinchD < .32) { st.pinch = true; fire('pinch', hd.owner, { hand: hd.side, x: hd.index.x, y: hd.index.y }); }
    else if (st.pinch && pinchD > .5) { st.pinch = false; fire('release', hd.owner, { hand: hd.side }); }
    st.t = t; hstate.set(key, st); hd.pinch = st.pinch;
  };

  // 以当前站姿为准重新标定（设置页「站好别动」）
  B.calibrate = function (s) { if (!s || !s.body) return false; const b = s.body; b.baseHip = b.hip.y; b.baseSh = b.sh.y; b.cx0 = b.hip.x; b.T = Math.max(.02, U.dist(b.sh, b.hip)); return true; };
  B.center = function (s) { if (s && s.body && s.body.hip) s.body.cx0 = s.body.hip.x; };

  B.fire = (type, s, extra) => fire(type, s, extra);
  function fire(type, s, extra) {
    const e = Object.assign({ type, person: s, slot: s ? s.slot : 0, t: U.now() }, extra || {});
    B.emit(type, e); B.emit('any', e);
  }
})();
