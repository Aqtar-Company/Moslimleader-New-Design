export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// Roll back a previous bulk-match run by batchId. We look up every
// per-row audit entry tagged with the batchId, delete the OrderItems
// that the bulk-match created, and write a single bulk-undo audit
// entry. Designed for the case where a spot-check after a bulk run
// reveals systematic misattribution and the owner wants a single-click
// reset rather than picking through individual orders.

interface UndoBody { batchId?: string }

export async function POST(req: NextRequest) {
  const guard = await requirePerm('inventory.write');
  if ('response' in guard) return guard.response;

  let body: UndoBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const batchId = String(body.batchId ?? '').trim();
  if (!batchId) return NextResponse.json({ error: 'batchId مطلوب' }, { status: 400 });

  // Find every per-row entry from the bulk-match run. The summary row
  // has entity='BostaBulkBatch' so we exclude it; we only want the
  // per-Order entries (entity='Order') that point to specific orders.
  const entries = await prisma.auditLog.findMany({
    where: {
      action: 'bosta.bulk-match',
      entity: 'Order',
      // metadata is JSON; filter in code rather than via Prisma JSON path
      // to keep it portable across MySQL / Postgres (we're on MySQL).
    },
    select: { id: true, entityId: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  const matchingOrderIds: string[] = [];
  for (const e of entries) {
    const meta = e.metadata as Record<string, unknown> | null;
    if (meta && typeof meta.batchId === 'string' && meta.batchId === batchId && e.entityId) {
      matchingOrderIds.push(e.entityId);
    }
  }

  if (matchingOrderIds.length === 0) {
    return NextResponse.json({ error: 'مفيش طلبات مرتبطة بهذه الدفعة', batchId, deleted: 0 }, { status: 404 });
  }

  // Delete the OrderItems that the bulk run created. Note: we do NOT
  // re-derive "what items were created" from the audit metadata — the
  // safe assumption is that the bulk run added items to orders that
  // had none, so any items currently on those orders were added by it.
  // (This isn't perfect if the owner manually edited an order between
  // the bulk-match and the undo, but it's the simplest correct
  // behaviour for the intended use case.)
  const deleteResult = await prisma.orderItem.deleteMany({
    where: { orderId: { in: matchingOrderIds } },
  });

  await logActionSafe({
    actor: guard.user,
    action: 'bosta.bulk-undo',
    entity: 'BostaBulkBatch',
    entityId: batchId,
    metadata: {
      batchId,
      affectedOrders: matchingOrderIds.length,
      itemsDeleted: deleteResult.count,
    },
  });

  return NextResponse.json({
    ok: true,
    batchId,
    affectedOrders: matchingOrderIds.length,
    itemsDeleted: deleteResult.count,
  });
}

// GET — list the most recent bulk-match batches (so the UI can offer
// "undo last batch" as a single button without making the owner
// remember the batchId).
export async function GET() {
  const guard = await requirePerm('inventory.read');
  if ('response' in guard) return guard.response;

  const summaries = await prisma.auditLog.findMany({
    where: { action: 'bosta.bulk-match', entity: 'BostaBulkBatch' },
    select: { entityId: true, metadata: true, createdAt: true, actorName: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return NextResponse.json({
    batches: summaries.map(s => {
      const meta = (s.metadata ?? {}) as Record<string, unknown>;
      return {
        batchId: s.entityId,
        createdAt: s.createdAt.toISOString(),
        actorName: s.actorName,
        matchedCount: Number(meta.matchedCount ?? 0),
        errorCount: Number(meta.errorCount ?? 0),
        minConfidence: Number(meta.minConfidence ?? 0),
      };
    }),
  });
}
