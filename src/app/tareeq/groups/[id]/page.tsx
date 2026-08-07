import { Metadata } from 'next';
import TareeqGroupClient from './TareeqGroupClient';

export const metadata: Metadata = { title: 'مجموعة | طريق' };

export default function TareeqGroupPage({ params }: { params: { id: string } }) {
  return <TareeqGroupClient groupId={params.id} />;
}
