'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import Spinner from '@/components/admin/Spinner';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Assumptions {
  cogsRatio: number;
  ipBookValue: number;
  ipProductValue: number;
  ipDigitalValue: number;
  techValue: number;
  customerDbValue: number;
  receivablesProvisionRate: number;
  wholesaleCustomerValue: number;
  supplierRelationshipValue: number;
  fairMultiplier: number;
  strategicMultiplier: number;
  revenueMultipleLow: number;
  revenueMultipleHigh: number;
  activeWindowDays: number;
}

interface ValuationData {
  generatedAt: string;
  assumptions: Assumptions;
  defaults: Assumptions;
  metrics: {
    products: { total: number; inStockCount: number; outOfStockCount: number; inventoryUnits: number; inventoryValueRetail: number; inventoryValueCost: number; inventoryValueCostFromBatches: number; inventoryValueCostHeuristic: number; productsWithBatches: number; productsWithoutBatches: number; productsOpeningBalanceSeeded: number };
    books: { total: number; published: number; languages: string[] };
    sales: {
      totalOrders: number; validOrders: number; cancelledOrders: number; cancelledRevenue: number;
      totalRevenue: number; totalShipping: number; totalDiscount: number; revenueExShipping: number;
      avgOrderValue: number; avgOrderValueExShipping: number; unitsSold: number; unitsSoldLive: number;
      byYear: Array<{ year: number; revenue: number; count: number }>;
      byMonth: Array<{ ym: string; revenue: number; count: number }>;
      momRevenueGrowth: number | null;
    };
    customers: { total: number; wholesale: number; buyers: number; active: number; activeWindowDays: number; activeRatio: number; repeatBuyers: number; repeatRate: number; avgRevenuePerBuyer: number };
    shipments: number;
    production?: { batchesCount: number; unitsProduced: number; totalSpend: number };
    suppliers?: { total: number; active: number; transactionCount: number; netLiabilities: number };
    gifts?: { count: number; units: number; retailValue: number; shippingCost: number; totalCost: number };
    ip: { booksValue: number; productsValue: number; digitalValue: number; total: number; perBook: number; perProduct: number; booksCount: number; productsCount: number };
    tech: { value: number };
    customerDb: { value: number; perCustomer: number; appliedTo: number; registeredCount: number };
    wholesale: { value: number; perCustomer: number; count: number };
    supplierRelationships: { value: number; perSupplier: number; count: number };
    customerReceivables: { value: number; provisionRate: number; provision: number; netValue: number };
    royalties: {
      totalAccrued: number;
      agreementsActive: number;
      topAccruals: Array<{ payeeName: string; amountAccrued: number }>;
    };
    partners: {
      activeCount: number;
      totalCount: number;
      totalStakePercentage: number;
      remainingCompanyShare: number;
      totalCapitalContribution: number;
      isOverCommitted: boolean;
      rows: Array<{ id: string; name: string; type: string; stakePercentage: number; shareValue: number }>;
    };
    financial: {
      ttmRevenue: number; ttmRevenueFromItems: number;
      priorTtmRevenue: number; yoyRevenueGrowth: number | null;
      grossProfit: number; grossMargin: number; aov: number; discountBurn: number;
      annualPayroll: number; annualPayrollNominal: number;
      ebitdaPartial: number; ebitdaPartialMargin: number; headcount: number;
      productsCostedFromBatches: number; productsCostedFromHeuristic: number;
    };
    concentration: {
      top10CustomersRevenueShare: number;
      top10CustomersRevenueShareTtm: number;
      top5ProductsRevenueShare: number;
      top3GovernoratesShare: number;
      topGovernorates: Array<{ name: string; spend: number }>;
      usdRevenueShare: number;
      topSupplierShare: number;
    };
    dataQuality: {
      productsCostedFromBatches: number; productsCostedFromHeuristic: number;
      bostaOrphanCount: number; opexTracked: boolean;
      opexHeadcount: number; opexAnnualPayroll: number;
      assumptionsUpdatedAt: string | null;
    };
    inventoryHealth: {
      staleProductCount: number; staleUnits: number;
      staleInventoryRetail: number; staleInventoryCost: number;
      inventoryCostBeforeWriteDown: number; inventoryCostAfterWriteDown: number;
      staleDaysThreshold: number;
    };
    supplierMatrix: Array<{ supplierId: string; supplierName: string; spend: number; share: number }>;
    sensitivity: {
      cogsUp5pct:   { delta: number; newBase: number };
      cogsDown5pct: { delta: number; newBase: number };
      multipleDown05x: { delta: number; newMarketHigh: number };
      top10ChurnLoss: { revenueLost: number; newMarketLow: number; newMarketHigh: number };
      usdDevaluation10pct: { revenueImpact: number; newMarketHigh: number };
      staleWriteDown: { delta: number; newBase: number; itemsAffected: number };
    };
  };
  valuation: {
    base: number; fair: number; strategic: number;
    fairMultiplier: number; strategicMultiplier: number;
    marketLow: number; marketHigh: number;
    revenueMultipleLow: number; revenueMultipleHigh: number;
    reconciledLow: number; reconciledHigh: number; reconciledMid: number;
  };
  products: Array<{ id: string; name: string; nameEn: string | null; slug: string; price: number; priceUsd: number; category: string; stock: number; sold: number; soldLive: number; productionBatchUnits: number; stockValue: number }>;
  books: Array<{ id: string; title: string; titleEn: string | null; price: number; priceUSD: number | null; isPublished: boolean; language: string | null }>;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (n: number) => `${(n * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;

export default function ValuationPage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || (user?.permissions ?? []).includes('valuation.write');
  const [data, setData] = useState<ValuationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'detailed' | 'investor'>('detailed');
  const [editingAssumptions, setEditingAssumptions] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  // Auto-load on mount — the report is now gated solely on the
  // valuation.read permission, so any user who can reach this page
  // can see the numbers without re-typing a separate password.
  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/valuation`, { credentials: 'include', cache: 'no-store' });
      if (res.status === 403) { setForbidden(true); setLoading(false); return; }
      const d = await res.json();
      if (res.ok) setData(d);
      else addToast(d.error || 'فشل التوليد', 'error');
    } catch { addToast('فشل التوليد', 'error'); }
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const saveAssumptions = async (next: Assumptions) => {
    try {
      const res = await fetch(`/api/admin/valuation`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحفظ', 'error'); return; }
      // Surface clamping/rejection so the user knows the saved value differs
      // from what they typed (the server clamps out-of-range numbers rather
      // than silently dropping them, which is misleading).
      const clamped: Array<{ field: string; from: number; to: number }> = d.clamped || [];
      const rejected: string[] = d.rejected || [];
      if (clamped.length) {
        addToast(`تم تعديل ${clamped.length} قيمة لتدخل في النطاق المسموح`, 'warning', 6000);
      }
      if (rejected.length) {
        addToast(`تم تجاهل ${rejected.length} قيمة غير صالحة`, 'warning', 6000);
      }
      if (!clamped.length && !rejected.length) {
        addToast('تم حفظ الافتراضات', 'success');
      }
      setEditingAssumptions(false);
      reload();
    } catch {
      addToast('فشل الحفظ', 'error');
    }
  };

  if (forbidden) return <ForbiddenState requiredPerm="valuation.read" />;
  if (loading || !data) return <Spinner />;

  const { metrics, valuation, products, books, assumptions } = data;

  return (
    <div className="space-y-6 print:bg-white print:space-y-4" dir="rtl">
      {/* Print stylesheet — keeps gradients, blocks page breaks inside cards,
          forces a clean A4-friendly margin. The printable view should look
          like a polished investor handout, not a Chrome screenshot.
          Header/footer running strip + watermark intentionally removed
          per owner request — the document should read clean, no
          recurring page text fighting the data. */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm 12mm 14mm 12mm;
          }
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .valuation-section { break-inside: avoid; page-break-inside: avoid; }
          .valuation-page-break { break-before: page; page-break-before: page; }
          /* Stop tooltips from popping in the print stream */
          [aria-label="شرح"] { display: none !important; }

          /* Readability pass — the screen styling uses very small
             fonts and pale greys that disappear on paper. Bump the
             whole document up one notch for print and darken the
             muted text so the data carries the page. */
          body {
            font-size: 12pt !important;
            line-height: 1.45 !important;
            color: #1a1a1a !important;
          }
          .text-\\[9px\\], .text-\\[10px\\] { font-size: 9pt !important; }
          .text-\\[11px\\], .text-xs { font-size: 10pt !important; }
          .text-sm { font-size: 11pt !important; }
          .text-base { font-size: 12pt !important; }
          .text-lg { font-size: 14pt !important; }
          .text-xl { font-size: 16pt !important; }
          .text-2xl { font-size: 19pt !important; }
          .text-3xl { font-size: 23pt !important; }
          .text-4xl, .text-5xl { font-size: 28pt !important; }
          /* Pale greys → readable charcoal in print */
          .text-gray-300, .text-gray-400 { color: #4b5563 !important; }
          .text-gray-500 { color: #374151 !important; }
          .text-gray-600 { color: #1f2937 !important; }
          .text-white\\/40, .text-white\\/60, .text-white\\/70 { color: rgba(255,255,255,0.92) !important; }
          /* Make borders crisp on paper */
          .border, .border-2 { border-color: #9ca3af !important; }
        }
      `}</style>

      {/* Action bar — sticky on mobile so the controls stay reachable while
          scrolling through a long report */}
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden sticky top-0 z-20 bg-gray-50/95 backdrop-blur -mx-4 px-4 py-3 -mt-2 sm:static sm:bg-transparent sm:backdrop-blur-none sm:mx-0 sm:px-0 sm:py-0 sm:mt-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-500 truncate">تم التوليد: {new Date(data.generatedAt).toLocaleString('en-GB')}</p>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button onClick={() => setView('detailed')} className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition ${view === 'detailed' ? 'bg-white shadow-sm text-[#1a1a2e]' : 'text-gray-500'}`}>📊 تفصيلي</button>
            <button onClick={() => setView('investor')} className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition ${view === 'investor' ? 'bg-white shadow-sm text-[#1a1a2e]' : 'text-gray-500'}`}>🤝 المستثمر</button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} title="استخدم 'حفظ كـ PDF' في نافذة الطباعة" className="px-3 sm:px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-[11px] sm:text-xs font-bold transition">⬇️ تحميل PDF</button>
          <button onClick={() => reload()} className="px-3 sm:px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] sm:text-xs font-bold transition">🔄 تحديث</button>
        </div>
      </div>

      {/* Hero — balanced (fair) value is the headline. Strategic is a conditional bonus. */}
      <div className="rounded-3xl p-6 sm:p-10 text-white text-center" style={{ background: 'linear-gradient(135deg,#1a1a2e 0%,#2d1060 50%,#6B21A8 100%)' }}>
        <p className="text-xs text-[#F5C518] font-bold tracking-[3px] uppercase">تقدير داخلي — قيد المراجعة</p>
        <h1 className="text-4xl sm:text-5xl font-black mt-3">مسلم ليدر</h1>
        <p className="text-white/70 mt-2 text-sm">{new Date(data.generatedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
          <Stat label="منتجات (نوع)" value={String(metrics.products.total)} hint="عدد أنواع المنتجات في الكتالوج (مش عدد القطع)." />
          <Stat label="كتب رقمية" value={String(metrics.books.total)} hint="إجمالي عناوين المكتبة، شامل غير المنشور." />
          <Stat label="عملاء مسجَّلين" value={fmt(metrics.customers.total)} hint="إجمالي حسابات العملاء — مش عدد المشترين." />
          <Stat label="شحنات (Bosta)" value={fmt(metrics.shipments)} hint="إجمالي صفوف Shipment، شامل الملغية." />
        </div>

        <div className="mt-8 pt-8 border-t border-white/10">
          <p className="text-[#F5C518] text-xs font-bold tracking-widest">نطاق التقييم المُسوّى (Reconciled Range)</p>
          <p className="text-3xl sm:text-5xl font-black mt-3">
            {fmt(valuation.reconciledLow)} <span className="text-lg sm:text-xl text-white/60 mx-2">–</span> {fmt(valuation.reconciledHigh)}
            <span className="text-base sm:text-xl text-white/60 mx-2">ج.م</span>
          </p>
          <p className="text-white/70 text-xs sm:text-sm mt-2">المتوسط المقترح: <strong className="text-[#F5C518]">{fmt(valuation.reconciledMid)} ج.م</strong></p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5 max-w-3xl mx-auto text-[11px] sm:text-xs">
            <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
              <p className="text-white/50">منهج الأصول (Asset)</p>
              <p className="text-white font-bold mt-0.5">{fmt(valuation.base)} – {fmt(valuation.strategic)} ج.م</p>
            </div>
            <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
              <p className="text-white/50">منهج مضاعف الإيرادات (Market)</p>
              <p className="text-white font-bold mt-0.5">{fmt(valuation.marketLow)} – {fmt(valuation.marketHigh)} ج.م</p>
              <p className="text-white/40 text-[10px] mt-0.5">الإيرادات السنوية × {valuation.revenueMultipleLow}–{valuation.revenueMultipleHigh}</p>
            </div>
            <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
              <p className="text-white/50">الإيرادات السنوية (TTM)</p>
              <p className="text-white font-bold mt-0.5">{fmt(metrics.financial.ttmRevenue)} ج.م</p>
              {metrics.financial.yoyRevenueGrowth !== null && (
                <p className={`text-[10px] mt-0.5 ${metrics.financial.yoyRevenueGrowth >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {metrics.financial.yoyRevenueGrowth >= 0 ? '▲' : '▼'} {pct(Math.abs(metrics.financial.yoyRevenueGrowth))} YoY
                </p>
              )}
            </div>
          </div>
          <p className="text-white/40 text-[10px] sm:text-xs mt-4 max-w-md mx-auto">⚠️ تقدير داخلي — يحتاج عناية واجبة (due diligence) قبل التفاوض الرسمي.</p>
        </div>
      </div>

      {/* Reconcile pre-fix PayPal orders — only renders when orphans exist */}
      <PaypalReconcileBanner onDone={reload} />

      {/* Financial performance — the most important section for any
          real M&A conversation. TTM revenue, gross margin, growth. */}
      <FinancialSection metrics={metrics} />

      {/* Concentration risk — what fraction of revenue depends on a
          handful of customers, products, governorates, or suppliers. */}
      <ConcentrationSection metrics={metrics} />

      {/* Inventory health — slow-movers that should be written down. */}
      <InventoryHealthSection metrics={metrics} />

      {/* Per-supplier matrix — top 5 suppliers + their share. */}
      {metrics.supplierMatrix.length > 0 && <SupplierMatrixSection metrics={metrics} />}

      {/* Sensitivity analysis — how does the headline move under stress? */}
      <SensitivitySection metrics={metrics} valuation={valuation} />

      {/* Data quality / disclosures — every gap the reader should
          weigh against the headline figure. Honesty > false precision. */}
      <DataQualitySection metrics={metrics} />

      {/* Gaps section — front and centre because the valuation is incomplete without these */}
      <GapsSection metrics={metrics} assumptions={assumptions} />

      {/* Methodology — what's in the formula and what assumptions feed it */}
      <MethodologySection
        assumptions={assumptions}
        defaults={data.defaults}
        canEdit={canEdit}
        editing={editingAssumptions}
        onEditToggle={() => setEditingAssumptions(v => !v)}
        onSave={saveAssumptions}
      />

      {/* Three scenarios — balanced is highlighted, strategic carries a conditional caveat */}
      <Section icon="💎" title="نطاقات التقييم" subtitle="ثلاثة سيناريوهات بناءً على نوع المشتري ومدى استكمال البيانات">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ScenarioCard
            label="الحد الأدنى"
            value={valuation.base}
            desc="تصفية / مشتري مالي يقيّم الأصول فقط"
            tone="base"
            multiplier="× 1.0 (Base)"
            condition="يفترض بيع المخزون بنصف القيمة + احتساب الـ IP بالعدد فقط."
          />
          <ScenarioCard
            label="القيمة المتوازنة ✦"
            value={valuation.fair}
            desc="سوق متوازنة — المرشَّحة كأرضية تفاوض"
            tone="fair"
            multiplier={`× ${valuation.fairMultiplier}`}
            condition="يفترض استمرار النشاط الحالي بدون نمو غير عادي."
            highlighted
          />
          <ScenarioCard
            label="القيمة الاستراتيجية"
            value={valuation.strategic}
            desc="مشتري استراتيجي مع تكامل توزيع/براند"
            tone="strategic"
            multiplier={`× ${valuation.strategicMultiplier}`}
            condition="مشروط: يحتاج بيانات ربحية مكتملة + مخزون مُقيَّم + ملكية فكرية موثَّقة + مشتري بحاجة استراتيجية فعلية. لا يُستخدم كرقم رئيسي."
          />
        </div>
      </Section>

      {view === 'investor' ? <InvestorView data={data} /> : <DetailedView data={data} products={products} books={books} />}

      {/* Disclaimer */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 text-amber-900 text-xs leading-relaxed">
        <p className="font-black mb-1.5">⚠️ إخلاء مسؤولية</p>
        <p>هذا التقييم تقديري داخلي مبني على البيانات المتاحة داخل النظام، ولا يمثل تقييمًا ماليًا رسميًا. يجب مراجعته بواسطة محاسب أو مستشار مالي قبل استخدامه في بيع حصص أو التفاوض مع مستثمر. لا يتم احتساب الأرباح الصافية أو تكلفة العمليات أو الالتزامات المالية في هذه الأرقام.</p>
      </div>

      <div className="text-center py-6 text-[10px] text-gray-400 border-t border-gray-200">
        تقرير مولَّد آليًا · مسلم ليدر · {new Date(data.generatedAt).toLocaleDateString('en-GB')}
      </div>
    </div>
  );
}

// ==========================================================================
// Top-level sections
// ==========================================================================

// ────────────────────────────────────────────────────────────────────────────
// Financial Performance — TTM revenue, margin, growth. The single most
// important section for an M&A conversation. EBITDA is openly disclosed
// as untracked (the system doesn't capture OpEx); we tell the reader.
// ────────────────────────────────────────────────────────────────────────────
function FinancialSection({ metrics }: { metrics: ValuationData['metrics'] }) {
  const f = metrics.financial;
  const yoyTone = f.yoyRevenueGrowth === null ? 'neutral'
    : f.yoyRevenueGrowth >= 0 ? 'good' : 'bad';
  const marginTone = f.grossMargin >= 0.4 ? 'good'
    : f.grossMargin >= 0.2 ? 'neutral' : 'bad';
  const ebitdaTone = f.ebitdaPartial > 0 ? 'good' : f.ebitdaPartial < 0 ? 'bad' : 'neutral';
  const hasPayroll = f.headcount > 0;
  return (
    <Section icon="📈" title="الأداء المالي" subtitle="إيرادات آخر 12 شهر، هامش الربح الإجمالي، تقدير EBITDA بعد الرواتب">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FinKPI label="إيرادات آخر 12 شهر (TTM)" value={`${fmt(f.ttmRevenue)} ج.م`} hint="مجموع Order.total لآخر 12 شهر، باستثناء الملغي والهدايا." />
        <FinKPI
          label="معدل النمو السنوي (YoY)"
          value={f.yoyRevenueGrowth === null ? '—' : `${f.yoyRevenueGrowth >= 0 ? '▲' : '▼'} ${pct(Math.abs(f.yoyRevenueGrowth))}`}
          tone={yoyTone}
          hint={`مقارنة TTM (${fmt(f.ttmRevenue)}) بآخر 12 شهر سابقة (${fmt(f.priorTtmRevenue)}).`}
        />
        <FinKPI label="هامش الربح الإجمالي (المنتجات، بدون شحن)" value={pct(f.grossMargin)} tone={marginTone} sub={`${fmt(f.grossProfit)} ج.م ربح إجمالي`} hint="(إيرادات OrderItem بدون شحن) ناقص تكلفة الباتش المرجَّحة. القاعدة هي إيراد المنتجات فقط — لو احتسبنا الشحن النسبة هتختلف." />
        <FinKPI label="متوسط قيمة الطلب (تاريخي، شامل الشحن)" value={`${fmt(f.aov)} ج.م`} hint="إجمالي الإيرادات الكلية (شاملة الشحن، عبر تاريخ الشركة) ÷ عدد الطلبات الصحيحة. لو محتاج AOV لآخر 12 شهر فقط، بُص على إيرادات TTM ÷ عدد الطلبات في نفس الفترة." />
        <FinKPI
          label="رواتب سنوية"
          value={hasPayroll ? `${fmt(f.annualPayroll)} ج.م` : '—'}
          tone={hasPayroll ? 'neutral' : undefined}
          sub={hasPayroll ? `${fmt(f.headcount)} عضو · معدّل بمعاملات الاستشاريين` : 'لم يُسجَّل أي عضو في /admin/team'}
          hint="إجمالي الرواتب السنوية من دليل الفريق. تُخصم من الربح الإجمالي لتقدير EBITDA الجزئي."
        />
        <FinKPI
          label="EBITDA الجزئي"
          value={hasPayroll ? `${fmt(f.ebitdaPartial)} ج.م` : '—'}
          tone={hasPayroll ? ebitdaTone : undefined}
          sub={hasPayroll ? `هامش ${pct(f.ebitdaPartialMargin)}` : 'يحتاج تسجيل الفريق أولاً'}
          hint="ربح إجمالي ناقص الرواتب السنوية. أقرب رقم لـ EBITDA الحقيقي بدون تتبع الإيجار + التسويق."
        />
        <FinKPI label="نسبة الخصومات من البيع" value={pct(f.discountBurn)} hint="إجمالي الخصومات ÷ المبيعات الإجمالية قبل الخصم (Order.total الصافي + قيمة الخصم). يقلل من الهامش الفعلي." />
        <FinKPI
          label="منتجات بتكلفة فعلية"
          value={`${fmt(f.productsCostedFromBatches)} / ${fmt(f.productsCostedFromBatches + f.productsCostedFromHeuristic)}`}
          tone={f.productsCostedFromHeuristic === 0 ? 'good' : 'neutral'}
          hint="منتجات لها باتشات إنتاج فعلية تستخدم تكلفتها الحقيقية. الباقي يستخدم نسبة افتراضية."
        />
      </div>
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mt-4">
        <p className="text-[11px] text-amber-900 leading-relaxed">
          ⚠️ <strong>EBITDA المعروض جزئي.</strong>{' '}
          {hasPayroll
            ? 'الرواتب الآن مدمجة في الحساب من دليل الفريق، لكن النظام لا يتتبع الإيجار أو التسويق أو المرافق. EBITDA الجزئي يساعد في تقدير الربحية، لكن EBITDA الحقيقي يتطلب جمع هذه المصروفات يدوياً.'
            : 'لإظهار EBITDA الجزئي، أضف الفريق والاستشاريين في '}
          {!hasPayroll && <Link href="/admin/team" className="underline font-bold">/admin/team</Link>}
          {!hasPayroll && '.'}
        </p>
      </div>
    </Section>
  );
}

function FinKPI({ label, value, sub, hint, tone }: { label: string; value: string; sub?: string; hint?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const cls = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 font-bold tracking-widest flex items-center gap-1">
        {label}
        {hint && <Tooltip text={hint} />}
      </p>
      <p className={`text-xl font-black mt-1 ${cls}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Concentration risk — buyer's first questions: "what if your top 5
// customers leave?", "what if your top supplier raises prices?"
// ────────────────────────────────────────────────────────────────────────────
function ConcentrationSection({ metrics }: { metrics: ValuationData['metrics'] }) {
  const c = metrics.concentration;
  const flag = (share: number, threshold: number): 'good' | 'bad' | 'neutral' =>
    share === 0 ? 'neutral' : share > threshold ? 'bad' : 'good';
  return (
    <Section icon="⚠️" title="تحليل المخاطر المركّزة" subtitle="ما هي نسبة الإيرادات التي تعتمد على عدد قليل من العملاء/المنتجات/الموردين؟">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FinKPI
          label="تركّز العملاء (أعلى 10)"
          value={pct(c.top10CustomersRevenueShare)}
          tone={flag(c.top10CustomersRevenueShare, 0.4)}
          hint="حصة أعلى 10 عملاء من إجمالي الإيرادات. أعلى من 40% = خطر تركّز عالي."
        />
        <FinKPI
          label="تركّز المنتجات (أعلى 5)"
          value={pct(c.top5ProductsRevenueShare)}
          tone={flag(c.top5ProductsRevenueShare, 0.6)}
          hint="حصة أعلى 5 منتجات من الإيرادات. الاعتماد الكبير على منتج واحد = خطر."
        />
        <FinKPI
          label="تركّز جغرافي (أعلى 3 محافظات)"
          value={pct(c.top3GovernoratesShare)}
          sub={c.topGovernorates.length > 0 ? c.topGovernorates.map(g => g.name).join(' · ') : undefined}
          tone={flag(c.top3GovernoratesShare, 0.7)}
          hint="حصة أعلى 3 محافظات من إجمالي إنفاق الطلبات. التركيز الشديد = خطر تنويع."
        />
        <FinKPI
          label="حصة العملة الأجنبية (USD)"
          value={pct(c.usdRevenueShare)}
          hint="نسبة الإيرادات بالدولار (PayPal). تعرّض لمخاطر سعر الصرف."
        />
        <FinKPI
          label="تركّز الموردين (الأكبر)"
          value={pct(c.topSupplierShare)}
          tone={flag(c.topSupplierShare, 0.5)}
          hint="حصة أكبر مورد من إجمالي تكلفة الإنتاج. أعلى من 50% = خطر فقدان مورد رئيسي."
        />
      </div>
      <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
        الحدود المرجعية تعكس الممارسة الصناعية: العملاء &lt;40%، المنتجات &lt;60%، الجغرافيا &lt;70%، المورد الواحد &lt;50%.
        تجاوز هذه الحدود يخفض التقييم لأن المشتري يخصم لمخاطر فقدان الإيراد.
      </p>
    </Section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Data quality / disclosures — explicit list of what's heuristic vs.
// data-driven. A professional report tells the reader where to be
// skeptical instead of pretending precision it doesn't have.
// ────────────────────────────────────────────────────────────────────────────
function DataQualitySection({ metrics }: { metrics: ValuationData['metrics'] }) {
  const q = metrics.dataQuality;
  const totalProducts = q.productsCostedFromBatches + q.productsCostedFromHeuristic;
  const batchCoverage = totalProducts > 0 ? q.productsCostedFromBatches / totalProducts : 0;
  return (
    <section className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 valuation-section">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🔍</span>
        <h2 className="text-base font-black text-red-900">جودة البيانات والإفصاحات (Data Quality)</h2>
      </div>
      <p className="text-[11px] text-red-800 mb-3">قراءة شفّافة للقارئ: ما الذي يستند إلى بيانات حقيقية، وما الذي يعتمد على افتراض؟</p>
      <ul className="space-y-2 text-xs text-red-900">
        <li className="flex items-start gap-2">
          <span>📦</span>
          <span>
            <strong>{fmt(q.productsCostedFromBatches)}</strong> من <strong>{fmt(totalProducts)}</strong> منتج لها تكلفة فعلية من باتشات الإنتاج ({pct(batchCoverage)}).
            الباقي ({fmt(q.productsCostedFromHeuristic)}) يستخدم نسبة COGS افتراضية 35% — هامش الربح الموضّح يعكس مزيج البيانات الحقيقية والاحتياطية.
          </span>
        </li>
        {q.bostaOrphanCount > 0 && (
          <li className="flex items-start gap-2">
            <span>📋</span>
            <span>
              <strong>{fmt(q.bostaOrphanCount)}</strong> طلب بوسطة مستورد بدون عناصر منتج (OrderItems).
              هذه الطلبات لا تظهر في تقرير المبيعات أو هامش الربح.{' '}
              <Link href="/admin/reports/bosta-orphans" className="underline font-bold">إصلاح الآن</Link>
            </span>
          </li>
        )}
        <li className="flex items-start gap-2">
          <span>💰</span>
          <span>
            <strong>المصروفات التشغيلية غير مسجَّلة</strong> في النظام (رواتب، إيجار، تسويق، شحن مركزي).
            تقدير EBITDA يتطلب جمع هذه الأرقام يدوياً من سجلات خارج النظام.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span>📅</span>
          <span>
            آخر تحديث للافتراضات: <strong>{q.assumptionsUpdatedAt ? new Date(q.assumptionsUpdatedAt).toLocaleDateString('en-GB') : 'القيم الافتراضية (لم يتم التعديل بعد)'}</strong>.
            افتراضات الـ IP وقيمة العميل والمنصة تقديرات داخلية تحتاج مراجعة احترافية لكل صفقة.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span>📐</span>
          <span>
            <strong>منهجية التقييم:</strong> النطاق المُسوَّى يجمع منهج الأصول (asset floor) مع منهج مضاعف الإيرادات (market band).
            لا يوجد منهج DCF (income approach) لأن صافي الربح غير محسوب. عند التفاوض الرسمي، يجب إضافة منهج DCF بعد جمع المصروفات.
          </span>
        </li>
        {/* Accountant-grade disclosures — every line a buyer / bank
            would otherwise raise as a question. Listed explicitly so
            a reader can't accuse the report of hiding gaps. */}
        <li className="flex items-start gap-2">
          <span>🏦</span>
          <span>
            <strong>ما لا يتضمنه التقرير:</strong> النقد في الخزينة والبنوك، المسحوبات الشخصية للمالك،
            الالتزامات الضريبية (ضريبة القيمة المضافة 14%، ضريبة الدخل، الدمغة، ضريبة كسب العمل)،
            القروض البنكية والتسهيلات الائتمانية، المصروفات المدفوعة مقدماً، الإيرادات المؤجلة (طلبات مسبقة الدفع لم تُسلَّم بعد)،
            والأصول الثابتة (مكاين الطباعة، الأثاث، السيارات). هذه البنود غير مُتتبَّعة في النظام —
            لو وُجدت بأرقام جوهرية فهي تُغيّر القيمة الأساسية.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span>📅</span>
          <span>
            <strong>أعمار الذمم المدينة:</strong> الذمم تُجمَع بقيمتها الإجمالية بدون تصنيف حسب التقادم (0–30 / 31–60 / 61–90 / 90+ يوم).
            احتياطي الديون المشكوك فيها يُطبَّق بنسبة موحَّدة على الكل — لو فيه ذمم متقادمة فعلاً، الأنسب رفع نسبة الاحتياطي يدوياً.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span>📚</span>
          <span>
            <strong>قيمة الملكية الفكرية:</strong> رسملة المؤلَّفات والمنتجات هنا اجتهاد إداري لأغراض تفاوضية.
            معايير IFRS / EAS لا تسمح برسملة الملكية الفكرية المطوَّرة داخلياً ما لم تُتتبَّع تكلفة التطوير الفعلية.
            لا تُقدَّم هذه الأرقام في قائمة المركز المالي القانونية.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span>♻️</span>
          <span>
            <strong>مستحقات حقوق المؤلفين متجدّدة:</strong> الرقم الظاهر يعكس آخر 12 شهر فقط.
            المستحقات تتراكم سنوياً ما لم تُسدَّد — ليست دفعة لمرة واحدة. الاتفاقيات المنتهية مدتها (endDate في الماضي) تُستثنى تلقائياً.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span>👤</span>
          <span>
            <strong>المالك يظهر كمدير ومؤلف:</strong> الراتب الشهري في /admin/team والنسبة من الربح في /admin/ip
            تصميم مقصود — الأول أجر إدارة، الثاني عائد على المؤلَّف. الرقمان قابلان للجمع (ليسا ازدواجاً).
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span>💱</span>
          <span>
            <strong>حصة الإيراد بالدولار</strong> تفترض أن قيم الطلبات (Order.total) مخزَّنة بالجنيه المصري بعد التحويل.
            إن كانت مخزَّنة بالعملة الأصلية للطلب، النسبة بحاجة إلى تطبيق سعر صرف مرجعي قبل القسمة.
          </span>
        </li>
      </ul>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Inventory health — products with stock-on-hand that haven't sold in
// 365 days. Standard write-down candidates. We show the impact on
// inventory cost so the reader sees the realistic asset value.
// ────────────────────────────────────────────────────────────────────────────
function InventoryHealthSection({ metrics }: { metrics: ValuationData['metrics'] }) {
  const h = metrics.inventoryHealth;
  if (h.staleProductCount === 0) {
    return (
      <Section icon="🏷️" title="صحة المخزون" subtitle="منتجات مخزَّنة بدون مبيعات لفترة طويلة (مرشَّحة لشطب القيمة)">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-xs text-emerald-900">كل المنتجات اللي عندها مخزون باعت خلال آخر سنة. ما فيش مرشحات لشطب القيمة.</p>
        </div>
      </Section>
    );
  }
  return (
    <Section icon="🏷️" title="صحة المخزون" subtitle={`منتجات بدون مبيعات لمدة ${h.staleDaysThreshold} يوم — مرشَّحة لشطب القيمة`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FinKPI label="منتجات راكدة" value={fmt(h.staleProductCount)} tone="bad" hint="منتجات لها مخزون لكن مفيش مبيعات لها خلال 12 شهر." />
        <FinKPI label="قطع راكدة" value={fmt(h.staleUnits)} tone="bad" hint="إجمالي وحدات المخزون من المنتجات الراكدة." />
        <FinKPI label="القيمة بسعر البيع" value={`${fmt(h.staleInventoryRetail)} ج.م`} hint="القيمة لو اتباعت بأسعار التجزئة الحالية — افتراض متفائل." />
        <FinKPI label="تكلفة الشطب المقترحة" value={`${fmt(h.staleInventoryCost)} ج.م`} tone="bad" hint="تكلفة الإنتاج المرجَّحة للقطع الراكدة. خصمها من تكلفة المخزون يعطي رقم أكثر واقعية." />
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 text-[11px] text-amber-900 leading-relaxed">
        💡 <strong>تكلفة المخزون قبل الشطب:</strong> {fmt(h.inventoryCostBeforeWriteDown)} ج.م &nbsp;→&nbsp;
        <strong>بعد الشطب:</strong> {fmt(h.inventoryCostAfterWriteDown)} ج.م.
        المشتري المحتمل سيخصم القطع الراكدة من قيمة الأصول؛ التقرير يعرض الرقمين عشان يتم التفاوض على رقم منطقي.
      </div>
    </Section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Supplier matrix — top 5 by total batch spend with %. Surfaces
// concentration: "if our top supplier raises prices, what's the
// revenue at risk?"
// ────────────────────────────────────────────────────────────────────────────
function SupplierMatrixSection({ metrics }: { metrics: ValuationData['metrics'] }) {
  const m = metrics.supplierMatrix;
  return (
    <Section icon="🤝" title="مصفوفة الموردين" subtitle="أكبر 5 موردين حسب إنفاق الإنتاج وحصة كل منهم">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase">
            <tr>
              <th className="px-3 py-2 text-right">المورد</th>
              <th className="px-3 py-2 text-right">إجمالي الإنفاق</th>
              <th className="px-3 py-2 text-right">الحصة</th>
              <th className="px-3 py-2 text-right">المخاطر</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {m.map(s => {
              const tone = s.share > 0.5 ? 'bg-red-100 text-red-800' : s.share > 0.3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
              const flag = s.share > 0.5 ? '⚠️ خطر مرتفع' : s.share > 0.3 ? '⚠️ متوسط' : '✓ مقبول';
              return (
                <tr key={s.supplierId}>
                  <td className="px-3 py-2 font-bold text-gray-900">{s.supplierName}</td>
                  <td className="px-3 py-2 font-bold" dir="ltr">{fmt(s.spend)} ج.م</td>
                  <td className="px-3 py-2 font-bold">{pct(s.share)}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tone}`}>{flag}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-500 mt-2">حد المخاطر المرتفعة عند 50% — بمعنى إن نصف الإنتاج معتمد على مورد واحد. الحد المتوسط 30%.</p>
    </Section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sensitivity analysis — how the headline number moves under common
// stresses. Shows the buyer the reasonable downside and lets the
// owner test scenarios before negotiations.
// ────────────────────────────────────────────────────────────────────────────
function SensitivitySection({ metrics, valuation }: { metrics: ValuationData['metrics']; valuation: ValuationData['valuation'] }) {
  const s = metrics.sensitivity;
  const scenarios = [
    {
      label: 'COGS أعلى بـ 5%',
      desc: 'لو ارتفعت تكاليف الإنتاج 5% (تضخم أو زيادة سعر مورد)',
      impact: s.cogsUp5pct.delta,
      newValue: `قاعدة جديدة: ${fmt(s.cogsUp5pct.newBase)} ج.م`,
      tone: 'bad' as const,
    },
    {
      label: 'COGS أقل بـ 5%',
      desc: 'لو نزلت تكاليف الإنتاج 5% (تفاوض ناجح)',
      impact: s.cogsDown5pct.delta,
      newValue: `قاعدة جديدة: ${fmt(s.cogsDown5pct.newBase)} ج.م`,
      tone: 'good' as const,
    },
    {
      label: 'مضاعف الإيرادات يقل ½×',
      desc: 'لو السوق صعّب الشروط ونزل المضاعف من الحد الأعلى نصف نقطة',
      impact: s.multipleDown05x.delta,
      newValue: `حد أعلى جديد: ${fmt(s.multipleDown05x.newMarketHigh)} ج.م`,
      tone: 'bad' as const,
    },
    {
      label: 'فقدان أعلى 10 عملاء',
      desc: `لو خسرت أعلى 10 عملاء (حسب آخر 12 شهر) وما رجعوش — تأثير ${fmt(s.top10ChurnLoss.revenueLost)} ج.م إيرادات سنوية`,
      impact: s.top10ChurnLoss.newMarketHigh - valuation.marketHigh,
      newValue: `نطاق سوقي جديد: ${fmt(s.top10ChurnLoss.newMarketLow)} – ${fmt(s.top10ChurnLoss.newMarketHigh)}`,
      tone: 'bad' as const,
    },
    {
      label: 'تراجع الجنيه 10% أمام الدولار',
      desc: `تأثر إيرادات PayPal بالدولار (نسبة ${pct(metrics.concentration.usdRevenueShare)} من الإيرادات)`,
      impact: s.usdDevaluation10pct.newMarketHigh - valuation.marketHigh,
      newValue: `حد أعلى سوقي: ${fmt(s.usdDevaluation10pct.newMarketHigh)} ج.م`,
      tone: 'bad' as const,
    },
    {
      label: 'شطب المخزون الراكد',
      desc: `${s.staleWriteDown.itemsAffected} منتج بدون مبيعات لسنة — لو شطبت قيمتهم`,
      impact: s.staleWriteDown.delta,
      newValue: `قاعدة جديدة: ${fmt(s.staleWriteDown.newBase)} ج.م`,
      tone: 'bad' as const,
    },
  ];
  return (
    <Section icon="🧮" title="تحليل الحساسية" subtitle="كيف تتغير القيمة تحت ضغوط شائعة (للتفاوض المسؤول)">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase">
            <tr>
              <th className="px-3 py-2 text-right">السيناريو</th>
              <th className="px-3 py-2 text-right">الوصف</th>
              <th className="px-3 py-2 text-right">الأثر</th>
              <th className="px-3 py-2 text-right">القيمة الجديدة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {scenarios.map((sc, i) => {
              const sign = sc.impact >= 0 ? '+' : '';
              const tone = sc.impact > 0 ? 'text-emerald-700' : sc.impact < 0 ? 'text-red-700' : 'text-gray-500';
              return (
                <tr key={i}>
                  <td className="px-3 py-2.5 font-bold text-gray-900">{sc.label}</td>
                  <td className="px-3 py-2.5 text-[10px] text-gray-600 max-w-[280px]">{sc.desc}</td>
                  <td className={`px-3 py-2.5 font-black ${tone}`} dir="ltr">{sign}{fmt(sc.impact)} ج.م</td>
                  <td className="px-3 py-2.5 text-[10px] text-gray-600">{sc.newValue}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-500 mt-2">القيمة الحالية المرشَّحة (المتوسط): <strong className="text-gray-800">{fmt(valuation.reconciledMid)} ج.م</strong>. كل سيناريو يعرض الأثر منفرداً، مش مجتمعاً.</p>
    </Section>
  );
}

function GapsSection({ metrics, assumptions }: { metrics: ValuationData['metrics']; assumptions: Assumptions }) {
  // Build a punch list of measurable gaps. Each entry surfaces what we
  // *don't* know and therefore can't price. This is intentionally
  // prominent — a buyer would ask all of these on day one of due diligence.
  const gaps: Array<{ severity: 'high' | 'medium' | 'low'; label: string; detail: string }> = [];

  gaps.push({ severity: 'high', label: 'صافي الربح غير محسوب', detail: 'النظام لا يخزن تكلفة المنتج الفعلية (COGS) ولا تكلفة التسويق ولا المرتبات. كل الأرقام إيرادات، مش أرباح.' });
  if (metrics.products.productsWithoutBatches > 0) {
    const sev = metrics.products.productsWithBatches === 0 ? 'high' : 'medium';
    gaps.push({
      severity: sev,
      label: metrics.products.productsWithBatches === 0 ? 'تكلفة المخزون تقديرية' : 'بعض المنتجات بدون باتشات',
      detail: metrics.products.productsWithBatches === 0
        ? `لم تُسجَّل أي باتشات إنتاج بعد. تكلفة المخزون محسوبة بنسبة ${pct(assumptions.cogsRatio)} من سعر البيع كافتراض. سجل باتشات الإنتاج من قسم 🏭 الإنتاج لجعل الرقم فعلياً.`
        : `${metrics.products.productsWithoutBatches} منتج بدون باتشات إنتاج بعد، تكلفتها لسه تقديرية (${pct(assumptions.cogsRatio)} من سعر البيع). ${metrics.products.productsWithBatches} منتج بقت محسوبة بمتوسط مرجح من الباتشات.`,
    });
  }
  gaps.push({ severity: 'high', label: 'قيمة الملكية الفكرية بالعدد', detail: `كل كتاب = ${fmt(metrics.ip.perBook)} ج.م و كل منتج = ${fmt(metrics.ip.perProduct)} ج.م بصرف النظر عن المبيعات الفعلية. كتاب بـ 0 مبيعات يُحتسب بنفس قيمة الـ bestseller.` });
  if (metrics.customers.buyers === 0) {
    gaps.push({ severity: 'high', label: 'لا توجد مبيعات بعد', detail: 'مفيش عميل واحد اشترى لسه — تقدير "قيمة قاعدة العملاء" مبني على الحسابات المسجَّلة فقط، مش المشترين الفعليين.' });
  }
  if (metrics.sales.byMonth.length < 3) {
    gaps.push({ severity: 'medium', label: 'لا يوجد تاريخ مبيعات كافٍ', detail: `عدد الشهور التي بها مبيعات: ${metrics.sales.byMonth.length}. يحتاج 12+ شهر لرسم اتجاه نمو موثوق.` });
  }
  if (metrics.customers.repeatBuyers === 0 && metrics.customers.buyers > 0) {
    gaps.push({ severity: 'medium', label: 'معدل تكرار الشراء = 0%', detail: 'مفيش عميل واحد اشترى مرتين. ده يحدّ من قيمة الـ LTV ويزوّد المخاطرة لأي مستثمر.' });
  }
  gaps.push({ severity: 'medium', label: 'المرتجعات غير منفصلة', detail: `الإلغاءات الحالية: ${metrics.sales.cancelledOrders} طلب بقيمة ${fmt(metrics.sales.cancelledRevenue)} ج.م. لكن لا يوجد جدول منفصل للمرتجعات بعد التسليم (RMA).` });
  gaps.push({ severity: 'low', label: 'مؤشرات البراند غير موثَّقة', detail: 'متابعون السوشيال، NPS، انطباع البراند — كل دي مش متخزَّنة في النظام، فالقيمة الرقمية للبراند تقديرية.' });
  gaps.push({ severity: 'low', label: 'شبكة التوزيع', detail: 'لا يوجد تتبّع لشركاء التوزيع أو المنافذ الفعلية في النظام.' });
  gaps.push({ severity: 'low', label: 'الالتزامات المالية', detail: 'الديون والقروض والمستحقات غير مدخلة. التقييم الحالي يفترض صفر التزامات.' });

  const tone = (s: 'high' | 'medium' | 'low') =>
    s === 'high' ? { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' }
    : s === 'medium' ? { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' }
    : { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', dot: 'bg-gray-400' };

  return (
    <Section icon="⚠️" title="الفجوات المطلوبة قبل اعتماد التقييم" subtitle="ما الذي ينقص النظام لتصبح الأرقام قابلة للاعتماد عليها في تفاوض جاد">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {gaps.map((g, i) => {
          const t = tone(g.severity);
          return (
            <div key={i} className={`${t.bg} ${t.border} border rounded-2xl p-4`}>
              <div className="flex items-start gap-2">
                <span className={`${t.dot} w-2 h-2 rounded-full mt-1.5 shrink-0`} />
                <div className="flex-1">
                  <p className={`text-sm font-black ${t.text}`}>{g.label}</p>
                  <p className="text-xs text-gray-700 mt-1 leading-relaxed">{g.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function MethodologySection({ assumptions, defaults, canEdit, editing, onEditToggle, onSave }: {
  assumptions: Assumptions;
  defaults: Assumptions;
  canEdit: boolean;
  editing: boolean;
  onEditToggle: () => void;
  onSave: (next: Assumptions) => void;
}) {
  return (
    <Section icon="📐" title="منهجية التقييم" subtitle="الافتراضات اللي تُغذي الأرقام الرئيسية — تقدر تعدّلها لو في بيانات أحدث">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-gray-700 leading-relaxed flex-1 min-w-[260px]">
            <strong>القيمة الأساسية</strong> = تكلفة المخزون + قيمة الملكية الفكرية + قيمة المنصة التقنية + قيمة قاعدة العملاء + قيمة تجار الجملة + قيمة علاقات الموردين − ديون الموردين.
            القيمة المتوازنة = القيمة الأساسية × <strong>{assumptions.fairMultiplier}</strong>.
            القيمة الاستراتيجية = القيمة الأساسية × <strong>{assumptions.strategicMultiplier}</strong>.
          </p>
          {canEdit && !editing && (
            <button onClick={onEditToggle} className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] text-white text-xs font-bold hover:bg-[#2d1060] transition print:hidden">✏️ تعديل الافتراضات</button>
          )}
        </div>

        {editing
          ? <AssumptionsForm initial={assumptions} defaults={defaults} onSave={onSave} onCancel={onEditToggle} />
          : <AssumptionsTable assumptions={assumptions} defaults={defaults} />}
      </div>
    </Section>
  );
}

// Each assumption is footnoted with its BASIS — the source category
// behind the number. A real M&A reviewer wants to know "where did this
// come from?" before they trust it. Three categories:
//   - heuristic: pure judgement, owner's estimate. Lowest defensibility.
//   - industry: anchored in a published industry norm or benchmark range.
//   - data: derived from actual figures inside the system.
type AssumptionBasis = 'heuristic' | 'industry' | 'data';

const BASIS_META: Record<AssumptionBasis, { label: string; tone: string; tooltip: string }> = {
  heuristic: { label: 'تقدير', tone: 'bg-red-100 text-red-700', tooltip: 'حكم شخصي بدون مرجع رقمي. يحتاج مراجعة احترافية في كل صفقة.' },
  industry:  { label: 'مرجعية صناعية', tone: 'bg-amber-100 text-amber-700', tooltip: 'مأخوذ من نطاق متعارف عليه في الصناعة. أكثر دفاعية من التقدير، لكن لا يزال يتطلب تخصيص.' },
  data:      { label: 'مبني على بيانات', tone: 'bg-emerald-100 text-emerald-700', tooltip: 'مشتق من أرقام فعلية في النظام (مبيعات، تكاليف، طلبات).' },
};

function AssumptionsTable({ assumptions, defaults }: { assumptions: Assumptions; defaults: Assumptions }) {
  const rows: Array<{ key: keyof Assumptions; label: string; format: (n: number) => string; explain: string; basis: AssumptionBasis; footnote: string }> = [
    { key: 'cogsRatio', label: 'نسبة تكلفة المخزون من سعر البيع', format: n => pct(n), basis: 'industry',
      explain: 'المنتجات بتكلَّف الشركة هذه النسبة من سعرها قبل الربح.',
      footnote: 'هامش بيع التجزئة العادي 50–70%، فالـ COGS بين 30–50%. الافتراضي 35% يقابل هامش 65% (متوازن لكتب أطفال + ألعاب تعليمية).' },
    { key: 'ipBookValue', label: 'قيمة كل كتاب مؤلَّف (IP)', format: n => `${fmt(n)} ج.م`, basis: 'heuristic',
      explain: 'تقدير لقيمة حقوق نشر/ترجمة/audiobook لكل كتاب.',
      footnote: 'تقدير شخصي. الأنسب احترافياً: استخدام relief-from-royalty (3–5% من إيرادات الكتاب التراكمية) — يحتاج تطوير لاحق.' },
    { key: 'ipProductValue', label: 'قيمة كل منتج إبداعي (IP)', format: n => `${fmt(n)} ج.م`, basis: 'heuristic',
      explain: 'تقدير لقيمة التصميم/البراند الخاص بكل منتج.',
      footnote: 'تقدير موحَّد لكل المنتجات — لا يميز بين البِست-سيلر والمنتج الراكد. حد أدنى للمناقشة، ليس رقماً نهائياً.' },
    { key: 'ipDigitalValue', label: 'قيمة المحتوى الرقمي', format: n => `${fmt(n)} ج.م`, basis: 'heuristic',
      explain: 'يوتيوب + PDFs + قيمة البراند ككل.',
      footnote: 'رقم ثابت — لا يعكس عدد المشتركين أو معدل التفاعل. للتحسين: ربطه بعدد المتابعين × LTV لكل متابع.' },
    { key: 'techValue', label: 'قيمة المنصة التقنية', format: n => `${fmt(n)} ج.م`, basis: 'heuristic',
      explain: 'تكلفة بناء النظام لو حد محتاج يبنيه من الصفر.',
      footnote: 'تقدير cost-to-rebuild. للتدقيق: عرض سعر فعلي من شركة تطوير، أو تكلفة مهندس × أشهر العمل.' },
    { key: 'customerDbValue', label: 'قيمة كل مشترٍ فعلي', format: n => `${fmt(n)} ج.م`, basis: 'heuristic',
      explain: 'قيمة العميل الواحد في القاعدة كأصل تسويقي.',
      footnote: 'موحَّد لكل العملاء — لا يميز عميل اشترى مرة عن عميل متكرر. الأنسب: AOV × معدل التكرار × عامل خصم. اللي عنده طلبين+ يساوي 5–10× اللي عنده طلب واحد.' },
    { key: 'wholesaleCustomerValue', label: 'قيمة كل تاجر جملة', format: n => `${fmt(n)} ج.م`, basis: 'heuristic',
      explain: 'علاقة بيع متكرر بكميات كبيرة.',
      footnote: 'يجب مقارنته بإيرادات تاجر الجملة الفعلية × عدد سنوات الاستمرار المتوقعة. للنشاط الحالي: الافتراضي 5,000 يعكس 1–2 طلب جملة سنوي.' },
    { key: 'supplierRelationshipValue', label: 'قيمة كل علاقة مع مورد', format: n => `${fmt(n)} ج.م`, basis: 'heuristic',
      explain: 'تكلفة العثور على مورد بديل وموثوقيته.',
      footnote: 'لا يعكس حجم تعامل المورد. مورد بـ 60% من الإنتاج له قيمة مختلفة جداً عن مورد بـ 5%.' },
    { key: 'revenueMultipleLow', label: 'مضاعف الإيرادات — الحد الأدنى', format: n => `× ${n}`, basis: 'industry',
      explain: 'مضاعف TTM للحد الأدنى لقيمة السوق.',
      footnote: 'التجارة الإلكترونية المصرية الصغيرة تتراوح 1.5–3.0×. الحد الأدنى للشركات الناضجة بدون نمو واضح أو دفاعية IP.' },
    { key: 'revenueMultipleHigh', label: 'مضاعف الإيرادات — الحد الأعلى', format: n => `× ${n}`, basis: 'industry',
      explain: 'مضاعف TTM للحد الأعلى لقيمة السوق.',
      footnote: 'للشركات عالية الهامش (>40%)، سريعة النمو (>30% سنوياً)، أو ذات IP محمي. الحد الأعلى ربما 4× في حالات استثنائية.' },
    { key: 'fairMultiplier', label: 'مضاعف القيمة المتوازنة', format: n => `× ${n}`, basis: 'heuristic',
      explain: 'القيمة الأساسية تُضرَب في هذا الرقم.',
      footnote: 'احترافياً، تطبيق مضاعف على الأصول غير قياسي. الاحترافي: استخدام مضاعفات الإيرادات أو الأرباح بدلاً من الأصول.' },
    { key: 'strategicMultiplier', label: 'مضاعف القيمة الاستراتيجية', format: n => `× ${n}`, basis: 'heuristic',
      explain: 'لمشتري بحاجة استراتيجية فعلية.',
      footnote: 'يفترض وجود مشتري استراتيجي ينتفع بالعلامة أو القناة. القيمة الفعلية تظهر فقط عند وجود مشتري حقيقي يعرض السعر.' },
    { key: 'activeWindowDays', label: 'نافذة العميل النشط (أيام)', format: n => `${n} يوم`, basis: 'industry',
      explain: 'عميل بطلب صحيح خلال النافذة يُحتسب نشطًا.',
      footnote: 'الصناعة بتستخدم 90 يوم لـ B2C عام، 180 يوم لـ B2B. التعديل يؤثر على نسبة "العملاء النشطين" المعروضة.' },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr className="text-gray-500">
            <th className="px-3 py-2 text-right font-bold">الافتراض</th>
            <th className="px-3 py-2 text-right font-bold">القيمة الحالية</th>
            <th className="px-3 py-2 text-right font-bold">الافتراضي</th>
            <th className="px-3 py-2 text-right font-bold">المرجعية</th>
            <th className="px-3 py-2 text-right font-bold">شرح وحاشية</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => {
            const cur = assumptions[r.key];
            const def = defaults[r.key];
            const drift = cur !== def;
            const meta = BASIS_META[r.basis];
            return (
              <tr key={r.key}>
                <td className="px-3 py-2.5 font-bold text-gray-800">{r.label}</td>
                <td className={`px-3 py-2.5 font-black ${drift ? 'text-amber-700' : 'text-gray-900'}`}>{r.format(cur)} {drift && <span className="text-[9px] font-bold ml-1">⚙️ معدَّل</span>}</td>
                <td className="px-3 py-2.5 text-gray-500">{r.format(def)}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${meta.tone}`} title={meta.tooltip}>{meta.label}</span>
                </td>
                <td className="px-3 py-2.5 text-gray-700 leading-relaxed max-w-md">
                  <p className="text-gray-800">{r.explain}</p>
                  <p className="text-[10px] text-gray-500 mt-1 italic">{r.footnote}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-3 text-[10px] text-gray-700 leading-relaxed">
        <p className="font-bold text-gray-900 mb-1">ملاحظة على الافتراضات:</p>
        <p>
          الافتراضات المُصنَّفة <span className="bg-red-100 text-red-700 px-1 rounded font-bold">تقدير</span> تحتاج عناية واجبة في كل صفقة فعلية —
          لا تعتمد عليها كرقم نهائي. الأرقام <span className="bg-amber-100 text-amber-700 px-1 rounded font-bold">مرجعية صناعية</span> أكثر دفاعية لكنها لا تزال
          نطاقات يجب تكييفها حسب خصوصية الشركة. الهدف من التقرير عرض الأرقام بصراحة، مش إخفاء عدم اليقين.
        </p>
      </div>
    </div>
  );
}

// Defined at module scope so it isn't remounted on every keystroke (which
// caused the input to lose focus mid-type when nested inside the form body).
function AssumptionsField({
  k, label, value, defaultValue, step = 1, min = 0, max, onChange,
}: {
  k: keyof Assumptions; label: string; value: number; defaultValue: number;
  step?: number; min?: number; max?: number; onChange: (k: keyof Assumptions, v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 font-bold mb-1">{label} <span className="text-gray-400">(افتراضي: {defaultValue})</span></label>
      <input
        type="number" step={step} min={min} max={max} value={value}
        onChange={e => onChange(k, Number(e.target.value))}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
      />
    </div>
  );
}

function AssumptionsForm({ initial, defaults, onSave, onCancel }: { initial: Assumptions; defaults: Assumptions; onSave: (next: Assumptions) => void; onCancel: () => void }) {
  const [v, setV] = useState<Assumptions>(initial);
  const set = (k: keyof Assumptions, val: number) => setV(prev => ({ ...prev, [k]: val }));
  return (
    <div className="space-y-4 print:hidden">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <AssumptionsField k="cogsRatio" label="نسبة COGS (0–1)" step={0.01} max={1} value={v.cogsRatio} defaultValue={defaults.cogsRatio} onChange={set} />
        <AssumptionsField k="revenueMultipleLow" label="مضاعف الإيرادات (أدنى)" step={0.1} min={0} value={v.revenueMultipleLow} defaultValue={defaults.revenueMultipleLow} onChange={set} />
        <AssumptionsField k="revenueMultipleHigh" label="مضاعف الإيرادات (أعلى)" step={0.1} min={0} value={v.revenueMultipleHigh} defaultValue={defaults.revenueMultipleHigh} onChange={set} />
        <AssumptionsField k="fairMultiplier" label="مضاعف عادل" step={0.05} min={1} value={v.fairMultiplier} defaultValue={defaults.fairMultiplier} onChange={set} />
        <AssumptionsField k="strategicMultiplier" label="مضاعف استراتيجي" step={0.05} min={1} value={v.strategicMultiplier} defaultValue={defaults.strategicMultiplier} onChange={set} />
        <AssumptionsField k="ipBookValue" label="قيمة كل كتاب (ج.م)" step={1000} value={v.ipBookValue} defaultValue={defaults.ipBookValue} onChange={set} />
        <AssumptionsField k="ipProductValue" label="قيمة كل منتج (ج.م)" step={1000} value={v.ipProductValue} defaultValue={defaults.ipProductValue} onChange={set} />
        <AssumptionsField k="ipDigitalValue" label="قيمة المحتوى الرقمي (ج.م)" step={10000} value={v.ipDigitalValue} defaultValue={defaults.ipDigitalValue} onChange={set} />
        <AssumptionsField k="techValue" label="قيمة المنصة (ج.م)" step={10000} value={v.techValue} defaultValue={defaults.techValue} onChange={set} />
        <AssumptionsField k="customerDbValue" label="قيمة كل مشترٍ فعلي (ج.م)" step={10} value={v.customerDbValue} defaultValue={defaults.customerDbValue} onChange={set} />
        <AssumptionsField k="receivablesProvisionRate" label="احتياطي ديون مشكوك في تحصيلها (0–1)" step={0.05} value={v.receivablesProvisionRate ?? 0.10} defaultValue={defaults.receivablesProvisionRate} onChange={set} />
        <AssumptionsField k="wholesaleCustomerValue" label="قيمة كل تاجر جملة (ج.م)" step={500} value={v.wholesaleCustomerValue} defaultValue={defaults.wholesaleCustomerValue} onChange={set} />
        <AssumptionsField k="supplierRelationshipValue" label="قيمة كل مورد نشط (ج.م)" step={500} value={v.supplierRelationshipValue} defaultValue={defaults.supplierRelationshipValue} onChange={set} />
        <AssumptionsField k="activeWindowDays" label="نافذة النشاط (يوم)" step={1} min={1} value={v.activeWindowDays} defaultValue={defaults.activeWindowDays} onChange={set} />
      </div>
      <div className="flex gap-2 justify-end flex-wrap">
        <button
          onClick={() => { if (confirm('استرجاع كل القيم لافتراضات النظام؟ يلزم الضغط على حفظ بعدها.')) setV(defaults); }}
          className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200"
          title="يرجع كل الحقول لقيمها الافتراضية. لازم اضغط حفظ بعدها."
        >🔄 استرجاع الافتراضيات</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold">إلغاء</button>
        <button onClick={() => onSave(v)} className="px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-bold">💾 حفظ الافتراضات</button>
      </div>
    </div>
  );
}

// ==========================================================================
// Detailed (default) view
// ==========================================================================

function DetailedView({ data, products, books }: { data: ValuationData; products: ValuationData['products']; books: ValuationData['books'] }) {
  const { metrics, assumptions } = data;
  return (
    <>
      {/* Sales */}
      <Section icon="💰" title="المبيعات والإيرادات" subtitle="من جدول Order — استبعاد الملغية والهدايا">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إجمالي الإيرادات" value={`${fmt(metrics.sales.totalRevenue)} ج.م`} hint="مجموع Order.total لكل الطلبات غير الملغية وغير الهدايا. شامل الشحن وقبل خصم تكلفة المنتج." />
          <KPI label="إيراد بدون الشحن" value={`${fmt(metrics.sales.revenueExShipping)} ج.م`} hint="الإيراد بعد طرح إجمالي تكلفة الشحن — أصدق مؤشر لقيمة المنتج للعميل." />
          <KPI label="عدد الطلبات الصحيحة" value={fmt(metrics.sales.validOrders)} sub={`+ ${metrics.sales.cancelledOrders} ملغي`} hint="طلبات بحالة غير 'cancelled' و طريقة دفع غير 'gift'. الملغي معروض جنبه للعلم." />
          <KPI label="إجمالي القطع المباعة (شامل الاستيراد)" value={fmt(metrics.sales.unitsSold)} hint="مجموع OrderItem.quantity من الطلبات الصحيحة، شامل الطلبات اللي اتستوردت من واتساب وبوسطة (طلبات تاريخية اتشحنت قبل وجود النظام)." />
          <KPI label="منها بالنظام (Live)" value={fmt(metrics.sales.unitsSoldLive)} hint="القطع اللي اتباعت من خلال النظام مباشرة (Checkout / PayPal / إدخال أدمن). الفرق بين الرقمين = قطع تاريخية لم تخصم من المخزون الحالي." />
          <KPI label="متوسط الطلب (شامل الشحن)" value={`${fmt(metrics.sales.avgOrderValue)} ج.م`} hint="إجمالي الإيرادات ÷ عدد الطلبات الصحيحة. شامل الشحن — مش متوسط قيمة المنتج لوحده." />
          <KPI label="متوسط الطلب (بدون شحن)" value={`${fmt(metrics.sales.avgOrderValueExShipping)} ج.م`} hint="إيراد بدون الشحن ÷ عدد الطلبات. أنسب لتقدير AOV الحقيقي." />
          <KPI label="إجمالي الشحن" value={`${fmt(metrics.sales.totalShipping)} ج.م`} hint="مجموع shippingCost. تُعتبَر تكلفة عملية وليست إيرادًا." />
          <KPI label="إجمالي الخصومات" value={`${fmt(metrics.sales.totalDiscount)} ج.م`} hint="مجموع discount المطبَّق على الطلبات الصحيحة." />
        </div>

        {metrics.sales.cancelledOrders > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-4">
            <p className="text-xs font-black text-red-800">🚫 الطلبات الملغية</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <KPI label="عدد الإلغاءات" value={fmt(metrics.sales.cancelledOrders)} hint="Order.status = 'cancelled'." />
              <KPI label="قيمة الإلغاءات" value={`${fmt(metrics.sales.cancelledRevenue)} ج.م`} hint="مجموع total للطلبات الملغية. مفيش جدول منفصل للمرتجعات بعد التسليم." />
            </div>
          </div>
        )}

        {metrics.gifts && metrics.gifts.count > 0 && (
          <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mt-4">
            <p className="text-xs font-black text-pink-800 mb-2">🎁 الهدايا (لا تُحتسب ضمن الإيرادات)</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPI label="عدد الهدايا" value={fmt(metrics.gifts.count)} hint="Order.paymentMethod = 'gift'." />
              <KPI label="قطع مُهداة" value={fmt(metrics.gifts.units)} hint="مجموع OrderItem.quantity للهدايا." />
              <KPI label="قيمة المنتجات (سعر بيع)" value={`${fmt(metrics.gifts.retailValue)} ج.م`} hint="بسعر البيع وليس التكلفة — تقدير لقيمة الفرصة الضائعة." />
              <KPI label="إجمالي تكلفة الهدايا" value={`${fmt(metrics.gifts.totalCost)} ج.م`} sub="منتجات + شحن" hint="قيمة المنتجات بالسعر + إجمالي شحن الهدايا." />
            </div>
          </div>
        )}

        {metrics.sales.byMonth.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-gray-200 mt-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-xs font-bold text-gray-700">إيرادات آخر 12 شهر</p>
              {metrics.sales.momRevenueGrowth !== null && (
                <span className={`text-[11px] font-black px-2 py-1 rounded-lg ${metrics.sales.momRevenueGrowth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {metrics.sales.momRevenueGrowth >= 0 ? '↗' : '↘'} نمو شهري: {pct(metrics.sales.momRevenueGrowth)}
                </span>
              )}
            </div>
            <YearlyChart data={metrics.sales.byMonth.map(m => ({ key: m.ym, revenue: m.revenue, count: m.count }))} />
          </div>
        )}

        {metrics.sales.byYear.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-gray-200 mt-4">
            <p className="text-xs font-bold text-gray-700 mb-3">الإيرادات السنوية</p>
            <YearlyChart data={metrics.sales.byYear.map(y => ({ key: String(y.year), revenue: y.revenue, count: y.count }))} />
          </div>
        )}
      </Section>

      {/* Customers */}
      <Section icon="👥" title="العملاء" subtitle="فصل المسجَّلين عن المشترين الفعليين">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="مسجَّلين (إجمالي)" value={fmt(metrics.customers.total)} hint="User.role = 'customer'. شامل اللي ما اشتروش." />
          <KPI label="مشترين (≥ طلب واحد)" value={fmt(metrics.customers.buyers)} hint="عملاء عملوا طلب صحيح واحد على الأقل في تاريخ النظام." />
          <KPI label="نشطين" value={fmt(metrics.customers.active)} sub={`آخر ${metrics.customers.activeWindowDays} يوم — ${pct(metrics.customers.activeRatio)} من المسجَّلين`} hint="عمل طلب صحيح خلال نافذة النشاط الحالية." />
          <KPI label="مشترين متكررين" value={fmt(metrics.customers.repeatBuyers)} sub={`${pct(metrics.customers.repeatRate)} من المشترين`} hint="عملوا طلبين أو أكثر في حياتهم. مؤشر قوي للولاء." />
          <KPI label="متوسط الإيراد لكل مشتري" value={`${fmt(metrics.customers.avgRevenuePerBuyer)} ج.م`} hint="إجمالي الإيرادات ÷ عدد المشترين الفعليين. تقدير LTV التاريخي." />
          <KPI
            label="تجار جملة"
            value={fmt(metrics.customers.wholesale)}
            sub={`قيمتهم في التقييم: ${fmt(metrics.wholesale.value)} ج.م`}
            hint={`كل تاجر جملة بـ ${fmt(metrics.wholesale.perCustomer)} ج.م. الرقم قابل للتعديل من الافتراضات.`}
          />
        </div>
      </Section>

      {/* Inventory */}
      <Section icon="📦" title="المخزون" subtitle="القيم بسعر البيع، التكلفة من باتشات الإنتاج (مع fallback تقديري)">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إجمالي القطع في المخزن" value={fmt(metrics.products.inventoryUnits)} hint="مجموع Product.stock عبر كل المنتجات." />
          <KPI label="قيمة المخزون (سعر بيع)" value={`${fmt(metrics.products.inventoryValueRetail)} ج.م`} hint="مجموع stock × price. سعر البيع، مش التكلفة." />
          <KPI label="التكلفة الفعلية (من الباتشات)" value={`${fmt(metrics.products.inventoryValueCostFromBatches)} ج.م`} sub={`${metrics.products.productsWithBatches} منتج له باتشات + ${metrics.products.productsWithoutBatches} بدون`} hint="متوسط مرجح من ProductionBatch لكل منتج. المنتجات اللي مفيش لها باتشات بتاخد التكلفة التقديرية بدلاً منها." />
          <KPI label="التكلفة التقديرية (للمقارنة)" value={`${fmt(metrics.products.inventoryValueCostHeuristic)} ج.م`} sub={`${pct(assumptions.cogsRatio)} من سعر البيع`} hint="رقم مرجعي للمقارنة فقط — هذا ما كان يستخدمه التقييم قبل وجود الباتشات." />
          <KPI label="منتجات نفذت" value={String(metrics.products.outOfStockCount)} tone={metrics.products.outOfStockCount > 0 ? 'bad' : 'ok'} hint="منتجات بـ Product.stock ≤ 0. تقدر تجمَّعها من تبويب المخزون." />
        </div>
        {metrics.products.productsOpeningBalanceSeeded > 0 && (
          <p className="text-[11px] text-emerald-700 mt-2">🌱 {metrics.products.productsOpeningBalanceSeeded} منتج تم تسعيره افتتاحياً (مخزون قديم اتسجل بتكلفته الفعلية).</p>
        )}
      </Section>

      {/* Production batches */}
      {metrics.production && (
        <Section icon="🏭" title="الإنتاج" subtitle="باتشات تنفيذ المنتجات — التكلفة الفعلية وقت الإنتاج">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KPI label="عدد الباتشات" value={fmt(metrics.production.batchesCount)} hint="إجمالي صفوف ProductionBatch." />
            <KPI label="إجمالي القطع المنتَجة" value={fmt(metrics.production.unitsProduced)} hint="مجموع quantity من كل الباتشات. يدخل في حساب متوسط التكلفة." />
            <KPI label="إجمالي تكلفة الإنتاج" value={`${fmt(metrics.production.totalSpend)} ج.م`} hint="مجموع totalCost من كل الباتشات. لا يحسم منه ما اتسدد للموردين." />
          </div>
        </Section>
      )}

      {/* Suppliers */}
      {metrics.suppliers && (
        <Section icon="🤝" title="الموردون" subtitle="الذمم الجارية — يُحسم ما نحن مدينون به من القيمة الأساسية">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI label="موردون نشطون" value={`${fmt(metrics.suppliers.active)} / ${fmt(metrics.suppliers.total)}`} hint="Supplier.isActive = true." />
            <KPI label="عدد المعاملات" value={fmt(metrics.suppliers.transactionCount)} hint="فواتير + دفعات + مرتجعات. Supplier transactions table." />
            <KPI
              label="قيمة العلاقات في التقييم"
              value={`${fmt(metrics.supplierRelationships.value)} ج.م`}
              tone="ok"
              sub={`${fmt(metrics.supplierRelationships.count)} مورد × ${fmt(metrics.supplierRelationships.perSupplier)} ج.م`}
              hint="العلاقات الموثَّقة مع موردين موثوقين تُضاف للقيمة الأساسية للشركة. الرقم قابل للتعديل من الافتراضات."
            />
            <KPI
              label={metrics.suppliers.netLiabilities >= 0 ? 'نحن مدينون' : 'هم مدينون لنا'}
              value={`${fmt(Math.abs(metrics.suppliers.netLiabilities))} ج.م`}
              tone={metrics.suppliers.netLiabilities > 0 ? 'bad' : 'ok'}
              hint="الرصيد الصافي عبر كل الموردين. الذمم الموجبة (نحن مدينون) تُحسم من القيمة الأساسية للشركة."
            />
          </div>
        </Section>
      )}

      {/* Customer receivables (AR) — wholesale dealers + retail credit. */}
      {metrics.customerReceivables.value > 0 && (
        <Section icon="📒" title="الذمم المدينة (مستحق التحصيل)" subtitle="فلوس مستحقة لنا من تجار الجملة وحالات بيع آجل، مخصوماً منها احتياطي الديون المشكوك في تحصيلها">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <FinKPI
              label="إجمالي الذمم (قبل الاحتياطي)"
              value={`${fmt(metrics.customerReceivables.value)} ج.م`}
              tone="good"
              hint="مجموع الأرصدة الموجبة عبر كل العملاء. الرقم الإجمالي قبل خصم احتياطي الديون المشكوك في تحصيلها."
            />
            <FinKPI
              label={`احتياطي ديون مشكوك فيها (${pct(metrics.customerReceivables.provisionRate)})`}
              value={`(${fmt(metrics.customerReceivables.provision)}) ج.م`}
              tone="bad"
              hint="نسبة الاحتياطي قابلة للتعديل من قسم الافتراضيات. ممارسة محاسبية شائعة في SMEs المصرية: 10–20% للذمم العادية، أعلى لو فيه أعمار متقادمة."
            />
            <FinKPI
              label="الصافي (يدخل القيمة الأساسية)"
              value={`${fmt(metrics.customerReceivables.netValue)} ج.م`}
              tone="good"
              hint="الإجمالي بعد خصم الاحتياطي — هذا ما يُضاف فعلياً لـ baseValue. المراجعة من صفحة كل عميل في /admin/customers."
            />
          </div>
        </Section>
      )}

      {/* Royalty / IP accruals — owed to rights-holders, subtract from baseValue. */}
      {metrics.royalties.agreementsActive > 0 && (
        <Section icon="📚" title="حقوق الملكية الفكرية المستحقة" subtitle="مستحقات مؤلفين وأصحاب حقوق على نسبة من الربح — تُحسم من القيمة الأساسية">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KPI
              label="اتفاقيات نشطة"
              value={fmt(metrics.royalties.agreementsActive)}
              hint="عدد اتفاقيات الملكية الفكرية النشطة في /admin/ip."
            />
            <KPI
              label="إجمالي مستحق الدفع"
              value={`${fmt(metrics.royalties.totalAccrued)} ج.م`}
              tone="bad"
              hint="مجموع نسب الأرباح المستحقة على آخر 12 شهر. تُحسم من القيمة الأساسية للشركة كالتزام قائم."
            />
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed col-span-2 lg:col-span-1">
              💡 يدخل كالتزام في <strong>baseValue</strong>. يقل تلقائياً بعد تسجيل دفعة في{' '}
              <a href="/admin/ip" className="text-blue-700 hover:underline">/admin/ip</a>.
            </div>
          </div>
          {metrics.royalties.topAccruals.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-3">
              <table className="w-full text-xs">
                <thead className="bg-amber-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-amber-900">المستحق</th>
                    <th className="px-3 py-2 text-right text-amber-900">المبلغ المستحق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {metrics.royalties.topAccruals.map((t, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-bold text-gray-800">{t.payeeName}</td>
                      <td className="px-3 py-2 font-black text-amber-700">{fmt(t.amountAccrued)} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* Partners / equity cap-table — share of reconciledMid. */}
      {metrics.partners.activeCount > 0 && (
        <Section icon="🤝" title="الشركاء والمستثمرون (Cap Table)" subtitle="حصة كل شريك من القيمة المعتمدة (الوسط الموفَّق)">
          {metrics.partners.isOverCommitted && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl px-4 py-2.5 text-[11px] text-red-900 mb-3">
              ⚠️ مجموع نسب الشركاء النشطين تجاوز 100%. راجع البيانات في{' '}
              <a href="/admin/partners" className="text-blue-700 hover:underline">/admin/partners</a>.
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <KPI label="عدد الشركاء" value={fmt(metrics.partners.activeCount)} sub={`من إجمالي ${fmt(metrics.partners.totalCount)}`} />
            <KPI label="مجموع الحصص" value={`${metrics.partners.totalStakePercentage.toFixed(2)}%`} tone={metrics.partners.isOverCommitted ? 'bad' : 'ok'} />
            <KPI label="حصة الشركة" value={`${metrics.partners.remainingCompanyShare.toFixed(2)}%`} sub="غير موزَّعة" />
            <KPI label="رأس المال المساهم" value={`${fmt(metrics.partners.totalCapitalContribution)} ج.م`} hint="إجمالي ما تم ضخه نقداً من الشركاء (إعلامي فقط — لا يُضاف للقيمة لأنه مُجسَّد بالفعل في الأصول)." />
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-3 py-2 text-right text-emerald-900">الشريك</th>
                  <th className="px-3 py-2 text-right text-emerald-900">النسبة</th>
                  <th className="px-3 py-2 text-right text-emerald-900">
                    {metrics.partners.isOverCommitted ? 'حصته من القيمة' : 'حصته من القيمة (الوسط)'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.partners.rows.map(r => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-bold text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 font-black text-gray-900">{r.stakePercentage}%</td>
                    {/* When the cap-table is over-committed (Σ stake > 100%)
                        the per-partner share figure is mathematically
                        inconsistent — the sum would exceed the company's
                        total value. Hide the column rather than show a
                        misleading number an over-promised stakeholder
                        could screenshot. */}
                    <td className="px-3 py-2 font-black text-emerald-700">
                      {metrics.partners.isOverCommitted ? '— يلزم تصحيح الحصص أولاً —' : `${fmt(r.shareValue)} ج.م`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* IP */}
      <Section icon="📚" title="الملكية الفكرية" subtitle="قيمة تقديرية مبنية على العدد، مش على المبيعات الفعلية">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <IPCard icon="📖" label="الكتب المؤلَّفة" value={metrics.ip.booksValue} count={metrics.ip.booksCount} per={metrics.ip.perBook} />
          <IPCard icon="🎮" label="المنتجات الإبداعية" value={metrics.ip.productsValue} count={metrics.ip.productsCount} per={metrics.ip.perProduct} />
          <IPCard icon="🎬" label="المحتوى الرقمي" value={metrics.ip.digitalValue} count={null} per={null} />
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-[#F5C518] rounded-2xl p-5 mt-4">
          <p className="text-xs text-amber-900 font-bold flex items-center gap-2">
            إجمالي قيمة الملكية الفكرية
            <Tooltip text="الرقم ده قيمة افتراضية بناءً على العدد والمعدَّلات في قسم المنهجية. مش مرتبط بمبيعات الكتاب أو المنتج الفعلية. لازم يتراجع لما تكون فيه بيانات مبيعات حقيقية." />
          </p>
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
                  <th className="px-3 py-3 text-right" title="إجمالي ما اتباع — شامل الاستيراد التاريخي">قطع مباعة (إجمالي)</th>
                  <th className="px-3 py-3 text-right" title="من خلال النظام فقط — اللي خصمت من المخزون الحالي">منها بالنظام</th>
                  <th className="px-3 py-3 text-right">المخزون</th>
                  <th className="px-3 py-3 text-right">قيمة المخزون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(p => (
                  <tr key={p.id} className={p.stock <= 0 ? 'bg-red-50/40' : p.stock <= 50 ? 'bg-amber-50/40' : ''}>
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                        {p.name}
                        {p.sold > 0 && p.productionBatchUnits === 0 && (
                          <a
                            href={`/admin/production/seed-stock`}
                            className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black hover:bg-red-200 transition print:hidden"
                            title="هذا المنتج اتباع منه بدون أي باتش إنتاج — يحتاج تسعير افتتاحي"
                          >🟥 محتاج تسعير</a>
                        )}
                      </p>
                      {p.nameEn && <p className="text-[10px] text-gray-400">{p.nameEn}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{p.category}</td>
                    <td className="px-3 py-2.5 font-bold">{fmt(p.price)}</td>
                    <td className="px-3 py-2.5 text-gray-500">${p.priceUsd}</td>
                    <td className="px-3 py-2.5 font-bold text-blue-700">{p.sold}</td>
                    <td className={`px-3 py-2.5 font-bold ${p.sold !== p.soldLive ? 'text-amber-700' : 'text-blue-700'}`}>{p.soldLive}</td>
                    <td className="px-3 py-2.5 font-bold">{p.stock}</td>
                    <td className="px-3 py-2.5 font-black text-[#6B21A8]">{fmt(p.stockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

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
    </>
  );
}

// ==========================================================================
// Investor view — concise narrative
// ==========================================================================

function InvestorView({ data }: { data: ValuationData }) {
  const { metrics, valuation } = data;
  const range = { low: valuation.base, high: valuation.fair };
  return (
    <div className="space-y-6">
      <Section icon="🏢" title="نبذة عن الشركة" breakBefore>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-sm leading-relaxed text-gray-700">
          <p>مسلم ليدر — منصة عربية لبيع الكتب والمنتجات الإبداعية المؤلَّفة، مع مكتبة رقمية ومحتوى متعدد القنوات. النظام يُدير الكتالوج، الطلبات، الشحن، التسويق، والمحاسبة الداخلية تحت سقف واحد.</p>
        </div>
      </Section>

      <Section icon="📈" title="مؤشرات الأداء الرئيسية">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إيرادات تاريخية" value={`${fmt(metrics.sales.totalRevenue)} ج.م`} hint="إجمالي Order.total باستثناء الإلغاءات والهدايا." />
          <KPI label="عدد الطلبات الصحيحة" value={fmt(metrics.sales.validOrders)} />
          <KPI label="مشترين فعليين" value={fmt(metrics.customers.buyers)} sub={`${pct(metrics.customers.activeRatio)} نشطين`} />
          <KPI label="معدل تكرار الشراء" value={pct(metrics.customers.repeatRate)} hint="نسبة المشترين اللي عملوا طلبين أو أكثر." />
        </div>
      </Section>

      <Section icon="💪" title="نقاط القوة">
        <ul className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2 text-sm text-gray-700 list-disc pr-5">
          <li>براند مؤسَّس + متابعون على السوشيال + قنوات يوتيوب نشطة.</li>
          <li>{metrics.books.total} كتاب مؤلَّف + {metrics.products.total} منتج إبداعي = ملكية فكرية ضخمة.</li>
          <li>منصة تقنية متكاملة (متجر + مكتبة + إدارة) مبنية في البيت.</li>
          <li>قاعدة عملاء {fmt(metrics.customers.total)} حساب مسجَّل قابلة لإعادة الاستهداف.</li>
        </ul>
      </Section>

      <Section icon="🚀" title="فرص النمو">
        <ul className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2 text-sm text-gray-700 list-disc pr-5">
          <li>التوسع في الأسواق العربية الخارجية (السعودية، الإمارات).</li>
          <li>تحويل الكتب لـ audiobooks وفيديوهات تعليمية مدفوعة.</li>
          <li>اشتراكات شهرية للمكتبة الرقمية.</li>
          <li>شراكات توزيع مع مكتبات تقليدية في مصر.</li>
          <li>منتجات تعليمية للأطفال والمدارس.</li>
        </ul>
      </Section>

      <Section icon="⚖️" title="المخاطر والفجوات">
        <ul className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2 text-sm text-gray-700 list-disc pr-5">
          <li>صافي الربح غير محسوب — التقييم على مستوى الإيرادات والأصول فقط.</li>
          <li>تكلفة المنتج الفعلية غير مخزَّنة، فالـ COGS تقديري.</li>
          <li>{metrics.customers.repeatBuyers === 0 ? 'مفيش بيانات تكرار شراء بعد.' : `معدل تكرار الشراء ${pct(metrics.customers.repeatRate)} — يحتاج تحسين.`}</li>
          <li>قيمة الـ IP مبنية على العدد، مش على مبيعات/طلب فعلي.</li>
          <li>مفيش تتبّع لشبكة التوزيع أو شراكات خارجية في النظام.</li>
        </ul>
      </Section>

      <Section icon="📐" title="منهجية التقييم المُقترحة">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-sm leading-relaxed text-gray-700 space-y-3">
          <p>التقييم مبني على تجميع أربعة مكوّنات: تكلفة المخزون + قيمة الملكية الفكرية + قيمة المنصة التقنية + قيمة قاعدة العملاء.</p>
          <p>الأرقام تُمثّل ثلاثة سيناريوهات: الحد الأدنى (تصفية)، المتوازنة (سوق طبيعية)، الاستراتيجية (مشتري بحاجة استراتيجية).</p>
          <p className="text-xs text-amber-700 font-bold">⚠️ القيمة الاستراتيجية مشروطة باكتمال بيانات الربحية والنمو والمخزون والملكية الفكرية، وبوجود مشتري استراتيجي فعلي. لا تُستخدم كمرجع رئيسي قبل اكتمال هذه الشروط.</p>
        </div>
      </Section>

      <Section icon="💎" title="نطاق التقييم المقترح">
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2d1060] text-white rounded-3xl p-8 text-center">
          <p className="text-xs text-[#F5C518] font-bold tracking-widest">نطاق التقييم</p>
          <p className="text-3xl sm:text-5xl font-black mt-3">
            {fmt(range.low)} <span className="text-lg text-white/60">إلى</span> {fmt(range.high)}
          </p>
          <p className="text-white/70 text-sm mt-2">جنيه مصري</p>
          <p className="text-white/50 text-xs mt-4 max-w-md mx-auto">القيمة الفعلية في النطاق ده مرتبطة بنتائج العناية الواجبة (Due Diligence) واكتمال البيانات المالية.</p>
        </div>
      </Section>
    </div>
  );
}

// ==========================================================================
// Reusable UI bits
// ==========================================================================

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white/8 backdrop-blur border border-white/15 rounded-xl p-3 relative" style={{ backgroundColor: 'rgba(255,255,255,.08)' }}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] text-white/60 font-bold tracking-widest text-right flex-1">{label}</p>
        {hint && <Tooltip text={hint} dark />}
      </div>
      <p className="text-2xl font-black text-[#F5C518] mt-1">{value}</p>
    </div>
  );
}

function ScenarioCard({ label, value, desc, tone, multiplier, condition, highlighted }: {
  label: string; value: number; desc: string;
  tone: 'base' | 'fair' | 'strategic';
  multiplier: string; condition: string; highlighted?: boolean;
}) {
  const colors = {
    base: { bg: 'bg-gray-50', border: 'border-gray-200', accent: 'text-gray-600' },
    fair: { bg: 'bg-amber-50', border: 'border-[#F5C518]', accent: 'text-amber-800' },
    strategic: { bg: 'bg-emerald-50', border: 'border-emerald-300', accent: 'text-emerald-700' },
  }[tone];
  return (
    <div className={`${colors.bg} ${highlighted ? 'border-4' : 'border-2'} ${colors.border} rounded-2xl p-5 relative`}>
      {highlighted && <span className="absolute -top-2 right-4 bg-[#F5C518] text-[#1a1a2e] text-[10px] font-black px-2 py-0.5 rounded-full">★ المرشَّحة</span>}
      <p className={`text-[10px] ${colors.accent} font-bold tracking-widest`}>{label}</p>
      <p className="text-3xl font-black mt-1">{fmt(value)} <span className="text-sm">ج.م</span></p>
      <p className="text-[10px] text-gray-500 mt-1 font-bold">{multiplier}</p>
      <p className="text-xs text-gray-700 mt-2">{desc}</p>
      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed border-t border-gray-200 pt-2">{condition}</p>
    </div>
  );
}

function Section({ icon, title, subtitle, children, breakBefore }: { icon: string; title: string; subtitle?: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <section className={`space-y-4 valuation-section ${breakBefore ? 'valuation-page-break' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[#F5C518] to-[#e6a200] rounded-xl flex items-center justify-center text-xl shrink-0">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-black text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function KPI({ label, value, sub, tone, hint }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad'; hint?: string }) {
  return (
    <div className={`bg-white border rounded-2xl p-4 relative ${tone === 'bad' ? 'border-red-300' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex-1">{label}</p>
        {hint && <Tooltip text={hint} />}
      </div>
      <p className={`text-xl font-black mt-1 ${tone === 'bad' ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function IPCard({ icon, label, value, count, per }: { icon: string; label: string; value: number; count: number | null; per: number | null }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-2xl mb-2">{icon}</p>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
      {count !== null && <p className="text-sm text-gray-600 mt-1">{count} عنصر {per !== null && <>× {fmt(per)} ج.م</>}</p>}
      <p className="text-2xl font-black text-[#1a1a2e] mt-2">{fmt(value)} <span className="text-sm">ج.م</span></p>
    </div>
  );
}

function YearlyChart({ data }: { data: Array<{ key: string; revenue: number; count: number }> }) {
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div className="space-y-2.5">
      {data.map(d => {
        const pctW = (d.revenue / max) * 100;
        return (
          <div key={d.key} className="space-y-1">
            {/* Header: key + revenue. On mobile this sits above the bar so the
                value is always visible even when the bar is short. */}
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-gray-700">{d.key}</span>
              <span className="text-[#6B21A8]">{fmt(d.revenue)} ج.م</span>
            </div>
            <div className="bg-gray-100 rounded-lg h-5 overflow-hidden" dir="ltr">
              <div className="h-full rounded-lg flex items-center px-2 text-[10px] font-bold text-[#1a1a2e] whitespace-nowrap" style={{ width: `${Math.max(pctW, 8)}%`, background: 'linear-gradient(90deg,#F5C518,#e6a200)' }}>{d.count} {d.count === 1 ? 'طلب' : 'طلب'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tooltip({ text, dark }: { text: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  // On mobile, tap-to-toggle is the only interaction. Without this listener
  // a tooltip stays open until the user taps the same icon again, which
  // looks broken when scrolling through a long report.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <span ref={ref} className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center transition shrink-0 ${dark ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
        aria-label="شرح"
      >i</button>
      {open && (
        <span className="absolute z-30 top-full left-0 mt-1.5 w-56 bg-[#1a1a2e] text-white text-[10px] leading-relaxed font-normal rounded-lg p-2.5 shadow-xl pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

// Surfaces the count of paid PayPal orders that never decremented stock
// (because they were captured before the stock-decrement fix shipped). The
// banner only renders when orphans exist, so it disappears after one click.
function PaypalReconcileBanner({ onDone }: { onDone: () => void }) {
  const { addToast } = useToast();
  const [info, setInfo] = useState<{ orderCount: number; totalUnits: number } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/inventory/reconcile-paypal', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return; // silently skip — this is a cleanup feature
        const d = await res.json();
        if (d.totalUnits > 0) setInfo({ orderCount: d.orderCount, totalUnits: d.totalUnits });
      } catch { /* ignore */ }
    })();
  }, []);

  if (!info) return null;

  const reconcile = async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch('/api/admin/inventory/reconcile-paypal', { method: 'POST', credentials: 'include' });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل التسوية', 'error'); setRunning(false); return; }
      addToast(`تمت تسوية ${d.reconciled} سطر من ${d.orderCount} طلب`, 'success', 6000);
      setInfo(null);
      onDone();
    } catch {
      addToast('فشل التسوية', 'error');
      setRunning(false);
    }
  };

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 print:hidden">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-black text-red-800">⚠️ مخزون يحتاج تسوية</p>
          <p className="text-xs text-red-700 mt-1.5 leading-relaxed">
            <strong>{info.totalUnits}</strong> قطعة من <strong>{info.orderCount}</strong> طلب PayPal اتسجلت كمبيعات قبل ما يتم إصلاح خصم المخزون من PayPal.
            دلوقتي بتطلع كـ "مباع" في التقييم بس مش مخصومة من المخزون. اضغط الزرار لخصمها مرة واحدة.
            هتتسجل في سجل تعديلات المخزون كـ <code>manual_adjustment</code> مع رقم الطلب.
          </p>
        </div>
        <button
          onClick={reconcile}
          disabled={running}
          className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-black transition disabled:opacity-50 shrink-0"
        >
          {running ? '...جاري التسوية' : '🔧 تسوية المخزون'}
        </button>
      </div>
    </div>
  );
}
