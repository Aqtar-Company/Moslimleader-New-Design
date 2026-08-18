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

async function notifyActiveMembers(perk: { title: string; description: string | null; imageUrl: string | null; linkUrl: string | null }) {
  const now = new Date();
  const activeMemberships = await prisma.familyMembership.findMany({
    where: { status: 'ACTIVE', expiresAt: { gt: now } },
    select: { owner: { select: { email: true } } },
  });

  const fromEmail = process.env.SMTP_USER || 'orders@moslimleader.com';
  const transporter = getTransporter();

  for (const m of activeMemberships) {
    const { email } = m.owner;
    if (!email) continue;
    const html = `
      <div dir="rtl" style="font-family:Cairo,Arial,sans-serif;max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
        <div style="background:linear-gradient(135deg,#1a1a2e,#0f3460);padding:24px 28px;text-align:center;">
          <p style="color:#FFCC00;font-size:22px;font-weight:900;margin:0;">ميزة جديدة لعضويتك ✨</p>
        </div>
        ${perk.imageUrl ? `<img src="${perk.imageUrl}" alt="" style="width:100%;max-height:220px;object-fit:cover;">` : ''}
        <div style="padding:24px 28px;">
          <p style="font-size:18px;font-weight:800;color:#1a1a2e;margin:0 0 10px;">${perk.title}</p>
          ${perk.description ? `<p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 16px;">${perk.description}</p>` : ''}
          ${perk.linkUrl ? `<a href="${perk.linkUrl}" style="display:inline-block;background:#FFCC00;color:#1a1a2e;font-weight:800;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;">اكتشف التفاصيل</a>` : ''}
          <p style="color:#888;font-size:12px;margin:20px 0 0;">يمكنك مشاهدة جميع مزايا عضويتك في <a href="https://moslimleader.com/account" style="color:#FFCC00;">حسابك</a></p>
        </div>
      </div>`;
    await transporter.sendMail({
      from: `"مسلم ليدر" <${fromEmail}>`,
      to: email,
      subject: `ميزة جديدة لعضويتك: ${perk.title}`,
      html,
    }).catch(() => {});
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
