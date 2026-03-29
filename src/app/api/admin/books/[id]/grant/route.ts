export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// GET /api/admin/books/[id]/grant — list all accesses for this book
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id: bookId } = await params;
    const accesses = await prisma.bookAccess.findMany({
      where: { bookId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { grantedAt: 'desc' },
    });

    return NextResponse.json({ accesses });
  } catch (err) {
    console.error('[admin books grant GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/admin/books/[id]/grant — { email } or { userId }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id: bookId } = await params;
    const { email, userId: directUserId } = await req.json();

    let userId = directUserId;
    if (!userId && email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
      userId = user.id;
    }
    if (!userId) return NextResponse.json({ error: 'userId أو email مطلوب' }, { status: 400 });

    const access = await prisma.bookAccess.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: { userId, bookId },
      update: { grantedAt: new Date() },
    });

    return NextResponse.json({ access });
  } catch (err) {
    console.error('[admin books grant]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE /api/admin/books/[id]/grant?userId=xxx — revoke access
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id: bookId } = await params;
    let userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      try { const body = await req.json(); userId = body.userId; } catch {}
    }
    if (!userId) return NextResponse.json({ error: 'userId مطلوب' }, { status: 400 });

    await prisma.bookAccess.deleteMany({ where: { userId, bookId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin books revoke]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
