'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import PayPalBookButton from '@/components/PayPalBookButton';
import { useRouter } from 'next/navigation';

const TEAL   = '#0d6e6e';
const GOLD   = '#d4a843';
const BEIGE  = '#f5f0e8';
const PRICE_USD = 2.00;

interface Props { isLoggedIn: boolean; }

export default function MembershipLanding({ isLoggedIn }: Props) {
  const { isRtl } = useLang();
  const router = useRouter();
  const [familyName, setFamilyName] = useState('');
  const [step, setStep] = useState<'info' | 'pay' | 'done'>('info');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const BENEFITS = isRtl ? [
    { icon: '🪪', text: 'كارت عضوية رقمي مع QR' },
    { icon: '⭐', text: 'رقم عضوية دائم لا يتغير أبداً' },
    { icon: '👨‍👩‍👧‍👦', text: 'تغطي الأسرة بالكامل (حتى 5 أفراد)' },
    { icon: '🎁', text: 'مزايا حصرية للأعضاء' },
    { icon: '🏅', text: 'شارة عضو مجتمع مسلم ليدر' },
    { icon: '♻️', text: 'تجديد سنوي دون تغيير الرقم' },
  ] : [
    { icon: '🪪', text: 'Digital membership card with QR' },
    { icon: '⭐', text: 'Permanent membership number — yours forever' },
    { icon: '👨‍👩‍👧‍👦', text: 'Covers the whole family (up to 5 members)' },
    { icon: '🎁', text: 'Exclusive member benefits' },
    { icon: '🏅', text: 'Moslim Leader Community Member badge' },
    { icon: '♻️', text: 'Annual renewal — same number, extended validity' },
  ];

  function handleProceed() {
    if (!familyName.trim()) { setError(isRtl ? 'أدخل اسم الأسرة' : 'Enter family name'); return; }
    setError('');
    setStep('pay');
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, #0d4f4f 0%, #0a3838 60%, ${TEAL} 100%)`,
      paddingBottom: 60, fontFamily: "'Cairo', sans-serif",
    }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '48px 24px 32px' }}>
        <p style={{ fontSize: 12, letterSpacing: '0.2em', color: 'rgba(245,240,232,0.5)', marginBottom: 8 }}>
          MOSLIM LEADER
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: BEIGE, lineHeight: 1.25, marginBottom: 8 }}>
          {isRtl ? 'عضوية أسرة مسلم ليدر' : 'Moslim Leader Family Membership'}
        </h1>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: GOLD }}>١٠٠</span>
          <span style={{ fontSize: 16, color: 'rgba(245,240,232,0.7)' }}>{isRtl ? 'جنيه / سنة' : 'EGP / year'}</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.5)', marginTop: 6 }}>
          {isRtl ? 'للأسرة بالكامل' : 'For the whole family'}
        </p>
      </div>

      {/* Benefits */}
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '0 20px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {BENEFITS.map((b, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, padding: '14px 12px', display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{b.icon}</span>
              <span style={{ fontSize: 12, color: 'rgba(245,240,232,0.85)', lineHeight: 1.5 }}>{b.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sign up form or PayPal */}
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 20px' }}>
        {!isLoggedIn ? (
          <div style={{ textAlign: 'center' }}>
            <Link href="/login?redirect=/membership"
              style={{
                display: 'block', width: '100%', padding: '16px 0', borderRadius: 16,
                background: GOLD, color: '#1a0f00', fontWeight: 900, fontSize: 16,
                textDecoration: 'none', textAlign: 'center',
              }}>
              {isRtl ? 'سجّل دخولك للانضمام' : 'Sign in to join'}
            </Link>
            <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.4)', marginTop: 12 }}>
              {isRtl ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
              <Link href="/register?redirect=/membership" style={{ color: GOLD }}>
                {isRtl ? 'إنشاء حساب' : 'Register'}
              </Link>
            </p>
          </div>
        ) : step === 'info' ? (
          <div>
            <label style={{ fontSize: 13, color: 'rgba(245,240,232,0.6)', display: 'block', marginBottom: 8 }}>
              {isRtl ? 'اسم الأسرة (يظهر على الكارت)' : 'Family name (shown on card)'}
            </label>
            <input
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder={isRtl ? 'مثال: أسرة إبراهيم حسن' : 'e.g. The Ibrahim Family'}
              style={{
                width: '100%', padding: '13px 14px', borderRadius: 12, fontSize: 15,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
                color: BEIGE, outline: 'none', boxSizing: 'border-box', marginBottom: 14,
              }}
            />
            {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{error}</p>}
            <button onClick={handleProceed}
              style={{
                width: '100%', padding: '15px 0', borderRadius: 16,
                background: GOLD, color: '#1a0f00', fontWeight: 900, fontSize: 16,
                border: 'none', cursor: 'pointer',
              }}>
              {isRtl ? 'متابعة للدفع' : 'Continue to payment'}
            </button>
          </div>
        ) : step === 'pay' ? (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.6)', marginBottom: 4 }}>{isRtl ? 'اسم الأسرة' : 'Family name'}</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: BEIGE }}>{familyName}</p>
            </div>
            <PayPalBookButton
              createEndpoint="/api/membership/create"
              captureEndpoint="/api/membership/activate"
              amountUsd={PRICE_USD}
              isRtl={isRtl}
              createBody={{ familyName: familyName.trim() }}
              onSuccess={() => { setStep('done'); router.refresh(); }}
              onError={msg => setError(msg)}
            />
            {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 10, textAlign: 'center' }}>{error}</p>}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#4ade80', marginBottom: 8 }}>
              {isRtl ? 'مرحباً بك في المجتمع!' : 'Welcome to the community!'}
            </h2>
            <button onClick={() => router.push('/membership')}
              style={{ marginTop: 16, padding: '13px 32px', borderRadius: 14, background: GOLD, color: '#1a0f00', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer' }}>
              {isRtl ? 'عرض كارت العضوية' : 'View membership card'}
            </button>
          </div>
        )}
      </div>

      {/* FOUNDING MEMBER note */}
      <div style={{ maxWidth: 420, margin: '28px auto 0', padding: '0 20px' }}>
        <div style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.25)', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: GOLD }}>
            {isRtl
              ? '✦ أوائل المنضمين يحملون لقب "عضو مؤسس" لمجتمع مسلم ليدر'
              : '✦ Early members carry the "Founding Member" title'}
          </p>
        </div>
      </div>
    </div>
  );
}
