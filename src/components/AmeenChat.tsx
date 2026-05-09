'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';

// On-site AI chat — talks to /api/ameen-chat which uses the SAME
// settings/prompt/knowledge/lead-classification as the Facebook
// assistant. The wizard version (gender → age → results) was
// replaced by a free-text chat now that the AI can ask the right
// questions itself.

interface ChatMessage {
  id: string;
  from: 'ameen' | 'user';
  text: string;
  /** Timestamp for ordering / display. */
  at: number;
  /** Lead status returned by the API on outgoing replies. */
  leadStatus?: 'hot' | 'warm' | 'cold' | null;
}

interface ChatResponse {
  ok: boolean;
  reply?: string;
  leadStatus?: 'hot' | 'warm' | 'cold' | null;
  offline?: boolean;
  skipped?: boolean;
  error?: boolean;
}

const SESSION_KEY = 'ameen-chat-session';
const HISTORY_KEY = 'ameen-chat-history';
const HISTORY_LIMIT = 60; // cap localStorage size

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function loadHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-HISTORY_LIMIT);
  } catch { return []; }
}

function saveHistory(history: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(-HISTORY_LIMIT)),
    );
  } catch { /* quota exceeded etc — non-fatal */ }
}

// Convert plaintext URLs in the AI's reply into clickable links so
// product recommendations actually click through. Also linkifies
// bare moslimleader.com URLs the model emits.
function linkify(text: string): React.ReactNode {
  // Match http(s) URLs OR bare moslimleader.com paths.
  const re = /\b(https?:\/\/[^\s)]+|moslimleader\.com\/[^\s)]+)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];
    const href = raw.startsWith('http') ? raw : `https://${raw}`;
    parts.push(
      <a
        key={`l-${i++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#F5C518] underline underline-offset-2 hover:text-amber-300 break-all"
      >
        {raw.replace(/^https?:\/\//, '')}
      </a>,
    );
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function AminAvatar({ size = 48 }: { size?: number }) {
  return (
    <img
      src="/amin-profile.png"
      alt="أمين"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover' }}
    />
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

export default function AmeenChat() {
  const [open, setOpen] = useState(false);
  const [showBadge, setShowBadge] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { lang } = useLang();
  const isEn = lang === 'en';

  // ── Session + history bootstrap ──
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    const restored = loadHistory();
    if (restored.length > 0) {
      setMessages(restored);
    } else {
      // First-visit greeting — same shape as the FB assistant's
      // opener. Asks the qualifying question that drives the SPIN
      // flow on the server side.
      setMessages([{
        id: `welcome-${Date.now()}`,
        from: 'ameen',
        at: Date.now(),
        text: isEn
          ? 'Hi! I\'m Amin, your guide at Moslim Leader 🌟\nHow many kids do you have, and how old are they? I\'ll suggest the perfect picks.'
          : 'أهلاً بكِ في مسلم ليدر 🌟 أنا أمين، مرشدتك في المتجر.\nعندك كم طفل وأعمارهم كام؟ هرشّحلك المناسب لكل واحد فيهم.',
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change.
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  // Auto-scroll on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Auto-grow textarea.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // First-visit "👋" badge auto-opens after 8 seconds.
  useEffect(() => {
    const t = setTimeout(() => setShowBadge(false), 8000);
    return () => clearTimeout(t);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !sessionId) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      from: 'user',
      text,
      at: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/ameen-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json() as ChatResponse;
      const reply = (data.reply ?? '').trim();
      if (reply) {
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          from: 'ameen',
          text: reply,
          at: Date.now(),
          leadStatus: data.leadStatus ?? null,
        }]);
      } else if (!res.ok) {
        setMessages(prev => [...prev, {
          id: `e-${Date.now()}`,
          from: 'ameen',
          text: isEn
            ? 'Sorry, something went wrong. Please try again.'
            : 'عذراً، حصل خطأ. حاولي مرة أخرى.',
          at: Date.now(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        from: 'ameen',
        text: isEn
          ? 'Connection issue. Please try again.'
          : 'مشكلة في الاتصال. حاولي مرة أخرى.',
        at: Date.now(),
      }]);
    }
    setSending(false);
    inputRef.current?.focus();
  }, [input, sending, sessionId, isEn]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const reset = () => {
    if (!confirm(isEn ? 'Start a new conversation?' : 'بدء محادثة جديدة؟')) return;
    try {
      localStorage.removeItem(HISTORY_KEY);
      // Keep the same sessionId so the admin can still see the
      // full thread; just clear the local history view.
    } catch {/* ignore */}
    setMessages([{
      id: `welcome-${Date.now()}`,
      from: 'ameen',
      at: Date.now(),
      text: isEn
        ? 'Fresh start! How many kids do you have and what are their ages?'
        : 'بداية جديدة! عندك كم طفل وأعمارهم كام؟',
    }]);
  };

  // ── Rendering ──
  return (
    <>
      {/* Floating launcher — pinned to the right side of the viewport
          regardless of locale direction so it doesn't collide with
          WhatsApp/other floats on the left. */}
      <button
        onClick={() => { setOpen(o => !o); setShowBadge(false); }}
        aria-label={isEn ? 'Open Ameen chat' : 'افتح دردشة أمين'}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#1a1a2e] hover:bg-[#2d1060] text-white shadow-lg flex items-center justify-center transition print:hidden"
        style={{ boxShadow: '0 6px 24px rgba(26,26,46,0.4)' }}
      >
        {open ? (
          <span className="text-2xl">✕</span>
        ) : (
          <AminAvatar size={48} />
        )}
        {showBadge && !open && (
          <span className="absolute -top-1 -left-1 bg-[#F5C518] text-[#1a1a2e] text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
            👋
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          dir={isEn ? 'ltr' : 'rtl'}
          className="fixed bottom-24 right-5 z-40 w-[92vw] max-w-sm h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden print:hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-l from-[#1a1a2e] via-[#2d1060] to-[#1a1a2e] text-white px-4 py-3 flex items-center gap-3">
            <AminAvatar size={36} />
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm">
                {isEn ? 'Amin · Moslim Leader Guide' : 'أمين · مرشد مسلم ليدر'}
              </p>
              <p className="text-[10px] text-white/70 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {isEn ? 'Online — replies usually within seconds' : 'متاح — الرد عادة خلال ثواني'}
              </p>
            </div>
            <button
              onClick={reset}
              title={isEn ? 'New conversation' : 'محادثة جديدة'}
              className="text-white/70 hover:text-white text-[11px] font-bold px-2 py-1 rounded hover:bg-white/10"
            >
              ↻
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label={isEn ? 'Close' : 'إغلاق'}
              className="text-white/70 hover:text-white text-lg w-7 h-7 flex items-center justify-center rounded hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          {/* Messages — force LTR row layout so the user's bubble always
              sits on the visual RIGHT and the assistant's on the LEFT,
              regardless of the locale's text direction. The bubble's
              own dir/text-align follows the page direction. */}
          <div className="flex-1 overflow-y-auto p-3 bg-gradient-to-b from-gray-50 to-gray-100 space-y-2.5">
            {messages.map((m, idx) => {
              const isUser = m.from === 'user';
              const prev = messages[idx - 1];
              const isFirstOfRun = !prev || prev.from !== m.from;
              return (
                <div key={m.id} dir="ltr" className={`flex items-end gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className={`shrink-0 ${isFirstOfRun ? 'opacity-100' : 'opacity-0'}`}>
                      <AminAvatar size={26} />
                    </div>
                  )}
                  <div
                    dir={isEn ? 'ltr' : 'rtl'}
                    className={`max-w-[78%] px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                      isUser
                        ? 'bg-gradient-to-br from-[#F5C518] to-[#e0b015] text-[#1a1a2e] font-bold rounded-2xl rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-900 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {linkify(m.text)}
                  </div>
                </div>
              );
            })}
            {sending && (
              <div dir="ltr" className="flex items-end gap-1.5 justify-start">
                <div className="shrink-0"><AminAvatar size={26} /></div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={isEn ? 'Type your message…' : 'اكتب رسالتك…'}
                rows={1}
                disabled={sending}
                className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a1a2e] disabled:opacity-50"
                style={{ minHeight: 38, maxHeight: 120 }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="shrink-0 w-10 h-10 rounded-full bg-[#1a1a2e] hover:bg-[#2d1060] text-white flex items-center justify-center transition disabled:opacity-40"
                aria-label={isEn ? 'Send' : 'إرسال'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={isEn ? 'M14 5l7 7m0 0l-7 7m7-7H3' : 'M10 19l-7-7m0 0l7-7m-7 7h18'} />
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-gray-400 text-center mt-1.5">
              {isEn
                ? 'Powered by AI · responses guided by your store catalogue'
                : 'مدعوم بالذكاء الاصطناعي · يستند إلى كتالوج المتجر'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
