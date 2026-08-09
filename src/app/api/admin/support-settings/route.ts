export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { getSupportSettings, updateSupportSettings } from '@/lib/support-system';

export async function GET() {
  const user = await getAuthUser();
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getSupportSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const updated = await updateSupportSettings(body, user.userId, user.role);
  return NextResponse.json({ settings: updated });
}
