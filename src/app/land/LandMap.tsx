'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon, { type IconName } from '@/components/media/Icon';
import { AUD, DISTRICTS, WHO_ORDER, type District, type L, type Who } from './data';
import { Art, Concept, Dot, WhoGrid } from './parts';

/**
 * The map of Moslim Leader Land — the first thing on the page, and a way in, not a picture.
 *
 * An illustrated top-down plan (SVG, viewBox 1200 × 760) with HTML pins laid over it in
 * percentages, so labels stay crisp and reachable by keyboard. Everything on it can be
 * pressed: a part of the Land opens its card (picture, what it offers children, men,
 * women and the family together), a place (the gate, the store, the café, the elders'
 * majlis, the events hall, the Giving Corner, each mosque) opens its own, and the map
 * glides in to frame what was chosen. «من سيزور؟» lights the parts that hold something
 * for that audience and lists it. A layer switches the mosques on and off.
 *
 * Only what the owner described or showed is named here — no counts, no invented
 * landmarks. It is a «مخطط تصوّري»: no scale, no site.
 */

const W = 1200;
const H = 760;
const C = { x: 600, y: 380 }; // the garden

/** Where each district sits, as a rotated rounded block. */
const DPOS: Record<string, { x: number; y: number; w: number; h: number; rot: number }> = {
  stories: { x: 925, y: 165, w: 340, h: 205, rot: -4 },
  games: { x: 275, y: 165, w: 340, h: 205, rot: 4 },
  scouts: { x: 165, y: 410, w: 250, h: 235, rot: -3 },
  girls: { x: 1035, y: 410, w: 250, h: 235, rot: 3 },
  family: { x: 925, y: 640, w: 330, h: 165, rot: 3 },
};

type Poi = { id: string; x: number; y: number; icon: IconName | 'dome' | 'tower'; title: L; text: L; district?: string; img?: string; layer?: 'mosque' };

const POIS: Poi[] = [
  { id: 'gate', x: 600, y: 726, icon: 'next', title: { ar: 'البوابة', en: 'The Gate' },
    text: { ar: 'من هنا تبدأ الرحلة: يتسلّم الطفل «جواز القائد»، ويُختم في كل ركن يمرّ به.', en: 'The journey starts here: a child receives the «Leader’s Passport», stamped in every part of the Land.' } },
  { id: 'store', x: 600, y: 632, icon: 'cart', title: { ar: 'متجر مسلم ليدر', en: 'The Moslim Leader Store' }, img: '/land/store.webp',
    text: { ar: 'كتب مسلم ليدر وألعابها وملابسها وحقائبها في مكان واحد — «خذ الحكاية معك».', en: 'Moslim Leader’s books, games, clothes and bags in one place — «take the story with you».' } },
  { id: 'cafe', x: 672, y: 590, icon: 'heart', title: { ar: 'مقهى العائلة', en: 'The Family Café' }, img: '/partnership/land-cafe.webp', district: 'plaza',
    text: { ar: 'مجلس الأسرة بين نشاط وآخر.', en: 'Where the family sits together between one activity and the next.' } },
  { id: 'elders', x: 505, y: 420, icon: 'comment', title: { ar: 'مجلس كبار السن', en: 'The Elders’ Majlis' }, district: 'plaza',
    text: { ar: 'في الحديقة الكبرى، يجتمع فيه الأجداد ويحكون لأحفادهم — فتأتي الأسرة بأجيالها الثلاثة.', en: 'In the Great Garden, where grandparents gather and tell their grandchildren the old stories — so the family comes in all three generations.' } },
  { id: 'events', x: 700, y: 430, icon: 'badge', title: { ar: 'قاعة المناسبات', en: 'The Events Hall' }, district: 'plaza',
    text: { ar: 'لمناسبات الأسرة: العقيقة، وختم القرآن، وتخرّج حلقات التحفيظ.', en: 'For the family’s occasions: aqiqah, completing the Quran, graduating from memorisation circles.' } },
  { id: 'giving', x: 82, y: 360, icon: 'heart', title: { ar: 'ركن العطاء', en: 'The Giving Corner' }, district: 'scouts',
    text: { ar: 'يجهّز فيه الأبناء سلال الخير ويزرعون للحي، فيتعلّمون أن القائد يخدم الناس.', en: 'Where children pack food baskets and plant for the neighbourhood, and learn that a leader serves people.' } },
  // A mosque in every district.
  ...(['stories', 'games', 'scouts', 'girls', 'family'] as const).map(id => {
    const p = DPOS[id];
    const d = DISTRICTS.find(x => x.id === id)!;
    return {
      id: `mosque-${id}`, x: p.x + (p.x > 600 ? -p.w / 2 + 34 : p.w / 2 - 34), y: p.y - p.h / 2 + 34, icon: 'dome' as const, layer: 'mosque' as const, district: id,
      title: { ar: `مسجد ${d.title.ar}`, en: `Mosque — ${d.title.en}` },
      text: { ar: 'في كل ركن من أرض القائد مسجد، فلا يبعد أحد عن الصلاة، وللنساء مصلاهن.', en: 'Every part of the Land has its own mosque, so prayer is never far — with a prayer hall for women.' },
    };
  }),
];

type Sel = { kind: 'district'; id: string } | { kind: 'poi'; id: string } | null;

const pct = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

function Dome({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 20h14v-5a7 7 0 0 0-14 0z M13 8V5" />
    </svg>
  );
}
function Tower({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 38h16l-3-22H8z M13 16V8 M6 8a7 7 0 0 1 14 0" />
    </svg>
  );
}

// Rounded, so the server and the browser print the same number (a last-digit difference
// in a float is a hydration mismatch).
const cos = (deg: number) => Math.round(Math.cos((deg * Math.PI) / 180) * 1000) / 1000;
const sin = (deg: number) => Math.round(Math.sin((deg * Math.PI) / 180) * 1000) / 1000;

/** The themed drawing inside each district block, centred on (0,0). */
function DistrictArt({ id, w, h, hue }: { id: string; w: number; h: number; hue: string }) {
  const ink = '#2B3550';
  switch (id) {
    case 'stories': // Andalusian arches and a screen
      return (
        <g>
          {[-110, -66, -22, 22, 66].map(x => (
            <path key={x} d={`M${x} 40 v-34 a20 20 0 0 1 40 0 v34`} fill="#FFF8E7" stroke={ink} strokeOpacity=".5" strokeWidth="2" />
          ))}
          <rect x="-112" y="-62" width="150" height="40" rx="6" fill={ink} opacity=".85" />
          <rect x="-104" y="-55" width="134" height="26" rx="3" fill={hue} opacity=".55" />
          <circle cx="105" cy="-30" r="22" fill="#F3E2B3" stroke={ink} strokeOpacity=".4" />
        </g>
      );
    case 'games': // a wheel, a ship, a caravan
      return (
        <g>
          <circle cx="-70" cy="-10" r="48" fill="none" stroke={ink} strokeOpacity=".55" strokeWidth="3" />
          {[0, 30, 60, 90, 120, 150].map(a => (
            <line key={a} x1={-70 + 48 * cos(a)} y1={-10 + 48 * sin(a)} x2={-70 - 48 * cos(a)} y2={-10 - 48 * sin(a)} stroke={ink} strokeOpacity=".35" strokeWidth="2" />
          ))}
          {[0, 60, 120, 180, 240, 300].map(a => (
            <circle key={a} cx={-70 + 48 * cos(a)} cy={-10 + 48 * sin(a)} r="7" fill={hue} stroke={ink} strokeOpacity=".4" />
          ))}
          <path d="M20 30 h110 l-18 22 h-74z" fill="#C9A26B" stroke={ink} strokeOpacity=".5" strokeWidth="2" />
          <path d="M72 30 v-62 l40 46 h-40" fill="#FFF8E7" stroke={ink} strokeOpacity=".5" strokeWidth="2" />
          {[24, 44, 64].map(x => <circle key={x} cx={x} cy="-48" r="6" fill="#B07D45" opacity=".7" />)}
        </g>
      );
    case 'scouts': // dunes, tents, a climbing wall
      return (
        <g>
          <path d={`M${-w / 2 + 20} 60 q40 -30 80 0 t80 0 t80 0`} fill="none" stroke="#C9A26B" strokeWidth="6" strokeLinecap="round" opacity=".7" />
          {[-70, -10].map(x => (
            <path key={x} d={`M${x} 20 l34 -52 l34 52z`} fill="#F3E2B3" stroke={ink} strokeOpacity=".5" strokeWidth="2" />
          ))}
          <rect x="52" y="-70" width="44" height="90" rx="6" fill="#B8C0CC" stroke={ink} strokeOpacity=".4" />
          {[[60, -58], [80, -40], [64, -20], [84, -2], [70, 10]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={i % 2 ? hue : '#F5C518'} />)}
          <circle cx="-95" cy="-50" r="16" fill="#7FA872" opacity=".9" />
          <ellipse cx="-95" cy="-28" rx="22" ry="6" fill="#9FD0DE" />
        </g>
      );
    case 'girls': // a closed riad courtyard with a fountain
      return (
        <g>
          <rect x="-82" y="-82" width="164" height="150" rx="14" fill="#FFF8E7" stroke={ink} strokeOpacity=".55" strokeWidth="3" />
          <rect x="-58" y="-58" width="116" height="102" rx="8" fill="#F6E3E9" />
          <circle cx="0" cy="-7" r="18" fill="#9FD0DE" stroke={ink} strokeOpacity=".35" />
          <circle cx="0" cy="-7" r="6" fill="#FFFFFF" />
          {[[-40, -40], [40, -40], [-40, 26], [40, 26]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="#7FA872" />)}
          <path d="M-14 68 v-14 a14 14 0 0 1 28 0 v14" fill={hue} stroke={ink} strokeOpacity=".4" />
        </g>
      );
    case 'family': // the House of Wisdom: a domed hall with columns, and a book
      return (
        <g>
          <rect x="-110" y="-20" width="150" height="56" rx="6" fill="#FFF8E7" stroke={ink} strokeOpacity=".5" strokeWidth="2" />
          <path d="M-70 -20 a35 30 0 0 1 70 0" fill={hue} stroke={ink} strokeOpacity=".45" strokeWidth="2" />
          {[-96, -72, -48, -24, 0, 24].map(x => <rect key={x} x={x} y="-10" width="8" height="40" rx="2" fill={ink} opacity=".25" />)}
          <path d="M70 -30 l40 8 v52 l-40 -8z M70 -30 l-30 10 v52 l30 -10" fill="#FFFFFF" stroke={ink} strokeOpacity=".5" strokeWidth="2" />
        </g>
      );
    default:
      return null;
  }
}

/** Trees scattered where nothing is built. */
const TREES: [number, number, number][] = [
  [470, 60, 14], [520, 90, 10], [690, 70, 13], [740, 100, 9], [600, 120, 11],
  [40, 610, 14], [90, 660, 12], [150, 700, 15], [230, 690, 11], [300, 650, 13], [360, 700, 10], [420, 660, 14], [250, 600, 9],
  [1170, 640, 12], [1150, 700, 14], [740, 720, 10], [455, 720, 11],
  [60, 230, 12], [1140, 240, 12], [500, 250, 10], [700, 250, 10], [410, 520, 10], [790, 520, 10],
];

export default function LandMap({ isEn }: { isEn: boolean }) {
  const L = (l: L) => (isEn ? l.en : l.ar);
  const tx = (ar: string, en: string) => (isEn ? en : ar);
  const [sel, setSel] = useState<Sel>(null);
  const [aud, setAud] = useState<Who | null>(null);
  const [layers, setLayers] = useState({ mosques: true });

  const district = sel?.kind === 'district' ? DISTRICTS.find(d => d.id === sel.id) ?? null : null;
  const poi = sel?.kind === 'poi' ? POIS.find(p => p.id === sel.id) ?? null : null;
  const plaza = DISTRICTS.find(d => d.id === 'plaza')!;

  // Where the camera frames: the chosen district or place, else the whole Land.
  const focus = useMemo(() => {
    if (district) {
      const p = district.id === 'plaza' ? { x: C.x, y: C.y } : DPOS[district.id];
      return { x: p.x, y: p.y, s: district.id === 'plaza' ? 1.6 : 1.55 };
    }
    if (poi) return { x: poi.x, y: poi.y, s: 1.7 };
    return null;
  }, [district, poi]);
  // Scale about the framed point, then bring it to the centre. The point is clamped so a
  // district at the edge never pulls empty ground into the frame.
  const camera = (() => {
    if (!focus) return { transformOrigin: '50% 50%', transform: 'none' };
    const hw = W / (2 * focus.s);
    const hh = H / (2 * focus.s);
    const fx = Math.min(Math.max(focus.x, hw), W - hw);
    const fy = Math.min(Math.max(focus.y, hh), H - hh);
    return {
      transformOrigin: `${(fx / W) * 100}% ${(fy / H) * 100}%`,
      transform: `translate(${(0.5 - fx / W) * 100}%, ${(0.5 - fy / H) * 100}%) scale(${focus.s})`,
    };
  })();

  const has = (d: District, w: Who) => d.who[w].length > 0;
  const dimmed = (d: District) => !!aud && !has(d, aud);
  const pick = (s: Sel) => setSel(cur => (cur && s && cur.kind === s.kind && cur.id === s.id ? null : s));
  const asideRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // Below the map on a phone: bring the card's top into view, the map stays in sight.
    if (sel && window.matchMedia('(max-width: 1023px)').matches) {
      window.setTimeout(() => asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 250);
    }
  }, [sel]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
      {/* ── The map ── (min-w-0: the scrolling chip row must not widen the column) */}
      <div className="lg:col-span-8 min-w-0">
        {/* «من سيزور؟» and the layers */}
        <div className="mb-3 -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto sm:flex-wrap whitespace-nowrap" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 text-xs font-bold text-white/60 me-1">{tx('من سيزور؟', 'Who is visiting?')}</span>
          {[null, ...WHO_ORDER].map(w => (
            <button
              key={w ?? 'all'}
              type="button"
              onClick={() => setAud(w)}
              aria-pressed={aud === w}
              className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-bold transition ${aud === w ? 'bg-white text-[#0A0F1E]' : 'bg-white/[0.07] text-white/80 hover:bg-white/[0.12]'}`}
            >
              {w ? <Dot w={w} size={9} /> : null}
              {w ? (isEn ? AUD[w].en : AUD[w].ar) : tx('الكل', 'Everyone')}
            </button>
          ))}
          <span className="shrink-0 mx-1 h-5 w-px bg-white/15" aria-hidden />
          {([['mosques', tx('المساجد', 'Mosques')]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setLayers(l => ({ ...l, [k]: !l[k] }))}
              aria-pressed={layers[k]}
              className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-bold border transition ${layers[k] ? 'border-[#F5C518]/60 text-[#F5C518] bg-[#F5C518]/10' : 'border-white/15 text-white/55'}`}
            >
              <Icon name={layers[k] ? 'check' : 'close'} size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="relative rounded-[28px] overflow-hidden ring-1 ring-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.45)] bg-[#E9E2CF]" style={{ aspectRatio: `${W} / ${H}` }}>
          <div className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none" style={camera}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" role="img" aria-label={tx('خريطة تصوّرية لأرض القائد المسلم', 'Concept map of Moslim Leader Land')}>
              <defs>
                <pattern id="lm-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#B9AE90" opacity=".35" /></pattern>
                <filter id="lm-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#2B3550" floodOpacity=".22" /></filter>
                <radialGradient id="lm-garden" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#D8EBC2" /><stop offset="1" stopColor="#B9D7A0" /></radialGradient>
              </defs>
              <rect width={W} height={H} fill="url(#lm-dots)" />
              {/* The boundary wall */}
              <rect x="14" y="14" width={W - 28} height={H - 28} rx="70" fill="#F3EDDF" stroke="#CFC3A3" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />

              {/* Paths: gate → garden, garden → each district */}
              <g stroke="#E3D2A6" strokeWidth="26" strokeLinecap="round" fill="none">
                {Object.values(DPOS).map((p, i) => <line key={i} x1={C.x} y1={C.y} x2={p.x} y2={p.y} />)}
              </g>
              {/* From the gate to the garden: the store and the café */}
              <rect x="562" y="530" width="76" height="200" rx="14" fill="#E8D7AE" />
              {[548, 578, 608, 638, 668].map((y, i) => (
                <g key={y}>
                  <rect x="530" y={y - 10} width="30" height="22" rx="4" fill={['#E7A9BD', '#8FC3D1', '#F5C518', '#B9C79A', '#B7A9DA'][i]} opacity=".9" />
                  <rect x="640" y={y - 10} width="30" height="22" rx="4" fill={['#B9C79A', '#F5C518', '#E7A9BD', '#8FC3D1', '#E8C873'][i]} opacity=".9" />
                </g>
              ))}
              {/* The gate */}
              <path d="M548 742 v-34 a52 40 0 0 1 104 0 v34" fill="#0F1630" />
              <path d="M566 742 v-26 a34 28 0 0 1 68 0 v26" fill="#E8D7AE" />

              {/* Trees */}
              {TREES.map(([x, y, r], i) => (
                <g key={i}><circle cx={x} cy={y + 3} r={r} fill="#6E9460" opacity=".35" /><circle cx={x} cy={y} r={r} fill={i % 3 ? '#8DB57A' : '#7FA872'} /></g>
              ))}

              {/* The Great Garden */}
              <g
                className="cursor-pointer"
                onClick={() => pick({ kind: 'district', id: 'plaza' })}
                opacity={aud && !has(plaza, aud) ? 0.35 : 1}
              >
                <ellipse cx={C.x} cy={C.y} rx="205" ry="150" fill="url(#lm-garden)" stroke={district?.id === 'plaza' ? '#2B3550' : '#9DBF85'} strokeWidth={district?.id === 'plaza' ? 4 : 2} filter="url(#lm-shadow)" />
                <ellipse cx={C.x} cy={C.y + 6} rx="120" ry="80" fill="none" stroke="#F3EDDF" strokeWidth="10" opacity=".9" />
                <rect x={C.x - 70} y={C.y + 52} width="140" height="26" rx="13" fill="#9FD0DE" stroke="#7DB7C6" />
                {[[-150, -40], [-130, 60], [150, -40], [130, 60], [-60, -110], [60, -110]].map(([dx, dy], i) => (
                  <circle key={i} cx={C.x + dx} cy={C.y + dy} r="14" fill="#7FA872" />
                ))}
                {/* fountain */}
                <g transform={`translate(${C.x} ${C.y - 30})`}>
                  <ellipse cx="0" cy="20" rx="46" ry="16" fill="#9FD0DE" stroke="#7DB7C6" strokeWidth="2" />
                  <ellipse cx="0" cy="12" rx="20" ry="8" fill="#FFF8E7" stroke="#2B3550" strokeOpacity=".4" />
                  <path d="M0 12 v-22 M-8 -2 q8 -16 16 0" stroke="#7DB7C6" strokeWidth="3" fill="none" strokeLinecap="round" />
                </g>
              </g>

              {/* Districts */}
              {DISTRICTS.filter(d => DPOS[d.id]).map(d => {
                const p = DPOS[d.id];
                const on = district?.id === d.id;
                return (
                  <g
                    key={d.id}
                    transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`}
                    className="cursor-pointer lm-block"
                    opacity={dimmed(d) ? 0.32 : 1}
                    onClick={() => pick({ kind: 'district', id: d.id })}
                  >
                    <rect x={-p.w / 2} y={-p.h / 2} width={p.w} height={p.h} rx="46" fill="#FFFDF7" filter="url(#lm-shadow)" />
                    <rect x={-p.w / 2} y={-p.h / 2} width={p.w} height={p.h} rx="46" fill={d.hue} fillOpacity={on ? 0.55 : 0.32} stroke={on ? '#2B3550' : d.hue} strokeWidth={on ? 4 : 2.5} />
                    <DistrictArt id={d.id} w={p.w} h={p.h} hue={d.hue} />
                  </g>
                );
              })}
            </svg>

            {/* District labels */}
            {DISTRICTS.map(d => {
              const p = d.id === 'plaza' ? { x: C.x, y: C.y + 112 } : { x: DPOS[d.id].x, y: DPOS[d.id].y + DPOS[d.id].h / 2 - 2 };
              const on = district?.id === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => pick({ kind: 'district', id: d.id })}
                  aria-pressed={on}
                  aria-label={L(d.title)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-1.5 rounded-full p-0.5 sm:ps-1 sm:pe-3 sm:py-1 text-[10px] sm:text-xs font-extrabold shadow-lg whitespace-nowrap transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${on ? 'bg-[#0A0F1E] text-white' : 'bg-white/95 text-[#18203A]'} ${dimmed(d) ? 'opacity-50' : ''}`}
                  style={pct(p.x, p.y)}
                >
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full inline-flex items-center justify-center text-[#0A0F1E]" style={{ background: d.hue }}><Icon name={d.icon} size={12} /></span>
                  <span className="disp hidden sm:inline">{L(d.title)}</span>
                </button>
              );
            })}

            {/* Places */}
            {POIS.filter(p => p.layer !== 'mosque' || layers.mosques).map(p => {
              const on = poi?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick({ kind: 'poi', id: p.id })}
                  aria-pressed={on}
                  aria-label={L(p.title)}
                  title={L(p.title)}
                  className={`group absolute -translate-x-1/2 -translate-y-1/2 z-20 rounded-full inline-flex items-center justify-center transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${p.layer === 'mosque' ? 'w-[18px] h-[18px] sm:w-8 sm:h-8' : 'w-6 h-6 sm:w-9 sm:h-9'} ${on ? 'bg-[#F5C518] text-[#0A0F1E] ring-4 ring-[#F5C518]/40' : 'bg-[#0F1630] text-[#F5C518] ring-2 ring-white/80'}`}
                  style={pct(p.x, p.y)}
                >
                  {!on && p.layer !== 'mosque' && <span className="absolute inset-0 rounded-full bg-[#F5C518]/40 lm-ping" aria-hidden />}
                  <span className="relative">
                    {p.icon === 'dome' ? <Dome size={11} /> : p.icon === 'tower' ? <Tower size={12} /> : <Icon name={p.icon} size={12} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Map chrome */}
          <span className="absolute bottom-3 start-3 z-30 rounded-full bg-white/85 backdrop-blur px-3 py-1 text-[10px] sm:text-[11px] font-bold text-[#5C6478]">
            {tx('مخطط تصوّري · ليس بمقياس رسم · لا موقع محدد', 'Concept map · not to scale · no site chosen')}
          </span>
          {sel && (
            <button type="button" onClick={() => setSel(null)} className="absolute top-3 end-3 z-30 inline-flex items-center gap-1.5 rounded-full bg-[#0A0F1E]/85 backdrop-blur text-white px-3.5 py-2 text-xs font-bold hover:bg-[#0A0F1E]">
              <Icon name="expand" size={14} /> {tx('الخريطة كاملة', 'Whole map')}
            </button>
          )}
          {!sel && (
            <span className="absolute top-3 end-3 z-30 rounded-full bg-[#0A0F1E]/80 backdrop-blur text-white px-3.5 py-2 text-[11px] sm:text-xs font-bold pointer-events-none">
              {tx('اضغط على أي ركن أو مكان', 'Tap any part or place')}
            </span>
          )}
        </div>
      </div>

      {/* ── What was chosen ── */}
      <aside ref={asideRef} className="min-w-0 lg:col-span-4 lg:mt-12 scroll-mb-4 rounded-[28px] overflow-hidden bg-white/[0.04] ring-1 ring-white/10 text-white" aria-live="polite">
        {district ? (
          <>
            <div className="relative aspect-[16/9]">
              {district.img ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img key={district.img} src={district.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <Concept isEn={isEn} />
                </>
              ) : <Art d={district} />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] to-transparent" aria-hidden />
              <span className="absolute bottom-4 start-5 w-12 h-12 rounded-2xl inline-flex items-center justify-center text-[#0A0F1E]" style={{ background: district.hue }}><Icon name={district.icon} size={24} /></span>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: `${district.hue}22`, color: district.hue }}>{L(district.tag)}</span>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-white/[0.06] text-[#F5C518]"><Dome size={12} /> {tx('فيه مسجد', 'Its own mosque')}</span>
              </div>
              <h3 className="disp mt-3 text-2xl font-extrabold leading-tight">{L(district.title)}</h3>
              <p className="mt-3 text-white/70 leading-relaxed text-sm">{L(district.intro)}</p>
              <div className="mt-4"><WhoGrid d={district} isEn={isEn} focus={aud} /></div>
              <a href={`#d-${district.id}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#F5C518]">
                {tx('التفاصيل', 'Details')} <Icon name="down" size={15} />
              </a>
            </div>
          </>
        ) : poi ? (
          <>
            {poi.img && (
              <div className="relative aspect-[16/9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={poi.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <Concept isEn={isEn} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] to-transparent" aria-hidden />
              </div>
            )}
            <div className="p-5 sm:p-6">
              <span className="w-12 h-12 rounded-2xl bg-[#F5C518] text-[#0A0F1E] inline-flex items-center justify-center">
                {poi.icon === 'dome' ? <Dome size={22} /> : poi.icon === 'tower' ? <Tower size={22} /> : <Icon name={poi.icon} size={22} />}
              </span>
              <h3 className="disp mt-4 text-2xl font-extrabold leading-tight">{L(poi.title)}</h3>
              <p className="mt-3 text-white/75 leading-relaxed">{L(poi.text)}</p>
              {poi.district && (() => {
                const d = DISTRICTS.find(x => x.id === poi.district)!;
                return (
                  <button type="button" onClick={() => setSel({ kind: 'district', id: d.id })} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/[0.07] hover:bg-white/[0.12] px-3.5 py-2 text-sm font-bold">
                    <span className="w-5 h-5 rounded-full text-[#0A0F1E] inline-flex items-center justify-center" style={{ background: d.hue }}><Icon name={d.icon} size={11} /></span>
                    {tx('في: ', 'In: ')}{L(d.title)}
                  </button>
                );
              })()}
            </div>
          </>
        ) : (
          // Nothing chosen: the Land at a glance — or, with an audience chosen, everything
          // the Land holds for it, district by district.
          <div className="p-5 sm:p-6">
            <p className="text-xs font-bold text-[#E8C873]">{aud ? (isEn ? AUD[aud].en : AUD[aud].ar) : tx('على الخريطة', 'On the map')}</p>
            <h3 className="disp mt-2 text-2xl font-extrabold leading-tight">
              {aud ? tx('ما ينتظرهم في أرض القائد', 'What awaits them in the Land') : tx('أركان أرض القائد', 'The parts of the Land')}
            </h3>
            <ul className="mt-4 grid gap-2">
              {[...DISTRICTS].sort((a, b) => a.n - b.n).map(d => (
                <li key={d.id}>
                  <button type="button" onClick={() => pick({ kind: 'district', id: d.id })} className={`w-full text-start rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] p-3 transition ${aud && !has(d, aud) ? 'opacity-45' : ''}`}>
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full text-[#0A0F1E] inline-flex items-center justify-center shrink-0" style={{ background: d.hue }}><Icon name={d.icon} size={13} /></span>
                      <span className="font-bold">{L(d.title)}</span>
                    </span>
                    {aud && (
                      <span className="mt-1.5 block ps-8 text-[13px] text-white/75 leading-snug">
                        {has(d, aud) ? d.who[aud].map(L).join(' · ') : (d.onlyFor ? tx('خاص بالبنات والسيدات', 'For girls and women only') : '—')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {!aud && (
              <p className="mt-4 text-sm text-white/60 leading-relaxed">
                {tx('في كل ركن ما يخص الأطفال، وما يخص الرجال، وما يخص النساء، وما تعيشه الأسرة معاً. اختر «من سيزور؟» فوق الخريطة لترى ما ينتظر كلاً منهم.', 'Every part holds something for children, for men, for women, and for the family together. Choose «Who is visiting?» above the map to see what awaits each.')}
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
