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
 */

export function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/**
 * Whether an existing subscription was created with `expected`.
 *
 * Returns true when the key cannot be read at all: `options.applicationServerKey` is not
 * available in every browser, and assuming a mismatch there would unsubscribe working
 * users on every load.
 */
export function subscriptionMatchesKey(sub: PushSubscription, expected: Uint8Array): boolean {
  const actual = sub.options?.applicationServerKey;
  if (!actual) return true;
  const bytes = new Uint8Array(actual as ArrayBuffer);
  if (bytes.length !== expected.length) return false;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== expected[i]) return false;
  return true;
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
  const key = urlB64ToUint8Array(vapidPublic);

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    if (subscriptionMatchesKey(existing, key)) return existing;
    // Stale key — the server can never deliver to this. Drop it and start over.
    await existing.unsubscribe().catch(() => { /* keep going; subscribe may still work */ });
  }

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key as BufferSource,
  }).catch(() => null);
}
