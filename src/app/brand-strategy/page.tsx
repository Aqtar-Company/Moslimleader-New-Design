'use client';

import { useLang } from '@/context/LanguageContext';

export default function BrandStrategyPage() {
  const { isRtl } = useLang();

  const isAr = isRtl;

  return (
    <div dir="rtl" className="bg-[#0C1428] min-h-screen text-gray-300 py-12 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block bg-[#F5C518] text-[#0C1428] text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-4">
            وثيقة استراتيجية داخلية · 2026
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">الرؤية الاستراتيجية</h1>
          <p className="text-[#F5C518] text-lg font-bold">مسلم ليدر</p>
          <div className="w-16 h-1 bg-[#F5C518] mx-auto mt-6 rounded-full" />
        </div>

        {/* Identity */}
        <section className="mb-10">
          <h2 className="section-title">الهوية والرؤية والرسالة</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { tag: 'الرؤية', text: 'أن نكون العلامة الأولى في العالم العربي في المنتجات التربوية الملموسة التي تبني في الطفل المسلم السعي إلى الإمامة في الدين والدنيا.' },
              { tag: 'الرسالة', text: 'تقديم منتجات وأنشطة واقعية عالية الجودة تُقوّي صلة الطفل بالله، وتُرسّخ روابط الأسرة، وتُنمّي المسؤولية تجاه الآخرين.' },
              { tag: 'القيم', text: 'الصدق والشفافية · الجودة قبل السرعة · الواقعية بدل الخيال · الاحتشام · الإحسان في التعامل.' },
            ].map(card => (
              <div key={card.tag} className="card">
                <span className="tag">{card.tag}</span>
                <p className="text-sm text-gray-300 leading-relaxed">{card.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why tangible */}
        <section className="mb-10">
          <div className="flex gap-5 items-start bg-[#16223F] border border-[#F5C518]/30 rounded-2xl p-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#F5C518]/15 flex items-center justify-center text-2xl">📦</div>
            <div>
              <h3 className="text-[#F5C518] font-bold text-base mb-2">لماذا المنتج الملموس؟</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                الطفل يتعلم ويتشرّب القيم بحواسه: كتاب يمسكه، لعبة يلعبها مع أسرته، مفكرة يكتب فيها بيده.
                المنتج الملموس يبقى في بيت الأسرة سنوات ويُرى ويُهدى ويُتوارث — فيتحول كل منتج إلى سفير دائم للرسالة.
                كما أنه يقلل وقت الشاشات ويعيد اللعب والقراءة الحقيقية إلى يوم الطفل، وهو ما يبحث عنه الوالدان اليوم تحديدًا.
              </p>
            </div>
          </div>
        </section>

        {/* Product lines */}
        <section className="mb-10">
          <h2 className="section-title">خطوط المنتجات الستة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: '📚', title: 'القصص والكتب والروايات', desc: 'قصص تربوية بأسلوب عصري تعزز هوية الطفل المسلم وتغرس القيم بطريقة قصصية جذابة.' },
              { icon: '📖', title: 'المكتبة الرقمية', desc: 'كتب رقمية وتفاعلية متاحة بـ 6 لغات، تمزج بين المحتوى الديني والتعليمي بتقنيات حديثة.' },
              { icon: '🎲', title: 'الألعاب الورقية وتنمية المهارات', desc: 'ألعاب تفاعلية تربوية تُنمّي التفكير النقدي والمهارات الاجتماعية ضمن إطار إسلامي.' },
              { icon: '📿', title: 'أدوات تعليم القرآن', desc: 'مستلزمات مبتكرة تُيسّر حفظ القرآن وتجويده وتجعل رحلة التعلم ممتعة ومنظمة.' },
              { icon: '✏️', title: 'الأدوات والمستلزمات الدراسية', desc: 'أدوات مكتبية ومفكرات وكراسات تحمل هوية مسلم ليدر وتُلهم الطالب في يومه الدراسي.' },
              { icon: '🎒', title: 'الملابس والشنط', desc: 'خط ملابس وحقائب خاص بمسلم ليدر يلتزم بمعايير الاحتشام ويعكس هوية الطفل المسلم الواثق.' },
            ].map(p => (
              <div key={p.title} className="card">
                <span className="text-3xl block mb-2">{p.icon}</span>
                <h4 className="text-white font-bold text-sm mb-1">{p.title}</h4>
                <p className="text-gray-400 text-xs leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Target audience */}
        <section className="mb-10">
          <h2 className="section-title">الجمهور المستهدف</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: '👨‍👩‍👧', title: 'الأسر المسلمة', desc: 'آباء وأمهات يبحثون عن بديل أصيل للمحتوى الترفيهي الغربي يناسب قيمهم الإسلامية.' },
              { icon: '🏫', title: 'المدارس والحضانات الإسلامية', desc: 'مؤسسات تعليمية تسعى لدمج التربية الإسلامية مع المناهج الحديثة.' },
              { icon: '🌍', title: 'الجاليات المسلمة في الغرب', desc: 'أسر مسلمة في أوروبا وأمريكا تحتاج محتوى بلغات متعددة يعزز هوية أبنائها.' },
              { icon: '🎁', title: 'سوق الهدايا الإسلامية', desc: 'أفراد وشركات يبحثون عن هدايا ذات معنى للمناسبات الدينية والاحتفالية.' },
            ].map(a => (
              <div key={a.title} className="card flex gap-4 items-start">
                <span className="text-3xl flex-shrink-0">{a.icon}</span>
                <div>
                  <h4 className="text-white font-bold text-sm mb-1">{a.title}</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Competitive advantages */}
        <section className="mb-10">
          <h2 className="section-title">الميزة التنافسية</h2>
          <ol className="space-y-3">
            {[
              'منظومة متكاملة لا منتج منفرد — الكتاب واللعبة والمفكرة والحقيبة تخدم نفس المنهج التربوي.',
              'ضوابط شرعية وتربوية معلنة وموثّقة تمنح الوالدين ثقة يصعب على المنافسين تقليدها.',
              'دمج تقنيات حديثة (AR ومكتبة رقمية بـ 6 لغات) داخل منتجات ملموسة — نادر في السوق.',
              'محتوى أصلي مؤلَّف داخليًا يعالج أسئلة وشبهات حقيقية بأسلوب قصصي.',
              'تغطية سلسلة القيمة كاملة: تأليف، تصميم، طباعة، إنتاج، بيع — تحكم في الجودة والهامش.',
            ].map((adv, i) => (
              <li key={i} className="flex gap-3 items-start text-sm text-gray-300 leading-relaxed">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#F5C518]/15 text-[#F5C518] font-black text-xs flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {adv}
              </li>
            ))}
          </ol>
        </section>

        {/* Content strategy */}
        <section className="mb-10">
          <h2 className="section-title">استراتيجية المحتوى</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: '📱', title: 'منصات التواصل الاجتماعي', desc: 'محتوى تربوي يومي على إنستغرام وفيسبوك ويوتيوب يعكس قيم البراند ويبني مجتمعاً من الآباء المهتمين.' },
              { icon: '🎙️', title: 'البودكاست والفيديو', desc: 'حلقات دورية تناقش تحديات التربية الإسلامية المعاصرة مع متخصصين وأولياء أمور.' },
              { icon: '📰', title: 'المحتوى التعليمي', desc: 'مقالات وأدلة إرشادية للوالدين حول التربية الإسلامية المتوازنة في العصر الرقمي.' },
              { icon: '🤝', title: 'الشراكات الاستراتيجية', desc: 'تعاون مع علماء وتربويين ومؤثرين إسلاميين لتوسيع الوصول وتعزيز المصداقية.' },
            ].map(c => (
              <div key={c.title} className="card">
                <span className="text-2xl block mb-2">{c.icon}</span>
                <h4 className="text-white font-bold text-sm mb-1">{c.title}</h4>
                <p className="text-gray-400 text-xs leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Business model */}
        <section className="mb-10">
          <h2 className="section-title">النموذج التجاري</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: '🛒', title: 'البيع المباشر', desc: 'متجر إلكتروني + نقاط بيع مباشرة للمستهلك النهائي بهامش ربح أعلى.' },
              { icon: '🏪', title: 'البيع بالجملة', desc: 'شراكات مع مكتبات ومدارس وموزعين إقليميين لتوسيع نطاق الوصول الجغرافي.' },
              { icon: '💻', title: 'الاشتراكات الرقمية', desc: 'نموذج اشتراك شهري/سنوي للمكتبة الرقمية يوفر تدفق إيرادات متكرر ومستدام.' },
            ].map(b => (
              <div key={b.title} className="card text-center">
                <span className="text-3xl block mb-3">{b.icon}</span>
                <h4 className="text-white font-bold text-sm mb-2">{b.title}</h4>
                <p className="text-gray-400 text-xs leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section className="mb-10">
          <h2 className="section-title">خارطة الطريق</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { phase: 'المرحلة 1', title: 'تثبيت الأساس', desc: 'اكتمال الكتالوج · رفع رضا العملاء · توثيق معايير الجودة لكل منتج · بناء قاعدة بيانات العملاء.' },
              { phase: 'المرحلة 2', title: 'التوسع في القنوات', desc: 'شراكات مع مدارس وحضانات ومكتبات · تفعيل البيع بالجملة · رفع متوسط سلة الشراء.' },
              { phase: 'المرحلة 3', title: 'التوسع الجغرافي', desc: 'الخليج أولوية · الوصول للعالم الإسلامي في آسيا وأوروبا وأمريكا عبر المكتبة الرقمية.' },
            ].map(r => (
              <div key={r.phase} className="card">
                <span className="inline-block text-[#0C1428] bg-[#F5C518] font-black text-xs px-3 py-1 rounded-lg mb-3">
                  {r.phase}
                </span>
                <h4 className="text-white font-bold text-sm mb-2">{r.title}</h4>
                <p className="text-gray-400 text-xs leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Governance note */}
        <div className="border border-[#F5C518]/20 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-400 leading-relaxed">
            ⚖️ <span className="text-[#F5C518] font-bold">حوكمة القيم:</span> أي مؤشر أداء أو هدف نمو يتعارض مع الضوابط الشرعية والتربوية في هذه الوثيقة يُلغى — النمو وسيلة والرسالة هي الغاية.
          </p>
        </div>

      </div>

      <style jsx>{`
        .section-title {
          color: #F5C518;
          font-size: 1rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(245, 197, 24, 0.2);
        }
        .card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 1rem;
          padding: 1.25rem;
          transition: border-color 0.2s;
        }
        .card:hover {
          border-color: rgba(245,197,24,0.35);
        }
        .tag {
          display: inline-block;
          color: #F5C518;
          font-size: 0.75rem;
          font-weight: 700;
          background: rgba(245,197,24,0.1);
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          margin-bottom: 0.75rem;
        }
      `}</style>
    </div>
  );
}
