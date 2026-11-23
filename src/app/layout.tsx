import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { AuthProvider } from '@/context/AuthContext';
import { RegionalPricingProvider } from '@/context/RegionalPricingContext';
import Header from '@/components/layout/Header';
import DeployReloadGuard from '@/components/DeployReloadGuard';
import Footer from '@/components/layout/Footer';
import AmeenChat from '@/components/AmeenChat';
import TypingFlag from '@/components/TypingFlag';
import NavProgress from '@/components/NavProgress';
import WhatsAppButton from '@/components/WhatsAppButton';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { serverLang, isEnglishUrl, serverPath } from '@/lib/server-lang';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';

const BASE_METADATA: Metadata = {
  // titleTemplate lets child pages set just their unique title and we
  // append the brand suffix automatically. The `default` is shown on
  // the root path (which currently provides its own metadata in
  // /page.tsx, so this default is mostly a safety fallback).
  title: {
    default: 'مسلم ليدر | Moslim Leader',
    template: '%s | مسلم ليدر',
  },
  description: 'معاً نبني قادة الغد — منتجات تربوية وتعليمية للأطفال والأسرة',
  // Absolute base URL for any metadata that uses relative paths
  // (OG images, alternates). Lets product/book pages emit relative
  // image paths and have Next.js resolve them correctly.
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: 'مسلم ليدر',
    locale: 'ar_EG',
    images: [{ url: `${SITE_URL}/ml-logo-new.png`, width: 512, height: 512, alt: 'مسلم ليدر' }],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
  other: {
    'theme-color': '#F5C518',
    'msapplication-TileColor': '#F5C518',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
};

/**
 * Canonical + hreflang for EVERY page, here, from the path the middleware passes on — so a
 * page never states them itself (a page-level `alternates` would replace these). The Arabic
 * URL and its /en twin each name themselves canonical and list each other; x-default is
 * the Arabic one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const path = serverPath();
  const en = isEnglishUrl();
  const ar = `${SITE_URL}${path === '/' ? '' : path}` || SITE_URL;
  const enUrl = `${SITE_URL}/en${path === '/' ? '' : path}`;
  return {
    ...BASE_METADATA,
    ...(serverLang() === 'en' ? {
      title: { default: 'Moslim Leader', template: '%s | Moslim Leader' },
      description: 'Raising tomorrow\'s leaders — Islamic books, games and learning products for children and families.',
    } : {}),
    alternates: {
      canonical: en ? enUrl : ar,
      languages: { ar, en: enUrl, 'x-default': ar },
    },
    openGraph: { ...BASE_METADATA.openGraph, locale: serverLang() === 'en' ? 'en_US' : 'ar_EG', alternateLocale: serverLang() === 'en' ? ['ar_EG'] : ['en_US'] },
  };
}

// Viewport meta: hint to mobile browsers that we'd rather have
// the viewport shrink than have a virtual keyboard overlay (so the
// Ameen chat input stays visible above the keyboard). viewport-fit
// also lets us reach the notch / home indicator on iPhones.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = serverLang();
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        <meta name="theme-color" content="#F5C518" />
        <meta name="msapplication-TileColor" content="#F5C518" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Cairo:wght@400;600;700;900&family=Inter:wght@400;600;700;900&family=Noto+Sans+Arabic:wght@400;600;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* Outside every provider on purpose: it must still work when a provider's own
            chunk is the one that failed to load. */}
        <DeployReloadGuard />
        <LanguageProvider initialLang={lang}>
          <AuthProvider>
            <RegionalPricingProvider>
              <CartProvider>
                <WishlistProvider>
                  <ToastProvider>
                    <ConfirmProvider>
                      <Header />
                      <main>{children}</main>
                      <Footer />
                      <AmeenChat />
                      <WhatsAppButton />
                      <TypingFlag />
                      <NavProgress />
                    </ConfirmProvider>
                  </ToastProvider>
                </WishlistProvider>
              </CartProvider>
            </RegionalPricingProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
