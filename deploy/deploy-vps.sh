#!/bin/bash
# ══════════════════════════════════════════════════════════════
# deploy-vps.sh — نشر الموقع على Hostinger VPS عبر SSH
# ══════════════════════════════════════════════════════════════
#
# المتطلبات:
#   - SSH key مضافة على السيرفر (أو كلمة مرور)
#   - rsync مثبت على جهازك
#
# التشغيل:
#   chmod +x deploy/deploy-vps.sh
#   ./deploy/deploy-vps.sh
# ══════════════════════════════════════════════════════════════

VPS_IP="YOUR_VPS_IP"
VPS_USER="root"
REMOTE_DIR="/var/www/moslimleader"
APP_NAME="moslimleader"

# ── 1. Build محلياً ────────────────────────────────────────────
echo "جاري البناء..."
npm run build

if [ $? -ne 0 ]; then
  echo "فشل البناء. تم الإيقاف."
  exit 1
fi
echo "تم البناء بنجاح."

# ── 2. رفع الملفات عبر rsync ──────────────────────────────────
echo ""
echo "جاري الرفع على VPS..."

rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env.local' \
  --exclude='.DS_Store' \
  ./ "$VPS_USER@$VPS_IP:$REMOTE_DIR/"

if [ $? -ne 0 ]; then
  echo "فشل الرفع. تحقق من اتصال SSH."
  exit 1
fi

# ── 3. تثبيت الـ dependencies وإعادة التشغيل ──────────────────
echo ""
echo "جاري التحديث على السيرفر..."

ssh "$VPS_USER@$VPS_IP" "
  cd $REMOTE_DIR
  npm install --production
  npm run db:migrate 2>/dev/null || true
  pm2 reload $APP_NAME --update-env
  echo 'تم التحديث بنجاح!'
"

if [ $? -ne 0 ]; then
  echo "فشل التحديث على السيرفر."
  exit 1
fi

echo ""
echo "تم النشر بنجاح!"
echo "افتح: https://moslimleader.com"
