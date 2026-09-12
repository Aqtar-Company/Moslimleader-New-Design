import { prisma } from './prisma';
import { checkLimitShared } from './tareeq-store';

// Rate-limiting every Tareeq mutation route by the client-supplied
// X-Forwarded-For header was fully bypassable: nginx (see deploy/nginx.conf)
// sets X-Forwarded-For to `$proxy_add_x_forwarded_for`, which APPENDS to
// whatever the client already sent rather than overwriting it, so a caller
// can put a different value on every request and get a fresh rate-limit
// bucket every time. Every route this is used from already requires a
// signed-in user (getAuthUser() succeeds before this is called), so keying
// on the authenticated user id instead removes the spoofable header
// entirely — a single account can't get a new bucket without a new account.
/**
 * Tareeq's rate limits, through the shared store.
 *
 * Async now, and that is the whole change at the call sites: `await` and nothing else, same
 * answer shape. What it buys is that the counters survive a restart and stay correct if the
 * app is ever run as more than one process — the in-memory version reset all twenty of
 * these on every deploy, and would have silently doubled every one of them the moment a
 * second process existed.
 *
 * `src/lib/rate-limit.ts` is deliberately NOT changed. Twenty-three shop routes call it
 * synchronously — PayPal, membership, orders, the book reader — and Tareeq must not reach
 * into the shop's request paths to improve its own.
 *
 * With no Redis configured this behaves exactly as before: same sliding window, same
 * process memory. Redis is an upgrade here, never a dependency.
 */
export function tareeqRateLimit(action: string, userId: string, maxRequests: number, windowMs: number) {
  return checkLimitShared(`tareeq-${action}:${userId}`, maxRequests, windowMs);
}

// `TareeqBan`/`User.tareeqSuspended` previously only blocked new top-level
// posts — a suspended/banned user could still comment, DM, message groups,
// follow, and react freely. Every route that lets a user create or send
// something in Tareeq must call this right after auth and reject if true.
export async function isTareeqSuspended(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tareeqSuspended: true } });
  return u?.tareeqSuspended ?? false;
}

// True if either user has blocked the other — used to stop a blocked
// relationship from starting/continuing a DM or seeing live presence,
// regardless of which side did the blocking.
export async function isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
  const block = await prisma.tareeqBlock.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { id: true },
  });
  return !!block;
}
