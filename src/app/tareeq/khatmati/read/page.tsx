import { Suspense } from 'react';
import QuranReader from './QuranReader';

export const dynamic = 'force-dynamic';

export default function ReadPage({ searchParams }: { searchParams: { page?: string; surah?: string; ayah?: string; groupId?: string } }) {
  const page    = Math.max(1, Math.min(604, parseInt(searchParams.page  ?? '1', 10) || 1));
  const surah   = Math.max(1, Math.min(114, parseInt(searchParams.surah ?? '1', 10) || 1));
  const ayah    = Math.max(1, Math.min(286, parseInt(searchParams.ayah ?? '1', 10) || 1));
  const groupId = searchParams.groupId ?? null;
  return (
    <Suspense>
      <QuranReader initialPage={page} initialSurah={surah} initialAyah={ayah} groupId={groupId} />
    </Suspense>
  );
}
