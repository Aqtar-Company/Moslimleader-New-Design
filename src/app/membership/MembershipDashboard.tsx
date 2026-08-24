'use client';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/context/LanguageContext';
import PayPalBookButton from '@/components/PayPalBookButton';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import MembershipCard from '@/components/membership/MembershipCard';

const TEAL  = '#0d6e6e';
const GOLD  = '#FFCC33';
const BEIGE = '#f5f0e8';

interface FamilyMember { id: string; name: string; relation: string | null; birthdate: string | null; }
interface Perk { id: string; title: string; description: string | null; imageUrl: string | null; linkUrl: string | null; validUntil: string | null; }
interface Membership {
  id: string; membershipNumber: string; qrToken: string; familyName: string | null;
  memberSince: number; status: string; tier?: string | null; startsAt: string | null; expiresAt: string | null;
  familyMembers: FamilyMember[];
}

type Tab = 'card' | 'family' | 'perks';

export default function MembershipDashboard({
  membership, ownerName, perks, isLoggedIn,
}: { membership: Membership; ownerName: string; perks: Perk[]; isLoggedIn: boolean }) {
  const { isRtl } = useLang();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('card');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(membership.familyMembers);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [renewError, setRenewError] = useState('');
  const [membershipPrices, setMembershipPrices] = useState<{ egyEgp: number | null; egyUsd: number; intlUsd: number }>({ egyEgp: null, egyUsd: 2.00, intlUsd: 5.00 });
  const [membershipZone, setMembershipZone] = useState<'egypt' | 'international'>('international');
  // DB tier drives community mode; localStorage is a cache so there's no flash on refresh
  const isCommunityTier = membership.tier === 'community';
  const [communityAcknowledged, setCommunityAcknowledged] = useState<boolean>(() => {
    if (isCommunityTier) return true;
    try { return typeof localStorage !== 'undefined' && localStorage.getItem('ml_comm_choice') === '1'; } catch { return false; }
  });
  const [leaderPerks, setLeaderPerks] = useState<{ id: string; title: string; description: string | null }[]>([]);
  const [leaderPerksLoaded, setLeaderPerksLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/membership/price')
      .then(r => r.json())
      .then(d => {
        setMembershipPrices({ egyEgp: d.egyEgp ?? null, egyUsd: d.egyUsd ?? 2.00, intlUsd: d.intlUsd ?? 5.00 });
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz.startsWith('Africa/Cairo') || tz === 'Africa/Cairo') setMembershipZone('egypt');
      })
      .catch(() => {});
  }, []);

  // Fetch leader perks when in community mode
  useEffect(() => {
    if (!communityAcknowledged || leaderPerksLoaded) return;
    setLeaderPerksLoaded(true);
    fetch('/api/membership/perks?preview=1')
      .then(r => r.json())
      .then(d => setLeaderPerks((d.perks ?? []).filter((p: { forTier: string }) => p.forTier !== 'all')))
      .catch(() => {});
  }, [communityAcknowledged, leaderPerksLoaded]);

  async function acknowledgeAsCommunity() {
    // Optimistic update
    setCommunityAcknowledged(true);
    try { localStorage.setItem('ml_comm_choice', '1'); } catch {}
    // Persist to DB so QR + admin reflect community status
    try {
      await fetch('/api/membership/community-choice', { method: 'POST', credentials: 'include' });
    } catch { /* ignore — UI already updated */ }
  }

  const isActive      = membership.status === 'ACTIVE';
  const isExpired     = membership.status === 'EXPIRED';
  const isCancelled   = membership.status === 'CANCELLED';
  const isPending     = membership.status === 'PENDING';
  // Community-tier memberships are ACTIVE; only show grey/inactive for expired leader memberships
  const isInactive    = (isExpired || isCancelled) && !isCommunityTier;
  const expiresAt   = membership.expiresAt ? new Date(membership.expiresAt) : null;
  const daysLeft    = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : 0;
  const nearExpiry  = isActive && !isCommunityTier && daysLeft <= 30;
  const verifyUrl   = `https://moslimleader.com/membership/verify/${membership.qrToken}`;

  // Generate QR as data URL for MembershipCard
  useEffect(() => {
    QRCode.toDataURL(verifyUrl, { width: 80, margin: 1, color: { dark: '#0a1020', light: '#ffffff' } })
      .then(url => setQrDataUrl(url))
      .catch(() => {});
  }, [verifyUrl]);

  const expiryText = expiresAt
    ? expiresAt.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  async function addFamilyMember() {
    if (!newName.trim()) { setAddError(isRtl ? 'أدخل الاسم' : 'Enter a name'); return; }
    setAdding(true); setAddError('');
    const res = await fetch('/api/membership/family', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), relation: newRelation || null }),
    });
    setAdding(false);
    if (!res.ok) { const d = await res.json(); setAddError(d.error || 'Error'); return; }
    const { member } = await res.json();
    setFamilyMembers(p => [...p, member]);
    setNewName(''); setNewRelation(''); setShowAddMember(false);
  }

  async function removeFamilyMember(id: string) {
    await fetch('/api/membership/family', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setFamilyMembers(p => p.filter(m => m.id !== id));
  }

  const RELATIONS = isRtl
    ? [{ v: 'spouse', l: 'زوج/زوجة' }, { v: 'child', l: 'طفل/طفلة' }, { v: 'other', l: 'أخرى' }]
    : [{ v: 'spouse', l: 'Spouse' }, { v: 'child', l: 'Child' }, { v: 'other', l: 'Other' }];

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, #0d4f4f 0%, #0a3838 60%, #071f1f 100%)`,
      paddingBottom: 60, fontFamily: "'Cairo', sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(245,240,232,0.4)' }}>MOSLIM LEADER</p>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: BEIGE, marginTop: 4 }}>
          {isRtl ? 'عضوية الأسرة' : 'Family Membership'}
        </h1>
        {/* Status pill */}
        {/* Status pill — inactive members show green "Community" so the card
            never appears broken/alarming; the renewal CTA below handles the upsell */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 14px', borderRadius: 20, background: (isActive || isInactive) ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)', border: `1px solid ${(isActive || isInactive) ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: (isActive || isInactive) ? '#4ade80' : '#fbbf24', flexShrink: 0, boxShadow: (isActive || isInactive) ? '0 0 8px rgba(74,222,128,0.7)' : 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: (isActive || isInactive) ? '#4ade80' : '#fbbf24' }}>
            {isActive ? (isRtl ? 'عضوية فعّالة' : 'Active') : isInactive ? (isRtl ? 'عضوية مجتمع' : 'Community Membership') : (isRtl ? 'قيد المعالجة' : 'Pending')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '0 20px 20px', gap: 2 }}>
        {([['card', isRtl ? 'الكارت' : 'Card'], ['family', isRtl ? 'الأسرة' : 'Family'], ['perks', isRtl ? 'المزايا' : 'Perks']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t ? GOLD : 'rgba(245,240,232,0.4)',
            borderBottom: `2px solid ${tab === t ? GOLD : 'transparent'}`,
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '0 20px' }}>

        {/* ── CARD TAB ── */}
        {tab === 'card' && (
          <div>

            {/* ════ COMMUNITY MODE (after "اكتفِ" or DB tier = community) ════ */}
            {(isCommunityTier || (communityAcknowledged && isInactive)) ? (
              <div>
                {/* Green community card */}
                <MembershipCard
                  variant="community"
                  memberNumber={membership.membershipNumber}
                  name={ownerName}
                  joinedYear={membership.memberSince}
                  qrDataUrl={qrDataUrl}
                  isRtl={isRtl}
                />

                {/* ── Leader upsell section — always visible ── */}
                <div style={{ marginTop: 18, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(212,168,67,0.2)' }}>
                  {/* Section header */}
                  <div style={{ background: 'rgba(212,168,67,0.07)', padding: '12px 16px', borderBottom: '1px solid rgba(212,168,67,0.12)', textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: '0.1em' }}>
                      {isRtl ? 'العضوية الرائدة — ارتقِ بمستواك' : 'LEADER MEMBERSHIP'}
                    </p>
                  </div>

                  <div style={{ padding: '14px 14px 0' }}>
                    {/* Leader card preview (active style) */}
                    <MembershipCard
                      variant="leader"
                      memberNumber={membership.membershipNumber}
                      familyName={membership.familyName}
                      memberSince={membership.memberSince}
                      expiresAt={undefined}
                      status="ACTIVE"
                      qrDataUrl={null}
                      isRtl={isRtl}
                    />
                  </div>

                  {/* Leader perks */}
                  {leaderPerks.length > 0 && (
                    <div style={{ padding: '14px 16px 0' }}>
                      <p style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', letterSpacing: '0.1em', marginBottom: 8 }}>
                        {isRtl ? 'مميزات العضو الرائد' : 'LEADER BENEFITS'}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {leaderPerks.map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill={GOLD} style={{ flexShrink: 0, marginTop: 3 }}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.5L12 17l-6.2 4.4 2.4-7.5L2 9.4h7.6z"/></svg>
                            <p style={{ fontSize: 12, color: 'rgba(245,240,232,0.65)', lineHeight: 1.5 }}>{p.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Renew CTA */}
                  <div style={{ padding: '14px 16px 18px' }}>
                    <button onClick={() => setShowRenew(true)}
                      style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: 'linear-gradient(135deg, #FFCC00 0%, #FFD740 100%)', color: '#1a0800', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,204,0,0.28)' }}>
                      {isRtl ? 'جدّد للعضوية الرائدة' : 'Upgrade to Leader'}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <a href={verifyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'rgba(212,168,67,0.35)', textDecoration: 'none' }}>
                    {isRtl ? 'رابط التحقق' : 'Verify link'} ↗
                  </a>
                </div>
              </div>

            ) : (
              /* ════ NORMAL MODE ════ */
              <div>
                <MembershipCard
                  variant="leader"
                  memberNumber={membership.membershipNumber}
                  familyName={membership.familyName}
                  memberSince={membership.memberSince}
                  expiresAt={membership.expiresAt ?? undefined}
                  status={membership.status as 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED'}
                  qrDataUrl={qrDataUrl}
                  isRtl={isRtl}
                />

                {/* Near-expiry warning */}
                {nearExpiry && !isExpired && (
                  <div style={{ marginTop: 14, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#fbbf24', textAlign: 'center' }}>
                    {isRtl ? `ينتهي خلال ${daysLeft} يوم — جدّد الآن للحفاظ على رقمك` : `Expires in ${daysLeft} days — renew now to keep your number`}
                  </div>
                )}

                {/* ── EXPIRED / CANCELLED: one-time decision CTA ── */}
                {isInactive && (
                  <div style={{ marginTop: 16, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(212,168,67,0.22)' }}>
                    <div style={{ background: 'linear-gradient(135deg, #1a0c00 0%, #2a1800 100%)', padding: '18px 20px 14px', textAlign: 'center', borderBottom: '1px solid rgba(212,168,67,0.15)' }}>
                      <p style={{ fontSize: 16, fontWeight: 900, color: GOLD, marginBottom: 4 }}>
                        {isCancelled
                          ? (isRtl ? 'عضويتك الرائدة ملغاة' : 'Your Leader membership was cancelled')
                          : (isRtl ? 'عضويتك الرائدة انتهت' : 'Your Leader membership expired')}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(245,240,232,0.5)', lineHeight: 1.6 }}>
                        {isRtl ? 'جدّد أو استمر بالعضوية المجتمعية المجانية' : 'Renew or continue with free Community membership'}
                      </p>
                    </div>
                    <div style={{ background: 'rgba(212,168,67,0.06)', padding: '16px 20px 20px' }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setShowRenew(true)}
                          style={{ flex: 1, padding: '15px 0', borderRadius: 14, background: 'linear-gradient(135deg, #FFCC00 0%, #FFD740 100%)', color: '#1a0800', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,204,0,0.35)' }}>
                          {isRtl ? 'جدّد' : 'Renew'}
                        </button>
                        <button onClick={acknowledgeAsCommunity}
                          style={{ flex: 1, padding: '15px 0', borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(245,240,232,0.75)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                          {isRtl ? 'اكتفِ' : 'Skip'}
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)', marginTop: 8, textAlign: 'center' }}>
                        {isRtl ? 'اختيار "اكتفِ" يُبقيك كعضو مجتمعي مجاناً' : 'Choosing Skip keeps you as a free Community member'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Expiry + dates */}
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {membership.startsAt && (
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px' }}>
                      <p style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', marginBottom: 4 }}>{isRtl ? 'بداية العضوية' : 'Start date'}</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: BEIGE }}>{new Date(membership.startsAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  )}
                  {expiryText && (
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px' }}>
                      <p style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', marginBottom: 4 }}>{isRtl ? 'تنتهي في' : 'Valid until'}</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isInactive ? '#f87171' : GOLD }}>{expiryText}</p>
                    </div>
                  )}
                </div>

                {/* Renew button for near-expiry */}
                {isActive && nearExpiry ? (
                  <button onClick={() => setShowRenew(true)}
                    style={{ marginTop: 14, width: '100%', padding: '14px 0', borderRadius: 16, background: GOLD, color: '#1a0f00', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer' }}>
                    {isRtl ? 'تجديد العضوية' : 'Renew Membership'}
                  </button>
                ) : null}

                {/* QR verify link */}
                <div style={{ marginTop: 14, textAlign: 'center' }}>
                  <a href={verifyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'rgba(212,168,67,0.6)', textDecoration: 'none' }}>
                    {isRtl ? 'رابط التحقق من العضوية' : 'Membership verification link'} ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FAMILY TAB ── */}
        {tab === 'family' && (
          <div>
            <p style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 14 }}>
              {isRtl ? `أفراد الأسرة (${familyMembers.length}/5)` : `Family members (${familyMembers.length}/5)`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {familyMembers.map(m => (
                <div key={m.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{m.relation === 'spouse' ? '💑' : m.relation === 'child' ? '👧' : '👤'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: BEIGE }}>{m.name}</p>
                    {m.relation && <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)' }}>{RELATIONS.find(r => r.v === m.relation)?.l ?? m.relation}</p>}
                  </div>
                  <button onClick={() => removeFamilyMember(m.id)}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ×
                  </button>
                </div>
              ))}
              {familyMembers.length === 0 && (
                <p style={{ textAlign: 'center', color: 'rgba(245,240,232,0.3)', fontSize: 13, padding: '20px 0' }}>
                  {isRtl ? 'لم تضف أفراداً بعد' : 'No family members added yet'}
                </p>
              )}
            </div>

            {isActive && familyMembers.length < 5 && !showAddMember && (
              <button onClick={() => setShowAddMember(true)}
                style={{ width: '100%', padding: '12px 0', borderRadius: 14, background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.25)', color: GOLD, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {isRtl ? '+ إضافة فرد' : '+ Add member'}
              </button>
            )}

            {showAddMember && (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '16px', marginTop: 10 }}>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder={isRtl ? 'اسم الفرد' : 'Member name'}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: BEIGE, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
                <select value={newRelation} onChange={e => setNewRelation(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: BEIGE, fontSize: 14, outline: 'none', marginBottom: 10 }}>
                  <option value="">{isRtl ? 'الصلة (اختياري)' : 'Relation (optional)'}</option>
                  {RELATIONS.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
                {addError && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{addError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addFamilyMember} disabled={adding}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: GOLD, color: '#1a0f00', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                    {adding ? '...' : (isRtl ? 'إضافة' : 'Add')}
                  </button>
                  <button onClick={() => { setShowAddMember(false); setAddError(''); setNewName(''); }}
                    style={{ padding: '11px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.08)', color: 'rgba(245,240,232,0.6)', fontSize: 14, border: 'none', cursor: 'pointer' }}>
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PERKS TAB ── */}
        {tab === 'perks' && (
          <div>
            {!isActive ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(245,240,232,0.4)' }}>
                <p style={{ fontSize: 14 }}>{isRtl ? 'المزايا متاحة للأعضاء الفعّالين فقط' : 'Perks available for active members only'}</p>
              </div>
            ) : perks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(245,240,232,0.4)' }}>
                <p style={{ fontSize: 14 }}>{isRtl ? 'لا توجد مزايا حالياً' : 'No perks available yet'}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {perks.map(p => (
                  <div key={p.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18, overflow: 'hidden' }}>
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                    )}
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <p style={{ fontSize: 15, fontWeight: 800, color: BEIGE }}>{p.title}</p>
                        {p.validUntil && (
                          <span style={{ fontSize: 10, color: GOLD, background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 8, padding: '2px 8px', flexShrink: 0 }}>
                            {isRtl ? 'حتى' : 'Until'} {new Date(p.validUntil).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {p.description && <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.6)', lineHeight: 1.6 }}>{p.description}</p>}
                      {p.linkUrl && (
                        <a href={p.linkUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-block', marginTop: 12, padding: '8px 18px', borderRadius: 10, background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.25)', color: GOLD, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                          {isRtl ? 'عرض التفاصيل ↗' : 'View details ↗'}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Renew modal */}
      {showRenew && (
        <div onClick={() => setShowRenew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} dir={isRtl ? 'rtl' : 'ltr'}
            style={{ background: '#0d3838', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 800, color: BEIGE, marginBottom: 6 }}>{isRtl ? 'تجديد العضوية' : 'Renew Membership'}</h3>
            <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.5)', marginBottom: 20 }}>
              {isRtl ? 'ستمتد عضويتك سنة كاملة بنفس الرقم' : 'Your membership extends by one year — same number'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.6)', marginBottom: 8 }}>
              {membershipZone === 'egypt'
                ? membershipPrices.egyEgp !== null
                  ? `${membershipPrices.egyEgp} ج.م / سنة ($${membershipPrices.egyUsd})`
                  : '...'
                : `$${membershipPrices.intlUsd} USD / سنة`}
            </p>
            <PayPalBookButton
              createEndpoint="/api/membership/renew-create"
              captureEndpoint="/api/membership/renew-capture"
              amountUsd={membershipZone === 'egypt' ? membershipPrices.egyUsd : membershipPrices.intlUsd}
              isRtl={isRtl}
              createBody={{ zone: membershipZone }}
              extraBody={{ zone: membershipZone }}
              onSuccess={() => { setShowRenew(false); router.refresh(); }}
              onError={msg => setRenewError(msg)}
            />
            {renewError && <p style={{ color: '#f87171', fontSize: 13, marginTop: 10, textAlign: 'center' }}>{renewError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
