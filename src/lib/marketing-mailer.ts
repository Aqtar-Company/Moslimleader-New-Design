import { getTransporter } from './smtp';

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
