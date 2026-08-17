'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';

const BG_DEEP  = '#05101f';
const GOLD     = '#FFCC00';
const TEXT_PRI = '#F0EDE4';
const TEXT_MUT = 'rgba(240,237,228,0.45)';
const CARD     = 'rgba(255,255,255,0.05)';
const CARD_BD  = 'rgba(255,255,255,0.09)';

interface Group {
  id: string; name: string; description: string | null;
  dailyGoal: number; inviteCode: string | null; isAdmin: boolean;
  memberCount: number; adminName: string;
  myStreak: number; myPoints: number; myTotalPages: number;
}

export default function KhatmaGroupsClient({ initialGroups, userId }: { initialGroups: Group[]; userId: string }) {
  const router = useRouter();
  const { isRtl } = useLang();
  const [groups, setGroups] = useState(initialGroups);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createGoal, setCreateGoal] = useState(4);
  const [joinCode, setJoinCode] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!createName.trim()) return;
    setLoading(true); setError('');
    const res = await fetch('/api/tareeq/khatmati/groups', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() || undefined, dailyGoal: createGoal }),
    });
    setLoading(false);
    if (!res.ok) { setError(isRtl ? 'حدث خطأ' : 'An error occurred'); return; }
    const { group } = await res.json();
    setGroups(prev => [{
      id: group.id, name: group.name, description: group.description,
      dailyGoal: group.dailyGoal, inviteCode: group.inviteCode, isAdmin: true,
      memberCount: 1, adminName: group.admin.name,
      myStreak: 0, myPoints: 0, myTotalPages: 0,
    }, ...prev]);
    setShowCreate(false); setCreateName(''); setCreateDesc('');
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading(true); setError('');
    // The invite code IS the group's unique invite code — we need to find by code
    const res = await fetch(`/api/tareeq/khatmati/groups/join`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: joinCode.trim() }),
    });
    setLoading(false);
    if (!res.ok) { setError(isRtl ? 'الكود غير صحيح' : 'Invalid code'); return; }
    router.refresh();
    setShowJoin(false); setJoinCode('');
  }

  function copyInvite(code: string, id: string) {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <>
      <style>{`@keyframes nuri-sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div dir={isRtl ? 'rtl' : 'ltr'} style={{
        minHeight: '100dvh', background: `linear-gradient(160deg, #0a1e3d 0%, ${BG_DEEP} 55%, #071422 100%)`,
        backgroundColor: BG_DEEP, color: TEXT_PRI, paddingBottom: 40,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.push('/tareeq/khatmati')}
              style={{ width: 36, height: 36, borderRadius: '50%', background: CARD, border: `1px solid ${CARD_BD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width={16} height={16} fill="none" stroke={TEXT_MUT} strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3' : 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18'} />
              </svg>
            </button>
            <div>
              <h1 style={{ fontWeight: 900, fontSize: 22, color: GOLD, lineHeight: 1 }}>{isRtl ? 'ختمات جماعية' : 'Group Khatmas'}</h1>
              <p style={{ fontSize: 11, color: TEXT_MUT, marginTop: 2 }}>{isRtl ? 'اقرأ مع أحبابك' : 'Read with your community'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowJoin(true)}
              style={{ padding: '8px 14px', borderRadius: 12, background: CARD, border: `1px solid ${CARD_BD}`, color: TEXT_MUT, fontSize: 13, cursor: 'pointer' }}>
              {isRtl ? 'انضم' : 'Join'}
            </button>
            <button onClick={() => setShowCreate(true)}
              style={{ padding: '8px 14px', borderRadius: 12, background: GOLD, color: '#080E1C', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              {isRtl ? '+ أنشئ' : '+ Create'}
            </button>
          </div>
        </div>

        {/* Groups list */}
        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: TEXT_MUT }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🕯️</div>
              <p style={{ fontWeight: 700, fontSize: 16, color: TEXT_PRI, marginBottom: 6 }}>
                {isRtl ? 'لا توجد ختمات جماعية بعد' : 'No group khatmas yet'}
              </p>
              <p style={{ fontSize: 13 }}>{isRtl ? 'أنشئ مجموعة أو انضم لمجموعة موجودة' : 'Create a group or join an existing one'}</p>
            </div>
          ) : groups.map(g => (
            <div key={g.id} onClick={() => router.push(`/tareeq/khatmati/groups/${g.id}`)}
              style={{ background: CARD, border: `1px solid ${CARD_BD}`, borderRadius: 18, padding: '16px 18px', cursor: 'pointer', active: { opacity: 0.8 } as React.CSSProperties }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 16, color: TEXT_PRI, marginBottom: 2 }}>{g.name}</p>
                  {g.description && <p style={{ fontSize: 12, color: TEXT_MUT, lineHeight: 1.5 }}>{g.description}</p>}
                </div>
                {g.isAdmin && (
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'rgba(255,204,0,0.15)', color: GOLD, fontWeight: 700, flexShrink: 0 }}>
                    {isRtl ? 'مشرف' : 'Admin'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: TEXT_MUT }}>
                  👥 {g.memberCount} {isRtl ? 'عضو' : 'members'}
                </span>
                <span style={{ fontSize: 12, color: TEXT_MUT }}>
                  🎯 {g.dailyGoal} {isRtl ? 'صفحات/يوم' : 'pages/day'}
                </span>
              </div>
              {/* My stats in this group */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 12px', minWidth: 60 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>{g.myStreak}</span>
                  <span style={{ fontSize: 10, color: TEXT_MUT }}>{isRtl ? 'أيام' : 'streak'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 12px', minWidth: 60 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#60a5fa' }}>{g.myPoints}</span>
                  <span style={{ fontSize: 10, color: TEXT_MUT }}>{isRtl ? 'نقطة' : 'pts'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 12px', minWidth: 60 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#4ade80' }}>{g.myTotalPages}</span>
                  <span style={{ fontSize: 10, color: TEXT_MUT }}>{isRtl ? 'صفحة' : 'pages'}</span>
                </div>
              </div>
              {/* Invite code copy (admin only) */}
              {g.isAdmin && g.inviteCode && (
                <div onClick={e => { e.stopPropagation(); copyInvite(g.inviteCode!, g.id); }}
                  style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,204,0,0.07)', border: '1px solid rgba(255,204,0,0.15)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 11, color: TEXT_MUT, flex: 1, fontFamily: 'monospace', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.inviteCode}
                  </span>
                  <span style={{ fontSize: 11, color: GOLD, fontWeight: 600, flexShrink: 0 }}>
                    {copiedId === g.id ? (isRtl ? 'تم النسخ ✓' : 'Copied ✓') : (isRtl ? 'نسخ الدعوة' : 'Copy invite')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create sheet */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} dir={isRtl ? 'rtl' : 'ltr'}
            style={{ width: '100%', background: '#111827', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', animation: 'nuri-sheet 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: CARD_BD, margin: '0 auto 20px' }} />
            <p style={{ fontWeight: 800, fontSize: 18, color: GOLD, marginBottom: 18 }}>{isRtl ? 'إنشاء مجموعة ختمة' : 'Create Group Khatma'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={createName} onChange={e => setCreateName(e.target.value)} maxLength={100}
                placeholder={isRtl ? 'اسم المجموعة *' : 'Group name *'}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: CARD, border: `1px solid ${CARD_BD}`, color: TEXT_PRI, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <textarea value={createDesc} onChange={e => setCreateDesc(e.target.value)} maxLength={300} rows={2}
                placeholder={isRtl ? 'وصف (اختياري)' : 'Description (optional)'}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: CARD, border: `1px solid ${CARD_BD}`, color: TEXT_PRI, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              <div>
                <label style={{ fontSize: 12, color: TEXT_MUT, marginBottom: 8, display: 'block' }}>
                  {isRtl ? `هدف يومي: ${createGoal} صفحات` : `Daily goal: ${createGoal} pages`}
                </label>
                <input type="range" min={1} max={20} value={createGoal} onChange={e => setCreateGoal(Number(e.target.value))}
                  style={{ width: '100%', accentColor: GOLD }} />
              </div>
              {error && <p style={{ fontSize: 13, color: '#f87171', textAlign: 'center' }}>{error}</p>}
              <button onClick={handleCreate} disabled={loading || !createName.trim()}
                style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: GOLD, color: '#080E1C', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer', opacity: loading || !createName.trim() ? 0.6 : 1 }}>
                {loading ? '...' : (isRtl ? 'إنشاء المجموعة' : 'Create Group')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join sheet */}
      {showJoin && (
        <div onClick={() => setShowJoin(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} dir={isRtl ? 'rtl' : 'ltr'}
            style={{ width: '100%', background: '#111827', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', animation: 'nuri-sheet 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: CARD_BD, margin: '0 auto 20px' }} />
            <p style={{ fontWeight: 800, fontSize: 18, color: GOLD, marginBottom: 18 }}>{isRtl ? 'الانضمام بكود الدعوة' : 'Join with Invite Code'}</p>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value)}
              placeholder={isRtl ? 'الصق كود الدعوة هنا' : 'Paste invite code here'}
              style={{ width: '100%', padding: '13px 14px', borderRadius: 12, background: CARD, border: `1px solid ${CARD_BD}`, color: TEXT_PRI, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12, fontFamily: 'monospace' }} />
            {error && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 10, textAlign: 'center' }}>{error}</p>}
            <button onClick={handleJoin} disabled={loading || !joinCode.trim()}
              style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: GOLD, color: '#080E1C', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer', opacity: loading || !joinCode.trim() ? 0.6 : 1 }}>
              {loading ? '...' : (isRtl ? 'انضم للمجموعة' : 'Join Group')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
