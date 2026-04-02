'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { resolvePrice } from '@/lib/geo-pricing';
import { formatAgeLabel } from '@/lib/book-age';
import { Turnstile } from '@marsidev/react-turnstile';

// Simple device fingerprint based on browser properties
async function generateFingerprint(): Promise<string> {
  const ua = navigator.userAgent;
  const lang = navigator.language;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const raw = `${ua}|${lang}|${tz}|${screen}`;
  // Use SubtleCrypto if available, else fallback to simple hash
  if (window.crypto && window.crypto.subtle) {
    const buf = new TextEncoder().encode(raw);
    const hash = await window.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: simple djb2 hash
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i);
  return (h >>> 0).toString(16);
}

// Error boundary to prevent full-page crash on iPad/Safari
class ReaderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-12 text-center">
          <p className="text-4xl mb-4">📖</p>
          <p className="text-gray-700 font-bold mb-2">تعذّر تحميل القارئ</p>
          <p className="text-gray-400 text-sm mb-4">حاول تحديث الصفحة أو استخدم متصفح آخر</p>
          <button onClick={() => window.location.reload()} className="text-[#F5C518] font-bold text-sm underline">
            تحديث الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  priceUSD?: number;
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
  minAge?: number | null;
  maxAge?: number | null;
  needsParentalGuide?: boolean;
  paperProductSlug?: string | null;
  seriesId?: string | null;
  seriesOrder?: number | null;
  _count: { accesses: number };
}

interface SeriesBookNav {
  id: string;
  title: string;
  titleEn?: string | null;
  cover: string;
  seriesOrder?: number | null;
}

type MobileTab = 'reader' | 'info';

import { Suspense } from 'react';

export default function BookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="w-10 h-10 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BookPageInner />
    </Suspense>
  );
}

function BookPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { zone, countryCode, formatPrice } = useRegionalPricing();

  // Resolve book price based on user's region
  const resolvedBookPrice = (book: BookData) => {
    const pricing = book.priceUSD ? { price_usd_manual: book.priceUSD } : null;
    return resolvePrice(book.price, zone, pricing, countryCode);
  };

  // Format book price for display using the shared formatter
  const displayBookPrice = (book: BookData) => formatPrice(resolvedBookPrice(book));

  const [book, setBook] = useState<BookData | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [isVerified, setIsVerified] = useState(false);
  const [trackingDone, setTrackingDone] = useState(false);
  const [viewCount, setViewCount] = useState<number | null>(null);
  const [buyCount, setBuyCount] = useState<number | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMsg, setShareMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('reader');
  const [copyDone, setCopyDone] = useState(false);
  const [seriesBooks, setSeriesBooks] = useState<SeriesBookNav[]>([]);
  const [seriesName, setSeriesName] = useState<string | null>(null);
  const [seriesNameEn, setSeriesNameEn] = useState<string | null>(null);
  const [seriesSeriesId, setSeriesSeriesId] = useState<string | null>(null);
  const [seriesPrice, setSeriesPrice] = useState<number | null>(null);
  const [seriesPriceUSD, setSeriesPriceUSD] = useState<number | null>(null);
  const isEn = false; // Arabic-first; series names shown in Arabic by default

  useEffect(() => {
    fetch(`/api/books/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(async d => {
        setBook(d.book ?? null);
        setViewCount(d.viewCount ?? null);
        setBuyCount(d.buyCount ?? null);
        setSeriesBooks(d.seriesBooks ?? []);
        setSeriesName(d.seriesName ?? null);
        setSeriesNameEn(d.seriesNameEn ?? null);
        setSeriesSeriesId(d.seriesSeriesId ?? null);
        setSeriesPrice(d.seriesPrice ?? null);
        setSeriesPriceUSD(d.seriesPriceUSD ?? null);
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

  // Session ping every 90 seconds to detect concurrent access from another IP
  useEffect(() => {
    if (!isVerified) return;
    const ping = async () => {
      try {
        const res = await fetch(`/api/books/${id}/session`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.conflict) {
            alert(data.message || 'يبدو أن حسابك مفتوح على جهاز آخر في نفس الوقت.');
          }
        }
      } catch {}
    };
    ping(); // immediate first ping
    const interval = setInterval(ping, 90 * 1000); // every 90 seconds
    return () => clearInterval(interval);
  }, [isVerified, id]);

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
    try { await navigator.clipboard.writeText(shareLink); } catch { /* fallback: ignored */ }
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
          {book.minAge != null && (
            <span className="inline-block mt-2 ms-2 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold px-3 py-1 rounded-full">
              {formatAgeLabel(book.minAge, book.maxAge ?? null, book.needsParentalGuide ?? false, 'ar')}
            </span>
          )}
        </div>

        <p className="text-gray-600 text-sm leading-relaxed">{book.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 py-3 border-t border-gray-100">
          <div className="text-center">
            <p className="font-black text-gray-900 text-lg">{book.totalPages || '—'}</p>
            <p className="text-gray-400 text-[11px]">صفحة</p>
          </div>
          <div className="text-center">
            <p className="font-black text-green-600 text-lg">{book.freePages}</p>
            <p className="text-gray-400 text-[11px]">مجانية</p>
          </div>
          <div className="text-center">
            <p className="font-black text-gray-900 text-lg">{buyCount ?? book._count.accesses}</p>
            <p className="text-gray-400 text-[11px]">مشتري</p>
          </div>
          <div className="text-center">
            <p className="font-black text-blue-600 text-lg">{viewCount ?? 0}</p>
            <p className="text-gray-400 text-[11px]">زائر</p>
          </div>
        </div>

        {/* CTA */}
        {!hasAccess && book.price > 0 && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-gray-400 text-xs mb-1">سعر النسخة الرقمية</p>
              <p className="font-black text-[#1a1a2e] text-3xl">
                {displayBookPrice(book)}
              </p>
            </div>
            {user ? (
              <Link
                href={`/library/${id}/buy`}
                className="block w-full bg-[#F5C518] hover:bg-amber-400 active:bg-amber-500 text-[#1a1a2e] font-black py-3.5 rounded-xl text-center text-base transition shadow-md shadow-amber-200"
              >
                اشترِ النسخة الرقمية الآن
              </Link>
            ) : (
              <Link
                href={`/auth?redirect=/library/${id}`}
                className="block w-full bg-[#1a1a2e] hover:bg-[#2a2a4e] text-white font-black py-3.5 rounded-xl text-center text-base transition"
              >
                سجّل دخولك للشراء
              </Link>
            )}
            {/* Paper version button */}
            {book.paperProductSlug ? (
              <Link
                href={`/shop/${book.paperProductSlug}`}
                className="block w-full bg-white hover:bg-gray-50 border-2 border-[#1a1a2e] text-[#1a1a2e] font-black py-3 rounded-xl text-center text-base transition"
              >
                📦 اشترِ النسخة الورقية
              </Link>
            ) : (
              <Link
                href="/shop"
                className="block w-full bg-white hover:bg-gray-50 border-2 border-[#1a1a2e] text-[#1a1a2e] font-black py-3 rounded-xl text-center text-base transition"
              >
                📦 تصفّح المنتجات الورقية
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
              {/* Visitor/Buyer counts */}
              {(viewCount !== null || buyCount !== null) && (
                <div className="flex items-center gap-4 mb-3">
                  {viewCount !== null && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{viewCount.toLocaleString('ar-EG')} زائر</span>
                    </div>
                  )}
                  {buyCount !== null && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      <span>{buyCount.toLocaleString('ar-EG')} مشتري</span>
                    </div>
                  )}
                </div>
              )}
              {!hasAccess && book.price > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={user ? `/library/${id}/buy` : `/auth?redirect=/library/${id}`}
                    className="inline-block bg-[#F5C518] text-[#1a1a2e] font-black text-xs px-4 py-2 rounded-xl"
                  >
                    {user ? `رقمي — ${displayBookPrice(book)}` : 'سجّل دخولك'}
                  </Link>
                  {book.paperProductSlug ? (
                    <Link
                      href={`/shop/${book.paperProductSlug}`}
                      className="inline-block bg-white border-2 border-[#1a1a2e] text-[#1a1a2e] font-black text-xs px-4 py-2 rounded-xl"
                    >
                      📦 ورقي
                    </Link>
                  ) : (
                    <Link
                      href="/shop"
                      className="inline-block bg-white border-2 border-[#1a1a2e] text-[#1a1a2e] font-black text-xs px-4 py-2 rounded-xl"
                    >
                      📦 ورقي
                    </Link>
                  )}
                </div>
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
                !isVerified ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-1">تحقق سريع</h3>
                    <p className="text-sm text-gray-500 mb-5">أثبت أنك إنسان وليس برنامج آلي</p>
                    {/* ── Copyright warning — large prominent box ── */}
                    <div className="mb-6 p-5 bg-amber-50 border-2 border-amber-400 rounded-2xl text-sm text-amber-900 text-right leading-relaxed w-full max-w-md shadow-md">
                      <p className="font-black text-base mb-2">⚠️ تنبيه قانوني: يتم تسجيل بياناتك</p>
                      <p className="leading-7">عند فتح هذا الكتاب يقوم النظام بتسجيل <strong>عنوان IP الخاص بك</strong>، نوع جهازك، وموقعك الجغرافي بشكل تلقائي. أي انتهاك لحقوق الملكية الفكرية — كالنسخ أو التوزيع غير المصرح به — سيُستخدم كدليل قانوني في المحاكم.</p>
                    </div>
                    <Turnstile
                      siteKey="0x4AAAAAACzKEGf-IQ39WfSB"
                      onSuccess={async (token) => {
                        if (token && !trackingDone) {
                          setTrackingDone(true);
                          // 1. Fire tracking API — record IP, device, geolocation
                          try {
                            await fetch(`/api/books/${id}/track`, {
                              method: 'POST',
                              credentials: 'include',
                            });
                          } catch {}

                          // 2. Device fingerprint check (max 2 devices) — only for logged-in users
                          try {
                            const fp = await generateFingerprint();
                            const devRes = await fetch(`/api/books/${id}/device`, {
                              method: 'POST',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fingerprint: fp }),
                            });
                            if (!devRes.ok) {
                              // 401 = not logged in (guest reading free pages) — allow
                              if (devRes.status === 401) {
                                // Guest user — skip device check, allow free pages
                              } else {
                                const devData = await devRes.json();
                                if (devData.error) {
                                  alert(devData.error);
                                  setTrackingDone(false);
                                  return;
                                }
                              }
                            }
                          } catch {}

                          setIsVerified(true);
                        }
                      }}
                      options={{ language: 'ar' }}
                    />
                    <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                      محمي بواسطة Cloudflare Turnstile
                    </p>
                  </div>
                ) : (
                <ReaderErrorBoundary>
                  <BookReader
                    bookId={id}
                    freePages={book.freePages}
                    hasAccess={hasAccess}
                    watermarkText={book.enableWatermark ? (user?.email || '') : undefined}
                    enableForensic={book.enableForensic}
                    allowQuoteShare={book.allowQuoteShare}
                    price={book.price}
                    priceDisplay={displayBookPrice(book)}
                    initialPage={lastPage}
                    onPageChange={saveProgress}
                    bookTitle={book.title}
                    coverUrl={book.cover}
                    bookLanguage={(book as any).language === 'en' ? 'en' : (book as any).language === 'both' ? 'both' : 'ar'}
                    bgmUrl={(book as any).bgmUrl || undefined}
                    promoVideoUrl={(book as any).promoVideoUrl || undefined}
                  />
                </ReaderErrorBoundary>
                )
              ) : (
                <div className="p-16 text-center text-gray-400">
                  <p className="text-5xl mb-4">📚</p>
                  <p className="font-semibold">ملف الكتاب قيد الرفع</p>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Small copyright reminder below the reader ── */}
        {isVerified && (
          <div className="mt-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 text-right leading-relaxed">
            <span className="font-bold">⚠️ تذكير:</span> بياناتك مسجّلة (IP، الجهاز، الموقع). أي نسخ أو توزيع غير مصرح به يُعدّ انتهاكاً لحقوق الملكية الفكرية ويُستخدم كدليل قانوني.
          </div>
        )}
      </div>

      {/* ── Series Navigation Bar ── */}
      {seriesBooks.length > 1 && book.seriesId && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] px-5 py-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[#F5C518] text-xs font-bold uppercase tracking-wider">
                {(isEn && seriesNameEn) ? 'Series' : 'سلسلة'} • {isEn ? `${seriesBooks.length} stories` : `${seriesBooks.length} قصة`}
              </p>
              <p className="text-white font-black text-sm truncate">
                {(isEn && seriesNameEn) ? seriesNameEn : seriesName}
              </p>
              <p className="text-white/40 text-xs mt-0.5">
                {isEn ? `Part ${book.seriesOrder} of ${seriesBooks.length}` : `الجزء ${book.seriesOrder} من ${seriesBooks.length}`}
              </p>
            </div>
            {seriesPrice && seriesSeriesId && (
              <Link
                href={`/library/series/${seriesSeriesId}/buy`}
                className="shrink-0 flex flex-col items-center bg-[#F5C518] hover:bg-amber-400 active:bg-amber-500 text-[#1a1a2e] font-black rounded-2xl px-4 py-2.5 transition shadow-lg shadow-black/20 text-center"
              >
                <span className="text-lg leading-tight">
                  {seriesPriceUSD ? `$${seriesPriceUSD}` : `${seriesPrice} ج.م`}
                </span>
                <span className="text-[10px] font-bold mt-0.5">شراء السلسلة كاملة →</span>
              </Link>
            )}
          </div>
          <div className="p-4">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {seriesBooks.map((sb) => {
                const isCurrent = sb.id === id;
                const sbTitle = (isEn && sb.titleEn) ? sb.titleEn : sb.title;
                return (
                  <Link
                    key={sb.id}
                    href={`/library/${sb.id}`}
                    className={`shrink-0 flex flex-col items-center gap-1.5 group ${
                      isCurrent ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                    } transition-opacity`}
                  >
                    <div className={`relative w-14 h-20 rounded-xl overflow-hidden border-2 transition ${
                      isCurrent ? 'border-[#F5C518] shadow-lg shadow-[#F5C518]/20' : 'border-transparent group-hover:border-gray-300'
                    }`}>
                      {sb.cover ? (
                        <Image src={sb.cover} alt={sbTitle} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xl">📖</div>
                      )}
                      <div className={`absolute top-1 right-1 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center shadow ${
                        isCurrent ? 'bg-[#F5C518] text-[#1a1a2e]' : 'bg-gray-800/70 text-white'
                      }`}>
                        {sb.seriesOrder}
                      </div>
                    </div>
                    <p className={`text-[10px] font-bold text-center w-14 leading-tight line-clamp-2 ${
                      isCurrent ? 'text-[#1a1a2e]' : 'text-gray-500'
                    }`}>{sbTitle}</p>
                  </Link>
                );
              })}
            </div>
            {/* Prev / Next buttons */}
            {(() => {
              const currentIdx = seriesBooks.findIndex(sb => sb.id === id);
              const prev = currentIdx > 0 ? seriesBooks[currentIdx - 1] : null;
              const next = currentIdx < seriesBooks.length - 1 ? seriesBooks[currentIdx + 1] : null;
              return (prev || next) ? (
                <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                  {prev && (
                    <Link href={`/library/${prev.id}`} className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition">
                      <span className="text-gray-400">←</span>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400">{isEn ? 'Previous' : 'السابق'}</p>
                        <p className="text-xs font-bold text-gray-700 truncate">{(isEn && prev.titleEn) ? prev.titleEn : prev.title}</p>
                      </div>
                    </Link>
                  )}
                  {next && (
                    <Link href={`/library/${next.id}`} className="flex-1 flex items-center justify-end gap-2 px-4 py-2.5 bg-[#F5C518]/10 hover:bg-[#F5C518]/20 rounded-xl transition">
                      <div className="min-w-0 text-right">
                        <p className="text-[10px] text-[#F5C518]">{isEn ? 'Next' : 'التالي'}</p>
                        <p className="text-xs font-bold text-gray-700 truncate">{(isEn && next.titleEn) ? next.titleEn : next.title}</p>
                      </div>
                      <span className="text-[#F5C518]">→</span>
                    </Link>
                  )}
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

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
