/**
 * The layout of the Tareeq link-preview card (`/api/tareeq/[id]/og`).
 *
 * It lives outside the route for one reason: it can be rendered from a plain script and
 * *looked at*. The version this replaced was an SVG with `<text font-family="Cairo">`, and
 * Facebook rasterises SVG without our webfont, so every Arabic title arrived as a row of
 * hex boxes. Nothing in the code said so — only the picture did.
 *
 * ## Why the words are reversed by hand
 *
 * satori (what `next/og` renders with) shapes Arabic correctly — letters join, and the
 * forms are right. What it does NOT implement is the bidi reordering half of Unicode: it
 * lays runs out in logical order, left to right, and `direction: 'rtl'` changes nothing
 * (verified — all three variants rendered identically). So a title comes out with its
 * words in reverse reading order, which looks like fluent Arabic until you actually read
 * it. `flexDirection: 'row-reverse'` over one span per word is the fix: each word is still
 * a single shaped run, and yoga places the first word rightmost.
 *
 * Line breaking is left to yoga: `flexWrap` on that same `row-reverse` row fills from the
 * right and wraps downward, which is RTL flow exactly. An earlier version wrapped by
 * counting characters, and the count was wrong in the direction that clips — satori
 * measured a 46-character line ~25% wider than the font's own advance widths predicted,
 * so the last word of every long title ran off the left edge.
 *
 * That also means no glyph may be relied on beyond what Cairo ships — `★` was tofu in the
 * old card, and would be again.
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'og', 'Cairo-Bold.ttf');

let fontCache: Buffer | null = null;

/** Cairo Bold, read once per process. Returns null if the file is missing on the server. */
export function loadOgFont(): Buffer | null {
  if (fontCache) return fontCache;
  try {
    fontCache = fs.readFileSync(FONT_PATH);
    return fontCache;
  } catch {
    // satori throws without a font, so callers redirect to a static logo instead.
    return null;
  }
}

/**
 * A file under `public/` as a data URI, or null if it is not on disk.
 *
 * satori fetches a remote `<img src>` at render time, and a failed fetch is only a log
 * line — the image silently vanishes from the card. Same lesson as the invoice PDF.
 */
export function publicAssetDataUri(relPath: string, mime: string): string | null {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', relPath));
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export const CATEGORY_AR: Record<string, string> = {
  experience: 'تجربة', story: 'قصة', idea: 'فكرة',
  question: 'سؤال', project: 'مشروع', reflection: 'تأمل',
};

/**
 * A block of Arabic, laid out right-to-left and wrapped by the layout engine.
 *
 * Word spacing is padding on each word, not a space character and not `gap`: a space glyph
 * is resolved in whatever font satori picks for it and measured unevenly, and `gap` on a
 * `row-reverse` row was dropped between some pairs outright, fusing words
 * ("تجربتيمع", "الفاشلةوالدروس").
 */
/**
 * The direction of a run, from its first strong character — the same rule Unicode's bidi
 * algorithm uses for a paragraph. `RtlText` used to reverse every string it was given,
 * which is right for Arabic and exactly wrong for a Latin one: an author called
 * «Marwa Ali» came out on the card as «Ali Marwa». A run that begins with a Latin letter
 * is laid out left to right; only a run that begins with Arabic is reversed.
 */
function isRtlRun(text: string): boolean {
  const m = /[A-Za-z؀-ۿݐ-ݿࢠ-ࣿ]/.exec(text);
  return !m || m[0] >= '؀';
}

// ASCII/Latin punctuation only. The Arabic marks ، ؛ ؟ are Arabic-script characters and
// satori already draws them on the right-to-left side of their word — moving them too put
// «فيه،» back to front. Verified by rendering both ways.
const LEADING_PUNCT = /^[«“"'(\[{]+/;
const TRAILING_PUNCT = /[.,:;!?…»”"')\]}]+$/;
const MIRROR: Record<string, string> = { '«': '»', '»': '«', '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '“': '”', '”': '“', '‹': '›', '›': '‹' };
const mirror = (s: string) => s.split('').reverse().map(c => MIRROR[c] ?? c).join('');

/**
 * Splits on whitespace — the one tokenisation both `RtlText` and its measurer must share —
 * and, for an Arabic run, puts each word's punctuation where a right-to-left reader expects
 * it.
 *
 * satori draws every token in logical order, left to right, with no bidi. For the letters
 * that is fine (they are shaped, and `row-reverse` orders the words). For punctuation it is
 * exactly wrong: «الله:» came out as «:الله» with the colon on the RIGHT, and «‹‹لا» with
 * the opening quote on the left of the word and un-mirrored. So trailing punctuation is
 * moved to the FRONT of the token and leading punctuation to its END, each mirrored where
 * Unicode mirrors it — then satori's left-to-right drawing lands every mark on the side an
 * Arabic reader looks for it. A Latin run is left alone.
 */
export function ogWords(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!isRtlRun(text)) return words;
  return words.map(w => {
    const lead = LEADING_PUNCT.exec(w)?.[0] ?? '';
    const rest = w.slice(lead.length);
    const trail = TRAILING_PUNCT.exec(rest)?.[0] ?? '';
    const core = rest.slice(0, rest.length - trail.length);
    if (!core) return w;                       // a token that is only punctuation
    return mirror(trail) + core + mirror(lead);
  });
}

export function RtlText({
  text,
  gap,
  wrap = true,
  style,
  widths,
}: {
  text: string;
  gap: number;
  wrap?: boolean;
  style?: React.CSSProperties;
  /**
   * Shaped width of each word from `measureWords`, in px. When given, each word's box is
   * pinned to it and satori's own (over-wide) measurement no longer decides the spacing —
   * see `tareeq-og-measure.ts`. Without it the words fall back to padding, and the card
   * comes out with the old gaps rather than not at all.
   */
  widths?: number[] | null;
}) {
  const words = ogWords(text);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isRtlRun(text) ? 'row-reverse' : 'row',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        alignItems: 'baseline',
        ...style,
      }}
    >
      {words.map((w, i) =>
        widths && widths[i] != null ? (
          <div
            key={i}
            style={{
              display: 'flex',
              width: `${widths[i] + gap}px`,
              flexShrink: 0,
              justifyContent: 'flex-start',
              paddingLeft: `${gap / 2}px`,
              whiteSpace: 'nowrap',
              overflow: 'visible',
            }}
          >
            {w}
          </div>
        ) : (
          <span key={i} style={{ paddingLeft: `${gap / 2}px`, paddingRight: `${gap / 2}px` }}>{w}</span>
        ),
      )}
    </div>
  );
}

export type OgPost = {
  title: string;
  /**
   * The opening of the body, drawn under the title. A text post IS its text; a card that
   * carries only the title tells the reader nothing about what they would open, and the
   * ask was for the share to read as the post itself, not a headline.
   */
  excerpt?: string | null;
  author?: string | null;
  category?: string | null;
};

/** Cuts to at most `max` characters at a word boundary, with an ellipsis. */
function cutAtWord(text: string, max: number): string {
  const head = text.slice(0, max);
  const lastSpace = head.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? head.slice(0, lastSpace) : head).trimEnd() + '…';
}

const FOOTER = 'طريق — مسلم ليدر';

/**
 * Async because the words are measured with HarfBuzz first (see `tareeq-og-measure.ts`).
 * A failed or missing shaper yields `null` widths and the card falls back to satori's own
 * spacing — wide, but a card.
 */
export async function buildOgTree({ title, excerpt, author, category }: OgPost) {
  const { measureWords } = await import('./tareeq-og-measure');
  const cat = CATEGORY_AR[category ?? ''] ?? '';
  const clean = title.replace(/\s+/g, ' ').trim() || 'علامة في طريق';
  const body = (excerpt ?? '').replace(/\s+/g, ' ').trim();
  // The body is shown only when it adds something: a post with no title already puts its
  // opening in the title slot, and repeating it underneath would be the same words twice.
  const excerptText = body && body !== clean && !clean.startsWith(body.slice(0, 40))
    ? (body.length <= 180 ? body : cutAtWord(body, 179))
    : '';

  // Only the type size is chosen from the length; how many lines that takes is yoga's
  // problem, and the card has room for four at the smallest size.
  // At a word boundary. `slice(0, 159)` ended the live card in the middle of a word —
  // «...تف», the first two letters of «تفاصيل» — and in Arabic a half-word is frequently a
  // different word, not just an ugly one.
  const head = clean.length <= 160 ? clean : cutAtWord(clean, 159);
  // With a body underneath, the title gives up its largest size so both fit.
  const fontSize = excerptText
    ? (head.length <= 42 ? 52 : head.length <= 90 ? 44 : 38)
    : (head.length <= 42 ? 64 : head.length <= 90 ? 50 : 42);
  const EXCERPT_PX = 32, AUTHOR_PX = 30, FOOTER_PX = 28;

  const [titleW, excerptW, authorW, footerW] = await Promise.all([
    measureWords(ogWords(head), fontSize),
    excerptText ? measureWords(ogWords(excerptText), EXCERPT_PX) : Promise.resolve(null),
    author ? measureWords(ogWords(author), AUTHOR_PX) : Promise.resolve(null),
    measureWords(ogWords(FOOTER), FOOTER_PX),
  ]);

  return (
    <div
      style={{
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        background: '#f9f7f5',
        fontFamily: 'Cairo',
        position: 'relative',
      }}
    >
      {/* Accent rule along the top edge. */}
      <div style={{ display: 'flex', width: '100%', height: '10px', background: 'linear-gradient(90deg,#ff7857,#ff3d1a)' }} />

      {/* A soft disc instead of the old ★ — Cairo has no star glyph, and a missing glyph
          in a card this size is the whole card. */}
      <div
        style={{
          position: 'absolute', top: '150px', left: '-120px',
          width: '460px', height: '460px', borderRadius: '460px',
          background: '#ff5c38', opacity: 0.06, display: 'flex',
        }}
      />

      <div
        style={{
          display: 'flex', flexDirection: 'column', flex: 1,
          padding: '56px 80px 48px', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row-reverse', width: '100%' }}>
          {cat ? (
            <div
              style={{
                display: 'flex', padding: '10px 28px', borderRadius: '999px',
                background: 'rgba(255,92,56,0.14)', color: '#d8330f',
                fontSize: 28, lineHeight: 1.1,
              }}
            >
              {cat}
            </div>
          ) : null}
        </div>

        {/* `overflow: hidden` on the text block, `flexShrink: 0` on the footer: a long body
            used to push the author and the footer clean off the bottom of the card. */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0, overflow: 'hidden', justifyContent: 'center' }}>
          <RtlText
            text={head}
            gap={Math.round(fontSize * 0.3)}
            widths={titleW}
            style={{ width: '100%', fontSize, lineHeight: 1.5, color: '#1a1a2a' }}
          />
          {excerptText ? (
            <RtlText
              text={excerptText}
              gap={10}
              widths={excerptW}
              style={{ width: '100%', fontSize: EXCERPT_PX, lineHeight: 1.6, color: '#4a4858', marginTop: '18px' }}
            />
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'row-reverse', width: '100%', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0, marginTop: '16px' }}>
          {author ? (
            <RtlText text={author} gap={10} wrap={false} widths={authorW} style={{ fontSize: AUTHOR_PX, color: '#7c7a8c' }} />
          ) : <div style={{ display: 'flex' }} />}
          <RtlText text={FOOTER} gap={10} wrap={false} widths={footerW} style={{ fontSize: FOOTER_PX, color: '#ff5c38' }} />
        </div>
      </div>
    </div>
  );
}
