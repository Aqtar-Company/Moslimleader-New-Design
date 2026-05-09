export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { extractDescription, parseItemsFromDescription } from '@/lib/bosta-orphans';

// Show sample descriptions from the 1405 "parseEmpty" orphans so we
// can see the formats Bosta used besides "X N" and extend the parser
// accordingly. Also peek into the rawPayload of the null-description
// ones in case the description sits under a key we don't check.

export async function GET() {
  const orphansGuard = await requirePerm('inventory.read');
  if ('response' in orphansGuard) return orphansGuard.response;

  const orphans = await prisma.order.findMany({
    where: { paymentMethod: 'bosta-historical', items: { none: {} } },
    select: { id: true, shipment: { select: { rawPayload: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const parseEmptySamples: Array<{ orderId: string; description: string }> = [];
  const nullDescriptionSamples: Array<{ orderId: string; payloadKeys: string[]; specsKeys: string[] | null }> = [];

  for (const o of orphans) {
    const desc = extractDescription(o.shipment?.rawPayload);
    if (!desc) {
      if (nullDescriptionSamples.length < 5) {
        const p = (o.shipment?.rawPayload ?? {}) as Record<string, unknown>;
        const specs = p.specs && typeof p.specs === 'object' ? Object.keys(p.specs as Record<string, unknown>) : null;
        nullDescriptionSamples.push({ orderId: o.id, payloadKeys: Object.keys(p), specsKeys: specs });
      }
      continue;
    }
    const parsed = parseItemsFromDescription(desc);
    if (parsed.length === 0 && parseEmptySamples.length < 30) {
      parseEmptySamples.push({ orderId: o.id, description: desc });
    }
  }

  return NextResponse.json({
    totalOrphans: orphans.length,
    parseEmptySamples,
    nullDescriptionSamples,
  });
}
