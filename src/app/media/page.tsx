'use client';

import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';

const CHANNEL_URL = 'https://www.youtube.com/@moslimleader7687';

const VIDEOS = [
  { id: '9kSSCSAg2us' },
  { id: 'joO3J8S1qkc' },
  { id: 'oa_RUjlWo6Y' },
  { id: 'HNpsuHbxyck' },
  { id: 'Vt2gb9bb6Rk' },
  { id: '4Z7asM6e9IM' },
];

export default function MediaPage() {
  const { lang } = useLang();
  const isRtl = lang === 'ar';
  const [playingId, setPlayingId] = useState<string | null>(null);

  const txt = {
    title:   isRtl ? 'أناشيد وميديا مسلم ليدر' : 'Muslim Leader Media & Nasheeds',
    subtitle: isRtl ? 'ومضات تربوية من قناة مسلم ليدر' : 'Educational flashes from Muslim Leader',
    channel: isRtl ? 'قناة مسلم ليدر على YouTube' : 'Muslim Leader YouTube Channel',
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

      {/* Video Grid */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {VIDEOS.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="relative aspect-video bg-gray-900">
                {playingId === v.id ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${v.id}?autoplay=1`}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : (
                  <button
                    onClick={() => setPlayingId(v.id)}
                    className="absolute inset-0 w-full h-full group"
                  >
                    <img
                      src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`}
                      alt="video thumbnail"
                      className="w-full h-full object-cover opacity-90"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 bg-[#F5C518] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                        <svg className="w-6 h-6 text-gray-900 ms-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
