const CACHE = 'tareeq-v2';
const SHELL = ['/tareeq', '/tareeq-logo- Rounded.png', '/tareeq-logo- circle.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && url.pathname.startsWith('/tareeq')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/tareeq')))
  );
});

// ── Push Notifications ──────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch { /* ignore */ }

  const title = data.title ?? 'طريق ★';
  const options = {
    body:    data.body  ?? '',
    icon:    '/tareeq-logo- circle.png',
    badge:   '/tareeq-logo- small.png',
    tag:     data.tag   ?? 'tareeq',
    renotify: true,
    data:    { url: data.url ?? '/tareeq/notifications' },
    vibrate: [150, 50, 150],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/tareeq/notifications';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/tareeq') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
