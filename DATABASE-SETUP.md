# إعداد قاعدة البيانات — Hostinger MySQL

## الخطوة 1: إنشاء قاعدة بيانات على Hostinger

1. افتح hPanel → **Databases → MySQL Databases**
2. اضغط **Create New Database**
3. سجّل:
   - اسم قاعدة البيانات: `u460609394_mldb`
   - اسم المستخدم: `u460609394_mluser`
   - كلمة المرور: (اختر كلمة قوية)
4. اضغط **Create** ثم اضغط **+ Add User** للربط

---

## الخطوة 2: معرفة Host قاعدة البيانات

في hPanel → Databases، ستجد **MySQL Host** — عادةً:
```
localhost   (إذا كانت التطبيق على نفس السيرفر)
# أو
sql123.main-hosting.eu   (للاتصال الخارجي)
```

---

## الخطوة 3: إنشاء ملف `.env.local`

أنشئ ملف `.env.local` في جذر المشروع:

```env
DATABASE_URL="mysql://u460609394_mluser:YOUR_DB_PASSWORD@localhost:3306/u460609394_mldb"
JWT_SECRET="your-super-secret-random-string-at-least-32-chars"
NODE_ENV="production"
```

---

## الخطوة 4: تهيئة الجداول

```bash
# إنشاء الجداول في قاعدة البيانات
npm run db:push

# أو باستخدام migrations (مستحسن للإنتاج)
npm run db:migrate
```

---

## الخطوة 5: تعبئة البيانات الأولية

```bash
# إضافة المنتجات وحساب المسؤول
npm run db:seed
```

سيُنشئ الـ seed:
- جميع المنتجات (23 منتج)
- حساب مسؤول افتراضي

يمكنك تخصيص بيانات المسؤول:
```env
ADMIN_EMAIL="your@email.com"
ADMIN_PASSWORD="YourSecurePassword"
```

---

## الخطوة 6: النشر على Netlify

1. ادفع الكود لـ GitHub
2. افتح Netlify → **New site from Git**
3. أضف Environment Variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
4. Build command: `npm run build`
5. Publish directory: `.next`

### ملاحظة هامة:
إذا كانت MySQL على Hostinger Shared Hosting، تأكد من:
- تفعيل **Remote MySQL** في hPanel لتسمح لـ Netlify بالاتصال
- أو استخدم **PlanetScale** / **Railway** كبديل مجاني لقاعدة بيانات MySQL السحابية

---

## الخطوة 7: النشر على Hostinger (Node.js)

إذا ترقّيت لخطة تدعم Node.js:
```bash
npm run build
npm start
```

---

## هيكل قاعدة البيانات

| الجدول | الوصف |
|--------|-------|
| `User` | المستخدمين والمسؤولين |
| `Product` | المنتجات |
| `Order` | الطلبات |
| `OrderItem` | عناصر كل طلب |
| `Cart` | سلة التسوق |
| `CartItem` | عناصر السلة |
| `ShippingRate` | أسعار الشحن لكل محافظة |
| `Coupon` | كودات الخصم |
| `Review` | تقييمات المنتجات |
