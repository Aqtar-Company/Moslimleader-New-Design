'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { toIntlPhone, whatsappLink } from '@/lib/phone';
import { PaginationFooter } from '@/components/admin/PaginationFooter';
import Spinner from '@/components/admin/Spinner';

interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  totalSpend: number;
  avgOrder: number;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  productIds: string[];
  lastGovernorate: string | null;
  segments: string[];
}

const SEGMENTS: Array<{ key: string; label: string; icon: string; tone: string }> = [
  { key: 'all',        label: 'الكل',           icon: '👥', tone: 'bg-gray-100 text-gray-700' },
  { key: 'vip',        label: 'VIP',            icon: '👑', tone: 'bg-amber-100 text-amber-700' },
  { key: 'active',     label: 'نشطون',          icon: '🔥', tone: 'bg-emerald-100 text-emerald-700' },
  { key: 'repeat',     label: 'متكررون',        icon: '🔁', tone: 'bg-blue-100 text-blue-700' },
  { key: 'single',     label: 'مرة واحدة',      icon: '🆕', tone: 'bg-purple-100 text-purple-700' },
  { key: 'dormant',    label: 'نائمون',         icon: '💤', tone: 'bg-rose-100 text-rose-700' },
  { key: 'bought_all', label: 'اشتروا كل المنتجات', icon: '✨', tone: 'bg-fuchsia-100 text-fuchsia-700' },
  { key: 'wholesale',  label: 'تجار جملة',         icon: '🏪', tone: 'bg-blue-100 text-blue-700' },
  { key: 'converted',  label: 'اتحوّل من استيراد', icon: '🔄', tone: 'bg-amber-100 text-amber-700' },
];

const SORTS: Array<{ key: string; label: string }> = [
  { key: 'spend',  label: 'الأكثر إنفاقًا' },
  { key: 'recent', label: 'آخر طلب' },
  { key: 'orders', label: 'عدد الطلبات' },
];

function formatPrice(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

function timeAgoAr(iso: string | null): string {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 30) return `من ${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `من ${months} شهر`;
  const years = Math.floor(months / 12);
  return `من ${years} سنة`;
}

export default function CustomersPage() {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [segment, setSegment] = useState('all');
  const [sort, setSort] = useState('spend');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [bulkMessage, setBulkMessage] = useState(
    'مرحبًا 👋\nمن Moslim Leader، عندنا منتج جديد ممكن يعجبك. تحب أبعتلك التفاصيل؟',
  );

  const load = useCallback(async (limitOverride?: number) => {
    setLoading(true);
    try {
      const effectiveLimit = limitOverride ?? pageSize;
      const params = new URLSearchParams({ segment, sort, limit: String(effectiveLimit), offset: '0' });
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/admin/customers?${params}`, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      setCustomers(data.customers ?? []);
      setCounts(data.counts ?? {});
      setTotal(data.total ?? (data.customers?.length ?? 0));
      if (limitOverride) setPageSize(limitOverride);
    } catch {
      addToast('فشل تحميل العملاء', 'error');
    }
    setLoading(false);
  }, [segment, sort, search, pageSize, addToast]);

  useEffect(() => {
    setPageSize(50); // reset page size on filter/search change
    const t = setTimeout(() => load(50), search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, sort, search]);

  const totalSpend = useMemo(() => customers.reduce((s, c) => s + c.totalSpend, 0), [customers]);

  const reachableCount = useMemo(
    () => customers.filter(c => toIntlPhone(c.phone)).length,
    [customers],
  );

  const copyAllPhones = async () => {
    const phones = customers
      .map(c => toIntlPhone(c.phone))
      .filter((p): p is string => Boolean(p))
      .map(p => '+' + p);
    await navigator.clipboard.writeText(phones.join('\n'));
    addToast(`تم نسخ ${phones.length} رقم`, 'success');
  };

  const copyAllLinks = async () => {
    const links = customers
      .map(c => whatsappLink(c.phone, bulkMessage))
      .filter((l): l is string => Boolean(l));
    await navigator.clipboard.writeText(links.join('\n'));
    addToast(`تم نسخ ${links.length} رابط واتساب`, 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900">قاعدة العملاء</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {customers.length} عميل · إجمالي مبيعاتهم {formatPrice(totalSpend)} ج.م
          </p>
        </div>
        {reachableCount > 0 && segment !== 'all' && (
          <button
            onClick={() => setBulkOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 transition shadow-sm"
          >
            <span>📱</span> أرسل واتساب لـ {reachableCount} عميل
          </button>
        )}
      </div>

      {/* Segment chips */}
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map(s => (
          <button
            key={s.key}
            onClick={() => setSegment(s.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              segment === s.key
                ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                : `${s.tone} border-transparent hover:opacity-80`
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
              segment === s.key ? 'bg-white/20' : 'bg-white/60'
            }`}>
              {counts[s.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ابحث بالاسم، الإيميل، أو التليفون..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 w-full sm:w-80"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 bg-white cursor-pointer"
        >
          {SORTS.map(s => <option key={s.key} value={s.key}>ترتيب: {s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {customers.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-4xl mb-3">👥</p>
              <p className="font-semibold">لا يوجد عملاء بهذا التصنيف</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-xs text-gray-500 font-semibold">
                    <th className="px-5 py-3.5 text-right">العميل</th>
                    <th className="px-5 py-3.5 text-right">المحافظة</th>
                    <th className="px-5 py-3.5 text-right">طلبات</th>
                    <th className="px-5 py-3.5 text-right">منتجات</th>
                    <th className="px-5 py-3.5 text-right">إجمالي</th>
                    <th className="px-5 py-3.5 text-right">آخر طلب</th>
                    <th className="px-5 py-3.5 text-right">التصنيف</th>
                    <th className="px-5 py-3.5 text-right">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.map(c => {
                    const wa = whatsappLink(
                      c.phone,
                      `مرحبًا ${c.name.split(' ')[0]} 👋\nمن Moslim Leader.`,
                    );
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5">
                          <Link href={`/admin/customers/${c.id}`} className="block">
                            <p className="font-bold text-gray-900 hover:text-[#6B21A8]">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.email}</p>
                            {c.phone && <p className="text-[11px] text-gray-500 font-mono mt-0.5" dir="ltr">{c.phone}</p>}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600">{c.lastGovernorate || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-gray-900">{c.orderCount}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600">{c.productIds.length}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-black text-[#6B21A8]">{formatPrice(c.totalSpend)}</span>
                          <span className="text-[10px] text-gray-400 mr-1">ج.م</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">{timeAgoAr(c.lastOrderAt)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {c.segments.map(s => {
                              const seg = SEGMENTS.find(x => x.key === s);
                              if (!seg) return null;
                              return (
                                <span key={s} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${seg.tone}`}>
                                  {seg.icon}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/customers/${c.id}`}
                              className="text-xs font-bold text-blue-600 hover:underline"
                            >عرض</Link>
                            {wa ? (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                                title="فتح واتساب"
                              >📱</a>
                            ) : (
                              <span className="text-xs text-gray-300" title="رقم غير متاح">📱</span>
                            )}
                            {c.email && (
                              <a
                                href={`mailto:${c.email}`}
                                className="text-xs text-gray-500 hover:text-gray-700"
                                title="إرسال إيميل"
                              >📧</a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <PaginationFooter
        shown={customers.length}
        total={total}
        loading={loading}
        onLoadMore={() => load(pageSize + 50)}
        onLoadAll={() => load(total)}
      />

      {/* Bulk WhatsApp modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-black">📱 إرسال واتساب جماعي</h3>
              <button onClick={() => setBulkOpen(false)} className="text-white/70 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
                💡 الواتساب click-to-chat بيفتح محادثة واحدة في كل مرة. للإرسال الجماعي:
                انسخ الأرقام أو الروابط، ولصقها في تطبيق Bulk Sender (مثلاً WhatsApp Bulk Sender).
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">الرسالة</label>
                <textarea
                  value={bulkMessage}
                  onChange={e => setBulkMessage(e.target.value)}
                  rows={5}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none"
                  placeholder="اكتب رسالتك..."
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  هتظهر نفس الرسالة لكل العملاء. مفيش placeholders في النسخة دي.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  📊 <span className="font-bold">{reachableCount}</span> عميل يقدروا يستقبلوا واتساب
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={copyAllPhones}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
                >📋 نسخ الأرقام فقط</button>
                <button
                  onClick={copyAllLinks}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                >🔗 نسخ روابط wa.me</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
