#!/usr/bin/env node
/**
 * One-off: posts that were DRAFTS and were published later kept their drafting date in
 * `createdAt`, so «جديد» (and «أتابع», the «الأنفع» window, «منذ…») placed them by the day
 * they were written, not the day they went out. The publish route now moves createdAt;
 * this repairs the rows published before that.
 *
 * Selects published posts whose publishedAt is more than 2 minutes after createdAt (a post
 * published directly gets both in the same instant). Dry run by default.
 *
 *   cd /home/moslimleader.com/app
 *   node ops/fix-published-draft-dates.mjs          # list only
 *   node ops/fix-published-draft-dates.mjs --apply  # write
 */
// Prisma reads DATABASE_URL from .env in the working directory, as the other ops scripts rely on.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const rows = await prisma.$queryRaw`
  SELECT id, title, createdAt, publishedAt FROM \`TareeqPost\`
  WHERE isDraft = 0 AND publishedAt IS NOT NULL
    AND publishedAt > DATE_ADD(createdAt, INTERVAL 2 MINUTE)`;
console.log(`${rows.length} post(s) published from a draft with an older createdAt`);
for (const r of rows) {
  console.log(`  ${r.id}  ${new Date(r.createdAt).toISOString().slice(0, 16)} → ${new Date(r.publishedAt).toISOString().slice(0, 16)}  ${(r.title ?? '').slice(0, 50)}`);
}
if (apply && rows.length) {
  const n = await prisma.$executeRaw`
    UPDATE \`TareeqPost\` SET createdAt = publishedAt
    WHERE isDraft = 0 AND publishedAt IS NOT NULL
      AND publishedAt > DATE_ADD(createdAt, INTERVAL 2 MINUTE)`;
  console.log(`updated ${n}`);
} else if (rows.length) {
  console.log('dry run — add --apply to write');
}
await prisma.$disconnect();
