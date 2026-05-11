'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { products as staticProducts } from '@/lib/products';
import { Product } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { adminFetch, adminJson, ForbiddenError } from '@/lib/admin-fetch';
import ForbiddenState from '@/components/admin/ForbiddenState';

type MergedProduct = Product & { isAdded?: boolean };

// Run an array of tasks with at most `limit` in flight at once.
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<{ result: R | null; error: Error | null; item: T }[]> {
  const out: { result: R | null; error: Error | null; item: T }[] = new Array(items.length);
  let cursor = 0;
  const runners = Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        const r = await worker(items[i], i);
        out[i] = { result: r, error: null, item: items[i] };
      } catch (err) {
        out[i] = { result: null, error: err as Error, item: items[i] };
      }
    }
  });
  await Promise.all(runners);
  return out;
}

export default function RegionalPricingPage() {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState<MergedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');

  const [bulkEgpPercent, setBulkEgpPercent] = useState<number>(0);
  const [bulkUsdPercent, setBulkUsdPercent] = useState<number>(0);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/products?lite=true');
      const data = await res.json();
      setProducts(data.products ?? []);
      setForbidden(false);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else setProducts(staticProducts as MergedProduct[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    p.name.includes(search) || (p.nameEn || '').toLowerCase().includes(search.toLowerCase())
  );

  const applyBulkIncrease = async (type: 'egp' | 'usd') => {
    const percent = type === 'egp' ? bulkEgpPercent : bulkUsdPercent;
    if (percent === 0) return;

    const label = type === 'egp' ? 'المصري (ج.م)' : 'الدولي (USD)';
    const ok = await confirm({
      title: 'زيادة جماعية',
      message: `زيادة السعر ${label} لكل المنتجات (${products.length}) بنسبة ${percent}%؟`,
      confirmLabel: 'تطبيق',
      cancelLabel: 'تراجع',
      tone: 'danger',
      icon: '💰',
    });
    if (!ok) return;

    setBulkApplying(true);
    setBulkProgress({ done: 0, total: products.length });
    try {
      let done = 0;
      const results = await runWithConcurrency(products, 4, async (p) => {
        const currentPrice = type === 'egp' ? p.price : p.priceUsd;
        const newPrice = Math.round(currentPrice * (1 + percent / 100) * 100) / 100;
        const field = type === 'egp' ? 'price' : 'priceUsd';
        await adminJson(`/api/admin/products/${p.id}`, {
          method: 'PUT',
          body: JSON.stringify({ [field]: newPrice, isAdded: p.isAdded ?? false }),
        });
        setBulkProgress({ done: ++done, total: products.length });
        return p.id;
      });

      const failed = results.filter(r => r.error);
      await load();
      if (failed.length === 0) {
        addToast(`تم تحديث ${results.length} منتج بنجاح`, 'success');
      } else {
        addToast(`نجح ${results.length - failed.length} وفشل ${failed.length} — راجع المنتجات اللي ما اتغيّرتش`, 'warning', 6000);
      }
      if (type === 'egp') setBulkEgpPercent(0);
      else setBulkUsdPercent(0);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'حدث خطأ أثناء التحديث الجماعي', 'error');
    } finally {
      setBulkApplying(false);
      setBulkProgress(null);
    }
  };

  if (forbidden) return <ForbiddenState requiredPerm="products.write" />;

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900">إدارة تسعير المنتجات</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          زيادة جماعية على أسعار كل المنتجات. لتعديل سعر منتج بعينه اذهب لـ{' '}
          <Link href="/admin/products" className="text-blue-600 hover:underline font-bold">إدارة المنتجات ↗</Link>
        </p>
      </div>

      {bulkApplying && bulkProgress && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs font-bold text-amber-800">
          ⏳ جاري التطبيق… {bulkProgress.done} / {bulkProgress.total}
        </div>
      )}

      {/* Bulk increase tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <span className="text-lg">🇪🇬</span> زيادة السعر المصري
            </h2>
            <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">لجميع المنتجات</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={bulkEgpPercent || ''}
                onChange={e => setBulkEgpPercent(+e.target.value)}
                placeholder="النسبة (مثلاً 5)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
              />
              <span className="absolute left-3 top-2 text-gray-400 text-xs">%</span>
            </div>
            <button
              onClick={() => applyBulkIncrease('egp')}
              disabled={bulkApplying || !bulkEgpPercent}
              className="bg-[#1a1a2e] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#2a2a4e] transition disabled:opacity-50"
            >
              تطبيق
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <span className="text-lg">🌐</span> زيادة السعر الدولي
            </h2>
            <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold">لجميع المنتجات</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={bulkUsdPercent || ''}
                onChange={e => setBulkUsdPercent(+e.target.value)}
                placeholder="النسبة (مثلاً 5)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
              />
              <span className="absolute left-3 top-2 text-gray-400 text-xs">%</span>
            </div>
            <button
              onClick={() => applyBulkIncrease('usd')}
              disabled={bulkApplying || !bulkUsdPercent}
              className="bg-[#F5C518] text-gray-900 px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-400 transition disabled:opacity-50"
            >
              تطبيق
            </button>
          </div>
        </div>
      </div>

      {/* Price overview table — read-only reference */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث عن منتج..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
          />
          <span className="text-xs text-gray-400 shrink-0">{filtered.length} منتج</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400 text-xs">جارٍ التحميل...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-right">المنتج</th>
                  <th className="px-4 py-2.5 text-right">السعر المصري</th>
                  <th className="px-4 py-2.5 text-right">السعر الدولي</th>
                  <th className="px-4 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                          {p.images[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-semibold text-gray-800 truncate max-w-[200px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums font-bold text-gray-900">
                      {p.price.toLocaleString('en-US')} ج.م
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-600">
                      {p.priceUsd > 0 ? `${p.priceUsd} $` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-left">
                      <Link
                        href="/admin/products"
                        className="text-blue-600 hover:text-blue-800 hover:underline text-[10px] font-bold"
                      >
                        تعديل ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
