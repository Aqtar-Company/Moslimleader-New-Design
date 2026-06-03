export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { getTransporter } from '@/lib/smtp';

// POST /api/admin/notify-requests/[productId]/send
// Sends email notifications to all pending (not yet notified) subscribers
// for the given product, then marks them as notified.
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
      return NextResponse.json({ ok: true, sent: 0, message: 'لا توجد طلبات معلقة' });
    }

    const productName = product.name;
    const productUrl = `https://moslimleader.com/shop/${product.slug}`;
    const images = product.images as string[];
    const productImage = images?.[0] || '';
    const fromUser = process.env.SMTP_USER || 'orders@moslimleader.com';

    const transporter = getTransporter();
    let sent = 0;
    const now = new Date();

    for (const req of pending) {
      if (req.email) {
        const html = buildNotifyEmail({ name: req.name, productName, productUrl, productImage });
        try {
          await transporter.sendMail({
            from: `"مسلم ليدر" <${fromUser}>`,
            to: req.email,
            subject: `✅ المنتج متاح الآن: ${productName}`,
            html,
          });
          sent++;
        } catch (err) {
          console.error(`[notify send] email failed for ${req.email}:`, err);
        }
      }
      // WhatsApp numbers are listed in the admin panel for manual follow-up.
      // Count them as "sent" since we've processed this request.
      if (req.phone && !req.email) sent++;
    }

    // Mark all as notified regardless of email success (avoid duplicate sends)
    await prisma.notifyRequest.updateMany({
      where: { productId, notified: false },
      data: { notified: true, notifiedAt: now },
    });

    return NextResponse.json({ ok: true, sent, total: pending.length });
  } catch (err) {
    console.error('[admin notify-requests send]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

function buildNotifyEmail({
  name,
  productName,
  productUrl,
  productImage,
}: {
  name: string | null;
  productName: string;
  productUrl: string;
  productImage: string;
}): string {
  const greeting = name ? `مرحباً ${name}،` : 'مرحباً،';
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
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;font-weight:700;">${greeting}</p>
            <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
              البشرى! المنتج الذي طلبت الإشعار عنه أصبح متاحاً الآن في متجر مسلم ليدر.
            </p>
            ${productImage ? `<div style="text-align:center;margin-bottom:20px;">
              <img src="${productImage}" alt="${productName}" style="max-width:200px;border-radius:12px;border:1px solid #e5e7eb;">
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
