'use client';

import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';

type Tab = 'videos' | 'audio' | 'podcasts';

// ── Placeholder data – replace with real content ──────────────────────────
const videos = [
  {
    id: 'v1',
    titleAr: 'كيف تربي طفلك على القيادة؟',
    titleEn: 'How to Raise a Leader Child?',
    descAr: 'حلقة تربوية تتحدث عن أساليب عملية لتنمية روح القيادة عند الأطفال',
    descEn: 'An educational episode about practical methods to develop leadership qualities in children',
    youtubeId: 'dQw4w9WgXcQ', // replace with real YouTube ID
    duration: '18:45',
  },
  {
    id: 'v2',
    titleAr: 'القرآن والطفل — كيف تبدأ؟',
    titleEn: 'Quran & Children — Where to Begin?',
    descAr: 'نصائح عملية للآباء لمساعدة أطفالهم على حفظ وتدبر القرآن الكريم',
    descEn: 'Practical tips for parents to help children memorize and reflect on the Holy Quran',
    youtubeId: 'dQw4w9WgXcQ',
    duration: '22:10',
  },
  {
    id: 'v3',
    titleAr: 'وسام القائد — كيف تستخدمه مع أطفالك؟',
    titleEn: 'Leader Medal — How to Use It with Your Kids?',
    descAr: 'شرح مفصل لطريقة استخدام منتج وسام القائد لتحفيز الأطفال',
    descEn: "A detailed guide on how to use the Leader Medal product to motivate children",
    youtubeId: 'dQw4w9WgXcQ',
    duration: '10:30',
  },
  {
    id: 'v4',
    titleAr: 'بناء شخصية الطفل المسلم',
    titleEn: 'Building the Muslim Child\'s Character',
    descAr: 'كيف نبني شخصية متوازنة للطفل المسلم في زمن التحديات',
    descEn: 'How to build a balanced personality for the Muslim child in challenging times',
    youtubeId: 'dQw4w9WgXcQ',
    duration: '31:05',
  },
];

const podcasts = [
  {
    id: 'p1',
    titleAr: 'بودكاست مسلم ليدر — الحلقة ١: البداية',
    titleEn: 'Muslim Leader Podcast — Ep. 1: The Beginning',
    descAr: 'نتحدث عن رحلة تأسيس مسلم ليدر والهدف من ورائها',
    descEn: 'We talk about the journey of founding Muslim Leader and the vision behind it',
    duration: '45:00',
    date: '2024-01-10',
    spotifyUrl: '#',
  },
  {
    id: 'p2',
    titleAr: 'بودكاست مسلم ليدر — الحلقة ٢: أسرار التربية',
    titleEn: 'Muslim Leader Podcast — Ep. 2: Secrets of Upbringing',
    descAr: 'مع ضيف متميز نتحدث عن أسرار التربية الناجحة وأهم مبادئها',
    descEn: 'With a special guest, we discuss the secrets of successful upbringing and its key principles',
    duration: '52:30',
    date: '2024-02-05',
    spotifyUrl: '#',
  },
  {
    id: 'p3',
    titleAr: 'بودكاست مسلم ليدر — الحلقة ٣: القرآن والأسرة',
    titleEn: 'Muslim Leader Podcast — Ep. 3: Quran & Family',
    descAr: 'كيف تجعل القرآن الكريم محور حياة أسرتك',
    descEn: 'How to make the Holy Quran the center of your family\'s life',
    duration: '38:20',
    date: '2024-03-12',
    spotifyUrl: '#',
  },
];
// ──────────────────────────────────────────────────────────────────────────

export default function MediaPage() {
  const { lang } = useLang();
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState<Tab>('videos');
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const txt = {
    title: isRtl ? 'الوسائط' : 'Media',
    subtitle: isRtl ? 'محتوى تعليمي وتربوي — فيديوهات وبودكاست' : 'Educational content — videos & podcasts',
    videos: isRtl ? 'فيديوهات' : 'Videos',
    podcasts: isRtl ? 'بودكاست' : 'Podcasts',
    watch: isRtl ? 'مشاهدة' : 'Watch',
    listen: isRtl ? 'استماع' : 'Listen',
    duration: isRtl ? 'المدة' : 'Duration',
    onSpotify: isRtl ? 'استمع على Spotify' : 'Listen on Spotify',
    onYoutube: isRtl ? 'شاهد على YouTube' : 'Watch on YouTube',
    comingSoon: isRtl ? 'قريباً — المزيد من المحتوى' : 'Coming Soon — More Content',
  };

  return (
    <>
      {/* Banner */}
      <div className="bg-[#F5C518] py-12 text-center">
        <h1 className="text-3xl md:text-5xl font-black text-gray-900">{txt.title}</h1>
        <p className="text-gray-700 mt-2 text-lg">{txt.subtitle}</p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 max-w-sm mx-auto mb-10">
          {(['videos', 'podcasts'] as Tab[]).map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {tab === 'videos' ? txt.videos : txt.podcasts}
            </button>
          ))}
        </div>

        {/* Videos */}
        {activeTab === 'videos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {videos.map(video => (
              <div key={video.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition">
                {/* Thumbnail / Player */}
                <div className="relative aspect-video bg-gray-900">
                  {playingVideo === video.id ? (
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      <img
                        src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                        alt={isRtl ? video.titleAr : video.titleEn}
                        className="w-full h-full object-cover opacity-80"
                      />
                      <button
                        onClick={() => setPlayingVideo(video.id)}
                        className="absolute inset-0 flex items-center justify-center group"
                      >
                        <div className="w-16 h-16 bg-[#F5C518] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                          <svg className="w-7 h-7 text-gray-900 ms-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </button>
                      <div className="absolute bottom-2 end-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-mono">
                        {video.duration}
                      </div>
                    </>
                  )}
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 className="font-black text-gray-900 text-lg mb-2 leading-snug">
                    {isRtl ? video.titleAr : video.titleEn}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4">
                    {isRtl ? video.descAr : video.descEn}
                  </p>
                  <a
                    href={`https://youtube.com/watch?v=${video.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 transition"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                    </svg>
                    {txt.onYoutube}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Podcasts */}
        {activeTab === 'podcasts' && (
          <div className="flex flex-col gap-4 max-w-3xl mx-auto">
            {podcasts.map((ep, i) => (
              <div key={ep.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-4 items-center hover:shadow-md transition">
                {/* Ep number */}
                <div className="w-12 h-12 rounded-2xl bg-[#F5C518] flex items-center justify-center font-black text-gray-900 text-lg shrink-0">
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-gray-900 text-base leading-snug mb-1">
                    {isRtl ? ep.titleAr : ep.titleEn}
                  </h3>
                  <p className="text-gray-500 text-sm truncate">
                    {isRtl ? ep.descAr : ep.descEn}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">{txt.duration}: {ep.duration}</p>
                </div>

                {/* Play */}
                <a
                  href={ep.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shrink-0 transition"
                  title={txt.onSpotify}
                >
                  <svg className="w-5 h-5 ms-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </a>
              </div>
            ))}

            {/* Coming soon */}
            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="text-3xl mb-2">🎙️</p>
              <p className="font-bold text-gray-500">{txt.comingSoon}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
