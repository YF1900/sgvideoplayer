const CACHE_NAME = 'hihaho-qr-v23';
const FONT_CACHE_NAME = 'hihaho-qr-fonts-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
];
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// クライアント (アプリ画面) からの SKIP_WAITING メッセージを受けて即時アクティブ化
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  const keep = new Set([CACHE_NAME, FONT_CACHE_NAME]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google Fonts (Material Symbols) はキャッシュ優先 + バックグラウンド更新
  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && (res.status === 200 || res.type === 'opaque')) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // hihaho プレーヤーや QR ライブラリ等の他ホストはブラウザのデフォルトに任せる
  if (url.origin !== self.location.origin) {
    return;
  }

  // 自オリジンの静的アセットはキャッシュ優先 + ネットワークでフォールバック更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
