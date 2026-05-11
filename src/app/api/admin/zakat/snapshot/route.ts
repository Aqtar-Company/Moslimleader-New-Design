export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { computeZakat, type ValuationMethod } from '@/lib/zakat-engine';
import { gregorianToHijri, dhulHijjah1Label } from '@/lib/hijri';

// POST — persist a Zakat snapshot for the supplied Hijri year.
// Immutable after save; subsequent updates only PATCH paymentStatus /
// paymentDate / notes via the [id] sibling route.
export async function POST(req: NextRequest) {
  const guard = await requirePerm('zakat.write');
  if ('response' in guard) return guard.response;

  let body: {
    method?: ValuationMethod; cashOnHand?: number; avgActualWindowDays?: number;
    manualValuation?: Record<string, number>; notes?: string;
    hijriYearOverride?: string; // optional — defaults to current Hijri year
    excludedBatchIds?: string[];
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const method = (['retail', 'wholesale', 'avg-actual', 'manual'] as const).includes(body.method as ValuationMethod)
    ? body.method as ValuationMethod
    : 'retail';
  const cashOnHand = Number.isFinite(Number(body.cashOnHand)) ? Math.max(0, Number(body.cashOnHand)) : 0;
  const avgActualWindowDays = Number.isFinite(Number(body.avgActualWindowDays))
    ? Math.max(30, Math.min(365, Number(body.avgActualWindowDays)))
    : 90;
  const excludedBatchIds = Array.isArray(body.excludedBatchIds) ? body.excludedBatchIds.filter((x): x is string => typeof x === 'string') : [];

  const today = new Date();
  const hijri = gregorianToHijri(today);
  const hijriYear = body.hijriYearOverride?.trim() || String(hijri.year);
  const hijriDateLabel = dhulHijjah1Label(Number(hijriYear));

  // Reject if this Hijri year already has a snapshot — they're meant
  // to be one-per-year. Admin can delete via DB if they really need to
  // redo, but the API path is intentionally absent.
  const existing = await prisma.zakatSnapshot.findUnique({ where: { hijriYear } });
  if (existing) {
    return NextResponse.json({
      error: `يوجد snapshot محفوظ بالفعل لسنة ${hijriYear}. الـ snapshots ثابتة لكل سنة هجرية.`,
    }, { status: 409 });
  }

  const computation = await computeZakat({
    method, cashOnHand, avgActualWindowDays,
    manualValuation: body.manualValuation,
    excludedBatchIds,
  });

  // Save snapshot + per-product items in one transaction so a partial
  // write can never leave half a row.
  const created = await prisma.$transaction(async tx => {
    const snap = await tx.zakatSnapshot.create({
      data: {
        hijriYear,
        hijriDateLabel,
        gregorianDate: today,
        inventoryValuationMethod: method,
        inventoryValueRetail: computation.inventoryValueRetail,
        inventoryValueWholesale: computation.inventoryValueWholesale,
        inventoryValueAvgActual: computation.inventoryValueAvgActual,
        inventoryValueManual: computation.inventoryValueManual,
        inventoryValueUsed: computation.inventoryValueUsed,
        cashOnHand: computation.cashOnHand,
        receivables: computation.receivables,
        liabilities: computation.liabilities,
        zakatPool: computation.zakatPool,
        zakatAmount: computation.zakatAmount,
        goldPricePerGram24K: computation.goldPrice?.pricePerGram24K ?? null,
        goldPriceSource: computation.goldPrice?.source ?? null,
        nisabGrams: 85,
        nisabValue: computation.nisabValue,
        zakatDue: computation.zakatDue,
        excludedBatchIds: excludedBatchIds.length > 0 ? excludedBatchIds : undefined,
        paymentStatus: 'unpaid',
        notes: body.notes?.trim() || null,
        createdByUserId: guard.user.userId,
      },
    });
    if (computation.items.length > 0) {
      await tx.zakatSnapshotItem.createMany({
        data: computation.items.map(it => ({
          snapshotId: snap.id,
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitValue: it.unitValue,
          totalValue: it.totalValue,
          valuationMethod: it.valuationMethod,
        })),
      });
    }
    return snap;
  }, { timeout: 60000 });

  await logActionSafe({
    actor: guard.user, action: 'zakat.snapshot-create',
    entity: 'ZakatSnapshot', entityId: created.id,
    metadata: { hijriYear, method, zakatAmount: computation.zakatAmount, itemCount: computation.items.length },
  });

  return NextResponse.json({ ok: true, snapshot: created });
}
