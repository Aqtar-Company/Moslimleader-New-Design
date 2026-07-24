/* data.js — كل البيانات الثابتة للعبة: الورثة، الحالات، قيم التركة، النصوص التعليمية */

// ---------- بطاقات الورثة ----------
// كل نوع وارث: id, name, icon, color, description, count (عدد النسخ في الرزمة)
const HEIR_TYPES = [
  {
    id: 'son',
    name: 'ابن',
    icon: '👦',
    image: '/moro/cards/son.png',
    color: '#3E7CB1',
    description: 'الابن وارث بالتعصيب (يأخذ الباقي بعد أصحاب الفروض)، وللذكر مثل حظ الأنثيين مع البنات.',
    count: 3
  },
  {
    id: 'daughter',
    name: 'بنت',
    icon: '👧',
    image: '/moro/cards/daughter.png',
    color: '#B15C9E',
    description: 'البنت الواحدة تأخذ النصف، والبنتان فأكثر يأخذن الثلثين، وإن وُجد ابن أخذت مع إخوتها الباقي تعصيبًا.',
    count: 3
  },
  {
    id: 'father',
    name: 'أب',
    icon: '👴',
    image: '/moro/cards/father.png',
    color: '#4C9A6A',
    description: 'الأب يأخذ السدس مع وجود الابن، ويجمع بين السدس والباقي مع وجود البنت فقط، ويأخذ الباقي كله عند عدم وجود فرع وارث.',
    count: 3 // وارث فردي فقهيًا (لا يمكن أن يوجد للمتوفى أكثر من أب واحد)، لكن 3 نُّسخ في الرزمة — تصادم لاعبين على نفس الدور محلول بمنطق "الأسرع" (getLateSingularClaimPlayers)
  },
  {
    id: 'mother',
    name: 'أم',
    icon: '👵',
    image: '/moro/cards/mother.png',
    color: '#D98A3D',
    description: 'الأم تأخذ السدس مع وجود فرع وارث أو عدد من الإخوة، وتأخذ الثلث في غير ذلك.',
    count: 3 // وارث فردي فقهيًا — نفس منطق الأب أعلاه
  },
  {
    id: 'grandfather',
    name: 'جد',
    icon: '👴🏽',
    image: '/moro/cards/grandfather.png',
    color: '#1F6B4A',
    description: 'الجد (أب الأب) يُحجب كليًا بوجود الأب، ويقوم مقامه تمامًا فرضًا وتعصيبًا عند غيابه. عند اجتماعه مع الإخوة الأشقاء بلا أب ولا ابن: مسألة خلافية بين الصحابة — تُعرض كحالة تحتاج مراجعة.',
    count: 3 // وارث فردي فقهيًا — نفس المنطق
  },
  {
    id: 'grandmother',
    name: 'جدة (لأم)',
    icon: '👵🏽',
    image: '/moro/cards/grandmother.png',
    color: '#B8722E',
    description: 'الجدة لأم (أم الأم) تُحجب كليًا بوجود الأم، وتأخذ السدس عند غيابها. ملاحظة: هذه البطاقة تمثّل الجدة لأم تحديدًا؛ الجدة لأب لها حكم حجب مختلف (تُحجب بالأب أيضًا لا بالأم فقط) وغير ممثَّلة في هذه النسخة المبسّطة.',
    count: 3 // وارث فردي فقهيًا — نفس المنطق
  },
  {
    id: 'husband',
    name: 'زوج',
    icon: '🤵',
    image: '/moro/cards/husband.png',
    color: '#7A6FB0',
    description: 'الزوج يأخذ النصف إن لم يوجد فرع وارث للزوجة المتوفاة، والربع إن وُجد.',
    count: 3 // وارث فردي فقهيًا — المرأة لها زوج واحد فقط وقت وفاتها، بخلاف الزوجة (يصح تعددها حتى 4)
  },
  {
    id: 'wife',
    name: 'زوجة',
    icon: '👰',
    image: '/moro/cards/wife.png',
    color: '#C9598A',
    description: 'الزوجة تأخذ الربع إن لم يوجد فرع وارث للزوج المتوفى، والثمن إن وُجد، وتشترك الزوجات في النصيب.',
    count: 3
  },
  {
    id: 'brother',
    name: 'أخ شقيق',
    icon: '🧔',
    image: '/moro/cards/brother.png',
    color: '#3D8F8A',
    description: 'الأخ الشقيق وارث بالتعصيب، يُحجب بالأب أو الابن، وإن وُجدت أخت شقيقة معه اقتسما الباقي للذكر مثل حظ الأنثيين.',
    count: 3
  },
  {
    id: 'sister',
    name: 'أخت شقيقة',
    icon: '👩',
    image: '/moro/cards/sister.png',
    color: '#A9762E',
    description: 'الأخت الشقيقة تأخذ النصف منفردة أو الثلثين مع أخواتها، وتُحجب بالأب أو الابن.',
    count: 5 // 5 لا 3: مراجعة احتمالية أظهرت إنها الإجابة الصحيحة في 5 من 9 قضايا "سهل"، فقلة نُّسخها كانت بتسبّب يد بلا كارت صالح بمعدل عالي — انظر public/moro/RULES.md
  },
  {
    id: 'half-brother',
    name: 'أخ لأم',
    icon: '🧑',
    image: '/moro/cards/half-brother.png',
    color: '#5C8A99',
    description: 'الأخ لأم (من جهة الأم فقط) يُحجب بالفرع الوارث (ابن أو بنت) وبالأب والجد، ولا يتأثر بوجود الإخوة الأشقاء أو حجبهم — طبقة ميراث مستقلة تمامًا. منفردًا يأخذ السدس، ومع اثنين فأكثر من إخوته لأم (ذكورًا أو إناثًا) يقتسمون الثلث بالتساوي بينهم دون تفضيل للذكر.',
    count: 3
  },
  {
    id: 'half-sister',
    name: 'أخت لأم',
    icon: '👩‍🦱',
    image: '/moro/cards/half-sister.png',
    color: '#8A6C99',
    description: 'الأخت لأم لها نفس حكم الأخ لأم بالضبط: تُحجب بالفرع الوارث وبالأب والجد، ولا فرق بين الذكر والأنثى في القسمة (بخلاف الإخوة الأشقاء) — تقتسم مع إخوتها لأم الثلث بالتساوي عند التعدد، أو تأخذ السدس منفردة.',
    count: 3
  },
  {
    id: 'uncle',
    name: 'عم',
    icon: '👨‍🦳',
    image: '/moro/cards/uncle.png',
    color: '#7A5230',
    description: 'العم الشقيق عصبة بنفسه: يأخذ الباقي بعد أصحاب الفروض عند عدم وجود عاصب أقرب، لكنه محجوب كليًا بوجود الابن أو الأب أو الجد أو الإخوة الأشقاء. لا يُحجب بالبنت وحدها ولا بالأخوات فرضًا بلا إخوة ذكور.',
    count: 5 // 5 لا 3: مراجعة احتمالية أظهرت إنه الإجابة الصحيحة في 6 من 9 قضايا "سهل"، فقلة نُّسخه كانت بتسبّب يد بلا كارت صالح بمعدل عالي — انظر public/moro/RULES.md
  },
  {
    id: 'joker',
    name: 'جوكر',
    icon: '🃏',
    image: '/moro/cards/heir-generic.png',
    color: '#6B4F8A',
    description: 'بطاقة جوكر: عند لعبها تختار أي وارث مسموح به في حالة المتوفى الحالية لتمثله — تصلح مع أي حالة، ولا تُحجب أبدًا بنفسها.',
    count: 2
  }
];

function getHeirType(id) {
  return HEIR_TYPES.find(h => h.id === id);
}

// يُرجِع HTML لمحتوى كارت الوارث الكامل. لو عنده صورة حقيقية (heir.image)، الصورة نفسها هي
// تصميم الكارت الكامل (حدود ذهبية + اسم مطبوعين عليها) فتُعرض كاملة بلا أي قص وبلا نص
// مكرر من عندنا. وإلا (الجوكر مثلًا)، رجوع للشكل القديم: دائرة ملوَّنة بالإيموجي + اسم نصي.
function heirVisualHtml(heir) {
  if (heir.image) return `<img class="card-portrait-full" src="${heir.image}" alt="${heir.name}" draggable="false">`;
  // بلا صورة حقيقية (الجوكر تحديدًا حاليًا): تصميم "ملكي" بأركان ✦ ذهبية بدل الدائرة
  // المجرّدة القديمة، ليتّسق بصريًا مع باقي عناصر اللعبة (كروت القضية/التركة/الأحكام).
  return `<span class="royal-corner tl">✦</span><span class="royal-corner tr">✦</span><span class="royal-corner bl">✦</span><span class="royal-corner br">✦</span><div class="card-icon-badge"><span class="card-icon">${heir.icon}</span></div><div class="card-name">${heir.name}</div>`;
}

// كلاس إضافي على عنصر .card نفسه: has-photo لو عنده صورة حقيقية (يُلغي padding الكارت
// الافتراضي عشان الصورة تملأ الكارت بالكامل)، أو royal-fallback لو بلا صورة (حدود ذهبية).
function heirCardClass(heir) {
  return heir.image ? ' has-photo' : ' royal-fallback';
}

// ---------- بطاقات حالة المتوفى (24 قضية، من شيت المراجعة الفقهية — قيمة تركة ثابتة لكل قضية) ----------
// difficulty مُشتقّة تلقائيًا من عدد أنواع الورثة الفعليين في القضية: 1-2 نوع = سهل، 3-4 = متوسط، 5 = متقدم.
// estateValue ثابتة لكل قضية (لا تُسحب عشوائيًا بعد الآن) — كل قضية محسوبة يدويًا لتنقسم بلا كسور.
const DECEASED_CASES = [
  {
    id: 1, difficulty: 'medium', deceasedGender: 'male', estateValue: 48,
    disallowed: ['brother', 'daughter', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'son', 'uncle'],
    title: 'قضية رقم 1', note: 'متوفى، لا يوجد أولاد (لا ابن ولا بنت).',
    lesson: 'زوجة: الربع (1/4) = 12 سهم فرضًا. (مسألة عُمَرية: زوجة+أب+أم بلا فرع وارث) الأم تأخذ ثلث الباقي بعد نصيب الزوجة = 12 سهم، لا السدس، والأب الباقي = 24 سهم تعصيبًا.'
  },
  {
    id: 2, difficulty: 'medium', deceasedGender: 'female', estateValue: 24,
    disallowed: ['brother', 'daughter', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'sister', 'son', 'uncle', 'wife'],
    title: 'قضية رقم 2', note: 'متوفاة، لا يوجد أولاد (لا ابن ولا بنت).',
    lesson: 'أم: السدس (1/6) = 4 سهم، زوج: النصف (1/2) = 12 سهم فرضًا، وأب: 8 سهم تعصيبًا.'
  },
  {
    id: 3, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'father', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle'],
    title: 'قضية رقم 3', note: 'متوفى، لا يوجد أب.',
    lesson: 'أم: السدس (1/6) = 48 سهم، جد: السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم فرضًا، وابن: 104 سهم، بنت: 52 سهم تعصيبًا.'
  },
  {
    id: 4, difficulty: 'advanced', deceasedGender: 'female', estateValue: 72,
    disallowed: ['brother', 'father', 'grandmother', 'half-brother', 'half-sister', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 4', note: 'متوفاة، لا يوجد أب.',
    lesson: 'أم: السدس (1/6) = 12 سهم، جد: السدس (1/6) = 12 سهم، زوج: الربع (1/4) = 18 سهم فرضًا، وابن: 20 سهم، بنت: 10 سهم تعصيبًا.'
  },
  {
    id: 5, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'grandfather', 'half-brother', 'half-sister', 'husband', 'mother', 'sister', 'uncle'],
    title: 'قضية رقم 5', note: 'متوفى، لا يوجد أم.',
    lesson: 'أب: السدس (1/6) = 48 سهم، جدة: السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم فرضًا، وابن: 104 سهم، بنت: 52 سهم تعصيبًا.'
  },
  {
    id: 6, difficulty: 'advanced', deceasedGender: 'female', estateValue: 72,
    disallowed: ['brother', 'grandfather', 'half-brother', 'half-sister', 'mother', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 6', note: 'متوفاة، لا يوجد أم.',
    lesson: 'أب: السدس (1/6) = 12 سهم، جدة: السدس (1/6) = 12 سهم، زوج: الربع (1/4) = 18 سهم فرضًا، وابن: 20 سهم، بنت: 10 سهم تعصيبًا.'
  },
  {
    id: 7, difficulty: 'medium', deceasedGender: 'male', estateValue: 36,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 7', note: 'متوفى، لا يوجد زوج/زوجة.',
    lesson: 'أب: السدس (1/6) = 6 سهم، أم: السدس (1/6) = 6 سهم فرضًا، وابن: 16 سهم، بنت: 8 سهم تعصيبًا.'
  },
  {
    id: 8, difficulty: 'medium', deceasedGender: 'female', estateValue: 36,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 8', note: 'متوفاة، لا يوجد زوج/زوجة.',
    lesson: 'أب: السدس (1/6) = 6 سهم، أم: السدس (1/6) = 6 سهم فرضًا، وابن: 16 سهم، بنت: 8 سهم تعصيبًا.'
  },
  {
    id: 9, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle'],
    title: 'قضية رقم 9', note: 'متوفى، لا يوجد إخوة (لا أخ ولا أخت).',
    lesson: 'أب: السدس (1/6) = 48 سهم، أم: السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم فرضًا، وابن: 104 سهم، بنت: 52 سهم تعصيبًا.'
  },
  {
    id: 10, difficulty: 'advanced', deceasedGender: 'female', estateValue: 72,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 10', note: 'متوفاة، لا يوجد إخوة (لا أخ ولا أخت).',
    lesson: 'أب: السدس (1/6) = 12 سهم، أم: السدس (1/6) = 12 سهم، زوج: الربع (1/4) = 18 سهم فرضًا، وابن: 20 سهم، بنت: 10 سهم تعصيبًا.'
  },
  {
    id: 11, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle'],
    title: 'قضية رقم 11', note: 'متوفى، لا يوجد جد.',
    lesson: 'أب: السدس (1/6) = 48 سهم، أم: السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم فرضًا، وابن: 104 سهم، بنت: 52 سهم تعصيبًا.'
  },
  {
    id: 12, difficulty: 'advanced', deceasedGender: 'female', estateValue: 72,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 12', note: 'متوفاة، لا يوجد جد.',
    lesson: 'أب: السدس (1/6) = 12 سهم، أم: السدس (1/6) = 12 سهم، زوج: الربع (1/4) = 18 سهم فرضًا، وابن: 20 سهم، بنت: 10 سهم تعصيبًا.'
  },
  {
    id: 13, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle'],
    title: 'قضية رقم 13', note: 'متوفى، لا يوجد جدة.',
    lesson: 'أب: السدس (1/6) = 48 سهم، أم: السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم فرضًا، وابن: 104 سهم، بنت: 52 سهم تعصيبًا.'
  },
  {
    id: 14, difficulty: 'advanced', deceasedGender: 'female', estateValue: 36,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 14', note: 'متوفاة، لا يوجد جدة.',
    lesson: 'أب: السدس (1/6) = 6 سهم، أم: السدس (1/6) = 6 سهم، زوج: الربع (1/4) = 9 سهم فرضًا، وابن: 10 سهم، بنت: 5 سهم تعصيبًا.'
  },
  {
    id: 15, difficulty: 'easy', deceasedGender: 'male', estateValue: 36,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'sister', 'son', 'wife'],
    title: 'قضية رقم 15', note: 'متوفى، العم منفردًا (لا ابن، لا أب، لا جد، لا أخ) — يأخذ التركة كاملة.',
    lesson: 'عم: 36 سهم تعصيبًا.'
  },
  {
    id: 16, difficulty: 'easy', deceasedGender: 'male', estateValue: 72,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'husband', 'mother', 'sister', 'son', 'uncle'],
    title: 'قضية رقم 16', note: 'متوفى، زوجة + أخ لأم + أخت لأم (كلالة، بلا فرع وارث ولا إخوة أشقاء ولا أب ولا جد ولا عم).',
    lesson: 'زوجة: الربع (1/4) = 18 سهم فرضًا. أخ لأم: 12 سهم، أخت لأم: 12 سهم (فرض الإخوة لأم: الثلث مقسوم بينهما بالتساوي، بلا تفضيل للذكر). يتبقى 30 سهم بلا عصبة معروفة في هذه النسخة.'
  },
  {
    id: 17, difficulty: 'easy', deceasedGender: 'female', estateValue: 96,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'mother', 'sister', 'son', 'wife'],
    title: 'قضية رقم 17', note: 'متوفاة، زوج + عم (بلا فرع وارث ولا إخوة ولا أب ولا جد ولا ابن).',
    lesson: 'زوج: النصف (1/2) = 48 سهم فرضًا، وعم: 48 سهم تعصيبًا.'
  },
  {
    id: 18, difficulty: 'easy', deceasedGender: 'male', estateValue: 72,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'son', 'wife'],
    title: 'قضية رقم 18', note: 'متوفى، أم + عم (بلا فرع وارث ولا إخوة ولا أب ولا جد ولا ابن).',
    lesson: 'أم: الثلث (1/3) = 24 سهم فرضًا، وعم: 48 سهم تعصيبًا.'
  },
  {
    id: 19, difficulty: 'easy', deceasedGender: 'male', estateValue: 12,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'son', 'wife'],
    title: 'قضية رقم 19', note: 'متوفى، أخت شقيقة (كلالة) + عم معًا.',
    lesson: 'أخت: النصف (1/2) = 6 سهم فرضًا، وعم: 6 سهم تعصيبًا.'
  },
  {
    id: 20, difficulty: 'easy', deceasedGender: 'female', estateValue: 24,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'son', 'wife'],
    title: 'قضية رقم 20', note: 'متوفاة، أختان شقيقتان (كلالة) + عم معًا.',
    lesson: 'أخت(2): الثلثان (2/3) = 16 سهم (8/فرد) فرضًا، وعم: 8 سهم تعصيبًا.'
  },
  {
    id: 21, difficulty: 'easy', deceasedGender: 'male', estateValue: 36,
    disallowed: ['daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'son', 'uncle', 'wife'],
    title: 'قضية رقم 21', note: 'متوفى، إخوة كلالة (أخ + أخت) بلا أب ولا ابن ولا جد ولا عم.',
    lesson: 'أخ: 24 سهم، أخت: 12 سهم تعصيبًا.'
  },
  {
    id: 22, difficulty: 'medium', deceasedGender: 'male', estateValue: 144,
    disallowed: ['daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'son', 'uncle'],
    title: 'قضية رقم 22', note: 'متوفى، إخوة كلالة مع أم وزوجة (بلا أب ولا ابن ولا جد).',
    lesson: 'أم: السدس (1/6) = 24 سهم، زوجة: الربع (1/4) = 36 سهم فرضًا، وأخ: 56 سهم، أخت: 28 سهم تعصيبًا.'
  },
  {
    id: 23, difficulty: 'easy', deceasedGender: 'female', estateValue: 72,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'son', 'uncle', 'wife'],
    title: 'قضية رقم 23', note: 'متوفاة، أخوات كلالة فقط، بلا أخ ولا بنت ولا عم — فرض ثابت بلا تعصيب.',
    lesson: 'أخت(3): الثلثان (2/3) = 48 سهم (16/فرد) فرضًا. يتبقى 24 سهم بلا عصبة معروفة في هذه النسخة.'
  },
  {
    id: 24, difficulty: 'easy', deceasedGender: 'male', estateValue: 72,
    disallowed: ['brother', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'son', 'uncle', 'wife'],
    title: 'قضية رقم 24', note: 'متوفى، أخت كلالة + بنت (عصبة مع الغير) بلا أخ ولا عم.',
    lesson: 'بنت: النصف (1/2) = 36 سهم فرضًا، وأخت: 36 سهم تعصيبًا.'
  },
];

// ---------- الآيات القرآنية المرجعية (رسم إملائي مبسّط، ليتوافق مع خطوط النظام العادية —
// الرسم العثماني الكامل يحتاج خطًّا قرآنيًا متخصصًا غير متوفر هنا) ----------
const QURAN_AYAT = {
  'nisa-11': {
    surah: 'النساء', ayah: '11',
    text: 'يُوصِيكُمُ اللَّهُ فِي أَوْلَادِكُمْ ۖ لِلذَّكَرِ مِثْلُ حَظِّ الْأُنْثَيَيْنِ ۚ فَإِنْ كُنَّ نِسَاءً فَوْقَ اثْنَتَيْنِ فَلَهُنَّ ثُلُثَا مَا تَرَكَ ۖ وَإِنْ كَانَتْ وَاحِدَةً فَلَهَا النِّصْفُ ۚ وَلِأَبَوَيْهِ لِكُلِّ وَاحِدٍ مِنْهُمَا السُّدُسُ مِمَّا تَرَكَ إِنْ كَانَ لَهُ وَلَدٌ ۚ فَإِنْ لَمْ يَكُنْ لَهُ وَلَدٌ وَوَرِثَهُ أَبَوَاهُ فَلِأُمِّهِ الثُّلُثُ ۚ فَإِنْ كَانَ لَهُ إِخْوَةٌ فَلِأُمِّهِ السُّدُسُ ۚ مِنْ بَعْدِ وَصِيَّةٍ يُوصِي بِهَا أَوْ دَيْنٍ ۗ آبَاؤُكُمْ وَأَبْنَاؤُكُمْ لَا تَدْرُونَ أَيُّهُمْ أَقْرَبُ لَكُمْ نَفْعًا ۚ فَرِيضَةً مِنَ اللَّهِ ۗ إِنَّ اللَّهَ كَانَ عَلِيمًا حَكِيمًا'
  },
  'nisa-12': {
    surah: 'النساء', ayah: '12',
    text: '۞ وَلَكُمْ نِصْفُ مَا تَرَكَ أَزْوَاجُكُمْ إِنْ لَمْ يَكُنْ لَهُنَّ وَلَدٌ ۚ فَإِنْ كَانَ لَهُنَّ وَلَدٌ فَلَكُمُ الرُّبُعُ مِمَّا تَرَكْنَ ۚ مِنْ بَعْدِ وَصِيَّةٍ يُوصِينَ بِهَا أَوْ دَيْنٍ ۚ وَلَهُنَّ الرُّبُعُ مِمَّا تَرَكْتُمْ إِنْ لَمْ يَكُنْ لَكُمْ وَلَدٌ ۚ فَإِنْ كَانَ لَكُمْ وَلَدٌ فَلَهُنَّ الثُّمُنُ مِمَّا تَرَكْتُمْ ۚ مِنْ بَعْدِ وَصِيَّةٍ تُوصُونَ بِهَا أَوْ دَيْنٍ ۗ وَإِنْ كَانَ رَجُلٌ يُورَثُ كَلَالَةً أَوِ امْرَأَةٌ وَلَهُ أَخٌ أَوْ أُخْتٌ فَلِكُلِّ وَاحِدٍ مِنْهُمَا السُّدُسُ ۚ فَإِنْ كَانُوا أَكْثَرَ مِنْ ذَٰلِكَ فَهُمْ شُرَكَاءُ فِي الثُّلُثِ ۚ مِنْ بَعْدِ وَصِيَّةٍ يُوصَىٰ بِهَا أَوْ دَيْنٍ غَيْرَ مُضَارٍّ ۚ وَصِيَّةً مِنَ اللَّهِ ۗ وَاللَّهُ عَلِيمٌ حَلِيمٌ'
  },
  'nisa-176': {
    surah: 'النساء', ayah: '176',
    text: 'يَسْتَفْتُونَكَ قُلِ اللَّهُ يُفْتِيكُمْ فِي الْكَلَالَةِ ۚ إِنِ امْرُؤٌ هَلَكَ لَيْسَ لَهُ وَلَدٌ وَلَهُ أُخْتٌ فَلَهَا نِصْفُ مَا تَرَكَ ۚ وَهُوَ يَرِثُهَا إِنْ لَمْ يَكُنْ لَهَا وَلَدٌ ۚ فَإِنْ كَانَتَا اثْنَتَيْنِ فَلَهُمَا الثُّلُثَانِ مِمَّا تَرَكَ ۚ وَإِنْ كَانُوا إِخْوَةً رِجَالًا وَنِسَاءً فَلِلذَّكَرِ مِثْلُ حَظِّ الْأُنْثَيَيْنِ ۗ يُبَيِّنُ اللَّهُ لَكُمْ أَنْ تَضِلُّوا ۗ وَاللَّهُ بِكُلِّ شَيْءٍ عَلِيمٌ'
  }
};

// لكل نوع وارث: مفتاح الآية المرجعية + ملاحظة توضّح أي جزء من الآية ينطبق
// (الملاحظة اجتهاد/توضيح فقهي وليست جزءًا من نص القرآن نفسه)
const HEIR_QURAN_REF = {
  husband: { ayah: 'nisa-12', note: 'أول الآية: "ولكم نصف ما ترك أزواجكم..." — نصيب الزوج.' },
  wife: { ayah: 'nisa-12', note: 'وسط الآية: "ولهن الربع مما تركتم..." — نصيب الزوجة.' },
  'half-brother': { ayah: 'nisa-12', note: 'آخر الآية: "وإن كان رجل يورث كلالة أو امرأة وله أخ أو أخت فلكل واحد منهما السدس... فإن كانوا أكثر من ذلك فهم شركاء في الثلث" — هذا نصيب الإخوة لأم تحديدًا (غير آية الكلالة الأخرى بسورة النساء 176 الخاصة بالإخوة الأشقاء)، ولا فرق فيه بين الذكر والأنثى.' },
  'half-sister': { ayah: 'nisa-12', note: 'نفس آخر آية الزوجة أعلاه: نصيب الإخوة لأم، السدس لواحد أو الثلث بالتساوي للأكثر، بلا فرق بين الذكر والأنثى.' },
  mother: { ayah: 'nisa-11', note: 'وسط الآية: نصيب الأم (السدس أو الثلث). في المسألتين العُمَريتين تحديدًا (زوج/زوجة + أب + أم) طُبِّق اجتهاد الجمهور (المنسوب لعمر بن الخطاب) وليس نصًّا قرآنيًا مباشرًا.' },
  father: { ayah: 'nisa-11', note: 'وسط الآية: "ولأبويه لكل واحد منهما السدس..." — فرض الأب. أخذه الباقي تعصيبًا عند عدم وجود فرع وارث مبنيّ على إجماع الفقهاء وحديث "ألحقوا الفرائض بأهلها" وليس نصًّا مباشرًا في هذه الآية.' },
  son: { ayah: 'nisa-11', note: 'أول الآية: "للذكر مثل حظ الأنثيين" — تعصيب الابن مع البنت.' },
  daughter: { ayah: 'nisa-11', note: 'أول الآية: فرض البنت (النصف أو الثلثان) أو تعصيبها مع أخيها.' },
  brother: { ayah: 'nisa-176', note: 'آخر آية في سورة النساء (آية الكلالة) — تخص الإخوة الأشقاء. "وإن كانوا إخوة رجالًا ونساء فللذكر مثل حظ الأنثيين".' },
  sister: { ayah: 'nisa-176', note: 'آية الكلالة: "وإن امرؤ هلك ليس له ولد وله أخت فلها نصف ما ترك".' },
  grandfather: { ayah: 'nisa-11', note: 'الجد غير مذكور بنص صريح في هذه الآية؛ قيامه مقام الأب فرضًا وتعصيبًا عند غياب الأب ثابت بإجماع الفقهاء قياسًا عليه، لا بنص مباشر هنا.' },
  grandmother: { ayah: 'nisa-11', note: 'الجدة أيضًا غير مذكورة بنص صريح هنا؛ فرضها (السدس) عند غياب الأم ثابت بالسنة والإجماع لا بنص هذه الآية مباشرة.' }
};

// ---------- بطاقات القضايا/الأحكام (النسخة النهائية، 50 بطاقة) ----------
// تُنفَّذ بعد توزيع الميراث، ولا تؤثر في صحة القسمة الشرعية، وإنما تُطبَّق على "رصيد" منفصل لكل لاعب.
// كل بطاقة effects: مصفوفة آثار (غالبًا عنصر واحد، وأحيانًا أكثر للبطاقات المركّبة) تُطبَّق كلها بالتتابع.
// أنواع target: self | allPlayers | allExceptSelf | heirsThisRound | aqilah | largestAqilahShare |
//   highestBalanceAqilah | lowestBalance | highestBalance | allExceptHighestBalance | lowestBalancePool |
//   largestShareThisRound | smallestShareThisRound | leftNeighbor | rightNeighbor | allOthersPayToSelf |
//   chosenPlayer | chosenPlayers2 | conditionalBalance | firstToNotice | none
// amount: القيمة المطبَّقة (سالبة=دفع، موجبة=أخذ). selfAmount: أثر إضافي على صاحب الدور (نقل مباشر).
// deferred: { amount, afterRounds } — أثر مؤجَّل يُطبَّق تلقائيًا بعد عدد الجولات المحدد.
const JUDGMENT_CARDS = [
  // ⚖️ حقوق التركة (1-15) — تُخصم من اللاعب الحالي نيابةً عن التركة قبل الاستفادة منها
  { id: 1, category: 'rights', categoryIcon: '⚖️', title: 'دين على المتوفى', story: 'بعد انتهاء الورثة من تقسيم التركة، حضر أحد جيران المتوفى ومعه ورقة قديمة تثبت أن المتوفى اقترض منه مالًا ولم يتمكن من سداده قبل وفاته. نظر الورثة إلى بعضهم، فقد أصبح المال في أيديهم بالفعل.', benefit: 'الدَّين من أعظم الحقوق، ولذلك يُقدَّم سداده على توزيع الميراث. قال تعالى: ﴿مِن بَعْدِ وَصِيَّةٍ يُوصِي بِهَا أَوْ دَيْنٍ﴾', ruling: 'يدفع اللاعب الحالي 5 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -5 }] },
  { id: 2, category: 'rights', categoryIcon: '⚖️', title: 'مؤخر الصداق', story: 'تبين للورثة أن المتوفى لم يكن قد سدد مؤخر صداق زوجته، وكان ينوي أداءه عندما تتيسر أحواله.', benefit: 'مؤخر الصداق دين ثابت في ذمة الزوج حتى يؤديه.', ruling: 'يدفع اللاعب الحالي 4 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -4 }] },
  { id: 3, category: 'rights', categoryIcon: '⚖️', title: 'زكاة المال', story: 'وجد الورثة في أوراق المتوفى حسابًا يبين أن زكاة ماله لم تُخرج في العام الماضي.', benefit: 'حقوق الله المتعلقة بالمال، ومنها الزكاة، تُؤدى قبل تقسيم التركة.', ruling: 'يدفع اللاعب الحالي 3 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -3 }] },
  { id: 4, category: 'rights', categoryIcon: '⚖️', title: 'أمانة', story: 'عثر الورثة داخل خزانة المتوفى على مبلغ من المال مكتوب عليه اسم أحد أصدقائه، فعرفوا أنه أمانة عنده.', benefit: 'الأمانة ليست من التركة، بل يجب ردها إلى صاحبها. قال تعالى: ﴿إِنَّ اللَّهَ يَأْمُرُكُمْ أَنْ تُؤَدُّوا الْأَمَانَاتِ إِلَى أَهْلِهَا﴾', ruling: 'يدفع اللاعب الحالي 3 أسهم ويردها لصاحب الأمانة نيابة عن التركة.', effects: [{ target: 'self', amount: -3 }] },
  { id: 5, category: 'rights', categoryIcon: '⚖️', title: 'وصية صحيحة', story: 'بعد القسمة، وجد الورثة وصية صحيحة أوصى فيها المتوفى بجزء من ماله لأحد أعمال الخير.', benefit: 'الوصية المشروعة تُنفذ قبل توزيع الميراث.', ruling: 'يدفع اللاعب الحالي 3 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -3 }] },
  { id: 6, category: 'rights', categoryIcon: '⚖️', title: 'أجرة عامل', story: 'كان المتوفى قد استأجر عاملًا لإصلاح منزله، لكنه توفي قبل أن يدفع له أجره.', benefit: 'أجرة العامل حق واجب. قال ﷺ: "أعطوا الأجير أجره قبل أن يجف عرقه."', ruling: 'يدفع اللاعب الحالي 3 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -3 }] },
  { id: 7, category: 'rights', categoryIcon: '⚖️', title: 'رد المظالم', story: 'اعترف أحد الورثة أن جزءًا من المال الموروث كان قد أخذه المتوفى بغير حق، ويجب رده إلى صاحبه.', benefit: 'لا يحل مال امرئ مسلم إلا بطيب نفس منه.', ruling: 'يدفع اللاعب الحالي 4 أسهم مباشرة لصاحب الحق (يُختار لاعب يمثله، أو تُرد للبنك إن لم يوجد).', effects: [{ target: 'self', amount: -4 }] },
  { id: 8, category: 'rights', categoryIcon: '⚖️', title: 'نفقة تجهيز المتوفى', story: 'بعد القسمة، تذكر الورثة أن بعض تكاليف تجهيز المتوفى ودفنه لم تكن قد سُددت.', benefit: 'تجهيز الميت من الحقوق التي تُقدم على قسمة التركة.', ruling: 'يدفع اللاعب الحالي سهمين نيابة عن التركة.', effects: [{ target: 'self', amount: -2 }] },
  { id: 9, category: 'rights', categoryIcon: '⚖️', title: 'نذر مالي', story: 'وجد الورثة ورقة بخط المتوفى يذكر فيها أنه نذر صدقة مالية إذا شفى الله ابنه، ثم تحقق ذلك قبل وفاته.', benefit: 'النذر الواجب يجب الوفاء به.', ruling: 'يدفع اللاعب الحالي 3 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -3 }] },
  { id: 10, category: 'rights', categoryIcon: '⚖️', title: 'كفارة واجبة', story: 'تبين أن على المتوفى كفارة مالية لم يكن قد أخرجها.', benefit: 'إذا وجبت كفارة مالية في ذمة الإنسان فإنها تُخرج من تركته وفق أحكامها.', ruling: 'يدفع اللاعب الحالي 3 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -3 }] },
  { id: 11, category: 'rights', categoryIcon: '⚖️', title: 'مال شريك', story: 'بعد مراجعة الأوراق، تبين أن جزءًا من العقار الموروث كان مملوكًا لشريك آخر، وليس للمتوفى وحده.', benefit: 'لا يجوز أن يرث الإنسان ما ليس مملوكًا للمورث.', ruling: 'يدفع اللاعب الحالي 4 أسهم لصاحب الحصة نيابة عن التركة.', effects: [{ target: 'self', amount: -4 }] },
  { id: 12, category: 'rights', categoryIcon: '⚖️', title: 'دين مجهول', story: 'ظهر شخص يحمل مستندًا يثبت أن للمتوفى دينًا قديمًا لم يكن أحد من الورثة يعلم به.', benefit: 'حقوق العباد لا تسقط بوفاة صاحبها.', ruling: 'يدفع اللاعب الحالي 8 أسهم كاملة نيابة عن كل الورثة (مبلغ أعلى لأن الدين لم يكن متوقعًا).', effects: [{ target: 'self', amount: -8 }] },
  { id: 13, category: 'rights', categoryIcon: '⚖️', title: 'وديعة مصرفية', story: 'تبين أن جزءًا من المال الموجود في الحساب البنكي كان وديعة لأحد الأقارب وليست ملكًا للمتوفى.', benefit: 'الوديعة أمانة يجب ردها إلى صاحبها.', ruling: 'يدفع اللاعب الحالي 3 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -3 }] },
  { id: 14, category: 'rights', categoryIcon: '⚖️', title: 'سداد قرض حسن', story: 'كان أحد أقارب المتوفى قد أقرضه مالًا دون فوائد، ولم يتمكن من استرداده قبل وفاته.', benefit: 'رد القرض من أداء الأمانة، وهو من أولى الحقوق.', ruling: 'يدفع اللاعب الحالي 4 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -4 }] },
  { id: 15, category: 'rights', categoryIcon: '⚖️', title: 'اجتماع الحقوق', story: 'بعد مراجعة التركة، تبين وجود أكثر من حق مالي على المتوفى؛ دَين، وزكاة، وأجرة عامل لم تُسدَّد.', benefit: 'تُقدَّم الحقوق المتعلقة بالتركة على توزيع الميراث، حتى يصل كل ذي حق إلى حقه.', ruling: 'يدفع اللاعب الحالي 9 أسهم نيابة عن التركة (دين + زكاة + أجرة عامل مجمّعين).', effects: [{ target: 'self', amount: -9 }] },

  // 👨‍👩‍👧 مسؤوليات مالية بعد الميراث (16-25)
  { id: 16, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'مؤخر الصداق', story: 'مرت سنوات على زواجك، وحان الوقت للوفاء بمؤخر صداق زوجتك الذي اتفقتما عليه يوم عقد الزواج.', benefit: 'مؤخر الصداق حق للزوجة، وهو دين في ذمة الزوج حتى يؤديه.', ruling: 'ادفع 13 سهمًا إلى البنك.', effects: [{ target: 'self', amount: -13 }] },
  { id: 17, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'إتلاف مزرعة الجيران', story: 'كان ابنك يلعب بالألعاب النارية، فتطاير شررها إلى مزرعة الجيران وأتلف جزءًا من المحصول.', benefit: 'يحرم الاعتداء على أموال الناس، ومن تسبب في إتلاف مال غيره فعليه ضمانه.', ruling: 'ادفع 10 أسهم إلى البنك.', effects: [{ target: 'self', amount: -10 }] },
  { id: 18, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'سداد دين شخصي', story: 'حل موعد سداد دين كنت قد اقترضته قبل مدة، وجاء صاحبه يطالبك بحقه.', benefit: 'المؤمن يفي بديونه ولا يماطل في أداء الحقوق.', ruling: 'ادفع 5 أسهم إلى البنك.', effects: [{ target: 'self', amount: -5 }] },
  { id: 19, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'زكاة مالك', story: 'مر عام كامل على مالك، وبلغ النصاب، فأصبحت الزكاة واجبة عليك.', benefit: 'الزكاة ركن من أركان الإسلام، وهي حق للفقراء في مال الأغنياء.', ruling: 'ادفع 3 أسهم إلى البنك.', effects: [{ target: 'self', amount: -3 }] },
  { id: 20, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'نفقة الأسرة', story: 'بدأ العام الدراسي، واحتاج أبناؤك إلى الكتب والملابس والمستلزمات الدراسية.', benefit: 'النفقة على الزوجة والأولاد من مسؤوليات رب الأسرة.', ruling: 'ادفع 5 أسهم إلى البنك.', effects: [{ target: 'self', amount: -5 }] },
  { id: 21, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'علاج أحد أبنائك', story: 'مرض أحد أبنائك واحتاج إلى عملية جراحية عاجلة، فبادرت بعلاجه.', benefit: 'الإنفاق على علاج من تعولهم من أعظم صور القيام بالمسؤولية.', ruling: 'ادفع 8 أسهم إلى البنك.', effects: [{ target: 'self', amount: -8 }] },
  { id: 22, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'إصلاح المنزل الموروث', story: 'ورثت منزلًا قديمًا، لكنك اكتشفت أنه يحتاج إلى إصلاحات قبل أن يصبح صالحًا للسكن.', benefit: 'حفظ المال واستثماره من الأمور المحمودة، ويحتاج أحيانًا إلى إنفاق قبل الانتفاع به.', ruling: 'ادفع 5 أسهم، ثم في الجولة القادمة خذ 8 أسهم من البنك.', effects: [{ target: 'self', amount: -5, deferred: { amount: 8, afterRounds: 1 } }] },
  { id: 23, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'استصلاح أرض موروثة', story: 'ورثت أرضًا مهملة، فأنفقت عليها حتى أصبحت صالحة للزراعة والإنتاج.', benefit: 'إحياء الأرض واستثمارها من الأعمال النافعة التي تعود بالنفع على صاحبها والمجتمع.', ruling: 'ادفع 5 أسهم، ثم خذ 10 أسهم من البنك.', effects: [{ target: 'self', amount: -5 }, { target: 'self', amount: 10 }] },
  { id: 24, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'سداد دين عن والدك', story: 'علمت أن والدك توفي وعليه دين لم يتمكن من سداده، فبادرت إلى سداده من مالك تبرعًا وإحسانًا.', benefit: 'قضاء دين الوالد بعد وفاته من أعظم صور البر والإحسان.', ruling: 'ادفع 5 أسهم، ثم خذ 5 أسهم من البنك مكافأة.', effects: [{ target: 'self', amount: -5 }, { target: 'self', amount: 5 }] },
  { id: 25, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'توسعة التجارة', story: 'استثمرت جزءًا من المال الذي ورثته في توسيع تجارتك، واشتركت مع تاجر أمين حتى ازداد نشاطك التجاري.', benefit: 'المال نعمة، وأفضل استثماره فيما ينفع صاحبه والناس.', ruling: 'ادفع 5 أسهم الآن، ثم خذ 10 أسهم من البنك.', effects: [{ target: 'self', amount: -5 }, { target: 'self', amount: 10 }] },

  // 🛡️ العاقلة، القتل الخطأ، الصلح، العفو (26-35)
  { id: 26, category: 'aqilah', categoryIcon: '🛡️', title: 'دية القتل الخطأ', story: 'وقع حادث سير غير مقصود تسبب في وفاة أحد الناس. وبعد نظر القضية، حكم القاضي بوجوب الدية على الجاني.', benefit: 'في القتل الخطأ، تتحمل العاقلة (العصبة من الذكور) المساهمة في دفع الدية، تخفيفًا عن الجاني وتحقيقًا للتكافل.', ruling: 'كل لاعب من العاقلة يدفع 8 أسهم.', effects: [{ target: 'aqilah', amount: -8 }] },
  { id: 27, category: 'aqilah', categoryIcon: '🛡️', title: 'العفو عن جزء من الدية', story: 'قرر أولياء الدم العفو عن جزء من الدية، رغبةً في الأجر والإصلاح.', benefit: 'العفو من أفضل الأخلاق، وقد رغب الإسلام في الصلح والإحسان.', ruling: 'كل لاعب من العاقلة يسترد 3 أسهم.', effects: [{ target: 'aqilah', amount: 3 }] },
  { id: 28, category: 'aqilah', categoryIcon: '🛡️', title: 'صلح بين العائلتين', story: 'اجتمع كبار العائلتين، وانتهت القضية بالصلح والتراضـي دون نزاع.', benefit: 'الصلح خير، ويطفئ كثيرًا من أسباب العداوة.', ruling: 'كل لاعب من العاقلة يسترد سهمين.', effects: [{ target: 'aqilah', amount: 2 }] },
  { id: 29, category: 'aqilah', categoryIcon: '🛡️', title: 'محسن تكفل بجزء من الدية', story: 'تبرع أحد المحسنين بجزء من مبلغ الدية، تخفيفًا عن أهل الجاني.', benefit: 'تفريج كرب المسلمين من أعظم القربات.', ruling: 'كل لاعب من العاقلة يدفع 5 أسهم فقط بدلًا من 8.', effects: [{ target: 'aqilah', amount: -5 }] },
  { id: 30, category: 'aqilah', categoryIcon: '🛡️', title: 'إعسار أحد أفراد العاقلة', story: 'كان أحد أفراد العاقلة فقيرًا لا يستطيع المشاركة في دفع نصيبه من الدية.', benefit: 'يراعى حال المعسر، ويتعاون أهل الخير في قضاء الحقوق.', ruling: 'أغنى لاعب من العاقلة يدفع 5 أسهم إضافية بدلًا عنه.', effects: [{ target: 'highestBalanceAqilah', amount: -5 }] },
  { id: 31, category: 'aqilah', categoryIcon: '🛡️', title: 'توسعت العاقلة', story: 'اشترك عدد أكبر من أفراد العاقلة في تحمل الدية، فتوزع العبء بينهم.', benefit: 'كلما زاد المشاركون، خف العبء عن كل فرد.', ruling: 'كل لاعب من العاقلة يدفع 5 أسهم بدلًا من 8.', effects: [{ target: 'aqilah', amount: -5 }] },
  { id: 32, category: 'aqilah', categoryIcon: '🛡️', title: 'كبير العائلة', story: 'قرر كبير العائلة أن يتحمل جزءًا أكبر من الدية تخفيفًا عن بقية أفراد الأسرة.', benefit: 'الإحسان والتطوع في تحمل الأعباء من مكارم الأخلاق.', ruling: 'صاحب أكبر رصيد من العاقلة يدفع 5 أسهم إضافية.', effects: [{ target: 'highestBalanceAqilah', amount: -5 }] },
  { id: 33, category: 'aqilah', categoryIcon: '🛡️', title: 'تنازل عن حقه', story: 'تنازل أحد أفراد العاقلة عن حقه في استرداد ما دفعه، ابتغاءً للأجر.', benefit: 'الإيثار والعفو من أسباب الألفة بين الناس.', ruling: 'اختر لاعبًا من العاقلة، ولا يسترد أي أسهم في هذه البطاقة.', effects: [{ target: 'none', amount: 0 }] },
  { id: 34, category: 'aqilah', categoryIcon: '🛡️', title: 'القاتل لا يرث', story: 'أثناء مراجعة القضية، ثبت أن أحد الورثة قتل المورث عمدًا بغير حق.', benefit: 'من موانع الإرث في الجملة قتل المورث بغير حق، فلا يجتمع للإنسان أن يستعجل المال بجريمة ثم يرثه.', ruling: 'إذا كانت بطاقة القضية الحالية تتضمن هذه الحالة، يُحرم هذا اللاعب من نصيبه في هذه القضية ويُعاد توزيع التركة وفق الورثة المستحقين. (تُستخدم فقط إذا نصت بطاقة القضية على وجود قاتل — بلا أثر رقمي تلقائي هنا.)', effects: [{ target: 'none', amount: 0 }] },
  { id: 35, category: 'aqilah', categoryIcon: '🛡️', title: 'عفو كامل', story: 'سامح أولياء الدم أهل الجاني، وتنازلوا عن الدية ابتغاء وجه الله.', benefit: 'العفو والإصلاح من أعظم أسباب الأجر، وقد مدح الله أهلهما.', ruling: 'لا يدفع أفراد العاقلة شيئًا في هذه الجولة.', effects: [{ target: 'none', amount: 0 }] },

  // 💰 التجارة والبركة وإدارة المال (36-45)
  { id: 36, category: 'trade', categoryIcon: '💰', title: 'بركة الصدقة', story: 'كنت تحرص على إخراج الصدقة كلما وسّع الله عليك في الرزق، ولم تبخل على الفقراء والمحتاجين.', benefit: 'قال ﷺ: "ما نقص مالٌ من صدقة."', ruling: 'خذ 10 أسهم من البنك.', effects: [{ target: 'self', amount: 10 }] },
  { id: 37, category: 'trade', categoryIcon: '💰', title: 'تجارة ناجحة', story: 'استثمرت جزءًا من المال الذي ورثته في تجارة مباحة، فبارك الله فيها حتى تضاعفت أرباحها.', benefit: 'المال إذا استُثمر بالحلال كان سببًا في زيادة الخير.', ruling: 'خذ 10 أسهم.', effects: [{ target: 'self', amount: 10 }] },
  { id: 38, category: 'trade', categoryIcon: '💰', title: 'خسارة تجارية', story: 'دخلت تجارة دون دراسة كافية، فتعرضت لخسارة جزء من رأس مالك.', benefit: 'حسن التخطيط والأخذ بالأسباب من أسباب النجاح.', ruling: 'ادفع 8 أسهم.', effects: [{ target: 'self', amount: -8 }] },
  { id: 39, category: 'trade', categoryIcon: '💰', title: 'ارتفاع قيمة الأرض', story: 'بعد سنوات، ارتفعت قيمة الأرض التي ورثتها، فأصبحت تساوي أضعاف ثمنها.', benefit: 'من نعم الله أن يبارك للإنسان في ماله.', ruling: 'خذ 13 سهمًا من البنك.', effects: [{ target: 'self', amount: 13 }] },
  { id: 40, category: 'trade', categoryIcon: '💰', title: 'شريك أمين', story: 'دخلت في شراكة مع تاجر عُرف بالأمانة والصدق، فكان ذلك سببًا في نجاح تجارتكما.', benefit: 'الأمانة والصدق من أسباب البركة في البيع والشراء.', ruling: 'اختر لاعبًا، يحصل كل منكما على 5 أسهم من البنك.', effects: [{ target: 'chosenPlayer', amount: 5, selfAmount: 5 }] },
  { id: 41, category: 'trade', categoryIcon: '💰', title: 'رد جميل', story: 'كنت قد ساعدت أحد أقاربك في بداية مشروعه، وبعد نجاحه أصر على رد الجميل لك.', benefit: '«هل جزاء الإحسان إلا الإحسان».', ruling: 'اختر لاعبًا، يدفع لك 5 أسهم.', effects: [{ target: 'chosenPlayer', amount: -5, selfAmount: 5 }] },
  { id: 42, category: 'trade', categoryIcon: '💰', title: 'ادخار حكيم', story: 'لم تنفق مالك كله، بل ادخرت جزءًا منه حتى احتجت إليه في وقت الشدة.', benefit: 'الاعتدال في الإنفاق من صفات المؤمن.', ruling: 'إذا كان رصيدك أقل من 20 سهمًا، خذ 8 أسهم من البنك. وإذا كان أكثر، خذ 3 أسهم فقط.', effects: [{ target: 'conditionalBalance', threshold: 20, belowAmount: 8, aboveOrEqualAmount: 3 }] },
  { id: 43, category: 'trade', categoryIcon: '💰', title: 'مشروع خيري', story: 'خصصت جزءًا من مالك لإنشاء مشروع يعود نفعه على الناس ويستمر أثره.', benefit: 'الصدقة الجارية من أفضل ما يتركه المسلم بعد وفاته.', ruling: 'ادفع 5 أسهم الآن، وفي أول دور لك بعد جولتين خذ 10 أسهم.', effects: [{ target: 'self', amount: -5, deferred: { amount: 10, afterRounds: 2 } }] },
  { id: 44, category: 'trade', categoryIcon: '💰', title: 'هدية ثمينة', story: 'أهداك أحد أقاربك قطعة أرض تقديرًا لمواقفك معه.', benefit: 'الهدية تزيد المحبة بين الناس.', ruling: 'خذ 8 أسهم من البنك.', effects: [{ target: 'self', amount: 8 }] },
  { id: 45, category: 'trade', categoryIcon: '💰', title: 'خسارة بسبب الإسراف', story: 'أنفقت أموالًا كثيرة في الكماليات حتى ضاعت عليك فرصة استثمار مربحة.', benefit: 'قال تعالى: ﴿ولا تُسرفوا إنه لا يحب المسرفين﴾', ruling: 'ادفع 8 أسهم.', effects: [{ target: 'self', amount: -8 }] },

  // 🤝 التكافل الأسري (46-50)
  { id: 46, category: 'takaful', categoryIcon: '🤝', title: 'مساعدة أخت مطلقة', story: 'تعرضت أختكم للطلاق، وكانت تمر بظروف مالية صعبة، فاتفق أفراد الأسرة على مساعدتها حتى تستقر حياتها.', benefit: 'التكافل بين أفراد الأسرة من أعظم أسباب قوة المجتمع.', ruling: 'كل اللاعبين ما عدا أنت يدفعون لك 3 أسهم.', effects: [{ target: 'allOthersPayToSelf', amount: -3 }] },
  { id: 47, category: 'takaful', categoryIcon: '🤝', title: 'علاج قريب', story: 'احتاج أحد أقاربكم إلى عملية جراحية عاجلة، فتعاونت الأسرة على تحمل تكاليف العلاج.', benefit: 'قال تعالى: ﴿وتعاونوا على البر والتقوى﴾', ruling: 'اختر لاعبين، يدفع كل واحد منهما 3 أسهم.', effects: [{ target: 'chosenPlayers2', amount: -3 }] },
  { id: 48, category: 'takaful', categoryIcon: '🤝', title: 'كفالة يتيم', story: 'قررت الأسرة كفالة طفل يتيم من أقاربها حتى يكبر ويعتمد على نفسه.', benefit: 'قال ﷺ: "أنا وكافل اليتيم في الجنة كهاتين."', ruling: 'كل لاعب يدفع سهمين.', effects: [{ target: 'allPlayers', amount: -2 }] },
  { id: 49, category: 'takaful', categoryIcon: '🤝', title: 'إعادة بناء منزل', story: 'احترق منزل أحد الأقارب، فاجتمع أفراد الأسرة لمساعدته حتى يعود إلى بيته.', benefit: 'تفريج كرب المسلمين من أفضل الأعمال.', ruling: 'صاحب أكبر رصيد يدفع 8 أسهم، وبقية اللاعبين يدفع كل منهم سهمين.', effects: [{ target: 'highestBalance', amount: -8 }, { target: 'allExceptHighestBalance', amount: -2 }] },
  { id: 50, category: 'takaful', categoryIcon: '🤝', title: 'صندوق الأسرة', story: 'اتفقت الأسرة على إنشاء صندوق مالي للطوارئ، يساهم فيه الجميع ليستفيد منه من يمر بضائقة.', benefit: 'التعاون والتكافل من أسباب استقرار الأسرة وقوتها.', ruling: 'يدفع كل لاعب 3 أسهم، ثم يحصل صاحب أقل رصيد على جميع الأسهم المجموعة.', effects: [{ target: 'allPlayers', amount: -3 }, { target: 'lowestBalancePool', amount: 3 }] }
];

// ---------- نصوص عامة ----------
const TEXTS = {
  gameTitle: 'لعبة التركة',
  tagline: 'تعلّم المواريث باللعب',
  difficultyNames: {
    easy: 'سهل',
    medium: 'متوسط',
    advanced: 'متقدم',
    expert: 'قريبًا'
  },
  passDeviceMessage: 'أعطِ الجهاز إلى اللاعب التالي',
  readyButton: 'أنا جاهز',
  needsReviewMessage: 'هذه الحالة تحتاج إلى مراجعة من دليل اللعبة.',
  unevenSplitMessage: 'هذه التركة لا تنقسم بالتساوي على هذه المسألة.',
  undistributedMessage: 'يوجد جزء من التركة لم يُوزَّع لعدم وجود قاعدة واضحة (بدون رد).',
  disclaimer: 'هذه اللعبة أداة تعليمية مبسطة لتقريب مبادئ توزيع المواريث، ولا تُعد مرجعًا شرعيًا نهائيًا. يُرجى مراجعة عالم شرعي أو مختص في الفرائض في أي حالة واقعية.',
  judgmentIntro: 'تُنفذ جميع الأحكام بعد توزيع الميراث. لا تؤثر البطاقات في صحة القسمة الشرعية، وإنما تُطبق على أرصدة اللاعبين. البطاقات التعليمية تشرح الحكم بإيجاز.',
  judgmentTurnLabel: 'دور كشف الحكم:',
  judgmentRevealButton: 'اكشف البطاقة',
  judgmentChoosePlayer: 'اختر لاعبًا',
  judgmentChooseTwoPlayers: 'اختر لاعبين',
  judgmentApplyButton: 'تطبيق الحكم',
  judgmentContinueButton: 'متابعة'
};
