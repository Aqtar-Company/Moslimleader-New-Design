export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm, requireSuperAdmin, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// Public-readable settings (no auth needed for GET).
const PUBLIC_KEYS = ['payment-methods'];

// Per-key write gating. Most settings are super-admin-only because they
// hold secrets (Bosta token, regional pricing rules, site flags) — but
// a few admin-panel surfaces should be writable by staff with the right
// granular permission. Add an entry here, NOT a new endpoint.
const KEY_WRITE_PERM: Record<string, Permission | 'superAdmin'> = {
  'payment-methods': 'payment-methods.write',
  // Everything else falls through to superAdmin.
};

// GET /api/admin/settings?key=xxx
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

// PUT /api/admin/settings — { key, value }. Per-key gating per
// KEY_WRITE_PERM above; defaults to super-admin.
export async function PUT(req: NextRequest) {
  try {
    const { key, value } = await req.json();
    if (!key) return NextResponse.json({ error: 'key مطلوب' }, { status: 400 });

    const required = KEY_WRITE_PERM[key];
    const guard = required && required !== 'superAdmin'
      ? await requirePerm(required)
      : await requireSuperAdmin();
    if ('response' in guard) return guard.response;
    const auth = guard.user;

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
