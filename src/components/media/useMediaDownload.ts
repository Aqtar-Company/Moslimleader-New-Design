'use client';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useLang } from '@/context/LanguageContext';

/**
 * One download behaviour for every button that offers it (the item page, the cards in the
 * grid): a member gets the file; a visitor is taken to create a free account and brought
 * straight back to the item.
 */
export function useMediaDownload() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const { lang } = useLang();
  const isEn = lang === 'en';

  return useCallback((id: number) => {
    if (!user) {
      addToast(isEn ? 'Create a free account to download — you will come right back' : 'أنشئ حساباً مجانياً لتحميل الملف — ثم ترجع هنا تلقائياً', 'info', 4500);
      router.push(`/login?mode=signup&redirect=${encodeURIComponent(`/media/${id}`)}`);
      return;
    }
    window.location.href = `/api/media/${id}/download`;
  }, [user, addToast, router, isEn]);
}
