'use client';
import Icon from '@/components/media/Icon';
import { AUD, WHO_ORDER, type District, type L, type Who } from './data';

export function Concept({ isEn }: { isEn: boolean }) {
  return (
    <span className="absolute top-3 start-3 z-10 rounded-full px-3 py-1 text-[11px] font-bold glass text-white">
      {isEn ? 'Concept visual' : 'تصوّر مبدئي'}
    </span>
  );
}

export function Dot({ w, size = 8 }: { w: Who; size?: number }) {
  return <span className="shrink-0 rounded-full inline-block" style={{ width: size, height: size, background: AUD[w].dot }} aria-hidden />;
}

/** Drawn art for a district that has no picture yet: its mark, large, over its own hue. */
export function Art({ d }: { d: District }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(120% 90% at 80% 10%, ${d.hue}55 0%, transparent 55%), linear-gradient(160deg, #18224A 0%, #0A0F1E 100%)` }}>
      <div className="absolute inset-0 grain opacity-60" aria-hidden />
      <div className="absolute -bottom-10 -start-10 w-[70%] aspect-square rounded-full border" style={{ borderColor: `${d.hue}55` }} aria-hidden />
      <div className="absolute -bottom-24 -start-24 w-[95%] aspect-square rounded-full border" style={{ borderColor: `${d.hue}30` }} aria-hidden />
      <span className="absolute top-[16%] end-[12%] text-white/90" aria-hidden style={{ filter: `drop-shadow(0 0 30px ${d.hue})` }}>
        <Icon name={d.icon} size={110} strokeWidth={1} />
      </span>
    </div>
  );
}

/** What a district offers each audience — the four lanes, in one compact block. */
export function WhoGrid({ d, isEn, dark = true, focus = null }: { d: District; isEn: boolean; dark?: boolean; focus?: Who | null }) {
  const L = (l: L) => (isEn ? l.en : l.ar);
  return (
    <div className="grid grid-cols-2 gap-2">
      {WHO_ORDER.map(w => {
        const items = d.who[w];
        const empty = items.length === 0;
        return (
          <div
            key={w}
            className={`rounded-2xl p-3 transition ${dark ? 'bg-white/[0.06]' : 'bg-white'} ${empty ? 'opacity-60' : ''} ${focus && focus !== w ? 'opacity-40' : ''}`}
            style={focus === w ? { boxShadow: `inset 0 0 0 2px ${AUD[w].dot}` } : undefined}
          >
            <p className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: AUD[w].dot }}>
              <Dot w={w} /> {isEn ? AUD[w].en : AUD[w].ar}
            </p>
            {empty ? (
              <p className={`mt-1 text-[13px] ${dark ? 'text-white/60' : 'text-[#5C6478]'}`}>
                {d.onlyFor ? (isEn ? `${AUD[d.onlyFor].en} only` : `خاص ${AUD[d.onlyFor].ar.replace('لل', 'بال')}`) : '—'}
              </p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {items.map(it => <li key={it.ar} className="text-[13px] font-semibold leading-snug">{L(it)}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

