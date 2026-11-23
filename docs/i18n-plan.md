# Adding languages beyond Arabic and English — the plan

Measured with `node ops/i18n-audit.mjs` on 2026-11-23:

- **2,387** strings are written inline as Arabic/English choices (`isEn ? … : …`, `tx(ar, en)`).
- **108** strings are dictionary keys (`t('key')` in `LanguageContext.tsx`).
- A third language cannot be added to an either/or. Each inline choice has to become a key
  first. Until then, a Turkish visitor would get whichever side `isEn` picks.

What already works for any language (done 2026-11-23): the URL scheme (`/en/...`, with
hreflang and canonical from the root layout and middleware), automatic first-visit choice,
live exchange rates per country, and Ameen answering in the visitor's own language.

## Stages (each one shippable on its own)

1. **Dictionary shape.** Move to one file per language per section
   (`messages/<lang>/<section>.json`) and a `useT('section')` hook with fallback
   `<lang> → en → ar`, so a missing Turkish key shows English, never a raw key.
   `Lang` becomes `'ar' | 'en' | 'tr' | …`; RTL comes from a set (`ar`, `ur`), not `lang === 'ar'`.
2. **The buying path first** — what a foreign customer must read to buy:
   `app:checkout` (147), `app:account` (209), `app:shop` + `components:product` (42),
   `app:cart` (10), `app:library` + `components:books` + PayPal buttons (115),
   `app:badge` (52), `app:login` (59), `components:layout` (28). About 660 strings.
3. **Content in the database.** Products and books carry `nameEn`/`descriptionEn` only. Add a
   `translations` JSON column (`{ tr: { name, description } }`) and read it with the same fallback.
4. **The URL for the new language** (`/tr/...`): the middleware's `/en` rule becomes a list of
   prefixes; the root layout's hreflang lists every language; the sitemap emits one twin per language.
5. **Emails** (`order-email.ts`, `auth-email.ts`, `child-birthday.ts`): their copy tables gain
   the new language.
6. **طريق last** (1,300 strings) — the largest section, and on hold for its own changes.

## Rules while converting

- Convert a whole section at a time and re-run the audit; the section's `two-way` count must reach 0.
- Never machine-translate religious text (Qur'an, hadith, du'a) without review by someone
  qualified in that language.
- Arabic stays the default (`x-default`) and the language of the shop's own notifications.
