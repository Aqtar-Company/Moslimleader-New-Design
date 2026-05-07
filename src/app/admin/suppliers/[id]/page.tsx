'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Txn {
  id: string;
  kind: string;
  amount: number;
  description: string | null;
  productionBatchId: string | null;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
  type: string;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  transactions: Txn[];
}

const TYPE_LABELS: Record<string, string> = {
  paper: '🧾 ورق / طباعة',
  supervision: '👁️ إشراف',
  manufacturing: '🏭 تنفيذ شنط',
  other: '📦 أخرى',
};

const KIND_LABELS: Record<string, { label: string; tone: string }> = {
  invoice:       { label: 'فاتورة', tone: 'bg-red-100 text-red-700' },
  payment:       { label: 'دفعة',   tone: 'bg-emerald-100 text-emerald-700' },
  'credit-note': { label: 'مرتجع',  tone: 'bg-blue-100 text-blue-700' },
};

const fmt = (n: number) => n.toLocaleString('ar-EG');

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [txnForm, setTxnForm] = useState({ kind: 'invoice', amount: '', description: '' });

  const load = async () => {
    try {
      const res = await adminFetch(`/api/admin/suppliers/${id}`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setSupplier(data.supplier);
      setBalance(data.balance);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitTxn = async () => {
    const amt = Number(txnForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) { addToast('المبلغ غير صحيح', 'warning'); return; }
    try {
      const res = await adminFetch(`/api/admin/suppliers/${id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: txnForm.kind, amount: amt, description: txnForm.description }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الإضافة', 'error'); return; }
      addToast('تم تسجيل المعاملة', 'success');
      setTxnForm({ kind: 'invoice', amount: '', description: '' });
      setShowTxnForm(false);
      load();
    } catch {
      addToast('فشل الإضافة', 'error');
    }
  };

  const deleteTxn = async (txnId: string) => {
    if (!confirm('حذف المعاملة؟')) return;
    try {
      const res = await adminFetch(`/api/admin/suppliers/${id}/transactions/${txnId}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحذف', 'error'); return; }
      addToast('تم الحذف', 'success');
      load();
    } catch {
      addToast('فشل الحذف', 'error');
    }
  };

  if (forbidden) return <ForbiddenState requiredPerm="suppliers.read" />;
  if (loading) return <Spinner />;
  if (!supplier) return <div className="text-center text-gray-400 py-16">المورد غير موجود</div>;

  const tone = balance > 0 ? 'text-red-700' : balance < 0 ? 'text-emerald-700' : 'text-gray-500';
  const balanceLabel = balance > 0 ? 'نحن مدينون لهم' : balance < 0 ? 'هم مدينون لنا' : 'الحساب مسوّى';

  return (
    <div className="space-y-5" dir="rtl">
      <Link href="/admin/suppliers" className="text-xs text-gray-500 hover:text-gray-900">← العودة لقائمة الموردين</Link>

      {/* Header */}
      <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-black">{supplier.name}</h1>
            <p className="text-white/70 text-sm mt-1">{TYPE_LABELS[supplier.type] || supplier.type}</p>
            {supplier.contactPhone && <p className="text-white/60 text-sm font-mono mt-1" dir="ltr">{supplier.contactPhone}</p>}
            {supplier.contactEmail && <p className="text-white/60 text-sm mt-0.5" dir="ltr">{supplier.contactEmail}</p>}
            {supplier.notes && <p className="text-white/50 text-xs mt-2 max-w-md">{supplier.notes}</p>}
          </div>
          <div className="text-left">
            <p className="text-[10px] text-[#F5C518] font-bold tracking-widest">الرصيد الحالي</p>
            <p className={`text-3xl font-black mt-1 ${balance === 0 ? 'text-white' : balance > 0 ? 'text-red-300' : 'text-emerald-300'}`}>{fmt(Math.abs(balance))} ج.م</p>
            <p className="text-white/60 text-xs mt-1">{balanceLabel}</p>
          </div>
        </div>
      </div>

      {/* Transaction form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-sm font-black text-gray-900">📒 المعاملات</p>
          <button onClick={() => setShowTxnForm(v => !v)} className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-[11px] font-bold transition">
            {showTxnForm ? '✕ إلغاء' : '+ تسجيل معاملة'}
          </button>
        </div>
        {showTxnForm && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 font-bold mb-1">النوع</label>
                <select value={txnForm.kind} onChange={e => setTxnForm({ ...txnForm, kind: e.target.value })} className={inputCls}>
                  <option value="invoice">فاتورة (يزيد ما نحن مدينون به)</option>
                  <option value="payment">دفعة (يقلل ما نحن مدينون به)</option>
                  <option value="credit-note">مرتجع (يقلل ما نحن مدينون به)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-bold mb-1">المبلغ (ج.م)</label>
                <input type="number" step="0.01" min="0" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-bold mb-1">وصف (اختياري)</label>
                <input value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={submitTxn} className="px-4 py-2 rounded-xl bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] text-xs font-black transition">💾 حفظ المعاملة</button>
            </div>
          </div>
        )}

        {supplier.transactions.length === 0 ? <EmptyState message="مفيش معاملات بعد" icon="📒" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-right">التاريخ</th>
                  <th className="px-3 py-2 text-right">النوع</th>
                  <th className="px-3 py-2 text-right">المبلغ</th>
                  <th className="px-3 py-2 text-right">الوصف</th>
                  <th className="px-3 py-2 text-right">من باتش؟</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplier.transactions.map(t => {
                  const k = KIND_LABELS[t.kind] || { label: t.kind, tone: 'bg-gray-100 text-gray-700' };
                  return (
                    <tr key={t.id}>
                      <td className="px-3 py-2.5 text-gray-600">{new Date(t.createdAt).toLocaleDateString('ar-EG')}</td>
                      <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${k.tone}`}>{k.label}</span></td>
                      <td className="px-3 py-2.5 font-black">{fmt(t.amount)} ج.م</td>
                      <td className="px-3 py-2.5 text-gray-700">{t.description || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-[10px]">{t.productionBatchId ? '🏭 من باتش' : '—'}</td>
                      <td className="px-3 py-2.5">
                        {!t.productionBatchId && (
                          <button onClick={() => deleteTxn(t.id)} className="text-red-500 hover:text-red-700 text-[11px]">حذف</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5C518]';
