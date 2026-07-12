import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'ركن القيم للحضانات | مسلم ليدر',
  description: 'دليل ركن القيم للحضانات — بيئة تربوية متكاملة تغرس القيم والأخلاق في نفوس أطفالك من خلال القصة واللعبة والتحفيز.',
};

const BASE = '/wp-content/uploads';

const benefits = [
  { icon: '🌱', label: 'غرس القيم والأخلاق' },
  { icon: '📚', label: 'تنمية حب القراءة' },
  { icon: '🧩', label: 'التعلم باللعب' },
  { icon: '👑', label: 'صناعة القدوة' },
  { icon: '🤝', label: 'تعزيز التعاون' },
  { icon: '📖', label: 'الارتباط بالقرآن' },
  { icon: '🏆', label: 'التحفيز الإيجابي' },
];

const STATIC_PRODUCTS = [
  {
    slug: 'leader-medal',
    name: 'وسام القائد',
    price: 500,
    image: `${BASE}/2024/07/Leader-Medal.webp`,
    desc: 'برنامج تحفيزي أسبوعي لتكريم الطفل المتميز في الأخلاق والنظام والحفظ والالتزام.',
  },
  {
    slug: 'puzzle-boys',
    name: 'البازل التربوي — أولاد',
    price: 220,
    image: `${BASE}/2024/07/Puzzle-Boys-1.webp`,
    desc: 'بازل تعليمي للأولاد يُنمي مهارات التفكير ويُعزز القيم من خلال الأنشطة الجماعية.',
  },
  {
    slug: 'puzzle-girls',
    name: 'البازل التربوي — بنات',
    price: 220,
    image: `${BASE}/2024/07/Puzzle-Girls-1.webp`,
    desc: 'بازل تعليمي للبنات يُنمي مهارات التفكير والتركيز بأشكال ملهمة ومصممة خصيصًا لهن.',
  },
  {
    slug: 'my-son-asks-series',
    name: 'سلسلة ابني يسأل',
    price: 250,
    image: `${BASE}/2024/07/My-Son-Asks-1.webp`,
    desc: '7 قصص تُجيب عن أسئلة الأطفال الحقيقية عن الدين والحياة بأسلوب بسيط ومحبب.',
  },
  {
    slug: 'pray-story',
    name: 'قصة الصلاة',
    price: 250,
    image: `${BASE}/2024/07/Pray-Story-1.webp`,
    desc: '6 قصص مصورة تُعرّف الطفل بمعنى الصلاة وأثرها في حياته اليومية بلغة قريبة من قلبه.',
  },
  {
    slug: 'righteousness-series',
    name: 'مسلسل البر',
    price: 300,
    image: `${BASE}/2024/07/The-Series-of-Righteousness-1.webp`,
    desc: '7 قصص تُغرس البر والصدق والتعاون من خلال شخصيات يُحبها الأطفال، من سن 5 إلى 12.',
  },
  {
    slug: 'masek',
    name: 'ماسك — حامل المصحف',
    price: 230,
    image: `${BASE}/2024/10/Masek-Cover.webp`,
    desc: 'حامل مصحف خشبي للأطفال يُهيئ ركن قرآن جميل ويُشجعهم على التلاوة اليومية.',
  },
];

const timeline = [
  { step: '01', icon: '📖', title: 'وقت القصة', desc: 'المعلمة تقرأ من سلاسل مسلم ليدر وتناقش قيمة اليوم' },
  { step: '02', icon: '🧩', title: 'وقت النشاط', desc: 'البازل التربوي الجماعي لتعزيز التعاون والتفكير' },
  { step: '03', icon: '✨', title: 'التحفيز بالاستيكر', desc: 'مكافأة فورية على الالتزام والإنجاز اليومي' },
  { step: '04', icon: '🏅', title: 'تكريم المتميز', desc: 'وسام القادة الأسبوعي يصنع نماذج يقتدي بها أقرانهم' },
  { step: '05', icon: '📚', title: 'ركن القصص', desc: 'قراءة جماعية من سلاسل ابني يسأل، قصة الصلاة، ومسلسل البر — كل قصة تفتح نقاشًا تربويًا حول قيمة اليوم' },
  { step: '06', icon: '📖', title: 'ركن القرآن', desc: 'حامل المصحف يُهيئ جواً روحانياً هادئاً داخل الحضانة' },
];

const pricing = [
  { name: 'شيتات الاستيكر — أولاد', price: 40 },
  { name: 'شيتات الاستيكر — بنات', price: 40 },
  { name: 'البازل التربوي (أولاد أو بنات)', price: 220 },
  { name: 'سلسلة ابني يسأل', price: 250 },
  { name: 'قصة الصلاة', price: 250 },
  { name: 'مسلسل البر', price: 300 },
  { name: 'ماسك — حامل المصحف', price: 230 },
  { name: 'وسام القائد', price: 500 },
];

async function getStickerImages(): Promise<{ boys: string | null; girls: string | null; boysModel: number; girlsModel: number }> {
  try {
    const product = await prisma.product.findFirst({
      where: { slug: 'stickers-kids' },
      select: { images: true, variants: true },
    });
    if (!product) return { boys: null, girls: null, boysModel: 0, girlsModel: 1 };
    const imgs = Array.isArray(product.images) ? (product.images as string[]) : [];
    const variants = Array.isArray(product.variants)
      ? (product.variants as { name?: string; imageIndex?: number }[])
      : [];
    // Find boys/girls by name (Arabic or English) or fall back to index 0/1
    const boysIdx = variants.findIndex(v => /ولاد|boy/i.test(v.name ?? ''));
    const girlsIdx = variants.findIndex(v => /بنات|girl/i.test(v.name ?? ''));
    const boysVariant = variants[boysIdx >= 0 ? boysIdx : 0];
    const girlsVariant = variants[girlsIdx >= 0 ? girlsIdx : 1];
    return {
      boys: imgs[boysVariant?.imageIndex ?? 0] ?? imgs[0] ?? null,
      girls: imgs[girlsVariant?.imageIndex ?? (boysVariant?.imageIndex === 1 ? 0 : 1)] ?? imgs[1] ?? null,
      boysModel: boysIdx >= 0 ? boysIdx : 0,
      girlsModel: girlsIdx >= 0 ? girlsIdx : 1,
    };
  } catch { return { boys: null, girls: null, boysModel: 0, girlsModel: 1 }; }
}

export default async function NurseryPage() {
  const stickerImgs = await getStickerImages();

  const products = [
    ...STATIC_PRODUCTS.slice(0, 3), // وسام + بازل أولاد + بازل بنات
    {
      slug: `stickers-kids?model=${stickerImgs.boysModel}`,
      name: 'الملصقات — أولاد',
      price: 40,
      image: stickerImgs.boys,
      emoji: '✨',
      desc: 'ملصقات تحفيزية للأولاد تُستخدم على لوحات الإنجاز ودفاتر الأطفال كمكافأة يومية.',
    },
    {
      slug: `stickers-kids?model=${stickerImgs.girlsModel}`,
      name: 'الملصقات — بنات',
      price: 40,
      image: stickerImgs.girls,
      emoji: '🌸',
      desc: 'ملصقات تحفيزية للبنات تُستخدم على لوحات الإنجاز ودفاتر الأطفال كمكافأة يومية.',
    },
    ...STATIC_PRODUCTS.slice(3), // باقي المنتجات
  ];
  return (
    <main dir="rtl" className="bg-white text-[#1a1a2e] font-sans">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#1a1a2e] text-white">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #4a9c6f 0%, transparent 60%), radial-gradient(circle at 80% 20%, #F5C518 0%, transparent 50%)' }} />
        <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
          <span className="inline-block bg-[#F5C518]/20 text-[#F5C518] text-xs font-black tracking-widest uppercase px-4 py-1.5 rounded-full mb-6">
            مسلم ليدر × الحضانات
          </span>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4">
            🌱 ركن القيم<br />
            <span className="text-[#4a9c6f]">للحضانات</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/70 font-light mb-3">
            معًا نبني قادة
          </p>
          <p className="text-sm text-white/40 mb-10">
            معًا نصنع قادة الغد
          </p>
          <a
            href="https://wa.me/201060306803?text=أريد معرفة المزيد عن ركن القيم للحضانات"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#4a9c6f] hover:bg-[#3d8860] text-white font-black px-8 py-4 rounded-2xl text-lg transition shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.374 0 0 5.373 0 12c0 2.128.557 4.127 1.529 5.862L0 24l6.335-1.652A11.956 11.956 0 0012 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.818a9.818 9.818 0 01-4.964-1.345l-.356-.212-3.762.981.999-3.655-.232-.375A9.818 9.818 0 1112 21.818z"/></svg>
            تواصل معنا على واتساب
          </a>
        </div>
      </section>

      {/* ── Why? ── */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-black mb-6">
          لماذا يحتاج كل طفل<br />إلى <span className="text-[#4a9c6f]">ركن قيم؟</span>
        </h2>
        <p className="text-gray-600 text-lg leading-relaxed mb-6">
          يقضي الطفل ساعات طويلة داخل الحضانة، ولذلك فهي ليست مكانًا للتعلم فقط، بل بيئة تُبنى فيها شخصيته، وتُغرس فيها عاداته، وتتكون فيها قيمه.
        </p>
        <p className="text-gray-600 text-lg leading-relaxed">
          ومن هنا جاءت فكرة <strong className="text-[#1a1a2e]">ركن القيم من مسلم ليدر</strong>...
          ركن تربوي يجمع بين القصة، واللعبة، والنشاط، والتحفيز؛ ليصبح تعليم القيم جزءًا من الحياة اليومية داخل الحضانة.
        </p>
      </section>

      {/* ── Benefits infographic ── */}
      <section className="bg-[#f5f0e8] py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-black text-center mb-12">
            ماذا يضيف ركن القيم <span className="text-[#4a9c6f]">لحضانتك؟</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {benefits.map((b, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 text-center shadow-sm hover:shadow-md transition hover:-translate-y-1">
                <span className="text-4xl block mb-3">{b.icon}</span>
                <p className="font-bold text-sm text-gray-800 leading-snug">{b.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-black text-center mb-3">
            مكونات <span className="text-[#4a9c6f]">ركن القيم</span>
          </h2>
          <p className="text-gray-500 text-center mb-12">كل منتج مصمم ليؤدي دورًا تربويًا محددًا</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {products.map((p, i) => {
              const inner = (
                <>
                  {/* Image or emoji placeholder */}
                  <div className="relative bg-[#f9f7f4] aspect-square overflow-hidden flex items-center justify-center">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <span className="text-6xl select-none">{(p as {emoji?: string}).emoji ?? '✨'}</span>
                    )}
                    <span className="absolute top-3 right-3 bg-[#4a9c6f] text-white text-xs font-black px-3 py-1.5 rounded-full shadow">
                      {p.price} ج.م
                    </span>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-black text-[#1a1a2e] text-sm mb-1 leading-snug">{p.name}</h3>
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{p.desc}</p>
                    {p.slug && (
                      <span className="mt-3 inline-block text-[#4a9c6f] text-xs font-black group-hover:underline">
                        اعرف أكثر ←
                      </span>
                    )}
                  </div>
                </>
              );
              return p.slug ? (
                <Link
                  key={i}
                  href={`/shop/${p.slug}`}
                  className="group bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition hover:-translate-y-1"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={i}
                  className="group bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How to use: Timeline ── */}
      <section className="bg-[#f5f0e8] py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-black text-center mb-4">
            كيف تستخدم المعلمة <span className="text-[#4a9c6f]">ركن القيم؟</span>
          </h2>
          <p className="text-center text-gray-500 mb-12">برنامج يومي متكامل داخل الفصل</p>
          <div className="relative">
            <div className="absolute right-6 top-0 bottom-0 w-0.5 bg-[#4a9c6f]/20" />
            <div className="space-y-8">
              {timeline.map((t, i) => (
                <div key={i} className="flex gap-6 items-start relative">
                  <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-[#4a9c6f] text-white flex items-center justify-center font-black text-sm shadow-md">
                    {t.step}
                  </div>
                  <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{t.icon}</span>
                      <h3 className="font-black text-[#1a1a2e]">{t.title}</h3>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Customization ── */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-black mb-4">
          صممي ركن القيم<br />
          <span className="text-[#4a9c6f]">بما يناسب حضانتك</span>
        </h2>
        <p className="text-gray-600 text-lg mb-10">
          لا توجد باقة واحدة ثابتة... بل يتم تصميم الركن بما يناسب كل حضانة.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: '👦', label: 'عدد الأطفال' },
            { icon: '🎂', label: 'الفئة العمرية' },
            { icon: '📐', label: 'مساحة الحضانة' },
            { icon: '💰', label: 'الميزانية' },
          ].map((item, i) => (
            <div key={i} className="bg-[#f5f0e8] rounded-2xl p-5 text-center">
              <span className="text-3xl block mb-2">{item.icon}</span>
              <p className="font-bold text-sm text-gray-700">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing table ── */}
      <section className="bg-[#f5f0e8] py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-black text-center mb-10">
            قائمة <span className="text-[#4a9c6f]">الأسعار</span>
          </h2>
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1a1a2e] text-white">
                  <th className="py-4 px-6 text-right font-black">المنتج</th>
                  <th className="py-4 px-6 text-left font-black">السعر</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f9f7f4]'}>
                    <td className="py-4 px-6 font-semibold text-gray-800">{row.name}</td>
                    <td className="py-4 px-6 font-black text-[#4a9c6f] text-left">{row.price} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-[#4a9c6f]/10 border-t border-[#4a9c6f]/20 px-6 py-4">
              <p className="text-[#1a1a2e] font-bold text-sm text-center">
                🏫 تتوفر أسعار خاصة للحضانات والمؤسسات التعليمية عند تجهيز ركن القيم
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[#1a1a2e] py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <img src="/ml-logo-new.png" alt="مسلم ليدر" className="h-16 mx-auto mb-8 opacity-90" />
          <h2 className="text-3xl font-black text-white mb-4">
            ابدئي بناء<br /><span className="text-[#4a9c6f]">ركن القيم</span> اليوم
          </h2>
          <p className="text-white/60 mb-10">
            فريقنا جاهز لمساعدتك في اختيار المنتجات المناسبة لحضانتك وتجهيز الركن من الصفر.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/201060306803?text=أريد معرفة المزيد عن ركن القيم للحضانات"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5c] text-white font-black px-8 py-4 rounded-2xl transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.374 0 0 5.373 0 12c0 2.128.557 4.127 1.529 5.862L0 24l6.335-1.652A11.956 11.956 0 0012 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.818a9.818 9.818 0 01-4.964-1.345l-.356-.212-3.762.981.999-3.655-.232-.375A9.818 9.818 0 1112 21.818z"/></svg>
              واتساب
            </a>
            <a
              href="tel:+201060306803"
              className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/50 text-white font-bold px-8 py-4 rounded-2xl transition"
            >
              📞 ‪(+20) 106 030 6803‬
            </a>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center gap-2 bg-[#F5C518] hover:bg-yellow-400 text-[#1a1a2e] font-black px-8 py-4 rounded-2xl transition"
            >
              تسوق الآن
            </Link>
          </div>
          <p className="text-white/30 text-xs mt-10">
            moslimleader.com &nbsp;·&nbsp; info@moslimleader.com
          </p>
        </div>
      </section>

    </main>
  );
}
