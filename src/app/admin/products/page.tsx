'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  getProductOverrides, setProductOverride, getAddedProducts,
  addProduct, deleteAddedProduct, ProductOverride,
} from '@/lib/admin-storage';
import { products as staticProducts, categories } from '@/lib/products';
import { Product } from '@/types';

type MergedProduct = Product & { isAdded?: boolean };

function mergeProducts(overrides: Record<string, ProductOverride>, added: Product[]): MergedProduct[] {
  const base = staticProducts.map(p => ({
    ...p,
    price: overrides[p.id]?.price ?? p.price,
    inStock: overrides[p.id]?.inStock ?? p.inStock,
    featured: overrides[p.id]?.featured ?? p.featured,
  }));
  return [...base, ...added.map(p => ({ ...p, isAdded: true }))];
}

const EMPTY_FORM: Omit<Product, 'id' | 'reviews'> = {
  slug: '', name: '', nameEn: '', shortDescription: '', shortDescriptionEn: '',
  description: '', descriptionEn: '', price: 0, category: '', tags: [],
  images: [], inStock: true, featured: false, weight: 0,
};

export default function ProductsPage() {
  const [overrides, setOverrides] = useState<Record<string, ProductOverride>>({});
  const [added, setAdded] = useState<Product[]>([]);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceVal, setPriceVal] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [formTags, setFormTags] = useState('');
  const [formImages, setFormImages] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setOverrides(getProductOverrides());
    setAdded(getAddedProducts());
  }, []);

  useEffect(() => { load(); }, [load]);

  const products = mergeProducts(overrides, added);

  const toggleStock = (p: MergedProduct) => {
    if (p.isAdded) {
      const updated = added.map(a => a.id === p.id ? { ...a, inStock: !a.inStock } : a);
      setAdded(updated);
      const { saveAddedProducts } = require('@/lib/admin-storage');
      saveAddedProducts(updated);
    } else {
      setProductOverride(p.id, { inStock: !p.inStock });
      load();
    }
  };

  const toggleFeatured = (p: MergedProduct) => {
    if (p.isAdded) {
      const updated = added.map(a => a.id === p.id ? { ...a, featured: !a.featured } : a);
      setAdded(updated);
      const { saveAddedProducts } = require('@/lib/admin-storage');
      saveAddedProducts(updated);
    } else {
      setProductOverride(p.id, { featured: !(p.featured ?? false) });
      load();
    }
  };

  const savePrice = (p: MergedProduct) => {
    const val = parseFloat(priceVal);
    if (isNaN(val) || val <= 0) { setEditingPrice(null); return; }
    if (p.isAdded) {
      const updated = added.map(a => a.id === p.id ? { ...a, price: val } : a);
      setAdded(updated);
      const { saveAddedProducts } = require('@/lib/admin-storage');
      saveAddedProducts(updated);
    } else {
      setProductOverride(p.id, { price: val });
      load();
    }
    setEditingPrice(null);
  };

  const handleDelete = (p: MergedProduct) => {
    if (!p.isAdded) return;
    if (!confirm(`حذف "${p.name}"؟`)) return;
    deleteAddedProduct(p.id);
    load();
  };

  const handleSubmit = () => {
    if (!form.name || !form.slug || !form.price || !form.category) {
      alert('يرجى ملء الحقول المطلوبة: الاسم، الـ Slug، السعر، الفئة');
      return;
    }
    setSaving(true);
    const newProduct: Product = {
      ...form,
      id: `added-${Date.now()}`,
      tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
      images: formImages.split('\n').map(u => u.trim()).filter(Boolean),
      reviews: [],
    };
    addProduct(newProduct);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setFormTags('');
    setFormImages('');
    setSaving(false);
    load();
  };

  const categoryNames = categories.filter(c => c.id !== 'all').map(c => c.name);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">المنتجات</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} منتج</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
        >
          <span>+</span> إضافة منتج
        </button>
      </div>

      {/* Add product form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-gray-900 text-base">إضافة منتج جديد</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الاسم (عربي) *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الاسم (إنجليزي)</label>
              <input value={form.nameEn || ''} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Slug (للرابط) *</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 font-mono" dir="ltr" placeholder="product-name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الفئة *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 bg-white">
                <option value="">— اختر فئة —</option>
                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">السعر (EGP) *</label>
              <input type="number" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الوزن (جرام)</label>
              <input type="number" value={form.weight || ''} onChange={e => setForm(f => ({ ...f, weight: +e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" min="0" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف المختصر</label>
              <input value={form.shortDescription} onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف الكامل (HTML مسموح)</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">روابط الصور (رابط واحد في كل سطر)</label>
              <textarea value={formImages} onChange={e => setFormImages(e.target.value)}
                rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none font-mono" dir="ltr" placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tags (مفصولة بفاصلة)</label>
              <input value={formTags} onChange={e => setFormTags(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" placeholder="لعبة, أطفال, تعليمي" />
            </div>
            <div className="flex items-center gap-6 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.inStock} onChange={e => setForm(f => ({ ...f, inStock: e.target.checked }))} className="w-4 h-4 accent-[#F5C518]" />
                <span className="text-sm font-semibold text-gray-700">متوفر في المخزن</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured || false} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="w-4 h-4 accent-[#F5C518]" />
                <span className="text-sm font-semibold text-gray-700">منتج مميز</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={saving}
              className="bg-[#1a1a2e] text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-[#2a2a4e] transition disabled:opacity-50">
              {saving ? 'جارٍ الحفظ...' : 'حفظ المنتج'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="border border-gray-200 text-gray-600 font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Products table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-500 font-semibold">
                <th className="px-4 py-3.5 text-right">المنتج</th>
                <th className="px-4 py-3.5 text-right">الفئة</th>
                <th className="px-4 py-3.5 text-right">السعر</th>
                <th className="px-4 py-3.5 text-center">المخزون</th>
                <th className="px-4 py-3.5 text-center">مميز</th>
                <th className="px-4 py-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {p.images[0] && (
                          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-xs leading-tight">{p.name}</p>
                        {p.nameEn && <p className="text-gray-400 text-xs">{p.nameEn}</p>}
                        {(p as MergedProduct).isAdded && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold">مضاف</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.category}</td>
                  <td className="px-4 py-3">
                    {editingPrice === p.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={priceVal}
                          onChange={e => setPriceVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') savePrice(p); if (e.key === 'Escape') setEditingPrice(null); }}
                          autoFocus
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#F5C518]"
                        />
                        <button onClick={() => savePrice(p)} className="text-green-600 hover:text-green-700 font-bold text-xs">✓</button>
                        <button onClick={() => setEditingPrice(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingPrice(p.id); setPriceVal(p.price.toString()); }}
                        className="font-bold text-gray-900 hover:text-[#1a1a2e] hover:underline text-xs"
                      >
                        {p.price.toLocaleString('ar-EG')} ج
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleStock(p)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                        p.inStock ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      {p.inStock ? 'متوفر' : 'نفذ'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleFeatured(p)}
                      className={`text-lg transition hover:scale-125 ${p.featured ? 'opacity-100' : 'opacity-25'}`}
                    >
                      ⭐
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(p as MergedProduct).isAdded && (
                      <button
                        onClick={() => handleDelete(p)}
                        className="text-red-400 hover:text-red-600 text-xs font-bold transition"
                      >
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
