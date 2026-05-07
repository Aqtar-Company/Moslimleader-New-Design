'use client';

import { useCallback, useEffect, useState } from 'react';
import Spinner from '@/components/admin/Spinner';

interface AuditEntry {
  id: string;
  actor: { id: string | null; role: string | null; name: string | null; email: string | null };
  action: string;
  actionLabel: string;
  entity: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `منذ ${d} يوم`;
}

export default function RecentStaffActivity() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit-log?limit=20', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setEntries(data.entries ?? []);
      setError(null);
    } catch {
      setError('فشل تحميل النشاط');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-4">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
          <span>🛡️</span> نشاط المساعدين الأخير
        </h3>
        <button
          onClick={load}
          className="text-[11px] text-gray-500 hover:text-gray-900"
        >تحديث</button>
      </div>
      {loading ? (
        <div className="p-8 text-center"><Spinner inline size="sm" /></div>
      ) : error ? (
        <p className="p-6 text-xs text-red-500 text-center">{error}</p>
      ) : entries.length === 0 ? (
        <p className="p-6 text-xs text-gray-400 text-center">مفيش نشاط متسجّل لحد دلوقتي</p>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
          {entries.map(e => (
            <li key={e.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                e.actor.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {(e.actor.name || e.actor.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">
                  <span className={e.actor.role === 'admin' ? 'text-amber-700' : 'text-blue-700'}>
                    {e.actor.name || e.actor.email || '—'}
                  </span>
                  <span className="text-gray-500 font-normal mx-1">·</span>
                  <span className="text-gray-700 font-normal">{e.actionLabel}</span>
                </p>
                {e.entity && (
                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono" dir="ltr">
                    {e.entity}{e.entityId ? `:${e.entityId.slice(0, 8)}` : ''}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
