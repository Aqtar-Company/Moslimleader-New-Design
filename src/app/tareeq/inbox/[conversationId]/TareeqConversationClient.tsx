'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import { TareeqNotificationsProvider, useTareeqNotifications } from '@/context/TareeqNotificationsContext';

interface Message {
  id: string;
  content: string;
  read: boolean;
  createdAt: string;
  senderId: string;
  sender: { id: string; name: string; avatarUrl?: string | null };
}
interface OtherUser { id: string; name: string; avatarUrl?: string | null }

function Inner({ conversationId }: { conversationId: string }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { refresh } = useTareeqNotifications();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Fix 7: initialize to '' not null so empty-conversation guard works correctly
  const latestIdRef = useRef<string>('');

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/tareeq/conversations/${conversationId}`, { credentials: 'include' });
      if (res.status === 403 || res.status === 404) { router.push('/tareeq/inbox'); return; }
      if (res.ok) {
        const d = await res.json();
        const msgs: Message[] = d.messages ?? [];
        setMessages(msgs);
        setOtherUser(d.otherUser ?? null);
        // Always update ref, even on empty array (set to '' to keep guard consistent)
        latestIdRef.current = msgs.length ? msgs[msgs.length - 1].id : '';
        refresh();
      }
    } catch { /* ignore */ } finally {
      if (!silent) setLoading(false);
    }
  }, [conversationId, router, refresh]);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    loadMessages();
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/tareeq/conversations/${conversationId}`, { credentials: 'include' }).catch(() => null);
      if (!res || !res.ok) return;
      const d = await res.json();
      const msgs: Message[] = d.messages ?? [];
      const newLatest = msgs.length ? msgs[msgs.length - 1].id : '';
      if (newLatest !== latestIdRef.current) {
        setMessages(msgs);
        latestIdRef.current = newLatest;
        refresh();
      }
    }, 10_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [user, router, loadMessages, conversationId, refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch(`/api/tareeq/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        // Fix 5: append the returned message instead of a full round-trip reload
        const d = await res.json();
        if (d.message) {
          setMessages(prev => {
            const updated = [...prev, d.message as Message];
            latestIdRef.current = d.message.id;
            return updated;
          });
        }
        setInput('');
        refresh();
      } else {
        // Fix 2: surface HTTP errors to the user
        const d = await res.json().catch(() => ({}));
        setSendError(d.error || (isRtl ? 'فشل الإرسال' : 'Send failed'));
      }
    } catch {
      setSendError(isRtl ? 'خطأ في الشبكة' : 'Network error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--tr-base)' }}>
      <TareeqHeader onCreateClick={() => {}} />

      {/* Chat header — below floating TareeqHeader */}
      <div
        className="px-4 py-3 flex items-center gap-3 sticky z-30"
        style={{
          top: '4.5rem',
          background: 'rgba(250,248,244,0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--tr-border-subtle)',
        }}
      >
        <button
          onClick={() => router.push('/tareeq/inbox')}
          className="transition"
          style={{ color: 'var(--tr-text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tr-gold)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-muted)'; }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>
        {otherUser && (
          <>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1px solid var(--tr-border-soft)' }}
            >
              {otherUser.avatarUrl
                ? <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-full h-full rounded-full object-cover" />
                : otherUser.name.charAt(0)
              }
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--tr-text-primary)' }}>{otherUser.name}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-3 max-w-2xl w-full mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl ? 'ابدأ المحادثة' : 'Start the conversation'}
          </div>
        ) : (
          messages.map(m => {
            const mine = m.senderId === user?.userId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={mine ? {
                    background: 'linear-gradient(135deg, #0f766e, #0d9488)',
                    color: '#ffffff',
                    borderBottomRightRadius: mine && !isRtl ? 4 : undefined,
                    borderBottomLeftRadius: mine && isRtl ? 4 : undefined,
                  } : {
                    background: 'var(--tr-raised)',
                    color: 'var(--tr-text-primary)',
                    border: '1px solid var(--tr-border-soft)',
                    borderBottomLeftRadius: !mine && !isRtl ? 4 : undefined,
                    borderBottomRightRadius: !mine && isRtl ? 4 : undefined,
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-3 z-30"
        style={{
          background: 'var(--tr-surface)',
          borderTop: '1px solid var(--tr-border-subtle)',
        }}
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {sendError && (
            <p className="text-xs text-center font-semibold" style={{ color: '#f43f5e' }}>{sendError}</p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); if (sendError) setSendError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isRtl ? 'اكتب رسالتك...' : 'Type a message...'}
              rows={1}
              className="flex-1 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none transition"
              style={{
                background: 'var(--tr-overlay)',
                border: '1px solid var(--tr-border-soft)',
                color: 'var(--tr-text-primary)',
                maxHeight: '120px',
                overflowY: 'auto',
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="rounded-full w-10 h-10 flex items-center justify-center shrink-0 transition disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))',
                color: '#0a0d06',
              }}
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M11 5l-7 7 7 7M4 12h16' : 'M13 5l7 7-7 7M20 12H4'} />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TareeqConversationClient({ conversationId }: { conversationId: string }) {
  return (
    <TareeqNotificationsProvider>
      <Inner conversationId={conversationId} />
    </TareeqNotificationsProvider>
  );
}
