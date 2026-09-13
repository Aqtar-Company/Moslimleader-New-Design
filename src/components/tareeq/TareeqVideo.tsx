'use client';

/**
 * The shared `<video>` for Tareeq.
 *
 * It used to seek past the end on `loadedmetadata` to force the browser to work out the
 * duration of a `MediaRecorder` file, which reports `Infinity`. That fixed the scrubber
 * and **broke the picture**: those files carry no Cues index, so after a seek to the end
 * the demuxer cannot find a keyframe again — the clock advanced while the image sat
 * frozen. A working picture with a bad scrubber is far better than the reverse, so the
 * seek is gone.
 *
 * The duration is written into the file at encode time instead
 * (`writeWebmDuration` in src/lib/tareeq-video-compress.ts), which is where it belongs:
 * nothing has to be recovered at playback, and seeking means something afterwards.
 *
 * Kept as a component rather than reverting to plain `<video>` so there is one place to
 * change if every player needs something again.
 */
export default function TareeqVideo(props: React.VideoHTMLAttributes<HTMLVideoElement>) {
  /* eslint-disable-next-line jsx-a11y/media-has-caption */
  return <video {...props} />;
}
