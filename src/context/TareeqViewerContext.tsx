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
import { shouldBlurFor } from '@/lib/tareeq-gender';

interface ViewerState {
  /** 'male' | 'female' | null (not stated, or not signed in). */
  gender: string | null;
  /** Still fetching — callers treat this as "veil for now". */
  loading: boolean;
  profileLocked: boolean;
  /** True when this viewer should see that owner's pictures blurred. */
  blurFor: (ownerGender: string | null | undefined, ownerId?: string | null) => boolean;
  refresh: () => void;
}

const Ctx = createContext<ViewerState>({
  gender: null,
  loading: true,
  profileLocked: false,
  blurFor: () => false,
  refresh: () => {},
});

export function TareeqViewerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [gender, setGender] = useState<string | null>(null);
  const [profileLocked, setProfileLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user) { setGender(null); setLoading(false); return; }
    fetch('/api/tareeq/gender', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { setGender(d?.gender ?? null); setProfileLocked(!!d?.profileLocked); })
      .catch(() => { /* keep whatever we had; blurFor errs toward veiling */ })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const blurFor = useCallback(
    (ownerGender: string | null | undefined, ownerId?: string | null) => {
      // A signed-out visitor is nobody in particular — the rule is about men seeing women,
      // and an unknown viewer is not established to be a man. Veiling everything for every
      // guest would also veil it for the women among them.
      if (loading) return gender !== 'female' && ownerGender !== 'male';
      return shouldBlurFor(gender, ownerGender, user?.id ?? null, ownerId ?? null);
    },
    [gender, loading, user?.id],
  );

  return (
    <Ctx.Provider value={{ gender, loading, profileLocked, blurFor, refresh: load }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTareeqViewer() {
  return useContext(Ctx);
}
