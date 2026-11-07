'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './land-map.css';
import { sfx, setSound } from './land-sound';
import {
  audienceOrder, audiences, mapImage, mapImageSmall, parts, places, ui, ui2,
  type Audience, type Lang, type Part, type Place, type T,
} from './land-data';
import { LandIcon } from './land-icons';

/**
 * The interactive map of Moslim Leader Land — DESIGNED IN LOVABLE and ported here
 * (github.com/Aqtar-Company/pixel-perfect-replay-42559, src/components/land/LandMap.tsx).
 *
 * The owner keeps designing it there; to carry a change over, diff that file against this
 * one and land-data.ts against ./land-data.ts. Two things differ on purpose:
 *  - No framer-motion and no react-zoom-pan-pinch. The camera is one CSS transform
 *    (translate + scale from the top-left corner, clamped to the edges, the same arithmetic
 *    Lovable passes to setTransform), pan and pinch are pointer events, and the entrances
 *    are CSS keyframes in land-map.css. The site gains no dependency for one page.
 *  - The map keeps its 1200 × 760 shape at every width (capped at 92vh tall). Lovable's
 *    frame let the picture crop under `max-h`, which moved the pins off what they mark.
 */

type Sel = { kind: 'part' | 'place'; id: string } | null;
type View = { x: number; y: number; s: number };
const W = 1200, H = 760;
const MAX_SCALE = 3;
const pct = (v: number, of: number) => `${Math.round((v / of) * 10000) / 100}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function useMedia(query: string, initial: boolean) {
  const [m, setM] = useState(initial);
  useEffect(() => {
    const q = window.matchMedia(query);
    const on = () => setM(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [query]);
  return m;
}

/** The illustrated master plan, with a spotlight on the open part and shade on dimmed ones. */
function Illustration({ hovered, selectedPart, dimmed }: { hovered: string | null; selectedPart: string | null; dimmed: Set<string> }) {
  const focus = parts.find(p => p.id === selectedPart);
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mapImage} srcSet={`${mapImageSmall} 1200w, ${mapImage} 1920w`} sizes="100vw"
        alt="" width={1920} height={1216} draggable={false}
        className="h-full w-full object-cover select-none"
      />
      <svg viewBox="0 0 1200 760" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="lv-spot">
            <stop offset="0.55" stopColor="#000" stopOpacity="1" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <mask id="lv-spot-mask">
            <rect width="1200" height="760" fill="white" />
            {focus && <circle cx={focus.center.x} cy={focus.center.y} r={220} fill="url(#lv-spot)" />}
          </mask>
        </defs>
        <rect width="1200" height="760" fill="#05070f" opacity={focus ? 0.55 : 0} mask="url(#lv-spot-mask)" style={{ transition: 'opacity .6s' }} />
        {parts.map(p => (
          <g key={p.id}>
            {dimmed.has(p.id) && <circle cx={p.center.x} cy={p.center.y} r={120} fill="#05070f" opacity={0.6} />}
            {hovered === p.id && selectedPart !== p.id && (
              <circle cx={p.center.x} cy={p.center.y} r={115} fill="none" stroke="#F5C518" strokeWidth={2} strokeDasharray="4 8" className="land-flow" />
            )}
          </g>
        ))}
        {focus && <circle cx={focus.center.x} cy={focus.center.y} r={125} fill="none" stroke="#F5C518" strokeWidth={2.5} strokeDasharray="4 8" className="land-flow" />}
      </svg>
    </div>
  );
}

function ConceptImage({ images, alt, tint, icon, lang }: { images?: string[]; alt: string; tint: string; icon: Part['icon']; lang: Lang }) {
  const list = useMemo(() => images ?? [], [images]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  useEffect(() => { setIdx(0); setFailed({}); }, [list]);
  const src = list[idx];
  const broken = !src || failed[idx];
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#111933]">
        {broken ? (
          <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${tint}55, ${tint}22)` }}>
            <LandIcon name={icon} size={64} strokeWidth={1.4} style={{ color: tint }} />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(f => ({ ...f, [idx]: true }))} className="h-full w-full object-cover" />
        )}
        <span className="absolute top-3 start-3 rounded-full border border-[#F6F2E9]/30 bg-[#0A0F1E]/40 px-3 py-1 text-xs text-[#F6F2E9] backdrop-blur-md">
          {ui.conceptPhoto[lang]}
        </span>
      </div>
      {list.length > 1 && (
        <div className="flex gap-2">
          {list.map((im, i) => (
            <button key={im} type="button" onClick={() => setIdx(i)} aria-label={`${alt} ${i + 1}`} aria-pressed={i === idx}
              className={`lv-ring h-12 w-16 overflow-hidden rounded-lg border-2 bg-[#111933] transition-opacity ${i === idx ? 'border-[#F5C518]' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {!failed[i] && <img src={im} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setFailed(f => ({ ...f, [i]: true }))} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LandMap({ lang }: { lang: Lang }) {
  const [sel, setSel] = useState<Sel>(null);
  const [aud, setAud] = useState<Audience | null>(null);
  const [showMosques, setShowMosques] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [sound, setSoundOn] = useState(true);
  const [touring, setTouring] = useState(false);
  const [cine, setCine] = useState<Part | null>(null);
  const [view, setViewState] = useState<View>({ x: 0, y: 0, s: 1 });
  const [animate, setAnimate] = useState(true);
  useEffect(() => { setSound(sound); }, [sound]);
  const isDesktop = useMedia('(min-width: 1024px)', true);
  const reduce = useMedia('(prefers-reduced-motion: reduce)', false);
  const frameRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>(view);
  const L = (x: T) => x[lang];
  const zoomed = view.s > 1.01;

  const setView = useCallback((v: View, anim: boolean) => {
    viewRef.current = v;
    setAnimate(anim);
    setViewState(v);
  }, []);

  /** Keep the picture covering the frame: no empty edge may show. */
  const clampView = useCallback((v: View): View => {
    const el = frameRef.current;
    if (!el) return v;
    const w = el.clientWidth, h = el.clientHeight;
    const s = clamp(v.s, 1, MAX_SCALE);
    return { s, x: clamp(v.x, w - w * s, 0), y: clamp(v.y, h - h * s, 0) };
  }, []);

  const dimmed = useMemo(() => new Set(aud ? parts.filter(p => p.who[aud].length === 0).map(p => p.id) : []), [aud]);
  const selPart: Part | undefined = sel?.kind === 'part' ? parts.find(p => p.id === sel.id) : undefined;
  const selPlace: Place | undefined = sel?.kind === 'place' ? places.find(p => p.id === sel.id) : undefined;

  const camera = useCallback((cx: number, cy: number, s: number) => {
    const el = frameRef.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    // On a computer the panel covers one side, so the subject is framed in the other.
    const anchorX = isDesktop ? (lang === 'ar' ? 0.64 : 0.36) : 0.5;
    const anchorY = isDesktop ? 0.5 : 0.32;
    setView(clampView({ s, x: w * anchorX - (cx / W) * w * s, y: h * anchorY - (cy / H) * h * s }), !reduce);
  }, [isDesktop, reduce, lang, setView, clampView]);

  const scrollMapTop = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72), behavior: reduce ? 'auto' : 'smooth' }));
  }, [reduce]);

  const reset = useCallback(() => {
    if (sel) sfx.close();
    setSel(null); setCine(null);
    setView({ x: 0, y: 0, s: 1 }, !reduce);
  }, [reduce, sel, setView]);

  const goPart = useCallback((id: string, cinematic: boolean) => {
    const p = parts.find(q => q.id === id)!;
    setSel({ kind: 'part', id });
    camera(p.center.x, p.center.y, 1.5);
    sfx.open();
    if (cinematic && !reduce && p.images?.length) setCine(p);
  }, [camera, reduce]);

  useEffect(() => {
    if (!cine) return;
    const h = setTimeout(() => setCine(null), 2800);
    return () => clearTimeout(h);
  }, [cine]);

  useEffect(() => {
    if (!touring) return;
    const cur = selPart ? parts.indexOf(selPart) : -1;
    const h = setTimeout(() => goPart(parts[(cur + 1) % parts.length]!.id, true), cur < 0 ? 300 : 7000);
    return () => clearTimeout(h);
  }, [touring, selPart, goPart]);

  const openPart = useCallback((id: string) => {
    if (sel?.kind === 'part' && sel.id === id) return reset();
    setTouring(false);
    goPart(id, true);
    if (!isDesktop) scrollMapTop();
  }, [sel, goPart, reset, isDesktop, scrollMapTop]);

  const openPlace = useCallback((id: string) => {
    if (sel?.kind === 'place' && sel.id === id) return reset();
    const p = places.find(q => q.id === id)!;
    setTouring(false); sfx.chirp();
    setSel({ kind: 'place', id });
    camera(p.pin.x, p.pin.y, 1.7);
    if (!isDesktop) scrollMapTop();
  }, [sel, camera, reset, isDesktop, scrollMapTop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') reset(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reset]);

  // A resize changes the frame: re-clamp so no empty edge appears.
  useEffect(() => {
    const on = () => setView(clampView(viewRef.current), false);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [clampView, setView]);

  // The phone's sheet sits where the floating Ameen/WhatsApp buttons are (globals.css).
  const sheetOpen = !isDesktop && !!sel;
  useEffect(() => {
    const root = document.documentElement;
    if (sheetOpen) root.setAttribute('data-sheet', '');
    else root.removeAttribute('data-sheet');
    return () => root.removeAttribute('data-sheet');
  }, [sheetOpen]);

  const onMapKey = (e: React.KeyboardEvent) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const forward = e.key === 'ArrowDown' || e.key === (lang === 'ar' ? 'ArrowLeft' : 'ArrowRight');
    const cur = selPart ? parts.indexOf(selPart) : -1;
    const np = parts[(cur + (forward ? 1 : -1) + parts.length) % parts.length]!;
    setSel({ kind: 'part', id: np.id });
    camera(np.center.x, np.center.y, 1.5);
    document.getElementById(`land-label-${np.id}`)?.focus({ preventScroll: true });
  };

  /* ---------- pan (when zoomed in) and pinch ---------- */
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ mode: 'pan' | 'pinch' | null; sx: number; sy: number; d0: number; v: View; moved: boolean; cx: number; cy: number }>(
    { mode: null, sx: 0, sy: 0, d0: 1, v: { x: 0, y: 0, s: 1 }, moved: false, cx: 0, cy: 0 },
  );
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = viewRef.current;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const r = frameRef.current!.getBoundingClientRect();
      const mx = (a!.x + b!.x) / 2 - r.left, my = (a!.y + b!.y) / 2 - r.top;
      // The content point under the fingers stays under them.
      gesture.current = { mode: 'pinch', sx: 0, sy: 0, d0: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, v, moved: true, cx: (mx - v.x) / v.s, cy: (my - v.y) / v.s };
    } else if (ptrs.current.size === 1) {
      gesture.current = { ...gesture.current, mode: v.s > 1.01 ? 'pan' : null, sx: e.clientX, sy: e.clientY, v, moved: false };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.mode === 'pan') {
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      if (!g.moved && Math.hypot(dx, dy) < 6) return;
      if (!g.moved) { g.moved = true; frameRef.current?.setPointerCapture(e.pointerId); }
      setView(clampView({ s: g.v.s, x: g.v.x + dx, y: g.v.y + dy }), false);
    } else if (g.mode === 'pinch' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const r = frameRef.current!.getBoundingClientRect();
      const s = clamp(g.v.s * (Math.hypot(a!.x - b!.x, a!.y - b!.y) / g.d0), 1, MAX_SCALE);
      const mx = (a!.x + b!.x) / 2 - r.left, my = (a!.y + b!.y) / 2 - r.top;
      setView(clampView({ s, x: mx - g.cx * s, y: my - g.cy * s }), false);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.mode === 'pinch' && ptrs.current.size === 1) {
      // One finger left: carry on as a pan from where it is.
      const [p] = [...ptrs.current.values()];
      gesture.current = { ...g, mode: viewRef.current.s > 1.01 ? 'pan' : null, sx: p!.x, sy: p!.y, v: viewRef.current, moved: true };
    } else if (ptrs.current.size === 0) {
      g.mode = null;
    }
  };
  // A drag must not also press the pin it started on.
  const onClickCapture = (e: React.MouseEvent) => {
    if (gesture.current.moved) { e.stopPropagation(); e.preventDefault(); gesture.current.moved = false; }
  };

  const visiblePlaces = places.filter(p => showMosques || p.icon !== 'mosque');
  const nothingSelected = !sel;

  /* ---------- panel content ---------- */
  const panelBody = (
    <div className="flex flex-col gap-5">
      {selPart && <PartView p={selPart} lang={lang} aud={aud} />}
      {selPlace && <PlaceView p={selPlace} lang={lang} onPart={openPart} />}
      {nothingSelected && !aud && (
        <div>
          <h2 className="lv-display text-xl font-semibold text-[#F5C518]">{L(ui.partsTitle)}</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {parts.map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => openPart(p.id)}
                  onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)}
                  className="row lv-ring">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${p.tint}33`, color: p.tint }}>
                    <LandIcon name={p.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="lv-display block font-medium">{L(p.title)}</span>
                    <span className="block truncate text-sm text-[#BDB5A3]">{L(p.tag)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm leading-7 text-[#BDB5A3]">{L(ui.partsLine)}</p>
        </div>
      )}
      {nothingSelected && aud && (
        <div>
          <h2 className="lv-display flex items-center gap-2 text-xl font-semibold">
            <span className="h-3 w-3 rounded-full" style={{ background: audiences[aud].color }} />
            {L(audiences[aud].label)}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {parts.map(p => {
              const items = p.who[aud];
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => openPart(p.id)} className={`row lv-ring !block p-4 ${items.length ? '' : 'opacity-60'}`}>
                    <span className="lv-display flex items-center gap-2 font-medium">
                      <LandIcon name={p.icon} size={18} style={{ color: p.tint }} /> {L(p.title)}
                    </span>
                    <span className="mt-2 block text-sm leading-7 text-[#BDB5A3]">
                      {items.length ? items.map(L).join(' · ') : L(ui.womenOnlyNote)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} className="lv w-full min-w-0">
      {/* Controls */}
      <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="lv-display shrink-0 text-sm text-[#E8C873]">{L(ui.whoVisits)}</span>
          <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto py-1">
            {([null, ...audienceOrder] as (Audience | null)[]).map(a => (
              <button key={a ?? 'all'} type="button" aria-pressed={aud === a} onClick={() => setAud(a)} className="chip chip-solid lv-ring shrink-0">
                {a && <span className="h-2 w-2 rounded-full" style={{ background: audiences[a].color }} />}
                {a ? L(audiences[a].label) : L(ui.all)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-pressed={showMosques} onClick={() => setShowMosques(v => !v)} className="chip chip-mosque lv-ring">
            <LandIcon name="mosque" size={16} /> {L(ui.mosques)}
          </button>
          <button type="button" aria-pressed={touring} onClick={() => { if (touring) setTouring(false); else { setTouring(true); sfx.chirp(); } }} className="chip chip-tour lv-ring">
            <LandIcon name={touring ? 'stop' : 'play'} size={14} /> {L(touring ? ui2.stopTour : ui2.tour)}
          </button>
          <button type="button" aria-pressed={sound} aria-label={L(ui2.sound)} onClick={() => setSoundOn(v => !v)}
            className="lv-ring rounded-full border border-white/10 p-2 text-[#BDB5A3] hover:text-[#F6F2E9]">
            <LandIcon name={sound ? 'volume' : 'mute'} size={16} />
          </button>
        </div>
      </div>

      <div className="relative min-w-0">
        {/* Map — the band runs the full width of the screen; the plan keeps its shape. */}
        <div className="relative mx-[calc(50%-50vw)] w-screen bg-[#070B17]">
          <div
            ref={frameRef} role="region" aria-label={L(ui.heading)} tabIndex={0} onKeyDown={onMapKey}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            onClickCapture={onClickCapture}
            className="lv-ring relative mx-auto aspect-[1200/760] overflow-hidden select-none"
            style={{ width: 'min(100%, calc(92vh * 1200 / 760))', touchAction: zoomed ? 'none' : 'pan-y', cursor: zoomed ? 'grab' : undefined }}
          >
            <div
              dir="ltr" className="absolute inset-0"
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transformOrigin: '0 0',
                transition: animate ? 'transform .65s cubic-bezier(.2,.7,.2,1)' : 'none',
              }}
            >
              <Illustration hovered={hovered} selectedPart={selPart?.id ?? null} dimmed={dimmed} />

              {parts.map(p => {
                const active = selPart?.id === p.id;
                return (
                  <button
                    key={p.id} id={`land-label-${p.id}`} type="button" aria-label={L(p.title)} aria-pressed={active}
                    onClick={() => openPart(p.id)}
                    onMouseEnter={() => { setHovered(p.id); sfx.hover(); }} onMouseLeave={() => setHovered(null)}
                    style={{ left: pct(p.label.x, W), top: pct(p.label.y, H), opacity: dimmed.has(p.id) ? 0.3 : 1, ['--holo' as string]: p.tint }}
                    className={`holo lv-ring absolute z-10 -translate-x-1/2 -translate-y-full transition-opacity ${active ? 'holo-active' : ''}`}
                  >
                    <span className="holo-card">
                      <span className="holo-scan" />
                      <span className="flex items-center gap-2" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                        <LandIcon name={p.icon} size={isDesktop ? 18 : 13} />
                        <span className="lv-display font-semibold">{L(p.title)}</span>
                      </span>
                      {isDesktop && <span className="holo-tag">{L(p.tag)}</span>}
                    </span>
                    <span className="holo-beam" />
                  </button>
                );
              })}

              {visiblePlaces.map(p => {
                const active = selPlace?.id === p.id;
                const isMosque = p.icon === 'mosque';
                const size = isMosque ? (isDesktop ? 26 : 16) : isDesktop ? 30 : 20;
                return (
                  <button
                    key={p.id} type="button" aria-label={L(p.title)} aria-pressed={active} onClick={() => openPlace(p.id)}
                    style={{ left: pct(p.pin.x, W), top: pct(p.pin.y, H), width: size, height: size }}
                    className={`pin lv-ring ${isMosque ? 'pin-mosque' : 'pin-place'}`}
                  >
                    {nothingSelected && !isMosque && <span className="land-pulse pointer-events-none absolute inset-0 rounded-full ring-2 ring-[#F5C518]" />}
                    {!isMosque && <LandIcon name={p.icon} size={isDesktop ? 15 : 11} />}
                    {isMosque && active && <span className="absolute inset-0 rounded-full ring-2 ring-[#F5C518]" />}
                  </button>
                );
              })}
            </div>

            {/* The part's picture, full frame, for a moment — then the plan again. */}
            {cine && (
              <button key={cine.id} type="button" onClick={() => setCine(null)} aria-label={L(cine.title)}
                className="cine absolute inset-0 z-40 overflow-hidden bg-[#0A0F1E]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cine.images![0]} alt="" className="cine-img h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] via-[#0A0F1E]/30 to-transparent" />
                <div className="cine-bar absolute inset-x-0 top-0 h-0.5 bg-[#F5C518]" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-center sm:p-8">
                  <p className="cine-tag text-xs tracking-widest text-[#F5C518] sm:text-sm">{L(cine.tag)}</p>
                  <h3 className="cine-title lv-display mt-1 text-2xl font-bold text-[#F6F2E9] sm:text-5xl">{L(cine.title)}</h3>
                </div>
              </button>
            )}

            {/* Overlays (not zoomed) */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
              {nothingSelected && !zoomed ? (
                <span key="hint" className="fade-in rounded-full bg-[#0A0F1E]/80 px-3 py-1 text-xs text-[#F6F2E9] backdrop-blur">{L(ui.hint)}</span>
              ) : (
                <button key="reset" type="button" onClick={reset}
                  className="fade-in lv-ring pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#0A0F1E]/85 px-3 py-1.5 text-xs text-[#F6F2E9] backdrop-blur hover:bg-[#0A0F1E]">
                  <LandIcon name="maximize" size={13} /> {L(ui.fullMap)}
                </button>
              )}
            </div>
            <span className="pointer-events-none absolute bottom-2 end-2 rounded-md bg-[#0A0F1E]/70 px-2 py-1 text-[10px] text-[#F6F2E9]/80 backdrop-blur sm:text-xs">
              {L(ui.conceptLabel)}
            </span>
          </div>
        </div>

        {/* Panel: on a computer, a glass card over the map */}
        {isDesktop && sel && (
          <aside className="absolute end-6 top-6 z-40 w-[400px]">
            <div className="glass max-h-[80vh] overflow-y-auto rounded-3xl p-5 shadow-2xl">
              <div className="mb-3 flex justify-end">
                <button type="button" onClick={reset} aria-label={L(ui.close)} className="lv-ring rounded-full p-1.5 text-[#BDB5A3] hover:bg-[#1A2238] hover:text-[#F6F2E9]"><LandIcon name="x" size={18} /></button>
              </div>
              <div key={`${sel.kind}-${sel.id}`} className="panel-in">{panelBody}</div>
            </div>
          </aside>
        )}
      </div>
      {nothingSelected && <div className="glass mx-auto mt-6 min-w-0 max-w-3xl rounded-3xl p-5">{panelBody}</div>}
      {!isDesktop && !nothingSelected && <div aria-hidden="true" className="h-[60vh]" />}

      {!isDesktop && <BottomSheet open={!nothingSelected} onClose={reset} closeLabel={L(ui.close)}>{panelBody}</BottomSheet>}
    </div>
  );
}

/** The phone's panel: slides up from the bottom; drag the handle down to close. */
function BottomSheet({ open, onClose, children, closeLabel }: { open: boolean; onClose: () => void; children: React.ReactNode; closeLabel: string }) {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number } | null>(null);
  useEffect(() => { if (!open) setDy(0); }, [open]);
  if (!open) return null;
  const end = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s) return;
    const speed = (e.clientY - s.y) / Math.max(1, e.timeStamp - s.t); // px per ms
    if (dy > 90 || speed > 0.5) onClose(); else setDy(0);
  };
  return (
    <div role="dialog" aria-modal="false"
      className="sheet glass fixed inset-x-0 bottom-0 z-[60] flex max-h-[52vh] flex-col rounded-t-3xl shadow-2xl"
      style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: dragging ? 'none' : 'transform .25s ease' }}>
      <div className="flex touch-none items-center justify-between px-4 pb-1 pt-2"
        onPointerDown={e => { start.current = { y: e.clientY, t: e.timeStamp }; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { if (start.current) setDy(Math.max(0, e.clientY - start.current.y)); }}
        onPointerUp={end} onPointerCancel={end}>
        <span className="w-8" />
        <span className="h-1.5 w-12 rounded-full bg-[#BDB5A3]/40" />
        <button type="button" onPointerDown={e => e.stopPropagation()} onClick={onClose} aria-label={closeLabel} className="lv-ring rounded-full p-1.5 text-[#BDB5A3]"><LandIcon name="x" size={18} /></button>
      </div>
      <div className="overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>
    </div>
  );
}

function PartView({ p, lang, aud }: { p: Part; lang: Lang; aud: Audience | null }) {
  const L = (x: T) => x[lang];
  return (
    <div className="flex flex-col gap-4">
      <ConceptImage images={p.images} alt={L(p.title)} tint={p.tint} icon={p.icon} lang={lang} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${p.tint}33`, color: p.tint }}>
          <LandIcon name={p.icon} size={18} />
        </span>
        <span className="rounded-full px-3 py-1 text-xs" style={{ background: `${p.tint}26`, color: p.tint }}>{L(p.tag)}</span>
        <span className="flex items-center gap-1 rounded-full border border-[#E8C873]/40 px-3 py-1 text-xs text-[#E8C873]">
          <LandIcon name="mosque" size={13} /> {L(ui.hasMosque)}
        </span>
      </div>
      <h2 className="lv-display text-2xl font-semibold leading-snug">{L(p.title)}</h2>
      <p className="text-[15px] leading-8 text-[#BDB5A3]">{L(p.intro)}</p>
      <div className="grid grid-cols-2 gap-2">
        {audienceOrder.map(a => {
          const items = p.who[a];
          const hi = aud === a;
          return (
            <div key={a} className={`min-w-0 rounded-xl border p-3 transition-colors ${hi ? 'bg-[#1A2238]' : 'border-white/10 bg-[#0A0F1E]/40'} ${aud && !hi ? 'opacity-50' : ''}`}
              style={hi ? { borderColor: audiences[a].color } : undefined}>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: audiences[a].color }}>
                <span className="h-2 w-2 rounded-full" style={{ background: audiences[a].color }} />
                {L(audiences[a].label)}
              </div>
              <ul className="space-y-1 text-sm leading-6">
                {items.length ? items.map((it, i) => <li key={i}>{L(it)}</li>) : <li className="text-[#BDB5A3]">{L(ui.womenOnlyNote)}</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaceView({ p, lang, onPart }: { p: Place; lang: Lang; onPart: (id: string) => void }) {
  const L = (x: T) => x[lang];
  const part = p.part ? parts.find(q => q.id === p.part) : undefined;
  const tint = part?.tint ?? '#E8C873';
  return (
    <div className="flex flex-col gap-4">
      {p.images?.length ? <ConceptImage images={p.images} alt={L(p.title)} tint={tint} icon={p.icon} lang={lang} /> : null}
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F5C518]/15 text-[#F5C518]"><LandIcon name={p.icon} size={22} /></span>
      <h2 className="lv-display text-2xl font-semibold leading-snug">{L(p.title)}</h2>
      <p className="text-[15px] leading-8 text-[#BDB5A3]">{L(p.text)}</p>
      {part && (
        <button type="button" onClick={() => onPart(part.id)} className="lv-ring flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-[#1A2238]" style={{ borderColor: `${tint}80`, color: tint }}>
          <LandIcon name={part.icon} size={15} /> {L(ui.partOf)} {L(part.title)}
        </button>
      )}
    </div>
  );
}
