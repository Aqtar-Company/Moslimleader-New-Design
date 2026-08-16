import type { Metadata } from 'next';
import TareeqShell from '@/components/tareeq/TareeqShell';
import TareeqMediaSession from '@/components/tareeq/TareeqMediaSession';

export const metadata: Metadata = {
  icons: {
    icon: '/Tareeq-small.png',
    apple: '/Tareeq-small.png',
  },
};

export default function TareeqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative" style={{ background: 'var(--tr-base)' }}>
      {/* Runs before paint — applies saved theme to <html> to prevent flash */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('tareeq-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');})();` }} />
      {/* Ambient celestial glow — non-interactive, purely decorative */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212,168,83,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(45,212,191,0.05) 0%, transparent 60%)
          `,
        }}
      />
      <TareeqMediaSession />
      <TareeqShell>
        {/* pb-[60px] reserves space for the 60px bottom nav on mobile */}
        <div className="relative pb-[60px] sm:pb-0">{children}</div>
      </TareeqShell>
    </div>
  );
}
