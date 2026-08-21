export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { getTransporter } from '@/lib/smtp';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function safeUrl(u: string | null): string | null {
  if (!u) return null;
  try { const p = new URL(u); return (p.protocol === 'https:' || p.protocol === 'http:') ? u : null; } catch { return null; }
}

function buildPerkTareeqContent(title: string, description: string | null, linkUrl: string | null): string {
  const lines: string[] = [];
  lines.push(`🎁 ميزة حصرية لأعضاء مجتمع مسلم ليدر`);
  lines.push('');
  lines.push(`✨ ${title}`);
  if (description) { lines.push(''); lines.push(description); }
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('هذه الميزة متاحة حصراً لأعضاء مجتمع مسلم ليدر.');
  lines.push('لم تنضم بعد؟ انضم الآن وابدأ الاستمتاع بعشرات المزايا 👇');
  lines.push('moslimleader.com/membership');
  if (linkUrl) { lines.push(''); lines.push(`🔗 تفاصيل الميزة: ${linkUrl}`); }
  return lines.join('\n');
}

// POST /api/admin/membership/perks/notify
// Body: { id: string; action: 'tareeq' | 'notify' | 'both' }
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, action } = body as { id: string; action: 'tareeq' | 'notify' | 'both' };
  if (!id || !['tareeq', 'notify', 'both'].includes(action)) {
    return NextResponse.json({ error: 'Missing id or invalid action' }, { status: 400 });
  }

  const perk = await prisma.membershipPerk.findUnique({ where: { id } });
  if (!perk) return NextResponse.json({ error: 'Perk not found' }, { status: 404 });

  let newPostId: string | null = perk.tareeqPostId;

  // ── Re-post to Tareeq ───────────────────────────────────────────────────────
  if (action === 'tareeq' || action === 'both') {
    try {
      const content = buildPerkTareeqContent(perk.title, perk.description, perk.linkUrl);
      const post = await prisma.tareeqPost.create({
        data: {
          userId: user.userId,
          authorName: 'مسلم ليدر',
          content,
          title: perk.title,
          category: 'عروض',
          imageUrl: perk.imageUrl ?? null,
        },
      });
      newPostId = post.id;
      await prisma.membershipPerk.update({ where: { id }, data: { tareeqPostId: post.id } });
    } catch { /* non-fatal */ }
  }

  // ── Re-notify active members ────────────────────────────────────────────────
  if (action === 'notify' || action === 'both') {
    const now = new Date();
    const activeMemberships = await prisma.familyMembership.findMany({
      where: { status: 'ACTIVE', expiresAt: { gt: now } },
      select: { ownerUserId: true, owner: { select: { email: true } } },
    });

    const userIds = activeMemberships.map(m => m.ownerUserId);
    if (userIds.length > 0) {
      await prisma.tareeqNotification.createMany({
        data: userIds.map(userId => ({
          userId,
          type: 'perk_new',
          actorName: 'مسلم ليدر',
          body: perk.title,
        })),
      }).catch(() => {});
    }

    const fromEmail = process.env.SMTP_USER || 'orders@moslimleader.com';
    const transporter = getTransporter();
    const safeTitle = esc(perk.title);
    const safeDesc = perk.description ? esc(perk.description) : null;
    const safeImg = safeUrl(perk.imageUrl);
    const safeLink = safeUrl(perk.linkUrl);

    const html = `
      <div dir="rtl" style="font-family:Cairo,Arial,sans-serif;max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
        <div style="background:linear-gradient(135deg,#1a1a2e,#0f3460);padding:24px 28px;text-align:center;">
          <p style="color:#FFCC00;font-size:22px;font-weight:900;margin:0;">ميزة جديدة لعضويتك ✨</p>
        </div>
        ${safeImg ? `<img src="${esc(safeImg)}" alt="" style="width:100%;max-height:220px;object-fit:cover;">` : ''}
        <div style="padding:24px 28px;">
          <p style="font-size:18px;font-weight:800;color:#1a1a2e;margin:0 0 10px;">${safeTitle}</p>
          ${safeDesc ? `<p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 16px;">${safeDesc}</p>` : ''}
          ${safeLink ? `<a href="${esc(safeLink)}" style="display:inline-block;background:#FFCC00;color:#1a1a2e;font-weight:800;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;">اكتشف التفاصيل</a>` : ''}
          <p style="color:#888;font-size:12px;margin:20px 0 0;">يمكنك مشاهدة جميع مزايا عضويتك في <a href="https://moslimleader.com/membership" style="color:#FFCC00;">صفحة عضويتك</a></p>
        </div>
      </div>`;

    const emails = activeMemberships.map(m => m.owner.email).filter(Boolean) as string[];
    for (let i = 0; i < emails.length; i += 10) {
      await Promise.allSettled(
        emails.slice(i, i + 10).map(email => transporter.sendMail({
          from: `"مسلم ليدر" <${fromEmail}>`,
          to: email,
          subject: `تذكير: ${perk.title}`,
          html,
        }))
      );
    }
  }

  return NextResponse.json({ ok: true, tareeqPostId: newPostId });
}
