'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';

export default function Footer() {
  const { t } = useLang();

  const navLinks = [
    { href: '/', label: t('nav.shop') },
    { href: '/about', label: t('nav.about') },
    { href: '/contact', label: t('nav.contact') },
    { href: '/cart', label: t('nav.cart') },
  ];

  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-6 mt-16">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-10">

        {/* Brand */}
        <div className="flex flex-col gap-4">
          <Image
            src="https://moslimleader.com/wp-content/uploads/2024/10/Logo.webp"
            alt="Moslim Leader"
            width={120}
            height={48}
            className="h-12 w-auto object-contain"
            unoptimized
          />
          <p className="text-sm leading-relaxed text-gray-400">{t('footer.tagline')}</p>
          {/* Social */}
          <div className="flex gap-3 mt-2">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-gray-700 hover:bg-[#F5C518] hover:text-gray-900 flex items-center justify-center transition">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-gray-700 hover:bg-[#F5C518] hover:text-gray-900 flex items-center justify-center transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            <a href="https://wa.me/201000000000" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-gray-700 hover:bg-[#F5C518] hover:text-gray-900 flex items-center justify-center transition">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.549 4.116 1.512 5.852L.057 23.886a.75.75 0 00.921.921l6.163-1.543A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.946 0-3.773-.518-5.348-1.422l-.376-.215-3.898.976.995-3.773-.236-.389A9.962 9.962 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h4 className="text-white font-bold text-lg mb-4">{t('footer.quickLinks')}</h4>
          <ul className="space-y-2 text-sm">
            {navLinks.map(l => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-[#F5C518] transition">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <h4 className="text-white font-bold text-lg mb-4">{t('footer.contactUs')}</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-[#F5C518] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>info@moslimleader.com</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-[#F5C518] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>‪+20 100 000 0000‬</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto px-4 mt-10 pt-6 border-t border-gray-700 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-gray-500">
        <p>© {new Date().getFullYear()} {t('footer.copyright')}</p>
        <div className="flex gap-3">
          {['Visa', 'MasterCard', 'American-Express'].map(m => (
            <Image
              key={m}
              src={`https://moslimleader.com/wp-content/uploads/2024/07/${m}.png`}
              alt={m}
              width={36}
              height={24}
              className="h-6 w-auto object-contain opacity-70"
              unoptimized
            />
          ))}
        </div>
      </div>
    </footer>
  );
}
