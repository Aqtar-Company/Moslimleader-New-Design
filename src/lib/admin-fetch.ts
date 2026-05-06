// Thin wrapper around fetch() for admin pages. Centralises three things
// every admin page would otherwise re-implement:
//   1. credentials: 'include' so the auth cookie travels under
//      sameSite='none' production config.
//   2. Cache-Control no-store on GETs so admin pages always show fresh data.
//   3. A typed `ForbiddenError` on 403 so callers can render the
//      <ForbiddenState /> component instead of a generic toast.
//
// Use adminFetch() for every admin-page fetch. The `expect403` flag is
// for places where 403 is expected (e.g. probing whether a sensitive
// area is accessible) — pass true to swallow ForbiddenError back into
// a normal Response.

export class ForbiddenError extends Error {
  status = 403 as const;
  constructor(message = 'هذه الصفحة لا تتوفر لك') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  status = 401 as const;
  constructor(message = 'غير مصرح') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export async function adminFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD';
  const headers = new Headers(init.headers);
  if (isMutation && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? (isMutation ? undefined : 'no-store'),
  });
  if (res.status === 401) {
    throw new UnauthorizedError(await safeMessage(res));
  }
  if (res.status === 403) {
    throw new ForbiddenError(await safeMessage(res));
  }
  return res;
}

async function safeMessage(res: Response): Promise<string | undefined> {
  try {
    const cloned = res.clone();
    const data = await cloned.json();
    return typeof data?.error === 'string' ? data.error : undefined;
  } catch {
    return undefined;
  }
}

// Convenience helper: parse the body as JSON, throw a typed Error on
// non-2xx with the server's `error` field as the message. Use this when
// you don't need access to the raw Response.
export async function adminJson<T = unknown>(input: string | URL, init: RequestInit = {}): Promise<T> {
  const res = await adminFetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
      ? (data as { error: string }).error
      : `Request failed with ${res.status}`);
    throw new Error(message);
  }
  return data as T;
}
