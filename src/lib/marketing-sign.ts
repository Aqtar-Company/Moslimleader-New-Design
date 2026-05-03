// Lightweight HMAC signing for marketing URLs (open pixel + click redirect).
// Falls back to JWT_SECRET if MARKETING_SIGNING_SECRET isn't set so the
// integration works out-of-the-box, but operators are encouraged to set a
// dedicated secret.
import { createHmac, timingSafeEqual } from 'crypto';

function getSecret(): string {
  return (
    process.env.MARKETING_SIGNING_SECRET ||
    process.env.JWT_SECRET ||
    'unsafe-marketing-default-do-not-use-in-prod'
  );
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signTrackingPayload(parts: Record<string, string>): string {
  // Sort keys for canonical form so order doesn't change the signature.
  const canon = Object.keys(parts).sort().map(k => `${k}=${parts[k]}`).join('&');
  const mac = createHmac('sha256', getSecret()).update(canon).digest();
  return b64url(mac).slice(0, 22); // ~132 bits, plenty for unguessability
}

export function verifyTrackingSig(parts: Record<string, string>, sig: string | null): boolean {
  if (!sig) return false;
  const expected = signTrackingPayload(parts);
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}
