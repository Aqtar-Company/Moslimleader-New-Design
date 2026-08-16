'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import TareeqCard from '@/components/tareeq/TareeqCard';
import type { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import { useState } from 'react';

interface PostWithUseful extends TareeqPostSummary {
  isUseful: boolean;
}

interface Props {
  catKey: string;
  catAr: string;
  catEn: string;
  icon: string;
  accent: string;
  posts: PostWithUseful[];
}

export default function CategoryPageClient({ catKey, catAr, catEn, icon, accent, posts }: Props) {
  const { lang, isRtl } = useLang();
  const isEn = lang === 'en';
  const catLabel = isEn ? catEn : catAr;
  const [searchInput, setSearchInput] = useState('');

  return (
    <div className="min-h-screen">
      <TareeqHeader
        onCreateClick={() => {}}
        searchInput={searchInput}
        onSearch={setSearchInput}
        onToggleSidebar={() => {}}
      />

      <div className="pt-14 lg:max-w-[900px] lg:mx-auto lg:px-4">

        {/* Category header */}
        <div
          className="px-4 py-8 lg:py-10 flex flex-col items-center text-center gap-3"
          style={{ borderBottom: `1px solid ${accent}30` }}
        >
          {/* Back link */}
          <Link
            href="/tareeq"
            className="self-start flex items-center gap-1.5 text-xs font-semibold mb-2 transition"
            style={{ color: 'var(--tr-text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = accent}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-muted)'}
          >
            <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
            </svg>
            {isEn ? 'Tareeq' : 'طريق'}
          </Link>

          {/* Icon circle */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{
              background: `${accent}18`,
              border: `2px solid ${accent}40`,
              boxShadow: `0 0 32px ${accent}28`,
            }}
          >
            {icon}
          </div>

          {/* Category name */}
          <h1 className="text-3xl font-black" style={{ color: 'var(--tr-text-primary)' }}>
            {catLabel}
          </h1>

          {/* Subtitle */}
          <p className="text-sm font-medium" style={{ color: 'var(--tr-text-muted)' }}>
            {isEn ? 'Best marks in this category' : 'أفضل علامات هذا التصنيف'}
          </p>

          {/* Post count pill */}
          {posts.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold"
              style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}30` }}
            >
              <svg width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              {posts.length} {isEn ? 'marks' : 'علامة'}
            </div>
          )}
        </div>

        {/* Legend for مفيد badge */}
        {posts.some(p => p.isUseful) && (
          <div
            className="mx-4 mt-4 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
            style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.20)', color: 'var(--tr-text-muted)' }}
          >
            <span className="font-black text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>مفيد ★</span>
            <span>{isEn ? 'Posts saved by 3+ readers' : 'علامات حفظها ٣ قراء أو أكثر'}</span>
          </div>
        )}

        {/* Posts feed */}
        <div className="px-4 py-6 flex flex-col gap-4">
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: `${accent}14`, border: `2px solid ${accent}30` }}
              >
                {icon}
              </div>
              <p className="font-semibold mb-2" style={{ color: 'var(--tr-text-secondary)' }}>
                {isEn ? 'No marks yet in this category' : 'لا توجد علامات في هذا التصنيف بعد'}
              </p>
              <p className="text-sm mb-6" style={{ color: 'var(--tr-text-muted)' }}>
                {isEn ? 'Be the first to leave a mark!' : 'كن أول من يترك علامة!'}
              </p>
              <Link
                href="/tareeq"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition"
                style={{ background: accent }}
              >
                {isEn ? '← Back to Tareeq' : '← العودة إلى طريق'}
              </Link>
            </div>
          ) : (
            posts.map(post => (
              <div key={post.id} className="relative">
                {post.isUseful && (
                  <div
                    className="absolute top-3 end-3 z-10 text-[10px] font-black px-2 py-0.5 rounded-full pointer-events-none"
                    style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}
                  >
                    مفيد ★
                  </div>
                )}
                <TareeqCard post={post} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
