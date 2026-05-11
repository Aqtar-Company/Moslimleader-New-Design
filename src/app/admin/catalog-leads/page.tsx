'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import ForbiddenState from '@/components/admin/ForbiddenState';
import { ManualOrderModal } from '@/components/admin/ManualOrderModal';
import type { ManualOrderPrefill } from '@/components/admin/ManualOrderModal';
import { useToast } from '@/components/ui/Toast';

interface SelectedProductEntry {
  productId: string;
  variantId?: string;
  variantName?: string;
  name: string;
  quantity?: number;
  price?: number;
}

interface CatalogLead {
  id: string;
  name: string;
  phone: string;
  city: string;
  productId: string | null;
  productName: string;
  selectedProducts?: SelectedProductEntry[];
  notes: string | null;
  status: string;
  orderId: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:       { label: 'جديد',       color: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'تم التواصل', color: 'bg-amber-100 text-amber-700' },
  converted: { label: 'تم التحويل', color: 'bg-emerald-100 text-emerald-700' },
  closed:    { label: 'مغلق',       color: 'bg-gray-100 text-gray-500' },
};

const PAGE_SIZE = 50;

// Normalize any phone format to wa.me-compatible digits with country code.
// Handles: +966xxxxxxx, 00966xxxxxxx, 01xxxxxxxxx (Egypt local), bare digits.
function toWaMe(phone: string): string {
  const p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('+')) return p.slice(1);
  if (p.startsWith('00')) return p.slice(2);
  if (p.startsWith('0')) return `20${p.slice(1)}`;
  return `20${p}`;
}

export default function CatalogLeadsPage() {
  const { addToast } = useToast();
  const [leads, setLeads] = useState<CatalogLead[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<ManualOrderPrefill | undefined>();
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);

  const load = useCallback(async (off: number, sf: string, append = false) => {
    if (!append) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(off),
        ...(sf ? { status: sf } : {}),
      });
      const res = await adminFetch(`/api/admin/catalog-leads?${params}`);
      const data = await res.json();
      if (append) {
        setLeads(prev => [...prev, ...(data.leads ?? [])]);
      } else {
        setLeads(data.leads ?? []);
      }
      setTotal(data.total ?? 0);
    } catch (err) {
      if (err instanceof ForbiddenError) { setForbidden(true); return; }
      addToast('فشل تحميل الطلبات', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [addToast]);

  useEffect(() => {
    setOffset(0);
    load(0, statusFilter, false);
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    load(newOffset, statusFilter, true);
  };

  const updateStatus = async (id: string, status: string) => {
    if (updatingIds.has(id)) return;
    setUpdatingIds(prev => new Set(prev).add(id));
    try {
      const res = await adminFetch(`/api/admin/catalog-leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      addToast('تم تحديث الحالة', 'success');
    } catch {
      addToast('فشل التحديث', 'error');
    } finally {
      setUpdatingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const openConvertModal = (lead: CatalogLead) => {
    setConvertingLeadId(lead.id);
    setModalPrefill({
      name: lead.name,
      phone: lead.phone,
      city: lead.city,
      productId: lead.productId ?? undefined,
      notes: lead.notes ?? undefined,
      source: 'catalog',
      selectedProducts: lead.selectedProducts?.length
        ? lead.selectedProducts
        : undefined,
    });
    setModalOpen(true);
  };

  const handleOrderCreated = async (orderId?: string) => {
    if (convertingLeadId) {
      try {
        await adminFetch(`/api/admin/catalog-leads/${convertingLeadId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'converted', ...(orderId ? { orderId } : {}) }),
        });
        setLeads(prev => prev.map(l =>
          l.id === convertingLeadId
            ? { ...l, status: 'converted', orderId: orderId ?? l.orderId }
            : l,
        ));
      } catch { /* best-effort */ }
      setConvertingLeadId(null);
    }
    setModalOpen(false);
    setModalPrefill(undefined);
  };

  if (forbidden) return <ForbiddenState />;

  const hasMore = leads.length < total;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">طلبات الكتالوج</h1>
          <p className="text-xs text-gray-400 mt-0.5">{total} طلب من صفحة الكتالوج</p>
        </div>
        <a
          href="/catalog"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-4 py-2 rounded-xl hover:bg-emerald-100 transition"
        >
          📖 عرض الكتالوج
        </a>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {(['', 'new', 'contacted', 'converted', 'closed'] as const).map(val => {
          const label = val === '' ? 'الكل' : STATUS_LABELS[val]?.label ?? val;
          return (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                statusFilter === val
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-gray-400 text-sm">لا توجد طلبات {statusFilter ? 'بهذا الفلتر' : 'حتى الآن'}</p>
            <p className="text-gray-300 text-xs mt-1">يظهر هنا الطلبات الواردة من صفحة <a href="/catalog" target="_blank" className="underline text-emerald-400">/catalog</a></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-right text-xs font-bold text-gray-500">
                  <th className="px-4 py-3">الاسم</th>
                  <th className="px-4 py-3">الهاتف</th>
                  <th className="px-4 py-3">المدينة</th>
                  <th className="px-4 py-3">المنتج</th>
                  <th className="px-4 py-3">الملاحظات</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map(lead => {
                  const st = STATUS_LABELS[lead.status] ?? { label: lead.status, color: 'bg-gray-100 text-gray-500' };
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{lead.name}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://wa.me/${toWaMe(lead.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:underline font-mono text-xs"
                        >
                          {lead.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.city}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                        {lead.selectedProducts && lead.selectedProducts.length > 0 ? (
                          <div className="space-y-0.5">
                            {lead.selectedProducts.map((sp, i) => (
                              <div key={i} className="text-xs leading-snug flex items-center gap-1">
                                <span className="font-medium text-gray-800 truncate max-w-[130px]" title={sp.name}>{sp.name}</span>
                                {sp.quantity && sp.quantity > 1 && (
                                  <span className="shrink-0 bg-gray-100 text-gray-500 rounded px-1 font-bold">×{sp.quantity}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="line-clamp-2 text-xs leading-snug">{lead.productName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px]">
                        <span className="line-clamp-2">{lead.notes || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={e => updateStatus(lead.id, e.target.value)}
                          disabled={updatingIds.has(lead.id)}
                          className={`text-xs font-bold px-2 py-1 rounded-lg border-0 cursor-pointer disabled:opacity-50 ${st.color}`}
                        >
                          {Object.entries(STATUS_LABELS).map(([v, { label }]) => (
                            <option key={v} value={v}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(lead.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-nowrap">
                          {lead.status !== 'converted' ? (
                            <button
                              onClick={() => openConvertModal(lead)}
                              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                            >
                              تحويل لطلب
                            </button>
                          ) : lead.orderId ? (
                            <a
                              href={`/admin/orders?highlight=${lead.orderId}`}
                              className="text-xs font-bold text-emerald-600 hover:underline whitespace-nowrap"
                            >
                              عرض الطلب
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">تم التحويل</span>
                          )}
                          <a
                            href={`https://wa.me/${toWaMe(lead.phone)}?text=${encodeURIComponent(`السلام عليكم ${lead.name}، شوفنا طلبك على ${lead.productName}، هنتواصل معاك قريباً`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold bg-[#25D366] hover:bg-[#1ebe5d] text-white px-2.5 py-1.5 rounded-lg transition"
                            title="واتساب"
                          >
                            💬
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="px-4 py-3 border-t border-gray-100 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-800 disabled:opacity-50 transition"
            >
              {loadingMore ? 'جاري التحميل...' : `عرض المزيد (${total - leads.length} متبقي)`}
            </button>
          </div>
        )}
      </div>

      <ManualOrderModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setConvertingLeadId(null); setModalPrefill(undefined); }}
        onCreated={handleOrderCreated}
        prefill={modalPrefill}
      />
    </div>
  );
}
