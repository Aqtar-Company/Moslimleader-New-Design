import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/jwt';
import TareeqShell from '@/components/tareeq/TareeqShell';
import TareeqMediaSession from '@/components/tareeq/TareeqMediaSession';
import TareeqContentWrapper from '@/components/tareeq/TareeqContentWrapper';

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/tareeq-icon.svg', type: 'image/svg+xml' },
      { url: '/Tareeq-small.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/Tareeq-small.png',
    shortcut: '/tareeq-icon.svg',
  },
};

export default async function TareeqLayout({ children }: { children: React.ReactNode }) {
  try {
    await getAuthUser();
  } catch {
    redirect('/tareeq/login');
  }
  return (
    <div className="min-h-screen relative" data-tareeq-root style={{ background: 'var(--tr-base)' }}>
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
        <TareeqContentWrapper>{children}</TareeqContentWrapper>
      </TareeqShell>
    </div>
  );
}
