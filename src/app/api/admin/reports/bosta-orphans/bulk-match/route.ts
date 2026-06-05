export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { applyBackfillEntry, buildOrphanRow, type OrphanRow } from '@/lib/bosta-orphans';

// Bulk auto-match: scores every Bosta orphan and applies any whose
// confidence ≥ minConfidence in one shot. Always run dryRun first to
// preview; the real run logs each match to the audit log under a
// shared batchId so the entire batch can be rolled back via the
// bulk-undo endpoint if a spot-check shows misattributions.
//
// Risk profile per plan addendum 25: owner accepts auto-confirming at
// confidence ≥ 0.5 because hundreds of orphans are too many to review
// by hand. The widened price tolerance (±15% full credit) absorbs the
// roughly-10% historical price drift between import era and today.

interface BulkMatchBody {
  minConfidence?: number;
  dryRun?: boolean;
  limit?: number;
}

const DEFAULT_MIN_CONFIDENCE = 0.5;
const DEFAULT_LIMIT = 500;
const HARD_LIMIT = 1000;
const MAX_CONSECUTIVE_FAILURES = 5;

export async function POST(req: NextRequest) {
  const guard = await requirePerm(['inventory.write', 'orders.write']);
  if ('response' in guard) return guard.response;

  let body: BulkMatchBody = {};
  try { body = await req.json(); } catch { /* empty body OK — use defaults */ }

  const minConfidence = clamp(Number(body.minConfidence ?? DEFAULT_MIN_CONFIDENCE), 0, 1);
  const dryRun = body.dryRun !== false; // default true — caller must opt out
  const limit = Math.min(Math.max(1, Math.floor(Number(body.limit ?? DEFAULT_LIMIT)) || DEFAULT_LIMIT), HARD_LIMIT);

  const [orphans, products] = await Promise.all([
    prisma.order.findMany({
      where: { paymentMethod: 'bosta-historical', items: { none: {} } },
      select: {
        id: true, total: true, createdAt: true,
        user: { select: { name: true } },
        shipment: { select: { trackingNumber: true, rawPayload: true, cod: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.product.findMany({
      select: { id: true, name: true, price: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const rows = orphans.map(o => buildOrphanRow(o, products));
  // Eligibility: any orphan whose confidence clears the threshold AND
  // has at least one matched item. We dropped the strict "all items
  // must match" rule — owner explicitly wants approximate sales
  // figures, not pixel-perfect attribution, so a partial match is
  // better than nothing.
  const eligible = rows.filter(r =>
    r.confidence >= minConfidence
    && r.suggestedItems.length > 0,
  );
  const skipped = rows.length - eligible.length;

  // Diagnostic breakdown so the owner can see WHY orphans don't
  // qualify (e.g. "200 had no parseable description" is very
  // different from "200 fell just below the threshold").
  const diagnostics = {
    noDescription: rows.filter(r => !r.description).length,
    noParsedItems: rows.filter(r => r.description && r.parsedItems.length === 0).length,
    noMatchedItems: rows.filter(r => r.parsedItems.length > 0 && r.suggestedItems.length === 0).length,
    belowThreshold: rows.filter(r => r.suggestedItems.length > 0 && r.confidence < minConfidence).length,
    confidenceBuckets: {
      '0-25': rows.filter(r => r.confidence < 0.25).length,
      '25-50': rows.filter(r => r.confidence >= 0.25 && r.confidence < 0.5).length,
      '50-65': rows.filter(r => r.confidence >= 0.5 && r.confidence < 0.65).length,
      '65-80': rows.filter(r => r.confidence >= 0.65 && r.confidence < 0.8).length,
      '80-100': rows.filter(r => r.confidence >= 0.8).length,
    },
  };

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      scanned: rows.length,
      wouldMatch: eligible.length,
      wouldSkip: skipped,
      minConfidence,
      diagnostics,
      sampleMatches: eligible.slice(0, 20).map(summarize),
    });
  }

  // Real run — one transaction per match keeps a single bad row from
  // poisoning the whole batch. We bail after MAX_CONSECUTIVE_FAILURES
  // in a row in case something systemic is wrong.
  const batchId = `bosta-bulk-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  const matched: Array<{ orderId: string; itemCount: number; productIds: string[]; confidence: number; priceDriftPct: number | null }> = [];
  const errors: Array<{ orderId: string; error: string }> = [];
  let consecutiveFailures = 0;

  for (const row of eligible) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      errors.push({ orderId: '__abort__', error: `توقف بعد ${MAX_CONSECUTIVE_FAILURES} أخطاء متتالية — راجع البيانات` });
      break;
    }
    try {
      const itemCount = await prisma.$transaction(async tx => {
        const r = await applyBackfillEntry(tx, {
          orderId: row.orderId,
          items: row.suggestedItems.map(s => ({
            productId: s.productId,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
          })),
        });
        if (!r.ok) throw new Error(r.error);
        return r.itemCount;
      }, { timeout: 15000 });

      matched.push({
        orderId: row.orderId,
        itemCount,
        productIds: row.suggestedItems.map(s => s.productId),
        confidence: row.confidence,
        priceDriftPct: row.priceDriftPct,
      });
      consecutiveFailures = 0;

      // Per-row audit entry — all carry the same batchId so bulk-undo
      // can find them with a single query.
      await logActionSafe({
        actor: guard.user,
        action: 'bosta.bulk-match',
        entity: 'Order',
        entityId: row.orderId,
        metadata: {
          batchId,
          confidence: row.confidence,
          priceDriftPct: row.priceDriftPct,
          productIds: row.suggestedItems.map(s => s.productId),
          itemCount,
          minConfidence,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل غير معروف';
      errors.push({ orderId: row.orderId, error: msg });
      consecutiveFailures++;
    }
  }

  // Single batch-summary row so the audit log has one canonical entry
  // for the whole run (handy for "show me all bulk runs" listings).
  await logActionSafe({
    actor: guard.user,
    action: 'bosta.bulk-match',
    entity: 'BostaBulkBatch',
    entityId: batchId,
    metadata: {
      batchId,
      summary: true,
      matchedCount: matched.length,
      errorCount: errors.length,
      minConfidence,
      scanned: rows.length,
    },
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    batchId,
    matched: matched.length,
    skipped,
    errors,
    sampleMatches: matched.slice(0, 10),
  });
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function summarize(r: OrphanRow) {
  return {
    orderId: r.orderId,
    customerName: r.customerName,
    confidence: r.confidence,
    priceDriftPct: r.priceDriftPct,
    suggestedSum: r.suggestedSum,
    orderTotal: r.orderTotal,
    cod: r.cod,
    items: r.suggestedItems.map(s => ({
      productName: s.productName,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      matchScore: s.matchScore,
      parsedName: s.parsedName,
    })),
  };
}
