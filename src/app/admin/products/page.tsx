'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getProductOverrides, setProductOverride, getAddedProducts,
  addProduct, deleteAddedProduct, saveAddedProducts, updateAddedProduct,
  getAddedCategories, saveAddedCategories, applyOverride, ProductOverride,
} from '@/lib/admin-storage';
import { products as staticProducts, categories as staticCategories } from '@/lib/products';
import { Product, ProductVariant } from '@/types';

interface VariantDraft {
  id: string;
  name: string;
  nameEn: string;
  imageIndex: number;
}

type MergedProduct = Product & { isAdded?: boolean };

function mergeProducts(overrides: Record<string, ProductOverride>, added: Product[]): MergedProduct[] {
  const base = staticProducts.map(p => ({
    ...(overrides[p.id] ? applyOverride(p, overrides[p.id]) : p),
  }));
  return [...base, ...added.map(p => ({ ...p, isAdded: true }))];
}

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
  description: '', descriptionEn: '', price: 0, category: '',
  tags: [] as string[], images: [] as string[], inStock: true, featured: false, weight: 0,
};

export default function ProductsPage() {
  const [overrides, setOverrides] = useState<Record<string, ProductOverride>>({});
  const [added, setAdded] = useState<Product[]>([]);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceVal, setPriceVal] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formTags, setFormTags] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addedCats, setAddedCats] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState('');

  const load = useCallback(() => {
    setOverrides(getProductOverrides());
    setAdded(getAddedProducts());
    setAddedCats(getAddedCategories());
  }, []);

  useEffect(() => { load(); }, [load]);

  const products = mergeProducts(overrides, added);

  const allCategoryNames = [
    ...staticCategories.filter(c => c.id !== 'all').map(c => c.name),
    ...addedCats,
  ];

  // ─── Image upload ─────────────────────────────────────────────────────────────

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

  // ─── Table actions ────────────────────────────────────────────────────────────

  const toggleStock = (p: MergedProduct) => {
    if (p.isAdded) {
      const updated = added.map(a => a.id === p.id ? { ...a, inStock: !a.inStock } : a);
      setAdded(updated);
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

  // ─── Edit ──────────────────────────────────────────────────────────────────────

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
      category: p.category,
      tags: p.tags,
      images: p.images,
      inStock: p.inStock,
      featured: p.featured ?? false,
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

  // ─── Variants helpers ─────────────────────────────────────────────────────────

  const addVariant = () => setVariants(v => [...v, { id: `v-${Date.now()}`, name: '', nameEn: '', imageIndex: -1 }]);
  const updateVariant = (id: string, patch: Partial<VariantDraft>) => setVariants(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
  const removeVariant = (id: string) => setVariants(v => v.filter(x => x.id !== id));

  // ─── Form helpers ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormTags('');
    setFormImages([]);
    setVariants([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
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

    if (editingId) {
      const isAdded = added.some(a => a.id === editingId);
      const data: Partial<Product> = {
        slug: form.slug,
        name: form.name,
        nameEn: form.nameEn || undefined,
        shortDescription: form.shortDescription,
        shortDescriptionEn: form.shortDescriptionEn || undefined,
        description: form.description,
        descriptionEn: form.descriptionEn || undefined,
        price: form.price,
        category: form.category,
        inStock: form.inStock,
        featured: form.featured,
        weight: form.weight,
        tags: parsedTags,
        images: formImages,
        variants: builtVariants.length > 0 ? builtVariants : undefined,
      };
      if (isAdded) {
        updateAddedProduct(editingId, data);
      } else {
        setProductOverride(editingId, data);
      }
    } else {
      addProduct({
        id: `added-${Date.now()}`,
        slug: form.slug,
        name: form.name,
        nameEn: form.nameEn || undefined,
        shortDescription: form.shortDescription,
        shortDescriptionEn: form.shortDescriptionEn || undefined,
        description: form.description,
        descriptionEn: form.descriptionEn || undefined,
        price: form.price,
        category: form.category,
        inStock: form.inStock,
        featured: form.featured,
        weight: form.weight,
        tags: parsedTags,
        images: formImages,
        variants: builtVariants.length > 0 ? builtVariants : undefined,
        reviews: [],
      });
    }

    resetForm();
    setSaving(false);
    load();
  };

  // ─── Category management ──────────────────────────────────────────────────────

  const addCategory = () => {
    const name = newCatInput.trim();
    if (!name || addedCats.includes(name)) return;
    const updated = [...addedCats, name];
    setAddedCats(updated);
    saveAddedCategories(updated);
    setNewCatInput('');
  };

  const deleteCategory = (cat: string) => {
    const updated = addedCats.filter(c => c !== cat);
    setAddedCats(updated);
    saveAddedCategories(updated);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">المنتجات</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} منتج</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
          >
            <span>+</span> إضافة منتج
          </button>
        )}
      </div>

      {/* ── Category management ── */}
      {!showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-700">فئات مضافة</h3>
          <div className="flex gap-2 flex-wrap">
            {addedCats.length === 0 ? (
              <p className="text-xs text-gray-400">لا توجد فئات مضافة بعد</p>
            ) : (
              addedCats.map(cat => (
                <span key={cat} className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-full text-xs font-semibold">
                  {cat}
                  <button
                    onClick={() => deleteCategory(cat)}
                    className="text-amber-400 hover:text-red-500 font-bold mr-1"
                  >
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={newCatInput}
              onChange={e => setNewCatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="اسم الفئة الجديدة..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
            />
            <button
              onClick={addCategory}
              className="bg-[#1a1a2e] text-white font-bold px-4 py-2 rounded-xl text-sm hover:bg-[#2a2a4e] transition"
            >
              + إضافة
            </button>
          </div>
        </div>
      )}

      {/* ── Add / Edit product form ── */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-base">
              {editingId ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>

          {/* ── Image dropzone ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              الصور * <span className="text-gray-400 font-normal">(حتى 8 صور — الأولى هي الرئيسية)</span>
            </label>

            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition select-none ${
                isDragging
                  ? 'border-[#F5C518] bg-amber-50'
                  : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <div className="text-3xl mb-2">🖼️</div>
              <p className="font-semibold text-gray-700 text-sm">اسحب الصور هنا أو اضغط للاختيار</p>
              <p className="text-xs text-gray-400 mt-1">PNG، JPG، WEBP — حتى 8 صور</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {formImages.length > 0 && (
              <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                {formImages.map((src, idx) => (
                  <div key={idx} className="relative group aspect-square">
                    <img
                      src={src}
                      alt={`صورة ${idx + 1}`}
                      className="w-full h-full object-cover rounded-xl border border-gray-200"
                    />
                    <span className="absolute top-1 right-1 bg-black/60 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                      {idx > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); moveImage(idx, idx - 1); }}
                          className="w-6 h-6 bg-white/90 rounded-full text-xs font-bold text-gray-800 hover:bg-white"
                        >›</button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); removeImage(idx); }}
                        className="w-6 h-6 bg-red-500 rounded-full text-white text-xs font-bold hover:bg-red-600"
                      >✕</button>
                      {idx < formImages.length - 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); moveImage(idx, idx + 1); }}
                          className="w-6 h-6 bg-white/90 rounded-full text-xs font-bold text-gray-800 hover:bg-white"
                        >‹</button>
                      )}
                    </div>
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold text-white bg-[#F5C518]/90 py-0.5">رئيسية</span>
                    )}
                  </div>
                ))}
                {formImages.length < 8 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition text-2xl"
                  >+</button>
                )}
              </div>
            )}
          </div>

          {/* ── Variants ── */}
          {formImages.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-semibold text-gray-600">
                  الموديلات / الألوان
                  <span className="text-gray-400 font-normal mr-1">(اختياري)</span>
                </label>
                <button
                  type="button"
                  onClick={addVariant}
                  className="text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg transition"
                >
                  + إضافة موديل
                </button>
              </div>

              {variants.length > 0 ? (
                <div className="space-y-3">
                  {variants.map((v, idx) => (
                    <div key={v.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 w-16 shrink-0">موديل {idx + 1}</span>
                        <input
                          value={v.name}
                          onChange={e => updateVariant(v.id, { name: e.target.value })}
                          placeholder="الاسم (عربي)"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400 bg-white"
                        />
                        <input
                          value={v.nameEn}
                          onChange={e => updateVariant(v.id, { nameEn: e.target.value })}
                          placeholder="English name"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400 bg-white"
                          dir="ltr"
                        />
                        <button
                          onClick={() => removeVariant(v.id)}
                          className="text-red-400 hover:text-red-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition text-sm"
                        >✕</button>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">اختر صورة هذا الموديل:</p>
                        <div className="flex gap-2 flex-wrap">
                          {formImages.map((src, imgIdx) => (
                            <button
                              key={imgIdx}
                              type="button"
                              onClick={() => updateVariant(v.id, { imageIndex: imgIdx })}
                              className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition ${
                                v.imageIndex === imgIdx
                                  ? 'border-purple-500 ring-2 ring-purple-300'
                                  : 'border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              <img src={src} alt="" className="w-full h-full object-cover" />
                              {v.imageIndex === imgIdx && (
                                <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                                  <span className="text-white text-sm font-black">✓</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                        {v.imageIndex < 0 && <p className="text-amber-600 text-xs mt-1">* اختر صورة للموديل</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-3 text-center">
                  لو المنتج منه ألوان أو أشكال مختلفة — اضغط &quot;إضافة موديل&quot;
                </p>
              )}
            </div>
          )}

          {/* ── Fields grid ── */}
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
                onChange={e => {
                  const nameEn = e.target.value;
                  setForm(f => ({
                    ...f,
                    nameEn,
                    slug: f.slug === '' ? nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : f.slug,
                  }));
                }}
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
                placeholder="product-name"
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
              <label className="block text-xs font-semibold text-gray-600 mb-1">السعر (EGP) *</label>
              <input
                type="number"
                value={form.price || ''}
                onChange={e => setForm(f => ({ ...f, price: +e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                min="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">الوزن (جرام)</label>
              <input
                type="number"
                value={form.weight || ''}
                onChange={e => setForm(f => ({ ...f, weight: +e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                min="0"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف المختصر (عربي)</label>
              <input
                value={form.shortDescription}
                onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف المختصر (إنجليزي)</label>
              <input
                value={form.shortDescriptionEn || ''}
                onChange={e => setForm(f => ({ ...f, shortDescriptionEn: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                dir="ltr"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">الوصف الكامل (عربي — HTML مسموح)</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tags (مفصولة بفاصلة)</label>
              <input
                value={formTags}
                onChange={e => setFormTags(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                placeholder="لعبة, أطفال, تعليمي"
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.inStock}
                  onChange={e => setForm(f => ({ ...f, inStock: e.target.checked }))}
                  className="w-4 h-4 accent-[#F5C518]"
                />
                <span className="text-sm font-semibold text-gray-700">متوفر في المخزن</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured || false}
                  onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))}
                  className="w-4 h-4 accent-[#F5C518]"
                />
                <span className="text-sm font-semibold text-gray-700">منتج مميز ⭐</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-1 border-t border-gray-100">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-[#1a1a2e] text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-[#2a2a4e] transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> جارٍ الحفظ...</>
              ) : (
                editingId ? '💾 حفظ التعديلات' : '💾 حفظ المنتج'
              )}
            </button>
            <button
              onClick={resetForm}
              className="border border-gray-200 text-gray-600 font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── Products table ── */}
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
                        {(p as MergedProduct).isAdded && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold">مضاف</span>
                        )}
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
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-blue-500 hover:text-blue-700 text-xs font-bold transition hover:bg-blue-50 px-2 py-1 rounded-lg"
                      >
                        تعديل
                      </button>
                      {(p as MergedProduct).isAdded && (
                        <button
                          onClick={() => handleDelete(p)}
                          className="text-red-400 hover:text-red-600 text-xs font-bold transition hover:bg-red-50 px-2 py-1 rounded-lg"
                        >
                          حذف
                        </button>
                      )}
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
