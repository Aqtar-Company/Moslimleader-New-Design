import { Product, Category } from '@/types';

const BASE = 'https://moslimleader.com/wp-content/uploads';

export const products: Product[] = [
  {
    id: '1',
    slug: 'feast-day-game',
    name: 'لعبة يوم الصائم',
    nameEn: 'The Fasting Day Game',
    shortDescription: 'لعبة لوحية جماعية يلعبها لاعبين فأكثر',
    shortDescriptionEn: 'A group board game for 2 or more players',
    description: `<p>لعبة لوحية جماعية تساعد الأطفال على تعلم قيم الصيام بطريقة ممتعة وتفاعلية.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (4 × 32.5 × 25 سم)</li>
  <li>لوحة من الكرتون المقوى (43 × 30.5 سم)</li>
  <li>6 كروت مجموعتين (9 × 5 سم)</li>
  <li>4 فيشات بلاستيك</li>
  <li>جدول متابعة يومي</li>
  <li>سيسكة إلكترونية</li>
</ul>`,
    descriptionEn: `<p>A group board game that helps children learn the values of fasting in a fun and interactive way.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (4 × 32.5 × 25 cm)</li>
  <li>Heavy cardboard board (43 × 30.5 cm)</li>
  <li>6 cards in 2 sets (9 × 5 cm)</li>
  <li>4 plastic tokens</li>
  <li>Daily tracking chart</li>
  <li>Electronic buzzer</li>
</ul>`,
    price: 230,
    category: 'ألعاب تعليمية',
    tags: ['لعبة', 'صيام', 'رمضان', 'تربوية'],
    images: [
      `${BASE}/2024/07/Feast-Day-1.webp`,
      `${BASE}/2024/07/Feast-Day-2.webp`,
      `${BASE}/2024/07/Feast-Day-3.webp`,
      `${BASE}/2024/07/Feast-Day-4.webp`,
      `${BASE}/2024/07/Feast-Day-5.webp`,
      `${BASE}/2024/07/Feast-Day-6.webp`,
    ],
    inStock: true,
    videos: ['4Z7asM6e9IM', 'PkF7SmB8k_E'],
  },
  {
    id: '2',
    slug: 'leader-medal',
    name: 'وسام القائد',
    nameEn: "The Leader's Medal",
    shortDescription: 'لوحة أوسمة لمهام القائد',
    shortDescriptionEn: 'A medals board for leader tasks',
    description: `<p>لوحة أوسمة تحفيزية تساعد الأطفال على إنجاز مهامهم اليومية وتطوير شخصيتهم القيادية.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (39 × 50 × 3.3 سم)</li>
  <li>20 كارت من الكرتون المقوى (7 × 9.5 سم)</li>
  <li>لوحة الأوسمة (48 × 32 سم)</li>
  <li>20 وسام (6 × 6.5 سم تقريباً)</li>
  <li>شهادة تقدير تشجيعية A4</li>
  <li>ستيكر نجوم مستوى</li>
</ul>`,
    descriptionEn: `<p>A motivational medals board that helps children accomplish their daily tasks and develop their leadership character.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (39 × 50 × 3.3 cm)</li>
  <li>20 heavy cardboard cards (7 × 9.5 cm)</li>
  <li>Medals board (48 × 32 cm)</li>
  <li>20 medals (approx. 6 × 6.5 cm)</li>
  <li>Encouraging appreciation certificate A4</li>
  <li>Level star stickers</li>
</ul>`,
    price: 320,
    category: 'ألعاب تعليمية',
    tags: ['قيادة', 'تربية', 'شخصية'],
    images: [
      `${BASE}/2024/07/Leader-Medal.webp`,
      `${BASE}/2024/07/Leader-Medal-1.webp`,
      `${BASE}/2024/07/Leader-Medal-2.webp`,
      `${BASE}/2024/07/Leader-Medal-3.webp`,
      `${BASE}/2024/07/Leader-Medal-4.webp`,
      `${BASE}/2024/07/Leader-Medal-5.webp`,
      `${BASE}/2024/07/Leader-Medal-6.webp`,
    ],
    inStock: true,
  },
  {
    id: '3',
    slug: 'preparing-leaders',
    name: 'إعداد القادة',
    nameEn: 'Preparing Leaders',
    shortDescription: 'كروت معلومات ونوتة وجدول مهام',
    shortDescriptionEn: 'Info cards, notebook, and task schedule',
    description: `<p>مجموعة متكاملة لإعداد القائد المسلم الصغير من خلال كروت معلومات ثرية ونوتة ومهام يومية.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (4 × 32.5 × 25 سم)</li>
  <li>13 كارت من الكرتون المقوى (23 × 16 سم)</li>
  <li>نوت بوك مسلم ليدر (15 × 17 سم)</li>
  <li>جدول مهام القائد ورقي A3</li>
  <li>بادج مسلم ليدر</li>
</ul>`,
    descriptionEn: `<p>A comprehensive set for preparing the young Muslim leader through rich info cards, a notebook, and daily tasks.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (4 × 32.5 × 25 cm)</li>
  <li>13 heavy cardboard cards (23 × 16 cm)</li>
  <li>Muslim Leader notebook (15 × 17 cm)</li>
  <li>A3 leader task schedule</li>
  <li>Muslim Leader badge</li>
</ul>`,
    price: 230,
    category: 'ألعاب تعليمية',
    tags: ['قيادة', 'تربية', 'تعليم'],
    images: [
      `${BASE}/2024/07/Muslim-Leaders-1.webp`,
      `${BASE}/2024/07/Muslim-Leaders-2.webp`,
      `${BASE}/2024/07/Muslim-Leaders-3.webp`,
    ],
    inStock: true,
  },
  {
    id: '4',
    slug: 'pray-hajj-game',
    name: 'لعبة الصلاة وقصة الحج',
    nameEn: 'The Prayer & Hajj Game',
    shortDescription: 'تطبيقان بتقنية AR لتعليم الصلاة والحج',
    shortDescriptionEn: 'Two AR apps for learning prayer and Hajj',
    description: `<p>مجموعة تعليمية متكاملة تجمع بين اللعبة التفاعلية وتقنية الواقع المعزز AR لتعليم الصلاة ورحلة الحج.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (37 × 28 × 2.2 سم)</li>
  <li>لوحة تعلم الصلاة من الفوم (36.8 × 28 × 0.9 سم)</li>
  <li>لوح بازل من الفوم مطبوع وجهين (36.8 × 28 × 0.9 سم)</li>
  <li>كتيب تعلم رحلة الحج كاملة</li>
  <li>سجادة صلاة</li>
  <li>ورق شرح الاستخدام</li>
  <li>قلم White Board</li>
</ul>
<p><strong>التطبيقات مجانية على Google Play</strong></p>`,
    descriptionEn: `<p>A comprehensive educational set combining an interactive game and Augmented Reality (AR) technology to teach prayer and the Hajj journey.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (37 × 28 × 2.2 cm)</li>
  <li>Foam prayer learning board (36.8 × 28 × 0.9 cm)</li>
  <li>Double-sided printed foam puzzle board (36.8 × 28 × 0.9 cm)</li>
  <li>Complete Hajj journey learning booklet</li>
  <li>Prayer rug</li>
  <li>Usage instruction sheet</li>
  <li>White Board marker</li>
</ul>
<p><strong>Apps are free on Google Play</strong></p>`,
    price: 250,
    category: 'ألعاب تعليمية',
    tags: ['صلاة', 'حج', 'تعليم', 'AR'],
    images: [
      `${BASE}/2024/07/Pray-and-Hajj-1.webp`,
      `${BASE}/2024/07/Pray-and-Hajj-2.webp`,
      `${BASE}/2024/07/Pray-and-Hajj-3.webp`,
      `${BASE}/2024/07/Pray-and-Hajj-4.webp`,
      `${BASE}/2024/07/Pray-and-Hajj-5.webp`,
      `${BASE}/2024/07/Pray-and-Hajj-6.webp`,
    ],
    inStock: true,
    featured: true,
  },
  {
    id: '5',
    slug: 'puzzle-boys',
    name: 'تكوين (أولاد)',
    nameEn: 'Formation (Boys)',
    shortDescription: 'بازل أولاد — 6 قطع لـ 6 أشكال مختلفة',
    shortDescriptionEn: "Boys' puzzle — 6 pieces for 6 different shapes",
    description: `<p>بازل تعليمي مخصص للأولاد يحتوي على 6 قطع بأشكال ملهمة تنمي مهارات التفكير والتركيز.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (3 × 18 × 18 سم)</li>
  <li>6 ألواح بازل من الورق المقوى (15 × 15 سم)</li>
</ul>`,
    descriptionEn: `<p>An educational puzzle designed for boys with 6 inspiring shapes that develop thinking and focus skills.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (3 × 18 × 18 cm)</li>
  <li>6 cardboard puzzle boards (15 × 15 cm)</li>
</ul>`,
    price: 160,
    category: 'ألعاب تعليمية',
    tags: ['بازل', 'أولاد', 'تعليم'],
    images: [
      `${BASE}/2024/07/Puzzle-Boys-1.webp`,
      `${BASE}/2024/07/Puzzle-Boys-2.webp`,
      `${BASE}/2024/07/Puzzle-Boys-3.webp`,
      `${BASE}/2024/07/Puzzle-Boys-4.webp`,
    ],
    inStock: true,
  },
  {
    id: '6',
    slug: 'puzzle-girls',
    name: 'تكوين (بنات)',
    nameEn: 'Formation (Girls)',
    shortDescription: 'بازل بنات — 6 قطع لـ 6 أشكال مختلفة',
    shortDescriptionEn: "Girls' puzzle — 6 pieces for 6 different shapes",
    description: `<p>بازل تعليمي مخصص للبنات يحتوي على 6 قطع بأشكال ملهمة تنمي مهارات التفكير والتركيز.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (3 × 18 × 18 سم)</li>
  <li>6 ألواح بازل من الورق المقوى (15 × 15 سم)</li>
</ul>`,
    descriptionEn: `<p>An educational puzzle designed for girls with 6 inspiring shapes that develop thinking and focus skills.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (3 × 18 × 18 cm)</li>
  <li>6 cardboard puzzle boards (15 × 15 cm)</li>
</ul>`,
    price: 160,
    category: 'ألعاب تعليمية',
    tags: ['بازل', 'بنات', 'تعليم'],
    images: [
      `${BASE}/2024/07/Puzzle-Girls-1.webp`,
      `${BASE}/2024/07/Puzzle-Girls-2.webp`,
      `${BASE}/2024/07/Puzzle-Girls-3.webp`,
      `${BASE}/2024/07/Puzzle-Girls-4.webp`,
    ],
    inStock: true,
  },
  {
    id: '7',
    slug: 'alwah',
    name: 'ألواح',
    nameEn: 'Writing Boards (Alwah)',
    shortDescription: 'لتعليم وتلقي القرآن الكريم',
    shortDescriptionEn: 'For teaching and learning the Holy Quran',
    description: `<p>ألواح خشبية مميزة لتعليم الأطفال القرآن الكريم بطريقة مبتكرة وممتعة مع تطبيق مجاني على Google Play.</p>
<h3>المواصفات</h3>
<ul>
  <li>عدد 2 لوح خشب سماكة 8mm</li>
  <li>كرتون 100 غلاف مستور</li>
  <li>طباعة 4 لون وجهين</li>
  <li>سلوفان نبع</li>
  <li>علبة كرتون مقوى (38.5 × 30 سم)</li>
</ul>
<p><strong>التطبيق مجاني على Google Play</strong></p>`,
    descriptionEn: `<p>Distinctive wooden boards for teaching children the Holy Quran in an innovative and enjoyable way, with a free app on Google Play.</p>
<h3>Specifications</h3>
<ul>
  <li>2 wooden boards, 8mm thick</li>
  <li>100 gsm coated cardboard cover</li>
  <li>4-color double-sided print</li>
  <li>Gloss lamination</li>
  <li>Cardboard box (38.5 × 30 cm)</li>
</ul>
<p><strong>App is free on Google Play</strong></p>`,
    price: 350,
    category: 'أدوات القرآن',
    tags: ['قرآن', 'تعليم', 'ألواح'],
    images: [
      `${BASE}/2024/07/Alwah-1.webp`,
      `${BASE}/2024/07/Alwah-2.webp`,
      `${BASE}/2024/07/Alwah-3.webp`,
      `${BASE}/2024/11/Alwah.webp`,
    ],
    inStock: false,
  },
  {
    id: '8',
    slug: 'palestine-book',
    name: 'كتاب فلسطين في عيون ابنائي',
    nameEn: "Palestine Through My Children's Eyes",
    shortDescription: 'كتاب الأسرة عن فلسطين للكبار والصغار',
    shortDescriptionEn: 'A family book about Palestine for young and old',
    description: `<p>كتاب ثري بالمعلومات والرسوم الجغرافية يُعرّف الأسرة بتاريخ فلسطين من خلال عيون الأبناء، مناسب من سن 10 سنوات.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>193 صفحة</li>
  <li>داخلي ورق أبيض 70 أو 80 جرام</li>
  <li>داخلي طباعة 4 لون</li>
</ul>`,
    descriptionEn: `<p>A book rich in information and geographic illustrations, introducing the family to the history of Palestine through children's eyes. Suitable from age 10.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>193 pages</li>
  <li>Interior: 70 or 80 gsm white paper</li>
  <li>Interior: 4-color print</li>
</ul>`,
    price: 220,
    category: 'كتب الأسرة',
    tags: ['فلسطين', 'كتب', 'أسرة', 'تاريخ'],
    images: [
      `${BASE}/2024/07/Palestine-1.webp`,
      `${BASE}/2024/07/Palestine-2.webp`,
      `${BASE}/2024/07/Palestine-3.webp`,
      `${BASE}/2024/11/Palestine-Book.webp`,
    ],
    inStock: true,
  },
  {
    id: '9',
    slug: 'to-my-son-book',
    name: 'كتاب إلى ابني واستاذي الشاب',
    nameEn: 'To My Son, My Young Teacher',
    shortDescription: 'كتاب للشباب لمناقشة الشبهات الفكرية',
    shortDescriptionEn: 'A book for youth addressing contemporary intellectual doubts',
    description: `<p>كتاب مناسب للكبار والصغار من سن 10 سنوات يتناول القضايا الفكرية المعاصرة والشبهات بأسلوب مهذب وراقٍ.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>240+ صفحة</li>
  <li>داخلي ورق أبيض 70 أو 80 جرام</li>
  <li>داخلي طباعة 4 لون</li>
</ul>`,
    descriptionEn: `<p>Suitable for ages 10 and above, this book addresses contemporary intellectual issues and doubts in a refined and eloquent style.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>240+ pages</li>
  <li>Interior: 70 or 80 gsm white paper</li>
  <li>Interior: 4-color print</li>
</ul>`,
    price: 180,
    category: 'كتب',
    tags: ['شباب', 'تربية', 'فكر', 'شبهات'],
    images: [
      `${BASE}/2024/07/To-My-Son-1.webp`,
      `${BASE}/2024/07/To-My-Son-2.webp`,
      `${BASE}/2024/07/To-My-Son-3.webp`,
      `${BASE}/2024/07/To-My-Son-4.webp`,
      `${BASE}/2024/11/To-my-Son.webp`,
    ],
    inStock: true,
  },
  {
    id: '10',
    slug: 'mothers-of-greats-book',
    name: 'كتاب رسائل أمهات العظماء',
    nameEn: 'Letters from the Mothers of the Greats',
    shortDescription: 'كتاب تجارب وفوائد عملية للأمهات',
    shortDescriptionEn: 'A book of practical experiences and advice for mothers',
    description: `<p>كتاب يحتوي على تجارب وقواعد عملية للأمهات يساعدهن على تنشئة أولادهم تنشئة إيمانية ليخرجوا جيلاً مقيماً للصلاة.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>128 صفحة</li>
  <li>داخلي ورق أبيض 70 أو 80 جرام</li>
  <li>داخلي طباعة 2 لون</li>
</ul>`,
    descriptionEn: `<p>A book containing practical experiences and rules for mothers to help them raise their children in faith, nurturing a generation that establishes prayer.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>128 pages</li>
  <li>Interior: 70 or 80 gsm white paper</li>
  <li>Interior: 2-color print</li>
</ul>`,
    price: 180,
    category: 'كتب',
    tags: ['أمهات', 'تربية', 'أسرة'],
    images: [
      `${BASE}/2024/07/Mothers-1.webp`,
      `${BASE}/2024/07/Mothers-2.webp`,
      `${BASE}/2025/09/Mothers-of-Greats.webp`,
    ],
    inStock: true,
    videos: ['joO3J8S1qkc'],
  },
  {
    id: '11',
    slug: 'bukhari-on-mars-book',
    name: 'كتاب البخاري على كوكب المريخ',
    nameEn: 'Al-Bukhari on Planet Mars',
    shortDescription: 'كتاب لمناقشة الشبهات بأسلوب قصصي',
    shortDescriptionEn: 'A book addressing doubts through storytelling',
    description: `<p>كتاب مناسب للكبار والصغار من سن 10 يتناول فهم الحديث والشبهات الفكرية بأسلوب قصصي مشوق بالرسوم الإنفوجرافيك.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>132 صفحة</li>
  <li>داخلي ورق أبيض 70 أو 80 جرام</li>
  <li>داخلي طباعة 4 لون</li>
</ul>`,
    descriptionEn: `<p>Suitable for ages 10+, this book addresses hadith comprehension and intellectual doubts through an engaging narrative style with infographic illustrations.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>132 pages</li>
  <li>Interior: 70 or 80 gsm white paper</li>
  <li>Interior: 4-color print</li>
</ul>`,
    price: 160,
    category: 'كتب',
    tags: ['حديث', 'شبهات', 'قصص', 'إنفوجرافيك'],
    images: [
      `${BASE}/2024/07/Bukhari-on-Mars-1.webp`,
      `${BASE}/2024/07/Bukhari-on-Mars-2.webp`,
      `${BASE}/2024/07/Bukhari-on-Mars-3.webp`,
      `${BASE}/2024/07/Bukhari-on-Mars-4.webp`,
      `${BASE}/2024/11/Bukhari.webp`,
    ],
    inStock: true,
    videos: ['Vt2gb9bb6Rk'],
  },
  {
    id: '12',
    slug: 'fakih-in-wonderland-book',
    name: 'فقيه في بلاد العجائب',
    nameEn: 'A Jurist in Wonderland',
    shortDescription: 'كتاب فقه الطهارة بأسلوب قصصي مبسط',
    shortDescriptionEn: 'A book on the fiqh of purification in a simplified narrative style',
    description: `<p>كتاب يتناول باب الطهارة في الفقه بأسلوب قصصي مبسط يجمع بين العلم الشرعي والرواية مع رسوم توضيحية وإنفوجرافيك.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>163 صفحة</li>
  <li>داخلي ورق أبيض 70 جرام</li>
  <li>داخلي طباعة 4 لون</li>
</ul>`,
    descriptionEn: `<p>A book covering the chapter of purification in Islamic jurisprudence in a simplified narrative style, combining Islamic law with storytelling, illustrations, and infographics.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>163 pages</li>
  <li>Interior: 70 gsm white paper</li>
  <li>Interior: 4-color print</li>
</ul>`,
    price: 220,
    category: 'كتب',
    tags: ['فقه', 'طهارة', 'قصص', 'أطفال'],
    images: [
      `${BASE}/2024/07/Fakih-in-Wonderland-1.webp`,
      `${BASE}/2024/07/Fakih-in-Wonderland-2.webp`,
      `${BASE}/2024/07/Fakih-in-Wonderland-3.webp`,
      `${BASE}/2024/07/Fakih-in-Wonderland-4.webp`,
    ],
    inStock: true,
    videos: ['HNpsuHbxyck'],
  },
  {
    id: '13',
    slug: 'pray-story',
    name: 'قصة الصلاة',
    nameEn: 'The Prayer Story',
    shortDescription: '6 قصص عن الصلاة بتطبيق AR',
    shortDescriptionEn: '6 stories about prayer with an AR app',
    description: `<p>6 قصص ممتعة تغرس مفهوم الصلاة وتحقيق العبودية في كل نواحي الحياة مع تطبيق AR مجاني.</p>
<h3>المواصفات</h3>
<ul>
  <li>6 قصص عن الصلاة</li>
  <li>مقاس 24 × 17 سم</li>
  <li>ورق 250 جم</li>
  <li>طباعة 4 لون</li>
</ul>
<p><strong>التطبيق مجاني على Google Play</strong></p>`,
    descriptionEn: `<p>6 engaging stories that instill the concept of prayer and devotion in every aspect of life, with a free AR app.</p>
<h3>Specifications</h3>
<ul>
  <li>6 stories about prayer</li>
  <li>Size: 24 × 17 cm</li>
  <li>250 gsm paper</li>
  <li>4-color print</li>
</ul>
<p><strong>App is free on Google Play</strong></p>`,
    price: 190,
    category: 'قصص الأطفال',
    tags: ['صلاة', 'قصص', 'أطفال', 'AR'],
    images: [
      `${BASE}/2024/07/Pray-Story-1.webp`,
      `${BASE}/2024/07/Pray-Story-2.webp`,
      `${BASE}/2024/07/Pray-Story-3.webp`,
      `${BASE}/2024/07/Pray-Story-4.webp`,
    ],
    inStock: true,
  },
  {
    id: '14',
    slug: 'my-son-asks-series',
    name: 'سلسلة ابني يسأل',
    nameEn: 'My Son Asks Series',
    shortDescription: '7 قصص تجاوب على تساؤلات الأطفال',
    shortDescriptionEn: "7 stories answering children's questions",
    description: `<p>7 قصص تتناول الأسئلة الشائعة التي تدور في ذهن الأطفال ولا يجدون جواباً عليها بأسلوب مشوق وممتع.</p>
<h3>المواصفات</h3>
<ul>
  <li>7 قصص تساؤلات أطفالنا</li>
  <li>مقاس 24 × 17 سم</li>
  <li>ورق 250 جم</li>
  <li>طباعة 4 لون</li>
</ul>`,
    descriptionEn: `<p>7 stories addressing common questions that children wonder about but rarely find answers to — presented in an engaging and enjoyable style.</p>
<h3>Specifications</h3>
<ul>
  <li>7 stories on children's questions</li>
  <li>Size: 24 × 17 cm</li>
  <li>250 gsm paper</li>
  <li>4-color print</li>
</ul>`,
    price: 200,
    category: 'قصص الأطفال',
    tags: ['قصص', 'أطفال', 'تساؤلات', 'إيمان'],
    images: [
      `${BASE}/2024/07/My-Son-Asks-1.webp`,
      `${BASE}/2024/07/My-Son-Asks-2.webp`,
      `${BASE}/2024/07/My-Son-Asks-3.webp`,
      `${BASE}/2024/07/My-Son-Asks-4.webp`,
    ],
    inStock: true,
  },
  {
    id: '15',
    slug: 'righteousness-series',
    name: 'مسلسل البر',
    nameEn: 'The Righteousness Series',
    shortDescription: '7 قصص لتفهيم البر من الصغر',
    shortDescriptionEn: '7 stories to teach filial piety from an early age',
    description: `<p>7 قصص تنمي في الأبناء والآباء قيمة البر وتُمارس الدور التربوي بين الأبناء والآباء، مناسبة من سن 5 إلى 12.</p>
<h3>المواصفات</h3>
<ul>
  <li>7 قصص</li>
  <li>مقاس 23 × 16 سم</li>
  <li>ورق 250 جم</li>
  <li>طباعة 4 لون</li>
</ul>`,
    descriptionEn: `<p>7 stories that nurture the value of righteousness in both children and parents, serving an educational role between generations. Suitable for ages 5 to 12.</p>
<h3>Specifications</h3>
<ul>
  <li>7 stories</li>
  <li>Size: 23 × 16 cm</li>
  <li>250 gsm paper</li>
  <li>4-color print</li>
</ul>`,
    price: 200,
    category: 'قصص الأطفال',
    tags: ['بر', 'والدين', 'قصص', 'أطفال'],
    images: [
      `${BASE}/2024/07/The-Series-of-Righteousness-1.webp`,
      `${BASE}/2024/07/The-Series-of-Righteousness-2.webp`,
      `${BASE}/2024/07/The-Series-of-Righteousness-3.webp`,
      `${BASE}/2024/07/The-Series-of-Righteousness-4.webp`,
    ],
    inStock: true,
  },
  {
    id: '16',
    slug: 'kids-notebook',
    name: 'مفكرة أطفال',
    nameEn: "Children's Planner",
    shortDescription: 'مفكرة للأطفال (أولاد وبنات) لتنظيم العبادات',
    shortDescriptionEn: 'A planner for children (boys & girls) to organize worship',
    description: `<p>مفكرة مميزة للأطفال (نموذجين أولاد وبنات) تساعدهم على تنظيم عباداتهم ومهامهم اليومية بطريقة ممتعة.</p>
<h3>المواصفات</h3>
<ul>
  <li>مقاس 24 × 17 سم</li>
  <li>داخلي 120 صفحة 4 لون</li>
  <li>غلاف هارد كوفر 4 لون</li>
  <li>صفحتين ستيكر</li>
  <li>تجليد سلك معدني</li>
</ul>`,
    descriptionEn: `<p>A special planner for children (two versions: boys and girls) to help them organize their worship and daily tasks in a fun way.</p>
<h3>Specifications</h3>
<ul>
  <li>Size: 24 × 17 cm</li>
  <li>120 interior pages, 4-color</li>
  <li>4-color hardcover</li>
  <li>2 sticker pages</li>
  <li>Metal spiral binding</li>
</ul>`,
    price: 160,
    category: 'مفكرات',
    tags: ['مفكرة', 'أطفال', 'تنظيم', 'عبادات'],
    images: [
      `${BASE}/2024/07/Kids-Notebook-Cover.webp`,
      `${BASE}/2024/07/Boys-Notebook-1.webp`,
      `${BASE}/2024/07/Boys-Notebook-2.webp`,
      `${BASE}/2024/07/Boys-Notebook-3.webp`,
      `${BASE}/2024/07/Girls-Notebook-1.webp`,
      `${BASE}/2024/07/Girls-Notebook-2.webp`,
      `${BASE}/2024/07/Girls-Notebook-3.webp`,
    ],
    inStock: true,
    videos: ['9kSSCSAg2us'],
  },
  {
    id: '17',
    slug: 'adults-notebook',
    name: 'مفكرة كبار',
    nameEn: "Adults' Planner",
    shortDescription: 'مفكرة للكبار (رجال وسيدات) لتنظيم العبادات',
    shortDescriptionEn: 'A planner for adults (men & women) to organize worship',
    description: `<p>مفكرة مميزة للكبار (نموذجين رجال وسيدات) تساعد على تنظيم العبادات والمهام اليومية بتصميم أنيق.</p>
<h3>المواصفات</h3>
<ul>
  <li>مقاس A5</li>
  <li>داخلي 120 صفحة 4 لون</li>
  <li>غلاف هارد كوفر 4 لون</li>
  <li>صفحتين ستيكر</li>
  <li>تجليد سلك معدني</li>
</ul>`,
    descriptionEn: `<p>A special planner for adults (two versions: men and women) to organize worship and daily tasks with an elegant design.</p>
<h3>Specifications</h3>
<ul>
  <li>A5 size</li>
  <li>120 interior pages, 4-color</li>
  <li>4-color hardcover</li>
  <li>2 sticker pages</li>
  <li>Metal spiral binding</li>
</ul>`,
    price: 160,
    category: 'مفكرات',
    tags: ['مفكرة', 'كبار', 'تنظيم', 'عبادات'],
    images: [
      `${BASE}/2024/07/Adults-Notebook-Cover.webp`,
      `${BASE}/2024/07/Men-Notebook-1.webp`,
      `${BASE}/2024/07/Men-Notebook-2.webp`,
      `${BASE}/2024/07/Men-Notebook-3.webp`,
      `${BASE}/2024/07/Women-Notebook-1.webp`,
      `${BASE}/2024/07/Women-Notebook-2.webp`,
      `${BASE}/2024/07/Women-Notebook-3.webp`,
    ],
    inStock: true,
    videos: ['9kSSCSAg2us'],
  },
  {
    id: '18',
    slug: 'ml-bag',
    name: 'شنطة مسلم ليدر',
    nameEn: 'Muslim Leader Bag',
    shortDescription: 'شنطة مدرسية للحضانة KG1–KG2 بتصاميم إسلامية',
    shortDescriptionEn: 'A school bag for kindergarten KG1–KG2 with Islamic designs',
    description: `<p>شنطة مسلم ليدر برسومات مناسبة لهويتنا وثقافتنا، بعيداً عن أوهام الشخصيات الدخيلة. متوفرة نموذجين أولاد وبنات.</p>
<h3>المواصفات</h3>
<ul>
  <li>شنطة للحضانة KG1 – KG2</li>
  <li>خامة بولي ايستر ثقيل</li>
  <li>طباعة 4 لون سليميدش</li>
  <li>سوستتان كبيرتان وجيب أمامي</li>
  <li>33 × 28 × 12 سم</li>
</ul>`,
    descriptionEn: `<p>Muslim Leader bag with designs true to our identity and culture — free from foreign cartoon characters. Available in two versions: boys and girls.</p>
<h3>Specifications</h3>
<ul>
  <li>Kindergarten bag for KG1 – KG2</li>
  <li>Heavy polyester material</li>
  <li>4-color sublimation print</li>
  <li>2 large zippers and front pocket</li>
  <li>33 × 28 × 12 cm</li>
</ul>`,
    price: 280,
    category: 'إكسسوار',
    tags: ['شنطة', 'أطفال', 'مدرسة', 'حضانة'],
    images: [
      `${BASE}/2024/10/Boys-Bag-1-1.webp`,
      `${BASE}/2024/10/Boys-Bag-1-2.webp`,
      `${BASE}/2024/10/Girls-Bag-1.webp`,
      `${BASE}/2024/10/Girls-Bag-2.webp`,
    ],
    inStock: false,
  },
  {
    id: '19',
    slug: 'masek',
    name: 'ماسك (حامل المصحف)',
    nameEn: 'Masek (Quran Holder)',
    shortDescription: 'حامل مصحف للأطفال لتشجيعهم على التلاوة',
    shortDescriptionEn: 'A Quran holder for children to encourage recitation',
    description: `<p>حامل مصحف للأطفال يشجعهم على تلاوة القرآن، متوفر بـ 4 ألوان مختلفة (أصفر وأخضر وردي وأزرق) مع تطبيق مجاني.</p>
<h3>المواصفات</h3>
<ul>
  <li>عدد 2 لوح خشب سماكة 8mm</li>
  <li>مقاس اللوح الواحد A4 تقريباً</li>
  <li>مكسي من الوجهين</li>
  <li>طباعة 4 لون للوجهين</li>
</ul>
<p><strong>التطبيق مجاني على Google Play</strong></p>`,
    descriptionEn: `<p>A Quran holder for children that encourages them to recite the Holy Quran. Available in 4 colors (yellow, green, pink, and blue) with a free app.</p>
<h3>Specifications</h3>
<ul>
  <li>2 wooden boards, 8mm thick</li>
  <li>Each board approximately A4 size</li>
  <li>Laminated on both sides</li>
  <li>4-color print on both sides</li>
</ul>
<p><strong>App is free on Google Play</strong></p>`,
    price: 190,
    category: 'أدوات القرآن',
    tags: ['قرآن', 'حامل', 'مصحف', 'أطفال'],
    images: [
      `${BASE}/2024/10/Masek-Cover.webp`,
      `${BASE}/2024/10/Masek-1.webp`,
      `${BASE}/2024/10/Masek-2.webp`,
      `${BASE}/2024/10/Masek-3.webp`,
      `${BASE}/2024/10/Masek-4.webp`,
    ],
    inStock: true,
  },
  {
    id: '20',
    slug: 'boys-mug',
    name: 'مجات ولاد',
    nameEn: "Boys' Mugs",
    shortDescription: 'مج هدية بهوية إسلامية للأولاد',
    shortDescriptionEn: 'A gift mug with Islamic identity for boys',
    description: `<p>مج هدية جذابة تحمل هوية إسلامية تناسب الجميع، بتصاميم للأولاد مستوحاة من الشخصية المسلمة الفاعلة.</p>
<h3>المواصفات</h3>
<ul>
  <li>ملون من الداخل بلون اليد</li>
  <li>الوزن: 320 جرام</li>
  <li>ارتفاع 10 سم – قطر 8 سم</li>
  <li>السعة: 300 مل</li>
  <li>يمكن كتابة اسم بالطلب</li>
  <li>خامة فاخرة قابلة للغسل في غسالة</li>
</ul>`,
    descriptionEn: `<p>An attractive gift mug with an Islamic identity, with designs for boys inspired by the active Muslim character.</p>
<h3>Specifications</h3>
<ul>
  <li>Colored interior matching the handle</li>
  <li>Weight: 320 grams</li>
  <li>Height: 10 cm – Diameter: 8 cm</li>
  <li>Capacity: 300 ml</li>
  <li>Name can be added upon request</li>
  <li>Premium dishwasher-safe material</li>
</ul>`,
    price: 170,
    category: 'مجات',
    tags: ['مج', 'هدية', 'أولاد', 'إسلامي'],
    images: [
      `${BASE}/2024/10/Boys-Mugs-1.webp`,
      `${BASE}/2024/10/Boys-Mug-1.webp`,
      `${BASE}/2024/10/Boys-Mug-2.webp`,
      `${BASE}/2024/10/Boys-Mug-3.webp`,
      `${BASE}/2024/10/Boys-Mug-4.webp`,
      `${BASE}/2024/10/Boys-Mug-5.webp`,
      `${BASE}/2024/10/Boys-Mug-6.webp`,
    ],
    inStock: true,
  },
  {
    id: '21',
    slug: 'girls-mug',
    name: 'مجات بنات',
    nameEn: "Girls' Mugs",
    shortDescription: 'مج هدية بهوية إسلامية للبنات',
    shortDescriptionEn: 'A gift mug with Islamic identity for girls',
    description: `<p>مج هدية جذابة تحمل هوية إسلامية تناسب الجميع، بتصاميم للبنات مستوحاة من الشخصية المسلمة المتميزة.</p>
<h3>المواصفات</h3>
<ul>
  <li>ملون من الداخل بلون اليد</li>
  <li>الوزن: 320 جرام</li>
  <li>ارتفاع 10 سم – قطر 8 سم</li>
  <li>السعة: 300 مل</li>
  <li>يمكن كتابة اسم بالطلب</li>
  <li>خامة فاخرة قابلة للغسل في غسالة</li>
</ul>`,
    descriptionEn: `<p>An attractive gift mug with an Islamic identity, with designs for girls inspired by the distinguished Muslim character.</p>
<h3>Specifications</h3>
<ul>
  <li>Colored interior matching the handle</li>
  <li>Weight: 320 grams</li>
  <li>Height: 10 cm – Diameter: 8 cm</li>
  <li>Capacity: 300 ml</li>
  <li>Name can be added upon request</li>
  <li>Premium dishwasher-safe material</li>
</ul>`,
    price: 170,
    category: 'مجات',
    tags: ['مج', 'هدية', 'بنات', 'إسلامي'],
    images: [
      `${BASE}/2024/10/Girls-Mugs.webp`,
      `${BASE}/2024/10/Girls-Mug-1.webp`,
      `${BASE}/2024/10/Girls-Mug-2.webp`,
      `${BASE}/2024/10/Girls-Mug-3.webp`,
      `${BASE}/2024/10/Girls-Mug-4.webp`,
      `${BASE}/2024/10/Girls-Mug-5.webp`,
      `${BASE}/2024/10/Girls-Mug-6.webp`,
    ],
    inStock: true,
  },
  {
    id: '22',
    slug: 'women-mug',
    name: 'مجات نساء',
    nameEn: "Women's Mugs",
    shortDescription: 'مج هدية بهوية إسلامية للنساء',
    shortDescriptionEn: 'A gift mug with Islamic identity for women',
    description: `<p>مج هدية جذابة تحمل هوية إسلامية تناسب الجميع، بتصاميم للنساء تعكس جمال الهوية الإسلامية.</p>
<h3>المواصفات</h3>
<ul>
  <li>ملون من الداخل بلون اليد</li>
  <li>الوزن: 320 جرام</li>
  <li>ارتفاع 10 سم – قطر 8 سم</li>
  <li>السعة: 300 مل</li>
  <li>يمكن كتابة اسم بالطلب</li>
  <li>خامة فاخرة قابلة للغسل في غسالة</li>
</ul>`,
    descriptionEn: `<p>An attractive gift mug with an Islamic identity, with designs for women reflecting the beauty of Islamic identity.</p>
<h3>Specifications</h3>
<ul>
  <li>Colored interior matching the handle</li>
  <li>Weight: 320 grams</li>
  <li>Height: 10 cm – Diameter: 8 cm</li>
  <li>Capacity: 300 ml</li>
  <li>Name can be added upon request</li>
  <li>Premium dishwasher-safe material</li>
</ul>`,
    price: 170,
    category: 'مجات',
    tags: ['مج', 'هدية', 'نساء', 'إسلامي'],
    images: [
      `${BASE}/2024/10/Women-Mugs.webp`,
      `${BASE}/2024/10/Women-Mugs-1.webp`,
      `${BASE}/2024/10/Women-Mugs-2.webp`,
      `${BASE}/2024/10/Women-Mugs-3.webp`,
      `${BASE}/2024/10/Women-Mugs-4.webp`,
      `${BASE}/2024/10/Women-Mugs-5.webp`,
    ],
    inStock: true,
  },
  {
    id: '23',
    slug: 'ml-pin',
    name: 'دبوس',
    nameEn: 'Muslim Leader Pin',
    shortDescription: 'دبوس مسلم ليدر بتصاميم متنوعة',
    shortDescriptionEn: 'Muslim Leader pin with various designs',
    description: `<p>دبوس مسلم ليدر بتصاميم جذابة ومتنوعة تعبر عن الهوية الإسلامية، خامة بلاستيك عالية الجودة.</p>
<h3>المواصفات</h3>
<ul>
  <li>خامة بلاستيك</li>
  <li>قطر 4.5 سم</li>
  <li>الوزن: 6 جرام</li>
</ul>`,
    descriptionEn: `<p>A Muslim Leader pin with attractive and diverse designs expressing Islamic identity, made from high-quality plastic.</p>
<h3>Specifications</h3>
<ul>
  <li>Plastic material</li>
  <li>Diameter: 4.5 cm</li>
  <li>Weight: 6 grams</li>
</ul>`,
    price: 35,
    category: 'إكسسوار',
    tags: ['دبوس', 'هدية', 'إكسسوار'],
    images: [
      `${BASE}/2024/10/Pins.webp`,
      `${BASE}/2024/10/Black-Pin.webp`,
      `${BASE}/2024/10/White-Pin.webp`,
      `${BASE}/2024/10/Yellow-Pin.webp`,
      `${BASE}/2024/10/Boys-Pin-1.webp`,
      `${BASE}/2024/10/Girls-Pin.webp`,
    ],
    inStock: false,
  },
];

export const categories: Category[] = [
  { id: 'all', name: 'الكل', count: products.length },
  { id: 'ألعاب تعليمية', name: 'ألعاب تعليمية', count: products.filter(p => p.category === 'ألعاب تعليمية').length },
  { id: 'كتب', name: 'كتب', count: products.filter(p => p.category === 'كتب').length },
  { id: 'كتب الأسرة', name: 'كتب الأسرة', count: products.filter(p => p.category === 'كتب الأسرة').length },
  { id: 'قصص الأطفال', name: 'قصص الأطفال', count: products.filter(p => p.category === 'قصص الأطفال').length },
  { id: 'أدوات القرآن', name: 'أدوات القرآن', count: products.filter(p => p.category === 'أدوات القرآن').length },
  { id: 'مفكرات', name: 'مفكرات', count: products.filter(p => p.category === 'مفكرات').length },
  { id: 'إكسسوار', name: 'إكسسوار', count: products.filter(p => p.category === 'إكسسوار').length },
  { id: 'مجات', name: 'مجات', count: products.filter(p => p.category === 'مجات').length },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find(p => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  if (category === 'all') return products;
  return products.filter(p => p.category === category);
}

export function getFeaturedProducts(): Product[] {
  return products.filter(p => p.featured || p.inStock).slice(0, 6);
}
