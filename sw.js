const CACHE_NAME = 'buy-or-not-v3'; // 版本號更新，確保瀏覽器重新安裝

// 1. 安裝階段：只快取絕對必要的「本地」檔案
// 這樣可以避免因為外部 CDN 連線問題導致整個安裝失敗
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 強制讓新版 Service Worker 立刻接手
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // 清除舊版本的快取，避免佔用空間或衝突
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // 讓 Service Worker 立刻控制所有頁面
  self.clients.claim();
});

// 2. 攔截請求策略：快取優先 (Cache First)，但會自動備份新資源
self.addEventListener('fetch', (event) => {
  // 只處理 http/https 請求 (排除 chrome-extension 等其他協議)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // A. 如果快取裡已經有，直接回傳 (離線成功的關鍵)
      if (cachedResponse) {
        return cachedResponse;
      }

      // B. 如果快取沒有，去網路下載
      return fetch(event.request).then((networkResponse) => {
        // 檢查下載是否成功
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }

        // C. 【關鍵】下載成功後，複製一份放進快取 (Dynamic Caching)
        // 這會自動把 React, Tailwind, Icons 等外部資源存起來
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch((error) => {
        console.log('[Service Worker] Fetch failed (Offline):', event.request.url);
        // 這裡可以回傳一個離線專用的 fallback 頁面，但因為是單頁應用，通常不用
      });
    })
  );
});
