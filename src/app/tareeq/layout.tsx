export default function TareeqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative" style={{ background: 'var(--tr-base)' }}>
      {/* Ambient celestial glow — non-interactive, purely decorative */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 70% 40% at 50% -10%, rgba(45,212,191,0.05) 0%, transparent 70%),
            radial-gradient(ellipse 50% 35% at 85% 90%, rgba(212,168,83,0.04) 0%, transparent 60%)
          `,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
