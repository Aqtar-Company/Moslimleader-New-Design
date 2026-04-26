// Server-only: render PDF pages to PNG images using pdfjs-dist + @napi-rs/canvas.
// Pages are cached in memory after first render so navigation is fast.
import 'server-only';
import path from 'path';
import { readFile } from 'fs/promises';

// "bookId:pageNum" → PNG buffer
const pageCache = new Map<string, Buffer>();
// bookId → total page count
const countCache = new Map<string, number>();

async function loadPdf(filePath: string) {
  // Dynamic import required — pdfjs-dist v5 is ESM-only (.mjs)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fileBuffer = await readFile(filePath);
  const data = new Uint8Array(fileBuffer);
  // Point to the actual worker file so pdfjs can set up its fake-worker correctly in Node.js
  const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
  return pdfjsLib.getDocument({ data, disableFontFace: false }).promise;
}

export async function renderPdfPage(
  bookId: string,
  bookFilePath: string,
  pageNum: number,
  scale = 2.0,
): Promise<Buffer> {
  const cacheKey = `${bookId}:${pageNum}`;
  const cached = pageCache.get(cacheKey);
  if (cached) return cached;

  const fullPath = path.join(process.cwd(), 'private', 'books', bookFilePath);
  const pdf = await loadPdf(fullPath);

  if (pageNum < 1 || pageNum > pdf.numPages) {
    throw new Error(`Page ${pageNum} out of range (1–${pdf.numPages})`);
  }

  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({ canvasContext: context, viewport }).promise;

  const buffer: Buffer = canvas.toBuffer('image/png');
  pageCache.set(cacheKey, buffer);

  await pdf.destroy();
  return buffer;
}

export async function getPdfPageCount(bookId: string, bookFilePath: string): Promise<number> {
  const cached = countCache.get(bookId);
  if (cached !== undefined) return cached;

  const fullPath = path.join(process.cwd(), 'private', 'books', bookFilePath);
  const pdf = await loadPdf(fullPath);
  const count: number = pdf.numPages;
  countCache.set(bookId, count);
  await pdf.destroy();
  return count;
}
