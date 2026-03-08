'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp, user, signOut } = useAuth();
  const { isRtl } = useLang();

  const [mode, setMode] = useState<Mode>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // If already signed in — show profile
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-20 bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center text-white text-3xl font-black mx-auto mb-4">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-1">{user.name}</h2>
          <p className="text-gray-500 text-sm mb-1">{user.email}</p>
          {user.phone && <p className="text-gray-400 text-sm mb-6">{user.phone}</p>}

          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => router.push('/cart')}
              className="w-full border-2 border-gray-900 text-gray-900 py-3 rounded-xl font-bold hover:bg-gray-100 transition text-sm"
            >
              {isRtl ? 'عربة التسوق' : 'My Cart'}
            </button>
            <button
              onClick={() => { signOut(); router.push('/'); }}
              className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition text-sm"
            >
              {isRtl ? 'تسجيل الخروج' : 'Sign Out'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'signin') {
      const res = await signIn(email, password);
      if (res.error) {
        setError(res.error);
      } else {
        router.push('/');
      }
    } else {
      if (!name.trim()) {
        setError(isRtl ? 'الاسم مطلوب' : 'Name is required');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError(isRtl ? 'كلمة المرور 6 أحرف على الأقل' : 'Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const res = await signUp(name.trim(), email, password, phone || undefined);
      if (res.error) {
        setError(res.error);
      } else {
        router.push('/');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 pt-20 pb-10" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="https://moslimleader.com/wp-content/uploads/2024/10/Logo.webp"
            alt="Moslim Leader"
            width={120}
            height={48}
            className="h-14 w-auto object-contain"
            unoptimized
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-md p-8">

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden border-2 border-gray-100 mb-8">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-bold transition ${mode === 'signin' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {isRtl ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-bold transition ${mode === 'signup' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {isRtl ? 'إنشاء حساب' : 'Create Account'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Name (signup only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isRtl ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={isRtl ? 'اسمك الكامل' : 'Your full name'}
                  required
                  className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-3 outline-none text-sm transition"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {isRtl ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-3 outline-none text-sm transition"
              />
            </div>

            {/* Phone (signup only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isRtl ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+20 1xx xxx xxxx"
                  className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-3 outline-none text-sm transition"
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {isRtl ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isRtl ? '••••••••' : '••••••••'}
                  required
                  minLength={6}
                  className="w-full border-2 border-gray-200 focus:border-gray-900 rounded-xl px-4 py-3 outline-none text-sm transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute left-3 top-3.5 text-gray-400 hover:text-gray-700 transition"
                  aria-label="toggle password"
                >
                  {showPw ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-gray-700 transition text-sm disabled:opacity-60 mt-2"
            >
              {loading
                ? (isRtl ? 'جاري...' : 'Loading...')
                : mode === 'signin'
                  ? (isRtl ? 'دخول' : 'Sign In')
                  : (isRtl ? 'إنشاء الحساب' : 'Create Account')
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
