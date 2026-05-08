'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, adminJson, ForbiddenError } from '@/lib/admin-fetch';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Segment { key: string; label: string; icon: string }

const SEGMENTS: Segment[] = [
  { key: 'all',        label: 'الكل',                icon: '👥' },
  { key: 'vip',        label: 'VIP',                 icon: '👑' },
  { key: 'active',     label: 'نشطون',               icon: '🔥' },
  { key: 'repeat',     label: 'متكررون',             icon: '🔁' },
  { key: 'single',     label: 'مرة واحدة',           icon: '🆕' },
  { key: 'dormant',    label: 'نائمون',              icon: '💤' },
  { key: 'bought_all', label: 'اشتروا كل المنتجات',  icon: '✨' },
  { key: 'wholesale',  label: 'تجار جملة',           icon: '🏪' },
];

const DEFAULT_BODY = `مرحبًا {{firstName}} 👋

عندنا منتج جديد ممكن يعجبك جدًا.

استخدم الكوبون {{couponCode}} للخصم.`;

// Mirror of the server-side renderer for the live preview.
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function bodyToParagraphs(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 12px;line-height:1.7">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [segmentKey, setSegmentKey] = useState('active');
  const [subject, setSubject] = useState('عرض خاص ليك من Moslim Leader');
  const [bodyText, setBodyText] = useState(DEFAULT_BODY);
  const [couponCode, setCouponCode] = useState('');
  const [ctaLabel, setCtaLabel] = useState('تسوّق الآن');
  const [ctaUrl, setCtaUrl] = useState('https://moslimleader.com/shop');
  const [dailyLimit, setDailyLimit] = useState(5);
  const [audienceCount, setAudienceCount] = useState(0);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [coupons, setCoupons] = useState<Array<{ code: string; discount: number; isActive: boolean }>>([]);
  const [creating, setCreating] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const loadAudience = useCallback(async () => {
    setAudienceLoading(true);
    try {
      const res = await adminFetch(`/api/admin/customers?segment=${segmentKey}`);
      const data = await res.json();
      // Mirror the send-eligibility filter from /send-daily-batch — only
      // opted-in customers with an email actually receive the campaign.
      setAudienceCount(
        (data.customers ?? []).filter((c: { email: string; marketingOptIn?: boolean }) => c.email && c.marketingOptIn === true).length,
      );
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
    }
    setAudienceLoading(false);
  }, [segmentKey]);

  useEffect(() => { loadAudience(); }, [loadAudience]);

  useEffect(() => {
    adminFetch('/api/admin/coupons')
      .then(r => r.json())
      .then(d => setCoupons((d.coupons ?? []).filter((c: { isActive: boolean }) => c.isActive)))
      .catch(() => { /* non-fatal — coupon picker stays empty */ });
  }, []);

  const handleSaveDraft = async () => {
    if (!name.trim() || !subject.trim() || !bodyText.trim()) {
      addToast('املأ كل الحقول المطلوبة', 'warning');
      return;
    }
    setCreating(true);
    try {
      const data = await adminJson<{ campaign: { id: string } }>('/api/admin/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name,
          segmentKey,
          subject,
          bodyText,
          couponCode: couponCode || null,
          ctaLabel: ctaLabel.trim() || null,
          ctaUrl: ctaUrl.trim() || null,
          dailyLimit,
        }),
      });
      addToast('تم حفظ الحملة', 'success');
      router.push(`/admin/campaigns/${data.campaign.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الحفظ', 'error');
    }
    setCreating(false);
  };

  if (forbidden) return <ForbiddenState requiredPerm="campaigns.write" />;

  // Live preview HTML. Mirrors the server's renderPlainTextEmail() body
  // section so what the assistant sees here is what the customer gets.
  const previewBody = bodyToParagraphs(
    bodyText
      .replace(/\{\{firstName\}\}/g, escapeHtml('أحمد'))
      .replace(/\{\{couponCode\}\}/g, escapeHtml(couponCode || 'XXXXX')),
  );
  const previewSubject = subject
    .replace(/\{\{firstName\}\}/g, 'أحمد')
    .replace(/\{\{couponCode\}\}/g, couponCode || 'XXXXX');

  return (
    <div className="space-y-5">
      <Link href="/admin/campaigns" className="text-xs text-gray-500 hover:text-gray-900">← العودة للحملات</Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Composer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">📝 محتوى الرسالة</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">اسم الحملة (داخلي فقط)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: ترويج رمضان 2026"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">عنوان الإيميل</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">نص الرسالة</label>
                <textarea
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  rows={10}
                  placeholder="اكتب الرسالة كأنك بتكتب لصديق..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 leading-relaxed"
                />
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  اكتب نص عادي. النظام بيغلّفه في تصميم احترافي تلقائياً.<br/>
                  المتغيرات المتاحة: <code className="text-gray-600">{'{{firstName}}'}</code> · <code className="text-gray-600">{'{{couponCode}}'}</code>
                </p>
              </div>
            </div>
          </div>

          {/* CTA + coupon */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-black text-gray-900">🎯 زر CTA (اختياري)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">نص الزر</label>
                <input
                  value={ctaLabel}
                  onChange={e => setCtaLabel(e.target.value)}
                  placeholder="تسوّق الآن"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">الرابط</label>
                <input
                  dir="ltr"
                  value={ctaUrl}
                  onChange={e => setCtaUrl(e.target.value)}
                  placeholder="https://moslimleader.com/shop"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 font-mono"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400">سيب الحقلين فاضيين لو مش عاوز زر.</p>
          </div>

          {/* Preview */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">👁️ معاينة</h2>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 max-w-md mx-auto shadow-sm">
                <div className="bg-gradient-to-r from-[#1a1a2e] to-[#2d1060] px-6 py-4 text-center">
                  <p className="text-[#F5C518] font-black text-sm">Moslim Leader</p>
                </div>
                <p className="text-xs text-gray-400 px-4 pt-3 pb-1 border-b border-gray-100">
                  <span className="font-bold">الموضوع:</span> {previewSubject}
                </p>
                <div
                  className="px-4 py-4 text-sm text-gray-800"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: previewBody }}
                />
                {couponCode && (
                  <p className="text-center px-4 pb-3">
                    <span className="inline-block px-6 py-3 bg-[#F5C518] text-[#1a1a2e] rounded-xl text-base font-black tracking-widest font-mono">{couponCode}</span>
                  </p>
                )}
                {ctaLabel && ctaUrl && (
                  <p className="text-center px-4 pb-4">
                    <span className="inline-block px-6 py-2.5 bg-[#1a1a2e] text-white rounded-xl text-xs font-bold">{ctaLabel}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">🎯 الجمهور</h2>
            <div className="space-y-1.5">
              {SEGMENTS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSegmentKey(s.key)}
                  className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                    segmentKey === s.key
                      ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-emerald-700 font-bold">عدد المستلمين الكلي</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {audienceLoading ? '...' : audienceCount}
              </p>
            </div>
          </div>

          {/* Daily limit */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">⏱️ الإرسال اليومي</h2>
            <label className="text-[11px] font-bold text-gray-600 mb-1 block">عدد المستلمين في كل دفعة</label>
            <input
              type="number"
              min={1}
              max={50}
              value={dailyLimit}
              onChange={e => setDailyLimit(Math.max(1, Math.min(50, parseInt(e.target.value) || 5)))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
              المساعد هيدوس &laquo;أرسل دفعة اليوم&raquo; مرة في اليوم → النظام يبعت {dailyLimit} رسالة بس.<br/>
              ده بيخلّي الإرسال يبان طبيعي ومش spam.
            </p>
            {audienceCount > 0 && dailyLimit > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-amber-700 font-bold">
                  هتخلص الجمهور في ~{Math.ceil(audienceCount / dailyLimit)} يوم
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">🎟️ كوبون (اختياري)</h2>
            <select
              value={couponCode}
              onChange={e => setCouponCode(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
            >
              <option value="">— لا يوجد —</option>
              {coupons.map(c => (
                <option key={c.code} value={c.code}>{c.code} ({c.discount}%)</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-2">يظهر تلقائياً في الرسالة كزر مميّز.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
            <button
              onClick={handleSaveDraft}
              disabled={creating}
              className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition shadow-sm"
            >
              💾 إنشاء الحملة
            </button>
            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              بعد الإنشاء افتح الحملة من القائمة واضغط<br/>&laquo;أرسل دفعة اليوم&raquo; مرة كل 24 ساعة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
