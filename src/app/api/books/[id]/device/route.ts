export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

const MAX_DEVICES = 2;

// POST /api/books/[id]/device — register device fingerprint and check limit
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مسجل دخول' }, { status: 401 });

    const { id: bookId } = await params;
    const { fingerprint } = await req.json();
    if (!fingerprint) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });

    const ip = req.headers.get('cf-connecting-ip') ||
               req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || '';

    // Check if this device is already registered for this user
    const existing = await prisma.bookDevice.findUnique({
      where: { userId_fingerprint: { userId: auth.userId, fingerprint } },
    });

    if (existing) {
      // Update lastSeen
      await prisma.bookDevice.update({
        where: { id: existing.id },
        data: { lastSeen: new Date(), ipAddress: ip },
      });
      return NextResponse.json({ allowed: true });
    }

    // Count existing devices for this user
    const deviceCount = await prisma.bookDevice.count({
      where: { userId: auth.userId },
    });

    if (deviceCount >= MAX_DEVICES) {
      return NextResponse.json({
        allowed: false,
        error: `تجاوزت الحد المسموح (${MAX_DEVICES} أجهزة). تواصل مع الدعم لإعادة تعيين أجهزتك.`,
        deviceCount,
        maxDevices: MAX_DEVICES,
      }, { status: 403 });
    }

    // Register new device
    await prisma.bookDevice.create({
      data: {
        userId: auth.userId,
        fingerprint,
        userAgent: ua,
        ipAddress: ip,
      },
    });

    return NextResponse.json({ allowed: true, deviceCount: deviceCount + 1 });
  } catch (err) {
    console.error('[device POST]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
