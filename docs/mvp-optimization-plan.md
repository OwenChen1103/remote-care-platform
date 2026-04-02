# 遠端照護平台 — MVP 可控優化實作計畫

> **文件版本**：1.1.0
> **建立日期**：2026-03-27
> **最後更新**：2026-03-27（v1.1.0 — 新增 Sprint 7 補遺項 + Sprint 8 新增項）
> **依據**：業主需求文件「健康平台App規劃資料.pdf」（8 頁）
> **目的**：逐項比對業主需求與目前實作，列出所有 MVP 範圍內可優化項目，按輕重緩急排定實作順序。
> **原則**：不觸碰 MVP 排除項（金流、社交登入、即時定位、錄音錄影、評價系統、影片/廣告），僅做可控範圍內的優化。

---

## 目錄

- [Sprint 1：即時可做（0.5-1 天）— 設定調整與 UI 微調](#sprint-1即時可做05-1-天-設定調整與-ui-微調)
- [Sprint 2：資料模型擴充（1-2 天）— Schema + API + 前端](#sprint-2資料模型擴充1-2-天-schema--api--前端)
- [Sprint 3：服務需求流程強化（2-3 天）— 核心業務流程](#sprint-3服務需求流程強化2-3-天-核心業務流程)
- [Sprint 4：服務人員端優化（2-3 天）— Provider 體驗提升](#sprint-4服務人員端優化2-3-天-provider-體驗提升)
- [Sprint 5：營運後台增強（1-2 天）— Admin 功能補齊](#sprint-5營運後台增強1-2-天-admin-功能補齊)
- [Sprint 6：進階體驗優化（1-2 天）— 錦上添花](#sprint-6進階體驗優化1-2-天-錦上添花)
- [Sprint 7：已實作項目補遺（0.5-1 天）— 補齊遺漏細節](#sprint-7已實作項目補遺05-1-天-補齊遺漏細節)
- [Sprint 8：二次比對新增項（2-3 天）— 差距補齊](#sprint-8二次比對新增項2-3-天-差距補齊)
- [附錄 A：業主需求完整對照表](#附錄-a業主需求完整對照表)
- [附錄 B：涉及的檔案清單](#附錄-b涉及的檔案清單)

---

## Sprint 1：即時可做（0.5-1 天）— 設定調整與 UI 微調

> 不改 Schema、不改 API、不需 migration。純前端或 seed 調整，風險最低。

### OPT-01：調整 8 大服務類別排序

- **業主需求**：「目前預計先完成陪診服務、基礎檢測、運動養生、居家打掃，可以先幫我們把這幾項往前移。」
- **目前狀況**：seed.ts 的 sort_order 為固定 1-8，順序為 escort_visit → pre_visit_consult → shopping_assist → exercise_program → home_cleaning → daily_living_support → nutrition_consult → functional_assessment
- **差距**：業主希望陪診(1)、基礎檢測(2)、運動養生(3)、居家打掃(4) 排前面，其餘排後
- **優化方案**：
  - 修改 `apps/web/prisma/seed.ts` 中 `serviceCategories` 陣列的 `sort_order`
  - 新排序：escort_visit=1, functional_assessment=2, exercise_program=3, home_cleaning=4, pre_visit_consult=5, daily_living_support=6, nutrition_consult=7, shopping_assist=8
- **影響範圍**：`apps/web/prisma/seed.ts`
- **風險**：無（僅影響新環境 seed 資料；已有環境需手動更新 DB 或重新 seed）

---

### OPT-02：被照護者病史改為預設下拉選單

- **業主需求**：「病史（慢性病、癌症 下拉選單）」
- **目前狀況**：`add-recipient.tsx` 的 `medical_tags` 是純文字輸入（逗號分隔），無預設選項
- **差距**：業主要求下拉選單式的預設病史選項
- **優化方案**：
  - 在 `add-recipient.tsx` 和 `[recipientId]/edit.tsx` 中，將 medical_tags 輸入改為**多選 Chip 選擇器 + 自定義輸入**
  - 預設選項清單（不改 schema，純前端常數）：
    ```
    高血壓、糖尿病、心臟病、中風、腎臟病、肝臟病、
    肺部疾病、癌症、失智症、帕金森氏症、骨質疏鬆、
    關節炎、憂鬱症、其他
    ```
  - 保留「自定義輸入」按鈕，可手動新增不在清單中的標籤
  - 最終仍存為 JSON 陣列，schema 不變
- **影響範圍**：`apps/mobile/app/(tabs)/home/add-recipient.tsx`、`apps/mobile/app/(tabs)/home/[recipientId]/edit.tsx`
- **風險**：無（純 UI 變更，資料格式不變）

---

### OPT-03：新增需求單送出前確認 Modal

- **業主需求**：「確認 modal：『確定送出？送出後營運團隊將盡快與您聯繫。』」
- **目前狀況**：`new-request.tsx` 的 `handleSubmit` 直接送出，無確認步驟
- **差距**：缺少二次確認機制，使用者可能誤觸送出
- **優化方案**：
  - 在 `handleSubmit` 前加入 React Native `Modal` 或 `Alert.alert` 確認對話框
  - 標題：「確認送出需求」
  - 內容：「確定送出此服務需求？送出後營運團隊將盡快為您安排。」
  - 按鈕：「取消」/「確認送出」
  - 僅在使用者點擊「確認送出」後才呼叫 API
- **影響範圍**：`apps/mobile/app/(tabs)/services/new-request.tsx`
- **風險**：無

---

### OPT-04：首頁新增「近期行程」摘要 Section

- **業主需求**：「個人預約項目（時間、項目名稱、被照顧人關係＋姓名模糊），依時間順序排列，最多三項，更多可以收合」
- **目前狀況**：首頁 `home/index.tsx` 無行程資訊。行程只在 `appointments.tsx` 獨立頁面顯示，且需從被照護者詳情頁進入
- **差距**：業主希望首頁直接看到近期行程摘要
- **優化方案**：
  - 在首頁被照護者卡片列表**下方**，新增「近期行程」Section
  - 呼叫 `GET /appointments?recipient_id={allRecipientIds}&limit=3`（或為每位 recipient 各取最近行程後合併排序）
  - 每筆顯示：日期時間、行程標題、醫院名稱、被照護者姓名
  - 底部「查看全部行程 →」連結，跳轉至 appointments 頁面
  - 無行程時顯示 EmptyState：「暫無近期行程」
- **影響範圍**：`apps/mobile/app/(tabs)/home/index.tsx`
- **風險**：低（使用現有 API，純前端 UI 新增）

---

### OPT-05：首頁新增「服務訂閱」浮動按鈕

- **業主需求**：「右下隨屏浮動：服務訂閱。點擊可以回到 8 大服務畫面。」
- **目前狀況**：首頁右下角有 FAB「＋ 新增」（新增被照護者），無「服務訂閱」浮動按鈕
- **差距**：業主希望有隨屏浮動按鈕快速進入服務訂閱
- **優化方案**：
  - 在首頁加入第二個 FAB 或改為 SpeedDial 樣式（展開後有「新增被照護者」+「服務需求」兩個選項）
  - 或：將現有 FAB 改為「服務需求」按鈕（主色），新增被照護者改為首頁 header 右側的「＋」icon
  - 點擊後跳轉 `/(tabs)/services/new-request`
- **影響範圍**：`apps/mobile/app/(tabs)/home/index.tsx`
- **風險**：低（純 UI 調整）
- **設計考量**：若同時有兩個 FAB，需注意位置不重疊。建議採 SpeedDial（點擊展開扇形選單）

---

### OPT-06：被照護者詳情頁嵌入近期行程

- **業主需求**：首頁/詳情頁應直接可見近期預約
- **目前狀況**：`[recipientId]/index.tsx` 有快捷操作列（行程管理按鈕），有最近 5 筆量測，但**無行程資料內嵌**
- **差距**：業主希望在詳情頁直接看到行程，不用額外跳轉
- **優化方案**：
  - 在最近量測 Section 下方，新增「近期行程」Section
  - 呼叫 `GET /appointments?recipient_id={id}&limit=2`
  - 每筆顯示：日期時間、標題、醫院
  - 底部「管理行程 →」連結
- **影響範圍**：`apps/mobile/app/(tabs)/home/[recipientId]/index.tsx`
- **風險**：低

---

## Sprint 2：資料模型擴充（1-2 天）— Schema + API + 前端

> 需要 Prisma migration（additive，不破壞現有資料），加上對應的 API 與前端更新。

### OPT-07：User Model 新增生日與地址欄位

- **業主需求**：會員資料管理頁 — 「姓名*、生日*、email*、聯絡方式*、居住地址*」
- **目前狀況**：User model 僅有 name, email, phone, role, timezone。**沒有 `date_of_birth` 和 `address`**
- **差距**：缺少生日與地址欄位
- **優化方案**：
  1. Prisma migration：User 加 `date_of_birth DateTime? @db.Date` 和 `address String? @db.VarChar(500)`
  2. `packages/shared/src/schemas/auth.ts`：`UpdateProfileSchema` 加 `date_of_birth`（z.string YYYY-MM-DD optional）和 `address`（z.string optional）；`UserResponseSchema` 同步加欄位
  3. `apps/web/app/api/v1/auth/me/route.ts`：GET 回傳新欄位，PUT 接受新欄位
  4. Mobile 個人資料頁（profile）：加生日 date picker、地址輸入欄
- **影響範圍**：
  - `apps/web/prisma/schema.prisma`（User model）
  - `packages/shared/src/schemas/auth.ts`
  - `apps/web/app/api/v1/auth/me/route.ts`
  - Mobile 個人資料編輯頁面（目前在 `(tabs)/home` 或需新建 profile 編輯頁）
- **風險**：低（additive migration，所有新欄位為 optional）
- **注意**：需同步更新 `implementation-spec.md` D.3 User 表

---

### OPT-08：Recipient Model 新增地址與關係欄位

- **業主需求**：
  - 家屬連動綁定 — 「關係*（下拉選單）」
  - 服務訂閱流程 — 「出發地：縣市/區域/地址」（可從被照護者地址預填）
- **目前狀況**：Recipient model **沒有 `address` 和 `relationship`** 欄位
- **差距**：無法記錄被照護者與委託人的關係（父/母/祖父母等），無法記錄地址
- **優化方案**：
  1. Prisma migration：Recipient 加 `relationship String? @db.VarChar(20)` 和 `address String? @db.VarChar(500)`
  2. `packages/shared/src/schemas/recipient.ts`：
     - `RecipientCreateSchema` 加 `relationship`（z.enum optional：father/mother/grandfather/grandmother/spouse/other）和 `address`（z.string optional）
     - `RecipientUpdateSchema` 同步
  3. `apps/web/app/api/v1/recipients/route.ts`：create/update 處理新欄位
  4. Mobile `add-recipient.tsx` 和 `edit.tsx`：加關係下拉選單和地址輸入欄
  5. 首頁被照護者卡片可顯示關係標籤（如「母親 — 王奶奶」）
- **影響範圍**：
  - `apps/web/prisma/schema.prisma`（Recipient model）
  - `packages/shared/src/schemas/recipient.ts`
  - `apps/web/app/api/v1/recipients/route.ts`
  - `apps/web/app/api/v1/recipients/[id]/route.ts`
  - `apps/mobile/app/(tabs)/home/add-recipient.tsx`
  - `apps/mobile/app/(tabs)/home/[recipientId]/edit.tsx`
  - `apps/mobile/app/(tabs)/home/index.tsx`（卡片顯示）
- **風險**：低（additive migration）
- **注意**：relationship 前端使用繁體中文 label（父親/母親/祖父/祖母/配偶/其他），存英文 enum

---

### OPT-09：ServiceRequest Model 新增結構化 metadata 欄位

- **業主需求**：各類服務需求有不同的細節欄位：
  - 陪診：出發地、抵達地（醫院）、科別、醫師姓名、掛號號碼、是否接送、服務人員性別偏好
  - 運動養生：術後保養/肌力訓練選項、指定女性服務人員
  - 居家打掃：空間坪數、是否養寵物、指定女性服務人員
- **目前狀況**：ServiceRequest 只有 `location`（單一文字）、`description`（需求描述），**沒有結構化欄位**可存放各類別的特有資訊
- **差距**：無法區分出發地/目的地、無法存放科別/醫師/掛號等結構化資料、無法存放服務時數/偏好設定
- **優化方案**：
  1. Prisma migration：ServiceRequest 加以下欄位（全部 optional）：
     ```prisma
     departure_location  String?  @db.VarChar(500)   // 出發地
     destination         String?  @db.VarChar(500)   // 目的地/醫院
     service_duration    Int?                         // 服務時數
     metadata            Json     @default("{}")      // 類別特有的結構化資料
     ```
  2. `packages/shared/src/schemas/service-request.ts`：
     - `ServiceRequestCreateSchema` 加 `departure_location`、`destination`、`service_duration`、`metadata` 欄位
     - metadata 定義為 `z.record(z.unknown()).optional()`（靈活 JSON）
  3. 前端 `new-request.tsx`：
     - 選擇服務類別後，動態渲染該類別專屬的表單欄位
     - **陪診 (escort_visit)**：出發地、目的地（醫院名稱）、科別、醫師姓名、掛號號碼、是否需要接送（toggle）、服務人員性別偏好（radio）、服務時數（2h/4h/8h chip）
     - **運動養生 (exercise_program)**：術後保養/肌力訓練（checkbox）、指定女性服務人員（toggle）、服務時數（2h chip）
     - **居家打掃 (home_cleaning)**：空間坪數（dropdown：0-10/20-30/30-40/40-50）、服務時數（3/4/5/6h chip）、是否養寵物（toggle）、指定女性服務人員（toggle）
     - **基礎檢測 (functional_assessment)**：待補（先提供通用表單）
     - 其他類別：使用通用表單（location + description + time_slot）
  4. 各類別特有欄位存入 `metadata` JSON，通用欄位存入各自 column
- **影響範圍**：
  - `apps/web/prisma/schema.prisma`（ServiceRequest model）
  - `packages/shared/src/schemas/service-request.ts`
  - `apps/web/app/api/v1/service-requests/route.ts`
  - `apps/mobile/app/(tabs)/services/new-request.tsx`（核心改動：動態表單）
  - `apps/mobile/app/(tabs)/services/[requestId].tsx`（詳情頁展示 metadata）
  - `apps/web/app/admin/service-requests/[id]/page.tsx`（Admin 詳情展示）
- **風險**：中（涉及多檔案，但全為 additive 變更，不影響現有資料）
- **注意**：metadata 結構不做 Zod 嚴格驗證（各類別內容不同），由前端控制填入內容；後端僅驗證為合法 JSON

---

## Sprint 3：服務需求流程強化（2-3 天）— 核心業務流程

> 圍繞業主最重視的「服務訂閱→媒合→執行→回報」閉環做深化。

### OPT-10：候選服務人員卡片展示完整資訊

- **業主需求**：「提供符合條件之服務人員選擇（照片、基本及專業資料）」
- **目前狀況**：
  - Mobile 端 `[requestId].tsx`：候選 provider 只顯示**姓名**，無照片/證照/等級
  - Admin 端 `service-requests/[id]/page.tsx`：提出候選的下拉選單只顯示 `name（level）phone`，無證照/專業
- **差距**：業主希望展示更多 provider 資訊以供委託人決策
- **優化方案**：
  1. 後端：`GET /service-requests/:id` 的 `candidate_provider` include 擴充：
     ```typescript
     candidate_provider: {
       select: {
         id: true, name: true, phone: true, level: true,
         specialties: true, certifications: true,
         experience_years: true, service_areas: true,
       }
     }
     ```
  2. Mobile `[requestId].tsx`：候選確認區改為卡片式呈現：
     - 姓名 + 等級 badge（L1/L2/L3）
     - 專業項目 chips
     - 證照列表
     - 年資
     - 服務區域
     - 同意/拒絕按鈕
  3. Admin 詳情頁：提出候選的下拉改為可展開的 provider 卡片列表，含完整資訊
- **影響範圍**：
  - `apps/web/app/api/v1/service-requests/[id]/route.ts`（擴充 include）
  - `apps/mobile/app/(tabs)/services/[requestId].tsx`（UI 改版）
  - `apps/web/app/admin/service-requests/[id]/page.tsx`（UI 改版）
- **風險**：低（僅擴充 API 回傳欄位 + UI 調整）

---

### OPT-11：服務人員完成服務後結構化回報

- **業主需求**：管家端服務完成後填寫詳細資料 — 「日期、身高、體重、體脂、肌肉量、心率、血壓、血氧、血糖、膽固醇、用藥等健康數據、下次看診時間及醫生口頭交辦的重點注意事項、其他（上傳空間）」
- **目前狀況**：Provider 回報只有 `provider_note`（單一文字欄位），無結構化資料
- **差距**：無法記錄結構化的服務回報資料（健康數據、醫囑、下次回診時間）
- **優化方案**：
  1. Prisma migration：ServiceRequest 加 `provider_report Json? @default("{}")`
  2. `packages/shared/src/schemas/service-request.ts`：新增 `ProviderReportSchema`：
     ```typescript
     export const ProviderReportSchema = z.object({
       service_date: z.string().optional(),           // 實際服務日期
       health_data: z.object({                        // 健康數據（全 optional）
         blood_pressure: z.object({ systolic: z.number(), diastolic: z.number() }).optional(),
         heart_rate: z.number().optional(),
         blood_glucose: z.number().optional(),
         blood_oxygen: z.number().optional(),
         height_cm: z.number().optional(),
         weight_kg: z.number().optional(),
         body_fat_pct: z.number().optional(),
         muscle_mass_kg: z.number().optional(),
         cholesterol: z.number().optional(),
       }).optional(),
       medication_notes: z.string().max(1000).optional(),    // 用藥備註
       doctor_instructions: z.string().max(1000).optional(), // 醫生交辦事項
       next_visit_date: z.string().optional(),               // 下次看診時間
       additional_notes: z.string().max(2000).optional(),    // 其他備註
     });
     ```
  3. `apps/web/app/api/v1/provider/tasks/[id]/progress/route.ts`：接受 `provider_report` JSON
  4. Mobile `provider-task-detail.tsx`：
     - 「完成服務」時展開結構化回報表單（依服務類別動態顯示相關欄位）
     - 陪診類：血壓、血糖、心率、醫囑、下次回診
     - 運動類：心率、身高體重、體脂肌肉量
     - 打掃類：簡化表單（僅備註）
  5. Mobile `[requestId].tsx`：委託人可查看結構化回報摘要
  6. Admin 需求單詳情頁：顯示 provider_report 的格式化資料
- **影響範圍**：
  - `apps/web/prisma/schema.prisma`（ServiceRequest model）
  - `packages/shared/src/schemas/service-request.ts`
  - `apps/web/app/api/v1/provider/tasks/[id]/progress/route.ts`
  - `apps/mobile/app/(tabs)/services/provider-task-detail.tsx`（回報表單 UI）
  - `apps/mobile/app/(tabs)/services/[requestId].tsx`（查看回報）
  - `apps/web/app/admin/service-requests/[id]/page.tsx`（查看回報）
- **風險**：中（涉及多端 UI + migration，但為 additive 變更）
- **注意**：MVP 階段這些健康數據不自動匯入 measurements 表（Phase 2 再做整合）

---

### OPT-12：需求單列表加入篩選與分組

- **業主需求**：「訂單紀錄」需清楚分類
- **目前狀況**：`services/index.tsx` 是單一列表，無篩選 UI
- **差距**：缺少狀態篩選，難以快速找到特定狀態的需求單
- **優化方案**：
  - 頂部加狀態篩選 chip row：全部 / 處理中 / 已完成 / 已取消
  - 「處理中」= submitted + screening + candidate_proposed + caregiver_confirmed + provider_confirmed + arranged + in_service
  - 「已完成」= completed
  - 「已取消」= cancelled
  - 利用現有 API 的 `?status=` 參數
- **影響範圍**：`apps/mobile/app/(tabs)/services/index.tsx`
- **風險**：低（純前端 UI，使用現有 API 篩選能力）

---

## Sprint 4：服務人員端優化（2-3 天）— Provider 體驗提升

### OPT-13：Provider 首次登入引導填寫完整資料

- **業主需求**：「首次登入 → 上方橫 bar『立即開始接案』→ 展開資料填寫區 → A.基本資料 B.必備資料 C.備註 D.資料送出」
- **目前狀況**：Provider 自助註冊已存在（register.tsx 有 provider 選項，後端自動建立 pending Provider），但註冊後**無引導填寫詳細資料的流程**。provider-profile.tsx 僅顯示基本資訊，editing 極度有限（僅 availability_status toggle）
- **差距**：Provider 註冊後缺少完整的 onboarding 資料填寫流程
- **優化方案**：
  1. Provider 登入後，若 `review_status === 'pending'` 且 profile 資料不完整，顯示 onboarding 引導頁面
  2. Onboarding 頁面分步驟：
     - **Step 1 基本資料**：姓名（已有）、生日、email、聯絡方式、居住地址、學歷科系（新欄位）
     - **Step 2 專業資訊**：相關證照（multi-select + 自定義）、可接案項目（從 8 大類別多選）、年資
     - **Step 3 服務區域**：縣市/區域 multi-select
     - **Step 4 送出審核**：確認資訊摘要 → 送出 → 顯示「資料已送出，等待審核通知」
  3. 需要 Prisma migration：Provider 加 `education String?`（學歷）
  4. `PUT /provider/me` 擴充可更新欄位：education, certifications, specialties, service_areas, experience_years（onboarding 階段）
  5. provider-profile.tsx 在 `review_status === 'pending'` 時改為 onboarding 模式
- **影響範圍**：
  - `apps/web/prisma/schema.prisma`（Provider model 加 education）
  - `packages/shared/src/schemas/provider.ts`（ProviderSelfUpdateSchema 擴充）
  - `apps/web/app/api/v1/provider/me/route.ts`（PUT 擴充可更新欄位）
  - `apps/mobile/app/(tabs)/services/provider-profile.tsx`（onboarding UI）
  - 或新建 `apps/mobile/app/(tabs)/services/provider-onboarding.tsx`
- **風險**：中（涉及新 UI 流程 + Schema 變更，但為 additive）

---

### OPT-14：Provider 可接案設定（日期/時段/項目）

- **業主需求**：「可接案資料設定（日期、時段、項目、備註）」
- **目前狀況**：Provider 只能切換 `availability_status`（available/busy/offline），**無法設定可接案的具體時段和項目**
- **差距**：Admin 媒合時無法依據 provider 的可用時段和擅長項目自動篩選
- **優化方案**：
  1. Prisma migration：Provider 加：
     ```prisma
     available_services   Json   @default("[]")    // 可接案的服務類別 code 陣列
     available_schedule   Json   @default("{}")     // 可接案時段 { mon: ["morning","afternoon"], ... }
     schedule_note        String?                    // 接案備註
     ```
  2. `packages/shared/src/schemas/provider.ts`：`ProviderSelfUpdateSchema` 加上述欄位
  3. `PUT /provider/me`：處理新欄位
  4. Mobile `provider-profile.tsx`：
     - 新增「接案設定」Section
     - 可接案項目：8 大類別 multi-select chips
     - 可接案時段：週一~週日 × 上午/下午/晚上 勾選表
     - 備註文字輸入
  5. Admin 提出候選時，可依 `available_services` 和 `available_schedule` 篩選合適 provider
- **影響範圍**：
  - `apps/web/prisma/schema.prisma`（Provider model）
  - `packages/shared/src/schemas/provider.ts`
  - `apps/web/app/api/v1/provider/me/route.ts`
  - `apps/mobile/app/(tabs)/services/provider-profile.tsx`
  - `apps/web/app/admin/service-requests/[id]/page.tsx`（候選篩選參考）
- **風險**：中

---

### OPT-15：Provider 任務列表加入篩選切換

- **業主需求**：「上方 bar 為行事曆及已確定的委託案件標示對應時間」「過去案件評價，點開可以看詳情」
- **目前狀況**：`provider-tasks.tsx` 是單一 FlatList，**無篩選、無行事曆、無歷史案件分區**
- **差距**：無法區分進行中/已完成案件，無法按日期快速查看
- **優化方案**：
  - 頂部加 Segmented Control（分段控制器）：「待處理」/「進行中」/「已完成」
  - 「待處理」= candidate_proposed + provider_confirmed + arranged（待確認或待服務）
  - 「進行中」= in_service
  - 「已完成」= completed
  - 上方加**簡易日期導航 bar**（顯示本週 7 天，有案件的日期標亮點，點擊篩選該日案件）
  - 利用現有 `GET /provider/tasks?status=` 篩選參數
- **影響範圍**：`apps/mobile/app/(tabs)/services/provider-tasks.tsx`
- **風險**：低（純前端 UI，使用現有 API）

---

### OPT-16：Provider 審核結果通知

- **業主需求**：「資料送出後，由系統比對資料是否符合，並寄信給申請者，確認後續第二階段補件，或是告知資格不符合。確認審核結束後，通知核發正式接案許可。」
- **目前狀況**：`PUT /providers/:id/review` 更新 review_status 後**不產生任何通知**。完全沒有呼叫 notification 服務
- **差距**：Provider 審核通過或拒絕時，provider 本人不會收到通知
- **優化方案**：
  1. 在 `apps/web/app/api/v1/providers/[id]/review/route.ts` 的 update 成功後：
     ```typescript
     // 審核結果通知
     if (provider.user_id) {
       await prisma.notification.create({
         data: {
           user_id: provider.user_id,
           type: 'service_request_update', // 複用現有 type 或新增 provider_review_update
           title: parsed.data.review_status === 'approved'
             ? '審核通過'
             : '審核未通過',
           body: parsed.data.review_status === 'approved'
             ? '恭喜！您的服務人員資格已通過審核，現在可以開始接案。'
             : `您的服務人員資格審核未通過。${parsed.data.admin_note ? `原因：${parsed.data.admin_note}` : '請聯繫客服了解詳情。'}`,
           data: { provider_id: provider.id, review_status: parsed.data.review_status },
         }
       });
     }
     ```
  2. 可選：在 `NOTIFICATION_TYPES` 加入 `provider_review_result` 新類型
  3. Mobile 通知列表自動顯示
- **影響範圍**：
  - `apps/web/app/api/v1/providers/[id]/review/route.ts`
  - 可選：`packages/shared/src/constants/enums.ts`（新增通知類型）
  - 可選：`packages/shared/src/constants/status-display.ts`（新類型的顯示設定）
- **風險**：低（additive 邏輯，不影響現有功能）

---

## Sprint 5：營運後台增強（1-2 天）— Admin 功能補齊

### OPT-17：Admin Dashboard 月報表功能

- **業主需求**：「查看基本營運摘要、月報表生成」
- **目前狀況**：Dashboard 有即時統計卡片（6 指標），**無月報表功能**
- **差距**：業主需要按月查看營運數據
- **優化方案**：
  1. 新增 API：`GET /api/v1/admin/reports/monthly?month=2026-03`
     - 回傳：
       ```json
       {
         "month": "2026-03",
         "new_caregivers": 5,
         "new_recipients": 8,
         "total_measurements": 420,
         "abnormal_measurements": 35,
         "service_requests": {
           "created": 12,
           "completed": 8,
           "cancelled": 2,
           "by_category": { "escort_visit": 5, "home_cleaning": 3, ... }
         },
         "ai_reports_generated": 25,
         "active_providers": 6,
         "avg_completion_days": 3.5
       }
       ```
  2. Admin Dashboard 頁面加「月報表」Section 或獨立頁面：
     - 月份選擇器
     - 統計表格/卡片
     - 可選：「匯出 CSV」按鈕
- **影響範圍**：
  - 新建 `apps/web/app/api/v1/admin/reports/route.ts`
  - `apps/web/app/admin/dashboard/page.tsx`（加月報 Section）
  - 或新建 `apps/web/app/admin/reports/page.tsx`
- **風險**：低（新增功能，不影響現有）

---

### OPT-18：Admin 提出候選時展示完整 Provider 資訊

- **業主需求**：提供符合條件的服務人員資訊供決策
- **目前狀況**：Admin `service-requests/[id]/page.tsx` 提出候選的下拉選單只顯示 `name（level）phone`，候選確認後卡片只顯示姓名
- **差距**：Admin 媒合時資訊不足以做出好的決策
- **優化方案**：
  1. 候選 provider 選擇改為**可展開的卡片列表**（而非簡單 select dropdown）
  2. 每張卡片顯示：姓名、等級 badge、專業 chips、證照列表、年資、服務區域、可接案狀態
  3. 已提出候選後的展示區同步擴充
  4. `GET /providers?review_status=approved` API 回傳的資料已含這些欄位，無需改 API
- **影響範圍**：`apps/web/app/admin/service-requests/[id]/page.tsx`
- **風險**：低（純前端 UI 改版）

---

### OPT-19：Admin 角色模擬預覽

- **業主需求**：「三方畫面切換功能（用於最高權限管理者可以了解畫面狀況）」
- **目前狀況**：Admin 只能操作自己的後台頁面，無法預覽其他角色看到的內容
- **差距**：業主希望管理者能了解各角色的畫面狀況
- **優化方案**（MVP 簡化版）：
  - Admin Dashboard 加「角色資料預覽」區塊
  - 選擇角色（caregiver/patient/provider）→ 選擇具體帳號 → 以唯讀方式展示該帳號看到的核心資料（被照護者列表/健康摘要/任務列表）
  - 不做真正的畫面模擬（那需要 iframe 或獨立 render），而是以 Admin 身份調用 API 帶入指定 user 的資料做展示
  - **注意**：此功能需謹慎處理個資顯示
- **影響範圍**：
  - 可能新增 `apps/web/app/admin/preview/page.tsx`
  - 或在 dashboard 加入可展開的預覽區塊
- **風險**：中（需設計 Admin 代看機制，注意權限邊界）

---

## Sprint 6：進階體驗優化（1-2 天）— 錦上添花

### OPT-20：首頁漢堡選單（Drawer Navigation）

- **業主需求**：「左下漢堡頁：個人資料管理、首頁、訂單紀錄、設定等項目」
- **目前狀況**：首頁 header 只有通知鈴鐺 + 登出按鈕，**無漢堡選單**
- **差距**：業主期望有 drawer 式導航
- **優化方案**：
  - 首頁左上加漢堡 icon（☰）
  - 點擊展開側邊 Drawer（使用 React Native 的 DrawerLayout 或 expo-router drawer layout）
  - 選項：
    1. 個人資料管理 → 跳轉 profile 編輯頁
    2. 首頁 → 跳轉 home
    3. 訂單紀錄 → 跳轉 services tab
    4. 通知 → 跳轉 notifications
    5. 設定（量測提醒等）
    6. 登出
- **影響範圍**：
  - `apps/mobile/app/(tabs)/home/index.tsx`（加漢堡按鈕）
  - 可能需要調整 `apps/mobile/app/(tabs)/_layout.tsx`（整合 drawer）
  - 或新建 Drawer 元件
- **風險**：中（影響導航結構，需仔細測試各角色的路由行為）
- **替代方案**：若 Drawer 改動太大，可先在首頁加一個「更多」按鈕展開 ActionSheet 作為快捷選單

---

### OPT-21：被照護者詳情頁健康概覽視覺化

- **業主需求**：「有被服務過的個案，在首頁上方要出現個人身體分數圖」「下方可以生成完整 PDF」
- **目前狀況**：被照護者詳情頁有 Profile Hero Card（基本資料 + 疾病標籤），有最近量測列表，但**無視覺化的健康狀態總覽**
- **差距**：業主期望有直覺的健康狀態視覺指示
- **優化方案**：
  - 在詳情頁 Profile Hero Card 下方新增「健康概覽卡」：
    - 左側：最新一筆放心報的 `status_label` 色彩指示器（穩定=綠圈、需注意=黃圈、建議就醫=紅圈）+ 文字
    - 右側：最近 7 天的迷你趨勢圖（複用 TrendChart 元件的簡化版）
    - 底部：關鍵數值摘要（最新 BP、最新 BG、異常次數）
  - 此卡片不需新 API，組合 `GET /measurements/stats?period=7d` + 最近一筆 `GET /ai/reports?limit=1` 的資料
- **影響範圍**：`apps/mobile/app/(tabs)/home/[recipientId]/index.tsx`
- **風險**：低（純 UI 新增，使用現有 API）

---

### OPT-22：AI 放心報 PDF 下載

- **業主需求**：「下方可以生成完整的 PDF 檔案」
- **目前狀況**：`ai-report.tsx` 只有「分享」按鈕（純文字分享），**無 PDF 生成**
- **差距**：業主希望可以下載 PDF 格式的報告
- **優化方案**：
  - 在 AI 報告頁的「分享」旁邊加「下載 PDF」按鈕
  - 使用 `expo-print` + `expo-sharing`：
    1. 將報告內容組裝成 HTML 模板（含 logo、標題、狀態標籤、結論、原因、建議、免責聲明）
    2. 呼叫 `Print.printToFileAsync({ html })` 生成 PDF
    3. 呼叫 `Sharing.shareAsync(fileUri)` 讓使用者儲存或分享
  - 或後端方案：`GET /ai/reports/:id/pdf` 用 puppeteer/playwright 生成 PDF 回傳（較重，不推薦 MVP）
- **影響範圍**：
  - `apps/mobile/app/(tabs)/health/ai-report.tsx`
  - 需安裝 `expo-print` + `expo-sharing`（Expo 內建支援）
- **風險**：低（expo-print 為 Expo SDK 原生支援的 API）

---

## Sprint 7：已實作項目補遺（0.5-1 天）— 補齊遺漏細節

> Sprint 1-6 已實作的 OPT 項目中，有 4 個在實作時遺漏了業主需求的部分細節。此 Sprint 逐一補齊，均為小幅修改。

### OPT-04 補遺：近期行程顯示「關係＋姓名模糊」

- **業主原文**：「被照顧人關係＋姓名模糊」
- **已做到**：首頁近期行程 Section 已實作（Sprint 1），顯示完整被照護者姓名
- **遺漏**：未顯示 `relationship` 標籤，姓名未做模糊化處理
- **補齊方案**：
  - 行程卡片中被照護者顯示改為：`母親 — 王○○`（relationship label + 姓名取首字 + ○○）
  - 從已有的 `Recipient.relationship` 欄位（Sprint 2 OPT-08 已加）讀取關係
  - 模糊化函式：`name.charAt(0) + '○'.repeat(Math.max(name.length - 1, 1))`
- **影響範圍**：`apps/mobile/app/(tabs)/home/index.tsx`（renderAppointmentsFooter）
- **預估**：30 分鐘

---

### OPT-13 補遺：Provider Onboarding 加入「生日」欄位

- **業主原文**（P7）：「基本資料：姓名*、生日*、email*、聯絡方式*…」
- **已做到**：Onboarding 表單已收集姓名/電話/學歷/證照/年資/服務區域（Sprint 4）
- **遺漏**：「生日」欄位未加入 onboarding 表單
- **補齊方案**：
  - onboarding 表單在「聯絡電話」下方加「生日（YYYY-MM-DD）」TextInput
  - User model 已有 `date_of_birth` 欄位（Sprint 2 OPT-07 已加），onboarding 送出時一併透過 `PUT /auth/me` 或 `PUT /provider/me` 更新
  - 注意：`date_of_birth` 在 User model 上，不在 Provider model 上。需透過 `PUT /auth/me` 更新（使用者自己的 user record），或在 onboarding 流程中分兩步呼叫
- **影響範圍**：`apps/mobile/app/(tabs)/services/provider-profile.tsx`（onboarding 區段）
- **預估**：30 分鐘

---

### OPT-15 補遺：Provider 任務列表加入「行事曆日期 bar」

- **業主原文**（P7）：「上方 bar 為行事曆及已確定的委託案件標示對應時間，點開可以看到詳情」
- **已做到**：篩選 chip row 已實作（全部/待處理/進行中/已完成）
- **遺漏**：缺少行事曆日期導航 bar（業主明確要求）
- **補齊方案**：
  - 在篩選 chips 下方加一橫向可滑動的 **7 天日期 bar**（顯示本週 Mon-Sun）
  - 每個日期格顯示日期數字，有任務的日期下方加小圓點
  - 點擊日期篩選該日的任務，再點取消篩選
  - 日期資料從已有的 `tasks` 陣列的 `preferred_date` 推算，不需新 API
- **影響範圍**：`apps/mobile/app/(tabs)/services/provider-tasks.tsx`
- **預估**：2-3 小時

---

### OPT-20 補遺：漢堡選單加入「設定」項目

- **業主原文**（P1）：「漢堡頁：個人資料管理、首頁、訂單紀錄、**設定**等項目」
- **已做到**：漢堡選單已實作，含健康管理/服務需求紀錄/通知/安心報/登出
- **遺漏**：缺少「設定」選項
- **補齊方案**：
  - 在「安心報」和分隔線之間加入「設定」選項
  - 點擊跳轉至**量測提醒設定頁面**（現有的被照護者詳情頁內的提醒 Section，或新建一個獨立設定頁面彙整所有 recipients 的提醒設定）
  - MVP 階段：跳轉至第一位被照護者的詳情頁（`/(tabs)/home/{recipientId}`），讓使用者在那裡管理提醒
- **影響範圍**：`apps/mobile/app/(tabs)/home/index.tsx`（menuSheet 陣列）
- **預估**：30 分鐘

---

## Sprint 8：二次比對新增項（2-3 天）— 差距補齊

> 二次比對業主 PDF 後發現的全新差距項目（Sprint 1-6 未涵蓋）。按輕重緩急排列。

### OPT-23：個人身體分數圖（視覺化健康分數）

- **業主需求**（P1）：「有被服務過的個案，在首頁上方要出現這個：個人身體分數圖作為開頭」
- **目前狀況**：OPT-21 已在被照護者詳情頁加了健康概覽卡（AI status dot + 7 日平均 BP/BG + 異常次數），但**缺少「分數」計算和視覺化圖表**
- **差距**：業主要的是一個直覺的「身體健康分數」視覺圖，不只是文字數值
- **優化方案**：
  1. 在 `packages/shared` 新增 `calculateHealthScore(stats, report)` 純函式：
     - 輸入：7 日 BP/BG stats（count, abnormal_count, avg）+ 最新 AI report status_label
     - 計算邏輯：
       - 基礎分 100
       - BP 平均在正常範圍 +0，偏高 -10，異常 -20
       - BG 平均在正常範圍 +0，偏高 -10，異常 -20
       - 每筆異常量測 -5（上限 -30）
       - AI status: stable +0, attention -10, consult_doctor -25
       - 最低分 0
     - 回傳：`{ score: number, level: 'excellent' | 'good' | 'fair' | 'poor' }`
  2. 在被照護者詳情頁的健康概覽卡頂部，用 **SVG 環形進度條** 呈現分數：
     - 使用現有的 `react-native-svg`（已安裝）
     - 圓弧底色灰，填充色隨 level 變化（excellent=綠, good=藍, fair=黃, poor=紅）
     - 中心顯示分數數字 + level 文字
  3. 首頁被照護者卡片也顯示迷你分數 badge（小圓圈 + 分數數字）
- **影響範圍**：
  - `packages/shared/src/` — 新增 `utils/health-score.ts`
  - `apps/mobile/app/(tabs)/home/[recipientId]/index.tsx` — 概覽卡加環形圖
  - `apps/mobile/app/(tabs)/home/index.tsx` — 被照護者卡片加迷你分數
- **風險**：低（純計算 + SVG UI，不改 Schema/API）
- **預估**：3-4 小時

---

### OPT-24：AI 對話浮動調窗（首頁 BottomSheet）

- **業主需求**（P1）：「AI 對話框（快速選項：被照顧者放心報 Icon，這裡的對話希望可以調窗，不另外壓到下方資訊）」
- **目前狀況**：AI 助理是獨立 full tab（`/(tabs)/ai/index.tsx`），點擊後離開首頁
- **差距**：業主希望 AI 對話不離開首頁，以浮動/可調整大小的方式覆蓋在首頁上方
- **優化方案**：
  - 首頁加一個 **AI 快捷入口按鈕**（在 header 區域或被照護者卡片上方）
  - 點擊後從底部彈出 **BottomSheet Modal**（半屏高度，可上拉展開至全屏）
  - BottomSheet 內嵌簡化版 AI 對話（快速選項 chips + 結果展示 + 分享）
  - 原有的 AI full tab 保留作為完整功能入口
  - 使用 React Native 的 `Modal` + `PanResponder` 實現可拉動高度，或使用 `@gorhom/bottom-sheet`（需評估是否加新依賴）
- **影響範圍**：
  - `apps/mobile/app/(tabs)/home/index.tsx` — 加 AI 入口按鈕 + BottomSheet
  - 可能新建 `apps/mobile/components/ui/AiBottomSheet.tsx`
- **風險**：中（涉及首頁 UI 結構變動，需仔細處理手勢和鍵盤交互）
- **預估**：3-4 小時
- **替代方案**：若 BottomSheet 太複雜，可改為在首頁加一個固定高度的 AI 快捷卡片（顯示最近一次 AI 摘要 + 「問 AI」按鈕），點按鈕用 Modal 打開對話，而非全屏導航

---

### OPT-25：需求單表單「重新選擇」按鈕

- **業主需求**（P3-5）：每個服務訂閱流程都有「下一步 and **重新選擇**」
- **目前狀況**：`new-request.tsx` 只有「送出需求」按鈕，沒有重置/重新選擇按鈕
- **差距**：使用者填錯表單時無法一鍵清空重填
- **優化方案**：
  - 在「送出需求」按鈕左側加「重新選擇」按鈕（secondary style）
  - 點擊後 `Alert.alert` 確認：「確定要重新填寫嗎？目前的填寫內容將被清空。」
  - 確認後重置所有表單 state 到初始值
- **影響範圍**：`apps/mobile/app/(tabs)/services/new-request.tsx`
- **風險**：低
- **預估**：30 分鐘

---

### OPT-26：需求單詳情「狀態時間軸」

- **業主需求**（隱含於 P5「服務頁」和 P8 後台「更新媒合進度」）
- **目前狀況**：`[requestId].tsx` 只顯示當前狀態 badge，無狀態變更歷史
- **差距**：委託人和 Admin 無法看到需求單的狀態變更時間線
- **優化方案**：
  - 利用現有資料推算簡易時間軸（不需新 model）：
    - `created_at` → 已送出
    - `updated_at` 與 status 的對應關係
    - `caregiver_confirmed_at` → 委託人確認時間
    - `provider_confirmed_at` → 服務人員確認時間
  - 在需求單詳情頁（Mobile + Admin）加「進度時間軸」Section：
    - 垂直時間軸（每個狀態一個節點：圓點 + 狀態名 + 時間）
    - 已通過的節點用主色，未到的節點用灰色
    - cancelled 用紅色標示
  - 局限：由於沒有獨立的 status_history table，中間狀態的精確時間無法確知（只有 created_at、caregiver_confirmed_at、provider_confirmed_at 有獨立時間戳；其他轉換只有 updated_at）
- **影響範圍**：
  - `apps/mobile/app/(tabs)/services/[requestId].tsx`
  - `apps/web/app/admin/service-requests/[id]/page.tsx`
- **風險**：低（純 UI，使用現有欄位）
- **預估**：2-3 小時

---

### OPT-27：Caregiver 個人資料管理頁

- **業主需求**（P1-2）：「會員資料管理頁：姓名*、生日*、email*、聯絡方式*、居住地址*」
- **目前狀況**：
  - API 層面：`PUT /auth/me` 已支援更新 name, phone, date_of_birth, address（Sprint 2 OPT-07）
  - UI 層面：**完全沒有**獨立的 caregiver 個人資料編輯頁面。OPT-20 的漢堡選單原計畫連結此頁面但因頁面不存在而指向了別處
- **差距**：caregiver 無法在 App 中編輯自己的個人資料（姓名/生日/地址/電話）
- **優化方案**：
  - 新建 `apps/mobile/app/(tabs)/home/profile.tsx` 頁面
  - 頁面內容：
    - 顯示目前個人資料（name, email, phone, date_of_birth, address）
    - 可編輯欄位：name, phone, date_of_birth（日期輸入）, address
    - email 為唯讀（登入帳號不可變更）
    - 「儲存」按鈕呼叫 `PUT /auth/me`
  - 在 `_layout.tsx` 註冊為 hidden screen（不顯示在 tab bar）
  - 漢堡選單的「健康管理」改回「個人資料管理」，指向此新頁面
- **影響範圍**：
  - 新建 `apps/mobile/app/(tabs)/home/profile.tsx`
  - `apps/mobile/app/(tabs)/_layout.tsx`（註冊 hidden screen）
  - `apps/mobile/app/(tabs)/home/index.tsx`（選單項目修正）
- **風險**：低（API 已就緒，純前端新頁面）
- **預估**：2-3 小時

---

### OPT-28：Provider 個人照片（photo_url）

- **業主需求**（P3, P4, P7）：「提供符合條件之服務人員選擇（**照片**、基本及專業資料）」「近 3 個月個人清晰照片（需正面、露出耳朵）」
- **目前狀況**：
  - Provider model 沒有 `photo_url` 欄位
  - OPT-10 已擴充候選 provider 卡片顯示完整文字資訊，但**無照片**
  - `ProviderDocument` model 存在（可存 certification/id_card/other 類型文件），但沒有 `profile_photo` document_type
- **差距**：委託人看到候選服務人員時沒有照片，無法識別
- **優化方案**：
  1. Prisma migration：Provider 加 `photo_url String? @db.VarChar(500)`
  2. 或利用現有 `ProviderDocument` 機制：
     - `document_type` 新增 `profile_photo` 選項
     - Provider onboarding 表單加「上傳個人照片」
     - 候選卡片從 `provider.documents` 中找 `document_type === 'profile_photo'` 的檔案 URL 顯示
  3. 候選 provider 卡片（Mobile `[requestId].tsx` + Admin 詳情頁）加照片顯示：
     - 圓形頭像（使用 `Image` 元件）
     - 無照片時顯示姓名首字 fallback
  4. Provider onboarding 加照片上傳欄位
- **影響範圍**：
  - `apps/web/prisma/schema.prisma`（Provider 加 photo_url 或 document_type 擴充）
  - `apps/web/app/api/v1/service-requests/[id]/route.ts`（include photo_url）
  - `apps/mobile/app/(tabs)/services/[requestId].tsx`（ProviderCard 加 Image）
  - `apps/web/app/admin/service-requests/[id]/page.tsx`（ProviderDetailCard 加照片）
  - `apps/mobile/app/(tabs)/services/provider-profile.tsx`（onboarding 加照片上傳）
- **風險**：中（涉及 migration + 文件上傳機制，但 ProviderDocument model 已存在可複用）
- **預估**：3-4 小時

---

## 附錄 A：業主需求完整對照表

### 家屬/委託人端

| PDF 頁碼 | 業主需求 | 狀態 | 對應項 |
|---------|---------|------|--------|
| P1 | 三方登入（FB/Google/LINE） | 🚫 Phase 2 | — |
| P1 | Email 註冊 | ✅ 已完成 | register.tsx |
| P1 | 角色選擇 | ✅ 已完成 | register.tsx ROLE_OPTIONS |
| P1 | 左下漢堡頁 | 🔧 可優化 | OPT-20 |
| P1 | 右下隨屏浮動：服務訂閱 | 🔧 可優化 | OPT-05 |
| P1 | 個人身體分數圖 | 🔧 可優化 | OPT-21 |
| P1 | 下方可生成完整 PDF | 🔧 可優化 | OPT-22 |
| P1 | AI 對話框（調窗，不壓到下方資訊） | 🔧 可優化 | OPT-24（目前為獨立 tab，業主要浮動調窗） |
| P1 | 個人預約項目（最多三項，收合） | 🔧 已做/補遺 | OPT-04 + 補遺（缺關係+姓名模糊） |
| P1 | 8 大訂閱項目 | ✅ 已完成 | SERVICE_CATEGORY_CODES |
| P1 | 先完成的 4 項往前移 | 🔧 可優化 | OPT-01 |
| P1 | 推薦影片 | 🚫 Phase 2 | — |
| P1 | 廣告版位 | 🚫 Phase 2 | — |
| P1 | Footer | 🚫 Phase 2 | — |
| P1-2 | 會員姓名/email/聯絡方式 | ✅ 已完成 | auth/me API |
| P2 | 會員生日 | 🔧 可優化 | OPT-07 |
| P2 | 會員居住地址 | 🔧 可優化 | OPT-07 |
| P2 | 病史下拉選單 | 🔧 可優化 | OPT-02 |
| P2 | 生活習慣（喝水量等） | 🚫 Phase 2 | — |
| P2 | 讓健康管家幫忙填寫 | 🚫 Phase 2 | — |
| P2 | 家屬連動綁定 | ✅ 已完成 | Recipient + patient_user_id |
| P2 | 家屬「關係」下拉 | 🔧 可優化 | OPT-08 |
| P2 | 驗證碼同步綁定 | 🚫 Phase 2 | — |
| P2-3 | 陪診服務 — 出發地/抵達地/科別/醫師/掛號 | 🔧 可優化 | OPT-09 |
| P3 | 陪診 — 是否接送/性別偏好/證照 | 🔧 可優化 | OPT-09 |
| P3 | 服務方案時數選擇 | 🔧 可優化 | OPT-09 |
| P3 | 預估金額自動計算 | 🚫 Phase 2 | — |
| P3 | 串金流（綠界） | 🚫 Phase 2 | — |
| P3 | 符合條件之服務人員選擇（含照片） | 🔧 已做/補遺 | OPT-10（文字資訊已有）+ OPT-28（照片待補） |
| P3 | 下一步 and 重新選擇 | 🔧 可優化 | OPT-25 |
| P3 | 備註 | ✅ 已完成 | description 欄位 |
| P3 | 勾選注意事項、錄音同意 | 🚫 Phase 2 | — |
| P3-4 | 運動養生 — 術後保養/肌力訓練/性別 | 🔧 可優化 | OPT-09 |
| P4-5 | 居家打掃 — 坪數/寵物/性別 | 🔧 可優化 | OPT-09 |
| P3,4,5 | 結帳串金流 + 行事曆提醒 | 🚫 Phase 2 | — |
| P5 | 服務頁 — App 定位 + 驗證碼 | 🚫 Phase 2 | — |
| P5 | 服務期間錄音/錄影 | 🚫 Phase 2 | — |
| P5-6 | 服務完成後評價 | 🚫 Phase 2 | — |
| P5 | 續訂機制 | 🚫 Phase 2 | — |
| P1-2 | 會員資料管理頁（獨立 UI） | 🔧 可優化 | OPT-27（API 已有，缺前端頁面） |
| P5 | 需求單狀態時間軸 | 🔧 可優化 | OPT-26 |
| P6 | 管家端填寫健康數據 | 🔧 可優化 | OPT-11 |
| P6 | 管家端上傳文件（藥單/醫囑） | 🚫 Phase 2 | — |
| P6 | 錄音轉文字+醫囑摘要 | 🚫 Phase 2 | — |

### 管家接單端（Provider）

| PDF 頁碼 | 業主需求 | 狀態 | 對應項 |
|---------|---------|------|--------|
| P6 | 同平台登入入口 | ✅ 已完成 | — |
| P6 | 三方登入 | 🚫 Phase 2 | — |
| P7 | 左下漢堡頁（含設定） | 🔧 已做/補遺 | OPT-20 + 補遺（設定項目遺漏） |
| P7 | 右下浮動：看評價 | 🚫 Phase 2 | — |
| P7 | 首次登入 — 資料填寫區 | 🔧 可優化 | OPT-13 |
| P7 | 基本資料（含學歷科系、生日） | 🔧 已做/補遺 | OPT-13 + 補遺（生日欄位遺漏） |
| P7 | 上傳身分證正反面 | 🔧 可優化 | OPT-13（利用現有 ProviderDocument model） |
| P7 | 上傳近 3 月照片 | 🔧 可優化 | OPT-28（Provider photo_url） |
| P7 | 安全問卷/切結書/電子簽名 | 🚫 Phase 2 | — |
| P7 | 第二階段補件（健檢/良民證） | 🚫 Phase 2 | — |
| P7 | 系統比對+寄信通知 | 🔧 可優化 | OPT-16 |
| P7 | 推薦影片/廣告/Footer | 🚫 Phase 2 | — |
| P7 | 行事曆及案件標示 | 🔧 已做/補遺 | OPT-15（篩選 chips 已做）+ 補遺（行事曆 bar 遺漏） |
| P7 | 可接案資料設定 | 🔧 可優化 | OPT-14 |
| P7 | 過去案件+評價 | 🔧/🚫 | OPT-15（歷史案件）/ Phase 2（評價） |
| P7 | 推薦影片/廣告/Footer | 🚫 Phase 2 | — |

### 營運後台（Web Admin）

| PDF 頁碼 | 業主需求 | 狀態 | 對應項 |
|---------|---------|------|--------|
| P8 | 三方畫面切換 | 🔧 可優化 | OPT-19 |
| P8 | 查看所有需求單 | ✅ 已完成 | — |
| P8 | 管理服務人員+等級 | ✅ 已完成 | — |
| P8 | 人工審查 | ✅ 已完成 | — |
| P8 | 查看委託人/被照護者資料 | ✅ 已完成 | — |
| P8 | 更新媒合進度/備註 | ✅ 已完成 | — |
| P8 | 基本營運摘要 | ✅ 已完成 | Dashboard 6 指標 |
| P8 | 月報表生成 | 🔧 可優化 | OPT-17 |
| P8 | 個資處理（待討論） | ⏳ 待討論 | — |

### 付費規則

| PDF 頁碼 | 業主需求 | 狀態 | 對應項 |
|---------|---------|------|--------|
| P8 | 續訂流程 | 🚫 Phase 2 | — |
| P8 | 舊客新訂（家屬通知+付款） | 🚫 Phase 2 | — |
| P8 | 家屬自付款 | 🚫 Phase 2 | — |

---

## 附錄 B：涉及的檔案清單

### 需要 Prisma Migration 的項目

| 項目 | Model | 新增欄位 |
|------|-------|---------|
| OPT-07 | User | `date_of_birth DateTime?`, `address String?` |
| OPT-08 | Recipient | `relationship String?`, `address String?` |
| OPT-09 | ServiceRequest | `departure_location String?`, `destination String?`, `service_duration Int?`, `metadata Json` |
| OPT-11 | ServiceRequest | `provider_report Json?` |
| OPT-13 | Provider | `education String?` |
| OPT-14 | Provider | `available_services Json`, `available_schedule Json`, `schedule_note String?` |
| OPT-28 | Provider | `photo_url String?`（或擴充 ProviderDocument.document_type） |

> **建議**：合併為 1-2 次 migration，減少 migration 數量。Sprint 1-6 已執行 3 次 migration。Sprint 8 OPT-28 需要 1 次 additive migration。

### 需要修改 packages/shared 的項目

| 項目 | 檔案 | 變更 |
|------|------|------|
| OPT-07 | schemas/auth.ts | UpdateProfileSchema + UserResponseSchema 加 date_of_birth, address |
| OPT-08 | schemas/recipient.ts | CreateSchema + UpdateSchema 加 relationship, address |
| OPT-09 | schemas/service-request.ts | CreateSchema 加 departure_location, destination, service_duration, metadata |
| OPT-11 | schemas/service-request.ts | 新增 ProviderReportSchema |
| OPT-14 | schemas/provider.ts | ProviderSelfUpdateSchema 加 available_services, available_schedule |
| OPT-16 | constants/enums.ts | 可選：NOTIFICATION_TYPES 加 provider_review_result |
| OPT-23 | 新增 utils/health-score.ts | calculateHealthScore 純函式 |

### 需要修改的 API Route

| 項目 | Route 檔案 |
|------|-----------|
| OPT-07 | apps/web/app/api/v1/auth/me/route.ts |
| OPT-08 | apps/web/app/api/v1/recipients/route.ts, [id]/route.ts |
| OPT-09 | apps/web/app/api/v1/service-requests/route.ts |
| OPT-10 | apps/web/app/api/v1/service-requests/[id]/route.ts |
| OPT-11 | apps/web/app/api/v1/provider/tasks/[id]/progress/route.ts |
| OPT-13 | apps/web/app/api/v1/provider/me/route.ts |
| OPT-14 | apps/web/app/api/v1/provider/me/route.ts |
| OPT-16 | apps/web/app/api/v1/providers/[id]/review/route.ts |
| OPT-17 | 新建 apps/web/app/api/v1/admin/reports/route.ts |

### 需要修改的 Mobile 畫面

| 項目 | 畫面檔案 |
|------|---------|
| OPT-02 | home/add-recipient.tsx, [recipientId]/edit.tsx |
| OPT-03 | services/new-request.tsx |
| OPT-04 | home/index.tsx |
| OPT-05 | home/index.tsx |
| OPT-06 | home/[recipientId]/index.tsx |
| OPT-09 | services/new-request.tsx（核心改動：動態表單）|
| OPT-10 | services/[requestId].tsx |
| OPT-11 | services/provider-task-detail.tsx |
| OPT-12 | services/index.tsx |
| OPT-13 | services/provider-profile.tsx 或新建 provider-onboarding.tsx |
| OPT-14 | services/provider-profile.tsx |
| OPT-15 | services/provider-tasks.tsx |
| OPT-20 | home/index.tsx + _layout.tsx |
| OPT-21 | home/[recipientId]/index.tsx |
| OPT-22 | health/ai-report.tsx |
| OPT-04 補 | home/index.tsx（renderAppointmentsFooter） |
| OPT-13 補 | services/provider-profile.tsx（onboarding 區段） |
| OPT-15 補 | services/provider-tasks.tsx（日期 bar） |
| OPT-20 補 | home/index.tsx（menuSheet 陣列） |
| OPT-23 | home/[recipientId]/index.tsx + home/index.tsx |
| OPT-24 | home/index.tsx 或新建 components/ui/AiBottomSheet.tsx |
| OPT-25 | services/new-request.tsx |
| OPT-26 | services/[requestId].tsx |
| OPT-27 | 新建 home/profile.tsx + _layout.tsx + home/index.tsx |
| OPT-28 | services/[requestId].tsx + services/provider-profile.tsx |

### 需要修改的 Admin 頁面

| 項目 | 頁面檔案 |
|------|---------|
| OPT-10 | admin/service-requests/[id]/page.tsx |
| OPT-17 | admin/dashboard/page.tsx 或新建 admin/reports/page.tsx |
| OPT-18 | admin/service-requests/[id]/page.tsx |
| OPT-19 | 新建 admin/preview/page.tsx |
| OPT-26 | admin/service-requests/[id]/page.tsx（狀態時間軸） |
| OPT-28 | admin/service-requests/[id]/page.tsx（Provider 照片） |

---

## 實作順序總覽

```
Sprint 1（0.5-1 天）✅ 已完成
  OPT-01  調整服務排序          ← 5 分鐘
  OPT-02  病史下拉選單          ← 1-2 小時
  OPT-03  需求單確認 Modal      ← 30 分鐘
  OPT-04  首頁近期行程          ← 2-3 小時
  OPT-05  首頁服務浮動按鈕      ← 1 小時
  OPT-06  詳情頁嵌入行程        ← 1-2 小時

Sprint 2（1-2 天）✅ 已完成
  OPT-07  User 加生日/地址      ← 2-3 小時
  OPT-08  Recipient 加關係/地址  ← 2-3 小時
  OPT-09  ServiceRequest metadata ← 4-6 小時

Sprint 3（2-3 天）✅ 已完成
  OPT-10  候選 Provider 完整資訊 ← 3-4 小時
  OPT-11  結構化服務回報         ← 4-6 小時
  OPT-12  需求單篩選            ← 1-2 小時

Sprint 4（2-3 天）✅ 已完成
  OPT-13  Provider Onboarding   ← 4-6 小時
  OPT-14  可接案設定            ← 3-4 小時
  OPT-15  任務篩選+日期導航     ← 2-3 小時
  OPT-16  審核結果通知          ← 1 小時

Sprint 5（1-2 天）✅ 已完成
  OPT-17  月報表               ← 3-4 小時
  OPT-18  候選展示增強          ← 2-3 小時（Sprint 3 已完成）
  OPT-19  角色預覽             ← 3-4 小時

Sprint 6（1-2 天）✅ 已完成
  OPT-20  漢堡選單             ← 3-4 小時
  OPT-21  健康概覽視覺化        ← 2-3 小時
  OPT-22  PDF 報告下載          ← 2-3 小時

Sprint 7（0.5-1 天）— 補遺（已實作項目遺漏細節）
  OPT-04 補  行程關係+姓名模糊   ← 30 分鐘
  OPT-13 補  Provider 生日欄位   ← 30 分鐘
  OPT-20 補  選單加設定項目      ← 30 分鐘
  OPT-15 補  行事曆日期 bar     ← 2-3 小時

Sprint 8（2-3 天）— 二次比對新增項
  OPT-25  重新選擇按鈕          ← 30 分鐘
  OPT-27  Caregiver 個人資料頁   ← 2-3 小時
  OPT-26  狀態時間軸            ← 2-3 小時
  OPT-23  身體分數圖            ← 3-4 小時
  OPT-24  AI 調窗 BottomSheet   ← 3-4 小時
  OPT-28  Provider 照片          ← 3-4 小時（需 migration）
```

**總計**：Sprint 1-6 = 22 項（✅ 已完成），Sprint 7 = 4 項補遺，Sprint 8 = 6 項新增
**剩餘工作量**：預估 3-4 個工作天

---

> **End of document (v1.1.0).** 本文件應與 `implementation-spec.md` 和 `engineering-standards.md` 搭配使用。任何優化項完成後，須同步更新 `implementation-spec.md` 中對應的 Schema、API 合約或頁面規格章節。
>
> **v1.1.0 變更紀錄**：Sprint 1-6 全部標記已完成。新增 Sprint 7（4 項補遺）和 Sprint 8（6 項新增）。修正附錄 A 中 AI 調窗誤標為已完成。補充缺失的業主需求項目（重新選擇按鈕、狀態時間軸、Caregiver 個人資料頁、Provider 照片）。
