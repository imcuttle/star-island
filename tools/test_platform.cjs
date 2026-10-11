// 星星大冒险关卡体检：node tools/test_platform.cjs [每个年级生成几关=20]
// 对 0-4 年级各生成一批关卡，用游戏里同一套物理把所有跳法模拟一遍，报告：
//   · 难度：关卡长度、深坑宽度、水管高度、食人花 / 小怪 / 蜜蜂数量、阶梯高度
//   · 金币：设计了多少枚、有几枚被判定为「够不着 / 只有极限操作才够得着」（应为 0）
//   · 问号砖：有几个顶不到（应为 0）
//   · 终点：小个子、变大之后是否都能到达
// 有问题的关卡会打印出是哪一段、哪个位置。
const fs = require('fs'), path = require('path');
const N = +(process.argv[2] || 20);
const R = { int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick: a => a[Math.floor(Math.random() * a.length)], shuffle: a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; } };
Object.assign(globalThis, { window: globalThis, Core: { h() {}, E() {}, hydrate() {}, UI: {}, Audio2: {}, Voice: {} }, CONTENT: { R }, Arcade: {}, Engines: { ENGINES: {} } });
new Function(fs.readFileSync(path.join(__dirname, '../js/platform.js'), 'utf8'))();
const PF = globalThis.Platformer, M_ = PF.mapper;

// 物理基准：原地 / 助跑的最高跳和最远跳
(function () {
  const L = { HT: 15, W: 200, map: Array.from({ length: 15 }, (_, y) => new Uint8Array(200).fill(y >= 12 ? 1 : 0)) }, M = M_(L);
  const jump = (run, dims) => { const P = { x: 20, y: 12 - dims.h, w: dims.w, h: dims.h, vx: run ? 7.6 : 0, vy: 0, on: true, coy: .1, jb: 0, runT: run ? 1 : 0 }; let top = 0, x0 = P.x; for (let i = 0; i < 300; i++) { PF.phys(P, 1, i === 0, true, run, M); top = Math.max(top, 12 - (P.y + P.h)); if (P.on && i > 3) break; } return [top.toFixed(2), (P.x - x0).toFixed(2)]; };
  console.log('物理基准  小个子 ' + PF.SMALL.w + '×' + PF.SMALL.h + ' 格，变大 ' + PF.BIG.w + '×' + PF.BIG.h + ' 格');
  console.log('  原地起跳：最高 ' + jump(false, PF.SMALL)[0] + ' 格，最远 ' + jump(false, PF.SMALL)[1] + ' 格；助跑：最高 ' + jump(true, PF.SMALL)[0] + ' 格，最远 ' + jump(true, PF.SMALL)[1] + ' 格');
})();

const T = { GD: 1, BR: 2, QK: 3, US: 4, HD: 5, QC: 6, MC: 7, PP: 8, SP: 9 };
let bad = 0;
for (let g = 0; g <= 4; g++) {
  const agg = { W: [], pit: [], pipe: [], plants: 0, foes: {}, coins0: 0, cut: 0, tight: 0, qk: 0, qkCut: 0, goalBig: 0, ms: [], tries: [], stair: [] };
  for (let k = 0; k < N; k++) {
    const t0 = Date.now(); const L = PF.build(g); agg.ms.push(Date.now() - t0); agg.tries.push(L.stats.tries);
    agg.W.push(L.W); agg.coins0 += L.stats.coins0; agg.cut += L.stats.cut.length;
    if (L.stats.cut.length) { bad++; const where = c => { const sg = L.seq.filter(q => q[1] <= c.x).pop(); return (sg ? sg[0] : 'intro') + '@' + c.x.toFixed(1) + ',' + c.y.toFixed(1); }; console.log('  ✗ G' + g + ' 第' + (k + 1) + '关 删掉了金币：' + L.stats.cut.map(where).join(' ')); }
    // 统计地形
    let gap = 0; for (let cx = 0; cx < L.W; cx++) { if (!L.map[L.HT - 1][cx]) gap++; else { if (gap) agg.pit.push(gap); gap = 0; } }
    L.pipes.forEach(p => { agg.pipe.push(L.GY - p.top); if (p.plant) agg.plants++; });
    L.foes.forEach(f => agg.foes[f.kind] = (agg.foes[f.kind] || 0) + 1);
    for (let cy = 0; cy < L.HT; cy++) for (let cx = 0; cx < L.W; cx++) { const v = L.map[cy][cx]; if (v === T.QK) agg.qk++; }
    agg.qkCut += L.stats.qkCut.length; L.stats.qkCut.forEach(([cx, cy]) => { bad++; const sg = L.seq.filter(q => q[1] <= cx).pop(); console.log('  ✗ G' + g + ' 第' + (k + 1) + '关 问号砖顶不到：' + (sg ? sg[0] + '+' + (cx - sg[1]) : 'intro') + ' 第' + cy + '行'); });
    // 再测一遍：剩下的金币是否都至少有 MIN_WAYS 种跳法；变大以后能不能到终点
    const r = PF.analyze(L); r.ways.forEach(n => { if (n < PF.MIN_WAYS) { agg.cut++; bad++; } else if (n < PF.MIN_WAYS * 2) agg.tight++; });
    const rb = PF.analyze(L, PF.BIG); if (rb.reachGoal) agg.goalBig++; else { bad++; console.log('  ✗ G' + g + ' 第' + (k + 1) + '关 变大后到不了终点'); }
    if (!r.reachGoal) { bad++; console.log('  ✗ G' + g + ' 第' + (k + 1) + '关 小个子到不了终点'); }
    let hst = 0; for (let cx = L.FX - 14; cx < L.FX; cx++) for (let cy = 0; cy < L.GY; cy++) if (L.map[cy][cx] === T.HD) { hst = Math.max(hst, L.GY - cy); break; } agg.stair.push(hst);
  }
  const avg = a => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1), mx = a => a.length ? Math.max(...a) : 0;
  console.log('\n【' + g + ' 年级】' + N + ' 关');
  console.log('  长度 平均 ' + avg(agg.W) + ' 格 · 深坑 ' + (agg.pit.length / N).toFixed(1) + ' 个/关，最宽 ' + mx(agg.pit) + ' 格 · 水管最高 ' + mx(agg.pipe) + ' 格，食人花 ' + (agg.plants / N).toFixed(1) + ' 个/关 · 终点阶梯 ' + mx(agg.stair) + ' 格');
  console.log('  小怪/关：' + Object.entries(agg.foes).map(([k2, v]) => k2 + ' ' + (v / N).toFixed(1)).join('，') + ' · 知识问号砖 ' + (agg.qk / N).toFixed(1) + ' 个/关（顶不到被改掉 ' + agg.qkCut + '）');
  console.log('  金币 ' + (agg.coins0 / N).toFixed(1) + ' 枚/关，够不着被删 ' + agg.cut + '，只有 ' + PF.MIN_WAYS + '-' + (PF.MIN_WAYS * 2 - 1) + ' 种跳法的 ' + agg.tight + ' · 变大后能通关 ' + agg.goalBig + '/' + N + ' · 生成+检测 平均 ' + avg(agg.ms) + 'ms，重试 ' + avg(agg.tries));
}
console.log('\n' + (bad ? '发现 ' + bad + ' 处问题' : '全部通过'));
process.exit(bad ? 1 : 0);
