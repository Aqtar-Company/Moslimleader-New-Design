import type { Lang } from './land-data';

/**
 * «شخصيات مسلم ليدر» under the map — ported from the Lovable project
 * (src/components/characters/). Portraits are in public/land/characters/ (WebP, 600px).
 * Styles: `.royal-*` in land-map.css, scoped under `.lv`.
 */
type Character = { id: string; name: string; title: string; nameEn: string; titleEn: string };

const characters: Character[] = [
  { id: 'hamza', name: 'حمزة', title: 'الإمام', nameEn: 'Hamza', titleEn: 'The Imam' },
  { id: 'malik', name: 'مالك', title: 'الفقيه', nameEn: 'Malik', titleEn: 'The Scholar' },
  { id: 'sara', name: 'سارة', title: 'المعلمة', nameEn: 'Sara', titleEn: 'The Teacher' },
  { id: 'tariq', name: 'طارق', title: 'الفتى', nameEn: 'Tariq', titleEn: 'The Boy' },
  { id: 'habiba', name: 'حبيبة', title: 'الفتاة', nameEn: 'Habiba', titleEn: 'The Girl' },
  { id: 'rahima', name: 'رحيمة', title: 'الراوية', nameEn: 'Raheema', titleEn: 'The Storyteller' },
];

function Card({ c, lang }: { c: Character; lang: Lang }) {
  const name = lang === 'ar' ? c.name : c.nameEn;
  const title = lang === 'ar' ? c.title : c.titleEn;
  const other = lang === 'ar' ? 'en' : 'ar';
  return (
    <article className="royal-card">
      <div className="royal-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/land/characters/${c.id}.webp`} alt={`${title} ${name}`} loading="lazy" width={600} height={800}
          className="h-full w-full object-cover object-bottom mix-blend-multiply" />
      </div>
      <div className="mt-4 text-center">
        <p className="royal-title">✦ {title} ✦</p>
        <h3 className="royal-name">{name}</h3>
        <p lang={other} dir={other === 'ar' ? 'rtl' : 'ltr'} className="royal-secondary mt-1">
          {lang === 'ar' ? `${c.titleEn} · ${c.nameEn}` : `${c.title} ${c.name}`}
        </p>
      </div>
    </article>
  );
}

export default function Characters({ lang }: { lang: Lang }) {
  return (
    <section className="lv mt-20" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="characters-title">
      <div className="text-center">
        <p className="royal-title" aria-hidden>✦ ✦ ✦</p>
        <h2 id="characters-title" className="royal-name text-2xl sm:text-4xl">{lang === 'ar' ? 'شخصيات مسلم ليدر' : 'Moslim Leader Characters'}</h2>
        <p lang={lang === 'ar' ? 'en' : 'ar'} className="royal-secondary mt-2">{lang === 'ar' ? 'Moslim Leader Characters' : 'شخصيات مسلم ليدر'}</p>
        <div className="royal-rule mx-auto mt-4" />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
        {characters.map(c => <Card key={c.id} c={c} lang={lang} />)}
      </div>
    </section>
  );
}
