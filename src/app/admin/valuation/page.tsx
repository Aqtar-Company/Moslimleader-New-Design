'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';

interface ValuationData {
  generatedAt: string;
  metrics: {
    products: { total: number; inStockCount: number; outOfStockCount: number; inventoryUnits: number; inventoryValueRetail: number; inventoryValueCost: number };
    books: { total: number; published: number; languages: string[] };
    sales: { totalOrders: number; validOrders: number; cancelledOrders: number; totalRevenue: number; avgOrderValue: number; unitsSold: number; byYear: Array<{ year: number; revenue: number; count: number }> };
    customers: number;
    shipments: number;
    gifts?: { count: number; units: number; retailValue: number; shippingCost: number; totalCost: number };
    ip: { booksValue: number; productsValue: number; digitalValue: number; total: number };
    tech: { value: number };
    customerDb: { value: number };
  };
  valuation: { base: number; fair: number; strategic: number };
  products: Array<{ id: string; name: string; nameEn: string | null; slug: string; price: number; priceUsd: number; category: string; stock: number; sold: number; stockValue: number }>;
  books: Array<{ id: string; title: string; titleEn: string | null; price: number; priceUSD: number | null; isPublished: boolean; language: string | null }>;
}

const fmt = (n: number) => n.toLocaleString('ar-EG');

export default function ValuationPage() {
  const { addToast } = useToast();
  const [password, setPassword] = useState('');
  const [data, setData] = useState<ValuationData | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!password) { addToast('أدخل كلمة السر', 'warning'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/valuation?password=${encodeURIComponent(password)}`, {
        credentials: 'include', cache: 'no-store',
      });
      const d = await res.json();
      if (!res.ok) {
        addToast(d.error || 'فشل التوليد', 'error');
      } else {
        setData(d);
      }
    } catch {
      addToast('فشل التوليد', 'error');
    }
    setLoading(false);
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 border border-gray-200">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#F5C518] to-[#e6a200] rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl">📊</div>
            <h1 className="text-2xl font-black text-gray-900">تقييم الشركة</h1>
            <p className="text-sm text-gray-500 mt-2">تقرير محدّث مباشرة من قاعدة البيانات</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">كلمة السر للوصول</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generate()}
                placeholder="•••••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F5C518] focus:ring-2 focus:ring-[#F5C518]/20"
                dir="ltr"
              />
            </div>
            <button
              onClick={generate}
              disabled={loading || !password}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-sm font-bold transition disabled:opacity-50"
            >
              {loading ? '...جاري التوليد' : '📊 توليد التقرير'}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-6 text-center">⚠️ التقرير يحتوي على بيانات مالية حساسة. كلمة السر محصورة في صاحب الشركة.</p>
        </div>
      </div>
    );
  }

  const { metrics, valuation, products, books } = data;

  return (
    <div className="space-y-6 print:bg-white" dir="rtl">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div>
          <p className="text-xs text-gray-500">تم التوليد: {new Date(data.generatedAt).toLocaleString('ar-EG')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-bold transition">🖨️ طباعة / تصدير PDF</button>
          <button onClick={() => { setData(null); setPassword(''); }} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition">🔒 إغلاق</button>
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-3xl p-10 text-white text-center" style={{ background: 'linear-gradient(135deg,#1a1a2e 0%,#2d1060 50%,#6B21A8 100%)' }}>
        <p className="text-xs text-[#F5C518] font-bold tracking-[3px] uppercase">تقييم محدّث</p>
        <h1 className="text-5xl font-black mt-3">مسلم ليدر</h1>
        <p className="text-white/70 mt-2">{new Date(data.generatedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
          <Stat label="منتجات" value={String(metrics.products.total)} />
          <Stat label="كتب رقمية" value={String(metrics.books.total)} />
          <Stat label="عملاء" value={fmt(metrics.customers)} />
          <Stat label="شحنات" value={fmt(metrics.shipments)} />
        </div>

        <div className="mt-8 pt-8 border-t border-white/10">
          <p className="text-[#F5C518] text-xs font-bold tracking-widest">التقييم النهائي</p>
          <p className="text-5xl font-black mt-3">{fmt(valuation.fair)} <span className="text-xl">ج.م</span></p>
          <p className="text-white/60 text-sm mt-1">قيمة عادلة (Fair Market Value)</p>
        </div>
      </div>

      {/* 3 scenarios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ScenarioCard label="الحد الأدنى" value={valuation.base} desc="تصفية / مشتري مالي" tone="base" />
        <ScenarioCard label="القيمة العادلة" value={valuation.fair} desc="سوق متوازنة" tone="fair" />
        <ScenarioCard label="القيمة الاستراتيجية" value={valuation.strategic} desc="مشتري استراتيجي" tone="strategic" />
      </div>

      {/* Sales section */}
      <Section icon="💰" title="المبيعات والإيرادات">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إجمالي الإيرادات" value={`${fmt(metrics.sales.totalRevenue)} ج.م`} />
          <KPI label="عدد الأوردرات" value={fmt(metrics.sales.validOrders)} sub={`+ ${metrics.sales.cancelledOrders} ملغي`} />
          <KPI label="متوسط الأوردر" value={`${fmt(metrics.sales.avgOrderValue)} ج.م`} />
          <KPI label="الوحدات المباعة" value={fmt(metrics.sales.unitsSold)} />
        </div>

        {metrics.gifts && metrics.gifts.count > 0 && (
          <div className="mt-4 bg-pink-50 border border-pink-200 rounded-2xl p-4">
            <p className="text-xs font-black text-pink-800 mb-2">🎁 الهدايا المُرسَلة (لا تُحتسب ضمن الإيرادات)</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPI label="عدد الهدايا" value={fmt(metrics.gifts.count)} />
              <KPI label="وحدات مُهداة" value={fmt(metrics.gifts.units)} />
              <KPI label="قيمة المنتجات (سعر بيع)" value={`${fmt(metrics.gifts.retailValue)} ج.م`} />
              <KPI label="إجمالي تكلفة الهدايا" value={`${fmt(metrics.gifts.totalCost)} ج.م`} sub="منتجات + شحن" />
            </div>
          </div>
        )}

        {metrics.sales.byYear.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-gray-200 mt-4">
            <p className="text-xs font-bold text-gray-700 mb-3">الإيرادات السنوية</p>
            <div className="space-y-2">
              {metrics.sales.byYear.map(y => {
                const max = Math.max(...metrics.sales.byYear.map(x => x.revenue));
                const pct = max > 0 ? (y.revenue / max) * 100 : 0;
                return (
                  <div key={y.year} className="grid grid-cols-[60px_1fr_140px] gap-3 items-center">
                    <span className="text-sm font-bold">{y.year}</span>
                    <div className="bg-gray-100 rounded-lg h-7 overflow-hidden">
                      <div className="h-full rounded-lg flex items-center px-3 text-xs font-bold text-[#1a1a2e]" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#F5C518,#e6a200)' }}>{y.count} أوردر</div>
                    </div>
                    <span className="text-sm font-black text-[#6B21A8] text-left">{fmt(y.revenue)} ج.م</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* Inventory section */}
      <Section icon="📦" title="المخزون">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إجمالي الوحدات" value={fmt(metrics.products.inventoryUnits)} />
          <KPI label="قيمة بيع المخزون" value={`${fmt(metrics.products.inventoryValueRetail)} ج.م`} />
          <KPI label="قيمة تكلفة المخزون" value={`${fmt(metrics.products.inventoryValueCost)} ج.م`} sub="35% COGS" />
          <KPI label="نفد المخزون" value={String(metrics.products.outOfStockCount)} tone={metrics.products.outOfStockCount > 0 ? 'bad' : 'ok'} />
        </div>
      </Section>

      {/* IP section */}
      <Section icon="📚" title="الملكية الفكرية" subtitle="المؤلفات والمحتوى الأصلي">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <IPCard icon="📖" label="الكتب المؤلَّفة" value={metrics.ip.booksValue} count={metrics.books.total} />
          <IPCard icon="🎮" label="المنتجات الإبداعية" value={metrics.ip.productsValue} count={metrics.products.total} />
          <IPCard icon="🎬" label="المحتوى الرقمي" value={metrics.ip.digitalValue} count={null} />
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-[#F5C518] rounded-2xl p-5 mt-4">
          <p className="text-xs text-amber-900 font-bold">إجمالي قيمة الملكية الفكرية</p>
          <p className="text-3xl font-black text-[#1a1a2e] mt-1">{fmt(metrics.ip.total)} ج.م</p>
        </div>
      </Section>

      {/* Products table */}
      <Section icon="🛍️" title="جدول المنتجات الكامل">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#1a1a2e] text-[#F5C518]">
                <tr>
                  <th className="px-3 py-3 text-right">المنتج</th>
                  <th className="px-3 py-3 text-right">الفئة</th>
                  <th className="px-3 py-3 text-right">السعر</th>
                  <th className="px-3 py-3 text-right">$</th>
                  <th className="px-3 py-3 text-right">المباع</th>
                  <th className="px-3 py-3 text-right">المخزون</th>
                  <th className="px-3 py-3 text-right">قيمة المخزون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(p => (
                  <tr key={p.id} className={p.stock <= 0 ? 'bg-red-50/40' : p.stock <= 50 ? 'bg-amber-50/40' : ''}>
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-gray-900">{p.name}</p>
                      {p.nameEn && <p className="text-[10px] text-gray-400">{p.nameEn}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{p.category}</td>
                    <td className="px-3 py-2.5 font-bold">{fmt(p.price)}</td>
                    <td className="px-3 py-2.5 text-gray-500">${p.priceUsd}</td>
                    <td className="px-3 py-2.5 font-bold text-blue-700">{p.sold}</td>
                    <td className="px-3 py-2.5 font-bold">{p.stock}</td>
                    <td className="px-3 py-2.5 font-black text-[#6B21A8]">{fmt(p.stockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Books table */}
      {books.length > 0 && (
        <Section icon="📕" title="الكتب الرقمية والمكتبة">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#1a1a2e] text-[#F5C518]">
                  <tr>
                    <th className="px-3 py-3 text-right">العنوان</th>
                    <th className="px-3 py-3 text-right">اللغة</th>
                    <th className="px-3 py-3 text-right">السعر</th>
                    <th className="px-3 py-3 text-right">$</th>
                    <th className="px-3 py-3 text-right">منشور؟</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {books.map(b => (
                    <tr key={b.id}>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-gray-900">{b.title}</p>
                        {b.titleEn && <p className="text-[10px] text-gray-400">{b.titleEn}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{b.language || '—'}</td>
                      <td className="px-3 py-2.5 font-bold">{fmt(b.price)}</td>
                      <td className="px-3 py-2.5 text-gray-500">${b.priceUSD ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        {b.isPublished ? <span className="text-emerald-700 font-bold">✓</span> : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}

      {/* Footer */}
      <div className="text-center py-8 text-xs text-gray-400 border-t border-gray-200">
        <p>تقرير تقييم محدَّث مباشرة من قاعدة البيانات · مسلم ليدر</p>
        <p className="mt-1">⚠️ تقدير أولي — للتقييم النهائي يُنصح بمحاسب قانوني معتمد.</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/8 backdrop-blur border border-white/15 rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,.08)' }}>
      <p className="text-[10px] text-white/60 font-bold tracking-widest">{label}</p>
      <p className="text-2xl font-black text-[#F5C518] mt-1">{value}</p>
    </div>
  );
}

function ScenarioCard({ label, value, desc, tone }: { label: string; value: number; desc: string; tone: 'base' | 'fair' | 'strategic' }) {
  const colors = {
    base: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
    fair: { bg: 'bg-amber-50', border: 'border-[#F5C518]', text: 'text-amber-800' },
    strategic: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800' },
  }[tone];
  return (
    <div className={`${colors.bg} border-2 ${colors.border} rounded-2xl p-5`}>
      <p className={`text-[10px] ${colors.text} font-bold tracking-widest`}>{label}</p>
      <p className="text-3xl font-black mt-1">{fmt(value)} <span className="text-sm">ج.م</span></p>
      <p className="text-xs text-gray-600 mt-2">{desc}</p>
    </div>
  );
}

function Section({ icon, title, subtitle, children }: { icon: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[#F5C518] to-[#e6a200] rounded-xl flex items-center justify-center text-xl">{icon}</div>
        <div>
          <h2 className="text-lg font-black text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className={`bg-white border rounded-2xl p-4 ${tone === 'bad' ? 'border-red-300' : 'border-gray-200'}`}>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-black mt-1 ${tone === 'bad' ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function IPCard({ icon, label, value, count }: { icon: string; label: string; value: number; count: number | null }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-2xl mb-2">{icon}</p>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
      {count !== null && <p className="text-sm text-gray-600 mt-1">{count} عنصر</p>}
      <p className="text-2xl font-black text-[#1a1a2e] mt-2">{fmt(value)} <span className="text-sm">ج.م</span></p>
    </div>
  );
}
