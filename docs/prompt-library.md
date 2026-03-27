# Remote Care Platform — AI Agent Prompt Library

> **Version**: 1.1.0
> **Last Updated**: 2026-03-27
> **Purpose**: 為團隊成員與 AI agent 設計的標準化 Prompt 庫。每個 Prompt 都強制 AI 先理解專案架構、規範與限制，再進行任何修改。適用於 Claude Code、Cursor、Copilot 等 AI 工具。

---

## 使用方式

### 基本流程

1. **選擇場景** — 根據你要做的事，從下方目錄找到對應的 Prompt（P-00 ~ P-15）
2. **複製整段 Prompt** — 複製 ` ``` ` code block 裡面的**全部內容**
3. **填入你的需求** — 找到 `{{雙大括號}}` 的地方，替換成你的具體描述（中英文皆可）
4. **貼進 AI 工具** — 作為第一則訊息貼進 Claude Code / Cursor / Copilot Chat
5. **讓 AI 先回答檢查項** — AI 會先分析現有系統、回報檢查結果，確認沒問題後才開始寫程式

### `{{placeholder}}` 填寫對照表

| Prompt | 找到這行 | 替換成 |
|--------|---------|--------|
| P-00 完整閱讀 | （無 placeholder — 直接貼即可） | — |
| P-01 新功能 | `{{描述你要實作的功能}}` | 功能的具體描述 |
| P-02 修 Bug | `{{描述 Bug：發生什麼、預期行為、你覺得在哪裡}}` | Bug 的現象與上下文 |
| P-03 新 API 端點 | `{{描述：HTTP method、路徑、用途、哪個角色呼叫、回傳什麼}}` | API 的完整描述 |
| P-04 新畫面/元件 | `{{描述：畫面或元件、顯示什麼、打哪些 API、在哪個使用流程}}` | UI 的功能描述 |
| P-05 AI 功能修改 | `{{描述：哪個 AI 功能、改什麼邏輯、為什麼}}` | AI 相關的變更 |
| P-06 Code Review | `{{描述：特定檔案、PR diff、或「審查整個 codebase」}}` | 審查範圍 |
| P-07 重構 | `{{描述：哪些檔案/模組、什麼問題、期望狀態}}` | 重構目標 |
| P-08 寫測試 | `{{描述：哪個模組/函式/端點、涵蓋哪些場景}}` | 測試目標 |
| P-09 除錯 | `{{描述：發生什麼、錯誤訊息、哪個畫面/API、重現步驟}}` | 問題描述 |
| P-10 Service Request 工作流 | `{{描述：要修改工作流的哪個環節、為什麼}}` | 工作流變更 |
| P-11 資料庫 Schema 變更 | `{{描述：要加/改/刪哪些欄位或 model、為什麼}}` | Schema 變更 |
| P-12 提交前檢查 | `{{列出你改了哪些檔案，或說「check git diff」}}` | 檔案清單 |
| P-13 文件更新 | `{{描述：改了什麼程式碼、哪個 PR 或 commit}}` | 變更內容 |
| P-14 新人上手 | （無 placeholder — 直接貼即可） | — |
| P-15 UI/UX 優化 | `{{描述：哪些畫面、什麼問題、期望的視覺/體驗效果}}` | UI 優化目標 |

### 注意事項

- **你的需求描述**可以用中文寫，AI 讀得懂
- **Prompt 本體**（code block 裡的規則指令）保持原樣不要修改
- 這些 Prompt 會要求 AI 先讀 `implementation-spec.md` 和 `engineering-standards.md`，專案裡必須有這兩個檔案
- AI 會先回答「檢查項」再開始寫程式 — **這是設計好的**，不要跳過

---

## 目錄

- [P-00: 完整閱讀專案（開工前必用）](#p-00-完整閱讀專案開工前必用)
- [P-01: 新功能開發](#p-01-新功能開發)
- [P-02: 修 Bug](#p-02-修-bug)
- [P-03: 新 API 端點](#p-03-新-api-端點)
- [P-04: 新畫面 / 元件（Mobile 或 Web Admin）](#p-04-新畫面--元件mobile-或-web-admin)
- [P-05: AI 功能修改](#p-05-ai-功能修改)
- [P-06: Code Review / 審查](#p-06-code-review--審查)
- [P-07: 重構](#p-07-重構)
- [P-08: 寫測試](#p-08-寫測試)
- [P-09: 除錯調查](#p-09-除錯調查)
- [P-10: Service Request 工作流修改](#p-10-service-request-工作流修改)
- [P-11: 資料庫 Schema 變更](#p-11-資料庫-schema-變更)
- [P-12: 提交前自我檢查](#p-12-提交前自我檢查)
- [P-13: 文件更新](#p-13-文件更新)
- [P-14: 新人上手 — 系統深度理解](#p-14-新人上手--系統深度理解)
- [P-15: UI/UX 優化與視覺打磨](#p-15-uiux-優化與視覺打磨)
- [Claude Code Skill 使用指南](#claude-code-skill-使用指南)

---

## P-00: 完整閱讀專案（開工前必用）

使用時機：每次開新對話時先貼這個，讓 AI agent 完整理解專案後再接受任務。

> 無 `{{placeholder}}`，直接複製貼上即可。

```
你是一個資深全端工程師，即將在 Remote Care Platform（遠端照護平台）專案上工作。在接受任何任務之前，你必須完整理解這個 codebase。不要跳過任何步驟，不要摘要——完整閱讀。

## Phase 1: 閱讀核心文件（必讀——每一行都要讀）

依序閱讀以下文件，它們是整個系統的唯一真相來源（Single Source of Truth）：

1. **docs/implementation-spec.md** — 系統的「做什麼」。
   包含：架構設計、完整資料模型、所有 API 端點合約、AI 整合設計、四角色 RBAC 規則、Service Request 狀態機、已知限制。

2. **docs/engineering-standards.md** — 開發的「怎麼做」。
   包含：不可妥協的品質門檻、專案結構規則、命名規範、API 標準、安全標準、測試策略、git 工作流、anti-patterns。

3. **docs/prompt-library.md** — 瀏覽目錄，知道有哪些任務型 Prompt 可用。

## Phase 2: 閱讀關鍵程式碼

### Monorepo 結構
- package.json（根目錄）— workspace 設定與全域 scripts
- turbo.json — build 編排
- pnpm-workspace.yaml — workspace 定義

### 共享合約（Single Source of Truth）
- packages/shared/src/index.ts — 所有匯出一覽
- packages/shared/src/schemas/ — 所有 9 個 Zod schema 檔案（auth, recipient, measurement, service-request, provider, api-response, ai, notification, appointment）
- packages/shared/src/constants/ — 所有 4 個常數檔案（enums, error-codes, status-display, thresholds）

### 後端核心（apps/web）
- apps/web/prisma/schema.prisma — 完整資料庫 schema（12 models）
- apps/web/prisma/seed.ts — Demo 種子資料
- apps/web/lib/auth.ts — JWT 驗證（signJwt, verifyAuth）
- apps/web/lib/api-response.ts — 統一回應封裝（successResponse, errorResponse, paginatedResponse）
- apps/web/lib/csrf.ts — CSRF/Origin 驗證（checkOrigin）
- apps/web/lib/ai.ts — AI 整合 + fallback 機制
- apps/web/lib/ai-prompts.ts — LLM prompt 模板
- apps/web/lib/abnormal-notification.ts — 連續異常通知邏輯
- apps/web/middleware.ts — Admin 路由保護

### 行動端核心（apps/mobile）
- apps/mobile/app/(tabs)/_layout.tsx — 角色分流 tab 導航（最重要的路由檔）
- apps/mobile/lib/api-client.ts — HTTP client（所有 API 呼叫的唯一入口）
- apps/mobile/lib/auth-context.tsx — 認證狀態管理
- apps/mobile/lib/theme.ts — 設計 token（顏色、字型、間距、圓角、陰影）
- apps/mobile/components/ui/ — 共用 UI 元件（Card, StatusPill, EmptyState, ErrorState, Toast, TrendChart）

## Phase 3: 確認準備就緒

閱讀完所有檔案後，提供結構化摘要確認你已準備好：

### 1. 架構摘要
- Tech stack 是什麼？（Web framework, Mobile framework, DB, ORM, AI, Auth）
- Monorepo 有幾個 workspace？各自的職責？
- packages/shared 匯出哪些主要類別？

### 2. 四角色 RBAC
分別描述 caregiver、patient、provider、admin 的：
- 可存取的畫面/tab
- 可執行的寫入操作
- 資料隔離規則

### 3. 你將嚴格遵守的關鍵規則
列出 engineering-standards.md 中你認為最重要的 10 條規則，並說明為什麼重要。

### 4. 你絕對不會做的事
明確確認：
- "我不會在 apps/mobile 或 apps/web 中重複定義 types/schemas——一律從 @remote-care/shared 匯入"
- "我不會在 API handler 中跳過 verifyAuth() 或 checkOrigin()"
- "我不會硬編碼 threshold 數值——一律從 shared/constants/thresholds.ts 讀取"
- "我不會在使用者介面中使用英文——所有面向使用者的文字必須是繁體中文"
- "我不會建立新的 HTTP client 或 fetch wrapper——mobile 用 api-client.ts，web 用 fetch"
- "我不會直接修改 ServiceRequest status——必須經過 VALID_STATUS_TRANSITIONS 驗證"
- "我不會在 AI 回應中提供藥物名稱、診斷建議或治療方案"
- "我不會建立 migration 之外的 raw SQL"

### 5. 準備接受任務
完成以上所有步驟後，說：「系統已完整閱讀，準備接受任務。」

從這一刻起，我會給你具體任務。每個任務你必須：
1. 先檢查現有程式碼是否已處理（避免重複）
2. 確認影響範圍（哪些檔案、哪些角色、哪些 API）
3. 先展示計畫再寫程式碼
4. 所有程式碼的變數/函式/註解使用英文，使用者介面文字使用繁體中文
5. 如果修改了 API/Model/Schema，同步更新 implementation-spec.md
```

---

## P-01: 新功能開發

使用時機：為平台新增功能。

```
你正在 Remote Care Platform 專案上工作。在寫任何程式碼之前，你必須完成以下必要步驟：

## Step 1: 閱讀專案規範（必要）
完整閱讀以下兩個檔案再繼續：
- docs/implementation-spec.md（系統的「做什麼」—— 架構、資料模型、API 合約、狀態機）
- docs/engineering-standards.md（開發的「怎麼做」—— 品質門檻、anti-patterns、嚴格規則）

特別注意：
- 四角色 RBAC 規則（caregiver, patient, provider, admin 各自能做什麼）
- packages/shared 是所有 schema/type 的唯一來源
- 所有面向使用者的文字必須是繁體中文（zh-TW）

## Step 2: 範圍檢查（必要）
我要實作的功能是：{{描述你要實作的功能}}

在寫任何程式碼之前，回答以下問題：
1. 這個功能影響哪些角色？（caregiver / patient / provider / admin）
2. 現有的端點、服務、元件或工具是否已經處理了這個功能或類似功能？徹底搜尋 codebase。
3. 哪些現有檔案需要修改？列出來。
4. 是否需要建立新檔案？說明為什麼不能擴展現有檔案。
5. 是否需要新的 Zod schema？如果是，必須先在 packages/shared 中定義。

## Step 3: 影響分析（必要）
確認以下哪些受影響：
- [ ] Prisma Schema（哪些 model？需要 migration 嗎？）
- [ ] packages/shared schemas（哪些？）
- [ ] packages/shared constants（哪些？）
- [ ] API routes — apps/web/app/api/（哪些？）
- [ ] Mobile 畫面 — apps/mobile/app/（哪些？）
- [ ] Mobile 元件 — apps/mobile/components/（哪些？）
- [ ] Web Admin 頁面 — apps/web/app/admin/（哪些？）
- [ ] lib 工具函式（哪些？）
- [ ] 測試檔案（哪些？）
- [ ] implementation-spec.md（哪些章節需要更新？）

## Step 4: 實作
只有完成 Steps 1-3 後才能開始實作，且必須遵守以下規則：

### Schema 規則
- 新的 type/schema 必須在 packages/shared 中定義，再由 apps 匯入
- 使用 Zod discriminated union 處理多型態（如 measurement type）
- 新的常數/enum 加到 packages/shared/src/constants/

### API 規則
- 所有新端點放在 apps/web/app/api/v1/ 下
- 每個 handler 必須呼叫 verifyAuth(request) 取得 userId + role
- 寫入操作必須呼叫 checkOrigin(request) 做 CSRF 檢查
- 使用 successResponse() / errorResponse() / paginatedResponse() 回傳
- 驗證輸入必須使用 Zod schema 的 safeParse()
- 資料存取必須檢查 ownership（caregiver 只能存取自己的 recipient）

### Mobile 規則
- 所有 API 呼叫透過 lib/api-client.ts（get/post/put/delete）
- 新畫面放在 apps/mobile/app/(tabs)/ 對應角色的資料夾下
- 使用 lib/theme.ts 的設計 token（不要硬編碼顏色/字型/間距）
- 每個資料載入畫面必須處理三態：loading / error / empty
- 使用共用 UI 元件（Card, StatusPill, EmptyState, ErrorState, Toast）

### 語言規則
- 程式碼（變數、函式、註解）：英文
- 使用者介面文字（標題、按鈕、提示、錯誤訊息）：繁體中文

## Step 5: 規範更新
實作完成後，更新 implementation-spec.md 中相關的章節（API 合約、model 變更等）。

先展示你的 Step 2 和 Step 3 分析，經確認後再開始寫程式碼。
```

---

## P-02: 修 Bug

使用時機：修復已知的 bug 或非預期行為。

```
你正在 Remote Care Platform 專案上修 bug。

## 必讀文件
先閱讀這些檔案：
- docs/implementation-spec.md — 聚焦在與 bug 相關的章節
- docs/engineering-standards.md — 聚焦在 Anti-Pattern 目錄

## Bug 描述
{{描述 Bug：發生什麼、預期行為、你覺得在哪裡}}

## 調查流程
在寫任何修復之前：

1. **根因分析**：閱讀相關原始碼。從頭到尾追蹤資料流。找到 bug 發生的確切行數。不要猜測——展示證據。

2. **資料流追蹤**（完整追蹤）：
   - Mobile：哪個元件觸發操作？呼叫 api-client.ts 的哪個方法？
   - API Route：哪個 route handler 接收？跑了哪些 middleware？
   - Backend 邏輯：查詢了哪些 Prisma model？驗證了什麼？
   - 回應：回傳什麼？Mobile 端怎麼處理回應？

3. **常見陷阱**（逐項檢查）：
   - verifyAuth() 是否正確呼叫？角色檢查是否正確？
   - Zod schema 驗證是否匹配實際送來的資料格式？
   - Prisma 查詢的 where 條件是否正確過濾 ownership？
   - recipient.deleted_at 是否有被檢查（軟刪除）？
   - ServiceRequest status transition 是否在 VALID_STATUS_TRANSITIONS 白名單中？
   - API response envelope 格式是否正確（success/data/error）？
   - mobile api-client.ts 解析 response 的方式是否對應 backend 的回傳格式？

4. **現有程式碼檢查**：是否已有修復或 workaround 存在？徹底搜尋。

5. **修復方案**：描述最小的修改。修復應該：
   - 是能解決問題的最小變更
   - 不要重構周圍的程式碼（修 bug，不做其他事）
   - 不要引入新檔案除非絕對必要
   - 包含或更新相關測試

6. **回歸檢查**：修復後哪些現有測試必須仍然通過？需要新測試嗎？

先展示你的根因分析（Step 1-3），經確認後再寫修復程式碼。
```

---

## P-03: 新 API 端點

使用時機：新增後端 API 端點。

```
你正在 Remote Care Platform 專案上新增 API 端點。

## 必讀文件
完整閱讀：
- docs/implementation-spec.md — 特別是 API 合約章節和資料模型章節
- docs/engineering-standards.md — 特別是 API 標準和安全標準

## 端點描述
{{描述：HTTP method、路徑、用途、哪個角色呼叫、回傳什麼}}

## 實作前檢查清單（必要——每項都要回答）

1. **重複檢查**：是否已存在處理同樣用途的端點？
   - 搜尋 apps/web/app/api/v1/ 所有 route.ts 檔案
   - 搜尋 implementation-spec.md 的 API 合約章節
   - 回答：「我確認沒有現有端點處理此功能，因為：___」

2. **路由路徑**：應該放在哪個 route 檔案？（優先新增到現有檔案，避免建立新檔案）
   路徑必須遵循：/api/v1/{resource}/{action}

3. **認證需求**：
   - 是否需要認證？→ 使用 `const { userId, role } = await verifyAuth(request)`
   - 是否需要 ownership 檢查？→ 驗證 caregiver_id === userId 或 patient_user_id
   - 哪些角色可以存取？（caregiver / patient / provider / admin）
   - 寫入操作是否呼叫 `checkOrigin(request)`？

4. **輸入驗證**：
   - 需要哪些欄位？驗證規則是什麼？
   - Zod schema 是否已存在於 packages/shared？如果不存在，先在 shared 中建立。

5. **回應格式**：必須使用標準封裝：
   ```typescript
   // 成功
   return successResponse(data, 201) // 或 200
   // 分頁
   return paginatedResponse(items, { page, limit, total })
   // 錯誤
   return errorResponse('ERROR_CODE', '錯誤訊息', 400, details)
   ```

6. **錯誤代碼**：使用 packages/shared 中定義的 ERROR_CODES，不要發明新的。如果確實需要新代碼，先加到 shared/constants/error-codes.ts。

## 實作模板

```typescript
import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { checkOrigin } from '@/lib/csrf';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { YourSchema } from '@remote-care/shared';

export async function POST(request: NextRequest) {
  try {
    const originError = checkOrigin(request);
    if (originError) return originError;

    const { userId, role } = await verifyAuth(request);
    if (role !== 'caregiver') {
      return errorResponse('AUTH_FORBIDDEN', '權限不足', 403);
    }

    const body = await request.json();
    const parsed = YourSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', '輸入驗證失敗', 400,
        parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
      );
    }

    // ownership check, business logic, Prisma operations...
    const result = await prisma.yourModel.create({ data: { ... } });

    return successResponse(result, 201);
  } catch (error) {
    return errorResponse('SERVER_ERROR', '伺服器錯誤', 500);
  }
}
```

## 實作後
- 更新 implementation-spec.md 的 API 合約章節
- 在 apps/web/__tests__/ 新增對應的測試檔案
- 確認 `pnpm typecheck` 和 `pnpm test` 通過

先展示你的檢查清單回答，經確認後再寫程式碼。
```

---

## P-04: 新畫面 / 元件（Mobile 或 Web Admin）

使用時機：新增 Mobile 畫面或 Web Admin 頁面。

```
你正在 Remote Care Platform 專案上新增 UI 畫面或元件。

## 必讀文件
- docs/implementation-spec.md — 畫面規格和角色定義
- docs/engineering-standards.md — 前端標準
- docs/visual-direction-v1.md — 設計語言與視覺方向

## 我需要的畫面/元件
{{描述：畫面或元件、顯示什麼、打哪些 API、在哪個使用流程}}

## 實作前檢查清單（必要）

1. **重複檢查**：是否已存在類似的元件或畫面？
   - 搜尋 apps/mobile/app/(tabs)/（Mobile 畫面）
   - 搜尋 apps/mobile/components/（共用元件）
   - 搜尋 apps/web/app/admin/（Web Admin 頁面）
   - 回答：「我確認沒有現有元件處理此功能，因為：___」

2. **角色歸屬**：這個畫面屬於哪個角色？
   - Caregiver → apps/mobile/app/(tabs)/home/ 或 health/ 或 services/ 或 ai/
   - Patient → apps/mobile/app/(tabs)/patient/
   - Provider → apps/mobile/app/(tabs)/services/provider-*.tsx
   - Admin → apps/web/app/admin/

3. **API 依賴**：需要哪些 API 端點？
   - 列出每個 API 呼叫（method + path）
   - 確認每個端點已在後端實作
   - Mobile 所有呼叫必須透過 lib/api-client.ts

4. **路由註冊**（畫面）：
   - Mobile：Expo Router 檔案路由，放在正確的 (tabs) 子目錄
   - 如果是隱藏路由（詳情頁），需要在 _layout.tsx 中加入 href: null
   - Web Admin：放在 apps/web/app/admin/ 下

5. **三態處理**：每個資料載入畫面必須處理：
   - Loading 狀態（ActivityIndicator 或 skeleton）
   - Error 狀態（ErrorState 元件 + 重試按鈕）
   - Empty 狀態（EmptyState 元件 + 引導文字）

## Mobile 實作規則
- 使用 lib/theme.ts 的設計 token：
  - 顏色：colors.primary, colors.semantic.success, colors.gray[600] 等
  - 字型：typography.headingLg, typography.bodyMd 等
  - 間距：spacing.sm, spacing.md, spacing.lg 等
  - 圓角：radius.md, radius.lg 等
- 使用共用 UI 元件（Card, StatusPill, EmptyState, ErrorState, Toast）
- 所有使用者面文字使用繁體中文
- 使用 useCallback + useEffect 做資料載入
- 使用 FlatList 處理列表（而非 ScrollView + map）
- 處理 KeyboardAvoidingView（iOS 鍵盤遮擋問題）

## Web Admin 實作規則
- 使用 'use client' 標記 client component
- 使用 Tailwind CSS 做樣式
- 資料表格使用 table 元素，支援分頁
- 使用 fetch() 直接呼叫 API（帶 credentials: 'include'）
- 狀態 badge 使用 status-display.ts 中的 twClasses

## 共用元件規則
- 新共用元件放在 apps/mobile/components/ui/
- 必須接受 style prop 以支援外部樣式覆蓋
- 使用 TypeScript interface 定義 props
- 在 components/ui/index.ts 中匯出

先展示你的檢查清單回答，經確認後再寫程式碼。
```

---

## P-05: AI 功能修改

使用時機：修改 AI 健康報告、對話、或助理功能。

```
你正在 Remote Care Platform 上修改 AI 功能。這是系統中最敏感的部分之一。

## 必讀文件（必讀——不可跳過）
- docs/implementation-spec.md — AI 整合章節的所有小節
- packages/shared/src/schemas/ai.ts — AI 的所有 Zod schema 和輸出驗證
- apps/web/lib/ai.ts — AI 核心邏輯（callOpenAI, generateReport, generateChat, fallback）
- apps/web/lib/ai-prompts.ts — LLM prompt 模板和系統規則
- apps/web/lib/ai-rate-limit.ts — 速率限制

## 變更描述
{{描述：哪個 AI 功能、改什麼邏輯、為什麼}}

## 實作前檢查清單（必要）

1. **醫療安全規則（不可妥協）**：
   你的變更是否可能導致 AI 輸出以下任何內容？如果是，**立即停止**。
   - ❌ 藥物名稱或劑量
   - ❌ 診斷性陳述（「你可能有...」）
   - ❌ 處方或治療建議
   - ❌ 緊急醫療建議
   - ❌ 心理診斷
   - ❌ 臨床術語（必須用白話文）

2. **輸出 Schema 檢查**：
   - AI 輸出是否仍然通過 packages/shared/src/schemas/ai.ts 中定義的 Zod schema 驗證？
   - 如果修改了輸出結構，必須同步更新 shared schema。
   - AI_OUTPUT_SCHEMAS 和 AI_CHAT_OUTPUT_SCHEMAS 的 mapping 是否更新？

3. **Fallback 機制**：
   - 你的變更是否影響 REPORT_FALLBACKS 或 CHAT_FALLBACKS？
   - 如果新增了 report_type 或 chat task，必須同時新增 fallback 回應。
   - Fallback 必須是有意義的繁體中文內容（不是空字串）。

4. **速率限制**：
   - 你的變更是否影響 rate limit 邏輯？
   - Report: 每小時 3 次（per userId:recipientId:reportType）
   - Chat: 每小時 10 次（per userId）
   - 如果新增端點，需要加入速率限制。

5. **Disclaimer**：
   - AI_DISCLAIMER 是否仍然附加在所有 AI 回應中？
   - Disclaimer 不可被移除或修改。

6. **Prompt 安全**：
   - 系統 prompt 中的 SYSTEM_RULES（apps/web/lib/ai-prompts.ts）是否保持完整？
   - 是否有 prompt injection 風險？（使用者輸入是否被安全處理？）

## 實作規則
- AI 回應語言：繁體中文（zh-TW）
- JSON mode 必須啟用（response_format: { type: 'json_object' }）
- 所有 AI 呼叫必須有 timeout（AI_LIMITS.TIMEOUT_MS = 15000）
- 失敗必須 gracefully degrade 到 fallback，不可讓使用者看到錯誤
- Token 使用量必須記錄到 DB（input_tokens, output_tokens）

## 測試
- 更新 apps/web/__tests__/ai.test.ts
- 更新 packages/shared/src/__tests__/ai.test.ts（如果修改了 schema）
- 測試 fallback 路徑
- 測試 rate limit 路徑

先展示你的檢查清單回答，經確認後再修改任何程式碼。
```

---

## P-06: Code Review / 審查

使用時機：請 AI 審查程式碼品質、找 bug、或審查 PR。

```
你是 Remote Care Platform 專案的資深 code reviewer。

## 必讀上下文
閱讀以下檔案以理解專案標準：
- docs/implementation-spec.md — 完整系統規範
- docs/engineering-standards.md — 所有編碼標準

## 審查範圍
{{描述：特定檔案、PR diff、或「審查整個 codebase」}}

## 審查檢查清單（每項都要檢查）

### 正確性
- [ ] 程式碼是否與 implementation-spec.md 中的規範一致？
- [ ] Prisma 查詢的 where 條件是否正確過濾 ownership？
- [ ] API response envelope 格式是否正確？（{ success, data } 或 { success, error }）
- [ ] Zod schema 驗證是否在所有輸入上執行？
- [ ] ServiceRequest status transition 是否在 VALID_STATUS_TRANSITIONS 白名單中？
- [ ] 軟刪除的 entity（recipient, provider）是否有 deleted_at 過濾？

### 安全性
- [ ] 沒有硬編碼的 secrets、API keys 或 IP 位址
- [ ] 沒有在 API response 中暴露 password_hash
- [ ] 沒有在 production response 中暴露 error stack
- [ ] 所有受保護的端點都有 verifyAuth() middleware
- [ ] 寫入端點都有 checkOrigin() CSRF 保護
- [ ] 角色檢查正確（caregiver/patient/provider/admin 各自的權限）
- [ ] AI 回應不包含醫療建議、藥物名稱或診斷

### 標準合規
- [ ] 所有 type/schema 定義在 packages/shared（不在 apps 中重複定義）
- [ ] 所有常數來自 packages/shared/src/constants/（不硬編碼）
- [ ] Mobile API 呼叫透過 api-client.ts（不直接使用 fetch）
- [ ] 使用 theme.ts 設計 token（不硬編碼顏色/字型/間距）
- [ ] 使用者面文字是繁體中文
- [ ] 程式碼沒有 `any` type
- [ ] 沒有 console.log 殘留
- [ ] 沒有註解掉的程式碼

### 架構
- [ ] 新 API 路由放在 /api/v1/ 下
- [ ] 新 Mobile 畫面放在正確的角色目錄下
- [ ] 共用邏輯放在 packages/shared 或 lib/
- [ ] 沒有循環依賴

### 資料庫
- [ ] Prisma schema 變更有對應的 migration
- [ ] 新 model 有適當的 index
- [ ] JSON 欄位有預設值（default: []）

### 測試
- [ ] 新功能有對應的測試
- [ ] 測試覆蓋 happy path + error path
- [ ] Mock 合理（不 mock 過多，不 mock 過少）

輸出格式：
| # | 嚴重度 | 檔案:行數 | 問題 | 建議 |
|---|--------|----------|------|------|
```

---

## P-07: 重構

使用時機：重組或清理現有程式碼而不改變行為。

```
你正在 Remote Care Platform 上重構程式碼。

## 必讀文件
- docs/implementation-spec.md — 理解必須保留的當前行為
- docs/engineering-standards.md — 理解目標標準

## 重構目標
{{描述：哪些檔案/模組、什麼問題、期望狀態}}

## 重構規則（關鍵）

1. **行為保留**：外部行為不可改變。相同輸入 → 相同輸出。相同 API contract。相同 UI 行為。

2. **不可偏離範圍**：只重構被要求的部分。不要：
   - 修你偶然發現的不相關 bug（改為記錄下來）
   - 在重構時加入新功能
   - 改變 API contract
   - 改變 Prisma schema
   - 改變共用 schema/type 的對外介面

3. **現有程式碼優先**：在建立新抽象或工具之前：
   - 檢查 codebase 中是否已存在相同的 pattern
   - 重用現有 pattern 而不是發明新的
   - 如果有 3 行相似的程式碼，那很正常——不要建立過早抽象

4. **測試驗證**：所有現有測試必須在重構後通過。執行 `pnpm test`。

5. **語言規則**：程式碼英文，使用者面文字繁體中文。

## 輸出格式
對每個變更，展示：
1. BEFORE（當前程式碼）
2. AFTER（重構後程式碼）
3. WHY（這改善了什麼標準合規性）
4. RISK（什麼可能壞掉，以及你如何驗證不會壞）
```

---

## P-08: 寫測試

使用時機：新增測試或改善測試覆蓋率。

```
你正在 Remote Care Platform 上寫測試。

## 必讀文件
- docs/engineering-standards.md — 測試策略章節
- docs/implementation-spec.md — 與測試目標相關的章節

## 測試目標
{{描述：哪個模組/函式/端點、涵蓋哪些場景}}

## 測試架構

### 後端測試（apps/web）
- Framework: Vitest
- 檔案位置: apps/web/__tests__/
- Mock 策略: vi.hoisted() + vi.mock() for Prisma, auth, csrf
- 已有 14 個測試檔案，~150+ test cases

### 共享套件測試（packages/shared）
- Framework: Vitest
- 檔案位置: packages/shared/src/__tests__/ 和 packages/shared/__tests__/
- 純 schema 驗證測試，不需要 mock
- 已有 9 個測試檔案，~120+ test cases

### Mobile 測試（apps/mobile）
- Framework: Jest + jest-expo
- 檔案位置: apps/mobile/__tests__/
- 目前只有 1 個 smoke test（這是已知的覆蓋率缺口）

## 後端 API 測試模板

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies using vi.hoisted
const mockPrisma = vi.hoisted(() => ({
  yourModel: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/csrf', () => ({ checkOrigin: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  verifyAuth: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'caregiver' }),
}));

import { GET, POST } from '@/app/api/v1/your-route/route';

describe('GET /api/v1/your-route', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return data for authenticated user', async () => {
    mockPrisma.yourModel.findMany.mockResolvedValue([/* test data */]);
    mockPrisma.yourModel.count.mockResolvedValue(1);

    const request = new Request('http://localhost/api/v1/your-route?page=1&limit=20');
    const response = await GET(request);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(response.status).toBe(200);
  });

  it('should reject unauthenticated request', async () => {
    const { verifyAuth } = await import('@/lib/auth');
    vi.mocked(verifyAuth).mockRejectedValueOnce(new Error('AUTH_REQUIRED'));
    // ...
  });
});
```

### 共享 Schema 測試模板

```typescript
import { describe, it, expect } from 'vitest';
import { YourSchema } from '../schemas/your-schema';

describe('YourSchema', () => {
  it('should accept valid input', () => {
    const result = YourSchema.safeParse({ /* valid data */ });
    expect(result.success).toBe(true);
  });

  it('should reject invalid input', () => {
    const result = YourSchema.safeParse({ /* invalid data */ });
    expect(result.success).toBe(false);
  });
});
```

## 測試要求
- 覆蓋 happy path 和 error path
- 測試角色限制（每個端點測試正確角色和錯誤角色）
- 測試 ownership 檢查
- 測試 validation 錯誤
- 測試 pagination
- 測試 state transition 限制（如果有）
- 所有測試程式碼和 describe/it 描述使用英文

## 執行測試
```bash
pnpm test          # 跑所有 workspace 的測試
cd apps/web && pnpm test   # 只跑後端測試
cd packages/shared && pnpm test  # 只跑 shared 測試
```
```

---

## P-09: 除錯調查

使用時機：系統有問題，需要 AI 協助診斷。

```
你是 Remote Care Platform 的資深除錯工程師。

## 上下文文件（先讀）
- docs/implementation-spec.md — 預期行為
- docs/engineering-standards.md — 標準和 anti-patterns

## 問題描述
{{描述：發生什麼、錯誤訊息、哪個畫面/API、重現步驟}}

## 調查流程

1. **資料流追蹤**：追蹤完整的 request/response 流程：
   - Mobile 端：哪個畫面觸發？呼叫 api-client.ts 的哪個方法？帶什麼參數？
   - API Route：哪個 route handler 接收？verifyAuth 的結果？
   - Prisma 查詢：執行了什麼 query？where 條件是什麼？回傳什麼？
   - Response：回傳什麼 status code 和 body？Mobile 端怎麼處理？

2. **常見陷阱**（逐項檢查）：
   - [ ] JWT token 是否有效且未過期？（7 天到期）
   - [ ] api-client.ts 是否正確附加 Authorization header？
   - [ ] verifyAuth 是否正確解析 Bearer token？
   - [ ] Zod safeParse 是否失敗？（檢查 VALIDATION_ERROR response）
   - [ ] Prisma 查詢是否有 ownership 過濾？
   - [ ] recipient.deleted_at 是否為 null？（軟刪除）
   - [ ] ServiceRequest status 是否在允許的 transition 範圍？
   - [ ] AI 呼叫是否因 rate limit 或 timeout 而失敗？
   - [ ] ai_interactions table 是否存在？（已知問題：migration 中缺少此表）
   - [ ] CORS/Origin 是否正確設定？（localhost:3000, localhost:8081）

3. **證據**：展示 bug 發生的確切程式碼行數，附上 file path 和 line number。

4. **修復方案**：最小的修改來解決問題。遵循所有 engineering-standards.md 規則。

不要猜測。只回報有程式碼證據支持的發現。
```

---

## P-10: Service Request 工作流修改

使用時機：修改 Service Request 的狀態機或匹配工作流。

```
你正在 Remote Care Platform 上修改 Service Request 工作流。這是系統最複雜的業務邏輯之一。

## 必讀文件（全部必讀）
- docs/implementation-spec.md — Service Request 狀態機章節
- packages/shared/src/constants/enums.ts — SERVICE_REQUEST_STATUSES + VALID_STATUS_TRANSITIONS
- packages/shared/src/schemas/service-request.ts — 所有相關 Zod schemas
- apps/web/app/api/v1/service-requests/ — 所有 route handlers（7+ 檔案）
- apps/mobile/app/(tabs)/services/ — 所有 mobile 畫面
- apps/web/app/admin/service-requests/ — Admin 工作流 UI

## 變更描述
{{描述：要修改工作流的哪個環節、為什麼}}

## 當前狀態機（必須完整理解）

```
submitted → screening → candidate_proposed → caregiver_confirmed
    → provider_confirmed → arranged → in_service → completed
任何狀態（除 completed/cancelled）→ cancelled
screening ← candidate_proposed（退回）
screening ← caregiver_confirmed（退回）
submitted ← screening（退回）
```

## 影響分析（必要）

1. **VALID_STATUS_TRANSITIONS 修改**：
   - 哪些 transition 需要新增/刪除/修改？
   - 是否會導致現有資料進入無效狀態？
   - 新的 transition 表要完整列出。

2. **API Handler 影響**：
   - 哪些 route handler 需要修改？
   - 是否需要新的端點？

3. **角色權限影響**：
   - 每個 transition 分別由哪個角色觸發？
   - caregiver、provider、admin 的權限是否有變化？

4. **通知影響**：
   - 狀態變更是否觸發 notification？
   - notification 的 type 和內容是否正確？

5. **UI 影響**：
   - Mobile：services/[requestId].tsx（caregiver view）
   - Mobile：provider-confirm.tsx、provider-task-detail.tsx（provider view）
   - Web：admin/service-requests/[id]/page.tsx（admin workflow）
   - 每個畫面的按鈕/狀態/操作是否需要更新？

6. **測試影響**：
   - apps/web/__tests__/service-requests.test.ts
   - packages/shared/__tests__/service-request.test.ts
   - 需要新增哪些測試 case？

## 實作順序（必須按此順序）
1. 先修改 packages/shared（status constants + Zod schemas）
2. 再修改 apps/web API routes
3. 再修改 apps/mobile 畫面
4. 再修改 apps/web admin 頁面
5. 最後更新測試和文件

先展示你的完整影響分析，經確認後再修改程式碼。
```

---

## P-11: 資料庫 Schema 變更

使用時機：新增、修改或刪除 Prisma model 或欄位。

```
你正在 Remote Care Platform 上修改資料庫 schema。這會影響整個系統的多個層級。

## 必讀文件
- apps/web/prisma/schema.prisma — 當前完整 schema（12 models）
- docs/implementation-spec.md — 資料模型章節
- packages/shared/src/schemas/ — 對應的 Zod schemas

## 變更描述
{{描述：要加/改/刪哪些欄位或 model、為什麼}}

## 影響分析（必要——逐項回答）

1. **Schema 變更細節**：
   - 具體的 model/field 變更（含 type, default, optional/required, relation）
   - 是否需要新 index？
   - 是否影響現有 relation？

2. **Migration 計畫**：
   - 這是 additive change（加欄位/表）還是 breaking change（改/刪欄位）？
   - 如果是 breaking change，現有資料怎麼處理？
   - Migration command: `cd apps/web && pnpm prisma migrate dev --name your_migration_name`

3. **Zod Schema 同步**：
   - packages/shared 中哪些 schema 需要更新？
   - Create schema 是否需要新欄位？
   - Update schema 是否需要新欄位？
   - Response schema 是否需要新欄位？

4. **API Handler 影響**：
   - 哪些 route handler 的 Prisma 查詢需要更新？
   - select/include 是否需要加入新欄位？
   - where 條件是否受影響？

5. **Mobile UI 影響**：
   - 哪些畫面顯示這些資料？
   - 表單是否需要新欄位的輸入？

6. **Seed 資料**：
   - apps/web/prisma/seed.ts 是否需要更新？

7. **測試影響**：
   - 哪些 mock 資料需要更新？
   - 是否需要新的測試 case？

## 實作順序（必須按此順序）
1. 修改 apps/web/prisma/schema.prisma
2. 執行 migration: `cd apps/web && pnpm prisma migrate dev --name descriptive_name`
3. 更新 packages/shared schemas + constants（如果需要）
4. 更新 API route handlers
5. 更新 Mobile UI（如果需要）
6. 更新 seed.ts
7. 更新測試
8. 更新 implementation-spec.md
9. 執行 `pnpm typecheck` 和 `pnpm test`

## 已知問題提醒
- ai_interactions table 目前缺少 migration（schema.prisma 中有定義但 migration 中沒有）
- ProviderDocument model 存在但沒有對應的 upload API

先展示你的影響分析，經確認後再修改 schema。
```

---

## P-12: 提交前自我檢查

使用時機：提交程式碼前，請 AI 驗證是否符合所有標準。

```
你正在 Remote Care Platform 上執行提交前合規檢查。

## 標準參考
- docs/engineering-standards.md（完整規則書）

## 要檢查的變更
{{列出你改了哪些檔案，或說「check git diff」}}

## 合規檢查清單（每項都要檢查，回報 pass/fail）

### 語言
- [ ] 程式碼（變數/函式/型別/註解）全部英文
- [ ] 使用者面文字（UI 標題/按鈕/提示/錯誤訊息）全部繁體中文
- [ ] Commit message 英文

### Schema 完整性
- [ ] 新增的 type/schema 定義在 packages/shared（不在 apps 中重複定義）
- [ ] 新增的常數/enum 定義在 packages/shared/src/constants/
- [ ] Prisma schema 變更有對應的 migration
- [ ] Zod schema 與 Prisma model 一致

### API 合規
- [ ] 所有新端點在 /api/v1/ 下
- [ ] 所有 handler 有 verifyAuth()
- [ ] 寫入 handler 有 checkOrigin()
- [ ] 使用 successResponse/errorResponse/paginatedResponse
- [ ] 輸入使用 Zod safeParse 驗證
- [ ] 錯誤代碼使用 ERROR_CODES（不自行發明）
- [ ] Ownership 檢查存在

### Mobile 合規
- [ ] API 呼叫透過 api-client.ts
- [ ] 使用 theme.ts 設計 token（無硬編碼顏色/字型）
- [ ] 三態處理（loading/error/empty）
- [ ] 使用共用 UI 元件

### 安全性
- [ ] 沒有硬編碼的 secrets 或 API keys
- [ ] 沒有在 response 中暴露 password_hash
- [ ] Auth middleware 在所有受保護端點上
- [ ] AI 回應沒有醫療建議/藥物/診斷

### 程式碼品質
- [ ] 沒有 `any` type
- [ ] 沒有 console.log 殘留
- [ ] 沒有註解掉的程式碼
- [ ] 沒有未使用的 import

### 測試
- [ ] 新功能有對應測試
- [ ] 執行 `pnpm test` 全部通過
- [ ] 執行 `pnpm typecheck` 無錯誤
- [ ] 執行 `pnpm lint` 無 warning

### 文件
- [ ] 如果修改了 API/Model/Schema，已更新 implementation-spec.md
- [ ] 沒有建立不必要的新文件

輸出：PASS（全部通過）或 FAIL（列出違規項目，附 file:line）
```

---

## P-13: 文件更新

使用時機：程式碼變更後更新 implementation-spec.md 或 engineering-standards.md。

```
你正在更新 Remote Care Platform 的文件。這是專案中最重要的兩個檔案。

## 必讀文件
完整閱讀：
- docs/implementation-spec.md
- docs/engineering-standards.md

## 變更內容
{{描述：改了什麼程式碼、哪個 PR 或 commit}}

## 更新規則

1. **implementation-spec.md 更新**（系統的「做什麼」）：
   - 新 API 端點 → 更新 API 合約章節（含完整 contract：method, path, auth, request, response）
   - Model 變更 → 更新資料模型章節（field table）
   - AI 變更 → 更新 AI 整合章節
   - 新畫面 → 更新畫面規格章節
   - 狀態機變更 → 更新 Service Request 工作流章節
   - Bug 修復 → 如果在已知限制中，更新為已解決

2. **engineering-standards.md 更新**（開發的「怎麼做」）：
   - 發現新 anti-pattern → 新增到 Anti-Pattern 目錄
   - 新流程/規則 → 新增到相關章節
   - 歷史教訓 → 新增到相關章節的備註

3. **通用規則**：
   - 保持文件的現有結構和風格
   - 使用相同的 table 格式
   - 章節標題和說明文字使用繁體中文
   - 技術用語、程式碼引用和欄位名稱使用英文
   - 不要建立新的文件檔案——更新現有的

4. **版本更新**：如果是重大變更，更新文件 header 的版本號和日期。

先展示具體的編輯內容（舊文字 → 新文字），經確認後再套用。
```

---

## P-14: 新人上手 — 系統深度理解

使用時機：新團隊成員或 AI agent 需要深入理解整個系統。

> 無 `{{placeholder}}`，直接複製貼上即可。

```
你正在被導入 Remote Care Platform（遠端照護平台）專案。你的目標是深入理解整個系統，以便有效地做出貢獻。

## Step 1: 閱讀核心文件
完整閱讀以下兩個檔案——它們是唯一的真相來源：
1. docs/implementation-spec.md（系統完整規格）
2. docs/engineering-standards.md（所有開發規則）

## Step 2: 確認理解
閱讀後，回答以下問題以驗證你的理解。請具體引用章節號和確切值。

### 架構
1. 這個 monorepo 有幾個 workspace？各自使用什麼技術？
2. packages/shared 匯出的主要類別有哪些？為什麼它是「Single Source of Truth」？
3. 認證機制是什麼？Mobile 和 Web Admin 的認證策略有什麼不同？
4. 資料庫用什麼？ORM 是什麼？有幾個 model？

### 四角色系統
5. 分別描述 caregiver、patient、provider、admin 的主要功能和限制。
6. Patient 可以執行哪些寫入操作？（提示：這是一個陷阱題）
7. Provider 的自我更新和 Admin 對 Provider 的更新有什麼差異？

### Service Request 狀態機
8. 完整列出 Service Request 的 9 個狀態。
9. 描述從 submitted 到 completed 的完整工作流（包含所有角色的操作）。
10. 哪些狀態可以被取消？由誰取消？

### AI 整合
11. 有幾種 AI report type？列出來。
12. 有幾種 AI chat task？列出來。
13. AI 的安全規則有哪些？（列出不可輸出的內容類型）
14. 當 AI 服務不可用時，系統如何處理？

### 健康量測
15. 支援哪些量測類型？各自的異常閾值是什麼？
16. 連續異常通知的觸發規則是什麼？
17. 量測資料的 stats API 回傳什麼？

### 工程品質
18. CI pipeline 有哪些 gate？
19. 列出 5 個你認為最重要的 anti-patterns。
20. 測試框架是什麼？各 workspace 分別用什麼？

## Step 3: 識別風險
理解系統後，列出你認為最重要的 5 個技術風險或已知限制。

## Step 4: 已知問題
這個專案有以下已知的技術問題，你必須知道：
- ai_interactions table 在 migration 中缺失（schema.prisma 有定義但 migration 沒有建立表）
- ProviderDocument model 存在但沒有上傳 API
- Mobile 端幾乎沒有測試覆蓋
- 沒有 JWT refresh token 機制（固定 7 天到期）
- Notification 是 polling-based（沒有 push notification 或 WebSocket）

只有完成所有步驟後，你才準備好開始修改這個 codebase。
```

---

## P-15: UI/UX 優化與視覺打磨

使用時機：優化現有畫面的視覺品質、互動體驗、動畫、一致性，或進行整體視覺打磨。

```
你正在 Remote Care Platform 上進行 UI/UX 優化。這不是新增功能，而是提升現有畫面的視覺品質和使用體驗。

## 必讀文件（全部必讀）
- docs/visual-direction-v1.md — 設計語言規範（調色板、字型、卡片、狀態指示、圖表規則、anti-patterns）
- docs/ux-refinement-framework-v1.md — UX 精緻化框架（角色密度、資訊階層、互動模式）
- docs/ux-execution-backlog-v1.md — UX 待辦項目（已知的 UI 問題清單）
- apps/mobile/lib/theme.ts — 設計 token 定義（顏色、字型、間距、圓角、陰影）
- apps/mobile/components/ui/ — 現有共用 UI 元件

## 優化目標
{{描述：哪些畫面、什麼問題、期望的視覺/體驗效果}}

## 優化前檢查清單（必要）

1. **現況截圖/描述**：目前畫面長什麼樣？具體哪裡有問題？
   - 視覺不一致（顏色、間距、字型不符合 theme.ts）
   - 資訊密度問題（太擠或太鬆）
   - 缺少狀態回饋（loading/error/empty/success）
   - 互動回饋不足（按壓效果、toast、動畫）
   - 角色差異化不足（caregiver/patient/provider 畫面看起來一樣）

2. **設計語言合規**（visual-direction-v1.md）：
   - [ ] 背景色：warm gray (#F9FAFB)，不是純白
   - [ ] 卡片：白色背景 + border (#E5E7EB) + subtle shadow + radius.md
   - [ ] 主色：#2563EB（藍），只用在 CTA 和 active 狀態
   - [ ] 語義色：只用在小面積指示器（badge/pill/dot），不是大色塊
   - [ ] 字型：body ≥ 14px，行高 ≥ 1.5x，label 用 gray，值用 near-black
   - [ ] 狀態 pill：使用 StatusPill 元件 + status-display.ts 的顏色
   - [ ] 空狀態：EmptyState 元件（icon + title + description + action）
   - [ ] 無 emoji 作為主要 UI 元素
   - [ ] 無全大寫 label
   - [ ] 無裝飾性漸層或 3D 效果

3. **角色差異化**（ux-refinement-framework-v1.md）：
   - Caregiver：管理導向，多 recipient 切換，快速操作按鈕
   - Patient：簡化讀取，大字體，最少互動，安心感
   - Provider：任務導向，高密度資訊，狀態進度明確
   - Admin：資料密度最高，表格 + 過濾 + 批次操作

4. **影響範圍**：
   - 哪些畫面會被修改？列出所有檔案路徑。
   - 是否修改共用元件？（Card, StatusPill, EmptyState 等）
   - 是否修改 theme.ts？（影響所有畫面！需要特別小心）

## 實作規則

### 必須遵守
- 所有顏色/字型/間距從 theme.ts 引用，不硬編碼
- 使用 8-point grid（spacing: xxs=2, xs=4, sm=8, md=12, lg=16, xl=20, 2xl=24, 3xl=32）
- 共用 UI 元件優先（Card, StatusPill, EmptyState, ErrorState, Toast, TrendChart）
- 如果需要新共用元件，加到 components/ui/ 並在 index.ts 匯出
- 所有使用者面文字繁體中文

### 不可以做的事
- ❌ 不改功能邏輯（純 UI 優化）
- ❌ 不改 API 呼叫或資料結構
- ❌ 不加新依賴（除非與動畫/手勢相關且 Expo 支援）
- ❌ 不用 inline style 的硬編碼值（必須用 theme token）
- ❌ 不引入與 visual-direction-v1.md 衝突的視覺風格

### 建議的優化方向
- **一致性**：統一間距、圓角、陰影、字型大小
- **回饋感**：按鈕按壓效果（Pressable + opacity）、操作後 Toast
- **可讀性**：資訊階層（標題 > 副標題 > 內容 > 輔助文字）
- **空間節奏**：Section 之間的間距一致，卡片內 padding 統一
- **色彩克制**：語義色只在小元素上，大面積保持灰白
- **動態**：FlatList 加入 ItemSeparatorComponent，scroll 加入 refreshControl

## 輸出格式
對每個畫面的修改，展示：
1. 畫面路徑
2. 修改前的問題（具體描述）
3. 修改後的效果（具體描述）
4. 使用了哪些 theme token / 共用元件
5. 是否影響其他畫面
```

---

## Claude Code Skill 使用指南

> **重要**：在 Claude Code 中，你可以使用 `/skill-name` 或讓 AI 自動觸發 Skill。以下是本專案中各場景應該使用的 Skill 對照表。**每次開新對話時，優先告訴 AI 使用對應的 Skill，這會大幅提升工作品質。**

### 核心工作流 Skill

| 場景 | 應使用的 Skill | 說明 |
|------|---------------|------|
| **開始任何有創意的工作前** | `/brainstorming` | 新功能、新元件、新 UI 設計之前**必用**。先探索意圖、需求和設計，再動手實作。 |
| **規劃多步驟任務** | `/writing-plans` | 有規格或需求時，先寫實作計畫再碰程式碼。產出 task_plan.md。 |
| **執行已有的計畫** | `/executing-plans` | 有書面計畫後，用這個 Skill 在獨立 session 中執行，帶有 review checkpoint。 |
| **複雜任務追蹤** | `/planning-with-files` | 需要 >5 步的任務，建立 task_plan.md + findings.md + progress.md 來追蹤。 |

### 開發階段 Skill

| 場景 | 應使用的 Skill | 說明 |
|------|---------------|------|
| **寫功能前** | `/test-driven-development` | 在寫實作程式碼之前**必用**。先寫測試再寫實作，確保程式碼正確。 |
| **2+ 個獨立任務** | `/dispatching-parallel-agents` | 可平行處理的獨立任務（例如同時改 3 個不相關畫面），用這個加速。 |
| **子任務並行開發** | `/subagent-driven-development` | 計畫中有多個獨立任務時，用 subagent 平行執行。 |
| **需要 worktree 隔離** | `/using-git-worktrees` | 開始 feature 開發時，建立隔離的 git worktree 避免影響當前工作。 |

### UI/UX 設計 Skill

| 場景 | 應使用的 Skill | 說明 |
|------|---------------|------|
| **建立 Web UI（Admin 頁面）** | `/frontend-design` | 建立 Web Admin 頁面、dashboard、表單時使用。產出高品質前端程式碼。 |
| **UI/UX 專業設計** | `/ui-ux-pro-max` | 需要專業 UI/UX 設計智慧時使用。支援 67 種風格、96 種調色板、React Native 和 Next.js。最適合本專案的 Mobile + Web Admin UI 設計。 |

### 品質保證 Skill

| 場景 | 應使用的 Skill | 說明 |
|------|---------------|------|
| **遇到 bug** | `/systematic-debugging` | 遇到任何 bug、測試失敗或非預期行為時**必用**。系統性除錯而非猜測。 |
| **完成工作後自檢** | `/verification-before-completion` | 在宣稱「完成」之前**必用**。先跑驗證指令、確認輸出，再做成功宣告。 |
| **完成後請求 review** | `/requesting-code-review` | 完成功能或重大修改後，用這個 Skill 驗證是否符合需求。 |
| **收到 review 回饋時** | `/receiving-code-review` | 收到 code review 回饋後使用。確保技術嚴謹性，不盲目同意。 |
| **檢查程式碼品質** | `/simplify` | 審查已變更的程式碼，找出重複、品質和效率問題並修復。 |

### Web 測試 Skill

| 場景 | 應使用的 Skill | 說明 |
|------|---------------|------|
| **測試 Web Admin UI** | `/webapp-testing` | 用 Playwright 互動測試本地 Web Admin，擷取截圖、看 console log、驗證 UI 行為。 |

### Git 與 PR Skill

| 場景 | 應使用的 Skill | 說明 |
|------|---------------|------|
| **準備提交程式碼** | `/commit-push-pr` | Commit、push 並開 PR，一次完成。 |
| **開發分支完成** | `/finishing-a-development-branch` | 實作完成、測試通過後，決定 merge/PR/cleanup 策略。 |

### 文件與 Spec Skill

| 場景 | 應使用的 Skill | 說明 |
|------|---------------|------|
| **共同撰寫文件** | `/doc-coauthoring` | 寫文件、proposal、技術規格、決策文件時使用。結構化工作流。 |

---

### Skill 組合建議：常見工作流

#### 🔵 新功能開發（完整流程）
```
1. /brainstorming          ← 先釐清需求和設計
2. /writing-plans          ← 寫出實作計畫
3. /test-driven-development ← 先寫測試
4. /executing-plans        ← 按計畫實作
5. /verification-before-completion ← 驗證完成度
6. /requesting-code-review ← 自我 review
7. /commit-push-pr         ← 提交 PR
```

#### 🟢 UI/UX 優化（搭配 P-15）
```
1. /brainstorming          ← 先討論優化方向
2. /ui-ux-pro-max          ← 專業 UI/UX 設計建議
3. /frontend-design        ← Web Admin 頁面（如果涉及）
4. /webapp-testing          ← 測試 Web Admin UI
5. /verification-before-completion ← 確認視覺一致性
6. /simplify               ← 檢查程式碼重複/品質
```

#### 🟠 修 Bug（搭配 P-02）
```
1. /systematic-debugging   ← 系統性根因分析
2. /test-driven-development ← 先寫重現 bug 的測試
3. /verification-before-completion ← 確認修復 + 無回歸
```

#### 🔴 大型重構（搭配 P-07）
```
1. /writing-plans                  ← 規劃重構範圍和順序
2. /using-git-worktrees            ← 隔離工作環境
3. /dispatching-parallel-agents    ← 獨立模組平行重構
4. /verification-before-completion ← 確認行為不變
5. /requesting-code-review         ← 全面 review
```

#### ⚫ 多畫面平行開發
```
1. /writing-plans                  ← 列出所有畫面任務
2. /subagent-driven-development    ← 多個畫面平行開發
3. /verification-before-completion ← 逐一驗證
```

---

## 快速參考：使用哪個 Prompt？

| 場景 | Prompt | 建議搭配 Skill |
|------|--------|---------------|
| **開工前讓 AI 讀懂整個專案** | **P-00**（每次新對話先貼這個） | — |
| 新增功能 | P-01 | `/brainstorming` → `/writing-plans` → `/test-driven-development` |
| 修 bug | P-02 | `/systematic-debugging` |
| 新增 API 端點 | P-03 | `/test-driven-development` |
| 新增 Mobile 畫面或 Web Admin 頁面 | P-04 | `/brainstorming` → `/ui-ux-pro-max` |
| 修改 AI 報告/對話功能 | P-05 | `/test-driven-development` |
| 審查程式碼品質 | P-06 | `/simplify` |
| 重構程式碼 | P-07 | `/writing-plans` → `/using-git-worktrees` |
| 寫測試 | P-08 | `/test-driven-development` |
| 除錯調查 | P-09 | `/systematic-debugging` |
| 修改 Service Request 工作流/狀態機 | P-10 | `/writing-plans` |
| 修改資料庫 schema（Prisma model） | P-11 | `/writing-plans` |
| 提交前自我檢查 | P-12 | `/verification-before-completion` |
| 更新 implementation-spec.md / engineering-standards.md | P-13 | `/doc-coauthoring` |
| 讓新 AI agent 深入理解系統 | P-14 | — |
| UI/UX 視覺優化與打磨 | P-15 | `/ui-ux-pro-max` → `/frontend-design` → `/simplify` |

---

## 專案核心知識速查

### 架構
| 層級 | 技術 | 位置 |
|------|------|------|
| Mobile App | Expo 54 + React Native 0.81 + Expo Router 6 | apps/mobile/ |
| Web API | Next.js 15 App Router | apps/web/app/api/ |
| Web Admin | Next.js 15 + Tailwind CSS | apps/web/app/admin/ |
| Database | PostgreSQL (Supabase) + Prisma 6.4 | apps/web/prisma/ |
| Shared Contracts | Zod 3.24 schemas + constants | packages/shared/ |
| AI | OpenAI SDK (gpt-4o-mini default) | apps/web/lib/ai*.ts |
| Auth | JWT (jose) + bcryptjs | apps/web/lib/auth.ts |
| Rate Limiting | Upstash Redis | apps/web/lib/ai-rate-limit.ts |

### 四角色
| 角色 | Mobile Tab | 寫入權限 | 資料範圍 |
|------|-----------|----------|----------|
| caregiver | Home, Health, AI, Services | 全部（自己的 recipient） | 自己建立的 recipient |
| patient | Health Summary, Schedule | **無**（純讀取） | 被連結的 recipient |
| provider | Tasks, Notifications, Profile | 任務進度、個人 profile | 被分配的 service request |
| admin | Web Dashboard, Requests, Providers, Recipients, Services | 系統管理 | 全部 |

### Service Request 狀態機
```
submitted → screening → candidate_proposed → caregiver_confirmed
  → provider_confirmed → arranged → in_service → completed
任何（除 completed/cancelled）→ cancelled
```

### API 回應格式
```typescript
// 成功
{ success: true, data: { ... } }
// 分頁
{ success: true, data: [...], meta: { page, limit, total } }
// 錯誤
{ success: false, error: { code: 'ERROR_CODE', message: '...', details: [...] } }
```

### 不可違反的規則（Top 10）
1. 所有 type/schema 定義在 packages/shared，不可在 apps 中重複
2. 所有 API handler 必須 verifyAuth()，寫入必須 checkOrigin()
3. 所有 threshold 值從 shared/constants/thresholds.ts 讀取
4. 使用者介面文字必須繁體中文，程式碼必須英文
5. Mobile API 呼叫必須透過 api-client.ts
6. AI 回應不可包含藥物/診斷/治療建議
7. ServiceRequest status 必須經過 VALID_STATUS_TRANSITIONS 驗證
8. 使用 successResponse/errorResponse/paginatedResponse 回傳
9. 每個資料畫面必須處理 loading/error/empty 三態
10. Prisma schema 變更必須有 migration

---

> **End of prompt library.** 所有 Prompt 都強制先閱讀 `implementation-spec.md` 和 `engineering-standards.md` 再進行任何操作。這是設計好的——這個專案中 bug 的首要原因是在不理解現有系統的情況下做出修改。搭配 Claude Code Skill 使用可以進一步提升工作品質和效率。
