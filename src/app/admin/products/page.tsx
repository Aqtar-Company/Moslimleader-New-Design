'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { products as staticProducts, categories as staticCategories } from '@/lib/products';
import { Product, ProductVariant } from '@/types';

interface VariantDraft {
  id: string;
  name: string;
  nameEn: string;
  imageIndex: number;
}

type MergedProduct = Product & { isAdded?: boolean };

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMPTY_FORM = {
  slug: '', name: '', nameEn: '', shortDescription: '', shortDescriptionEn: '',
  description: '', descriptionEn: '', price: 0, priceUsd: 0, videoUrl: '', category: '',
  tags: [] as string[], images: [] as string[], inStock: true, weight: 0,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<MergedProduct[]>([]);
  const [addedCats, setAddedCats] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState('');
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceVal, setPriceVal] = useState('');
  const [priceUsdVal, setPriceUsdVal] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formTags, setFormTags] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/admin/products', { credentials: 'include' }),
        fetch('/api/admin/settings?key=categories-added', { credentials: 'include' }),
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      setProducts(prodData.products ?? []);
      setAddedCats(Array.isArray(catData.value) ? catData.value : []);
    } catch {
      setProducts(staticProducts as MergedProduct[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allCategoryNames = [
    ...staticCategories.filter(c => c.id !== 'all').map(c => c.name),
    ...addedCats,
  ];

  const processFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    const results = await Promise.all(arr.map(readFileAsDataURL));
    setFormImages(prev => [...prev, ...results].slice(0, 8));
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await processFiles(e.dataTransfer.files);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await processFiles(e.target.files);
    e.target.value = '';
  };

  const removeImage = (idx: number) => setFormImages(prev => prev.filter((_, i) => i !== idx));

  const moveImage = (from: number, to: number) => {
    setFormImages(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const toggleStock = async (p: MergedProduct) => {
    await fetch(`/api/admin/products/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ inStock: !p.inStock, isAdded: p.isAdded ?? false }),
    });
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, inStock: !x.inStock } : x));
  };

  const saveQuickPrice = async (p: MergedProduct) => {
    const egpVal = parseFloat(priceVal);
    const usdVal = parseFloat(priceUsdVal);
    if (isNaN(egpVal) || egpVal <= 0) { setEditingPrice(null); return; }

    await fetch(`/api/admin/products/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        price: egpVal, 
        priceUsd: isNaN(usdVal) ? 0 : usdVal,
        isAdded: p.isAdded ?? false 
      }),
    });
    
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, price: egpVal, priceUsd: isNaN(usdVal) ? 0 : usdVal } : x));
    setEditingPrice(null);
  };

  const handleDelete = async (p: MergedProduct) => {
    if (!p.isAdded) return;
    if (!confirm(`حذف "${p.name}"؟`)) return;
    await fetch(`/api/admin/products/${p.id}`, { method: 'DELETE', credentials: 'include' });
    setProducts(prev => prev.filter(x => x.id !== p.id));
  };

  const startEdit = (p: MergedProduct) => {
    setEditingId(p.id);
    setForm({
      slug: p.slug,
      name: p.name,
      nameEn: p.nameEn || '',
      shortDescription: p.shortDescription,
      shortDescriptionEn: p.shortDescriptionEn || '',
      description: p.description,
      descriptionEn: p.descriptionEn || '',
      price: p.price,
      priceUsd: p.priceUsd || 0,
      videoUrl: p.videoUrl || '',
      category: p.category,
      tags: p.tags,
      images: p.images,
      inStock: p.inStock,
      weight: p.weight,
    });
    setFormTags(p.tags.join(', '));
    setFormImages([...p.images]);
    setVariants(
      p.variants?.map(v => ({ id: v.id, name: v.name, nameEn: v.nameEn || '', imageIndex: v.imageIndex })) ?? []
    );
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addVariant = () => setVariants(v => [...v, { id: `v-${Date.now()}`, name: '', nameEn: '', imageIndex: -1 }]);
  const updateVariant = (id: string, patch: Partial<VariantDraft>) => setVariants(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
  const removeVariant = (id: string) => setVariants(v => v.filter(x => x.id !== id));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormTags('');
    setFormImages([]);
    setVariants([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.slug || !form.price || !form.category) {
      alert('يرجى ملء الحقول المطلوبة: الاسم، الـ Slug، السعر، الفئة');
      return;
    }
    if (formImages.length === 0) {
      alert('يرجى إضافة صورة واحدة على الأقل');
      return;
    }
    setSaving(true);

    const builtVariants: ProductVariant[] = variants
      .filter(v => v.name && v.imageIndex >= 0)
      .map(v => ({ id: v.id, name: v.name, nameEn: v.nameEn || undefined, imageIndex: v.imageIndex }));

    const parsedTags = formTags.split(',').map(t => t.trim()).filter(Boolean);

    const payload = {
      slug: form.slug,
      name: form.name,
      nameEn: form.nameEn || undefined,
      shortDescription: form.shortDescription,
      shortDescriptionEn: form.shortDescriptionEn || undefined,
      description: form.description,
      descriptionEn: form.descriptionEn || undefined,
      price: form.price,
        priceUsd: form.priceUsd,
        videoUrl: form.videoUrl || null,
        category: form.category,
      inStock: form.inStock,
      weight: form.weight,
      tags: parsedTags,
      images: formImages,
      variants: builtVariants.length > 0 ? builtVariants : undefined,
    };

    if (editingId) {
      const editingProduct = products.find(p => p.id === editingId);
      await fetch(`/api/admin/products/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...payload, isAdded: editingProduct?.isAdded ?? false }),
      });
    } else {
      await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    }

    resetForm();
    setSaving(false);
    await load();
  };

  const saveCategories = async (cats: string[]) => {
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: 'categories-added', value: cats }),
    });
  };

  const addCategory = async () => {
    const name = newCatInput.trim();
    if (!name || addedCats.includes(name)) return;
    const updated = [...addedCats, name];
    setAddedCats(updated);
    await saveCategories(updated);
    setNewCatInput('');
  };

  const deleteCategory = async (cat: string) => {
    const updated = addedCats.filter(c => c !== cat);
    setAddedCats(updated);
    await saveCategories(updated);
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">إدارة المنتجات</h1>
          <p className="text-sm text-gray-500 mt-0.5">إضافة وتعديل المنتجات وأسعارها</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-[#F5C518] text-gray-900 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-amber-400 transition shadow-sm"
        >
          + إضافة منتج جديد
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h2 className="font-bold text-gray-900">{editingId ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-sm">إغلاق</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الاسم (عربي) *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الاسم (إنجليزي)</label>
              <input
                value={form.nameEn || ''}
                onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Slug (للرابط) *</label>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الفئة *</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 bg-white"
              >
                <option value="">— اختر فئة —</option>
                {allCategoryNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">سعر مصر (ج.م) *</label>
              <input
                type="number"
                value={form.price || ''}
                onChange={e => setForm(f => ({ ...f, price: +e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                min="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">سعر دولي (USD) 🌍</label>
              <input
                type="number"
                step="0.01"
                value={form.priceUsd || ''}
                onChange={e => setForm(f => ({ ...f, priceUsd: +e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                min="0"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">رابط الفيديو التعريفي (YouTube) 🎥</label>
              <input
                type="url"
                value={form.videoUrl || ''}
                onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 font-mono"
                placeholder="https://www.youtube.com/watch?v=..."
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-[#1a1a2e] text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-[#2a2a4e] transition disabled:opacity-50"
            >
              {saving ? 'جارٍ الحفظ...' : '💾 حفظ المنتج'}
            </button>
            <button onClick={resetForm} className="border border-gray-200 text-gray-600 font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold text-xs">
              <tr>
                <th className="px-4 py-3.5">المنتج</th>
                <th className="px-4 py-3.5">الفئة</th>
                <th className="px-4 py-3.5">السعر</th>
                <th className="px-4 py-3.5 text-center">المخزون</th>
                <th className="px-4 py-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                        {p.images[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />}
                      </div>
                      <p className="font-bold text-gray-900 text-xs">{p.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.category}</td>
                  <td className="px-4 py-3">
                    {editingPrice === p.id ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          value={priceVal}
                          onChange={e => setPriceVal(e.target.value)}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs"
                          placeholder="EGP"
                        />
                        <input
                          type="number"
                          value={priceUsdVal}
                          onChange={e => setPriceUsdVal(e.target.value)}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs"
                          placeholder="USD"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => saveQuickPrice(p)} className="text-green-600 font-bold text-[10px]">حفظ</button>
                          <button onClick={() => setEditingPrice(null)} className="text-gray-400 text-[10px]">إلغاء</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => {
                        setEditingPrice(p.id);
                        setPriceVal(p.price.toString());
                        setPriceUsdVal(p.priceUsd?.toString() || '0');
                      }} className="text-right">
                        <span className="block font-bold text-gray-900">{p.price} ج.م</span>
                        <span className="block text-gray-400 text-[10px]">{p.priceUsd} $</span>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleStock(p)} className={`px-2 py-1 rounded-full text-[10px] font-bold ${p.inStock ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {p.inStock ? 'متوفر' : 'نفذ'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => startEdit(p)} className="text-blue-500 font-bold text-xs hover:bg-blue-50 px-2 py-1 rounded-lg">تعديل</button>
                      <a href="/admin/regional-pricing" className="text-purple-500 text-xs">🌍</a>
                      {p.isAdded && <button onClick={() => handleDelete(p)} className="text-red-400 font-bold text-xs hover:bg-red-50 px-2 py-1 rounded-lg">حذف</button>}
                    </div>
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
