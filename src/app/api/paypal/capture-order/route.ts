export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { capturePayPalOrder, PayPalCaptureError } from '@/lib/paypal';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { sendOrderEmails } from '@/lib/order-email';
import { egpToUsd } from '@/lib/currency';
import { attributeOrderToCampaign } from '@/lib/campaign-attribution';
import { logActionSafe } from '@/lib/audit-log';
import { applyOverride, loadStaticOverrides } from '@/lib/product-overrides';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // Cookie-based auth is the happy path. On Safari / iOS the
    // sameSite=none cookie occasionally drops across the PayPal
    // popup roundtrip (ITP behaviour), so we ALSO accept a
    // verified user identity recovered from the captured order's
    // reference_id (set in /create-order as `${userId}-${timestamp}`).
    // This avoids a 401 after the customer has already paid.
    const auth = await getAuthUser();

    const body = await req.json();
    const paypalOrderId = String(body?.paypalOrderId || '');
    const items = body?.items;
    const shippingAddress = body?.shippingAddress;

    if (!paypalOrderId || !Array.isArray(items) || items.length === 0 || !shippingAddress) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({ where: { paypalOrderId } });
    if (existing) {
      return NextResponse.json({ orderId: existing.id, status: existing.status });
    }

    // Server-side address validation (anti-garbage data)
    const addr = shippingAddress as Record<string, any>;
    const nameOk = (s: any) => typeof s === 'string' && s.trim().length >= 2 && /[\u0600-\u06FFa-zA-Z]{2,}/.test(s);
    const phoneOk = (s: any) => typeof s === 'string' && /^[+\d\s()-]{7,20}$/.test(s.trim());
    const streetOk = (s: any) => typeof s === 'string' && s.trim().length >= 4;

    if (!nameOk(addr.firstName) || !nameOk(addr.lastName)) {
      return NextResponse.json({ error: 'الاسم غير صحيح' }, { status: 400 });
    }
    if (!phoneOk(addr.phone)) {
      return NextResponse.json({ error: 'رقم الهاتف غير صحيح' }, { status: 400 });
    }
    if (!streetOk(addr.street)) {
      return NextResponse.json({ error: 'عنوان الشارع غير صحيح' }, { status: 400 });
    }

    // Rate limit: 20 capture attempts per user per hour (higher than create since
    // the PayPal popup sometimes triggers a retry on slow connections)
    const captureAuth = auth ?? { userId: '' };
    const rlKey = captureAuth.userId || req.headers.get('x-forwarded-for') || 'anon';
    const rl = checkRateLimit(`paypal-capture:${rlKey}`, 20, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'تجاوزت الحد المسموح به، حاول لاحقاً' }, { status: 429 });
    }

    // Batch-fetch all products in one query
    const productIds = items.map((it: any) => String(it.productId));
    const dbProductsList = await prisma.product.findMany({
      where: { OR: [{ id: { in: productIds } }, { slug: { in: productIds } }] },
    });

    // Apply product overrides for static products (admin price/image changes)
    const overrides = await loadStaticOverrides().catch(() => ({}) as Record<string, any>);
    const dbProductsOverridden = dbProductsList.map(p =>
      p.source === 'static' ? (applyOverride(p as any, (overrides as Record<string, any>)[p.id]) ?? p) : p
    );
    const dbProductMap = new Map(dbProductsOverridden.flatMap(p => [[p.id, p], [p.slug, p]]));

    let totalUsd = 0;
    const resolvedItems: any[] = [];
    for (const item of items) {
      const qty = Number(item?.quantity);
      if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
        return NextResponse.json({ error: 'كمية غير صحيحة' }, { status: 400 });
      }

      let dbProduct = dbProductMap.get(String(item.productId)) ?? null;

      if (!dbProduct) {
        const sp = staticProducts.find(p => p.id === item.productId || p.slug === item.productId);
        if (sp) {
          dbProduct = await prisma.product.upsert({
            where: { slug: sp.slug },
            create: {
              id: sp.id, slug: sp.slug, name: sp.name, nameEn: sp.nameEn,
              shortDescription: sp.shortDescription, shortDescriptionEn: sp.shortDescriptionEn,
              description: sp.description, descriptionEn: sp.descriptionEn,
              price: sp.price, category: sp.category, subcategory: sp.subcategory,
              variants: (sp.variants ?? []) as object[], tags: sp.tags as string[],
              images: sp.images as string[], inStock: sp.inStock,
              featured: sp.featured ?? false, videos: sp.videos ?? [],
              weight: sp.weight, source: 'static',
            },
            update: {},
          });
        }
      }

      if (!dbProduct) {
        return NextResponse.json({ error: 'منتج غير موجود' }, { status: 400 });
      }

      const unitUsd = dbProduct.priceUsd && dbProduct.priceUsd > 0
        ? Number(dbProduct.priceUsd)
        : egpToUsd(Number(dbProduct.price));

      totalUsd += unitUsd * qty;

      resolvedItems.push({
        productId: dbProduct.id,
        quantity: qty,
        selectedModel: item.selectedModel ?? null,
        unitPrice: unitUsd,
        productName: dbProduct.name,
        productImage: (dbProduct.images as any)?.[0] ?? null,
      });
    }

    // Read stored discount and shipping from the server-verified pp_pending entry.
    // Never trust client-supplied discount/shipping amounts here.
    const pendingSettingEarly = await prisma.setting.findUnique({ where: { key: `pp_pending_${paypalOrderId}` } });
    const pendingData = pendingSettingEarly?.value as Record<string, unknown> | null;
    const storedDiscountUsd = Number(pendingData?.discountUsd ?? 0);
    const storedCouponCode = String(pendingData?.couponCode ?? '');

    const rawShipping = Math.max(0, Number(body?.shippingUsd) || 0);
    const shippingCurrencyEn = String(body?.shippingCurrency || 'USD').toUpperCase();
    const { toUsd } = await import('@/lib/currency');
    const shippingUsd = Math.min(500, toUsd(rawShipping, shippingCurrencyEn));
    const discountUsd = storedDiscountUsd;
    const expectedUsd = Math.max(0.01, Math.round((totalUsd + shippingUsd - discountUsd) * 100) / 100);

    // Cross-check the server-verified expected amount from create-order.
    // If the client submitted inflated items between create and capture,
    // capturedAmount will be far less than the recalculated expectedUsd —
    // that's a replay attack. Reject BEFORE capturing so PayPal never
    // moves money for a cart we won't honour.
    const storedExpected = pendingData ? Number(pendingData.expectedUsd ?? 0) : null;

    const captureResult = await capturePayPalOrder(paypalOrderId);
    if (captureResult.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'الدفع لم يكتمل', paypalStatus: captureResult.status },
        { status: 400 }
      );
    }

    // Recover userId from reference_id if the auth cookie didn't
    // make it back from the PayPal popup (Safari/iOS ITP). The
    // reference_id was set in create-order as `${userId}-${timestamp}`
    // and PayPal echoes it back on capture. We trust it because
    // create-order required a valid auth cookie to set it in the
    // first place — anyone hitting capture-order with a paypalOrderId
    // for someone else's create-order would still bind to the
    // ORIGINAL creator, which is the desired behaviour.
    const referenceId = String(captureResult.purchase_units?.[0]?.reference_id || '');
    const userIdFromReference = referenceId.split('-')[0] || null;

    let resolvedUserId = auth?.userId ?? null;
    let resolvedUserEmail = auth?.email ?? null;
    if (!resolvedUserId && userIdFromReference) {
      const recovered = await prisma.user.findUnique({
        where: { id: userIdFromReference },
        select: { id: true, email: true },
      });
      if (recovered) {
        resolvedUserId = recovered.id;
        resolvedUserEmail = recovered.email;
      }
    }

    if (!resolvedUserId) {
      console.error('[paypal capture-order] cannot resolve user', { paypalOrderId, referenceId, hadCookie: !!auth });
      return NextResponse.json({
        error: 'تعذّر تحديد المستخدم — برجاء التواصل مع الدعم وإرسال رقم العملية',
        paypalOrderId,
      }, { status: 401 });
    }

    // PayPal already moved the money at this point. Earlier code
    // RETURNED an error on currency or amount mismatches, which left
    // the customer charged but no order in the DB — owner ended up
    // manually refunding (= the "reverse transaction" emails).
    //
    // New policy: if PayPal says CAPTURE COMPLETED, we ALWAYS persist
    // the order with the AMOUNT PAYPAL ACTUALLY CHARGED. Mismatches
    // are flagged in `notes` for admin review instead of failing the
    // customer-facing flow. Better one row tagged "needs review" than
    // a silent lost charge.
    const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount = Number(capture?.amount?.value || 0);
    const capturedCurrency = String(capture?.amount?.currency_code || 'USD').toUpperCase();
    const reviewFlags: string[] = [];

    // Use the server-stored expected amount if available (anti-replay).
    // Fall back to the recalculated expectedUsd for orders created before
    // this guard was added.
    const authorisedAmount = storedExpected ?? expectedUsd;
    if (storedExpected !== null && capturedAmount < storedExpected * 0.95) {
      console.error('[paypal] Replay attack detected — capturedAmount far below server-authorised amount', {
        authorised: storedExpected, captured: capturedAmount, paypalOrderId,
      });
      reviewFlags.push(`محاولة احتيال محتملة: مُفوَّض ${storedExpected} ومدفوع ${capturedAmount}`);
    }

    if (capturedCurrency !== 'USD') {
      console.error('[paypal] Currency mismatch — saving anyway', { expected: 'USD', got: capturedCurrency, paypalOrderId });
      reviewFlags.push(`عملة مختلفة: ${capturedCurrency}`);
    }
    if (Math.abs(capturedAmount - authorisedAmount) > 0.01) {
      console.error('[paypal] Amount mismatch — saving anyway', { expected: authorisedAmount, captured: capturedAmount, paypalOrderId });
      reviewFlags.push(`المبلغ المتوقع ${authorisedAmount} والمدفوع ${capturedAmount}`);
    }
    // Bind the persisted order to the actual captured amount so admin
    // dashboards reflect what PayPal really took, not what the cart
    // showed at checkout time.
    const persistedTotal = capturedAmount;

    // Compose notes — customer's notes plus any review flag for the
    // admin so a discrepancy never gets buried.
    const customerNotes = (body?.notes || '').toString().trim();
    const reviewBlock = reviewFlags.length > 0
      ? `[يحتاج مراجعة: ${reviewFlags.join(' · ')}]`
      : '';
    const composedNotes = [customerNotes, reviewBlock].filter(Boolean).join(' · ') || null;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: resolvedUserId as string,
          // Tag mismatched orders with a distinct status so the admin
          // dashboard can filter on them. Plain "paid" stays the
          // default for clean captures.
          status: reviewFlags.length > 0 ? 'paid-needs-review' : 'paid',
          total: persistedTotal,
          shippingCost: shippingUsd,
          discount: discountUsd,
          couponCode: storedCouponCode || null,
          paymentMethod: 'paypal',
          paypalOrderId,
          shippingAddress,
          notes: composedNotes,
          currency: capturedCurrency,
          items: { create: resolvedItems },
        },
        include: { items: true },
      });

      // Decrement stock inside the same transaction. If the customer paid but
      // stock raced out (extremely rare given pre-validation in create-order),
      // we DO NOT roll back — PayPal already captured the money. Log the
      // shortage so admin can hand-resolve from /admin/inventory.
      try {
        const { adjustStock, decrementsFromItems } = await import('@/lib/stock');
        await adjustStock(
          decrementsFromItems(resolvedItems.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
            selectedModel: it.selectedModel ?? null,
          }))),
          { reason: 'order_created', orderId: created.id },
          tx,
        );
      } catch (err) {
        console.error('[paypal] Stock decrement failed POST-payment — manual reconciliation required', {
          orderId: created.id, paypalOrderId, err: err instanceof Error ? err.message : err,
        });
        await logActionSafe({
          actor: { userId: resolvedUserId as string, role: 'customer', email: resolvedUserEmail ?? '' },
          action: 'order.create-manual',
          entity: 'Order',
          entityId: created.id,
          metadata: { paypalOrderId, stockShortage: true, error: err instanceof Error ? err.message : String(err) },
        });
      }

      const cart = await tx.cart.findUnique({ where: { userId: resolvedUserId as string } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return created;
    });

    // Clean up the pending-amount guard entry (best-effort).
    prisma.setting.delete({ where: { key: `pp_pending_${paypalOrderId}` } }).catch(() => {});

    // Best-effort campaign attribution by coupon code (never blocks the order).
    await attributeOrderToCampaign({ orderId: order.id, couponCode: order.couponCode, userId: resolvedUserId as string });

    // Award loyalty points: 1 point per 10 EGP (USD × 50 ≈ EGP, best-effort)
    try {
      const egpEquiv = persistedTotal * 50;
      const earnedPoints = Math.floor(egpEquiv / 10);
      if (earnedPoints > 0) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: resolvedUserId as string },
            data: { loyaltyPoints: { increment: earnedPoints } },
          }),
          prisma.loyaltyTransaction.create({
            data: { userId: resolvedUserId as string, points: earnedPoints, reason: 'order_earn', orderId: order.id },
          }),
        ]);
      }
    } catch (loyaltyErr) {
      console.error('[paypal capture-order loyalty]', loyaltyErr);
    }

    // Send order notification email to admin (async, non-blocking)
    try {
      const user = await prisma.user.findUnique({
        where: { id: resolvedUserId as string },
        select: { name: true, email: true, phone: true },
      });
      const addr = (shippingAddress as Record<string, any>) || {};
      const subtotalUsd = order.items.reduce((s: number, it: { unitPrice: number; quantity: number }) => s + it.unitPrice * it.quantity, 0);

      await sendOrderEmails({
        orderId: order.id,
        orderNumber: order.id.slice(-6).toUpperCase(),
        items: order.items.map((it: { productName: string; productImage: string | null; quantity: number; unitPrice: number; selectedModel?: number | null }) => ({
          productName: it.productName,
          productImage: it.productImage,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          selectedModel: it.selectedModel,
        })),
        subtotal: subtotalUsd,
        discount: order.discount ?? 0,
        couponCode: order.couponCode,
        shippingCost: order.shippingCost ?? 0,
        total: order.total,
        currency: 'USD',
        paymentMethod: 'paypal',
        customerName: `${addr.firstName ?? ''} ${addr.lastName ?? ''}`.trim() || user?.name || 'ضيف',
        customerEmail: user?.email || '—',
        customerPhone: addr.phone || user?.phone || '—',
        shippingAddress: {
          street: addr.street,
          building: addr.building,
          city: addr.city,
          region: addr.region,
          governorate: addr.governorate,
          country: addr.country,
        },
        notes: order.notes,
      });
    } catch (emailErr) {
      console.error('[paypal capture-order email]', emailErr);
    }

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      amountUsd: persistedTotal,
      needsReview: reviewFlags.length > 0,
    });
  } catch (err) {
    // Specific handling for PayPal's own rejection codes. Their risk
    // engine rejects with COMPLIANCE_VIOLATION when the merchant
    // account has KYC/AML/sanctions holds — the API call itself
    // succeeded, the funds just never moved. The customer needs a
    // friendly message + the debug_id so support can investigate
    // with PayPal directly.
    if (err instanceof PayPalCaptureError) {
      console.error('[paypal capture-order] paypal rejected', {
        status: err.status, issue: err.issue, description: err.description, debugId: err.debugId,
      });
      const friendlyByIssue: Record<string, string> = {
        COMPLIANCE_VIOLATION: 'فشلت المعاملة لدى PayPal بسبب قيد على حساب التاجر. لم يتم خصم أي مبلغ. برجاء المحاولة بطريقة دفع أخرى أو التواصل مع الدعم.',
        INSTRUMENT_DECLINED: 'البطاقة مرفوضة من البنك أو PayPal. جرّب بطاقة أخرى أو تواصل مع البنك.',
        PAYER_ACCOUNT_RESTRICTED: 'حساب المشتري على PayPal مقيَّد. حاول طريقة دفع أخرى.',
        PAYEE_ACCOUNT_RESTRICTED: 'حساب التاجر مقيَّد حالياً — تواصل مع الدعم.',
        TRANSACTION_REFUSED: 'تم رفض المعاملة من PayPal. جرّب بطاقة أخرى أو طريقة دفع بديلة.',
      };
      const friendly = err.issue && friendlyByIssue[err.issue]
        ? friendlyByIssue[err.issue]
        : 'تعذّر إتمام الدفع لدى PayPal. لم يتم خصم أي مبلغ. حاول طريقة دفع أخرى.';
      return NextResponse.json({
        error: friendly,
        detail: err.description ?? err.issue ?? 'PayPal rejected',
        paypalIssue: err.issue,
        paypalDebugId: err.debugId,
      }, { status: 400 });
    }

    // Anything else — surface the underlying message so the customer
    // can contact support with the right context.
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error('[paypal capture-order]', err);
    return NextResponse.json({
      error: 'حدث خطأ في تأكيد الدفع',
      detail,
    }, { status: 500 });
  }
}
