'use client';

import { useState, useEffect } from 'react';

interface ReturnReq {
  id: string;
  orderId: string;
  type: string;
  reason: string;
  reasonNote?: string | null;
  status: string;
  itemsJson: unknown;
  refundAmount?: number | null;
  adminNote?: string | null;
  createdAt: string;
  order: { id: string; total: number; currency: string };
  user: { name: string; email: string; phone?: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
};

const REASON_LABELS: Record<string, string> = {
  defective: 'منتج معيب',
  wrong_item: 'منتج خاطئ',
  not_as_described: 'لا يطابق الوصف',
  other: 'سبب آخر',
};

export default function AdminReturnsPage() {
  const [requests, setRequests] = useState<ReturnReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = statusFilter ? `/api/admin/returns?status=${statusFilter}` : '/api/admin/returns';
    fetch(url, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  async function handleAction(id: string, action: 'approve' | 'reject' | 'complete') {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/returns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, adminNote, refundAmount: refundAmount ? Number(refundAmount) : null }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error); return; }
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'completed' } : r));
      setActiveId(null);
      setAdminNote('');
      setRefundAmount('');
    } finally {
      setSaving(false);
    }
  }

  const active = requests.find(r => r.id === activeId);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">طلبات الإرجاع والاستبدال</h1>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white">
          <option value="">كل الطلبات</option>
          <option value="pending">معلّق</option>
          <option value="approved">موافق عليه</option>
          <option value="rejected">مرفوض</option>
          <option value="completed">مكتمل</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 text-gray-400">لا توجد طلبات</div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-gray-900 text-sm">#{r.order.id.slice(-8).toUpperCase()}</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2.5 py-0.5 rounded-full">{r.type === 'return' ? '↩ إرجاع' : '🔄 استبدال'}</span>
                  </div>
                  <p className="text-sm text-gray-600">{r.user.name} · {r.user.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{REASON_LABELS[r.reason] ?? r.reason}{r.reasonNote ? ` — ${r.reasonNote}` : ''}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-sm font-black text-gray-900">{r.order.total} {r.order.currency}</p>
                  <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
              </div>

              {r.status === 'pending' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {activeId === r.id ? (
                    <div className="space-y-3">
                      <input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                        placeholder="ملاحظة للعميل (اختياري)"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" />
                      <input value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                        placeholder="مبلغ الاسترداد (اختياري)"
                        type="number" className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" />
                      <div className="flex gap-2">
                        <button onClick={() => handleAction(r.id, 'approve')} disabled={saving}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 rounded-xl transition">
                          ✓ موافقة
                        </button>
                        <button onClick={() => handleAction(r.id, 'reject')} disabled={saving}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-xl transition">
                          ✗ رفض
                        </button>
                        <button onClick={() => { setActiveId(null); setAdminNote(''); setRefundAmount(''); }}
                          className="px-4 text-gray-500 hover:text-gray-700 text-sm font-semibold">
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setActiveId(r.id)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-bold">
                      مراجعة الطلب ←
                    </button>
                  )}
                </div>
              )}

              {r.status === 'approved' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button onClick={() => handleAction(r.id, 'complete')} disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2 rounded-xl transition">
                    ✓ تم الاستلام — أكمل الإرجاع
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
