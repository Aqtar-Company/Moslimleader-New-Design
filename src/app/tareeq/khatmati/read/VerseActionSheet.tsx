'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SURAH_NAMES_AR } from '@/lib/quran-data';

export interface TappedVerse { chapterId: number; verseNumber: number; text: string; }

interface Props { verse: TappedVerse; onClose: () => void; onListen?: () => void; }

// The hardcoded id here was wrong (returned English Ibn Kathir tafsir instead
// of Arabic "التفسير الميسر") — resolved dynamically instead of guessing
// another number: fetch the tafsir resource list once, find the entry whose
// name contains "الميسر", and cache its real id for the rest of the session.
const MUYASSAR_ID_FALLBACK = 169;
let _muyassarIdPromise: Promise<number> | null = null;
function resolveMuyassarTafsirId(): Promise<number> {
  if (_muyassarIdPromise) return _muyassarIdPromise;
  _muyassarIdPromise = fetch('https://api.qurancdn.com/api/qdc/resources/tafsirs?locale=ar')
    .then(r => r.json())
    .then((data: unknown) => {
      const list: unknown[] = (data as { tafsirs?: unknown[]; data?: unknown[] })?.tafsirs
        ?? (data as { tafsirs?: unknown[]; data?: unknown[] })?.data
        ?? [];
      for (const entry of list) {
        if (JSON.stringify(entry).includes('الميسر')) {
          const id = (entry as { id?: unknown })?.id;
          if (typeof id === 'number') return id;
        }
      }
      return MUYASSAR_ID_FALLBACK;
    })
    .catch(() => MUYASSAR_ID_FALLBACK);
  return _muyassarIdPromise;
}
const QF = '"Amiri Quran","Scheherazade New","Traditional Arabic",serif';
const AF = '"Amiri","Scheherazade New",serif';

function toE(n: number) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export default function VerseActionSheet({ verse, onClose, onListen }: Props) {
  const [view, setView] = useState<'menu' | 'tafsir' | 'card'>('menu');
  const [tafsir, setTafsir] = useState('');
  const [tafsirFailed, setTafsirFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);

  const surahName = SURAH_NAMES_AR[verse.chapterId - 1] ?? '';
  const verseKey = `${verse.chapterId}:${verse.verseNumber}`;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function fetchTafsir(): Promise<{ text: string; failed: boolean }> {
    if (tafsir && !tafsirFailed) return { text: tafsir, failed: false };
    setLoading(true);
    try {
      const tafsirId = await resolveMuyassarTafsirId();
      const res = await fetch(`https://api.qurancdn.com/api/qdc/tafsirs/${tafsirId}/by_ayah/${verseKey}`);
      const data = await res.json();
      const html: string = data?.tafsir?.text ?? data?.data?.tafsir?.text ?? '';
      const stripped = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (!stripped) throw new Error('empty tafsir');
      setTafsir(stripped);
      setTafsirFailed(false);
      return { text: stripped, failed: false };
    } catch {
      const fb = 'تعذّر تحميل التفسير، تحقق من الاتصال.';
      setTafsir(fb);
      setTafsirFailed(true);
      return { text: fb, failed: true };
    } finally { setLoading(false); }
  }

  async function openTafsir() {
    setView('tafsir');
    await fetchTafsir();
  }

  async function openCard() {
    setView('tafsir'); setLoading(true);
    const { text, failed } = await fetchTafsir();
    await buildCard(failed ? '' : text);
    setView('card');
  }

  async function buildCard(tafsirText: string) {
    await document.fonts.ready;
    try { await document.fonts.load(`42px "Amiri Quran"`); } catch {}
    try { await document.fonts.load(`bold 38px "Amiri"`); } catch {}

    const W = 900, H = 1240;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!;
    ctx.direction = 'rtl'; ctx.textAlign = 'center';

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0C1924'); bg.addColorStop(0.6, '#0f2230'); bg.addColorStop(1, '#070D17');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Subtle texture stripes
    ctx.strokeStyle = 'rgba(255,255,255,0.018)'; ctx.lineWidth = 1;
    for (let i = 0; i < H; i += 18) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

    // Outer border
    ctx.strokeStyle = 'rgba(255,204,51,0.28)'; ctx.lineWidth = 2;
    rRect(ctx, 26, 26, W - 52, H - 52, 18); ctx.stroke();
    // Inner border
    ctx.strokeStyle = 'rgba(255,204,51,0.10)'; ctx.lineWidth = 1;
    rRect(ctx, 36, 36, W - 72, H - 72, 12); ctx.stroke();

    // Corner ornaments
    const corners = [[52, 52], [W - 52, 52], [52, H - 52], [W - 52, H - 52]] as const;
    ctx.fillStyle = 'rgba(255,204,51,0.35)';
    for (const [cx, cy] of corners) {
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Surah name
    ctx.font = `bold 38px ${AF}`; ctx.fillStyle = '#FFCC33';
    ctx.fillText(`سورة ${surahName}`, W / 2, 118);

    // Ayah number
    ctx.font = `22px ${AF}`; ctx.fillStyle = 'rgba(255,204,51,0.55)';
    ctx.fillText(`الآية ${toE(verse.verseNumber)}`, W / 2, 158);

    // Divider
    const gd = ctx.createLinearGradient(120, 0, W - 120, 0);
    gd.addColorStop(0, 'transparent'); gd.addColorStop(0.3, 'rgba(255,204,51,0.45)');
    gd.addColorStop(0.7, 'rgba(255,204,51,0.45)'); gd.addColorStop(1, 'transparent');
    ctx.fillStyle = gd; ctx.fillRect(120, 176, W - 240, 1.5);

    // Verse text
    ctx.font = `42px ${QF}`; ctx.fillStyle = '#FFFFFF';
    const vLines = wrapText(ctx, verse.text, 820);
    let y = 236;
    for (const line of vLines) { ctx.fillText(line, W / 2, y); y += 72; }

    // End ornament
    ctx.font = `26px ${AF}`; ctx.fillStyle = 'rgba(200,168,75,0.5)';
    ctx.fillText('۩', W / 2, y + 14); y += 56;

    // Tafsir section — omitted entirely (not a fabricated error message
    // baked into the shareable image) when it failed to load.
    if (tafsirText) {
      // Mid divider
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(76, y, W - 152, 1);
      y += 34;

      // Tafsir label
      ctx.font = `bold 21px ${AF}`; ctx.fillStyle = 'rgba(255,204,51,0.5)';
      ctx.fillText('التفسير الميسَّر', W / 2, y); y += 36;

      // Tafsir text
      ctx.font = `26px ${AF}`; ctx.fillStyle = 'rgba(255,255,255,0.70)';
      const tLines = wrapText(ctx, tafsirText, 800);
      for (const line of tLines) {
        if (y > H - 110) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillText('...', W / 2, y); break; }
        ctx.fillText(line, W / 2, y); y += 46;
      }
    }

    // Brand
    ctx.font = `17px ${AF}`; ctx.fillStyle = 'rgba(255,204,51,0.28)';
    ctx.fillText('مسلم ليدر • Moslimleader', W / 2, H - 46);

    setCardUrl(cv.toDataURL('image/png'));
  }

  async function handleShare() {
    if (!cardUrl) return;
    try {
      const blob = await (await fetch(cardUrl)).blob();
      const file = new File([blob], `ayah-${verseKey}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${surahName} ﴿${verse.verseNumber}﴾` });
      } else if (navigator.share) {
        await navigator.share({ title: `${surahName} ﴿${verse.verseNumber}﴾`, text: verse.text });
      }
    } catch { /* cancelled */ }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 9998, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(165deg, #0F2749 0%, #0A1B33 55%, #081428 100%)',
        borderRadius: '24px 24px 0 0',
        width: '100%', maxWidth: 620,
        maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(96,165,250,0.18)',
        borderBottom: 'none',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        {/* Handle */}
        <div style={{ flexShrink: 0, paddingTop: 12, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Surah + verse label */}
        <div style={{ padding: '12px 20px 0', textAlign: 'center', flexShrink: 0 }}>
          <p style={{ fontFamily: AF, fontWeight: 700, fontSize: 17, color: '#FFCC33', margin: 0, letterSpacing: 0.2 }}>
            {surahName} ﴿{toE(verse.verseNumber)}﴾
          </p>
          <div style={{
            width: 64, height: 2, margin: '10px auto 0', borderRadius: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,204,51,0.5), transparent)',
          }} />
        </div>

        {/* ── MENU ── */}
        {view === 'menu' && (
          <div style={{ padding: '20px 20px 44px', display: 'flex', gap: 12 }}>
            <button onClick={() => { onListen?.(); onClose(); }} style={{
              flex: 1, padding: '18px 0 15px', borderRadius: 18,
              background: 'linear-gradient(160deg, rgba(96,165,250,0.16), rgba(37,99,235,0.06))',
              border: '1px solid rgba(96,165,250,0.35)',
              color: '#bfdbfe', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              fontFamily: AF, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'transform .15s',
            }}>
              <span style={{
                width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #1e3a6e, #2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.45)',
              }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5v14l11-7z"/>
                </svg>
              </span>
              استماع
            </button>
            <button onClick={openTafsir} style={{
              flex: 1, padding: '18px 0 15px', borderRadius: 18,
              background: 'linear-gradient(160deg, rgba(255,204,51,0.14), rgba(255,204,51,0.04))',
              border: '1px solid rgba(255,204,51,0.32)',
              color: '#FFCC33', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              fontFamily: AF, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'transform .15s',
            }}>
              <span style={{
                width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #FFCC33, #E8A800)', boxShadow: '0 4px 14px rgba(255,204,51,0.4)',
              }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#081320" strokeWidth={1.9}>
                  <path strokeLinecap="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25"/>
                </svg>
              </span>
              تفسير
            </button>
            <button onClick={openCard} style={{
              flex: 1, padding: '18px 0 15px', borderRadius: 18,
              background: 'linear-gradient(160deg, rgba(52,211,153,0.16), rgba(16,185,129,0.05))',
              border: '1px solid rgba(52,211,153,0.32)',
              color: '#86efac', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              fontFamily: AF, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'transform .15s',
            }}>
              <span style={{
                width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
              }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/>
                </svg>
              </span>
              مشاركة
            </button>
          </div>
        )}

        {/* ── TAFSIR ── */}
        {view === 'tafsir' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 36px', direction: 'rtl' }}>
            {/* Verse text */}
            <p style={{ fontFamily: QF, fontSize: 22, lineHeight: 2.4, color: '#F0EDE4', textAlign: 'justify', marginBottom: 18 }}>
              {verse.text}
            </p>
            <div style={{ height: 1, background: 'rgba(255,204,51,0.2)', marginBottom: 14 }} />
            <p style={{ fontFamily: AF, fontSize: 12, color: 'rgba(255,204,51,0.55)', marginBottom: 10 }}>التفسير الميسَّر</p>
            {loading ? (
              <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 24, fontFamily: AF }}>جاري التحميل...</p>
            ) : (
              <p style={{ fontFamily: AF, fontSize: 17, lineHeight: 2.1, color: 'rgba(255,255,255,0.82)', textAlign: 'justify' }}>
                {tafsir}
              </p>
            )}
            {!loading && tafsir && !tafsirFailed && (
              <button onClick={openCard} style={{
                width: '100%', marginTop: 20, padding: '13px 0', borderRadius: 13,
                background: '#FFCC33', color: '#081320', fontWeight: 700, fontSize: 15,
                border: 'none', cursor: 'pointer', fontFamily: AF,
              }}>
                إنشاء بطاقة ✦
              </button>
            )}
          </div>
        )}

        {/* ── CARD ── */}
        {view === 'card' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            {cardUrl
              ? <img src={cardUrl} alt="بطاقة الآية" style={{ width: '100%', borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }} />
              : <p style={{ color: 'rgba(255,255,255,0.4)', padding: 40 }}>جاري التوليد...</p>
            }
            {cardUrl && (
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button onClick={() => {
                  const a = document.createElement('a'); a.href = cardUrl!;
                  a.download = `ayah-${verseKey}.png`; a.click();
                }} style={{
                  flex: 1, padding: '13px 0', borderRadius: 12,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: AF,
                }}>
                  حفظ
                </button>
                <button onClick={handleShare} style={{
                  flex: 1, padding: '13px 0', borderRadius: 12,
                  background: '#FFCC33', border: 'none',
                  color: '#081320', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: AF,
                }}>
                  مشاركة
                </button>
              </div>
            )}
          </div>
        )}

        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, left: 16,
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4,
        }}>×</button>
      </div>
    </div>,
    document.body
  );
}
