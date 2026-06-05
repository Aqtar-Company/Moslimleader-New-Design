export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

// Lightweight count of pending Bosta-imported orders that don't yet
// have OrderItem rows attached. Used by the admin sidebar to render
// a badge ("📦 مطابقة طلبات بوسطة (12)") so the owner knows there's
// pending backfill work without having to open the full reports
// page on every admin session.
//
// The full reports page lives at
//   /api/admin/reports/bosta-orphans
// and runs heavier per-row matching logic. We deliberately don't
// reuse it here — sidebars need to be fast.
export async function GET() {
  const guard = await requirePerm(['inventory.read', 'orders.read']);
  if ('response' in guard) return guard.response;
  try {
    const count = await prisma.order.count({
      where: { paymentMethod: 'bosta-historical', items: { none: {} } },
    });
    return NextResponse.json({ count });
  } catch {
    // Don't 500 the sidebar — return 0 and let the page surface
    // the real error if/when the owner clicks through.
    return NextResponse.json({ count: 0 });
  }
}
