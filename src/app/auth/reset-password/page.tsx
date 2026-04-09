'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { lang } = useLang();
  const { refreshUser } = useAuth();
  const isRtl = lang === 'ar';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const inputClass = 'w-full bg-gray-50 border border-gray-200 focus:border-gray-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition text-gray-900 placeholder:text-gray-400 text-sm';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(isRtl ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isRtl ? 'حدث خطأ' : 'An error occurred'));
        return;
      }
      setSuccess(true);
      await refreshUser?.();
      setTimeout(() => router.push('/'), 2000);
    } catch {
      setError(isRtl ? 'حدث خطأ في الاتصال' : 'Connection error');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <p className="text-red-500 text-lg font-bold">{isRtl ? 'رابط غير صالح' : 'Invalid link'}</p>
          <button onClick={() => router.push('/auth')} className="mt-4 text-gray-600 underline text-sm">
            {isRtl ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Left panel */}
      <div className="hidden lg:relative lg:block lg:w-1/2 bg-gray-900 overflow-hidden shrink-0">
        <Image src="/sign-in.jpg" alt="" fill className="object-cover object-center" unoptimized />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">
                {isRtl ? 'تم تغيير كلمة المرور!' : 'Password Changed!'}
              </h2>
              <p className="text-gray-500 text-sm">
                {isRtl ? 'سيتم تحويلك للصفحة الرئيسية...' : 'Redirecting to home page...'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-black text-gray-900">
                  {isRtl ? 'تعيين كلمة مرور جديدة' : 'Set New Password'}
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  {isRtl ? 'أدخل كلمة المرور الجديدة' : 'Enter your new password'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      required minLength={6}
                      value={password} dir="ltr"
                      onChange={e => setPassword(e.target.value)}
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

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {isRtl ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required minLength={6}
                    value={confirm} dir="ltr"
                    onChange={e => setConfirm(e.target.value)}
                    placeholder={isRtl ? 'أعد كتابة كلمة المرور' : 'Repeat password'}
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
                  {loading ? '...' : (isRtl ? 'تغيير كلمة المرور' : 'Change Password')}
                </button>
              </form>

              <p className="text-center mt-6">
                <button onClick={() => router.push('/auth')}
                  className="text-xs text-gray-400 hover:text-gray-600 transition underline underline-offset-2">
                  {isRtl ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordContent /></Suspense>;
}
