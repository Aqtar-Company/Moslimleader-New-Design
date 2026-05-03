import nodemailer, { Transporter } from 'nodemailer';

let cached: Transporter | null = null;

function getTransporter(): Transporter {
  if (cached) return cached;
  const host = process.env.SMTP_HOST || 'smtp.titan.email';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'orders@moslimleader.com';
  const pass = process.env.SMTP_PASS || '';
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    pool: true,        // reuse connections for bulk sends
    maxConnections: 3,
    maxMessages: 50,
  });
  return cached;
}

export async function sendMarketingEmail(opts: {
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl: string;
}) {
  const fromName = process.env.SMTP_FROM_NAME || 'Moslim Leader';
  const fromEmail = process.env.SMTP_USER || 'orders@moslimleader.com';
  return getTransporter().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    headers: {
      'X-Campaign': 'moslimleader-marketing',
      // RFC 8058 one-click — both headers are required for Gmail/Yahoo bulk-sender compliance
      'List-Unsubscribe': `<${opts.unsubscribeUrl}>, <mailto:${fromEmail}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

export function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com').replace(/\/+$/, '');
}
