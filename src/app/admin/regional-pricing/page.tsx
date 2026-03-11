'use client';

import { useEffect, useState, useCallback } from 'react';
import { products as staticProducts } from '@/lib/products';
import { getProductOverrides, setProductOverride, getAddedProducts, applyOverride } from '@/lib/admin-storage';
import {
  RegionalPricing, DEFAULT_REGIONAL_PRICING, previewAllZones,
  RoundingRule, PricingZone, ZONES,
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

const ROUNDING_LABELS: Record<RoundingRule, string> = {
  none: 'بدون تقريب',
  whole: 'رقم صحيح',
  friendly: 'تجاري (مثل 29، 8.99)',
};

const ZONE_COLORS: Record<PricingZone, string> = {
  egypt: 'bg-green-50 border-green-200 text-green-800',
  saudi: 'bg-blue-50 border-blue-200 text-blue-800',
  gulf:  'bg-purple-50 border-purple-200 text-purple-800',
  world: 'bg-orange-50 border-orange-200 text-orange-800',
};

function emptyPricing(): RegionalPricing {
  return { ...DEFAULT_REGIONAL_PRICING };
}

export default function RegionalPricingPage() {
  const [products, setProducts] = useState<MergedProduct[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pricing, setPricing] = useState<RegionalPricing>(emptyPricing());
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(() => {
    setProducts(mergeProducts());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    p.name.includes(search) || (p.nameEn || '').toLowerCase().includes(search.toLowerCase())
  );

  function startEdit(p: MergedProduct) {
    const overrides = getProductOverrides();
    const existing = overrides[p.id]?.regionalPricing;
    setPricing(existing ? { ...DEFAULT_REGIONAL_PRICING, ...existing } : emptyPricing());
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
    setPricing(emptyPricing());
    load();
  }

  const currentProduct = products.find(p => p.id === editingId);
  const preview = currentProduct ? previewAllZones(
    pricing.price_egp_manual && pricing.price_egp_manual > 0 ? pricing.price_egp_manual : currentProduct.price,
    pricing
  ) : null;

  function field(label: string, value: string | number | undefined, onChange: (v: string) => void, type = 'number', placeholder = '') {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          min={0}
          step={type === 'number' ? 'any' : undefined}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
        />
      </div>
    );
  }

  function roundSelect(label: string, value: RoundingRule, onChange: (v: RoundingRule) => void) {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
        <select
          value={value}
          onChange={e => onChange(e.target.value as RoundingRule)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518] bg-white"
        >
          {(Object.keys(ROUNDING_LABELS) as RoundingRule[]).map(r => (
            <option key={r} value={r}>{ROUNDING_LABELS[r]}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900">التسعير الإقليمي</h1>
        <p className="text-sm text-gray-500 mt-0.5">تحكم في سعر كل منتج حسب المنطقة الجغرافية</p>
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.values(ZONES)).map(z => (
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
              const overrides = typeof window !== 'undefined' ? getProductOverrides() : {};
              const hasRegional = !!overrides[p.id]?.regionalPricing;
              return (
                <button
                  key={p.id}
                  onClick={() => startEdit(p)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-gray-50 transition ${editingId === p.id ? 'bg-amber-50 border-r-2 border-[#F5C518]' : ''}`}
                >
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
              <h3 className="font-bold text-gray-900 text-sm border-b pb-2">الأسعار اليدوية</h3>
              <div className="grid grid-cols-2 gap-3">
                {field('🇪🇬 سعر مصر (ج.م)', pricing.price_egp_manual, v => setPricing(x => ({ ...x, price_egp_manual: v ? +v : undefined })), 'number', `${currentProduct.price} (تلقائي)`)}
                {field('🇸🇦 سعر السعودية (ر.س)', pricing.price_sar_manual, v => setPricing(x => ({ ...x, price_sar_manual: v ? +v : undefined })), 'number', 'مثال: 30')}
                {field('🌍 سعر الخليج (خليجي)', pricing.price_gulf_manual, v => setPricing(x => ({ ...x, price_gulf_manual: v ? +v : undefined })), 'number', 'مثال: 30')}
                {field('🌐 سعر دولي (USD)', pricing.price_usd_manual, v => setPricing(x => ({ ...x, price_usd_manual: v ? +v : undefined })), 'number', 'مثال: 8.99')}
              </div>
            </div>

            {/* Formula fallback */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-gray-900 text-sm">الحساب التلقائي (احتياطي)</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pricing.use_formula_fallback}
                    onChange={e => setPricing(x => ({ ...x, use_formula_fallback: e.target.checked }))}
                    className="w-4 h-4 accent-[#F5C518]"
                  />
                  <span className="text-xs font-semibold text-gray-600">تفعيل</span>
                </label>
              </div>
              {pricing.use_formula_fallback && (
                <div className="grid grid-cols-3 gap-3">
                  {field('معامل السعودية', pricing.saudi_multiplier, v => setPricing(x => ({ ...x, saudi_multiplier: +v })), 'number', '0.075')}
                  {field('معامل الخليج', pricing.gulf_multiplier, v => setPricing(x => ({ ...x, gulf_multiplier: +v })), 'number', '0.075')}
                  {field('معامل الدولي', pricing.usd_multiplier, v => setPricing(x => ({ ...x, usd_multiplier: +v })), 'number', '0.020')}
                </div>
              )}
              <p className="text-xs text-gray-400">
                مثال: إذا السعر المصري = 200 ج.م ومعامل السعودية = 0.075، فالسعر = 15 ر.س
              </p>
            </div>

            {/* Rounding rules */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-bold text-gray-900 text-sm border-b pb-2">قواعد التقريب</h3>
              <div className="grid grid-cols-2 gap-3">
                {roundSelect('🇪🇬 تقريب مصر', pricing.rounding_rule_egp, v => setPricing(x => ({ ...x, rounding_rule_egp: v })))}
                {roundSelect('🇸🇦 تقريب السعودية', pricing.rounding_rule_sar, v => setPricing(x => ({ ...x, rounding_rule_sar: v })))}
                {roundSelect('🌍 تقريب الخليج', pricing.rounding_rule_gulf, v => setPricing(x => ({ ...x, rounding_rule_gulf: v })))}
                {roundSelect('🌐 تقريب الدولي', pricing.rounding_rule_usd, v => setPricing(x => ({ ...x, rounding_rule_usd: v })))}
              </div>
            </div>

            {/* Preview */}
            {preview && (
              <div className="bg-gray-950 rounded-2xl p-5 text-white">
                <h3 className="font-bold text-sm mb-3 text-gray-300">معاينة الأسعار</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(preview) as [PricingZone, ReturnType<typeof previewAllZones>[PricingZone]][]).map(([zone, result]) => (
                    <div key={zone} className="bg-white/10 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-1">{ZONES[zone].flag} {ZONES[zone].label}</p>
                      <p className="font-black text-lg text-[#F5C518]">
                        {result.price % 1 === 0 ? result.price : result.price.toFixed(2)}
                        <span className="text-sm text-gray-300 font-normal mr-1">{result.currency}</span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {result.isManual ? '✓ يدوي' : '⚡ حساب تلقائي'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={savePricing}
                className="flex-1 bg-[#F5C518] hover:bg-amber-400 text-gray-900 font-black py-3 rounded-xl text-sm transition"
              >
                {saved === editingId ? '✓ تم الحفظ' : '💾 حفظ التسعير'}
              </button>
              <button
                onClick={resetPricing}
                className="border border-gray-200 text-gray-500 font-semibold px-4 py-3 rounded-xl text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
              >
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
