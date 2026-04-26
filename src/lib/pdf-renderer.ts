// Server-only: render PDF pages to PNG using ghostscript (primary) or pdfjs fallback.
// ghostscript handles Arabic/embedded fonts correctly; pdfjs may show boxes for non-Latin text.
import 'server-only';
import path from 'path';
import os from 'os';
import { readFile, unlink } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// "bookId:pageNum" → PNG buffer
const pageCache = new Map<string, Buffer>();
// bookId → total page count
const countCache = new Map<string, number>();

// ── Ghostscript renderer (most reliable for Arabic/embedded fonts) ─────────────
async function renderWithGhostscript(pdfPath: string, pageNum: number): Promise<Buffer> {
  const outputFile = path.join(os.tmpdir(), `ml-${Date.now()}-${pageNum}.png`);
  try {
    await execFileAsync('gs', [
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-sDEVICE=pngalpha',
      '-r180',
      `-dFirstPage=${pageNum}`,
      `-dLastPage=${pageNum}`,
      `-sOutputFile=${outputFile}`,
      pdfPath,
    ], { timeout: 30000 });
    return await readFile(outputFile);
  } finally {
    try { await unlink(outputFile); } catch {}
  }
}

// ── pdfjs + @napi-rs/canvas fallback ──────────────────────────────────────────
async function renderWithPdfjs(pdfPath: string, pageNum: number): Promise<Buffer> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fileBuffer = await readFile(pdfPath);
  const data = new Uint8Array(fileBuffer);

  const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

  const cMapUrl = `file://${path.join(process.cwd(), 'node_modules/pdfjs-dist/cmaps')}/`;
  const standardFontDataUrl = `file://${path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts')}/`;

  const pdf = await pdfjsLib.getDocument({
    data,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    disableFontFace: false,
    useSystemFonts: true,
  }).promise;

  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });

  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({ canvasContext: context, viewport }).promise;

  const buffer: Buffer = canvas.toBuffer('image/png');
  await pdf.destroy();
  return buffer;
}

// ── Page count via ghostscript ─────────────────────────────────────────────────
async function getPageCountWithGhostscript(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync('gs', [
    '-dNOPAUSE', '-dBATCH', '-dSAFER', '-dNODISPLAY',
    '-c', `(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit`,
  ], { timeout: 15000 });
  const count = parseInt(stdout.trim(), 10);
  if (isNaN(count) || count < 1) throw new Error('gs page count failed');
  return count;
}

async function getPageCountWithPdfjs(pdfPath: string): Promise<number> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fileBuffer = await readFile(pdfPath);
  const data = new Uint8Array(fileBuffer);
  const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const count = pdf.numPages;
  await pdf.destroy();
  return count;
}

// ── Public API ─────────────────────────────────────────────────────────────────
export async function renderPdfPage(
  bookId: string,
  bookFilePath: string,
  pageNum: number,
): Promise<Buffer> {
  const cacheKey = `${bookId}:${pageNum}`;
  const cached = pageCache.get(cacheKey);
  if (cached) return cached;

  const fullPath = path.join(process.cwd(), 'private', 'books', bookFilePath);

  let buffer: Buffer;
  try {
    buffer = await renderWithGhostscript(fullPath, pageNum);
  } catch (err) {
    console.warn('[pdf-renderer] ghostscript failed, falling back to pdfjs:', (err as Error).message);
    buffer = await renderWithPdfjs(fullPath, pageNum);
  }

  pageCache.set(cacheKey, buffer);
  return buffer;
}

export async function getPdfPageCount(bookId: string, bookFilePath: string): Promise<number> {
  const cached = countCache.get(bookId);
  if (cached !== undefined) return cached;

  const fullPath = path.join(process.cwd(), 'private', 'books', bookFilePath);

  let count: number;
  try {
    count = await getPageCountWithGhostscript(fullPath);
  } catch {
    count = await getPageCountWithPdfjs(fullPath);
  }

  countCache.set(bookId, count);
  return count;
}
