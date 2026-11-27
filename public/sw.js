// Service Worker — фоновый помощник приложения.
// Этап 1: даёт приложению открываться без интернета (берёт файлы из кэша).
// Этап 4: здесь же будем принимать push-уведомления.

const CACHE = 'daily-planner-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Стратегия «сначала сеть»: всегда берём свежую версию,
// а если интернета нет — показываем сохранённую копию.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./')))
  );
});
