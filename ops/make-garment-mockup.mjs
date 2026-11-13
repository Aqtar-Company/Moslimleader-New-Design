#!/usr/bin/env node
/**
 * Turns a photo of a DARK garment on a light background into the two layers /logo uses to
 * show that garment in ANY colour (src/app/logo/LogoStudio.tsx):
 *
 *   <name>-mask.webp  — white where the garment is, transparent elsewhere (CSS mask for the
 *                       colour fill);
 *   <name>-shade.webp — the garment's folds and light as a grey map centred on mid-grey,
 *                       laid over the colour with `mix-blend-mode: hard-light`, so mid-grey
 *                       leaves the colour as it is, darker greys fold it, lighter ones light it.
 *
 * The background is found by flooding from the image's edges through light pixels, so light
 * spots INSIDE the garment (a label, the eyelets of a hoodie) stay part of it. A painted
 * checkerboard «transparency» is light too, so it is removed the same way.
 *
 *   node ops/make-garment-mockup.mjs <photo> <name> [width=900] [holeMax]
 *
 * `holeMax`: a light area ENCLOSED by the garment larger than this many pixels is background
 * too (the gap between a sleeve and the body); smaller ones stay part of the garment (eyelets,
 * a label). Unset, every enclosed area stays. Used: hoodie 200 (eyelets ~100 px, sleeve gaps
 * ~400 px); tee unset (its neck label is ~650 px and there are no gaps).
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const [, , src, name, widthArg, holeArg] = process.argv;
if (!src || !name) { console.error('usage: node ops/make-garment-mockup.mjs <photo> <name> [width]'); process.exit(1); }
const WIDTH = Number(widthArg) || 900;
const HOLE_MAX = Number(holeArg) || 0;
const LIGHT = 110;   // a pixel brighter than this, reachable from the edge, is background
// How strongly the photo shows through. Light and shadow are scaled separately: the
// owner found full-strength highlights («لسعات إضاءة») washed the colour out, so highlights
// are kept soft and capped, while the shadows that give the folds their shape stay clearer.
const SHADOW_GAIN = 2.2;
const LIGHT_GAIN = 1.1;
const LIGHT_CAP = 158;   // 128 = the colour itself; a little above it is a soft sheen

const { data: L, info } = await sharp(src).flatten({ background: '#fff' }).resize({ width: WIDTH, withoutEnlargement: true })
  .greyscale().median(3).raw().toBuffer({ resolveWithObject: true });  // median: the gain below would magnify the photo's grain
const W = info.width, H = info.height, N = W * H;

// Flood fill the background from every edge pixel.
const bg = new Uint8Array(N);
const stack = [];
const push = (i) => { if (!bg[i] && L[i] > LIGHT) { bg[i] = 1; stack.push(i); } };
for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
while (stack.length) {
  const i = stack.pop(); const x = i % W, y = (i - x) / W;
  if (x > 0) push(i - 1); if (x < W - 1) push(i + 1);
  if (y > 0) push(i - W); if (y < H - 1) push(i + W);
}

// Large enclosed light areas are background as well (see holeMax).
if (HOLE_MAX > 0) {
  const seen = new Uint8Array(N);
  for (let s0 = 0; s0 < N; s0++) {
    if (bg[s0] || seen[s0] || L[s0] <= LIGHT) continue;
    const region = [s0]; seen[s0] = 1;
    for (let k = 0; k < region.length; k++) {
      const i = region[k]; const x = i % W, y = (i - x) / W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !bg[j] && !seen[j] && L[j] > LIGHT) { seen[j] = 1; region.push(j); }
      }
    }
    if (region.length > HOLE_MAX) for (const i of region) bg[i] = 1;
  }
}

// Shading: the garment's own brightness, centred on 128 at its median.
const vals = [];
for (let i = 0; i < N; i++) if (!bg[i]) vals.push(L[i]);
vals.sort((a, b) => a - b);
const median = vals[Math.floor(vals.length / 2)] ?? 20;
const shade = Buffer.alloc(N * 2);   // grey (the alpha comes from the blurred mask below)
for (let i = 0; i < N; i++) {
  const a = bg[i] ? 0 : 255;
  const d = L[i] - median;
  const v = d > 0 ? Math.min(LIGHT_CAP, 128 + d * LIGHT_GAIN) : 128 + d * SHADOW_GAIN;
  shade[i * 2] = Math.max(0, Math.min(255, Math.round(v)));
  shade[i * 2 + 1] = a;
}
// A slight blur on the alpha softens the stair-stepped edge of a hard mask.
// sharp may hand a blurred single-channel image back with three channels — read the first.
const blurred = await sharp(Buffer.from(Array.from({ length: N }, (_, i) => (bg[i] ? 0 : 255))), { raw: { width: W, height: H, channels: 1 } })
  .blur(0.7).raw().toBuffer({ resolveWithObject: true });
const alpha = Buffer.alloc(N);
for (let i = 0; i < N; i++) alpha[i] = blurred.data[i * blurred.info.channels];
const withAlpha = (grey) => {
  const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = grey[i]; out[i * 4 + 3] = alpha[i]; }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } });
};
// Crop both layers to the garment's own bounds (plus a small even margin), so its centre
// IS the image's centre: a garment photographed off-centre put the logo — centred on the
// image — visibly to one side of the chest.
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let i = 0; i < N; i++) if (!bg[i]) { const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const pad = Math.round((x1 - x0) * 0.02);
const crop = { left: Math.max(0, x0 - pad), top: Math.max(0, y0 - pad) };
crop.width = Math.min(W, x1 + pad + 1) - crop.left;
crop.height = Math.min(H, y1 + pad + 1) - crop.top;
// Keep the garment centred even where the margin hit the image edge on one side only.
const cx = (x0 + x1) / 2, half = Math.min(cx - crop.left, crop.left + crop.width - 1 - cx);
crop.left = Math.round(cx - half); crop.width = Math.round(half * 2) + 1;
const greyShade = Buffer.from(Array.from({ length: N }, (_, i) => shade[i * 2]));
const white = Buffer.alloc(N, 255);
const a = await withAlpha(white).extract(crop).webp({ quality: 90, alphaQuality: 100 }).toFile(`public/logo-mockups/${name}-mask.webp`);
const b = await withAlpha(greyShade).extract(crop).webp({ quality: 85, alphaQuality: 100 }).toFile(`public/logo-mockups/${name}-shade.webp`);
console.log(`${name}: ${crop.width}×${crop.height} (garment ${x0}-${x1} × ${y0}-${y1} of ${W}×${H}), median ${median}, mask ${Math.round(a.size / 1024)} KB, shade ${Math.round(b.size / 1024)} KB`);
