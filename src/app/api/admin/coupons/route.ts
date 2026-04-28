export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';


async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// GET /api/admin/coupons
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ coupons });
  } catch (err) {
    console.error('[admin coupons GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/admin/coupons — create coupon
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { code, discount, showBanner, bannerText, bannerColor } = await req.json();
    if (!code || !discount) return NextResponse.json({ error: 'code و discount مطلوبان' }, { status: 400 });

    if (showBanner) {
      await prisma.coupon.updateMany({ where: { showBanner: true }, data: { showBanner: false } });
    }

    const coupon = await prisma.coupon.upsert({
      where: { code: code.toUpperCase().trim() },
      create: {
        code: code.toUpperCase().trim(),
        discount: Number(discount),
        isActive: true,
        showBanner: showBanner || false,
        bannerText: bannerText || null,
        bannerColor: bannerColor || null,
      },
      update: {
        discount: Number(discount),
        isActive: true,
        showBanner: showBanner ?? undefined,
        bannerText: bannerText ?? undefined,
        bannerColor: bannerColor ?? undefined,
      },
    });

    return NextResponse.json({ coupon });
  } catch (err) {
    console.error('[admin coupons POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// PUT /api/admin/coupons — toggle banner on a coupon
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { code, showBanner, bannerText, bannerColor } = await req.json();
    if (!code) return NextResponse.json({ error: 'code مطلوب' }, { status: 400 });

    if (showBanner) {
      await prisma.coupon.updateMany({ where: { showBanner: true }, data: { showBanner: false } });
    }

    const coupon = await prisma.coupon.update({
      where: { code },
      data: {
        showBanner: showBanner ?? false,
        bannerText: bannerText ?? null,
        bannerColor: bannerColor ?? null,
      },
    });

    return NextResponse.json({ coupon });
  } catch (err) {
    console.error('[admin coupons PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE /api/admin/coupons?code=XXX
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'code مطلوب' }, { status: 400 });

    await prisma.coupon.delete({ where: { code } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin coupons DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
