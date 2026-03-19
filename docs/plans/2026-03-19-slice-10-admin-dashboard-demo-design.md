# Slice 10: Admin Dashboard 收斂 + 四角色端到端 Demo — Design

> **日期**：2026-03-19
> **狀態**：Approved
> **Slice 定義來源**：`docs/implementation-plan.md` Slice 10

---

## Goal

整合營運摘要 Dashboard 與全流程驗收，確保 Demo 劇本 12 步驟可端到端通過。

## System Audit Summary

### 已完成（無需改動）

- 37 個 API 路由全部實作
- Admin 頁面：login, service-requests list+detail, providers list+detail, recipients, services
- Admin middleware auth guard（cookie JWT）
- Mobile caregiver confirm flow（`[requestId].tsx` → `handleCaregiverConfirm`）
- Mobile provider confirm flow（`provider-confirm.tsx`）
- Mobile provider tasks + progress flow（Slice 9）
- 3 筆 seed service requests（submitted / candidate_proposed / arranged）
- 4 角色通知 seed data
- Demo 12 步驟的底層 API 均已就位

### 缺口（本 Slice 交付）

| # | 項目 | 現狀 | 目標 |
|---|------|------|------|
| 1 | `GET /api/v1/admin/dashboard` API | 不存在 | 回傳 6 KPI + 2 列表 |
| 2 | Dashboard page | Placeholder（3 張 "—" 卡片） | 6 張即時 KPI 卡片 + 2 個快捷列表 |
| 3 | Admin layout | 空 `<>{children}</>` | Sidebar 導航 + 主內容區 |
| 4 | Seed: Appointments | 缺 | 2 筆行程 |
| 5 | Seed: AI Report | 缺 | 1 筆 weekly report |
| 6 | Dashboard API tests | 缺 | admin 200 / 非 admin 403 / 未登入 401 |

---

## Architecture Decisions

### 1. Admin Layout Sidebar

- 改寫 `apps/web/app/admin/layout.tsx`
- Client component（需 `usePathname` 高亮當前頁）
- 左側 sidebar（w-64）：平台名 + 5 導航 + 登出
- 導航項目：Dashboard、需求單管理、服務人員管理、被照護者總覽、服務類別管理
- Auth guard 由 middleware 處理，layout 不重複驗證

### 2. Dashboard API（方案 A — 單一聚合 API）

- `GET /api/v1/admin/dashboard`
- 角色：admin only
- 回傳結構：

```json
{
  "success": true,
  "data": {
    "stats": {
      "total_caregivers": 15,
      "total_recipients": 22,
      "total_measurements_today": 38,
      "pending_service_requests": 5,
      "pending_provider_reviews": 2,
      "abnormal_alerts_today": 3
    },
    "recent_pending_requests": [
      {
        "id": "...",
        "category_name": "陪診師",
        "recipient_name": "王奶奶",
        "preferred_date": "2026-03-22T00:00:00Z",
        "created_at": "2026-03-19T10:00:00Z"
      }
    ],
    "recent_abnormal_alerts": [
      {
        "id": "...",
        "title": "王奶奶 血壓連續異常",
        "body": "...",
        "created_at": "2026-03-19T09:00:00Z"
      }
    ]
  }
}
```

- 實作：`Promise.all` 並行 8 個 Prisma 查詢（6 counts + 2 findMany）

### 3. Dashboard Page

- Client component，`useEffect` + `fetch`
- 上方：6 stat cards（responsive grid 1/2/3 cols）
- 下方：2 列表並排（recent pending requests + recent abnormal alerts）
- 卡片點擊可跳轉（待處理需求單 → detail page）
- Loading / Error / Empty 三態處理

### 4. Seed 補齊

- `seedAppointments(recipientId)`：
  - 台大醫院心臟內科（now + 7 天）
  - 國泰醫院新陳代謝科（now + 14 天）
- `seedAiReport(recipientId)`：
  - 1 筆 weekly report（status_label: '需留意'）
  - 硬編碼 summary / reasons / suggestions
  - model: 'seed-data'

### 5. Tests

- `apps/web/__tests__/admin-dashboard.test.ts`
- Admin → 200 + 驗證 stats 結構完整
- 非 admin → 403
- 未登入 → 401

---

## Out of Scope

- Mobile 角色分離 tab groups（G.2.1 — 延至 Phase 2）
- Provider 文件上傳（risk table 已延後）
- 額外 service-request 列表篩選（已在 Slice 7 完成）

---

## Demo 12 步驟可行性確認

| 步驟 | 操作 | 狀態 |
|------|------|------|
| 1 | Caregiver 登入 | ✅ 已完成 |
| 2 | 查看被照護者 | ✅ 已完成 |
| 3 | 新增被照護者 | ✅ 已完成 |
| 4 | 新增血壓量測 | ✅ 已完成 |
| 5 | 趨勢圖表 | ✅ 已完成 |
| 6 | AI 放心報 | ✅ 已完成（seed 補 1 筆報告） |
| 7 | 分享報告 | ✅ 已完成 |
| 8 | 新增行程 | ✅ 已完成（seed 補 2 筆行程） |
| 9 | 送出服務需求 | ✅ 已完成 |
| 10 | Admin dashboard + 提出候選 | ⬅️ **本 Slice 交付** |
| 11 | Caregiver 確認 + Provider 確認 | ✅ 已完成 |
| 12 | Provider 完成任務 | ✅ 已完成 |
