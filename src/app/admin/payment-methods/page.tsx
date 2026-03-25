'use client';

import { useEffect, useState } from 'react';
import { getPaymentMethods, savePaymentMethods, PaymentMethodConfig, PaymentMethodId } from '@/lib/admin-storage';

const METHOD_META: Record<PaymentMethodId, { icon: string; label: string; desc: string; local: boolean; intl: boolean }> = {
  cod:      { icon: '💵', label: 'الدفع عند الاستلام',          desc: 'متاح للشحن المحلي فقط',                           local: true,  intl: false },
  card:     { icon: '💳', label: 'بطاقة بنكية (فيزا / ماستركارد)', desc: 'متاح للشحن المحلي والدولي',                    local: true,  intl: true  },
  paypal:   { icon: '🅿️', label: 'PayPal',                        desc: 'متاح للشحن الدولي والمحلي',                    local: true,  intl: true  },
  vodafone: { icon: '📱', label: 'Vodafone Cash',                  desc: 'متاح للشحن المحلي فقط',                        local: true,  intl: false },
  instapay: { icon: '⚡', label: 'InstaPay',                        desc: 'متاح للشحن المحلي فقط',                        local: true,  intl: false },
};

const ORDER: PaymentMethodId[] = ['cod', 'card', 'paypal', 'vodafone', 'instapay'];

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMethods(getPaymentMethods());
  }, []);

  function toggle(id: PaymentMethodId) {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
    setSaved(false);
  }

  function handleSave() {
    savePaymentMethods(methods);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const enabledCount = methods.filter(m => m.enabled).length;

  return (
    <div className="max-w-xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">وسائل الدفع</h1>
        <p className="text-sm text-gray-500 mt-1">فعّل أو أوقف وسائل الدفع التي تظهر للعملاء عند الشراء</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {ORDER.map(id => {
          const meta = METHOD_META[id];
          const config = methods.find(m => m.id === id);
          const enabled = config?.enabled ?? true;

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
              {/* Toggle */}
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
        {saved ? '✓ تم الحفظ' : 'حفظ الإعدادات'}
      </button>
    </div>
  );
}
