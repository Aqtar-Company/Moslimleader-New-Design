export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';

// ─── GET /api/tareeq-admin/users/[id] ────────────────────────────────────────

export async function GET(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin(req);
  } catch (e) {
    return e as Response;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        tareeqLastSeen: true,
        tareeqSuspended: true,
        tareeqSuspendedAt: true,
        tareeqSuspendReason: true,
        createdAt: true,
        updatedAt: true,
        tokenVersion: true,
        _count: {
          select: {
            tareeqPosts: true,
            tareeqComments: true,
            tareeqLikes: true,
            tareeqFollowing: true,
            tareeqFollowers: true,
            tareeqReports: true,
            tareeqBans: true,
            tareeqTickets: true,
          },
        },
        tareeqBans: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        tareeqTickets: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ ok: true, user });
  } catch (err) {
    console.error('[tareeq-admin/users/[id] GET]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/tareeq-admin/users/[id] ──────────────────────────────────────

type PatchBody =
  | { action: 'suspend'; reason: string }
  | { action: 'unsuspend' }
  | { action: 'force_logout' };

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin(req);
  } catch (e) {
    return e as Response;
  }

  try {
    const body = (await req.json()) as PatchBody;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, tokenVersion: true },
    });
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (body.action === 'suspend') {
      const { reason } = body;
      if (!reason?.trim()) {
        return Response.json({ error: 'Reason is required for suspension' }, { status: 400 });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: params.id },
          data: {
            tareeqSuspended: true,
            tareeqSuspendedAt: new Date(),
            tareeqSuspendReason: reason,
          },
        }),
        prisma.tareeqBan.create({
          data: {
            userId: params.id,
            type: 'PERMANENT',
            reason,
            bannedBy: admin.id,
            isActive: true,
          },
        }),
      ]);

      await logAudit(admin.id, 'user.suspend', {
        targetType: 'user',
        targetId: params.id,
        details: { reason, userName: user.name },
        ip,
      });

      return Response.json({ ok: true, action: 'suspend' });
    }

    if (body.action === 'unsuspend') {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: params.id },
          data: {
            tareeqSuspended: false,
            tareeqSuspendedAt: null,
            tareeqSuspendReason: null,
          },
        }),
        prisma.tareeqBan.updateMany({
          where: { userId: params.id, isActive: true },
          data: {
            isActive: false,
            liftedBy: admin.id,
            liftedAt: new Date(),
          },
        }),
      ]);

      await logAudit(admin.id, 'user.unsuspend', {
        targetType: 'user',
        targetId: params.id,
        details: { userName: user.name },
        ip,
      });

      return Response.json({ ok: true, action: 'unsuspend' });
    }

    if (body.action === 'force_logout') {
      await prisma.user.update({
        where: { id: params.id },
        data: { tokenVersion: { increment: 1 } },
      });

      await logAudit(admin.id, 'user.force_logout', {
        targetType: 'user',
        targetId: params.id,
        details: { userName: user.name },
        ip,
      });

      return Response.json({ ok: true, action: 'force_logout' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[tareeq-admin/users/[id] PATCH]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
