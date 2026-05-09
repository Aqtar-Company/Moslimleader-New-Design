'use client';

import { useState } from 'react';
import Link from 'next/link';

const PHONE_DISPLAY = '+20 100 000 0000';
const PHONE_RAW = '201000000000'; // E.164 without + for wa.me
const EMAIL = 'orders@moslimleader.com';
const FB_PAGE = 'https://www.facebook.com/moslimleader';
const IG = 'https://www.instagram.com/moslimleader';

export default function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/contact-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'contact',
          name: fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          message: fd.get('message'),
          honeypot: fd.get('website'),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'فشل الإرسال — حاول مرة أخرى'); setSubmitting(false); return; }
      setDone(true);
    } catch {
      setError('فشل الاتصال. حاول مرة أخرى أو راسلنا مباشرة.');
    }
    setSubmitting(false);
  };

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 py-10">
      <article className="max-w-3xl mx-auto px-4 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">تواصل معنا</h1>
          <p className="text-sm text-gray-600 mt-1">
            فريق مسلم ليدر يسرّه خدمتك — نرد على رسائلك خلال 24 ساعة من الأحد للخميس.
          </p>
        </header>

        {/* Quick channels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <ChannelCard
            icon="📱"
            label="واتساب — الأسرع"
            href={`https://wa.me/${PHONE_RAW}?text=${encodeURIComponent('السلام عليكم، عاوز استفسار')}`}
            sub={PHONE_DISPLAY}
            color="emerald"
          />
          <ChannelCard
            icon="📧"
            label="البريد الإلكتروني"
            href={`mailto:${EMAIL}`}
            sub={EMAIL}
            color="blue"
          />
          <ChannelCard
            icon="📘"
            label="فيسبوك Messenger"
            href={FB_PAGE}
            sub="@moslimleader"
            color="indigo"
          />
          <ChannelCard
            icon="📷"
            label="إنستجرام"
            href={IG}
            sub="@moslimleader"
            color="pink"
          />
        </div>

        {/* Form */}
        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          {done ? (
            <div className="text-center py-10">
              <p className="text-2xl font-black text-emerald-700">✅ تم استلام رسالتك</p>
              <p className="text-sm text-gray-700 mt-2">هنرد عليك في أقرب وقت 🙏</p>
              <Link
                href="/"
                className="inline-block mt-4 px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-black"
              >
                العودة للرئيسية
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-black text-gray-900 mb-3">📝 ابعت لنا رسالة</h2>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="الاسم *">
                    <input name="name" required minLength={2} maxLength={200} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </Field>
                  <Field label="رقم الموبايل">
                    <input name="phone" maxLength={50} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                  </Field>
                </div>
                <Field label="البريد الإلكتروني">
                  <input name="email" type="email" maxLength={200} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                </Field>
                <Field label="رسالتك *">
                  <textarea name="message" required minLength={5} maxLength={4000} rows={5} placeholder="اكتب استفسارك أو ملاحظاتك..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                {error && <p className="text-xs text-red-700 font-bold">{error}</p>}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] text-xs font-black transition disabled:opacity-50"
                  >
                    {submitting ? '...جاري الإرسال' : '📤 إرسال'}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        <footer className="mt-8 text-center text-xs text-gray-500">
          <div className="flex items-center justify-center gap-3">
            <Link href="/" className="text-blue-700 hover:underline">الرئيسية</Link>
            <span>·</span>
            <Link href="/policy" className="text-blue-700 hover:underline">سياسة الخصوصية</Link>
            <span>·</span>
            <Link href="/delete-data" className="text-blue-700 hover:underline">حذف البيانات</Link>
          </div>
        </footer>
      </article>
    </main>
  );
}

function ChannelCard({
  icon, label, href, sub, color,
}: {
  icon: string; label: string; href: string; sub: string;
  color: 'emerald' | 'blue' | 'indigo' | 'pink';
}) {
  const tone: Record<string, string> = {
    emerald: 'border-emerald-200 hover:bg-emerald-50',
    blue:    'border-blue-200    hover:bg-blue-50',
    indigo:  'border-indigo-200  hover:bg-indigo-50',
    pink:    'border-pink-200    hover:bg-pink-50',
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`bg-white border-2 rounded-2xl p-4 flex items-center gap-3 transition shadow-sm ${tone[color]}`}
    >
      <span className="text-3xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900">{label}</p>
        <p className="text-[11px] text-gray-600 truncate" dir="ltr">{sub}</p>
      </div>
    </a>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-gray-700 font-bold mb-1">{label}</label>
      {children}
    </div>
  );
}
