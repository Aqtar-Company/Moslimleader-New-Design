'use client';

import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useAuth } from '@/context/AuthContext';

interface Props {
  productId: string;
  productName: string;
  productPrice: number;
  currency: string;
}

type Stage = 'form' | 'payment' | 'done';

export function SponsorCopySection({ productId, productName, productPrice, currency }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [stage, setStage] = useState<Stage>('form');
  const [sponsoredOrderId, setSponsoredOrderId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const total = quantity * productPrice;
  // USD equivalent is only meaningful when the local price is in EGP (≈50 EGP per USD).
  // For non-EGP currencies the parent already passes the local-currency price — no conversion needed.
  const totalUsd = currency === 'EGP' ? parseFloat((total / 50).toFixed(2)) : null;
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '';

  const handleCreateOrder = async () => {
    if (!user) {
      window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }
    setLoading(true); setError('');
    const res = await fetch('/api/sponsored-purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        quantity,
        policyAgreed: true,
        localCurrency: currency,
        localPricePerCopy: productPrice,
        localTotalPaid: total,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      setSponsoredOrderId(d.sponsoredOrder?.id ?? '');
      setStage('payment');
    } else {
      setError(d.error ?? 'حدث خطأ');
    }
    setLoading(false);
  };

  const createPayPalOrder = async () => {
    const res = await fetch('/api/sponsored-purchases/paypal-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sponsoredOrderId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء طلب الدفع');
    return data.paypalOrderId as string;
  };

  const capturePayPalOrder = async (paypalOrderId: string) => {
    setProcessing(true);
    try {
      const res = await fetch('/api/sponsored-purchases/paypal-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paypalOrderId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'فشل تأكيد الدفع');
      setOrderId(sponsoredOrderId);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تأكيد الدفع');
    } finally {
      setProcessing(false);
    }
  };

  // ── Stage: done ──────────────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <div className="border border-blue-200 rounded-2xl p-5 bg-blue-50" dir="rtl">
        <div className="text-center">
          <div className="text-4xl mb-2">🎁</div>
          <h3 className="font-bold text-gray-900 text-lg mb-1">شكراً لك!</h3>
          <p className="text-sm text-gray-600 mb-4">
            تم استلام دفعتك وإنشاء النسخ المدعومة. سيتم تخصيصها لمستفيد قريباً.
          </p>
          <p className="text-xs text-gray-400">رقم الطلب: {orderId.slice(-8).toUpperCase()}</p>
        </div>
      </div>
    );
  }

  // ── Stage: payment ───────────────────────────────────────────────────────────
  if (stage === 'payment') {
    return (
      <div className="border border-blue-200 rounded-2xl p-5 bg-blue-50/50 space-y-4" dir="rtl">
        <div className="text-center">
          <div className="text-3xl mb-1">💳</div>
          <h3 className="font-bold text-gray-900 text-base">أتمّ الدفع</h3>
          <p className="text-xs text-gray-500 mt-1">
            {quantity} نسخة من <strong>{productName}</strong>
            {' — '}
            <span className="font-bold">{total.toLocaleString('ar-EG')} {currency === 'EGP' ? 'ج.م' : currency}</span>
            {totalUsd !== null && <>{' ≈ '}<span className="font-bold">${totalUsd} USD</span></>}
          </p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

        {processing && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            جاري تأكيد الدفع...
          </div>
        )}

        {clientId && (
          <PayPalScriptProvider
            options={{ clientId, currency: 'USD', intent: 'capture', components: 'buttons', disableFunding: 'paylater,venmo' }}
          >
            <PayPalButtons
              fundingSource="card"
              style={{ layout: 'vertical', shape: 'rect', label: 'pay', color: 'black', height: 48 }}
              disabled={processing}
              createOrder={createPayPalOrder}
              onApprove={(data) => capturePayPalOrder(data.orderID)}
              onCancel={() => setError('تم إلغاء الدفع')}
              onError={() => setError('حدث خطأ في الدفع بالبطاقة')}
            />
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">أو</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <PayPalButtons
              fundingSource="paypal"
              style={{ layout: 'vertical', shape: 'rect', label: 'paypal', color: 'gold', height: 48 }}
              disabled={processing}
              createOrder={createPayPalOrder}
              onApprove={(data) => capturePayPalOrder(data.orderID)}
              onCancel={() => setError('تم إلغاء الدفع')}
              onError={() => setError('حدث خطأ في PayPal')}
            />
          </PayPalScriptProvider>
        )}

        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
          <p className="text-sm font-semibold text-gray-700">أو تحويل بنكي / محفظة</p>
          <p className="text-xs text-gray-500">تواصل معنا عبر واتساب بعد التحويل وأرسل إيصال الدفع ورقم الطلب:</p>
          <p className="text-xs font-mono text-gray-700 bg-gray-50 rounded-lg px-3 py-2 select-all">{sponsoredOrderId.slice(-8).toUpperCase()}</p>
        </div>

        <button onClick={() => { setStage('form'); setError(''); }}
          className="w-full text-xs text-gray-400 hover:text-gray-600 transition">
          ← رجوع
        </button>
      </div>
    );
  }

  // ── Stage: form ──────────────────────────────────────────────────────────────
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden" dir="rtl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎁</span>
          <div className="text-right">
            <div className="font-medium text-gray-800 text-sm">أريد أن أتبرع بنسخ لمن يحتاجها</div>
            <div className="text-xs text-gray-400">ادعم شخصاً آخر بشراء نسخة من هذا المنتج</div>
          </div>
        </div>
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-5 space-y-4 bg-gray-50/50">
          <p className="text-sm text-gray-600">
            ستتكفّل بنسخة كاملة من <strong>{productName}</strong> لمستفيد طلب الدعم، وسنؤكد لك وصولها إليه. 💙
          </p>

          {currency !== 'EGP' && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                وإذا وُجد فرق ناتج عن العملة، يُوجَّه كاملًا لدعم المتعففين، ولا تحقق المنصة منه أي ربح.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">عدد النسخ</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400">
                −
              </button>
              <span className="text-lg font-bold w-8 text-center">{quantity}</span>
              <button onClick={() => setQuantity(q => Math.min(20, q + 1))}
                className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400">
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">الإجمالي:</span>
            <span className="font-bold text-gray-900">
              {total.toLocaleString('ar-EG')} {currency === 'EGP' ? 'ج.م' : currency}
              {totalUsd !== null && <><span className="text-gray-400">{' ≈ '}</span><span className="text-gray-500">${totalUsd} USD</span></>}
            </span>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

          <button
            onClick={handleCreateOrder}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جاري الإعداد...' : user ? `تبرع بـ ${quantity} نسخة ← اختر طريقة الدفع` : 'سجل الدخول للمتابعة'}
          </button>
        </div>
      )}
    </div>
  );
}
