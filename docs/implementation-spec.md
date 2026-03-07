# 遠端照護平台 — 生產級實作規格書

> **文件版本**：1.1.0
> **最後更新**：2026-03-07
> **狀態**：定案（Approved）
> **維護者**：工程團隊
>
> **v1.1.0 變更摘要**：修正 Rate Limit 策略（改用 Upstash Redis）、修正檔案上傳流程（改用 pre-signed URL）、新增 Prisma 連線池規範、統一 Auth 雙策略（Bearer + Cookie）、新增 AI 除錯日誌控制、統一刪除策略、新增血糖單位兼容策略、新增一鍵 Demo 指令。

---

## 目錄

- [A. 文件總覽](#a-文件總覽)
- [B. 系統架構](#b-系統架構)
- [C. 權限與角色](#c-權限與角色)
- [D. 資料模型與 DB Schema](#d-資料模型與-db-schema)
- [E. 標準化 Measurement Schema 與 Device Ingestion](#e-標準化-measurement-schema-與-device-ingestion)
- [F. API 合約](#f-api-合約)
- [G. Mobile App 頁面規格](#g-mobile-app-頁面規格)
- [H. Web Admin 頁面規格](#h-web-admin-頁面規格)
- [I. AI 設計](#i-ai-設計)
- [J. 通知與排程設計](#j-通知與排程設計)
- [K. 檔案上傳](#k-檔案上傳)
- [L. 安全、隱私、合規](#l-安全隱私合規)
- [M. 可觀測性](#m-可觀測性)
- [N. 部署與環境](#n-部署與環境)
- [O. Demo 劇本](#o-demo-劇本)
- [P. 驗收標準與 Definition of Done](#p-驗收標準與-definition-of-done)
- [Q. Phase 2/3 方向](#q-phase-23-方向)

---

## A. 文件總覽

### A.1 文件目的

本文件為「遠端照護平台 MVP」的唯一實作規格（Single Source of Truth）。所有功能開發、API 設計、資料庫結構、頁面規格、AI 行為、部署流程皆以本文件為準。任何需求變更必須經過正式 Change Request 流程（見 `engineering-standards.md`）。

### A.2 讀者

| 角色 | 用途 |
|------|------|
| 工程師（前端/後端/全端） | 依照本規格直接開發，不得自行假設未定義行為 |
| 產品負責人 | 驗收功能是否符合規格 |
| 外部合作者/投資人 | 理解系統能力範圍 |

### A.3 術語表

| 術語 | 英文 | 定義 |
|------|------|------|
| 委託人 | Caregiver | 使用 Mobile App 的家屬，負責管理被照護者的健康資料與服務需求 |
| 被照護者 | Recipient / Care Recipient | 接受照護的長輩，其資料由委託人維護 |
| 服務人員 | Provider | 由平台管理的照護服務提供者（陪診員、生活輔助員等） |
| 營運方 | Admin / Operator | 平台管理員，透過 Web Admin 後台操作 |
| 照護圈 | Care Circle | 一位委託人下所有被照護者的集合 |
| 放心報 | AI Health Report | AI 生成的健康摘要，包含結論、原因、建議行動 |
| 需求單 | Service Request | 委託人提交的服務需求（陪診/生活輔助等），由營運方人工媒合 |

### A.4 MVP 定義

**核心閉環**：委託人登入 → 管理被照護者 → 紀錄健康數據 → 查看趨勢 → 生成 AI 放心報 → 分享 → 送出服務需求 → 營運方處理需求 → 委託人追蹤狀態。

**成功指標**（可量測）：

| 指標 | 目標值 |
|------|--------|
| 核心閉環端到端可跑通 | 100%（Demo 劇本 8 步驟全部通過） |
| API 回應時間（P95） | < 500ms（排除 AI 呼叫） |
| AI 放心報生成時間 | < 10 秒 |
| App 冷啟動到首頁 | < 3 秒 |
| 系統可用性（Staging 環境） | > 99%（以 Vercel 保證為準） |

### A.5 範圍界線

#### MVP 必做（10 模組）

1. 帳號系統 + 角色權限
2. 健康數據紀錄（血壓/血糖）
3. 趨勢圖表 + 數據分析呈現
4. AI 放心報（健康摘要）
5. 提醒與通知
6. 行程/就醫預約管理
7. 服務需求送出
8. 管理後台
9. 服務人員管理系統
10. 智能推薦與任務型對話

#### MVP 嚴格排除（Out-of-scope）

以下項目**嚴禁**在 MVP 階段開發，任何涉及這些範圍的 PR 必須被拒絕：

- **金流**：收款/分潤/退款/對帳/發票
- **接案平台**：服務人員端 App、搶單/競標、即時地圖、即時定位
- **真硬體串接**：藍牙、廠商 SDK、廠商雲端整合（僅預留接口）
- **評價/申訴/爭議處理/保險理賠**
- **高度個人化 AI**：長期記憶、RAG 知識庫、微調模型（MVP 僅用固定 prompt 模板）
- **醫療診斷/處方建議**：任何暗示診斷或處方的功能皆禁止
- **多語系**：MVP 僅支援繁體中文
- **社群/聊天功能**：家屬間即時通訊
- **SMS / Push Notification**：MVP 僅做 in-app 通知

> **Scope Creep 防火牆**：每次 Sprint Planning 必須對照此清單。若有人提議新增功能，必須走 Change Request 流程並更新本文件。

---

## B. 系統架構

### B.1 高階架構圖

```
┌─────────────────────────────────────────────────────┐
│                    使用者層                           │
│  ┌──────────────┐          ┌──────────────────────┐  │
│  │  Mobile App  │          │   Web Admin (Next.js) │  │
│  │  (Expo RN)   │          │   /admin/*            │  │
│  │  委託人端     │          │   營運方端             │  │
│  └──────┬───────┘          └──────────┬───────────┘  │
│         │ HTTPS                       │ HTTPS        │
└─────────┼─────────────────────────────┼──────────────┘
          │                             │
┌─────────▼─────────────────────────────▼──────────────┐
│              Next.js API Layer (Vercel)               │
│  /api/v1/*                                           │
│  ┌────────────┐ ┌──────────┐ ┌─────────────────────┐ │
│  │ Auth       │ │ CRUD     │ │ AI Service          │ │
│  │ Middleware  │ │ Handlers │ │ (OpenAI API call)   │ │
│  └────────────┘ └──────────┘ └─────────────────────┘ │
│  ┌────────────┐ ┌──────────┐ ┌─────────────────────┐ │
│  │ Zod        │ │ Prisma   │ │ File Upload         │ │
│  │ Validation │ │ Client   │ │ (S3/R2)             │ │
│  └────────────┘ └──────────┘ └─────────────────────┘ │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│                   資料層                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ PostgreSQL   │  │ S3/R2        │  │ OpenAI API │  │
│  │ (Supabase)   │  │ (檔案儲存)   │  │ (LLM)      │  │
│  └──────────────┘  └──────────────┘  └────────────┘  │
└──────────────────────────────────────────────────────┘
```

### B.2 Monorepo 結構（強制）

```
remote-care/
├── apps/
│   ├── mobile/                  # Expo React Native (TypeScript)
│   │   ├── app/                 # expo-router 頁面
│   │   │   ├── (auth)/          # 登入/註冊
│   │   │   ├── (tabs)/          # 主要分頁
│   │   │   │   ├── home/        # 首頁（被照護者清單 + 摘要）
│   │   │   │   ├── health/      # 健康數據 + 趨勢
│   │   │   │   ├── services/    # 服務需求
│   │   │   │   └── profile/     # 個人設定
│   │   │   └── _layout.tsx
│   │   ├── components/          # 共用元件
│   │   ├── hooks/               # 自訂 hooks
│   │   ├── lib/                 # API client, utils
│   │   ├── constants/           # 靜態設定
│   │   ├── app.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                     # Next.js (TypeScript)
│       ├── app/
│       │   ├── api/v1/          # API Route Handlers
│       │   │   ├── auth/
│       │   │   ├── recipients/
│       │   │   ├── measurements/
│       │   │   ├── ai/
│       │   │   ├── appointments/
│       │   │   ├── service-requests/
│       │   │   ├── notifications/
│       │   │   ├── providers/
│       │   │   ├── admin/
│       │   │   └── device/
│       │   ├── admin/           # Admin 後台頁面
│       │   │   ├── dashboard/
│       │   │   ├── service-requests/
│       │   │   ├── providers/
│       │   │   ├── recipients/
│       │   │   └── services/
│       │   ├── layout.tsx
│       │   └── page.tsx         # 首頁（重導到 /admin）
│       ├── components/          # Admin UI 元件
│       ├── lib/                 # 伺服器端工具
│       │   ├── prisma.ts        # Prisma client singleton
│       │   ├── auth.ts          # JWT 驗證
│       │   ├── ai.ts            # OpenAI 呼叫封裝
│       │   └── storage.ts       # S3/R2 封裝
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                  # 共享型別 + Zod Schemas
│       ├── src/
│       │   ├── schemas/         # Zod schemas（API 契約單一來源）
│       │   │   ├── auth.ts
│       │   │   ├── recipient.ts
│       │   │   ├── measurement.ts
│       │   │   ├── appointment.ts
│       │   │   ├── service-request.ts
│       │   │   ├── notification.ts
│       │   │   ├── provider.ts
│       │   │   ├── ai.ts
│       │   │   └── device.ts
│       │   ├── constants/       # 共用常數
│       │   │   ├── error-codes.ts
│       │   │   ├── enums.ts
│       │   │   └── thresholds.ts
│       │   ├── types/           # 從 Zod infer 出的型別
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docs/
│   ├── implementation-spec.md   # 本文件
│   └── engineering-standards.md
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── package.json
```

### B.3 資料流

```
委託人手動輸入健康數據
        │
        ▼
  POST /api/v1/measurements
        │
        ▼
  Zod 驗證 → Prisma 寫入 PostgreSQL
        │
        ▼
  異常判斷引擎（簡單規則）──超標──▶ 建立 in-app 通知
        │
        ▼
  前端拉取歷史 → 聚合 7/30 天統計
        │
        ▼
  使用者按「生成放心報」
        │
        ▼
  後端組裝 prompt（聚合資料 + 近 N 筆）→ 呼叫 OpenAI API
        │
        ▼
  JSON schema 驗證回應 → 儲存 → 回傳前端渲染
        │
        ▼
  使用者一鍵分享（複製文字摘要）
        │
        ▼
  使用者送出服務需求單
        │
        ▼
  POST /api/v1/service-requests → 狀態 = submitted
        │
        ▼
  Admin 後台查看需求單清單
        │
        ▼
  Admin 更新狀態（contacted → arranged）+ 指派 Provider
        │
        ▼
  Mobile 端查看狀態更新（polling / pull-to-refresh）
```

### B.4 重要設計決策

| 決策 | 理由 |
|------|------|
| Next.js 全端（API + Admin） | 兩人團隊減少一個獨立後端服務的部署與維護負擔 |
| 共享 Zod Schema（`packages/shared`） | 前後端契約單一來源，避免型別不一致導致 runtime 錯誤 |
| Expo + expo-router | 可用 Expo Go 掃 QR 快速 demo，無需原生 build |
| Supabase PostgreSQL | 免費額度足夠 MVP，內建連線池與備份 |
| OpenAI GPT-4o-mini | 成本低、速度快、JSON mode 支援佳，適合 MVP |
| In-app 通知優先 | 不需 FCM/APNs 設定，MVP 最小可行 |
| Cloudflare R2 儲存 | S3 相容、免出口流量費、適合小型檔案上傳 |

---

## C. 權限與角色

### C.1 角色定義

MVP 嚴格只有兩種角色：

| 角色 | 英文 | 說明 |
|------|------|------|
| 委託人 | `caregiver` | Mobile App 使用者，管理自己的被照護者 |
| 管理員 | `admin` | Web Admin 使用者，管理全平台資源 |

> **嚴禁**在 MVP 階段新增其他角色（如 `provider`、`super_admin`、`viewer`）。

### C.2 權限矩陣

| 資源 | 動作 | `caregiver` | `admin` |
|------|------|:-----------:|:-------:|
| 自己的帳號 | 讀取/更新 | ✅ | ✅ |
| 被照護者（Recipients） | 建立 | ✅（自己的） | ✅ |
| 被照護者 | 讀取 | ✅（自己的） | ✅（全部） |
| 被照護者 | 更新 | ✅（自己的） | ✅（全部） |
| 被照護者 | 刪除 | ❌（軟刪除需 admin） | ✅ |
| 健康數據（Measurements） | 建立/讀取 | ✅（自己被照護者的） | ✅（全部） |
| 健康數據 | 刪除 | ❌ | ✅ |
| AI 放心報 | 生成/讀取 | ✅（自己被照護者的） | ✅（全部） |
| 行程（Appointments） | CRUD | ✅（自己被照護者的） | ✅（全部） |
| 服務需求單 | 建立/讀取 | ✅（自己的） | ✅（全部） |
| 服務需求單 | 更新狀態 | ❌ | ✅ |
| 服務需求單 | 指派服務人員 | ❌ | ✅ |
| 通知 | 讀取/標已讀 | ✅（自己的） | ✅ |
| 服務人員（Providers） | CRUD | ❌ | ✅ |
| 服務項目 | 管理 | ❌ | ✅ |

### C.3 Ownership 檢查規則

所有 API endpoint 必須實作 ownership 檢查，規則如下：

```typescript
// 虛擬碼：每個涉及 recipient 的請求都必須驗證
async function checkOwnership(userId: string, recipientId: string): Promise<boolean> {
  const recipient = await prisma.recipient.findFirst({
    where: { id: recipientId, caregiver_id: userId, deleted_at: null }
  });
  return recipient !== null;
}
```

- **Measurements**：必須先驗證該 `recipient_id` 屬於當前 `caregiver`
- **Appointments**：必須先驗證該 `recipient_id` 屬於當前 `caregiver`
- **Service Requests**：必須驗證 `caregiver_id` 為當前使用者
- **Notifications**：必須驗證 `user_id` 為當前使用者
- **Admin 角色**：跳過 ownership 檢查，但必須驗證 `role === 'admin'`

> **嚴禁**在任何 API 中僅依賴前端傳入的 ID 而不做後端 ownership 驗證。

---

## D. 資料模型與 DB Schema

### D.1 時區策略

- 資料庫一律儲存 **UTC** 時間戳（`timestamptz`）
- 前端顯示時根據使用者裝置時區轉換
- API 接受 ISO 8601 格式（例：`2026-03-07T08:00:00Z`）
- `measured_at` 欄位由前端傳入（使用者實際量測時間，轉為 UTC）

### D.2 刪除策略

- **軟刪除**：`recipients`、`providers` 使用 `deleted_at` 欄位
- **硬刪除**：僅限 `appointments`（使用者自行管理的行程，無審計需求，允許硬刪除）
- **其餘資源一律不做硬刪除**
- **級聯**：被照護者軟刪除後，其相關 measurements、appointments 保留但 API 查詢時過濾

### D.3 完整 Schema 定義

#### 表：`users`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | 主鍵 |
| `email` | `varchar(255)` | UNIQUE, NOT NULL | 登入信箱 |
| `password_hash` | `varchar(255)` | NOT NULL | bcrypt hash |
| `name` | `varchar(100)` | NOT NULL | 顯示名稱 |
| `phone` | `varchar(20)` | NULL | 聯絡電話 |
| `role` | `varchar(20)` | NOT NULL, default `'caregiver'` | `caregiver` 或 `admin` |
| `timezone` | `varchar(50)` | NOT NULL, default `'Asia/Taipei'` | 使用者時區 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | 建立時間 |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | 更新時間 |

索引：`UNIQUE(email)`

#### 表：`recipients`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `caregiver_id` | `uuid` | FK → users.id, NOT NULL | 所屬委託人 |
| `name` | `varchar(100)` | NOT NULL | 被照護者姓名 |
| `date_of_birth` | `date` | NULL | 生日（可選） |
| `gender` | `varchar(10)` | NULL | `male` / `female` / `other` |
| `medical_tags` | `jsonb` | NOT NULL, default `'[]'` | 疾病標籤陣列，如 `["高血壓","糖尿病"]` |
| `emergency_contact_name` | `varchar(100)` | NULL | 緊急聯絡人姓名 |
| `emergency_contact_phone` | `varchar(20)` | NULL | 緊急聯絡人電話 |
| `notes` | `text` | NULL | 備註 |
| `deleted_at` | `timestamptz` | NULL | 軟刪除 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

索引：`INDEX(caregiver_id)` , `INDEX(caregiver_id, deleted_at)`

#### 表：`measurements`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `recipient_id` | `uuid` | FK → recipients.id, NOT NULL | 所屬被照護者 |
| `type` | `varchar(20)` | NOT NULL | `blood_pressure` 或 `blood_glucose` |
| `systolic` | `int` | NULL | 收縮壓（僅 BP） |
| `diastolic` | `int` | NULL | 舒張壓（僅 BP） |
| `heart_rate` | `int` | NULL | 心率（僅 BP，可選） |
| `glucose_value` | `decimal(5,1)` | NULL | 血糖值（僅 BG） |
| `glucose_timing` | `varchar(20)` | NULL | `before_meal` / `after_meal` / `fasting` / `random`（僅 BG） |
| `unit` | `varchar(10)` | NOT NULL | `mmHg`（BP）或 `mg/dL`（BG） |
| `source` | `varchar(20)` | NOT NULL, default `'manual'` | `manual` 或 `device` |
| `device_id` | `varchar(100)` | NULL | 裝置識別碼（Phase 2） |
| `is_abnormal` | `boolean` | NOT NULL, default `false` | 系統判定是否異常 |
| `note` | `text` | NULL | 使用者備註 |
| `measured_at` | `timestamptz` | NOT NULL | 實際量測時間 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

索引：`INDEX(recipient_id, type, measured_at DESC)` , `INDEX(recipient_id, measured_at DESC)`

#### 表：`ai_reports`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `recipient_id` | `uuid` | FK → recipients.id, NOT NULL | |
| `report_type` | `varchar(30)` | NOT NULL | `health_summary` / `trend_analysis` / `visit_prep` / `family_update` |
| `status_label` | `varchar(20)` | NOT NULL | `stable` / `attention` / `consult_doctor` |
| `summary` | `text` | NOT NULL | 一句話結論 |
| `reasons` | `jsonb` | NOT NULL | 原因列表 `["原因1","原因2"]` |
| `suggestions` | `jsonb` | NOT NULL | 建議行動列表 |
| `raw_prompt` | `text` | NULL | 送出的 prompt（除錯用） |
| `raw_response` | `text` | NULL | LLM 原始回應（除錯用） |
| `model` | `varchar(50)` | NOT NULL | 使用的模型名稱 |
| `input_tokens` | `int` | NULL | 輸入 token 數 |
| `output_tokens` | `int` | NULL | 輸出 token 數 |
| `generated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

索引：`INDEX(recipient_id, generated_at DESC)`

#### 表：`appointments`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `recipient_id` | `uuid` | FK → recipients.id, NOT NULL | |
| `title` | `varchar(200)` | NOT NULL | 行程標題 |
| `hospital_name` | `varchar(200)` | NULL | 醫院名稱 |
| `department` | `varchar(100)` | NULL | 科別 |
| `doctor_name` | `varchar(100)` | NULL | 醫師姓名（可選） |
| `appointment_date` | `timestamptz` | NOT NULL | 就醫日期時間 |
| `note` | `text` | NULL | 備註 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

索引：`INDEX(recipient_id, appointment_date)`

#### 表：`service_categories`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `name` | `varchar(100)` | NOT NULL, UNIQUE | 服務類別名稱（如「陪診」「生活輔助」） |
| `description` | `text` | NULL | 類別說明 |
| `is_active` | `boolean` | NOT NULL, default `true` | 是否啟用 |
| `sort_order` | `int` | NOT NULL, default `0` | 排序 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 表：`service_requests`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `caregiver_id` | `uuid` | FK → users.id, NOT NULL | 送出者 |
| `recipient_id` | `uuid` | FK → recipients.id, NOT NULL | 服務對象 |
| `category_id` | `uuid` | FK → service_categories.id, NOT NULL | 服務類別 |
| `status` | `varchar(20)` | NOT NULL, default `'submitted'` | 見狀態機 |
| `preferred_date` | `timestamptz` | NOT NULL | 期望服務日期 |
| `preferred_time_slot` | `varchar(20)` | NULL | `morning` / `afternoon` / `evening` |
| `location` | `varchar(500)` | NOT NULL | 服務地點 |
| `description` | `text` | NOT NULL | 需求描述 |
| `assigned_provider_id` | `uuid` | FK → providers.id, NULL | 指派的服務人員 |
| `admin_note` | `text` | NULL | 營運方備註 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

狀態機：`submitted` → `contacted` → `arranged` → `completed`；任何階段皆可 → `cancelled`

索引：`INDEX(caregiver_id, status)` , `INDEX(status, created_at DESC)`

#### 表：`providers`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `name` | `varchar(100)` | NOT NULL | 姓名 |
| `phone` | `varchar(20)` | NULL | 電話 |
| `email` | `varchar(255)` | NULL | 信箱 |
| `specialties` | `jsonb` | NOT NULL, default `'[]'` | 專業項目 |
| `certifications` | `jsonb` | NOT NULL, default `'[]'` | 證照列表 |
| `experience_years` | `int` | NULL | 年資 |
| `service_areas` | `jsonb` | NOT NULL, default `'[]'` | 服務區域 |
| `review_status` | `varchar(20)` | NOT NULL, default `'pending'` | `pending` / `approved` / `suspended` |
| `admin_note` | `text` | NULL | 審核備註 |
| `deleted_at` | `timestamptz` | NULL | 軟刪除 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

索引：`INDEX(review_status)`

#### 表：`provider_documents`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `provider_id` | `uuid` | FK → providers.id, NOT NULL | 所屬服務人員 |
| `file_name` | `varchar(255)` | NOT NULL | 原始檔名 |
| `file_key` | `varchar(500)` | NOT NULL | S3/R2 物件 key |
| `file_size` | `int` | NOT NULL | 檔案大小（bytes） |
| `mime_type` | `varchar(100)` | NOT NULL | MIME 類型 |
| `document_type` | `varchar(50)` | NOT NULL | `certification` / `id_card` / `other` |
| `uploaded_at` | `timestamptz` | NOT NULL, default `now()` | |

索引：`INDEX(provider_id)`

#### 表：`notifications`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `user_id` | `uuid` | FK → users.id, NOT NULL | 接收者 |
| `type` | `varchar(30)` | NOT NULL | 見通知類型 enum |
| `title` | `varchar(200)` | NOT NULL | 通知標題 |
| `body` | `text` | NOT NULL | 通知內容 |
| `data` | `jsonb` | NULL | 額外資料（如 `{ recipientId, measurementId }` 用於跳轉） |
| `is_read` | `boolean` | NOT NULL, default `false` | 是否已讀 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

索引：`INDEX(user_id, is_read, created_at DESC)`

通知類型 enum：`measurement_reminder` / `abnormal_alert` / `appointment_reminder` / `service_request_update` / `ai_report_ready`

#### 表：`measurement_reminders`

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | `uuid` | PK | 主鍵 |
| `recipient_id` | `uuid` | FK → recipients.id, NOT NULL | |
| `reminder_type` | `varchar(20)` | NOT NULL | `morning` / `evening` |
| `reminder_time` | `time` | NOT NULL | 提醒時間（使用者本地時間） |
| `is_enabled` | `boolean` | NOT NULL, default `true` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

索引：`UNIQUE(recipient_id, reminder_type)`

### D.4 異常判斷規則（MVP）

MVP 採用**簡單規則引擎**，不做醫療診斷，僅用於 UI 紅點標示與異常通知。

#### 血壓（Blood Pressure）閾值

| 狀態 | 收縮壓（mmHg） | 舒張壓（mmHg） |
|------|:--------------:|:--------------:|
| 正常 | < 130 | < 85 |
| 偏高（標記黃色） | 130–139 | 85–89 |
| 異常（標記紅色） | ≥ 140 | ≥ 90 |
| 異常偏低（標記紅色） | < 90 | < 60 |

判斷邏輯：收縮壓**或**舒張壓任一超標即標記異常。

#### 血糖（Blood Glucose）閾值

| 狀態 | 空腹/餐前（mg/dL） | 餐後（mg/dL） | 隨機（mg/dL） |
|------|:------------------:|:-------------:|:-------------:|
| 正常 | 70–99 | 70–139 | 70–139 |
| 偏高（黃色） | 100–125 | 140–179 | 140–179 |
| 異常（紅色） | ≥ 126 | ≥ 180 | ≥ 180 |
| 異常偏低（紅色） | < 70 | < 70 | < 70 |

> **預設假設**：以上閾值基於一般成人健康參考值，非個人化醫療標準。MVP 不支援個人化閾值設定（Phase 2）。UI 必須標示「此為參考值，非醫療診斷」。

#### 連續異常觸發通知

- **規則**：最近 **3** 筆同類型量測中有 **2** 筆以上標記為異常（`is_abnormal = true`）時，系統產生一則 `abnormal_alert` 通知。
- 通知內容範本：「[被照護者姓名] 近期血壓/血糖有多次異常紀錄，建議關注或安排就醫。」
- 同一個異常觸發事件 **24 小時內不重複發送**。

### D.5 Seed Data

開發環境必須提供以下 seed 資料：

```typescript
// prisma/seed.ts 必須建立：
// 1. Admin 帳號：admin@remotecare.dev / Admin1234!
// 2. 委託人帳號：demo@remotecare.dev / Demo1234!
// 3. 兩位被照護者：「王奶奶」（有高血壓標籤）、「李爺爺」（有糖尿病標籤）
// 4. 各 30 筆血壓/血糖歷史資料（過去 30 天，含 3 筆異常）
// 5. 兩筆就醫行程（未來 7 天、14 天各一筆）
// 6. 三個服務類別：陪診、生活輔助、居家照護
// 7. 兩筆服務需求單（一筆 submitted、一筆 arranged）
// 8. 兩位服務人員（一位 approved、一位 pending）
// 9. 五筆通知（含已讀/未讀）
// 10. 一筆 AI 放心報
```

---

## E. 標準化 Measurement Schema 與 Device Ingestion

### E.1 標準 Payload 定義

#### 血壓（Blood Pressure）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["recipient_id", "type", "systolic", "diastolic", "unit", "measured_at"],
  "properties": {
    "recipient_id": { "type": "string", "format": "uuid" },
    "type": { "const": "blood_pressure" },
    "systolic": { "type": "integer", "minimum": 40, "maximum": 300 },
    "diastolic": { "type": "integer", "minimum": 20, "maximum": 200 },
    "heart_rate": { "type": "integer", "minimum": 30, "maximum": 250 },
    "unit": { "const": "mmHg" },
    "source": { "enum": ["manual", "device"], "default": "manual" },
    "device_id": { "type": "string", "maxLength": 100 },
    "note": { "type": "string", "maxLength": 500 },
    "measured_at": { "type": "string", "format": "date-time" }
  }
}
```

#### 血糖（Blood Glucose）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["recipient_id", "type", "glucose_value", "glucose_timing", "unit", "measured_at"],
  "properties": {
    "recipient_id": { "type": "string", "format": "uuid" },
    "type": { "const": "blood_glucose" },
    "glucose_value": { "type": "number", "minimum": 10, "maximum": 800 },
    "glucose_timing": { "enum": ["before_meal", "after_meal", "fasting", "random"] },
    "unit": { "const": "mg/dL" },
    "source": { "enum": ["manual", "device"], "default": "manual" },
    "device_id": { "type": "string", "maxLength": 100 },
    "note": { "type": "string", "maxLength": 500 },
    "measured_at": { "type": "string", "format": "date-time" }
  }
}
```

### E.2 Device Ingestion API（MVP 預留接口）

MVP **不做**真實硬體串接，但必須提供標準化 ingestion endpoint 供 Phase 2 使用。

#### `POST /api/v1/device/ingest`

- **認證**：MVP 使用固定 API token（`X-Device-Token` header）
- **Phase 2 升級方案**：改為 OAuth2 client credentials + 裝置憑證
- **Recipient Mapping**：MVP 採用 `recipient_id` 直接傳入（由設定裝置時綁定）
  - Phase 2 可改為 pairing code 機制

```
POST /api/v1/device/ingest
Headers:
  Content-Type: application/json
  X-Device-Token: {DEVICE_API_TOKEN}

Body: （同上述 Blood Pressure 或 Blood Glucose payload，source 必須為 "device"）
```

**成功回應**：
```json
{
  "success": true,
  "data": {
    "measurement_id": "uuid-here",
    "is_abnormal": false
  }
}
```

**錯誤回應**：
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "systolic must be between 40 and 300",
    "details": [...]
  }
}
```

### E.3 血糖單位兼容策略

- **MVP**：API 僅接受 `mg/dL`，DB 統一以 `mg/dL` 儲存
- **Phase 2**：API 擴充接受 `unit` 為 `mg/dL` 或 `mmol/L`；後端收到 `mmol/L` 時自動轉換為 `mg/dL` 儲存
  - 轉換公式：`mg/dL = mmol/L × 18.0182`
  - 前端顯示時依使用者偏好轉換回 `mmol/L`（Phase 2）
- **DB 欄位**：`unit` 為 `varchar(10)`，MVP 固定為 `mg/dL`；Phase 2 無需 migration，僅需擴充 Zod enum 與新增轉換邏輯
- **Device Ingestion**：Phase 2 硬體可能回傳 `mmol/L`，屆時在 ingest handler 統一轉換後儲存

### E.4 Mock 測試流程

開發階段可用 curl 測試：

```bash
curl -X POST https://your-domain/api/v1/device/ingest \
  -H "Content-Type: application/json" \
  -H "X-Device-Token: dev-device-token-12345" \
  -d '{
    "recipient_id": "recipient-uuid",
    "type": "blood_pressure",
    "systolic": 145,
    "diastolic": 92,
    "heart_rate": 78,
    "unit": "mmHg",
    "source": "device",
    "device_id": "OMRON-HEM-7156",
    "measured_at": "2026-03-07T08:00:00Z"
  }'
```

---

## F. API 合約

### F.1 統一規則

| 項目 | 規則 |
|------|------|
| Base Path | `/api/v1` |
| 版本策略 | URL 路徑版本（`/v1`）；MVP 只有 v1 |
| 內容類型 | `application/json`（檔案上傳使用 pre-signed URL 直傳 R2/S3，不經後端） |
| 認證 | `Authorization: Bearer {jwt_token}` 或 `Cookie: auth_token={jwt_token}`（見 L.1 雙策略）；Device API 用 `X-Device-Token` |
| 時區 | 所有時間欄位為 ISO 8601 UTC |
| ID 格式 | UUID v4 |

#### 成功回應 Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

單一物件時省略 `meta`。列表回應時 `data` 為陣列。

#### 錯誤回應 Envelope

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "人類可讀的錯誤訊息",
    "details": []
  }
}
```

**嚴禁**回傳 stack trace 或內部錯誤細節至客戶端。

#### 分頁與篩選規範

- 分頁參數：`?page=1&limit=20`（預設 `page=1, limit=20`，最大 `limit=100`）
- 排序參數：`?sort=created_at&order=desc`
- 篩選參數：依各 endpoint 定義

### F.2 錯誤碼字典

| 錯誤碼 | HTTP Status | 說明 |
|--------|:-----------:|------|
| `AUTH_REQUIRED` | 401 | 未提供有效認證 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 帳號或密碼錯誤 |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT 已過期 |
| `AUTH_FORBIDDEN` | 403 | 無權限存取此資源 |
| `RESOURCE_NOT_FOUND` | 404 | 資源不存在 |
| `RESOURCE_OWNERSHIP_DENIED` | 403 | 此資源不屬於當前使用者 |
| `VALIDATION_ERROR` | 400 | 請求資料驗證失敗 |
| `DUPLICATE_ENTRY` | 409 | 重複資料（如 email 已註冊） |
| `INVALID_STATE_TRANSITION` | 400 | 無效的狀態轉換（如需求單） |
| `RATE_LIMIT_EXCEEDED` | 429 | 超過頻率限制 |
| `AI_GENERATION_FAILED` | 502 | AI 服務呼叫失敗 |
| `AI_RATE_LIMITED` | 429 | AI 呼叫頻率超限 |
| `AI_INVALID_RESPONSE` | 502 | AI 回應格式不符預期 |
| `FILE_TOO_LARGE` | 400 | 檔案超過大小限制 |
| `FILE_INVALID_TYPE` | 400 | 檔案格式不允許 |
| `DEVICE_AUTH_FAILED` | 401 | Device API Token 無效 |
| `DEVICE_RECIPIENT_NOT_FOUND` | 404 | Device 對應的被照護者不存在 |
| `SERVER_ERROR` | 500 | 內部伺服器錯誤 |
| `SERVICE_UNAVAILABLE` | 503 | 服務暫時不可用 |
| `RECIPIENT_LIMIT_EXCEEDED` | 400 | 被照護者數量超過限制（MVP 上限 10 位） |

### F.3 完整 Endpoint 清單

---

#### F.3.1 認證（Auth）

**`POST /api/v1/auth/register`** — 委託人註冊

- 角色：公開
- Request：
```json
{
  "email": "user@example.com",
  "password": "MyP@ssw0rd",
  "name": "王小明",
  "phone": "0912345678",
  "timezone": "Asia/Taipei"
}
```
- 驗證規則：email 格式、password 至少 8 字元含大小寫與數字、name 1-100 字元
- 成功回應（201）：
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "name": "...", "role": "caregiver" },
    "token": "jwt-token-here"
  }
}
```
- 錯誤：`VALIDATION_ERROR`、`DUPLICATE_ENTRY`

**`POST /api/v1/auth/login`** — 登入

- 角色：公開
- Request：
```json
{
  "email": "user@example.com",
  "password": "MyP@ssw0rd"
}
```
- 成功回應（200）：同 register 回應格式
- 錯誤：`AUTH_INVALID_CREDENTIALS`

**`GET /api/v1/auth/me`** — 取得當前使用者

- 角色：`caregiver`、`admin`
- 成功回應（200）：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "...",
    "name": "...",
    "role": "caregiver",
    "phone": "...",
    "timezone": "Asia/Taipei",
    "created_at": "..."
  }
}
```

**`PUT /api/v1/auth/me`** — 更新個人資料

- 角色：`caregiver`、`admin`
- Request（部分更新）：
```json
{
  "name": "新名稱",
  "phone": "0987654321",
  "timezone": "Asia/Tokyo"
}
```

**`POST /api/v1/auth/logout`** — 登出（清除 cookie）

- 角色：公開（不需認證）
- 用途：清除 Web Admin 端的 httpOnly `auth_token` cookie。Mobile 端由客戶端自行刪除 SecureStore 中的 token。
- 成功回應（200）：
```json
{
  "success": true,
  "data": { "message": "已登出" }
}
```

**`POST /api/v1/auth/admin-login`** — Admin 設定 httpOnly Cookie

- 角色：公開（但需傳入有效且 role=admin 的 JWT token）
- 用途：接收前端登入後取得的 JWT token，驗證為 admin 角色後設定 httpOnly cookie，供後續 Admin UI 路由守衛使用。
- Request：
```json
{
  "token": "jwt-token-here"
}
```
- 成功回應（200）：設定 `auth_token` httpOnly cookie（SameSite=Strict, Secure=true in prod, maxAge=7d）
- 錯誤：`VALIDATION_ERROR`（缺少 token）、`AUTH_FORBIDDEN`（非 admin 角色）、`AUTH_INVALID_CREDENTIALS`（token 無效或過期）

---

#### F.3.2 被照護者（Recipients）

**`POST /api/v1/recipients`** — 新增被照護者

- 角色：`caregiver`
- Request：
```json
{
  "name": "王奶奶",
  "date_of_birth": "1945-03-15",
  "gender": "female",
  "medical_tags": ["高血壓", "糖尿病"],
  "emergency_contact_name": "王小明",
  "emergency_contact_phone": "0912345678",
  "notes": "行動不便，需輪椅"
}
```
- 驗證：name 必填 1-100 字、medical_tags 陣列最多 20 個標籤、每位委託人最多 10 位被照護者
- 成功（201）：回傳完整 recipient 物件
- 自動建立預設量測提醒：早上 08:00、晚上 20:00

**`GET /api/v1/recipients`** — 取得委託人的所有被照護者

- 角色：`caregiver`（只看自己的）、`admin`（全部，支援 `?caregiver_id=` 篩選）
- 成功（200）：
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "王奶奶",
      "date_of_birth": "1945-03-15",
      "gender": "female",
      "medical_tags": ["高血壓", "糖尿病"],
      "emergency_contact_name": "王小明",
      "emergency_contact_phone": "0912345678",
      "notes": "...",
      "latest_bp": { "systolic": 135, "diastolic": 88, "measured_at": "..." },
      "latest_bg": { "glucose_value": 110, "glucose_timing": "fasting", "measured_at": "..." },
      "unread_notifications_count": 2,
      "created_at": "..."
    }
  ]
}
```

**`GET /api/v1/recipients/:id`** — 取得單一被照護者

- 角色：`caregiver`（ownership 檢查）、`admin`

**`PUT /api/v1/recipients/:id`** — 更新被照護者

- 角色：`caregiver`（ownership 檢查）、`admin`
- 部分更新，欄位同新增

---

#### F.3.3 健康數據（Measurements）

**`POST /api/v1/measurements`** — 新增量測資料

- 角色：`caregiver`（ownership 檢查 recipient_id）
- Request：見 E.1 標準 payload
- 後端自動執行異常判斷並設定 `is_abnormal`
- 若觸發連續異常規則（D.4），自動建立通知
- 成功（201）：回傳完整 measurement 物件

**`GET /api/v1/measurements`** — 取得量測列表

- 角色：`caregiver`（ownership）、`admin`
- 必要參數：`recipient_id`
- 可選參數：`type`（`blood_pressure` / `blood_glucose`）、`from`、`to`、`page`、`limit`
- 預設排序：`measured_at DESC`

**`GET /api/v1/measurements/stats`** — 取得統計資料

- 角色：`caregiver`（ownership）、`admin`
- 必要參數：`recipient_id`、`type`、`period`（`7d` / `30d`）
- 成功（200）：
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "type": "blood_pressure",
    "count": 14,
    "systolic": { "min": 118, "max": 152, "avg": 132.5 },
    "diastolic": { "min": 72, "max": 95, "avg": 83.2 },
    "heart_rate": { "min": 65, "max": 88, "avg": 74.1 },
    "abnormal_count": 3,
    "daily_data": [
      {
        "date": "2026-03-01",
        "systolic_avg": 130,
        "diastolic_avg": 82,
        "is_abnormal": false,
        "count": 2
      }
    ]
  }
}
```

**`GET /api/v1/measurements/export`** — 匯出量測資料

- 角色：`caregiver`（ownership）
- 必要參數：`recipient_id`、`type`、`from`、`to`
- 回應：純文字摘要（可複製分享）
- **MVP 定案**：採用**可複製文字摘要**（方案 B），理由：實作最簡、分享管道不受限（LINE/WhatsApp/email 皆可貼）、不需 PDF 套件
- 格式範例：
```
【血壓紀錄摘要】王奶奶
期間：2026-02-28 ~ 2026-03-07
共 14 筆紀錄

平均值：收縮壓 132 / 舒張壓 83 mmHg
最高值：收縮壓 152 / 舒張壓 95 mmHg（2026-03-05 08:12）
最低值：收縮壓 118 / 舒張壓 72 mmHg（2026-03-02 20:30）
異常紀錄：3 筆

--- 由遠端照護平台產生 ---
此為健康數據紀錄，非醫療診斷。
```

---

#### F.3.4 AI 放心報與智能對話

**`POST /api/v1/ai/health-report`** — 生成放心報

- 角色：`caregiver`（ownership）
- Request：
```json
{
  "recipient_id": "uuid",
  "report_type": "health_summary"
}
```
- `report_type` 可選值：`health_summary`（放心報）、`trend_analysis`（趨勢解讀）、`visit_prep`（看診問題清單）、`family_update`（家人近況摘要）
- 頻率限制：每位被照護者每種 report_type **每小時最多 3 次**
- 成功（201）：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "recipient_id": "uuid",
    "report_type": "health_summary",
    "status_label": "attention",
    "summary": "王奶奶近一週血壓偏高，建議密切觀察並考慮回診。",
    "reasons": [
      "過去 7 天有 3 次收縮壓超過 140 mmHg",
      "舒張壓平均值 87 mmHg，接近偏高範圍"
    ],
    "suggestions": [
      "建議每日固定時間量測血壓並記錄",
      "減少鈉鹽攝取，保持適度運動",
      "若持續偏高，建議安排心臟內科回診"
    ],
    "disclaimer": "本報告由 AI 生成，僅供健康參考，不構成醫療診斷或治療建議。如有健康疑慮，請諮詢專業醫療人員。",
    "generated_at": "2026-03-07T10:30:00Z"
  }
}
```

**`GET /api/v1/ai/reports`** — 取得放心報列表

- 角色：`caregiver`（ownership）、`admin`
- 參數：`recipient_id`、`report_type`、`page`、`limit`

**`POST /api/v1/ai/chat`** — 任務型對話

- 角色：`caregiver`（ownership）
- Request：
```json
{
  "recipient_id": "uuid",
  "task": "trend_explanation",
  "context": {}
}
```
- `task` 可選值：`trend_explanation`、`family_update`、`visit_questions`
- 頻率限制：每位使用者**每小時最多 10 次**
- 成功（200）：嚴格 JSON 結構（依 task 不同，見 I 章節）

---

#### F.3.5 通知（Notifications）

**`GET /api/v1/notifications`** — 取得通知列表

- 角色：`caregiver`（自己的）
- 參數：`is_read`（可選）、`page`、`limit`
- 預設排序：`created_at DESC`

**`GET /api/v1/notifications/unread-count`** — 取得未讀數量

- 角色：`caregiver`
- 成功（200）：`{ "success": true, "data": { "count": 5 } }`

**`PUT /api/v1/notifications/:id/read`** — 標記已讀

- 角色：`caregiver`（ownership）

**`PUT /api/v1/notifications/read-all`** — 全部已讀

- 角色：`caregiver`

---

#### F.3.6 行程（Appointments）

**`POST /api/v1/appointments`** — 新增行程

- 角色：`caregiver`（ownership 檢查 recipient_id）
- Request：
```json
{
  "recipient_id": "uuid",
  "title": "心臟內科回診",
  "hospital_name": "台大醫院",
  "department": "心臟內科",
  "doctor_name": "陳醫師",
  "appointment_date": "2026-03-15T09:00:00Z",
  "note": "記得帶健保卡與上次檢查報告"
}
```
- 驗證：`appointment_date` 必須為未來時間、title 1-200 字元

**`GET /api/v1/appointments`** — 取得行程列表

- 角色：`caregiver`（ownership）、`admin`
- 必要參數：`recipient_id`
- 可選參數：`from`、`to`（預設：今天起 30 天內）
- 排序：`appointment_date ASC`

**`PUT /api/v1/appointments/:id`** — 更新行程

- 角色：`caregiver`（ownership）

**`DELETE /api/v1/appointments/:id`** — 刪除行程

- 角色：`caregiver`（ownership）
- 執行硬刪除（行程為使用者自管資料，無審計需求；此為 D.2 中唯一允許硬刪除的資源）

---

#### F.3.7 服務需求（Service Requests）

**`GET /api/v1/service-categories`** — 取得服務類別

- 角色：`caregiver`、`admin`
- 只回傳 `is_active = true` 的類別

**`POST /api/v1/service-requests`** — 送出需求單

- 角色：`caregiver`
- Request：
```json
{
  "recipient_id": "uuid",
  "category_id": "uuid",
  "preferred_date": "2026-03-20T00:00:00Z",
  "preferred_time_slot": "morning",
  "location": "台北市大安區信義路三段100號",
  "description": "需要陪同至台大醫院心臟內科回診，長輩行動不便需輪椅協助"
}
```
- 初始狀態自動設為 `submitted`

**`GET /api/v1/service-requests`** — 取得需求單列表

- 角色：`caregiver`（自己的）、`admin`（全部，支援 `?status=` 篩選）
- 包含關聯的 recipient 基本資料、category 名稱、assigned provider 姓名

**`GET /api/v1/service-requests/:id`** — 取得需求單詳情

**`PUT /api/v1/service-requests/:id/status`** — 更新需求單狀態（Admin）

- 角色：`admin`
- Request：
```json
{
  "status": "contacted",
  "admin_note": "已電話聯繫家屬確認需求"
}
```
- 狀態轉換規則必須驗證（見 D.3 狀態機）

**`PUT /api/v1/service-requests/:id/assign`** — 指派服務人員（Admin）

- 角色：`admin`
- Request：
```json
{
  "provider_id": "uuid"
}
```
- 驗證：provider 必須 `review_status = 'approved'`
- 指派後自動建立通知給委託人

---

#### F.3.8 服務人員（Providers）— Admin Only

**`POST /api/v1/providers`** — 建立服務人員

- 角色：`admin`
- Request：
```json
{
  "name": "陳護理師",
  "phone": "0922333444",
  "email": "chen@example.com",
  "specialties": ["陪診", "居家照護"],
  "certifications": ["護理師執照", "照顧服務員證"],
  "experience_years": 5,
  "service_areas": ["台北市大安區", "台北市信義區"]
}
```

**`GET /api/v1/providers`** — 列表

- 角色：`admin`
- 篩選：`?review_status=`、`?search=`（姓名模糊搜尋）

**`GET /api/v1/providers/:id`** — 詳情

**`PUT /api/v1/providers/:id`** — 更新

**`PUT /api/v1/providers/:id/review`** — 審核

- 角色：`admin`
- Request：
```json
{
  "review_status": "approved",
  "admin_note": "證照驗證通過"
}
```

**`POST /api/v1/providers/:id/documents/presign`** — 取得上傳用 pre-signed URL

- 角色：`admin`
- 說明：前端先呼叫此 endpoint 取得 pre-signed PUT URL，再由前端直接上傳至 R2/S3，最後呼叫 confirm endpoint 寫入 metadata。此流程避免 Vercel serverless 處理 multipart/form-data 的限制與不穩定。
- Request：
```json
{
  "file_name": "護理師執照.pdf",
  "mime_type": "application/pdf",
  "file_size": 1048576,
  "document_type": "certification"
}
```
- 驗證：`mime_type` 必須在允許清單內（見 K.1）、`file_size` ≤ 5MB、`document_type` enum（`certification` / `id_card` / `other`）
- 成功（200）：
```json
{
  "success": true,
  "data": {
    "upload_url": "https://r2-bucket.../presigned-put-url",
    "file_key": "providers/{providerId}/{uuid}.pdf",
    "expires_in": 600
  }
}
```
- 錯誤：`FILE_TOO_LARGE`、`FILE_INVALID_TYPE`、`AUTH_FORBIDDEN`

**`POST /api/v1/providers/:id/documents/confirm`** — 確認上傳完成並寫入 metadata

- 角色：`admin`
- 說明：前端上傳完成後呼叫此 endpoint，後端驗證檔案確實存在於 R2/S3 後才寫入 `provider_documents` 表
- Request：
```json
{
  "file_key": "providers/{providerId}/{uuid}.pdf",
  "file_name": "護理師執照.pdf",
  "file_size": 1048576,
  "mime_type": "application/pdf",
  "document_type": "certification"
}
```
- 成功（201）：回傳完整 document 物件
- 錯誤：`RESOURCE_NOT_FOUND`（檔案不存在於 R2/S3）、`VALIDATION_ERROR`

**`GET /api/v1/providers/:id/documents`** — 取得文件列表

**`GET /api/v1/providers/:id/documents/:docId/download`** — 取得下載用 pre-signed URL

- 角色：`admin`
- 成功（200）：回傳 `{ "success": true, "data": { "download_url": "...", "expires_in": 900 } }`

---

#### F.3.9 Admin 專用

**`GET /api/v1/admin/dashboard`** — 後台總覽

- 角色：`admin`
- 成功（200）：
```json
{
  "success": true,
  "data": {
    "total_caregivers": 15,
    "total_recipients": 22,
    "total_measurements_today": 38,
    "pending_service_requests": 5,
    "pending_provider_reviews": 2,
    "abnormal_alerts_today": 3
  }
}
```

**`GET /api/v1/admin/recipients`** — 全平台被照護者清單（含最新數據）

- 角色：`admin`
- 支援搜尋、分頁

**`CRUD /api/v1/admin/service-categories`** — 管理服務類別

- 角色：`admin`
- 新增 / 更新 / 停用（`is_active` toggle）

---

## G. Mobile App 頁面規格

### G.1 Navigation 結構（expo-router）

```
app/
├── _layout.tsx              # Root layout（AuthProvider wrap）
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx            # 登入頁
│   └── register.tsx         # 註冊頁
├── (tabs)/
│   ├── _layout.tsx          # Tab navigator
│   ├── home/
│   │   ├── index.tsx        # 首頁（被照護者清單）
│   │   └── [recipientId]/
│   │       ├── index.tsx    # 被照護者詳情
│   │       └── edit.tsx     # 編輯被照護者
│   ├── health/
│   │   ├── index.tsx        # 選擇被照護者 → 健康總覽
│   │   ├── add-measurement.tsx  # 新增量測
│   │   ├── trends.tsx       # 趨勢圖表
│   │   ├── ai-report.tsx    # AI 放心報
│   │   └── export.tsx       # 匯出/分享
│   ├── services/
│   │   ├── index.tsx        # 服務需求列表
│   │   ├── new-request.tsx  # 新增需求單
│   │   └── [requestId].tsx  # 需求單詳情
│   └── profile/
│       ├── index.tsx        # 個人設定
│       ├── notifications.tsx # 通知列表
│       └── appointments.tsx  # 行程管理
└── ai-chat.tsx              # AI 對話（modal）
```

### G.2 頁面詳細規格

#### G.2.1 登入頁（`login.tsx`）

- **目的**：委託人登入系統
- **UI 區塊**：
  - Logo + 標題「遠端照護平台」
  - Email 輸入欄位（keyboard type: email）
  - 密碼輸入欄位（secure text、show/hide toggle）
  - 「登入」按鈕（primary）
  - 「還沒有帳號？註冊」連結
- **互動**：
  - 表單驗證：email 格式、密碼非空
  - 登入成功 → 儲存 token → 跳轉首頁
  - 登入失敗 → 顯示錯誤訊息（inline）
- **Loading**：按鈕 spinner
- **Error**：inline error message below input
- **API**：`POST /api/v1/auth/login`

#### G.2.2 註冊頁（`register.tsx`）

- **目的**：新委託人註冊
- **UI 區塊**：
  - 姓名、Email、密碼、確認密碼、電話（可選）
  - 「註冊」按鈕
  - 「已有帳號？登入」連結
- **驗證**：密碼 ≥ 8 字元含大小寫與數字、兩次密碼一致
- **API**：`POST /api/v1/auth/register`

#### G.2.3 首頁（`home/index.tsx`）

- **目的**：顯示委託人的所有被照護者，快速掌握狀況
- **UI 區塊**：
  - 頂部：歡迎訊息 + 未讀通知 badge
  - 被照護者卡片列表：
    - 姓名、年齡（從 date_of_birth 計算）
    - 疾病標籤 chips
    - 最近一筆血壓/血糖（含異常紅點）
    - 點擊 → 被照護者詳情
  - 右下角 FAB「＋ 新增被照護者」
- **Empty**：「尚無被照護者，請點擊右下角新增。」
- **Loading**：skeleton cards
- **API**：`GET /api/v1/recipients`、`GET /api/v1/notifications/unread-count`

#### G.2.4 被照護者詳情（`home/[recipientId]/index.tsx`）

- **目的**：單一被照護者的完整資訊與快捷操作
- **UI 區塊**：
  - 基本資料卡片（姓名、生日、疾病標籤、緊急聯絡人）
  - 編輯按鈕
  - 快捷操作列：
    - 「記錄血壓」「記錄血糖」「看趨勢」「AI 放心報」
  - 最近量測紀錄（最新 5 筆）
  - 未來行程（最近 2 筆）
- **API**：`GET /api/v1/recipients/:id`、`GET /api/v1/measurements?recipient_id=&limit=5`、`GET /api/v1/appointments?recipient_id=&limit=2`

#### G.2.5 新增量測（`health/add-measurement.tsx`）

- **目的**：手動輸入血壓或血糖資料
- **UI 區塊**：
  - 切換 tab：血壓 / 血糖
  - **血壓表單**：收縮壓（數字鍵盤）、舒張壓、心率（可選）、備註、量測時間（預設現在）
  - **血糖表單**：血糖值、餐前/餐後/空腹/隨機（radio）、備註、量測時間
  - 「儲存」按鈕
- **驗證**：
  - 收縮壓 40-300、舒張壓 20-200、心率 30-250
  - 血糖值 10-800
  - 量測時間不得為未來時間
- **成功後**：Toast 提示 + 返回上一頁
- **若標記異常**：顯示黃色/紅色提示「此次量測數值偏高/偏低，建議留意」
- **API**：`POST /api/v1/measurements`

#### G.2.6 趨勢圖表（`health/trends.tsx`）

- **目的**：以圖表呈現 7 天/30 天健康趨勢
- **UI 區塊**：
  - 被照護者選擇器（若有多位）
  - 類型切換：血壓 / 血糖
  - 期間切換：7 天 / 30 天
  - 折線圖：
    - 血壓：雙線（收縮壓/舒張壓）+ 異常區間底色
    - 血糖：單線 + 異常區間底色
    - 異常點標紅
  - 統計卡片：min / max / avg / 異常次數
  - 異常筆數列表（可展開）
- **Empty**：「尚無量測資料，請先記錄健康數據。」
- **API**：`GET /api/v1/measurements/stats`

#### G.2.7 AI 放心報（`health/ai-report.tsx`）

- **目的**：生成並顯示 AI 健康摘要
- **UI 區塊**：
  - 報告類型選擇：放心報 / 趨勢解讀 / 看診問題 / 家人摘要
  - 「生成報告」按鈕
  - 報告卡片：
    - 狀態標籤（穩定=綠、需注意=黃、建議就醫=紅）
    - 一句話結論（大字）
    - 原因列表
    - 建議行動列表
    - 免責聲明（固定顯示、灰色小字、不可隱藏）
  - 「分享」按鈕（複製文字到剪貼簿 / 系統分享）
  - 歷史報告列表
- **Loading**：skeleton + 「AI 正在分析中...」文字
- **Error**：若 AI 失敗，顯示安全文案：「暫時無法生成報告，請稍後再試。您可以查看趨勢圖表了解近期數據。」
- **API**：`POST /api/v1/ai/health-report`、`GET /api/v1/ai/reports`

#### G.2.8 行程管理（`profile/appointments.tsx`）

- **目的**：管理就醫行程
- **UI 區塊**：
  - 被照護者選擇器
  - 未來 30 天行程列表（時間軸排列）
  - 每筆：日期時間、醫院、科別、備註
  - 「＋ 新增行程」按鈕
  - 新增/編輯 modal：日期時間選擇器、醫院名稱、科別、醫師（可選）、備註
- **Empty**：「暫無行程，點擊右上角新增。」
- **API**：`GET /api/v1/appointments`、`POST /api/v1/appointments`、`PUT /api/v1/appointments/:id`、`DELETE /api/v1/appointments/:id`

#### G.2.9 服務需求（`services/index.tsx` + `services/new-request.tsx`）

- **列表頁**：
  - 需求單列表，依狀態分色：
    - `submitted`（灰）→ `contacted`（藍）→ `arranged`（綠）→ `completed`（深綠）→ `cancelled`（紅）
  - 每筆：服務類別、被照護者、期望日期、狀態 badge
  - 點擊 → 詳情頁

- **新增頁**：
  - 被照護者選擇器
  - 服務類別選擇（從 API 動態取得）
  - 期望日期（date picker）
  - 時段偏好（早上/下午/晚上）
  - 地點（文字輸入）
  - 需求描述（textarea，必填，10-1000 字）
  - 「送出需求」按鈕
  - 確認 modal：「確定送出？送出後營運團隊將盡快與您聯繫。」

- **詳情頁**（`services/[requestId].tsx`）：
  - 完整需求資訊
  - 狀態時間軸（顯示各狀態轉換時間）
  - 指派的服務人員資訊（若已指派）：姓名、專業
  - 營運方備註（若有）

- **API**：`GET /api/v1/service-categories`、`POST /api/v1/service-requests`、`GET /api/v1/service-requests`、`GET /api/v1/service-requests/:id`

#### G.2.10 通知列表（`profile/notifications.tsx`）

- **目的**：顯示所有 in-app 通知
- **UI 區塊**：
  - 通知列表：圖示（依類型）、標題、內容預覽、時間、已讀/未讀
  - 「全部已讀」按鈕
  - 點擊通知 → 標記已讀 + 跳轉相關頁面（依 `data` 中的跳轉資訊）
- **API**：`GET /api/v1/notifications`、`PUT /api/v1/notifications/:id/read`、`PUT /api/v1/notifications/read-all`

#### G.2.11 個人設定（`profile/index.tsx`）

- 顯示：姓名、email、電話、時區
- 編輯個人資料
- 量測提醒設定（啟用/停用、時間調整）
- 登出
- **API**：`GET /api/v1/auth/me`、`PUT /api/v1/auth/me`

### G.3 端到端驗收劇本（Given/When/Then）

#### 劇本 1：Onboarding + 量測 + 圖表

```
Given：新使用者首次開啟 App
When：完成註冊 → 新增被照護者「王奶奶」（高血壓標籤）
Then：首頁顯示「王奶奶」卡片

When：點擊「記錄血壓」→ 輸入 145/92 → 儲存
Then：顯示紅色異常提示 → 返回首頁 → 卡片顯示最新數值與紅點

When：點擊「看趨勢」→ 選 7 天
Then：顯示折線圖含異常紅點、統計數據
```

#### 劇本 2：AI 放心報 + 分享

```
Given：被照護者已有 7 天以上量測資料
When：點擊「AI 放心報」→ 選「放心報」→ 點「生成報告」
Then：Loading → 顯示報告卡片（狀態標籤 + 結論 + 原因 + 建議）+ 免責聲明

When：點擊「分享」
Then：文字摘要複製到剪貼簿（或觸發系統分享）
```

#### 劇本 3：行程管理

```
Given：已登入且有被照護者
When：進入行程管理 → 點新增 → 填入台大醫院/心臟內科/2026-03-15 09:00
Then：行程列表顯示新行程
```

#### 劇本 4：需求單送出 + 狀態追蹤

```
Given：已登入且有被照護者
When：進入服務需求 → 新增 → 選「陪診」→ 填表 → 送出
Then：列表出現新需求單，狀態為「已送出」

Given：Admin 在後台更新狀態為「已安排」並指派服務人員
When：委託人 pull-to-refresh 需求列表
Then：狀態更新為「已安排」，可看到服務人員資訊
```

---

## H. Web Admin 頁面規格

### H.1 Route 結構

```
app/admin/
├── layout.tsx          # Admin layout（sidebar + header + auth guard）
├── page.tsx            # Dashboard（重導或首頁）
├── dashboard/
│   └── page.tsx        # 總覽
├── service-requests/
│   ├── page.tsx        # 需求單列表
│   └── [id]/
│       └── page.tsx    # 需求單詳情
├── providers/
│   ├── page.tsx        # 服務人員列表
│   ├── new/
│   │   └── page.tsx    # 新增服務人員
│   └── [id]/
│       └── page.tsx    # 服務人員詳情/編輯
├── recipients/
│   └── page.tsx        # 被照護者清單（唯讀總覽）
├── services/
│   └── page.tsx        # 服務類別管理
└── login/
    └── page.tsx        # Admin 登入
```

### H.2 頁面規格

#### H.2.1 Admin 登入

- 與 Mobile 共用同一個 `POST /api/v1/auth/login`
- 登入後驗證 `role === 'admin'`，非 admin 顯示「無權限」
- JWT 存 httpOnly cookie（Web 端）

#### H.2.2 Dashboard

- 統計卡片：委託人數、被照護者數、今日量測數、待處理需求單、待審核服務人員、今日異常通知
- 最近 5 筆待處理需求單（快捷連結）
- 最近 5 筆異常通知
- **API**：`GET /api/v1/admin/dashboard`

#### H.2.3 需求單管理

- **列表頁**：
  - 表格：編號、委託人、被照護者、類別、期望日期、狀態、指派人員、建立日期
  - 篩選：狀態 dropdown、關鍵字搜尋
  - 分頁
  - 點擊 → 詳情頁

- **詳情頁**：
  - 完整需求資訊
  - 狀態更新按鈕（dropdown：下一個合法狀態）
  - 指派服務人員（dropdown：`approved` 狀態的 provider 列表）
  - 營運備註輸入
  - 操作歷程（顯示 `updated_at`）

#### H.2.4 服務人員管理

- **列表頁**：
  - 表格：姓名、電話、專業、證照、服務區域、審核狀態、建立日期
  - 篩選：審核狀態
  - 「＋ 新增」按鈕

- **新增/編輯頁**：
  - 基本資料表單
  - 文件上傳區（拖拽或點擊上傳，顯示已上傳清單）
  - 審核操作：通過 / 停用（附備註）

#### H.2.5 被照護者總覽

- 表格：姓名、委託人、疾病標籤、最近血壓、最近血糖、最近異常
- 搜尋、分頁
- 點擊 → 展開詳細量測資料（modal 或 drawer）
- **唯讀**：Admin 不在此頁面修改被照護者資料

#### H.2.6 服務類別管理

- 列表：名稱、說明、排序、啟用狀態
- 新增 / 編輯 / 停用 toggle
- **API**：`CRUD /api/v1/admin/service-categories`

---

## I. AI 設計

### I.1 AI 定位與禁止事項

**定位**：AI 為「健康資訊彙整與白話翻譯工具」，**不是**醫療診斷系統。

**禁止輸出**（必須在 prompt 中嚴格約束）：
- 具體藥物名稱或劑量建議
- 「您患有 XXX 疾病」等診斷性語句
- 「應立即停藥/換藥」等處方建議
- 任何緊急醫療建議（如「請立即撥打 119」）
- 涉及心理健康診斷的內容

**必須輸出**：
- 每份報告必須包含免責聲明
- 語氣必須為「建議」而非「指示」

### I.2 Prompt 模板

#### 放心報（Health Summary）

```
You are a health data summarizer for a remote care platform. Your role is to summarize health measurement data in plain language for family caregivers.

STRICT RULES:
1. NEVER provide medical diagnoses or prescribe medications.
2. NEVER suggest specific drug names or dosages.
3. NEVER use phrases like "You have [disease]" or "You should stop taking [medication]".
4. NEVER provide emergency medical advice.
5. Always frame suggestions as "consider" or "it may be helpful to" rather than directives.
6. Focus on trends and patterns, not individual readings.
7. Use simple, non-technical language suitable for family members.

RECIPIENT INFO:
- Name: {{recipientName}}
- Age: {{age}}
- Medical tags: {{medicalTags}}

MEASUREMENT DATA (last {{period}} days):
- Type: {{measurementType}}
- Total readings: {{totalCount}}
- Average: {{average}}
- Min: {{min}} (on {{minDate}})
- Max: {{max}} (on {{maxDate}})
- Abnormal count: {{abnormalCount}}
- Recent 5 readings: {{recentReadings}}

RESPOND IN TRADITIONAL CHINESE (繁體中文) using EXACTLY this JSON format:
{
  "status_label": "stable" | "attention" | "consult_doctor",
  "summary": "一句話結論（30字以內）",
  "reasons": ["原因1", "原因2", "原因3"],
  "suggestions": ["建議1", "建議2", "建議3"]
}

IMPORTANT: Output ONLY the JSON object, no other text.
```

#### 趨勢解讀（Trend Explanation）

```
You are a health trend analyzer. Explain measurement trends in simple terms.

STRICT RULES: [same as above]

DATA: {{trendData}}

RESPOND IN TRADITIONAL CHINESE using EXACTLY this JSON format:
{
  "trend_direction": "improving" | "stable" | "worsening",
  "explanation": "白話趨勢說明（100字以內）",
  "key_observations": ["觀察1", "觀察2"],
  "suggestions": ["建議1", "建議2"]
}
```

#### 看診問題清單（Visit Prep）

```
You are a health consultation assistant. Generate questions a caregiver should ask the doctor based on recent health data.

STRICT RULES: [same as above]

DATA: {{healthData}}
UPCOMING APPOINTMENT: {{appointmentInfo}}

RESPOND IN TRADITIONAL CHINESE using EXACTLY this JSON format:
{
  "questions": [
    { "category": "類別", "question": "問題內容" }
  ],
  "data_to_bring": ["需攜帶的資料1", "需攜帶的資料2"],
  "notes": "就診前注意事項"
}
```

#### 家人近況摘要（Family Update）

```
You are a family communication assistant. Generate a brief, warm update about the care recipient for sharing with family members.

STRICT RULES: [same as above]

DATA: {{recentData}}

RESPOND IN TRADITIONAL CHINESE using EXACTLY this JSON format:
{
  "greeting": "問候語",
  "health_update": "健康近況摘要（100字以內）",
  "highlights": ["重點1", "重點2"],
  "closing": "結語"
}
```

### I.3 嚴格 JSON 輸出 Schema（Zod）

```typescript
// packages/shared/src/schemas/ai.ts

import { z } from 'zod';

export const HealthReportSchema = z.object({
  status_label: z.enum(['stable', 'attention', 'consult_doctor']),
  summary: z.string().min(1).max(100),
  reasons: z.array(z.string().min(1).max(200)).min(1).max(5),
  suggestions: z.array(z.string().min(1).max(200)).min(1).max(5),
});

export const TrendAnalysisSchema = z.object({
  trend_direction: z.enum(['improving', 'stable', 'worsening']),
  explanation: z.string().min(1).max(300),
  key_observations: z.array(z.string()).min(1).max(5),
  suggestions: z.array(z.string()).min(1).max(5),
});

export const VisitPrepSchema = z.object({
  questions: z.array(z.object({
    category: z.string(),
    question: z.string(),
  })).min(1).max(10),
  data_to_bring: z.array(z.string()).min(1).max(5),
  notes: z.string().max(300),
});

export const FamilyUpdateSchema = z.object({
  greeting: z.string().max(50),
  health_update: z.string().min(1).max(300),
  highlights: z.array(z.string()).min(1).max(5),
  closing: z.string().max(100),
});
```

### I.4 防護欄

| 防護措施 | 規則 |
|---------|------|
| 輸出驗證 | LLM 回應必須通過對應 Zod schema 驗證，失敗則使用 fallback |
| Timeout | 單次 LLM 呼叫 **15 秒** timeout |
| Retry | 最多 **1 次** retry（timeout 或 5xx 時） |
| Fallback 文案 | 驗證失敗或呼叫失敗時回傳：`{ status_label: "attention", summary: "暫時無法生成報告，請查看趨勢圖表了解近期數據。", reasons: ["AI 服務暫時不可用"], suggestions: ["請稍後再試或直接查看健康數據趨勢"] }` |
| 頻率限制 | 每位被照護者每種 report_type 每小時 3 次；每位使用者 chat 每小時 10 次 |
| 字數限制 | prompt 總長度上限 4000 tokens |
| 模型設定 | `temperature: 0.3`（低隨機性）、`max_tokens: 500`、`response_format: { type: "json_object" }` |

### I.5 成本控制

- MVP 預估：每次呼叫 GPT-4o-mini 約 $0.001 USD
- 每月預算上限：$50 USD
- 超過預算 → 自動停用 AI 功能 → 顯示「本月 AI 額度已用完」
- 監控：記錄每次 `input_tokens` + `output_tokens`，每日統計

### I.6 免責聲明

以下文字必須在所有 AI 報告的**底部固定顯示**，不可被使用者隱藏或跳過：

```
⚠️ 免責聲明：本報告由人工智慧生成，僅供健康趨勢參考，不構成醫療診斷、治療建議或處方指示。如有任何健康疑慮，請諮詢合格的醫療專業人員。
```

---

## J. 通知與排程設計

### J.1 通知類型與生成規則

| 通知類型 | 觸發條件 | 標題範本 | 內容範本 |
|---------|---------|---------|---------|
| `measurement_reminder` | 排程時間到達 | 「量測提醒」 | 「該幫 [姓名] 量 [血壓/血糖] 囉！」 |
| `abnormal_alert` | 最近 3 筆中 ≥ 2 筆異常 | 「異常提醒」 | 「[姓名] 近期 [血壓/血糖] 有多次異常紀錄，建議關注。」 |
| `appointment_reminder` | 就醫行程前 24 小時 | 「就醫提醒」 | 「[姓名] 明天 [時間] 有 [醫院][科別] 的就醫行程。」 |
| `service_request_update` | 需求單狀態變更 | 「需求單更新」 | 「您的 [類別] 需求單狀態已更新為 [狀態]。」 |
| `ai_report_ready` | AI 報告生成完成 | 「放心報已生成」 | 「[姓名] 的健康報告已生成，點擊查看。」 |

### J.2 量測提醒

- **預設時間**：早上 08:00、晚上 20:00（使用者本地時間）
- **可配置**：使用者可調整時間、啟用/停用
- **時區處理**：
  1. 提醒時間以使用者本地時間設定並儲存（`measurement_reminders.reminder_time`）
  2. 排程 job 每次執行時，將使用者 `timezone` + `reminder_time` 轉為 UTC 判斷是否觸發
  3. 觸發後建立 `notifications` 記錄

### J.3 異常提醒去重

- 同一被照護者 + 同一量測類型，24 小時內只產生一則 `abnormal_alert`
- 實作：檢查 `notifications` 表中最近 24 小時是否已有同類通知

### J.4 行程提醒

- **定案**：就醫行程前 **24 小時** 發送提醒
- 排程 job 每小時檢查一次，找出 24 小時後有行程的 recipients

### J.5 排程方式

- **MVP 方案**：Vercel Cron Jobs
  - `vercel.json` 設定 cron expressions
  - 排程 endpoint：`/api/cron/reminders`（量測提醒，每 30 分鐘）
  - 排程 endpoint：`/api/cron/appointment-reminders`（行程提醒，每小時）
  - 以 `CRON_SECRET` 環境變數保護 cron endpoint

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/appointment-reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## K. 檔案上傳

### K.1 格式與大小限制

| 項目 | 限制 |
|------|------|
| 允許格式 | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |
| 單檔大小上限 | 5 MB |
| 每位 Provider 文件數上限 | 20 |
| 檔名處理 | 原始檔名保留於 `file_name`，S3 key 使用 UUID 避免衝突 |

### K.2 上傳流程（Pre-signed URL 模式）

Vercel serverless 函式處理 `multipart/form-data` 有 body size 限制（Hobby plan 4.5MB）且行為不穩定。MVP **強制採用 pre-signed URL 上傳模式**：

```
Admin 前端                        後端 API                     Cloudflare R2
    │                               │                              │
    │  POST /presign                │                              │
    │  {file_name, mime_type,       │                              │
    │   file_size, document_type}   │                              │
    │ ────────────────────────────► │                              │
    │                               │  產生 pre-signed PUT URL     │
    │  ◄──────────────────────────  │                              │
    │  {upload_url, file_key}       │                              │
    │                               │                              │
    │  PUT upload_url               │                              │
    │  Body: raw file bytes         │                              │
    │ ─────────────────────────────────────────────────────────► │
    │  ◄─────────────────────────────────────────────────────── │
    │  200 OK                       │                              │
    │                               │                              │
    │  POST /confirm                │                              │
    │  {file_key, file_name, ...}   │                              │
    │ ────────────────────────────► │                              │
    │                               │  HEAD file_key (驗證存在)     │
    │                               │ ─────────────────────────► │
    │                               │  ◄───────────────────────  │
    │                               │  寫入 provider_documents     │
    │  ◄──────────────────────────  │                              │
    │  201 Created                  │                              │
```

### K.3 儲存策略

| 環境 | 儲存方式 | 說明 |
|------|---------|------|
| Development | 本地資料夾 `apps/web/uploads/` | 加入 `.gitignore`；presign endpoint 回傳 local URL，confirm 檢查本地檔案 |
| Staging / Production | Cloudflare R2（S3 相容 API） | 使用 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |

S3 key 格式：`providers/{providerId}/{uuid}.{ext}`

Development 模式判斷：

```typescript
const isDev = process.env.NODE_ENV === 'development';
// isDev 時 presign 回傳 local upload endpoint；prod 時回傳 R2 pre-signed URL
```

### K.4 權限與下載

- 上傳（presign + confirm）：僅 `admin` 角色
- 下載：僅 `admin` 角色
- 下載方式：後端產生 pre-signed GET URL（有效期 15 分鐘）
- **嚴禁**將檔案 URL 暴露給非 admin 使用者

### K.5 Phase 2 備註

- 病毒掃描（ClamAV 或 S3 Event → Lambda）
- 圖片壓縮與縮圖
- 文件過期自動清理

---

## L. 安全、隱私、合規

### L.1 認證安全

| 項目 | 規則 |
|------|------|
| 密碼雜湊 | bcrypt，cost factor = 12 |
| JWT | RS256 或 HS256（MVP 可用 HS256）、過期時間 7 天 |
| Token 儲存（Mobile） | `expo-secure-store`（加密儲存），以 `Authorization: Bearer {token}` 傳遞 |
| Token 儲存（Web） | httpOnly cookie（`auth_token`）+ `SameSite=Strict` + `Secure=true`（production） |
| 密碼規則 | 至少 8 字元，含大寫、小寫、數字 |

#### 雙認證策略（Bearer + Cookie）

API middleware 必須同時支援兩種 token 傳遞方式，以適應 Mobile 與 Web 不同的安全模型：

```typescript
// apps/web/lib/auth.ts — verifyAuth 虛擬碼
export async function verifyAuth(request: NextRequest): Promise<AuthPayload | null> {
  // 策略 1：Authorization header（Mobile 端使用）
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyJwt(token);
  }

  // 策略 2：httpOnly cookie（Web Admin 使用）
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    return verifyJwt(cookieToken);
  }

  return null;
}
```

- **Mobile**：登入成功後將 JWT 存入 `expo-secure-store`，每次請求以 `Authorization: Bearer` 傳遞
- **Web Admin**：登入成功後由後端設定 `Set-Cookie: auth_token={jwt}; HttpOnly; SameSite=Strict; Secure; Path=/`
- 兩種方式**共用同一組 API endpoint**，middleware 自動判斷來源
- **嚴禁** Web 端將 JWT 存入 `localStorage` 或 `sessionStorage`

### L.2 API 安全

| 項目 | 規則 |
|------|------|
| CORS | 僅允許已知 origin（Vercel 部署 domain + localhost:8081） |
| Rate Limit | 使用 **Upstash Redis**（`@upstash/ratelimit`）實作；見下方詳細規則 |
| Input Validation | 所有 API 必須使用 Zod 驗證 |
| SQL Injection | 使用 Prisma ORM（參數化查詢） |
| XSS | React 預設 escape；嚴禁使用 `dangerouslySetInnerHTML` |

#### Rate Limiting 策略（Upstash Redis）

**為什麼不用 in-memory Map**：Vercel serverless 每次請求可能在不同 instance 執行，記憶體不共享，in-memory rate limit 無法正確計數。

**MVP 定案**：使用 **Upstash Redis**（免費額度 10,000 commands/day，足夠 MVP）搭配 `@upstash/ratelimit` 套件。

| Endpoint 類別 | 限制 | Key |
|--------------|------|-----|
| 全域 | 100 req/min per IP | `global:{ip}` |
| Auth（login/register） | 10 req/min per IP | `auth:{ip}` |
| AI（report/chat） | 每位被照護者每種 report_type 每小時 3 次 | `ai:{userId}:{recipientId}:{reportType}` |
| AI chat | 每位使用者每小時 10 次 | `ai-chat:{userId}` |
| Device Ingest | 60 req/min per token | `device:{token}` |

超限回應：HTTP 429 + `RATE_LIMIT_EXCEEDED` 錯誤碼 + `Retry-After` header

```typescript
// apps/web/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const globalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'global',
});

export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'auth',
});

export const aiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'ai',
});
```

### L.3 Log 脫敏

以下欄位**嚴禁**出現在任何 log 中：

- `password` / `password_hash`
- `token` / `jwt`（可記錄前 8 字元供 debug）
- 完整 `email`（可記錄 `u***@domain.com`）
- `phone`（可記錄後 4 碼）
- 健康數據原始值（log 中只記錄 measurement ID）

### L.4 AI 安全

- Prompt 中不得包含使用者密碼或 token
- AI 回應必須經過 Zod 驗證後才回傳前端
- AI 輸出的免責聲明不可被前端程式碼移除

#### AI 除錯日誌控制（`AI_DEBUG_LOGGING`）

`ai_reports` 表中的 `raw_prompt` 與 `raw_response` 欄位包含被照護者個資（姓名、健康數據），具隱私風險。必須以環境變數控制：

| 環境 | `AI_DEBUG_LOGGING` | 行為 |
|------|:------------------:|------|
| Development | `true` | `raw_prompt` 與 `raw_response` 完整寫入 DB |
| Staging | `true`（可選） | 同上 |
| **Production** | **`false`（強制）** | `raw_prompt` 與 `raw_response` 一律寫入 `null`；僅保留 `model`、`input_tokens`、`output_tokens` 供成本追蹤 |

```typescript
// apps/web/lib/ai.ts
const shouldLogRaw = process.env.AI_DEBUG_LOGGING === 'true';

await prisma.aiReport.create({
  data: {
    // ... 其他欄位
    raw_prompt: shouldLogRaw ? prompt : null,
    raw_response: shouldLogRaw ? rawResponse : null,
  },
});
```

- Production 環境**嚴禁**將 `AI_DEBUG_LOGGING` 設為 `true`
- 若需 production 除錯，應使用 Sentry extra context（自動脫敏）而非寫入 DB

### L.5 備份策略

- Supabase 自動每日備份（免費方案含 7 天）
- Staging/Prod 額外設定 Supabase Point-in-Time Recovery（Pro plan）

### L.6 最小資料保護

- 使用 HTTPS（Vercel 自動）
- 資料庫連線使用 SSL
- 環境變數不得寫入程式碼，一律使用 `.env`
- `.env` 必須在 `.gitignore` 中

---

## M. 可觀測性

### M.1 Structured Logging

所有 API 回應必須記錄 structured log，格式：

```json
{
  "timestamp": "2026-03-07T10:30:00.000Z",
  "level": "info",
  "request_id": "uuid",
  "method": "POST",
  "path": "/api/v1/measurements",
  "status": 201,
  "duration_ms": 45,
  "user_id": "uuid",
  "user_role": "caregiver",
  "ip": "masked"
}
```

### M.2 Error Tracking

- 使用 **Sentry**（免費額度足夠 MVP）
- apps/web 與 apps/mobile 各自初始化 Sentry
- 所有未捕獲的錯誤自動上報
- AI 呼叫失敗必須手動上報含 context

### M.3 重要事件紀錄

以下事件必須記錄（至少）：

1. 使用者註冊
2. 使用者登入（成功/失敗）
3. 被照護者建立/更新
4. 量測資料建立（含 is_abnormal 標記）
5. 異常通知觸發
6. AI 報告生成（成功/失敗，含 token 數與耗時）
7. 服務需求單建立
8. 服務需求單狀態變更
9. 服務人員建立/審核狀態變更
10. Device API 呼叫（成功/失敗）
11. Cron job 執行（開始/結束/錯誤）
12. 檔案上傳（成功/失敗）

### M.4 最小監控指標

| 指標 | 來源 | 告警條件 |
|------|------|---------|
| API 錯誤率 | Sentry | > 5% 持續 5 分鐘 |
| API P95 延遲 | Vercel Analytics | > 2 秒 |
| AI 呼叫失敗率 | 自訂 log | > 20% 持續 10 分鐘 |
| AI 月度成本 | Token 統計 | > $40 USD |

---

## N. 部署與環境

### N.1 部署架構

| 元件 | 服務 | 方案 |
|------|------|------|
| apps/web | Vercel | Hobby（免費）→ Pro（$20/月） |
| PostgreSQL | Supabase | Free tier → Pro |
| Rate Limit | Upstash Redis | Free tier（10,000 commands/day） |
| 檔案儲存 | Cloudflare R2 | Free tier（10GB） |
| Mobile | Expo Go | 掃 QR code demo |
| AI | OpenAI API | Pay-as-you-go |
| Error Tracking | Sentry | Free tier |

### N.2 環境變數

#### apps/web（Vercel）

| 變數名 | 說明 | 範例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串（**必須使用 pooled/pgbouncer 連線**） | `postgresql://user:pass@host:6543/db?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Prisma migrate 專用直連（**不經 pgbouncer**） | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `JWT_SECRET` | JWT 簽名密鑰 | 至少 32 字元隨機字串 |
| `OPENAI_API_KEY` | OpenAI API Key | `sk-...` |
| `OPENAI_MODEL` | 使用的模型 | `gpt-4o-mini` |
| `R2_ACCOUNT_ID` | Cloudflare 帳號 ID | |
| `R2_ACCESS_KEY_ID` | R2 存取 Key | |
| `R2_SECRET_ACCESS_KEY` | R2 密鑰 | |
| `R2_BUCKET_NAME` | R2 Bucket 名稱 | `remote-care-uploads` |
| `R2_PUBLIC_URL` | R2 公開 URL（若需要） | |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL（Rate Limit 用） | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | |
| `DEVICE_API_TOKEN` | Device Ingest 固定 Token | 至少 32 字元 |
| `CRON_SECRET` | Cron 端點保護密鑰 | 至少 32 字元 |
| `AI_DEBUG_LOGGING` | AI 除錯日誌開關（見 L.4） | `false`（Production 強制 false） |
| `SENTRY_DSN` | Sentry DSN | `https://xxx@sentry.io/yyy` |
| `NEXT_PUBLIC_APP_URL` | App URL | `https://remote-care.vercel.app` |

#### apps/mobile（Expo）

| 變數名 | 說明 | 範例 |
|--------|------|------|
| `EXPO_PUBLIC_API_URL` | API Base URL | `https://remote-care.vercel.app/api/v1` |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN | |

### N.3 Prisma Serverless 連線池策略

Vercel serverless 函式每次冷啟動都會建立新的資料庫連線，若不使用連線池會快速耗盡 Supabase 連線數上限。

#### 連線架構

```
Vercel serverless function
  │
  ├── DATABASE_URL（runtime 查詢用）
  │   └── 連到 Supabase pgbouncer（port 6543）
  │       └── pgbouncer 管理連線池 → PostgreSQL
  │
  └── DIRECT_URL（僅 migration 用）
      └── 直連 PostgreSQL（port 5432）
```

#### Prisma Schema 設定

```prisma
// apps/web/prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- `DATABASE_URL`：**必須**使用 Supabase 的 pooled 連線（port `6543`，加上 `?pgbouncer=true`）
- `DIRECT_URL`：**僅用於** `prisma migrate dev` / `prisma migrate deploy`（port `5432`，不經 pgbouncer）
- **嚴禁**在 runtime 使用 `DIRECT_URL` 查詢

#### Prisma Client Singleton

```typescript
// apps/web/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- 使用 `globalThis` 避免 hot reload 時建立多個 client（開發環境問題）
- Production 環境每個 serverless instance 自然只有一個 client，無需 global cache
- **嚴禁**在每個 route handler 中各自 `new PrismaClient()`

### N.4 Migration 與 Seed 流程

```bash
# 開發環境初始化
cd apps/web
pnpm prisma migrate dev
pnpm prisma db seed

# 生產環境 migration（Vercel build 時自動執行）
# 在 package.json build script 中加入：
# "build": "prisma migrate deploy && next build"
```

### N.5 回滾策略

- **Vercel**：使用 Vercel Dashboard 的 Instant Rollback（回滾到上一次成功部署）
- **資料庫**：Supabase Point-in-Time Recovery（需 Pro plan）；Free tier 使用每日自動備份手動恢復
- **破壞性 migration**：嚴禁在沒有備份的情況下執行 DROP TABLE 或 DROP COLUMN

---

## O. Demo 劇本

### O.1 一鍵啟動開發環境

```bash
# 1. Clone & 安裝依賴
git clone <repo-url> remote-care && cd remote-care
pnpm install

# 2. 環境變數
cp .env.example apps/web/.env.local
# 編輯 apps/web/.env.local 填入必要值（見 N.2 環境變數表）

# 3. 資料庫初始化 + Seed
pnpm db:migrate
pnpm db:seed

# 4. 同時啟動 web + mobile
pnpm dev
# turbo 會同時啟動：
#   - apps/web → http://localhost:3000（Admin + API）
#   - apps/mobile → Expo DevTools（掃 QR code）
```

#### Demo 帳號（Seed 自動建立）

| 角色 | Email | 密碼 |
|------|-------|------|
| Admin | `admin@remotecare.dev` | `Admin1234!` |
| 委託人 | `demo@remotecare.dev` | `Demo1234!` |

#### Seed 資料內容（見 D.5）

包含：2 位被照護者、各 30 筆量測紀錄（含異常）、2 筆行程、3 個服務類別、2 筆需求單、2 位服務人員、5 筆通知、1 筆 AI 放心報。

### O.2 Demo 前置準備

1. 確認 seed data 已載入（執行 `pnpm db:seed`）
2. 準備兩台裝置/視窗：手機（Expo Go）+ 電腦（Web Admin）
3. 確認 AI API 可用（測試一次呼叫）
4. 準備 fallback：若 AI 不可用，事先截圖一份成功的放心報

### O.3 劇本（約 6 分鐘）

| 步驟 | 時間 | 裝置 | 操作 | 展示重點 |
|------|------|------|------|---------|
| 1 | 0:00-0:30 | Mobile | 以 `demo@remotecare.dev` 登入 | 登入流程 |
| 2 | 0:30-1:00 | Mobile | 首頁查看已有的兩位被照護者，點入「王奶奶」 | Care Circle 概念、快速掌握狀況 |
| 3 | 1:00-1:30 | Mobile | 新增一位被照護者「張爺爺」（糖尿病標籤） | Onboarding 流程 |
| 4 | 1:30-2:30 | Mobile | 為「王奶奶」新增一筆血壓量測（145/92）→ 顯示異常紅點 | 手動輸入 + 異常判斷 |
| 5 | 2:30-3:30 | Mobile | 進入趨勢圖表（7 天），展示折線圖、統計數據、異常紅點 | 數據視覺化 |
| 6 | 3:30-4:30 | Mobile | 點「AI 放心報」→ 生成 → 顯示結論/原因/建議 → 免責聲明 | AI 核心功能 |
| 7 | 4:30-5:00 | Mobile | 一鍵分享（複製文字到剪貼簿，展示文字內容） | 分享閉環 |
| 8 | 5:00-5:30 | Mobile | 新增就醫行程（台大醫院心臟內科，下週） | 行程管理 |
| 9 | 5:30-6:00 | Mobile | 送出「陪診」服務需求單 | 服務媒合入口 |
| 10 | 6:00-7:00 | Web Admin | 以 admin 登入 → Dashboard 總覽 → 查看需求單 → 更新狀態為「已聯繫」→ 指派服務人員 | 營運後台閉環 |
| 11 | 7:00-7:30 | Mobile | Pull-to-refresh → 需求單狀態更新為「已聯繫」 | 閉環驗證 |
| 12 | 7:30-8:00 | 口頭 | 說明 Phase 2 方向：硬體串接、金流、Provider 端 | 願景 |

### O.4 Demo 失敗 Fallback

| 失敗場景 | 處理 |
|---------|------|
| AI 呼叫失敗 | App 顯示安全文案；同時切換到事先截圖的成功畫面說明 |
| API 超時 | 使用本地 dev 環境作為 backup |
| 資料庫無資料 | 重跑 `pnpm prisma db seed` |
| Expo Go 連不上 | 切換到 iOS/Android 模擬器 |

---

## P. 驗收標準與 Definition of Done

### P.1 模組級驗收

| 模組 | 驗收條件 |
|------|---------|
| 1. 帳號系統 | 註冊/登入/登出正常；JWT 驗證正確；角色判斷正確；ownership 檢查通過 |
| 2. 健康數據 | BP/BG 手動輸入成功；validation 阻擋非法值；異常標記正確；`source` 欄位正確 |
| 3. 趨勢圖表 | 7/30 天切換正確；min/max/avg 計算正確；異常點紅標；空資料顯示 empty state |
| 4. AI 放心報 | 生成成功且通過 Zod 驗證；免責聲明顯示；分享文字正確；fallback 正常；頻率限制生效 |
| 5. 通知 | 量測提醒按時產生；異常提醒正確觸發且不重複；行程提醒 24h 前觸發；已讀/未讀正確 |
| 6. 行程管理 | CRUD 正確；未來 30 天列表正確；過去行程不顯示 |
| 7. 服務需求 | 送出成功；狀態機合法轉換；非法轉換被拒絕；指派後委託人可見 |
| 8. 管理後台 | Dashboard 數據正確；需求單管理完整；CRUD 正常 |
| 9. 服務人員 | 建檔/審核/停用正確；文件上傳成功；下載 pre-signed URL 有效 |
| 10. AI 對話 | 各 task 回應通過 Zod 驗證；禁止內容不出現；頻率限制生效 |

### P.2 系統級驗收

- Demo 劇本 12 步驟全部通過（端到端 happy path）
- 所有 API endpoint 有對應的 route handler test
- lint + typecheck + test + build 全部通過
- 無 `any` type（除已核准例外）
- 無 hardcoded secrets
- 所有環境變數已列入 `.env.example`
- Seed data 可成功載入

### P.3 非功能性驗收

| 項目 | 標準 |
|------|------|
| API P95 回應時間 | < 500ms（排除 AI） |
| AI 生成時間 | < 15 秒 |
| 首頁載入 | < 3 秒（warm start） |
| 錯誤處理 | 所有 API 回傳標準 error envelope；前端顯示人類可讀錯誤 |
| Loading 狀態 | 所有非同步操作皆有 loading indicator |
| Empty 狀態 | 所有列表頁皆有 empty state |

### P.4 測試門檻

| 測試類型 | MVP 目標 |
|---------|---------|
| Route handler tests | 所有 CRUD endpoint 至少覆蓋 happy path + auth + ownership |
| Component tests | 新增量測、送出需求單表單 |
| 整體行覆蓋率 | ≥ 60%（MVP 階段） |

---

## Q. Phase 2/3 方向

> 以下僅列方向，**不屬於 MVP 範圍**，嚴禁在 MVP 階段開發。

### Phase 2

- 硬體串接：藍牙血壓計/血糖機 SDK 整合
- Push Notification（FCM/APNs）
- 服務人員端 App（接單、排程、打卡）
- 金流整合（綠界/藍新）
- 評價系統
- 個人化異常閾值
- 血糖單位 `mmol/L` 支援（API 接受 + 自動轉換 + 前端偏好顯示，見 E.3）
- 多語系（英文）

### Phase 3

- RAG 知識庫（衛教文章、藥品資訊）
- 家屬即時通訊（照護圈聊天）
- 爭議處理與申訴流程
- 保險理賠對接
- 數據分析 Dashboard（B2B）
- AI 長期記憶與個人化建議

---

> **文件結束**。本文件為唯一實作依據，任何變更必須經過 Change Request 流程。
