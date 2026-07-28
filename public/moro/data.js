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
    id: 1, difficulty: 'easy', deceasedGender: 'male', estateValue: 36,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'sister', 'son', 'wife'],
    title: 'قضية رقم 1', note: 'توفي رجل وليس له ابن ولا أب ولا جد ولا أخ.',
    lesson: 'عم: الباقي تعصيبًا = 36 سهم'
  },
  {
    id: 2, difficulty: 'easy', deceasedGender: 'female', estateValue: 96,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'mother', 'sister', 'son', 'wife'],
    title: 'قضية رقم 2', note: 'توفيت امرأة وليس لها ولد ولا إخوة ولا أب ولا جد.',
    lesson: 'زوج: النصف (1/2) = 48 سهم، عم: النصف (1/2) = 48 سهم'
  },
  {
    id: 3, difficulty: 'easy', deceasedGender: 'male', estateValue: 72,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'son', 'wife'],
    title: 'قضية رقم 3', note: 'توفي رجل وليس له ولد ولا إخوة ولا أب ولا جد.',
    lesson: 'أم: الثلث (1/3) = 24 سهم، عم: الثلثان (2/3) = 48 سهم'
  },
  {
    id: 4, difficulty: 'easy', deceasedGender: 'male', estateValue: 12,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'son', 'wife'],
    title: 'قضية رقم 4', note: 'توفي رجل وليس له ولد ولا أب ولا جد.',
    lesson: 'أخت شقيقة: النصف (1/2) = 6 سهم، عم: النصف (1/2) = 6 سهم'
  },
  {
    id: 5, difficulty: 'easy', deceasedGender: 'female', estateValue: 24,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'son', 'wife'],
    title: 'قضية رقم 5', note: 'توفيت امرأة وليس لها ولد ولا أب ولا جد.',
    lesson: 'أخت شقيقة (×2): الثلثان (2/3) = 16 سهم، عم: الثلث (1/3) = 8 سهم'
  },
  {
    id: 6, difficulty: 'easy', deceasedGender: 'male', estateValue: 36,
    disallowed: ['daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'son', 'uncle', 'wife'],
    title: 'قضية رقم 6', note: 'توفي رجل وليس له ولد ولا أب ولا جد ولا عم.',
    lesson: 'أخ شقيق: الثلثان (2/3) = 24 سهم، أخت شقيقة: الثلث (1/3) = 12 سهم'
  },
  {
    id: 7, difficulty: 'easy', deceasedGender: 'male', estateValue: 72,
    disallowed: ['brother', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'son', 'uncle', 'wife'],
    title: 'قضية رقم 7', note: 'توفي رجل وليس له أخ ولا عم.',
    lesson: 'بنت: النصف (1/2) = 36 سهم، أخت شقيقة: النصف (1/2) = 36 سهم'
  },
  {
    id: 8, difficulty: 'medium', deceasedGender: 'male', estateValue: 48,
    disallowed: ['brother', 'daughter', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'son', 'uncle'],
    title: 'قضية رقم 8', note: 'توفي رجل وليس له أولاد.',
    lesson: 'أب: النصف (1/2) = 24 سهم، أم: الربع (1/4) = 12 سهم، زوجة: الربع (1/4) = 12 سهم'
  },
  {
    id: 9, difficulty: 'medium', deceasedGender: 'female', estateValue: 24,
    disallowed: ['brother', 'daughter', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'sister', 'son', 'uncle', 'wife'],
    title: 'قضية رقم 9', note: 'توفيت امرأة وليس لها أولاد.',
    lesson: 'أب: الثلث (1/3) = 8 سهم، أم: السدس (1/6) = 4 سهم، زوج: النصف (1/2) = 12 سهم'
  },
  {
    id: 10, difficulty: 'medium', deceasedGender: 'male', estateValue: 36,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 10', note: 'توفي رجل وليس له زوجة.',
    lesson: 'ابن: الباقي تعصيبًا = 16 سهم، بنت: الباقي تعصيبًا = 8 سهم، أب: السدس (1/6) = 6 سهم، أم: السدس (1/6) = 6 سهم'
  },
  {
    id: 11, difficulty: 'medium', deceasedGender: 'female', estateValue: 36,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 11', note: 'توفيت امرأة وليس لها زوج.',
    lesson: 'ابن: الباقي تعصيبًا = 16 سهم، بنت: الباقي تعصيبًا = 8 سهم، أب: السدس (1/6) = 6 سهم، أم: السدس (1/6) = 6 سهم'
  },
  {
    id: 12, difficulty: 'medium', deceasedGender: 'male', estateValue: 144,
    disallowed: ['daughter', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'son', 'uncle'],
    title: 'قضية رقم 12', note: 'توفي رجل وليس له ولد ولا أب ولا جد.',
    lesson: 'أم: السدس (1/6) = 24 سهم، زوجة: الربع (1/4) = 36 سهم، أخ شقيق: الباقي تعصيبًا = 56 سهم، أخت شقيقة: الباقي تعصيبًا = 28 سهم'
  },
  {
    id: 13, difficulty: 'medium', deceasedGender: 'male', estateValue: 96,
    disallowed: ['brother', 'father', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'mother', 'sister', 'uncle'],
    title: 'قضية رقم 13', note: 'توفي رجل وليس له أب ولا جد ولا إخوة ولا عم.',
    lesson: 'ابن (×2): الباقي تعصيبًا = 56 سهم، بنت (×2): الباقي تعصيبًا = 28 سهم، زوجة: الثمن (1/8) = 12 سهم'
  },
  {
    id: 14, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'father', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle'],
    title: 'قضية رقم 14', note: 'توفي رجل وليس له أب.',
    lesson: 'ابن: الباقي تعصيبًا = 104 سهم، بنت: الباقي تعصيبًا = 52 سهم، أم: السدس (1/6) = 48 سهم، جد: السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم'
  },
  {
    id: 15, difficulty: 'advanced', deceasedGender: 'female', estateValue: 72,
    disallowed: ['brother', 'father', 'grandmother', 'half-brother', 'half-sister', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 15', note: 'توفيت امرأة وليس لها أب.',
    lesson: 'ابن: الباقي تعصيبًا = 20 سهم، بنت: الباقي تعصيبًا = 10 سهم، أم: السدس (1/6) = 12 سهم، جد: السدس (1/6) = 12 سهم، زوج: الربع (1/4) = 18 سهم'
  },
  {
    id: 16, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'grandfather', 'half-brother', 'half-sister', 'husband', 'mother', 'sister', 'uncle'],
    title: 'قضية رقم 16', note: 'توفي رجل وليس له أم.',
    lesson: 'ابن: الباقي تعصيبًا = 104 سهم، بنت: الباقي تعصيبًا = 52 سهم، أب: السدس (1/6) = 48 سهم، جدة (لأم): السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم'
  },
  {
    id: 17, difficulty: 'advanced', deceasedGender: 'female', estateValue: 72,
    disallowed: ['brother', 'grandfather', 'half-brother', 'half-sister', 'mother', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 17', note: 'توفيت امرأة وليس لها أم.',
    lesson: 'ابن: الباقي تعصيبًا = 20 سهم، بنت: الباقي تعصيبًا = 10 سهم، أب: السدس (1/6) = 12 سهم، جدة (لأم): السدس (1/6) = 12 سهم، زوج: الربع (1/4) = 18 سهم'
  },
  {
    id: 18, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle'],
    title: 'قضية رقم 18', note: 'توفي رجل وليس له إخوة.',
    lesson: 'ابن: الباقي تعصيبًا = 104 سهم، بنت: الباقي تعصيبًا = 52 سهم، أب: السدس (1/6) = 48 سهم، أم: السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم'
  },
  {
    id: 19, difficulty: 'advanced', deceasedGender: 'female', estateValue: 72,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 19', note: 'توفيت امرأة وليس لها إخوة.',
    lesson: 'ابن: الباقي تعصيبًا = 20 سهم، بنت: الباقي تعصيبًا = 10 سهم، أب: السدس (1/6) = 12 سهم، أم: السدس (1/6) = 12 سهم، زوج: الربع (1/4) = 18 سهم'
  },
  {
    id: 20, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle'],
    title: 'قضية رقم 20', note: 'توفي رجل وليس له جد.',
    lesson: 'ابن: الباقي تعصيبًا = 104 سهم، بنت: الباقي تعصيبًا = 52 سهم، أب: السدس (1/6) = 48 سهم، أم: السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم'
  },
  {
    id: 21, difficulty: 'advanced', deceasedGender: 'female', estateValue: 72,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 21', note: 'توفيت امرأة وليس لها جد.',
    lesson: 'ابن: الباقي تعصيبًا = 20 سهم، بنت: الباقي تعصيبًا = 10 سهم، أب: السدس (1/6) = 12 سهم، أم: السدس (1/6) = 12 سهم، زوج: الربع (1/4) = 18 سهم'
  },
  {
    id: 22, difficulty: 'advanced', deceasedGender: 'male', estateValue: 288,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'husband', 'sister', 'uncle'],
    title: 'قضية رقم 22', note: 'توفي رجل وليس له جدة.',
    lesson: 'ابن: الباقي تعصيبًا = 104 سهم، بنت: الباقي تعصيبًا = 52 سهم، أب: السدس (1/6) = 48 سهم، أم: السدس (1/6) = 48 سهم، زوجة: الثمن (1/8) = 36 سهم'
  },
  {
    id: 23, difficulty: 'advanced', deceasedGender: 'female', estateValue: 36,
    disallowed: ['brother', 'grandfather', 'grandmother', 'half-brother', 'half-sister', 'sister', 'uncle', 'wife'],
    title: 'قضية رقم 23', note: 'توفيت امرأة وليس لها جدة.',
    lesson: 'ابن: الباقي تعصيبًا = 10 سهم، بنت: الباقي تعصيبًا = 5 سهم، أب: السدس (1/6) = 6 سهم، أم: السدس (1/6) = 6 سهم، زوج: الربع (1/4) = 9 سهم'
  },
  {
    id: 24, difficulty: 'advanced', deceasedGender: 'male', estateValue: 72,
    disallowed: ['brother', 'daughter', 'father', 'grandfather', 'grandmother', 'husband', 'mother', 'sister', 'son', 'uncle'],
    title: 'قضية رقم 24', note: 'توفي رجل وليس له ولد ولا إخوة أشقاء ولا أب ولا جد ولا عم.',
    lesson: 'زوجة: الربع (1/4) = 18 سهم، أخ لأم: السدس (1/6) أصلًا + رد = 27 سهم، أخت لأم: السدس (1/6) أصلًا + رد = 27 سهم'
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

  // ⚖️ حقوق التركة
  { id: 1, category: 'rights', categoryIcon: '⚖️', title: 'دين على المتوفى', story: 'بعد انتهاء الورثة من تقسيم التركة، حضر أحد جيران المتوفى ومعه ورقة قديمة تثبت أن المتوفى اقترض منه مالًا ولم يتمكن من سداده قبل وفاته.', benefit: 'الدَّين من أعظم الحقوق، ولذلك يجب سداده قبل توزيع الميراث. قال تعالى: ﴿مِن بَعْدِ وَصِيَّةٍ يُوصِي بِهَا أَوْ دَيْنٍ﴾', ruling: 'يدفع اللاعب الحالي 10 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -10 }] },
  { id: 2, category: 'rights', categoryIcon: '⚖️', title: 'زكاة المال', story: 'وجد الورثة في أوراق المتوفى حسابًا يبين أن زكاة ماله لم تُخرج في العام الماضي.', benefit: 'حقوق الله المتعلقة بالمال، ومنها الزكاة، تُؤدى قبل تقسيم التركة.', ruling: 'يدفع اللاعب الحالي 6 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -6 }] },
  { id: 3, category: 'rights', categoryIcon: '⚖️', title: 'أمانة', story: 'عثر الورثة داخل خزانة المتوفى على مبلغ من المال مكتوب عليه اسم أحد أصدقائه، فعرفوا أنه أمانة عنده.', benefit: 'الأمانة ليست من التركة، بل يجب ردها إلى صاحبها. قال تعالى: ﴿إِنَّ اللَّهَ يَأْمُرُكُمْ أَنْ تُؤَدُّوا الْأَمَانَاتِ إِلَى أَهْلِهَا﴾', ruling: 'يدفع اللاعب الحالي 6 أسهم ويردها لصاحب الأمانة نيابة عن التركة.', effects: [{ target: 'self', amount: -6 }] },
  { id: 4, category: 'rights', categoryIcon: '⚖️', title: 'وصية صحيحة', story: 'بعد القسمة، وجد الورثة وصية صحيحة أوصى فيها المتوفى بجزء من ماله لأحد أعمال الخير.', benefit: 'الوصية المشروعة تُنفذ قبل توزيع الميراث.', ruling: 'يدفع اللاعب الحالي 6 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -6 }] },
  { id: 5, category: 'rights', categoryIcon: '⚖️', title: 'أجرة عامل', story: 'كان المتوفى قد استأجر عاملًا لإصلاح منزله، لكنه توفي قبل أن يدفع له أجره.', benefit: 'أجرة العامل حق واجب. قال ﷺ: "أعطوا الأجير أجره قبل أن يجف عرقه."', ruling: 'يدفع اللاعب الحالي 5 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -5 }] },
  { id: 6, category: 'rights', categoryIcon: '⚖️', title: 'رد المظالم', story: 'اعترف أحد الورثة أن جزءًا من المال الموروث كان قد أخذه المتوفى بغير حق، ويجب رده إلى صاحبه.', benefit: 'لا يحل مال امرئ مسلم إلا بطيب نفس منه.', ruling: 'يدفع اللاعب الحالي 8 أسهم مباشرة لصاحب الحق (يُختار لاعب يمثله، أو تُرد للبنك إن لم يوجد).', effects: [{ target: 'self', amount: -8 }] },
  { id: 7, category: 'rights', categoryIcon: '⚖️', title: 'مال شريك', story: 'بعد مراجعة الأوراق، تبين أن جزءًا من العقار الموروث كان مملوكًا لشريك آخر، وليس للمتوفى وحده.', benefit: 'لا يجوز أن يرث الإنسان ما ليس مملوكًا للمورث.', ruling: 'يدفع اللاعب الحالي 8 أسهم لصاحب الحصة نيابة عن التركة.', effects: [{ target: 'self', amount: -8 }] },
  { id: 8, category: 'rights', categoryIcon: '⚖️', title: 'سداد قرض حسن', story: 'كان أحد أقارب المتوفى قد أقرضه مالًا دون فوائد، ولم يتمكن من استرداده قبل وفاته.', benefit: 'رد القرض من أداء الأمانة، وهو من أولى الحقوق.', ruling: 'يدفع اللاعب الحالي 8 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -8 }] },

  // 👨‍👩‍👧 مسؤوليات مالية بعد الميراث
  { id: 9, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'إتلاف مزرعة الجيران', story: 'كان ابنك يلعب بالألعاب النارية، فتطاير شررها إلى مزرعة الجيران وأتلف جزءًا من المحصول.', benefit: 'يحرم الاعتداء على أموال الناس، ومن تسبب في إتلاف مال غيره فعليه ضمانه.', ruling: 'ادفع 20 سهمًا إلى البنك.', effects: [{ target: 'self', amount: -20 }] },
  { id: 10, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'زكاة مالك', story: 'مر عام كامل على مالك، وبلغ النصاب، فأصبحت الزكاة واجبة عليك.', benefit: 'الزكاة ركن من أركان الإسلام، وهي حق للفقراء في مال الأغنياء.', ruling: 'ادفع 5 أسهم إلى البنك.', effects: [{ target: 'self', amount: -5 }] },
  { id: 11, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'نفقة الأسرة', story: 'بدأ العام الدراسي، واحتاج أبناؤك إلى الكتب والملابس والمستلزمات الدراسية.', benefit: 'النفقة على الزوجة والأولاد من مسؤوليات رب الأسرة.', ruling: 'ادفع 10 أسهم إلى البنك.', effects: [{ target: 'self', amount: -10 }] },
  { id: 12, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'استصلاح أرض موروثة', story: 'ورثت أرضًا مهملة، فأنفقت عليها حتى أصبحت صالحة للزراعة والإنتاج.', benefit: 'إحياء الأرض واستثمارها من الأعمال النافعة التي تعود بالنفع على صاحبها والمجتمع.', ruling: 'ادفع 10 أسهم، ثم خذ 20 سهمًا من البنك.', effects: [{ target: 'self', amount: -10 }, { target: 'self', amount: 20 }] },
  { id: 13, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'توسعة التجارة', story: 'استثمرت جزءًا من المال الذي ورثته في توسيع تجارتك، واشتركت مع تاجر أمين حتى ازداد نشاطك التجاري.', benefit: 'المال نعمة، وأفضل استثماره فيما ينفع صاحبه والناس.', ruling: 'ادفع 10 أسهم الآن، ثم خذ 20 سهمًا من البنك.', effects: [{ target: 'self', amount: -10 }, { target: 'self', amount: 20 }] },

  // 🛡️ العاقلة، القتل الخطأ، الصلح، العفو
  { id: 14, category: 'aqilah', categoryIcon: '🛡️', title: 'دية القتل الخطأ', story: 'وقع حادث سير غير مقصود تسبب في وفاة أحد الناس. وبعد نظر القضية، حكم القاضي بوجوب الدية على الجاني.', benefit: 'في القتل الخطأ، تتحمل العاقلة (العصبة من الذكور) المساهمة في دفع الدية، تخفيفًا عن الجاني وتحقيقًا للتكافل.', ruling: 'كل لاعب من العاقلة يدفع 15 سهمًا.', effects: [{ target: 'aqilah', amount: -15 }] },
  { id: 15, category: 'aqilah', categoryIcon: '🛡️', title: 'العفو عن جزء من الدية', story: 'قرر أولياء الدم العفو عن جزء من الدية، رغبةً في الأجر والإصلاح.', benefit: 'العفو من أفضل الأخلاق، وقد رغب الإسلام في الصلح والإحسان.', ruling: 'كل لاعب من العاقلة يسترد 5 اسهم.', effects: [{ target: 'aqilah', amount: 5 }] },

  // 💰 التجارة والبركة وإدارة المال
  { id: 16, category: 'trade', categoryIcon: '💰', title: 'بركة الصدقة', story: 'كنت تحرص على إخراج الصدقة كلما وسّع الله عليك في الرزق، ولم تبخل على الفقراء والمحتاجين.', benefit: 'قال ﷺ: "ما نقص مالٌ من صدقة."', ruling: 'خذ 20 سهمًا من البنك.', effects: [{ target: 'self', amount: 20 }] },
  { id: 17, category: 'trade', categoryIcon: '💰', title: 'خسارة تجارية', story: 'دخلت تجارة دون دراسة كافية، فتعرضت لخسارة جزء من رأس مالك.', benefit: 'حسن التخطيط والأخذ بالأسباب من أسباب النجاح.', ruling: 'ادفع 15 سهمًا.', effects: [{ target: 'self', amount: -15 }] },
  { id: 18, category: 'trade', categoryIcon: '💰', title: 'ارتفاع قيمة الأرض', story: 'بعد سنوات، ارتفعت قيمة الأرض التي ورثتها، فأصبحت تساوي أضعاف ثمنها.', benefit: 'من نعم الله أن يبارك للإنسان في ماله.', ruling: 'خذ 25 سهمًا من البنك.', effects: [{ target: 'self', amount: 25 }] },
  { id: 19, category: 'trade', categoryIcon: '💰', title: 'شريك أمين', story: 'دخلت في شراكة مع تاجر عُرف بالأمانة والصدق، فكان ذلك سببًا في نجاح تجارتكما.', benefit: 'الأمانة والصدق من أسباب البركة في البيع والشراء.', ruling: 'اختر لاعبًا، يحصل كل منكما على 10 أسهم من البنك.', effects: [{ target: 'chosenPlayer', amount: 10, selfAmount: 10 }] },
  { id: 20, category: 'trade', categoryIcon: '💰', title: 'ادخار حكيم', story: 'لم تنفق مالك كله، بل ادخرت جزءًا منه حتى احتجت إليه في وقت الشدة.', benefit: 'الاعتدال في الإنفاق من صفات المؤمن.', ruling: 'إذا كان رصيدك أقل من 30 سهمًا، خذ 15 سهمًا من البنك. وإذا كان أكثر، خذ 5 أسهم فقط.', effects: [{ target: 'conditionalBalance', threshold: 30, belowAmount: 15, aboveOrEqualAmount: 5 }] },
  { id: 21, category: 'trade', categoryIcon: '💰', title: 'مشروع خيري', story: 'خصصت جزءًا من مالك لإنشاء مشروع يعود نفعه على الناس ويستمر أثره.', benefit: 'الصدقة الجارية من أفضل ما يتركه المسلم بعد وفاته.', ruling: 'ادفع 10 أسهم الآن، وفي أول دور لك بعد جولتين خذ 20 سهمًا.', effects: [{ target: 'self', amount: -10, deferred: { amount: 20, afterRounds: 2 } }] },
  { id: 22, category: 'trade', categoryIcon: '💰', title: 'خسارة بسبب الإسراف', story: 'أنفقت أموالًا كثيرة في الكماليات حتى ضاعت عليك فرصة استثمار مربحة.', benefit: 'قال تعالى: ﴿ولا تُسرفوا إنه لا يحب المسرفين﴾', ruling: 'ادفع 15 سهمًا.', effects: [{ target: 'self', amount: -15 }] },

  // 🤝 التكافل الأسري
  { id: 23, category: 'takaful', categoryIcon: '🤝', title: 'علاج قريب', story: 'احتاج أحد أقاربكم إلى عملية جراحية عاجلة، فتعاونت الأسرة على تحمل تكاليف العلاج.', benefit: 'قال تعالى: ﴿وتعاونوا على البر والتقوى﴾', ruling: 'اختر لاعبين، يدفع كل واحد منهما 5 أسهم.', effects: [{ target: 'chosenPlayers2', amount: -5 }] },
  { id: 24, category: 'takaful', categoryIcon: '🤝', title: 'كفالة يتيم', story: 'قررت الأسرة كفالة طفل يتيم من أقاربها حتى يكبر ويعتمد على نفسه.', benefit: 'قال ﷺ: "أنا وكافل اليتيم في الجنة كهاتين."', ruling: 'كل لاعب يدفع 3 أسهم.', effects: [{ target: 'allPlayers', amount: -3 }] },
  { id: 25, category: 'takaful', categoryIcon: '🤝', title: 'صندوق الأسرة', story: 'اتفقت الأسرة على إنشاء صندوق مالي للطوارئ، يساهم فيه الجميع ليستفيد منه من يمر بضائقة.', benefit: 'التعاون والتكافل من أسباب استقرار الأسرة وقوتها.', ruling: 'يدفع كل لاعب 5 أسهم، ثم يحصل صاحب أقل رصيد على جميع الأسهم المجموعة.', effects: [{ target: 'allPlayers', amount: -5 }, { target: 'lowestBalancePool', amount: 5 }] }
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
