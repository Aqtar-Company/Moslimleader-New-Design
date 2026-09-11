/**
 * Browser-side push subscription, with ONE rule: the live subscription must be built with
 * the VAPID key this build actually signs with.
 *
 * Why this exists as its own module: the "do we have a subscription?" check was written
 * twice (useTareeqPush and TareeqNotificationsContext) and both copies did
 * `getSubscription() → reuse`. That is wrong in exactly one case, and it is the case that
 * bit us: after a key rotation the browser still holds a subscription bound to the OLD
 * applicationServerKey. Reusing it re-saves a row the push service rejects with 403
 * forever, so clearing the table server-side achieved nothing — the app put the dead
 * subscription straight back. The only way out is from the browser: unsubscribe, then
 * subscribe again with the current key.
 *
 * The opt-out flag lives here too. It used to be module-private in the context, so the
 * OTHER subscribing path (useTareeqPush, which runs on every load of the feed) could not
 * see it and re-armed push on the next reload after the user had turned it off.
 */

const OPT_OUT_KEY = 'tareeq-push-opted-out';
/** The applicationServerKey the live subscription was created with, as base64url. */
const USED_KEY = 'tareeq-push-key';

export function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/**
 * Whether the user explicitly turned push OFF.
 *
 * `PushSubscription.unsubscribe()` cannot revoke `Notification.permission`, so after an
 * opt-out the browser state ("granted, no subscription") is indistinguishable from a
 * subscription the browser dropped on its own — which the auto-recover path is meant to
 * repair. This flag is what tells the two apart. Per-device by design.
 */
export function pushOptedOut(): boolean {
  try { return localStorage.getItem(OPT_OUT_KEY) === '1'; } catch { return false; }
}

export function setPushOptedOut(v: boolean) {
  try {
    if (v) localStorage.setItem(OPT_OUT_KEY, '1');
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch { /* blocked */ }
}

function rememberKey(key: string) {
  try { localStorage.setItem(USED_KEY, key); } catch { /* blocked */ }
}

function recalledKey(): string | null {
  try { return localStorage.getItem(USED_KEY); } catch { return null; }
}

/**
 * Whether an existing subscription was created with `expected`.
 *
 * Two sources, in order of authority:
 *  1. Our own record of the key we subscribed with — authoritative, and the only one
 *     available on browsers that do not expose `options.applicationServerKey`. Without it
 *     those users could never self-heal from a rotation: the key looked unknowable, so the
 *     dead subscription was kept forever and nothing on either side could notice.
 *  2. The browser's own `options.applicationServerKey`, for a subscription made before we
 *     started recording, or in another tab.
 *
 * Unknown on both counts → treat as a match. Assuming a mismatch there would unsubscribe
 * working users on every page load.
 */
export function subscriptionMatchesKey(sub: PushSubscription, expectedB64: string): boolean {
  const remembered = recalledKey();
  if (remembered) return remembered === expectedB64;

  const actual = sub.options?.applicationServerKey;
  if (!actual) return true;
  // Per spec this is an ArrayBuffer, but a DataView would silently produce a zero-length
  // array here and unsubscribe a perfectly good subscription on every load.
  const bytes = ArrayBuffer.isView(actual)
    ? new Uint8Array(actual.buffer, actual.byteOffset, actual.byteLength)
    : new Uint8Array(actual as ArrayBuffer);
  const expected = urlB64ToUint8Array(expectedB64);
  if (bytes.length !== expected.length) return false;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== expected[i]) return false;
  return true;
}

/** Tells the server to forget an endpoint we are about to discard. */
async function forgetOnServer(endpoint: string) {
  try {
    await fetch('/api/tareeq/push-unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ endpoint }),
    });
  } catch { /* offline — the row stays, but it is at worst one doomed send */ }
}

/**
 * Returns a subscription guaranteed to use `vapidPublic`, re-creating it if the browser is
 * holding one from a previous key. Returns null when there is no key or the browser
 * refuses.
 *
 * Never call `pushManager.subscribe()` directly — an existing subscription with a different
 * key makes it throw InvalidStateError, which is what made an earlier version report
 * "denied" to users who had actually granted permission.
 */
export async function ensurePushSubscription(
  reg: ServiceWorkerRegistration,
  vapidPublic: string,
): Promise<PushSubscription | null> {
  if (!vapidPublic) return null;

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    if (subscriptionMatchesKey(existing, vapidPublic)) {
      rememberKey(vapidPublic);
      return existing;
    }
    // Stale key — the server can never deliver to this. Delete the server's row FIRST:
    // the replacement gets a brand-new endpoint, and push-subscribe upserts by endpoint,
    // so without this the old row survives as a permanent zombie — one doomed HTTPS
    // request and one warning line on every notification, for the life of the account.
    await forgetOnServer(existing.endpoint);
    await existing.unsubscribe().catch(() => { /* keep going; subscribe may still work */ });
  }

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(vapidPublic) as BufferSource,
    });
    rememberKey(vapidPublic);
    return sub;
  } catch (err) {
    // Do not fail silently. Reaching here after replacing a stale subscription leaves the
    // device with NO subscription at all, which is worse than where it started, and the
    // only previous signal was a toggle that quietly refused to move.
    console.warn('[tareeq-push] subscribe failed after discarding a stale subscription', err);
    try { localStorage.removeItem(USED_KEY); } catch { /* blocked */ }
    return null;
  }
}
