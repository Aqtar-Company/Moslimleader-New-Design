import { ImageResponse } from 'next/og';
import { RtlText, loadOgFont, publicAssetDataUri } from '@/lib/tareeq-og';

/**
 * The share card for /tareeq itself.
 *
 * It ran on the edge runtime with no `fonts` passed, which means satori fell back to its
 * bundled Latin face — so every Arabic word here, the ayah included, rasterised as tofu.
 * Reading the font off disk needs the Node runtime, hence the removed `runtime = 'edge'`.
 *
 * It also never rendered at all: the URL badge carried `width: 'fit-content'`, which
 * satori rejects outright ("Invalid value fit-content for setWidth"), so every request
 * threw. `alignSelf` is how you say that here.
 */
export const runtime = 'nodejs';
export const alt = 'طريق — وَبِالنَّجْمِ هُمْ يَهْتَدُونَ';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TareeqOGImage() {
  const font = loadOgFont();
  const logo = publicAssetDataUri('Tareeq-big.png', 'image/png');

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
          fontFamily: 'Cairo',
          position: 'relative',
          overflow: 'hidden',
          padding: '0 72px',
        }}
      >

        {/* Star dots — decorative */}
        <div style={{ position: 'absolute', top: 40, left: 60, width: 4, height: 4, borderRadius: '50%', background: 'rgba(245,197,24,0.5)' }} />
        <div style={{ position: 'absolute', top: 90, left: 200, width: 3, height: 3, borderRadius: '50%', background: 'rgba(245,197,24,0.3)' }} />
        <div style={{ position: 'absolute', top: 160, left: 80, width: 2, height: 2, borderRadius: '50%', background: 'rgba(245,197,24,0.4)' }} />
        <div style={{ position: 'absolute', top: 50, right: 140, width: 3, height: 3, borderRadius: '50%', background: 'rgba(245,197,24,0.35)' }} />
        <div style={{ position: 'absolute', bottom: 80, right: 60, width: 4, height: 4, borderRadius: '50%', background: 'rgba(245,197,24,0.4)' }} />
        <div style={{ position: 'absolute', bottom: 130, left: 160, width: 3, height: 3, borderRadius: '50%', background: 'rgba(245,197,24,0.25)' }} />

        {/* Gold left accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 6, background: '#F5C518' }} />

        {/* Logo — embedded, not fetched. A remote src that fails to load leaves no trace
            in the image and only a log line on the server. */}
        {logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logo}
            alt="طريق"
            width={260}
            height={260}
            style={{ objectFit: 'contain', flexShrink: 0, borderRadius: 28 }}
          />
        ) : null}

        {/* Text block */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          paddingLeft: 60,
          flex: 1,
        }}>
          {/* Main title */}
          <div style={{
            display: 'flex',
            fontSize: 110,
            color: '#F5C518',
            lineHeight: 1.2,
            marginBottom: 18,
          }}>
            طريق
          </div>

          {/* Ayah — one RTL run, so the words keep their reading order. satori shapes
              Arabic but does not reorder it; laid out as plain text these read backwards. */}
          <RtlText
            text="وَبِالنَّجْمِ هُمْ يَهْتَدُونَ"
            gap={12}
            wrap={false}
            style={{ fontSize: 28, color: 'rgba(255,255,255,0.75)', marginBottom: 32, lineHeight: 1.6, justifyContent: 'flex-end' }}
          />

          {/* Tagline */}
          <RtlText
            text="شارك تجربتك واترك علامة يهتدي بها غيرك"
            gap={10}
            style={{ fontSize: 22, color: 'rgba(255,255,255,0.45)', marginBottom: 40, lineHeight: 1.6, justifyContent: 'flex-end' }}
          />

          {/* URL badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(245,197,24,0.12)',
            border: '1.5px solid rgba(245,197,24,0.35)',
            borderRadius: 40,
            padding: '10px 28px',
            alignSelf: 'flex-start',
          }}>
            <div style={{
              fontSize: 20,
              color: '#F5C518',
            }}>
              moslimleader.com/tareeq
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'Cairo', data: font, weight: 700, style: 'normal' }] : undefined,
    },
  );
}
