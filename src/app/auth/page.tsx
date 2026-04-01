'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Validate redirect is a relative path to prevent open redirect attacks
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
  const { signIn, signUp } = useAuth();
  const { lang } = useLang();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRtl = lang === 'ar';

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

  const inputClass = 'w-full bg-gray-50 border border-gray-200 focus:border-gray-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition text-gray-900 placeholder:text-gray-400 text-sm';

  return (
    <div className="flex min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Left panel (image only, hidden on mobile) ── */}
      <div className="hidden lg:relative lg:block lg:w-1/2 bg-gray-900 overflow-hidden shrink-0">
        <Image src="/sign-in.jpg" alt="" fill className="object-cover object-center" unoptimized />
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">

          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-900">
              {mode === 'signin'
                ? (isRtl ? 'مرحباً بعودتك' : 'Welcome back')
                : (isRtl ? 'إنشاء حساب جديد' : 'Create your account')}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {mode === 'signin'
                ? (isRtl ? 'سجل دخولك لمتابعة تسوقك' : 'Sign in to continue shopping')
                : (isRtl ? 'انضم إلى مجتمع مسلم ليدر' : 'Join the Moslim Leader community')}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-7">
            {(['signin', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'signin' ? (isRtl ? 'تسجيل الدخول' : 'Sign In') : (isRtl ? 'حساب جديد' : 'Sign Up')}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  {isRtl ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input type="text" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={isRtl ? 'محمد أحمد' : 'Your full name'}
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                {isRtl ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <input type="email" required value={form.email} dir="ltr"
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="example@email.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                {isRtl ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} required minLength={6}
                  value={form.password} dir="ltr"
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={isRtl ? '٦ أحرف أو أكثر' : '6+ characters'}
                  className={inputClass + ' pe-10'}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute inset-y-0 end-3 flex items-center text-gray-400 hover:text-gray-600 transition">
                  {showPass
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  {isRtl ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'}
                </label>
                <input type="tel" value={form.phone} dir="ltr"
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder={isRtl ? '01xxxxxxxxx' : '+20 1xx xxx xxxx'}
                  className={inputClass}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition text-sm mt-1">
              {loading ? '...' : mode === 'signin'
                ? (isRtl ? 'دخول' : 'Sign In')
                : (isRtl ? 'إنشاء الحساب' : 'Create Account')}
            </button>

            {/* Google Login Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">{isRtl ? 'أو' : 'OR'}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Google Login Button */}
            <a
              href="/api/auth/oauth/google"
              className="w-full flex items-center justify-center gap-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl py-3 transition text-sm font-medium text-gray-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isRtl ? 'المتابعة بـ Google' : 'Continue with Google'}
            </a>
          </form>

          <p className="text-center text-gray-400 text-sm mt-6">
            {mode === 'signin'
              ? (isRtl ? 'ليس لديك حساب؟' : "Don't have an account?")
              : (isRtl ? 'لديك حساب بالفعل؟' : 'Already have an account?')}{' '}
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="text-gray-900 font-bold hover:underline">
              {mode === 'signin'
                ? (isRtl ? 'أنشئ حساباً' : 'Create one')
                : (isRtl ? 'سجل دخولك' : 'Sign in')}
            </button>
          </p>

          <p className="text-center mt-4">
            <button onClick={() => router.push(redirect)}
              className="text-xs text-gray-400 hover:text-gray-600 transition underline underline-offset-2">
              {isRtl ? 'تصفح بدون تسجيل' : 'Continue without signing in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return <Suspense><AuthContent /></Suspense>;
}
