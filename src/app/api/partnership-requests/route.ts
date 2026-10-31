export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { sanitizeHtml } from '@/lib/sanitize';
import { getTransporter } from '@/lib/smtp';

/**
 * The «طلب الشراكة» wizard on /partnership posts here.
 *
 * Order matters: validate → rate limit → Turnstile → SAVE → mail. The request is stored
 * before any mail is attempted, and a failed mail never fails the request — the row is
 * what the team works from; the mail is only the heads-up.
 *
 * Nothing leaves for a third party except the Turnstile token to Cloudflare, which is the
 * whole point of that check.
 */

const INBOX = 'edara@moslimleader.com';

const ROLES = ['distributor', 'affiliate', 'operator', 'licensee', 'investor', 'unsure'] as const;
const STAGES = ['existing', 'founding', 'individual'] as const;
const CHANNELS = ['schools', 'nurseries', 'bookstores', 'online-store', 'marketplaces', 'book-fairs', 'islamic-centers', 'direct-families', 'other'] as const;
const EXPERIENCE = ['none', 'general', 'kids'] as const;
const SIZES = ['small', 'medium', 'large', 'later'] as const;

const ROLE_AR: Record<string, string> = {
  distributor: 'موزّع', affiliate: 'مسوّق بالعمولة', operator: 'مشغّل محلي',
  licensee: 'ترخيص المحتوى والشخصيات', investor: 'مستثمر', unsure: 'لست متأكدًا',
};
const STAGE_AR: Record<string, string> = { existing: 'نشاط قائم', founding: 'في مرحلة التأسيس', individual: 'فرد بلا شركة بعد' };
const CHANNEL_AR: Record<string, string> = {
  schools: 'مدارس', nurseries: 'حضانات', bookstores: 'مكتبات', 'online-store': 'متجر إلكتروني',
  marketplaces: 'أمازون/نون', 'book-fairs': 'معارض كتب', 'islamic-centers': 'مراكز ومساجد إسلامية',
  'direct-families': 'بيع مباشر للأسر', other: 'أخرى',
};
const EXPERIENCE_AR: Record<string, string> = { none: 'لا خبرة سابقة', general: 'خبرة في منتجات عامة', kids: 'خبرة في الأطفال أو الكتب أو التعليم' };
const SIZE_AR: Record<string, string> = { small: 'تجربة صغيرة', medium: 'متوسطة', large: 'كبيرة', later: 'أحدده بعد المكالمة' };

/** Plain text in, plain text out: the shared sanitizer, then no markup at all. */
function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = sanitizeHtml(v).replace(/<[^>]*>/g, '').replace(/\u0000/g, '').trim();
  if (!s) return null;
  if (s.length > max) throw new Error('too-long');
  return s;
}
function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function verifyTurnstile(token: string | null, ip: string): Promise<'ok' | 'failed' | 'unconfigured'> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return 'unconfigured';
  if (!token) return 'failed';
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== 'unknown') body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, signal: AbortSignal.timeout(8000),
    });
    const d = await r.json() as { success?: boolean };
    return d.success ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  let raw: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 20_000) return NextResponse.json({ error: 'الطلب أطول من المسموح' }, { status: 413 });
    raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object') throw new Error();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // ── validate ──────────────────────────────────────────────────────────────────────
  let data;
  try {
    const name = clean(raw.name, 120);
    const email = clean(raw.email, 190)?.toLowerCase() ?? null;
    const country = clean(raw.country, 80);
    const role = oneOf(raw.role, ROLES);
    const businessStage = oneOf(raw.businessStage, STAGES);
    const experience = oneOf(raw.experience, EXPERIENCE);
    const startSize = oneOf(raw.startSize, SIZES);
    const channels = Array.isArray(raw.channels)
      ? Array.from(new Set(raw.channels.filter((c): c is string => typeof c === 'string' && (CHANNELS as readonly string[]).includes(c))))
      : [];
    const consent = raw.consent === true;

    const missing: string[] = [];
    if (!name) missing.push('الاسم');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) missing.push('بريد صحيح');
    if (!country) missing.push('الدولة');
    if (!role) missing.push('الدور');
    if (!businessStage) missing.push('وضع النشاط');
    if (!experience) missing.push('الخبرة');
    if (!startSize) missing.push('حجم البداية');
    if (!consent) missing.push('الموافقة على التواصل');
    if (missing.length) return NextResponse.json({ error: `ناقص: ${missing.join('، ')}` }, { status: 400 });

    const whatsapp = clean(raw.whatsapp, 40);
    if (whatsapp && !/^[+\d\s()-]{6,40}$/.test(whatsapp)) {
      return NextResponse.json({ error: 'رقم الواتساب غير صالح' }, { status: 400 });
    }
    data = {
      name: name!, email: email!, country: country!, role: role!, businessStage: businessStage!,
      experience: experience!, startSize: startSize!, channels,
      whatsapp,
      company: clean(raw.company, 200),
      links: clean(raw.links, 1000),
      channelsOther: channels.includes('other') ? clean(raw.channelsOther, 300) : null,
      experienceNotes: clean(raw.experienceNotes, 2000),
      message: clean(raw.message, 2000),
    };
  } catch {
    return NextResponse.json({ error: 'أحد الحقول أطول من المسموح — اختصره وأعد الإرسال' }, { status: 400 });
  }

  // ── rate limit (after validation, so a typo does not spend an attempt) ─────────────
  const rl = checkRateLimit(`partnership:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    const mins = Math.max(1, Math.ceil(rl.retryAfterMs / 60_000));
    return NextResponse.json(
      { error: `أرسلت طلبات كثيرة — حاول بعد ${mins} دقيقة، أو راسلنا على ${INBOX}` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // ── Turnstile ─────────────────────────────────────────────────────────────────────
  const ts = await verifyTurnstile(typeof raw.turnstileToken === 'string' ? raw.turnstileToken : null, ip);
  if (ts === 'failed') {
    return NextResponse.json({ error: 'تعذّر التحقق من أنك لست برنامجًا آليًا — أعد التحقق ثم أرسل' }, { status: 400 });
  }
  if (ts === 'unconfigured') {
    // Logged, not silent: without the secret the check cannot run. The rate limit still holds.
    console.error('[partnership-requests] TURNSTILE_SECRET_KEY is not set — request accepted without Turnstile');
  }

  // ── save ──────────────────────────────────────────────────────────────────────────
  let saved;
  try {
    saved = await prisma.partnershipRequest.create({
      data: { ...data, channels: data.channels, ip: ip === 'unknown' ? null : ip.slice(0, 64) },
      select: { id: true, createdAt: true },
    });
  } catch (err) {
    console.error('[partnership-requests] save failed', err);
    return NextResponse.json({ error: `تعذّر حفظ الطلب الآن — أعد المحاولة، أو راسلنا على ${INBOX}` }, { status: 500 });
  }

  // ── mail (best effort) ────────────────────────────────────────────────────────────
  const rows: [string, string][] = [
    ['الاسم', data.name],
    ['البريد', data.email],
    ['واتساب', data.whatsapp ?? '—'],
    ['الشركة', data.company ?? '—'],
    ['الروابط', data.links ?? '—'],
    ['الدور', ROLE_AR[data.role]],
    ['الدولة', data.country],
    ['وضع النشاط', STAGE_AR[data.businessStage]],
    ['قنوات البيع', data.channels.map(c => CHANNEL_AR[c]).join('، ') || '—'],
    ['قنوات أخرى', data.channelsOther ?? '—'],
    ['الخبرة', EXPERIENCE_AR[data.experience]],
    ['أمثلة الخبرة', data.experienceNotes ?? '—'],
    ['حجم البداية', SIZE_AR[data.startSize]],
    ['الرسالة', data.message ?? '—'],
  ];
  const table = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 10px;color:#6b7280;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 10px;color:#111827;white-space:pre-wrap">${esc(v)}</td></tr>`,
  ).join('');
  const from = `"مسلم ليدر" <${process.env.SMTP_USER || 'orders@moslimleader.com'}>`;
  const transporter = getTransporter();
  const results = await Promise.allSettled([
    transporter.sendMail({
      from,
      to: INBOX,
      replyTo: data.email,
      subject: `طلب شراكة — ${ROLE_AR[data.role]} — ${data.name} (${data.country})`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nرقم الطلب: ${saved.id}`,
      html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h2 style="margin:0 0 12px">طلب شراكة جديد</h2><table style="border-collapse:collapse;font-size:14px">${table}</table><p style="color:#6b7280;font-size:12px">رقم الطلب: ${saved.id}</p></div>`,
    }),
    transporter.sendMail({
      from,
      to: data.email,
      replyTo: INBOX,
      subject: 'استلمنا طلب الشراكة — مسلم ليدر',
      text: `أهلًا ${data.name}،\n\nاستلمنا طلبك بدور «${ROLE_AR[data.role]}». سنراجع معلوماتك ثم ننسّق معك موعد مكالمة التعارف.\n\nللتواصل: ${INBOX}\n\nمسلم ليدر`,
      html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#111827"><p>أهلًا ${esc(data.name)}،</p><p>استلمنا طلبك بدور «${esc(ROLE_AR[data.role])}». سنراجع معلوماتك ثم ننسّق معك موعد مكالمة التعارف.</p><p>للتواصل: <a href="mailto:${INBOX}">${INBOX}</a></p><p>مسلم ليدر</p></div>`,
    }),
  ]);
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[partnership-requests] ${i === 0 ? 'team' : 'confirmation'} mail failed for ${saved.id}`, r.reason);
  });

  return NextResponse.json({ ok: true, id: saved.id });
}
