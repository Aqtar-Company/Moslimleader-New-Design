# Moslim Leader — Project Context for Claude

## Stack
- **Framework:** Next.js 14 (App Router, `force-dynamic` on all API routes)
- **Database:** MySQL via Prisma ORM
- **Auth:** JWT (httpOnly cookie) — `src/lib/jwt.ts`
- **Styling:** Tailwind CSS
- **Language:** TypeScript

## Project Structure

```
src/
  app/
    page.tsx              # Shop (home page)
    library/              # Digital library
      page.tsx            # Book listing
      [id]/page.tsx       # Book reader (Turnstile + legal overlay + PDF)
      [id]/buy/page.tsx   # Book purchase page
    admin/                # Admin panel (no auth middleware — checks role in each page)
    api/                  # All API routes (force-dynamic)
  components/
    layout/               # Header, Footer, MobileMenu
    books/                # BookReader component (PDF viewer)
    product/              # ProductCard
    ui/                   # Toast, etc.
  context/                # React contexts (Cart, Auth, Lang, Wishlist, RegionalPricing)
  lib/                    # Utilities (jwt, prisma, shipping, geo-pricing, etc.)
private/
  books/                  # PDF files (gitignored — must be copied manually to server)
public/
  covers/                 # Book cover images (gitignored — uploaded via admin)
  books/                  # Static placeholder (actual PDFs served from private/books/)
```

## Key Conventions

- **Translations:** flat key-value via `useLang()` → `t('key')` — both `ar` and `en` in `src/context/LanguageContext.tsx`
- **Prices:** regional pricing system — Egypt (EGP), Saudi (SAR), International (USD) — `src/context/RegionalPricingContext.tsx`
- **Admin:** no middleware — each admin page checks `user.role === 'admin'` via `getAuthUser()`
- **Book files:** PDFs stored in `private/books/` and served via `/api/books/[id]/file` (streaming with range support)
- **Book covers:** stored in `public/covers/` (uploaded via admin panel)
- **Email:** all transactional email uses Titan SMTP via env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)

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

> Note: GitHub Actions CI/CD is configured in `.github/workflows/deploy-vps.yml` but manual deploy above is more reliable.

## Common Tasks

### Add a translation key
Edit `src/context/LanguageContext.tsx` — add to both `ar` and `en` objects.

### Add a new book
1. Upload PDF via admin → `/admin/books` → "رفع ملف"
2. Upload cover image
3. Set `freePages`, `price`, `isPublished = true`

### Check logs
```bash
pm2 logs 1 --lines 30 --nostream
```

### After Prisma schema change
```bash
npx prisma db push --skip-generate
```

## Book Reader Flow

1. User opens `/library/[id]`
2. **Legal overlay** appears immediately (full-screen) with:
   - Green "جاري تحميل الكتاب" loading indicator
   - IP rights legal warning text
   - **Cloudflare Turnstile** widget (site key: `0x4AAAAAACzKEGf-IQ39WfSB`)
3. After Turnstile verified → **10-second countdown** starts with progress bar
4. Overlay closes → **BookReader** (PDF) visible
5. Background tracking: IP, device fingerprint, geolocation logged silently

## Known Issues / Watch Out

- **`private/books/`** is gitignored — PDFs must be manually copied to server after fresh clone
- **`public/covers/`** is gitignored — cover images must be manually copied to server
- **puppeteer/chromium warning** at build time is harmless — invoice PDF generation falls back gracefully
- **Prisma `db push`** may warn about data loss on column type changes — review carefully before confirming
- **Session ping** (`/api/books/[id]/session`) runs every 90 seconds per open book to detect concurrent logins
- **Device limit:** users limited to 2 registered devices for book access
