const CACHE_NAME = 'matklar-v3';
// Recipe pictures from Vercel's image service, kept apart so that their number can be limited
const IMAGE_CACHE = 'matklar-images-v1';
const MAX_IMAGES = 600;
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
];

// Install Event: Pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== IMAGE_CACHE) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First with Cache Fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip chrome-extension, non-http, and external AI/analytics
  if (!url.protocol.startsWith('http')) return;

  // Recipe pictures from the image service never change for the same address, so one kept on
  // the phone is shown without asking the network again
  if (url.origin === self.location.origin && url.pathname === '/_vercel/image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(event.request).then(
          (cached) =>
            cached ||
            fetch(event.request).then((response) => {
              if (response && response.status === 200) {
                cache.put(event.request, response.clone()).then(() => trimImages(cache));
              }
              return response;
            })
        )
      )
    );
    return;
  }

  // Pictures on other sites (Supabase, recipe sites) cannot be read by the app, so they cannot be
  // kept here: the browser's own cache takes care of them
  if (url.origin !== self.location.origin && /\.(jpe?g|png|webp|gif|avif)$/i.test(url.pathname)) return;

  // The app's files in /assets/ get a new name when they change, so a kept copy is always right
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Cache-First for static images and SVGs
  if (
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.includes('/assets/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch fresh copy in background (stale-while-revalidate)
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return networkResponse;
        }).catch(() => {
          return caches.match('./');
        });
      })
    );
    return;
  }

  // Network-First for HTML and app scripts
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html') || caches.match('./');
          }
          return new Response('Offline mode', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

/** Removes the pictures kept longest when there are more than MAX_IMAGES */
async function trimImages(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_IMAGES;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}
