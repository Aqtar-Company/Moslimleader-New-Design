import { emailLogoImg } from '@/lib/email-template';

/**
 * The account emails — confirm your address (on sign-up and on «resend»), and reset your
 * password — in the language the person is using the site in. They were three Arabic-only
 * copies inside three routes; an English-speaking customer received a page they could not
 * read, with the one button that mattered labelled in Arabic.
 */
export type AuthEmailKind = 'verify-signup' | 'verify-resend' | 'reset';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COPY = {
  ar: {
    'verify-signup': {
      subject: 'تأكيد البريد الإلكتروني - مسلم ليدر', title: 'تأكيد البريد الإلكتروني',
      lines: ['شكراً لتسجيلك في مسلم ليدر! اضغط على الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك.', 'الرابط صالح لمدة 24 ساعة.'],
      button: 'تأكيد البريد الإلكتروني', ignore: 'إذا لم تسجّل في موقعنا، يمكنك تجاهل هذا البريد.',
    },
    'verify-resend': {
      subject: 'تأكيد البريد الإلكتروني - مسلم ليدر', title: 'تأكيد البريد الإلكتروني',
      lines: ['اضغط على الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك. الرابط صالح لمدة 24 ساعة.'],
      button: 'تأكيد البريد الإلكتروني', ignore: 'إذا لم تسجّل في موقعنا، يمكنك تجاهل هذا البريد.',
    },
    reset: {
      subject: 'إعادة تعيين كلمة المرور - مسلم ليدر', title: 'إعادة تعيين كلمة المرور',
      lines: ['تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.', 'اضغط على الزر أدناه لإعادة تعيين كلمة المرور. الرابط صالح لمدة ساعة واحدة فقط.'],
      button: 'إعادة تعيين كلمة المرور', ignore: 'إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني.',
    },
    hello: (n: string) => `مرحباً ${n}،`, footer: 'مسلم ليدر - moslimleader.com', from: 'مسلم ليدر',
  },
  en: {
    'verify-signup': {
      subject: 'Confirm your email - Moslim Leader', title: 'Confirm your email',
      lines: ['Thank you for joining Moslim Leader! Press the button below to confirm your email and activate your account.', 'The link is valid for 24 hours.'],
      button: 'Confirm my email', ignore: 'If you did not sign up on our site, you can ignore this email.',
    },
    'verify-resend': {
      subject: 'Confirm your email - Moslim Leader', title: 'Confirm your email',
      lines: ['Press the button below to confirm your email and activate your account. The link is valid for 24 hours.'],
      button: 'Confirm my email', ignore: 'If you did not sign up on our site, you can ignore this email.',
    },
    reset: {
      subject: 'Reset your password - Moslim Leader', title: 'Reset your password',
      lines: ['We received a request to reset the password of your account.', 'Press the button below to choose a new password. The link is valid for one hour only.'],
      button: 'Reset my password', ignore: 'If you did not ask to reset your password, you can ignore this email.',
    },
    hello: (n: string) => `Hello ${n},`, footer: 'Moslim Leader - moslimleader.com', from: 'Moslim Leader',
  },
} as const;

export function authEmail(kind: AuthEmailKind, opts: { name: string; url: string; siteUrl: string; lang?: 'ar' | 'en' }) {
  const lang = opts.lang === 'en' ? 'en' : 'ar';
  const C = COPY[lang];
  const k = C[kind];
  const html = `
    <div dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">${emailLogoImg(opts.siteUrl, lang === 'ar' ? 'مسلم ليدر' : 'Moslim Leader')}</div>
      <h2 style="color: #1a1a1a; text-align: center;">${k.title}</h2>
      <p style="color: #555;">${esc(C.hello(opts.name))}</p>
      ${k.lines.map(l => `<p style="color: #555;">${l}</p>`).join('\n      ')}
      <div style="text-align: center; margin: 30px 0;">
        <a href="${esc(opts.url)}"
           style="background-color: #F5C518; color: #1a1a1a; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
          ${k.button}
        </a>
      </div>
      <p style="color: #999; font-size: 13px;">${k.ignore}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #ccc; font-size: 12px; text-align: center;">${C.footer}</p>
    </div>`;
  return { subject: k.subject, html, fromName: C.from };
}
