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
 *
 * ## Why this file is plain JavaScript and not TypeScript
 *
 * `ops/infer-gender-from-names.mjs` is the only thing that runs it in bulk, and a bare
 * `node` script cannot import a `.ts` module. That script used to carry its own copy of
 * the rules, and the copy drifted: its first line was `if (!/^[\u0600-\u06FF]/.test(full))
 * return null`, so every Latin-script name — Marwa Ali, Esraa Mohammed, Mostafa Orabi —
 * was reported as «غير محسوم» while the lists below sat right there containing them. It
 * also never stripped an honorific and never checked `ORG_WORDS`. Reading the lists out of
 * the source with a regex was the previous attempt at one copy and it kept only the DATA,
 * not the rules, which is precisely where the drift was.
 *
 * So: `.mjs`, typed with JSDoc (`allowJs` is on), imported by the app and by the ops script
 * from the same path. Do not add a second implementation anywhere.
 */

/**
 * @typedef {{ gender: 'male' | 'female' | 'org', reason: string } | null} NameGuess
 */

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
  'هدير', 'ايه', 'آية', 'اية', 'رنا', 'رنيم', 'لؤلؤة', 'جهاد', 'امل', 'أمل', 'اسماء',
]);

/** Prefixes that settle it without a list. */
/**
 * Words that open the name of an INSTITUTION, not a person.
 *
 * Read off the first run's output: «مكتبة دار المستقبل» and «شركه ناصر العشي» were both
 * called female by the ة-suffix rule, because مكتبة and شركة end in one. Excluding them
 * would have been the wrong repair — they are not people of unknown gender, they are
 * organisations, and that is a kind of its own now with both rules switched off.
 */
const ORG_WORDS = [
  'مكتبة', 'مكتبه', 'شركة', 'شركه', 'مؤسسة', 'مؤسسه', 'جمعية', 'جمعيه', 'مدرسة', 'مدرسه',
  'اكاديمية', 'اكاديميه', 'معهد', 'مركز', 'عيادة', 'عياده', 'صيدلية', 'صيدليه', 'مستشفى',
  'مطبعة', 'مطبعه', 'دار', 'متجر', 'محل', 'معرض', 'وقف', 'مجموعة', 'مجموعه', 'فريق',
  'قناة', 'قناه', 'موقع', 'تطبيق', 'ادارة', 'اداره', 'جامعة', 'جامعه', 'روضة', 'حضانة',
];

/**
 * Titles people write in front of a name. Left in place, «أ.أسماء» is one unrecognised
 * word and the account goes unclassified for the sake of two characters.
 */
const HONORIFICS = [
  'ا.', 'أ.', 'د.', 'م.', 'ح.', 'ط.', 'الاستاذ', 'الاستاذة', 'الشيخ', 'الشيخة', 'الدكتور',
  'الدكتورة', 'المهندس', 'المهندسة', 'استاذ', 'استاذة', 'شيخ', 'دكتور', 'دكتورة', 'مهندس',
];

/**
 * The same names in Latin letters. The first run left 900 accounts unclassified and a good
 * share were «Mohamed Emad», «Marwa Ali», «Mariam Metawe3» — names this file knows well in
 * Arabic. Transliteration varies too much to derive, so the common spellings are listed,
 * and the same asymmetry holds: the male list is names never given to a woman.
 */
const MALE_LATIN = new Set([
  'mohamed', 'mohammed', 'muhammad', 'mohammad', 'ahmed', 'ahmad', 'mahmoud', 'mahmood',
  'mostafa', 'moustafa', 'mustafa', 'ibrahim', 'ebrahim', 'ali', 'omar', 'othman', 'osman',
  'hassan', 'hasan', 'hussein', 'hussain', 'khaled', 'khalid', 'said', 'sayed', 'sami',
  'yasser', 'yaser', 'waleed', 'walid', 'tarek', 'tarik', 'hesham', 'hisham', 'sherif',
  'islam', 'eslam', 'karim', 'kareem', 'mazen', 'ziad', 'anas', 'bilal', 'hamza', 'adam',
  'youssef', 'yousef', 'yusuf', 'moussa', 'musa', 'yehia', 'yahya', 'ayman', 'ashraf',
  'amr', 'marwan', 'moataz', 'nader', 'hany', 'hani', 'wael', 'seif', 'saif', 'fares',
  'akram', 'anwar', 'gamal', 'kamal', 'fathy', 'sabry', 'essam', 'adel', 'atef', 'nabil',
  'magdy', 'maher', 'ramy', 'rami', 'sameh', 'tamer', 'basem', 'bassem', 'hatem', 'fady',
  'abdullah', 'abdelrahman', 'abdulrahman', 'abdelaziz', 'abdo', 'mohab', 'moamen',
]);
const FEMALE_LATIN = new Set([
  'fatma', 'fatima', 'fatema', 'mariam', 'maryam', 'marium', 'aisha', 'aysha', 'khadija',
  'zeinab', 'zainab', 'asmaa', 'asma', 'hagar', 'hajar', 'sara', 'sarah', 'nour', 'noura',
  'nourhan', 'nada', 'dina', 'donia', 'dunia', 'rania', 'reham', 'shaimaa', 'shimaa',
  'shereen', 'shirin', 'salma', 'sama', 'malak', 'heba', 'hiba', 'hoda', 'huda', 'hind',
  'yasmin', 'yasmine', 'jana', 'habiba', 'rahma', 'rowan', 'reem', 'sondos', 'shorouk',
  'safaa', 'abeer', 'ghada', 'farah', 'laila', 'layla', 'marwa', 'mennah', 'manar', 'maha',
  'nadia', 'noha', 'nayra', 'wafaa', 'walaa', 'yara', 'eman', 'iman', 'amira', 'engy',
  'esraa', 'israa', 'alaa', 'basma', 'tasneem', 'hanan', 'doaa', 'rasha', 'sahar', 'souad',
  'samar', 'samira', 'sabah', 'aya', 'aia', 'rana', 'raneem', 'amal', 'mai', 'may', 'menna',
  'yosra', 'yusra', 'nermeen', 'nermin', 'dalia', 'hala', 'hanaa', 'mona', 'nahla',
  // Added from the first real run, where «Rokia Ibrahim» and «Hadir Ali» came back
  // unresolved and their owner said plainly that both are women. Transliteration is the
  // only reason they were missed — رقية and هدير are on the Arabic list already — so the
  // several spellings each name is actually written in go in together.
  'rokia', 'rokya', 'roqia', 'rokaya', 'rokaia', 'roqaya', 'ruqaya', 'ruqayya', 'rokiya',
  'hadir', 'hadeer', 'hadeir', 'hedeer', 'hadier',
]);

const MALE_PREFIX = ['عبد', 'ابو', 'أبو'];
const FEMALE_PREFIX = ['ام ', 'أم '];

/** @param {string} s @returns {string} */
function normalise(s) {
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
/**
 * @param {string | null | undefined} rawName
 * @returns {NameGuess}
 */
export function guessGenderFromName(rawName) {
  if (!rawName) return null;
  const full = normalise(rawName);
  if (!full) return null;

  // Strip a title so the name behind it can be read.
  let stripped = full;
  for (const h of HONORIFICS) {
    if (stripped.startsWith(h)) { stripped = stripped.slice(h.length).trim(); break; }
  }
  const words = stripped.split(' ').filter(Boolean);
  const first = words[0] ?? '';
  if (!first) return null;

  // An institution, before anything else: «مكتبة» and «شركة» end in ة and were being read
  // as women by the suffix rule.
  if (ORG_WORDS.includes(first)) return { gender: 'org', reason: 'اسم جهة' };

  // A Latin-script name is still a name — read it from the transliteration lists.
  if (!/^[\u0600-\u06FF]/.test(first)) {
    const lat = first.toLowerCase().replace(/[^a-z]/g, '');
    if (!lat) return null;
    if (FEMALE_LATIN.has(lat)) return { gender: 'female', reason: 'اسم بحروف لاتينية' };
    if (MALE_LATIN.has(lat)) return { gender: 'male', reason: 'اسم بحروف لاتينية' };
    return null;
  }

  if (FEMALE_PREFIX.some(p => stripped.startsWith(p))) return { gender: 'female', reason: 'أم …' };
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
