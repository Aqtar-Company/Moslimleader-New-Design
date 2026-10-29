// One-off: fill BookSeries.plannedBookCount for series that don't have it yet, using the
// number of books the biggest language edition has TODAY (e.g. 42 books / 6 languages -> 7).
// Safe to re-run: it only touches rows where plannedBookCount is NULL.
//   node ops/set-planned-book-count.mjs          (dry run — prints what it would set)
//   node ops/set-planned-book-count.mjs --apply
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const series = await prisma.bookSeries.findMany({
  where: { plannedBookCount: null },
  include: { books: { where: { isPublished: true }, select: { language: true } } },
});
for (const s of series) {
  const langs = [...new Set(s.books.map(b => b.language).filter(l => l && l !== 'both'))];
  const shared = s.books.filter(b => !b.language || b.language === 'both').length;
  const per = langs.length ? Math.max(...langs.map(l => s.books.filter(b => b.language === l).length + shared)) : s.books.length;
  console.log(`${s.name}: ${s.books.length} books, languages=${langs.join(',') || '-'} -> plannedBookCount=${per}`);
  if (apply && per > 0) await prisma.bookSeries.update({ where: { id: s.id }, data: { plannedBookCount: per } });
}
console.log(apply ? 'applied' : 'dry run (add --apply)');
await prisma.$disconnect();
