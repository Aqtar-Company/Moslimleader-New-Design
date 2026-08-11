export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAdminSession, ADMIN_COOKIE_NAME } from '@/lib/tareeq-admin-auth';

export async function POST(req: Request) {
  try {
    const result = await getAdminSession(req);

    if (result) {
      // Delete session from DB so it can't be replayed
      await prisma.tareeqAdminSession.delete({
        where: { id: result.session.id },
      }).catch(() => {
        // Already deleted — swallow
      });
    }

    // Clear cookie regardless of whether session was found
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[tareeq-admin/logout]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
