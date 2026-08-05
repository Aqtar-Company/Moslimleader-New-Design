'use client';

/**
 * Client-side image compression using the Canvas API.
 * Resizes and re-encodes as JPEG/WebP before upload.
 */
export async function compressImage(
  file: File,
  opts: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = opts;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Downscale if larger than max
      const ratio = Math.min(1, maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP; fall back to JPEG
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, mimeType === 'image/png' ? '.png' : '.jpg'), { type: mimeType });
          // Only use compressed if actually smaller
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
