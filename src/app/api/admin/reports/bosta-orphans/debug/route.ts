export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { normaliseArabic } from '@/lib/arabic-normalize';
import { extractDescription, parseItemsFromDescription, matchProduct } from '@/lib/bosta-orphans';

// Diagnostic dump — for every orphan, run the same matcher the
// bulk-match uses and report what came back. Shows the normalised
// forms so we can verify normaliseArabic actually fires properly on
// the live data.

export async function GET() {
  const guard = await requirePerm('inventory.read');
  if ('response' in guard) return guard.response;

  const [orphans, products] = await Promise.all([
    prisma.order.findMany({
      where: { paymentMethod: 'bosta-historical', items: { none: {} } },
      select: {
        id: true,
        shipment: { select: { rawPayload: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.product.findMany({ select: { id: true, name: true, price: true }, orderBy: { name: 'asc' } }),
  ]);

  const allProductNames = products.map(p => ({ name: p.name, norm: normaliseArabic(p.name) }));

  // Aggregate: count of each parsed-name pattern across the sample
  // and what it matched (or didn't).
  const patternStats: Record<string, { count: number; norm: string; bestMatch: string | null; bestScore: number }> = {};
  const orphanRows: Array<{ orderId: string; description: string | null; parsedItems: Array<{ raw: string; norm: string; match: string | null; score: number }> }> = [];

  for (const o of orphans) {
    const description = extractDescription(o.shipment?.rawPayload);
    const parsed = parseItemsFromDescription(description);
    const items = parsed.map(p => {
      const norm = normaliseArabic(p.name);
      const m = matchProduct(p.name, products);
      const stat = patternStats[p.name] ?? { count: 0, norm, bestMatch: null, bestScore: 0 };
      stat.count++;
      if (m && m.score > stat.bestScore) { stat.bestMatch = m.product.name; stat.bestScore = m.score; }
      patternStats[p.name] = stat;
      return { raw: p.name, norm, match: m?.product.name ?? null, score: m?.score ?? 0 };
    });
    orphanRows.push({ orderId: o.id, description, parsedItems: items });
  }

  const patterns = Object.entries(patternStats)
    .map(([raw, s]) => ({ raw, ...s }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    productCount: products.length,
    allProductNames,
    patternsObserved: patterns,
    sampleOrphans: orphanRows.slice(0, 5),
  });
}
