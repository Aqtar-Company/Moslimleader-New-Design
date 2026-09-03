import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'طريق — وَبِالنَّجْمِ هُمْ يَهْتَدُونَ';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TareeqOGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0d1117',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial glow behind logo */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '38%',
          transform: 'translate(-50%, -50%)',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,197,24,0.12) 0%, transparent 70%)',
        }} />

        {/* Star dots — decorative */}
        <div style={{ position: 'absolute', top: 40, left: 60, width: 4, height: 4, borderRadius: '50%', background: 'rgba(245,197,24,0.5)' }} />
        <div style={{ position: 'absolute', top: 90, left: 200, width: 3, height: 3, borderRadius: '50%', background: 'rgba(245,197,24,0.3)' }} />
        <div style={{ position: 'absolute', top: 160, left: 80, width: 2, height: 2, borderRadius: '50%', background: 'rgba(245,197,24,0.4)' }} />
        <div style={{ position: 'absolute', top: 50, right: 140, width: 3, height: 3, borderRadius: '50%', background: 'rgba(245,197,24,0.35)' }} />
        <div style={{ position: 'absolute', bottom: 80, right: 60, width: 4, height: 4, borderRadius: '50%', background: 'rgba(245,197,24,0.4)' }} />
        <div style={{ position: 'absolute', bottom: 130, left: 160, width: 3, height: 3, borderRadius: '50%', background: 'rgba(245,197,24,0.25)' }} />

        {/* Gold left accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 6, background: '#F5C518' }} />

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://moslimleader.com/Tareeq-big.png"
          alt="طريق"
          width={260}
          height={260}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />

        {/* Text block */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          paddingLeft: 60,
          flex: 1,
        }}>
          {/* Main title */}
          <div style={{
            fontSize: 110,
            fontWeight: 900,
            color: '#F5C518',
            lineHeight: 1,
            marginBottom: 18,
            letterSpacing: '-2px',
          }}>
            طريق
          </div>

          {/* Ayah */}
          <div style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.75)',
            marginBottom: 32,
            lineHeight: 1.5,
          }}>
            وَبِالنَّجْمِ هُمْ يَهْتَدُونَ
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: 22,
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 40,
          }}>
            شارك تجربتك واترك علامة يهتدي بها غيرك
          </div>

          {/* URL badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(245,197,24,0.12)',
            border: '1.5px solid rgba(245,197,24,0.35)',
            borderRadius: 40,
            padding: '10px 28px',
            width: 'fit-content',
          }}>
            <div style={{
              fontSize: 20,
              color: '#F5C518',
              fontWeight: 700,
            }}>
              moslimleader.com/tareeq
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
