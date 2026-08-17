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

// Number of ayahs in each surah (index 0 = surah 1)
export const SURAH_VERSE_COUNTS: number[] = [
  7,286,200,176,120,165,206,75,129,109,
  123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,
  34,30,73,54,45,83,182,88,75,85,
  54,53,89,59,37,35,38,29,18,45,
  60,49,62,55,78,96,29,22,24,13,
  14,11,11,18,12,12,30,52,52,44,
  28,28,20,56,40,31,50,40,46,42,
  29,19,36,25,22,17,19,26,30,20,
  15,21,11,8,8,19,5,8,8,11,
  11,8,3,9,5,4,7,3,6,3,
  5,4,5,6,
];

// Revelation place: 'م' = مكية, 'د' = مدنية (index 0 = surah 1)
export const SURAH_REVELATION_TYPES: ('م'|'د')[] = [
  'م','د','د','د','د','م','م','د','د','م',
  'م','م','م','م','م','م','م','م','م','م',
  'م','د','م','د','م','م','م','م','م','م',
  'م','م','د','م','م','م','م','م','م','م',
  'م','م','م','م','م','م','د','د','د','م',
  'م','م','م','م','م','م','د','د','د','د',
  'د','د','د','د','د','د','م','م','م','م',
  'م','م','م','م','م','د','م','م','م','م',
  'م','م','م','م','م','م','م','م','م','م',
  'م','م','م','م','م','م','م','م','م','م',
  'م','م','م','م','م','م','م','م','م','د',
  'م','م','م','م',
];

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
