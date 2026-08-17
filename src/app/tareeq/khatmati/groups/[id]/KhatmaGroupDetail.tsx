'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';

const BG_DEEP  = '#05101f';
const GOLD     = '#FFCC00';
const TEXT_PRI = '#F0EDE4';
const TEXT_MUT = 'rgba(240,237,228,0.45)';
const CARD     = 'rgba(255,255,255,0.05)';
const CARD_BD  = 'rgba(255,255,255,0.09)';

interface Member {
  id: string; userId: string; name: string; avatarUrl: string | null;
  streak: number; totalPages: number; points: number; readToday: boolean; rank: number;
  currentPage?: number; currentSurah?: number; currentAyah?: number;
}
interface Group {
  id: string; name: string; description: string | null;
  dailyGoal: number; inviteCode: string | null; isAdmin: boolean;
}

const RANK_COLORS: Record<number, string> = { 1: '#FFCC00', 2: '#94a3b8', 3: '#cd7f32' };

export default function KhatmaGroupDetail({ group, members, userId, myCurrentPage = 1, myCurrentSurah = 1, myCurrentAyah = 1 }: { group: Group; members: Member[]; userId: string; myCurrentPage?: number; myCurrentSurah?: number; myCurrentAyah?: number; }) {
  const router = useRouter();
  const { isRtl } = useLang();
  const [copied, setCopied] = useState(false);

  // Pin dark navy background to body so overscroll stays themed
  React.useEffect(() => {
    const prev = document.body.style.background;
    const prevHtml = document.documentElement.style.background;
    document.body.style.background = BG_DEEP;
    document.documentElement.style.background = BG_DEEP;
    return () => {
      document.body.style.background = prev;
      document.documentElement.style.background = prevHtml;
    };
  }, []);

  const me = members.find(m => m.userId === userId);
  const readTodayCount = members.filter(m => m.readToday).length;

  function copyInvite() {
    if (!group.inviteCode) return;
    navigator.clipboard?.writeText(group.inviteCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <style>{`@keyframes nuri-glow{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}`}</style>
      <div dir={isRtl ? 'rtl' : 'ltr'} style={{
        minHeight: '100dvh',
        background: `linear-gradient(160deg, #0a1e3d 0%, ${BG_DEEP} 55%, #071422 100%)`,
        backgroundColor: BG_DEEP, color: TEXT_PRI, paddingBottom: 40,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
          <button onClick={() => router.push('/tareeq/khatmati/groups')}
            style={{ width: 36, height: 36, borderRadius: '50%', background: CARD, border: `1px solid ${CARD_BD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width={16} height={16} fill="none" stroke={TEXT_MUT} strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3' : 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18'} />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontWeight: 900, fontSize: 20, color: GOLD, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</h1>
            {group.description && <p style={{ fontSize: 12, color: TEXT_MUT, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.description}</p>}
          </div>
        </div>

        {/* Today's activity banner */}
        <div style={{ margin: '16px 20px 0', background: readTodayCount === members.length ? 'rgba(74,222,128,0.09)' : 'rgba(255,204,0,0.07)', border: `1px solid ${readTodayCount === members.length ? 'rgba(74,222,128,0.2)' : 'rgba(255,204,0,0.16)'}`, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>{readTodayCount === members.length ? '✅' : '🕯️'}</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: readTodayCount === members.length ? '#4ade80' : GOLD, marginBottom: 2 }}>
              {isRtl ? `${readTodayCount} من ${members.length} أشعلوا سراجهم اليوم` : `${readTodayCount} of ${members.length} read today`}
            </p>
            <p style={{ fontSize: 11, color: TEXT_MUT }}>
              {isRtl ? `الهدف: ${group.dailyGoal} صفحات لكل عضو` : `Goal: ${group.dailyGoal} pages per member`}
            </p>
          </div>
        </div>

        {/* My lantern */}
        {me && (
          <div style={{ margin: '12px 20px 0', background: CARD, border: `1px solid ${CARD_BD}`, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,204,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {me.avatarUrl ? <img src={me.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20 }}>🕯️</span>}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRI, marginBottom: 4 }}>{isRtl ? 'سراجك' : 'Your Lantern'}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 12, color: GOLD }}>{me.streak} {isRtl ? 'يوم' : 'd'}</span>
                <span style={{ fontSize: 12, color: '#60a5fa' }}>⭐ {me.points} {isRtl ? 'نقطة' : 'pts'}</span>
                <span style={{ fontSize: 12, color: '#4ade80' }}>📖 {me.totalPages} {isRtl ? 'صفحة' : 'pages'}</span>
              </div>
            </div>
            {me.readToday && (
              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>
                {isRtl ? 'قرأت اليوم ✓' : 'Read today ✓'}
              </span>
            )}
          </div>
        )}

        {/* Read CTA */}
        <div style={{ margin: '14px 20px 0' }}>
          <button
            onClick={() => router.push(`/tareeq/khatmati/read?page=${myCurrentPage}&surah=${myCurrentSurah}&ayah=${myCurrentAyah}&groupId=${group.id}`)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '15px 0', borderRadius: 18, fontWeight: 900, fontSize: 15,
              background: GOLD, color: '#080E1C', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(255,204,0,0.28)',
            }}>
            <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            {isRtl
              ? (me?.readToday ? `استمر في التلاوة — صفحة ${myCurrentPage}` : `أكمل ورد الختمة — صفحة ${myCurrentPage}`)
              : (me?.readToday ? `Continue recitation — Page ${myCurrentPage}` : `Complete today's ward — Page ${myCurrentPage}`)}
          </button>
        </div>

        {/* Leaderboard */}
        <div style={{ margin: '16px 20px 0' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginBottom: 12 }}>
            {isRtl ? '🏆 لوحة المتصدرين' : '🏆 Leaderboard'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: m.userId === userId ? 'rgba(255,204,0,0.07)' : CARD,
                border: `1px solid ${m.userId === userId ? 'rgba(255,204,0,0.2)' : CARD_BD}`,
                borderRadius: 14, padding: '12px 14px',
              }}>
                {/* Rank */}
                <span style={{ width: 28, fontWeight: 900, fontSize: 14, color: RANK_COLORS[m.rank] ?? TEXT_MUT, textAlign: 'center', flexShrink: 0 }}>
                  {m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : m.rank === 3 ? '🥉' : `#${m.rank}`}
                </span>
                {/* Avatar */}
                <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,204,0,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.avatarUrl ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                </div>
                {/* Name + stats */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRI, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: TEXT_MUT }}>{m.streak} {isRtl ? 'يوم' : 'd'}</span>
                    <span style={{ fontSize: 11, color: TEXT_MUT }}>📖 {m.totalPages}</span>
                  </div>
                </div>
                {/* Points + today badge */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{m.points}</p>
                  <p style={{ fontSize: 10, color: TEXT_MUT }}>{isRtl ? 'نقطة' : 'pts'}</p>
                </div>
                {m.readToday && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0, boxShadow: '0 0 6px rgba(74,222,128,0.7)', animation: 'nuri-glow 2s ease-in-out infinite' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Invite code (admin) */}
        {group.isAdmin && group.inviteCode && (
          <div style={{ margin: '20px 20px 0' }}>
            <p style={{ fontSize: 12, color: TEXT_MUT, marginBottom: 8 }}>{isRtl ? 'كود دعوة الأعضاء' : 'Member Invite Code'}</p>
            <div onClick={copyInvite} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, background: 'rgba(255,204,0,0.07)', border: '1px solid rgba(255,204,0,0.18)', cursor: 'pointer' }}>
              <code style={{ flex: 1, fontSize: 13, color: GOLD, letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.inviteCode}</code>
              <span style={{ fontSize: 12, color: GOLD, fontWeight: 600, flexShrink: 0 }}>
                {copied ? (isRtl ? 'تم النسخ ✓' : 'Copied ✓') : (isRtl ? 'نسخ' : 'Copy')}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
