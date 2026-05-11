'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { useLang } from '@/context/LanguageContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { sanitizeHtml } from '@/lib/sanitize';
import type { Product } from '@/types';

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '201003414003';
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';

const CITIES = [
  'القاهرة','الجيزة','الإسكندرية','القليوبية','الشرقية','المنوفية','الغربية',
  'كفر الشيخ','البحيرة','الدقهلية','دمياط','بور سعيد','الإسماعيلية','السويس',
  'الفيوم','بني سويف','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان',
  'البحر الأحمر','الوادي الجديد','مطروح','شمال سيناء','جنوب سيناء','خارج مصر',
];

interface SelectedProduct { id: string; name: string; price: number; }

// ─── Print/PDF styles (injected once) ─────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  @page { size: A4 portrait; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .catalog-shell { position: static !important; overflow: visible !important; height: auto !important; }
  .catalog-sidebar { display: none !important; }
  .catalog-topbar { display: none !important; }
  .catalog-fab { display: none !important; }
  .catalog-no-print { display: none !important; }
  .catalog-page { page-break-after: always; page-break-inside: avoid; min-height: 297mm; box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
  .catalog-page:last-of-type { page-break-after: avoid; }
  .catalog-divider { display: none !important; }
  body { background: white !important; }
}
`;

// ─── Order Form Modal ──────────────────────────────────────────────────────────

interface OrderFormProps {
  products: Product[];
  selected: SelectedProduct[];
  onClose: () => void;
  onRemove: (id: string) => void;
}

function OrderFormModal({ products, selected, onClose, onRemove }: OrderFormProps) {
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518] bg-white';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !city) { addToast('الرجاء ملء جميع الحقول', 'warning'); return; }
    if (selected.length === 0) { addToast('اختر منتجاً على الأقل', 'warning'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/catalog-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, phone, city, notes,
          productName: selected.map(p => p.name).join('، '),
          productId: selected[0]?.id ?? null,
          selectedProducts: selected,
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch { addToast('حدث خطأ، حاول مرة أخرى', 'error'); }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full text-center" dir="rtl">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">وصل الطلب!</h3>
          <p className="text-gray-500 mb-2">هنتواصل معاك قريباً على</p>
          <p className="text-lg font-black text-[#1a1a2e] mb-8" dir="ltr">{phone}</p>
          <button onClick={onClose} className="w-full bg-[#1a1a2e] text-[#F5C518] font-black py-3.5 rounded-2xl text-base transition hover:bg-[#2a2a4e]">
            حسناً، شكراً
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a1a2e] px-6 py-5 flex items-center justify-between">
          <div>
            <h3 className="text-[#F5C518] font-black text-lg leading-tight">أرسل طلبك</h3>
            <p className="text-white/60 text-xs mt-0.5">{selected.length} منتج مختار</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition">×</button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {/* Selected products */}
          {selected.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-amber-700 text-sm font-bold">لم تختر أي منتج بعد</p>
              <p className="text-amber-500 text-xs mt-1">اضغط "اختر" على أي منتج في الكتالوج</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-500 uppercase tracking-wider">المنتجات المختارة</p>
              {selected.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-bold text-gray-800 flex-1">{p.name}</span>
                  <span className="text-xs text-gray-400 mx-3 font-medium">{p.price.toLocaleString('ar-EG')} ج.م</span>
                  <button onClick={() => onRemove(p.id)} className="text-red-400 hover:text-red-600 text-lg leading-none w-6 h-6 flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <div>
              <label className="text-xs font-black text-gray-600 mb-1 block">الاسم الكريم <span className="text-red-400">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="اسمك" required />
            </div>
            <div>
              <label className="text-xs font-black text-gray-600 mb-1 block">رقم الهاتف <span className="text-red-400">*</span></label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inp} placeholder="01xxxxxxxxx" type="tel" required />
            </div>
            <div>
              <label className="text-xs font-black text-gray-600 mb-1 block">المحافظة <span className="text-red-400">*</span></label>
              <select value={city} onChange={e => setCity(e.target.value)} className={inp} required>
                <option value="">اختر محافظتك</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-gray-600 mb-1 block">ملاحظات (اختياري)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${inp} resize-none`} rows={2} placeholder="كميات، مواصفات، أي تفاصيل..." />
            </div>
          </div>

          <button type="button" onClick={handleSubmit} disabled={submitting || selected.length === 0}
            className="w-full bg-[#F5C518] hover:bg-[#e0b010] disabled:opacity-50 text-[#1a1a2e] font-black py-4 rounded-2xl text-base transition shadow-lg shadow-yellow-200">
            {submitting ? '...جاري الإرسال' : 'أرسل الطلب'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Card (catalog style) ─────────────────────────────────────────────

interface CardProps {
  product: Product;
  index: number;
  total: number;
  isSelected: boolean;
  onToggle: (product: Product) => void;
}

function CatalogCard({ product, index, total, isSelected, onToggle }: CardProps) {
  const [mainImg, setMainImg] = useState(0);
  const { isRtl } = useLang();
  const { getProductPrice, formatPrice } = useRegionalPricing();
  const priceResult = getProductPrice(product);

  const name = isRtl ? product.name : (product.nameEn || product.name);
  const shortDesc = isRtl ? product.shortDescription : (product.shortDescriptionEn || product.shortDescription);
  const description = isRtl ? product.description : (product.descriptionEn || product.description);
  const imgs = Array.isArray(product.images) && product.images.length > 0 ? product.images : ['/placeholder.jpg'];

  return (
    <div
      id={`product-${product.id}`}
      className="catalog-page bg-white rounded-3xl shadow-md mx-3 lg:mx-8 my-4 overflow-hidden border border-gray-100"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Card top bar */}
      <div className="bg-[#1a1a2e] px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#F5C518] text-xs font-black">{index + 1}/{total}</span>
          <span className="text-white/40 text-xs">|</span>
          <span className="text-white/70 text-xs font-bold">{product.category}</span>
        </div>
        {!product.inStock && (
          <span className="text-xs bg-red-500/20 text-red-300 font-bold px-2 py-0.5 rounded-full">نفذ المخزون</span>
        )}
      </div>

      {/* Content: 3/5 image + 2/5 info */}
      <div className="grid grid-cols-1 lg:grid-cols-5">
        {/* Image */}
        <div className="lg:col-span-3 bg-gray-50 flex flex-col">
          <div className="relative aspect-square lg:aspect-auto lg:flex-1" style={{ minHeight: 280 }}>
            <Image
              src={imgs[mainImg]}
              alt={name}
              fill
              className="object-contain p-6"
              unoptimized
              loading="eager"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </div>
          {imgs.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto border-t border-gray-100 bg-white">
              {imgs.map((img, i) => (
                <button key={i} onClick={() => setMainImg(i)}
                  className={`relative w-14 h-14 shrink-0 rounded-xl overflow-hidden border-2 transition ${i === mainImg ? 'border-[#F5C518]' : 'border-gray-200 hover:border-gray-400'}`}>
                  <Image src={img} alt="" fill className="object-cover" unoptimized />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className={`lg:col-span-2 flex flex-col gap-4 p-6 ${isRtl ? 'border-r' : 'border-l'} border-gray-100`}>
          <h2 className="text-2xl font-black text-gray-900 leading-snug">{name}</h2>
          <p className="text-gray-500 text-sm leading-relaxed">{shortDesc}</p>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1a1a2e]">{formatPrice(priceResult)}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${product.inStock ? 'bg-emerald-500' : 'bg-red-400'}`} />
            <span className={`text-xs font-bold ${product.inStock ? 'text-emerald-600' : 'text-red-500'}`}>
              {product.inStock ? 'متوفر في المخزون' : 'غير متوفر حالياً'}
            </span>
          </div>

          {/* Description */}
          {description && (
            <div
              className="product-description text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4 flex-1 overflow-hidden"
              style={{ maxHeight: 200 }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }}
            />
          )}

          {/* Tags */}
          {Array.isArray(product.tags) && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(product.tags as string[]).slice(0, 5).map(tag => (
                <span key={tag} className="text-[10px] bg-[#FFF9E6] text-[#9a7b00] border border-yellow-200 px-2 py-0.5 rounded-full font-bold">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 mt-auto pt-2 catalog-no-print">
            <button
              onClick={() => onToggle(product)}
              className={`w-full font-black py-3 rounded-2xl text-sm transition flex items-center justify-center gap-2 border-2 ${
                isSelected
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200'
                  : 'bg-white border-[#1a1a2e] text-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-[#F5C518]'
              }`}
            >
              {isSelected ? (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> تم الاختيار</>
              ) : (
                <><span className="text-lg leading-none">+</span> اختر هذا المنتج</>
              )}
            </button>
            <Link href={`/shop/${product.slug}`} target="_blank"
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 font-medium transition py-1">
              عرض المنتج في المتجر ↗
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  products: Product[];
  selectedCount: number;
  onOrderClick: () => void;
  onPrint: () => void;
  scrollToId: (id: string) => void;
  activeId: string;
}

function CatalogSidebar({ products, selectedCount, onOrderClick, onPrint, scrollToId, activeId }: SidebarProps) {
  return (
    <aside className="catalog-sidebar w-56 shrink-0 flex flex-col bg-[#0f0f1e] border-l border-white/10">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <p className="text-[#F5C518] font-black text-base leading-tight">Moslim Leader</p>
        <p className="text-white/40 text-[10px] mt-0.5">كتالوج المنتجات</p>
      </div>

      {/* Product tabs */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        <button onClick={() => scrollToId('cover')}
          className={`w-full text-right px-4 py-2 text-xs font-bold transition flex items-center gap-2 rounded-lg mx-1 ${activeId === 'cover' ? 'text-[#F5C518] bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
          <span>🏠</span> الغلاف
        </button>

        <div className="px-3 pt-2 pb-1">
          <p className="text-white/30 text-[9px] font-black uppercase tracking-wider">المنتجات</p>
        </div>

        {products.map((p, i) => (
          <button key={p.id} onClick={() => scrollToId(`product-${p.id}`)}
            className={`w-full text-right px-4 py-2 text-xs transition flex items-center gap-2 rounded-lg mx-1 ${activeId === `product-${p.id}` ? 'text-[#F5C518] bg-white/10 font-bold' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
            <span className="shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-black">{i + 1}</span>
            <span className="truncate flex-1 leading-tight">{p.name}</span>
          </button>
        ))}

        <div className="px-3 pt-2 pb-1">
          <p className="text-white/30 text-[9px] font-black uppercase tracking-wider">أخرى</p>
        </div>
        <button onClick={() => scrollToId('about')}
          className={`w-full text-right px-4 py-2 text-xs font-bold transition flex items-center gap-2 rounded-lg mx-1 ${activeId === 'about' ? 'text-[#F5C518] bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
          <span>📖</span> من نحن
        </button>
        <button onClick={() => scrollToId('contact')}
          className={`w-full text-right px-4 py-2 text-xs font-bold transition flex items-center gap-2 rounded-lg mx-1 ${activeId === 'contact' ? 'text-[#F5C518] bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
          <span>📞</span> تواصل معنا
        </button>
      </nav>

      {/* Actions */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <button onClick={onOrderClick}
          className={`w-full font-black py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 ${
            selectedCount > 0
              ? 'bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1a2e] shadow-lg shadow-yellow-900/30'
              : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
          }`}>
          <span>📤</span>
          أرسل الطلب
          {selectedCount > 0 && (
            <span className="bg-[#1a1a2e] text-[#F5C518] text-[10px] font-black px-1.5 py-0.5 rounded-full">{selectedCount}</span>
          )}
        </button>
        <button onClick={onPrint}
          className="w-full bg-white/8 hover:bg-white/15 border border-white/20 text-white/80 hover:text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2">
          <span>⬇️</span> تحميل PDF
        </button>
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 text-white/50 hover:text-white/80 text-xs font-medium py-1 transition">
          <span>🔗</span> زيارة المتجر
        </a>
      </div>
    </aside>
  );
}

// ─── Cover Page ────────────────────────────────────────────────────────────────

function CoverPage({ productCount, onStart }: { productCount: number; onStart: () => void }) {
  return (
    <div id="cover" className="catalog-page flex flex-col items-center justify-center text-center min-h-screen bg-[#1a1a2e] relative overflow-hidden px-8 py-16">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-[#F5C518]/5" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full bg-[#F5C518]/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.015]" />
      </div>

      {/* Logo */}
      <div className="relative z-10 mb-8">
        <div className="w-24 h-24 rounded-3xl bg-[#F5C518] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-yellow-900/40">
          <span className="text-4xl">🌙</span>
        </div>
        <p className="text-[#F5C518] text-2xl font-black tracking-wide">MOSLIM LEADER</p>
        <p className="text-white/50 text-sm mt-1">مسلم ليدر</p>
      </div>

      {/* Title */}
      <div className="relative z-10 mb-10">
        <div className="inline-block bg-[#F5C518]/10 border border-[#F5C518]/20 text-[#F5C518] text-xs font-black px-4 py-1.5 rounded-full mb-4 tracking-widest uppercase">
          كتالوج رسمي
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-3">
          كتالوج<br/>
          <span className="text-[#F5C518]">المنتجات</span>
        </h1>
        <p className="text-white/50 text-sm md:text-base leading-relaxed max-w-sm mx-auto">
          منتجات تربوية وتعليمية للأطفال والأسرة<br/>
          معاً نبني قادة الغد
        </p>
      </div>

      {/* Stats */}
      <div className="relative z-10 flex items-center gap-8 mb-10">
        <div className="text-center">
          <p className="text-3xl font-black text-[#F5C518]">{productCount}</p>
          <p className="text-white/50 text-xs mt-0.5">منتج</p>
        </div>
        <div className="w-px h-10 bg-white/20" />
        <div className="text-center">
          <p className="text-3xl font-black text-[#F5C518]">2025</p>
          <p className="text-white/50 text-xs mt-0.5">إصدار</p>
        </div>
        <div className="w-px h-10 bg-white/20" />
        <div className="text-center">
          <p className="text-3xl font-black text-[#F5C518]">🇪🇬</p>
          <p className="text-white/50 text-xs mt-0.5">صنع في مصر</p>
        </div>
      </div>

      {/* CTAs */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-3 catalog-no-print">
        <button onClick={onStart}
          className="bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1a2e] font-black px-8 py-4 rounded-2xl text-base transition shadow-xl shadow-yellow-900/30">
          تصفح الكتالوج ↓
        </button>
        <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer"
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-6 py-4 rounded-2xl text-sm transition flex items-center justify-center gap-2">
          💬 تواصل معنا على واتساب
        </a>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 catalog-no-print animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center pt-2">
          <div className="w-1 h-2 bg-white/40 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─── About Page ────────────────────────────────────────────────────────────────

function AboutPage() {
  return (
    <div id="about" className="catalog-page bg-white mx-3 lg:mx-8 my-4 rounded-3xl shadow-md border border-gray-100 overflow-hidden" dir="rtl">
      <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2a1a4e] px-8 py-10 text-center">
        <span className="text-5xl block mb-4">📖</span>
        <h2 className="text-3xl font-black text-white mb-2">من نحن</h2>
        <p className="text-white/60 text-sm max-w-lg mx-auto">نعرّفك بمسلم ليدر ورسالتنا</p>
      </div>
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-gray-600 leading-loose text-sm mb-8">
          هدفنا الأسمى هو تقديم القيم الإسلامية للجيل المسلم، وتنشئته على حب الإسلام وتعليمه ما ينفعه في دينه ودنياه
          في إطار ممتع وشيق. شغفنا هو تطوير أفكار ممتعة للأطفال من كل الأعمار ليتعلموا ويتمتعوا.
          لذا نعمل جاهدين على أن نقدم منتجات بتصميمات تساعد المربين على تزويد أطفالهم بما ينفعهم من علم وآداب إسلامية قيمة،
          ليخرج جيل إسلامي صالح قويم في بيئة طبيعية وممتعة.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: '🌟', title: 'الرؤية', text: 'إعداد جيل مسلم واعٍ، معتزٌّ بهويته الإسلامية، متمكن من علوم الدنيا والدين.' },
            { icon: '🎯', title: 'الرسالة', text: 'تقديم التراث الإسلامي التربوي بصورة تتلاءم مع طبيعة العصر لمساعدة المربين والمعلمين.' },
            { icon: '🏆', title: 'الهدف', text: 'بناء الطفل المسلم ثقافياً وفكرياً من خلال منتجات مبتكرة تتماشى مع قيمنا وهويتنا.' },
          ].map(({ icon, title, text }) => (
            <div key={title} className="bg-[#FFF9E6] rounded-2xl p-5 border border-yellow-100">
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-black text-[#1a1a2e] mb-1.5">{title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🎨', text: 'تصاميم ورسومات احترافية بتقنية الذكاء الاصطناعي' },
            { icon: '📱', text: 'مواكبة التكنولوجيا — تطبيقات وواقع معزز' },
            { icon: '🕌', text: 'محايد — لا انحياز لأي فكر سياسي أو طائفة' },
            { icon: '📦', text: 'منتجات رقمية ومطبوعة لجميع أفراد الأسرة' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
              <span className="text-xl shrink-0">{icon}</span>
              <p className="text-xs text-gray-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Contact Page (last) ───────────────────────────────────────────────────────

function ContactPage() {
  return (
    <div id="contact" className="catalog-page bg-[#1a1a2e] mx-3 lg:mx-8 my-4 rounded-3xl shadow-md overflow-hidden text-center" dir="rtl">
      <div className="px-8 pt-16 pb-10">
        <div className="w-20 h-20 rounded-3xl bg-[#F5C518] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-yellow-900/40">
          <span className="text-3xl">🌙</span>
        </div>
        <h2 className="text-3xl font-black text-white mb-2">تواصل معنا</h2>
        <p className="text-white/50 text-sm mb-10">نسعد بخدمتك وتلقي طلباتك</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto mb-10">
          <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-4 rounded-2xl text-sm transition flex flex-col items-center gap-2">
            <span className="text-2xl">💬</span> واتساب
          </a>
          <a href={SITE_URL} target="_blank" rel="noopener noreferrer"
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-4 rounded-2xl text-sm transition flex flex-col items-center gap-2">
            <span className="text-2xl">🌐</span> الموقع الرسمي
          </a>
          <a href="https://instagram.com/moslimleader" target="_blank" rel="noopener noreferrer"
            className="bg-gradient-to-br from-purple-600 to-pink-500 hover:opacity-90 text-white font-bold py-4 rounded-2xl text-sm transition flex flex-col items-center gap-2">
            <span className="text-2xl">📸</span> إنستغرام
          </a>
        </div>

        <div className="text-white/30 text-xs space-y-1">
          <p className="font-black text-white/60">Moslim Leader — مسلم ليدر</p>
          <p>{SITE_URL}</p>
          <p className="mt-4 text-[10px]">جميع الحقوق محفوظة © 2025</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Catalog ─────────────────────────────────────────────────────────────

export default function CatalogClient({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [activeId, setActiveId] = useState('cover');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Inject print styles once
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const sections = el.querySelectorAll('[id]');
      let current = 'cover';
      sections.forEach(sec => {
        const rect = sec.getBoundingClientRect();
        if (rect.top <= 200) current = sec.id;
      });
      setActiveId(current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
    }
    setSidebarOpen(false);
  }, []);

  const toggleProduct = useCallback((product: Product) => {
    setSelected(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) return prev.filter(p => p.id !== product.id);
      return [...prev, { id: product.id, name: product.name, price: product.price }];
    });
  }, []);

  const removeSelected = useCallback((id: string) => {
    setSelected(prev => prev.filter(p => p.id !== id));
  }, []);

  const handlePrint = () => {
    // Make the catalog-shell static before printing so pages flow correctly
    const shell = document.querySelector('.catalog-shell') as HTMLElement;
    if (shell) {
      shell.style.position = 'static';
      shell.style.overflow = 'visible';
      shell.style.height = 'auto';
    }
    window.print();
    setTimeout(() => {
      if (shell) {
        shell.style.position = 'fixed';
        shell.style.overflow = 'auto';
        shell.style.height = '';
      }
    }, 1000);
  };

  return (
    <div className="flex h-full" dir="rtl">
      {/* ── Desktop Sidebar ── */}
      <div className="hidden lg:flex flex-col" style={{ width: 224, minWidth: 224 }}>
        <div className="fixed top-0 bottom-0 flex flex-col" style={{ width: 224 }}>
          <CatalogSidebar
            products={products}
            selectedCount={selected.length}
            onOrderClick={() => setOrderOpen(true)}
            onPrint={handlePrint}
            scrollToId={scrollToId}
            activeId={activeId}
          />
        </div>
      </div>

      {/* ── Main scroll area ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ height: '100%' }}>
        {/* Mobile top bar */}
        <div className="catalog-topbar lg:hidden sticky top-0 z-40 bg-[#1a1a2e] flex items-center justify-between px-4 py-3 shadow-lg">
          <button onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <p className="text-[#F5C518] font-black text-sm">كتالوج مسلم ليدر</p>
          <button onClick={() => setOrderOpen(true)}
            className={`relative font-black text-xs px-3 py-1.5 rounded-xl transition ${selected.length > 0 ? 'bg-[#F5C518] text-[#1a1a2e]' : 'bg-white/10 text-white/70'}`}>
            📤 الطلب
            {selected.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {selected.length}
              </span>
            )}
          </button>
        </div>

        {/* Mobile sidebar drawer */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <div className="fixed top-0 right-0 bottom-0 z-50 w-64 lg:hidden">
              <CatalogSidebar
                products={products}
                selectedCount={selected.length}
                onOrderClick={() => { setOrderOpen(true); setSidebarOpen(false); }}
                onPrint={handlePrint}
                scrollToId={scrollToId}
                activeId={activeId}
              />
            </div>
          </>
        )}

        {/* Cover */}
        <CoverPage productCount={products.length} onStart={() => scrollToId(products[0] ? `product-${products[0].id}` : 'about')} />

        {/* Products */}
        {products.map((product, i) => (
          <div key={product.id}>
            <CatalogCard
              product={product}
              index={i}
              total={products.length}
              isSelected={!!selected.find(s => s.id === product.id)}
              onToggle={toggleProduct}
            />
            {i < products.length - 1 && (
              <div className="catalog-divider mx-3 lg:mx-8 flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-gradient-to-l from-gray-200 to-transparent" />
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F5C518]/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F5C518]/40" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F5C518]/20" />
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
              </div>
            )}
          </div>
        ))}

        {/* About + Contact */}
        <div className="mt-4">
          <AboutPage />
        </div>
        <div className="mb-4">
          <ContactPage />
        </div>
      </div>

      {/* Floating order button (mobile) */}
      {selected.length > 0 && (
        <button onClick={() => setOrderOpen(true)}
          className="catalog-fab fixed bottom-5 right-4 z-40 lg:hidden bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1a2e] font-black px-5 py-3 rounded-2xl shadow-2xl shadow-yellow-400/40 flex items-center gap-2 text-sm transition">
          <span>📤</span> أرسل الطلب
          <span className="bg-[#1a1a2e] text-[#F5C518] text-[10px] font-black px-1.5 py-0.5 rounded-full">{selected.length}</span>
        </button>
      )}

      {/* Order form modal */}
      {orderOpen && (
        <OrderFormModal
          products={products}
          selected={selected}
          onClose={() => setOrderOpen(false)}
          onRemove={removeSelected}
        />
      )}
    </div>
  );
}
