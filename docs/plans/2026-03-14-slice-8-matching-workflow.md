# Slice 8: Matching Workflow 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 實作平台介入式媒合流程：Admin 提出候選服務人員 → 委託人確認 → 服務人員確認 → 自動安排，完成最小雙向確認閉環。

**Architecture:** 新增 3 個 API 端點（propose-candidate、confirm-caregiver、confirm-provider），擴展既有 status route 白名單以支援 Slice 8 狀態回退。前端分別在 Admin 詳情頁新增候選提出 UI、Mobile 委託人詳情頁新增確認/拒絕 UI、Mobile 新增最小化服務人員確認頁面。所有狀態轉換嚴格遵循 `VALID_STATUS_TRANSITIONS` 狀態機。

**Tech Stack:** Next.js API Routes, Prisma, Zod (shared schemas), Vitest (mocked Prisma), React (Admin), React Native/Expo (Mobile)

**Engineering Standards Compliance:**
- E.8：狀態轉換集中於 `VALID_STATUS_TRANSITIONS`；僅 admin 操作媒合狀態；僅 provider 操作執行狀態；雙方確認後才 arranged
- RBAC：propose-candidate = admin only；confirm-caregiver = caregiver (owner)；confirm-provider = provider (candidate only)
- Testing：TDD — 先寫失敗測試，再實作，再驗證通過

**State Machine Transitions (Slice 8 scope):**
```
screening ──[admin propose-candidate]──► candidate_proposed
candidate_proposed ──[caregiver confirm=true]──► caregiver_confirmed
candidate_proposed ──[caregiver confirm=false]──► screening (clear candidate)
candidate_proposed ──[admin status]──► screening (return)
caregiver_confirmed ──[provider confirm=true]──► provider_confirmed ──[auto]──► arranged
caregiver_confirmed ──[provider confirm=false]──► screening
caregiver_confirmed ──[admin status]──► screening (return)
```

**Existing Schemas (already in shared package, no changes needed):**
- `ServiceRequestProposeCandidateSchema` — `{ provider_id: uuid, admin_note?: string }`
- `ServiceRequestCaregiverConfirmSchema` — `{ confirm: boolean, note?: string(500) }`
- `ServiceRequestProviderConfirmSchema` — `{ confirm: boolean, provider_note?: string(1000) }`

**Existing DB Fields (already in Prisma schema, no migration needed):**
- `candidate_provider_id`, `assigned_provider_id`, `caregiver_confirmed_at`, `provider_confirmed_at`, `provider_note`

---

## Task 1: Expand Status Route Whitelist + Tests

**Why:** Slice 7 limited admin status writes to `submitted↔screening`. Slice 8 needs admin to return requests from `candidate_proposed` or `caregiver_confirmed` back to `screening`.

**Files:**
- Modify: `apps/web/app/api/v1/service-requests/[id]/status/route.ts`
- Modify: `apps/web/__tests__/service-requests.test.ts`

### Step 1: Write failing tests for new transitions

Add these tests to the existing `PUT /service-requests/:id/status` describe block in `apps/web/__tests__/service-requests.test.ts`:

```typescript
it('admin can transition candidate_proposed → screening (return)', async () => {
  mockPrisma.serviceRequest.findUnique.mockResolvedValue({
    ...mockServiceRequest,
    status: 'candidate_proposed',
    candidate_provider_id: IDS.providerId,
  });
  mockPrisma.serviceRequest.update.mockResolvedValue({
    ...mockServiceRequest,
    status: 'screening',
  });

  const req = createRequest('PUT', { status: 'screening' }, {
    Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
  }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
  const res = await updateStatus(req, { params });
  expect(res.status).toBe(200);
});

it('admin can transition caregiver_confirmed → screening (return)', async () => {
  mockPrisma.serviceRequest.findUnique.mockResolvedValue({
    ...mockServiceRequest,
    status: 'caregiver_confirmed',
    candidate_provider_id: IDS.providerId,
    caregiver_confirmed_at: new Date(),
  });
  mockPrisma.serviceRequest.update.mockResolvedValue({
    ...mockServiceRequest,
    status: 'screening',
  });

  const req = createRequest('PUT', { status: 'screening' }, {
    Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
  }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
  const res = await updateStatus(req, { params });
  expect(res.status).toBe(200);
});

it('rejects invalid transition candidate_proposed → arranged', async () => {
  mockPrisma.serviceRequest.findUnique.mockResolvedValue({
    ...mockServiceRequest,
    status: 'candidate_proposed',
  });

  const req = createRequest('PUT', { status: 'arranged' }, {
    Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
  }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/status`);
  const res = await updateStatus(req, { params });
  expect(res.status).toBe(400);
});
```

### Step 2: Run tests to verify they fail

Run: `cd apps/web && pnpm test -- --run service-requests`
Expected: 2 tests FAIL (candidate_proposed → screening, caregiver_confirmed → screening return 400 because whitelist doesn't include them)

### Step 3: Expand ALLOWED_TRANSITIONS in status route

In `apps/web/app/api/v1/service-requests/[id]/status/route.ts`, replace the `ALLOWED_TRANSITIONS` constant:

```typescript
// Slice 7 + Slice 8: admin status transitions whitelist
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  submitted: ['screening'],
  screening: ['submitted'],
  candidate_proposed: ['screening'],
  caregiver_confirmed: ['screening'],
};
```

### Step 4: Run tests to verify they pass

Run: `cd apps/web && pnpm test -- --run service-requests`
Expected: All tests PASS

### Step 5: Commit

```bash
git add apps/web/app/api/v1/service-requests/[id]/status/route.ts apps/web/__tests__/service-requests.test.ts
git commit -m "feat(api): expand status route whitelist for slice 8 matching returns"
```

---

## Task 2: Propose Candidate API — Tests

**Why:** Admin needs to propose a candidate provider for a service request in screening status.

**Files:**
- Create: `apps/web/app/api/v1/service-requests/[id]/propose-candidate/route.ts`
- Modify: `apps/web/__tests__/service-requests.test.ts`

### Step 1: Write failing tests

Add a new describe block in `apps/web/__tests__/service-requests.test.ts`:

```typescript
// At the top, add imports:
import { PUT as proposeCandidate } from '../app/api/v1/service-requests/[id]/propose-candidate/route';

// Add to mockPrisma (before vi.mock):
// provider: { findFirst: vi.fn(), findUnique: vi.fn() },
// Update the mockPrisma to include provider.findUnique

// ─── PUT /service-requests/:id/propose-candidate ───

describe('PUT /api/v1/service-requests/:id/propose-candidate', () => {
  const params = Promise.resolve({ id: IDS.request });

  const mockProvider = {
    id: IDS.providerId,
    user_id: IDS.provider,
    name: '陳護理師',
    review_status: 'approved',
    availability_status: 'available',
    deleted_at: null,
  };

  it('admin proposes candidate successfully', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });
    mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });

    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('candidate_proposed');
  });

  it('rejects non-admin', async () => {
    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects when not in screening status', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'submitted',
    });

    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    expect(res.status).toBe(400);
  });

  it('rejects unapproved provider', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });
    mockPrisma.provider.findUnique.mockResolvedValue({
      ...mockProvider,
      review_status: 'pending',
    });

    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-existent provider', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });
    mockPrisma.provider.findUnique.mockResolvedValue(null);

    const req = createRequest('PUT', { provider_id: IDS.providerId }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/propose-candidate`);
    const res = await proposeCandidate(req, { params });
    expect(res.status).toBe(404);
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd apps/web && pnpm test -- --run service-requests`
Expected: FAIL — cannot import `propose-candidate/route` (file doesn't exist)

### Step 3: Commit test (red phase)

```bash
git add apps/web/__tests__/service-requests.test.ts
git commit -m "test(api): add propose-candidate endpoint tests (red)"
```

---

## Task 3: Propose Candidate API — Implementation

**Files:**
- Create: `apps/web/app/api/v1/service-requests/[id]/propose-candidate/route.ts`

### Step 1: Implement the endpoint

Create `apps/web/app/api/v1/service-requests/[id]/propose-candidate/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { ServiceRequestProposeCandidateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }

    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可提出候選服務人員');
    }

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceRequestProposeCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!serviceRequest) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務需求');
    }

    if (serviceRequest.status !== 'screening') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        `僅審核中的需求可提出候選，目前狀態為「${serviceRequest.status}」`,
      );
    }

    const provider = await prisma.provider.findUnique({
      where: { id: parsed.data.provider_id },
    });
    if (!provider) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務人員');
    }
    if (provider.review_status !== 'approved') {
      return errorResponse('VALIDATION_ERROR', '此服務人員尚未通過審核');
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'candidate_proposed',
        candidate_provider_id: parsed.data.provider_id,
        admin_note: parsed.data.admin_note ?? serviceRequest.admin_note,
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
        candidate_provider: { select: { id: true, name: true } },
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
```

### Step 2: Run tests to verify they pass

Run: `cd apps/web && pnpm test -- --run service-requests`
Expected: All propose-candidate tests PASS

### Step 3: Commit

```bash
git add apps/web/app/api/v1/service-requests/[id]/propose-candidate/route.ts
git commit -m "feat(api): implement propose-candidate endpoint"
```

---

## Task 4: Caregiver Confirm API — Tests

**Files:**
- Modify: `apps/web/__tests__/service-requests.test.ts`

### Step 1: Write failing tests

Add import and new describe block:

```typescript
// Import at the top:
import { PUT as confirmCaregiver } from '../app/api/v1/service-requests/[id]/confirm-caregiver/route';

// ─── PUT /service-requests/:id/confirm-caregiver ───

describe('PUT /api/v1/service-requests/:id/confirm-caregiver', () => {
  const params = Promise.resolve({ id: IDS.request });

  it('caregiver confirms candidate successfully', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'caregiver_confirmed',
      caregiver_confirmed_at: new Date(),
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('caregiver_confirmed');
  });

  it('caregiver rejects candidate → back to screening', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
      candidate_provider_id: null,
    });

    const req = createRequest('PUT', { confirm: false, note: '時間無法配合' }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('screening');
    expect(json.data.candidate_provider_id).toBeNull();
  });

  it('rejects non-caregiver', async () => {
    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects other caregiver (ownership)', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.otherCaregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects when not in candidate_proposed status', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-caregiver`);
    const res = await confirmCaregiver(req, { params });
    expect(res.status).toBe(400);
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd apps/web && pnpm test -- --run service-requests`
Expected: FAIL — cannot import file

### Step 3: Commit test (red phase)

```bash
git add apps/web/__tests__/service-requests.test.ts
git commit -m "test(api): add confirm-caregiver endpoint tests (red)"
```

---

## Task 5: Caregiver Confirm API — Implementation

**Files:**
- Create: `apps/web/app/api/v1/service-requests/[id]/confirm-caregiver/route.ts`

### Step 1: Implement the endpoint

Create `apps/web/app/api/v1/service-requests/[id]/confirm-caregiver/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { ServiceRequestCaregiverConfirmSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }

    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'caregiver') {
      return errorResponse('AUTH_FORBIDDEN', '僅委託人可確認候選服務人員');
    }

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceRequestCaregiverConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!serviceRequest) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務需求');
    }

    // Ownership check
    if (serviceRequest.caregiver_id !== auth.userId) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此服務需求');
    }

    if (serviceRequest.status !== 'candidate_proposed') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        `目前狀態「${serviceRequest.status}」無法執行確認操作`,
      );
    }

    const updateData = parsed.data.confirm
      ? {
          status: 'caregiver_confirmed' as const,
          caregiver_confirmed_at: new Date(),
          admin_note: parsed.data.note
            ? `${serviceRequest.admin_note ? serviceRequest.admin_note + '\n' : ''}委託人備註：${parsed.data.note}`
            : serviceRequest.admin_note,
        }
      : {
          status: 'screening' as const,
          candidate_provider_id: null,
          caregiver_confirmed_at: null,
          admin_note: parsed.data.note
            ? `${serviceRequest.admin_note ? serviceRequest.admin_note + '\n' : ''}委託人拒絕候選：${parsed.data.note}`
            : serviceRequest.admin_note,
        };

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
        candidate_provider: { select: { id: true, name: true } },
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
```

### Step 2: Run tests to verify they pass

Run: `cd apps/web && pnpm test -- --run service-requests`
Expected: All confirm-caregiver tests PASS

### Step 3: Commit

```bash
git add apps/web/app/api/v1/service-requests/[id]/confirm-caregiver/route.ts
git commit -m "feat(api): implement confirm-caregiver endpoint"
```

---

## Task 6: Provider Confirm API — Tests

**Files:**
- Modify: `apps/web/__tests__/service-requests.test.ts`

### Step 1: Write failing tests

Add import and new describe block:

```typescript
// Import at the top:
import { PUT as confirmProvider } from '../app/api/v1/service-requests/[id]/confirm-provider/route';

// ─── PUT /service-requests/:id/confirm-provider ───

describe('PUT /api/v1/service-requests/:id/confirm-provider', () => {
  const params = Promise.resolve({ id: IDS.request });

  it('provider confirms → provider_confirmed then auto-arranged', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue({ id: IDS.providerId });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'caregiver_confirmed',
      candidate_provider_id: IDS.providerId,
      caregiver_confirmed_at: new Date(),
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'arranged',
      candidate_provider_id: IDS.providerId,
      assigned_provider_id: IDS.providerId,
      caregiver_confirmed_at: new Date(),
      provider_confirmed_at: new Date(),
    });

    const req = createRequest('PUT', { confirm: true, provider_note: '可於當日上午到場' }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('arranged');
    expect(json.data.assigned_provider_id).toBe(IDS.providerId);
  });

  it('provider rejects → back to screening', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue({ id: IDS.providerId });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'caregiver_confirmed',
      candidate_provider_id: IDS.providerId,
      caregiver_confirmed_at: new Date(),
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({
      ...mockServiceRequest,
      status: 'screening',
      candidate_provider_id: null,
      caregiver_confirmed_at: null,
      provider_confirmed_at: null,
    });

    const req = createRequest('PUT', { confirm: false }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('screening');
  });

  it('rejects non-provider', async () => {
    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects provider who is not the candidate', async () => {
    const otherProviderId = '00000000-0000-4000-a000-000000000042';
    mockPrisma.provider.findFirst.mockResolvedValue({ id: otherProviderId });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'caregiver_confirmed',
      candidate_provider_id: IDS.providerId,
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    expect(res.status).toBe(403);
  });

  it('rejects when status is not caregiver_confirmed', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue({ id: IDS.providerId });
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      ...mockServiceRequest,
      status: 'candidate_proposed',
      candidate_provider_id: IDS.providerId,
    });

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    expect(res.status).toBe(400);
  });

  it('rejects provider with no profile', async () => {
    mockPrisma.provider.findFirst.mockResolvedValue(null);

    const req = createRequest('PUT', { confirm: true }, {
      Authorization: `Bearer ${token(IDS.provider, 'provider')}`,
    }, `http://localhost:3000/api/v1/service-requests/${IDS.request}/confirm-provider`);
    const res = await confirmProvider(req, { params });
    expect(res.status).toBe(403);
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd apps/web && pnpm test -- --run service-requests`
Expected: FAIL — cannot import file

### Step 3: Commit test (red phase)

```bash
git add apps/web/__tests__/service-requests.test.ts
git commit -m "test(api): add confirm-provider endpoint tests (red)"
```

---

## Task 7: Provider Confirm API — Implementation

**Files:**
- Create: `apps/web/app/api/v1/service-requests/[id]/confirm-provider/route.ts`

### Step 1: Implement the endpoint

Create `apps/web/app/api/v1/service-requests/[id]/confirm-provider/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { ServiceRequestProviderConfirmSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(request)) {
      return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
    }

    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'provider') {
      return errorResponse('AUTH_FORBIDDEN', '僅服務人員可確認接案');
    }

    // Resolve provider profile
    const provider = await prisma.provider.findFirst({
      where: { user_id: auth.userId, deleted_at: null },
      select: { id: true },
    });
    if (!provider) {
      return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');
    }

    const { id } = await params;
    const body: unknown = await request.json();

    const parsed = ServiceRequestProviderConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        '輸入資料驗證失敗',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!serviceRequest) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務需求');
    }

    // Must be the candidate provider
    if (serviceRequest.candidate_provider_id !== provider.id) {
      return errorResponse('RESOURCE_OWNERSHIP_DENIED', '您不是此需求的候選服務人員');
    }

    if (serviceRequest.status !== 'caregiver_confirmed') {
      return errorResponse(
        'INVALID_STATE_TRANSITION',
        `目前狀態「${serviceRequest.status}」無法執行確認操作`,
      );
    }

    const updateData = parsed.data.confirm
      ? {
          // Auto-arrange: both confirmations complete
          status: 'arranged' as const,
          provider_confirmed_at: new Date(),
          assigned_provider_id: serviceRequest.candidate_provider_id,
          provider_note: parsed.data.provider_note ?? serviceRequest.provider_note,
        }
      : {
          status: 'screening' as const,
          candidate_provider_id: null,
          caregiver_confirmed_at: null,
          provider_confirmed_at: null,
          provider_note: parsed.data.provider_note
            ? `服務人員拒絕接案：${parsed.data.provider_note}`
            : serviceRequest.provider_note,
        };

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
        candidate_provider: { select: { id: true, name: true } },
        assigned_provider: { select: { id: true, name: true, phone: true } },
      },
    });

    return successResponse(updated);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
```

**Design note:** When provider confirms, the system directly transitions to `arranged` (skipping the `provider_confirmed` intermediate state) because: (1) the caregiver has already confirmed, (2) the state machine requires both confirmations for `arranged`, and (3) the `provider_confirmed` state's only valid transition is `arranged`. This is effectively an auto-arrange in a single DB write.

### Step 2: Run tests to verify they pass

Run: `cd apps/web && pnpm test -- --run service-requests`
Expected: All confirm-provider tests PASS

### Step 3: Commit

```bash
git add apps/web/app/api/v1/service-requests/[id]/confirm-provider/route.ts
git commit -m "feat(api): implement confirm-provider endpoint with auto-arrange"
```

---

## Task 8: Shared Schema Tests for Confirm Schemas

**Why:** Verify the existing schemas work correctly for the new endpoints.

**Files:**
- Modify: `packages/shared/__tests__/service-request.test.ts`

### Step 1: Add tests for existing schemas

```typescript
// Add imports at top:
import {
  ServiceRequestProposeCandidateSchema,
  ServiceRequestCaregiverConfirmSchema,
  ServiceRequestProviderConfirmSchema,
} from '../src/schemas/service-request';

// Add describe blocks:

describe('ServiceRequestProposeCandidateSchema', () => {
  it('accepts valid input', () => {
    expect(
      ServiceRequestProposeCandidateSchema.safeParse({
        provider_id: '00000000-0000-4000-a000-000000000041',
      }).success,
    ).toBe(true);
  });

  it('accepts optional admin_note', () => {
    expect(
      ServiceRequestProposeCandidateSchema.safeParse({
        provider_id: '00000000-0000-4000-a000-000000000041',
        admin_note: '候選人具陪診經驗',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid uuid', () => {
    expect(
      ServiceRequestProposeCandidateSchema.safeParse({
        provider_id: 'not-uuid',
      }).success,
    ).toBe(false);
  });
});

describe('ServiceRequestCaregiverConfirmSchema', () => {
  it('accepts confirm=true', () => {
    expect(
      ServiceRequestCaregiverConfirmSchema.safeParse({ confirm: true }).success,
    ).toBe(true);
  });

  it('accepts confirm=false with note', () => {
    expect(
      ServiceRequestCaregiverConfirmSchema.safeParse({ confirm: false, note: '時間不合' }).success,
    ).toBe(true);
  });

  it('rejects missing confirm', () => {
    expect(
      ServiceRequestCaregiverConfirmSchema.safeParse({}).success,
    ).toBe(false);
  });

  it('rejects note over 500 chars', () => {
    expect(
      ServiceRequestCaregiverConfirmSchema.safeParse({ confirm: true, note: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('ServiceRequestProviderConfirmSchema', () => {
  it('accepts confirm=true with provider_note', () => {
    expect(
      ServiceRequestProviderConfirmSchema.safeParse({
        confirm: true,
        provider_note: '可於當日上午到場',
      }).success,
    ).toBe(true);
  });

  it('accepts confirm=false', () => {
    expect(
      ServiceRequestProviderConfirmSchema.safeParse({ confirm: false }).success,
    ).toBe(true);
  });

  it('rejects provider_note over 1000 chars', () => {
    expect(
      ServiceRequestProviderConfirmSchema.safeParse({
        confirm: true,
        provider_note: 'x'.repeat(1001),
      }).success,
    ).toBe(false);
  });
});
```

### Step 2: Run tests

Run: `cd packages/shared && pnpm test -- --run service-request`
Expected: All PASS

### Step 3: Commit

```bash
git add packages/shared/__tests__/service-request.test.ts
git commit -m "test(shared): add schema tests for matching workflow schemas"
```

---

## Task 9: Admin UI — Propose Candidate on Detail Page

**Why:** Admin needs to select an approved provider and propose them as candidate when status is `screening`.

**Files:**
- Modify: `apps/web/app/admin/service-requests/[id]/page.tsx`

### Step 1: Add provider list fetch + propose candidate UI

In `apps/web/app/admin/service-requests/[id]/page.tsx`, add:

1. A new interface for Provider:
```typescript
interface ProviderOption {
  id: string;
  name: string;
  level: string;
  phone: string | null;
  specialties: string[];
  availability_status: string;
}
```

2. State for providers and selected provider:
```typescript
const [providers, setProviders] = useState<ProviderOption[]>([]);
const [selectedProviderId, setSelectedProviderId] = useState('');
const [proposing, setProposing] = useState(false);
```

3. Fetch available providers when status is `screening`:
```typescript
useEffect(() => {
  if (request?.status === 'screening') {
    void fetchProviders();
  }
}, [request?.status]);

const fetchProviders = async () => {
  try {
    const res = await fetch('/api/v1/providers?review_status=approved&availability_status=available&limit=50');
    const json = await res.json();
    if (json.success) {
      setProviders(json.data ?? []);
    }
  } catch { /* ignore */ }
};
```

**Note:** The providers list API (`GET /api/v1/providers`) does not exist yet. For Slice 8, we add a **minimal** admin providers list endpoint. See Task 10.

4. Propose candidate handler:
```typescript
const proposeCandidate = async () => {
  if (!selectedProviderId) return;
  setProposing(true);
  try {
    const res = await fetch(`/api/v1/service-requests/${id}/propose-candidate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_id: selectedProviderId,
        admin_note: adminNote || undefined,
      }),
    });
    const json = await res.json();
    if (json.success) {
      await fetchDetail();
      setSelectedProviderId('');
    } else {
      setError(json.error?.message ?? '提出候選失敗');
    }
  } catch {
    setError('網路錯誤');
  } finally {
    setProposing(false);
  }
};
```

5. In the render, add propose candidate section (when `status === 'screening'`):
```tsx
{request.status === 'screening' && (
  <div className="rounded-lg border border-gray-200 bg-white p-6">
    <h2 className="mb-4 text-lg font-semibold text-gray-900">提出候選服務人員</h2>
    <select
      value={selectedProviderId}
      onChange={(e) => setSelectedProviderId(e.target.value)}
      className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
    >
      <option value="">— 選擇服務人員 —</option>
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}（{p.level}）{p.phone ? ` ${p.phone}` : ''}
        </option>
      ))}
    </select>
    <button
      disabled={!selectedProviderId || proposing}
      onClick={() => void proposeCandidate()}
      className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
    >
      {proposing ? '提出中...' : '提出候選'}
    </button>
  </div>
)}
```

6. Add candidate provider info display + confirmation tracking section:
```tsx
{request.candidate_provider && (
  <div className="rounded-lg border border-gray-200 bg-white p-6">
    <h2 className="mb-4 text-lg font-semibold text-gray-900">候選服務人員</h2>
    <dl className="space-y-2 text-sm">
      <div>
        <dt className="text-gray-500">姓名</dt>
        <dd className="text-gray-900">{request.candidate_provider.name}</dd>
      </div>
    </dl>
    <div className="mt-4 space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className={request.caregiver_confirmed_at ? 'text-green-600' : 'text-gray-400'}>
          {request.caregiver_confirmed_at ? '✓' : '○'} 委託人確認
        </span>
        {request.caregiver_confirmed_at && (
          <span className="text-xs text-gray-400">
            {new Date(request.caregiver_confirmed_at).toLocaleString('zh-TW')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={request.provider_confirmed_at ? 'text-green-600' : 'text-gray-400'}>
          {request.provider_confirmed_at ? '✓' : '○'} 服務人員確認
        </span>
        {request.provider_confirmed_at && (
          <span className="text-xs text-gray-400">
            {new Date(request.provider_confirmed_at).toLocaleString('zh-TW')}
          </span>
        )}
      </div>
    </div>
  </div>
)}
```

7. Update `ServiceRequestDetail` interface to add missing fields:
```typescript
caregiver_confirmed_at: string | null;
provider_confirmed_at: string | null;
candidate_provider: { id: string; name: string } | null;
```

8. Update status action buttons — add `canReturnFromCandidate` and `canReturnFromConfirmed`:
```typescript
const canReturnFromCandidate = request.status === 'candidate_proposed';
const canReturnFromConfirmed = request.status === 'caregiver_confirmed';
```

Add corresponding buttons in the actions section:
```tsx
{canReturnFromCandidate && (
  <button
    disabled={updating}
    onClick={() => void updateStatus('screening')}
    className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
  >
    退回審核
  </button>
)}
{canReturnFromConfirmed && (
  <button
    disabled={updating}
    onClick={() => void updateStatus('screening')}
    className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
  >
    退回審核
  </button>
)}
```

### Step 2: Verify no TypeScript errors

Run: `cd apps/web && pnpm typecheck`
Expected: PASS

### Step 3: Commit

```bash
git add apps/web/app/admin/service-requests/[id]/page.tsx
git commit -m "feat(admin): add propose candidate and confirmation tracking UI"
```

---

## Task 10: Minimal Admin Providers List API

**Why:** The admin propose-candidate UI needs to fetch approved providers. This is a minimal endpoint for Slice 8; full provider CRUD is Slice 9.

**Files:**
- Create: `apps/web/app/api/v1/providers/route.ts`
- Modify: `apps/web/__tests__/service-requests.test.ts` (or create separate test file)

### Step 1: Write tests

Add to `apps/web/__tests__/service-requests.test.ts` (or create a minimal test inline):

```typescript
// Import:
import { GET as getProviders } from '../app/api/v1/providers/route';

// ─── GET /providers ───

describe('GET /api/v1/providers', () => {
  it('admin can list providers', async () => {
    mockPrisma.provider.findMany.mockResolvedValue([]);
    mockPrisma.provider.count.mockResolvedValue(0);

    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.admin, 'admin')}`,
    }, 'http://localhost:3000/api/v1/providers?review_status=approved&limit=50');
    const res = await getProviders(req);
    expect(res.status).toBe(200);
  });

  it('rejects non-admin', async () => {
    const req = createRequest('GET', undefined, {
      Authorization: `Bearer ${token(IDS.caregiver, 'caregiver')}`,
    }, 'http://localhost:3000/api/v1/providers');
    const res = await getProviders(req);
    expect(res.status).toBe(403);
  });
});
```

**Note:** Add `provider.findMany` and `provider.count` to the mockPrisma object at the top of the test file.

### Step 2: Implement

Create `apps/web/app/api/v1/providers/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { errorResponse, paginatedResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }
    if (auth.role !== 'admin') {
      return errorResponse('AUTH_FORBIDDEN', '僅管理員可查看服務人員列表');
    }

    const url = new URL(request.url);
    const review_status = url.searchParams.get('review_status') ?? undefined;
    const availability_status = url.searchParams.get('availability_status') ?? undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deleted_at: null };
    if (review_status) where.review_status = review_status;
    if (availability_status) where.availability_status = availability_status;

    const [providers, total] = await Promise.all([
      prisma.provider.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          level: true,
          specialties: true,
          availability_status: true,
          review_status: true,
        },
      }),
      prisma.provider.count({ where }),
    ]);

    return paginatedResponse(providers, { page, limit, total });
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
```

### Step 3: Run tests

Run: `cd apps/web && pnpm test -- --run service-requests`
Expected: All PASS

### Step 4: Commit

```bash
git add apps/web/app/api/v1/providers/route.ts apps/web/__tests__/service-requests.test.ts
git commit -m "feat(api): add minimal admin providers list for matching workflow"
```

---

## Task 11: Mobile UI — Caregiver Confirm/Reject on Detail Page

**Why:** When status is `candidate_proposed`, the caregiver needs to see the candidate provider info and confirm or reject.

**Files:**
- Modify: `apps/mobile/app/(tabs)/services/[requestId].tsx`

### Step 1: Update interface and add candidate_provider

Add to `ServiceRequestDetail` interface:
```typescript
candidate_provider: { id: string; name: string } | null;
caregiver_confirmed_at: string | null;
provider_confirmed_at: string | null;
```

### Step 2: Add confirm/reject state and handler

```typescript
const [confirming, setConfirming] = useState(false);

const handleCaregiverConfirm = (confirm: boolean) => {
  const title = confirm ? '確認候選服務人員' : '拒絕候選服務人員';
  const message = confirm
    ? `確定同意「${request?.candidate_provider?.name}」為您服務嗎？`
    : '確定拒絕候選人嗎？系統將重新為您媒合。';
  Alert.alert(title, message, [
    { text: '返回', style: 'cancel' },
    {
      text: confirm ? '確認同意' : '確定拒絕',
      style: confirm ? 'default' : 'destructive',
      onPress: async () => {
        setConfirming(true);
        try {
          await api.put(`/service-requests/${requestId}/confirm-caregiver`, { confirm });
          await fetchDetail();
        } catch (e) {
          if (e instanceof ApiError) Alert.alert('錯誤', e.message);
          else Alert.alert('錯誤', '操作失敗');
        } finally {
          setConfirming(false);
        }
      },
    },
  ]);
};
```

### Step 3: Add candidate info + confirm/reject buttons in render

Insert after the assigned_provider section and before the admin_note section:

```tsx
{/* Candidate Provider (when candidate_proposed) */}
{request.candidate_provider && request.status === 'candidate_proposed' && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>候選服務人員</Text>
    <InfoRow label="姓名" value={request.candidate_provider.name} />
    <View style={styles.confirmButtons}>
      <TouchableOpacity
        style={[styles.confirmButton, confirming && styles.cancelButtonDisabled]}
        onPress={() => handleCaregiverConfirm(true)}
        disabled={confirming}
      >
        <Text style={styles.confirmButtonText}>
          {confirming ? '處理中...' : '同意候選'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rejectButton, confirming && styles.cancelButtonDisabled]}
        onPress={() => handleCaregiverConfirm(false)}
        disabled={confirming}
      >
        <Text style={styles.rejectButtonText}>拒絕候選</Text>
      </TouchableOpacity>
    </View>
  </View>
)}

{/* Candidate Provider info (after confirmation) */}
{request.candidate_provider && request.status !== 'candidate_proposed' && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>候選服務人員</Text>
    <InfoRow label="姓名" value={request.candidate_provider.name} />
  </View>
)}
```

### Step 4: Add styles

```typescript
confirmButtons: {
  flexDirection: 'row',
  gap: 12,
  marginTop: 16,
},
confirmButton: {
  flex: 1,
  backgroundColor: '#DCFCE7',
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: 'center',
},
confirmButtonText: {
  color: '#15803D',
  fontSize: 15,
  fontWeight: '600',
},
rejectButton: {
  flex: 1,
  backgroundColor: '#FEE2E2',
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: 'center',
},
rejectButtonText: {
  color: '#DC2626',
  fontSize: 15,
  fontWeight: '600',
},
```

### Step 5: Verify no TypeScript errors

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS (or only pre-existing warnings)

### Step 6: Commit

```bash
git add apps/mobile/app/\(tabs\)/services/\[requestId\].tsx
git commit -m "feat(mobile): add caregiver confirm/reject UI for candidate provider"
```

---

## Task 12: Mobile UI — Minimal Provider Confirm Page

**Why:** Provider needs a way to confirm or reject assigned cases. This is a minimal page; full provider workspace is Slice 9.

**Files:**
- Create: `apps/mobile/app/(tabs)/services/provider-confirm.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx` (add hidden route)

### Step 1: Add hidden route in _layout.tsx

In the existing `(tabs)/_layout.tsx`, add a new hidden `<Tabs.Screen>` entry:

```tsx
<Tabs.Screen
  name="services/provider-confirm"
  options={{ href: null, title: '確認接案' }}
/>
```

### Step 2: Create provider confirm page

Create `apps/mobile/app/(tabs)/services/provider-confirm.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api-client';

interface ServiceRequestDetail {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  location: string;
  description: string;
  category: { id: string; code: string; name: string };
  recipient: { id: string; name: string };
}

export default function ProviderConfirmScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [providerNote, setProviderNote] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ServiceRequestDetail>(`/service-requests/${requestId}`);
      setRequest(result);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleConfirm = (confirm: boolean) => {
    const title = confirm ? '確認接案' : '拒絕接案';
    const message = confirm
      ? '確定接受此服務案件嗎？'
      : '確定拒絕嗎？案件將回到待媒合狀態。';
    Alert.alert(title, message, [
      { text: '返回', style: 'cancel' },
      {
        text: confirm ? '確認接案' : '確定拒絕',
        style: confirm ? 'default' : 'destructive',
        onPress: async () => {
          setConfirming(true);
          try {
            await api.put(`/service-requests/${requestId}/confirm-provider`, {
              confirm,
              provider_note: providerNote || undefined,
            });
            Alert.alert('完成', confirm ? '已確認接案' : '已拒絕接案', [
              { text: '確定', onPress: () => router.back() },
            ]);
          } catch (e) {
            if (e instanceof ApiError) Alert.alert('錯誤', e.message);
            else Alert.alert('錯誤', '操作失敗');
          } finally {
            setConfirming(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;
  }

  if (error || !request) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || '載入失敗'}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canConfirm = request.status === 'caregiver_confirmed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>案件資訊</Text>
        <InfoRow label="服務類別" value={request.category.name} />
        <InfoRow label="被照護者" value={request.recipient.name} />
        <InfoRow
          label="期望日期"
          value={new Date(request.preferred_date).toLocaleDateString('zh-TW')}
        />
        <InfoRow label="服務地點" value={request.location} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>需求描述</Text>
        <Text style={styles.descriptionText}>{request.description}</Text>
      </View>

      {canConfirm && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>回覆備註（選填）</Text>
          <TextInput
            style={styles.noteInput}
            multiline
            numberOfLines={3}
            value={providerNote}
            onChangeText={setProviderNote}
            placeholder="填寫備註，例如預計到達時間..."
            placeholderTextColor="#9CA3AF"
          />
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={[styles.confirmButton, confirming && styles.disabledButton]}
              onPress={() => handleConfirm(true)}
              disabled={confirming}
            >
              <Text style={styles.confirmButtonText}>
                {confirming ? '處理中...' : '確認接案'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, confirming && styles.disabledButton]}
              onPress={() => handleConfirm(false)}
              disabled={confirming}
            >
              <Text style={styles.rejectButtonText}>拒絕接案</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!canConfirm && (
        <View style={styles.statusNote}>
          <Text style={styles.statusNoteText}>
            目前狀態不需要您的操作。
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  loader: { flex: 1, justifyContent: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#DC2626', fontSize: 14, marginBottom: 12 },
  linkText: { color: '#2563EB', fontSize: 14, textDecorationLine: 'underline' },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    maxWidth: '60%' as unknown as number,
    textAlign: 'right',
  },
  descriptionText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  noteInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 16,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: { color: '#15803D', fontSize: 15, fontWeight: '600' },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rejectButtonText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
  disabledButton: { opacity: 0.6 },
  statusNote: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statusNoteText: { color: '#6B7280', fontSize: 14 },
});
```

### Step 3: Verify TypeScript

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS

### Step 4: Commit

```bash
git add apps/mobile/app/\(tabs\)/services/provider-confirm.tsx apps/mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat(mobile): add minimal provider confirm page for matching workflow"
```

---

## Task 13: CI Gate Verification

**Why:** All changes must pass the CI gate before merge.

### Step 1: Run lint

Run: `pnpm lint`
Expected: PASS (3 packages)

### Step 2: Run typecheck

Run: `pnpm typecheck`
Expected: PASS

### Step 3: Run all tests

Run: `pnpm test`
Expected: All tests PASS (web + shared)

### Step 4: Run build

Run: `pnpm build`
Expected: PASS

### Step 5: Fix any issues found

If any step fails, fix the issue and re-run. Common issues:
- Unused imports → remove them
- Missing mock fields → add to mockPrisma
- Type errors → fix type assertions

### Step 6: Final commit (if fixes needed)

```bash
git add -A
git commit -m "fix: resolve CI gate issues for slice 8"
```

---

## Task 14: Create PR

### Step 1: Push branch

```bash
git push -u origin feat/slice-8-matching-workflow
```

### Step 2: Create PR

```bash
gh pr create --title "feat: Slice 8 — Matching Workflow" --body "$(cat <<'EOF'
## Summary
- Add propose-candidate API (admin proposes approved provider for screening request)
- Add confirm-caregiver API (caregiver confirms/rejects candidate)
- Add confirm-provider API (provider confirms/rejects, auto-arrange on both confirmed)
- Expand status route whitelist for matching return transitions
- Add minimal admin providers list API
- Admin UI: propose candidate + confirmation tracking on detail page
- Mobile: caregiver confirm/reject UI on request detail page
- Mobile: minimal provider confirm page

## State Machine Transitions Added
screening → candidate_proposed (propose-candidate)
candidate_proposed → caregiver_confirmed (confirm, confirm=true)
candidate_proposed → screening (confirm, confirm=false / admin return)
caregiver_confirmed → provider_confirmed → arranged (confirm, auto-arrange)
caregiver_confirmed → screening (reject / admin return)

## Test plan
- [ ] All existing tests still pass
- [ ] New propose-candidate tests (5 cases: success, non-admin, wrong status, unapproved provider, non-existent provider)
- [ ] New confirm-caregiver tests (5 cases: confirm, reject, non-caregiver, ownership, wrong status)
- [ ] New confirm-provider tests (6 cases: confirm+auto-arrange, reject, non-provider, not candidate, wrong status, no profile)
- [ ] Shared schema tests for 3 new schemas
- [ ] Status route expanded whitelist tests (3 cases)
- [ ] Admin providers list tests (2 cases)
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Summary

| Task | Scope | Files | Tests |
|------|-------|-------|-------|
| 1 | Status route whitelist expansion | 1 modify | 3 new |
| 2-3 | Propose candidate API | 1 create, 1 modify | 5 new |
| 4-5 | Caregiver confirm API | 1 create, 1 modify | 5 new |
| 6-7 | Provider confirm + auto-arrange | 1 create, 1 modify | 6 new |
| 8 | Shared schema tests | 1 modify | 9 new |
| 9 | Admin UI — propose + tracking | 1 modify | — |
| 10 | Minimal providers list API | 1 create, 1 modify | 2 new |
| 11 | Mobile — caregiver confirm UI | 1 modify | — |
| 12 | Mobile — provider confirm page | 1 create, 1 modify | — |
| 13 | CI gate | — | — |
| 14 | PR | — | — |

**Total new tests:** ~30
**Total new files:** 4 API routes + 1 mobile page
**Total modified files:** 4 (test file, status route, admin detail page, mobile detail page, mobile layout)
**No migration needed** — all DB fields already exist
**No shared schema changes needed** — all schemas already exist
