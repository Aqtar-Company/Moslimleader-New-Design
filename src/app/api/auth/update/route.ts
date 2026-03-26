export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const data = await req.json();
    const { name, phone, savedAddresses } = data;

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(savedAddresses !== undefined && { savedAddresses }),
      },
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        savedAddresses: (updated.savedAddresses as unknown[]) ?? [],
      },
    });
  } catch (err) {
    console.error('[update]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
