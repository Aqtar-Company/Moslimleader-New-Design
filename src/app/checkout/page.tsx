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

  // Redirect if cart empty
  if (items.length === 0 && !placed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 pt-20" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-6xl">🛒</div>
        <p className="text-gray-500 font-semibold">{isRtl ? 'عربة التسوق فارغة' : 'Your cart is empty'}</p>
        <Link href="/" className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-700 transition text-sm">
          {isRtl ? 'تسوق الآن' : 'Shop Now'}
        </Link>
      </div>
    );
  }

  // Order placed success screen
  if (placed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 pt-20" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-7xl">✅</div>
        <h1 className="text-2xl font-black text-gray-900">{isRtl ? 'تم استلام طلبك!' : 'Order Placed!'}</h1>
        <p className="text-gray-500 text-center max-w-sm">
          {isRtl
            ? 'شكراً لك! سيتواصل معك فريقنا قريباً لتأكيد الطلب.'
            : 'Thank you! Our team will contact you soon to confirm your order.'}
        </p>
        <div className="bg-gray-50 rounded-2xl p-5 w-full max-w-sm text-sm text-gray-600 space-y-1">
          <div className="flex justify-between"><span>{isRtl ? 'الاسم' : 'Name'}</span><span className="font-semibold">{form.fullName}</span></div>
          <div className="flex justify-between"><span>{isRtl ? 'الهاتف' : 'Phone'}</span><span className="font-semibold">{form.phone}</span></div>
          <div className="flex justify-between"><span>{isRtl ? 'المحافظة' : 'Governorate'}</span><span className="font-semibold">{isRtl ? selectedGov?.name : selectedGov?.nameEn}</span></div>
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t">
            <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
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
  const stepLabels = isRtl
    ? ['العنوان', 'الدفع', 'التأكيد']
    : ['Address', 'Payment', 'Confirm'];

  const canProceedAddress = form.fullName && form.phone && form.governorate && form.city && form.street;

  const handlePlaceOrder = () => {
    clear();
    setPlaced(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto px-4">

        {/* Header */}
        <h1 className="text-2xl font-black text-gray-900 mb-6">{isRtl ? 'إتمام الشراء' : 'Checkout'}</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                i < stepIndex ? 'bg-green-500 text-white' :
                i === stepIndex ? 'bg-gray-900 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span className={`text-sm font-semibold hidden sm:block ${i === stepIndex ? 'text-gray-900' : 'text-gray-400'}`}>
                {stepLabels[i]}
              </span>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main form area */}
          <div className="lg:col-span-2">

            {/* ── Step 1: Address ── */}
            {step === 'address' && (
              <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-2">{isRtl ? 'بيانات التوصيل' : 'Delivery Details'}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{isRtl ? 'الاسم الكامل' : 'Full Name'} *</label>
                    <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
                      className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-2.5 text-sm outline-none transition"
                      placeholder={isRtl ? 'الاسم الكامل' : 'Full name'} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{isRtl ? 'رقم الهاتف' : 'Phone'} *</label>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)}
                      className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-2.5 text-sm outline-none transition"
                      placeholder="+20 1xx xxx xxxx" type="tel" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{isRtl ? 'المحافظة' : 'Governorate'} *</label>
                  <select value={form.governorate} onChange={e => set('governorate', e.target.value)}
                    className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-2.5 text-sm outline-none transition bg-white">
                    <option value="">{isRtl ? '-- اختر المحافظة --' : '-- Select Governorate --'}</option>
                    {governorates.map(g => (
                      <option key={g.id} value={g.id}>
                        {isRtl ? g.name : g.nameEn} — {g.shipping} {isRtl ? 'ج.م' : 'EGP'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{isRtl ? 'المدينة / المنطقة' : 'City / Area'} *</label>
                    <input value={form.city} onChange={e => set('city', e.target.value)}
                      className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-2.5 text-sm outline-none transition"
                      placeholder={isRtl ? 'مثال: مدينة نصر' : 'e.g. Nasr City'} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{isRtl ? 'رقم المبنى' : 'Building No.'}</label>
                    <input value={form.building} onChange={e => set('building', e.target.value)}
                      className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-2.5 text-sm outline-none transition"
                      placeholder={isRtl ? 'رقم المبنى' : 'Building number'} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{isRtl ? 'الشارع والعنوان التفصيلي' : 'Street & Detailed Address'} *</label>
                  <input value={form.street} onChange={e => set('street', e.target.value)}
                    className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-2.5 text-sm outline-none transition"
                    placeholder={isRtl ? 'اسم الشارع والعنوان' : 'Street name and address'} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{isRtl ? 'ملاحظات إضافية' : 'Notes'}</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                    className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-2.5 text-sm outline-none transition resize-none"
                    placeholder={isRtl ? 'أي ملاحظات للمندوب...' : 'Any notes for the courier...'} />
                </div>

                <button
                  onClick={() => setStep('payment')}
                  disabled={!canProceedAddress}
                  className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-gray-700 transition text-sm disabled:opacity-40 mt-2"
                >
                  {isRtl ? 'التالي: طريقة الدفع ←' : 'Next: Payment →'}
                </button>
              </div>
            )}

            {/* ── Step 2: Payment ── */}
            {step === 'payment' && (
              <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-2">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</h2>

                {/* COD */}
                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${form.payment === 'cod' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="payment" value="cod" checked={form.payment === 'cod'} onChange={() => set('payment', 'cod')} className="mt-1 accent-gray-900" />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{isRtl ? 'الدفع عند الاستلام' : 'Cash on Delivery'}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{isRtl ? 'ادفع نقداً عند وصول الطلب' : 'Pay cash when the order arrives'}</p>
                  </div>
                  <span className="mr-auto text-2xl">💵</span>
                </label>

                {/* Vodafone Cash */}
                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${form.payment === 'vodafone' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="payment" value="vodafone" checked={form.payment === 'vodafone'} onChange={() => set('payment', 'vodafone')} className="mt-1 accent-gray-900" />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{isRtl ? 'فودافون كاش' : 'Vodafone Cash'}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{isRtl ? 'حول المبلغ على رقم: 01060306803' : 'Transfer to: 01060306803'}</p>
                  </div>
                  <span className="mr-auto text-2xl">📱</span>
                </label>

                {/* InstaPay */}
                <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${form.payment === 'instapay' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="payment" value="instapay" checked={form.payment === 'instapay'} onChange={() => set('payment', 'instapay')} className="mt-1 accent-gray-900" />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">InstaPay</p>
                    <p className="text-gray-400 text-xs mt-0.5">{isRtl ? 'حول على InstaPay وأرسل الإيصال' : 'Transfer via InstaPay and send receipt'}</p>
                  </div>
                  <span className="mr-auto text-2xl">⚡</span>
                </label>

                {/* Vodafone/InstaPay instructions */}
                {(form.payment === 'vodafone' || form.payment === 'instapay') && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                    {isRtl
                      ? `بعد إتمام الطلب، حول ${grandTotal} ج.م على الرقم 01060306803 وأرسل صورة الإيصال على واتساب.`
                      : `After placing your order, transfer ${grandTotal} EGP to 01060306803 and send the receipt via WhatsApp.`}
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  <button onClick={() => setStep('address')} className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-bold hover:border-gray-900 transition text-sm">
                    {isRtl ? '← رجوع' : '← Back'}
                  </button>
                  <button onClick={() => setStep('confirm')} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-700 transition text-sm">
                    {isRtl ? 'التالي: تأكيد ←' : 'Next: Confirm →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Confirm ── */}
            {step === 'confirm' && (
              <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
                <h2 className="text-lg font-bold text-gray-900">{isRtl ? 'مراجعة الطلب' : 'Review Order'}</h2>

                {/* Address summary */}
                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                  <p className="font-bold text-gray-700 mb-2">{isRtl ? '📍 عنوان التوصيل' : '📍 Delivery Address'}</p>
                  <p>{form.fullName} — {form.phone}</p>
                  <p>{isRtl ? selectedGov?.name : selectedGov?.nameEn}، {form.city}</p>
                  <p>{form.street}{form.building ? `، ${form.building}` : ''}</p>
                  {form.notes && <p className="text-gray-400 italic">{form.notes}</p>}
                </div>

                {/* Payment summary */}
                <div className="bg-gray-50 rounded-xl p-4 text-sm">
                  <p className="font-bold text-gray-700 mb-1">{isRtl ? '💳 طريقة الدفع' : '💳 Payment'}</p>
                  <p>{form.payment === 'cod' ? (isRtl ? 'الدفع عند الاستلام' : 'Cash on Delivery') : form.payment === 'vodafone' ? 'Vodafone Cash' : 'InstaPay'}</p>
                </div>

                {/* Items */}
                <div className="space-y-3">
                  <p className="font-bold text-gray-700 text-sm">{isRtl ? '🛍 المنتجات' : '🛍 Items'}</p>
                  {items.map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        <Image src={product.images[0]} alt={product.name} fill className="object-cover" unoptimized />
                      </div>
                      <div className="flex-1 text-sm">
                        <p className="font-semibold text-gray-800 line-clamp-1">{product.name}</p>
                        <p className="text-gray-400">× {quantity}</p>
                      </div>
                      <p className="font-bold text-gray-900 text-sm">{product.price * quantity} {isRtl ? 'ج.م' : 'EGP'}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('payment')} className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-bold hover:border-gray-900 transition text-sm">
                    {isRtl ? '← رجوع' : '← Back'}
                  </button>
                  <button onClick={handlePlaceOrder} className="flex-1 bg-[#F5C518] text-gray-900 py-3 rounded-xl font-black hover:bg-yellow-400 transition text-sm">
                    {isRtl ? '✓ تأكيد الطلب' : '✓ Place Order'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm p-5 sticky top-28 text-sm">
              <h3 className="font-bold text-gray-900 mb-4">{isRtl ? 'ملخص الطلب' : 'Order Summary'}</h3>
              <div className="space-y-2 text-gray-600 mb-4">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex justify-between">
                    <span className="line-clamp-1 flex-1 ml-2">{product.name} ×{quantity}</span>
                    <span className="font-semibold text-gray-900 shrink-0">{product.price * quantity}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-gray-500">
                  <span>{isRtl ? 'المجموع' : 'Subtotal'}</span>
                  <span>{total} {isRtl ? 'ج.م' : 'EGP'}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>{isRtl ? 'الشحن' : 'Shipping'}</span>
                  <span>{shipping > 0 ? `${shipping} ${isRtl ? 'ج.م' : 'EGP'}` : (isRtl ? 'اختر محافظة' : 'Select gov.')}</span>
                </div>
                <div className="flex justify-between font-black text-gray-900 text-base pt-1 border-t">
                  <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
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
