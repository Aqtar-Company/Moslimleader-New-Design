'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'معلق', UNDER_REVIEW: 'قيد المراجعة', APPROVED: 'موافق',
  REJECTED: 'مرفوض', MATCHED_WITH_SPONSORED_COPY: 'تم تخصيص نسخة',
  USED: 'مستخدم', EXPIRED: 'منتهي', CANCELLED: 'ملغي',
};

const REASON_LABELS: Record<string, string> = {
  student: 'طالب', multiple_children: 'أكثر من طفل',
  temp_financial: 'ظرف مالي مؤقت', price_barrier: 'السعر يمثل عائقًا', other: 'أخرى',
};

interface RequestData {
  id: string; customerName: string; customerPhone?: string; customerEmail: string;
  country: string; reason: string; note?: string; status: string; supportType?: string;
  snapshotProductPrice: number; snapshotEligiblePrice: number; snapshotShipping: number;
  mlSupportAmount?: number; mlSupportPercent?: number; customerPayAmount?: number;
  currency: string; approvedAt?: string; expiresAt?: string; rejectionReason?: string;
  product: { id: string; name: string; price: number };
  mlAllocation?: { supportAmount: number; customerPayAmount: number; status: string } | null;
  assignedCopy?: { id: string; code: string; status: string } | null;
}

interface History {
  totalOrders: number; totalOrderValue: number;
  supportRequestsTotal: number; supportRequestsApproved: number;
  supportRequestsUsed: number; totalMLSupportReceived: number;
  sponsoredCopiesReceived: number; lastSupportDate: string | null; unusedApprovals: number;
}

interface AvailableCopy {
  id: string; code: string; status: string;
  sponsor: { id: string; name: string; organization?: string };
}

export default function AdminSupportRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [request, setRequest] = useState<RequestData | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [availableCopies, setAvailableCopies] = useState<AvailableCopy[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  // ML approval form
  const [mlMode, setMlMode] = useState<'percent' | 'fixed' | 'final'>('percent');
  const [mlPercent, setMlPercent] = useState('50');
  const [mlAmount, setMlAmount] = useState('');
  const [mlCustomerPays, setMlCustomerPays] = useState('');

  // Rejection
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/support-requests/${id}`);
    if (res.ok) {
      const data = await res.json();
      setRequest(data.request);
      setHistory(data.history);
      setAvailableCopies(data.availableCopies);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const fmt = (n: number) => n.toLocaleString('ar-EG') + ' ج.م';

  const approveML = async () => {
    setWorking(true); setError('');
    const body: Record<string, unknown> = { mode: mlMode };
    if (mlMode === 'percent') body.percent = Number(mlPercent);
    else if (mlMode === 'fixed') body.amount = Number(mlAmount);
    else body.customerPays = Number(mlCustomerPays);

    const res = await fetch(`/api/admin/support-requests/${id}/approve-ml`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) { await load(); } else { const d = await res.json(); setError(d.error); }
    setWorking(false);
  };

  const assignCopy = async (copyId: string) => {
    setWorking(true); setError('');
    const res = await fetch(`/api/admin/support-requests/${id}/assign-copy`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ copyId }),
    });
    if (res.ok) { await load(); } else { const d = await res.json(); setError(d.error); }
    setWorking(false);
  };

  const reject = async () => {
    if (!rejectReason.trim()) return;
    setWorking(true); setError('');
    const res = await fetch(`/api/admin/support-requests/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (res.ok) { await load(); setShowRejectForm(false); }
    else { const d = await res.json(); setError(d.error); }
    setWorking(false);
  };

  if (loading) return <div className="p-12 text-center text-gray-400">جاري التحميل...</div>;
  if (!request) return <div className="p-12 text-center text-red-500">لم يُعثر على الطلب</div>;

  const canDecide = ['PENDING', 'UNDER_REVIEW'].includes(request.status);

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-sm">→ رجوع</button>
        <h1 className="text-xl font-bold text-gray-900">طلب دعم السعر — {request.customerName}</h1>
        <span className={`px-2 py-1 rounded text-xs font-medium ${request.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : request.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABELS[request.status] ?? request.status}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Request details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">تفاصيل الطلب</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">المنتج:</span> <span className="font-medium">{request.product.name}</span></div>
              <div><span className="text-gray-500">سعر المنتج:</span> <span className="font-medium">{fmt(request.snapshotProductPrice)}</span></div>
              <div><span className="text-gray-500">السعر المؤهل:</span> <span className="font-medium">{fmt(request.snapshotEligiblePrice)}</span></div>
              <div><span className="text-gray-500">السبب:</span> <span>{REASON_LABELS[request.reason] ?? request.reason}</span></div>
              <div className="col-span-2">
                <span className="text-gray-500">ملاحظة:</span>{' '}
                <span className="italic text-gray-600">{request.note || '—'}</span>
              </div>
            </div>
          </div>

          {/* Customer info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">بيانات العميل</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">الاسم:</span> <span>{request.customerName}</span></div>
              <div><span className="text-gray-500">الهاتف:</span> <span>{request.customerPhone ?? '—'}</span></div>
              <div><span className="text-gray-500">الإيميل:</span> <span>{request.customerEmail}</span></div>
              <div><span className="text-gray-500">الدولة:</span> <span>{request.country}</span></div>
            </div>
          </div>

          {/* Decision panel */}
          {canDecide && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
              <h2 className="font-semibold text-gray-800">القرار</h2>

              {/* Track A: ML Support */}
              <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4">
                <h3 className="font-medium text-blue-900 mb-3">أ — دعم ML للسعر</h3>
                <div className="flex gap-2 mb-3">
                  {(['percent', 'fixed', 'final'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMlMode(m)}
                      className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${mlMode === m ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                    >
                      {m === 'percent' ? 'نسبة %' : m === 'fixed' ? 'مبلغ ثابت' : 'سعر نهائي للعميل'}
                    </button>
                  ))}
                </div>

                {mlMode === 'percent' && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600">نسبة الدعم:</label>
                    <select
                      value={mlPercent}
                      onChange={e => setMlPercent(e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-sm"
                    >
                      {['10','20','30','50','75','100'].map(p => <option key={p} value={p}>{p}%</option>)}
                    </select>
                    <span className="text-xs text-gray-400">
                      → العميل يدفع {fmt(request.snapshotEligiblePrice * (1 - Number(mlPercent) / 100))}
                    </span>
                  </div>
                )}

                {mlMode === 'fixed' && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600">مبلغ الدعم:</label>
                    <input
                      type="number" value={mlAmount}
                      onChange={e => setMlAmount(e.target.value)}
                      placeholder="0"
                      className="border border-gray-200 rounded px-2 py-1 text-sm w-24"
                    />
                    <span className="text-xs text-gray-400">ج.م</span>
                  </div>
                )}

                {mlMode === 'final' && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600">العميل يدفع:</label>
                    <input
                      type="number" value={mlCustomerPays}
                      onChange={e => setMlCustomerPays(e.target.value)}
                      placeholder="0"
                      className="border border-gray-200 rounded px-2 py-1 text-sm w-24"
                    />
                    <span className="text-xs text-gray-400">ج.م</span>
                  </div>
                )}

                <button
                  onClick={approveML}
                  disabled={working}
                  className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {working ? '...' : 'الموافقة على دعم ML'}
                </button>
              </div>

              {/* Track B: Sponsored Copy */}
              {availableCopies.length > 0 && (
                <div className="border border-purple-100 bg-purple-50/50 rounded-xl p-4">
                  <h3 className="font-medium text-purple-900 mb-3">ب — تخصيص نسخة مدعومة</h3>
                  <p className="text-xs text-gray-500 mb-3">نسخ متاحة لهذا المنتج: {availableCopies.length}</p>
                  <div className="space-y-2">
                    {availableCopies.slice(0, 5).map(copy => (
                      <div key={copy.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-100">
                        <div>
                          <span className="font-mono text-sm font-bold">{copy.code}</span>
                          <span className="text-xs text-gray-400 mr-2">— {copy.sponsor.name}{copy.sponsor.organization ? ` (${copy.sponsor.organization})` : ''}</span>
                        </div>
                        <button
                          onClick={() => assignCopy(copy.id)}
                          disabled={working}
                          className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 disabled:opacity-50"
                        >
                          تخصيص
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availableCopies.length === 0 && (
                <div className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">
                  لا توجد نسخ مدعومة متاحة لهذا المنتج حاليًا. يمكنك الموافقة على دعم ML أو
                  {' '}<a href="/admin/sponsored-orders" className="text-blue-600 underline">إنشاء طلب شراء نسخ</a> أولاً.
                </div>
              )}

              {/* Reject */}
              {!showRejectForm ? (
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  رفض الطلب
                </button>
              ) : (
                <div className="border border-red-100 bg-red-50/50 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-red-800">رفض الطلب</h3>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="سبب الرفض (اختياري)..."
                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm h-20"
                  />
                  <div className="flex gap-2">
                    <button onClick={reject} disabled={working}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                      {working ? '...' : 'تأكيد الرفض'}
                    </button>
                    <button onClick={() => setShowRejectForm(false)} className="text-sm text-gray-500 hover:text-gray-700">إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approved info */}
          {request.mlAllocation && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h2 className="font-semibold text-green-800 mb-3">تفاصيل دعم ML</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-green-700">السعر الأصلي:</span> <div className="font-bold">{fmt(request.snapshotEligiblePrice)}</div></div>
                <div><span className="text-green-700">دعم ML:</span> <div className="font-bold text-green-800">{fmt(request.mlAllocation.supportAmount)}</div></div>
                <div><span className="text-green-700">العميل يدفع:</span> <div className="font-bold">{fmt(request.mlAllocation.customerPayAmount)}</div></div>
              </div>
              {request.expiresAt && (
                <p className="text-xs text-green-600 mt-2">ينتهي: {new Date(request.expiresAt).toLocaleString('ar-EG')}</p>
              )}
            </div>
          )}

          {request.assignedCopy && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <h2 className="font-semibold text-purple-800 mb-2">النسخة المخصصة</h2>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-purple-900">{request.assignedCopy.code}</span>
                <a href={`/admin/sponsored-copies/${request.assignedCopy.id}`}
                  className="text-xs text-purple-600 underline">عرض النسخة</a>
              </div>
            </div>
          )}
        </div>

        {/* Customer history sidebar */}
        {history && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">سجل العميل</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">إجمالي الطلبات</dt>
                  <dd className="font-medium">{history.totalOrders}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">قيمة المشتريات</dt>
                  <dd className="font-medium">{fmt(history.totalOrderValue)}</dd>
                </div>
                <div className="border-t border-gray-100 my-2"></div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">طلبات دعم سابقة</dt>
                  <dd className="font-medium">{history.supportRequestsTotal}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">طلبات مقبولة</dt>
                  <dd className="font-medium text-green-700">{history.supportRequestsApproved}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">طلبات مستخدمة</dt>
                  <dd className="font-medium">{history.supportRequestsUsed}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">دعم ML تلقاه</dt>
                  <dd className="font-medium">{fmt(history.totalMLSupportReceived)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">نسخ مدعومة</dt>
                  <dd className="font-medium">{history.sponsoredCopiesReceived}</dd>
                </div>
                {history.unusedApprovals > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-orange-500">موافقات غير مستخدمة</dt>
                    <dd className="font-medium text-orange-500">{history.unusedApprovals}</dd>
                  </div>
                )}
                {history.lastSupportDate && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">آخر دعم</dt>
                    <dd className="font-medium text-xs">{new Date(history.lastSupportDate).toLocaleDateString('ar-EG')}</dd>
                  </div>
                )}
              </dl>
              <p className="text-xs text-gray-400 mt-3 italic">القرار النهائي للأدمن — هذه البيانات للمساعدة فقط</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
