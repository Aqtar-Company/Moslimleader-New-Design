export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

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

  return NextResponse.json({ perk });
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
