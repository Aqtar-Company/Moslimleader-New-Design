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
/** Set on the first failure; stops every later request paying a connection timeout. */
let redisDown = false;

/**
 * The Redis client, or null.
 *
 * `lazyConnect` plus a short timeout on purpose: a server where Redis is not installed
 * must not make every Tareeq request wait on a connection that will never open.
 */
function getClient(): Redis | null {
  if (redisDown) return null;
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
      enableOfflineQueue: false,
    }) as Redis;

    client.on('error', () => {
      // Swallowed on purpose. An unhandled 'error' on an ioredis client is an unhandled
      // exception, and an unhandled exception in this process takes the SHOP down with it.
      // One flag, and everything falls back to memory from here.
      redisDown = true;
    });
    return client;
  } catch {
    redisDown = true;
    return null;
  }
}

/** True when Redis answered a ping — used by the health endpoint, never by request paths. */
export async function storeIsShared(): Promise<boolean> {
  const c = getClient();
  if (!c) return false;
  try {
    await c.ping();
    return true;
  } catch {
    redisDown = true;
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
      // Always re-set: without it a key whose window keeps being refreshed never expires.
      await c.pexpire(rkey, windowMs);

      return { allowed: true, retryAfterMs: 0 };
    } catch {
      redisDown = true;
      // Falls through to memory below rather than rejecting the request. A rate limiter
      // that starts refusing traffic because its own storage is unavailable is worse than
      // one that briefly forgets.
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
  if (memoryWindows.size > 20_000) {
    for (const [k, times] of memoryWindows) {
      if (!times.length || now - times[times.length - 1] > windowMs) memoryWindows.delete(k);
      if (memoryWindows.size <= 10_000) break;
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
      redisDown = true;
    }
  }
  memoryValues.set(key, { v: value, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memoryValues.size > 20_000) {
    const now = Date.now();
    for (const [k, entry] of memoryValues) {
      if (entry.expiresAt <= now) memoryValues.delete(k);
      if (memoryValues.size <= 10_000) break;
    }
  }
}

export async function getShared(key: string): Promise<string | null> {
  const c = getClient();
  if (c) {
    try {
      return await c.get(key);
    } catch {
      redisDown = true;
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
