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
  priceDisplay?: string; // formatted regional price string e.g. "3.75 ﷼" or "150 ج.م"
  initialPage?: number;
  onPageChange?: (page: number) => void;
  bookTitle?: string;
  coverUrl?: string;
  /** 'ar' | 'en' | 'both' — controls arrow direction */
  bookLanguage?: 'ar' | 'en' | 'both';
  bgmUrl?: string;
  promoVideoUrl?: string;
}

interface Bookmark {
  page: number;
  note: string;
  savedAt: number;
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
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(''); return; }
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#F5C518'; ctx.fillRect(80, 80, 6, 920);
    ctx.fillStyle = '#F5C518'; ctx.font = 'bold 120px serif'; ctx.fillText('\u275D', 100, 220);
    ctx.fillStyle = '#ffffff'; ctx.font = '42px Arial'; ctx.direction = 'rtl'; ctx.textAlign = 'right';
    const maxWidth = 820; const lineHeight = 65; const words = quote.split(' ');
    let line = ''; let y = 300;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line !== '') {
        ctx.fillText(line.trim(), canvas.width - 100, y); line = word + ' '; y += lineHeight;
        if (y > 750) break;
      } else { line = test; }
    }
    if (line) ctx.fillText(line.trim(), canvas.width - 100, y);
    ctx.fillStyle = '#F5C518'; ctx.font = 'bold 32px Arial';
    ctx.fillText(bookTitle ? `\u2014 ${bookTitle}` : '', canvas.width - 100, 880);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '24px Arial';
    ctx.fillText('moslimleader.com', canvas.width - 100, 940);
    if (coverUrl) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { ctx.drawImage(img, 100, 860, 60, 80); resolve(canvas.toDataURL('image/png')); };
      img.onerror = () => resolve(canvas.toDataURL('image/png'));
      img.src = coverUrl;
    } else { resolve(canvas.toDataURL('image/png')); }
  });
}

// ── Watermark Overlay ─────────────────────────────────────────────────────────
function WatermarkOverlay({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" style={{ zIndex: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="absolute text-gray-400 font-bold whitespace-nowrap"
          style={{ fontSize: '14px', opacity: 0.07, transform: 'rotate(-35deg)', top: `${15 + i * 18}%`, left: '-10%', right: '-10%', textAlign: 'center', letterSpacing: '0.5em' }}>
          {text} • moslimleader.com • {text}
        </div>
      ))}
    </div>
  );
}

// ── Lock Overlay ──────────────────────────────────────────────────────────────
function LockOverlay({ price, priceDisplay, bookId }: { price: number; priceDisplay?: string; bookId: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20"
      style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(26,26,46,0.97) 25%, #1a1a2e 100%)' }}>
      <div className="text-center px-6 py-8 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h3 className="text-white font-black text-xl mb-2">أكمل رحلة القراءة</h3>
        <p className="text-gray-400 text-sm mb-5 leading-relaxed">انتهت صفحاتك المجانية — احصل على الكتاب كاملاً واستمر في التعلّم</p>
        <div className="flex items-baseline justify-center gap-1 mb-5">
          <span className="text-[#F5C518] font-black text-4xl">
            {priceDisplay ? priceDisplay.split(' ')[0] : price.toLocaleString('ar-EG')}
          </span>
          <span className="text-gray-400 text-sm">
            {priceDisplay ? priceDisplay.split(' ').slice(1).join(' ') : 'ج.م'}
          </span>
        </div>
        <a href={`/library/${bookId}/buy`}
          className="block w-full bg-[#F5C518] hover:bg-amber-400 active:bg-amber-500 text-[#1a1a2e] font-black py-4 rounded-2xl text-base transition text-center shadow-lg shadow-amber-500/20">
          اشترِ الآن
        </a>
        <div className="flex items-center justify-center gap-3 mt-4 text-gray-500 text-xs">
          {['دفع آمن', 'وصول فوري', 'على جميع الأجهزة'].map(t => (
            <span key={t} className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Quote Toast ───────────────────────────────────────────────────────────────
function QuoteToast({ text, bookTitle, coverUrl, onClose }: { text: string; bookTitle: string; coverUrl: string; onClose: () => void }) {
  const [generating, setGenerating] = useState(false);
  const handleShare = async () => {
    setGenerating(true);
    const dataUrl = await generateQuoteCard(text, bookTitle, coverUrl);
    const a = document.createElement('a'); a.href = dataUrl; a.download = 'اقتباس.png'; a.click();
    setGenerating(false); onClose();
  };
  return (
    <div className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-80 bg-[#1a1a2e] border border-[#F5C518]/40 rounded-2xl p-4 shadow-2xl z-50">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 bg-[#F5C518]/20 rounded-xl flex items-center justify-center">
          <svg className="w-4 h-4 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm mb-1">حوّل الاقتباس لصورة</p>
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">{text}</p>
          <div className="flex gap-2">
            <button onClick={handleShare} disabled={generating}
              className="flex-1 bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold text-xs py-2 rounded-xl transition disabled:opacity-60">
              {generating ? 'جارِي الإنشاء...' : 'تنزيل كصورة'}
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 px-3 text-xs">×</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Free Page Warning ─────────────────────────────────────────────────────────
function FreePageWarning({ remaining, bookId }: { remaining: number; bookId: string }) {
  return (
    <div className="absolute top-3 left-3 right-3 z-30 bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 shadow-sm">
      <p className="text-amber-800 text-xs font-bold">
        {remaining === 0 ? 'هذه آخر صفحة مجانية' : `تبقّت ${remaining} صفحة مجانية فقط`}
      </p>
      <a href={`/library/${bookId}/buy`} className="text-xs font-black text-amber-700 underline whitespace-nowrap">اشترِ الآن</a>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ bookId, bookTitle, onClose }: { bookId: string; bookTitle: string; onClose: () => void }) {
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/library/${bookId}` : '';
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${bookTitle}\n${shareUrl}`)}`, '_blank');
  const shareTwitter = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(bookTitle)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-sm">مشاركة الكتاب</h3>
              <p className="text-gray-400 text-xs line-clamp-1">{bookTitle}</p>
            </div>
            <button onClick={onClose} className="mr-auto text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 mb-4">
            <p className="flex-1 text-xs font-mono text-gray-500 truncate" dir="ltr">{shareUrl}</p>
            <button onClick={copy} className={`shrink-0 font-bold text-xs px-3 py-1.5 rounded-lg transition ${copied ? 'bg-green-500 text-white' : 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400'}`}>
              {copied ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  تم
                </span>
              ) : 'نسخ'}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={shareWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold text-xs py-2.5 rounded-xl transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              واتساب
            </button>
            <button onClick={shareTwitter}
              className="flex-1 flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white font-bold text-xs py-2.5 rounded-xl transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              تويتر
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bookmark Panel ────────────────────────────────────────────────────────────
function BookmarkPanel({
  bookmarks, currentPage, onJump, onDelete, onClose, dm
}: {
  bookmarks: Bookmark[];
  currentPage: number;
  onJump: (page: number) => void;
  onDelete: (page: number) => void;
  onClose: () => void;
  dm: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0" onClick={onClose}>
      <div className={`rounded-2xl w-full max-w-sm shadow-2xl max-h-[80vh] flex flex-col ${dm ? 'bg-gray-900' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-4 border-b ${dm ? 'border-gray-800' : 'border-gray-100'}`}>
          <h3 className={`font-black text-sm ${dm ? 'text-white' : 'text-gray-900'}`}>علاماتي المرجعية</h3>
          <button onClick={onClose} className={`text-xl ${dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {bookmarks.length === 0 ? (
            <div className="text-center py-8">
              <svg className={`w-10 h-10 mx-auto mb-2 ${dm ? 'text-gray-700' : 'text-gray-300'}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
              <p className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>لا توجد علامات مرجعية بعد</p>
              <p className={`text-xs mt-1 ${dm ? 'text-gray-600' : 'text-gray-300'}`}>اضغط على أيقونة العلامة في شريط الأدوات لحفظ صفحة</p>
            </div>
          ) : (
            bookmarks.sort((a, b) => a.page - b.page).map(bm => (
              <div key={bm.page}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition ${
                  bm.page === currentPage
                    ? (dm ? 'bg-[#F5C518]/20 border border-[#F5C518]/40' : 'bg-amber-50 border border-amber-200')
                    : (dm ? 'bg-gray-800 hover:bg-gray-750' : 'bg-gray-50 hover:bg-gray-100')
                }`}
                onClick={() => { onJump(bm.page); onClose(); }}
              >
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                  bm.page === currentPage ? 'bg-[#F5C518] text-[#1a1a2e]' : (dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')
                }`}>
                  {bm.page}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${dm ? 'text-gray-200' : 'text-gray-700'}`}>صفحة {bm.page}</p>
                  {bm.note && <p className={`text-xs mt-0.5 line-clamp-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{bm.note}</p>}
                  <p className={`text-[10px] mt-1 ${dm ? 'text-gray-600' : 'text-gray-300'}`}>
                    {new Date(bm.savedAt).toLocaleDateString('ar-EG')}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(bm.page); }}
                  className={`shrink-0 text-xs px-2 py-1 rounded-lg transition ${dm ? 'text-gray-600 hover:text-red-400 hover:bg-red-400/10' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Bookmark Modal ────────────────────────────────────────────────────────
function AddBookmarkModal({
  page, onSave, onClose, dm
}: {
  page: number;
  onSave: (note: string) => void;
  onClose: () => void;
  dm: boolean;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0" onClick={onClose}>
      <div className={`rounded-2xl w-full max-w-sm shadow-2xl ${dm ? 'bg-gray-900' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#F5C518]/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            </div>
            <div>
              <h3 className={`font-black text-sm ${dm ? 'text-white' : 'text-gray-900'}`}>حفظ صفحة {page}</h3>
              <p className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-400'}`}>أضف ملاحظة اختيارية</p>
            </div>
            <button onClick={onClose} className={`mr-auto text-xl ${dm ? 'text-gray-400' : 'text-gray-400'}`}>×</button>
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="مثال: معلومة مهمة عن الصبر..."
            rows={3}
            autoFocus
            className={`w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:border-[#F5C518] transition ${
              dm ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
            }`}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onSave(note)}
              className="flex-1 bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-black text-sm py-2.5 rounded-xl transition"
            >
              حفظ العلامة
            </button>
            <button onClick={onClose} className={`px-4 text-sm rounded-xl transition ${dm ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Promo Video Card ──────────────────────────────────────────────────────────
function PromoVideoCard({ videoUrl, bookTitle, onClose }: { videoUrl: string; bookTitle: string; onClose: () => void }) {
  // Extract YouTube video ID
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };
  const videoId = getYouTubeId(videoUrl);
  if (!videoId) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 shadow-2xl rounded-2xl overflow-hidden bg-[#1a1a2e] border border-[#F5C518]/30">
      <div className="flex items-center justify-between px-3 py-2 bg-[#F5C518]/10">
        <p className="text-[#F5C518] text-xs font-bold line-clamp-1">{bookTitle} — الفيديو التعريفي</p>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
      </div>
      <div className="relative" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

// ── Ambient Music Player ──────────────────────────────────────────────────────
// AmbientMusicButton — renders just the play/pause button, receives state from parent
function AmbientMusicButton({ playing, onToggle, dm }: { playing: boolean; onToggle: () => void; dm: boolean }) {
  const btnBase = `w-8 h-8 rounded-xl flex items-center justify-center transition ${dm ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`;
  return (
    <button
      onClick={onToggle}
      title={playing ? 'إيقاف الموسيقى' : 'تشغيل موسيقى الخلفية'}
      className={`${btnBase} ${playing ? 'bg-[#F5C518] text-[#1a1a2e]' : (dm ? 'text-gray-400' : 'text-gray-500')}`}
    >
      {playing ? (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 4h4v16H6zm8 0h4v16h-4z"/>
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      )}
    </button>
  );
}

// AmbientMusicControl — manages audio state + renders hidden iframe + ONE button
// Pass buttonClassName to control visibility per breakpoint
function AmbientMusicControl({ bgmUrl, dm }: { bgmUrl: string; dm: boolean }) {
  const isSoundCloud = bgmUrl.includes('soundcloud.com');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scWidgetRef = useRef<HTMLIFrameElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume] = useState(0.12);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const REPEAT_INTERVAL_MS = 10 * 60 * 1000;

  const scWidgetUrl = isSoundCloud
    ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(bgmUrl)}&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false&buying=false&sharing=false&download=false&color=%23F5C518`
    : null;

  useEffect(() => {
    if (isSoundCloud) return;
    const audio = new Audio(bgmUrl);
    audio.loop = false;
    audio.volume = volume;
    audioRef.current = audio;
    const playOnce = () => { audio.currentTime = 0; audio.play().then(() => setPlaying(true)).catch(() => {}); };
    audio.addEventListener('ended', () => setPlaying(false));
    playTimerRef.current = setTimeout(() => {
      playOnce();
      repeatIntervalRef.current = setInterval(playOnce, REPEAT_INTERVAL_MS);
    }, 800);
    return () => {
      audio.pause(); audio.src = '';
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgmUrl]);

  const toggle = () => {
    if (isSoundCloud) { setPlaying(p => !p); return; }
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause(); setPlaying(false);
      if (repeatIntervalRef.current) { clearInterval(repeatIntervalRef.current); repeatIntervalRef.current = null; }
    } else {
      audio.currentTime = 0;
      audio.play().then(() => setPlaying(true)).catch(() => {});
      if (!repeatIntervalRef.current) {
        repeatIntervalRef.current = setInterval(() => {
          if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
        }, REPEAT_INTERVAL_MS);
      }
    }
  };

  return (
    <>
      {/* Hidden SoundCloud iframe — only one instance */}
      {isSoundCloud && scWidgetUrl && playing && (
        <iframe ref={scWidgetRef} src={scWidgetUrl} width="0" height="0" allow="autoplay"
          style={{ position: 'fixed', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 }} />
      )}
      {/* Single button — visible on all screens */}
      <AmbientMusicButton playing={playing} onToggle={toggle} dm={dm} />
    </>
  );
}

// ── Main BookReader ───────────────────────────────────────────────────────────
export default function BookReader({
  bookId, freePages, hasAccess, watermarkText, enableForensic = true,
  allowQuoteShare = true, price, priceDisplay, initialPage = 1, onPageChange,
  bookTitle = '', coverUrl = '', bookLanguage = 'ar',
  bgmUrl, promoVideoUrl,
}: BookReaderProps) {
  const isLtr = bookLanguage === 'en';

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageWidth, setPageWidth] = useState(600);
  const [quoteToast, setQuoteToast] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [jumperValue, setJumperValue] = useState(String(initialPage));
  const [showShare, setShowShare] = useState(false);
  const [pageAnim, setPageAnim] = useState<'none' | 'slide-next' | 'slide-prev'>('none');
  const [screenshotBlocked, setScreenshotBlocked] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);
  const [showAddBookmark, setShowAddBookmark] = useState(false);

  // Promo video
  const [showPromo, setShowPromo] = useState(false);

  // Mobile overflow menu
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // ── BGM Audio (single instance, shared across desktop + mobile buttons) ──
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgmRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const BGM_REPEAT_MS = 10 * 60 * 1000;

  useEffect(() => {
    if (!bgmUrl || bgmUrl.includes('soundcloud.com')) return;
    const audio = new Audio(bgmUrl);
    audio.loop = false;
    audio.volume = 0.12;
    bgmAudioRef.current = audio;
    const playOnce = () => { audio.currentTime = 0; audio.play().then(() => setBgmPlaying(true)).catch(() => {}); };
    audio.addEventListener('ended', () => setBgmPlaying(false));
    bgmPlayTimerRef.current = setTimeout(() => {
      playOnce();
      bgmRepeatRef.current = setInterval(playOnce, BGM_REPEAT_MS);
    }, 800);
    return () => {
      audio.pause(); audio.src = '';
      if (bgmPlayTimerRef.current) clearTimeout(bgmPlayTimerRef.current);
      if (bgmRepeatRef.current) clearInterval(bgmRepeatRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgmUrl]);

  const toggleBgm = useCallback(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;
    if (bgmPlaying) {
      audio.pause(); setBgmPlaying(false);
      if (bgmRepeatRef.current) { clearInterval(bgmRepeatRef.current); bgmRepeatRef.current = null; }
    } else {
      audio.currentTime = 0;
      audio.play().then(() => setBgmPlaying(true)).catch(() => {});
      if (!bgmRepeatRef.current) {
        bgmRepeatRef.current = setInterval(() => {
          if (bgmAudioRef.current) { bgmAudioRef.current.currentTime = 0; bgmAudioRef.current.play().then(() => setBgmPlaying(true)).catch(() => {}); }
        }, BGM_REPEAT_MS);
      }
    }
  }, [bgmPlaying]);

  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Load bookmarks from localStorage
  useEffect(() => {
    try {
      const key = `bookmarks-${bookId}`;
      const saved = localStorage.getItem(key);
      if (saved) setBookmarks(JSON.parse(saved));
    } catch { /* Safari private mode */ }
  }, [bookId]);

  const saveBookmarks = (bms: Bookmark[]) => {
    setBookmarks(bms);
    try { localStorage.setItem(`bookmarks-${bookId}`, JSON.stringify(bms)); } catch {}
  };

  const addBookmark = (note: string) => {
    const existing = bookmarks.find(b => b.page === currentPage);
    if (existing) {
      // Update note
      saveBookmarks(bookmarks.map(b => b.page === currentPage ? { ...b, note, savedAt: Date.now() } : b));
    } else {
      saveBookmarks([...bookmarks, { page: currentPage, note, savedAt: Date.now() }]);
    }
    setShowAddBookmark(false);
  };

  const deleteBookmark = (page: number) => {
    saveBookmarks(bookmarks.filter(b => b.page !== page));
  };

  const isCurrentPageBookmarked = bookmarks.some(b => b.page === currentPage);

  // Show promo video after 5 minutes (once per book)
  useEffect(() => {
    if (!promoVideoUrl) return;
    try {
      const key = `promo-seen-${bookId}`;
      if (localStorage.getItem(key)) return;
    } catch {}
    const timer = setTimeout(() => {
      setShowPromo(true);
      try { localStorage.setItem(`promo-seen-${bookId}`, '1'); } catch {}
    }, 30 * 1000); // Show after 30 seconds
    return () => clearTimeout(timer);
  }, [bookId, promoVideoUrl]);

  // Dark mode persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem('reader-dark-mode');
      if (saved === 'true') setDarkMode(true);
    } catch { /* Safari private mode */ }
  }, []);
  const toggleDark = () => {
    setDarkMode(d => { try { localStorage.setItem('reader-dark-mode', String(!d)); } catch {} return !d; });
  };

  // Screenshot protection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && ['3','4','5'].includes(e.key))) {
        e.preventDefault();
        setScreenshotBlocked(true);
        navigator.clipboard?.writeText('').catch(() => {});
        setTimeout(() => setScreenshotBlocked(false), 2000);
      }
    };
    const handleVisibility = () => {
      if (document.hidden) { setScreenshotBlocked(true); setTimeout(() => setScreenshotBlocked(false), 1500); }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { window.removeEventListener('keydown', handleKeyDown); document.removeEventListener('visibilitychange', handleVisibility); };
  }, []);

  // Responsive width
  useEffect(() => {
    const update = () => {
      if (containerRef.current) setPageWidth(Math.min(containerRef.current.clientWidth - 32, 700));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Auto-hide toolbar
  const resetToolbarTimer = useCallback(() => {
    setToolbarVisible(true);
    if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    toolbarTimerRef.current = setTimeout(() => setToolbarVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetToolbarTimer();
    return () => { if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current); };
  }, [resetToolbarTimer]);

  // Fullscreen API
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      resetToolbarTimer();
      if (e.key === 'ArrowLeft' || e.key === 'PageDown') goTo(currentPage + 1, 'next');
      else if (e.key === 'ArrowRight' || e.key === 'PageUp') goTo(currentPage - 1, 'prev');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, currentPage, onPageChange]);

  // Forensic copy intercept
  useEffect(() => {
    if (!allowQuoteShare && !enableForensic) return;
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection()?.toString() || '';
      if (!selection.trim()) return;
      e.preventDefault();
      let finalText = selection;
      if (enableForensic && watermarkText) finalText = encodeForensic(selection, watermarkText);
      e.clipboardData?.setData('text/plain', finalText);
      if (allowQuoteShare && selection.length > 20) setQuoteToast(selection.slice(0, 300));
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [watermarkText, enableForensic, allowQuoteShare]);

  const goTo = useCallback((page: number, direction?: 'next' | 'prev') => {
    if (page < 1 || page > numPages) return;
    const dir = direction || (page > currentPage ? 'next' : 'prev');
    setPageAnim(dir === 'next' ? 'slide-next' : 'slide-prev');
    setTimeout(() => {
      setCurrentPage(page);
      setJumperValue(String(page));
      onPageChange?.(page);
      setPageAnim('none');
    }, 175); // half of 0.35s animation — page changes at peak of flip
  }, [numPages, currentPage, onPageChange]);

  const isLocked = currentPage > freePages && !hasAccess;
  const pagesLeft = freePages - currentPage;
  const showWarning = !hasAccess && !isLocked && pagesLeft >= 0 && pagesLeft <= 2;

  const dm = darkMode;
  const btnCls = `w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition disabled:opacity-30 ${dm ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;

  // Page flip animation — direction aware (Arabic flips right, LTR flips left)
  const pageAnimStyle: React.CSSProperties = pageAnim === 'slide-next'
    ? { animation: `page-flip-next-${isLtr ? 'ltr' : 'rtl'} 0.35s cubic-bezier(0.4,0,0.2,1) forwards` }
    : pageAnim === 'slide-prev'
    ? { animation: `page-flip-prev-${isLtr ? 'ltr' : 'rtl'} 0.35s cubic-bezier(0.4,0,0.2,1) forwards` }
    : {};

  // Tap zone handler
  const handlePageTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const zone = x / w;
    resetToolbarTimer();
    if (zone < 0.3) {
      if (isLtr) goTo(currentPage - 1, 'prev');
      else goTo(currentPage + 1, 'next');
    } else if (zone > 0.7) {
      if (isLtr) goTo(currentPage + 1, 'next');
      else goTo(currentPage - 1, 'prev');
    } else {
      setToolbarVisible(v => !v);
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    }
  }, [currentPage, isLtr, goTo, resetToolbarTimer]);

  // Swipe gesture handler — direction aware
  // Arabic (RTL): swipe LEFT (←) = go to NEXT page (pages go right-to-left)
  //               swipe RIGHT (→) = go to PREV page
  // English (LTR): swipe LEFT (←) = go to PREV page
  //                swipe RIGHT (→) = go to NEXT page
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    resetToolbarTimer();
    if (isLtr) {
      // LTR: swipe right = next, swipe left = prev
      if (dx > 0) goTo(currentPage + 1, 'next');
      else goTo(currentPage - 1, 'prev');
    } else {
      // RTL Arabic: swipe left (←) = next page, swipe right (→) = prev page
      if (dx < 0) goTo(currentPage + 1, 'next');
      else goTo(currentPage - 1, 'prev');
    }
  }, [currentPage, isLtr, goTo, resetToolbarTimer]);

  return (
    <>
      {/* Screenshot protection overlay */}
      {screenshotBlocked && (
        <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-12 h-12 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
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
        onMouseMove={resetToolbarTimer}
      >
        {/* ── Toolbar (always visible) ── */}
        <div className="relative z-50">
          <div className={`flex flex-col border-b ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>

            {/* ── Row 1: Navigation + Progress (all screens) ── */}
            <div className="flex items-center gap-2 px-3 py-2">

              {/* Left arrow */}
              <button
                onClick={() => isLtr ? goTo(currentPage - 1, 'prev') : goTo(currentPage + 1, 'next')}
                disabled={isLtr ? currentPage <= 1 : currentPage >= numPages}
                aria-label={isLtr ? 'السابق' : 'التالي'}
                className={`flex items-center justify-center gap-1 px-3 h-9 rounded-xl font-bold text-xs transition disabled:opacity-30 ${
                  isLtr
                    ? (dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')
                    : (dm ? 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400' : 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400')
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                <span className="hidden sm:inline">{isLtr ? 'السابق' : 'التالي'}</span>
              </button>

              {/* Page counter */}
              <div className={`text-xs font-bold tabular-nums px-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
                {currentPage} <span className={dm ? 'text-gray-600' : 'text-gray-300'}>/</span> {numPages || '…'}
              </div>

              {/* Right arrow */}
              <button
                onClick={() => isLtr ? goTo(currentPage + 1, 'next') : goTo(currentPage - 1, 'prev')}
                disabled={isLtr ? currentPage >= numPages : currentPage <= 1}
                aria-label={isLtr ? 'التالي' : 'السابق'}
                className={`flex items-center justify-center gap-1 px-3 h-9 rounded-xl font-bold text-xs transition disabled:opacity-30 ${
                  isLtr
                    ? (dm ? 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400' : 'bg-[#F5C518] text-[#1a1a2e] hover:bg-amber-400')
                    : (dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')
                }`}
              >
                <span className="hidden sm:inline">{isLtr ? 'التالي' : 'السابق'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {/* Progress bar */}
              {numPages > 0 && (
                <div className="flex-1 mx-1 min-w-0">
                  <div className={`h-2 rounded-full overflow-hidden ${dm ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div className="h-full bg-[#F5C518] rounded-full transition-all duration-300"
                      style={{ width: `${(currentPage / numPages) * 100}%` }} />
                  </div>
                </div>
              )}

              {/* Desktop-only tools in row 1 */}
              <div className="hidden sm:flex items-center gap-1">
                {/* Zoom */}
                <button
                  onClick={() => setZoomLevel(z => z === 1 ? 1.18 : 1)}
                  aria-label={zoomLevel > 1 ? 'تصغير' : 'تكبير'}
                  className={`${btnCls} ${zoomLevel > 1 ? 'bg-[#F5C518] text-[#1a1a2e]' : ''}`}
                >
                  {zoomLevel > 1 ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  )}
                </button>
                {/* Bookmark */}
                <button
                  onClick={() => { if (isCurrentPageBookmarked) { setShowBookmarkPanel(true); } else { setShowAddBookmark(true); } }}
                  aria-label={isCurrentPageBookmarked ? 'عرض العلامات' : 'حفظ الصفحة'}
                  className={`${btnCls} relative ${isCurrentPageBookmarked ? 'text-[#F5C518]' : ''}`}
                >
                  <svg className="w-4 h-4" fill={isCurrentPageBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                  {bookmarks.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F5C518] text-[#1a1a2e] text-[9px] font-black rounded-full flex items-center justify-center">{bookmarks.length}</span>
                  )}
                </button>
                {/* Bookmark list */}
                <button onClick={() => setShowBookmarkPanel(true)} aria-label="قائمة العلامات" className={btnCls}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </button>
                {/* Music — desktop only */}
                {bgmUrl && <AmbientMusicButton playing={bgmPlaying} onToggle={toggleBgm} dm={dm} />}
                {/* Fullscreen */}
                <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'خروج ملء الشاشة' : 'ملء الشاشة'} className={btnCls}>
                  {isFullscreen ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                </button>
                {/* Share */}
                <button onClick={() => setShowShare(true)} aria-label="مشاركة" className={btnCls}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                {/* Dark mode */}
                <button onClick={toggleDark} aria-label={dm ? 'وضع النهار' : 'وضع الليل'} className={btnCls}>
                  {dm ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                  )}
                </button>
              </div>

            </div>{/* end row 1 */}

            {/* ── Row 2: Tools (mobile only) ── */}
            <div className={`sm:hidden flex items-center justify-around gap-1 px-2 py-1.5 border-t ${dm ? 'border-gray-800' : 'border-gray-100'}`}>

              {/* Zoom */}
              <button
                onClick={() => setZoomLevel(z => z === 1 ? 1.18 : 1)}
                aria-label={zoomLevel > 1 ? 'تصغير' : 'تكبير'}
                className={`${btnCls} ${zoomLevel > 1 ? 'bg-[#F5C518] text-[#1a1a2e]' : ''}`}
              >
                {zoomLevel > 1 ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                )}
              </button>

              {/* Bookmark */}
              <button
                onClick={() => { if (isCurrentPageBookmarked) { setShowBookmarkPanel(true); } else { setShowAddBookmark(true); } }}
                aria-label={isCurrentPageBookmarked ? 'عرض العلامات' : 'حفظ الصفحة'}
                className={`${btnCls} relative ${isCurrentPageBookmarked ? 'text-[#F5C518]' : ''}`}
              >
                <svg className="w-4 h-4" fill={isCurrentPageBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                {bookmarks.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F5C518] text-[#1a1a2e] text-[9px] font-black rounded-full flex items-center justify-center">{bookmarks.length}</span>
                )}
              </button>

              {/* Bookmark list */}
              <button onClick={() => setShowBookmarkPanel(true)} aria-label="قائمة العلامات" className={btnCls}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </button>

              {/* Music */}
              {bgmUrl && <AmbientMusicButton playing={bgmPlaying} onToggle={toggleBgm} dm={dm} />}

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'خروج ملء الشاشة' : 'ملء الشاشة'} className={btnCls}>
                {isFullscreen ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>

              {/* Share */}
              <button onClick={() => setShowShare(true)} aria-label="مشاركة" className={btnCls}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>

              {/* Dark mode */}
              <button onClick={toggleDark} aria-label={dm ? 'وضع النهار' : 'وضع الليل'} className={btnCls}>
                {dm ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                )}
              </button>

            </div>{/* end row 2 mobile */}

          </div>{/* end toolbar flex-col */}
        </div>{/* end z-50 wrapper */}

        {/* ── PDF Page ── */}
        <div
          className={`flex-1 overflow-auto flex items-start justify-center py-4 ${dm ? 'bg-gray-950' : 'bg-gray-100'}`}
          onClick={handlePageTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative">
            {showWarning && !isLocked && (
              <FreePageWarning remaining={pagesLeft} bookId={bookId} />
            )}

            {/* Page with simple slide animation */}
            <div style={{ ...pageAnimStyle, overflow: 'hidden', borderRadius: '0.75rem' }}>
              <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center top', transition: 'transform 0.25s ease', display: 'inline-block' }}>
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
                      <div className="flex justify-center mb-3">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                      <p className={`text-sm font-semibold mb-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>تعذّر تحميل الكتاب</p>
                      <button onClick={() => window.location.reload()} className="text-xs text-[#F5C518] underline">حاول مرة أخرى</button>
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
              </div>
            </div>

            {/* Watermark */}
            {watermarkText && !isLocked && <WatermarkOverlay text={watermarkText} />}

            {/* Lock overlay */}
            {isLocked && (
              <div style={{ width: pageWidth, height: Math.round(pageWidth * 1.41) }}
                className="relative rounded-xl overflow-hidden bg-[#1a1a2e]">
                <LockOverlay price={price} priceDisplay={priceDisplay} bookId={bookId} />
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: page jumper ── */}
        {numPages > 0 && toolbarVisible && (
          <div className={`px-4 py-2.5 border-t flex items-center justify-between gap-3 transition-all duration-300 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>انتقل لصفحة:</span>
              <input
                type="number" min={1} max={numPages} value={jumperValue}
                onChange={e => setJumperValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(jumperValue); if (v >= 1 && v <= numPages) goTo(v); } }}
                onBlur={() => { const v = parseInt(jumperValue); if (!v || v < 1 || v > numPages) setJumperValue(String(currentPage)); }}
                className={`w-16 text-center border rounded-lg px-1 py-1 text-sm outline-none focus:border-[#F5C518] ${dm ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
              />
            </div>
            <p className={`text-[10px] hidden sm:block ${dm ? 'text-gray-700' : 'text-gray-300'}`}>
              اضغط المنتصف لإخفاء/إظهار شريط الأدوات
            </p>
          </div>
        )}

        {/* Quote toast */}
        {quoteToast && (
          <QuoteToast text={quoteToast} bookTitle={bookTitle} coverUrl={coverUrl} onClose={() => setQuoteToast(null)} />
        )}
      </div>

      {/* Share Modal */}
      {showShare && <ShareModal bookId={bookId} bookTitle={bookTitle} onClose={() => setShowShare(false)} />}

      {/* Bookmark Panel */}
      {showBookmarkPanel && (
        <BookmarkPanel
          bookmarks={bookmarks}
          currentPage={currentPage}
          onJump={page => goTo(page)}
          onDelete={deleteBookmark}
          onClose={() => setShowBookmarkPanel(false)}
          dm={dm}
        />
      )}

      {/* Add Bookmark Modal */}
      {showAddBookmark && (
        <AddBookmarkModal
          page={currentPage}
          onSave={addBookmark}
          onClose={() => setShowAddBookmark(false)}
          dm={dm}
        />
      )}

      {/* Promo Video Card */}
      {showPromo && promoVideoUrl && (
        <PromoVideoCard
          videoUrl={promoVideoUrl}
          bookTitle={bookTitle}
          onClose={() => setShowPromo(false)}
        />
      )}

      {/* Page transition CSS — book-like flip animation, direction-aware */}
      <style jsx global>{`
        /* Arabic RTL: next page slides in from RIGHT, prev from LEFT */
        @keyframes page-flip-next-rtl {
          0%   { opacity: 1; transform: translateX(0) scale(1); }
          40%  { opacity: 0.3; transform: translateX(40px) scale(0.97); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes page-flip-prev-rtl {
          0%   { opacity: 1; transform: translateX(0) scale(1); }
          40%  { opacity: 0.3; transform: translateX(-40px) scale(0.97); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        /* English LTR: next page slides in from LEFT, prev from RIGHT */
        @keyframes page-flip-next-ltr {
          0%   { opacity: 1; transform: translateX(0) scale(1); }
          40%  { opacity: 0.3; transform: translateX(-40px) scale(0.97); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes page-flip-prev-ltr {
          0%   { opacity: 1; transform: translateX(0) scale(1); }
          40%  { opacity: 0.3; transform: translateX(40px) scale(0.97); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </>
  );
}
