export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

interface Props {
  params: { memberNumber: string };
}

export default async function VerifyPage({ params }: Props) {
  const { memberNumber } = params;

  // Basic format validation — prevents DB query on garbage input
  const validFormat = /^(MC|ML)-\d{3}-\d{5}$/.test(memberNumber);
  if (!validFormat) notFound();

  // Rate-limit by IP — prevents enumeration (10 checks / minute)
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = checkRateLimit(`verify:${ip}`, 10, 60 * 1000);
  if (!allowed) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <p style={{ fontWeight: 700, color: '#1a1a2e' }}>محاولات كثيرة، حاول لاحقاً</p>
        </div>
      </div>
    );
  }

  const isCommunity = memberNumber.startsWith('MC-');
  const isLeader = memberNumber.startsWith('ML-');

  // Community card verify
  if (isCommunity) {
    const dbUser = await prisma.user.findUnique({
      where: { communityMemberNumber: memberNumber },
      select: { name: true, createdAt: true },
    });

    if (!dbUser) notFound();

    const firstName = dbUser.name.split(' ')[0];
    const joinYear = dbUser.createdAt.getFullYear();

    return <VerifyLayout
      type="community"
      firstName={firstName}
      memberNumber={memberNumber}
      status="active"
      joinYear={joinYear}
    />;
  }

  // Leader card verify
  if (isLeader) {
    const membership = await prisma.familyMembership.findUnique({
      where: { membershipNumber: memberNumber },
      select: {
        status: true,
        memberSince: true,
        expiresAt: true,
        familyName: true,
        owner: { select: { name: true } },
      },
    });

    if (!membership) notFound();

    const firstName = (membership.familyName || membership.owner.name).split(' ')[0];
    const isActive = membership.status === 'ACTIVE' && !!membership.expiresAt && membership.expiresAt > new Date();

    return <VerifyLayout
      type="leader"
      firstName={firstName}
      memberNumber={memberNumber}
      status={isActive ? 'active' : membership.status.toLowerCase() as 'expired' | 'cancelled' | 'pending'}
      joinYear={membership.memberSince}
      expiresAt={membership.expiresAt?.toISOString() ?? null}
    />;
  }

  notFound();
}

function VerifyLayout({
  type, firstName, memberNumber, status, joinYear, expiresAt,
}: {
  type: 'community' | 'leader';
  firstName: string;
  memberNumber: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  joinYear: number;
  expiresAt?: string | null;
}) {
  const isActive = status === 'active';
  const isCommunity = type === 'community';

  const bg = isCommunity
    ? 'linear-gradient(135deg, #1b3a2a 0%, #2a5240 55%, #163020 100%)'
    : 'linear-gradient(135deg, #0d2318 0%, #1a3a2e 45%, #0d2318 100%)';

  const accent = isCommunity ? '#7dd9a0' : '#D4A853';
  const typeLabel = isCommunity ? '🌿 عضو المجتمع' : '✦ عضو رائد';
  const statusAr = isActive ? 'فعّالة ✓' : status === 'expired' ? 'منتهية' : status === 'pending' ? 'بانتظار التفعيل' : 'ملغاة';
  const statusColor = isActive ? '#6ee7b7' : '#f87171';

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0f1a14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      {/* Card */}
      <div style={{ width: '100%', maxWidth: 380, borderRadius: 20, overflow: 'hidden', background: bg, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${accent}22` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mobile.png" alt="ML" style={{ width: 40, height: 40, objectFit: 'contain' }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.2em', color: accent }}>MUSLIM LEADER</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{typeLabel}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Status badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: isActive ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', border: `1px solid ${statusColor}55`, borderRadius: 30, padding: '5px 14px', marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{statusAr}</span>
          </div>

          {/* Member info */}
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{firstName}</p>
          <p dir="ltr" style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', marginBottom: 16 }}>{memberNumber}</p>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>عضو منذ</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: accent }}>{joinYear}</p>
            </div>
            {expiresAt && (
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>تنتهي في</p>
                <p dir="ltr" style={{ fontSize: 16, fontWeight: 800, color: isActive ? accent : '#f87171' }}>
                  {new Date(expiresAt).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>moslimleader.com</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>تم التحقق من الهوية</p>
        </div>
      </div>

      {/* Disclaimer */}
      <p style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', maxWidth: 300 }}>
        هذه الصفحة تُستخدم للتحقق من صحة عضوية مسلم ليدر فقط
      </p>
    </div>
  );
}
