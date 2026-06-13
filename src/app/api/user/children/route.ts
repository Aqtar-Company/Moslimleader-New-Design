export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

const MAX_CHILDREN = 10;
const FIRST_CHILD_POINTS = 50;

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const children = await prisma.child.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, birthdate: true, gender: true, createdAt: true },
    });

    return NextResponse.json({ children });
  } catch (err) {
    console.error('[children GET]', err);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const count = await prisma.child.count({ where: { userId: auth.userId } });
    if (count >= MAX_CHILDREN) {
      return NextResponse.json({ error: 'الحد الأقصى 10 أطفال' }, { status: 400 });
    }

    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: 'الاسم يجب أن يكون بين 2 و 60 حرف' }, { status: 400 });
    }

    const birthdateRaw = body.birthdate;
    const birthdate = birthdateRaw ? new Date(birthdateRaw + 'T00:00:00.000Z') : null;
    if (!birthdate || isNaN(birthdate.getTime()) || birthdate >= new Date()) {
      return NextResponse.json({ error: 'تاريخ ميلاد غير صحيح' }, { status: 400 });
    }

    const gender = ['boy', 'girl'].includes(body.gender) ? (body.gender as string) : null;

    const isFirstChild = count === 0;

    const child = await prisma.child.create({
      data: { userId: auth.userId, name, birthdate, gender },
      select: { id: true, name: true, birthdate: true, gender: true, createdAt: true },
    });

    if (isFirstChild) {
      try {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: auth.userId },
            data: { loyaltyPoints: { increment: FIRST_CHILD_POINTS } },
          }),
          prisma.loyaltyTransaction.create({
            data: { userId: auth.userId, points: FIRST_CHILD_POINTS, reason: 'first_child_added' },
          }),
        ]);
      } catch (e) {
        console.error('[children POST loyalty]', e);
      }
    }

    return NextResponse.json(
      { child, pointsEarned: isFirstChild ? FIRST_CHILD_POINTS : 0 },
      { status: 201 },
    );
  } catch (err) {
    console.error('[children POST]', err);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
