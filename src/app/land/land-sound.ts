// Tiny synthesised UI sounds for the Land map — ported as-is from the Lovable project
// (src/components/land/sound.ts). No files. Called only from user gestures.
let ctx: AudioContext | null = null;
let enabled = true;
export const setSound = (v: boolean) => { enabled = v; };
function ac() {
  if (typeof window === "undefined") return null;
  ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function tone(freq: number, start: number, dur: number, gain = 0.06, type: OscillatorType = "sine") {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
export const sfx = {
  hover: () => enabled && tone(1320, 0, 0.12, 0.025),
  open: () => { if (!enabled) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.9, 0.05)); tone(130, 0, 1.4, 0.05, "triangle"); },
  close: () => enabled && (tone(784, 0, 0.25, 0.04), tone(523, 0.08, 0.35, 0.04)),
  chirp: () => enabled && (tone(2200, 0, 0.08, 0.03, "triangle"), tone(2900, 0.09, 0.08, 0.03, "triangle")),
};
