const CACHE_VERSION = 'v3';
const CACHE_NAME = `divine-insight-${CACHE_VERSION}`;

const CORE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './logic-worker.js',
    './divine-insight-optimized.json',
    './manifest.webmanifest',
    './assets/img/card-back.jpg',
    './assets/fx/particles.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())));
        await self.clients.claim();
    })());
});

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
    }
    return networkResponse;
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const networkPromise = fetch(request).then((response) => {
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => null);

    return cached || networkPromise || Response.error();
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    if (!isSameOrigin) return;

    if (url.pathname.includes('/assets/img/deck/')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    event.respondWith(staleWhileRevalidate(request));
});
