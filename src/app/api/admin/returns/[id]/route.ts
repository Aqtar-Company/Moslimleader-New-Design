export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { logActionSafe } from '@/lib/audit-log';

// PATCH /api/admin/returns/[id] — approve or reject a return request
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm(['orders.write']);
  if ('response' in guard) return guard.response;

  const { id } = await params;
  const body = await req.json();
  const { action, adminNote, refundAmount } = body;

  if (!['approve', 'reject', 'complete'].includes(action)) {
    return NextResponse.json({ error: 'action غير صحيح' }, { status: 400 });
  }

  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id },
    include: { order: { include: { items: true } } },
  });
  if (!returnRequest) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'completed';
  const newOrderStatus = action === 'approve' ? 'return_approved' : action === 'complete' ? 'returned' : 'delivered';

  await prisma.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id },
      data: {
        status: newStatus,
        adminNote: adminNote?.trim() || null,
        refundAmount: refundAmount ? refundAmount : null,
      },
    });

    await tx.order.update({
      where: { id: returnRequest.orderId },
      data: { status: newOrderStatus },
    });

    // Restore stock when return is completed
    if (action === 'complete') {
      const returnedItems = returnRequest.itemsJson as Array<{ productId: string; quantity: number; selectedModel?: number | null }>;
      for (const item of returnedItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true, variantStocks: true } });
        if (!product) continue;

        let stockBefore: number;
        let stockAfter: number;

        if (item.selectedModel != null && product.variantStocks) {
          const vs = (product.variantStocks as Record<string, number>);
          stockBefore = vs[String(item.selectedModel)] ?? 0;
          stockAfter = stockBefore + item.quantity;
          vs[String(item.selectedModel)] = stockAfter;
          await tx.product.update({ where: { id: item.productId }, data: { variantStocks: vs } });
        } else {
          stockBefore = product.stock ?? 0;
          stockAfter = stockBefore + item.quantity;
          await tx.product.update({ where: { id: item.productId }, data: { stock: stockAfter } });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            delta: item.quantity,
            reason: 'return_completed',
            orderId: returnRequest.orderId,
            stockBefore,
            stockAfter,
          },
        });
      }
    }
  });

  await logActionSafe({
    actor: guard.user,
    action: (action === 'approve' ? 'return.approve' : action === 'reject' ? 'return.reject' : 'return.complete'),
    entity: 'ReturnRequest',
    entityId: id,
    metadata: { orderId: returnRequest.orderId, action, adminNote, refundAmount },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
