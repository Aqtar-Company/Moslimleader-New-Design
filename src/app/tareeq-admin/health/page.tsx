'use client';
import { useEffect, useState, useCallback } from 'react';
import AdminShell from '@/components/tareeq-admin/AdminShell';

interface HealthData {
  database: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  memory: { used: number; total: number; rss: number };
  pushSubscriptions: number;
  activeCalls: number;
}

function fmt(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
function fmtUptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/tareeq-admin/health', { credentials: 'include' });
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const card = (label: string, value: string, status: 'ok' | 'warn' | 'error', sub?: string) => (
    <div style={{ background: '#1e293b', border: `1px solid ${status === 'ok' ? '#166534' : status === 'warn' ? '#854d0e' : '#7f1d1d'}`, borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: status === 'ok' ? '#4ade80' : status === 'warn' ? '#fbbf24' : '#f87171' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <AdminShell>
      <div style={{ padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>صحة النظام</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>آخر تحديث: {lastRefresh.toLocaleTimeString('ar')}</span>
            <button onClick={load} style={{ fontSize: 13, color: '#f59e0b', background: 'none', border: '1px solid #f59e0b', borderRadius: 8, padding: '4px 14px', cursor: 'pointer' }}>
              تحديث
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>جاري التحميل…</div>
        ) : !data ? (
          <div style={{ color: '#f87171', textAlign: 'center', padding: 40 }}>فشل تحميل البيانات</div>
        ) : (
          <>
            {(() => {
              const pct = Math.round((data.memory.used / data.memory.total) * 100);
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                    {card('قاعدة البيانات', data.database === 'ok' ? '✓ متصلة' : '✗ خطأ', data.database === 'ok' ? 'ok' : 'error')}
                    {card('وقت التشغيل', fmtUptime(data.uptime), 'ok')}
                    {card('الذاكرة المستخدمة', fmt(data.memory.used), pct > 85 ? 'error' : pct > 65 ? 'warn' : 'ok', `من ${fmt(data.memory.total)} (${pct}%)`)}
                    {card('اشتراكات Push', data.pushSubscriptions.toString(), 'ok')}
                    {card('مكالمات نشطة', data.activeCalls.toString(), data.activeCalls > 50 ? 'warn' : 'ok')}
                  </div>
                  {/* Memory bar */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>استخدام الذاكرة</div>
                    <div style={{ background: '#0f172a', borderRadius: 99, height: 12, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#22c55e', transition: 'width 0.5s ease', borderRadius: 99 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#64748b' }}>
                      <span>{fmt(data.memory.used)} مستخدم</span>
                      <span>{pct}%</span>
                      <span>{fmt(data.memory.total)} إجمالي</span>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </div>
    </AdminShell>
  );
}
