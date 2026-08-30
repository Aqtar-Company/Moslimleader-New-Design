// Loads QCF4 font files on demand and caches the FontFace so repeat pages
// that share a font (each file covers ~13 pages) don't reload it.

const _loaded = new Map<string, Promise<void>>();

export function loadQcfFont(family: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();

  const existing = _loaded.get(family);
  if (existing) return existing;

  const already = [...document.fonts].find(f => f.family === family);
  if (already) {
    const p = already.status === 'loaded' ? Promise.resolve() : already.loaded.then(() => undefined);
    _loaded.set(family, p);
    return p;
  }

  const face = new FontFace(family, `url('/fonts/qcf4/${family}.woff2') format('woff2')`);
  document.fonts.add(face);
  const p = face.load().then(() => undefined).catch(() => undefined);
  _loaded.set(family, p);
  return p;
}

export const QBSML_FONT = 'QCF4_QBSML';
