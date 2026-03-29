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

// ── Forensic watermark: encode userId into zero-width chars ──────────────────
function encodeForensic(text: string, userId: string): string {
  const ZWJ = '\u200D';  // 1
  const ZWNJ = '\u200C'; // 0
  const binary = userId.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
  const hidden = binary.split('').map(b => b === '1' ? ZWJ : ZWNJ).join('');
  // Inject after first word
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

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gold accent line
    ctx.fillStyle = '#F5C518';
    ctx.fillRect(80, 80, 6, 920);

    // Quote marks
    ctx.fillStyle = '#F5C518';
    ctx.font = 'bold 120px serif';
    ctx.fillText('❝', 100, 220);

    // Quote text (RTL, wrapped)
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

    // Book title
    ctx.fillStyle = '#F5C518';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(`— ${bookTitle}`, canvas.width - 100, 880);

    // Site branding
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '24px Arial';
    ctx.fillText('moslimleader.com', canvas.width - 100, 940);

    resolve(canvas.toDataURL('image/png'));
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
            transform: `rotate(-35deg)`,
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
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20"
      style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(26,26,46,0.95) 30%, #1a1a2e 100%)' }}>
      <div className="text-center px-6 py-8 max-w-sm">
        <div className="text-5xl mb-4">🔒</div>
        <h3 className="text-white font-black text-xl mb-2">هذه الصفحة مقفولة</h3>
        <p className="text-gray-300 text-sm mb-6">
          اشترِ الكتاب كاملاً للاستمرار في القراءة
        </p>
        <div className="text-[#F5C518] font-black text-3xl mb-6">
          {price.toLocaleString('ar-EG')} ج.م
        </div>
        <a
          href={`/library/${bookId}/buy`}
          className="block w-full bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-black py-3.5 rounded-2xl text-base transition text-center"
        >
          اشترِ الآن واقرأ كاملاً
        </a>
        <p className="text-gray-500 text-xs mt-4">
          دفع آمن • وصول فوري بعد التأكيد
        </p>
      </div>
    </div>
  );
}

// ── Quote Toast ───────────────────────────────────────────────────────────────
function QuoteToast({
  text, bookTitle, coverUrl, onClose,
}: { text: string; bookTitle: string; coverUrl: string; onClose: () => void }) {
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
    <div className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-80 bg-[#1a1a2e] border border-[#F5C518]/30 rounded-2xl p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">✨</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm mb-1">حوّل الاقتباس لصورة</p>
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{text}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleShare}
              disabled={generating}
              className="flex-1 bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold text-xs py-2 rounded-xl transition disabled:opacity-60"
            >
              {generating ? 'جارٍ الإنشاء...' : '📸 نزّل كصورة'}
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 px-2 text-xs">
              إلغاء
            </button>
          </div>
        </div>
      </div>
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
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Intercept copy — inject forensic watermark + offer quote card
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

  const canViewPage = (page: number) => hasAccess || page <= freePages;

  const goTo = useCallback((page: number) => {
    if (page < 1 || page > numPages) return;
    setCurrentPage(page);
    onPageChange?.(page);
  }, [numPages, onPageChange]);

  const isLocked = currentPage > freePages && !hasAccess;

  return (
    <div
      className={`flex flex-col h-full rounded-2xl overflow-hidden transition-colors ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}
      ref={containerRef}
    >
      {/* ── Toolbar ── */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 font-bold text-sm transition flex items-center justify-center"
          >
            ›
          </button>
          <span className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {currentPage} / {numPages || '...'}
          </span>
          <button
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 font-bold text-sm transition flex items-center justify-center"
          >
            ‹
          </button>
        </div>

        {/* Progress bar */}
        {numPages > 0 && (
          <div className="flex-1 mx-4 hidden sm:block">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F5C518] rounded-full transition-all"
                style={{ width: `${(currentPage / numPages) * 100}%` }}
              />
            </div>
            {!hasAccess && (
              <p className="text-xs text-gray-400 mt-1 text-center">
                {freePages - currentPage > 0
                  ? `تبقّى ${freePages - currentPage} صفحة مجانية`
                  : 'انتهت الصفحات المجانية'}
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => setDarkMode(d => !d)}
          className={`w-8 h-8 rounded-lg text-sm transition flex items-center justify-center ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          title={darkMode ? 'وضع النهار' : 'وضع الليل'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {/* ── PDF Page ── */}
      <div className={`flex-1 overflow-auto flex items-start justify-center py-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="relative">
          <Document
            file={`/api/books/${bookId}/file`}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={
              <div className="flex items-center justify-center w-full py-20">
                <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
              </div>
            }
            error={
              <div className="text-center py-20 text-gray-400">
                <p className="text-4xl mb-3">📚</p>
                <p>تعذّر تحميل الكتاب</p>
              </div>
            }
          >
            {canViewPage(currentPage) && !isLocked && (
              <Page
                pageNumber={currentPage}
                width={pageWidth}
                renderAnnotationLayer={false}
                className="shadow-xl rounded-xl overflow-hidden"
              />
            )}
          </Document>

          {/* Watermark overlay */}
          {watermarkText && !isLocked && (
            <WatermarkOverlay text={watermarkText} />
          )}

          {/* Lock overlay */}
          {isLocked && (
            <div style={{ width: pageWidth, height: pageWidth * 1.41 }} className="relative bg-gray-200 rounded-xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-gray-200 to-gray-300" />
              <LockOverlay price={price} bookId={bookId} />
            </div>
          )}
        </div>
      </div>

      {/* ── Page jumper ── */}
      {numPages > 0 && (
        <div className={`px-4 py-2 border-t flex items-center justify-center gap-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>انتقل لصفحة:</span>
          <input
            type="number"
            min={1}
            max={numPages}
            defaultValue={currentPage}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = parseInt((e.target as HTMLInputElement).value);
                if (v >= 1 && v <= numPages) goTo(v);
              }
            }}
            className="w-16 text-center border border-gray-200 rounded-lg py-1 text-sm outline-none focus:border-[#F5C518]"
          />
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
