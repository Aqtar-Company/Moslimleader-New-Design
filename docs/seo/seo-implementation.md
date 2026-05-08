# SEO Implementation — ملخص ما تم في الكود

## ✅ Phase 1: Technical SEO

### 1. Sitemap (ديناميكي)
- **File:** `src/app/sitemap.ts`
- **URL:** `https://moslimleader.com/sitemap.xml`
- **Output:** يحتوي على:
  - الصفحات الثابتة: `/`, `/shop`, `/library`, `/about`, `/auth`
  - كل المنتجات في DB (`Product.inStock = true`)
  - المنتجات الـ static اللي مش متكررة في الـ DB
  - كل الكتب المنشورة (`Book.isPublished = true`)
  - كل سلاسل الكتب (`/library/series/[id]/buy`)
- **Update:** `revalidate = 3600` (يعيد التوليد كل ساعة)

### 2. Robots.txt (ديناميكي)
- **File:** `src/app/robots.ts`
- **URL:** `https://moslimleader.com/robots.txt`
- **Allows:** كل الموقع العام
- **Disallows:** `/admin/`, `/api/`, `/auth/`, `/account/`, `/cart`, `/checkout`, `/wishlist`, `/invoice/`, `/verify-email`
- **Sitemap reference:** ✓

### 3. Canonical URLs
- **Helper:** `src/lib/seo.ts` → `canonical(path)`
- **Applied to:**
  - `/` (Home)
  - `/about`
  - `/library` (list)
  - `/library/[id]` (each book)
  - `/shop/[slug]` (each product)

### 4. Image Optimization
- **Status:** `images.unoptimized = true` (لم يتم تغييره — متعمَّد للسيرفر بنية الملفات)
- **Lazy loading:** كل الصور في `RelatedProducts` بـ `loading="lazy"`
- **Sizing:** `sizes` attr مضاف للصور عشان Next.js يعرف يحمّل الحجم المناسب

---

## ✅ Phase 2: On-Page SEO

### Product Pages (`/shop/[slug]`)
- **Title:** `<product-name> | <category> | مسلم ليدر`
- **Description:** يستخدم `shortDescription` أو يقصّ من `description` (≤160 حرف)
- **Keywords:** اسم المنتج + الفئة + 3 كلمات عامة
- **OpenGraph + Twitter Cards:** صورة 1200×1200 + alt
- **Canonical URL:** ✓
- **JSON-LD:**
  - `Product` schema مع `Offer` (price, currency EGP, availability)
  - `BreadcrumbList` schema (الرئيسية → المتجر → الفئة → المنتج)

### Book Pages (`/library/[id]`)
- **Title:** `<book-title> | كتاب رقمي | مسلم ليدر`
- **Description:** من `book.description`
- **Canonical URL:** ✓
- **JSON-LD:** `Book` schema مع `Offer` (إذا كان السعر > 0)
- **OpenGraph type:** `book`

### Home Page (`/`)
- **Title:** `مسلم ليدر | متجر تربوي إسلامي للأطفال — كتب وألعاب ومنتجات راقية`
- **Description:** وصف مختصر للموقع
- **Keywords:** 6 keywords أساسية
- **JSON-LD:**
  - `Organization` (الاسم، الوصف، اللوجو، المنصات الاجتماعية)
  - `WebSite` (مع `SearchAction` schema)

### Library List (`/library`)
- **Title:** `المكتبة الرقمية | كتب أطفال إسلامية مصوَّرة — مسلم ليدر`
- **Canonical URL:** ✓
- **OpenGraph:** ✓

### About (`/about`)
- **Title:** `عن مسلم ليدر | منتجات تربوية إسلامية للأطفال`
- **Canonical URL:** ✓

### Image Alt Text
- ✅ `ProductCard`: `alt={displayName}`
- ✅ `ProductDetailClient` main image: `alt={displayName}`
- ✅ `RelatedProducts`: `alt={\`${name} — ${category}\`}` (descriptive)
- ⚠️ Thumbnail images في detail page: `alt=""` للصور الإضافية — مقبول لأنها متاحة للتنقل فقط، الصورة الرئيسية موصوفة.

---

## ✅ Phase 4: Internal Linking

### Related Products
- **Component:** `src/components/product/RelatedProducts.tsx`
- **Logic:** نفس الفئة، استبعاد المنتج الحالي، حد أقصى 4 منتجات
- **Order:** يفضّل DB (live prices) ثم static products
- **Crawlable:** Server component فعلي — اللينكات موجودة في HTML قبل JS
- **Mounted on:** `/shop/[slug]/page.tsx`

### Cross-page Links (تم سابقاً قبل الـ SEO)
- Footer: روابط لـ Shop, Library, About
- Header: روابط لـ Shop, Library, Cart
- Each product → category filter
- Each category page → product list

---

## 📋 Phase 3, 5, 6: ملفات مرجعية

| File | Content |
|---|---|
| `docs/seo/content-strategy.md` | 20 article outline + 3 sample articles |
| `docs/seo/backlinks-and-gsc.md` | Backlink strategy + Search Console guide |
| `docs/seo/seo-implementation.md` | الملف ده — ملخص التنفيذ |

---

## 🚀 خطوات النشر على Live

```bash
cd /home/moslimleader.com/app
git fetch origin claude/add-bosta-shipping-wOtW6
git reset --hard origin/claude/add-bosta-shipping-wOtW6
npm run build
pm2 restart 1 --update-env
```

(مفيش schema جديد في DB، مش محتاج `prisma db push`.)

---

## 🧪 خطوات التحقق بعد الرفع

1. افتح `https://moslimleader.com/sitemap.xml` — لازم تشوف XML بكل المنتجات والكتب
2. افتح `https://moslimleader.com/robots.txt` — لازم تشوف rules + sitemap reference
3. افتح أي صفحة منتج، اعمل View Page Source وابحث عن `application/ld+json` — لازم تلاقي 2 JSON blocks (Product + BreadcrumbList)
4. افتح [Rich Results Test](https://search.google.com/test/rich-results)، حط رابط منتج، تأكد إن Google يفهم الـ Product schema
5. افتح [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)، حط الرئيسية
6. روح Google Search Console > Sitemaps > أضف `https://moslimleader.com/sitemap.xml`
7. اطلب فهرسة الصفحات في Tier 1 (الرئيسية، المكتبة، عن الشركة)

---

## 📈 KPIs للمتابعة

| الفترة | المقياس | الهدف |
|---|---|---|
| Week 1 | Sitemap pages submitted | 100% from sitemap |
| Week 2 | Pages indexed | 70%+ من الـ submitted |
| Month 1 | Impressions على Search Console | > 1000 في الشهر |
| Month 2 | Average position | < 30 |
| Month 3 | Top queries position | 5 keywords في top 10 |
| Month 6 | Organic traffic | 30%+ من إجمالي الزوار |
