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

/* ─── Community Card ─────────────────────────────────────────────────────── */
function CommunityCard({ memberNumber, name, joinedYear, qrDataUrl, isRtl }: CommunityCardProps) {
  const uid = useId().replace(/:/g, '');
  const green = '#7dd9a0';

  return (
    <div style={{
      position: 'relative', width: CARD_W, height: CARD_H,
      borderRadius: 20, overflow: 'hidden',
      background: 'linear-gradient(135deg, #1b3a2a 0%, #2a5240 40%, #1e4535 70%, #163020 100%)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
    }}>
      {/* Pattern */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05 }} viewBox="0 0 400 252" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`leaves-${uid}`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="12" fill="none" stroke="white" strokeWidth="0.8"/>
            <circle cx="0" cy="0" r="8" fill="none" stroke="white" strokeWidth="0.8"/>
            <circle cx="40" cy="40" r="8" fill="none" stroke="white" strokeWidth="0.8"/>
          </pattern>
        </defs>
        <rect width="400" height="252" fill={`url(#leaves-${uid})`}/>
      </svg>
      {/* Glow */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,200,120,0.13) 0%, transparent 70%)', pointerEvents: 'none' }}/>

      {/* ── TOP-RIGHT: logo + separator + membership type ── */}
      <div style={{ position: 'absolute', top: 16, right: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', color: green, lineHeight: 1.3 }}>MUSLIM LEADER</p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', lineHeight: 1.3, direction: 'rtl' }}>
            {isRtl ? 'عضوية مجتمعية' : 'Community Member'}
          </p>
        </div>
        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }}/>
        <img src="/logo-mobile.png" alt="ML" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
      </div>

      {/* ── TOP-LEFT: community badge ── */}
      <div style={{ position: 'absolute', top: 20, left: 18 }}>
        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '0.06em',
          padding: '4px 10px', borderRadius: 20,
          background: 'rgba(125,217,160,0.18)',
          color: green,
          border: `1px solid rgba(125,217,160,0.3)`,
          display: 'inline-block',
        }}>
          🌿 {isRtl ? 'عضو المجتمع' : 'COMMUNITY'}
        </span>
      </div>

      {/* ── CENTER-LEFT: member number ── */}
      <div style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-52%)' }}>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
          {isRtl ? 'رقم العضوية' : 'MEMBER ID'}
        </p>
        <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 900, letterSpacing: '0.2em', color: '#d4f5e2', lineHeight: 1 }}>
          {memberNumber}
        </p>
      </div>

      {/* ── BOTTOM-LEFT: QR ── */}
      {qrDataUrl && (
        <div style={{ position: 'absolute', bottom: 16, left: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ background: 'rgba(212,245,226,0.9)', borderRadius: 6, padding: 3 }}>
            <img src={qrDataUrl} width={44} height={44} alt="verify" style={{ display: 'block' }} />
          </div>
          <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isRtl ? 'تحقق' : 'VERIFY'}
          </p>
        </div>
      )}

      {/* ── BOTTOM-RIGHT: brand text ── */}
      <div style={{ position: 'absolute', bottom: 22, right: 18, textAlign: 'right' }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.05em', lineHeight: 1.5, direction: 'rtl' }}>
          مجتمع مسلم ليدر
        </p>
        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.06em', lineHeight: 1.5 }}>
          Muslim Leader Community
        </p>
        <p style={{ fontSize: 8, color: 'rgba(125,217,160,0.35)', letterSpacing: '0.08em', marginTop: 3 }}>
          {isRtl ? `عضو منذ ${joinedYear}` : `Since ${joinedYear}`}
        </p>
      </div>
    </div>
  );
}

/* ─── Leader Card ────────────────────────────────────────────────────────── */
function LeaderCard({ memberNumber, familyName, memberSince, expiresAt, status, qrDataUrl, isRtl }: LeaderCardProps) {
  const uid = useId().replace(/:/g, '');
  const isInactive = status === 'EXPIRED' || status === 'CANCELLED';
  const cardBg = isInactive
    ? 'linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 40%, #242424 70%, #1c1c1e 100%)'
    : 'linear-gradient(135deg, #0d2318 0%, #1a3a2e 40%, #24502f 70%, #1a3a2e 100%)';
  const gold = isInactive ? 'rgba(180,150,80,0.5)' : '#D4A853';
  const numColor = isInactive ? 'rgba(200,200,200,0.65)' : '#F5E6BE';
  const brandColor = isInactive ? 'rgba(200,200,200,0.6)' : '#D4A853';

  const statusLabel = status === 'ACTIVE'    ? (isRtl ? 'نشطة'   : 'ACTIVE')
    : status === 'PENDING'   ? (isRtl ? 'معلقة'  : 'PENDING')
    : status === 'EXPIRED'   ? (isRtl ? 'منتهية' : 'EXPIRED')
    : (isRtl ? 'ملغاة' : 'CANCELLED');

  const statusBg    = status === 'ACTIVE'  ? 'rgba(52,211,153,0.22)'  : status === 'PENDING' ? 'rgba(251,191,36,0.22)' : 'rgba(160,160,160,0.18)';
  const statusColor = status === 'ACTIVE'  ? '#6ee7b7' : status === 'PENDING' ? '#fcd34d' : 'rgba(200,200,200,0.75)';
  const qrBg = isInactive ? 'rgba(200,200,200,0.82)' : 'rgba(245,230,190,0.92)';

  return (
    <div style={{
      position: 'relative', width: CARD_W, height: CARD_H,
      borderRadius: 20, overflow: 'hidden',
      background: cardBg,
      boxShadow: isInactive
        ? '0 12px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)'
        : '0 20px 60px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.3)',
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
      {/* Shimmer */}
      {!isInactive && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 30%, rgba(212,168,83,0.07) 50%, transparent 70%)', pointerEvents: 'none' }}/>
      )}
      {/* Decorative circle */}
      <svg style={{ position: 'absolute', right: -30, top: -30, opacity: isInactive ? 0.03 : 0.06 }} width={200} height={200} viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="90" fill="none" stroke={gold} strokeWidth="36"/>
      </svg>

      {/* ── TOP-RIGHT: logo + separator + membership type ── */}
      <div style={{ position: 'absolute', top: 16, right: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', color: brandColor, lineHeight: 1.4 }}>
            Leader Membership
          </p>
          <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', lineHeight: 1.4, direction: 'rtl' }}>
            عضوية رائدة ✦
          </p>
        </div>
        <div style={{ width: 1, height: 34, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }}/>
        <img src="/logo-mobile.png" alt="ML" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0, opacity: isInactive ? 0.45 : 1 }} />
      </div>

      {/* ── TOP-LEFT: status badge ── */}
      <div style={{ position: 'absolute', top: 20, left: 18 }}>
        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
          padding: '4px 10px', borderRadius: 20,
          background: statusBg, color: statusColor,
          border: `1px solid ${statusColor}44`,
          display: 'inline-block', textTransform: 'uppercase',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* ── CENTER-LEFT: chip ── */}
      <div style={{ position: 'absolute', left: 20, top: 88 }}>
        <svg width={38} height={28} viewBox="0 0 38 28" style={{ opacity: isInactive ? 0.4 : 0.9 }}>
          <rect width="38" height="28" rx="5" fill={isInactive ? '#888' : '#D4A853'}/>
          <rect x="1" y="1" width="36" height="26" rx="4" fill="none" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="0.5"/>
          <line x1="13" y1="0" x2="13" y2="28" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
          <line x1="25" y1="0" x2="25" y2="28" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
          <line x1="0" y1="9" x2="38" y2="9" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
          <line x1="0" y1="19" x2="38" y2="19" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
          <rect x="13" y="9" width="12" height="10" rx="2" fill={isInactive ? '#999' : '#c9a040'} stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="0.5"/>
        </svg>
      </div>

      {/* ── BELOW CHIP (LEFT): member number ── */}
      <div style={{ position: 'absolute', left: 18, top: 128 }}>
        <p style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, letterSpacing: '0.22em', color: numColor, lineHeight: 1 }}>
          {memberNumber}
        </p>
      </div>

      {/* ── BOTTOM-LEFT: QR + expiry ── */}
      <div style={{ position: 'absolute', bottom: 14, left: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        {expiresAt && (
          <p style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: isInactive ? 'rgba(200,200,200,0.35)' : gold, letterSpacing: '0.08em' }}>
            {new Date(expiresAt).toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' })}
          </p>
        )}
        {qrDataUrl ? (
          <>
            <div style={{ background: qrBg, borderRadius: 6, padding: 3 }}>
              <img src={qrDataUrl} width={44} height={44} alt="verify" style={{ display: 'block' }} />
            </div>
            <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {isRtl ? 'تحقق' : 'VERIFY'}
            </p>
          </>
        ) : (
          expiresAt && null
        )}
      </div>

      {/* ── BOTTOM-RIGHT: brand text ── */}
      <div style={{ position: 'absolute', bottom: 18, right: 18, textAlign: 'right' }}>
        {familyName && (
          <p style={{ fontSize: 13, fontWeight: 900, color: isInactive ? 'rgba(200,200,200,0.5)' : 'rgba(255,255,255,0.85)', marginBottom: 6, direction: 'rtl' }}>
            {familyName}
          </p>
        )}
        <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em', lineHeight: 1.55, direction: 'rtl' }}>
          مجتمع مسلم ليدر
        </p>
        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.13)', letterSpacing: '0.06em', lineHeight: 1.55 }}>
          Muslim Leader Community
        </p>
        <p style={{ fontSize: 8, color: isInactive ? 'rgba(200,200,200,0.2)' : 'rgba(212,168,83,0.4)', letterSpacing: '0.05em', marginTop: 3 }}>
          {isRtl ? `عضو رائد منذ ${memberSince}` : `Leader since ${memberSince}`}
        </p>
      </div>
    </div>
  );
}
