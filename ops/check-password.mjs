/**
 * هل تطابق كلمةُ مرورٍ ما الهاشَ المخزَّن لحساب؟
 *
 *   node ops/check-password.mjs <البريد>
 *
 * تسأل عن الكلمة وقت التشغيل ولا تقرؤها من سطر الأوامر: وسيطٌ في السطر يبقى
 * في `history` وفي `ps` لكل من على الجهاز. ولا تُطبَع ولا تُسجَّل، والجواب
 * «تطابق / لا تطابق» لا غير. قراءةٌ محضة — لا تكتب في القاعدة شيئاً.
 *
 * وُضعت لأن حساباً كان يُرفض من الهاتف ويُقبل من الحاسوب، والسؤال الذي لا
 * جواب له إلا هنا: هل النص الذي يُرسَل هو نفسه المخزَّن؟
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline';

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
  console.log('الاستعمال: node ops/check-password.mjs <البريد>');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, passwordHash: true, emailVerified: true },
  });
  if (!user) { console.log(`لا حساب بالبريد «${email}».`); process.exit(1); }
  if (!user.passwordHash) { console.log('هذا الحساب لا كلمة مرور له إطلاقاً (دخولٌ بمزوّد خارجي).'); process.exit(0); }

  console.log(`الحساب : ${user.name}`);
  console.log(`التفعيل: ${user.emailVerified ? 'مُفعّل' : 'غير مُفعّل'}`);
  console.log('اكتب كلمة المرور ثم اضغط Enter (لن تظهر ولن تُسجَّل):');

  // Hide the typing with the terminal's own echo switch. The previous attempt wrapped
  // `stdout.write` and called it from inside the wrapper — a recursion that blew the
  // stack on the first keystroke.
  const { execSync } = await import('node:child_process');
  const stty = (arg) => { try { execSync(`stty ${arg}`, { stdio: 'inherit' }); } catch { /* not a tty */ } };
  stty('-echo');
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const pw = await new Promise(res => rl.question('', a => { rl.close(); res(a); }));
  stty('echo');
  console.log('');

  const exact = await bcrypt.compare(pw, user.passwordHash);
  const trimmed = pw !== pw.trim() ? await bcrypt.compare(pw.trim(), user.passwordHash) : false;

  console.log(exact ? '✅ تطابق الهاش المخزَّن.' : '❌ لا تطابق.');
  if (!exact && trimmed) {
    console.log('   لكنها تطابق بعد إزالة مسافة في الطرف — فالمسافة هي العطل.');
  }
  if (!exact && !trimmed) {
    console.log('   والكلمة المخزَّنة إذن غيرها. عيّن واحدة جديدة من «نسيت كلمة المرور؟».');
  }
  console.log(`   طول ما كُتب: ${pw.length} حرفاً.`);
} finally {
  await prisma.$disconnect();
}
