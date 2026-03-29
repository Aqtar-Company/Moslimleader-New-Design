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
        <div className="w-16 h-16 rounded-2xl bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center text-3xl mx-auto mb-5">🔒</div>
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
          اشترِ الآن 🔓
        </a>
        <div className="flex items-center justify-center gap-3 mt-4 text-gray-500 text-xs">
          <span>✓ دفع آمن</span>
          <span>•</span>
          <span>✓ وصول فوري</span>
          <span>•</span>
          <span>✓ على جميع الأجهزة</span>
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
        <div className="text-2xl shrink-0">✨</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm mb-1">حوّل الاقتباس لصورة</p>
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">{text}</p>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              disabled={generating}
              className="flex-1 bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold text-xs py-2 rounded-xl transition disabled:opacity-60"
            >
              {generating ? 'جارٍ الإنشاء...' : '📸 نزّل كصورة'}
            </button>
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
        {remaining === 0 ? '⚠️ هذه آخر صفحة مجانية' : `⚠️ تبقّت ${remaining} صفحة مجانية فقط`}
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

// ── Main BookReader ───────────────────────────────────────────────────────────
export default function BookReader({
  bookId, freePages, hasAccess, watermarkText, enableForensic = true,
  allowQuoteShare = true, price, initialPage = 1, onPageChange,
  bookTitle = '', coverUrl = '',
}: BookReaderProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageWidth, setPageWidth] = useState(600);
  const [quoteToast, setQuoteToast] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [jumperValue, setJumperValue] = useState(String(initialPage));
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
        // Left arrow = next page (Arabic reading direction: left = forward)
        setCurrentPage(p => {
          const next = Math.min(p + 1, numPages);
          if (next !== p) { onPageChange?.(next); setJumperValue(String(next)); }
          return next;
        });
      } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
        // Right arrow = previous page
        setCurrentPage(p => {
          const prev = Math.max(p - 1, 1);
          if (prev !== p) { onPageChange?.(prev); setJumperValue(String(prev)); }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [numPages, onPageChange]);

  // Intercept copy → forensic watermark + quote card
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

  const goTo = useCallback((page: number) => {
    if (page < 1 || page > numPages) return;
    setCurrentPage(page);
    setJumperValue(String(page));
    onPageChange?.(page);
  }, [numPages, onPageChange]);

  const isLocked = currentPage > freePages && !hasAccess;
  const pagesLeft = freePages - currentPage;
  const showWarning = !hasAccess && !isLocked && pagesLeft >= 0 && pagesLeft <= 2;

  const dm = darkMode;
  const btnCls = `w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition disabled:opacity-30 ${dm ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100'}`;

  return (
    <div
      dir="rtl"
      className={`flex flex-col rounded-2xl overflow-hidden transition-colors ${dm ? 'bg-gray-950' : 'bg-gray-100'}`}
      style={{ minHeight: '80vh' }}
      ref={containerRef}
    >
      {/* ── Toolbar ── */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        {/* Navigation: RIGHT = previous (السابقة), LEFT = next (التالية) in RTL */}
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="الصفحة السابقة"
          className={btnCls}
          title="الصفحة السابقة (→)"
        >
          ›
        </button>

        <div className={`text-xs font-bold tabular-nums px-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
          {currentPage} <span className={dm ? 'text-gray-600' : 'text-gray-300'}>/</span> {numPages || '…'}
        </div>

        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage >= numPages}
          aria-label="الصفحة التالية"
          className={btnCls}
          title="الصفحة التالية (←)"
        >
          ‹
        </button>

        {/* Progress bar — always visible */}
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

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          aria-label={dm ? 'وضع النهار' : 'وضع الليل'}
          className={btnCls}
          title={dm ? 'وضع النهار' : 'وضع الليل'}
        >
          {dm ? '☀️' : '🌙'}
        </button>
      </div>

      {/* ── PDF Page ── */}
      <div className={`flex-1 overflow-auto flex items-start justify-center py-4 ${dm ? 'bg-gray-950' : 'bg-gray-100'}`}>
        <div className="relative">
          {showWarning && !isLocked && (
            <FreePageWarning remaining={pagesLeft} bookId={bookId} />
          )}

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
                <p className="text-4xl mb-3">📚</p>
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
            ← التالية • السابقة →
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
  );
}
