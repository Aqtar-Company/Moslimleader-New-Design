'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { governorates, getShipping } from '@/lib/shipping';

type Step = 'address' | 'payment' | 'confirm';
type PayMethod = 'cod' | 'card' | 'vodafone' | 'instapay';

interface AddressForm {
  fullName: string;
  phone: string;
  governorate: string;
  city: string;
  street: string;
  building: string;
  notes: string;
}

const EMPTY_ADDRESS: AddressForm = {
  fullName: '', phone: '', governorate: '', city: '', street: '', building: '', notes: '',
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clear } = useCart();
  const { user } = useAuth();
  const { lang } = useLang();
  const isRtl = lang === 'ar';

  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState<AddressForm>({
    ...EMPTY_ADDRESS,
    fullName: user?.name || '',
    phone: user?.phone || '',
  });
  const [payMethod, setPayMethod] = useState<PayMethod>('cod');
  const [errors, setErrors] = useState<Partial<AddressForm>>({});
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());

  const shipping = address.governorate ? getShipping(address.governorate) : 0;
  const govObj = governorates.find(g => g.id === address.governorate);

  const txt = {
    checkout: isRtl ? 'إتمام الشراء' : 'Checkout',
    stepAddress: isRtl ? 'عنوان التوصيل' : 'Delivery Address',
    stepPayment: isRtl ? 'طريقة الدفع' : 'Payment',
    stepConfirm: isRtl ? 'تأكيد الطلب' : 'Confirm Order',
    fullName: isRtl ? 'الاسم بالكامل' : 'Full Name',
    phone: isRtl ? 'رقم الهاتف' : 'Phone Number',
    governorate: isRtl ? 'المحافظة' : 'Governorate',
    selectGov: isRtl ? 'اختر المحافظة' : 'Select governorate',
    city: isRtl ? 'المدينة / الحي' : 'City / District',
    street: isRtl ? 'اسم الشارع' : 'Street Name',
    building: isRtl ? 'رقم المبنى / الشقة (اختياري)' : 'Building / Apt No. (optional)',
    notes: isRtl ? 'ملاحظات للمندوب (اختياري)' : 'Delivery Notes (optional)',
    next: isRtl ? 'التالي' : 'Next',
    back: isRtl ? 'رجوع' : 'Back',
    placeOrder: isRtl ? 'تأكيد وإتمام الطلب' : 'Place Order',
    required: isRtl ? 'هذا الحقل مطلوب' : 'This field is required',
    codTitle: isRtl ? 'الدفع عند الاستلام' : 'Cash on Delivery',
    codDesc: isRtl ? 'ادفع نقداً عند وصول طلبك' : 'Pay cash when your order arrives',
    cardTitle: isRtl ? 'بطاقة بنكية (قريباً)' : 'Bank Card (coming soon)',
    vodafoneTitle: isRtl ? 'Vodafone Cash' : 'Vodafone Cash',
    vodafoneDesc: isRtl ? 'ادفع عبر محفظة فودافون كاش' : 'Pay via Vodafone Cash wallet',
    instapayTitle: isRtl ? 'InstaPay' : 'InstaPay',
    instapayDesc: isRtl ? 'ادفع عبر تطبيق InstaPay' : 'Pay via InstaPay app',
    orderSummary: isRtl ? 'ملخص الطلب' : 'Order Summary',
    subtotal: isRtl ? 'المجموع الفرعي' : 'Subtotal',
    shippingTo: isRtl ? 'الشحن إلى' : 'Shipping to',
    totalLabel: isRtl ? 'الإجمالي' : 'Total',
    currency: isRtl ? 'ج.م' : 'EGP',
    successTitle: isRtl ? 'تم تأكيد طلبك!' : 'Order Confirmed!',
    successDesc: isRtl ? 'شكراً لطلبك. سيتواصل معك فريقنا قريباً لتأكيد التوصيل.' : 'Thank you! Our team will contact you soon to confirm delivery.',
    orderNo: isRtl ? 'رقم الطلب' : 'Order No.',
    continueShopping: isRtl ? 'مواصلة التسوق' : 'Continue Shopping',
    signInNote: isRtl ? 'سجل دخولك لحفظ عنوانك وتتبع طلباتك' : 'Sign in to save your address and track orders',
    signIn: isRtl ? 'تسجيل الدخول' : 'Sign In',
  };

  function validateAddress() {
    const errs: Partial<AddressForm> = {};
    if (!address.fullName.trim()) errs.fullName = txt.required;
    if (!address.phone.trim()) errs.phone = txt.required;
    if (!address.governorate) errs.governorate = txt.required;
    if (!address.city.trim()) errs.city = txt.required;
    if (!address.street.trim()) errs.street = txt.required;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNextFromAddress() {
    if (validateAddress()) setStep('payment');
  }

  function handlePlaceOrder() {
    // In production: send to API
    clear();
    setOrderPlaced(true);
  }

  if (items.length === 0 && !orderPlaced) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h1 className="text-2xl font-black text-gray-900 mb-3">
          {isRtl ? 'عربة التسوق فارغة' : 'Your cart is empty'}
        </h1>
        <Link href="/shop" className="inline-block mt-4 bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-bold px-8 py-3 rounded-xl transition">
          {isRtl ? 'تسوق الآن' : 'Shop Now'}
        </Link>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-7xl mb-6">✅</div>
        <h1 className="text-3xl font-black text-gray-900 mb-3">{txt.successTitle}</h1>
        <p className="text-gray-600 mb-4">{txt.successDesc}</p>
        <div className="bg-[#FFF9E6] rounded-2xl px-6 py-4 inline-block mb-8">
          <p className="text-sm text-gray-500 mb-1">{txt.orderNo}</p>
          <p className="text-2xl font-black text-gray-900">#{orderNumber}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="bg-gray-900 text-white font-bold px-8 py-3 rounded-xl transition hover:bg-gray-700">
            {txt.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  const steps: Step[] = ['address', 'payment', 'confirm'];
  const stepIndex = steps.indexOf(step);

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black text-gray-900 mb-8">{txt.checkout}</h1>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-10">
        {[txt.stepAddress, txt.stepPayment, txt.stepConfirm].map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 ${i <= stepIndex ? 'text-gray-900' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${i < stepIndex ? 'bg-green-500 text-white' : i === stepIndex ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span className="text-sm font-semibold hidden sm:block">{label}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-0.5 mx-2 ${i < stepIndex ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Sign-in note for guests */}
      {!user && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 mb-8">
          <p className="text-sm text-blue-800">{txt.signInNote}</p>
          <Link href={`/auth?redirect=/checkout`} className="text-sm font-bold text-blue-700 hover:underline shrink-0">{txt.signIn}</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">

          {/* STEP 1: Address */}
          {step === 'address' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xl font-black text-gray-900 mb-6">{txt.stepAddress}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{txt.fullName} *</label>
                  <input type="text" value={address.fullName}
                    onChange={e => setAddress(a => ({ ...a, fullName: e.target.value }))}
                    className={`w-full border-2 rounded-xl px-4 py-3 outline-none transition ${errors.fullName ? 'border-red-400' : 'border-gray-200 focus:border-[#F5C518]'}`}
                    placeholder={isRtl ? 'الاسم بالكامل' : 'Full name'}
                  />
                  {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{txt.phone} *</label>
                  <input type="tel" value={address.phone} dir="ltr"
                    onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))}
                    className={`w-full border-2 rounded-xl px-4 py-3 outline-none transition ${errors.phone ? 'border-red-400' : 'border-gray-200 focus:border-[#F5C518]'}`}
                    placeholder="01xxxxxxxxx"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{txt.governorate} *</label>
                  <select value={address.governorate}
                    onChange={e => setAddress(a => ({ ...a, governorate: e.target.value }))}
                    className={`w-full border-2 rounded-xl px-4 py-3 outline-none transition bg-white ${errors.governorate ? 'border-red-400' : 'border-gray-200 focus:border-[#F5C518]'}`}
                  >
                    <option value="">{txt.selectGov}</option>
                    {governorates.map(g => (
                      <option key={g.id} value={g.id}>
                        {isRtl ? g.name : g.nameEn} — {g.shipping} {txt.currency}
                      </option>
                    ))}
                  </select>
                  {errors.governorate && <p className="text-red-500 text-xs mt-1">{errors.governorate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{txt.city} *</label>
                  <input type="text" value={address.city}
                    onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                    className={`w-full border-2 rounded-xl px-4 py-3 outline-none transition ${errors.city ? 'border-red-400' : 'border-gray-200 focus:border-[#F5C518]'}`}
                    placeholder={isRtl ? 'مثال: مدينة نصر' : 'e.g. Nasr City'}
                  />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{txt.street} *</label>
                  <input type="text" value={address.street}
                    onChange={e => setAddress(a => ({ ...a, street: e.target.value }))}
                    className={`w-full border-2 rounded-xl px-4 py-3 outline-none transition ${errors.street ? 'border-red-400' : 'border-gray-200 focus:border-[#F5C518]'}`}
                    placeholder={isRtl ? 'اسم الشارع' : 'Street name'}
                  />
                  {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{txt.building}</label>
                  <input type="text" value={address.building}
                    onChange={e => setAddress(a => ({ ...a, building: e.target.value }))}
                    className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none transition"
                    placeholder={isRtl ? 'مبنى ١٢، شقة ٤' : 'Building 12, Apt 4'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{txt.notes}</label>
                  <input type="text" value={address.notes}
                    onChange={e => setAddress(a => ({ ...a, notes: e.target.value }))}
                    className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none transition"
                    placeholder={isRtl ? 'أي تعليمات للمندوب' : 'Any instructions for courier'}
                  />
                </div>
              </div>

              <button onClick={handleNextFromAddress}
                className="mt-6 w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-4 rounded-xl transition text-lg">
                {txt.next} ←
              </button>
            </div>
          )}

          {/* STEP 2: Payment */}
          {step === 'payment' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xl font-black text-gray-900 mb-6">{txt.stepPayment}</h2>

              <div className="flex flex-col gap-3">
                {([
                  { id: 'cod', icon: '💵', title: txt.codTitle, desc: txt.codDesc, available: true },
                  { id: 'vodafone', icon: '📱', title: txt.vodafoneTitle, desc: txt.vodafoneDesc, available: true },
                  { id: 'instapay', icon: '⚡', title: txt.instapayTitle, desc: txt.instapayDesc, available: true },
                  { id: 'card', icon: '💳', title: txt.cardTitle, desc: '', available: false },
                ] as const).map(method => (
                  <label key={method.id}
                    className={`flex items-center gap-4 border-2 rounded-2xl p-4 cursor-pointer transition ${!method.available ? 'opacity-40 cursor-not-allowed' : payMethod === method.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}>
                    <input type="radio" name="payment" value={method.id}
                      checked={payMethod === method.id}
                      disabled={!method.available}
                      onChange={() => method.available && setPayMethod(method.id as PayMethod)}
                      className="accent-gray-900" />
                    <span className="text-2xl">{method.icon}</span>
                    <div>
                      <p className="font-bold text-gray-900">{method.title}</p>
                      {method.desc && <p className="text-sm text-gray-500">{method.desc}</p>}
                    </div>
                  </label>
                ))}
              </div>

              {/* Vodafone/InstaPay number */}
              {(payMethod === 'vodafone' || payMethod === 'instapay') && (
                <div className="mt-4 bg-[#FFF9E6] rounded-2xl p-4 text-sm">
                  <p className="font-bold text-gray-900 mb-1">
                    {isRtl ? 'أرسل المبلغ على الرقم:' : 'Send the amount to:'}
                  </p>
                  <p className="font-black text-xl text-gray-900 tracking-wider" dir="ltr">01000000000</p>
                  <p className="text-gray-600 mt-1">
                    {isRtl ? 'ثم أرسل صورة التحويل على واتساب لتأكيد الطلب' : 'Then send a screenshot on WhatsApp to confirm your order'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('address')}
                  className="flex-1 border-2 border-gray-300 hover:border-gray-900 text-gray-700 font-bold py-4 rounded-xl transition">
                  {txt.back}
                </button>
                <button onClick={() => setStep('confirm')}
                  className="flex-2 flex-1 bg-gray-900 hover:bg-gray-700 text-white font-bold py-4 rounded-xl transition">
                  {txt.next} ←
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 'confirm' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xl font-black text-gray-900 mb-6">{txt.stepConfirm}</h2>

              {/* Address summary */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-900">{txt.stepAddress}</p>
                  <button onClick={() => setStep('address')} className="text-sm text-purple-700 hover:underline">
                    {isRtl ? 'تعديل' : 'Edit'}
                  </button>
                </div>
                <p className="text-gray-600 text-sm">{address.fullName} — {address.phone}</p>
                <p className="text-gray-600 text-sm">
                  {address.street}{address.building ? '، ' + address.building : ''}, {address.city}, {isRtl ? govObj?.name : govObj?.nameEn}
                </p>
              </div>

              {/* Payment summary */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-900">{txt.stepPayment}</p>
                  <button onClick={() => setStep('payment')} className="text-sm text-purple-700 hover:underline">
                    {isRtl ? 'تعديل' : 'Edit'}
                  </button>
                </div>
                <p className="text-gray-600 text-sm">
                  {payMethod === 'cod' ? txt.codTitle : payMethod === 'vodafone' ? 'Vodafone Cash' : payMethod === 'instapay' ? 'InstaPay' : 'Card'}
                </p>
              </div>

              <button onClick={handlePlaceOrder}
                className="w-full bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-black py-5 rounded-xl transition text-lg">
                {txt.placeOrder}
              </button>
              <button onClick={() => setStep('payment')}
                className="mt-3 w-full text-center text-sm text-gray-500 hover:text-gray-900 transition">
                {txt.back}
              </button>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-2xl p-5 sticky top-24">
            <h3 className="font-black text-gray-900 mb-4">{txt.orderSummary}</h3>

            <div className="flex flex-col gap-3 mb-4">
              {items.map(item => (
                <div key={item.product.id} className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white border border-gray-200 shrink-0">
                    <Image src={item.product.images[0]} alt={item.product.name} fill className="object-cover" unoptimized />
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{isRtl ? item.product.name : (item.product.nameEn || item.product.name)}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 shrink-0">{item.product.price * item.quantity} {txt.currency}</p>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{txt.subtotal}</span>
                <span className="font-bold">{total} {txt.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  {txt.shippingTo} {address.governorate ? (isRtl ? govObj?.name : govObj?.nameEn) : '—'}
                </span>
                <span className="font-bold">{shipping > 0 ? `${shipping} ${txt.currency}` : '—'}</span>
              </div>
              {address.governorate && (
                <div className="flex justify-between border-t pt-2 text-base">
                  <span className="font-black text-gray-900">{txt.totalLabel}</span>
                  <span className="font-black text-gray-900 text-lg">{total + shipping} {txt.currency}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
