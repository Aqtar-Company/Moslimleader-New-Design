export const SURAH_NAMES_AR = [
  'الفاتحة','البقرة','آل عمران','النساء','المائدة',
  'الأنعام','الأعراف','الأنفال','التوبة','يونس',
  'هود','يوسف','الرعد','إبراهيم','الحجر',
  'النحل','الإسراء','الكهف','مريم','طه',
  'الأنبياء','الحج','المؤمنون','النور','الفرقان',
  'الشعراء','النمل','القصص','العنكبوت','الروم',
  'لقمان','السجدة','الأحزاب','سبأ','فاطر',
  'يس','الصافات','ص','الزمر','غافر',
  'فصلت','الشورى','الزخرف','الدخان','الجاثية',
  'الأحقاف','محمد','الفتح','الحجرات','ق',
  'الذاريات','الطور','النجم','القمر','الرحمن',
  'الواقعة','الحديد','المجادلة','الحشر','الممتحنة',
  'الصف','الجمعة','المنافقون','التغابن','الطلاق',
  'التحريم','الملك','القلم','الحاقة','المعارج',
  'نوح','الجن','المزمل','المدثر','القيامة',
  'الإنسان','المرسلات','النبأ','النازعات','عبس',
  'التكوير','الانفطار','المطففين','الانشقاق','البروج',
  'الطارق','الأعلى','الغاشية','الفجر','البلد',
  'الشمس','الليل','الضحى','الشرح','التين',
  'العلق','القدر','البينة','الزلزلة','العاديات',
  'القارعة','التكاثر','العصر','الهمزة','الفيل',
  'قريش','الماعون','الكوثر','الكافرون','النصر',
  'المسد','الإخلاص','الفلق','الناس',
];

export const SURAH_NAMES_EN = [
  'Al-Fatihah','Al-Baqarah','Ali Imran',"An-Nisa'",'Al-Maidah',
  "Al-An'am","Al-A'raf",'Al-Anfal','At-Tawbah','Yunus',
  'Hud','Yusuf',"Ar-Ra'd",'Ibrahim','Al-Hijr',
  'An-Nahl','Al-Isra','Al-Kahf','Maryam','Ta-Ha',
  "Al-Anbya'",'Al-Hajj',"Al-Mu'minun",'An-Nur','Al-Furqan',
  "Ash-Shu'ara'",'An-Naml','Al-Qasas',"Al-'Ankabut",'Ar-Rum',
  'Luqman','As-Sajdah','Al-Ahzab',"Saba'",'Fatir',
  'Ya-Sin','As-Saffat','Sad','Az-Zumar','Ghafir',
  'Fussilat','Ash-Shura','Az-Zukhruf','Ad-Dukhan','Al-Jathiyah',
  'Al-Ahqaf','Muhammad','Al-Fath','Al-Hujurat','Qaf',
  'Adh-Dhariyat','At-Tur','An-Najm','Al-Qamar','Ar-Rahman',
  "Al-Waqi'ah",'Al-Hadid','Al-Mujadila','Al-Hashr','Al-Mumtahanah',
  'As-Saf','Al-Jumuah','Al-Munafiqun','At-Taghabun','At-Talaq',
  'At-Tahrim','Al-Mulk','Al-Qalam','Al-Haqqah',"Al-Ma'arij",
  'Nuh','Al-Jinn','Al-Muzzammil','Al-Muddaththir','Al-Qiyamah',
  'Al-Insan','Al-Mursalat',"An-Naba'",'An-Naziat',"'Abasa",
  'At-Takwir','Al-Infitar','Al-Mutaffifin','Al-Inshiqaq','Al-Buruj',
  'At-Tariq',"Al-A'la",'Al-Ghashiyah','Al-Fajr','Al-Balad',
  'Ash-Shams','Al-Layl','Ad-Duha','Ash-Sharh','At-Tin',
  "Al-'Alaq",'Al-Qadr','Al-Bayyinah','Az-Zalzalah',"Al-'Adiyat",
  "Al-Qari'ah",'At-Takathur',"Al-'Asr",'Al-Humazah','Al-Fil',
  'Quraysh',"Al-Ma'un",'Al-Kawthar','Al-Kafirun','An-Nasr',
  'Al-Masad','Al-Ikhlas','Al-Falaq','An-Nas',
];

export const TOTAL_QURAN_PAGES = 604;

// First page of each surah in the standard Madinah Mushaf (Hafs)
export const SURAH_FIRST_PAGES: number[] = [
  1,2,50,77,106,128,151,177,187,208,
  221,235,249,255,262,267,282,293,305,312,
  322,332,342,350,359,367,377,385,396,404,
  411,415,418,428,434,440,446,453,458,467,
  477,483,489,496,499,502,507,511,515,518,
  520,523,526,528,531,534,537,542,545,549,
  551,553,554,556,558,560,562,564,566,568,
  570,572,574,575,577,578,580,582,583,585,
  586,587,587,589,590,591,591,592,593,594,
  595,595,596,596,597,597,598,598,599,599,
  600,600,601,601,601,602,602,602,603,603,
  603,604,604,604,
];

export function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
}

export function getAudioUrl(globalAyahId: number): string {
  return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyahId}.mp3`;
}

export interface QuranVerse {
  id: number;
  verse_number: number;
  chapter_id: number;
  page_number: number;
  text_uthmani: string;
}

export async function fetchPageVerses(page: number): Promise<QuranVerse[]> {
  // Proxied through our server to avoid CORS / external-fetch blocking
  const res = await fetch(`/api/tareeq/quran/verses?page=${page}`);
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  return data.verses ?? [];
}
