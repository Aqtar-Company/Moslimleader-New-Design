/**
 * Muslim Leader Support System — core business logic
 *
 * Two tracks:
 *  1. ML Price Support  — company subsidises part/all of product price
 *  2. Sponsored Copy    — external donor buys a full copy for a beneficiary
 *
 * All state transitions go through this file so the state machine is
 * enforced in one place.
 */

import { prisma } from './prisma';
import { logActionSafe } from './audit-log';

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface SupportSettings {
  featureEnabled: boolean;
  eligibleCountries: string[];       // ISO-3166-1 alpha-2, default ['EG']
  requestCooldownDays: number;       // default 90
  maxActiveRequests: number;         // per user, default 1
  maxMLSupportPercent: number;       // cap, default 100
  maxMLSupportAmount: number | null; // cap in EGP, null = no cap
  approvalExpiryHours: number;       // default 72
  maxSponsoredCopiesPerProduct: number; // default 20
  sponsoredCopyCoversShipping: boolean;
  mlMonthlyBudget: number | null;    // reporting only in V1
}

const DEFAULT_SETTINGS: SupportSettings = {
  featureEnabled: true,
  eligibleCountries: ['EG'],
  requestCooldownDays: 90,
  maxActiveRequests: 1,
  maxMLSupportPercent: 100,
  maxMLSupportAmount: null,
  approvalExpiryHours: 72,
  maxSponsoredCopiesPerProduct: 20,
  sponsoredCopyCoversShipping: false,
  mlMonthlyBudget: null,
};

export async function getSupportSettings(): Promise<SupportSettings> {
  const row = await prisma.setting.findUnique({ where: { key: 'support-settings' } });
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<SupportSettings>) };
}

export async function updateSupportSettings(
  patch: Partial<SupportSettings>,
  actorUserId: string,
  actorRole: string,
): Promise<SupportSettings> {
  const current = await getSupportSettings();
  // F-10: only apply known keys with range validation — never spread raw input
  const safe: Partial<SupportSettings> = {};
  if (patch.featureEnabled !== undefined) safe.featureEnabled = Boolean(patch.featureEnabled);
  if (patch.eligibleCountries !== undefined)
    safe.eligibleCountries = Array.isArray(patch.eligibleCountries)
      ? patch.eligibleCountries.filter((s): s is string => typeof s === 'string' && /^[A-Z]{2}$/.test(s))
      : current.eligibleCountries;
  if (patch.requestCooldownDays !== undefined)
    safe.requestCooldownDays = Math.max(0, Math.min(365, Math.trunc(Number(patch.requestCooldownDays))));
  if (patch.maxActiveRequests !== undefined)
    safe.maxActiveRequests = Math.max(1, Math.min(20, Math.trunc(Number(patch.maxActiveRequests))));
  if (patch.maxMLSupportPercent !== undefined)
    safe.maxMLSupportPercent = Math.max(1, Math.min(100, Number(patch.maxMLSupportPercent)));
  if (patch.maxMLSupportAmount !== undefined)
    safe.maxMLSupportAmount = patch.maxMLSupportAmount === null ? null : Math.max(0, Number(patch.maxMLSupportAmount));
  if (patch.approvalExpiryHours !== undefined)
    safe.approvalExpiryHours = Math.max(1, Math.min(8760, Math.trunc(Number(patch.approvalExpiryHours))));
  if (patch.maxSponsoredCopiesPerProduct !== undefined)
    safe.maxSponsoredCopiesPerProduct = Math.max(1, Math.min(10000, Math.trunc(Number(patch.maxSponsoredCopiesPerProduct))));
  if (patch.sponsoredCopyCoversShipping !== undefined)
    safe.sponsoredCopyCoversShipping = Boolean(patch.sponsoredCopyCoversShipping);
  if (patch.mlMonthlyBudget !== undefined)
    safe.mlMonthlyBudget = patch.mlMonthlyBudget === null ? null : Math.max(0, Number(patch.mlMonthlyBudget));
  const next = { ...current, ...safe };
  await prisma.setting.upsert({
    where: { key: 'support-settings' },
    create: { key: 'support-settings', value: next as object },
    update: { value: next as object },
  });
  await logActionSafe({
    actor: { userId: actorUserId, role: actorRole },
    action: 'support-settings.update',
    before: current,
    after: next,
  });
  return next;
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export async function checkRequestEligibility(
  userId: string,
  productId: string,
  country: string,
): Promise<EligibilityResult> {
  const settings = await getSupportSettings();

  if (!settings.featureEnabled) {
    return { eligible: false, reason: 'feature_disabled' };
  }
  if (!settings.eligibleCountries.includes(country)) {
    return { eligible: false, reason: 'ineligible_country' };
  }

  // Check active requests count
  const activeCount = await prisma.supportRequest.count({
    where: {
      userId,
      status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'MATCHED_WITH_SPONSORED_COPY', 'READY_FOR_CHECKOUT'] },
    },
  });
  if (activeCount >= settings.maxActiveRequests) {
    return { eligible: false, reason: 'max_active_requests' };
  }

  // Check for duplicate active request for same product
  const duplicate = await prisma.supportRequest.findFirst({
    where: {
      userId,
      productId,
      status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'MATCHED_WITH_SPONSORED_COPY', 'READY_FOR_CHECKOUT'] },
    },
  });
  if (duplicate) {
    return { eligible: false, reason: 'duplicate_active_request' };
  }

  // Check cooldown — only 'USED' has usedAt set; 'APPROVED' never does
  if (settings.requestCooldownDays > 0) {
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - settings.requestCooldownDays);
    const recentUsed = await prisma.supportRequest.findFirst({
      where: {
        userId,
        status: 'USED',
        usedAt: { gte: cooldownDate },
      },
    });
    if (recentUsed) {
      return { eligible: false, reason: 'cooldown_active' };
    }
  }

  return { eligible: true };
}

// ─── Customer Support History ─────────────────────────────────────────────────

export interface CustomerSupportHistory {
  totalOrders: number;
  totalOrderValue: number;
  supportRequestsTotal: number;
  supportRequestsApproved: number;
  supportRequestsUsed: number;
  totalMLSupportReceived: number;
  sponsoredCopiesReceived: number;
  lastSupportDate: Date | null;
  unusedApprovals: number;
}

export async function getCustomerSupportHistory(userId: string): Promise<CustomerSupportHistory> {
  const [orders, requests, allocations, copies] = await Promise.all([
    prisma.order.findMany({
      where: { userId, status: { not: 'cancelled' } },
      select: { total: true },
    }),
    prisma.supportRequest.findMany({
      where: { userId },
      select: { status: true, usedAt: true, approvedAt: true },
    }),
    prisma.muslimLeaderSupportAllocation.findMany({
      where: { supportRequest: { userId }, status: 'CONSUMED' },
      select: { supportAmount: true },
    }),
    prisma.sponsoredCopy.findMany({
      where: { beneficiaryUserId: userId },
      select: { deliveredAt: true, status: true },
    }),
  ]);

  const usedRequests = requests.filter(r => r.status === 'USED');
  const approvedRequests = requests.filter(r =>
    ['APPROVED', 'MATCHED_WITH_SPONSORED_COPY', 'READY_FOR_CHECKOUT', 'USED'].includes(r.status),
  );
  const unusedApprovals = requests.filter(r =>
    ['APPROVED', 'MATCHED_WITH_SPONSORED_COPY', 'READY_FOR_CHECKOUT'].includes(r.status),
  );

  const lastSupport = usedRequests
    .map(r => r.usedAt)
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;

  return {
    totalOrders: orders.length,
    totalOrderValue: orders.reduce((s, o) => s + o.total, 0),
    supportRequestsTotal: requests.length,
    supportRequestsApproved: approvedRequests.length,
    supportRequestsUsed: usedRequests.length,
    totalMLSupportReceived: allocations.reduce((s, a) => s + a.supportAmount, 0),
    sponsoredCopiesReceived: copies.length,
    lastSupportDate: lastSupport ?? null,
    unusedApprovals: unusedApprovals.length,
  };
}

// ─── Support Request lifecycle ────────────────────────────────────────────────

export type SupportRequestInput = {
  userId: string;
  productId: string;
  variantIndex?: number;
  quantity: number;
  reason: string;
  note?: string;
  country: string;
  // Price snapshot — caller must compute these server-side
  snapshotProductPrice: number;
  snapshotDiscount: number;
  snapshotEligiblePrice: number;
  snapshotShipping: number;
  currency: string;
  // Customer snapshot
  customerName: string;
  customerPhone?: string;
  customerEmail: string;
};

export async function createSupportRequest(input: SupportRequestInput) {
  const eligibility = await checkRequestEligibility(input.userId, input.productId, input.country);
  if (!eligibility.eligible) {
    throw new Error(`ineligible:${eligibility.reason}`);
  }
  const settings = await getSupportSettings();
  const expiryMs = settings.approvalExpiryHours * 60 * 60 * 1000;

  const req = await prisma.supportRequest.create({
    data: {
      userId: input.userId,
      productId: input.productId,
      variantIndex: input.variantIndex ?? null,
      quantity: input.quantity,
      reason: input.reason,
      note: input.note ?? null,
      snapshotProductPrice: input.snapshotProductPrice,
      snapshotDiscount: input.snapshotDiscount,
      snapshotEligiblePrice: input.snapshotEligiblePrice,
      snapshotShipping: input.snapshotShipping,
      currency: input.currency,
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      customerEmail: input.customerEmail,
      country: input.country,
      status: 'PENDING',
    },
  });

  await logActionSafe({
    actor: { userId: input.userId, role: 'customer' },
    action: 'support-request.create',
    entity: 'SupportRequest',
    entityId: req.id,
    after: { productId: input.productId, reason: input.reason },
  });

  return req;
}

export async function setUnderReview(requestId: string, adminUserId: string, adminRole: string) {
  const req = await getRequestOrThrow(requestId);
  assertStatus(req.status, ['PENDING'], 'set under review');

  await prisma.supportRequest.update({
    where: { id: requestId },
    data: { status: 'UNDER_REVIEW', reviewedByUserId: adminUserId },
  });

  await logActionSafe({
    actor: { userId: adminUserId, role: adminRole },
    action: 'support-request.under-review',
    entity: 'SupportRequest',
    entityId: requestId,
  });
}

// ─── ML Support approval ──────────────────────────────────────────────────────

export type MLApprovalOptions =
  | { mode: 'percent'; percent: number }
  | { mode: 'fixed'; amount: number }
  | { mode: 'final'; customerPays: number };

export async function approveMLSupport(
  requestId: string,
  adminUserId: string,
  adminRole: string,
  options: MLApprovalOptions,
) {
  const req = await getRequestOrThrow(requestId);
  assertStatus(req.status, ['PENDING', 'UNDER_REVIEW'], 'approve ML support');

  const settings = await getSupportSettings();
  const eligible = req.snapshotEligiblePrice;

  let supportAmount: number;
  let supportPercent: number;
  let customerPays: number;

  if (options.mode === 'percent') {
    const pct = Math.min(options.percent, settings.maxMLSupportPercent);
    supportAmount = Math.round(eligible * pct) / 100;
    supportPercent = pct;
    customerPays = Math.max(0, eligible - supportAmount);
  } else if (options.mode === 'fixed') {
    supportAmount = Math.min(options.amount, eligible);
    supportPercent = (supportAmount / eligible) * 100;
    customerPays = Math.max(0, eligible - supportAmount);
  } else {
    customerPays = Math.max(0, Math.min(options.customerPays, eligible));
    supportAmount = eligible - customerPays;
    supportPercent = (supportAmount / eligible) * 100;
  }

  // Apply max amount cap — recompute percent to reflect the capped value
  if (settings.maxMLSupportAmount !== null && supportAmount > settings.maxMLSupportAmount) {
    supportAmount = settings.maxMLSupportAmount;
    customerPays = Math.max(0, eligible - supportAmount);
    supportPercent = eligible > 0 ? (supportAmount / eligible) * 100 : 0;
  }

  const expiresAt = new Date(Date.now() + settings.approvalExpiryHours * 3600 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.supportRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        supportType: 'ML_SUPPORT',
        mlSupportAmount: supportAmount,
        mlSupportPercent: supportPercent,
        customerPayAmount: customerPays,
        approvedAt: new Date(),
        expiresAt,
        reviewedByUserId: adminUserId,
      },
    });

    const alloc = await tx.muslimLeaderSupportAllocation.create({
      data: {
        supportRequestId: requestId,
        originalPrice: eligible,
        supportAmount,
        customerPayAmount: customerPays,
        currency: req.currency,
        status: 'RESERVED',
        approvedByUserId: adminUserId,
      },
    });

    await tx.muslimLeaderSupportLedger.create({
      data: {
        type: 'ML_SUPPORT_RESERVED',
        amount: supportAmount,
        allocationId: alloc.id,
        description: `Support request ${requestId}`,
        actorUserId: adminUserId,
      },
    });
  });

  await logActionSafe({
    actor: { userId: adminUserId, role: adminRole },
    action: 'support-request.approve-ml',
    entity: 'SupportRequest',
    entityId: requestId,
    after: { supportAmount, customerPays, expiresAt },
  });
}

// ─── Sponsored Copy assignment ─────────────────────────────────────────────────

export async function assignSponsoredCopy(
  requestId: string,
  copyId: string,
  adminUserId: string,
  adminRole: string,
) {
  const [req, copy] = await Promise.all([
    getRequestOrThrow(requestId),
    getCopyOrThrow(copyId),
  ]);

  assertStatus(req.status, ['PENDING', 'UNDER_REVIEW'], 'assign sponsored copy');
  assertStatus(copy.status, ['AVAILABLE'], 'assign sponsored copy');

  if (copy.productId !== req.productId) {
    throw new Error('product_mismatch');
  }
  if (req.variantIndex !== null && copy.variantIndex !== req.variantIndex) {
    throw new Error('variant_mismatch');
  }

  const settings = await getSupportSettings();
  const expiresAt = new Date(Date.now() + settings.approvalExpiryHours * 3600 * 1000);

  await prisma.$transaction(async (tx) => {
    // C-1: atomic conditional update — only succeeds if status is still AVAILABLE.
    // Plain findUnique inside a transaction does NOT lock in MySQL REPEATABLE READ,
    // so we replace read+update with a single updateMany + count check.
    const claimed = await tx.sponsoredCopy.updateMany({
      where: { id: copyId, status: 'AVAILABLE' },
      data: {
        status: 'ASSIGNED',
        beneficiaryUserId: req.userId,
        supportRequestId: requestId,
        assignedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new Error('copy_no_longer_available');
    }

    await tx.supportRequest.update({
      where: { id: requestId },
      data: {
        status: 'MATCHED_WITH_SPONSORED_COPY',
        supportType: 'SPONSORED_COPY',
        approvedAt: new Date(),
        expiresAt,
        reviewedByUserId: adminUserId,
      },
    });

    await tx.sponsoredCopyEvent.create({
      data: { copyId, event: 'COPY_ASSIGNED', actorUserId: adminUserId,
        metadata: { requestId, beneficiaryUserId: req.userId } },
    });
  });

  await logActionSafe({
    actor: { userId: adminUserId, role: adminRole },
    action: 'support-request.approve-copy',
    entity: 'SupportRequest',
    entityId: requestId,
    after: { copyId },
  });
}

export async function rejectSupportRequest(
  requestId: string,
  adminUserId: string,
  adminRole: string,
  reason: string,
) {
  const req = await getRequestOrThrow(requestId);
  assertStatus(req.status, ['PENDING', 'UNDER_REVIEW'], 'reject support request');

  await prisma.supportRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: reason,
      reviewedByUserId: adminUserId,
    },
  });

  await logActionSafe({
    actor: { userId: adminUserId, role: adminRole },
    action: 'support-request.reject',
    entity: 'SupportRequest',
    entityId: requestId,
    metadata: { reason },
  });
}

// Called when order is placed with ML support
export async function consumeMLSupport(
  requestId: string,
  orderId: string,
  actorUserId: string,
) {
  const req = await getRequestOrThrow(requestId);
  assertStatus(req.status, ['APPROVED'], 'consume ML support');

  const alloc = await prisma.muslimLeaderSupportAllocation.findUnique({
    where: { supportRequestId: requestId },
  });
  if (!alloc || alloc.status !== 'RESERVED') {
    throw new Error('allocation_not_reserved');
  }

  await prisma.$transaction(async (tx) => {
    await tx.muslimLeaderSupportAllocation.update({
      where: { id: alloc.id },
      data: { status: 'CONSUMED', orderId, consumedAt: new Date() },
    });

    await tx.muslimLeaderSupportLedger.create({
      data: {
        type: 'ML_SUPPORT_CONSUMED',
        amount: alloc.supportAmount,
        allocationId: alloc.id,
        description: `Order ${orderId}`,
        actorUserId,
      },
    });

    await tx.supportRequest.update({
      where: { id: requestId },
      data: { status: 'USED', usedAt: new Date() },
    });
  });

  await logActionSafe({
    actor: { userId: actorUserId, role: 'system' },
    action: 'support-request.consume',
    entity: 'SupportRequest',
    entityId: requestId,
    metadata: { orderId },
  });
}

// Called when ML-approved request expires without checkout
export async function releaseMLSupport(requestId: string) {
  const req = await prisma.supportRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== 'APPROVED') return;

  const alloc = await prisma.muslimLeaderSupportAllocation.findUnique({
    where: { supportRequestId: requestId },
  });
  if (!alloc || alloc.status !== 'RESERVED') return;

  await prisma.$transaction(async (tx) => {
    await tx.muslimLeaderSupportAllocation.update({
      where: { id: alloc.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    await tx.muslimLeaderSupportLedger.create({
      data: {
        type: 'ML_SUPPORT_RELEASED',
        amount: alloc.supportAmount,
        allocationId: alloc.id,
        description: `Expired request ${requestId}`,
      },
    });

    await tx.supportRequest.update({
      where: { id: requestId },
      data: { status: 'EXPIRED' },
    });
  });
}

// ─── Sponsored Copy code generation ──────────────────────────────────────────

export async function generateCopyCode(): Promise<string> {
  // Atomic: insert into sequence table, use returned id.
  // L-1: delete the row immediately after reading to prevent unbounded table growth.
  const seq = await prisma.sponsoredCopySeq.create({ data: {} });
  await prisma.sponsoredCopySeq.delete({ where: { id: seq.id } });
  return `ML-SP-${String(seq.id).padStart(6, '0')}`;
}

// ─── Sponsored Copy creation (after payment) ──────────────────────────────────

export async function createSponsoredCopies(
  sponsoredOrderId: string,
  adminUserId?: string,
): Promise<{ id: string; code: string }[]> {
  const order = await prisma.sponsoredOrder.findUnique({
    where: { id: sponsoredOrderId },
    include: { sponsor: true },
  });
  if (!order) throw new Error('order_not_found');
  if (order.paymentStatus !== 'paid') throw new Error('order_not_paid');

  // Idempotency: skip if copies already exist
  const existing = await prisma.sponsoredCopy.findMany({
    where: { sponsoredOrderId },
    select: { id: true, code: true },
  });
  if (existing.length === order.quantity) return existing;
  if (existing.length > 0) {
    // Partial: only create the missing ones
  }

  const needed = order.quantity - existing.length;
  const created: { id: string; code: string }[] = [...existing];

  for (let i = 0; i < needed; i++) {
    const code = await generateCopyCode();
    // C-2: wrap copy + first event in a single transaction so a crash
    // between them never leaves an orphaned copy without an event.
    const copy = await prisma.$transaction(async (tx) => {
      const c = await tx.sponsoredCopy.create({
        data: {
          code,
          sponsorId: order.sponsorId,
          sponsoredOrderId,
          productId: order.productId,
          variantIndex: order.variantIndex ?? null,
          originalPrice: order.pricePerCopy,
          paidPrice: order.pricePerCopy,
          currency: order.currency,
          status: 'AVAILABLE',
          purchasedAt: new Date(),
        },
      });
      await tx.sponsoredCopyEvent.create({
        data: {
          copyId: c.id,
          event: 'COPY_CREATED',
          actorUserId: adminUserId ?? order.sponsor.userId ?? undefined,
          metadata: { sponsoredOrderId } as never,
        },
      });
      return c;
    });

    created.push({ id: copy.id, code: copy.code });

    await logActionSafe({
      actor: adminUserId ? { userId: adminUserId, role: 'admin' } : null,
      action: 'sponsored-copy.create',
      entity: 'SponsoredCopy',
      entityId: copy.id,
      after: { code, productId: order.productId },
    });
  }

  return created;
}

// ─── Sponsored Copy state transitions ─────────────────────────────────────────

export async function startPreparation(copyId: string, adminUserId: string, adminRole: string) {
  const copy = await getCopyOrThrow(copyId);
  assertStatus(copy.status, ['ASSIGNED'], 'start preparation');

  await prisma.sponsoredCopy.update({
    where: { id: copyId },
    data: { status: 'IN_PREPARATION', preparationStartedAt: new Date() },
  });
  await recordCopyEvent(copyId, 'PREPARATION_STARTED', adminUserId);
  await logActionSafe({
    actor: { userId: adminUserId, role: adminRole },
    action: 'sponsored-copy.preparation-start',
    entity: 'SponsoredCopy', entityId: copyId,
  });
}

export interface ShippingData {
  provider: string;
  shipmentId?: string;
  trackingNumber?: string;
}

export async function markShipped(
  copyId: string,
  adminUserId: string,
  adminRole: string,
  shipping: ShippingData,
) {
  const copy = await getCopyOrThrow(copyId);
  assertStatus(copy.status, ['IN_PREPARATION', 'READY_TO_SHIP'], 'mark shipped');

  await prisma.sponsoredCopy.update({
    where: { id: copyId },
    data: {
      status: 'SHIPPED',
      shippingProvider: shipping.provider,
      shipmentId: shipping.shipmentId ?? null,
      trackingNumber: shipping.trackingNumber ?? null,
      shippedAt: new Date(),
    },
  });
  await recordCopyEvent(copyId, 'SHIPPED', adminUserId, { ...shipping } as Record<string, unknown>);
  await logActionSafe({
    actor: { userId: adminUserId, role: adminRole },
    action: 'sponsored-copy.ship',
    entity: 'SponsoredCopy', entityId: copyId,
    after: shipping,
  });
}

export async function markDelivered(copyId: string, adminUserId: string, adminRole: string) {
  const copy = await getCopyOrThrow(copyId);
  assertStatus(copy.status, ['SHIPPED'], 'mark delivered');

  await prisma.sponsoredCopy.update({
    where: { id: copyId },
    data: { status: 'DELIVERED', deliveredAt: new Date() },
  });
  await recordCopyEvent(copyId, 'DELIVERED', adminUserId);
  await logActionSafe({
    actor: { userId: adminUserId, role: adminRole },
    action: 'sponsored-copy.deliver',
    entity: 'SponsoredCopy', entityId: copyId,
  });
}

export async function confirmBeneficiaryReceipt(copyId: string, userId: string) {
  const copy = await getCopyOrThrow(copyId);
  if (copy.beneficiaryUserId !== userId) throw new Error('not_beneficiary');
  assertStatus(copy.status, ['DELIVERED'], 'confirm receipt');

  await prisma.sponsoredCopy.update({
    where: { id: copyId },
    data: { status: 'CONFIRMED', beneficiaryConfirmedAt: new Date() },
  });
  await recordCopyEvent(copyId, 'BENEFICIARY_CONFIRMED', userId);
  await logActionSafe({
    actor: { userId, role: 'customer' },
    action: 'sponsored-copy.beneficiary-confirm',
    entity: 'SponsoredCopy', entityId: copyId,
  });
}

export async function completeCopy(copyId: string, adminUserId: string, adminRole: string) {
  const copy = await getCopyOrThrow(copyId);
  assertStatus(copy.status, ['CONFIRMED', 'DELIVERED'], 'complete copy');

  await prisma.sponsoredCopy.update({
    where: { id: copyId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  await recordCopyEvent(copyId, 'COMPLETED', adminUserId);
  await logActionSafe({
    actor: { userId: adminUserId, role: adminRole },
    action: 'sponsored-copy.complete',
    entity: 'SponsoredCopy', entityId: copyId,
  });
}

export async function refundCopy(
  copyId: string,
  adminUserId: string,
  adminRole: string,
  data: { amount: number; reason: string; paymentRef?: string },
) {
  const copy = await getCopyOrThrow(copyId);
  assertStatus(copy.status, ['AVAILABLE', 'RESERVED', 'ASSIGNED'], 'refund copy');

  // H-1: wrap both updates in one transaction — a crash between them
  // would leave the SupportRequest cancelled but the copy still ASSIGNED.
  await prisma.$transaction(async (tx) => {
    if (copy.supportRequestId) {
      await tx.supportRequest.update({
        where: { id: copy.supportRequestId },
        data: { status: 'CANCELLED' },
      });
    }
    await tx.sponsoredCopy.update({
      where: { id: copyId },
      data: {
        status: 'REFUNDED',
        refundAmount: data.amount,
        refundReason: data.reason,
        refundPaymentRef: data.paymentRef ?? null,
        refundedByUserId: adminUserId,
        refundedAt: new Date(),
        beneficiaryUserId: null,
        supportRequestId: null,
        assignedAt: null,
      },
    });
  });

  await recordCopyEvent(copyId, 'REFUNDED', adminUserId, data as Record<string, unknown>);
  await logActionSafe({
    actor: { userId: adminUserId, role: adminRole },
    action: 'sponsored-copy.refund',
    entity: 'SponsoredCopy', entityId: copyId,
    metadata: data,
  });
}

// ─── ML Budget helpers ─────────────────────────────────────────────────────────

export interface MLBudgetSummary {
  monthlyBudget: number | null;
  usedThisMonth: number;
  reservedThisMonth: number;
  availableThisMonth: number | null;
}

export async function getMLBudgetSummary(): Promise<MLBudgetSummary> {
  const settings = await getSupportSettings();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const entries = await prisma.muslimLeaderSupportLedger.findMany({
    where: { createdAt: { gte: monthStart } },
    select: { type: true, amount: true },
  });

  const usedThisMonth = entries
    .filter(e => e.type === 'ML_SUPPORT_CONSUMED')
    .reduce((s, e) => s + e.amount, 0);

  const reservedThisMonth = entries
    .filter(e => e.type === 'ML_SUPPORT_RESERVED')
    .reduce((s, e) => s + e.amount, 0);

  const releasedThisMonth = entries
    .filter(e => e.type === 'ML_SUPPORT_RELEASED')
    .reduce((s, e) => s + e.amount, 0);

  const netReserved = Math.max(0, reservedThisMonth - releasedThisMonth - usedThisMonth);

  return {
    monthlyBudget: settings.mlMonthlyBudget,
    usedThisMonth,
    reservedThisMonth: netReserved,
    availableThisMonth: settings.mlMonthlyBudget !== null
      ? Math.max(0, settings.mlMonthlyBudget - usedThisMonth - netReserved)
      : null,
  };
}

// ─── Sponsor / SponsoredOrder helpers ─────────────────────────────────────────

export async function getOrCreateSponsorForUser(userId: string, userData: {
  name: string; phone?: string; email?: string;
}) {
  // C-3: use upsert to avoid unique-constraint race when two concurrent
  // requests both find no existing sponsor and both attempt to create one.
  return prisma.sponsor.upsert({
    where: { userId },
    create: {
      userId,
      name: userData.name,
      phone: userData.phone ?? null,
      email: userData.email ?? null,
    },
    update: {},
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getRequestOrThrow(id: string) {
  const req = await prisma.supportRequest.findUnique({ where: { id } });
  if (!req) throw new Error('request_not_found');
  return req;
}

async function getCopyOrThrow(id: string) {
  const copy = await prisma.sponsoredCopy.findUnique({ where: { id } });
  if (!copy) throw new Error('copy_not_found');
  return copy;
}

function assertStatus(current: string, allowed: string[], operation: string) {
  if (!allowed.includes(current)) {
    throw new Error(`invalid_status:${current}:${operation}`);
  }
}

async function recordCopyEvent(
  copyId: string,
  event: string,
  actorUserId?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.sponsoredCopyEvent.create({
    data: { copyId, event, actorUserId: actorUserId ?? null, metadata: metadata as never ?? undefined },
  });
}
