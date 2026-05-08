// Heuristic gender detector for Arabic names. Used to tell the AI
// assistant whether to address the user in masculine or feminine
// form ("بكِ" vs "بك").
//
// Two-stage match:
// 1. Exact-match against a list of common feminine names (covers
//    cases that don't follow the suffix rule, e.g. "نور", "هند").
// 2. Suffix rule: Arabic feminine names overwhelmingly end in ة
//    (taa marbuta), ى (alif maqsoura) or اء.
//
// Returns 'male' as the default when nothing matches — matches the
// owner's request: "لو معرفش يحدد يرد مذكر".

export type Gender = 'male' | 'female' | 'unknown';

// Common Arabic feminine names that don't end in ة. Keep
// alphabetised for easy maintenance. ~200 names covers most of the
// likely-female cases in EG/SA Messenger traffic.
const FEMININE_NAMES = new Set<string>([
  'آلاء','آية','أبرار','أحلام','أروى','أريج','أزهار','أسماء','أسيل','أشواق',
  'أصايل','أفنان','إكرام','إلهام','إيمان','إيناس','إيلاف','ابتسام','ابتهال',
  'ابتهاج','اروى','اريج','اسرار','اسما','اسماء','اسيل','اشراق','اصايل','اصيل',
  'اعتدال','اقبال','الاء','اماني','اميرة','اميمة','انجي','انعام','انغام','انوار',
  'ايات','ايلاف','ايمان','اية','بتول','بدور','بسمة','بشرى','بنان','بهيرة',
  'تالا','تالة','تامر','تهاني','تماضر','توتة','تيا','جمانة','جنى','جنا',
  'جنات','جواهر','جيهان','حسناء','حصة','حلا','حلوة','حنان','حنين','حواء',
  'حورية','حياة','خديجة','خلود','دارين','دانة','دانا','دانية','دعاء','دلال',
  'دنيا','دينا','ديما','ذكرى','رؤى','رؤية','راما','رانيا','رانية','رباب',
  'ربى','ربا','ربيع','رتاج','رتيل','رحاب','رحمة','رحيق','ردينة','رزان',
  'رشا','رضوى','رغد','رفعت','رفيف','رقية','ركان','رنا','رنيم','رهام',
  'رهف','روان','روضة','ريان','ريحانة','ريم','ريما','رينا','زاهرة','زهراء',
  'زهور','زينب','زين','زيناب','زبيدة','ساجدة','سارة','سارا','ساره','سامية',
  'سحر','سدرة','سدرى','سدن','سدين','سعاد','سعدية','سلمى','سلوى','سما',
  'سماء','سماح','سمر','سميحة','سميرة','سمية','سندس','سهى','سهام','سها',
  'سهير','سوسن','سيرين','شادن','شادية','شذى','شروق','شريفة','شفاء','شمس',
  'شمساء','شموس','شهد','شيماء','شيرين','صابرين','صبا','صبرية','صفاء','صفية',
  'ضحى','طروب','عائشة','عبير','عذراء','عفاف','علا','عليا','عواطف','عيشة',
  'غادة','غدير','غفران','غنى','فاتن','فاطمة','فادية','فتحية','فدوى','فرح',
  'فردوس','فوز','فوزية','فيروز','قبس','قمر','كريمة','كنزة','كنزي','كنزى',
  'كوثر','لارا','لارين','لانا','لطيفة','لمى','لمار','لمياء','لميس','لورا',
  'لولوة','لولي','لولوه','ليان','ليلى','ليلي','لينا','مارية','مايا','ماري',
  'مجد','مجيدة','محاسن','مرام','مرح','مروة','مريم','مزون','مشاعر','مشاعل',
  'مفيدة','منار','منال','منى','مني','منيرة','مها','مهاد','مهجة','ميادة',
  'ميار','ميرا','ميرنا','ميسون','ميسر','ميسرة','ميس','نادية','ناهد','نبيلة',
  'نجاح','نجلاء','نجمة','نجود','ندى','ندي','نسرين','نسيبة','نسيم','نشوى',
  'نعمة','نعمى','نها','نهاد','نهال','نهلة','نهى','نهي','نوال','نور',
  'نورا','نوره','نوف','نيرة','نيفين','هاجر','هالة','هاله','هانم','هبة',
  'هبه','هدى','هدي','هديل','هدير','هلا','همس','هناء','هند','هيا',
  'هيام','هيفاء','هيلين','وئام','وداد','وردة','وسام','وسمة','ولاء','وفاء',
  'يارا','يسرى','يسري','يمنى','يمني','يمان','ياسمين','يسرى',
]);

// Latin transliterations of common feminine Arabic names (some Page
// users have their FB profile in English).
const FEMININE_NAMES_LATIN = new Set<string>([
  'aisha','aisya','aliaa','amal','amani','amina','aminah','amira','arwa','asma',
  'asmaa','aya','ayah','ayesha','basmah','bushra','dalia','deema','dina','doaa',
  'dunya','farah','fatima','fatma','fatemah','fatimah','fardous','ghada','hadeel',
  'hala','hanan','hanin','heba','hiba','hind','huda','hudaa','iman','israa',
  'jana','jannah','jasmine','jihan','khadija','khadijah','laila','layla','lana','lara',
  'lina','lubna','lujain','maha','maisa','malak','mariam','mariem','marwa','maryam',
  'mawaddah','maya','mona','muna','mounia','nada','nahla','najla','najwa','nehal',
  'noha','nora','noura','nour','noor','nourane','nouran','rahma','rahaf','rana',
  'rania','reem','rim','reham','riham','rana','randa','rouz','rana','salma',
  'samar','samia','samiha','sara','sarah','sawsan','sayidah','shahd','shaza','shimaa',
  'sondos','sumaya','suzan','suzanne','tasneem','tasnim','wafa','wafaa','walaa','wisam',
  'yara','yasmeen','yasmin','yumna','zahra','zaina','zainab','zaynab','zeina','zeineb',
]);

export function detectGenderFromName(rawName: string | null | undefined): Gender {
  if (!rawName) return 'unknown';
  const cleaned = rawName.trim();
  if (!cleaned) return 'unknown';

  // Take the first token (Arabic + Latin) — Facebook supplies full
  // names; the first one is the given name.
  const first = cleaned
    .split(/\s+/)[0]
    .replace(/[^ء-يa-zA-Z]/g, ''); // strip punctuation/numbers
  if (!first) return 'unknown';

  // 1. Exact match — Arabic feminine names list.
  if (FEMININE_NAMES.has(first)) return 'female';
  // Fold a few common alif variants for the lookup.
  const folded = first
    .replace(/ى$/u, 'ي')
    .replace(/[إأآا]/gu, 'ا')
    .replace(/ة$/u, 'ة');
  if (FEMININE_NAMES.has(folded)) return 'female';

  // 2. Latin / English transliteration list.
  const lower = first.toLowerCase();
  if (FEMININE_NAMES_LATIN.has(lower)) return 'female';

  // 3. Suffix rule for Arabic. Names ending in ة, اء, ى are
  // overwhelmingly feminine (with a tiny minority of male
  // exceptions like يحيى, موسى — unfortunately we don't filter
  // those out here; covered in masculine override below).
  if (/[ة]$/u.test(first)) {
    return 'female';
  }
  if (/(اء|ى)$/u.test(first)) {
    // Masculine exceptions to the ى rule.
    const MASC_EXCEPTIONS = new Set(['يحيى','موسى','عيسى','مصطفى','مرتضى','مجتبى']);
    if (!MASC_EXCEPTIONS.has(first)) return 'female';
  }

  // Default per owner's spec: when uncertain, treat as male so the
  // bot uses masculine grammar.
  return 'male';
}

// Returns a short Arabic directive to inject into the system prompt.
export function genderDirective(gender: Gender): string {
  switch (gender) {
    case 'female':
      return 'العميل أنثى — خاطبيها دائماً بصيغة المؤنث ("بكِ"، "حضرتكِ"، "نتشرّف بخدمتكِ"، "أهلاً بكِ"). هذه قاعدة مطلقة لا تخالفيها.';
    case 'male':
      return 'العميل ذكر — خاطبه دائماً بصيغة المذكر ("بك"، "حضرتك"، "نتشرّف بخدمتك"، "أهلاً بك").';
    case 'unknown':
    default:
      return 'العميل غير محدد الجنس — استخدم صيغة المذكر افتراضياً ("بك"، "حضرتك").';
  }
}
