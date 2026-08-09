'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface ImpactData {
  sponsor: {
    id: string; name: string; organization?: string;
    stats: { totalCopies: number; deliveredCopies: number; confirmedCopies: number; totalRetailValue: number };
  };
  copies: {
    id: string; code: string; status: string;
    product: { name: string };
    impactMessages: { id: string; message: string; status: string }[];
    impactMedia: { id: string; mediaUrl: string; status: string }[];
    deliveredAt?: string;
  }[];
}

const COPY_STATUS: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: 'متاحة', color: 'text-gray-500' },
  ASSIGNED: { label: 'مخصصة لمستفيد', color: 'text-blue-600' },
  IN_PREPARATION: { label: 'قيد التجهيز', color: 'text-orange-600' },
  READY_TO_SHIP: { label: 'جاهزة للشحن', color: 'text-purple-600' },
  SHIPPED: { label: 'في الطريق', color: 'text-blue-600' },
  DELIVERED: { label: 'وصلت', color: 'text-green-600' },
  CONFIRMED: { label: 'مؤكدة', color: 'text-green-700' },
  COMPLETED: { label: 'مكتملة', color: 'text-green-800' },
};

export default function AccountSponsorImpactPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notSponsor, setNotSponsor] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/auth/login?redirect=/account/sponsor-impact'); }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/sponsor-impact').then(async r => {
      if (r.status === 404) { setNotSponsor(true); setLoading(false); return; }
      const d = await r.json();
      setData(d);
      setLoading(false);
    });
  }, [user]);

  if (authLoading || loading) return <div className="p-12 text-center text-gray-400">جاري التحميل...</div>;

  if (notSponsor) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center" dir="rtl">
        <div className="text-5xl mb-4">🎁</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">ادعم بنسخة كتاب أو منتج</h1>
        <p className="text-gray-500 text-sm mb-6">
          عندما تشتري نسخة مدعومة من أي منتج، يمكنك متابعة رحلتها حتى تصل لصاحبها هنا.
        </p>
        <a href="/shop" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-blue-700">
          تصفح المنتجات
        </a>
      </div>
    );
  }

  if (!data) return null;

  const { sponsor, copies } = data;
  const fmt = (n: number) => n.toLocaleString('ar-EG') + ' ج.م';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">أثر تبرعاتك</h1>
      <p className="text-gray-500 text-sm mb-6">
        تتبع النسخ التي اشتريتها ورحلتها حتى تصل لأصحابها
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          ['إجمالي النسخ', sponsor.stats.totalCopies, 'gray'],
          ['وصلت لمستفيد', sponsor.stats.deliveredCopies + sponsor.stats.confirmedCopies, 'green'],
          ['مؤكدة الاستلام', sponsor.stats.confirmedCopies, 'green'],
          ['القيمة الكلية', fmt(sponsor.stats.totalRetailValue), 'blue'],
        ].map(([label, value, color]) => {
          const colors: Record<string, string> = { gray: 'bg-gray-50 border-gray-200 text-gray-700', green: 'bg-green-50 border-green-200 text-green-900', blue: 'bg-blue-50 border-blue-200 text-blue-900' };
          return (
            <div key={String(label)} className={`border rounded-xl p-4 ${colors[String(color)]}`}>
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs mt-1 opacity-80">{label}</div>
            </div>
          );
        })}
      </div>

      {/* Copies list */}
      <div className="space-y-4">
        {copies.map(copy => {
          const statusInfo = COPY_STATUS[copy.status] ?? { label: copy.status, color: 'text-gray-500' };
          const approvedMessages = copy.impactMessages.filter(m => m.status === 'APPROVED');
          const approvedMedia = copy.impactMedia.filter(m => m.status === 'APPROVED');
          const hasImpact = approvedMessages.length > 0 || approvedMedia.length > 0;

          return (
            <div key={copy.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-mono text-sm text-gray-500">{copy.code}</span>
                    <span className="mx-2 text-gray-200">·</span>
                    <span className="text-sm text-gray-700 font-medium">{copy.product.name}</span>
                  </div>
                  <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>

                {/* Journey progress bar */}
                <div className="flex items-center gap-1 mt-3">
                  {['ASSIGNED', 'IN_PREPARATION', 'SHIPPED', 'DELIVERED', 'CONFIRMED'].map((step, i) => {
                    const order = ['AVAILABLE', 'RESERVED', 'ASSIGNED', 'IN_PREPARATION', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CONFIRMED', 'COMPLETED'];
                    const currentIdx = order.indexOf(copy.status);
                    const stepIdx = order.indexOf(step);
                    const passed = currentIdx >= stepIdx;
                    return (
                      <div key={step} className={`flex-1 h-1.5 rounded-full ${passed ? 'bg-green-500' : 'bg-gray-100'} ${i > 0 ? 'mr-0' : ''}`} />
                    );
                  })}
                </div>

                {/* Impact content */}
                {hasImpact && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-3">رسالة من المستفيد</p>
                    {approvedMessages.map(m => (
                      <blockquote key={m.id} className="text-sm italic text-gray-700 bg-green-50 border-r-4 border-green-400 p-4 rounded-xl mb-2">
                        &ldquo;{m.message}&rdquo;
                      </blockquote>
                    ))}
                    {approvedMedia.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {approvedMedia.map(med => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={med.id} src={med.mediaUrl} alt="صورة الاستلام" className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {copy.status === 'DELIVERED' && !hasImpact && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-700">
                    وصلت النسخة — قد يشارك المستفيد رسالة شكر اختياراً
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
