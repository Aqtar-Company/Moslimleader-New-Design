export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { SETTING_KEY, mergeWithDefaults, invalidateIntlShippingCache, type IntlShippingConfig } from '@/lib/intl-shipping';

// GET /api/admin/intl-shipping — admin read (uses same Setting row as the
// public endpoint; just gated on shipping.read so staff with that perm
// can preview).
export async function GET() {
  const guard = await requirePerm(['shipping.read', 'shipping.write']);
  if ('response' in guard) return guard.response;
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  return NextResponse.json({ config: mergeWithDefaults(row?.value as Partial<IntlShippingConfig> | null) });
}

// PUT /api/admin/intl-shipping — write the new config + audit log entry.
export async function PUT(req: NextRequest) {
  const guard = await requirePerm('shipping.write');
  if ('response' in guard) return guard.response;
  const actor = guard.user;

  const body = await req.json().catch(() => ({}));
  const incoming = body?.config as Partial<IntlShippingConfig> | undefined;
  if (!incoming || typeof incoming !== 'object') {
    return NextResponse.json({ error: 'config مطلوب' }, { status: 400 });
  }

  // Validate the basics so we never write garbage into the Setting row.
  if (typeof incoming.enabled !== 'undefined' && typeof incoming.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled لازم يكون boolean' }, { status: 400 });
  }
  if (incoming.zones && !Array.isArray(incoming.zones)) {
    return NextResponse.json({ error: 'zones لازم تكون array' }, { status: 400 });
  }
  if (incoming.blockedCountries && !Array.isArray(incoming.blockedCountries)) {
    return NextResponse.json({ error: 'blockedCountries لازم تكون array' }, { status: 400 });
  }

  const next = mergeWithDefaults(incoming);

  // Read the existing row so the audit "before" reflects what was there.
  const existing = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  const before = (existing?.value ?? null) as Partial<IntlShippingConfig> | null;

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: next as unknown as object, updatedAt: new Date() },
    update: { value: next as unknown as object, updatedAt: new Date() },
  });

  invalidateIntlShippingCache();

  // Compact diff for the audit row — full snapshots blow up the log size
  // when zone/country lists change. Just record the high-signal fields.
  await logActionSafe({
    actor,
    action: 'intl-shipping.update',
    entity: 'Setting',
    entityId: SETTING_KEY,
    before: before ? {
      enabled: before.enabled,
      blockedCountriesCount: before.blockedCountries?.length ?? 0,
      handlingFee: before.handlingFee,
    } : null,
    after: {
      enabled: next.enabled,
      blockedCountriesCount: next.blockedCountries.length,
      handlingFee: next.handlingFee,
    },
  });

  return NextResponse.json({ ok: true, config: next });
}
