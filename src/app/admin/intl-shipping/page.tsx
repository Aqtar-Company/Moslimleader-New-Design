'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  COUNTRIES, DEFAULT_BLOCKED, DEFAULT_CONFIG,
  IntlShippingConfig, ShippingZone, WeightBracket, ZonePricing,
  getIntlShippingConfig, saveIntlShippingConfig, calculateIntlShipping,
} from '@/lib/intl-shipping';

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button dir="ltr" type="button" onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${on ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-black text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IntlShippingPage() {
  const [cfg, setCfg] = useState<IntlShippingConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'prices' | 'countries' | 'settings' | 'preview'>('prices');

  // Preview tool state
  const [previewCountry, setPreviewCountry] = useState('');
  const [previewWeight, setPreviewWeight] = useState('');

  const load = useCallback(() => {
    setCfg(getIntlShippingConfig());
  }, []);

  useEffect(() => { load(); }, [load]);

  function save() {
    saveIntlShippingConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function updateZonePrice(zone: ShippingZone, bracketId: string, value: string) {
    setCfg(c => ({
      ...c,
      zones: c.zones.map(z =>
        z.zone === zone
          ? { ...z, prices: { ...z.prices, [bracketId]: Number(value) || 0 } }
          : z
      ),
    }));
  }

  function addBracket() {
    const last = cfg.brackets[cfg.brackets.length - 1];
    const newMin = last ? last.maxKg : 0;
    const newMax = newMin + 1;
    const id = 'b' + Date.now();
    setCfg(c => ({
      ...c,
      brackets: [...c.brackets, { id, minKg: newMin, maxKg: newMax, labelAr: `${newMin} – ${newMax} كجم` }],
      zones: c.zones.map(z => ({ ...z, prices: { ...z.prices, [id]: 0 } })),
    }));
  }

  function deleteBracket(id: string) {
    if (cfg.brackets.length <= 1) return;
    setCfg(c => ({
      ...c,
      brackets: c.brackets.filter(b => b.id !== id),
      zones: c.zones.map(z => {
        const prices = { ...z.prices };
        delete prices[id];
        return { ...z, prices };
      }),
    }));
  }

  function updateBracketLabel(id: string, field: 'minKg' | 'maxKg', value: string) {
    setCfg(c => ({
      ...c,
      brackets: c.brackets.map(b => {
        if (b.id !== id) return b;
        const updated = { ...b, [field]: Number(value) || 0 };
        updated.labelAr = `${updated.minKg} – ${updated.maxKg} كجم`;
        return updated;
      }),
    }));
  }

  function toggleCountryBlocked(code: string) {
    setCfg(c => ({
      ...c,
      blockedCountries: c.blockedCountries.includes(code)
        ? c.blockedCountries.filter(x => x !== code)
        : [...c.blockedCountries, code],
    }));
  }

  // Preview calculation
  const previewResult = previewCountry && previewWeight
    ? calculateIntlShipping(parseFloat(previewWeight) || 0, previewCountry, cfg)
    : null;

  const TABS = [
    { id: 'prices',    label: '💰 الأسعار'       },
    { id: 'countries', label: '🌍 الدول'           },
    { id: 'settings',  label: '⚙️ إعدادات'          },
    { id: 'preview',   label: '🔍 معاينة'           },
  ] as const;

  // Countries grouped by region for display
  const REGION_GROUPS = [
    { label: 'دول الخليج', codes: ['AE', 'KW', 'QA', 'BH', 'OM'] },
    { label: 'الدول العربية', codes: ['JO', 'LB', 'PS', 'IQ', 'MA', 'TN', 'DZ', 'MR', 'DJ', 'KM', 'SY', 'YE', 'LY', 'SD'] },
    { label: 'أوروبا', codes: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'TR', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'PT', 'GR', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'IS', 'AL', 'RS', 'ME', 'MK', 'BA', 'MD', 'GE', 'AM', 'UA', 'IL'] },
    { label: 'أمريكا وأستراليا', codes: ['US', 'CA', 'AU', 'NZ', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'EC', 'UY', 'BO', 'PY', 'GT', 'CR', 'PA', 'DO', 'JM', 'TT'] },
    { label: 'آسيا', codes: ['IN', 'CN', 'JP', 'KR', 'SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'HK', 'TW', 'PK', 'BD', 'LK', 'NP', 'MV', 'KH', 'MN', 'KZ', 'UZ', 'AF', 'KP'] },
    { label: 'أفريقيا', codes: ['NG', 'GH', 'KE', 'ET', 'TZ', 'UG', 'ZA', 'SN', 'CI', 'CM', 'RW', 'ZM', 'ZW', 'MZ', 'AO', 'MG', 'MU', 'GA', 'CD', 'CG', 'SL', 'GN', 'BF', 'ML', 'NE', 'TG', 'BJ', 'NA', 'BW', 'MW', 'ER', 'SS', 'SO'] },
  ];

  return (
    <div className="space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">إعدادات الشحن الدولي</h1>
          <p className="text-sm text-gray-500 mt-0.5">تحكم في أسعار الشحن من مصر إلى العالم</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">
            {cfg.enabled ? '✅ الشحن مفعّل' : '⛔ الشحن مغلق'}
          </span>
          <Toggle on={cfg.enabled} onChange={v => setCfg(c => ({ ...c, enabled: v }))} />
          <button onClick={save}
            className={`px-5 py-2.5 rounded-xl font-black text-sm transition ${
              saved ? 'bg-green-500 text-white' : 'bg-[#F5C518] hover:bg-amber-400 text-gray-900'
            }`}>
            {saved ? '✓ تم الحفظ' : '💾 حفظ'}
          </button>
        </div>
      </div>

      {/* Zone overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'السعودية', flag: '🇸🇦', currency: 'SAR', desc: 'شحن خاص' },
          { label: 'الخليج',   flag: '🌙', currency: 'USD', desc: 'AE KW QA BH OM' },
          { label: 'عربي',     flag: '🌍', currency: 'USD', desc: 'JO LB MA TN...' },
          { label: 'دولي',     flag: '🌐', currency: 'USD', desc: 'أوروبا، أمريكا...' },
        ].map(z => (
          <div key={z.label} className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-center">
            <div className="text-2xl mb-1">{z.flag}</div>
            <p className="font-black text-gray-900 text-sm">{z.label}</p>
            <p className="text-xs text-gray-400">{z.currency} · {z.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition ${
              activeTab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PRICES ─────────────────────────────────────────────────── */}
      {activeTab === 'prices' && (
        <Card title="جدول الأسعار — حسب المنطقة والوزن">
          {/* Brackets header row */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-bold text-gray-500 flex-1">شرائح الوزن:</p>
              <button onClick={addBracket}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-gray-700 transition">
                + شريحة
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {cfg.brackets.map((b, i) => (
                <div key={b.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                  <input
                    type="number" value={b.minKg} step={0.1} min={0}
                    onChange={e => updateBracketLabel(b.id, 'minKg', e.target.value)}
                    className="w-12 text-xs text-center border-none outline-none bg-transparent font-bold text-blue-800"
                  />
                  <span className="text-blue-400 text-xs">–</span>
                  <input
                    type="number" value={b.maxKg} step={0.1} min={0}
                    onChange={e => updateBracketLabel(b.id, 'maxKg', e.target.value)}
                    className="w-12 text-xs text-center border-none outline-none bg-transparent font-bold text-blue-800"
                  />
                  <span className="text-blue-500 text-xs font-semibold">كجم</span>
                  {cfg.brackets.length > 1 && (
                    <button onClick={() => deleteBracket(b.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-black mr-1">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Prices table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-right px-3 py-2.5 font-black text-gray-700 border border-gray-200 text-xs">المنطقة</th>
                  {cfg.brackets.map(b => (
                    <th key={b.id} className="px-3 py-2.5 font-bold text-gray-600 border border-gray-200 text-xs whitespace-nowrap">
                      {b.labelAr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cfg.zones.map(zone => (
                  <tr key={zone.zone} className="hover:bg-gray-50 transition">
                    <td className="px-3 py-2.5 border border-gray-200 font-bold text-gray-900 text-xs whitespace-nowrap">
                      {zone.nameAr}
                      <span className="mr-1 text-gray-400 font-normal">({zone.currency})</span>
                    </td>
                    {cfg.brackets.map(b => (
                      <td key={b.id} className="px-2 py-1.5 border border-gray-200">
                        <input
                          type="number"
                          value={zone.prices[b.id] ?? 0}
                          min={0}
                          onChange={e => updateZonePrice(zone.zone, b.id, e.target.value)}
                          className="w-full text-center border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-gray-900 outline-none focus:border-[#F5C518] bg-white"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            * الأسعار التقريبية مبنية على أسعار البريد المصري EMS وأراميكس من مصر. عدّلها حسب أسعارك الفعلية.
          </p>
        </Card>
      )}

      {/* ── TAB: COUNTRIES ──────────────────────────────────────────────── */}
      {activeTab === 'countries' && (
        <Card title="إدارة الدول — تفعيل أو حظر">
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-lg font-semibold">
              🔴 محظورة
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg font-semibold">
              ✅ متاحة
            </span>
            <span className="text-xs text-gray-400 mr-2">الدول المحظورة افتراضيًا: مناطق نزاع أو مغلقة</span>
          </div>

          <div className="space-y-5">
            {REGION_GROUPS.map(group => {
              const groupCountries = group.codes
                .map(code => COUNTRIES.find(c => c.code === code))
                .filter(Boolean) as typeof COUNTRIES;
              return (
                <div key={group.label}>
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">{group.label}</h4>
                  <div className="flex flex-wrap gap-2">
                    {groupCountries.map(country => {
                      const isBlocked = cfg.blockedCountries.includes(country.code);
                      const isDefaultBlocked = DEFAULT_BLOCKED.includes(country.code);
                      return (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => toggleCountryBlocked(country.code)}
                          title={country.nameEn}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition ${
                            isBlocked
                              ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                              : 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100'
                          }`}>
                          {isBlocked ? '🔴' : '✅'}
                          {country.nameAr}
                          {isDefaultBlocked && isBlocked && (
                            <span className="text-red-400 text-[10px]">افتراضي</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setCfg(c => ({ ...c, blockedCountries: [...DEFAULT_BLOCKED] }))}
            className="mt-5 text-xs text-gray-400 hover:text-gray-600 underline transition">
            إعادة ضبط القائمة الافتراضية
          </button>
        </Card>
      )}

      {/* ── TAB: SETTINGS ───────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-4">

          {/* Handling fee */}
          <Card title="رسوم المعالجة والتغليف (اختياري)">
            <div className="flex items-center gap-3 mb-4">
              <Toggle
                on={!!cfg.handlingFee}
                onChange={v => setCfg(c => ({ ...c, handlingFee: v ? { type: 'fixed', value: 0 } : null }))}
              />
              <span className="text-sm font-semibold text-gray-700">
                {cfg.handlingFee ? 'مفعّلة' : 'معطّلة'}
              </span>
            </div>
            {cfg.handlingFee && (
              <div className="flex gap-3 flex-wrap">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCfg(c => ({ ...c, handlingFee: c.handlingFee ? { ...c.handlingFee, type: 'fixed' } : null }))}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${
                      cfg.handlingFee.type === 'fixed' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'
                    }`}>
                    مبلغ ثابت
                  </button>
                  <button
                    onClick={() => setCfg(c => ({ ...c, handlingFee: c.handlingFee ? { ...c.handlingFee, type: 'percent' } : null }))}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${
                      cfg.handlingFee.type === 'percent' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'
                    }`}>
                    نسبة مئوية %
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0}
                    value={cfg.handlingFee.value}
                    onChange={e => setCfg(c => ({ ...c, handlingFee: c.handlingFee ? { ...c.handlingFee, value: Number(e.target.value) } : null }))}
                    className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
                    placeholder={cfg.handlingFee.type === 'fixed' ? 'مثال: 2' : 'مثال: 5'}
                  />
                  <span className="text-sm text-gray-500">{cfg.handlingFee.type === 'fixed' ? 'USD / SAR' : '%'}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Overweight message */}
          <Card title="رسالة تجاوز الوزن الأقصى">
            <p className="text-xs text-gray-500 mb-2">تظهر عندما يتجاوز الوزن الإجمالي للطلب الشريحة الأخيرة</p>
            <textarea
              value={cfg.overweightMessage}
              onChange={e => setCfg(c => ({ ...c, overweightMessage: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F5C518] resize-none"
              placeholder="سيتم تحديد تكلفة الشحن بعد مراجعة الطلب"
            />
          </Card>

          {/* Reset to defaults */}
          <Card title="إعادة ضبط الإعدادات">
            <p className="text-sm text-gray-500 mb-4">إعادة كل الأسعار والإعدادات إلى القيم الافتراضية (أسعار تقريبية من البريد المصري)</p>
            <button
              onClick={() => { if (confirm('إعادة ضبط كل الإعدادات؟ لن تُستعاد التغييرات الحالية.')) setCfg(structuredClone(DEFAULT_CONFIG)); }}
              className="px-5 py-2.5 border-2 border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition">
              ↺ إعادة الضبط
            </button>
          </Card>
        </div>
      )}

      {/* ── TAB: PREVIEW ────────────────────────────────────────────────── */}
      {activeTab === 'preview' && (
        <Card title="🔍 معاينة سعر الشحن">
          <p className="text-xs text-gray-500 mb-4">اختر دولة وأدخل الوزن لمشاهدة سعر الشحن فورًا بناءً على الإعدادات الحالية</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">الدولة</label>
              <select
                value={previewCountry}
                onChange={e => setPreviewCountry(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F5C518] bg-white">
                <option value="">اختر دولة</option>
                {COUNTRIES.filter(c => c.code !== 'EG').map(c => (
                  <option key={c.code} value={c.code}>{c.nameAr} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">الوزن (كجم)</label>
              <input
                type="number" min={0} step={0.1}
                value={previewWeight}
                onChange={e => setPreviewWeight(e.target.value)}
                placeholder="مثال: 0.8"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F5C518]"
              />
            </div>
          </div>

          {previewResult && (
            <div className={`rounded-2xl p-5 text-center ${previewResult.ok ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
              {previewResult.ok ? (
                <>
                  <p className="text-gray-500 text-xs mb-1">{previewResult.zoneName}</p>
                  <p className="font-black text-3xl text-gray-900">
                    {previewResult.amount}
                    <span className="text-lg text-gray-500 font-normal mr-1">{previewResult.currency}</span>
                  </p>
                  {previewWeight && <p className="text-xs text-gray-400 mt-1">وزن: {previewWeight} كجم</p>}
                </>
              ) : (
                <div>
                  <p className="text-3xl mb-2">⛔</p>
                  <p className="font-bold text-red-700 text-sm">{previewResult.message}</p>
                </div>
              )}
            </div>
          )}

          {!previewResult && (
            <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-400 text-sm">
              اختر دولة وأدخل الوزن لرؤية التسعير
            </div>
          )}
        </Card>
      )}

      {/* Save bar */}
      <div className="flex justify-end pt-2">
        <button onClick={save}
          className={`px-8 py-3 rounded-xl font-black text-sm transition ${
            saved ? 'bg-green-500 text-white' : 'bg-[#F5C518] hover:bg-amber-400 text-gray-900'
          }`}>
          {saved ? '✓ تم الحفظ بنجاح' : '💾 حفظ كل الإعدادات'}
        </button>
      </div>
    </div>
  );
}
