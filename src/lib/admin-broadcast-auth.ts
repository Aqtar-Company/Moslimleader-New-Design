/**
 * Who may compose and send an admin broadcast.
 *
 * ## Why this is shared and why it accepts TWO identities
 *
 * The broadcast routes were written for the shop's admin panel and guarded by the shop JWT
 * (`role === 'admin'`), because that is where the composer first lived. But the person who
 * actually runs طريق works in `/tareeq-admin`, which is a SEPARATE login with its own
 * session table — so from there the composer was unreachable: the link into the shop panel
 * lands on the storefront, since that session does not exist.
 *
 * The consequence was not a locked door but a WRONG one. `/tareeq-admin` has a
 * push-only «الإشعارات» screen that keeps no record, and that is the screen an admin
 * looking for "send a message to the members" finds and uses. A message sent there cannot
 * be found afterwards, because nothing was written — and the hunt for the cause went to
 * SMTP, which that screen never touches.
 *
 * So one guard, accepting either identity, and every route imports it instead of keeping
 * its own copy. Six identical copies of an auth check is how two of them drift apart.
 *
 * The Tareeq side is held to its own panel's rules, not loosened to match the shop's:
 * SUPER_ADMIN or MODERATOR, and `requireAdmin` there also refuses an admin who has not
 * turned on two-factor auth. Sending mail to every member is not a lesser power than the
 * moderation this panel already grants.
 */

import { getAuthUser } from '@/lib/jwt';
import { getAdminSession } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

export interface BroadcastActor {
  /** For audit rows and `AdminBroadcast.createdById`. Named `userId` to match the shop
   *  JWT payload, which the existing routes already destructure. */
  userId: string;
  name: string;
  email: string;
  /** Always 'admin'. Present so the actor satisfies the audit logger's shape without every
   *  call site having to widen it. */
  role: string;
  /** Which panel this actor signed in through — audit only. */
  via: 'shop' | 'tareeq-admin';
}

/**
 * The signed-in admin, or null. Never throws: a route answers 401 itself, and a thrown
 * Response from one of two auth systems would decide the status code for both.
 */
export async function requireBroadcastAdmin(req: Request): Promise<BroadcastActor | null> {
  const shop = await getAuthUser().catch(() => null);
  if (shop && shop.role === 'admin') {
    return { userId: shop.userId, name: shop.name || 'إدارة طريق', email: shop.email, role: 'admin', via: 'shop' };
  }

  const session = await getAdminSession(req).catch(() => null);
  if (session) {
    const { admin } = session;
    // Same bar the rest of /tareeq-admin sets, including the 2FA requirement.
    const allowed = admin.role === TareeqAdminRole.SUPER_ADMIN || admin.role === TareeqAdminRole.MODERATOR;
    if (allowed && admin.totpEnabled) {
      return { userId: admin.id, name: admin.name || admin.email, email: admin.email, role: 'admin', via: 'tareeq-admin' };
    }
  }

  return null;
}
