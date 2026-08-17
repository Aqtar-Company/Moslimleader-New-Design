'use client';
import { usePathname } from 'next/navigation';

export default function TareeqContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  // نُوري pages are full-screen with their own layout — no bottom nav padding needed
  const isNuri = pathname.startsWith('/tareeq/khatmati');
  return (
    <div className={isNuri ? 'relative' : 'relative pb-[60px] sm:pb-0'}>
      {children}
    </div>
  );
}
