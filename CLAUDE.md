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

# Web push for طريق. Without these there are NO background notifications at all:
# sendPushToUser() returns immediately when the server pair is missing, and the browser
# refuses to subscribe without the public one — and neither path logs anything, so it
# looks identical to "nobody turned notifications on".
# VAPID_PUBLIC_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY MUST be the same value: the browser
# subscribes with the client one and the server signs with the pair. If they differ,
# every send is rejected 403.
# Generate once with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# OPTIONAL. Shared store for طريق's rate limits and presence (src/lib/tareeq-store.ts).
# Everything works without it — it falls back to this process's memory, which is exactly
# what the code did before the variable existed. What it buys:
#   - The 20 Tareeq rate limits survive `pm2 restart`. Without it every deploy resets them.
#   - Presence stops writing User.tareeqLastSeen twice a minute per open chat. That column
#     is on the table the SHOP's sign-in, orders and membership use.
#   - It is the precondition for ever running more than one process: per-process counters
#     would silently multiply every limit.
# Never required. A missing, refused or dying Redis must never take the shop down, and the
# store is written so it cannot.
#   yum install -y redis && systemctl enable --now redis
REDIS_URL=redis://127.0.0.1:6379

# Shared secret for BOTH cron routes — /api/cron/khatmati-reminder and
# /api/cron/fb-follow-up. The variable is CRON_SECRET; the HEADER is `x-cron-key`.
# The two names differ, and getting them the wrong way round leaves both endpoints
# answering 403 in production forever (they fail closed when NODE_ENV=production).
CRON_SECRET=

# OPTIONAL — طريق's own outgoing mailbox for admin broadcasts (src/lib/smtp.ts).
# Set NEITHER and طريق's mail goes out from SMTP_USER, exactly as before.
# TAREEQ_REPLY_TO alone is the safe half: it only changes the Reply-To header and the
# address printed in the email signature. Read at runtime — no rebuild needed.
# The PAIR below additionally changes the FROM address, and only works if that mailbox
# really exists and this password logs into it; a From the domain cannot authenticate is
# the fastest route to the spam folder.
TAREEQ_REPLY_TO=
TAREEQ_SMTP_USER=
TAREEQ_SMTP_PASS=
```

> `NEXT_PUBLIC_*` values are inlined at BUILD time. Changing `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
> in `.env` does nothing until `npm run build` runs again — `pm2 restart` alone will not
> pick it up.

## Live Server

- **URL:** https://moslimleader.com
- **Path:** `/home/moslimleader.com/app`
- **OS:** CentOS/RHEL 9 (use `yum`/`dnf` for packages)
- **PM2:** process id `0`, name `moslimleader` — restart with `pm2 restart 0 --update-env`.
  **PM2 on this server manages more than one project.** As of 2026-09-12 `pm2 list` shows:

  | id | name | project |
  |----|------|---------|
  | 0  | `moslimleader` | this one |
  | 1  | `reels-ui`     | a DIFFERENT project |

  Three consequences, and the second one is the dangerous one:

  1. Always confirm the id with `pm2 list` before using a hardcoded number. This app's id
     already drifted `1`→`0` once.
  2. **Id `1` is now someone else's site.** An old instruction saying `pm2 restart 1` no
     longer fails with "Process 1 not found" — it now succeeds, against the WRONG project.
     Restarting by number is only safe after reading `pm2 list`; restarting by name
     (`pm2 restart moslimleader --update-env`) cannot hit the wrong one at all, and is the
     safer habit.
  3. Never use `pm2 restart all` / `pm2 stop all` / `pm2 delete all` here — they take every
     project on the server with them. `pm2 save` writes the whole list, which is correct:
     both projects come back after a reboot.
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
pm2 stop 0                             # stop before npm ci — prevents stale Prisma client window (confirm id via `pm2 list` first)
npm ci
npx tsc --noEmit                       # fail fast on type errors before the long build
npx prisma db push --skip-generate     # If it warns about data loss → STOP and answer N.
npm run build                          # runs prisma generate internally
pm2 start 0 --update-env
pm2 save
```

> If `pm2 stop <id>`/`pm2 start <id>` prints `[PM2][ERROR] Process <id> not found`, the site keeps running on the OLD build the whole time (build files on disk change, but the live process never reloads them) — run `pm2 list` to find the real id, then `pm2 restart <real-id> --update-env` immediately.

### Daily backup (independent of deploys)

The dump below lives inside the deploy block, which means it only runs when someone pastes
that block. A week with no deploy was a week with no backup. `ops/daily-db-backup.sh` is
the same dump on a schedule:

```bash
cp ops/daily-db-backup.sh /usr/local/bin/moslimleader-db-backup
chmod +x /usr/local/bin/moslimleader-db-backup
( crontab -l 2>/dev/null; echo '30 3 * * * /usr/local/bin/moslimleader-db-backup' ) | crontab -
crontab -l | grep moslimleader-db-backup
```

> **Careful with `crontab` rewrites.** This server's crontab also holds CyberPanel's backup
> jobs, certbot renewal, and another project's Laravel scheduler. A filter like
> `crontab -l | grep -v <pattern> | crontab -` deletes everything the pattern matches —
> that is how the `fb-follow-up` and `khatmati-reminder` lines were lost once. Always run
> `crontab -l` first and read it.

### Backup before any deploy (run this first)

```bash
# DB dump only — 2 MB, cheap enough to take on every deploy.
mkdir -p /root/backups
TS=$(date +%Y%m%d-%H%M%S)
mysqldump --single-transaction --routines moslimleader \
  | gzip > /root/backups/db-$TS.sql.gz
ls -lh /root/backups | tail
```

> **Do NOT re-add `tar czf assets-$TS.tar.gz` to this block.** It was here until
> 2026-09-07 and it is what filled the disk twice. That archive is ~1.5 GB
> (`private/` book PDFs + `public/covers` + `public/products`), and none of it is
> touched by a deploy — those paths are gitignored, so `git reset --hard` cannot
> change them. Snapshotting them per deploy backs up nothing new at 1.5 GB a time.
> Take an assets snapshot by hand when you actually change those files.

**Retention lives in `/etc/cron.daily/disk-cleanup`, and it is capped by COUNT, not by age.**
Age-based retention is what failed, twice — and the second time the script was working
exactly as written:

- `find -mtime +7` means *strictly more than 7 whole days*, floored. Files 7 days and
  18 hours old count as `7`, so `+7` is false and they survive another day.
- Even correct, 7 days × several deploys a day × 1.5 GB is tens of gigabytes — larger
  than the disk. The window can't be the safety net when the artifact is that big.

So the policy is: keep the newest **2** `assets-*.tar.gz` and the newest **20**
`db-*.sql.gz`, with **no age condition at all** — an age condition is also what could
delete the only remaining backup if deploys stop for a while. That caps `/root/backups`
at ~3 GB permanently. The script is kept in the repo at `ops/disk-cleanup.sh` — if it
is missing on a server, install that copy (`cp ops/disk-cleanup.sh
/etc/cron.daily/disk-cleanup && chmod +x /etc/cron.daily/disk-cleanup`) before relying
on retention.

> Incidents: 2026-07-23 (`/root/backups` at 6.7 GB) and 2026-09-07 (17 GB — eleven
> 1.5 GB asset archives, disk at 91%). Same root cause both times.

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
pm2 logs 0 --lines 50 --nostream
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

### تجديد شهادة الأمان (SSL)
السيرفر يشغّل **ليتسبيد ونجينكس معاً** — كلاهما يتنافسان على المنفذ 443. لو تجديد الشهادة فشل أو نجينكس رفض الإقلاع:
```bash
# 1. أوقف ليتسبيد ونجينكس
systemctl stop lsws
# 2. اقتل أي عملية لا تزال تشغل المنفذ 443
fuser -k 443/tcp
# 3. جدّد الشهادة بوضع standalone
certbot certonly --standalone -d moslimleader.com -d www.moslimleader.com --force-renewal
# 4. شغّل نجينكس
systemctl start nginx
```
> لا تستخدم `certbot renew` بدون إيقاف ليتسبيد أولاً — سيفشل لأنه يحاول يعيد تشغيل نجينكس بينما ليتسبيد شايل المنفذ.

### السيرفر عمل ريبوت والمواقع كلها مش بتفتح (حصل 2026-09-15)

سببان اتجمعوا في نفس الوقت، وكل واحد لازم يتفحص لوحده:

1. **`.next/BUILD_ID` مش موجود → PM2 في crash-loop.** بيلد اتقطع (الترمينال قفل في نص
   `npm run build`) فمجلد `.next` كان ناقص. بعد الريبوت PM2 حاول يشغّل `next start` فطلّع
   `Error: Could not find a production build in the '.next' directory` وفضل يعيد المحاولة.
   الفحص: `pm2 logs moslimleader --lines 30 --nostream` + `ls .next/BUILD_ID`.
   العلاج: `pm2 stop moslimleader` ثم `npm run build` ثم `pm2 restart moslimleader --update-env`.
   **قاعدة:** لا تعمل `pm2 restart` أبداً قبل ما تتأكد إن `.next/BUILD_ID` موجود.
2. **ليتسبيد خطف المنفذ 443 قبل نجينكس.** الـunit الحقيقي اسمه `lshttpd` (و`lsws` مجرد alias)،
   والعملية اسمها `litespeed` وبتمسك `[::]:443` (IPv6) فنجينكس بيفشل يقلع.
   `systemctl stop lsws` لوحده ما كفى؛ اللي اشتغل: `systemctl stop lshttpd; pkill -x litespeed`
   ثم `systemctl start nginx`. الفحص: `ss -ltnp | grep 443`.
   **الحل النهائي (2026-09-15): ليتسبيد اتحرّك من 443 إلى 8443.** في
   `/usr/local/lsws/conf/httpd_config.conf` الـlisteners `SSL` و`SSL IPv6` صاروا `*:8443` و
   `[ANY]:8443` (نسخة احتياطية `httpd_config.conf.bak-<timestamp>` جنبه). نجينكس لوحده على 443
   ولا يوجد سباق على المنفذ بعد الريبوت. ليتسبيد لا يزال مفعّلاً (`lshttpd`) بقرار المالك، ومع
   drop-in `/etc/systemd/system/lshttpd.service.d/after-nginx.conf` (`After=nginx.service`)
   كطبقة أمان ثانية. قبل التغيير اتأكدنا إن نجينكس هو اللي بيخدم كل الدومينات
   (kaleemai.com، api.kaleemai.com، waqfelafkar.com، api.waqfelafkar.com)، وإن moslimleader.com
   ما عندوش سجل AAAA — فما كان فيه أي زائر بيوصل لليتسبيد أصلاً. لا تستخدم `fuser -k 443/tcp` في
   تجديد SSL بعد الآن إلا لو `ss -ltnp | grep 443` أظهر عملية غير نجينكس.

### Build بذاكرة أكبر (لو TypeScript نفد منه الذاكرة)
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
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
- **Upload limits are bounded by nginx, not by the app.** `/etc/nginx/conf.d/uploads.conf`
  holds a bare `client_max_body_size 50M;` — no server block, so it is the http-level
  default for every site on this box that does not override it. moslimleader no longer
  relies on it: **as of 2026-09-13 `moslimleader.conf` sets `client_max_body_size 200M;` in
  both of its server blocks (:80 and :443)**, and `.env` carries
  `NEXT_PUBLIC_TAREEQ_MAX_VIDEO_MB=200` to match. (`waqf-api.conf` sets 100M, `reels.conf`
  32m, `solh.conf` 2m for themselves.)

  The number now lives in ONE place, `NEXT_PUBLIC_TAREEQ_MAX_VIDEO_MB`, read by both
  `src/app/api/tareeq/upload/route.ts` and `TareeqCreateModal.tsx` (the client keeps 2MB of
  headroom, because nginx counts the whole multipart body and not just the file). It
  defaults to 50 if unset. **Raising it past nginx is a lie**: nginx answers 413 before the
  route runs, after the phone has sent the entire video, and the uploader sees a bare
  failure. So change nginx first, then the variable.

  Two traps, both hit for real:
  - `NEXT_PUBLIC_*` is inlined at BUILD time. The variable must be in `.env` **before**
    `npm run build`; `pm2 restart` alone will not pick it up.
  - Do NOT find the server block with a pattern like
    `grep/sed '/server_name[^;]*moslimleader/'`. `game-proxy.conf` and `reels.conf` also
    carry moslimleader subdomains in their `server_name`, so that pattern silently raised
    the limit for two OTHER projects. Edit `/etc/nginx/conf.d/moslimleader.conf` by name.
- **Video is re-encoded in the BROWSER, and only when it has to be.** Images are compressed
  twice (canvas in the browser, then sharp on the server, 1920px). Video is uploaded as-is
  unless one of two things is true: it is over the size cap, or the codec will not play for
  everyone (HEVC/AV1, or an unknown-codec `.mov`), decided by `detectVideoCodec()` in
  `src/lib/tareeq-video-compress.ts`. Server-side ffmpeg is not an option — one 250MB
  re-encode takes the CPU for minutes on a box that also runs the shop and two other projects.

  **Two re-encoders exist, and the order matters** (`TareeqCreateModal.tsx`, the video branch
  of `doUpload`):
  1. **`src/lib/tareeq-video-transcode.ts` — WebCodecs via `mediabunny`, the primary path.**
     Demux → decode → scale → encode → mux, with no playback and no wall clock. Measured in a
     real Chromium at ~5× faster than real time with a software encoder; output frames are
     derived from input packets, so a frozen picture with running audio is structurally
     impossible. `mediabunny` is `import()`ed lazily (~100 KB gzip, never in the main
     bundle); it needs no wasm, no SharedArrayBuffer, no COOP/COEP. Output is H.264/MP4 when
     the browser can encode H.264 (plays on iOS), else VP9/VP8 WebM. Audio is COPIED
     packet-for-packet when it can be (AAC→MP4), which is why iOS 16.4–18 works despite its
     WebCodecs having no `AudioEncoder`. **Do not pass `hardwareAcceleration:
     'prefer-hardware'`** — on a device without a hardware session for that codec the encoder
     rejects the config outright and the whole conversion fails at init; the default lets
     the browser choose. **Unverified here:** the H.264 path (this sandbox's Chromium has no
     proprietary codecs) and real iOS — test on a real Android and a real iPhone, including a
     portrait clip, before trusting a change to this file.
  2. **`compressVideo()` in `tareeq-video-compress.ts` — MediaRecorder, the FALLBACK** for
     browsers without WebCodecs (Firefox for Android, iOS < 16.4). It plays the source
     `<video>` in REAL TIME and records a canvas. A two-minute clip takes two minutes, and
     anything that stalls decoding part-way — screen lock, backgrounding, the element off
     screen on Android, a decoder that cannot keep up with a 259MB source — leaves the canvas
     holding one frame while the audio keeps running: a frozen MIDDLE with a normal start
     and end. Mitigations: a wake lock, pausing video+recorder together on
     `visibilitychange`, and a freeze detector sampled on a 500ms WALL-CLOCK timer (not per
     paint — per-paint sampling made refusal automatic on any slow device). **The detector
     WARNS (`onWarning`) and never refuses**: three rounds of refusing guards each blocked a
     real author. Only no-picture-at-all / bigger-than-input still return `null`.
  - **The fallback's picture must be visible while it runs.** Chrome on Android suspends
    frame decoding for an invisible media element — audio keeps playing, frames stop. That
    is why `compressVideo` takes a `mountInto` element and the modal shows a live preview.
    The WebCodecs path has no such requirement.
  - **iPhones record HEVC in a `.mov` by default, and Chrome on Android cannot decode it.**
    Such a file uploads fine, plays fine for the person who posted it, and is a frozen
    picture with working sound for every Android viewer. It cannot be caught by playing the
    file — only by reading the codec out of its bytes, which `detectVideoCodec()` does
    (`hvc1`/`hev1`/`dvh1`/`dvhe`, scanning both ends because `moov` can be at either).
    Such files are re-encoded **regardless of size**, with `acceptLarger` set, because HEVC
    is the more efficient codec and the re-encode usually comes out bigger.
- **Link previews (WhatsApp/Facebook/Telegram…) for طريق posts are served by a dedicated
  route, not the page.** `src/middleware.ts` REWRITES requests whose User-Agent matches
  `UNFURL_BOT` for `/tareeq/<cuid>` to `src/app/tareeq/[id]/preview/route.ts` — ~2 KB of
  og:/twitter: tags, one indexed query, answers in ~50 ms (the full page is ~50 KB and
  WhatsApp's crawler gave up on it and showed only the domain). Verified live:
  `curl -A "WhatsApp/2" https://moslimleader.com/tareeq/<id> -D -` → `x-tareeq-preview: hit`.
  Three things to know:
  - **Matcher trap:** `'/tareeq/:id'` compiled (Next 14.2) to a regexp matching bare
    `/tareeq` only — the param was dropped and the middleware never ran for permalinks.
    Use `'/tareeq/:path*'` and filter with `POST_PATH` in code. Check
    `.next/server/middleware-manifest.json` after any matcher change.
  - A preview miss (post not found / query error) answers **302 to the page with `?_np=1`**;
    the middleware skips the rewrite when `_np` is present (no loop). Drafts/hidden → 404.
    Header `X-Tareeq-Preview: hit | miss:<reason>:id=…` is the diagnostic.
  - **No `<meta http-equiv="refresh">` in the preview.** WhatsApp ignores it; Facebook's
    scraper follows it as a redirect → back to the canonical URL → rewritten to the preview
    again → loop, and the share dialog hangs on "Posting". Body carries a plain link instead.
  - The preview is cached 5 min (`max-age=300`); the tags must stay in step with
    `generateMetadata` in `src/app/tareeq/[id]/page.tsx` (title rule, media choice, guards).
    WhatsApp also caches a preview per URL on the device — test with a fresh link or `?v=2`.
- **Profile avatars and covers live on R2 (`src/lib/r2.ts`), never in `public/`.** The old
  routes wrote to `public/uploads/avatars/` and stored `/uploads/avatars/<file>`; production
  Next.js serves only files present in `public/` at BUILD time, so every photo uploaded after
  a deploy was a broken image (and the directory is neither in the repo nor gitignored).
  Rows that still hold a `/uploads/...` URL render the member's initial via
  `TareeqAvatarImg` (an `<img>` with an onError fallback — use it for every avatar) until
  they re-upload. New objects get a timestamped key per upload, so no `?v=` cache-busting.
- **إعلام المستخدمين (admin broadcasts) lives in `/admin/tareeq` → tab «📣 الرسائل».** One
  message (kind: update / announcement / reminder / note) to an audience (all / Tareeq members /
  shop-only / a hand-picked list ≤ 500) on up to three channels: in-app (`TareeqNotification`
  rows with `type = admin_*` and `postId = <broadcast id>`), web push, email. Everything that is
  not an HTTP handler is in `src/lib/admin-broadcast.ts`; the client-safe vocabulary is in
  `admin-broadcast-shared.ts` (import THAT from components — the other file pulls in Prisma).
  Models: `AdminBroadcast` + `AdminBroadcastRecipient` (one row per user; `status: queued →
  processing → done|failed`; a chunk is CLAIMED as `processing` before anything is delivered
  and every email is recorded on its row as it goes, so a crash mid-chunk never re-sends an
  email on resume — in-app is checked against the notification table, push is not repeated). Member pages: `/tareeq/notices`, `/tareeq/notices/[id]`
  (opening marks read in both the recipient row and the notification rows), and
  `TareeqNoticeBanner` in the shell for the newest unread announcement/update ≤ 7 days.
  Things to know:
  - **Sending is fire-and-forget on the PM2 fork** (`queueBroadcast` then `void runBroadcast`),
    same shape as `campaign-runner.ts`. Email is throttled to ~30/min (`EMAIL_GAP_MS`), push to
    8 concurrent. A restart mid-send leaves the broadcast at `sending` with nothing running it:
    `GET /api/admin/tareeq/broadcasts` (opening the tab) calls `resumeOrphanedBroadcasts()`,
    and `/send` also accepts a `sending` broadcast that is not running in this process. The
    chunk query has NO cursor on purpose — processed rows leave the `queued` filter, and a
    cursor on a row that no longer matches the filter made `skip: 1` drop one real recipient
    per chunk. «إيقاف» sets `status = canceled`; the runner re-reads the status before each
    chunk of 100, and restarts itself if the status went back to `sending` while it was
    winding down (cancel → resume within one chunk).
  - **Preferences:** in-app + push respect the member's «إعلانات المنصة» switch
    (`tareeqNotifPrefs.announcements`), except in-app for a hand-picked list (personal
    correspondence is always delivered). Email respects `marketingOptIn` unless the message is
    marked «رسالة خدمية» (`serviceMessage`, default ON for everything but announcements), and
    ALWAYS requires `emailVerified` (unverified signups are the addresses that bounce). Broad
    audiences exclude `tareeqSuspended` members; a hand-picked list does not. `{{firstName}}`
    is substituted on every channel (`personalize()`), including the notice page. The sender
    shown to members is always `BROADCAST_ACTOR_NAME` («إدارة طريق»), never the admin's name.
    The delivery report shows «—» for a person a switch excluded — that is not a failure.
  - **Audience `tareeq` vs `shop`** is `tareeqLastSeen != null` vs `== null` — "has ever opened
    Tareeq". There is no other signal.
  - **Adding a kind:** `BROADCAST_KINDS` in the shared file, the matching `admin_<kind>` in
    `TareeqNotifType` + `NOTIF_GROUP` (tareeq-notify.ts), the icon/label in
    `TareeqNotificationsClient.tsx`. The notif type string is what the SW/notifications screen
    switch on.
  - **A failed email is retryable, nothing else is re-sent.** `queueBroadcast` puts rows whose
    only failure was the mail (`status: failed` + `emailStatus: failed`) back as
    `processing`, so the chunk treats them as leftovers: the in-app row is checked against
    the notification table instead of written twice, the push is NOT repeated, only the mail
    goes out again. «إعادة محاولة الإيميل» in the history triggers it. A broadcast is only
    marked `failed` when the failing channel was the ONLY channel.
  - **«إيقاف» is checked every 10 emails inside a chunk**, not just between chunks — a chunk
    of 100 mails takes 3½ minutes at the throttle, and a stop must feel like a stop. Rows the
    cut short did not reach keep their `processing` claim for the resume.
  - `sendPushToUser` returns the number of endpoints that ACCEPTED the push (0 when VAPID is
    unconfigured), which is what `pushCount` and the report's ✓ mean. Do not go back to
    treating "we called it" as a delivery — that hid a VAPID key mismatch for weeks.
  - **«الإيميل موصلش» is almost never SMTP.** Three silent gates, in this order: the email
    channel is OFF by default in the composer; a broad audience requires `emailVerified`;
    and a non-service message requires `marketingOptIn`. Each skip now writes its REASON on
    the recipient row (`AdminBroadcastRecipient.error`) and the report prints it in amber —
    a bare «—» was indistinguishable from a bug. A **hand-picked list is exempt from the
    verified-address rule**: the bounce risk that rule guards against is a mass send to
    stale signups, and refusing to write to a person the admin typed the name of is just
    broken. `computeReach` mirrors all of this, including the exemption.
  - **The email wears طريق's identity, not the shop's** (`src/lib/tareeq-email.ts`, NOT
    `email-template.ts`, which is the store's purple "Moslim Leader" shell). Dark header,
    the mark from `public/Tareeq-small.png` by absolute URL, the name «طريق» repeated as
    real text beside it so a blocked image still reads, and a signature naming إدارة طريق
    with a reply address. The from-NAME is «طريق — مسلم ليدر»; the from-ADDRESS stays
    `SMTP_USER`, because SPF/DKIM are published for that mailbox and inventing an
    unauthenticated sender is the fastest route to the spam folder.
  - **Giving طريق its own mailbox is opt-in and needs its own LOGIN.** `src/lib/smtp.ts`
    has `getTareeqTransporter()` / `tareeqFromAddress()` / `tareeqContactAddress()`. Set
    `TAREEQ_SMTP_USER` **and** `TAREEQ_SMTP_PASS` and طريق's mail is sent from that mailbox
    over its own pooled connection (2 connections — the shop's order mail must never queue
    behind a broadcast); set neither and nothing changes. Do NOT put a طريق address in the
    From line while authenticated as `orders@`: Titan generally refuses it, and where it
    does not, DMARC does. `TAREEQ_REPLY_TO` alone (no mailbox login) is the zero-risk half —
    it sets `replyTo` and the address printed in the signature, and is read at runtime, so
    `pm2 restart --update-env` picks it up with no rebuild.
  - Deleting a sent broadcast cascades the recipient rows but keeps the `TareeqNotification`
    rows members already received (a delivered message stays delivered).
- **Chat bubbles: copy, image zoom and the shared-post card.** Three things a chat is
  expected to do that طريق's did not, all in `src/app/tareeq/inbox/[conversationId]/
  TareeqConversationClient.tsx` and mirrored in `groups/[id]/TareeqGroupClient.tsx`:
  - **Copying text was impossible.** The bubble's long press (500ms) and `onContextMenu`
    `preventDefault()` replaced the browser's own selection/copy menu with an action sheet
    that offered only Reply and Delete. Both handlers now bail out when
    `window.getSelection()` is non-empty (so a selection the reader made wins), and the
    sheet carries «نسخ النص» as its FIRST item, with an `execCommand` fallback because
    `navigator.clipboard` is refused in some in-app browsers. A confirmation toast is not
    optional here — a copy has no other visible effect.
  - **An image in a bubble did nothing when tapped.** It is capped at 220px and cropped,
    which is precisely the state in which a photographed page cannot be read. Tapping now
    opens `TareeqImageViewer` (the same full-screen viewer the feed uses).
  - **The shared-post card** is an `<a href>`, but a lingering tap let the 500ms long-press
    timer fire and drop the action sheet on top of the post that had just opened. Its
    `onClick` cancels the pending timer, stops propagation and uses `router.push`.
  Any new tappable thing inside a bubble must cancel `longPressRef` and
  `stopPropagation()`, or the sheet will land on top of it.
- **قرآن نوري's reciters live in `src/lib/quran-reciters.ts`, and they are of TWO kinds.**
  - **`cdn-ayah`** — one file per ayah on `cdn.islamic.network`, keyed by the global ayah
    number (1–6236). The id is an alquran.cloud edition identifier. **Never add or
    "correct" one from memory** — run `ops/check-reciters.sh` ON THE SERVER (the dev
    sandbox has no outbound network) and read the code, because the two failures mean
    opposite things: **404** is a misspelt id, **403** is a correct id whose recitation the
    CDN refuses to serve, and no spelling fixes that. Verified 2026-09-21: عبدالباسط
    عبدالصمد, السديس (both spellings), سعود الشريم, المنشاوي مجود, هاني الرفاعي and
    أيمن سويد all answer 403 and were REMOVED — a name in the picker that plays nothing is
    the bug that was reported twice, and the player could only show it as silence.
  - **`everyayah`** — one file per ayah on `everyayah.com`, keyed by **surah+ayah, three
    digits each** (`002255.mp3`), NOT by the global number the other CDN uses. It exists
    because a different host carries different masters of the same reciter:
    islamic.network has exactly one Husary murattal and one mujawwad, and neither was the
    Egyptian Radio recording that was asked for. `Husary_128kbps` there is that recording.
  - **`page-offset`** — تلاوة د. إبراهيم حسن, recorded one file per mus'haf page at
    `ibrahimquran.com/quran/khatma/{page}.mp3`. An ayah is a measured slice of that file.
    Timings come from the `Aqtar-Company/ibrahim-recitation` repo (commit `534e225`),
    shipped as `public/quran/ibrahim-timings.json` (90KB, ~29KB gzipped) and fetched lazily
    ONLY when that reciter is selected.
  Three rules this design exists to enforce:
  - **5459 of 6236 ayat are timed.** For the rest `resolveAyahAudio()` returns null and the
    page is recited WHOLE with no highlighting, announced by a strip above the controls.
    Do NOT estimate an offset by dividing the file by the ayah count — a guessed position
    highlights the wrong verse, and someone memorising from this screen memorises the error.
  - **`end: null` means "to the end of the file"** (the last ayah on its page), not zero.
    A sliced segment has no native `ended`, so `timeupdate` is what ends it; the whole-file
    case still uses `ended`. Both go through one `onSegmentEnd` guarded by a local flag,
    because `timeupdate` keeps firing after the handler runs.
  - **Pages 504 and 566 are absent from `khatma/`** and are served from the by-surah set
    under names containing SPACES — percent-encode them (`ibrahimPageUrl()` does).
  The player reuses its `<audio>` element while the FILE is unchanged, so ten consecutive
  ayat out of one page file open that file once, and seeks wait for `loadedmetadata`
  (setting `currentTime` before the duration is known silently does nothing).
- **قرآن نوري plays a page-recorded reciter by letting the FILE RUN, not by cutting each ayah.**
  تلاوة د. إبراهيم حسن is one continuous file per mus'haf page. The player used to pause,
  seek and restart on every ayah boundary even while reading straight through that one
  file, and paid twice for a boundary it never needed to touch: a seam in a recitation
  recorded without one, and the NEXT ayah's first letter left in the previous ayah's tail —
  reported as «بيكرر أول حرف مرتين» in سورة الطور, and true of all 4924 boundaries, not
  that one. The cause is in the data: every `start` in `ayah-timings.json` is a
  forced-alignment ESTIMATE that runs late (worst on واو العطف, الفاء and a surah's
  opening), and the file publishes each `end` as the next ayah's `start`, so there is no
  gap to absorb the error.
  - A continuous reading now runs the file uncut and only moves the highlight, comparing
    the clock against the measured boundaries (`pageRunRef` + `boundariesRef` in
    `QuranReader.tsx`). This is why the same numbers sound right in a mus'haf app: there
    the number moves a highlight and nothing cuts.
  - Slicing is kept for the only two cases that need a cut — repeating an ayah, and
    starting at one the reader tapped. `ALIGNMENT_LAG = 0.15` in `quran-reciters.ts` shifts
    BOTH edges back for those. Shifting both preserves the duration, so no short ayah is
    trimmed to nothing; moving only `end` (the obvious fix) eats the shortest ayat.
  - A run also requires EVERY ayah of the page to be timed — a missing boundary would
    strand the highlight while the recitation moved on, so such a page is sliced. And
    turning repeat on mid-run re-enters `playFromRef` at once, because a run has no
    per-ayah end at which to notice it.
- **No Quran audio is stored by us. The browser fetches each page from `ibrahimquran.com`.**
  Nothing of this recitation is in the repo or on the server — `public/quran/` holds only
  the 90KB timings file. That is deliberate WHILE the audio is still being revised: a
  corrected file is live for every listener the moment it is replaced there, with nothing
  to copy or deploy. `NEXT_PUBLIC_IBRAHIM_AUDIO_BASE` switches the player to our own R2
  when that settles (build-time value — `pm2 restart` will not pick it up).
  - **What that arrangement cannot do is notice.** The per-ayah offsets are measured against
    those exact bytes, so replacing a page's audio moves every boundary on it. No request
    fails and nothing is logged — the highlight simply lands on the wrong verse, and whoever
    memorises from that screen memorises the error.
  - `ops/ibrahim-audio-sync.mjs` is what notices: it records each page's size/Last-Modified/
    ETag by HEAD alone (3.6 GB must never be downloaded to be checked) and on the next run
    names the pages that changed — exactly the pages whose timings must be re-measured with
    `tools/snap_cuts.py` in `Aqtar-Company/ibrahim-recitation`. Its state lives in
    `/var/lib/moslimleader`, OUTSIDE the working tree, because a deploy's `git reset` would
    otherwise lose it and every page would read as new. Cron: `17 4 * * *`. `--mirror`
    copies changed pages to R2 under `quran/ibrahim/`.
  - **The upstream repo publishes the rule that causes this**, and as of commit `12a37ea`
    its `data/` is UNCHANGED — only the tool and the docs were corrected. So every consumer
    of that repository still carries the defect, and a fix there reaches nobody
    automatically: a copied JSON is a static copy. Ours is `public/quran/ibrahim-timings.json`
    from `534e225`.
- **The reciters that answer 403 are gone for good, and `Husary_128kbps` is NOT the Egyptian
  Radio master.** Checked by ear 2026-09-21 against every per-ayah Husary that exists —
  everyayah (5 sets), `verses.quran.com` (404 on all three names; quran.com's own API
  resolves its «محمود خليل الحصري» to `everyayah/Husary_64kbps`, i.e. the same recording
  most apps serve), `islamic.network/ar.husary`, and mp3quran's `husr/` (حفص عن عاصم مرتل,
  whole-surah files). None was it. The picker therefore carries the plain label «مرتل» and
  does not claim الإذاعة المصرية — a name that promises what the audio does not keep is its
  own bug. `ops/husary-ayah-candidates.sh` reprints the whole comparison.
- **طريق sends its own mail from `tareeq@moslimleader.com`.** `TAREEQ_SMTP_USER` +
  `TAREEQ_SMTP_PASS` are set and verified. When that login failed with `535 5.7.8` the
  cause was neither the password nor the mailbox: `.env` held the variable TWICE, and the
  two readers disagree — `ops/check-tareeq-mail.sh` prints the FIRST match (`grep | head -1`)
  while the Node parser uses the LAST. The printed length was right and the connection used
  the wrong line. **Rewrite such a line by filtering the old ones out first**
  (`grep -vE '^(VAR1|VAR2)=' .env > .env.new`), never by appending, and check the count.
  `ops/try-tareeq-login.sh` separates a bad password from a mangled file by prompting for it
  instead of reading the file.
- **96% of the `User` table is not a mailing list — it is phone numbers.** Measured
  2026-09-21: of 2142 rows, **2056 hold an address the shop invented** —
  `manual-01xxxxxxxxx@imported.local` (2043) and `guest-…@guest.moslimleader.com` (13). A
  manually entered order and a guest checkout each need a User row, a row needs an email,
  so one is generated from the phone number. It is a key column. `.local` is a reserved TLD
  and never resolves.
  - **Every list that gets mailed must pass through `isSyntheticEmail` (`src/lib/real-email.ts`)
    first**, and never through a clever behavioural criterion instead. The criterion tried
    here was "holds a DELIVERED order, so a human read a confirmation at that address" —
    which selected 1777 of these rows, because those parcels were delivered against a PHONE.
    Sending would have bounced every message at once, which is the exact harm the staged
    batches existed to prevent. It was stopped by hand at the first batch.
  - **The real numbers are healthy, and the alarming ones were an artefact of the row
    count.** Of the 86 genuine addresses: 69 verified (**80%**) and 22 opted into marketing
    (**26%**). Read against 2142 those become 3.2% and 1.0%, which reads as a broken
    verification flow. It is not broken. Compute every such ratio against the real
    addresses — `ops/check-email-reach.mjs` prints the split before anything else.
  - So طريق's email audience is **86 people**, and it grows with signups, not with a
    cleanup campaign. The other 2056 are reachable by phone, and that is a different
    channel, not a worse address.
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
| `StockMovement.create` missing required fields | Code written from memory without reading schema — `stockBefore` + `stockAfter` are non-nullable in DB | **Rule: always read schema for any existing model before writing a `.create()` call** |
| `logActionSafe` template literal fails TypeScript | `return.${action}` produces `string`, not the strict `AuditAction` union — new action keys not added to `AUDIT_ACTIONS` | **Rule: every new `logActionSafe` call needs its action key added to `AUDIT_ACTIONS` in `src/lib/audit-log.ts` first** |
| `Coupon.create` wrong fields | Used `type`, `value`, `maxUses`, `usedCount` — none exist; actual field is `discount` | **Rule: read `prisma/schema.prisma` for the exact model before calling `.create()` on any existing model** |
| Community membership reverts to grey on desktop refresh | `account/page.tsx` has its OWN copy of membership logic separate from `MembershipDashboard` — `communityAcknowledged` was hardcoded `useState(false)`, no localStorage read, no `tier` field in state, "اكتفِ" button didn't call API or save localStorage | Added `tier` to state type; init `communityAcknowledged` lazily from localStorage; after fetch set it from `d.membership?.tier === 'community'`; "اكتفِ" now calls `/api/membership/community-choice` + saves localStorage; card condition checks `membership.tier === 'community'` first |
| `membership/page.tsx` passes membership prop without `tier` field | Server component constructed the prop object manually and omitted `tier` → `isCommunityTier` always `undefined` in `MembershipDashboard` | Always include ALL DB fields when constructing props from Prisma result — never cherry-pick only the fields you remember |
| Admin activating a community member shows "نشط + مجتمعية" contradiction | Admin PATCH only updated `status`, not `tier` — community-tier member manually set to ACTIVE remained `tier='community'` | Admin PATCH to ACTIVE now also sets `tier='leader'`; admin badge shows "رائدة" (gold) for leader tier and "مجتمعية" (green) for community tier |
| "ليس عندي امكانية تعديل اي منشور" | `PUT /api/tareeq/[id]` existed but NO UI called it from the feed (the ⋯ sheet offered only delete while its tooltip promised "تعديل أو حذف"); the only editor was a grey link on the post page, gated to **1 hour** | ⋯ sheet now has "تعديل المنشور" → `/tareeq/[id]?edit=1` opens the editor; window is **24h for authors, unlimited for admins**; the PUT route also accepts `category` (no UI for it yet). The PUT minimum-content rule mirrors create: media posts and shares may have an empty caption. **Rule: the window lives in TWO places that must match — the PUT route and `TareeqPostClient.tsx` (`EDIT_WINDOW_MS`)** |
| Video posts had no title, no default cover, no way to pick a cover frame | Composer never had a `title` field although model/route/card supported it; `videoThumb` (first-frame data URL) was preview-only and never uploaded, so `thumbnailUrl` was null unless the author uploaded an image | Title input in the composer; first frame auto-uploaded as the default cover (`autoThumbUrl`, sent as `thumbnailUrl` when no custom cover); "اختر غلافاً من الفيديو" strip of 6 frames captured from the local file. `TareeqVideo` now draws a large centred play button + duration badge until playback starts |
| Video post shared to WhatsApp shows no thumbnail; on Facebook shows the text card instead of the video cover | `generateMetadata` in `src/app/tareeq/[id]/page.tsx` selected only `imageUrl` — never `thumbnailUrl`/`videoUrl` — so every video post fell through to the generated satori PNG; WhatsApp's scraper gives up on a slow/large PNG, Facebook rendered a paragraph. Titles were also `slice(0, 60)` mid-word («...تف») | og:image = the post's media: `imageUrl`, else the video's `thumbnailUrl` (absolute URL, no fake 1200×630 declaration), `og:type` `video.other` for videos. Text-only posts keep the generated card. Titles/descriptions cut at a word boundary (`cutAtWord`) in both the metadata and the card. **Rule: any new media field a post can carry must be added to that `select` or shares silently degrade to the text card** |
| **Dual membership implementation rule** | The project has TWO places that render membership UI: `src/app/membership/MembershipDashboard.tsx` (full page) and `src/app/account/page.tsx` (tab inside account). Any logic change to one MUST be mirrored in the other. Fields added to the membership state type in one must be added to the other. | Check BOTH files whenever touching membership logic |
