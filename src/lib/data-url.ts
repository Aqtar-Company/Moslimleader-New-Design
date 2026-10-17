/**
 * Turn a `data:` URL into a Blob WITHOUT `fetch`.
 *
 * `await (await fetch(dataUrl)).blob()` is the common idiom, and on this site it fails:
 * the Content-Security-Policy in next.config.mjs lists no `data:` in `connect-src`, so the
 * browser refuses the fetch. Every caller of that idiom was therefore broken — the
 * composer's automatic video cover and its «اختر غلافاً من الفيديو» frames (the upload
 * failed and said «تعذّر رفع الغلاف»), the cover picker when editing a post, and the
 * share-as-image button on an ayah card. Decoding locally needs no permission at all.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma === -1) throw new Error('not a data URL');
  const meta = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const isBase64 = /;base64$/i.test(meta);
  const type = meta.replace(/;base64$/i, '') || 'application/octet-stream';
  if (!isBase64) return new Blob([decodeURIComponent(payload)], { type });
  const bin = atob(payload);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
