# دليل نشر مسلم ليدر على السيرفر الخاص

## المتطلبات على السيرفر

- Node.js 20+
- MySQL أو MariaDB
- PM2 (لتشغيل التطبيق في الخلفية)
- Nginx (اختياري، للـ reverse proxy)

---

## خطوات النشر

### 1. تحميل الكود من GitHub

```bash
git clone https://github.com/Aqtar-Company/Moslimleader-New-Design.git
cd Moslimleader-New-Design
npm install
```

### 2. إنشاء قاعدة البيانات

```sql
CREATE DATABASE mldb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mluser'@'localhost' IDENTIFIED BY 'كلمة_مرور_قوية';
GRANT ALL PRIVILEGES ON mldb.* TO 'mluser'@'localhost';
FLUSH PRIVILEGES;
```

### 3. إنشاء ملف `.env.local`

```dotenv
DATABASE_URL="mysql://mluser:كلمة_مرور_قوية@localhost:3306/mldb"
JWT_SECRET="سلسلة_عشوائية_طويلة_على_الأقل_32_حرف"
NODE_ENV="production"
ADMIN_EMAIL="admin@yourdomain.com"
ADMIN_PASSWORD="كلمة_مرور_المسؤول"
```

### 4. تهيئة قاعدة البيانات وتعبئة البيانات

```bash
export DATABASE_URL="mysql://mluser:كلمة_مرور_قوية@localhost:3306/mldb"
npx prisma db push
npm run db:seed
```

### 5. بناء التطبيق

```bash
npm run build
```

### 6. تشغيل التطبيق مع PM2

```bash
# تثبيت PM2
npm install -g pm2

# تشغيل التطبيق
pm2 start ecosystem.config.js

# تفعيل التشغيل التلقائي عند إعادة تشغيل السيرفر
pm2 startup
pm2 save
```

### 7. إعداد Nginx (اختياري)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## بيانات الدخول الافتراضية للأدمن

- **البريد الإلكتروني:** admin@moslimleader.com
- **كلمة المرور:** Admin@2026
- **رابط الأدمن:** `/admin/dashboard`

> **تنبيه:** غيّر بيانات الأدمن فور النشر على السيرفر الحقيقي!

---

## الصفحات الرئيسية

| الصفحة | الرابط |
|--------|--------|
| الصفحة الرئيسية | `/` |
| المتجر | `/shop` |
| سلة التسوق | `/cart` |
| الدفع | `/checkout` |
| المكتبة الرقمية | `/library` |
| تسجيل الدخول | `/auth` |
| لوحة الأدمن | `/admin/dashboard` |
