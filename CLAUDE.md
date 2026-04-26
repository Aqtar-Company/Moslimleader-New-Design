# Moslim Leader — Project Context for Claude

## Stack
- **Framework:** Next.js 14 (App Router, `force-dynamic` on all API routes)
- **Database:** MySQL via Prisma ORM
- **Auth:** JWT (httpOnly cookie) — `src/lib/jwt.ts`
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Payments:** PayPal SDK + manual bank transfer
- **Email:** Nodemailer via Titan SMTP

## Project Structure

```
src/
  app/
    page.tsx                        # Home / shop
    shop/[slug]/                    # Product detail
    cart/                           # Cart page
    checkout/                       # Checkout flow
    wishlist/                       # Wishlist page
    about/                          # About page
    account/                        # User account
    auth/reset-password/            # Password reset
    invoice/[orderId]/              # Invoice page
    library/                        # Digital library
      page.tsx                      # Book listing
      [id]/page.tsx                 # Book reader (Turnstile + legal overlay + PDF)
      [id]/buy/page.tsx             # Book purchase page
      series/[seriesId]/page.tsx    # Series detail
      series/[seriesId]/buy/        # Series purchase
    admin/                          # Admin panel (no auth middleware)
      dashboard/                    # Stats overview
      products/                     # Physical products CRUD
      orders/                       # Orders list + status
      books/                        # Digital books CRUD + file upload
      book-orders/                  # Digital book purchase orders
      series/                       # Book series management
      users/                        # User management + device reset
      coupons/                      # Coupon codes
      reviews/                      # Product reviews moderation
      shipping/                     # Egypt shipping zones
      intl-shipping/                # International shipping rates
      payment-methods/              # Payment methods config
      regional-pricing/             # Regional price overrides
      settings/                     # Site-wide settings
    api/                            # All API routes (force-dynamic)
  components/
    layout/               # Header, Footer, MobileMenu
    books/                # BookReader (PDF viewer, progress, dark mode)
    product/              # ProductCard
    ui/                   # Toast, etc.
  context/
    AuthContext.tsx        # User session (JWT)
    CartContext.tsx        # Shopping cart
    LanguageContext.tsx    # AR/EN translations — t('key')
    RegionalPricingContext.tsx  # EGP/SAR/USD regional prices
    WishlistContext.tsx    # Wishlist
  lib/
    jwt.ts                # getAuthUser(), sign/verify JWT
    prisma.ts             # Prisma client singleton
    geo-pricing.ts        # Regional price selection logic
    shipping.ts           # Egypt shipping zones
    intl-shipping.ts      # International shipping
    order-email.ts        # Order confirmation email HTML
    invoice-pdf.ts        # PDF invoice generation (puppeteer, fallback graceful)
    paypal.ts             # PayPal SDK helpers
    sanitize.ts           # Input sanitization
    products.ts           # Product query helpers
    admin-config.ts       # Admin constants
    admin-storage.ts      # Admin file storage helpers
    book-age.ts           # Book "new" badge logic
private/
  books/                  # PDF files (gitignored — copy manually to server)
public/
  covers/                 # Book cover images (gitignored — uploaded via admin)
  library-hero.jpg        # Library hero background (gitignored — upload manually)
```

## Key Conventions

- **Translations:** flat key-value via `useLang()` → `t('key')` — both `ar` and `en` in `src/context/LanguageContext.tsx`. Always add new keys to BOTH languages.
- **`isEn` pattern:** `const { lang, isRtl, t } = useLang(); const isEn = lang === 'en';` — never hardcode `const isEn = false`
- **Prices:** regional pricing — Egypt (EGP), Saudi (SAR), International (USD) — `src/context/RegionalPricingContext.tsx`
- **Admin:** no middleware — each admin page checks `user.role === 'admin'` via `getAuthUser()`
- **Book files:** PDFs in `private/books/`, served via `/api/books/[id]/file` (streaming + range support)
- **Book covers:** `public/covers/` (uploaded via admin)
- **Email:** all transactional email uses Titan SMTP via env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- **API routes:** all must have `export const dynamic = 'force-dynamic'` at top

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
- **PM2:** process id `1`, name `moslimleader` — restart with `pm2 restart 1 --update-env`
- **Node:** PM2 fork mode, port 3000, Nginx reverse proxy on 80/443
- **SSL:** Let's Encrypt via Nginx

## Deploy

```bash
cd /home/moslimleader.com/app
git pull origin main
npm run build
pm2 restart 1 --update-env
pm2 save
```

> GitHub Actions CI/CD is configured in `.github/workflows/deploy-vps.yml` but manual deploy is more reliable.

## Claude Code Git Branch

Claude Code cannot push to `main` — always develop on a `claude/` branch and open a PR:
```bash
git checkout -b claude/my-feature-abc123
git push -u origin claude/my-feature-abc123
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

### Manually upload book PDF to server
```bash
scp book.pdf root@SERVER_IP:/home/moslimleader.com/app/private/books/<bookId>.pdf
```

### Manually upload library hero image
```bash
scp library-hero.jpg root@SERVER_IP:/home/moslimleader.com/app/public/library-hero.jpg
```

## Book Reader Flow

1. User opens `/library/[id]`
2. **Legal overlay** appears immediately (full-screen, `z-[100]`) with:
   - `🔒` icon + legal warning text (AR/EN based on `useLang()`)
   - **Cloudflare Turnstile** widget (site key: `0x4AAAAAACzKEGf-IQ39WfSB`)
3. After Turnstile verified → **10-second green countdown** starts with progress bar (always fills left→right via `dir="ltr"`)
4. Countdown text: "جاري فتح الكتاب..." / "Opening the book..."
5. Overlay closes → **BookReader** (PDF) visible underneath
6. Background tracking: IP, device fingerprint, geolocation logged via `/api/books/[id]/track`
7. Session ping every 90s via `/api/books/[id]/session` to detect concurrent logins
8. Reading progress saved via `/api/books/[id]/progress`

## Book Access Control

- Users limited to **2 registered devices** — managed in admin → Users → device list
- Share tokens: `/api/books/[id]/share` generates one-time share links
- Admin can grant access manually: `/admin/book-orders` → grant button

## Known Issues / Watch Out

- **`private/books/`** gitignored — PDFs must be manually copied to server after fresh clone
- **`public/covers/`** gitignored — cover images must be manually copied
- **`public/library-hero.jpg`** gitignored — must be manually uploaded to server
- **puppeteer/chromium warning** at build time is harmless — invoice PDF generation falls back gracefully
- **Prisma `db push`** may warn about data loss on column type changes — review carefully
- **`isEn = false` bug:** never hardcode this — always use `const isEn = lang === 'en'` from `useLang()`
- **Progress bar direction:** always wrap in `dir="ltr"` so it fills left→right regardless of page language
- **`uiLang` prop:** BookReader accepts `uiLang="ar"|"en"` — must be passed from the page or buttons stay Arabic
