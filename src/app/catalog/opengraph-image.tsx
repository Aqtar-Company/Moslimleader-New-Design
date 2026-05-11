import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'كتالوج مسلم ليدر — منتجات تربوية إسلامية';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function CatalogOGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#1a1a2e',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Gold top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: '#F5C518' }} />

        {/* Gold bottom bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, background: '#F5C518' }} />

        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(245,197,24,0.06)',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(245,197,24,0.04)',
        }} />

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://moslimleader.com/white-Logo.webp"
          alt="Moslim Leader"
          width={220}
          height={88}
          style={{ marginBottom: 40, objectFit: 'contain' }}
        />

        {/* Title */}
        <div style={{
          fontSize: 72,
          fontWeight: 900,
          color: '#F5C518',
          marginBottom: 20,
          letterSpacing: '-1px',
        }}>
          كتالوج المنتجات
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 34,
          color: 'rgba(255,255,255,0.65)',
          marginBottom: 48,
        }}>
          منتجات تربوية إسلامية للأطفال والأسرة
        </div>

        {/* Badge */}
        <div style={{
          background: '#F5C518',
          color: '#1a1a2e',
          fontSize: 24,
          fontWeight: 900,
          padding: '12px 36px',
          borderRadius: 50,
        }}>
          moslimleader.com/catalog
        </div>
      </div>
    ),
    { ...size },
  );
}
