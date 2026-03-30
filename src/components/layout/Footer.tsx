'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';

const SOCIAL = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/MoslimLeader',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/moslim_leader/',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    label: 'X',
    href: 'https://x.com/moslimleader',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@moslimleader7687',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    label: 'SoundCloud',
    href: 'https://soundcloud.com/moslimleader',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M1.175 12.225c-.017 0-.034.002-.05.006a.32.32 0 00-.23.303l-.39 2.474.39 2.438c.01.162.116.295.28.303.017 0 .033-.002.05-.006.13-.03.226-.148.226-.289l.44-2.446-.44-2.512a.296.296 0 00-.276-.271zm2.228-.8c-.023 0-.046.003-.068.01a.394.394 0 00-.295.383l-.334 2.86.334 2.795c.01.2.147.362.363.362.023 0 .046-.003.068-.01.193-.043.33-.216.33-.383l.376-2.764-.376-2.895a.387.387 0 00-.398-.358zm2.26-.313c-.028 0-.057.004-.084.012a.486.486 0 00-.365.474l-.285 2.86.285 2.787c.012.245.18.44.45.44.028 0 .057-.004.084-.012.24-.053.41-.268.41-.474l.32-2.74-.32-2.9a.48.48 0 00-.495-.447zm2.276.13c-.034 0-.068.006-.1.016-.293.064-.497.325-.497.625l-.238 2.73.238 2.774c.014.29.215.52.597.52.034 0 .068-.006.1-.016.29-.065.492-.326.492-.625l.268-2.653-.268-2.806a.588.588 0 00-.592-.565zm2.278-.44c-.04 0-.08.007-.118.02-.34.077-.578.38-.578.727l-.19 3.17.19 2.76c.016.337.25.604.696.604.04 0 .08-.007.118-.02.337-.077.573-.38.573-.727l.214-2.617-.214-3.21a.683.683 0 00-.691-.707zm9.405 1.68c-.134 0-.264.013-.39.038-.27-3.063-2.808-5.44-5.92-5.44-1.016 0-1.972.268-2.793.736-.307.178-.39.36-.393.52v10.54c.003.17.134.31.303.326h9.193C22.338 18.76 24 17.1 24 15.044c0-2.057-1.662-3.726-3.658-3.762z" />
      </svg>
    ),
  },
  {
    label: 'WhatsApp',
    href: 'https://wa.me/201060306803',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.549 4.116 1.512 5.852L.057 23.886a.75.75 0 00.921.921l6.163-1.543A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.946 0-3.773-.518-5.348-1.422l-.376-.215-3.898.976.995-3.773-.236-.389A9.962 9.962 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const { t, isRtl } = useLang();

  return (
    <footer className="bg-gray-950 border-t border-white/8 text-gray-400 pt-10 pb-5 mt-16" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto px-6">

        {/* Top grid: Logo | Nav | Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-8">

          {/* ── Column 1: Logo + tagline ── */}
          <div className="flex flex-col items-center sm:items-start gap-3">
            <Image
              src="/white-Logo.webp"
              alt="Moslim Leader"
              width={160}
              height={64}
              className="h-16 w-auto object-contain"
              unoptimized
            />
            <p className="text-xs text-gray-500 text-center sm:text-start leading-relaxed max-w-[180px]">
              {isRtl ? 'معًا نبني قادة الغد' : "Together We Build Tomorrow's Leaders"}
            </p>
          </div>

          {/* ── Column 2: Quick links ── */}
          <div className="flex flex-col items-center sm:items-start gap-3">
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-1">
              {isRtl ? 'روابط سريعة' : 'Quick Links'}
            </h4>
            {[
              { href: '/', ar: 'الرئيسية', en: 'Home' },
              { href: '/library', ar: 'المكتبة الرقمية', en: 'Digital Library' },
              { href: '/about', ar: 'من نحن', en: 'About' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-[#F5C518] transition flex items-center gap-1.5 group"
              >
                <span className="w-1 h-1 rounded-full bg-[#F5C518]/40 group-hover:bg-[#F5C518] transition" />
                {isRtl ? link.ar : link.en}
              </Link>
            ))}
          </div>

          {/* ── Column 3: Contact info + socials ── */}
          <div className="flex flex-col items-center sm:items-start gap-3">
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-1">
              {isRtl ? 'تواصل معنا' : 'Contact'}
            </h4>

            <a
              href="mailto:info@moslimleader.com"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#F5C518] transition"
            >
              <svg className="w-4 h-4 text-[#F5C518] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              info@moslimleader.com
            </a>

            <a
              href="tel:+201060306803"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#F5C518] transition"
            >
              <svg className="w-4 h-4 text-[#F5C518] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              ‪(+20) 106 030 6803‬
            </a>

            {/* Social icons */}
            <div className="flex flex-wrap gap-2 mt-1">
              {SOCIAL.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 hover:bg-[#F5C518] hover:border-[#F5C518] hover:text-gray-900 text-gray-400 flex items-center justify-center transition"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/8 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">

          {/* Copyright */}
          <p className="text-xs text-gray-600 order-2 sm:order-1">
            © {new Date().getFullYear()} {t('footer.copyright')}
          </p>

          {/* Payment badges */}
          <div className="flex items-center gap-3 order-1 sm:order-2">
            <span className="text-xs text-gray-600">{isRtl ? 'طرق الدفع:' : 'Payment:'}</span>
            {['Visa', 'MasterCard', 'American-Express'].map(m => (
              <Image
                key={m}
                src={`/wp-content/uploads/2024/07/${m}.png`}
                alt={m}
                width={40}
                height={26}
                className="h-6 w-auto object-contain opacity-50 hover:opacity-80 transition"
                unoptimized
              />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
