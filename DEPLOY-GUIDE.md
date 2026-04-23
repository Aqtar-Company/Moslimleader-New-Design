# دليل نشر مسلم ليدر — VPS (AlmaLinux)

## بيانات السيرفر الحالي

| | |
|---|---|
| **نظام التشغيل** | AlmaLinux (RHEL-based) |
| **مسار المشروع** | `/home/moslimleader.com/app` |
| **البورت** | 3000 (عبر Nginx reverse proxy) |
| **PM2 process** | id: 1 — name: `moslimleader` |
| **Nginx config** | `/etc/nginx/sites-available/moslimleader.com` |
| **SSL** | Let's Encrypt (Certbot) |

---

## النشر الأول (Fresh Deploy)

```bash
# 1. كلون المشروع
cd /home/moslimleader.com
git clone https://github.com/Aqtar-Company/Moslimleader-New-Design.git app
cd app

# 2. إنشاء ملف البيئة
cp .env.example .env
nano .env   # عدّل القيم الحقيقية

# 3. تثبيت الحزم
npm install --legacy-peer-deps

# 4. توليد Prisma Client وتحديث DB
npx prisma generate
npx prisma db push --skip-generate

# 5. بناء
npm run build

# 6. تشغيل مع PM2
pm2 start npm --name moslimleader -- start
pm2 save
pm2 startup
```

---

## تحديث الكود (بعد merge على main)

```bash
cd /home/moslimleader.com/app
git fetch origin
git reset --hard origin/main
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push --skip-generate
npm run build
pm2 restart 1 --update-env
pm2 save
```

---

## ملفات المحتوى المهمة

| المجلد | المحتوى |
|--------|---------|
| `public/covers/` | أغلفة الكتب (مرفوعة من الأدمن) |
| `public/books/` | ملفات PDF للكتب |
| `public/` | صور الموقع العامة |

> **تنبيه:** هذه المجلدات **لا تُحفظ في git** — عند نشر على سيرفر جديد انسخها يدوياً من السيرفر القديم.

```bash
cp -r /old-path/public/covers /home/moslimleader.com/app/public/
cp -r /old-path/public/books  /home/moslimleader.com/app/public/
```

---

## متغيرات البيئة المطلوبة

انظر ملف `.env.example` للقائمة الكاملة.

المتغيرات الأساسية:
- `DATABASE_URL` — رابط MySQL
- `JWT_SECRET` — مفتاح التشفير (32 حرف على الأقل)
- `NEXT_PUBLIC_BASE_URL` — رابط الموقع
- `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` — PayPal
- `SMTP_*` — إعدادات البريد (Titan Email)

---

## لوحة الأدمن

- **الرابط:** `https://moslimleader.com/admin/dashboard`
- **الدخول:** عبر نفس صفحة `/auth` بحساب admin

---

## GitHub Actions (Auto Deploy)

عند كل push على `main` يتم تلقائياً:
1. SSH للسيرفر
2. `git reset --hard origin/main`
3. `npm run build`
4. `pm2 restart`

**Secrets المطلوبة في GitHub:**

| Secret | القيمة |
|--------|--------|
| `VPS_HOST` | عنوان IP السيرفر |
| `VPS_USER` | `root` |
| `VPS_PASSWORD` | كلمة مرور الـ root |

---

## أوامر مفيدة

```bash
pm2 status               # حالة التطبيق
pm2 logs 1 --lines 50    # آخر 50 سطر من الـ logs
pm2 restart 1            # إعادة تشغيل
nginx -t                 # تحقق من إعدادات Nginx
systemctl reload nginx   # تحديث Nginx
```
