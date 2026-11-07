/**
 * Content of the Land's interactive map — PORTED FROM THE LOVABLE PROJECT
 * (github.com/Aqtar-Company/pixel-perfect-replay-42559, src/components/land/land-data.ts).
 *
 * The owner designs the map in Lovable; this file keeps the same shape and the same
 * strings so the next change there can be carried over by diffing the two files.
 * Images are copies of the Lovable assets, converted to WebP, in public/land/map/.
 * Coordinates are on a 1200 × 760 canvas laid over public/land/map/masterplan.webp.
 *
 * Lovable's file also defines character "guides" and a flying Sokar; its map never draws
 * them, so they are not carried over.
 */
export const mapImage = '/land/map/masterplan.webp';
export const mapImageSmall = '/land/map/masterplan-1200.webp';

export type Lang = "ar" | "en";
export type T = { ar: string; en: string };
export type Audience = "kids" | "men" | "women" | "family";
export type IconName =
  | "film" | "gamepad" | "tent" | "heart" | "users" | "tree"
  | "gate" | "store" | "cafe" | "elders" | "events" | "giving" | "mosque";

const t = (ar: string, en: string): T => ({ ar, en });

export type Part = {
  id: string;
  icon: IconName;
  tint: string;
  womenOnly?: boolean;
  title: T;
  tag: T;
  intro: T;
  who: Record<Audience, T[]>;
  /** first image is the cover; the rest show as thumbnails */
  images?: string[];
  /** centre of the block on the canvas */
  center: { x: number; y: number };
  /** label position */
  label: { x: number; y: number };
  /** mosque marker position (a corner of the block) */
  mosque: { x: number; y: number };
};

export type Place = {
  id: string;
  icon: IconName;
  title: T;
  text: T;
  part?: string;
  /** first image is the cover; the rest show as thumbnails */
  images?: string[];
  pin: { x: number; y: number };
};

export const audiences: Record<Audience, { label: T; color: string }> = {
  kids: { label: t("للأطفال", "For children"), color: "#F5C518" },
  men: { label: t("للرجال", "For men"), color: "#7FB2E5" },
  women: { label: t("للنساء", "For women"), color: "#E7A9BD" },
  family: { label: t("للأسرة معاً", "For the family together"), color: "#9BCB8F" },
};
export const audienceOrder: Audience[] = ["kids", "men", "women", "family"];

export const parts: Part[] = [
  {
    id: "screening", icon: "film", tint: "#E8C873",
    title: t("دار العرض", "The Screening House"),
    tag: t("أفلام مسلم ليدر ورواياتها", "Moslim Leader films and novels"),
    intro: t(
      "دار عرض لأفلام مسلم ليدر ورواياتها، وقاعات تفاعلية، وشخصيات مسلم ليدر في المكان نفسه — بعروض للأسرة مجتمعة، وأخرى للرجال وللنساء.",
      "A screening house for Moslim Leader films and novels, interactive halls, and the Moslim Leader characters in person — with screenings for the whole family, and others for men and for women.",
    ),
    who: {
      kids: [t("شخصيات مسلم ليدر", "The Moslim Leader characters"), t("القاعات التفاعلية", "The interactive halls")],
      men: [t("عروض خاصة بالرجال", "Screenings for men")],
      women: [t("عروض خاصة بالنساء", "Screenings for women")],
      family: [t("أفلام مسلم ليدر ورواياتها تشاهدها الأسرة معاً", "Moslim Leader films and novels the family watches together")],
    },
    images: ["/land/map/screening.webp"],
    center: { x: 894, y: 110 }, label: { x: 894, y: 175 }, mosque: { x: 1069, y: 150 },
  },
  {
    id: "games", icon: "gamepad", tint: "#8FC3D1",
    title: t("دار الألعاب", "The Games House"),
    tag: t("ألعاب تحترم الهوية", "Games that respect identity"),
    intro: t(
      "ألعاب رقمية وساحات لعب بمفهوم إسلامي، تقوم على الفكر الإسلامي وفلسفته وتحترم هوية الطفل وعقله، ومنها ألعاب «ذاكر» و«رحيمة». لا بيت رعب، ولا لعبة تعرّض حياةً للخطر، ولا ما يُدمن عليه الطفل أو يعزله عن أهله.",
      "Digital games and play yards with an Islamic concept, built on Islamic thought and its philosophy, respecting the child's identity and mind — among them the “Zaker” and “Raheema” games. No house of horror, no game that puts a life at risk, nothing a child gets addicted to or that isolates them from their family.",
    ),
    who: {
      kids: [t("ألعاب «ذاكر» و«رحيمة»", "The “Zaker” and “Raheema” games"), t("ساحات اللعب", "The play yards")],
      men: [t("ألعاب خاصة بالرجال", "Games for men")],
      women: [t("ألعاب خاصة بالنساء", "Games for women")],
      family: [t("ألعاب تجتمع عليها الأسرة", "Games the family gathers around")],
    },
    images: ["/land/map/games-zaker.webp", "/land/map/games-rahima.webp", "/land/map/stories-experiences.webp"],
    center: { x: 312, y: 110 }, label: { x: 312, y: 185 }, mosque: { x: 140, y: 150 },
  },
  {
    id: "scouts", icon: "tent", tint: "#B9C79A",
    title: t("الكشافة", "The Scouts"),
    tag: t("شخصية قوية، وغدٌ أفضل", "Strong character, a better tomorrow"),
    intro: t(
      "ميدان الأولاد: تسلّق وحبال وعُقد وتخييم بإشراف قادة، تُصنع فيه الشجاعة والانضباط وروح الفريق. وفيه ركن العطاء، يتعلّم فيه الولد أن القائد يخدم الناس.",
      "The boys' field: climbing, ropes, knots and camping under the supervision of leaders, where courage, discipline and team spirit are built. It holds the Giving Corner, where a boy learns that a leader serves people.",
    ),
    who: {
      kids: [t("الكشافة للأولاد بإشراف قادة", "Scouting for boys, supervised by leaders"), t("ركن العطاء", "The Giving Corner")],
      men: [t("الحلّاق", "The barber")],
      women: [t("أنشطة خاصة بالنساء", "Activities for women")],
      family: [t("أيام تطوّع تجمع الأسرة", "Volunteering days that bring the family together")],
    },
    images: ["/land/map/scouts.webp", "/land/map/climbing.webp", "/land/map/barber.webp"],
    center: { x: 190, y: 320 }, label: { x: 190, y: 420 }, mosque: { x: 88, y: 360 },
  },
  {
    id: "club", icon: "heart", tint: "#E7A9BD", womenOnly: true,
    title: t("نادي البنات والسيدات", "The Girls' & Women's Club"),
    tag: t("صحة وخصوصية ومجتمع", "Health, privacy and community"),
    intro: t(
      "مساحة للبنات والسيدات تُصان فيها الخصوصية صوناً كاملاً: رياضة وعافية، وركن «حكاية تصنع أثراً» مع رحيمة، ولقاءات للتعلّم والدعم.",
      "A space for girls and women where privacy is fully safeguarded: sport and wellbeing, the “A Story That Leaves a Mark” corner with Raheema, and gatherings for learning and support.",
    ),
    who: {
      kids: [t("ركن «حكاية تصنع أثراً»", "The “A Story That Leaves a Mark” corner"), t("رياضة البنات", "Sport for girls")],
      men: [],
      women: [t("رياضة وعافية بخصوصية", "Sport and wellbeing in privacy"), t("لقاءات التعلّم والدعم", "Learning and support gatherings")],
      family: [t("الأم وابنتها معاً", "Mother and daughter together")],
    },
    images: ["/land/map/club-wellbeing.webp", "/land/map/stories.webp"],
    center: { x: 1000, y: 310 }, label: { x: 960, y: 395 }, mosque: { x: 1100, y: 378 },
  },
  {
    id: "forum", icon: "users", tint: "#B7A9DA",
    title: t("الملتقى الثقافي والفكري", "The Cultural & Intellectual Forum"),
    tag: t("نبني أسرة واعية", "Building an aware family"),
    intro: t(
      "ملتقى للأسرة ودعمها: محاضرات ومجالس فكرية، وورش يتعلّم فيها الآباء والأبناء معاً، ومركز للفتوى وللإصلاح في الخلافات الزوجية، ومركز أسرة متكامل للاستشارات التربوية والنفسية بالتعاون مع منصة كليم، وتأهيل للمقبلين على الزواج.",
      "A forum for the family and its support: lectures and intellectual circles, workshops where parents and children learn together, a centre for fatwa and for reconciliation in marital disputes, an integrated family centre for parenting and psychological counselling in partnership with the Kaleem platform, and preparation for those about to marry.",
    ),
    who: {
      kids: [t("ورش القيم للأبناء", "Values workshops for children")],
      men: [t("ملتقى الآباء", "The fathers' forum")],
      women: [t("ملتقى الأمهات", "The mothers' forum")],
      family: [
        t("ورش الآباء والأبناء", "Parent and child workshops"),
        t("الفتوى والإصلاح الأسري", "Fatwa and family reconciliation"),
        t("تأهيل المقبلين على الزواج", "Preparation for those about to marry"),
      ],
    },
    images: ["/land/map/forum-campus.webp", "/land/map/forum-father-son.webp"],
    center: { x: 940, y: 480 }, label: { x: 930, y: 560 }, mosque: { x: 1080, y: 560 },
  },
  {
    id: "garden", icon: "tree", tint: "#9BCB8F",
    title: t("الحديقة الكبرى", "The Great Garden"),
    tag: t("قلب المكان", "The heart of the place"),
    intro: t(
      "حديقة واسعة في قلب المكان بأماكن جلسات مختلفة، للعائلات وللسيدات وللرجال، يلعب فيها الصغار على مرأى من أهلهم. وفيها مجلس لكبار السن يحكي فيه الأجداد لأحفادهم، وقاعة لمناسبات الأسرة: العقيقة، وختم القرآن، وتخرّج حلقات التحفيظ. ومن حولها مقهى العائلة ومتجر مسلم ليدر.",
      "A wide garden at the heart of the place with different seating areas — for families, for women and for men — where little ones play within sight of their parents. It holds an elders' majlis where grandparents tell stories to their grandchildren, and a hall for family occasions: the aqeeqah, completing the Quran, and Quran-circle graduations. Around it sit the Family Café and the Moslim Leader Store.",
    ),
    who: {
      kids: [t("مساحات لعب في الحديقة", "Play spaces in the garden")],
      men: [t("جلسات الرجال", "Men's seating"), t("مجلس كبار السن", "The elders' majlis")],
      women: [t("جلسات خاصة بالسيدات", "Seating for women")],
      family: [
        t("جلسات عائلية", "Family seating"),
        t("قاعة المناسبات", "The occasions hall"),
        t("مقهى العائلة والمتجر", "The Family Café and the Store"),
      ],
    },
    images: ["/land/map/garden-golden-hour.webp"],
    center: { x: 594, y: 250 }, label: { x: 594, y: 300 }, mosque: { x: 594, y: 55 },
  },
];

const mosqueText = t(
  "في كل ركن من أرض القائد مسجد، فلا يبعد أحد عن الصلاة، وللنساء مصلاهن.",
  "Every part of the Leader's Land has a mosque, so no one is ever far from prayer, and women have their own prayer hall.",
);

export const places: Place[] = [
  {
    id: "gate", icon: "gate", title: t("البوابة", "The Gate"),
    text: t("من هنا تبدأ الرحلة: يتسلّم الطفل «جواز القائد»، ويُختم في كل ركن يمرّ به.", "The journey begins here: each child receives the “Leader's Passport”, stamped in every part they pass through."),
    images: ["/land/map/gate-passport.webp"], pin: { x: 588, y: 640 },
  },
  {
    id: "store", icon: "store", title: t("متجر مسلم ليدر", "The Moslim Leader Store"),
    text: t("كتب مسلم ليدر وألعابها وملابسها وحقائبها في مكان واحد — «خذ الحكاية معك».", "Moslim Leader books, toys, clothing and bags in one place — “Take the story with you”."),
    images: ["/land/map/store.webp"], pin: { x: 500, y: 470 },
  },
  {
    id: "cafe", icon: "cafe", title: t("مقهى العائلة", "The Family Café"),
    text: t("مجلس الأسرة بين نشاط وآخر.", "The family's majlis between one activity and the next."),
    part: "garden", images: ["/land/map/cafe.webp"], pin: { x: 690, y: 470 },
  },
  {
    id: "elders", icon: "elders", title: t("مجلس كبار السن", "The Elders' Majlis"),
    text: t("في الحديقة الكبرى، يجتمع فيه الأجداد ويحكون لأحفادهم — فتأتي الأسرة بأجيالها الثلاثة.", "In the Great Garden, grandparents gather and tell stories to their grandchildren — so the family comes with all three generations."),
    part: "garden", pin: { x: 519, y: 200 },
  },
  {
    id: "events", icon: "events", title: t("قاعة المناسبات", "The Occasions Hall"),
    text: t("لمناسبات الأسرة: العقيقة، وختم القرآن، وتخرّج حلقات التحفيظ.", "For family occasions: the aqeeqah, completing the Quran, and Quran-circle graduations."),
    part: "garden", pin: { x: 684, y: 280 },
  },
  {
    id: "giving", icon: "giving", title: t("ركن العطاء", "The Giving Corner"),
    text: t("يجهّز فيه الأبناء سلال الخير ويزرعون للحي، فيتعلّمون أن القائد يخدم الناس.", "Here children prepare baskets of goodness and plant for the neighbourhood, learning that a leader serves people."),
    part: "scouts", pin: { x: 300, y: 390 },
  },
  ...parts.map((p) => ({
    id: `mosque-${p.id}`, icon: "mosque" as IconName,
    title: t(`مسجد ${p.title.ar}`, `Mosque of ${p.title.en}`),
    text: mosqueText, part: p.id, pin: p.mosque,
  })),
];

export const ui = {
  heading: t("أرض القائد المسلم", "Moslim Leader Land"),
  subheading: t("نبني أكبر وجهة ترويحية للأسرة المسلمة في العالم", "Building the largest recreational destination for the Muslim family in the world"),
  saying: t("«روّحوا القلوبَ ساعةً بعد ساعة»", "“Refresh the hearts, hour after hour”"),
  hint: t("اضغط على أي ركن أو مكان", "Tap any part or place"),
  conceptLabel: t("مخطط تصوّري · ليس بمقياس رسم · لا موقع محدد", "Concept plan · not to scale · no set location"),
  conceptPhoto: t("تصوّر مبدئي", "Early concept"),
  whoVisits: t("من سيزور؟", "Who's visiting?"),
  all: t("الكل", "Everyone"),
  mosques: t("المساجد", "Mosques"),
  fullMap: t("الخريطة كاملة", "Full map"),
  hasMosque: t("فيه مسجد", "Has a mosque"),
  partsTitle: t("أركان أرض القائد", "Parts of the Leader's Land"),
  partsLine: t("في كل ركن ما يخص الأطفال، وما يخص الرجال، وما يخص النساء، وما تعيشه الأسرة معاً.", "Every part has something for children, something for men, something for women, and something the family lives together."),
  womenOnlyNote: t("خاص بالبنات والسيدات", "For girls and women only"),
  close: t("إغلاق", "Close"),
  langToggle: t("English", "العربية"),
  partOf: t("ضمن", "Part of"),
};

export const ui2 = {
  tour: t("جولة تلقائية", "Auto tour"),
  stopTour: t("إيقاف الجولة", "Stop tour"),
  sound: t("الصوت", "Sound"),
  enter: t("ادخل الركن", "Enter"),
  guideOf: t("دليلك هنا", "Your guide here"),
};
