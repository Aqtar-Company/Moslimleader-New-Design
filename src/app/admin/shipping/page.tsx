'use client';

import { useEffect, useState, useCallback } from 'react';
import { governorates } from '@/lib/shipping';
import { getShippingOverrides, saveShippingOverrides, ShippingOverrides } from '@/lib/admin-storage';

export default function ShippingPage() {
  const [overrides, setOverrides] = useState<ShippingOverrides>({ local: {} });
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => { setOverrides(getShippingOverrides()); }, []);
  useEffect(() => { load(); }, [load]);

  const startEdit = (govId: string, currentPrice: number) => {
    setEditing(govId);
    setEditVal(currentPrice.toString());
  };

  const saveEdit = (govId: string) => {
    const val = parseInt(editVal);
    if (!isNaN(val) && val >= 0) {
      const next = { ...overrides, local: { ...overrides.local, [govId]: val } };
      setOverrides(next);
      saveShippingOverrides(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setEditing(null);
  };

  const resetAll = () => {
    if (!confirm('إعادة تعيين جميع أسعار الشحن للقيم الافتراضية؟')) return;
    const reset: ShippingOverrides = { local: {} };
    setOverrides(reset);
    saveShippingOverrides(reset);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">إعدادات الشحن</h1>
          <p className="text-sm text-gray-500 mt-0.5">تعديل أسعار الشحن المحلي (مصر)</p>
        </div>
        <div className="flex gap-2 items-center">
          {saved && <span className="text-green-600 text-sm font-semibold">✓ تم الحفظ</span>}
          <button
            onClick={resetAll}
            className="border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 font-semibold px-4 py-2 rounded-xl text-sm transition"
          >
            إعادة تعيين
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        اضغط على السعر لتعديله. التغييرات تُحفظ فوراً وتنعكس على صفحة الدفع.
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-500 font-semibold">
                <th className="px-5 py-3.5 text-right">المحافظة</th>
                <th className="px-5 py-3.5 text-right">Governorate</th>
                <th className="px-5 py-3.5 text-right">السعر الأصلي</th>
                <th className="px-5 py-3.5 text-right">السعر الحالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {governorates.map(g => {
                const current = overrides.local[g.id] ?? g.shipping;
                const isOverridden = overrides.local[g.id] !== undefined && overrides.local[g.id] !== g.shipping;
                return (
                  <tr key={g.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-semibold text-gray-900">{g.name}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{g.nameEn}</td>
                    <td className="px-5 py-3 text-gray-400">{g.shipping} ج</td>
                    <td className="px-5 py-3">
                      {editing === g.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(g.id); if (e.key === 'Escape') setEditing(null); }}
                            autoFocus
                            className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#F5C518]"
                            min={0}
                          />
                          <span className="text-gray-500 text-xs">ج</span>
                          <button onClick={() => saveEdit(g.id)} className="text-green-600 hover:text-green-700 font-bold text-sm">✓</button>
                          <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(g.id, current)}
                          className={`font-bold hover:underline text-sm ${isOverridden ? 'text-amber-600' : 'text-gray-900'}`}
                        >
                          {current} ج
                          {isOverridden && <span className="text-xs text-amber-500 mr-1">(معدّل)</span>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
