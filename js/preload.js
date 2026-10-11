/* 场景预加载：切换到新场景（主地图、区域、关卡、Boss 战、家园、探索、商店……）之前，
   先把这个场景会用到的图片、音效、音乐、语音全部下载进内存 / 缓存，加载完才切过去；
   切过去以后，场景自己发起的请求（3D 模型、贴图、立绘）也要全部完成才揭开画面、才开始计时。
   · 音频整份下载进内存（Core.Bank），之后播放不再走网络，断网也能用
   · 图片下载并解码后留在内存缓存，配合 /assets/* 长缓存头，断网后同一场景里随时可再显示
   · 不会因为超时就半成品开局；真的下载失败（比如断网）才提示「重试 / 先玩着」 */
(function () {
  const { Store, UI, emoCode, emoSrc, theme, Bank, Voice } = Core;
  const ITEM_TIMEOUT = 20000, CONCURRENCY = 12;

  const img = p => 'assets/img/' + p + '.png';
  const imgs = (pre, names, suf) => names.map(n => img(pre + n + (suf || '')));
  const kidOnly = list => () => theme() === 'kid' ? list : [];
  // 各玩法引擎里由代码拼出来的图片（模板里固定写死的路径，静态扫不出来）
  const ENG_IMG = {
    platform: () => [].concat(
      ['bg/el_cloud2', 'bg/el_cloud3', 'bg/el_cloud5'].map(img),
      imgs('tile/', ['terrain_grass_block_center', 'terrain_grass_block_top', 'terrain_grass_block_top_left', 'terrain_grass_block_top_right', 'terrain_grass_block_left', 'terrain_grass_block_right',
        'bricks_brown', 'brick_brown', 'block_coin', 'block_empty', 'block_strong_empty', 'coin_gold', 'coin_gold_side', 'star', 'heart', 'fireball', 'spring', 'spring_out',
        'bush', 'grass', 'mushroom_red', 'mushroom_brown', 'rock']),
      ...['slime_normal', 'mouse', 'ladybug', 'snail'].map(k => imgs('enemy/' + k, ['_walk_a', '_walk_b', k === 'snail' ? '_shell' : k === 'slime_normal' ? '_flat' : '_rest'])),
      imgs('enemy/bee', ['_a', '_b'])),
    bird: () => [].concat(
      ['colored_grass', 'colored_desert', 'colored_shroom', 'colored_land'].map(n => 'assets/img/phys/' + n + '.jpg'),
      imgs('phys/alien', ['Green', 'Pink', 'Blue', 'Yellow', 'Beige'], '_round'), imgs('phys/', ['grass', 'dirt']),
      ...['wood', 'stone', 'glass'].map(m => imgs('phys/' + m, ['_h', '_v', '_s']))),
    fish: kidOnly(imgs('enemy/', ['fish_blue_swim_a', 'fish_yellow_swim_a', 'fish_purple_rest'])),
    ufo: kidOnly(imgs('ship/ship', ['Pink', 'Green', 'Blue', 'Yellow', 'Beige'], '_manned')),
    whack: kidOnly(imgs('char/character_', ['green', 'pink', 'purple', 'yellow', 'beige'], '_front')),
    frog: kidOnly(imgs('enemy/', ['frog_idle', 'frog_jump'])),
    feed: kidOnly([img('enemy/slime_normal_rest')]),
  };
  const SFX_ALL = ['bong', 'bump', 'click', 'close', 'coin', 'drop', 'fail', 'gem', 'hatch', 'hit', 'hurt', 'jump', 'levelup', 'magic', 'open', 'pluck', 'poof', 'pop', 'question', 'right', 'select', 'star', 'throw', 'tick', 'victory', 'whoosh', 'win', 'wrong'];
  const COMMON_SAY = ['还不对哦，再看看', '到达终点啦！', '完美通关！', '很棒！再努力一点就三星啦', '通关啦！继续加油', '别灰心，再试一次一定行！', '要退出这一局吗？', '升级啦！你现在是100级'];
  // 各场景的代码模块（静态清单见 js/scene-assets.js）和背景音乐
  const ENGINE_MODS = ['engines', 'engines2', 'engines3', 'arcade', 'arcade3d', 'platform'];
  const SCENES = {
    title: { m: ['core', 'app'], music: 'happy' },
    hub: { m: ['core', 'app', 'world3d'], music: 'happy' },
    zone: { m: ['core', 'app'] },
    game: { m: ['core', 'app'].concat(ENGINE_MODS) },
    battle: { m: ['core', 'app', 'engines'] },
    shop: { m: ['core', 'app'], music: 'town' },
    gacha: { m: ['core', 'app'] },
    album: { m: ['core', 'app'] },
    play: { m: ['core', 'app', 'playland'] },
    home: { m: ['core', 'engines', 'home', 'bond', 'sketch'], music: 'quaint' },
    explore: { m: ['core', 'engines', 'explore', 'explore3d', 'battle5', 'bond', 'sketch'], music: 'town' },
    battle5: { m: ['core', 'engines', 'battle5', 'bond'], music: 'battle' },
  };

  /* ---------- 收集资源清单 ---------- */
  const EMO_RE = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*)/gu;
  const SRC_RE = /src="(assets\/[^"'+\s]+)"/g; // 代码里拼接出来的路径（含 ' + 变量 + '）跳过
  function emojiUrl(ch) {
    const code = emoCode(ch), u = emoSrc(ch);
    if (u.includes('/tw/') && window.EMOJITW && !window.EMOJITW[code]) return null; // 没有图片，界面会退回文字
    return u;
  }
  function strings(v, out, depth) {
    if (depth > 6 || out.length > 4000) return out;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(x => strings(x, out, depth + 1));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => strings(v[k], out, depth + 1));
    return out;
  }
  const VOICE_URL = f => 'assets/voice/' + f + '.mp3';

  function base(music) {
    const p = Store.p, s = p ? p.settings : {}, list = [];
    const add = (url, kind) => url && list.push({ url, kind });
    const H = p && window.App && App.HEROES.find(x => x.id === p.hero);
    if (H && H.img) ['idle', 'front', 'walk_a', 'walk_b', 'jump', 'hit'].forEach(k => add(img(H.img + '_' + k), 'img'));
    else if (H && H.e) add(emojiUrl(H.e), 'img');
    const K = p && p.pet && window.App && App.PETS.find(x => x.id === p.pet.kind);
    if (K) add(K.img && theme() === 'kid' ? 'assets/img/' + K.img : emojiUrl(K.e), 'img');
    if (s.sfx !== false) SFX_ALL.forEach(n => add('assets/sfx/' + n + '.mp3', 'sfx'));
    if (music && s.music !== false) add('assets/music/' + music + '.mp3', 'audio');
    const B = { list, add, voiceOn: s.voice !== false };
    if (B.voiceOn) { addSay(B, COMMON_SAY.concat((window.Engines && Engines.PRAISE) || [])); for (let i = 0; i <= 100; i++) addVoiceKey(B, '#' + i); }
    return B;
  }
  function addVoiceKey(B, key, lang) { const f = window.VOICE && window.VOICE[(lang || 'zh') + '|' + key]; if (f) B.add(VOICE_URL(f), 'audio'); }
  // 要朗读的句子：整句录音，或拼接用到的全部片段
  function addSay(B, texts) { texts.forEach(t => { if (t) Voice.urls(t, 'zh').forEach(u => B.add(u, 'audio')); }); }
  function addText(B, texts) {
    texts.forEach(t => {
      (t.match(EMO_RE) || []).forEach(ch => B.add(emojiUrl(ch), 'img'));
      let m; SRC_RE.lastIndex = 0; while ((m = SRC_RE.exec(t))) B.add(m[1], 'img');
      if (/^assets\/img\/.+\.(png|jpe?g|webp|svg)$/.test(t)) B.add(t, 'img');
      if (!B.voiceOn || t.length > 200 || /[<>]/.test(t)) return;
      addVoiceKey(B, t, 'en');
      if (/[\u4e00-\u9fa5\d]/.test(t)) addSay(B, [t, '正确答案：' + t]);
    });
  }
  function addMods(B, mods) {
    const SA = window.SCENE_ASSETS || {};
    mods.forEach(k => {
      const a = SA[k]; if (!a) return;
      if (B.voiceOn) a.v.forEach(f => B.add(VOICE_URL(f), 'audio'));
      a.e.split(' ').forEach(ch => ch && B.add(emojiUrl(ch), 'img'));
      a.i.forEach(u => B.add(u, 'img'));
    });
  }

  function forScene(name, extra) {
    extra = extra || {};
    const sc = SCENES[name] || { m: ['core'] }, B = base(extra.music || sc.music);
    addMods(B, sc.m);
    if (extra.texts) addText(B, extra.texts);
    return run(B.list, extra.tasks || []);
  }
  function forGame(g, data) {
    const z = CATALOG.zone(g.zone), eng = Engines.ENGINES[g.eng];
    const tasks = (g.eng === 'kart' || g.eng === 'splat' || g.eng === 'roll') && window.Models ? [() => window.Models.ready()] : [];
    const B = base(CATALOG.gameMusic(g));
    addMods(B, SCENES.game.m);
    if (ENG_IMG[g.eng]) ENG_IMG[g.eng]().forEach(u => B.add(u, 'img'));
    addText(B, strings(data, [g.icon || '', g.name, g.name + '。' + ((window.App && App.HELP && App.HELP[g.eng]) || '')], 0).concat(eng ? [eng.toString()] : []));
    return run(B.list, tasks);
  }
  function forBattle(z, sprite, music, qs) {
    const B = base(music);
    addMods(B, SCENES.battle.m);
    if (theme() === 'kid') { B.add(img('enemy/' + sprite), 'img'); B.add(img('bg/background_color_mushrooms'), 'img'); }
    addText(B, strings(qs || [], [z.boss.e, z.boss.name + '出现了！答对题目就能攻击它！', '糊涂龙出现了！用你的智慧打败它！', '差一点点！再练练，一定能打败它！'], 0));
    return run(B.list, []);
  }

  /* ---------- 加载器 ---------- */
  const state = new Map(); // url -> Promise<boolean>
  const httpish = /^https?:$/.test(location.protocol) && !!window.fetch;
  const keep = []; // 持有已加载的 Image，留在内存缓存里
  function loadOne(url, kind) {
    if (state.has(url)) return state.get(url);
    const p = new Promise(res => {
      let t = 0;
      const end = ok => { clearTimeout(t); res(ok); };
      t = setTimeout(() => end(false), ITEM_TIMEOUT);
      if (kind === 'img') {
        const i = new Image();
        i.onload = () => { keep.push(i); (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => end(true)); };
        i.onerror = () => end(false);
        i.src = url;
      } else Bank.load(url).then(ok => { if (ok && kind === 'sfx') Bank.decode(url, true); end(ok); });
    }).then(ok => ok || !httpish ? ok : fetch(url, { method: 'HEAD', cache: 'no-store' }).then(r => r.status >= 400 && r.status < 500, () => false)) // 服务器上本来就没有的文件（404）不算失败，不拦开局
      .then(ok => { if (!ok) state.delete(url); return !!ok; }); // 下载失败（断网）的下次再试
    state.set(url, p);
    return p;
  }
  function run(items, tasks) {
    const seen = new Set(), list = items.filter(it => !seen.has(it.url) && seen.add(it.url));
    const job = { total: list.length + tasks.length, done: 0, failed: 0, finished: false, onprogress: null, bad: [] };
    const tick = ok => { job.done++; if (!ok) job.failed++; if (job.onprogress) job.onprogress(job); };
    let i = 0;
    // 单个失败的自动再试一次
    const one = it => loadOne(it.url, it.kind).then(ok => ok || loadOne(it.url, it.kind)).then(ok => { if (!ok) job.bad.push(it); tick(ok); }, () => { job.bad.push(it); tick(false); });
    const worker = () => i < list.length ? one(list[i++]).then(worker) : null;
    const all = Promise.all([].concat(
      Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker),
      tasks.map(f => Promise.resolve().then(f).then(ok => tick(ok !== false), () => tick(false)))));
    job.promise = all.then(() => {
      job.finished = true;
      if (job.failed) console.warn('[preload] ' + job.failed + '/' + job.total + ' 个资源加载失败 ' + job.bad.map(it => it.url).slice(0, 5).join(' '));
      return job;
    });
    job.retry = () => run(job.bad, []);
    return job;
  }

  /* ---------- 统一的加载层：屏幕正中间一个，切场景、开局、打开弹窗都用它（很快就加载完的不弹出） ----------
     hold() 拿一个"占用"，全部释放后才收起；切场景时上一步还没释放、下一步已经接上，进度框不会闪 */
  const Loader = (() => {
    let el = null, bar, txt, ttl, btns, showT = 0, hideT = 0, shown = 0, seq = 0;
    const holds = new Map();
    function build() {
      el = Core.h('div', 'loader', '<div class="ld-box"><div class="ld-ico">' + Core.E('⭐') + '</div><div class="ld-title"></div><div class="pl-track"><i></i></div><div class="pl-txt"></div><div class="pl-btns" hidden><button class="btn ghost pl-skip">先玩着</button><button class="btn pl-retry">重试</button></div></div>');
      bar = el.querySelector('.pl-track i'); txt = el.querySelector('.pl-txt'); ttl = el.querySelector('.ld-title'); btns = el.querySelector('.pl-btns');
    }
    function top() { let t = null; holds.forEach(v => { t = v; }); return t; }
    function paint() {
      const t = top(); if (!t || !el) return;
      ttl.textContent = t.title; bar.style.width = Math.round((t.pct == null ? .05 : t.pct) * 100) + '%'; txt.textContent = t.text || '';
      btns.hidden = !t.err; if (t.err) { el.querySelector('.pl-skip').onclick = t.err.skip; el.querySelector('.pl-retry').onclick = t.err.retry; }
    }
    function open() { showT = 0; if (!holds.size) return; if (!el) build(); if (!el.isConnected) document.body.appendChild(el); paint(); void el.offsetWidth; el.classList.add('in'); shown = performance.now(); }
    function close() { hideT = 0; if (holds.size || !el) return; el.classList.remove('in'); setTimeout(() => { if (!holds.size && el && !el.classList.contains('in')) el.remove(); }, 250); }
    function hold(title, delay) {
      const id = ++seq, t = { title, pct: null, text: '', err: null };
      holds.set(id, t); clearTimeout(hideT); hideT = 0;
      if (el && el.classList.contains('in')) paint();
      else if (!showT) showT = setTimeout(open, delay == null ? 200 : delay);
      return {
        set(pct, text) { t.pct = pct; t.text = text; t.err = null; if (top() === t) paint(); },
        fail(text, retry, skip) { t.text = text; t.err = { retry, skip }; clearTimeout(showT); open(); },
        done() {
          if (!holds.delete(id)) return; if (holds.size) return paint();
          clearTimeout(showT); showT = 0;
          if (el && el.classList.contains('in')) hideT = setTimeout(close, Math.max(120, 350 - (performance.now() - shown)));
        },
      };
    }
    return { hold, busy: () => holds.size > 0 };
  })();

  // 等 job 全部加载完再执行 go；加载期间停留在当前画面，盖一层进度框
  function gate(job, go) {
    let started = false;
    const L = Loader.hold('准备中…');
    const start = () => {
      if (started) return; started = true; job.onprogress = null;
      try { go(); } finally { L.done(); } // 先 go（下一步会接着占用加载层）再释放，进度框不闪
    };
    const upd = j => { const pct = j.total ? j.done / j.total : 1; L.set(pct, '正在加载素材 ' + Math.floor(pct * 100) + '%（' + j.done + '/' + j.total + '）'); };
    const finish = j => {
      if (!j.failed || !httpish) return start(); // 本地打开（file://）时缺的文件就是本来没有，不拦
      // 真的下载失败了（多半是断网）：让家长选择重试或先玩
      L.fail('有 ' + j.failed + ' 个素材没下载成功，请检查网络后重试', () => { job = j.retry(); job.onprogress = upd; upd(job); job.promise.then(finish); }, start);
    };
    if (job.finished) return finish(job);
    job.onprogress = upd; upd(job);
    job.promise.then(finish);
  }

  // 场景已经搭好（还没显示）：等它自己发起的所有加载（图片、模型脚本、贴图、3D 立绘）都完成
  function settle(el) {
    return new Promise(res => {
      const L = Loader.hold('场景准备中…');
      let maxP = 1;
      const timer = setInterval(() => { const n = (window.NetLoad ? NetLoad.pending() : 0) + (window.Avatar3D && Avatar3D._busy ? Avatar3D._busy() : 0); maxP = Math.max(maxP, n); L.set(.4 + .6 * (1 - n / maxP), n ? '还有 ' + n + ' 个素材' : '马上就好'); }, 120);
      const idle = () => Promise.all([window.NetLoad ? NetLoad.idle(200) : null, window.Avatar3D && Avatar3D.idle ? Avatar3D.idle() : null]);
      // 两轮：模型解析完可能又发起贴图请求
      idle().then(idle).then(() => { clearInterval(timer); res(el); L.done(); });
    });
  }

  // 弹窗：等弹窗里的图片、3D 立绘 / 模型都就绪才显示（只等它自己的内容，不等后台其他下载）
  //       带 data-nowait 的图片（比如选角色的预览动图）不等，弹窗先出来，图片下载好再淡入
  function settleBox(box) {
    return new Promise(res => {
      const t0 = performance.now(); let L = null, maxN = 1;
      const fin = () => { if (L) L.done(); res(); };
      const left = () => Array.from(box.querySelectorAll('img')).filter(i => !i.dataset.nowait && ((i.getAttribute('src') && !i.complete) || i.classList.contains('av-wait'))).length + (window.Avatar3D && Avatar3D._busy ? Avatar3D._busy() : 0);
      const check = () => {
        const n = box.isConnected ? left() : 0;
        if (!n || performance.now() - t0 > 90000) return fin(); // 兜底：最多等 90 秒
        maxN = Math.max(maxN, n);
        if (!L) L = Loader.hold('准备中…', 150);
        L.set(1 - n / maxN, '还有 ' + n + ' 个素材');
        setTimeout(check, 60);
      };
      requestAnimationFrame(check); // 等 hydrate / 立绘任务排上队再检查
    });
  }

  window.Preload = { forGame, forBattle, forScene, gate, settle, settleBox, Loader };
})();
