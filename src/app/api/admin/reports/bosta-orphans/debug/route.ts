export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { normaliseArabic } from '@/lib/arabic-normalize';
import { extractDescription, parseItemsFromDescription, matchProduct } from '@/lib/bosta-orphans';

// Scan EVERY remaining orphan and aggregate the parsed-name patterns,
// grouped by whether they matched a product, were intentionally
// ignored, or fell through unmatched. Lets us see what gaps still
// need aliases/ignores in one shot.

export async function GET() {
  const guard = await requirePerm('inventory.read');
  if ('response' in guard) return guard.response;

  const [orphans, products] = await Promise.all([
    prisma.order.findMany({
      where: { paymentMethod: 'bosta-historical', items: { none: {} } },
      select: { id: true, shipment: { select: { rawPayload: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.findMany({ select: { id: true, name: true, price: true } }),
  ]);

  const matched: Record<string, { count: number; matchedProduct: string; score: number }> = {};
  const unmatched: Record<string, number> = {};
  let nullDescription = 0;
  let parseEmpty = 0;
  let totalParsedItems = 0;

  for (const o of orphans) {
    const description = extractDescription(o.shipment?.rawPayload);
    if (!description) { nullDescription++; continue; }
    const parsed = parseItemsFromDescription(description);
    if (parsed.length === 0) { parseEmpty++; continue; }
    for (const p of parsed) {
      totalParsedItems++;
      const m = matchProduct(p.name, products);
      if (m) {
        const k = p.name;
        const cur = matched[k] ?? { count: 0, matchedProduct: m.product.name, score: m.score };
        cur.count++;
        matched[k] = cur;
      } else {
        unmatched[p.name] = (unmatched[p.name] ?? 0) + 1;
      }
    }
  }

  const matchedList = Object.entries(matched)
    .map(([raw, v]) => ({ raw, norm: normaliseArabic(raw), ...v }))
    .sort((a, b) => b.count - a.count);
  const unmatchedList = Object.entries(unmatched)
    .map(([raw, count]) => ({ raw, norm: normaliseArabic(raw), count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    totalOrphans: orphans.length,
    nullDescription,
    parseEmpty,
    totalParsedItems,
    matchedPatternCount: matchedList.length,
    unmatchedPatternCount: unmatchedList.length,
    matched: matchedList,
    unmatched: unmatchedList,
  });
}
