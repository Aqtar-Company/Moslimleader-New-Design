/**
 * The email shell for messages sent from طريق's administration.
 *
 * Why not `renderPlainTextEmail` (src/lib/email-template.ts): that one is the SHOP's
 * identity — a purple-to-navy header reading "Moslim Leader". A message from طريق that
 * arrives dressed as the store is a message from a stranger; the member subscribed to a
 * platform with its own name, mark and voice, and the inbox is the one place where that
 * identity has to carry itself without any of the app's UI around it.
 *
 * ## The two things an email like this must get right
 *
 * 1. **It has to be recognisable with images OFF.** Most clients block remote images until
 *    the reader allows them, and Gmail's Arabic users see a lot of blocked mail. So the
 *    logo is an `<img>` with the platform's name as its `alt` AND the name is repeated as
 *    real text beside it — the header reads correctly either way.
 * 2. **It has to be signed.** An unsigned announcement reads as an automated blast. The
 *    footer names who sent it, what طريق is, and how to reach a human, which is also what
 *    keeps it out of the spam folder: a real signature with a real address is one of the
 *    signals filters weigh.
 *
 * Tables and inline styles throughout, because Outlook still parses email with Word's
 * engine and neither flexbox nor a `<style>` block survives it.
 */

const GOLD = '#d4a843';
const INK = '#0f1409';
const PAPER = '#ffffff';
const MUTED = '#6b7280';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Blank lines separate paragraphs; single newlines stay as line breaks. */
function bodyToHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 16px;line-height:1.9;color:#1f2937;font-size:15px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export interface TareeqEmailInput {
  /** Absolute site origin, no trailing slash — the logo and links are built from it. */
  baseUrl: string;
  /** What kind of message this is, shown as a small label: تحديث / إعلان / … */
  kindLabel: string;
  kindIcon: string;
  title: string;
  /** Plain text. `{{firstName}}` is substituted by the caller before this runs. */
  bodyText: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  /** Rendered under the signature when the message is promotional. */
  unsubscribeUrl?: string | null;
  /** The address printed in the signature — see `tareeqContactAddress()`. */
  contactEmail: string;
}

export function renderTareeqEmail(input: TareeqEmailInput): string {
  const { baseUrl } = input;
  const logo = `${baseUrl}/Tareeq-small.png`;
  const cta = input.ctaLabel && input.ctaUrl
    ? `<tr><td align="center" style="padding:8px 0 4px">
        <a href="${encodeURI(input.ctaUrl)}" style="display:inline-block;padding:13px 32px;background:${GOLD};color:${INK};border-radius:999px;text-decoration:none;font-weight:bold;font-size:15px">${escapeHtml(input.ctaLabel)}</a>
      </td></tr>`
    : '';

  const unsubscribe = input.unsubscribeUrl
    ? `<p style="margin:12px 0 0;font-size:11px;color:${MUTED}">
         لا ترغب في رسائل كهذه؟ <a href="${encodeURI(input.unsubscribeUrl)}" style="color:${MUTED}">إلغاء الاشتراك</a>
       </p>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Arial,sans-serif">
  <!-- Preheader: the grey line the inbox shows next to the subject. Without it the client
       picks the first words it finds, which here would be the word "طريق" twice. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.bodyText.slice(0, 120))}</div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f3f4f6;padding:28px 14px">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${PAPER};border-radius:18px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,0.07)">

        <!-- Header: the mark and the name, side by side, so a blocked image still reads -->
        <tr><td style="background:${INK};padding:22px 28px">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding-inline-end:12px" valign="middle">
                <img src="${logo}" width="40" height="40" alt="طريق"
                     style="display:block;width:40px;height:40px;border-radius:10px;border:0">
              </td>
              <td valign="middle">
                <div style="color:${GOLD};font-size:20px;font-weight:900;line-height:1.2">طريق</div>
                <div style="color:rgba(255,255,255,0.62);font-size:11px;letter-spacing:0.04em">من مسلم ليدر</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:26px 28px 6px">
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(212,168,83,0.16);color:#8a6a1f;font-size:12px;font-weight:bold">${input.kindIcon} ${escapeHtml(input.kindLabel)}</span>
          <h1 style="margin:14px 0 18px;font-size:21px;line-height:1.5;color:${INK};font-weight:900">${escapeHtml(input.title)}</h1>
        </td></tr>

        <tr><td style="padding:0 28px 8px">
          ${bodyToHtml(input.bodyText)}
        </td></tr>

        ${cta}

        <!-- Signature: a named sender, not a machine -->
        <tr><td style="padding:22px 28px 26px">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr><td style="border-top:1px solid #e5e7eb;padding-top:18px">
              <p style="margin:0;font-size:14px;font-weight:bold;color:${INK}">إدارة طريق</p>
              <p style="margin:4px 0 0;font-size:12.5px;line-height:1.8;color:${MUTED}">
                طريق — مساحة تربوية هادئة من مسلم ليدر.<br>
                <a href="${baseUrl}/tareeq" style="color:#8a6a1f;text-decoration:none">moslimleader.com/tareeq</a>
                &nbsp;·&nbsp;
                <a href="mailto:${encodeURI(input.contactEmail)}" style="color:#8a6a1f;text-decoration:none">${escapeHtml(input.contactEmail)}</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#9ca3af">
                وصلتك هذه الرسالة لأنك عضو في طريق. يمكنك ضبط ما يصلك من
                <a href="${baseUrl}/tareeq/notifications" style="color:#9ca3af">إعدادات الإشعارات</a>.
              </p>
              ${unsubscribe}
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
