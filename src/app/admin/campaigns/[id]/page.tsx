'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { adminFetch, adminJson } from '@/lib/admin-fetch';
import { sanitizeHtml } from '@/lib/sanitize';
import { timeAgoAr } from '@/lib/format';
import { STATUS_LABELS } from '@/lib/admin-status';
import Spinner from '@/components/admin/Spinner';

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
  bodyText: string | null;
  bodyHtml: string;
  couponCode: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  dailyLimit: number;
  lastBatchAt: string | null;
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

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [counts, setCounts] = useState<{ queued: number; sent: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingBatch, setSendingBatch] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/campaigns/${id}`);
      const data = await res.json();
      setCampaign(data.campaign);
      setCounts(data.counts ?? null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل التحميل', 'error');
    }
    setLoading(false);
  }, [id, addToast]);

  const sendDailyBatch = async () => {
    if (!campaign) return;
    const ok = await confirm({
      title: 'إرسال دفعة اليوم',
      message: `هتبعت ${campaign.dailyLimit} رسالة للمستلمين اللي لسه ما اتبعتلهمش. كرر مرة كل يوم.`,
      confirmLabel: `أرسل ${campaign.dailyLimit}`,
      cancelLabel: 'إلغاء',
      icon: '📨',
    });
    if (!ok) return;
    setSendingBatch(true);
    try {
      const data = await adminJson<{ sent: number; failed: number; queuedRemaining: number; finished: boolean }>(
        `/api/admin/campaigns/${id}/send-daily-batch`,
        { method: 'POST' },
      );
      if (data.finished) {
        addToast('خلصت الحملة! كل المستلمين اتبعتلهم.', 'success', 6000);
      } else if (data.sent === 0) {
        addToast('مفيش مستلمين متبقين', 'warning');
      } else {
        const failedNote = data.failed ? ` (فشل ${data.failed})` : '';
        addToast(`تم إرسال ${data.sent} رسالة${failedNote} · المتبقي ${data.queuedRemaining}`, 'success', 5000);
      }
      await load();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الإرسال', 'error');
    } finally {
      setSendingBatch(false);
    }
  };

  // Read latest status via a ref so the polling effect can stay mounted with
  // a single interval without leaking when status flips to `sent`/`failed`.
  const statusRef = useRef<string | undefined>();
  statusRef.current = campaign?.status;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (statusRef.current === 'sending') load();
    }, 3000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <Spinner />;
  if (!campaign) return null;

  const sendProgress = pct(campaign.sentCount, campaign.recipientCount);
  // Server-computed — the recipients array is truncated to 200 so we can't
  // infer queuedRemaining from it for large campaigns.
  const queuedRemaining = counts?.queued ?? campaign.recipients.filter(r => r.status === 'queued').length;
  const canDailyBatch = campaign.status !== 'sent' && campaign.dailyLimit > 0;

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

        {/* Daily-drip control + progress strip */}
        {canDailyBatch && (
          <div className="mt-5 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <p className="text-xs font-bold text-[#F5C518] uppercase tracking-wide">دفعة يومية</p>
                <p className="text-[11px] text-white/60 mt-0.5">آخر دفعة: {timeAgoAr(campaign.lastBatchAt)}</p>
              </div>
              <button
                onClick={sendDailyBatch}
                disabled={sendingBatch || queuedRemaining === 0}
                className="px-4 py-2.5 rounded-xl bg-[#F5C518] hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#1a1a2e] text-sm font-black transition shadow-sm"
              >
                {sendingBatch ? '⏳ جاري الإرسال...' : queuedRemaining === 0 ? '✓ خلص الجمهور' : `📨 أرسل ${Math.min(campaign.dailyLimit, queuedRemaining)} اليوم`}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <p className="text-white/50">اتبعتوا</p>
                <p className="text-white font-black text-base mt-0.5">{campaign.sentCount}</p>
              </div>
              <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <p className="text-white/50">المتبقي</p>
                <p className="text-white font-black text-base mt-0.5">{queuedRemaining}</p>
              </div>
              <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <p className="text-white/50">الإجمالي</p>
                <p className="text-white font-black text-base mt-0.5">{campaign.recipientCount}</p>
              </div>
            </div>
          </div>
        )}
        {campaign.status === 'sending' && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-white/80 mb-1.5">
              <span>التقدم</span>
              <span>{campaign.sentCount} / {campaign.recipientCount}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#F5C518] transition-all" style={{ width: `${sendProgress}%` }} />
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/admin/campaigns/${campaign.id}/resume`, { method: 'POST', credentials: 'include' });
                  const data = await res.json();
                  if (!res.ok) addToast(data.error || 'فشل الاستئناف', 'error');
                  else addToast(`تم استئناف الإرسال (${data.queued} متبقي)`, 'success');
                  load();
                } catch {
                  addToast('فشل الاستئناف', 'error');
                }
              }}
              className="text-[10px] text-white/60 hover:text-white underline"
            >
              لو الإرسال عالق، اضغط هنا للاستئناف
            </button>
          </div>
        )}
        {campaign.status === 'failed' && (
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/admin/campaigns/${campaign.id}/resume`, { method: 'POST', credentials: 'include' });
                const data = await res.json();
                if (!res.ok) addToast(data.error || 'فشل الاستئناف', 'error');
                else addToast(`بدأ الاستئناف (${data.queued} متبقي)`, 'success');
                load();
              } catch {
                addToast('فشل الاستئناف', 'error');
              }
            }}
            className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
          >🔁 استئناف الإرسال</button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI icon="👥" label="المستلمون" value={String(campaign.recipientCount)} />
        <KPI icon="✅" label="تم الإرسال" value={String(campaign.sentCount)} sub={`${pct(campaign.sentCount, campaign.recipientCount)}%`} />
        <KPI icon="👁️" label="فتح الرسالة" value={String(campaign.openedCount)} sub={`${pct(campaign.openedCount, campaign.sentCount)}%`} />
        <KPI icon="🖱️" label="نقر" value={String(campaign.clickedCount)} sub={`${pct(campaign.clickedCount, campaign.sentCount)}%`} />
        <KPI icon="🛒" label="تحويلات" value={String(campaign.conversionCount)} sub={`${pct(campaign.conversionCount, campaign.sentCount)}%`} />
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
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(campaign.bodyHtml) }}
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
