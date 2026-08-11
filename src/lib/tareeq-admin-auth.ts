import { SignJWT, jwtVerify } from 'jose';
import { TareeqAdminRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'ta_session';

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    return new TextEncoder().encode('dev-only-fallback-secret-not-for-production');
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(adminId: string, sessionId: string): Promise<string> {
  return new SignJWT({ adminId, sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret());
}

export async function verifyAdminToken(
  token: string,
): Promise<{ adminId: string; sessionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { adminId, sessionId } = payload as { adminId: string; sessionId: string };
    if (!adminId || !sessionId) return null;
    return { adminId, sessionId };
  } catch {
    return null;
  }
}

// ─── Session retrieval ────────────────────────────────────────────────────────

/** Parse the ta_session cookie from a plain Request's Cookie header. */
function extractCookie(req: Request): string | null {
  const header = req.headers.get('cookie') ?? '';
  const match = header.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getAdminSession(req: Request) {
  const token = extractCookie(req);
  if (!token) return null;

  const claims = await verifyAdminToken(token);
  if (!claims) return null;

  const session = await prisma.tareeqAdminSession.findUnique({
    where: { id: claims.sessionId },
    include: { admin: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.adminId !== claims.adminId) return null;
  if (!session.admin.isActive) return null;

  return { admin: session.admin, session };
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

/**
 * Throws a 401 or 403 Response if the request is not authenticated or lacks
 * the required role. Otherwise returns the TareeqAdmin record.
 *
 * Usage in route handlers:
 *   let admin;
 *   try { admin = await requireAdmin(req); }
 *   catch (e) { return e as Response; }
 */
export async function requireAdmin(req: Request, allowedRoles?: TareeqAdminRole[]) {
  const result = await getAdminSession(req);
  if (!result) {
    throw Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(result.admin.role)) {
    throw Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return result.admin;
}

// ─── Audit logging ────────────────────────────────────────────────────────────

export async function logAudit(
  adminId: string,
  action: string,
  opts?: {
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ip?: string;
  },
) {
  try {
    await prisma.tareeqAuditLog.create({
      data: {
        adminId,
        action,
        targetType: opts?.targetType ?? null,
        targetId: opts?.targetId ?? null,
        details: opts?.details ?? undefined,
        ip: opts?.ip ?? null,
      },
    });
  } catch (err) {
    console.error('[logAudit]', err);
  }
}

// ─── Role permissions ─────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<TareeqAdminRole, string[]> = {
  SUPER_ADMIN: [
    'users.view',
    'users.moderate',
    'content.moderate',
    'reports.view',
    'reports.resolve',
    'security.view',
    'audit.view',
    'features.manage',
    'settings.manage',
    'notifications.send',
    'support.view',
    'health.view',
    'roles.manage',
  ],
  MODERATOR: [
    'users.view',
    'users.moderate',
    'content.moderate',
    'reports.view',
    'reports.resolve',
    'notifications.send',
  ],
  SUPPORT: ['users.view', 'support.view'],
  SECURITY: ['users.view', 'security.view', 'audit.view', 'health.view'],
};

export function hasPermission(role: TareeqAdminRole, perm: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

// ─── Cookie helpers (re-exported for route handlers) ─────────────────────────

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE = 8 * 60 * 60; // 8 h in seconds
