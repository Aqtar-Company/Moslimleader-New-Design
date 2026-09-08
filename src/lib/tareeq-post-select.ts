/**
 * The embedded original carried by a share.
 *
 * This lives in one place on purpose. It was first added to only some of the queries that
 * feed TareeqCard, so the same share rendered with its author on one screen and as a
 * completely blank card on another (a share with no note has no body of its own — the
 * original IS the body). Every query that selects fields for TareeqCard must spread this.
 *
 * Read paths that need it: /api/tareeq (all branches), the SSR feed (app/tareeq/page.tsx),
 * the category page, the profile page, the permalink page, and bookmarks.
 */
export const SHARED_FROM_SELECT = {
  shareCount: true,
  sharedFromId: true,
  sharedFrom: {
    select: {
      id: true, title: true, content: true, imageUrl: true, videoUrl: true,
      authorName: true, userId: true, createdAt: true, isHidden: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
} as const;

/** Exactly what SHARED_FROM_SELECT returns for `sharedFrom`, before serialisation. */
export interface RawSharedFrom {
  id: string;
  title: string | null;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  authorName: string;
  userId: string | null;
  createdAt: Date;
  isHidden: boolean;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

/** The client-facing shape (matches SharedOriginal in TareeqCard). */
export interface SerializedSharedFrom {
  id: string;
  title: string | null;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  authorName: string;
  userId: string | null;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

/**
 * Strips the internal `isHidden` flag and serialises the date for the client.
 *
 * Returning null for a hidden original matters: otherwise anyone could keep a moderated
 * post visible by sharing it before it was hidden.
 */
export function normalizeSharedFrom(shared: RawSharedFrom | null | undefined): SerializedSharedFrom | null {
  if (!shared || shared.isHidden) return null;
  const { isHidden: _hidden, createdAt, ...rest } = shared;
  return { ...rest, createdAt: createdAt.toISOString() };
}
