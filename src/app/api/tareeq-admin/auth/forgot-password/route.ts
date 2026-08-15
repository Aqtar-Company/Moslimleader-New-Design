export const dynamic = 'force-dynamic';

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getTransporter } from '@/lib/smtp';

// 3 requests per 15 min per IP
const forgotAttempts = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = forgotAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    forgotAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 3) return true;
  entry.count++;
  return false;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { email } = await req.json().catch(() => ({})) as { email?: string };
  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  const admin = await prisma.tareeqAdmin.findUnique({ where: { email } });

  // Always return ok — don't reveal if email exists
  if (!admin || !admin.isActive) {
    return Response.json({ ok: true });
  }

  const token = randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.tareeqAdmin.update({
    where: { id: admin.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://moslimleader.com';
  const resetLink = `${baseUrl}/tareeq-admin/reset-password?token=${token}`;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"لوحة تحكم طريق" <${process.env.SMTP_USER || 'orders@moslimleader.com'}>`,
      to: admin.email,
      subject: 'إعادة تعيين كلمة المرور — لوحة تحكم طريق',
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px;text-align:center;">
            <div style="font-size:36px;">🛡️</div>
            <h1 style="color:#0f172a;margin:8px 0 0;font-size:20px;">لوحة تحكم طريق</h1>
          </div>
          <div style="padding:32px 24px;">
            <p style="margin:0 0 8px;">مرحباً ${admin.name}،</p>
            <p style="color:#94a3b8;margin:0 0 24px;">تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.</p>
            <a href="${resetLink}"
               style="display:inline-block;background:#f59e0b;color:#0f172a;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">
              إعادة تعيين كلمة المرور
            </a>
            <p style="color:#64748b;font-size:12px;margin:24px 0 0;">
              هذا الرابط صالح لمدة ساعة واحدة فقط.<br>
              إذا لم تطلب هذا، تجاهل هذا البريد.
            </p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[forgot-password] email error', err);
  }

  return Response.json({ ok: true });
}
