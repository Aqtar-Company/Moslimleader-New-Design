export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import AppealClient from './AppealClient';
export const metadata: Metadata = { title: 'حالة الحساب — طريق' };
export default function TareeqAppealPage() { return <AppealClient />; }
