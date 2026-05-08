// Shared (client + server safe) permission catalogue. NEVER import
// next/headers, prisma, or anything node-only here — this file is bundled
// into client components like the staff management page.

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
  'valuation.read', 'valuation.write',
  'settings.read', 'settings.write',
  'suppliers.read', 'suppliers.write',
  'production.read', 'production.write',
  'zakat.read', 'zakat.write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_GROUPS: Array<{ label: string; perms: Permission[] }> = [
  { label: 'الطلبات والشحن', perms: ['orders.read', 'orders.write', 'shipments.read', 'shipments.write'] },
  { label: 'المنتجات والمخزون', perms: ['products.read', 'products.write', 'inventory.read', 'inventory.write'] },
  { label: 'العملاء والتسويق', perms: ['customers.read', 'customers.write', 'campaigns.read', 'campaigns.write', 'coupons.read', 'coupons.write', 'reviews.read', 'reviews.write'] },
  { label: 'المكتبة', perms: ['books.read', 'books.write'] },
  { label: 'الإعدادات', perms: ['shipping.read', 'shipping.write', 'payment-methods.read', 'payment-methods.write', 'settings.read', 'settings.write'] },
  { label: 'مالي', perms: ['valuation.read', 'valuation.write', 'zakat.read', 'zakat.write'] },
  { label: 'الموردون والإنتاج', perms: ['suppliers.read', 'suppliers.write', 'production.read', 'production.write'] },
];
