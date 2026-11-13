import { prisma } from '@/lib/prisma';
import { r2KeyFromUrl, deleteFromR2 } from '@/lib/r2';

/**
 * «شعار مسلم ليدر للطباعة» — the /logo page: Moslim Leader designs anyone may download to
 * print on a t-shirt, try on different shirt colours, and send to a print shop on WhatsApp.
 * Designs and the page banner are managed at /admin/logo-designs (free-media permissions).
 *
 * Files live on R2 under `logo-designs/` (never in public/ — a file uploaded after the build
 * is not served from there; see CLAUDE.md). The print file is kept exactly as uploaded.
 */
export const LOGO_R2_PREFIX = 'logo-designs/';
export const LOGO_BANNER_KEY = 'logo-page-banner';
export const LOGO_MAX_BYTES = 40 * 1024 * 1024;

export type LogoBanner = { imageUrl: string | null; title: string; subtitle: string };
export const DEFAULT_BANNER: LogoBanner = {
  imageUrl: null,
  title: 'شعار مسلم ليدر للطباعة',
  subtitle: 'حمّل التصميم، جرّبه على لون التيشرت، وابعته للمطبعة على واتساب.',
};

export async function loadLogoBanner(): Promise<LogoBanner> {
  const row = await prisma.setting.findUnique({ where: { key: LOGO_BANNER_KEY } }).catch(() => null);
  const v = (row?.value ?? {}) as Partial<LogoBanner>;
  return {
    imageUrl: typeof v.imageUrl === 'string' && v.imageUrl ? v.imageUrl : null,
    title: typeof v.title === 'string' && v.title.trim() ? v.title.trim() : DEFAULT_BANNER.title,
    subtitle: typeof v.subtitle === 'string' ? v.subtitle.trim() : DEFAULT_BANNER.subtitle,
  };
}

/** What a client sees of a design (the admin list adds `isPublished`/`sortOrder`). */
export const PUBLIC_DESIGN_SELECT = {
  id: true, title: true, note: true, fileType: true, fileSize: true, width: true, height: true,
  previewUrl: true, fileUrl: true, downloads: true,
} as const;

/** The file's kind from its BYTES — never from its name. */
export function sniffDesign(b: Buffer): { ext: 'png' | 'jpg' | 'svg' | 'pdf' | 'webp'; contentType: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return { ext: 'png', contentType: 'image/png' };
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { ext: 'pdf', contentType: 'application/pdf' };
  if (b.length > 11 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { ext: 'webp', contentType: 'image/webp' };
  // SVG is text: an XML prolog or comment may come first, so look for the root element
  // in the first few KB. It is only ever shown through <img> (no scripts run there) and
  // served from R2's own host, never from this site's origin.
  const head = b.subarray(0, 4096).toString('utf8').replace(/^﻿/, '').trimStart();
  if (head.startsWith('<') && /<svg[\s>]/i.test(head)) return { ext: 'svg', contentType: 'image/svg+xml' };
  return null;
}

/** Remove a design's stored files. Best effort. */
export async function removeDesignFiles(urls: (string | null | undefined)[]): Promise<void> {
  const keys = Array.from(new Set(urls.map(u => r2KeyFromUrl(u)).filter((k): k is string => !!k && k.startsWith(LOGO_R2_PREFIX))));
  await Promise.all(keys.map(k => deleteFromR2(k)));
}

/** A safe ASCII file name for the download. */
export function downloadName(title: string, id: number, ext: string): string {
  const latin = title.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `moslim-leader-${latin || `design-${id}`}.${ext}`;
}
