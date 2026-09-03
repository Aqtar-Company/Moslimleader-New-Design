/* tareeq-v7 — Offline, Background Sync, Periodic Sync, Rich Push, Media-channel audio */
const CACHE_STATIC  = 'tareeq-v7-static';
const CACHE_PAGES   = 'tareeq-v7-pages';
const CACHE_IMAGES  = 'tareeq-v7-images';
const ALL_CACHES    = [CACHE_STATIC, CACHE_PAGES, CACHE_IMAGES];

const SHELL = [
  '/tareeq',
  '/Tareeq-big.png',
  '/Tareeq-small.png',
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

  // Cross-origin images (R2, CDN) — let browser handle directly, never cache
  // Opaque SW responses for cross-origin images cause blank-after-load bugs
  if (url.origin !== self.location.origin) return;

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
  const postType = data.type ?? 'generic'; // 'like' | 'comment' | 'message' | 'call' | 'generic'

  // Build action buttons based on notification type
  const actions = [];
  if (postType === 'comment') {
    actions.push({ action: 'view',  title: '👁 عرض'  });
    actions.push({ action: 'reply', title: '↩ رد'    });
  } else if (postType === 'like' || postType === 'message') {
    actions.push({ action: 'view', title: '👁 عرض' });
  } else if (postType === 'call') {
    actions.push({ action: 'view', title: '📞 فتح' });
  }

  const isCall = postType === 'call';
  const options = {
    body:              data.body  ?? '',
    icon:              data.icon  ?? '/Tareeq-big.png',
    badge:             '/Tareeq-small.png',
    image:             data.image ?? undefined,
    tag:               data.tag   ?? 'tareeq',
    renotify:          true,
    requireInteraction: isCall,   // call notifications stay until dismissed
    silent:            false,
    data:              { url: data.url ?? '/tareeq/notifications', postId: data.postId ?? null, callId: data.callId ?? null },
    vibrate:           isCall ? [400, 100, 400, 100, 400, 100, 400] : [150, 50, 150],
    actions,
  };

  if (isCall && data.callId) {
    // Repeated ringing: show notification + wake windows, then re-ring every 4s
    // for up to 24 seconds (6 iterations) — stop early if call is no longer ringing.
    // Each iteration uses a UNIQUE tag so the OS treats it as a new notification
    // and plays the system sound again (reusing the same tag silences subsequent rings
    // on Android/iOS even with renotify:true).
    e.waitUntil((async () => {
      // Wake open windows immediately
      const windowList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      // visibilityState === 'visible' is more reliable than .focused on Android PWA
      const hasVisibleWindow = windowList.some(c => c.visibilityState === 'visible');
      for (const c of windowList) {
        c.postMessage({ type: 'TAREEQ_INCOMING_CALL', callId: data.callId });
      }

      // If the app is visible in the foreground, the in-app ring handles audio.
      // Showing an OS notification on top would cause dual sound (OS chime + Web Audio ring).
      if (hasVisibleWindow) return;

      const baseTag = data.tag ?? `call-${data.callId}`;

      for (let i = 0; i < 6; i++) {
        // Close previous ring notification so only one is visible at a time
        if (i > 0) {
          const prev = await self.registration.getNotifications({ tag: `${baseTag}-r${i - 1}` });
          prev.forEach(n => n.close());
        }

        await self.registration.showNotification(title, {
          ...options,
          tag: `${baseTag}-r${i}`,   // unique tag → OS triggers sound each time
          renotify: false,            // not needed with unique tags
        });

        if (i < 5) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const res = await fetch('/api/tareeq/calls/' + data.callId + '/ringing', { credentials: 'include' });
            const json = await res.json();
            if (!json.ringing) {
              // Call ended — close the last ring notification
              const last = await self.registration.getNotifications({ tag: `${baseTag}-r${i}` });
              last.forEach(n => n.close());
              break;
            }
          } catch { /* network error — keep ringing */ }
        }
      }
    })());
  } else {
    // Non-call notification: single shot.
    // Only suppress the OS sound when a *visible* controlled window is open
    // (visibilityState === 'visible' means the tab is foregrounded/unlocked).
    // Backgrounded, minimized, or uncontrolled tabs can't reliably resume AudioContext
    // from a SW postMessage, so we fall back to the OS sound for those.
    e.waitUntil((async () => {
      // Only controlled clients run the new TareeqMediaSession handler
      const windowList = await clients.matchAll({ type: 'window' });
      const visibleWindows = windowList.filter(c => c.visibilityState === 'visible');
      const hasVisibleWindow = visibleWindows.length > 0;
      await self.registration.showNotification(title, { ...options, silent: hasVisibleWindow });
      for (const c of visibleWindows) {
        c.postMessage({ type: 'TAREEQ_PLAY_SOUND', notifType: postType });
      }
    })());
  }
});

// ── Notification Click: action-aware routing ─────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const notifData = e.notification.data ?? {};
  let url = notifData.url ?? '/tareeq/notifications';
  const isCall = !!notifData.callId;

  // Action button overrides
  if (e.action === 'reply' && notifData.postId) {
    url = `/tareeq/${notifData.postId}#comments`;
  } else if (e.action === 'view') {
    url = notifData.url ?? '/tareeq/notifications';
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // For calls: always navigate to the call URL so the incoming call UI shows
      if (isCall) {
        for (const c of list) {
          if (c.url.includes('/tareeq')) {
            return c.focus().then(() => {
              if ('navigate' in c) return c.navigate(url);
              // If navigate unavailable, post a message so TareeqIncomingCall triggers burst-poll
              c.postMessage({ type: 'TAREEQ_INCOMING_CALL', callId: notifData.callId });
            });
          }
        }
        return clients.openWindow(url);
      }

      // Non-call notifications: prefer existing tab
      for (const c of list) {
        if (c.url.includes('/tareeq')) {
          if ('navigate' in c) {
            return c.focus().then(() => c.navigate(url));
          }
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
