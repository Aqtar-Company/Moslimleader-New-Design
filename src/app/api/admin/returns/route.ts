export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

// GET /api/admin/returns — list return requests
export async function GET(req: NextRequest) {
  const guard = await requirePerm(['orders.read']);
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = 30;

  const where = status ? { status } : {};
  const [total, requests] = await Promise.all([
    prisma.returnRequest.count({ where }),
    prisma.returnRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        order: { select: { id: true, total: true, currency: true } },
        user: { select: { name: true, email: true, phone: true } },
      },
    }),
  ]);

  return NextResponse.json({ requests, total, page });
}
