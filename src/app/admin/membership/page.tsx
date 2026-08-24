'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Membership {
  id: string;
  membershipNumber: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  tier?: string | null;
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
  forTier: string;
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
  const [tab, setTab] = useState<'memberships' | 'perks' | 'pricing' | 'grant'>('memberships');
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
  const [perkForTier, setPerkForTier] = useState<'leader' | 'all'>('leader');
  const [perkImageFile, setPerkImageFile] = useState<File | null>(null);
  const [perkImagePreview, setPerkImagePreview] = useState<string | null>(null);
  const [perkSaving, setPerkSaving] = useState(false);
  const [perkError, setPerkError] = useState('');
  const [perkCompressing, setPerkCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function compressImage(file: File, maxW = 1200, quality = 0.82): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  }
  const dragIndexRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const [msg, setMsg] = useState('');

  // Pricing settings
  const [priceEgyEgp,          setPriceEgyEgp]          = useState('100');
  const [priceEgyUsd,          setPriceEgyUsd]           = useState('2.00');
  const [priceIntlUsd,         setPriceIntlUsd]          = useState('5.00');
  const [instapayNumber,       setInstapayNumber]        = useState('');
  const [leaderDiscountPct,    setLeaderDiscountPct]     = useState('15');
  const [communityDiscountPct, setCommunityDiscountPct]  = useState('5');
  const [priceSaving,          setPriceSaving]           = useState(false);

  // Grant membership state
  const [grantEmail,      setGrantEmail]       = useState('');
  const [grantFamily,     setGrantFamily]      = useState('');
  const [grantLoading,    setGrantLoading]     = useState(false);
  const [grantResult,     setGrantResult]      = useState<{ type: 'granted' | 'invited' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    fetchMemberships();
  }, [statusFilter, page]);

  useEffect(() => {
    if (tab === 'perks') fetchPerks();
    if (tab === 'pricing') fetchPrices();
    if (tab === 'grant') { setGrantResult(null); setGrantEmail(''); setGrantFamily(''); }
  }, [tab]);

  async function fetchPrices() {
    const res = await fetch('/api/membership/price');
    if (res.ok) {
      const d = await res.json();
      setPriceEgyEgp(String(d.egyEgp));
      setPriceEgyUsd(String(d.egyUsd));
      setPriceIntlUsd(String(d.intlUsd));
      setInstapayNumber(d.instapayNumber ?? '');
      setLeaderDiscountPct(String(d.leaderDiscountPct ?? 15));
      setCommunityDiscountPct(String(d.communityDiscountPct ?? 5));
    }
  }

  async function savePrices() {
    setPriceSaving(true);
    const keys = [
      { key: 'membership-price-egy-egp',       value: priceEgyEgp.trim() },
      { key: 'membership-price-egy-usd',        value: priceEgyUsd.trim() },
      { key: 'membership-price-intl-usd',       value: priceIntlUsd.trim() },
      { key: 'membership-instapay-number',      value: instapayNumber.trim() },
      { key: 'membership-discount-leader',      value: leaderDiscountPct.trim() },
      { key: 'membership-discount-community',   value: communityDiscountPct.trim() },
    ];
    await Promise.allSettled(
      keys.map(({ key, value }) =>
        fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
      )
    );
    setPriceSaving(false);
    flash('تم حفظ الإعدادات ✓');
  }

  async function grantMembership() {
    if (!grantEmail.trim()) return;
    setGrantLoading(true);
    setGrantResult(null);
    try {
      const res = await fetch('/api/admin/membership/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: grantEmail.trim(), familyName: grantFamily.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
        setGrantResult({ type: 'error', msg: d.error || 'حدث خطأ' });
      } else if (d.invited) {
        setGrantResult({ type: 'invited', msg: `تم إرسال دعوة التسجيل إلى ${d.email}` });
      } else {
        setGrantResult({ type: 'granted', msg: `تم منح العضوية لـ ${d.user.name} (${d.membershipNumber})` });
        fetchMemberships();
      }
    } catch {
      setGrantResult({ type: 'error', msg: 'فشل الاتصال' });
    }
    setGrantLoading(false);
  }

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
    setPerkForTier('leader');
    setPerkError('');
    setShowPerkForm(true);
  }

  function openEditPerk(p: Perk) {
    setEditingPerk(p);
    setPerkTitle(p.title); setPerkDesc(p.description ?? '');
    setPerkLink(p.linkUrl ?? ''); setPerkUntil(p.validUntil ? p.validUntil.slice(0, 10) : '');
    setPerkPostToTareeq(false); setPerkImageFile(null);
    setPerkForTier((p.forTier === 'all' ? 'all' : 'leader'));
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
      forTier: perkForTier,
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

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const handleDrop = useCallback(async (dropIndex: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) { setDragOver(null); return; }
    const reordered = [...perks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    // Assign sortOrder = position index
    const updated = reordered.map((p, i) => ({ ...p, sortOrder: i }));
    setPerks(updated);
    setDragOver(null);
    dragIndexRef.current = null;
    // Persist all sortOrder values (fire-and-forget in parallel)
    await Promise.allSettled(
      updated.map(p => fetch('/api/admin/membership/perks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, sortOrder: p.sortOrder }),
      }))
    );
    flash('تم حفظ الترتيب');
  }, [perks]);

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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['memberships', 'perks', 'pricing', 'grant'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
              background: tab === t ? '#d4a843' : '#1e293b', color: tab === t ? '#0f172a' : '#94a3b8' }}>
            {t === 'memberships' ? 'العضويات' : t === 'perks' ? 'المزايا' : t === 'pricing' ? 'الأسعار والخصومات' : '➕ إضافة يدوية'}
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
                        <span style={{ fontWeight: 800, fontSize: 15, color: '#d4a843', fontFamily: 'monospace' }}>
                          {m.tier === 'community' ? m.membershipNumber.replace(/^ML-/, 'MC-') : m.membershipNumber}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${STATUS_COLORS[m.status]}22`, color: STATUS_COLORS[m.status], fontWeight: 700 }}>
                          {STATUS_AR[m.status]}
                        </span>
                        {m.tier === 'community' ? (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 700, border: '1px solid rgba(34,197,94,0.25)' }}>
                            مجتمعية
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'rgba(212,168,67,0.12)', color: '#d4a843', fontWeight: 700, border: '1px solid rgba(212,168,67,0.25)' }}>
                            رائدة
                          </span>
                        )}
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
              {perks.map((p, index) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={e => { e.preventDefault(); setDragOver(index); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => { setDragOver(null); dragIndexRef.current = null; }}
                  style={{
                    background: '#1e293b',
                    border: dragOver === index ? '1px solid #d4a843' : `1px solid ${p.isActive ? '#334155' : '#1e293b'}`,
                    borderRadius: 14, padding: '14px 16px',
                    opacity: p.isActive ? 1 : 0.55,
                    transition: 'border-color 0.15s',
                    cursor: 'grab',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Drag handle */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, flexShrink: 0, paddingTop: 2, cursor: 'grab', opacity: 0.35 }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ display: 'flex', gap: 3 }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#94a3b8' }} />
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#94a3b8' }} />
                        </div>
                      ))}
                    </div>
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>{p.title}</div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                          background: p.forTier === 'leader' ? 'rgba(212,168,67,0.15)' : 'rgba(34,197,94,0.12)',
                          color: p.forTier === 'leader' ? '#d4a843' : '#22c55e',
                          border: `1px solid ${p.forTier === 'leader' ? 'rgba(212,168,67,0.3)' : 'rgba(34,197,94,0.25)'}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {p.forTier === 'leader' ? '✦ عضو رائد فقط' : '🌿 كل الأعضاء'}
                        </span>
                      </div>
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

      {/* ─── PERK FORM MODAL ─── */}
      {showPerkForm && (
        <div onClick={() => setShowPerkForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} dir="rtl"
            style={{ width: '100%', maxWidth: 520, maxHeight: '90dvh', overflowY: 'auto', background: '#1e293b', borderRadius: 20, padding: '28px 24px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <button onClick={() => setShowPerkForm(false)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#334155', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontWeight: 800, fontSize: 18, color: '#d4a843', marginBottom: 18, marginTop: 0 }}>
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
                  onChange={async e => {
                    const f = e.target.files?.[0] ?? null;
                    if (!f) return;
                    setPerkCompressing(true);
                    const compressed = await compressImage(f);
                    setPerkImageFile(compressed);
                    setPerkImagePreview(URL.createObjectURL(compressed));
                    setPerkCompressing(false);
                  }} />
                <button onClick={() => fileRef.current?.click()} disabled={perkCompressing}
                  style={{ padding: '9px 18px', borderRadius: 10, background: '#334155', color: '#f1f5f9', fontSize: 13, border: 'none', cursor: perkCompressing ? 'wait' : 'pointer', opacity: perkCompressing ? 0.6 : 1 }}>
                  {perkCompressing ? 'جاري الضغط...' : perkImagePreview ? 'تغيير الصورة' : 'رفع صورة'}
                </button>
              </div>
              {/* Tier selector */}
              <div style={{ padding: '12px 14px', borderRadius: 12, background: '#0f172a', border: '1px solid #334155' }}>
                <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>الميزة متاحة لـ:</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPerkForTier('leader')}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: perkForTier === 'leader' ? '#d4a843' : '#334155', color: perkForTier === 'leader' ? '#0f172a' : '#94a3b8' }}>
                    ✦ عضو رائد فقط
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerkForTier('all')}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: perkForTier === 'all' ? '#22c55e' : '#334155', color: perkForTier === 'all' ? '#0f172a' : '#94a3b8' }}>
                    🌿 كل الأعضاء
                  </button>
                </div>
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

      {/* ─── PRICING TAB ─── */}
      {tab === 'pricing' && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>أسعار الاشتراك السنوي</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>سعر مصر وسعر الدول مستقلان — غير مرتبطين بسعر الصرف</p>

            {/* Egypt */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#d4a843', marginBottom: 10 }}>🇪🇬 داخل مصر</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>السعر المعروض (جنيه)</label>
                  <input type="number" value={priceEgyEgp} onChange={e => setPriceEgyEgp(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>سعر PayPal (دولار USD)</label>
                  <input type="number" step="0.01" value={priceEgyUsd} onChange={e => setPriceEgyUsd(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>يظهر للمستخدم السعر بالجنيه — يُسحب من PayPal بالدولار</p>
            </div>

            {/* InstaPay number */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>📲 رقم إنستاباي / ووليت (للمصريين)</label>
              <input type="text" value={instapayNumber} onChange={e => setInstapayNumber(e.target.value)}
                placeholder="مثال: 01012345678"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>يظهر في صفحة الدفع بإنستاباي — اتركه فارغاً لإخفاء الخيار</p>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#334155', marginBottom: 20 }} />

            {/* International */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 10 }}>🌍 خارج مصر</p>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>السعر الدولي (دولار USD)</label>
                <input type="number" step="0.01" value={priceIntlUsd} onChange={e => setPriceIntlUsd(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>السعر الموحد لجميع الدول خارج مصر — يُعرض ويُسحب بالدولار</p>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#334155', marginBottom: 20 }} />

            {/* Discount rates */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>🏷️ نسب الخصم على المنتجات</p>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>تُطبَّق تلقائياً على الطلبات — العضو الرائد له الأولوية إذا كان لديه الاثنتان</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#d4a843', display: 'block', marginBottom: 4 }}>✦ خصم العضو الرائد (%)</label>
                  <input type="number" min="0" max="100" value={leaderDiscountPct} onChange={e => setLeaderDiscountPct(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#7dd9a0', display: 'block', marginBottom: 4 }}>🌿 خصم عضو المجتمع (%)</label>
                  <input type="number" min="0" max="100" value={communityDiscountPct} onChange={e => setCommunityDiscountPct(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            <button onClick={savePrices} disabled={priceSaving}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: '#d4a843', color: '#0f172a', fontWeight: 800, fontSize: 15, border: 'none', cursor: priceSaving ? 'not-allowed' : 'pointer', opacity: priceSaving ? 0.7 : 1 }}>
              {priceSaving ? 'جاري الحفظ...' : 'حفظ الأسعار'}
            </button>
          </div>
        </div>
      )}

      {/* ─── GRANT TAB ─── */}
      {tab === 'grant' && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>إضافة عضو يدوياً</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>لو المستخدم مسجل → تُفعّل عضويته مباشرةً. لو مش مسجل → يجيله إيميل دعوة للتسجيل.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6 }}>البريد الإلكتروني *</label>
              <input
                type="email"
                value={grantEmail}
                onChange={e => setGrantEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && grantMembership()}
                placeholder="example@email.com"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 15, outline: 'none', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6 }}>اسم الأسرة (اختياري)</label>
              <input
                type="text"
                value={grantFamily}
                onChange={e => setGrantFamily(e.target.value)}
                placeholder="مثال: أسرة محمد أحمد"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={grantMembership}
              disabled={grantLoading || !grantEmail.trim()}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: '#d4a843', color: '#0f172a', fontWeight: 800, fontSize: 15, border: 'none', cursor: grantLoading || !grantEmail.trim() ? 'not-allowed' : 'pointer', opacity: grantLoading || !grantEmail.trim() ? 0.6 : 1 }}
            >
              {grantLoading ? 'جاري المعالجة...' : 'منح العضوية'}
            </button>

            {grantResult && (
              <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 12,
                background: grantResult.type === 'granted' ? 'rgba(34,197,94,0.12)' : grantResult.type === 'invited' ? 'rgba(96,165,250,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${grantResult.type === 'granted' ? '#22c55e44' : grantResult.type === 'invited' ? '#60a5fa44' : '#ef444444'}`,
                color: grantResult.type === 'granted' ? '#4ade80' : grantResult.type === 'invited' ? '#93c5fd' : '#f87171',
                fontSize: 14, fontWeight: 600 }}>
                {grantResult.type === 'granted' ? '✅ ' : grantResult.type === 'invited' ? '📧 ' : '❌ '}
                {grantResult.msg}
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, background: '#1e293b', border: '1px solid #334155', fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>📌 ملاحظات:</p>
            <p style={{ margin: 0 }}>• العضوية المُمنوحة تستمر سنة كاملة من يوم المنح</p>
            <p style={{ margin: 0 }}>• تُسجَّل في سجل التجديدات بمبلغ ٠ جنيه (منحة إدارية)</p>
            <p style={{ margin: 0 }}>• لو المستخدم مش مسجل، هيجيله إيميل على العنوان ده يدعوه للتسجيل</p>
            <p style={{ margin: 0 }}>• بعد تسجيله، عضويته مش بتتفعل تلقائي — هتحتاج تمنحها تاني</p>
          </div>
        </div>
      )}
    </div>
  );
}
