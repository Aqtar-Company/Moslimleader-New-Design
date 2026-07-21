/* data.js — كل البيانات الثابتة للعبة: الورثة، الحالات، قيم التركة، النصوص التعليمية */

// ---------- بطاقات الورثة ----------
// كل نوع وارث: id, name, icon, color, description, count (عدد النسخ في الرزمة)
const HEIR_TYPES = [
  {
    id: 'son',
    name: 'ابن',
    icon: '👦',
    color: '#3E7CB1',
    description: 'الابن وارث بالتعصيب (يأخذ الباقي بعد أصحاب الفروض)، وللذكر مثل حظ الأنثيين مع البنات.',
    count: 10
  },
  {
    id: 'daughter',
    name: 'بنت',
    icon: '👧',
    color: '#B15C9E',
    description: 'البنت الواحدة تأخذ النصف، والبنتان فأكثر يأخذن الثلثين، وإن وُجد ابن أخذت مع إخوتها الباقي تعصيبًا.',
    count: 10
  },
  {
    id: 'father',
    name: 'أب',
    icon: '👴',
    color: '#4C9A6A',
    description: 'الأب يأخذ السدس مع وجود الابن، ويجمع بين السدس والباقي مع وجود البنت فقط، ويأخذ الباقي كله عند عدم وجود فرع وارث.',
    count: 6
  },
  {
    id: 'mother',
    name: 'أم',
    icon: '👵',
    color: '#D98A3D',
    description: 'الأم تأخذ السدس مع وجود فرع وارث أو عدد من الإخوة، وتأخذ الثلث في غير ذلك.',
    count: 6
  },
  {
    id: 'husband',
    name: 'زوج',
    icon: '🤵',
    color: '#7A6FB0',
    description: 'الزوج يأخذ النصف إن لم يوجد فرع وارث للزوجة المتوفاة، والربع إن وُجد.',
    count: 5
  },
  {
    id: 'wife',
    name: 'زوجة',
    icon: '👰',
    color: '#C9598A',
    description: 'الزوجة تأخذ الربع إن لم يوجد فرع وارث للزوج المتوفى، والثمن إن وُجد، وتشترك الزوجات في النصيب.',
    count: 5
  },
  {
    id: 'brother',
    name: 'أخ شقيق',
    icon: '🧔',
    color: '#3D8F8A',
    description: 'الأخ الشقيق وارث بالتعصيب، يُحجب بالأب أو الابن، وإن وُجدت أخت شقيقة معه اقتسما الباقي للذكر مثل حظ الأنثيين.',
    count: 8
  },
  {
    id: 'sister',
    name: 'أخت شقيقة',
    icon: '👩',
    color: '#A9762E',
    description: 'الأخت الشقيقة تأخذ النصف منفردة أو الثلثين مع أخواتها، وتُحجب بالأب أو الابن.',
    count: 8
  }
];

function getHeirType(id) {
  return HEIR_TYPES.find(h => h.id === id);
}

// ---------- بطاقات حالة المتوفى ----------
// difficulty: easy | medium | advanced | expert(قريبًا - غير مفعّلة)
// disallowed: قائمة معرفات الورثة الممنوع لعبها في هذه الحالة
const DECEASED_CASES = [
  // ----- سهل (أخضر) -----
  {
    id: 1, difficulty: 'easy', deceasedGender: 'male',
    disallowed: ['father', 'mother', 'brother', 'sister', 'husband'],
    title: 'الحالة 1', note: 'متوفى بلا أب ولا أم ولا إخوة.',
    lesson: 'هذه من أبسط المسائل: الزوجة صاحبة فرض، والابن والبنت يقتسمان الباقي تعصيبًا.'
  },
  {
    id: 2, difficulty: 'easy', deceasedGender: 'female',
    disallowed: ['father', 'mother', 'brother', 'sister', 'wife'],
    title: 'الحالة 2', note: 'متوفاة بلا أب ولا أم ولا إخوة.',
    lesson: 'الزوج صاحب فرض، والابن والبنت يقتسمان الباقي تعصيبًا.'
  },
  {
    id: 3, difficulty: 'easy', deceasedGender: 'male',
    disallowed: ['son', 'daughter', 'brother', 'sister', 'husband'],
    title: 'الحالة 3', note: 'متوفى بلا أبناء ولا إخوة.',
    lesson: 'بغياب الفرع الوارث، الأب يأخذ الباقي بعد فرض الزوجة والأم.'
  },
  {
    id: 4, difficulty: 'easy', deceasedGender: 'female',
    disallowed: ['son', 'daughter', 'brother', 'sister', 'wife'],
    title: 'الحالة 4', note: 'متوفاة بلا أبناء ولا إخوة.',
    lesson: 'بغياب الفرع الوارث، الأب يأخذ الباقي بعد فرض الزوج والأم.'
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

// ---------- بطاقات قيمة التركة ----------
const ESTATE_VALUES = [
  { value: 12, count: 8 },
  { value: 24, count: 8 },
  { value: 36, count: 5 },
  { value: 48, count: 3 }
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
  substituteMessage: 'تم استبدال البطاقة، ولن تشارك في تركة هذه الجولة.',
  needsReviewMessage: 'هذه الحالة تحتاج إلى مراجعة من دليل اللعبة.',
  unevenSplitMessage: 'هذه التركة لا تنقسم بالتساوي على هذه المسألة.',
  undistributedMessage: 'يوجد جزء من التركة لم يُوزَّع لعدم وجود قاعدة واضحة (بدون رد).',
  disclaimer: 'هذه اللعبة أداة تعليمية مبسطة لتقريب مبادئ توزيع المواريث، ولا تُعد مرجعًا شرعيًا نهائيًا. يُرجى مراجعة عالم شرعي أو مختص في الفرائض في أي حالة واقعية.'
};
