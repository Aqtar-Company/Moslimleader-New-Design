export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

// Facebook calls this when a user removes the app from their account.
// We don't store Facebook login sessions, so nothing to delete — just acknowledge.
export async function POST(_req: NextRequest) {
  return NextResponse.json({ ok: true });
}
