export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { invalidateAssistantContext } from '@/lib/assistant-knowledge';

// GET /api/admin/coupons
export async function GET() {
  try {
    const guard = await requirePerm(['coupons.read', 'coupons.write'] as Permission[]);
    if ('response' in guard) return guard.response;

    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ coupons });
  } catch (err) {
    console.error('[admin coupons GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/admin/coupons — create / upsert coupon
export async function POST(req: NextRequest) {
  try {
    const guard = await requirePerm('coupons.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const { code, discount, showBanner, bannerText, bannerColor } = await req.json();
    if (!code || !discount) return NextResponse.json({ error: 'code و discount مطلوبان' }, { status: 400 });

    if (showBanner) {
      await prisma.coupon.updateMany({ where: { showBanner: true }, data: { showBanner: false } });
    }

    const normalised = code.toUpperCase().trim();
    const existing = await prisma.coupon.findUnique({ where: { code: normalised } });

    const coupon = await prisma.coupon.upsert({
      where: { code: normalised },
      create: {
        code: normalised,
        discount: Number(discount),
        isActive: true,
        showBanner: showBanner || false,
        bannerText: bannerText || null,
        bannerColor: bannerColor || null,
        createdByUserId: auth.userId,
        lastEditedByUserId: auth.userId,
      },
      update: {
        discount: Number(discount),
        isActive: true,
        showBanner: showBanner ?? undefined,
        bannerText: bannerText ?? undefined,
        bannerColor: bannerColor ?? undefined,
        lastEditedByUserId: auth.userId,
      },
    });

    invalidateAssistantContext();
    await logActionSafe({
      actor: auth,
      action: existing ? 'coupon.update' : 'coupon.create',
      entity: 'Coupon',
      entityId: coupon.code,
      before: existing ? { discount: existing.discount, showBanner: existing.showBanner } : null,
      after: { discount: coupon.discount, showBanner: coupon.showBanner },
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
    const guard = await requirePerm('coupons.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const { code, showBanner, bannerText, bannerColor } = await req.json();
    if (!code) return NextResponse.json({ error: 'code مطلوب' }, { status: 400 });

    const normalizedCode = code.toUpperCase().trim();

    const coupon = await prisma.$transaction(async (tx) => {
      if (showBanner) {
        await tx.coupon.updateMany({ where: { showBanner: true }, data: { showBanner: false } });
      }
      return tx.coupon.update({
        where: { code: normalizedCode },
        data: {
          showBanner: showBanner ?? false,
          bannerText: bannerText ?? null,
          bannerColor: bannerColor ?? null,
          lastEditedByUserId: auth.userId,
        },
      });
    });

    invalidateAssistantContext();
    await logActionSafe({
      actor: auth,
      action: 'coupon.update',
      entity: 'Coupon',
      entityId: coupon.code,
      after: { showBanner: coupon.showBanner, bannerText: coupon.bannerText },
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
    const guard = await requirePerm('coupons.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'code مطلوب' }, { status: 400 });

    await prisma.coupon.delete({ where: { code } });
    invalidateAssistantContext();
    await logActionSafe({
      actor: auth,
      action: 'coupon.delete',
      entity: 'Coupon',
      entityId: code,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin coupons DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
