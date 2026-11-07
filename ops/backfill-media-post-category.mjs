#!/usr/bin/env node
/**
 * One-off: give the طريق posts of media-library STORIES the «قصة» category, so they show
 * under that chip. New posts get it when they are made (src/lib/media-tareeq.ts); this
 * covers the ones made before. Same rule, imported, not copied: src/lib/media-story-category.mjs.
 *
 * Only posts with NO category are touched — a category someone chose by hand stays.
 *
 *   cd /home/moslimleader.com/app
 *   node ops/backfill-media-post-category.mjs          # list only
 *   node ops/backfill-media-post-category.mjs --apply  # write
 */
import { PrismaClient } from '@prisma/client';
const { mediaPostCategory } = await import('../src/lib/media-story-category.mjs');
const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const items = await prisma.freeMedia.findMany({
  where: { discussionPostId: { not: null } },
  select: { id: true, title: true, discussionPostId: true, category: { select: { name: true, nameEn: true } } },
});
const posts = new Map((await prisma.tareeqPost.findMany({
  where: { id: { in: items.map(i => i.discussionPostId) } },
  select: { id: true, category: true },
})).map(p => [p.id, p]));

let todo = 0, skipped = 0, notStory = 0;
for (const it of items) {
  const want = mediaPostCategory(it);
  const post = posts.get(it.discussionPostId);
  if (!want) { notStory++; continue; }
  if (!post || post.category === want) continue;
  if (post.category) { skipped++; console.log(`  keep  ${it.title}  (already «${post.category}»)`); continue; }
  todo++;
  console.log(`  story ${it.title}  [${it.category?.name ?? 'no library category'}]`);
  if (apply) await prisma.tareeqPost.update({ where: { id: post.id }, data: { category: want } });
}
console.log(`\n${items.length} item(s) with a طريق post: ${todo} to set as «قصة»${apply ? ' — done' : ''}, ${skipped} kept (hand-chosen), ${notStory} not stories by name.`);
if (!apply && todo) console.log('dry run — add --apply to write');
await prisma.$disconnect();
