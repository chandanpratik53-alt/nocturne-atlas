// Nocturne Atlas - Service Worker (Phase 1 Foundation)
// Strategy: Cache-first for shell assets with network background update (stale-while-revalidate)
// GUARANTEE: Never caches user sleep data. Sleep data is strictly stored in IndexedDB.

const CACHE_NAME = 'nocturne-atlas-shell-v4';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable.png',
  './assets/icon.svg',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/screens.css',
  './src/app.js',
  './src/storage/db.js',
  './src/services/calculations.js',
  './src/services/analytics.js',
  './src/services/backup.js',
  './src/components/charts.js',
  './src/services/theme.js',
  './src/services/pwa.js',
  './src/services/navigation.js',
  './src/components/logModal.js',
  './src/components/emptyState.js',
  './src/screens/homeScreen.js',
  './src/screens/insightsScreen.js',
  './src/screens/historyScreen.js',
  './src/screens/settingsScreen.js'
];

// Install: Cache all static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Add assets individually with resilience so one missing asset doesn't fail entire install
      for (const asset of SHELL_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Warning: failed to cache ${asset}:`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for application assets, Cache-First for media
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Do not intercept browser-extension or chrome requests
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Network fetch promise that updates the cache in background
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          // If offline and navigate request, fallback to cached index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
          throw error;
        });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for skip waiting messages from the UI
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
