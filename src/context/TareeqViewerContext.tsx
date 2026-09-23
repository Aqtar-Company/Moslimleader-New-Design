'use client';

/**
 * Who is looking — the one place a component asks "should I veil this picture?".
 *
 * Without it, every avatar would need the viewer's gender passed down to it, and the
 * places that render an avatar are not a list anyone keeps: cards, comments, chat bubbles,
 * follower lists, search results, group members. A prop threaded through all of them is a
 * prop that will be forgotten in one of them, and the one place it is forgotten is a
 * woman's picture shown unveiled.
 *
 * The answer is fetched once per session and cached. Until it arrives, `blurFor` returns
 * TRUE for anyone whose gender is not known to be male — the first paint veils and then
 * relaxes, rather than exposing and then covering.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { shouldBlurFor, blurStyle, BLUR_AVATAR_PX } from '@/lib/tareeq-gender';

interface ViewerState {
  /** 'male' | 'female' | null (not stated, or not signed in). */
  gender: string | null;
  /** Still fetching — callers treat this as "veil for now". */
  loading: boolean;
  profileLocked: boolean;
  /** True when this viewer should see that owner's pictures blurred. */
  blurFor: (ownerGender: string | null | undefined, ownerId?: string | null) => boolean;
  /**
   * The same decision as a style object, for the many places that render a plain `<img>`
   * rather than `TareeqAvatarImg` — chat, groups, the post viewers, call screens. Returns
   * `{}` when nothing should be veiled, so it can be spread unconditionally.
   *
   * Spread it LAST: it sets `filter` and a small `transform`, and an existing `transform`
   * on the same element would otherwise win and leave the picture unscaled inside its
   * blur, showing a pale rim.
   */
  veilStyle: (ownerGender: string | null | undefined, ownerId?: string | null) => React.CSSProperties;
  refresh: () => void;
}

const Ctx = createContext<ViewerState>({
  gender: null,
  loading: true,
  profileLocked: false,
  blurFor: () => false,
  veilStyle: () => ({}),
  refresh: () => {},
});

export function TareeqViewerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [gender, setGender] = useState<string | null>(null);
  // Distinguishes "the answer is null" from "we never got an answer". Without it a failed
  // fetch is indistinguishable from a member with no gender — and `shouldBlurFor` reads a
  // null viewer as "not a man" and unveils everything.
  const [known, setKnown] = useState(false);
  const [profileLocked, setProfileLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    // A signed-out visitor is a known state, not a failed one.
    if (!user) { setGender(null); setKnown(true); setLoading(false); return; }
    fetch('/api/tareeq/gender', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { setGender(d?.gender ?? null); setProfileLocked(!!d?.profileLocked); setKnown(true); })
      // A failed request must not open what the feature exists to cover. `known` stays
      // false and every picture keeps its veil until an answer actually arrives.
      .catch(() => { setKnown(false); })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const blurFor = useCallback(
    (ownerGender: string | null | undefined, ownerId?: string | null) => {
      // Until the viewer's own gender has actually been fetched, veil anything not known
      // to be a man's. A signed-out visitor IS a known state (no account, no gender), and
      // veiling everything for every guest would veil it for the women among them too — so
      // this covers the loading and the failed cases only.
      if (loading || !known) {
        if (user && ownerGender !== 'male') return true;
      }
      return shouldBlurFor(gender, ownerGender, user?.id ?? null, ownerId ?? null);
    },
    [gender, loading, known, user?.id],
  );

  const veilStyle = useCallback(
    (ownerGender: string | null | undefined, ownerId?: string | null): React.CSSProperties =>
      (blurFor(ownerGender, ownerId) ? { ...blurStyle(BLUR_AVATAR_PX), overflow: 'hidden' } : {}),
    [blurFor],
  );

  return (
    <Ctx.Provider value={{ gender, loading, profileLocked, blurFor, veilStyle, refresh: load }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTareeqViewer() {
  return useContext(Ctx);
}
