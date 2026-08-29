export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTransporter } from '@/lib/smtp';
import { randomBytes } from 'crypto';
import { requirePerm } from '@/lib/permissions';
import { SignJWT } from 'jose';

async function requireAdmin() {
  const guard = await requirePerm('membership.write');
  return 'response' in guard ? null : guard.user;
}

function generateQRToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  return 'ML-' + Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function generateMembershipNumber(): Promise<string> {
  const year = String(new Date().getFullYear()).slice(1);
  const latest = await prisma.familyMembership.findFirst({
    where: { membershipNumber: { startsWith: `ML-${year}-` } },
    orderBy: { membershipNumber: 'desc' },
    select: { membershipNumber: true },
  });
  let seq = 1;
  if (latest?.membershipNumber) {
    const parts = latest.membershipNumber.split('-');
    seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
  }
  return `ML-${year}-${String(seq).padStart(5, '0')}`;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, familyName } = await req.json().catch(() => ({}));
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 });
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 });
  }

  // Find user by email
  const targetUser = await prisma.user.findUnique({
    where: { email: trimmedEmail },
    select: { id: true, name: true, email: true },
  });

  // User not found → generate signed invite token and send celebration invite email
  if (!targetUser) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://moslimleader.com';
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-fallback-secret-not-for-production');
    const inviteToken = await new SignJWT({ type: 'membership-invite', email: trimmedEmail })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);
    const registerUrl = `${siteUrl}/login?mode=signup&email=${encodeURIComponent(trimmedEmail)}&inviteToken=${inviteToken}`;
    try {
      const transporter = getTransporter();
      const fromUser = process.env.SMTP_USER || 'orders@moslimleader.com';
      await transporter.sendMail({
        from: `مسلم ليدر <${fromUser}>`,
        to: trimmedEmail,
        subject: 'مبروك! عضويتك الرائدة في مسلم ليدر جاهزة 🌟',
        html: `
<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;background:#f4f7f6;margin:0;padding:0}
.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.header{background:#1a3a2e;padding:40px 24px 32px;text-align:center}
.header .emoji{font-size:48px;display:block;margin-bottom:12px}
.header h1{color:#FFCC33;margin:0;font-size:30px;font-weight:800}
.header .sub{color:rgba(255,255,255,.75);margin:10px 0 0;font-size:15px}
.body{padding:24px 28px}
.body p{color:#374151;line-height:1.7;margin:0 0 16px;font-size:15px}
.benefit{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
.benefit .check{color:#1a3a2e;font-size:18px;flex-shrink:0;margin-top:1px}
.benefit p{color:#374151;font-size:15px;line-height:1.5;margin:0}
.cta-wrap{text-align:center;padding:20px 28px 24px}
.cta{display:inline-block;padding:16px 36px;background:#1a3a2e;color:#FFCC33;text-decoration:none;border-radius:14px;font-weight:800;font-size:17px}
.footer{padding:16px 24px;text-align:center;color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6}
</style></head>
<body><div class="wrap">
<div class="header">
  <span class="emoji">🌟</span>
  <h1>مبروك!</h1>
  <p class="sub">عضويتك الرائدة جاهزة — أنشئ حسابك لتفعيلها</p>
</div>
<div class="body">
  <p>السلام عليكم ورحمة الله،</p>
  <p>تم تخصيص <strong>عضوية رائدة حصرية</strong> لك في مجتمع مسلم ليدر. كل ما تحتاجه هو إنشاء حسابك بهذا البريد لتفعيلها فوراً:</p>
  <div class="benefit"><span class="check">✅</span><p>مكتبة رقمية حصرية</p></div>
  <div class="benefit"><span class="check">✅</span><p>فعاليات وأنشطة مجانية</p></div>
  <div class="benefit"><span class="check">✅</span><p>مجتمع الأسرة المسلمة</p></div>
  <div class="benefit"><span class="check">✅</span><p>تطبيق مسلم ليدر كاملاً</p></div>
</div>
<div class="cta-wrap">
  <a href="${registerUrl}" class="cta">فعّل عضويتي الآن ←</a>
</div>
<div class="footer">مسلم ليدر — ${siteUrl} · الرابط صالح 7 أيام</div>
</div></body></html>`,
      });
    } catch (err) {
      console.error('[membership grant] email send failed', err);
      return NextResponse.json({ error: 'فشل إرسال البريد الإلكتروني' }, { status: 500 });
    }
    return NextResponse.json({ invited: true, email: trimmedEmail });
  }

  // User found — check existing membership
  const existing = await prisma.familyMembership.findUnique({
    where: { ownerUserId: targetUser.id },
    select: { id: true, status: true },
  });

  if (existing?.status === 'ACTIVE') {
    return NextResponse.json({ error: 'هذا المستخدم لديه عضوية نشطة بالفعل' }, { status: 409 });
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  let membership;
  if (!existing) {
    const membershipNumber = await generateMembershipNumber();
    let qrToken = generateQRToken();
    while (await prisma.familyMembership.findUnique({ where: { qrToken } })) {
      qrToken = generateQRToken();
    }
    try {
      membership = await prisma.familyMembership.create({
        data: {
          ownerUserId: targetUser.id,
          membershipNumber,
          qrToken,
          familyName: familyName?.trim() || null,
          memberSince: now.getFullYear(),
          status: 'ACTIVE',
          startsAt: now,
          expiresAt,
        },
      });
    } catch (err: unknown) {
      // Unique constraint on ownerUserId — concurrent grant race
      const isUniqueViolation = err instanceof Error && err.message.includes('Unique constraint');
      if (isUniqueViolation) {
        return NextResponse.json({ error: 'هذا المستخدم لديه عضوية بالفعل' }, { status: 409 });
      }
      throw err;
    }
  } else {
    membership = await prisma.familyMembership.update({
      where: { id: existing.id },
      data: {
        familyName: familyName?.trim() || undefined,
        status: 'ACTIVE',
        startsAt: now,
        expiresAt,
        paypalOrderId: null,
      },
    });
  }

  // Record manual grant in renewal history (amountEgp=0 = free grant)
  await prisma.membershipRenewal.create({
    data: {
      membershipId: membership.id,
      paypalOrderId: null,
      amountEgp: 0,
      expiresAt,
    },
  });

  // Send celebration welcome email to the existing user
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://moslimleader.com';
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-fallback-secret-not-for-production');
    const welcomeToken = await new SignJWT({
      type: 'membership-welcome',
      userId: targetUser.id,
      email: targetUser.email,
      membershipId: membership.id,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(secret);

    const welcomeUrl = `${siteUrl}/membership/welcome?token=${welcomeToken}`;
    const expiryYear = expiresAt.getFullYear();
    const userName = targetUser.name || 'عضونا الكريم';

    const transporter = getTransporter();
    const fromUser = process.env.SMTP_USER || 'orders@moslimleader.com';
    await transporter.sendMail({
      from: `مسلم ليدر <${fromUser}>`,
      to: targetUser.email,
      subject: 'مبروك! عضويتك الرائدة في مسلم ليدر جاهزة 🌟',
      html: `
<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;background:#f4f7f6;margin:0;padding:0}
.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.header{background:#1a3a2e;padding:40px 24px 32px;text-align:center}
.header .emoji{font-size:48px;display:block;margin-bottom:12px}
.header h1{color:#FFCC33;margin:0;font-size:30px;font-weight:800}
.header .name{color:rgba(255,255,255,.8);margin:10px 0 0;font-size:16px}
.member-num{background:rgba(255,204,51,.12);border:1px solid rgba(255,204,51,.3);border-radius:12px;padding:12px 20px;margin:0 24px;text-align:center}
.member-num .label{font-size:11px;color:#6b7280;letter-spacing:.1em;text-transform:uppercase}
.member-num .num{font-size:22px;font-weight:800;color:#1a3a2e;margin-top:4px;letter-spacing:.05em}
.divider{height:2px;background:linear-gradient(90deg,transparent,#D4A853,transparent);margin:24px auto;width:80%;border:none}
.body{padding:20px 28px}
.benefit{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
.benefit .check{color:#1a3a2e;font-size:18px;flex-shrink:0;margin-top:1px}
.benefit p{color:#374151;font-size:15px;line-height:1.5;margin:0}
.cta-wrap{text-align:center;padding:24px 28px 20px}
.cta{display:inline-block;padding:16px 36px;background:#1a3a2e;color:#FFCC33;text-decoration:none;border-radius:14px;font-weight:800;font-size:17px;letter-spacing:.02em}
.footer{padding:18px 24px;text-align:center;color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;line-height:1.7}
</style></head>
<body><div class="wrap">
<div class="header">
  <span class="emoji">🌟</span>
  <h1>مبروك</h1>
  <p class="name">${userName}</p>
</div>
<div style="padding:24px 24px 12px">
  <div class="member-num">
    <p class="label">رقم عضويتك</p>
    <p class="num">${membership.membershipNumber}</p>
  </div>
</div>
<hr class="divider" />
<div class="body">
  <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px">عضويتك الرائدة في مجتمع مسلم ليدر فعّالة الآن — إليك ما ينتظرك:</p>
  <div class="benefit"><span class="check">✅</span><p>مكتبة رقمية حصرية</p></div>
  <div class="benefit"><span class="check">✅</span><p>فعاليات وأنشطة مجانية</p></div>
  <div class="benefit"><span class="check">✅</span><p>مجتمع الأسرة المسلمة</p></div>
  <div class="benefit"><span class="check">✅</span><p>تطبيق مسلم ليدر كاملاً</p></div>
</div>
<div class="cta-wrap">
  <a href="${welcomeUrl}" class="cta">افتح عضويتي الآن ←</a>
</div>
<div class="footer">
  رقم العضوية: ${membership.membershipNumber} · تنتهي ${expiryYear}<br>
  مسلم ليدر — ${siteUrl}
</div>
</div></body></html>`,
    });
  } catch (emailErr) {
    console.error('[membership grant] welcome email failed', emailErr);
    // Email failure must not block the API response
  }

  return NextResponse.json({
    granted: true,
    user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
    membershipNumber: membership.membershipNumber,
    expiresAt: expiresAt.toISOString(),
  });
}
