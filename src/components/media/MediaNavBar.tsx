'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import Icon from './Icon';

/**
 * Back and home, at the top of every media page. The site header's logo goes home too, but
 * nobody reads a logo as a button — and a page opened from a shared link has no «back»
 * inside the site at all, so «رجوع» falls back to the library rather than leaving it.
 */
export default function MediaNavBar({ fallback = '/media', tone = 'dark', children }: {
  fallback?: string;
  tone?: 'dark' | 'light';
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { lang } = useLang();
  const isEn = lang === 'en';
  const btn = tone === 'dark'
    ? 'bg-white/10 text-white hover:bg-white/20 border-white/15'
    : 'bg-white text-[#1a1a2e] hover:bg-[#EFEBE2] border-gray-200';

  const back = () => {
    // A same-site history entry exists only if the reader arrived from inside the site.
    const sameSite = typeof document !== 'undefined' && document.referrer.startsWith(window.location.origin);
    if (sameSite && window.history.length > 1) router.back();
    else router.push(fallback);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={back}
        aria-label={isEn ? 'Back' : 'رجوع'}
        className={`inline-flex items-center gap-1.5 h-9 ps-2.5 pe-3.5 rounded-full border text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${btn}`}
      >
        <Icon name="back" size={18} />
        {isEn ? 'Back' : 'رجوع'}
      </button>
      <Link
        href="/"
        aria-label={isEn ? 'Home' : 'الرئيسية'}
        title={isEn ? 'Home' : 'الرئيسية'}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${btn}`}
      >
        <Icon name="home" size={18} />
      </Link>
      {children}
    </div>
  );
}
