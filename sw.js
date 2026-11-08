const APP_VERSION = '6.0.0';
const CACHE_NAME = `topwarlords-v${APP_VERSION}`;
const CORE_ASSETS = [
  './',
  './index.html',
  './armory.html',
  `./style.css?v=${APP_VERSION}`,
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  `./js/data.js?v=${APP_VERSION}`,
  `./js/ladder-data.js?v=${APP_VERSION}`,
  `./js/engine.js?v=${APP_VERSION}`,
  `./js/firebase-config.js?v=${APP_VERSION}`,
  `./js/cloud-sync.js?v=${APP_VERSION}`,
  `./js/ladder.js?v=${APP_VERSION}`,
  `./js/tournament.js?v=${APP_VERSION}`,
  `./js/firebase-tourney.js?v=${APP_VERSION}`,
  `./js/online-pvp.js?v=${APP_VERSION}`,
  `./js/telemetry.js?v=${APP_VERSION}`,
  `./js/sound.js?v=${APP_VERSION}`,
  `./js/poster-help.js?v=${APP_VERSION}`,
  `./js/libs/three.min.js`,
  `./js/battle-3d.js?v=1.0.0`,
  `./js/app.js?v=${APP_VERSION}`,
  `./js/armory.js?v=${APP_VERSION}`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1. 軍武圖資與圖示：Cache-First (忽略查詢參數，永久快取避免重複下載)
  if (url.pathname.includes('/assets/units/') || url.pathname.includes('/assets/icons/')) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // 2. 具明確版本號 (?v=...) 的靜態樣式與腳本：精確版本號比對 Cache-First (同版本極速秒開，升版即刻更新)
  if (url.searchParams.has('v') && (url.pathname.endsWith('.css') || url.pathname.endsWith('.js'))) {
    event.respondWith(
      caches.match(req, { ignoreSearch: false }).then((cached) => {
        if (cached) return cached;
        return fetch(req, { cache: 'no-cache' }).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        }).catch(() => caches.match(req, { ignoreSearch: true }));
      })
    );
    return;
  }

  // 3. HTML 頁面與其他導覽請求：Network-First (確保最新部署之版本號立即生效)
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
