'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'متاحة', RESERVED: 'محجوزة', ASSIGNED: 'مخصصة',
  IN_PREPARATION: 'قيد التجهيز', READY_TO_SHIP: 'جاهزة للشحن',
  SHIPPED: 'مشحونة', DELIVERED: 'وصلت', CONFIRMED: 'مؤكدة',
  COMPLETED: 'مكتملة', CANCELLED: 'ملغاة', REFUNDED: 'مستردة',
};

const COPY_EVENTS: Record<string, string> = {
  COPY_CREATED: 'تم الشراء', COPY_AVAILABLE: 'متاحة', COPY_ASSIGNED: 'تم تخصيص مستفيد',
  PREPARATION_STARTED: 'بدأ التجهيز', SHIPPED: 'تم الشحن', DELIVERED: 'تم التسليم',
  BENEFICIARY_CONFIRMED: 'المستفيد أكد الاستلام', MESSAGE_RECEIVED: 'رسالة شكر',
  PHOTO_RECEIVED: 'صورة استلام', COMPLETED: 'اكتملت الرحلة', REFUNDED: 'استرداد',
};

interface CopyData {
  id: string; code: string; status: string; currency: string;
  originalPrice: number; paidPrice: number;
  shippingProvider?: string; shipmentId?: string; trackingNumber?: string;
  purchasedAt: string; assignedAt?: string; shippedAt?: string;
  deliveredAt?: string; beneficiaryConfirmedAt?: string; completedAt?: string;
  product: { id: string; name: string; price: number };
  sponsor: { id: string; name: string; organization?: string; email?: string; phone?: string };
  beneficiaryUser?: { id: string; name: string; email: string; phone?: string } | null;
  supportRequest?: { id: string; status: string; reason: string } | null;
  events: { id: string; event: string; createdAt: string; metadata?: unknown }[];
  impactMessages: { id: string; message: string; status: string; createdAt: string }[];
  impactMedia: { id: string; mediaUrl: string; status: string; createdAt: string }[];
}

export default function AdminSponsoredCopyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [copy, setCopy] = useState<CopyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const [shippingForm, setShippingForm] = useState({ provider: '', shipmentId: '', trackingNumber: '' });
  const [showShipForm, setShowShipForm] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '', paymentRef: '' });
  const [showRefundForm, setShowRefundForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/sponsored-copies/${id}`);
    if (res.ok) { const d = await res.json(); setCopy(d.copy); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const action = async (payload: Record<string, unknown>) => {
    setWorking(true); setError('');
    const res = await fetch(`/api/admin/sponsored-copies/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { await load(); }
    else { const d = await res.json(); setError(d.error ?? 'خطأ'); }
    setWorking(false);
  };

  const fmt = (n: number) => n.toLocaleString('ar-EG') + ' ج.م';

  if (loading) return <div className="p-12 text-center text-gray-400">جاري التحميل...</div>;
  if (!copy) return <div className="p-12 text-center text-red-500">لم تُعثر على النسخة</div>;

  const s = copy.status;
  const canStartPrep = s === 'ASSIGNED';
  const canShip = ['IN_PREPARATION', 'READY_TO_SHIP'].includes(s);
  const canDeliver = s === 'SHIPPED';
  const canComplete = ['DELIVERED', 'CONFIRMED'].includes(s);
  const canRefund = ['AVAILABLE', 'RESERVED', 'ASSIGNED'].includes(s);

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin/sponsored-copies" className="text-gray-400 text-sm hover:text-gray-700">← رجوع</a>
        <h1 className="text-xl font-bold font-mono text-gray-900">{copy.code}</h1>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
          {STATUS_LABELS[copy.status] ?? copy.status}
        </span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Copy info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">المنتج:</span> <span className="font-medium">{copy.product.name}</span></div>
            <div><span className="text-gray-500">سعر الشراء:</span> <span className="font-medium">{fmt(copy.paidPrice)}</span></div>
            <div><span className="text-gray-500">الداعم:</span> <span>{copy.sponsor.name}{copy.sponsor.organization && ` (${copy.sponsor.organization})`}</span></div>
            <div><span className="text-gray-500">المستفيد:</span> <span>{copy.beneficiaryUser?.name ?? '—'}</span></div>
            {copy.trackingNumber && (
              <div className="col-span-2"><span className="text-gray-500">تتبع الشحن:</span> <span className="font-mono">{copy.trackingNumber}</span> ({copy.shippingProvider})</div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">رحلة النسخة</h2>
            <div className="space-y-3">
              {copy.events.map(ev => (
                <div key={ev.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                  <div>
                    <span className="text-sm font-medium text-gray-800">{COPY_EVENTS[ev.event] ?? ev.event}</span>
                    <span className="text-xs text-gray-400 mr-2">
                      {new Date(ev.createdAt).toLocaleString('ar-EG')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-800 mb-3">إجراءات</h2>

            {canStartPrep && (
              <button onClick={() => action({ action: 'start_preparation' })} disabled={working}
                className="w-full bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
                بدء التجهيز
              </button>
            )}

            {canShip && !showShipForm && (
              <button onClick={() => setShowShipForm(true)}
                className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm hover:bg-purple-700">
                تسجيل الشحن
              </button>
            )}

            {showShipForm && (
              <div className="border border-purple-100 rounded-xl p-4 space-y-3 bg-purple-50/40">
                <h3 className="text-sm font-medium text-purple-900">بيانات الشحن</h3>
                {(['provider', 'shipmentId', 'trackingNumber'] as const).map(field => (
                  <div key={field}>
                    <label className="text-xs text-gray-500 block mb-1">
                      {field === 'provider' ? 'شركة الشحن' : field === 'shipmentId' ? 'رقم الشحنة' : 'رقم التتبع'}
                    </label>
                    <input value={shippingForm[field]}
                      onChange={e => setShippingForm(prev => ({ ...prev, [field]: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={() => action({ action: 'mark_shipped', ...shippingForm })}
                    disabled={working || !shippingForm.provider}
                    className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
                    {working ? '...' : 'تأكيد الشحن'}
                  </button>
                  <button onClick={() => setShowShipForm(false)} className="text-sm text-gray-500">إلغاء</button>
                </div>
              </div>
            )}

            {canDeliver && (
              <button onClick={() => action({ action: 'mark_delivered' })} disabled={working}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                تأكيد الوصول (من شركة الشحن)
              </button>
            )}

            {canComplete && (
              <button onClick={() => action({ action: 'complete' })} disabled={working}
                className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm hover:bg-gray-900 disabled:opacity-50">
                إنهاء رحلة النسخة
              </button>
            )}

            {canRefund && !showRefundForm && (
              <button onClick={() => setShowRefundForm(true)}
                className="w-full border border-red-200 text-red-600 py-2 rounded-lg text-sm hover:bg-red-50">
                استرداد النسخة
              </button>
            )}

            {showRefundForm && (
              <div className="border border-red-100 rounded-xl p-4 space-y-3 bg-red-50/40">
                <h3 className="text-sm font-medium text-red-900">استرداد النسخة</h3>
                {([['amount', 'مبلغ الاسترداد (ج.م)'], ['reason', 'سبب الاسترداد'], ['paymentRef', 'مرجع الدفع']] as const).map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs text-gray-500 block mb-1">{label}</label>
                    <input value={refundForm[field]}
                      onChange={e => setRefundForm(prev => ({ ...prev, [field]: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={() => action({ action: 'refund', amount: Number(refundForm.amount), reason: refundForm.reason, paymentRef: refundForm.paymentRef })}
                    disabled={working || !refundForm.reason}
                    className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50">
                    {working ? '...' : 'تأكيد الاسترداد'}
                  </button>
                  <button onClick={() => setShowRefundForm(false)} className="text-sm text-gray-500">إلغاء</button>
                </div>
              </div>
            )}
          </div>

          {/* Impact content */}
          {(copy.impactMessages.length > 0 || copy.impactMedia.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">محتوى الأثر</h2>
              {copy.impactMessages.map(m => (
                <div key={m.id} className={`p-3 rounded-lg mb-2 text-sm ${m.status === 'APPROVED' ? 'bg-green-50 border border-green-100' : m.status === 'REJECTED' ? 'bg-red-50 border border-red-100' : 'bg-yellow-50 border border-yellow-100'}`}>
                  <p className="italic text-gray-700">&ldquo;{m.message}&rdquo;</p>
                  <span className="text-xs text-gray-400">{m.status === 'APPROVED' ? 'موافق عليه' : m.status === 'REJECTED' ? 'مرفوض' : 'قيد المراجعة'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">معلومات الداعم</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500">الاسم</dt><dd className="font-medium">{copy.sponsor.name}</dd></div>
              {copy.sponsor.organization && <div><dt className="text-gray-500">الجهة</dt><dd>{copy.sponsor.organization}</dd></div>}
              {copy.sponsor.email && <div><dt className="text-gray-500">الإيميل</dt><dd>{copy.sponsor.email}</dd></div>}
              {copy.sponsor.phone && <div><dt className="text-gray-500">الهاتف</dt><dd>{copy.sponsor.phone}</dd></div>}
            </dl>
            <a href={`/admin/sponsors/${copy.sponsor.id}`} className="text-xs text-blue-600 underline mt-2 block">عرض الداعم</a>
          </div>

          {copy.beneficiaryUser && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">المستفيد</h2>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-gray-500">الاسم</dt><dd className="font-medium">{copy.beneficiaryUser.name}</dd></div>
                <div><dt className="text-gray-500">الإيميل</dt><dd>{copy.beneficiaryUser.email}</dd></div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
