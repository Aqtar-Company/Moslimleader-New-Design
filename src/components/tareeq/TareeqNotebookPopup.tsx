'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/tareeq-utils';

interface Props {
  onClose: () => void;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

export default function TareeqNotebookPopup({ onClose }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!user) { setLoadingNotes(false); return; }
    fetch('/api/tareeq/notes?limit=6&sort=newest', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setNotes(d.notes ?? []))
      .catch(() => {})
      .finally(() => setLoadingNotes(false));
  }, [user]);

  async function handleSave() {
    if (!newNote.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tareeq/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.note) setNotes(prev => [data.note, ...prev]);
        setNewNote('');
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleCopy(note: Note) {
    await navigator.clipboard.writeText(note.content).catch(() => {});
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const content = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 8999, background: 'rgba(0,0,0,0.4)' }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          width: 320,
          maxHeight: 420,
          borderRadius: 20,
          background: 'var(--tr-surface)',
          border: '1px solid var(--tr-border-soft)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 9000,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 200ms ease, transform 200ms ease',
        }}
        onClick={e => e.stopPropagation()}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 16px', borderBottom: '1px solid var(--tr-border-soft)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)', width: 20, height: 20, flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75H7.5A2.25 2.25 0 005.25 6v12A2.25 2.25 0 007.5 20.25h9a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0016.5 3.75z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h7.5M8.25 10.5h7.5M8.25 13.5h4.5"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 3.75v3.75a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75V3.75"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'دفتري' : 'My Notebook'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link
              href="/tareeq/notebook"
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)', textDecoration: 'none',
              }}
              title={isRtl ? 'فتح الدفتر كاملاً' : 'Open full notebook'}
            >
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </Link>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)', border: 'none', cursor: 'pointer',
                fontSize: 16, fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Quick add */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--tr-border-soft)', flexShrink: 0 }}>
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            rows={3}
            placeholder={isRtl ? 'اكتب ملاحظة سريعة...' : 'Write a quick note...'}
            style={{
              width: '100%', resize: 'none', borderRadius: 12, padding: '8px 10px',
              fontSize: 13, lineHeight: 1.5,
              background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)',
              color: 'var(--tr-text-primary)', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              onClick={handleSave}
              disabled={saving || !newNote.trim()}
              style={{
                padding: '6px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: newNote.trim() ? 'var(--tr-gold)' : 'var(--tr-overlay)',
                color: newNote.trim() ? '#fff' : 'var(--tr-text-muted)',
                border: 'none', cursor: newNote.trim() ? 'pointer' : 'default',
                opacity: saving ? 0.6 : 1, transition: 'all 150ms',
              }}
            >
              {saving ? '...' : (isRtl ? 'حفظ' : 'Save')}
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingNotes ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: '2px solid var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : notes.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--tr-text-muted)', textAlign: 'center', padding: '16px 12px', margin: 0 }}>
              {isRtl ? 'لا توجد ملاحظات' : 'No notes yet'}
            </p>
          ) : notes.map((note, idx) => (
            <div key={note.id} style={{
              padding: '10px 12px',
              borderBottom: idx < notes.length - 1 ? '1px solid var(--tr-border-subtle)' : 'none',
            }}>
              <p style={{
                fontSize: 12, lineHeight: 1.5, color: 'var(--tr-text-secondary)', margin: '0 0 6px',
                display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden',
                wordBreak: 'break-word',
              }}>
                {note.content}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--tr-text-muted)' }}>
                  {timeAgo(note.createdAt, isRtl)}
                </span>
                <button
                  onClick={() => handleCopy(note)}
                  style={{
                    fontSize: 11, fontWeight: 600,
                    color: copiedId === note.id ? '#22c55e' : 'var(--tr-text-muted)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                    transition: 'color 150ms',
                  }}
                >
                  {copiedId === note.id ? '✓' : (isRtl ? 'نسخ' : 'Copy')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer link */}
        <div style={{ padding: 8, textAlign: 'center', borderTop: '1px solid var(--tr-border-subtle)', flexShrink: 0 }}>
          <Link
            href="/tareeq/notebook"
            onClick={onClose}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--tr-gold)', textDecoration: 'none' }}
          >
            {isRtl ? 'فتح الدفتر كاملاً ←' : 'Open full notebook →'}
          </Link>
        </div>
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
