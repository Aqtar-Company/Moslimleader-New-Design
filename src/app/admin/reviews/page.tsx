'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAllReviews, deleteReview, getAddedProducts, AdminReview } from '@/lib/admin-storage';
import { products as staticProducts } from '@/lib/products';

const STARS = [1, 2, 3, 4, 5];

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [filterRating, setFilterRating] = useState(0);

  const load = useCallback(() => {
    const added = getAddedProducts();
    const allProds = [
      ...staticProducts.map(p => ({ id: p.id, name: p.name, reviews: p.reviews })),
      ...added.map(p => ({ id: p.id, name: p.name, reviews: p.reviews })),
    ];
    setReviews(getAllReviews(allProds));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (r: AdminReview) => {
    if (!confirm(`حذف تقييم "${r.author}"؟`)) return;
    deleteReview(r.productId, r.id);
    load();
  };

  const filtered = filterRating === 0 ? reviews : reviews.filter(r => r.rating === filterRating);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">التقييمات</h1>
        <p className="text-sm text-gray-500 mt-0.5">{reviews.length} تقييم — متوسط: ⭐ {avgRating}</p>
      </div>

      {/* Filter by stars */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterRating(0)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
            filterRating === 0 ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'
          }`}
        >
          الكل ({reviews.length})
        </button>
        {STARS.slice().reverse().map(s => {
          const count = reviews.filter(r => r.rating === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilterRating(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                filterRating === s ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {'⭐'.repeat(s)} ({count})
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">⭐</p>
            <p className="font-semibold">لا توجد تقييمات</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(r => (
              <div key={`${r.productId}-${r.id}`} className="px-5 py-4 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-gray-900 text-sm">{r.author}</span>
                      <span className="text-yellow-500 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      <span className="text-xs text-gray-400">{r.date}</span>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed mb-1">{r.comment}</p>
                    <p className="text-xs text-gray-400">المنتج: <span className="font-semibold text-gray-600">{r.productName}</span></p>
                  </div>
                  <button
                    onClick={() => handleDelete(r)}
                    className="text-red-400 hover:text-red-600 text-xs font-bold shrink-0 hover:bg-red-50 px-2 py-1 rounded-lg transition"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
