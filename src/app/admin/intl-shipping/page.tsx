'use client';

import { useState, useEffect, useCallback } from 'react';
import { countries } from '@/lib/international-shipping';
import {
  getIntlShippingConfig,
  saveIntlShippingConfig,
  calculateIntlShipping,
  IntlShippingConfig,
  WeightBracket,
  ZoneConfig,
  GULF_COUNTRIES,
  ZONE_LABELS,
  ZONE_CURRENCY,
  IntlZone,
  RoundingRule,
} from '@/lib/intl-shipping';

// ── Helpers ───────────────────────────────────────────────────────────────────

const GULF_LIST = countries.filter(c => (GULF_COUNTRIES as readonly string[]).includes(c.code));
const INTL_COUNTRIES = countries.filter(
  c => c.code !== 'EG' && c.code !== 'SA' && !(GULF_COUNTRIES as readonly string[]).includes(c.code),
);
const ALL_SELECTABLE = countries.filter(c => c.code !== 'EG');

function uid() { return Math.random().toString(36).slice(2, 10); }

const EMPTY_BRACKET: Omit<WeightBracket, 'id'> = {
  minKg: 0, maxKg: 0.5,
  price_sar: undefined, price_gulf: undefined, price_usd: undefined,
  use_formula: false,
  egp_base: undefined,
  saudi_mult: 0.05, gulf_mult: 0.05, usd_mult: 0.01,
  rounding: 'whole',
};

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange, size = 'md' }: { on: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const dot = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const onX = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      dir="ltr"
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex ${h} items-center rounded-full transition-colors shrink-0 ${on ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block ${dot} transform rounded-full bg-white shadow transition-transform ${on ? onX : 'translate-x-1'}`} />
    </button>
  );
}

// ── Blocked Country Tag Input ─────────────────────────────────────────────────

function BlockedCountrySelector({
  blocked, onChange, pool,
}: { blocked: string[]; onChange: (v: string[]) => void; pool: typeof countries }) {
  const [q, setQ] = useState('');
  const filtered = pool.filter(
    c => !blocked.includes(c.code) && (c.name.includes(q) || c.nameEn.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase().includes(q.toLowerCase())),
  ).slice(0, 6);

  return (
    <div className="space-y-2">
      {blocked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {blocked.map(code => {
            const c = pool.find(x => x.code === code);
            return (
              <span key={code} className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-2 py-1 rounded-lg">
                {c?.name ?? code}
                <button type="button" onClick={() => onChange(blocked.filter(b => b !== code))} className="text-red-400 hover:text-red-600 font-black text-xs">✕</button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="ابحث عن دولة لحظرها..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
        />
        {q && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {filtered.map(c => (
              <button key={c.code} type="button"
                onClick={() => { onChange([...blocked, c.code]); setQ(''); }}
                className="w-full text-right px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2">
                <span className="font-semibold text-gray-900">{c.name}</span>
                <span className="text-gray-400 text-xs">{c.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bracket Form ──────────────────────────────────────────────────────────────

function BracketForm({
  initial, onSave, onCancel,
}: { initial: WeightBracket | null; onSave: (b: WeightBracket) => void; onCancel: () => void }) {
  const [form, setForm] = useState<WeightBracket>(
    initial ?? { id: uid(), ...EMPTY_BRACKET },
  );

  const set = <K extends keyof WeightBracket>(k: K, v: WeightBracket[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const numInput = (label: string, key: keyof WeightBracket, placeholder?: string, suffix?: string) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number" step="0.01" min={0}
          value={(form[key] as number | undefined) ?? ''}
          onChange={e => set(key, e.target.value === '' ? undefined : Number(e.target.value) as WeightBracket[typeof key])}
          placeholder={placeholder ?? '0'}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
        />
        {suffix && <span className="text-xs text-gray-400 shrink-0">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-5">
      <p className="font-bold text-gray-900 text-sm">{initial ? 'تعديل الشريحة' : 'إضافة شريحة جديدة'}</p>

      {/* Weight range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">الحد الأدنى للوزن (كجم) *</label>
          <input type="number" step="0.01" min={0}
            value={form.minKg}
            onChange={e => set('minKg', Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">الحد الأعلى للوزن (كجم)</label>
          <div className="space-y-1.5">
            <input type="number" step="0.01" min={0}
              value={form.maxKg ?? ''}
              placeholder="بلا حد أعلى"
              onChange={e => set('maxKg', e.target.value === '' ? null : Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
            />
            {form.maxKg !== null && <p className="text-xs text-gray-400">اتركه فارغًا إذا لم يكن هناك حد أعلى</p>}
          </div>
        </div>
      </div>

      {/* Manual prices */}
      <div>
        <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">الأسعار اليدوية (الأولوية القصوى)</p>
        <div className="grid grid-cols-3 gap-3">
          {numInput('السعودية — SAR', 'price_sar', 'SAR', 'SAR')}
          {numInput('الخليج — AED', 'price_gulf', 'AED', 'AED')}
          {numInput('دولي — USD', 'price_usd', 'USD', 'USD')}
        </div>
      </div>

      {/* Formula fallback */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">حساب تلقائي من سعر مصر</p>
            <p className="text-xs text-gray-500 mt-0.5">يُستخدم فقط إذا لم يكن هناك سعر يدوي</p>
          </div>
          <Toggle on={form.use_formula} onChange={v => set('use_formula', v)} size="sm" />
        </div>
        {form.use_formula && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">سعر الشحن الأساسي بالجنيه (EGP)</label>
              <input type="number" min={0}
                value={form.egp_base ?? ''}
                onChange={e => set('egp_base', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="مثال: 150"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {numInput('مضاعف SAR', 'saudi_mult', '0.05')}
              {numInput('مضاعف AED', 'gulf_mult', '0.05')}
              {numInput('مضاعف USD', 'usd_mult', '0.01')}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">قاعدة التقريب</label>
              <select
                value={form.rounding}
                onChange={e => set('rounding', e.target.value as RoundingRule)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
              >
                <option value="none">بدون تقريب</option>
                <option value="whole">تقريب لأعلى (عدد صحيح)</option>
                <option value="friendly">تقريب لأقرب 5</option>
              </select>
            </div>
            {form.egp_base && form.egp_base > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs space-y-1">
                <p className="font-bold text-blue-700">معاينة الحساب التلقائي:</p>
                {(['saudi', 'gulf', 'international'] as IntlZone[]).map(z => {
                  const mult = z === 'saudi' ? form.saudi_mult : z === 'gulf' ? form.gulf_mult : form.usd_mult;
                  let val = (form.egp_base ?? 0) * mult;
                  if (form.rounding === 'whole') val = Math.ceil(val);
                  else if (form.rounding === 'friendly') val = Math.ceil(val / 5) * 5;
                  else val = Math.round(val * 100) / 100;
                  return (
                    <p key={z} className="text-blue-600">
                      {ZONE_LABELS[z]}: <span className="font-bold">{val} {ZONE_CURRENCY[z]}</span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-gray-200 text-gray-600 font-semibold text-sm rounded-xl hover:border-gray-400 transition">
          إلغاء
        </button>
        <button type="button"
          onClick={() => {
            if (form.minKg < 0) return;
            onSave(form);
          }}
          className="px-5 py-2 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-gray-700 transition">
          حفظ الشريحة
        </button>
      </div>
    </div>
  );
}

// ── Preview ───────────────────────────────────────────────────────────────────

function PreviewTool({ config }: { config: IntlShippingConfig }) {
  const [country, setCountry] = useState('');
  const [weight, setWeight] = useState('');
  const [result, setResult] = useState<ReturnType<typeof calculateIntlShipping> | null>(null);

  const run = () => {
    if (!country || !weight) return;
    setResult(calculateIntlShipping(parseFloat(weight), country, config));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      <p className="font-bold text-gray-900">أداة المعاينة الفورية</p>
      <p className="text-xs text-gray-500">اختر الدولة وأدخل الوزن لمعاينة سعر الشحن كما سيظهر للعميل</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">الدولة</label>
          <select value={country} onChange={e => { setCountry(e.target.value); setResult(null); }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white">
            <option value="">اختر الدولة</option>
            {ALL_SELECTABLE.map(c => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">الوزن الإجمالي (كجم)</label>
          <input type="number" step="0.01" min={0} value={weight}
            onChange={e => { setWeight(e.target.value); setResult(null); }}
            placeholder="مثال: 1.5"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
          />
        </div>
      </div>
      <button type="button" onClick={run}
        disabled={!country || !weight}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition text-sm">
        معاينة الشحن
      </button>
      {result && (
        <div className={`rounded-xl p-4 text-sm font-semibold ${result.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {result.ok ? (
            <div className="space-y-1">
              <p className="text-base font-black">
                {result.amount} {result.currency}
              </p>
              <p className="text-xs font-normal text-green-600">
                المنطقة: {ZONE_LABELS[result.zone]}
              </p>
            </div>
          ) : (
            <p>{result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IntlShippingPage() {
  const [config, setConfig] = useState<IntlShippingConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  useEffect(() => { setConfig(getIntlShippingConfig()); }, []);

  const handleSave = useCallback(() => {
    if (!config) return;
    saveIntlShippingConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [config]);

  const patchConfig = (patch: Partial<IntlShippingConfig>) =>
    setConfig(c => c ? { ...c, ...patch } : c);

  const patchZone = (zone: IntlZone, patch: Partial<ZoneConfig>) =>
    setConfig(c => c ? { ...c, zones: { ...c.zones, [zone]: { ...c.zones[zone], ...patch } } } : c);

  if (!config) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sortedBrackets = [...config.weightBrackets].sort((a, b) => a.minKg - b.minKg);

  return (
    <div className="space-y-6 pb-10" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900">إعدادات الشحن الدولي</h1>
          <p className="text-sm text-gray-500 mt-0.5">تحكم كامل في الشحن خارج مصر</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-600 text-sm font-semibold">✓ تم الحفظ</span>}
          <button onClick={handleSave}
            className="bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-black px-5 py-2.5 rounded-xl text-sm transition">
            حفظ التغييرات
          </button>
        </div>
      </div>

      {/* ── Global Toggle ── */}
      <div className={`rounded-2xl border-2 p-5 flex items-center justify-between gap-4 transition ${config.enabled ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
        <div>
          <p className="font-black text-gray-900 text-base">
            {config.enabled ? '✅ الشحن الدولي مفعّل' : '🔴 الشحن الدولي معطّل'}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {config.enabled
              ? 'العملاء يرون خيارات الشحن الدولي في صفحة الدفع'
              : 'العملاء لا يرون أي خيار للشحن الدولي — قم بالتفعيل لبدء الشحن'}
          </p>
        </div>
        <Toggle on={config.enabled} onChange={v => patchConfig({ enabled: v })} />
      </div>

      {/* ── Zones ── */}
      <div>
        <h2 className="text-base font-black text-gray-900 mb-3">المناطق</h2>
        <div className="space-y-3">

          {/* Saudi */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">🇸🇦</span>
                <div>
                  <p className="font-bold text-gray-900 text-sm">المملكة العربية السعودية</p>
                  <p className="text-xs text-gray-400">الأسعار بالريال السعودي (SAR)</p>
                </div>
              </div>
              <Toggle on={config.zones.saudi.enabled} onChange={v => patchZone('saudi', { enabled: v })} />
            </div>
            {config.zones.saudi.enabled && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">حظر الشحن لدولة بعينها (نادر الاستخدام):</p>
                <BlockedCountrySelector
                  blocked={config.zones.saudi.blockedCountries}
                  onChange={v => patchZone('saudi', { blockedCountries: v })}
                  pool={countries.filter(c => c.code === 'SA')}
                />
              </div>
            )}
          </div>

          {/* Gulf */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">🌍</span>
                <div>
                  <p className="font-bold text-gray-900 text-sm">دول الخليج</p>
                  <p className="text-xs text-gray-400">الأسعار بالدرهم الإماراتي (AED)</p>
                </div>
              </div>
              <Toggle on={config.zones.gulf.enabled} onChange={v => patchZone('gulf', { enabled: v })} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {GULF_LIST.map(c => {
                const blocked = config.zones.gulf.blockedCountries.includes(c.code);
                return (
                  <label key={c.code}
                    className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm transition ${blocked ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                    <input type="checkbox"
                      checked={!blocked}
                      onChange={e => {
                        const next = e.target.checked
                          ? config.zones.gulf.blockedCountries.filter(b => b !== c.code)
                          : [...config.zones.gulf.blockedCountries, c.code];
                        patchZone('gulf', { blockedCountries: next });
                      }}
                      className="accent-green-500"
                    />
                    <span className={`font-semibold ${blocked ? 'text-red-500 line-through' : 'text-gray-700'}`}>{c.name}</span>
                  </label>
                );
              })}
            </div>
            {config.zones.gulf.blockedCountries.length > 0 && (
              <p className="text-xs text-red-500 font-semibold">
                دول محظورة: {config.zones.gulf.blockedCountries.join(' | ')}
              </p>
            )}
          </div>

          {/* International */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">🌐</span>
                <div>
                  <p className="font-bold text-gray-900 text-sm">دولي — باقي العالم</p>
                  <p className="text-xs text-gray-400">الأسعار بالدولار الأمريكي (USD)</p>
                </div>
              </div>
              <Toggle on={config.zones.international.enabled} onChange={v => patchZone('international', { enabled: v })} />
            </div>
            {config.zones.international.enabled && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">حظر دول بعينها:</p>
                <BlockedCountrySelector
                  blocked={config.zones.international.blockedCountries}
                  onChange={v => patchZone('international', { blockedCountries: v })}
                  pool={INTL_COUNTRIES}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Weight Brackets ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-black text-gray-900">شرائح الوزن والأسعار</h2>
            <p className="text-xs text-gray-500 mt-0.5">تحديد سعر الشحن لكل نطاق وزن</p>
          </div>
          {editingId !== 'new' && (
            <button type="button" onClick={() => setEditingId('new')}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition">
              + إضافة شريحة
            </button>
          )}
        </div>

        {sortedBrackets.length === 0 && editingId !== 'new' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center text-sm text-amber-700">
            <p className="font-bold mb-1">لا توجد شرائح وزن بعد</p>
            <p className="text-xs text-amber-600">أضف شريحة لتحديد أسعار الشحن حسب الوزن</p>
          </div>
        )}

        {sortedBrackets.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-xs font-semibold text-gray-500">
                    <th className="px-4 py-3 text-right">نطاق الوزن</th>
                    <th className="px-4 py-3 text-center">SAR 🇸🇦</th>
                    <th className="px-4 py-3 text-center">AED 🌍</th>
                    <th className="px-4 py-3 text-center">USD 🌐</th>
                    <th className="px-4 py-3 text-center">حساب تلقائي</th>
                    <th className="px-4 py-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedBrackets.map(b => {
                    const isEditing = editingId === b.id;
                    const displaySar  = b.price_sar  ?? (b.use_formula && b.egp_base ? '~' + Math.ceil((b.egp_base ?? 0) * b.saudi_mult) : '—');
                    const displayGulf = b.price_gulf ?? (b.use_formula && b.egp_base ? '~' + Math.ceil((b.egp_base ?? 0) * b.gulf_mult) : '—');
                    const displayUsd  = b.price_usd  ?? (b.use_formula && b.egp_base ? '~' + ((b.egp_base ?? 0) * b.usd_mult).toFixed(1) : '—');
                    return [
                      <tr key={b.id} className={`transition ${isEditing ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {b.minKg} — {b.maxKg === null ? '∞' : b.maxKg} كجم
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-700">{displaySar}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-700">{displayGulf}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-700">{displayUsd}</td>
                        <td className="px-4 py-3 text-center">
                          {b.use_formula ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">مفعّل</span> : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button"
                              onClick={() => setEditingId(isEditing ? null : b.id)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition">
                              {isEditing ? 'إغلاق' : 'تعديل'}
                            </button>
                            <button type="button"
                              onClick={() => {
                                if (!confirm('حذف هذه الشريحة؟')) return;
                                patchConfig({ weightBrackets: config.weightBrackets.filter(x => x.id !== b.id) });
                                if (editingId === b.id) setEditingId(null);
                              }}
                              className="text-xs font-bold text-red-500 hover:text-red-700 transition">
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>,
                      isEditing && (
                        <tr key={b.id + '-edit'}>
                          <td colSpan={6} className="px-4 py-3">
                            <BracketForm
                              initial={b}
                              onSave={updated => {
                                patchConfig({ weightBrackets: config.weightBrackets.map(x => x.id === b.id ? updated : x) });
                                setEditingId(null);
                              }}
                              onCancel={() => setEditingId(null)}
                            />
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* New bracket form */}
        {editingId === 'new' && (
          <BracketForm
            initial={null}
            onSave={b => {
              patchConfig({ weightBrackets: [...config.weightBrackets, b] });
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        )}
      </div>

      {/* ── Handling Fee ── */}
      <div>
        <h2 className="text-base font-black text-gray-900 mb-3">رسوم المناولة والتغليف</h2>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-sm">تفعيل رسوم المناولة</p>
              <p className="text-xs text-gray-500 mt-0.5">رسوم إضافية تُضاف على سعر الشحن</p>
            </div>
            <Toggle
              on={config.handling.enabled}
              onChange={v => patchConfig({ handling: { ...config.handling, enabled: v } })}
            />
          </div>
          {config.handling.enabled && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">نوع الرسوم</label>
                <div className="flex gap-2">
                  {(['fixed', 'percentage'] as const).map(t => (
                    <label key={t} className={`flex-1 flex items-center justify-center gap-1.5 border-2 rounded-xl py-2.5 cursor-pointer text-xs font-bold transition ${config.handling.type === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      <input type="radio" name="handling_type" value={t}
                        checked={config.handling.type === t}
                        onChange={() => patchConfig({ handling: { ...config.handling, type: t } })}
                        className="sr-only"
                      />
                      {t === 'fixed' ? 'مبلغ ثابت' : 'نسبة مئوية'}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  {config.handling.type === 'fixed' ? 'المبلغ (بعملة المنطقة)' : 'النسبة (%)'}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min={0} step={config.handling.type === 'percentage' ? 0.5 : 1}
                    value={config.handling.value}
                    onChange={e => patchConfig({ handling: { ...config.handling, value: Number(e.target.value) } })}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                  <span className="text-sm text-gray-500 shrink-0">{config.handling.type === 'percentage' ? '%' : 'وحدة'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Overweight Message ── */}
      <div>
        <h2 className="text-base font-black text-gray-900 mb-3">رسالة الوزن الزائد</h2>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-2">
            تظهر هذه الرسالة عندما يتجاوز وزن الطلب أعلى شريحة وزن محددة
          </p>
          <input
            type="text"
            value={config.overweightMessage}
            onChange={e => patchConfig({ overweightMessage: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 text-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1.5">مثال: "سيتم تحديد تكلفة الشحن بعد مراجعة الطلب"</p>
        </div>
      </div>

      {/* ── Preview Tool ── */}
      <div>
        <h2 className="text-base font-black text-gray-900 mb-3">معاينة فورية</h2>
        <PreviewTool config={config} />
      </div>

      {/* ── Save (bottom) ── */}
      <div className="pt-2">
        <button onClick={handleSave}
          className="w-full bg-gray-900 hover:bg-gray-700 text-white font-black py-4 rounded-2xl transition text-sm">
          {saved ? '✓ تم الحفظ' : 'حفظ جميع التغييرات'}
        </button>
      </div>
    </div>
  );
}
