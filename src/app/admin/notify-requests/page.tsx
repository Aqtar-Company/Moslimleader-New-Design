'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';

interface NotifyRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notified: boolean;
  notifiedAt: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    images: string[];
  };
}

interface ProductGroup {
  product: NotifyRow['product'];
  rows: NotifyRow[];
  pending: number;
}

export default function NotifyRequestsPage() {
  const { addToast } = useToast();
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'notified'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notify-requests', { credentials: 'include' });
      const data = await res.json();
      const rows: NotifyRow[] = data.requests ?? [];

      // Group by product
      const map = new Map<string, ProductGroup>();
      for (const r of rows) {
        if (!map.has(r.product.id)) {
          map.set(r.product.id, { product: r.product, rows: [], pending: 0 });
        }
        const g = map.get(r.product.id)!;
        g.rows.push(r);
        if (!r.notified) g.pending++;
      }
      setGroups(Array.from(map.values()).sort((a, b) => b.pending - a.pending));
    } catch {
      addToast('فشل تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const sendNotifications = async (productId: string, productName: string) => {
    setSending(productId);
    try {
      const res = await fetch(`/api/admin/notify-requests/${productId}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الإرسال');
      addToast(`تم إرسال الإشعار لـ ${data.sent} مشترك في "${productName}"`, 'success');
      await load();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الإرسال', 'error');
    } finally {
      setSending(null);
    }
  };

  const totalPending = groups.reduce((s, g) => s + g.pending, 0);
  const totalAll = groups.reduce((s, g) => s + g.rows.length, 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">طلبات الإشعار</h1>
          <p className="text-sm text-gray-500 mt-1">
            مشتركون يريدون إشعاراً عند توفر منتجات &quot;قريباً&quot;
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalPending > 0 && (
            <span className="bg-orange-100 text-orange-700 text-sm font-bold px-3 py-1 rounded-full">
              {totalPending} طلب معلق
            </span>
          )}
          <span className="bg-gray-100 text-gray-600 text-sm font-semibold px-3 py-1 rounded-full">
            {totalAll} إجمالي
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        {(['pending', 'all', 'notified'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition ${
              filter === f
                ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-[1px]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'pending' ? 'المعلقة' : f === 'notified' ? 'المُرسلة' : 'الكل'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">جارٍ التحميل...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-gray-500 font-semibold">لا توجد طلبات إشعار حتى الآن</p>
          <p className="text-sm text-gray-400 mt-1">
            فعّل &quot;قريباً&quot; على أي منتج لتبدأ بتجميع الطلبات
          </p>
          <Link href="/admin/products" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            إدارة المنتجات
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => {
            const visibleRows = group.rows.filter(r => {
              if (filter === 'pending') return !r.notified;
              if (filter === 'notified') return r.notified;
              return true;
            });
            if (visibleRows.length === 0) return null;
            const image = group.product.images?.[0];

            return (
              <div key={group.product.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {/* Product header */}
                <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    {image ? (
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                        <Image src={image} alt={group.product.name} fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center shrink-0 text-xl">📦</div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{group.product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{group.rows.length} مشترك</span>
                        {group.pending > 0 && (
                          <span className="bg-orange-100 text-orange-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
                            {group.pending} معلق
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/shop/${group.product.slug}`}
                      target="_blank"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      عرض المنتج ↗
                    </Link>
                    {group.pending > 0 && (
                      <button
                        onClick={() => sendNotifications(group.product.id, group.product.name)}
                        disabled={sending === group.product.id}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
                      >
                        {sending === group.product.id ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            جارٍ الإرسال...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            إرسال الإشعار ({group.pending})
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Subscribers table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">الاسم</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">البريد الإلكتروني</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">واتساب</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">التاريخ</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-gray-500 text-xs">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(row => (
                        <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{row.name || <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3">
                            {row.email ? (
                              <a href={`mailto:${row.email}`} className="text-blue-600 hover:underline">{row.email}</a>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {row.phone ? (
                              <a
                                href={`https://wa.me/${row.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-green-600 hover:underline flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                {row.phone}
                              </a>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.notified ? (
                              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                أُبلغ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-[11px] font-bold px-2.5 py-1 rounded-full">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                                </svg>
                                معلق
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
