import { NextResponse } from 'next/server';
import { getAuthUser, type JwtPayload } from './jwt';
import { prisma } from './prisma';

// Catalogue of all admin permission keys. Each /admin/* feature has at
// least a read flag; mutating features additionally have a write flag.
export const PERMISSIONS = [
  'orders.read', 'orders.write',
  'shipments.read', 'shipments.write',
  'inventory.read', 'inventory.write',
  'products.read', 'products.write',
  'customers.read', 'customers.write',
  'campaigns.read', 'campaigns.write',
  'coupons.read', 'coupons.write',
  'reviews.read', 'reviews.write',
  'books.read', 'books.write',
  'shipping.read', 'shipping.write',
  'payment-methods.read', 'payment-methods.write',
  'valuation.read',
  'settings.read', 'settings.write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Display labels (Arabic) for the staff UI checkbox grid.
export const PERMISSION_GROUPS: Array<{ label: string; perms: Permission[] }> = [
  { label: 'الطلبات والشحن', perms: ['orders.read', 'orders.write', 'shipments.read', 'shipments.write'] },
  { label: 'المنتجات والمخزون', perms: ['products.read', 'products.write', 'inventory.read', 'inventory.write'] },
  { label: 'العملاء والتسويق', perms: ['customers.read', 'customers.write', 'campaigns.read', 'campaigns.write', 'coupons.read', 'coupons.write', 'reviews.read', 'reviews.write'] },
  { label: 'المكتبة', perms: ['books.read', 'books.write'] },
  { label: 'الإعدادات', perms: ['shipping.read', 'shipping.write', 'payment-methods.read', 'payment-methods.write', 'settings.read', 'settings.write'] },
  { label: 'مالي', perms: ['valuation.read'] },
];

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
