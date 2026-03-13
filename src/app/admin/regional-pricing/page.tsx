'use client';

import { useEffect, useState, useCallback } from 'react';
import { products as staticProducts } from '@/lib/products';
import { getProductOverrides, setProductOverride, getAddedProducts, applyOverride } from '@/lib/admin-storage';
import {
  RegionalPricing, DEFAULT_REGIONAL_PRICING, previewAllZones,
  PricingZone, ZONES,
} from '@/lib/geo-pricing';
import { Product } from '@/types';

type MergedProduct = Product & { isAdded?: boolean };

function mergeProducts(): MergedProduct[] {
  if (typeof window === 'undefined') return staticProducts;
  const overrides = getProductOverrides();
  const added = getAddedProducts();
  const base = staticProducts.map(p => overrides[p.id] ? applyOverride(p, overrides[p.id]) : p);
  return [...base, ...added.map(p => ({ ...p, isAdded: true }))];
}

const ZONE_COLORS: Record<PricingZone, string> = {
  egypt: 'bg-green-50 border-green-200 text-green-800',
  world: 'bg-orange-50 border-orange-200 text-orange-800',
};

export default function RegionalPricingPage() {
  const [products, setProducts] = useState<MergedProduct[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pricing, setPricing] = useState<RegionalPricing>({ ...DEFAULT_REGIONAL_PRICING });
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(() => { setProducts(mergeProducts()); }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    p.name.includes(search) || (p.nameEn || '').toLowerCase().includes(search.toLowerCase())
  );

  function startEdit(p: MergedProduct) {
    const existing = getProductOverrides()[p.id]?.regionalPricing;
    setPricing(existing ? { ...DEFAULT_REGIONAL_PRICING, ...existing } : { ...DEFAULT_REGIONAL_PRICING });
    setEditingId(p.id);
  }

  function savePricing() {
    if (!editingId) return;
    setProductOverride(editingId, { regionalPricing: pricing });
    setSaved(editingId);
    setTimeout(() => setSaved(null), 2000);
    load();
  }

  function resetPricing() {
    if (!editingId) return;
    if (!confirm('إعادة ضبط التسعير الإقليمي لهذا المنتج؟')) return;
    const overrides = getProductOverrides();
    if (overrides[editingId]) {
      delete overrides[editingId].regionalPricing;
      localStorage.setItem('ml-product-overrides', JSON.stringify(overrides));
    }
    setPricing({ ...DEFAULT_REGIONAL_PRICING });
    load();
  }

  const currentProduct = products.find(p => p.id === editingId);
  const preview = currentProduct ? previewAllZones(
    pricing.price_egp_manual && pricing.price_egp_manual > 0
      ? pricing.price_egp_manual
      : currentProduct.price,
    pricing
  ) : null;

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900">التسعير الإقليمي</h1>
        <p className="text-sm text-gray-500 mt-0.5">تحكم في سعر كل منتج حسب المنطقة الجغرافية</p>
      </div>

      {/* Zone info */}
      <div className="grid grid-cols-2 gap-3">
        {Object.values(ZONES).map(z => (
          <div key={z.zone} className={`rounded-2xl border p-3 ${ZONE_COLORS[z.zone]}`}>
            <p className="text-xl mb-0.5">{z.flag}</p>
            <p className="font-bold text-sm">{z.label}</p>
            <p className="text-xs opacity-70">{z.currencyAr} ({z.currencyEn})</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Products list */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث عن منتج..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
            />
          </div>
          <div className="overflow-y-auto max-h-[600px] divide-y divide-gray-50">
            {filtered.map(p => {
              const hasRegional = typeof window !== 'undefined' && !!getProductOverrides()[p.id]?.regionalPricing;
              return (
                <button key={p.id} onClick={() => startEdit(p)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-gray-50 transition ${editingId === p.id ? 'bg-amber-50 border-r-2 border-[#F5C518]' : ''}`}>
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {p.images[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-xs leading-tight truncate">{p.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{p.price.toLocaleString()} ج.م أساسي</p>
                  </div>
                  {hasRegional && (
                    <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">إقليمي ✓</span>
                  )}
                  {saved === p.id && (
                    <span className="shrink-0 text-xs bg-[#F5C518]/30 text-amber-800 px-2 py-0.5 rounded-full font-bold">تم الحفظ ✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pricing editor */}
        {editingId && currentProduct ? (
          <div className="space-y-4">

            {/* Product header */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                {currentProduct.images[0] && <img src={currentProduct.images[0]} alt={currentProduct.name} className="w-full h-full object-cover" />}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{currentProduct.name}</p>
                <p className="text-xs text-gray-400">السعر الأساسي: <span className="font-bold text-gray-700">{currentProduct.price.toLocaleString()} ج.م</span></p>
              </div>
            </div>

            {/* Manual prices */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-bold text-gray-900 text-sm border-b pb-2">الأسعار يدويًا (اتركها فارغة للحساب التلقائي)</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { label: '🇪🇬 سعر مصر (ج.م)', field: 'price_egp_manual' as const, placeholder: `${currentProduct.price} (تلقائي)` },
                  { label: '🌐 سعر دولي (USD)', field: 'price_usd_manual' as const, placeholder: 'مثال: 8' },
                ].map(({ label, field, placeholder }) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                    <input
                      type="number" min={0} step="any"
                      value={pricing[field] ?? ''}
                      onChange={e => setPricing(x => ({ ...x, [field]: e.target.value ? +e.target.value : undefined }))}
                      placeholder={placeholder}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            {preview && (
              <div className="bg-gray-950 rounded-2xl p-5 text-white">
                <h3 className="font-bold text-sm mb-3 text-gray-300">معاينة الأسعار</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(preview) as [PricingZone, typeof preview[PricingZone]][]).map(([zone, result]) => (
                    <div key={zone} className="bg-white/10 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-1">{ZONES[zone].flag} {ZONES[zone].label}</p>
                      <p className="font-black text-lg text-[#F5C518]">
                        {result.price % 1 === 0 ? result.price : result.price.toFixed(2)}
                        <span className="text-sm text-gray-300 font-normal mr-1">{result.currency}</span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {result.isManual ? '✓ يدوي' : '⚡ تلقائي'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={savePricing}
                className="flex-1 bg-[#F5C518] hover:bg-amber-400 text-gray-900 font-black py-3 rounded-xl text-sm transition">
                {saved === editingId ? '✓ تم الحفظ' : '💾 حفظ التسعير'}
              </button>
              <button onClick={resetPricing}
                className="border border-gray-200 text-gray-500 font-semibold px-4 py-3 rounded-xl text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition">
                إعادة ضبط
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="text-4xl mb-3">🌍</div>
            <p className="font-bold text-gray-700 text-base">اختر منتجاً من القائمة</p>
            <p className="text-gray-400 text-sm mt-1">لضبط الأسعار الإقليمية</p>
          </div>
        )}
      </div>
    </div>
  );
}
