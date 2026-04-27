'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type State = 'loading' | 'success' | 'error' | 'resent';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    if (email) setResendEmail(email);

    if (!token) {
      setState('error');
      setErrorMsg('رابط التحقق غير صحيح.');
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setState('success');
          setTimeout(() => router.push('/account'), 3000);
        } else {
          setState('error');
          setErrorMsg(data.error || 'فشل التحقق.');
        }
      })
      .catch(() => {
        setState('error');
        setErrorMsg('حدث خطأ في الاتصال.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResend() {
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState('resent');
      } else {
        setErrorMsg(data.error || 'فشل الإرسال.');
      }
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">

        {state === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-gray-600 text-lg">جاري التحقق من بريدك الإلكتروني...</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">تم التحقق بنجاح!</h2>
            <p className="text-gray-600 mb-2">تم تفعيل حسابك. سيتم توجيهك تلقائياً...</p>
            <button
              onClick={() => router.push('/account')}
              className="mt-4 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded-lg transition"
            >
              الذهاب إلى حسابي
            </button>
          </>
        )}

        {(state === 'error') && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">فشل التحقق</h2>
            <p className="text-gray-600 mb-6">{errorMsg}</p>

            {resendEmail && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">هل تريد إرسال رابط تحقق جديد إلى <span className="font-medium">{resendEmail}</span>؟</p>
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-bold py-2 px-6 rounded-lg transition w-full"
                >
                  {resendLoading ? 'جاري الإرسال...' : 'إعادة إرسال رابط التحقق'}
                </button>
              </div>
            )}

            {!resendEmail && (
              <div className="space-y-2">
                <label className="text-sm text-gray-600 block">أدخل بريدك الإلكتروني لإعادة الإرسال:</label>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  dir="ltr"
                />
                <button
                  onClick={handleResend}
                  disabled={resendLoading || !resendEmail}
                  className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-bold py-2 px-6 rounded-lg transition w-full"
                >
                  {resendLoading ? 'جاري الإرسال...' : 'إرسال رابط التحقق'}
                </button>
              </div>
            )}

            <button
              onClick={() => router.push('/auth')}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline block"
            >
              العودة لصفحة الدخول
            </button>
          </>
        )}

        {state === 'resent' && (
          <>
            <div className="text-6xl mb-4">📧</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">تم إرسال الرابط</h2>
            <p className="text-gray-600 mb-4">تحقق من صندوق الوارد في بريدك الإلكتروني وافتح رابط التحقق.</p>
            <button
              onClick={() => router.push('/auth')}
              className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              العودة لصفحة الدخول
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>;
}
