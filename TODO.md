# WhoCares 遠端照護平台 — 完整待辦清單

> **更新日期**：2026-04-23
> **目標**：月底交付可 demo + 可測試的 MVP
> **網域**：wedocare.co（GoDaddy）
> **Apple Developer**：待開通（48hr）

---

## 一、部署與上線（最高優先）

### 1.1 後端部署到 Vercel
- [ ] 設定 `apps/web` 部署到 Vercel
- [ ] 環境變數設定（DATABASE_URL, JWT_SECRET, OPENAI_API_KEY 等）
- [ ] 測試所有 API 端點可正常連線
- [ ] 設定 CORS 允許 mobile app 連線

### 1.2 網域 DNS 設定（GoDaddy）
- [ ] `api.wedocare.co` → Vercel CNAME（API 後端）
- [ ] `admin.wedocare.co` → Vercel CNAME（管理員後台）
- [ ] `wedocare.co` → 業主品牌官網（他們自己管理）
- [ ] SSL 憑證確認（Vercel 自動處理）

### 1.3 Mobile APP 環境切換
- [ ] `.env` 的 `EXPO_PUBLIC_API_URL` 改為 `https://api.wedocare.co`
- [ ] `app.json` 的 `bundleIdentifier` 改為 `co.wedocare.app`
- [ ] CSRF `ALLOWED_ORIGINS` 加入正式網域

### 1.4 TestFlight 上架
- [ ] 等 Apple Developer 帳號開通
- [ ] 填入 `eas.json` 的 appleId / ascAppId / appleTeamId
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios`
- [ ] 等 TestFlight 審核（1-2 天）
- [ ] 取得測試連結分享給測試員

### 1.5 OTA 更新流程建立
- [ ] `eas update:configure`
- [ ] 確認後續 JS 層改動可用 `eas update` 秒推

---

## 二、業主新需求（畫面需求文件）

### 2.1 APP 入口頁（全新頁面）
- [ ] 新建 `apps/mobile/app/(auth)/index.tsx`（landing page）
- [ ] WhoCares logo + "We do. 我們隨時都在"
- [ ] [會員註冊] 按鈕 → register
- [ ] [開始安排] 按鈕 → login
- [ ] 設計重點：莫蘭迪藍/灰色調（不要粉），主按鈕最大最明顯
- [ ] 廣告位置預留（空 View placeholder）

### 2.2 委託人首頁重排（按業主 6 區塊）
- [ ] **區塊 1**：品牌 header — Logo "WhoCares" + "We do." + [開始安排照顧] 主按鈕 + [查看服務內容] 次按鈕
- [ ] **區塊 2**：身體分數卡片（已有，微調格式）— 姓名 + 分數 + 最近更新日期 + [查看完整報告]；無資料時顯示 [開始安排第一個服務]
- [ ] **區塊 3**：下一個行程（已有，微調）— 日期 + 服務類別 + 姓名 + [查看詳情]
- [ ] 圖文位置預留（報導文章/電商連結用）
- [ ] 影音位置預留（宣傳影片嵌入用）
- [ ] **區塊 4**：快速服務入口 2×2（只顯示 4 個）— 每張卡片加一句描述文字
  - 陪診服務 →「讓醫生的話更容易懂」
  - 基礎檢測 →「定期掌握身體狀況」
  - 運動養生 →「專業陪伴安心運動」
  - 居家打掃 →「乾淨居家安心生活」
- [ ] **區塊 5**：安心機制（信任建立）— 3 個 icon 橫排
  - ✔ 即時紀錄：每次服務都有完整記錄
  - ✔ AI 摘要：自動整理醫囑與重點
  - （第三個待補，業主文件只寫了兩個）
- [ ] **區塊 6**：AI 入口（限制使用）— "需要幫忙嗎？" + 3 個按鈕
  - [常見問題]
  - [幫我安排服務]
  - [了解流程]
- [ ] 圖文位置預留（底部）

### 2.3 色調調整
- [ ] 業主指定：莫蘭迪藍/灰（不要粉）
- [ ] 確認目前的紫色系是否需要改回藍灰色系
- [ ] 跟業主確認後再調

---

## 三、AI 策略調整

### 3.1 次數限制改為每日
- [ ] `ai-rate-limit.ts`：slidingWindow 從 `1 h` 改為 `1 d`
- [ ] `thresholds.ts`：常數名稱從 `PER_HOUR` 改為 `PER_DAY`
- [ ] MVP 階段統一 5 次/日（不分免費/訂閱）
- [ ] 後續搭配付費機制再分級

### 3.2 AI 回答策略 — 導流到下單
- [ ] `ai-prompts.ts`：SYSTEM_RULES 加入「回答完健康問題後，主動建議安排對應的服務」
- [ ] 回覆結構加入 `suggested_service` 欄位（服務類別 code）
- [ ] 前端：AI 回覆底部加「安排服務 →」按鈕，導向 new-request

---

## 四、剩餘功能補齊

### 4.1 預估金額計算（OPT 缺口 #2）
- [ ] `new-request.tsx`：根據 PDF 規則顯示即時價格試算
  - 陪診：200/hr × 證照加成 20% + 接送費
  - 運動：400/hr × 證照加成 60%
  - 打掃：600/hr
- [ ] 純前端計算，顯示在表單底部

### 4.2 生活習慣欄位（OPT 缺口 #1）
- [x] Migration 已建（lifestyle_habits JSONB）
- [x] Zod schema 已加
- [ ] 確認 Supabase DB 已執行 ALTER TABLE
- [ ] 前端表單已在 add-recipient.tsx 和 edit.tsx 加入

### 4.3 「讓健康管家幫忙填寫」checkbox（OPT 缺口 #3）
- [ ] 病史欄位旁加 checkbox
- [ ] 生活習慣欄位旁加 checkbox
- [ ] 純前端 UI，存在 metadata JSON 裡

### 4.4 Provider 漢堡選單（OPT 缺口 #4）
- [x] 已實作

---

## 五、已知 Bug 修復

- [x] 首頁：更新資料後不會即時刷新 → 已加 useFocusEffect
- [x] 服務頁：categoryId 鎖死 → 已加 useEffect 同步 params
- [x] AI 對話：第一次點擊 bubble 消失 → 已加 welcomeShownForRef guard
- [x] 切換被照護者：ring chart 不動 → 已加 activeId 依賴 + reset + setTimeout

---

## 六、Demo 資料準備

- [ ] 跑 SQL 更新三位被照護者的量測資料（近 14 天合理數值）
- [ ] 新增近期行程（未來 7 天）
- [ ] 新增已完成的服務紀錄（帶 provider_report 健康數據）
- [ ] 確認所有 demo 帳號可正常登入
  - 委託人：demo@remotecare.dev / Demo1234!
  - 被照護者：patient.demo@remotecare.dev / Patient1234!
  - 服務人員：provider.demo@remotecare.dev / Provider1234!
  - 管理員：admin@remotecare.dev / Admin1234!

---

## 七、Phase 2（月底交付後）

> 明確排除，不在本次範圍

- 三方登入（FB/Google/LINE）
- 金流串接（綠界）
- 評價系統（準時度/專業度/細心度/親和力）
- 續訂機制 + 行事曆串接
- 服務啟動驗證碼 + GPS 定位
- 錄音/錄影 + AI STT 語音轉文字
- 家屬驗證碼綁定
- 推薦影片 / 廣告版位 / footer
- AI 付費版 vs 免費版分級
- 文件上傳（藥單/醫囑單）
- 安全問卷 / 切結書 / 電子簽名

---

## 優先順序建議

```
Week 1（現在）
├── 1.1 後端部署 Vercel ← 最重要，其他都依賴它
├── 1.2 DNS 設定
├── 1.3 環境變數切換
├── 六、Demo 資料準備
└── 五、Bug 修復

Week 2（Apple Developer 開通後）
├── 1.4 TestFlight 上架
├── 1.5 OTA 更新建立
├── 2.1 APP 入口頁
├── 2.2 首頁重排
└── 2.3 色調確認

Week 3（交付前）
├── 三、AI 策略調整
├── 四、剩餘功能補齊
└── 最終測試 + Demo 演練
```
