'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaKind } from '@/lib/free-media-shared';
import MediaThumb from './MediaThumb';
import Icon from './Icon';

/**
 * Share a media item: the item's own thumbnail and title at the top, so the sharer sees
 * WHAT goes out, then the apps people actually use here, «نسخ الرابط», and the phone's own
 * share menu for everything else.
 *
 * The thumbnail the RECIPIENT sees is not drawn here — it comes from the link preview
 * (src/app/media/preview/[id]/route.ts), which serves the same cover to WhatsApp & co.
 *
 * Brand marks are drawn as simple glyphs in each app's colour: they are how people find
 * the right button at a glance, and no emoji is involved.
 */
type App = { key: string; label: string; color: string; href: (u: string, t: string) => string; glyph: JSX.Element };

const g = (d: string) => <path d={d} fill="currentColor" stroke="none" />;
const APPS: App[] = [
  {
    key: 'whatsapp', label: 'واتساب', color: '#25D366',
    href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t}\n${u}`)}`,
    glyph: g('M12 3.2a8.8 8.8 0 00-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1012 3.2zm4.4 12.1c-.2.5-1.1 1-1.6 1.1-.4.1-.9.1-1.5-.1-.3-.1-.8-.3-1.4-.5-2.4-1-4-3.5-4.1-3.7-.1-.2-1-1.3-1-2.5s.6-1.8.9-2.1c.2-.2.5-.3.6-.3h.5c.1 0 .4 0 .5.4l.7 1.7c.1.1.1.3 0 .5l-.3.4-.3.4c-.1.1-.2.3-.1.5.2.3.7 1.2 1.5 1.9 1 .9 1.9 1.2 2.1 1.3.3.1.4.1.6-.1l.8-1c.2-.2.4-.2.6-.1l1.7.8c.2.1.4.2.4.3.1.1.1.6-.1 1.1z'),
  },
  {
    key: 'facebook', label: 'فيسبوك', color: '#1877F2',
    href: u => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
    glyph: g('M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4a21 21 0 00-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21z'),
  },
  {
    key: 'telegram', label: 'تليجرام', color: '#229ED9',
    href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    glyph: g('M20.7 4.3L2.9 11.2c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.7 5.4c.2.6.4.8.8.8.4 0 .6-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14.2c.3-1.2-.5-1.8-1.4-1.3zM8.4 13.6l9.4-5.9c.5-.3.9-.1.5.2l-8 7.3-.3 3.4z'),
  },
  {
    key: 'x', label: 'إكس', color: '#111111',
    href: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    glyph: g('M17.5 3.5h3l-6.6 7.5 7.8 10.5h-6.1l-4.8-6.3-5.5 6.3h-3l7.1-8.1L2 3.5h6.2l4.4 5.8zm-1 16.2h1.7L7.6 5.2H5.8z'),
  },
  {
    key: 'email', label: 'البريد', color: '#6B7280',
    href: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(`${t}\n${u}`)}`,
    glyph: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></>,
  },
];

export default function MediaShareSheet({ open, onClose, url, title, coverUrl, kind, isEn }: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  coverUrl: string | null;
  kind: MediaKind;
  isEn: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const t = (ar: string, en: string) => (isEn ? en : ar);

  // Rendered only after mount: it portals into <body>, which the server render has none of.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); setCanNative(typeof navigator !== 'undefined' && !!navigator.share); }, []);
  useEffect(() => {
    if (!open) return;
    setCopied(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // In-app browsers often refuse the clipboard API; the old way still works there.
      const ta = document.createElement('textarea');
      ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* nothing more to try */ }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const native = async () => {
    try { await navigator.share({ title, url }); onClose(); } catch { /* closed by the reader */ }
  };

  const tile = 'flex flex-col items-center gap-1.5 text-xs font-semibold text-[#1a1a2e] focus-visible:outline-none group';
  const circle = 'w-14 h-14 rounded-full flex items-center justify-center text-white transition group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-[#F5C518]';

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/55" onClick={onClose} dir={isEn ? 'ltr' : 'rtl'}>
      <div
        role="dialog"
        aria-label={t('مشاركة', 'Share')}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-[#1a1a2e] flex items-center gap-2"><Icon name="share" size={20} /> {t('مشاركة', 'Share')}</h2>
          <button type="button" onClick={onClose} aria-label={t('إغلاق', 'Close')} className="p-2 rounded-full hover:bg-gray-100"><Icon name="close" size={20} /></button>
        </div>

        {/* What is being shared */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#FAF8F3] border border-gray-100 p-2.5 mb-5">
          <MediaThumb kind={kind} coverUrl={coverUrl} title={title} className={`shrink-0 ${kind === 'reel' ? 'w-14 aspect-[9/16]' : 'w-24 aspect-video'}`} eager />
          <div className="min-w-0">
            <p className="font-bold text-sm text-[#1a1a2e] line-clamp-2">{title}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5" dir="ltr">{url.replace(/^https?:\/\//, '')}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-y-4 mb-5">
          {APPS.map(a => (
            <a key={a.key} href={a.href(url, title)} target="_blank" rel="noopener noreferrer" className={tile} onClick={() => setTimeout(onClose, 300)}>
              <span className={circle} style={{ background: a.color }}>
                <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{a.glyph}</svg>
              </span>
              {isEn ? a.key[0].toUpperCase() + a.key.slice(1) : a.label}
            </a>
          ))}
          {canNative && (
            <button type="button" onClick={() => void native()} className={tile}>
              <span className={`${circle} bg-[#EFEBE2] text-[#1a1a2e]`}><Icon name="more" size={24} /></span>
              {t('تطبيقات أخرى', 'More apps')}
            </button>
          )}
        </div>

        {/* Copy link */}
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 ps-3 pe-1.5 py-1.5">
          <Icon name="link" size={18} className="text-gray-400" />
          <span className="flex-1 min-w-0 truncate text-sm text-gray-600" dir="ltr">{url}</span>
          <button
            type="button"
            onClick={() => void copy()}
            className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-bold transition ${copied ? 'bg-green-600 text-white' : 'bg-[#1a1a2e] text-[#F5C518]'}`}
          >
            <Icon name={copied ? 'check' : 'link'} size={16} />
            {copied ? t('تم النسخ', 'Copied') : t('نسخ الرابط', 'Copy link')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
