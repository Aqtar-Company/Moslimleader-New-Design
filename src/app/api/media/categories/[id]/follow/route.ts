export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';

/**
 * «تابع التصنيف» — POST follows, DELETE unfollows. A follower is told in طريق (bell + push,
 * under the «تصنيفات الوسائط التي أتابعها» switch) when a new item is published on the shelf.
 */
async function handle(req: NextRequest, id: string, follow: boolean) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'سجّل الدخول لتتابع', needsLogin: true }, { status: 401 });
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const rl = await tareeqRateLimit('media-follow', user.userId, 30, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول بعد قليل' }, { status: 429 });

  if (follow) {
    const cat = await prisma.freeMediaCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!cat) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    await prisma.freeMediaCategoryFollow.upsert({
      where: { userId_categoryId: { userId: user.userId, categoryId } },
      create: { userId: user.userId, categoryId },
      update: {},
    });
  } else {
    await prisma.freeMediaCategoryFollow.deleteMany({ where: { userId: user.userId, categoryId } });
  }
  return NextResponse.json({ following: follow });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(req, params.id, true);
}
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(req, params.id, false);
}
