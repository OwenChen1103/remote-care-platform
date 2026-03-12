# 遠端照護平台 — 實作計畫

> **文件版本**：1.1.0
> **最後更新**：2026-03-12
> **狀態**：定案
> **依據**：implementation-spec.md v1.2.0 + engineering-standards.md v1.2.0

---

## 目錄

- [1. 總覽與排序原則](#1-總覽與排序原則)
- [2. SOP：每次呼叫 Claude 的固定流程](#2-sop每次呼叫-claude-的固定流程)
- [3. Change Request 規則](#3-change-request-規則)
- [4. Slice 定義（0-10，四角色 MVP）](#4-slice-定義010四角色-mvp)
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
| 1 | Auth + 四角色 RBAC | 註冊/登入/JWT/角色導流 | Slice 0 |
| 2 | Recipients + Patient 綁定 | 被照護者 CRUD + patient_user_id | Slice 1 |
| 3 | Measurements + Trends | BP/BG CRUD + 異常判斷 + 統計 | Slice 2 |
| 4 | AI 放心報 + 任務對話 | 報告生成 + 顯示 + 分享 + task chat | Slice 3 |
| 5 | Notifications 通知 | 通知系統 + 提醒 + Cron + 三角色通知 | Slice 3 |
| 6 | Appointments 行程 | 行程 CRUD + caregiver/patient 視角 | Slice 2 |
| 7 | Service Entries + Requests | 8 服務入口 + 需求送出/追蹤 | Slice 2 |
| 8 | Matching Workflow | 平台介入式媒合 + 最小雙向確認 | Slice 7 |
| 9 | Providers + Workspace | 服務人員管理/等級 + provider 工作介面 | Slice 8 |
| 10 | Admin Dashboard 收斂 | 營運總覽 + 四角色端到端 Demo | Slice 9 |

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

## 4. Slice 定義（0-10，四角色 MVP）

### Slice 0：Repo 工程骨架

**目標**：建立可跑 monorepo，CI gate 全綠。  
**最小交付**：workspace、turbo、shared package、web/mobile 空殼、CI、`.env.example`。  
**驗收重點**：`pnpm lint/typecheck/test/build` 全通過。

### Slice 1：Auth + 四角色 RBAC

**目標**：同一登入入口支援 `caregiver/patient/provider/admin`。  
**最小交付**：

- `users.role` 擴展為四角色
- `POST /auth/login`、`GET/PUT /auth/me` 四角色可用
- Admin cookie login guard（Web）
- Mobile 依角色導流到對應 tab layout
- Seed 建立四角色示範帳號

**驗收重點**：

- 不同角色登入後導向正確畫面
- 非 admin 不可進入 `/admin/*`
- token payload 與 RBAC 檢查一致

### Slice 2：Recipients + Patient 綁定

**目標**：完成被照護者資料管理與 patient 身份綁定。  
**最小交付**：

- `recipients.patient_user_id` 欄位與唯一約束
- caregiver CRUD、patient 唯讀（僅可讀綁定本人）
- `/admin/recipients` 唯讀總覽
- ownership middleware 同時支援 caregiver/patient

**驗收重點**：

- patient 無法讀取未綁定 recipient
- caregiver 無法存取他人 recipient

### Slice 3：Measurements + Trends

**目標**：血壓/血糖記錄、異常判斷、7/30 天統計。  
**最小交付**：

- measurements CRUD + stats + export
- caregiver 可新增，patient 僅可讀
- 連續異常通知觸發
- Mobile 趨勢圖與空狀態完整

**驗收重點**：

- 異常判斷與統計值正確
- patient 端能看自己趨勢但無寫入入口

### Slice 4：AI 放心報 + 任務型對話

**目標**：AI 報告與 task chat 上線。  
**最小交付**：

- `POST /ai/health-report`、`GET /ai/reports`、`POST /ai/chat`
- fallback + rate limit + disclaimer
- caregiver 可生成，patient 僅可讀

**驗收重點**：

- 回傳符合 shared schema
- 失敗時 fallback 文案一致

### Slice 5：Notifications（3 角色）

**目標**：in-app 通知覆蓋 caregiver/patient/provider。  
**最小交付**：

- 通知讀取/已讀 API
- 量測提醒與異常通知 cron
- 需求狀態更新通知（含雙向確認事件）

**驗收重點**：

- 三角色皆可看到自己的通知
- 24h 內異常通知不重複發送

### Slice 6：Appointments（Caregiver/Patient）

**目標**：行程管理與 patient 行程唯讀。  
**最小交付**：

- caregiver 行程 CRUD
- patient 可讀綁定本人近期行程
- 30 天排序與提醒連動

### Slice 7：Service Entries + Service Requests

**目標**：8 服務入口與需求送出流程。  
**最小交付**：

- `service_categories` 固定 8 類 seed（含 code）
- caregiver 送出需求單
- caregiver/patient 可追蹤需求進度（唯讀差異）
- Admin 服務類別管理頁

**驗收重點**：

- 8 類入口皆可送出需求
- 類別停用後前台入口自動隱藏

### Slice 8：Matching Workflow（平台介入式媒合）

**目標**：導入候選提案與最小雙向確認。  
**最小交付**：

- 狀態機：`submitted -> screening -> candidate_proposed -> caregiver_confirmed -> provider_confirmed -> arranged -> in_service -> completed/cancelled`
- Admin：提出候選服務人員
- Caregiver：確認/拒絕候選
- Provider：確認接案
- 雙向確認完成後自動 `arranged`

**驗收重點**：

- 非法狀態跳轉回傳 `INVALID_STATE_TRANSITION`
- 候選拒絕後可回到 `screening` 再次媒合

### Slice 9：Providers + Workspace

**目標**：服務人員資料管理、等級制度與工作介面。  
**最小交付**：

- providers CRUD（含 `level`、`availability_status`、審核狀態）
- 文件上傳（presign/confirm/list/download）
- provider 自助頁：`GET/PUT /provider/me`
- provider 任務頁：`GET /provider/tasks`、`GET /provider/tasks/:id`、`PUT /provider/tasks/:id/report`

**驗收重點**：

- 僅 assigned provider 可回報該案件
- level 與 availability 可被後台篩選

### Slice 10：Admin Dashboard 收斂 + 四角色 Demo

**目標**：整合營運摘要與全流程驗收。  
**最小交付**：

- `/admin/dashboard` 關鍵 KPI
- 需求單管理頁完整支援媒合與雙向確認追蹤
- 四角色 Demo 劇本（caregiver/patient/provider/admin）

**驗收重點**：

- Demo 12 步驟全通過
- 主要 API 皆有 route handler tests

### 切片執行規則（追加）

1. Slice 7 以前不得引入自由 marketplace 行為（搶單、競標、即時聊天）。  
2. Slice 8 上線前，需求單只能停留在 `submitted/screening`，不得假實作雙向確認。  
3. Slice 9 前不允許 provider 寫入任何案件狀態。  
4. 任一 Slice 完成後，必須更新 implementation-spec 對應段落與 seed 說明。

---

## 5. 風險總覽與降級策略

### 全域風險

| 風險 | 影響 | 降級方案 |
|------|------|---------|
| 兩人做不完 | 延期 | 先守住 Slice 0-8；Slice 9 文件上傳細節與 Slice 10 Dashboard 進階卡片可延後 |
| OpenAI API 不穩定 | AI 功能不可用 | Fallback 文字 + 預生成的 seed 報告 |
| Supabase 免費額度不足 | DB 連線數超限 | 使用 connection pooling (pgbouncer)，已在 spec 中定案 |
| Expo + Monorepo 衝突 | Mobile 無法啟動 | 獨立 metro.config.js + 指定 node_modules 路徑 |
| Vercel Hobby Plan 限制 | 部署受限 | MVP 先以 localhost demo；需要時升 Pro ($20/mo) |

### MVP 骨架版（最小可 Demo 範圍）

若時間不足，以下為最小可交付範圍（必須完成的 Slice）：

| 優先級 | Slice | 必要性 |
|--------|-------|--------|
| P0 | Slice 0-3 | 四角色基礎 + 核心健康資料閉環 |
| P1 | Slice 4, 7 | AI 差異化 + 8 服務入口需求送出 |
| P1 | Slice 8 | 平台介入式媒合（最小雙向確認） |
| P2 | Slice 5, 6 | 通知 + 行程整合 |
| P2 | Slice 9 | Providers 管理 + 工作介面 |
| P2+ | Slice 10 | Dashboard 進階總覽與完整展示腳本 |

---

> **文件結束**。本計畫與 implementation-spec.md + engineering-standards.md 共同構成實作依據。
