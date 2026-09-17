import { Suspense } from 'react';
import TareeqNoticeClient from './TareeqNoticeClient';

export const dynamic = 'force-dynamic';

export default function TareeqNoticePage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <TareeqNoticeClient id={params.id} />
    </Suspense>
  );
}
