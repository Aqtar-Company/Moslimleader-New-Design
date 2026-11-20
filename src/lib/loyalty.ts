import { prisma } from '@/lib/prisma';

/**
 * The shop's loyalty points — one place for the rules, so the checkout, the order routes,
 * the admin and the webhooks cannot drift apart.
 *
 * Value: 10 points = 1 EGP of discount (100 points = 10 EGP).
 * Earning: 1 point per 10 EGP of what the customer actually pays for the GOODS (after
 *   coupons, membership and points discounts; shipping excluded).
 * Redemption: EGP orders only, and never more than the goods total.
 *
 * Every movement is a LoyaltyTransaction row, and User.loyaltyPoints is kept equal to the
 * sum of that user's rows. `reason` values:
 *   order_earn / order_earn_reversal       — earned on an order / taken back when it is cancelled
 *   order_redeem / order_redeem_refund     — spent on an order / given back when it is cancelled
 *   first_child, child_birthday            — gifts
 *   referral_welcome, referral_reward      — the invite programme (src/lib/referral.ts)
 *   manual, expired                        — reserved
 */

export const POINTS_PER_EGP = 10;
/** Order statuses in which an order no longer counts — its points are undone. */
const DEAD_STATUSES = new Set(['cancelled', 'returned', 'payment_failed']);

/** Points earned for paying `goodsTotal` in `currency`, or 0 when that currency has no EGP rate here. */
export function pointsForPurchase(goodsTotal: number, currency: string | null | undefined): number {
  const c = (currency || 'EGP').toUpperCase();
  // USD × 50 is the rate the rest of the shop uses for books and PayPal.
  const egp = c === 'EGP' ? goodsTotal : c === 'USD' ? goodsTotal * 50 : 0;
  return Math.max(0, Math.floor(egp / 10));
}

/** Give (positive) or take (negative) points, writing the ledger row and the balance together. */
export async function movePoints(userId: string, points: number, reason: string, orderId?: string | null) {
  if (!points) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { loyaltyPoints: { increment: points } } }),
    prisma.loyaltyTransaction.create({ data: { userId, points, reason, orderId: orderId ?? null } }),
  ]);
}

/**
 * Bring an order's points in line with its CURRENT status. Safe to call after any status
 * change, any number of times: it compares what the ledger already says for this order with
 * what it should say, and writes only the difference.
 *
 * - A dead order (cancelled / returned / payment failed) keeps no earned points and gets its
 *   redeemed points back.
 * - An order brought back to life (un-cancelled) gets both re-applied.
 * - A delivered order is also where an invite is rewarded (see referral.ts).
 *
 * Taking points back never drives a balance below zero: if the customer already spent
 * them, only what is left is taken.
 */
export async function syncOrderLoyalty(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, userId: true, status: true } });
    if (!order?.userId) return;
    const rows = await prisma.loyaltyTransaction.findMany({ where: { orderId }, select: { points: true, reason: true } });
    const sum = (reasons: string[]) => rows.filter(r => reasons.includes(r.reason)).reduce((s, r) => s + r.points, 0);

    const earned = sum(['order_earn']);                            // original, ≥ 0
    const earnedNet = sum(['order_earn', 'order_earn_reversal']);
    const spent = -sum(['order_redeem']);                         // original, ≥ 0
    const spentNet = -sum(['order_redeem', 'order_redeem_refund']);

    const alive = !DEAD_STATUSES.has(order.status);
    const earnDelta = (alive ? earned : 0) - earnedNet;           // + give back, − take away
    const spendDelta = spentNet - (alive ? spent : 0);            // + refund, − charge again

    if (earnDelta < 0) {
      const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { loyaltyPoints: true } });
      const take = Math.min(-earnDelta, Math.max(0, user?.loyaltyPoints ?? 0));
      // Record the full reversal in the ledger only up to what could be taken, so a later
      // un-cancel re-applies exactly that.
      if (take > 0) await movePoints(order.userId, -take, 'order_earn_reversal', orderId);
    } else if (earnDelta > 0) {
      await movePoints(order.userId, earnDelta, 'order_earn_reversal', orderId);
    }

    if (spendDelta > 0) {
      await movePoints(order.userId, spendDelta, 'order_redeem_refund', orderId);
    } else if (spendDelta < 0) {
      const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { loyaltyPoints: true } });
      const take = Math.min(-spendDelta, Math.max(0, user?.loyaltyPoints ?? 0));
      if (take > 0) await movePoints(order.userId, -take, 'order_redeem_refund', orderId);
    }

    if (order.status === 'delivered') {
      const { rewardReferrerForOrder } = await import('@/lib/referral');
      await rewardReferrerForOrder(order.userId);
    }
  } catch (err) {
    // Points are never allowed to break an order flow.
    console.error('[loyalty sync]', orderId, err);
  }
}
