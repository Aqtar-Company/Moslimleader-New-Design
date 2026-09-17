/**
 * The client-safe half of `admin-broadcast.ts`: names, limits and validators with no server
 * imports, so the admin compose screen and the member-facing pages can share the exact
 * vocabulary the server validates against.
 */

export const BROADCAST_KINDS = {
  update:       { ar: 'تحديث',  en: 'Update',       icon: '🔄', notifType: 'admin_update' },
  announcement: { ar: 'إعلان',  en: 'Announcement', icon: '📣', notifType: 'admin_announcement' },
  reminder:     { ar: 'تذكير',  en: 'Reminder',     icon: '⏰', notifType: 'admin_reminder' },
  note:         { ar: 'ملاحظة', en: 'Note',         icon: '📝', notifType: 'admin_note' },
} as const;
export type BroadcastKind = keyof typeof BROADCAST_KINDS;
export const BROADCAST_KIND_KEYS = Object.keys(BROADCAST_KINDS) as BroadcastKind[];

export const BROADCAST_AUDIENCES = {
  all:      { ar: 'كل المستخدمين (مسلم ليدر + طريق)', en: 'Everyone' },
  tareeq:   { ar: 'أعضاء طريق فقط',                   en: 'Tareeq members only' },
  shop:     { ar: 'عملاء مسلم ليدر الذين لم يدخلوا طريق', en: 'Shop-only customers' },
  selected: { ar: 'أشخاص محددون',                      en: 'Selected people' },
} as const;
export type BroadcastAudience = keyof typeof BROADCAST_AUDIENCES;
export const BROADCAST_AUDIENCE_KEYS = Object.keys(BROADCAST_AUDIENCES) as BroadcastAudience[];

export const BROADCAST_TITLE_MAX = 160;
export const BROADCAST_BODY_MAX = 4000;
export const BROADCAST_LINK_LABEL_MAX = 80;
export const BROADCAST_SELECTED_MAX = 500;

/** Sender name shown on the in-app row and the push. */
export const BROADCAST_ACTOR_NAME = 'إدارة طريق';

export function isBroadcastKind(v: unknown): v is BroadcastKind {
  return typeof v === 'string' && v in BROADCAST_KINDS;
}
export function isBroadcastAudience(v: unknown): v is BroadcastAudience {
  return typeof v === 'string' && v in BROADCAST_AUDIENCES;
}

/** Only http(s) links, or site-relative paths. Anything else is dropped, never stored. */
export function sanitizeBroadcastLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith('/') && !v.startsWith('//')) return v.slice(0, 500);
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}
