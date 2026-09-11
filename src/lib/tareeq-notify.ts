/**
 * The single door every Tareeq notification goes through.
 *
 * Before this, ten call sites each did `prisma.tareeqNotification.create(...)` followed by
 * `sendPushToUser(...)`, both fire-and-forget. That shape is why two things the platform
 * needed were impossible to add:
 *
 *  - **Per-type preferences.** Nine notification types existed and the only control was
 *    all-or-nothing, so anyone annoyed by "someone liked your mark" lost "you have a new
 *    message" along with it. A preference check bolted onto ten sites would have rotted at
 *    the eleventh.
 *  - **Muting.** A mute has to suppress the notification as well as the feed entry, and
 *    there was no one place that knew a notification was about to be sent.
 *
 * So both checks live here, and the call sites just say what happened to whom.
 */
import { prisma } from '@/lib/prisma';
import { sendPushToUser, type PushPayload } from '@/lib/tareeq-push';

/** Every `type` value written to `TareeqNotification`. Reaction kinds are types too. */
export type TareeqNotifType =
  | 'like' | 'inspired' | 'thanks' | 'agree' | 'yarabb' | 'mashaallah'
  | 'comment' | 'subscribed_comment'
  | 'mention' | 'follow' | 'share' | 'message' | 'call'
  | 'post_update' | 'perk_new' | 'product_new' | 'generic';

/**
 * Which preference switch governs each type.
 *
 * Grouped on purpose: the five reaction kinds share one switch, because nobody wants to
 * decide separately about "ألهمه" and "شكره" — they want reactions on or off.
 */
export const NOTIF_GROUP: Record<TareeqNotifType, string> = {
  like: 'reactions', inspired: 'reactions', thanks: 'reactions',
  agree: 'reactions', yarabb: 'reactions', mashaallah: 'reactions',
  comment: 'comments', subscribed_comment: 'comments',
  mention: 'mentions',
  follow: 'follows',
  share: 'shares',
  message: 'messages',
  call: 'calls',
  post_update: 'updates',
  perk_new: 'announcements', product_new: 'announcements', generic: 'announcements',
};

/** The switches, in the order the settings screen shows them. */
export const NOTIF_GROUPS: { key: string; ar: string; en: string }[] = [
  { key: 'reactions',     ar: 'التفاعلات على علاماتي',      en: 'Reactions on my marks' },
  { key: 'comments',      ar: 'التعليقات',                  en: 'Comments' },
  { key: 'mentions',      ar: 'الإشارة إليّ بالاسم',         en: 'Mentions' },
  { key: 'follows',       ar: 'المتابعون الجدد',            en: 'New followers' },
  { key: 'shares',        ar: 'مشاركة علاماتي',             en: 'Shares of my marks' },
  { key: 'messages',      ar: 'الرسائل',                    en: 'Messages' },
  { key: 'calls',         ar: 'المكالمات',                  en: 'Calls' },
  { key: 'updates',       ar: 'تحديثات المنشورات المتابَعة', en: 'Updates on posts I follow' },
  { key: 'announcements', ar: 'إعلانات المنصة',             en: 'Platform announcements' },
];

type Prefs = Record<string, boolean>;

/**
 * Whether the recipient wants this type.
 *
 * Absent preferences, and absent keys inside them, both mean yes — so existing users keep
 * exactly the behaviour they had, and a newly added group is on until someone turns it off.
 * Only an explicit `false` suppresses.
 */
export function wantsNotif(prefs: unknown, type: TareeqNotifType): boolean {
  if (!prefs || typeof prefs !== 'object') return true;
  const group = NOTIF_GROUP[type];
  if (!group) return true;
  return (prefs as Prefs)[group] !== false;
}

/**
 * The preference + mute gate, on its own.
 *
 * `notifyTareeq` is the normal door. Direct messages need this instead because they do not
 * fit its shape: the push is sent on every message (a message is urgent), while the in-app
 * row is throttled to one per five minutes. Same gate, different assembly.
 *
 * Returns false on a DB error — a gate that fails open would deliver notifications the
 * recipient switched off.
 */
export async function shouldNotify(
  userId: string,
  type: TareeqNotifType,
  opts: { actorId?: string | null; postId?: string | null } = {},
): Promise<boolean> {
  const { actorId, postId } = opts;
  if (actorId && actorId === userId) return false;
  try {
    const [recipient, mute] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { tareeqNotifPrefs: true } }),
      actorId || postId
        ? prisma.tareeqMute.findFirst({
            where: {
              muterId: userId,
              OR: [
                ...(actorId ? [{ mutedId: actorId }] : []),
                ...(postId ? [{ postId }] : []),
              ],
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (mute) return false;
    return wantsNotif(recipient?.tareeqNotifPrefs, type);
  } catch {
    return false;
  }
}

export type NotifyInput = {
  /** Recipient. */
  userId: string;
  type: TareeqNotifType;
  actorId?: string | null;
  actorName?: string | null;
  actorAvatarUrl?: string | null;
  postId?: string | null;
  postTitle?: string | null;
  body?: string | null;
  /** Omit to write the in-app notification without a push. */
  push?: PushPayload;
};

/**
 * Writes the notification and sends the push, unless the recipient has switched this type
 * off or muted the actor or the post.
 *
 * Never throws and never blocks the caller's own work: a notification that fails must not
 * fail the like, comment or message that caused it. Callers may `void` this.
 */
export async function notifyTareeq(input: NotifyInput): Promise<void> {
  const { userId, type, actorId, postId, push, ...rest } = input;

  // Notifying yourself is always a bug in the caller, and every call site was guarding
  // against it separately. One guard here.
  if (actorId && actorId === userId) return;

  try {
    const [recipient, mute] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { tareeqNotifPrefs: true } }),
      // One query covers both mute kinds: this person, or this post's thread.
      actorId || postId
        ? prisma.tareeqMute.findFirst({
            where: {
              muterId: userId,
              OR: [
                ...(actorId ? [{ mutedId: actorId }] : []),
                ...(postId ? [{ postId }] : []),
              ],
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (mute) return;
    if (!wantsNotif(recipient?.tareeqNotifPrefs, type)) return;

    await prisma.tareeqNotification.create({
      data: { userId, type, actorId: actorId ?? null, postId: postId ?? null, ...rest },
    });

    if (push) await sendPushToUser(userId, push);
  } catch {
    /* A dropped notification is never worth failing the action that caused it. */
  }
}
