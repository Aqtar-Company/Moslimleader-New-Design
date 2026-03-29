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

type MobileTab = 'reader' | 'info';

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
  const [shareMsg, setShareMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('reader');
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    fetch(`/api/books/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(async d => {
        setBook(d.book ?? null);
        let access = d.hasAccess ?? false;

        const refToken = searchParams.get('ref');
        if (refToken && !access && user) {
          try {
            const res = await fetch(`/api/books/share/${refToken}`, {
              method: 'POST',
              credentials: 'include',
            });
            if (res.ok) {
              access = true;
              setShareMsg({ text: '🎁 تم تفعيل رابط المشاركة — يمكنك قراءة الكتاب كاملاً!', ok: true });
            } else {
              const err = await res.json();
              setShareMsg({ text: err.error || 'الرابط غير صالح أو منتهي الصلاحية', ok: false });
            }
          } catch {}
        } else if (refToken && !user) {
          setShareMsg({ text: '🔐 سجّل دخولك أولاً لتفعيل رابط المشاركة', ok: false });
        }
        setHasAccess(access);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, user, searchParams]);

  // Auto-hide share message after 6 seconds
  useEffect(() => {
    if (!shareMsg) return;
    const t = setTimeout(() => setShareMsg(null), 6000);
    return () => clearTimeout(t);
  }, [shareMsg]);

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

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
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

  // ── Sidebar content (shared between desktop sidebar and mobile info tab) ──
  const SidebarContent = () => (
    <div className="space-y-5">
      {/* Cover — hidden on mobile (shown above tabs) */}
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] hidden lg:block">
        {book.cover ? (
          <Image src={book.cover} alt={book.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full text-7xl">📖</div>
        )}
        {hasAccess && (
          <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            ✓ وصول كامل
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 py-3 border-t border-gray-100">
          <div className="text-center">
            <p className="font-black text-gray-900 text-lg">{book.totalPages || '—'}</p>
            <p className="text-gray-400 text-[11px]">صفحة</p>
          </div>
          <div className="text-center">
            <p className="font-black text-green-600 text-lg">{book.freePages}</p>
            <p className="text-gray-400 text-[11px]">مجانية</p>
          </div>
          <div className="text-center">
            <p className="font-black text-gray-900 text-lg">{book._count.accesses}</p>
            <p className="text-gray-400 text-[11px]">قارئ</p>
          </div>
        </div>

        {/* CTA */}
        {!hasAccess && book.price > 0 && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-gray-400 text-xs mb-1">سعر الكتاب كاملاً</p>
              <p className="font-black text-[#1a1a2e] text-3xl">{book.price.toLocaleString('ar-EG')} ج.م</p>
            </div>
            {user ? (
              <Link
                href={`/library/${id}/buy`}
                className="block w-full bg-[#F5C518] hover:bg-amber-400 active:bg-amber-500 text-[#1a1a2e] font-black py-3.5 rounded-xl text-center text-base transition shadow-md shadow-amber-200"
              >
                اشترِ الآن 🔓
              </Link>
            ) : (
              <Link
                href={`/auth?redirect=/library/${id}`}
                className="block w-full bg-[#1a1a2e] hover:bg-[#2a2a4e] text-white font-black py-3.5 rounded-xl text-center text-base transition"
              >
                سجّل دخولك للشراء
              </Link>
            )}
            <div className="flex justify-center gap-3 text-[11px] text-gray-400">
              <span>✓ دفع آمن</span>
              <span>•</span>
              <span>✓ وصول فوري</span>
            </div>
          </div>
        )}

        {hasAccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
            <span className="text-green-600 text-lg">✓</span>
            <p className="text-green-700 text-sm font-bold">لديك وصول كامل لهذا الكتاب</p>
          </div>
        )}

        {/* Share with friend */}
        {hasAccess && book.allowFriendShare && (
          <button
            onClick={createShareLink}
            disabled={shareLoading}
            className="w-full border border-gray-200 hover:border-[#F5C518] hover:bg-amber-50 text-gray-600 hover:text-[#1a1a2e] font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
          >
            {shareLoading
              ? <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              : '🎁'}
            شارك الكتاب مع صديق
          </button>
        )}

        {/* Referral note */}
        {book.enableReferral && hasAccess && (
          <p className="text-xs text-gray-400 text-center bg-gray-50 rounded-xl px-3 py-2">
            لو صديقك اشترى عن طريقك — تحصل على خصم {book.referralDiscount}% على كتابك الجاي 🎉
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20" dir="rtl">

      {/* Share link toast notification */}
      {shareMsg && (
        <div className={`fixed top-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 rounded-2xl px-4 py-3.5 shadow-2xl flex items-start gap-3 border ${
          shareMsg.ok
            ? 'bg-green-600 border-green-500 text-white'
            : 'bg-[#1a1a2e] border-white/10 text-white'
        }`}>
          <span className="text-xl shrink-0">{shareMsg.ok ? '🎁' : '⚠️'}</span>
          <div className="flex-1">
            <p className="text-sm font-bold leading-snug">{shareMsg.text}</p>
            {shareMsg.ok && (
              <p className="text-green-100 text-xs mt-1">يمكنك الآن قراءة الكتاب بالكامل</p>
            )}
          </div>
          <button onClick={() => setShareMsg(null)} className="opacity-60 hover:opacity-100 text-lg shrink-0">×</button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
          <Link href="/library" className="hover:text-gray-600 transition flex items-center gap-1">
            <span>←</span> المكتبة
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-semibold line-clamp-1">{book.title}</span>
        </div>

        {/* ── Mobile: Cover + Tabs ── */}
        <div className="lg:hidden mb-4">
          {/* Compact header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="relative w-20 h-28 rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-[#1a1a2e] to-[#16213e] shrink-0">
              {book.cover ? (
                <Image src={book.cover} alt={book.title} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex items-center justify-center h-full text-3xl">📖</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-gray-900 text-base leading-tight mb-1">{book.title}</h1>
              {book.author && <p className="text-gray-500 text-xs mb-2">{book.author}</p>}
              {!hasAccess && book.price > 0 && (
                <Link
                  href={user ? `/library/${id}/buy` : `/auth?redirect=/library/${id}`}
                  className="inline-block bg-[#F5C518] text-[#1a1a2e] font-black text-xs px-4 py-2 rounded-xl"
                >
                  {user ? `اشترِ — ${book.price.toLocaleString('ar-EG')} ج` : 'سجّل دخولك'}
                </Link>
              )}
              {hasAccess && (
                <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">✓ وصول كامل</span>
              )}
            </div>
          </div>

          {/* Mobile tabs */}
          <div className="flex bg-gray-100 rounded-2xl p-1">
            <button
              onClick={() => setMobileTab('reader')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${mobileTab === 'reader' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              📖 القارئ
            </button>
            <button
              onClick={() => setMobileTab('info')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${mobileTab === 'info' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              ℹ️ معلومات
            </button>
          </div>
        </div>

        {/* ── Desktop: 3-col grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Sidebar — desktop only */}
          <div className="hidden lg:block lg:col-span-1">
            <SidebarContent />
          </div>

          {/* Mobile: info tab content */}
          {mobileTab === 'info' && (
            <div className="lg:hidden col-span-1">
              <SidebarContent />
            </div>
          )}

          {/* Reader — desktop always, mobile when reader tab active */}
          <div className={`lg:col-span-2 ${mobileTab === 'info' ? 'hidden lg:block' : ''}`}>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Reader header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700 line-clamp-1">{book.title}</p>
                {!hasAccess ? (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-semibold shrink-0">
                    {book.freePages} صفحة مجانية
                  </span>
                ) : (
                  <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full font-semibold shrink-0">
                    وصول كامل ✓
                  </span>
                )}
              </div>

              {book.freePages > 0 ? (
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
              ) : (
                <div className="p-16 text-center text-gray-400">
                  <p className="text-5xl mb-4">📚</p>
                  <p className="font-semibold">ملف الكتاب قيد الرفع</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Share Modal ── */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-2xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl">🎁</div>
                <div>
                  <h3 className="font-black text-gray-900">رابط المشاركة جاهز!</h3>
                  <p className="text-gray-400 text-xs">صديقك يقدر يقرأ الكتاب كاملاً لمدة {book.friendShareHours} ساعة</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 mb-4">
                <p className="flex-1 text-xs font-mono text-gray-600 truncate" dir="ltr">{shareLink}</p>
                <button
                  onClick={copyShareLink}
                  className={`shrink-0 font-bold text-xs px-3 py-1.5 rounded-lg transition ${
                    copyDone ? 'bg-green-500 text-white' : 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400'
                  }`}
                >
                  {copyDone ? '✓ تم النسخ' : 'نسخ'}
                </button>
              </div>

              {book.enableReferral && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-4">
                  <p className="text-green-700 text-xs font-semibold">
                    🎉 لو اشترى صديقك الكتاب عن طريق رابطك — هتحصل على خصم {book.referralDiscount}% على كتابك الجاي!
                  </p>
                </div>
              )}

              <button
                onClick={() => setShowShareModal(false)}
                className="w-full py-2.5 border border-gray-200 hover:border-gray-300 rounded-xl text-sm text-gray-500 font-semibold transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
