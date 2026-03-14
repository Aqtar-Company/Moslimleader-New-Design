import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ user: null }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ user: null }, { status: 401 });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        savedAddresses: (user.savedAddresses as unknown[]) ?? [],
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[me]', err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
