'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { resolvePrice } from '@/lib/geo-pricing';

type PayMethod = 'vodafone' | 'instapay' | 'bank';

interface SeriesData {
  id: string;
  name: string;
  cover: string | null;
  seriesPrice: number;
  seriesPriceUSD: number | null;
  books: { id: string; title: string; cover: string | null; seriesOrder: number | null }[];
}

function generateOrderId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default function SeriesBuyPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const [seriesId, setSeriesId] = useState<string>('');
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<PayMethod>('vodafone');
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const { zone, countryCode, formatPrice } = useRegionalPricing();

  useEffect(() => {
    params.then(p => setSeriesId(p.seriesId));
  }, [params]);

  useEffect(() => {
    if (!seriesId) return;
    if (!isLoading && !user) {
      router.replace(`/auth?redirect=/library/series/${seriesId}/buy`);
      return;
    }
    if (isLoading) return;

    // Fetch series data from the public series API
    fetch('/api/series')
      .then(r => r.json())
      .then(d => {
        const found = (d.series || []).find((s: SeriesData) => s.id === seriesId);
        if (found) setSeries(found);
      })
      .finally(() => setLoading(false));
  }, [seriesId, user, isLoading, router]);

  const payLabel = payMethod === 'vodafone' ? 'Vodafone Cash' : payMethod === 'instapay' ? 'InstaPay' : 'تحويل بنكي';
  
  // Calculate regional price
  const priceResult = series ? resolvePrice(
    series.seriesPrice,
    zone,
    { price_egp_manual: series.seriesPrice, price_usd_manual: series.seriesPriceUSD ?? undefined },
    countryCode
  ) : null;
  const priceStr = priceResult ? formatPrice(priceResult) : '';

  async function handleSubmit() {
    if (!series || !user) return;
    setSubmitting(true);
    const newOrderId = generateOrderId();

    try {
      const res = await fetch(`/api/series/${series.id}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: newOrderId,
          paymentMethod: payLabel,
          price: priceResult?.price ?? series.seriesPrice,
          currency: priceResult?.currencyEn ?? 'EGP',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        addToast(err.error || 'حدث خطأ، حاول مرة أخرى', 'error');
        setSubmitting(false);
        return;
      }

      setOrderId(newOrderId);
      setOrderPlaced(true);
    } catch {
      addToast('حدث خطأ، حاول مرة أخرى', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-2xl mb-4">📚</p>
          <p className="text-gray-600 font-bold">السلسلة غير موجودة</p>
          <Link href="/library" className="mt-4 inline-block text-[#F5C518] font-bold underline">العودة للمكتبة</Link>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    const waMsg = encodeURIComponent(
      `طلب سلسلة رقمية #${orderId}\n` +
      `السلسلة: ${series.name}\n` +
      `عدد الكتب: ${series.books.length} كتاب\n` +
      `السعر: ${priceStr}\n` +
      `طريقة الدفع: ${payLabel}\n` +
      `الاسم: ${user?.name || ''}\n` +
      `الإيميل: ${user?.email || ''}\n\n` +
      `أرسل صورة إيصال التحويل لتفعيل الوصول للسلسلة كاملة 📚`
    );
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden">
          <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-6 py-5 text-center">
            <Image src="/white-Logo.webp" alt="Moslim Leader" width={120} height={40} className="h-10 w-auto mx-auto" unoptimized />
          </div>
          <div className="px-6 py-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">تم تسجيل طلبك! 🎉</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              طلبك رقم <span className="font-black text-gray-900">#{orderId}</span> تم تسجيله بنجاح.
              <br />أرسل إيصال التحويل على واتساب لتفعيل الوصول للسلسلة كاملة.
            </p>
          </div>
          <div className="mx-6 mb-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm">
            <p className="font-semibold text-gray-900 mb-1">أرسل المبلغ على الرقم:</p>
            <p className="font-black text-2xl tracking-widest text-gray-900" dir="ltr">01060306803</p>
            <p className="text-gray-500 text-xs mt-1">{payLabel}</p>
            <p className="text-[#1a1a2e] font-black text-lg mt-2">{priceStr}</p>
          </div>
          <div className="mx-6 mb-4 bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs text-blue-700">
            <p className="font-bold mb-0.5">📧 إيميل التسجيل:</p>
            <p className="font-black text-sm text-blue-900">{user?.email}</p>
            <p className="text-blue-600 mt-1">سنستخدمه لتفعيل وصولك للسلسلة كاملة</p>
          </div>
          <div className="px-6 pb-6 space-y-3">
            <a
              href={`https://wa.me/201060306803?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20b858] text-white font-black py-4 rounded-2xl text-base transition shadow-md shadow-green-200"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              أرسل الإيصال على واتساب
            </a>
            <Link
              href="/library"
              className="block w-full text-center border-2 border-gray-200 hover:border-gray-400 text-gray-700 font-bold py-3 rounded-2xl transition text-sm"
            >
              العودة للمكتبة
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16" dir="rtl">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-6 py-5">
          <Link href="/library" className="text-white/60 hover:text-white text-sm flex items-center gap-1 mb-3">
            ← العودة للمكتبة
          </Link>
          <Image src="/white-Logo.webp" alt="Moslim Leader" width={120} height={40} className="h-8 w-auto" unoptimized />
        </div>

        {/* Series info */}
        <div className="px-6 py-5 border-b border-gray-100 flex gap-4 items-center">
          {series.cover && (
            <div className="w-16 h-20 rounded-xl overflow-hidden shrink-0 shadow-md">
              <Image src={series.cover} alt={series.name} width={64} height={80} className="w-full h-full object-cover" unoptimized />
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 font-semibold mb-1">السلسلة كاملة — {series.books.length} كتاب</p>
            <h1 className="text-lg font-black text-gray-900 leading-tight">{series.name}</h1>
            <p className="text-xs text-gray-500 mt-1">{series.books.map(b => b.title).join(' • ')}</p>
          </div>
        </div>

        {/* Price */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-gray-500 text-sm">سعر السلسلة كاملة</span>
          <span className="text-3xl font-black text-[#F5C518]">{priceStr}</span>
        </div>

        {/* Payment method */}
        <div className="px-6 py-5">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-4">اختر طريقة الدفع</p>
          <div className="space-y-3">
            {[
              { id: 'vodafone' as PayMethod, icon: '📱', title: 'Vodafone Cash', desc: 'ادفع عبر محفظة فودافون كاش' },
              { id: 'instapay' as PayMethod, icon: '⚡', title: 'InstaPay', desc: 'ادفع عبر تطبيق InstaPay' },
              { id: 'bank' as PayMethod, icon: '🏦', title: 'تحويل بنكي', desc: 'تحويل مباشر للحساب البنكي' },
            ].map(pm => (
              <button
                key={pm.id}
                onClick={() => setPayMethod(pm.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition text-right ${
                  payMethod === pm.id
                    ? 'border-[#F5C518] bg-amber-50'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <span className="text-2xl">{pm.icon}</span>
                <div className="flex-1">
                  <p className="font-black text-gray-900 text-sm">{pm.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{pm.desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  payMethod === pm.id ? 'border-[#F5C518] bg-[#F5C518]' : 'border-gray-300'
                }`}>
                  {payMethod === pm.id && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm">
            <p className="font-semibold text-gray-900 mb-1">أرسل المبلغ على الرقم:</p>
            <p className="font-black text-xl tracking-widest text-gray-900" dir="ltr">01060306803</p>
            <p className="text-gray-500 text-xs mt-1">ثم اضغط "تأكيد الطلب" وأرسل صورة الإيصال على واتساب</p>
          </div>

          <div className="mt-3 bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs text-gray-600">
            <p className="font-bold text-gray-700 mb-1">بياناتك:</p>
            <p>الاسم: <span className="font-black text-gray-900">{user?.name}</span></p>
            <p>الإيميل: <span className="font-black text-gray-900">{user?.email}</span></p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-5 w-full bg-[#F5C518] hover:bg-amber-400 active:bg-amber-500 disabled:opacity-60 text-[#1a1a2e] font-black py-4 rounded-2xl text-base transition shadow-md shadow-amber-200 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-[#1a1a2e] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>تأكيد الطلب — السلسلة كاملة 📚</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
