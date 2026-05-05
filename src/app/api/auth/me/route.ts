export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ user: null }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ user: null }, { status: 401 });

    // Expose permissions only when the user is staff/admin so customers
    // can't probe the catalogue.
    const isAdminLike = user.role === 'admin' || user.role === 'staff';
    const permissions = isAdminLike ? ((user.permissions as unknown[] | null) ?? []) : [];
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        savedAddresses: (user.savedAddresses as unknown[]) ?? [],
        role: user.role,
        permissions,
      },
    });
  } catch (err) {
    console.error('[me]', err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
