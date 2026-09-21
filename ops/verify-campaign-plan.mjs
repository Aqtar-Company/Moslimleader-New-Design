/**
 * In what ORDER to ask 2063 unverified members to confirm their address.
 *
 *   cd /home/moslimleader.com/app && node ops/verify-campaign-plan.mjs
 *
 * Reads only. Sends nothing, changes nothing.
 *
 * ## The trap this exists to avoid
 *
 * The obvious move is to mail all 2063 at once. It is also the single most damaging thing
 * available: those are addresses nobody has ever proved are real. A burst of bounces from
 * a domain Gmail has not seen sending bulk mail before is what turns that domain's
 * reputation, and the reputation is shared — the shop's order confirmations and password
 * resets ride on it. Trying to fix the mailing list is how you lose the mail that matters.
 *
 * So the list is ordered by EVIDENCE that the address is real, strongest first:
 *
 *   1. A DELIVERED order. Someone read a confirmation at that address and a parcel
 *      reached them. This is as close to proof as the data holds.
 *   2. Any order at all. Weaker — an order can be placed with a typo'd address — but the
 *      person was present and transacting.
 *   3. Opened طريق recently. No proof of the address, but a live human behind the account.
 *   4. Everything else, newest first. An address from last month outlives one from a
 *      signup two years ago that was never used.
 *
 * Each tier is sent, then the bounces are read before the next one starts. A tier that
 * bounces badly is where the list stops being worth mailing — and knowing that after 200
 * addresses instead of 2063 is the entire point.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// The statuses that mean a parcel actually arrived. Read from the data rather than
// assumed, since this project's order status vocabulary has changed before.
const DELIVERED = ['delivered', 'completed'];

try {
  const base = { emailVerified: false };
  const total = await prisma.user.count({ where: base });

  const deliveredIds = (await prisma.order.findMany({
    where: { status: { in: DELIVERED }, user: base },
    select: { userId: true },
    distinct: ['userId'],
  })).map(o => o.userId);

  const anyOrderIds = (await prisma.order.findMany({
    where: { user: base },
    select: { userId: true },
    distinct: ['userId'],
  })).map(o => o.userId);

  const orderedOnly = anyOrderIds.filter(id => !deliveredIds.includes(id));

  const recentTareeq = await prisma.user.count({
    where: { ...base, id: { notIn: anyOrderIds }, tareeqLastSeen: { gte: new Date(Date.now() - 180 * 864e5) } },
  });

  const rest = total - deliveredIds.length - orderedOnly.length - recentTareeq;

  const row = (n, label, note) =>
    console.log(`  ${String(n).padStart(5)}  ${label.padEnd(30)} ${note}`);

  console.log(`═══ ${total} عضوًا غير موثَّق — بأي ترتيب نسألهم ═══\n`);
  row(deliveredIds.length, '① وصلته شحنةٌ فعلًا', 'أقوى دليلٍ على أن العنوان حقيقي');
  row(orderedOnly.length,  '② طلب ولم تُسجَّل كـ«وصلت»', 'كان حاضرًا ويتعامل');
  row(recentTareeq,        '③ فتح طريق خلال ٦ أشهر', 'إنسانٌ حيّ، لا دليلَ على العنوان');
  row(rest,                '④ الباقي', 'يُرسَل الأحدث أولًا، إن أُرسل');

  console.log('\n═══ الخطة ═══\n');
  console.log(`  الدفعة الأولى: المجموعة ① وحدها (${deliveredIds.length} عنوانًا).`);
  console.log('  أرسِل، ثم انتظر يومًا، ثم افتح صندوق البريد واقرأ الارتدادات.');
  console.log('');
  console.log('  • ارتداد تحت ٢٪  → المجموعة التالية.');
  console.log('  • ارتداد فوق ٥٪  → قِف. القائمة أقدمُ مما تحتمل، والمكسبُ لا يساوي');
  console.log('    المخاطرة بوصول إيميلات أوردرات المتجر.');
  console.log('');
  console.log('  ولا تُرسَل المجموعة ④ إلا إن مرّت الثلاثُ قبلها نظيفة. وحتى حينها،');
  console.log('  الأحدثُ أولًا وعلى دفعاتٍ من ٢٠٠، لا دفعةً واحدة.');

  console.log('\n═══ كيف تُرسَل ═══\n');
  console.log('  من «📣 إعلام المستخدمين»، جمهور «أشخاص محددون»، و«رسالة خدمية» مفعّلة');
  console.log('  — وهي خدميةٌ بحق: طلبُ تأكيدِ عنوانٍ ليس دعاية، ولا يحتاج موافقةً تسويقية.');
  console.log('  والقائمةُ المختارة معفاةٌ من شرط التوثيق، وهو ما يجعل هذا ممكنًا أصلًا.');
  console.log('');
  console.log('  ⚠️ حدُّ القائمة المختارة ٥٠٠ اسم، فالمجموعات الكبيرة تُقسَّم.');

  const optInGap = await prisma.user.count({ where: { emailVerified: true, marketingOptIn: false } });
  console.log('\n═══ وهذه منفصلةٌ تمامًا ═══\n');
  console.log(`  ${optInGap} عضوًا عنوانه موثَّقٌ ولم يوافق على الرسائل التسويقية.`);
  console.log('  هؤلاء لا يحتاجون بريدًا ولا حملة: يحتاجون سؤالًا واحدًا في صفحة الحساب');
  console.log('  «تحب توصلك أخبار طريق؟». نسبةُ ٢٧٪ بين مسجّلي آخر شهر مقابل ١٪ إجمالًا');
  console.log('  تقول إن السؤال حديثٌ، لا أن الناس رفضت.');
} finally {
  await prisma.$disconnect();
}
