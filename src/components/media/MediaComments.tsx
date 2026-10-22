'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import Icon from './Icon';

/**
 * Comments on a media item: newest first, «تحميل المزيد», a box to write in, and delete for
 * the writer and for staff. Reading is open; writing needs an account.
 *
 * Names are first names and there are no photos — see `PublicComment` in
 * free-media-social.ts for why.
 */
type C = { id: number; content: string; createdAt: string; user: { id: string; name: string } };

function ago(iso: string, isEn: boolean): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const units: [number, string, string][] = [[31536000, 'سنة', 'y'], [2592000, 'شهر', 'mo'], [86400, 'يوم', 'd'], [3600, 'ساعة', 'h'], [60, 'دقيقة', 'm']];
  for (const [n, ar, en] of units) if (s >= n) { const v = Math.floor(s / n); return isEn ? `${v}${en} ago` : `منذ ${v} ${ar}`; }
  return isEn ? 'just now' : 'الآن';
}

export default function MediaComments({ mediaId, isEn, tone = 'light', onCount, autoFocus = false }: {
  mediaId: number;
  isEn: boolean;
  tone?: 'light' | 'dark';
  /** Called with +1 / -1 as comments are added or removed, so a counter elsewhere can follow. */
  onCount?: (delta: number) => void;
  autoFocus?: boolean;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [list, setList] = useState<C[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const staff = !!user && ((user as { role?: string }).role === 'admin' || (user as { role?: string }).role === 'staff');
  const t = (ar: string, en: string) => (isEn ? en : ar);

  const load = useCallback(async (before?: number) => {
    setLoading(true); setFailed(false);
    try {
      const res = await fetch(`/api/media/${mediaId}/comments${before ? `?before=${before}` : ''}`, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setList(prev => (before ? [...prev, ...d.comments] : d.comments));
      setNextBefore(d.nextBefore);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [mediaId]);

  useEffect(() => { setList([]); void load(); }, [load]);
  useEffect(() => { if (autoFocus && user) inputRef.current?.focus(); }, [autoFocus, user]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/media/${mediaId}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { addToast(d.error || t('تعذّر نشر التعليق', 'Could not post'), 'error'); return; }
      setList(prev => [d.comment, ...prev]);
      setText('');
      onCount?.(1);
    } catch { addToast(t('لا يوجد اتصال', 'No connection'), 'error'); }
    finally { setSending(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(t('حذف التعليق؟', 'Delete this comment?'))) return;
    const prev = list;
    setList(l => l.filter(c => c.id !== id));
    onCount?.(-1);
    const res = await fetch(`/api/media/comments/${id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) { setList(prev); onCount?.(1); addToast(t('تعذّر الحذف', 'Could not delete'), 'error'); }
  };

  const dark = tone === 'dark';
  const muted = dark ? 'text-white/55' : 'text-gray-500';
  const strong = dark ? 'text-white' : 'text-[#1a1a2e]';

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Writer */}
      {user ? (
        <div className={`flex items-end gap-2 pb-3 mb-1 border-b ${dark ? 'border-white/10' : 'border-gray-100'}`}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value.slice(0, 1000))}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            rows={1}
            placeholder={t('اكتب تعليقاً…', 'Write a comment…')}
            className={`flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none max-h-32 focus-visible:ring-2 focus-visible:ring-[#F5C518] ${dark ? 'bg-white/10 text-white placeholder:text-white/40' : 'bg-[#FAF8F3] border border-gray-200 text-[#1a1a2e]'}`}
            style={{ overflowWrap: 'anywhere' }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!text.trim() || sending}
            aria-label={t('إرسال', 'Send')}
            className="shrink-0 w-10 h-10 rounded-full bg-[#F5C518] text-[#1a1a2e] flex items-center justify-center disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518]"
          >
            {sending ? <Icon name="loader" size={18} spin /> : <Icon name="send" size={18} />}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)}
          className={`mb-3 w-full text-sm font-bold rounded-2xl px-4 py-3 border border-dashed ${dark ? 'border-white/25 text-white/85' : 'border-gray-300 text-[#1a1a2e] hover:bg-[#FAF8F3]'}`}
        >
          {t('سجّل الدخول لتكتب تعليقاً', 'Sign in to comment')}
        </button>
      )}

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {list.length === 0 && !loading && !failed && (
          <p className={`text-sm py-6 text-center ${muted}`}>{t('لا تعليقات بعد — كن أول من يعلّق', 'No comments yet — be the first')}</p>
        )}
        <ul className="flex flex-col">
          {list.map(c => (
            <li key={c.id} className={`flex gap-3 py-3 border-b last:border-0 ${dark ? 'border-white/10' : 'border-gray-100'}`}>
              <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${dark ? 'bg-white/15 text-[#F5C518]' : 'bg-[#1a1a2e] text-[#F5C518]'}`} aria-hidden>
                {c.user.name.charAt(0)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs">
                  <span className={`font-bold ${strong}`}>{c.user.name}</span>
                  <span className={`ms-2 ${muted}`}>{ago(c.createdAt, isEn)}</span>
                </p>
                <p className={`text-sm leading-6 mt-0.5 whitespace-pre-line ${dark ? 'text-white/90' : 'text-gray-700'}`} style={{ overflowWrap: 'anywhere' }}>{c.content}</p>
              </div>
              {user && (user.id === c.user.id || staff) && (
                <button type="button" onClick={() => void remove(c.id)} aria-label={t('حذف', 'Delete')} title={t('حذف', 'Delete')}
                  className={`shrink-0 self-start p-1.5 rounded-full ${dark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-red-600'}`}>
                  <Icon name="trash" size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {loading && <p className={`py-4 flex justify-center ${muted}`}><Icon name="loader" size={20} spin /></p>}
        {failed && (
          <p className={`py-4 text-center text-sm ${muted}`}>
            {t('تعذّر تحميل التعليقات.', 'Could not load comments.')}{' '}
            <button type="button" onClick={() => void load()} className="font-bold underline">{t('إعادة', 'Retry')}</button>
          </p>
        )}
        {nextBefore && !loading && (
          <button type="button" onClick={() => void load(nextBefore)} className={`w-full py-3 text-sm font-bold ${dark ? 'text-[#F5C518]' : 'text-[#1a1a2e]'}`}>
            {t('تحميل المزيد', 'Load more')}
          </button>
        )}
      </div>
    </div>
  );
}
