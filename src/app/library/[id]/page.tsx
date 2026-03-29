'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const BookReader = dynamic(() => import('@/components/books/BookReader'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="w-10 h-10 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

interface BookData {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  cover: string;
  author?: string;
  category?: string;
  price: number;
  freePages: number;
  totalPages: number;
  isPublished: boolean;
  allowQuoteShare: boolean;
  allowFriendShare: boolean;
  friendShareHours: number;
  enableReferral: boolean;
  referralDiscount: number;
  enableWatermark: boolean;
  enableForensic: boolean;
  _count: { accesses: number };
}

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [book, setBook] = useState<BookData | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    fetch(`/api/books/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(async d => {
        setBook(d.book ?? null);
        let access = d.hasAccess ?? false;

        // Redeem friend share link if ?ref=TOKEN present
        const refToken = searchParams.get('ref');
        if (refToken && !access && user) {
          try {
            const res = await fetch(`/api/books/share/${refToken}`, {
              method: 'POST',
              credentials: 'include',
            });
            if (res.ok) {
              access = true;
              setShareMsg('🎁 تم تفعيل رابط المشاركة — يمكنك قراءة الكتاب كاملاً!');
            } else {
              const err = await res.json();
              setShareMsg(err.error || 'الرابط غير صالح أو منتهي الصلاحية');
            }
          } catch {}
        }
        setHasAccess(access);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, user, searchParams]);

  // Save reading progress (debounced)
  const saveProgress = useCallback((page: number) => {
    setLastPage(page);
    if (!hasAccess) return;
    fetch(`/api/books/${id}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ lastPage: page }),
    }).catch(() => {});
  }, [id, hasAccess]);

  const createShareLink = async () => {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/books/${id}/share`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.token) {
        const url = `${window.location.origin}/library/${id}?ref=${data.token}`;
        setShareLink(url);
        setShowShareModal(true);
      }
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="w-10 h-10 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20 gap-4" dir="rtl">
        <p className="text-5xl">📚</p>
        <p className="text-gray-500 font-semibold">الكتاب غير موجود</p>
        <Link href="/library" className="text-[#F5C518] font-bold text-sm hover:underline">← العودة للمكتبة</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/library" className="hover:text-gray-600 transition">المكتبة</Link>
          <span>/</span>
          <span className="text-gray-700 font-semibold">{book.title}</span>
        </div>

        {/* Share link message banner */}
        {shareMsg && (
          <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
            shareMsg.startsWith('🎁')
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-600'
          }`}>
            {shareMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Sidebar (book info) ── */}
          <div className="lg:col-span-1 space-y-5">
            {/* Cover */}
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
              {book.cover ? (
                <Image src={book.cover} alt={book.title} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex items-center justify-center h-full text-7xl">📖</div>
              )}
              {hasAccess && (
                <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  ✓ لديك وصول كامل
                </div>
              )}
            </div>

            {/* Info card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h1 className="font-black text-gray-900 text-xl leading-tight">{book.title}</h1>
                {book.author && <p className="text-gray-500 text-sm mt-1">{book.author}</p>}
                {book.category && (
                  <span className="inline-block mt-2 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full">
                    {book.category}
                  </span>
                )}
              </div>

              <p className="text-gray-600 text-sm leading-relaxed">{book.description}</p>

              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div className="text-center">
                  <p className="font-black text-gray-900 text-lg">{book.totalPages || '—'}</p>
                  <p className="text-gray-400 text-xs">صفحة</p>
                </div>
                <div className="text-center">
                  <p className="font-black text-green-600 text-lg">{book.freePages}</p>
                  <p className="text-gray-400 text-xs">مجانية</p>
                </div>
                <div className="text-center">
                  <p className="font-black text-gray-900 text-lg">{book._count.accesses}</p>
                  <p className="text-gray-400 text-xs">قارئ</p>
                </div>
              </div>

              {/* CTA */}
              {!hasAccess && book.price > 0 && (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-gray-400 text-xs mb-1">سعر الكتاب كاملاً</p>
                    <p className="font-black text-[#1a1a2e] text-3xl">
                      {book.price.toLocaleString('ar-EG')} ج.م
                    </p>
                  </div>
                  {user ? (
                    <Link
                      href={`/library/${id}/buy`}
                      className="block w-full bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-black py-3.5 rounded-xl text-center text-base transition"
                    >
                      اشترِ الآن 🔓
                    </Link>
                  ) : (
                    <Link
                      href="/auth?redirect=/library/${id}"
                      className="block w-full bg-[#1a1a2e] hover:bg-[#2a2a4e] text-white font-black py-3.5 rounded-xl text-center text-base transition"
                    >
                      سجّل دخولك للشراء
                    </Link>
                  )}
                </div>
              )}

              {/* Share with friend */}
              {hasAccess && book.allowFriendShare && (
                <button
                  onClick={createShareLink}
                  disabled={shareLoading}
                  className="w-full border border-gray-200 hover:border-[#F5C518] text-gray-600 hover:text-[#1a1a2e] font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
                >
                  {shareLoading ? (
                    <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  ) : '🎁'}
                  شارك الكتاب مع صديق
                </button>
              )}

              {/* Referral note */}
              {book.enableReferral && hasAccess && (
                <p className="text-xs text-gray-400 text-center">
                  لو صديقك اشترى عن طريقك — تحصل على خصم {book.referralDiscount}% على كتابك الجاي
                </p>
              )}
            </div>
          </div>

          {/* ── Reader ── */}
          <div className="lg:col-span-2">
            {book.freePages > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ minHeight: '80vh' }}>
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-700">{book.title}</p>
                  {!hasAccess && (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-semibold">
                      تقرأ {book.freePages} صفحة مجانية
                    </span>
                  )}
                  {hasAccess && (
                    <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full font-semibold">
                      وصول كامل ✓
                    </span>
                  )}
                </div>
                <BookReader
                  bookId={id}
                  freePages={book.freePages}
                  hasAccess={hasAccess}
                  watermarkText={book.enableWatermark ? (user?.email || '') : undefined}
                  enableForensic={book.enableForensic}
                  allowQuoteShare={book.allowQuoteShare}
                  price={book.price}
                  initialPage={lastPage}
                  onPageChange={saveProgress}
                  bookTitle={book.title}
                  coverUrl={book.cover}
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-400">
                <p className="text-5xl mb-4">📚</p>
                <p className="font-semibold">ملف الكتاب قيد الرفع</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-gray-900 text-lg mb-2">🎁 رابط المشاركة جاهز!</h3>
            <p className="text-gray-500 text-sm mb-4">
              الرابط ده بيخلي صديقك يقرأ الكتاب مجاناً لمدة {book.friendShareHours} ساعة
            </p>
            <div className="flex gap-2 mb-4">
              <input
                value={shareLink}
                readOnly
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-700 outline-none"
                dir="ltr"
              />
              <button
                onClick={copyShareLink}
                className="bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                نسخ
              </button>
            </div>
            {book.enableReferral && (
              <p className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                لو اشترى الكتاب عن طريق رابطك — هتحصل على خصم {book.referralDiscount}% 🎉
              </p>
            )}
            <button
              onClick={() => setShowShareModal(false)}
              className="mt-4 w-full text-gray-400 hover:text-gray-600 text-sm transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
