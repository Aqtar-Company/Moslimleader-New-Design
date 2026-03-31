'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface BookReaderProps {
  bookId: string;
  freePages: number;
  hasAccess: boolean;
  watermarkText?: string;
  enableForensic?: boolean;
  allowQuoteShare?: boolean;
  price: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  bookTitle?: string;
  coverUrl?: string;
  /** 'ar' | 'en' | 'both' — controls arrow direction and keyboard hints */
  bookLanguage?: 'ar' | 'en' | 'both';
}

// ── Forensic watermark ────────────────────────────────────────────────────────
function encodeForensic(text: string, userId: string): string {
  const ZWJ = '\u200D';
  const ZWNJ = '\u200C';
  const binary = userId.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
  const hidden = binary.split('').map(b => b === '1' ? ZWJ : ZWNJ).join('');
  const words = text.split(' ');
  if (words.length < 2) return text + hidden;
  words[0] = words[0] + hidden;
  return words.join(' ');
}

// ── Quote Card Generator ──────────────────────────────────────────────────────
function generateQuoteCard(quote: string, bookTitle: string, coverUrl: string): Promise<string> {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#F5C518';
    ctx.fillRect(80, 80, 6, 920);

    ctx.fillStyle = '#F5C518';
    ctx.font = 'bold 120px serif';
    ctx.fillText('❝', 100, 220);

    ctx.fillStyle = '#ffffff';
    ctx.font = '42px Arial';
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    const maxWidth = 820;
    const lineHeight = 65;
    const words = quote.split(' ');
    let line = '';
    let y = 300;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line !== '') {
        ctx.fillText(line.trim(), canvas.width - 100, y);
        line = word + ' ';
        y += lineHeight;
        if (y > 750) break;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line.trim(), canvas.width - 100, y);

    ctx.fillStyle = '#F5C518';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(bookTitle ? `— ${bookTitle}` : '', canvas.width - 100, 880);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '24px Arial';
    ctx.fillText('moslimleader.com', canvas.width - 100, 940);

    if (coverUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 100, 860, 60, 80);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(canvas.toDataURL('image/png'));
      img.src = coverUrl;
    } else {
      resolve(canvas.toDataURL('image/png'));
    }
  });
}

// ── Watermark Overlay ─────────────────────────────────────────────────────────
function WatermarkOverlay({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" style={{ zIndex: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="absolute text-gray-400 font-bold whitespace-nowrap"
          style={{
            fontSize: '14px',
            opacity: 0.07,
            transform: 'rotate(-35deg)',
            top: `${15 + i * 18}%`,
            left: '-10%',
            right: '-10%',
            textAlign: 'center',
            letterSpacing: '0.5em',
          }}
        >
          {text} • moslimleader.com • {text}
        </div>
      ))}
    </div>
  );
}

// ── Lock Overlay ──────────────────────────────────────────────────────────────
function LockOverlay({ price, bookId }: { price: number; bookId: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(26,26,46,0.97) 25%, #1a1a2e 100%)' }}
    >
      <div className="text-center px-6 py-8 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
          </div>
        <h3 className="text-white font-black text-xl mb-2">أكمل رحلة القراءة</h3>
        <p className="text-gray-400 text-sm mb-5 leading-relaxed">
          انتهت صفحاتك المجانية — احصل على الكتاب كاملاً واستمر في التعلّم
        </p>
        <div className="flex items-baseline justify-center gap-1 mb-5">
          <span className="text-[#F5C518] font-black text-4xl">{price.toLocaleString('ar-EG')}</span>
          <span className="text-gray-400 text-sm">ج.م</span>
        </div>
        <a
          href={`/library/${bookId}/buy`}
          className="block w-full bg-[#F5C518] hover:bg-amber-400 active:bg-amber-500 text-[#1a1a2e] font-black py-4 rounded-2xl text-base transition text-center shadow-lg shadow-amber-500/20"
        >
          اشترِ الآن
        </a>
          <div className="flex items-center justify-center gap-3 mt-4 text-gray-500 text-xs">
          <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>دفع آمن</span>
          <span>•</span>
          <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>وصول فوري</span>
          <span>•</span>
          <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>على جميع الأجهزة</span>
        </div>
      </div>
    </div>
  );
}

// ── Quote Toast ───────────────────────────────────────────────────────────────
function QuoteToast({ text, bookTitle, coverUrl, onClose }: {
  text: string; bookTitle: string; coverUrl: string; onClose: () => void;
}) {
  const [generating, setGenerating] = useState(false);

  const handleShare = async () => {
    setGenerating(true);
    const dataUrl = await generateQuoteCard(text, bookTitle, coverUrl);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'اقتباس.png';
    a.click();
    setGenerating(false);
    onClose();
  };

  return (
    <div className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-80 bg-[#1a1a2e] border border-[#F5C518]/40 rounded-2xl p-4 shadow-2xl z-50">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 bg-[#F5C518]/20 rounded-xl flex items-center justify-center">
          <svg className="w-4 h-4 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm mb-1">حوّل الاقتباس لصورة</p>
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">{text}</p>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              disabled={generating}
              className="flex-1 bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold text-xs py-2 rounded-xl transition disabled:opacity-60"
            >
              {generating ? 'جارِي الإنشاء...' : 'تنزيل كصورة'}            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 px-3 text-xs">
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Free Page Warning Toast ───────────────────────────────────────────────────
function FreePageWarning({ remaining, bookId }: { remaining: number; bookId: string }) {
  return (
    <div className="absolute top-3 left-3 right-3 z-30 bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 shadow-sm">
      <p className="text-amber-800 text-xs font-bold">
        {remaining === 0 ? 'هذه آخر صفحة مجانية' : `تبقّت ${remaining} صفحة مجانية فقط`}
      </p>
      <a
        href={`/library/${bookId}/buy`}
        className="text-xs font-black text-amber-700 underline whitespace-nowrap"
      >
        اشترِ الآن
      </a>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ bookId, bookTitle, onClose }: { bookId: string; bookTitle: string; onClose: () => void }) {
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/library/${bookId}` : '';
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // WhatsApp will use the OG meta tags (book cover) from the URL automatically
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${bookTitle}\n${shareUrl}`)}`, '_blank');
  const shareTwitter = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(bookTitle)}&url=${encodeURIComponent(shareUrl)}`, '_blank');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-sm">مشاركة الكتاب</h3>
              <p className="text-gray-400 text-xs line-clamp-1">{bookTitle}</p>
            </div>
            <button onClick={onClose} className="mr-auto text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>

          {/* URL box */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 mb-4">
            <p className="flex-1 text-xs font-mono text-gray-500 truncate" dir="ltr">{shareUrl}</p>
            <button
              onClick={copy}
              className={`shrink-0 font-bold text-xs px-3 py-1.5 rounded-lg transition ${copied ? 'bg-green-500 text-white' : 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400'}`}
            >
              {copied ? '✓ تم' : 'نسخ'}
            </button>
          </div>

          {/* Social share */}
          <div className="flex gap-2">
            <button
              onClick={shareWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold text-xs py-2.5 rounded-xl transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              واتساب
            </button>
            <button
              onClick={shareTwitter}
              className="flex-1 flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white font-bold text-xs py-2.5 rounded-xl transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              تويتر
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Zoom Modal ────────────────────────────────────────────────────────────────
function ZoomModal({ bookId, pageNumber, numPages, onClose, dm }: {
  bookId: string; pageNumber: number; numPages: number; onClose: () => void; dm: boolean;
}) {
  const [scale, setScale] = useState(1.5);
  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50" onClick={onClose}>
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center font-bold text-lg transition"
          >−</button>
          <span className="text-white text-sm font-bold w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(4, s + 0.25))}
            className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center font-bold text-lg transition"
          >+</button>
        </div>
        <p className="text-white/60 text-xs">{pageNumber} / {numPages}</p>
        <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center font-bold text-xl transition">×</button>
      </div>
      {/* Zoomed page */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4" onClick={e => e.stopPropagation()}>
        <Document file={`/api/books/${bookId}/file`} loading={null}>
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderAnnotationLayer={false}
            className={`shadow-2xl rounded-xl overflow-hidden ${dm ? 'brightness-90' : ''}`}
          />
        </Document>
      </div>
    </div>
  );
}

// ── Main BookReader ───────────────────────────────────────────────────────────
export default function BookReader({
  bookId, freePages, hasAccess, watermarkText, enableForensic = true,
  allowQuoteShare = true, price, initialPage = 1, onPageChange,
  bookTitle = '', coverUrl = '', bookLanguage = 'ar',
}: BookReaderProps) {
  // For Arabic/both books: left arrow = next page (reading right-to-left)
  // For English books: right arrow = next page (reading left-to-right)
  const isLtr = bookLanguage === 'en';
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [prevPage, setPrevPage] = useState(initialPage);
  const [pageWidth, setPageWidth] = useState(600);
  const [quoteToast, setQuoteToast] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [jumperValue, setJumperValue] = useState(String(initialPage));
  const [showShare, setShowShare] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = normal, 1.15 = slightly zoomed in (crops margins)
  const [pageAnim, setPageAnim] = useState<'none' | 'flip-next' | 'flip-prev'>('none');
  const [screenshotBlocked, setScreenshotBlocked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load dark mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('reader-dark-mode');
    if (saved === 'true') setDarkMode(true);
  }, []);

  // Save dark mode to localStorage
  const toggleDark = () => {
    setDarkMode(d => {
      localStorage.setItem('reader-dark-mode', String(!d));
      return !d;
    });
  };

  // Screenshot protection: detect PrintScreen key and blur the reader
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5'))) {
        e.preventDefault();
        setScreenshotBlocked(true);
        // Copy blank to clipboard
        navigator.clipboard?.writeText('').catch(() => {});
        setTimeout(() => setScreenshotBlocked(false), 2000);
      }
    };
    // Also detect visibility change (some screenshot tools)
    const handleVisibility = () => {
      if (document.hidden) {
        setScreenshotBlocked(true);
        setTimeout(() => setScreenshotBlocked(false), 1500);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Responsive width
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setPageWidth(Math.min(containerRef.current.clientWidth - 32, 700));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageDown') {
        goTo(currentPage + 1, 'next');
      } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
        goTo(currentPage - 1, 'prev');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, currentPage, onPageChange]);

  // Intercept copy → forensic watermark
  useEffect(() => {
    if (!allowQuoteShare && !enableForensic) return;
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection()?.toString() || '';
      if (!selection.trim()) return;
      e.preventDefault();
      let finalText = selection;
      if (enableForensic && watermarkText) {
        finalText = encodeForensic(selection, watermarkText);
      }
      e.clipboardData?.setData('text/plain', finalText);
      if (allowQuoteShare && selection.length > 20) {
        setQuoteToast(selection.slice(0, 300));
      }
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [watermarkText, enableForensic, allowQuoteShare]);

  const goTo = useCallback((page: number, direction?: 'next' | 'prev') => {
    if (page < 1 || page > numPages) return;
    const dir = direction || (page > currentPage ? 'next' : 'prev');
    setPrevPage(currentPage);
    setPageAnim(dir === 'next' ? 'flip-next' : 'flip-prev');
    setTimeout(() => {
      setCurrentPage(page);
      setJumperValue(String(page));
      onPageChange?.(page);
      setPageAnim('none');
    }, 180);
  }, [numPages, currentPage, onPageChange]);

  const isLocked = currentPage > freePages && !hasAccess;
  const pagesLeft = freePages - currentPage;
  const showWarning = !hasAccess && !isLocked && pagesLeft >= 0 && pagesLeft <= 2;

  const dm = darkMode;
  const btnCls = `w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition disabled:opacity-30 ${dm ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100'}`;

  // Page flip animation styles
  const pageAnimStyle: React.CSSProperties = pageAnim === 'flip-next'
    ? { animation: 'page-flip-out 0.18s ease-in forwards' }
    : pageAnim === 'flip-prev'
    ? { animation: 'page-flip-in 0.18s ease-out forwards' }
    : {};

  return (
    <>
      {/* Screenshot protection overlay */}
      {screenshotBlocked && (
        <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-12 h-12 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            <p className="text-white text-lg font-bold">محتوى محمي</p>
          </div>
        </div>
      )}

      <div
        dir="rtl"
        className={`flex flex-col rounded-2xl overflow-hidden transition-colors select-none ${dm ? 'bg-gray-950' : 'bg-gray-100'}`}
        style={{ minHeight: '80vh', WebkitUserSelect: 'none', userSelect: 'none' }}
        ref={containerRef}
        onContextMenu={e => e.preventDefault()}
      >
        {/* ── Toolbar ── */}
        <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          {/* Left arrow: next for Arabic (RTL), previous for English (LTR) */}
          <button
            onClick={() => isLtr ? goTo(currentPage - 1, 'prev') : goTo(currentPage + 1, 'next')}
            disabled={isLtr ? currentPage <= 1 : currentPage >= numPages}
            aria-label={isLtr ? 'الصفحة السابقة' : 'الصفحة التالية'}
            title={isLtr ? 'الصفحة السابقة' : 'الصفحة التالية'}
            className={`flex items-center justify-center gap-1 px-3 h-9 rounded-xl font-bold text-xs transition disabled:opacity-30 ${
              isLtr
                ? (dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')
                : (dm ? 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400' : 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400')
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            <span className="hidden sm:inline">{isLtr ? 'السابق' : 'التالي'}</span>
          </button>

          <div className={`text-xs font-bold tabular-nums px-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
            {currentPage} <span className={dm ? 'text-gray-600' : 'text-gray-300'}>/</span> {numPages || '…'}
          </div>

          {/* Right arrow: previous for Arabic (RTL), next for English (LTR) */}
          <button
            onClick={() => isLtr ? goTo(currentPage + 1, 'next') : goTo(currentPage - 1, 'prev')}
            disabled={isLtr ? currentPage >= numPages : currentPage <= 1}
            aria-label={isLtr ? 'الصفحة التالية' : 'الصفحة السابقة'}
            title={isLtr ? 'الصفحة التالية' : 'الصفحة السابقة'}
            className={`flex items-center justify-center gap-1 px-3 h-9 rounded-xl font-bold text-xs transition disabled:opacity-30 ${
              isLtr
                ? (dm ? 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400' : 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400')
                : (dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')
            }`}
          >
            <span className="hidden sm:inline">{isLtr ? 'التالي' : 'السابق'}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </button>

          {/* Progress bar */}
          {numPages > 0 && (
            <div className="flex-1 mx-1 min-w-0">
              <div className={`h-2 rounded-full overflow-hidden ${dm ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div
                  className="h-full bg-[#F5C518] rounded-full transition-all duration-300"
                  style={{ width: `${(currentPage / numPages) * 100}%` }}
                />
              </div>
              {!hasAccess && numPages > 0 && (
                <p className={`text-[10px] mt-0.5 text-center ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  {pagesLeft > 0 ? `${pagesLeft} صفحة مجانية متبقية` : isLocked ? 'انتهت الصفحات المجانية' : 'آخر صفحة مجانية'}
                </p>
              )}
            </div>
          )}

          {/* Share button */}
          <button
            onClick={() => setShowShare(true)}
            aria-label="مشاركة"
            className={btnCls}
            title="مشاركة الكتاب"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            aria-label={dm ? 'وضع النهار' : 'وضع الليل'}
            className={btnCls}
            title={dm ? 'وضع النهار' : 'وضع الليل'}
          >
            {dm ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
            )}
          </button>
        </div>

        {/* ── PDF Page ── */}
        <div className={`flex-1 overflow-auto flex items-start justify-center py-4 ${dm ? 'bg-gray-950' : 'bg-gray-100'}`}>
          <div className="relative group">
            {showWarning && !isLocked && (
              <FreePageWarning remaining={pagesLeft} bookId={bookId} />
            )}

            {/* Zoom icon — inline zoom that crops margins, always visible */}
            {!isLocked && numPages > 0 && (
              <button
                onClick={() => setZoomLevel(z => z === 1 ? 1.18 : 1)}
                className={`absolute bottom-3 left-3 z-20 w-9 h-9 backdrop-blur-sm text-white rounded-xl flex items-center justify-center transition shadow-lg ${
                  zoomLevel > 1
                    ? 'bg-[#F5C518] text-[#1a1a2e]'
                    : 'bg-black/40 hover:bg-black/60'
                }`}
                title={zoomLevel > 1 ? 'عودة للحجم الطبيعي' : 'تكبير وإزالة الهوامش'}
                aria-label={zoomLevel > 1 ? 'عودة للحجم الطبيعي' : 'تكبير'}
              >
                {zoomLevel > 1 ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                )}
              </button>
            )}

            {/* Page with flip animation + inline zoom (crops margins) */}
            <div
              style={{
                ...pageAnimStyle,
                overflow: 'hidden',
                borderRadius: '0.75rem',
              }}
            >
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.25s ease',
                  display: 'inline-block',
                }}
              >
              <Document
                file={`/api/books/${bookId}/file`}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                loading={
                  <div className="flex items-center justify-center py-24 px-12">
                    <div className="text-center">
                      <div className="w-10 h-10 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>جارٍ تحميل الكتاب…</p>
                    </div>
                  </div>
                }
                error={
                  <div className="text-center py-20 px-8">
                    <div className="flex justify-center mb-3"><svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg></div>
                    <p className={`text-sm font-semibold mb-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>تعذّر تحميل الكتاب</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-xs text-[#F5C518] underline"
                    >
                      حاول مرة أخرى
                    </button>
                  </div>
                }
              >
                {!isLocked && (
                  <Page
                    pageNumber={currentPage}
                    width={pageWidth}
                    renderAnnotationLayer={false}
                    className={`shadow-xl rounded-xl overflow-hidden ${dm ? 'brightness-90' : ''}`}
                  />
                )}
              </Document>
              </div>{/* end zoom wrapper */}
            </div>

            {/* Watermark */}
            {watermarkText && !isLocked && (
              <WatermarkOverlay text={watermarkText} />
            )}

            {/* Lock overlay */}
            {isLocked && (
              <div
                style={{ width: pageWidth, height: Math.round(pageWidth * 1.41) }}
                className="relative rounded-xl overflow-hidden bg-[#1a1a2e]"
              >
                <LockOverlay price={price} bookId={bookId} />
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: page jumper + keyboard hint ── */}
        {numPages > 0 && (
          <div className={`px-4 py-2.5 border-t flex items-center justify-between gap-3 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>انتقل لصفحة:</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={jumperValue}
                onChange={e => setJumperValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = parseInt(jumperValue);
                    if (v >= 1 && v <= numPages) goTo(v);
                  }
                }}
                onBlur={() => {
                  const v = parseInt(jumperValue);
                  if (!v || v < 1 || v > numPages) setJumperValue(String(currentPage));
                }}
                className={`w-16 text-center border rounded-lg px-1 py-1 text-sm outline-none focus:border-[#F5C518] ${dm ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
              />
            </div>
            <p className={`text-[10px] hidden sm:block ${dm ? 'text-gray-700' : 'text-gray-300'}`}>
              {isLtr ? '← التالية • السابقة →' : '→ التالية • السابقة ←'}
            </p>
          </div>
        )}

        {/* Quote toast */}
        {quoteToast && (
          <QuoteToast
            text={quoteToast}
            bookTitle={bookTitle}
            coverUrl={coverUrl}
            onClose={() => setQuoteToast(null)}
          />
        )}
      </div>

      {/* Share Modal */}
      {showShare && (
        <ShareModal bookId={bookId} bookTitle={bookTitle} onClose={() => setShowShare(false)} />
      )}

      {/* Zoom Modal removed — replaced with inline zoom button */}

      {/* Page flip CSS */}
      <style jsx global>{`
        @keyframes page-flip-out {
          0%   { opacity: 1; transform: perspective(1200px) rotateY(0deg) translateX(0); }
          100% { opacity: 0; transform: perspective(1200px) rotateY(-8deg) translateX(-20px); }
        }
        @keyframes page-flip-in {
          0%   { opacity: 0; transform: perspective(1200px) rotateY(8deg) translateX(20px); }
          100% { opacity: 1; transform: perspective(1200px) rotateY(0deg) translateX(0); }
        }
      `}</style>
    </>
  );
}
