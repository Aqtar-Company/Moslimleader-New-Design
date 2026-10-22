/**
 * Measure an audio file's waveform in the browser: `bars` peaks, each 0–100.
 *
 * Done once, in the ADMIN's browser at upload, and stored — so a listener's phone never
 * downloads and decodes a whole recording just to draw its shape. Decoding is into a mono
 * 8 kHz context: plenty for a picture of loudness, and a tenth of the memory of the
 * file's own rate. Files over 60 MB are skipped (the page then draws plain bars).
 */
export async function computeWaveform(data: Blob | ArrayBuffer, bars = 120): Promise<number[] | null> {
  try {
    const buf = data instanceof Blob ? await data.arrayBuffer() : data;
    if (buf.byteLength > 60 * 1024 * 1024) return null;
    const Ctx = (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext);
    if (!Ctx) return null;
    const ctx = new Ctx(1, 1, 8000);
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const ch = audio.getChannelData(0);
    const per = Math.max(1, Math.floor(ch.length / bars));
    const peaks: number[] = [];
    for (let b = 0; b < bars; b++) {
      let max = 0;
      const end = Math.min(ch.length, (b + 1) * per);
      for (let i = b * per; i < end; i += 4) { const v = Math.abs(ch[i]); if (v > max) max = v; }
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.0001);
    // A floor of 6 so silence still draws a visible bar.
    return peaks.map(p => Math.max(6, Math.round((p / top) * 100)));
  } catch {
    return null;
  }
}
