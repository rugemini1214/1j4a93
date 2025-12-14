const CACHE_NAME = 'buy-or-not-v4'; // 版本號更新

// 1. 安裝階段：快取「App Shell」 (所有讓網頁能運作的必要檔案)
// 注意：如果這些檔案其中一個下載失敗 (例如 icon.png 不存在)，Service Worker 就會安裝失敗。
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png', 
  // 關鍵核心：以下這些沒存到，離線就會變白畫面
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://unpkg.com/@phosphor-icons/web'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 只處理 http/https 請求
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. 如果快取有，優先使用
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 如果快取沒有，去網路下載
      return fetch(event.request).then((networkResponse) => {
        // 檢查回應是否有效
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }

        // 3. 下載成功後，順便存起來 (針對那些不在 STATIC_ASSETS 裡的圖片或資源)
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // 網路失敗且快取也沒有時，這裡通常會回傳離線頁面，
        // 但因為我們已經快取了 App Shell，這裡通常不會發生致命錯誤
        console.log('Offline fetch failed:', event.request.url);
      });
    })
  );
});
