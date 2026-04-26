# Moslim Leader — Digital Store & Library

Full-stack e-commerce platform for physical products and digital books, built with Next.js 14.

## Features

- **Physical store** — product catalog, cart, checkout, PayPal + bank transfer
- **Digital library** — PDF books with Cloudflare Turnstile protection, legal overlay, reading progress, device fingerprinting
- **Book series** — bundle multiple books under a series with combined pricing
- **Regional pricing** — automatic pricing in EGP / SAR / USD based on user location
- **Coupons** — discount codes with usage limits
- **User accounts** — registration, login, Google OAuth, order history
- **Admin panel** — full management of products, orders, books, users, shipping, pricing
- **Bilingual** — Arabic (RTL) and English (LTR) with a single language toggle

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | MySQL + Prisma ORM |
| Auth | JWT (httpOnly cookie) + Google OAuth |
| Styling | Tailwind CSS |
| Payments | PayPal SDK + manual bank transfer |
| Email | Nodemailer (Titan SMTP) |
| PDF | react-pdf + PDF.js |
| Bot protection | Cloudflare Turnstile |
| Process manager | PM2 |

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL database
- Titan SMTP credentials (or any SMTP)
- Cloudflare Turnstile keys
- PayPal app credentials

### Install

```bash
npm install
```

### Configure

Copy `.env.example` to `.env.local` and fill in all values:

```env
DATABASE_URL=mysql://user:pass@localhost:3306/moslimleader
JWT_SECRET=your-secret-here
SMTP_HOST=smtp.titan.email
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Database

```bash
npx prisma db push
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
# or with PM2:
pm2 start ecosystem.config.js
```

## Project Structure

```
src/
  app/          # Pages and API routes (Next.js App Router)
  components/   # Reusable UI components
  context/      # React contexts (Auth, Cart, Lang, Pricing, Wishlist)
  lib/          # Utilities (JWT, Prisma, email, PDF, PayPal, shipping)
private/
  books/        # PDF files — NOT committed to git, copy manually to server
public/
  covers/       # Book cover images — NOT committed to git
```

> See `CLAUDE.md` for detailed developer context including deployment, conventions, and known issues.

## License

Private — all rights reserved. Not open source.
