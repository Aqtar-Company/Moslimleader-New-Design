import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية | مسلم ليدر',
  description:
    'سياسة الخصوصية لمتجر مسلم ليدر — كيف نجمع، نستخدم، ونحمي بيانات عملائنا في المتجر، المكتبة الرقمية، والتواصل عبر فيسبوك Messenger.',
  alternates: { canonical: canonical('/policy') },
  openGraph: {
    title: 'سياسة الخصوصية | مسلم ليدر',
    description: 'كيف نتعامل مع بيانات العملاء على منصة مسلم ليدر.',
    url: canonical('/policy'),
    siteName: 'مسلم ليدر',
    type: 'website',
    locale: 'ar_EG',
  },
};

const LAST_UPDATED = '9 مايو 2026';

export default function PrivacyPolicyPage() {
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
            <li><strong>بيانات الأطفال (اختيارية):</strong> الفئة العمرية للأطفال — لاقتراح منتجات مناسبة فقط، ولا تُستخدم لأي غرض آخر.</li>
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
            لا نجمع بيانات شخصية مباشرة من الأطفال. الأعمار التي تذكرها الأم في محادثاتنا تُستخدم فقط
            لاقتراح منتجات مناسبة.
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
