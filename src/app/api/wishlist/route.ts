export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';


// GET /api/wishlist — get user's wishlist product IDs
export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ ids: [] }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { wishlistIds: true },
    });

    const ids: string[] = (user?.wishlistIds as string[]) ?? [];
    return NextResponse.json({ ids });
  } catch (err) {
    console.error('[wishlist GET]', err);
    return NextResponse.json({ ids: [] }, { status: 500 });
  }
}

// POST /api/wishlist — set full wishlist (array of product IDs)
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { ids } = await req.json();
    if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids يجب أن يكون مصفوفة' }, { status: 400 });

    await prisma.user.update({
      where: { id: auth.userId },
      data: { wishlistIds: ids },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[wishlist POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
