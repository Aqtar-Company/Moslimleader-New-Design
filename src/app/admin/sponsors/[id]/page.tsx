'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface SponsorDetail {
  id: string; name: string; phone?: string; email?: string;
  organization?: string; notes?: string; isActive: boolean; createdAt: string;
  user?: { id: string; name: string; email: string } | null;
  stats: {
    totalCopies: number; availableCopies: number; assignedCopies: number;
    shippedCopies: number; deliveredCopies: number; confirmedCopies: number;
    totalRetailValue: number;
  };
  orders: {
    id: string; quantity: number; totalPaid: number; paymentStatus: string;
    currency: string; createdAt: string;
    product: { id: string; name: string };
    _count: { copies: number };
  }[];
  deliveredCopies: {
    id: string; code: string; status: string; createdAt: string;
    product: { name: string };
    impactMessages: { id: string; message: string; status: string }[];
    impactMedia: { id: string; mediaUrl: string; status: string }[];
  }[];
}

const PAYMENT_STATUS: Record<string, string> = { pending: 'معلق', paid: 'مدفوع', failed: 'فشل', refunded: 'مسترد' };

export default function AdminSponsorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sponsor, setSponsor] = useState<SponsorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', organization: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/sponsors/${id}`);
    if (res.ok) {
      const d = await res.json();
      setSponsor(d.sponsor);
      setForm({ name: d.sponsor.name, phone: d.sponsor.phone ?? '', email: d.sponsor.email ?? '', organization: d.sponsor.organization ?? '', notes: d.sponsor.notes ?? '' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    const res = await fetch(`/api/admin/sponsors/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { await load(); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else { const d = await res.json(); setError(d.error ?? 'خطأ'); }
    setSaving(false);
  };

  const toggleActive = async () => {
    if (!sponsor) return;
    await fetch(`/api/admin/sponsors/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !sponsor.isActive }),
    });
    await load();
  };

  const fmt = (n: number) => n.toLocaleString('ar-EG') + ' ج.م';

  if (loading) return <div className="p-12 text-center text-gray-400">جاري التحميل...</div>;
  if (!sponsor) return <div className="p-12 text-center text-red-500">لم يُعثر على الداعم</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin/sponsors" className="text-gray-400 text-sm hover:text-gray-700">← رجوع</a>
        <h1 className="text-xl font-bold text-gray-900">{sponsor.name}</h1>
        <span className={`px-2 py-1 rounded-full text-xs ${sponsor.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {sponsor.isActive ? 'نشط' : 'غير نشط'}
        </span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
      {saved && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg mb-4 text-sm">تم الحفظ</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['إجمالي النسخ', sponsor.stats.totalCopies, 'gray'],
              ['متاحة', sponsor.stats.availableCopies, 'green'],
              ['وصلت', sponsor.stats.deliveredCopies + sponsor.stats.confirmedCopies, 'blue'],
            ].map(([label, value, color]) => {
              const colors: Record<string, string> = { gray: 'bg-gray-50 border-gray-200 text-gray-700', green: 'bg-green-50 border-green-200 text-green-900', blue: 'bg-blue-50 border-blue-200 text-blue-900' };
              return (
                <div key={String(label)} className={`border rounded-xl p-4 ${colors[String(color)]}`}>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-sm mt-1">{label}</div>
                </div>
              );
            })}
          </div>

          {/* Sponsored orders */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-800">طلبات الشراء</h2>
            </div>
            {sponsor.orders.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">لا توجد طلبات بعد</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right p-3 font-medium text-gray-600">المنتج</th>
                    <th className="text-right p-3 font-medium text-gray-600">الكمية</th>
                    <th className="text-right p-3 font-medium text-gray-600">الإجمالي</th>
                    <th className="text-right p-3 font-medium text-gray-600">الدفع</th>
                    <th className="text-right p-3 font-medium text-gray-600">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sponsor.orders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50/50">
                      <td className="p-3 text-gray-800">{o.product.name}</td>
                      <td className="p-3 text-center font-bold">{o.quantity}</td>
                      <td className="p-3 font-medium">{fmt(o.totalPaid)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${o.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {PAYMENT_STATUS[o.paymentStatus] ?? o.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Delivered copies with impact */}
          {sponsor.deliveredCopies.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-800">النسخ الموصلة — رسائل وصور الأثر</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {sponsor.deliveredCopies.map(copy => (
                  <div key={copy.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <a href={`/admin/sponsored-copies/${copy.id}`} className="font-mono text-sm text-blue-600 hover:underline">{copy.code}</a>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{copy.product.name}</span>
                    </div>
                    {copy.impactMessages.filter(m => m.status === 'APPROVED').map(m => (
                      <blockquote key={m.id} className="text-sm italic text-gray-700 bg-green-50 border-r-4 border-green-300 p-3 rounded-lg mb-2">
                        &ldquo;{m.message}&rdquo;
                      </blockquote>
                    ))}
                    {copy.impactMedia.filter(med => med.status === 'APPROVED').length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {copy.impactMedia.filter(med => med.status === 'APPROVED').map(med => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={med.id} src={med.mediaUrl} alt="صورة الأثر" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                        ))}
                      </div>
                    )}
                    {copy.impactMessages.filter(m => m.status === 'APPROVED').length === 0 &&
                     copy.impactMedia.filter(m => m.status === 'APPROVED').length === 0 && (
                      <p className="text-xs text-gray-400">لا يوجد محتوى أثر معتمد بعد</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Sponsor info / edit */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">بيانات الداعم</h2>
              {!editing && (
                <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">تعديل</button>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                {([['name', 'الاسم'] as const, ['phone', 'الهاتف'] as const, ['email', 'الإيميل'] as const, ['organization', 'الجهة'] as const] as const).map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs text-gray-500 block mb-1">{label}</label>
                    <input value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">ملاحظات</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-16" />
                </div>
                <div className="flex gap-2">
                  <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                    {saving ? '...' : 'حفظ'}
                  </button>
                  <button onClick={() => setEditing(false)} className="text-sm text-gray-500">إلغاء</button>
                </div>
              </div>
            ) : (
              <dl className="space-y-2 text-sm">
                {sponsor.organization && <div><dt className="text-gray-500 text-xs">الجهة</dt><dd>{sponsor.organization}</dd></div>}
                {sponsor.email && <div><dt className="text-gray-500 text-xs">الإيميل</dt><dd>{sponsor.email}</dd></div>}
                {sponsor.phone && <div><dt className="text-gray-500 text-xs">الهاتف</dt><dd>{sponsor.phone}</dd></div>}
                {sponsor.notes && <div><dt className="text-gray-500 text-xs">ملاحظات</dt><dd className="text-gray-600">{sponsor.notes}</dd></div>}
                <div><dt className="text-gray-500 text-xs">منذ</dt><dd>{new Date(sponsor.createdAt).toLocaleDateString('ar-EG')}</dd></div>
              </dl>
            )}
          </div>

          {/* Financial summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">الملخص المالي</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">القيمة التجارية الكلية</span>
                <span className="font-bold">{fmt(sponsor.stats.totalRetailValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">نسخ مكتملة</span>
                <span className="text-green-700 font-medium">{sponsor.stats.confirmedCopies}</span>
              </div>
            </div>
          </div>

          {/* Toggle active */}
          <button onClick={toggleActive}
            className={`w-full py-2 rounded-xl text-sm font-medium border ${sponsor.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
            {sponsor.isActive ? 'تعطيل الداعم' : 'تفعيل الداعم'}
          </button>
        </div>
      </div>
    </div>
  );
}
