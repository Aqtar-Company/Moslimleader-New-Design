import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { AuthProvider } from '@/context/AuthContext';
import { RegionalPricingProvider } from '@/context/RegionalPricingContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AmeenChat from '@/components/AmeenChat';
import WhatsAppButton from '@/components/WhatsAppButton';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'مسلم ليدر | Moslim Leader',
  description: 'معاً نبني قادة الغد — منتجات تربوية وتعليمية للأطفال والأسرة',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="theme-color" content="#F5C518" />
        <meta name="msapplication-TileColor" content="#F5C518" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <LanguageProvider>
          <AuthProvider>
            <RegionalPricingProvider>
              <CartProvider>
                <WishlistProvider>
                  <ToastProvider>
                    <Header />
                    <main>{children}</main>
                    <Footer />
                    <AmeenChat />
                    <WhatsAppButton />
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
