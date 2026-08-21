export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { getTransporter } from '@/lib/smtp';
import { randomBytes } from 'crypto';

async function requireAdmin() {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  return user;
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

  // Find user by email
  const targetUser = await prisma.user.findUnique({
    where: { email: trimmedEmail },
    select: { id: true, name: true, email: true },
  });

  // User not found → send invite email
  if (!targetUser) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://moslimleader.com';
    const registerUrl = `${siteUrl}/auth/register`;
    try {
      const transporter = getTransporter();
      const fromUser = process.env.SMTP_USER || 'orders@moslimleader.com';
      await transporter.sendMail({
        from: `مسلم ليدر <${fromUser}>`,
        to: trimmedEmail,
        subject: 'دعوة للانضمام إلى عضوية مجتمع مسلم ليدر 🌿',
        html: `
<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;background:#f4f7f6;margin:0;padding:0}
.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.header{background:linear-gradient(135deg,#1a3a2e,#2d5a40);padding:32px 24px;text-align:center}
.header h1{color:#D4A853;margin:0;font-size:22px}
.header p{color:rgba(255,255,255,.75);margin:8px 0 0;font-size:14px}
.body{padding:28px 24px}
.body p{color:#374151;line-height:1.7;margin:0 0 16px;font-size:15px}
.btn{display:block;width:fit-content;margin:24px auto;padding:14px 32px;background:#1a3a2e;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px}
.footer{padding:16px 24px;text-align:center;color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6}
</style></head>
<body><div class="wrap">
<div class="header">
  <h1>🌿 مجتمع مسلم ليدر</h1>
  <p>عضوية الأسرة المسلمة</p>
</div>
<div class="body">
  <p>السلام عليكم ورحمة الله،</p>
  <p>تمت دعوتك للانضمام إلى <strong>عضوية مجتمع مسلم ليدر</strong> — مجتمع حصري للأسر المسلمة الواعية.</p>
  <p>لتفعيل عضويتك المجانية، يرجى إنشاء حساب على منصتنا باستخدام هذا البريد الإلكتروني:</p>
  <a href="${registerUrl}" class="btn">إنشاء حساب وتفعيل العضوية</a>
  <p style="font-size:13px;color:#6b7280">بعد تسجيل الدخول، ستجد عضويتك مفعّلة تلقائياً في صفحة حسابك.</p>
</div>
<div class="footer">مسلم ليدر — ${siteUrl}</div>
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

  return NextResponse.json({
    granted: true,
    user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
    membershipNumber: membership.membershipNumber,
    expiresAt: expiresAt.toISOString(),
  });
}
