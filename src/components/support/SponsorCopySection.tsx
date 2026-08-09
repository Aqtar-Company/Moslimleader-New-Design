'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface Props {
  productId: string;
  productName: string;
  productPrice: number;
  currency: string;
}

export function SponsorCopySection({ productId, productName, productPrice, currency }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderCreated, setOrderCreated] = useState<{ orderId: string; total: number } | null>(null);

  const total = quantity * productPrice;

  const handleSponsor = async () => {
    if (!user) {
      window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }
    setLoading(true); setError('');
    const res = await fetch('/api/sponsored-purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity }),
    });
    if (res.ok) {
      const d = await res.json();
      setOrderCreated({ orderId: d.orderId, total: d.totalPaid });
    } else {
      const d = await res.json();
      setError(d.error ?? 'حدث خطأ');
    }
    setLoading(false);
  };

  if (orderCreated) {
    return (
      <div className="border border-blue-200 rounded-2xl p-5 bg-blue-50" dir="rtl">
        <div className="text-center">
          <div className="text-4xl mb-2">🎁</div>
          <h3 className="font-bold text-gray-900 text-lg mb-1">شكراً لك!</h3>
          <p className="text-sm text-gray-600 mb-4">
            تم إنشاء طلب شراء النسخ المدعومة. سيتواصل معك فريقنا لإتمام الدفع.
          </p>
          <p className="text-xs text-gray-400">رقم الطلب: {orderCreated.orderId.slice(-8).toUpperCase()}</p>
        </div>
      </div>
    );
  }

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
            ستشتري نسخة كاملة من <strong>{productName}</strong> ونوصلها لمستفيد يطلب الدعم.
            لن تعرف هويته ولن يعرف هويتك — لكنك ستعرف أنها وصلت.
          </p>

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
            </span>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

          <button
            onClick={handleSponsor}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جاري الإرسال...' : user ? `تبرع بـ ${quantity} نسخة` : 'سجل الدخول للمتابعة'}
          </button>
          <p className="text-xs text-gray-400 text-center">سيتواصل معك فريقنا لإتمام الدفع عبر PayPal أو تحويل بنكي</p>
        </div>
      )}
    </div>
  );
}
