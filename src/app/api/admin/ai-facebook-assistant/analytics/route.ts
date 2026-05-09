export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

// Conversion funnel + product-demand + objection heatmap for the
// FB AI assistant. Cached 5 min — owner usually checks once a day,
// no need to recompute on every load.

interface CachedAnalytics { at: number; payload: unknown }
let cache: CachedAnalytics | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  const guard = await requirePerm(['settings.read', 'ai-assistant.read']);
  if ('response' in guard) return guard.response;

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload);
  }

  const since30 = new Date(Date.now() - 30 * 86400000);

  // Run all queries in parallel — none depends on another.
  const [
    incomingEvents,
    outgoingEvents,
    leadStats,
    intentStats,
    fbOrders,
    productMentionRows,
  ] = await Promise.all([
    prisma.facebookEvent.count({
      where: { direction: 'incoming', createdAt: { gte: since30 } },
    }),
    prisma.facebookEvent.count({
      where: { direction: { in: ['outgoing-auto', 'outgoing-manual'] }, createdAt: { gte: since30 } },
    }),
    // GroupBy doesn't filter null nicely, so we count each level
    // explicitly (cheaper than fetching rows + JS-counting).
    prisma.facebookEvent.groupBy({
      by: ['leadStatus'],
      where: {
        leadStatus: { not: null },
        createdAt: { gte: since30 },
      },
      _count: { _all: true },
    }),
    prisma.facebookEvent.groupBy({
      by: ['intentSignal'],
      where: {
        intentSignal: { not: null },
        direction: 'incoming',
        createdAt: { gte: since30 },
      },
      _count: { _all: true },
    }),
    // Orders attributed to the FB assistant (set at create-order time).
    prisma.order.findMany({
      where: {
        source: 'fb-assistant',
        createdAt: { gte: since30 },
      },
      select: { id: true, total: true, items: { select: { productId: true, productName: true, quantity: true } } },
    }),
    // Product mentions in outgoing-auto messages — proxy for "what
    // the bot is recommending most". Pull recent outgoing texts +
    // count how many contain each product name.
    prisma.facebookEvent.findMany({
      where: {
        direction: 'outgoing-auto',
        createdAt: { gte: since30 },
      },
      select: { text: true },
      take: 1000,
    }),
  ]);

  // Map raw lead/intent groupBy into a stable shape for the UI.
  const leadCounts: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
  for (const row of leadStats) {
    if (row.leadStatus && row.leadStatus in leadCounts) {
      leadCounts[row.leadStatus] = row._count._all;
    }
  }

  const intentCounts: Record<string, number> = {
    'price-question': 0,
    'shipping-question': 0,
    'ready-to-buy': 0,
    'objection': 0,
    'general': 0,
  };
  for (const row of intentStats) {
    if (row.intentSignal && row.intentSignal in intentCounts) {
      intentCounts[row.intentSignal] = row._count._all;
    }
  }

  // Top products in actual orders.
  const productOrderTally = new Map<string, { name: string; orders: number; revenue: number }>();
  let totalRevenue = 0;
  for (const o of fbOrders) {
    totalRevenue += o.total;
    for (const it of o.items) {
      const cur = productOrderTally.get(it.productId) ?? { name: it.productName, orders: 0, revenue: 0 };
      cur.orders += it.quantity;
      cur.revenue += it.quantity * (o.total / Math.max(1, o.items.reduce((s, i) => s + i.quantity, 0)));
      productOrderTally.set(it.productId, cur);
    }
  }

  // Top products MENTIONED by the bot in replies (demand signal).
  // Approximate by substring-matching against a list of known
  // product names.
  const products = await prisma.product.findMany({
    select: { id: true, name: true },
    take: 200,
  });
  const mentionTally = new Map<string, number>();
  for (const ev of productMentionRows) {
    if (!ev.text) continue;
    for (const p of products) {
      if (ev.text.includes(p.name)) {
        mentionTally.set(p.id, (mentionTally.get(p.id) ?? 0) + 1);
      }
    }
  }
  const productNameMap = new Map(products.map(p => [p.id, p.name]));
  const topProducts = Array.from(mentionTally.entries())
    .map(([id, mentions]) => {
      const ordered = productOrderTally.get(id);
      return {
        id,
        name: productNameMap.get(id) ?? id,
        mentions,
        orders: ordered?.orders ?? 0,
      };
    })
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);

  const conversionRate = leadCounts.hot > 0
    ? fbOrders.length / leadCounts.hot
    : 0;

  const replyRate = incomingEvents > 0 ? outgoingEvents / incomingEvents : 0;

  const payload = {
    windowDays: 30,
    funnel: {
      incomingMessages: incomingEvents,
      botReplies: outgoingEvents,
      replyRate,
      hotLeads: leadCounts.hot,
      warmLeads: leadCounts.warm,
      coldLeads: leadCounts.cold,
      ordersCreated: fbOrders.length,
      revenueEgp: Math.round(totalRevenue),
      conversionRate,
    },
    intentBreakdown: intentCounts,
    topProducts,
    generatedAt: new Date().toISOString(),
  };

  cache = { at: Date.now(), payload };
  return NextResponse.json(payload);
}
