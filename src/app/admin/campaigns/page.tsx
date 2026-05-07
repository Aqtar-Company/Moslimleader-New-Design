'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { STATUS_LABELS } from '@/lib/admin-status';
import Spinner from '@/components/admin/Spinner';

interface Campaign {
  id: string;
  name: string;
  channel: string;
  segmentKey: string;
  subject: string;
  couponCode: string | null;
  status: string;
  recipientCount: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  conversionCount: number;
  createdAt: string;
  finishedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-700',
  sending: 'bg-blue-100 text-blue-700',
  sent:    'bg-emerald-100 text-emerald-700',
  failed:  'bg-red-100 text-red-700',
};

const SEGMENT_LABELS: Record<string, string> = {
  all: 'الكل', vip: 'VIP', active: 'نشطون', repeat: 'متكررون',
  single: 'مرة واحدة', dormant: 'نائمون', bought_all: 'اشتروا الكل',
};

function pct(n: number, total: number) {
  if (!total) return '0%';
  return Math.round((n / total) * 100) + '%';
}

export default function CampaignsPage() {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/campaigns', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    } catch {
      addToast('فشل تحميل الحملات', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    load();
    // Auto-refresh while any campaign is sending
    const interval = setInterval(() => {
      if (campaigns.some(c => c.status === 'sending')) load();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, campaigns.length]);

  const remove = async (c: Campaign) => {
    const ok = await confirm({
      title: 'حذف الحملة',
      message: `سيتم حذف الحملة "${c.name}" مع كل سجلات الإرسال والإحصائيات.`,
      confirmLabel: 'حذف',
      cancelLabel: 'إلغاء',
      tone: 'danger',
      icon: '🗑️',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/campaigns/${c.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) addToast(data.error || 'فشل الحذف', 'error');
      else {
        setCampaigns(prev => prev.filter(x => x.id !== c.id));
        addToast('تم الحذف', 'success');
      }
    } catch {
      addToast('فشل الحذف', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900">حملات التسويق</h1>
          <p className="text-sm text-gray-500 mt-0.5">{campaigns.length} حملة</p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="px-4 py-2.5 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-sm font-bold flex items-center gap-2 transition shadow-sm"
        >
          <span>✨</span> حملة جديدة
        </Link>
      </div>

      {loading ? (
        <Spinner />
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold">لا توجد حملات بعد</p>
          <Link href="/admin/campaigns/new" className="inline-block mt-3 text-blue-600 hover:underline text-sm font-bold">
            أنشئ أول حملة لك
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold">
                  <th className="px-5 py-3.5 text-right">الاسم</th>
                  <th className="px-5 py-3.5 text-right">الجمهور</th>
                  <th className="px-5 py-3.5 text-right">المرسل</th>
                  <th className="px-5 py-3.5 text-right">الفتح</th>
                  <th className="px-5 py-3.5 text-right">النقر</th>
                  <th className="px-5 py-3.5 text-right">تحويلات</th>
                  <th className="px-5 py-3.5 text-right">الكوبون</th>
                  <th className="px-5 py-3.5 text-right">الحالة</th>
                  <th className="px-5 py-3.5 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/campaigns/${c.id}`} className="block">
                        <p className="font-bold text-gray-900 hover:text-[#6B21A8]">{c.name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-xs">{c.subject}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">
                      {SEGMENT_LABELS[c.segmentKey] || c.segmentKey}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-gray-900">{c.sentCount}</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-gray-500">{c.recipientCount}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-emerald-700">{c.openedCount}</span>
                      <span className="text-[10px] text-gray-400 mr-1">({pct(c.openedCount, c.sentCount)})</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-blue-700">{c.clickedCount}</span>
                      <span className="text-[10px] text-gray-400 mr-1">({pct(c.clickedCount, c.sentCount)})</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-fuchsia-700">{c.conversionCount}</span>
                      <span className="text-[10px] text-gray-400 mr-1">({pct(c.conversionCount, c.sentCount)})</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {c.couponCode ? (
                        <span className="bg-amber-100 text-amber-700 font-mono font-bold px-2 py-0.5 rounded-md">{c.couponCode}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/campaigns/${c.id}`} className="text-xs font-bold text-blue-600 hover:underline">عرض</Link>
                        {c.status !== 'sending' && (
                          <button onClick={() => remove(c)} className="text-xs font-bold text-red-600 hover:text-red-700">حذف</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
