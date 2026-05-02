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
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a]">
      {/* Hero placeholder */}
      <div className="h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-[#F5C518]/20 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
          </div>

          <p
            className={`text-xl sm:text-2xl font-black text-white leading-relaxed transition-all duration-1000 ${
              line >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            اختياراتك اليوم .. تبنيه غدًا
          </p>

          <p
            className={`text-lg sm:text-xl font-bold text-[#F5C518] mt-4 leading-relaxed transition-all duration-1000 ${
              line >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            فاختر ما يبنيه لا ما يُلهيه
          </p>
        </div>
      </div>

      {/* Product skeleton grid */}
      <div className="max-w-6xl mx-auto px-4 pb-16 -mt-20">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/5 backdrop-blur rounded-2xl overflow-hidden border border-white/10"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="aspect-square bg-white/5 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-white/10 rounded-lg w-3/4 animate-pulse" />
                <div className="h-3 bg-white/5 rounded-lg w-1/2 animate-pulse" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-5 bg-white/10 rounded-lg w-16 animate-pulse" />
                  <div className="h-8 bg-[#F5C518]/20 rounded-xl w-20 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
