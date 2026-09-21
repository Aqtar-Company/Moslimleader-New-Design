/**
 * Where a notification leads when it is tapped.
 *
 * This is one function because the answer was written twice and the two copies disagreed.
 * The full notifications page knew that an admin broadcast opens `/tareeq/notices/<id>`;
 * the header's bell panel did not, and fell through to its default — `/tareeq/<postId>`,
 * the permalink of a POST. A broadcast id is not a post id, so the member who opened an
 * official message from the bell was shown a 404 page.
 *
 * `postId` carries different things for different types (a post, a conversation, a
 * broadcast, a product slug), which is exactly why the mapping cannot be a default with
 * exceptions bolted on at each call site.
 */

export interface NotifLinkInput {
  type: string;
  postId?: string | null;
  actorId?: string | null;
}

/** The path to open, or null when this notification leads nowhere. */
export function notificationHref(n: NotifLinkInput): string | null {
  if (n.type === 'message') return n.postId ? `/tareeq/inbox/${n.postId}` : '/tareeq/inbox';
  if (n.type === 'follow' && n.actorId) return `/tareeq/u/${n.actorId}`;
  // An admin broadcast: postId is the broadcast's id, and its page marks it read.
  if (n.type.startsWith('admin_')) return n.postId ? `/tareeq/notices/${n.postId}` : '/tareeq/notices';
  if (n.type === 'perk_new') return '/membership';
  if (n.type === 'product_new') return n.postId ? `/shop/${n.postId}` : '/shop';
  return n.postId ? `/tareeq/${n.postId}` : null;
}
