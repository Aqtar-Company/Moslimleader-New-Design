export const dynamic = 'force-dynamic';

import { getAdminSession, ROLE_PERMISSIONS } from '@/lib/tareeq-admin-auth';

export async function GET(req: Request) {
  try {
    const result = await getAdminSession(req);
    if (!result) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { admin } = result;
    const permissions = ROLE_PERMISSIONS[admin.role] ?? [];

    return Response.json({
      ok: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        totpEnabled: admin.totpEnabled,
        isActive: admin.isActive,
        lastLoginAt: admin.lastLoginAt,
      },
      permissions,
    });
  } catch (err) {
    console.error('[tareeq-admin/me]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
