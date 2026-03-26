export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';


async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// GET /api/admin/reviews — all reviews from DB + hardcoded from static products
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const dbReviews = await prisma.review.findMany({
      include: { product: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    const formatted = dbReviews.map(r => ({
      id: r.id,
      productId: r.productId,
      productName: r.product.name,
      author: r.author,
      rating: r.rating,
      comment: r.comment,
      date: r.date.toISOString().split('T')[0],
      isHardcoded: false,
    }));

    // Include hardcoded reviews from static products
    const hardcoded: typeof formatted = [];
    staticProducts.forEach(p => {
      (p.reviews ?? []).forEach(r => {
        hardcoded.push({
          id: r.id,
          productId: p.id,
          productName: p.name,
          author: r.author,
          rating: r.rating,
          comment: r.comment,
          date: r.date,
          isHardcoded: true,
        });
      });
    });

    const all = [...formatted, ...hardcoded].sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json({ reviews: all });
  } catch (err) {
    console.error('[admin reviews GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE /api/admin/reviews?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin reviews DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
