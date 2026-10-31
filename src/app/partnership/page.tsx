import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';
import DeckRuntime from './DeckRuntime';

/**
 * /partnership — the partnership deck, inside the site's header and footer.
 *
 * The body is static HTML (deck.html) styled by deck.css, every rule scoped under `.sv`
 * so neither the site's styles nor this page's leak into each other. Behaviour lives in
 * deck-runtime.js, started by <DeckRuntime/>. The old address /strategic-vision.html
 * redirects here (next.config.mjs). Requests from its wizard go to
 * /api/partnership-requests.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'الشراكة مع مسلم ليدر | التصور الاستراتيجي 2026',
  description: 'مسلم ليدر تبني منظومة متكاملة للطفل المسلم وأسرته حول العالم وبكل لغة — أنواع التعاون، مراحل الشراكة، مسلم ليدر لاند، وطلب الشراكة.',
  alternates: { canonical: canonical('/partnership') },
  openGraph: {
    title: 'الشراكة مع مسلم ليدر',
    description: 'منظومة الطفل المسلم حول العالم — قدّم طلب الشراكة.',
    url: canonical('/partnership'),
    images: ['/partnership/land-stories.webp'],
    type: 'website',
    locale: 'ar_EG',
  },
};

const dir = path.join(process.cwd(), 'src/app/partnership');
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

export default function PartnershipPage() {
  const html = read('deck.html');
  const css = read('deck.css');
  return (
    <div className="sv" dir="rtl" lang="ar">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@600;700;800&display=swap" />
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <DeckRuntime />
    </div>
  );
}
