/* 离线缓存（PWA）：页面和代码联网优先，保证总是最新版，断网时用缓存；
   assets/ 下的素材缓存优先，下载过一次以后断网也能玩。VERSION 由 tools/build.mjs 按发布内容生成，内容变了旧缓存整个作废 */
const VERSION = 'dev';
const CODE = 'si-code-' + VERSION, ASSET = 'si-asset-' + VERSION;
const VOICE_MAX = 4000; // 语音很多，缓存条数封顶，超出时删掉最早的

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CODE).then(c => c.addAll(['./', 'manifest.webmanifest'])).catch(() => {}));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('si-') && k !== CODE && k !== ASSET).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

let puts = 0;
function trimVoice(c) {
  c.keys().then(ks => { const v = ks.filter(r => r.url.includes('/assets/voice/')); if (v.length > VOICE_MAX) v.slice(0, v.length - VOICE_MAX + 500).forEach(r => c.delete(r)); });
}
function asset(req) {
  return caches.open(ASSET).then(c => c.match(req).then(hit => hit || fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
    if (res.status === 200) { const copy = res.clone(); c.put(req, copy).then(() => { if (++puts % 200 === 0) trimVoice(c); }).catch(() => {}); }
    return res;
  })));
}
function code(req) {
  return fetch(req).then(res => {
    if (res.status === 200) { const copy = res.clone(); caches.open(CODE).then(c => c.put(req, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.open(CODE).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? c.match('./') : null)))
    .then(hit => hit || Response.error()));
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return; // 音频分段请求交给浏览器
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  e.respondWith(/\/(assets|motion\/vendor|motion\/voice)\//.test(u.pathname) ? asset(req) : code(req));
});
