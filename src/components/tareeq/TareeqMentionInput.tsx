'use client';
import { useState, useRef, useEffect } from 'react';

interface MentionUser { id: string; name: string; avatarUrl?: string | null; }

interface Props {
  value: string;
  onValueChange: (val: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  style?: React.CSSProperties;
  isRtl?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export default function TareeqMentionInput({
  value, onValueChange, inputRef: externalRef,
  placeholder, maxLength, className, style, isRtl,
  onKeyDown, onFocus, onBlur,
}: Props) {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = externalRef ?? internalRef;
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function detectMention(val: string, cursor: number) {
    const before = val.slice(0, cursor);
    const m = before.match(/@([^\s@]*)$/);
    if (m) {
      setMentionStart(cursor - m[1].length - 1);
      setMentionQuery(m[1]);
      setSelectedIdx(0);
    } else {
      setMentionQuery(null);
      setUsers([]);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onValueChange(val);
    detectMention(val, e.target.selectionStart ?? val.length);
  }

  useEffect(() => {
    if (mentionQuery === null || mentionQuery.length < 1) { setUsers([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tareeq/users/search?q=${encodeURIComponent(mentionQuery)}`, { credentials: 'include' });
        if (res.ok) { const d = await res.json(); setUsers(d.users ?? []); }
      } catch { /* offline */ } finally { setLoading(false); }
    }, 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [mentionQuery]);

  function insertMention(u: MentionUser) {
    const cursor = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const newVal = `${before}@${u.name} ${after}`;
    onValueChange(newVal);
    setMentionQuery(null);
    setUsers([]);
    setTimeout(() => {
      if (ref.current) {
        const pos = before.length + u.name.length + 2;
        ref.current.setSelectionRange(pos, pos);
        ref.current.focus();
      }
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (users.length > 0 && mentionQuery !== null) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, users.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (users[selectedIdx]) { insertMention(users[selectedIdx]); } return; }
      if (e.key === 'Escape') { setMentionQuery(null); setUsers([]); }
    }
    onKeyDown?.(e);
  }

  const showDrop = mentionQuery !== null && (loading || users.length > 0);

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        className={className}
        style={{ width: '100%', ...style }}
      />
      {showDrop && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)',
          ...(isRtl ? { right: 0 } : { left: 0 }),
          minWidth: 200, maxWidth: 280,
          background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.22)', zIndex: 200,
        }}>
          {loading && users.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--tr-text-muted)' }}>...</div>
          ) : (
            users.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 12px', border: 'none', cursor: 'pointer',
                  textAlign: isRtl ? 'right' : 'left',
                  background: i === selectedIdx ? 'var(--tr-overlay)' : 'transparent',
                  transition: 'background 100ms',
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                    {u.name?.charAt(0) ?? '?'}
                  </div>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tr-text-primary)' }}>@{u.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
