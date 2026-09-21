#!/usr/bin/env bash
# تجربةُ دخولٍ واحدة لصندوق بريد طريق — بلا كتابةِ شيء.
#
#   cd /home/moslimleader.com/app && bash ops/try-tareeq-login.sh
#
# يسأل عن كلمة المرور ويُخفيها أثناء الكتابة، ثم يحاول الدخول ويطبع النتيجة.
# لا يلمس .env ولا يُرسل رسالة. الغرض أن نفصل سؤالين يختلطان:
#
#   • هل كلمةُ المرور صحيحةٌ لهذا الصندوق؟
#   • أم أن الصحيحة كُتبت في .env فأفسدها الطرفيّةُ (مسافةٌ زائدة، علامةُ
#     اقتباس، حرفٌ ابتلعته الصدفة)؟
#
# فإن نجح الدخولُ هنا وفشل من .env، فالعلّةُ في الملف لا في الصندوق.

set -u
cd "$(dirname "$0")/.." || exit 1

USER_DEFAULT="tareeq@moslimleader.com"
printf 'عنوان الصندوق [%s]: ' "$USER_DEFAULT"
read -r MAILBOX
MAILBOX="${MAILBOX:-$USER_DEFAULT}"

printf 'كلمة المرور (لن تظهر أثناء الكتابة): '
read -rs MAILPASS
echo
if [ -z "$MAILPASS" ]; then echo "لم تُدخل كلمة مرور."; exit 1; fi

# نمرّرها بالبيئة لا بالوسائط: الوسائطُ تظهر في قائمة العمليات لكل من على الجهاز.
MAILBOX="$MAILBOX" MAILPASS="$MAILPASS" node - <<'EOF'
const nodemailer = require('nodemailer');
const fs = require('fs');

const env = {};
try {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
} catch { /* .env is optional here */ }

const user = process.env.MAILBOX;
const pass = process.env.MAILPASS;
const host = env.TAREEQ_SMTP_HOST || env.SMTP_HOST || 'smtp.titan.email';

console.log();
console.log('  الخادم:', host);
console.log('  الصندوق:', user);
console.log('  طول كلمة المرور:', pass.length, 'حرفًا');
// مسافةٌ في الطرف هي أشيعُ سببٍ لفشلٍ يبدو بلا سبب، ولا تُرى بالعين.
if (pass !== pass.trim()) console.log('  ⚠️  فيها مسافةٌ في أولها أو آخرها — وهذا وحده يكفي لرفض الدخول.');
if (/^["']|["']$/.test(pass)) console.log('  ⚠️  تبدأ أو تنتهي بعلامة اقتباس — هل نُسخت مع علاماتها؟');

// المنفذان معًا: بعض الحسابات تُقبل على 587 وتُرفض على 465 أو العكس.
async function attempt(port) {
  const t = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
  });
  try {
    await t.verify();
    return { port, ok: true };
  } catch (e) {
    return { port, ok: false, msg: e.message };
  } finally {
    t.close();
  }
}

(async () => {
  console.log();
  const results = [await attempt(465), await attempt(587)];
  for (const r of results) {
    if (r.ok) console.log(`  ✅ المنفذ ${r.port}: الدخول نجح`);
    else console.log(`  ❌ المنفذ ${r.port}: ${r.msg}`);
  }
  console.log();
  if (results.some(r => r.ok)) {
    const good = results.find(r => r.ok).port;
    console.log('  كلمةُ المرور صحيحة. فإن كان الفشلُ من .env فالعلّةُ في الملف:');
    console.log('  أعد كتابة السطر، وانتبه للمسافات وعلامات الاقتباس.');
    if (good !== 465) console.log(`  وأضِف كذلك: TAREEQ_SMTP_PORT=${good}`);
  } else {
    console.log('  الدخول مرفوضٌ على المنفذين، فليست المشكلةُ في الملف. راجع:');
    console.log('   ١. أن الصندوق أُنشئ فعلًا وظهر في لوحة Titan.');
    console.log('   ٢. أنك دخلتَ عليه مرةً من الويب ميل — بعضُ الصناديق لا تُفعَّل قبلها.');
    console.log('   ٣. أن كلمة المرور هي كلمةُ هذا الصندوق، لا كلمةُ حساب اللوحة.');
    console.log('   ٤. أن الصندوق لا يشترط كلمةَ مرورٍ خاصةً بالتطبيقات (app password).');
  }
})();
EOF
