/**
 * Moslim Leader Land — the content: districts, audiences, and the places on the map.
 * One copy, read by the page and by the map (LandMap.tsx).
 */
import type { IconName } from '@/components/media/Icon';

export type L = { ar: string; en: string };
export type Who = 'kids' | 'men' | 'women' | 'family';
export type District = {
  id: string;
  /** Order on the page and in lists — never shown: the owner does not fix a count. */
  n: number;
  icon: IconName;
  hue: string;
  title: L;
  tag: L;
  intro: L;
  /** What it offers each audience. An empty list is shown as «خاص بـ…» by `onlyFor`. */
  who: Record<Who, L[]>;
  onlyFor?: Who;
  img?: string;
};

export const AUD: Record<Who, { ar: string; en: string; dot: string }> = {
  kids: { ar: 'للأطفال', en: 'Children', dot: '#F5C518' },
  men: { ar: 'للرجال', en: 'Men', dot: '#7FB2E5' },
  women: { ar: 'للنساء', en: 'Women', dot: '#E7A9BD' },
  family: { ar: 'للأسرة معاً', en: 'The family together', dot: '#9BCB8F' },
};
export const WHO_ORDER: Who[] = ['kids', 'men', 'women', 'family'];

export const DISTRICTS: District[] = [
  {
    id: 'stories', n: 1, icon: 'book', hue: '#E8C873', img: '/land/map/screening.webp',
    title: { ar: 'دار العرض', en: 'The Screening House' },
    tag: { ar: 'أفلام مسلم ليدر ورواياتها', en: 'Moslim Leader’s films and novels' },
    intro: {
      ar: 'دار عرض لأفلام مسلم ليدر ورواياتها، وقاعات تفاعلية، وشخصيات مسلم ليدر في المكان نفسه — بعروض للأسرة مجتمعة، وأخرى للرجال وللنساء.',
      en: 'A screening house for Moslim Leader’s films and novels, interactive halls, and the Moslim Leader characters on site — with screenings for the whole family, and others for men and for women.',
    },
    who: {
      kids: [{ ar: 'شخصيات مسلم ليدر', en: 'The Moslim Leader characters' }, { ar: 'القاعات التفاعلية', en: 'Interactive halls' }],
      men: [{ ar: 'عروض خاصة بالرجال', en: 'Screenings for men' }],
      women: [{ ar: 'عروض خاصة بالنساء', en: 'Screenings for women' }],
      family: [{ ar: 'أفلام مسلم ليدر ورواياتها تشاهدها الأسرة معاً', en: 'Moslim Leader’s films and novels, watched together' }],
    },
  },
  {
    id: 'games', n: 2, icon: 'zap', hue: '#8FC3D1', img: '/land/map/stories-experiences.webp',
    title: { ar: 'دار الألعاب', en: 'The House of Games' },
    tag: { ar: 'ألعاب تحترم الهوية', en: 'Games that respect identity' },
    intro: {
      ar: 'ألعاب رقمية وساحات لعب بمفهوم إسلامي، تقوم على الفكر الإسلامي وفلسفته وتحترم هوية الطفل وعقله، ومنها ألعاب «ذاكر» و«رحيمة». لا بيت رعب، ولا لعبة تعرّض حياةً للخطر، ولا ما يُدمن عليه الطفل أو يعزله عن أهله.',
      en: 'Digital games and play grounds on an Islamic concept, built on Islamic thought and its outlook and respectful of a child’s identity and mind — among them the Zaker and Rahima games. No horror house, no ride that risks a life, nothing that hooks a child or cuts them off from their family.',
    },
    who: {
      kids: [{ ar: 'ألعاب «ذاكر» و«رحيمة»', en: 'The Zaker and Rahima games' }, { ar: 'ساحات اللعب', en: 'Play grounds' }],
      men: [{ ar: 'ألعاب خاصة بالرجال', en: 'Games for men' }],
      women: [{ ar: 'ألعاب خاصة بالنساء', en: 'Games for women' }],
      family: [{ ar: 'ألعاب تجتمع عليها الأسرة', en: 'Games the family plays together' }],
    },
  },
  {
    id: 'scouts', n: 3, icon: 'badge', hue: '#B9C79A', img: '/land/map/scouts.webp',
    title: { ar: 'الكشافة', en: 'The Scouts' },
    tag: { ar: 'شخصية قوية، وغدٌ أفضل', en: 'Strong character, a brighter tomorrow' },
    intro: {
      ar: 'ميدان الأولاد: تسلّق وحبال وعُقد وتخييم بإشراف قادة، تُصنع فيه الشجاعة والانضباط وروح الفريق. وفيه ركن العطاء، يتعلّم فيه الولد أن القائد يخدم الناس.',
      en: 'The boys’ field: climbing, ropes, knots and camping under trained leaders, where courage, discipline and team spirit are made. And the Giving Corner, where a boy learns that a leader serves people.',
    },
    who: {
      kids: [{ ar: 'الكشافة للأولاد بإشراف قادة', en: 'Supervised scouts for boys' }, { ar: 'ركن العطاء', en: 'The Giving Corner' }],
      men: [{ ar: 'الحلّاق', en: 'The barber' }],
      women: [{ ar: 'أنشطة خاصة بالنساء', en: 'Activities for women' }],
      family: [{ ar: 'أيام تطوّع تجمع الأسرة', en: 'Volunteering days for the family' }],
    },
  },
  {
    id: 'girls', n: 4, icon: 'heart', hue: '#E7A9BD', img: '/land/map/club-wellbeing.webp', onlyFor: 'women',
    title: { ar: 'نادي البنات والسيدات', en: 'The Girls’ and Women’s Club' },
    tag: { ar: 'صحة وخصوصية ومجتمع', en: 'Wellbeing, privacy, community' },
    intro: {
      ar: 'مساحة للبنات والسيدات تُصان فيها الخصوصية صوناً كاملاً: رياضة وعافية، وركن «حكاية تصنع أثراً» مع رحيمة، ولقاءات للتعلّم والدعم.',
      en: 'A space for girls and women where privacy is kept in full: sport and wellbeing, the «A story that leaves a mark» corner with Rahima, and gatherings for learning and support.',
    },
    who: {
      kids: [{ ar: 'ركن «حكاية تصنع أثراً»', en: 'The «A story that leaves a mark» corner' }, { ar: 'رياضة البنات', en: 'Sport for girls' }],
      men: [],
      women: [{ ar: 'رياضة وعافية بخصوصية', en: 'Sport and wellbeing in privacy' }, { ar: 'لقاءات التعلّم والدعم', en: 'Learning and support' }],
      family: [{ ar: 'الأم وابنتها معاً', en: 'Mother and daughter together' }],
    },
  },
  {
    id: 'family', n: 5, icon: 'comment', hue: '#B7A9DA', img: '/land/map/forum-campus.webp',
    title: { ar: 'الملتقى الثقافي والفكري', en: 'The Cultural and Intellectual Forum' },
    tag: { ar: 'نبني أسرة واعية', en: 'Building a mindful family' },
    intro: {
      ar: 'ملتقى للأسرة ودعمها: محاضرات ومجالس فكرية، وورش يتعلّم فيها الآباء والأبناء معاً، ومركز للفتوى وللإصلاح في الخلافات الزوجية، ومركز أسرة متكامل للاستشارات التربوية والنفسية بالتعاون مع منصة كليم، وتأهيل للمقبلين على الزواج.',
      en: 'A forum for the family and its support: lectures and circles of thought, workshops where parents and children learn together, a centre for fatwa and for reconciling marital disputes, a complete family centre for parenting and psychological counselling with the Kaleem platform, and preparation for those about to marry.',
    },
    who: {
      kids: [{ ar: 'ورش القيم للأبناء', en: 'Values workshops for children' }],
      men: [{ ar: 'ملتقى الآباء', en: 'The fathers’ forum' }],
      women: [{ ar: 'ملتقى الأمهات', en: 'The mothers’ forum' }],
      family: [{ ar: 'ورش الآباء والأبناء', en: 'Parent-and-child workshops' }, { ar: 'الفتوى والإصلاح الأسري', en: 'Fatwa and family reconciliation' }, { ar: 'تأهيل المقبلين على الزواج', en: 'Preparation for marriage' }],
    },
  },
  {
    id: 'plaza', n: 6, icon: 'moon', hue: '#9BCB8F', img: '/land/map/garden-golden-hour.webp',
    title: { ar: 'الحديقة الكبرى', en: 'The Great Garden' },
    tag: { ar: 'قلب المكان', en: 'The heart of the place' },
    intro: {
      ar: 'حديقة واسعة في قلب المكان بأماكن جلسات مختلفة، للعائلات وللسيدات وللرجال، يلعب فيها الصغار على مرأى من أهلهم. وفيها مجلس لكبار السن يحكي فيه الأجداد لأحفادهم، وقاعة لمناسبات الأسرة: العقيقة، وختم القرآن، وتخرّج حلقات التحفيظ. ومن حولها مقهى العائلة ومتجر مسلم ليدر.',
      en: 'A wide garden at the heart of the place with many kinds of seating — for families, for women, for men — where little ones play within their parents’ sight. It holds an elders’ majlis where grandparents tell their grandchildren the old stories, and a hall for the family’s occasions: aqiqah, completing the Quran, graduating from memorisation circles. Around it, the family café and the Moslim Leader store.',
    },
    who: {
      kids: [{ ar: 'مساحات لعب في الحديقة', en: 'Play spaces in the garden' }],
      men: [{ ar: 'جلسات الرجال', en: 'Seating for men' }, { ar: 'مجلس كبار السن', en: 'The elders’ majlis' }],
      women: [{ ar: 'جلسات خاصة بالسيدات', en: 'Seating for women' }],
      family: [{ ar: 'جلسات عائلية', en: 'Family seating' }, { ar: 'قاعة المناسبات', en: 'The events hall' }, { ar: 'مقهى العائلة والمتجر', en: 'The family café and the store' }],
    },
  },
];
