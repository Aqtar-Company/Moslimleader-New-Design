'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const { signIn, signUp } = useAuth();
  const { lang } = useLang();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRtl = lang === 'ar';

  const labels = {
    signin: isRtl ? 'تسجيل الدخول' : 'Sign In',
    signup: isRtl ? 'إنشاء حساب' : 'Create Account',
    name: isRtl ? 'الاسم الكامل' : 'Full Name',
    email: isRtl ? 'البريد الإلكتروني' : 'Email',
    password: isRtl ? 'كلمة المرور' : 'Password',
    phone: isRtl ? 'رقم الهاتف (اختياري)' : 'Phone (optional)',
    noAccount: isRtl ? 'ليس لديك حساب؟' : "Don't have an account?",
    hasAccount: isRtl ? 'لديك حساب بالفعل؟' : 'Already have an account?',
    signupLink: isRtl ? 'أنشئ حساباً' : 'Create one',
    signinLink: isRtl ? 'سجل دخولك' : 'Sign in',
    tagline: isRtl ? 'معاً نبني قادة الغد' : "Together We Build Tomorrow's Leaders",
    namePh: isRtl ? 'محمد أحمد' : 'Your full name',
    emailPh: 'example@email.com',
    passwordPh: isRtl ? '٨ أحرف أو أكثر' : '8+ characters',
    phonePh: isRtl ? '01xxxxxxxxx' : '+20 1xx xxx xxxx',
    submit: mode === 'signin'
      ? (isRtl ? 'دخول' : 'Sign In')
      : (isRtl ? 'إنشاء الحساب' : 'Create Account'),
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    let result;
    if (mode === 'signin') {
      result = await signIn(form.email, form.password);
    } else {
      if (!form.name.trim()) {
        setError(isRtl ? 'الاسم مطلوب' : 'Name is required');
        setLoading(false);
        return;
      }
      result = await signUp(form.name, form.email, form.password, form.phone);
    }
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    router.push(redirect);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="https://moslimleader.com/wp-content/uploads/2024/07/Logo.webp"
            alt="Muslim Leader"
            width={140}
            height={56}
            className="h-14 w-auto object-contain mx-auto mb-3"
            unoptimized
          />
          <p className="text-gray-500 text-sm">{labels.tagline}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${mode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {isRtl ? 'تسجيل دخول' : 'Sign In'}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {isRtl ? 'حساب جديد' : 'Sign Up'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{labels.name}</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={labels.namePh}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none transition"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{labels.email}</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder={labels.emailPh}
                className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none transition"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{labels.password}</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={labels.passwordPh}
                className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none transition"
                dir="ltr"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{labels.phone}</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder={labels.phonePh}
                  className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none transition"
                  dir="ltr"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition text-base mt-2"
            >
              {loading ? '...' : (mode === 'signin' ? (isRtl ? 'دخول' : 'Sign In') : (isRtl ? 'إنشاء الحساب' : 'Create Account'))}
            </button>
          </form>
        </div>

        {/* Divider hint */}
        <p className="text-center text-gray-500 text-sm mt-6">
          {mode === 'signin' ? labels.noAccount : labels.hasAccount}{' '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
            className="text-purple-700 font-semibold hover:underline"
          >
            {mode === 'signin' ? labels.signupLink : labels.signinLink}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return <Suspense><AuthContent /></Suspense>;
}
