'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
  balance: number;
}

interface Totals {
  count: number;
  totalSpend: number;
  totalOutstanding: number;
  totalOverpaid: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => `${fmt(n)} ج.م`;
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB') : '—';

// Operational view of wholesale dealers: who buys, how much, who owes
// us money. Marketing segmentation stays under /admin/customers.
export default function WholesalePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'owes' | 'settled'>('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/wholesale');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        setRows(data.rows);
        setTotals(data.totals);
      } catch (err) {
        if (err instanceof ForbiddenError) setForbidden(true);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !(r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.phone || '').includes(q))) return false;
      if (filter === 'owes' && r.balance <= 0) return false;
      if (filter === 'settled' && r.balance !== 0) return false;
      return true;
    });
  }, [rows, search, filter]);

  if (forbidden) return <ForbiddenState requiredPerm="wholesale.read" />;
  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-l from-blue-700 via-indigo-700 to-[#1a1a2e] rounded-2xl p-4 sm:p-6 text-white">
        <h1 className="text-lg sm:text-xl font-black flex items-center gap-2">🏪 تجار الجملة — العرض التشغيلي</h1>
        <p className="text-white/85 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          صفحة مخصصة للحسابات والمعاملات المالية مع تجار الجملة. للتسويق وإدارة العلامة، استخدم
          <Link href="/admin/customers" className="text-[#F5C518] hover:underline mx-1">قاعدة العملاء</Link>
          مع فلتر "تاجر جملة".
        </p>
        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
            <Stat label="عدد التجار" value={fmt(totals.count)} />
            <Stat label="إجمالي المبيعات لهم" value={fmtMoney(totals.totalSpend)} />
            <Stat label="مديونية مستحقة" value={fmtMoney(totals.totalOutstanding)} highlight={totals.totalOutstanding > 0} />
            <Stat label="دفعات زائدة" value={fmtMoney(totals.totalOverpaid)} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ابحث بالاسم أو الإيميل أو التليفون..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-gray-400 w-full sm:w-72"
        />
        <div className="flex gap-2 flex-wrap">
          {([
            { k: 'all', label: '📋 الكل' },
            { k: 'owes', label: '💰 يدينون لنا' },
            { k: 'settled', label: '✓ مسوَّى' },
          ] as const).map(f => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === f.k ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={rows.length === 0 ? 'مفيش تجار جملة لسه — حدّد العلامة من صفحة العميل في قاعدة العملاء' : 'مفيش تجار مطابقين'}
          icon="🏪"
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <p className="lg:hidden text-[10px] text-gray-500 px-3 py-2 bg-gray-50 border-b border-gray-200">↔️ اسحب جانبياً لرؤية كل الأعمدة</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-right">التاجر</th>
                  <th className="px-3 py-3 text-right">الطلبات</th>
                  <th className="px-3 py-3 text-right">إجمالي المبيعات</th>
                  <th className="px-3 py-3 text-right">آخر طلب</th>
                  <th className="px-3 py-3 text-right">الرصيد</th>
                  <th className="px-3 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => {
                  const owesUs = r.balance > 0;
                  const overpaid = r.balance < 0;
                  const balanceTone = owesUs ? 'text-red-700' : overpaid ? 'text-emerald-700' : 'text-gray-500';
                  const balanceLabel = owesUs ? 'يدين لنا' : overpaid ? 'دفع زيادة' : 'مسوّى';
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-gray-900">{r.name}</p>
                        <p className="text-[10px] text-gray-500" dir="ltr">{r.email}</p>
                        {r.phone && <p className="text-[10px] text-gray-400 font-mono" dir="ltr">{r.phone}</p>}
                      </td>
                      <td className="px-3 py-2.5 font-bold">{fmt(r.orderCount)}</td>
                      <td className="px-3 py-2.5 font-bold" dir="ltr">{fmtMoney(r.totalSpend)}</td>
                      <td className="px-3 py-2.5 text-[10px] font-mono text-gray-600" dir="ltr">{fmtDate(r.lastOrderAt)}</td>
                      <td className="px-3 py-2.5">
                        <p className={`font-black ${balanceTone}`} dir="ltr">{fmtMoney(Math.abs(r.balance))}</p>
                        <p className={`text-[10px] ${balanceTone}`}>{balanceLabel}</p>
                      </td>
                      <td className="px-3 py-2.5 text-left">
                        <Link href={`/admin/wholesale/${r.id}`} className="text-blue-700 hover:underline text-[11px] font-bold">
                          تفاصيل ←
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)' }}>
      <p className="text-[10px] text-white/60 font-bold tracking-widest">{label}</p>
      <p className={`text-xl font-black mt-1 ${highlight ? 'text-[#F5C518]' : 'text-white'}`}>{value}</p>
    </div>
  );
}
