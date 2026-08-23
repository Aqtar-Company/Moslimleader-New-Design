'use client';
import { useRef, useState, useEffect } from 'react';
import MushafQCFPage from './MushafQCFPage';
import { TOTAL_QURAN_PAGES } from '@/lib/quran-data';

interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  autoFollow: boolean;
  onPageChange: (p: number) => void;
  onVerseClick?: (ch: number, v: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
}

/**
 * Three-page carousel for Mushaf reading mode.
 *
 * Layout (RTL Mushaf convention: swipe right = next page / higher number):
 *   Left slot  → page + 1 (next)  — slides in from left on drag-right
 *   Center     → page     (current)
 *   Right slot → page - 1 (prev)  — slides in from right on drag-left
 *
 * Adjacent pages are always mounted so their API calls go out immediately
 * (24 h browser cache means second visit is instant).
 */
export default function MushafCarousel({
  page: extPage,
  currentChapter, currentVerse, autoFollow,
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

  // Sync if audio/navigation changes page externally
  useEffect(() => { setPage(extPage); }, [extPage]);

  const prev = Math.max(1, page - 1);
  const next = Math.min(TOTAL_QURAN_PAGES, page + 1);

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

    // Rubber-band at edges
    const atEdge = (dx > 0 && page >= TOTAL_QURAN_PAGES) || (dx < 0 && page <= 1);
    setDragX(dx * (atEdge ? 0.18 : 1));
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
      }, 300);
    }

    if (dragX > THRESH && page < TOTAL_QURAN_PAGES) {
      // Swipe right → next page
      commit(next, w);
    } else if (dragX < -THRESH && page > 1) {
      // Swipe left → prev page
      commit(prev, -w);
    } else {
      // Snap back
      setAnimated(true);
      setDragX(0);
      setTimeout(() => setAnimated(false), 300);
    }
  }

  const tr = animated ? 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';
  const s = (x: string) => ({ position: 'absolute' as const, inset: 0, transform: `translateX(${x})`, transition: tr, willChange: 'transform' });

  return (
    <div
      ref={ctnRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ position: 'relative', flex: 1, overflow: 'hidden', touchAction: 'pan-y' }}
    >
      {/* Next page — left of center, revealed by swiping right */}
      <div style={s(`calc(-100% + ${dragX}px)`)}>
        <MushafQCFPage page={next} currentChapter={currentChapter} currentVerse={currentVerse} autoFollow={false} />
      </div>

      {/* Current page — center */}
      <div style={s(`${dragX}px`)}>
        <MushafQCFPage
          page={page}
          currentChapter={currentChapter}
          currentVerse={currentVerse}
          autoFollow={autoFollow}
          onVerseClick={onVerseClick}
          onAyahTap={onAyahTap}
        />
      </div>

      {/* Prev page — right of center, revealed by swiping left */}
      <div style={s(`calc(100% + ${dragX}px)`)}>
        <MushafQCFPage page={prev} currentChapter={currentChapter} currentVerse={currentVerse} autoFollow={false} />
      </div>
    </div>
  );
}
