'use client';

import { useEffect, useState } from 'react';

interface Report {
  pending: number;
  mlBudget: { monthlyBudget: number | null; usedThisMonth: number; reservedThisMonth: number; availableThisMonth: number | null };
  ml: { thisMonth: { approved: number; supportBeneficiaries: number; supportValue: number; customerPayments: number; retailValue: number } };
  copies: { total: number; available: number; assigned: number; inPreparation: number; readyToShip: number; shipped: number; delivered: number; confirmed: number; uniqueDeliveredBeneficiaries: number };
  impactContentPending: { messages: number; media: number };
  productDemand: { productId: string; productName: string; pendingRequests: number; availableCopies: number }[];
}

function KPICard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900', green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900', purple: 'bg-purple-50 border-purple-200 text-purple-900',
    red: 'bg-red-50 border-red-200 text-red-900', gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color] ?? colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminSupportReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/support-reports').then(r => r.json()).then(d => { setReport(d); setLoading(false); });
  }, []);

  if (loading) return <div className="p-12 text-center text-gray-400">جاري التحميل...</div>;
  if (!report) return null;

  const fmt = (n: number) => n.toLocaleString('ar-EG') + ' ج.م';

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">لوحة تقارير الدعم</h1>
        <div className="flex gap-2 text-sm">
          <a href="/admin/support-requests" className="text-blue-600 hover:underline">طلبات الدعم</a>
          <span className="text-gray-300">|</span>
          <a href="/admin/sponsored-copies" className="text-blue-600 hover:underline">النسخ المدعومة</a>
          <span className="text-gray-300">|</span>
          <a href="/admin/impact-content" className="text-blue-600 hover:underline">مراجعة المحتوى</a>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard label="طلبات دعم معلقة" value={report.pending} color={report.pending > 0 ? 'amber' : 'gray'} />
        <KPICard label="نسخ متاحة" value={report.copies.available} color="green" />
        <KPICard label="رسائل تحتاج مراجعة" value={report.impactContentPending.messages} color={report.impactContentPending.messages > 0 ? 'amber' : 'gray'} />
        <KPICard label="صور تحتاج مراجعة" value={report.impactContentPending.media} color={report.impactContentPending.media > 0 ? 'amber' : 'gray'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* ML Support - This Month */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">دعم Muslim Leader — هذا الشهر</h2>
          <div className="grid grid-cols-2 gap-4">
            <KPICard label="موافقات جديدة" value={report.ml.thisMonth.approved} color="blue" />
            <KPICard label="مستفيدون استخدموا الدعم" value={report.ml.thisMonth.supportBeneficiaries} color="green" />
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-500">قيمة دعم ML المصروفة</span>
              <span className="font-bold text-red-600">{fmt(report.ml.thisMonth.supportValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">مدفوعات العملاء المُحصَّلة</span>
              <span className="font-bold text-green-600">{fmt(report.ml.thisMonth.customerPayments)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">القيمة التجارية الإجمالية</span>
              <span className="font-bold">{fmt(report.ml.thisMonth.retailValue)}</span>
            </div>
          </div>

          {report.mlBudget.monthlyBudget && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">الميزانية الشهرية</span>
                <span className="font-medium">{fmt(report.mlBudget.monthlyBudget)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, (report.mlBudget.usedThisMonth / report.mlBudget.monthlyBudget) * 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{fmt(report.mlBudget.usedThisMonth)} مصروف</div>
            </div>
          )}
        </div>

        {/* Sponsored Copies */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">النسخ المدعومة — الإجمالي</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['إجمالي النسخ', report.copies.total, 'gray'],
              ['متاحة', report.copies.available, 'green'],
              ['مخصصة / قيد التجهيز', report.copies.assigned + report.copies.inPreparation, 'blue'],
              ['في الشحن', report.copies.shipped, 'purple'],
              ['وصلت', report.copies.delivered, 'green'],
              ['أكد المستفيد', report.copies.confirmed, 'green'],
            ].map(([label, value, color]) => (
              <KPICard key={String(label)} label={String(label)} value={value as number} color={String(color)} />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-sm font-medium text-gray-700">
              مستفيدون حقيقيون وصلت إليهم نسخ: {' '}
              <span className="text-green-700 font-bold text-lg">{report.copies.uniqueDeliveredBeneficiaries}</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">يُحسب بناءً على التسليم المؤكد فقط</div>
          </div>
        </div>
      </div>

      {/* Product demand vs supply */}
      {report.productDemand.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">طلب الدعم مقابل النسخ المتاحة — أعلى المنتجات</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-right p-3 font-medium text-gray-600">المنتج</th>
                  <th className="text-right p-3 font-medium text-gray-600">طلبات دعم معلقة</th>
                  <th className="text-right p-3 font-medium text-gray-600">نسخ متاحة</th>
                  <th className="text-right p-3 font-medium text-gray-600">الفجوة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.productDemand.map(p => (
                  <tr key={p.productId} className="hover:bg-gray-50/50">
                    <td className="p-3 font-medium text-gray-800">{p.productName}</td>
                    <td className="p-3 text-center font-bold text-amber-700">{p.pendingRequests}</td>
                    <td className="p-3 text-center font-bold text-green-700">{p.availableCopies}</td>
                    <td className="p-3 text-center">
                      <span className={`font-bold ${p.pendingRequests > p.availableCopies ? 'text-red-600' : 'text-green-600'}`}>
                        {p.pendingRequests > p.availableCopies ? `نقص ${p.pendingRequests - p.availableCopies}` : 'كافية'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
