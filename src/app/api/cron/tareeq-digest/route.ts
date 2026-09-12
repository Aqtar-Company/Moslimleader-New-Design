export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTransporter } from '@/lib/smtp';

/**
 * The weekly "here is what you missed" email.
 *
 * Every notification in Tareeq is instant and needs push to be enabled, so nothing at all
 * reaches someone who has been away a week — and nothing invites them back. SMTP is
 * already configured and paid for; the channel existed and went unused.
 *
 * Authentication: shared CRON_SECRET, header `x-cron-key` — same as the other cron routes.
 *
 * Install (Sunday 9am Cairo = 07:00 UTC):
 *   0 7 * * 0 curl -s -H "x-cron-key: $CRON_SECRET" https://moslimleader.com/api/cron/tareeq-digest >/dev/null 2>&1
 */

/** Only people who have been away at least this long. Anyone active does not need it. */
const AWAY_DAYS = 7;
/** Hard ceiling per run. Titan will throttle long before this, and a stuck run is worse
 *  than a short one — the next week's run picks up whoever was missed. */
const MAX_RECIPIENTS = 300;
const POSTS_IN_EMAIL = 5;
const SITE = 'https://moslimleader.com';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-cron-key') === secret;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const since = new Date(Date.now() - AWAY_DAYS * 86_400_000);

  // The week's best, by the same score the «الأنفع» feed uses — so the email and the site
  // never disagree about what was worth reading.
  const posts = await prisma.tareeqPost.findMany({
    where: { isHidden: false, isDraft: false, createdAt: { gte: since } },
    orderBy: [{ hotScore: 'desc' }, { id: 'desc' }],
    take: POSTS_IN_EMAIL,
    select: { id: true, title: true, content: true, authorName: true, imageUrl: true },
  });

  // Nothing was written this week: sending an email that says so is worse than silence.
  if (posts.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no posts this week' });
  }

  const recipients = await prisma.user.findMany({
    where: {
      emailVerified: true,
      // Opting out of marketing opts out of this. It is a re-engagement email, not a
      // transactional one, and treating it as transactional would be a trick.
      marketingOptIn: true,
      tareeqSuspended: false,
      // Away, or never seen. Someone reading Tareeq today does not need to be told what is
      // on it.
      OR: [{ tareeqLastSeen: null }, { tareeqLastSeen: { lt: since } }],
    },
    select: { id: true, name: true, email: true, marketingToken: true },
    take: MAX_RECIPIENTS,
  });

  const transporter = getTransporter();
  let sent = 0;
  let failed = 0;

  for (const u of recipients) {
    const unsub = u.marketingToken ? `${SITE}/api/email/unsubscribe?token=${u.marketingToken}` : `${SITE}/account`;

    const items = posts.map(p => {
      const title = esc((p.title || p.content.slice(0, 80)).trim());
      const author = esc(p.authorName);
      return `
        <tr><td style="padding:0 0 18px">
          <a href="${SITE}/tareeq/${p.id}" style="text-decoration:none;color:#1a1a2a">
            <div style="font-size:16px;font-weight:700;line-height:1.6">${title}</div>
            <div style="font-size:13px;color:#7c7a8c;margin-top:4px">${author}</div>
          </a>
        </td></tr>`;
    }).join('');

    const html = `
<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#f9f7f5;padding:24px">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
    <tr><td>
      <div style="font-size:13px;color:#ff5c38;font-weight:700;margin-bottom:6px">طريق ★</div>
      <div style="font-size:20px;font-weight:800;color:#1a1a2a;margin-bottom:4px">ما فاتك هذا الأسبوع</div>
      <div style="font-size:14px;color:#7c7a8c;margin-bottom:22px">أهم ${posts.length} علامات كتبها أعضاء طريق.</div>
      <table role="presentation" width="100%">${items}</table>
      <a href="${SITE}/tareeq" style="display:inline-block;margin-top:10px;background:#ff5c38;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:8px">افتح طريق</a>
      <div style="font-size:11px;color:#9a98a8;margin-top:26px;border-top:1px solid #eee;padding-top:14px">
        وصلتك هذه الرسالة لأنك عضو في مسلم ليدر.
        <a href="${unsub}" style="color:#9a98a8">إلغاء الاشتراك</a>
      </div>
    </td></tr>
  </table>
</div>`;

    try {
      await transporter.sendMail({
        from: `"طريق — مسلم ليدر" <${process.env.SMTP_USER || 'orders@moslimleader.com'}>`,
        to: u.email,
        subject: 'ما فاتك هذا الأسبوع في طريق ★',
        html,
        // Real unsubscribe headers, not just the footer link: without these the big
        // providers are far likelier to file the whole send as spam.
        headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      sent++;
    } catch {
      // One bad address must not end the run for everyone behind it.
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, candidates: recipients.length, posts: posts.length });
}
