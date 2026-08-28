'use client';
import { useRef, useState, useEffect } from 'react';
import MushafQCFPage from './MushafQCFPage';
import { prepareMushafPage } from './mushafCache';
import { TOTAL_QURAN_PAGES } from '@/lib/quran-data';

interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  autoFollow: boolean;
  isPlaying?: boolean;
  onPageChange: (p: number) => void;
  onVerseClick?: (ch: number, v: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
}

/**
 * Three-page swipe carousel — RTL Mushaf convention.
 *
 * Slot layout:
 *   Left  → page+1 (next)   — slides in from left when swiping right
 *   Center → page    (current)
 *   Right → page-1 (prev)  — slides in from right when swiping left
 *
 * ZERO-LOADING guarantee for normal swipes:
 *   All three slots are always mounted (data pre-fetched).
 *   Additionally we eagerly pre-warm page+2 and page-2 via the module-level
 *   cache so the page after next is already in cache before the user lifts
 *   their finger from the first swipe.
 *
 *   MushafQCFPage reads the cache synchronously in render — if data is there
 *   it renders immediately without a loading state.
 */
export default function MushafCarousel({
  page: extPage,
  currentChapter, currentVerse, autoFollow, isPlaying,
  onPageChange, onVerseClick, onAyahTap,
}: Props) {
  const [page, setPage] = useState(extPage);
  const [dragX, setDragX] = useState(0);
  const [animated, setAnimated] = useState(false);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHoriz = useRef<boolean | null>(null);
  const ctnRef = useRef<HTMLDivElement>(null);

  /* Sync when audio/navigation changes page externally */
  useEffect(() => { setPage(extPage); }, [extPage]);

  const prev = Math.max(1, page - 1);
  const next = Math.min(TOTAL_QURAN_PAGES, page + 1);

  /* Eagerly pre-fetch adjacent page JSON so swipe is always loader-free */
  useEffect(() => {
    prepareMushafPage(prev);
    prepareMushafPage(next);
    prepareMushafPage(prev - 1);
    prepareMushafPage(next + 1);
    prepareMushafPage(next + 2);
  }, [prev, next]);

  function getW() { return ctnRef.current?.offsetWidth ?? 390; }

  function onTouchStart(e: React.TouchEvent) {
    if (animated) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHoriz.current = null;
    isDragging.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging.current || animated) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHoriz.current === null) {
      isHoriz.current = Math.abs(dx) > Math.abs(dy) * 1.3;
    }
    if (!isHoriz.current) { isDragging.current = false; return; }

    e.preventDefault();

    /* Rubber-band at boundaries */
    const atEdge = (dx > 0 && page >= TOTAL_QURAN_PAGES) || (dx < 0 && page <= 1);
    setDragX(dx * (atEdge ? 0.15 : 1));
  }

  function onTouchEnd() {
    if (!isDragging.current) return;
    isDragging.current = false;

    const w = getW();
    const THRESH = w * 0.28;

    function commit(newPage: number, targetX: number) {
      setAnimated(true);
      setDragX(targetX);
      setTimeout(() => {
        setAnimated(false);
        setDragX(0);
        setPage(newPage);
        onPageChange(newPage);
      }, 280);
    }

    if (dragX > THRESH && page < TOTAL_QURAN_PAGES) {
      commit(next, w);
    } else if (dragX < -THRESH && page > 1) {
      commit(prev, -w);
    } else {
      setAnimated(true);
      setDragX(0);
      setTimeout(() => setAnimated(false), 280);
    }
  }

  const tr = animated ? 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';

  /* Each slot fills the full carousel area exactly */
  const slot = (x: string): React.CSSProperties => ({
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    transform: `translateX(${x})`,
    transition: tr,
    willChange: 'transform',
  });

  return (
    <div
      ref={ctnRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'relative',
        flex: 1,
        width: '100%',
        /*
         * overflow:hidden clips all three slots so the off-screen pages
         * never bleed a grey sliver into the visible area.
         */
        overflow: 'hidden',
        touchAction: 'pan-y',
        /* Use same sepia background so any sub-pixel gap never shows grey */
        background: '#F8EBD5',
      }}
    >
      {/* next page — left of center */}
      <div style={slot(`calc(-100% + ${dragX}px)`)}>
        <MushafQCFPage
          page={next}
          currentChapter={currentChapter}
          currentVerse={currentVerse}
          isPlaying={false}
          autoFollow={false}
        />
      </div>

      {/* current page — center */}
      <div style={slot(`${dragX}px`)}>
        <MushafQCFPage
          page={page}
          currentChapter={currentChapter}
          currentVerse={currentVerse}
          isPlaying={isPlaying}
          autoFollow={autoFollow}
          onVerseClick={onVerseClick}
          onAyahTap={onAyahTap}
        />
      </div>

      {/* prev page — right of center */}
      <div style={slot(`calc(100% + ${dragX}px)`)}>
        <MushafQCFPage
          page={prev}
          currentChapter={currentChapter}
          currentVerse={currentVerse}
          isPlaying={false}
          autoFollow={false}
        />
      </div>
    </div>
  );
}
