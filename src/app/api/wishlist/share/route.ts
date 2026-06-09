export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { getMergedStaticProducts } from '@/lib/product-overrides';

// POST /api/wishlist/share — create a shareable link snapshot
export async function POST() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { wishlistIds: true },
    });

    const ids: string[] = (user?.wishlistIds as string[]) ?? [];
    if (ids.length === 0) return NextResponse.json({ error: 'قائمة الأمنيات فارغة' }, { status: 400 });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const link = await prisma.wishlistShareLink.create({
      data: {
        userId: auth.userId,
        productIds: ids,
        expiresAt,
      },
    });

    return NextResponse.json({ token: link.token, expiresAt: link.expiresAt.toISOString() });
  } catch (err) {
    console.error('[wishlist/share POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// GET /api/wishlist/share?token=xxx — fetch shared wishlist products
export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'token مطلوب' }, { status: 400 });

    const link = await prisma.wishlistShareLink.findUnique({ where: { token } });
    if (!link) return NextResponse.json({ error: 'الرابط غير موجود' }, { status: 404 });
    if (link.expiresAt < new Date()) return NextResponse.json({ error: 'انتهت صلاحية الرابط' }, { status: 410 });

    // Increment view count
    await prisma.wishlistShareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 } },
    });

    const productIds = link.productIds as string[];

    // Fetch products: try DB + static merge
    const [mergedStatic, dbProducts] = await Promise.all([
      getMergedStaticProducts(),
      prisma.product.findMany({ where: { id: { in: productIds }, source: 'admin' } }),
    ]);

    const allProducts = [...mergedStatic, ...dbProducts];
    const wishlistProducts = productIds
      .map(id => allProducts.find(p => p.id === id))
      .filter(Boolean);

    return NextResponse.json({ products: wishlistProducts, ownerName: null });
  } catch (err) {
    console.error('[wishlist/share GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
