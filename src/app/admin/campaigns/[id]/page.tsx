'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';

interface Recipient {
  id: string;
  email: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  errorMessage: string | null;
  user: { id: string; name: string };
}

interface Campaign {
  id: string;
  name: string;
  channel: string;
  segmentKey: string;
  subject: string;
  bodyHtml: string;
  couponCode: string | null;
  status: string;
  recipientCount: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  conversionCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  recipients: Recipient[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة', sending: 'قيد الإرسال', sent: 'تم الإرسال', failed: 'فشلت',
};

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'فشل التحميل', 'error');
        return;
      }
      setCampaign(data.campaign);
    } catch {
      addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  }, [id, addToast]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (campaign?.status === 'sending') load();
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, campaign?.status]);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!campaign) return null;

  const sendProgress = pct(campaign.sentCount, campaign.recipientCount);

  return (
    <div className="space-y-5">
      <Link href="/admin/campaigns" className="text-xs text-gray-500 hover:text-gray-900">← العودة للحملات</Link>

      <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-black">{campaign.name}</h1>
            <p className="text-white/70 text-sm mt-1">{campaign.subject}</p>
          </div>
          <span className="bg-white/10 backdrop-blur border border-white/20 text-xs font-bold px-3 py-1.5 rounded-full">
            {STATUS_LABELS[campaign.status] || campaign.status}
          </span>
        </div>
        {campaign.status === 'sending' && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-white/80 mb-1.5">
              <span>التقدم</span>
              <span>{campaign.sentCount} / {campaign.recipientCount}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#F5C518] transition-all" style={{ width: `${sendProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon="👥" label="المستلمون" value={String(campaign.recipientCount)} />
        <KPI icon="✅" label="تم الإرسال" value={String(campaign.sentCount)} sub={`${pct(campaign.sentCount, campaign.recipientCount)}%`} />
        <KPI icon="👁️" label="فتح الرسالة" value={String(campaign.openedCount)} sub={`${pct(campaign.openedCount, campaign.sentCount)}%`} />
        <KPI icon="🖱️" label="نقر" value={String(campaign.clickedCount)} sub={`${pct(campaign.clickedCount, campaign.sentCount)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-black text-gray-900 mb-3">📋 المستلمون ({campaign.recipients.length})</h2>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-[10px] text-gray-500 font-semibold">
                  <th className="px-3 py-2 text-right">العميل</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">فتح</th>
                  <th className="px-3 py-2 text-right">نقر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaign.recipients.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <p className="font-bold text-gray-800">{r.user?.name || '—'}</p>
                      <p className="text-[10px] text-gray-400 truncate">{r.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        r.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                        r.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">{r.openedAt ? '✓' : '—'}</td>
                    <td className="px-3 py-2">{r.clickedAt ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-black text-gray-900 mb-3">📨 محتوى الإيميل</h2>
          <div className="bg-gray-50 rounded-xl p-3 max-h-96 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-2"><span className="font-bold">الموضوع:</span> {campaign.subject}</p>
            <div
              className="prose prose-sm bg-white p-3 rounded-lg"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: campaign.bodyHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <p className="text-xl mb-1">{icon}</p>
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-lg font-black text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
