import 'server-only';
import { createCanvas, loadImage } from '@napi-rs/canvas';

export async function burnWatermark(
  pngBuffer: Buffer,
  lines: string[],
): Promise<Buffer> {
  const img = await loadImage(pngBuffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const fontSize = Math.max(16, Math.floor(img.width / 38));
  const lineHeight = Math.floor(fontSize * 1.6);

  ctx.save();
  ctx.translate(img.width / 2, img.height / 2);
  ctx.rotate(-Math.PI / 5);
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';

  const totalH = lines.length * lineHeight;
  lines.forEach((line, i) => {
    const y = -totalH / 2 + i * lineHeight + lineHeight / 2;
    ctx.fillText(line, 0, y);
  });

  ctx.restore();

  return canvas.toBuffer('image/png') as Buffer;
}
