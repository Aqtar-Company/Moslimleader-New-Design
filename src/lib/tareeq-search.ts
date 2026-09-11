/**
 * The WHERE fragment for searching posts.
 *
 * It used to be three `contains` clauses, which Prisma emits as `LIKE '%…%'` — and no
 * index in MySQL can serve a leading wildcard, so every search read every row of
 * `TareeqPost`. `@@fulltext([title, content])` now exists in the schema, so the same
 * search can go through `MATCH … AGAINST` instead.
 *
 * Two reasons this is not simply `search:` everywhere:
 *
 *  1. MySQL's fulltext parser treats `+ - > < ( ) ~ * " @` as boolean operators. A user
 *     typing "ما الفرق (بين)؟" would produce a syntax error, not zero results — so the
 *     term is stripped to words first.
 *  2. InnoDB indexes no token shorter than `innodb_ft_min_token_size` (3 by default).
 *     Searching "من" through the index silently matches nothing, where LIKE would have
 *     found it. So short terms keep the old scan: slow, but correct, and rare.
 *
 * `authorName` has no fulltext index and stays on `contains`. It is one short column and
 * the scan it causes is a fraction of scanning every post body.
 */

/** Smallest token InnoDB's fulltext parser will index (`innodb_ft_min_token_size`). */
const MIN_FT_TOKEN = 3;

/** Words only — every fulltext boolean operator removed. */
function toFulltextTerm(raw: string): string | null {
  const words = raw
    .replace(/[+\-><()~*"@\\]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= MIN_FT_TOKEN);
  if (words.length === 0) return null;
  return words.join(' ');
}

export function postSearchWhere(search: string | null | undefined) {
  const term = search?.trim();
  if (!term) return {};

  const ft = toFulltextTerm(term);
  if (!ft) {
    // Short or operator-only term: fall back to the scan rather than return nothing.
    return {
      OR: [
        { title: { contains: term } },
        { content: { contains: term } },
        { authorName: { contains: term } },
      ],
    };
  }

  return {
    OR: [
      { title: { search: ft } },
      { content: { search: ft } },
      { authorName: { contains: term } },
    ],
  };
}
