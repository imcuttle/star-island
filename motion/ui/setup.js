/* 体感设置向导：① 选输入（本机摄像头 / 手机扫码 / IP 摄像头 + 麦克风 / 语音识别）② 摆放站位（动态示意 + 实时检查）
   ③ 动作测试（骨架 + 各种动作亮灯 + 灵敏度）④ 声音测试（音量、拍手、语音识别）⑤ 光标练习 */
(function () {
  const M = window.Motion, U = M.U, UI = M.UI;
  const STEPS = [['input', '📷', '选设备'], ['place', '📐', '摆放站位'], ['move', '🤸', '动作测试'], ['voice', '🎤', '声音测试'], ['cursor', '✋', '光标练习']];

  UI.setup = function (start) {
    if (document.querySelector('.m-setup')) return;
    M.Cursor.enable(true); M.Cursor.setMode('on');
    const L = U.h('div', 'm-layer top m-setup');
    L.innerHTML = '<div class="m-sbox"><div class="m-shead"><b>' + U.E('⚙️') + ' 体感设置</b><div class="m-steps">' + STEPS.map((s, i) => '<button class="m-step" data-i="' + i + '">' + U.E(s[1]) + '<span>' + s[2] + '</span></button>').join('') + '</div><button class="mclose m-x">✕</button></div>' +
      '<div class="m-sbody"></div><div class="m-sfoot"><button class="btn ghost m-prevb">' + U.E('⬅️') + ' 上一步</button><span class="m-sstat"></span><button class="btn go m-nextb">下一步 ' + U.E('➡️') + '</button></div></div>';
    (document.querySelector('#app .screen') || document.body).appendChild(L); Core.hydrate(L);
    let idx = start ? Math.max(0, STEPS.findIndex(s => s[0] === start)) : 0, cleanup = [];
    const body = L.querySelector('.m-sbody');
    const go = i => {
      cleanup.splice(0).forEach(f => { try { f(); } catch (e) {} }); idx = Math.max(0, Math.min(STEPS.length - 1, i));
      L.querySelectorAll('.m-step').forEach((b, j) => { b.classList.toggle('on', j === idx); b.classList.toggle('done', j < idx); });
      body.innerHTML = ''; body.className = 'm-sbody s-' + STEPS[idx][0];
      PAGES[STEPS[idx][0]](body, f => cleanup.push(f));
      Core.hydrate(body);
      L.querySelector('.m-prevb').style.visibility = idx ? '' : 'hidden';
      L.querySelector('.m-nextb').innerHTML = idx === STEPS.length - 1 ? U.E('✅') + ' 完成' : '下一步 ' + U.E('➡️');
      Core.hydrate(L.querySelector('.m-sfoot'));
    };
    const close = () => { cleanup.splice(0).forEach(f => { try { f(); } catch (e) {} }); M.cfg.firstRun = false; M.save(); L.remove(); M.emit('setup-closed'); };
    L.querySelector('.m-x').onclick = close;
    L.querySelector('.m-prevb').onclick = () => go(idx - 1);
    L.querySelector('.m-nextb').onclick = () => idx === STEPS.length - 1 ? close() : go(idx + 1);
    L.querySelector('.m-steps').onclick = e => { const b = e.target.closest('.m-step'); if (b) go(+b.dataset.i); };
    const stat = L.querySelector('.m-sstat'); let lastChips = ''; const sl = M.loop(() => { if (!L.isConnected) return sl.stop(); const c = UI.chips(); if (c !== lastChips) { lastChips = c; stat.innerHTML = c; } });
    M.ensureRunning();
    go(idx);
    return { close };
  };

  const PAGES = {};
  /* ================= ① 选设备 ================= */
  PAGES.input = function (el, onClean) {
    if (M.web) return webInput(el, onClean);
    el.innerHTML = '<div class="m-cols">' +
      '<div class="m-col"><h3>' + U.E('🎥') + ' 画面从哪来？</h3><div class="m-srcs">' +
      '<div class="m-src" data-k="cam"><div class="m-src-h">' + U.E('💻') + '<b>电脑摄像头</b><small>笔记本自带或 USB 摄像头（推荐放在电视上方）</small></div><select class="m-sel cam-sel"></select></div>' +
      '<div class="m-src" data-k="phone"><div class="m-src-h">' + U.E('📱') + '<b>用手机当摄像头</b><small>手机扫码，同一个 Wi-Fi 下，画面实时传到电脑</small></div><div class="m-phones"></div></div>' +
      '<div class="m-src" data-k="ipcam"><div class="m-src-h">' + U.E('🛰️') + '<b>IP 摄像头 / 摄像头 App</b><small>兼容方案：安卓「IP 摄像头」等 App 提供的 MJPEG 地址</small></div><div class="m-ipr"><input class="m-ip" placeholder="http://192.168.1.5:8080/video" spellcheck="false"><button class="btn sm m-ipgo">连接</button></div></div>' +
      '</div><div class="m-err cam-err"></div></div>' +
      '<div class="m-col"><h3>' + U.E('📲') + ' 手机扫码连接</h3><div class="m-qr"><div class="m-qrimg"></div><div class="m-qrtxt"><div class="m-qrurl"></div><div class="m-qrsteps"></div></div></div>' +
      '<h3>' + U.E('🎤') + ' 声音从哪来？</h3><div class="m-row"><select class="m-sel mic-sel"></select></div>' +
      '<h3>' + U.E('🗣️') + ' 语音识别</h3><div class="m-opts asr"><button class="m-opt" data-v="auto"><b>自动</b><small>手机麦克风用手机识别，否则离线识别</small></button><button class="m-opt" data-v="vosk"><b>离线识别</b><small>不联网，速度快</small></button><button class="m-opt" data-v="phone"><b>手机识别</b><small>手机系统自带，需联网</small></button><button class="m-opt" data-v="off"><b>不用语音</b></button></div>' +
      '<div class="m-err mic-err"></div></div></div>';
    const camSel = el.querySelector('.cam-sel'), micSel = el.querySelector('.mic-sel');
    const fill = async () => {
      const d = await M.Input.devices(), v = M.cfg.video, a = M.cfg.audio;
      camSel.innerHTML = '<option value="">' + (d.cams.length ? '选择摄像头…' : '没有找到摄像头') + '</option>' + d.cams.map(c => '<option value="' + U.esc(c.id) + '"' + (v.kind === 'cam' && v.id === c.id ? ' selected' : '') + '>' + U.esc(c.label) + '</option>').join('');
      if (v.kind === 'cam' && !v.id && d.cams.length) camSel.value = (d.cams.find(c => M.Input.label && c.label === M.Input.label) || d.cams[0]).id;
      const phones = M.Phone.list();
      micSel.innerHTML = '<option value="cam:">电脑麦克风（默认）</option>' + d.mics.map(c => '<option value="cam:' + U.esc(c.id) + '">' + U.esc(c.label) + '</option>').join('') + phones.map(p => '<option value="phone:' + p.id + '">' + U.esc(p.name) + ' 的麦克风</option>').join('') + '<option value="none:">不用麦克风</option>';
      micSel.value = a.kind + ':' + (a.id || ''); if (!micSel.value) micSel.value = 'cam:';
      mark();
    };
    const mark = () => {
      const v = M.cfg.video; el.querySelectorAll('.m-src').forEach(s => s.classList.toggle('on', s.dataset.k === v.kind));
      el.querySelector('.cam-err').textContent = M.Input.status === 'error' ? M.Input.error : '';
      el.querySelector('.mic-err').textContent = M.Input.audioStatus === 'error' ? M.Input.audioError : '';
      el.querySelectorAll('.asr .m-opt').forEach(b => b.classList.toggle('on', b.dataset.v === M.cfg.asr));
      if (M.Input.status === 'error' && /权限/.test(M.Input.error) && M.native) { const e = el.querySelector('.cam-err'); e.innerHTML = U.esc(M.Input.error) + ' <button class="btn sm m-priv">打开系统设置</button>'; e.querySelector('.m-priv').onclick = () => M.native.openPrivacy('camera'); }
    };
    camSel.onchange = async () => { if (!camSel.value) return; M.cfg.video = { kind: 'cam', id: camSel.value }; M.save(); await M.Input.start(); mark(); };
    micSel.onchange = async () => { const [k, id] = micSel.value.split(':'); M.cfg.audio = { kind: k, id: k === 'phone' ? +id : id }; M.save(); await M.Input.startAudio(); M.Ears.attach(M.Input.audioStream); mark(); };
    el.querySelector('.m-ipgo').onclick = async () => { const u = el.querySelector('.m-ip').value.trim(); if (!/^https?:\/\//.test(u)) { el.querySelector('.cam-err').textContent = '地址要以 http:// 开头'; return; } M.cfg.video = { kind: 'ipcam', url: u }; M.save(); await M.Input.start(); mark(); };
    if (M.cfg.video.kind === 'ipcam') el.querySelector('.m-ip').value = M.cfg.video.url || '';
    el.querySelector('.asr').onclick = e => { const b = e.target.closest('.m-opt'); if (!b) return; M.cfg.asr = b.dataset.v; M.save(); mark(); };
    // 手机列表
    const phonesEl = el.querySelector('.m-phones');
    const drawPhones = () => {
      const ps = M.Phone.list();
      phonesEl.innerHTML = ps.length ? ps.map(p => '<div class="m-ph' + (M.cfg.video.kind === 'phone' && +M.cfg.video.id === p.id ? ' on' : '') + '"><span>' + U.E('📱') + ' ' + U.esc(p.name) + '<small>' + ({ rtc: 'WebRTC 直连', 'rtc-wait': '正在连接…', jpeg: '兼容模式（图片流 ' + Math.round(p.fps || 0) + ' 帧）', none: p.caps && p.caps.video === false ? '只能当遥控 / 语音' : '待命' }[p.mode] || p.mode) + '</small></span><button class="btn sm" data-ph="' + p.id + '">用它的摄像头</button></div>').join('') : '<div class="m-ph-empty">还没有手机连上，扫右边的二维码 →</div>';
      Core.hydrate(phonesEl);
    };
    phonesEl.onclick = async e => { const b = e.target.closest('[data-ph]'); if (!b) return; M.cfg.video = { kind: 'phone', id: +b.dataset.ph }; M.cfg.phoneName = (M.Phone.get(+b.dataset.ph) || {}).name || ''; M.save(); await M.Input.start(); drawPhones(); mark(); };
    // 二维码
    const qrBox = el.querySelector('.m-qrimg'), urlBox = el.querySelector('.m-qrurl');
    (async () => {
      await M.Phone.init(); const u = M.Phone.urls();
      if (!u.https.length) { qrBox.innerHTML = '<div class="m-noqr">' + U.E('📶') + '<br>电脑没有连上 Wi-Fi / 局域网</div>'; Core.hydrate(qrBox); return; }
      let i = 0; const show = async () => { const url = u.https[i]; const img = await M.Phone.qr(url); qrBox.innerHTML = img ? '<img src="' + img + '" alt="二维码">' : ''; urlBox.innerHTML = '<code>' + U.esc(url) + '</code>' + (u.https.length > 1 ? '<button class="btn sm ghost m-nextip">换一个网卡地址</button>' : ''); const nb = urlBox.querySelector('.m-nextip'); if (nb) nb.onclick = () => { i = (i + 1) % u.https.length; show(); }; };
      show();
    })();
    el.querySelector('.m-qrsteps').innerHTML = [
      ['📷', '手机相机或微信 / 浏览器扫码', 'scan'], ['⚠️', '提示「不安全 / 证书」时，点「高级」→「继续访问」（这是家里电脑自己的证书）', 'warn'], ['✅', '允许使用摄像头和麦克风，手机横放立在电视旁边', 'allow']
    ].map((s, k) => '<div class="m-qs" style="--d:' + k * .5 + 's"><div class="m-qs-ph s-' + s[2] + '"><i></i></div><span>' + U.E(s[0]) + ' ' + s[1] + '</span></div>').join('');
    drawPhones(); fill();
    const offs = [M.Phone.on('change', () => { drawPhones(); }), M.Phone.on('join', p => { fill(); Core.UI.toast(U.E('📱') + ' ' + U.esc(p.name) + ' 连上了'); Core.Audio2.sfx('star', .5); }), M.Input.on('change', mark), M.Input.on('audio', mark)];
    const ivl = setInterval(drawPhones, 1500);
    onClean(() => { offs.forEach(f => f()); clearInterval(ivl); });
  };

  /* ---------- 网页版：本机摄像头 + 手机 / 平板怎么玩的引导 ---------- */
  function webInput(el, onClean) {
    const SR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    el.innerHTML = '<div class="m-cols"><div class="m-col">' +
      '<h3>' + U.E('📷') + ' 摄像头</h3><div class="m-row"><select class="m-sel cam-sel"></select></div>' +
      (M.mobile ? '<div class="m-opts mini m-face"><button class="m-opt" data-f="user">' + U.E('🤳') + ' 前置（推荐）</button><button class="m-opt" data-f="environment">' + U.E('📷') + ' 后置</button></div>' : '') +
      '<div class="m-prev m-wprev"></div><div class="m-err cam-err"></div>' +
      '<h3>' + U.E('🎤') + ' 麦克风</h3><div class="m-row"><select class="m-sel mic-sel"></select></div>' +
      '<h3>' + U.E('🗣️') + ' 语音答题</h3><div class="m-opts asr"><button class="m-opt" data-v="auto"><b>开启</b><small>' + (SR ? '用浏览器自带的语音识别（需联网）' : '这个浏览器不支持，可以用手势答题') + '</small></button><button class="m-opt" data-v="off"><b>不用语音</b><small>只用动作和手势</small></button></div>' +
      '<div class="m-err mic-err"></div></div>' +
      '<div class="m-col m-wguide"><h3>' + U.E(M.mobile ? '📱' : '💻') + (M.mobile ? ' 用手机 / 平板玩' : ' 用电脑摄像头玩') + '</h3>' +
      '<div class="m-wsteps">' + (M.mobile ? [
        ['rot', '把手机<b>横过来</b>，用支架或靠着书本立在桌上，屏幕对着你'],
        ['dist', '往后退到<b>1.5 ~ 2 米</b>，从头到脚（至少上半身）都在画面里'],
        ['cast', '想要大屏幕：用<b>投屏</b>（iPhone「屏幕镜像」/ 安卓「无线投屏」）投到电视上，手机继续当摄像头'],
        ['awake', '插上充电器，打开声音；玩的时候屏幕会保持常亮'],
      ] : [
        ['cam', '摄像头放在屏幕正上方，对着你'],
        ['dist', '往后退到<b>2 米</b>左右，从头到脚都在画面里'],
        ['cast', '接到电视 / 投影上玩更爽，按 F 键全屏'],
      ]).map((s, i) => '<div class="m-ws" style="--d:' + i * .6 + 's"><div class="m-wsa a-' + s[0] + '"><i></i><b></b></div><span>' + s[1] + '</span></div>').join('') + '</div>' +
      '<div class="m-wnote">' + (M.wechat ? U.E('⚠️') + ' 在微信里可能打不开摄像头：点右上角「…」→「在浏览器打开」<br>' : '') +
      (M.ios ? U.E('🍎') + ' iPhone / iPad 请用 Safari 打开；第一次会弹出「允许使用摄像头」，点允许。也可以「添加到主屏幕」全屏玩' : U.E('🔒') + ' 第一次会弹出「允许使用摄像头 / 麦克风」，点允许。拒绝了的话：点地址栏左边的 🔒 →「网站设置」改成允许') + '</div></div></div>';
    const camSel = el.querySelector('.cam-sel'), micSel = el.querySelector('.mic-sel');
    const pv = UI.preview(el.querySelector('.m-wprev'), {});
    const fill = async () => {
      const d = await M.Input.devices(), v = M.cfg.video, a = M.cfg.audio;
      camSel.innerHTML = (d.cams.length ? '' : '<option value="">没有找到摄像头</option>') + d.cams.map(c => '<option value="' + U.esc(c.id) + '"' + (v.id === c.id ? ' selected' : '') + '>' + U.esc(c.label) + '</option>').join('');
      if (!v.id && M.Input.stream) { const tr = M.Input.stream.getVideoTracks()[0], st = tr && tr.getSettings && tr.getSettings(); if (st && st.deviceId) camSel.value = st.deviceId; }
      micSel.innerHTML = '<option value="cam:">默认麦克风</option>' + d.mics.map(c => '<option value="cam:' + U.esc(c.id) + '">' + U.esc(c.label) + '</option>').join('') + '<option value="none:">不用麦克风</option>';
      micSel.value = a.kind === 'none' ? 'none:' : 'cam:' + (a.id || ''); if (!micSel.value) micSel.value = 'cam:';
      mark();
    };
    const mark = () => {
      el.querySelector('.cam-err').textContent = M.Input.status === 'error' ? M.Input.error : '';
      el.querySelector('.mic-err').textContent = M.Input.audioStatus === 'error' ? M.Input.audioError : '';
      el.querySelectorAll('.asr .m-opt').forEach(b => b.classList.toggle('on', (M.cfg.asr === 'off') === (b.dataset.v === 'off')));
      el.querySelectorAll('.m-face .m-opt').forEach(b => b.classList.toggle('on', (M.cfg.video.facing || 'user') === b.dataset.f));
    };
    camSel.onchange = async () => { if (!camSel.value) return; M.cfg.video = { kind: 'cam', id: camSel.value }; M.save(); await M.Input.start(); mark(); };
    micSel.onchange = async () => { const [k, id] = micSel.value.split(':'); M.cfg.audio = { kind: k === 'none' ? 'none' : 'cam', id }; M.save(); await M.Input.startAudio(); M.Ears.attach(M.Input.audioStream); mark(); };
    el.querySelector('.asr').onclick = e => { const b = e.target.closest('.m-opt'); if (!b) return; M.cfg.asr = b.dataset.v; M.save(); mark(); };
    const face = el.querySelector('.m-face');
    if (face) face.onclick = async e => { const b = e.target.closest('.m-opt'); if (!b) return; M.cfg.video = { kind: 'cam', id: '', facing: b.dataset.f }; M.cfg.mirror = b.dataset.f === 'user'; M.save(); await M.Input.start(); fill(); };
    fill();
    const offs = [M.Input.on('change', () => { mark(); fill(); }), M.Input.on('audio', mark)];
    onClean(() => { offs.forEach(f => f()); pv.stop(); });
  }

  /* ================= ② 摆放站位 ================= */
  PAGES.place = function (el, onClean) {
    const phone = M.cfg.video.kind === 'phone', self = M.web && M.mobile;
    el.innerHTML = '<div class="m-cols"><div class="m-col m-scene">' +
      '<div class="m-room' + (self ? ' self' : '') + '"><div class="m-floor"></div><div class="m-tv"><div class="m-tvscr"><canvas data-move="dance" data-glow="#ffd166"></canvas></div>' + (phone ? '' : '<div class="m-cam"><i></i></div>') + '</div>' +
      (phone ? '<div class="m-stand"><div class="m-phonedev"><i></i></div></div>' : '') +
      '<div class="m-cone' + (phone ? ' ph' : '') + '"></div><div class="m-kid"><canvas data-move="wave"></canvas></div><div class="m-dist"><span>2 ~ 3 米</span></div><div class="m-lamp">' + U.E('💡') + '</div></div>' +
      '<ul class="m-tips">' + (self ? '<li>' + U.E('📱') + ' 手机<b>横着</b>立起来，屏幕和前置摄像头都对着你</li>' : phone ? '<li>' + U.E('📱') + ' 手机<b>横着</b>立在电视旁边，后置摄像头更清楚</li>' : '<li>' + U.E('📷') + ' 摄像头放在电视<b>正上方或正下方</b>，对着人</li>') +
      '<li>' + U.E('🧍') + ' 站在<b>离屏幕 2~3 米</b>的地方，头顶到脚都在画面里</li><li>' + U.E('💡') + ' 开灯，不要背对窗户（逆光看不清）</li><li>' + U.E('🧸') + ' 周围留出空地，挥手不碰到东西</li></ul></div>' +
      '<div class="m-col"><div class="m-prev big"></div><div class="m-checks"></div><button class="btn m-calib">' + U.E('🎯') + ' 站好别动，标定站姿（2 秒）</button></div></div>';
    const chk = el.querySelector('.m-checks');
    let okAll = false;
    const pv = UI.preview(el.querySelector('.m-prev'), { guide: true, guideOk: () => okAll });
    const stopP = M.Puppet.mountAll(el);
    const lp = M.loop(() => {
      const p = M.Tracker.main(), b = p && p.body, br = M.Input.brightness();
      const items = [
        ['camera', M.Input.live(), '摄像头有画面'],
        ['person', !!p, p ? '看到你啦' : '没看到人'],
        ['dist', b && b.dist === 'ok', !b ? '距离' : b.dist === 'near' ? '太近了，往后退一点' : b.dist === 'far' ? '太远了，往前走一点' : '距离刚好'],
        ['full', b && b.full, b && b.full ? '全身都在画面里' : '脚没进画面（只玩手部游戏也可以）'],
        ['center', b && Math.abs(b.x - .5) < .15, b && b.x < .35 ? '往右站一点' : b && b.x > .65 ? '往左站一点' : '站在中间'],
        ['light', br > 60, br > 60 ? '光线够亮' : '有点暗，开个灯吧'],
      ];
      okAll = items.slice(0, 5).every(x => x[1]);
      chk.innerHTML = items.map(x => '<div class="m-ck ' + (x[1] ? 'ok' : 'no') + '">' + (x[1] ? '✔' : '•') + ' ' + x[2] + '</div>').join('');
    });
    el.querySelector('.m-calib').onclick = async e => {
      const b = e.currentTarget; b.disabled = true; b.textContent = '保持不动… 2'; await U.sleep(1000); b.textContent = '保持不动… 1'; await U.sleep(1000);
      const ok = M.Body.calibrate(M.Tracker.main()); b.disabled = false; b.innerHTML = ok ? U.E('✅') + ' 标定好了！' : U.E('⚠️') + ' 没看到人，再试一次'; Core.hydrate(b); M.Synth.sfx(ok ? 'perfect' : 'wrong');
    };
    onClean(() => { pv.stop(); stopP(); lp.stop(); });
  };

  /* ================= ③ 动作测试 ================= */
  const TESTS = [['jump', '跳一跳', 'jump'], ['squat', '蹲下', 'squat'], ['lane', '左右移动', 'lanes'], ['punch', '出拳', 'punch'], ['swipe', '挥手（8 个方向）', 'swipe'], ['clap', '拍手', 'clap'], ['handsUp', '举起双手', 'handsUp'], ['step', '原地跑', 'run'], ['pinch', '捏手指', 'point']];
  PAGES.move = function (el, onClean) {
    el.innerHTML = '<div class="m-cols"><div class="m-col wide"><div class="m-prev big"></div><div class="m-mstat"></div></div>' +
      '<div class="m-col"><div class="m-tests">' + TESTS.map(t => '<div class="m-test" data-t="' + t[0] + '"><canvas data-move="' + t[2] + '"></canvas><b>' + t[1] + '</b><span class="m-tc">0</span><i class="m-tlast"></i></div>').join('') + '</div>' +
      '<div class="m-sens">' + [['jump', '跳跃'], ['squat', '下蹲'], ['swipe', '挥手'], ['punch', '出拳']].map(s => '<label>' + s[1] + '灵敏度<input type="range" min="0.5" max="1.8" step="0.05" data-s="' + s[0] + '" value="' + M.cfg.sens[s[0]] + '"></label>').join('') + '</div>' +
      '<div class="m-opts mini"><button class="m-opt" data-o="mirror">' + U.E('🪞') + ' 镜像画面</button><button class="m-opt" data-o="full">' + U.E('🎯') + ' 精准模型（更慢）</button><button class="m-opt" data-o="two">' + U.E('👫') + ' 识别两个人</button><button class="m-opt" data-o="fingers">' + U.E('🤏') + ' 识别手指</button><button class="m-opt" data-o="pip">' + U.E('🖼️') + ' 游戏里显示实时小人</button></div></div></div>';
    const cnt = {}, last = {};
    const flash = (k, label) => { cnt[k] = (cnt[k] || 0) + 1; const t = el.querySelector('.m-test[data-t="' + k + '"]'); if (!t) return; t.querySelector('.m-tc').textContent = cnt[k]; t.querySelector('.m-tlast').textContent = label || ''; t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit'); M.Synth.sfx('pop', .4); };
    const offs = [
      M.Body.on('jump', () => flash('jump')), M.Body.on('squat', () => flash('squat')), M.Body.on('punch', e => flash('punch', e.hand === 'L' ? '左拳' : '右拳')),
      M.Body.on('swipe', e => flash('swipe', (e.hand === 'L' ? '左手 ' : '右手 ') + M.Body.DIRS[e.dir])), M.Body.on('clap', () => flash('clap')), M.Body.on('handsUp', () => flash('handsUp')),
      M.Body.on('step', () => flash('step')), M.Body.on('pinch', e => flash('pinch', e.hand === 'L' ? '左手' : '右手')),
    ];
    let lane = 0;
    const pv = UI.preview(el.querySelector('.m-prev'), { fingers: true, after: (x, g) => {
      const p = M.Tracker.main(); if (!p || !p.body) return; const b = p.body;
      // 三条跑道线
      x.save(); x.globalAlpha = .5; x.strokeStyle = '#fff'; x.setLineDash([6 * g.d, 6 * g.d]);
      [-1, 1].forEach(s => { const lx = g.ox + (b.cx0 / b.A + s * .55 * b.T / b.A * .78) * g.dw; x.beginPath(); x.moveTo(lx, g.oy + g.dh * .55); x.lineTo(lx, g.oy + g.dh); x.stroke(); });
      x.restore();
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(g.ox + 8 * g.d, g.oy + 8 * g.d, 150 * g.d, 26 * g.d); x.fillStyle = '#fff'; x.font = 14 * g.d + 'px ' + U.FONT; x.fillText(['左道', '中间', '右道'][b.lane + 1] + (b.crouch ? ' · 蹲' : '') + (b.air ? ' · 空中' : ''), g.ox + 16 * g.d, g.oy + 26 * g.d);
      if (b.lane !== lane) { lane = b.lane; flash('lane', ['左', '中', '右'][lane + 1]); }
    } });
    const stopP = M.Puppet.mountAll(el);
    const ms = el.querySelector('.m-mstat'); const lp = M.loop(() => { const TR = M.Tracker; ms.innerHTML = '识别速度 <b>' + Math.round(TR.fps) + '</b> 帧/秒 · 每帧 ' + TR.ms.toFixed(1) + ' ms' + (TR.mode === 'worker' ? '（主线程只占 ' + TR.mainMs.toFixed(1) + ' ms）' : '') + ' · ' + (TR.delegate || '') + ' · 人数 ' + M.Tracker.people.filter(p => p && p.present).length; });
    el.querySelectorAll('input[data-s]').forEach(r => r.oninput = () => { M.cfg.sens[r.dataset.s] = +r.value; M.save(); });
    const opts = el.querySelector('.m-opts.mini');
    const markO = () => opts.querySelectorAll('.m-opt').forEach(b => b.classList.toggle('on', { mirror: M.cfg.mirror, full: M.cfg.model === 'full', two: M.Tracker.numPoses === 2, fingers: M.Tracker.needHands, pip: M.cfg.pip !== 'off' }[b.dataset.o]));
    opts.onclick = async e => {
      const b = e.target.closest('.m-opt'); if (!b) return; const o = b.dataset.o;
      if (o === 'mirror') M.cfg.mirror = !M.cfg.mirror;
      if (o === 'full') { M.cfg.model = M.cfg.model === 'full' ? 'lite' : 'full'; M.save(); await M.Tracker.configure({}); }
      if (o === 'two') await M.Tracker.configure({ people: M.Tracker.numPoses === 2 ? 1 : 2 });
      if (o === 'fingers') await M.Tracker.configure({ hands: !M.Tracker.needHands });
      if (o === 'pip') M.cfg.pip = M.cfg.pip === 'off' ? 'figure' : 'off';
      M.save(); markO();
    };
    markO();
    onClean(() => { offs.forEach(f => f()); pv.stop(); stopP(); lp.stop(); M.Tracker.configure({ people: 1, hands: false }); });
  };

  /* ================= ④ 声音测试 ================= */
  const WORDS = [['苹果', 'zh'], ['三十五', 'zh'], ['春天', 'zh'], ['开始', 'zh'], ['apple', 'en'], ['blue', 'en']];
  PAGES.voice = function (el, onClean) {
    el.innerHTML = '<div class="m-cols"><div class="m-col"><h3>' + U.E('🔊') + ' 音量</h3><div class="m-vu"><i></i><b class="m-vupeak"></b></div><div class="m-vdb"></div>' +
      '<div class="m-claps"><div><canvas data-move="clap"></canvas></div><div><b>拍拍手</b><span class="m-clapn">0</span> 次</div><div><canvas data-move="shout"></canvas></div><div><b>大声喊「哇」</b><span class="m-shoutn">0</span> 次</div></div></div>' +
      '<div class="m-col"><h3>' + U.E('🗣️') + ' 语音识别：说出下面的词</h3><div class="m-words">' + WORDS.map((w, i) => '<button class="m-word" data-i="' + i + '">' + w[0] + '</button>').join('') + '</div>' +
      '<div class="m-asr"><div class="m-asr-eng"></div><div class="m-asr-say">请说：<b class="m-target"></b></div><div class="m-asr-heard">听到：<span></span></div><div class="m-asr-res"></div></div>' +
      '<p class="m-note">离线识别第一次要加载语音模型（约 40MB，几秒钟）。手机识别需要手机联网。</p></div></div>';
    const vu = el.querySelector('.m-vu i'), pk = el.querySelector('.m-vupeak'), db = el.querySelector('.m-vdb');
    if (!M.Ears.stream && M.Input.audioStream) M.Ears.attach(M.Input.audioStream);
    const lp = M.loop(() => { vu.style.width = (M.Ears.level * 100) + '%'; pk.style.left = (M.Ears.peak * 100) + '%'; db.textContent = M.Input.audioStatus === 'live' ? Math.round(M.Ears.db) + ' dB' : M.Input.audioStatus === 'phone-level' ? '手机音量（兼容模式）' : '麦克风未连接'; });
    let nc = 0, ns = 0;
    const offs = [M.Ears.on('clap', () => { el.querySelector('.m-clapn').textContent = ++nc; M.Synth.sfx('pop'); }), M.Ears.on('shout', () => { el.querySelector('.m-shoutn').textContent = ++ns; M.Synth.sfx('magic', .5); })];
    const stopP = M.Puppet.mountAll(el);
    const eng = el.querySelector('.m-asr-eng'), heard = el.querySelector('.m-asr-heard span'), res = el.querySelector('.m-asr-res'), tgt = el.querySelector('.m-target');
    let cur = 0, h = null;
    const ask = async i => {
      cur = i; el.querySelectorAll('.m-word').forEach((b, j) => b.classList.toggle('on', j === i)); tgt.textContent = WORDS[i][0]; heard.textContent = ''; res.textContent = '';
      const e = M.Ears.pick(); eng.innerHTML = e ? '识别方式：<b>' + ({ vosk: '本机离线', phone: '手机', web: '浏览器' }[e]) + '</b>' : '没有可用的语音识别（在第一步里选择）';
      if (!e) return;
      if (e === 'vosk') { eng.innerHTML += ' · <span class="m-loading">加载模型…</span>'; const ok = await M.Ears.prepare(WORDS[i][1]); eng.querySelector('.m-loading') && (eng.querySelector('.m-loading').textContent = ok ? '就绪' : '加载失败'); }
      if (cur !== i) return;
      // 用 4 个选项做限定识别（和游戏里一样）
      const ch = U.shuffle(WORDS.filter(w => w[1] === WORDS[i][1])).slice(0, 3).map(w => ({ t: w[0] })); if (!ch.some(c => c.t === WORDS[i][0])) ch[0] = { t: WORDS[i][0] };
      const t0 = U.now();
      h = M.Ears.listen({ choices: ch, lang: WORDS[i][1], once: false, onPartial: t => { heard.textContent = t; }, onResult: r => { heard.textContent = r.text; const ok = r.idx >= 0 && ch[r.idx].t === WORDS[i][0]; res.innerHTML = ok ? U.E('✅') + ' 认出来了！（' + ((U.now() - t0) / 1000).toFixed(1) + ' 秒）' : U.E('🤔') + ' 好像不是「' + WORDS[i][0] + '」，再说一次'; Core.hydrate(res); M.Synth.sfx(ok ? 'perfect' : 'miss'); if (ok) setTimeout(() => cur === i && el.isConnected && ask((i + 1) % WORDS.length), 1400); } });
    };
    el.querySelector('.m-words').onclick = e => { const b = e.target.closest('.m-word'); if (b) ask(+b.dataset.i); };
    ask(0);
    onClean(() => { lp.stop(); offs.forEach(f => f()); stopP(); M.Ears.stop(); });
  };

  /* ================= ⑤ 光标练习 ================= */
  PAGES.cursor = function (el, onClean) {
    el.innerHTML = '<div class="m-cols"><div class="m-col"><div class="m-cdemo"><canvas data-move="cursor"></canvas></div><ul class="m-tips"><li>' + U.E('✋') + ' 举起一只手到胸前，光标就出现了</li><li>' + U.E('⭕') + ' 停在按钮上，圆圈转满就会点下去</li><li>' + U.E('👊') + ' 着急的话向前推一下手，马上就点</li><li>' + U.E('👇') + ' 手放下来，光标自己会藏起来</li></ul>' +
      '<label class="m-dwell">停留多久算点击：<input type="range" min="0.5" max="2" step="0.1" value="' + M.cfg.cursor.dwell + '"><b></b> 秒</label>' +
      '<div class="m-opts mini m-hand"><button class="m-opt" data-v="auto">两只手都行</button><button class="m-opt" data-v="R">只用右手</button><button class="m-opt" data-v="L">只用左手</button></div></div>' +
      '<div class="m-col m-bubbles"><p>用手点破这些泡泡！</p><div class="m-bfield"></div><div class="m-bscore">已点破 <b>0</b> 个</div></div></div>';
    const rng = el.querySelector('.m-dwell input'), rb = el.querySelector('.m-dwell b'); rb.textContent = M.cfg.cursor.dwell;
    rng.oninput = () => { M.cfg.cursor.dwell = +rng.value; rb.textContent = rng.value; M.save(); };
    const hand = el.querySelector('.m-hand'); const mk = () => hand.querySelectorAll('.m-opt').forEach(b => b.classList.toggle('on', b.dataset.v === M.cfg.cursor.hand)); mk();
    hand.onclick = e => { const b = e.target.closest('.m-opt'); if (!b) return; M.cfg.cursor.hand = b.dataset.v; M.save(); mk(); };
    const field = el.querySelector('.m-bfield'); let n = 0;
    const spawn = () => { const b = U.h('button', 'm-bub', U.E(U.pick(['🍎', '⭐', '🎈', '🐟', '🌸', '🍩']))); b.style.left = U.rand(8, 78) + '%'; b.style.top = U.rand(8, 70) + '%'; b.onclick = () => { b.classList.add('pop'); M.Synth.sfx('pop'); Core.UI.burst(innerWidth / 2, innerHeight / 2, '✨', 4); el.querySelector('.m-bscore b').textContent = ++n; setTimeout(() => { b.remove(); spawn(); }, 300); }; field.appendChild(b); Core.hydrate(b); };
    spawn(); spawn(); spawn();
    const stopP = M.Puppet.mountAll(el);
    onClean(stopP);
  };
})();
