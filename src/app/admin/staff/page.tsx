'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { PERMISSIONS, PERMISSION_GROUPS, type Permission } from '@/lib/permissions-shared';

interface Staff {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  permissions: string[];
  createdAt: string;
}

const PERM_LABELS: Record<Permission, string> = {
  'orders.read': 'عرض الطلبات',
  'orders.write': 'تعديل الطلبات',
  'shipments.read': 'عرض الشحنات',
  'shipments.write': 'إدارة الشحنات (بوسطة)',
  'inventory.read': 'عرض المخزون',
  'inventory.write': 'تعديل المخزون',
  'products.read': 'عرض المنتجات',
  'products.write': 'تعديل المنتجات',
  'customers.read': 'عرض قاعدة العملاء',
  'customers.write': 'تعديل/حذف العملاء',
  'campaigns.read': 'عرض الحملات',
  'campaigns.write': 'إنشاء وإرسال الحملات',
  'coupons.read': 'عرض الكوبونات',
  'coupons.write': 'إدارة الكوبونات',
  'reviews.read': 'عرض التقييمات',
  'reviews.write': 'الموافقة/حذف التقييمات',
  'books.read': 'عرض المكتبة',
  'books.write': 'إدارة المكتبة',
  'shipping.read': 'عرض الشحن',
  'shipping.write': 'تعديل أسعار الشحن',
  'payment-methods.read': 'عرض وسائل الدفع',
  'payment-methods.write': 'تعديل وسائل الدفع',
  'valuation.read': 'تقييم الشركة (مالي)',
  'settings.read': 'عرض الإعدادات',
  'settings.write': 'تعديل الإعدادات',
};

export default function StaffPage() {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: string; perms: Set<string> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPerms, setNewPerms] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setStaff(data.staff ?? []);
    } catch {
      addToast('فشل تحميل المساعدين', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const togglePermInSet = (set: Set<string>, perm: string): Set<string> => {
    const next = new Set(set);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    return next;
  };

  const startEdit = (s: Staff) => {
    setEditing({ id: s.id, perms: new Set(s.permissions) });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permissions: Array.from(editing.perms) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setStaff(prev => prev.map(s => s.id === data.staff.id ? data.staff : s));
      addToast('تم حفظ الصلاحيات', 'success');
      setEditing(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الحفظ', 'error');
    }
    setSaving(false);
  };

  const addStaff = async () => {
    if (!newEmail.trim()) { addToast('اكتب الإيميل', 'warning'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: newEmail.trim(), permissions: Array.from(newPerms) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setStaff(prev => [data.staff, ...prev]);
      setNewEmail('');
      setNewPerms(new Set());
      addToast('تم إضافة المساعد', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الإضافة', 'error');
    }
    setAdding(false);
  };

  const revoke = async (s: Staff) => {
    const ok = await confirm({
      title: 'إلغاء صلاحيات المساعد',
      message: `هتلغي صلاحيات ${s.name} (${s.email}) ويرجع عميل عادي. متأكد؟`,
      confirmLabel: 'إلغاء الصلاحيات',
      cancelLabel: 'تراجع',
      tone: 'danger',
      icon: '🚫',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/staff/${s.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setStaff(prev => prev.filter(x => x.id !== s.id));
      addToast('تم الإلغاء', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الإلغاء', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">🛡️ صلاحيات المساعدين</h1>
        <p className="text-xs text-gray-500 mt-1">عيّن صلاحيات محددة لمساعديك في الإدارة. الأدمن الرئيسي عنده كل الصلاحيات تلقائياً.</p>
      </div>

      {/* Add new staff */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-black text-gray-900 mb-3">➕ إضافة مساعد جديد</h2>
        <p className="text-[11px] text-gray-500 mb-3">المساعد لازم يكون مسجّل عضوية على الموقع بإيميله الأول. ادخل الإيميل وحدد الصلاحيات.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 min-w-[260px] border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
          />
          <button
            type="button"
            onClick={() => setNewPerms(new Set(PERMISSIONS))}
            className="text-xs px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold"
          >تحديد الكل</button>
          <button
            type="button"
            onClick={() => setNewPerms(new Set())}
            className="text-xs px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold"
          >مسح الكل</button>
          <button
            onClick={addStaff}
            disabled={adding || !newEmail.trim()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
          >{adding ? '...' : 'إضافة'}</button>
        </div>
        <PermissionGrid value={newPerms} onChange={setNewPerms} />
      </div>

      {/* Staff list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900">المساعدون الحاليون ({staff.filter(s => s.role === 'staff').length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center"><div className="inline-block w-7 h-7 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" /></div>
        ) : staff.length === 0 ? (
          <p className="p-8 text-xs text-gray-400 text-center">مفيش مساعدين بعد</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {staff.map(s => (
              <div key={s.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">
                      {s.name}
                      {s.role === 'admin' && <span className="mr-2 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">أدمن رئيسي</span>}
                    </p>
                    <p className="text-xs text-gray-500" dir="ltr">{s.email}</p>
                    {s.phone && <p className="text-[11px] text-gray-400 font-mono mt-0.5" dir="ltr">{s.phone}</p>}
                  </div>
                  {s.role === 'staff' && (
                    <div className="flex gap-2">
                      {editing?.id === s.id ? (
                        <>
                          <button onClick={saveEdit} disabled={saving} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">{saving ? '...' : 'حفظ'}</button>
                          <button onClick={() => setEditing(null)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">تراجع</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(s)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">تعديل</button>
                          <button onClick={() => revoke(s)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700">إلغاء الصلاحيات</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {s.role === 'staff' && (
                  editing?.id === s.id ? (
                    <PermissionGrid value={editing.perms} onChange={next => setEditing({ id: s.id, perms: next })} />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {s.permissions.length === 0 ? (
                        <span className="text-[11px] text-gray-400">— مفيش صلاحيات —</span>
                      ) : s.permissions.map(p => (
                        <span key={p} className="text-[10px] bg-gray-50 border border-gray-200 text-gray-700 px-2 py-0.5 rounded">{PERM_LABELS[p as Permission] || p}</span>
                      ))}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PermissionGrid({ value, onChange }: { value: Set<string>; onChange: (next: Set<string>) => void }) {
  const toggle = (perm: string) => {
    const next = new Set(value);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    onChange(next);
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {PERMISSION_GROUPS.map(group => (
        <div key={group.label} className="border border-gray-200 rounded-xl p-3">
          <p className="text-xs font-black text-gray-900 mb-2">{group.label}</p>
          <div className="space-y-1.5">
            {group.perms.map(p => (
              <label key={p} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                <input
                  type="checkbox"
                  checked={value.has(p)}
                  onChange={() => toggle(p)}
                  className="w-3.5 h-3.5 accent-emerald-600"
                />
                <span className="text-gray-700">{PERM_LABELS[p]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
