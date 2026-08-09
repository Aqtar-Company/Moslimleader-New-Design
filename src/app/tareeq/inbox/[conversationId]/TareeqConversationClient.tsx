'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TareeqNotificationsProvider, useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import { compressImage } from '@/lib/compress-image';
import TareeqCallScreen from '@/components/tareeq/TareeqCallScreen';
import TareeqEmojiPicker from '@/components/tareeq/TareeqEmojiPicker';

interface Message {
  id: string;
  content: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  read: boolean;
  createdAt: string;
  senderId: string;
  sender: { id: string; name: string; avatarUrl?: string | null };
}
interface OtherUser { id: string; name: string; avatarUrl?: string | null; tareeqLastSeen?: string | null }

interface CallEvent {
  id: string;
  type: 'audio' | 'video';
  status: 'ended' | 'missed' | 'rejected';
  callerId: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

interface MsgGroup {
  senderId: string;
  mine: boolean;
  msgs: Message[];
  senderInfo: { name: string; avatarUrl?: string | null };
}

type DayItem = MsgGroup | { __isCall: true; call: CallEvent };

// Build timeline by walking all events in time order, grouping consecutive same-sender
// messages, and inserting call events as group-breakers. This ensures call bubbles
// always appear at their correct chronological position.
function buildTimeline(messages: Message[], calls: CallEvent[], myId: string): { time: string; item: DayItem }[] {
  const allEvents: ({ type: 'msg'; msg: Message; t: string } | { type: 'call'; call: CallEvent; t: string })[] = [
    ...messages.map(m => ({ type: 'msg' as const, msg: m, t: m.createdAt })),
    ...calls.map(c => ({ type: 'call' as const, call: c, t: c.createdAt })),
  ];
  allEvents.sort((a, b) => a.t.localeCompare(b.t));

  const items: { time: string; item: DayItem }[] = [];
  let currentGroup: MsgGroup | null = null;

  for (const ev of allEvents) {
    if (ev.type === 'call') {
      if (currentGroup) {
        items.push({ time: currentGroup.msgs[currentGroup.msgs.length - 1].createdAt, item: currentGroup as DayItem });
        currentGroup = null;
      }
      items.push({ time: ev.call.createdAt, item: { __isCall: true, call: ev.call } as DayItem });
    } else {
      const msg = ev.msg;
      if (currentGroup && currentGroup.senderId === msg.senderId) {
        currentGroup.msgs.push(msg);
      } else {
        if (currentGroup) {
          items.push({ time: currentGroup.msgs[currentGroup.msgs.length - 1].createdAt, item: currentGroup as DayItem });
        }
        currentGroup = { senderId: msg.senderId, mine: msg.senderId === myId, msgs: [msg], senderInfo: msg.sender };
      }
    }
  }
  if (currentGroup) {
    items.push({ time: currentGroup.msgs[currentGroup.msgs.length - 1].createdAt, item: currentGroup as DayItem });
  }
  return items;
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
}

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDay(dateStr: string, isRtl: boolean) {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return isRtl ? 'اليوم' : 'Today';
    if (d.toDateString() === yesterday.toDateString()) return isRtl ? 'أمس' : 'Yesterday';
    return d.toLocaleDateString(isRtl ? 'ar' : 'en', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

function isOnline(lastSeen: string | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 3 * 60 * 1000;
}

// WhatsApp-style double tick SVG
function ReadTick({ read }: { read: boolean }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" style={{ display: 'inline', verticalAlign: 'middle', marginInlineStart: 3 }}>
      {/* First tick */}
      <path d="M1 5.5L4.5 9L10 3" stroke={read ? '#34d399' : 'rgba(255,255,255,0.55)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* Second tick (only visible when delivered/read) */}
      <path d="M5 5.5L8.5 9L14 3" stroke={read ? '#34d399' : 'rgba(255,255,255,0.55)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fmtDuration(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

let activeAudioEl: HTMLAudioElement | null = null;

function VoiceMessage({ url, mine }: { url: string; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [curTime, setCurTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Seeded pseudo-random waveform so it looks consistent every render
  const bars = useMemo(() => {
    let h = url.split('').reduce((a, c) => ((a * 31 + c.charCodeAt(0)) | 0), 0x811c9dc5);
    return Array.from({ length: 32 }, () => {
      h ^= h << 13; h ^= h >> 7; h ^= h << 17;
      return 0.15 + (Math.abs(h) % 85) / 100;
    });
  }, [url]);

  useEffect(() => {
    const a = new Audio();
    a.src = url;
    a.preload = 'metadata';
    audioRef.current = a;
    a.onloadedmetadata = () => {
      if (isFinite(a.duration) && a.duration > 0) {
        setDuration(a.duration);
      } else {
        // WebM from MediaRecorder has no duration header — seek to end to discover length
        a.currentTime = 1e10;
      }
    };
    let durationDiscovered = false;
    a.onseeked = () => {
      if (durationDiscovered) return; // prevent loop when we reset currentTime to 0
      if (!isFinite(a.duration) || a.duration <= 0) {
        durationDiscovered = true;
        const discovered = a.currentTime;
        if (discovered > 0) setDuration(discovered);
        a.currentTime = 0;
      }
    };
    a.ontimeupdate = () => {
      setCurTime(a.currentTime);
      setProgress(a.duration > 0 ? a.currentTime / a.duration : 0);
    };
    a.onpause = () => {
      if (activeAudioEl === a) activeAudioEl = null;
      setPlaying(false);
    };
    a.onended = () => {
      if (activeAudioEl === a) activeAudioEl = null;
      setPlaying(false); setProgress(0); setCurTime(0);
      a.currentTime = 0;
    };
    return () => { a.pause(); a.src = ''; if (activeAudioEl === a) activeAudioEl = null; };
  }, [url]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      if (activeAudioEl && activeAudioEl !== a) activeAudioEl.pause();
      activeAudioEl = a;
      a.play().catch(() => {});
      setPlaying(true);
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  const fg = mine ? 'rgba(255,255,255,0.92)' : 'var(--tr-text-primary)';
  const fgDim = mine ? 'rgba(255,255,255,0.35)' : 'var(--tr-text-muted)';

  return (
    <div className="flex items-center gap-2 py-1 px-0.5" style={{ minWidth: 190, maxWidth: 250 }}>
      {/* Play / Pause */}
      <button
        onClick={toggle}
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90"
        style={{ background: mine ? 'rgba(255,255,255,0.18)' : 'var(--tr-overlay)' }}
      >
        {playing
          ? <svg width="14" height="14" fill={fg} viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          : <svg width="14" height="14" fill={fg} viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        }
      </button>

      {/* Waveform + seek */}
      <div
        className="flex-1 flex items-center gap-[2px] cursor-pointer"
        onClick={seek}
        style={{ height: 28 }}
      >
        {bars.map((h, i) => {
          const played = (i / bars.length) < progress;
          return (
            <div key={i} style={{
              width: 2.5,
              height: Math.max(3, h * 26),
              borderRadius: 2,
              background: played ? fg : fgDim,
              transition: 'background 80ms',
              flexShrink: 0,
            }} />
          );
        })}
      </div>

      {/* Duration */}
      <span style={{ fontSize: 10, color: fgDim, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {playing ? fmtDuration(curTime) : fmtDuration(duration)}
      </span>
    </div>
  );
}

function Inner({ conversationId }: { conversationId: string }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { refresh } = useTareeqNotifications();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<CallEvent[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const [micError, setMicError] = useState('');
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(24).fill(0.15));
  const micTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelledMicRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const animAudioCtxRef = useRef<AudioContext | null>(null);
  const conversationIdRef = useRef(conversationId);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestIdRef = useRef<string>('');
  const callCountRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  // Call state
  const [activeCall, setActiveCall] = useState<{
    callId: string; role: 'caller' | 'callee'; callType: 'audio' | 'video'; offer?: string;
  } | null>(null);

  function playMsgChime() {
    try {
      const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ACtx) return;
      const ctx = new ACtx();
      const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
      resume.then(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.28, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
        osc.onended = () => ctx.close().catch(() => {});
      }).catch(() => {});
    } catch { /* ignore */ }
  }

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/tareeq/conversations/${conversationId}`, { credentials: 'include' });
      if (res.status === 403 || res.status === 404) { router.push('/tareeq/inbox'); return; }
      if (res.ok) {
        const d = await res.json();
        const msgs: Message[] = d.messages ?? [];
        const callEvents: CallEvent[] = d.calls ?? [];
        setMessages(msgs);
        setCalls(callEvents);
        setOtherUser(d.otherUser ?? null);
        latestIdRef.current = msgs.length ? msgs[msgs.length - 1].id : '';
        callCountRef.current = callEvents.length;
        refresh();
      }
    } catch { /* ignore */ } finally {
      if (!silent) setLoading(false);
    }
  }, [conversationId, router, refresh]);

  // Ping own presence every 30s while conversation is open
  useEffect(() => {
    if (!user) return;
    const ping = () => fetch('/api/tareeq/presence', { method: 'POST', credentials: 'include' }).catch(() => {});
    ping();
    presenceRef.current = setInterval(ping, 30_000);
    return () => { if (presenceRef.current) clearInterval(presenceRef.current); };
  }, [user]);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    loadMessages();
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/tareeq/conversations/${conversationId}`, { credentials: 'include' }).catch(() => null);
      if (!res || !res.ok) return;
      const d = await res.json();
      const msgs: Message[] = d.messages ?? [];
      const callEvents: CallEvent[] = d.calls ?? [];
      const newLatest = msgs.length ? msgs[msgs.length - 1].id : '';
      const newCallCount = callEvents.length;

      if (newLatest !== latestIdRef.current) {
        const latestMsg = msgs[msgs.length - 1];
        if (latestMsg && latestMsg.senderId !== user?.id) playMsgChime();
        shouldScrollRef.current = true;
        setMessages(msgs);
        latestIdRef.current = newLatest;
        refresh();
      } else {
        // Still update messages to reflect changed read statuses (seen ticks)
        setMessages(msgs);
      }

      if (newCallCount !== callCountRef.current) {
        setCalls(callEvents);
        callCountRef.current = newCallCount;
      }

      // Update other user's presence from poll response
      if (d.otherUser) setOtherUser(d.otherUser);
    }, 3_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [user, router, loadMessages, conversationId, refresh]);

  // Scroll to bottom on new messages (but not on read-status updates)
  useEffect(() => {
    if (shouldScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldScrollRef.current = false;
    }
  }, [messages]);

  // Initial scroll
  useEffect(() => {
    if (!loading) {
      shouldScrollRef.current = true;
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    }
  }, [loading]);

  // Push input bar above iOS keyboard using visualViewport
  useEffect(() => {
    const bar = inputBarRef.current;
    if (!bar || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      bar.style.bottom = offset > 0 ? `${offset}px` : '0px';
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); };
  }, []);

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      cancelledMicRef.current = true;
      if (micTimerRef.current) clearTimeout(micTimerRef.current);
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      try { mediaRecorderRef.current?.stop(); } catch { /* already stopped */ }
    };
  }, []);

  async function handleMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalPreview(null); setMediaUrl(null); setMediaType(null); setUploadProgress(0);
    if (file.type.startsWith('image/')) {
      setLocalPreview(URL.createObjectURL(file));
    }
    setUploading(true);
    try {
      const isImage = file.type.startsWith('image/');
      const uploadFile = isImage ? await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 }) : file;
      const form = new FormData(); form.append('file', uploadFile);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/tareeq/upload'); xhr.withCredentials = true;
        xhr.upload.onprogress = ev => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) { setMediaUrl(data.url); setMediaType(data.type); setUploadProgress(100); resolve(); }
            else { setSendError(data.error || 'فشل رفع الملف'); reject(); }
          } catch { setSendError('فشل رفع الملف'); reject(); }
        };
        xhr.onerror = () => { setSendError('فشل رفع الملف'); reject(); };
        xhr.send(form);
      });
    } catch { /* error set above */ }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function startCall(callType: 'audio' | 'video') {
    if (!otherUser || !user) return;
    try {
      const res = await fetch('/api/tareeq/calls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ calleeId: otherUser.id, type: callType }),
      });
      if (res.ok) {
        const { callId } = await res.json();
        setActiveCall({ callId, role: 'caller', callType });
      }
    } catch { /* network error — ignore */ }
  }

  async function handleSend() {
    if ((!input.trim() && !mediaUrl) || sending || uploading) return;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch(`/api/tareeq/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: input.trim(),
          imageUrl: mediaType === 'image' ? mediaUrl : null,
          videoUrl: mediaType === 'video' ? mediaUrl : null,
          audioUrl: mediaType === 'audio' ? mediaUrl : null,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.message) {
          shouldScrollRef.current = true;
          setMessages(prev => { const updated = [...prev, d.message as Message]; latestIdRef.current = d.message.id; return updated; });
        }
        setInput('');
        setShowEmoji(false);
        setMediaUrl(null); setMediaType(null); setLocalPreview(null); setUploadProgress(0);
        refresh();
        // Refocus textarea to keep keyboard visible on mobile
        setTimeout(() => textareaRef.current?.focus(), 0);
      } else {
        const d = await res.json().catch(() => ({}));
        setSendError(d.error || (isRtl ? 'فشل الإرسال' : 'Send failed'));
      }
    } catch {
      setSendError(isRtl ? 'خطأ في الشبكة' : 'Network error');
    } finally {
      setSending(false);
    }
  }

  function stopMicCleanup() {
    if (micIntervalRef.current) { clearInterval(micIntervalRef.current); micIntervalRef.current = null; }
    if (micTimerRef.current) { clearTimeout(micTimerRef.current); micTimerRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    analyserRef.current = null;
    animAudioCtxRef.current?.close().catch(() => {});
    animAudioCtxRef.current = null;
    setWaveformBars(Array(24).fill(0.15));
  }

  function cancelMic() {
    // Stop recorder in cancel mode — onstop will see cancelledRef and skip upload
    cancelledMicRef.current = true;
    mediaRecorderRef.current?.stop();
    stopMicCleanup();
    setMicActive(false);
    setMicSeconds(0);
  }

  async function handleMic() {
    // Tapping mic while recording → send (stop triggers upload)
    if (micActive) {
      cancelledMicRef.current = false;
      mediaRecorderRef.current?.stop();
      return;
    }

    setMicError('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError(isRtl ? 'يرجى السماح بالوصول للميكروفون' : 'Microphone access denied');
      setTimeout(() => setMicError(''), 3000);
      return;
    }

    audioChunksRef.current = [];
    cancelledMicRef.current = false;

    // Real-time waveform from mic stream
    try {
      const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (ACtx) {
        const actx = new ACtx();
        animAudioCtxRef.current = actx;
        const analyser = actx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.6;
        actx.createMediaStreamSource(stream).connect(analyser);
        analyserRef.current = analyser;
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const drawFrame = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(freqData);
          setWaveformBars(Array.from({ length: 24 }, (_, i) => {
            const idx = Math.floor((i / 24) * freqData.length);
            return Math.max(0.1, freqData[idx] / 255);
          }));
          animFrameRef.current = requestAnimationFrame(drawFrame);
        };
        drawFrame();
      }
    } catch { /* AudioContext not supported */ }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg'
      : ''; // Safari fallback: uses its default (mp4/aac)
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      stopMicCleanup();
      setMicActive(false);
      setMicSeconds(0);

      if (cancelledMicRef.current) return; // user cancelled — discard

      // Use the actual mimeType the recorder chose (important for Safari mp4 fallback)
      const actualMime = mr.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: actualMime });
      if (blob.size < 100) return; // too short — discard

      const baseActual = actualMime.split(';')[0];
      const ext = baseActual.includes('ogg') ? 'ogg' : baseActual.includes('mp4') || baseActual.includes('aac') ? 'm4a' : 'webm';

      setUploading(true);
      setUploadProgress(30);
      try {
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: actualMime });
        const form = new FormData(); form.append('file', file);
        const upRes = await fetch('/api/tareeq/upload', { method: 'POST', body: form, credentials: 'include' });
        setUploadProgress(70);
        if (!upRes.ok) {
          const err = await upRes.json().catch(() => ({}));
          setMicError(err.error ?? (isRtl ? 'فشل رفع الصوت' : 'Upload failed'));
          setTimeout(() => setMicError(''), 3000);
          return;
        }
        const { url: audioUrl } = await upRes.json();
        setUploadProgress(90);
        // Auto-send immediately — no intermediate preview step
        setSending(true);
        const sendRes = await fetch(`/api/tareeq/conversations/${conversationIdRef.current}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: '', audioUrl }),
        });
        if (sendRes.ok) {
          const d = await sendRes.json();
          if (d.message) {
            shouldScrollRef.current = true;
            setMessages(prev => { const updated = [...prev, d.message as Message]; latestIdRef.current = d.message.id; return updated; });
          }
          refresh();
        } else {
          setMicError(isRtl ? 'فشل إرسال الصوت' : 'Send failed');
          setTimeout(() => setMicError(''), 3000);
        }
      } catch {
        setMicError(isRtl ? 'خطأ في الشبكة' : 'Network error');
        setTimeout(() => setMicError(''), 3000);
      } finally {
        setUploading(false);
        setUploadProgress(0);
        setSending(false);
      }
    };

    mr.start(250); // timeslice ensures chunks arrive even if onstop fires late (iOS Safari)
    setMicActive(true);
    setMicSeconds(0);
    micIntervalRef.current = setInterval(() => setMicSeconds(s => s + 1), 1000);

    // Auto-stop after 3 minutes
    micTimerRef.current = setTimeout(() => { cancelledMicRef.current = false; mediaRecorderRef.current?.stop(); }, 3 * 60 * 1000);
  }

  const myId = user?.id ?? '';
  const canSend = !sending && !uploading && !micActive && !!(input.trim() || mediaUrl);

  const flatItems = buildTimeline(messages, calls, myId);

  const dayBuckets: { day: string; items: DayItem[] }[] = [];
  for (const { time, item } of flatItems) {
    const day = time.slice(0, 10);
    const last = dayBuckets[dayBuckets.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      dayBuckets.push({ day, items: [item] });
    }
  }

  const online = isOnline(otherUser?.tareeqLastSeen);

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: 'var(--tr-base)', height: '100dvh' }}>
      {/* Spacer for sub-header (~60px) */}
      <div className="h-[60px] shrink-0" />

      {/* Chat sub-header */}
      <div
        className="fixed top-0 left-0 right-0 px-4 py-3 flex items-center gap-3 z-40"
        style={{
          background: 'var(--tr-surface)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
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
            {/* Avatar + online dot */}
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)' }}>
                {otherUser.avatarUrl
                  ? <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-full h-full object-cover" />
                  : otherUser.name.charAt(0)
                }
              </div>
              {online && (
                <span
                  className="absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full"
                  style={{ background: '#22c55e', border: '2px solid var(--tr-surface)' }}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--tr-text-primary)' }}>{otherUser.name}</p>
              {online && (
                <p className="text-[10px] leading-none mt-0.5" style={{ color: '#22c55e' }}>
                  {isRtl ? 'متصل الآن' : 'Online'}
                </p>
              )}
            </div>
            {/* Call buttons */}
            <div className="flex items-center gap-2 ms-auto">
              <button
                onClick={() => startCall('audio')}
                className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90"
                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}
                aria-label={isRtl ? 'مكالمة صوتية' : 'Voice call'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </button>
              <button
                onClick={() => startCall('video')}
                className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90"
                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}
                aria-label={isRtl ? 'مكالمة فيديو' : 'Video call'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-24 max-w-2xl w-full mx-auto" dir="ltr">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : messages.length === 0 && calls.length === 0 ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl ? 'ابدأ المحادثة' : 'Start the conversation'}
          </div>
        ) : (
          dayBuckets.map(bucket => (
            <div key={bucket.day}>
              {/* Day separator */}
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--tr-border-subtle)' }} />
                <span className="text-[10px] font-semibold px-2" style={{ color: 'var(--tr-text-muted)' }}>
                  {formatDay(bucket.day + 'T12:00:00', isRtl)}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--tr-border-subtle)' }} />
              </div>

              {bucket.items.map((item) => {
                // ── Call event bubble ──────────────────────────────────
                if ('__isCall' in item) {
                  const { call } = item;
                  const isMissed = call.status === 'missed' || call.status === 'rejected';
                  const iCalled = call.callerId === myId;
                  const icon = call.type === 'video' ? '📹' : '🎙️';
                  let dur = 0;
                  if (call.startedAt && call.endedAt) {
                    dur = Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000);
                  }
                  let label = '';
                  if (isRtl) {
                    if (isMissed) label = iCalled ? 'مكالمة فائتة (لم يرد)' : 'مكالمة فائتة';
                    else label = dur > 0 ? `${call.type === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية'} · ${fmtDur(dur)}` : 'مكالمة منتهية';
                  } else {
                    if (isMissed) label = iCalled ? 'Missed call (no answer)' : 'Missed call';
                    else label = dur > 0 ? `${call.type === 'video' ? 'Video' : 'Voice'} call · ${fmtDur(dur)}` : 'Call ended';
                  }
                  return (
                    <div key={call.id} className="flex justify-center my-3">
                      <div className="px-4 py-2 rounded-full flex items-center gap-2 text-xs font-semibold"
                        style={{
                          background: isMissed ? 'rgba(244,63,94,0.10)' : 'rgba(45,212,191,0.08)',
                          border: `1px solid ${isMissed ? 'rgba(244,63,94,0.22)' : 'rgba(45,212,191,0.18)'}`,
                          color: isMissed ? '#f43f5e' : 'var(--tr-teal)',
                        }}>
                        <span>{icon}</span>
                        <span>{label}</span>
                        <span className="ms-1" style={{ color: 'var(--tr-text-muted)', fontWeight: 400 }}>{formatTime(call.createdAt)}</span>
                      </div>
                    </div>
                  );
                }

                // ── Message group ──────────────────────────────────────
                const group = item;
                return (
                <div key={group.msgs[0].id} className="flex flex-col mb-1 w-full">
                  {group.msgs.map((m, mi) => {
                    const isLast = mi === group.msgs.length - 1;
                    const mineRadius = isLast ? '18px 18px 4px 18px' : '18px';
                    const otherRadius = isLast ? '18px 18px 18px 4px' : '18px';
                    return (
                      <div key={m.id} className={`flex items-end gap-1.5 mb-0.5 ${group.mine ? 'justify-end' : 'justify-start'}`}>
                        {/* Receiver avatar — only on last message in group */}
                        {!group.mine && (
                          <div
                            className="w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold"
                            style={{
                              background: 'var(--tr-overlay)',
                              color: 'var(--tr-gold)',
                              border: '1px solid var(--tr-gold-dim)',
                              visibility: isLast ? 'visible' : 'hidden',
                            }}
                          >
                            {isLast && (group.senderInfo.avatarUrl
                              ? <img src={group.senderInfo.avatarUrl} alt="" className="w-full h-full object-cover" />
                              : group.senderInfo.name.charAt(0)
                            )}
                          </div>
                        )}
                        <div
                          className="max-w-[72%] relative"
                          style={{
                            background: group.mine ? 'linear-gradient(135deg, #115e59, #0d9488)' : 'var(--tr-raised)',
                            color: group.mine ? '#fff' : 'var(--tr-text-primary)',
                            ...(group.mine ? {} : { border: '1px solid var(--tr-border-soft)' }),
                            borderRadius: group.mine ? mineRadius : otherRadius,
                          }}
                        >
                          {m.imageUrl && <img src={m.imageUrl} alt="" className="w-full max-w-xs rounded-xl object-cover" style={{ maxHeight: 220 }} />}
                          {m.videoUrl && <video src={m.videoUrl} className="w-full max-w-xs rounded-xl" style={{ maxHeight: 220 }} controls playsInline />}
                          {m.audioUrl && (
                            <VoiceMessage url={m.audioUrl} mine={group.mine} />
                          )}
                          {m.content && (
                            <p className="px-3.5 pt-2 pb-1.5 text-sm leading-relaxed" style={{ wordBreak: 'break-word' }} dir="auto">
                              {m.content}
                            </p>
                          )}
                          {/* Time + read tick inside bubble (WhatsApp style) */}
                          <div
                            className={`flex items-center gap-0.5 px-3 pb-1.5 ${group.mine ? 'justify-end' : 'justify-start'}`}
                            style={{ marginTop: m.content ? -4 : 2 }}
                          >
                            <span className="text-[10px]" style={{ color: group.mine ? 'rgba(255,255,255,0.6)' : 'var(--tr-text-muted)' }}>
                              {formatTime(m.createdAt)}
                            </span>
                            {group.mine && <ReadTick read={m.read} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar — pushed above keyboard via visualViewport */}
      <div
        ref={inputBarRef}
        className="fixed left-0 right-0 z-30"
        style={{
          bottom: 0,
          background: 'var(--tr-surface)',
          borderTop: '1px solid var(--tr-border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Hidden file inputs */}
        <input ref={attachInputRef} type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="hidden" disabled={uploading} onChange={handleMedia} />
        <input ref={cameraInputRef} type="file"
          accept="image/*" capture="environment"
          className="hidden" disabled={uploading} onChange={handleMedia} />

        <div className="max-w-2xl mx-auto px-3 py-2 flex flex-col gap-2 relative">
          {sendError && <p className="text-xs text-center font-semibold" style={{ color: '#f43f5e' }}>{sendError}</p>}

          {/* Mic error */}
          {micError && (
            <div className="text-xs text-center font-semibold py-1" style={{ color: '#f43f5e' }}>{micError}</div>
          )}

          {/* Recording indicator */}
          {micActive && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)' }}>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-xs font-black tabular-nums" style={{ color: '#f43f5e' }}>
                {Math.floor(micSeconds / 60)}:{String(micSeconds % 60).padStart(2, '0')}
              </span>
              <span className="flex-1 text-xs font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'جاري التسجيل...' : 'Recording...'}
              </span>
              <button onClick={cancelMic} className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          )}

          {/* Media preview strip */}
          {(localPreview || mediaUrl || uploading) && (
            <div className="relative rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--tr-border-soft)', ...(mediaType === 'audio' ? { padding: '8px 12px', background: 'var(--tr-raised)' } : { width: 64, height: 64 }) }}>
              {mediaType === 'audio' ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎙️</span>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio src={localPreview ?? mediaUrl ?? undefined} controls className="h-8 flex-1" style={{ minWidth: 0 }} />
                  {!uploading && (
                    <button onClick={() => { setMediaUrl(null); setMediaType(null); setLocalPreview(null); setUploadProgress(0); }}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(0,0,0,0.3)', color: '#fff' }}>×</button>
                  )}
                </div>
              ) : (
                <>
                  {localPreview && mediaType !== 'video'
                    ? <img src={localPreview} alt="" className="w-full h-full object-cover" />
                    : mediaUrl ? (mediaType === 'image'
                        ? <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                        : <video src={mediaUrl} className="w-full h-full object-cover" />)
                      : <div className="w-full h-full" style={{ background: 'var(--tr-overlay)' }} />
                  }
                  {uploading && <div className="absolute inset-0 flex items-center justify-center text-xs font-black" style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--tr-gold-bright)' }}>{uploadProgress}%</div>}
                  {!uploading && <button onClick={() => { setMediaUrl(null); setMediaType(null); setLocalPreview(null); setUploadProgress(0); }} className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}>×</button>}
                </>
              )}
              {uploading && mediaType === 'audio' && (
                <div className="text-xs font-bold text-center mt-1" style={{ color: 'var(--tr-gold)' }}>
                  {isRtl ? 'جاري الرفع...' : 'Uploading...'} {uploadProgress}%
                </div>
              )}
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <TareeqEmojiPicker
              onSelect={em => { setInput(prev => prev + em); textareaRef.current?.focus(); }}
              onClose={() => setShowEmoji(false)}
            />
          )}

          {/* Input row */}
          <div className="flex items-center gap-2" dir={isRtl ? 'rtl' : 'ltr'}>

            {/* ── RECORDING BAR (replaces pill when mic is active) ── */}
            {micActive && (
              <>
                {/* Cancel */}
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={cancelMic}
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition active:scale-90"
                  style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.22)', flexShrink: 0 }}
                  aria-label={isRtl ? 'إلغاء' : 'Cancel'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Waveform pill */}
                <div
                  className="flex flex-1 items-center gap-1 px-3 rounded-full overflow-hidden"
                  style={{ background: 'var(--tr-surface)', border: '1.5px solid rgba(239,68,68,0.18)', minHeight: 44 }}
                >
                  {/* Pulsing dot */}
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ background: '#ef4444' }} />
                  {/* Live waveform bars */}
                  <div className="flex-1 flex items-center justify-center gap-[2.5px]" style={{ height: 32 }}>
                    {waveformBars.map((h, i) => (
                      <div key={i} style={{
                        width: 2.5,
                        height: Math.max(4, h * 28),
                        background: `rgba(239,68,68,${0.35 + h * 0.65})`,
                        borderRadius: 2,
                        transition: 'height 80ms ease',
                        flexShrink: 0,
                      }} />
                    ))}
                  </div>
                  {/* Timer */}
                  <span className="text-xs font-bold shrink-0 tabular-nums" style={{ color: '#ef4444', minWidth: '2.8rem', textAlign: 'end' }}>
                    {fmtDuration(micSeconds)}
                  </span>
                </div>

                {/* Send button */}
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { cancelledMicRef.current = false; mediaRecorderRef.current?.stop(); }}
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition active:scale-90"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', boxShadow: '0 4px 16px rgba(34,197,94,0.30)', flexShrink: 0 }}
                  aria-label={isRtl ? 'إرسال' : 'Send'}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </>
            )}

            {/* Pill: emoji + textarea + attach + camera */}
            <div
              className="flex flex-1 items-center rounded-full px-2 gap-1"
              style={{
                background: 'var(--tr-surface)',
                border: '1.5px solid var(--tr-border-soft)',
                boxShadow: '0 1px 6px var(--tr-shadow-sm)',
                minHeight: 44,
                display: micActive ? 'none' : undefined,
              }}
            >
              {/* Emoji */}
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setShowEmoji(v => !v)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition active:scale-90"
                style={{ color: showEmoji ? 'var(--tr-gold)' : 'var(--tr-text-muted)', background: showEmoji ? 'var(--tr-gold-glow)' : 'transparent' }}
                aria-label="Emoji"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" d="M8.5 14s1 1.5 3.5 1.5 3.5-1.5 3.5-1.5" />
                  <circle cx="9.5" cy="10.5" r="0.5" fill="currentColor" />
                  <circle cx="14.5" cy="10.5" r="0.5" fill="currentColor" />
                </svg>
              </button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); if (sendError) setSendError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isRtl ? 'رسالة...' : 'Message...'}
                rows={1}
                className="flex-1 bg-transparent border-none focus:outline-none text-sm resize-none py-2.5 px-1"
                style={{ color: 'var(--tr-text-primary)', maxHeight: '100px', overflowY: 'auto' }}
              />

              {/* Attach */}
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                disabled={uploading}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition active:scale-90"
                style={{ color: 'var(--tr-text-muted)', background: 'transparent' }}
                aria-label={isRtl ? 'إرفاق ملف' : 'Attach file'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>

              {/* Camera */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition active:scale-90"
                style={{ color: 'var(--tr-text-muted)', background: 'transparent' }}
                aria-label={isRtl ? 'كاميرا' : 'Camera'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </button>
            </div>

            {/* Mic / Send button — hidden while recording bar is showing */}
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={canSend ? handleSend : handleMic}
              style={{ display: micActive ? 'none' : undefined }}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={canSend ? {
                background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))',
                color: '#fff',
                boxShadow: '0 4px 16px var(--tr-gold-glow)',
              } : micActive ? {
                background: '#ef4444',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(239,68,68,0.4)',
              } : {
                background: 'var(--tr-raised)',
                color: 'var(--tr-text-secondary)',
                border: '1px solid var(--tr-border-soft)',
              }}
              aria-label={canSend ? (isRtl ? 'إرسال' : 'Send') : (isRtl ? 'تسجيل صوت' : 'Voice')}
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
              ) : canSend ? (
                /* Origami bird — reflected so it flies toward the recipient */
                <svg width="20" height="20" viewBox="0 0 327.638 327.638" fill="currentColor">
                  <g transform="scale(-1,1) translate(-327.638,0)">
                    <path d="M327.294,61.106c-0.835-2.324-3.042-3.883-5.512-3.883H175.641c-1.475,0-2.893,0.555-3.974,1.553l-49.009,45.261L61.705,43.083c-0.066-0.062-0.152-0.1-0.217-0.163c-0.211-0.194-0.452-0.352-0.689-0.518c-0.255-0.168-0.495-0.331-0.764-0.454c-0.08-0.037-0.14-0.101-0.223-0.135c-0.169-0.071-0.343-0.077-0.515-0.128c-0.298-0.094-0.586-0.183-0.895-0.223c-0.28-0.043-0.552-0.043-0.832-0.043s-0.549,0-0.832,0.043c-0.309,0.046-0.603,0.135-0.9,0.229c-0.163,0.052-0.34,0.058-0.503,0.129c-0.083,0.034-0.14,0.092-0.217,0.135c-0.274,0.128-0.526,0.297-0.778,0.469c-0.234,0.157-0.469,0.314-0.68,0.503c-0.071,0.063-0.151,0.1-0.223,0.163L1.717,94.809c-1.675,1.675-2.179,4.191-1.27,6.381c0.906,2.19,3.045,3.614,5.409,3.614h45.864v67.335c0,0.017,0.006,0.028,0.006,0.04s-0.006,0.023-0.006,0.034c0,0.046,0.029,0.092,0.035,0.144c0.031,0.691,0.194,1.344,0.446,1.955c0.077,0.178,0.157,0.349,0.246,0.521c0.3,0.56,0.669,1.075,1.129,1.509c0.06,0.058,0.083,0.138,0.143,0.195l63.427,55.625c0.049,0.039,0.112,0.057,0.166,0.103c0.274,0.897,0.698,1.749,1.381,2.436l49.798,49.804c1.121,1.115,2.622,1.716,4.144,1.716c0.755,0,1.515-0.144,2.241-0.446c2.189-0.903,3.613-3.042,3.613-5.409v-92.174L325.504,67.61C327.409,66.041,328.129,63.437,327.294,61.106z M63.42,157.998V98.942V61.358l48.323,48.323L63.42,157.998z M19.98,93.087l31.729-31.729v31.729H19.98z M166.764,266.229l-35.4-35.406l35.4-31.306V266.229z M121.118,220.084l-54.805-48.065L177.934,68.935h127.472L121.118,220.084z"/>
                  </g>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm-1 17.93V21h-2v2h6v-2h-2v-2.07A8 8 0 0020 12h-2a6 6 0 01-12 0H4a8 8 0 007 7.93z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Active call screen */}
      {activeCall && otherUser && (
        <TareeqCallScreen
          callId={activeCall.callId}
          role={activeCall.role}
          callType={activeCall.callType}
          remoteUser={otherUser}
          offer={activeCall.offer}
          onEnd={() => setActiveCall(null)}
        />
      )}
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
