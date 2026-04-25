const CACHE_NAME = 'mi-cambio-v5'; // Actualizamos la versión para forzar el registro
const ASSETS = [
    './public/index.html',
    './public/style.css',
    './public/script.js',
    './icons/cambio.png',
    './icons/icon.png',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.pixabay.com/audio/2022/03/24/audio_732294402e.mp3',
    'https://cdn.pixabay.com/audio/2021/08/04/audio_bb630cc098.mp3'
];

// Instalación: Cachear recursos estáticos
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activación: Limpiar cachés viejas
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// Fetch: Estrategia "Cache First" con "Dynamic Caching" para nuevos recursos
self.addEventListener('fetch', (e) => {
    // No interceptar peticiones a la API de tasas para asegurar que siempre intente traer datos frescos.
    // El script.js ya maneja el modo offline de las tasas usando LocalStorage.
    if (e.request.url.includes('api.exchangerate-api.com')) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((response) => {
            if (response) {
                return response; // Si está en la caché, devuélvelo inmediatamente
            }

            // Si no está, búscalo en internet y guárdalo en caché dinámicamente (ej. las fuentes de iconos)
            return fetch(e.request).then((networkResponse) => {
                // Validar que la respuesta sea un éxito antes de cachear
                if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseToCache);
                });
                return networkResponse;
            });
        })
    );
});