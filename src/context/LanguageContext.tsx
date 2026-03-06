'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'ar' | 'en';

const translations = {
  ar: {
    // Nav
    'nav.home': 'الرئيسية',
    'nav.shop': 'المتجر',
    'nav.about': 'من نحن',
    'nav.contact': 'اتصل بنا',
    'nav.cart': 'عربة التسوق',
    'header.promo': 'ⓘ خصم حصري على جميع المنتجات لفترة محدودة',

    // Home
    'home.hero.title': 'مسلم ليدر',
    'home.hero.subtitle': 'معاً نبني قادة الغد',
    'home.hero.desc': 'منتجات تربوية وتعليمية للأطفال والأسرة المسلمة — ألعاب، كتب، قصص، أدوات قرآن وأكثر',
    'home.hero.shopNow': 'تسوق الآن',
    'home.hero.aboutUs': 'من نحن',
    'home.categories.title': 'تصفح الفئات',
    'home.featured.title': 'الأكثر مبيعاً',
    'home.featured.viewAll': 'عرض الكل ←',
    'home.why.title': 'لماذا مسلم ليدر؟',
    'home.why.quality.title': 'جودة عالية',
    'home.why.quality.desc': 'كل منتج مصنوع من مواد فاخرة ومراجعته دقيقة لضمان أعلى جودة',
    'home.why.content.title': 'محتوى هادف',
    'home.why.content.desc': 'منتجات مستوحاة من قيم الإسلام لتربية جيل متميز ومتوازن',
    'home.why.delivery.title': 'توصيل سريع',
    'home.why.delivery.desc': 'نوصل لجميع محافظات مصر بسرعة وأمان',
    'home.all.title': 'جميع المنتجات',
    'home.all.viewAll': 'عرض الكل ←',
    'home.all.cta': 'عرض كل المنتجات',

    // About
    'about.title': 'من نحن',
    'about.subtitle': 'نعرّفك بمسلم ليدر ورسالتنا',
    'about.hero.text': 'هدفنا الأسمى هو تقديم القيم الإسلامية للجيل المسلم، وتنشئته على حب الإسلام وتعليمه ما ينفعه في دينه ودنياه في إطار ممتع وشيق. شغفنا هو تطوير أفكار ممتعة للأطفال من كل الأعمار ليتعلمو ويتمتعوا. لذا نعمل جاهدين على أن نقدم منتجات بتصميمات تساعد المربين على تزويد أطفالهم بما ينفعهم من علم وآداب إسلامية قيمة، ليخرج جيل إسلامي صالح قويم في بيئة طبيعية وممتعة.',
    'about.vision.title': 'الرؤية',
    'about.vision.text': 'اعداد جيل مسلم واعي بكل ما يدور حوله ... جيل يفهم نفسه جيدًا فلا يستخف بعقله السفهاء. وهو في ذاك على علم بمبادئ وأساسيات كل علم من العلوم الشرعية .. جيل ارتقى في علوم الدنيا فلا يتكبر عليه الجهلاء .. وهو في ذاك معتز بهويته الإسلامية .. ليس لديه حرج في إظهار شعائر دينه.',
    'about.mission.title': 'الرسالة',
    'about.mission.text': 'تقديم التراث الإسلامي الديني والتربوي بصورة تتلائم مع طبيعة العصر، لتزويد المربيين والمعلمين بمواد ووسائل تعينهم على مهمتهم السامية.',
    'about.goal.title': 'الهدف',
    'about.goal.text': 'تسعى مؤسسة مسلم ليدر إلى بناء الطفل المسلم ثقافيًا وفكريًا من خلال منتجات مبتكرة تتماشى مع قيمنا وأخلاقنا وهويتنا.',
    'about.features.title': 'بماذا نتميز؟',
    'about.feat1': 'الإهتمام بالتصاميم والرسومات التوضيحية لتعزيز الفهم وإيصال المعلومات، إلى جانب تطويع تكنولوجيا الذكاء الاصطناعي لإنتاج رسومات جذابة.',
    'about.feat2': 'مواكبة التكنولوجيا، عن طريق عمل تطبيقات هاتف لبعض المنتجات وتوظيف تكنولوجيا الواقع المعزز في بعض الألعاب.',
    'about.feat3': 'بساطة الجوانب الموضوعية والتوقف عند بديهيات الدين وما هو متعارف عليه، إلى جانب عدم الانحياز لأي فكر سياسي أو طائفة دينية.',
    'about.feat4': 'تنوع المنتجات بين رقمية ومطبوعة، بين كتب وألعاب، للصغار والكبار، فنحن نستهدف جميع أفراد الأسرة بوسائل متنوعة.',
    'about.products.title': 'منتجاتنا',
    'about.prod1.title': 'الكتب والروايات',
    'about.prod1.desc': 'تتميز الكتب والمؤلفات في مسلم ليدر بتقديم العلوم والأفكار المعقدة بأسلوب روائي شيق مع الاهتمام بالتمثيل البصري للمعلومات، لتسهيل إيصال الفكرة والمعلومة.',
    'about.prod2.title': 'قصص الأطفال',
    'about.prod2.desc': 'تهتم مسلم ليدر بتقديم قصص هادفة للأطفال بطريقة تربوية غايتها غرس المعاني الإيمانية والأخلاقية لدى الأطفال، وتوجيه الآباء نحو كيفية تحسين سلوكيات أبنائهم.',
    'about.prod3.title': 'ألعاب تعليمية ورقية',
    'about.prod3.desc': 'لمزيد من الدفئ الأسري عنت مسلم ليدر بتصميم ألعاب وكروت تعليمية ورقية يتفاعل فيها أفراد الأسرة سويًا. تتميز الألعاب بأنها تجمع بين التعلم والمرح وذكر الله.',
    'about.prod4.title': 'أدوات القرآن',
    'about.prod4.desc': 'اهتمت مسلم ليدر بتطوير وسائل تعلم القرآن بشكل مناسب للأطفال، غرضها تحبيب الأطفال في كتاب الله وتسهيل تعلمه.',
    'about.prod5.title': 'أدوات مكتبية',
    'about.prod5.desc': 'قامت مسلم ليدر بتصميم أدوات مكتبية غايتها خلق بية علمية للطفل تتسم بمظهر إسلامي وذلك بديلًا عن الرسومات الغربية التي تتناافى مع الثقافة والتربية الإسلامية.',
    'about.catalog.title': 'كتالوج المنتجات',
    'about.catalog.desc': 'تصفح كتالوجنا الكامل للتعرف على جميع منتجاتنا التعليمية الإسلامية المميزة.',
    'about.catalog.preview': '👁️ معاينة الكتالوج',
    'about.catalog.download': '⬇️ تحميل الكتالوج',
    'about.val1.title': 'القرآن والسنة',
    'about.val1.desc': 'كل منتجاتنا مستوحاة من قيم الإسلام الصحيح وتعاليمه',
    'about.val2.title': 'التعلم بالمتعة',
    'about.val2.desc': 'نصمم منتجات تجعل التعلم تجربة ممتعة ومشوقة للطفل',
    'about.val3.title': 'الأسرة أولاً',
    'about.val3.desc': 'نهتم بتقوية الروابط الأسرية وتحفيز الحوار البناء بين الأجيال',
    'about.brand.title': 'معاً نبني قادة الغد',
    'about.brand.text': 'بدأت مسلم ليدر برؤية بسيطة: توفير بديل أصيل للمنتجات التربوية التي تحترم هوية أطفالنا وثقافتنا الإسلامية. اليوم، نفخر بمجموعة منتجات متنوعة تخدم الأطفال والآباء والأمهات على حدٍّ سواء.',
    'about.cta': 'اكتشف منتجاتنا',

    // Contact
    'contact.title': 'اتصل بنا',
    'contact.subtitle': 'نحن هنا للمساعدة — تواصل معنا في أي وقت',
    'contact.info.title': 'بياناتنا',
    'contact.info.email.label': 'البريد الإلكتروني',
    'contact.info.phone.label': 'الهاتف / واتساب',
    'contact.info.address.label': 'العنوان',
    'contact.info.address.value': 'مصر',
    'contact.hours.title': 'ساعات العمل',
    'contact.hours.text': 'السبت – الخميس: 9 صباحاً – 6 مساءً\nالجمعة: مغلق',
    'contact.form.title': 'أرسل رسالة',
    'contact.form.name': 'الاسم',
    'contact.form.name.ph': 'اسمك الكامل',
    'contact.form.email': 'البريد الإلكتروني',
    'contact.form.phone': 'رقم الهاتف (اختياري)',
    'contact.form.phone.ph': '01xxxxxxxxx',
    'contact.form.message': 'الرسالة',
    'contact.form.message.ph': 'اكتب رسالتك هنا...',
    'contact.form.submit': 'إرسال الرسالة',
    'contact.success.title': 'تم إرسال رسالتك!',
    'contact.success.text': 'سنرد عليك في أقرب وقت ممكن.',

    // Shop
    'shop.title': 'المتجر',
    'shop.subtitle': 'اكتشف جميع منتجاتنا التربوية والتعليمية',
    'shop.search.ph': 'ابحث عن منتج...',
    'shop.results': 'منتج',
    'shop.empty': 'لا توجد منتجات تطابق بحثك',

    // Cart
    'cart.empty.title': 'عربة التسوق فارغة',
    'cart.empty.desc': 'لم تضف أي منتجات بعد',
    'cart.empty.cta': 'تسوق الآن',
    'cart.title': 'عربة التسوق',
    'cart.delete': 'حذف',
    'cart.clearAll': 'مسح الكل',
    'cart.summary.title': 'ملخص الطلب',
    'cart.summary.subtotal': 'المجموع الفرعي',
    'cart.summary.shipping': 'الشحن',
    'cart.summary.total': 'الإجمالي',
    'cart.currency': 'ج.م',
    'cart.checkout': 'إتمام الشراء',
    'cart.continue': '← متابعة التسوق',

    // Footer
    'footer.tagline': 'معاً نبني قادة الغد — منتجات تربوية وتعليمية للأطفال والأسرة المسلمة',
    'footer.quickLinks': 'روابط سريعة',
    'footer.contactUs': 'تواصل معنا',
    'footer.copyright': 'مسلم ليدر — جميع الحقوق محفوظة',

    // Product Card / Detail
    'product.outOfStock': 'نفذ المخزون',
    'product.addToCart': 'أضف للسلة',
    'product.unavailable': 'غير متاح',
    'product.inStock': 'متوفر في المخزون',
    'product.added': '✓ تم الإضافة!',
    'product.related': 'منتجات ذات صلة',

    // Categories
    'cat.all': 'الكل',
    'cat.ألعاب تعليمية': 'ألعاب تعليمية',
    'cat.كتب': 'كتب',
    'cat.كتب الأسرة': 'كتب الأسرة',
    'cat.قصص الأطفال': 'قصص الأطفال',
    'cat.أدوات القرآن': 'أدوات القرآن',
    'cat.مفكرات': 'مفكرات',
    'cat.إكسسوار': 'إكسسوار',
    'cat.مجات': 'مجات',
  },
  en: {
    // Nav
    'nav.home': 'Home',
    'nav.shop': 'Shop',
    'nav.about': 'About Us',
    'nav.contact': 'Contact',
    'nav.cart': 'Cart',
    'header.promo': 'ⓘ Exclusive discount on all products for a limited time',

    // Home
    'home.hero.title': 'Muslim Leader',
    'home.hero.subtitle': "Together We Build Tomorrow's Leaders",
    'home.hero.desc': 'Educational & upbringing products for Muslim children and families — games, books, stories, Quran tools and more',
    'home.hero.shopNow': 'Shop Now',
    'home.hero.aboutUs': 'About Us',
    'home.categories.title': 'Browse Categories',
    'home.featured.title': 'Best Sellers',
    'home.featured.viewAll': 'View All →',
    'home.why.title': 'Why Muslim Leader?',
    'home.why.quality.title': 'High Quality',
    'home.why.quality.desc': 'Every product is made from premium materials and carefully reviewed to ensure the highest quality',
    'home.why.content.title': 'Meaningful Content',
    'home.why.content.desc': 'Products inspired by Islamic values to raise a distinguished and balanced generation',
    'home.why.delivery.title': 'Fast Delivery',
    'home.why.delivery.desc': 'We deliver to all governorates in Egypt quickly and safely',
    'home.all.title': 'All Products',
    'home.all.viewAll': 'View All →',
    'home.all.cta': 'View All Products',

    // About
    'about.title': 'About Us',
    'about.subtitle': 'Learn about Muslim Leader and our mission',
    'about.hero.text': 'Our ultimate goal is to present Islamic values to the Muslim generation, raising them with a love of Islam and teaching them what benefits them in their faith and worldly life — in a fun and engaging way. Our passion is developing enjoyable ideas for children of all ages so they can learn and have fun at the same time. That is why we work diligently to deliver products with designs that help educators provide their children with valuable Islamic knowledge and etiquette, nurturing a righteous Muslim generation in a natural and enjoyable environment.',
    'about.vision.title': 'Our Vision',
    'about.vision.text': 'To prepare a Muslim generation that is fully aware of everything happening around them — a generation that understands itself so well that no one can manipulate its mind. A generation grounded in the fundamentals of every Islamic science, advanced in worldly knowledge, yet proud of its Islamic identity and unashamed to practice its faith openly.',
    'about.mission.title': 'Our Mission',
    'about.mission.text': 'To present the Islamic religious and educational heritage in a manner that suits the nature of our era, equipping educators and teachers with materials and tools that support their noble mission.',
    'about.goal.title': 'Our Goal',
    'about.goal.text': 'Muslim Leader Foundation aims to build the Muslim child culturally and intellectually through innovative products that align with our values, ethics, and authentic Islamic identity.',
    'about.features.title': 'What Sets Us Apart?',
    'about.feat1': 'A strong focus on designs and illustrations to reinforce understanding and deliver information effectively, alongside leveraging AI technology to produce engaging visuals.',
    'about.feat2': 'Keeping pace with technology through dedicated mobile apps and the use of augmented reality (AR) in select educational games.',
    'about.feat3': 'Simple, clear content grounded in the fundamentals of the faith — without political bias or alignment with any religious sect.',
    'about.feat4': 'A diverse range of products — digital and print, books and games, for children and adults — targeting every member of the family through varied media.',
    'about.products.title': 'Our Products',
    'about.prod1.title': 'Books & Novels',
    'about.prod1.desc': 'Muslim Leader books present complex sciences and ideas in an engaging narrative style with rich visual representation to simplify delivery of knowledge.',
    'about.prod2.title': "Children's Stories",
    'about.prod2.desc': 'Purposeful stories designed to instill faith-based values and moral character in children, while guiding parents on improving their children\'s behavior.',
    'about.prod3.title': 'Educational Board Games',
    'about.prod3.desc': 'Educational cards and games that bring the whole family together — blending fun, learning, and the remembrance of Allah.',
    'about.prod4.title': 'Quran Learning Tools',
    'about.prod4.desc': 'Child-friendly tools designed to foster a love for the Holy Quran and make it easier for children to learn and memorize.',
    'about.prod5.title': 'Islamic Stationery',
    'about.prod5.desc': 'Stationery with an Islamic aesthetic — a wholesome alternative to Western-themed designs that conflict with Islamic culture and upbringing.',
    'about.catalog.title': 'Product Catalog',
    'about.catalog.desc': 'Browse our full catalog to discover all our unique Islamic educational products.',
    'about.catalog.preview': '👁️ Preview Catalog',
    'about.catalog.download': '⬇️ Download Catalog',
    'about.val1.title': 'Quran & Sunnah',
    'about.val1.desc': 'All our products are inspired by the authentic values and teachings of Islam',
    'about.val2.title': 'Learning Through Fun',
    'about.val2.desc': 'We design products that make learning an enjoyable and engaging experience for children',
    'about.val3.title': 'Family First',
    'about.val3.desc': 'We focus on strengthening family bonds and encouraging constructive dialogue between generations',
    'about.brand.title': "Together We Build Tomorrow's Leaders",
    'about.brand.text': "Muslim Leader started with a simple vision: to provide an authentic alternative to educational products that respect our children's identity and Islamic culture. Today, we are proud of a diverse range of products serving children, fathers, and mothers alike.",
    'about.cta': 'Discover Our Products',

    // Contact
    'contact.title': 'Contact Us',
    'contact.subtitle': "We're here to help — reach out to us anytime",
    'contact.info.title': 'Our Details',
    'contact.info.email.label': 'Email',
    'contact.info.phone.label': 'Phone / WhatsApp',
    'contact.info.address.label': 'Address',
    'contact.info.address.value': 'Egypt',
    'contact.hours.title': 'Working Hours',
    'contact.hours.text': 'Saturday – Thursday: 9 AM – 6 PM\nFriday: Closed',
    'contact.form.title': 'Send a Message',
    'contact.form.name': 'Name',
    'contact.form.name.ph': 'Your full name',
    'contact.form.email': 'Email',
    'contact.form.phone': 'Phone Number (optional)',
    'contact.form.phone.ph': '+20 1xx xxx xxxx',
    'contact.form.message': 'Message',
    'contact.form.message.ph': 'Write your message here...',
    'contact.form.submit': 'Send Message',
    'contact.success.title': 'Message Sent!',
    'contact.success.text': 'We will get back to you as soon as possible.',

    // Shop
    'shop.title': 'Shop',
    'shop.subtitle': 'Discover all our educational and upbringing products',
    'shop.search.ph': 'Search for a product...',
    'shop.results': 'product(s)',
    'shop.empty': 'No products match your search',

    // Cart
    'cart.empty.title': 'Your cart is empty',
    'cart.empty.desc': "You haven't added any products yet",
    'cart.empty.cta': 'Shop Now',
    'cart.title': 'Shopping Cart',
    'cart.delete': 'Remove',
    'cart.clearAll': 'Clear All',
    'cart.summary.title': 'Order Summary',
    'cart.summary.subtotal': 'Subtotal',
    'cart.summary.shipping': 'Shipping',
    'cart.summary.total': 'Total',
    'cart.currency': 'EGP',
    'cart.checkout': 'Proceed to Checkout',
    'cart.continue': '→ Continue Shopping',

    // Footer
    'footer.tagline': "Together We Build Tomorrow's Leaders — Educational products for Muslim children and families",
    'footer.quickLinks': 'Quick Links',
    'footer.contactUs': 'Contact Us',
    'footer.copyright': 'Muslim Leader — All Rights Reserved',

    // Product Card / Detail
    'product.outOfStock': 'Out of Stock',
    'product.addToCart': 'Add to Cart',
    'product.unavailable': 'Unavailable',
    'product.inStock': 'In Stock',
    'product.added': '✓ Added!',
    'product.related': 'Related Products',

    // Categories
    'cat.all': 'All',
    'cat.ألعاب تعليمية': 'Educational Games',
    'cat.كتب': 'Books',
    'cat.كتب الأسرة': 'Family Books',
    'cat.قصص الأطفال': "Children's Stories",
    'cat.أدوات القرآن': 'Quran Tools',
    'cat.مفكرات': 'Notebooks',
    'cat.إكسسوار': 'Accessories',
    'cat.مجات': 'Mugs',
  },
} as const;

type TranslationKey = keyof typeof translations.ar;

interface LangContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
  isRtl: boolean;
}

const LangContext = createContext<LangContextType>({
  lang: 'ar',
  toggleLang: () => {},
  t: (key) => key,
  isRtl: true,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ar');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const toggleLang = () => setLang(l => (l === 'ar' ? 'en' : 'ar'));
  const t = (key: TranslationKey): string => translations[lang][key] ?? key;
  const isRtl = lang === 'ar';

  return (
    <LangContext.Provider value={{ lang, toggleLang, t, isRtl }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
