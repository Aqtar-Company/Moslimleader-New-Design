'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ── Constants ───────────────────────────────────────────────────────────── */

const CFG_KEY   = 'tareeq_satisfaction_cfg';
const CNT_PREFIX = 'tareeq_satisfaction_count_';

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${CNT_PREFIX}${yyyy}-${mm}-${dd}`;
}

interface SatisfactionCfg {
  enabled: boolean;
  limit: number;
}

function readCfg(): SatisfactionCfg {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SatisfactionCfg>;
      return {
        enabled: parsed.enabled ?? false,
        limit:   parsed.limit   ?? 30,
      };
    }
  } catch {
    // ignore parse errors
  }
  return { enabled: false, limit: 30 };
}

function writeCfg(cfg: SatisfactionCfg): void {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

/* ── Singleton counter (module-level so all cards share one Set) ─────────── */
const _seenPosts = new Set<string>();
let _firedToday = false;

/* ── Hook: useSatisfactionCounter ────────────────────────────────────────── */

/**
 * Returns a `trackPost(postId)` function. Call it inside each TareeqCard.
 * All cards share a single module-level Set so the count accumulates across
 * the whole feed session, not per-card.
 */
export function useSatisfactionCounter() {
  const trackPost = useCallback((postId: string) => {
    const cfg = readCfg();
    if (!cfg.enabled) return;

    if (_seenPosts.has(postId)) return;
    _seenPosts.add(postId);

    const count = _seenPosts.size;

    try {
      localStorage.setItem(todayKey(), String(count));
    } catch {
      // quota exceeded — non-fatal
    }

    if (!_firedToday && count >= cfg.limit) {
      _firedToday = true;
      window.dispatchEvent(
        new CustomEvent('tareeq-satisfaction-reached', { detail: { count } }),
      );
    }
  }, []);

  return { trackPost };
}

/* ── TareeqSatisfactionGate ──────────────────────────────────────────────── */

/**
 * Mount once inside TareeqShell. Listens for `tareeq-satisfaction-reached`
 * and shows a full-screen modal portal.
 */
export function TareeqSatisfactionGate() {
  const [visible, setVisible] = useState(false);
  const [count,   setCount]   = useState(0);
  const [mounted, setMounted] = useState(false);

  // Portal needs document.body — only available client-side
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ count: number }>).detail;
      setCount(detail?.count ?? 0);
      setVisible(true);
    };
    window.addEventListener('tareeq-satisfaction-reached', handler);
    return () => window.removeEventListener('tareeq-satisfaction-reached', handler);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!mounted || !visible) return null;

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      dir="rtl"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9999,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'var(--tr-overlay, rgba(0,0,0,0.75))',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setVisible(false); }}
    >
      <div
        style={{
          background:   'var(--tr-raised, #1a1f14)',
          border:       '1px solid var(--tr-border-soft, rgba(255,255,255,0.08))',
          borderRadius: 24,
          padding:      '40px 32px 32px',
          maxWidth:     360,
          width:        '90%',
          display:      'flex',
          flexDirection:'column',
          alignItems:   'center',
          gap:          16,
          boxShadow:    '0 24px 64px rgba(0,0,0,0.5)',
          textAlign:    'center',
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 48, lineHeight: 1 }}>🎉</div>

        {/* Heading */}
        <h2
          style={{
            margin:     0,
            fontSize:   22,
            fontWeight: 800,
            color:      'var(--tr-gold, #c9a84c)',
            lineHeight: 1.3,
          }}
        >
          أكملت جولتك اليوم
        </h2>

        {/* Sub-text */}
        <p
          style={{
            margin:     0,
            fontSize:   15,
            color:      'var(--tr-text-muted, #8a8f80)',
            lineHeight: 1.6,
          }}
        >
          لقد شاهدت{' '}
          <span style={{ color: 'var(--tr-text-primary, #e8ead4)', fontWeight: 700 }}>
            {count}
          </span>{' '}
          علامة — حافظت على وقتك
        </p>

        {/* Divider */}
        <div
          style={{
            width:      '100%',
            height:     1,
            background: 'var(--tr-border-soft, rgba(255,255,255,0.08))',
            margin:     '4px 0',
          }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {/* Primary — dismiss (satisfied) */}
          <button
            onClick={() => setVisible(false)}
            style={{
              background:   'var(--tr-gold, #c9a84c)',
              color:        '#0a0d06',
              border:       'none',
              borderRadius: 14,
              padding:      '13px 24px',
              fontSize:     15,
              fontWeight:   800,
              cursor:       'pointer',
              width:        '100%',
              transition:   'opacity 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            اكتفيت، شكراً
          </button>

          {/* Secondary — continue browsing */}
          <button
            onClick={() => setVisible(false)}
            style={{
              background:   'transparent',
              color:        'var(--tr-text-muted, #8a8f80)',
              border:       '1px solid var(--tr-border-soft, rgba(255,255,255,0.08))',
              borderRadius: 14,
              padding:      '11px 24px',
              fontSize:     14,
              fontWeight:   600,
              cursor:       'pointer',
              width:        '100%',
              transition:   'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay, rgba(255,255,255,0.06))';
              (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-primary, #e8ead4)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-muted, #8a8f80)';
            }}
          >
            واصل رغم ذلك
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

/* ── TareeqSatisfactionSettings ─────────────────────────────────────────── */

/**
 * Inline settings UI — drop inside any settings panel.
 */
export function TareeqSatisfactionSettings() {
  const [cfg, setCfg] = useState<SatisfactionCfg>({ enabled: false, limit: 30 });

  // Hydrate from localStorage after mount
  useEffect(() => {
    setCfg(readCfg());
  }, []);

  function setEnabled(enabled: boolean) {
    const next = { ...cfg, enabled };
    setCfg(next);
    writeCfg(next);
  }

  function setLimit(limit: number) {
    const clamped = Math.min(200, Math.max(10, limit));
    const next = { ...cfg, limit: clamped };
    setCfg(next);
    writeCfg(next);
  }

  return (
    <div
      dir="rtl"
      style={{
        background:   'var(--tr-surface, #121612)',
        border:       '1px solid var(--tr-border-soft, rgba(255,255,255,0.08))',
        borderRadius: 16,
        padding:      '16px 18px',
        display:      'flex',
        flexDirection:'column',
        gap:          14,
      }}
    >
      {/* Toggle row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--tr-text-primary, #e8ead4)' }}>
            وضع الاكتفاء
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tr-text-muted, #8a8f80)' }}>
            حدّ يومي لعدد المنشورات
          </p>
        </div>

        {/* Toggle switch */}
        <button
          role="switch"
          aria-checked={cfg.enabled}
          onClick={() => setEnabled(!cfg.enabled)}
          style={{
            position:     'relative',
            width:        44,
            height:       24,
            borderRadius: 12,
            border:       'none',
            cursor:       'pointer',
            padding:      0,
            flexShrink:   0,
            background:   cfg.enabled ? 'var(--tr-gold, #c9a84c)' : 'var(--tr-border-soft, rgba(255,255,255,0.12))',
            transition:   'background 0.2s',
          }}
        >
          <span
            style={{
              position:    'absolute',
              top:         3,
              insetInlineStart: cfg.enabled ? 'calc(100% - 21px)' : 3,
              width:       18,
              height:      18,
              borderRadius:'50%',
              background:  cfg.enabled ? '#0a0d06' : '#fff',
              transition:  'inset-inline-start 0.2s',
              display:     'block',
            }}
          />
        </button>
      </div>

      {/* Limit input — only shown when enabled */}
      {cfg.enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label
            style={{ fontSize: 13, color: 'var(--tr-text-muted, #8a8f80)', fontWeight: 600 }}
          >
            عدد المنشورات اليومية: {cfg.limit}
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Decrement */}
            <button
              onClick={() => setLimit(cfg.limit - 10)}
              disabled={cfg.limit <= 10}
              style={{
                width:        32,
                height:       32,
                borderRadius: 8,
                border:       '1px solid var(--tr-border-soft, rgba(255,255,255,0.08))',
                background:   'var(--tr-raised, #1a1f14)',
                color:        'var(--tr-text-primary, #e8ead4)',
                cursor:       cfg.limit <= 10 ? 'not-allowed' : 'pointer',
                fontSize:     18,
                lineHeight:   1,
                opacity:      cfg.limit <= 10 ? 0.4 : 1,
                flexShrink:   0,
              }}
            >
              −
            </button>

            {/* Number input */}
            <input
              type="number"
              min={10}
              max={200}
              step={10}
              value={cfg.limit}
              onChange={e => setLimit(Number(e.target.value))}
              style={{
                flex:         1,
                textAlign:    'center',
                background:   'var(--tr-raised, #1a1f14)',
                border:       '1px solid var(--tr-border-soft, rgba(255,255,255,0.08))',
                borderRadius: 8,
                color:        'var(--tr-text-primary, #e8ead4)',
                fontSize:     15,
                fontWeight:   700,
                padding:      '6px 8px',
                outline:      'none',
              }}
            />

            {/* Increment */}
            <button
              onClick={() => setLimit(cfg.limit + 10)}
              disabled={cfg.limit >= 200}
              style={{
                width:        32,
                height:       32,
                borderRadius: 8,
                border:       '1px solid var(--tr-border-soft, rgba(255,255,255,0.08))',
                background:   'var(--tr-raised, #1a1f14)',
                color:        'var(--tr-text-primary, #e8ead4)',
                cursor:       cfg.limit >= 200 ? 'not-allowed' : 'pointer',
                fontSize:     18,
                lineHeight:   1,
                opacity:      cfg.limit >= 200 ? 0.4 : 1,
                flexShrink:   0,
              }}
            >
              +
            </button>
          </div>

          {/* Range hint */}
          <p style={{ margin: 0, fontSize: 11, color: 'var(--tr-text-muted, #8a8f80)' }}>
            من 10 إلى 200 منشور · الخطوة 10
          </p>
        </div>
      )}
    </div>
  );
}
