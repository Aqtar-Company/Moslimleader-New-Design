export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { normaliseArabic } from '@/lib/arabic-normalize';
import { extractDescription, parseItemsFromDescription } from '@/lib/bosta-orphans';

// Debug endpoint — returns the first N orphans with their raw
// description, parsed item names, and the TOP 3 candidate products
// for each parsed name (with their scores) regardless of threshold.
// Lets us see exactly why matching is failing without guessing.

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
      take: 15,
    }),
    prisma.product.findMany({ select: { id: true, name: true, price: true }, orderBy: { name: 'asc' } }),
  ]);

  const productNorms = products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    norm: normaliseArabic(p.name),
  }));

  const samples = orphans.map(o => {
    const description = extractDescription(o.shipment?.rawPayload);
    const parsed = parseItemsFromDescription(description);
    return {
      orderId: o.id,
      description,
      parsedItems: parsed.map(p => {
        const rawNorm = normaliseArabic(p.name);
        // Top 3 candidates by every scoring rule we have, no threshold.
        const scored = productNorms.map(pp => {
          let score = 0;
          let why = '';
          if (pp.norm === rawNorm) { score = 1; why = 'exact'; }
          else if (pp.norm.includes(rawNorm)) { score = 0.92; why = 'product-contains-parsed'; }
          else if (rawNorm.includes(pp.norm)) { score = 0.88; why = 'parsed-contains-product'; }
          else {
            const pnWords = pp.norm.split(' ').filter(w => w.length > 2);
            if (pnWords.length === 0) { score = 0; why = 'product-no-meaningful-words'; }
            else {
              const hits = pnWords.filter(w => rawNorm.includes(w)).length;
              score = hits / pnWords.length;
              why = `${hits}/${pnWords.length} words`;
            }
          }
          return { productName: pp.name, productNorm: pp.norm, score, why };
        }).sort((a, b) => b.score - a.score).slice(0, 3);
        return {
          parsedName: p.name,
          parsedNorm: rawNorm,
          quantity: p.quantity,
          top3: scored,
        };
      }),
    };
  });

  return NextResponse.json({
    productCount: products.length,
    sampleProductNames: products.slice(0, 10).map(p => p.name),
    samples,
  });
}
