/**
 * The picture a shared طريق post should carry when its media is a LINK to a video rather
 * than an upload — today, a YouTube link. Without it, a post that is «a video plus a line»
 * was shared to Facebook/WhatsApp as the generated TEXT card, and nobody could tell there
 * was a video behind it.
 *
 * YouTube serves every video's thumbnail at a fixed address, so no API call or fetch is
 * needed: `hqdefault.jpg` (480×360) exists for every public video; `maxresdefault` does
 * not, and a 404 og:image makes scrapers show nothing at all.
 *
 * Used by BOTH `src/app/tareeq/[id]/page.tsx` (generateMetadata) and the crawler preview
 * route `src/app/tareeq/[id]/preview/route.ts` — keep them choosing the same picture.
 */
const YT_RE = /(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function youTubeIdIn(text: string | null | undefined): string | null {
  const m = (text ?? '').match(YT_RE);
  return m ? m[1] : null;
}

export function linkedVideoThumb(text: string | null | undefined): string | null {
  const id = youTubeIdIn(text);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** Post text without its URLs — a title or description that is half a link reads badly. */
export function withoutUrls(text: string | null | undefined): string {
  return (text ?? '').replace(/https?:\/\/\S+/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}
