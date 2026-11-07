#!/usr/bin/env node
/**
 * Read-only health check of طريق's feed filters on the LIVE data. Writes nothing.
 *
 *   cd /home/moslimleader.com/app && node ops/check-tareeq-feed.mjs
 *
 * 1. Categories: the filter chips (قصة / فكرة / تجربة …) query the canonical English key.
 *    A row holding anything else (an Arabic label from before normalisation, a typo) is
 *    invisible to its chip.
 * 2. Published drafts whose createdAt is still the drafting date — misplaced in «جديد».
 *    Repair: node ops/fix-published-draft-dates.mjs --apply
 * 3. «الأنفع» scores that disagree with the posts' current counters (stale or on the old
 *    scale). Repair: one call to /api/cron/tareeq-cleanup (rescores the last 60 days).
 * 4. What each tab would put on top right now.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const KEYS = ['experience', 'story', 'idea', 'question', 'project', 'reflection'];
const AGE_DIVISOR = 3 * 86_400; // must match src/lib/tareeq-rank.ts
const hot = p => {
  const e = (p.savedCount ?? 0) * 4 + (p.shareCount ?? 0) * 5 + (p.commentCount ?? 0) * 2 + (p.likeCount ?? 0);
  return Math.round((Math.log10(Math.max(e, 1)) + (p.publishedAt ?? p.createdAt).getTime() / 1000 / AGE_DIVISOR) * 1e6) / 1e6;
};
const live = { isHidden: false, isDraft: false };

console.log('── 1. Categories (published, visible posts)');
const cats = await prisma.tareeqPost.groupBy({ by: ['category'], where: live, _count: { _all: true } });
for (const c of cats.sort((a, b) => b._count._all - a._count._all)) {
  const ok = c.category === null || KEYS.includes(c.category);
  console.log(`   ${ok ? 'ok ' : 'BAD'}  ${String(c.category ?? '(none)').padEnd(12)} ${c._count._all}`);
}

console.log('\n── 2. Published drafts still dated by their drafting day');
const drafts = await prisma.$queryRaw`
  SELECT COUNT(*) AS n FROM \`TareeqPost\`
  WHERE isDraft = 0 AND publishedAt IS NOT NULL AND publishedAt > DATE_ADD(createdAt, INTERVAL 2 MINUTE)`;
console.log(`   ${Number(drafts[0].n)} ${Number(drafts[0].n) ? '→ node ops/fix-published-draft-dates.mjs' : '(none)'}`);

console.log('\n── 3. «الأنفع» scores vs current counters (last 30 days)');
const since = new Date(Date.now() - 30 * 86_400_000);
const recent = await prisma.tareeqPost.findMany({
  where: { ...live, createdAt: { gte: since } },
  select: { id: true, title: true, content: true, category: true, hotScore: true, likeCount: true, commentCount: true, savedCount: true, shareCount: true, createdAt: true, publishedAt: true },
});
const stale = recent.filter(p => Math.abs(p.hotScore - hot(p)) > 1e-3);
console.log(`   ${recent.length} posts, ${stale.length} with a stale score${stale.length ? ' → run the rescore once (see the deploy notes)' : ''}`);

const label = p => (p.title || p.content || '').replace(/\s+/g, ' ').slice(0, 45);
const eng = p => `r${p.likeCount} c${p.commentCount} s${p.savedCount}`.padEnd(14);
console.log('\n── 4. Top 5 «جديد»');
const newest = await prisma.tareeqPost.findMany({ where: live, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5,
  select: { title: true, content: true, createdAt: true, likeCount: true, commentCount: true, savedCount: true } });
newest.forEach(p => console.log(`   ${p.createdAt.toISOString().slice(0, 16)}  ${eng(p)}  ${label(p)}`));
console.log('\n── Top 5 «الأنفع» as it will be after rescoring (current counters)');
[...recent].sort((a, b) => hot(b) - hot(a)).slice(0, 5)
  .forEach(p => console.log(`   ${p.createdAt.toISOString().slice(0, 16)}  ${eng(p)}  ${label(p)}`));
for (const k of ['story', 'idea', 'experience']) {
  const n = await prisma.tareeqPost.count({ where: { ...live, category: k } });
  console.log(`\n── «${k}» chip: ${n} post(s)`);
}
await prisma.$disconnect();
