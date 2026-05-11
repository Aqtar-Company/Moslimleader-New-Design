'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/ui/Toast';
import type { Product } from '@/types';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '201003414003';

// ─── Lead Form Modal ──────────────────────────────────────────────────────────

interface LeadFormProps {
  products: Product[];
  defaultProductId?: string;
  defaultProductName?: string;
  onClose: () => void;
}

const CITIES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'المنوفية',
  'الغربية', 'كفر الشيخ', 'البحيرة', 'الدقهلية', 'دمياط', 'بور سعيد',
  'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد',
  'مطروح', 'شمال سيناء', 'جنوب سيناء', 'خارج مصر',
];

function LeadFormModal({ products, defaultProductId, defaultProductName, onClose }: LeadFormProps) {
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [productName, setProductName] = useState(defaultProductName || '');
  const [productId, setProductId] = useState(defaultProductId || '');
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

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white';

  if (done) {
    return (
      <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center" dir="rtl">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-black text-gray-900 mb-2">تم استلام طلبك!</h3>
          <p className="text-gray-500 text-sm mb-6">هنتواصل معاك في أقرب وقت على رقم <strong>{phone}</strong></p>
          <button
            onClick={onClose}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition"
          >
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
              <input
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className={`${inp} mt-2`}
                placeholder="أو اكتب اسم المنتج"
              />
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">ملاحظات (اختياري)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${inp} resize-none`} rows={2} placeholder="أي تفاصيل إضافية..." />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black py-3.5 rounded-xl text-base transition mt-1"
          >
            {submitting ? '...جاري الإرسال' : 'أرسل طلبي'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Product Image Carousel ───────────────────────────────────────────────────

function ImageCarousel({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const imgs = images.length > 0 ? images : ['/placeholder-product.jpg'];

  return (
    <div className="relative w-full bg-gray-50" style={{ height: '52vmin', maxHeight: 360, minHeight: 220 }}>
      <Image
        src={imgs[idx]}
        alt={name}
        fill
        sizes="100vw"
        className="object-contain"
        priority={false}
        unoptimized={imgs[idx].startsWith('http')}
      />
      {imgs.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + imgs.length) % imgs.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 shadow flex items-center justify-center text-gray-700 text-lg hover:bg-white transition z-10"
            aria-label="السابق"
          >‹</button>
          <button
            onClick={() => setIdx(i => (i + 1) % imgs.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 shadow flex items-center justify-center text-gray-700 text-lg hover:bg-white transition z-10"
            aria-label="التالي"
          >›</button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {imgs.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all duration-300 ${i === idx ? 'w-5 h-2 bg-emerald-500' : 'w-2 h-2 bg-gray-300'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Single Product Card ──────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product;
  index: number;
  total: number;
  onOrderNow: (product: Product) => void;
}

function CatalogProductCard({ product, index, total, onOrderNow }: ProductCardProps) {
  const { addItem } = useCart();
  const { addToast } = useToast();
  const [adding, setAdding] = useState(false);

  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const images = Array.isArray(product.images) ? product.images : [];

  const waMsg = encodeURIComponent(`السلام عليكم، أريد الاستفسار عن: ${product.name}`);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}`;

  const handleAddToCart = async () => {
    if (hasVariants) {
      window.location.href = `/shop/${product.slug}`;
      return;
    }
    setAdding(true);
    try {
      await addItem(product, 1);
      addToast(`تمت إضافة "${product.name}" للسلة`, 'success');
    } catch {
      addToast('حدث خطأ، حاول مرة أخرى', 'error');
    }
    setAdding(false);
  };

  return (
    <div
      className="flex-shrink-0 w-full snap-start flex flex-col bg-white border-b-4 border-gray-100"
      style={{ minHeight: '100svh' }}
      dir="rtl"
    >
      {/* Counter */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[11px] font-bold text-gray-400 tracking-wide">
          {index + 1} / {total}
        </span>
        {!product.inStock && (
          <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
            غير متاح
          </span>
        )}
      </div>

      {/* Image */}
      <ImageCarousel images={images} name={product.name} />

      {/* Info */}
      <div className="flex-1 flex flex-col px-5 pt-4 pb-3 gap-2">
        <h2 className="text-xl font-black text-gray-900 leading-snug">{product.name}</h2>

        {product.shortDescription && (
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{product.shortDescription}</p>
        )}

        {/* Tags */}
        {Array.isArray(product.tags) && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {(product.tags as string[]).slice(0, 4).map(tag => (
              <span key={tag} className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center gap-3 mt-auto pt-2">
          <span className="text-2xl font-black text-emerald-600">{product.price.toLocaleString('ar-EG')} ج.م</span>
          {hasVariants && (
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">متعدد الألوان</span>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={handleAddToCart}
            disabled={adding || !product.inStock}
            className="col-span-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2"
          >
            <span>🛒</span>
            {adding ? 'جاري الإضافة...' : hasVariants ? 'اختر الموديل' : 'أضف للسلة'}
          </button>

          <Link
            href={`/shop/${product.slug}`}
            className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 rounded-xl text-sm transition"
          >
            <span>🛍️</span> اطلب الآن
          </Link>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold py-2.5 rounded-xl text-sm transition"
          >
            <span>💬</span> واتساب
          </a>
        </div>

        <button
          onClick={() => onOrderNow(product)}
          className="w-full mt-1 border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold py-2.5 rounded-xl text-sm transition"
        >
          اطلبهولي — بدون إنترنت
        </button>
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
    <div className="min-h-screen bg-gray-50" dir="rtl">
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
          <button
            onClick={() => openLead()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
          >
            اطلبهولي
          </button>
        </div>
      </header>

      {/* Product list — vertical snap scroll */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="text-5xl mb-4">📦</div>
          <p className="text-gray-500 font-medium">لا توجد منتجات متاحة حالياً</p>
        </div>
      ) : (
        <div
          className="overflow-y-auto snap-y snap-mandatory"
          style={{ height: 'calc(100svh - 57px)' }}
        >
          {products.map((product, i) => (
            <CatalogProductCard
              key={product.id}
              product={product}
              index={i}
              total={products.length}
              onOrderNow={openLead}
            />
          ))}

          {/* End CTA */}
          <div
            className="snap-start flex flex-col items-center justify-center text-center px-8 bg-gradient-to-b from-white to-emerald-50"
            style={{ minHeight: '100svh' }}
          >
            <div className="text-6xl mb-5">🌙</div>
            <h3 className="text-2xl font-black text-gray-900 mb-3">هل أعجبك شيء؟</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">تواصل معنا مباشرة أو اطلب من الموقع وهنوصله لبيتك</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => openLead()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl text-base transition shadow-lg shadow-emerald-200"
              >
                اطلبهولي
              </button>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-4 rounded-2xl text-base transition flex items-center justify-center gap-2 shadow-lg shadow-green-200"
              >
                💬 تواصل على واتساب
              </a>
              <Link
                href="/"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-2xl text-sm transition"
              >
                تصفح المتجر الكامل
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Floating lead button (always visible) */}
      {products.length > 0 && (
        <button
          onClick={() => openLead()}
          className="fixed bottom-5 left-4 z-50 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black px-5 py-3 rounded-2xl shadow-xl shadow-emerald-300/50 transition flex items-center gap-2"
        >
          <span>📝</span> اطلبهولي
        </button>
      )}

      {/* Lead Form Modal */}
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
