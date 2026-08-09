'use client';

import { useState } from 'react';

interface Props {
  productId: string;
  productName: string;
  productPrice: number;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

const REASONS = [
  { value: 'financial_hardship', label: 'ضائقة مالية مؤقتة' },
  { value: 'low_income', label: 'محدودية الدخل' },
  { value: 'large_family', label: 'أسرة كبيرة' },
  { value: 'student', label: 'طالب / طالبة' },
  { value: 'other', label: 'أخرى' },
];

export function SupportRequestModal({ productId, productName, productPrice, currency, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason) { setError('اختر سبب الطلب'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/support-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, reason, note: note.trim() || undefined }),
    });
    if (res.ok) {
      onSuccess();
    } else {
      const d = await res.json();
      setError(d.error ?? 'حدث خطأ، حاول مجدداً');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">طلب دعم السعر</h2>
          <p className="text-sm text-gray-500 mt-0.5">{productName}</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Dignity notice */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">نظام دعم السعر</p>
            <p className="text-xs text-blue-600">
              نؤمن أن كل شخص يستحق الوصول لمحتوى تربوي جيد. طلبك يُراجع بسرية تامة.
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">سبب الطلب *</label>
            <div className="space-y-2">
              {REASONS.map(r => (
                <label key={r.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${reason === r.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value}
                    onChange={() => setReason(r.value)} className="text-blue-600" />
                  <span className="text-sm text-gray-700">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ملاحظة إضافية <span className="text-gray-400 font-normal">(اختياري)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="يمكنك إضافة أي تفاصيل تساعد في تقييم طلبك..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-400"
            />
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button
            onClick={submit}
            disabled={loading || !reason}
            className="flex-1 bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال الطلب'}
          </button>
          <button onClick={onClose} className="px-4 py-3 text-sm text-gray-500 hover:text-gray-700">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
