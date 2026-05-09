'use client';

import { useState, useEffect } from 'react';

export default function HomeLoading() {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setLine(1), 400);
    const t2 = setTimeout(() => setLine(2), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <>
      {/* Hero — static version while products load */}
      <section className="relative w-full h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/family-hero.webp)', zIndex: 1 }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/75" style={{ zIndex: 2 }} />
        <div className="absolute inset-x-0 bottom-24 flex flex-col items-center text-center px-6" style={{ zIndex: 3 }}>
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white drop-shadow-lg leading-tight">
            معاً نبني قادة الغد
          </h1>
          <p className="text-white/80 mt-3 text-base sm:text-lg md:text-xl max-w-xl drop-shadow">
            منتجات تربوية وتعليمية للأطفال والأسرة
          </p>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce" style={{ zIndex: 3 }}>
          <span className="text-white/60 text-xs tracking-widest uppercase">scroll</span>
          <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* Motivational message + product skeleton */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <p
            className={`text-xl sm:text-2xl font-black text-[#1a1a2e] leading-relaxed transition-all duration-1000 ${
              line >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            اختياراتك اليوم .. تبنيه غدًا
          </p>
          <p
            className={`text-lg sm:text-xl font-bold text-[#b8860b] mt-3 leading-relaxed transition-all duration-1000 ${
              line >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            فاختر ما يبنيه لا ما يُلهيه
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="aspect-square bg-gray-200 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded-lg w-3/4 animate-pulse" />
                <div className="h-3 bg-gray-100 rounded-lg w-1/2 animate-pulse" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-5 bg-gray-200 rounded-lg w-16 animate-pulse" />
                  <div className="h-8 bg-purple-100 rounded-xl w-20 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
