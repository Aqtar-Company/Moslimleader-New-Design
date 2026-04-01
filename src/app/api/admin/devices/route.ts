export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/admin/devices?userId=xxx — list devices for a user
export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const devices = await prisma.bookDevice.findMany({
    where: { userId },
    orderBy: { lastSeen: 'desc' },
  });

  return NextResponse.json({ devices });
}

// DELETE /api/admin/devices?userId=xxx — reset all devices for a user
export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  await prisma.bookDevice.deleteMany({ where: { userId } });
  await prisma.bookSession.deleteMany({ where: { userId } });

  return NextResponse.json({ ok: true, message: 'تم إعادة تعيين الأجهزة بنجاح' });
}
