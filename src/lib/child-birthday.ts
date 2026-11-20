import { prisma } from '@/lib/prisma';
import { getTransporter } from '@/lib/smtp';
import { isMailableEmail } from '@/lib/real-email';
import { emailLogoImg } from '@/lib/email-template';
import { movePoints } from '@/lib/loyalty';
import { products as staticProducts } from '@/lib/products';

/**
 * «يوم ميلاد الابن» — on a child's birthday, the parent gets an email («كبر فلان في الإسلام
 * سنة») and a gift of points.
 *
 * Who: children saved in the account (Child), age 1–18, whose parent has a REAL address
 * (isMailableEmail — most User rows hold an address the shop invented from a phone number).
 * Once a year per child: Child.lastGreetedYear is claimed BEFORE anything is sent, so a cron
 * that fires twice, or two processes, never greet twice.
 *
 * Product suggestions for the child's age are added only when the parent opted into
 * marketing; the greeting and the gift go to everyone.
 *
 * Dates are Cairo dates: a birthday is "today" by the shop's clock, not the server's UTC.
 */

export const BIRTHDAY_POINTS = 50; // 5 EGP
const SITE = 'https://moslimleader.com';
const TZ = 'Africa/Cairo';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cairoToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function suggestionsFor(age: number, gender: string | null) {
  const g = gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : null;
  return staticProducts
    .filter(p => {
      if (age < (p.minAge ?? 0) || age > (p.maxAge ?? 99)) return false;
      if (g && p.gender && p.gender !== 'both' && p.gender !== g) return false;
      return p.inStock !== false;
    })
    .slice(0, 3)
    .map(p => ({ name: p.name, url: `${SITE}/shop/${p.slug}`, image: p.images?.[0] ? (p.images[0].startsWith('http') ? p.images[0] : `${SITE}${p.images[0]}`) : null }));
}

export function birthdayEmail(input: { parentFirstName: string; childName: string; girl: boolean; age: number; points: number; suggestions: { name: string; url: string; image: string | null }[] }) {
  const { parentFirstName, childName, girl, age, points, suggestions } = input;
  const c = esc(childName);
  const subject = girl ? `كبرت ${childName} في الإسلام سنة 🌙` : `كبر ${childName} في الإسلام سنة 🌙`;
  const line = girl ? `اليوم تُتمّ ${c} عامها الـ${age}.` : `اليوم يُتمّ ${c} عامه الـ${age}.`;
  const dua = girl
    ? 'بارك الله لكم فيها، وجعلها قرّة عين لكم، وأنبتها نباتاً حسناً.'
    : 'بارك الله لكم فيه، وجعله قرّة عين لكم، وأنبته نباتاً حسناً.';
  const hello = parentFirstName ? `أهلاً ${esc(parentFirstName)}،` : 'أهلاً بك،';
  const sugg = suggestions.length ? `
        <tr><td style="padding:8px 32px 0">
          <p style="margin:0 0 12px;font-weight:bold;color:#1a1a2e">${girl ? `هدايا تناسب ${c} في عمرها` : `هدايا تناسب ${c} في عمره`}</p>
          ${suggestions.map(s => `
          <a href="${esc(s.url)}" style="display:block;text-decoration:none;color:#1a1a2e;border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:8px">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
              ${s.image ? `<td width="64" style="width:64px"><img src="${esc(s.image)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:8px;object-fit:cover;border:0"></td>` : ''}
              <td style="font-weight:bold;font-size:14px;padding:0 8px">${esc(s.name)}</td>
            </tr></table>
          </a>`).join('')}
        </td></tr>` : '';

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI', Tahoma, Arial, sans-serif">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:32px 16px"><tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:#1a1a2e;padding:24px 32px;text-align:center">${emailLogoImg(SITE)}</td></tr>
      <tr><td style="padding:32px 32px 8px;text-align:center">
        <p style="margin:0 0 8px;color:#6b7280">${hello}</p>
        <h1 style="margin:0 0 12px;color:#1a1a2e;font-size:26px;font-weight:900">${esc(subject.replace(' 🌙', ''))}</h1>
        <p style="margin:0 0 8px;line-height:1.8;color:#1f2937">${line}</p>
        <p style="margin:0 0 20px;line-height:1.8;color:#1f2937;font-weight:bold">${dua}</p>
        <p style="margin:0 0 6px;color:#1f2937">وبهذه المناسبة، أضفنا لرصيدك هدية:</p>
        <p style="margin:0 0 20px"><span style="display:inline-block;padding:12px 24px;background:#F5C518;color:#1a1a2e;border-radius:12px;font-size:20px;font-weight:900">${points} نقطة</span></p>
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px">تُصرف كخصم عند الدفع — كل 100 نقطة = 10 جنيه.</p>
      </td></tr>
      ${sugg}
      <tr><td style="padding:16px 32px 32px;text-align:center">
        <a href="${SITE}/account" style="display:inline-block;padding:12px 28px;background:#1a1a2e;color:#fff;border-radius:12px;text-decoration:none;font-weight:bold">نقاطي على مسلم ليدر</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const text = [
    hello.replace(/&[a-z#0-9]+;/g, ''),
    subject.replace(' 🌙', ''),
    line.replace(/&[a-z#0-9]+;/g, ''),
    dua,
    `وبهذه المناسبة أضفنا لرصيدك ${points} نقطة هدية (كل 100 نقطة = 10 جنيه).`,
    ...suggestions.map(s => `${s.name}: ${s.url}`),
    `${SITE}/account`,
  ].join('\n\n');
  return { subject, html, text };
}

/** Greet every child whose birthday is today (Cairo). Returns what it did. */
export async function runChildBirthdays(opts: { dryRun?: boolean } = {}) {
  const { year, month, day } = cairoToday();
  // Birthdates are saved as a date at midnight UTC, so month/day in UTC are the birthday.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM Child
    WHERE MONTH(birthdate) = ${month} AND DAY(birthdate) = ${day}
      AND (lastGreetedYear IS NULL OR lastGreetedYear < ${year})`;
  const children = rows.length
    ? await prisma.child.findMany({
        where: { id: { in: rows.map(r => r.id) } },
        select: { id: true, name: true, gender: true, birthdate: true, user: { select: { id: true, name: true, email: true, marketingOptIn: true } } },
      })
    : [];

  const result = { date: `${year}-${month}-${day}`, considered: children.length, sent: 0, skipped: 0, failed: 0, dryRun: !!opts.dryRun };
  const transporter = opts.dryRun ? null : getTransporter();

  for (const ch of children) {
    const age = year - ch.birthdate.getUTCFullYear();
    if (age < 1 || age > 18 || !isMailableEmail(ch.user.email)) { result.skipped++; continue; }
    if (opts.dryRun) { result.sent++; continue; }

    // Claim the year first — whatever happens next, this child is not greeted twice.
    const claim = await prisma.child.updateMany({
      where: { id: ch.id, OR: [{ lastGreetedYear: null }, { lastGreetedYear: { lt: year } }] },
      data: { lastGreetedYear: year },
    });
    if (!claim.count) { result.skipped++; continue; }

    try {
      await movePoints(ch.user.id, BIRTHDAY_POINTS, 'child_birthday');
      const mail = birthdayEmail({
        parentFirstName: (ch.user.name || '').trim().split(/\s+/)[0] || '',
        childName: ch.name.trim(),
        girl: ch.gender === 'girl',
        age,
        points: BIRTHDAY_POINTS,
        suggestions: ch.user.marketingOptIn ? suggestionsFor(age, ch.gender) : [],
      });
      await transporter!.sendMail({
        from: `"مسلم ليدر" <${process.env.SMTP_USER || 'orders@moslimleader.com'}>`,
        to: ch.user.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      result.sent++;
    } catch (err) {
      result.failed++;
      console.error('[child-birthday]', ch.id, err);
    }
  }
  return result;
}
