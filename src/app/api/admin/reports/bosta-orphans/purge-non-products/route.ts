export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { extractDescription } from '@/lib/bosta-orphans';
import { normaliseArabic } from '@/lib/arabic-normalize';

// Bosta historical imports include shipments for Art Learn Academy
// (a separate business — art / architecture courses). Owner doesn't
// want them counted toward Moslim Leader sales/valuation, so we
// delete them outright. Always dry-run first; the audit log records
// the deletion so the orderIds aren't lost forever.

const PURGE_PATTERNS: RegExp[] = [
  /(^|\s)فنون(\s|$|\+|و|تشكيلي)/,
  /(^|\s)عماره(\s|$|\+|و)/,
  /(^|\s)باكدج(\s|$)/,
  /(^|\s)باكيدج(\s|$)/,
  /art\s+learn\s+academy/i,
  /(^|\s)التصوير\s+الفوتوغرافي/,
  /كراسات\s+التمارين/,
  /الشرح\s+فقط/,
];

interface Body {
  dryRun?: boolean;
  alsoOrphansWithoutDescription?: boolean; // optional: also delete null-desc orphans
}

export async function POST(req: NextRequest) {
  const guard = await requirePerm('inventory.write');
  if ('response' in guard) return guard.response;

  let body: Body = {};
  try { body = await req.json(); } catch { /* empty body OK */ }
  const dryRun = body.dryRun !== false; // default true

  // Pull every orphan with its description so we can match against
  // the purge patterns. We don't pre-filter in SQL because the keyword
  // sits in the JSON shipment payload, not a direct column.
  const orphans = await prisma.order.findMany({
    where: { paymentMethod: 'bosta-historical', items: { none: {} } },
    select: {
      id: true, total: true, createdAt: true,
      shipment: { select: { rawPayload: true, trackingNumber: true } },
    },
  });

  const matched: Array<{ orderId: string; createdAt: string; total: number; trackingNumber: string | null; description: string | null; matchedPattern: string }> = [];
  for (const o of orphans) {
    const description = extractDescription(o.shipment?.rawPayload);
    if (!description) continue;
    const norm = normaliseArabic(description);
    const hit = PURGE_PATTERNS.find(re => re.test(norm) || re.test(description));
    if (hit) {
      matched.push({
        orderId: o.id,
        createdAt: o.createdAt.toISOString(),
        total: Number(o.total ?? 0),
        trackingNumber: o.shipment?.trackingNumber ?? null,
        description,
        matchedPattern: hit.source,
      });
    }
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldDelete: matched.length,
      totalValue: matched.reduce((s, m) => s + m.total, 0),
      sample: matched.slice(0, 15),
    });
  }

  // Real run — delete the orders. Their shipments cascade via
  // Prisma's onDelete defined in the schema; if not, we'd nuke them
  // explicitly here. We log the full list to the audit log first so
  // the orderIds and totals are preserved should we need them.
  const orderIds = matched.map(m => m.orderId);

  await logActionSafe({
    actor: guard.user,
    action: 'order.delete',
    entity: 'BostaOrphanPurge',
    entityId: `purge-${Date.now()}`,
    metadata: {
      reason: 'Art Learn Academy / non-Moslim-Leader products',
      count: matched.length,
      totalValue: matched.reduce((s, m) => s + m.total, 0),
      orderIds,
      patterns: PURGE_PATTERNS.map(r => r.source),
    },
  });

  // Schema has onDelete: Cascade on Shipment.orderId and
  // OrderItem.orderId, so deleting the Order is enough — the
  // shipment + items disappear with it. Chunked to avoid lock
  // contention on a big batch.
  let deleted = 0;
  const CHUNK = 100;
  for (let i = 0; i < orderIds.length; i += CHUNK) {
    const slice = orderIds.slice(i, i + CHUNK);
    const r = await prisma.order.deleteMany({ where: { id: { in: slice } } });
    deleted += r.count;
  }

  return NextResponse.json({
    ok: true,
    dryRun: false,
    deleted,
    totalValue: matched.reduce((s, m) => s + m.total, 0),
  });
}
