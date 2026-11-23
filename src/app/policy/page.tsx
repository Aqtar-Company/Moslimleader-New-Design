import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/seo';
import { serverLang } from '@/lib/server-lang';

const AR_METADATA: Metadata = {
  title: 'سياسة الخصوصية | مسلم ليدر',
  description:
    'سياسة الخصوصية لمتجر مسلم ليدر — كيف نجمع، نستخدم، ونحمي بيانات عملائنا في المتجر، المكتبة الرقمية، والتواصل عبر فيسبوك Messenger.',
  openGraph: {
    title: 'سياسة الخصوصية | مسلم ليدر',
    description: 'كيف نتعامل مع بيانات العملاء على منصة مسلم ليدر.',
    url: canonical('/policy'),
    siteName: 'مسلم ليدر',
    type: 'website',
    locale: 'ar_EG',
  },
};

const EN_METADATA: Metadata = {
  title: 'Privacy Policy | Moslim Leader',
  description: 'How Moslim Leader collects, uses and protects customer data across the shop, the digital library and Facebook Messenger.',
  openGraph: {
    title: 'Privacy Policy | Moslim Leader',
    description: 'How customer data is handled on Moslim Leader.',
    url: canonical('/en/policy'),
    siteName: 'Moslim Leader',
    type: 'website',
    locale: 'en_US',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return serverLang() === 'en' ? EN_METADATA : AR_METADATA;
}

const LAST_UPDATED = '23 نوفمبر 2026';
const LAST_UPDATED_EN = '23 November 2026';

export default function PrivacyPolicyPage() {
  if (serverLang() === 'en') return <EnglishPolicy />;
  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 py-10">
      <article className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10">
        <header className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">سياسة الخصوصية</h1>
          <p className="text-sm text-gray-500 mt-2">آخر تحديث: {LAST_UPDATED}</p>
          <p className="text-sm text-gray-700 mt-4 leading-relaxed">
            تشرح هذه الصفحة كيف يقوم متجر <strong>مسلم ليدر</strong> (<a href="https://moslimleader.com" className="text-blue-700 hover:underline">moslimleader.com</a>) بجمع، استخدام، تخزين، وحماية بيانات عملائه.
            باستخدامك للموقع أو التواصل معنا عبر صفحاتنا على وسائل التواصل، فإنك توافق على ما هو موضح هنا.
          </p>
        </header>

        <Section title="1. من نحن">
          <p>
            مسلم ليدر متجر إلكتروني متخصص في كتب وألعاب وحقائب ومنتجات تربوية للأطفال،
            بالإضافة إلى مكتبة رقمية للكتب الإسلامية. نتعامل مع الأسواق المصرية والخليجية
            بشكل أساسي، ونوفر منتجات تعليمية تنمي القيم الإسلامية لدى الأطفال.
          </p>
        </Section>

        <Section title="2. البيانات التي نجمعها">
          <p>نجمع البيانات التالية عند تفاعلك معنا:</p>
          <List>
            <li><strong>بيانات الحساب:</strong> الاسم، البريد الإلكتروني، رقم الهاتف، كلمة المرور (مشفّرة).</li>
            <li><strong>بيانات الطلب:</strong> العنوان، المحافظة، طريقة الدفع، المنتجات المطلوبة.</li>
            <li><strong>بيانات التواصل:</strong> الرسائل المرسلة عبر Messenger، التعليقات على صفحاتنا، رسائل البريد الإلكتروني.</li>
            <li><strong>بيانات تقنية:</strong> عنوان IP، نوع المتصفح، ملفات تعريف الارتباط (cookies)، صفحات تمت زيارتها.</li>
            <li><strong>بيانات الأطفال (اختيارية):</strong> اسم الطفل وتاريخ ميلاده ونوعه إن أضفتها في حسابك — لاقتراح منتجات مناسبة لعمره، ولإرسال تهنئة لك في يوم ميلاده. لا تُستخدم لأي غرض آخر.</li>
            <li><strong>صورة البادج (اختيارية):</strong> الصورة التي تضع عليها البادج تُجهَّز على جهازك ولا تُرفع إلينا، إلا إذا شاركتها من الكمبيوتر — فتُرفع لتظهر في معاينة الرابط الذي تنشره.</li>
          </List>
        </Section>

        <Section title="3. كيف نستخدم بياناتك">
          <List>
            <li>تنفيذ الطلبات والتوصيل إلى عنوانك.</li>
            <li>الرد على استفساراتك عبر Messenger أو التعليقات أو البريد الإلكتروني — قد يستخدم مساعد ذكاء اصطناعي للرد التلقائي مع إشراف بشري.</li>
            <li>اقتراح منتجات مناسبة لاحتياجاتك واحتياجات أطفالك.</li>
            <li>إرسال إشعارات الطلبات والعروض (يمكنك إلغاء الاشتراك في أي وقت).</li>
            <li>تحسين خدماتنا وقياس أداء الموقع.</li>
            <li>الالتزام بالمتطلبات القانونية والمحاسبية في مصر.</li>
          </List>
        </Section>

        <Section title="4. التواصل عبر فيسبوك ومسنجر">
          <p>عند تواصلك معنا عبر Messenger أو التعليق على بوست في صفحتنا:</p>
          <List>
            <li>نستلم معرّف المستخدم العام من فيسبوك (PSID) واسم العرض، ولا نستلم رقم تليفونك أو إيميلك من فيسبوك مباشرة.</li>
            <li>قد يرد عليك مساعد ذكاء اصطناعي تلقائياً برد سريع. إذا قدّمت معلوماتك (الاسم، الهاتف، العنوان) بنفسك في الرسالة، فإنها تُحفظ لإتمام طلبك.</li>
            <li>نلتزم بسياسة فيسبوك للخصوصية (<a href="https://www.facebook.com/about/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">Facebook Data Policy</a>).</li>
            <li>محادثاتك معنا تبقى خاصة ولا تُشارك مع أي طرف ثالث، عدا في حالات الالتزام القانوني.</li>
          </List>
        </Section>

        <Section title="5. مشاركة البيانات">
          <p>لا نبيع بيانات العملاء. نشارك المعلومات الضرورية فقط مع:</p>
          <List>
            <li><strong>شركات الشحن:</strong> الاسم، العنوان، رقم الهاتف لإيصال طلبك.</li>
            <li><strong>بوابات الدفع</strong> (مثل PayPal): لإتمام عمليات الدفع الإلكتروني.</li>
            <li><strong>مزوّدي الذكاء الاصطناعي</strong> (Google, OpenAI, Anthropic): لتشغيل المساعد الذكي بحدوده الموضحة في سياساتهم.</li>
            <li><strong>الجهات القانونية:</strong> عند الطلب الرسمي وفقاً للقانون المصري.</li>
          </List>
        </Section>

        <Section title="6. ملفات تعريف الارتباط (Cookies)">
          <p>
            نستخدم cookies لتحسين تجربتك (تذكُّر سلة التسوق، تسجيل الدخول، تفضيلات اللغة).
            يمكنك تعطيلها من إعدادات متصفحك، لكن قد تتأثر بعض ميزات الموقع.
          </p>
        </Section>

        <Section title="7. حقوقك">
          <p>لك الحق في:</p>
          <List>
            <li><strong>الوصول إلى بياناتك:</strong> اطلب نسخة من بياناتك المخزنة لدينا.</li>
            <li><strong>التصحيح:</strong> طلب تعديل أي معلومات غير دقيقة.</li>
            <li><strong>الحذف:</strong> طلب حذف حسابك وبياناتك (عدا ما يلزمنا الاحتفاظ به قانونياً مثل سجلات الفواتير).</li>
            <li><strong>إلغاء الاشتراك:</strong> من الرسائل التسويقية في أي وقت.</li>
            <li><strong>الاعتراض</strong> على معالجة بياناتك لأغراض معينة.</li>
          </List>
          <p className="mt-3">
            للتقديم على أي من هذه الحقوق، راسلنا على البريد الإلكتروني أدناه.
          </p>
        </Section>

        <Section title="8. حماية البيانات">
          <List>
            <li>نشفّر كلمات المرور باستخدام bcrypt، ولا نخزّن أرقام بطاقات الائتمان (تتعامل بوابات الدفع مباشرة).</li>
            <li>نستخدم HTTPS لجميع الاتصالات.</li>
            <li>نحدّ من وصول الموظفين إلى البيانات الشخصية بحسب الحاجة.</li>
            <li>نراجع أنظمتنا الأمنية بانتظام.</li>
          </List>
        </Section>

        <Section title="9. خصوصية الأطفال">
          <p>
            موقعنا يبيع منتجات للأطفال، لكن العملاء يجب أن يكونوا 18 سنة فأكثر لإنشاء حساب وإجراء طلب.
            لا نجمع بيانات شخصية مباشرة من الأطفال. بيانات الأطفال التي يضيفها ولي الأمر في حسابه
            (الاسم وتاريخ الميلاد) تُستخدم فقط لاقتراح منتجات مناسبة ولتهنئته في يوم ميلاد الطفل،
            ويمكنه حذفها في أي وقت من حسابه.
          </p>
        </Section>

        <Section title="10. الاحتفاظ بالبيانات">
          <p>
            نحتفظ ببياناتك طوال فترة كون حسابك نشطاً، وبعد إغلاقه نحتفظ بسجلات الطلبات والفواتير
            لمدة 5 سنوات للالتزام بمتطلبات الضرائب والمحاسبة في مصر.
          </p>
        </Section>

        <Section title="11. تحديثات هذه السياسة">
          <p>
            قد نُحدّث هذه السياسة من وقت لآخر. التحديثات الجوهرية ستُعلَن في الموقع و/أو
            بإشعار عبر البريد الإلكتروني. تاريخ آخر تحديث موضّح في أعلى الصفحة.
          </p>
        </Section>

        <Section title="12. التواصل معنا">
          <p>لأي سؤال أو طلب يخص الخصوصية:</p>
          <List>
            <li><strong>بريد إلكتروني:</strong> <a href="mailto:orders@moslimleader.com" className="text-blue-700 hover:underline">orders@moslimleader.com</a></li>
            <li><strong>الموقع:</strong> <a href="https://moslimleader.com" className="text-blue-700 hover:underline">moslimleader.com</a></li>
            <li><strong>صفحة فيسبوك:</strong> <a href="https://www.facebook.com/moslimleader" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">facebook.com/moslimleader</a></li>
          </List>
        </Section>

        <footer className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} مسلم ليدر — جميع الحقوق محفوظة.</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <Link href="/" className="text-blue-700 hover:underline">الرئيسية</Link>
            <span>·</span>
            <Link href="/about" className="text-blue-700 hover:underline">عن المتجر</Link>
            <span>·</span>
            <Link href="/shop" className="text-blue-700 hover:underline">المتجر</Link>
          </div>
        </footer>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 leading-relaxed text-gray-800 text-sm sm:text-base">
      <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pr-6 space-y-1.5 text-gray-700">{children}</ul>;
}

/** The same policy in English, served at /en/policy and to visitors who chose English. */
function EnglishPolicy() {
  return (
    <main dir="ltr" className="min-h-screen bg-gray-50 py-10">
      <article className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10">
        <header className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mt-2">Last updated: {LAST_UPDATED_EN}</p>
          <p className="text-sm text-gray-700 mt-4 leading-relaxed">
            This page explains how <strong>Moslim Leader</strong> (<a href="https://moslimleader.com" className="text-blue-700 hover:underline">moslimleader.com</a>) collects, uses, stores and protects its customers&apos; data.
            By using the site or contacting us through our social media pages, you agree to what is described here.
          </p>
        </header>

        <Section title="1. Who we are">
          <p>
            Moslim Leader is an online store specialising in books, games, bags and educational products for children,
            with a digital library of Islamic books. We mainly serve Egypt and the Gulf, and we offer learning
            products that nurture Islamic values in children.
          </p>
        </Section>

        <Section title="2. Data we collect">
          <p>We collect the following data when you interact with us:</p>
          <ListEn>
            <li><strong>Account data:</strong> name, email address, phone number, password (encrypted).</li>
            <li><strong>Order data:</strong> address, region, payment method, products ordered.</li>
            <li><strong>Communication data:</strong> messages sent via Messenger, comments on our pages, emails.</li>
            <li><strong>Technical data:</strong> IP address, browser type, cookies, pages visited.</li>
            <li><strong>Children&apos;s data (optional):</strong> a child&apos;s name, date of birth and gender if you add them to your account — used to suggest age-appropriate products and to send you a greeting on the child&apos;s birthday. It is used for nothing else.</li>
            <li><strong>Badge picture (optional):</strong> the picture you put the badge on is prepared on your device and is not uploaded to us — unless you share it from a computer, in which case it is uploaded so it appears in the preview of the link you post.</li>
          </ListEn>
        </Section>

        <Section title="3. How we use your data">
          <ListEn>
            <li>To fulfil orders and deliver them to your address.</li>
            <li>To answer your questions via Messenger, comments or email — an AI assistant may reply automatically, under human supervision.</li>
            <li>To suggest products suited to your needs and your children&apos;s.</li>
            <li>To send order notifications and offers (you can unsubscribe at any time).</li>
            <li>To improve our services and measure the site&apos;s performance.</li>
            <li>To meet legal and accounting requirements in Egypt.</li>
          </ListEn>
        </Section>

        <Section title="4. Contact through Facebook and Messenger">
          <p>When you contact us via Messenger or comment on a post on our page:</p>
          <ListEn>
            <li>We receive your public Facebook user ID (PSID) and display name; we do not receive your phone number or email from Facebook.</li>
            <li>An AI assistant may reply automatically. If you provide your details (name, phone, address) yourself in a message, they are kept to complete your order.</li>
            <li>We follow Facebook&apos;s privacy policy (<a href="https://www.facebook.com/about/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">Facebook Data Policy</a>).</li>
            <li>Your conversations with us stay private and are not shared with any third party, except where the law requires it.</li>
          </ListEn>
        </Section>

        <Section title="5. Sharing data">
          <p>We do not sell customer data. We share only what is necessary with:</p>
          <ListEn>
            <li><strong>Shipping companies:</strong> name, address and phone number, to deliver your order.</li>
            <li><strong>Payment gateways</strong> (such as PayPal): to complete online payments.</li>
            <li><strong>AI providers</strong> (Google, OpenAI, Anthropic): to run the assistant, within the limits set out in their policies.</li>
            <li><strong>Legal authorities:</strong> on official request under Egyptian law.</li>
          </ListEn>
        </Section>

        <Section title="6. Cookies">
          <p>
            We use cookies to improve your experience (remembering your cart, your sign-in and your language).
            You can disable them in your browser settings, but some features of the site may be affected.
          </p>
        </Section>

        <Section title="7. Your rights">
          <p>You have the right to:</p>
          <ListEn>
            <li><strong>Access your data:</strong> ask for a copy of the data we hold about you.</li>
            <li><strong>Correction:</strong> ask us to correct any inaccurate information.</li>
            <li><strong>Deletion:</strong> ask us to delete your account and data (except what we must keep by law, such as invoice records).</li>
            <li><strong>Unsubscribe:</strong> from marketing messages at any time.</li>
            <li><strong>Object</strong> to the processing of your data for particular purposes.</li>
          </ListEn>
          <p className="mt-3">To exercise any of these rights, email us at the address below.</p>
        </Section>

        <Section title="8. Protecting your data">
          <ListEn>
            <li>Passwords are encrypted with bcrypt; we do not store card numbers (payment gateways handle them directly).</li>
            <li>All connections use HTTPS.</li>
            <li>Staff access to personal data is limited to what each role needs.</li>
            <li>We review our security regularly.</li>
          </ListEn>
        </Section>

        <Section title="9. Children's privacy">
          <p>
            We sell products for children, but customers must be 18 or older to create an account and place an order.
            We do not collect personal data directly from children. Children&apos;s details a parent adds to their account
            (name and date of birth) are used only to suggest suitable products and to greet the parent on the child&apos;s
            birthday, and the parent can delete them from the account at any time.
          </p>
        </Section>

        <Section title="10. Data retention">
          <p>
            We keep your data while your account is active. After it is closed, we keep order and invoice records
            for 5 years to meet tax and accounting requirements in Egypt.
          </p>
        </Section>

        <Section title="11. Changes to this policy">
          <p>
            We may update this policy from time to time. Significant changes will be announced on the site and/or by
            email. The date of the last update is shown at the top of this page.
          </p>
        </Section>

        <Section title="12. Contact us">
          <p>For any privacy question or request:</p>
          <ListEn>
            <li><strong>Email:</strong> <a href="mailto:orders@moslimleader.com" className="text-blue-700 hover:underline">orders@moslimleader.com</a></li>
            <li><strong>Website:</strong> <a href="https://moslimleader.com" className="text-blue-700 hover:underline">moslimleader.com</a></li>
            <li><strong>Facebook page:</strong> <a href="https://www.facebook.com/moslimleader" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">facebook.com/moslimleader</a></li>
          </ListEn>
          <p className="mt-3 text-gray-500 text-xs">If the Arabic and English versions differ, the Arabic version prevails.</p>
        </Section>

        <footer className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Moslim Leader — All rights reserved.</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <Link href="/" className="text-blue-700 hover:underline">Home</Link>
            <span>·</span>
            <Link href="/about" className="text-blue-700 hover:underline">About</Link>
            <span>·</span>
            <Link href="/shop" className="text-blue-700 hover:underline">Shop</Link>
          </div>
        </footer>
      </article>
    </main>
  );
}

function ListEn({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-6 space-y-1.5 text-gray-700">{children}</ul>;
}
