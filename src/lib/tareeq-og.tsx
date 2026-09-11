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
export function RtlText({
  text,
  gap,
  wrap = true,
  style,
}: {
  text: string;
  gap: number;
  wrap?: boolean;
  style?: React.CSSProperties;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row-reverse',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        alignItems: 'baseline',
        ...style,
      }}
    >
      {words.map((w, i) => (
        <span key={i} style={{ paddingLeft: `${gap / 2}px`, paddingRight: `${gap / 2}px` }}>{w}</span>
      ))}
    </div>
  );
}

export type OgPost = {
  title: string;
  author?: string | null;
  category?: string | null;
};

export function buildOgTree({ title, author, category }: OgPost) {
  const cat = CATEGORY_AR[category ?? ''] ?? '';
  const clean = title.replace(/\s+/g, ' ').trim() || 'علامة في طريق';

  // Only the type size is chosen from the length; how many lines that takes is yoga's
  // problem, and the card has room for four at the smallest size.
  const head = clean.length <= 160 ? clean : `${clean.slice(0, 159).trimEnd()}…`;
  const fontSize = head.length <= 42 ? 64 : head.length <= 90 ? 50 : 42;

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

        <RtlText
          text={head}
          gap={Math.round(fontSize * 0.3)}
          style={{ width: '100%', fontSize, lineHeight: 1.5, color: '#1a1a2a' }}
        />

        <div style={{ display: 'flex', flexDirection: 'row-reverse', width: '100%', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {author ? (
            <RtlText text={author} gap={10} wrap={false} style={{ fontSize: 30, color: '#7c7a8c' }} />
          ) : <div style={{ display: 'flex' }} />}
          <RtlText text="طريق — مسلم ليدر" gap={10} wrap={false} style={{ fontSize: 28, color: '#ff5c38' }} />
        </div>
      </div>
    </div>
  );
}
