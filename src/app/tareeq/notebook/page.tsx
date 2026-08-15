import { Suspense } from 'react';
import TareeqNotebookClient from './TareeqNotebookClient';

export default function TareeqNotebookPage() {
  return (
    <Suspense>
      <TareeqNotebookClient />
    </Suspense>
  );
}
