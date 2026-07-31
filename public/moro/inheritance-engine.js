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
  div(o) { return new Fraction(this.num * o.den, this.den * o.num); }
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
  const grandfatherCount = countHeir(playedHeirIds, 'grandfather');
  const grandmotherCount = countHeir(playedHeirIds, 'grandmother');
  const halfBrotherCount = countHeir(playedHeirIds, 'half-brother'); // أخ لأم
  const halfSisterCount = countHeir(playedHeirIds, 'half-sister'); // أخت لأم
  const uncleCount = countHeir(playedHeirIds, 'uncle');
  const grandsonCount = countHeir(playedHeirIds, 'grandson'); // ابن الابن
  const nephewCount = countHeir(playedHeirIds, 'nephew'); // ابن الأخ الشقيق
  const cousinCount = countHeir(playedHeirIds, 'cousin'); // ابن العم الشقيق

  const hasSon = sonCount > 0;
  const hasDaughter = daughterCount > 0;
  // ابن الابن يُحجب كليًا بوجود الابن نفسه (فرع أقرب في الدرجة)، ويقوم مقامه تمامًا فيما عدا
  // ذلك: تعصيب مع البنات، وحجب الإخوة/الأعمام، وخفض فرض الزوجين والأم — لذلك لا يُعتبَر
  // "نشطًا" (فرعًا واردًا فعليًا) إلا عند غياب الابن.
  const hasGrandson = grandsonCount > 0;
  const grandsonActive = hasGrandson && !hasSon;
  const hasDescendant = hasSon || hasDaughter || grandsonActive;
  const hasFather = fatherCount > 0;
  const hasMother = motherCount > 0;
  const siblingsCount = brotherCount + sisterCount;
  const hasGrandfather = grandfatherCount > 0;
  const hasGrandmother = grandmotherCount > 0;
  const hasUncle = uncleCount > 0;
  const hasNephew = nephewCount > 0;
  const hasCousin = cousinCount > 0;
  // "الفرع الوارث الذكر" الفعلي في المسألة: الابن إن وُجد، وإلا ابن الابن إن وُجد ولا ابن معه.
  const maleDescId = hasSon ? 'son' : (grandsonActive ? 'grandson' : null);
  const maleDescCount = hasSon ? sonCount : (grandsonActive ? grandsonCount : 0);

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
    const reducedToSixth = hasDescendant || siblingsCount >= 2;
    if (reducedToSixth) {
      fixed['mother'] = new Fraction(1, 6);
    } else if (hasFather && (hasHusband || hasWife)) {
      // المسألتان العُمَريتان (زوج/زوجة + أب + أم، بلا فرع وارث ولا إخوة معتبَرين):
      // الأم تأخذ ثلث ما تبقّى بعد نصيب الزوج/الزوجة، لا ثلث التركة كاملة (رأي الجمهور).
      const spouseShare = fixed['husband'] || fixed['wife'] || ZERO;
      fixed['mother'] = ONE.sub(spouseShare).mul(new Fraction(1, 3));
      result.notes.push('طُبّقت المسألة العُمَرية: نصيب الأم هنا ثلث الباقي بعد نصيب الزوج/الزوجة، وليس ثلث التركة كاملة.');
    } else {
      fixed['mother'] = new Fraction(1, 3);
    }
  }

  // ابن الابن محجوب كليًا بوجود الابن — يُسجَّل هنا صراحةً قبل أي استخدام آخر.
  if (hasGrandson && hasSon) {
    setHeir('grandson', { fraction: ZERO, points: 0, status: 'محجوب', reason: 'محجوب لوجود الابن (فرع أقرب في الدرجة).' });
  }

  // ---------- الأب ----------
  if (hasFather) {
    if (hasSon || grandsonActive) {
      fixed['father'] = new Fraction(1, 6);
    } else if (hasDaughter) {
      fixed['father'] = new Fraction(1, 6);
      fatherGetsResidue = true;
    } else {
      fixed['father'] = ZERO;
      fatherGetsResidue = true;
    }
  }

  // ---------- الجدة (لأم — أم الأم تحديدًا) ----------
  // تُحجب بالأم فقط. تنبيه: الجدة لأب (أم الأب) لها حكم حجب مختلف (تُحجب بالأب أيضًا لا بالأم
  // فقط)، وغير ممثَّلة بهذه البطاقة — البطاقة تمثّل الجدة لأم حصرًا (انظر وصفها في data.js).
  if (hasGrandmother) {
    if (hasMother) {
      setHeir('grandmother', { fraction: ZERO, points: 0, status: 'محجوب', reason: 'الجدة (لأم) محجوبة بوجود الأم.' });
    } else {
      fixed['grandmother'] = new Fraction(1, 6);
    }
  }

  // ---------- الجد (أب الأب) ----------
  // يُحجب كليًا بوجود الأب، ويقوم مقامه تمامًا فرضًا وتعصيبًا عند غيابه — إلا في حال اجتماعه
  // مع الإخوة الأشقاء بلا أب ولا ابن، وهي مسألة خلافية شهيرة بين الصحابة (أبو بكر: يحجبهم كالأب،
  // علي وزيد بن ثابت ومن تبعهم: مقاسمة) لا نرجّح فيها رأيًا — تُعرض كحالة تحتاج مراجعة.
  let grandfatherGetsResidue = false;
  let grandfatherSiblingsDispute = false;
  if (hasGrandfather) {
    if (hasFather) {
      setHeir('grandfather', { fraction: ZERO, points: 0, status: 'محجوب', reason: 'الجد محجوب بوجود الأب.' });
    } else if (siblingsCount > 0 && !hasSon && !grandsonActive) {
      grandfatherSiblingsDispute = true;
    } else if (hasSon || grandsonActive) {
      fixed['grandfather'] = new Fraction(1, 6);
    } else if (hasDaughter) {
      fixed['grandfather'] = new Fraction(1, 6);
      grandfatherGetsResidue = true;
    } else {
      fixed['grandfather'] = ZERO;
      grandfatherGetsResidue = true;
    }
  }

  if (grandfatherSiblingsDispute) {
    result.caseNeedsReview = true;
    result.supported = false;
    result.notes.push(TEXTS.needsReviewMessage + ' (اجتماع الجد مع الإخوة الأشقاء بلا أب ولا ابن - مسألة خلافية بين الصحابة)');
    setHeir('grandfather', { fraction: null, points: null, status: 'تحتاج مراجعة', reason: TEXTS.needsReviewMessage });
    if (brotherCount > 0) setHeir('brother', { fraction: null, points: null, status: 'تحتاج مراجعة', reason: TEXTS.needsReviewMessage });
    if (sisterCount > 0) setHeir('sister', { fraction: null, points: null, status: 'تحتاج مراجعة', reason: TEXTS.needsReviewMessage });
    // أي وريث آخر لُعب في هذه المسألة (بنت، إخوة لأم، عم، ابن أخ، ابن عم...) لم يُحسَب نصيبه
    // بعد عند هذه النقطة من الدالة — نصيبه الحقيقي غير محدَّد أصلًا ما دامت مسألة الجد
    // والإخوة خلافية، فيُعرَّف "تحتاج مراجعة" صراحةً بدل ما يظهر بلا نصيب وكأنه لا يرث إطلاقًا.
    [...new Set(playedHeirIds)].forEach(id => {
      if (!result.perHeirType[id]) {
        setHeir(id, { fraction: null, points: null, status: 'تحتاج مراجعة', reason: TEXTS.needsReviewMessage });
      }
    });
    return finalizeUnsupported(result, fixed, estateValue);
  }

  // ---------- البنت (فرض ثابت فقط إن لم يوجد فرع وارث ذكر: لا ابن ولا ابن ابن نشط) ----------
  if (hasDaughter && !hasSon && !grandsonActive) {
    fixed['daughter'] = daughterCount === 1 ? new Fraction(1, 2) : new Fraction(2, 3);
  }

  // ---------- الإخوة الأشقاء ----------
  const siblingsBlocked = hasFather || hasSon || grandsonActive;
  let siblingsResiduary = false;

  if (siblingsCount > 0) {
    if (siblingsBlocked) {
      const reason = hasFather ? 'محجوب لوجود الأب.' : hasSon ? 'محجوب لوجود الابن.' : 'محجوب لوجود ابن الابن.';
      if (brotherCount > 0) setHeir('brother', { fraction: ZERO, points: 0, status: 'محجوب', reason });
      if (sisterCount > 0) setHeir('sister', { fraction: ZERO, points: 0, status: 'محجوب', reason });
    } else if (hasDaughter || brotherCount > 0) {
      // مع وجود البنت بلا أب ولا ابن: الإخوة يصيرون عصبة — الأخ عصبة بنفسه كعادته،
      // والأخت "عصبة مع الغير" بقاعدة "أعصبوهن بالبنات" المتفَق عليها (ليست مسألة خلافية
      // كمسألة الجد والإخوة). يُحسبان معًا مع الباقي بنفس آلية siblingsResiduary أدناه،
      // سواء وُجدت بنت أم لا (فوجود الأخ وحده يكفي ليكون عصبة بنفسه بلا حاجة لبنت).
      siblingsResiduary = true;
    } else {
      // أخوات فقط بلا إخوة ذكور ولا بنت: فرض ثابت (لا عصبة هنا)
      fixed['sister'] = sisterCount === 1 ? new Fraction(1, 2) : new Fraction(2, 3);
    }
  }

  // ---------- الإخوة لأم (أولاد الأم) ----------
  // فرض مستقل تمامًا عن الإخوة الأشقاء: طبقة ميراث مختلفة (يرثون بصلة الأم لا الأب)، فلا
  // يتأثرون بوجود الإخوة الأشقاء أو حجبهم إطلاقًا. يُحجبون فقط بالفرع الوارث (ابن أو بنت -
  // أي فرع مطلقًا) وبالأصل الوارث الذكر (الأب والجد). ولا فرق بين الذكر والأنثى في القسمة
  // (بخلاف الإخوة الأشقاء): السدس لواحد منفرد، والثلث بالتساوي بين الجميع عند التعدد.
  const motherSiblingsCount = halfBrotherCount + halfSisterCount;
  if (motherSiblingsCount > 0) {
    if (hasDescendant || hasFather || hasGrandfather) {
      const reason = hasDescendant ? 'محجوب لوجود الفرع الوارث (ابن أو بنت).' : (hasFather ? 'محجوب لوجود الأب.' : 'محجوب لوجود الجد.');
      if (halfBrotherCount > 0) setHeir('half-brother', { fraction: ZERO, points: 0, status: 'محجوب', reason });
      if (halfSisterCount > 0) setHeir('half-sister', { fraction: ZERO, points: 0, status: 'محجوب', reason });
    } else {
      const share = motherSiblingsCount === 1 ? new Fraction(1, 6) : new Fraction(1, 3);
      if (halfBrotherCount > 0) fixed['half-brother'] = share.mul(new Fraction(halfBrotherCount, motherSiblingsCount));
      if (halfSisterCount > 0) fixed['half-sister'] = share.mul(new Fraction(halfSisterCount, motherSiblingsCount));
    }
  }

  // ---------- ترتيب العصبات الأبعد: ابن الأخ الشقيق، ثم العم الشقيق، ثم ابن العم الشقيق ----------
  // كل واحد منهم عصبة بنفسه، ويُحجب كليًا بالابن أو ابن الابن أو الأب أو الجد أو الإخوة
  // الأشقاء (أو الأخت التي صارت عصبة مع البنت — ضمن siblingsResiduary)، وأيضًا بمن هو أقرب
  // منه في هذا الترتيب (بنوة > أبوة > إخوة وبنوهم > أعمام وبنوهم). لا يُحجب أيٌّ منهم بالبنت
  // وحدها ولا بالأخوات فرضًا بلا إخوة ذكور — في الحالتين يأخذ الباقي بعدهنّ لعدم وجود عاصب أقرب.
  const nearerAsabaBlocked = hasSon || grandsonActive || hasFather || hasGrandfather || siblingsResiduary;

  const nephewBlocked = nearerAsabaBlocked;
  if (hasNephew && nephewBlocked) {
    const reason = hasSon ? 'محجوب لوجود الابن.' : grandsonActive ? 'محجوب لوجود ابن الابن.' : hasFather ? 'محجوب لوجود الأب.' : hasGrandfather ? 'محجوب لوجود الجد.' : 'محجوب لوجود الإخوة الأشقاء (أو من في مرتبتهم).';
    setHeir('nephew', { fraction: ZERO, points: 0, status: 'محجوب', reason });
  }
  const nephewActive = hasNephew && !nephewBlocked;

  const uncleBlocked = nearerAsabaBlocked || nephewActive;
  if (hasUncle && uncleBlocked) {
    const reason = hasSon ? 'محجوب لوجود الابن.' : grandsonActive ? 'محجوب لوجود ابن الابن.' : hasFather ? 'محجوب لوجود الأب.' : hasGrandfather ? 'محجوب لوجود الجد.' : nephewActive ? 'محجوب لوجود ابن الأخ الشقيق (أقرب درجة في ترتيب العصبات).' : 'محجوب لوجود الإخوة الأشقاء (أو من في مرتبتهم).';
    setHeir('uncle', { fraction: ZERO, points: 0, status: 'محجوب', reason });
  }
  const uncleActive = hasUncle && !uncleBlocked;

  const cousinBlocked = nearerAsabaBlocked || nephewActive || uncleActive;
  if (hasCousin && cousinBlocked) {
    const reason = hasSon ? 'محجوب لوجود الابن.' : grandsonActive ? 'محجوب لوجود ابن الابن.' : hasFather ? 'محجوب لوجود الأب.' : hasGrandfather ? 'محجوب لوجود الجد.' : nephewActive ? 'محجوب لوجود ابن الأخ الشقيق.' : uncleActive ? 'محجوب لوجود العم الشقيق (أقرب درجة في ترتيب العصبات).' : 'محجوب لوجود الإخوة الأشقاء (أو من في مرتبتهم).';
    setHeir('cousin', { fraction: ZERO, points: 0, status: 'محجوب', reason });
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
  if (maleDescId) {
    // إجمالي حصة كل نوع (الأبناء/بني الابن مجتمعين، والبنات مجتمعات) لا حصة فرد واحد فقط —
    // لازم ضرب العدد في وزن كل فرد (2 للذكر، 1 للبنت)، لا رقمًا ثابتًا.
    const totalShares = 2 * maleDescCount + 1 * daughterCount;
    if (totalShares > 0 && !leftover.isZero()) {
      fractions[maleDescId] = leftover.mul(new Fraction(2 * maleDescCount, totalShares));
      if (hasDaughter) fractions['daughter'] = leftover.mul(new Fraction(daughterCount, totalShares));
    }
    leftover = ZERO;
  } else if (fatherGetsResidue) {
    fractions['father'] = (fractions['father'] || ZERO).add(leftover);
    leftover = ZERO;
  } else if (grandfatherGetsResidue) {
    fractions['grandfather'] = (fractions['grandfather'] || ZERO).add(leftover);
    leftover = ZERO;
  } else if (siblingsResiduary) {
    // نفس مبدأ الأبناء/البنات أعلاه: الإجمالي لكل نوع، لا حصة فرد واحد.
    const totalShares = 2 * brotherCount + 1 * sisterCount;
    if (totalShares > 0 && !leftover.isZero()) {
      fractions['brother'] = leftover.mul(new Fraction(2 * brotherCount, totalShares));
      if (sisterCount > 0) fractions['sister'] = leftover.mul(new Fraction(sisterCount, totalShares));
    }
    leftover = ZERO;
  } else if (nephewActive) {
    if (!leftover.isZero()) fractions['nephew'] = leftover;
    leftover = ZERO;
  } else if (uncleActive) {
    if (!leftover.isZero()) fractions['uncle'] = leftover;
    leftover = ZERO;
  } else if (hasCousin && !cousinBlocked) {
    if (!leftover.isZero()) fractions['cousin'] = leftover;
    leftover = ZERO;
  }
  // إن بقي leftover > 0 هنا: لا يوجد عصبة معروفة — يُرَدّ الباقي على أصحاب الفروض (عدا
  // الزوجين، لا يستحقان الرد باتفاق جمهور من يقول به) بنسبة فروضهم الأصلية فيما بينهم.
  // رأي جمهور الفقهاء المعاصرين ومعظم قوانين الأحوال الشخصية في الدول الإسلامية.
  const raddedIds = new Set();
  if (!leftover.isZero()) {
    const raddEligibleIds = Object.keys(fixed).filter(id => id !== 'husband' && id !== 'wife' && !fixed[id].isZero());
    let raddBase = ZERO;
    raddEligibleIds.forEach(id => { raddBase = raddBase.add(fixed[id]); });
    if (raddEligibleIds.length > 0 && !raddBase.isZero()) {
      raddEligibleIds.forEach(id => {
        const share = fixed[id].div(raddBase).mul(leftover);
        fractions[id] = (fractions[id] || ZERO).add(share);
        raddedIds.add(id);
      });
      result.notes.push(TEXTS.raddMessage || 'تم ردّ الباقي على أصحاب الفروض (عدا الزوجين) بنسبة فروضهم الأصلية، لعدم وجود عصبة معروفة.');
      leftover = ZERO;
    }
  }

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
    let reason = describeShareReason(id, fixed, fatherGetsResidue, hasSon, hasDaughter, siblingsResiduary, brotherCount > 0, motherSiblingsCount, grandsonActive);
    let originalFraction = null;
    let originalPoints = null;
    let raddPoints = null;
    if (raddedIds.has(id)) {
      originalFraction = fixed[id];
      originalPoints = Math.floor(originalFraction.mul(new Fraction(estateValue, 1)).toDecimal());
      raddPoints = points - originalPoints;
      reason += ` زاد نصيبه بالرد: أصله ${originalFraction.toString()} (${originalPoints} سهم) + حصته من الباقي (${raddPoints} سهم) = ${points} سهم، لعدم وجود عصبة.`;
    }
    setHeir(id, { fraction: fractions[id], points, status, reason, perPersonPoints: count > 0 ? points / count : points, originalFraction, originalPoints, raddPoints });
  });

  result.undistributedPoints = undistributedPoints;
  return result;
}

function describeShareReason(id, fixed, fatherGetsResidue, hasSon, hasDaughter, siblingsResiduary, hasBrother, motherSiblingsCount, grandsonActive) {
  switch (id) {
    case 'half-brother':
    case 'half-sister':
      return motherSiblingsCount === 1
        ? 'فرض الإخوة لأم: السدس لواحد منفرد (ذكرًا كان أو أنثى، لا فرق بينهما هنا).'
        : 'فرض الإخوة لأم: الثلث يُقسَّم بالتساوي بين جميع الإخوة لأم دون تفضيل للذكر على الأنثى.';
    case 'uncle': return 'العم الشقيق عصبة بنفسه، يأخذ الباقي كله بعد أصحاب الفروض لعدم وجود عاصب أقرب منه.';
    case 'nephew': return 'ابن الأخ الشقيق عصبة بنفسه، يأخذ الباقي كله لعدم وجود عاصب أقرب منه (أقرب درجة من العم في ترتيب العصبات).';
    case 'cousin': return 'ابن العم الشقيق عصبة بنفسه، يأخذ الباقي كله لعدم وجود عاصب أقرب منه (آخر مرتبة معتمدة في هذا النظام المبسّط).';
    case 'husband': return 'فرض الزوج (نصف أو ربع حسب وجود الفرع الوارث).';
    case 'wife': return 'فرض الزوجة (ربع أو ثمن حسب وجود الفرع الوارث)، مقسّم بين الزوجات إن تعددن.';
    case 'mother': return 'فرض الأم (سدس أو ثلث حسب وجود الفرع الوارث أو عدد الإخوة).';
    case 'father':
      if (hasSon || grandsonActive) return 'فرض الأب: السدس مع وجود الابن أو ابن الابن.';
      if (hasDaughter) return 'فرض الأب السدس مع وجود البنت، بالإضافة إلى الباقي تعصيبًا.';
      return 'الأب يأخذ الباقي كله تعصيبًا لعدم وجود فرع وارث.';
    case 'grandmother': return 'فرض الجدة لأم: السدس عند عدم وجود الأم (تُحجب كليًا بوجودها).';
    case 'grandfather':
      if (hasSon || grandsonActive) return 'فرض الجد: السدس مع وجود الابن أو ابن الابن (يقوم مقام الأب تمامًا لغيابه).';
      if (hasDaughter) return 'فرض الجد السدس مع وجود البنت، بالإضافة إلى الباقي تعصيبًا (كالأب تمامًا لغيابه).';
      return 'الجد يأخذ الباقي كله تعصيبًا لعدم وجود فرع وارث ولا أب.';
    case 'son': return 'الابن عصبة، يأخذ الباقي (وللذكر مثل حظ الأنثيين مع البنت).';
    case 'grandson': return 'ابن الابن يقوم مقام الابن تمامًا عند غيابه: عصبة، يأخذ الباقي (وللذكر مثل حظ الأنثيين مع البنت).';
    case 'daughter':
      return (hasSon || grandsonActive) ? 'البنت تشارك إخوتها (الأبناء أو بني الابن) في الباقي تعصيبًا.' : 'فرض البنت: النصف منفردة أو الثلثان مع أخواتها.';
    case 'brother':
      if (!siblingsResiduary) return 'الأخ الشقيق عصبة منفرد، يأخذ الباقي كله.';
      return hasDaughter
        ? 'الأخ الشقيق عصبة بنفسه، يأخذ الباقي بعد فرض البنت (وللذكر مثل حظ الأنثيين مع الأخت إن وُجدت).'
        : 'الأخ الشقيق عصبة، يأخذ الباقي (وللذكر مثل حظ الأنثيين مع الأخت).';
    case 'sister':
      if (!siblingsResiduary) return 'فرض الأخت الشقيقة: النصف منفردة أو الثلثان مع أخواتها.';
      if (!hasBrother) return 'الأخت الشقيقة "عصبة مع الغير": تصير عصبة بمشاركة البنت فتأخذ الباقي بعد فرضها (قاعدة "أعصبوهن بالبنات" المتفق عليها).';
      return 'الأخت الشقيقة تشارك أخاها في الباقي تعصيبًا.';
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
    assertEqual('اختبار3-البنت_بعد_الرد', r.perHeirType['daughter'].points, 21);
    assertEqual('اختبار3-الباقي_غير_موزع', r.undistributedPoints, 0);
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

  // اختبار 7 (المسألتان العُمَريتان: زوج/زوجة + أب + أم، بلا فرع وارث ولا إخوة)
  {
    const caseObj1 = { deceasedGender: 'female' };
    const r1 = computeInheritance(caseObj1, ['husband', 'father', 'mother'], 24);
    assertEqual('اختبار7-عمرية1-الزوج', r1.perHeirType['husband'].points, 12);
    assertEqual('اختبار7-عمرية1-الأم', r1.perHeirType['mother'].points, 4);
    assertEqual('اختبار7-عمرية1-الأب', r1.perHeirType['father'].points, 8);

    const caseObj2 = { deceasedGender: 'male' };
    const r2 = computeInheritance(caseObj2, ['wife', 'father', 'mother'], 24);
    assertEqual('اختبار7-عمرية2-الزوجة', r2.perHeirType['wife'].points, 6);
    assertEqual('اختبار7-عمرية2-الأم', r2.perHeirType['mother'].points, 6);
    assertEqual('اختبار7-عمرية2-الأب', r2.perHeirType['father'].points, 12);
  }

  // اختبار 8 (الجد يقوم مقام الأب تمامًا عند غيابه، بلا فرع وارث ولا إخوة)
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['grandfather'], 24);
    assertEqual('اختبار8-الجد_يأخذ_الباقي_كالأب', r.perHeirType['grandfather'].points, 24);
  }
  // اختبار 9 (الجد محجوب كليًا بوجود الأب)
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['father', 'grandfather'], 24);
    assertEqual('اختبار9-الأب', r.perHeirType['father'].points, 24);
    assertEqual('اختبار9-الجد_محجوب_نقاط', r.perHeirType['grandfather'].points, 0);
    assertEqual('اختبار9-الجد_محجوب_حالة', r.perHeirType['grandfather'].status, 'محجوب');
  }
  // اختبار 10 (الجدة محجوبة كليًا بوجود الأم)
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['mother', 'grandmother'], 24);
    assertEqual('اختبار10-الأم_بعد_الرد', r.perHeirType['mother'].points, 24);
    assertEqual('اختبار10-الجدة_محجوبة_نقاط', r.perHeirType['grandmother'].points, 0);
    assertEqual('اختبار10-الجدة_محجوبة_حالة', r.perHeirType['grandmother'].status, 'محجوب');
  }
  // اختبار 11 (الجدة تأخذ السدس عند غياب الأم)
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['grandmother', 'son'], 24);
    assertEqual('اختبار11-الجدة_السدس', r.perHeirType['grandmother'].points, 4);
    assertEqual('اختبار11-الابن_الباقي', r.perHeirType['son'].points, 20);
  }
  // اختبار 12 (اجتماع الجد مع الإخوة الأشقاء بلا أب ولا ابن: مسألة خلافية - تحتاج مراجعة)
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['grandfather', 'brother'], 24);
    assertEqual('اختبار12-الجد_تحتاج_مراجعة', r.perHeirType['grandfather'].status, 'تحتاج مراجعة');
    assertEqual('اختبار12-الأخ_تحتاج_مراجعة', r.perHeirType['brother'].status, 'تحتاج مراجعة');
    assertEqual('اختبار12-الحالة_غير_مدعومة', r.supported, false);
  }

  // اختبار 13 (تصحيح: مجموع حصة عدة أبناء/إخوة يجب أن يُحسب كإجمالي، لا حصة فرد واحد فقط)
  {
    const caseObj = { deceasedGender: 'male' };
    const r1 = computeInheritance(caseObj, ['son', 'son'], 12);
    assertEqual('اختبار13-ابنان_ياخذان_كل_الباقي', r1.perHeirType['son'].points, 12);

    const r2 = computeInheritance(caseObj, ['brother', 'brother'], 12);
    assertEqual('اختبار13-أخوان_ياخذان_كل_الباقي', r2.perHeirType['brother'].points, 12);
  }

  // اختبار 14 (تصحيح: اجتماع الإخوة مع البنت بلا أب ولا ابن ليست مسألة خلافية —
  // الأخت "عصبة مع الغير" بقاعدة "أعصبوهن بالبنات" المتفَق عليها، والأخ عصبة بنفسه كعادته)
  {
    const caseObj = { deceasedGender: 'male' };
    // بنت واحدة + أختان شقيقتان: البنت النصف، والأختان تقتسمان الباقي (النصف) بينهما بالتساوي (ربع لكل واحدة)
    const r1 = computeInheritance(caseObj, ['daughter', 'sister', 'sister'], 24);
    assertEqual('اختبار14-بنت_مع_أختين-البنت', r1.perHeirType['daughter'].points, 12);
    assertEqual('اختبار14-بنت_مع_أختين-الأختان', r1.perHeirType['sister'].points, 12);
    assertEqual('اختبار14-بنت_مع_أختين-مدعومة', r1.supported, true);

    // بنت واحدة + أخ شقيق: البنت النصف، والأخ عصبة بنفسه يأخذ الباقي (النصف) كاملًا
    const r2 = computeInheritance(caseObj, ['daughter', 'brother'], 24);
    assertEqual('اختبار14-بنت_مع_أخ-البنت', r2.perHeirType['daughter'].points, 12);
    assertEqual('اختبار14-بنت_مع_أخ-الأخ', r2.perHeirType['brother'].points, 12);
  }

  // اختبار 15 (الإخوة لأم: فرض مستقل تمامًا عن الإخوة الأشقاء، يُحجب بالفرع الوارث/الأب/الجد فقط)
  {
    const caseObj = { deceasedGender: 'male' };
    // محجوب بوجود الابن
    const r1 = computeInheritance(caseObj, ['son', 'half-brother'], 24);
    assertEqual('اختبار15-محجوب_بالابن_نقاط', r1.perHeirType['half-brother'].points, 0);
    assertEqual('اختبار15-محجوب_بالابن_حالة', r1.perHeirType['half-brother'].status, 'محجوب');

    // منفرد يأخذ السدس، ولا يتأثر بوجود أخ شقيق (طبقة ميراث مختلفة تمامًا)
    const r2 = computeInheritance(caseObj, ['half-brother', 'brother'], 24);
    assertEqual('اختبار15-منفرد_السدس', r2.perHeirType['half-brother'].points, 4);
    assertEqual('اختبار15-الشقيق_غير_متأثر', r2.perHeirType['brother'].points, 20);

    // أخ لأم + أختان لأم: يقتسمون الثلث بالتساوي بينهم (لا فرق بين ذكر وأنثى)
    const r3 = computeInheritance(caseObj, ['half-brother', 'half-sister', 'half-sister'], 36);
    assertEqual('اختبار15-جماعة_الأخ_لأم_بعد_الرد', r3.perHeirType['half-brother'].points, 12);
    assertEqual('اختبار15-جماعة_الأخت_لأم_بعد_الرد', r3.perHeirType['half-sister'].points, 24);
  }

  // اختبار 16 (العم: عصبة بنفسه، يُحجب بالابن/الأب/الجد/الإخوة الأشقاء، يرث الباقي عند عدم وجود عاصب أقرب)
  {
    const caseObj = { deceasedGender: 'male' };
    // محجوب بوجود الابن
    const r1 = computeInheritance(caseObj, ['son', 'uncle'], 24);
    assertEqual('اختبار16-محجوب_بالابن_نقاط', r1.perHeirType['uncle'].points, 0);
    assertEqual('اختبار16-محجوب_بالابن_حالة', r1.perHeirType['uncle'].status, 'محجوب');

    // منفردًا (بلا فرع وارث ولا أب ولا جد ولا إخوة) يأخذ التركة كاملة
    const r2 = computeInheritance(caseObj, ['uncle'], 24);
    assertEqual('اختبار16-العم_منفردًا', r2.perHeirType['uncle'].points, 24);

    // لا يُحجب بالبنت وحدها: يأخذ الباقي بعد فرضها
    const r3 = computeInheritance(caseObj, ['daughter', 'uncle'], 24);
    assertEqual('اختبار16-البنت', r3.perHeirType['daughter'].points, 12);
    assertEqual('اختبار16-العم_بعد_البنت', r3.perHeirType['uncle'].points, 12);

    // محجوب بوجود الأخ الشقيق (طبقة أعلى في ترتيب العصبات)
    const r4 = computeInheritance(caseObj, ['brother', 'uncle'], 24);
    assertEqual('اختبار16-محجوب_بالأخ_نقاط', r4.perHeirType['uncle'].points, 0);
    assertEqual('اختبار16-الأخ_ياخذ_الكل', r4.perHeirType['brother'].points, 24);
  }

  // اختبار 17 (ابن الابن: يقوم مقام الابن تمامًا عند غيابه، ويُحجب كليًا بوجوده)
  {
    const caseObj = { deceasedGender: 'male' };
    const r1 = computeInheritance(caseObj, ['grandson'], 24);
    assertEqual('اختبار17-ابن_الابن_منفردًا', r1.perHeirType['grandson'].points, 24);

    const r2 = computeInheritance(caseObj, ['son', 'grandson'], 24);
    assertEqual('اختبار17-محجوب_بالابن_نقاط', r2.perHeirType['grandson'].points, 0);
    assertEqual('اختبار17-محجوب_بالابن_حالة', r2.perHeirType['grandson'].status, 'محجوب');
    assertEqual('اختبار17-الابن_ياخذ_الكل', r2.perHeirType['son'].points, 24);

    // تعصيب مع البنت بنفس منطق الابن (للذكر مثل حظ الأنثيين)
    const r3 = computeInheritance(caseObj, ['grandson', 'daughter'], 24);
    assertEqual('اختبار17-ابن_الابن_مع_بنت', r3.perHeirType['grandson'].points, 16);
    assertEqual('اختبار17-البنت_تعصيب', r3.perHeirType['daughter'].points, 8);

    // يحجب الإخوة الأشقاء والإخوة لأم مثل الابن تمامًا
    const r4 = computeInheritance(caseObj, ['grandson', 'brother'], 24);
    assertEqual('اختبار17-الأخ_محجوب_بابن_الابن', r4.perHeirType['brother'].points, 0);
    assertEqual('اختبار17-الأخ_محجوب_حالة', r4.perHeirType['brother'].status, 'محجوب');

    // يخفّض فرض الزوجة والأم مثل الابن تمامًا (فرع وارث)
    const r5 = computeInheritance(caseObj, ['wife', 'grandson'], 24);
    assertEqual('اختبار17-الزوجة_الثمن', r5.perHeirType['wife'].points, 3);
  }

  // اختبار 18 (ابن الأخ الشقيق: عصبة بنفسه، أقرب درجة من العم، يُحجب بمن هو أقرب منه)
  {
    const caseObj = { deceasedGender: 'male' };
    const r1 = computeInheritance(caseObj, ['nephew'], 24);
    assertEqual('اختبار18-ابن_الأخ_منفردًا', r1.perHeirType['nephew'].points, 24);

    const r2 = computeInheritance(caseObj, ['brother', 'nephew'], 24);
    assertEqual('اختبار18-محجوب_بالأخ_نقاط', r2.perHeirType['nephew'].points, 0);
    assertEqual('اختبار18-محجوب_بالأخ_حالة', r2.perHeirType['nephew'].status, 'محجوب');

    // يحجب العم لأنه أقرب درجة منه في ترتيب العصبات
    const r3 = computeInheritance(caseObj, ['nephew', 'uncle'], 24);
    assertEqual('اختبار18-ابن_الأخ_ياخذ_الكل', r3.perHeirType['nephew'].points, 24);
    assertEqual('اختبار18-العم_محجوب_بابن_الأخ', r3.perHeirType['uncle'].points, 0);

    // محجوب بالأب أيضًا (لا بالإخوة فقط)
    const r4 = computeInheritance(caseObj, ['father', 'nephew'], 24);
    assertEqual('اختبار18-محجوب_بالأب_نقاط', r4.perHeirType['nephew'].points, 0);
    assertEqual('اختبار18-محجوب_بالأب_حالة', r4.perHeirType['nephew'].status, 'محجوب');
  }

  // اختبار 19 (ابن العم الشقيق: آخر مرتبة معتمدة، يُحجب بالعم وبكل من سبقه)
  {
    const caseObj = { deceasedGender: 'male' };
    const r1 = computeInheritance(caseObj, ['cousin'], 24);
    assertEqual('اختبار19-ابن_العم_منفردًا', r1.perHeirType['cousin'].points, 24);

    const r2 = computeInheritance(caseObj, ['uncle', 'cousin'], 24);
    assertEqual('اختبار19-محجوب_بالعم_نقاط', r2.perHeirType['cousin'].points, 0);
    assertEqual('اختبار19-العم_ياخذ_الكل', r2.perHeirType['uncle'].points, 24);

    // يُحجب بابن الأخ وحده حتى بلا عم (أقرب درجة منه أيضًا)
    const r3 = computeInheritance(caseObj, ['nephew', 'cousin'], 24);
    assertEqual('اختبار19-محجوب_بابن_الأخ_نقاط', r3.perHeirType['cousin'].points, 0);
    assertEqual('اختبار19-ابن_الأخ_ياخذ_الكل', r3.perHeirType['nephew'].points, 24);
  }

  // اختبار 20 (مسألة الجد + الإخوة الخلافية: كل وريث آخر لُعب معهم يُعلَّم "تحتاج مراجعة"
  // صراحةً، لا يظهر بلا نصيب وكأنه لا يرث إطلاقًا — تصحيح ثغرة اكتُشفت بالمراجعة الفقهية)
  {
    const caseObj = { deceasedGender: 'male' };
    const r = computeInheritance(caseObj, ['grandfather', 'brother', 'daughter', 'uncle', 'nephew'], 24);
    assertEqual('اختبار20-البنت_تحتاج_مراجعة', r.perHeirType['daughter'].status, 'تحتاج مراجعة');
    assertEqual('اختبار20-العم_تحتاج_مراجعة', r.perHeirType['uncle'].status, 'تحتاج مراجعة');
    assertEqual('اختبار20-ابن_الأخ_تحتاج_مراجعة', r.perHeirType['nephew'].status, 'تحتاج مراجعة');
    assertEqual('اختبار20-الحالة_غير_مدعومة', r.supported, false);
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
