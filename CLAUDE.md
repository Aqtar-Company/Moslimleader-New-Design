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
    invoice-pdf.ts        # PDF invoice generation (pdf-lib, fallback graceful)
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

```bash
cd /home/moslimleader.com/app
git fetch origin main && git reset --hard origin/main
npm ci
npx prisma db push --skip-generate
npm run build
pm2 restart 1 --update-env
pm2 save
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
