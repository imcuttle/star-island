/* 语音切片：把带数字 / 名字等动态内容的句子拆成「预录片段 + 数字」，浏览器和 node（收集语音）共用 */
(function (root) {
  const MEASURE = '个只本张支条朵块件头位辆架棵把双根片颗元角分点次天岁杯碗盒袋层排行种匹座间';
  const PUNCT = /[，。！？、；：,.!?;:…\s「」《》（）()"“”]+/;
  const PAUSE = c => /[。！？.!?…]/.test(c) ? 260 : /[，、；：,;:]/.test(c) ? 140 : 0;
  // 符号读法（只在含数字的句子里替换）
  function norm(t) {
    t = t.replace(/\s+=\s+\?/g, '等于几').replace(/\s+=\s+/g, '等于');
    if (!/\d/.test(t)) return t;
    return t.replace(/\s*=\s*\?/g, '等于几').replace(/\s*=\s*/g, '等于').replace(/\s*\+\s*/g, '加').replace(/(\d)\s*[-−]\s*(?=\d)/g, '$1减')
      .replace(/\s*[×x*]\s*(?=\d)/g, '乘').replace(/\s*÷\s*/g, '除以').replace(/(\d+)\s*\/\s*(\d+)/g, (m, a, b) => b + '分之' + a).replace(/(\d+):(\d\d)/g, (m, a, b) => +b ? a + '点' + (+b) + '分' : a + '点整');
  }
  // 数字 → 片段 key 列表（# 开头，0-999 整读，更大的数拆成 万/千 + 余数）
  function numKeys(s, liang) {
    if (s.includes('.')) { const [a, b] = s.split('.'); return numKeys(a).concat(['#点'], b.split('').map(d => '#' + d)); }
    let n = +s; if (!isFinite(n)) return [];
    if (s.length > 1 && s[0] === '0') return s.split('').map(d => '#' + d); // 0123 这类逐位读
    if (n === 2 && liang) return ['#两'];
    if (n <= 999) return ['#' + n];
    if (n >= 1e8) return s.split('').map(d => '#' + d);
    const out = []; const w = Math.floor(n / 1e4), q = Math.floor(n % 1e4 / 1000), r = n % 1000;
    if (w) out.push(...(w <= 9 ? ['#' + w + '万'] : numKeys(String(w)).concat(['#万'])));
    if (q) out.push('#' + q + '千');
    if (r) { if ((w && !q) || (q && r < 100)) out.push('#0'); out.push('#' + r); }
    return out;
  }
  // 拆句：返回 [{t:文本片段} | {n:数字串, liang} | {gap:ms}]
  function pieces(text) {
    const t = norm(String(text)), out = [];
    const parts = t.split(/(\d+(?:\.\d+)?)/);
    parts.forEach((p, i) => {
      if (!p) return;
      if (/^\d/.test(p)) { const nx = parts[i + 1] || ''; out.push({ n: p, liang: MEASURE.includes(nx.trim()[0] || '') && !/^\s*分之/.test(nx) }); return; }
      // 按标点再拆成小句
      let buf = '';
      for (const ch of p) {
        if (PUNCT.test(ch)) { if (buf) out.push({ t: buf }), buf = ''; const g = PAUSE(ch); if (g) out.push({ gap: g }); }
        else buf += ch;
      }
      if (buf) out.push({ t: buf });
    });
    return out;
  }
  // 预生成清单需要的全部片段 key（不含语言前缀）
  function fragKeys(text) { const ks = []; pieces(text).forEach(x => { if (x.t) ks.push(x.t); if (x.n) ks.push(...numKeys(x.n, x.liang)); }); return ks; }
  const api = { norm, pieces, numKeys, fragKeys };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VSEG = api;
})(typeof window !== 'undefined' ? window : this);
