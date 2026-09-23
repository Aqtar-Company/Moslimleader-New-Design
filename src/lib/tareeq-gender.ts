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
 * ## This is a default, not a promise
 *
 * None of it is described to members anywhere in the UI, and that is the rule, not an
 * omission. It is how طريق conducts itself — a floor for the case where someone does not
 * keep it themselves — and the moment it is announced it becomes something people rely on.
 *
 * They could not safely rely on it: the blur is a CSS filter, so the original is what was
 * sent and developer tools reveal it in seconds. That trade was made deliberately (blurring
 * the bytes on the server costs processing and a cache), and it is exactly why the
 * behaviour stays unannounced. A woman decides what to upload on the strength of what she
 * has been told; telling her nothing leaves her judgement her own, while telling her the
 * picture is covered would be a claim this code cannot keep.
 *
 * If it should ever become a promise, the blur moves to the server FIRST, and the copy
 * second.
 */

/**
 * What kind of account this is — the field answers "who or what is this", not only
 * "man or woman".
 *
 * `org` is a company, an institution, a charity, a shop: an account that is not a person. None
 * of the modesty reasoning applies to it in either direction — there is no face to veil
 * and no kinship to declare with an institution — so it is exempt from both rules rather
 * than being squeezed into one of the two human answers.
 *
 * It is a value of the same stored field, not a new column. The field already travels with
 * every payload that carries a picture, and adding a second one to all of them is the
 * plumbing that has gone wrong twice.
 */
export type TareeqGender = 'male' | 'female' | 'org';

export const TAREEQ_GENDERS: { value: TareeqGender; labelAr: string; labelEn: string; hintAr?: string; hintEn?: string }[] = [
  { value: 'male',   labelAr: 'رجل',   labelEn: 'Man' },
  { value: 'female', labelAr: 'امرأة', labelEn: 'Woman' },
  { value: 'org',    labelAr: 'جهة',   labelEn: 'Organisation',
    hintAr: 'شركة أو مؤسسة أو جمعية — حساب لكيان لا لشخص',
    hintEn: 'A company, institution or charity — an account for an entity, not a person' },
];

export function isGender(v: unknown): v is TareeqGender {
  return v === 'male' || v === 'female' || v === 'org';
}

/** True for the two answers the modesty rules are actually about. */
export function isPerson(v: unknown): v is 'male' | 'female' {
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
  /**
   * People this viewer is never veiled from. Two kinds, and both are about the default
   * having nothing to add:
   *
   *  - **The platform's own admins.** An official account is identified by its picture,
   *    and veiling it makes the platform look like it is hiding from its members.
   *  - **Anyone this viewer already has a conversation with.** A father who was messaging
   *    his daughter before this existed did not need a modesty default between them, and
   *    applying one retroactively reads as an accusation. Two people who already
   *    correspond have settled the question themselves; the default is for strangers.
   */
  exempt?: ReadonlySet<string> | null,
): boolean {
  // Nobody's own pictures are ever blurred to them.
  if (viewerId && ownerId && viewerId === ownerId) return false;
  if (ownerId && exempt?.has(ownerId)) return false;
  // An organisation has no face to veil, and its page is meant to be found.
  if (ownerGender === 'org') return false;
  if (viewerGender !== 'male') return false;
  return ownerGender !== 'male';   // female, or not yet stated
}

/**
 * Enough to lose the features, not enough to lose that a person is there.
 *
 * Lowered from 6/14. At 6px a 28px avatar in a comment row was not veiled, it was a smear
 * — the blur radius was a quarter of the picture. The amount that hides a face depends on
 * how large the face is drawn, so it scales with the element instead of being one number
 * for a 28px circle and a 96px one.
 */
export const BLUR_AVATAR_PX = 4;
export const BLUR_COVER_PX = 10;

/**
 * The blur for an avatar of a given rendered size. Roughly 7% of the width, held between
 * 2 and 6 px: below 2 nothing is hidden, above 6 nothing is left.
 */
export function blurPxForSize(px?: number): number {
  if (!px || !Number.isFinite(px)) return BLUR_AVATAR_PX;
  return Math.max(2, Math.min(6, Math.round(px * 0.07 * 10) / 10));
}

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

/**
 * The list the SENDER picks from, phrased from the sender's side. Empty for an
 * organisation, which is never asked — see `needsRelationDeclaration`.
 */
export function mahramTiesFor(senderGender: TareeqGender): string[] {
  if (senderGender === 'org') return [];
  return senderGender === 'male' ? MAHRAM_TIES_FOR_MAN : MAHRAM_TIES_FOR_WOMAN;
}

export function isMahramTie(senderGender: TareeqGender, tie: string): boolean {
  return mahramTiesFor(senderGender).includes(tie);
}

/**
 * True when the pair needs the declaration at all — i.e. when both are known and differ.
 *
 * An unknown gender does NOT trigger the question, and the asymmetry with `shouldBlurFor`
 * (where unknown does mean veil) is deliberate. Veiling a picture wrongly costs a moment
 * of oddness; demanding a kinship declaration wrongly costs a real conversation and reads
 * as nonsense — a man asked «ما صلتك بـ<male name>؟», with «زوجتي، أمي، أختي» to choose
 * from. Most rows in this database have never stated a gender and never will (they are
 * phone-import rows for manual orders), so "unknown → ask" would make the absurd case the
 * common one.
 */
export function needsRelationDeclaration(
  senderGender: string | null | undefined,
  recipientGender: string | null | undefined,
): boolean {
  // There is no kinship to declare with an institution, in either direction.
  if (!isPerson(senderGender) || !isPerson(recipientGender)) return false;
  return senderGender !== recipientGender;
}

export const RELATION_LABELS: Record<TareeqRelation, { ar: string; en: string }> = {
  spouse: { ar: 'زوج/زوجة', en: 'Spouse' },
  mahram: { ar: 'من المحارم', en: 'Mahram' },
  none:   { ar: 'ليست صلة قرابة', en: 'Not related' },
};
