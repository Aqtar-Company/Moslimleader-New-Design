export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { extractDescription, parseItemsFromDescription, matchProduct } from '@/lib/bosta-orphans';

// Full diagnostic: count every remaining orphan by what state it's in.

export async function GET() {
  const guard = await requirePerm('inventory.read');
  if ('response' in guard) return guard.response;

  const [orphans, products] = await Promise.all([
    prisma.order.findMany({
      where: { paymentMethod: 'bosta-historical', items: { none: {} } },
      select: { id: true, total: true, shipment: { select: { rawPayload: true, cod: true } } },
    }),
    prisma.product.findMany({ select: { id: true, name: true, price: true } }),
  ]);

  let nullDesc = 0, parseEmpty = 0, parsedNoMatch = 0, parsedAllMatch = 0, parsedPartial = 0;
  const unmatchedNames: Record<string, number> = {};
  const parseEmptySamples: Array<{ orderId: string; description: string }> = [];
  const noMatchSamples: Array<{ orderId: string; parsed: string[] }> = [];

  for (const o of orphans) {
    const description = extractDescription(o.shipment?.rawPayload);
    if (!description) { nullDesc++; continue; }
    const parsed = parseItemsFromDescription(description);
    if (parsed.length === 0) {
      parseEmpty++;
      if (parseEmptySamples.length < 10) parseEmptySamples.push({ orderId: o.id, description });
      continue;
    }
    let matchedCount = 0;
    for (const p of parsed) {
      const m = matchProduct(p.name, products);
      if (m) matchedCount++;
      else unmatchedNames[p.name] = (unmatchedNames[p.name] ?? 0) + 1;
    }
    if (matchedCount === 0) {
      parsedNoMatch++;
      if (noMatchSamples.length < 10) noMatchSamples.push({ orderId: o.id, parsed: parsed.map(p => p.name) });
    } else if (matchedCount === parsed.length) parsedAllMatch++;
    else parsedPartial++;
  }

  const topUnmatched = Object.entries(unmatchedNames)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  return NextResponse.json({
    totalOrphans: orphans.length,
    breakdown: { nullDesc, parseEmpty, parsedNoMatch, parsedPartial, parsedAllMatch },
    topUnmatched,
    parseEmptySamples,
    noMatchSamples,
  });
}
