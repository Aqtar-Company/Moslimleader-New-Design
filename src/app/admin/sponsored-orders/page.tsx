'use client';

import { useEffect, useState, useCallback } from 'react';

interface SponsoredOrder {
  id: string; quantity: number; pricePerCopy: number; totalPaid: number; currency: string;
  localCurrency?: string | null; localPricePerCopy?: number | null; localTotalPaid?: number | null;
  paymentMethod: string; paymentStatus: string; paymentRef?: string;
  adminNote?: string; createdAt: string;
  sponsor: { id: string; name: string; organization?: string };
  product: { id: string; name: string };
  _count: { copies: number };
}

const PAYMENT_STATUS: Record<string, string> = { pending: 'معلق', paid: 'مدفوع', failed: 'فشل', refunded: 'مسترد' };
const PAYMENT_COLORS: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', paid: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-700', refunded: 'bg-gray-100 text-gray-600' };

export default function AdminSponsoredOrdersPage() {
  const [orders, setOrders] = useState<SponsoredOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{ id: string; action: 'cancel' | 'refund' } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    sponsorId: '', productId: '', quantity: '1', pricePerCopy: '',
    paymentMethod: 'admin-entry', paymentRef: '', adminNote: '', markPaidNow: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/sponsored-orders?page=${page}`);
    if (res.ok) { const d = await res.json(); setOrders(d.orders); setTotal(d.total); setPages(d.pages); }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (orderId: string, paymentRef?: string) => {
    setMarking(orderId);
    const res = await fetch(`/api/admin/sponsored-orders/${orderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', paymentRef }),
    });
    if (res.ok) { await load(); }
    setMarking(null);
  };

  const submitAction = async () => {
    if (!actionTarget) return;
    setActionError('');
    const res = await fetch(`/api/admin/sponsored-orders/${actionTarget.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionTarget.action, reason: actionReason }),
    });
    if (res.ok) {
      setActionTarget(null); setActionReason('');
      await load();
    } else {
      const d = await res.json();
      setActionError(d.error ?? 'حدث خطأ');
    }
  };

  const createOrder = async () => {
    setSaving(true); setFormError('');
    const res = await fetch('/api/admin/sponsored-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, quantity: Number(form.quantity), pricePerCopy: Number(form.pricePerCopy) }),
    });
    if (res.ok) { setShowForm(false); await load(); }
    else { const d = await res.json(); setFormError(d.error ?? 'خطأ'); }
    setSaving(false);
  };

  const fmt = (n: number) => n.toLocaleString('ar-EG') + ' ج.م';

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">

      {/* Reason modal */}
      {actionTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" dir="rtl">
            <h3 className="font-bold text-gray-900 mb-1">
              {actionTarget.action === 'cancel' ? 'إلغاء الطلب' : 'التراجع عن تأكيد الدفع'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {actionTarget.action === 'refund'
                ? 'سيتم إلغاء النسخ المتاحة وتحويل الطلب إلى "مُسترد". لا يمكن التراجع إن كانت نسخ مخصصة لمستفيدين.'
                : 'سيتم تحويل الطلب إلى "ملغى".'}
            </p>
            <textarea
              value={actionReason}
              onChange={e => setActionReason(e.target.value)}
              placeholder="السبب (اختياري)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm h-20 mb-3"
            />
            {actionError && <p className="text-red-600 text-sm mb-3">{actionError}</p>}
            <div className="flex gap-2">
              <button onClick={submitAction}
                className={`px-4 py-2 rounded-lg text-sm text-white font-medium ${actionTarget.action === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                تأكيد
              </button>
              <button onClick={() => { setActionTarget(null); setActionReason(''); setActionError(''); }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">طلبات شراء النسخ المدعومة</h1>
          <p className="text-gray-500 text-sm mt-1">{total} طلب</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + إدخال طلب داعم
        </button>
      </div>

      {/* Admin entry form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-800 mb-4">إدخال طلب داعم يدوي</h2>
          {formError && <div className="text-red-600 text-sm mb-3">{formError}</div>}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-xs text-gray-500 block mb-1">ID الداعم (من صفحة الداعمين)</label>
              <input value={form.sponsorId} onChange={e => setForm(p => ({ ...p, sponsorId: e.target.value }))}
                placeholder="cuid الداعم" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">ID المنتج</label>
              <input value={form.productId} onChange={e => setForm(p => ({ ...p, productId: e.target.value }))}
                placeholder="cuid المنتج" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">عدد النسخ</label>
              <input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                min="1" max="1000" className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">سعر النسخة (ج.م)</label>
              <input type="number" value={form.pricePerCopy} onChange={e => setForm(p => ({ ...p, pricePerCopy: e.target.value }))}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">مرجع الدفع</label>
              <input value={form.paymentRef} onChange={e => setForm(p => ({ ...p, paymentRef: e.target.value }))}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="markPaid" checked={form.markPaidNow}
                onChange={e => setForm(p => ({ ...p, markPaidNow: e.target.checked }))} />
              <label htmlFor="markPaid" className="text-sm text-gray-700">تأكيد الدفع وإنشاء النسخ الآن</label>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">ملاحظات</label>
              <textarea value={form.adminNote} onChange={e => setForm(p => ({ ...p, adminNote: e.target.value }))}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-16" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createOrder} disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? '...' : 'حفظ'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500">إلغاء</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400">جاري التحميل...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-right p-3 font-medium text-gray-600">الداعم</th>
                <th className="text-right p-3 font-medium text-gray-600">المنتج</th>
                <th className="text-right p-3 font-medium text-gray-600">الكمية</th>
                <th className="text-right p-3 font-medium text-gray-600">الإجمالي</th>
                <th className="text-right p-3 font-medium text-gray-600">الدفع</th>
                <th className="text-right p-3 font-medium text-gray-600">النسخ</th>
                <th className="text-right p-3 font-medium text-gray-600">التاريخ</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50/50">
                  <td className="p-3">
                    <div className="font-medium">{o.sponsor.name}</div>
                    {o.sponsor.organization && <div className="text-xs text-gray-400">{o.sponsor.organization}</div>}
                  </td>
                  <td className="p-3 text-gray-700">{o.product.name}</td>
                  <td className="p-3 text-center font-bold">{o.quantity}</td>
                  <td className="p-3 font-medium">
                    {fmt(o.totalPaid)}
                    {o.localCurrency && o.localCurrency !== 'EGP' && o.localTotalPaid && (
                      <div className="text-xs text-blue-600 font-semibold mt-0.5">
                        {o.localTotalPaid.toLocaleString()} {o.localCurrency}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${PAYMENT_COLORS[o.paymentStatus] ?? ''}`}>
                      {PAYMENT_STATUS[o.paymentStatus] ?? o.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3 text-center text-gray-600">{o._count.copies} / {o.quantity}</td>
                  <td className="p-3 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      {o.paymentStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => markPaid(o.id)}
                            disabled={marking === o.id}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {marking === o.id ? '...' : 'تأكيد الدفع'}
                          </button>
                          <button
                            onClick={() => { setActionTarget({ id: o.id, action: 'cancel' }); setActionError(''); }}
                            className="text-xs text-red-500 hover:text-red-700 underline"
                          >
                            إلغاء
                          </button>
                        </>
                      )}
                      {o.paymentStatus === 'paid' && (
                        <button
                          onClick={() => { setActionTarget({ id: o.id, action: 'refund' }); setActionError(''); }}
                          className="text-xs text-orange-600 hover:text-orange-800 underline"
                        >
                          تراجع / استرداد
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
