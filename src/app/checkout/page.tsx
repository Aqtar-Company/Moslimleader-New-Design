'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { governorates, getShipping } from '@/lib/shipping';
import {
  COUNTRIES,
  getIntlShippingConfig,
  calculateIntlShipping,
  DEFAULT_CONFIG,
  IntlShippingConfig,
  ShippingCalcResult,
} from '@/lib/intl-shipping';

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

// Regions for countries that have standard administrative divisions
const COUNTRY_REGIONS: Record<string, { ar: string; en: string }[]> = {
  SA: [
    { ar: 'الرياض', en: 'Riyadh' }, { ar: 'مكة المكرمة', en: 'Makkah' },
    { ar: 'المدينة المنورة', en: 'Madinah' }, { ar: 'القصيم', en: 'Qassim' },
    { ar: 'المنطقة الشرقية', en: 'Eastern Province' }, { ar: 'عسير', en: 'Asir' },
    { ar: 'تبوك', en: 'Tabuk' }, { ar: 'حائل', en: 'Hail' },
    { ar: 'الحدود الشمالية', en: 'Northern Borders' }, { ar: 'جازان', en: 'Jazan' },
    { ar: 'نجران', en: 'Najran' }, { ar: 'الباحة', en: 'Al Bahah' }, { ar: 'الجوف', en: 'Al Jawf' },
  ],
  AE: [
    { ar: 'أبوظبي', en: 'Abu Dhabi' }, { ar: 'دبي', en: 'Dubai' },
    { ar: 'الشارقة', en: 'Sharjah' }, { ar: 'عجمان', en: 'Ajman' },
    { ar: 'رأس الخيمة', en: 'Ras Al Khaimah' }, { ar: 'الفجيرة', en: 'Fujairah' },
    { ar: 'أم القيوين', en: 'Umm Al Quwain' },
  ],
  KW: [
    { ar: 'العاصمة', en: 'Capital' }, { ar: 'حولي', en: 'Hawalli' },
    { ar: 'الفروانية', en: 'Farwaniya' }, { ar: 'مبارك الكبير', en: 'Mubarak Al-Kabeer' },
    { ar: 'الأحمدي', en: 'Ahmadi' }, { ar: 'الجهراء', en: 'Jahra' },
  ],
  QA: [
    { ar: 'الدوحة', en: 'Doha' }, { ar: 'الريان', en: 'Al Rayyan' },
    { ar: 'الوكرة', en: 'Al Wakrah' }, { ar: 'الخور', en: 'Al Khor' },
    { ar: 'الشمال', en: 'Al Shamal' }, { ar: 'الضعاين', en: 'Al Daayen' },
  ],
  BH: [
    { ar: 'المنامة', en: 'Manama' }, { ar: 'المحرق', en: 'Muharraq' },
    { ar: 'الوسطى', en: 'Central' }, { ar: 'الشمالية', en: 'Northern' },
    { ar: 'الجنوبية', en: 'Southern' },
  ],
  OM: [
    { ar: 'مسقط', en: 'Muscat' }, { ar: 'ظفار', en: 'Dhofar' },
    { ar: 'مسندم', en: 'Musandam' }, { ar: 'البريمي', en: 'Al Buraymi' },
    { ar: 'الداخلية', en: 'Al Dakhiliyah' }, { ar: 'شمال الباطنة', en: 'North Al Batinah' },
    { ar: 'جنوب الباطنة', en: 'South Al Batinah' }, { ar: 'الشرقية الشمالية', en: 'North Al Sharqiyah' },
    { ar: 'الشرقية الجنوبية', en: 'South Al Sharqiyah' }, { ar: 'الوسطى', en: 'Al Wusta' },
  ],
  JO: [
    { ar: 'عمان', en: 'Amman' }, { ar: 'إربد', en: 'Irbid' }, { ar: 'الزرقاء', en: 'Zarqa' },
    { ar: 'العقبة', en: 'Aqaba' }, { ar: 'المفرق', en: 'Mafraq' }, { ar: 'الكرك', en: 'Karak' },
    { ar: 'جرش', en: 'Jerash' }, { ar: 'مأدبا', en: 'Madaba' }, { ar: 'عجلون', en: 'Ajloun' },
    { ar: 'الطفيلة', en: 'Tafilah' }, { ar: 'معان', en: "Ma'an" }, { ar: 'البلقاء', en: 'Balqa' },
  ],
  GB: [
    { ar: 'إنجلترا', en: 'England' }, { ar: 'اسكتلندا', en: 'Scotland' },
    { ar: 'ويلز', en: 'Wales' }, { ar: 'أيرلندا الشمالية', en: 'Northern Ireland' },
  ],
  US: [
    { ar: 'نيويورك', en: 'New York' }, { ar: 'كاليفورنيا', en: 'California' },
    { ar: 'تكساس', en: 'Texas' }, { ar: 'فلوريدا', en: 'Florida' },
    { ar: 'إلينوي', en: 'Illinois' }, { ar: 'بنسلفانيا', en: 'Pennsylvania' },
    { ar: 'أوهايو', en: 'Ohio' }, { ar: 'جورجيا', en: 'Georgia' },
    { ar: 'ميشيغان', en: 'Michigan' }, { ar: 'ولاية نيوجيرسي', en: 'New Jersey' },
    { ar: 'أخرى', en: 'Other' },
  ],
  CA: [
    { ar: 'أونتاريو', en: 'Ontario' }, { ar: 'كيبيك', en: 'Quebec' },
    { ar: 'كولومبيا البريطانية', en: 'British Columbia' }, { ar: 'ألبرتا', en: 'Alberta' },
    { ar: 'أخرى', en: 'Other' },
  ],
  DE: [
    { ar: 'برلين', en: 'Berlin' }, { ar: 'بافاريا', en: 'Bavaria' },
    { ar: 'هامبورغ', en: 'Hamburg' }, { ar: 'أخرى', en: 'Other' },
  ],
  TR: [
    { ar: 'إسطنبول', en: 'Istanbul' }, { ar: 'أنقرة', en: 'Ankara' },
    { ar: 'إزمير', en: 'Izmir' }, { ar: 'أنطاليا', en: 'Antalya' }, { ar: 'أخرى', en: 'Other' },
  ],
};
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
  const { items, coupon, clear } = useCart();
  const { user } = useAuth();
  const { lang } = useLang();
  const { getProductPrice, getCartRegionalTotal, formatPrice, zoneInfo } = useRegionalPricing();
  const isRtl = lang === 'ar';

  const { total, currency } = getCartRegionalTotal(items);
  const discount = coupon ? Math.round(total * coupon.pct / 100) : 0;

  const [intlConfig, setIntlConfig] = useState<IntlShippingConfig>(DEFAULT_CONFIG);
  const [step, setStep] = useState<Step>('address');
  const [shippingType, setShippingType] = useState<ShippingType>(
    zoneInfo.zone === 'egypt' ? 'local' : 'international'
  );
  const [address, setAddress] = useState<AddressForm>({
    ...EMPTY_ADDR,
    fullName: user?.name || '',
    phone: user?.phone || '',
    country: '',
  });
  const [payMethod, setPayMethod] = useState<PayMethod>(
    zoneInfo.zone === 'egypt' ? 'cod' : 'card'
  );
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD);
  const [cardErrors, setCardErrors] = useState<Partial<CardForm>>({});
  const [errors, setErrors] = useState<Partial<AddressForm>>({});
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());

  // Load intl config
  useEffect(() => {
    setIntlConfig(getIntlShippingConfig());
  }, []);

  // Sync shipping type when zone detection completes
  useEffect(() => {
    if (zoneInfo.zone === 'egypt') {
      setShippingType('local');
    } else {
      setShippingType('international');
setPayMethod(p => (p === 'cod' || p === 'vodafone' || p === 'instapay') ? 'card' : p);
    }
  }, [zoneInfo.zone]);

  // Total weight in kg
  const totalWeightGrams = items.reduce((sum, item) => sum + item.product.weight * item.quantity, 0);
  const totalWeightKg = totalWeightGrams / 1000;

  // Shipping calculation
  const govObj = governorates.find(g => g.id === address.governorate);
  const countryObj = COUNTRIES.find(c => c.code === address.country);

  let shippingCost = 0;
  let shippingCurrency = currency;
  let intlShippingResult: ShippingCalcResult | null = null;

  if (shippingType === 'local' && address.governorate) {
    shippingCost = getShipping(address.governorate);
    shippingCurrency = 'ج.م';
  } else if (shippingType === 'international' && address.country) {
    intlShippingResult = calculateIntlShipping(totalWeightKg, address.country, intlConfig);
    if (intlShippingResult.ok) {
      shippingCost = intlShippingResult.amount;
      shippingCurrency = intlShippingResult.currency;
    }
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
    currency: currency,
    subtotal: isRtl ? 'المجموع' : 'Subtotal',
    discount: isRtl ? 'خصم' : 'Discount',
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

  async function handlePlaceOrder() {
    clear();
    // Save order to localStorage if user is logged in
    if (user) {
      try {
        const key = `ml_orders_${user.id}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.unshift({ id: orderNumber, date: new Date().toLocaleDateString('ar-EG'), total: total - discount + shippingCost, status: isRtl ? 'قيد التجهيز' : 'Processing' });
        localStorage.setItem(key, JSON.stringify(existing));
      } catch {}
    }

    // Send order notification email
    const itemsList = items.map(item =>
      `${item.product.name} × ${item.quantity} = ${getProductPrice(item.product).price * item.quantity} ${currency}`
    ).join('\n');

    const payLabel = payMethod === 'cod' ? 'الدفع عند الاستلام'
      : payMethod === 'card' ? `بطاقة تنتهي بـ ${cardForm.number.slice(-4)}`
      : payMethod === 'vodafone' ? 'Vodafone Cash'
      : payMethod === 'paypal' ? 'PayPal'
      : 'InstaPay';

    const addressLine = shippingType === 'local'
      ? `${address.street}${address.building ? '، ' + address.building : ''}, ${address.city}, ${govObj?.name ?? ''}`
      : `${address.street}${address.building ? '، ' + address.building : ''}, ${address.city}, ${countryObj?.nameAr ?? address.country}`;

    const orderBody = `
طلب جديد #${orderNumber}
التاريخ: ${new Date().toLocaleString('ar-EG')}

العميل: ${address.fullName}
الهاتف: ${address.phone}
العنوان: ${addressLine}

المنتجات:
${itemsList}

المجموع الفرعي: ${total} ${currency}
${discount > 0 ? `الخصم (${coupon?.code}): -${discount} ${currency}\n` : ''}الشحن: ${shippingCost > 0 ? `${shippingCost} ${shippingCurrency}` : 'مجاني'}
طريقة الدفع: ${payLabel}
    `.trim();

    try {
      await fetch('https://formsubmit.co/ajax/orders@moslimleader.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `طلب جديد #${orderNumber} — ${address.fullName}`,
          _template: 'table',
          order_number: orderNumber,
          customer_name: address.fullName,
          customer_phone: address.phone,
          address: addressLine,
          items: itemsList,
          subtotal: `${total} ${currency}`,
          discount: discount > 0 ? `-${discount} ${currency}` : '—',
          shipping: shippingCost > 0 ? `${shippingCost} ${shippingCurrency}` : 'مجاني',
          payment: payLabel,
          message: orderBody,
        }),
      });
    } catch { /* email failure shouldn't block order */ }

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
    const finalTotal = total - discount + (shippingCurrency === currency ? shippingCost : 0);
    const payLabel = payMethod === 'cod' ? 'الدفع عند الاستلام'
      : payMethod === 'card' ? `بطاقة تنتهي بـ ${cardForm.number.slice(-4)}`
      : payMethod === 'vodafone' ? 'Vodafone Cash'
      : payMethod === 'paypal' ? 'PayPal'
      : 'InstaPay';

    return (
      <div className="max-w-xl mx-auto px-4 py-16 pt-28" dir="rtl">
        {/* Success icon */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3">🎉 تم تأكيد طلبك!</h1>
          <p className="text-gray-600 text-base leading-relaxed max-w-sm mx-auto">
            جزاك الله خيرًا على ثقتك بنا! طلبك وصلنا وسيتواصل معك فريقنا قريبًا لتأكيد التوصيل.
          </p>
        </div>

        {/* Motivational banner */}
        <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] rounded-2xl px-6 py-5 mb-6 text-white text-center">
          <p className="text-xl mb-1">🌟</p>
          <p className="font-black text-base mb-1">أنت تبني جيلًا واعيًا!</p>
          <p className="text-white/70 text-sm">كل هدية من مسلم ليدر هي استثمار في مستقبل أطفالنا المسلمين</p>
        </div>

        {/* Invoice card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          {/* Header */}
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-semibold">رقم الطلب</p>
              <p className="text-xl font-black text-gray-900">#{orderNumber}</p>
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-400 font-semibold">التاريخ</p>
              <p className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString('ar-EG')}</p>
            </div>
          </div>

          {/* Items */}
          <div className="px-5 py-4 space-y-3 border-b border-gray-100">
            <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">المنتجات</p>
            {items.map(item => (
              <div key={item.cartItemId} className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 shrink-0">
                  <Image src={item.product.images[item.selectedModel ?? 0]} alt={item.product.name} fill className="object-cover" unoptimized />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.product.name}</p>
                  <p className="text-xs text-gray-400">{item.quantity} × {formatPrice(getProductPrice(item.product))}</p>
                </div>
                <p className="text-sm font-black text-gray-900 shrink-0">
                  {formatPrice({ ...getProductPrice(item.product), price: getProductPrice(item.product).price * item.quantity })}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-5 py-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>المجموع الفرعي</span>
              <span className="font-semibold text-gray-900">{total} {currency}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>خصم ({coupon?.code})</span>
                <span className="font-semibold">−{discount} {currency}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>الشحن</span>
              <span className="font-semibold text-gray-900">
                {shippingCost > 0 ? `${shippingCost} ${shippingCurrency}` : 'مجاني'}
              </span>
            </div>
            {shippingCurrency === currency && (
              <div className="flex justify-between border-t pt-2 font-black text-base">
                <span className="text-gray-900">الإجمالي</span>
                <span className="text-gray-900">{finalTotal} {currency}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500 pt-1">
              <span>طريقة الدفع</span>
              <span className="font-semibold text-gray-800">{payLabel}</span>
            </div>
          </div>

          {/* Address */}
          <div className="bg-gray-50 border-t border-gray-100 px-5 py-3">
            <p className="text-xs font-black text-gray-500 mb-1">عنوان التوصيل</p>
            <p className="text-sm text-gray-700 font-semibold">{address.fullName} · {address.phone}</p>
            <p className="text-xs text-gray-500">
              {address.street}{address.building ? '، ' + address.building : ''}, {address.city}
              {shippingType === 'local' && govObj ? `, ${govObj.name}` : ''}
              {shippingType === 'international' && countryObj ? `, ${countryObj.nameAr}` : ''}
            </p>
          </div>
        </div>

        <div className="text-center space-y-3">
          <p className="text-xs text-gray-400">📩 تم إرسال تأكيد الطلب إلى فريقنا وسنتواصل معك قريبًا</p>
          <Link href="/" className="inline-block bg-gray-900 hover:bg-gray-700 text-white font-bold px-10 py-3.5 rounded-xl transition text-sm">
            {L.continueShopping}
          </Link>
        </div>
      </div>
    );
  }


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

              {/* Shipping mode badge — auto-determined from user zone */}
              <div className="flex items-center gap-2 mb-6 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-lg">{zoneInfo.flag}</span>
                <div>
                  <p className="text-sm font-black text-gray-900">
                    {shippingType === 'local' ? L.localShipping : L.intlShipping}
                  </p>
                  <p className="text-xs text-gray-500">{zoneInfo.label}</p>
                </div>
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

                {/* International disabled banner */}
                {shippingType === 'international' && !intlConfig.enabled && (
                  <div className="sm:col-span-2 bg-red-50 border-2 border-red-200 rounded-xl px-4 py-4 text-center">
                    <p className="text-2xl mb-1">⛔</p>
                    <p className="font-black text-red-700 text-sm">الشحن الدولي غير متاح حاليًا</p>
                    <p className="text-xs text-red-500 mt-1">يرجى التواصل معنا مباشرة للاستفسار عن الشحن خارج مصر</p>
                  </div>
                )}

              {/* International: country + shipping result */}
                {shippingType === 'international' && intlConfig.enabled && (<>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.country} *</label>
                    <select value={address.country}
                      onChange={e => setAddress(a => ({ ...a, country: e.target.value }))}
                      className={inputClass(errors.country) + ' bg-white cursor-pointer'}>
                      <option value="">{L.selectCountry}</option>
                      {COUNTRIES.filter(c => c.code !== 'EG').map(c => (
                        <option key={c.code} value={c.code}>{isRtl ? c.nameAr : c.nameEn}</option>
                      ))}
                    </select>
                    {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
                  </div>

                  {/* Shipping cost result */}
                  {address.country && intlShippingResult && (
                    <div className={`sm:col-span-2 rounded-xl p-4 text-sm border ${intlShippingResult.ok ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                      {intlShippingResult.ok ? (
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <p className="text-xs text-gray-500">
                              {L.weightLabel}: <span className="font-bold text-gray-900">{totalWeightKg.toFixed(2)} kg</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{intlShippingResult.zoneName}</p>
                          </div>
                          <p className="font-black text-lg text-gray-900">
                            {intlShippingResult.amount} {intlShippingResult.currency}
                          </p>
                        </div>
                      ) : (
                        <p className="text-red-700 font-semibold text-xs">{intlShippingResult.message}</p>
                      )}
                    </div>
                  )}
                </>)}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {COUNTRY_REGIONS[address.country] ? (isRtl ? 'المنطقة / المحافظة' : 'Region / Province') : L.city} *
                  </label>
                  {COUNTRY_REGIONS[address.country] ? (
                    <select value={address.city}
                      onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                      className={inputClass(errors.city) + ' bg-white cursor-pointer'}>
                      <option value="">{isRtl ? 'اختر المنطقة' : 'Select Region'}</option>
                      {COUNTRY_REGIONS[address.country].map(r => (
                        <option key={r.en} value={isRtl ? r.ar : r.en}>{isRtl ? r.ar : r.en}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={address.city}
                      onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                      placeholder={isRtl ? 'مثال: مدينة نصر' : 'e.g. Nasr City'}
                      className={inputClass(errors.city)} />
                  )}
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
              <button
                onClick={() => validateAddress() && setStep('payment')}
                disabled={shippingType === 'international' && !intlConfig.enabled}
                className={`mt-6 w-full font-bold py-4 rounded-xl transition text-sm ${
                  shippingType === 'international' && !intlConfig.enabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 hover:bg-gray-700 text-white'
                }`}>
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
                    {shippingType === 'international' && countryObj ? `, ${isRtl ? countryObj.nameAr : countryObj.nameEn}` : ''}
                  </p>
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
                    <p className="text-xs font-black text-gray-900 shrink-0">{formatPrice({ ...getProductPrice(item.product), price: getProductPrice(item.product).price * item.quantity })}</p>
                  </div>
                );
              })}
            </div>
            <div className="border-t pt-3 flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>{L.subtotal}</span>
                <span className="font-semibold text-gray-900">{total} {L.currency}</span>
              </div>
              {coupon && discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{L.discount} ({coupon.pct}%) — <span className="font-bold">{coupon.code}</span></span>
                  <span className="font-semibold">−{discount} {L.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>
                  {L.shippingLabel}
                  {shippingType === 'local' && address.governorate ? ` — ${isRtl ? govObj?.name : govObj?.nameEn}` : ''}
                  {shippingType === 'international' && address.country && countryObj ? ` — ${isRtl ? countryObj.nameAr : countryObj.nameEn}` : ''}
                </span>
                <span className="font-semibold text-gray-900">
                  {shippingCost > 0
                    ? `${shippingCost} ${shippingCurrency}`
                    : intlShippingResult && !intlShippingResult.ok
                      ? <span className="text-red-500 text-[10px]">{intlShippingResult.message}</span>
                      : '—'}
                </span>
              </div>
              {shippingType === 'international' && totalWeightKg > 0 && (
                <div className="flex justify-between text-gray-400 text-[10px]">
                  <span>{L.weightLabel}</span>
                  <span>{totalWeightKg.toFixed(2)} kg</span>
                </div>
              )}
              {/* Show combined total only when shipping currency matches product currency */}
              {shippingCost > 0 && shippingCurrency === currency && (
                <div className="flex justify-between border-t pt-2 text-sm">
                  <span className="font-black text-gray-900">{L.totalLabel}</span>
                  <span className="font-black text-gray-900 text-base">{total - discount + shippingCost} <span className="text-xs text-gray-500">{currency}</span></span>
                </div>
              )}
              {/* When currencies differ (e.g. EGP products + USD shipping), show each line separately */}
              {shippingCost > 0 && shippingCurrency !== currency && (
                <div className="flex flex-col gap-1 border-t pt-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-700">{isRtl ? 'المنتجات' : 'Products'}</span>
                    <span className="font-bold text-gray-900">{total - discount} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-700">{L.shippingLabel}</span>
                    <span className="font-bold text-gray-900">{shippingCost} {shippingCurrency}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
