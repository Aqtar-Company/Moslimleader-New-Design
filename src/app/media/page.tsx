'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/context/LanguageContext';

const PLAYLIST_ID = 'PL24Wl0s0dv_SoE3N5BMM9XxZKazu_v8l9';
const CHANNEL_URL = 'https://www.youtube.com/@moslimleader7687';

interface YTVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}

export default function MediaPage() {
  const { lang } = useLang();
  const isRtl = lang === 'ar';

  const [videos, setVideos] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      setError('NO_KEY');
      return;
    }

    setLoading(true);
    setError(null);

    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems` +
      `?part=snippet&playlistId=${PLAYLIST_ID}&maxResults=50&key=${apiKey}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error.message);
        const items: YTVideo[] = (data.items ?? [])
          .filter((item: any) => item.snippet?.resourceId?.videoId)
          .map((item: any) => ({
            videoId: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            description: item.snippet.description ?? '',
            thumbnail:
              item.snippet.thumbnails?.high?.url ??
              item.snippet.thumbnails?.medium?.url ??
              `https://img.youtube.com/vi/${item.snippet.resourceId.videoId}/hqdefault.jpg`,
            publishedAt: item.snippet.publishedAt ?? '',
          }));
        setVideos(items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const txt = {
    title:    isRtl ? 'أناشيد وميديا مسلم ليدر' : 'Muslim Leader Media & Nasheeds',
    subtitle: isRtl ? 'ومضات تربوية من قناة مسلم ليدر' : 'Educational flashes from Muslim Leader',
    watchOn:  isRtl ? 'شاهد على YouTube' : 'Watch on YouTube',
    channel:  isRtl ? 'قناة مسلم ليدر على YouTube' : 'Muslim Leader YouTube Channel',
    loading:  isRtl ? 'جاري التحميل…' : 'Loading…',
    noKey:    isRtl
      ? 'يرجى إضافة NEXT_PUBLIC_YOUTUBE_API_KEY في ملف .env.local'
      : 'Please add NEXT_PUBLIC_YOUTUBE_API_KEY to .env.local',
    noVideos: isRtl ? 'لا توجد فيديوهات حالياً' : 'No videos found',
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

      <div className="max-w-6xl mx-auto px-4 py-10" dir={isRtl ? 'rtl' : 'ltr'}>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-red-600 font-semibold">
              {error === 'NO_KEY' ? txt.noKey : error}
            </p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && videos.length === 0 && (
          <div className="text-center py-16 text-gray-400 font-semibold">{txt.noVideos}</div>
        )}

        {/* Video Grid */}
        {videos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {videos.map((v) => (
              <div
                key={v.videoId}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition"
              >
                {/* Thumbnail / Player */}
                <div className="relative aspect-video bg-gray-900">
                  {playingId === v.videoId ? (
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${v.videoId}?autoplay=1`}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      <img
                        src={v.thumbnail}
                        alt={v.title}
                        className="w-full h-full object-cover opacity-90"
                      />
                      <button
                        onClick={() => setPlayingId(v.videoId)}
                        className="absolute inset-0 flex items-center justify-center group"
                      >
                        <div className="w-14 h-14 bg-[#F5C518] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                          <svg className="w-6 h-6 text-gray-900 ms-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </button>
                    </>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-black text-gray-900 text-base leading-snug mb-1 line-clamp-2">
                    {v.title}
                  </h3>
                  {v.description && (
                    <p className="text-gray-500 text-sm leading-relaxed mb-3 line-clamp-2">
                      {v.description}
                    </p>
                  )}
                  <a
                    href={`https://www.youtube.com/watch?v=${v.videoId}&list=${PLAYLIST_ID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 transition"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                    </svg>
                    {txt.watchOn}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
