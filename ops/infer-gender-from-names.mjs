/**
 * Guess the account kind for members who predate the field, from their name.
 *
 *   node ops/infer-gender-from-names.mjs --dry     # counts and samples, writes nothing
 *   node ops/infer-gender-from-names.mjs           # people who have actually used طريق
 *   node ops/infer-gender-from-names.mjs --all     # every row in the table
 *   node ops/infer-gender-from-names.mjs --undo    # remove every guess this made
 *
 * ## Scope: طريق's members, not the shop's rows
 *
 * By default this covers accounts that have actually opened طريق (`tareeqLastSeen` set).
 * They are the only ones the rules reach: the other rows are overwhelmingly phone-import
 * accounts for manual orders, with no photo, no posts and no visit — guessing at their
 * names writes noise into the column and buys nothing.
 *
 * `--all` widens it to the whole table for when that is genuinely wanted.
 *
 * ## What makes this safe to run
 *
 * The two errors are not the same size. A wrong FEMALE guess veils a man's picture — odd,
 * and he fixes it in settings. A wrong MALE guess shows a woman's picture plainly to every
 * man, which is the harm the feature exists to prevent, and she never learns it happened.
 *
 * So a male guess must match a curated list of names never used for women, while a female
 * guess may also rest on a suffix. Everything else is left NULL — and null already means
 * veiled. The bias is the safety.
 *
 * ## The guess is marked as a guess
 *
 * `tareeqGenderSetAt` stays null. That is what tells the gate this was not stated: the
 * member is still asked on their next visit, with the guess pre-selected, so confirming is
 * one tap and correcting is one tap. Meanwhile the rules apply — which is the point, since
 * waiting for two thousand people to log in is what this replaces.
 *
 * `--undo` clears exactly the rows this wrote (gender set, setAt null) and nothing else, so
 * a member who has since answered for themselves is never touched.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const UNDO = process.argv.includes('--undo');
const ALL = process.argv.includes('--all');
// Re-read the guesses this script made before, so a rule added since can correct them.
// `tareeqGenderSetAt` null is what marks a row as guessed rather than stated.
const REDO = process.argv.includes('--redo');

// The classifier is TypeScript; a bare node script cannot import it. Rather than keep a
// second copy — the thing that has gone wrong repeatedly in this codebase — its lists and
// rules are evaluated straight out of the source file.
const src = readFileSync('src/lib/arabic-name-gender.ts', 'utf8');
function setFrom(name) {
  const m = new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(src);
  if (!m) throw new Error(`could not read ${name} from the classifier`);
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
}
const MALE = setFrom('MALE');
const FEMALE = setFrom('FEMALE');
const MALE_LATIN = setFrom('MALE_LATIN');
const FEMALE_LATIN = setFrom('FEMALE_LATIN');
function arrayFrom(name) {
  const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]`).exec(src);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
}
const ORG_WORDS = arrayFrom('ORG_WORDS');
const HONORIFICS = arrayFrom('HONORIFICS');

const normalise = s => s
  .replace(/[ً-ْـ]/g, '')
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ')
  .trim();

function guess(rawName) {
  if (!rawName) return null;
  const full = normalise(rawName);
  if (!full || !/^[؀-ۿ]/.test(full)) return null;
  const first = full.split(' ')[0];
  if (full.startsWith('ام ') || full.startsWith('أم ')) return { gender: 'female', reason: 'أم …' };
  if (['عبد', 'ابو', 'أبو'].some(p => first.startsWith(p)) && first.length > 4) return { gender: 'male', reason: 'عبد… / أبو…' };
  if (FEMALE.has(first)) return { gender: 'female', reason: 'قائمة الإناث' };
  if (MALE.has(first)) return { gender: 'male', reason: 'قائمة الذكور' };
  if (/[ةه]$/.test(first) && first.length >= 4 && !MALE.has(first)) return { gender: 'female', reason: 'تاء مربوطة' };
  return null;
}

try {
  if (UNDO) {
    const { count } = await prisma.user.updateMany({
      where: { tareeqGender: { not: null }, tareeqGenderSetAt: null },
      data: { tareeqGender: null },
    });
    console.log(`أُزيل التخمين عن ${count} حساباً. من أجاب بنفسه لم يُمَس.`);
    process.exit(0);
  }

  const scope = ALL ? {} : { tareeqLastSeen: { not: null } };
  const where = REDO
    // A row already guessed (gender set, setAt null) OR still empty.
    ? { ...scope, OR: [{ tareeqGender: null }, { tareeqGenderSetAt: null }] }
    : { ...scope, tareeqGender: null };

  const rows = await prisma.user.findMany({ where, select: { id: true, name: true, tareeqGender: true } });
  console.log(ALL ? 'النطاق: كل الصفوف' : 'النطاق: من دخل طريق فعلاً');
  if (REDO) console.log('ويشمل إعادة تقييم ما خُمّن سابقاً.');
  console.log(`حسابات للفحص: ${rows.length}`);

  const male = [], female = [], org = [], unknown = [];
  for (const u of rows) {
    const g = guess(u.name);
    if (!g) { unknown.push(u); continue; }
    const bucket = g.gender === 'male' ? male : g.gender === 'female' ? female : org;
    bucket.push({ ...u, reason: g.reason, changed: u.tareeqGender && u.tareeqGender !== g.gender });
  }

  console.log(`  رجل  : ${male.length}`);
  console.log(`  امرأة: ${female.length}`);
  console.log(`  جهة  : ${org.length}`);
  console.log(`  غير محسوم (يُتركون، ومعاملتهم الستر): ${unknown.length}`);
  const corrections = [...male, ...female, ...org].filter(u => u.changed);
  if (corrections.length) {
    console.log(`\n  تصحيحات لتخمينٍ سابق: ${corrections.length}`);
    for (const u of corrections.slice(0, 15)) console.log(`     ${u.name}  →  ${u.reason}`);
  }

  const sample = (list, label) => {
    if (!list.length) return;
    console.log(`\n  عيّنة «${label}»:`);
    for (const u of list.slice(0, 15)) console.log(`     ${u.name}   (${u.reason})`);
    if (list.length > 15) console.log(`     … و${list.length - 15} غيرهم`);
  };

  if (DRY) {
    console.log('\n— تجربة فقط، لن يُكتب شيء —');
    sample(male, 'رجل');
    sample(female, 'امرأة');
    sample(org, 'جهة');
    console.log('\n  عيّنة ممن لم يُحسموا:');
    for (const u of unknown.slice(0, 15)) console.log(`     ${u.name}`);
    console.log('\n  اقرأ قائمة «رجل» سطراً سطراً قبل التنفيذ. خطأٌ فيها يكشف صورة امرأة؛');
    console.log('  وخطأٌ في قائمة «امرأة» يستر صورة رجل، وهو يصلحها بنفسه من الإعدادات.');
    process.exit(0);
  }

  let done = 0;
  for (const [list, gender] of [[female, 'female'], [org, 'org'], [male, 'male']]) {
    for (const u of list) {
      // setAt stays null on purpose: that is the mark of a guess.
      await prisma.user.update({ where: { id: u.id }, data: { tareeqGender: gender } }).catch(() => {});
      if (++done % 100 === 0) console.log(`  ${done}…`);
    }
  }
  console.log(`\nخُمّن نوعُ ${done} حساباً (${female.length} امرأة، ${male.length} رجل، ${org.length} جهة).`);
  console.log('لم يُسجَّل تاريخ، فالشاشة ستسألهم عند أول زيارة والإجابة مختارة سلفاً.');
  console.log('وللتراجع عن كل ما كُتب الآن: node ops/infer-gender-from-names.mjs --undo');
} finally {
  await prisma.$disconnect();
}
