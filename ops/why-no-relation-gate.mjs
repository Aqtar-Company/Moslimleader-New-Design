/**
 * لماذا لم يُطلب إقرار الصلة بين شخصين؟
 *
 * السؤال يُطرح في ثلاث حالات لا رابعة، ويسقط لأي سبب منها. وحين يسقط لا
 * يُسجَّل شيء ولا يظهر شيء — فيبدو كأن القاعدة لم تُطبَّق أصلاً. هذا السكربت
 * يطبع الحالات الثلاث لزوجٍ بعينه فيقول أيُّها هو السبب.
 *
 *   node ops/why-no-relation-gate.mjs "كليم" "مارية"
 *
 * الوسيطان جزءٌ من الاسم أو البريد. لا يكتب شيئاً — قراءة فقط.
 */
import { PrismaClient } from '@prisma/client';

// يطابق needsRelationDeclaration في src/lib/tareeq-gender.ts — وهو ملف TypeScript
// لا يستورده node. والسكربت يطبع النوعين خامّين فوق الخلاصة كي يُراجَع الحكم بالعين.
const isPerson = (g) => g === 'male' || g === 'female';
const needsRelationDeclaration = (a, b) => isPerson(a) && isPerson(b) && a !== b;

const prisma = new PrismaClient();
const [aq, bq] = process.argv.slice(2);
if (!aq || !bq) {
  console.log('الاستعمال: node ops/why-no-relation-gate.mjs "<المرسِل>" "<المستقبِل>"');
  process.exit(1);
}

const find = async (q) => {
  const rows = await prisma.user.findMany({
    where: { OR: [{ name: { contains: q } }, { email: { contains: q } }] },
    select: { id: true, name: true, email: true, role: true, tareeqGender: true, tareeqGenderSetAt: true, tareeqMessagePrivacy: true, tareeqLastSeen: true },
    take: 10,
  });
  return rows;
};

/**
 * صفّ استيراد، لا عضو. 96% من جدول المستخدمين أرقام هواتف: طلبٌ يدوي أو شراء
 * كزائر يحتاج صفّ مستخدم، والصفّ يحتاج بريداً، فيُخترع من الرقم. يطابق
 * isSyntheticEmail في src/lib/real-email.ts.
 *
 * التنبيه ليس تزييناً: أول تشغيل لهذه الأداة طابق «مارية» بصفٍّ اسمه
 * «دومارية-الكلح شرق-ادفو-اسوان» — وهو عنوان في أسوان لا إنسان — وطبع خلاصة
 * صحيحة عن شخصٍ غير موجود.
 */
const isImportedRow = (email) => !email || /\.local$/i.test(email)
  || email.endsWith('@guest.moslimleader.com')
  || /^(manual|guest)-/i.test(email);

const label = (g) => g === 'male' ? 'رجل' : g === 'female' ? 'امرأة' : g === 'org' ? 'جهة' : '— غير محدَّد';

try {
  const as = await find(aq), bs = await find(bq);
  for (const [q, rows] of [[aq, as], [bq, bs]]) {
    if (rows.length === 0) { console.log(`لا حساب يطابق «${q}».`); process.exit(1); }
    if (rows.length > 1) {
      console.log(`«${q}» يطابق ${rows.length} حسابات — حدِّد أكثر:`);
      for (const r of rows) console.log(`   ${r.name}   <${r.email}>`);
      process.exit(1);
    }
  }
  const [a] = as, [b] = bs;

  console.log('\nالمرسِل   :', a.name, `— ${label(a.tareeqGender)}`, a.tareeqGender && !a.tareeqGenderSetAt ? '(تخمين)' : '', a.role === 'admin' ? '[إدارة]' : '');
  console.log('المستقبِل :', b.name, `— ${label(b.tareeqGender)}`, b.tareeqGender && !b.tareeqGenderSetAt ? '(تخمين)' : '', b.role === 'admin' ? '[إدارة]' : '');
  console.log('خصوصية رسائل المستقبِل:', b.tareeqMessagePrivacy ?? 'everyone');

  for (const r of [a, b]) {
    if (isImportedRow(r.email)) {
      console.log(`\n  ⚠️  «${r.name}» ليس عضواً في طريق — بريده «${r.email}» مُختلَق من`);
      console.log('      رقم هاتف عند طلبٍ يدوي أو شراءٍ كزائر. راجِع الاسم: قد يكون عنواناً.');
    } else if (!r.tareeqLastSeen) {
      console.log(`\n  ℹ️  «${r.name}» حسابُ متجرٍ لم يفتح طريق قط.`);
    }
  }

  const needed = needsRelationDeclaration(a.tareeqGender, b.tareeqGender);

  const convo = await prisma.tareeqConversation.findFirst({
    where: { OR: [{ participantA: a.id, participantB: b.id }, { participantA: b.id, participantB: a.id }] },
    select: { id: true, createdAt: true },
  });
  const reqs = await prisma.tareeqMessageRequest.findMany({
    where: { OR: [{ fromId: a.id, toId: b.id }, { fromId: b.id, toId: a.id }] },
    select: { fromId: true, status: true, createdAt: true },
  });

  console.log('\n— البوابات الثلاث —');
  console.log(`  ١) محادثة قائمة بينهما : ${convo ? `نعم (أُنشئت ${convo.createdAt.toISOString().slice(0,10)})` : 'لا'}`);
  console.log(`  ٢) النوعان معروفان ومختلفان : ${needed ? 'نعم' : 'لا'}`);
  console.log(`  ٣) طلبٌ مقبول سلفاً : ${reqs.some(r => r.status === 'accepted') ? 'نعم' : 'لا'}`);
  if (reqs.length) for (const r of reqs) console.log(`       ${r.fromId === a.id ? 'منه إليها' : 'منها إليه'} — ${r.status}`);

  console.log('\n— الخلاصة —');
  if (convo) {
    console.log('  السؤال لا يُطرح لأن بينهما محادثة قائمة، وهي تُعاد كما هي قبل أي فحص.');
    console.log('  وهذا مقصود: من اتفقا على الحديث لا يُسألان عنه مرة أخرى.');
  } else if (!needed) {
    const miss = [];
    if (!isPerson(a.tareeqGender)) miss.push(`${a.name}: ${label(a.tareeqGender)}`);
    if (!isPerson(b.tareeqGender)) miss.push(`${b.name}: ${label(b.tareeqGender)}`);
    if (miss.length) console.log('  السؤال لا يُطرح لأن النوع غير معروف لـ:', miss.join('، '));
    else console.log('  السؤال لا يُطرح لأن الاثنين من النوع نفسه.');
  } else if (reqs.some(r => r.status === 'accepted')) {
    console.log('  السؤال لا يُطرح لأن طلباً بينهما قُبِل من قبل.');
  } else {
    console.log('  المفروض أن يُطرح. إن لم يظهر فالعطل في الواجهة لا في القاعدة:');
    console.log('  الراوت يجيب 202 ومعه requestRequired، والزر يجب أن يقرأه قبل res.ok.');
  }
} finally {
  await prisma.$disconnect();
}
