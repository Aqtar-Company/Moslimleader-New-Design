#!/usr/bin/env node
/**
 * Give every song (audio item) in the free media library its language, read from its title.
 * Same rule the admin uses for new uploads, imported, not copied: src/lib/content-languages.mjs
 * — a language NAMED in the title («… تركي», "English") wins; Turkish-only letters mean
 * Turkish; a Latin-script title means English; everything else is Arabic.
 *
 *   node ops/classify-media-language.mjs             # dry run: prints what it would set
 *   node ops/classify-media-language.mjs --apply     # writes
 *   node ops/classify-media-language.mjs --all-kinds # every item, not only songs
 *   node ops/classify-media-language.mjs --redo      # also re-guess items that already have one
 *
 * Only items with NO language are touched, unless --redo. A wrong guess is fixed by hand in
 * /admin/free-media (the item's «اللغة» field), and is never overwritten by a later run.
 */
import { PrismaClient } from '@prisma/client';
const { guessLanguageFromTitle, contentLang } = await import('../src/lib/content-languages.mjs');

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const allKinds = process.argv.includes('--all-kinds');
const redo = process.argv.includes('--redo');

const items = await prisma.freeMedia.findMany({
  where: {
    ...(allKinds ? {} : { type: 'mp3' }),
    ...(redo ? {} : { language: null }),
  },
  select: { id: true, title: true, titleEn: true, type: true, language: true },
  orderBy: { id: 'asc' },
});

const tally = {};
for (const it of items) {
  const guess = guessLanguageFromTitle(`${it.title} ${it.titleEn ?? ''}`);
  tally[guess] = (tally[guess] ?? 0) + 1;
  const mark = guess === 'ar' ? '  ' : '★ ';
  console.log(`${mark}#${String(it.id).padEnd(5)} ${contentLang(guess).flag} ${guess}  ${it.type.padEnd(5)} ${it.title}`);
  if (apply && it.language !== guess) await prisma.freeMedia.update({ where: { id: it.id }, data: { language: guess } });
}

console.log(`\n${items.length} item(s): ` + Object.entries(tally).map(([k, n]) => `${contentLang(k).ar} ${n}`).join(' · '));
console.log('★ = not Arabic — check these.');
if (!apply && items.length) console.log('dry run — add --apply to write');
await prisma.$disconnect();
