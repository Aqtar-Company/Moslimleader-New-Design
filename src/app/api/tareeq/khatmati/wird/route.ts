import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// The four default reading-plan bookmarks every user starts with — seeded
// once, lazily, the first time a signed-in user opens the wird sheet.
const DEFAULT_WIRDS = ['ورد حفظ', 'ورد تلاوة', 'ورد مراجعة', 'ورد تدبر'];

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let wirds = await prisma.khatmatiWird.findMany({
    where: { userId: user.userId },
    orderBy: { order: 'asc' },
  });

  if (wirds.length === 0) {
    await prisma.khatmatiWird.createMany({
      data: DEFAULT_WIRDS.map((name, i) => ({ userId: user.userId, name, order: i })),
    });
    wirds = await prisma.khatmatiWird.findMany({
      where: { userId: user.userId },
      orderBy: { order: 'asc' },
    });
  }

  return NextResponse.json({ wirds });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const count = await prisma.khatmatiWird.count({ where: { userId: user.userId } });
  const wird = await prisma.khatmatiWird.create({
    data: {
      userId: user.userId,
      name,
      page: clampInt(body.page, 1, 604, 1),
      surah: clampInt(body.surah, 1, 114, 1),
      ayah: clampInt(body.ayah, 1, 286, 1),
      order: count,
    },
  });

  return NextResponse.json({ wird });
}
