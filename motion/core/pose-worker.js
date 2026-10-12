/* 动作识别 Worker：MediaPipe Pose / Hand 推理放到后台线程，主线程只负责取帧和画画面
   消息：
     init / config { base, model, people, hands, grab } → { type: 'ready', delegate, grab }  或 { type: 'error', message }
     frame { bitmap, ts, roi? }                   → { type: 'result', ts, ms, poses: [{ lm, world }], hands: [pts], grab: pts | null }
       roi：体感光标那只手附近裁出来的小图（主线程按姿态的手腕位置裁），单独跑一个手部模型看手指，判断「张开手掌 → 握拳」
   用经典 Worker + CommonJS 版 bundle：MediaPipe 加载 wasm 时要用 importScripts，模块 Worker 里不能用 */
/* eslint-disable no-restricted-globals */
self.exports = {};
// 变量名都带 __ 前缀：bundle 用 importScripts 加载到同一个全局作用域，短名字会和它的顶层变量冲突
let __mp = null, __fs = null, __pose = null, __hand = null, __grab = null, __cur = {}, __dg = '', __base = '';

async function load(o) {
  __base = o.base;
  if (!__mp) { importScripts(__base + 'vision_worker_bundle.js'); __mp = self.exports; __fs = await __mp.FilesetResolver.forVisionTasks(__base + 'wasm'); }
  const model = o.model === 'full' ? 'pose_full' : 'pose_lite', n = Math.max(1, Math.min(2, o.people || 1));
  if (!__pose || __cur.model !== model || __cur.n !== n) {
    if (__pose) { try { __pose.close(); } catch (e) {} __pose = null; }
    const opts = d => ({ baseOptions: { modelAssetPath: __base + 'models/' + model + '.task', delegate: d }, runningMode: 'VIDEO', numPoses: n, minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5 });
    try { __pose = await __mp.PoseLandmarker.createFromOptions(__fs, opts('GPU')); __dg = 'GPU'; }
    catch (e) { __pose = await __mp.PoseLandmarker.createFromOptions(__fs, opts('CPU')); __dg = 'CPU'; }
    __cur.model = model; __cur.n = n;
  }
  if (o.hands && !__hand) {
    const opts = d => ({ baseOptions: { modelAssetPath: __base + 'models/hand.task', delegate: d }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .5, minHandPresenceConfidence: .5, minTrackingConfidence: .5 });
    try { __hand = await __mp.HandLandmarker.createFromOptions(__fs, opts(__dg || 'GPU')); } catch (e) { __hand = await __mp.HandLandmarker.createFromOptions(__fs, opts('CPU')); }
  }
  __cur.hands = !!o.hands;
  // 光标手：只看一只手（裁好的小图），加载失败不影响姿态识别（光标退回「停留点击」）
  if (o.grab && !__grab) {
    const opts = d => ({ baseOptions: { modelAssetPath: __base + 'models/hand.task', delegate: d }, runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: .4, minHandPresenceConfidence: .4, minTrackingConfidence: .4 });
    try { __grab = await __mp.HandLandmarker.createFromOptions(__fs, opts(__dg || 'GPU')); } catch (e) { try { __grab = await __mp.HandLandmarker.createFromOptions(__fs, opts('CPU')); } catch (e2) { __grab = null; } }
  }
}

// 结果压成普通对象数组（结构化克隆更快，不带类实例）
const pts = l => l.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));

self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'init' || m.type === 'config') {
    try { await load(m); self.postMessage({ type: 'ready', delegate: __dg, grab: !!__grab }); }
    catch (er) { self.postMessage({ type: 'error', message: String((er && er.message) || er) }); }
    return;
  }
  if (m.type === 'frame') {
    const bm = m.bitmap, t0 = performance.now();
    let poses = [], hands = [], grab = null;
    try {
      if (__pose) { const r = __pose.detectForVideo(bm, m.ts); poses = (r.landmarks || []).map((l, i) => ({ lm: pts(l), world: r.worldLandmarks && r.worldLandmarks[i] ? pts(r.worldLandmarks[i]) : null })); }
      if (__hand && __cur.hands) { const h = __hand.detectForVideo(bm, m.ts); hands = (h.landmarks || []).map(pts); }
    } catch (er) { self.postMessage({ type: 'frame-error', message: String((er && er.message) || er) }); }
    if (m.roi) { try { if (__grab) { const h = __grab.detectForVideo(m.roi, m.ts); if (h.landmarks && h.landmarks[0]) grab = pts(h.landmarks[0]); } } catch (er) {} try { m.roi.close(); } catch (er) {} }
    try { bm.close(); } catch (er) {}
    self.postMessage({ type: 'result', ts: m.ts, ms: performance.now() - t0, poses, hands, grab });
  }
};
