import { prisma } from './prisma';
import type { AuthedUser } from './permissions';
import { Prisma } from '@prisma/client';

// Catalogue of audit actions. Keep keys stable — they're persisted in DB
// rows and surfaced verbatim in the activity widget. Add new actions
// here rather than ad-hoc strings so the dashboard can render Arabic
// labels consistently.
export const AUDIT_ACTIONS = {
  // Settings & shipping
  'intl-shipping.update': 'تحديث إعدادات الشحن الدولي',
  'shipping.update': 'تحديث أسعار الشحن المحلي',
  'settings.update': 'تحديث إعدادات الموقع',
  'payment-methods.update': 'تحديث وسائل الدفع',
  // Products & inventory
  'product.create': 'إنشاء منتج',
  'product.update': 'تعديل منتج',
  'product.delete': 'حذف منتج',
  'inventory.adjust': 'تعديل المخزون',
  // Orders & shipments
  'order.create-manual': 'إنشاء أوردر يدوي',
  'order.update-status': 'تغيير حالة الأوردر',
  'order.delete': 'حذف أوردر',
  'shipment.bosta-create': 'إنشاء شحنة بوسطة',
  'shipment.bosta-cancel': 'إلغاء شحنة بوسطة',
  // Customers
  'customer.update': 'تعديل عميل',
  'customer.delete': 'حذف عميل',
  // Marketing
  'coupon.create': 'إنشاء كوبون',
  'coupon.update': 'تعديل كوبون',
  'coupon.delete': 'حذف كوبون',
  'campaign.create': 'إنشاء حملة',
  'campaign.send': 'إرسال حملة',
  // Library
  'book.create': 'إضافة كتاب',
  'book.update': 'تعديل كتاب',
  'book.delete': 'حذف كتاب',
  // Staff management
  'staff.add': 'إضافة مساعد',
  'staff.update-perms': 'تعديل صلاحيات مساعد',
  'staff.revoke': 'إلغاء مساعد',
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export interface LogActionInput {
  actor: AuthedUser | { userId: string; role: string; name?: string; email: string } | null;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

// Append an audit row. Failures are caught and logged — they MUST NOT
// propagate, so a logging blip can never break the underlying business
// operation that just succeeded.
export async function logActionSafe(input: LogActionInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actor?.userId ?? null,
        actorRole: input.actor?.role ?? null,
        actorName: input.actor?.name ?? null,
        actorEmail: input.actor?.email ?? null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        before: input.before === undefined ? Prisma.JsonNull : (input.before as Prisma.InputJsonValue),
        after: input.after === undefined ? Prisma.JsonNull : (input.after as Prisma.InputJsonValue),
        metadata: input.metadata === undefined ? Prisma.JsonNull : (input.metadata as Prisma.InputJsonValue),
      },
    });
  } catch (err) {
    // Never throw from the audit helper. A logging failure shouldn't
    // roll back the actual business operation that already succeeded.
    console.error('[audit-log]', err);
  }
}

export function actionLabel(action: string): string {
  return (AUDIT_ACTIONS as Record<string, string>)[action] ?? action;
}
