/**
 * The width of a shaped Arabic word, for the share card.
 *
 * ## Why the card needs its own ruler
 *
 * satori measures a word by summing the advance widths of its letters in their ISOLATED
 * forms, and then draws the word shaped — letters joined, in their initial/medial/final
 * forms, which are narrower. The box it lays out is the isolated width; the ink it puts in
 * the box is the joined width; the difference is empty space after every word. That is the
 * "spread out" title that was reported: not justification, not a gap setting, but a ruler
 * that measures a different word from the one it draws. The excess is per word and per
 * letter shape (ط and ب lose a lot when joined, ا and ل almost nothing), so no constant
 * margin can undo it — it was tried, and over-corrected some words while leaving others.
 *
 * HarfBuzz is the shaper the browsers use. Shaping the word here and pinning the box to
 * that width makes satori's own measurement irrelevant: the box is the ink.
 *
 * The wasm is ~1.2 MB and is loaded once per process, on first use, and only by the card
 * routes. `harfbuzzjs` is listed in `serverComponentsExternalPackages` so webpack leaves it
 * to Node at runtime — the wasm does not survive bundling.
 */
import { loadOgFont } from './tareeq-og';

type Hb = typeof import('harfbuzzjs');
type Shaper = { hb: Hb; font: InstanceType<Hb['Font']>; upem: number };

let shaperPromise: Promise<Shaper | null> | null = null;

async function getShaper(): Promise<Shaper | null> {
  if (!shaperPromise) {
    shaperPromise = (async () => {
      const buf = loadOgFont();
      if (!buf) return null;
      try {
        const hb = await import('harfbuzzjs');
        const blob = new hb.Blob(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
        const face = new hb.Face(blob);
        const font = new hb.Font(face);
        return { hb, font, upem: face.upem };
      } catch (e) {
        // Without the shaper the card still renders — with satori's own spacing, which is
        // the state before this file existed, not a blank image.
        console.warn('[tareeq-og] harfbuzz unavailable, card falls back to padded words:', e instanceof Error ? e.message : e);
        return null;
      }
    })();
  }
  return shaperPromise;
}

/**
 * Shaped advance widths, in CSS px at `fontSize`, one per word — or null when the shaper
 * could not be loaded, which the caller treats as "lay out the old way".
 */
export async function measureWords(words: string[], fontSize: number): Promise<number[] | null> {
  const s = await getShaper();
  if (!s) return null;
  try {
    return words.map(w => {
      const b = new s.hb.Buffer();
      try {
        b.addText(w);
        b.guessSegmentProperties();
        s.hb.shape(s.font, b);
        const adv = b.getGlyphPositions().reduce((sum, p) => sum + p.xAdvance, 0);
        return Math.ceil((adv / s.upem) * fontSize);
      } finally {
        // Free the wasm-side buffer now rather than when the GC gets round to it: a
        // scraper burst renders dozens of cards a minute, each with tens of words.
        (b as unknown as { destroy?: () => void }).destroy?.();
      }
    });
  } catch (e) {
    // One pathological string must cost the old spacing, not a 500 for that card.
    console.warn('[tareeq-og] shaping failed, card falls back to padded words:', e instanceof Error ? e.message : e);
    return null;
  }
}
