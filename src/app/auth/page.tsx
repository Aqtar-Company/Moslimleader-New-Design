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

  const inputCls =
    'w-full bg-black/80 border border-white/10 focus:border-white rounded-xl px-4 py-3 outline-none text-sm text-white placeholder:text-gray-500 transition';
  const labelCls = 'block text-xs font-bold text-black/60 mb-1.5 uppercase tracking-wide';

  /* ── Profile screen ── */
  if (user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 pt-20"
        style={{ background: 'linear-gradient(160deg,#F5C518 0%,#e8b800 100%)' }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="bg-black rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-[#F5C518] flex items-center justify-center text-gray-900 text-3xl font-black mx-auto mb-4 shadow-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-black text-white mb-1">{user.name}</h2>
          <p className="text-gray-400 text-sm mb-1">{user.email}</p>
          {user.phone && <p className="text-gray-500 text-sm mb-6">{user.phone}</p>}
          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => router.push('/cart')}
              className="w-full bg-[#F5C518] text-black py-3 rounded-xl font-black hover:bg-yellow-300 transition text-sm"
            >
              {isRtl ? 'عربة التسوق' : 'My Cart'}
            </button>
            <button
              onClick={() => { signOut(); router.push('/'); }}
              className="w-full border border-white/10 text-gray-300 py-3 rounded-xl font-bold hover:bg-white/5 transition text-sm"
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
      if (!name.trim()) { setError(isRtl ? 'الاسم مطلوب' : 'Name is required'); setLoading(false); return; }
      if (password.length < 6) { setError(isRtl ? 'كلمة المرور 6 أحرف على الأقل' : 'Password must be at least 6 characters'); setLoading(false); return; }
      const res = await signUp(name.trim(), email, password, phone || undefined);
      if (res.error) setError(res.error);
      else router.push('/');
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 pt-20 pb-10"
      style={{ background: 'linear-gradient(160deg,#F5C518 0%,#e8b800 100%)' }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* subtle texture overlay */}
      <div className="pointer-events-none fixed inset-0" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(0,0,0,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />

      <div className="w-full max-w-md relative z-10">

        {/* Logo on yellow bg — use dark filter */}
        <div className="flex justify-center mb-8">
          <Image
            src="/Logo.webp"
            alt="Muslim Leader"
            width={160}
            height={64}
            className="h-16 w-auto object-contain"
            style={{ filter: 'brightness(0)' }}
            unoptimized
          />
        </div>

        {/* Black card */}
        <div className="bg-black rounded-3xl shadow-2xl p-8">

          {/* Welcome text */}
          <p className="text-center text-[#F5C518] text-xs font-bold uppercase tracking-widest mb-5">
            {isRtl ? 'مرحباً بك' : 'Welcome'}
          </p>

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-7">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-bold transition ${mode === 'signin' ? 'bg-[#F5C518] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {isRtl ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-bold transition ${mode === 'signup' ? 'bg-[#F5C518] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {isRtl ? 'إنشاء حساب' : 'Create Account'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {mode === 'signup' && (
              <div>
                <label className={labelCls} style={{ color: '#aaa' }}>{isRtl ? 'الاسم الكامل' : 'Full Name'}</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder={isRtl ? 'اسمك الكامل' : 'Your full name'} required className={inputCls} />
              </div>
            )}

            <div>
              <label className={labelCls} style={{ color: '#aaa' }}>{isRtl ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com" required className={inputCls} />
            </div>

            {mode === 'signup' && (
              <div>
                <label className={labelCls} style={{ color: '#aaa' }}>{isRtl ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'}</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+20 1xx xxx xxxx" className={inputCls} />
              </div>
            )}

            <div>
              <label className={labelCls} style={{ color: '#aaa' }}>{isRtl ? 'كلمة المرور' : 'Password'}</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  className={`${inputCls} ${isRtl ? 'pl-12' : 'pr-12'}`} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-3.5 text-gray-500 hover:text-[#F5C518] transition`}
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
              <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-[#F5C518] text-black py-3.5 rounded-xl font-black hover:bg-yellow-300 transition text-sm disabled:opacity-50 mt-1 shadow-lg">
              {loading
                ? (isRtl ? 'جاري...' : 'Loading...')
                : mode === 'signin'
                  ? (isRtl ? 'دخول' : 'Sign In')
                  : (isRtl ? 'إنشاء الحساب' : 'Create Account')}
            </button>
          </form>
        </div>

        {/* bottom hint */}
        <p className="text-center text-black/50 text-xs mt-5 font-medium">
          {isRtl ? 'يمكنك الشراء كضيف بدون تسجيل' : 'You can shop as a guest without signing in'}
        </p>
      </div>
    </div>
  );
}
