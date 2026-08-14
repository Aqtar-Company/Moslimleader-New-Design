import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 500,
        height: 400,
        background: 'radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Character image */}
      <div style={{ position: 'relative', width: 260, height: 260, marginBottom: -20, zIndex: 1 }}>
        <Image
          src="/Error404.png"
          alt=""
          fill
          style={{ objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(201,168,76,0.2))' }}
          priority
        />
      </div>

      {/* Card */}
      <div style={{
        background: '#111827',
        border: '1px solid rgba(201,168,76,0.18)',
        borderRadius: 24,
        padding: '2.5rem 2rem 2rem',
        maxWidth: 460,
        width: '100%',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Gold rule */}
        <div style={{ width: 60, height: 3, background: 'linear-gradient(90deg,transparent,#c9a84c,transparent)', borderRadius: 99, margin: '0 auto 1.5rem' }} />

        <div style={{ fontSize: '3.5rem', fontWeight: 800, color: '#c9a84c', marginBottom: 4, lineHeight: 1 }}>
          404
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>
          الصفحة غير موجودة
        </h1>
        <p style={{ color: '#94a3b8', lineHeight: 1.8, marginBottom: 28, fontSize: '0.95rem' }}>
          يبدو أن الصفحة التي تبحث عنها لا وجود لها<br />
          أو تم نقلها إلى مكان آخر.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            href="/"
            style={{
              background: '#c9a84c',
              color: '#0a0f1e',
              textDecoration: 'none',
              borderRadius: 50,
              padding: '0.8rem 2rem',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'block',
            }}
          >
            العودة للرئيسية
          </Link>
          <Link
            href="/shop"
            style={{
              background: 'transparent',
              color: '#c9a84c',
              textDecoration: 'none',
              borderRadius: 50,
              padding: '0.7rem 2rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              border: '1px solid rgba(201,168,76,0.3)',
              display: 'block',
            }}
          >
            تصفح المنتجات
          </Link>
        </div>
      </div>

      <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
        moslimleader.com
      </p>
    </div>
  );
}
