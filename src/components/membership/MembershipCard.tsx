'use client';
import { useEffect, useRef, useState } from 'react';

interface CommunityCardProps {
  variant: 'community';
  memberNumber: string;
  name: string;
  joinedYear: number;
  isRtl?: boolean;
}

interface LeaderCardProps {
  variant: 'leader';
  memberNumber: string;
  familyName?: string | null;
  memberSince: number;
  expiresAt?: string | null;
  status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED';
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

function CommunityCard({ memberNumber, name, joinedYear, isRtl }: CommunityCardProps) {
  return (
    <div dir="ltr" style={{
      position: 'relative',
      width: CARD_W, height: CARD_H,
      borderRadius: 20,
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #1b3a2a 0%, #2a5240 40%, #1e4535 70%, #163020 100%)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
    }}>
      {/* Subtle pattern */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05 }} viewBox="0 0 400 252" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="leaves" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="12" fill="none" stroke="white" strokeWidth="0.8"/>
            <circle cx="0" cy="0" r="8" fill="none" stroke="white" strokeWidth="0.8"/>
            <circle cx="40" cy="40" r="8" fill="none" stroke="white" strokeWidth="0.8"/>
          </pattern>
        </defs>
        <rect width="400" height="252" fill="url(#leaves)"/>
      </svg>

      {/* Glow accent top-right */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,200,120,0.12) 0%, transparent 70%)', pointerEvents: 'none' }}/>

      <div style={{ position: 'relative', height: '100%', padding: '7% 8%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo-mobile.png" alt="ML" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            <div>
              <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#7dd9a0', marginBottom: 1 }}>MUSLIM LEADER</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em' }}>
                {isRtl ? 'عضو المجتمع' : 'Community Member'}
              </p>
            </div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
            padding: '4px 10px', borderRadius: 20,
            background: 'rgba(125,217,160,0.2)',
            color: '#7dd9a0',
            border: '1px solid rgba(125,217,160,0.35)',
          }}>
            🌿 {isRtl ? 'عضو المجتمع' : 'COMMUNITY'}
          </span>
        </div>

        {/* Middle — member number */}
        <div>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            {isRtl ? 'رقم العضوية' : 'MEMBER ID'}
          </p>
          <p dir="ltr" style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 900, letterSpacing: '0.2em', color: '#d4f5e2', lineHeight: 1 }}>
            {memberNumber}
          </p>
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em', marginBottom: 3 }}>
              {name}
            </p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {isRtl ? 'عضو منذ' : 'MEMBER SINCE'} {joinedYear}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
              {isRtl ? 'مجتمع مسلم ليدر' : 'ML COMMUNITY'}
            </p>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7dd9a0', letterSpacing: '0.08em' }}>
              moslimleader.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderCard({ memberNumber, familyName, memberSince, expiresAt, status, isRtl }: LeaderCardProps) {
  const isInactive = status === 'EXPIRED' || status === 'CANCELLED';
  const cardBg = isInactive
    ? 'linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 40%, #242424 70%, #1c1c1e 100%)'
    : 'linear-gradient(135deg, #0d2318 0%, #1a3a2e 40%, #24502f 70%, #1a3a2e 100%)';
  const gold = isInactive ? 'rgba(180,150,80,0.5)' : '#D4A853';
  const numColor = isInactive ? 'rgba(200,200,200,0.7)' : '#F5E6BE';
  const brandColor = isInactive ? 'rgba(200,200,200,0.7)' : '#D4A853';

  const statusLabel = status === 'ACTIVE' ? (isRtl ? 'نشطة' : 'ACTIVE')
    : status === 'PENDING' ? (isRtl ? 'معلقة' : 'PENDING')
    : status === 'EXPIRED' ? (isRtl ? 'منتهية' : 'EXPIRED')
    : (isRtl ? 'ملغاة' : 'CANCELLED');

  const statusBg = status === 'ACTIVE' ? 'rgba(52,211,153,0.25)'
    : status === 'PENDING' ? 'rgba(251,191,36,0.25)'
    : 'rgba(160,160,160,0.2)';
  const statusColor = status === 'ACTIVE' ? '#6ee7b7'
    : status === 'PENDING' ? '#fcd34d'
    : 'rgba(200,200,200,0.8)';

  return (
    <div dir="ltr" style={{
      position: 'relative',
      width: CARD_W, height: CARD_H,
      borderRadius: 20,
      overflow: 'hidden',
      background: cardBg,
      boxShadow: isInactive
        ? '0 12px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)'
        : '0 20px 60px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.3)',
    }}>
      {/* Hex pattern */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: isInactive ? 0.04 : 0.07 }} viewBox="0 0 400 252" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="hx" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
            <polygon points="30,2 58,17 58,47 30,62 2,47 2,17" fill="none" stroke="white" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="400" height="252" fill="url(#hx)"/>
      </svg>

      {!isInactive && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 30%, rgba(212,168,83,0.08) 50%, transparent 70%)', pointerEvents: 'none' }}/>
      )}

      <svg style={{ position: 'absolute', right: -30, top: -30, opacity: isInactive ? 0.03 : 0.06 }} width={220} height={220} viewBox="0 0 220 220">
        <circle cx="110" cy="110" r="100" fill="none" stroke={gold} strokeWidth="40"/>
        <circle cx="150" cy="90" r="80" fill={isInactive ? '#1c1c1e' : '#0d2318'}/>
      </svg>

      <div style={{ position: 'relative', height: '100%', padding: '6% 8%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo-mobile.png" alt="ML" style={{ width: 48, height: 48, objectFit: 'contain', opacity: isInactive ? 0.45 : 1 }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.2em', color: brandColor, marginBottom: 2 }}>MUSLIM LEADER</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em' }}>
                ✦ {isRtl ? 'العضوية الرائدة' : 'Leader Membership'}
              </p>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', padding: '4px 10px', borderRadius: 20, background: statusBg, color: statusColor, border: `1px solid ${statusColor}55`, textTransform: 'uppercase' }}>
            {statusLabel}
          </span>
        </div>

        {/* Chip + number */}
        <div>
          <svg width={38} height={28} viewBox="0 0 38 28" style={{ marginBottom: 10, opacity: isInactive ? 0.4 : 0.9 }}>
            <rect width="38" height="28" rx="5" fill={isInactive ? '#888' : '#D4A853'}/>
            <rect x="1" y="1" width="36" height="26" rx="4" fill="none" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="0.5"/>
            <line x1="13" y1="0" x2="13" y2="28" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
            <line x1="25" y1="0" x2="25" y2="28" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
            <line x1="0" y1="9" x2="38" y2="9" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
            <line x1="0" y1="19" x2="38" y2="19" stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="1"/>
            <rect x="13" y="9" width="12" height="10" rx="2" fill={isInactive ? '#999' : '#c9a040'} stroke={isInactive ? '#666' : '#b8922a'} strokeWidth="0.5"/>
          </svg>
          <p dir="ltr" style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 900, letterSpacing: '0.22em', color: numColor, lineHeight: 1 }}>
            {memberNumber}
          </p>
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            {familyName && (
              <p style={{ fontSize: 12, fontWeight: 900, color: isInactive ? 'rgba(200,200,200,0.6)' : 'white', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                {familyName}
              </p>
            )}
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {isRtl ? 'عضو رائد منذ' : 'LEADER SINCE'} {memberSince}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            {expiresAt && (
              <>
                <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                  {isRtl ? 'تنتهي' : 'EXPIRES'}
                </p>
                <p dir="ltr" style={{ fontSize: 13, fontWeight: 900, color: isInactive ? 'rgba(200,200,200,0.5)' : '#D4A853', letterSpacing: '0.1em' }}>
                  {new Date(expiresAt).toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' })}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
