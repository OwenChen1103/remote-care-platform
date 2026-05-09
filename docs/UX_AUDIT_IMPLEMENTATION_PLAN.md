# WhoCares Platform — UX Audit & Implementation Plan

> **目的**：本文件針對全平台（caregiver / patient / provider / admin 四個角色）進行端到端 UX 審查所發現的所有問題，提供完整、可逐項執行、避免新舊邏輯共存或邏輯漏洞的實作規格。
>
> **使用方法**：每個 section 都是一份獨立可執行的實作 spec。**先讀「執行順序與依賴關係」**確認部署順序，再依序執行各 section。**不要跳過跨 section 衝突仲裁**。

---

## 目錄

- [執行摘要](#執行摘要)
- [執行順序與依賴關係](#執行順序與依賴關係)
- [跨 Section 衝突仲裁](#跨-section-衝突仲裁)
- [Section 1: Patient 綁定與角色完整性](#section-1-patient-綁定與角色完整性)
- [Section 2: 服務需求生命週期與通知](#section-2-服務需求生命週期與通知)
- [Section 3: 資料存取安全 + Provider Report 形狀統一](#section-3-資料存取安全--provider-report-形狀統一)
- [Section 4: Provider 審核流程 + Mobile UX 收尾](#section-4-provider-審核流程--mobile-ux-收尾)
- [全平台 Affected Files 索引](#全平台-affected-files-索引)
- [Migration 順序總覽](#migration-順序總覽)
- [部署檢查清單](#部署檢查清單)
- [風險登記與回滾](#風險登記與回滾)

---

## 執行摘要

WhoCares 平台目前在 demo 帳號上看起來功能完整，但這只因為 seed.ts 手動連好所有資料關係。**真實使用者註冊流程下，平台從第一步就斷裂**：

- **Patient 角色完全死亡**：註冊後沒有 UI 可以連結到 Recipient，看到的永遠是空的 dashboard
- **Service request 流程斷頭**：caregiver 同意候選後，provider 看不到該接的任務（API 過濾 status 不對 + UI 沒有導航路徑）
- **零通知**：所有 status 變化都不發通知。所有 role 都得手動開頁面 polling 才知道狀態
- **Provider 上門看不到病人病史**：API 只回 `{id, name}`，缺 medical_tags / address / 緊急聯絡 — 臨床安全問題
- **完成的服務報告 caregiver 看不到**：UI 宣告了 interface 但沒 render；patient 端讀的是另一個 shape，全部空白
- **AI 報告越權**：任何 patient/provider 帶任意 recipient_id 都讀得到

**修法總成本**：4 大工作流，預估 ~3-5 天完整 ship（含測試）。其中：
- DB migration: 2 個（`provider_review_lifecycle` 加 `submitted_at`/`reviewed_at`、`add_user_suspended_at` 加 `users.suspended_at` timestamptz）
- Shared package 前置：`PROVIDER_REVIEW_STATUSES` 加 `REJECTED`、`ERROR_CODES` 加三個 `PATIENT_USER_*` 錯誤碼、`ADMIN_STATUS_TRANSITIONS` 新增為 shared 常數
- 新 API endpoints: 5 個（admin recipient PUT, admin users list+suspend, provider reapply, GET /appointments/[id], DELETE /recipients/[id]）
- 新 mobile screens: 2 個（patient/profile.tsx, home/edit-appointment.tsx）
- 既有檔案修改: ~28 個

> **依存權威文檔的對齊聲明**：本實作計畫經 2026-05-08 完整審查，已對齊 `docs/engineering-standards.md`、`docs/implementation-spec.md`、`docs/plans/2026-03-14-slice-8-matching-workflow.md`、`docs/mvp-optimization-plan.md`、`docs/ux-refinement-framework-v1.md`、`docs/ux-execution-backlog-v1.md`、`docs/visual-direction-v1.md`、`TODO.md`，並對 5 個架構決策點明確仲裁（見「跨 Section 衝突仲裁」）。執行此計畫前，請先讀完該節確認共識。

---

## 執行順序與依賴關係

```
Phase 1 (Infra & Schema, 0.5 day)
├── packages/shared 前置（必須最先做，否則 TS 編譯失敗）：
│   ├── PROVIDER_REVIEW_STATUSES 加 REJECTED: 'rejected'
│   ├── ERROR_CODES 加 PATIENT_USER_NOT_FOUND / _ROLE_MISMATCH / _ALREADY_BOUND + ERROR_STATUS_MAP
│   └── ADMIN_STATUS_TRANSITIONS 加為 shared 常數
├── DB migration: provider_review_lifecycle (Section 4 A1)
├── DB migration: add_user_suspended_at         (Section 3 E)
├── packages/shared 其他 schema 改動（recipient + service-request strictify）
└── pnpm build shared
       │
       ▼
Phase 2 (Backend API, 1.5 day)
├── Section 1: recipient API (patient_user_email 接受)
├── Section 2: service-notifications.ts helper + 6 routes 加通知
├── Section 2: provider/tasks 過濾擴大 (caregiver_confirmed)
├── Section 2: confirm-provider 加通知（status 寫 'arranged' 不變 — 保留 auto-transition）
├── Section 2: status 路由白名單擴大成 ADMIN_STATUS_TRANSITIONS（admin rescue）
├── Section 3: ai/reports 授權收緊（ensureRecipientAccess helper — 僅在新 routes 用）
├── Section 3: provider/tasks recipient select 擴大
├── Section 3: measurements provider read access
├── Section 3: admin/users API + 修改 verifyAuth (suspended_at IS NOT NULL 阻擋登入)
├── Section 4: providers/[id]/review 接受 rejected + state machine guard
├── Section 4: provider/me/reapply (NEW)
├── Section 4: appointments/[id] GET (NEW)
└── Section 4: recipients/[id] DELETE (NEW)
       │
       ▼
Phase 3 (Web Admin, 0.5 day)
├── Section 1: admin/recipients/[id] 編輯頁 (NEW)
├── Section 2: admin/service-requests/[id] 按鈕擴大
├── Section 3: admin/service-requests/[id] candidate filter
├── Section 3: admin/users 頁面 (NEW)
└── Section 4: admin/providers/[id] rejected 按鈕
       │
       ▼
Phase 4 (Mobile, 1.5 day)
├── Section 1: add-recipient + edit recipient 加 patient_user_email 欄位
├── Section 1: patient/summary 空狀態 + AI 報告 fetch + menu 修
├── Section 1: patient/profile.tsx (NEW)
├── Section 1: register/login 角色路由
├── Section 2: provider-tasks 加 caregiver_confirmed + 條件路由
├── Section 2: services/[requestId] 加 provider_report 渲染
├── Section 2: home/notifications 深層連結
├── Section 2: patient/schedule 通知卡可點 + 深層連結
├── Section 3: provider-task-detail recipient 資訊 section
├── Section 3: patient/schedule provider_report shape 改成 nested
├── Section 4: provider-profile rejected banner + reapply
├── Section 4: home/add-appointment 改 DateTimePicker
├── Section 4: home/appointments + edit-appointment.tsx (NEW)
├── Section 4: home/[recipientId]/edit 加刪除按鈕
├── Section 4: 移除 settings stub menu items
├── Section 4: 移除 social login icons
└── Section 4: AI tab 加歷史紀錄入口
       │
       ▼
Phase 5 (Verification & Deploy)
├── 跑完整 test plan（每個 section 末尾的 manual test）
├── Web 先 deploy（包含後端 + admin）— Mobile 舊版相容
├── Mobile build + TestFlight
└── DB sanity check (post-migration)
```

**關鍵依賴**：
- **Phase 1 shared 前置必須最先**：`REJECTED` enum、3 個 `PATIENT_USER_*` 錯誤碼、`ADMIN_STATUS_TRANSITIONS` 常數，這些缺一個 TypeScript 都會編譯失敗
- **Section 4 的 schema migration 必須先跑**（其他 section 的 mobile UI 才不會打到舊 schema 的 `/provider/me` response）
- **Section 1 的 shared schema build 必須在所有 mobile/web 編譯前完成**（否則 `RecipientUpdateSchema` 會少一個欄位）
- **Section 2 的 service-notifications.ts helper 是其他 routes 修改的依賴** — 先寫 helper 再改 routes
- **Section 3 的 ProviderReportSchema `.strict()` 在 shared schema 改動時一併加**（決策 1 採 auto-transition 後沒有「等 confirm-provider 改完」的時序問題）

---

## 跨 Section 衝突仲裁

以下是規劃時 agents 之間以及與既有系統文檔/code 的仲裁決策。**這些是本計畫的固定共識，所有 section 內容皆已對齊**。

### 決策 A：`/api/v1/service-requests/[id]` 的 recipient select 是否擴大？

- **Section 2** 暗示需要（provider_report rendering 提到 recipient name 等）
- **Section 3** 明確說**不要**擴大（caregiver 已經有完整 recipient 存取，patient/provider 透過此 endpoint 只需要 `{id, name}`）

**仲裁：採 Section 3，不要擴大。** Caregiver 的需求已透過獨立的 `/api/v1/recipients/[id]` 滿足，擴大會洩漏資訊給 patient 和 provider 透過此共用 endpoint。

### 決策 B：`confirm-provider` 寫 `arranged`（保留現況 auto-transition）

- 既有 code [`apps/web/app/api/v1/service-requests/[id]/confirm-provider/route.ts:64-69`](../apps/web/app/api/v1/service-requests/[id]/confirm-provider/route.ts) 寫 `'arranged'`，含註解「Auto-arrange」
- Slice 8 spec [`docs/plans/2026-03-14-slice-8-matching-workflow.md` line 22] 規定 `provider_confirmed ──[auto]──► arranged` — 即「自動」轉換
- 早期版本曾考慮改成 admin 兩段式（先 `provider_confirmed`、admin 再 `arranged`），但 audit 發現此方案違反 Slice 8 spec、需新增 admin 按鈕、會把 demo flow 從 12 步變 13 步

**仲裁：採用現況 = auto-transition。`confirm-provider` 維持寫 `'arranged'` 不變。** 影響：
- `confirm-provider/route.ts` **不改 status 寫入邏輯**，僅加通知呼叫（Section 2.6/2.7）
- `provider_confirmed` 仍保留在 `SERVICE_REQUEST_STATUSES` enum（admin 手動 rescue 路徑可達）
- `ADMIN_STATUS_TRANSITIONS` 仍引入為 shared 常數（決策 G），即使主流程不經過 `provider_confirmed`，admin manual rescue 仍需要從 `arranged → screening` 等保護
- Admin web 不新增「標記為已安排」按鈕（auto 後不需要）
- Section 2.3 transition matrix 行 5a/6 合併（caregiver_confirmed → arranged 直接，不經 provider_confirmed）

### 決策 C：`ProviderReportSchema` 加 `.strict()` 的時機

- Section 3 提案加 `.strict()` 防止 patient 端舊 flat shape 漏進來
- patient mobile 是 reader 不是 writer，舊 shape 寫不進來

**仲裁：在 Phase 1 shared schema 改動時一併加 `.strict()`**。決策 B 採 auto 後沒有「等 confirm-provider 改完」的時序問題；當前 production 沒有舊 flat shape rows（patient mobile 是 reader 不是 writer），加 `.strict()` 不會破壞既有資料。

### 決策 D：Patient 的「通知中心」menu item 跳到哪裡？

- **Section 1** 說：跳到 `/(tabs)/home/notifications`（共用通知頁）
- **Section 4** 也說：跳到 `/(tabs)/home/notifications`

**一致。** 實作 Section 1 的 `_layout.tsx` 修改（讓 patient 也能 push 到 home/notifications，但不顯示 tab bar）。

### 決策 E：`/(tabs)/_layout.tsx` 對 patient 揭露 home/notifications 的方式

- Section 1 提案：`...(role === 'provider' ? {} : { href: null })` — provider 顯示在 tab bar，其他角色 push 可達但不顯示

**採用此方案。** 同時 Section 4 的「角色一致 menu」需要 patient 能 router.push 到 `/(tabs)/home/notifications`，相容無衝突。

### 決策 F：移除 `設定` 還是保留 stub？

- Section 4 明確：**移除**（Patient + Provider 兩處），不要顯示 stub。
- 與 [TODO.md] §VII (Phase 2 排除清單) 一致 — 設定/偏好設定本就不在 MVP 範圍。

**採用。** 這也意味著 Section 1 的 patient menu 重設計**不需要包含設定**。

### 決策 G：User suspension 採 `suspended_at` timestamptz（不採 `status` enum）

- 早期提案：`users.status VARCHAR(20)` 加 `'active' | 'suspended'`
- 與既有 soft-delete 模式（`recipients.deleted_at`、`providers.deleted_at` 都用 timestamptz）不一致

**仲裁：改採 `suspended_at: TIMESTAMPTZ NULL`** 對齊既有 pattern。`verifyAuth` 檢查 `suspended_at IS NULL` = active；admin suspend = `suspended_at = NOW()`，unsuspend = `suspended_at = NULL`。多帶停權時間戳供未來 audit。Migration 名 `add_user_suspended_at`。

### 決策 H：`ensureRecipientAccess` helper 範圍

- audit 確認 [`apps/web/lib/`](../apps/web/lib/) 目前**沒有** `checkRecipientOwnership` helper（文檔提到的 pattern 從未實作；15 個 route 都是 inline 寫 ownership check）
- 新 helper `ensureRecipientAccess` 是真正第一次集中化

**仲裁：本計畫只在新 routes（`ai/reports`、`measurements/[id]`-provider 路徑、新增 admin endpoints）使用。既有 15 個 inline check 不在本計畫範圍內重構**（規模太大且已驗證可運作；留作後續清理 task）。

### 決策 I：`PROVIDER_REVIEW_STATUSES` 加 `REJECTED` 為 Phase 1 前置

- 既有 enum [`packages/shared/src/constants/enums.ts:60-64`](../packages/shared/src/constants/enums.ts) 只有 `PENDING / APPROVED / SUSPENDED`
- Section 4 大量使用 `'rejected'`，TypeScript 嚴格型別下 `errorResponse(code, ...)` 與 `ProviderReviewSchema.review_status` 都會編譯失敗

**仲裁：Phase 1 第一步先擴 `PROVIDER_REVIEW_STATUSES` 加 `REJECTED: 'rejected'`、相對應 type 自動推導。** 此前置非可選。

### 決策 J：`ERROR_CODES` 加三個 `PATIENT_USER_*` 為 Phase 1 前置

- 既有 [`error-codes.ts`](../packages/shared/src/constants/error-codes.ts) 不含 `PATIENT_USER_NOT_FOUND` / `_ROLE_MISMATCH` / `_ALREADY_BOUND`
- `errorResponse(code, ...)` 是強型別 — 加碼前 backend 直接編譯失敗

**仲裁：Phase 1 第一步加：**
- `PATIENT_USER_NOT_FOUND: 'PATIENT_USER_NOT_FOUND'` → status 404
- `PATIENT_USER_ROLE_MISMATCH: 'PATIENT_USER_ROLE_MISMATCH'` → status 400
- `PATIENT_USER_ALREADY_BOUND: 'PATIENT_USER_ALREADY_BOUND'` → status 409

---

## Section 1: Patient 綁定與角色完整性

### 1.1 Overview

平台已交付四個角色（caregiver、patient、provider、admin）但 patient 的體驗是結構性未完成的。Prisma schema 已宣告 `recipients.patient_user_id` 為 nullable, unique FK 指向 `users.id`（`apps/web/prisma/schema.prisma:36`），且 GET endpoints 已對 patient 角色用此欄位過濾（`apps/web/app/api/v1/recipients/route.ts:27`、`apps/web/app/api/v1/recipients/[id]/route.ts:33`）。**缺的是所有設定該欄位的東西**：caregiver 沒有 UI 可以邀請 patient by email，admin 沒有工具可以修復錯誤連結，Zod `RecipientUpdateSchema`/`RecipientCreateSchema` 連 `patient_user_id` 都沒接受。結果每個註冊的 patient（如透過 `apps/mobile/app/(auth)/register.tsx`）都登在 `apps/mobile/app/(tabs)/patient/summary.tsx:361-367` 的空狀態，沒有路徑前進，沒有 profile 編輯入口（`summary.tsx:639-665`），沒有 AI report fetch，「通知中心」menu 跳到 schedule tab。

統一解法為 **email-based binding** 從 caregiver 的 recipient 表單驅動，加上 web admin 的完整覆蓋，加上一系列收尾的 mobile 修改。

### 1.2 Design decision: Email-based binding

考慮過三種機制：(a) recipient create/update 時 email 查表，(b) caregiver 產一次性邀請碼、patient 首次登入輸入，(c) QR 碼 patient 掃。**選 email** 因為：

1. patient 已有 `users.email`（schema 中 `@unique`）— 不需新欄位、新表
2. 雙方（caregiver 建立、admin 修復）本來就有患者 email，不需新通道
3. 對方還沒註冊 → 顯示「請先請對方以 X email 註冊被照護者帳號」，回明確錯誤碼 `PATIENT_USER_NOT_FOUND`
4. 邀請碼/QR 多一個臨時狀態表 + 多一個 screen，最後也要降級成 email lookup
5. 邀請碼方案不解「綁錯人」復原問題 — admin 還是要能覆寫。Email-based 讓「初次綁定」與「admin 修復」共用同一條 code path

**端到端流程：**

1. Caregiver 開啟新增/編輯被照護者；新「邀請被照護者帳號」section 輸入 patient email、按連結
2. Mobile 把 email 跟 recipient payload 一起送到 `POST /v1/recipients` 或 `PUT /v1/recipients/:id`
3. Backend `users.findUnique({ where: { email } })`，需 `role === 'patient'`、未綁其他 recipient（unique constraint 雙重保護）
4. 成功 → 設 `recipients.patient_user_id`；失敗 → 回 typed error code，表單顯示
5. Patient 登入；`(tabs)/_layout.tsx` 對 `role === 'patient'` 已 render `patient/summary`。Summary 透過 `GET /v1/recipients`（filter by patient_user_id）找到 recipient，正常 render
6. 若還沒綁，summary 顯示新的 actionable empty state，要求 caregiver 邀請、有重新整理 CTA

### 1.3 Affected files

1. `packages/shared/src/schemas/recipient.ts` — 擴 `RecipientCreateSchema` + `RecipientUpdateSchema` + `RecipientResponseSchema`
2. `apps/web/lib/format-recipient.ts` — 加 `patient_user_email` 顯示
3. `apps/web/app/api/v1/recipients/route.ts` — POST 接受 `patient_user_email`
4. `apps/web/app/api/v1/recipients/[id]/route.ts` — PUT 接受 `patient_user_email`，明確 `null` 為解綁
5. `apps/web/app/api/v1/admin/recipients/route.ts` — 已有 GET；include `patient_user`
6. `apps/web/app/api/v1/admin/recipients/[id]/route.ts` — **新** PUT for admin override
7. `apps/web/app/admin/recipients/page.tsx` — 顯示綁定狀態、連結到 detail
8. `apps/web/app/admin/recipients/[id]/page.tsx` — **新** detail/edit 頁含 patient_user dropdown
9. `apps/web/app/api/v1/admin/users/route.ts` — **新** 給 dropdown 用，filter `role='patient'`，cap 50 rows
10. `apps/mobile/app/(tabs)/home/add-recipient.tsx` — 新「邀請被照護者帳號」section
11. `apps/mobile/app/(tabs)/home/[recipientId]/edit.tsx` — 同 section + 顯示當前綁定 + 解除按鈕
12. `apps/mobile/app/(tabs)/patient/summary.tsx` — 空狀態 CTA + AI report fetch + menu 修 + 加個人資料 row
13. `apps/mobile/app/(tabs)/patient/profile.tsx` — **新**，mirror `home/profile.tsx`
14. `apps/mobile/app/(tabs)/_layout.tsx` — 註冊 `patient/profile`、開放 `home/notifications` 給 patient push
15. `apps/mobile/app/(auth)/register.tsx` — 角色 post-auth routing
16. `apps/mobile/app/(auth)/login.tsx` — 角色 post-auth routing

### 1.4 Schema changes

**不需 Prisma migration。** `recipients.patient_user_id` 已是 nullable, unique `@db.Uuid` 欄位、有 relation（`apps/web/prisma/schema.prisma:36, 52`）。Unique index 同時是「patient 不能同時綁兩個 recipient」的保護。Production 中 `patient_user_id = null` 的 rows 仍合法、無需 backfill。

### 1.5 Shared package changes

**File:** `packages/shared/src/schemas/recipient.ts:10-30`

```ts
export const RecipientCreateSchema = z.object({
  name: z.string().min(1, '姓名為必填').max(100, '姓名不得超過 100 字'),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需為 YYYY-MM-DD').optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  relationship: z.enum(RELATIONSHIP_VALUES).optional(),
  medical_tags: z.array(z.string().max(50)).max(20).default([]),
  lifestyle_habits: z.object({/* unchanged */}).optional(),
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  // NEW
  patient_user_email: z.string().email('請輸入有效的 Email').optional(),
});

// Update 全部 partial 並支援明確 null 解綁
export const RecipientUpdateSchema = RecipientCreateSchema.partial().extend({
  patient_user_email: z.string().email('請輸入有效的 Email').nullable().optional(),
});

export const RecipientResponseSchema = z.object({
  id: z.string().uuid(),
  caregiver_id: z.string().uuid(),
  patient_user_id: z.string().uuid().nullable(),
  patient_user_email: z.string().email().nullable(),  // NEW
  patient_user_name: z.string().nullable(),           // NEW
  /* ...existing fields... */
});
```

需更新所有 schema consumers：`apps/web/app/api/v1/recipients/route.ts`、`recipients/[id]/route.ts`、`apps/web/lib/format-recipient.ts`、`admin/recipients/route.ts`、新的 admin PUT route。

執行 `pnpm --filter @remote-care/shared build` 後 mobile/web 都會帶到新 type。

> **Phase 1 前置（決策 J）**：本 section 的 backend code 引用 `errorResponse('PATIENT_USER_NOT_FOUND', ...)` 等三個錯誤碼。`errorResponse(code, ...)` 是強型別，這些碼**必須先加進 [`packages/shared/src/constants/error-codes.ts`](../packages/shared/src/constants/error-codes.ts)** 否則 backend 編譯失敗。實作：
> ```ts
> export const ERROR_CODES = {
>   /* ...existing... */
>   PATIENT_USER_NOT_FOUND: 'PATIENT_USER_NOT_FOUND',         // NEW
>   PATIENT_USER_ROLE_MISMATCH: 'PATIENT_USER_ROLE_MISMATCH', // NEW
>   PATIENT_USER_ALREADY_BOUND: 'PATIENT_USER_ALREADY_BOUND', // NEW
> } as const;
>
> export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
>   /* ...existing... */
>   PATIENT_USER_NOT_FOUND: 404,
>   PATIENT_USER_ROLE_MISMATCH: 400,
>   PATIENT_USER_ALREADY_BOUND: 409,
> };
> ```
> 之後 `pnpm --filter @remote-care/shared build`。

### 1.6 Backend API changes

#### 1.6.1 PUT /api/v1/recipients/[id]

**File:** `apps/web/app/api/v1/recipients/[id]/route.ts:79-98`

**舊：**
```ts
const parsed = RecipientUpdateSchema.safeParse(body);
const { date_of_birth, ...rest } = parsed.data;
const updateData: Record<string, unknown> = { ...rest };
if (date_of_birth !== undefined) {
  updateData.date_of_birth = date_of_birth ? new Date(date_of_birth) : null;
}
const updated = await prisma.recipient.update({ where: { id }, data: updateData });
```

**新：**
```ts
const parsed = RecipientUpdateSchema.safeParse(body);
if (!parsed.success) { /* 不變 */ }

const { date_of_birth, patient_user_email, ...rest } = parsed.data;
const updateData: Record<string, unknown> = { ...rest };
if (date_of_birth !== undefined) {
  updateData.date_of_birth = date_of_birth ? new Date(date_of_birth) : null;
}

// Patient binding
if (patient_user_email !== undefined) {
  if (patient_user_email === null) {
    updateData.patient_user_id = null;
  } else {
    const target = await prisma.user.findUnique({
      where: { email: patient_user_email },
      select: { id: true, role: true },
    });
    if (!target) {
      return errorResponse('PATIENT_USER_NOT_FOUND', '查無此 Email 的被照護者帳號，請先請對方註冊');
    }
    if (target.role !== 'patient') {
      return errorResponse('PATIENT_USER_ROLE_MISMATCH', '此帳號不是「被照護者」角色，無法連結');
    }
    const conflict = await prisma.recipient.findFirst({
      where: { patient_user_id: target.id, deleted_at: null, NOT: { id } },
      select: { id: true },
    });
    if (conflict) {
      return errorResponse('PATIENT_USER_ALREADY_BOUND', '此 Email 已連結至其他被照護者');
    }
    updateData.patient_user_id = target.id;
  }
}

const updated = await prisma.recipient.update({
  where: { id },
  data: updateData,
  include: { patient_user: { select: { email: true, name: true } } },
});
return successResponse(formatRecipient(updated));
```

#### 1.6.2 POST /api/v1/recipients

`apps/web/app/api/v1/recipients/route.ts:91-120` — 同樣 `patient_user_email` 處理，create 時也驗 `PATIENT_USER_NOT_FOUND`/`ROLE_MISMATCH`/`ALREADY_BOUND`：

```ts
const { date_of_birth, patient_user_email, ...rest } = parsed.data;

let patient_user_id: string | null = null;
if (patient_user_email) {
  const target = await prisma.user.findUnique({
    where: { email: patient_user_email },
    select: { id: true, role: true },
  });
  if (!target) {
    return errorResponse('PATIENT_USER_NOT_FOUND', '查無此 Email 的被照護者帳號，請先請對方註冊');
  }
  if (target.role !== 'patient') {
    return errorResponse('PATIENT_USER_ROLE_MISMATCH', '此帳號不是「被照護者」角色');
  }
  const conflict = await prisma.recipient.findFirst({
    where: { patient_user_id: target.id, deleted_at: null },
    select: { id: true },
  });
  if (conflict) {
    return errorResponse('PATIENT_USER_ALREADY_BOUND', '此 Email 已連結至其他被照護者');
  }
  patient_user_id = target.id;
}

const recipient = await prisma.$transaction(async (tx) => {
  const created = await tx.recipient.create({
    data: {
      ...rest,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
      caregiver_id: auth.userId,
      patient_user_id,                // NEW
    },
    include: { patient_user: { select: { email: true, name: true } } },
  });
  await tx.measurementReminder.createMany({ /* unchanged */ });
  return created;
});
```

#### 1.6.3 解綁路徑

PUT 已涵蓋（`patient_user_email: null`）。不需另開 endpoint。

#### 1.6.4 新增 Admin endpoints

**`apps/web/app/api/v1/admin/recipients/[id]/route.ts`**（新）：

```ts
import { NextRequest } from 'next/server';
import { RecipientUpdateSchema } from '@remote-care/shared';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkOrigin } from '@/lib/csrf';
import { formatRecipient } from '@/lib/format-recipient';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
  if (auth.role !== 'admin') return errorResponse('AUTH_FORBIDDEN', '僅限管理員');

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = RecipientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', '輸入資料驗證失敗',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }

  // 與 caregiver PUT 相同的 patient_user_email logic
  // 建議抽出共用 helper apps/web/lib/resolve-patient-binding.ts
}
```

**`apps/web/app/api/v1/admin/users/route.ts`**（新）— admin 限定，回 `{id, email, name}[]`，`role` + `q` 搜尋，cap 50 rows。

### 1.7 Mobile UI changes

#### 1.7.1 add-recipient.tsx

**File:** `apps/mobile/app/(tabs)/home/add-recipient.tsx`

在「基本資料」card 之後（line 332 之前）插入：

```tsx
const [patientEmail, setPatientEmail] = useState('');

<View style={s.sectionHeader}>
  <IconLink />
  <Text style={s.sectionTitle}>邀請被照護者帳號（選填）</Text>
</View>
<View style={s.card}>
  <Text style={s.helperHint}>
    若被照護者本人也想用 App 查看自己的健康資料，請輸入他/她的註冊 Email。
    對方需先以「被照護者」角色註冊。
  </Text>
  <TextInput
    style={[s.input, { marginTop: spacing.sm }]}
    value={patientEmail}
    onChangeText={setPatientEmail}
    placeholder="patient@example.com"
    keyboardType="email-address"
    autoCapitalize="none"
    autoComplete="email"
    accessibilityLabel="被照護者 Email"
  />
</View>
```

`handleSubmit`（line 147）插入：

```ts
if (patientEmail.trim()) data.patient_user_email = patientEmail.trim().toLowerCase();
```

Error mapping：API 回 `PATIENT_USER_NOT_FOUND` 等錯誤，現有 `ApiError.message` 已直接顯示。

#### 1.7.2 edit.tsx

**File:** `apps/mobile/app/(tabs)/home/[recipientId]/edit.tsx`

擴 `Recipient` interface（line 40）：

```ts
interface Recipient {
  id: string;
  // ...
  patient_user_id: string | null;
  patient_user_email: string | null;
  patient_user_name: string | null;
}
```

State + hydrate from `fetchRecipient`：

```tsx
const [patientEmail, setPatientEmail] = useState('');
const [boundEmail, setBoundEmail] = useState<string | null>(null);
const [boundName, setBoundName] = useState<string | null>(null);
// 在 fetchRecipient:
setBoundEmail(data.patient_user_email);
setBoundName(data.patient_user_name);
setPatientEmail(data.patient_user_email ?? '');
```

UI：在「基本資料」與「與您的關係」之間 render。當 `boundEmail` 非 null 時，顯示綠色「已連結」pill 含 email、患者姓名、解除連結按鈕。

`handleSave`（line 173）：

```tsx
if (patientEmail.trim()) {
  data.patient_user_email = patientEmail.trim().toLowerCase();
} else if (boundEmail) {
  data.patient_user_email = null;  // 明確解綁
}
```

#### 1.7.3 patient/summary.tsx 空狀態

**File:** `apps/mobile/app/(tabs)/patient/summary.tsx:361-367`

舊：
```tsx
if (!recipient) {
  return (
    <View style={s.center}>
      <Text style={s.emptyText}>尚未建立被照護者資料</Text>
    </View>
  );
}
```

新：
```tsx
if (!recipient) {
  return (
    <ScrollView contentContainerStyle={s.emptyStateWrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={s.emptyHeroIcon}>
        <IconHeart size={36} color={colors.primary} />
      </View>
      <Text style={s.emptyTitle}>尚未連結照護資料</Text>
      <Text style={s.emptySubtitle}>
        請通知您的家屬（委託人）在 App 的「新增/編輯被照護者」頁，
        於「邀請被照護者帳號」區塊輸入您註冊的 Email：
      </Text>
      <View style={s.emptyEmailPill}>
        <Text style={s.emptyEmailText}>{user?.email}</Text>
      </View>
      <TouchableOpacity style={s.emptyRefreshBtn} onPress={onRefresh}>
        <Text style={s.emptyRefreshText}>重新整理</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(tabs)/patient/profile')}>
        <Text style={s.emptySecondaryLink}>編輯個人資料</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

#### 1.7.4 patient menu 修

**File:** `apps/mobile/app/(tabs)/patient/summary.tsx:639-665`

當前「通知中心」跳到 `patient/schedule`（與「行程與紀錄」一樣！）。改為跳 `home/notifications`，並加新「個人資料」row：

```tsx
<Text style={s.menuGroupLabel}>我的</Text>
<View style={s.menuGroup}>
  <TouchableOpacity
    style={s.menuRow}
    onPress={() => { setMenuVisible(false); router.push('/(tabs)/patient/profile'); }}
    activeOpacity={0.7}
  >
    <View style={[s.menuIconWrap, { backgroundColor: colors.primaryLight }]}>
      <IconUserMenu />
    </View>
    <Text style={s.menuRowText}>個人資料</Text>
    <IconChevron color={colors.textDisabled} />
  </TouchableOpacity>
  <View style={s.menuItemDivider} />
  {/* 修正路由 */}
  <TouchableOpacity
    style={s.menuRow}
    onPress={() => { setMenuVisible(false); router.push('/(tabs)/home/notifications'); }}
    activeOpacity={0.7}
  >
    <View style={[s.menuIconWrap, { backgroundColor: colors.primaryLight }]}>
      <IconBellMenu />
    </View>
    <Text style={s.menuRowText}>通知中心</Text>
    <IconChevron color={colors.textDisabled} />
  </TouchableOpacity>
  <View style={s.menuItemDivider} />
  <TouchableOpacity
    style={s.menuRow}
    onPress={() => { setMenuVisible(false); router.push('/(tabs)/patient/schedule'); }}
    activeOpacity={0.7}
  >
    {/* 行程與紀錄 不變 */}
  </TouchableOpacity>
</View>
```

頂部 bell（`summary.tsx:407-412`）也改為 `/(tabs)/home/notifications`。

#### 1.7.5 patient/summary.tsx 加 AI report fetch

`Promise.allSettled` block（`summary.tsx:309-321`）擴一個請求：

```tsx
const [mData, bpStatsData, bgStatsData, apptData, notifData, reportData] =
  await Promise.allSettled([
    api.get<Measurement[]>(`/measurements?recipient_id=${first.id}&limit=10`),
    api.get<MeasurementStats>(`/measurements/stats?recipient_id=${first.id}&type=blood_pressure&period=7d`),
    api.get<MeasurementStats>(`/measurements/stats?recipient_id=${first.id}&type=blood_glucose&period=7d`),
    api.get<Appointment[]>(`/appointments?recipient_id=${first.id}&limit=3`),
    api.get<Notification[]>('/notifications?limit=3'),
    api.get<LatestReport[]>(`/ai/reports?recipient_id=${first.id}&report_type=health_summary&limit=1`),
  ]);

setLatestReport(reportData.status === 'fulfilled' ? (reportData.value[0] ?? null) : null);
```

在 Vital Signs 與「近期行程」之間（line 545 附近）加「安心報」section，點擊跳 `/(tabs)/health/ai-report?recipient_id={recipient.id}`。

#### 1.7.6 patient/profile.tsx 新檔

複製 `apps/mobile/app/(tabs)/home/profile.tsx` 到 `apps/mobile/app/(tabs)/patient/profile.tsx`。改：

1. 帳號資訊 card 中的 role 字串從「委託人（家屬）」改成「被照護者」
2. 由 `useAuth().user.role` 推導 roleBadge

`/auth/me` PUT 已對所有 role 接受相同 payload，無後端工作。

> **範圍說明（決策 5）**：patient/profile.tsx **僅編輯 User 欄位**（name / phone / timezone / date_of_birth — 透過 `PUT /auth/me`）。**不暴露、不編輯任何 Recipient 欄位**（地址、緊急聯絡人、生活習慣、病史 tags 等）— 這些由 caregiver 在 `home/[recipientId]/edit.tsx` 管理。如果未來 patient 需要看自己的 recipient 資料（例如想知道 caregiver 寫的地址），須走 read-only path、不放在 profile 編輯頁，避免 patient 改了之後 caregiver 不知道。
> 這對齊 [`docs/ux-execution-backlog-v1.md` PT-01](ux-execution-backlog-v1.md) 對 patient role「No write controls. Only main screen for this role.」的定義 — 個人 User 資料是允許的（任何 role 都該能改自己的姓名/電話），但 Recipient（被照護資料）保持 read-only。

#### 1.7.7 _layout.tsx 註冊新 screens

`apps/mobile/app/(tabs)/_layout.tsx:217-230` 加：

```tsx
<Tabs.Screen name="patient/profile" options={{ href: null, title: '個人資料' }} />
```

`home/notifications` 對 patient 開放（push 可達不顯示在 tab bar）：

```tsx
<Tabs.Screen
  name="home/notifications"
  options={{
    title: '通知',
    tabBarLabel: '通知',
    tabBarIcon: ({ color }) => <TabIconBell color={color} />,
    ...(role === 'provider' ? {} : { href: null }),
  }}
/>
```

#### 1.7.8 register.tsx 角色路由

**File:** `apps/mobile/app/(auth)/register.tsx:54-56`

```tsx
await register({ email, password, name, phone: phone || undefined, role });
const target = role === 'patient'   ? '/(tabs)/patient/summary'
             : role === 'provider'  ? '/(tabs)/services/provider-tasks'
             : '/(tabs)/home';
router.replace(target);
```

> **注意**：Provider 路由實際上應走 Section 4 定義的 `routeAfterAuth` helper，根據 `review_status` 進一步判斷。Section 1 此處先簡化，Section 4 部署時覆寫。

#### 1.7.9 login.tsx 角色路由

`apps/mobile/app/(auth)/login.tsx:36`。改 `login()` 回傳 user：

```tsx
// auth-context.tsx
const login = useCallback(async (email: string, password: string) => {
  const data = await api.post<LoginResponse>('/auth/login', { email, password });
  await SecureStore.setItemAsync('auth_token', data.token);
  setToken(data.token);
  setUser(data.user);
  return data.user;
}, []);
```

`login.tsx`：

```tsx
const u = await login(email, password);
const target = u.role === 'patient'   ? '/(tabs)/patient/summary'
             : u.role === 'provider'  ? '/(tabs)/services/provider-tasks'
             : u.role === 'admin'     ? '/(tabs)/home'  // admin 在 web
             : '/(tabs)/home';
router.replace(target);
```

`register` 也同樣改回傳 user。

### 1.8 Admin web app changes

#### 1.8.1 admin/recipients/page.tsx

新增兩欄：「連結帳號」（顯示 `patient_user_email` 或灰色「未連結」）、「操作」（編輯按鈕連到 `/admin/recipients/[id]`）。更新 `Recipient` interface 與 `fetchRecipients` 讀新欄位。Admin GET 的 `include` 加 `patient_user: { select: { email: true, name: true } }`。

#### 1.8.2 admin/recipients/[id]/page.tsx 新檔

完整編輯表單 mirroring mobile edit screen，加「連結被照護者帳號」section，含 typeahead dropdown：

- 觸發 `GET /api/v1/admin/users?role=patient&q=<input>` (debounced)
- Render row 為 `name (email)`
- 提交 PUT `/api/v1/admin/recipients/{id}` with `{ patient_user_email: <selected.email> }`
- 解綁送 `null`
- 顯示 friendly errors

### 1.9 Migration / data backfill

- 不需 Prisma migration（schema 已支援）
- 不需 backfill
- Seed/demo accounts (`apps/web/prisma/seed.ts`) 應更新綁定 demo patient — QA 改進非正確性需求
- `pnpm --filter @remote-care/shared build` 後再編譯 mobile/web

### 1.10 Test plan

1. **快樂路徑**：caregiver 開新增被照護者，填名字 + patient email、submit；驗 response 含 `patient_user_id != null`。Patient 登入 → summary 顯示 recipient 名 + 量測 + AI 報告 + 完整 menu
2. **Email 不存在**：填 `nobody@test`，驗錯「查無此 Email 的被照護者帳號」
3. **角色錯誤**：填另一個 caregiver email，驗錯「此帳號不是被照護者角色」
4. **重複綁定**：第一個成功後，建第二個用同 email，驗「已連結其他被照護者」
5. **解綁**：edit 中清空 email、save，驗 response `patient_user_id: null`
6. **換綁**：從已綁狀態改別的 patient email，驗舊 patient 看到空狀態、新 patient 看到 recipient
7. **Patient 空狀態 UX**：新 patient 登入，驗看到自己的 email pill、重新整理 work、「編輯個人資料」連結到 `patient/profile.tsx`
8. **Patient menu 通知中心**：開 menu、點通知中心，驗開 `home/notifications` 顯示 patient 自己的通知
9. **Patient menu 個人資料**：點個人資料、改名字 + 電話、save。驗 `/auth/me` PUT 成功
10. **AI 報告卡**：caregiver 產一份 AI 安心報；patient session 重新整理 summary，驗 AI 報告卡出現、點擊開 `health/ai-report`
11. **Register routing**：註冊新 patient（無 caregiver），驗落在 `patient/summary`（空狀態）而非 home
12. **Login routing**：登出、用各 role 登入，驗正確落地頁
13. **Admin override**：admin 開 `/admin/recipients`，看到「連結帳號」欄；開 detail 改連結、save、驗綁定翻轉
14. **Admin 解綁**：detail 選「解除連結」、save，驗 server `patient_user_id = null`
15. **CSRF/origin**：所有新 PUT/POST 都呼叫 `checkOrigin`

### 1.11 Risk register

- **Stale shared bundle**：忘記 `@remote-care/shared` rebuild，`patient_user_email` 會被 Zod 默默 strip。Mitigation：CI 預先跑 `pnpm -r build`
- **Unique constraint races**：兩個 caregiver 同時綁同 patient，較慢的會碰 DB unique constraint（Prisma `P2002`）。Try/catch 翻譯成 `PATIENT_USER_ALREADY_BOUND`
- **Patient session 看到舊資料**：caregiver 解綁後，patient 下次 focus 才 refresh；可接受
- **部分部署**：shared schema + frontend 先上而 backend 沒上 → `patient_user_email` 被默默丟（API 忽略未知欄位），fail-safe 降級。反過來也安全
- **`home/notifications` 不該顯示在 patient tab bar**：用 `role === 'provider' ? {} : { href: null }` 而非 `visibleFor('provider', 'patient')`
- **Rollback**：所有修改皆 additive。回滾 mobile 恢復舊空狀態，DB 已綁定的 row 仍有效

### 1.12 Dependencies on other sections

無。本 spec 自包含。Demo 帳號若有獨立 seed 改進需求，是 QA 而非 blocker。

---

## Section 2: 服務需求生命週期與通知

### 2.1 Overview

服務需求經 9 個狀態流轉。**狀態機本身（auto-transition）符合 Slice 8 spec 設計**，但生命週期在以下方向都壞了：

1. **Provider task list 覆蓋缺口**：[`apps/web/app/api/v1/provider/tasks/route.ts:6`](../apps/web/app/api/v1/provider/tasks/route.ts) 的 `TASK_STATUSES = ['arranged','in_service','completed']` 不含 `caregiver_confirmed`，所以 caregiver 點「同意候選」後，工作項目對 provider 消失 — `provider-confirm.tsx` 存在但**不可達**。需擴大 list filter
2. **零通知**：`prisma.notification.create` 在 `service-requests/**` 與 `provider/**` 下完全 0 個。DB 有 model、mobile 有 icon 與 type config（`NOTIFICATION_TYPE_DISPLAY['service_request_update']`），但沒有任何 transition 觸發。Notification cards 在 `notifications.tsx:256-260` 只 mark-as-read，`patient/schedule.tsx:391` 連 `<TouchableOpacity>` 都不是
3. **Admin 無救援路徑**：[`status/route.ts:9-14`](../apps/web/app/api/v1/service-requests/[id]/status/route.ts) 只允許從 `screening / candidate_proposed / caregiver_confirmed` 退回。一旦進到 `arranged / in_service`，provider 棄案就只能手 SQL 救
4. **`provider_confirmed` 中間態僅 audit trail**：依決策 B，`confirm-provider` 維持寫 `arranged`，`provider_confirmed_at` 寫入時間戳但不經 `status='provider_confirmed'`。Mobile timeline 需用 `provider_confirmed_at` 判斷而非 `status`

統一解法 4 部分：

- **保留現況 auto-transition** — `confirm-provider` 維持寫 `arranged`（決策 B），不新增 admin 中介按鈕
- **擴大 `provider/tasks`** 含 `caregiver_confirmed`（限 `candidate_provider_id == provider.id`），讓 provider-confirm.tsx 可達
- **集中化通知**到 `apps/web/lib/service-notifications.ts`，每個 transition 路由呼叫。永遠 non-blocking（try/catch、log）。Payload `data` 一律含 `service_request_id` 加 type-specific 欄位讓 mobile deep-link
- **Mobile 深層連結 + render 缺口**。`home/notifications.tsx` 讀 `n.type` + `n.data` + role 路由；`patient/schedule.tsx` 包成 `TouchableOpacity` 共用 router。`services/[requestId].tsx` 加「服務報告」section（status==='completed' && provider_report）
- **Admin 救援白名單擴大** — `status/route.ts` 改用 `ADMIN_STATUS_TRANSITIONS`，允許從 `arranged / in_service` 退回 `screening / cancelled`

### 2.2 Decisions

#### A. provider_confirmed status：保留 enum value，但維持現況 auto-transition

**仲裁（決策 B）：保留 `provider_confirmed` 在 enum 中，但 `confirm-provider` 維持寫 `'arranged'`（auto-transition）。**

理由（完整對齊 Slice 8 spec line 22 `provider_confirmed ──[auto]──► arranged` 與既有 code）：
- 既有 [confirm-provider/route.ts:64-69](../apps/web/app/api/v1/service-requests/[id]/confirm-provider/route.ts) 寫 `'arranged'`，含註解「Auto-arrange」— 此為 Slice 8 設計意圖
- caregiver + provider 雙方都同意後直接 `arranged` 是合理 UX（demo 也是 12 步流程）
- 加 admin 中介確認沒有業務需要，反而拖慢服務媒合
- `provider_confirmed_at` 仍寫入（audit trail）；`provider_confirmed` enum value 保留供 admin 手動 rescue 路徑（`status` route 可從 arranged 退回到 provider_confirmed）
- mobile timeline (`services/[requestId].tsx:454-458`) 短路 `caregiver_confirmed → arranged` 的 UX 是設計上接受的——timeline 仍展示 `provider_confirmed_at` 時間點

實作：
- `confirm-provider/route.ts` **不改 status 寫入邏輯**（仍寫 `arranged`），僅加 `notifyServiceRequestUpdate(...)` 呼叫（Section 2.7.1）
- 不新增 admin「標記為已安排」按鈕
- `ADMIN_STATUS_TRANSITIONS`（決策 G）仍引入為 shared 常數，但 admin 進到 `arranged` 後只能退回 `screening` 或 `cancelled`（不主動推進）

#### B. Notification creation pattern

**Helper-based + per-route call。** 每個 transition route 呼叫 `apps/web/lib/service-notifications.ts` 的 typed helper。Helper 解析 recipients（caregiver user、provider user、所有 admin users）並對每個 recipient 寫一個 `notification.create`。每個 route 都包 try/catch — 通知失敗 log 但不阻擋 primary mutation，效仿 `lib/abnormal-notification.ts` 風格。

不用 Prisma middleware 或事件驅動 consumer：transition 語義不對稱 — 不同 transition 對不同 recipient set、不同 deep-link target。Middleware 把這個 mapping 推進 tagged-switch — 正是 dedicated helper 提供的，沒有間接。

#### C. Deep-link target per notification type per role

| `n.type` | `n.data` keys | caregiver | patient | provider | admin |
|---|---|---|---|---|---|
| `service_request_update` | `service_request_id`, `target_status` | `/(tabs)/services/[id]` | `/(tabs)/patient/schedule` | `caregiver_confirmed` → `provider-confirm`, else → `provider-task-detail` | `/admin/service-requests/[id]` |
| `service_request_update` (admin payload) | `service_request_id` | n/a | n/a | n/a | `/admin/service-requests/[id]` |
| `measurement_reminder` | `recipient_id` | `/(tabs)/measurements` | n/a | n/a | n/a |
| `abnormal_alert` | `recipient_id`, `measurement_id`, `measurement_type` | `/(tabs)/measurements/[recipient_id]` | n/a | n/a | n/a |
| `appointment_reminder` | `appointment_id`, `recipient_id` | `/(tabs)/patient/schedule` | `/(tabs)/patient/schedule` | n/a | n/a |
| `ai_report_ready` | `report_id`, `recipient_id` | `/(tabs)/home/ai-report?id=…` | n/a | n/a | n/a |

Mobile router 用 `useAuth()` 讀 role，套用對應 row。

### 2.3 Transition matrix

> 已對齊決策 B（auto-transition）：caregiver_confirmed + provider confirm = true → 直接 arranged，**不經 provider_confirmed 中間狀態**。

| # | Transition | Trigger | Notifications | data |
|---|---|---|---|---|
| 1 | `(none) → submitted` | caregiver / `POST /service-requests` | All admins | `{ service_request_id, target_status: 'submitted', caregiver_name, recipient_name, category_name }` |
| 2 | `submitted → screening` | admin / `PUT /[id]/status` | caregiver | `{ service_request_id, target_status: 'screening' }` |
| 3 | `screening → candidate_proposed` | admin / `PUT /[id]/propose-candidate` | caregiver, candidate provider | `{ service_request_id, target_status: 'candidate_proposed', candidate_provider_id }` |
| 4a | `candidate_proposed → caregiver_confirmed` | caregiver / `PUT /[id]/confirm-caregiver` `confirm:true` | candidate provider | `{ service_request_id, target_status: 'caregiver_confirmed' }` |
| 4b | `candidate_proposed → screening` (rejection) | caregiver / `PUT /[id]/confirm-caregiver` `confirm:false` | all admins, candidate provider | `{ ..., reason: 'caregiver_rejected' }` |
| 5a | `caregiver_confirmed → arranged` (**auto**) | provider / `PUT /[id]/confirm-provider` `confirm:true` | caregiver, all admins | `{ ..., target_status: 'arranged', assigned_provider_id }` |
| 5b | `caregiver_confirmed → screening` (rejection) | provider / `PUT /[id]/confirm-provider` `confirm:false` | caregiver, all admins | `{ ..., reason: 'provider_rejected' }` |
| 6 | `arranged → in_service` | provider / `PUT /provider/tasks/[id]/progress` | caregiver | `{ ..., target_status: 'in_service' }` |
| 7 | `in_service → completed` | provider / 同上 | caregiver, all admins | `{ ..., target_status: 'completed', has_report: true|false }` |
| 8 | `* → cancelled` (caregiver) | caregiver / `PUT /[id]/cancel` | all admins, candidate/assigned provider | `{ ..., cancelled_by: 'caregiver', from_status }` |
| 9 | `* → cancelled` (admin) | admin / `PUT /[id]/cancel` | caregiver, candidate/assigned provider | `{ ..., cancelled_by: 'admin', from_status }` |
| 10 | admin manual rescue | admin / `PUT /[id]/status` | caregiver, assigned/candidate provider | `{ ..., reason: 'admin_rescue' }` |

### 2.4 Affected files

**Backend (web):**
- `apps/web/app/api/v1/service-requests/route.ts` — POST 觸發 admin 通知
- `apps/web/app/api/v1/service-requests/[id]/status/route.ts` — 擴 ALLOWED_TRANSITIONS、發通知
- `apps/web/app/api/v1/service-requests/[id]/propose-candidate/route.ts` — 發
- `apps/web/app/api/v1/service-requests/[id]/confirm-caregiver/route.ts` — 發（兩 branch）
- `apps/web/app/api/v1/service-requests/[id]/confirm-provider/route.ts` — **status 寫入不變（仍寫 `arranged`）**，僅加 `notifyServiceRequestUpdate(...)` 呼叫
- `apps/web/app/api/v1/service-requests/[id]/cancel/route.ts` — 發
- `apps/web/app/api/v1/provider/tasks/route.ts` — 擴 status、`cancelled` opt-in
- `apps/web/app/api/v1/provider/tasks/[id]/route.ts` — ownership check 含 `candidate_provider_id`
- `apps/web/app/api/v1/provider/tasks/[id]/progress/route.ts` — 發 `in_service` 與 `completed`
- `apps/web/lib/service-notifications.ts` — **新** helper module

**Web admin:**
- `apps/web/app/admin/service-requests/[id]/page.tsx` — 擴 action buttons

**Shared:**
- `packages/shared/src/constants/enums.ts` — 加 `ADMIN_STATUS_TRANSITIONS`

**Mobile:**
- `apps/mobile/app/(tabs)/services/provider-tasks.tsx` — render `caregiver_confirmed` cards 含「待您接案」徽章；status === 'caregiver_confirmed' 時路由到 `provider-confirm`
- `apps/mobile/app/(tabs)/services/provider-task-detail.tsx` — ownership 不擋 `caregiver_confirmed`/`provider_confirmed`
- `apps/mobile/app/(tabs)/services/[requestId].tsx` — render `provider_report` 當 status === 'completed'
- `apps/mobile/app/(tabs)/home/notifications.tsx` — tap → role-aware 深層連結
- `apps/mobile/app/(tabs)/patient/schedule.tsx` — 通知卡包 `TouchableOpacity` 共用 deep-link
- `apps/mobile/lib/notification-deeplink.ts` — **新** 共用 util

### 2.5 Shared package changes

#### `packages/shared/src/constants/enums.ts`

加 admin 允許的 transition map（與 `VALID_STATUS_TRANSITIONS` 並存；`VALID_STATUS_TRANSITIONS` 不變）：

```ts
export const ADMIN_STATUS_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  submitted: ['screening', 'cancelled'],
  screening: ['submitted', 'cancelled'],
  candidate_proposed: ['screening', 'cancelled'],
  caregiver_confirmed: ['screening', 'cancelled'],
  provider_confirmed: ['arranged', 'screening', 'cancelled'], // 主流程不經此狀態（auto），保留供 admin manual rescue
  arranged: ['screening', 'cancelled'],
  in_service: ['screening', 'cancelled'],
  completed: [],
  cancelled: [],
};
```

> 決策 B（auto）下 `provider_confirmed` 在主流程不經過，但 admin 仍可從 `arranged` 退回 `provider_confirmed`（透過 `status` route）做 rescue。

`NOTIFICATION_TYPES` 已含 `SERVICE_REQUEST_UPDATE`。所有 service request 通知用此單一 type，discriminator 是 `data.target_status`。

### 2.6 Helper: `apps/web/lib/service-notifications.ts`（新）

```ts
import { prisma } from '@/lib/prisma';
import { NOTIFICATION_TYPES } from '@remote-care/shared';
import type { Prisma } from '@prisma/client';

type Recipients = {
  caregiverUserId?: string | null;
  providerUserId?: string | null;
  notifyAllAdmins?: boolean;
};

export interface ServiceRequestNotificationInput {
  serviceRequestId: string;
  targetStatus: string;
  recipients: Recipients;
  messages: Partial<Record<'caregiver' | 'provider' | 'admin', { title: string; body: string }>>;
  extraData?: Record<string, unknown>;
}

export async function notifyServiceRequestUpdate(
  input: ServiceRequestNotificationInput,
): Promise<void> {
  const { serviceRequestId, targetStatus, recipients, messages, extraData } = input;
  const baseData: Prisma.InputJsonValue = {
    service_request_id: serviceRequestId,
    target_status: targetStatus,
    ...(extraData ?? {}),
  };

  const rows: Prisma.NotificationCreateManyInput[] = [];

  if (recipients.caregiverUserId && messages.caregiver) {
    rows.push({
      user_id: recipients.caregiverUserId,
      type: NOTIFICATION_TYPES.SERVICE_REQUEST_UPDATE,
      title: messages.caregiver.title,
      body: messages.caregiver.body,
      data: { ...baseData, recipient_role: 'caregiver' },
    });
  }
  if (recipients.providerUserId && messages.provider) {
    rows.push({
      user_id: recipients.providerUserId,
      type: NOTIFICATION_TYPES.SERVICE_REQUEST_UPDATE,
      title: messages.provider.title,
      body: messages.provider.body,
      data: { ...baseData, recipient_role: 'provider' },
    });
  }
  if (recipients.notifyAllAdmins && messages.admin) {
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true },
    });
    for (const a of admins) {
      rows.push({
        user_id: a.id,
        type: NOTIFICATION_TYPES.SERVICE_REQUEST_UPDATE,
        title: messages.admin.title,
        body: messages.admin.body,
        data: { ...baseData, recipient_role: 'admin' },
      });
    }
  }

  if (rows.length === 0) return;
  try {
    await prisma.notification.createMany({ data: rows });
  } catch (err) {
    console.error('[service-notifications] createMany failed', { serviceRequestId, targetStatus, err });
  }
}

export async function resolveProviderUserId(providerId: string | null): Promise<string | null> {
  if (!providerId) return null;
  const p = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { user_id: true },
  });
  return p?.user_id ?? null;
}
```

### 2.7 Backend API changes

(參見 [完整實作 spec 細節 — 詳見原 agent 輸出，每條 transition 對應一段加 `notifyServiceRequestUpdate(...)` 呼叫]。以下列出**最關鍵的 4 段** ↓)

#### 2.7.1 confirm-provider — status 寫入不變，只加通知

**File:** [`apps/web/app/api/v1/service-requests/[id]/confirm-provider/route.ts:63-92`](../apps/web/app/api/v1/service-requests/[id]/confirm-provider/route.ts)

**決策 B 採 auto-transition：既有 `status: 'arranged'` 寫法保持不變**。本 section 僅在 `prisma.update` 之後加 `notifyServiceRequestUpdate(...)` 呼叫，不動 status 寫入邏輯。

```ts
// 既有 updateData 構造邏輯 line 63-79 完全不動：
const updateData = parsed.data.confirm
  ? {
      // Auto-arrange: caregiver already confirmed, provider now confirms
      status: 'arranged' as const,                              // ← 維持不變
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

const updated = await prisma.serviceRequest.update({ /* unchanged */ });

// 新增（僅此一段）：
const caregiverUserId = updated.caregiver_id;
const providerUserId = await resolveProviderUserId(updated.assigned_provider_id ?? updated.candidate_provider_id);

if (parsed.data.confirm) {
  // 5a: caregiver_confirmed → arranged (auto)
  await notifyServiceRequestUpdate({
    serviceRequestId: id,
    targetStatus: 'arranged',
    recipients: { caregiverUserId, notifyAllAdmins: true },
    messages: {
      caregiver: { title: '服務人員已確認接案', body: `${updated.recipient.name} 的「${updated.category.name}」已確認指派服務人員` },
      admin: { title: '服務媒合完成', body: `服務需求 ${id.slice(0, 8)} 已完成媒合並進入 arranged` },
    },
    extraData: { assigned_provider_id: updated.assigned_provider_id },
  });
} else {
  // 5b: caregiver_confirmed → screening (provider rejection)
  await notifyServiceRequestUpdate({
    serviceRequestId: id,
    targetStatus: 'screening',
    recipients: { caregiverUserId, notifyAllAdmins: true },
    messages: {
      caregiver: { title: '服務人員婉拒此次媒合', body: `「${updated.category.name}」需求已退回審核，平台將重新尋找合適服務人員` },
      admin: { title: '服務人員婉拒，需重新媒合', body: `服務需求 ${id.slice(0, 8)} 已退回 screening` },
    },
    extraData: { reason: 'provider_rejected' },
  });
}

return successResponse(updated);
```

> **重要**：`provider_confirmed_at` 仍寫入（audit trail），但 `status` 直接跳到 `arranged`。Mobile timeline 渲染時 `provider_confirmed_at` 為 truthy 即標示完成，不需依賴 status === 'provider_confirmed'。

#### 2.7.2 provider/tasks/route.ts — 擴 status filter

**File:** `apps/web/app/api/v1/provider/tasks/route.ts:6, 26-31`

```ts
const TASK_STATUSES = [
  'caregiver_confirmed',   // 等 provider accept
  'provider_confirmed',
  'arranged',
  'in_service',
  'completed',
];

const where: Prisma.ServiceRequestWhereInput = {
  OR: [
    // caregiver_confirmed: provider 必須是 candidate
    { status: 'caregiver_confirmed', candidate_provider_id: provider.id },
    // 已 confirmed 之後: provider 必須是 assigned
    { status: { in: ['provider_confirmed', 'arranged', 'in_service', 'completed'] }, assigned_provider_id: provider.id },
    ...(includeCancelled ? [{ status: 'cancelled', assigned_provider_id: provider.id }] : []),
  ],
};
```

#### 2.7.3 status/route.ts — 擴 ALLOWED_TRANSITIONS

**File:** `apps/web/app/api/v1/service-requests/[id]/status/route.ts:9-14`

```ts
import { ADMIN_STATUS_TRANSITIONS } from '@remote-care/shared';
const ALLOWED_TRANSITIONS = ADMIN_STATUS_TRANSITIONS;
```

成功更新後加 fan-out 通知（依 status 對應）。

#### 2.7.4 各 route 加 `notifyServiceRequestUpdate(...)`

每個 route 在 `prisma.update` 之後加類似：

```ts
await notifyServiceRequestUpdate({
  serviceRequestId: id,
  targetStatus: '<新 status>',
  recipients: { caregiverUserId, providerUserId, notifyAllAdmins },
  messages: { caregiver: {...}, provider: {...}, admin: {...} },
  extraData: { ... },
});
```

詳細各 route 通知 payload 見 transition matrix（Section 2.3）。

### 2.8 Web admin changes

**File:** `apps/web/app/admin/service-requests/[id]/page.tsx`

把 line 204-209 的 cascade 條件展開成 `availableTransitions` from `ADMIN_STATUS_TRANSITIONS`：

```tsx
import { ADMIN_STATUS_TRANSITIONS } from '@remote-care/shared';

const STATUS_BUTTONS: Record<string, { label: string; className: string }> = {
  screening:  { label: '退回審核', className: 'bg-blue-500 hover:bg-blue-600' },
  submitted:  { label: '退回送出', className: 'bg-blue-500 hover:bg-blue-600' },
  arranged:   { label: '標記為已安排', className: 'bg-cyan-600 hover:bg-cyan-700' },
  cancelled:  { label: '取消需求', className: 'bg-red-500 hover:bg-red-600' },
};

const transitions = ADMIN_STATUS_TRANSITIONS[request.status] ?? [];
{transitions.map((next) => {
  const cfg = STATUS_BUTTONS[next];
  if (!cfg) return null;
  const onClick = next === 'cancelled' ? cancelRequest : () => updateStatus(next);
  return (
    <button key={next} disabled={updating} onClick={() => void onClick()}
      className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${cfg.className}`}>
      {cfg.label}
    </button>
  );
})}
{request.status === 'submitted' && (
  <button disabled={updating} onClick={() => void updateStatus('screening')}
    className="rounded bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50">
    開始審核
  </button>
)}
```

### 2.9 Mobile changes

#### 2.9.1 services/provider-tasks.tsx

**STATUS_CONFIG**（line 37）加 `caregiver_confirmed`、`PENDING_STATUSES` 加：

```ts
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  caregiver_confirmed: { label: '待您接案', color: colors.warning, bg: colors.warningLight },
  candidate_proposed:  { label: '待確認',   color: colors.warning, bg: colors.warningLight },
  provider_confirmed:  { label: '已確認',   color: colors.primaryText,  bg: colors.primaryLight },
  arranged:            { label: '已安排',   color: colors.primaryText,  bg: colors.primaryLight },
  in_service:          { label: '服務中',   color: colors.secondaryText, bg: colors.accentLight },
  completed:           { label: '已完成',   color: colors.success, bg: colors.successLight },
};
const PENDING_STATUSES = ['caregiver_confirmed', 'provider_confirmed', 'arranged'];
```

**Status-aware navigation in `renderItem`（line 384）：**

```ts
onPress={() => {
  if (item.status === 'caregiver_confirmed') {
    router.push(`/(tabs)/services/provider-confirm?requestId=${item.id}`);
  } else {
    router.push(`/(tabs)/services/provider-task-detail?taskId=${item.id}`);
  }
}}
```

#### 2.9.2 services/[requestId].tsx — render provider_report

在 Admin Note block（line 433）之後、cancel button 之前加：

```tsx
{request.status === 'completed' && request.provider_report && (
  <>
    <View style={styles.sectionHeader}>
      <IconStar />
      <Text style={styles.sectionLabel}>服務報告</Text>
    </View>
    <View style={styles.card}>
      <ProviderReportSection report={request.provider_report} providerNote={request.provider_note} />
    </View>
  </>
)}
```

`ProviderReportSection` helper component 與 `provider-task-detail.tsx:608-666` 結構相同（共用 canonical nested shape）— 詳見 Section 3.5.2。

#### 2.9.3 home/notifications.tsx — deep-link

**新檔** `apps/mobile/lib/notification-deeplink.ts`：

```ts
import type { Router } from 'expo-router';

export type Role = 'caregiver' | 'patient' | 'provider' | 'admin';

export function notificationDeepLink(
  type: string,
  data: Record<string, unknown> | null,
  role: Role,
): { pathname: string; params?: Record<string, string> } | null {
  if (!data) return null;
  const sid = data.service_request_id as string | undefined;
  const targetStatus = data.target_status as string | undefined;

  switch (type) {
    case 'service_request_update':
      if (!sid) return null;
      if (role === 'caregiver') return { pathname: `/(tabs)/services/${sid}` };
      if (role === 'patient')   return { pathname: `/(tabs)/patient/schedule` };
      if (role === 'provider') {
        if (targetStatus === 'caregiver_confirmed') {
          return { pathname: `/(tabs)/services/provider-confirm`, params: { requestId: sid } };
        }
        return { pathname: `/(tabs)/services/provider-task-detail`, params: { taskId: sid } };
      }
      return null;
    case 'abnormal_alert':
      if (role !== 'caregiver') return null;
      return { pathname: `/(tabs)/measurements` };
    case 'measurement_reminder':
      if (role !== 'caregiver') return null;
      return { pathname: `/(tabs)/measurements` };
    case 'appointment_reminder':
      return { pathname: `/(tabs)/patient/schedule` };
    case 'ai_report_ready':
      if (role !== 'caregiver') return null;
      return { pathname: `/(tabs)/home` };
    default:
      return null;
  }
}

export function navigateNotification(
  router: Router,
  type: string,
  data: Record<string, unknown> | null,
  role: Role,
): boolean {
  const target = notificationDeepLink(type, data, role);
  if (!target) return false;
  router.push({ pathname: target.pathname, params: target.params });
  return true;
}
```

`notifications.tsx:256-260` 修：

```tsx
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { navigateNotification } from '@/lib/notification-deeplink';

const router = useRouter();
const { user } = useAuth();

onPress={() => {
  if (!n.is_read) void markAsRead(n.id);
  navigateNotification(router, n.type, n.data, (user?.role ?? 'caregiver') as any);
}}
activeOpacity={0.7}
```

#### 2.9.4 patient/schedule.tsx — wrap & deep-link

`Notification` interface（line 19）加 `data: Record<string, unknown> | null`。

Replace `notifications.map` block（line 391-407）：

```tsx
notifications.map((n) => {
  const isUnread = !n.is_read;
  return (
    <TouchableOpacity
      key={n.id}
      style={[s.notifCard, isUnread && s.notifCardUnread]}
      activeOpacity={0.7}
      onPress={() => {
        if (isUnread) {
          void api.put(`/notifications/${n.id}/read`, {}).catch(() => {});
          setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
        }
        navigateNotification(router, n.type, (n as any).data ?? null, 'patient');
      }}
    >
      {/* 內容不變 */}
    </TouchableOpacity>
  );
})
```

### 2.10 Test plan

完整端到端在乾淨 DB 上跑（一個 caregiver、一個 provider、一個 admin）：

1. **提交**：caregiver mobile 建新 request → status `submitted`。Admin web 看到通知。
2. **審核**：admin 點「開始審核」→ `screening`。Caregiver mobile 收通知 → tap → `/(tabs)/services/[id]`。
3. **提候選**：admin 選 provider、點「提出候選」。Caregiver 收「已為您推薦候選服務人員」；provider 收「您有新的候選邀請」。
4. **Caregiver 確認**：點「同意候選」→ `caregiver_confirmed`。Provider 收「委託人已確認，請確認接案」→ tap → `provider-confirm` (因 `target_status === caregiver_confirmed`)。Provider task list 也直接顯示帶「待您接案」badge。
5. **Provider 確認（auto-arrange）**：點「確認接案」→ status **直接** `arranged`（驗 DB：status='arranged' 且 `provider_confirmed_at` 已寫入時間戳）。Caregiver 收「服務人員已確認接案」；admin 收「服務媒合完成」。**不再有「Admin 標記為已安排」步驟。**
6. **Provider 開始**：tap「開始服務」→ `in_service`。Caregiver 收通知。
7. **Provider 完成 + report**：填 BP/HR/notes → 「完成服務」→ `completed`。Caregiver 收「服務已完成，可查看報告」。Caregiver 開 detail → 「服務報告」section render provider 提交的數值。Admin 收「服務完成」。
8. **拒絕路徑**：步驟 1-3 後 caregiver 拒絕 → `screening`，admin + provider 都收通知。1-4 後 provider 拒絕 → `screening`，caregiver + admin 收通知。
9. **Admin 救援**：從 `arranged` 或 `in_service` 點「退回審核」→ `screening`，caregiver + provider 收通知。Admin 也可手動將 status 從 `arranged` 退回 `provider_confirmed` 做更細緻 rescue（測試此 path 為 ADMIN_STATUS_TRANSITIONS 完整性）。
10. **取消**：caregiver 在 `submitted` 取消 → admin 收通知。在 `arranged` 取消 → admin + assigned provider 收。Admin 在 `arranged` 取消 → caregiver + provider 收。
11. **每個 role 通知 deep-link**：每 role 個別測 tap 通知 → 正確 navigate。
12. **失敗隔離**：暫時刪掉 admin user 然後 submit request：`serviceRequest.create` 成功，console log `[service-notifications] createMany failed`，API 回 201。

### 2.11 Risk register

- **通知失敗不擋 mutation**：`notifyServiceRequestUpdate` swallow + log 所有錯誤。Primary mutation `await` 後 success 不變
- **Notification fan-out cost**：`notifyAllAdmins` 跑 `findMany`。對平台規模可接受
- **Race: provider 點通知前 list 還沒 refresh**：`provider-tasks.tsx` 用 `useFocusEffect` 已會 refetch
- **`provider_confirmed` enum 在主流程不被觸及**：決策 B 採 auto，主流程 caregiver_confirmed → arranged 直接跳。`provider_confirmed` 只在 admin manual rescue 才會出現。前端 timeline 渲染需依賴 `provider_confirmed_at` 時間戳（仍會寫入）而非 `status === 'provider_confirmed'`
- **Admin 取消按鈕**：必須繼續走 `/cancel` 路由（保留 `cancelled_by` 語義），不能透過 `/status` PUT
- **Mobile `Notification` interface drift**：`patient/schedule.tsx:19-26` 缺 `data`。Spec 已 explicit
- **`include_cancelled` opt-in**：避免取消的卡片混進主清單

---

## Section 3: 資料存取安全 + Provider Report 形狀統一

### 3.1 Overview

本 section 解 6 個交織問題：

- Provider 上門時只看到 recipient `name + id`，沒有 medical info — 臨床安全
- AI reports endpoint 信任任何 `recipient_id`
- Admin candidate-provider dropdown 列所有 approved providers 不分配對程度
- Patient screen 讀 flat shape 沒有 writer 產生過 → 整個「服務紀錄」section 默默 render 空白
- 缺乏 admin user 管理頁面（無法 suspend bad-actor user）
- ProviderReportSchema 在 shared 已是 canonical nested shape，但 patient mobile 是唯一 out-of-line consumer

### 3.2 Decisions

#### A. Canonical ProviderReport shape

**保留 `ProviderReportSchema` 既有的 nested shape**：

1. Zod schema 在 `packages/shared/src/schemas/service-request.ts:78-95` 已驗證此 shape，progress endpoint 已接受
2. Writer (`provider-task-detail.tsx:239-255`) 已產此 shape
3. Provider 自己 detail screen 的 readonly readers 已正確 render
4. Flat shape 在 `patient/schedule.tsx:41-53` 是唯一 out-of-line consumer，零 writers，使用 string types 失去結構資訊（如 systolic/diastolic split）

**Canonical type definition**（加到 shared）：

```ts
export const ProviderReportHealthDataSchema = z.object({
  blood_pressure: z.object({
    systolic: z.number().int().min(40).max(260),
    diastolic: z.number().int().min(20).max(180),
  }).optional(),
  heart_rate: z.number().int().min(20).max(220).optional(),
  blood_glucose: z.number().min(20).max(600).optional(),
  blood_oxygen: z.number().int().min(50).max(100).optional(),
  height_cm: z.number().min(50).max(250).optional(),
  weight_kg: z.number().min(10).max(300).optional(),
  body_fat_pct: z.number().min(0).max(80).optional(),
  muscle_mass_kg: z.number().min(0).max(150).optional(),
  cholesterol: z.number().min(0).max(600).optional(),
}).strict();

export const ProviderReportSchema = z.object({
  service_date: z.string().optional(),
  health_data: ProviderReportHealthDataSchema.optional(),
  medication_notes: z.string().max(1000).optional(),
  doctor_instructions: z.string().max(1000).optional(),
  next_visit_date: z.string().optional(),
  additional_notes: z.string().max(2000).optional(),
}).strict();

export type ProviderReportHealthData = z.infer<typeof ProviderReportHealthDataSchema>;
export type ProviderReport = z.infer<typeof ProviderReportSchema>;
```

#### B. Recipient data exposure to providers

不同 context 不同欄位：

**List endpoint** `GET /api/v1/provider/tasks`：

```ts
recipient: { select: { id: true, name: true, date_of_birth: true, gender: true, medical_tags: true } },
```

**Detail endpoint** `GET /api/v1/provider/tasks/[id]`：

```ts
recipient: {
  select: {
    id: true,
    name: true,
    date_of_birth: true,
    gender: true,
    medical_tags: true,
    notes: true,
    emergency_contact_name: true,
    emergency_contact_phone: true,
    address: true,
  },
},
```

刻意不暴露 `caregiver_id` 或 `patient_user_id`。

**Caregiver path `/api/v1/service-requests/[id]`**：保留現 `{id, name}`。Caregiver 已透過 `/api/v1/recipients/[id]` 全存取，加寬會洩漏給 provider/patient。

#### C. AI reports authorization policy per role

| Role | Allowed | Constraint |
|---|---|---|
| `caregiver` | yes | `recipient.caregiver_id === auth.userId` |
| `patient` | yes | `recipient.patient_user_id === auth.userId` |
| `provider` | **no** | always deny |
| `admin` | yes | unconstrained |

Provider 拒絕原因：AI 報告是 caregiver-facing 縱向診斷。Provider 需要的是 visit-relevant subset（最近 BP/glucose），透過 measurements 提供。

#### D. Candidate-provider filter algorithm

Client-side 過濾在 admin 端，篩選為 hint 而非 enforcement：

```ts
function isProviderEligible(p: Provider, req: ServiceRequestDetail): {
  eligible: boolean; reasons: string[];
} {
  const reasons: string[] = [];
  if (p.availability_status !== 'available') reasons.push('not_available');
  const services = (p.available_services ?? []) as string[];
  if (services.length > 0 && !services.includes(req.category.code)) {
    reasons.push('category_mismatch');
  }
  const areas = (p.service_areas ?? []) as string[];
  const target = (req.location ?? '') + ' ' + (req.recipient.address ?? '');
  if (areas.length > 0 && !areas.some(a => target.includes(a))) {
    reasons.push('area_mismatch');
  }
  return { eligible: reasons.length === 0, reasons };
}
```

UI 顯示兩 group：「建議候選 (eligible)」 + 「其他可選 (with reasons)」摺疊。Admin 可從第二 group 選（中文 substring 可能漏判）。

#### E. Admin user management

**Min viable: list + suspend.** 加 `User.suspended_at` (`DateTime? @db.Timestamptz`, default `NULL`)，auth layer 阻擋登入。Suspend 解決「lock out bad actor」需求。其他（密碼重置、role change）out of scope。

> **決策 G**：採 `suspended_at: TIMESTAMPTZ NULL` 對齊既有 `recipients.deleted_at` / `providers.deleted_at` soft-delete pattern。`suspended_at IS NULL` = active；非 NULL = suspended（且記錄停權時間）。Unsuspend = `suspended_at = NULL`。

### 3.3 Affected files

1. `apps/web/prisma/schema.prisma` — 加 `User.suspended_at`
2. `apps/web/prisma/migrations/<auto-timestamped>_add_user_suspended_at/migration.sql` — 新 migration
3. `packages/shared/src/schemas/service-request.ts` — strictify + export `ProviderReportHealthDataSchema`
4. `apps/web/lib/auth.ts` — 加 `ensureRecipientAccess` helper（決策 H：僅新 routes 用，不重構既有 inline check）、阻擋 suspended users
5. `apps/web/app/api/v1/provider/tasks/route.ts` — 擴 recipient select (list)
6. `apps/web/app/api/v1/provider/tasks/[id]/route.ts` — 擴 recipient select (detail)
7. `apps/web/app/api/v1/provider/tasks/[id]/progress/route.ts` — 用 strict schema validation
8. `apps/web/app/api/v1/service-requests/[id]/route.ts` — 不變
9. `apps/web/app/api/v1/ai/reports/route.ts` — auth policy fix（採 `ensureRecipientAccess`）
10. `apps/web/app/api/v1/measurements/route.ts` — provider read access for assigned recipients（不採 helper，沿用 inline 風格 — 決策 H）
11. `apps/web/app/api/v1/admin/users/route.ts` — 新（list）
12. `apps/web/app/api/v1/admin/users/[id]/suspension/route.ts` — 新（suspend/unsuspend）
13. `apps/web/app/admin/service-requests/[id]/page.tsx` — candidate filter
14. `apps/web/app/api/v1/providers/route.ts` — 擴 select 加 availability_status 等
15. `apps/web/app/admin/users/page.tsx` — 新
16. `apps/web/app/admin/layout.tsx` — NAV_ITEMS 加 `/admin/users`
17. `apps/mobile/app/(tabs)/services/provider-task-detail.tsx` — 擴 recipient interface、render 新 section
18. `apps/mobile/app/(tabs)/services/[requestId].tsx` — render provider_report (with Section 2)
19. `apps/mobile/app/(tabs)/patient/schedule.tsx` — refactor reader to canonical shape

### 3.4 Migration: `add_user_suspended_at`

```sql
-- ALTER + 部分索引（只 index 非 NULL，因為 active 是大宗）
ALTER TABLE "users" ADD COLUMN "suspended_at" TIMESTAMPTZ;
CREATE INDEX "users_suspended_at_idx" ON "users" ("suspended_at") WHERE "suspended_at" IS NOT NULL;
```

Prisma model:
```prisma
suspended_at  DateTime?  @db.Timestamptz
```

> **遷移命令**：`cd apps/web && pnpm prisma migrate dev --name add_user_suspended_at`（Prisma 自動以 `YYYYMMDDHHMMSS_*` 14 位時間戳產生 migration 資料夾）。

> **既有 row backfill 不需**：所有現有 row 自動取 `NULL`（active）。

### 3.5 Backend API changes

#### 3.5.1 ai/reports/route.ts auth fix

**File:** `apps/web/app/api/v1/ai/reports/route.ts:30-42`

```ts
const access = await ensureRecipientAccess(auth, recipient_id, {
  caregiver: true,
  patient: true,
  provider: false,
  admin: true,
});
if (!access.ok) {
  if (access.code === 'RESOURCE_NOT_FOUND') return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
  if (access.code === 'RESOURCE_OWNERSHIP_DENIED') return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
  return errorResponse('AUTH_FORBIDDEN', '無權存取');
}
```

`ensureRecipientAccess` helper（加到 `apps/web/lib/auth.ts` 或新 `apps/web/lib/recipient-access.ts`）：

```ts
type RecipientAccessResult =
  | { ok: true; recipient: Pick<Recipient, 'id' | 'caregiver_id' | 'patient_user_id'> }
  | { ok: false; code: 'RESOURCE_NOT_FOUND' | 'RESOURCE_OWNERSHIP_DENIED' | 'AUTH_FORBIDDEN' };

export async function ensureRecipientAccess(
  auth: AuthPayload,
  recipientId: string,
  policy: { caregiver?: boolean; patient?: boolean; provider?: boolean; admin?: boolean },
): Promise<RecipientAccessResult> {
  const recipient = await prisma.recipient.findFirst({
    where: { id: recipientId, deleted_at: null },
    select: { id: true, caregiver_id: true, patient_user_id: true },
  });
  if (!recipient) return { ok: false, code: 'RESOURCE_NOT_FOUND' };

  switch (auth.role) {
    case 'caregiver':
      if (!policy.caregiver) return { ok: false, code: 'AUTH_FORBIDDEN' };
      if (recipient.caregiver_id !== auth.userId) return { ok: false, code: 'RESOURCE_OWNERSHIP_DENIED' };
      return { ok: true, recipient };
    case 'patient':
      if (!policy.patient) return { ok: false, code: 'AUTH_FORBIDDEN' };
      if (recipient.patient_user_id !== auth.userId) return { ok: false, code: 'RESOURCE_OWNERSHIP_DENIED' };
      return { ok: true, recipient };
    case 'provider':
      if (!policy.provider) return { ok: false, code: 'AUTH_FORBIDDEN' };
      return { ok: true, recipient };
    case 'admin':
      if (!policy.admin) return { ok: false, code: 'AUTH_FORBIDDEN' };
      return { ok: true, recipient };
    default:
      return { ok: false, code: 'AUTH_FORBIDDEN' };
  }
}
```

#### 3.5.2 measurements/route.ts — provider read access

**File:** `apps/web/app/api/v1/measurements/route.ts:127-137`

```ts
if (auth.role === 'caregiver') {
  if (recipient.caregiver_id !== auth.userId) {
    return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
  }
} else if (auth.role === 'patient') {
  if (recipient.patient_user_id !== auth.userId) {
    return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');
  }
} else if (auth.role === 'provider') {
  const provider = await prisma.provider.findFirst({
    where: { user_id: auth.userId, deleted_at: null },
    select: { id: true },
  });
  if (!provider) return errorResponse('AUTH_FORBIDDEN', '找不到服務人員資料');
  const assignment = await prisma.serviceRequest.findFirst({
    where: {
      assigned_provider_id: provider.id,
      recipient_id: recipient_id,
      status: { in: ['arranged', 'in_service'] },
    },
    select: { id: true },
  });
  if (!assignment) {
    return errorResponse('RESOURCE_OWNERSHIP_DENIED', '您未被指派此被照護者的進行中任務');
  }
} else if (auth.role !== 'admin') {
  return errorResponse('AUTH_FORBIDDEN', '無權存取');
}
```

POST handler 不變（仍 caregiver-only）。

#### 3.5.3 provider/tasks/route.ts list — 擴 recipient

**File:** `apps/web/app/api/v1/provider/tasks/route.ts:41`

```ts
recipient: {
  select: {
    id: true,
    name: true,
    date_of_birth: true,
    gender: true,
    medical_tags: true,
  },
},
```

#### 3.5.4 provider/tasks/[id]/route.ts detail — 擴 recipient

**File:** `apps/web/app/api/v1/provider/tasks/[id]/route.ts:26`

```ts
recipient: {
  select: {
    id: true, name: true, date_of_birth: true, gender: true,
    medical_tags: true, notes: true,
    emergency_contact_name: true, emergency_contact_phone: true,
    address: true,
  },
},
```

#### 3.5.5 admin/users/route.ts (NEW)

```ts
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
  if (auth.role !== 'admin') return errorResponse('AUTH_FORBIDDEN', '僅管理員');
  const url = new URL(request.url);
  const role = url.searchParams.get('role');                       // optional: caregiver|patient|provider|admin
  const suspended = url.searchParams.get('suspended');             // optional: 'true'|'false' — 篩選停權狀態
  const search = url.searchParams.get('search');
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role;
  if (suspended === 'true') where.suspended_at = { not: null };
  else if (suspended === 'false') where.suspended_at = null;
  if (search) where.OR = [
    { email: { contains: search, mode: 'insensitive' } },
    { name: { contains: search, mode: 'insensitive' } },
  ];
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, skip: (page - 1) * limit, take: limit,
      orderBy: { created_at: 'desc' },
      select: { id: true, email: true, name: true, role: true, suspended_at: true, created_at: true },
    }),
    prisma.user.count({ where }),
  ]);
  return paginatedResponse(users, { page, limit, total });
}
```

> 回傳的 `suspended_at` 直接給 admin UI 判定狀態（`!= null` = 停權 + 顯示時間戳）。

#### 3.5.6 admin/users/[id]/suspension/route.ts (NEW)

```ts
const SuspensionSchema = z.object({ suspended: z.boolean() });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'admin') return errorResponse('AUTH_FORBIDDEN', '僅管理員');
  const { id } = await params;
  if (id === auth.userId) return errorResponse('VALIDATION_ERROR', '不可停權自己');
  const parsed = SuspensionSchema.safeParse(await request.json());
  if (!parsed.success) return errorResponse('VALIDATION_ERROR', '輸入錯誤');
  const updated = await prisma.user.update({
    where: { id },
    data: { suspended_at: parsed.data.suspended ? new Date() : null },
    select: { id: true, email: true, name: true, role: true, suspended_at: true },
  });
  return successResponse(updated);
}
```

> 路徑改為 `/admin/users/[id]/suspension`（resource-style，名詞），request body `{ suspended: true | false }`。

#### 3.5.7 verifyAuth — 擋 suspended 用戶

[`apps/web/lib/auth.ts`](../apps/web/lib/auth.ts) 的 `verifyAuth` / `verifyJwt` 擴：

```ts
const dbUser = await prisma.user.findUnique({
  where: { id: payload.userId },
  select: { id: true, role: true, suspended_at: true },
});
if (!dbUser) return null;
if (dbUser.suspended_at !== null) return null;     // 拒絕已停權用戶
return { userId: dbUser.id, role: dbUser.role };
```

每 request 多 1 次 DB hit — 可接受，未來可 cache。

### 3.6 Web admin changes

**`admin/service-requests/[id]/page.tsx`**：擴 `ProviderOption` interface 含新欄位。Dropdown 由 flat `<option>` 改成兩個 `<optgroup>` — eligible vs not，使用 `isProviderEligible` predicate。每 option label：`name (level) · {experience_years}年 · {service_areas[0..1].join('、')}`。Non-eligible 選擇時 render 黃 warning panel 列原因。Submit 仍可 — admin override 允許。

**`admin/users/page.tsx`** (NEW)：標準 admin table。
- Filter by role（caregiver/patient/provider/admin）、suspended（true/false/all）、search（email or name）
- Status 欄位顯示：`suspended_at IS NULL` → 綠色「使用中」pill；`suspended_at` 非 null → 紅色「已停權（{date}）」pill
- 動作按鈕：使用中 → 顯示「停權」；停權 → 顯示「恢復」。皆 confirm dialog
- 呼叫 `PUT /api/v1/admin/users/[id]/suspension` body `{ suspended: true | false }`
- Self-row 的 action disabled（`row.id === currentAdmin.id`）

**`admin/layout.tsx`**：NAV_ITEMS 加 `{ href: '/admin/users', label: '使用者管理' }`。

### 3.7 Mobile changes

#### 3.7.1 services/provider-task-detail.tsx

擴 interface（line 33）：
```ts
recipient: {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  medical_tags: string[];
  notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address: string | null;
};
```

新 rendering section 在「需求描述」（line 366）與 status branches（line 370）之間。「被照護者資訊」card：
- Name + age (computed from `date_of_birth`) + gender pill
- Medical tags chips (red/orange tinted)
- Address (tappable copy/open-maps)
- Emergency contact name + phone (`Linking.openURL('tel:...')`)
- Notes free-text block

Writer 不變（已是 canonical shape）。

#### 3.7.2 services/[requestId].tsx — render provider_report

(已在 Section 2.9.2 描述)

#### 3.7.3 patient/schedule.tsx — refactor reader to canonical shape

Replace `ProviderReport` interface (line 41-53)：

```ts
import type { ProviderReport, ProviderReportHealthData } from '@remote-care/shared';
```

Refactor rendering block (line 322-369)：

```tsx
{serviceRecords.map((svc) => {
  const rpt = svc.provider_report;
  if (!rpt) return null;
  const hd = rpt.health_data ?? {};
  const reportDate = rpt.service_date
    ?? new Date(svc.preferred_date).toLocaleDateString('zh-TW');

  const dataItems: { label: string; value: string }[] = [];
  if (hd.blood_pressure) {
    dataItems.push({ label: '血壓', value: `${hd.blood_pressure.systolic}/${hd.blood_pressure.diastolic} mmHg` });
  }
  if (hd.heart_rate != null) dataItems.push({ label: '心率', value: `${hd.heart_rate} bpm` });
  if (hd.blood_glucose != null) dataItems.push({ label: '血糖', value: `${hd.blood_glucose} mg/dL` });
  if (hd.blood_oxygen != null) dataItems.push({ label: '血氧', value: `${hd.blood_oxygen}%` });
  if (hd.weight_kg != null) dataItems.push({ label: '體重', value: `${hd.weight_kg} kg` });
  if (hd.body_fat_pct != null) dataItems.push({ label: '體脂', value: `${hd.body_fat_pct}%` });
  if (hd.cholesterol != null) dataItems.push({ label: '膽固醇', value: `${hd.cholesterol}` });

  return (
    <View key={svc.id} style={s.serviceCard}>
      <View style={s.serviceHeader}>
        <Text style={s.serviceCategory}>{svc.category.name}</Text>
        <Text style={s.serviceDate}>{reportDate}</Text>
      </View>
      {dataItems.length > 0 && (
        <View style={s.serviceGrid}>
          {dataItems.map(item => (
            <View key={item.label} style={s.serviceItem}>
              <Text style={s.serviceItemLabel}>{item.label}</Text>
              <Text style={s.serviceItemValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}
      {rpt.medication_notes ? (
        <View style={s.doctorNotes}>
          <Text style={s.doctorNotesLabel}>用藥備註</Text>
          <Text style={s.doctorNotesText}>{rpt.medication_notes}</Text>
        </View>
      ) : null}
      {rpt.doctor_instructions ? (
        <View style={s.doctorNotes}>
          <Text style={s.doctorNotesLabel}>醫囑重點</Text>
          <Text style={s.doctorNotesText}>{rpt.doctor_instructions}</Text>
        </View>
      ) : null}
      {rpt.next_visit_date ? (
        <View style={s.nextVisit}>
          <Text style={s.nextVisitLabel}>下次看診</Text>
          <Text style={s.nextVisitText}>{rpt.next_visit_date}</Text>
        </View>
      ) : null}
    </View>
  );
})}
```

`CompletedService` interface (line 55-61)：

```ts
interface CompletedService {
  id: string;
  status: string;
  preferred_date: string;
  provider_report: ProviderReport | null;
  category: { name: string };
}
```

### 3.8 Test plan

1. **Provider list/detail recipient 擴展**：登入 provider mobile，看任務 card 顯示 age + gender + medical tags。Tap 進去，「被照護者資訊」section 含 address、emergency contact (tap-to-call work)、notes。Postman 用別 provider JWT 打 → 403
2. **AI reports authz**：Patient A token，查 patient A's recipient_id → 200。同 token 查 recipient B → 403。Provider token → 403。Caregiver/admin → 200
3. **Provider measurements**：`arranged` task on recipient X 的 provider 查 → 200。Task 變 `completed` 後 → 403。No task on Y → 403
4. **Candidate filter**：Set up 高雄 home_cleaning request。三 providers (P1 全合、P2 busy、P3 areas 只台北)。Admin 開 propose-candidate UI，「建議候選」只 P1，「其他可選」P2 with `not_available`、P3 with `area_mismatch`
5. **Provider report shape**：Provider 完成真實 task。DB row 含 nested JSON。Patient 登入 mobile，服務紀錄 card 顯示血壓 120/80 mmHg、HR、BG、用藥、醫囑、下次看診。Caregiver 完成 service detail 同樣顯示
6. **Admin user mgmt**：Admin 開 `/admin/users`、filter role=caregiver、search by email、列表回傳；status pill 正確顯示「使用中」或「已停權」。`PUT /admin/users/[id]/suspension` body `{suspended:true}` → 驗 DB `users.suspended_at` 寫入時間戳。U 嘗試登入被擋（`verifyAuth` 因 `suspended_at != null` return null）。U 的舊 JWT 下次 API hit 也失敗。`PUT body {suspended:false}` → DB `suspended_at = NULL`、U 可重新登入。Admin 嘗試 suspend 自己 → 按鈕 disable + POST 400

### 3.9 Risk register

- **Strict schema regression**：`.strict()` 可能 reject 漂移的 payload。Mitigation：writer in our codebase only，加 unit test
- **Provider data over-exposure**：Emergency contact phone 是 PII。Bound to assigned provider for non-terminal task。Audit log 為 follow-up
- **Provider measurements broadening**：Arranged task 可能 cancelled — 中間 provider 看 may no longer need。可接受 trade-off。Document：provider 不要 cache survives status change
- **Suspended-user JWT**：Existing JWTs 仍 valid until expiry。Mitigation：每 `verifyAuth` 檢查 status；cost 1 extra DB hit
- **Candidate filter false negatives**：中文 substring matching 可能 miss。Mitigation：filter informational
- **Patient flat-shape consumers**：grep 確認 — 只 `patient/schedule.tsx`。改後零 flat-shape readers

---

## Section 4: Provider 審核流程 + Mobile UX 收尾

### 4.1 Theme A: Provider review

#### 4.1.1 Decisions

| Question | Decision |
|---|---|
| Rename `suspended` → `rejected`，或保留兩者？ | **保留兩者**。`rejected` = reviewer 拒絕（可重新申請）；`suspended` = 已核准後被 ops 停用（admin-only recovery）|
| 加 `provider.submitted_at`？ | **是**。加 `submitted_at TIMESTAMPTZ NULL` |
| Notify provider on rejection with admin_note？ | **是** |
| Allow provider to re-submit after rejection？ | **是**。重新申請流程 reset `review_status='pending'` 並更新 `submitted_at` |

> **Phase 1 前置（決策 I）**：`PROVIDER_REVIEW_STATUSES` 既有 enum [`packages/shared/src/constants/enums.ts:60-64`](../packages/shared/src/constants/enums.ts) 只有 `PENDING / APPROVED / SUSPENDED`，**必須先擴 `REJECTED: 'rejected'`** 後本 section 所有引用 `'rejected'` 的 code 才能編譯通過。實作步驟：
> ```ts
> // packages/shared/src/constants/enums.ts (line 60-64)
> export const PROVIDER_REVIEW_STATUSES = {
>   PENDING: 'pending',
>   APPROVED: 'approved',
>   REJECTED: 'rejected',     // NEW
>   SUSPENDED: 'suspended',
> } as const;
> ```
> 之後 `pnpm --filter @remote-care/shared build` 讓 type 推導到 `'rejected'`。

#### 4.1.2 Schema migration

**File:** `apps/web/prisma/schema.prisma` (Provider model, lines 201-231)

```prisma
model Provider {
  // …existing fields…
  review_status       String    @default("pending") @db.VarChar(20)
  // valid: 'pending' | 'approved' | 'rejected' | 'suspended'
  admin_note          String?   @db.Text
  submitted_at        DateTime? @db.Timestamptz   // NEW
  reviewed_at         DateTime? @db.Timestamptz   // NEW
  deleted_at          DateTime? @db.Timestamptz
  created_at          DateTime  @default(now()) @db.Timestamptz
  updated_at          DateTime  @default(now()) @updatedAt @db.Timestamptz
}
```

**Migration（檔名由 `prisma migrate dev --name provider_review_lifecycle` 自動以 14 位時間戳產生，例：`20260508HHMMSS_provider_review_lifecycle/`）：**

```sql
ALTER TABLE "providers" ADD COLUMN "submitted_at" TIMESTAMPTZ;
ALTER TABLE "providers" ADD COLUMN "reviewed_at"  TIMESTAMPTZ;

UPDATE "providers"
   SET "submitted_at" = COALESCE("submitted_at", "created_at"),
       "reviewed_at"  = COALESCE("reviewed_at",  "updated_at")
 WHERE "review_status" IN ('approved','suspended','rejected');

UPDATE "providers"
   SET "submitted_at" = COALESCE("submitted_at", "updated_at")
 WHERE "review_status" = 'pending'
   AND (
     ("specialties" IS NOT NULL AND jsonb_array_length("specialties") > 0)
     OR "education" IS NOT NULL
   );
```

執行：`cd apps/web && pnpm prisma migrate dev --name provider_review_lifecycle`。

#### 4.1.3 Shared schema

**File:** `packages/shared/src/schemas/provider.ts:18-21`

```ts
export const ProviderReviewSchema = z.object({
  review_status: z.enum(['approved', 'rejected', 'suspended']),
  admin_note: z.string().max(1000).optional(),
}).refine(
  (v) => v.review_status === 'approved' || (v.admin_note && v.admin_note.trim().length > 0),
  { message: '拒絕或停權時必須填寫管理備註', path: ['admin_note'] },
);

export const ProviderReapplySchema = z.object({
  acknowledged_note: z.boolean().refine(v => v === true, '請先確認已了解前次未通過原因'),
});
export type ProviderReapplyInput = z.infer<typeof ProviderReapplySchema>;
```

#### 4.1.4 API: providers/[id]/review/route.ts

```ts
const existing = await prisma.provider.findFirst({ where: { id, deleted_at: null } });
if (!existing) return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務人員');

const next = parsed.data.review_status;

// State machine guards
if (next === 'suspended' && existing.review_status !== 'approved') {
  return errorResponse('VALIDATION_ERROR', '只有已核准的服務人員可被停權');
}
if (next === 'rejected' && existing.review_status === 'suspended') {
  return errorResponse('VALIDATION_ERROR', '已停權的帳號請先恢復為待審核');
}

const updated = await prisma.provider.update({
  where: { id },
  data: {
    review_status: next,
    admin_note: parsed.data.admin_note ?? existing.admin_note,
    reviewed_at: new Date(),
  },
});

if (existing.user_id) {
  const notif = (() => {
    switch (next) {
      case 'approved':
        return { title: '審核通過', body: '恭喜！您的服務人員資格已通過審核，現在可以開始接案。' };
      case 'rejected':
        return { title: '審核未通過', body: `您的服務人員資格審核未通過。${parsed.data.admin_note ? `原因：${parsed.data.admin_note}` : ''} 您可以修正資料後再次送出。` };
      case 'suspended':
        return { title: '帳號已停權', body: `您的服務人員帳號已被停權。${parsed.data.admin_note ? `原因：${parsed.data.admin_note}` : ''} 如有疑問請聯繫客服。` };
    }
  })();
  await prisma.notification.create({
    data: {
      user_id: existing.user_id,
      type: 'provider_review_result',
      title: notif.title, body: notif.body,
      data: { provider_id: id, review_status: next },
    },
  });
}
```

#### 4.1.5 API: provider/me/route.ts

PUT 自更新時設 `submitted_at` on first onboarding submit：

```ts
const wasNeverSubmitted = !provider.submitted_at;
const updated = await prisma.provider.update({
  where: { id: provider.id },
  data: {
    ...parsed.data,
    ...(wasNeverSubmitted && hasSubmissionFields(parsed.data)
       ? { submitted_at: new Date() }
       : {}),
  },
});

function hasSubmissionFields(d: ProviderSelfUpdateInput) {
  return !!(d.phone || d.education || (d.specialties && d.specialties.length)
    || (d.certifications && d.certifications.length)
    || d.experience_years != null
    || (d.service_areas && d.service_areas.length)
    || (d.available_services && d.available_services.length));
}
```

#### 4.1.6 New: provider/me/reapply/route.ts

```ts
export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'provider') return errorResponse('AUTH_FORBIDDEN', '僅服務人員可存取');
  const provider = await prisma.provider.findFirst({ where: { user_id: auth.userId, deleted_at: null } });
  if (!provider) return errorResponse('RESOURCE_NOT_FOUND', '找不到資料');
  if (provider.review_status !== 'rejected') {
    return errorResponse('VALIDATION_ERROR', '僅未通過審核的服務人員可重新送審');
  }
  const updated = await prisma.provider.update({
    where: { id: provider.id },
    data: { review_status: 'pending', submitted_at: new Date(), reviewed_at: null },
  });
  return successResponse(updated);
}
```

#### 4.1.7 Web admin: admin/providers/[id]/page.tsx

```tsx
const REVIEW_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: '待審核', color: 'bg-yellow-100 text-yellow-800' },
  approved:  { label: '已核准', color: 'bg-green-100 text-green-800' },
  rejected:  { label: '未通過', color: 'bg-orange-100 text-orange-800' },
  suspended: { label: '已停權', color: 'bg-red-100 text-red-800' },
};

const handleReview = async (reviewStatus: 'approved' | 'rejected' | 'suspended') => { /* same body */ };
```

Replace button row (lines 233-248)：

```tsx
<div className="flex flex-wrap gap-3">
  <button
    disabled={submitting || provider.review_status === 'approved'}
    onClick={() => void handleReview('approved')}
    className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
  >核准</button>

  <button
    disabled={submitting || provider.review_status !== 'pending' || !adminNote.trim()}
    onClick={() => void handleReview('rejected')}
    title={!adminNote.trim() ? '請先填寫管理備註說明拒絕原因' : ''}
    className="rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
  >拒絕並退回</button>

  <button
    disabled={submitting || provider.review_status !== 'approved' || !adminNote.trim()}
    onClick={() => void handleReview('suspended')}
    title={!adminNote.trim() ? '請先填寫停權原因' : ''}
    className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
  >停權</button>
</div>
```

也 surface `submitted_at` / `reviewed_at` 在 metadata grid。

#### 4.1.8 Mobile: provider-profile.tsx

擴 interface（line 22）：
```ts
interface ProviderProfile {
  /* …existing… */
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}
```

替換 brittle gate (lines 167-169)：
```ts
const isOnboarding = profile?.review_status === 'pending' && !profile?.submitted_at;
```

別吞 DOB save 錯誤（lines 203-207）：

```ts
let dobError: string | null = null;
if (obDateOfBirth.trim()) {
  try {
    await api.put('/auth/me', { date_of_birth: obDateOfBirth.trim() });
  } catch (e) {
    dobError = e instanceof ApiError ? e.message : '生日儲存失敗';
  }
}
if (dobError) {
  Alert.alert('部分送出成功', `服務人員資料已送出審核，但生日未能儲存：${dobError}\n您可稍後在個人資料頁更新。`);
} else {
  Alert.alert('已送出', '您的資料已送出，等待審核通知。');
}
```

Render rejection banner + reapply CTA：

```tsx
{profile.review_status === 'rejected' && (
  <View style={s.rejectionCard}>
    <View style={s.rejectionHeader}>
      <Text style={s.rejectionTitle}>審核未通過</Text>
      {profile.reviewed_at && (
        <Text style={s.rejectionDate}>
          {new Date(profile.reviewed_at).toLocaleDateString('zh-TW')}
        </Text>
      )}
    </View>
    {profile.admin_note ? (
      <Text style={s.rejectionBody}>原因：{profile.admin_note}</Text>
    ) : (
      <Text style={s.rejectionBody}>請聯繫客服了解詳情。</Text>
    )}
    <TouchableOpacity
      style={s.reapplyBtn}
      onPress={() => void handleReapply()}
      disabled={updating}
      activeOpacity={0.8}
    >
      <Text style={s.reapplyBtnText}>{updating ? '送出中...' : '修正後重新送審'}</Text>
    </TouchableOpacity>
  </View>
)}

{profile.review_status === 'suspended' && profile.admin_note && (
  <View style={s.suspendedCard}>
    <Text style={s.suspendedTitle}>帳號已停權</Text>
    <Text style={s.suspendedBody}>{profile.admin_note}</Text>
    <Text style={s.suspendedHint}>如需恢復，請聯繫客服。</Text>
  </View>
)}
```

`handleReapply`：

```ts
const handleReapply = async () => {
  Alert.alert('重新送審', '確定要重新送出審核嗎？平台將重新檢視您目前的資料。', [
    { text: '取消', style: 'cancel' },
    { text: '送出', onPress: async () => {
        setUpdating(true);
        try {
          const result = await api.post<ProviderProfile>('/provider/me/reapply', {});
          setProfile(result);
          Alert.alert('已送出', '已重新送出審核。');
        } catch (e) {
          if (e instanceof ApiError) Alert.alert('錯誤', e.message);
          else Alert.alert('錯誤', '送出失敗，請稍後再試');
        } finally { setUpdating(false); }
      }
    },
  ]);
};
```

#### 4.1.9 Post-auth routing

**File:** `apps/mobile/app/(auth)/login.tsx:36` 與 `apps/mobile/app/(auth)/register.tsx:56`

新 helper `apps/mobile/lib/post-auth-route.ts`：

```ts
import type { Router } from 'expo-router';
import { api } from './api-client';

export async function routeAfterAuth(user: { role: string }, router: Router) {
  if (user.role === 'provider') {
    try {
      const me = await api.get<{ review_status: string; submitted_at: string | null }>('/provider/me');
      if (me.review_status === 'approved')      router.replace('/(tabs)/services/provider-tasks');
      else                                       router.replace('/(tabs)/services/provider-profile');
    } catch {
      router.replace('/(tabs)/services/provider-profile');
    }
    return;
  }
  if (user.role === 'patient') router.replace('/(tabs)/patient/summary');
  else                          router.replace('/(tabs)/home');
}
```

`auth/register/route.ts` 在 `users.role='provider'` 註冊時自動建立 `Provider` row（建議）。

### 4.2 Theme B: Mobile UX cleanup

#### 4.2.1 add-appointment.tsx — 原生 DateTimePicker

兩個 picker（date 然後 time）。Default time = 09:00 local。

替換 lines 24, 33-47, 98-106：

```tsx
const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
const [showDatePicker, setShowDatePicker] = useState(false);
const [showTimePicker, setShowTimePicker] = useState(false);

if (!appointmentDate) { Alert.alert('提示', '請選擇就診日期與時間'); return; }
appointment_date: appointmentDate.toISOString(),
```

```tsx
<Text style={styles.label}>就診日期 *</Text>
<TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
  <Text style={!appointmentDate ? { color: colors.textDisabled } : { color: colors.textPrimary }}>
    {appointmentDate
      ? appointmentDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
      : '選擇日期'}
  </Text>
</TouchableOpacity>

<Text style={styles.label}>就診時間 *</Text>
<TouchableOpacity
  style={styles.input}
  onPress={() => appointmentDate && setShowTimePicker(true)}
  activeOpacity={0.7}
  disabled={!appointmentDate}
>
  <Text style={!appointmentDate ? { color: colors.textDisabled } : { color: colors.textPrimary }}>
    {appointmentDate
      ? appointmentDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '請先選擇日期'}
  </Text>
</TouchableOpacity>

{showDatePicker && (
  <DateTimePicker
    value={appointmentDate ?? (() => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d; })()}
    mode="date"
    minimumDate={new Date()}
    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    onChange={(_, selected) => {
      if (Platform.OS === 'android') setShowDatePicker(false);
      if (selected) {
        const next = appointmentDate ? new Date(appointmentDate) : new Date();
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
        if (!appointmentDate) next.setHours(9, 0, 0, 0);
        setAppointmentDate(next);
      }
    }}
  />
)}
{showTimePicker && (
  <DateTimePicker
    value={appointmentDate ?? new Date()}
    mode="time"
    is24Hour
    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    onChange={(_, selected) => {
      if (Platform.OS === 'android') setShowTimePicker(false);
      if (selected && appointmentDate) {
        const next = new Date(appointmentDate);
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        setAppointmentDate(next);
      }
    }}
  />
)}
```

#### 4.2.2 appointments.tsx — tap to edit + delete

新檔 `apps/mobile/app/(tabs)/home/edit-appointment.tsx` — clone of `add-appointment.tsx` 改：
- `useLocalSearchParams<{ id: string }>()` 然後 `api.get<Appointment>(\`/appointments/${id}\`)` on mount
- Submit 用 `api.put(\`/appointments/${id}\`, …)`
- Title「編輯就醫行程」、button「儲存變更」

Backend 加 GET `/appointments/[id]`：

```ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
  const { id } = await params;
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: { recipient: { select: { id: true, name: true, caregiver_id: true, patient_user_id: true, deleted_at: true } } },
  });
  if (!a || a.recipient.deleted_at) return errorResponse('RESOURCE_NOT_FOUND', '找不到此行程');
  const allowed =
    auth.role === 'admin' ||
    (auth.role === 'caregiver' && a.recipient.caregiver_id === auth.userId) ||
    (auth.role === 'patient' && a.recipient.patient_user_id === auth.userId);
  if (!allowed) return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此行程');
  return successResponse({
    id: a.id, recipient_id: a.recipient_id, title: a.title,
    hospital_name: a.hospital_name, department: a.department, doctor_name: a.doctor_name,
    appointment_date: a.appointment_date.toISOString(), note: a.note,
    created_at: a.created_at.toISOString(),
  });
}
```

`appointments.tsx` `renderItem` 改成 TouchableOpacity + 三點按鈕 ActionSheet（編輯/刪除）：

```tsx
const openActions = () => {
  Alert.alert(item.title, undefined, [
    { text: '編輯', onPress: () => router.push(`/(tabs)/home/edit-appointment?id=${item.id}`) },
    { text: '刪除', style: 'destructive', onPress: () => confirmDelete(item) },
    { text: '取消', style: 'cancel' },
  ]);
};

const confirmDelete = (item: Appointment) => {
  Alert.alert('刪除行程', `確定要刪除「${item.title}」嗎？此動作無法復原。`, [
    { text: '取消', style: 'cancel' },
    { text: '刪除', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/appointments/${item.id}`);
          setAppointments((prev) => prev.filter((a) => a.id !== item.id));
        } catch (e) {
          Alert.alert('錯誤', e instanceof ApiError ? e.message : '刪除失敗');
        }
      },
    },
  ]);
};
```

#### 4.2.3 Recipient 刪除

**Backend：** Add DELETE handler to `apps/web/app/api/v1/recipients/[id]/route.ts`：

```ts
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkOrigin(request)) return errorResponse('AUTH_FORBIDDEN', '不允許的來源');
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');
  const { id } = await params;
  const existing = await prisma.recipient.findFirst({ where: { id, deleted_at: null } });
  if (!existing) return errorResponse('RESOURCE_NOT_FOUND', '找不到此被照護者');
  if (auth.role === 'caregiver' && existing.caregiver_id !== auth.userId) {
    return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權刪除此被照護者');
  }
  if (!['caregiver', 'admin'].includes(auth.role)) {
    return errorResponse('AUTH_FORBIDDEN', '僅委託人或管理員可刪除');
  }
  // Block delete if there's an in-flight service request
  const pending = await prisma.serviceRequest.count({
    where: { recipient_id: id, status: { in: ['submitted', 'screening', 'candidate_proposed', 'caregiver_confirmed', 'provider_confirmed', 'arranged', 'in_service'] } },
  });
  if (pending > 0) {
    return errorResponse('VALIDATION_ERROR', '此被照護者尚有進行中的服務需求，請先完成或取消');
  }
  await prisma.recipient.update({ where: { id }, data: { deleted_at: new Date() } });
  return successResponse({ id, deleted: true });
}
```

**Audit `deleted_at: null` filtering** — 已過濾於：
- `recipients/route.ts:22, 84`
- `recipients/[id]/route.ts:22, 64`
- `recipients/[id]/reminders/**`
- `appointments/route.ts:34, 50`、`appointments/[id]/route.ts:43, 111`

需 grep `prisma.recipient.findUnique` 與 `findFirst` 缺 `deleted_at` 的地方加上。

**Mobile UI：** 在 `home/[recipientId]/edit.tsx` 底部「儲存變更」之後加 destructive zone：

```tsx
<View style={s.dangerZone}>
  <Text style={s.dangerLabel}>危險區域</Text>
  <TouchableOpacity
    style={s.deleteBtn}
    onPress={() => confirmDelete()}
    activeOpacity={0.85}
    disabled={deleting}
  >
    <Text style={s.deleteBtnText}>{deleting ? '刪除中...' : '刪除被照護者'}</Text>
  </TouchableOpacity>
  <Text style={s.dangerHint}>刪除後將不再顯示此被照護者，量測紀錄會保留但不可訪問。</Text>
</View>
```

#### 4.2.4 Settings menu

**Decision: 移除 stub。**

- `apps/mobile/app/(tabs)/patient/summary.tsx` — 刪除 lines 668-681 (`Group: 系統` 含 設定)
- `apps/mobile/app/(tabs)/services/provider-tasks.tsx` — 刪除 lines 680-694 (`Group: 系統` 含 設定)

#### 4.2.5 Social login icons

**Decision: 移除。**

`apps/mobile/app/(auth)/index.tsx`：
- 刪除 lines 16-23 (SocialIcon component)
- 刪除 lines 61-69 (`socialArea` block)
- 刪除 unused styles (socialArea / socialLabel / socialRow / socialIcon / socialIconText / socialHint / domainBadge / domainHeart / domainText / subtitle / adPlaceholder / adText / copyright)
- 把 `ctaArea` `marginBottom` 從 `spacing['3xl']` 改成 `spacing['2xl']` 補償

#### 4.2.6 Menu consistency

| Role | Group 我的 | Footer |
|---|---|---|
| Caregiver | 個人資料, 通知中心, 新增被照護者, 服務需求紀錄 | 登出 |
| Patient   | 個人資料 (NEW), 通知中心, 行程與紀錄              | 登出 |
| Provider  | 個人資料, 通知中心, 任務歷史 (NEW)                | 登出 |

各檔修改：

1. `patient/summary.tsx` — menu modal 加個人資料 row（在通知中心之上）；通知中心 target 改成 `/(tabs)/home/notifications`；移除設定（已在 4.2.4）
2. `provider-tasks.tsx` — 我的 array 加：
   ```ts
   { key: 'history', label: '任務歷史', icon: <IconCalendarMenu />, bg: colors.accentLight,
     onPress: () => router.push('/(tabs)/services/provider-tasks?filter=history') },
   ```
   `provider-tasks.tsx` 加 `?filter=history` branch 列 status `completed/cancelled`。移除設定（已在 4.2.4）
3. Caregiver `home/index.tsx` — 已 canonical，無變

#### 4.2.7 AI history surface

`(tabs)/ai/index.tsx` header 加 trailing affordance：

```tsx
<View style={s.header}>
  <Text style={s.headerTitle}>AI 助理</Text>
  <TouchableOpacity
    onPress={() => router.push('/(tabs)/health/ai-report')}
    activeOpacity={0.7}
    style={s.historyBtn}
  >
    <IconHistory color={colors.primary} />
    <Text style={s.historyBtnText}>歷史紀錄</Text>
  </TouchableOpacity>
</View>
```

### 4.3 Migration plan

1. Branch + schema：`pnpm prisma migrate dev --name provider_review_lifecycle`。Verify backfill SQL on staging
2. Build shared：`cd packages/shared && pnpm build`
3. Web 先 deploy，Mobile 後
4. Mobile release
5. Data check：`SELECT review_status, COUNT(*) FROM providers WHERE submitted_at IS NULL GROUP BY review_status;` — 只 `pending` 應出現

### 4.4 Test plan

- **A1 migration**：seed pending provider 空 fields，run migration，驗 `submitted_at IS NULL`。Seed pending with `specialties=['x']`，run migration，驗 `submitted_at = updated_at`。Seed approved，驗兩個 timestamp 都 backfilled
- **A3 review route**：PUT `{review_status:'rejected', admin_note:'…'}` on pending → 200，notification row created。沒 note → 422。`{review_status:'suspended'}` on pending → 422
- **A4 reapply route**：POST `/provider/me/reapply` as `rejected` → 200，status flips to `pending`。As `approved` → 422
- **A6 mobile**：simulate `review_status='rejected'` profile，確認 rejection card render 含 `admin_note` + 「重新送審」按鈕
- **A7 routing**：login as `provider.demo` approved → `/services/provider-tasks`。Fresh registered → `/services/provider-profile` in onboarding mode
- **B1**：open add-appointment，tap date row → date picker；pick；tap time row → time picker；submit → backend ISO 含正確 hour/minute
- **B2**：tap appointment row → edit screen prefilled。Save → list refresh。Long-press → action sheet → 刪除 → confirm → row 消失
- **B3**：recipient edit tap 刪除 → confirm → redirect home；recipient list 不含。試 in-flight service_request → backend 422
- **B4**：patient/provider menu → 無 設定 row。仍有 登出
- **B5**：landing screen → 無 FB/G/LINE icons
- **B6**：patient menu 有 個人資料 row。Provider menu 有 任務歷史 row
- **B7**：AI tab → 歷史紀錄 button visible top-right；tap → navigate `/health/ai-report`

### 4.5 Risk register

- **State machine guard 破舊 admin flow**：Mitigation：deploy admin page in same release，gate UI button-disabled
- **Backfilling `submitted_at` from `updated_at` is approximate**：可接受
- **移除設定 menu confuses returning users**：minor。Backlog item
- **Recipient soft-delete + active SR**：DELETE guard against in-flight。Without it providers see orphaned data
- **POST `/provider/me/reapply` empty body**：rejected provider 點「重新送審」without editing → 重新被拒。Mitigation：reapply edit mode forces form open
- **Older mobile clients**：keep using `/(tabs)/home` post-auth，loses nothing
- **Adding GET /appointments/[id]**：trivial，ownership check mirrors PUT/DELETE

---

## 全平台 Affected Files 索引

按 file path 排序，標註所屬 section：

### `apps/web/prisma/`
- `schema.prisma` — Section 3 (User.suspended_at) + Section 4 (Provider.submitted_at, reviewed_at)
- `migrations/<auto-timestamped>_add_user_suspended_at/` — Section 3（檔名由 prisma 自動產，14 位時間戳格式）
- `migrations/<auto-timestamped>_provider_review_lifecycle/` — Section 4（同上）

### `packages/shared/src/`
- `schemas/recipient.ts` — Section 1
- `schemas/service-request.ts` — Section 3 (ProviderReportSchema strictify + ProviderReportHealthDataSchema export)
- `schemas/provider.ts` — Section 4 (ProviderReviewSchema enum + ProviderReapplySchema)
- `schemas/auth.ts` — 暫不變（不需新欄位 — `suspended_at` 是 server-only 欄位，不暴露給 mobile）
- `constants/enums.ts` — **Phase 1 前置**：PROVIDER_REVIEW_STATUSES 加 REJECTED；新增 ADMIN_STATUS_TRANSITIONS（Section 2）
- `constants/error-codes.ts` — **Phase 1 前置**：ERROR_CODES + ERROR_STATUS_MAP 加三個 PATIENT_USER_* 錯誤碼（Section 1）

### `apps/web/lib/`
- `auth.ts` — Section 3 (suspended user check, ensureRecipientAccess)
- `service-notifications.ts` — Section 2 (NEW)
- `recipient-access.ts` — Section 3 (NEW, optional location for helper)
- `format-recipient.ts` — Section 1 (patient_user_email surfacing)
- `resolve-patient-binding.ts` — Section 1 (NEW, helper for caregiver+admin recipient PUT)

### `apps/web/app/api/v1/`
- `auth/register/route.ts` — Section 4 (auto-create Provider row for role='provider')
- `recipients/route.ts` — Section 1 (POST patient_user_email)
- `recipients/[id]/route.ts` — Section 1 (PUT patient_user_email) + Section 4 (DELETE)
- `service-requests/route.ts` — Section 2 (POST notify admins)
- `service-requests/[id]/route.ts` — 不變（Section 3 仲裁）
- `service-requests/[id]/status/route.ts` — Section 2 (ADMIN_STATUS_TRANSITIONS + notify)
- `service-requests/[id]/propose-candidate/route.ts` — Section 2 (notify)
- `service-requests/[id]/confirm-caregiver/route.ts` — Section 2 (notify both branches)
- `service-requests/[id]/confirm-provider/route.ts` — Section 2 (status 寫入不變，僅加通知)
- `service-requests/[id]/cancel/route.ts` — Section 2 (notify)
- `provider/tasks/route.ts` — Section 2 (caregiver_confirmed) + Section 3 (recipient select)
- `provider/tasks/[id]/route.ts` — Section 2 (ownership) + Section 3 (recipient select)
- `provider/tasks/[id]/progress/route.ts` — Section 2 (notify)
- `provider/me/route.ts` — Section 4 (submitted_at on first submit)
- `provider/me/reapply/route.ts` — Section 4 (NEW)
- `providers/route.ts` — Section 3 (extend select)
- `providers/[id]/review/route.ts` — Section 4 (state machine + notify all 3 statuses)
- `appointments/[id]/route.ts` — Section 4 (GET handler NEW)
- `measurements/route.ts` — Section 3 (provider read access)
- `ai/reports/route.ts` — Section 3 (auth fix)
- `admin/recipients/route.ts` — Section 1 (include patient_user)
- `admin/recipients/[id]/route.ts` — Section 1 (NEW PUT)
- `admin/users/route.ts` — Section 3 (NEW GET) + Section 1 (used by admin recipient dropdown)
- `admin/users/[id]/suspension/route.ts` — Section 3 (NEW PUT — body `{suspended:boolean}`)

### `apps/web/app/admin/`
- `layout.tsx` — Section 3 (NAV_ITEMS adds /admin/users)
- `recipients/page.tsx` — Section 1 (binding column)
- `recipients/[id]/page.tsx` — Section 1 (NEW edit page)
- `service-requests/[id]/page.tsx` — Section 2 (transitions) + Section 3 (candidate filter)
- `providers/[id]/page.tsx` — Section 4 (rejected button)
- `users/page.tsx` — Section 3 (NEW)

### `apps/mobile/app/`
- `(auth)/index.tsx` — Section 4 (remove social login)
- `(auth)/register.tsx` — Section 1 + Section 4 (role routing)
- `(auth)/login.tsx` — Section 1 + Section 4 (role routing)
- `(tabs)/_layout.tsx` — Section 1 (patient/profile + home/notifications open to patient)
- `(tabs)/ai/index.tsx` — Section 4 (history link)
- `(tabs)/home/index.tsx` — 不變
- `(tabs)/home/notifications.tsx` — Section 2 (deep link)
- `(tabs)/home/add-appointment.tsx` — Section 4 (DateTimePicker)
- `(tabs)/home/appointments.tsx` — Section 4 (tap+delete)
- `(tabs)/home/edit-appointment.tsx` — Section 4 (NEW)
- `(tabs)/home/add-recipient.tsx` — Section 1 (patient_user_email)
- `(tabs)/home/[recipientId]/edit.tsx` — Section 1 (binding) + Section 4 (delete)
- `(tabs)/patient/summary.tsx` — Section 1 (empty state + AI report fetch + menu)
- `(tabs)/patient/profile.tsx` — Section 1 (NEW)
- `(tabs)/patient/schedule.tsx` — Section 2 (deep link) + Section 3 (canonical shape)
- `(tabs)/services/provider-tasks.tsx` — Section 2 (caregiver_confirmed routing) + Section 4 (history filter, remove settings)
- `(tabs)/services/provider-task-detail.tsx` — Section 2 (ownership) + Section 3 (recipient info section)
- `(tabs)/services/provider-confirm.tsx` — Section 2 (reachable from list now)
- `(tabs)/services/[requestId].tsx` — Section 2 (provider_report rendering)
- `(tabs)/services/provider-profile.tsx` — Section 4 (rejection banner + reapply, isOnboarding fix, DOB error)

### `apps/mobile/lib/`
- `notification-deeplink.ts` — Section 2 (NEW)
- `post-auth-route.ts` — Section 4 (NEW)

---

## Migration 順序總覽

```
Phase 0 (Shared 前置 — TypeScript 編譯依賴):
  1. 編輯 packages/shared/src/constants/enums.ts:
     - PROVIDER_REVIEW_STATUSES 加 REJECTED: 'rejected'
     - 新增 ADMIN_STATUS_TRANSITIONS export
  2. 編輯 packages/shared/src/constants/error-codes.ts:
     - ERROR_CODES 加 PATIENT_USER_NOT_FOUND / _ROLE_MISMATCH / _ALREADY_BOUND
     - ERROR_STATUS_MAP 加對應 404 / 400 / 409
  3. 編輯 packages/shared/src/schemas/service-request.ts:
     - ProviderReportHealthDataSchema export + .strict()
     - ProviderReportSchema .strict()
  4. 編輯 packages/shared/src/schemas/recipient.ts:
     - RecipientCreateSchema 加 patient_user_email
     - RecipientUpdateSchema 加 patient_user_email (.nullable())
     - RecipientResponseSchema 加 patient_user_email + patient_user_name
  5. cd packages/shared && pnpm build

Phase 1 (Schema migrations — 在 schema.prisma 改完後跑):
  6. 編輯 apps/web/prisma/schema.prisma:
     - User 加 suspended_at  DateTime?  @db.Timestamptz
     - Provider 加 submitted_at + reviewed_at DateTime?  @db.Timestamptz
  7. cd apps/web && pnpm prisma migrate dev --create-only --name add_user_suspended_at
     # 確認產生的 SQL 含 ALTER + 部分索引（CREATE INDEX ... WHERE suspended_at IS NOT NULL）
  8. cd apps/web && pnpm prisma migrate dev --create-only --name provider_review_lifecycle
     # 手動編輯產生的 SQL 加入 backfill UPDATE statements
     # （Prisma 不會從 schema diff 產 UPDATE）
  9. cd apps/web && pnpm prisma migrate dev    # apply 兩個 migration 到 local DB
 10. cd apps/web && pnpm prisma generate       # 更新 prisma client types

Phase 2 (Backend + Web admin code):
 11. 依 Section 1-4 依序實作 backend routes、admin pages
 12. pnpm -r typecheck 全 pass
 13. pnpm -r lint 全 pass
 14. pnpm -r test 全 pass

Phase 3 (Backend deploy via Vercel auto-deploy):
 15. git push to main
 16. Verify https://api.wedocare.co health

Phase 4 (Mobile build):
 17. cd apps/mobile && eas build --platform ios --profile production --auto-submit
```

**重要**：
- **Phase 0 必須先跑**（不只 build；TypeScript 編譯靠這些常數，跳過 Phase 0 backend 直接編譯失敗）
- **Phase 1 Schema 必須先跑**（DB column 要先在，不然 prisma client 跟 backend 都會炸）
- 用 `--create-only` 是因為第二個 migration 需要 backfill UPDATE，prisma 不會自動產，要先 skeleton 再手動加 SQL
- Web 自動 deploy 跟 mobile build 可同時進行（mobile build 用 local code，不依賴 web 已部署）

---

## 部署檢查清單

### Pre-deploy

- [ ] 跑 `pnpm -r typecheck`，全 pass
- [ ] 跑 `pnpm -r lint`，全 pass
- [ ] 跑 `pnpm -r test`，全 pass（無 test 也 OK，但建議補核心 helper 的 test）
- [ ] 在 staging DB 跑 migrations 並驗 backfill
- [ ] Manual test 每 section 的 test plan

### Deploy

- [ ] DB migration 在 production DB 上成功跑完
- [ ] `pnpm --filter @remote-care/shared build` 完成
- [ ] Backend deploy（自動 via git push）
- [ ] 驗證 backend health endpoint
- [ ] Mobile EAS build 完成
- [ ] EAS submit to TestFlight

### Post-deploy

- [ ] DB sanity：`SELECT review_status, COUNT(*) FROM providers GROUP BY review_status;` 只有 4 種狀態（pending / approved / rejected / suspended）
- [ ] DB sanity：`SELECT CASE WHEN suspended_at IS NULL THEN 'active' ELSE 'suspended' END AS state, COUNT(*) FROM users GROUP BY state;` 只 active/suspended 兩列
- [ ] 用三個 demo 帳號完整跑一次 happy path
- [ ] 驗證新註冊 patient 看到正確 empty state
- [ ] 驗證 caregiver 邀請 patient → patient 看到資料
- [ ] 驗證一個 service request 從 submitted 走到 completed，所有通知都正確發出 + 點擊都正確深層連結
- [ ] 驗證 provider 在 task detail 看到 medical info
- [ ] 驗證 patient 在 schedule 看到 provider report 資料

---

## 風險登記與回滾

### 高風險

1. **Schema migration 失敗** — Mitigation：先在 staging clone 上跑。Rollback：`prisma migrate resolve --rolled-back <name>` + 手動 `DROP COLUMN`
2. **Shared package 前置 (Phase 0) 漏跑** — Symptom：backend 編譯失敗於 `'rejected'` 不在 enum、`'PATIENT_USER_NOT_FOUND'` 不在 ErrorCode。Mitigation：每個工程開工前都先跑 `pnpm --filter @remote-care/shared build`；CI 預先 `pnpm -r build` 把關
3. **`prisma migrate dev` 失敗於 Supabase（無 shadow DB 權限）** — Symptom：建立 migration 時報「shadow database creation failed」。Mitigation：本地用 docker-compose 起 PostgreSQL 跑 migration、再 `prisma migrate deploy` 推 production；或 `--create-only` 後手動 apply
4. **Notification creation 拖慢 transition routes** — Mitigation：所有 notify call 包 try/catch，永不阻擋 primary mutation

### 中風險

5. **Patient 已綁但 caregiver 沒看到 binding 欄位** — 因 mobile 舊版未升級。Mitigation：force-update banner 已在 app
6. **Race conditions on patient_user_id binding** — Two caregivers 同時綁同 patient。Mitigation：catch Prisma `P2002` → friendly error
7. **Strict ProviderReportSchema 拒絕 漂移 payload** — Mitigation：writer in our codebase only

### 低風險

8. **移除 設定 menu 困惑用戶** — minor，document in release notes
9. **Removing social login icons** — minor，沒人正在用
10. **Substring matching false negatives in candidate filter** — informational filter，admin 可手動 override

### 全面回滾策略

按部署順序逆推：

1. **Mobile**：TestFlight 切回前一個 build
2. **Web**：`git revert <commit-range> && git push`（Vercel 自動 deploy 舊版）
3. **DB**：每個 migration 都有 down script — `prisma migrate resolve --rolled-back <name>` + 手動 `DROP COLUMN`（如必要）

每個 section 的 risk register 也獨立記錄了 section-specific 的回滾考量。

---

> **文件結束**。執行此計畫的工程師可以從 [Section 1](#section-1-patient-綁定與角色完整性) 開始，依序執行至 Section 4，最後依 Migration 順序總覽部署。
