export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserFromRequest } from '@/lib/jwt';

// POST /api/books/[id]/track
// Called when user passes reCAPTCHA and opens a book
// Records: IP address, User-Agent, and geolocation via ip-api.com
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await params;

  // Get user from JWT token (optional — guests can also read free pages)
  let userId: string | undefined;
  try {
    const auth = await getAuthUserFromRequest(req);
    if (auth?.userId) userId = auth.userId;
  } catch {}

  // Extract IP address from request headers
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');

  let ipAddress = cfConnectingIp
    || realIp
    || (forwardedFor ? forwardedFor.split(',')[0].trim() : null)
    || '0.0.0.0';

  // Remove IPv6 prefix if present
  if (ipAddress.startsWith('::ffff:')) {
    ipAddress = ipAddress.slice(7);
  }

  // Get User-Agent
  const userAgent = req.headers.get('user-agent') || null;

  // Fetch geolocation from ip-api.com (free, no API key needed)
  let country: string | null = null;
  let city: string | null = null;
  let region: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  const isPrivateIp = (ip: string) =>
    ip === '0.0.0.0' ||
    ip === '127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.');

  try {
    if (ipAddress && !isPrivateIp(ipAddress)) {
      const geoRes = await fetch(
        `http://ip-api.com/json/${ipAddress}?fields=status,country,regionName,city,lat,lon`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (geo.status === 'success') {
          country = geo.country || null;
          city = geo.city || null;
          region = geo.regionName || null;
          latitude = typeof geo.lat === 'number' ? geo.lat : null;
          longitude = typeof geo.lon === 'number' ? geo.lon : null;
        }
      }
    }
  } catch {
    // Geolocation failed — continue without it
  }

  // Save access log to database
  try {
    await prisma.bookAccessLog.create({
      data: {
        bookId,
        userId: userId || null,
        ipAddress,
        userAgent,
        country,
        city,
        region,
        latitude,
        longitude,
      },
    });
  } catch (err) {
    // Log creation failed — don't block the user
    console.error('BookAccessLog creation failed:', err);
  }

  return NextResponse.json({ ok: true });
}
