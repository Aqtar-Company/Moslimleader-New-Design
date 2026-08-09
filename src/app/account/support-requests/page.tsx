'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface SupportRequest {
  id: string;
  status: string;
  reason: string;
  note?: string;
  supportType?: string;
  mlSupportAmount?: number;
  customerPayAmount?: number;
  snapshotProductPrice: number;
  currency: string;
  createdAt: string;
  expiresAt?: string;
  product: { id: string; name: string; slug: string; images?: string[] };
  allocation?: { supportType: string; mlSupportAmount: number; customerPayAmount: number } | null;
  sponsoredCopy?: {
    id: string; code: string; status: string;
    shippingProvider?: string; trackingNumber?: string;
    deliveredAt?: string;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800' },
  UNDER_REVIEW: { label: 'جاري المراجعة', color: 'bg-blue-100 text-blue-800' },
  APPROVED: { label: 'موافق — في انتظار الاستخدام', color: 'bg-green-100 text-green-800' },
  COPY_ASSIGNED: { label: 'نسخة مخصصة لك', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'لم تتم الموافقة', color: 'bg-red-100 text-red-800' },
  EXPIRED: { label: 'انتهت الصلاحية', color: 'bg-gray-100 text-gray-600' },
  CANCELLED: { label: 'ملغى', color: 'bg-gray-100 text-gray-500' },
  USED: { label: 'تم الاستخدام', color: 'bg-green-100 text-green-800' },
};

const COPY_STATUS: Record<string, string> = {
  ASSIGNED: 'مخصصة لك', IN_PREPARATION: 'قيد التجهيز',
  READY_TO_SHIP: 'جاهزة للشحن', SHIPPED: 'في الطريق إليك',
  DELIVERED: 'وصلت', CONFIRMED: 'مؤكدة',
};

const REASON_LABELS: Record<string, string> = {
  financial_hardship: 'ضائقة مالية مؤقتة',
  low_income: 'محدودية الدخل',
  large_family: 'أسرة كبيرة',
  student: 'طالب / طالبة',
  other: 'أخرى',
};

function ThankYouForm({ copyId, currentStatus, onDone }: { copyId: string; currentStatus: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const alreadyConfirmed = currentStatus === 'CONFIRMED' || currentStatus === 'COMPLETED';

  const handleSubmit = async () => {
    setSending(true); setError('');
    const res = await fetch('/api/beneficiary/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copyId, message: message.trim() || undefined }),
    });
    if (res.ok) {
      setSent(true);
      onDone();
    } else {
      const d = await res.json();
      setError(d.error ?? 'حدث خطأ');
    }
    setSending(false);
  };

  if (sent) return (
    <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
      ✓ شكراً — تم إرسال رسالتك وستُراجع قبل وصولها للداعم.
    </div>
  );

  return (
    <div className="mt-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          {alreadyConfirmed ? 'إرسال رسالة شكر للداعم' : 'تأكيد الاستلام وإرسال رسالة شكر'}
        </button>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-amber-900">
            {alreadyConfirmed ? 'رسالة شكر للداعم (اختياري)' : 'تأكيد استلام النسخة'}
          </p>
          <p className="text-xs text-amber-700">
            رسالتك ستُراجع من فريقنا أولاً قبل أن يراها الداعم. هويتك تبقى مجهولة تماماً.
          </p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="مثال: الحمد لله وصلني الكتاب، جزاك الله خيراً..."
            className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white resize-none"
          />
          <p className="text-xs text-gray-400 text-left">{message.length}/1000</p>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={sending}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg font-medium disabled:opacity-50"
            >
              {sending ? '...' : alreadyConfirmed ? 'إرسال' : 'تأكيد الاستلام وإرسال'}
            </button>
            <button onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-gray-600">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountSupportRequestsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/auth/login?redirect=/account/support-requests'); }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/support-requests').then(r => r.json()).then(d => {
      setRequests(d.requests ?? []);
      setLoading(false);
    });
  }, [user]);

  const cancel = async (id: string) => {
    const res = await fetch(`/api/support-requests/${id}`, { method: 'DELETE' });
    if (res.ok) { setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'CANCELLED' } : r)); }
  };

  if (authLoading || loading) return <div className="p-12 text-center text-gray-400">جاري التحميل...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">طلبات دعم السعر</h1>

      {requests.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 text-sm">لا توجد طلبات دعم بعد</p>
          <a href="/shop" className="inline-block mt-4 text-sm text-blue-600 hover:underline">تصفح المنتجات</a>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => {
            const statusInfo = STATUS_LABELS[req.status] ?? { label: req.status, color: 'bg-gray-100 text-gray-600' };
            const img = req.product.images?.[0];
            return (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={req.product.name} className="w-16 h-16 rounded-xl object-cover border border-gray-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <a href={`/shop/${req.product.slug}`} className="font-semibold text-gray-900 hover:text-blue-700 text-sm leading-tight">
                          {req.product.name}
                        </a>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {REASON_LABELS[req.reason] ?? req.reason} · {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                      </p>

                      {/* ML support details */}
                      {req.allocation && (
                        <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                          <p className="font-medium text-green-800">تمت الموافقة على الدعم</p>
                          <div className="flex items-center justify-between mt-1 text-xs text-green-700">
                            <span>السعر بعد الدعم</span>
                            <span className="font-bold">
                              {req.allocation.customerPayAmount.toLocaleString('ar-EG')} {req.currency === 'EGP' ? 'ج.م' : req.currency}
                            </span>
                          </div>
                          {req.expiresAt && (
                            <p className="text-xs text-green-600 mt-1">
                              صالح حتى: {new Date(req.expiresAt).toLocaleDateString('ar-EG')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Sponsored copy tracking */}
                      {req.sponsoredCopy && (
                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-blue-800 font-medium">نسخة مدعومة</span>
                            <span className="text-xs font-mono text-blue-600">{req.sponsoredCopy.code}</span>
                          </div>
                          <p className="text-xs text-blue-700 mt-1">
                            {COPY_STATUS[req.sponsoredCopy.status] ?? req.sponsoredCopy.status}
                          </p>
                          {req.sponsoredCopy.trackingNumber && (
                            <p className="text-xs text-blue-600 mt-1">
                              رقم التتبع: <span className="font-mono">{req.sponsoredCopy.trackingNumber}</span>
                              {req.sponsoredCopy.shippingProvider && ` (${req.sponsoredCopy.shippingProvider})`}
                            </p>
                          )}
                          {/* Thank-you form — show when delivered or already confirmed */}
                          {['DELIVERED', 'CONFIRMED', 'COMPLETED'].includes(req.sponsoredCopy.status) && (
                            <ThankYouForm
                              copyId={req.sponsoredCopy.id}
                              currentStatus={req.sponsoredCopy.status}
                              onDone={() => {
                                setRequests(prev => prev.map(r =>
                                  r.id === req.id && r.sponsoredCopy
                                    ? { ...r, sponsoredCopy: { ...r.sponsoredCopy!, status: 'CONFIRMED' } }
                                    : r
                                ));
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {req.status === 'PENDING' && (
                  <div className="px-5 pb-4">
                    <button onClick={() => cancel(req.id)}
                      className="text-xs text-red-500 hover:text-red-700">
                      إلغاء الطلب
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
