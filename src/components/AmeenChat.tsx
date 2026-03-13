'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { products as staticProducts } from '@/lib/products';
import { getAddedProducts, getProductOverrides, applyOverride } from '@/lib/admin-storage';
import { useLang } from '@/context/LanguageContext';
import { Product } from '@/types';

/* ── Types ─────────────────────────────────────────────────────────────────── */
type Gender = 'boy' | 'girl' | 'adult';
type AgeRange = 'under5' | '5to8' | '9to12' | '13plus';
type Step = 'welcome' | 'gender' | 'age' | 'thinking' | 'results';

interface Message {
  id: string;
  from: 'ameen' | 'user';
  text: string;
}

/* ── Recommendation logic ───────────────────────────────────────────────────── */
const RECOMMENDATIONS: Record<Gender, Record<string, string[]>> = {
  boy: {
    under5:  ['pray-story', 'my-son-asks-series', 'alwah', 'feast-day-game', 'leader-medal'],
    '5to8':  ['feast-day-game', 'leader-medal', 'puzzle-boys', 'alwah', 'pray-hajj-game', 'righteousness-series'],
    '9to12': ['feast-day-game', 'preparing-leaders', 'masek', 'kids-notebook', 'boys-mug', 'alwah'],
    '13plus':['bukhari-on-mars-book', 'fakih-in-wonderland-book', 'to-my-son-book', 'boys-mug', 'ml-bag', 'kids-notebook'],
  },
  girl: {
    under5:  ['pray-story', 'my-son-asks-series', 'righteousness-series', 'alwah', 'feast-day-game'],
    '5to8':  ['puzzle-girls', 'feast-day-game', 'righteousness-series', 'alwah', 'pray-hajj-game', 'leader-medal'],
    '9to12': ['righteousness-series', 'masek', 'kids-notebook', 'girls-mug', 'puzzle-girls', 'feast-day-game'],
    '13plus':['mothers-of-greats-book', 'bukhari-on-mars-book', 'kids-notebook', 'girls-mug', 'ml-bag', 'masek'],
  },
  adult: {
    under5:  ['palestine-book', 'to-my-son-book', 'mothers-of-greats-book', 'adults-notebook', 'women-mug', 'ml-bag'],
    '5to8':  ['palestine-book', 'to-my-son-book', 'mothers-of-greats-book', 'adults-notebook', 'women-mug', 'ml-bag'],
    '9to12': ['palestine-book', 'to-my-son-book', 'mothers-of-greats-book', 'adults-notebook', 'women-mug', 'ml-bag'],
    '13plus':['palestine-book', 'to-my-son-book', 'mothers-of-greats-book', 'adults-notebook', 'women-mug', 'ml-bag'],
  },
};

function getRecommendations(gender: Gender, age: AgeRange, allProducts: Product[]): Product[] {
  const slugs = RECOMMENDATIONS[gender]?.[age] ?? [];
  const bySlug = Object.fromEntries(allProducts.map(p => [p.slug, p]));
  return slugs.map(s => bySlug[s]).filter(Boolean).filter(p => p.inStock).slice(0, 6);
}

/* ── Amin Avatar ───────────────────────────────────────────────────────────── */
function AminAvatar({ size = 48 }: { size?: number }) {
  return (
    <img
      src="/amin-profile.png"
      alt="أمين"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover' }}
    />
  );
}
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-white rounded-2xl rounded-tr-sm shadow-sm w-fit">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

/* ── Product mini-card ─────────────────────────────────────────────────────── */
function MiniCard({ p, isEn }: { p: Product; isEn: boolean }) {
  return (
    <Link
      href={`/shop/${p.slug}`}
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="aspect-square overflow-hidden bg-gray-50">
        <img
          src={p.images[0]}
          alt={p.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
        />
      </div>
      <div className="p-2.5 flex-1 flex flex-col gap-1">
        <p className="text-xs font-bold text-gray-800 leading-tight line-clamp-2">{isEn && p.nameEn ? p.nameEn : p.name}</p>
        <p className="text-xs font-black text-[#1a1a2e] mt-auto">{p.price.toLocaleString('ar-EG')} ج</p>
      </div>
    </Link>
  );
}

/* ── Main chat component ────────────────────────────────────────────────────── */
export default function AmeenChat() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState<AgeRange | null>(null);
  const [results, setResults] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [showBadge, setShowBadge] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { lang } = useLang();
  const isEn = lang === 'en';

  // Load products from localStorage
  useEffect(() => {
    const overrides = getProductOverrides();
    const added = getAddedProducts();
    const merged = [
      ...staticProducts.map(p => overrides[p.id] ? applyOverride(p, overrides[p.id]) : p),
      ...added,
    ];
    setAllProducts(merged);
  }, []);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, step]);

  // Initialize conversation when opened
  useEffect(() => {
    if (open && messages.length === 0) {
      setShowBadge(false);
      setTimeout(() => {
        addAmeenMessage(isEn ? "Hello 👋 I'm Ameen, your gift guide!" : 'مرحباً 👋 أنا أمين، مساعدك لاختيار أفضل هدية!');
        setTimeout(() => {
          addAmeenMessage(isEn ? 'Who are you looking for? 🎁' : 'لمن تبحث عن هدية؟ 🎁');
          setStep('gender');
        }, 800);
      }, 400);
    }
  }, [open]);

  function addAmeenMessage(text: string) {
    setMessages(prev => [...prev, { id: Date.now().toString(), from: 'ameen', text }]);
  }

  function addUserMessage(text: string) {
    setMessages(prev => [...prev, { id: Date.now().toString() + 'u', from: 'user', text }]);
  }

  function pickGender(g: Gender, label: string) {
    addUserMessage(label);
    setGender(g);
    setStep('age');
    if (g === 'adult') {
      setTimeout(() => addAmeenMessage(isEn ? 'Great 😊 Let me show you our best picks for adults!' : 'ممتاز 😊 سأريك أفضل ما عندنا للكبار!'), 500);
      setTimeout(() => {
        setStep('thinking');
        const recs = getRecommendations(g, '5to8', allProducts);
        setResults(recs);
        setTimeout(() => {
          addAmeenMessage(isEn ? 'Found some great gifts for you! 🌟' : 'لقيتلك هدايا رائعة! 🌟');
          setStep('results');
        }, 1400);
      }, 1200);
    } else {
      setTimeout(() => {
        addAmeenMessage(isEn
          ? `Great 😊 How old is ${g === 'boy' ? 'he' : 'she'}?`
          : 'ممتاز 😊 كم عمر' + (g === 'boy' ? 'ه' : 'ها') + '؟');
        setStep('age');
      }, 500);
    }
  }

  function pickAge(a: AgeRange, label: string) {
    addUserMessage(label);
    setAge(a);
    setStep('thinking');
    setTimeout(() => {
      const recs = getRecommendations(gender!, a, allProducts);
      setResults(recs);
      addAmeenMessage(isEn
        ? `Found perfect gifts for ${gender === 'boy' ? 'him' : gender === 'girl' ? 'her' : 'them'}! 🎁`
        : 'لقيتلك هدايا تناسب' + (gender === 'boy' ? 'ه' : gender === 'girl' ? 'ها' : '') + ' تمام! 🎁');
      setStep('results');
    }, 1500);
  }

  function restart() {
    setMessages([]);
    setGender(null);
    setAge(null);
    setResults([]);
    setStep('welcome');
    setTimeout(() => {
      addAmeenMessage(isEn ? 'Hello again 👋 Who are you looking for?' : 'مرحباً مجدداً 👋 لمن تبحث عن هدية؟');
      setStep('gender');
    }, 300);
  }

  const genderOptions = [
    { label: isEn ? '👦 Boy' : '👦 ولد', value: 'boy' as Gender },
    { label: isEn ? '👧 Girl' : '👧 بنت', value: 'girl' as Gender },
    { label: isEn ? '🧑 Adult' : '🧑 شخص كبير', value: 'adult' as Gender },
  ];

  const ageOptions: { label: string; value: AgeRange }[] = [
    { label: isEn ? '🐣 Under 5' : '🐣 أقل من 5 سنوات', value: 'under5' },
    { label: isEn ? '🌱 5–8 yrs' : '🌱 5 - 8 سنوات', value: '5to8' },
    { label: isEn ? '📚 9–12 yrs' : '📚 9 - 12 سنة', value: '9to12' },
    { label: isEn ? '🚀 13+' : '🚀 13 سنة فأكثر', value: '13plus' },
  ];

  return (
    <>
      {/* ── Floating button ── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2" dir={isEn ? 'ltr' : 'rtl'}>
        {!open && (
          <div className="bg-white border border-gray-200 rounded-2xl px-3 py-1.5 text-xs font-bold text-gray-700 shadow-md animate-bounce-slow whitespace-nowrap">
            {isEn ? 'Need help choosing? 💡' : 'محتاج مساعدة في الاختيار؟ 💡'}
          </div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="فتح مساعد أمين"
          className="relative w-20 h-20 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #1e3a6e 0%, #2d1060 100%)' }}
        >
          {open ? (
            <span className="text-white font-black text-xl">✕</span>
          ) : (
            <AminAvatar size={62} />
          )}
          {showBadge && !open && (
            <span className="absolute top-1 left-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </button>
      </div>

      {/* ── Chat panel ── */}
      {open && (
        <div
          dir={isEn ? 'ltr' : 'rtl'}
          className="fixed bottom-28 right-6 z-40 w-[340px] sm:w-[380px] max-h-[560px] flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-gray-200"
          style={{ background: '#f8f8fc' }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ background: 'linear-gradient(160deg, #1e3a6e 0%, #2d1060 100%)' }}
          >
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              <AminAvatar size={44} />
            </div>
            <div>
              <p className="font-black text-white text-sm leading-tight">{isEn ? 'Ameen' : 'أمين'}</p>
              <p className="text-white/70 text-xs">{isEn ? 'Your smart gift assistant' : 'مساعدك الذكي للهدايا'}</p>
            </div>
            <div className="mr-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/60 text-xs">{isEn ? 'online' : 'متاح'}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.from === 'ameen' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.from === 'ameen' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1e3a6e] to-[#2d1060] flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                    <AminAvatar size={30} />
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.from === 'ameen'
                      ? 'bg-white text-gray-800 rounded-tr-sm'
                      : 'text-[#1a1a2e] font-semibold rounded-tl-sm'
                  }`}

                  style={msg.from === 'user' ? { background: '#F5C518' } : {}}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {step === 'thinking' && (
              <div className="flex gap-2 justify-end">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1e3a6e] to-[#2d1060] flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                  <AminAvatar size={30} />
                </div>
                <TypingDots />
              </div>
            )}

            {/* Quick reply buttons */}
            {step === 'gender' && (
              <div className="flex flex-col gap-2 pt-1 items-end">
                {genderOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => pickGender(opt.value, opt.label)}
                    className="bg-white border-2 border-[#1a1a2e] text-[#1a1a2e] font-bold text-sm px-4 py-2.5 rounded-2xl hover:bg-[#1a1a2e] hover:text-white transition-all w-full text-right"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {step === 'age' && gender !== 'adult' && (
              <div className="flex flex-col gap-2 pt-1 items-end">
                {ageOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => pickAge(opt.value, opt.label)}
                    className="bg-white border-2 border-[#1a1a2e] text-[#1a1a2e] font-bold text-sm px-4 py-2.5 rounded-2xl hover:bg-[#1a1a2e] hover:text-white transition-all w-full text-right"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            {step === 'results' && results.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  {results.slice(0, 6).map(p => <MiniCard key={p.id} p={p} isEn={isEn} />)}
                </div>
                <button
                  onClick={restart}
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-700 py-2 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 transition"
                >
                  {isEn ? '🔄 Start over' : '🔄 ابدأ من جديد'}
                </button>
              </div>
            )}

            {step === 'results' && results.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">{isEn ? 'No available products found 😔' : 'لم أجد منتجات متاحة حالياً 😔'}</p>
                <button
                  onClick={restart}
                  className="mt-2 text-xs text-[#1a1a2e] underline"
                >
                  {isEn ? 'Start over' : 'ابدأ من جديد'}
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </>
  );
}
