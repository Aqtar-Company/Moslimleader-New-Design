#!/bin/bash
# ══════════════════════════════════════════════════════════════
# deploy-hostinger.sh — رفع الموقع على Hostinger عبر FTP
# ══════════════════════════════════════════════════════════════
#
# المتطلبات:
#   Linux/Mac/WSL: sudo apt install lftp
#   Windows:       استخدم FileZilla (راجع DEPLOYMENT-STEPS-HOSTINGER.txt)
#
# التشغيل:
#   chmod +x deploy/deploy-hostinger.sh
#   ./deploy/deploy-hostinger.sh
# ══════════════════════════════════════════════════════════════

FTP_SERVER="217.196.54.78"
FTP_USER="u460609394.moslimleader.com"
FTP_PASS="Aqtar@FTP@5"
REMOTE_DIR="/public_html"
LOCAL_DIR="./out"

# ── 1. Build ──────────────────────────────────────────────────
echo "جاري البناء..."
npm run build

if [ $? -ne 0 ]; then
  echo "فشل البناء. تم الإيقاف."
  exit 1
fi
echo "تم البناء بنجاح → ./out/"

# ── 2. تحقق من وجود مجلد out ────────────────────────────────
if [ ! -d "$LOCAL_DIR" ]; then
  echo "مجلد out/ مش موجود!"
  exit 1
fi

# ── 3. Upload via FTP ─────────────────────────────────────────
echo ""
echo "جاري الرفع على Hostinger..."

lftp -u "$FTP_USER","$FTP_PASS" "$FTP_SERVER" <<EOF
set ftp:passive-mode yes
set ftp:ssl-allow true
set ssl:verify-certificate false
set net:timeout 60
set net:max-retries 5
set net:reconnect-interval-base 5

mirror --reverse --delete --verbose \
  --exclude .git \
  --exclude .DS_Store \
  $LOCAL_DIR/ $REMOTE_DIR/

bye
EOF

if [ $? -ne 0 ]; then
  echo "فشل الرفع. تحقق من اتصال الإنترنت."
  exit 1
fi

echo ""
echo "تم الرفع بنجاح!"
echo "افتح: https://moslimleader.com"
