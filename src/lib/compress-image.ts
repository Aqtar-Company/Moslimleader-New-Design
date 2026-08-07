'use client';

export async function compressImage(
  file: File,
  opts: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = opts;

  // HEIC/HEIF — canvas cannot render these on most browsers; upload original
  const lowerName = file.name.toLowerCase();
  if (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif')
  ) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      const ratio = Math.min(1, maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, width, height);

      // Detect blank canvas — drawImage silently fails on some mobile devices
      // (e.g. HEIC decoded by the browser but not drawable, or large iPhone photos
      // that exceed GPU memory). Sample a small patch: if every R/G/B channel is 0
      // the frame wasn't drawn and we fall back to the original file.
      try {
        const sampleW = Math.min(32, width);
        const sampleH = Math.min(32, height);
        const sample = ctx.getImageData(0, 0, sampleW, sampleH);
        const hasContent = sample.data.some((v, i) => i % 4 !== 3 && v !== 0);
        if (!hasContent) { resolve(file); return; }
      } catch {
        // getImageData can throw on tainted canvas — just continue
      }

      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, mimeType === 'image/png' ? '.png' : '.jpg'),
            { type: mimeType },
          );
          resolve(compressed.size < file.size ? compressed : file);
        },
        mimeType,
        quality,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
