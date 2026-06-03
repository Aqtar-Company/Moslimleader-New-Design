export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { getTransporter } from '@/lib/smtp';

// POST /api/admin/notify-requests/[productId]/send
// Sends email notifications to all pending subscribers for the given product.
// Only marks a request as notified after its specific send attempt resolves.
// Phone-only requests are returned in a separate count for manual WhatsApp follow-up.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePerm('products.write');
    if ('response' in guard) return guard.response;

    const { id: productId } = await params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, slug: true, images: true },
    });
    if (!product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
    }

    const pending = await prisma.notifyRequest.findMany({
      where: { productId, notified: false },
    });

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, whatsapp: 0, message: 'لا توجد طلبات معلقة' });
    }

    const productName = product.name;
    const productUrl = `https://moslimleader.com/shop/${product.slug}`;
    const fromUser = process.env.SMTP_USER || 'orders@moslimleader.com';

    // Resolve image URL — must be absolute for email clients.
    const images = product.images as string[];
    const rawImage = images?.[0] || '';
    const productImage = rawImage.startsWith('http')
      ? rawImage
      : rawImage
        ? `https://moslimleader.com${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
        : '';

    const transporter = getTransporter();
    const now = new Date();

    // Separate email vs. phone-only requests.
    const emailReqs = pending.filter(r => !!r.email);
    const phoneOnlyReqs = pending.filter(r => !r.email && !!r.phone);
    const html = buildNotifyEmail({ productName, productUrl, productImage });

    // Send all emails in parallel (pool handles concurrency via maxConnections:3).
    // allSettled never throws — we handle per-item failures below.
    const results = await Promise.allSettled(
      emailReqs.map(req =>
        transporter.sendMail({
          from: `"مسلم ليدر" <${fromUser}>`,
          to: req.email!,
          subject: `✅ المنتج متاح الآن: ${productName}`,
          html: html.replace('__NAME__', req.name ? `مرحباً ${req.name}،` : 'مرحباً،'),
        })
      )
    );

    // Collect IDs of successfully sent + all phone-only (manual follow-up)
    const succeededEmailIds: string[] = [];
    const failedEmails: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        succeededEmailIds.push(emailReqs[i].id);
      } else {
        failedEmails.push(emailReqs[i].email!);
        console.error(`[notify send] failed for ${emailReqs[i].email}:`, r.reason);
      }
    });

    const phoneOnlyIds = phoneOnlyReqs.map(r => r.id);
    const markIds = [...succeededEmailIds, ...phoneOnlyIds];

    // Only mark as notified the requests that actually went through.
    if (markIds.length > 0) {
      await prisma.notifyRequest.updateMany({
        where: { id: { in: markIds } },
        data: { notified: true, notifiedAt: now },
      });
    }

    if (failedEmails.length > 0) {
      console.error(`[notify send] ${failedEmails.length} email(s) failed:`, failedEmails);
    }

    return NextResponse.json({
      ok: true,
      sent: succeededEmailIds.length,
      whatsapp: phoneOnlyIds.length,
      failed: failedEmails.length,
      total: pending.length,
    });
  } catch (err) {
    console.error('[admin notify-requests send]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// Name placeholder replaced per-recipient at call time to avoid rebuilding the
// full HTML string for every subscriber.
function buildNotifyEmail({
  productName,
  productUrl,
  productImage,
}: {
  productName: string;
  productUrl: string;
  productImage: string;
}): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7f4;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f4;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1a4a2e;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#F5C518;font-size:22px;font-weight:900;">مسلم ليدر</h1>
            <p style="margin:6px 0 0;color:#a8d8b0;font-size:13px;">moslimleader.com</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;font-weight:700;">__NAME__</p>
            <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
              البشرى! المنتج الذي طلبت الإشعار عنه أصبح متاحاً الآن في متجر مسلم ليدر.
            </p>
            ${productImage ? `<div style="text-align:center;margin-bottom:20px;">
              <img src="${productImage}" alt="${productName}" width="200" style="max-width:200px;border-radius:12px;border:1px solid #e5e7eb;">
            </div>` : ''}
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:900;color:#1a4a2e;">${productName}</p>
              <p style="margin:0;font-size:13px;color:#15803d;">متاح الآن للطلب</p>
            </div>
            <div style="text-align:center;">
              <a href="${productUrl}" style="display:inline-block;background:#1a4a2e;color:#F5C518;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
                اطلب الآن
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              تلقيت هذا البريد لأنك طلبت الإشعار بتوفر هذا المنتج.<br>
              مسلم ليدر — معاً نبني قادة الغد
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
