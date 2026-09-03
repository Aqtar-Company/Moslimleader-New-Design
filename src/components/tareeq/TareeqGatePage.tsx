'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

const FEATURES = [
  { ar: 'شارك تجربتك مع آلاف الرحّالة', en: 'Share your journey with thousands', icon: '🌿' },
  { ar: 'احفظ علامات تهتدي بها لاحقاً', en: 'Bookmark insights for later', icon: '🔖' },
  { ar: 'تفاعل مع ما ألهمك أو أفادك', en: 'React to what inspires you', icon: '⭐' },
  { ar: 'تواصل بشكل خاص مع الآخرين', en: 'Message others privately', icon: '✉️' },
];

export default function TareeqGatePage() {
  const { isRtl } = useLang();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--tr-base)' }}
    >
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 50% -10%, rgba(212,168,83,0.14) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 90%, rgba(45,212,191,0.06) 0%, transparent 60%)
          `,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top: ML brand badge */}
        <div className="flex justify-center pt-8 pb-2">
          <span
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold"
            style={{
              background: 'rgba(212,168,83,0.10)',
              border: '1px solid rgba(212,168,83,0.25)',
              color: 'var(--tr-gold)',
            }}
          >
            <img
              src="/Tareeq-small.png"
              alt=""
              width={16}
              height={16}
              style={{ borderRadius: 4, opacity: 0.85 }}
            />
            {isRtl ? 'من مجتمع مسلم ليدر · مجاناً' : 'Moslim Leader Community · Free'}
          </span>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">
          {/* Logo */}
          <div className="mb-5" style={{ filter: 'drop-shadow(0 0 24px rgba(212,168,83,0.35))' }}>
            <img
              src="/Tareeq-big.png"
              alt="طريق"
              width={100}
              height={100}
              style={{ borderRadius: 24, objectFit: 'contain' }}
            />
          </div>

          <h1
            className="font-black mb-2"
            style={{ fontSize: 44, letterSpacing: '-1px', color: 'var(--tr-gold)', lineHeight: 1 }}
          >
            طريق
          </h1>

          <p
            className="font-semibold mb-3"
            style={{ fontSize: 15, color: 'var(--tr-text-secondary)', fontStyle: 'italic' }}
          >
            وَبِالنَّجْمِ هُمْ يَهْتَدُونَ
          </p>

          <p
            className="leading-relaxed max-w-xs"
            style={{ fontSize: 14, color: 'var(--tr-text-muted)' }}
          >
            {isRtl
              ? 'مساحة للمسلمين يشاركون فيها تجاربهم ويتركون علامات يهتدي بها غيرهم في رحلة التزكية والنمو'
              : 'A space for Muslims to share their experiences and leave markers that guide others on their journey of growth'}
          </p>
        </div>

        {/* Features */}
        <div className="px-6 mb-6 max-w-sm mx-auto w-full">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--tr-border-subtle)', background: 'var(--tr-surface)' }}
          >
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderBottom: i < FEATURES.length - 1 ? '1px solid var(--tr-border-subtle)' : 'none',
                  direction: isRtl ? 'rtl' : 'ltr',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{f.icon}</span>
                <span style={{ fontSize: 13, color: 'var(--tr-text-secondary)', fontWeight: 600 }}>
                  {isRtl ? f.ar : f.en}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="px-6 max-w-sm mx-auto w-full flex flex-col gap-3 mb-4">
          <Link
            href="/login?mode=signup"
            className="block w-full text-center font-black py-4 rounded-2xl text-base transition active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))',
              color: '#0a0d06',
              boxShadow: '0 4px 24px rgba(212,168,83,0.30)',
            }}
          >
            {isRtl ? 'إنشاء حساب مجاني' : 'Create Free Account'}
          </Link>

          <Link
            href="/login"
            className="block w-full text-center font-bold py-3.5 rounded-2xl text-sm transition active:scale-95"
            style={{
              background: 'var(--tr-surface)',
              color: 'var(--tr-text-primary)',
              border: '1.5px solid var(--tr-border-soft)',
            }}
          >
            {isRtl ? 'تسجيل الدخول' : 'Sign In'}
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs pb-10 px-6" style={{ color: 'var(--tr-text-muted)' }}>
          {isRtl
            ? 'بالتسجيل توافق على شروط الاستخدام · طريق نشاط مجاني تماماً'
            : 'By signing up you agree to the Terms · Tareeq is completely free'}
        </p>
      </div>
    </div>
  );
}
