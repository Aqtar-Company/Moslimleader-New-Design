// Single pooled SMTP transporter shared by every transactional + marketing
// send path. Pooling is essential for the daily-drip campaign batches
// (multiple sends inside a single request) and harmless for one-shot
// transactional sends.
//
// Behaviour matches the previous individual transporters in
// `marketing-mailer.ts` and `order-email.ts` — same Titan SMTP host,
// same SSL/STARTTLS toggle on port 465, same TLS shape.
import nodemailer, { Transporter } from 'nodemailer';

let cached: Transporter | null = null;
let tareeqCached: Transporter | null = null;

export function getTransporter(): Transporter {
  if (cached) return cached;
  const host = process.env.SMTP_HOST || 'smtp.titan.email';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'orders@moslimleader.com';
  const pass = process.env.SMTP_PASS || '';
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });
  return cached;
}

/**
 * The mailbox طريق's own messages go out from — `TAREEQ_SMTP_USER` / `TAREEQ_SMTP_PASS`
 * when both are set, the shop's shared transporter otherwise.
 *
 * ## Why a second mailbox needs its own LOGIN, not just a different From line
 *
 * Titan authenticates the session, and a session logged in as `orders@` is generally not
 * allowed to put `tareeq@` in the From header. Where it is allowed, the mail still has to
 * pass DMARC — and a From the sending domain does not authenticate is the single fastest
 * way into the spam folder. So a طريق address is only used when طريق can actually log in
 * as it, which is exactly what these two variables mean.
 *
 * Absent either variable, everything behaves as it did before this function existed.
 */
export function getTareeqTransporter(): Transporter {
  const user = process.env.TAREEQ_SMTP_USER;
  const pass = process.env.TAREEQ_SMTP_PASS;
  if (!user || !pass) return getTransporter();
  if (tareeqCached) return tareeqCached;
  const host = process.env.TAREEQ_SMTP_HOST || process.env.SMTP_HOST || 'smtp.titan.email';
  const port = parseInt(process.env.TAREEQ_SMTP_PORT || process.env.SMTP_PORT || '465', 10);
  tareeqCached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    pool: true,
    // Lower than the shop's: broadcasts are throttled to ~30/min anyway, and the shop's
    // order mail must never queue behind an announcement to five thousand people.
    maxConnections: 2,
    maxMessages: 50,
  });
  return tareeqCached;
}

/**
 * The address طريق's mail is FROM. Its own mailbox when one is configured (and only then —
 * see above), else the shop's authenticated mailbox.
 */
export function tareeqFromAddress(): string {
  return process.env.TAREEQ_SMTP_USER || process.env.SMTP_USER || 'orders@moslimleader.com';
}

/** Where a reply lands, and the address printed in the email signature. */
export function tareeqContactAddress(): string {
  return process.env.TAREEQ_REPLY_TO || process.env.TAREEQ_SMTP_USER || 'info@moslimleader.com';
}
