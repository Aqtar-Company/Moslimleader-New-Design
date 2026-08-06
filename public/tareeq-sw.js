/* tareeq-v3 — Offline, Background Sync, Periodic Sync, Rich Push, Notification Actions */
const CACHE_STATIC  = 'tareeq-v3-static';
const CACHE_PAGES   = 'tareeq-v3-pages';
const CACHE_IMAGES  = 'tareeq-v3-images';
const ALL_CACHES    = [CACHE_STATIC, CACHE_PAGES, CACHE_IMAGES];

const SHELL = [
  '/tareeq',
  '/tareeq-logo- Rounded.png',
  '/tareeq-logo- circle.png',
  '/tareeq-logo- small.png',
];

// ── Install: pre-cache shell ────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ──────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  );
});

// ── Fetch strategies ────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // API calls: always go to network (never cache)
  if (url.pathname.startsWith('/api/')) return;

  // Images: cache-first (fast, infrequently changed)
  if (/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request, CACHE_IMAGES));
    return;
  }

  // Tareeq pages: network-first, fall back to cache → shell
  if (url.pathname.startsWith('/tareeq') || url.pathname === '/tareeq') {
    e.respondWith(networkFirstPage(e.request));
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return cached ?? new Response('Offline', { status: 503 });
  }
}

async function networkFirstPage(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(CACHE_PAGES);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(CACHE_PAGES);
    const cached = await cache.match(request);
    if (cached) return cached;
    const staticCache = await caches.open(CACHE_STATIC);
    return (await staticCache.match('/tareeq')) ?? new Response('Offline', { status: 503 });
  }
}

// ── Background Sync: replay queued actions ──────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'tareeq-actions') {
    e.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  let db;
  try { db = await openIDB(); } catch { return; }
  const actions = await getAllActions(db);
  for (const action of actions) {
    try {
      const opts = {
        method: action.method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      };
      if (action.body) opts.body = JSON.stringify(action.body);
      const res = await fetch(action.url, opts);
      if (res.ok) {
        // Success — remove from queue
        await deleteAction(db, action.id);
      } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        // Permanent client error (auth expired, 404, 400…) — discard, can never succeed
        await deleteAction(db, action.id);
      }
      // 429 or 5xx: keep in queue and stop — retry on next sync event
      if (res.status === 429 || res.status >= 500) break;
    } catch {
      break; // Network down — stop; will retry on next sync event
    }
  }
}

// ── Periodic Background Sync: badge update ──────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'tareeq-badge') {
    e.waitUntil(updateBadgeSilently());
  }
});

async function updateBadgeSilently() {
  try {
    const [nRes, cRes] = await Promise.all([
      fetch('/api/tareeq/notifications?countOnly=true', { credentials: 'include' }),
      fetch('/api/tareeq/conversations?countOnly=true', { credentials: 'include' }),
    ]);
    let notifCount = 0, messageCount = 0;
    if (nRes.ok) { const d = await nRes.json(); notifCount  = d.unreadCount ?? 0; }
    if (cRes.ok) { const d = await cRes.json(); messageCount = d.unreadCount ?? 0; }
    const total = notifCount + messageCount;

    // Update PWA badge (no notification shown, fully silent)
    if ('setAppBadge' in self.navigator) {
      if (total > 0) {
        await self.navigator.setAppBadge(total).catch(() => {});
      } else {
        await self.navigator.clearAppBadge().catch(() => {});
      }
    }

    // Notify open clients so they can sync their in-memory counts
    const allClients = await clients.matchAll({ type: 'window' });
    for (const c of allClients) {
      c.postMessage({ type: 'TAREEQ_BADGE_UPDATE', notifCount, messageCount });
    }
  } catch { /* ignore — network may be unavailable */ }
}

// ── Push Notifications ───────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch { /* ignore */ }

  const title   = data.title   ?? 'طريق ★';
  const postType = data.type ?? 'generic'; // 'like' | 'comment' | 'message' | 'generic'

  // Build action buttons based on notification type
  const actions = [];
  if (postType === 'comment') {
    actions.push({ action: 'view',  title: '👁 عرض'  });
    actions.push({ action: 'reply', title: '↩ رد'    });
  } else if (postType === 'like' || postType === 'message') {
    actions.push({ action: 'view', title: '👁 عرض' });
  }

  const options = {
    body:     data.body     ?? '',
    icon:     '/tareeq-logo- circle.png',
    badge:    '/tareeq-logo- small.png',
    image:    data.image    ?? undefined,
    tag:      data.tag      ?? 'tareeq',
    renotify: true,
    data:     { url: data.url ?? '/tareeq/notifications', postId: data.postId ?? null },
    vibrate:  [150, 50, 150],
    actions,
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click: action-aware routing ─────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const notifData = e.notification.data ?? {};
  let url = notifData.url ?? '/tareeq/notifications';

  // Action button overrides
  if (e.action === 'reply' && notifData.postId) {
    url = `/tareeq/${notifData.postId}#comments`;
  } else if (e.action === 'view') {
    url = notifData.url ?? '/tareeq/notifications';
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/tareeq')) {
          if ('navigate' in c) {
            // Chrome: navigate the existing tab to the target URL
            return c.focus().then(() => c.navigate(url));
          }
          // Safari/Firefox: navigate() unavailable — open target in a new window
          return clients.openWindow(url);
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── IndexedDB helpers ────────────────────────────────────────────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tareeq-sync', 1);
    req.onupgradeneeded = ev => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = ev => resolve(ev.target.result);
    req.onerror   = ()  => reject(req.error);
  });
}

function getAllActions(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('actions', 'readonly');
    const req = tx.objectStore('actions').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = ()  => reject(req.error);
  });
}

function deleteAction(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('actions', 'readwrite');
    const req = tx.objectStore('actions').delete(id);
    req.onsuccess = () => resolve(undefined);
    req.onerror   = ()  => reject(req.error);
  });
}
