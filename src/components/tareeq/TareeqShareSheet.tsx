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
  category?: string | null;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
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
  // The auto-close timer is the one thing closedRef could not save us from: a manual close
  // while it is pending would fire the parent's onClose a second time.
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape, body scroll lock, and focus. `aria-modal` asserts the rest of the page is
  // inert; without moving focus in and trapping it, Tab walked the feed underneath and a
  // screen reader kept reading it.
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, textarea, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      returnTo?.focus?.();
    };
  }, [onClose]);

  useEffect(() => () => {
    closedRef.current = true;
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    if (copiedRef.current) clearTimeout(copiedRef.current);
  }, []);

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
    // Only YOUR words go in the body. The original travels as `sharedFromId`, so the card
    // can render it under its real author's name, avatar and timestamp. Copying its text
    // into the body — which is what this used to do — produced a post that read as if the
    // sharer had written it.
    try {
      const res = await fetch('/api/tareeq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // Carry the original's category: without it the share is categoryless, shows no
        // badge, and is filtered out of every category tab in the feed.
        body: JSON.stringify({
          content: note.trim(),
          sharedFromId: post.id,
          ...(post.category ? { category: post.category } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.flagged) {
        // POST /api/tareeq answers 200 { flagged: true } and creates the post with
        // isHidden — the content filter ran over words that are not even yours, since a
        // share re-submits someone else's text. Claiming "✓ shared" here would be a lie:
        // the post exists and nobody can see it.
        setPostError(isRtl
          ? 'تم إرسال المشاركة للمراجعة — لن تظهر في التسلسل حتى تتم الموافقة عليها.'
          : 'Your share was sent for review — it won’t appear in the feed until it’s approved.');
        return;
      }
      if (res.ok) {
        setPosted(true);
        onShared?.();
        // Neither caller passes onShared, and both sit inside a feed that would otherwise
        // not show the share until a reload. TareeqClient already listens for this event
        // (the offline queue uses it), so fire it unconditionally.
        window.dispatchEvent(new Event('tareeq-refresh-feed'));
        autoCloseRef.current = setTimeout(() => { if (!closedRef.current) onClose(); }, 1400);
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
          // Most posts have no title. Without an excerpt and an author the bubble had
          // nothing to show but a generic "Tareeq post" label.
          sharedPostExcerpt: (post.content ?? '').trim().slice(0, 300) || null,
          sharedPostAuthor: post.authorName ?? null,
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
    if (copiedRef.current) clearTimeout(copiedRef.current);
    copiedRef.current = setTimeout(() => { if (!closedRef.current) setCopied(false); }, 2000);
  }

  function openPopup(url: string, name: string) {
    const w = 580, h = 520;
    const left = Math.max(0, (screen.width - w) / 2);
    const top = Math.max(0, (screen.height - h) / 2);
    // `noopener` goes in windowFeatures, which makes window.open return null even on
    // success — so a null return tells us nothing. Popups are also refused outright inside
    // in-app webviews (the Facebook and Instagram browsers), where this used to do
    // literally nothing: no navigation, no error, no state change. Fall back to a normal
    // navigation attempt so the user always gets somewhere.
    const win = window.open(url, name, `width=${w},height=${h},top=${top},left=${left},toolbar=0,menubar=0,location=0,status=0,scrollbars=1`);
    if (win) { win.opener = null; return; }
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
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
      glyph: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.14c-.25.69-1.44 1.32-1.98 1.37-.53.05-1.02.24-3.44-.72-2.9-1.14-4.74-4.1-4.88-4.29-.14-.19-1.16-1.55-1.16-2.96s.74-2.1 1-2.39c.26-.29.57-.36.76-.36h.54c.18 0 .42-.07.65.5.25.6.83 2.06.9 2.21.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.3.37-.42.5-.14.14-.29.29-.12.57.16.29.73 1.2 1.56 1.95 1.08.96 1.98 1.25 2.27 1.4.28.14.45.12.62-.07.17-.19.71-.83.9-1.12.19-.29.38-.24.64-.14.26.09 1.65.78 1.94.92.28.14.47.21.54.33.07.12.07.69-.18 1.38z" />
        </svg>
      ),
      onClick: () => openPopup(`https://api.whatsapp.com/send?text=${enc(quote)}%20${enc(postUrl)}`, 'wa-share'),
    },
    {
      key: 'telegram',
      label: 'Telegram',
      bg: '#26A5E4',
      // Telegram's own paper plane, on its own brand blue. Two earlier passes used the
      // ✈️ emoji and then a hand-drawn plane; neither looked like the logo.
      glyph: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>
      ),
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
        ref={dialogRef}
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

            {/* Shows what will actually be published: the original, credited to its author. */}
            <div
              className="mt-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                {post.authorAvatarUrl
                  ? <img src={post.authorAvatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                  : (
                    <span
                      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black"
                      style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}
                    >
                      {(post.authorName ?? '؟').charAt(0)}
                    </span>
                  )}
                <span className="text-[11px] font-bold truncate" style={{ color: 'var(--tr-text-primary)' }}>
                  {post.authorName ?? (isRtl ? 'صاحب المنشور' : 'Original author')}
                </span>
              </div>
              {quote && (
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tr-text-muted)' }}>{quote}</p>
              )}
            </div>

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
            {/* The button above is a separate action. Without this line people read the
                avatars as a multi-select feeding "شارك الآن", when a tap sends at once. */}
            <p className="text-[11px] mb-2.5 -mt-1.5" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'اضغط على أي شخص ليُرسَل المنشور له فوراً' : 'Tap someone to send the post to them right away'}
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
                        {busy && (
                          <span
                            className="absolute inset-0 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(0,0,0,0.35)' }}
                          >
                            <span
                              className="w-4 h-4 rounded-full animate-spin"
                              style={{ border: '2px solid rgba(255,255,255,0.5)', borderTopColor: '#fff' }}
                            />
                          </span>
                        )}
                        {sent && (
                          // A solid badge on the rim, not a thin glyph over a grey scrim —
                          // the old tick was almost invisible, so a sent message read as if
                          // nothing had happened.
                          <span
                            className="absolute flex items-center justify-center rounded-full"
                            style={{
                              width: 20, height: 20, bottom: -1, insetInlineEnd: -1,
                              background: '#16a34a', border: '2px solid var(--tr-surface)',
                            }}
                          >
                            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                        )}
                      </span>
                      <span
                        className="text-[10px] font-semibold text-center leading-tight"
                        style={{
                          color: sent ? '#16a34a' : 'var(--tr-text-secondary)',
                          maxWidth: 58,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sent ? (isRtl ? 'تم الإرسال' : 'Sent') : c.otherUser.name}
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
