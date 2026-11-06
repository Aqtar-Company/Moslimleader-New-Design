/**
 * Moslim Leader Land — the content: districts, audiences, and the places on the map.
 * One copy, read by the page and by the map (LandMap.tsx).
 */
import type { IconName } from '@/components/media/Icon';

export type L = { ar: string; en: string };
export type Who = 'kids' | 'men' | 'women' | 'family';
export type District = {
  id: string;
  n: number;
  icon: IconName;
  hue: string;
  title: L;
  tag: L;
  intro: L;
  /** The REAL world the district is themed on — history or nature, never fantasy. */
  world: L;
  worldNote: L;
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
    id: 'stories', n: 1, icon: 'book', hue: '#E8C873', img: '/partnership/land-stories.webp',
    title: { ar: 'عالم الحكايات والسينما', en: 'Stories & Cinema' },
    tag: { ar: 'من الرواية إلى التجربة', en: 'From the novel to the experience' },
    intro: {
      ar: 'تخرج قصص مسلم ليدر من الكتاب: أفلام من رواياتها على الشاشة الكبيرة، وقاعة مغامرات يدخل فيها الطفل إلى القصة، وشخصيات يلتقيها ويتصوّر معها.',
      en: 'Moslim Leader’s stories leave the book: films from its novels on the big screen, an adventure hall that takes a child inside the story, and characters to meet.',
    },
    world: { ar: 'عالم الأندلس', en: 'The world of Andalusia' },
    worldNote: { ar: 'عمارة قرطبة والحمراء، وحكايات أهلها وعلمائها', en: 'The architecture of Córdoba and the Alhambra, and the stories of its people and scholars' },
    who: {
      kids: [{ ar: 'قاعة مغامرات الحكاية', en: 'Story Adventure Hall' }, { ar: 'لقاء الشخصيات', en: 'Meet the characters' }],
      men: [{ ar: 'عروض وثائقية وفكرية', en: 'Documentary & ideas screenings' }],
      women: [{ ar: 'عروض وجلسات خاصة بالسيدات', en: 'Women-only screenings' }],
      family: [{ ar: 'عرض سينمائي عائلي من روايات مسلم ليدر', en: 'Family screenings of Moslim Leader novels' }],
    },
  },
  {
    id: 'girls', n: 4, icon: 'heart', hue: '#E7A9BD', img: '/land/girls-stories.webp', onlyFor: 'women',
    title: { ar: 'نادي البنات والسيدات', en: 'Girls’ & Women’s Club' },
    tag: { ar: 'خصوصية وعافية ومجتمع', en: 'Privacy, wellbeing, community' },
    intro: {
      ar: 'مساحة خاصة بالبنات والسيدات تحفظ خصوصيتهن: رياضة وعافية، وجلسات حكي، ورسم وأشغال، ولقاءات تجمع الأمهات.',
      en: 'A space of the girls’ and women’s own, private by design: sport and wellbeing, storytelling, crafts, and gatherings for mothers.',
    },
    world: { ar: 'رياض فاس', en: 'The riads of Fez' },
    worldNote: { ar: 'بيوت وحدائق مغربية مغلقة على ساحاتها، تحفظ الخصوصية', en: 'Moroccan houses and gardens closed around their courtyards — privacy by design' },
    who: {
      kids: [{ ar: 'ركن «حكاية تصنع أثراً» للبنات', en: 'The girls’ story corner' }, { ar: 'رياضة البنات', en: 'Girls’ sport' }],
      men: [],
      women: [{ ar: 'رياضة وعافية بخصوصية', en: 'Private sport & wellbeing' }, { ar: 'لقاءات الأمهات', en: 'Mothers’ gatherings' }],
      family: [{ ar: 'أمسيات الأم وابنتها', en: 'Mother-and-daughter evenings' }],
    },
  },
  {
    id: 'scouts', n: 3, icon: 'badge', hue: '#B9C79A', img: '/land/scouts-climbing.webp',
    title: { ar: 'الكشافة والمغامرة', en: 'Scouts & Adventure' },
    tag: { ar: 'شخصية قوية وغد أفضل', en: 'Strong character, brighter tomorrow' },
    intro: {
      ar: 'حبال وعُقد، وجدار تسلّق، وجسور معلّقة، وتخييم بإشراف قادة — مغامرة تبني الشجاعة والانضباط وروح الفريق. ومنها يخرج الأولاد إلى ركن العطاء: يجهّزون سلال الخير ويزرعون شجرة للحي، فيتعلّمون أن القائد يخدم الناس.',
      en: 'Ropes and knots, a climbing wall, rope bridges and camping under trained leaders — adventure that builds courage, discipline and team spirit. From there the children go to the Giving Corner: they pack food baskets and plant a tree for the neighbourhood, and learn that a leader serves people.',
    },
    world: { ar: 'الصحراء والواحة', en: 'The desert and the oasis' },
    worldNote: { ar: 'خيام وصخور وكثبان، ونجوم سماء الصحراء التي اهتدى بها المسافرون', en: 'Tents, rocks and dunes, and the desert stars travellers steered by' },
    who: {
      kids: [{ ar: 'الكشافة للأولاد بإشراف قادة', en: 'Supervised scouts for boys' }, { ar: 'ركن العطاء: سلال الخير وزراعة شجرة', en: 'The Giving Corner: food baskets, a tree to plant' }],
      men: [{ ar: 'تحديات الآباء والشباب', en: 'Challenges for fathers & youth' }, { ar: 'صالون الرجال', en: 'Men’s salon' }],
      women: [{ ar: 'رحلات طبيعة خاصة بالسيدات والبنات', en: 'Women-and-girls nature outings' }],
      family: [{ ar: 'تخييم عائلي', en: 'Family camping' }, { ar: 'يوم تطوّع عائلي', en: 'A family volunteering day' }],
    },
  },
  {
    id: 'games', n: 2, icon: 'zap', hue: '#8FC3D1',
    title: { ar: 'الألعاب والملاهي', en: 'Games & Rides' },
    tag: { ar: 'ترفيه يحترم الهوية', en: 'Fun that respects identity' },
    intro: {
      ar: 'ملاهٍ وألعاب فيديو بمفهوم إسلامي، أبطالها شخصيات مسلم ليدر — يكسب فيها الطفل بالمساعدة والقراءة والعمل الطيب.',
      en: 'Rides and video games on an Islamic concept, starring the Moslim Leader characters — where a child scores by helping, reading and doing good.',
    },
    world: { ar: 'طريق ابن بطوطة', en: 'The road of Ibn Battuta' },
    worldNote: { ar: 'ألعاب وملاهٍ على رحلات حقيقية: القوافل والسفن والمدن', en: 'Games and rides built on real journeys: caravans, ships and cities' },
    who: {
      kids: [{ ar: 'ألعاب بشخصيات مسلم ليدر', en: 'Character video games' }, { ar: 'أماكن لعب بإشراف', en: 'Supervised play areas' }],
      men: [{ ar: 'مسابقات وتحديات للشباب والآباء', en: 'Contests for youth & fathers' }],
      women: [{ ar: 'صالة ألعاب للبنات والسيدات', en: 'A games hall for girls & women' }],
      family: [{ ar: 'ملاهٍ وألعاب جماعية للأسرة', en: 'Rides and team games for families' }],
    },
  },
  {
    id: 'family', n: 5, icon: 'comment', hue: '#B7A9DA',
    title: { ar: 'الوعي: الأسرة والفكر', en: 'Awareness: Family & Thought' },
    tag: { ar: 'نبني أسرة واعية', en: 'Building a mindful family' },
    intro: {
      ar: 'ملتقى ثقافي وفكري عن الأسرة ودعمها، ومركز للفتوى والإرشاد يعين الزوجين على حل خلافاتهما، ومركز أسرة متكامل: استشارات تربوية ونفسية بالتعاون مع منصة كليم للصحة النفسية، وتأهيل للمقبلين على الزواج — بينما يتعلّم الأبناء في ورش القيم بجوار آبائهم.',
      en: 'A cultural and intellectual forum on the family, a fatwa and counselling centre that helps couples resolve disputes, and a complete family centre: parenting and psychological counselling with the Kaleem mental-health platform, and preparation for those about to marry — while the children learn in values workshops next door.',
    },
    world: { ar: 'بيت الحكمة', en: 'The House of Wisdom' },
    worldNote: { ar: 'مكتبة بغداد ومجالس علمائها: علم وحوار وأسرة', en: 'Baghdad’s library and its scholars’ circles: learning, dialogue, family' },
    who: {
      kids: [{ ar: 'ورش القيم: الإنصات والتعاون واللطف', en: 'Values workshops: listening, cooperation, kindness' }],
      men: [{ ar: 'ملتقى الآباء وندوات فكرية', en: 'Fathers’ forum & talks' }, { ar: 'مركز الفتوى', en: 'Fatwa centre' }],
      women: [{ ar: 'ملتقى الأمهات', en: 'Mothers’ forum' }, { ar: 'استشارات تربوية ونفسية مع كليم', en: 'Parenting & psychological counselling with Kaleem' }],
      family: [{ ar: 'ورش الآباء والأبناء معاً', en: 'Parent-and-child workshops' }, { ar: 'الإرشاد الزوجي', en: 'Marriage counselling' }, { ar: 'تأهيل المقبلين على الزواج', en: 'Preparation for marriage' }],
    },
  },
  {
    id: 'plaza', n: 6, icon: 'moon', hue: '#9BCB8F', img: '/partnership/land-cafe.webp',
    title: { ar: 'الساحة: الحديقة والمرصد', en: 'The Plaza: Garden & Observatory' },
    tag: { ar: 'حديقة كبيرة تجمع الأسرة', en: 'A large garden that gathers the family' },
    intro: {
      ar: 'قلب المكان حديقة كبيرة تلتقي عندها الطرق، بأماكن جلسات مختلفة: جلسات للعائلات، وجلسات خاصة بالسيدات، وجلسات للرجال، وظلال وماء، ومساحات لعب صغيرة للأطفال على مرأى من أهلهم. وفيها مجلس لكبار السن يحكي فيه الأجداد لأحفادهم حكايات زمان، فتأتي الأسرة بأجيالها الثلاثة، وعلى طرفها قاعة مناسبات عائلية: عقيقة، وختم القرآن، وتخرّج حلقات التحفيظ. ويصلها الزائر من البوابة عبر شارع السوق — متجر مسلم ليدر ومقهى العائلة — ومن هناك يبدأ الطفل رحلته بجواز يُختم في كل منطقة.',
      en: 'The heart of the place is a large garden where the paths meet, with many kinds of seating: family seating, women-only seating, seating for men, shade and water, and small play spaces for children within their parents’ sight. It holds an elders’ majlis where grandparents tell their grandchildren the old stories, so the family comes in all three generations, and at its edge a family events hall: aqiqah, completing the Quran, graduation from memorisation circles. From the gate, visitors reach it through the souq street — the Moslim Leader store and the family café — and a child starts the journey with a passport stamped in every district.',
    },
    world: { ar: 'الحديقة والمرصد', en: 'The garden and the observatory' },
    worldNote: { ar: 'حديقة كبيرة يتوسطها مرصد مستوحى من مراصد سمرقند وإسطنبول، يُرى من كل منطقة', en: 'A large garden around an observatory inspired by those of Samarkand and Istanbul, visible from every district' },
    who: {
      kids: [{ ar: 'مساحات لعب في الحديقة', en: 'Play spaces in the garden' }, { ar: 'حكايات الأجداد', en: 'Grandparents’ stories' }],
      men: [{ ar: 'جلسات الرجال', en: 'Seating for men' }, { ar: 'مجلس كبار السن', en: 'The elders’ majlis' }],
      women: [{ ar: 'جلسات خاصة بالسيدات', en: 'Women-only seating' }, { ar: 'مجلس الجدّات', en: 'The grandmothers’ majlis' }],
      family: [{ ar: 'جلسات عائلية في الحديقة', en: 'Family seating in the garden' }, { ar: 'قاعة المناسبات: عقيقة، ختم القرآن، تخرّج الحلقات', en: 'Events hall: aqiqah, Quran completion, graduations' }, { ar: 'مقهى العائلة والمتجر', en: 'The family café and store' }],
    },
  },
];

