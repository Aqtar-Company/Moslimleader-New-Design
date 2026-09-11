'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

// Module-level singletons — survive soft navigations within /tareeq
let _ctx: AudioContext | null = null;
let _sessionStarted = false;

function ensureCtxWithLoop(): AudioContext | null {
  // If we have a live, running context → reuse it
  if (_ctx && _ctx.state !== 'closed') return _ctx;

  // Previous context closed (iOS power-save, browser enforcement) → rebuild
  try {
    _ctx = new AudioContext();
    // Restart the silence loop on the new context so the OS still treats
    // Tareeq as a media player (not just a one-shot notification source)
    startSilenceLoop(_ctx);
    registerMediaSession();
    return _ctx;
  } catch { return null; }
}

function startSilenceLoop(ctx: AudioContext) {
  // Near-silent noise loop keeps the AudioContext "playing" so the OS routes
  // subsequent audio through the media channel (speaker, headphones).
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

// Soft bell chime played through the shared AudioContext (= media channel)
function playChime(ctx: AudioContext) {
  ctx.resume().then(() => {
    const now = ctx.currentTime;

    // Primary bell (A5 — 880 Hz)
    const osc1 = ctx.createOscillator();
    const g1   = ctx.createGain();
    osc1.type = 'sine'; osc1.frequency.value = 880;
    osc1.connect(g1); g1.connect(ctx.destination);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.28, now + 0.015);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc1.start(now); osc1.stop(now + 1.4);

    // Overtone (1760 Hz)
    const osc2 = ctx.createOscillator();
    const g2   = ctx.createGain();
    osc2.type = 'sine'; osc2.frequency.value = 1760;
    osc2.connect(g2); g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.09, now + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.start(now); osc2.stop(now + 0.9);

    // Descending follow note (E5 — 660 Hz)
    const osc3 = ctx.createOscillator();
    const g3   = ctx.createGain();
    osc3.type = 'sine'; osc3.frequency.value = 660;
    osc3.connect(g3); g3.connect(ctx.destination);
    g3.gain.setValueAtTime(0, now + 0.32);
    g3.gain.linearRampToValueAtTime(0.16, now + 0.37);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc3.start(now + 0.32); osc3.stop(now + 1.1);
  }).catch(() => {
    // resume() rejected → AudioContext was never unblocked by a user gesture.
    // Nothing to do; the OS notification sound already fired for this case.
  });
}

export default function TareeqMediaSession() {
  const { user } = useAuth();
  const listenerRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    // ── Start media session on first user gesture ─────────────────────
    function onFirstGesture() {
      if (_sessionStarted) return;
      _sessionStarted = true;

      try {
        _ctx = new AudioContext();
        startSilenceLoop(_ctx);
        registerMediaSession();
      } catch { /* browser blocked AudioContext */ }

      document.removeEventListener('click',      onFirstGesture);
      document.removeEventListener('touchstart', onFirstGesture);
    }

    if (!_sessionStarted) {
      document.addEventListener('click',      onFirstGesture, { passive: true });
      document.addEventListener('touchstart', onFirstGesture, { passive: true });
    }

    // ── Listen for SW → play chime through media channel ─────────────
    if (!listenerRef.current && navigator.serviceWorker) {
      listenerRef.current = true;

      const handler = (ev: MessageEvent) => {
        const t = ev.data?.type;
        if (t !== 'TAREEQ_PLAY_SOUND' && t !== 'TAREEQ_NEW_MESSAGE') return;

        // This player owns the sound whenever it CAN play: it routes through the media
        // channel, so it is heard with the screen locked and in silent mode. It needs a
        // gesture to have started the session first.
        //
        // When it can't, it must hand off rather than return — the comment here used to say
        // "the OS notification already played its sound", which is exactly wrong in this
        // branch: the service worker sets `silent: true` on the notification whenever a
        // visible window exists, precisely because it expects the page to play it. Silence
        // on both sides was the result.
        //
        // A window event, not a second SW-message listener: two listeners on the same
        // target would both fire for one push and chime twice, and their order is an
        // implementation detail. One owner per branch.
        if (!_sessionStarted) {
          window.dispatchEvent(new Event('tareeq-chime-fallback'));
          return;
        }

        // ensureCtxWithLoop() rebuilds a closed ctx and restarts the loop,
        // so _sessionStarted stays true and media-channel routing is restored.
        const ctx = ensureCtxWithLoop();
        if (ctx) playChime(ctx);
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
