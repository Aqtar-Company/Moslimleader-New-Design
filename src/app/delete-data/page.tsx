'use client';

import { useState } from 'react';
import Link from 'next/link';

// Data Deletion Instructions page — required by Facebook for any
// app that handles user data. Lives at /delete-data because Facebook
// scans the URL pattern and the app review reviewer pastes it here.
//
// We give BOTH:
//   • Plain instructions (Arabic + English) so a reviewer can read
//     them without filling a form
//   • A working form that submits the request to the admin inbox
//     so the actual user gets a response without contacting us
//     through other channels.

const TITLE_AR = 'طلب حذف البيانات';
const TITLE_EN = 'Data Deletion Instructions';

export default function DeleteDataPage() {
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
          kind: 'delete-data',
          name: fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          facebookName: fd.get('facebookName'),
          message: fd.get('message') || 'طلب حذف بياناتي من مساعد مسلم ليدر الذكي.',
          honeypot: fd.get('website'), // hidden — bots fill this
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'فشل الإرسال — حاول مرة أخرى'); setSubmitting(false); return; }
      setDone(true);
    } catch {
      setError('فشل الاتصال. حاول مرة أخرى أو راسلنا على orders@moslimleader.com');
    }
    setSubmitting(false);
  };

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 py-10">
      <article className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10">
        <header className="mb-6 pb-6 border-b border-gray-200">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{TITLE_AR}</h1>
          <p className="text-sm text-gray-500 mt-1" dir="ltr">{TITLE_EN}</p>
        </header>

        {/* English block — what the FB reviewer reads first */}
        <section className="mb-6 leading-relaxed text-sm text-gray-800" dir="ltr" style={{ textAlign: 'left' }}>
          <p>
            If you want to request deletion of your data from the <strong>Moslim Leader AI Assistant</strong>
            (Facebook Messenger / Page comments), please use the form below or contact us:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Email: <a href="mailto:orders@moslimleader.com" className="text-blue-700 hover:underline">orders@moslimleader.com</a></li>
            <li>WhatsApp / Phone: see <Link href="/contact" className="text-blue-700 hover:underline">/contact</Link></li>
          </ul>
          <p className="mt-3">
            Please include your <strong>Facebook display name</strong> (or the page where you commented) and the
            request: <em>&quot;Delete my data&quot;</em>. We will review and delete the related conversation logs
            within 30 days.
          </p>
        </section>

        {/* Arabic block — what your local users read */}
        <section className="mb-8 leading-relaxed text-sm text-gray-800">
          <p>
            إذا كنت ترغب في حذف بياناتك المرتبطة بمساعد <strong>مسلم ليدر الذكي</strong>
            (المحادثات على Messenger أو التعليقات على صفحتنا)، يمكنك استخدام النموذج أدناه أو التواصل معنا:
          </p>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li>📧 <a href="mailto:orders@moslimleader.com" className="text-blue-700 hover:underline">orders@moslimleader.com</a></li>
            <li>📱 <Link href="/contact" className="text-blue-700 hover:underline">صفحة التواصل</Link> (واتساب وأرقام الفريق)</li>
          </ul>
          <p className="mt-3">
            يرجى ذكر <strong>اسمك الظاهر على فيسبوك</strong> (أو الصفحة اللي علّقت عليها) مع كلمة:{' '}
            <em>&quot;طلب حذف بياناتي&quot;</em>. سنقوم بمراجعة الطلب وحذف بيانات المحادثات المرتبطة
            خلال 30 يوماً كحد أقصى.
          </p>
        </section>

        {/* Form */}
        <section className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5">
          {done ? (
            <div className="text-center py-8">
              <p className="text-2xl font-black text-emerald-700">✅ تم استلام طلبك</p>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                هنراجعه ونرد عليك خلال 30 يوم كحد أقصى.<br />
                لو محتاج أي استفسار، راسلنا على{' '}
                <a href="mailto:orders@moslimleader.com" className="text-blue-700 hover:underline">
                  orders@moslimleader.com
                </a>.
              </p>
              <Link
                href="/"
                className="inline-block mt-4 px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-black"
              >
                العودة للرئيسية
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-amber-900 mb-3">📝 طلب الحذف عبر النموذج</p>
              <form onSubmit={submit} className="space-y-3">
                <Field label="اسمك *">
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={200}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </Field>
                <Field label="اسمك على فيسبوك (مهم) *">
                  <input
                    name="facebookName"
                    required
                    minLength={2}
                    maxLength={200}
                    placeholder="Facebook display name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="البريد الإلكتروني">
                    <input
                      name="email"
                      type="email"
                      maxLength={200}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      dir="ltr"
                    />
                  </Field>
                  <Field label="رقم الموبايل">
                    <input
                      name="phone"
                      maxLength={50}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      dir="ltr"
                    />
                  </Field>
                </div>
                <Field label="ملاحظات إضافية (اختياري)">
                  <textarea
                    name="message"
                    rows={3}
                    maxLength={4000}
                    placeholder="مثال: حذفت البوست اللي كنت معلّق عليه ومش عاوز أي بيانات تفضل."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </Field>
                {/* Honeypot — bots fill it; humans don't see it. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />
                {error && <p className="text-xs text-red-700 font-bold">{error}</p>}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition disabled:opacity-50"
                  >
                    {submitting ? '...جاري الإرسال' : '🗑️ إرسال طلب الحذف'}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        <footer className="mt-8 pt-5 border-t border-gray-200 text-center text-xs text-gray-500">
          <div className="flex items-center justify-center gap-3">
            <Link href="/" className="text-blue-700 hover:underline">الرئيسية</Link>
            <span>·</span>
            <Link href="/policy" className="text-blue-700 hover:underline">سياسة الخصوصية</Link>
            <span>·</span>
            <Link href="/contact" className="text-blue-700 hover:underline">تواصل معنا</Link>
          </div>
        </footer>
      </article>
    </main>
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
