export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { computeReach, isBroadcastAudience } from '@/lib/admin-broadcast';

async function requireAdmin() {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  return user;
}

// GET /api/admin/tareeq/broadcasts/audience?audience=all|tareeq|shop|selected&ids=a,b,c
// Live reach for the compose screen: how many people, how many with a push device, how
// many opted in to promotional email.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const audience = url.searchParams.get('audience');
  if (!isBroadcastAudience(audience)) return NextResponse.json({ error: 'الجمهور غير صالح' }, { status: 400 });
  const ids = (url.searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);

  const reach = await computeReach(audience, ids);
  return NextResponse.json(reach);
}
