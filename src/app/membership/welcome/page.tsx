import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { getAuthUser } from '@/lib/jwt';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MembershipWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect('/membership');
  }

  // Verify the welcome token
  type WelcomePayload = { type: string; userId: string; email: string; membershipId: string };
  let payload: WelcomePayload | null = null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-fallback-secret-not-for-production');
    const { payload: p } = await jwtVerify(token, secret);
    if ((p as Record<string, unknown>).type === 'membership-welcome') {
      payload = p as unknown as WelcomePayload;
    }
  } catch {
    // invalid/expired token
  }

  if (!payload) {
    // Token invalid — just go to membership
    redirect('/membership');
  }

  // Check if user is logged in
  const authUser = await getAuthUser().catch(() => null);

  if (authUser && authUser.userId === payload.userId) {
    // Correct user is logged in → go to membership with celebrate flag
    redirect('/membership?celebrate=1');
  }

  if (authUser && authUser.userId !== payload.userId) {
    // Wrong user logged in → show message
    return (
      <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f4ef', padding: '24px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 24px', maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#1a3a2e', fontWeight: 700, marginBottom: 12 }}>حساب مختلف</h2>
          <p style={{ color: '#6b7280', lineHeight: 1.7, marginBottom: 24 }}>
            الرابط مخصص لبريد <strong>{payload.email}</strong>. سجّل خروجاً أولاً ثم ادخل بالبريد الصحيح.
          </p>
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(`/membership/welcome?token=${token}`)}`}
            style={{ display: 'block', padding: '12px 24px', background: '#1a3a2e', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}
          >
            تسجيل الدخول بحساب آخر
          </Link>
        </div>
      </div>
    );
  }

  // Not logged in → redirect to login with redirect back here
  const loginUrl = `/auth/login?redirect=${encodeURIComponent(`/membership/welcome?token=${token}`)}`;
  redirect(loginUrl);
}
