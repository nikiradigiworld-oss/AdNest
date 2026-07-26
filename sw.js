const CACHE_NAME = 'anaar-v17';
const BASE = '';
const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/login.html',
  BASE + '/signup.html',
  BASE + '/viewer-dashboard.html',
  BASE + '/advertiser-dashboard.html',
  BASE + '/admin.html',
  BASE + '/icon.svg',
  BASE + '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', event => {
  let data = { title: 'Anaar', body: 'You have a new notification.', icon: '/icon.svg', url: '/' };
  try { if (event.data) Object.assign(data, JSON.parse(event.data.text())); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/icon.svg',
      data: { url: data.url }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const match = list.find(c => c.url === url);
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Network-first: always try fresh, fall back to cache offline
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
