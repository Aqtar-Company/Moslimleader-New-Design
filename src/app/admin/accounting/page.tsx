'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';
import { Section, KPI, FinKPI, Tooltip } from '@/components/admin/ReportPrimitives';
import { fmt, fmtMoney, pct, fmtDate } from '@/lib/format';

// Consolidated accounting snapshot. Reads /api/admin/accounting which
// pulls every figure from the same library helpers used by the
// detail pages — so a number here equals the same number on
// /admin/customers, /admin/suppliers, /admin/team, /admin/ip,
// /admin/partners and /admin/valuation. This page is the single
// "where do I stand?" view; detail pages are where edits happen.

type PeriodKey = 'this-month' | 'last-month' | 'this-quarter' | 'ytd' | 'ttm';

interface AccountingData {
  generatedAt: string;
  period: {
    key: PeriodKey;
    label: string;
    start: string;
    end: string;
    revenue: number;
    itemRevenue: number;
    shipping: number;
    discount: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    orderCount: number;
    unitsSold: number;
  };
  periodOptions: Array<{ key: PeriodKey; label: string }>;
  netPosition: number;
  receivables: {
    gross: number;
    provisionRate: number;
    provision: number;
    net: number;
    owedToUsTop: Array<{ id: string; name: string; isWholesale: boolean; balance: number }>;
    owedByUsCount: number;
    owedByUsTotal: number;
  };
  payables: {
    total: number;
    owedByUsTop: Array<{ id: string; name: string; type: string; balance: number }>;
    owedToUsCount: number;
    owedToUsTotal: number;
  };
  royalties: {
    totalAccrued: number;
    agreementsActive: number;
    perAuthor: Array<{
      id: string;
      payeeName: string;
      percentage: number;
      ttmGrossProfit: number;
      amountAccrued: number;
      lastPaidAt: string | null;
      productsCount: number;
    }>;
  };
  payroll: {
    headcount: number;
    monthlyNominal: number;
    monthlyAdjusted: number;
    annualNominal: number;
    annualAdjusted: number;
  };
  partners: {
    activeCount: number;
    totalCount: number;
    totalStakePercentage: number;
    remainingCompanyShare: number;
    isOverCommitted: boolean;
    reconciledMid: number;
    reconciledMidIsApprox: boolean;
    rows: Array<{ id: string; name: string; type: string; stakePercentage: number; shareValue: number }>;
  };
  assumptionsUpdatedAt: string | null;
}

const SUPPLIER_TYPE_LABEL: Record<string, string> = {
  paper:         'ورق',
  supervision:   'إشراف',
  manufacturing: 'تصنيع',
  other:         'أخرى',
};

export default function AccountingPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<AccountingData | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('ttm');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = async (p: PeriodKey) => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/accounting?period=${p}`);
      if (!res.ok) throw new Error('failed');
      const d = await res.json();
      setData(d);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(period); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);

  if (forbidden) return <ForbiddenState requiredPerm="valuation.read" />;
  if (loading || !data) return <Spinner />;

  const netTone: 'good' | 'bad' | 'neutral' =
    data.netPosition > 0 ? 'good' : data.netPosition < 0 ? 'bad' : 'neutral';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Hero — Net position headline */}
      <div className="bg-gradient-to-l from-[#1a1a2e] via-[#2d1060] to-[#1a1a2e] rounded-2xl p-5 sm:p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-xl font-black flex items-center gap-2">🧮 المحاسبة — الموقف المالي</h1>
            <p className="text-white/85 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              لقطة سريعة لكل حركة فلوس في الشركة: الديون اللي ليّنا، الديون اللي علينا، مستحقات المؤلفين، رواتب الشهر، وحصة كل شريك.
              الأرقام دي مأخوذة من نفس مصادر صفحات{' '}
              <Link href="/admin/team" className="underline hover:text-[#F5C518]">الفريق</Link>،{' '}
              <Link href="/admin/ip" className="underline hover:text-[#F5C518]">الملكية الفكرية</Link>،{' '}
              <Link href="/admin/partners" className="underline hover:text-[#F5C518]">الشركاء</Link>،{' '}
              <Link href="/admin/suppliers" className="underline hover:text-[#F5C518]">الموردين</Link>{' '}
              و<Link href="/admin/customers" className="underline hover:text-[#F5C518]">العملاء</Link>{' '}
              فهي 100% مطابقة.
            </p>
            <p className="text-[#F5C518]/90 text-[11px] mt-2 max-w-2xl">
              ⚠️ غير مشمول هنا: النقد في الخزينة والبنك، الضرائب، القروض، المسحوبات الشخصية. للعرض المحاسبي الكامل افتح{' '}
              <Link href="/admin/valuation" className="underline hover:text-white">تقييم الشركة</Link>.
            </p>
          </div>
          <div className={`rounded-xl px-4 py-3 shrink-0 border min-w-[180px] ${netTone === 'good' ? 'bg-emerald-500/15 border-emerald-300/30' : netTone === 'bad' ? 'bg-red-500/15 border-red-300/30' : 'bg-white/10 border-white/20'}`}>
            <p className="text-[10px] text-white/70 font-bold tracking-widest">صافي الموقف</p>
            <p className={`text-2xl sm:text-3xl font-black mt-1 ${netTone === 'good' ? 'text-emerald-300' : netTone === 'bad' ? 'text-red-300' : 'text-white'}`}>{fmtMoney(data.netPosition)}</p>
            <p className="text-[10px] text-white/60 mt-0.5">
              {netTone === 'good' ? '✓ سيولة موجبة' : netTone === 'bad' ? '⚠ ضغط فوري — مدفوعات > متحصلات' : '— متعادل'}
            </p>
          </div>
        </div>

        {/* Liabilities + assets KPI strip — quick "what's owed to us / by us" view. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          <Stat label="📥 ديون مستحقة لنا (صافي)" value={fmtMoney(data.receivables.net)} sub={`إجمالي ${fmtMoney(data.receivables.gross)} − احتياطي ${pct(data.receivables.provisionRate)}`} />
          <Stat label="📤 ديون علينا للموردين" value={fmtMoney(data.payables.total)} sub={`${fmt(data.payables.owedByUsTop.length)} مورد`} highlight={data.payables.total > 0} />
          <Stat label="📚 مستحقات المؤلفين" value={fmtMoney(data.royalties.totalAccrued)} sub={`${fmt(data.royalties.agreementsActive)} اتفاقية نشطة`} highlight={data.royalties.totalAccrued > 0} />
          <Stat label="💼 راتب الشهر (معدَّل)" value={fmtMoney(data.payroll.monthlyAdjusted)} sub={`${fmt(data.payroll.headcount)} موظف`} />
        </div>
      </div>

      {/* Period P&L */}
      <Section icon="📊" title="الأرباح والإيرادات (P&L)" subtitle="إيرادات وتكاليف الفترة المختارة باستخدام نفس منهجية تقييم الشركة">
        <div className="flex flex-wrap gap-2 mb-3">
          {data.periodOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${period === opt.key ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FinKPI
            label={`الإيراد (شامل الشحن)`}
            value={fmtMoney(data.period.revenue)}
            sub={`${fmt(data.period.orderCount)} طلب · ${fmt(data.period.unitsSold)} قطعة`}
            hint="مجموع Order.total — شامل الشحن وبعد الخصم. هذا الرقم هو المستخدم في مضاعفات السوق."
          />
          <FinKPI
            label="إيراد المنتجات (بدون شحن)"
            value={fmtMoney(data.period.itemRevenue)}
            sub={`شحن ${fmtMoney(data.period.shipping)} · خصم ${fmtMoney(data.period.discount)}`}
            hint="مجموع OrderItem.unitPrice × quantity. هذه القاعدة المستخدمة في حساب هامش الربح."
          />
          <FinKPI
            label="الربح الإجمالي"
            value={fmtMoney(data.period.grossProfit)}
            tone={data.period.grossProfit > 0 ? 'good' : 'bad'}
            sub={`بعد خصم ${fmtMoney(data.period.cogs)} تكلفة بضاعة مباعة`}
            hint="إيراد المنتجات ناقص تكلفة المبيعات (متوسط مرجَّح من الباتشات + احتياط COGS للمنتجات بدون باتش)."
          />
          <FinKPI
            label="هامش الربح"
            value={pct(data.period.grossMargin)}
            tone={data.period.grossMargin > 0.4 ? 'good' : data.period.grossMargin < 0.2 ? 'bad' : 'neutral'}
            sub="ربح إجمالي ÷ إيراد المنتجات"
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-3">
          📌 EBITDA الجزئي يحسب على مستوى السنة فقط في{' '}
          <Link href="/admin/valuation" className="text-blue-700 hover:underline">تقييم الشركة</Link> — يضم المرتبات والمصروفات التشغيلية.
        </p>
      </Section>

      {/* AR matrix */}
      <Section icon="📥" title="ديون مستحقة لنا (Top 15)" subtitle="عملاء عندهم رصيد يخصّنا — مرتَّبين حسب أكبر دين">
        {data.receivables.owedToUsTop.length === 0 ? (
          <EmptyState message="مفيش ديون مفتوحة على العملاء" icon="✅" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-emerald-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-emerald-900">العميل</th>
                    <th className="px-3 py-2 text-right text-emerald-900">النوع</th>
                    <th className="px-3 py-2 text-right text-emerald-900">الرصيد</th>
                    <th className="px-3 py-2 text-right text-emerald-900 print:hidden">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.receivables.owedToUsTop.map(r => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-bold text-gray-900">{r.name}</td>
                      <td className="px-3 py-2 text-[10px]">
                        {r.isWholesale
                          ? <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">جملة</span>
                          : <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">تجزئة</span>}
                      </td>
                      <td className="px-3 py-2 font-black text-emerald-700">{fmtMoney(r.balance)}</td>
                      <td className="px-3 py-2 text-[10px] print:hidden">
                        <Link href={r.isWholesale ? `/admin/wholesale/${r.id}` : `/admin/customers/${r.id}`} className="text-blue-700 hover:underline font-bold">
                          فتح الكشف →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {data.receivables.owedByUsCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 mt-2">
            ⚠️ <strong>{fmt(data.receivables.owedByUsCount)} عميل</strong> له رصيد دائن (دفع زيادة أو إشعار خصم) بإجمالي {fmtMoney(Math.abs(data.receivables.owedByUsTotal))}. مش داخل في الديون المستحقة لنا.
          </div>
        )}
      </Section>

      {/* AP matrix */}
      <Section icon="📤" title="ديون علينا للموردين (Top 15)" subtitle="موردون لهم رصيد عليّنا — مرتَّبين حسب أكبر دين">
        {data.payables.owedByUsTop.length === 0 ? (
          <EmptyState message="مفيش ديون مفتوحة للموردين" icon="✅" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-rose-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-rose-900">المورد</th>
                    <th className="px-3 py-2 text-right text-rose-900">النوع</th>
                    <th className="px-3 py-2 text-right text-rose-900">الرصيد</th>
                    <th className="px-3 py-2 text-right text-rose-900 print:hidden">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.payables.owedByUsTop.map(r => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-bold text-gray-900">{r.name}</td>
                      <td className="px-3 py-2 text-[10px]">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{SUPPLIER_TYPE_LABEL[r.type] ?? r.type}</span>
                      </td>
                      <td className="px-3 py-2 font-black text-rose-700">{fmtMoney(r.balance)}</td>
                      <td className="px-3 py-2 text-[10px] print:hidden">
                        <Link href={`/admin/suppliers/${r.id}`} className="text-blue-700 hover:underline font-bold">
                          فتح الكشف →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {data.payables.owedToUsCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 mt-2">
            💡 <strong>{fmt(data.payables.owedToUsCount)} مورد</strong> لنا عليهم رصيد بإجمالي {fmtMoney(Math.abs(data.payables.owedToUsTotal))} (دفعنا زيادة أو إشعار دائن). مش داخل في الديون اللي علينا.
          </div>
        )}
      </Section>

      {/* Royalty schedule */}
      {data.royalties.perAuthor.length > 0 && (
        <Section icon="📚" title="مستحقات المؤلفين" subtitle="نسب الأرباح المستحقة لأصحاب الحقوق — محسوبة على ربح آخر 12 شهر للمنتجات المرتبطة">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-amber-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-amber-900">المستحق</th>
                    <th className="px-3 py-2 text-right text-amber-900">النسبة</th>
                    <th className="px-3 py-2 text-right text-amber-900">منتجات</th>
                    <th className="px-3 py-2 text-right text-amber-900">ربح خاضع (TTM)</th>
                    <th className="px-3 py-2 text-right text-amber-900">المستحق</th>
                    <th className="px-3 py-2 text-right text-amber-900">آخر دفعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.royalties.perAuthor.map(a => (
                    <tr key={a.id}>
                      <td className="px-3 py-2 font-bold text-gray-900">{a.payeeName}</td>
                      <td className="px-3 py-2 font-bold text-gray-700">{a.percentage}%</td>
                      <td className="px-3 py-2 text-gray-600">{fmt(a.productsCount)}</td>
                      <td className="px-3 py-2 text-gray-700">{fmtMoney(a.ttmGrossProfit)}</td>
                      <td className="px-3 py-2 font-black text-amber-700">{fmtMoney(a.amountAccrued)}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-500">
                        {a.lastPaidAt ? <span className="text-emerald-700">✅ {fmtDate(a.lastPaidAt)}</span> : <span className="text-gray-400">— لم تُدفع</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            للإدارة (إضافة/تعديل/تسجيل دفعة):{' '}
            <Link href="/admin/ip" className="text-blue-700 hover:underline font-bold">/admin/ip</Link>
          </p>
        </Section>
      )}

      {/* Cap-table */}
      {data.partners.activeCount > 0 && (
        <Section icon="🪙" title="حصص الشركاء — قيم تقريبية" subtitle="حصة كل شريك من القيمة السوقية (مضاعف الإيراد)">
          {data.partners.isOverCommitted && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl px-4 py-2.5 text-[11px] text-red-900">
              ⚠️ مجموع نسب الشركاء النشطين تجاوز 100%. راجع{' '}
              <Link href="/admin/partners" className="underline font-bold">/admin/partners</Link> للتصحيح.
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI label="عدد الشركاء" value={`${fmt(data.partners.activeCount)} / ${fmt(data.partners.totalCount)}`} />
            <KPI label="مجموع الحصص" value={pct(data.partners.totalStakePercentage / 100)} tone={data.partners.isOverCommitted ? 'bad' : undefined} />
            <KPI label="حصة الشركة المتبقية" value={pct(data.partners.remainingCompanyShare / 100)} sub="غير موزَّعة" />
            <KPI
              label="القيمة المعتمدة (تقريبية)"
              value={fmtMoney(data.partners.reconciledMid)}
              hint="هذه قيمة سريعة بمضاعف الإيراد فقط. القيمة الكاملة (شاملة الأصول والملكية الفكرية) في /admin/valuation."
            />
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-purple-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-purple-900">الشريك</th>
                    <th className="px-3 py-2 text-right text-purple-900">الحصة</th>
                    <th className="px-3 py-2 text-right text-purple-900">القيمة (تقريبية)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.partners.rows.map(r => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-bold text-gray-900">{r.name}</td>
                      <td className="px-3 py-2 font-bold text-gray-700">{r.stakePercentage}%</td>
                      <td className="px-3 py-2 font-black text-purple-700">
                        {data.partners.isOverCommitted ? '— يلزم تصحيح الحصص أولاً —' : fmtMoney(r.shareValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            للإدارة:{' '}
            <Link href="/admin/partners" className="text-blue-700 hover:underline font-bold">/admin/partners</Link>
            {' '}· القيمة الكاملة في{' '}
            <Link href="/admin/valuation" className="text-blue-700 hover:underline font-bold">/admin/valuation</Link>
          </p>
        </Section>
      )}

      {/* Payroll */}
      <Section icon="💼" title="الفريق والرواتب" subtitle="عبء الرواتب الشهري والسنوي — يدخل في حساب EBITDA">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="عدد الموظفين" value={fmt(data.payroll.headcount)} />
          <KPI
            label="راتب شهري (اسمي)"
            value={fmtMoney(data.payroll.monthlyNominal)}
            hint="مجموع رواتب الموظفين النشطين كما هي بدون أي معاملات تخفيض."
          />
          <KPI
            label="راتب شهري (معدَّل)"
            value={fmtMoney(data.payroll.monthlyAdjusted)}
            hint="بعد تطبيق معامل الدوام: 100% للدوام الكامل، 50% للاستشاري، 25% للمتعاقد. هذا الرقم اللي يدخل صافي الموقف."
          />
          <KPI label="عبء سنوي معدَّل" value={fmtMoney(data.payroll.annualAdjusted)} sub="× 12" />
        </div>
        <p className="text-[11px] text-gray-500">
          للإدارة:{' '}
          <Link href="/admin/team" className="text-blue-700 hover:underline font-bold">/admin/team</Link>
        </p>
      </Section>

      {/* Footer disclosure */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-[11px] text-gray-700 leading-relaxed">
        <p className="font-bold text-gray-900 mb-2 flex items-center gap-2">
          📋 ملاحظات محاسبية
          <Tooltip text="هذه القائمة تظهر على /admin/valuation أيضاً — مكرَّرة هنا للتذكير." />
        </p>
        <ul className="space-y-1 list-disc pr-4">
          <li>لا يشمل: النقد، الضرائب، القروض، المسحوبات الشخصية، الأصول الثابتة (مكاين/أثاث).</li>
          <li>الذمم المدينة تُعرض بعد خصم {pct(data.receivables.provisionRate)} احتياطي ديون مشكوك فيها.</li>
          <li>مستحقات المؤلفين متجدّدة سنوياً ما لم تُسدَّد. الاتفاقيات المنتهية مدتها مستثناة تلقائياً.</li>
          <li>حصص الشركاء قيم تقريبية بمضاعف الإيراد. القيمة الكاملة في تقرير التقييم.</li>
        </ul>
        <p className="text-[10px] text-gray-500 mt-2">
          آخر تحديث للأرقام: {new Date(data.generatedAt).toLocaleString('en-GB')}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)' }}>
      <p className="text-[10px] text-white/60 font-bold tracking-widest">{label}</p>
      <p className={`text-base sm:text-lg font-black mt-1 ${highlight ? 'text-[#F5C518]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[9px] text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}
