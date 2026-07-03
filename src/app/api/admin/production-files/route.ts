export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q')?.trim() ?? '';
  const groupId = searchParams.get('groupId')?.trim() ?? '';
  const latestOnly = searchParams.get('latestOnly') !== 'false';

  const where: Record<string, unknown> = {};
  if (latestOnly) where.isLatest = true;
  if (groupId) where.groupId = groupId;
  if (search) where.title = { contains: search };

  const files = await prisma.productionFile.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ files });
}
