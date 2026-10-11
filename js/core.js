/* 核心：存档、音效、语音、表情图片、界面工具 */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 存档 ---------- */
  const KEY = 'star-island-save-v1';
  const Store = {
    db: null,
    load() { try { this.db = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { this.db = null; } if (!this.db) this.db = { cur: null, profiles: {} }; return this.db; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.db)); } catch (e) { console.warn('save failed', e); } },
    get p() { return this.db.profiles[this.db.cur] || null; },
    newProfile(name, grade, hero) {
      const id = 'p' + Date.now();
      this.db.profiles[id] = {
        id, name, grade, hero, created: Date.now(), lv: 1, xp: 0, coins: 50, gems: {}, dragon: false,
        stars: {}, plays: {}, stats: {}, wrong: [], pet: null, eggs: 1, petsOwned: [], inv: { food: { '🍎': 3 }, potion: 1 },
        owned: [], equip: {}, stickers: {}, daily: null, signed: [], boss: {}, room: [], badges: [],
        settings: { music: true, sfx: true, voice: true, limit: 30, theme: 'auto' }, playtime: { date: today(), ms: 0 }, totalGames: 0,
      };
      this.db.cur = id; this.save(); return this.db.profiles[id];
    },
    exportJSON() { return JSON.stringify(this.db); },
    importJSON(s) { const d = JSON.parse(s); if (!d || !d.profiles) throw new Error('bad'); this.db = d; this.save(); },
  };

  /* ---------- 音频仓库：预加载时把音频整份下载进内存，之后播放不再走网络（断网也能用） ----------
     · raw：压缩的 mp3 字节；blob：给 <audio> 用的内存地址；buf：Web Audio 解码结果（音效常驻，语音用完即弃） */
  const Bank = {
    ctx: null, raw: new Map(), blob: new Map(), buf: new Map(), jobs: new Map(),
    http: /^https?:$/.test(location.protocol) && !!window.fetch,
    ac() {
      if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) try { this.ctx = new C(); } catch (e) { this.ctx = null; } }
      return this.ctx;
    },
    unlock() { const c = this.ac(); if (c && c.state !== 'running') c.resume().catch(() => {}); },
    has(url) { return this.raw.has(url); },
    load(url) {
      if (this.raw.has(url)) return Promise.resolve(true);
      if (!this.http) return Promise.resolve(true); // 双击 index.html 打开时文件都在本地，不需要预载
      if (this.jobs.has(url)) return this.jobs.get(url);
      const p = (this.http ? fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(ab => { this.raw.set(url, ab); return true; })
        : Promise.resolve(true)).catch(e => typeof e === 'number' && e >= 400 && e < 500 ? 'miss' : false).then(ok => { this.jobs.delete(url); return ok; });
      this.jobs.set(url, p); return p;
    },
    src(url) {
      if (this.blob.has(url)) return this.blob.get(url);
      const ab = this.raw.get(url); if (!ab) return url;
      const u = URL.createObjectURL(new Blob([ab], { type: 'audio/mpeg' })); this.blob.set(url, u); return u;
    },
    // 解码；去掉首尾静音，记下有声区间，拼接时首尾相接不留空白
    decode(url, keep) {
      const c = this.ac(), b = this.buf.get(url); if (b) return Promise.resolve(b);
      const ab = this.raw.get(url); if (!c || !ab) return Promise.resolve(null);
      return new Promise(res => {
        const ok = d => { const ch = d.getChannelData(0), th = .012, n = ch.length; let i = 0, j = n - 1; while (i < n && Math.abs(ch[i]) < th) i++; while (j > i && Math.abs(ch[j]) < th) j--;
          d.lead = Math.max(0, i / d.sampleRate - .012); d.tail = Math.min(d.duration, j / d.sampleRate + .045);
          if (keep) this.buf.set(url, d); else { this.buf.set(url, d); this.lru(url); } res(d); };
        try { const pr = c.decodeAudioData(ab.slice(0), ok, () => res(null)); if (pr && pr.catch) pr.catch(() => res(null)); } catch (e) { res(null); }
      });
    },
    // 朗读总线：音量可调到 2 倍，后面接一个限幅器，放大了也不破音
    bus: null,
    voiceBus() {
      const c = this.ac(); if (!c) return null;
      if (!this.bus) { try { const g = c.createGain(), lim = c.createDynamicsCompressor(); lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .2; g.connect(lim); lim.connect(c.destination); this.bus = g; } catch (e) { return null; } }
      this.bus.gain.value = vol('voice') * 2.2; return this.bus;
    },
    lruList: [],
    lru(url) { this.lruList.push(url); while (this.lruList.length > 80) this.buf.delete(this.lruList.shift()); },
  };
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, () => Bank.unlock(), true));

  /* ---------- 音效与音乐 ---------- */
  const SFX_ALIAS = { back: 'close', switch: 'click', scroll: 'whoosh' }; // 没有单独素材的音效
  // 各首背景音乐的响度不一样（最多差 7 dB），按实测响度拉平到同一水平
  const MUSIC_GAIN = { happy: .75, frog: 1, magic: .54, quaint: .74, smore: .55, summer: .46, battle: .63, town: .87, cave: .74, race: .93, drive: .48 };
  // 齿轮设置里小朋友自己可调的三路音量（0-100），默认：音乐偏小、朗读偏大
  const VOL_DEF = { music: 50, voice: 90, sfx: 70 };
  const vol = k => { const p = Store.p, v = p && p.settings.vol && p.settings.vol[k]; return (v == null ? VOL_DEF[k] : v) / 100; };
  const Audio2 = {
    cache: {}, music: null, musicName: null, unlocked: false, ducked: false,
    VOL_DEF, vol,
    musicLevel() { return vol('music') * .7 * (MUSIC_GAIN[this.musicName] || .7) * (this.ducked ? .3 : 1); },
    // 音乐音量：接了 Web Audio 音量节点就调节点（iPhone 上 <audio>.volume 是只读的，永远是 1），否则调 volume
    level(a, v) { if (a._g) a._g.gain.value = v; else a.volume = Math.min(1, v); },
    setVol(k, v) { const p = Store.p; if (!p) return; p.settings.vol = Object.assign({}, p.settings.vol, { [k]: Math.max(0, Math.min(100, Math.round(v))) }); Store.save(); if (k === 'music' && this.music) this.level(this.music, this.musicLevel()); if (k === 'voice') Bank.voiceBus(); },
    sfx(name, vol0) {
      const p = Store.p; if (p && !p.settings.sfx) return;
      name = SFX_ALIAS[name] || name;
      const url = 'assets/sfx/' + name + '.mp3', c = Bank.ctx, b = Bank.buf.get(url);
      const v = Math.min(1, (vol0 == null ? .6 : vol0) * vol('sfx') / .7);
      if (!v) return;
      if (b && c && c.state === 'running') { try { const s = c.createBufferSource(), g = c.createGain(); g.gain.value = v; s.buffer = b; s.connect(g); g.connect(c.destination); s.start(); return; } catch (e) {} }
      if (Bank.has(url) && c && !b) Bank.decode(url, true);
      try { const a = new Audio(Bank.src(url)); a.volume = v; a.play().catch(() => {}); } catch (e) {}
    },
    playMusic(name) {
      const p = Store.p; this.musicName = name;
      if (p && !p.settings.music) { this.stopMusic(); return; }
      if (this.music && this.music.dataset.n === name) { if (this.music.paused) this.music.play().catch(() => {}); return; }
      this.stopMusic();
      const url = 'assets/music/' + name + '.mp3';
      // 先整份下载进内存再播，之后循环播放和断网都不受影响
      if (Bank.http && !Bank.has(url)) { Bank.load(url).then(ok => { if (ok && this.musicName === name && !this.music) this.playMusic(name); }); return; }
      const a = new Audio(Bank.src(url)); a.loop = true; a.dataset.n = name; this.music = a;
      const c = Bank.ac();
      if (c && Bank.has(url)) try { const s = c.createMediaElementSource(a), g = c.createGain(); g.gain.value = 0; s.connect(g); g.connect(c.destination); a._s = s; a._g = g; } catch (e) {}
      if (!a._g) a.volume = 0;
      a.play().then(() => this.fade(a, this.musicLevel())).catch(() => {});
    },
    fade(a, to) { const st = a._g ? a._g.gain.value : a.volume, t0 = performance.now(); const f = () => { if (a !== this.music) return; const k = Math.min(1, (performance.now() - t0) / 900); this.level(a, st + (to - st) * k); if (k < 1) requestAnimationFrame(f); }; f(); },
    // 朗读时把音乐压低，读完恢复
    duck(on) { this.ducked = !!on; if (this.music) this.level(this.music, this.musicLevel()); },
    stopMusic() { const a = this.music; if (!a) return; a.pause(); if (a._s) try { a._s.disconnect(); a._g.disconnect(); } catch (e) {} this.music = null; },
  };

  /* ---------- 语音：只用预生成的 edge-tts 真人感录音，不用浏览器机器朗读 ----------
     · 整句有录音就整句播；否则按小句 / 数字拆成预录片段，用 Web Audio 去掉片段首尾静音后首尾相接，听起来是连贯的一句
     · 缺录音的部分直接跳过（不出机械音）
     · say() 返回的 Promise 一定会结束：播完、被下一句打断、出错或超时都会 resolve，调用方 await 不会卡死 */
  const Voice = {
    tok: 0, end: null, nodes: [],
    key(text, lang) { return (lang || 'zh') + '|' + text; },
    file(text, lang) { return window.VOICE && window.VOICE[this.key(text, lang)]; },
    has(text, lang) { return !!this.file(text, lang) || this.plan(String(text), lang || 'zh').some(it => it.f); },
    url(f) { return 'assets/voice/' + f + '.mp3'; },
    // 这句话要用到的全部音频地址（预加载用）
    urls(text, lang) { return this.plan(String(text), lang || 'zh').filter(it => it.f).map(it => this.url(it.f)); },
    stop() {
      this.tok++;
      this.nodes.forEach(n => { try { if (n.stop) n.stop(); else { n.pause(); n.removeAttribute('src'); } } catch (e) {} }); this.nodes = [];
      const e = this.end; this.end = null; if (e) e();
      Audio2.duck(false);
    },
    plan(text, lang) {
      const f = this.file(text, lang) || (lang !== 'en' && window.VSEG && /\d/.test(text) && this.file(VSEG.norm(text), lang)); if (f) return [{ f }];
      if (!window.VSEG || lang === 'en') return [];
      const out = [];
      VSEG.pieces(text).forEach(x => {
        if (x.gap) { if (out.length) out.push({ gap: x.gap }); return; }
        if (x.t) { const g = this.file(x.t, lang); if (g) out.push({ f: g }); return; }
        const fs = VSEG.numKeys(x.n, x.liang).map(k => this.file(k, lang));
        if (fs.length && fs.every(Boolean)) fs.forEach(g => out.push({ f: g }));
      });
      while (out.length && out[out.length - 1].gap) out.pop();
      return out;
    },
    say(text, lang) {
      const p = Store.p; if (!text || (p && !p.settings.voice)) return Promise.resolve();
      lang = lang || 'zh'; this.stop();
      const tok = this.tok, items = this.plan(String(text), lang);
      if (!items.some(it => it.f)) return Promise.resolve();
      Audio2.duck(true);
      return new Promise(resolve => {
        let fin = false, guard = 0;
        const done = () => { if (fin) return; fin = true; clearTimeout(guard); if (tok === this.tok) { this.end = null; this.nodes = []; Audio2.duck(false); } resolve(); };
        this.end = done;
        guard = setTimeout(done, 60000); // 兜底：任何情况下都不会一直挂着
        const live = () => tok === this.tok && !fin;
        this.playWA(items, live).then(ok => ok === false && live() ? this.playEl(items, live) : null).then(done, done);
      });
    },
    // Web Audio：全部片段先解码，再按时间表首尾相接排好
    async playWA(items, live) {
      const c = Bank.ac(); if (!c || !Bank.http) return false;
      const need = items.filter(it => it.f && !Bank.has(this.url(it.f)));
      if (need.length) await Promise.race([Promise.all(need.map(it => Bank.load(this.url(it.f)))), sleep(2500)]);
      if (!live()) return true;
      if (!items.every(it => it.gap || Bank.has(this.url(it.f)))) return false;
      if (c.state !== 'running') { try { await Promise.race([c.resume(), sleep(300)]); } catch (e) {} }
      if (c.state !== 'running') return false;
      const bufs = await Promise.all(items.map(it => it.f ? Bank.decode(this.url(it.f)) : null));
      if (!live()) return true;
      if (items.some((it, i) => it.f && !bufs[i])) return false;
      const many = items.filter(it => it.f).length > 1;
      const bus = Bank.voiceBus() || c.destination;
      let t = c.currentTime + .02, last = null;
      items.forEach((it, i) => {
        if (it.gap) { t += it.gap / 1000 * .75; return; }
        const b = bufs[i], a = many ? b.lead : 0, d = (many ? b.tail : b.duration) - a;
        const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.connect(g); g.connect(bus);
        if (many) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .01); g.gain.setValueAtTime(1, t + Math.max(.01, d - .02)); g.gain.linearRampToValueAtTime(0, t + d); }
        s.start(t, a, d); this.nodes.push(s); last = s; t += d + (many ? .015 : 0);
      });
      await new Promise(r => { if (!last) return r(); last.onended = r; setTimeout(r, (t - c.currentTime) * 1000 + 400); const e = this.end; this.end = () => { r(); if (e) e(); }; });
      return true;
    },
    // 没有 Web Audio 时：<audio> 逐段播放（来源优先用内存里的音频）
    async playEl(items, live) {
      for (const it of items) {
        if (!live()) return;
        if (it.gap) { await sleep(it.gap * .75); continue; }
        await new Promise(r => {
          const a = new Audio(Bank.src(this.url(it.f))); a.volume = Math.min(1, vol('voice') * 1.25); this.nodes.push(a);
          let fin = false; const end = () => { if (!fin) { fin = true; clearTimeout(t); r(); } };
          const t = setTimeout(end, 15000); a.onended = end; a.onerror = end; a.onpause = end;
          const e = this.end; this.end = () => { end(); if (e) e(); };
          a.play().catch(end);
        });
      }
    },
  };

  /* ---------- 表情图片 ---------- */
  const emoCode = s => { const cps = Array.from(s).map(c => c.codePointAt(0).toString(16)); const z = cps.includes('200d'); return (z ? cps : cps.filter(c => c !== 'fe0f')).join('-'); };
  function theme() { return document.body.dataset.theme || 'kid'; }
  function emoSrc(ch) {
    const code = emoCode(ch), t = theme(), has3 = window.EMOJI3D && window.EMOJI3D[code];
    if (t === 'pixel' && window.EMOJIPX && window.EMOJIPX[code]) return 'assets/emoji/px/' + code + '.png';
    if (/^(kid|paper|pixel|sketch|sticker|water)$/.test(t) && (!window.EMOJITW || window.EMOJITW[code])) return 'assets/emoji/tw/' + code + '.svg';
    if (has3) return 'assets/emoji/3d/' + code + '.webp';
    return 'assets/emoji/tw/' + code + '.svg';
  }
  const E = (ch, cls) => ch ? '<img class="emo ' + (cls || '') + '" src="' + emoSrc(ch) + '" alt="' + ch + '" draggable="false" onerror="this.outerHTML=\'<span class=&quot;emo-txt ' + (cls || '') + '&quot;>' + ch + '</span>\'">' : '';
  // 渲染卡片视觉（emoji / html:）
  function vis(e, cls) {
    if (!e) return '';
    if (e.startsWith('html:')) return e.slice(5);
    return E(e, cls);
  }
  // 填充 html 片段里的动态元素：dots / 时钟 / 饼图
  function hydrate(root) {
    $$('i[data-emo]', root).forEach(i => { i.outerHTML = E(i.dataset.emo, 'dot'); });
    $$('.aclock', root).forEach(c => { if (!c.dataset.done) { c.dataset.done = 1; c.innerHTML = clockSVG(+c.dataset.h, +c.dataset.m); } });
    $$('.pie', root).forEach(c => { if (!c.dataset.done) { c.dataset.done = 1; c.innerHTML = pieSVG(+c.dataset.a, +c.dataset.b); } });
    if (window.Avatar3D && root && root.querySelector && root.querySelector('img[data-av]')) Avatar3D.hydrate(root);
  }
  function clockSVG(hh, mm, interactive) {
    let s = '<svg viewBox="0 0 200 200" class="clock-svg"><defs><radialGradient id="cf" cx=".45" cy=".4"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e9eef7"/></radialGradient></defs>';
    s += '<circle cx="100" cy="100" r="94" fill="var(--clock-rim,#ff8a5b)"/><circle cx="100" cy="100" r="84" fill="url(#cf)"/>';
    for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180, r1 = i % 5 ? 78 : 72; s += '<line x1="' + (100 + Math.sin(a) * r1) + '" y1="' + (100 - Math.cos(a) * r1) + '" x2="' + (100 + Math.sin(a) * 82) + '" y2="' + (100 - Math.cos(a) * 82) + '" stroke="#555" stroke-width="' + (i % 5 ? 1 : 3) + '" stroke-linecap="round"/>'; }
    for (let i = 1; i <= 12; i++) { const a = i * 30 * Math.PI / 180; s += '<text x="' + (100 + Math.sin(a) * 60) + '" y="' + (100 - Math.cos(a) * 60 + 7) + '" text-anchor="middle" font-size="19" font-weight="700" fill="#333" font-family="Fredoka,sans-serif">' + i + '</text>'; }
    const ha = ((hh % 12) + mm / 60) * 30, ma = mm * 6;
    s += '<g class="hand-h" transform="rotate(' + ha + ' 100 100)"><line x1="100" y1="108" x2="100" y2="54" stroke="#2b3a67" stroke-width="8" stroke-linecap="round"/></g>';
    s += '<g class="hand-m" transform="rotate(' + ma + ' 100 100)"><line x1="100" y1="112" x2="100" y2="30" stroke="#e8505b" stroke-width="5" stroke-linecap="round"/></g>';
    s += '<circle cx="100" cy="100" r="7" fill="#2b3a67"/></svg>';
    return s;
  }
  function pieSVG(a, b) {
    let s = '<svg viewBox="0 0 200 200" class="pie-svg">';
    for (let i = 0; i < b; i++) {
      const a0 = i / b * 2 * Math.PI - Math.PI / 2, a1 = (i + 1) / b * 2 * Math.PI - Math.PI / 2;
      const x0 = 100 + 86 * Math.cos(a0), y0 = 100 + 86 * Math.sin(a0), x1 = 100 + 86 * Math.cos(a1), y1 = 100 + 86 * Math.sin(a1);
      s += '<path d="M100 100 L' + x0 + ' ' + y0 + ' A86 86 0 ' + (1 / b > .5 ? 1 : 0) + ' 1 ' + x1 + ' ' + y1 + ' Z" fill="' + (i < a ? '#ffb02e' : '#fff3d6') + '" stroke="#c97a10" stroke-width="3"/>';
    }
    return s + '</svg>';
  }

  /* ---------- 界面工具 ---------- */
  const UI = {
    toast(msg, ms) { const t = h('div', 'toast', msg); $('#fx').appendChild(t); setTimeout(() => t.classList.add('out'), ms || 1800); setTimeout(() => t.remove(), (ms || 1800) + 500); },
    modal(html, opt) {
      opt = opt || {};
      const m = h('div', 'modal-bg'), box = h('div', 'modal ' + (opt.cls || ''), html);
      if (!opt.noClose) { const x = h('button', 'mclose', '✕'); x.onclick = () => close(); box.appendChild(x); }
      m.appendChild(box); $('#fx').appendChild(m);
      // 弹窗里的图片 / 3D 立绘全部就绪才显示（等待期间盖着透明遮罩，点不到下面）
      const ready = opt.instant || !window.Preload ? Promise.resolve() : null;
      let live = true;
      (ready || Promise.resolve().then(() => Preload.settleBox(box))).then(() => { if (!live) return; Audio2.sfx('open', .4); requestAnimationFrame(() => m.classList.add('in')); });
      function close(v) { live = false; m.classList.remove('in'); setTimeout(() => m.remove(), 250); Audio2.sfx('close', .3); if (opt.onClose) opt.onClose(v); }
      m.addEventListener('pointerdown', e => { if (e.target === m && !opt.noClose) close(); });
      hydrate(box);
      return { el: box, close };
    },
    confirm(msg) { return new Promise(res => { const m = UI.modal('<div class="mtitle">' + msg + '</div><div class="confirm-btns"><button class="btn ghost" data-v="0" data-key="Escape" data-say="取消">取消</button><button class="btn" data-v="1" data-key="Enter" data-say="确定">确定</button></div>', { cls: 'confirm-m' + ($('#app .screen.p3') ? ' p3m' : ''), onClose: v => res(!!v) }); $$('button[data-v]', m.el).forEach(b => b.onclick = () => m.close(b.dataset.v === '1')); Voice.say(String(msg).replace(/<[^>]+>/g, '')); }); },
    confetti(n, x, y) {
      const fx = $('#fx'); const cols = ['#ff5d73', '#ffd23f', '#3ec1d3', '#7bd389', '#a78bfa', '#ff9f43'];
      x = x == null ? innerWidth / 2 : x; y = y == null ? innerHeight / 3 : y;
      for (let i = 0; i < (n || 60); i++) {
        const c = h('i', 'conf'); c.style.background = cols[i % cols.length];
        c.style.left = x + 'px'; c.style.top = y + 'px';
        const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 320;
        c.style.setProperty('--dx', Math.cos(a) * v + 'px'); c.style.setProperty('--dy', (Math.sin(a) * v - 160) + 'px');
        c.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg'); c.style.animationDelay = Math.random() * .1 + 's';
        fx.appendChild(c); setTimeout(() => c.remove(), 1600);
      }
    },
    burst(x, y, emo, n) { // 小星星/金币飞溅
      for (let i = 0; i < (n || 8); i++) {
        const c = h('div', 'spark', E(emo || '⭐')); c.style.left = x + 'px'; c.style.top = y + 'px';
        const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 90;
        c.style.setProperty('--dx', Math.cos(a) * v + 'px'); c.style.setProperty('--dy', Math.sin(a) * v + 'px');
        $('#fx').appendChild(c); setTimeout(() => c.remove(), 900);
      }
    },
    fly(fromEl, toSel, emo, n) { // 金币飞向 HUD
      const to = $(toSel); if (!fromEl || !to) return;
      const a = fromEl.getBoundingClientRect(), b = to.getBoundingClientRect();
      for (let i = 0; i < (n || 6); i++) {
        const c = h('div', 'flyer', E(emo)); c.style.left = (a.left + a.width / 2) + 'px'; c.style.top = (a.top + a.height / 2) + 'px';
        $('#fx').appendChild(c);
        setTimeout(() => { c.style.transform = 'translate(' + (b.left - a.left - a.width / 2 + 10) + 'px,' + (b.top - a.top - a.height / 2 + 10) + 'px) scale(.5)'; c.style.opacity = .3; }, 30 + i * 70);
        setTimeout(() => { c.remove(); Audio2.sfx('coin', .25); }, 800 + i * 70);
      }
    },
  };

  /* ---------- 点读：只读题目选项的内容，不读按钮、金币等界面文字 ----------
     · 选项卡片上的 🔊（.csay）：点一下只朗读、不作答
     · 鼠标悬停在选项上一会儿就朗读（低年级默认开，家长中心可关）
     · 触屏长按选项朗读，松手不会误触 */
  // sayOf：悬停提示用的文字（只显示，不朗读）
  const sayOf = el => { if (!el) return ''; if (el.dataset.say) return el.dataset.say; const c = el.querySelector && el.querySelector('.csay'); if (c) return c.dataset.say; if (!el.matches('.btn, .dbtn, .chip, .hopt, .wd, .hm-item, .food-b, .back, .mclose, button')) return ''; if (el.matches('.choice, [data-ok], .tile, .cnode')) return ''; const t = (el.getAttribute('aria-label') || el.textContent || '').replace(/[\s✕▶◀⬅️]+/g, ' ').trim(); return t.length <= 24 ? t : ''; };
  // 可朗读的选项：自身是 🔊 或者里面带 🔊
  const readEl = el => { if (!el) return null; if (el.classList.contains('csay')) return el; return el.querySelector && el.querySelector('.csay'); };
  const ReadAloud = {
    on() { const p = Store.p; if (!p) return true; const v = p.settings.readAloud; return v == null ? p.grade <= 1 : !!v; },
    TARGET: '.csay, .choice, [data-ok], .tile, .bin, .cnode',
    init() {
      let hoverT = 0, lastEl = null, pressT = 0, pressed = null, swallow = false;
      const speak = el => { const c = readEl(el); if (!c || !c.dataset.say) return; Voice.say(c.dataset.say, c.dataset.l || 'zh'); el.classList.remove('reading'); void el.offsetWidth; el.classList.add('reading'); setTimeout(() => el.classList.remove('reading'), 900); };
      // 🔊 小喇叭：捕获阶段拦截，不触发选项本身
      ['pointerdown', 'mousedown', 'touchstart', 'click', 'pointerup'].forEach(ev => addEventListener(ev, e => {
        const c = e.target.closest && e.target.closest('.csay'); if (!c) return;
        e.stopPropagation(); if (ev !== 'touchstart') e.preventDefault();
        if (ev === 'click') speak(c);
      }, true));
      addEventListener('pointerover', e => {
        if (e.pointerType !== 'mouse') return; const el = e.target.closest && e.target.closest(this.TARGET); if (el === lastEl) return; lastEl = el; clearTimeout(hoverT);
        if (!el || !readEl(el) || !this.on()) return;
        hoverT = setTimeout(() => { if (lastEl === el && el.isConnected) speak(el); }, el.classList.contains('csay') ? 120 : 650);
      });
      addEventListener('pointerdown', e => {
        clearTimeout(hoverT); if (e.pointerType === 'mouse') return;
        const el = e.target.closest && e.target.closest(this.TARGET); if (!el || !readEl(el) || !this.on()) return;
        pressed = el; clearTimeout(pressT); pressT = setTimeout(() => { if (pressed === el) { speak(el); swallow = true; } }, 550);
      }, true);
      const up = () => { clearTimeout(pressT); pressed = null; };
      addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
      addEventListener('click', e => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
    },
  };

  /* ---------- 键盘快捷键 + 悬停提示 ----------
     数字键 1-9 选第几个选项 · Enter 确定/开始 · Esc 返回/关闭 · 元素上 data-key="h" 自定义字母键
     按钮上不显示键帽；鼠标悬停有快捷键的按钮时，提示里写出对应按键 */
  const KEYNAME = { Escape: 'Esc', Enter: 'Enter', ' ': '空格', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
  const Keys = {
    PICK: '.choice, [data-ok], .tile:not(.used), .bin, .cnode:not(.done), .hopt, .food-b',
    visible(el, loose) { if (!el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || (!loose && (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth))) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && (loose || +s.opacity > .05); },
    scope() { const ms = $$('#fx .modal-bg'); return ms.length ? ms[ms.length - 1] : $('.bd-scene.in') || $('#app'); },
    picks(scope) {
      const all = $$(this.PICK, scope).filter(el => !el.matches('.popped, .used, .matched, .done, .caught, .escape, .sink, [disabled]') && !el.closest('[data-key]') && this.visible(el));
      return all.filter(el => !all.some(o => o !== el && o.contains(el))).slice(0, 9);
    },
    explicit(scope, key) { return $$('[data-key]', scope).find(el => el.dataset.key.split(' ').some(k => k.toLowerCase() === key.toLowerCase()) && this.visible(el, true)); },
    fire(el) {
      Audio2.sfx('click', .25);
      if (el.tagName === 'BUTTON' || el.onclick) { el.click(); return; }
      const r = el.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'mouse', isPrimary: true };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); window.dispatchEvent(new PointerEvent('pointerup', o)); el.click();
    },
    init() {
      addEventListener('keydown', e => {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
        setKbm(true);
        const sc = this.scope(); if (!sc) return;
        // 大游戏自己接管键盘（WASD / 空格 / Enter）：没有题板和弹窗时只响应 Esc
        if (document.body.classList.contains('kgame') && sc.id === 'app' && !$('.ar-ask') && e.key !== 'Escape') return;
        const ex = this.explicit(sc, e.key);
        if (ex) { e.preventDefault(); this.fire(ex); return; }
        if (/^[1-9]$/.test(e.key)) { const el = this.picks(sc)[+e.key - 1]; if (el) { e.preventDefault(); this.fire(el); } return; }
        if (e.key === 'Escape') { const el = $('.mclose', sc) || (sc.id === 'app' && $$('.back', sc).find(b => this.visible(b))); if (el) { e.preventDefault(); this.fire(el); } return; }
        if (e.key === 'Enter') { const el = $$('.go, .btn.big', sc).find(b => this.visible(b)); if (el) { e.preventDefault(); this.fire(el); } }
      });
      addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setKbm(false); else if (e.pointerType === 'mouse') setKbm(true); }, true);
      // 记录每个选项 / 按钮对应的快捷键（只用于悬停提示）
      let raf = 0; const mark = () => {
        raf = 0; if (!document.body.classList.contains('kbm')) return;
        const sc = this.scope(); if (!sc) return; const ps = this.picks(sc);
        $$('[data-kc]').forEach(el => { if (!ps.includes(el) && !el.dataset.key) { delete el.dataset.kc; const k = el.querySelector(':scope > .kcap'); if (k) k.remove(); } });
        // 按钮上不画键帽，只记下快捷键，鼠标悬停时在提示里显示
        const put = (el, label) => { if (el.dataset.kc !== label) el.dataset.kc = label; };
        ps.forEach((el, i) => put(el, String(i + 1)));
        $$('[data-key]', sc).forEach(el => { if (this.visible(el)) put(el, KEYNAME[el.dataset.key.split(' ')[0]] || el.dataset.key.split(' ')[0].toUpperCase()); });
      };
      const sched = () => { if (!raf) raf = requestAnimationFrame(mark); };
      // 只在键鼠模式下监听 DOM 变化（触屏时不做任何额外工作）
      const mo = new MutationObserver(muts => { if (muts.every(m => [...m.addedNodes].every(n => n.classList && n.classList.contains('kcap')) && [...m.removedNodes].every(n => n.classList && n.classList.contains('kcap')))) return; sched(); });
      let watching = false;
      function setKbm(on) {
        if (on === document.body.classList.contains('kbm') && on === watching) return;
        document.body.classList.toggle('kbm', on);
        if (on && !watching) { mo.observe(document.body, { childList: true, subtree: true }); watching = true; sched(); }
        if (!on && watching) { mo.disconnect(); watching = false; }
      }
      this.setKbm = setKbm;
      // 悬停提示
      const tip = h('div', 'ktip'); let tipT = 0;
      addEventListener('pointerover', e => {
        if (e.pointerType !== 'mouse') return;
        const el = e.target.closest && e.target.closest('[data-kc], [data-key], .back, .mclose, .go, [data-tip]');
        clearTimeout(tipT); tip.classList.remove('show'); if (!el) return;
        const key = el.dataset.kc || (el.dataset.key && (KEYNAME[el.dataset.key.split(' ')[0]] || el.dataset.key.split(' ')[0].toUpperCase())) || (el.matches('.back, .mclose') ? 'Esc' : el.matches('.go') ? 'Enter' : '');
        const what = el.dataset.tip || sayOf(el) || (el.matches('.back') ? '返回' : el.matches('.mclose') ? '关闭' : '');
        if (!key && !el.dataset.tip) return;
        tipT = setTimeout(() => {
          if (!el.isConnected) return; if (!tip.isConnected) document.body.appendChild(tip);
          tip.innerHTML = (what ? '<span>' + esc(what) + '</span>' : '') + (key ? '<kbd>' + esc(key) + '</kbd>' : '');
          const r = el.getBoundingClientRect(); const tw = tip.offsetWidth || 120;
          tip.style.left = Math.max(6, Math.min(innerWidth - tw - 6, r.left + r.width / 2 - tw / 2)) + 'px';
          tip.style.top = (r.top > 56 ? r.top - 40 : r.bottom + 8) + 'px'; tip.classList.add('show');
        }, 260);
      });
      addEventListener('pointerdown', () => { clearTimeout(tipT); tip.classList.remove('show'); }, true);
      addEventListener('keydown', () => tip.classList.remove('show'));
    },
  };

  window.$ = $; window.$$ = $$;
  const leaveHooks = []; const onLeave = f => leaveHooks.push(f); const leave = () => leaveHooks.splice(0).forEach(f => { try { f(); } catch (e) { console.error(e); } });
  // 家长中心「放开全部限制」：等级 / 星星 / 宝石门槛和休息提醒全部跳过
  const free = () => !!(Store.p && Store.p.settings && Store.p.settings.free);
  window.Core = { h, sleep, today, esc, Store, Audio2, Bank, Voice, E, vis, hydrate, clockSVG, emoCode, emoSrc, UI, theme, onLeave, leave, ReadAloud, Keys, sayOf, free, Perf: window.Perf };
})();
