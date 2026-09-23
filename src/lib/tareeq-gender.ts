/**
 * طريق's gender rules, in one file, so no screen invents its own.
 *
 * Three separate things hang off one stored field (`User.tareeqGender`):
 *
 *   1. **Modesty on pictures.** A woman's avatar and cover are blurred for a man.
 *   2. **Who may write to whom**, and what he must state before he does.
 *   3. Nothing else. Gender does not change what a member may post, read or be shown of
 *      the feed — widening it later would be a decision, not an extension.
 *
 * ## The blur is modesty, not security
 *
 * It is a CSS filter. Anyone who opens the browser's developer tools removes it in
 * seconds and sees the original, because the original is what was sent. That is a
 * deliberate choice — the alternative (blurring the bytes on the server) costs processing
 * and a cache, and was weighed and not taken.
 *
 * So it must never be DESCRIBED to a member as protection. «الصور تظهر مشوّشة للرجال» is
 * true; «صورتك محمية» is not, and the difference matters to a woman deciding what to
 * upload. If that promise is ever wanted, the blur has to move to the server first.
 */

export type TareeqGender = 'male' | 'female';

export const TAREEQ_GENDERS: { value: TareeqGender; labelAr: string; labelEn: string }[] = [
  { value: 'male',   labelAr: 'رجل',   labelEn: 'Man' },
  { value: 'female', labelAr: 'امرأة', labelEn: 'Woman' },
];

export function isGender(v: unknown): v is TareeqGender {
  return v === 'male' || v === 'female';
}

/**
 * Should this viewer see this member's pictures blurred?
 *
 * One direction only, as specified: a woman's pictures are veiled from a man. A man's are
 * not veiled from a woman.
 *
 * **An unknown gender on either side counts as unknown, not as permission.** A viewer who
 * has not chosen yet cannot reach طريق at all, so in practice `viewer` is always set; but
 * an OWNER with no gender is ordinary — those are the accounts that predate this field.
 * Their pictures are blurred for men until they say otherwise, because a wrong guess that
 * veils is recoverable and a wrong guess that exposes is not.
 */
export function shouldBlurFor(
  viewerGender: string | null | undefined,
  ownerGender: string | null | undefined,
  viewerId?: string | null,
  ownerId?: string | null,
): boolean {
  // Nobody's own pictures are ever blurred to them.
  if (viewerId && ownerId && viewerId === ownerId) return false;
  if (viewerGender !== 'male') return false;
  return ownerGender !== 'male';   // female, or not yet stated
}

/** Enough to hide features, not enough to hide that a person is there. */
export const BLUR_AVATAR_PX = 6;
export const BLUR_COVER_PX = 14;

export function blurStyle(px: number): React.CSSProperties {
  return {
    filter: `blur(${px}px)`,
    // Without this the blur samples transparent pixels at the edge and leaves a pale halo
    // where the picture should meet its frame.
    transform: 'scale(1.06)',
  };
}

// ─── Who may write to whom ──────────────────────────────────────────────────────────────

/**
 * What a sender states about a recipient of the other gender. Same-gender messages are not
 * asked anything — the question exists because of the mixing, not as a general gate.
 */
export type TareeqRelation = 'spouse' | 'mahram' | 'none';

/**
 * The named ties a member may claim. A claim, not a verified fact: nothing here can be
 * checked, and the design does not pretend otherwise. What it buys is that the claim is
 * SHOWN to the recipient in her own words before she answers, and recorded if she reports
 * it — a false claim becomes evidence rather than a private lie.
 */
export const MAHRAM_TIES_FOR_WOMAN: string[] = [
  'زوجي', 'أبي', 'ابني', 'أخي', 'عمي', 'خالي', 'جدي', 'حفيدي', 'زوج ابنتي', 'أبو زوجي',
];
export const MAHRAM_TIES_FOR_MAN: string[] = [
  'زوجتي', 'أمي', 'ابنتي', 'أختي', 'عمتي', 'خالتي', 'جدتي', 'حفيدتي', 'زوجة ابني', 'أم زوجتي',
];

/** The list the SENDER picks from, phrased from the sender's side. */
export function mahramTiesFor(senderGender: TareeqGender): string[] {
  return senderGender === 'male' ? MAHRAM_TIES_FOR_MAN : MAHRAM_TIES_FOR_WOMAN;
}

export function isMahramTie(senderGender: TareeqGender, tie: string): boolean {
  return mahramTiesFor(senderGender).includes(tie);
}

/** True when the pair needs the declaration at all. */
export function needsRelationDeclaration(
  senderGender: string | null | undefined,
  recipientGender: string | null | undefined,
): boolean {
  if (!isGender(senderGender) || !isGender(recipientGender)) return true; // unknown → ask
  return senderGender !== recipientGender;
}

export const RELATION_LABELS: Record<TareeqRelation, { ar: string; en: string }> = {
  spouse: { ar: 'زوج/زوجة', en: 'Spouse' },
  mahram: { ar: 'من المحارم', en: 'Mahram' },
  none:   { ar: 'ليست صلة قرابة', en: 'Not related' },
};
