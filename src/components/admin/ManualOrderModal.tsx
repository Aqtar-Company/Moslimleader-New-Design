'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';

interface Product {
  id: string;
  name: string;
  price: number;
  images?: unknown;
  inStock?: boolean;
}

interface LineItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

const GOVERNORATES: Array<{ id: string; name: string; shipping: number }> = [
  { id: 'cairo', name: 'القاهرة', shipping: 50 },
  { id: 'giza', name: 'الجيزة', shipping: 50 },
  { id: 'qalyubia', name: 'القليوبية', shipping: 55 },
  { id: 'alexandria', name: 'الإسكندرية', shipping: 65 },
  { id: 'sharqia', name: 'الشرقية', shipping: 65 },
  { id: 'dakahlia', name: 'الدقهلية', shipping: 65 },
  { id: 'gharbia', name: 'الغربية', shipping: 65 },
  { id: 'monufia', name: 'المنوفية', shipping: 65 },
  { id: 'suez', name: 'السويس', shipping: 65 },
  { id: 'ismailia', name: 'الإسماعيلية', shipping: 65 },
  { id: 'port-said', name: 'بورسعيد', shipping: 65 },
  { id: 'beheira', name: 'البحيرة', shipping: 70 },
  { id: 'damietta', name: 'دمياط', shipping: 70 },
  { id: 'kafr-sheikh', name: 'كفر الشيخ', shipping: 70 },
  { id: 'fayoum', name: 'الفيوم', shipping: 70 },
  { id: 'beni-suef', name: 'بني سويف', shipping: 80 },
  { id: 'minya', name: 'المنيا', shipping: 80 },
  { id: 'asyut', name: 'أسيوط', shipping: 85 },
  { id: 'sohag', name: 'سوهاج', shipping: 85 },
  { id: 'qena', name: 'قنا', shipping: 90 },
  { id: 'luxor', name: 'الأقصر', shipping: 90 },
  { id: 'aswan', name: 'أسوان', shipping: 95 },
  { id: 'red-sea', name: 'البحر الأحمر', shipping: 95 },
  { id: 'north-sinai', name: 'شمال سيناء', shipping: 95 },
  { id: 'south-sinai', name: 'جنوب سيناء', shipping: 100 },
  { id: 'matruh', name: 'مطروح', shipping: 100 },
  { id: 'new-valley', name: 'الوادي الجديد', shipping: 100 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function ManualOrderModal({ open, onClose, onCreated }: Props) {
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
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

  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/products', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => {});
  }, [open]);

  const govObj = useMemo(() => GOVERNORATES.find(g => g.id === governorate), [governorate]);
  const subtotal = useMemo(() => items.reduce((s, it) => s + it.unitPrice * it.quantity, 0), [items]);
  const shippingCost = govObj?.shipping ?? 0;
  const total = Math.max(0, subtotal - discount + shippingCost);

  const reset = () => {
    setName(''); setPhone(''); setWhatsappNumber(''); setEmail('');
    setGovernorate('cairo'); setCity(''); setStreet(''); setBuilding(''); setNotes('');
    setItems([]); setPaymentMethod('cod'); setSource('facebook');
    setDiscount(0); setCouponCode(''); setProductPicker('');
  };

  const addItem = () => {
    if (!productPicker) return;
    const p = products.find(p => p.id === productPicker);
    if (!p) return;
    setItems(prev => {
      const existing = prev.find(it => it.productId === p.id);
      if (existing) return prev.map(it => it.productId === p.id ? { ...it, quantity: it.quantity + 1 } : it);
      return [...prev, { productId: p.id, name: p.name, unitPrice: p.price, quantity: 1 }];
    });
    setProductPicker('');
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty < 1) {
      setItems(prev => prev.filter(it => it.productId !== productId));
    } else {
      setItems(prev => prev.map(it => it.productId === productId ? { ...it, quantity: qty } : it));
    }
  };

  const updatePrice = (productId: string, price: number) => {
    setItems(prev => prev.map(it => it.productId === productId ? { ...it, unitPrice: Math.max(0, price) } : it));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { addToast('اسم العميل مطلوب', 'warning'); return; }
    if (!phone.trim()) { addToast('رقم التليفون مطلوب', 'warning'); return; }
    if (items.length === 0) { addToast('اختار منتج واحد على الأقل', 'warning'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customer: { name, phone, whatsappNumber, email, governorate, city, street, building, notes },
          items: items.map(it => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, productName: it.name })),
          shippingCost,
          discount,
          couponCode,
          paymentMethod,
          source,
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
          {/* Source */}
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
                  {GOVERNORATES.map(g => (
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
                {items.map(it => (
                  <div key={it.productId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                    <span className="text-xs font-bold text-gray-800 flex-1 truncate">{it.name}</span>
                    <input
                      type="number"
                      min={0}
                      value={it.unitPrice}
                      onChange={e => updatePrice(it.productId, Number(e.target.value))}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center"
                      title="السعر"
                    />
                    <span className="text-[10px] text-gray-400">ج.م ×</span>
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={e => updateQty(it.productId, Number(e.target.value))}
                      className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center"
                      title="الكمية"
                    />
                    <span className="text-xs font-black text-[#6B21A8] w-20 text-left">{(it.unitPrice * it.quantity).toLocaleString('en-US')}</span>
                    <button type="button" onClick={() => updateQty(it.productId, 0)} className="text-red-600 text-sm hover:text-red-700">×</button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          {/* Totals + payment */}
          <fieldset className="border border-gray-200 rounded-xl p-4">
            <legend className="text-xs font-black text-gray-700 px-2">💳 الدفع والإجمالي</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
              <div>
                <label className="text-[11px] font-bold text-gray-600">ملاحظات</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder="أي ملاحظة..." />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-600">المجموع الفرعي</span><span className="font-bold">{subtotal.toLocaleString('en-US')} ج.م</span></div>
              {discount > 0 && <div className="flex justify-between text-green-700"><span>خصم</span><span className="font-bold">−{discount.toLocaleString('en-US')} ج.م</span></div>}
              <div className="flex justify-between"><span className="text-gray-600">الشحن ({govObj?.name})</span><span className="font-bold">{shippingCost.toLocaleString('en-US')} ج.م</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2 text-base"><span className="font-black">الإجمالي</span><span className="font-black text-[#6B21A8]">{total.toLocaleString('en-US')} ج.م</span></div>
            </div>
          </fieldset>
        </div>

        <div className="px-5 py-4 bg-gray-50 border-t flex gap-2 justify-end">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold transition disabled:opacity-50">إلغاء</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition disabled:opacity-50">
            {submitting ? '...' : 'إنشاء الطلب'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 mt-1 bg-white';
