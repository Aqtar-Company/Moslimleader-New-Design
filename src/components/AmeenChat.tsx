'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import AmeenProductCard from './AmeenProductCard';

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
  /** True when this user bubble was a voice message that the
   *  server transcribed — UI shows a 🎤 prefix so the history
   *  makes the channel switch obvious. */
  transcribed?: boolean;
}

interface ChatResponse {
  ok: boolean;
  reply?: string;
  leadStatus?: 'hot' | 'warm' | 'cold' | null;
  offline?: boolean;
  skipped?: boolean;
  error?: boolean;
  transcript?: string;
  error_message?: string;
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
// product recommendations actually click through. Handles three
// forms: markdown `[text](url)`, bare https URLs, and bare
// moslimleader.com paths.
function linkify(text: string): React.ReactNode {
  // Order matters: markdown first (greedy), then bare URLs.
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|moslimleader\.com\/[^\s)]+)\)|\b(https?:\/\/[^\s)]+|moslimleader\.com\/[^\s)]+)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const isMd = !!m[1];
    const label = isMd ? m[1] : (m[3] ?? '').replace(/^https?:\/\//, '');
    const raw   = isMd ? m[2] : m[3] ?? '';
    const href  = raw.startsWith('http') ? raw : `https://${raw}`;
    parts.push(
      <a
        key={`l-${i++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#1a1a2e] underline underline-offset-2 hover:text-[#2d1060] break-all font-bold"
      >
        {label}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Extract product slugs from the AI reply so we can render an inline
// card for each recommendation. Matches:
//   moslimleader.com/shop/{slug}      → physical product
// Books and series get a link-only fallback for now (their card UI
// would need their own fetch path; future work).
function extractProductSlugs(text: string): string[] {
  const slugs = new Set<string>();
  const re = /moslimleader\.com\/shop\/([a-z0-9-]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const slug = m[1].replace(/[)\].,;:!?]+$/, '');
    if (slug) slugs.add(slug);
  }
  return Array.from(slugs);
}

function AminAvatar({ size = 48 }: { size?: number }) {
  // Hints: eager + high priority so the browser keeps it warm in cache
  // across navigations; decoding=async so the small render doesn't
  // block paint while the 900K source decodes the first time. The
  // long-cache header in next.config.mjs is the other half of the
  // story — combined, the file is fetched once and reused for a year.
  return (
    <img
      src="/amin-profile.png"
      alt="أمين"
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      fetchPriority="high"
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
  // Visual-viewport height for the mobile panel. Updated on
  // visualViewport.resize so the keyboard pushes the input above
  // itself instead of off-screen. Null on desktop / SSR.
  const [vh, setVh] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordCapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { lang } = useLang();
  const isEn = lang === 'en';

  // ── visualViewport: track keyboard height on mobile only ──
  // The Tailwind `md` breakpoint is 768px. On wider screens the
  // chat is a floating bubble with a fixed height, so we don't
  // need the visual-viewport binding (and applying it would clip
  // the panel to a strange height when DevTools opens).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      setVh(window.innerWidth < 768 ? vv.height : null);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

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

  // Auto-scroll on new messages, on send, AND when the keyboard
  // changes the viewport height. Two RAFs let the textarea/keyboard
  // finish their layout pass before we scroll, so the last bubble
  // doesn't end up hidden behind the keyboard.
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, sending, vh, scrollToBottom]);

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

  // ── Voice input (Gemini STT) ──
  // Records via MediaRecorder, uploads as multipart/form-data, the
  // route transcribes via Gemini and the transcribed text flows
  // through the regular reply pipeline (no special handling).
  const sendVoice = useCallback(async (blob: Blob) => {
    if (!sessionId) return;
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append('sessionId', sessionId);
      form.append('audio', blob, 'voice.webm');
      const res = await fetch('/api/ameen-chat', { method: 'POST', body: form });
      const data = await res.json() as ChatResponse & { error?: string | boolean };
      if (!res.ok || !data.transcript) {
        setMessages(prev => [...prev, {
          id: `e-${Date.now()}`,
          from: 'ameen',
          at: Date.now(),
          text: typeof data?.error === 'string'
            ? data.error
            : (isEn
                ? 'Voice transcription failed. Please type your message.'
                : 'تعذّر تحويل الرسالة الصوتية. اكتبيها نصّاً من فضلك.'),
        }]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `u-${Date.now()}`,
            from: 'user',
            text: data.transcript!,
            at: Date.now(),
            transcribed: true,
          },
          {
            id: `a-${Date.now() + 1}`,
            from: 'ameen',
            text: (data.reply ?? '').trim(),
            at: Date.now() + 1,
            leadStatus: data.leadStatus ?? null,
          },
        ]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        from: 'ameen',
        at: Date.now(),
        text: isEn ? 'Connection issue. Please try again.' : 'مشكلة في الاتصال. حاولي مرة أخرى.',
      }]);
    }
    setTranscribing(false);
  }, [sessionId, isEn]);

  const stopRecording = useCallback(() => {
    const mr = recorderRef.current;
    if (mr && mr.state === 'recording') mr.stop();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (recordCapRef.current) clearTimeout(recordCapRef.current);
    recordTimerRef.current = null;
    recordCapRef.current = null;
    setRecording(false);
    setRecordSecs(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (sending || transcribing) return;
    if (typeof window === 'undefined' || !navigator.mediaDevices || !window.MediaRecorder) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        if (blob.size > 0) void sendVoice(blob);
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
      // 60-second hard cap.
      recordCapRef.current = setTimeout(() => { if (mr.state === 'recording') stopRecording(); }, 60_000);
    } catch {
      // Permission denied or no mic — show a single feedback bubble
      // and let the textarea remain available.
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        from: 'ameen',
        at: Date.now(),
        text: isEn
          ? 'Microphone is not available. Please type your message.'
          : 'الميكروفون غير متاح. اكتبي رسالتك من فضلك.',
      }]);
    }
  }, [sending, transcribing, isEn, sendVoice, stopRecording]);

  // Broadcast open/close so siblings (e.g. WhatsAppButton) can hide
  // themselves on mobile while the chat is fullscreen. Body data
  // attribute is the simplest cross-component channel — no shared
  // context needed, no prop drilling, works for any future float.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) document.body.setAttribute('data-ameen-open', '1');
    else      document.body.removeAttribute('data-ameen-open');
    return () => document.body.removeAttribute('data-ameen-open');
  }, [open]);

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
      {/* Floating launcher — pinned to the right (mirror of the
          WhatsApp button on the left). Bigger than the WhatsApp puck
          so it reads as the primary call-to-action. The yellow
          ping-ring mirrors WhatsApp's green ring so both launchers
          feel like a matched pair. */}
      <button
        onClick={() => { setOpen(o => !o); setShowBadge(false); }}
        aria-label={isEn ? 'Open Ameen chat' : 'افتح دردشة أمين'}
        className="fixed bottom-7 right-5 md:bottom-10 md:right-10 z-40 w-16 h-16 md:w-[72px] md:h-[72px] rounded-full bg-[#1a1a2e] hover:bg-[#2d1060] text-white shadow-lg flex items-center justify-center transition print:hidden"
        style={{ boxShadow: '0 8px 28px rgba(26,26,46,0.45)' }}
      >
        {/* Pulse rings — only visible when the panel is closed so we
            don't compete with the open conversation. */}
        {!open && (
          <>
            <span className="absolute inset-0 rounded-full bg-[#F5C518] animate-ping opacity-30 pointer-events-none" />
            <span className="absolute inset-[-4px] rounded-full border-2 border-[#F5C518] opacity-40 animate-pulse pointer-events-none" />
          </>
        )}
        {open ? (
          <span className="text-2xl relative z-10">✕</span>
        ) : (
          <span className="relative z-10"><AminAvatar size={56} /></span>
        )}
        {showBadge && !open && (
          <span className="absolute -top-1 -left-1 bg-[#F5C518] text-[#1a1a2e] text-[11px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-bounce z-20">
            👋
          </span>
        )}
      </button>

      {/* Chat panel — fullscreen on mobile (so the keyboard pushes
          the input above itself instead of hiding it), floating
          bubble on desktop. The mobile height is bound to
          visualViewport.height so it shrinks with the keyboard. */}
      {open && (
        <div
          dir={isEn ? 'ltr' : 'rtl'}
          className="fixed z-40 bg-white shadow-2xl flex flex-col overflow-hidden print:hidden
                     inset-0 md:inset-auto
                     md:bottom-32 md:right-10 md:w-[92vw] md:max-w-sm
                     md:h-[70vh] md:max-h-[600px] md:rounded-2xl md:border md:border-gray-200"
          style={vh != null ? { height: `${vh}px` } : undefined}
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
                    {/* Tiny 🎤 prefix marks user voice messages so the
                        history makes the channel switch obvious. */}
                    {isUser && m.transcribed && <span className="opacity-70 me-1">🎤</span>}
                    {linkify(m.text)}
                    {/* Inline product cards for any moslimleader.com/shop/{slug}
                        URL the AI included. Pulls live data so price + image
                        + stock match the catalogue. */}
                    {!isUser && extractProductSlugs(m.text).slice(0, 3).map(slug => (
                      <AmeenProductCard key={`${m.id}-${slug}`} slug={slug} />
                    ))}
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

          {/* Input — when recording, the textarea is replaced by a
              live recording indicator with a stop button. The mic
              button itself is hidden on browsers without
              MediaRecorder so users don't see a broken affordance. */}
          <div className="border-t border-gray-200 bg-white p-2.5" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-end gap-2">
              {recording ? (
                <div className="flex-1 flex items-center gap-2 border border-red-300 rounded-xl px-3 py-2 bg-red-50" style={{ minHeight: 38 }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-bold text-red-700 tabular-nums">
                    {`${Math.floor(recordSecs / 60)}:${String(recordSecs % 60).padStart(2, '0')}`}
                  </span>
                  <span className="text-xs text-red-700/80">{isEn ? 'Recording…' : 'جاري التسجيل…'}</span>
                </div>
              ) : transcribing ? (
                <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50" style={{ minHeight: 38 }}>
                  <span className="w-3 h-3 border-2 border-[#1a1a2e] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-600">{isEn ? 'Transcribing…' : 'جاري تحويل الصوت…'}</span>
                </div>
              ) : (
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
              )}
              {/* Mic button — only when MediaRecorder is available. */}
              {typeof window !== 'undefined' && 'MediaRecorder' in window && navigator.mediaDevices && !input.trim() && !transcribing && (
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={sending}
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition disabled:opacity-40 ${
                    recording
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                      : 'bg-gray-100 hover:bg-gray-200 text-[#1a1a2e]'
                  }`}
                  aria-label={recording ? (isEn ? 'Stop recording' : 'إيقاف التسجيل') : (isEn ? 'Record voice message' : 'تسجيل رسالة صوتية')}
                >
                  {recording ? (
                    <span className="w-3 h-3 rounded-sm bg-white" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z"/><path d="M19 11a1 1 0 10-2 0 5 5 0 11-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z"/></svg>
                  )}
                </button>
              )}
              <button
                onClick={send}
                disabled={!input.trim() || sending || recording || transcribing}
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
