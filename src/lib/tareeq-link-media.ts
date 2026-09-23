/**
 * What kind of thing a link points at, so طريق can show it instead of describing it.
 *
 * The feed already embeds YouTube, TikTok, Vimeo and Facebook video, and draws a preview
 * card with a thumbnail for an ordinary page. Two kinds were missing, and both are links
 * to a FILE rather than to a page — so no amount of og: scraping helps them, because there
 * are no tags to scrape:
 *
 *  - **audio** — a recitation, a lecture, a voice note somebody hosts themselves. Posting
 *    one showed a bare URL. It can be a player instead.
 *  - **image** — a link straight to a .jpg. The preview card fetches the "page", finds no
 *    tags, and renders nothing at all.
 *
 * ## On autoplay
 *
 * Audio cannot start by itself, and this is not something code can work around: every
 * browser refuses to play sound until the person has interacted with the page, and the
 * refusal is the point of the rule rather than a bug in it. What a player does give is one
 * tap, in place, with no navigation — which is the part that was actually missing.
 */

export type LinkMediaKind = 'audio' | 'image' | null;

const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'weba'];
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'];

/**
 * The kind, from the path's extension only.
 *
 * Deliberately not from a HEAD request: that is a round trip per link, from the browser,
 * to a host we do not control, before anything can be drawn. The extension is right
 * essentially always for a direct file link, and when it is wrong the element's own error
 * handler is what notices — which is where that belongs.
 */
export function classifyLinkMedia(rawUrl: string): LinkMediaKind {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const ext = (u.pathname.split('.').pop() ?? '').toLowerCase();
  if (!ext || ext.length > 5) return null;
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (IMAGE_EXT.includes(ext)) return 'image';
  return null;
}

/** The first http(s) link in a piece of text, whatever it points at. */
export function firstUrlIn(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"'؀-ۿ]{8,}/);
  return m ? m[0] : null;
}
