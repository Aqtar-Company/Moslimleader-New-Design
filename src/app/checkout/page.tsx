'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { governorates, getShipping } from '@/lib/shipping';
import { countries, carrierRates, calculateInternationalShipping, type Carrier } from '@/lib/international-shipping';

type Step = 'address' | 'payment' | 'confirm';
type PayMethod = 'cod' | 'card' | 'vodafone' | 'instapay' | 'paypal';
type ShippingType = 'local' | 'international';

interface AddressForm {
  fullName: string; phone: string; governorate: string;
  city: string; street: string; building: string; notes: string;
  // International
  country: string;
}

interface CardForm {
  number: string; name: string; expiry: string; cvv: string;
}

const EMPTY_ADDR: AddressForm = { fullName: '', phone: '', governorate: '', city: '', street: '', building: '', notes: '', country: '' };
const EMPTY_CARD: CardForm = { number: '', name: '', expiry: '', cvv: '' };

function StepDot({ n, current, done }: { n: number; current: boolean; done: boolean }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition ${
      done ? 'bg-green-500 text-white' : current ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
    }`}>
      {done ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg> : n}
    </div>
  );
}

function formatCardNumber(val: string) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(val: string) {
  const clean = val.replace(/\D/g, '').slice(0, 4);
  if (clean.length >= 3) return clean.slice(0, 2) + '/' + clean.slice(2);
  return clean;
}

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const { user } = useAuth();
  const { lang } = useLang();
  const isRtl = lang === 'ar';

  const [step, setStep] = useState<Step>('address');
  const [shippingType, setShippingType] = useState<ShippingType>('local');
  const [address, setAddress] = useState<AddressForm>({ ...EMPTY_ADDR, fullName: user?.name || '', phone: user?.phone || '' });
  const [carrier, setCarrier] = useState<Carrier>('aramex');
  const [payMethod, setPayMethod] = useState<PayMethod>('cod');

  // When switching shipping type, reset to valid payment method
  function handleShippingTypeChange(t: ShippingType) {
    setShippingType(t);
    if (t === 'international' && payMethod !== 'card') {
      setPayMethod('card');
    }
  }
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD);
  const [cardErrors, setCardErrors] = useState<Partial<CardForm>>({});
  const [errors, setErrors] = useState<Partial<AddressForm>>({});
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());

  // Total weight in grams
  const totalWeightGrams = items.reduce((sum, item) => sum + item.product.weight * item.quantity, 0);

  // Shipping cost
  const govObj = governorates.find(g => g.id === address.governorate);
  const countryObj = countries.find(c => c.code === address.country);

  let shippingCost = 0;
  if (shippingType === 'local' && address.governorate) {
    shippingCost = getShipping(address.governorate);
  } else if (shippingType === 'international' && address.country && totalWeightGrams > 0) {
    shippingCost = calculateInternationalShipping(totalWeightGrams, carrier, countryObj?.zone ?? 'world');
  }

  const steps: Step[] = ['address', 'payment', 'confirm'];
  const stepIdx = steps.indexOf(step);

  const L = {
    checkout: isRtl ? 'إتمام الشراء' : 'Checkout',
    address: isRtl ? 'عنوان التوصيل' : 'Delivery',
    payment: isRtl ? 'الدفع' : 'Payment',
    confirm: isRtl ? 'تأكيد' : 'Confirm',
    fullName: isRtl ? 'الاسم بالكامل' : 'Full Name',
    phone: isRtl ? 'رقم الهاتف' : 'Phone',
    governorate: isRtl ? 'المحافظة' : 'Governorate',
    city: isRtl ? 'المدينة / الحي' : 'City / District',
    street: isRtl ? 'اسم الشارع' : 'Street',
    building: isRtl ? 'رقم المبنى / الشقة (اختياري)' : 'Building / Apt (optional)',
    notes: isRtl ? 'ملاحظات للمندوب (اختياري)' : 'Notes (optional)',
    next: isRtl ? 'التالي' : 'Next',
    back: isRtl ? 'رجوع' : 'Back',
    place: isRtl ? 'تأكيد وإتمام الطلب' : 'Place Order',
    required: isRtl ? 'هذا الحقل مطلوب' : 'Required',
    currency: isRtl ? 'ج.م' : 'EGP',
    subtotal: isRtl ? 'المجموع' : 'Subtotal',
    shippingLabel: isRtl ? 'الشحن' : 'Shipping',
    totalLabel: isRtl ? 'الإجمالي' : 'Total',
    orderSummary: isRtl ? 'ملخص الطلب' : 'Order Summary',
    successTitle: isRtl ? 'تم تأكيد طلبك!' : 'Order Confirmed!',
    successDesc: isRtl ? 'شكراً! سيتواصل معك فريقنا لتأكيد التوصيل.' : 'Thank you! Our team will contact you to confirm delivery.',
    orderNo: isRtl ? 'رقم الطلب' : 'Order No.',
    continueShopping: isRtl ? 'مواصلة التسوق' : 'Continue Shopping',
    signInNote: isRtl ? 'سجل دخولك لحفظ عنوانك وتتبع طلباتك' : 'Sign in to save your address and track orders',
    signIn: isRtl ? 'تسجيل الدخول' : 'Sign In',
    localShipping: isRtl ? 'شحن داخل مصر' : 'Shipping within Egypt',
    intlShipping: isRtl ? 'شحن دولي' : 'International Shipping',
    selectCountry: isRtl ? 'اختر الدولة' : 'Select Country',
    country: isRtl ? 'الدولة' : 'Country',
    carrier: isRtl ? 'شركة الشحن' : 'Shipping Carrier',
    weightLabel: isRtl ? 'الوزن الإجمالي' : 'Total Weight',
    estimatedDays: isRtl ? 'مدة التوصيل المتوقعة' : 'Estimated Delivery',
    days: isRtl ? ' أيام عمل' : ' business days',
    // Card
    cardNumber: isRtl ? 'رقم البطاقة' : 'Card Number',
    cardName: isRtl ? 'اسم حامل البطاقة' : 'Cardholder Name',
    cardExpiry: isRtl ? 'تاريخ الانتهاء (MM/YY)' : 'Expiry Date (MM/YY)',
    cardCvv: isRtl ? 'الرمز الأمني (CVV)' : 'CVV',
    invalidCard: isRtl ? 'رقم بطاقة غير صحيح' : 'Invalid card number',
    invalidExpiry: isRtl ? 'تاريخ انتهاء غير صحيح' : 'Invalid expiry date',
    invalidCvv: isRtl ? 'الرمز الأمني غير صحيح' : 'Invalid CVV',
    securePayment: isRtl ? '🔒 الدفع آمن ومشفر' : '🔒 Secure & Encrypted Payment',
  };

  const inputClass = (err?: string) =>
    `w-full bg-gray-50 border rounded-xl px-4 py-3 outline-none transition text-gray-900 text-sm placeholder:text-gray-400 ${
      err ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-gray-400 focus:bg-white'
    }`;

  function validateAddress() {
    const e: Partial<AddressForm> = {};
    if (!address.fullName.trim()) e.fullName = L.required;
    if (!address.phone.trim()) e.phone = L.required;
    if (!address.city.trim()) e.city = L.required;
    if (!address.street.trim()) e.street = L.required;
    if (shippingType === 'local' && !address.governorate) e.governorate = L.required;
    if (shippingType === 'international' && !address.country) e.country = L.required;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function validateCard() {
    if (payMethod !== 'card') return true;
    const e: Partial<CardForm> = {};
    const digits = cardForm.number.replace(/\s/g, '');
    if (digits.length < 16) e.number = L.invalidCard;
    if (!cardForm.name.trim()) e.name = L.required;
    if (!cardForm.expiry.match(/^\d{2}\/\d{2}$/)) e.expiry = L.invalidExpiry;
    if (cardForm.cvv.length < 3) e.cvv = L.invalidCvv;
    setCardErrors(e);
    return !Object.keys(e).length;
  }

  function handlePlaceOrder() {
    clear();
    // Save order to localStorage if user is logged in
    if (user) {
      try {
        const key = `ml_orders_${user.id}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.unshift({ id: orderNumber, date: new Date().toLocaleDateString('ar-EG'), total: total + shippingCost, status: isRtl ? 'قيد التجهيز' : 'Processing' });
        localStorage.setItem(key, JSON.stringify(existing));
      } catch {}
    }
    setOrderPlaced(true);
  }

  if (items.length === 0 && !orderPlaced) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h1 className="text-xl font-black text-gray-900 mb-3">{isRtl ? 'عربة التسوق فارغة' : 'Your cart is empty'}</h1>
        <Link href="/" className="inline-block mt-4 bg-gray-900 hover:bg-gray-700 text-white font-bold px-8 py-3 rounded-xl transition text-sm">
          {isRtl ? 'تسوق الآن' : 'Shop Now'}
        </Link>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">{L.successTitle}</h1>
        <p className="text-gray-500 text-sm mb-8">{L.successDesc}</p>
        <div className="bg-gray-50 rounded-2xl px-6 py-4 inline-block mb-8">
          <p className="text-xs text-gray-400 mb-1">{L.orderNo}</p>
          <p className="text-2xl font-black text-gray-900">#{orderNumber}</p>
        </div>
        <div>
          <Link href="/" className="inline-block bg-gray-900 hover:bg-gray-700 text-white font-bold px-8 py-3 rounded-xl transition text-sm">
            {L.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  const selectedCarrierZoneRate = shippingType === 'international' && countryObj
    ? carrierRates[carrier][countryObj.zone]
    : null;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-6xl mx-auto px-4 py-10 pt-28">
      <h1 className="text-2xl font-black text-gray-900 mb-8">{L.checkout}</h1>

      {/* Progress */}
      <div className="flex items-center gap-0 mb-10">
        {[L.address, L.payment, L.confirm].map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <StepDot n={i + 1} current={i === stepIdx} done={i < stepIdx} />
              <span className={`text-sm font-semibold hidden sm:block ${i === stepIdx ? 'text-gray-900' : i < stepIdx ? 'text-green-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < 2 && <div className={`flex-1 h-px mx-3 ${i < stepIdx ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Guest note */}
      {!user && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 mb-6">
          <p className="text-sm text-blue-700">{L.signInNote}</p>
          <Link href={`/auth?redirect=/checkout`} className="text-sm font-bold text-blue-700 hover:underline shrink-0">{L.signIn}</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Step content */}
        <div className="lg:col-span-2">

          {/* STEP 1 — Address */}
          {step === 'address' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-black text-gray-900 mb-6">{L.address}</h2>

              {/* Shipping Type Toggle */}
              <div className="flex gap-2 mb-6">
                {([['local', L.localShipping], ['international', L.intlShipping]] as [ShippingType, string][]).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => handleShippingTypeChange(t)}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold border-2 transition ${
                      shippingType === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.fullName} *</label>
                  <input type="text" value={address.fullName}
                    onChange={e => setAddress(a => ({ ...a, fullName: e.target.value }))}
                    placeholder={isRtl ? 'الاسم بالكامل' : 'Full name'}
                    className={inputClass(errors.fullName)} />
                  {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.phone} *</label>
                  <input type="tel" value={address.phone} dir="ltr"
                    onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                    className={inputClass(errors.phone)} />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>

                {/* Local: governorate */}
                {shippingType === 'local' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.governorate} *</label>
                    <select value={address.governorate}
                      onChange={e => setAddress(a => ({ ...a, governorate: e.target.value }))}
                      className={inputClass(errors.governorate) + ' bg-white cursor-pointer'}>
                      <option value="">{isRtl ? 'اختر المحافظة' : 'Select'}</option>
                      {governorates.map(g => (
                        <option key={g.id} value={g.id}>
                          {isRtl ? g.name : g.nameEn} — {g.shipping} {L.currency}
                        </option>
                      ))}
                    </select>
                    {errors.governorate && <p className="text-red-500 text-xs mt-1">{errors.governorate}</p>}
                  </div>
                )}

                {/* International: country + carrier */}
                {shippingType === 'international' && (<>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.country} *</label>
                    <select value={address.country}
                      onChange={e => setAddress(a => ({ ...a, country: e.target.value }))}
                      className={inputClass(errors.country) + ' bg-white cursor-pointer'}>
                      <option value="">{L.selectCountry}</option>
                      {countries.map(c => (
                        <option key={c.code} value={c.code}>{isRtl ? c.name : c.nameEn}</option>
                      ))}
                    </select>
                    {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.carrier}</label>
                    <div className="flex gap-2">
                      {(['aramex', 'fedex', 'dhl'] as Carrier[]).map(c => (
                        <button key={c}
                          onClick={() => setCarrier(c)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition ${carrier === c ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 hover:border-gray-400 text-gray-700'}`}>
                          {c === 'aramex' ? 'Aramex' : c === 'fedex' ? 'FedEx' : 'DHL'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Carrier info */}
                  {selectedCarrierZoneRate && address.country && (
                    <div className="sm:col-span-2 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                          <p className="text-xs text-gray-500">{L.weightLabel}: <span className="font-bold text-gray-900">{(totalWeightGrams / 1000).toFixed(2)} kg</span></p>
                          <p className="text-xs text-gray-500 mt-0.5">{L.estimatedDays}: <span className="font-bold text-gray-900">{selectedCarrierZoneRate.estimatedDays}{L.days}</span></p>
                        </div>
                        <p className="font-black text-lg text-gray-900">{shippingCost} {L.currency}</p>
                      </div>
                    </div>
                  )}
                </>)}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.city} *</label>
                  <input type="text" value={address.city}
                    onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                    placeholder={isRtl ? 'مثال: مدينة نصر' : 'e.g. Nasr City'}
                    className={inputClass(errors.city)} />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.street} *</label>
                  <input type="text" value={address.street}
                    onChange={e => setAddress(a => ({ ...a, street: e.target.value }))}
                    placeholder={isRtl ? 'اسم الشارع' : 'Street name'}
                    className={inputClass(errors.street)} />
                  {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.building}</label>
                  <input type="text" value={address.building}
                    onChange={e => setAddress(a => ({ ...a, building: e.target.value }))}
                    placeholder={isRtl ? 'مبنى ١٢، شقة ٤' : 'Bldg 12, Apt 4'}
                    className={inputClass()} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.notes}</label>
                  <input type="text" value={address.notes}
                    onChange={e => setAddress(a => ({ ...a, notes: e.target.value }))}
                    placeholder={isRtl ? 'أي تعليمات للمندوب' : 'Any courier instructions'}
                    className={inputClass()} />
                </div>
              </div>
              <button onClick={() => validateAddress() && setStep('payment')}
                className="mt-6 w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-4 rounded-xl transition text-sm">
                {isRtl ? `← ${L.next}` : `${L.next} →`}
              </button>
            </div>
          )}

          {/* STEP 2 — Payment */}
          {step === 'payment' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-black text-gray-900 mb-6">{L.payment}</h2>
              {shippingType === 'international' && (
                <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 font-semibold">
                  {isRtl
                    ? 'الشحن الدولي: وسائل الدفع المحلية (عند الاستلام، فودافون كاش، إنستاباي) غير متاحة. يُقبل الدفع ببطاقة أو PayPal.'
                    : 'International Shipping: Local payment methods are not available. Please use card or PayPal.'}
                </div>
              )}
              <div className="flex flex-col gap-3">
                {([
                  { id: 'cod',      icon: '💵', title: isRtl ? 'الدفع عند الاستلام' : 'Cash on Delivery',     desc: isRtl ? 'ادفع نقداً عند وصول طلبك' : 'Pay cash when your order arrives', intl: false },
                  { id: 'card',     icon: '💳', title: isRtl ? 'بطاقة بنكية (فيزا / ماستركارد)' : 'Credit / Debit Card', desc: isRtl ? 'فيزا، ماستركارد، أو ميزة' : 'Visa, Mastercard, or Meeza', intl: true },
                  { id: 'paypal',   icon: '🅿️', title: 'PayPal',                                              desc: isRtl ? 'ادفع عبر حسابك على PayPal' : 'Pay with your PayPal account',      intl: true },
                  { id: 'vodafone', icon: '📱', title: 'Vodafone Cash',                                       desc: isRtl ? 'ادفع عبر محفظة فودافون كاش' : 'Pay via Vodafone Cash wallet',       intl: false },
                  { id: 'instapay', icon: '⚡', title: 'InstaPay',                                            desc: isRtl ? 'ادفع عبر تطبيق InstaPay' : 'Pay via InstaPay app',               intl: false },
                ] as const).filter(m => shippingType === 'local' || m.intl).map(m => (
                  <label key={m.id}
                    className={`flex items-center gap-4 border-2 rounded-2xl p-4 cursor-pointer transition ${
                      payMethod === m.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'
                    }`}>
                    <input type="radio" name="pay" value={m.id} checked={payMethod === m.id}
                      onChange={() => setPayMethod(m.id as PayMethod)}
                      className="accent-gray-900" />
                    <span className="text-xl">{m.icon}</span>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{m.title}</p>
                      {m.desc && <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>}
                    </div>
                  </label>
                ))}
              </div>

              {/* Card Form */}
              {payMethod === 'card' && (
                <div className="mt-5 bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                  <p className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">{L.securePayment}</p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.cardNumber} *</label>
                    <input
                      type="text" dir="ltr" inputMode="numeric"
                      value={cardForm.number}
                      onChange={e => setCardForm(f => ({ ...f, number: formatCardNumber(e.target.value) }))}
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      className={inputClass(cardErrors.number) + ' font-mono tracking-widest'}
                    />
                    {cardErrors.number && <p className="text-red-500 text-xs mt-1">{cardErrors.number}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.cardName} *</label>
                    <input
                      type="text" dir="ltr"
                      value={cardForm.name}
                      onChange={e => setCardForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                      placeholder="AHMED MOHAMED"
                      className={inputClass(cardErrors.name) + ' uppercase'}
                    />
                    {cardErrors.name && <p className="text-red-500 text-xs mt-1">{cardErrors.name}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.cardExpiry} *</label>
                      <input
                        type="text" dir="ltr" inputMode="numeric"
                        value={cardForm.expiry}
                        onChange={e => setCardForm(f => ({ ...f, expiry: formatExpiry(e.target.value) }))}
                        placeholder="MM/YY"
                        maxLength={5}
                        className={inputClass(cardErrors.expiry) + ' font-mono'}
                      />
                      {cardErrors.expiry && <p className="text-red-500 text-xs mt-1">{cardErrors.expiry}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.cardCvv} *</label>
                      <input
                        type="password" dir="ltr" inputMode="numeric"
                        value={cardForm.cvv}
                        onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                        placeholder="•••"
                        maxLength={4}
                        className={inputClass(cardErrors.cvv) + ' font-mono'}
                      />
                      {cardErrors.cvv && <p className="text-red-500 text-xs mt-1">{cardErrors.cvv}</p>}
                    </div>
                  </div>
                  {/* Card type icons */}
                  <div className="flex gap-2 items-center">
                    <span className="bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold text-blue-700">VISA</span>
                    <span className="bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold text-red-600">Mastercard</span>
                    <span className="bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold text-green-700">Meeza</span>
                  </div>
                </div>
              )}

              {(payMethod === 'vodafone' || payMethod === 'instapay') && (
                <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm">
                  <p className="font-semibold text-gray-900 mb-1">{isRtl ? 'أرسل المبلغ على الرقم:' : 'Send the amount to:'}</p>
                  <p className="font-black text-xl tracking-widest text-gray-900" dir="ltr">01060306803</p>
                  <p className="text-gray-500 text-xs mt-1">{isRtl ? 'ثم أرسل صورة التحويل على واتساب' : 'Then send screenshot on WhatsApp to confirm'}</p>
                </div>
              )}

              {payMethod === 'paypal' && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm">
                  <p className="font-semibold text-gray-900 mb-1">{isRtl ? 'الدفع عبر PayPal:' : 'Pay via PayPal:'}</p>
                  <p className="text-gray-500 text-xs mt-1">{isRtl ? 'بعد تأكيد الطلب سنرسل لك رابط الدفع عبر واتساب أو البريد الإلكتروني.' : 'After placing your order, we will send you a PayPal payment link via WhatsApp or email.'}</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('address')}
                  className="flex-1 border-2 border-gray-200 hover:border-gray-400 text-gray-700 font-bold py-3.5 rounded-xl transition text-sm">
                  {isRtl ? `${L.back} →` : `← ${L.back}`}
                </button>
                <button onClick={() => { if (validateCard()) setStep('confirm'); }}
                  className="flex-1 bg-gray-900 hover:bg-gray-700 text-white font-bold py-3.5 rounded-xl transition text-sm">
                  {isRtl ? `← ${L.next}` : `${L.next} →`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Confirm */}
          {step === 'confirm' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-black text-gray-900 mb-6">{L.confirm}</h2>

              <div className="flex flex-col gap-3 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{L.address}</p>
                    <button onClick={() => setStep('address')} className="text-xs text-purple-700 hover:underline">{isRtl ? 'تعديل' : 'Edit'}</button>
                  </div>
                  <p className="text-sm text-gray-700 font-semibold">{address.fullName} · {address.phone}</p>
                  <p className="text-sm text-gray-500">
                    {address.street}{address.building ? '، ' + address.building : ''}, {address.city}
                    {shippingType === 'local' && govObj ? `, ${isRtl ? govObj.name : govObj.nameEn}` : ''}
                    {shippingType === 'international' && countryObj ? `, ${isRtl ? countryObj.name : countryObj.nameEn}` : ''}
                  </p>
                  {shippingType === 'international' && (
                    <p className="text-xs text-gray-400 mt-1">{isRtl ? 'شركة الشحن:' : 'Carrier:'} {carrier.toUpperCase()}</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{L.payment}</p>
                    <button onClick={() => setStep('payment')} className="text-xs text-purple-700 hover:underline">{isRtl ? 'تعديل' : 'Edit'}</button>
                  </div>
                  <p className="text-sm text-gray-700">
                    {payMethod === 'cod' ? (isRtl ? 'الدفع عند الاستلام' : 'Cash on Delivery')
                      : payMethod === 'card' ? (isRtl ? `بطاقة تنتهي بـ ${cardForm.number.slice(-4)}` : `Card ending in ${cardForm.number.slice(-4)}`)
                      : payMethod === 'vodafone' ? 'Vodafone Cash'
                      : payMethod === 'paypal' ? 'PayPal'
                      : 'InstaPay'}
                  </p>
                </div>
              </div>

              <button onClick={handlePlaceOrder}
                className="w-full bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-black py-4 rounded-xl transition text-base">
                {L.place}
              </button>
              <button onClick={() => setStep('payment')}
                className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-700 transition">
                {isRtl ? `${L.back} →` : `← ${L.back}`}
              </button>
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-2xl p-5 sticky top-24">
            <h3 className="font-black text-gray-900 text-sm mb-4">{L.orderSummary}</h3>
            <div className="flex flex-col gap-3 mb-4">
              {items.map(item => {
                const displayImg = item.selectedModel !== undefined
                  ? item.product.images[item.selectedModel]
                  : item.product.images[0];
                return (
                  <div key={item.cartItemId} className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-white border border-gray-200 shrink-0">
                      <Image src={displayImg} alt={item.product.name} fill className="object-cover" unoptimized />
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-900 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {isRtl ? item.product.name : (item.product.nameEn || item.product.name)}
                      </p>
                      {item.selectedModel !== undefined && (
                        <p className="text-xs text-purple-600 font-semibold">
                          {isRtl ? `موديل ${item.selectedModel}` : `Model ${item.selectedModel}`}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">{item.product.weight}g × {item.quantity}</p>
                    </div>
                    <p className="text-xs font-black text-gray-900 shrink-0">{item.product.price * item.quantity} {L.currency}</p>
                  </div>
                );
              })}
            </div>
            <div className="border-t pt-3 flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>{L.subtotal}</span>
                <span className="font-semibold text-gray-900">{total} {L.currency}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>
                  {L.shippingLabel}
                  {shippingType === 'local' && address.governorate ? ` — ${isRtl ? govObj?.name : govObj?.nameEn}` : ''}
                  {shippingType === 'international' && address.country ? ` — ${carrier.toUpperCase()}` : ''}
                </span>
                <span className="font-semibold text-gray-900">{shippingCost > 0 ? `${shippingCost} ${L.currency}` : '—'}</span>
              </div>
              {shippingType === 'international' && totalWeightGrams > 0 && (
                <div className="flex justify-between text-gray-400 text-[10px]">
                  <span>{L.weightLabel}</span>
                  <span>{(totalWeightGrams / 1000).toFixed(2)} kg</span>
                </div>
              )}
              {shippingCost > 0 && (
                <div className="flex justify-between border-t pt-2 text-sm">
                  <span className="font-black text-gray-900">{L.totalLabel}</span>
                  <span className="font-black text-gray-900 text-base">{total + shippingCost} <span className="text-xs text-gray-500">{L.currency}</span></span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
