export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

const MAX_CHILDREN = 10;
const FIRST_CHILD_POINTS = 50;

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const children = await prisma.child.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, birthdate: true, gender: true },
  });
  return NextResponse.json({ children: children.map(c => ({ ...c, birthdate: c.birthdate.toISOString() })) });
}

export async function POST(req: Request) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  let body: { name?: string; birthdate?: string; gender?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 }); }

  const name = (body.name ?? '').trim();
  if (name.length < 2 || name.length > 60) return NextResponse.json({ error: 'الاسم يجب أن يكون بين 2 و 60 حرفاً' }, { status: 400 });

  if (!body.birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(body.birthdate))
    return NextResponse.json({ error: 'تاريخ الميلاد غير صالح' }, { status: 400 });
  const birthdate = new Date(body.birthdate + 'T00:00:00.000Z');
  if (isNaN(birthdate.getTime()) || birthdate >= new Date())
    return NextResponse.json({ error: 'تاريخ الميلاد يجب أن يكون في الماضي' }, { status: 400 });

  const allowedGenders = ['boy', 'girl', null, undefined];
  if (!allowedGenders.includes(body.gender as string | null | undefined))
    return NextResponse.json({ error: 'الجنس غير صالح' }, { status: 400 });

  const existing = await prisma.child.count({ where: { userId: auth.userId } });
  if (existing >= MAX_CHILDREN) return NextResponse.json({ error: 'لا يمكن إضافة أكثر من 10 أطفال' }, { status: 400 });

  const child = await prisma.child.create({
    data: { userId: auth.userId, name, birthdate, gender: body.gender ?? null },
    select: { id: true, name: true, birthdate: true, gender: true },
  });

  let pointsEarned = 0;
  if (existing === 0) {
    try {
      await prisma.$transaction([
        prisma.user.update({ where: { id: auth.userId }, data: { loyaltyPoints: { increment: FIRST_CHILD_POINTS } } }),
        prisma.loyaltyTransaction.create({ data: { userId: auth.userId, points: FIRST_CHILD_POINTS, reason: 'first_child' } }),
      ]);
      pointsEarned = FIRST_CHILD_POINTS;
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ child: { ...child, birthdate: child.birthdate.toISOString() }, pointsEarned });
}
