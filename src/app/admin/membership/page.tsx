'use client';

import { useState, useEffect, useRef } from 'react';

interface Membership {
  id: string;
  membershipNumber: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  familyName: string | null;
  memberSince: number;
  expiresAt: string | null;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  _count: { familyMembers: number; renewals: number };
}

interface Perk {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  validUntil: string | null;
  isActive: boolean;
  sortOrder: number;
  tareeqPostId: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  expired: number;
  cancelled: number;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  PENDING: '#f59e0b',
  EXPIRED: '#94a3b8',
  CANCELLED: '#ef4444',
};

const STATUS_AR: Record<string, string> = {
  ACTIVE: 'نشط',
  PENDING: 'بانتظار الدفع',
  EXPIRED: 'منتهي',
  CANCELLED: 'ملغي',
};

export default function AdminMembershipPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [tab, setTab] = useState<'memberships' | 'perks'>('memberships');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Perk form
  const [showPerkForm, setShowPerkForm] = useState(false);
  const [editingPerk, setEditingPerk] = useState<Perk | null>(null);
  const [perkTitle, setPerkTitle] = useState('');
  const [perkDesc, setPerkDesc] = useState('');
  const [perkLink, setPerkLink] = useState('');
  const [perkUntil, setPerkUntil] = useState('');
  const [perkPostToTareeq, setPerkPostToTareeq] = useState(false);
  const [perkImageFile, setPerkImageFile] = useState<File | null>(null);
  const [perkImagePreview, setPerkImagePreview] = useState<string | null>(null);
  const [perkSaving, setPerkSaving] = useState(false);
  const [perkError, setPerkError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchMemberships();
  }, [statusFilter, page]);

  useEffect(() => {
    if (tab === 'perks') fetchPerks();
  }, [tab]);

  async function fetchMemberships() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    params.set('limit', '20');
    const res = await fetch(`/api/admin/membership?${params}`);
    if (res.ok) {
      const data = await res.json();
      setMemberships(data.memberships);
      setStats(data.stats);
      setTotalPages(Math.ceil(data.total / 20));
    }
    setLoading(false);
  }

  async function fetchPerks() {
    const res = await fetch('/api/admin/membership/perks');
    if (res.ok) {
      const data = await res.json();
      setPerks(data.perks);
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch('/api/admin/membership', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setMemberships(prev => prev.map(m => m.id === id ? { ...m, status: status as Membership['status'] } : m));
      flash('تم التحديث');
    }
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  }

  function openCreatePerk() {
    setEditingPerk(null);
    setPerkTitle(''); setPerkDesc(''); setPerkLink(''); setPerkUntil('');
    setPerkPostToTareeq(false); setPerkImageFile(null); setPerkImagePreview(null);
    setPerkError('');
    setShowPerkForm(true);
  }

  function openEditPerk(p: Perk) {
    setEditingPerk(p);
    setPerkTitle(p.title); setPerkDesc(p.description ?? '');
    setPerkLink(p.linkUrl ?? ''); setPerkUntil(p.validUntil ? p.validUntil.slice(0, 10) : '');
    setPerkPostToTareeq(false); setPerkImageFile(null);
    setPerkImagePreview(p.imageUrl ?? null);
    setPerkError('');
    setShowPerkForm(true);
  }

  async function savePerk() {
    if (!perkTitle.trim()) { setPerkError('العنوان مطلوب'); return; }
    setPerkSaving(true); setPerkError('');
    let imageUrl: string | null = editingPerk?.imageUrl ?? null;

    if (perkImageFile) {
      const fd = new FormData();
      fd.append('file', perkImageFile);
      const upRes = await fetch('/api/admin/membership/perks/upload', { method: 'POST', body: fd });
      if (!upRes.ok) { setPerkError('فشل رفع الصورة'); setPerkSaving(false); return; }
      const upData = await upRes.json();
      imageUrl = upData.url;
    }

    const body: Record<string, unknown> = {
      title: perkTitle.trim(),
      description: perkDesc.trim() || null,
      linkUrl: perkLink.trim() || null,
      validUntil: perkUntil || null,
      imageUrl,
      postToTareeq: perkPostToTareeq,
    };

    const url = '/api/admin/membership/perks';
    const method = editingPerk ? 'PUT' : 'POST';
    if (editingPerk) body.id = editingPerk.id;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setPerkSaving(false);
    if (!res.ok) { setPerkError('حدث خطأ'); return; }
    await fetchPerks();
    setShowPerkForm(false);
    flash(editingPerk ? 'تم تحديث الميزة' : 'تمت إضافة الميزة');
  }

  async function togglePerkActive(p: Perk) {
    const res = await fetch('/api/admin/membership/perks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, isActive: !p.isActive }),
    });
    if (res.ok) {
      setPerks(prev => prev.map(x => x.id === p.id ? { ...x, isActive: !x.isActive } : x));
    }
  }

  async function deletePerk(id: string) {
    if (!confirm('حذف هذه الميزة؟')) return;
    const res = await fetch('/api/admin/membership/perks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setPerks(prev => prev.filter(p => p.id !== id));
  }

  async function perkAction(id: string, action: 'tareeq' | 'notify' | 'both') {
    const labels: Record<string, string> = { tareeq: 'إعادة نشر على طريق', notify: 'إرسال تذكير', both: 'نشر + تذكير' };
    if (!confirm(`${labels[action]}؟`)) return;
    const res = await fetch('/api/admin/membership/perks/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.tareeqPostId) setPerks(prev => prev.map(p => p.id === id ? { ...p, tareeqPostId: data.tareeqPostId } : p));
      flash(action === 'tareeq' ? 'تم النشر على طريق ✓' : action === 'notify' ? 'تم إرسال التذكير ✓' : 'تم النشر والتذكير ✓');
    } else {
      flash('حدث خطأ');
    }
  }

  const filtered = memberships.filter(m =>
    !search || m.owner.name.includes(search) || m.owner.email.includes(search) || m.membershipNumber.includes(search)
  );

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', padding: '24px 20px', paddingBottom: 60 }}>
      {/* Flash */}
      {msg && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', padding: '10px 24px', borderRadius: 10, fontWeight: 700, zIndex: 9999 }}>
          {msg}
        </div>
      )}

      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#d4a843', marginBottom: 4 }}>إدارة العضويات</h1>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>عضوية الأسرة — 100 جنيه / سنة</p>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: 'الكل', val: stats.total, color: '#60a5fa' },
            { label: 'نشط', val: stats.active, color: '#22c55e' },
            { label: 'انتظار', val: stats.pending, color: '#f59e0b' },
            { label: 'منتهي', val: stats.expired, color: '#94a3b8' },
            { label: 'ملغي', val: stats.cancelled, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '10px 18px', minWidth: 80, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['memberships', 'perks'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
              background: tab === t ? '#d4a843' : '#1e293b', color: tab === t ? '#0f172a' : '#94a3b8' }}>
            {t === 'memberships' ? 'العضويات' : 'المزايا'}
          </button>
        ))}
      </div>

      {/* ─── MEMBERSHIPS TAB ─── */}
      {tab === 'memberships' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الإيميل أو رقم العضوية"
              style={{ flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', fontSize: 13, outline: 'none' }} />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ padding: '9px 14px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', fontSize: 13, outline: 'none' }}>
              <option value="">كل الحالات</option>
              <option value="ACTIVE">نشط</option>
              <option value="PENDING">انتظار</option>
              <option value="EXPIRED">منتهي</option>
              <option value="CANCELLED">ملغي</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>لا توجد عضويات</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(m => (
                <div key={m.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: '#d4a843', fontFamily: 'monospace' }}>{m.membershipNumber}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${STATUS_COLORS[m.status]}22`, color: STATUS_COLORS[m.status], fontWeight: 700 }}>
                          {STATUS_AR[m.status]}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{m.owner.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.owner.email}</div>
                      {m.familyName && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>عائلة: {m.familyName}</div>}
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>منذ {m.memberSince}</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>👥 {m._count.familyMembers} أفراد</span>
                        {m.expiresAt && (
                          <span style={{ fontSize: 11, color: new Date(m.expiresAt) < new Date() ? '#ef4444' : '#94a3b8' }}>
                            ينتهي {new Date(m.expiresAt).toLocaleDateString('ar-EG')}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Status changer */}
                    <div style={{ flexShrink: 0 }}>
                      <select value={m.status}
                        onChange={e => updateStatus(m.id, e.target.value)}
                        style={{ padding: '7px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
                        <option value="PENDING">انتظار</option>
                        <option value="ACTIVE">نشط</option>
                        <option value="EXPIRED">منتهي</option>
                        <option value="CANCELLED">ملغي</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', cursor: 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
                السابق
              </button>
              <span style={{ padding: '8px 16px', color: '#94a3b8', fontSize: 13 }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', cursor: 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
                التالي
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── PERKS TAB ─── */}
      {tab === 'perks' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={openCreatePerk}
              style={{ padding: '10px 20px', borderRadius: 10, background: '#d4a843', color: '#0f172a', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
              + إضافة ميزة
            </button>
          </div>

          {perks.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>لا توجد مزايا بعد</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {perks.map(p => (
                <div key={p.id} style={{ background: '#1e293b', border: `1px solid ${p.isActive ? '#334155' : '#1e293b'}`, borderRadius: 14, padding: '14px 16px', opacity: p.isActive ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9', marginBottom: 4 }}>{p.title}</div>
                      {p.description && <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4, lineHeight: 1.5 }}>{p.description}</div>}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {p.linkUrl && <a href={p.linkUrl} target="_blank" rel="noopener" style={{ fontSize: 12, color: '#60a5fa' }}>رابط ←</a>}
                        {p.validUntil && <span style={{ fontSize: 12, color: '#94a3b8' }}>حتى {new Date(p.validUntil).toLocaleDateString('ar-EG')}</span>}
                        {p.tareeqPostId && <span style={{ fontSize: 12, color: '#a78bfa' }}>📢 منشور طريق</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => openEditPerk(p)}
                        style={{ padding: '6px 14px', borderRadius: 8, background: '#334155', color: '#f1f5f9', fontSize: 12, border: 'none', cursor: 'pointer' }}>
                        تعديل
                      </button>
                      <button onClick={() => togglePerkActive(p)}
                        style={{ padding: '6px 14px', borderRadius: 8, background: p.isActive ? '#374151' : '#22c55e22', color: p.isActive ? '#94a3b8' : '#22c55e', fontSize: 12, border: 'none', cursor: 'pointer' }}>
                        {p.isActive ? 'إخفاء' : 'إظهار'}
                      </button>
                      <button onClick={() => perkAction(p.id, 'tareeq')}
                        style={{ padding: '6px 14px', borderRadius: 8, background: '#a78bfa22', color: '#a78bfa', fontSize: 12, border: 'none', cursor: 'pointer' }}>
                        📢 نشر طريق
                      </button>
                      <button onClick={() => perkAction(p.id, 'notify')}
                        style={{ padding: '6px 14px', borderRadius: 8, background: '#38bdf822', color: '#38bdf8', fontSize: 12, border: 'none', cursor: 'pointer' }}>
                        🔔 تذكير
                      </button>
                      <button onClick={() => deletePerk(p.id)}
                        style={{ padding: '6px 14px', borderRadius: 8, background: '#ef444422', color: '#ef4444', fontSize: 12, border: 'none', cursor: 'pointer' }}>
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── PERK FORM SHEET ─── */}
      {showPerkForm && (
        <div onClick={() => setShowPerkForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} dir="rtl"
            style={{ width: '100%', maxHeight: '90dvh', overflowY: 'auto', background: '#1e293b', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#334155', margin: '0 auto 20px' }} />
            <p style={{ fontWeight: 800, fontSize: 18, color: '#d4a843', marginBottom: 18 }}>
              {editingPerk ? 'تعديل الميزة' : 'إضافة ميزة جديدة'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={perkTitle} onChange={e => setPerkTitle(e.target.value)} maxLength={120}
                placeholder="عنوان الميزة *"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <textarea value={perkDesc} onChange={e => setPerkDesc(e.target.value)} rows={3} maxLength={600}
                placeholder="وصف (اختياري)"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              <input value={perkLink} onChange={e => setPerkLink(e.target.value)}
                placeholder="رابط (اختياري)"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>صالح حتى (اختياري)</label>
                <input type="date" value={perkUntil} onChange={e => setPerkUntil(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {/* Image upload */}
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>صورة (اختياري)</label>
                {perkImagePreview && (
                  <img src={perkImagePreview} alt="" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', marginBottom: 8 }} />
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    setPerkImageFile(f);
                    if (f) setPerkImagePreview(URL.createObjectURL(f));
                  }} />
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding: '9px 18px', borderRadius: 10, background: '#334155', color: '#f1f5f9', fontSize: 13, border: 'none', cursor: 'pointer' }}>
                  {perkImagePreview ? 'تغيير الصورة' : 'رفع صورة'}
                </button>
              </div>
              {/* Post to Tareeq */}
              {!editingPerk && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 12, background: '#0f172a', border: '1px solid #334155' }}>
                  <input type="checkbox" checked={perkPostToTareeq} onChange={e => setPerkPostToTareeq(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#d4a843' }} />
                  <span style={{ fontSize: 13, color: '#f1f5f9' }}>نشر على طريق باسم الأدمن</span>
                </label>
              )}
              {perkError && <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center' }}>{perkError}</p>}
              <button onClick={savePerk} disabled={perkSaving || !perkTitle.trim()}
                style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#d4a843', color: '#0f172a', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer', opacity: perkSaving || !perkTitle.trim() ? 0.6 : 1 }}>
                {perkSaving ? '...' : (editingPerk ? 'حفظ التعديلات' : 'إضافة الميزة')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
