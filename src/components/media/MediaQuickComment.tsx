'use client';
import { useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import Icon from './Icon';
import { useKeepAboveKeyboard } from './useKeyboard';

/**
 * The comment box ON the media box, the way a post in a feed has its «اكتب تعليقاً…» line
 * right under the picture — not at the end of the page, where nobody scrolls to. One line,
 * Enter sends. The full list stays in «شاركنا رأيك» below; a comment written here is handed
 * to it (NEW_COMMENT_EVENT), which also moves every counter.
 */
export const NEW_COMMENT_EVENT = 'ml-media-comment-new';
export type NewCommentDetail = {
  id: number;
  comment: { id: string; content: string; createdAt: string; user: { id: string; name: string } };
};

export default function MediaQuickComment({ mediaId, isEn, tone = 'dark' }: {
  mediaId: number;
  isEn: boolean;
  tone?: 'dark' | 'light';
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [posted, setPosted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useKeepAboveKeyboard(formRef);
  const t = (ar: string, en: string) => (isEn ? en : ar);
  const dark = tone === 'dark';

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/media/${mediaId}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(15_000),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.comment) { addToast(d.error || t('تعذّر نشر التعليق', 'Could not post'), 'error'); return; }
      setText('');
      setPosted(true);
      setTimeout(() => setPosted(false), 3500);
      window.dispatchEvent(new CustomEvent<NewCommentDetail>(NEW_COMMENT_EVENT, { detail: { id: mediaId, comment: d.comment } }));
    } catch {
      addToast(t('لا يوجد اتصال — حاول مرة أخرى', 'No connection — try again'), 'error');
    } finally { setSending(false); }
  };

  const showList = () => document.getElementById(`engage-${mediaId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!user) {
    return (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`; }}
        className={`w-full h-10 rounded-full px-4 text-sm text-start inline-flex items-center gap-2 transition ${dark ? 'bg-white/10 border border-white/20 text-white/70 hover:bg-white/15' : 'bg-[#FAF8F3] border border-gray-200 text-gray-500 hover:bg-white'}`}
      >
        <Icon name="comment" size={16} />
        {t('سجّل الدخول لتكتب تعليقاً', 'Sign in to comment')}
      </button>
    );
  }

  return (
    <form ref={formRef} onSubmit={send} onClick={e => e.stopPropagation()} className="flex items-center gap-2" dir={isEn ? 'ltr' : 'rtl'}>
      <span
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${dark ? 'bg-[#F5C518] text-[#1a1a2e]' : 'bg-[#1a1a2e] text-[#F5C518]'}`}
        aria-hidden
      >
        {(user.name ?? '').trim().charAt(0) || '·'}
      </span>
      <label htmlFor={`mq-${mediaId}`} className="sr-only">{t('اكتب تعليقاً', 'Write a comment')}</label>
      <input
        id={`mq-${mediaId}`}
        value={text}
        onChange={e => setText(e.target.value.slice(0, 500))}
        enterKeyHint="send"
        autoComplete="off"
        placeholder={posted ? t('نُشر تعليقك — اكتب غيره…', 'Posted — write another…') : t('اكتب تعليقاً…', 'Write a comment…')}
        className={`flex-1 min-w-0 h-10 rounded-full px-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[#F5C518] ${dark ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/55 focus:bg-white/15' : 'bg-[#FAF8F3] border border-gray-200 text-[#1a1a2e] placeholder:text-gray-400 focus:bg-white'}`}
      />
      {posted && !text ? (
        <button type="button" onClick={showList} className={`shrink-0 h-10 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1 ${dark ? 'text-[#F5C518]' : 'text-[#1a1a2e]'}`}>
          <Icon name="check" size={15} /> {t('عرض', 'View')}
        </button>
      ) : (
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label={t('نشر التعليق', 'Post comment')}
          className="shrink-0 w-10 h-10 rounded-full bg-[#F5C518] text-[#1a1a2e] flex items-center justify-center transition disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518]"
        >
          {sending ? <Icon name="loader" size={17} spin /> : <Icon name="send" size={17}/>}
        </button>
      )}
    </form>
  );
}
