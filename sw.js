// Lifeline Offline Disaster Rescue Service Worker
// Scope-aware: works under any base path (root or /LIfeliNE/)
const CACHE_NAME = 'lifeline-offline-v5';
const BASE_PATH = self.registration.scope.replace(/\/$/, '');

const STATIC_ASSETS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Silently ignore if some assets are unavailable at install time
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
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
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-First for HTML navigation — always get latest deployed assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(BASE_PATH + '/index.html', responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(BASE_PATH + '/index.html')
            .then(r => r || caches.match('/index.html'));
        })
    );
    return;
  }

  // Cache-First for static assets, network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.origin === location.origin) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request);
      });
    })
  );
});