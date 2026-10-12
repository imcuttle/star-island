/* 星星说（原创）：Simon Says 反应力 + 身体部位学习
   · 星星老师发指令：前面有「星星说」才做；没有「星星说」就要定住不动（动作 / 新姿势 / 全身关键点位移 任何一个都算乱动）
   · 连续答对节奏加快，偶尔连发两个指令；每 5 条夹一道题库判断题（左边答案举左手、右边举右手）
   · 模式：中文（学前）/ 英文 Simon Says（学身体部位单词）/ 数数挑战（拍手、跳跃次数 = 算式结果）
   · 20 条结算，做错 5 次（该做没做 / 不该做却做了）结束
   画面分三层：底层 2D 马戏团舞台 → 中层 3D 星星老师（VRM，程序化摆出举手 / 叉腰 / 拍手等示范姿势）→ 顶层 2D 粒子、示范板、你的骨架、倒计时环 */
(function () {
  const M = window.Motion, U = M.U;

  /* ---------- 指令表：文字 / 图标 / 火柴人示范 / 判定方式；语音用字面量（之后工具扫描生成录音） ----------
     say：[星星说中文, 中文, 星星说英文, 英文]。L / R 都是玩家自己的手（镜子视角里在画面同一侧） */
  const CMDS = {
    upL: { zh: '举起左手', en: 'Raise your left hand', ic: '✋', mv: 'raiseL', kind: 'pose', pose: 'upL', say: [G => G.say('星星说，举起左手'), G => G.say('举起左手'), G => G.say('Simon says, raise your left hand', 'en'), G => G.say('Raise your left hand', 'en')] },
    upR: { zh: '举起右手', en: 'Raise your right hand', ic: '🤚', mv: 'raiseR', kind: 'pose', pose: 'upR', say: [G => G.say('星星说，举起右手'), G => G.say('举起右手'), G => G.say('Simon says, raise your right hand', 'en'), G => G.say('Raise your right hand', 'en')] },
    upBoth: { zh: '双手举高', en: 'Hands up high', ic: '🙌', mv: 'handsUp', kind: 'pose', pose: 'upBoth', say: [G => G.say('星星说，双手举高'), G => G.say('双手举高'), G => G.say('Simon says, hands up high', 'en'), G => G.say('Hands up high', 'en')] },
    head: { zh: '摸摸头', en: 'Touch your head', ic: '💆', mv: 'head', kind: 'pose', pose: 'head', say: [G => G.say('星星说，摸摸头'), G => G.say('摸摸头'), G => G.say('Simon says, touch your head', 'en'), G => G.say('Touch your head', 'en')] },
    hips: { zh: '叉腰', en: 'Hands on hips', ic: '🦸', mv: 'hips', kind: 'pose', pose: 'hips', say: [G => G.say('星星说，叉腰'), G => G.say('叉腰'), G => G.say('Simon says, hands on hips', 'en'), G => G.say('Hands on hips', 'en')] },
    tpose: { zh: '双手平举像飞机', en: 'Arms out like a plane', ic: '✈️', mv: 'tpose', kind: 'pose', pose: 'tpose', say: [G => G.say('星星说，双手平举像飞机'), G => G.say('双手平举像飞机'), G => G.say('Simon says, arms out like a plane', 'en'), G => G.say('Arms out like a plane', 'en')] },
    clap: { zh: '拍拍手', en: 'Clap your hands', ic: '👏', mv: 'clap', kind: 'ev', ev: 'clap', say: [G => G.say('星星说，拍拍手'), G => G.say('拍拍手'), G => G.say('Simon says, clap your hands', 'en'), G => G.say('Clap your hands', 'en')] },
    jump: { zh: '跳一下', en: 'Jump', ic: '🦘', mv: 'jump', kind: 'ev', ev: 'jump', say: [G => G.say('星星说，跳一下'), G => G.say('跳一下'), G => G.say('Simon says, jump', 'en'), G => G.say('Jump', 'en')] },
    squat: { zh: '蹲下', en: 'Squat down', ic: '🐸', mv: 'squat', kind: 'ev', ev: 'squat', say: [G => G.say('星星说，蹲下'), G => G.say('蹲下'), G => G.say('Simon says, squat down', 'en'), G => G.say('Squat down', 'en')] },
    oneLeg: { zh: '单脚站', en: 'Stand on one leg', ic: '🦩', mv: 'oneLeg', kind: 'pose', pose: 'oneLeg', say: [G => G.say('星星说，单脚站'), G => G.say('单脚站'), G => G.say('Simon says, stand on one leg', 'en'), G => G.say('Stand on one leg', 'en')] },
    left: { zh: '向左走一步', en: 'Step to the left', ic: '⬅️', mv: 'stepL', kind: 'lane', dir: -1, say: [G => G.say('星星说，向左走一步'), G => G.say('向左走一步'), G => G.say('Simon says, step to the left', 'en'), G => G.say('Step to the left', 'en')] },
    right: { zh: '向右走一步', en: 'Step to the right', ic: '➡️', mv: 'stepR', kind: 'lane', dir: 1, say: [G => G.say('星星说，向右走一步'), G => G.say('向右走一步'), G => G.say('Simon says, step to the right', 'en'), G => G.say('Step to the right', 'en')] },
    run: { zh: '原地跑', en: 'Run in place', ic: '🏃', mv: 'run', kind: 'run', say: [G => G.say('星星说，原地跑'), G => G.say('原地跑'), G => G.say('Simon says, run in place', 'en'), G => G.say('Run in place', 'en')] },
    punch: { zh: '出拳', en: 'Punch', ic: '👊', mv: 'punch', kind: 'ev', ev: 'punch', say: [G => G.say('星星说，出拳'), G => G.say('出拳'), G => G.say('Simon says, punch', 'en'), G => G.say('Punch', 'en')] },
  };
  const KEYS = Object.keys(CMDS);
  // 连续两个指令（都带「星星说」）
  const COMBOS = [
    { a: 'upR', b: 'jump', say: [G => G.say('星星说，举起右手，然后跳一下'), G => G.say('Simon says, raise your right hand, then jump', 'en')] },
    { a: 'clap', b: 'squat', say: [G => G.say('星星说，拍拍手，然后蹲下'), G => G.say('Simon says, clap your hands, then squat down', 'en')] },
    { a: 'head', b: 'jump', say: [G => G.say('星星说，摸摸头，然后跳一下'), G => G.say('Simon says, touch your head, then jump', 'en')] },
    { a: 'upL', b: 'punch', say: [G => G.say('星星说，举起左手，然后出拳'), G => G.say('Simon says, raise your left hand, then punch', 'en')] },
    { a: 'hips', b: 'squat', say: [G => G.say('星星说，叉腰，然后蹲下'), G => G.say('Simon says, hands on hips, then squat down', 'en')] },
    { a: 'tpose', b: 'clap', say: [G => G.say('星星说，双手平举像飞机，然后拍拍手'), G => G.say('Simon says, arms out like a plane, then clap your hands', 'en')] },
  ];
  // 数数挑战：拍手 / 跳的次数 = 算式结果。g：最低年级
  const MATHS = [
    { ev: 'clap', n: 2, g: 1, t: '拍手 1+1 下', say: [G => G.say('星星说，拍手一加一下'), G => G.say('拍手一加一下')] },
    { ev: 'clap', n: 3, g: 1, t: '拍手 2+1 下', say: [G => G.say('星星说，拍手二加一下'), G => G.say('拍手二加一下')] },
    { ev: 'clap', n: 3, g: 1, t: '拍手 4-1 下', say: [G => G.say('星星说，拍手四减一下'), G => G.say('拍手四减一下')] },
    { ev: 'clap', n: 4, g: 1, t: '拍手 2+2 下', say: [G => G.say('星星说，拍手二加二下'), G => G.say('拍手二加二下')] },
    { ev: 'clap', n: 4, g: 1, t: '拍手 5-1 下', say: [G => G.say('星星说，拍手五减一下'), G => G.say('拍手五减一下')] },
    { ev: 'clap', n: 5, g: 1, t: '拍手 3+2 下', say: [G => G.say('星星说，拍手三加二下'), G => G.say('拍手三加二下')] },
    { ev: 'clap', n: 4, g: 2, t: '拍手 2×2 下', say: [G => G.say('星星说，拍手二乘二下'), G => G.say('拍手二乘二下')] },
    { ev: 'clap', n: 3, g: 2, t: '拍手 6÷2 下', say: [G => G.say('星星说，拍手六除以二下'), G => G.say('拍手六除以二下')] },
    { ev: 'clap', n: 5, g: 2, t: '拍手 10-5 下', say: [G => G.say('星星说，拍手十减五下'), G => G.say('拍手十减五下')] },
    { ev: 'jump', n: 2, g: 1, t: '跳 1+1 下', say: [G => G.say('星星说，跳一加一下'), G => G.say('跳一加一下')] },
    { ev: 'jump', n: 2, g: 1, t: '跳 3-1 下', say: [G => G.say('星星说，跳三减一下'), G => G.say('跳三减一下')] },
    { ev: 'jump', n: 3, g: 1, t: '跳 1+2 下', say: [G => G.say('星星说，跳一加二下'), G => G.say('跳一加二下')] },
    { ev: 'jump', n: 3, g: 1, t: '跳 5-2 下', say: [G => G.say('星星说，跳五减二下'), G => G.say('跳五减二下')] },
    { ev: 'jump', n: 2, g: 2, t: '跳 6÷3 下', say: [G => G.say('星星说，跳六除以三下'), G => G.say('跳六除以三下')] },
  ];
  const POSES = ['upL', 'upR', 'upBoth', 'head', 'hips', 'tpose', 'oneLeg'];
  const KP = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]; // 「有没有乱动」用的关键点
  const N_ROUNDS = 20, LIVES = 5;

  // 补一个火柴人动作：定住不动（双手贴身、轻微呼吸）
  if (M.Puppet && !M.Puppet.MOVES.freeze) M.Puppet.MOVES.freeze = [[1, { lUA: 98, lFA: 92, rUA: 82, rFA: 88 }, { dy: 0 }], [1, { lUA: 98, lFA: 92, rUA: 82, rFA: 88 }, { dy: .3 }]];

  function css() {
    if (document.getElementById('mg-simon-css')) return;
    const s = document.createElement('style'); s.id = 'mg-simon-css';
    s.textContent = `
.mg-simon .sm-card { position: absolute; left: 50%; top: calc(78px + env(safe-area-inset-top)); transform: translate(-50%, -40px) scale(.7); opacity: 0; transition: transform .38s cubic-bezier(.2,1.5,.4,1), opacity .25s; display: flex; align-items: center; gap: 18px; padding: 12px 26px 12px 14px; border-radius: 30px; background: linear-gradient(180deg, #ffffff, #fff3d1); color: #2a2350; box-shadow: 0 8px 0 rgba(90,50,0,.25), 0 0 0 6px #ffd166, 0 0 0 10px rgba(255,255,255,.35), 0 18px 50px rgba(0,0,0,.45); max-width: 86vw; }
.mg-simon .sm-card.in { opacity: 1; transform: translate(-50%, 0) scale(1); }
.mg-simon .sm-card.ok { box-shadow: 0 8px 0 rgba(0,80,40,.25), 0 0 0 6px #5ee08a, 0 0 40px 10px rgba(94,224,138,.7); }
.mg-simon .sm-card.bad { box-shadow: 0 8px 0 rgba(90,0,20,.25), 0 0 0 6px #ff5d73, 0 0 40px 10px rgba(255,93,115,.6); animation: sm-shake .45s; }
@keyframes sm-shake { 20% { margin-left: -14px } 40% { margin-left: 12px } 60% { margin-left: -8px } 80% { margin-left: 5px } }
.mg-simon .sm-badge { flex: none; width: 104px; height: 104px; position: relative; display: grid; place-items: center; }
.mg-simon .sm-badge .emo { width: 104px; height: 104px; filter: drop-shadow(0 0 12px rgba(255,190,40,.9)); animation: sm-spin 2.4s ease-in-out infinite; }
.mg-simon .sm-badge b { position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%); white-space: nowrap; padding: 2px 10px; border-radius: 999px; background: linear-gradient(#ffcf3f, #ff9d00); color: #fff; font-size: 17px; font-weight: 900; text-shadow: 0 2px 0 rgba(140,60,0,.6); box-shadow: 0 3px 0 #b85f00; }
.mg-simon .sm-badge.none i { width: 92px; height: 92px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #d7dbe6, #8d93a6); display: grid; place-items: center; font-style: normal; font-size: 62px; font-weight: 900; color: #fff; text-shadow: 0 3px 0 rgba(0,0,0,.25); box-shadow: inset 0 -6px 0 rgba(0,0,0,.15); }
.mg-simon .sm-badge.quiz .emo { animation: none; }
@keyframes sm-spin { 0%,100% { transform: rotate(-10deg) scale(1) } 50% { transform: rotate(10deg) scale(1.08) } }
.mg-simon .sm-txt { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mg-simon .sm-txt > b { font-size: clamp(30px, 4.2vw, 54px); font-weight: 900; line-height: 1.12; letter-spacing: 1px; white-space: nowrap; }
.mg-simon .sm-card.long .sm-txt > b { font-size: clamp(24px, 3vw, 40px); }
.mg-simon .sm-txt > b em { font-style: normal; color: #ff9d00; text-shadow: 0 2px 0 rgba(160,80,0,.18); }
.mg-simon .sm-txt > small { font-size: clamp(16px, 1.8vw, 22px); color: #6d5fa8; font-weight: 700; }
.mg-simon .sm-ic { flex: none; width: 84px; height: 84px; border-radius: 24px; display: grid; place-items: center; background: linear-gradient(#efe9ff, #d9ceff); box-shadow: inset 0 -5px 0 rgba(80,40,180,.15); }
.mg-simon .sm-ic .emo { width: 62px; height: 62px; }
.mg-simon .sm-steps { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
.mg-simon .sm-steps span { padding: 3px 12px; border-radius: 999px; background: #efe9ff; color: #6d5fa8; font-size: 18px; font-weight: 800; }
.mg-simon .sm-steps span.on { background: #7c5cff; color: #fff; box-shadow: 0 0 12px rgba(124,92,255,.7); }
.mg-simon .sm-steps span.done { background: #5ee08a; color: #0b4a26; }
.mg-simon .sm-cnt { display: flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 800; color: #6d5fa8; }
.mg-simon .sm-cnt b { font-size: 40px; color: #ff5d9e; min-width: 34px; text-align: center; display: inline-block; }
.mg-simon .sm-cnt b.bump { animation: mg-bump .25s; }
.mg-simon .sm-stamp { position: absolute; right: -18px; top: -22px; padding: 4px 14px; border-radius: 14px; font-size: 24px; font-weight: 900; color: #fff; transform: rotate(8deg) scale(0); transition: transform .3s cubic-bezier(.2,1.8,.4,1); white-space: nowrap; }
.mg-simon .sm-card.ok .sm-stamp { background: #22b35e; transform: rotate(8deg) scale(1); }
.mg-simon .sm-card.bad .sm-stamp { background: #ff3b5c; transform: rotate(-6deg) scale(1); }
`;
    document.head.appendChild(s);
  }

  M.game({
    id: 'simon', name: '星星说', icon: '🌟', color: '#ffb020', tag: '原创', demo: 'raiseL',
    short: '「星星说」才做，没说就定住！', desc: '星星老师发指令，前面说了「星星说」才做；没说「星星说」就要定住不动，别被骗啦！还能学英语身体单词、算算拍几下。',
    origin: '经典儿童游戏 Simon Says 的体感版：考验听力、反应和自控力。',
    how: [['raiseL', '星星说才做'], ['idle', '没说就别动'], ['clap', '听清楚数一数']],
    modes: [{ id: 'zh', name: '中文', icon: '🀄', desc: '星星说才做' }, { id: 'en', name: '英文 Simon Says', icon: '🔤', desc: '学身体部位英语' }, { id: 'math', name: '数数挑战', icon: '🔢', desc: '拍手跳跃算一算' }],
    qOpts: { maxCh: 2, maxLen: 6 },
    pip: false, // 右边「你」板已经是实时骨架（还会在陷阱时变红、显示进度），不再叠 SDK 画中画
    sayHow: '星星说才做，没说星星说就要定住不动哦',
    // 介绍卡期间就开始加载老师模型（不阻塞）
    preload(G) {
      if (!window.Avatar3D || !window.THREE) return;
      G._simonTeacher = Avatar3D.make('vr_shino', { height: 1.6 }).catch(() => Avatar3D.make('kid_girl1', { height: 1.45 })).catch(() => null);
    },
    start(G) {
      css();
      const EN = G.mode === 'en', MATH = G.mode === 'math', SL = EN ? 'Simon says' : '星星说';
      const grade = G.grade || 1;
      /* ---------- 三层画布 ---------- */
      const B = G.canvas({ dpr: 1.5 }), bx = B.ctx;
      let T3 = null; try { T3 = G.three({ fov: 30, alpha: true, shadows: true, exposure: 1.05 }); } catch (e) { console.warn(e); }
      const C = G.canvas(), x = C.ctx;
      const stageEl = G.stage;

      /* ---------- 底层：马戏团舞台（离屏画一次）+ 每帧的扫射追光 ---------- */
      const bg = document.createElement('canvas');
      let sparks = [];
      function drawBg() {
        const W = B.W, H = B.H; bg.width = Math.round(W * B.dpr); bg.height = Math.round(H * B.dpr);
        const b = bg.getContext('2d'); b.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
        const g = b.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d1150'); g.addColorStop(.55, '#46207a'); g.addColorStop(1, '#22123f'); b.fillStyle = g; b.fillRect(0, 0, W, H);
        // 帐篷条纹：从顶部中心放射
        const fy = H * .74, cx = W / 2, cy = -H * .35, nS = 22;
        b.save(); b.beginPath(); b.rect(0, 0, W, fy); b.clip();
        for (let i = 0; i < nS; i++) {
          const a0 = Math.PI * (.12 + .76 * i / nS), a1 = Math.PI * (.12 + .76 * (i + 1) / nS), R = H * 2.2;
          b.fillStyle = i % 2 ? 'rgba(255,90,130,.30)' : 'rgba(255,236,210,.10)';
          b.beginPath(); b.moveTo(cx, cy); b.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); b.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); b.closePath(); b.fill();
        }
        const fade = b.createLinearGradient(0, fy * .4, 0, fy); fade.addColorStop(0, 'rgba(20,10,50,0)'); fade.addColorStop(1, 'rgba(20,10,50,.65)'); b.fillStyle = fade; b.fillRect(0, 0, W, fy);
        b.restore();
        // 墙上的大星星和字母积木（幼儿园风）
        [[.2, .5, 34, '#ffd166'], [.8, .46, 28, '#7ef9ff'], [.31, .3, 18, '#ff9fe0'], [.7, .28, 20, '#ffd166'], [.12, .3, 14, '#b9a6ff'], [.9, .62, 16, '#ff9fe0']].forEach(([fx, fy2, r, c]) => { b.save(); b.globalAlpha = .55; b.fillStyle = c; b.shadowColor = c; b.shadowBlur = 18; starPath(b, W * fx, H * fy2, r * H / 800, r * H / 1600, 5); b.fill(); b.restore(); });
        const blk = (bx2, by, s, col, ch) => { b.save(); b.translate(bx2, by); b.fillStyle = col; b.strokeStyle = 'rgba(0,0,0,.25)'; b.lineWidth = 3; b.beginPath(); b.roundRect(-s / 2, -s, s, s, s * .14); b.fill(); b.stroke(); b.fillStyle = '#fff'; b.font = '900 ' + s * .62 + 'px ' + U.FONT; b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillText(ch, 0, -s / 2 + s * .04); b.restore(); };
        const s0 = H * .075; blk(W * .2, fy + s0 * .25, s0, '#ff5d73', 'A'); blk(W * .2 + s0 * 1.05, fy + s0 * .25, s0, '#4cc9ff', 'B'); blk(W * .2 + s0 * .52, fy + s0 * .25 - s0, s0, '#ffd166', 'C');
        blk(W * .8, fy + s0 * .25, s0, '#7bd389', '1'); blk(W * .8 - s0 * 1.05, fy + s0 * .25, s0, '#b98cff', '2');
        // 舞台地板：透视木板
        const fg = b.createLinearGradient(0, fy, 0, H); fg.addColorStop(0, '#b06a35'); fg.addColorStop(1, '#6f3818'); b.fillStyle = fg; b.fillRect(0, fy, W, H - fy);
        b.strokeStyle = 'rgba(60,25,5,.35)'; b.lineWidth = 2;
        for (let i = -14; i <= 14; i++) { b.beginPath(); b.moveTo(cx + i * W * .03, fy); b.lineTo(cx + i * W * .16, H); b.stroke(); }
        for (let k = 1; k < 6; k++) { const yy = fy + (H - fy) * Math.pow(k / 6, 1.6); b.beginPath(); b.moveTo(0, yy); b.lineTo(W, yy); b.stroke(); }
        b.fillStyle = '#ffd166'; b.fillRect(0, fy - 3, W, 5); b.fillStyle = 'rgba(255,209,102,.25)'; b.fillRect(0, fy + 2, W, 6);
        // 两侧红丝绒幕布
        const curtain = (x0, w, flip) => {
          const cg = b.createLinearGradient(x0, 0, x0 + w, 0);
          for (let i = 0; i <= 8; i++) cg.addColorStop(i / 8, i % 2 ? '#a3102e' : '#e0284e');
          b.fillStyle = cg; b.beginPath();
          if (!flip) { b.moveTo(x0, 0); b.lineTo(x0 + w, 0); b.quadraticCurveTo(x0 + w * .55, H * .45, x0 + w * .95, H); b.lineTo(x0, H); }
          else { b.moveTo(x0 + w, 0); b.lineTo(x0, 0); b.quadraticCurveTo(x0 + w * .45, H * .45, x0 + w * .05, H); b.lineTo(x0 + w, H); }
          b.closePath(); b.fill();
          const sh = b.createLinearGradient(x0, 0, x0 + w, 0); sh.addColorStop(flip ? 0 : 1, 'rgba(0,0,0,.45)'); sh.addColorStop(flip ? 1 : 0, 'rgba(0,0,0,0)'); b.fillStyle = sh; b.fill();
          b.fillStyle = '#ffd166'; b.beginPath(); b.ellipse(flip ? x0 + w * .3 : x0 + w * .7, H * .52, w * .18, H * .018, 0, 0, 7); b.fill();
        };
        const cw = Math.max(60, W * .085); curtain(0, cw, false); curtain(W - cw, cw, true);
        // 顶部帷幔（波浪边 + 金穗）
        const vh = H * .085, n = Math.ceil(W / (H * .12));
        b.fillStyle = '#c4183c'; b.fillRect(0, 0, W, vh * .55);
        for (let i = 0; i < n; i++) { const w = W / n; b.fillStyle = i % 2 ? '#c4183c' : '#e0284e'; b.beginPath(); b.moveTo(i * w, vh * .5); b.quadraticCurveTo(i * w + w / 2, vh * 1.35, (i + 1) * w, vh * .5); b.fill(); b.strokeStyle = '#ffd166'; b.lineWidth = 3; b.beginPath(); b.moveTo(i * w, vh * .55); b.quadraticCurveTo(i * w + w / 2, vh * 1.4, (i + 1) * w, vh * .55); b.stroke(); }
        // 彩旗串
        [[.14, .2], [.2, .27]].forEach(([y0, sag], li) => {
          const pts = 16; for (let i = 0; i < pts; i++) {
            const t0 = i / pts, t1 = (i + .7) / pts, Y = t => H * y0 + Math.sin(t * Math.PI) * H * (sag - y0) * 1.0;
            const cols = ['#ff5d73', '#ffd166', '#7bd389', '#4cc9ff', '#b98cff'];
            b.fillStyle = cols[(i + li * 2) % 5]; b.beginPath(); b.moveTo(W * t0, Y(t0)); b.lineTo(W * t1, Y(t1)); b.lineTo(W * (t0 + t1) / 2, Y((t0 + t1) / 2) + H * .045); b.closePath(); b.fill();
          }
          b.strokeStyle = 'rgba(255,255,255,.5)'; b.lineWidth = 1.5; b.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40; const yy = H * y0 + Math.sin(t * Math.PI) * H * (sag - y0); i ? b.lineTo(W * t, yy) : b.moveTo(W * t, yy); } b.stroke();
        });
        const v = b.createRadialGradient(W / 2, H * .55, H * .3, W / 2, H * .55, W * .8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)'); b.fillStyle = v; b.fillRect(0, 0, W, H);
        sparks = Array.from({ length: 34 }, () => ({ x: U.rand(.1, .9), y: U.rand(.12, .7), r: U.rand(1.5, 3.5), p: U.rand(0, 6), s: U.rand(1.5, 4) }));
      }
      function starPath(c, x0, y0, R, r, n) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; i ? c.lineTo(x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr) : c.moveTo(x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr); } c.closePath(); }
      drawBg(); addEventListener('resize', drawBg); G.onDispose(() => removeEventListener('resize', drawBg));

      let pool = { col: '255,236,170', k: 0 }; // 老师脚下光圈（做对变绿、做错变红）
      function drawStage(t) {
        const W = B.W, H = B.H;
        bx.drawImage(bg, 0, 0, W, H);
        bx.save(); bx.globalCompositeOperation = 'lighter';
        // 三束扫射追光
        [[.18, 1.0, '255,120,200'], [.5, 1.6, '255,240,200'], [.82, 1.25, '120,220,255']].forEach(([fx, sp, col], i) => {
          const ox = W * fx, oy = -H * .05, ang = Math.PI / 2 + Math.sin(t * .5 * sp + i * 2) * .35, len = H * 1.05, wd = H * .16;
          const ex = ox + Math.cos(ang) * len, ey = oy + Math.sin(ang) * len, nx = -Math.sin(ang) * wd, ny = Math.cos(ang) * wd;
          const g = bx.createLinearGradient(ox, oy, ex, ey); g.addColorStop(0, 'rgba(' + col + ',.22)'); g.addColorStop(1, 'rgba(' + col + ',0)');
          bx.fillStyle = g; bx.beginPath(); bx.moveTo(ox, oy); bx.lineTo(ex + nx, ey + ny); bx.lineTo(ex - nx, ey - ny); bx.closePath(); bx.fill();
        });
        // 闪烁小星星
        sparks.forEach(s => { const a = .5 + .5 * Math.sin(t * s.s + s.p); bx.fillStyle = 'rgba(255,255,255,' + (a * .8) + ')'; bx.beginPath(); bx.arc(s.x * W, s.y * H, s.r * a, 0, 7); bx.fill(); });
        // 老师脚下光圈
        const px = W / 2 + teachX * H * .19, py = H * .915, pr = H * .2 * (1 + pool.k * .25);
        const g = bx.createRadialGradient(px, py, 0, px, py, pr); g.addColorStop(0, 'rgba(' + pool.col + ',' + (.55 + .1 * Math.sin(t * 3) + pool.k * .3) + ')'); g.addColorStop(1, 'rgba(' + pool.col + ',0)');
        bx.fillStyle = g; bx.save(); bx.translate(px, py); bx.scale(1, .24); bx.translate(-px, -py); bx.beginPath(); bx.arc(px, py, pr, 0, 7); bx.fill(); bx.restore();
        bx.restore();
      }

      /* ---------- 中层：3D 星星老师 ---------- */
      let teacher = null, tClips = null, teachX = 0, teachTX = 0, hopT = 0, mouthT = 0, laughT = 0, popK = 0;
      const THREE = window.THREE;
      if (T3) {
        const { scene, camera, renderer } = T3; renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = true;
        camera.position.set(0, 1.45, 5.4); camera.lookAt(0, 1.2, 0);
        scene.add(new THREE.HemisphereLight(0xfff4e8, 0x6a4a9a, 1.5));
        const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(1.5, 4, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
        Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .5, far: 12 }); scene.add(key);
        const rim = new THREE.DirectionalLight(0xff8fd8, 1.1); rim.position.set(-3, 3, -3); scene.add(rim);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: .35 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
        // 正前方的镜头旋转了半圈？没有：老师面朝 +Z（镜头），她的右手在画面左边
        (G._simonTeacher || Promise.resolve(null)).then(w => {
          if (!w || G.over) return; teacher = w; teacher.scale.setScalar(.01); scene.add(w);
          try { tClips = buildClips(w); } catch (e) { console.warn('[simon] clips', e); tClips = null; }
          w.play('idle');
        });
      }
      // 程序化示范姿势（VRM 规范化骨骼：静止 = T 姿势）。方向用世界坐标写：x 负 = 画面左边，y 上，z 朝镜头
      function buildClips(w) {
        const vrm = w.vrm; if (!vrm || !vrm.humanoid) return null;
        const H = vrm.humanoid, node = n => H.getNormalizedBoneNode(n);
        const inv = vrm.scene.quaternion.clone().invert();
        const V = (a, b, c) => new THREE.Vector3(a, b, c).normalize().applyQuaternion(inv);
        const Dq = (a, b) => new THREE.Quaternion().setFromUnitVectors(a, b);
        const REST = { L: V(-1, 0, 0), R: V(1, 0, 0) }; // 画面左边那只手 = 老师的右手
        const BONE = { L: 'right', R: 'left' };
        // side：画面左 'L' / 右 'R'；up / lo：上臂、前臂方向（写成画面左边那只的方向，右边自动镜像）
        const arm = (sd, up, lo) => { const m = sd === 'L' ? 1 : -1, r = REST[sd], qU = Dq(r, V(up[0] * m, up[1], up[2])); return { [BONE[sd] + 'UpperArm']: qU, [BONE[sd] + 'LowerArm']: qU.clone().invert().multiply(Dq(r, V(lo[0] * m, lo[1], lo[2]))) }; };
        const arms = (l, r) => Object.assign(arm('L', l[0], l[1]), arm('R', (r || l)[0], (r || l)[1]));
        const DOWN = [[-.28, -1, .05], [-.18, -1, .15]], UP = [[-.18, 1, 0], [-.1, 1, .05]], V_UP = [[-.6, .85, .05], [-.5, .9, .1]];
        const leg = (sd, th, sh) => { const D = V(0, -1, 0), qU = Dq(D, V(...th)); const b = BONE[sd]; return { [b + 'UpperLeg']: qU, [b + 'LowerLeg']: qU.clone().invert().multiply(Dq(D, V(...sh))) }; };
        const spine = (a, b, c) => ({ spine: Dq(V(0, 1, 0), V(a, b, c)) });
        const mk = (name, frames) => {
          const bones = [...new Set(frames.flatMap(f => Object.keys(f[1])))].filter(n => node(n));
          const times = frames.map(f => f[0]);
          const tracks = bones.map(bn => { const vals = []; frames.forEach(f => (f[1][bn] || new THREE.Quaternion()).toArray(vals, vals.length)); return new THREE.QuaternionKeyframeTrack(node(bn).name + '.quaternion', times, vals); });
          return new THREE.AnimationClip('sm_' + name, times[times.length - 1], tracks);
        };
        const hold = (name, p) => mk(name, [[0, p], [.6, p], [1.2, p]]);
        const CLAP_A = arms([[-.55, -.3, .75], [-.6, .1, .8]]), CLAP_B = arms([[-.22, -.3, .93], [.5, .05, .9]]);
        const GUARD = arms([[-.3, -.85, .45], [.15, .6, .8]]);
        const PUN_L = Object.assign({}, GUARD, arm('L', [-.1, 0, 1], [-.05, 0, 1])), PUN_R = Object.assign({}, GUARD, arm('R', [-.1, 0, 1], [-.05, 0, 1]));
        return {
          upL: hold('upL', Object.assign(arm('L', ...UP), arm('R', ...DOWN))),
          upR: hold('upR', Object.assign(arm('R', ...UP), arm('L', ...DOWN))),
          upBoth: hold('upBoth', arms(UP)),
          tpose: hold('tpose', arms([[-1, .02, 0], [-1, .02, 0]])),
          head: hold('head', arms([[-.75, .62, .15], [.62, .72, .2]])),
          hips: hold('hips', arms([[-.55, -.75, -.25], [.6, -.72, .3]])),
          oneLeg: hold('oneLeg', Object.assign(arms([[-1, .05, 0], [-1, .1, 0]]), leg('R', [0, -.2, 1], [0, -1, -.1]))),
          clap: mk('clap', [[0, CLAP_A], [.16, CLAP_B], [.32, CLAP_A]]),
          punch: mk('punch', [[0, GUARD], [.14, PUN_R], [.36, GUARD], [.5, PUN_L], [.72, GUARD]]),
          hooray: mk('hooray', [[0, Object.assign(arms(V_UP), spine(0, 1, -.05))], [.3, Object.assign(arms([[-.75, .6, .1], [-.7, .7, .1]]), spine(0, 1, .05))], [.6, Object.assign(arms(V_UP), spine(0, 1, -.05))]]),
          laugh: mk('laugh', [[0, Object.assign({}, CLAP_A, spine(0, 1, -.22))], [.13, Object.assign({}, CLAP_B, spine(0, 1, -.12))], [.26, Object.assign({}, CLAP_A, spine(0, 1, -.22))]]),
        };
      }
      function tClip(c, speed) {
        if (!teacher || !c) return false;
        const act = teacher.mixer.clipAction(c); act.reset(); act.setLoop(THREE.LoopRepeat, Infinity); act.timeScale = speed || 1;
        if (teacher.cur && teacher.cur !== act) act.crossFadeFrom(teacher.cur, .22, false);
        act.play(); teacher.cur = act; teacher.curName = c.name; expr('happy', .5); return true;
      }
      const tPlay = (names, o) => { if (!teacher) return; const n = [].concat(names).find(k => teacher.has(k)) || 'idle'; teacher.play(n, Object.assign({ restart: true }, o || {})); };
      const expr = (k, v) => { const em = teacher && teacher.vrm && teacher.vrm.expressionManager; if (em) try { em.setValue(k, v); } catch (e) {} };
      // 老师示范某个指令（被骗指令也一样认真做，引诱你跟着动）
      function demo(k) {
        mood = 'demo'; mouthT = G.t + (EN ? 1.8 : 1.4);
        if (!teacher) return;
        const c = tClips;
        if (k === 'jump') { hopT = 1.6; if (!tClip(c && c.upBoth)) tPlay(['jump', 'wave']); return; }
        if (k === 'squat') return tPlay(['sit', 'wave']);
        if (k === 'run') return tPlay(['run']);
        if (k === 'left' || k === 'right') { teachTX = k === 'left' ? -.6 : .6; return; }
        if (c && c[k]) return void tClip(c[k], k === 'clap' ? 1.1 : 1);
        tPlay(k === 'punch' ? ['attack', 'wave'] : ['wave']);
      }
      function teacherIdle() { teachTX = 0; hopT = 0; if (teacher && teacher.curName !== 'walk') tPlay('idle'); }
      function teacherHappy() { mood = 'happy'; if (!teacher) return; if (!tClip(tClips && tClips.hooray, 1.2)) tPlay(['dance', 'cheer', 'yes', 'wave']); expr('happy', 1); hopT = .7; }
      function teacherLaugh() { mood = 'laugh'; laughT = 1.8; if (!teacher) return; if (!tClip(tClips && tClips.laugh, 1.3)) tPlay(['cheer', 'clap', 'yes', 'wave']); expr('happy', 1); }
      function teacherSad() { mood = 'sad'; if (!teacher) return; tPlay(['no', 'hit', 'idle']); }
      function updTeacher(dt) {
        if (!teacher) return;
        popK = Math.min(1, popK + dt * 2.2); const e = 1 + Math.sin(popK * Math.PI) * .12 * (1 - popK);
        teacher.scale.setScalar(Math.max(.01, popK < 1 ? (1 - Math.pow(1 - popK, 3)) * e : 1));
        // 走一步：转身走过去，到了再转回来
        const dx = teachTX - teachX, moving = Math.abs(dx) > .03;
        if (moving) { teachX += Math.sign(dx) * Math.min(Math.abs(dx), dt * 1.1); if (teacher.curName !== 'walk') tPlay('walk'); }
        else if (teacher.curName === 'walk') tPlay('idle');
        const ry = moving ? (dx < 0 ? -Math.PI / 2 : Math.PI / 2) : 0; teacher.rotation.y += (ry - teacher.rotation.y) * Math.min(1, dt * 10);
        hopT = Math.max(0, hopT - dt); laughT = Math.max(0, laughT - dt);
        teacher.position.set(teachX, hopT > 0 ? Math.abs(Math.sin(hopT * Math.PI * 2.5)) * .28 : laughT > 0 ? Math.abs(Math.sin(laughT * 14)) * .04 : 0, 0);
        expr('aa', G.t < mouthT ? (Math.sin(G.t * 21) * .5 + .5) * .7 : laughT > 0 ? .4 + Math.sin(laughT * 28) * .3 : 0);
        teacher.update(dt);
      }
      // 没有 3D 时的兜底：2D 星星老师（会眨眼、会笑）
      let mood = 'idle';
      function drawStarTeacher(t) {
        const W = C.W, H = C.H, r = H * .17, cx = W / 2 + teachX * H * .19, cy = H * .7 - (hopT > 0 ? Math.abs(Math.sin(hopT * 8)) * H * .06 : 0) + Math.sin(t * 2.5) * r * .04;
        x.save(); x.translate(cx, cy); x.rotate(Math.sin(t * 1.6) * .06 + (mood === 'laugh' ? Math.sin(t * 20) * .08 : 0));
        x.shadowColor = '#ffb020'; x.shadowBlur = r * .5;
        const g = x.createRadialGradient(-r * .2, -r * .3, r * .1, 0, 0, r); g.addColorStop(0, '#fff6b0'); g.addColorStop(.6, '#ffd23f'); g.addColorStop(1, '#ff9d00');
        x.fillStyle = g; x.lineJoin = 'round'; x.lineWidth = r * .14; x.strokeStyle = '#ffb020'; starPath(x, 0, 0, r, r * .55, 5); x.stroke(); x.fill(); x.shadowBlur = 0;
        const blink = (t % 3.2) < .12, ey = -r * .12, ex = r * .2;
        x.fillStyle = '#3a2350';
        [-1, 1].forEach(s => { x.beginPath(); if (blink || mood === 'laugh') { x.lineWidth = r * .05; x.strokeStyle = '#3a2350'; x.arc(s * ex, ey + r * .02, r * .07, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); } else { x.ellipse(s * ex, ey, r * .065, r * .09, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(s * ex + r * .02, ey - r * .03, r * .025, 0, 7); x.fill(); x.fillStyle = '#3a2350'; } });
        x.fillStyle = 'rgba(255,110,150,.55)'; [-1, 1].forEach(s => { x.beginPath(); x.ellipse(s * r * .33, r * .06, r * .08, r * .05, 0, 0, 7); x.fill(); });
        x.fillStyle = '#7a1f3d'; x.beginPath();
        if (mood === 'laugh' || mood === 'happy') { x.arc(0, r * .08, r * .16, 0, Math.PI); x.fill(); }
        else if (mood === 'sad') { x.lineWidth = r * .05; x.strokeStyle = '#7a1f3d'; x.arc(0, r * .24, r * .1, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
        else { const o = G.t < mouthT ? .5 + .5 * Math.sin(G.t * 20) : 0; x.ellipse(0, r * .12, r * .1, r * (.03 + .07 * o), 0, 0, 7); x.fill(); }
        x.restore();
      }

      /* ---------- 顶层：粒子 / 示范板 / 你的骨架 / 倒计时环 / 对话气泡 ---------- */
      const parts = []; let flash = 0, flashCol = '255,255,255', shake = 0, bubble = null;
      function burst(px, py, n, cols, sp) { for (let i = 0; i < n && parts.length < 260; i++) { const a = U.rand(0, 6.28), v = U.rand(.3, 1) * (sp || 620); parts.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 260, life: U.rand(.7, 1.3), col: U.pick(cols), s: U.rand(6, 15), rot: U.rand(0, 6), vr: U.rand(-8, 8), star: Math.random() < .6 }); } }
      function confetti(n) { for (let i = 0; i < n && parts.length < 260; i++) parts.push({ x: U.rand(0, C.W), y: -20, vx: U.rand(-60, 60), vy: U.rand(80, 260), life: U.rand(1.6, 2.6), col: U.pick(['#ff5d73', '#ffd166', '#7bd389', '#4cc9ff', '#b98cff']), s: U.rand(6, 11), rot: U.rand(0, 6), vr: U.rand(-6, 6), star: false, conf: true }); }
      function drawParts(dt) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
          if (!p.conf) { p.vy += 900 * dt; p.vx *= .985; } p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          x.save(); x.globalAlpha = Math.min(1, p.life * 1.6); x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = p.col;
          if (p.star) { starPath(x, 0, 0, p.s, p.s * .45, 5); x.fill(); } else x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
          x.restore();
        }
      }
      const panel = () => { const pw = U.clamp(C.W * .16, 140, 240); return { pw, ph: pw * 1.2, lx: C.W * .035, rx: C.W * .965 - pw, y: C.H * .4 }; };
      function board(px, py, pw, ph, col, title, prog) {
        x.save();
        x.fillStyle = 'rgba(14,10,40,.72)'; x.strokeStyle = col; x.lineWidth = 4; x.shadowColor = col; x.shadowBlur = 16;
        x.beginPath(); x.roundRect(px, py, pw, ph, 22); x.fill(); x.stroke(); x.shadowBlur = 0;
        if (prog > 0) { x.strokeStyle = '#5ee08a'; x.lineWidth = 7; x.beginPath(); x.roundRect(px, py, pw, ph, 22); x.setLineDash([Math.min(1, prog) * (pw + ph) * 2, 9999]); x.stroke(); x.setLineDash([]); }
        if (title) { x.font = '800 ' + Math.round(pw * .1) + 'px ' + U.FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; const tw = x.measureText(title).width + 24; x.fillStyle = col; x.beginPath(); x.roundRect(px + pw / 2 - tw / 2, py - pw * .07, tw, pw * .14, 999); x.fill(); x.fillStyle = '#1a1235'; x.fillText(title, px + pw / 2, py + 1); }
        x.restore();
      }
      function drawPuppet(move, px, py, pw, ph, t, col) {
        if (!M.Puppet) return; const st = M.Puppet.sample(move, t), s = Math.min(pw / 100, ph / 110) * .9;
        M.Puppet.drawPose(x, st.a, { x: px + (pw - 100 * s) / 2, y: py + (ph - 110 * s) / 2 + ph * .04, s, dx: st.dx, dy: st.dy, sl: st.sl, fist: st.fist, color: col || '#fff', glow: 10, glowColor: '#7ef9ff' });
      }
      function drawMe(p, px, py, pw, ph, col) {
        if (!p || !p.lm || !p.body) return;
        const A = p.body.A || 16 / 9, cw = (pw / ph) / A * 1.15, cx = U.clamp(p.body.x, cw / 2, 1 - cw / 2), w = pw / cw, h = ph * 1.15;
        x.save(); x.beginPath(); x.roundRect(px, py, pw, ph, 22); x.clip();
        M.Tracker.draw(x, p, { x: px - (cx - cw / 2) * w, y: py - ph * .07, w, h, color: col, lw: Math.max(4, pw / 30), glow: 14 });
        x.restore();
      }
      function ringAt(cx, cy, r, frac, label, col) {
        x.save(); x.lineCap = 'round';
        x.fillStyle = 'rgba(14,10,40,.7)'; x.beginPath(); x.arc(cx, cy, r + 8, 0, 7); x.fill();
        x.lineWidth = 9; x.strokeStyle = 'rgba(255,255,255,.15)'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
        x.strokeStyle = col; x.shadowColor = col; x.shadowBlur = 14; x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * U.clamp(frac, 0, 1)); x.stroke(); x.shadowBlur = 0;
        x.fillStyle = '#fff'; x.font = '900 ' + Math.round(r * .8) + 'px ' + U.FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, cx, cy + 2);
        x.restore();
      }
      function drawBubble() {
        if (!bubble || G.t > bubble.until) return;
        const k = Math.min(1, (G.t - bubble.t0) * 6), W = C.W, H = C.H, fs = Math.round(H * .036);
        x.save(); x.font = '900 ' + fs + 'px ' + U.FONT; const tw = x.measureText(bubble.text).width, bw = tw + fs * 1.6, bh = fs * 2.1;
        const bx0 = Math.min(W - bw - 20, W / 2 + teachX * H * .19 + H * .1), by0 = H * .5 - bh;
        x.translate(bx0, by0 + bh); x.scale(k, k); x.translate(0, -bh);
        x.fillStyle = bubble.col; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 16; x.beginPath(); x.roundRect(0, 0, bw, bh, bh / 2); x.fill();
        x.beginPath(); x.moveTo(fs * .8, bh - 2); x.lineTo(-fs * .3, bh + fs * .8); x.lineTo(fs * 1.9, bh - 2); x.fill(); x.shadowBlur = 0;
        x.fillStyle = '#2a1840'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(bubble.text, bw / 2, bh / 2 + 1);
        x.restore();
      }
      const say2 = (text, col, sec) => { bubble = { text, col: col || '#fff', t0: G.t, until: G.t + (sec || 1.6) }; };

      /* ---------- 指令卡（DOM，文字清晰） ---------- */
      const card = U.h('div', 'sm-card'); G.hudEl.appendChild(card);
      function showCard(o) {
        card.className = 'sm-card' + ((o.main.length > (EN ? 24 : 9)) ? ' long' : '');
        const badge = o.quiz ? '<div class="sm-badge quiz">' + U.E('🧠') + '<b>' + (EN ? 'Quiz' : '答题') + '</b></div>' : o.simon ? '<div class="sm-badge">' + U.E('🌟') + '<b>' + SL + '</b></div>' : '<div class="sm-badge none"><i>?</i></div>';
        card.innerHTML = badge + '<div class="sm-txt"><b>' + (o.simon ? '<em>' + SL + (EN ? ': ' : '：') + '</em>' : '') + U.esc(o.main) + '</b>' + (o.sub ? '<small>' + U.esc(o.sub) + '</small>' : '') + (o.extra || '') + '</div>' + (o.ic ? '<div class="sm-ic">' + U.E(o.ic) + '</div>' : '') + '<div class="sm-stamp"></div>';
        Core.hydrate(card); void card.offsetWidth; card.classList.add('in');
      }
      const hideCard = () => card.classList.remove('in');
      function stamp(ok, text) { card.classList.remove('ok', 'bad'); void card.offsetWidth; card.classList.add(ok ? 'ok' : 'bad'); const s = card.querySelector('.sm-stamp'); if (s) s.textContent = text; }
      const txt = k => EN ? CMDS[k].en : CMDS[k].zh;
      const subTxt = (k, simon) => EN ? (simon ? '星星说：' : '') + CMDS[k].zh : '';

      /* ---------- 局面状态 ---------- */
      let lastFail = '', round = 0, lives = LIVES, streak = 0, best = 0, trapsOK = 0, trapRun = 0, phase = 'intro', phaseEnd = 1.8, R = null, comboNext = 4;
      G.hud.hearts(lives, LIVES); G.hud.score(0);
      Core.Audio2.playMusic('happy');
      if (EN) G.say('Ready? Only move when Simon says!', 'en'); else G.say('准备好了吗？星星说才做哦');
      say2(EN ? 'Ready? 🌟' : '准备好了吗？', '#fff', 1.8);
      G.after(.2, () => { if (teacher) tPlay(['wave']); });

      const doWin = () => Math.max(2.7, 4.6 - streak * .14) + (EN ? .6 : 0);
      const restDur = () => Math.max(.75, 1.35 - streak * .04);
      function snapLm(p) { return KP.map(i => p.lm[i] && p.lm[i].v > .5 ? { x: p.lm[i].x, y: p.lm[i].y } : null); }
      function dispOf(p, s0) { const b = p.body; let s = 0, n = 0; KP.forEach((i, j) => { const a = s0[j], c = p.lm[i]; if (!a || !c || c.v < .5) return; s += Math.hypot((c.x - a.x) * b.A, c.y - a.y) / b.T; n++; }); return n ? s / n : 0; }
      function kneeLift(p) { const a = p.lm[25], c = p.lm[26]; return a && c && a.v > .5 && c.v > .5 && Math.abs(a.y - c.y) / p.body.T > .22; }
      // 开始一步：记录基线（站位、姿势、关键点）
      function baseline(p) { const b = p && p.body; R.ev = {}; R.anyEv = false; R.hold = 0; R.prog = 0; R.newPose = 0; R.dispHold = 0; R.disp = 0; R.st = G.t; R.off0 = b ? b.offset : 0; R.lane0 = b ? b.lane : 0; R.pose0 = b && b.pose ? Object.assign({}, b.pose) : {}; R.lm0 = p && p.lm ? snapLm(p) : null; }
      // 这一步的动作做到了吗
      function met(k, b, p, dt) {
        const c = CMDS[k];
        if (c.kind === 'pose') { const on = k === 'oneLeg' ? (b.pose.oneLeg || kneeLift(p)) : b.pose[c.pose]; R.hold = on ? R.hold + dt : Math.max(0, R.hold - dt * .5); R.prog = R.hold / .35; return R.hold >= .35; }
        if (c.kind === 'ev') { const ok = (R.ev[c.ev] || 0) > 0 || (k === 'squat' && b.crouch); R.prog = ok ? 1 : 0; return ok; }
        if (c.kind === 'lane') { const d = (b.offset - R.off0) * c.dir; R.prog = d / .4; return d > .4 || (b.lane === c.dir && R.lane0 !== c.dir); }
        if (c.kind === 'run') { R.prog = (R.ev.step || 0) / 4; return (R.ev.step || 0) >= 4 || b.cadence > 1.8; }
        return false;
      }
      // 不该动的时候动了吗：做了那个动作 / 触发跳蹲拍出拳 / 摆出新姿势 / 全身位移大
      function moved(k, b, p, dt) {
        if (k && met(k, b, p, dt)) return true;
        if (R.anyEv) return true;
        let nw = false; POSES.forEach(q => { if (b.pose[q] && !R.pose0[q]) nw = true; });
        R.newPose = nw ? R.newPose + dt : 0; if (R.newPose > .25) return true;
        if (R.lm0) { R.disp = dispOf(p, R.lm0); R.dispHold = R.disp > .32 ? R.dispHold + dt : 0; if (R.dispHold > .15) return true; }
        return false;
      }

      // 事件：记到当前这一步
      ['clap', 'jump', 'squat', 'punch', 'step'].forEach(ev => G.on(ev, e => {
        if (phase !== 'act' || !R) return;
        R.ev[ev] = (R.ev[ev] || 0) + 1; if (ev !== 'step') R.anyEv = true;
        if (R.kind === 'count' && ev === R.m.ev && R.simon) countTick();
      }));

      /* ---------- 出题 ---------- */
      function next() {
        if (round >= N_ROUNDS || lives <= 0) return finish();
        round++;
        const p = G.player(0);
        if (round % 5 === 4) return issueQuiz();
        if (MATH && round > 1 && Math.random() < .55) {
          const pool = MATHS.filter(m => m.g <= grade), m = U.pick(pool.length ? pool : MATHS);
          const simon = !(round > 3 && trapRun < 1 && Math.random() < .25);
          R = { kind: 'count', m, simon, count: 0, win: 5 + Math.max(0, m.n - 3) * .6, doneAt: 0 }; baseline(p);
          m.say[simon ? 0 : 1](G);
          showCard({ simon, main: m.t + '！', ic: m.ev === 'clap' ? '👏' : '🦘', extra: simon ? '<div class="sm-cnt">' + (m.ev === 'clap' ? '拍了' : '跳了') + ' <b>0</b> 下</div>' : '' });
          demo(m.ev); G.stats.total++; return go();
        }
        if (round >= comboNext && streak >= 2 && Math.random() < .45) {
          comboNext = round + 4; const co = U.pick(COMBOS);
          R = { kind: 'combo', co, steps: [co.a, co.b], i: 0, simon: true, win: doWin() + .8 }; baseline(p);
          co.say[EN ? 1 : 0](G);
          showCard({ simon: true, main: txt(co.a) + (EN ? ', then ' : '，然后') + txt(co.b), sub: EN ? '星星说：' + CMDS[co.a].zh + '，然后' + CMDS[co.b].zh : '', ic: CMDS[co.a].ic, extra: '<div class="sm-steps"><span class="on">① ' + U.esc(txt(co.a)) + '</span><span>② ' + U.esc(txt(co.b)) + '</span></div>' });
          demo(co.a); G.stats.total++; return go();
        }
        const trap = round > 2 && trapRun < 2 && Math.random() < (trapRun ? .2 : .36);
        let k = U.pick(KEYS); if (R && R.k === k) k = U.pick(KEYS);
        R = { kind: 'cmd', k, simon: !trap, win: trap ? 2.4 + (EN ? .4 : 0) : doWin() }; baseline(p);
        CMDS[k].say[(EN ? 2 : 0) + (trap ? 1 : 0)](G);
        showCard({ simon: !trap, main: txt(k), sub: subTxt(k, !trap), ic: CMDS[k].ic });
        demo(k); G.stats.total++; go();
      }
      function go() { phase = 'act'; R.t0 = G.t; R.st = G.t; G.sfx('chime', .5); pool = { col: '255,236,170', k: .4 }; }
      function issueQuiz() {
        const q = G.q({ maxCh: 2 });
        R = { kind: 'quiz', q, simon: true, win: 11, hL: 0, hR: 0 }; baseline(G.player(0));
        hideCard(); G.ask(q, { options: true, keys: ['✋左', '右✋'], colors: ['#ff5d9e', '#4cc9ff'], say: false });
        G.say(q.say).then(() => { if (R && R.q === q && phase === 'act') G.say('左边举左手，右边举右手'); });
        if (teacher) tPlay(['think', 'idle']); mood = 'idle';
        phase = 'act'; R.t0 = G.t;
      }
      function countTick() {
        R.count++; G.sfx('pop'); const pp = panel(); burst(pp.rx + pp.pw / 2, pp.y + pp.ph / 2, 10, ['#ffd166', '#ff9fe0']);
        const b = card.querySelector('.sm-cnt b'); if (b) { b.textContent = R.count; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
        if (R.count === R.m.n) R.doneAt = G.t;
        if (R.count > R.m.n) result('over');
      }

      /* ---------- 判定结果 ---------- */
      function result(type) {
        if (phase !== 'act') return;
        phase = 'fb'; const W = C.W, H = C.H, cx = W / 2 + teachX * H * .19, cy = H * .55;
        const good = type === 'ok' || type === 'safe'; R.good = good; if (!good) lastFail = type;
        if (good) {
          streak++; best = Math.max(best, streak); G.hud.combo(streak);
          const el = G.t - R.t0, fast = R.kind === 'cmd' && R.simon ? Math.round(U.clamp(1 - el / R.win, 0, 1) * 50) : 0;
          const pts = (type === 'safe' ? 150 : R.kind === 'combo' ? 200 : R.kind === 'count' ? 160 : 100) + Math.min(streak, 10) * 10 + fast;
          G.hud.add(pts); G.right(cx, cy); G.sfx('perfect'); burst(cx, cy - H * .1, 36, ['#ffd166', '#fff3a0', '#ff9fe0', '#7ef9ff']);
          flash = .5; flashCol = '255,230,150'; pool = { col: '120,255,170', k: 1 };
          if (type === 'safe') { trapsOK++; stamp(true, EN ? 'Frozen! ✓' : '定住了！✓'); G.pop(EN ? 'Not fooled! +' + pts : '没上当！+' + pts, 'perfect'); say2(EN ? 'Wow, you didn\'t move!' : '没上当，厉害！', '#c9ffd9'); if (EN) G.say('You did not move, great!', 'en'); else G.say('没上当，真厉害'); confetti(30); }
          else { stamp(true, EN ? 'Great! ✓' : '做对了！✓'); G.pop((streak >= 3 ? streak + ' 连对！' : (EN ? 'Great! ' : '棒！')) + '+' + pts, streak >= 3 ? 'combo' : 'perfect'); say2(U.pick(EN ? ['Great!', 'Super!', 'Well done!'] : ['真棒！', '好厉害！', '做得好！']), '#fff6c8', 1.2); if (streak % 3 === 0) { if (EN) G.say('Great job!', 'en'); else G.say('做得好'); } }
          if (streak === 5 || streak === 10) G.after(.9, () => { G.pop(EN ? 'Faster! ⚡' : '加速！⚡', 'combo'); if (!EN) G.say('加速啦'); else G.say('Faster!', 'en'); });
          teacherHappy();
        } else {
          streak = 0; G.hud.combo(0); lives--; G.hud.hearts(lives, LIVES); G.wrong(); shake = .8; flash = .45; flashCol = '255,80,110'; pool = { col: '255,90,120', k: 1 };
          if (type === 'caught') {
            stamp(false, EN ? 'Gotcha! 😜' : '上当啦！😜'); say2(EN ? 'Ha ha! I didn\'t say "Simon says"!' : '哈哈！我没说「星星说」哦！', '#ffe1e8', 2.2);
            if (EN) G.say('Ha ha, I did not say Simon says!', 'en'); else G.say('哈哈，我没说星星说哦');
            honk(); teacherLaugh(); G.pop(EN ? 'Gotcha!' : '被骗啦！', 'bad');
          } else if (type === 'over' || type === 'less') {
            stamp(false, (type === 'over' ? '多了' : '少了') + '，答案是 ' + R.m.n); say2('是 ' + R.m.n + ' 下哦！', '#ffe1e8', 1.8);
            if (type === 'over') G.say('数多了哦'); else G.say('数少了哦');
            teacherSad(); G.pop(type === 'over' ? '数多啦' : '数少啦', 'bad');
          } else {
            stamp(false, EN ? 'Time\'s up' : '没做到'); say2(EN ? 'Oops! Try again!' : '加油哦！', '#ffe1e8', 1.4);
            if (EN) G.say('Oops, try again!', 'en'); else G.say('没做到哦，加油');
            teacherSad(); G.pop(EN ? 'Missed!' : '没做到', 'miss');
          }
        }
        trapRun = R.simon ? 0 : trapRun + 1;
        phaseEnd = G.t + (type === 'caught' ? 2.2 : 1.4);
      }
      function quizResult(idx) {
        if (phase !== 'act') return;
        phase = 'fb'; const q = R.q, ok = idx != null && q.ch[idx] && q.ch[idx].ok, pp = panel(), W = C.W, H = C.H;
        R.pick = idx; R.good = ok;
        if (ok) { const bx0 = idx === 0 ? pp.lx + pp.pw / 2 : pp.rx + pp.pw / 2; streak++; best = Math.max(best, streak); G.hud.combo(streak); G.hud.add(120 + Math.min(streak, 10) * 10); G.right(bx0, H * .55); burst(bx0, pp.y + pp.ph / 2, 40, ['#ffd166', '#7ef9ff', '#fff']); G.pop(EN ? 'Correct! +120' : '答对啦！+120', 'perfect'); teacherHappy(); say2(EN ? 'Correct!' : '答对啦！', '#c9ffd9'); }
        else { streak = 0; G.hud.combo(0); G.wrong(); teacherSad(); G.pop(idx == null ? (EN ? 'Time\'s up' : '时间到') : (EN ? 'Not quite' : '不对哦'), 'miss'); say2(EN ? 'Answer: ' + M.Q.label(q.ch[q.ans]) : '答案是：' + M.Q.label(q.ch[q.ans]), '#ffe1e8', 2); }
        phaseEnd = G.t + 2;
      }
      function finish() {
        phase = 'end'; hideCard(); G.ask(null);
        const total = G.stats.total, cor = G.stats.correct;
        G.end({ score: G.hud.scoreV, correct: cor, total, title: lives <= 0 && lastFail === 'caught' ? (EN ? 'Simon got you!' : '被星星老师骗到啦！') : null,
          lines: [U.E('🧊') + ' 躲过陷阱 <b>' + trapsOK + '</b>', U.E('🔥') + ' 最高连对 <b>' + best + '</b>', U.E('🌟') + ' 完成指令 <b>' + Math.min(round, N_ROUNDS) + '/' + N_ROUNDS + '</b>'] });
      }
      // 搞笑音效：滑哨 + 弹簧（本地 Web Audio，合成器里没有）
      function honk() {
        const p = Core.Store.p; if (p && p.settings && p.settings.sfx === false) return;
        try {
          const c = M.Synth.ac(), t = c.currentTime + .01, out = c.createGain(); out.gain.value = .22; out.connect(c.destination);
          const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(240, t + .55);
          g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.8, t + .03); g.gain.exponentialRampToValueAtTime(.001, t + .6); o.connect(g); g.connect(out); o.start(t); o.stop(t + .62);
          const o2 = c.createOscillator(), g2 = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); o2.type = 'sine'; o2.frequency.value = 160; lfo.frequency.value = 16; lg.gain.value = 70;
          lfo.connect(lg); lg.connect(o2.frequency); g2.gain.setValueAtTime(.0001, t + .6); g2.gain.linearRampToValueAtTime(.9, t + .63); g2.gain.exponentialRampToValueAtTime(.001, t + 1.1);
          o2.connect(g2); g2.connect(out); [o2, lfo].forEach(n => { n.start(t + .6); n.stop(t + 1.15); });
        } catch (e) {}
      }

      /* ---------- 每帧 ---------- */
      G.loop((dt) => {
        const t = G.t, W = C.W, H = C.H, p = G.player(0), b = p && p.body;
        // 状态机
        if (phase === 'intro' && t >= phaseEnd) { phase = 'rest'; phaseEnd = t + .3; }
        else if (phase === 'rest' && t >= phaseEnd) next();
        else if (phase === 'fb' && t >= phaseEnd) {
          if (R && R.kind === 'quiz') G.ask(null);
          if (lives <= 0 || round >= N_ROUNDS) finish();
          else { phase = 'rest'; phaseEnd = t + restDur(); hideCard(); teacherIdle(); mood = 'idle'; }
        } else if (phase === 'act' && R && b && b.pose) {
          const el = t - R.st;
          if (R.kind === 'cmd') {
            if (R.simon) { if (met(R.k, b, p, dt)) result('ok'); else if (el > R.win) result('miss'); }
            else { if (moved(R.k, b, p, dt)) result('caught'); else if (el > R.win) result('safe'); }
          } else if (R.kind === 'combo') {
            const k = R.steps[R.i];
            if (met(k, b, p, dt)) {
              R.i++; G.sfx('good'); const sp = card.querySelectorAll('.sm-steps span');
              if (sp[R.i - 1]) { sp[R.i - 1].className = 'done'; sp[R.i - 1].textContent = '✓ ' + txt(k); }
              if (R.i >= R.steps.length) result('ok'); else { if (sp[R.i]) sp[R.i].className = 'on'; baseline(p); R.win = doWin(); demo(R.steps[R.i]); }
            } else if (el > R.win) result('miss');
          } else if (R.kind === 'count') {
            if (!R.simon) { if (moved(null, b, p, dt)) result('caught'); else if (el > 2.6) result('safe'); }
            else if (R.doneAt && t - R.doneAt > .9) result('ok');
            else if (el > R.win) result(R.count > R.m.n ? 'over' : 'less');
          } else if (R.kind === 'quiz') {
            R.hL = b.pose.upL ? R.hL + dt : Math.max(0, R.hL - dt); R.hR = b.pose.upR ? R.hR + dt : Math.max(0, R.hR - dt);
            if (R.hL > .5) quizResult(0); else if (R.hR > .5) quizResult(1); else if (el > R.win) quizResult(null);
          }
        }
        pool.k = Math.max(0, pool.k - dt * .8);

        // ---- 画 ----
        shake = Math.max(0, shake - dt * 2); flash = Math.max(0, flash - dt * 1.8);
        stageEl.style.transform = shake > 0 ? 'translate(' + (U.rand(-1, 1) * shake * 14).toFixed(1) + 'px,' + (U.rand(-1, 1) * shake * 10).toFixed(1) + 'px)' : '';
        drawStage(t);
        if (T3 && teacher) { updTeacher(dt); T3.render(); }
        x.clearRect(0, 0, W, H);
        if (!teacher) { if (hopT > 0) hopT = Math.max(0, hopT - dt); const dx = teachTX - teachX; teachX += Math.sign(dx) * Math.min(Math.abs(dx), dt * 1.1); drawStarTeacher(t); }
        const pp = panel(), act = phase === 'act' || phase === 'fb';
        if (R && R.kind === 'quiz' && act) {
          // 两块答案板：左边举左手，右边举右手
          const q = R.q;
          [0, 1].forEach(i => {
            const c = q.ch[i]; if (!c) return; const px = i ? pp.rx : pp.lx, col = i ? '#4cc9ff' : '#ff5d9e', ph = pp.ph * 1.15;
            const reveal = phase === 'fb', isOk = c.ok, picked = R.pick === i;
            board(px, pp.y - pp.ph * .1, pp.pw, ph, reveal ? (isOk ? '#5ee08a' : picked ? '#ff5d73' : '#666a80') : col, i ? (EN ? 'Right hand ✋' : '举右手 ✋') : (EN ? '✋ Left hand' : '✋ 举左手'), reveal ? 0 : (i ? R.hR : R.hL) / .5);
            x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
            const cy0 = pp.y - pp.ph * .1 + ph * .3;
            if (c.t) { const fs = Math.round(pp.pw * (c.t.length > 4 ? .16 : .24)); x.font = '900 ' + fs + 'px ' + U.FONT; x.fillText(c.t, px + pp.pw / 2, cy0); }
            else if (c.e) { const im = U.emoImg(c.e); if (im.complete && im.naturalWidth) x.drawImage(im, px + pp.pw / 2 - pp.pw * .2, cy0 - pp.pw * .2, pp.pw * .4, pp.pw * .4); }
            x.restore();
            drawPuppet(i ? 'raiseR' : 'raiseL', px + pp.pw * .2, cy0 + ph * .12, pp.pw * .6, ph * .5, t, '#fff');
          });
        } else {
          // 左：老师的示范板；右：你（实时骨架）
          const move = phase === 'act' && R ? (R.kind === 'combo' ? CMDS[R.steps[R.i]].mv : R.kind === 'count' ? (R.m.ev === 'clap' ? 'clap' : 'jump') : CMDS[R.k] ? CMDS[R.k].mv : 'idle') : phase === 'fb' && R && R.good ? 'dance' : 'freeze';
          board(pp.lx, pp.y, pp.pw, pp.ph, '#ffd166', EN ? 'Watch me' : '看示范', 0);
          drawPuppet(move, pp.lx, pp.y, pp.pw, pp.ph, t, '#fff');
          const trapNow = phase === 'act' && R && !R.simon;
          const prog = phase === 'act' && R && R.simon ? (R.kind === 'count' ? R.count / R.m.n : R.prog || 0) : 0;
          board(pp.rx, pp.y, pp.pw, pp.ph, '#7ef9ff', EN ? 'You' : '你', prog);
          drawMe(p, pp.rx, pp.y, pp.pw, pp.ph, trapNow && R.disp > .2 ? '#ff8fa0' : '#7ef9ff');
          if (phase === 'act' && R && R.kind === 'count' && R.simon) { x.save(); x.font = '900 ' + Math.round(pp.pw * .32) + 'px ' + U.FONT; x.textAlign = 'center'; x.fillStyle = '#ffd166'; x.shadowColor = '#ff9d00'; x.shadowBlur = 18; x.fillText(R.count, pp.rx + pp.pw / 2, pp.y + pp.ph * .95); x.restore(); }
        }
        // 左上倒计时环 + 第几条
        if (phase === 'act' && R) {
          const left = Math.max(0, R.win - (t - R.st)), frac = left / R.win, col = frac > .5 ? '#5ee08a' : frac > .25 ? '#ffd166' : '#ff5d73';
          ringAt(16 + 46, 78 + 50, 40, frac, String(Math.ceil(left)), col);
        }
        if (round) { x.save(); x.font = '800 18px ' + U.FONT; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.85)'; x.fillText(Math.min(round, N_ROUNDS) + ' / ' + N_ROUNDS, 62, 78 + 50 + 66); x.restore(); }
        drawBubble();
        drawParts(dt);
        if (flash > 0) { x.fillStyle = 'rgba(' + flashCol + ',' + flash * .35 + ')'; x.fillRect(0, 0, W, H); }
      });
      G.onDispose(() => { stageEl.style.transform = ''; card.remove(); });
    },
  });
})();
