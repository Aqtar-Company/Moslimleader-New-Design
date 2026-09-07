/**
 * `@[Full Name]` is the wire format for mentioning someone who has no @handle — the
 * brackets are what let the parser read past the space in their name. They are not meant
 * to be seen, so strip them anywhere the text is rendered or previewed.
 *
 * Kept deliberately dumb (no linkification): it must stay safe to call on raw user text.
 */
export function displayMentions(text: string): string {
  return text.replace(/@\[([^\]\n]{1,60})\]/g, '@$1');
}
