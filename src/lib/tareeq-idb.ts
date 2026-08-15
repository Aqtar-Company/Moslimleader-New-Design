// Client-side IndexedDB helpers.
// tareeq-sync   (v1) — Background Sync action queue replayed by service worker.
// tareeq-offline (v1) — User-pinned posts for offline reading.

interface QueuedAction {
  url: string;
  method: string;
  body?: unknown;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tareeq-sync', 1);
    req.onupgradeneeded = ev => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = ev => resolve((ev.target as IDBOpenDBRequest).result);
    req.onerror   = ()  => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror    = ()  => reject(tx.error);
  });
}

// ── Offline reading store ────────────────────────────────────────────

export interface OfflinePost {
  id: string;
  title:      string | null;
  content:    string;
  imageUrl:   string | null;
  imageUrls:  string[] | null;
  authorName: string;
  category:   string | null;
  createdAt:  string;
  savedAt:    number;
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tareeq-offline', 1);
    req.onupgradeneeded = ev => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('posts')) {
        const store = db.createObjectStore('posts', { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt');
      }
    };
    req.onsuccess = ev => resolve((ev.target as IDBOpenDBRequest).result);
    req.onerror   = ()  => reject(req.error);
  });
}

export async function savePostOffline(post: Omit<OfflinePost, 'savedAt'>): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('posts', 'readwrite');
    tx.objectStore('posts').put({ ...post, savedAt: Date.now() });
    await txDone(tx);
  } catch { /* private mode */ }
}

export async function removePostOffline(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('posts', 'readwrite');
    tx.objectStore('posts').delete(id);
    await txDone(tx);
  } catch { /* ignore */ }
}

export async function isPostSavedOffline(id: string): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  try {
    const db  = await openOfflineDB();
    const tx  = db.transaction('posts', 'readonly');
    const req = tx.objectStore('posts').get(id);
    return await new Promise(res => {
      req.onsuccess = () => res(!!req.result);
      req.onerror   = () => res(false);
    });
  } catch { return false; }
}

export async function getAllOfflinePosts(): Promise<OfflinePost[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db  = await openOfflineDB();
    const tx  = db.transaction('posts', 'readonly');
    const req = tx.objectStore('posts').index('savedAt').getAll();
    return await new Promise((res, rej) => {
      req.onsuccess = () => res((req.result as OfflinePost[]).reverse());
      req.onerror   = () => rej(req.error);
    });
  } catch { return []; }
}

export async function getOfflineStorageBytes(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0;
  try {
    const posts = await getAllOfflinePosts();
    return new TextEncoder().encode(JSON.stringify(posts)).length;
  } catch { return 0; }
}

export async function clearAllOfflinePosts(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('posts', 'readwrite');
    tx.objectStore('posts').clear();
    await txDone(tx);
  } catch { /* ignore */ }
}

// ── Background Sync action queue ─────────────────────────────────────

// Persist an action to IndexedDB and register a Background Sync.
// If the user is online and the SW triggers sync immediately, the action is
// replayed right away. If offline, it is replayed when connectivity returns.
export async function queueAction(action: Omit<QueuedAction, 'createdAt'>): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDB();
    const tx = db.transaction('actions', 'readwrite');
    tx.objectStore('actions').add({ ...action, createdAt: Date.now() });
    await txDone(tx);

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      type SyncReg = ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } };
      await (reg as SyncReg).sync.register('tareeq-actions').catch(() => {});
    }
  } catch { /* IDB unavailable in some private-browsing modes — fail silently */ }
}
