export const dynamic = 'force-dynamic';

import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';

/**
 * GET /api/tareeq-admin/auth/totp/setup
 * Generate a new TOTP secret, persist it (unverified), return QR data URL.
 */
export async function GET(req: Request) {
  let admin;
  try {
    admin = await requireAdmin(req, undefined, { allowSetupIncomplete: true });
  } catch (e) {
    return e as Response;
  }

  try {
    const secret = generateSecret();

    // Store the secret immediately (totpEnabled stays false until POST verifies it)
    await prisma.tareeqAdmin.update({
      where: { id: admin.id },
      data: { totpSecret: secret },
    });

    const otpauthUrl = generateURI({
      issuer: 'Tareeq Admin',
      label: admin.email,
      secret,
      type: 'totp',
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    return Response.json({ ok: true, secret, otpauthUrl, qrDataUrl });
  } catch (err) {
    console.error('[tareeq-admin/totp/setup GET]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tareeq-admin/auth/totp/setup
 * Body: { totpCode }
 * Verify code against the stored (unverified) secret; on success enable TOTP.
 */
export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin(req, undefined, { allowSetupIncomplete: true });
  } catch (e) {
    return e as Response;
  }

  try {
    const body = await req.json();
    const { totpCode } = body as { totpCode?: string };

    if (!totpCode) {
      return Response.json({ error: 'totpCode is required' }, { status: 400 });
    }

    // Re-fetch to get the latest totpSecret (may have just been set in GET)
    const fresh = await prisma.tareeqAdmin.findUnique({ where: { id: admin.id } });
    if (!fresh?.totpSecret) {
      return Response.json(
        { error: 'No TOTP secret found. Call GET first to generate one.' },
        { status: 400 },
      );
    }

    const result = verifySync({ token: totpCode, secret: fresh.totpSecret });
    const valid = result?.valid ?? false;
    if (!valid) {
      return Response.json({ error: 'Invalid TOTP code' }, { status: 400 });
    }

    await prisma.tareeqAdmin.update({
      where: { id: admin.id },
      data: { totpEnabled: true },
    });

    return Response.json({ ok: true, message: 'TOTP enabled successfully' });
  } catch (err) {
    console.error('[tareeq-admin/totp/setup POST]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
