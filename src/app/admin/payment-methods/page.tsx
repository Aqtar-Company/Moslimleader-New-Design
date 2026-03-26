'use client';

import { useEffect, useState } from 'react';

type PaymentMethodId = 'cod' | 'card' | 'paypal' | 'vodafone' | 'instapay';

interface PaymentMethodConfig {
  id: PaymentMethodId;
  enabled: boolean;
}

const METHOD_META: Record<PaymentMethodId, { icon: string; label: string; desc: string; local: boolean; intl: boolean }> = {
  cod:      { icon: '💵', label: 'الدفع عند الاستلام',             desc: 'متاح للشحن المحلي فقط',        local: true,  intl: false },
  card:     { icon: '💳', label: 'بطاقة بنكية (فيزا / ماستركارد)', desc: 'متاح للشحن المحلي والدولي',    local: true,  intl: true  },
  paypal:   { icon: '🅿️', label: 'PayPal',                         desc: 'متاح للشحن الدولي والمحلي',    local: true,  intl: true  },
  vodafone: { icon: '📱', label: 'Vodafone Cash',                   desc: 'متاح للشحن المحلي فقط',        local: true,  intl: false },
  instapay: { icon: '⚡', label: 'InstaPay',                         desc: 'متاح للشحن المحلي فقط',        local: true,  intl: false },
};

const ORDER: PaymentMethodId[] = ['cod', 'card', 'paypal', 'vodafone', 'instapay'];

const DEFAULT_METHODS: PaymentMethodConfig[] = ORDER.map(id => ({ id, enabled: true }));

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethodConfig[]>(DEFAULT_METHODS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/settings?key=payment-methods', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.value)) setMethods(d.value);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: PaymentMethodId) {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
    setSaved(false);
  }

  async function handleSave() {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: 'payment-methods', value: methods }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  const enabledCount = methods.filter(m => m.enabled).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">وسائل الدفع</h1>
        <p className="text-sm text-gray-500 mt-1">فعّل أو أوقف وسائل الدفع التي تظهر للعملاء عند الشراء</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {ORDER.map(id => {
          const meta = METHOD_META[id];
          const enabled = methods.find(m => m.id === id)?.enabled ?? true;

          return (
            <div key={id} className="flex items-center gap-4 px-5 py-4">
              <span className="text-2xl w-8 text-center">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{meta.label}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-gray-400">{meta.desc}</p>
                  {meta.local && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-100 rounded-full px-2 py-0.5">محلي</span>
                  )}
                  {meta.intl && (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">دولي</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggle(id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  enabled ? 'bg-gray-900' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={enabled}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    enabled ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-semibold w-12 text-center ${enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {enabled ? 'مفعّل' : 'موقوف'}
              </span>
            </div>
          );
        })}
      </div>

      {enabledCount === 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold">
          تحذير: لا توجد وسيلة دفع مفعّلة. يجب تفعيل وسيلة واحدة على الأقل.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={enabledCount === 0}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition text-sm"
      >
        {saved ? '✓ تم الحفظ في قاعدة البيانات' : 'حفظ الإعدادات'}
      </button>
    </div>
  );
}
