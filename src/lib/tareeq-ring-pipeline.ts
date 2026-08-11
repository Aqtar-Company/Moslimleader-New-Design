// Pre-wired loudspeaker pipeline for outgoing call ringtone.
// Call prewireOutRingPipeline() synchronously inside the call-button click handler
// (before any awaits) so vid.play() executes within the browser's gesture frame.
// TareeqCallScreen picks it up via consumeOutRingPipeline() on mount.

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
