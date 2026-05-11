'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/ui/Toast';
import { useLang } from '@/context/LanguageContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { sanitizeHtml } from '@/lib/sanitize';
import type { Product, ProductVariant } from '@/types';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '201003414003';

const MODEL_CATEGORIES = ['مجات', 'مفكرات'];
const MODEL_SLUGS_WITH_COVER = ['masek', 'ml-pin'];
const MODEL_SLUGS_NO_COVER = ['ml-bag'];

// ─── Lead Form Modal ──────────────────────────────────────────────────────────

const CITIES = [
  'القاهرة','الجيزة','الإسكندرية','القليوبية','الشرقية','المنوفية','الغربية',
  'كفر الشيخ','البحيرة','الدقهلية','دمياط','بور سعيد','الإسماعيلية','السويس',
  'الفيوم','بني سويف','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان',
  'البحر الأحمر','الوادي الجديد','مطروح','شمال سيناء','جنوب سيناء','خارج مصر',
];

interface LeadFormProps {
  products: Product[];
  defaultProductId?: string;
  defaultProductName?: string;
  onClose: () => void;
}

function LeadFormModal({ products, defaultProductId, defaultProductName, onClose }: LeadFormProps) {
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [productId, setProductId] = useState(defaultProductId || '');
  const [productName, setProductName] = useState(defaultProductName || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleProductChange = (pid: string) => {
    setProductId(pid);
    const p = products.find(p => p.id === pid);
    setProductName(p ? p.name : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !city || !productName.trim()) {
      addToast('الرجاء ملء جميع الحقول المطلوبة', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/catalog-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, city, productId: productId || null, productName, notes }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      addToast('حدث خطأ، حاول مرة أخرى', 'error');
    }
    setSubmitting(false);
  };

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white';

  if (done) {
    return (
      <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center" dir="rtl">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-black text-gray-900 mb-2">تم استلام طلبك!</h3>
          <p className="text-gray-500 text-sm mb-6">هنتواصل معاك في أقرب وقت على رقم <strong>{phone}</strong></p>
          <button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition">
            حسناً
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-emerald-600 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-black text-base">اطلبهولي</h3>
            <p className="text-emerald-100 text-xs mt-0.5">هنتواصل معاك ونكمل الطلب</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">الاسم <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="اسمك الكريم" required />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">رقم الهاتف <span className="text-red-500">*</span></label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className={inp} placeholder="01xxxxxxxxx" type="tel" required />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">المحافظة / المدينة <span className="text-red-500">*</span></label>
            <select value={city} onChange={e => setCity(e.target.value)} className={inp} required>
              <option value="">اختر محافظتك</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">المنتج المطلوب <span className="text-red-500">*</span></label>
            <select value={productId} onChange={e => handleProductChange(e.target.value)} className={inp}>
              <option value="">اختر منتجاً</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!productId && (
              <input value={productName} onChange={e => setProductName(e.target.value)} className={`${inp} mt-2`} placeholder="أو اكتب اسم المنتج" />
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">ملاحظات (اختياري)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${inp} resize-none`} rows={2} placeholder="أي تفاصيل إضافية..." />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black py-3.5 rounded-xl text-base transition mt-1">
            {submitting ? '...جاري الإرسال' : 'أرسل طلبي'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Single Product Section (mirrors ProductDetailClient layout) ──────────────

interface SectionProps {
  product: Product;
  index: number;
  total: number;
  onOrderNow: (product: Product) => void;
}

function CatalogProductSection({ product, index, total, onOrderNow }: SectionProps) {
  const [mainImg, setMainImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<number | undefined>(undefined);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  const { addItem } = useCart();
  const { addToast } = useToast();
  const { t, isRtl } = useLang();
  const { getProductPrice, formatPrice } = useRegionalPricing();

  const priceResult = getProductPrice(product);
  const hasVariants = !!(product.variants && product.variants.length > 0);
  const needsLegacyModel = !hasVariants && (
    MODEL_CATEGORIES.includes(product.category) ||
    MODEL_SLUGS_WITH_COVER.includes(product.slug) ||
    MODEL_SLUGS_NO_COVER.includes(product.slug)
  );
  const needsModel = hasVariants || needsLegacyModel;
  const modelOffset = MODEL_SLUGS_NO_COVER.includes(product.slug) ? 0 : 1;
  const modelImages = needsLegacyModel ? product.images.slice(modelOffset) : [];

  const displayName = isRtl ? product.name : (product.nameEn || product.name);
  const displayShortDesc = isRtl ? product.shortDescription : (product.shortDescriptionEn || product.shortDescription);
  const displayDescription = isRtl ? product.description : (product.descriptionEn || product.description);

  const waMsg = encodeURIComponent(`السلام عليكم، أريد الاستفسار عن: ${product.name}`);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}`;

  function handleAdd() {
    if (hasVariants && !selectedVariant) return;
    if (needsLegacyModel && selectedModel === undefined) return;
    const modelIdx = hasVariants ? selectedVariant!.imageIndex : selectedModel;
    addItem(product, modelIdx, qty);
    setAdded(true);
    setSelectedVariant(null);
    setSelectedModel(undefined);
    setQty(1);
    addToast(`تمت إضافة "${displayName}" للسلة`, 'success');
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="bg-white border-b-8 border-gray-100">
      {/* Product counter bar */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-400 font-bold">{index + 1} / {total}</span>
        <Link href={`/shop/${product.slug}`} className="text-xs text-purple-600 font-bold hover:underline">
          صفحة المنتج ←
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">

          {/* ── Images column ── */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
              <Image
                src={product.images[mainImg] ?? '/placeholder-product.jpg'}
                alt={displayName}
                fill
                className="object-contain p-4"
                unoptimized
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {!product.inStock && (
                <div className="absolute top-3 right-3 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {t('product.outOfStock')}
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <button key={i} onClick={() => setMainImg(i)}
                    className={`relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition ${
                      mainImg === i ? 'border-[#F5C518]' : 'border-gray-200 hover:border-gray-400'
                    }`}>
                    <Image src={img} alt="" fill className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info column ── */}
          <div className="flex flex-col gap-4">
            {/* Category badge */}
            <div>
              <span className="bg-[#FFF9E6] text-[#9a7b00] text-xs font-bold px-3 py-1 rounded-full">
                {t(`cat.${product.category}` as Parameters<typeof t>[0])}
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight">
              {displayName}
            </h2>

            <p className="text-gray-500">{displayShortDesc}</p>

            {/* Price */}
            <div className="text-3xl font-black text-gray-900">
              {formatPrice(priceResult)}
            </div>

            {/* Stock */}
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${product.inStock ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className={`text-sm font-semibold ${product.inStock ? 'text-green-600' : 'text-red-500'}`}>
                {product.inStock ? t('product.inStock') : t('product.outOfStock')}
              </span>
            </div>

            {/* Named variants */}
            {hasVariants && product.variants && (
              <div>
                <p className="text-sm font-bold text-gray-700 mb-2">
                  {isRtl ? 'اختر الموديل' : 'Select Model'}
                  {selectedVariant && (
                    <span className="text-purple-700 mr-2 ml-2 font-normal">
                      — {isRtl ? selectedVariant.name : (selectedVariant.nameEn || selectedVariant.name)}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map(v => (
                    <button key={v.id}
                      onClick={() => { setSelectedVariant(v); if (v.imageIndex >= 0) setMainImg(v.imageIndex); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition ${
                        selectedVariant?.id === v.id
                          ? 'border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-gray-400 text-gray-700'
                      }`}>
                      {v.imageIndex >= 0 && product.images[v.imageIndex] && (
                        <span className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                          <Image src={product.images[v.imageIndex]} alt={v.name} fill className="object-cover" unoptimized />
                        </span>
                      )}
                      <span className="text-sm font-bold">
                        {isRtl ? v.name : (v.nameEn || v.name)}
                      </span>
                    </button>
                  ))}
                </div>
                {!selectedVariant && (
                  <p className="text-amber-600 text-xs mt-1.5 font-semibold">
                    {isRtl ? '* يرجى اختيار الموديل أولاً' : '* Please select a model first'}
                  </p>
                )}
              </div>
            )}

            {/* Legacy model selector */}
            {needsLegacyModel && modelImages.length > 0 && (
              <div>
                <p className="text-sm font-bold text-gray-700 mb-2">
                  {isRtl ? 'اختر الموديل' : 'Select Model'}
                  {selectedModel !== undefined && (
                    <span className="text-purple-700 mr-2 ml-2">
                      — {isRtl ? `موديل ${selectedModel - modelOffset + 1}` : `Model ${selectedModel - modelOffset + 1}`}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {modelImages.map((img, i) => {
                    const imgIdx = i + modelOffset;
                    return (
                      <button key={i}
                        onClick={() => { setSelectedModel(imgIdx); setMainImg(imgIdx); }}
                        className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                          selectedModel === imgIdx ? 'border-purple-600 ring-2 ring-purple-300' : 'border-gray-200 hover:border-gray-400'
                        }`}>
                        <Image src={img} alt={`Model ${i + 1}`} fill className="object-cover" unoptimized />
                      </button>
                    );
                  })}
                </div>
                {selectedModel === undefined && (
                  <p className="text-amber-600 text-xs mt-1.5 font-semibold">
                    {isRtl ? '* يرجى اختيار الموديل أولاً' : '* Please select a model first'}
                  </p>
                )}
              </div>
            )}

            {/* Qty + Add to cart */}
            {product.inStock && (
              <div className="flex items-center gap-3">
                <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-gray-100 transition">−</button>
                  <span className="w-10 text-center font-bold">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-gray-100 transition">+</button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={(hasVariants && !selectedVariant) || (needsLegacyModel && selectedModel === undefined)}
                  className={`relative flex-1 font-bold py-3 px-6 rounded-xl transition-all duration-300 text-center flex items-center justify-center gap-2 overflow-hidden ${
                    added
                      ? 'bg-green-500 text-white scale-95 ring-4 ring-green-300 shadow-lg shadow-green-200'
                      : (hasVariants && !selectedVariant) || (needsLegacyModel && selectedModel === undefined)
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-700 hover:bg-purple-800 text-white active:scale-95 hover:shadow-md hover:shadow-purple-300'
                  }`}>
                  {added && <span className="absolute inset-0 rounded-xl animate-ping bg-green-400 opacity-30 pointer-events-none" />}
                  {added ? (
                    <>
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {t('product.added')}
                    </>
                  ) : t('product.addToCart')}
                </button>
              </div>
            )}

            {/* Weight */}
            {product.weight > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                <span>{isRtl ? 'الوزن:' : 'Weight:'} <strong className="text-gray-700">{product.weight}g</strong></span>
              </div>
            )}

            {/* Intro video */}
            {product.videoUrl && (
              <div className="mt-2">
                <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  {isRtl ? 'فيديو تعريفي' : 'Intro Video'}
                </p>
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-md border border-gray-100">
                  <iframe
                    src={product.videoUrl.includes('youtube.com/watch?v=')
                      ? `https://www.youtube.com/embed/${product.videoUrl.split('v=')[1].split('&')[0]}`
                      : product.videoUrl.includes('youtu.be/')
                      ? `https://www.youtube.com/embed/${product.videoUrl.split('youtu.be/')[1].split('?')[0]}`
                      : product.videoUrl}
                    title={displayName}
                    className="absolute inset-0 w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <div
              className="product-description border-t pt-4 mt-1 text-sm leading-relaxed text-gray-700"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayDescription) }}
            />

            {/* Tags */}
            {Array.isArray(product.tags) && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(product.tags as string[]).map(tag => (
                  <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                    #{t(`tag.${tag}` as Parameters<typeof t>[0])}
                  </span>
                ))}
              </div>
            )}

            {/* CTA row */}
            <div className="border-t pt-4 mt-1 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/shop/${product.slug}`}
                  className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl text-sm transition">
                  🛍️ اطلب الآن
                </Link>
                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold py-3 rounded-xl text-sm transition">
                  💬 واتساب
                </a>
              </div>
              <button
                onClick={() => onOrderNow(product)}
                className="w-full border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold py-2.5 rounded-xl text-sm transition">
                📝 اطلبهولي — بدون إنترنت
              </button>
            </div>
          </div>
        </div>

        {/* Extra videos */}
        {Array.isArray(product.videos) && product.videos.length > 0 && (
          <div className="mt-10 border-t border-gray-100 pt-8">
            <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </span>
              {isRtl ? 'فيديوهات المنتج' : 'Product Videos'}
            </h3>
            <div className={`grid gap-4 ${product.videos.length === 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-1 md:grid-cols-2'}`}>
              {product.videos.map((vid, i) => (
                <div key={vid} className="rounded-2xl overflow-hidden bg-black aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${vid}`}
                    title={`${displayName} ${i + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen className="w-full h-full border-0"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Catalog ─────────────────────────────────────────────────────────────

export default function CatalogClient({ products }: { products: Product[] }) {
  const [leadTarget, setLeadTarget] = useState<Product | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);

  const openLead = useCallback((product?: Product) => {
    setLeadTarget(product ?? null);
    setLeadOpen(true);
  }, []);

  const closeLead = useCallback(() => {
    setLeadOpen(false);
    setLeadTarget(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <div>
              <p className="text-sm font-black text-gray-900 leading-tight">كتالوج مسلم ليدر</p>
              <p className="text-[10px] text-gray-400">{products.length} منتج</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs text-gray-500 hover:text-gray-800 font-medium hidden sm:block">المتجر</Link>
            <button
              onClick={() => openLead()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              📝 اطلبهولي
            </button>
          </div>
        </div>
      </header>

      {/* Products */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="text-5xl mb-4">📦</div>
          <p className="text-gray-500 font-medium">لا توجد منتجات متاحة حالياً</p>
        </div>
      ) : (
        <>
          {products.map((product, i) => (
            <CatalogProductSection
              key={product.id}
              product={product}
              index={i}
              total={products.length}
              onOrderNow={openLead}
            />
          ))}

          {/* End CTA */}
          <div className="flex flex-col items-center justify-center text-center px-8 py-20 bg-gradient-to-b from-white to-emerald-50">
            <div className="text-6xl mb-5">🌙</div>
            <h3 className="text-2xl font-black text-gray-900 mb-3">هل أعجبك شيء؟</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">تواصل معنا مباشرة أو اطلب من الموقع وهنوصله لبيتك</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => openLead()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl text-base transition shadow-lg shadow-emerald-200">
                📝 اطلبهولي
              </button>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer"
                className="bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-4 rounded-2xl text-base transition flex items-center justify-center gap-2">
                💬 تواصل على واتساب
              </a>
              <Link href="/"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-2xl text-sm transition">
                تصفح المتجر الكامل
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Floating button */}
      {products.length > 0 && (
        <button
          onClick={() => openLead()}
          className="fixed bottom-5 left-4 z-50 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black px-5 py-3 rounded-2xl shadow-xl shadow-emerald-300/50 transition flex items-center gap-2"
        >
          📝 اطلبهولي
        </button>
      )}

      {leadOpen && (
        <LeadFormModal
          products={products}
          defaultProductId={leadTarget?.id}
          defaultProductName={leadTarget?.name}
          onClose={closeLead}
        />
      )}
    </div>
  );
}
