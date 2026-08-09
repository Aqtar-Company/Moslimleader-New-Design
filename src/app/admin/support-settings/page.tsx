'use client';

import { useEffect, useState } from 'react';

interface Settings {
  featureEnabled: boolean; eligibleCountries: string[];
  requestCooldownDays: number; maxActiveRequests: number;
  maxMLSupportPercent: number; maxMLSupportAmount: number | null;
  approvalExpiryHours: number; maxSponsoredCopiesPerProduct: number;
  sponsoredCopyCoversShipping: boolean; mlMonthlyBudget: number | null;
}

export default function AdminSupportSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/support-settings').then(r => r.json()).then(d => {
      setSettings(d.settings); setForm(d.settings); setLoading(false);
    });
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true); setError(''); setSaved(false);
    const res = await fetch('/api/admin/support-settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { const d = await res.json(); setSettings(d.settings); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else { const d = await res.json(); setError(d.error ?? 'خطأ'); }
    setSaving(false);
  };

  const update = (key: keyof Settings, val: unknown) => {
    setForm(prev => prev ? { ...prev, [key]: val } : prev);
  };

  if (loading || !form) return <div className="p-12 text-center text-gray-400">جاري التحميل...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">إعدادات نظام الدعم</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
      {saved && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg mb-4 text-sm">تم الحفظ بنجاح</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Main toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-800">تفعيل نظام الدعم</div>
            <div className="text-xs text-gray-400">يظهر زر طلب دعم السعر للعملاء المؤهلين</div>
          </div>
          <button
            onClick={() => update('featureEnabled', !form.featureEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${form.featureEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.featureEnabled ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {/* Eligible countries */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الدول المؤهلة (رمز ISO مفصولة بفاصلة)</label>
          <input
            value={form.eligibleCountries.join(',')}
            onChange={e => update('eligibleCountries', e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="EG,SA,AE"
          />
          <p className="text-xs text-gray-400 mt-1">المصر = EG، السعودية = SA، الإمارات = AE</p>
        </div>

        {/* Cooldown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">فترة الانتظار بين الطلبات (بالأيام)</label>
          <input type="number" value={form.requestCooldownDays}
            onChange={e => update('requestCooldownDays', Number(e.target.value))}
            min="0" className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">0 = بدون فترة انتظار</p>
        </div>

        {/* Max active requests */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى للطلبات النشطة لكل عميل</label>
          <input type="number" value={form.maxActiveRequests}
            onChange={e => update('maxActiveRequests', Number(e.target.value))}
            min="1" className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        {/* ML Support cap */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى لنسبة الدعم (%)</label>
            <input type="number" value={form.maxMLSupportPercent}
              onChange={e => update('maxMLSupportPercent', Number(e.target.value))}
              min="1" max="100" className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى للمبلغ (ج.م، فارغ = بلا حد)</label>
            <input type="number"
              value={form.maxMLSupportAmount ?? ''}
              onChange={e => update('maxMLSupportAmount', e.target.value ? Number(e.target.value) : null)}
              className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="بلا حد" />
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">مدة صلاحية الموافقة (بالساعات)</label>
          <input type="number" value={form.approvalExpiryHours}
            onChange={e => update('approvalExpiryHours', Number(e.target.value))}
            min="1" className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        {/* Sponsored copies */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى للنسخ المتاحة لكل منتج</label>
          <input type="number" value={form.maxSponsoredCopiesPerProduct}
            onChange={e => update('maxSponsoredCopiesPerProduct', Number(e.target.value))}
            min="1" className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        {/* Shipping coverage */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-800">النسخة المدعومة تشمل الشحن</div>
            <div className="text-xs text-gray-400">إذا مفعل، المستفيد لا يدفع رسوم الشحن</div>
          </div>
          <button
            onClick={() => update('sponsoredCopyCoversShipping', !form.sponsoredCopyCoversShipping)}
            className={`relative w-12 h-6 rounded-full transition-colors ${form.sponsoredCopyCoversShipping ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.sponsoredCopyCoversShipping ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {/* ML Monthly budget */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الميزانية الشهرية لدعم ML (ج.م، فارغ = للتقارير فقط)</label>
          <input type="number"
            value={form.mlMonthlyBudget ?? ''}
            onChange={e => update('mlMonthlyBudget', e.target.value ? Number(e.target.value) : null)}
            className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="مثال: 50000" />
        </div>

        <button onClick={save} disabled={saving}
          className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
}
