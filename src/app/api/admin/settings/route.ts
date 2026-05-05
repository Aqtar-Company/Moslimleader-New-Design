export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// Public-readable settings (no auth needed for GET).
const PUBLIC_KEYS = ['payment-methods'];

// GET /api/admin/settings?key=xxx — super-admin only for non-public keys.
// Site-wide secrets like Bosta token live here, so we explicitly do NOT
// open this up under settings.read for staff.
export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'key مطلوب' }, { status: 400 });

    if (!PUBLIC_KEYS.includes(key)) {
      const guard = await requireSuperAdmin();
      if ('response' in guard) return guard.response;
    }

    const setting = await prisma.setting.findUnique({ where: { key } });
    return NextResponse.json({ value: setting?.value ?? null });
  } catch (err) {
    console.error('[admin settings GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// PUT /api/admin/settings — { key, value }. Super-admin only (writes secrets).
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin();
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const { key, value } = await req.json();
    if (!key) return NextResponse.json({ error: 'key مطلوب' }, { status: 400 });

    const setting = await prisma.setting.upsert({
      where: { key },
      create: { key, value, updatedAt: new Date() },
      update: { value, updatedAt: new Date() },
    });

    await logActionSafe({
      actor: auth,
      action: key === 'payment-methods' ? 'payment-methods.update' : 'settings.update',
      entity: 'Setting',
      entityId: key,
      metadata: { key },
    });

    return NextResponse.json({ setting });
  } catch (err) {
    console.error('[admin settings PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
