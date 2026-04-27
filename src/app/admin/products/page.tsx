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
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/admin/products?lite=true', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/settings?key=categories-added', { credentials: 'include', cache: 'no-store' }),
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
    setUploadingCount(arr.length);
    const uploaded: string[] = [];
    for (const file of arr) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('/api/admin/products/upload-image', { method: 'POST', credentials: 'include', body: fd });
        if (res.ok) {
          const data = await res.json();
          uploaded.push(data.url);
        }
      } finally {
        setUploadingCount(prev => Math.max(0, prev - 1));
      }
    }
    if (uploaded.length) setFormImages(prev => [...uploaded, ...prev].slice(0, 8));
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

  const startEdit = async (p: MergedProduct) => {
    setLoading(true);
    try {
      // Fetch full product data (with descriptions) from API
      const res = await fetch(`/api/admin/products/${p.id}`, { credentials: 'include' });
      const data = await res.json();
      const fullP = data.product as MergedProduct;

      setEditingId(fullP.id);
      setForm({
        slug: fullP.slug,
        name: fullP.name,
        nameEn: fullP.nameEn || '',
        shortDescription: fullP.shortDescription || '',
        shortDescriptionEn: fullP.shortDescriptionEn || '',
        description: fullP.description || '',
        descriptionEn: fullP.descriptionEn || '',
        price: fullP.price,
        priceUsd: fullP.priceUsd || 0,
        videoUrl: fullP.videoUrl || '',
        category: fullP.category,
        tags: fullP.tags || [],
        images: fullP.images || [],
        inStock: fullP.inStock ?? true,
        weight: fullP.weight || 0,
      });
      setFormTags((fullP.tags || []).join(', '));
      setFormImages([...(fullP.images || [])]);
      setVariants(
        fullP.variants?.map(v => ({ id: v.id, name: v.name, nameEn: v.nameEn || '', imageIndex: v.imageIndex })) ?? []
      );
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
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
      .filter(v => v.name)
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

    let saveOk = false;
    if (editingId) {
      const editingProduct = products.find(p => p.id === editingId);
      const res = await fetch(`/api/admin/products/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...payload, isAdded: editingProduct?.isAdded ?? false }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`فشل الحفظ: ${err.error ?? res.status}`);
        setSaving(false);
        return;
      }
      saveOk = true;
    } else {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`فشل الحفظ: ${err.error ?? res.status}`);
        setSaving(false);
        return;
      }
      saveOk = true;
    }

    if (saveOk) {
      resetForm();
      await load();
    }
    setSaving(false);
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
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 sticky top-0 bg-white">
            <h2 className="font-bold text-gray-900">{editingId ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-sm">إغلاق</button>
          </div>

          {/* ── Basic Info ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">المعلومات الأساسية</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الاسم (عربي) *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الاسم (إنجليزي)</label>
                <input value={form.nameEn || ''} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Slug (للرابط) *</label>
                <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 font-mono" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الفئة *</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 bg-white">
                  <option value="">— اختر فئة —</option>
                  {allCategoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Pricing ── */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">التسعير</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">سعر مصر (ج.م) *</label>
                <input type="number" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" min="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">سعر دولي (USD) 🌍</label>
                <input type="number" step="0.01" value={form.priceUsd || ''} onChange={e => setForm(f => ({ ...f, priceUsd: +e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" min="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الوزن (غرام)</label>
                <input type="number" value={form.weight || ''} onChange={e => setForm(f => ({ ...f, weight: +e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" min="0" />
              </div>
            </div>
          </div>

          {/* ── Descriptions ── */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">الوصف</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف القصير (عربي)</label>
                <textarea value={form.shortDescription || ''} onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف القصير (إنجليزي)</label>
                <textarea value={form.shortDescriptionEn || ''} onChange={e => setForm(f => ({ ...f, shortDescriptionEn: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف الكامل (عربي - يدعم HTML)</label>
                <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 font-mono text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف الكامل (إنجليزي - يدعم HTML)</label>
                <textarea value={form.descriptionEn || ''} onChange={e => setForm(f => ({ ...f, descriptionEn: e.target.value }))} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 font-mono text-xs" dir="ltr" />
              </div>
            </div>
          </div>

          {/* ── Images ── */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">الصور *</h3>
            <div
              onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${isDragging ? 'border-blue-400 bg-blue-50' : uploadingCount > 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-300 hover:border-gray-400'}`}
              onClick={() => !uploadingCount && fileInputRef.current?.click()}
            >
              {uploadingCount > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-amber-700">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    <span className="text-sm font-semibold">جارٍ رفع {uploadingCount} صورة...</span>
                  </div>
                  <div className="w-full bg-amber-200 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">اسحب الصور هنا أو اضغط لاختيار</p>
              )}
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileInput} className="hidden" />
            </div>
            {formImages.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">{formImages.length} صورة — الصورة الأولى هي الرئيسية (البريفيو)</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {formImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img} alt={`img-${i}`} className={`w-full h-20 object-cover rounded-lg border-2 ${i === 0 ? 'border-[#F5C518]' : 'border-gray-200'}`} />
                      {i === 0 && (
                        <span className="absolute top-1 right-1 text-[9px] bg-[#F5C518] text-gray-900 font-bold px-1 py-0.5 rounded leading-none">رئيسية</span>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center gap-1 transition">
                        {i > 0 && <button onClick={() => moveImage(i, i - 1)} className="text-white text-xs bg-gray-700 px-1 py-0.5 rounded">←</button>}
                        {i < formImages.length - 1 && <button onClick={() => moveImage(i, i + 1)} className="text-white text-xs bg-gray-700 px-1 py-0.5 rounded">→</button>}
                        <button onClick={() => removeImage(i)} className="text-white text-xs bg-red-600 px-2 py-0.5 rounded">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Stock & Video ── */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">خيارات أخرى</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <button
                  dir="ltr"
                  type="button"
                  onClick={() => setForm(f => ({ ...f, inStock: !f.inStock }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${form.inStock ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${form.inStock ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className={`text-sm font-semibold ${form.inStock ? 'text-green-700' : 'text-gray-400'}`}>
                  {form.inStock ? 'متوفر في المخزون' : 'غير متوفر'}
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">رابط فيديو YouTube 🎥</label>
                <input type="url" value={form.videoUrl || ''} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 font-mono" placeholder="https://www.youtube.com/watch?v=..." dir="ltr" />
              </div>
            </div>
          </div>

          {/* ── Variants/Models ── */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">الموديلات/الأنواع</h3>
              <button onClick={addVariant} className="text-xs bg-blue-50 text-blue-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">+ إضافة موديل</button>
            </div>
            {variants.length > 0 && (
              <div className="space-y-3">
                {variants.map(v => (
                  <div key={v.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">اسم الموديل (عربي)</label>
                        <input value={v.name} onChange={e => updateVariant(v.id, { name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400" placeholder="مثل: أحمر كبير" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">اسم الموديل (إنجليزي)</label>
                        <input value={v.nameEn} onChange={e => updateVariant(v.id, { nameEn: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400" placeholder="e.g. Red Large" dir="ltr" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        صورة الموديل
                        {v.imageIndex >= 0 && <span className="text-blue-600 font-normal mr-1">(الصورة {v.imageIndex + 1})</span>}
                      </label>
                      {formImages.length === 0 ? (
                        <p className="text-xs text-gray-400">أضف صوراً للمنتج أولاً</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => updateVariant(v.id, { imageIndex: -1 })}
                            title="بدون صورة"
                            className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-lg transition ${v.imageIndex === -1 ? 'border-gray-500 bg-gray-100' : 'border-gray-200 hover:border-gray-400'}`}
                          >
                            ✕
                          </button>
                          {formImages.map((img, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => updateVariant(v.id, { imageIndex: idx })}
                              title={`الصورة ${idx + 1}`}
                              className={`relative w-12 h-12 rounded-lg border-2 overflow-hidden transition ${v.imageIndex === idx ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-400'}`}
                            >
                              <img src={img} alt="" className="w-full h-full object-cover" />
                              {v.imageIndex === idx && (
                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center">✓</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeVariant(v.id)} className="text-xs text-red-600 font-semibold hover:bg-red-50 px-3 py-1.5 rounded-lg transition">حذف الموديل</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Submit ── */}
          <div className="flex gap-3 pt-4 border-t border-gray-100 sticky bottom-0 bg-white">
            <button onClick={handleSubmit} disabled={saving} className="bg-[#1a1a2e] text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-[#2a2a4e] transition disabled:opacity-50">
              {saving ? 'جارٍ الحفظ...' : '💾 حفظ المنتج'}
            </button>
            <button onClick={resetForm} className="border border-gray-200 text-gray-600 font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">إلغاء</button>
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
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">جارٍ تحميل المنتجات...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">لا توجد منتجات</td></tr>
              ) : products.map(p => (
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
                    <div className="flex flex-col items-center gap-1">
                      <button
                        dir="ltr"
                        onClick={() => toggleStock(p)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${p.inStock ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${p.inStock ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </button>
                      <span className={`text-[9px] font-bold ${p.inStock ? 'text-green-600' : 'text-gray-400'}`}>{p.inStock ? 'متوفر' : 'نفذ'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => startEdit(p)} className="flex items-center gap-1 bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-100 transition">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                        تعديل
                      </button>
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
