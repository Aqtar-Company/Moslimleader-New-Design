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

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const inputCls = "w-full bg-gray-900/60 border border-white/10 focus:border-[#F5C518] rounded-xl px-4 py-3 outline-none text-sm text-white placeholder:text-gray-500 transition";

  // Profile screen
  if (user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 pt-20"
        style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1200 60%, #0a0a0a 100%)' }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="bg-gray-900/80 backdrop-blur border border-white/10 rounded-3xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#F5C518] to-yellow-600 flex items-center justify-center text-gray-900 text-3xl font-black mx-auto mb-4 shadow-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-black text-white mb-1">{user.name}</h2>
          <p className="text-gray-400 text-sm mb-1">{user.email}</p>
          {user.phone && <p className="text-gray-500 text-sm mb-6">{user.phone}</p>}

          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => router.push('/cart')}
              className="w-full border border-[#F5C518]/40 text-[#F5C518] py-3 rounded-xl font-bold hover:bg-[#F5C518]/10 transition text-sm"
            >
              {isRtl ? 'عربة التسوق' : 'My Cart'}
            </button>
            <button
              onClick={() => { signOut(); router.push('/'); }}
              className="w-full bg-red-600/80 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition text-sm"
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
      if (res.error) setError(res.error);
      else router.push('/');
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
      if (res.error) setError(res.error);
      else router.push('/');
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 pt-20 pb-10"
      style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1200 60%, #0a0a0a 100%)' }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* subtle gold glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#F5C518]/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo gold.png"
            alt="Moslim Leader"
            width={140}
            height={56}
            className="h-16 w-auto object-contain drop-shadow-lg"
            unoptimized
          />
        </div>

        {/* Card */}
        <div className="bg-gray-900/80 backdrop-blur border border-white/10 rounded-3xl shadow-2xl p-8">

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-8">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-bold transition ${mode === 'signin' ? 'bg-[#F5C518] text-gray-900' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {isRtl ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-bold transition ${mode === 'signup' ? 'bg-[#F5C518] text-gray-900' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {isRtl ? 'إنشاء حساب' : 'Create Account'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {isRtl ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder={isRtl ? 'اسمك الكامل' : 'Your full name'} required
                  className={inputCls} />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                {isRtl ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com" required className={inputCls} />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {isRtl ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'}
                </label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+20 1xx xxx xxxx" className={inputCls} />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                {isRtl ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute left-3 top-3.5 text-gray-500 hover:text-[#F5C518] transition"
                  aria-label="toggle password">
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

            {error && (
              <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-[#F5C518] text-gray-900 py-3.5 rounded-xl font-black hover:bg-yellow-400 transition text-sm disabled:opacity-50 mt-2 shadow-lg shadow-yellow-900/20">
              {loading
                ? (isRtl ? 'جاري...' : 'Loading...')
                : mode === 'signin'
                  ? (isRtl ? 'دخول' : 'Sign In')
                  : (isRtl ? 'إنشاء الحساب' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
