// Server-side content filter for Tareeq posts and comments.
// Flagged content is auto-hidden pending moderator review.

const BAD_WORDS_AR = [
  // Profanity / insults
  'كلب', 'كلاب', 'حمار', 'حمير', 'خنزير', 'خنازير', 'قرد', 'قردة',
  'شرموط', 'شراميط', 'عاهرة', 'عاهرات', 'زانية', 'زواني',
  'منيوك', 'أير', 'طيز', 'كس', 'زب', 'تيظ', 'لعبة', 'لعنة',
  'احا', 'اتنيك', 'يلعن', 'ملعون', 'لعين', 'ابن وسخة', 'ابن متناكة',
  'بن كلب', 'ابن زنا', 'ولد الحرام', 'ابن حرام', 'حيوان', 'وسخ', 'قذر',
  'خنثى', 'مخنث', 'شاذ', 'متخلف', 'معتوه', 'أبله', 'غبي',
  // Hate / discrimination
  'يهود قتلة', 'اقتل المسلم', 'اقتلوا العرب', 'اقتلوا المسيحيين',
  // Explicit
  'سكس', 'نيك', 'متناك', 'تناكت', 'اتناك', 'اتنيكي', 'بزاز', 'طيزي',
  'شهوة جنسية', 'إباحي', 'إباحية', 'أفلام جنسية',
];

const BAD_WORDS_EN = [
  'fuck', 'fucker', 'fucking', 'fucked', 'fucks',
  'shit', 'shits', 'bullshit',
  'bitch', 'bitches', 'bastard',
  'asshole', 'ass', 'arse',
  'dick', 'cock', 'pussy', 'cunt',
  'whore', 'slut', 'nigger', 'nigga',
  'faggot', 'fag', 'retard',
  'porn', 'porno', 'xxx',
  'kill yourself', 'kys', 'suicide',
];

// Compile fast lookup: normalise Arabic diacritics for fuzzy match
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // strip Arabic diacritics
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

const AR_SET  = new Set(BAD_WORDS_AR.map(normalise));
const EN_TERMS = BAD_WORDS_EN.map(w => w.toLowerCase());

export interface FilterResult {
  flagged: boolean;
  reason: string | null;
}

export function filterContent(text: string): FilterResult {
  if (!text || typeof text !== 'string') return { flagged: false, reason: null };

  const norm = normalise(text);

  // Arabic: word-boundary check on normalised text
  for (const word of AR_SET) {
    // Use space delimiters + start/end anchors for Arabic
    const re = new RegExp(`(^|[\\s،,\\.!؟?])${escapeRe(word)}([\\s،,\\.!؟?]|$)`, 'u');
    if (re.test(norm)) {
      return { flagged: true, reason: `محتوى غير لائق (${word})` };
    }
  }

  // English: word-boundary check
  const lower = text.toLowerCase();
  for (const term of EN_TERMS) {
    const re = new RegExp(`\\b${escapeRe(term)}\\b`, 'i');
    if (re.test(lower)) {
      return { flagged: true, reason: `inappropriate content (${term})` };
    }
  }

  return { flagged: false, reason: null };
}

// Validate that a URL belongs to an allowed media domain
const ALLOWED_IMAGE_HOSTS = [
  'moslimleader.com',
  'res.cloudinary.com',
  'images.unsplash.com',
  'i.ibb.co',
  'imgbb.com',
  'i.imgur.com',
  'i.postimg.cc',
];

const ALLOWED_VIDEO_HOSTS = [
  'moslimleader.com',
  'www.youtube.com',
  'youtu.be',
  'vimeo.com',
  'res.cloudinary.com',
];

export function validateMediaUrl(url: string | null, type: 'image' | 'video'): boolean {
  if (!url) return true;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    // Allow own R2 storage bucket domain
    const r2Url = process.env.R2_PUBLIC_URL;
    if (r2Url) {
      try {
        const r2Host = new URL(r2Url).hostname.replace(/^www\./, '');
        if (host === r2Host || host.endsWith('.' + r2Host)) return true;
      } catch { /* invalid R2_PUBLIC_URL, ignore */ }
    }
    const allowed = type === 'image' ? ALLOWED_IMAGE_HOSTS : ALLOWED_VIDEO_HOSTS;
    return allowed.some(h => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
