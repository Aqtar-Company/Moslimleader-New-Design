'use client';

import { useEffect, useState, useCallback } from 'react';

interface Sponsor {
  id: string; name: string; phone?: string; email?: string;
  organization?: string; isActive: boolean; createdAt: string;
  _count: { copies: number; sponsoredOrders: number };
  user?: { id: string; name: string; email: string } | null;
}

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', organization: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page) });
    if (search) q.set('search', search);
    const res = await fetch(`/api/admin/sponsors?${q}`);
    if (res.ok) { const d = await res.json(); setSponsors(d.sponsors); setTotal(d.total); setPages(d.pages); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const createSponsor = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setFormError('');
    const res = await fetch('/api/admin/sponsors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { setShowForm(false); setForm({ name: '', phone: '', email: '', organization: '', notes: '' }); await load(); }
    else { const d = await res.json(); setFormError(d.error ?? 'خطأ'); }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الداعمون</h1>
          <p className="text-gray-500 text-sm mt-1">{total} داعم مسجل</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + داعم جديد
        </button>
      </div>

      {/* Add sponsor form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-800 mb-4">إضافة داعم جديد</h2>
          {formError && <div className="text-red-600 text-sm mb-3">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            {([['name', 'الاسم *'], ['phone', 'الهاتف'], ['email', 'الإيميل'], ['organization', 'الجهة']] as const).map(([field, label]) => (
              <div key={field}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input value={form[field]} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">ملاحظات</label>
              <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-16" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createSponsor} disabled={saving || !form.name.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">إلغاء</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <input type="text" placeholder="بحث..."
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full max-w-xs" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400">جاري التحميل...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-right p-3 font-medium text-gray-600">الداعم</th>
                <th className="text-right p-3 font-medium text-gray-600">نسخ كلية</th>
                <th className="text-right p-3 font-medium text-gray-600">طلبات شراء</th>
                <th className="text-right p-3 font-medium text-gray-600">الحالة</th>
                <th className="text-right p-3 font-medium text-gray-600">منذ</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sponsors.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{s.name}</div>
                    {s.organization && <div className="text-xs text-gray-400">{s.organization}</div>}
                    {s.email && <div className="text-xs text-gray-400">{s.email}</div>}
                  </td>
                  <td className="p-3 text-center font-bold text-gray-700">{s._count.copies}</td>
                  <td className="p-3 text-center text-gray-600">{s._count.sponsoredOrders}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.isActive ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400 text-xs">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</td>
                  <td className="p-3">
                    <a href={`/admin/sponsors/${s.id}`} className="text-blue-600 text-xs hover:underline">عرض</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
