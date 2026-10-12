/* 手机输入端：通过 WebSocket 连到电脑上的星星岛
   · 摄像头 / 麦克风：优先 WebRTC 局域网直连；电脑 8 秒没连上会要求改成「JPEG 图片流」兜底（画面压成 JPEG 走 WebSocket）
   · 语音识别：用手机浏览器自带的识别（需要联网），文字发给电脑
   · 遥控器：方向键 / 确定 / 返回 */
(function () {
  const $ = s => document.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const token = qs.get('t') || '';
  const secure = window.isSecureContext && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const name = (() => { const u = navigator.userAgent; if (/iPhone/.test(u)) return 'iPhone'; if (/iPad/.test(u)) return 'iPad'; const m = /Android [\d.]+; ([^;)]+?)(?: Build|\))/.exec(u); return m ? m[1].trim().slice(0, 16) : /Android/.test(u) ? '安卓手机' : '手机'; })();
  let ws = null, myId = 0, stream = null, pc = null, face = localStorage.getItem('si-face') || 'environment', mode = 'none', jpegT = 0, jpegOpt = { fps: 15, w: 480 }, wantVideo = false, wantAudio = false;
  let levelT = 0, actx = null, an = null, buf = null, rec = null, listenOn = false, listenLang = 'zh-CN', wake = null, sent = 0, sentT = Date.now();

  if (!secure) {
    $('#insecure').hidden = false;
    const hp = qs.get('s'); if (hp) { const a = $('#toHttps'); a.hidden = false; a.href = 'https://' + location.hostname + ':' + hp + '/phone/' + location.search; }
    ['#mCam', '#mMic', '#mAsr'].forEach(s => $(s).disabled = true);
  }
  if (!SR) { $('#mAsr').disabled = true; $('#mAsr small').textContent = '这个浏览器不支持'; }

  /* ---------- 连接 ---------- */
  function connect() {
    const c = $('#conn'); c.className = 'conn'; c.querySelector('span').textContent = '连接中…';
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?role=phone&t=' + encodeURIComponent(token) + '&name=' + encodeURIComponent(name));
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { c.className = 'conn ok'; c.querySelector('span').textContent = '已连接电脑'; caps(); };
    ws.onclose = e => {
      c.className = 'conn bad'; c.querySelector('span').textContent = e.code === 4001 ? '二维码过期了，请重新扫码' : '断开了，重连中…';
      closePC(); if (e.code !== 4001) setTimeout(connect, 2000);
    };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } onMsg(m); };
  }
  const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const caps = () => send({ type: 'caps', video: secure, audio: secure, speech: !!SR && secure, secure, name, streaming: !!stream });

  function onMsg(m) {
    if (m.type === 'hello') { myId = m.id; return; }
    if (m.type === 'host-left') { closePC(); return; }
    if (m.type === 'want') {
      if (m.video) wantVideo = true; if (m.audio) wantAudio = true;
      if (stream && ((m.video && !stream.getVideoTracks().length) || (m.audio && !stream.getAudioTracks().length))) { ask(m.video ? '摄像头' : '麦克风'); return; }
      if (stream) { startRTC(); return; }
      ask(m.video ? '摄像头' : '麦克风');
    }
    if (m.type === 'answer' && pc) pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(err => console.warn(err));
    if (m.type === 'ice' && pc && m.c) pc.addIceCandidate(m.c).catch(() => {});
    if (m.type === 'jpeg') { jpegOpt = { fps: m.fps || 15, w: m.w || 480 }; startJPEG(); }
    if (m.type === 'listen') { listenLang = m.lang || 'zh-CN'; m.on ? startListen() : stopListen(); }
  }
  function ask(what) { const a = $('#ask'); $('#askWhat').textContent = what; a.hidden = false; a.scrollIntoView({ behavior: 'smooth' }); }
  $('#askGo').onclick = () => { $('#ask').hidden = true; startMedia(wantVideo || !wantAudio, wantAudio || true); };

  /* ---------- 采集 ---------- */
  async function startMedia(video, audio) {
    if (!secure) return;
    stopMedia();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { facingMode: { ideal: face }, width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 } } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
      });
    } catch (e) { alert('打不开' + (video ? '摄像头' : '麦克风') + '：' + (e.message || e.name)); return; }
    const v = $('#pv'); v.srcObject = stream; v.style.transform = face === 'user' ? 'scaleX(-1)' : ''; v.play().catch(() => {});
    $('#camPanel').hidden = !video; markModes();
    setupLevel();
    keepAwake();
    caps(); startRTC();
  }
  function stopMedia() { closePC(); stopJPEG(); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; mode = 'none'; badge(); }
  function markModes() {
    const hv = !!(stream && stream.getVideoTracks().length), ha = !!(stream && stream.getAudioTracks().length);
    $('#mCam').classList.toggle('on', hv); $('#mMic').classList.toggle('on', ha && !hv);
    document.querySelectorAll('[data-face]').forEach(b => b.classList.toggle('on', b.dataset.face === face));
  }
  async function startRTC() {
    if (!stream) return; closePC(); stopJPEG();
    try {
      pc = new RTCPeerConnection({ iceServers: [] }); mode = 'rtc-wait'; badge();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.onicecandidate = e => { if (e.candidate) send({ type: 'ice', c: e.candidate }); };
      pc.onconnectionstatechange = () => { if (pc && pc.connectionState === 'connected') { mode = 'rtc'; badge(); } };
      const off = await pc.createOffer(); await pc.setLocalDescription(off); send({ type: 'offer', sdp: pc.localDescription.sdp });
    } catch (e) { console.warn('WebRTC 不可用，改用图片流', e); startJPEG(); }
  }
  function closePC() { if (pc) { try { pc.close(); } catch (e) {} pc = null; } }
  // JPEG 兜底：画面缩到 480 宽、约 15 帧，WebSocket 拥堵时自动跳帧
  const cv = document.createElement('canvas'), cx = cv.getContext('2d');
  function startJPEG() {
    if (!stream || !stream.getVideoTracks().length) { mode = 'jpeg'; send({ type: 'mode', mode: 'jpeg' }); badge(); return; }
    closePC(); stopJPEG(); mode = 'jpeg'; badge(); send({ type: 'mode', mode: 'jpeg' });
    const v = $('#pv');
    jpegT = setInterval(() => {
      if (!ws || ws.readyState !== 1 || ws.bufferedAmount > 300000 || !v.videoWidth) return;
      const w = jpegOpt.w, h = Math.round(w * v.videoHeight / v.videoWidth); if (cv.width !== w) { cv.width = w; cv.height = h; }
      cx.drawImage(v, 0, 0, w, h);
      cv.toBlob(b => { if (b && ws && ws.readyState === 1) b.arrayBuffer().then(ab => { ws.send(ab); sent++; }); }, 'image/jpeg', .6);
    }, 1000 / jpegOpt.fps);
  }
  function stopJPEG() { clearInterval(jpegT); jpegT = 0; }
  function badge() { $('#vmode').textContent = { rtc: 'WebRTC 直连 ✓', 'rtc-wait': '正在直连…', jpeg: '兼容模式（图片流）', none: '未开始' }[mode] || mode; }
  // 音量（兼容模式下电脑拿不到声音，只能收到音量）
  function setupLevel() {
    if (!stream || !stream.getAudioTracks().length) return;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const s = actx.createMediaStreamSource(stream); an = actx.createAnalyser(); an.fftSize = 512; buf = new Float32Array(an.fftSize); s.connect(an); } catch (e) { an = null; }
    clearInterval(levelT); levelT = setInterval(() => { if (!an || mode === 'rtc') return; an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; const db = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-8); send({ type: 'level', v: Math.max(0, Math.min(1, (db + 58) / 46)) }); }, 66);
  }
  async function keepAwake() { try { if ('wakeLock' in navigator) { wake = await navigator.wakeLock.request('screen'); } } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && stream) keepAwake(); });

  /* ---------- 语音识别 ---------- */
  function startListen() {
    if (!SR || !secure) return; listenOn = true; showPanel('asr');
    const st = $('#listenState'); st.textContent = '🎙️ 正在听…请说出答案'; st.classList.add('on');
    if (rec) { try { rec.abort(); } catch (e) {} }
    rec = new SR(); rec.lang = listenLang; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 3;
    rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; $('#heard').textContent = t; send({ type: 'speech', text: t, final: e.results[i].isFinal, lang: listenLang }); } };
    rec.onerror = e => { send({ type: 'speech-state', state: 'error:' + e.error }); if (e.error === 'not-allowed') { listenOn = false; st.textContent = '没有麦克风权限'; } };
    rec.onend = () => { if (listenOn) setTimeout(() => { try { rec.start(); } catch (e) {} }, 150); };
    try { rec.start(); send({ type: 'speech-state', state: 'on' }); } catch (e) {}
  }
  function stopListen() { listenOn = false; const st = $('#listenState'); st.textContent = '等待电脑出题…'; st.classList.remove('on'); if (rec) { try { rec.stop(); } catch (e) {} } send({ type: 'speech-state', state: 'off' }); }
  const hold = $('#holdTalk');
  hold.addEventListener('touchstart', e => { e.preventDefault(); startListen(); }); hold.addEventListener('touchend', () => setTimeout(stopListen, 600));
  hold.addEventListener('mousedown', startListen); hold.addEventListener('mouseup', () => setTimeout(stopListen, 600));

  /* ---------- 面板 ---------- */
  function showPanel(p) { $('#camPanel').hidden = p !== 'cam' && !(stream && stream.getVideoTracks().length); $('#asrPanel').hidden = p !== 'asr'; $('#padPanel').hidden = p !== 'pad'; document.querySelectorAll('.mode').forEach(b => b.classList.remove('sel')); }
  $('#mCam').onclick = () => { wantVideo = true; showPanel('cam'); startMedia(true, true); };
  $('#mMic').onclick = () => { wantAudio = true; startMedia(false, true); };
  $('#mAsr').onclick = () => { showPanel('asr'); $('#mAsr').classList.add('on'); };
  $('#mPad').onclick = () => { showPanel('pad'); $('#mPad').classList.add('on'); };
  document.querySelectorAll('[data-face]').forEach(b => b.onclick = () => { face = b.dataset.face; localStorage.setItem('si-face', face); startMedia(true, true); });
  $('#stopCam').onclick = () => { stopMedia(); $('#camPanel').hidden = true; markModes(); caps(); send({ type: 'mode', mode: 'none' }); };
  document.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { send({ type: 'key', key: b.dataset.k }); if (navigator.vibrate) navigator.vibrate(15); }));

  setInterval(() => { const dt = (Date.now() - sentT) / 1000; $('#stat').textContent = '编号 ' + (myId || '-') + ' · ' + name + (mode === 'jpeg' ? ' · 发送 ' + (sent / dt).toFixed(0) + ' 帧/秒' : '') + (secure ? '' : ' · 非安全地址'); sent = 0; sentT = Date.now(); }, 2000);
  connect();
})();
