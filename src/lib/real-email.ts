/**
 * Is this address a real mailbox, or one the system invented?
 *
 * A manual order and a guest checkout both need a `User` row, and a row needs an email. So
 * the shop synthesises one from the phone number: `manual-01xxxxxxxxx@imported.local`,
 * `guest-01xxxxxxxxx@guest.moslimleader.com`. That is a key, not an address. `.local` is
 * not a real TLD and never resolves; the guest domain is ours and accepts nothing.
 *
 * These rows are indistinguishable from real customers by every other measure — they have
 * names, orders, delivered parcels. A campaign that reasons "a parcel reached them, so the
 * address works" selects thousands of them, and every message bounces at once. That is the
 * fastest way to lose the domain's reputation, and the shop's order mail rides on it.
 *
 * So the check lives in one place and anything that mails a list uses it.
 */

/** Domains that exist only to fill the email column. */
const SYNTHETIC_DOMAINS = [
  'imported.local',
  'guest.moslimleader.com',
  'placeholder.local',
  'noemail.local',
];

/** Prefixes the shop generates when it has a phone number and no address. */
const SYNTHETIC_PREFIXES = ['manual-', 'guest-', 'imported-', 'nouser-'];

export function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const e = email.trim().toLowerCase();
  if (!e.includes('@')) return true;
  const [local, domain] = e.split('@');
  if (!local || !domain) return true;
  // Any `.local` address, not only the ones listed: it is a reserved TLD for local
  // networks and can never receive internet mail.
  if (domain.endsWith('.local') || domain.endsWith('.invalid') || domain === 'localhost') return true;
  if (SYNTHETIC_DOMAINS.includes(domain)) return true;
  if (SYNTHETIC_PREFIXES.some(p => local.startsWith(p))) return true;
  return false;
}

/** The inverse, for filters that read better in the positive. */
export function isMailableEmail(email: string | null | undefined): boolean {
  return !isSyntheticEmail(email);
}

/**
 * A Prisma `where` fragment excluding the synthetic domains. It cannot express the prefix
 * rule as precisely as `isSyntheticEmail`, so a query using this should still pass its
 * results through that function before sending anything.
 */
export const NOT_SYNTHETIC_WHERE = {
  AND: [
    { email: { not: { contains: '@imported.local' } } },
    { email: { not: { contains: '@guest.moslimleader.com' } } },
    { email: { not: { contains: '.local' } } },
    { email: { not: { startsWith: 'manual-' } } },
    { email: { not: { startsWith: 'guest-' } } },
  ],
};
