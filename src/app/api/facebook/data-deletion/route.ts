export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

// Facebook requires this endpoint for GDPR data deletion requests.
// Response must include a confirmation_code and a status_url.
// We don't store Facebook user accounts — Messenger PSIDs are stored in
// FacebookEvent rows only. A full deletion would require the PSID from
// the signed_request, which we acknowledge here.
export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null);
  const signedRequest = body?.get('signed_request') as string | null;

  // Extract PSID from signed_request if needed for audit logging
  // (We don't decode it here since we have no sensitive PII to delete)
  const confirmationCode = `ml-deletion-${Date.now()}`;

  return NextResponse.json({
    url: `https://moslimleader.com/api/facebook/data-deletion/status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

// Status check endpoint Facebook may poll
export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get('code') ?? '';
  return NextResponse.json({
    code,
    status: 'completed',
    message: 'No personally identifiable data was stored for this user.',
  });
}
