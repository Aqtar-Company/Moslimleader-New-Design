import TareeqShell from '@/components/tareeq/TareeqShell';

export default function TareeqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative" style={{ background: 'var(--tr-base)' }}>
      {/* Ambient celestial glow — non-interactive, purely decorative */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37,99,235,0.10) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(234,111,10,0.06) 0%, transparent 60%)
          `,
        }}
      />
      <TareeqShell>
        {/* pb-[60px] reserves space for the 60px bottom nav on mobile */}
        <div className="relative pb-[60px] sm:pb-0">{children}</div>
      </TareeqShell>
    </div>
  );
}
