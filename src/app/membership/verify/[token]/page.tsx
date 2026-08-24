import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MembershipVerifyPage({ params }: { params: { token: string } }) {
  const membership = await prisma.familyMembership.findUnique({
    where: { qrToken: params.token },
    select: {
      membershipNumber: true,
      status: true,
      tier: true,
      familyName: true,
      memberSince: true,
      expiresAt: true,
      owner: { select: { name: true } },
    },
  });

  if (!membership) notFound();

  const isCommunity = membership.tier === 'community';
  // Community memberships never expire
  const isExpired = !isCommunity && membership.expiresAt && membership.expiresAt < new Date();
  const effectiveStatus = isExpired ? 'EXPIRED' : membership.status;
  const isActive = effectiveStatus === 'ACTIVE';
  // Community members display MC- prefix instead of ML-
  const displayNumber = isCommunity
    ? (membership.membershipNumber ?? '').replace(/^ML-/, 'MC-')
    : membership.membershipNumber;

  const ownerName = membership.owner?.name ?? '';
  const nameParts = ownerName.trim().split(/\s+/);
  const maskedName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : nameParts[0];

  const expiryFormatted = membership.expiresAt
    ? new Date(membership.expiresAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div dir="rtl" style={{
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0d4f4f 0%, #0a3838 60%, #071f1f 100%)',
      padding: '20px',
      fontFamily: "'Cairo', 'Segoe UI', sans-serif",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.5)', letterSpacing: '0.15em' }}>MOSLIM LEADER</p>
      </div>

      {/* Status card */}
      <div style={{
        background: isActive ? 'rgba(0,180,120,0.1)' : 'rgba(220,60,60,0.1)',
        border: `1.5px solid ${isActive ? 'rgba(0,200,130,0.35)' : 'rgba(220,80,80,0.35)'}`,
        borderRadius: 24, padding: '32px 28px', maxWidth: 360, width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>
          {isActive ? '✅' : '❌'}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: isActive ? '#4ade80' : '#f87171', marginBottom: 8 }}>
          {isActive
            ? (isCommunity ? 'عضوية مجتمعية سارية' : 'العضوية سارية')
            : effectiveStatus === 'EXPIRED' ? 'العضوية منتهية' : 'العضوية غير سارية'}
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(245,240,232,0.5)', letterSpacing: '0.08em', marginBottom: 24 }}>
          {isCommunity ? 'عضو مجتمع مسلم ليدر' : 'عضوية أسرة مسلم ليدر'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 16px', textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 3 }}>رقم العضوية</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#d4a843', letterSpacing: '0.06em' }}>{displayNumber}</p>
          </div>
          {membership.familyName && (
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 16px', textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 3 }}>الأسرة</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#f5f0e8' }}>{membership.familyName}</p>
            </div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 16px', textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 3 }}>الاسم</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#f5f0e8' }}>{maskedName}</p>
          </div>
          {expiryFormatted && !isCommunity && (
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 16px', textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 3 }}>صالحة حتى</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: isActive ? '#4ade80' : '#f87171' }}>{expiryFormatted}</p>
            </div>
          )}
          {isCommunity && (
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 16px', textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 3 }}>نوع العضوية</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>مجتمعية — دائمة</p>
            </div>
          )}
        </div>
      </div>

      <p style={{ marginTop: 28, fontSize: 12, color: 'rgba(245,240,232,0.3)', textAlign: 'center' }}>
        moslimleader.com
      </p>
    </div>
  );
}
