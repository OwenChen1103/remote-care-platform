# 遠端照護平台 — 實作計畫

> **文件版本**：1.0.0
> **最後更新**：2026-03-07
> **狀態**：定案
> **依據**：implementation-spec.md v1.1.0 + engineering-standards.md v1.1.0

---

## 目錄

- [1. 總覽與排序原則](#1-總覽與排序原則)
- [2. SOP：每次呼叫 Claude 的固定流程](#2-sop每次呼叫-claude-的固定流程)
- [3. Change Request 規則](#3-change-request-規則)
- [4. Slice 定義（0-8 + Patient-Lite TBD）](#4-slice-定義0-8--patient-lite-tbd)
- [5. 風險總覽與降級策略](#5-風險總覽與降級策略)

---

## 1. 總覽與排序原則

### 排序準則

每個 Slice 是一個**可上線的 Vertical Slice（端到端閉環）**：

1. 每個 Slice 從 DB schema → API → 前端 UI → 測試，完整閉環
2. 後面的 Slice 依賴前面的 Slice（不可跳過）
3. 每個 Slice 完成後，系統在該範圍內可以 demo
4. 每個 Slice 必須通過 CI gate：lint / typecheck / test / build

### 完成標準（每個 Slice 皆適用）

- 真實 DB + 真實 API（只允許 seed data，禁止硬編假資料）
- 有 validation、錯誤處理、RBAC、loading/empty/error 狀態
- 通過 lint / typecheck / tests / build
- 能跑過對應的驗收劇本（Given/When/Then）

### Slice 總覽

| Slice | 名稱 | 核心交付 | 前置依賴 |
|-------|------|---------|---------|
| 0 | Repo 工程骨架 | Monorepo + CI + 空殼可跑 | 無 |
| 1 | Auth 認證 | 註冊/登入/JWT/RBAC | Slice 0 |
| 2 | Recipients 被照護者 | CRUD + Ownership | Slice 1 |
| 3 | Measurements 健康數據 | BP/BG CRUD + 異常判斷 + 統計 | Slice 2 |
| 4 | AI 放心報 | 報告生成 + 顯示 + 分享 | Slice 3 |
| 5 | Notifications 通知 | 通知系統 + 提醒 + Cron | Slice 3 |
| 6 | Appointments 行程 | 行程 CRUD | Slice 2 |
| 7 | Service Requests 需求單 | 需求送出 + Admin 管理 + 狀態機 | Slice 2 |
| 8 | Providers + Admin Dashboard | 服務人員管理 + 檔案上傳 + Dashboard | Slice 7 |
| TBD | Patient-Lite 被照護者介面 | 被照護者簡化唯讀介面 | Slice 1, 3（基礎）；Slice 4-6 完成程度影響功能範圍與排序 |

> **Patient-Lite 排序說明**：此 Slice 為已確認之產品方向，建議排在 Slice 6 之後。與 Service Requests 的先後順序取決於業務展示優先級，實作前再定案。詳見 implementation-spec.md Q 節。

---

## 2. SOP：每次呼叫 Claude 的固定流程

每次開始一個 Slice 或子任務時，嚴格遵循以下五步驟：

### Step 1: Plan（計畫）
- 列出本次要做的檔案清單與變更範圍
- 確認不超出 MVP scope（對照 implementation-spec A.5）
- 確認前置 Slice 是否已完成

### Step 2: Execute（執行）
- 按計畫逐一實作
- 先寫 shared schema → 再寫 API → 再寫前端
- 遵守 engineering-standards 所有規範

### Step 3: Verify（驗證）
- 跑 `pnpm lint`
- 跑 `pnpm typecheck`
- 跑 `pnpm test`
- 跑 `pnpm build`
- 全部通過才進下一步

### Step 4: Review（檢查）
- 對照驗收劇本（Given/When/Then）逐條確認
- 對照 engineering-standards Review Checklist
- 確認無 `any`、無硬編碼、無 console.log

### Step 5: Finish（完成）
- 輸出本次新增/修改的檔案清單
- 輸出驗收結果
- 標記 Slice 完成

---

## 3. Change Request 規則

### 新增需求的處理流程

1. **屬於 MVP 10 模組範圍**：評估工時。若 ≤ 4 小時，以替換方式（砍掉同等工時的低優先功能）進入當前 Slice；若 > 4 小時，排入後續 Slice
2. **超出 MVP 範圍**：直接拒絕，記錄到 Phase 2 backlog
3. **涉及 spec A.5 嚴格排除**：一律拒絕，不進入評估

### 禁止事項

- 嚴禁在開發過程中自行新增 spec 未定義的功能
- 嚴禁用假資料/硬編碼完成 demo（seed data 除外）
- 嚴禁跳過 CI gate
- 嚴禁在不更新 spec 的情況下改變 API 合約

---

## 4. Slice 定義（0-8 + Patient-Lite TBD）

---

### Slice 0：Repo 工程骨架

**目標**：建立可跑的 monorepo，所有 CI gate 通過，三個 workspace 都能啟動。

#### 最小交付物

| 層 | 交付 |
|----|------|
| Monorepo | pnpm-workspace.yaml, turbo.json, tsconfig.base.json, root package.json |
| packages/shared | Zod schema 目錄結構 + error-codes + enums + thresholds + build (tsup) |
| apps/web | Next.js 空殼 + Prisma schema init + healthcheck API + admin login/service-requests skeleton |
| apps/mobile | Expo RN 空殼 + tab navigation + API client skeleton |
| CI | GitHub Actions (lint → typecheck → test → build) |
| Config | ESLint, Prettier, EditorConfig, .env.example, .gitignore, PR template |
| Tests | 至少 1 個 smoke test per workspace |

#### 驗收劇本

```gherkin
Given monorepo 已建立且 pnpm install 成功
When 執行 pnpm lint
Then 零錯誤且零 warning

Given monorepo 已建立
When 執行 pnpm typecheck
Then 零型別錯誤

Given packages/shared 有 smoke test
When 執行 pnpm test
Then 所有測試通過

Given apps/web 已建立
When 執行 pnpm build
Then Next.js build 成功（SKIP_ENV_VALIDATION=true）

Given apps/web dev server 啟動
When GET /api/v1/healthcheck
Then 回傳 { "success": true, "data": { "status": "ok" } }

Given apps/mobile 已建立
When expo start
Then App 能在模擬器/Expo Go 中開啟並顯示首頁
```

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| Expo + monorepo metro 設定衝突 | 使用 expo 官方 monorepo 範例設定 metro.config.js |
| tsup build shared 對 Expo 不相容 | 改用 tsc 直接編譯，或 mobile 直接 source import |
| Prisma schema 不含 DB 無法 build | build script 加 SKIP_ENV_VALIDATION，Prisma generate 不需要 DB |

---

### Slice 1：Auth 認證

**目標**：註冊/登入完整流程，JWT 驗證，RBAC 中間件，Mobile 登入畫面 + Admin 登入。

#### 最小交付物

| 層 | 交付 |
|----|------|
| DB | users 表 migration |
| Shared | auth.ts Zod schema (RegisterSchema, LoginSchema, UserSchema) |
| API | POST /auth/register, POST /auth/login, GET /auth/me, PUT /auth/me, POST /auth/logout, POST /auth/admin-login |
| Web | Admin login 頁面（真實表單 + cookie 設定）、Admin layout auth guard |
| Mobile | Login 頁面 + Register 頁面 + AuthContext + SecureStore token 管理 |
| Tests | Auth API tests (register success/duplicate/validation, login success/fail), shared schema tests |
| Seed | admin@remotecare.dev + demo@remotecare.dev 帳號 |

#### 驗收劇本

```gherkin
Given 系統已啟動且 DB 已 migrate
When 委託人以有效資料 POST /api/v1/auth/register
Then 回傳 201 + user 物件 + JWT token

Given 已註冊帳號
When 以正確密碼 POST /api/v1/auth/login
Then 回傳 200 + JWT token

Given 已登入（有 valid JWT）
When GET /api/v1/auth/me
Then 回傳當前使用者資料

Given 未登入
When GET /api/v1/auth/me
Then 回傳 401 AUTH_REQUIRED

Given Admin 帳號
When 在 Web Admin 登入頁輸入正確帳密
Then 設定 httpOnly cookie + 跳轉到 /admin/dashboard

Given Caregiver 帳號
When 嘗試存取 Admin 頁面
Then 回傳 403 或重導到 /admin/login
```

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| bcrypt 在 Edge Runtime 不支援 | 使用 Node.js runtime（Next.js route handler 預設 Node） |
| JWT RS256 需要管理 key pair | MVP 用 HS256 + JWT_SECRET 環境變數即可 |
| Expo SecureStore 在 Web 不可用 | 僅支援原生端；Web 測試用 AsyncStorage fallback |

---

### Slice 2：Recipients 被照護者

**目標**：被照護者 CRUD，ownership 驗證，Mobile 首頁顯示清單，Admin 可讀所有。

#### 最小交付物

| 層 | 交付 |
|----|------|
| DB | recipients 表 migration |
| Shared | recipient.ts Zod schema (CreateSchema, UpdateSchema, ResponseSchema) |
| API | POST/GET/GET:id/PUT /recipients + ownership middleware |
| Web | /admin/recipients 唯讀清單頁面 |
| Mobile | 首頁被照護者卡片清單 + 新增/編輯被照護者表單 + 被照護者詳情頁 |
| Tests | Recipients API tests (CRUD + ownership + limit), schema tests |

#### 驗收劇本

```gherkin
Given 已登入的委託人
When POST /api/v1/recipients 帶有效資料
Then 回傳 201 + recipient 物件

Given 委託人已有被照護者
When GET /api/v1/recipients
Then 只回傳自己的被照護者（不含其他人的）

Given 委託人 A 的被照護者
When 委託人 B 嘗試 GET /api/v1/recipients/:id
Then 回傳 403 RESOURCE_OWNERSHIP_DENIED

Given 委託人已有 10 位被照護者
When 嘗試新增第 11 位
Then 回傳 400 RECIPIENT_LIMIT_EXCEEDED

Given Mobile 首頁
When 頁面載入
Then 顯示被照護者卡片列表，含姓名、年齡、疾病標籤

Given Admin 登入
When 進入 /admin/recipients
Then 顯示全平台被照護者清單（唯讀）
```

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| Recipient 卡片需顯示 latest BP/BG | Slice 2 先不顯示（Slice 3 完成後補上） |
| 軟刪除邏輯複雜 | MVP 先不實作刪除功能，Phase 2 補上 |

---

### Slice 3：Measurements 健康數據

**目標**：血壓/血糖 CRUD + 異常判斷引擎 + 統計 API + 趨勢圖表 + 匯出分享。

#### 最小交付物

| 層 | 交付 |
|----|------|
| DB | measurements 表 migration |
| Shared | measurement.ts Zod schema + thresholds.ts 異常閾值常數 |
| API | POST/GET /measurements + GET /measurements/stats + GET /measurements/export |
| Mobile | 新增量測表單（BP/BG 切換）+ 趨勢圖表頁（7/30 天）+ 數據匯出分享 |
| Tests | Measurements API tests (CRUD + abnormal detection + stats), thresholds unit tests |
| Seed | 30 天血壓/血糖歷史資料（含異常） |

#### 驗收劇本

```gherkin
Given 已登入且有被照護者
When POST /api/v1/measurements 帶 BP 資料 systolic=145, diastolic=92
Then 回傳 201 + is_abnormal=true

Given 已有 30 天量測資料
When GET /api/v1/measurements/stats?recipient_id=X&type=blood_pressure&period=7d
Then 回傳正確的 min/max/avg 和 daily_data

Given Mobile 趨勢頁
When 切換 7 天 / 30 天
Then 圖表正確更新，異常點標紅

Given 量測資料存在
When GET /api/v1/measurements/export?recipient_id=X&type=blood_pressure&from=...&to=...
Then 回傳可複製的文字摘要

Given BP 輸入 systolic=500
When 提交表單
Then 前端 + 後端都擋住（validation error）
```

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| React Native 圖表套件選型 | 優先 react-native-chart-kit（輕量）；若不足改 victory-native |
| 異常判斷邏輯複雜 | MVP 用簡單 if/else，不做規則引擎 |
| 統計 API 效能 | MVP 資料量小，直接用 Prisma aggregate；大量資料改用 raw SQL |

---

### Slice 4：AI 放心報

**目標**：呼叫 OpenAI API 生成健康摘要，Mobile 顯示報告 + 免責聲明 + 分享。

#### 最小交付物

| 層 | 交付 |
|----|------|
| DB | ai_reports 表 migration |
| Shared | ai.ts Zod schema (HealthReportSchema, report type enums) |
| API | POST /ai/health-report + GET /ai/reports + POST /ai/chat |
| Web | lib/ai.ts OpenAI 呼叫封裝（prompt 模板 + JSON mode + fallback） |
| Mobile | 報告生成 UI（選類型 → 生成 → 顯示結果 + 免責聲明 + 分享按鈕）+ 歷史報告列表 |
| Tests | AI API tests（mock OpenAI，驗證 Zod schema 回傳、fallback、rate limit） |

#### 驗收劇本

```gherkin
Given 被照護者有 7 天以上量測資料
When POST /api/v1/ai/health-report { recipient_id, report_type: "health_summary" }
Then 回傳 201 + 含 status_label/summary/reasons/suggestions/disclaimer

Given AI 報告已生成
When Mobile 顯示報告
Then 必須顯示免責聲明文字

Given 使用者按分享
When 複製報告文字
Then 剪貼簿包含完整摘要 + 免責聲明

Given 同一被照護者同一 report_type
When 1 小時內第 4 次呼叫
Then 回傳 429 AI_RATE_LIMITED

Given OpenAI API 超時
When 生成報告
Then 回傳 fallback 文字「暫時無法生成報告，請查看趨勢圖表了解近期數據。」
```

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| OpenAI API 不穩定 | 15 秒 timeout + 1 次 retry + fallback 文字 |
| AI 回應不符 Zod schema | 重試一次；仍失敗回傳 fallback |
| 費用超控 | 環境變數設定月預算 $50；超過自動停用 AI 功能 |

---

### Slice 5：Notifications 通知

**目標**：In-app 通知系統 + 量測提醒 + 異常通知 + Vercel Cron。

#### 最小交付物

| 層 | 交付 |
|----|------|
| DB | notifications 表 + measurement_reminders 表 migration |
| Shared | notification.ts Zod schema + enum types |
| API | GET /notifications + GET /notifications/unread-count + PUT /notifications/:id/read + PUT /notifications/read-all |
| Cron | /api/cron/reminders + /api/cron/appointment-reminders + vercel.json 設定 |
| Mobile | 通知清單頁（含已讀/未讀標示）+ badge 數字 + 點擊跳轉 |
| Tests | Notification API tests + cron handler tests |

#### 驗收劇本

```gherkin
Given 被照護者設定了 08:00 量測提醒
When Cron 在 08:00 執行
Then 建立 measurement_reminder 通知

Given 最近 3 筆血壓有 2 筆異常
When 新增第 3 筆異常量測
Then 自動建立 abnormal_alert 通知（24 小時內不重複）

Given 有未讀通知
When Mobile 通知頁載入
Then 顯示未讀通知列表 + 未讀數 badge

Given 通知存在
When PUT /api/v1/notifications/:id/read
Then 該通知標記為已讀
```

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| Vercel Cron 免費版限制（1 次/天） | Hobby plan 支援每日 1 cron；Pro plan 可多個。MVP 先以手動觸發 API 替代 |
| 時區轉換複雜 | MVP 預設 Asia/Taipei，簡化時區處理 |

---

### Slice 6：Appointments 行程

**目標**：就醫行程 CRUD + Mobile 行程管理 UI。

#### 最小交付物

| 層 | 交付 |
|----|------|
| DB | appointments 表 migration |
| Shared | appointment.ts Zod schema |
| API | POST/GET/PUT/DELETE /appointments |
| Mobile | 行程清單（30 天未來）+ 新增/編輯行程表單 |
| Tests | Appointments API tests (CRUD + ownership + future date validation) |

#### 驗收劇本

```gherkin
Given 已登入且有被照護者
When POST /api/v1/appointments 帶有效資料
Then 回傳 201 + appointment 物件

Given 有行程存在
When GET /api/v1/appointments?recipient_id=X
Then 回傳未來 30 天行程（按日期升冪）

Given 行程存在
When DELETE /api/v1/appointments/:id
Then 行程被硬刪除

Given Mobile 行程頁
When 點擊新增行程
Then 顯示表單（日期/醫院/科別/醫師/備註）
```

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| 日期選擇器 UX | 使用 Expo DateTimePicker（原生元件） |

---

### Slice 7：Service Requests 需求單

**目標**：服務需求完整流程（送出 → Admin 審查 → 狀態更新 → 指派 → 委託人看結果）。

#### 最小交付物

| 層 | 交付 |
|----|------|
| DB | service_categories + service_requests 表 migration |
| Shared | service-request.ts Zod schema（含狀態機轉換驗證） |
| API | GET /service-categories + POST/GET/GET:id /service-requests + PUT /:id/status + PUT /:id/assign |
| Web | /admin/service-requests 列表 + 詳情頁（狀態更新 + 指派） |
| Mobile | 需求清單 + 送出需求表單 + 需求詳情（狀態 timeline） |
| Tests | Service request tests (CRUD + state machine + assign + ownership) |
| Seed | 3 個服務類別 + 2 筆需求單 |

#### 驗收劇本

```gherkin
Given 已登入委託人 + 有被照護者
When POST /api/v1/service-requests 帶有效資料
Then 回傳 201 + status=submitted

Given Admin 登入
When PUT /api/v1/service-requests/:id/status { status: "contacted" }
Then 狀態更新為 contacted + 委託人收到通知

Given 需求單為 submitted
When Admin 嘗試更新為 completed（跳過 contacted/arranged）
Then 回傳 400 INVALID_STATE_TRANSITION

Given Admin 指派 approved provider
When PUT /api/v1/service-requests/:id/assign { provider_id }
Then 指派成功 + 委託人收到通知

Given Mobile 需求清單
When 載入頁面
Then 顯示各狀態需求單（含顏色標示）
```

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| 狀態機轉換驗證複雜 | 用簡單 Map<currentStatus, allowedNextStatuses> |
| 需要 Providers 資料才能指派 | Slice 7 先不做指派功能，Slice 8 Providers 完成後補上 |

---

### Slice 8：Providers + Admin Dashboard + 檔案上傳

**目標**：服務人員管理 + 文件上傳 + Admin Dashboard 數據總覽 + Demo 劇本全流程。

#### 最小交付物

| 層 | 交付 |
|----|------|
| DB | providers + provider_documents 表 migration |
| Shared | provider.ts Zod schema |
| API | POST/GET/PUT /providers + PUT /:id/review + document presign/confirm/list/download + GET /admin/dashboard |
| Web | /admin/providers 列表 + 新增/編輯 + 審核 + 文件上傳 UI + /admin/dashboard 數據卡片 + /admin/services 類別管理 |
| Tests | Provider API tests + dashboard API tests + file upload tests (mock S3) |
| Seed | 2 位服務人員 + 完整 seed data |

#### 驗收劇本

```gherkin
Given Admin 登入
When POST /api/v1/providers 帶有效資料
Then 回傳 201 + review_status=pending

Given Provider 為 pending
When Admin PUT /api/v1/providers/:id/review { review_status: "approved" }
Then 狀態更新為 approved

Given 需要上傳文件
When POST /api/v1/providers/:id/documents/presign { file_name, mime_type, file_size }
Then 回傳 pre-signed PUT URL + file_key

Given Admin Dashboard
When 載入頁面
Then 顯示正確統計數字（委託人數、被照護者數、今日量測數、待處理需求數等）

Given Demo 劇本 8 步驟
When 依序執行
Then 全部通過（端到端閉環）
```

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| Cloudflare R2 設定複雜 | MVP 先用本地檔案儲存（開發環境），部署時切換 R2 |
| Pre-signed URL 邏輯 | 使用 @aws-sdk/client-s3，R2 相容 S3 API |
| Dashboard 即時數據 | MVP 用直接 Prisma count query，不做快取 |

---

### Slice TBD：Patient-Lite 被照護者介面

> **狀態**：已確認方向，尚未排入固定編號。建議位置為 Slice 6（Appointments）之後。

**目標**：被照護者本人可用簡化的行動端介面查看自身相關資料，資訊範圍與可用操作小於委託人介面。

#### 預期交付物（草案，實作前須確認）

| 層 | 交付 |
|----|------|
| DB | recipients 表可能新增 patient user 關聯欄位 |
| Shared | 身份模型擴展（可能新增 patient role 或等效方案） |
| API | 現有 GET endpoints 擴展 patient 存取權限 + mutation endpoints 限制 patient 唯讀 |
| Mobile | Patient 專屬 tab layout + 首頁 + 重用現有畫面（唯讀模式） |
| Auth | Patient 登入流程 + 帳號建立機制（邀請或其他） |
| Tests | Patient ownership 測試 + 唯讀限制測試 |

#### 前置依賴

- Slice 1（Auth）：JWT + role 機制
- Slice 3（Measurements）：量測資料 + 趨勢 API
- Slice 4–6 的完成程度決定 Patient-Lite 能重用多少功能（AI 報告、通知、行程等）

#### 待決事項

見 implementation-spec.md Q 節 Patient-Lite 待決事項表。所有技術設計（schema、角色、連結方式、invite flow）須於本 Slice 正式啟動時確認，不提前實作。

#### 風險點與降級方案

| 風險 | 降級 |
|------|------|
| 帳號建立/邀請流程複雜度高 | 最小版本：Admin 手動建立 patient 帳號，不做邀請流程 |
| Patient 可見範圍定義不明 | 先以最小唯讀子集上線，其他功能逐步開放 |
| Recipient/User 概念混淆 | 嚴格區分 Recipient（資料記錄）與 Patient User（帳號），不合併 |

---

## 5. 風險總覽與降級策略

### 全域風險

| 風險 | 影響 | 降級方案 |
|------|------|---------|
| 兩人做不完 | 延期 | 砍 Slice 8 部分功能（文件上傳 → Phase 2），Dashboard 用簡化版 |
| OpenAI API 不穩定 | AI 功能不可用 | Fallback 文字 + 預生成的 seed 報告 |
| Supabase 免費額度不足 | DB 連線數超限 | 使用 connection pooling (pgbouncer)，已在 spec 中定案 |
| Expo + Monorepo 衝突 | Mobile 無法啟動 | 獨立 metro.config.js + 指定 node_modules 路徑 |
| Vercel Hobby Plan 限制 | 部署受限 | MVP 先以 localhost demo；需要時升 Pro ($20/mo) |

### MVP 骨架版（最小可 Demo 範圍）

若時間不足，以下為最小可交付範圍（必須完成的 Slice）：

| 優先級 | Slice | 必要性 |
|--------|-------|--------|
| P0 | Slice 0-3 | 核心數據閉環（登入 → 管理被照護者 → 記錄健康數據 → 看趨勢） |
| P1 | Slice 4 | AI 差異化功能（放心報） |
| P1 | Slice 7 | 服務需求閉環（送出 → Admin 處理） |
| P2 | Slice 5, 6 | 通知 + 行程（可以有但非核心 demo） |
| P2 | Slice 8 | Providers + Dashboard（Admin 管理完善） |
| P2+ | Patient-Lite | 已確認方向，排序待定（被照護者可查看自身資料） |

---

> **文件結束**。本計畫與 implementation-spec.md + engineering-standards.md 共同構成實作依據。
