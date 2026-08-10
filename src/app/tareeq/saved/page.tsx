import { Suspense } from 'react';
import TareeqSavedClient from './TareeqSavedClient';

export default function TareeqSavedPage() {
  return (
    <Suspense>
      <TareeqSavedClient />
    </Suspense>
  );
}
