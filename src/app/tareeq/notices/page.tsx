import { Suspense } from 'react';
import TareeqNoticesClient from './TareeqNoticesClient';

export const dynamic = 'force-dynamic';

export default function TareeqNoticesPage() {
  return (
    <Suspense>
      <TareeqNoticesClient />
    </Suspense>
  );
}
