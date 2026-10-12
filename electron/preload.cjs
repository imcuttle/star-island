/* 只在 Electron 版里存在：暴露少量本机能力，并在页面加载时注入体感模块 motion/boot.js。
   静态网页版没有这个文件参与，页面里也就没有任何体感入口。 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('StarNative', {
  electron: true,
  info: () => ipcRenderer.invoke('star:info'),
  qr: (text, opts) => ipcRenderer.invoke('star:qr', text, opts),
  mediaAccess: kind => ipcRenderer.invoke('star:media-access', kind),
  openPrivacy: kind => ipcRenderer.invoke('star:open-privacy', kind),
  fullscreen: on => ipcRenderer.invoke('star:fullscreen', on),
  newToken: () => ipcRenderer.invoke('star:new-token'),
});

addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('script[src*="motion/boot.js"]')) return; // index.html 已经引用（网页版同一份页面）
  const s = document.createElement('script');
  s.src = 'motion/boot.js'; s.defer = true;
  document.head.appendChild(s);
});
