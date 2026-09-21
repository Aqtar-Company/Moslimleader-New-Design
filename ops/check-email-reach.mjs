/**
 * Why an email broadcast reaches 69 people out of 2142 — measured, not guessed.
 *
 *   cd /home/moslimleader.com/app && node ops/check-email-reach.mjs
 *
 * Reads only. Writes nothing, sends nothing.
 *
 * Two gates decide who can be mailed, and both are there for a reason: an unverified
 * address is the one that bounces, and a bounce rate this size is what makes Gmail start
 * filing the SHOP's order mail as spam. So the answer is never to remove a gate — it is to
 * find out why so few members pass it.
 *
 * The distinction this prints and no summary count can: a member who never had a
 * verification to complete (signed in with Google, or was created before the flow existed)
 * is not the same as one who was sent a verification and ignored it. The first is a gap in
 * the data, fixable at once. The second is a gap in the flow, and means the mail is not
 * arriving or the moment is not being asked for.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const pct = (n, of) => of ? `${(n / of * 100).toFixed(1)}%` : '—';
const bar = (n, of, width = 28) => {
  const filled = of ? Math.round((n / of) * width) : 0;
  return '█'.repeat(filled) + '·'.repeat(width - filled);
};

try {
  const total = await prisma.user.count();
  const [verified, optIn, bothGates] = await Promise.all([
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { marketingOptIn: true } }),
    prisma.user.count({ where: { emailVerified: true, marketingOptIn: true } }),
  ]);

  console.log('═══ من يمكن مراسلته اليوم ═══\n');
  console.log(`  الأعضاء                 ${String(total).padStart(5)}  ${bar(total, total)}`);
  console.log(`  عنوانه موثَّق            ${String(verified).padStart(5)}  ${bar(verified, total)}  ${pct(verified, total)}`);
  console.log(`  وافق على التسويق        ${String(optIn).padStart(5)}  ${bar(optIn, total)}  ${pct(optIn, total)}`);
  console.log(`  الاثنان معًا            ${String(bothGates).padStart(5)}  ${bar(bothGates, total)}  ${pct(bothGates, total)}`);
  console.log('\n  رسالة خدمية تصل إلى:', verified, '— وإعلانٌ ترويجي إلى:', bothGates);

  // ── Why are they unverified? The three cases mean different things ────────────────────
  const unverified = { where: { emailVerified: false } };
  const [neverAsked, pending, expired, oauth] = await Promise.all([
    prisma.user.count({ where: { emailVerified: false, verificationToken: null } }),
    prisma.user.count({ where: { emailVerified: false, verificationToken: { not: null }, verificationTokenExpiry: { gt: new Date() } } }),
    prisma.user.count({ where: { emailVerified: false, verificationToken: { not: null }, verificationTokenExpiry: { lte: new Date() } } }),
    prisma.user.count({ where: { emailVerified: false, passwordHash: '' } }).catch(() => 0),
  ]);

  console.log('\n═══ غير الموثَّقين: لماذا ═══\n');
  console.log(`  بلا رمز تحقّقٍ أصلًا       ${String(neverAsked).padStart(5)}  ← لم يُطلب منهم التوثيق قط`);
  console.log(`  رمزٌ ما زال صالحًا         ${String(pending).padStart(5)}  ← أُرسل ولم يُفتح بعد`);
  console.log(`  رمزٌ انتهت صلاحيته        ${String(expired).padStart(5)}  ← أُرسل، ومضى الوقت`);
  if (oauth) console.log(`  (منهم بلا كلمة مرور      ${String(oauth).padStart(5)}  ← دخلوا بجوجل/فيسبوك)`);

  console.log('\n  الفرق هنا هو كل شيء:');
  if (neverAsked > pending + expired) {
    console.log('  الأغلبية لم تُطلب منهم أصلًا. فالعطل ليس في وصول البريد — هؤلاء حسابات');
    console.log('  أُنشئت قبل وجود التوثيق، أو بجوجل. أرسِل لهم طلبَ توثيقٍ مرةً واحدة.');
  } else if (expired > pending) {
    console.log('  الأغلبية أُرسل لهم ومضت المدة. إمّا أن البريد لا يصل (سبام)، وإمّا أن');
    console.log('  المدة قصيرة على من يقرأ بريده متأخرًا. افحص الاثنين.');
  } else {
    console.log('  الأغلبية أُرسل لهم وما زال الرمز صالحًا. راقبهم يومين: إن بقوا كما هم،');
    console.log('  فالبريد لا يصل — ابدأ بمجلد السبام عند جيميل.');
  }

  // ── Is this getting better or worse? ─────────────────────────────────────────────────
  const now = Date.now();
  const spans = [[30, 'آخر ٣٠ يومًا'], [90, 'آخر ٩٠ يومًا'], [365, 'آخر سنة']];
  console.log('\n═══ هل الوضع يتحسّن؟ (حسب تاريخ التسجيل) ═══\n');
  for (const [days, label] of spans) {
    const since = new Date(now - days * 864e5);
    const [n, v, m] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.user.count({ where: { createdAt: { gte: since }, emailVerified: true } }),
      prisma.user.count({ where: { createdAt: { gte: since }, marketingOptIn: true } }),
    ]);
    console.log(`  ${label.padEnd(14)} سجّلوا ${String(n).padStart(5)}   موثَّق ${String(v).padStart(4)} (${pct(v, n)})   وافق ${String(m).padStart(4)} (${pct(m, n)})`);
  }
  console.log('\n  إن كانت نسبة آخر ٣٠ يومًا قريبةً من نسبة السنة، فالعطل قائمٌ الآن، لا إرثًا قديمًا.');

  // ── The bounce risk, stated plainly ──────────────────────────────────────────────────
  console.log('\n═══ ماذا لو تجاهلنا البوابتين ═══\n');
  console.log(`  إرسالٌ لكل الأعضاء يعني ${total - verified} عنوانًا لم يُثبت أحدٌ أنه حقيقي.`);
  console.log('  جيميل يقيس نسبة الارتداد على الدومين كله — لا على طريق وحدها. وأول ما');
  console.log('  ترتفع، تبدأ رسائل أوردرات المتجر تسقط في السبام. البوابة تحمي المتجر،');
  console.log('  فالحل رفعُ عدد من يعبرها، لا إزالتها.');

  console.log('\n═══ ما يستحق الفحص بعد هذا ═══\n');
  console.log('  ١. هل يصل إيميل التوثيق أصلًا؟ سجّل بعنوان جيميل جديد وراقب السبام.');
  console.log('  ٢. هل الرابط يعمل؟ افتحه من الرسالة نفسها، لا بالنسخ.');
  console.log('  ٣. هل يُسأل أحدٌ «تحب توصلك أخبار طريق؟» — ١٪ رقمٌ يقول إن السؤال غائب،');
  console.log('     لا أن الناس رفضت. سؤالٌ واحدٌ في الحساب أو بعد التسجيل يغيّره.');
  console.log('  ٤. من دخل بجوجل عنوانه موثَّقٌ عند جوجل بالفعل — إن كان بعضهم ما زال');
  console.log('     `emailVerified: false` عندنا، فتلك أرقامٌ نخسرها بلا سبب.');
} finally {
  await prisma.$disconnect();
}
