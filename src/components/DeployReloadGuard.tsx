'use client';

import { useEffect } from 'react';
import { isDeployStaleError, tryDeployReload, clearDeployReloadState } from '@/lib/deploy-error';

/**
 * Catches the deploy-stale failures that never reach a React error boundary.
 *
 * A boundary only sees errors thrown while rendering. A chunk that fails to load inside a
 * click handler, or a dynamic import rejected in a promise, lands on `window` instead —
 * and the page simply stops responding, with nothing on screen to say why. That is worse
 * than the error card, because at least the card can be read.
 *
 * It also clears the attempt counter once the app has rendered normally, so a later deploy
 * in the same session starts from three fresh attempts instead of inheriting a spent
 * budget from the previous one.
 */
export default function DeployReloadGuard() {
  useEffect(() => {
    // Reaching here means React mounted, so whatever the last deploy broke is fixed.
    clearDeployReloadState();

    const onError = (e: ErrorEvent) => {
      if (isDeployStaleError(e.error ?? { message: e.message })) tryDeployReload();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isDeployStaleError(e.reason)) tryDeployReload();
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
