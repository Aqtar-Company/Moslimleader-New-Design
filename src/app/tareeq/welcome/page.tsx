export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import WelcomeClient from './WelcomeClient';

export const metadata: Metadata = {
  title: 'ابدأ في طريق',
  description: 'اختر ما يهمّك، وتابع من يكتب فيه',
};

export default function TareeqWelcomePage() {
  return <WelcomeClient />;
}
