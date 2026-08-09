'use client';

import { useEffect, useState, useCallback } from 'react';

interface PendingMessage {
  id: string;
  message: string;
  createdAt: string;
  copy: { code: string; product: { name: string } };
}

interface PendingMedia {
  id: string;
  mediaUrl: string;
  createdAt: string;
  copy: { code: string; product: { name: string } };
}

interface PendingContent {
  messages: PendingMessage[];
  media: PendingMedia[];
}

export default function AdminImpactContentPage() {
  const [content, setContent] = useState<PendingContent>({ messages: [], media: [] });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/impact-content');
    if (res.ok) { const d = await res.json(); setContent(d); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const moderate = async (type: 'message' | 'media', id: string, action: 'approve' | 'reject') => {
    setWorking(id);
    const res = await fetch(`/api/admin/impact-content/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, action }),
    });
    if (res.ok) { await load(); }
    setWorking(null);
  };

  const total = content.messages.length + content.media.length;

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مراجعة محتوى الأثر</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? '...' : total === 0 ? 'لا يوجد محتوى معلق' : `${total} عنصر بانتظار المراجعة`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400">جاري التحميل...</div>
      ) : total === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center text-green-700">
          تم مراجعة كل المحتوى — لا يوجد عناصر معلقة
        </div>
      ) : (
        <div className="space-y-6">
          {/* Messages */}
          {content.messages.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-800">رسائل الشكر ({content.messages.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {content.messages.map(m => (
                  <div key={m.id} className="p-5 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-blue-600">{m.copy.code}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{m.copy.product.name}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <blockquote className="text-sm text-gray-700 bg-yellow-50 border-r-4 border-yellow-300 p-3 rounded-lg italic">
                        &ldquo;{m.message}&rdquo;
                      </blockquote>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => moderate('message', m.id, 'approve')}
                        disabled={working === m.id}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-green-700 disabled:opacity-50"
                      >
                        {working === m.id ? '...' : 'موافقة'}
                      </button>
                      <button
                        onClick={() => moderate('message', m.id, 'reject')}
                        disabled={working === m.id}
                        className="border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
                      >
                        رفض
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Media */}
          {content.media.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-800">صور الاستلام ({content.media.length})</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                {content.media.map(med => (
                  <div key={med.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-mono text-blue-600">{med.copy.code}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{med.copy.product.name}</span>
                    </div>
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={med.mediaUrl}
                        alt="صورة الاستلام"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => moderate('media', med.id, 'approve')}
                        disabled={working === med.id}
                        className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs hover:bg-green-700 disabled:opacity-50"
                      >
                        {working === med.id ? '...' : 'موافقة'}
                      </button>
                      <button
                        onClick={() => moderate('media', med.id, 'reject')}
                        disabled={working === med.id}
                        className="flex-1 border border-red-200 text-red-600 py-1.5 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
                      >
                        رفض
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
