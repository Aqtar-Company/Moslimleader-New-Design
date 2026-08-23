/**
 * Quran Foundation OAuth2 token manager (client_credentials grant).
 * Caches token in memory; auto-refreshes 60s before expiry.
 */

const QF_TOKEN_URL = 'https://auth.quran.foundation/oauth/token';
const QF_CLIENT_ID = process.env.QF_CLIENT_ID ?? '';
const QF_CLIENT_SECRET = process.env.QF_CLIENT_SECRET ?? '';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getQFToken(): Promise<string | null> {
  if (!QF_CLIENT_ID || !QF_CLIENT_SECRET) return null;
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  try {
    const res = await fetch(QF_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: QF_CLIENT_ID,
        client_secret: QF_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[qf-token] token request failed', res.status);
      return null;
    }
    const data = await res.json();
    cachedToken = data.access_token ?? null;
    const expiresIn: number = data.expires_in ?? 3600;
    tokenExpiresAt = Date.now() + expiresIn * 1000;
    return cachedToken;
  } catch (e) {
    console.error('[qf-token]', e);
    return null;
  }
}

export const QF_CLIENT_ID_VALUE = QF_CLIENT_ID;
