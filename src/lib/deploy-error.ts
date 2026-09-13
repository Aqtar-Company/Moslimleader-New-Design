/**
 * Telling "the site is being updated" apart from "something broke".
 *
 * A deploy replaces every hashed JS chunk on disk. Any tab that was already open is still
 * holding HTML that names the OLD chunks, so the moment it needs one — a navigation, a
 * lazily loaded component, a Server Action — the fetch 404s and React throws. The user did
 * nothing wrong and nothing is broken; the files simply moved thirty seconds ago.
 *
 * Showing "حدث خطأ غير متوقع" for that is wrong twice over: it alarms someone whose only
 * mistake was having the tab open during a deploy, and it hides the one instruction that
 * actually fixes it.
 */

/** Error shapes Next/webpack produce when a chunk is gone, across browsers and versions. */
const DEPLOY_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk .* failed/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,          // Safari
  /'text\/html' is not a valid JavaScript MIME type/i, // a 404 HTML page served as a script
  /Failed to find Server Action/i,
  /Server Actions/i,
  /Server Action.*not.*found/i,
];

export function isDeployStaleError(error: unknown): boolean {
  const err = error as { message?: unknown; name?: unknown; digest?: unknown } | null;
  const haystack = [
    String(err?.message ?? ''),
    String(err?.name ?? ''),
    String(err?.digest ?? ''),
  ].join(' ');
  return DEPLOY_PATTERNS.some(re => re.test(haystack));
}

const ATTEMPT_KEY = 'ml-deploy-reload-attempts';
const LAST_KEY = 'ml-deploy-reload-ts';
/** Beyond this we stop reloading and let the user decide — a build can outlast us. */
const MAX_AUTO_RELOADS = 3;

/**
 * Reloads once to pick up the new build, and returns whether it is going to.
 *
 * Bounded on purpose. Reloading during the minute a build is still writing files gets the
 * same failure again, and an unbounded retry turns a slow deploy into an infinite refresh
 * loop that is worse than the error screen. After three tries the caller shows the
 * "still updating" panel with a manual button.
 */
export function tryDeployReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const attempts = Number(sessionStorage.getItem(ATTEMPT_KEY) || '0');
    const last = Number(sessionStorage.getItem(LAST_KEY) || '0');
    const now = Date.now();

    if (attempts >= MAX_AUTO_RELOADS) return false;
    // Spacing grows with each attempt: 2s, 6s, 12s. A build takes a minute or two, so
    // hammering it immediately just burns the three attempts in six seconds.
    const wait = [0, 2000, 6000][attempts] ?? 6000;
    if (now - last < wait) return false;

    sessionStorage.setItem(ATTEMPT_KEY, String(attempts + 1));
    sessionStorage.setItem(LAST_KEY, String(now));
    setTimeout(() => window.location.reload(), wait);
    return true;
  } catch {
    // Private mode with sessionStorage blocked: reload once rather than never, since
    // without storage there is no loop to guard against beyond this single call.
    return false;
  }
}

/** Called once the app has rendered normally, so the next deploy starts from zero. */
export function clearDeployReloadState(): void {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY);
    sessionStorage.removeItem(LAST_KEY);
  } catch { /* blocked */ }
}
