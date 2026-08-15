export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

// PUT /api/tareeq/notes/[id] — update note
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const limited = checkRateLimit(`note-put:${user.userId}`, 120, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: 'الرجاء الانتظار قليلاً' }, { status: 429 });

  const note = await prisma.tareeqNote.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!note || note.userId !== user.userId) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body    = await req.json().catch(() => ({}));
  const title   = String(body.title   ?? '').trim().slice(0, 200) || null;
  const content = String(body.content ?? '').trim().slice(0, 50000);
  const imageUrl = 'imageUrl' in body ? (String(body.imageUrl ?? '').trim() || null) : undefined;

  const updated = await prisma.tareeqNote.update({
    where: { id: params.id },
    data: { title, content, ...(imageUrl !== undefined ? { imageUrl } : {}) },
    select: { id: true, title: true, content: true, imageUrl: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, note: updated });
}

// DELETE /api/tareeq/notes/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const limited = checkRateLimit(`note-del:${user.userId}`, 30, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: 'الرجاء الانتظار قليلاً' }, { status: 429 });

  const note = await prisma.tareeqNote.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!note || note.userId !== user.userId) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  await prisma.tareeqNote.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
