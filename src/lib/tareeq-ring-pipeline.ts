// Loudspeaker pipelines for Tareeq calls.
//
// OUTGOING: Call prewireOutRingPipeline() synchronously in the call-button click
// handler (before any awaits). TareeqCallScreen reads it via consumeOutRingPipeline().
//
// INCOMING: Call prewireInRingPipeline() from TareeqShell on any user gesture
// (touchstart/click) — or try immediately on mount. TareeqIncomingCall reads it
// via consumeInRingPipeline() in startRing(). This ensures the loudspeaker route
// is established BEFORE a call arrives, so the ring never starts through earpiece.

let _ctx: AudioContext | null = null;
let _dest: MediaStreamAudioDestinationNode | null = null;
let _vid: HTMLVideoElement | null = null;

export function prewireOutRingPipeline() {
  if (typeof window === 'undefined') return;
  if (_ctx && _ctx.state !== 'closed') return; // already wired
  try {
    const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ACtx) return;
    _ctx = new ACtx({ latencyHint: 'playback' });
    _dest = _ctx.createMediaStreamDestination();
    _vid = document.createElement('video');
    _vid.setAttribute('playsinline', '');
    _vid.setAttribute('webkit-playsinline', '');
    _vid.muted = false;
    _vid.volume = 1;
    _vid.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px;left:-9999px';
    _vid.srcObject = _dest.stream;
    document.body.appendChild(_vid);
    // play() must succeed within the gesture frame — this locks the loudspeaker route
    _vid.play().catch(() => {});
    // Silence node keeps ctx + streamDest alive
    const osc = _ctx.createOscillator();
    const gain = _ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(_dest);
    osc.start();
  } catch { /* AudioContext not supported */ }
}

export function consumeOutRingPipeline(): {
  ctx: AudioContext | null;
  dest: MediaStreamAudioDestinationNode | null;
} {
  return { ctx: _ctx, dest: _dest };
}

export function releaseOutRingPipeline() {
  _ctx?.close().catch(() => {});
  _ctx = null;
  _dest = null;
  if (_vid) { _vid.srcObject = null; _vid.remove(); _vid = null; }
}

// ── Incoming call loudspeaker pipeline ──────────────────────────────────────
// Pre-wired from TareeqShell on first gesture anywhere on the Tareeq pages,
// so the pipeline is established well before any call arrives.

let _inCtx: AudioContext | null = null;
let _inDest: MediaStreamAudioDestinationNode | null = null;
let _inVid: HTMLVideoElement | null = null;
let _inUnlocked = false;

export function prewireInRingPipeline() {
  if (typeof window === 'undefined') return;
  if (_inUnlocked) return;
  // If a previous attempt left a context open, don't re-create
  if (_inCtx && _inCtx.state !== 'closed') return;
  try {
    const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ACtx) return;
    const ctx = new ACtx({ latencyHint: 'playback' });
    const dest = ctx.createMediaStreamDestination();
    const vid = document.createElement('video');
    vid.setAttribute('playsinline', '');
    vid.setAttribute('webkit-playsinline', '');
    vid.muted = false;
    vid.volume = 1;
    vid.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px;left:-9999px';
    vid.srcObject = dest.stream;
    document.body.appendChild(vid);
    vid.play()
      .then(() => {
        _inUnlocked = true;
        _inCtx = ctx;
        _inDest = dest;
        _inVid = vid;
        // Silence oscillator keeps ctx + streamDest alive permanently
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
      })
      .catch(() => {
        // play() failed (no gesture yet) — tear down and retry on next gesture
        ctx.close().catch(() => {});
        vid.srcObject = null;
        vid.remove();
      });
  } catch { /* AudioContext not supported */ }
}

export function consumeInRingPipeline(): {
  ctx: AudioContext | null;
  dest: MediaStreamAudioDestinationNode | null;
} {
  return { ctx: _inCtx, dest: _inDest };
}

export function releaseInRingPipeline() {
  _inCtx?.close().catch(() => {});
  _inCtx = null;
  _inDest = null;
  _inUnlocked = false;
  if (_inVid) { _inVid.srcObject = null; _inVid.remove(); _inVid = null; }
}
