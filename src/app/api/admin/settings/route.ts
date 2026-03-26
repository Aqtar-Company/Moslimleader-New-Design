export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';


// Public-readable settings (no auth needed for GET)
const PUBLIC_KEYS = ['payment-methods'];

// GET /api/admin/settings?key=xxx
export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'key مطلوب' }, { status: 400 });

    if (!PUBLIC_KEYS.includes(key)) {
      const auth = await getAuthUser();
      if (!auth || auth.role !== 'admin') {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }
    }

    const setting = await prisma.setting.findUnique({ where: { key } });
    return NextResponse.json({ value: setting?.value ?? null });
  } catch (err) {
    console.error('[admin settings GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// PUT /api/admin/settings — { key, value }
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { key, value } = await req.json();
    if (!key) return NextResponse.json({ error: 'key مطلوب' }, { status: 400 });

    const setting = await prisma.setting.upsert({
      where: { key },
      create: { key, value, updatedAt: new Date() },
      update: { value, updatedAt: new Date() },
    });

    return NextResponse.json({ setting });
  } catch (err) {
    console.error('[admin settings PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
