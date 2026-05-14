'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  Eye,
  Heart,
  History,
  LayoutDashboard,
  LogOut,
  Tag,
  UserCog,
  Users,
} from 'lucide-react';
import { Breadcrumbs, ToastProvider } from '@/components/admin';

type NavGroup = {
  title: string;
  items: { href: string; label: string; Icon: React.ComponentType<{ className?: string }> }[];
};

// Grouped sidebar — first-impression scan should match the admin's mental model:
//   "core work" → "configuration" → "system"
const NAV_GROUPS: NavGroup[] = [
  {
    title: '日常工作',
    items: [
      { href: '/admin/dashboard',        label: 'Dashboard',       Icon: LayoutDashboard },
      { href: '/admin/service-requests', label: '需求單管理',      Icon: ClipboardList },
      { href: '/admin/providers',        label: '服務人員管理',    Icon: UserCog },
      { href: '/admin/recipients',       label: '被照護者總覽',    Icon: Heart },
      { href: '/admin/reports',          label: '月報表',          Icon: BarChart3 },
    ],
  },
  {
    title: '設定',
    items: [
      { href: '/admin/users',    label: '使用者管理', Icon: Users },
      { href: '/admin/services', label: '服務類別',   Icon: Tag },
    ],
  },
  {
    title: '系統',
    items: [
      { href: '/admin/preview',   label: '角色預覽', Icon: Eye },
      { href: '/admin/audit-log', label: '審核日誌', Icon: History },
    ],
  },
];

interface CurrentAdmin {
  id: string;
  name: string;
  email: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<CurrentAdmin | null>(null);

  // Fetch the currently-logged-in admin once on mount so the sidebar footer
  // can show their name + email. Same endpoint the users page uses for the
  // self-suspend guard, so no new server work.
  useEffect(() => {
    if (pathname === '/admin/login') return;
    void (async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        const json = (await res.json()) as {
          success: boolean;
          data?: CurrentAdmin;
        };
        if (json.success && json.data) setAdmin(json.data);
      } catch { /* sidebar footer falls back to generic label */ }
    })();
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  // Don't show sidebar/toast on login page (which has its own minimal layout).
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <ToastProvider>
      {/* `admin-shell` class scopes the global border-color default in
          globals.css to this subtree, so non-admin routes (if any are added
          later) don't inherit the admin design system. */}
      <div className="admin-shell flex min-h-screen bg-surface-subtle">
        <aside className="flex w-64 shrink-0 flex-col border-r border-outline bg-white">
          {/* Brand mark */}
          <div className="flex items-center gap-3 border-b border-outline px-5 py-5">
            <Image
              src="/brand/whocares-icon.png"
              alt="WhoCares"
              width={36}
              height={36}
              className="rounded-lg"
              priority
            />
            <div className="leading-tight">
              <p className="text-base font-bold text-ink-900">WhoCares</p>
              <p className="text-xs text-ink-500">管理後台</p>
            </div>
          </div>

          {/* Navigation — grouped */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.title} className={gi > 0 ? 'mt-6' : ''}>
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                            isActive
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-ink-700 hover:bg-surface-alt hover:text-ink-900'
                          }`}
                        >
                          {isActive && (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500"
                            />
                          )}
                          <item.Icon
                            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                              isActive ? 'text-brand-600' : 'text-ink-500 group-hover:text-ink-700'
                            }`}
                          />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Footer — current admin + logout */}
          <div className="border-t border-outline p-3">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {(admin?.name?.charAt(0) ?? 'A').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">
                  {admin?.name ?? '管理員'}
                </p>
                <p className="truncate text-xs text-ink-500">
                  {admin?.email ?? '—'}
                </p>
              </div>
            </div>
            <button
              onClick={() => void handleLogout()}
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-surface-alt hover:text-ink-900"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0 text-ink-500" />
              <span>登出</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-8 py-8">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
