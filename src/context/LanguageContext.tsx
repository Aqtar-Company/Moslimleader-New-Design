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
    'about.mission.title': 'رسالتنا',
    'about.mission.text': 'مسلم ليدر هي منصة تربوية وتعليمية متخصصة في تقديم منتجات هادفة للأطفال والأسرة المسلمة. نؤمن بأن التربية الحقيقية تبدأ من البيت، وأن كل طفل بداخله قائد ينتظر من يرشده.',
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
    'about.mission.title': 'Our Mission',
    'about.mission.text': 'Muslim Leader is an educational and upbringing platform specializing in meaningful products for Muslim children and families. We believe that true upbringing starts at home, and that every child has a leader within waiting to be guided.',
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
