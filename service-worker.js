const CACHE_NAME = 'precificacao-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './supabaseClient.js',
    './calculations.js',
    './manifest.json',
    './assets/logo.png',
    './assets/favicon.png',
    './recuperar-senha.html',
    './recuperar-senha.js'
];

// Install Event: Cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Caching assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('SW: Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch Event: Stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests (like Supabase API) to avoid caching issues
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchedResponse = fetch(event.request).then((networkResponse) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });

                return cachedResponse || fetchedResponse;
            });
        })
    );
});
