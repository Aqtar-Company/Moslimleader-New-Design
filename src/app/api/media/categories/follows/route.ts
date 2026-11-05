export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

/** GET — the category ids the viewer follows (empty when signed out). */
export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ ids: [] });
  const rows = await prisma.freeMediaCategoryFollow.findMany({ where: { userId: user.userId }, select: { categoryId: true } });
  return NextResponse.json({ ids: rows.map(r => r.categoryId) });
}
