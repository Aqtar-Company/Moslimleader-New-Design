'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface VariantShape { name?: string }
interface Product { id: string; name: string; slug: string; variants: VariantShape[] | unknown }
interface Supplier { id: string; name: string; type: string; isActive: boolean }
interface Batch {
  id: string;
  productId: string;
  productName: string;
  variantIndex: number | null;
  variantName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchDate: string;
  notes: string | null;
}

const fmt = (n: number) => n.toLocaleString('ar-EG');

export default function ProductionPage() {
  const sp = useSearchParams();
  const presetProductId = sp.get('productId');
  const { addToast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [productFilter, setProductFilter] = useState<string>(presetProductId ?? '');
  const [form, setForm] = useState({
    productId: presetProductId ?? '',
    supplierId: '',
    variantIndex: '',
    quantity: '',
    unitCost: '',
    batchDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const load = async () => {
    try {
      const url = productFilter ? `/api/admin/production/batches?productId=${productFilter}` : '/api/admin/production/batches';
      const [bRes, pRes, sRes] = await Promise.all([
        adminFetch(url),
        adminFetch('/api/admin/products?lite=true'),
        adminFetch('/api/admin/suppliers'),
      ]);
      if (!bRes.ok) throw new Error('failed');
      const bData = await bRes.json();
      setBatches(bData.batches);
      if (pRes.ok) {
        const pData = await pRes.json();
        setProducts(pData.products || []);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setSuppliers((sData.suppliers || []).filter((s: Supplier) => s.isActive));
      }
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [productFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProduct = useMemo(() => products.find(p => p.id === form.productId), [products, form.productId]);
  const selectedVariants = (selectedProduct?.variants as VariantShape[] | null) ?? [];
  const hasVariants = Array.isArray(selectedVariants) && selectedVariants.length > 0;

  const totalPreview = (Number(form.quantity) || 0) * (Number(form.unitCost) || 0);

  const submit = async () => {
    if (!form.productId) { addToast('اختر منتج', 'warning'); return; }
    const qty = Number(form.quantity);
    const cost = Number(form.unitCost);
    if (!Number.isFinite(qty) || qty <= 0) { addToast('الكمية غير صحيحة', 'warning'); return; }
    if (!Number.isFinite(cost) || cost < 0) { addToast('التكلفة غير صحيحة', 'warning'); return; }
    if (hasVariants && form.variantIndex === '') { addToast('اختر الموديل', 'warning'); return; }

    try {
      const res = await adminFetch('/api/admin/production/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          supplierId: form.supplierId || null,
          variantIndex: hasVariants ? Number(form.variantIndex) : null,
          quantity: qty,
          unitCost: cost,
          batchDate: form.batchDate,
          notes: form.notes,
        }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل التسجيل', 'error'); return; }
      addToast('تم تسجيل الباتش', 'success');
      setForm({
        productId: form.productId, supplierId: '', variantIndex: '',
        quantity: '', unitCost: '',
        batchDate: new Date().toISOString().slice(0, 10), notes: '',
      });
      setShowForm(false);
      load();
    } catch {
      addToast('فشل التسجيل', 'error');
    }
  };

  if (forbidden) return <ForbiddenState requiredPerm="production.read" />;
  if (loading) return <Spinner />;

  const totalSpend = batches.reduce((s, b) => s + b.totalCost, 0);
  const totalUnits = batches.reduce((s, b) => s + b.quantity, 0);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900">باتشات الإنتاج</h1>
          <p className="text-sm text-gray-500 mt-0.5">سجل دفعات التنفيذ مع المورد والتكلفة الفعلية</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/admin/production/seed-stock" className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition">
            🌱 تسعير المخزون الافتتاحي
          </Link>
          <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-bold transition">
            {showForm ? '✕ إلغاء' : '+ سجّل باتش جديد'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPI label="عدد الباتشات" value={fmt(batches.length)} />
        <KPI label="إجمالي القطع المنتَجة" value={fmt(totalUnits)} />
        <KPI label="إجمالي تكلفة الإنتاج" value={`${fmt(totalSpend)} ج.م`} />
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-black text-gray-900">باتش جديد</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="المنتج *">
              <select value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value, variantIndex: '' })} className={inputCls}>
                <option value="">— اختر —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            {hasVariants && (
              <Field label="الموديل *">
                <select value={form.variantIndex} onChange={e => setForm({ ...form, variantIndex: e.target.value })} className={inputCls}>
                  <option value="">— اختر —</option>
                  {selectedVariants.map((v, i) => <option key={i} value={i}>{v.name ?? `موديل ${i + 1}`}</option>)}
                </select>
              </Field>
            )}
            <Field label="المورد">
              <select value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} className={inputCls}>
                <option value="">— بدون مورد —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="الكمية *"><input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className={inputCls} dir="ltr" /></Field>
            <Field label="تكلفة الوحدة (ج.م) *"><input type="number" step="0.01" min="0" value={form.unitCost} onChange={e => setForm({ ...form, unitCost: e.target.value })} className={inputCls} dir="ltr" /></Field>
            <Field label="تاريخ الباتش"><input type="date" value={form.batchDate} onChange={e => setForm({ ...form, batchDate: e.target.value })} className={inputCls} dir="ltr" /></Field>
            <Field label="ملاحظات (اختياري)" wide><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls + ' resize-none'} /></Field>
          </div>

          {/* Live total + ledger preview */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
            <p>إجمالي التكلفة: <strong>{fmt(Math.round(totalPreview * 100) / 100)} ج.م</strong></p>
            {form.supplierId && <p className="mt-1">سيتسجل تلقائيًا قيد <strong>فاتورة</strong> على حساب المورد بنفس المبلغ.</p>}
            {form.productId && form.quantity && <p className="mt-1">سيُضاف <strong>{form.quantity}</strong> للمخزون{hasVariants && form.variantIndex !== '' ? ' (للموديل المختار)' : ''}.</p>}
          </div>
          <div className="flex justify-end">
            <button onClick={submit} className="px-4 py-2 rounded-xl bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] text-xs font-black transition">💾 سجّل الباتش</button>
          </div>
        </div>
      )}

      {/* Filter */}
      {!showForm && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">فلتر:</span>
          <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
            <option value="">كل المنتجات</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {batches.length === 0 ? <EmptyState message="مفيش باتشات بعد" icon="🏭" /> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-right">التاريخ</th>
                  <th className="px-3 py-3 text-right">المنتج</th>
                  <th className="px-3 py-3 text-right">الموديل</th>
                  <th className="px-3 py-3 text-right">المورد</th>
                  <th className="px-3 py-3 text-right">الكمية</th>
                  <th className="px-3 py-3 text-right">تكلفة الوحدة</th>
                  <th className="px-3 py-3 text-right">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map(b => (
                  <tr key={b.id}>
                    <td className="px-3 py-2.5 text-gray-600">{new Date(b.batchDate).toLocaleDateString('ar-EG')}</td>
                    <td className="px-3 py-2.5 font-bold text-gray-900">{b.productName}</td>
                    <td className="px-3 py-2.5 text-gray-600">{b.variantName || '—'}</td>
                    <td className="px-3 py-2.5">
                      {b.supplierId ? <Link href={`/admin/suppliers/${b.supplierId}`} className="text-blue-700 hover:underline">{b.supplierName}</Link> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 font-bold">{fmt(b.quantity)}</td>
                    <td className="px-3 py-2.5">{fmt(b.unitCost)} ج.م</td>
                    <td className="px-3 py-2.5 font-black text-[#6B21A8]">{fmt(b.totalCost)} ج.م</td>
                  </tr>
                ))}
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
    <div className={wide ? 'md:col-span-3' : ''}>
      <label className="block text-[10px] text-gray-500 font-bold mb-1">{label}</label>
      {children}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
      <p className="text-xl font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}
