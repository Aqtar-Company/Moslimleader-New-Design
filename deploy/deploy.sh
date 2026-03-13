#!/bin/bash
# ══════════════════════════════════════════════════════════════
# deploy.sh — Build & Upload Moslimleader Next.js to server
# ══════════════════════════════════════════════════════════════
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Requirements (on your machine):
#   - Node.js + npm installed
#   - SSH access to the server
#   - rsync installed
#
# Edit these variables before running:
# ══════════════════════════════════════════════════════════════

SERVER_USER="root"
SERVER_IP="YOUR_SERVER_IP"           # ← ضع IP السيرفر هنا
REMOTE_PATH="/var/www/moslimleader"  # ← مسار على السيرفر
SSH_KEY="~/.ssh/id_rsa"              # ← مفتاح SSH (اختياري)

# ── 1. Build ─────────────────────────────────────────────────
echo "📦 Building Next.js app..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting."
  exit 1
fi

echo "✅ Build complete. Output in ./out/"

# ── 2. Create remote directory ────────────────────────────────
echo "📁 Creating remote directory..."
ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_PATH"

# ── 3. Upload files ───────────────────────────────────────────
echo "🚀 Uploading to server..."
rsync -avz --delete \
  -e "ssh -i $SSH_KEY" \
  ./out/ \
  $SERVER_USER@$SERVER_IP:$REMOTE_PATH/out/

if [ $? -ne 0 ]; then
  echo "❌ Upload failed."
  exit 1
fi

# ── 4. Upload nginx config ────────────────────────────────────
echo "⚙️  Uploading nginx config..."
scp -i $SSH_KEY ./deploy/nginx.conf \
  $SERVER_USER@$SERVER_IP:/etc/nginx/sites-available/moslimleader

# ── 5. Enable site & reload nginx ────────────────────────────
echo "🔄 Enabling nginx site..."
ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP "
  ln -sf /etc/nginx/sites-available/moslimleader /etc/nginx/sites-enabled/moslimleader
  nginx -t && systemctl reload nginx
"

echo ""
echo "✅ Done! Site is live at https://moslimleader.com"
echo ""
echo "📌 Next steps:"
echo "   1. تأكد إن SSL شغال: sudo certbot --nginx -d moslimleader.com -d www.moslimleader.com"
echo "   2. لو الصور من WordPress لسه محتاجها: شوف التعليق في nginx.conf"
