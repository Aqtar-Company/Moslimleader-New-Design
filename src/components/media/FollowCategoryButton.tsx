'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import Icon from './Icon';

/**
 * «تابع التصنيف»: a new item on this shelf reaches the member in طريق (the bell, and a
 * push if they allowed them). The followed ids are read once per page and shared by every
 * instance through a module-level promise — switching chips must not refetch.
 */
let followsPromise: Promise<Set<number>> | null = null;
function loadFollows(): Promise<Set<number>> {
  if (!followsPromise) {
    followsPromise = fetch('/api/media/categories/follows', { signal: AbortSignal.timeout(10_000) })
      .then(r => (r.ok ? r.json() : { ids: [] }))
      .then(d => new Set<number>(Array.isArray(d.ids) ? d.ids : []))
      .catch(() => { followsPromise = null; return new Set<number>(); });
  }
  return followsPromise;
}

export default function FollowCategoryButton({ categoryId, isEn }: { categoryId: number; isEn: boolean }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const t = (ar: string, en: string) => (isEn ? en : ar);

  useEffect(() => {
    if (!user) { setFollowing(false); return; }
    let live = true;
    void loadFollows().then(set => { if (live) setFollowing(set.has(categoryId)); });
    return () => { live = false; };
  }, [user, categoryId]);

  const toggle = async () => {
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    if (busy || following === null) return;
    const next = !following;
    setBusy(true); setFollowing(next);
    try {
      const res = await fetch(`/api/media/categories/${categoryId}/follow`, { method: next ? 'POST' : 'DELETE', signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error();
      const set = await loadFollows();
      if (next) set.add(categoryId); else set.delete(categoryId);
      addToast(next ? t('ستصلك الجديدة في إشعارات طريق', 'New items will reach you in Tareeq notifications') : t('ألغيت المتابعة', 'Unfollowed'), 'success');
    } catch {
      setFollowing(!next);
      addToast(t('تعذّر التغيير — حاول مرة أخرى', 'Could not change — try again'), 'error');
    } finally { setBusy(false); }
  };

  const on = !!following;
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={on}
      title={on ? t('إلغاء متابعة التصنيف', 'Unfollow this shelf') : t('يصلك كل جديد فيه على طريق', 'Get every new item on Tareeq')}
      className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${on ? 'bg-[#F5C518] text-[#1a1a2e]' : 'border border-[#1a1a2e]/20 text-[#1a1a2e] hover:bg-[#EFEBE2]'}`}
    >
      <Icon name={on ? 'bell-on' : 'bell'} size={16} />
      <span>{on ? t("تتابعه", "Following") : t("تابع التصنيف", "Follow")}</span>
    </button>
  );
}
