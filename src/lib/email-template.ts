// Plain-text → branded email HTML.
//
// The assistant writes the message as a normal Arabic block of text. This
// helper escapes HTML, splits paragraphs on blank lines, preserves single
// line-breaks as <br>, substitutes {{firstName}}/{{couponCode}}, and wraps
// it all in the existing Moslim Leader branded shell (header bar +
// optional coupon chip + optional CTA button + footer placeholder). The
// instrumentation layer (instrumentEmailHtml in src/lib/marketing.ts)
// then adds the open pixel + click tracking + unsubscribe link.

interface RenderInput {
  bodyText: string;
  firstName?: string;
  couponCode?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bodyTextToHtml(text: string): string {
  // Split on blank lines → paragraphs; keep single \n inside a paragraph as <br>.
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(Boolean);
  return paragraphs
    .map(p => `<p style="margin:0 0 16px;line-height:1.7;color:#1f2937">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export function renderPlainTextEmail(input: RenderInput): string {
  // Substitute placeholders BEFORE escaping — but the placeholder values
  // themselves get escaped in case a name contains '<' or '&'.
  const safeFirst = escapeHtml(input.firstName || '');
  const safeCoupon = escapeHtml(input.couponCode || '');

  const substituted = input.bodyText
    .replace(/\{\{firstName\}\}/g, safeFirst)
    .replace(/\{\{couponCode\}\}/g, safeCoupon);

  const bodyHtml = bodyTextToHtml(substituted);

  const couponBlock = input.couponCode
    ? `<p style="text-align:center;margin:24px 0">
  <span style="display:inline-block;padding:14px 28px;background:#F5C518;color:#1a1a2e;border-radius:12px;font-size:18px;font-weight:bold;font-family:monospace;letter-spacing:2px">${escapeHtml(input.couponCode)}</span>
</p>`
    : '';

  const ctaBlock = input.ctaLabel && input.ctaUrl
    ? `<p style="text-align:center;margin:24px 0">
  <a href="${encodeURI(input.ctaUrl)}" style="display:inline-block;padding:12px 28px;background:#1a1a2e;color:#fff;border-radius:12px;text-decoration:none;font-weight:bold">${escapeHtml(input.ctaLabel)}</a>
</p>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moslim Leader</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI', Tahoma, Arial, sans-serif">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#2d1060 100%);padding:24px 32px;text-align:center">
          <h1 style="margin:0;color:#F5C518;font-size:22px;font-weight:900;letter-spacing:0.5px">Moslim Leader</h1>
        </td></tr>
        <tr><td style="padding:32px">
          ${bodyHtml}
          ${couponBlock}
          ${ctaBlock}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
