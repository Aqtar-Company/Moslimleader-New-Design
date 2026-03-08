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
  fullName: string; phone: string; governorate: string;
  city: string; street: string; building: string; notes: string; payment: PaymentMethod;
}

const STEPS: Step[] = ['address', 'payment', 'confirm'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/5 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none transition bg-gray-50 focus:bg-white';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clear } = useCart();
  const { isRtl } = useLang();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('address');
  const [placed, setPlaced] = useState(false);
  const [form, setForm] = useState<OrderForm>({
    fullName: user?.name ?? '', phone: user?.phone ?? '',
    governorate: '', city: '', street: '', building: '', notes: '', payment: 'cod',
  });

  const shipping = form.governorate ? getShipping(form.governorate) : 0;
  const grandTotal = total + shipping;
  const selectedGov = governorates.find(g => g.id === form.governorate);
  const set = (k: keyof OrderForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (items.length === 0 && !placed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 pt-16" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-5xl">🛒</div>
        <p className="text-gray-500 font-semibold">{isRtl ? 'عربة التسوق فارغة' : 'Your cart is empty'}</p>
        <Link href="/" className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-700 transition text-sm">
          {isRtl ? 'تسوق الآن' : 'Shop Now'}
        </Link>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 pt-16" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center text-4xl">✅</div>
        <div className="text-center">
          <h1 className="text-2xl font-black text-gray-900 mb-2">{isRtl ? 'تم استلام طلبك!' : 'Order Placed!'}</h1>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">{isRtl ? 'شكراً لك! سيتواصل معك فريقنا قريباً.' : 'Thank you! Our team will contact you soon.'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 w-full max-w-sm text-sm space-y-2">
          {[
            { label: isRtl ? 'الاسم' : 'Name', val: form.fullName },
            { label: isRtl ? 'الهاتف' : 'Phone', val: form.phone },
            { label: isRtl ? 'المحافظة' : 'Governorate', val: isRtl ? selectedGov?.name : selectedGov?.nameEn },
          ].map(r => (
            <div key={r.label} className="flex justify-between">
              <span className="text-gray-400">{r.label}</span>
              <span className="font-semibold text-gray-800">{r.val}</span>
            </div>
          ))}
          <div className="flex justify-between font-black text-base pt-2 border-t border-gray-100">
            <span className="text-gray-900">{isRtl ? 'الإجمالي' : 'Total'}</span>
            <span className="text-[#F5C518]">{grandTotal} {isRtl ? 'ج.م' : 'EGP'}</span>
          </div>
        </div>
        <Link href="/" className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-700 transition text-sm">
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

        <h1 className="text-2xl font-black text-gray-900 mb-2">{isRtl ? 'إتمام الشراء' : 'Checkout'}</h1>

        {/* Step bar */}
        <div className="flex items-center gap-0 mb-8 mt-5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2 shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition ${
                  i < stepIndex ? 'bg-[#F5C518] text-gray-900' :
                  i === stepIndex ? 'bg-gray-900 text-white' :
                  'bg-white border-2 border-gray-200 text-gray-400'
                }`}>
                  {i < stepIndex ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                <span className={`text-sm font-semibold hidden sm:block ${i === stepIndex ? 'text-gray-900' : i < stepIndex ? 'text-[#F5C518]' : 'text-gray-400'}`}>
                  {stepLabels[i]}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 ${i < stepIndex ? 'bg-[#F5C518]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">

            {/* ── Step 1 ── */}
            {step === 'address' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                <h2 className="font-black text-gray-900">{isRtl ? 'بيانات التوصيل' : 'Delivery Details'}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={`${isRtl ? 'الاسم الكامل' : 'Full Name'} *`}>
                    <input value={form.fullName} onChange={e => set('fullName', e.target.value)} className={inputCls} placeholder={isRtl ? 'الاسم الكامل' : 'Full name'} />
                  </Field>
                  <Field label={`${isRtl ? 'رقم الهاتف' : 'Phone'} *`}>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="+20 1xx xxx xxxx" type="tel" />
                  </Field>
                </div>

                <Field label={`${isRtl ? 'المحافظة' : 'Governorate'} *`}>
                  <select value={form.governorate} onChange={e => set('governorate', e.target.value)} className={inputCls}>
                    <option value="">{isRtl ? '-- اختر المحافظة --' : '-- Select Governorate --'}</option>
                    {governorates.map(g => (
                      <option key={g.id} value={g.id}>{isRtl ? g.name : g.nameEn} — {g.shipping} {isRtl ? 'ج.م' : 'EGP'}</option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={`${isRtl ? 'المدينة / المنطقة' : 'City / Area'} *`}>
                    <input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} placeholder={isRtl ? 'مثال: مدينة نصر' : 'e.g. Nasr City'} />
                  </Field>
                  <Field label={isRtl ? 'رقم المبنى' : 'Building No.'}>
                    <input value={form.building} onChange={e => set('building', e.target.value)} className={inputCls} placeholder={isRtl ? 'رقم المبنى' : 'Building number'} />
                  </Field>
                </div>

                <Field label={`${isRtl ? 'الشارع والعنوان' : 'Street & Address'} *`}>
                  <input value={form.street} onChange={e => set('street', e.target.value)} className={inputCls} placeholder={isRtl ? 'اسم الشارع' : 'Street name'} />
                </Field>

                <Field label={isRtl ? 'ملاحظات' : 'Notes'}>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                    className={`${inputCls} resize-none`} placeholder={isRtl ? 'أي ملاحظات للمندوب...' : 'Notes for courier...'} />
                </Field>

                <button onClick={() => setStep('payment')} disabled={!canProceedAddress}
                  className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-gray-700 transition text-sm disabled:opacity-30">
                  {isRtl ? 'التالي: الدفع' : 'Next: Payment'} →
                </button>
              </div>
            )}

            {/* ── Step 2 ── */}
            {step === 'payment' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                <h2 className="font-black text-gray-900">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</h2>

                <div className="space-y-3">
                  {([
                    { method: 'cod',      icon: '💵', titleAr: 'الدفع عند الاستلام', titleEn: 'Cash on Delivery',  descAr: 'ادفع نقداً عند الاستلام', descEn: 'Pay cash when order arrives' },
                    { method: 'vodafone', icon: '📱', titleAr: 'فودافون كاش',        titleEn: 'Vodafone Cash',      descAr: 'حول على 01060306803',    descEn: 'Transfer to 01060306803' },
                    { method: 'instapay', icon: '⚡', titleAr: 'InstaPay',           titleEn: 'InstaPay',           descAr: 'حول وأرسل الإيصال',      descEn: 'Transfer & send receipt' },
                  ] as const).map(({ method, icon, titleAr, titleEn, descAr, descEn }) => {
                    const active = form.payment === method;
                    return (
                      <label key={method}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${active ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}>
                        <input type="radio" name="payment" value={method} checked={active} onChange={() => set('payment', method)} className="sr-only" />
                        <span className="text-2xl">{icon}</span>
                        <div className="flex-1">
                          <p className={`font-bold text-sm ${active ? 'text-gray-900' : 'text-gray-700'}`}>{isRtl ? titleAr : titleEn}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{isRtl ? descAr : descEn}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${active ? 'border-gray-900 bg-gray-900' : 'border-gray-200'}`}>
                          {active && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {(form.payment === 'vodafone' || form.payment === 'instapay') && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
                    {isRtl
                      ? `بعد إتمام الطلب، حول ${grandTotal} ج.م على 01060306803 وأرسل صورة الإيصال على واتساب.`
                      : `After ordering, transfer ${grandTotal} EGP to 01060306803 and send the receipt via WhatsApp.`}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep('address')}
                    className="flex-1 border border-gray-200 text-gray-500 py-3 rounded-xl font-bold hover:border-gray-400 hover:text-gray-700 transition text-sm">
                    ← {isRtl ? 'رجوع' : 'Back'}
                  </button>
                  <button onClick={() => setStep('confirm')}
                    className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-700 transition text-sm">
                    {isRtl ? 'التالي: تأكيد' : 'Next: Confirm'} →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3 ── */}
            {step === 'confirm' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                <h2 className="font-black text-gray-900">{isRtl ? 'مراجعة الطلب' : 'Review Order'}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                    <p className="font-black text-gray-500 text-xs uppercase tracking-wide mb-2">{isRtl ? 'عنوان التوصيل' : 'Delivery'}</p>
                    <p className="font-semibold text-gray-900">{form.fullName}</p>
                    <p className="text-gray-500">{form.phone}</p>
                    <p className="text-gray-500">{isRtl ? selectedGov?.name : selectedGov?.nameEn}، {form.city}</p>
                    <p className="text-gray-500">{form.street}{form.building ? `، ${form.building}` : ''}</p>
                    {form.notes && <p className="text-gray-400 italic text-xs">{form.notes}</p>}
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-sm">
                    <p className="font-black text-gray-500 text-xs uppercase tracking-wide mb-2">{isRtl ? 'طريقة الدفع' : 'Payment'}</p>
                    <p className="font-semibold text-gray-900">
                      {form.payment === 'cod' ? (isRtl ? 'الدفع عند الاستلام' : 'Cash on Delivery')
                        : form.payment === 'vodafone' ? 'Vodafone Cash' : 'InstaPay'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="font-black text-gray-500 text-xs uppercase tracking-wide mb-3">{isRtl ? 'المنتجات' : 'Items'}</p>
                  <div className="space-y-3">
                    {items.map(({ product, quantity }) => (
                      <div key={product.id} className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                          <Image src={product.images[0]} alt={product.name} fill className="object-cover" unoptimized />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm line-clamp-1">{product.name}</p>
                          <p className="text-gray-400 text-xs">× {quantity}</p>
                        </div>
                        <p className="font-black text-gray-900 text-sm shrink-0">{product.price * quantity} {isRtl ? 'ج.م' : 'EGP'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('payment')}
                    className="flex-1 border border-gray-200 text-gray-500 py-3 rounded-xl font-bold hover:border-gray-400 hover:text-gray-700 transition text-sm">
                    ← {isRtl ? 'رجوع' : 'Back'}
                  </button>
                  <button onClick={handlePlaceOrder}
                    className="flex-1 bg-[#F5C518] text-gray-900 py-3 rounded-xl font-black hover:bg-yellow-400 transition text-sm">
                    ✓ {isRtl ? 'تأكيد الطلب' : 'Place Order'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-28 text-sm">
              <h3 className="font-black text-gray-900 mb-4">{isRtl ? 'ملخص الطلب' : 'Order Summary'}</h3>
              <div className="space-y-2 text-gray-500 mb-4">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex justify-between">
                    <span className="line-clamp-1 flex-1 ml-2 text-xs">{product.name} ×{quantity}</span>
                    <span className="font-semibold text-gray-800 shrink-0">{product.price * quantity}</span>
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
                  <span>{shipping > 0 ? `${shipping} ${isRtl ? 'ج.م' : 'EGP'}` : (isRtl ? 'يُحدد لاحقاً' : 'TBD')}</span>
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
