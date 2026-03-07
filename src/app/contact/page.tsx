'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';

export default function ContactPage() {
  const { t, isRtl } = useLang();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Hero – full-width image */}
      <div className="relative w-full h-[340px] md:h-[480px] lg:h-[560px] overflow-hidden">
        <Image
          src="/contact-hero.png"
          alt="contact hero"
          fill
          priority
          className="object-cover object-center"
        />
        {/* gradient overlay: transparent top → dark bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/70" />
        {/* text pinned to bottom */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center px-4 pb-10">
          <h1 className="text-4xl md:text-6xl font-black text-white drop-shadow-lg">
            {t('contact.title')}
          </h1>
          <p className="text-white/80 mt-3 text-lg md:text-xl max-w-xl drop-shadow">
            {t('contact.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12">

        {/* Contact info */}
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 mb-6">{t('contact.info.title')}</h2>
            <div className="flex flex-col gap-5">
              {[
                {
                  icon: (
                    <svg className="w-5 h-5 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                  label: t('contact.info.email.label'),
                  value: 'info@moslimleader.com',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  ),
                  label: t('contact.info.phone.label'),
                  value: '‪+20 100 000 0000‬',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-[#F5C518]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ),
                  label: t('contact.info.address.label'),
                  value: t('contact.info.address.value'),
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
            <h3 className="font-bold text-gray-900 mb-3">{t('contact.hours.title')}</h3>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {t('contact.hours.text')}
            </p>
          </div>
        </div>

        {/* Form */}
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-6">{t('contact.form.title')}</h2>

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="font-bold text-xl text-green-800 mb-2">{t('contact.success.title')}</h3>
              <p className="text-green-600">{t('contact.success.text')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('contact.form.name')}</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none"
                  placeholder={t('contact.form.name.ph')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('contact.form.email')}</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none"
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('contact.form.phone')}</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none"
                  placeholder={t('contact.form.phone.ph')}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('contact.form.message')}</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none resize-none"
                  placeholder={t('contact.form.message.ph')}
                />
              </div>
              <button
                type="submit"
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold py-4 px-6 rounded-xl transition text-lg"
              >
                {t('contact.form.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
