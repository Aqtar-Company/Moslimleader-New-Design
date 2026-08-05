export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/reviews?productId=xxx
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId');
  if (!productId) return NextResponse.json({ reviews: [], count: 0 });

  const reviews = await prisma.review.findMany({
    where: { productId, approved: true },
    orderBy: { date: 'desc' },
    take: 20,
    select: { id: true, author: true, comment: true, date: true, verified: true },
  });

  return NextResponse.json({ reviews, count: reviews.length });
}

// POST /api/reviews — submit a new experience
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`review:${ip}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const productId = String(body.productId ?? '').trim();
  const comment   = String(body.comment ?? '').trim();
  const author    = String(body.author ?? '').trim() || 'مجهول';

  if (!productId || comment.length < 10) {
    return NextResponse.json({ error: 'اكتب تجربتك (10 أحرف على الأقل)' }, { status: 400 });
  }
  if (comment.length > 1000) {
    return NextResponse.json({ error: 'التجربة طويلة جداً (1000 حرف كحد أقصى)' }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return NextResponse.json({ error: 'منتج غير موجود' }, { status: 404 });

  const user = await getAuthUser().catch(() => null);

  // Prevent duplicate submission from same logged-in user
  if (user?.userId) {
    const existing = await prisma.review.findFirst({ where: { productId, userId: user.userId } });
    if (existing) return NextResponse.json({ error: 'شاركت تجربتك مع هذا المنتج من قبل' }, { status: 409 });
  }

  await prisma.review.create({
    data: { productId, userId: user?.userId ?? null, author, rating: 5, comment, approved: true },
  });

  // Update reviewCount on the product
  const count = await prisma.review.count({ where: { productId, approved: true } });
  await prisma.product.updateMany({ where: { id: productId }, data: { reviewCount: count } });

  return NextResponse.json({ ok: true, message: 'شكراً على مشاركة تجربتك!' });
}
