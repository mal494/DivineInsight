const CACHE_NAME = 'divine-insight-v2';

// The core assets that MUST be cached immediately for the UI to load offline
const CORE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './logic-worker.js',
    './divine-insight-optimized.json',
    './assets/img/card-back.jpg',
    './assets/fx/particles.js'
];

// --- 1. Install Phase (Stocking the Pantry) ---
self.addEventListener('install', (event) => {
    // Force the waiting service worker to become the active service worker.
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Pre-caching core assets');
                return cache.addAll(CORE_ASSETS);
            })
    );
});

// --- 2. Activate Phase (Cleaning out old Pantries) ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// --- 3. Fetch Phase (The Proxy/Interception) ---
self.addEventListener('fetch', (event) => {
    // Only intercept GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // If it's in the cache, serve it instantly (0ms pop!)
                if (cachedResponse) {
                    return cachedResponse;
                }

                // If not in cache, fetch from network
                return fetch(event.request).then((networkResponse) => {
                    // Check if we received a valid response
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // Clone the response because it's a stream and can only be consumed once.
                    // We need one copy for the browser and one copy to put in the cache.
                    const responseToCache = networkResponse.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            // Dynamically cache tarot card images as they are drawn
                            if (event.request.url.includes('/assets/img/deck/')) {
                                cache.put(event.request, responseToCache);
                            }
                        });

                    return networkResponse;
                });
            })
    );
});