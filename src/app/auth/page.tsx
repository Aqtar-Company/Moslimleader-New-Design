'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
  const { signIn, signUp } = useAuth();
  const { lang } = useLang();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(''); // set when user needs email verification
  const isRtl = lang === 'ar';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'forgot') {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || (isRtl ? 'حدث خطأ' : 'An error occurred'));
        } else {
          setForgotSent(true);
        }
      } catch {
        setError(isRtl ? 'حدث خطأ في الاتصال' : 'Connection error');
      }
      setLoading(false);
      return;
    }

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
    if (result.needsVerification) { setVerifyEmail(result.email || form.email); return; }
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

          {/* ── EMAIL VERIFICATION PENDING ── */}
          {verifyEmail ? (
            <div className="text-center">
              <div className="text-6xl mb-4">📧</div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">
                {isRtl ? 'تحقق من بريدك الإلكتروني' : 'Check your email'}
              </h2>
              <p className="text-gray-500 text-sm mb-1">
                {isRtl ? 'أرسلنا رابط التحقق إلى:' : 'We sent a verification link to:'}
              </p>
              <p className="font-semibold text-gray-800 mb-5" dir="ltr">{verifyEmail}</p>
              <p className="text-gray-400 text-xs mb-6">
                {isRtl
                  ? 'افتح الرابط لتفعيل حسابك. إذا لم يصل، تحقق من مجلد الرسائل غير المرغوب فيها.'
                  : "Open the link to activate your account. If it didn't arrive, check your spam folder."}
              </p>
              <button
                onClick={async () => {
                  await fetch('/api/auth/resend-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: verifyEmail }),
                  });
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline block mb-3 mx-auto"
              >
                {isRtl ? 'إعادة إرسال الرابط' : 'Resend verification link'}
              </button>
              <button
                onClick={() => { setVerifyEmail(''); setMode('signin'); setError(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                {isRtl ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
              </button>
            </div>
          ) : mode === 'forgot' ? (
            <>
              {forgotSent ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 mb-2">
                    {isRtl ? 'تم إرسال الرابط!' : 'Link Sent!'}
                  </h2>
                  <p className="text-gray-500 text-sm mb-6">
                    {isRtl
                      ? `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${form.email}. تحقق من بريدك الإلكتروني.`
                      : `A password reset link has been sent to ${form.email}. Check your inbox.`}
                  </p>
                  <button onClick={() => { setMode('signin'); setForgotSent(false); setForm(f => ({ ...f, email: '' })); }}
                    className="text-gray-900 font-bold hover:underline text-sm">
                    {isRtl ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-black text-gray-900">
                      {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      {isRtl
                        ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين'
                        : 'Enter your email and we\'ll send you a reset link'}
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        {isRtl ? 'البريد الإلكتروني' : 'Email'}
                      </label>
                      <input type="email" required
                        value={form.email} dir="ltr"
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        className={inputClass}
                      />
                    </div>
                    {error && (
                      <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
                        {error}
                      </div>
                    )}
                    <button type="submit" disabled={loading}
                      className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition text-sm mt-1">
                      {loading ? '...' : (isRtl ? 'إرسال رابط إعادة التعيين' : 'Send Reset Link')}
                    </button>
                  </form>
                  <p className="text-center mt-6">
                    <button onClick={() => { setMode('signin'); setError(''); }}
                      className="text-xs text-gray-400 hover:text-gray-600 transition underline underline-offset-2">
                      {isRtl ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
                    </button>
                  </p>
                </>
              )}
            </>
          ) : (
            <>
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
                  <button key={m} type="button"
                    onClick={() => { setMode(m); setError(''); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {m === 'signin' ? (isRtl ? 'دخول' : 'Sign In') : (isRtl ? 'حساب جديد' : 'Sign Up')}
                  </button>
                ))}
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      {isRtl ? 'الاسم الكامل' : 'Full Name'}
                    </label>
                    <input type="text" required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={isRtl ? 'اسمك الكامل' : 'Your full name'}
                      className={inputClass}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {isRtl ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input type="email" required
                    value={form.email} dir="ltr"
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {isRtl ? 'كلمة المرور' : 'Password'}
                    </label>
                    {mode === 'signin' && (
                      <button type="button"
                        onClick={() => { setMode('forgot'); setError(''); }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 transition">
                        {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                      </button>
                    )}
                  </div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return <Suspense><AuthContent /></Suspense>;
}
