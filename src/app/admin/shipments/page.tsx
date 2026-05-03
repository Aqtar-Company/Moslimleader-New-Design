'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface Shipment {
  id: string;
  orderId: string;
  provider: string;
  bostaDeliveryId: string | null;
  trackingNumber: string | null;
  status: string;
  state: string | null;
  cod: number;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    status: string;
    total: number;
    currency: string;
    paymentMethod: string;
    createdAt: string;
    shippingAddress: { firstName?: string; lastName?: string; phone?: string; city?: string; governorate?: string };
    user: { name: string; email: string };
  };
}

const STATUS_LABELS: Record<string, string> = {
  created: 'تم الإنشاء',
  shipped: 'في الطريق',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-amber-100 text-amber-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function ShipmentsPage() {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importStats, setImportStats] = useState({ totalSeen: 0, imported: 0, linked: 0, skipped: 0 });
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shipments', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      setShipments(data.shipments ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/admin/shipments/${id}/refresh`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.shipment) {
        setShipments(prev => prev.map(s => s.id === id ? { ...s, ...data.shipment } : s));
        addToast('تم تحديث حالة الشحنة', 'success');
      } else if (data.error) {
        addToast(data.error, 'error');
      }
    } catch {
      addToast('فشل التحديث', 'error');
    }
    setRefreshingId(null);
  };

  const cancelOnBosta = async (s: Shipment) => {
    const ok = await confirm({
      title: 'إلغاء الشحنة من بوسطة',
      message: 'هيتم إلغاء الشحنة من بوسطة فقط، والأوردر هيرجع لـ "قيد التجهيز" عشان تقدر تشحنه بشركة تانية. مش هيتلغى الأوردر.',
      confirmLabel: 'إلغاء من بوسطة',
      cancelLabel: 'تراجع',
      tone: 'danger',
      icon: '🚫',
    });
    if (!ok) return;
    setCancellingId(s.id);
    try {
      const res = await fetch(`/api/admin/shipments/${s.id}/cancel`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'فشل الإلغاء', 'error', 6000);
      } else {
        setShipments(prev => prev.map(x => x.id === s.id
          ? { ...x, status: 'cancelled', order: { ...x.order, status: 'pending' } }
          : x));
        addToast('تم إلغاء الشحنة من بوسطة. الأوردر رجع لـ "قيد التجهيز"', 'success', 5000);
      }
    } catch {
      addToast('فشل الإلغاء', 'error');
    }
    setCancellingId(null);
  };

  const startImport = async () => {
    const ok = await confirm({
      title: 'استيراد كل شحنات بوسطة القديمة',
      message: 'هيتم سحب كل الشحنات اللي عملناها على بوسطة وإنشاء سجلات عملاء + أوردرات تاريخية لها. العملية idempotent — التشغيل تاني مش هيعمل تكرار. هتستغرق دقايق حسب الحجم.',
      confirmLabel: 'ابدأ الاستيراد',
      cancelLabel: 'إلغاء',
      icon: '📥',
    });
    if (!ok) return;
    setImportOpen(true);
    setImportLog([]);
    setImportStats({ totalSeen: 0, imported: 0, linked: 0, skipped: 0 });
    setImporting(true);
    setImportDone(false);
    try {
      const res = await fetch('/api/admin/bosta/import-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ maxPages: 200, pageSize: 50 }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        addToast(err.error || 'فشل الاستيراد', 'error');
        setImporting(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'page' || msg.type === 'done') {
              setImportStats({
                totalSeen: msg.totalSeen ?? 0,
                imported: msg.imported ?? 0,
                linked: msg.linked ?? 0,
                skipped: msg.skipped ?? 0,
              });
            }
            if (msg.type === 'log' || msg.type === 'error') {
              setImportLog(prev => [...prev, msg.message || ''].slice(-50));
            }
            if (msg.type === 'done') {
              setImportDone(true);
              addToast(`الاستيراد خلص: ${msg.imported} عميل جديد · ${msg.linked} ربط بأوردر موجود`, 'success', 7000);
              load();
            }
            if (msg.type === 'error') {
              addToast(msg.message || 'فشل الاستيراد', 'error', 7000);
            }
          } catch {}
        }
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الاستيراد', 'error');
    }
    setImporting(false);
  };

  const filtered = shipments.filter(s => {
    const matchFilter = filter === 'all' || s.status === filter;
    const q = search.trim().toLowerCase();
    if (!q) return matchFilter;
    const matchSearch =
      s.orderId.toLowerCase().includes(q) ||
      (s.trackingNumber || '').toLowerCase().includes(q) ||
      (s.order?.user?.name || '').toLowerCase().includes(q) ||
      (s.order?.user?.email || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900">شحنات بوسطة</h1>
          <p className="text-sm text-gray-500 mt-0.5">{shipments.length} شحنة</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={startImport}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-[#1a1a2e] hover:bg-[#2d1060] text-white transition shadow-sm"
          >📥 استيراد التاريخ القديم</button>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/admin/bosta/ping', { credentials: 'include' });
                const data = await res.json();
                if (data.ok) addToast(`✓ التوكن شغال — ${data.baseUrl}`, 'success', 5000);
                else addToast(data.error || 'فشل الاتصال', 'error', 6000);
              } catch {
                addToast('فشل الاتصال ببوسطة', 'error');
              }
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
          >🔌 اختبار الاتصال</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ابحث برقم التتبع، رقم الطلب، أو العميل..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 w-full sm:w-80"
        />
        <div className="flex gap-2 flex-wrap">
          {['all', 'created', 'shipped', 'delivered', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === s ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {s === 'all' ? 'الكل' : (STATUS_LABELS[s] || s)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-3">📦</p><p className="font-semibold">لا توجد شحنات</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold">
                  <th className="px-5 py-3.5 text-right">رقم الطلب</th>
                  <th className="px-5 py-3.5 text-right">رقم التتبع</th>
                  <th className="px-5 py-3.5 text-right">العميل</th>
                  <th className="px-5 py-3.5 text-right">الوجهة</th>
                  <th className="px-5 py-3.5 text-right">COD</th>
                  <th className="px-5 py-3.5 text-right">الحالة</th>
                  <th className="px-5 py-3.5 text-right">آخر حالة بوسطة</th>
                  <th className="px-5 py-3.5 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-mono font-bold text-gray-900">#{s.orderId.slice(-6).toUpperCase()}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-700">{s.trackingNumber || '—'}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">{s.order?.user?.name || '—'}</p>
                      <p className="text-xs text-gray-400">{s.order?.shippingAddress?.phone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">
                      {s.order?.shippingAddress?.governorate || '—'}
                      {s.order?.shippingAddress?.city ? ` — ${s.order.shippingAddress.city}` : ''}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-bold text-gray-700">
                      {s.cod > 0 ? `${s.cod} EGP` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">{s.state || '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2 items-center">
                        {s.trackingNumber && (
                          <a
                            href={`https://bosta.co/en/track-shipment/${s.trackingNumber}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs font-bold text-blue-600 hover:underline"
                          >تتبع</a>
                        )}
                        <button
                          onClick={() => refresh(s.id)}
                          disabled={refreshingId === s.id}
                          className="text-xs font-bold text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          {refreshingId === s.id ? '...' : 'تحديث'}
                        </button>
                        {s.status !== 'cancelled' && s.bostaDeliveryId && (
                          <button
                            onClick={() => cancelOnBosta(s)}
                            disabled={cancellingId === s.id}
                            className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                            title="إلغاء من بوسطة فقط (الأوردر يبقى)"
                          >
                            {cancellingId === s.id ? '...' : 'إلغاء بوسطة'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import progress modal */}
      {importOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-black flex items-center gap-2">
                <span>📥</span> استيراد شحنات بوسطة القديمة
              </h3>
              {!importing && (
                <button onClick={() => setImportOpen(false)} className="text-white/70 hover:text-white text-xl">×</button>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-500 font-bold">إجمالي شوفناه</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{importStats.totalSeen}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-emerald-700 font-bold">عملاء جدد</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{importStats.imported}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-blue-700 font-bold">ربط بأوردر</p>
                  <p className="text-2xl font-black text-blue-700 mt-1">{importStats.linked}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-amber-700 font-bold">تخطّى</p>
                  <p className="text-2xl font-black text-amber-700 mt-1">{importStats.skipped}</p>
                </div>
              </div>

              {importing && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <div className="w-4 h-4 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                  <span>جاري السحب من بوسطة...</span>
                </div>
              )}
              {importDone && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-sm text-emerald-700 font-bold">
                  ✓ تم الانتهاء — افتح صفحة "قاعدة العملاء" لتشوف العملاء الجدد
                </div>
              )}

              {importLog.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-3 max-h-40 overflow-y-auto">
                  {importLog.map((line, i) => (
                    <p key={i} className="text-[11px] text-gray-300 font-mono leading-relaxed" dir="ltr">{line}</p>
                  ))}
                </div>
              )}

              {!importing && (
                <button
                  onClick={() => setImportOpen(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition"
                >إغلاق</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
