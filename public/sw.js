// Service Worker — фоновый помощник приложения.
// Этап 1: даёт приложению открываться без интернета (берёт файлы из кэша).
// Этап 4: принимает push-уведомления от сервера и показывает их.

const CACHE = 'daily-planner-v2';

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

// ---------- Push-уведомления ----------
// Сервер присылает { title, body, tag, url } — показываем уведомление.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Daily Planner', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag,          // одно и то же дело не дублируется в списке уведомлений
      data: { url: data.url || './' },
    })
  );
});

// Нажали на уведомление — открываем (или показываем уже открытое) приложение.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(event.notification.data?.url || './');
    })
  );
});
