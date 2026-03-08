'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { governorates, getShipping } from '@/lib/shipping';

type PaymentMethod = 'cod' | 'vodafone' | 'instapay';
type Step = 'address' | 'payment' | 'confirm';

interface OrderForm {
  fullName: string;
  phone: string;
  governorate: string;
  city: string;
  street: string;
  building: string;
  notes: string;
  payment: PaymentMethod;
}

const STEPS: Step[] = ['address', 'payment', 'confirm'];

const inputCls = 'w-full bg-white border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition';
const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clear } = useCart();
  const { isRtl } = useLang();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('address');
  const [placed, setPlaced] = useState(false);
  const [form, setForm] = useState<OrderForm>({
    fullName: user?.name ?? '',
    phone: user?.phone ?? '',
    governorate: '',
    city: '',
    street: '',
    building: '',
    notes: '',
    payment: 'cod',
  });

  const shipping = form.governorate ? getShipping(form.governorate) : 0;
  const grandTotal = total + shipping;
  const selectedGov = governorates.find(g => g.id === form.governorate);
  const set = (k: keyof OrderForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  /* ── Empty cart ── */
  if (items.length === 0 && !placed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 pt-20" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-6xl">🛒</div>
        <p className="text-gray-500 font-semibold">{isRtl ? 'عربة التسوق فارغة' : 'Your cart is empty'}</p>
        <Link href="/" className="bg-[#F5C518] text-black px-6 py-3 rounded-xl font-black hover:bg-yellow-400 transition text-sm">
          {isRtl ? 'تسوق الآن' : 'Shop Now'}
        </Link>
      </div>
    );
  }

  /* ── Success ── */
  if (placed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 pt-20" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="w-24 h-24 rounded-full bg-[#F5C518] flex items-center justify-center text-5xl shadow-lg">✅</div>
        <h1 className="text-2xl font-black text-gray-900">{isRtl ? 'تم استلام طلبك!' : 'Order Placed!'}</h1>
        <p className="text-gray-500 text-center max-w-sm">
          {isRtl ? 'شكراً لك! سيتواصل معك فريقنا قريباً لتأكيد الطلب.' : 'Thank you! Our team will contact you soon to confirm your order.'}
        </p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 w-full max-w-sm text-sm space-y-2">
          <div className="flex justify-between text-gray-600"><span className="text-gray-400">{isRtl ? 'الاسم' : 'Name'}</span><span className="font-semibold">{form.fullName}</span></div>
          <div className="flex justify-between text-gray-600"><span className="text-gray-400">{isRtl ? 'الهاتف' : 'Phone'}</span><span className="font-semibold">{form.phone}</span></div>
          <div className="flex justify-between text-gray-600"><span className="text-gray-400">{isRtl ? 'المحافظة' : 'Governorate'}</span><span className="font-semibold">{isRtl ? selectedGov?.name : selectedGov?.nameEn}</span></div>
          <div className="flex justify-between font-black text-gray-900 pt-2 border-t border-gray-100 text-base">
            <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
            <span className="text-[#F5C518]">{grandTotal} {isRtl ? 'ج.م' : 'EGP'}</span>
          </div>
        </div>
        <Link href="/" className="bg-black text-white px-8 py-3 rounded-xl font-black hover:bg-gray-800 transition text-sm">
          {isRtl ? 'العودة للمتجر' : 'Back to Shop'}
        </Link>
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(step);
  const stepLabels = isRtl ? ['العنوان', 'الدفع', 'التأكيد'] : ['Address', 'Payment', 'Confirm'];
  const canProceedAddress = form.fullName && form.phone && form.governorate && form.city && form.street;
  const handlePlaceOrder = () => { clear(); setPlaced(true); };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto px-4">

        <h1 className="text-2xl font-black text-gray-900 mb-6">{isRtl ? 'إتمام الشراء' : 'Checkout'}</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition shadow-sm ${
                i < stepIndex  ? 'bg-[#F5C518] text-black' :
                i === stepIndex ? 'bg-[#F5C518] text-black ring-4 ring-[#F5C518]/25' :
                'bg-white border-2 border-gray-200 text-gray-400'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span className={`text-sm font-bold hidden sm:block ${i === stepIndex ? 'text-gray-900' : i < stepIndex ? 'text-[#F5C518]' : 'text-gray-400'}`}>
                {stepLabels[i]}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-10 h-0.5 mx-1 ${i < stepIndex ? 'bg-[#F5C518]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">

            {/* ── Step 1: Address ── */}
            {step === 'address' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#F5C518] text-black text-xs font-black flex items-center justify-center">1</span>
                  {isRtl ? 'بيانات التوصيل' : 'Delivery Details'}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{isRtl ? 'الاسم الكامل' : 'Full Name'} *</label>
                    <input value={form.fullName} onChange={e => set('fullName', e.target.value)} className={inputCls} placeholder={isRtl ? 'الاسم الكامل' : 'Full name'} />
                  </div>
                  <div>
                    <label className={labelCls}>{isRtl ? 'رقم الهاتف' : 'Phone'} *</label>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="+20 1xx xxx xxxx" type="tel" />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>{isRtl ? 'المحافظة' : 'Governorate'} *</label>
                  <select value={form.governorate} onChange={e => set('governorate', e.target.value)} className={inputCls}>
                    <option value="">{isRtl ? '-- اختر المحافظة --' : '-- Select Governorate --'}</option>
                    {governorates.map(g => (
                      <option key={g.id} value={g.id}>{isRtl ? g.name : g.nameEn} — {g.shipping} {isRtl ? 'ج.م' : 'EGP'}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{isRtl ? 'المدينة / المنطقة' : 'City / Area'} *</label>
                    <input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} placeholder={isRtl ? 'مثال: مدينة نصر' : 'e.g. Nasr City'} />
                  </div>
                  <div>
                    <label className={labelCls}>{isRtl ? 'رقم المبنى' : 'Building No.'}</label>
                    <input value={form.building} onChange={e => set('building', e.target.value)} className={inputCls} placeholder={isRtl ? 'رقم المبنى' : 'Building number'} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>{isRtl ? 'الشارع والعنوان التفصيلي' : 'Street & Address'} *</label>
                  <input value={form.street} onChange={e => set('street', e.target.value)} className={inputCls} placeholder={isRtl ? 'اسم الشارع والعنوان' : 'Street name and address'} />
                </div>

                <div>
                  <label className={labelCls}>{isRtl ? 'ملاحظات إضافية' : 'Notes'}</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                    className={`${inputCls} resize-none`} placeholder={isRtl ? 'أي ملاحظات للمندوب...' : 'Any notes for the courier...'} />
                </div>

                <button onClick={() => setStep('payment')} disabled={!canProceedAddress}
                  className="w-full bg-[#F5C518] text-black py-3.5 rounded-xl font-black hover:bg-yellow-400 transition text-sm disabled:opacity-30 mt-2 shadow-md">
                  {isRtl ? 'التالي: طريقة الدفع ←' : 'Next: Payment →'}
                </button>
              </div>
            )}

            {/* ── Step 2: Payment ── */}
            {step === 'payment' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#F5C518] text-black text-xs font-black flex items-center justify-center">2</span>
                  {isRtl ? 'طريقة الدفع' : 'Payment Method'}
                </h2>

                {(['cod', 'vodafone', 'instapay'] as PaymentMethod[]).map(method => {
                  const info = {
                    cod:      { icon: '💵', titleAr: 'الدفع عند الاستلام', titleEn: 'Cash on Delivery',  descAr: 'ادفع نقداً عند وصول الطلب',          descEn: 'Pay cash when the order arrives' },
                    vodafone: { icon: '📱', titleAr: 'فودافون كاش',        titleEn: 'Vodafone Cash',      descAr: 'حول المبلغ على رقم: 01060306803',     descEn: 'Transfer to: 01060306803' },
                    instapay: { icon: '⚡', titleAr: 'InstaPay',           titleEn: 'InstaPay',           descAr: 'حول على InstaPay وأرسل الإيصال',     descEn: 'Transfer via InstaPay and send receipt' },
                  }[method];
                  const active = form.payment === method;
                  return (
                    <label key={method}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${active ? 'border-[#F5C518] bg-yellow-50' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}>
                      <input type="radio" name="payment" value={method} checked={active}
                        onChange={() => set('payment', method)} className="accent-[#F5C518]" />
                      <span className="text-2xl">{info.icon}</span>
                      <div className="flex-1">
                        <p className={`font-black text-sm ${active ? 'text-gray-900' : 'text-gray-700'}`}>{isRtl ? info.titleAr : info.titleEn}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{isRtl ? info.descAr : info.descEn}</p>
                      </div>
                      {active && <span className="w-5 h-5 rounded-full bg-[#F5C518] flex items-center justify-center text-black text-xs font-black">✓</span>}
                    </label>
                  );
                })}

                {(form.payment === 'vodafone' || form.payment === 'instapay') && (
                  <div className="bg-yellow-50 border-2 border-[#F5C518]/40 rounded-xl p-4 text-sm text-gray-700">
                    {isRtl
                      ? `بعد إتمام الطلب، حول ${grandTotal} ج.م على الرقم 01060306803 وأرسل صورة الإيصال على واتساب.`
                      : `After placing your order, transfer ${grandTotal} EGP to 01060306803 and send the receipt via WhatsApp.`}
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  <button onClick={() => setStep('address')}
                    className="flex-1 border-2 border-gray-200 text-gray-500 py-3 rounded-xl font-bold hover:border-gray-400 hover:text-gray-700 transition text-sm">
                    {isRtl ? '← رجوع' : '← Back'}
                  </button>
                  <button onClick={() => setStep('confirm')}
                    className="flex-1 bg-[#F5C518] text-black py-3 rounded-xl font-black hover:bg-yellow-400 transition text-sm shadow-md">
                    {isRtl ? 'التالي: تأكيد ←' : 'Next: Confirm →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Confirm ── */}
            {step === 'confirm' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#F5C518] text-black text-xs font-black flex items-center justify-center">3</span>
                  {isRtl ? 'مراجعة الطلب' : 'Review Order'}
                </h2>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm space-y-1">
                  <p className="font-black text-gray-700 mb-2 text-xs uppercase tracking-wide">{isRtl ? '📍 عنوان التوصيل' : '📍 Delivery Address'}</p>
                  <p className="text-gray-800">{form.fullName} — {form.phone}</p>
                  <p className="text-gray-500">{isRtl ? selectedGov?.name : selectedGov?.nameEn}، {form.city}</p>
                  <p className="text-gray-500">{form.street}{form.building ? `، ${form.building}` : ''}</p>
                  {form.notes && <p className="text-gray-400 italic">{form.notes}</p>}
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
                  <p className="font-black text-gray-700 mb-1 text-xs uppercase tracking-wide">{isRtl ? '💳 طريقة الدفع' : '💳 Payment'}</p>
                  <p className="text-gray-600">{form.payment === 'cod' ? (isRtl ? 'الدفع عند الاستلام' : 'Cash on Delivery') : form.payment === 'vodafone' ? 'Vodafone Cash' : 'InstaPay'}</p>
                </div>

                <div className="space-y-3">
                  <p className="font-black text-gray-700 text-xs uppercase tracking-wide">{isRtl ? '🛍 المنتجات' : '🛍 Items'}</p>
                  {items.map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                        <Image src={product.images[0]} alt={product.name} fill className="object-cover" unoptimized />
                      </div>
                      <div className="flex-1 text-sm">
                        <p className="font-bold text-gray-800 line-clamp-1">{product.name}</p>
                        <p className="text-gray-400 text-xs">× {quantity}</p>
                      </div>
                      <p className="font-black text-gray-900 text-sm">{product.price * quantity} {isRtl ? 'ج.م' : 'EGP'}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('payment')}
                    className="flex-1 border-2 border-gray-200 text-gray-500 py-3 rounded-xl font-bold hover:border-gray-400 hover:text-gray-700 transition text-sm">
                    {isRtl ? '← رجوع' : '← Back'}
                  </button>
                  <button onClick={handlePlaceOrder}
                    className="flex-1 bg-[#F5C518] text-black py-3 rounded-xl font-black hover:bg-yellow-400 transition text-sm shadow-md">
                    {isRtl ? '✓ تأكيد الطلب' : '✓ Place Order'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-28 text-sm">
              <h3 className="font-black text-gray-900 mb-4">{isRtl ? 'ملخص الطلب' : 'Order Summary'}</h3>
              <div className="space-y-2 text-gray-500 mb-4">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex justify-between">
                    <span className="line-clamp-1 flex-1 ml-2">{product.name} ×{quantity}</span>
                    <span className="font-bold text-gray-800 shrink-0">{product.price * quantity}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex justify-between text-gray-400">
                  <span>{isRtl ? 'المجموع' : 'Subtotal'}</span>
                  <span>{total} {isRtl ? 'ج.م' : 'EGP'}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{isRtl ? 'الشحن' : 'Shipping'}</span>
                  <span>{shipping > 0 ? `${shipping} ${isRtl ? 'ج.م' : 'EGP'}` : (isRtl ? 'اختر محافظة' : 'Select gov.')}</span>
                </div>
                <div className="flex justify-between font-black text-base pt-2 border-t border-gray-100">
                  <span className="text-gray-900">{isRtl ? 'الإجمالي' : 'Total'}</span>
                  <span className="text-[#F5C518]">{grandTotal} {isRtl ? 'ج.م' : 'EGP'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
