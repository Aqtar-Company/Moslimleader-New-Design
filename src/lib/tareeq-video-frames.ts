/**
 * Pull `count` evenly spaced frames out of a video, as small JPEG data URLs.
 *
 * One copy for the two places that offer «اختر غلافاً من الفيديو»: the composer (a local
 * file, read through an object URL) and the editor of a published post (the stored file
 * on R2, read across origins).
 *
 * The cross-origin case needs `crossOrigin = 'anonymous'`, because a frame drawn from a
 * video the page may not read taints the canvas and `toDataURL` throws. That attribute
 * is a demand, not a preference: if the storage host does not answer with
 * `Access-Control-Allow-Origin`, the browser refuses to load the video at all. Either way
 * the promise resolves — with whatever frames it got, possibly none — and the caller
 * falls back to uploading an image. It never hangs: a 20-second guard ends it.
 */
export function captureVideoFrames(src: string, count: number, opts: { crossOrigin?: boolean } = {}): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve([]);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    if (opts.crossOrigin) video.crossOrigin = 'anonymous';
    const out: string[] = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      video.removeAttribute('src');
      try { video.load(); } catch { /* releasing only */ }
      resolve(out);
    };
    const guard = setTimeout(finish, 20_000);
    video.onerror = finish;
    video.onloadedmetadata = () => {
      const d = video.duration;
      if (!Number.isFinite(d) || d <= 0) return finish();
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 480 / Math.max(1, video.videoWidth));
      canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext('2d');
      let i = 0;
      const next = () => {
        if (i >= count || !ctx) return finish();
        // Centred in each slot, so the first frame is not a black lead-in and the last is
        // not the fade-out.
        video.currentTime = Math.min(d - 0.05, ((i + 0.5) / count) * d);
      };
      video.onseeked = () => {
        try {
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          out.push(canvas.toDataURL('image/jpeg', 0.72));
        } catch {
          // A tainted canvas (no CORS) fails on every frame alike — stop rather than seek
          // through the whole file for nothing.
          return finish();
        }
        i++;
        next();
      };
      next();
    };
    video.src = src;
  });
}
