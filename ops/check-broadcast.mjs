/**
 * Why did that admin broadcast not arrive — read the record instead of guessing.
 *
 *   cd /home/moslimleader.com/app && node ops/check-broadcast.mjs
 *   node ops/check-broadcast.mjs <broadcastId>     # a specific one
 *
 * Reads only. Prints, for the most recent broadcast (or the one named): which channels were
 * switched on, how far the run got, and — for each channel that delivered nothing — the
 * REASON recorded on the recipient rows.
 *
 * ## Why a reader is needed at all
 *
 * «الرسالة موصلتش» has at least seven distinct causes here, and six of them are silent:
 *
 *   1. the email channel is OFF — it is off by DEFAULT in the composer
 *   2. the broadcast never left `draft`: composed but «إرسال» never pressed
 *   3. it is stuck at `sending` — the process restarted mid-run
 *   4. the recipient has «إعلانات المنصة» switched off (in-app + push)
 *   5. the recipient's address is not verified, on a broad audience
 *   6. the recipient never opted into marketing, on a non-service message
 *   7. SMTP actually refused
 *
 * Only the last one looks like a failure anywhere. The rest look identical from outside —
 * which is why each skip writes its reason on the row, and why this prints them.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const wanted = process.argv[2];

const AR = {
  draft: 'مسوّدة — لم تُرسَل بعد', sending: 'جارٍ الإرسال', sent: 'تمّ الإرسال',
  failed: 'فشلت', canceled: 'أُوقفت',
};

try {
  const b = wanted
    ? await prisma.adminBroadcast.findUnique({ where: { id: wanted } })
    : await prisma.adminBroadcast.findFirst({ orderBy: { createdAt: 'desc' } });

  if (!b) { console.log('لا توجد أي رسالة مسجَّلة.'); process.exit(0); }

  console.log('═══ الرسالة ═══');
  console.log(`  العنوان   : ${b.title}`);
  console.log(`  النوع     : ${b.kind}${b.serviceMessage ? '   (رسالة خدمية)' : '   (ليست خدمية — تحتاج موافقة تسويقية)'}`);
  console.log(`  الجمهور   : ${b.audience}`);
  console.log(`  الحالة    : ${AR[b.status] ?? b.status}`);
  console.log(`  أُنشئت    : ${b.createdAt.toISOString()}`);
  if (b.startedAt) console.log(`  بدأت      : ${b.startedAt.toISOString()}`);
  if (b.finishedAt) console.log(`  انتهت     : ${b.finishedAt.toISOString()}`);
  if (b.error) console.log(`  خطأ       : ${b.error}`);

  console.log('\n═══ القنوات المفعَّلة ═══');
  console.log(`  داخل التطبيق : ${b.channelInApp ? 'نعم' : 'لا'}`);
  console.log(`  إشعار متصفح  : ${b.channelPush ? 'نعم' : 'لا'}`);
  console.log(`  إيميل        : ${b.channelEmail ? 'نعم' : '❌ لا — وهذا وحده يفسّر «الإيميل موصلش»'}`);

  console.log('\n═══ ما جرى فعلًا ═══');
  console.log(`  مستقبلون   : ${b.recipientCount}      عُوملوا: ${b.processedCount}`);
  console.log(`  داخل التطبيق: ${b.inAppCount}`);
  console.log(`  إشعارات    : ${b.pushCount}   ← عدد الأجهزة التي قَبِلت الإشعار، لا عدد المحاولات`);
  console.log(`  إيميل نجح   : ${b.emailSentCount}      فشل: ${b.emailFailedCount}`);

  if (b.status === 'draft') {
    console.log('\n  ⚠️  الرسالة مسوّدة. لم يُضغط «إرسال»، فلا شيء خرج — وهذا هو السبب.');
  }
  if (b.status === 'sending' && b.processedCount < b.recipientCount) {
    console.log('\n  ⚠️  متوقّفة في منتصف الإرسال (أُعيد تشغيل العملية أثناء العمل).');
    console.log('     افتح /admin/tareeq ← «📣 الرسائل» — مجرّد فتح التبويب يُكمل ما توقّف.');
  }

  const rows = await prisma.adminBroadcastRecipient.findMany({
    where: { broadcastId: b.id },
    select: { status: true, inAppSent: true, pushSent: true, emailStatus: true, error: true },
  });

  const byStatus = {}, byEmail = {}, reasons = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byEmail[r.emailStatus] = (byEmail[r.emailStatus] ?? 0) + 1;
    if (r.error) reasons[r.error] = (reasons[r.error] ?? 0) + 1;
  }

  console.log('\n═══ صفوف المستقبلين ═══');
  console.log(`  العدد: ${rows.length}`);
  console.log('  الحالة     : ' + (Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join('  ') || '—'));
  console.log('  حالة الإيميل: ' + (Object.entries(byEmail).map(([k, v]) => `${k}=${v}`).join('  ') || '—'));

  if (Object.keys(reasons).length) {
    console.log('\n═══ أسبابُ التخطّي المسجَّلة ═══');
    for (const [why, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)} × ${why}`);
    }
  } else if (rows.length) {
    console.log('\n  لا أسباب تخطٍّ مسجَّلة — لم يُستثنَ أحد بسبب تفضيلاته.');
  }

  // The gates are on the audience, so the audience itself is worth counting.
  const [users, verified, optIn, announcementsOff] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { marketingOptIn: true } }),
    prisma.user.count({ where: { tareeqNotifPrefs: { not: null } } }),
  ]);
  console.log('\n═══ البوابات على مستوى الأعضاء ═══');
  console.log(`  الأعضاء كلهم            : ${users}`);
  console.log(`  عناوينهم موثَّقة        : ${verified}   ← الجمهور الواسع لا يُرسَل لغير الموثَّق`);
  console.log(`  موافقون على التسويق     : ${optIn}   ← تشترطه الرسالةُ غيرُ الخدمية فقط`);
  console.log(`  لهم تفضيلاتٌ محفوظة     : ${announcementsOff}   ← قد يكون «إعلانات المنصة» مغلقًا لبعضهم`);

  console.log('\n═══ ماذا تفعل الآن ═══');
  if (!b.channelEmail) {
    console.log('  فعِّل خانة «إيميل» في المُنشئ — هي مغلقةٌ افتراضيًا. ثم أعد الإرسال.');
  } else if (b.emailSentCount === 0 && b.emailFailedCount === 0) {
    console.log('  القناةُ مفتوحة ولم يخرج ولا فشل شيء: كلُّ مستقبِلٍ استُثني ببوابةٍ.');
    console.log('  اقرأ أسبابَ التخطّي أعلاه — هي الجواب حرفًا بحرف.');
  } else if (b.emailFailedCount > 0) {
    console.log('  فيه فشلٌ حقيقي. «إعادة محاولة الإيميل» في السجل تُعيد المرفوضَ فقط.');
  } else {
    console.log('  الإيميل خرج فعلًا. راجع مجلد السبام عند المستقبِل، وابحث بعنوان الرسالة.');
  }
} finally {
  await prisma.$disconnect();
}
