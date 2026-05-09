export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTransporter } from '@/lib/smtp';
import { logActionSafe } from '@/lib/audit-log';
import { prisma } from '@/lib/prisma';

// Public endpoint for two flows:
//   • kind='delete-data'   — Facebook-required data-deletion request.
//   • kind='contact'       — generic "contact us" form.
//
// Both go to the same admin inbox (orders@moslimleader.com by default
// or CONTACT_INBOX env override). We also persist to AuditLog so the
// owner has a permanent record even if the email gets lost.
//
// Rate limited at 3 submissions per IP per 15 min to deter spam.

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 3;
const ipHits = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

interface ContactBody {
  kind?: 'delete-data' | 'contact';
  name?: string;
  email?: string;
  phone?: string;
  facebookName?: string;
  message?: string;
  honeypot?: string;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'تم تجاوز عدد الطلبات المسموح. حاول مرة أخرى بعد قليل.' }, { status: 429 });
  }

  let body: ContactBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  // Honeypot — bots fill hidden fields, humans don't.
  if (body.honeypot && body.honeypot.trim().length > 0) {
    return NextResponse.json({ ok: true }); // pretend success
  }

  const kind = body.kind === 'delete-data' ? 'delete-data' : 'contact';
  const name = (body.name ?? '').trim().slice(0, 200);
  const email = (body.email ?? '').trim().slice(0, 200);
  const phone = (body.phone ?? '').trim().slice(0, 50);
  const facebookName = (body.facebookName ?? '').trim().slice(0, 200);
  const message = (body.message ?? '').trim().slice(0, 4000);

  if (!name && !email && !phone && !facebookName) {
    return NextResponse.json({ error: 'يجب إدخال اسم أو بريد إلكتروني أو رقم تواصل' }, { status: 400 });
  }

  const subjectAr = kind === 'delete-data'
    ? '🗑️ طلب حذف بيانات — Moslim Leader AI'
    : '📨 رسالة تواصل جديدة — Moslim Leader';

  const adminInbox = process.env.CONTACT_INBOX || process.env.ADMIN_EMAIL || 'orders@moslimleader.com';

  const html = `
    <div style="font-family:Tahoma,Arial,sans-serif;font-size:14px;direction:rtl;text-align:right;color:#1a1a2e">
      <h2 style="color:#F5C518;margin-bottom:6px">${subjectAr}</h2>
      <p style="color:#666;font-size:12px">من ${ip} · ${new Date().toLocaleString('ar-EG', { hour12: false })}</p>
      <table style="border-collapse:collapse;margin-top:12px;width:100%;max-width:600px">
        <tr><td style="padding:6px;background:#f6f6f6;font-weight:bold">النوع</td><td style="padding:6px">${kind === 'delete-data' ? 'طلب حذف بيانات' : 'رسالة تواصل'}</td></tr>
        ${name          ? `<tr><td style="padding:6px;background:#f6f6f6;font-weight:bold">الاسم</td><td style="padding:6px">${escapeHtml(name)}</td></tr>` : ''}
        ${email         ? `<tr><td style="padding:6px;background:#f6f6f6;font-weight:bold">إيميل</td><td style="padding:6px;direction:ltr;text-align:left">${escapeHtml(email)}</td></tr>` : ''}
        ${phone         ? `<tr><td style="padding:6px;background:#f6f6f6;font-weight:bold">موبايل</td><td style="padding:6px;direction:ltr;text-align:left">${escapeHtml(phone)}</td></tr>` : ''}
        ${facebookName  ? `<tr><td style="padding:6px;background:#f6f6f6;font-weight:bold">اسم فيسبوك</td><td style="padding:6px">${escapeHtml(facebookName)}</td></tr>` : ''}
        ${message       ? `<tr><td style="padding:6px;background:#f6f6f6;font-weight:bold">الرسالة</td><td style="padding:6px;white-space:pre-wrap">${escapeHtml(message)}</td></tr>` : ''}
      </table>
      ${kind === 'delete-data' ? `
        <div style="margin-top:14px;padding:10px;border:1px solid #f5c518;border-radius:8px;background:#fffbe6">
          <strong>إجراء مطلوب:</strong>
          <ol style="margin:4px 18px;padding:0">
            <li>افتح <a href="https://moslimleader.com/admin/ai-facebook-assistant">صفحة المساعد الذكي</a></li>
            <li>ابحث عن المحادثة بـ "اسم فيسبوك" أو الموبايل أعلاه</li>
            <li>احذف المحادثة من الـ DB أو ضع علامة "anonymised"</li>
            <li>رد على المرسِل بالبريد لتأكيد الإنجاز</li>
          </ol>
        </div>
      ` : ''}
    </div>
  `;

  // Send + log. Both legs are best-effort — we accept the request
  // even if email fails so the user gets their confirmation; admin
  // will catch up via the AuditLog row.
  let mailed = false;
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_USER || 'orders@moslimleader.com',
      to: adminInbox,
      subject: subjectAr,
      html,
      replyTo: email || undefined,
    });
    mailed = true;
  } catch (err) {
    console.error('[contact-request] mail failed', err);
  }

  // Audit log (system-actor — no logged-in user on this public route).
  await logActionSafe({
    actor: null,
    action: 'settings.update',
    entity: 'ContactRequest',
    entityId: undefined,
    metadata: { kind, name, email, phone, facebookName, message, ip, mailed },
  }).catch(() => {/* swallow */});

  // Also persist as a Setting row so the owner has a quick "list of
  // recent requests" without trawling the audit log. Cap at 100.
  try {
    const key = 'recent-contact-requests';
    const existing = await prisma.setting.findUnique({ where: { key } });
    const list = (Array.isArray(existing?.value) ? existing.value : []) as Array<Record<string, unknown>>;
    list.unshift({
      kind, name, email, phone, facebookName, message,
      receivedAt: new Date().toISOString(),
      ip,
    });
    const trimmed = list.slice(0, 100);
    await prisma.setting.upsert({
      where: { key },
      // Setting.value expects JSON; cast through unknown to satisfy
      // the Prisma JsonValue check (the array shape is fine at runtime).
      create: { key, value: trimmed as unknown as object },
      update: { value: trimmed as unknown as object },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
