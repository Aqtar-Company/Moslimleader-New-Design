# Moslim Leader — Project Context for Claude

## Stack
- **Framework:** Next.js 14 (App Router, `force-dynamic` on all API routes)
- **Database:** MySQL via Prisma ORM
- **Auth:** JWT (httpOnly cookie, `sameSite: 'none'` in production) — `src/lib/jwt.ts`
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Payments:** PayPal SDK (dual buttons: wallet gold + card black) + manual bank transfer
- **Email:** Nodemailer via Titan SMTP
- **OS:** CentOS/RHEL 9 — use `yum`/`dnf`, NOT `apt-get`

## Project Structure

```
src/
  app/
    page.tsx                        # Home — Server Component, fetches products from DB with overrides
    ShopPageClient.tsx              # Home client wrapper — hero slideshow, shop grid, library CTA
    shop/[slug]/                    # Product detail (applies product-overrides for source='static')
    cart/                           # Cart page (coupon auto-apply with 800ms debounce)
    checkout/                       # Checkout flow (PayPal dual buttons)
    wishlist/                       # Wishlist page
    about/                          # About page
    account/                        # User account (saved addresses)
    auth/                           # Login/register (email verification required)
    auth/reset-password/            # Password reset
    verify-email/                   # Email verification landing page
    invoice/[orderId]/              # Invoice page
    library/                        # Digital library
      page.tsx                      # Book listing
      [id]/page.tsx                 # Book reader (Turnstile + legal overlay + image viewer)
      [id]/buy/page.tsx             # Book purchase page (PayPal)
      series/[seriesId]/buy/        # Series purchase (PayPal)
    admin/                          # Admin panel (no auth middleware)
      dashboard/                    # Stats overview
      products/                     # Physical products CRUD
      orders/                       # Orders list + expandable invoice rows
      books/                        # Digital books CRUD + file upload
      series/                       # Book series management
      users/                        # User management + device reset
      coupons/                      # Coupon codes + banner toggle
      reviews/                      # Product reviews moderation
      shipping/                     # Egypt shipping zones
      intl-shipping/                # International shipping rates
      payment-methods/              # Payment methods config
      regional-pricing/             # Regional price overrides
      settings/                     # Site-wide settings
    api/                            # All API routes (force-dynamic)
      orders/guest-notify/          # Guest order email notification (no auth, rate-limited)
      admin/orders/resend-emails/   # Admin: resend email for all DB orders (one-time recovery)
    error.tsx                       # Error boundary (auto-reload on stale Server Action)
    global-error.tsx                # Global error boundary
  components/
    layout/               # Header (coupon banner), Footer, MobileMenu
    books/                # BookReader (image-based viewer, progress, dark mode)
    product/              # ProductCard (variant guard — redirects to product page if variants exist)
    PayPalCheckoutButton  # Dual PayPal buttons for shop checkout
    PayPalBookButton      # Dual PayPal buttons for book/series purchase
    ui/                   # Toast, etc.
  context/
    AuthContext.tsx        # User session (JWT)
    CartContext.tsx        # Shopping cart (refreshCartPrices syncs full product data including images)
    LanguageContext.tsx    # AR/EN translations — t('key')
    RegionalPricingContext.tsx  # EGP/SAR/USD regional prices (originCountryCode persisted in localStorage)
    WishlistContext.tsx    # Wishlist
  lib/
    jwt.ts                # getAuthUser(), sign/verify JWT (sameSite: 'none' in production for PayPal)
    prisma.ts             # Prisma client singleton
    geo-pricing.ts        # Regional price selection logic
    shipping.ts           # Egypt shipping zones
    intl-shipping.ts      # International shipping
    order-email.ts        # Order confirmation email HTML (admin + customer)
    invoice-pdf.ts        # PDF invoice generation — logo embedded as base64, wkhtmltopdf primary
    paypal.ts             # PayPal SDK helpers (create/capture order)
    sanitize.ts           # Input sanitization
    products.ts           # Static product definitions (fallback only — DB overrides take priority)
    admin-config.ts       # Admin constants
    admin-storage.ts      # Admin file storage helpers
    book-age.ts           # Book "new" badge logic
    pdf-renderer.ts       # Server-side PDF→PNG renderer (pdftoppm → gs → pdfjs)
private/
  books/                  # PDF files (gitignored — copy manually to server)
public/
  covers/                 # Book cover images (gitignored — uploaded via admin)
  products/               # Admin-uploaded product images (gitignored)
  library-hero.jpg        # Library hero background (gitignored — upload manually)
  ml-logo-new.png         # Logo used in invoice PDF (must exist on server)
```

## Architecture: Static Products + Overrides

Products have a dual data model:

1. **Static products** — hardcoded in `src/lib/products.ts` (994 lines). These are the BASE data.
2. **Product overrides** — stored in `Setting` table (`key: 'product-overrides'`). Admin changes (prices, images, etc.) are saved here.
3. **DB seeded copies** — when a user adds a static product to cart, `ensureProductInDb` creates a copy in the `Product` table with `source: 'static'`.

**CRITICAL**: All endpoints that load products must merge overrides for `source='static'` products:
```typescript
if (dbProduct.source === 'static') {
  const overrides = getOverrides(dbProduct.id);
  return { ...dbProduct, ...overrides };
}
```

This pattern is applied in:
- `src/app/page.tsx` (SSR server component)
- `src/app/shop/[slug]/page.tsx`
- `src/app/api/products/[slug]/route.ts`
- `src/app/api/admin/products/[id]/route.ts`
- `src/app/api/admin/products/route.ts`

When admin saves a static product, BOTH the override AND the DB copy are updated (`src/app/api/admin/products/[id]/route.ts` PUT handler).

## Key Conventions

- **Translations:** flat key-value via `useLang()` → `t('key')` — both `ar` and `en` in `src/context/LanguageContext.tsx`. Always add new keys to BOTH languages.
- **`isEn` pattern:** `const { lang, isRtl, t } = useLang(); const isEn = lang === 'en';` — never hardcode `const isEn = false`
- **Prices:** regional pricing — Egypt (EGP), Saudi (SAR), International (USD) — `src/context/RegionalPricingContext.tsx`
- **Admin:** no middleware — each admin page checks `user.role === 'admin'` via `getAuthUser()`
- **Book files:** PDFs in `private/books/`, served via `/api/books/[id]/file` (truncated server-side for non-subscribers)
- **Book pages:** rendered server-side as PNG via `/api/books/[id]/page/[num]` — NO PDF reaches the browser
- **Book covers:** `public/covers/` (uploaded via admin)
- **Product images:** admin uploads go to `public/products/` (uploaded via admin)
- **Email:** all transactional email uses Titan SMTP via env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- **API routes:** all must have `export const dynamic = 'force-dynamic'` at top
- **Server OS:** CentOS/RHEL 9 — system packages use `yum install` not `apt-get`
- **Coupon banner:** one coupon can have `showBanner: true` — shows as colored strip above header
- **Variant guard:** ProductCard redirects to product page if `product.variants` exists (no direct add-to-cart)
- **Schema-first rule:** When adding a new Prisma model that code references, the model MUST be in `schema.prisma` in the **same commit**. Code that calls `prisma.someModel` before the model is in the schema will build locally (types already generated) but crash on the server with `Property 'someModel' does not exist on type 'PrismaClient'`.
- **`getProductPrice()` returns PriceResult, not a number:** `src/lib/geo-pricing.ts` → returns `{ price, currency, currencyEn, zone }`. For arithmetic use `.price`; for `formatPrice` spread and override: `{ ...priceResult, price: priceResult.price * qty }`. Never cast to `number`.
- **ISR is forbidden on price/stock pages:** Pages that display prices or real-time stock must use `export const dynamic = 'force-dynamic'`. Never use `export const revalidate = N` — admin price updates are invisible to users for up to N seconds.
- **Never hardcode `ج.م` or `EGP` in price display:** Any component that shows a product price MUST use `useRegionalPricing().getProductPrice()` + `formatPrice()` — not `product.price` directly. Server components that can't use hooks must extract price display into a `'use client'` child component (see `RelatedProductPrice.tsx` pattern).
- **AI chat bot currency:** The `buildLocalPriceBlock(rawProducts, countryCode)` function (`src/lib/assistant-knowledge.ts`) generates a localized price block injected at the TOP of the AI system prompt. This overrides the default EGP prices. The block includes a strict prohibition on mentioning EGP to non-Egyptian customers. For the website chat, `countryCode` comes from `RegionalPricingContext` (client sends it). For Facebook Messenger, it's fetched from the Graph API via `fetchUserCountryCode(psid)` in `src/lib/ai-facebook-assistant.ts`.
- **Invoice PDF logo:** `src/lib/invoice-pdf.ts` reads `public/ml-logo-new.png` from disk at generation time and embeds it as a base64 data URI. Never use an external HTTPS URL for images in wkhtmltopdf — it blocks all external HTTP requests.

## Environment Variables (required)

```env
DATABASE_URL=
JWT_SECRET=
SMTP_HOST=smtp.titan.email
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=live
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAACzKEGf-IQ39WfSB
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Live Server

- **URL:** https://moslimleader.com
- **Path:** `/home/moslimleader.com/app`
- **OS:** CentOS/RHEL 9 (use `yum`/`dnf` for packages)
- **PM2:** process id `1`, name `moslimleader` — restart with `pm2 restart 1 --update-env`
- **Node:** PM2 fork mode, port 3000, Nginx reverse proxy on 80/443
- **SSL:** Let's Encrypt via Nginx
- **Required system packages:** `ghostscript`, `poppler-utils` (for PDF rendering)

## Deploy (manual — recommended)

> **CANONICAL BRANCH:** `main`. As of plan addendum 25's final
> alignment pass, `main` was merged with every commit from
> `claude/add-bosta-shipping-wOtW6`, so the two now share the same
> tip. Deploy from `main` going forward; the feature branch stays
> around as a historical record but no longer carries unique work.
> The schema **does** include `FacebookEvent` (the warning that used
> to live here is obsolete after the merge).

```bash
cd /home/moslimleader.com/app
# Deploy main (now the canonical branch).
git fetch origin main
git reset --hard origin/main
pm2 stop 1                             # stop before npm ci — prevents stale Prisma client window
npm ci
npx tsc --noEmit                       # fail fast on type errors before the long build
npx prisma db push --skip-generate     # If it warns about data loss → STOP and answer N.
npm run build                          # runs prisma generate internally
pm2 start 1 --update-env
pm2 save
```

### Backup before any deploy (run this first)

```bash
# DB dump + uploaded assets snapshot, kept for 30 days.
mkdir -p /root/backups
TS=$(date +%Y%m%d-%H%M%S)
mysqldump --single-transaction --routines moslimleader \
  | gzip > /root/backups/db-$TS.sql.gz
tar czf /root/backups/assets-$TS.tar.gz \
  -C /home/moslimleader.com/app private public/products public/covers .env 2>/dev/null
find /root/backups -type f -mtime +30 -delete
ls -lh /root/backups | tail
```

### Verify sync (server ↔ GitHub)

```bash
# Server's HEAD:
git -C /home/moslimleader.com/app log --oneline -1
# GitHub's HEAD on main:
git ls-remote origin main | awk '{print substr($1,1,7)}'
# These two SHAs MUST match. If they don't → re-run the deploy block.
```

> GitHub Actions CI/CD: `deploy-vps.yml` (SSH to VPS) + `main.yml` (FTP to Hostinger). VPS SSH may fail — manual deploy is more reliable.

## Verify GitHub ↔ Server Sync

```bash
# On server:
git log --oneline -1
# Should match:
# On GitHub: git log --oneline -1 origin/main
```

## Common Tasks

### Add a translation key
Edit `src/context/LanguageContext.tsx` — add to BOTH `ar` and `en` objects.

### Add a new book
1. Upload PDF via admin → `/admin/books` → "رفع ملف"
2. Upload cover image
3. Set `freePages`, `price`, `isPublished = true`

### Check logs
```bash
pm2 logs 1 --lines 50 --nostream
```

### After Prisma schema change
```bash
npx prisma db push --skip-generate
```

### Enable coupon banner
1. Go to `/admin/coupons`
2. Click "عرض" on any coupon → it appears as a colored strip above the header
3. Only one coupon can be banner at a time

### Install system PDF tools (CentOS/RHEL)
```bash
yum install -y poppler-utils ghostscript
```

## Book Reader Flow

1. User opens `/library/[id]`
2. **Legal overlay** appears immediately (full-screen, `z-[100]`) with:
   - `🔒` icon + legal warning text (AR/EN based on `useLang()`)
   - **Cloudflare Turnstile** widget (site key: `0x4AAAAAACzKEGf-IQ39WfSB`)
3. After Turnstile verified → **10-second green countdown** starts with progress bar (always fills left→right via `dir="ltr"`)
4. Countdown text: "جاري فتح الكتاب..." / "Opening the book..."
5. Overlay closes → **BookReader** visible underneath
6. Pages fetched one-by-one as PNG images from `/api/books/[id]/page/[num]`
7. Background tracking: IP, device fingerprint, geolocation logged via `/api/books/[id]/track`
8. Session ping every 90s via `/api/books/[id]/session` to detect concurrent logins
9. Reading progress saved via `/api/books/[id]/progress`

## PDF Security Architecture

Books are protected from download at two levels:

**Level 1 — `/api/books/[id]/file`:**
- Subscribers: full PDF served (for legacy use only)
- Non-subscribers: PDF truncated server-side to `freePages` using `pdf-lib`
- No client-side page limit that can be bypassed

**Level 2 — Image-based viewer (primary):**
- BookReader fetches pages as PNG images: `/api/books/[id]/page/[num]`
- The PDF file never reaches the browser — only one rendered image at a time
- `<img draggable={false}>` + right-click blocked + CSS user-select:none
- Pages rendered server-side by `src/lib/pdf-renderer.ts`

**PDF Renderer (`src/lib/pdf-renderer.ts`):**
- Priority 1: `pdftoppm` (poppler-utils) — best Arabic font support
- Priority 2: `ghostscript` — reliable fallback
- Priority 3: `pdfjs-dist` + `@napi-rs/canvas` — last resort (may show boxes for Arabic)
- In-memory cache: rendered pages cached after first request (fast navigation)
- Requires system packages: `yum install -y poppler-utils ghostscript`

## Book Access Control

- Users limited to **2 registered devices** — managed in admin → Users → device list
- Share tokens: `/api/books/[id]/share` generates one-time share links
- Admin can grant access manually: `/admin/book-orders` → grant button

## Known Issues / Watch Out

- **`private/books/`** gitignored — PDFs must be manually copied to server after fresh clone
- **`public/covers/`** gitignored — cover images must be manually copied
- **`public/products/`** gitignored — admin-uploaded product images must be manually copied
- **`public/library-hero.jpg`** gitignored — must be manually uploaded to server
- **puppeteer/chromium warning** at build time is harmless — invoice PDF generation falls back gracefully
- **Prisma `db push`** may warn about data loss on column type changes — review carefully
- **`isEn = false` bug:** never hardcode this — always use `const isEn = lang === 'en'` from `useLang()`
- **Progress bar direction:** always wrap in `dir="ltr"` so it fills left→right regardless of page language
- **`uiLang` prop:** BookReader accepts `uiLang="ar"|"en"` — must be passed from the page or buttons stay Arabic
- **`serverExternalPackages` is Next.js 15+ only** — in Next.js 14 use `experimental.serverComponentsExternalPackages`
- **pdfjs in Node.js needs system tools** — pdfjs+canvas cannot render Arabic embedded fonts; use pdftoppm/gs instead
- **Server is CentOS/RHEL** — use `yum install` not `apt-get`
- **`BookAccessLog` schema** includes: `country`, `city`, `region`, `latitude`, `longitude` — all nullable
- **Static product overrides** — ALWAYS apply product-overrides for `source='static'` DB products (see Architecture section)
- **SSR timeout** — `page.tsx` getProducts() has 3s timeout; falls back to static products if DB is slow
- **`variantStocks` index shift** — Variant stocks are stored as `{"0": 5, "1": 3}` keyed by variant array index. If a variant is deleted from the middle of the array, all subsequent indices shift and stored stocks become mismatched. Admin must manually re-enter stocks after deleting a middle variant.
- **`wkhtmltopdf` blocks external HTTP** — never use `<img src="https://...">` in invoice HTML. Always embed images as `data:image/png;base64,...` read from `public/` at generation time.

## Bugs Fixed (Reference)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Library page never shows English | `const isEn = false` hardcoded | Use `const isEn = lang === 'en'` from `useLang()` |
| BookReader buttons stay Arabic | `uiLang` prop not passed to `<BookReader>` | Pass `uiLang={isEn ? 'en' : 'ar'}` |
| Progress bar fills wrong direction | No `dir="ltr"` wrapper | Add `dir="ltr"` to progress bar container |
| PDF full download via DevTools | Full PDF sent to browser; client-side limit only | Serve pages as PNG images; truncate PDF server-side with `pdf-lib` |
| Arabic text shows as boxes | `pdfjs` + `@napi-rs/canvas` can't render embedded Arabic fonts | Use `pdftoppm` (poppler-utils) for server-side rendering |
| Product detail shows old price | DB seeded copy has stale price, overrides not applied | Apply product-overrides to `source='static'` in all endpoints |
| Admin edit shows old images | Same as above — DB copy not merged with overrides | Apply overrides in admin `[id]` GET + sync DB on PUT |
| Cart shows old product images | `refreshCartPrices()` only synced price, not images | Now replaces full product object from API |
| Stale Server Action errors | Old JS chunks reference removed Server Action IDs | No-cache headers + error boundary auto-reload |
| PayPal returns "sign in required" | `sameSite: 'lax'` blocks cookie in cross-site PayPal flow | Changed to `sameSite: 'none'` + `secure: true` in production |
| Coupons don't work for non-admin | Cart fetched from admin-only `/api/admin/coupons` | Created public `/api/coupons` endpoint |
| eslint peer dep conflict breaks CI | `eslint@^9` vs `eslint-config-next` requires `^7 \|\| ^8` | Downgraded to `eslint@^8`, regenerated lockfile |
| Home page flash of old images | Client-side initial state from stale `products.ts` | SSR: `page.tsx` fetches products from DB with overrides |
| SMTP hardcoded localhost | Old `nodemailer` config used `localhost:25` | Updated to use `SMTP_HOST/PORT/USER/PASS` env vars |
| Gmail password exposed in code | Forgot-password had hardcoded Gmail app password | Replaced with local postfix / Titan SMTP via env vars |
| Guest orders don't send email | `if (user)` skipped API call + email for guests | Added `/api/orders/guest-notify` endpoint + `else` in checkout |
| Cart cleared before order confirmed | `clear()` called before API response | Moved `clear()` after successful order submission |
| No server-side price verification (COD) | Client sends total/unitPrice unchecked | Server recalculates prices from DB + validates coupon |
| Google OAuth users can't login | `emailVerified` not set on OAuth signup | Set `emailVerified: true` for Google OAuth users |
| No rate limiting on auth endpoints | Login/register/forgot open to brute-force | Added `checkRateLimit` on login (10/15min), register (5/hr), forgot (3/15min) |
| No CSRF protection | `sameSite: 'none'` with no Origin check | Added `middleware.ts` validating Origin header on mutations |
| Admin shipping rates not reflected | Checkout used hardcoded `getShipping()` | Checkout now fetches rates from `/api/shipping-rates` (DB) |
| Selected model wrong in invoice | Off-by-one + missing display | Fixed index (+1) in admin, added model to invoice + email |
| Admin can't change order status | Arabic statuses sent but API validates English | Admin page now uses English values with Arabic display labels |
| SSR XSS via product descriptions | `sanitizeHtml()` returned raw HTML on server | Added regex-based server-side sanitization fallback |
| Book share links unlimited uses | `usedCount` tracked but never enforced | Added max 5 uses per share link |
| Admin books/series body spread | `data: { ...body }` allows any field | Whitelisted allowed fields for Prisma update |
| PayPal N+1 product queries | Each item triggered individual DB query | Batch-fetch all products in single query |
| Book price EGP→USD inconsistent | Used `* 0.10` (1:10) instead of `/ 50` (1:50) | Fixed to consistent `/ 50` rate |
| `isEn` undefined in book buy pages | `useLang()` imported but never called | Added `const { lang } = useLang(); const isEn = lang === 'en';` |
| `prisma.catalogLead` crashes on deploy | `CatalogLead` model added to route but never in `schema.prisma` | Schema-first rule: model + route in same commit; then `npx prisma db push` |
| Catalog shows stale prices after admin update | `revalidate=300` ISR cache on `/catalog/page.tsx` | Changed to `export const dynamic = 'force-dynamic'` |
| TypeScript build error: `PriceResult` not assignable to `number` | `getProductPrice()` returns `{ price, currency, ... }` object, not a number | Use `.price` for math; spread result + override `price` for `formatPrice` |
| `variantStocks` doesn't exist on `MergedProduct` | Field missing from `Product` interface in `src/types/index.ts` | Added `variantStocks?: Record<string, number> \| null \| undefined` |
| Admin catalog-leads page always empty | `/api/admin/catalog-leads/route.ts` didn't exist | Created route with GET (paginated list) + PATCH (update status/orderId) |
| Invoice PDF: logo missing (empty box) | `wkhtmltopdf` blocks external HTTPS image requests — `<img src="https://...webp">` never loads | Read logo from `public/ml-logo-new.png` at generation time, embed as `data:image/png;base64,...` in HTML |
| Invoice PDF: no background colors (white boxes instead of dark header/footer) | `wkhtmltopdf` requires `-webkit-print-color-adjust: exact` + `print-color-adjust: exact` in CSS and `--background` CLI flag | Added both to `src/lib/invoice-pdf.ts` |
| Invoice PDF: CSS gradients not rendering | `wkhtmltopdf`'s WebKit engine renders `linear-gradient` inconsistently | Replaced gradients with solid `#1a1a2e` — reliable across all renderers |
| Production batch exclusion shows "18" not "409" in Zakat | Engine correctly excludes only what's in stock (18 units), but UI had no explanation | Added `excludedItems[]` to `ZakatComputation` interface; UI now shows batch total vs. effective exclusion with warning |
| Production batch: `isOpeningBalance` missing from API response | Field existed in schema but wasn't returned by `GET /api/admin/production/batches` | Added `isOpeningBalance: b.isOpeningBalance` to response map |
| Ameen chat & Facebook bot show EGP prices to Saudi/UAE customers | `buildAssistantContext()` always formatted prices in EGP; AI had no currency directive | Added `buildLocalPriceBlock(rawProducts, countryCode)` injected at TOP of system prompt with strict "⚠️ يُحظر ذكر ج.م" directive; client sends `countryCode` from `RegionalPricingContext` |
| `AmeenProductCard` shows price in EGP regardless of country | Hardcoded `{product.price} ج.م` | Use `useRegionalPricing().getProductPrice()` + `formatPrice()` |
| `RelatedProducts` section shows EGP for all users | Server component hardcoded `p.price` + "ج.م" | Extracted `RelatedProductPrice` client component using `useRegionalPricing()` |
| Facebook bot country detection | No country detection — bot always assumed Egypt | Added `fetchUserCountryCode(psid)` that fetches locale from FB Graph API (`ar_SA` → `SA`), cached in Setting table per-PSID |
