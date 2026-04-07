'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import PayPalBookButton from '@/components/PayPalBookButton';

interface Book {
  id: string;
  title: string;
  cover: string | null;
  price: number;
  priceUSD: number | null;
  author: string | null;
}

export default function BookBuyPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const [id, setId] = useState<string>('');
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  useEffect(() => {
    // Support both Next.js 14 (plain object) and Next.js 15 (Promise) params
    Promise.resolve(params).then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    if (!isLoading && !user) {
      router.replace(`/auth?redirect=/library/${id}/buy`);
      return;
    }
    if (isLoading) return;
    fetch(`/api/books/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.book) setBook(d.book);
        if (d.hasAccess) {
          router.replace(`/library/${id}`);
        }
      })
      .finally(() => setLoading(false));
  }, [id, user, isLoading, router]);

  // Calculate USD price (PayPal charges in USD)
  const priceUsd = book
    ? (book.priceUSD && book.priceUSD > 0 ? book.priceUSD : book.price * 0.10)
    : 0;

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-2xl mb-4">📚</p>
          <p className="text-gray-600 font-bold">الكتاب غير موجود</p>
          <Link href="/library" className="mt-4 inline-block text-[#F5C518] font-bold underline">العودة للمكتبة</Link>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-6 py-5 text-center">
            <Image src="/white-Logo.webp" alt="Moslim Leader" width={120} height={40} className="h-10 w-auto mx-auto" unoptimized />
          </div>
          {/* Success */}
          <div className="px-6 py-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">تم تفعيل وصولك! 🎉</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              طلبك رقم <span className="font-black text-gray-900">#{orderId}</span> تم تأكيده بنجاح.
              <br />
              الكتاب متاح الآن في مكتبتك.
            </p>
          </div>

          {/* Book card */}
          <div className="mx-6 mb-4 bg-gradient-to-l from-amber-50 to-emerald-50 border border-amber-100 rounded-2xl p-4 text-sm">
            <div className="flex items-center gap-3">
              {book.cover && (
                <div className="w-14 h-18 rounded-lg overflow-hidden shrink-0 shadow-md">
                  <Image src={book.cover} alt={book.title} width={56} height={72} className="w-full h-full object-cover" unoptimized />
                </div>
              )}
              <div>
                <p className="font-black text-gray-900">{book.title}</p>
                {book.author && <p className="text-xs text-gray-500 mt-0.5">{book.author}</p>}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="px-6 pb-6 space-y-3">
            <Link
              href={`/library/${book.id}`}
              className="flex items-center justify-center gap-2 w-full bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-black py-4 rounded-2xl text-base transition shadow-md shadow-amber-200"
            >
              📖 ابدأ القراءة الآن
            </Link>
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
          <Link href={`/library/${id}`} className="text-white/60 hover:text-white text-sm flex items-center gap-1 mb-3">
            ← العودة
          </Link>
          <Image src="/white-Logo.webp" alt="Moslim Leader" width={120} height={40} className="h-8 w-auto" unoptimized />
        </div>

        {/* Book info */}
        <div className="px-6 py-5 border-b border-gray-100 flex gap-4 items-center">
          {book.cover && (
            <div className="w-16 h-20 rounded-xl overflow-hidden shrink-0 shadow-md">
              <Image src={book.cover} alt={book.title} width={64} height={80} className="w-full h-full object-cover" unoptimized />
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 font-semibold mb-1">الكتاب الرقمي</p>
            <h1 className="text-lg font-black text-gray-900 leading-tight">{book.title}</h1>
            {book.author && <p className="text-sm text-gray-500 mt-0.5">{book.author}</p>}
          </div>
        </div>

        {/* Price */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-gray-500 text-sm">سعر الكتاب</span>
          <div className="text-left">
            <span className="text-3xl font-black text-[#1a1a2e]">${priceUsd.toFixed(2)}</span>
            <p className="text-xs text-gray-400 mt-0.5">USD</p>
          </div>
        </div>

        {/* User info */}
        <div className="px-6 pt-5">
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs text-gray-600 mb-4">
            <p className="font-bold text-gray-700 mb-1">بياناتك:</p>
            <p>الاسم: <span className="font-black text-gray-900">{user?.name}</span></p>
            <p>الإيميل: <span className="font-black text-gray-900">{user?.email}</span></p>
          </div>
        </div>

        {/* Payment */}
        <div className="px-6 pb-6">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">اختر طريقة الدفع</p>
          <PayPalBookButton
            createEndpoint={`/api/books/${book.id}/paypal-create`}
            captureEndpoint={`/api/books/${book.id}/paypal-capture`}
            amountUsd={priceUsd}
            onSuccess={(id) => {
              setOrderId(id);
              setOrderPlaced(true);
            }}
            onError={(msg) => addToast(msg, 'error')}
            isRtl
          />
        </div>
      </div>
    </div>
  );
}
