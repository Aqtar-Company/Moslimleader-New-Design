#!/usr/bin/env bash
# فحص صندوق بريد طريق — يُشغَّل على السيرفر من مجلد التطبيق.
#
#   cd /home/moslimleader.com/app && bash ops/check-tareeq-mail.sh
#
# يقرأ .env ويقول: أي المتغيّرات مضبوط، وهل يدخل الصندوقُ الجديد فعلًا،
# وهل يسمح المزوّدُ بالإرسال باسمه. لا يُعدّل شيئًا، ولا يطبع كلمة المرور.
#
# لماذا هذا الفحص: وضعُ عنوانٍ في خانة «من» بينما الجلسة مسجّلةٌ بصندوقٍ آخر
# يُرفَض عند تيتان، وإن مرّ سقط في DMARC — أي في مجلد السبام. فالتحقّق قبل
# الاعتماد، لا بعده.

set -u
cd "$(dirname "$0")/.." || exit 1

if [ ! -f .env ]; then echo "لا يوجد .env في $(pwd)"; exit 1; fi

get() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed 's/^["'"'"']//; s/["'"'"']$//'; }

SMTP_USER=$(get SMTP_USER)
TAREEQ_REPLY_TO=$(get TAREEQ_REPLY_TO)
TAREEQ_SMTP_USER=$(get TAREEQ_SMTP_USER)
TAREEQ_SMTP_PASS=$(get TAREEQ_SMTP_PASS)

echo "═══ ما هو مضبوط في .env ═══"
printf '  SMTP_USER         = %s\n' "${SMTP_USER:-(فارغ)}"
printf '  TAREEQ_REPLY_TO   = %s\n' "${TAREEQ_REPLY_TO:-(فارغ — الرد سيذهب إلى info@)}"
printf '  TAREEQ_SMTP_USER  = %s\n' "${TAREEQ_SMTP_USER:-(فارغ — الإرسال من SMTP_USER)}"
printf '  TAREEQ_SMTP_PASS  = %s\n' "$([ -n "$TAREEQ_SMTP_PASS" ] && echo "مضبوطة (${#TAREEQ_SMTP_PASS} حرفًا)" || echo '(فارغة)')"

echo
if [ -z "$TAREEQ_SMTP_USER" ] || [ -z "$TAREEQ_SMTP_PASS" ]; then
  echo "═══ النتيجة ═══"
  echo "  المرحلة الأولى فقط. الرسائل تُرسَل من $SMTP_USER،"
  echo "  و«ردّ» يذهب إلى ${TAREEQ_REPLY_TO:-info@moslimleader.com}، والتوقيع يعرض العنوان نفسه."
  echo "  لتفعيل الإرسال من صندوق طريق: ضَع TAREEQ_SMTP_USER و TAREEQ_SMTP_PASS ثم أعد التشغيل."
  exit 0
fi

echo "═══ اختبار الدخول والإرسال باسم صندوق طريق ═══"
TO="${1:-$TAREEQ_SMTP_USER}"
node - "$TO" <<'EOF'
const fs = require('fs');
const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const nodemailer = require('nodemailer');
const user = env.TAREEQ_SMTP_USER;
const port = parseInt(env.TAREEQ_SMTP_PORT || env.SMTP_PORT || '465', 10);
const t = nodemailer.createTransport({
  host: env.TAREEQ_SMTP_HOST || env.SMTP_HOST || 'smtp.titan.email',
  port, secure: port === 465,
  auth: { user, pass: env.TAREEQ_SMTP_PASS },
  tls: { rejectUnauthorized: true },
  connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
});
const to = process.argv[2];
t.verify()
  .then(() => {
    console.log('  ✅ الدخول إلى', user, 'نجح');
    return t.sendMail({
      from: '"طريق — مسلم ليدر" <' + user + '>',
      replyTo: env.TAREEQ_REPLY_TO || user,
      to,
      subject: 'اختبار صندوق طريق',
      html: '<p>لو وصلتك هذه الرسالة وفي خانة «من» عنوان طريق، فالتفعيل تام.</p>',
    });
  })
  .then(r => {
    console.log('  ✅ أُرسلت إلى', to, '—', r.response);
    console.log();
    console.log('  الآن افتح البريد وتأكّد من ثلاثة أشياء:');
    console.log('   ١. وصلت في Inbox لا في Spam.');
    console.log('   ٢. خانة «من» تعرض عنوان طريق.');
    console.log('   ٣. اضغط «رد» وتأكّد أن العنوان الذي يظهر هو الذي تريده.');
  })
  .catch(e => {
    console.error('  ❌ فشل:', e.message);
    console.error();
    console.error('  إن كان الرفض عند المصادقة: كلمة المرور ليست لهذا الصندوق.');
    console.error('  وإن كان عند «من»: المزوّد لا يسمح بالإرسال باسمه — احذف');
    console.error('  TAREEQ_SMTP_USER و TAREEQ_SMTP_PASS واكتفِ بـ TAREEQ_REPLY_TO.');
    process.exit(1);
  });
EOF
