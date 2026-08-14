export const dynamic = 'force-dynamic';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

export async function GET(req: Request) {
  try {
    await requireAdmin(req, [TareeqAdminRole.SUPER_ADMIN]);
  } catch (e) {
    return e as Response;
  }

  try {
    const admins = await prisma.tareeqAdmin.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        totpEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ ok: true, admins });
  } catch (err) {
    console.error('[tareeq-admin/roles GET]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin(req, [TareeqAdminRole.SUPER_ADMIN]);
  } catch (e) {
    return e as Response;
  }

  try {
    const body = await req.json();
    const { name, email, password, role } = body as {
      name: string;
      email: string;
      password: string;
      role: TareeqAdminRole;
    };

    if (!name || !email || !password || !role) {
      return Response.json({ error: 'name, email, password, role are required' }, { status: 400 });
    }

    const validRoles = Object.values(TareeqAdminRole);
    if (!validRoles.includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const existing = await prisma.tareeqAdmin.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: 'Email already in use' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);

    const newAdmin = await prisma.tareeqAdmin.create({
      data: {
        name,
        email,
        password: hashed,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAudit(admin.id, 'admin.create', {
      targetType: 'admin',
      targetId: newAdmin.id,
      details: { name, email, role },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return Response.json({ ok: true, admin: newAdmin }, { status: 201 });
  } catch (err) {
    console.error('[tareeq-admin/roles POST]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
