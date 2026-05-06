'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';

interface ProductVariant { id?: string; name?: string; nameEn?: string }
interface Product {
  id: string;
  name: string;
  price: number;
  images?: unknown;
  inStock?: boolean;
  variants?: ProductVariant[];
  variantStocks?: Record<string, number> | null;
  stock?: number;
}

interface LineItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedModel: number | null;       // required (number) when product has variants
  variantOptions?: ProductVariant[];  // cached for the dropdown
}

const lineKey = (it: LineItem) => `${it.productId}::${it.selectedModel ?? '-'}`;

const FALLBACK_GOVS: Array<{ id: string; name: string; shipping: number }> = [
  { id: 'cairo', name: 'القاهرة', shipping: 50 },
  { id: 'giza', name: 'الجيزة', shipping: 50 },
  { id: 'qalyubia', name: 'القليوبية', shipping: 55 },
  { id: 'alexandria', name: 'الإسكندرية', shipping: 65 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function ManualOrderModal({ open, onClose, onCreated }: Props) {
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [govs, setGovs] = useState(FALLBACK_GOVS);

  useEffect(() => {
    if (!open) return;
    fetch('/api/shipping-rates', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const rates: Array<{ id: string; name: string; rate: number }> = d.rates ?? [];
        if (rates.length > 0) {
          setGovs(rates.map(r => ({ id: r.id, name: r.name, shipping: r.rate })));
        }
      })
      .catch(() => {});
  }, [open]);
  const [submitting, setSubmitting] = useState(false);

  // Customer fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [governorate, setGovernorate] = useState('cairo');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [notes, setNotes] = useState('');

  // Order fields
  const [items, setItems] = useState<LineItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [source, setSource] = useState('facebook');
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [productPicker, setProductPicker] = useState('');

  // Gift mode
  const [isGift, setIsGift] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState('');
  const [giftOccasion, setGiftOccasion] = useState('');
  const [giftFreeShipping, setGiftFreeShipping] = useState(true);

  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/products', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => {});
  }, [open]);

  const govObj = useMemo(() => govs.find(g => g.id === governorate), [governorate]);
  const subtotal = useMemo(() => items.reduce((s, it) => s + it.unitPrice * it.quantity, 0), [items]);
  const baseShipping = govObj?.shipping ?? 0;
  const shippingCost = isGift && giftFreeShipping ? 0 : baseShipping;
  // For gifts the customer pays nothing for items; total = shipping (if not waived).
  const total = isGift ? shippingCost : Math.max(0, subtotal - discount + shippingCost);

  const reset = () => {
    setName(''); setPhone(''); setWhatsappNumber(''); setEmail('');
    setGovernorate('cairo'); setCity(''); setStreet(''); setBuilding(''); setNotes('');
    setItems([]); setPaymentMethod('cod'); setSource('facebook');
    setDiscount(0); setCouponCode(''); setProductPicker('');
    setIsGift(false); setGiftRecipient(''); setGiftOccasion(''); setGiftFreeShipping(true);
  };

  const addItem = () => {
    if (!productPicker) return;
    const p = products.find(p => p.id === productPicker);
    if (!p) return;
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const hasVariants = variants.length > 0;
    setItems(prev => {
      // For variant-less products, merge into the existing line.
      if (!hasVariants) {
        const existing = prev.find(it => it.productId === p.id && it.selectedModel === null);
        if (existing) {
          return prev.map(it => it === existing ? { ...it, quantity: it.quantity + 1 } : it);
        }
      }
      // For variant products, always start a fresh line — admin picks the
      // model, then we'll merge on (productId, selectedModel) afterwards.
      return [...prev, {
        productId: p.id,
        name: p.name,
        unitPrice: p.price,
        quantity: 1,
        selectedModel: null,
        variantOptions: hasVariants ? variants : undefined,
      }];
    });
    setProductPicker('');
  };

  const updateQty = (key: string, qty: number) => {
    if (qty < 1) {
      setItems(prev => prev.filter(it => lineKey(it) !== key));
    } else {
      setItems(prev => prev.map(it => lineKey(it) === key ? { ...it, quantity: qty } : it));
    }
  };

  const updatePrice = (key: string, price: number) => {
    setItems(prev => prev.map(it => lineKey(it) === key ? { ...it, unitPrice: Math.max(0, price) } : it));
  };

  const updateVariant = (key: string, modelIdx: number) => {
    setItems(prev => {
      const target = prev.find(it => lineKey(it) === key);
      if (!target) return prev;
      // If a line for the same (productId, modelIdx) already exists, merge
      // quantities and drop the current line.
      const merged = prev.find(it => it !== target && it.productId === target.productId && it.selectedModel === modelIdx);
      if (merged) {
        return prev
          .filter(it => it !== target)
          .map(it => it === merged ? { ...it, quantity: it.quantity + target.quantity } : it);
      }
      return prev.map(it => it === target ? { ...it, selectedModel: modelIdx } : it);
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) { addToast('اسم العميل مطلوب', 'warning'); return; }
    if (!phone.trim()) { addToast('رقم التليفون مطلوب', 'warning'); return; }
    if (items.length === 0) { addToast('اختار منتج واحد على الأقل', 'warning'); return; }
    const missingVariant = items.find(it => Array.isArray(it.variantOptions) && it.variantOptions.length > 0 && it.selectedModel === null);
    if (missingVariant) {
      addToast(`اختار الموديل لـ "${missingVariant.name}"`, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customer: { name, phone, whatsappNumber, email, governorate, city, street, building, notes },
          items: items.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            productName: it.name,
            selectedModel: it.selectedModel,
          })),
          shippingCost,
          discount,
          couponCode,
          paymentMethod: isGift ? 'gift' : paymentMethod,
          source: isGift ? 'gift' : source,
          isGift,
          giftRecipient: isGift ? giftRecipient : undefined,
          giftOccasion: isGift ? giftOccasion : undefined,
          giftFreeShipping: isGift ? giftFreeShipping : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'فشل إنشاء الطلب', 'error');
      } else {
        addToast(`تم إنشاء الطلب — العميل ${name} سُجِّل في قاعدة البيانات`, 'success', 6000);
        reset();
        onCreated();
        onClose();
      }
    } catch {
      addToast('فشل إنشاء الطلب', 'error');
    }
    setSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-6" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden my-auto">
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-black flex items-center gap-2">
            <span>+</span> طلب يدوي جديد
          </h3>
          <button onClick={onClose} disabled={submitting} className="text-white/70 hover:text-white text-xl">×</button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Gift toggle */}
          <div className={`rounded-xl border p-3 ${isGift ? 'border-pink-300 bg-pink-50' : 'border-gray-200 bg-white'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isGift}
                onChange={e => setIsGift(e.target.checked)}
                className="w-4 h-4 accent-pink-600"
              />
              <span className="text-sm font-bold text-gray-800">🎁 طلب هدية (بدون مقابل مادي)</span>
            </label>
            {isGift && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600">المُرسَل إليه (لمن الهدية؟)</label>
                  <input
                    value={giftRecipient}
                    onChange={e => setGiftRecipient(e.target.value)}
                    className={inputClass}
                    placeholder="مثال: د. محمد عبد الله"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600">المناسبة / السبب</label>
                  <input
                    value={giftOccasion}
                    onChange={e => setGiftOccasion(e.target.value)}
                    className={inputClass}
                    placeholder="عيد ميلاد، تكريم، علاقات عامة..."
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer sm:col-span-2 mt-1">
                  <input
                    type="checkbox"
                    checked={giftFreeShipping}
                    onChange={e => setGiftFreeShipping(e.target.checked)}
                    className="w-4 h-4 accent-pink-600"
                  />
                  <span className="text-xs font-semibold text-gray-700">شحن مجاني (الشركة تتحمل التكلفة)</span>
                </label>
                <p className="sm:col-span-2 text-[11px] text-pink-700 bg-white border border-pink-200 rounded-lg px-3 py-2">
                  ملاحظة: لا يُحسب هذا الطلب ضمن الإيرادات في تقرير تقييم الشركة، لكن يتم خصم الكمية من المخزون.
                </p>
              </div>
            )}
          </div>

          {/* Source */}
          {!isGift && (
          <div>
            <label className="text-xs font-bold text-gray-700 mb-1.5 block">مصدر الطلب</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { v: 'facebook', l: '📘 فيسبوك' },
                { v: 'whatsapp', l: '💬 واتساب' },
                { v: 'phone',    l: '📞 تليفون' },
                { v: 'walk-in',  l: '🚶 حضوري' },
                { v: 'other',    l: 'أخرى' },
              ].map(s => (
                <button
                  key={s.v}
                  type="button"
                  onClick={() => setSource(s.v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${source === s.v ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                >{s.l}</button>
              ))}
            </div>
          </div>
          )}

          {/* Customer */}
          <fieldset className="border border-gray-200 rounded-xl p-4">
            <legend className="text-xs font-black text-gray-700 px-2">👤 بيانات العميل</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-600">الاسم الكامل *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="أحمد محمد" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600">رقم التليفون *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="01xxxxxxxxx" dir="ltr" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600">رقم واتساب (لو مختلف)</label>
                <input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} className={inputClass} placeholder="01xxxxxxxxx" dir="ltr" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600">إيميل (اختياري)</label>
                <input value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="email@example.com" dir="ltr" />
              </div>
            </div>
          </fieldset>

          {/* Address */}
          <fieldset className="border border-gray-200 rounded-xl p-4">
            <legend className="text-xs font-black text-gray-700 px-2">📍 العنوان</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-600">المحافظة</label>
                <select value={governorate} onChange={e => setGovernorate(e.target.value)} className={inputClass}>
                  {govs.map(g => (
                    <option key={g.id} value={g.id}>{g.name} (شحن {g.shipping} ج.م)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600">المدينة / الحي</label>
                <input value={city} onChange={e => setCity(e.target.value)} className={inputClass} placeholder="المعادي" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-gray-600">الشارع والعنوان التفصيلي</label>
                <input value={street} onChange={e => setStreet(e.target.value)} className={inputClass} placeholder="٢٠ شارع ..." />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-gray-600">مبنى / دور / شقة</label>
                <input value={building} onChange={e => setBuilding(e.target.value)} className={inputClass} placeholder="عمارة ٥، الدور ٢، شقة ٤" />
              </div>
            </div>
          </fieldset>

          {/* Items */}
          <fieldset className="border border-gray-200 rounded-xl p-4">
            <legend className="text-xs font-black text-gray-700 px-2">🛒 المنتجات</legend>
            <div className="flex gap-2 mb-3">
              <select value={productPicker} onChange={e => setProductPicker(e.target.value)} className={inputClass + ' flex-1'}>
                <option value="">— اختار منتج —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.price} ج.م</option>
                ))}
              </select>
              <button type="button" onClick={addItem} disabled={!productPicker} className="px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-bold disabled:opacity-50">+ إضافة</button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-gray-400 py-3 text-center">لم تضف أي منتجات بعد</p>
            ) : (
              <div className="space-y-2">
                {items.map(it => {
                  const key = lineKey(it);
                  const hasVariants = Array.isArray(it.variantOptions) && it.variantOptions.length > 0;
                  const needsVariant = hasVariants && it.selectedModel === null;
                  return (
                    <div key={key} className={`flex items-center gap-2 p-2 rounded-xl ${needsVariant ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-gray-50'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{it.name}</p>
                        {hasVariants && (
                          <select
                            value={it.selectedModel ?? ''}
                            onChange={e => updateVariant(key, Number(e.target.value))}
                            className={`mt-1 w-full text-[11px] rounded-lg px-2 py-1 outline-none ${needsVariant ? 'border-amber-400 text-amber-700 font-bold' : 'border border-gray-200 text-gray-700'}`}
                          >
                            <option value="" disabled>اختار الموديل…</option>
                            {it.variantOptions!.map((v, i) => (
                              <option key={i} value={i}>{v.name || `موديل ${i + 1}`}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={it.unitPrice}
                        onChange={e => updatePrice(key, Number(e.target.value))}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center"
                        title="السعر"
                      />
                      <span className="text-[10px] text-gray-400">ج.م ×</span>
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={e => updateQty(key, Number(e.target.value))}
                        className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center"
                        title="الكمية"
                      />
                      <span className="text-xs font-black text-[#6B21A8] w-20 text-left">{(it.unitPrice * it.quantity).toLocaleString('en-US')}</span>
                      <button type="button" onClick={() => updateQty(key, 0)} className="text-red-600 text-sm hover:text-red-700">×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </fieldset>

          {/* Totals + payment */}
          <fieldset className="border border-gray-200 rounded-xl p-4">
            <legend className="text-xs font-black text-gray-700 px-2">{isGift ? '🎁 إجمالي الهدية' : '💳 الدفع والإجمالي'}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {!isGift && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600">طريقة الدفع</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputClass}>
                      <option value="cod">💵 الدفع عند الاستلام</option>
                      <option value="card">💳 بطاقة بنكية</option>
                      <option value="paypal">🅿️ PayPal</option>
                      <option value="vodafone">📱 Vodafone Cash</option>
                      <option value="instapay">⚡ InstaPay</option>
                      <option value="bank">🏦 تحويل بنكي</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600">كوبون (اختياري)</label>
                    <input value={couponCode} onChange={e => setCouponCode(e.target.value)} className={inputClass} placeholder="CODE" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600">خصم (ج.م)</label>
                    <input type="number" min={0} value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} className={inputClass} />
                  </div>
                </>
              )}
              <div className={isGift ? 'sm:col-span-2' : ''}>
                <label className="text-[11px] font-bold text-gray-600">ملاحظات</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder="أي ملاحظة..." />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-600">قيمة المنتجات (تكلفة على الشركة)</span><span className="font-bold">{subtotal.toLocaleString('en-US')} ج.م</span></div>
              {!isGift && discount > 0 && <div className="flex justify-between text-green-700"><span>خصم</span><span className="font-bold">−{discount.toLocaleString('en-US')} ج.م</span></div>}
              <div className="flex justify-between"><span className="text-gray-600">الشحن ({govObj?.name}){isGift && giftFreeShipping ? ' — مجاني' : ''}</span><span className="font-bold">{shippingCost.toLocaleString('en-US')} ج.م</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2 text-base">
                <span className="font-black">{isGift ? 'المطلوب من المستلم' : 'الإجمالي'}</span>
                <span className={`font-black ${isGift ? 'text-pink-700' : 'text-[#6B21A8]'}`}>{total.toLocaleString('en-US')} ج.م</span>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="px-5 py-4 bg-gray-50 border-t flex gap-2 justify-end">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold transition disabled:opacity-50">إلغاء</button>
          <button onClick={handleSubmit} disabled={submitting} className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold transition disabled:opacity-50 ${isGift ? 'bg-pink-600 hover:bg-pink-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {submitting ? '...' : isGift ? '🎁 إرسال الهدية' : 'إنشاء الطلب'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 mt-1 bg-white';
