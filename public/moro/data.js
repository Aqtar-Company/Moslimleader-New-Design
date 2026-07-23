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
    count: 10
  },
  {
    id: 'daughter',
    name: 'بنت',
    icon: '👧',
    image: '/moro/cards/daughter.png',
    color: '#B15C9E',
    description: 'البنت الواحدة تأخذ النصف، والبنتان فأكثر يأخذن الثلثين، وإن وُجد ابن أخذت مع إخوتها الباقي تعصيبًا.',
    count: 10
  },
  {
    id: 'father',
    name: 'أب',
    icon: '👴',
    image: '/moro/cards/father.png',
    color: '#4C9A6A',
    description: 'الأب يأخذ السدس مع وجود الابن، ويجمع بين السدس والباقي مع وجود البنت فقط، ويأخذ الباقي كله عند عدم وجود فرع وارث.',
    count: 1 // وارث فردي — لا يمكن أن يوجد للمتوفى أكثر من أب واحد، فنسخة واحدة فقط في الرزمة تمنع تصادم لاعبين على نفس الدور
  },
  {
    id: 'mother',
    name: 'أم',
    icon: '👵',
    image: '/moro/cards/mother.png',
    color: '#D98A3D',
    description: 'الأم تأخذ السدس مع وجود فرع وارث أو عدد من الإخوة، وتأخذ الثلث في غير ذلك.',
    count: 1 // وارث فردي — نفس المنطق
  },
  {
    id: 'grandfather',
    name: 'جد',
    icon: '👴🏽',
    image: '/moro/cards/grandfather.png',
    color: '#1F6B4A',
    description: 'الجد (أب الأب) يُحجب كليًا بوجود الأب، ويقوم مقامه تمامًا فرضًا وتعصيبًا عند غيابه. عند اجتماعه مع الإخوة الأشقاء بلا أب ولا ابن: مسألة خلافية بين الصحابة — تُعرض كحالة تحتاج مراجعة.',
    count: 1 // وارث فردي — نفس المنطق
  },
  {
    id: 'grandmother',
    name: 'جدة (لأم)',
    icon: '👵🏽',
    image: '/moro/cards/grandmother.png',
    color: '#B8722E',
    description: 'الجدة لأم (أم الأم) تُحجب كليًا بوجود الأم، وتأخذ السدس عند غيابها. ملاحظة: هذه البطاقة تمثّل الجدة لأم تحديدًا؛ الجدة لأب لها حكم حجب مختلف (تُحجب بالأب أيضًا لا بالأم فقط) وغير ممثَّلة في هذه النسخة المبسّطة.',
    count: 1 // وارث فردي — نفس المنطق
  },
  {
    id: 'husband',
    name: 'زوج',
    icon: '🤵',
    image: '/moro/cards/husband.png',
    color: '#7A6FB0',
    description: 'الزوج يأخذ النصف إن لم يوجد فرع وارث للزوجة المتوفاة، والربع إن وُجد.',
    count: 1 // وارث فردي — المرأة لها زوج واحد فقط وقت وفاتها، بخلاف الزوجة (يصح تعددها حتى 4)
  },
  {
    id: 'wife',
    name: 'زوجة',
    icon: '👰',
    image: '/moro/cards/wife.png',
    color: '#C9598A',
    description: 'الزوجة تأخذ الربع إن لم يوجد فرع وارث للزوج المتوفى، والثمن إن وُجد، وتشترك الزوجات في النصيب.',
    count: 5
  },
  {
    id: 'brother',
    name: 'أخ شقيق',
    icon: '🧔',
    image: '/moro/cards/brother.png',
    color: '#3D8F8A',
    description: 'الأخ الشقيق وارث بالتعصيب، يُحجب بالأب أو الابن، وإن وُجدت أخت شقيقة معه اقتسما الباقي للذكر مثل حظ الأنثيين.',
    count: 8
  },
  {
    id: 'sister',
    name: 'أخت شقيقة',
    icon: '👩',
    image: '/moro/cards/sister.png',
    color: '#A9762E',
    description: 'الأخت الشقيقة تأخذ النصف منفردة أو الثلثين مع أخواتها، وتُحجب بالأب أو الابن.',
    count: 8
  },
  {
    id: 'joker',
    name: 'جوكر',
    icon: '🃏',
    color: '#6B4F8A',
    description: 'بطاقة جوكر: عند لعبها تختار أي وارث مسموح به في حالة المتوفى الحالية لتمثله — تصلح مع أي حالة، ولا تُحجب أبدًا بنفسها.',
    count: 4
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
  return `<div class="card-icon-badge"><span class="card-icon">${heir.icon}</span></div><div class="card-name">${heir.name}</div>`;
}

// كلاس إضافي على عنصر .card نفسه لو الوارث عنده صورة حقيقية (يُلغي padding الكارت
// الافتراضي عشان الصورة تملأ الكارت بالكامل بلا حواف بيضاء حوالين حدودها المطبوعة).
function heirCardClass(heir) {
  return heir.image ? ' has-photo' : '';
}

// ---------- بطاقات حالة المتوفى ----------
// difficulty: easy | medium | advanced | expert(قريبًا - غير مفعّلة)
// disallowed: قائمة معرفات الورثة الممنوع لعبها في هذه الحالة
//
// ملاحظة تصميمية بخصوص الجد/الجدة (بعد إضافتهما لاحقًا): أُضيفا لقائمة disallowed في الحالتين
// 1/2 (الأبسط، وقصتهما ضيقة عمدًا: زوج/ة + ابن + بنت فقط) والحالتين 3/4 (المسألتان العُمَريتان،
// حيث وجود جد بديل عن الأب كان سيُفسد الدرس المحدد لأن قاعدة المسألة العُمَرية خاصة بالأب حصرًا).
// أما بقية الحالات (5 إلى 12) فتُبقيهما متاحين عمدًا: قصصها تصف غياب الأب و/أو الأم فقط دون نفي
// وجود جد/جدة بديل، وإتاحتهما تضيف أبعادًا تعليمية صحيحة (حجب، أو مسألة الجد والإخوة الخلافية)
// لا تتعارض مع الدرس العام لكل حالة — هذا قرار تصميمي واعٍ، وليس سهوًا.
const DECEASED_CASES = [
  // ----- سهل (أخضر) -----
  {
    id: 1, difficulty: 'easy', deceasedGender: 'male',
    disallowed: ['father', 'mother', 'brother', 'sister', 'husband', 'grandfather', 'grandmother'],
    title: 'الحالة 1', note: 'متوفى بلا أب ولا أم ولا إخوة.',
    lesson: 'هذه من أبسط المسائل: الزوجة صاحبة فرض، والابن والبنت يقتسمان الباقي تعصيبًا.'
  },
  {
    id: 2, difficulty: 'easy', deceasedGender: 'female',
    disallowed: ['father', 'mother', 'brother', 'sister', 'wife', 'grandfather', 'grandmother'],
    title: 'الحالة 2', note: 'متوفاة بلا أب ولا أم ولا إخوة.',
    lesson: 'الزوج صاحب فرض، والابن والبنت يقتسمان الباقي تعصيبًا.'
  },
  {
    id: 3, difficulty: 'easy', deceasedGender: 'male',
    disallowed: ['son', 'daughter', 'brother', 'sister', 'husband', 'grandfather', 'grandmother'],
    title: 'الحالة 3', note: 'متوفى بلا أبناء ولا إخوة.',
    lesson: 'هذه إحدى "المسألتين العُمَريتين": الأم هنا لا تأخذ ثلث التركة كاملة، بل ثلث ما تبقّى بعد فرض الزوجة، والأب يأخذ الباقي كله.'
  },
  {
    id: 4, difficulty: 'easy', deceasedGender: 'female',
    disallowed: ['son', 'daughter', 'brother', 'sister', 'wife', 'grandfather', 'grandmother'],
    title: 'الحالة 4', note: 'متوفاة بلا أبناء ولا إخوة.',
    lesson: 'هذه إحدى "المسألتين العُمَريتين": الأم هنا لا تأخذ ثلث التركة كاملة، بل ثلث ما تبقّى بعد فرض الزوج، والأب يأخذ الباقي كله.'
  },
  // ----- متوسط (أزرق) -----
  {
    id: 5, difficulty: 'medium', deceasedGender: 'male',
    disallowed: ['father', 'mother', 'husband'],
    title: 'الحالة 5', note: 'متوفى بلا أب ولا أم.',
    lesson: 'مع غياب الأب، قد يرث الإخوة الأشقاء إن لم يوجد ابن يحجبهم.'
  },
  {
    id: 6, difficulty: 'medium', deceasedGender: 'female',
    disallowed: ['father', 'wife'],
    title: 'الحالة 6', note: 'متوفاة بلا أب.',
    lesson: 'الأم قد يتغيّر فرضها بحسب وجود فرع وارث أو عدد الإخوة.'
  },
  {
    id: 7, difficulty: 'medium', deceasedGender: 'male',
    disallowed: ['son', 'daughter', 'father', 'husband'],
    title: 'الحالة 7', note: 'متوفى بلا أبناء ولا أب.',
    lesson: 'بغياب الأب والفرع الوارث، الإخوة الأشقاء يصبحون عصبة يرثون الباقي.'
  },
  {
    id: 8, difficulty: 'medium', deceasedGender: 'female',
    disallowed: ['son', 'daughter', 'father', 'wife'],
    title: 'الحالة 8', note: 'متوفاة بلا أبناء ولا أب.',
    lesson: 'نفس فكرة الحالة السابقة، مع كون المتوفاة امرأة وصاحب الفرض هو الزوج.'
  },
  // ----- متقدم (برتقالي) -----
  {
    id: 9, difficulty: 'advanced', deceasedGender: 'male',
    disallowed: ['husband'],
    title: 'الحالة 9', note: 'جميع الورثة المناسبين للرجل يمكن حضورهم.',
    lesson: 'حالة شاملة تجمع أكثر من نوع وارث، وتحتاج تتبع الحجب بدقة.'
  },
  {
    id: 10, difficulty: 'advanced', deceasedGender: 'female',
    disallowed: ['wife'],
    title: 'الحالة 10', note: 'جميع الورثة المناسبين للمرأة يمكن حضورهم.',
    lesson: 'حالة شاملة، انتبه لفرض الزوج وتغيّر فرض الأم.'
  },
  {
    id: 11, difficulty: 'advanced', deceasedGender: 'male',
    disallowed: ['father', 'husband'],
    title: 'الحالة 11', note: 'متوفى بلا أب.',
    lesson: 'يمكن أن تجتمع الأم والزوجة والأبناء والإخوة معًا؛ راقب الحجب بعناية.'
  },
  {
    id: 12, difficulty: 'advanced', deceasedGender: 'female',
    disallowed: ['mother', 'wife'],
    title: 'الحالة 12', note: 'متوفاة بلا أم.',
    lesson: 'يمكن أن يجتمع الأب والزوج والأبناء والإخوة معًا؛ راقب الحجب بعناية.'
  }
];

// ---------- بروفة: كروت القضايا الخمسون (للمراجعة البصرية في المعرض فقط) ----------
// كل بطاقة تمثّل الوجه المقترح لكارت "قضية" في التصميم المطبوع: حالة المتوفى + قيمة تركة
// مُختارة عمدًا (لا عشوائية) من نفس عائلة القيم الصديقة للكسور الفقهية (12/24/36/48/96)،
// تم التحقق برمجيًا عبر computeInheritance() أن كل قيمة تنقسم بلا كسور على الورثة
// المذكورين في note/lesson (أو أنها حالة خلافية "تحتاج مراجعة" بالتصميم، مثل بقية اللعبة).
// ملاحظة مهمة: هذه المصفوفة للعرض فقط في شاشة المعرض — لا تُستخدم في سحب القضية/التركة
// الفعلي أثناء اللعب (ذلك يبقى عشوائيًا عبر DECEASED_CASES/ESTATE_VALUES كما هو تمامًا)،
// ولا ترتبط بأي شكل ببطاقات الأحكام (JUDGMENT_CARDS) — الازدواج بينهما طباعي بحت لا منطقي.
const CASE_CARDS_PREVIEW = [
  // ----- سهل -----
  { id: 1, difficulty: 'easy', deceasedGender: 'male', estateValue: 24,
    disallowed: ['father','mother','husband','brother','sister','grandfather','grandmother'],
    title: 'قضية 1', note: 'متوفى، وورثته: زوجة وابن وبنت.', lesson: 'الزوجة صاحبة فرض (الثمن مع وجود الفرع الوارث)، والابن والبنت يقتسمان الباقي تعصيبًا للذكر مثل حظ الأنثيين.' },
  { id: 2, difficulty: 'easy', deceasedGender: 'female', estateValue: 24,
    disallowed: ['father','mother','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 2', note: 'متوفاة، وورثتها: زوج وابن وبنت.', lesson: 'الزوج صاحب فرض (الربع مع وجود الفرع الوارث)، والابن والبنت يقتسمان الباقي تعصيبًا.' },
  { id: 3, difficulty: 'easy', deceasedGender: 'male', estateValue: 48,
    disallowed: ['daughter','father','mother','husband','brother','sister','grandfather','grandmother'],
    title: 'قضية 3', note: 'متوفى، وورثته: زوجة وابنان اثنان (بلا بنات).', lesson: 'الزوجة تأخذ الثمن، والابنان يقتسمان كل الباقي بينهما بالتساوي (تعصيب بلا بنات ينافسانهما).' },
  { id: 4, difficulty: 'easy', deceasedGender: 'female', estateValue: 36,
    disallowed: ['son','father','mother','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 4', note: 'متوفاة، وورثتها: زوج وثلاث بنات (بلا ابن).', lesson: 'الزوج يأخذ الربع، والبنات الثلاث فأكثر يقتسمن الثلثين بالتساوي بينهن، والباقي بلا عصبة معروفة.' },
  { id: 5, difficulty: 'easy', deceasedGender: 'male', estateValue: 24,
    disallowed: ['daughter','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 5', note: 'متوفى، وورثته: أم وأب وابن.', lesson: 'الأم والأب يأخذان السدس لكل منهما مع وجود الابن، والابن يأخذ الباقي تعصيبًا.' },
  { id: 6, difficulty: 'easy', deceasedGender: 'female', estateValue: 24,
    disallowed: ['son','father','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 6', note: 'متوفاة، وورثتها: أم وبنتان (بلا أب ولا ابن).', lesson: 'الأم تأخذ السدس لوجود الفرع الوارث، والبنتان تقتسمان الثلثين، والباقي بلا عصبة معروفة في هذه النسخة.' },
  { id: 7, difficulty: 'easy', deceasedGender: 'male', estateValue: 36,
    disallowed: ['daughter','father','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 7', note: 'متوفى، وورثته: أم وثلاثة أبناء (بلا بنات).', lesson: 'الأم تأخذ السدس، والأبناء الثلاثة يقتسمون كل الباقي بينهم بالتساوي.' },
  { id: 8, difficulty: 'easy', deceasedGender: 'female', estateValue: 12,
    disallowed: ['son','daughter','mother','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 8', note: 'متوفاة، ووارثها الوحيد: الأب.', lesson: 'عند عدم وجود فرع وارث ولا زوج، يأخذ الأب التركة كاملة تعصيبًا.' },
  { id: 9, difficulty: 'easy', deceasedGender: 'male', estateValue: 12,
    disallowed: ['son','daughter','father','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 9', note: 'متوفى، ووارثته الوحيدة: الأم.', lesson: 'عند عدم وجود فرع وارث ولا إخوة ولا أب، تأخذ الأم الثلث، ويبقى الباقي بلا عصبة معروفة.' },
  { id: 10, difficulty: 'easy', deceasedGender: 'female', estateValue: 12,
    disallowed: ['son','daughter','father','mother','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 10', note: 'متوفاة، ووارثها الوحيد: الزوج.', lesson: 'عند عدم وجود فرع وارث، يأخذ الزوج نصف التركة، ويبقى النصف الآخر بلا عصبة معروفة.' },
  { id: 11, difficulty: 'easy', deceasedGender: 'male', estateValue: 12,
    disallowed: ['son','daughter','father','mother','husband','wife','brother','sister','grandmother'],
    title: 'قضية 11', note: 'متوفى بلا أب، ووارثه الوحيد: الجد.', lesson: 'عند غياب الأب وعدم وجود فرع وارث ولا إخوة، يقوم الجد مقام الأب تمامًا ويأخذ التركة كاملة.' },
  { id: 12, difficulty: 'easy', deceasedGender: 'female', estateValue: 12,
    disallowed: ['son','daughter','father','mother','husband','wife','brother','sister','grandfather'],
    title: 'قضية 12', note: 'متوفاة بلا أم، ووارثها الوحيد: الجدة.', lesson: 'عند غياب الأم، تأخذ الجدة السدس فرضًا، ويبقى الباقي بلا عصبة معروفة.' },
  { id: 13, difficulty: 'easy', deceasedGender: 'male', estateValue: 12,
    disallowed: ['daughter','father','mother','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 13', note: 'متوفى، ووارثه الوحيد: الابن.', lesson: 'مع عدم وجود أي صاحب فرض آخر، يأخذ الابن التركة كاملة تعصيبًا.' },
  { id: 14, difficulty: 'easy', deceasedGender: 'female', estateValue: 12,
    disallowed: ['son','father','mother','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 14', note: 'متوفاة، ووارثتها الوحيدة: البنت.', lesson: 'البنت المنفردة تأخذ النصف فرضًا، ويبقى النصف الآخر بلا عصبة معروفة في هذه النسخة المبسّطة.' },
  { id: 15, difficulty: 'easy', deceasedGender: 'male', estateValue: 12,
    disallowed: ['son','daughter','father','mother','husband','brother','sister','grandfather','grandmother'],
    title: 'قضية 15', note: 'متوفى، ووارثته الوحيدة: الزوجة.', lesson: 'الزوجة المنفردة (بلا فرع وارث) تأخذ الربع، ويبقى الباقي بلا عصبة معروفة.' },

  // ----- متوسط -----
  { id: 16, difficulty: 'medium', deceasedGender: 'male', estateValue: 24,
    disallowed: ['son','daughter','husband','brother','sister','grandfather','grandmother'],
    title: 'قضية 16', note: 'متوفى، وورثته: زوجة وأب وأم (بلا فرع وارث).', lesson: 'إحدى المسألتين العُمَريتين: الأم تأخذ ثلث ما تبقّى بعد فرض الزوجة لا ثلث التركة كاملة، والأب يأخذ الباقي كله.' },
  { id: 17, difficulty: 'medium', deceasedGender: 'female', estateValue: 24,
    disallowed: ['son','daughter','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 17', note: 'متوفاة، وورثتها: زوج وأب وأم (بلا فرع وارث).', lesson: 'إحدى المسألتين العُمَريتين: الأم تأخذ ثلث ما تبقّى بعد فرض الزوج لا ثلث التركة كاملة، والأب يأخذ الباقي كله.' },
  { id: 18, difficulty: 'medium', deceasedGender: 'male', estateValue: 24,
    disallowed: ['son','daughter','father','husband','wife','sister','grandfather','grandmother'],
    title: 'قضية 18', note: 'متوفى بلا أب، وورثته: أم وأخوان شقيقان.', lesson: 'وجود أخوين فأكثر يردّ فرض الأم من الثلث إلى السدس، ويأخذ الأخوان الباقي بينهما بالتساوي.' },
  { id: 19, difficulty: 'medium', deceasedGender: 'female', estateValue: 36,
    disallowed: ['son','daughter','father','husband','wife','brother','grandfather','grandmother'],
    title: 'قضية 19', note: 'متوفاة بلا أب، وورثتها: أم وثلاث أخوات شقيقات (بلا إخوة ذكور).', lesson: 'الأم تأخذ السدس لوجود أكثر من أخ، والأخوات الثلاث فأكثر يقتسمن الثلثين، والباقي بلا عصبة معروفة.' },
  { id: 20, difficulty: 'medium', deceasedGender: 'male', estateValue: 36,
    disallowed: ['son','daughter','father','husband','wife','grandfather','grandmother'],
    title: 'قضية 20', note: 'متوفى بلا أب، وورثته: أم وأخ شقيق وأخت شقيقة.', lesson: 'الأم تأخذ السدس، والأخ والأخت عصبة، يقتسمان الباقي للذكر مثل حظ الأنثيين.' },
  { id: 21, difficulty: 'medium', deceasedGender: 'male', estateValue: 12,
    disallowed: ['son','daughter','father','husband','wife','brother','sister','grandmother'],
    title: 'قضية 21', note: 'متوفى بلا أب، وورثته: جد وأم (بلا فرع وارث ولا إخوة).', lesson: 'تنبيه مهم: المسألة العُمَرية خاصة بالأب دون الجد — هنا تأخذ الأم ثلث التركة كاملة (لا ثلث الباقي)، ويأخذ الجد الباقي.' },
  { id: 22, difficulty: 'medium', deceasedGender: 'female', estateValue: 12,
    disallowed: ['son','daughter','mother','husband','wife','brother','sister','grandfather'],
    title: 'قضية 22', note: 'متوفاة بلا أم، وورثتها: جدة وأب.', lesson: 'الجدة والأب من جهتين مختلفتين، فلا تحجب إحداهما الأخرى: الجدة تأخذ السدس، والأب الباقي.' },
  { id: 23, difficulty: 'medium', deceasedGender: 'male', estateValue: 36,
    disallowed: ['daughter','mother','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 23', note: 'متوفى، وورثته: أب وثلاثة أبناء (بلا بنات).', lesson: 'الأب يأخذ السدس فقط لوجود الابن، والأبناء الثلاثة يقتسمون الباقي بينهم بالتساوي.' },
  { id: 24, difficulty: 'medium', deceasedGender: 'female', estateValue: 24,
    disallowed: ['son','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 24', note: 'متوفاة، وورثتها: أم وأب وبنتان (بلا ابن).', lesson: 'الأم والأب يأخذان السدس لكل منهما، والبنتان يقتسمان الثلثين؛ مجموع الفروض هنا يستوعب التركة كاملة تمامًا بلا زيادة ولا نقصان.' },
  { id: 25, difficulty: 'medium', deceasedGender: 'male', estateValue: 48,
    disallowed: ['daughter','father','mother','husband','brother','sister','grandfather','grandmother'],
    title: 'قضية 25', note: 'متوفى، وورثته: زوجتان وابن (تعدد زوجات).', lesson: 'فرض الثمن يُقسَّم بالتساوي بين الزوجتين، والابن يأخذ كل الباقي تعصيبًا.' },
  { id: 26, difficulty: 'medium', deceasedGender: 'male', estateValue: 96,
    disallowed: ['son','father','mother','husband','brother','sister','grandfather','grandmother'],
    title: 'قضية 26', note: 'متوفى، وورثته: ثلاث زوجات وبنت واحدة (بلا ابن).', lesson: 'الثمن يُقسَّم بالتساوي بين الزوجات الثلاث، والبنت المنفردة تأخذ النصف، والباقي بلا عصبة معروفة.' },
  { id: 27, difficulty: 'medium', deceasedGender: 'female', estateValue: 24,
    disallowed: ['daughter','father','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 27', note: 'متوفاة، وورثتها: زوج وأم وابنان.', lesson: 'الزوج يأخذ الربع، والأم السدس لوجود الفرع الوارث، والابنان يقتسمان الباقي بالتساوي.' },

  // ----- متقدم -----
  { id: 28, difficulty: 'advanced', deceasedGender: 'male', estateValue: 24,
    disallowed: ['daughter','husband','brother','sister','grandfather','grandmother'],
    title: 'قضية 28', note: 'متوفى، وورثته: زوجة وأم وأب وابن (حالة شاملة).', lesson: 'الزوجة الثمن، والأم والأب السدس لكل منهما، والابن يأخذ كل الباقي — راقب الحجب وتراكم الفروض بدقة.' },
  { id: 29, difficulty: 'advanced', deceasedGender: 'female', estateValue: 12,
    disallowed: ['daughter','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 29', note: 'متوفاة، وورثتها: زوج وأم وأب وابن (حالة شاملة).', lesson: 'الزوج الربع، والأم والأب السدس لكل منهما، والابن يأخذ كل الباقي.' },
  { id: 30, difficulty: 'advanced', deceasedGender: 'male', estateValue: 24,
    disallowed: ['husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 30', note: 'متوفى، وورثته: أب وأم وابن وبنتان.', lesson: 'الأب والأم السدس لكل منهما، والباقي يُقسَّم بين الابن والبنتين تعصيبًا للذكر مثل حظ الأنثيين.' },
  { id: 31, difficulty: 'advanced', deceasedGender: 'female', estateValue: 12,
    disallowed: ['daughter','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 31', note: 'متوفاة، وورثتها: أب وأم وابنان (بلا بنات).', lesson: 'الأب والأم السدس لكل منهما، والابنان يقتسمان الباقي بينهما بالتساوي.' },
  { id: 32, difficulty: 'advanced', deceasedGender: 'male', estateValue: 12,
    disallowed: ['daughter','father','husband','wife','brother','sister','grandmother'],
    title: 'قضية 32', note: 'متوفى بلا أب، وورثته: جد وأم وابن.', lesson: 'الجد يقوم مقام الأب فيأخذ السدس لوجود الابن، والأم السدس لوجود الفرع الوارث، والابن الباقي.' },
  { id: 33, difficulty: 'advanced', deceasedGender: 'female', estateValue: 12,
    disallowed: ['son','mother','husband','wife','brother','sister','grandfather'],
    title: 'قضية 33', note: 'متوفاة بلا أم، وورثتها: جدة وأب وبنت (بلا ابن).', lesson: 'الجدة السدس، والأب السدس مع الباقي تعصيبًا لوجود البنت وحدها، والبنت النصف فرضًا.' },
  { id: 34, difficulty: 'advanced', deceasedGender: 'male', estateValue: 12,
    disallowed: ['son','daughter','mother','husband','wife','sister','grandmother'],
    title: 'قضية 34', note: 'متوفى، وورثته: أب وجد وأخ شقيق معًا.', lesson: 'بطاقة حجب مزدوج: وجود الأب يحجب الجد كليًا ويحجب الأخ الشقيق كليًا في آن واحد، فيأخذ الأب التركة كاملة.' },
  { id: 35, difficulty: 'advanced', deceasedGender: 'female', estateValue: 12,
    disallowed: ['son','husband','wife','brother','sister','grandfather'],
    title: 'قضية 35', note: 'متوفاة، وورثتها: أم وجدة وأب وبنت.', lesson: 'وجود الأم يحجب الجدة كليًا؛ الأم السدس، والأب السدس مع الباقي تعصيبًا، والبنت النصف.' },
  { id: 36, difficulty: 'advanced', deceasedGender: 'male', estateValue: 96,
    disallowed: ['daughter','father','mother','husband','brother','sister','grandfather','grandmother'],
    title: 'قضية 36', note: 'متوفى، وورثته: أربع زوجات (الحد الأقصى) وابن.', lesson: 'فرض الثمن يُقسَّم بالتساوي بين الزوجات الأربع، والابن يأخذ كل الباقي تعصيبًا.' },
  { id: 37, difficulty: 'advanced', deceasedGender: 'male', estateValue: 24,
    disallowed: ['son','father','mother','husband','brother','sister','grandfather','grandmother'],
    title: 'قضية 37', note: 'متوفى، وورثته: زوجة وبنتان (بلا ابن).', lesson: 'الزوجة الثمن، والبنتان الثلثان مقسّمَين بينهما بالتساوي، والباقي بلا عصبة معروفة.' },
  { id: 38, difficulty: 'advanced', deceasedGender: 'female', estateValue: 12,
    disallowed: ['son','daughter','father','mother','wife','sister','grandfather','grandmother'],
    title: 'قضية 38', note: 'متوفاة بلا أب ولا ابن، وورثتها: زوج وأخوان شقيقان.', lesson: 'الزوج النصف (بلا فرع وارث)، والأخوان عصبة يقتسمان الباقي بينهما بالتساوي.' },
  { id: 39, difficulty: 'advanced', deceasedGender: 'male', estateValue: 36,
    disallowed: ['daughter','husband','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 39', note: 'متوفى، وورثته: أب وأم وثلاثة أبناء (بلا بنات).', lesson: 'الأب والأم السدس لكل منهما، والأبناء الثلاثة يقتسمون الباقي بينهم بالتساوي.' },
  { id: 40, difficulty: 'advanced', deceasedGender: 'female', estateValue: 36,
    disallowed: ['father','wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 40', note: 'متوفاة، وورثتها: زوج وأم وابن وبنت.', lesson: 'الزوج الربع، والأم السدس لوجود الفرع الوارث، والباقي بين الابن والبنت تعصيبًا للذكر مثل حظ الأنثيين.' },

  // ----- مختلط / حالات تحتاج مراجعة (لأمانة العرض الفقهي، بلا ترجيح رأي مختلف فيه) -----
  { id: 41, difficulty: 'mixed', deceasedGender: 'male', estateValue: 24,
    disallowed: ['son','father','mother','husband','wife','brother','grandfather','grandmother'],
    title: 'قضية 41', note: 'متوفى بلا أب ولا ابن، وورثته: أخت شقيقة وبنت.', lesson: 'ليست مسألة خلافية: قاعدة "أعصبوهن بالبنات" المتفَق عليها — البنت تأخذ النصف فرضًا، والأخت "عصبة مع الغير" فتأخذ الباقي (النصف) كاملًا لانفرادها.' },
  { id: 42, difficulty: 'mixed', deceasedGender: 'female', estateValue: 24,
    disallowed: ['son','father','mother','husband','wife','sister','grandfather','grandmother'],
    title: 'قضية 42', note: 'متوفاة بلا أب ولا ابن، وورثتها: أخ شقيق وبنت.', lesson: 'مسألة غير خلافية: البنت تأخذ النصف فرضًا، والأخ عصبة بنفسه كعادته (بلا حاجة لبنت أصلًا) فيأخذ الباقي (النصف) كاملًا.' },
  { id: 43, difficulty: 'mixed', deceasedGender: 'male', estateValue: 24,
    disallowed: ['son','daughter','father','mother','husband','wife','grandmother'],
    title: 'قضية 43', note: 'متوفى بلا أب ولا ابن، وورثته: جد وأخ شقيق وأخت شقيقة.', lesson: 'مسألة "الجد والإخوة" الشهيرة، المختلف فيها بين الصحابة أنفسهم (أبو بكر مقابل علي وزيد) — تُعرض تحتاج مراجعة بلا ترجيح.' },
  { id: 44, difficulty: 'mixed', deceasedGender: 'female', estateValue: 24,
    disallowed: ['son','daughter','father','mother','husband','wife','brother','grandmother'],
    title: 'قضية 44', note: 'متوفاة بلا أب ولا ابن، وورثتها: جد وأخت شقيقة.', lesson: 'نفس مسألة "الجد والإخوة" الخلافية — تحدث بصرف النظر عن جنس المتوفى، وتُعرض تحتاج مراجعة.' },
  { id: 45, difficulty: 'mixed', deceasedGender: 'female', estateValue: 24,
    disallowed: ['son','daughter','father','mother','wife','brother','grandfather','grandmother'],
    title: 'قضية 45', note: 'متوفاة بلا فرع وارث، وورثتها: زوج وأختان شقيقتان.', lesson: 'حالة "عول": مجموع الفروض هنا يتجاوز التركة كاملة (نصف + ثلثان) — غير مطبَّق في هذه النسخة، وتُعرض تحتاج مراجعة.' },
  { id: 46, difficulty: 'mixed', deceasedGender: 'male', estateValue: 24,
    disallowed: ['son','daughter','father','husband','brother','grandfather','grandmother'],
    title: 'قضية 46', note: 'متوفى بلا فرع وارث، وورثته: زوجة وأم وثلاث أخوات شقيقات.', lesson: 'حالة "عول" أخرى: مجموع الفروض (ربع + سدس + ثلثان) يتجاوز التركة كاملة — تُعرض تحتاج مراجعة.' },
  { id: 47, difficulty: 'mixed', deceasedGender: 'male', estateValue: 12,
    disallowed: ['daughter','father','mother','husband','wife','brother','sister'],
    title: 'قضية 47', note: 'متوفى بلا أب ولا أم، وورثته: جد وجدة وابن معًا.', lesson: 'الجد والجدة من جهتين مختلفتين فلا يتحاجبان؛ كل منهما يأخذ السدس، والابن يأخذ الباقي.' },
  { id: 48, difficulty: 'mixed', deceasedGender: 'female', estateValue: 12,
    disallowed: ['son','father','mother','husband','wife','brother','sister'],
    title: 'قضية 48', note: 'متوفاة بلا أب ولا أم، وورثتها: جد وجدة وبنت (بلا ابن).', lesson: 'الجدة السدس، والجد السدس مع الباقي تعصيبًا لوجود البنت وحدها، والبنت النصف فرضًا.' },
  { id: 49, difficulty: 'mixed', deceasedGender: 'male', estateValue: 24,
    disallowed: ['son','daughter','father','mother','husband','wife','grandmother'],
    title: 'قضية 49', note: 'متوفى بلا أب ولا ابن، وورثته: جد وأخوان شقيقان وأخت شقيقة.', lesson: 'مسألة "الجد والإخوة" الخلافية تتكرر مهما تغيّر عدد الإخوة أو تركيبهم — تُعرض دائمًا تحتاج مراجعة.' },
  { id: 50, difficulty: 'mixed', deceasedGender: 'female', estateValue: 36,
    disallowed: ['wife','brother','sister','grandfather','grandmother'],
    title: 'قضية 50', note: 'متوفاة، وورثتها: أم وأب وزوج وابن وبنت — العائلة الكاملة.', lesson: 'بطاقة ختامية شاملة: الأم والأب السدس لكل منهما، الزوج الربع، والباقي بين الابن والبنت تعصيبًا للذكر مثل حظ الأنثيين — تستوعب التركة كاملة تمامًا بلا زيادة ولا نقصان.' }
];

// ---------- بطاقات قيمة التركة ----------
const ESTATE_VALUES = [
  { value: 12, count: 8 },
  { value: 24, count: 8 },
  { value: 36, count: 5 },
  { value: 48, count: 3 }
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
  wife: { ayah: 'nisa-12', note: 'وسط الآية: "ولهن الربع مما تركتم..." — نصيب الزوجة (ملاحظة: آخر الآية عن الإخوة لأم، غير مطبَّقين في هذه اللعبة).' },
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
  { id: 1, category: 'rights', categoryIcon: '⚖️', title: 'دين على المتوفى', story: 'بعد انتهاء الورثة من تقسيم التركة، حضر أحد جيران المتوفى ومعه ورقة قديمة تثبت أن المتوفى اقترض منه مالًا ولم يتمكن من سداده قبل وفاته. نظر الورثة إلى بعضهم، فقد أصبح المال في أيديهم بالفعل.', benefit: 'الدَّين من أعظم الحقوق، ولذلك يُقدَّم سداده على توزيع الميراث. قال تعالى: ﴿مِن بَعْدِ وَصِيَّةٍ يُوصِي بِهَا أَوْ دَيْنٍ﴾', ruling: 'يدفع اللاعب الحالي 10 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -10 }] },
  { id: 2, category: 'rights', categoryIcon: '⚖️', title: 'مؤخر الصداق', story: 'تبين للورثة أن المتوفى لم يكن قد سدد مؤخر صداق زوجته، وكان ينوي أداءه عندما تتيسر أحواله.', benefit: 'مؤخر الصداق دين ثابت في ذمة الزوج حتى يؤديه.', ruling: 'يدفع اللاعب الحالي 8 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -8 }] },
  { id: 3, category: 'rights', categoryIcon: '⚖️', title: 'زكاة المال', story: 'وجد الورثة في أوراق المتوفى حسابًا يبين أن زكاة ماله لم تُخرج في العام الماضي.', benefit: 'حقوق الله المتعلقة بالمال، ومنها الزكاة، تُؤدى قبل تقسيم التركة.', ruling: 'يدفع اللاعب الحالي 6 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -6 }] },
  { id: 4, category: 'rights', categoryIcon: '⚖️', title: 'أمانة', story: 'عثر الورثة داخل خزانة المتوفى على مبلغ من المال مكتوب عليه اسم أحد أصدقائه، فعرفوا أنه أمانة عنده.', benefit: 'الأمانة ليست من التركة، بل يجب ردها إلى صاحبها. قال تعالى: ﴿إِنَّ اللَّهَ يَأْمُرُكُمْ أَنْ تُؤَدُّوا الْأَمَانَاتِ إِلَى أَهْلِهَا﴾', ruling: 'يدفع اللاعب الحالي 6 أسهم ويردها لصاحب الأمانة نيابة عن التركة.', effects: [{ target: 'self', amount: -6 }] },
  { id: 5, category: 'rights', categoryIcon: '⚖️', title: 'وصية صحيحة', story: 'بعد القسمة، وجد الورثة وصية صحيحة أوصى فيها المتوفى بجزء من ماله لأحد أعمال الخير.', benefit: 'الوصية المشروعة تُنفذ قبل توزيع الميراث.', ruling: 'يدفع اللاعب الحالي 6 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -6 }] },
  { id: 6, category: 'rights', categoryIcon: '⚖️', title: 'أجرة عامل', story: 'كان المتوفى قد استأجر عاملًا لإصلاح منزله، لكنه توفي قبل أن يدفع له أجره.', benefit: 'أجرة العامل حق واجب. قال ﷺ: "أعطوا الأجير أجره قبل أن يجف عرقه."', ruling: 'يدفع اللاعب الحالي 5 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -5 }] },
  { id: 7, category: 'rights', categoryIcon: '⚖️', title: 'رد المظالم', story: 'اعترف أحد الورثة أن جزءًا من المال الموروث كان قد أخذه المتوفى بغير حق، ويجب رده إلى صاحبه.', benefit: 'لا يحل مال امرئ مسلم إلا بطيب نفس منه.', ruling: 'يدفع اللاعب الحالي 8 أسهم مباشرة لصاحب الحق (يُختار لاعب يمثله، أو تُرد للبنك إن لم يوجد).', effects: [{ target: 'self', amount: -8 }] },
  { id: 8, category: 'rights', categoryIcon: '⚖️', title: 'نفقة تجهيز المتوفى', story: 'بعد القسمة، تذكر الورثة أن بعض تكاليف تجهيز المتوفى ودفنه لم تكن قد سُددت.', benefit: 'تجهيز الميت من الحقوق التي تُقدم على قسمة التركة.', ruling: 'يدفع اللاعب الحالي 4 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -4 }] },
  { id: 9, category: 'rights', categoryIcon: '⚖️', title: 'نذر مالي', story: 'وجد الورثة ورقة بخط المتوفى يذكر فيها أنه نذر صدقة مالية إذا شفى الله ابنه، ثم تحقق ذلك قبل وفاته.', benefit: 'النذر الواجب يجب الوفاء به.', ruling: 'يدفع اللاعب الحالي 6 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -6 }] },
  { id: 10, category: 'rights', categoryIcon: '⚖️', title: 'كفارة واجبة', story: 'تبين أن على المتوفى كفارة مالية لم يكن قد أخرجها.', benefit: 'إذا وجبت كفارة مالية في ذمة الإنسان فإنها تُخرج من تركته وفق أحكامها.', ruling: 'يدفع اللاعب الحالي 6 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -6 }] },
  { id: 11, category: 'rights', categoryIcon: '⚖️', title: 'مال شريك', story: 'بعد مراجعة الأوراق، تبين أن جزءًا من العقار الموروث كان مملوكًا لشريك آخر، وليس للمتوفى وحده.', benefit: 'لا يجوز أن يرث الإنسان ما ليس مملوكًا للمورث.', ruling: 'يدفع اللاعب الحالي 8 أسهم لصاحب الحصة نيابة عن التركة.', effects: [{ target: 'self', amount: -8 }] },
  { id: 12, category: 'rights', categoryIcon: '⚖️', title: 'دين مجهول', story: 'ظهر شخص يحمل مستندًا يثبت أن للمتوفى دينًا قديمًا لم يكن أحد من الورثة يعلم به.', benefit: 'حقوق العباد لا تسقط بوفاة صاحبها.', ruling: 'يدفع اللاعب الحالي 15 سهمًا كاملة نيابة عن كل الورثة (مبلغ أعلى لأن الدين لم يكن متوقعًا).', effects: [{ target: 'self', amount: -15 }] },
  { id: 13, category: 'rights', categoryIcon: '⚖️', title: 'وديعة مصرفية', story: 'تبين أن جزءًا من المال الموجود في الحساب البنكي كان وديعة لأحد الأقارب وليست ملكًا للمتوفى.', benefit: 'الوديعة أمانة يجب ردها إلى صاحبها.', ruling: 'يدفع اللاعب الحالي 6 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -6 }] },
  { id: 14, category: 'rights', categoryIcon: '⚖️', title: 'سداد قرض حسن', story: 'كان أحد أقارب المتوفى قد أقرضه مالًا دون فوائد، ولم يتمكن من استرداده قبل وفاته.', benefit: 'رد القرض من أداء الأمانة، وهو من أولى الحقوق.', ruling: 'يدفع اللاعب الحالي 8 أسهم نيابة عن التركة.', effects: [{ target: 'self', amount: -8 }] },
  { id: 15, category: 'rights', categoryIcon: '⚖️', title: 'اجتماع الحقوق', story: 'بعد مراجعة التركة، تبين وجود أكثر من حق مالي على المتوفى؛ دَين، وزكاة، وأجرة عامل لم تُسدَّد.', benefit: 'تُقدَّم الحقوق المتعلقة بالتركة على توزيع الميراث، حتى يصل كل ذي حق إلى حقه.', ruling: 'يدفع اللاعب الحالي 18 سهمًا نيابة عن التركة (دين + زكاة + أجرة عامل مجمّعين).', effects: [{ target: 'self', amount: -18 }] },

  // 👨‍👩‍👧 مسؤوليات مالية بعد الميراث (16-25)
  { id: 16, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'مؤخر الصداق', story: 'مرت سنوات على زواجك، وحان الوقت للوفاء بمؤخر صداق زوجتك الذي اتفقتما عليه يوم عقد الزواج.', benefit: 'مؤخر الصداق حق للزوجة، وهو دين في ذمة الزوج حتى يؤديه.', ruling: 'ادفع 25 سهمًا إلى البنك.', effects: [{ target: 'self', amount: -25 }] },
  { id: 17, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'إتلاف مزرعة الجيران', story: 'كان ابنك يلعب بالألعاب النارية، فتطاير شررها إلى مزرعة الجيران وأتلف جزءًا من المحصول.', benefit: 'يحرم الاعتداء على أموال الناس، ومن تسبب في إتلاف مال غيره فعليه ضمانه.', ruling: 'ادفع 20 سهمًا إلى البنك.', effects: [{ target: 'self', amount: -20 }] },
  { id: 18, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'سداد دين شخصي', story: 'حل موعد سداد دين كنت قد اقترضته قبل مدة، وجاء صاحبه يطالبك بحقه.', benefit: 'المؤمن يفي بديونه ولا يماطل في أداء الحقوق.', ruling: 'ادفع 10 أسهم إلى البنك.', effects: [{ target: 'self', amount: -10 }] },
  { id: 19, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'زكاة مالك', story: 'مر عام كامل على مالك، وبلغ النصاب، فأصبحت الزكاة واجبة عليك.', benefit: 'الزكاة ركن من أركان الإسلام، وهي حق للفقراء في مال الأغنياء.', ruling: 'ادفع 5 أسهم إلى البنك.', effects: [{ target: 'self', amount: -5 }] },
  { id: 20, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'نفقة الأسرة', story: 'بدأ العام الدراسي، واحتاج أبناؤك إلى الكتب والملابس والمستلزمات الدراسية.', benefit: 'النفقة على الزوجة والأولاد من مسؤوليات رب الأسرة.', ruling: 'ادفع 10 أسهم إلى البنك.', effects: [{ target: 'self', amount: -10 }] },
  { id: 21, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'علاج أحد أبنائك', story: 'مرض أحد أبنائك واحتاج إلى عملية جراحية عاجلة، فبادرت بعلاجه.', benefit: 'الإنفاق على علاج من تعولهم من أعظم صور القيام بالمسؤولية.', ruling: 'ادفع 15 سهمًا إلى البنك.', effects: [{ target: 'self', amount: -15 }] },
  { id: 22, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'إصلاح المنزل الموروث', story: 'ورثت منزلًا قديمًا، لكنك اكتشفت أنه يحتاج إلى إصلاحات قبل أن يصبح صالحًا للسكن.', benefit: 'حفظ المال واستثماره من الأمور المحمودة، ويحتاج أحيانًا إلى إنفاق قبل الانتفاع به.', ruling: 'ادفع 10 أسهم، ثم في الجولة القادمة خذ 15 سهمًا من البنك.', effects: [{ target: 'self', amount: -10, deferred: { amount: 15, afterRounds: 1 } }] },
  { id: 23, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'استصلاح أرض موروثة', story: 'ورثت أرضًا مهملة، فأنفقت عليها حتى أصبحت صالحة للزراعة والإنتاج.', benefit: 'إحياء الأرض واستثمارها من الأعمال النافعة التي تعود بالنفع على صاحبها والمجتمع.', ruling: 'ادفع 10 أسهم، ثم خذ 20 سهمًا من البنك.', effects: [{ target: 'self', amount: -10 }, { target: 'self', amount: 20 }] },
  { id: 24, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'سداد دين عن والدك', story: 'علمت أن والدك توفي وعليه دين لم يتمكن من سداده، فبادرت إلى سداده من مالك تبرعًا وإحسانًا.', benefit: 'قضاء دين الوالد بعد وفاته من أعظم صور البر والإحسان.', ruling: 'ادفع 10 أسهم، ثم خذ 10 أسهم من البنك مكافأة.', effects: [{ target: 'self', amount: -10 }, { target: 'self', amount: 10 }] },
  { id: 25, category: 'responsibilities', categoryIcon: '👨‍👩‍👧', title: 'توسعة التجارة', story: 'استثمرت جزءًا من المال الذي ورثته في توسيع تجارتك، واشتركت مع تاجر أمين حتى ازداد نشاطك التجاري.', benefit: 'المال نعمة، وأفضل استثماره فيما ينفع صاحبه والناس.', ruling: 'ادفع 10 أسهم الآن، ثم خذ 20 سهمًا من البنك.', effects: [{ target: 'self', amount: -10 }, { target: 'self', amount: 20 }] },

  // 🛡️ العاقلة، القتل الخطأ، الصلح، العفو (26-35)
  { id: 26, category: 'aqilah', categoryIcon: '🛡️', title: 'دية القتل الخطأ', story: 'وقع حادث سير غير مقصود تسبب في وفاة أحد الناس. وبعد نظر القضية، حكم القاضي بوجوب الدية على الجاني.', benefit: 'في القتل الخطأ، تتحمل العاقلة (العصبة من الذكور) المساهمة في دفع الدية، تخفيفًا عن الجاني وتحقيقًا للتكافل.', ruling: 'كل لاعب من العاقلة يدفع 15 سهمًا.', effects: [{ target: 'aqilah', amount: -15 }] },
  { id: 27, category: 'aqilah', categoryIcon: '🛡️', title: 'العفو عن جزء من الدية', story: 'قرر أولياء الدم العفو عن جزء من الدية، رغبةً في الأجر والإصلاح.', benefit: 'العفو من أفضل الأخلاق، وقد رغب الإسلام في الصلح والإحسان.', ruling: 'كل لاعب من العاقلة يسترد 5 أسهم.', effects: [{ target: 'aqilah', amount: 5 }] },
  { id: 28, category: 'aqilah', categoryIcon: '🛡️', title: 'صلح بين العائلتين', story: 'اجتمع كبار العائلتين، وانتهت القضية بالصلح والتراضـي دون نزاع.', benefit: 'الصلح خير، ويطفئ كثيرًا من أسباب العداوة.', ruling: 'كل لاعب من العاقلة يسترد 3 أسهم.', effects: [{ target: 'aqilah', amount: 3 }] },
  { id: 29, category: 'aqilah', categoryIcon: '🛡️', title: 'محسن تكفل بجزء من الدية', story: 'تبرع أحد المحسنين بجزء من مبلغ الدية، تخفيفًا عن أهل الجاني.', benefit: 'تفريج كرب المسلمين من أعظم القربات.', ruling: 'كل لاعب من العاقلة يدفع 10 أسهم فقط بدلًا من 15.', effects: [{ target: 'aqilah', amount: -10 }] },
  { id: 30, category: 'aqilah', categoryIcon: '🛡️', title: 'إعسار أحد أفراد العاقلة', story: 'كان أحد أفراد العاقلة فقيرًا لا يستطيع المشاركة في دفع نصيبه من الدية.', benefit: 'يراعى حال المعسر، ويتعاون أهل الخير في قضاء الحقوق.', ruling: 'أغنى لاعب من العاقلة يدفع 10 أسهم إضافية بدلًا عنه.', effects: [{ target: 'highestBalanceAqilah', amount: -10 }] },
  { id: 31, category: 'aqilah', categoryIcon: '🛡️', title: 'توسعت العاقلة', story: 'اشترك عدد أكبر من أفراد العاقلة في تحمل الدية، فتوزع العبء بينهم.', benefit: 'كلما زاد المشاركون، خف العبء عن كل فرد.', ruling: 'كل لاعب من العاقلة يدفع 10 أسهم بدلًا من 15.', effects: [{ target: 'aqilah', amount: -10 }] },
  { id: 32, category: 'aqilah', categoryIcon: '🛡️', title: 'كبير العائلة', story: 'قرر كبير العائلة أن يتحمل جزءًا أكبر من الدية تخفيفًا عن بقية أفراد الأسرة.', benefit: 'الإحسان والتطوع في تحمل الأعباء من مكارم الأخلاق.', ruling: 'صاحب أكبر رصيد من العاقلة يدفع 10 أسهم إضافية.', effects: [{ target: 'highestBalanceAqilah', amount: -10 }] },
  { id: 33, category: 'aqilah', categoryIcon: '🛡️', title: 'تنازل عن حقه', story: 'تنازل أحد أفراد العاقلة عن حقه في استرداد ما دفعه، ابتغاءً للأجر.', benefit: 'الإيثار والعفو من أسباب الألفة بين الناس.', ruling: 'اختر لاعبًا من العاقلة، ولا يسترد أي أسهم في هذه البطاقة.', effects: [{ target: 'none', amount: 0 }] },
  { id: 34, category: 'aqilah', categoryIcon: '🛡️', title: 'القاتل لا يرث', story: 'أثناء مراجعة القضية، ثبت أن أحد الورثة قتل المورث عمدًا بغير حق.', benefit: 'من موانع الإرث في الجملة قتل المورث بغير حق، فلا يجتمع للإنسان أن يستعجل المال بجريمة ثم يرثه.', ruling: 'إذا كانت بطاقة القضية الحالية تتضمن هذه الحالة، يُحرم هذا اللاعب من نصيبه في هذه القضية ويُعاد توزيع التركة وفق الورثة المستحقين. (تُستخدم فقط إذا نصت بطاقة القضية على وجود قاتل — بلا أثر رقمي تلقائي هنا.)', effects: [{ target: 'none', amount: 0 }] },
  { id: 35, category: 'aqilah', categoryIcon: '🛡️', title: 'عفو كامل', story: 'سامح أولياء الدم أهل الجاني، وتنازلوا عن الدية ابتغاء وجه الله.', benefit: 'العفو والإصلاح من أعظم أسباب الأجر، وقد مدح الله أهلهما.', ruling: 'لا يدفع أفراد العاقلة شيئًا في هذه الجولة.', effects: [{ target: 'none', amount: 0 }] },

  // 💰 التجارة والبركة وإدارة المال (36-45)
  { id: 36, category: 'trade', categoryIcon: '💰', title: 'بركة الصدقة', story: 'كنت تحرص على إخراج الصدقة كلما وسّع الله عليك في الرزق، ولم تبخل على الفقراء والمحتاجين.', benefit: 'قال ﷺ: "ما نقص مالٌ من صدقة."', ruling: 'خذ 20 سهمًا من البنك.', effects: [{ target: 'self', amount: 20 }] },
  { id: 37, category: 'trade', categoryIcon: '💰', title: 'تجارة ناجحة', story: 'استثمرت جزءًا من المال الذي ورثته في تجارة مباحة، فبارك الله فيها حتى تضاعفت أرباحها.', benefit: 'المال إذا استُثمر بالحلال كان سببًا في زيادة الخير.', ruling: 'خذ 20 سهمًا.', effects: [{ target: 'self', amount: 20 }] },
  { id: 38, category: 'trade', categoryIcon: '💰', title: 'خسارة تجارية', story: 'دخلت تجارة دون دراسة كافية، فتعرضت لخسارة جزء من رأس مالك.', benefit: 'حسن التخطيط والأخذ بالأسباب من أسباب النجاح.', ruling: 'ادفع 15 سهمًا.', effects: [{ target: 'self', amount: -15 }] },
  { id: 39, category: 'trade', categoryIcon: '💰', title: 'ارتفاع قيمة الأرض', story: 'بعد سنوات، ارتفعت قيمة الأرض التي ورثتها، فأصبحت تساوي أضعاف ثمنها.', benefit: 'من نعم الله أن يبارك للإنسان في ماله.', ruling: 'خذ 25 سهمًا من البنك.', effects: [{ target: 'self', amount: 25 }] },
  { id: 40, category: 'trade', categoryIcon: '💰', title: 'شريك أمين', story: 'دخلت في شراكة مع تاجر عُرف بالأمانة والصدق، فكان ذلك سببًا في نجاح تجارتكما.', benefit: 'الأمانة والصدق من أسباب البركة في البيع والشراء.', ruling: 'اختر لاعبًا، يحصل كل منكما على 10 أسهم من البنك.', effects: [{ target: 'chosenPlayer', amount: 10, selfAmount: 10 }] },
  { id: 41, category: 'trade', categoryIcon: '💰', title: 'رد جميل', story: 'كنت قد ساعدت أحد أقاربك في بداية مشروعه، وبعد نجاحه أصر على رد الجميل لك.', benefit: '«هل جزاء الإحسان إلا الإحسان».', ruling: 'اختر لاعبًا، يدفع لك 10 أسهم.', effects: [{ target: 'chosenPlayer', amount: -10, selfAmount: 10 }] },
  { id: 42, category: 'trade', categoryIcon: '💰', title: 'ادخار حكيم', story: 'لم تنفق مالك كله، بل ادخرت جزءًا منه حتى احتجت إليه في وقت الشدة.', benefit: 'الاعتدال في الإنفاق من صفات المؤمن.', ruling: 'إذا كان رصيدك أقل من 30 سهمًا، خذ 15 سهمًا من البنك. وإذا كان أكثر، خذ 5 أسهم فقط.', effects: [{ target: 'conditionalBalance', threshold: 30, belowAmount: 15, aboveOrEqualAmount: 5 }] },
  { id: 43, category: 'trade', categoryIcon: '💰', title: 'مشروع خيري', story: 'خصصت جزءًا من مالك لإنشاء مشروع يعود نفعه على الناس ويستمر أثره.', benefit: 'الصدقة الجارية من أفضل ما يتركه المسلم بعد وفاته.', ruling: 'ادفع 10 أسهم الآن، وفي أول دور لك بعد جولتين خذ 20 سهمًا.', effects: [{ target: 'self', amount: -10, deferred: { amount: 20, afterRounds: 2 } }] },
  { id: 44, category: 'trade', categoryIcon: '💰', title: 'هدية ثمينة', story: 'أهداك أحد أقاربك قطعة أرض تقديرًا لمواقفك معه.', benefit: 'الهدية تزيد المحبة بين الناس.', ruling: 'خذ 15 سهمًا من البنك.', effects: [{ target: 'self', amount: 15 }] },
  { id: 45, category: 'trade', categoryIcon: '💰', title: 'خسارة بسبب الإسراف', story: 'أنفقت أموالًا كثيرة في الكماليات حتى ضاعت عليك فرصة استثمار مربحة.', benefit: 'قال تعالى: ﴿ولا تُسرفوا إنه لا يحب المسرفين﴾', ruling: 'ادفع 15 سهمًا.', effects: [{ target: 'self', amount: -15 }] },

  // 🤝 التكافل الأسري (46-50)
  { id: 46, category: 'takaful', categoryIcon: '🤝', title: 'مساعدة أخت مطلقة', story: 'تعرضت أختكم للطلاق، وكانت تمر بظروف مالية صعبة، فاتفق أفراد الأسرة على مساعدتها حتى تستقر حياتها.', benefit: 'التكافل بين أفراد الأسرة من أعظم أسباب قوة المجتمع.', ruling: 'كل اللاعبين ما عدا أنت يدفعون لك 5 أسهم.', effects: [{ target: 'allOthersPayToSelf', amount: -5 }] },
  { id: 47, category: 'takaful', categoryIcon: '🤝', title: 'علاج قريب', story: 'احتاج أحد أقاربكم إلى عملية جراحية عاجلة، فتعاونت الأسرة على تحمل تكاليف العلاج.', benefit: 'قال تعالى: ﴿وتعاونوا على البر والتقوى﴾', ruling: 'اختر لاعبين، يدفع كل واحد منهما 5 أسهم.', effects: [{ target: 'chosenPlayers2', amount: -5 }] },
  { id: 48, category: 'takaful', categoryIcon: '🤝', title: 'كفالة يتيم', story: 'قررت الأسرة كفالة طفل يتيم من أقاربها حتى يكبر ويعتمد على نفسه.', benefit: 'قال ﷺ: "أنا وكافل اليتيم في الجنة كهاتين."', ruling: 'كل لاعب يدفع 3 أسهم.', effects: [{ target: 'allPlayers', amount: -3 }] },
  { id: 49, category: 'takaful', categoryIcon: '🤝', title: 'إعادة بناء منزل', story: 'احترق منزل أحد الأقارب، فاجتمع أفراد الأسرة لمساعدته حتى يعود إلى بيته.', benefit: 'تفريج كرب المسلمين من أفضل الأعمال.', ruling: 'صاحب أكبر رصيد يدفع 15 سهمًا، وبقية اللاعبين يدفع كل منهم 3 أسهم.', effects: [{ target: 'highestBalance', amount: -15 }, { target: 'allExceptHighestBalance', amount: -3 }] },
  { id: 50, category: 'takaful', categoryIcon: '🤝', title: 'صندوق الأسرة', story: 'اتفقت الأسرة على إنشاء صندوق مالي للطوارئ، يساهم فيه الجميع ليستفيد منه من يمر بضائقة.', benefit: 'التعاون والتكافل من أسباب استقرار الأسرة وقوتها.', ruling: 'يدفع كل لاعب 5 أسهم، ثم يحصل صاحب أقل رصيد على جميع الأسهم المجموعة.', effects: [{ target: 'allPlayers', amount: -5 }, { target: 'lowestBalancePool', amount: 5 }] }
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
