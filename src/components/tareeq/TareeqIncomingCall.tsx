'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import TareeqCallScreen, { CallParty } from './TareeqCallScreen';

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
  const [accepted, setAccepted] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringActiveRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Pre-created video element for loudspeaker routing — unlocked on first user interaction.
  // Kept alive for the component lifetime so autoplay policy doesn't block it on ring start.
  const ringVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioUnlockedRef = useRef(false);

  // On mount: create the ring video element and unlock it on first touch/click.
  // This is the standard "audio unlock" pattern for mobile browsers.
  // The element stays in the DOM (hidden) until startRing() pipes audio through it.
  useEffect(() => {
    const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ACtx) return;

    const vid = document.createElement('video');
    vid.setAttribute('playsinline', '');
    vid.setAttribute('webkit-playsinline', '');
    vid.muted = false;
    vid.volume = 1;
    vid.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px;left:-9999px';
    document.body.appendChild(vid);
    ringVideoRef.current = vid;

    const unlock = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      // Briefly play and pause to unlock autoplay policy for this video element
      vid.play().then(() => vid.pause()).catch(() => {});
      // Create and keep an AudioContext running — reused by startRing() so it's
      // already in 'running' state when the call arrives (no gesture needed later).
      try {
        const ctx = new ACtx({ latencyHint: 'playback' });
        // Play a silent buffer to fully unlock the context in this gesture
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        // Keep ctx alive for startRing() — do NOT close it here
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = ctx;
        } else {
          ctx.close().catch(() => {});
        }
      } catch { /* ignore */ }
    };
    document.addEventListener('touchstart', unlock, { once: true, passive: true });
    document.addEventListener('click',      unlock, { once: true });

    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click',      unlock);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      if (ringVideoRef.current) {
        ringVideoRef.current.srcObject = null;
        ringVideoRef.current.remove();
        ringVideoRef.current = null;
      }
    };
  }, []);

  function startRing() {
    ringActiveRef.current = true;
    try {
      const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ACtx) return;

      // Reuse the pre-unlocked context from the gesture handler — already running.
      // Fall back to a fresh context if none exists (may be suspended without prior gesture).
      let ctx = audioCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new ACtx({ latencyHint: 'playback' });
        audioCtxRef.current = ctx;
      }
      ctx.resume().catch(() => {});

      let dest: AudioNode = ctx.destination;
      const vid = ringVideoRef.current;

      const playBurst = (t: number, freq: number, dur: number) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
        gain.gain.setValueAtTime(0.25, t + dur - 0.02);
        gain.gain.linearRampToValueAtTime(0, t + dur);
        osc.start(t); osc.stop(t + dur);
      };

      const ring = () => {
        if (!ringActiveRef.current || !audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        try {
          const t = ctx!.currentTime + 0.05;
          playBurst(t, 480, 0.4);
          playBurst(t, 425, 0.4);
          playBurst(t + 0.6, 480, 0.4);
          playBurst(t + 0.6, 425, 0.4);
        } catch { /* context closed mid-ring */ }
      };

      // Start ringing only after play() settles so dest is correctly set before oscillators fire
      const beginRinging = () => {
        if (!ringActiveRef.current) return;
        ring();
        ringRef.current = setInterval(ring, 3000);
      };

      if (vid) {
        try {
          const streamDest = ctx.createMediaStreamDestination();
          vid.srcObject = streamDest.stream;
          vid.play().then(() => {
            dest = streamDest; // loudspeaker path confirmed
            beginRinging();
          }).catch(() => {
            beginRinging(); // falls back to ctx.destination
          });
          return;
        } catch { /* use ctx.destination */ }
      }
      beginRinging();
    } catch { /* AudioContext not supported */ }
  }

  function stopRing() {
    ringActiveRef.current = false;
    if (ringRef.current) { clearInterval(ringRef.current); ringRef.current = null; }
    // Keep audioCtxRef alive — it's the pre-unlocked context for the next ring
    if (ringVideoRef.current) {
      ringVideoRef.current.pause();
      ringVideoRef.current.srcObject = null;
    }
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
    setAccepted(false);
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

  function accept() {
    stopRing();
    // Stop polling — TareeqCallScreen manages signaling from here.
    // If we keep polling, the call status changes to 'active' and poll
    // sees call:null (not 'ringing' anymore) → would unmount the active call.
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setAccepted(true);
  }

  if (!incoming) return null;

  if (accepted) {
    return (
      <TareeqCallScreen
        callId={incoming.id}
        role="callee"
        callType={incoming.type}
        remoteUser={incoming.caller}
        offer={incoming.offer}
        autoAnswer
        onEnd={dismiss}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{ background: 'rgba(7,13,20,0.92)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex flex-col items-center gap-5 px-6 py-10 rounded-3xl max-w-xs w-full mx-4"
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        {/* Pulsing ring */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: 'var(--tr-gold)', transform: 'scale(1.4)' }} />
          {incoming.caller.avatarUrl ? (
            <img src={incoming.caller.avatarUrl} alt={incoming.caller.name}
              className="w-24 h-24 rounded-full object-cover relative z-10"
              style={{ border: '3px solid rgba(212,168,83,0.5)' }} />
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center font-black text-4xl relative z-10"
              style={{ background: 'linear-gradient(135deg,#1a4a3a,#0d9488)', color: '#fff', border: '3px solid rgba(212,168,83,0.5)' }}>
              {incoming.caller.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--tr-text-muted)' }}>
            {incoming.type === 'video'
              ? (isRtl ? '📹 مكالمة فيديو واردة' : '📹 Incoming video call')
              : (isRtl ? '🎙️ مكالمة صوتية واردة' : '🎙️ Incoming voice call')}
          </p>
          <h2 className="font-black text-xl" style={{ color: 'var(--tr-text-primary)' }}>
            {incoming.caller.name}
          </h2>
        </div>

        <div className="flex items-center gap-8 mt-2">
          <button onClick={decline} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{ background: '#ef4444', boxShadow: '0 6px 20px rgba(239,68,68,0.4)' }}>
              ✕
            </div>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'رفض' : 'Decline'}
            </span>
          </button>
          <button onClick={accept} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{ background: '#22c55e', boxShadow: '0 6px 20px rgba(34,197,94,0.4)' }}>
              ✓
            </div>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'قبول' : 'Accept'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
