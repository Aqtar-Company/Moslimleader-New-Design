'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Supplier {
  id: string;
  name: string;
  type: string;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  transactionCount: number;
  batchCount: number;
  balance: number;
}

const TYPE_LABELS: Record<string, string> = {
  paper: '🧾 ورق / طباعة',
  supervision: '👁️ إشراف',
  manufacturing: '🏭 تنفيذ شنط',
  other: '📦 أخرى',
};

const fmt = (n: number) => n.toLocaleString('ar-EG');

export default function SuppliersPage() {
  const { addToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'other', contactPhone: '', contactEmail: '', notes: '' });

  const load = async () => {
    try {
      const res = await adminFetch('/api/admin/suppliers');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setSuppliers(data.suppliers);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.name.trim()) { addToast('اكتب اسم المورد', 'warning'); return; }
    try {
      const res = await adminFetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الإضافة', 'error'); return; }
      addToast('تم إضافة المورد', 'success');
      setForm({ name: '', type: 'other', contactPhone: '', contactEmail: '', notes: '' });
      setShowForm(false);
      load();
    } catch {
      addToast('فشل الإضافة', 'error');
    }
  };

  if (forbidden) return <ForbiddenState requiredPerm="suppliers.read" />;
  if (loading) return <Spinner />;

  // Headline totals — sum of positive balances (we owe) and abs sum of
  // negatives (they owe us). Helps the admin see net exposure at a glance.
  const totalOwed = suppliers.filter(s => s.balance > 0).reduce((s, x) => s + x.balance, 0);
  const totalOwedToUs = suppliers.filter(s => s.balance < 0).reduce((s, x) => s + Math.abs(x.balance), 0);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900">الموردون</h1>
          <p className="text-sm text-gray-500 mt-0.5">قائمة الموردين والحسابات الجارية معهم</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-bold transition">
          {showForm ? '✕ إلغاء' : '+ إضافة مورد'}
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-[10px] text-red-700 font-bold uppercase tracking-wider">إجمالي المطلوب منا</p>
          <p className="text-xl font-black text-red-700 mt-1">{fmt(totalOwed)} ج.م</p>
          <p className="text-[10px] text-red-500 mt-0.5">للموردين الدائنين</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">إجمالي المطلوب لنا</p>
          <p className="text-xl font-black text-emerald-700 mt-1">{fmt(totalOwedToUs)} ج.م</p>
          <p className="text-[10px] text-emerald-500 mt-0.5">من الموردين المدينين</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">عدد الموردين النشطين</p>
          <p className="text-xl font-black text-gray-900 mt-1">{suppliers.filter(s => s.isActive).length}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">من إجمالي {suppliers.length}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-black text-gray-900 mb-3">مورد جديد</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="اسم المورد *">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="النوع">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="هاتف الاتصال"><input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className={inputCls} dir="ltr" /></Field>
            <Field label="البريد الإلكتروني"><input value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} className={inputCls} dir="ltr" /></Field>
            <Field label="ملاحظات" wide><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls + ' resize-none'} /></Field>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={submit} className="px-4 py-2 rounded-xl bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] text-xs font-black transition">💾 حفظ</button>
          </div>
        </div>
      )}

      {suppliers.length === 0 ? <EmptyState message="مفيش موردين بعد. ابدأ بإضافة مورد." icon="🤝" /> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-right">المورد</th>
                  <th className="px-4 py-3 text-right">النوع</th>
                  <th className="px-4 py-3 text-right">الهاتف</th>
                  <th className="px-4 py-3 text-right">المعاملات</th>
                  <th className="px-4 py-3 text-right">الباتشات</th>
                  <th className="px-4 py-3 text-right">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.map(s => {
                  const tone = s.balance > 0 ? 'text-red-700' : s.balance < 0 ? 'text-emerald-700' : 'text-gray-500';
                  const label = s.balance > 0 ? 'نحن مدينون' : s.balance < 0 ? 'هم مدينون' : 'مستحق صفر';
                  return (
                    <tr key={s.id} className={s.isActive ? '' : 'opacity-50'}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/suppliers/${s.id}`} className="font-bold text-gray-900 hover:text-[#6B21A8]">{s.name}</Link>
                        {!s.isActive && <span className="ml-2 text-[10px] text-gray-400">(معطَّل)</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{TYPE_LABELS[s.type] || s.type}</td>
                      <td className="px-4 py-3 text-xs text-gray-500" dir="ltr">{s.contactPhone || '—'}</td>
                      <td className="px-4 py-3 text-xs">{s.transactionCount}</td>
                      <td className="px-4 py-3 text-xs">{s.batchCount}</td>
                      <td className={`px-4 py-3 ${tone}`}>
                        <span className="font-black">{fmt(Math.abs(s.balance))} ج.م</span>
                        <span className="text-[10px] block">{label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5C518]';

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <label className="block text-[10px] text-gray-500 font-bold mb-1">{label}</label>
      {children}
    </div>
  );
}
