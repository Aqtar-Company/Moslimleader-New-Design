export const dynamic = 'force-dynamic';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({})) as {
    token?: string;
    password?: string;
  };

  if (!token || !password) {
    return Response.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: 'كلمة المرور قصيرة جداً (8 أحرف على الأقل)' }, { status: 400 });
  }

  const admin = await prisma.tareeqAdmin.findUnique({ where: { resetToken: token } });

  if (!admin || !admin.resetTokenExpiry || admin.resetTokenExpiry < new Date()) {
    return Response.json({ error: 'الرابط منتهي الصلاحية أو غير صحيح' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);

  await prisma.tareeqAdmin.update({
    where: { id: admin.id },
    data: { password: hash, resetToken: null, resetTokenExpiry: null },
  });

  // Invalidate all active sessions
  await prisma.tareeqAdminSession.deleteMany({ where: { adminId: admin.id } });

  return Response.json({ ok: true });
}
