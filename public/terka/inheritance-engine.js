/* inheritance-engine.js — محرك حساب المواريث فقط. لا منطق واجهة هنا. */

// ---------- كسور بسيطة ----------
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

class Fraction {
  constructor(num, den = 1) {
    if (den < 0) { num = -num; den = -den; }
    const g = gcd(num, den);
    this.num = num / g;
    this.den = den / g;
  }
  static from(n) { return new Fraction(n, 1); }
  add(o) { return new Fraction(this.num * o.den + o.num * this.den, this.den * o.den); }
  sub(o) { return new Fraction(this.num * o.den - o.num * this.den, this.den * o.den); }
  mul(o) { return new Fraction(this.num * o.num, this.den * o.den); }
  compare(o) { // -1, 0, 1
    const l = this.num * o.den, r = o.num * this.den;
    return l < r ? -1 : (l > r ? 1 : 0);
  }
  isZero() { return this.num === 0; }
  toDecimal() { return this.num / this.den; }
  toString() {
    if (this.num === 0) return '0';
    return this.den === 1 ? `${this.num}` : `${this.num}/${this.den}`;
  }
}
const ZERO = new Fraction(0, 1);
const ONE = new Fraction(1, 1);

// ---------- أدوات مساعدة ----------
function countHeir(playedHeirIds, id) {
  return playedHeirIds.filter(h => h === id).length;
}

/**
 * يحسب توزيع التركة.
 * @param {object} caseObj - بطاقة حالة المتوفى (deceasedGender, disallowed...)
 * @param {string[]} playedHeirIds - قائمة معرفات الورثة التي لعبها اللاعبون (قد تتكرر)
 * @param {number} estateValue - قيمة التركة بالنقاط
 * @returns {object} نتيجة شاملة لكل وارث + حالة عامة
 */
function computeInheritance(caseObj, playedHeirIds, estateValue) {
  const result = {
    perHeirType: {}, // id -> { fraction, points, status, reason, count }
    caseNeedsReview: false,
    notes: [],
    undistributedPoints: 0,
    supported: true
  };

  const setHeir = (id, data) => { result.perHeirType[id] = Object.assign({ count: countHeir(playedHeirIds, id) }, data); };

  // تحقق أساسي: التوافق مع جنس المتوفى
  const hasHusband = countHeir(playedHeirIds, 'husband') > 0;
  const hasWife = countHeir(playedHeirIds, 'wife') > 0;
  if (caseObj.deceasedGender === 'male' && hasHusband) {
    setHeir('husband', { fraction: ZERO, points: 0, status: 'غير مناسب', reason: 'لا يمكن وجود زوج والمتوفى رجل.' });
  }
  if (caseObj.deceasedGender === 'female' && hasWife) {
    setHeir('wife', { fraction: ZERO, points: 0, status: 'غير مناسب', reason: 'لا يمكن وجود زوجة والمتوفاة امرأة.' });
  }

  const sonCount = countHeir(playedHeirIds, 'son');
  const daughterCount = countHeir(playedHeirIds, 'daughter');
  const fatherCount = countHeir(playedHeirIds, 'father');
  const motherCount = countHeir(playedHeirIds, 'mother');
  const brotherCount = countHeir(playedHeirIds, 'brother');
  const sisterCount = countHeir(playedHeirIds, 'sister');

  const hasSon = sonCount > 0;
  const hasDaughter = daughterCount > 0;
  const hasDescendant = hasSon || hasDaughter;
  const hasFather = fatherCount > 0;
  const hasMother = motherCount > 0;
  const siblingsCount = brotherCount + sisterCount;

  const fixed = {}; // id -> Fraction (المجموع لكل فئة)
  let fatherGetsResidue = false;

  // ---------- الزوج ----------
  if (caseObj.deceasedGender === 'female' && hasHusband) {
    const share = hasDescendant ? new Fraction(1, 4) : new Fraction(1, 2);
    fixed['husband'] = share;
  }
  // ---------- الزوجة (تُقسَّم على عدد الزوجات) ----------
  if (caseObj.deceasedGender === 'male' && hasWife) {
    const share = hasDescendant ? new Fraction(1, 8) : new Fraction(1, 4);
    fixed['wife'] = share;
  }

  // ---------- الأم ----------
  if (hasMother) {
    const share = (hasDescendant || siblingsCount >= 2) ? new Fraction(1, 6) : new Fraction(1, 3);
    fixed['mother'] = share;
  }

  // ---------- الأب ----------
  if (hasFather) {
    if (hasSon) {
      fixed['father'] = new Fraction(1, 6);
    } else if (hasDaughter) {
      fixed['father'] = new Fraction(1, 6);
      fatherGetsResidue = true;
    } else {
      fixed['father'] = ZERO;
      fatherGetsResidue = true;
    }
  }

  // ---------- البنت (فرض ثابت فقط إن لم يوجد ابن) ----------
  if (hasDaughter && !hasSon) {
    fixed['daughter'] = daughterCount === 1 ? new Fraction(1, 2) : new Fraction(2, 3);
  }

  // ---------- الإخوة الأشقاء ----------
  const siblingsBlocked = hasFather || hasSon;
  let siblingsResiduary = false;
  let siblingsNeedsReview = false;

  if (siblingsCount > 0) {
    if (siblingsBlocked) {
      const reason = hasFather ? 'محجوب لوجود الأب.' : 'محجوب لوجود الابن.';
      if (brotherCount > 0) setHeir('brother', { fraction: ZERO, points: 0, status: 'محجوب', reason });
      if (sisterCount > 0) setHeir('sister', { fraction: ZERO, points: 0, status: 'محجوب', reason });
    } else if (hasDaughter) {
      // حالة أخت/أخ مع بنت بلا أب ولا ابن: تعصيب مع الغير — غير مطبقة في هذه النسخة
      siblingsNeedsReview = true;
      result.caseNeedsReview = true;
      result.notes.push(TEXTS.needsReviewMessage + ' (اجتماع الإخوة مع البنت بدون أب أو ابن)');
      if (brotherCount > 0) setHeir('brother', { fraction: null, points: null, status: 'تحتاج مراجعة', reason: TEXTS.needsReviewMessage });
      if (sisterCount > 0) setHeir('sister', { fraction: null, points: null, status: 'تحتاج مراجعة', reason: TEXTS.needsReviewMessage });
    } else if (brotherCount > 0) {
      siblingsResiduary = true; // يُحسب مع الباقي لاحقًا
    } else {
      // أخوات فقط بلا إخوة ذكور: فرض ثابت
      fixed['sister'] = sisterCount === 1 ? new Fraction(1, 2) : new Fraction(2, 3);
    }
  }

  if (siblingsNeedsReview) {
    result.supported = false;
    return finalizeUnsupported(result, fixed, estateValue);
  }

  // ---------- مجموع الفروض ----------
  let sumFixed = ZERO;
  for (const key in fixed) sumFixed = sumFixed.add(fixed[key]);

  if (sumFixed.compare(ONE) > 0) {
    // عول: مجموع الفروض أكبر من التركة كاملة — غير مطبق في هذه النسخة
    result.caseNeedsReview = true;
    result.supported = false;
    result.notes.push(TEXTS.needsReviewMessage + ' (مجموع الفروض يتجاوز التركة كاملة - حالة عول)');
    return finalizeUnsupported(result, fixed, estateValue);
  }

  let leftover = ONE.sub(sumFixed);
  const fractions = Object.assign({}, fixed); // نسخة سنكمل عليها التوزيع التعصيبي

  // ---------- توزيع الباقي (التعصيب) ----------
  if (hasSon) {
    const totalShares = 2 * sonCount + 1 * daughterCount;
    if (totalShares > 0 && !leftover.isZero()) {
      fractions['son'] = leftover.mul(new Fraction(2, totalShares));
      if (hasDaughter) fractions['daughter'] = leftover.mul(new Fraction(1, totalShares));
    }
    leftover = ZERO;
  } else if (fatherGetsResidue) {
    fractions['father'] = (fractions['father'] || ZERO).add(leftover);
    leftover = ZERO;
  } else if (siblingsResiduary) {
    const totalShares = 2 * brotherCount + 1 * sisterCount;
    if (totalShares > 0 && !leftover.isZero()) {
      fractions['brother'] = leftover.mul(new Fraction(2, totalShares));
      if (sisterCount > 0) fractions['sister'] = leftover.mul(new Fraction(1, totalShares));
    }
    leftover = ZERO;
  }
  // إن بقي leftover > 0 هنا: لا يوجد عصبة معروفة، يبقى بدون توزيع (بدون رد)

  if (!leftover.isZero()) {
    result.notes.push(TEXTS.undistributedMessage);
  }

  // ---------- تحويل الكسور إلى نقاط (مع معالجة الكسر غير الصحيح) ----------
  const heirIdsInFractions = Object.keys(fractions);
  const rawPoints = {}; // id -> {floor, remainderNum, remainderDen, exactFraction}
  let totalAssignedFloor = 0;
  let totalRemainderFractions = []; // {id, remFraction}

  heirIdsInFractions.forEach(id => {
    const frac = fractions[id];
    const exact = frac.mul(new Fraction(estateValue, 1)); // نقاط دقيقة كسرية
    const floorVal = Math.floor(exact.num / exact.den);
    const remFraction = exact.sub(new Fraction(floorVal, 1));
    rawPoints[id] = { floorVal, remFraction, exact };
    totalAssignedFloor += floorVal;
  });

  const undistributedPoints = Math.round(leftover.mul(new Fraction(estateValue, 1)).toDecimal());
  let pointsToDistribute = estateValue - undistributedPoints - totalAssignedFloor;

  // توزيع الباقي (نظام أكبر باقي) إن وجدت نقاط كسرية غير موزعة
  if (pointsToDistribute > 0) {
    result.notes.push(TEXTS.unevenSplitMessage + ' تم استخدام نظام أكبر باقٍ لتقريب النقاط (تقريب تجريبي فقط).');
    const sorted = heirIdsInFractions
      .map(id => ({ id, rem: rawPoints[id].remFraction.toDecimal() }))
      .sort((a, b) => b.rem - a.rem);
    for (let i = 0; i < pointsToDistribute && i < sorted.length; i++) {
      rawPoints[sorted[i].id].floorVal += 1;
    }
  }

  heirIdsInFractions.forEach(id => {
    const heirType = getHeirType(id);
    const points = rawPoints[id].floorVal;
    const count = countHeir(playedHeirIds, id);
    let status = 'يرث';
    let reason = describeShareReason(id, fixed, fatherGetsResidue, hasSon, hasDaughter, siblingsResiduary);
    setHeir(id, { fraction: fractions[id], points, status, reason, perPersonPoints: count > 0 ? points / count : points });
  });

  result.undistributedPoints = undistributedPoints;
  return result;
}

function describeShareReason(id, fixed, fatherGetsResidue, hasSon, hasDaughter, siblingsResiduary) {
  switch (id) {
    case 'husband': return 'فرض الزوج (نصف أو ربع حسب وجود الفرع الوارث).';
    case 'wife': return 'فرض الزوجة (ربع أو ثمن حسب وجود الفرع الوارث)، مقسّم بين الزوجات إن تعددن.';
    case 'mother': return 'فرض الأم (سدس أو ثلث حسب وجود الفرع الوارث أو عدد الإخوة).';
    case 'father':
      if (hasSon) return 'فرض الأب: السدس مع وجود الابن.';
      if (hasDaughter) return 'فرض الأب السدس مع وجود البنت، بالإضافة إلى الباقي تعصيبًا.';
      return 'الأب يأخذ الباقي كله تعصيبًا لعدم وجود فرع وارث.';
    case 'son': return 'الابن عصبة، يأخذ الباقي (وللذكر مثل حظ الأنثيين مع البنت).';
    case 'daughter':
      return hasSon ? 'البنت تشارك إخوتها الأبناء في الباقي تعصيبًا.' : 'فرض البنت: النصف منفردة أو الثلثان مع أخواتها.';
    case 'brother':
      return siblingsResiduary ? 'الأخ الشقيق عصبة، يأخذ الباقي (وللذكر مثل حظ الأنثيين مع الأخت).' : 'الأخ الشقيق عصبة منفرد، يأخذ الباقي كله.';
    case 'sister':
      return siblingsResiduary ? 'الأخت الشقيقة تشارك أخاها في الباقي تعصيبًا.' : 'فرض الأخت الشقيقة: النصف منفردة أو الثلثان مع أخواتها.';
    default: return '';
  }
}

function finalizeUnsupported(result, fixed, estateValue) {
  // نعرض الفروض المعروفة فقط كمعلومة تقريبية، ونعلّم الحالة كاملة بأنها تحتاج مراجعة
  for (const id in fixed) {
    const exact = fixed[id].mul(new Fraction(estateValue, 1));
    result.perHeirType[id] = result.perHeirType[id] || {
      fraction: fixed[id],
      points: Math.round(exact.toDecimal()),
      status: 'تقريبي - تحتاج مراجعة',
      reason: TEXTS.needsReviewMessage,
      count: 0
    };
  }
  return result;
}

// ---------- اختبارات المحرك ----------
function runInheritanceTests() {
  const results = [];
  const assertEqual = (label, actual, expected) => {
    const pass = actual === expected;
    results.push({ label, actual, expected, pass });
    console.log(`${pass ? '✅' : '❌'} ${label}: توقّع ${expected} — حصل ${actual}`);
  };

  // اختبار 1
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['wife', 'son', 'daughter'], 24);
    assertEqual('اختبار1-الزوجة', r.perHeirType['wife'].points, 3);
    assertEqual('اختبار1-الابن', r.perHeirType['son'].points, 14);
    assertEqual('اختبار1-البنت', r.perHeirType['daughter'].points, 7);
  }
  // اختبار 2
  {
    const caseObj = { deceasedGender: 'female' };
    const r = computeInheritance(caseObj, ['husband', 'son', 'daughter'], 24);
    assertEqual('اختبار2-الزوج', r.perHeirType['husband'].points, 6);
    assertEqual('اختبار2-الابن', r.perHeirType['son'].points, 12);
    assertEqual('اختبار2-البنت', r.perHeirType['daughter'].points, 6);
  }
  // اختبار 3
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['wife', 'daughter'], 24);
    assertEqual('اختبار3-الزوجة', r.perHeirType['wife'].points, 3);
    assertEqual('اختبار3-البنت', r.perHeirType['daughter'].points, 12);
    assertEqual('اختبار3-الباقي_غير_موزع', r.undistributedPoints, 9);
  }
  // اختبار 4
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['son', 'brother', 'mother'], 24);
    assertEqual('اختبار4-الأم', r.perHeirType['mother'].points, 4);
    assertEqual('اختبار4-الأخ_محجوب', r.perHeirType['brother'].points, 0);
    assertEqual('اختبار4-الابن', r.perHeirType['son'].points, 20);
  }
  // اختبار 5
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['father', 'mother', 'son'], 24);
    assertEqual('اختبار5-الأب', r.perHeirType['father'].points, 4);
    assertEqual('اختبار5-الأم', r.perHeirType['mother'].points, 4);
    assertEqual('اختبار5-الابن', r.perHeirType['son'].points, 16);
  }
  // اختبار 6 (زوج + أم + أخ شقيق + أخت شقيقة، متوفاة امرأة)
  {
    const caseObj = { deceasedGender: 'female' };
    const r = computeInheritance(caseObj, ['husband', 'mother', 'brother', 'sister'], 24);
    const total = r.perHeirType['husband'].points + r.perHeirType['mother'].points +
      r.perHeirType['brother'].points + r.perHeirType['sister'].points + r.undistributedPoints;
    assertEqual('اختبار6-الزوج', r.perHeirType['husband'].points, 12);
    assertEqual('اختبار6-الأم', r.perHeirType['mother'].points, 4);
    assertEqual('اختبار6-مجموع_النقاط_يساوي_التركة', total, 24);
  }

  const passCount = results.filter(r => r.pass).length;
  console.log(`\nنتيجة الاختبارات: ${passCount}/${results.length} ناجحة`);
  return results;
}

// إتاحة الدوال عالميًا للاستخدام من app.js وللاختبار اليدوي من Console
if (typeof window !== 'undefined') {
  window.computeInheritance = computeInheritance;
  window.runInheritanceTests = runInheritanceTests;
  window.Fraction = Fraction;
}
