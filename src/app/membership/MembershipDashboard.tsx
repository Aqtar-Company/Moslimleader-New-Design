'use client';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/context/LanguageContext';
import PayPalBookButton from '@/components/PayPalBookButton';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

const TEAL  = '#0d6e6e';
const GOLD  = '#d4a843';
const BEIGE = '#f5f0e8';

interface FamilyMember { id: string; name: string; relation: string | null; birthdate: string | null; }
interface Perk { id: string; title: string; description: string | null; imageUrl: string | null; linkUrl: string | null; validUntil: string | null; }
interface Membership {
  id: string; membershipNumber: string; qrToken: string; familyName: string | null;
  memberSince: number; status: string; startsAt: string | null; expiresAt: string | null;
  familyMembers: FamilyMember[];
}

type Tab = 'card' | 'family' | 'perks';

export default function MembershipDashboard({
  membership, ownerName, perks, isLoggedIn,
}: { membership: Membership; ownerName: string; perks: Perk[]; isLoggedIn: boolean }) {
  const { isRtl } = useLang();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<Tab>('card');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(membership.familyMembers);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [renewError, setRenewError] = useState('');

  const isActive    = membership.status === 'ACTIVE';
  const isExpired   = membership.status === 'EXPIRED';
  const isPending   = membership.status === 'PENDING';
  const expiresAt   = membership.expiresAt ? new Date(membership.expiresAt) : null;
  const daysLeft    = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : 0;
  const nearExpiry  = isActive && daysLeft <= 30;
  const verifyUrl   = `https://moslimleader.com/membership/verify/${membership.qrToken}`;

  // Generate QR code
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, verifyUrl, {
      width: 160, margin: 1,
      color: { dark: '#0a2e2e', light: '#f5efe0' },
    }).catch(() => {});
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
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 14px', borderRadius: 20, background: isActive ? 'rgba(74,222,128,0.12)' : isExpired ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)', border: `1px solid ${isActive ? 'rgba(74,222,128,0.3)' : isExpired ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#4ade80' : isExpired ? '#f87171' : '#fbbf24', flexShrink: 0, boxShadow: isActive ? '0 0 8px rgba(74,222,128,0.7)' : 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#4ade80' : isExpired ? '#f87171' : '#fbbf24' }}>
            {isActive ? (isRtl ? 'عضوية فعّالة' : 'Active') : isExpired ? (isRtl ? 'منتهية الصلاحية' : 'Expired') : (isRtl ? 'قيد المعالجة' : 'Pending')}
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
            {/* Membership Card */}
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              background: 'linear-gradient(135deg, #0a3838 0%, #0d5050 40%, #0e5e5e 100%)',
              border: '1px solid rgba(212,168,67,0.25)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              padding: '24px 22px',
              position: 'relative',
            }}>
              {/* Top row: brand + type */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 11, letterSpacing: '0.2em', color: GOLD, fontWeight: 800 }}>MOSLIM LEADER</p>
                  <p style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(245,240,232,0.5)', marginTop: 3 }}>FAMILY MEMBER</p>
                </div>
                {/* Status dot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 12, background: isActive ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', border: `1px solid ${isActive ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#4ade80' : '#f87171' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? '#4ade80' : '#f87171', letterSpacing: '0.1em' }}>
                    {isActive ? 'ACTIVE' : isExpired ? 'EXPIRED' : 'PENDING'}
                  </span>
                </div>
              </div>

              {/* Middle: QR + info */}
              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ background: '#f5efe0', borderRadius: 10, padding: 6, flexShrink: 0 }}>
                  <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 6 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {membership.familyName && (
                    <p style={{ fontSize: 14, fontWeight: 800, color: BEIGE, marginBottom: 8, lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {membership.familyName}
                    </p>
                  )}
                  <p style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: '0.06em', marginBottom: 6 }}>
                    {membership.membershipNumber}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(245,240,232,0.5)' }}>Member Since {membership.memberSince}</p>
                </div>
              </div>

              {/* Bottom: validity */}
              <div style={{ borderTop: '1px solid rgba(212,168,67,0.2)', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 9, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.1em' }}>عضو مجتمع مسلم ليدر</p>
                    <p style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.08em', marginTop: 2 }}>MOSLIM LEADER COMMUNITY</p>
                  </div>
                  {expiryText && (
                    <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
                      <p style={{ fontSize: 9, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.08em' }}>Valid until</p>
                      <p style={{ fontSize: 10, fontWeight: 700, color: isExpired ? '#f87171' : GOLD, marginTop: 2 }}>{expiryText}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Alerts */}
            {nearExpiry && (
              <div style={{ marginTop: 14, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#fbbf24', textAlign: 'center' }}>
                {isRtl ? `ينتهي خلال ${daysLeft} يوم — جدّد الآن للحفاظ على رقمك` : `Expires in ${daysLeft} days — renew now to keep your number`}
              </div>
            )}
            {isExpired && (
              <div style={{ marginTop: 14, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#f87171', textAlign: 'center' }}>
                {isRtl ? 'العضوية منتهية — جدّد للحفاظ على نفس الرقم' : 'Membership expired — renew to keep your number'}
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
                  <p style={{ fontSize: 13, fontWeight: 700, color: isExpired ? '#f87171' : GOLD }}>{expiryText}</p>
                </div>
              )}
            </div>

            {/* Renew button */}
            {(isActive && nearExpiry) || isExpired ? (
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
            <PayPalBookButton
              createEndpoint="/api/membership/renew"
              captureEndpoint="/api/membership/renew"
              amountUsd={2.00}
              isRtl={isRtl}
              extraBody={{ action: 'capture' }}
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
