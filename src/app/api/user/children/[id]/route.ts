export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { id } = await params;
    const child = await prisma.child.findUnique({ where: { id }, select: { userId: true } });
    if (!child) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    if (child.userId !== auth.userId) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    await prisma.child.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[children DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
