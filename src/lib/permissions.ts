import { NextResponse } from 'next/server';
import { getAuthUser, type JwtPayload } from './jwt';
import { prisma } from './prisma';
import { PERMISSIONS, type Permission } from './permissions-shared';

// Re-export the shared catalogue so existing server code that imports
// from '@/lib/permissions' keeps working.
export { PERMISSIONS, PERMISSION_GROUPS, type Permission } from './permissions-shared';

export interface AuthedUser extends JwtPayload {
  permissions: Permission[];
  isSuperAdmin: boolean;
}

// Fetch the currently-signed-in user with their fresh permission list
// from DB. Super-admins (role='admin') get every permission implicitly.
// Staff (role='staff') get only what's stored in User.permissions.
export async function getAuthUserWithPerms(): Promise<AuthedUser | null> {
  const auth = await getAuthUser();
  if (!auth) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true, permissions: true },
  });
  if (!dbUser) return null;
  const isSuperAdmin = dbUser.role === 'admin';
  const stored = (dbUser.permissions ?? []) as unknown[];
  const perms = isSuperAdmin
    ? [...PERMISSIONS]
    : stored.filter((p): p is Permission => PERMISSIONS.includes(p as Permission));
  return { ...auth, role: dbUser.role, permissions: perms, isSuperAdmin };
}

export function hasPermission(user: AuthedUser | null, perm: Permission): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions.includes(perm);
}

// Convenience guard for API routes. Returns NextResponse on rejection,
// or the authed user on success. Pass an array when ANY perm is enough.
export async function requirePerm(
  perm: Permission | Permission[],
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
  const user = await getAuthUserWithPerms();
  if (!user) return { response: NextResponse.json({ error: 'غير مصرح' }, { status: 401 }) };
  if (user.role !== 'admin' && user.role !== 'staff') {
    return { response: NextResponse.json({ error: 'غير مصرح' }, { status: 403 }) };
  }
  const needed = Array.isArray(perm) ? perm : [perm];
  const ok = needed.some(p => hasPermission(user, p));
  if (!ok) return { response: NextResponse.json({ error: 'هذه الصفحة لا تتوفر لك' }, { status: 403 }) };
  return { user };
}

// Super-admin only — for managing other staff.
export async function requireSuperAdmin(): Promise<{ user: AuthedUser } | { response: NextResponse }> {
  const user = await getAuthUserWithPerms();
  if (!user) return { response: NextResponse.json({ error: 'غير مصرح' }, { status: 401 }) };
  if (!user.isSuperAdmin) return { response: NextResponse.json({ error: 'الصلاحية للأدمن الرئيسي فقط' }, { status: 403 }) };
  return { user };
}
