/**
 * Guessing a member's gender from their name — for the accounts that predate the field.
 *
 * ## The two errors are not the same size
 *
 * Guessing FEMALE wrongly veils a man's picture: mildly odd, and he can correct it in
 * settings. Guessing MALE wrongly shows a woman's picture, plainly, to every man on the
 * platform — the exact harm the whole feature exists to prevent, and one she cannot undo
 * because she does not know it happened.
 *
 * So the two directions are held to different standards. A female guess may rest on a
 * suffix; a male guess must match a name on a list. Anything else stays UNKNOWN, and
 * unknown is treated as female by `shouldBlurFor` — it veils. The bias is deliberate and
 * it is the whole reason this is safe to run.
 *
 * ## It is a guess, and it is marked as one
 *
 * Nothing here is stated by the member. `tareeqGenderSetAt` stays null for an inferred
 * value, which is what tells the gate to ask anyway — with the guess pre-selected, so
 * confirming is one tap. The rules apply in the meantime; the member is not waited for.
 *
 * ## Photos were considered and refused
 *
 * Reading gender off a profile picture means face analysis, which means sending members'
 * faces to a third party. On a platform whose point is not showing those faces, that is a
 * worse trade than any convenience it buys.
 */

export type NameGuess = { gender: 'male' | 'female'; reason: string } | null;

/**
 * Unambiguous male given names. This is the RISKY direction, so a name belongs here only
 * if it is never used for a woman. Names that can go either way — نور, رضا, ملاك, صفا,
 * أمل, جيهان — are deliberately absent from both lists.
 */
const MALE = new Set([
  'محمد', 'احمد', 'أحمد', 'محمود', 'مصطفى', 'ابراهيم', 'إبراهيم', 'علي', 'عمر', 'عثمان',
  'حسن', 'حسين', 'خالد', 'سعيد', 'سامي', 'ياسر', 'وليد', 'طارق', 'هشام', 'شريف',
  'اسلام', 'إسلام', 'كريم', 'مازن', 'زياد', 'انس', 'أنس', 'بلال', 'حمزة', 'ادم', 'آدم',
  'يوسف', 'يعقوب', 'اسحاق', 'إسحاق', 'موسى', 'عيسى', 'زكريا', 'يحيى', 'ايوب', 'أيوب',
  'سليمان', 'داود', 'ادريس', 'إدريس', 'هارون', 'صالح', 'هود', 'شعيب', 'لقمان',
  'عبدالله', 'عبدالرحمن', 'عبدالعزيز', 'عبدالرحيم', 'عبدالحميد', 'عبدالفتاح', 'عبدالناصر',
  'مالك', 'اياد', 'إياد', 'رامي', 'سامح', 'ماهر', 'مجدي', 'نبيل', 'عادل', 'عاطف',
  'جمال', 'كمال', 'فتحي', 'صبري', 'رفعت', 'عصام', 'ايمن', 'أيمن', 'اشرف', 'أشرف',
  'حاتم', 'فادي', 'باسم', 'تامر', 'عمرو', 'مروان', 'معتز', 'مؤمن', 'مهند', 'نادر',
  'هاني', 'وائل', 'يزيد', 'زين', 'سيف', 'فارس', 'اكرم', 'أكرم', 'انور', 'أنور',
  'جابر', 'حمدي', 'رجب', 'رمضان', 'شعبان', 'عيد', 'مبروك', 'منصور', 'ناصر', 'سلطان',
  'بدر', 'راشد', 'سالم', 'سعد', 'طلال', 'عبدالمجيد', 'عبدالسلام', 'مشاري', 'تركي',
]);

/** Unambiguous female given names — the SAFE direction, but still a list, not a hunch. */
const FEMALE = new Set([
  'فاطمة', 'فاطمه', 'مريم', 'عائشة', 'عائشه', 'خديجة', 'خديجه', 'زينب', 'رقية', 'رقيه',
  'سمية', 'سميه', 'اسماء', 'أسماء', 'هاجر', 'سارة', 'ساره', 'حواء', 'امنة', 'آمنة',
  'نور', 'نورا', 'نورهان', 'ندى', 'دينا', 'دنيا', 'رانيا', 'ريهام', 'شيماء', 'شيرين',
  'سلمى', 'سما', 'ملك', 'هبة', 'هبه', 'هدى', 'هند', 'ياسمين', 'جنى', 'جنة', 'حبيبة',
  'رحمة', 'رحمه', 'روان', 'رودينا', 'ريم', 'زينة', 'سندس', 'شروق', 'صفاء', 'ضحى',
  'عبير', 'غادة', 'فرح', 'لمياء', 'ليلى', 'مروة', 'منة', 'منار', 'مها', 'ميرنا',
  'نادية', 'ناديه', 'نجلاء', 'نهى', 'نيرة', 'وفاء', 'ولاء', 'يارا', 'إيمان', 'ايمان',
  'اميرة', 'أميرة', 'اميره', 'انجي', 'إنجي', 'اسراء', 'إسراء', 'الاء', 'آلاء',
  'بسمة', 'بسمه', 'تسنيم', 'جميلة', 'حنان', 'دعاء', 'رشا', 'سحر', 'سعاد', 'سمر',
  'سميرة', 'شادية', 'صباح', 'عزة', 'علياء', 'غدير', 'فايزة', 'كريمة', 'لبنى', 'لينا',
  'ماجدة', 'مروه', 'منة الله', 'منى', 'نعمة', 'نهال', 'هالة', 'هناء', 'وردة', 'يسرا',
  'ايه', 'آية', 'اية', 'رنا', 'رنيم', 'لؤلؤة', 'جهاد', 'امل', 'أمل', 'اسماء',
]);

/** Prefixes that settle it without a list. */
const MALE_PREFIX = ['عبد', 'ابو', 'أبو'];
const FEMALE_PREFIX = ['ام ', 'أم '];

function normalise(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, '')            // harakat and tatweel
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The guess, or null when the name does not settle it.
 *
 * Only the FIRST word is read. A father's name in the middle would otherwise decide a
 * daughter's entry — «فاطمة محمد» is a woman, and matching «محمد» anywhere would call her
 * a man, which is the error this whole file is arranged to avoid.
 */
export function guessGenderFromName(rawName: string | null | undefined): NameGuess {
  if (!rawName) return null;
  const full = normalise(rawName);
  if (!full) return null;

  // A synthetic row («اوردر هدية»), a business, or a Latin-script name is not a person's
  // Arabic given name and is left alone.
  if (!/^[؀-ۿ]/.test(full)) return null;

  const first = full.split(' ')[0];

  if (FEMALE_PREFIX.some(p => full.startsWith(p))) return { gender: 'female', reason: 'أم …' };
  if (MALE_PREFIX.some(p => first.startsWith(p)) && first.length > 4) {
    return { gender: 'male', reason: 'عبد… / أبو…' };
  }

  if (FEMALE.has(first)) return { gender: 'female', reason: 'اسم في قائمة الإناث' };
  if (MALE.has(first)) return { gender: 'male', reason: 'اسم في قائمة الذكور' };

  // The suffix is offered to the SAFE direction only. «ة» ends plenty of female names and
  // a few male ones (حمزة, أسامة, معاوية) — as a female guess that costs a veiled man a
  // tap; as a male rule it would cost a woman her privacy, so there is no male equivalent.
  if (/[ةه]$/.test(first) && first.length >= 4 && !MALE.has(first)) {
    return { gender: 'female', reason: 'ينتهي بتاء مربوطة' };
  }

  return null;
}
