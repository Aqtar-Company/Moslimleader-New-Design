'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production: send to API route or email service
    setSent(true);
  }

  return (
    <>
      {/* Banner */}
      <div className="bg-[#F5C518] py-12 text-center">
        <h1 className="text-3xl md:text-5xl font-black text-gray-900">اتصل بنا</h1>
        <p className="text-gray-700 mt-2 text-lg">نحن هنا للمساعدة — تواصل معنا في أي وقت</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12">

        {/* Contact info */}
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 mb-6">بياناتنا</h2>
            <div className="flex flex-col gap-5">
              {[
                {
                  icon: (
                    <svg className="w-5 h-5 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                  label: 'البريد الإلكتروني',
                  value: 'info@moslimleader.com',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  ),
                  label: 'الهاتف / واتساب',
                  value: '‪+20 100 000 0000‬',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ),
                  label: 'العنوان',
                  value: 'مصر',
                },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-4 bg-gray-50 rounded-2xl p-4">
                  <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">{item.label}</p>
                    <p className="font-bold text-gray-900">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Working hours */}
          <div className="bg-[#FFF9E6] rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 mb-3">ساعات العمل</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              السبت – الخميس: 9 صباحاً – 6 مساءً<br />
              الجمعة: مغلق
            </p>
          </div>
        </div>

        {/* Form */}
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-6">أرسل رسالة</h2>

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="font-bold text-xl text-green-800 mb-2">تم إرسال رسالتك!</h3>
              <p className="text-green-600">سنرد عليك في أقرب وقت ممكن.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">الاسم</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none text-right"
                  placeholder="اسمك الكامل"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none text-right"
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">رقم الهاتف (اختياري)</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none text-right"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">الرسالة</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none text-right resize-none"
                  placeholder="اكتب رسالتك هنا..."
                />
              </div>
              <button
                type="submit"
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold py-4 px-6 rounded-xl transition text-lg"
              >
                إرسال الرسالة
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
