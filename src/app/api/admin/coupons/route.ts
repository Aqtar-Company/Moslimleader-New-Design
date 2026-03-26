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

    const { code, discount } = await req.json();
    if (!code || !discount) return NextResponse.json({ error: 'code و discount مطلوبان' }, { status: 400 });

    const coupon = await prisma.coupon.upsert({
      where: { code: code.toUpperCase().trim() },
      create: { code: code.toUpperCase().trim(), discount: Number(discount), isActive: true },
      update: { discount: Number(discount), isActive: true },
    });

    return NextResponse.json({ coupon });
  } catch (err) {
    console.error('[admin coupons POST]', err);
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
