'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { COUNTRY_CURRENCIES } from '@/lib/geo-pricing';
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
  firstName: string; lastName: string;
  phone: string; whatsappSame: boolean; whatsappNumber: string;
  governorate: string;
  region: string;    // region/emirate (from COUNTRY_REGIONS)
  city: string; street: string; building: string; notes: string;
  country: string;
}

interface CardForm {
  number: string; name: string; expiry: string; cvv: string;
}

const EMPTY_ADDR: AddressForm = {
  firstName: '', lastName: '', phone: '', whatsappSame: true, whatsappNumber: '',
  governorate: '', region: '', city: '', street: '', building: '', notes: '', country: '',
};

// Phone dialing codes per country
const COUNTRY_DIAL_CODES: Record<string, string> = {
  EG:'+20', SA:'+966', AE:'+971', KW:'+965', QA:'+974', BH:'+973', OM:'+968',
  JO:'+962', LB:'+961', IQ:'+964', PS:'+970', MA:'+212', TN:'+216', DZ:'+213',
  GB:'+44', DE:'+49', FR:'+33', IT:'+39', ES:'+34', NL:'+31', TR:'+90',
  US:'+1', CA:'+1', AU:'+61', SE:'+46', BE:'+32', NO:'+47', DK:'+45',
  IN:'+91', PK:'+92', NG:'+234', GH:'+233', KE:'+254', ZA:'+27',
};

// Capital city per country (for city field placeholder)
const COUNTRY_CAPITALS: Record<string, { ar: string; en: string }> = {
  EG: { ar: 'القاهرة', en: 'Cairo' }, SA: { ar: 'الرياض', en: 'Riyadh' },
  AE: { ar: 'دبي', en: 'Dubai' }, KW: { ar: 'الكويت', en: 'Kuwait City' },
  QA: { ar: 'الدوحة', en: 'Doha' }, BH: { ar: 'المنامة', en: 'Manama' },
  OM: { ar: 'مسقط', en: 'Muscat' }, JO: { ar: 'عمّان', en: 'Amman' },
  LB: { ar: 'بيروت', en: 'Beirut' }, IQ: { ar: 'بغداد', en: 'Baghdad' },
  PS: { ar: 'رام الله', en: 'Ramallah' }, MA: { ar: 'الدار البيضاء', en: 'Casablanca' },
  TN: { ar: 'تونس', en: 'Tunis' }, DZ: { ar: 'الجزائر', en: 'Algiers' },
  GB: { ar: 'لندن', en: 'London' }, DE: { ar: 'برلين', en: 'Berlin' },
  FR: { ar: 'باريس', en: 'Paris' }, IT: { ar: 'روما', en: 'Rome' },
  ES: { ar: 'مدريد', en: 'Madrid' }, NL: { ar: 'أمستردام', en: 'Amsterdam' },
  TR: { ar: 'أنقرة', en: 'Ankara' }, US: { ar: 'نيويورك', en: 'New York' },
  CA: { ar: 'تورنتو', en: 'Toronto' }, AU: { ar: 'سيدني', en: 'Sydney' },
  SE: { ar: 'ستوكهولم', en: 'Stockholm' }, BE: { ar: 'بروكسل', en: 'Brussels' },
  NO: { ar: 'أوسلو', en: 'Oslo' }, DK: { ar: 'كوبنهاغن', en: 'Copenhagen' },
  IN: { ar: 'مومباي', en: 'Mumbai' }, PK: { ar: 'كراتشي', en: 'Karachi' },
  NG: { ar: 'لاغوس', en: 'Lagos' }, GH: { ar: 'أكرا', en: 'Accra' },
  KE: { ar: 'نيروبي', en: 'Nairobi' }, ZA: { ar: 'جوهانسبرغ', en: 'Johannesburg' },
};

// Estimated delivery days per shipping zone
const ZONE_DELIVERY_DAYS: Record<string, string> = {
  gulf:'3–5', arab:'5–7', europe:'7–14', americas:'10–20',
  asia:'7–14', africa:'10–21', rest:'10–21',
};

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
  const { getProductPrice, getCartRegionalTotal, formatPrice, zoneInfo, countryCode, originCountryCode, setCountry } = useRegionalPricing();
  // Is the user originally from Egypt (by IP)?
  const isUserFromEgypt = !originCountryCode || originCountryCode === 'EG';
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
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    phone: user?.phone || '',
    country: '',
  });
  const [enabledPaymentIds, setEnabledPaymentIds] = useState<string[]>(['cod', 'card', 'paypal', 'vodafone', 'instapay']);
  useEffect(() => {
    fetch('/api/admin/settings?key=payment-methods')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.value)) {
          setEnabledPaymentIds(
            d.value.filter((m: { id: string; enabled: boolean }) => m.enabled).map((m: { id: string }) => m.id)
          );
        }
      })
      .catch(() => {});
  }, []);
  const [payMethod, setPayMethod] = useState<PayMethod>(
    zoneInfo.zone === 'egypt' ? 'cod' : 'card'
  );
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD);
  const [cardErrors, setCardErrors] = useState<Partial<CardForm>>({});
  const [errors, setErrors] = useState<Partial<AddressForm>>({});
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());

  // Snapshot captured before cart is cleared — used in success page
  const [snapshot, setSnapshot] = useState<{
    items: typeof items;
    total: number;
    discount: number;
    shippingCost: number;
    shippingCurrency: string;
    currency: string;
  } | null>(null);

  // Load intl config
  useEffect(() => {
    setIntlConfig(getIntlShippingConfig());
  }, []);

  // Sync shipping type + pre-fill country when zone/country detection completes
  useEffect(() => {
    if (zoneInfo.zone === 'egypt') {
      setShippingType('local');
    } else {
      setShippingType('international');
      setPayMethod(p => (p === 'cod' || p === 'vodafone' || p === 'instapay') ? 'card' : p);
      // Pre-fill country from detected/selected country code
      if (countryCode && countryCode !== 'EG') {
        setAddress(a => ({ ...a, country: a.country || countryCode }));
      }
    }
  }, [zoneInfo.zone, countryCode]);

  // Total weight in kg
  const totalWeightGrams = items.reduce((sum, item) => sum + item.product.weight * item.quantity, 0);
  const totalWeightKg = totalWeightGrams / 1000;

  // Shipping calculation
  const govObj = governorates.find(g => g.id === address.governorate);
  const countryObj = COUNTRIES.find(c => c.code === address.country);

  let shippingCost = 0;
  let shippingCurrency = currency;
  let intlShippingResult: ShippingCalcResult | null = null;

  // Case: international user shipping to Egypt — use local EGP shipping rate, convert to their currency
  const intlUserShippingToEgypt = shippingType === 'international' && address.country === 'EG' && !isUserFromEgypt;

  if (shippingType === 'local' && address.governorate) {
    shippingCost = getShipping(address.governorate);
    shippingCurrency = 'ج.م';
  } else if (intlUserShippingToEgypt && address.governorate) {
    // Egypt delivery: get EGP rate, convert to user's country currency
    const egpShipping = getShipping(address.governorate);
    const userCurr = originCountryCode ? COUNTRY_CURRENCIES[originCountryCode] : null;
    if (userCurr && userCurr.currencyEn !== 'EGP') {
      // EGP → USD → user currency  (1 USD ≈ 50 EGP)
      const egpToUsd = egpShipping / 50;
      shippingCost = Math.round(egpToUsd * userCurr.usdRate * 10) / 10;
      shippingCurrency = userCurr.currency;
    } else {
      shippingCost = egpShipping;
      shippingCurrency = 'ج.م';
    }
  } else if (shippingType === 'international' && address.country && address.country !== 'EG') {
    intlShippingResult = calculateIntlShipping(totalWeightKg, address.country, intlConfig);
    if (intlShippingResult.ok) {
      const localCurr = COUNTRY_CURRENCIES[address.country.toUpperCase()];
      if (localCurr && localCurr.currencyEn !== 'USD') {
        shippingCost = Math.round(intlShippingResult.amount * localCurr.usdRate * 10) / 10;
        shippingCurrency = localCurr.currency;
      } else {
        shippingCost = intlShippingResult.amount;
        shippingCurrency = intlShippingResult.currency;
      }
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
    firstName: isRtl ? 'الاسم الأول' : 'First Name',
    lastName: isRtl ? 'اسم العائلة' : 'Last Name',
    phone: isRtl ? 'رقم الجوال' : 'Phone',
    whatsappQ: isRtl ? 'هل رقم WhatsApp هو نفسه رقم الجوال؟' : 'Is WhatsApp the same as phone?',
    whatsappYes: isRtl ? 'نعم' : 'Yes',
    whatsappNo: isRtl ? 'لا' : 'No',
    whatsappNumberLabel: isRtl ? 'رقم واتساب' : 'WhatsApp Number',
    regionLabel: isRtl ? 'المنطقة / الإمارة' : 'Region / Emirate',
    cityLabel: isRtl ? 'المدينة / المحافظة' : 'City / Province',
    streetLabel: isRtl ? 'الشارع، العناوين' : 'Street, Address',
    buildingLabel: isRtl ? 'المبنى، الوحدة السكنية، الطابق، الشقة (اختياري)' : 'Building, Unit, Floor, Apt (optional)',
    deliveryBadge: isRtl ? 'أسرع توصيل خلال' : 'Est. delivery in',
    deliveryDays: isRtl ? 'أيام عمل' : 'business days',
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
    if (!address.firstName.trim()) e.firstName = L.required;
    if (!address.lastName.trim()) e.lastName = L.required;
    if (!address.phone.trim()) e.phone = L.required;
    if (!address.whatsappSame && !address.whatsappNumber.trim()) e.whatsappNumber = L.required;
    if (!address.street.trim()) e.street = L.required;
    if (shippingType === 'local' && !address.governorate) e.governorate = L.required;
    if (shippingType === 'international' && !address.country) e.country = L.required;
    // Egypt destination for international user: governorate required for shipping calc; no city needed
    if (intlUserShippingToEgypt && !address.governorate) e.governorate = L.required;
    if (!intlUserShippingToEgypt && !address.city.trim()) e.city = L.required;
    setErrors(e);
    return !Object.keys(e).length;
  }

  const fullName = `${address.firstName} ${address.lastName}`.trim();

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
    // Capture snapshot BEFORE clearing cart
    setSnapshot({ items: [...items], total, discount, shippingCost, shippingCurrency, currency });
    clear();
    // Save order to database via API
    if (user) {
      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            items: items.map(item => ({
              productId: item.product.id,
              quantity: item.quantity,
              selectedModel: item.selectedModel,
              unitPrice: getProductPrice(item.product).price,
              productName: item.product.name,
              productImage: item.product.images?.[0] ?? null,
            })),
            total: total - discount + shippingCost,
            shippingCost,
            discount,
            couponCode: coupon?.code ?? null,
            paymentMethod: payMethod,
            shippingAddress: address,
            notes: address.notes,
            currency,
          }),
        });
      } catch { /* DB failure shouldn't block order confirmation */ }
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

    const dialCode = COUNTRY_DIAL_CODES[address.country] || COUNTRY_DIAL_CODES['EG'];
    const addressLine = shippingType === 'local'
      ? `${address.street}${address.building ? '، ' + address.building : ''}, ${address.city}, ${govObj?.name ?? ''}`
      : `${address.street}${address.building ? '، ' + address.building : ''}, ${address.city}${address.region ? '، ' + address.region : ''}, ${countryObj?.nameAr ?? address.country}`;

    const orderBody = `
طلب جديد #${orderNumber}
التاريخ: ${new Date().toLocaleString('ar-EG')}

العميل: ${fullName}
الهاتف: ${dialCode} ${address.phone}
واتساب: ${address.whatsappSame ? 'نفس رقم الهاتف' : address.whatsappNumber}
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
          _subject: `طلب جديد #${orderNumber} — ${fullName}`,
          _template: 'table',
          order_number: orderNumber,
          customer_name: fullName,
          customer_phone: `${dialCode} ${address.phone}`,
          whatsapp: address.whatsappSame ? 'Same as phone' : address.whatsappNumber,
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
    // Use snapshot values (cart was cleared after placing order)
    const snap = snapshot ?? { items: [], total: 0, discount: 0, shippingCost: 0, shippingCurrency: currency, currency };
    const snapTotal = snap.total;
    const snapDiscount = snap.discount;
    const snapShippingCost = snap.shippingCost;
    const snapShippingCurrency = snap.shippingCurrency;
    const snapCurrency = snap.currency;
    const snapItems = snap.items;
    const finalTotal = snapTotal - snapDiscount + (snapShippingCurrency === snapCurrency ? snapShippingCost : 0);
    const payLabelSuccess = payMethod === 'cod'
      ? (isRtl ? 'الدفع عند الاستلام' : 'Cash on Delivery')
      : payMethod === 'card'
        ? (isRtl ? `بطاقة تنتهي بـ ${cardForm.number.slice(-4)}` : `Card ending in ${cardForm.number.slice(-4)}`)
        : payMethod === 'vodafone' ? 'Vodafone Cash'
        : payMethod === 'paypal' ? 'PayPal'
        : 'InstaPay';

    return (
      <div className="max-w-xl mx-auto px-4 py-16 pt-28" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Success icon */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3">🎉 {isRtl ? 'تم تأكيد طلبك!' : 'Order Confirmed!'}</h1>
          <p className="text-gray-600 text-base leading-relaxed max-w-sm mx-auto">
            {isRtl
              ? 'جزاك الله خيرًا على ثقتك بنا! طلبك وصلنا وسيتواصل معك فريقنا قريبًا لتأكيد التوصيل.'
              : 'Thank you for your trust! Your order has been received and our team will contact you shortly to confirm delivery.'}
          </p>
        </div>

        {/* Motivational banner */}
        <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] rounded-2xl px-6 py-5 mb-6 text-white text-center">
          <p className="text-xl mb-1">🌟</p>
          <p className="font-black text-base mb-1">
            {isRtl ? 'أنت تبني جيلًا واعيًا!' : 'You are raising a mindful generation!'}
          </p>
          <p className="text-white/70 text-sm">
            {isRtl
              ? 'كل هدية من مسلم ليدر هي استثمار في مستقبل أطفالنا المسلمين'
              : 'Every Moslim Leader gift is an investment in the future of our Muslim children'}
          </p>
        </div>

        {/* Invoice card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          {/* Brand header */}
          <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-5 py-4 flex items-center justify-between">
            <Image
              src="/white-Logo.webp"
              alt="Moslim Leader"
              width={120}
              height={40}
              className="h-10 w-auto"
              unoptimized
            />
            <div className={isRtl ? 'text-left' : 'text-right'}>
              <p className="text-[#F5C518] text-xs font-bold tracking-wide">
                {isRtl ? 'تأكيد الطلب' : 'Order Confirmation'}
              </p>
              <p className="text-white/60 text-xs mt-0.5">
                {new Date().toLocaleDateString(isRtl ? 'ar-EG' : 'en-GB')}
              </p>
            </div>
          </div>
          {/* Order meta row */}
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-semibold">{isRtl ? 'رقم الطلب' : 'Order No.'}</p>
              <p className="text-xl font-black text-gray-900">#{orderNumber}</p>
            </div>
            <span className="text-xs font-bold text-[#6B21A8] bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-full">
              {isRtl ? '✓ تم التأكيد' : '✓ Confirmed'}
            </span>
          </div>

          {/* Items */}
          <div className="px-5 py-4 space-y-3 border-b border-gray-100">
            <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">
              {isRtl ? 'المنتجات' : 'Items'}
            </p>
            {snapItems.map(item => (
              <div key={item.cartItemId} className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 shrink-0">
                  <Image src={item.product.images[item.selectedModel ?? 0]} alt={item.product.name} fill className="object-cover" unoptimized />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {isRtl ? item.product.name : (item.product.nameEn || item.product.name)}
                  </p>
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
              <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <span className="font-semibold text-gray-900">{snapTotal} {snapCurrency}</span>
            </div>
            {snapDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>{isRtl ? `خصم (${coupon?.code})` : `Discount (${coupon?.code})`}</span>
                <span className="font-semibold">−{snapDiscount} {snapCurrency}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>{isRtl ? 'الشحن' : 'Shipping'}</span>
              <span className="font-semibold text-gray-900">
                {snapShippingCost > 0 ? `${snapShippingCost} ${snapShippingCurrency}` : (isRtl ? 'مجاني' : 'Free')}
              </span>
            </div>
            {snapShippingCurrency === snapCurrency && (
              <div className="flex justify-between border-t pt-2 font-black text-base">
                <span className="text-gray-900">{isRtl ? 'الإجمالي' : 'Total'}</span>
                <span className="text-gray-900">{finalTotal} {snapCurrency}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500 pt-1">
              <span>{isRtl ? 'طريقة الدفع' : 'Payment'}</span>
              <span className="font-semibold text-gray-800">{payLabelSuccess}</span>
            </div>
          </div>

          {/* Address */}
          <div className="bg-gray-50 border-t border-gray-100 px-5 py-3">
            <p className="text-xs font-black text-gray-500 mb-1">{isRtl ? 'عنوان التوصيل' : 'Delivery Address'}</p>
            <p className="text-sm text-gray-700 font-semibold">{fullName} · {COUNTRY_DIAL_CODES[address.country] || COUNTRY_DIAL_CODES['EG']} {address.phone}</p>
            <p className="text-xs text-gray-500">
              {address.street}{address.building ? '، ' + address.building : ''}, {address.city}
              {address.region ? `, ${address.region}` : ''}
              {shippingType === 'local' && govObj ? `, ${isRtl ? govObj.name : govObj.nameEn}` : ''}
              {shippingType === 'international' && countryObj ? `, ${isRtl ? countryObj.nameAr : countryObj.nameEn}` : ''}
            </p>
          </div>
        </div>

        <div className="text-center space-y-3">
          <p className="text-xs text-gray-400">
            📩 {isRtl ? 'تم إرسال تأكيد الطلب إلى فريقنا وسنتواصل معك قريبًا' : 'Order confirmation sent to our team — we will contact you soon'}
          </p>
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
                  <p className="text-xs text-gray-500">{isRtl ? zoneInfo.label : zoneInfo.labelEn}</p>
                </div>
              </div>

              {/* ── Contextual pricing messages ─────────────────────────── */}

              {/* Message 1: Egypt user + local shipping → EGP subsidised prices */}
              {shippingType === 'local' && isUserFromEgypt && (
                <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-emerald-800 mb-0.5">
                    🇪🇬 {isRtl
                      ? 'الأسعار المعروضة بالجنيه المصري مخصصة للطلبات داخل جمهورية مصر العربية.'
                      : 'Prices shown in EGP are dedicated to orders within Egypt.'}
                  </p>
                  <p className="text-xs text-emerald-600">
                    {isRtl
                      ? 'نحرص على إتاحة المنتجات التربوية بأسعار مدعومة داخل مصر، دعماً للأسر والمجتمع.'
                      : 'We offer subsidized prices within Egypt to support families and the community.'}
                  </p>
                </div>
              )}

              {/* Message 2: Egypt user switches to international shipping → prices become international */}
              {shippingType === 'international' && isUserFromEgypt && address.country && address.country !== 'EG' && (
                <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-blue-800">
                    🌍 {isRtl
                      ? 'عند اختيار الشحن الدولي، يتم تطبيق الأسعار الدولية وتحويلها تلقائياً إلى عملة بلد الشحن.'
                      : 'International shipping applies international pricing, automatically converted to the destination currency.'}
                  </p>
                </div>
              )}

              {/* Message 3: International user ships to Egypt → prices stay international */}
              {intlUserShippingToEgypt && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-amber-800 mb-0.5">
                    ℹ️ {isRtl
                      ? 'الأسعار المحلية بالجنيه المصري مخصصة للعملاء داخل مصر.'
                      : 'Local EGP prices are reserved for customers within Egypt.'}
                  </p>
                  <p className="text-xs text-amber-700">
                    {isRtl
                      ? 'طلبك يُسعَّر وفق الأسعار الدولية بعملتك. يتم احتساب تكلفة الشحن إلى مصر حسب الوزن والمحافظة.'
                      : 'Your order is priced in international rates using your currency. Shipping to Egypt is calculated by weight and governorate.'}
                  </p>
                </div>
              )}

              {/* International disabled banner */}
              {shippingType === 'international' && !intlConfig.enabled && (
                <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-xl px-4 py-4 text-center">
                  <p className="text-2xl mb-1">⛔</p>
                  <p className="font-black text-red-700 text-sm">
                    {isRtl ? 'الشحن الدولي غير متاح حاليًا' : 'International shipping is currently unavailable'}
                  </p>
                  <p className="text-xs text-red-500 mt-1">
                    {isRtl ? 'يرجى التواصل معنا مباشرة للاستفسار عن الشحن خارج مصر' : 'Please contact us directly for shipping outside Egypt'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* 1. Country (international) or Governorate (local) — always first */}
                {shippingType === 'international' && intlConfig.enabled && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.country} *</label>
                    <select value={address.country}
                      onChange={e => {
                        const code = e.target.value;
                        setAddress(a => ({ ...a, country: code, city: '', region: '', governorate: '' }));
                        // International user picking Egypt: keep their market/currency, don't switch to EGP
                        if (code && !(code === 'EG' && !isUserFromEgypt)) {
                          setCountry(code);
                        }
                      }}
                      className={inputClass(errors.country) + ' bg-white cursor-pointer'}>
                      <option value="">{L.selectCountry}</option>
                      {/* Egypt first for easy access, then all other countries */}
                      <option value="EG">{isRtl ? '🇪🇬 مصر' : '🇪🇬 Egypt'}</option>
                      {COUNTRIES.filter(c => c.code !== 'EG').map(c => (
                        <option key={c.code} value={c.code}>{isRtl ? c.nameAr : c.nameEn}</option>
                      ))}
                    </select>
                    {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
                    {/* Shipping cost error for non-Egypt destinations */}
                    {address.country && address.country !== 'EG' && intlShippingResult && !intlShippingResult.ok && (
                      <p className="text-red-600 text-xs mt-1.5 font-semibold">{intlShippingResult.message}</p>
                    )}
                  </div>
                )}

                {/* Governorate picker for international user shipping to Egypt */}
                {intlUserShippingToEgypt && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.governorate} *</label>
                    <select value={address.governorate}
                      onChange={e => setAddress(a => ({ ...a, governorate: e.target.value }))}
                      className={inputClass(errors.governorate) + ' bg-white cursor-pointer'}>
                      <option value="">{isRtl ? 'اختر المحافظة' : 'Select Governorate'}</option>
                      {governorates.map(g => (
                        <option key={g.id} value={g.id}>{isRtl ? g.name : g.nameEn}</option>
                      ))}
                    </select>
                    {errors.governorate && <p className="text-red-500 text-xs mt-1">{errors.governorate}</p>}
                  </div>
                )}

                {shippingType === 'local' && (
                  <div className="sm:col-span-2">
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

                {/* 2. First + Last name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.firstName} *</label>
                  <input type="text" value={address.firstName}
                    onChange={e => setAddress(a => ({ ...a, firstName: e.target.value }))}
                    placeholder={isRtl ? 'مثال: أحمد' : 'e.g. Ahmed'}
                    className={inputClass(errors.firstName)} />
                  {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.lastName} *</label>
                  <input type="text" value={address.lastName}
                    onChange={e => setAddress(a => ({ ...a, lastName: e.target.value }))}
                    placeholder={isRtl ? 'مثال: محمد' : 'e.g. Mohamed'}
                    className={inputClass(errors.lastName)} />
                  {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                </div>

                {/* 3. Phone with dial code */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.phone} *</label>
                  <div className="flex gap-0">
                    <div className="flex items-center px-3 bg-gray-100 border border-gray-200 border-r-0 rounded-r-xl text-sm font-bold text-gray-600 whitespace-nowrap" dir="ltr">
                      {address.country || (shippingType === 'local' ? 'EG' : '')}
                      {(COUNTRY_DIAL_CODES[address.country] || (shippingType === 'local' && COUNTRY_DIAL_CODES['EG'])) && (
                        <span className="ml-1">{COUNTRY_DIAL_CODES[address.country] || COUNTRY_DIAL_CODES['EG']}</span>
                      )}
                    </div>
                    <input type="tel" value={address.phone} dir="ltr"
                      onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))}
                      placeholder="xxxxxxxxxx"
                      className={inputClass(errors.phone) + ' rounded-r-none'} />
                  </div>
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>

                {/* 4. WhatsApp same? */}
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{L.whatsappQ} *</p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="whatsapp" checked={address.whatsappSame}
                        onChange={() => setAddress(a => ({ ...a, whatsappSame: true }))}
                        className="accent-gray-900 w-4 h-4" />
                      <span className="text-sm font-semibold text-gray-800">{L.whatsappYes}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="whatsapp" checked={!address.whatsappSame}
                        onChange={() => setAddress(a => ({ ...a, whatsappSame: false }))}
                        className="accent-gray-900 w-4 h-4" />
                      <span className="text-sm font-semibold text-gray-800">{L.whatsappNo}</span>
                    </label>
                  </div>
                  {!address.whatsappSame && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.whatsappNumberLabel} *</label>
                      <input
                        type="tel"
                        value={address.whatsappNumber}
                        onChange={e => setAddress(a => ({ ...a, whatsappNumber: e.target.value }))}
                        placeholder="xxxxxxxxxx"
                        className={inputClass(errors.whatsappNumber)}
                        dir="ltr"
                      />
                      {errors.whatsappNumber && <p className="text-red-500 text-xs mt-1">{errors.whatsappNumber}</p>}
                    </div>
                  )}
                </div>

                {/* 5. Region / Emirate (only for countries with known regions) */}
                {shippingType === 'international' && COUNTRY_REGIONS[address.country] && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.regionLabel} *</label>
                    <select value={address.region}
                      onChange={e => setAddress(a => ({ ...a, region: e.target.value }))}
                      className={inputClass() + ' bg-white cursor-pointer'}>
                      <option value="">{isRtl ? 'اختر' : 'Select'}</option>
                      {COUNTRY_REGIONS[address.country].map(r => (
                        <option key={r.en} value={isRtl ? r.ar : r.en}>{isRtl ? r.ar : r.en}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 6. City / Province (hidden when intl user ships to Egypt — governorate is used instead) */}
                {!intlUserShippingToEgypt && (
                  <div className={shippingType === 'international' && COUNTRY_REGIONS[address.country] ? '' : 'sm:col-span-2'}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.cityLabel} *</label>
                    <input type="text" value={address.city}
                      onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                      placeholder={(() => {
                        const cap = address.country ? COUNTRY_CAPITALS[address.country] : undefined;
                        if (cap) return isRtl ? `مثال: ${cap.ar}` : `e.g. ${cap.en}`;
                        return isRtl ? 'مثال: المدينة' : 'e.g. City';
                      })()}
                      className={inputClass(errors.city)} />
                    {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                  </div>
                )}

                {/* 7. Street */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.streetLabel} *</label>
                  <input type="text" value={address.street}
                    onChange={e => setAddress(a => ({ ...a, street: e.target.value }))}
                    placeholder={isRtl ? 'مثل: طريق المنارة، شارع 2A' : 'e.g. Al Manara Road, Street 2A'}
                    className={inputClass(errors.street)} />
                  {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
                </div>

                {/* 8. Building / Unit / Floor / Apt */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.buildingLabel}</label>
                  <input type="text" value={address.building}
                    onChange={e => setAddress(a => ({ ...a, building: e.target.value }))}
                    placeholder={isRtl ? 'مثل: مبنى 11، الدور الثاني، شقة 2' : 'e.g. Bldg 11, Floor 2, Apt 2'}
                    className={inputClass()} />
                </div>

                {/* 9. Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{L.notes}</label>
                  <input type="text" value={address.notes}
                    onChange={e => setAddress(a => ({ ...a, notes: e.target.value }))}
                    placeholder={isRtl ? 'أي تعليمات للمندوب' : 'Any courier instructions'}
                    className={inputClass()} />
                </div>

                {/* Shipping cost summary */}
                {shippingType === 'international' && address.country && (intlShippingResult?.ok || (intlUserShippingToEgypt && address.governorate)) && shippingCost > 0 && (
                  <div className="sm:col-span-2 bg-amber-50 border border-amber-100 rounded-xl p-3 flex justify-between items-center text-sm">
                    <span className="text-gray-500 text-xs">{L.weightLabel}: <span className="font-bold text-gray-900">{totalWeightKg.toFixed(2)} kg</span></span>
                    <span className="font-black text-gray-900">{shippingCost} {shippingCurrency}</span>
                  </div>
                )}
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
                ] as const).filter(m => (shippingType === 'local' || m.intl) && enabledPaymentIds.includes(m.id)).map(m => (
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
                  <p className="text-sm text-gray-700 font-semibold">{fullName} · {COUNTRY_DIAL_CODES[address.country] || COUNTRY_DIAL_CODES['EG']} {address.phone}</p>
                  <p className="text-sm text-gray-500">
                    {address.street}{address.building ? '، ' + address.building : ''}, {address.city}
                    {address.region ? `، ${address.region}` : ''}
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
              {/* When currencies differ — show labeled breakdown as grand total */}
              {shippingCost > 0 && shippingCurrency !== currency && (
                <div className="flex flex-col gap-1 border-t pt-2 text-xs">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-black text-sm text-gray-900">{L.totalLabel}</span>
                  </div>
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
