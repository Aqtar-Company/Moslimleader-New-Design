'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import TareeqCallScreen, { CallParty } from './TareeqCallScreen';
import { waitForInRingPipeline } from '@/lib/tareeq-ring-pipeline';

interface IncomingCall {
  id: string;
  type: 'audio' | 'video';
  offer: string;
  caller: CallParty;
}

export default function TareeqIncomingCall() {
  const { user } = useAuth();
  const { isRtl } = useLang();
  const searchParams = useSearchParams();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [acceptedAs, setAcceptedAs] = useState<'audio' | 'video' | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringActiveRef = useRef(false);
  // audioCtxRef is only used for cleanup on unmount; the actual context lives
  // in the module-level pipeline (consumeInRingPipeline), pre-wired by TareeqShell.
  const audioCtxRef = useRef<AudioContext | null>(null);

  async function startRing() {
    ringActiveRef.current = true;
    try {
      const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ACtx) return;

      // Wait up to 800ms for the loudspeaker pipeline (vid.play() is async — startRing may
      // run before prewireInRingPipeline resolves when opening from a notification tap).
      const { ctx: prewiredCtx, dest: prewiredDest } = await waitForInRingPipeline(800);
      if (!ringActiveRef.current) return; // declined while waiting

      const ctx = prewiredCtx ?? new ACtx({ latencyHint: 'playback' });
      audioCtxRef.current = ctx;
      const dest: AudioNode = prewiredDest ?? ctx.destination;

      ctx.resume().then(() => {
        if (!ringActiveRef.current) return;

        const playBurst = (t: number, freq: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(dest);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
          gain.gain.setValueAtTime(0.28, t + dur - 0.02);
          gain.gain.linearRampToValueAtTime(0, t + dur);
          osc.start(t); osc.stop(t + dur);
        };

        const ring = () => {
          if (!ringActiveRef.current || ctx.state === 'closed') return;
          try {
            const t = ctx.currentTime + 0.05;
            playBurst(t,       480, 0.4);
            playBurst(t,       425, 0.4);
            playBurst(t + 0.6, 480, 0.4);
            playBurst(t + 0.6, 425, 0.4);
          } catch { /* context closed mid-ring */ }
        };

        ring();
        ringRef.current = setInterval(ring, 3000);
      }).catch(() => {});
    } catch { /* AudioContext not supported */ }
  }

  function stopRing() {
    ringActiveRef.current = false;
    if (ringRef.current) { clearInterval(ringRef.current); ringRef.current = null; }
    // Leave audioCtx + video alive — pipeline stays warm for next ring
  }

  // When the app opens from a notification tap, the URL has ?callId=...
  // Burst-poll for up to 10s so we catch the call even if the offer isn't ready yet.
  const notifCallId = searchParams?.get('callId');
  // Start burst poll as soon as the notif callId is in the URL — don't wait for user
  // auth to load. The API returns {call:null} when unauthenticated and we keep polling
  // until auth resolves and the call appears (up to 30s).
  useEffect(() => {
    if (!notifCallId) return;
    let attempts = 0;
    const burst = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/tareeq/calls/incoming', { credentials: 'include' });
        if (!res.ok) return;
        const { call } = await res.json();
        if (call && !seenRef.current.has(call.id)) {
          setIncoming(prev => {
            if (prev) return prev;
            startRing();
            return call;
          });
          clearInterval(burst);
        }
      } catch { /* ignore */ }
      if (attempts >= 30) clearInterval(burst);
    }, 1000);
    return () => clearInterval(burst);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifCallId]);

  useEffect(() => {
    if (!user) return;

    async function poll() {
      try {
        const res = await fetch('/api/tareeq/calls/incoming', { credentials: 'include' });
        if (!res.ok) return;
        const { call } = await res.json();

        setIncoming(prev => {
          // If we're currently showing a call and the server no longer returns it
          // (caller cancelled / timed out / marked missed), dismiss the overlay
          if (prev && !call) {
            stopRing();
            seenRef.current.add(prev.id);
            return null;
          }
          // New call arrived
          if (call && !seenRef.current.has(call.id) && !prev) {
            startRing();
            return call;
          }
          return prev;
        });
      } catch { /* offline */ }
    }

    // Service worker message: TAREEQ_INCOMING_CALL fires instantly when a push
    // arrives, bypassing the 3-second polling delay.
    // We poll rapidly for up to 8s to handle the race where push fires before
    // the caller's offer is stored (offer creation takes ~1-2s after call init).
    function onSwMessage(ev: MessageEvent) {
      if (ev.data?.type !== 'TAREEQ_INCOMING_CALL' || !ev.data.callId) return;
      let attempts = 0;
      const burst = setInterval(async () => {
        attempts++;
        await poll();
        if (attempts >= 15) clearInterval(burst);
      }, 1000);
    }
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      stopRing();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function dismiss() {
    stopRing();
    if (incoming) seenRef.current.add(incoming.id);
    setIncoming(null);
    setAcceptedAs(null);
  }

  async function decline() {
    if (!incoming) return;
    stopRing();
    seenRef.current.add(incoming.id);
    await fetch(`/api/tareeq/calls/${incoming.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'reject' }),
    }).catch(() => {});
    setIncoming(null);
  }

  function accept(as: 'audio' | 'video') {
    stopRing();
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setAcceptedAs(as);
  }

  if (!incoming) return null;

  if (acceptedAs) {
    return (
      <TareeqCallScreen
        callId={incoming.id}
        role="callee"
        callType={acceptedAs}
        remoteUser={incoming.caller}
        offer={incoming.offer}
        autoAnswer
        onEnd={dismiss}
      />
    );
  }

  const isVideo = incoming.type === 'video';

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background: isVideo
          ? 'linear-gradient(160deg,rgba(4,25,40,0.96) 0%,rgba(7,40,55,0.96) 100%)'
          : 'rgba(7,13,20,0.93)',
        backdropFilter: 'blur(14px)',
      }}
    >
      {/* Video call — top camera banner */}
      {isVideo && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-center gap-2 py-3"
          style={{ background: 'rgba(13,148,136,0.18)', borderBottom: '1px solid rgba(13,148,136,0.25)' }}>
          <svg width="16" height="16" fill="none" stroke="#2dd4bf" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span className="text-xs font-bold" style={{ color: '#2dd4bf' }}>
            {isRtl ? 'مكالمة فيديو واردة' : 'Incoming video call'}
          </span>
        </div>
      )}

      <div className="flex flex-col items-center gap-5 px-6 py-10 rounded-3xl max-w-xs w-full mx-4"
        style={{
          background: isVideo ? 'rgba(7,25,38,0.90)' : 'var(--tr-surface)',
          border: isVideo ? '1px solid rgba(13,148,136,0.35)' : '1px solid var(--tr-border-soft)',
          boxShadow: isVideo
            ? '0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(13,148,136,0.12)'
            : '0 24px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Avatar with ring */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: isVideo ? '#2dd4bf' : 'var(--tr-gold)', transform: 'scale(1.5)' }} />
          {/* Video camera overlay badge */}
          {isVideo && (
            <div className="absolute -bottom-1 -end-1 z-20 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: '#0d9488', border: '2px solid rgba(7,25,38,1)' }}>
              <svg width="13" height="13" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          )}
          {incoming.caller.avatarUrl ? (
            <img src={incoming.caller.avatarUrl} alt={incoming.caller.name}
              className="w-24 h-24 rounded-full object-cover relative z-10"
              style={{ border: `3px solid ${isVideo ? 'rgba(13,148,136,0.6)' : 'rgba(212,168,83,0.5)'}` }} />
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center font-black text-4xl relative z-10"
              style={{ background: 'linear-gradient(135deg,#1a4a3a,#0d9488)', color: '#fff', border: `3px solid ${isVideo ? 'rgba(13,148,136,0.6)' : 'rgba(212,168,83,0.5)'}` }}>
              {incoming.caller.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="text-center">
          {!isVideo && (
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? '🎙️ مكالمة صوتية واردة' : '🎙️ Incoming voice call'}
            </p>
          )}
          <h2 className="font-black text-xl" style={{ color: isVideo ? '#fff' : 'var(--tr-text-primary)' }}>
            {incoming.caller.name}
          </h2>
        </div>

        {/* Buttons */}
        {isVideo ? (
          /* Video call: Decline | Audio answer | Video answer */
          <div className="flex items-end gap-5 mt-2">
            {/* Decline */}
            <button onClick={decline} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: '#ef4444', boxShadow: '0 6px 20px rgba(239,68,68,0.4)' }}>
                <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {isRtl ? 'رفض' : 'Decline'}
              </span>
            </button>
            {/* Answer audio only */}
            <button onClick={() => accept('audio')} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.22)', boxShadow: '0 6px 20px rgba(0,0,0,0.3)' }}>
                <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {isRtl ? 'صوت فقط' : 'Audio only'}
              </span>
            </button>
            {/* Answer with video */}
            <button onClick={() => accept('video')} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: '#22c55e', boxShadow: '0 6px 20px rgba(34,197,94,0.4)' }}>
                <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {isRtl ? 'رد بالفيديو' : 'Answer video'}
              </span>
            </button>
          </div>
        ) : (
          /* Audio call: Decline | Accept */
          <div className="flex items-center gap-8 mt-2">
            <button onClick={decline} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: '#ef4444', boxShadow: '0 6px 20px rgba(239,68,68,0.4)' }}>
                <svg width="24" height="24" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'رفض' : 'Decline'}
              </span>
            </button>
            <button onClick={() => accept('audio')} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: '#22c55e', boxShadow: '0 6px 20px rgba(34,197,94,0.4)' }}>
                <svg width="24" height="24" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'رد' : 'Accept'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
