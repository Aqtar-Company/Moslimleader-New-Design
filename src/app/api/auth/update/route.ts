export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const body = await req.json();

    // ── Whitelist only allowed fields (prevent mass-assignment) ──────────────
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2 || name.length > 100) {
        return NextResponse.json({ error: 'الاسم يجب أن يكون بين 2 و 100 حرف' }, { status: 400 });
      }
      updateData.name = name;
    }

    if (body.phone !== undefined) {
      const phone = body.phone === null ? null : String(body.phone).trim();
      if (phone !== null && (phone.length > 20 || !/^[+\d\s()-]{7,20}$/.test(phone))) {
        return NextResponse.json({ error: 'رقم الهاتف غير صحيح' }, { status: 400 });
      }
      updateData.phone = phone;
    }

    if (body.savedAddresses !== undefined) {
      if (!Array.isArray(body.savedAddresses)) {
        return NextResponse.json({ error: 'صيغة العناوين غير صحيحة' }, { status: 400 });
      }
      // Limit to 5 addresses max
      updateData.savedAddresses = (body.savedAddresses as unknown[]).slice(0, 5);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات للتحديث' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: updateData,
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        savedAddresses: (updated.savedAddresses as unknown[]) ?? [],
      },
    });
  } catch (err) {
    console.error('[update]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
