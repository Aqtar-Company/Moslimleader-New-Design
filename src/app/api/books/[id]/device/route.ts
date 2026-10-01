export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

const MAX_DEVICES = 2;

/**
 * POST /api/books/[id]/device — register the reader's device against the 2-device limit.
 *
 * ## Why this no longer refuses anyone
 *
 * The limit used to be a wall: a third fingerprint was answered 403 «تواصل مع الدعم» and
 * the reader was locked out until an admin found them and reset the list. The first real
 * lockout investigated had two "devices" that were the SAME phone — identical user agent,
 * one Samsung — because the fingerprint changes when the same browser is opened as an
 * installed app, or after its data is cleared. The wall punished exactly the paying reader
 * it was meant to protect, and did nothing about the case it was meant for (one account
 * read on many phones at once), which `BookSession` already catches by its 90s pings.
 *
 * Two changes, both about counting honestly:
 *
 * 1. **Same browser on the same device is one device.** A new fingerprint arriving with a
 *    user agent this account already has adopts that row instead of adding one. A family
 *    sharing one account across two identical phones would be merged too — acceptable,
 *    because the session ping still stops them reading at the same moment.
 * 2. **A sliding window, not a wall.** When a genuinely new device makes it one too many,
 *    the LEAST RECENTLY SEEN device is dropped and the new one takes its place. The account
 *    is always allowed to read on the two devices it used most recently; the old phone in a
 *    drawer loses its slot, and if it is picked up again it simply takes the slot back from
 *    whichever one is now idle. Nobody is ever told to contact support to read a book they
 *    paid for.
 *
 * The admin's device list and reset stay as they were; they are for inspection now, not a
 * daily unlock desk.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مسجل دخول' }, { status: 401 });

    await params; // the book id is not part of the device identity; the limit is per account
    const { fingerprint } = await req.json();
    if (!fingerprint || typeof fingerprint !== 'string') {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    const ip = req.headers.get('cf-connecting-ip') ||
               req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    const now = new Date();

    // Known fingerprint: just a heartbeat.
    const existing = await prisma.bookDevice.findUnique({
      where: { userId_fingerprint: { userId: auth.userId, fingerprint } },
    });
    if (existing) {
      await prisma.bookDevice.update({ where: { id: existing.id }, data: { lastSeen: now, ipAddress: ip } });
      return NextResponse.json({ allowed: true });
    }

    const devices = await prisma.bookDevice.findMany({
      where: { userId: auth.userId },
      orderBy: { lastSeen: 'asc' },         // oldest first — the eviction candidate is [0]
      select: { id: true, userAgent: true, lastSeen: true },
    });

    // (1) Same browser on the same device: adopt its row rather than count a second one.
    const sameBrowser = ua ? devices.find(d => d.userAgent === ua) : undefined;
    if (sameBrowser) {
      await prisma.bookDevice.update({
        where: { id: sameBrowser.id },
        data: { fingerprint, lastSeen: now, ipAddress: ip },
      });
      return NextResponse.json({ allowed: true, deviceCount: devices.length, replacedSameDevice: true });
    }

    // (2) One too many: the least recently seen device gives up its slot.
    let evicted: string | null = null;
    if (devices.length >= MAX_DEVICES) {
      const oldest = devices[0];
      await prisma.bookDevice.delete({ where: { id: oldest.id } });
      evicted = oldest.id;
      console.info('[device] evicted least-recent device', { userId: auth.userId, lastSeen: oldest.lastSeen.toISOString() });
    }

    await prisma.bookDevice.create({
      data: { userId: auth.userId, fingerprint, userAgent: ua, ipAddress: ip, lastSeen: now },
    });

    return NextResponse.json({
      allowed: true,
      deviceCount: Math.min(devices.length + 1, MAX_DEVICES),
      maxDevices: MAX_DEVICES,
      // The reader is told, once, that an older device was signed out of the book — it is
      // their own device and they deserve to know why it will ask again next time.
      ...(evicted ? { rotated: true, message: `تم تسجيل هذا الجهاز، وأُزيل أقدم جهاز لم تستخدمه مؤخراً (الحد ${MAX_DEVICES} أجهزة).` } : {}),
    });
  } catch (err) {
    console.error('[device POST]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
