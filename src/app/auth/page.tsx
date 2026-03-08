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

  /* ── Profile screen ── */
  if (user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 pt-16" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
          <div className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-[#F5C518] flex items-center justify-center text-2xl font-black text-gray-900 mx-auto mb-5 shadow-md">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-1">{user.name}</h2>
          <p className="text-gray-400 text-sm mb-1">{user.email}</p>
          {user.phone && <p className="text-gray-400 text-sm mb-6">{user.phone}</p>}
          <div className="flex flex-col gap-2 mt-6">
            <button onClick={() => router.push('/cart')}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-700 transition text-sm">
              {isRtl ? 'عربة التسوق' : 'My Cart'}
            </button>
            <button onClick={() => { signOut(); router.push('/'); }}
              className="w-full border border-gray-200 text-gray-500 py-3 rounded-xl font-bold hover:border-gray-400 hover:text-gray-700 transition text-sm">
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
    <div className="min-h-screen flex" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Left panel (decorative, hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-5/12 bg-gray-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* subtle pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#F5C518]/10 to-transparent" />

        <div className="relative z-10 text-center">
          <Image src="/white-Logo.webp" alt="Muslim Leader" width={180} height={72} className="h-20 w-auto object-contain mx-auto mb-10" unoptimized />
          <h2 className="text-white text-2xl font-black leading-snug mb-4">
            {isRtl ? 'معاً نبني قادة الغد' : "Together We Build Tomorrow's Leaders"}
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
            {isRtl
              ? 'منتجات تعليمية وتربوية للأطفال والأسر المسلمة — ألعاب، كتب، قصص وأدوات القرآن'
              : 'Educational products for Muslim children and families — games, books, stories and Quran tools'}
          </p>
          <div className="mt-10 flex justify-center gap-3">
            {['📚', '🎲', '☪️', '✨'].map(e => (
              <span key={e} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg">{e}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Image src="/Logo.webp" alt="Muslim Leader" width={140} height={56} className="h-14 w-auto object-contain" style={{ filter: 'brightness(0)' }} unoptimized />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-black text-gray-900 mb-1">
              {mode === 'signin' ? (isRtl ? 'أهلاً بعودتك' : 'Welcome back') : (isRtl ? 'إنشاء حساب جديد' : 'Create your account')}
            </h1>
            <p className="text-gray-400 text-sm">
              {mode === 'signin'
                ? (isRtl ? 'سجّل دخولك للمتابعة' : 'Sign in to continue')
                : (isRtl ? 'انضم إلى مجتمع مسلم ليدر' : 'Join the Muslim Leader community')}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-7">
            <button onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${mode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {isRtl ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {isRtl ? 'إنشاء حساب' : 'Sign Up'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{isRtl ? 'الاسم الكامل' : 'Full Name'}</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required
                  placeholder={isRtl ? 'اسمك الكامل' : 'Your full name'}
                  className="w-full border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/5 rounded-xl px-4 py-3 text-sm outline-none transition bg-gray-50 focus:bg-white" />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{isRtl ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="example@email.com"
                className="w-full border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/5 rounded-xl px-4 py-3 text-sm outline-none transition bg-gray-50 focus:bg-white" />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{isRtl ? 'رقم الهاتف' : 'Phone'} <span className="text-gray-400 font-normal">{isRtl ? '(اختياري)' : '(optional)'}</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+20 1xx xxx xxxx"
                  className="w-full border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/5 rounded-xl px-4 py-3 text-sm outline-none transition bg-gray-50 focus:bg-white" />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{isRtl ? 'كلمة المرور' : 'Password'}</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  placeholder="••••••••"
                  className={`w-full border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/5 rounded-xl px-4 py-3 text-sm outline-none transition bg-gray-50 focus:bg-white ${isRtl ? 'pl-11' : 'pr-11'}`} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className={`absolute top-3.5 ${isRtl ? 'left-3' : 'right-3'} text-gray-400 hover:text-gray-700 transition`}>
                  {showPw
                    ? <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" /></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-700 text-white py-3.5 rounded-xl font-bold transition text-sm disabled:opacity-50 mt-1">
              {loading
                ? <span className="flex items-center justify-center gap-2"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>{isRtl ? 'جاري...' : 'Loading...'}</span>
                : mode === 'signin' ? (isRtl ? 'تسجيل الدخول' : 'Sign In') : (isRtl ? 'إنشاء الحساب' : 'Create Account')}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            {isRtl ? 'يمكنك الشراء كضيف بدون تسجيل دخول' : 'You can shop as a guest without signing in'}
          </p>
        </div>
      </div>
    </div>
  );
}
