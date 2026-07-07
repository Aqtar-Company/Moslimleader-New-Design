'use client';

import { useEffect, useState, useCallback } from 'react';
import { governorates } from '@/lib/shipping';
import { useToast } from '@/components/ui/Toast';

interface RateRow {
  id: string;
  name: string;
  nameEn: string;
  rate: number;
}

export default function ShippingPage() {
  const { addToast } = useToast();
  const [rates, setRates] = useState<RateRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/shipping-rates', { credentials: 'include' });
      const data = await res.json();
      const ratesMap: Record<string, number> = {};
      (data.rates ?? []).forEach((r: { id: string; rate: number }) => { ratesMap[r.id] = r.rate; });
      setRates(governorates.map(g => ({
        id: g.id,
        name: g.name,
        nameEn: g.nameEn,
        rate: ratesMap[g.id] ?? g.shipping,
      })));
    } catch {
      setRates(governorates.map(g => ({
        id: g.id, name: g.name, nameEn: g.nameEn, rate: g.shipping,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (id: string, rate: number) => {
    setEditing(id);
    setEditVal(rate.toString());
  };

  const saveEdit = async (id: string) => {
    const val = parseInt(editVal);
    if (!isNaN(val) && val >= 0) {
      await fetch('/api/shipping-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ governorateId: id, rate: val }),
      });
      setRates(prev => prev.map(r => r.id === id ? { ...r, rate: val } : r));
      addToast('تم حفظ السعر', 'success');
    }
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">إعدادات الشحن</h1>
        <p className="text-sm text-gray-500 mt-0.5">تعديل أسعار الشحن المحلي (مصر)</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        اضغط على السعر لتعديله. التغييرات تُحفظ في قاعدة البيانات وتنعكس على صفحة الدفع.
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">جارٍ التحميل...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold">
                  <th className="px-5 py-3.5 text-right">المحافظة</th>
                  <th className="px-5 py-3.5 text-right">Governorate</th>
                  <th className="px-5 py-3.5 text-right">سعر الشحن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rates.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-semibold text-gray-900">{g.name}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{g.nameEn}</td>
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
                          onClick={() => startEdit(g.id, g.rate)}
                          className="font-bold hover:underline text-sm text-gray-900"
                        >
                          {g.rate} ج
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
