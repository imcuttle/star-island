/* 人体拼字墙（原创）：果冻墙从舞台深处推过来，墙上挖着一个人形洞——墙到面前之前用身体摆出同样的形状，就能穿墙而过
   · 姿势就是「字」：英文字母 Y T I X L K V A、身体汉字 大 人 十 山 八 丫、数字符号 1 + × 7，穿过后显示单词 / 词语联想
   · 实时剪影：玩家的肢体角度画成和墙洞同一坐标的小人，每段肢体按匹配度变色；相似度环到线时闪金光
   · 答题墙：一面墙两个洞，各代表一个选项，摆出正确答案那个洞的姿势穿过去
   · 每局 10 面墙；派对模式越来越快，还混着答题墙 */
(function () {
  const M = window.Motion, U = M.U, PP = M.Puppet;
  const SPREAD = { lTh: 117, lSh: 115, rTh: 63, rSh: 65 };
  const mix = (a, b) => Object.assign({}, a, b || {});
  // 手臂姿势（镜子视角：画面左边是玩家的左手；0° 向右、90° 向下、-90° 向上）
  const ARMS = {
    Y: { lUA: -135, lFA: -135, rUA: -45, rFA: -45 },
    T: { lUA: 180, lFA: 180, rUA: 0, rFA: 0 },
    I: { lUA: -97, lFA: -93, rUA: -83, rFA: -87 },
    V: { lUA: -114, lFA: -114, rUA: -66, rFA: -66 },
    L: { lUA: -102, lFA: -100, rUA: 0, rFA: 0 },
    A: { lUA: -105, lFA: -50, rUA: -75, rFA: -130 },
    K: { lUA: 100, lFA: 95, rUA: -45, rFA: -45 },
    down: { lUA: 100, lFA: 95, rUA: 80, rFA: 85 },
    diag: { lUA: 150, lFA: 150, rUA: 30, rFA: 30 },
    low: { lUA: 140, lFA: 142, rUA: 40, rFA: 38 },
    goal: { lUA: 180, lFA: -90, rUA: 0, rFA: -90 },
    seven: { lUA: 180, lFA: 180, rUA: 80, rFA: 85 },
  };
  // 姿势库：g 字形、kind 类别、a 目标角度（腿不写 = 不考腿）、hint 怎么摆、w 联想 [词, 释义, emoji]
  const POSES = {
    Y: { g: 'Y', kind: 'letter', a: ARMS.Y, hint: '双臂向上斜举', w: ['Yellow', '黄色', '💛'] },
    T: { g: 'T', kind: 'letter', a: ARMS.T, hint: '双臂平平举起', w: ['Tiger', '老虎', '🐯'] },
    I: { g: 'I', kind: 'letter', a: ARMS.I, hint: '双手向上举直', w: ['Ice cream', '冰淇淋', '🍦'] },
    X: { g: 'X', kind: 'letter', a: mix(ARMS.Y, SPREAD), legs: 1, hint: '手脚全都张开', w: ['Fox', '狐狸', '🦊'] },
    L: { g: 'L', kind: 'letter', a: ARMS.L, hint: '左手举高 右手平伸', w: ['Lion', '狮子', '🦁'] },
    K: { g: 'K', kind: 'letter', a: mix(ARMS.K, { rTh: 45, rSh: 45 }), legs: 1, hint: '右手斜上 右脚斜伸', w: ['Kite', '风筝', '🪁'] },
    V: { g: 'V', kind: 'letter', a: ARMS.V, hint: '双臂举成 V 字', w: ['Violin', '小提琴', '🎻'] },
    A: { g: 'A', kind: 'letter', a: mix(ARMS.A, SPREAD), legs: 1, hint: '双手头顶合拢 双腿分开', w: ['Apple', '苹果', '🍎'] },
    大: { g: '大', kind: 'hanzi', a: mix(ARMS.T, SPREAD), legs: 1, hint: '双臂平举 双腿分开', w: ['大象', '大小的大', '🐘'] },
    人: { g: '人', kind: 'hanzi', a: mix(ARMS.low, SPREAD), legs: 1, hint: '双手斜放 双腿分开', w: ['大人', '人们的人', '🧑'] },
    十: { g: '十', kind: 'hanzi', a: ARMS.T, hint: '站直 双臂平举', w: ['十个', '十个手指', '🖐️'] },
    山: { g: '山', kind: 'hanzi', a: ARMS.goal, hint: '双臂平举 小臂竖起', w: ['高山', '爬山的山', '⛰️'] },
    八: { g: '八', kind: 'hanzi', a: ARMS.diag, hint: '双臂向下斜伸', w: ['八爪鱼', '八条腿', '🐙'] },
    丫: { g: '丫', kind: 'hanzi', a: ARMS.Y, hint: '双臂向上斜举', w: ['丫头', '树丫的丫', '👧'] },
    n1: { g: '1', kind: 'num', a: ARMS.I, hint: '双手举直站好', w: ['一颗星星', '数字 1', '⭐'] },
    plus: { g: '+', kind: 'sym', a: ARMS.T, hint: '双臂平举', w: ['加号', '1 + 1 = 2', '➕'] },
    times: { g: '×', kind: 'sym', a: mix(ARMS.Y, SPREAD), legs: 1, hint: '手脚全都张开', w: ['乘号', '2 × 3 = 6', '✖️'] },
    n7: { g: '7', kind: 'num', a: ARMS.seven, hint: '左手平伸 右手放下', w: ['七色彩虹', '数字 7', '🌈'] },
  };
  for (const k in POSES) POSES[k].id = k;
  const KIND = { letter: '摆出字母', hanzi: '摆出汉字', num: '摆出数字', sym: '摆出符号' };
  const SETS = { letter: ['Y', 'T', 'I', 'X', 'L', 'K', 'V', 'A'], hanzi: ['大', '人', '十', '山', '八', '丫'], party: ['Y', 'T', 'I', 'X', 'L', 'A', '大', '人', '山', '八', 'n1', 'plus', 'times', 'n7'] };
  // 答题墙的姿势对：手臂方向差得足够远，不会两个洞都像
  const PAIRS = [['I', 'T'], ['Y', '八'], ['I', '八'], ['山', '八'], ['Y', 'T'], ['L', '八']];
  const JELLY = [['#ff6fb5', '#ff9fd0'], ['#4cc9ff', '#9be4ff'], ['#4fe0a6', '#a4f5d2'], ['#ffc93c', '#ffe48a'], ['#a97bff', '#d2bbff'], ['#ff8a5b', '#ffbf9e']];
  const OPT_COL = ['#ff5d9e', '#4cc9ff'];

  // 介绍卡 / 大厅演示用的动作
  const hold = (a, fx) => [[.5, {}, {}], [.4, a, {}], [1, a, { fx }], [.4, {}, {}]];
  PP.MOVES.letterY = PP.MOVES.letterY || hold(ARMS.Y, 'up');
  PP.MOVES.letterT = PP.MOVES.letterT || hold(ARMS.T);
  PP.MOVES.hanziDa = PP.MOVES.hanziDa || hold(mix(ARMS.T, SPREAD), 'clap');
  PP.MOVES.letterX = PP.MOVES.letterX || hold(mix(ARMS.Y, SPREAD), 'clap');

  // 姿势路径（Puppet 的 100×110 盒子坐标 → 画布），lw 肢体粗细、hr 头半径（盒子单位）
  function figPath(g, a, ox, oy, s, lw, hr, colors, base) {
    const J = PP.joints(a), X = p => ox + p[0] * s, Y = p => oy + p[1] * s;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = lw * s;
    g.fillStyle = g.strokeStyle = base;
    g.beginPath(); g.moveTo(X(J.ls), Y(J.ls)); g.lineTo(X(J.rs), Y(J.rs)); g.lineTo(X(J.rh), Y(J.rh)); g.lineTo(X(J.lh), Y(J.lh)); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(X(J.nk), Y(J.nk)); g.lineTo(X(J.hd), Y(J.hd)); g.stroke();
    g.beginPath(); g.arc(X(J.hd), Y(J.hd), hr * s, 0, 7); g.fill();
    [['lUA', J.ls, J.le], ['lFA', J.le, J.lw], ['rUA', J.rs, J.re], ['rFA', J.re, J.rw], ['lTh', J.lh, J.lk], ['lSh', J.lk, J.la], ['rTh', J.rh, J.rk], ['rSh', J.rk, J.ra]].forEach(([k, p, q]) => {
      g.strokeStyle = (colors && colors[k]) || base; g.beginPath(); g.moveTo(X(p), Y(p)); g.lineTo(X(q), Y(q)); g.stroke();
    });
    return J;
  }

  M.game({
    id: 'wall', vmode: 'mirror', name: '人体拼字墙', icon: '🧱', color: '#ff6fb5', tag: '原创', demo: 'letterY', pip: false, // 画面里已有玩家实时剪影
    short: '用身体摆出墙洞的形状，穿墙而过！', desc: '果冻墙推过来啦！墙上的洞是一个字母、汉字或数字的形状，用身体摆出一样的姿势，就能穿墙而过；摆不像会被墙「BOING」一下弹飞哦。',
    how: [['letterY', '看墙上的洞'], ['letterT', '摆出一样的姿势'], ['hanziDa', '保持住，穿墙！']],
    modes: [
      { id: 'letter', name: '英文字母', icon: '🔤', desc: '用身体摆 Y T I X L…' },
      { id: 'hanzi', name: '身体汉字', icon: '🀄', desc: '大 人 十 山 八 丫' },
      { id: 'quiz', name: '答题墙', icon: '🧠', desc: '摆出正确答案的姿势' },
      { id: 'party', name: '混合派对', icon: '🎉', desc: '越来越快，还有答题墙' },
    ],
    qOpts: { maxCh: 2, maxLen: 6 },
    sayHow: '看墙上的洞，摆出一样的姿势，保持住就能穿墙',
    start(G) {
      const mode = G.mode, N = 10, ZF = 6.5, grade = G.grade || M.Q.grade();
      const TH_PASS = grade <= 2 ? .6 : grade <= 4 ? .66 : .72; // 低年级更宽松
      const TEX_H = 512, PS = 3.7, POY = TEX_H - 14 - 104 * PS; // 墙贴图里姿势的缩放和纵向位置（脚踩墙底）
      let W = 0, H = 0, S = 1, VPx = 0, VPy = 0, floorY = 0, uOne = 1, uQuiz = 1;
      const bg = document.createElement('canvas');
      const C = G.canvas({ onResize: r => { W = r.W; H = r.H; layout(); } }), x = C.ctx;

      /* ---------- 布局与背景（离屏画一次） ---------- */
      function layout() {
        S = Math.min(W, H * 1.6) / 1100; VPx = W / 2; VPy = H * .34; floorY = H * .965;
        uOne = Math.min(W * .52 / 640, H * .7 / TEX_H); uQuiz = Math.min(W * .86 / 1040, H * .7 / TEX_H);
        drawBg();
      }
      function zY(z) { return VPy + (floorY - VPy) / z; }
      function drawBg() {
        bg.width = Math.max(1, Math.round(W)); bg.height = Math.max(1, Math.round(H)); const b = bg.getContext('2d');
        // 背板：紫 → 粉
        let g = b.createLinearGradient(0, 0, 0, VPy); g.addColorStop(0, '#2a0f5c'); g.addColorStop(.6, '#7a2f9e'); g.addColorStop(1, '#ff7ec4');
        b.fillStyle = g; b.fillRect(0, 0, W, VPy + 1);
        const rg = b.createRadialGradient(VPx, VPy, 0, VPx, VPy, W * .45); rg.addColorStop(0, 'rgba(255,230,250,.75)'); rg.addColorStop(.35, 'rgba(255,140,210,.25)'); rg.addColorStop(1, 'rgba(255,140,210,0)');
        b.fillStyle = rg; b.fillRect(0, 0, W, VPy + 1);
        // 背景里的星星
        b.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 40; i++) { const sx = (i * 137.5) % W, sy = (i * 71.3) % (VPy * .8); b.beginPath(); b.arc(sx, sy, (i % 3 + 1) * S, 0, 7); b.fill(); }
        // 地板：透视棋盘（粉 / 蓝），越远越偏紫
        b.fillStyle = '#b07ae0'; b.fillRect(0, VPy, W, H - VPy);
        const tw = 640 * uOne / 4, zs = [];
        for (let z = .62; z < ZF + .6; z *= 1.22) zs.push(z);
        for (let i = 0; i < zs.length - 1; i++) {
          const z0 = zs[i], z1 = zs[i + 1], y0 = zY(z0), y1 = zY(z1), fog = Math.min(1, (z0 - .6) / ZF);
          for (let j = -14; j < 14; j++) {
            const xa0 = VPx + j * tw / z0, xb0 = VPx + (j + 1) * tw / z0, xa1 = VPx + j * tw / z1, xb1 = VPx + (j + 1) * tw / z1;
            if (Math.max(xa0, xb0) < 0 || Math.min(xa0, xb0) > W) continue;
            const odd = (i + j + 100) % 2;
            b.fillStyle = odd ? `hsl(${328 - fog * 40},95%,${80 - fog * 14}%)` : `hsl(${198 + fog * 70},95%,${78 - fog * 12}%)`;
            b.beginPath(); b.moveTo(xa0, y0); b.lineTo(xb0, y0); b.lineTo(xb1, y1); b.lineTo(xa1, y1); b.closePath(); b.fill();
          }
        }
        g = b.createLinearGradient(0, VPy, 0, VPy + H * .12); g.addColorStop(0, 'rgba(120,40,160,.75)'); g.addColorStop(1, 'rgba(120,40,160,0)'); b.fillStyle = g; b.fillRect(0, VPy, W, H * .12);
        // 墙出来的门洞
        const dw = 640 * uOne / ZF * 1.25, dh = TEX_H * uOne / ZF * 1.15, dy = zY(ZF) - dh;
        b.fillStyle = '#ffd166'; b.beginPath(); b.roundRect(VPx - dw / 2 - 10 * S, dy - 10 * S, dw + 20 * S, dh + 10 * S, [18 * S, 18 * S, 0, 0]); b.fill();
        g = b.createLinearGradient(0, dy, 0, dy + dh); g.addColorStop(0, '#12052a'); g.addColorStop(1, '#3b1466'); b.fillStyle = g;
        b.beginPath(); b.roundRect(VPx - dw / 2, dy, dw, dh, [12 * S, 12 * S, 0, 0]); b.fill();
        // 招牌
        b.save(); b.font = '900 ' + 30 * S + 'px ' + U.FONT; b.textAlign = 'center'; b.textBaseline = 'middle';
        const sy = dy - 40 * S, sw = b.measureText('拼字墙大挑战').width + 44 * S;
        b.fillStyle = '#ff3d8b'; b.strokeStyle = '#ffd166'; b.lineWidth = 4 * S; b.beginPath(); b.roundRect(VPx - sw / 2, sy - 22 * S, sw, 44 * S, 22 * S); b.fill(); b.stroke();
        b.fillStyle = '#fff'; b.shadowColor = '#ffd166'; b.shadowBlur = 12 * S; b.fillText('拼字墙大挑战', VPx, sy + 2 * S); b.restore();
        // 两侧幕布（褶皱）
        const cw = W * .085;
        [0, 1].forEach(side => {
          const x0 = side ? W - cw : 0;
          for (let i = 0; i < 6; i++) { const fx = x0 + i * cw / 6; g = b.createLinearGradient(fx, 0, fx + cw / 6, 0); g.addColorStop(0, '#8e0f4f'); g.addColorStop(.5, '#e0307a'); g.addColorStop(1, '#8e0f4f'); b.fillStyle = g; b.fillRect(fx, 0, cw / 6 + 1, H); }
          b.fillStyle = '#ffd166'; b.fillRect(side ? x0 : x0 + cw - 4 * S, 0, 4 * S, H);
        });
        // 顶部波浪帷幔
        const sc = W / 14; b.fillStyle = '#c2185b';
        b.fillRect(0, 0, W, H * .035);
        for (let i = 0; i < 15; i++) { b.beginPath(); b.arc(i * sc, H * .035, sc / 2, 0, Math.PI); b.fill(); }
        b.strokeStyle = '#ffd166'; b.lineWidth = 3 * S; for (let i = 0; i < 15; i++) { b.beginPath(); b.arc(i * sc, H * .035, sc / 2, 0, Math.PI); b.stroke(); }
        // 暗角
        const v = b.createRadialGradient(W / 2, H * .55, H * .35, W / 2, H * .55, W * .78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,0,40,.5)'); b.fillStyle = v; b.fillRect(0, 0, W, H);
      }
      layout();

      /* ---------- 墙贴图：果冻渐变 + 圆点 + 高光，挖出人形洞（带亮边和内侧阴影） ---------- */
      function makeWall(holes, col) {
        const TW = holes.length > 1 ? 1040 : 640, cv = document.createElement('canvas'); cv.width = TW; cv.height = TEX_H;
        const g = cv.getContext('2d'), r = 46;
        const gr = g.createLinearGradient(0, 0, 0, TEX_H); gr.addColorStop(0, col[1]); gr.addColorStop(.55, col[0]); gr.addColorStop(1, col[0]);
        g.fillStyle = gr; g.beginPath(); g.roundRect(6, 6, TW - 12, TEX_H - 12, r); g.fill();
        g.save(); g.clip();
        g.fillStyle = 'rgba(255,255,255,.16)'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((i * 173) % TW, (i * 97) % TEX_H, 10 + (i % 4) * 6, 0, 7); g.fill(); }
        // 果冻高光：左上一道亮带 + 底部暗边
        const hl = g.createLinearGradient(0, 0, 0, TEX_H * .35); hl.addColorStop(0, 'rgba(255,255,255,.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = hl; g.beginPath(); g.roundRect(28, 22, TW - 56, TEX_H * .3, 34); g.fill();
        g.fillStyle = 'rgba(80,0,60,.18)'; g.fillRect(0, TEX_H - 40, TW, 40);
        g.restore();
        g.lineWidth = 8; g.strokeStyle = 'rgba(90,20,90,.35)'; g.beginPath(); g.roundRect(6, 6, TW - 12, TEX_H - 12, r); g.stroke();
        holes.forEach(h => {
          const ox = h.cx - 50 * PS;
          g.save(); g.shadowColor = '#fff'; g.shadowBlur = 18; figPath(g, h.pose.a, ox, POY, PS, 18, 13.5, null, 'rgba(255,255,255,.95)'); g.restore();
          g.globalCompositeOperation = 'destination-out'; figPath(g, h.pose.a, ox, POY, PS, 12.5, 11, null, '#000');
          // 洞口内侧阴影（只画在墙上）
          g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .28; figPath(g, h.pose.a, ox + 5, POY + 8, PS, 15, 12.5, null, '#3a0050');
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        });
        if (holes.length === 1) {
          // 左上角字形徽章
          const p = holes[0].pose; g.fillStyle = '#fff'; g.beginPath(); g.arc(74, 74, 50, 0, 7); g.fill();
          g.lineWidth = 6; g.strokeStyle = col[0]; g.stroke();
          g.fillStyle = col[0]; g.font = '900 ' + (p.g.length > 1 ? 48 : 64) + 'px ' + U.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.g, 74, 79);
        }
        // 侧面（厚度）用的暗色版
        const dk = document.createElement('canvas'); dk.width = TW; dk.height = TEX_H; const d = dk.getContext('2d');
        d.drawImage(cv, 0, 0); d.globalCompositeOperation = 'source-atop'; d.fillStyle = 'rgba(60,0,70,.5)'; d.fillRect(0, 0, TW, TEX_H);
        return { cv, dk, TW, holes, col, quiz: holes.length > 1 };
      }
      // 墙在深度 z 处的屏幕矩形（z=1 时到达玩家所在平面）
      function wallRect(w, z) {
        const u = w.quiz ? uQuiz : uOne, sc = 1 / z, bw = w.TW * u * sc, bh = TEX_H * u * sc, by = zY(z);
        return { x: VPx - bw / 2, y: by - bh, w: bw, h: bh, k: u * sc };
      }
      function drawWall(w, z, alpha, wob) {
        const R = wallRect(w, z), th = R.h * .07;
        x.save(); x.globalAlpha = alpha;
        // 地面影子
        x.fillStyle = 'rgba(40,0,60,.3)'; x.beginPath(); x.ellipse(R.x + R.w / 2, R.y + R.h, R.w * .55, R.h * .05, 0, 0, 7); x.fill();
        const sx = 1 + wob, sy = 1 - wob, cx = R.x + R.w / 2, bot = R.y + R.h;
        x.translate(cx, bot); x.scale(sx, sy); x.translate(-cx, -bot);
        // 厚度：暗色层往上叠出顶面和洞口内壁
        for (let i = 4; i >= 1; i--) { const k = i / 4, sh = 1 - .035 * k; x.drawImage(w.dk, cx - R.w * sh / 2, bot - R.h * sh - th * k, R.w * sh, R.h * sh); }
        x.globalAlpha = alpha * .95; x.drawImage(w.cv, R.x, R.y, R.w, R.h);
        x.restore();
        return R;
      }

      /* ---------- 状态 ---------- */
      const pool = mode === 'hanzi' ? SETS.hanzi : mode === 'party' ? SETS.party : SETS.letter;
      let seq = [], idx = -1, wall = null, phase = 'none', pt = 0, approach = 6, zNow = ZF, passes = 0, bestCombo = 0, learned = [], q = null;
      let hist = [], live = { s: 0, parts: {} }, liveQ = [0, 0], ringV = 0, goldWas = false, chimeT = 0, lastTick = 99, shake = 0, flash = 0, flashCol = '255,255,255';
      let figX = W / 2, figS = 1, fling = null, popIn = 1, cheer = 0, judgeInfo = null;
      const disp = Object.assign({}, PP.BASE);
      const chunks = [], parts = [], texts = [];
      const song = G.song({ bpm: 112, style: 'party' }).start();
      let beatK = 0; song.onBeat(() => { beatK = 1; });
      const nextPose = () => { if (!seq.length) seq = U.shuffle(pool); return POSES[seq.shift()]; };

      // 固定提示语（字面量，便于生成录音）
      const SAY_P = {
        Y: () => G.say('摆出字母 Y'), T: () => G.say('摆出字母 T'), I: () => G.say('摆出字母 I'), X: () => G.say('摆出字母 X'),
        L: () => G.say('摆出字母 L'), K: () => G.say('摆出字母 K'), V: () => G.say('摆出字母 V'), A: () => G.say('摆出字母 A'),
        大: () => G.say('摆出汉字 大'), 人: () => G.say('摆出汉字 人'), 十: () => G.say('摆出汉字 十'), 山: () => G.say('摆出汉字 山'), 八: () => G.say('摆出汉字 八'), 丫: () => G.say('摆出汉字 丫'),
        n1: () => G.say('摆出数字 1'), plus: () => G.say('摆出加号'), times: () => G.say('摆出乘号'), n7: () => G.say('摆出数字 7'),
      };
      const SAY_W = {
        Y: () => G.say('Y，Yellow，黄色'), T: () => G.say('T，Tiger，老虎'), I: () => G.say('I，Ice cream，冰淇淋'), X: () => G.say('X，Fox，狐狸'),
        L: () => G.say('L，Lion，狮子'), K: () => G.say('K，Kite，风筝'), V: () => G.say('V，Violin，小提琴'), A: () => G.say('A，Apple，苹果'),
        大: () => G.say('大，大象的大'), 人: () => G.say('人，大人的人'), 十: () => G.say('十，十个手指的十'), 山: () => G.say('山，高山的山'), 八: () => G.say('八，八爪鱼的八'), 丫: () => G.say('丫，丫头的丫'),
        n1: () => G.say('1，一颗星星'), plus: () => G.say('加号，一加一等于二'), times: () => G.say('乘号，二乘三等于六'), n7: () => G.say('7，七色彩虹'),
      };

      // 姿势相似度：每段肢体按「离自然站立有多远」加权（站着不动不会蹭过关），腿的容差更严
      const LEG = { lTh: 1, lSh: 1, rTh: 1, rSh: 1 };
      const angD = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
      const lin = (d, f, z) => d < f ? 1 : d > z ? 0 : 1 - (d - f) / (z - f);
      function scorePose(p, pose) {
        const an = p && p.body && p.body.angles; if (!an) return { s: 0, parts: {} };
        const parts = {}; let sum = 0, ws = 0;
        for (const k in PP.BASE) {
          const t = pose.a[k]; if (t == null) continue;
          const leg = LEG[k], wt = (/UA|Th/.test(k) ? 1.2 : 1) * (.3 + Math.min(1, angD(t, PP.BASE[k]) / 45));
          const sc = an[k] == null ? (leg ? .5 : .3) : leg ? lin(angD(an[k], t), 10, 42) : lin(angD(an[k], t), 18, 64);
          parts[k] = sc; sum += sc * wt; ws += wt;
        }
        return { s: ws ? sum / ws : 0, parts };
      }

      function nextWall() {
        idx++; if (idx >= N) return finish();
        const isQuiz = mode === 'quiz' || (mode === 'party' && idx % 3 === 2);
        const col = JELLY[idx % JELLY.length];
        if (isQuiz) {
          q = G.q();
          const pair = U.shuffle(U.pick(PAIRS));
          wall = makeWall(pair.map((id, i) => ({ pose: POSES[id], cx: i ? 770 : 270, ch: q.ch[i], i })), col);
          G.ask(q, { options: true, keys: pair.map(id => POSES[id].g), colors: OPT_COL });
        } else {
          q = null; G.ask(null);
          const pose = nextPose(); wall = makeWall([{ pose, cx: 320 }], col);
          SAY_P[pose.id]();
        }
        approach = mode === 'party' ? Math.max(isQuiz ? 5.5 : 3.4, 6.2 - idx * .32) : (isQuiz ? (grade <= 2 ? 9.5 : 8.5) : (grade <= 2 ? 7.5 : grade <= 4 ? 6.5 : 5.6) - idx * .12);
        phase = 'intro'; pt = 0; zNow = ZF; hist = []; lastTick = 99; judgeInfo = null; goldWas = false;
      }

      function judge() {
        const recent = hist.filter(h => G.t - h.t < .6);
        const best = i => recent.reduce((m, h) => Math.max(m, h.v[i]), 0);
        const R = wallRect(wall, 1);
        if (!wall.quiz) {
          const b = best(0), pose = wall.holes[0].pose;
          if (b >= TH_PASS) pass(b, R, pose); else fail(R, pose);
          return;
        }
        const b0 = best(0), b1 = best(1), pick = b0 >= b1 ? 0 : 1, bb = Math.max(b0, b1);
        const okIdx = wall.holes.findIndex(h => h.ch.ok), right = wall.holes[okIdx];
        if (bb >= TH_PASS * .95 && wall.holes[pick].ch.ok) { G.right(R.x + R.w * (pick ? .74 : .26), R.y + R.h * .4); pass(bb, R, null, right); }
        else { G.wrong(); fail(R, null, right, bb >= TH_PASS * .95); }
      }
      function pass(b, R, pose, qHole) {
        phase = 'pass'; pt = 0; passes++;
        const combo = G.hud.combo(G.hud.comboV + 1); bestCombo = Math.max(bestCombo, combo);
        const perfect = b >= .85, pts = 100 + Math.round(b * 60) + Math.min(10, combo - 1) * 20;
        G.hud.add(pts);
        G.pop((perfect ? '完美穿越！' : '穿过去啦！') + ' +' + pts, perfect ? 'perfect big' : 'good');
        G.sfx('shatter'); G.sfx(perfect ? 'perfect' : 'good'); G.sfx('cheer', .8); G.fileSfx('star', .5);
        flash = .55; flashCol = '255,230,140'; cheer = 1.6;
        shatter(R);
        if (pose) { if (!learned.includes(pose.g)) learned.push(pose.g); SAY_W[pose.id](); judgeInfo = { pose, t: 0 }; }
        if (qHole) { G.ask(null); judgeInfo = { ch: qHole.ch, t: 0, ok: true }; }
      }
      function fail(R, pose, qHole, wrongPick) {
        phase = 'fail'; pt = 0; G.hud.combo(0);
        G.sfx('wall'); G.sfx('jump', .7); G.fileSfx('hit', .5); shake = 1; flash = .35; flashCol = '255,120,160';
        fling = { t: 0, dir: Math.random() < .5 ? -1 : 1 };
        texts.push({ t: 'BOING!', x: R.x + R.w / 2, y: R.y + R.h * .28, size: 96, col: '#ffe14d', stroke: '#c2185b', life: 1.5, max: 1.5, vy: 0, rot: U.rand(-.15, .15) });
        G.pop(wrongPick ? '选错啦！' : '差一点点！', 'bad');
        if (pose) { G.say('哎呀，被墙撞倒啦'); judgeInfo = { pose, t: 0, miss: true }; }
        if (qHole) { G.ask(null); judgeInfo = { ch: qHole.ch, t: 0, ok: false }; }
      }
      // 墙碎成果冻块：按网格切贴图，往镜头方向飞散
      function shatter(R) {
        const w = wall, cols = w.quiz ? 13 : 9, rows = 7, cw = w.TW / cols, ch = TEX_H / rows;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const px = R.x + (i + .5) * cw * R.k, py = R.y + (j + .5) * ch * R.k, dx = px - W / 2, dy = py - H * .55;
          chunks.push({ img: w.cv, sx: i * cw, sy: j * ch, sw: cw, sh: ch, x: px, y: py, w: cw * R.k, h: ch * R.k, vx: dx * U.rand(1.6, 2.6) + U.rand(-80, 80) * S, vy: dy * U.rand(1.2, 2) - U.rand(250, 520) * S, rot: 0, vr: U.rand(-5, 5), sc: 1, vs: U.rand(.25, .7), life: 1.2 });
        }
        for (let i = 0; i < 36; i++) { const a = U.rand(0, 6.28), v = U.rand(300, 900) * S; parts.push({ k: 'blob', x: W / 2 + U.rand(-1, 1) * R.w * .4, y: R.y + R.h * U.rand(.2, .9), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 300 * S, r: U.rand(10, 26) * S, col: U.pick(w.col), life: U.rand(.8, 1.3) }); }
        for (let i = 0; i < 14; i++) { const a = U.rand(0, 6.28), v = U.rand(200, 600) * S; parts.push({ k: 'star', x: W / 2, y: R.y + R.h * .45, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200 * S, r: U.rand(22, 40) * S, rot: U.rand(0, 6), life: U.rand(.9, 1.4) }); }
      }
      function finish() {
        G.ask(null); phase = 'over';
        const quizOnly = mode === 'quiz';
        G.end({
          score: G.hud.scoreV, correct: quizOnly ? G.stats.correct : passes, total: quizOnly ? G.stats.total : N,
          title: passes >= 9 ? '穿墙大师！' : passes >= 6 ? '真棒，身体会写字啦！' : null,
          lines: (quizOnly ? [U.E('🧱') + ' 穿墙 <b>' + passes + '/' + N + '</b>'] : []).concat([U.E('🔥') + ' 最高连击 <b>' + bestCombo + '</b>']).concat(learned.length ? [U.E('📝') + ' 摆出的字 <b>' + U.esc(learned.join(' ')) + '</b>'] : []),
        });
      }

      /* ---------- 画面小部件 ---------- */
      function txt(t, tx, ty, size, fill, stroke, align, weight) {
        x.font = (weight || 900) + ' ' + size + 'px ' + U.FONT; x.textAlign = align || 'center'; x.textBaseline = 'middle';
        if (stroke) { x.lineJoin = 'round'; x.lineWidth = size * .16; x.strokeStyle = stroke; x.strokeText(t, tx, ty); }
        x.fillStyle = fill; x.fillText(t, tx, ty);
      }
      function emo(e, ex, ey, sz) { const im = U.emoImg(e); if (im.complete && im.naturalWidth) x.drawImage(im, ex - sz / 2, ey - sz / 2, sz, sz); }
      const partCol = v => v >= .75 ? '#5dff9d' : v >= .45 ? '#ffd166' : '#ff6b8a';
      // 玩家剪影（和墙洞同一坐标系）
      function drawPlayer(dt) {
        const R1 = wall ? wallRect(wall, 1) : { x: VPx - 320 * uOne, y: floorY - TEX_H * uOne, k: uOne };
        let tx = W / 2, ts = R1.k * PS;
        if (wall) {
          const hl = wall.holes;
          if (wall.quiz) {
            // 答题墙：剪影滑向更像的那个洞
            const bi = liveQ[0] >= liveQ[1] ? 0 : 1, go = Math.max(liveQ[0], liveQ[1]) > .45 && phase !== 'fail';
            tx = go ? R1.x + hl[bi].cx * R1.k : W / 2;
          } else tx = R1.x + hl[0].cx * R1.k;
        }
        figX += (tx - figX) * Math.min(1, dt * 6); figS += (ts - figS) * Math.min(1, dt * 6);
        const ox = figX - 50 * figS, oy = floorY - TEX_H * (wall && wall.quiz ? uQuiz : uOne) + POY * (wall && wall.quiz ? uQuiz : uOne);
        const gold = live.s >= TH_PASS && phase === 'come';
        const showParts = wall && !wall.quiz && (phase === 'come' || phase === 'intro');
        const pose = wall && !wall.quiz ? wall.holes[0].pose : null;
        const colors = {};
        if (showParts) for (const k in PP.BASE) colors[k] = pose.a[k] == null ? '#d8f3ff' : partCol(live.parts[k] == null ? 0 : live.parts[k]);
        x.save();
        // 影子
        x.fillStyle = 'rgba(40,0,60,.35)'; x.beginPath(); x.ellipse(figX, floorY, 34 * figS, 5 * figS, 0, 0, 7); x.fill();
        let al = 1;
        if (fling) {
          // 被墙弹飞：转着圈飞向镜头
          const k = Math.min(1, fling.t / .9), e = 1 - Math.pow(1 - k, 2), cx = figX, cy = oy + 55 * figS;
          x.translate(cx + fling.dir * e * W * .25, cy - Math.sin(k * Math.PI) * H * .3 + e * H * .1); x.rotate(fling.dir * e * 7); x.scale(1 + e * 1.4, 1 + e * 1.4); x.translate(-cx, -cy);
          al = 1 - k;
        } else if (popIn < 1) { const cx = figX, cy = oy + 104 * figS, k = 1 - Math.pow(1 - popIn, 3) * Math.cos(popIn * 8); x.translate(cx, cy); x.scale(k, k); x.translate(-cx, -cy); }
        if (phase === 'pass') x.translate(0, -Math.sin(Math.min(1, pt / .55) * Math.PI) * 40 * S);
        x.globalAlpha = al;
        // 外发光（宽半透明描边，比 shadowBlur 省）
        x.globalAlpha = al * (gold ? .5 + .25 * Math.sin(G.t * 14) : .3);
        figPath(x, disp, ox, oy, figS, 13, 10.5, gold ? null : colors, gold ? '#ffd84d' : '#7ef9ff');
        x.globalAlpha = al;
        if (gold) { x.shadowColor = '#ffd84d'; x.shadowBlur = 24 * S; }
        const J = figPath(x, disp, ox, oy, figS, 7.5, 8, gold ? null : colors, gold ? '#fff3b0' : '#ffffff');
        x.shadowBlur = 0;
        // 小脸
        const hx = ox + J.hd[0] * figS, hy = oy + J.hd[1] * figS, f = figS;
        x.fillStyle = '#3a1a5a';
        if (fling) { x.lineWidth = 1.4 * f; x.strokeStyle = '#3a1a5a'; [-3, 3].forEach(d => { x.beginPath(); x.moveTo(hx + d * f - 1.6 * f, hy - 2.6 * f); x.lineTo(hx + d * f + 1.6 * f, hy + .6 * f); x.moveTo(hx + d * f + 1.6 * f, hy - 2.6 * f); x.lineTo(hx + d * f - 1.6 * f, hy + .6 * f); x.stroke(); }); }
        else { [-3.2, 3.2].forEach(d => { x.beginPath(); x.arc(hx + d * f, hy - 1 * f, 1.3 * f, 0, 7); x.fill(); }); x.lineWidth = 1.2 * f; x.strokeStyle = '#3a1a5a'; x.beginPath(); x.arc(hx, hy + 1.5 * f, 3 * f, .2, Math.PI - .2); x.stroke(); }
        // 手
        [[J.lw, '#ff5d9e'], [J.rw, '#4cc9ff']].forEach(([p, c]) => { x.fillStyle = c; x.beginPath(); x.arc(ox + p[0] * f, oy + p[1] * f, 4 * f, 0, 7); x.fill(); });
        x.restore();
        return gold;
      }
      // 相似度环
      function drawRing(cx, cy, r, v, gold) {
        x.save();
        x.fillStyle = 'rgba(30,8,60,.72)'; x.beginPath(); x.arc(cx, cy, r * 1.32, 0, 7); x.fill();
        x.lineWidth = r * .24; x.lineCap = 'round'; x.strokeStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
        const col = gold ? '#ffd84d' : partCol(v);
        if (gold) { x.shadowColor = col; x.shadowBlur = 24 * S * (1 + .4 * Math.sin(G.t * 12)); }
        x.strokeStyle = col; x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.01, v)); x.stroke(); x.shadowBlur = 0;
        // 过关线
        const ta = -Math.PI / 2 + Math.PI * 2 * TH_PASS; x.strokeStyle = '#fff'; x.lineWidth = 4 * S; x.lineCap = 'butt';
        x.beginPath(); x.moveTo(cx + Math.cos(ta) * r * .78, cy + Math.sin(ta) * r * .78); x.lineTo(cx + Math.cos(ta) * r * 1.22, cy + Math.sin(ta) * r * 1.22); x.stroke();
        emo(gold ? '🤩' : v >= .45 ? '🙂' : '😮', cx, cy - r * .22, r * .62);
        txt(Math.round(v * 100) + '%', cx, cy + r * .42, r * .38, '#fff', 'rgba(0,0,0,.4)');
        txt('相似度', cx, cy + r * 1.62, 18 * S, '#fff', 'rgba(60,0,80,.8)');
        x.restore();
      }
      function panel(px, py, pw, ph, col) {
        x.fillStyle = 'rgba(30,8,60,.78)'; x.strokeStyle = col || '#ff7ec4'; x.lineWidth = 4 * S; x.beginPath(); x.roundRect(px, py, pw, ph, 20 * S); x.fill(); x.stroke();
      }
      // 左侧目标卡
      function drawCard() {
        if (!wall) return;
        const pw = 190 * S, px = W * .015 + 8 * S, py = H * .27;
        if (!wall.quiz) {
          const p = wall.holes[0].pose, ph = 290 * S; panel(px, py, pw, ph, wall.col[0]);
          txt(KIND[p.kind], px + pw / 2, py + 26 * S, 20 * S, '#fff');
          txt(p.g, px + pw / 2, py + 78 * S, (p.g.length > 1 ? 50 : 66) * S, wall.col[1], 'rgba(0,0,0,.35)');
          const s = 1.2 * S; x.save(); x.globalAlpha = .95; figPath(x, p.a, px + pw / 2 - 50 * s, py + 108 * S, s, 10, 10, null, '#ffffff'); x.restore();
          txt(p.hint, px + pw / 2, py + ph - 22 * S, (p.hint.length > 9 ? 14 : 17) * S, '#ffe9a8', null, 'center', 700);
        } else {
          const ph = 274 * S; panel(px, py, pw, ph, '#ffd166');
          txt('答题墙', px + pw / 2, py + 26 * S, 22 * S, '#ffd166');
          wall.holes.forEach((h, i) => {
            const cy = py + 60 * S + i * 94 * S, s = .78 * S;
            x.save(); figPath(x, h.pose.a, px + 18 * S, cy - 4 * S, s, 10, 10, null, OPT_COL[i]); x.restore();
            txt(h.pose.g, px + 118 * S, cy + 36 * S, 40 * S, OPT_COL[i], '#fff');
          });
          txt('摆出答案的姿势', px + pw / 2, py + ph - 18 * S, 15 * S, '#ffe9a8', null, 'center', 700);
        }
      }
      // 底部：墙还有多远
      function drawDistance(p, remain) {
        const bw = Math.min(W * .34, 460 * S), bx = W / 2 - bw / 2, by = H - 30 * S, bh = 16 * S;
        x.fillStyle = 'rgba(30,8,60,.7)'; x.beginPath(); x.roundRect(bx - 50 * S, by - 24 * S, bw + 100 * S, 48 * S, 24 * S); x.fill();
        x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.roundRect(bx, by - bh / 2, bw, bh, bh / 2); x.fill();
        const gr = x.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#4cc9ff'); gr.addColorStop(.7, '#ffd166'); gr.addColorStop(1, '#ff5d73');
        x.fillStyle = gr; x.beginPath(); x.roundRect(bx, by - bh / 2, Math.max(bh, bw * p), bh, bh / 2); x.fill();
        emo('🧱', bx + bw * p, by, 34 * S); emo('🧍', bx + bw + 30 * S, by, 32 * S);
        if (remain != null && remain < 3.2 && phase === 'come') txt(String(Math.ceil(remain)), bx + bw * p, by - 40 * S, 40 * S * (1 + (remain % 1) * .4), '#fff', '#ff3d8b');
      }
      // 顶部提示条
      function drawBanner() {
        if (!wall || wall.quiz || phase === 'over' || phase === 'pass' || phase === 'fail') return;
        const p = wall.holes[0].pose, k = phase === 'intro' ? Math.min(1, pt / .35) : 1, sc = k < 1 ? .4 + .6 * (1 - Math.pow(1 - k, 3)) + Math.sin(k * Math.PI) * .12 : 1;
        const by = H * .14, label = KIND[p.kind];
        x.save(); x.translate(W / 2, by); x.scale(sc, sc);
        x.font = '900 ' + 34 * S + 'px ' + U.FONT; const lw = x.measureText(label).width, gw = 74 * S, tw = lw + gw + 70 * S;
        x.fillStyle = 'rgba(255,61,139,.92)'; x.strokeStyle = '#ffd166'; x.lineWidth = 5 * S; x.beginPath(); x.roundRect(-tw / 2, -36 * S, tw, 72 * S, 36 * S); x.fill(); x.stroke();
        txt(label, -tw / 2 + 30 * S + lw / 2, 2 * S, 34 * S, '#fff');
        x.fillStyle = '#fff'; x.beginPath(); x.roundRect(tw / 2 - gw - 18 * S, -30 * S, gw, 60 * S, 18 * S); x.fill();
        txt(p.g, tw / 2 - gw / 2 - 18 * S, 3 * S, (p.g.length > 1 ? 34 : 48) * S, '#ff3d8b');
        x.restore();
      }
      // 穿墙后的单词 / 答案卡
      function drawInfo(dt) {
        if (!judgeInfo) return; judgeInfo.t += dt; const t = judgeInfo.t; if (t > 1.9) return;
        const k = Math.min(1, t / .3), sc = (1 - Math.pow(1 - k, 3)) * (1 + Math.sin(k * Math.PI) * .1), al = t > 1.5 ? 1 - (t - 1.5) / .4 : 1;
        x.save(); x.globalAlpha = Math.max(0, al); x.translate(W / 2, H * .16); x.scale(sc, sc);
        const pw = 420 * S, ph = 120 * S;
        if (judgeInfo.pose) {
          const p = judgeInfo.pose; panel(-pw / 2, -ph / 2, pw, ph, judgeInfo.miss ? '#ff6b8a' : '#5dff9d');
          txt(p.g, -pw / 2 + 62 * S, 4 * S, (p.g.length > 1 ? 48 : 70) * S, '#ffd166', 'rgba(0,0,0,.4)');
          emo(p.w[2], -pw / 2 + 150 * S, 0, 64 * S);
          txt(p.w[0], -pw / 2 + 196 * S, -20 * S, (p.w[0].length > 6 ? 30 : 38) * S, '#fff', null, 'left');
          txt(p.w[1], -pw / 2 + 196 * S, 28 * S, 24 * S, '#ffe9a8', null, 'left', 700);
        } else {
          const c = judgeInfo.ch; panel(-pw / 2, -ph / 2, pw, ph, judgeInfo.ok ? '#5dff9d' : '#ff6b8a');
          txt(judgeInfo.ok ? '答对啦！' : '正确答案', -pw / 2 + 92 * S, 0, 32 * S, judgeInfo.ok ? '#5dff9d' : '#ffb3c2');
          if (c.t) txt(c.t, pw / 4, 2 * S, (c.t.length > 3 ? 34 : 50) * S, '#fff', 'rgba(0,0,0,.4)'); else emo(c.e, pw / 4, 0, 76 * S);
        }
        x.restore();
      }
      // 答题墙上的选项牌（emoji 图要加载完才能画，所以每帧画在墙上面）
      function drawOptLabels(R) {
        wall.holes.forEach((h, i) => {
          const cx = R.x + h.cx * R.k, cy = R.y + 62 * R.k, s = R.k, c = h.ch, label = c.t || '';
          x.save(); x.font = '900 ' + 58 * s + 'px ' + U.FONT;
          const w = Math.max(170 * s, (label ? x.measureText(label).width : 70 * s) + 110 * s), hh = 96 * s;
          x.fillStyle = '#fff'; x.strokeStyle = OPT_COL[i]; x.lineWidth = 8 * s; x.beginPath(); x.roundRect(cx - w / 2, cy - hh / 2, w, hh, 30 * s); x.fill(); x.stroke();
          x.fillStyle = OPT_COL[i]; x.beginPath(); x.arc(cx - w / 2 + 44 * s, cy, 30 * s, 0, 7); x.fill();
          txt(h.pose.g, cx - w / 2 + 44 * s, cy + 2 * s, 38 * s, '#fff');
          if (label) txt(label, cx + 30 * s, cy + 3 * s, 58 * s, '#3a1a5a'); else emo(c.e, cx + 30 * s, cy, 72 * s);
          x.restore();
        });
      }
      // 观众剪影（左右下角，穿墙成功时欢呼跳动）
      function drawCrowd() {
        const n = 7, rw = W * .22;
        [0, 1].forEach(side => {
          for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) {
            const bx = side ? W - rw + (i + .5 + row * .5) * rw / n : (i + .5 - row * .5) * rw / n, seed = i * 1.7 + row * 3 + side * 5;
            const hop = Math.abs(Math.sin(G.t * (cheer > 0 ? 9 : 2) + seed)) * (cheer > 0 ? 18 : 3) * S, by = H + 18 * S - row * 26 * S - hop, r = (24 - row * 3) * S;
            x.fillStyle = row ? '#3b1466' : '#24093f';
            x.beginPath(); x.arc(bx, by - r * 1.6, r * .62, 0, 7); x.fill();
            x.beginPath(); x.roundRect(bx - r * .9, by - r, r * 1.8, r * 2, r * .8); x.fill();
            if (cheer > 0 && (i + row) % 2 === 0) { x.strokeStyle = x.fillStyle; x.lineWidth = 6 * S; x.lineCap = 'round'; x.beginPath(); x.moveTo(bx - r * .7, by - r * .8); x.lineTo(bx - r * 1.1, by - r * 2.4); x.moveTo(bx + r * .7, by - r * .8); x.lineTo(bx + r * 1.1, by - r * 2.4); x.stroke(); }
          }
        });
      }
      // 聚光灯 + 门框跑马灯（随节拍闪）
      function drawLights() {
        x.save(); x.globalCompositeOperation = 'lighter';
        [-1, 1].forEach(sd => {
          const ox = W / 2 + sd * W * .36, a = Math.sin(G.t * .7 + sd) * .18, tx = W / 2 + Math.sin(a) * W * .4, ty = floorY;
          const gr = x.createLinearGradient(ox, 0, tx, ty); gr.addColorStop(0, 'rgba(255,240,200,.32)'); gr.addColorStop(1, 'rgba(255,200,240,0)');
          x.fillStyle = gr; x.beginPath(); x.moveTo(ox - 10 * S, 0); x.lineTo(ox + 10 * S, 0); x.lineTo(tx + W * .1, ty); x.lineTo(tx - W * .1, ty); x.closePath(); x.fill();
        });
        const dw = 640 * uOne / ZF * 1.25 + 20 * S, dh = TEX_H * uOne / ZF * 1.15 + 10 * S, dx = VPx - dw / 2, dy = zY(ZF) - dh;
        const pts = []; for (let i = 0; i <= 8; i++) pts.push([dx, dy + dh * (1 - i / 8)]); for (let i = 1; i < 10; i++) pts.push([dx + dw * i / 10, dy]); for (let i = 0; i <= 8; i++) pts.push([dx + dw, dy + dh * i / 8]);
        pts.forEach((p, i) => { const on = (i + Math.floor(G.t * 6)) % 3 === 0; x.fillStyle = on ? 'rgba(255,240,150,' + (.7 + beatK * .3) + ')' : 'rgba(255,160,80,.35)'; x.beginPath(); x.arc(p[0], p[1], (on ? 4.5 : 3) * S * (1 + beatK * .3), 0, 7); x.fill(); });
        x.restore();
      }

      /* ---------- 主循环 ---------- */
      nextWall();
      G.loop(dt => {
        if (phase === 'over') return;
        pt += dt; beatK = Math.max(0, beatK - dt * 4); cheer = Math.max(0, cheer - dt); shake = Math.max(0, shake - dt * 2.2); flash = Math.max(0, flash - dt * 1.8);
        // 实时姿势
        const p = G.player(0), an = p && p.body && p.body.angles;
        const kk = 1 - Math.exp(-dt * 14);
        for (const k in disp) { const v = an && an[k] != null ? an[k] : PP.BASE[k]; let d = v - disp[k]; d = ((d + 540) % 360) - 180; disp[k] += d * kk; }
        if (wall) {
          if (wall.quiz) { liveQ = wall.holes.map(h => scorePose(p, h.pose).s); live = { s: Math.max(liveQ[0], liveQ[1]), parts: {} }; }
          else live = scorePose(p, wall.holes[0].pose);
        }
        ringV += (live.s - ringV) * Math.min(1, dt * 8);
        // 阶段推进
        let remain = null, prog = 0;
        if (phase === 'intro') { zNow = ZF; prog = 0; if (pt > (wall.quiz ? 2 : 1.2)) { phase = 'come'; pt = 0; G.sfx('whoosh'); } }
        else if (phase === 'come') {
          prog = Math.min(1, pt / approach); zNow = ZF + (1 - ZF) * prog; remain = approach - pt;
          hist.push({ t: G.t, v: wall.quiz ? liveQ.slice() : [live.s] }); while (hist.length && G.t - hist[0].t > 1) hist.shift();
          const tk = Math.ceil(remain); if (tk < lastTick && tk <= 3 && tk >= 1) G.sfx('count', .5); lastTick = tk;
          const gold = live.s >= TH_PASS * (wall.quiz ? .95 : 1);
          if (gold && !goldWas && G.t - chimeT > .8) { G.sfx('chime', .7); chimeT = G.t; }
          goldWas = gold;
          if (prog >= 1) judge();
        } else if (phase === 'pass' || phase === 'fail') {
          prog = 1;
          if (fling) { fling.t += dt; if (fling.t > 1.05) { fling = null; popIn = 0; G.sfx('pop'); } }
          if (popIn < 1) popIn = Math.min(1, popIn + dt * 2.5);
          const hold = mode === 'party' ? 1.7 : 2.1;
          if (pt > hold) { wall = null; nextWall(); }
        }
        // 碎块 / 粒子 / 飘字
        const g = 1400 * S;
        chunks.forEach(c => { c.vy += g * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; c.sc += c.vs * dt; c.life -= dt; });
        for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i].life <= 0) chunks.splice(i, 1);
        parts.forEach(o => { o.vy += g * .6 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt; if (o.rot != null) o.rot += dt * 3; });
        for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
        texts.forEach(o => { o.life -= dt; o.y += o.vy * dt; });
        for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1);

        /* ---- 画 ---- */
        x.save(); if (shake) x.translate(U.rand(-1, 1) * shake * 16 * S, U.rand(-1, 1) * shake * 12 * S);
        x.drawImage(bg, 0, 0, W, H);
        drawLights();
        if (wall && phase !== 'pass') {
          let z = zNow, wob = Math.sin(G.t * 6) * .015, al = phase === 'intro' ? Math.min(1, pt / .5) : 1;
          if (phase === 'fail') { wob = Math.sin(pt * 26) * .13 * Math.exp(-pt * 3); if (pt > 1.2) { z = 1 + (pt - 1.2) * 2.5; al = Math.max(0, 1 - (pt - 1.2) / .7); } }
          const R = drawWall(wall, z, al, wob);
          if (wall.quiz && al > .05) { x.save(); x.globalAlpha = al; drawOptLabels(R); x.restore(); }
        }
        chunks.forEach(c => { x.save(); x.globalAlpha = Math.min(1, c.life / .5); x.translate(c.x, c.y); x.rotate(c.rot); x.scale(c.sc, c.sc); x.drawImage(c.img, c.sx, c.sy, c.sw, c.sh, -c.w / 2, -c.h / 2, c.w, c.h); x.restore(); });
        const gold = drawPlayer(dt);
        parts.forEach(o => {
          x.globalAlpha = Math.min(1, o.life * 2);
          if (o.k === 'blob') { x.fillStyle = o.col; x.beginPath(); x.arc(o.x, o.y, o.r, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.arc(o.x - o.r * .35, o.y - o.r * .35, o.r * .28, 0, 7); x.fill(); }
          else { x.save(); x.translate(o.x, o.y); x.rotate(o.rot); emo('⭐', 0, 0, o.r); x.restore(); }
        });
        x.globalAlpha = 1;
        texts.forEach(o => { const k = 1 - o.life / o.max, sc = k < .15 ? .3 + k / .15 * .9 : 1.2 - Math.min(.2, (k - .15) * 2); x.save(); x.globalAlpha = Math.min(1, o.life / .4); x.translate(o.x, o.y); x.rotate(o.rot); x.scale(sc, sc); txt(o.t, 0, 0, o.size * S, o.col, o.stroke); x.restore(); });
        drawCrowd();
        if (flash) { x.fillStyle = 'rgba(' + flashCol + ',' + flash + ')'; x.fillRect(0, 0, W, H); }
        x.restore();
        // HUD（不跟着震）
        drawBanner(); drawCard(); drawInfo(dt);
        drawRing(W - W * .015 - 92 * S, H * .42, 62 * S, ringV, gold);
        drawDistance(prog, remain);
      });
    },
  });
})();
