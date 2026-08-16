'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

// Singleton — survives soft navigations within /tareeq
let _ctx: AudioContext | null = null;
let _sessionStarted = false;

function getOrCreateCtx(): AudioContext | null {
  if (_ctx && _ctx.state !== 'closed') return _ctx;
  try { _ctx = new AudioContext(); return _ctx; } catch { return null; }
}

function startSilenceLoop(ctx: AudioContext) {
  // Near-silent noise loop keeps the AudioContext "playing" so the OS treats
  // subsequent sounds as media audio (not notification audio).
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sr * 4, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.00008;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const gain = ctx.createGain();
  gain.gain.value = 0.00008;

  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}

function registerMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'طريق',
    artist: 'مسلم ليدر',
    artwork: [
      { src: '/Tareeq-big.png',   sizes: '512x512', type: 'image/png' },
      { src: '/Tareeq-small.png', sizes: '192x192', type: 'image/png' },
    ],
  });
  navigator.mediaSession.playbackState = 'playing';
}

// Plays a soft bell chime through the shared AudioContext (= media channel)
function playChime(ctx: AudioContext) {
  ctx.resume().then(() => {
    const now = ctx.currentTime;

    // Primary bell (880 Hz A5)
    const osc1 = ctx.createOscillator();
    const g1   = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 880;
    osc1.connect(g1); g1.connect(ctx.destination);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.28, now + 0.015);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc1.start(now); osc1.stop(now + 1.4);

    // Overtone (1760 Hz)
    const osc2 = ctx.createOscillator();
    const g2   = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1760;
    osc2.connect(g2); g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.09, now + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.start(now); osc2.stop(now + 0.9);

    // Soft descending follow note (660 Hz E5)
    const osc3 = ctx.createOscillator();
    const g3   = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = 660;
    osc3.connect(g3); g3.connect(ctx.destination);
    g3.gain.setValueAtTime(0, now + 0.32);
    g3.gain.linearRampToValueAtTime(0.16, now + 0.37);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc3.start(now + 0.32); osc3.stop(now + 1.1);
  }).catch(() => {});
}

export default function TareeqMediaSession() {
  const { user } = useAuth();
  // Track whether *this instance* registered the listener
  const listenerRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    // ── Step 1: register media session on first user gesture ──────────
    function onFirstGesture() {
      if (_sessionStarted) return;
      _sessionStarted = true;

      const ctx = getOrCreateCtx();
      if (!ctx) return;

      startSilenceLoop(ctx);
      registerMediaSession();

      document.removeEventListener('click',      onFirstGesture);
      document.removeEventListener('touchstart', onFirstGesture);
    }

    if (!_sessionStarted) {
      document.addEventListener('click',      onFirstGesture, { passive: true });
      document.addEventListener('touchstart', onFirstGesture, { passive: true });
    }

    // ── Step 2: listen for SW messages → play through media channel ───
    if (!listenerRef.current && navigator.serviceWorker) {
      listenerRef.current = true;

      const handler = (ev: MessageEvent) => {
        const t = ev.data?.type;
        if (t === 'TAREEQ_PLAY_SOUND' || t === 'TAREEQ_NEW_MESSAGE') {
          const ctx = getOrCreateCtx();
          if (ctx) playChime(ctx);
        }
      };

      navigator.serviceWorker.addEventListener('message', handler);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handler);
        document.removeEventListener('click',      onFirstGesture);
        document.removeEventListener('touchstart', onFirstGesture);
        listenerRef.current = false;
      };
    }

    return () => {
      document.removeEventListener('click',      onFirstGesture);
      document.removeEventListener('touchstart', onFirstGesture);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
}
