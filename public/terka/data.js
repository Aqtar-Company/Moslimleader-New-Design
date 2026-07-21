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
    lesson: 'هذه إحدى "المسألتين العُمَريتين": الأم هنا لا تأخذ ثلث التركة كاملة، بل ثلث ما تبقّى بعد فرض الزوجة، والأب يأخذ الباقي كله.'
  },
  {
    id: 4, difficulty: 'easy', deceasedGender: 'female',
    disallowed: ['son', 'daughter', 'brother', 'sister', 'wife'],
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
  sister: { ayah: 'nisa-176', note: 'آية الكلالة: "وإن امرؤ هلك ليس له ولد وله أخت فلها نصف ما ترك".' }
};

// ---------- بطاقات الأحكام (إصدار أول، 50 بطاقة) ----------
// تُنفَّذ بعد توزيع الميراث، ولا تؤثر في صحة القسمة الشرعية، وإنما تُطبَّق على "رصيد" منفصل لكل لاعب.
// effect.target أنواعه: self | allPlayers | allExceptSelf | heirsThisRound | aqilah | largestAqilahShare |
//   lowestBalance | highestBalance | largestShareThisRound | smallestShareThisRound |
//   leftNeighbor | rightNeighbor | allOthersPayToSelf | chosenPlayer | chosenPlayers2 | firstToNotice | none
// effect.amount: القيمة المطبَّقة على الهدف (سالبة = دفع، موجبة = أخذ). effect.selfAmount: أثر إضافي على صاحب الدور
// نفسه في حالات النقل المباشر (جار/لاعب مُختار).
const JUDGMENT_CARDS = [
  { id: 1, title: 'دين على المتوفى', story: 'ظهر دين كان يجب سداده قبل القسمة.', didYouKnow: 'الدين مقدم على الميراث.', ruling: 'يرد كل وارث 5 أسهم.', effect: { target: 'heirsThisRound', amount: -5 } },
  { id: 2, title: 'مؤخر صداق', story: 'تبين وجود مؤخر صداق.', didYouKnow: 'المؤخر دين في الذمة.', ruling: 'يدفع كل لاعب 5 أسهم.', effect: { target: 'allPlayers', amount: -5 } },
  { id: 3, title: 'زكاة', story: 'ظهر أن على المتوفى زكاة.', didYouKnow: 'تخرج قبل القسمة.', ruling: 'يدفع كل لاعب 3 أسهم.', effect: { target: 'allPlayers', amount: -3 } },
  { id: 4, title: 'أمانة', story: 'وجد مال أمانة.', didYouKnow: 'الأمانات ترد لأهلها.', ruling: 'يدفع كل لاعب 3 أسهم.', effect: { target: 'allPlayers', amount: -3 } },
  { id: 5, title: 'وصية', story: 'ثبتت وصية صحيحة.', didYouKnow: 'تنفذ قبل الميراث.', ruling: 'يدفع كل لاعب 3 أسهم.', effect: { target: 'allPlayers', amount: -3 } },
  { id: 6, title: 'دية قتل خطأ', story: 'وقعت دية قتل خطأ.', didYouKnow: 'العاقلة تتحمل الدية.', ruling: 'كل لاعب من العاقلة يدفع 15 سهماً.', effect: { target: 'aqilah', amount: -15 } },
  { id: 7, title: 'عفو', story: 'عفا أولياء الدم عن جزء من الدية.', didYouKnow: 'العفو من الإحسان.', ruling: 'كل لاعب من العاقلة يسترد 5 أسهم.', effect: { target: 'aqilah', amount: 5 } },
  { id: 8, title: 'إتلاف مزرعة', story: 'أتلف أحد أبنائك مزرعة الجيران.', didYouKnow: 'المسلم يضمن ما أتلف.', ruling: 'ادفع 20 سهماً.', effect: { target: 'self', amount: -20 } },
  { id: 9, title: 'دين شخصي', story: 'حل موعد سداد دينك.', didYouKnow: 'أداء الحقوق واجب.', ruling: 'ادفع 10 أسهم.', effect: { target: 'self', amount: -10 } },
  { id: 10, title: 'مؤخر صداقك', story: 'حل موعد سداد مؤخر صداقك.', didYouKnow: 'الوفاء بالعقود.', ruling: 'ادفع 25 سهماً.', effect: { target: 'self', amount: -25 } },
  { id: 11, title: 'صدقة', story: 'كنت كثير الصدقة.', didYouKnow: 'ما نقص مال من صدقة.', ruling: 'صاحب أقل رصيد يحصل على 30 سهماً.', effect: { target: 'lowestBalance', amount: 30 } },
  { id: 12, title: 'بركة تجارة', story: 'بارك الله في تجارتك.', didYouKnow: 'الصدق سبب للبركة.', ruling: 'خذ 20 سهماً من البنك.', effect: { target: 'self', amount: 20 } },
  { id: 13, title: 'صلة الرحم', story: 'وصلت رحمك.', didYouKnow: 'صلة الرحم بركة.', ruling: 'خذ 5 أسهم من كل اللاعبين.', effect: { target: 'allOthersPayToSelf', amount: -5 } },
  { id: 14, title: 'بر الوالدين', story: 'أحسنت إلى والديك.', didYouKnow: 'بر الوالدين من أعظم القرب.', ruling: 'خذ 15 سهماً.', effect: { target: 'self', amount: 15 } },
  { id: 15, title: 'كفالة يتيم', story: 'شاركت في كفالة يتيم.', didYouKnow: 'كافل اليتيم له أجر عظيم.', ruling: 'ادفع 5 أسهم.', effect: { target: 'self', amount: -5 } },
  { id: 16, title: 'مطلقة', story: 'تعاونت الأسرة مع مطلقة من الأقارب.', didYouKnow: 'التكافل خلق كريم.', ruling: 'كل اللاعبين ما عدا أنت يدفعون 5 أسهم.', effect: { target: 'allExceptSelf', amount: -5 } },
  { id: 17, title: 'أرملة', story: 'ساعدت الأسرة أرملة.', didYouKnow: 'الإحسان للأرامل فضل.', ruling: 'اختر لاعبين يدفع كل منهما 5 أسهم.', effect: { target: 'chosenPlayers2', amount: -5 } },
  { id: 18, title: 'علاج قريب', story: 'احتاج قريب للعلاج.', didYouKnow: 'التعاون على البر.', ruling: 'كل لاعب يدفع 3 أسهم.', effect: { target: 'allPlayers', amount: -3 } },
  { id: 19, title: 'زواج قريب', story: 'ساهمت الأسرة في زواج قريب.', didYouKnow: 'التعاون من المروءة.', ruling: 'كل لاعب يدفع 5 أسهم.', effect: { target: 'allPlayers', amount: -5 } },
  { id: 20, title: 'حريق منزل قريب', story: 'ساهمت الأسرة في إعادة البناء.', didYouKnow: 'التكافل قوة.', ruling: 'كل لاعب يدفع 4 أسهم.', effect: { target: 'allPlayers', amount: -4 } },
  { id: 21, title: 'هدية', story: 'وصلتك هدية.', didYouKnow: 'الهدية تزيد المحبة.', ruling: 'خذ 10 أسهم.', effect: { target: 'self', amount: 10 } },
  { id: 22, title: 'ميراث جديد', story: 'ورثت قريباً آخر.', didYouKnow: 'رزق جديد.', ruling: 'خذ 20 سهماً.', effect: { target: 'self', amount: 20 } },
  { id: 23, title: 'مكافأة', story: 'حصلت على مكافأة.', didYouKnow: 'الإتقان له ثمرة.', ruling: 'خذ 15 سهماً.', effect: { target: 'self', amount: 15 } },
  { id: 24, title: 'استثمار', story: 'نجح استثمارك.', didYouKnow: 'حسن التدبير نعمة.', ruling: 'خذ 15 سهماً.', effect: { target: 'self', amount: 15 } },
  { id: 25, title: 'بيع أرض', story: 'ارتفعت قيمة أرضك.', didYouKnow: 'الرزق بيد الله.', ruling: 'خذ 20 سهماً.', effect: { target: 'self', amount: 20 } },
  { id: 26, title: 'قرض حسن', story: 'أقرضت محتاجاً.', didYouKnow: 'القرض الحسن أجر.', ruling: 'اختر لاعباً يدفع لك 10 أسهم.', effect: { target: 'chosenPlayer', amount: -10, selfAmount: 10 } },
  { id: 27, title: 'دين معسر', story: 'قضيت دين معسر.', didYouKnow: 'تفريج الكرب فضل.', ruling: 'خذ 10 أسهم.', effect: { target: 'self', amount: 10 } },
  { id: 28, title: 'أمانة', story: 'أديت أمانة.', didYouKnow: 'الأمانة خلق المؤمن.', ruling: 'خذ 15 سهماً.', effect: { target: 'self', amount: 15 } },
  { id: 29, title: 'خطأ حساب', story: 'اكتشفت خطأ بالحساب.', didYouKnow: 'التثبت مطلوب.', ruling: 'أول من يكتشفه يأخذ 10 أسهم.', effect: { target: 'firstToNotice', amount: 10 } },
  { id: 30, title: 'صدقة جماعية', story: 'اتفق الورثة على الصدقة.', didYouKnow: 'الخير جماعي.', ruling: 'كل لاعب يدفع 3 أسهم.', effect: { target: 'allPlayers', amount: -3 } },
  { id: 31, title: 'اللاعب على يمينك', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'ادفع له 5 أسهم.', effect: { target: 'rightNeighbor', amount: 5, selfAmount: -5 } },
  { id: 32, title: 'اللاعب على يسارك', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'خذ منه 5 أسهم.', effect: { target: 'leftNeighbor', amount: -5, selfAmount: 5 } },
  { id: 33, title: 'أكبر رصيد', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'يدفع 10 أسهم للبنك.', effect: { target: 'highestBalance', amount: -10 } },
  { id: 34, title: 'أقل رصيد', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'يحصل على 10 أسهم.', effect: { target: 'lowestBalance', amount: 10 } },
  { id: 35, title: 'اختر لاعباً', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'ليدفع 5 أسهم.', effect: { target: 'chosenPlayer', amount: -5, selfAmount: 5 } },
  { id: 36, title: 'اختر لاعباً', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'ليحصل على 5 أسهم منك.', effect: { target: 'chosenPlayer', amount: 5, selfAmount: -5 } },
  { id: 37, title: 'كل اللاعبين', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'يدفعون لك سهمين.', effect: { target: 'allOthersPayToSelf', amount: -2 } },
  { id: 38, title: 'كل اللاعبين ما عدا أنت', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'يدفعون 3 أسهم للبنك.', effect: { target: 'allExceptSelf', amount: -3 } },
  { id: 39, title: 'صاحب أكبر نصيب', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'يدفع 10 أسهم.', effect: { target: 'largestShareThisRound', amount: -10 } },
  { id: 40, title: 'صاحب أقل نصيب', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'يحصل على 10 أسهم.', effect: { target: 'smallestShareThisRound', amount: 10 } },
  { id: 41, title: 'العاقلة', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'أكبر عاصب يدفع 5 أسهم إضافية.', effect: { target: 'largestAqilahShare', amount: -5 } },
  { id: 42, title: 'العاقلة', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'أقل عاصب يعفى من الدفع.', effect: { target: 'none', amount: 0 } },
  { id: 43, title: 'تجارة', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'خسرت صفقة، ادفع 15 سهماً.', effect: { target: 'self', amount: -15 } },
  { id: 44, title: 'تبرع', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'تبرعت لبناء مسجد، ادفع 5 أسهم.', effect: { target: 'self', amount: -5 } },
  { id: 45, title: 'وقف', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'ساهمت في وقف خيري، ادفع 5 أسهم.', effect: { target: 'self', amount: -5 } },
  { id: 46, title: 'هبة', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'وهبك قريب مالاً، خذ 10 أسهم.', effect: { target: 'self', amount: 10 } },
  { id: 47, title: 'تعويض', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'أفسدت مال غيرك، ادفع 10 أسهم.', effect: { target: 'self', amount: -10 } },
  { id: 48, title: 'صلح', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'تصالحتم، استرد 5 أسهم.', effect: { target: 'self', amount: 5 } },
  { id: 49, title: 'تكافل', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'ساعدوا مريضاً، كل لاعب يدفع سهمين.', effect: { target: 'allPlayers', amount: -2 } },
  { id: 50, title: 'بركة', story: 'حدث طارئ أثناء الجولة.', didYouKnow: 'التعاون والعدل من مقاصد الشريعة.', ruling: 'رزقك الله رزقاً، خذ 10 أسهم.', effect: { target: 'self', amount: 10 } }
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
  disclaimer: 'هذه اللعبة أداة تعليمية مبسطة لتقريب مبادئ توزيع المواريث، ولا تُعد مرجعًا شرعيًا نهائيًا. يُرجى مراجعة عالم شرعي أو مختص في الفرائض في أي حالة واقعية.',
  judgmentIntro: 'تُنفذ جميع الأحكام بعد توزيع الميراث. لا تؤثر البطاقات في صحة القسمة الشرعية، وإنما تُطبق على أرصدة اللاعبين. البطاقات التعليمية تشرح الحكم بإيجاز.',
  judgmentTurnLabel: 'دور كشف الحكم:',
  judgmentRevealButton: 'اكشف البطاقة',
  judgmentChoosePlayer: 'اختر لاعبًا',
  judgmentChooseTwoPlayers: 'اختر لاعبين',
  judgmentApplyButton: 'تطبيق الحكم',
  judgmentContinueButton: 'متابعة'
};
