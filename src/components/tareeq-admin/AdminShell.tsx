'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AdminRole = 'SUPER_ADMIN' | 'MODERATOR' | 'SUPPORT' | 'SECURITY';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

// ── Permission map ─────────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: [
    'dashboard', 'users.view', 'content.moderate', 'reports.view',
    'security.view', 'audit.view', 'features.manage', 'settings.manage',
    'notifications.send', 'support.view', 'health.view', 'roles.manage',
  ],
  MODERATOR: [
    'dashboard', 'users.view', 'content.moderate', 'reports.view',
    'notifications.send', 'support.view',
  ],
  SUPPORT: [
    'dashboard', 'users.view', 'reports.view', 'support.view',
  ],
  SECURITY: [
    'dashboard', 'users.view', 'security.view', 'audit.view', 'health.view',
  ],
};

function can(role: AdminRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ── Nav items ──────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: string;
  permission: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'لوحة التحكم', href: '/tareeq-admin/dashboard',     icon: '📊', permission: 'dashboard' },
  { label: 'المستخدمون',  href: '/tareeq-admin/users',         icon: '👥', permission: 'users.view' },
  { label: 'المحتوى',     href: '/tareeq-admin/content',       icon: '📝', permission: 'content.moderate' },
  { label: 'البلاغات',    href: '/tareeq-admin/reports',       icon: '🚨', permission: 'reports.view' },
  { label: 'الأمان',      href: '/tareeq-admin/security',      icon: '🔒', permission: 'security.view' },
  { label: 'سجل الأحداث', href: '/tareeq-admin/audit',         icon: '📋', permission: 'audit.view' },
  { label: 'الميزات',     href: '/tareeq-admin/features',      icon: '🚀', permission: 'features.manage' },
  { label: 'الإعدادات',   href: '/tareeq-admin/settings',      icon: '⚙️', permission: 'settings.manage' },
  { label: 'الإشعارات',   href: '/tareeq-admin/notifications', icon: '🔔', permission: 'notifications.send' },
  { label: 'الدعم',       href: '/tareeq-admin/support',       icon: '💬', permission: 'support.view' },
  { label: 'صحة النظام',  href: '/tareeq-admin/health',        icon: '❤️', permission: 'health.view' },
  { label: 'الأدمنز',     href: '/tareeq-admin/admins',        icon: '👑', permission: 'roles.manage' },
];

// ── Context ────────────────────────────────────────────────────────────────────

interface AdminContextValue {
  admin: AdminUser | null;
  can: (permission: string) => boolean;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue>({
  admin: null,
  can: () => false,
  logout: async () => {},
});

export function useAdminContext() {
  return useContext(AdminContext);
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function ShellSkeleton() {
  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: '#0f172a' }}>
      <div style={{ width: '240px', background: '#0f172a', borderLeft: '1px solid #334155', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '60px', background: '#1e293b', borderBottom: '1px solid #334155' }} />
        <div style={{ flex: 1, padding: '2rem' }}>
          <div style={{ height: '200px', background: '#1e293b', borderRadius: '12px', opacity: 0.5 }} />
        </div>
      </div>
    </div>
  );
}

// ── Main Shell ─────────────────────────────────────────────────────────────────

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/tareeq-admin/auth/me', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) {
          router.replace('/tareeq-admin/login');
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (data?.admin) setAdmin(data.admin);
      })
      .catch(() => router.replace('/tareeq-admin/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const logout = useCallback(async () => {
    await fetch('/api/tareeq-admin/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/tareeq-admin/login');
  }, [router]);

  const checkCan = useCallback(
    (permission: string) => (admin ? can(admin.role, permission) : false),
    [admin]
  );

  if (loading) return <ShellSkeleton />;
  if (!admin) return null;

  const visibleNav = NAV_ITEMS.filter(item => checkCan(item.permission));

  const roleLabel: Record<AdminRole, string> = {
    SUPER_ADMIN: 'مدير عام',
    MODERATOR: 'مشرف',
    SUPPORT: 'دعم فني',
    SECURITY: 'أمان',
  };

  return (
    <AdminContext.Provider value={{ admin, can: checkCan, logout }}>
      <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', position: 'relative' }}>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 40, display: 'none',
            }}
            className="mobile-overlay"
          />
        )}

        {/* Sidebar */}
        <aside
          style={{
            width: '240px',
            background: '#0f172a',
            borderLeft: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
            zIndex: 50,
          }}
          className="admin-sidebar"
        >
          {/* Sidebar header */}
          <div
            style={{
              padding: '1.25rem 1rem',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '36px', height: '36px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', flexShrink: 0,
              }}
            >
              🛡️
            </div>
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>
                طريق
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>لوحة التحكم</div>
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: '0.75rem 0' }}>
            {visibleNav.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 1rem',
                    margin: '0.1rem 0.5rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: isActive ? '#f59e0b' : '#94a3b8',
                    background: isActive ? 'rgba(245,158,11,0.1)' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.875rem',
                    transition: 'all 0.15s',
                    borderRight: isActive ? '3px solid #f59e0b' : '3px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.color = '#cbd5e1';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#94a3b8';
                    }
                  }}
                >
                  <span style={{ fontSize: '16px', minWidth: '20px', textAlign: 'center' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Admin info at bottom */}
          <div style={{ padding: '0.75rem', borderTop: '1px solid #1e293b' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 0.75rem',
                background: '#1e293b',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  width: '32px', height: '32px',
                  background: '#334155',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', flexShrink: 0,
                }}
              >
                {admin.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f1f5f9', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {admin.name}
                </div>
                <div style={{ color: '#f59e0b', fontSize: '0.7rem' }}>
                  {roleLabel[admin.role]}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <header
            style={{
              height: '60px',
              background: '#1e293b',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 1.5rem',
              position: 'sticky',
              top: 0,
              zIndex: 30,
              flexShrink: 0,
            }}
          >
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'none', border: 'none', color: '#94a3b8',
                fontSize: '1.25rem', cursor: 'pointer',
                display: 'none', padding: '0.5rem',
              }}
              className="hamburger-btn"
              aria-label="فتح القائمة"
            >
              ☰
            </button>

            {/* Breadcrumb / page title */}
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              {visibleNav.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.label || ''}
            </div>

            {/* Right side: name + logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{admin.name}</span>
                <span style={{
                  background: 'rgba(245,158,11,0.15)',
                  color: '#f59e0b',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}>
                  {roleLabel[admin.role]}
                </span>
              </span>
              <button
                onClick={logout}
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px',
                  color: '#f87171',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                }}
              >
                تسجيل الخروج
              </button>
            </div>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {children}
          </main>
        </div>

        {/* Responsive styles */}
        <style>{`
          @media (max-width: 768px) {
            .admin-sidebar {
              position: fixed !important;
              right: ${sidebarOpen ? '0' : '-240px'} !important;
              transition: right 0.3s ease;
            }
            .mobile-overlay { display: block !important; }
            .hamburger-btn { display: block !important; }
          }
        `}</style>
      </div>
    </AdminContext.Provider>
  );
}
