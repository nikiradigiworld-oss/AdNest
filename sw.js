const CACHE_NAME = 'anaar-v33';
const BASE = '';
const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/login',
  BASE + '/signup',
  BASE + '/viewer-dashboard',
  BASE + '/advertiser-dashboard',
  BASE + '/admin',
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
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
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

  // HTML navigation requests: always fetch from network (never serve stale HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets (icons, manifest, etc): network-first with cache fallback
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
