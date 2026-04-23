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
      [id]/page.tsx       # Book reader
    admin/                # Admin panel (no auth middleware — checks role in each page)
    api/                  # All API routes (force-dynamic)
  components/
    layout/               # Header, Footer, MobileMenu
    product/              # ProductCard
    ui/                   # Toast, etc.
  context/                # React contexts (Cart, Auth, Lang, Wishlist, RegionalPricing)
  lib/                    # Utilities (jwt, prisma, shipping, geo-pricing, etc.)
```

## Key Conventions

- **Translations:** flat key-value via `useLang()` → `t('key')` — both `ar` and `en` in `src/context/LanguageContext.tsx`
- **Prices:** regional pricing system — Egypt (EGP), Saudi (SAR), International (USD) — `src/context/RegionalPricingContext.tsx`
- **Admin:** no middleware — each admin page checks `user.role === 'admin'` via `getAuthUser()`
- **Book files:** PDFs served via `/api/books/[id]/file` (streams from `public/books/`)
- **Book covers:** stored in `public/covers/` (uploaded via admin)

## Live Server

- **URL:** https://moslimleader.com
- **Path:** `/home/moslimleader.com/app`
- **PM2:** `pm2 restart 1`
- **Deploy:** push to `main` → GitHub Actions auto-deploys via SSH

## Common Tasks

### Add a translation key
Edit `src/context/LanguageContext.tsx` — add to both `ar` and `en` objects.

### Deploy manually
```bash
cd /home/moslimleader.com/app
git pull origin main
npm run build
pm2 restart 1 --update-env
```

### Check logs
```bash
pm2 logs 1 --lines 30 --nostream
```
