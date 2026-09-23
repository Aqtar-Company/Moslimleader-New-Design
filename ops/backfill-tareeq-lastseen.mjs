/**
 * Give «مستخدمو طريق» back the members who were never counted.
 *
 *   node ops/backfill-tareeq-lastseen.mjs --dry     # who would be marked, changes nothing
 *   node ops/backfill-tareeq-lastseen.mjs
 *
 * ## What went wrong
 *
 * `User.tareeqLastSeen` was written from exactly one place: the heartbeat on the
 * direct-message screen. A member who signed up, posted, reacted and commented but never
 * opened a private chat kept it null — and that column is what the admin panel's Tareeq
 * user list filters on, what its stats count, and what a broadcast uses to tell a طريق
 * member from a shop-only customer.
 *
 * So they were not merely missing from a list. They were being left out of messages
 * addressed to طريق's own members, and the panel said the platform had fewer members than
 * it does.
 *
 * The write now also happens on the feed (`/api/tareeq/me`), which fixes it going forward.
 * This fixes the people already affected, and it is a ONE-OFF: run it once after that
 * deploy.
 *
 * ## The date it writes
 *
 * Their most recent real activity — a post, a comment, a reaction, a bookmark — not `now`.
 * Stamping everyone with today would say the whole platform was active this minute, and
 * "last seen" would be a lie on every profile that shows it. A member with no activity at
 * all is left alone: nothing here knows whether they ever opened طريق.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

/** The latest of several dates, ignoring the missing ones. */
function latest(...dates) {
  const real = dates.filter(Boolean).map(d => new Date(d).getTime()).filter(Number.isFinite);
  return real.length ? new Date(Math.max(...real)) : null;
}

try {
  const candidates = await prisma.user.findMany({
    where: { tareeqLastSeen: null },
    select: { id: true, name: true },
  });
  console.log(`أعضاء بلا «آخر ظهور»: ${candidates.length}`);
  if (!candidates.length) process.exit(0);

  const ids = candidates.map(u => u.id);
  // One grouped query per kind rather than four per member: this runs over the whole table.
  const [posts, comments, reactions, bookmarks] = await Promise.all([
    prisma.tareeqPost.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { createdAt: true } }),
    prisma.tareeqComment.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { createdAt: true } }),
    prisma.tareeqReaction.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { createdAt: true } }),
    prisma.tareeqBookmark.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { createdAt: true } }),
  ]);

  const seen = new Map();
  for (const rows of [posts, comments, reactions, bookmarks]) {
    for (const r of rows) {
      const when = r._max.createdAt;
      if (!when) continue;
      const prev = seen.get(r.userId);
      seen.set(r.userId, latest(prev, when));
    }
  }

  const named = new Map(candidates.map(u => [u.id, u.name]));
  console.log(`منهم لهم نشاطٌ حقيقي على طريق: ${seen.size}`);
  console.log(`وبلا أي نشاط (يُتركون كما هم): ${candidates.length - seen.size}`);

  if (!seen.size) process.exit(0);

  if (DRY) {
    console.log('\n— تجربة فقط، لن يُكتب شيء —\n');
    let n = 0;
    for (const [id, when] of seen) {
      if (n++ >= 20) break;
      console.log(`   ${when.toISOString().slice(0, 10)}   ${named.get(id) ?? id}`);
    }
    if (seen.size > 20) console.log(`   … و${seen.size - 20} غيرهم`);
    process.exit(0);
  }

  let done = 0;
  for (const [id, when] of seen) {
    await prisma.user.update({ where: { id }, data: { tareeqLastSeen: when } }).catch(() => {});
    if (++done % 50 === 0) console.log(`  ${done}/${seen.size}…`);
  }
  console.log(`\nتم تعليم ${done} عضواً بتاريخ آخر نشاطٍ حقيقي لهم.`);
  console.log('افتح لوحة طريق ← المستخدمون، ستجدهم.');
} finally {
  await prisma.$disconnect();
}
