import { prisma } from '@/lib/prisma';

/**
 * A book's editions in OTHER languages — «متاح أيضاً بـ…» on the book page.
 *
 * Measured 2026-11-15: about a quarter of book opens (177 of 761 in 30 days) were in a
 * language other than Arabic, and the English «Khaled in Trouble» was among the ten most read
 * books — yet a reader who landed on one edition had no way to see that another existed.
 *
 * Two ways a book is linked to its other editions, merged:
 *  1. SERIES — a series holds the same stories in several languages (e.g. «ابني يسأل»: 42 books
 *     in 6 languages). Same `seriesId` + same `seriesOrder` + another language = the same story.
 *     Nothing to set: it works from the numbering the series already has.
 *  2. BY HAND — `Book.translationOfId`, set in admin, points a translation at its ORIGINAL.
 *     The group is the original plus every book pointing at it.
 *
 * Only published books are offered, one per language.
 */
export type BookVersion = { id: string; language: string; title: string; titleEn: string | null; cover: string };

export async function findBookVersions(book: {
  id: string;
  language?: string | null;
  translationOfId?: string | null;
  seriesId?: string | null;
  seriesOrder?: number | null;
}): Promise<BookVersion[]> {
  const root = book.translationOfId || book.id;
  const or: object[] = [{ id: root }, { translationOfId: root }];
  if (book.seriesId && book.seriesOrder != null) {
    or.push({ seriesId: book.seriesId, seriesOrder: book.seriesOrder });
  }
  const rows = await prisma.book.findMany({
    where: { isPublished: true, id: { not: book.id }, OR: or },
    select: { id: true, language: true, title: true, titleEn: true, cover: true, translationOfId: true },
    orderBy: { createdAt: 'asc' },
  });
  const own = (book.language || 'ar').toLowerCase();
  const byLang = new Map<string, BookVersion>();
  for (const r of rows) {
    const lang = (r.language || 'ar').toLowerCase();
    if (lang === own || lang === 'both') continue;
    // A by-hand link wins over a series match for the same language.
    const manual = r.id === root || r.translationOfId === root;
    if (byLang.has(lang) && !manual) continue;
    byLang.set(lang, { id: r.id, language: lang, title: r.title, titleEn: r.titleEn, cover: r.cover });
  }
  return Array.from(byLang.values());
}
