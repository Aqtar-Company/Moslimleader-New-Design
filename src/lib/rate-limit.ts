// Sliding-window in-memory rate limiter (per PM2 process)
const windows = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const prev = windows.get(key) ?? [];
  const recent = prev.filter(t => now - t < windowMs);

  if (recent.length >= maxRequests) {
    const retryAfterMs = windowMs - (now - recent[0]);
    return { allowed: false, retryAfterMs };
  }

  recent.push(now);
  windows.set(key, recent);
  return { allowed: true, retryAfterMs: 0 };
}
