# تشغيل reels-studio على السيرفر — خطوة بخطوة

السيرفر: `moslimleader.com` — CentOS/RHEL 9 — المسار `/home/moslimleader.com/app`

> **نفّذ المراحل بالترتيب.** المرحلة ٢ بتصرف فلوس حقيقية. متعديهاش قبل ما
> المرحلة ١ تخلص وتطلع `doctor` نضيف.

---

## المرحلة ١ — التجهيز (مفيش أي صرف)

### ١. اجيب الكود على السيرفر

الشغل على فرع `claude/eloquent-bardeen-4h3sk5`، والفرع الرسمي للنشر `main`.
اختار واحدة:

**(أ) ادمج في main الأول — الموصى به**، وبعدين اعمل الديبلوي العادي من
`CLAUDE.md` (باك أب قاعدة البيانات → `git reset --hard origin/main` → `npm ci` → build).

**(ب) جرّب الفرع لوحده الأول** من غير ما تلمس `main`:

```bash
cd /home/moslimleader.com/app
git fetch origin claude/eloquent-bardeen-4h3sk5
git checkout claude/eloquent-bardeen-4h3sk5
```

> `reels-studio/` مشروع منفصل تماماً — مفيهوش أي كود Next.js.
> جلبه **مش محتاج** `npm run build` ولا `pm2 restart` للموقع.

### ٢. ثبّت ffmpeg

ffmpeg مش موجود في مستودعات RHEL 9 الأساسية ولا في EPEL. قدامك طريقين:

**(أ) بناء ثابت — الموصى به على السيرفر ده.** مابيلمسش أي حزمة نظام،
فمستحيل يتعارض مع ليتسبيد/نجينكس/PHP الموجودين:

```bash
cd /usr/local/src
curl -LO https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar xf ffmpeg-release-amd64-static.tar.xz
cp ffmpeg-*-static/ffmpeg ffmpeg-*-static/ffprobe /usr/local/bin/
chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe
ffmpeg -version | head -1
```

**(ب) عبر RPM Fusion** — بيضيف مستودع خارجي للنظام:

```bash
dnf install -y epel-release
dnf config-manager --set-enabled crb
dnf install -y --nogpgcheck https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-9.noarch.rpm
dnf install -y ffmpeg
```

تأكد إن البناء فيه `libass` و`libfribidi` و`libharfbuzz` — التلاتة لازمين
لتشكيل الحروف العربية في السَبتايتل:

```bash
ffmpeg -version | grep -oE 'enable-(libass|libfribidi|libharfbuzz)'
```

### ٣. ثبّت الخط العربي

```bash
dnf install -y google-noto-sans-arabic-fonts fontconfig
fc-cache -f
fc-match "Noto Sans Arabic"     # لازم يرجّع NotoSansArabic-Regular.ttf
```

> ⚠️ لو الخط ناقص، fontconfig بيرجّع خط بديل **في صمت** — من غير أي رسالة
> خطأ — والسَبتايتل بيطلع حروف مقطّعة. `doctor` بيكشف الحالة دي.

### ٤. اتأكد من نسخة Node

```bash
node -v      # لازم 20 أو أعلى
```

### ٥. ثبّت حزم المشروع

```bash
cd /home/moslimleader.com/app/reels-studio
npm ci
```

### ٦. ظبّط المفاتيح

```bash
cp .env.example .env
nano .env
```

املا الاتنين دول:

| المفتاح | منين | ملاحظة |
|---|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | **لازم تفعّل الفوترة.** اشتراك Flow لا يدي وصول API |
| `ANTHROPIC_API_KEY` | console.anthropic.com | لتقسيم السكريبت لمشاهد |

```bash
chmod 600 .env      # فيه مفاتيح — مايتقراش غير من الـ root
```

### ٧. ارفع الأصول

```bash
# لوجو الخاتمة
cp /home/moslimleader.com/app/public/ml-logo-new.png assets/logo.png

# صور الكاركتر — من 1 لـ 3 صور
mkdir -p characters/<اسم-الكاركتر>/refs
# ارفعها بـ scp من جهازك:
#   scp وش1.png root@moslimleader.com:/home/moslimleader.com/app/reels-studio/characters/<الاسم>/refs/
```

> **دي أهم خطوة في الفلو كله.** من غير الصور المرجعية، كل ريل هيطلع بوش
> مختلف مهما كان الوصف دقيق. الصور هي اللي بتثبّت الشخصية، مش النص.

### ٨. الفحص الشامل

```bash
node src/cli.mjs doctor
```

**متعديش للمرحلة ٢ غير لما كل السطور تبقى ✓.**

---

## المرحلة ٢ — أول ريل (هنا بيبدأ الصرف)

### ٩. اعمل الكاركتر والسكريبت

```bash
node src/cli.mjs new-character ameen
nano characters/ameen/profile.json       # الوصف بالإنجليزي

node src/cli.mjs new-script episode-01
nano scripts/episode-01.md               # السكريبت بالعربي، ~25 كلمة
```

### ١٠. تجربة جافة — صفر تكلفة

```bash
node src/cli.mjs make ameen episode-01 --dry-run
```

بيطبع برومبتات Veo بالظبط زي ما هتتبعت، **من غير أي استدعاء API**.
اقراها: الوصف مظبوط؟ الكاركتر متوصّف صح؟ المشاهد منطقية؟

### ١١. أول ريل حقيقي

اتأكد الأول إنك على أرخص إعداد:

```bash
grep -E 'REELS_TIER|REELS_RESOLUTION|REELS_MAX_COST' .env
# REELS_TIER=fast  REELS_RESOLUTION=720p  REELS_MAX_COST_USD=3.00
```

```bash
node src/cli.mjs make ameen episode-01
```

بياخد ٢-٥ دقايق. التكلفة ~$1.00.

### ١٢. راجع الناتج

```bash
ls -lh out/*/final.mp4
cat out/*/manifest.json | grep -E 'status|spentUsd'
```

نزّله على جهازك وشوفه بعينك:

```bash
scp root@moslimleader.com:/home/moslimleader.com/app/reels-studio/out/*/final.mp4 .
```

**شوف تحديداً:** الوش ثابت بين المشهدين؟ السَبتايتل تحت ومقروء؟ الصوت
مستمر على الخاتمة؟ اللوجو في النص؟

لو حاجة غلط، عدّل وأعد — الكليبات المتولّدة مش هتتعاد ومش هتتدفع تاني:

```bash
node src/cli.mjs make ameen episode-01 --resume <reel-id>
```

### ١٣. ارفع الجودة للنسخة النهائية

لما تبقى راضي عن الشكل:

```bash
nano .env     # REELS_TIER=std  و  REELS_RESOLUTION=1080p
node src/cli.mjs make ameen episode-01 --force
```

> `std` أغلى ٤ أضعاف. خلّي التجارب كلها على `fast`، وحوّل لـ `std`
> في آخر تشغيلة بس.

---

## المرحلة ٣ — الأتمتة

### ١٤. جرّب الطابور يدوياً

```bash
node src/cli.mjs enqueue ameen episode-02
node src/cli.mjs enqueue ameen episode-03
node src/cli.mjs run-queue --limit 1      # ريل واحد بس للتجربة
```

### ١٥. فعّل الجدولة

```bash
cp ops/reels-cron.sh /etc/cron.daily/reels-studio
chmod +x /etc/cron.daily/reels-studio
```

أو بتوقيت محدد (٣ صباحاً يومياً):

```bash
crontab -e
# 0 3 * * * /home/moslimleader.com/app/reels-studio/ops/reels-cron.sh
```

السكربت فيه `flock` — تشغيلين متوازيين مستحيل، فمفيش صرف مضاعف على نفس
المهمة. والمهمة الفاشلة بتتسجّل `failed` مش `pending`، فالـ cron مابيفضلش
يكررها ويحرق فلوس.

### ١٦. فعّل تنظيف الديسك — لا تتخطى دي

```bash
cp ops/reels-cleanup.sh /etc/cron.daily/reels-cleanup
chmod +x /etc/cron.daily/reels-cleanup
```

الريل ~٧ ميجا. السقف الافتراضي ٦٠ ريل = ~٤٢٠ ميجا **ثابتة للأبد**.
السياسة بالعدد مش بالعمر — نفس الدرس اللي اتعلمناه مرتين في `/root/backups`
(٦.٧ جيجا في ٢٠٢٦-٠٧-٢٣، و١٧ جيجا في ٢٠٢٦-٠٩-٠٧).

---

## المتابعة اليومية

```bash
cd /home/moslimleader.com/app/reels-studio

node src/cli.mjs list                          # الكاركترات والسكريبتات والريلز
tail -50 logs/cron-$(date +%Y%m%d).log         # لوج آخر تشغيلة
du -sh out/                                    # حجم المخرجات
grep -h spentUsd out/*/manifest.json | awk -F: '{s+=$2} END {print "إجمالي الصرف: $" s}'
```

---

## لو حصلت مشكلة

| العَرَض | الفحص | الحل |
|---|---|---|
| `ffmpeg فشل` | `ffmpeg -version` | راجع خطوة ٢ |
| سَبتايتل حروف مقطّعة | `fc-match "Noto Sans Arabic"` | راجع خطوة ٣ |
| الوش بيتغير كل ريل | `ls characters/*/refs/` | حطّ ١-٣ صور — خطوة ٧ |
| `مفيش فيديو في الرد` | فلتر محتوى Veo رفض البرومبت | بسّط `veoPrompt` في `manifest.json` ثم `--resume` |
| `403` من Gemini | الفوترة مش مفعّلة | فعّلها في Google Cloud Console |
| cron مابيشتغلش | `ls -l /etc/cron.daily/reels-studio` | لازم يكون executable ومن غير امتداد `.sh` |
| الديسك بيتملى | `du -sh out/` | راجع خطوة ١٦ |

**توقف طارئ عن الصرف:**

```bash
rm -f /etc/cron.daily/reels-studio
# أو خلّي السقف صفر:
echo 'REELS_MAX_COST_USD=0' >> .env
```
