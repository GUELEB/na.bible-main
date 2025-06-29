// Se ha cambiado la versión del caché para forzar la actualización en los dispositivos de los usuarios
const CACHE_NAME = 'na-bible-cache-v3';
// Rutas relativas para que funcione en cualquier servidor o subdirectorio
const urlsToCache = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'public/icon-192.png',
    'public/icon-512.png',
    'data/biblia/_index.json',
    'data/himnario/index.json'
    // Los libros individuales se cachearán dinámicamente al ser solicitados
];

// Instalación del Service Worker y precacheo de recursos estáticos.
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Cacheando archivos pre-definidos');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('[Service Worker] Fallo al cachear archivos:', error);
            })
            .then(() => self.skipWaiting()) // Forzar la activación del nuevo SW
    );
});

// Activación y limpieza de cachés antiguos
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Eliminando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Tomar control de las páginas abiertas
    );
});

// Estrategia de Fetch: Cache, luego Network con actualización de caché (Stale-While-Revalidate)
self.addEventListener('fetch', (event) => {
    // Solo manejamos peticiones GET
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return fetch(event.request)
                .then(networkResponse => {
                    // Si la petición a la red tiene éxito, la guardamos en caché y la devolvemos
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Si la red falla, buscamos en el caché
                    return cache.match(event.request).then(response => {
                        // Si está en caché, la devolvemos. Si no, es un error (offline y no cacheado).
                        return response; 
                    });
                });
        })
    );
});