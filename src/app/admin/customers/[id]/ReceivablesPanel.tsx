'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { adminFetch } from '@/lib/admin-fetch';

interface Txn {
  id: string;
  kind: string;
  amount: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
}

const KIND_LABELS: Record<string, { label: string; tone: string }> = {
  invoice:       { label: 'فاتورة',  tone: 'bg-red-100 text-red-700' },
  payment:       { label: 'دفعة',   tone: 'bg-emerald-100 text-emerald-700' },
  'credit-note': { label: 'مرتجع',  tone: 'bg-blue-100 text-blue-700' },
};

const fmt = (n: number) => Math.abs(n).toLocaleString('en-US');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB');

// Customer accounts-receivable section. Mirrors the supplier-detail
// layout: a balance card at top with a tone color (red = they owe us,
// emerald = we owe them, gray = settled), a compact transaction table,
// and a + form for one-off invoices/payments/credit-notes.
export default function ReceivablesPanel({ customerId }: { customerId: string }) {
  const { addToast } = useToast();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ kind: 'invoice', amount: '', description: '', orderId: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/customers/${customerId}/transactions`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setTxns(data.transactions);
      setBalance(data.balance);
    } catch {
      addToast('فشل تحميل المعاملات', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [customerId]);

  const submit = async () => {
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) { addToast('المبلغ غير صحيح', 'warning'); return; }
    try {
      const res = await adminFetch(`/api/admin/customers/${customerId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: form.kind, amount: amt, description: form.description, orderId: form.orderId || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل التسجيل', 'error'); return; }
      addToast('تم تسجيل المعاملة', 'success');
      setForm({ kind: 'invoice', amount: '', description: '', orderId: '' });
      setShowForm(false);
      load();
    } catch {
      addToast('فشل التسجيل', 'error');
    }
  };

  const remove = async (txnId: string) => {
    if (!confirm('حذف المعاملة؟ سيُعاد حساب الرصيد تلقائياً.')) return;
    try {
      const res = await adminFetch(`/api/admin/customers/${customerId}/transactions/${txnId}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحذف', 'error'); return; }
      addToast('تم الحذف', 'success');
      load();
    } catch {
      addToast('فشل الحذف', 'error');
    }
  };

  // Balance interpretation: positive = they owe us (red), negative = we owe them (emerald), zero = settled
  const balanceLabel = balance > 0 ? 'يدين لنا بـ' : balance < 0 ? 'مدفوع له بزيادة' : 'الحساب مسوّى';
  const balanceTone  = balance > 0 ? 'text-red-700' : balance < 0 ? 'text-emerald-700' : 'text-gray-500';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-black text-gray-900">📒 الحساب المالي (المدينية / الذمم)</p>
          <p className="text-[10px] text-gray-500 mt-0.5">سجل الفواتير والدفعات. الرصيد الموجب يضاف لقيمة الشركة في تقرير التقييم.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-[11px] font-bold transition"
        >
          {showForm ? '✕ إلغاء' : '+ تسجيل معاملة'}
        </button>
      </div>

      <div className={`rounded-xl px-4 py-3 ${balance > 0 ? 'bg-red-50 border border-red-200' : balance < 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
        <p className="text-[10px] text-gray-600 font-bold tracking-widest">الرصيد الحالي</p>
        <p className={`text-2xl font-black mt-1 ${balanceTone}`} dir="ltr">{fmt(balance)} ج.م</p>
        <p className="text-[11px] text-gray-600 mt-0.5">{balanceLabel}</p>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 font-bold mb-1">النوع</label>
              <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                <option value="invoice">فاتورة (يزيد ما يدينون به)</option>
                <option value="payment">دفعة (يقلل ما يدينون به)</option>
                <option value="credit-note">مرتجع (يقلل ما يدينون به)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 font-bold mb-1">المبلغ (ج.م)</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" dir="ltr" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] text-gray-500 font-bold mb-1">الوصف</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="اختياري" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={submit} className="px-3 py-1.5 rounded-lg bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] text-xs font-black transition">💾 حفظ</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[11px] text-gray-400 text-center py-4">...جاري التحميل</p>
      ) : txns.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-4">مفيش معاملات بعد — اضغط "تسجيل معاملة" للبدء</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold">
              <tr>
                <th className="px-2 py-2 text-right">التاريخ</th>
                <th className="px-2 py-2 text-right">النوع</th>
                <th className="px-2 py-2 text-right">المبلغ</th>
                <th className="px-2 py-2 text-right">الوصف</th>
                <th className="px-2 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {txns.map(t => {
                const meta = KIND_LABELS[t.kind] ?? { label: t.kind, tone: 'bg-gray-100 text-gray-700' };
                return (
                  <tr key={t.id}>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-gray-600" dir="ltr">{fmtDate(t.createdAt)}</td>
                    <td className="px-2 py-1.5"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${meta.tone}`}>{meta.label}</span></td>
                    <td className="px-2 py-1.5 font-bold" dir="ltr">{fmt(t.amount)} ج.م</td>
                    <td className="px-2 py-1.5 text-gray-600 text-[11px]">{t.description || '—'}</td>
                    <td className="px-2 py-1.5 text-left">
                      <button onClick={() => remove(t.id)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
