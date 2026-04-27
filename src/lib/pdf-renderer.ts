// Server-only: render PDF pages to PNG images.
// Uses pdftoppm (poppler-utils) as primary — best Arabic/font support.
// Falls back to ghostscript, then pdfjs+canvas as last resort.
import 'server-only';
import path from 'path';
import os from 'os';
import { readFile, unlink, readdir } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// "bookId:pageNum" → PNG buffer
const pageCache = new Map<string, Buffer>();
// bookId → total page count
const countCache = new Map<string, number>();

// ── pdftoppm (poppler-utils) ───────────────────────────────────────────────────
async function renderWithPdftoppm(pdfPath: string, pageNum: number): Promise<Buffer> {
  const prefix = path.join(os.tmpdir(), `ml-${Date.now()}-${pageNum}`);
  try {
    await execFileAsync('pdftoppm', [
      '-r', '180',
      '-png',
      '-f', String(pageNum),
      '-l', String(pageNum),
      pdfPath,
      prefix,
    ], { timeout: 30000 });

    // pdftoppm names output files like: prefix-000001.png
    const dir = path.dirname(prefix);
    const base = path.basename(prefix);
    const files = await readdir(dir);
    const match = files.find(f => f.startsWith(base) && f.endsWith('.png'));
    if (!match) throw new Error('pdftoppm output file not found');
    const buffer = await readFile(path.join(dir, match));
    await unlink(path.join(dir, match)).catch(() => {});
    return buffer;
  } catch (err) {
    // Clean up any partial files
    try {
      const dir = path.dirname(prefix);
      const base = path.basename(prefix);
      const files = await readdir(dir);
      await Promise.all(files.filter(f => f.startsWith(base)).map(f => unlink(path.join(dir, f)).catch(() => {})));
    } catch {}
    throw err;
  }
}

// ── Ghostscript fallback ───────────────────────────────────────────────────────
async function renderWithGhostscript(pdfPath: string, pageNum: number): Promise<Buffer> {
  const outputFile = path.join(os.tmpdir(), `ml-gs-${Date.now()}-${pageNum}.png`);
  try {
    await execFileAsync('gs', [
      '-dNOPAUSE', '-dBATCH', '-dSAFER',
      '-sDEVICE=pngalpha',
      '-r180',
      `-dFirstPage=${pageNum}`,
      `-dLastPage=${pageNum}`,
      `-sOutputFile=${outputFile}`,
      pdfPath,
    ], { timeout: 30000 });
    return await readFile(outputFile);
  } finally {
    await unlink(outputFile).catch(() => {});
  }
}

// ── pdfjs + @napi-rs/canvas (last resort) ─────────────────────────────────────
async function renderWithPdfjs(pdfPath: string, pageNum: number): Promise<Buffer> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fileBuffer = await readFile(pdfPath);
  const data = new Uint8Array(fileBuffer);

  const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

  const cMapUrl = `file://${path.join(process.cwd(), 'node_modules/pdfjs-dist/cmaps')}/`;
  const standardFontDataUrl = `file://${path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts')}/`;

  const pdf = await pdfjsLib.getDocument({ data, cMapUrl, cMapPacked: true, standardFontDataUrl }).promise;
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

// ── Page count helpers ─────────────────────────────────────────────────────────
async function countWithPdftoppm(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync('pdfinfo', [pdfPath], { timeout: 10000 });
  const match = stdout.match(/Pages:\s+(\d+)/);
  if (!match) throw new Error('pdfinfo: could not parse page count');
  return parseInt(match[1], 10);
}

async function countWithGhostscript(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync('gs', [
    '-dNOPAUSE', '-dBATCH', '-dSAFER', '-dNODISPLAY',
    '-c', `(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit`,
  ], { timeout: 15000 });
  const count = parseInt(stdout.trim(), 10);
  if (isNaN(count) || count < 1) throw new Error('gs page count failed');
  return count;
}

async function countWithPdfjs(pdfPath: string): Promise<number> {
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
export async function renderPdfPage(bookId: string, bookFilePath: string, pageNum: number): Promise<Buffer> {
  const cacheKey = `${bookId}:${pageNum}`;
  const cached = pageCache.get(cacheKey);
  if (cached) return cached;

  const fullPath = path.join(process.cwd(), 'private', 'books', bookFilePath);

  let buffer: Buffer;
  try {
    buffer = await renderWithPdftoppm(fullPath, pageNum);
  } catch (e1) {
    console.warn('[pdf-renderer] pdftoppm failed:', (e1 as Error).message, '— trying gs');
    try {
      buffer = await renderWithGhostscript(fullPath, pageNum);
    } catch (e2) {
      console.warn('[pdf-renderer] gs failed:', (e2 as Error).message, '— falling back to pdfjs');
      buffer = await renderWithPdfjs(fullPath, pageNum);
    }
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
    count = await countWithPdftoppm(fullPath);
  } catch {
    try {
      count = await countWithGhostscript(fullPath);
    } catch {
      count = await countWithPdfjs(fullPath);
    }
  }

  countCache.set(bookId, count);
  return count;
}
