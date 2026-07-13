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
