/* audio.js — أصوات مولّدة عبر Web Audio API، بدون ملفات خارجية */

const AudioManager = (() => {
  let ctx = null;
  let muted = false;

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    return ctx;
  }

  function tone(freq, duration = 0.12, type = 'sine', gainValue = 0.08, delay = 0) {
    if (muted) return;
    const c = ensureContext();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(c.destination);
    const startTime = c.currentTime + delay;
    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  return {
    setMuted(value) { muted = value; },
    isMuted() { return muted; },
    playDraw() { tone(320, 0.08, 'triangle'); },
    playReveal() { tone(440, 0.1, 'sine'); tone(660, 0.12, 'sine', 0.06, 0.08); },
    playPoints() { tone(523, 0.08, 'square', 0.05); tone(659, 0.1, 'square', 0.05, 0.07); },
    playWin() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.07, i * 0.12));
    },
    playClick() { tone(200, 0.05, 'square', 0.04); },
    playError() { tone(150, 0.15, 'sawtooth', 0.06); }
  };
})();
