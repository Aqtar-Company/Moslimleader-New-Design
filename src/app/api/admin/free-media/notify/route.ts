export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { getTransporter } from '@/lib/smtp';

function buildNotifyHtml(items: { title: string; type: string; url: string; coverUrl: string | null; description: string | null }[]) {
  const typeLabel = (t: string) => t === 'mp3' ? '🎵 نشيد' : t === 'image' ? '🖼️ رسمة تلوين' : '📄 PDF';
  const siteUrl = 'https://moslimleader.com';

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding:12px 0; border-bottom:1px solid #f0f0f0;">
        ${item.coverUrl ? `<img src="${siteUrl}${item.coverUrl}" alt="${item.title}" style="width:80px;height:60px;object-fit:cover;border-radius:8px;display:block;float:right;margin-left:14px;" />` : ''}
        <div style="overflow:hidden;">
          <p style="margin:0 0 2px;font-size:13px;color:#888;">${typeLabel(item.type)}</p>
          <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1a1a2e;">${item.title}</p>
          ${item.description ? `<p style="margin:0 0 6px;font-size:12px;color:#666;">${item.description}</p>` : ''}
          <a href="${siteUrl}/account?tab=downloads" style="display:inline-block;background:#F5C518;color:#1a1a2e;font-weight:700;padding:5px 14px;border-radius:8px;font-size:12px;text-decoration:none;">⬇️ تحميل مجاني</a>
        </div>
        <div style="clear:both;"></div>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f7;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#1a1a2e;padding:24px 28px;text-align:center;">
      <img src="${siteUrl}/ml-logo-new.png" alt="Moslim Leader" style="height:44px;" onerror="this.style.display='none'" />
      <h1 style="color:#F5C518;font-size:18px;margin:12px 0 4px;">وسائط مجانية جديدة 🎁</h1>
      <p style="color:rgba(255,255,255,.75);font-size:13px;margin:0;">تم إضافة محتوى جديد في مسلم ليدر</p>
    </div>
    <div style="padding:24px 28px;">
      <p style="font-size:14px;color:#444;margin:0 0 16px;">السلام عليكم ورحمة الله،</p>
      <p style="font-size:14px;color:#444;margin:0 0 20px;">يسعدنا إخبارك بتوفر وسائط مجانية جديدة في مسلم ليدر، يمكنك تحميلها مباشرةً من حسابك:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;">${itemsHtml}</table>
      <div style="text-align:center;margin-top:24px;">
        <a href="${siteUrl}/account?tab=downloads" style="display:inline-block;background:#1a1a2e;color:#F5C518;font-weight:700;padding:12px 32px;border-radius:12px;font-size:15px;text-decoration:none;">اذهب لصفحة التحميل</a>
      </div>
    </div>
    <div style="background:#f9f9f7;padding:16px 28px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:11px;color:#aaa;margin:0;">مسلم ليدر — <a href="${siteUrl}" style="color:#aaa;">moslimleader.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const itemIds: number[] | undefined = body.itemIds; // optional: specific items; default = last 7 days published

    // Fetch media items to feature in the email
    const items = await prisma.freeMedia.findMany({
      where: {
        isPublished: true,
        ...(itemIds?.length ? { id: { in: itemIds } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 6,
      select: { id: true, title: true, type: true, url: true, coverUrl: true, description: true },
    });

    if (items.length === 0) {
      return NextResponse.json({ error: 'لا توجد وسائط منشورة للإرسال' }, { status: 400 });
    }

    // Fetch all email-verified customers
    const recipients = await prisma.user.findMany({
      where: {
        emailVerified: true,
        role: 'customer',
        AND: [
          { NOT: { email: { contains: '@guest.moslimleader.com' } } },
          { NOT: { email: { contains: '@moslimleader.local' } } },
        ],
      },
      select: { id: true, name: true, email: true },
    });

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'لا يوجد مستخدمون مسجلون لإرسال الإشعار إليهم' }, { status: 400 });
    }

    const transporter = getTransporter();
    const html = buildNotifyHtml(items);
    const siteEmail = process.env.SMTP_USER || 'orders@moslimleader.com';

    let sent = 0;
    let failed = 0;

    // Send in batches of 10 with small delay to avoid SMTP throttle
    const BATCH = 10;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(r =>
          transporter.sendMail({
            from: `"مسلم ليدر" <${siteEmail}>`,
            to: r.email,
            subject: '🎁 وسائط مجانية جديدة في مسلم ليدر',
            html,
          }).then(() => { sent++; }).catch(err => {
            console.error('[free-media notify] failed:', r.email, err?.message);
            failed++;
          })
        )
      );
      // Brief pause between batches
      if (i + BATCH < recipients.length) await new Promise(r => setTimeout(r, 200));
    }

    return NextResponse.json({ ok: true, sent, failed, total: recipients.length });
  } catch (err) {
    console.error('[free-media notify]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
