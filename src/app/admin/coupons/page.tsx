'use client';

import { useEffect, useState, useCallback } from 'react';

interface Coupon {
  code: string;
  discount: number;
  isActive: boolean;
  showBanner?: boolean;
  bannerText?: string;
  bannerColor?: string;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState('');
  const [pct, setPct] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/coupons', { credentials: 'include' });
      const data = await res.json();
      setCoupons(data.coupons ?? []);
    } catch {
      setError('تعذّر تحميل الكوبونات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setError('');
    const c = code.trim().toUpperCase();
    const p = parseInt(pct);
    if (!c) { setError('يرجى إدخال كود الكوبون'); return; }
    if (isNaN(p) || p < 1 || p > 100) { setError('نسبة الخصم يجب أن تكون بين 1 و 100'); return; }
    if (coupons.some(x => x.code === c)) { setError('هذا الكود موجود بالفعل'); return; }

    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code: c, discount: p }),
    });

    if (res.ok) {
      await load();
      setCode('');
      setPct('');
      setSuccess(`تم إضافة كوبون "${c}" بخصم ${p}%`);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      const d = await res.json();
      setError(d.error || 'حدث خطأ');
    }
  };

  const handleDelete = async (c: string) => {
    if (!confirm(`حذف كوبون "${c}"؟`)) return;
    await fetch(`/api/admin/coupons?code=${encodeURIComponent(c)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">الكوبونات</h1>
        <p className="text-sm text-gray-500 mt-0.5">{coupons.length} كوبون نشط</p>
      </div>

      {/* Add coupon form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-bold text-gray-800 text-sm mb-4">إضافة كوبون جديد</h2>
        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-3">{error}</p>}
        {success && <p className="text-green-700 text-sm bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 mb-3">{success}</p>}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-semibold text-gray-500 mb-1">كود الكوبون</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="مثال: SAVE30"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-gray-400 uppercase"
              dir="ltr"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-semibold text-gray-500 mb-1">نسبة الخصم %</label>
            <input
              type="number"
              value={pct}
              onChange={e => setPct(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="مثال: 20"
              min={1} max={100}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"
              dir="ltr"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAdd}
              className="bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold px-6 py-2.5 rounded-xl text-sm transition"
            >
              إضافة
            </button>
          </div>
        </div>
      </div>

      {/* Coupons list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">جارٍ التحميل...</p>
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">🎟️</p>
            <p className="font-semibold">لا توجد كوبونات</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-500 font-semibold">
                <th className="px-6 py-3.5 text-right">كود الكوبون</th>
                <th className="px-6 py-3.5 text-right">نسبة الخصم</th>
                <th className="px-6 py-3.5 text-right">قيمة الخصم (على طلب 500 ج)</th>
                <th className="px-6 py-3.5 text-center">بانر</th>
                <th className="px-6 py-3.5 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map(({ code: c, discount: p, showBanner }) => (
                <tr key={c} className={`hover:bg-gray-50 transition ${showBanner ? 'bg-amber-50' : ''}`}>
                  <td className="px-6 py-4">
                    <span className="font-mono font-black text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg text-sm tracking-wider">{c}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-green-700 font-bold text-base">{p}%</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    وفّر {Math.round(500 * p / 100)} ج.م على طلب بـ 500 ج
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={async () => {
                        await fetch('/api/admin/coupons', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ code: c, showBanner: !showBanner }),
                        });
                        await load();
                      }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${showBanner ? 'bg-amber-400 text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-amber-100'}`}
                    >
                      {showBanner ? '✦ ظاهر' : 'عرض'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleDelete(c)}
                      className="text-red-400 hover:text-red-600 font-bold text-sm transition hover:bg-red-50 px-3 py-1 rounded-lg"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-bold mb-1">ملاحظة:</p>
        <p>الكوبونات المضافة هنا تُحفظ في قاعدة البيانات وتظهر تلقائياً في صفحة الكارت.</p>
      </div>
    </div>
  );
}
