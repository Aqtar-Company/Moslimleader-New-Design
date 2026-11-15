import type { TareeqCategoryKey } from '@/lib/tareeq-constants';

/**
 * A category to SUGGEST while a member writes a طريق post — never to set on its own.
 *
 * Measured 2026-11-15: 168 of 295 post views in 30 days were on posts with no category, which
 * leaves the category filters (قصة، فكرة، تجربة…) showing a fraction of what is there. The
 * composer used to hide the choice behind a «(اختياري)» dropdown under the text. Now the six
 * categories are visible chips, and the one these words point to is marked «مقترح» — the
 * author still taps it, or ignores it.
 *
 * Plain keyword rules, Egyptian and standard Arabic plus English. A wrong guess costs one
 * glance; no guess at all (null) is returned for short texts and when nothing matches.
 */
const RULES: { key: TareeqCategoryKey; words: RegExp }[] = [
  { key: 'story',      words: /(قصة|قصه|حكاية|حكايه|حدوتة|حدوته|كان يا ما كان|ذات يوم|\bstory\b)/i },
  { key: 'experience', words: /(تجربتي|من تجربتي|جربت|جرّبت|حصل معايا|حصل معي|موقف حصل|\bmy experience\b)/i },
  { key: 'idea',       words: /(فكرة|فكره|اقتراح|أقترح|اقترح|ماذا لو|ايه رأيكم لو|\bidea\b)/i },
  { key: 'project',    words: /(مشروع|مبادرة|مبادره|أطلقنا|اطلقنا|أطلقت|انطلاق|إطلاق|\bproject\b)/i },
  { key: 'reflection', words: /(تأمل|تأملات|تدبر|تدبّر|خاطرة|خاطره|قال تعالى|قال الله|قال رسول الله|\breflection\b)/i },
];

const QUESTION_START = /^\s*(هل|كيف|ازاي|إزاي|ليه|لماذا|ليش|متى|امتى|إمتى|ما رأيكم|ايه رأيكم|إيه رأيكم|حد يعرف|حد عنده|محتاج نصيحة|محتاجة نصيحة|how|why|what|does anyone)(?=[\s،,؟?.!:]|$)/i;
// (`\b` is ASCII-only in JavaScript: after an Arabic word it never matches, hence the lookahead.)

export function suggestCategory(text: string): TareeqCategoryKey | null {
  const t = (text || '').trim();
  if (t.length < 15) return null;
  // A post that asks is a question, whatever else it mentions.
  if (/[؟?]\s*$/.test(t) || QUESTION_START.test(t)) return 'question';
  for (const r of RULES) if (r.words.test(t)) return r.key;
  return null;
}
