import { prisma } from './prisma';

// Adjust stock atomically — pass negative numbers to decrement, positive to
// restore. Caller is responsible for ordering this with the order create/update.
export async function adjustStock(items: Array<{ productId: string; delta: number }>): Promise<void> {
  if (items.length === 0) return;
  await prisma.$transaction(
    items
      .filter(it => it.productId && it.delta)
      .map(it =>
        prisma.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.delta } },
        }),
      ),
  );
}

export function decrementsFromItems(items: Array<{ productId: string; quantity: number }>) {
  return items.map(it => ({ productId: it.productId, delta: -Math.abs(it.quantity) }));
}

export function restoresFromItems(items: Array<{ productId: string; quantity: number }>) {
  return items.map(it => ({ productId: it.productId, delta: Math.abs(it.quantity) }));
}
