export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { capturePayPalOrder, PayPalCaptureError } from '@/lib/paypal';
import { checkRateLimit } from '@/lib/rate-limit';

const PRICE_EGY_EGP_DEFAULT  = 100;
const PRICE_INTL_USD_DEFAULT  = 5.00;

async function getPricesForAudit(): Promise<{ egyEgp: number; intlUsd: number }> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['membership-price-egy-egp', 'membership-price-intl-usd'] } },
  });
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
  return {
    egyEgp:  parseFloat(map['membership-price-egy-egp']  ?? '') || PRICE_EGY_EGP_DEFAULT,
    intlUsd: parseFloat(map['membership-price-intl-usd'] ?? '') || PRICE_INTL_USD_DEFAULT,
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser().catch(() => null);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = checkRateLimit(`membership-renew-capture:${user.userId}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

    const { paypalOrderId, zone } = await req.json().catch(() => ({}));
    if (!paypalOrderId || typeof paypalOrderId !== 'string') {
      return NextResponse.json({ error: 'Missing paypalOrderId' }, { status: 400 });
    }

    const membership = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });
    if (!membership) return NextResponse.json({ error: 'No membership found' }, { status: 404 });

    if (membership.paypalOrderId !== paypalOrderId) {
      return NextResponse.json({ error: 'Order ID mismatch' }, { status: 403 });
    }

    let captureResult: Record<string, unknown>;
    try {
      captureResult = await capturePayPalOrder(paypalOrderId) as Record<string, unknown>;
    } catch (err) {
      console.error('[renew-capture] PayPal capture failed', err);
      if (err instanceof PayPalCaptureError) {
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
      return NextResponse.json({ error: 'فشل تأكيد الدفع مع PayPal' }, { status: 400 });
    }

    if (captureResult.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'الدفع لم يكتمل', paypalStatus: captureResult.status }, { status: 400 });
    }

    const base = membership.expiresAt && membership.expiresAt > new Date() ? membership.expiresAt : new Date();
    const newExpiry = new Date(base);
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);

    const prices = await getPricesForAudit();
    const amountEgp = zone === 'egypt' ? prices.egyEgp : prices.intlUsd * 50;

    const updated = await prisma.familyMembership.updateMany({
      where: { ownerUserId: user.userId, paypalOrderId },
      data: { status: 'ACTIVE', expiresAt: newExpiry },
    });
    if (updated.count === 0) return NextResponse.json({ error: 'Already processed' }, { status: 409 });

    await prisma.membershipRenewal.create({
      data: { membershipId: membership.id, paypalOrderId, amountEgp, expiresAt: newExpiry },
    });

    return NextResponse.json({ ok: true, expiresAt: newExpiry.toISOString() });
  } catch (err) {
    console.error('[renew-capture] unexpected error', err);
    return NextResponse.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 });
  }
}
