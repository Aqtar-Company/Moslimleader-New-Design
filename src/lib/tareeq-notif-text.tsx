'use client';

/**
 * What a notification SAYS — one copy, for the bell panel, the mobile sheet and the
 * notifications page.
 *
 * ## Why one copy
 *
 * The wording was written three times, and only one of them knew every type. The bell
 * panel named eight types and dropped everything else into «رسالة من فلان» beside an
 * envelope — so a mention in a comment, a reply on a thread you follow, an update to a post,
 * a missed call and the «ماشاء الله» reaction all announced a private message that did not
 * exist. The member opened the inbox and found nothing. That is the report: «بيقول رسالة
 * من فلان ولما أدخل مفيش حاجة».
 *
 * The notifications PAGE had already been corrected (its fallback comment records the same
 * mistake), and the correction never reached the bell. Two copies drift; one cannot.
 *
 * ## The vocabulary, so it is deliberate rather than accidental
 *
 * - رسالة / message   — ONLY a private message (`type: 'message'`). These never appear in
 *                       the bell at all: they have their own badge on the envelope icon.
 * - علامة / mark      — a post. طريق calls a post a mark («اترك علامة»).
 * - علّق / ذكرك / تعليق جديد — the three comment-shaped events, told apart: on YOUR mark,
 *                       naming YOU, on a mark you FOLLOW.
 * - the five reactions each keep their own verb; «تفاعل» is the generic only when the kind
 *   is unknown.
 * - A type this file does not know is shown as «إشعار من فلان» — never as a message.
 */
import type { ReactNode } from 'react';

export interface NotifTextInput {
  type: string;
  actorName?: string | null;
  postTitle?: string | null;
  body?: string | null;
}

export interface NotifWording {
  /** The sentence, with the actor and the mark's title already in it. */
  text: string;
  /** A one-line preview to show under it (a comment's text, a post's snippet), if any. */
  preview?: string | null;
  /** For admin broadcasts: the small kind label («تحديث», «إعلان»…). */
  badge?: string | null;
}

export function notifWording(n: NotifTextInput, isRtl: boolean): NotifWording {
  const actor = n.actorName || (isRtl ? 'شخص ما' : 'Someone');
  const title = n.postTitle ? `«${n.postTitle}»` : '';
  const on = (ar: string, en: string) => (isRtl ? ar : en);
  const body = n.body || null;

  switch (n.type) {
    // ── reactions on a mark of yours ─────────────────────────────────────────────
    case 'like':       return { text: on(`${actor} أعجب بعلامتك ${title}`, `${actor} liked your mark ${title}`) };
    case 'inspired':   return { text: on(`${actor} ألهمته علامتك ${title} ⭐`, `${actor} was inspired by your mark ${title} ⭐`) };
    case 'thanks':     return { text: on(`${actor} شكرك على علامتك ${title} 🙏`, `${actor} thanked you for your mark ${title} 🙏`) };
    case 'agree':      return { text: on(`${actor} اتفق معك في علامتك ${title} ✊`, `${actor} agreed with your mark ${title} ✊`) };
    case 'yarabb':     return { text: on(`${actor} قال يارب على علامتك ${title} 🤲`, `${actor} said Yarabb on your mark ${title} 🤲`) };
    case 'mashaallah': return { text: on(`${actor} قال ماشاء الله على علامتك ${title} 🌴`, `${actor} said Masha'Allah on your mark ${title} 🌴`) };

    // ── the three comment-shaped events, told apart ──────────────────────────────
    case 'comment':            return { text: on(`${actor} علّق على علامتك ${title}`, `${actor} commented on your mark ${title}`), preview: body };
    case 'mention':            return { text: on(`${actor} ذكرك في تعليق على ${title}`, `${actor} mentioned you in a comment on ${title}`), preview: body };
    case 'subscribed_comment': return { text: on(`${actor} علّق على علامة تتابعها ${title}`, `${actor} commented on a mark you follow ${title}`), preview: body };

    case 'share':       return { text: on(`${actor} شارك علامتك 🔁`, `${actor} shared your mark 🔁`), preview: body };
    case 'follow':      return { text: on(`${actor} بدأ متابعتك`, `${actor} started following you`) };
    case 'post_update': return { text: on(`${actor} أضاف تحديثاً على ${title}`, `${actor} posted an update on ${title}`), preview: body };
    case 'call':        return { text: on(`مكالمة فائتة من ${actor} 📞`, `Missed call from ${actor} 📞`) };

    // ── the ONE thing that is a message ──────────────────────────────────────────
    case 'message':     return { text: on(`رسالة جديدة من ${actor}`, `New message from ${actor}`), preview: body };

    // ── platform ─────────────────────────────────────────────────────────────────
    case 'perk_new':    return { text: on('✨ ميزة جديدة في عضويتك', '✨ New membership benefit'), preview: body };
    case 'product_new': return { text: on('🛍️ منتج جديد في المتجر', '🛍️ New product in the store'), preview: body };
  }

  if (n.type.startsWith('admin_')) {
    const badge = n.type === 'admin_update' ? on('تحديث', 'Update')
      : n.type === 'admin_announcement' ? on('إعلان', 'Announcement')
      : n.type === 'admin_reminder' ? on('تذكير', 'Reminder')
      : on('ملاحظة', 'Note');
    return { text: n.postTitle || actor, preview: body, badge };
  }

  // Unknown kind: say what it is — a notification — and never promise a message.
  return { text: on(`إشعار من ${actor}`, `Notification from ${actor}`), preview: body };
}

/** The wording as JSX: sentence, optional badge before it, optional muted preview under it. */
export function NotifText({ n, isRtl, previewClassName, previewStyle }: {
  n: NotifTextInput;
  isRtl: boolean;
  previewClassName?: string;
  previewStyle?: React.CSSProperties;
}): ReactNode {
  const w = notifWording(n, isRtl);
  return (
    <span>
      {w.badge && (
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full me-1.5 align-middle" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}>{w.badge}</span>
      )}
      {w.badge ? <span className="font-bold">{w.text}</span> : w.text}
      {w.preview && (
        <span className={previewClassName ?? 'block text-xs mt-0.5 truncate'} style={previewStyle ?? { color: 'var(--tr-text-muted)' }}>{w.preview}</span>
      )}
    </span>
  );
}
