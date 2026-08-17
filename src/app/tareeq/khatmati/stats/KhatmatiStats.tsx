'use client';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { TOTAL_QURAN_PAGES } from '@/lib/quran-data';

const BG_DEEP  = '#05101f';
const GOLD     = '#FFCC00';
const TEXT_PRI = '#F0EDE4';
const TEXT_MUT = 'rgba(240,237,228,0.45)';
const CARD     = 'rgba(255,255,255,0.05)';
const CARD_BD  = 'rgba(255,255,255,0.09)';

interface Stats {
  currentPage: number;
  totalPagesRead: number;
  sirajStreak: number;
  pct: number;
  khatmas: number;
  avgPagesPerDay: number;
  daysLeft: number;
  lastReadDate: string | null;
  startedAt: string;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${CARD_BD}`, borderRadius: 18,
      padding: '18px 16px', textAlign: 'center',
    }}>
      <p style={{ fontSize: 32, fontWeight: 900, color: accent ?? GOLD, lineHeight: 1, marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 12, color: TEXT_MUT, marginBottom: sub ? 4 : 0 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

export default function KhatmatiStats({ stats }: { stats: Stats }) {
  const router = useRouter();
  const { isRtl } = useLang();

  const startDate = new Date(stats.startedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const daysActive = Math.ceil((Date.now() - new Date(stats.startedAt).getTime()) / 86400000);
  const estimatedFinish = new Date(Date.now() + stats.daysLeft * 86400000).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' });

  return (
    <>
      <style>{`@keyframes nuri-glow{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}`}</style>
      <div dir={isRtl ? 'rtl' : 'ltr'} style={{
        minHeight: '100dvh',
        background: `linear-gradient(160deg, #0a1e3d 0%, ${BG_DEEP} 55%, #071422 100%)`,
        backgroundColor: BG_DEEP,
        color: TEXT_PRI,
        paddingBottom: 40,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
          <button onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: '50%', background: CARD, border: `1px solid ${CARD_BD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width={16} height={16} fill="none" stroke={TEXT_MUT} strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3' : 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18'} />
            </svg>
          </button>
          <div>
            <h1 style={{ fontWeight: 900, fontSize: 22, color: GOLD, lineHeight: 1 }}>
              {isRtl ? 'إحصائياتي' : 'My Stats'}
            </h1>
            <p style={{ fontSize: 11, color: TEXT_MUT, marginTop: 2 }}>{isRtl ? 'رحلتك مع القرآن الكريم' : 'Your Quran journey'}</p>
          </div>
        </div>

        {/* Big ring */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 8px' }}>
          <div style={{ position: 'relative', width: 160, height: 160 }}>
            <svg width={160} height={160} viewBox="0 0 160 160" style={{ position: 'absolute', inset: 0 }}>
              <circle cx={80} cy={80} r={68} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
              <circle
                cx={80} cy={80} r={68}
                fill="none" stroke={GOLD} strokeWidth={8} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 68}
                strokeDashoffset={2 * Math.PI * 68 * (1 - stats.pct / 100)}
                transform="rotate(-90 80 80)"
                style={{ transition: 'stroke-dashoffset 1.4s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{stats.pct}%</span>
              <span style={{ fontSize: 11, color: TEXT_MUT, marginTop: 4 }}>{isRtl ? 'مكتمل' : 'complete'}</span>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: TEXT_MUT, marginBottom: 24 }}>
          {isRtl ? `صفحة ${stats.currentPage} من ${TOTAL_QURAN_PAGES}` : `Page ${stats.currentPage} of ${TOTAL_QURAN_PAGES}`}
        </p>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 20px 20px' }}>
          <StatCard
            label={isRtl ? 'أيام المواظبة' : 'Day Streak'}
            value={stats.sirajStreak}
            sub={stats.sirajStreak > 0 ? '🔥' : undefined}
          />
          <StatCard
            label={isRtl ? 'عدد الختمات' : 'Full Khatmas'}
            value={stats.khatmas}
            accent={stats.khatmas > 0 ? '#4ade80' : undefined}
          />
          <StatCard
            label={isRtl ? 'إجمالي الصفحات' : 'Pages Read'}
            value={stats.totalPagesRead}
          />
          <StatCard
            label={isRtl ? 'معدل يومي' : 'Daily Avg'}
            value={`${stats.avgPagesPerDay} ${isRtl ? 'ص' : 'p'}`}
          />
        </div>

        {/* Timeline card */}
        <div style={{ margin: '0 20px 16px', background: CARD, border: `1px solid ${CARD_BD}`, borderRadius: 18, padding: '16px 18px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 14 }}>
            {isRtl ? 'الجدول الزمني' : 'Timeline'}
          </p>
          {[
            { label: isRtl ? 'بدأت في' : 'Started', value: startDate },
            { label: isRtl ? 'أيام منذ البداية' : 'Days active', value: String(daysActive) },
            { label: isRtl ? 'متوقع الانتهاء' : 'Est. finish', value: estimatedFinish },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBlock: 8, borderBottom: `1px solid ${CARD_BD}` }}>
              <span style={{ fontSize: 13, color: TEXT_MUT }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRI }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Motivational bar */}
        <div style={{ margin: '0 20px', background: 'rgba(255,204,0,0.07)', border: '1px solid rgba(255,204,0,0.18)', borderRadius: 16, padding: '14px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: GOLD, fontWeight: 700 }}>
            {stats.pct >= 100
              ? (isRtl ? 'أتممت القرآن الكريم 🎉 بارك الله فيك!' : 'You completed the Quran 🎉 Masha Allah!')
              : isRtl
                ? `بقي ${stats.daysLeft} يوماً للختم على معدلك الحالي`
                : `${stats.daysLeft} days left at your current pace`}
          </p>
        </div>
      </div>
    </>
  );
}
