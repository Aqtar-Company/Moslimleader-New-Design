'use client';

import { useLang } from '@/context/LanguageContext';

const PLAYLIST_ID = 'PL24Wl0s0dv_SoE3N5BMM9XxZKazu_v8l9';
const CHANNEL_URL = 'https://www.youtube.com/@moslimleader7687';

export default function MediaPage() {
  const { lang } = useLang();
  const isRtl = lang === 'ar';

  const txt = {
    title:    isRtl ? 'أناشيد وميديا مسلم ليدر' : 'Muslim Leader Media & Nasheeds',
    subtitle: isRtl ? 'ومضات تربوية من قناة مسلم ليدر' : 'Educational flashes from Muslim Leader',
    channel:  isRtl ? 'قناة مسلم ليدر على YouTube' : 'Muslim Leader YouTube Channel',
  };

  return (
    <>
      {/* Banner */}
      <div className="bg-[#F5C518] py-12 text-center px-4">
        <h1 className="text-3xl md:text-5xl font-black text-gray-900">{txt.title}</h1>
        <p className="text-gray-700 mt-2 text-lg">{txt.subtitle}</p>
        <a
          href={CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-5 bg-gray-900 hover:bg-gray-800 text-white font-bold px-6 py-3 rounded-xl transition shadow-md text-sm"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
          </svg>
          {txt.channel}
        </a>
      </div>

      {/* Playlist Embed */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="rounded-2xl overflow-hidden shadow-lg aspect-video">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/videoseries?list=${PLAYLIST_ID}&hl=${lang}`}
            title={txt.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </>
  );
}
