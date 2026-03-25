export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { governorates } from '@/lib/shipping';


// GET /api/shipping-rates — get all shipping rates
export async function GET() {
  try {
    const dbRates = await prisma.shippingRate.findMany();

    // Merge DB rates with static governorates
    const ratesMap: Record<string, number> = {};
    dbRates.forEach(r => { ratesMap[r.governorateId] = r.rate; });

    const rates = governorates.map(g => ({
      id: g.id,
      name: g.name,
      rate: ratesMap[g.id] ?? g.shipping,
    }));

    return NextResponse.json({ rates });
  } catch (err) {
    console.error('[shipping-rates GET]', err);
    // Fallback to static
    const rates = governorates.map(g => ({ id: g.id, name: g.name, rate: g.shipping }));
    return NextResponse.json({ rates });
  }
}

// PUT /api/shipping-rates — update a rate (admin only)
export async function PUT(req: NextRequest) {
  try {
    const { getAuthUser } = await import('@/lib/jwt');
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { governorateId, rate } = await req.json();
    const updated = await prisma.shippingRate.upsert({
      where: { governorateId },
      create: { governorateId, rate, updatedAt: new Date() },
      update: { rate, updatedAt: new Date() },
    });

    return NextResponse.json({ rate: updated });
  } catch (err) {
    console.error('[shipping-rates PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
