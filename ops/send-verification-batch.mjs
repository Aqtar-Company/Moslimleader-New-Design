/**
 * Ask members whose address is already proven to confirm it — in controlled batches.
 *
 *   node ops/send-verification-batch.mjs --dry              # who would be mailed, sends nothing
 *   node ops/send-verification-batch.mjs --limit 50         # a real batch of 50
 *   node ops/send-verification-batch.mjs --limit 400
 *
 * Reads and sends. It also writes a verification token per member, which is the point.
 *
 * ## Why a script and not the broadcast composer
 *
 * The composer's hand-picked audience is capped at 500 names and each one is searched for
 * and clicked. 1777 members cannot be selected that way, and pretending otherwise would
 * mean either an afternoon of clicking or a raised cap that makes an accidental send to
 * everyone one click away.
 *
 * It also has to be THIS email. A broadcast carries a message; verification carries a
 * one-time token that must be minted, stored and expired per member. Only the verification
 * flow does that, so this reuses it rather than describing it.
 *
 * ## Who is eligible, and why only them
 *
 * Unverified AND holding a DELIVERED order. A parcel reached them, which means a human
 * read an order confirmation at that address. These are the same addresses the shop
 * already mails successfully every day, so asking them to confirm risks almost nothing —
 * and it is the only group of which that is true.
 *
 * The rest of the list is not refused forever; it is refused until this group's bounce
 * rate is known. Mailing 2000 unproven addresses in one go is what turns a domain's
 * reputation, and the shop's order mail and password resets ride on that same domain.
 *
 * ## The throttle is not politeness
 *
 * Titan accepts about 30 messages a minute. Going faster gets the connection closed
 * mid-batch, which leaves members holding tokens for a mail that never went out.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const limitArg = argv.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Math.max(1, parseInt(argv[limitArg + 1] || '0', 10) || 0) : 0;
const GAP_MS = 2100;            // ~28/min, inside Titan's ~30
const DELIVERED = ['delivered', 'completed'];
const TOKEN_DAYS = 7;           // longer than signup's 24h: this arrives unannounced

function env(k, fallback = '') {
  return process.env[k] ?? fallback;
}
// .env is not loaded for a bare node script the way Next loads it.
try {
  const fs = await import('node:fs');
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
} catch { /* running with a populated environment is fine too */ }

const SITE = env('NEXT_PUBLIC_SITE_URL', 'https://moslimleader.com').replace(/\/+$/, '');

function html(name, url) {
  // Plain tables and inline styles: Outlook renders with Word's engine, which ignores
  // most of everything else.
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#333">
  <div style="text-align:center;margin-bottom:22px"><img src="${SITE}/Logo.webp" alt="مسلم ليدر" style="height:56px" /></div>
  <h2 style="color:#1a1a1a;text-align:center;font-size:20px;margin:0 0 18px">تأكيد بريدك الإلكتروني</h2>
  <p style="line-height:1.9;margin:0 0 12px">مرحباً ${name}،</p>
  <p style="line-height:1.9;margin:0 0 12px">
    حسابك عندنا قديم، وبريدك لم يُؤكَّد بعد — لأن التأكيد لم يكن موجوداً وقت تسجيلك.
    تأكيدُه مرةً واحدة يضمن وصول إشعارات طلباتك وفواتيرك ورسائل «طريق» إليك.
  </p>
  <div style="text-align:center;margin:28px 0">
    <a href="${url}" style="background:#F5C518;color:#1a1a1a;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;font-size:16px">تأكيد البريد</a>
  </div>
  <p style="line-height:1.8;font-size:13px;color:#777;margin:0 0 6px">الرابط صالح ${TOKEN_DAYS} أيام. وإن لم يعمل الزر، انسخ هذا العنوان:</p>
  <p style="font-size:12px;color:#999;word-break:break-all;margin:0 0 18px">${url}</p>
  <p style="line-height:1.8;font-size:13px;color:#777;margin:0">
    لم تطلب هذا؟ تجاهل الرسالة ولن يتغيّر شيء في حسابك.
  </p>
</div>`;
}

try {
  const delivered = (await prisma.order.findMany({
    where: { status: { in: DELIVERED }, user: { emailVerified: false } },
    select: { userId: true },
    distinct: ['userId'],
  })).map(o => o.userId);

  // Never re-ask someone whose token is still live — that is the same mail twice.
  const targets = await prisma.user.findMany({
    where: {
      id: { in: delivered },
      emailVerified: false,
      OR: [{ verificationTokenExpiry: null }, { verificationTokenExpiry: { lt: new Date() } }],
    },
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: 'desc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  console.log(`مؤهَّلون (وصلتهم شحنة، وبلا رمزٍ حيّ): ${targets.length}`);
  if (LIMIT) console.log(`الحد المطلوب لهذه الدفعة: ${LIMIT}`);
  console.log(`الموقع: ${SITE}`);

  if (DRY) {
    console.log('\n— تجربة فقط، لن يُرسل شيء —\n');
    for (const u of targets.slice(0, 20)) console.log(`   ${u.email}   (${u.name})`);
    if (targets.length > 20) console.log(`   … و${targets.length - 20} غيرهم`);
    console.log(`\nالزمن المتوقّع لو أُرسلت: ~${Math.ceil(targets.length * GAP_MS / 60000)} دقيقة`);
    process.exit(0);
  }

  if (!targets.length) { console.log('لا أحد لإرساله.'); process.exit(0); }
  if (!LIMIT) {
    console.log('\n⚠️  بلا --limit سيُرسل للجميع دفعةً واحدة. هذا بالضبط ما لا نريده.');
    console.log('    ابدأ بـ --limit 50، واقرأ الارتدادات، ثم زِد.');
    process.exit(1);
  }

  const port = parseInt(env('SMTP_PORT', '465'), 10);
  const transporter = nodemailer.createTransport({
    host: env('SMTP_HOST', 'smtp.titan.email'),
    port, secure: port === 465,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
    pool: true, maxConnections: 1,
  });
  await transporter.verify();
  console.log(`✅ الاتصال بـ ${env('SMTP_USER')} سليم\n`);

  let sent = 0, failed = 0;
  for (const u of targets) {
    const token = crypto.randomBytes(32).toString('hex');
    try {
      // Token first: a mail sent against a token that was never stored is a dead link.
      await prisma.user.update({
        where: { id: u.id },
        data: { verificationToken: token, verificationTokenExpiry: new Date(Date.now() + TOKEN_DAYS * 864e5) },
      });
      await transporter.sendMail({
        from: `"مسلم ليدر" <${env('SMTP_USER')}>`,
        to: u.email,
        subject: 'تأكيد بريدك الإلكتروني — مسلم ليدر',
        html: html(u.name, `${SITE}/verify-email?token=${token}`),
      });
      sent++;
      if (sent % 10 === 0) console.log(`  ${sent}/${targets.length}…`);
    } catch (e) {
      failed++;
      console.log(`  ❌ ${u.email} — ${e.message}`);
    }
    await new Promise(r => setTimeout(r, GAP_MS));
  }

  transporter.close();
  console.log(`\nأُرسل ${sent}، فشل ${failed}.`);
  console.log('\nالآن: انتظر يومًا، وافتح صندوق orders@ واقرأ الارتدادات.');
  console.log('  ارتداد تحت ٢٪ → دفعةٌ أكبر.   فوق ٥٪ → قِف، وأخبرني بالرقم.');
  console.log('ولقياس الأثر: node ops/check-email-reach.mjs');
} finally {
  await prisma.$disconnect();
}
