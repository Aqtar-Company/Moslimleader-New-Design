export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { getTransporter } from '@/lib/smtp';

export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get('all') === '1';

  const perks = await prisma.membershipPerk.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ perks });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { title, description, imageUrl, linkUrl, validUntil, isActive, postToTareeq } = body;

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  let tareeqPostId: string | null = null;

  if (postToTareeq) {
    try {
      const post = await prisma.tareeqPost.create({
        data: {
          userId: user.userId,
          authorName: 'مسلم ليدر',
          content: description?.trim() || title.trim(),
          title: title.trim(),
          category: 'عروض',
          imageUrl: imageUrl || null,
        },
      });
      tareeqPostId = post.id;
    } catch { /* non-fatal */ }
  }

  const perk = await prisma.membershipPerk.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      imageUrl: imageUrl || null,
      linkUrl: linkUrl?.trim() || null,
      validUntil: validUntil ? new Date(validUntil) : null,
      isActive: isActive !== false,
      tareeqPostId,
    },
  });

  // Notify active members by email (fire-and-forget)
  if (perk.isActive) {
    notifyActiveMembers(perk).catch(() => {});
  }

  return NextResponse.json({ perk });
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeUrl(u: string | null): string | null {
  if (!u) return null;
  try { const p = new URL(u); return (p.protocol === 'https:' || p.protocol === 'http:') ? u : null; } catch { return null; }
}

async function notifyActiveMembers(perk: { title: string; description: string | null; imageUrl: string | null; linkUrl: string | null }) {
  const now = new Date();
  const activeMemberships = await prisma.familyMembership.findMany({
    where: { status: 'ACTIVE', expiresAt: { gt: now } },
    select: { ownerUserId: true, owner: { select: { email: true } } },
  });

  // In-app TareeqNotification for each member
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

  const emails = activeMemberships.map(m => m.owner.email).filter(Boolean) as string[];
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

  // Send in batches of 10 to avoid blocking the SMTP connection for too long
  for (let i = 0; i < emails.length; i += 10) {
    await Promise.allSettled(
      emails.slice(i, i + 10).map(email => transporter.sendMail({
        from: `"مسلم ليدر" <${fromEmail}>`,
        to: email,
        subject: `ميزة جديدة لعضويتك: ${perk.title}`,
        html,
      }))
    );
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, title, description, imageUrl, linkUrl, validUntil, isActive, sortOrder } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const perk = await prisma.membershipPerk.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
      ...(linkUrl !== undefined && { linkUrl: linkUrl?.trim() || null }),
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
    },
  });

  return NextResponse.json({ perk });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.membershipPerk.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
