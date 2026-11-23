import { headers } from 'next/headers';

/**
 * The language a request is rendered in, on the server — set by src/middleware.ts:
 *   - /en/<path>            → 'en' (and the URL itself is the English edition)
 *   - cookie ml_lang=en|ar  → the visitor's own choice (written by LanguageContext)
 *   - nothing               → 'ar'
 * Read it in server components and generateMetadata; client components use useLang().
 */
export type SiteLang = 'ar' | 'en';

export function serverLang(): SiteLang {
  try { return headers().get('x-ml-lang') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; }
}

/** True when the URL is the /en edition (canonical and hreflang must point at /en). */
export function isEnglishUrl(): boolean {
  try { return headers().get('x-ml-en-url') === '1'; } catch { return false; }
}

/** The page's path without any /en prefix. */
export function serverPath(): string {
  try { return headers().get('x-ml-path') || '/'; } catch { return '/'; }
}
