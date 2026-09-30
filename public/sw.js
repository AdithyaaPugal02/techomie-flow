const CACHE_NAME = 'techomie-flow-v1';
const PRECACHE_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('PWA Pre-cache non-fatal warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude non-GET and dynamic Next.js APIs / server actions
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle page navigation: Network-first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return new Response(
            `<!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8" />
                <title>Techomie Flow - Offline</title>
                <style>
                  body { background: #0B111E; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                  .card { background: #131B2E; padding: 2rem; border-radius: 1rem; border: 1px solid #1E293B; max-width: 400px; }
                  h1 { font-size: 1.25rem; color: #38BDF8; margin-bottom: 0.5rem; }
                  p { color: #94A3B8; font-size: 0.9rem; line-height: 1.5; }
                  button { margin-top: 1rem; background: #0284C7; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 0.5rem; cursor: pointer; font-weight: 500; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>You're Offline</h1>
                  <p>Techomie Flow requires an active internet connection to synchronize quotes and live data.</p>
                  <button onclick="window.location.reload()">Retry Connection</button>
                </div>
              </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Static assets (Next.js bundles, images, icons, fonts)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|css|js)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Standard fetch fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
