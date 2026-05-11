// Catalog-only loading boundary — overrides the root app/loading.tsx so the
// catalog is fully isolated from the site's "اختياراتك اليوم" loader.
// Shows the same dark navy + gold logo + animated progress bar as CatalogLoader
// so the transition into CatalogClient is seamless.
import Image from 'next/image';

export default function CatalogLoading() {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#1a1a2e', overflow: 'hidden' }}
      className="flex flex-col items-center justify-center"
    >
      <div style={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: 'rgba(245,197,24,0.05)' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(245,197,24,0.05)' }} />

      <div className="relative z-10 w-56 h-24 mb-10 sm:w-72 sm:h-28">
        <Image src="/logo%20gold.png" alt="Moslim Leader" fill className="object-contain" priority unoptimized />
      </div>

      <div
        className="relative z-10 w-56 rounded-full overflow-hidden mb-3"
        style={{ height: 4, background: 'rgba(255,255,255,0.1)' }}
        dir="ltr"
      >
        <div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(to right, #F5C518, #e0b010)',
            width: '40%',
            animation: 'catalog-loading-bar 1.6s ease-in-out infinite',
          }}
        />
      </div>

      <p className="relative z-10 text-white/40 text-xs tracking-widest">جاري التحميل...</p>

      <style>{`
        @keyframes catalog-loading-bar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(80%);  }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}
