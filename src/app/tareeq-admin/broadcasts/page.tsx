'use client';

/**
 * إعلام المستخدمين, inside the panel whose admins actually run طريق.
 *
 * The composer lived only in the shop's admin panel (`/admin/tareeq`), behind the shop's
 * own login. From here that was not a locked door but a WRONG one: `/tareeq-admin` has a
 * push-only «الإشعارات» screen, and that is what an admin looking for "send a message to
 * the members" found and used. Nothing was recorded, so nothing could be found afterwards.
 *
 * This renders the SAME component as the shop panel's tab — not a second copy of it. Two
 * copies of a composer this size would drift, and the drift would show up as a channel that
 * works on one screen and silently does nothing on the other.
 */

import { useState } from 'react';
import AdminShell from '@/components/tareeq-admin/AdminShell';
import BroadcastsTab from '@/app/admin/tareeq/BroadcastsTab';

export default function TareeqAdminBroadcastsPage() {
  const [toast, setToast] = useState('');

  return (
    <AdminShell>
      <div dir="rtl" style={{ padding: '28px 24px 64px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 700, margin: 0 }}>
            📣 إعلام المستخدمين
          </h1>
          <p style={{ color: '#94a3b8', marginTop: 6, fontSize: 14, lineHeight: 1.8 }}>
            رسالة واحدة لكل الأعضاء أو لأعضاء طريق أو لعملاء المتجر أو لأشخاص تختارهم
            بالاسم — داخل التطبيق، وإشعارًا على المتصفّح، وإيميلًا. تُحفَظ في السجل، ومعها
            تقرير بمن وصلته ومن لم تصله ولماذا.
          </p>
        </div>

        <BroadcastsTab flash={setToast} />
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#1e293b', border: '1px solid #f59e0b66', color: '#fde68a',
            padding: '12px 22px', borderRadius: 10, zIndex: 200, fontSize: 14,
            boxShadow: '0 8px 30px rgba(0,0,0,0.45)', maxWidth: '92vw', textAlign: 'center',
          }}
          onClick={() => setToast('')}
        >
          {toast}
        </div>
      )}
    </AdminShell>
  );
}
