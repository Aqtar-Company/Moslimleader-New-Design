export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { rememberCountry } from '@/lib/visitor-country';
import { headers, cookies } from 'next/headers';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ user: null }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ user: null }, { status: 401 });
    // Members who signed up before the country was kept get it on their next visit.
    void rememberCountry(user.id, headers(), user);
    // Keep the member's language for mail sent without a request (the birthday greeting).
    const chosen = cookies().get('ml_lang')?.value;
    if ((chosen === 'ar' || chosen === 'en') && user.preferredLang !== chosen) {
      void prisma.user.update({ where: { id: user.id }, data: { preferredLang: chosen } }).catch(() => {});
    }

    // Expose permissions only when the user is staff/admin so customers
    // can't probe the catalogue.
    const isAdminLike = user.role === 'admin' || user.role === 'staff';
    const permissions = isAdminLike ? ((user.permissions as unknown[] | null) ?? []) : [];
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl ?? null,
        savedAddresses: (user.savedAddresses as unknown[]) ?? [],
        role: user.role,
        permissions,
      },
    });
  } catch (err) {
    console.error('[me]', err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
