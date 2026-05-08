'use client';

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/admin/Spinner';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Variant { id?: string; name?: string; nameEn?: string; imageIndex?: number }

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  priceUsd: number;
  images: unknown;
  inStock: boolean;
  stock: number;
  category: string;
  sold: number;
  variants?: Variant[];
  variantStocks?: Record<string, number> | null;
  soldByVariant?: Record<string, number>;
}

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (typeof first === 'string') return first;
  if (typeof first === 'object' && first !== null) {
    const o = first as { url?: string; src?: string };
    return o.url || o.src || null;
  }
  return null;
}

export default function InventoryPage() {
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [variantEdits, setVariantEdits] = useState<Record<string, number>>({}); // key = `${productId}:${variantIndex}`
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [forbidden, setForbidden] = useState(false);

  const toggleExpand = (productId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/inventory');
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل تحميل المخزون', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => products.filter(p => {
    if (filter === 'low' && p.stock > 50) return false;
    if (filter === 'out' && p.stock > 0) return false;
    if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [products, filter, search]);

  // Variant-aware totals — use effectiveStock so this matches /admin/zakat
  // and /admin/valuation. See src/lib/inventory-value.ts for the helper.
  // Floor negative stock values at 0 (a corrupt count shouldn't depress
  // the total value figure).
  const effectiveStock = (p: { stock: number; variantStocks?: Record<string, number> | null }) => {
    if (p.variantStocks && Object.keys(p.variantStocks).length > 0) {
      return Math.max(0, Object.values(p.variantStocks).reduce((s, n) => s + (Number.isFinite(n) ? Number(n) : 0), 0));
    }
    return Math.max(0, p.stock || 0);
  };
  const totalUnits = useMemo(() => products.reduce((s, p) => s + effectiveStock(p), 0), [products]);
  const totalValue = useMemo(() => products.reduce((s, p) => s + effectiveStock(p) * p.price, 0), [products]);
  const totalSold  = useMemo(() => products.reduce((s, p) => s + p.sold, 0), [products]);
  const lowCount   = useMemo(() => products.filter(p => p.stock <= 50 && p.stock > 0).length, [products]);
  const outCount   = useMemo(() => products.filter(p => p.stock <= 0).length, [products]);

  const updateStock = async (productId: string, value: number) => {
    try {
      const res = await adminFetch('/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({ productId, stock: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'فشل التحديث', 'error');
      } else {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: data.product.stock } : p));
        setEdits(prev => { const next = { ...prev }; delete next[productId]; return next; });
        addToast('تم تحديث المخزون', 'success');
      }
    } catch {
      addToast('فشل التحديث', 'error');
    }
  };

  const adjustStock = async (productId: string, delta: number) => {
    try {
      const res = await adminFetch('/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({ productId, delta }),
      });
      const data = await res.json();
      if (!res.ok) addToast(data.error || 'فشل التعديل', 'error');
      else setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: data.product.stock } : p));
    } catch {}
  };

  const updateVariantStock = async (productId: string, variantIndex: number, value: number) => {
    try {
      const res = await adminFetch('/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({ productId, variantIndex, stock: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'فشل التحديث', 'error');
        return;
      }
      setProducts(prev => prev.map(p => p.id === productId ? {
        ...p,
        stock: data.product.stock,
        variantStocks: data.product.variantStocks ?? p.variantStocks,
      } : p));
      setVariantEdits(prev => { const next = { ...prev }; delete next[`${productId}:${variantIndex}`]; return next; });
      addToast('تم تحديث الموديل', 'success');
    } catch {
      addToast('فشل التحديث', 'error');
    }
  };

  const adjustVariantStock = async (productId: string, variantIndex: number, delta: number) => {
    try {
      const res = await adminFetch('/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({ productId, variantIndex, delta }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشل التعديل', 'error'); return; }
      setProducts(prev => prev.map(p => p.id === productId ? {
        ...p,
        stock: data.product.stock,
        variantStocks: data.product.variantStocks ?? p.variantStocks,
      } : p));
    } catch {}
  };

  if (forbidden) return <ForbiddenState requiredPerm="inventory.read" />;
  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">إدارة المخزون</h1>
        <p className="text-sm text-gray-500 mt-0.5">{products.length} منتج · المخزون يقل تلقائيًا مع كل طلب</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI icon="📦" label="إجمالي الوحدات" value={totalUnits.toLocaleString('en-US')} />
        <KPI icon="💰" label="قيمة المخزون" value={`${Math.round(totalValue).toLocaleString('en-US')} ج.م`} />
        <KPI icon="🛒" label="إجمالي المبيعات" value={totalSold.toLocaleString('en-US')} />
        <KPI icon="⚠️" label="مخزون منخفض" value={String(lowCount)} tone="warn" />
        <KPI icon="🚫" label="نفد المخزون" value={String(outCount)} tone="bad" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ابحث باسم المنتج..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 w-full sm:w-72"
        />
        <div className="flex gap-2">
          {[
            { k: 'all', l: 'الكل' },
            { k: 'low', l: 'منخفض (≤50)' },
            { k: 'out', l: 'نافد' },
          ].map(f => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k as typeof filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === f.k ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
            >{f.l}</button>
          ))}
        </div>
      </div>

      {/* Mobile card list — compact view of products with quick +/- buttons.
          Variant products link out to the desktop view for per-variant
          editing (too cramped to do well on a small screen). */}
      <div className="block lg:hidden space-y-2">
        {filtered.map(p => {
          const img = firstImage(p.images);
          const isLow = p.stock > 0 && p.stock <= 50;
          const isOut = p.stock <= 0;
          const variants = Array.isArray(p.variants) ? p.variants : [];
          const hasVariants = variants.length > 0;
          const editValue = edits[p.id];
          const totalValue = p.price * p.stock;
          return (
            <div key={p.id} className={`bg-white rounded-xl border p-3 ${isOut ? 'border-red-200 bg-red-50/30' : isLow ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {img ? <Image src={img} alt={p.name} fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">📦</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm leading-tight">{p.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{p.category} · {p.price.toLocaleString('en-US')} ج.م</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">قيمة إجمالية: {Math.round(totalValue).toLocaleString('en-US')} ج.م · مباع: {p.sold.toLocaleString('en-US')}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-[10px] text-gray-500">المخزون</p>
                  <p className={`text-2xl font-black leading-none ${isOut ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-gray-900'}`}>{p.stock.toLocaleString('en-US')}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                {hasVariants ? (
                  <p className="text-[11px] text-purple-700 font-bold">
                    🎨 {variants.length} موديلات — حرّر من شاشة سطح المكتب
                  </p>
                ) : (
                  <>
                    <button onClick={() => adjustStock(p.id, -10)} className="w-9 h-9 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-black text-sm">−10</button>
                    <button onClick={() => adjustStock(p.id, -1)} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-700 text-gray-700 font-black text-base">−</button>
                    <input
                      type="number"
                      value={editValue !== undefined ? editValue : p.stock}
                      onChange={e => setEdits(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                      className={`flex-1 min-w-[80px] border rounded-lg px-2 py-1.5 text-sm text-center font-bold ${isOut ? 'border-red-300 text-red-700 bg-red-50' : isLow ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-gray-200'}`}
                    />
                    <button onClick={() => adjustStock(p.id, 1)} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-700 font-black text-base">+</button>
                    <button onClick={() => adjustStock(p.id, 10)} className="w-9 h-9 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-sm">+10</button>
                    {editValue !== undefined && editValue !== p.stock && (
                      <button onClick={() => updateStock(p.id, editValue)} className="px-3 py-1.5 rounded-lg bg-[#F5C518] text-[#1a1a2e] text-[11px] font-black">حفظ</button>
                    )}
                  </>
                )}
                <Link href={`/admin/inventory/movements?productId=${p.id}`} className="ms-auto text-[10px] text-blue-700 hover:underline">🧾 السجل</Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-500 font-semibold">
                <th className="px-3 py-3.5 text-right">المنتج</th>
                <th className="px-3 py-3.5 text-right">السعر</th>
                <th className="px-3 py-3.5 text-right">المباع</th>
                <th className="px-3 py-3.5 text-right">المخزون الحالي</th>
                <th className="px-3 py-3.5 text-right">قيمة المخزون</th>
                <th className="px-3 py-3.5 text-right">تعديل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const img = firstImage(p.images);
                const isLow = p.stock > 0 && p.stock <= 50;
                const isOut = p.stock <= 0;
                const editValue = edits[p.id];
                const variants = Array.isArray(p.variants) ? p.variants : [];
                const hasVariants = variants.length > 0;
                const isExpanded = expanded.has(p.id);
                const imagesArr = Array.isArray(p.images) ? p.images as unknown[] : [];
                return (
                  <Fragment key={p.id}>
                  <tr className={`hover:bg-gray-50 ${isOut ? 'bg-red-50/40' : isLow ? 'bg-amber-50/40' : ''} ${hasVariants ? 'cursor-pointer' : ''}`} onClick={hasVariants ? () => toggleExpand(p.id) : undefined}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {hasVariants && (
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-transform ${isExpanded ? 'rotate-180 bg-[#F5C518] text-[#1a1a2e]' : 'bg-gray-100 text-gray-500'}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        )}
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          {img ? <Image src={img} alt={p.name} fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">📦</div>}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {p.category}
                            {hasVariants && <span className="ms-2 text-purple-600 font-bold">· {variants.length} موديلات</span>}
                          </p>
                          <Link
                            href={`/admin/inventory/movements?productId=${p.id}`}
                            className="text-[10px] text-blue-700 hover:underline mt-0.5 inline-block"
                            title="سجل تغيّرات المخزون لهذا المنتج"
                          >
                            🧾 السجل
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-bold">{p.price.toLocaleString('en-US')} <span className="text-[10px] text-gray-400">ج.م</span></td>
                    <td className="px-3 py-3 text-xs font-bold text-blue-700">{p.sold.toLocaleString('en-US')}</td>
                    <td className="px-3 py-3" onClick={e => hasVariants && e.stopPropagation()}>
                      {hasVariants ? (
                        <div className="text-xs">
                          <span className={`font-black ${isOut ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-gray-900'}`}>{p.stock.toLocaleString('en-US')}</span>
                          <span className="text-[10px] text-gray-400 ms-1">إجمالي الموديلات</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={() => adjustStock(p.id, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-700 text-gray-700 font-bold text-sm">−</button>
                          <input
                            type="number"
                            value={editValue !== undefined ? editValue : p.stock}
                            onChange={e => setEdits(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                            className={`w-20 border rounded-lg px-2 py-1 text-sm text-center font-bold ${isOut ? 'border-red-300 text-red-700 bg-red-50' : isLow ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-gray-200'}`}
                          />
                          <button onClick={() => adjustStock(p.id, 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-700 font-bold text-sm">+</button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs font-black text-[#6B21A8]">{Math.round(p.stock * p.price).toLocaleString('en-US')} ج.م</td>
                    <td className="px-3 py-3" onClick={e => hasVariants && e.stopPropagation()}>
                      {hasVariants ? (
                        <span className="text-[11px] text-gray-400">عدّل كل موديل ↓</span>
                      ) : editValue !== undefined && editValue !== p.stock ? (
                        <button
                          onClick={() => updateStock(p.id, editValue)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >حفظ</button>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                  {hasVariants && isExpanded && variants.map((v, idx) => {
                    const stockKey = String(idx);
                    const vStock = (p.variantStocks?.[stockKey]) ?? 0;
                    const vSold = (p.soldByVariant?.[stockKey]) ?? 0;
                    const vEdit = variantEdits[`${p.id}:${idx}`];
                    const vIsLow = vStock > 0 && vStock <= 50;
                    const vIsOut = vStock <= 0;
                    const vImgIdx = typeof v.imageIndex === 'number' ? v.imageIndex : 0;
                    const vImgRaw = imagesArr[vImgIdx];
                    const vImg = typeof vImgRaw === 'string' ? vImgRaw : (vImgRaw as { url?: string; src?: string } | undefined)?.url
                      || (vImgRaw as { url?: string; src?: string } | undefined)?.src || img;
                    return (
                      <tr key={`${p.id}-v${idx}`} className={`border-r-4 ${vIsOut ? 'bg-red-50/30 border-red-300' : vIsLow ? 'bg-amber-50/30 border-amber-300' : 'bg-purple-50/20 border-purple-200'}`}>
                        <td className="px-3 py-2 ps-12">
                          <div className="flex items-center gap-3">
                            <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-white border border-gray-200 shrink-0">
                              {vImg ? <Image src={vImg} alt={v.name || `موديل ${idx + 1}`} fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">📦</div>}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-purple-800">↳ {v.name || `موديل ${idx + 1}`}</p>
                              {v.nameEn && <p className="text-[10px] text-gray-400">{v.nameEn}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[11px] text-gray-400">—</td>
                        <td className="px-3 py-2 text-[11px] font-bold text-blue-700">{vSold.toLocaleString('en-US')}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => adjustVariantStock(p.id, idx, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-700 text-gray-700 font-bold text-sm">−</button>
                            <input
                              type="number"
                              value={vEdit !== undefined ? vEdit : vStock}
                              onChange={e => setVariantEdits(prev => ({ ...prev, [`${p.id}:${idx}`]: Number(e.target.value) }))}
                              className={`w-20 border rounded-lg px-2 py-1 text-sm text-center font-bold ${vIsOut ? 'border-red-300 text-red-700 bg-red-50' : vIsLow ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-gray-200'}`}
                            />
                            <button onClick={() => adjustVariantStock(p.id, idx, 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-700 font-bold text-sm">+</button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[11px] font-bold text-[#6B21A8]">{Math.round(vStock * p.price).toLocaleString('en-US')} ج.م</td>
                        <td className="px-3 py-2">
                          {vEdit !== undefined && vEdit !== vStock ? (
                            <button
                              onClick={() => updateVariantStock(p.id, idx, vEdit)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                            >حفظ</button>
                          ) : (
                            <span className="text-[11px] text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'warn' | 'bad' }) {
  const toneClass = tone === 'bad' ? 'border-red-200 bg-red-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white';
  const valueClass = tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-gray-900';
  return (
    <div className={`border rounded-2xl p-4 ${toneClass}`}>
      <p className="text-xl mb-1">{icon}</p>
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-black mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}
