'use client';
import { useEffect, useRef, useState, useId } from 'react';

interface CommunityCardProps {
  variant: 'community';
  memberNumber: string;
  name: string;
  joinedYear: number;
  qrDataUrl?: string | null;
  isRtl?: boolean;
}

interface LeaderCardProps {
  variant: 'leader';
  memberNumber: string;
  familyName?: string | null;
  memberSince: number;
  expiresAt?: string | null;
  status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED';
  qrDataUrl?: string | null;
  isRtl?: boolean;
}

type Props = CommunityCardProps | LeaderCardProps;

const CARD_W = 380;
const CARD_H = 240;

export default function MembershipCard(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setScale(Math.min(1, w / CARD_W));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: CARD_W,
        height: CARD_H,
        flexShrink: 0,
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        marginBottom: scale < 1 ? CARD_H * (scale - 1) : 0,
      }}>
        {props.variant === 'community'
          ? <CommunityCard {...props} />
          : <LeaderCard {...props} />
        }
      </div>
    </div>
  );
}

/* ── Community Card ─────────────────────────────────────────────────── */
function CommunityCard({ memberNumber, joinedYear, qrDataUrl, isRtl }: CommunityCardProps) {
  const uid = useId().replace(/:/g, '');
  const green = '#7dd9a0';

  return (
    <div style={{
      position: 'relative', width: CARD_W, height: CARD_H,
      borderRadius: 20, overflow: 'hidden',
      background: 'linear-gradient(135deg, #1b3a2a 0%, #2a5240 40%, #1e4535 70%, #163020 100%)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)',
    }}>
      {/* Hex pattern */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05 }} viewBox="0 0 400 252" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`lv-${uid}`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="12" fill="none" stroke="white" strokeWidth="0.8"/>
            <circle cx="0" cy="0" r="8" fill="none" stroke="white" strokeWidth="0.8"/>
            <circle cx="40" cy="40" r="8" fill="none" stroke="white" strokeWidth="0.8"/>
          </pattern>
        </defs>
        <rect width="400" height="252" fill={`url(#lv-${uid})`}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 18%, rgba(100,200,120,0.1) 0%, transparent 55%)', pointerEvents: 'none' }}/>

      {/* TOP-LEFT: badge */}
      <div style={{ position: 'absolute', top: 20, left: 18 }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.06em', padding: '4px 11px', borderRadius: 20, background: 'rgba(125,217,160,0.18)', color: green, border: '1px solid rgba(125,217,160,0.3)' }}>
          {isRtl ? 'عضو المجتمع' : 'COMMUNITY'}
        </span>
      </div>

      {/* CENTER-LEFT: member number */}
      <div style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-52%)' }}>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
          {isRtl ? 'رقم العضوية' : 'MEMBER ID'}
        </p>
        <p style={{
          fontFamily: "'Courier New', 'OCR-B', monospace",
          fontSize: 18, fontWeight: 900, letterSpacing: '0.22em',
          color: '#ffffff',
          lineHeight: 1,
          textShadow: '0 2px 4px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.4), 1px 1px 0 rgba(0,0,0,0.5)',
        }}>
          {memberNumber}
        </p>
      </div>

      {/* RIGHT PANEL — direction:ltr forces logo+QR to far right regardless of page RTL */}
      <div style={{
        position: 'absolute', right: 18, top: 14, bottom: 14,
        display: 'flex', alignItems: 'stretch', gap: 10,
        direction: 'ltr',
      }}>
        {/* Text column (left of separator) */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'right', direction: 'rtl' }}>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '0.15em', color: green, lineHeight: 1.45 }}>MOSLIM LEADER</p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', lineHeight: 1.45 }}>
              {isRtl ? 'عضوية مجتمعية' : 'Community Member'}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', lineHeight: 1.6 }}>
              {isRtl ? 'مجتمع مسلم ليدر' : 'Moslim Leader'}
            </p>
            <p style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em', lineHeight: 1.6 }}>
              Moslim Leader Community
            </p>
            <p style={{ fontSize: 8, color: 'rgba(125,217,160,0.55)', letterSpacing: '0.05em', marginTop: 2 }}>
              {isRtl ? `عضو منذ ${joinedYear}` : `Since ${joinedYear}`}
            </p>
          </div>
        </div>

        {/* Logo + QR column — rightmost */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <img src="/logo-mobile.png" alt="Moslim Leader" style={{ height: 38, width: 'auto' }} />
          {qrDataUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ background: 'rgba(212,245,226,0.92)', borderRadius: 6, padding: 3 }}>
                <img src={qrDataUrl} width={44} height={44} alt="verify" style={{ display: 'block' }} />
              </div>
              <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {isRtl ? 'تحقق' : 'VERIFY'}
              </p>
            </div>
          ) : (
            <div style={{ width: 50, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.05em' }}>moslimleader.com</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Leader Card ─────────────────────────────────────────────────────── */
function LeaderCard({ memberNumber, memberSince, expiresAt, status, qrDataUrl, isRtl }: LeaderCardProps) {
  const uid = useId().replace(/:/g, '');
  const isInactive = status === 'EXPIRED' || status === 'CANCELLED';

  /* Active → navy blue (Leader tier), Inactive → forest green (community fallback) */
  const cardBg = isInactive
    ? 'linear-gradient(135deg, #0d2318 0%, #1a3a2e 40%, #24502f 70%, #1a3a2e 100%)'
    : 'linear-gradient(135deg, #09152e 0%, #112040 45%, #1a2e5c 70%, #0d1a3a 100%)';

  const gold = isInactive ? 'rgba(180,150,80,0.45)' : '#D4A853';
  const numColor = isInactive ? 'rgba(200,200,200,0.45)' : '#ffffff';
  const brandColor = isInactive ? 'rgba(200,200,200,0.5)' : '#D4A853';
  const qrBg = isInactive ? 'rgba(200,200,200,0.75)' : 'rgba(245,230,190,0.92)';

  const statusLabel = status === 'ACTIVE'  ? (isRtl ? 'نشطة'   : 'ACTIVE')
    : status === 'PENDING' ? (isRtl ? 'معلقة'  : 'PENDING')
    : status === 'EXPIRED' ? (isRtl ? 'منتهية' : 'EXPIRED')
    : (isRtl ? 'ملغاة' : 'CANCELLED');

  const statusBg    = status === 'ACTIVE'  ? 'rgba(52,211,153,0.18)'  : status === 'PENDING' ? 'rgba(251,191,36,0.18)' : 'rgba(160,160,160,0.15)';
  const statusColor = status === 'ACTIVE'  ? '#6ee7b7' : status === 'PENDING' ? '#fcd34d' : 'rgba(200,200,200,0.7)';

  return (
    <div style={{
      position: 'relative', width: CARD_W, height: CARD_H,
      borderRadius: 20, overflow: 'hidden',
      background: cardBg,
      boxShadow: isInactive
        ? '0 12px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)'
        : '0 20px 60px rgba(0,10,40,0.65), 0 4px 16px rgba(0,0,0,0.4)',
    }}>
      {/* Hex pattern */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: isInactive ? 0.04 : 0.07 }} viewBox="0 0 400 252" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`hx-${uid}`} x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
            <polygon points="30,2 58,17 58,47 30,62 2,47 2,17" fill="none" stroke="white" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="400" height="252" fill={`url(#hx-${uid})`}/>
      </svg>

      {/* Diagonal shimmer */}
      {!isInactive && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 25%, rgba(80,130,255,0.07) 50%, transparent 72%)', pointerEvents: 'none' }}/>
      )}

      {/* Spot UV: ghost logo left half — white-only filter */}
      {!isInactive && (
        <div style={{
          position: 'absolute',
          left: -80,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 240,
          height: 315,
          opacity: 0.13,
          mixBlendMode: 'screen',
          filter: 'grayscale(1) brightness(4) contrast(0.6)',
          pointerEvents: 'none',
        }}>
          <img src="/Moslimleader-logo.svg" alt="" style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
        </div>
      )}

      {/* TOP-LEFT: status badge */}
      <div style={{ position: 'absolute', top: 20, left: 18 }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', padding: '4px 11px', borderRadius: 20, background: statusBg, color: statusColor, border: `1px solid ${statusColor}33`, textTransform: 'uppercase' }}>
          {statusLabel}
        </span>
      </div>

      {/* CHIP (center-left) */}
      <div style={{ position: 'absolute', left: 20, top: 88 }}>
        <svg width={38} height={28} viewBox="0 0 38 28" style={{ opacity: isInactive ? 0.35 : 0.9 }}>
          <rect width="38" height="28" rx="5" fill={isInactive ? '#888' : '#D4A853'}/>
          <rect x="1" y="1" width="36" height="26" rx="4" fill="none" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="0.5"/>
          <line x1="13" y1="0" x2="13" y2="28" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
          <line x1="25" y1="0" x2="25" y2="28" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
          <line x1="0" y1="9" x2="38" y2="9" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
          <line x1="0" y1="19" x2="38" y2="19" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
          <rect x="13" y="9" width="12" height="10" rx="2" fill={isInactive ? '#999' : '#c9a040'} stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="0.5"/>
        </svg>
      </div>

      {/* MEMBER NUMBER — embossed golden bank-card style */}
      <div style={{ position: 'absolute', left: 18, top: 130 }}>
        <p style={{
          fontFamily: "'Courier New', 'OCR-B', monospace",
          fontSize: 17, fontWeight: 900, letterSpacing: '0.24em',
          color: numColor,
          lineHeight: 1,
          textShadow: isInactive
            ? 'none'
            : '0 2px 6px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.5), 1px 1px 0 rgba(0,0,0,0.7), -0.5px -0.5px 0 rgba(255,255,255,0.3)',
        }}>
          {memberNumber}
        </p>
      </div>

      {/* RIGHT PANEL: direction:ltr locks flex order regardless of page RTL */}
      <div style={{
        position: 'absolute', right: 18, top: 14, bottom: 14,
        display: 'flex', alignItems: 'stretch', gap: 10,
        direction: 'ltr',
      }}>
        {/* Text column */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'right', direction: 'rtl' }}>
          {/* Top text */}
          <div style={{ paddingTop: 10 }}>
            <p style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '0.15em', color: brandColor, lineHeight: 1.45 }}>
              Leader Membership
            </p>
            <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', lineHeight: 1.45, marginTop: 3 }}>
              {isRtl ? 'عضوية رائدة' : 'Leader Member'}
            </p>
          </div>
          {/* Bottom text */}
          <div>
            {expiresAt && (
              <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700, color: isInactive ? 'rgba(180,150,80,0.3)' : gold, letterSpacing: '0.08em', marginBottom: 4 }}>
                {new Date(expiresAt).toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' })}
              </p>
            )}
            <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.05em', lineHeight: 1.6 }}>
              {isRtl ? 'مجتمع مسلم ليدر' : 'Moslim Leader'}
            </p>
            <p style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', lineHeight: 1.6 }}>
              Moslim Leader Community
            </p>
            {!expiresAt && (
              <p style={{ fontSize: 8, color: isInactive ? 'rgba(180,150,80,0.22)' : 'rgba(212,168,83,0.35)', letterSpacing: '0.05em', marginTop: 2 }}>
                {isRtl ? `عضو رائد منذ ${memberSince}` : `Leader since ${memberSince}`}
              </p>
            )}
          </div>
        </div>

        {/* Logo + QR column (rightmost) */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <img
            src="/logo-mobile.png"
            alt="Moslim Leader"
            style={{ height: 48, width: 'auto', opacity: isInactive ? 0.38 : 1 }}
          />
          {qrDataUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ background: isInactive ? 'rgba(200,190,170,0.75)' : 'linear-gradient(135deg, #fdf6e3 0%, #f5e6c0 60%, #ede0b0 100%)', borderRadius: 6, padding: 3 }}>
                <img src={qrDataUrl} width={44} height={44} alt="verify" style={{ display: 'block', opacity: isInactive ? 0.55 : 1 }} />
              </div>
              <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {isRtl ? 'تحقق' : 'VERIFY'}
              </p>
            </div>
          ) : (
            <div style={{ width: 50, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.06em' }}>moslimleader.com</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
