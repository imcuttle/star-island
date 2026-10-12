/* 声音输入：音量 / 拍手 / 喊叫检测 + 语音识别（答题、口令）
   语音识别三条路：
   · vosk：本机离线识别（Vosk WASM + 中 / 英文小模型）。每道题用「选项限定语法」，只在几个答案里挑，孩子说得不标准也能认出来
   · phone：手机浏览器自带的语音识别（需要联网），文字通过 WebSocket 发过来
   · web：浏览器自带（Electron 里通常不可用，只在网页调试时用）
   listen({ choices, lang }) 把识别出的文字和选项做模糊匹配：中文按字重合度、数字互转（35 ⇄ 三十五）、英文按编辑距离；也认「第一个 / A」这类说法 */
(function () {
  const M = window.Motion, U = M.U;

  /* ---------- 中文数字 ---------- */
  const CN = '零一二三四五六七八九';
  function numCN(n) {
    n = Math.floor(n); if (n < 0) return '负' + numCN(-n);
    if (n < 10) return CN[n];
    if (n < 20) return '十' + (n % 10 ? CN[n % 10] : '');
    if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
    if (n < 1000) { const r = n % 100; return CN[Math.floor(n / 100)] + '百' + (r ? (r < 10 ? '零' : '') + (r < 20 && r >= 10 ? '一' + numCN(r) : numCN(r)) : ''); }
    if (n < 10000) { const r = n % 1000; return CN[Math.floor(n / 1000)] + '千' + (r ? (r < 100 ? '零' : '') + numCN(r).replace(/^十/, '一十') : ''); }
    return String(n);
  }
  function cnToNum(s) {
    const D = { 零: 0, 〇: 0, 一: 1, 幺: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    return s.replace(/[零〇一幺二两三四五六七八九十百千]+/g, m => {
      if (!/[十百千]/.test(m)) return m.split('').map(c => D[c]).join('');
      let total = 0, cur = 0;
      for (const c of m) { if (c in D) cur = D[c]; else { const u = c === '十' ? 10 : c === '百' ? 100 : 1000; total += (cur || (c === '十' ? 1 : 0)) * u; cur = 0; } }
      return String(total + cur);
    });
  }
  M.numCN = numCN; M.cnToNum = cnToNum;
  // 符号、数字的读法（给语法用）
  function speakable(t) {
    return String(t)
      .replace(/(\d+):(\d+)/g, (m, h, mm) => numCN(+h) + '点' + (+mm === 30 ? '半' : +mm ? numCN(+mm) + '分' : ''))
      .replace(/(\d+)\/(\d+)/g, (m, a, b) => numCN(+b) + '分之' + numCN(+a))
      .replace(/\d+/g, d => numCN(+d)).replace(/>/g, '大于').replace(/</g, '小于').replace(/=/g, '等于').replace(/\+/g, '加').replace(/[-−]/g, '减').replace(/[×x]/g, '乘').replace(/÷/g, '除以');
  }
  const norm = s => cnToNum(String(s || '').toLowerCase().replace(/[\s，。！？、,.!?;:：；“”"'‘’《》「」（）()\[\]【】…—\-]/g, ''));
  const isEn = s => /^[\x00-\x7f]+$/.test(String(s || '').trim()) && /[a-z]/i.test(s);
  function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }
  function lcs(a, b) { const m = a.length, n = b.length; const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0)); for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]); return dp[m][n]; }
  const ORD = ['一', '二', '三', '四', '五', '六'], LET = ['a', 'b', 'c', 'd', 'e', 'f'];
  // 把一句识别结果和选项匹配：返回 {idx, score}
  function matchChoice(text, choices) {
    const t = norm(text); if (!t) return { idx: -1, score: 0 };
    let best = -1, bs = 0;
    choices.forEach((c, i) => {
      const forms = [c.t, c.s, speakable(c.t)].concat(c.alts || []).filter(Boolean).map(norm).filter(Boolean);
      let sc = 0;
      forms.forEach(f => {
        if (t === f) sc = Math.max(sc, 1);
        else if (isEn(f)) { const d = lev(t, f); sc = Math.max(sc, 1 - d / Math.max(f.length, t.length), t.includes(f) && f.length > 2 ? .9 : 0); }
        else { const l = lcs(t, f); sc = Math.max(sc, l / Math.max(f.length, 1) * (l / Math.max(t.length, 1)) ** .3, t.includes(f) ? .95 : 0); }
      });
      // 第 N 个 / 选 A
      if (new RegExp('第?' + ORD[i] + '个?$|^' + (i + 1) + '$|^(选)?' + LET[i] + '$').test(t)) sc = Math.max(sc, .9);
      if (sc > bs) { bs = sc; best = i; }
    });
    return { idx: bs >= .5 ? best : -1, score: bs };
  }
  M.matchChoice = matchChoice;

  const Ears = M.Ears = M.emitter({
    level: 0, db: -90, peak: 0, ctx: null, src: null, an: null, proc: null, stream: null, buf: null,
    engine: '', status: '', models: {}, rec: null, listening: null, lastText: '', _avg: 0, _loudT: 0, _clapT: 0, _loop: null,

    attach(stream) {
      this.detach();
      if (!stream) return;
      const C = window.AudioContext || window.webkitAudioContext;
      if (!this.ctx) this.ctx = (window.Core && Core.Bank.ac()) || new C();
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      this.stream = stream; this.src = this.ctx.createMediaStreamSource(stream);
      this.an = this.ctx.createAnalyser(); this.an.fftSize = 1024; this.buf = new Float32Array(this.an.fftSize);
      this.src.connect(this.an);
      // 给离线识别送原始声音：AudioWorklet 在音频线程里攒够 4096 个采样再整块发过来（零拷贝），主线程转给 Vosk 的 Worker
      const feed = (buf, rate) => { const r = this.rec; if (r && this.listening) { try { r.acceptWaveformFloat(buf, rate); } catch (er) {} } };
      const sink = this.ctx.createGain(); sink.gain.value = 0; sink.connect(this.ctx.destination); this.sink = sink;
      const src = this.src, ctx = this.ctx;
      const viaSP = () => { if (this.src !== src) return; this.proc = ctx.createScriptProcessor(4096, 1, 1); this.proc.onaudioprocess = e => feed(e.inputBuffer.getChannelData(0).slice(), e.inputBuffer.sampleRate); src.connect(this.proc); this.proc.connect(sink); };
      if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
        Ears.worklet(ctx).then(() => {
          if (this.src !== src) return;
          const n = this.proc = new AudioWorkletNode(ctx, 'si-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
          n.port.onmessage = e => feed(e.data, ctx.sampleRate);
          src.connect(n); n.connect(sink);
        }).catch(viaSP);
      } else viaSP();
      if (!this._loop) this._loop = M.loop((dt, t) => this.meter(t));
      this.emit('attach');
    },
    detach() { try { if (this.src) this.src.disconnect(); if (this.proc) { this.proc.disconnect(); this.proc.onaudioprocess = null; if (this.proc.port) this.proc.port.onmessage = null; } } catch (e) {} this.src = this.proc = this.an = null; this.stream = null; },
    // 音频线程里的「水龙头」：每 4096 个采样发一块给主线程
    worklet(ctx) {
      if (ctx._siTap) return ctx._siTap;
      const code = "class T extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(4096);this.n=0}process(i){const c=i[0]&&i[0][0];if(c){for(let k=0;k<c.length;k++){this.b[this.n++]=c[k];if(this.n===4096){this.port.postMessage(this.b,[this.b.buffer]);this.b=new Float32Array(4096);this.n=0}}}return true}}registerProcessor('si-tap',T)";
      return (ctx._siTap = ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))));
    },
    meter(t) {
      let lv = 0;
      if (this.an) { this.an.getFloatTimeDomainData(this.buf); let s = 0; for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i]; const rms = Math.sqrt(s / this.buf.length); this.db = 20 * Math.log10(rms + 1e-8); lv = U.clamp((this.db + 58) / 46, 0, 1); }
      else { const p = M.Input.audioSrc && M.Input.audioSrc.kind === 'phone' && M.Phone.get(M.Input.audioSrc.id); lv = p ? p.level : 0; }
      const prev = this.level; this.level = lv > prev ? lv : prev + (lv - prev) * .25; this.peak = Math.max(this.peak * .97, lv);
      // 拍手：安静里突然一下很响、很短
      if (lv - this._avg > .38 && lv > .55 && t - this._clapT > 260) { this._clapT = t; this.emit('clap', { level: lv }); }
      // 喊叫：持续很响
      if (lv > .6) { if (!this._loudT) this._loudT = t; if (t - this._loudT > 160 && !this._shout) { this._shout = true; this.emit('shout', { level: lv }); } } else { this._loudT = 0; this._shout = false; }
      this._avg += (lv - this._avg) * .08;
    },

    /* ---------- 语音识别 ---------- */
    phoneASR() { const a = M.Input.audioSrc; const p = a && a.kind === 'phone' ? M.Phone.get(a.id) : M.Phone.list().find(x => x.caps && x.caps.speech); return p && p.caps && p.caps.speech ? p : null; },
    pick() {
      const c = M.cfg.asr; if (c === 'off') return '';
      if (M.web) return window.webkitSpeechRecognition || window.SpeechRecognition ? 'web' : '';
      if (c === 'phone') return this.phoneASR() ? 'phone' : '';
      if (c === 'vosk') return 'vosk';
      if (c === 'web') return window.webkitSpeechRecognition || window.SpeechRecognition ? 'web' : '';
      // 自动：声音来自手机且手机能识别 → 手机；否则本机离线
      const a = M.Input.audioSrc; if (a && a.kind === 'phone' && this.phoneASR()) return 'phone';
      if (M.native) return 'vosk';
      return window.webkitSpeechRecognition ? 'web' : (this.phoneASR() ? 'phone' : '');
    },
    available() { return !!this.pick() && (this.pick() !== 'vosk' || !!this.stream); },
    async model(lang) {
      lang = lang === 'en' ? 'en' : 'cn';
      if (this.models[lang]) return this.models[lang];
      this.models[lang] = (async () => {
        if (!window.Vosk) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'motion/vendor/vosk.js'; s.onload = res; s.onerror = () => rej(new Error('vosk.js 加载失败')); document.head.appendChild(s); });
        this.status = 'loading-' + lang; this.emit('status');
        const m = await window.Vosk.createModel(M.url('motion/vendor/models/vosk-' + lang + '.tar.gz'), -1);
        this.status = 'ready'; this.emit('status'); return m;
      })().catch(e => { console.error(e); delete this.models[lang]; this.status = 'error'; this.emit('status'); throw e; });
      return this.models[lang];
    },
    async prepare(lang) { if (this.pick() === 'vosk') { try { await this.model(lang); return true; } catch (e) { return false; } } return !!this.pick(); },
    // 构造限定语法：中文拆成单字（几乎都在词表里），数字转成读法
    grammar(choices, lang, extra) {
      const out = new Set();
      const add = s => { s = String(s || '').trim(); if (!s) return; if (lang === 'en') { const w = s.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim(); if (w) out.add(w); } else { const c = speakable(s).replace(/[^\u4e00-\u9fa5]/g, ''); if (c) out.add(c.split('').join(' ')); } };
      (choices || []).forEach((c, i) => { add(c.t); add(c.s); (c.alts || []).forEach(add); if (lang !== 'en') { add('第' + ORD[i] + '个'); add(ORD[i]); } else add(LET[i]); });
      (extra || []).forEach(add);
      out.add('[unk]');
      return JSON.stringify([...out]);
    },
    /* listen({ choices:[{t,s,alts}], lang:'zh'|'en', words:[额外口令], onPartial(text), onResult({text, idx, score}), once })
       返回 { stop() }。同一时间只有一个监听 */
    listen(o) {
      this.stop();
      const eng = this.pick(); const lang = o.lang || ((o.choices || []).every(c => isEn(c.t)) && (o.choices || []).length ? 'en' : 'zh');
      const h = { o, eng, lang, alive: true, stop: () => { if (this.listening === h) this.stop(); } };
      this.listening = h; this.engine = eng;
      const deliver = (text, final) => {
        if (!h.alive) return;
        text = String(text || '').replace(/\[unk\]/g, '').replace(/\s+/g, lang === 'en' ? ' ' : '').trim(); if (!text) return;
        this.lastText = text; this.emit('text', { text, final, lang });
        if (!final) { if (o.onPartial) o.onPartial(text); const m = o.choices ? matchChoice(text, o.choices) : { idx: -1 }; if (m.idx >= 0 && m.score >= .95 && o.eager !== false) { fin(text, m); } return; }
        const m = o.choices ? matchChoice(text, o.choices) : { idx: -1, score: 0 };
        fin(text, m);
      };
      const fin = (text, m) => { if (!h.alive) return; if (o.onResult) o.onResult({ text, idx: m.idx, score: m.score }); if (o.once !== false && m.idx >= 0) h.stop(); };
      h.deliver = deliver;
      if (eng === 'vosk') {
        this.model(lang).then(model => {
          if (!h.alive) return;
          const rec = new model.KaldiRecognizer(this.ctx ? this.ctx.sampleRate : 48000, o.free ? undefined : this.grammar(o.choices, lang, o.words));
          rec.on('result', m => deliver(m.result.text, true));
          rec.on('partialresult', m => deliver(m.result.partial, false));
          this.rec = rec; h.rec = rec;
        }).catch(() => { if (o.onError) o.onError('离线语音模型加载失败'); });
      } else if (eng === 'phone') {
        const p = this.phoneASR(); h.phone = p;
        M.Phone.send(p.id, { type: 'listen', on: true, lang: lang === 'en' ? 'en-US' : 'zh-CN' });
        h.off = M.Phone.on('speech', e => deliver(e.text, e.final));
      } else if (eng === 'web') {
        const R = window.SpeechRecognition || window.webkitSpeechRecognition; const r = new R();
        r.lang = lang === 'en' ? 'en-US' : 'zh-CN'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 3;
        r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) deliver(e.results[i][0].transcript, e.results[i].isFinal); };
        r.onend = () => { if (h.alive) try { r.start(); } catch (e) {} };
        try { r.start(); } catch (e) {} h.web = r;
      } else if (o.onError) o.onError('没有可用的语音识别');
      return h;
    },
    stop() {
      const h = this.listening; if (!h) return; h.alive = false; this.listening = null;
      if (h.rec) { try { h.rec.remove(); } catch (e) {} if (this.rec === h.rec) this.rec = null; }
      if (h.phone) M.Phone.send(h.phone.id, { type: 'listen', on: false });
      if (h.off) h.off();
      if (h.web) { try { h.web.onend = null; h.web.abort(); } catch (e) {} }
    },
  });
  M.speakable = speakable;
})();
