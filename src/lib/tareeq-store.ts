/**
 * A shared key store for Tareeq, backed by Redis when it is there and by process memory
 * when it is not.
 *
 * ## The rule this file exists to obey
 *
 * Tareeq lives inside the Moslim Leader site — same process, same database, same server as
 * the shop. **Nothing here may take the shop down.** So every path below fails open to the
 * old in-memory behaviour: no REDIS_URL, Redis refusing connections, Redis dying
 * mid-request, a timeout — all of them land on exactly what the code did before this file
 * existed. Redis is an upgrade, never a dependency.
 *
 * It is also deliberately NOT wired into `src/lib/rate-limit.ts`, which twenty-three shop
 * routes call — PayPal, membership, orders, the book reader. That function stays
 * synchronous and untouched. Only Tareeq's own wrapper moves.
 *
 * ## What it fixes
 *
 * The rate-limit counters lived in one process's memory, so every `pm2 restart` reset all
 * twenty of Tareeq's limits — four deploys in one day meant four resets. And the moment a
 * second process is started to share load, each one counts alone, so a limit of ten per
 * hour silently becomes twenty.
 */

import type { Redis } from 'ioredis';

/** Sliding-window buckets, when there is no Redis. Identical to the previous behaviour. */
const memoryWindows = new Map<string, number[]>();
/** Plain key/value with expiry, when there is no Redis. */
const memoryValues = new Map<string, { v: string; expiresAt: number }>();

let client: Redis | null = null;
let clientTried = false;
/**
 * Timestamp until which Redis is treated as unavailable.
 *
 * This used to be a permanent flag set on the first failure. That was wrong twice over:
 * ioredis emits one `error` per failed reconnection attempt even when the connection later
 * succeeds, so a single blip at boot — or Redis simply starting a second after the app —
 * latched the whole feature into memory mode until the next deploy, silently. Now a failure
 * only parks Redis for a cooldown, after which the next request tries it again.
 */
let redisDownUntil = 0;
const REDIS_COOLDOWN_MS = 60_000;

function markRedisDown() {
  redisDownUntil = Date.now() + REDIS_COOLDOWN_MS;
}

/**
 * The Redis client, or null.
 *
 * `lazyConnect` plus a short timeout on purpose: a server where Redis is not installed
 * must not make every Tareeq request wait on a connection that will never open.
 */
function getClient(): Redis | null {
  if (Date.now() < redisDownUntil) return null;
  if (clientTried) return client;
  clientTried = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    // Required lazily so a server without the package, or without Redis configured, never
    // pays for loading it.
     
    const IORedis = require('ioredis');
    client = new IORedis(url, {
      lazyConnect: false,
      connectTimeout: 1000,
      commandTimeout: 1000,
      maxRetriesPerRequest: 1,
      // Without this ioredis retries forever and logs on every attempt, which on a server
      // with no Redis is a permanent stream of noise in the shop's own logs.
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
      // MUST stay true. With it false ioredis rejects any command issued before the socket
      // is writable — and the very first Tareeq request after a `pm2 restart` always is one,
      // because the client is created on that request. That rejection tripped the down-flag,
      // so Redis was dropped forever on every boot and nothing ever logged it. The queue is
      // bounded in practice by `commandTimeout` above: a command that never gets a writable
      // socket rejects after a second and falls back to memory like any other failure.
      enableOfflineQueue: true,
    }) as Redis;

    client.on('error', () => {
      // Swallowed on purpose. An unhandled 'error' on an ioredis client is an unhandled
      // exception, and an unhandled exception in this process takes the SHOP down with it.
      // A cooldown rather than a permanent flag — see `redisDownUntil`.
      markRedisDown();
    });
    return client;
  } catch {
    markRedisDown();
    return null;
  }
}

/** True when Redis answered a ping — used by the health endpoint, never by request paths. */
export async function storeIsShared(): Promise<boolean> {
  const c = getClient();
  if (!c) return false;
  try {
    await c.ping();
    redisDownUntil = 0;
    return true;
  } catch {
    markRedisDown();
    return false;
  }
}

/**
 * One sliding-window rate-limit check.
 *
 * Same signature and same answer shape as the in-memory `checkRateLimit`, so a caller can
 * move to it by adding `await` and nothing else.
 */
export async function checkLimitShared(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const c = getClient();

  if (c) {
    // Set once the hit has been recorded in Redis. If a later call in the same block throws
    // (the `pexpire`, say), the hit is already counted there and must NOT be counted again
    // in memory — a double-count that halves the effective limit.
    let recorded = false;
    try {
      const now = Date.now();
      const rkey = `rl:${key}`;

      // Two plain calls rather than a pipeline: the typing of a mixed `multi().exec()` is
      // awkward enough that getting it wrong silently is likelier than the round trip is
      // expensive, and this runs against a Redis on the same machine.
      await c.zremrangebyscore(rkey, 0, now - windowMs);
      const count = await c.zcard(rkey);

      if (count >= maxRequests) {
        // The key's remaining life IS how long until the window clears, so there is no
        // need to read the oldest member's score to work it out.
        const ttl = await c.pttl(rkey);
        return { allowed: false, retryAfterMs: ttl > 0 ? ttl : windowMs };
      }

      // A unique member per hit: the score is the timestamp, and two requests in the same
      // millisecond would otherwise collapse into one entry and under-count.
      await c.zadd(rkey, now, `${now}-${Math.random().toString(36).slice(2, 8)}`);
      recorded = true;
      // Always re-set: without it a key whose window keeps being refreshed never expires.
      await c.pexpire(rkey, windowMs);

      return { allowed: true, retryAfterMs: 0 };
    } catch {
      markRedisDown();
      // Falls through to memory below rather than rejecting the request. A rate limiter
      // that starts refusing traffic because its own storage is unavailable is worse than
      // one that briefly forgets.
      if (recorded) return { allowed: true, retryAfterMs: 0 };
    }
  }

  const now = Date.now();
  const prev = memoryWindows.get(key) ?? [];
  const recent = prev.filter(t => now - t < windowMs);
  if (recent.length >= maxRequests) {
    return { allowed: false, retryAfterMs: windowMs - (now - recent[0]) };
  }
  recent.push(now);
  memoryWindows.set(key, recent);

  // The in-memory map is never emptied by anything else, so it grows with every key ever
  // seen. Bounded here because this process also serves the shop.
  // An expiry-only sweep can delete nothing at all (every key still fresh) and then re-run
  // on every following request forever, so the oldest-first pass below actually bounds it.
  if (memoryWindows.size > 20_000) {
    for (const [k, times] of memoryWindows) {
      if (memoryWindows.size <= 10_000) break;
      if (!times.length || now - times[times.length - 1] > windowMs) memoryWindows.delete(k);
    }
    for (const k of memoryWindows.keys()) {
      if (memoryWindows.size <= 10_000) break;
      memoryWindows.delete(k);
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

/** Sets a value with a time to live, in seconds. */
export async function setShared(key: string, value: string, ttlSeconds: number): Promise<void> {
  const c = getClient();
  if (c) {
    try {
      await c.set(key, value, 'EX', ttlSeconds);
      return;
    } catch {
      markRedisDown();
    }
  }
  memoryValues.set(key, { v: value, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memoryValues.size > 20_000) {
    const now = Date.now();
    for (const [k, entry] of memoryValues) {
      if (memoryValues.size <= 10_000) break;
      if (entry.expiresAt <= now) memoryValues.delete(k);
    }
    // Same reason as the windows map: oldest-first, so it stays bounded even when nothing
    // has expired yet.
    for (const k of memoryValues.keys()) {
      if (memoryValues.size <= 10_000) break;
      memoryValues.delete(k);
    }
  }
}

/**
 * Claims a key for a period, atomically. Returns true only for the caller that got it.
 *
 * A `getShared` then `setShared` pair is NOT the same thing: two calls arriving together
 * both read nothing and both proceed. That matters for the weekly digest, where losing the
 * race means a second send of the same 300 emails from the address the SHOP uses for order
 * receipts.
 */
export async function claimShared(key: string, ttlSeconds: number): Promise<boolean> {
  const c = getClient();
  if (c) {
    try {
      const res = await c.set(key, '1', 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    } catch {
      markRedisDown();
      // Falls through to the memory claim below.
    }
  }
  // Single-process fallback. Node runs this synchronously between awaits, so the read and
  // the write cannot interleave here the way they can across processes.
  const now = Date.now();
  const entry = memoryValues.get(key);
  if (entry && entry.expiresAt > now) return false;
  memoryValues.set(key, { v: '1', expiresAt: now + ttlSeconds * 1000 });
  return true;
}

/** Releases a claim taken by `claimShared`, so the period can be claimed again. */
export async function releaseShared(key: string): Promise<void> {
  const c = getClient();
  if (c) {
    try {
      await c.del(key);
      return;
    } catch {
      markRedisDown();
    }
  }
  memoryValues.delete(key);
}

export async function getShared(key: string): Promise<string | null> {
  const c = getClient();
  if (c) {
    try {
      return await c.get(key);
    } catch {
      markRedisDown();
    }
  }
  const entry = memoryValues.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryValues.delete(key);
    return null;
  }
  return entry.v;
}
