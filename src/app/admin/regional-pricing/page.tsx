'use client';

import { useEffect, useState, useCallback } from 'react';
import { products as staticProducts } from '@/lib/products';
import { Product } from '@/types';

type MergedProduct = Product & { isAdded?: boolean };

export default function RegionalPricingPage() {
  const [products, setProducts] = useState<MergedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  
  // Bulk pricing states
  const [bulkEgpPercent, setBulkEgpPercent] = useState<number>(0);
  const [bulkUsdPercent, setBulkUsdPercent] = useState<number>(0);
  const [bulkApplying, setBulkApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch {
      setProducts(staticProducts as MergedProduct[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    p.name.includes(search) || (p.nameEn || '').toLowerCase().includes(search.toLowerCase())
  );

  const updatePrice = async (id: string, field: 'price' | 'priceUsd', value: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    try {
      await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: value, isAdded: product.isAdded ?? false }),
      });
      
      setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
      setSavedId(id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      alert('فشل في حفظ السعر');
    }
  };

  const applyBulkIncrease = async (type: 'egp' | 'usd') => {
    const percent = type === 'egp' ? bulkEgpPercent : bulkUsdPercent;
    if (percent === 0) return;
    
    const label = type === 'egp' ? 'المصري (ج.م)' : 'الدولي (USD)';
    if (!confirm(`هل أنت متأكد من زيادة السعر ${label} لجميع المنتجات بنسبة ${percent}%؟`)) return;

    setBulkApplying(true);
    try {
      const promises = products.map(p => {
        const currentPrice = type === 'egp' ? p.price : p.priceUsd;
        const newPrice = Math.round(currentPrice * (1 + percent / 100) * 100) / 100;
        const field = type === 'egp' ? 'price' : 'priceUsd';
        
        return fetch(`/api/admin/products/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ [field]: newPrice, isAdded: p.isAdded ?? false }),
        });
      });

      await Promise.all(promises);
      await load();
      alert('تم تحديث جميع الأسعار بنجاح');
      if (type === 'egp') setBulkEgpPercent(0);
      else setBulkUsdPercent(0);
    } catch (err) {
      alert('حدث خطأ أثناء التحديث الجماعي');
    } finally {
      setBulkApplying(false);
    }
  };

  const currentProduct = products.find(p => p.id === editingId);

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900">إدارة تسعير المنتجات</h1>
        <p className="text-sm text-gray-500 mt-0.5">تحكم في سعر الجنيه والدولار لكل منتج أو طبق زيادة جماعية</p>
      </div>

      {/* Bulk actions - Improved Layout */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Products list - The Layout you liked */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث عن منتج..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
            />
          </div>
          <div className="overflow-y-auto max-h-[600px] divide-y divide-gray-50">
            {loading ? (
              <div className="p-10 text-center text-gray-400 text-xs">جارٍ التحميل...</div>
            ) : filtered.map(p => (
              <button key={p.id} onClick={() => setEditingId(p.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-gray-50 transition ${editingId === p.id ? 'bg-amber-50 border-r-2 border-[#F5C518]' : ''}`}>
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                  {p.images[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-xs leading-tight truncate">{p.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-gray-500 font-medium">🇪🇬 {p.price} ج.م</span>
                    <span className="text-[10px] text-gray-400 font-medium">🌐 {p.priceUsd} $</span>
                  </div>
                </div>
                {savedId === p.id && (
                  <span className="shrink-0 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">تم الحفظ ✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Pricing editor */}
        {editingId && currentProduct ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                {currentProduct.images[0] && <img src={currentProduct.images[0]} alt={currentProduct.name} className="w-full h-full object-cover" />}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{currentProduct.name}</p>
                <p className="text-[10px] text-gray-400">{currentProduct.category}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5 shadow-sm">
              <h3 className="font-bold text-gray-900 text-sm border-b pb-2">تعديل الأسعار المباشرة</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                    <span>🇪🇬</span> السعر في مصر (ج.م)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={currentProduct.price}
                      onChange={e => {
                        const val = +e.target.value;
                        setProducts(prev => prev.map(p => p.id === editingId ? { ...p, price: val } : p));
                      }}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
                    />
                    <button 
                      onClick={() => updatePrice(currentProduct.id, 'price', currentProduct.price)}
                      className="bg-[#1a1a2e] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#2a2a4e] transition"
                    >
                      حفظ
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                    <span>🌐</span> السعر الدولي (USD)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={currentProduct.priceUsd}
                      onChange={e => {
                        const val = +e.target.value;
                        setProducts(prev => prev.map(p => p.id === editingId ? { ...p, priceUsd: val } : p));
                      }}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
                    />
                    <button 
                      onClick={() => updatePrice(currentProduct.id, 'priceUsd', currentProduct.priceUsd)}
                      className="bg-[#F5C518] text-gray-900 px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-400 transition"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  * ملاحظة: السعر الدولي (USD) سيتم تحويله تلقائياً لعملة العميل (ريال، درهم، يورو، إلخ) بناءً على موقعه الجغرافي.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-16 text-center px-6 shadow-sm">
            <div className="text-4xl mb-3">💰</div>
            <p className="font-bold text-gray-700 text-sm">اختر منتجاً لتعديل سعره</p>
            <p className="text-gray-400 text-[10px] mt-1">أو استخدم أدوات الزيادة الجماعية في الأعلى</p>
          </div>
        )}
      </div>
    </div>
  );
}
