'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * The share surface for a post.
 *
 * It replaced an anchored dropdown, and the change is deliberate: an anchored popup has to
 * measure a trigger that may be one of several simultaneously-mounted breakpoint variants,
 * has to track it through every scroll, and has to be short enough not to cover the card it
 * belongs to. That produced a menu that opened nothing on desktop and covered the whole
 * screen on a phone. A centred modal has no anchor to get wrong.
 *
 * It is also a better fit for what sharing is for here: the first thing offered is posting
 * it to Tareeq with your own words, then sending it to someone you actually talk to, and
 * only then the outside world.
 */

interface SharePost {
  id: string;
  title?: string | null;
  content: string;
  imageUrl?: string | null;
}

interface Conversation {
  id: string;
  otherUser: { id: string; name: string; avatarUrl?: string | null };
}

export default function TareeqShareSheet({
  post,
  isRtl,
  onClose,
  onShared,
}: {
  post: SharePost;
  isRtl: boolean;
  onClose: () => void;
  /** Fired after the post is re-shared onto Tareeq, so a feed can refresh. */
  onShared?: () => void;
}) {
  const { user } = useAuth();
  const postUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tareeq/${post.id}`
    : `/tareeq/${post.id}`;
  const quote = (post.title || post.content || '').trim().slice(0, 160);

  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [posted, setPosted] = useState(false);

  const [convos, setConvos] = useState<Conversation[]>([]);
  const [convosLoading, setConvosLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState('');

  const [copied, setCopied] = useState(false);
  const closedRef = useRef(false);

  // Escape + body scroll lock, like every other modal in Tareeq.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => () => { closedRef.current = true; }, []);

  // Conversations power the "send in messages" row. Signed-out users have none.
  useEffect(() => {
    if (!user) return;
    setConvosLoading(true);
    fetch('/api/tareeq/conversations', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!closedRef.current && d) setConvos(d.conversations ?? []); })
      .catch(() => { /* offline */ })
      .finally(() => { if (!closedRef.current) setConvosLoading(false); });
  }, [user]);

  async function shareToTareeq() {
    if (posting || posted) return;
    setPosting(true);
    setPostError('');
    // The permalink is what makes this a share rather than a copy — the feed renders it as
    // a link preview back to the original.
    const body = [note.trim(), quote ? `«${quote}»` : '', postUrl].filter(Boolean).join('\n\n');
    try {
      const res = await fetch('/api/tareeq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: body }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setPosted(true);
        onShared?.();
        // Neither caller passes onShared, and both sit inside a feed that would otherwise
        // not show the share until a reload. TareeqClient already listens for this event
        // (the offline queue uses it), so fire it unconditionally.
        window.dispatchEvent(new Event('tareeq-refresh-feed'));
        setTimeout(() => { if (!closedRef.current) onClose(); }, 900);
      } else {
        setPostError(d.error || (isRtl ? 'تعذّرت المشاركة، حاول مرة أخرى' : 'Couldn’t share — try again'));
      }
    } catch {
      setPostError(isRtl ? 'خطأ في الاتصال' : 'Connection error');
    } finally {
      if (!closedRef.current) setPosting(false);
    }
  }

  async function sendToConversation(convId: string) {
    if (sendingTo || sentTo.has(convId)) return;
    setSendingTo(convId);
    setSendError('');
    try {
      const res = await fetch(`/api/tareeq/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: note.trim(),
          sharedPostId: post.id,
          sharedPostTitle: post.title ?? null,
          sharedPostImageUrl: post.imageUrl ?? null,
        }),
      });
      if (res.ok) {
        setSentTo(prev => new Set(prev).add(convId));
      } else {
        // Blocked (403) and the 30-per-10-min limit (429) both land here. Swallowing them
        // would leave the avatar looking untouched with no explanation, and the user
        // tapping it again forever.
        const d = await res.json().catch(() => ({}));
        setSendError(d.error || (isRtl ? 'تعذّر الإرسال' : 'Couldn’t send'));
      }
    } catch {
      setSendError(isRtl ? 'خطأ في الاتصال' : 'Connection error');
    }
    finally { if (!closedRef.current) setSendingTo(null); }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(postUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => { if (!closedRef.current) setCopied(false); }, 2000);
  }

  function openPopup(url: string, name: string) {
    const w = 580, h = 520;
    const left = Math.max(0, (screen.width - w) / 2);
    const top = Math.max(0, (screen.height - h) / 2);
    window.open(url, name, `noopener,width=${w},height=${h},top=${top},left=${left},toolbar=0,menubar=0,location=0,status=0,scrollbars=1`);
  }

  async function nativeShare() {
    if (!('share' in navigator)) return;
    await navigator.share({
      title: post.title || (isRtl ? 'علامة على طريق' : 'A mark on Tareeq'),
      text: quote,
      url: postUrl,
    }).catch(() => { /* cancelled */ });
  }

  const enc = encodeURIComponent;
  const targets: { key: string; label: string; bg: string; glyph: React.ReactNode; onClick: () => void }[] = [
    {
      key: 'copy',
      label: copied ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ الرابط' : 'Copy link'),
      bg: 'var(--tr-overlay)',
      glyph: (
        <svg width={20} height={20} fill="none" stroke="var(--tr-text-primary)" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      ),
      onClick: copyLink,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      bg: '#25D366',
      glyph: <span style={{ fontSize: 18 }}>💬</span>,
      onClick: () => openPopup(`https://api.whatsapp.com/send?text=${enc(quote)}%20${enc(postUrl)}`, 'wa-share'),
    },
    {
      key: 'telegram',
      label: 'Telegram',
      bg: '#4aaed9',
      glyph: <span style={{ fontSize: 18 }}>✈️</span>,
      onClick: () => openPopup(`https://t.me/share/url?url=${enc(postUrl)}&text=${enc(quote)}`, 'tg-share'),
    },
    {
      key: 'facebook',
      label: 'Facebook',
      bg: '#1877f2',
      glyph: <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, fontFamily: 'Georgia, serif' }}>f</span>,
      onClick: () => openPopup(`https://www.facebook.com/sharer/sharer.php?u=${enc(postUrl)}`, 'fb-share'),
    },
    {
      key: 'x',
      label: 'X',
      bg: '#000',
      glyph: <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>𝕏</span>,
      onClick: () => openPopup(`https://twitter.com/intent/tweet?text=${enc(quote)}&url=${enc(postUrl)}`, 'tw-share'),
    },
  ];
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    targets.push({
      key: 'native',
      label: isRtl ? 'المزيد' : 'More',
      bg: 'var(--tr-overlay)',
      glyph: (
        <svg width={20} height={20} fill="none" stroke="var(--tr-text-primary)" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
        </svg>
      ),
      onClick: nativeShare,
    });
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isRtl ? 'مشاركة' : 'Share'}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-y-auto"
        style={{
          background: 'var(--tr-surface)',
          maxHeight: '88vh',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 sticky top-0"
          style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}
        >
          <h2 className="text-base font-black" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'مشاركة' : 'Share'}
          </h2>
          <button
            onClick={onClose}
            aria-label={isRtl ? 'إغلاق' : 'Close'}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: 'none', cursor: 'pointer' }}
          >
            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Share onto Tareeq — the primary action */}
        {user ? (
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center gap-2.5 mb-2.5">
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                    style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}
                  >
                    {user.name?.charAt(0) ?? '؟'}
                  </div>
                )}
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--tr-text-primary)' }}>{user.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>
                  {isRtl ? 'مشاركة على طريق' : 'Share on Tareeq'}
                </p>
              </div>
            </div>

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={isRtl ? 'اكتب شيئاً عن هذا...' : 'Say something about this...'}
              className="w-full rounded-2xl px-3.5 py-2.5 text-sm resize-none focus:outline-none"
              style={{
                background: 'var(--tr-overlay)',
                border: '1px solid var(--tr-border-soft)',
                color: 'var(--tr-text-primary)',
              }}
            />

            {quote && (
              <p
                className="mt-2 text-[11px] leading-relaxed px-3 py-2 rounded-xl"
                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}
              >
                «{quote}»
              </p>
            )}

            {postError && <p className="mt-2 text-[11px] font-semibold" style={{ color: '#ef4444' }}>{postError}</p>}

            <button
              onClick={shareToTareeq}
              disabled={posting || posted}
              className="mt-3 w-full py-2.5 rounded-2xl text-sm font-black transition active:scale-[0.98]"
              style={{
                background: posted ? 'var(--tr-teal, #10b981)' : 'var(--tr-gold)',
                color: '#0a0d06',
                border: 'none',
                cursor: posting || posted ? 'default' : 'pointer',
                opacity: posting ? 0.65 : 1,
              }}
            >
              {posted
                ? (isRtl ? '✓ تمت المشاركة' : '✓ Shared')
                : posting
                  ? (isRtl ? 'جاري المشاركة...' : 'Sharing...')
                  : (isRtl ? 'شارك الآن' : 'Share now')}
            </button>
          </div>
        ) : (
          <div className="px-5 pt-4 pb-1">
            <p className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl
                ? 'سجّل الدخول لمشاركتها على طريق أو إرسالها لأحد.'
                : 'Sign in to share this on Tareeq or send it to someone.'}
            </p>
          </div>
        )}

        {/* Send in messages */}
        {user && (
          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
            <p className="text-[11px] font-black uppercase tracking-widest mb-2.5" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'إرسال في الرسائل' : 'Send in messages'}
            </p>
            {convosLoading ? (
              <div className="flex gap-3">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-12 h-12 rounded-full animate-pulse" style={{ background: 'var(--tr-overlay)' }} />
                ))}
              </div>
            ) : convos.length === 0 ? (
              <p className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'لا محادثات بعد — ابدأ محادثة من صفحة أي عضو.' : 'No conversations yet — start one from any profile.'}
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                {convos.slice(0, 20).map(c => {
                  const sent = sentTo.has(c.id);
                  const busy = sendingTo === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => sendToConversation(c.id)}
                      disabled={busy || sent}
                      className="flex flex-col items-center gap-1 shrink-0 transition active:scale-90"
                      style={{ background: 'none', border: 'none', cursor: sent ? 'default' : 'pointer', width: 60 }}
                    >
                      <span className="relative">
                        {c.otherUser.avatarUrl
                          ? <img src={c.otherUser.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" style={{ opacity: sent ? 0.5 : 1 }} />
                          : (
                            <span
                              className="w-12 h-12 rounded-full flex items-center justify-center text-base font-black"
                              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', opacity: sent ? 0.5 : 1 }}
                            >
                              {c.otherUser.name.charAt(0)}
                            </span>
                          )}
                        {(sent || busy) && (
                          <span
                            className="absolute inset-0 rounded-full flex items-center justify-center text-sm font-black"
                            style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
                          >
                            {busy ? '…' : '✓'}
                          </span>
                        )}
                      </span>
                      <span
                        className="text-[10px] font-semibold text-center leading-tight"
                        style={{
                          color: 'var(--tr-text-secondary)',
                          maxWidth: 58,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.otherUser.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {sendError && <p className="mt-2 text-[11px] font-semibold" style={{ color: '#ef4444' }}>{sendError}</p>}
          </div>
        )}

        {/* Share elsewhere */}
        <div className="px-5 py-3 pb-6" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
          <p className="text-[11px] font-black uppercase tracking-widest mb-2.5" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl ? 'مشاركة إلى' : 'Share to'}
          </p>
          <div className="grid grid-cols-4 gap-y-3 gap-x-1">
            {targets.map(t => (
              <button
                key={t.key}
                onClick={t.onClick}
                className="flex flex-col items-center gap-1.5 transition active:scale-90"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: t.bg, border: t.bg === 'var(--tr-overlay)' ? '1px solid var(--tr-border-soft)' : 'none' }}
                >
                  {t.glyph}
                </span>
                <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: 'var(--tr-text-secondary)' }}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
