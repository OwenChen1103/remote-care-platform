# Slice 10: Admin Dashboard + Demo Seed — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the admin dashboard API & page with sidebar layout, complete seed data for demo, and add route handler tests — enabling the 12-step demo script to run end-to-end.

**Architecture:** Single aggregation API (`GET /api/v1/admin/dashboard`) returns 6 KPI stats + 2 recent lists. Admin layout gets a sidebar with 5 navigation items. Seed adds 2 appointments + 1 AI report for demo completeness.

**Tech Stack:** Next.js 15 (App Router), Prisma, Vitest, Tailwind CSS, Zod

---

### Task 1: Dashboard API Route Handler Tests

**Files:**
- Create: `apps/web/__tests__/admin-dashboard.test.ts`

**Step 1: Write the test file**

```typescript
// apps/web/__tests__/admin-dashboard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  user: { count: vi.fn() },
  recipient: { count: vi.fn() },
  measurement: { count: vi.fn() },
  serviceRequest: { count: vi.fn(), findMany: vi.fn() },
  provider: { count: vi.fn() },
  notification: { count: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

const mockVerifyAuth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({
  verifyAuth: mockVerifyAuth,
  signJwt: vi.fn(() => 'mock-token'),
}));

function createRequest() {
  return new NextRequest(new URL('http://localhost:3000/api/v1/admin/dashboard'), {
    method: 'GET',
  });
}

describe('GET /api/v1/admin/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return dashboard stats for admin', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.user.count.mockResolvedValue(10);
    mockPrisma.recipient.count.mockResolvedValue(15);
    mockPrisma.measurement.count.mockResolvedValue(42);
    mockPrisma.serviceRequest.count.mockResolvedValue(3);
    mockPrisma.provider.count.mockResolvedValue(2);
    mockPrisma.notification.count.mockResolvedValue(5);
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const { GET } = await import('../app/api/v1/admin/dashboard/route');
    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.stats).toEqual({
      total_caregivers: 10,
      total_recipients: 15,
      total_measurements_today: 42,
      pending_service_requests: 3,
      pending_provider_reviews: 2,
      abnormal_alerts_today: 5,
    });
    expect(json.data.recent_pending_requests).toEqual([]);
    expect(json.data.recent_abnormal_alerts).toEqual([]);
  });

  it('should return recent pending requests with category and recipient names', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.recipient.count.mockResolvedValue(0);
    mockPrisma.measurement.count.mockResolvedValue(0);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);
    mockPrisma.provider.count.mockResolvedValue(0);
    mockPrisma.notification.count.mockResolvedValue(0);
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const mockRequest = {
      id: 'req-1',
      preferred_date: new Date('2026-03-25T00:00:00Z'),
      created_at: new Date('2026-03-19T10:00:00Z'),
      category: { name: '陪診師' },
      recipient: { name: '王奶奶' },
    };
    mockPrisma.serviceRequest.findMany.mockResolvedValue([mockRequest]);

    const { GET } = await import('../app/api/v1/admin/dashboard/route');
    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.data.recent_pending_requests).toHaveLength(1);
    expect(json.data.recent_pending_requests[0]).toEqual({
      id: 'req-1',
      category_name: '陪診師',
      recipient_name: '王奶奶',
      preferred_date: '2026-03-25T00:00:00.000Z',
      created_at: '2026-03-19T10:00:00.000Z',
    });
  });

  it('should reject non-admin users', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'user-1', role: 'caregiver' });

    const { GET } = await import('../app/api/v1/admin/dashboard/route');
    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('should reject unauthenticated requests', async () => {
    mockVerifyAuth.mockResolvedValue(null);

    const { GET } = await import('../app/api/v1/admin/dashboard/route');
    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe('AUTH_REQUIRED');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- admin-dashboard`
Expected: FAIL — module `../app/api/v1/admin/dashboard/route` not found

**Step 3: Commit**

```bash
git add apps/web/__tests__/admin-dashboard.test.ts
git commit -m "test(admin): add dashboard API route handler tests (red)"
```

---

### Task 2: Dashboard API Route Implementation

**Files:**
- Create: `apps/web/app/api/v1/admin/dashboard/route.ts`

**Step 1: Implement the dashboard API**

```typescript
// apps/web/app/api/v1/admin/dashboard/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅限管理員存取');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCaregivers,
      totalRecipients,
      totalMeasurementsToday,
      pendingServiceRequests,
      pendingProviderReviews,
      abnormalAlertsToday,
      recentPendingRequests,
      recentAbnormalAlerts,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'caregiver' } }),
      prisma.recipient.count({ where: { deleted_at: null } }),
      prisma.measurement.count({ where: { measured_at: { gte: today } } }),
      prisma.serviceRequest.count({ where: { status: 'submitted' } }),
      prisma.provider.count({ where: { review_status: 'pending', deleted_at: null } }),
      prisma.notification.count({ where: { type: 'abnormal_alert', created_at: { gte: today } } }),
      prisma.serviceRequest.findMany({
        where: { status: 'submitted' },
        orderBy: { created_at: 'desc' },
        take: 5,
        include: {
          category: { select: { name: true } },
          recipient: { select: { name: true } },
        },
      }),
      prisma.notification.findMany({
        where: { type: 'abnormal_alert' },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { id: true, title: true, body: true, created_at: true },
      }),
    ]);

    return successResponse({
      stats: {
        total_caregivers: totalCaregivers,
        total_recipients: totalRecipients,
        total_measurements_today: totalMeasurementsToday,
        pending_service_requests: pendingServiceRequests,
        pending_provider_reviews: pendingProviderReviews,
        abnormal_alerts_today: abnormalAlertsToday,
      },
      recent_pending_requests: recentPendingRequests.map((r) => ({
        id: r.id,
        category_name: r.category.name,
        recipient_name: r.recipient.name,
        preferred_date: r.preferred_date.toISOString(),
        created_at: r.created_at.toISOString(),
      })),
      recent_abnormal_alerts: recentAbnormalAlerts.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        created_at: n.created_at.toISOString(),
      })),
    });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
```

**Step 2: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- admin-dashboard`
Expected: PASS — all 4 tests green

**Step 3: Commit**

```bash
git add apps/web/app/api/v1/admin/dashboard/route.ts
git commit -m "feat(admin): implement GET /api/v1/admin/dashboard aggregation API"
```

---

### Task 3: Admin Layout with Sidebar

**Files:**
- Modify: `apps/web/app/admin/layout.tsx`

**Step 1: Rewrite admin layout with sidebar**

Replace the entire file:

```typescript
// apps/web/app/admin/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/service-requests', label: '需求單管理' },
  { href: '/admin/providers', label: '服務人員管理' },
  { href: '/admin/recipients', label: '被照護者總覽' },
  { href: '/admin/services', label: '服務類別管理' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  // Don't show sidebar on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-5">
          <h1 className="text-lg font-bold text-gray-900">遠端照護平台</h1>
          <p className="text-xs text-gray-500">管理後台</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 px-3 py-4">
          <button
            onClick={() => void handleLogout()}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            登出
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

Key points:
- `'use client'` — needs `usePathname` for active link highlighting
- Login page bypassed (no sidebar on `/admin/login`)
- Logout calls `POST /api/v1/auth/logout` which clears the httpOnly cookie
- 5 nav items match existing admin pages
- Active link uses `pathname === href || pathname.startsWith(href + '/')` to match sub-pages

**Step 2: Verify typecheck passes**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/app/admin/layout.tsx
git commit -m "feat(admin): add sidebar navigation layout with active state and logout"
```

---

### Task 4: Dashboard Page with Real Data

**Files:**
- Modify: `apps/web/app/admin/dashboard/page.tsx`

**Step 1: Rewrite dashboard page**

Replace the entire file:

```typescript
// apps/web/app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface DashboardStats {
  total_caregivers: number;
  total_recipients: number;
  total_measurements_today: number;
  pending_service_requests: number;
  pending_provider_reviews: number;
  abnormal_alerts_today: number;
}

interface PendingRequest {
  id: string;
  category_name: string;
  recipient_name: string;
  preferred_date: string;
  created_at: string;
}

interface AbnormalAlert {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface DashboardData {
  stats: DashboardStats;
  recent_pending_requests: PendingRequest[];
  recent_abnormal_alerts: AbnormalAlert[];
}

const STAT_CARDS: { key: keyof DashboardStats; label: string; color: string }[] = [
  { key: 'total_caregivers', label: '委託人數', color: 'text-blue-600' },
  { key: 'total_recipients', label: '被照護者數', color: 'text-green-600' },
  { key: 'total_measurements_today', label: '今日量測數', color: 'text-teal-600' },
  { key: 'pending_service_requests', label: '待處理需求單', color: 'text-orange-600' },
  { key: 'pending_provider_reviews', label: '待審核服務人員', color: 'text-purple-600' },
  { key: 'abnormal_alerts_today', label: '今日異常通知', color: 'text-red-600' },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/dashboard');
      const json = (await res.json()) as { success: boolean; data: DashboardData; error?: { message: string } };
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message ?? '載入失敗');
      }
    } catch {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-6">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="mt-3 h-8 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
        <button
          onClick={() => void fetchDashboard()}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          重試
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>
              {data.stats[card.key]}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Lists */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Pending Requests */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">待處理需求單</h2>
            <Link href="/admin/service-requests" className="text-sm text-blue-600 hover:underline">
              查看全部
            </Link>
          </div>
          {data.recent_pending_requests.length === 0 ? (
            <p className="text-sm text-gray-400">目前沒有待處理的需求單</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recent_pending_requests.map((req) => (
                <li key={req.id}>
                  <Link
                    href={`/admin/service-requests/${req.id}`}
                    className="block py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {req.category_name}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {req.recipient_name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(req.preferred_date).toLocaleDateString('zh-TW')}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Abnormal Alerts */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">異常通知</h2>
          </div>
          {data.recent_abnormal_alerts.length === 0 ? (
            <p className="text-sm text-gray-400">目前沒有異常通知</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recent_abnormal_alerts.map((alert) => (
                <li key={alert.id} className="py-3">
                  <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(alert.created_at).toLocaleString('zh-TW')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

Key points:
- 6 stat cards in responsive 1/2/3 column grid
- Each card has a distinct color for its number
- Pending requests link to detail pages
- Loading state uses skeleton animation
- Error state has retry button
- Empty states have friendly messages

**Step 2: Verify typecheck passes**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/app/admin/dashboard/page.tsx
git commit -m "feat(admin): implement real-time dashboard with 6 KPI cards and recent lists"
```

---

### Task 5: Seed Appointments and AI Report

**Files:**
- Modify: `apps/web/prisma/seed.ts`

**Step 1: Add seedAppointments and seedAiReport functions**

Add two new functions to `seed.ts` and call them from `main()`.

After the existing `seedProviderNotifications` call (around line 122), add:

```typescript
    // Add these lines after seedProviderNotifications (line 122 area):
    await seedAppointments(wangRecipient.id);
    await seedAiReport(wangRecipient.id);
```

Update the console.log on line 125 to:

```typescript
  console.log('Seed completed: roles + recipients + measurements + reminders + service categories + providers + requests + notifications + appointments + ai-report');
```

Add these two new functions before the `main()` call at the bottom of the file:

```typescript
async function seedAppointments(recipientId: string) {
  const existing = await prisma.appointment.count({
    where: { recipient_id: recipientId },
  });
  if (existing > 0) return;

  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  in7Days.setHours(10, 0, 0, 0);

  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);
  in14Days.setHours(14, 30, 0, 0);

  await prisma.appointment.createMany({
    data: [
      {
        recipient_id: recipientId,
        title: '心臟內科回診',
        hospital_name: '台大醫院',
        department: '心臟內科',
        doctor_name: '林醫師',
        appointment_date: in7Days,
        note: '攜帶血壓紀錄本及藥袋',
      },
      {
        recipient_id: recipientId,
        title: '新陳代謝科回診',
        hospital_name: '國泰醫院',
        department: '新陳代謝科',
        doctor_name: '陳醫師',
        appointment_date: in14Days,
        note: '需空腹抽血，前一晚 10 點後禁食',
      },
    ],
  });
}

async function seedAiReport(recipientId: string) {
  const existing = await prisma.aiReport.count({
    where: { recipient_id: recipientId },
  });
  if (existing > 0) return;

  await prisma.aiReport.create({
    data: {
      recipient_id: recipientId,
      report_type: 'weekly',
      status_label: '需留意',
      summary: '過去一週血壓偏高趨勢明顯，收縮壓多次超過 140 mmHg，血糖控制尚可但空腹血糖略有上升趨勢。建議密切關注血壓變化並諮詢醫師是否需調整用藥。',
      reasons: JSON.stringify([
        '近 7 日收縮壓平均 135 mmHg，有 3 次超過 140 mmHg',
        '舒張壓平均 82 mmHg，屬正常偏高範圍',
        '空腹血糖平均 95 mg/dL，較前週上升 5 mg/dL',
      ]),
      suggestions: JSON.stringify([
        '建議每日固定時間量測血壓，早晚各一次',
        '下次回診時攜帶血壓紀錄供醫師參考',
        '注意飲食中鈉的攝取，減少加工食品',
        '維持適度運動，如每日步行 30 分鐘',
      ]),
      model: 'seed-data',
      input_tokens: 0,
      output_tokens: 0,
    },
  });
}
```

**Step 2: Verify seed runs successfully**

Run: `cd apps/web && pnpm prisma db seed`
Expected: Output ends with `Seed completed: roles + recipients + measurements + reminders + service categories + providers + requests + notifications + appointments + ai-report`

**Step 3: Commit**

```bash
git add apps/web/prisma/seed.ts
git commit -m "feat(seed): add appointments and AI report for demo completeness"
```

---

### Task 6: Full CI Gate

**Files:** None (verification only)

**Step 1: Run lint**

Run: `pnpm lint`
Expected: PASS — zero errors, zero warnings

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Run tests**

Run: `pnpm test`
Expected: PASS — all existing tests + 4 new dashboard tests green

**Step 4: Run build**

Run: `pnpm build`
Expected: PASS

**Step 5: Commit any fixes if needed**

If any CI step fails, fix the issue and commit the fix.

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Dashboard API tests (TDD red) | `apps/web/__tests__/admin-dashboard.test.ts` |
| 2 | Dashboard API implementation (TDD green) | `apps/web/app/api/v1/admin/dashboard/route.ts` |
| 3 | Admin layout with sidebar | `apps/web/app/admin/layout.tsx` |
| 4 | Dashboard page with real data | `apps/web/app/admin/dashboard/page.tsx` |
| 5 | Seed appointments + AI report | `apps/web/prisma/seed.ts` |
| 6 | Full CI gate verification | — |
