// Client-side IndexedDB helper for Background Sync action queue.
// Queued actions are replayed by the service worker on the 'sync' event.

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
