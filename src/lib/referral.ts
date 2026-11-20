import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { movePoints } from '@/lib/loyalty';

/**
 * «ادعُ صديقاً» — the invite programme.
 *
 * Every member has a personal link, moslimleader.com/r/<code>. Opening it stores the code in
 * a cookie (REF_COOKIE, 60 days) and lands on /badge; whoever then creates an account is
 * recorded as invited by the code's owner.
 *
 *   - The new member gets REFERRAL_WELCOME_POINTS at sign-up.
 *   - The inviter gets REFERRAL_REWARD_POINTS when the new member's FIRST order is
 *     DELIVERED — not when it is placed, so a cancelled or fake order earns nothing.
 *
 * The badge page puts the member's own link in the post they share, so every badge on
 * Facebook or WhatsApp is a door that counts for whoever posted it.
 */

export const REF_COOKIE = 'ml_ref';
export const REFERRAL_WELCOME_POINTS = 50;   // 5 EGP
export const REFERRAL_REWARD_POINTS = 200;   // 20 EGP
/** Only an account this young can be attributed — an old account opening a link is not "invited". */
const ATTRIBUTION_WINDOW_MS = 60 * 60 * 1000;

// No 0/O, 1/I/L: the code is read aloud and typed from screenshots.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomCode = (n = 6) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export const normalizeCode = (raw: string | null | undefined) => {
  const c = (raw || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(c) ? c : null;
};

/** The member's code, made on first use. */
export async function ensureReferralCode(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (!u) return null;
  if (u.referralCode) return u.referralCode;
  for (let i = 0; i < 6; i++) {
    const code = randomCode(i < 3 ? 6 : 8);
    try {
      // Only fill an empty value: two requests racing here must not hand out two codes.
      const r = await prisma.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } });
      if (r.count) return code;
      return (await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } }))?.referralCode ?? null;
    } catch {
      // Unique clash — try another.
    }
  }
  return null;
}

export const referralLink = (code: string) => `https://moslimleader.com/r/${code}`;

/**
 * Called right after an account is created (email sign-up and both OAuth callbacks) with the
 * cookie's value. Never throws, never blocks a sign-up.
 */
export async function attachReferral(newUserId: string, rawCode: string | null | undefined): Promise<void> {
  try {
    const code = normalizeCode(rawCode);
    if (!code) return;
    const [user, referrer] = await Promise.all([
      prisma.user.findUnique({ where: { id: newUserId }, select: { id: true, createdAt: true, referredById: true } }),
      prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } }),
    ]);
    if (!user || !referrer || referrer.id === user.id || user.referredById) return;
    if (Date.now() - user.createdAt.getTime() > ATTRIBUTION_WINDOW_MS) return;
    const r = await prisma.user.updateMany({ where: { id: user.id, referredById: null }, data: { referredById: referrer.id } });
    if (r.count) await movePoints(user.id, REFERRAL_WELCOME_POINTS, 'referral_welcome');
  } catch (err) {
    console.error('[referral attach]', err);
  }
}

/** On a delivered order: reward whoever invited this customer, once. */
export async function rewardReferrerForOrder(customerId: string): Promise<void> {
  try {
    const u = await prisma.user.findUnique({ where: { id: customerId }, select: { referredById: true, referralRewardedAt: true } });
    if (!u?.referredById || u.referralRewardedAt) return;
    // Claim first, so two deliveries arriving together reward once.
    const claim = await prisma.user.updateMany({
      where: { id: customerId, referralRewardedAt: null },
      data: { referralRewardedAt: new Date() },
    });
    if (!claim.count) return;
    await movePoints(u.referredById, REFERRAL_REWARD_POINTS, 'referral_reward');
  } catch (err) {
    console.error('[referral reward]', err);
  }
}

/** What the account page shows about the member's invites. */
export async function referralStats(userId: string) {
  const code = await ensureReferralCode(userId);
  const [joined, rewarded] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.user.count({ where: { referredById: userId, referralRewardedAt: { not: null } } }),
  ]);
  return {
    code,
    link: code ? referralLink(code) : null,
    joined,
    rewarded,
    welcomePoints: REFERRAL_WELCOME_POINTS,
    rewardPoints: REFERRAL_REWARD_POINTS,
  };
}
