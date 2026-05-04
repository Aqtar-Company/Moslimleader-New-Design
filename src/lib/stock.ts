import { prisma } from './prisma';

// Adjust stock atomically — pass negative numbers to decrement, positive to
// restore. When `selectedModel` is set AND the product has `variantStocks`,
// the per-variant counter is also adjusted so the inventory page reflects
// real per-model availability.
export async function adjustStock(
  items: Array<{ productId: string; delta: number; selectedModel?: number | null }>,
): Promise<void> {
  if (items.length === 0) return;
  const filtered = items.filter(it => it.productId && it.delta);
  if (filtered.length === 0) return;

  // Group by productId so we can read variantStocks once and update once.
  const byProduct = new Map<string, Array<{ delta: number; selectedModel?: number | null }>>();
  for (const it of filtered) {
    const arr = byProduct.get(it.productId) ?? [];
    arr.push({ delta: it.delta, selectedModel: it.selectedModel });
    byProduct.set(it.productId, arr);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: Array.from(byProduct.keys()) } },
    select: { id: true, variantStocks: true },
  });
  const variantStocksByProduct = new Map(
    products.map(p => [p.id, (p.variantStocks ?? null) as Record<string, number> | null]),
  );

  await prisma.$transaction(
    Array.from(byProduct.entries()).map(([productId, deltas]) => {
      const totalDelta = deltas.reduce((s, d) => s + d.delta, 0);
      const current = variantStocksByProduct.get(productId);
      const data: { stock: { increment: number }; variantStocks?: object } = {
        stock: { increment: totalDelta },
      };
      // Only touch variantStocks when the product actually has them.
      if (current && Object.keys(current).length > 0) {
        const next: Record<string, number> = { ...current };
        for (const d of deltas) {
          if (d.selectedModel === null || d.selectedModel === undefined) continue;
          const key = String(d.selectedModel);
          next[key] = (next[key] ?? 0) + d.delta;
        }
        data.variantStocks = next;
      }
      return prisma.product.update({ where: { id: productId }, data });
    }),
  );
}

export function decrementsFromItems(
  items: Array<{ productId: string; quantity: number; selectedModel?: number | null }>,
) {
  return items.map(it => ({
    productId: it.productId,
    delta: -Math.abs(it.quantity),
    selectedModel: it.selectedModel ?? null,
  }));
}

export function restoresFromItems(
  items: Array<{ productId: string; quantity: number; selectedModel?: number | null }>,
) {
  return items.map(it => ({
    productId: it.productId,
    delta: Math.abs(it.quantity),
    selectedModel: it.selectedModel ?? null,
  }));
}
