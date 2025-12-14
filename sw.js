const CACHE_NAME = 'buy-or-not-v5'; // 更新版本號

// 1. 安裝階段：快取「App Shell」
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png', 
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
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. 優先使用快取
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 網路請求
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }
        
        // 動態快取其他資源
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // 3. 【關鍵修正】離線且快取找不到時的救命機制
        // 如果是「頁面導航 (Navigate)」請求 (例如打開 App)，強制回傳 index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        
        console.log('Offline fetch failed:', event.request.url);
      });
    })
  );
});
