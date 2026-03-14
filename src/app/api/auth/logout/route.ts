import { NextResponse } from 'next/server';
import { makeClearCookie } from '@/lib/jwt';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(makeClearCookie());
  return res;
}
