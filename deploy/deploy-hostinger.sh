#!/bin/bash
# ══════════════════════════════════════════════════════════════
# deploy-hostinger.sh — رفع الموقع على Hostinger عبر FTP
# ══════════════════════════════════════════════════════════════
#
# المتطلبات على جهازك:
#   Linux/Mac: sudo apt install lftp  أو  brew install lftp
#   Windows:   استخدم FileZilla يدوياً (اقرأ DEPLOYMENT-STEPS-HOSTINGER.txt)
#
# قبل التشغيل:
#   1. عدّل المتغيرات أدناه (FTP_USER, FTP_PASS)
#   2. شغّل: chmod +x deploy/deploy-hostinger.sh && ./deploy/deploy-hostinger.sh
# ══════════════════════════════════════════════════════════════

# ── إعدادات Hostinger FTP ──────────────────────────────────────
FTP_SERVER="ftp.moslimleader.com"
FTP_USER="YOUR_FTP_USERNAME"    # ← من hPanel → Files → FTP Accounts
FTP_PASS="YOUR_FTP_PASSWORD"    # ← كلمة مرور FTP
REMOTE_DIR="/public_html"       # ← مجلد الموقع على Hostinger

# ══════════════════════════════════════════════════════════════

# ── 1. Build ──────────────────────────────────────────────────
echo "📦 Building Next.js static export..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting."
  exit 1
fi
echo "✅ Build complete → ./out/"

# ── 2. Backup تحذير ───────────────────────────────────────────
echo ""
echo "⚠️  تحذير: هذا السكريبت سيحذف محتوى public_html/ الحالي (WordPress)"
echo "   تأكد إنك أخذت backup من hPanel أولاً!"
echo ""
read -p "هل أخذت backup؟ (اكتب YES للمتابعة): " confirm
if [ "$confirm" != "YES" ]; then
  echo "❌ تم الإلغاء. خذ backup أولاً من hPanel → Backups"
  exit 1
fi

# ── 3. Upload via FTP ─────────────────────────────────────────
echo ""
echo "🚀 رفع الملفات على Hostinger..."

lftp -u "$FTP_USER","$FTP_PASS" "$FTP_SERVER" <<EOF
set ftp:ssl-allow true
set ssl:verify-certificate false
set net:timeout 30
set net:max-retries 3

# رفع كل محتوى out/ على public_html/
mirror --reverse --delete --verbose \
  --exclude .git \
  ./out/ $REMOTE_DIR/

bye
EOF

if [ $? -ne 0 ]; then
  echo "❌ FTP upload failed. تحقق من FTP credentials."
  exit 1
fi

echo ""
echo "✅ تم الرفع بنجاح!"
echo "🌐 افتح: https://moslimleader.com"
echo ""
echo "📌 إذا الصور مش ظاهرة:"
echo "   تأكد إن صور المنتجات موجودة في /public_html/images/"
