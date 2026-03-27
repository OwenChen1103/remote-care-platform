# 12 步 Demo 完整驗證流程

> 對應 `docs/implementation-spec.md` Section O.3 劇本（約 8 分鐘）

---

## 前置準備

### 1. 啟動環境

```bash
# 終端 1：啟動後端 + Web Admin
cd apps/web
pnpm prisma db seed
pnpm dev
# → http://localhost:3000

# 終端 2：啟動 Mobile
cd apps/mobile
npx expo start
# → 手機 Expo Go 掃 QR code
```

### 2. 確認事項

- [ ] Seed 執行成功（顯示 `Seed completed: roles + recipients + ...`）
- [ ] Web Admin 可訪問 `http://localhost:3000/admin/login`
- [ ] Mobile 可掃 QR code 開啟 app
- [ ] 手機和電腦在同一個 Wi-Fi 網路

### 3. Demo 帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| Caregiver（委託人） | `demo@remotecare.dev` | `Demo1234!` |
| Patient（被照護者） | `patient.demo@remotecare.dev` | `Patient1234!` |
| Provider（服務人員） | `provider.demo@remotecare.dev` | `Provider1234!` |
| Admin（管理員） | `admin@remotecare.dev` | `Admin1234!` |

---

## Demo 劇本

### Step 1（0:00-0:30）— Caregiver 登入

**裝置**：Mobile

1. 開啟 Expo Go app
2. 輸入 `demo@remotecare.dev` / `Demo1234!`
3. 點「登入」

**驗證**：
- [ ] 成功進入首頁
- [ ] 底部顯示 4 個 tab：首頁、健康、安心報、服務
- [ ] 展示重點：登入流程

---

### Step 2（0:30-1:00）— 查看被照護者

**裝置**：Mobile → 首頁 tab

1. 應該看到 **2 位被照護者**：王奶奶、李爺爺
2. 點入「**王奶奶**」

**驗證**：
- [ ] 看到個人資料（姓名、性別、年齡）
- [ ] 看到醫療標籤：高血壓、糖尿病
- [ ] 看到快捷按鈕（記錄血壓/記錄血糖/看趨勢/行程管理）
- [ ] 看到最近量測紀錄
- [ ] 展示重點：Care Circle 概念、快速掌握狀況

---

### Step 3（1:00-1:30）— 新增被照護者

**裝置**：Mobile → 首頁 tab

1. 返回首頁，按右下角 **「+」** 浮動按鈕
2. 填入：
   - 姓名：`張爺爺`
   - 疾病標籤：`糖尿病`
3. 點「新增」

**驗證**：
- [ ] 回到首頁，看到 **3 位被照護者**（王奶奶、李爺爺、張爺爺）
- [ ] 張爺爺顯示「糖尿病」標籤
- [ ] 展示重點：Onboarding 流程

---

### Step 4（1:30-2:30）— 新增血壓量測

**裝置**：Mobile

1. 首頁點入「**王奶奶**」
2. 點「**記錄血壓**」
3. 填入：
   - 收縮壓：`145`
   - 舒張壓：`92`
   - 量測時間：保持預設（現在）
4. 點「儲存」

**驗證**：
- [ ] 儲存成功提示
- [ ] 回到被照護者頁面，最近量測出現 `145/92`
- [ ] 顯示**異常紅色標記**（145 > 140 收縮壓閾值）
- [ ] 展示重點：手動輸入 + 異常判斷

---

### Step 5（2:30-3:30）— 趨勢圖表

**裝置**：Mobile

1. 在王奶奶頁面點「**看趨勢**」
2. 確認類型為「血壓」
3. 切換到「**7 天**」

**驗證**：
- [ ] 看到 7 天統計數據（筆數、異常數、平均值、最高/最低值）
- [ ] 看到每日數據表格
- [ ] 異常數據有紅色標記
- [ ] 可切換到「30 天」查看更長期趨勢
- [ ] 展示重點：數據視覺化

---

### Step 6（3:30-4:30）— AI 放心報

**裝置**：Mobile → 安心報 tab

1. 點底部「**安心報**」tab
2. 選擇被照護者「王奶奶」
3. 選擇報告類型「**健康摘要**」
4. 點「**生成報告**」

**驗證**：
- [ ] 顯示 AI 生成的報告（或 seed 預建的報告）
- [ ] 內容包含：結論（需留意/穩定/建議就醫）
- [ ] 內容包含：原因分析（3 項）
- [ ] 內容包含：建議（4 項）
- [ ] 底部有**免責聲明**
- [ ] 展示重點：AI 核心功能

> **Fallback**：如果 AI API 不可用，seed 已有一筆預建報告可展示

---

### Step 7（4:30-5:00）— 一鍵分享

**裝置**：Mobile → 安心報

1. 在生成的報告下方點「**分享**」按鈕

**驗證**：
- [ ] 文字已複製到剪貼簿（或彈出系統分享選單）
- [ ] 分享內容包含報告摘要文字
- [ ] 展示重點：分享閉環

---

### Step 8（5:00-5:30）— 新增就醫行程

**裝置**：Mobile

1. 首頁點入「**王奶奶**」
2. 點「**行程管理**」
3. 可以先查看 seed 預建的 2 筆行程（台大醫院、國泰醫院）
4. 點底部「**+ 新增行程**」
5. 填入：
   - 標題：`台大醫院心臟內科回診`
   - 日期：`2026-03-26`（下週）
   - 醫院：`台大醫院`
   - 科別：`心臟內科`
6. 點「新增行程」

**驗證**：
- [ ] 回到行程列表
- [ ] 看到新增的行程（顯示倒數天數）
- [ ] 同時看到 seed 預建的行程
- [ ] 展示重點：行程管理

---

### Step 9（5:30-6:00）— 送出服務需求

**裝置**：Mobile → 服務 tab

1. 點底部「**服務**」tab
2. 點右下角 **「+」** 浮動按鈕
3. 填入：
   - 被照護者：選「王奶奶」
   - 服務類別：選「**陪診師**」
   - 期望日期：選未來某天
   - 時段：上午
   - 地點：`台大醫院`
   - 描述：`需要陪同王奶奶到台大醫院心臟內科回診`
4. 點「送出」

**驗證**：
- [ ] 回到服務列表
- [ ] 新需求顯示狀態「**已送出**」（submitted）
- [ ] 展示重點：服務媒合入口

---

### Step 10（6:00-7:00）— Admin 後台操作

**裝置**：電腦 Web Browser

1. 開啟 `http://localhost:3000/admin/login`
2. 登入 `admin@remotecare.dev` / `Admin1234!`
3. 進入 **Dashboard**

**驗證 Dashboard**：
- [ ] 6 張 KPI 卡片有數據
  - 委託人數
  - 被照護者數
  - 今日量測數
  - 待處理需求單
  - 待審核服務人員
  - 今日異常通知
- [ ] 最近待處理需求單列表（≤5 筆）
- [ ] 最近異常通知列表（≤5 筆）
- [ ] Sidebar 有 5 個導航項目 + 登出

**操作媒合流程**：

4. 點 Sidebar「**需求單管理**」
5. 找到剛送出的「陪診師」需求（狀態：已送出）
6. 點進詳情頁
7. 將狀態改為「**審核中**」（screening）
8. 在「**提出候選服務人員**」下拉選「**陳照護員**」
9. 點「**提出候選**」

**驗證**：
- [ ] 需求狀態變為「**已推薦候選**」（candidate_proposed）
- [ ] 候選服務人員資訊正確顯示
- [ ] 展示重點：營運後台閉環

---

### Step 11（7:00-7:30）— 雙向確認

**裝置**：Mobile

#### 11a. Caregiver 確認候選

1. 切回 Mobile（caregiver 帳號 `demo@remotecare.dev`）
2. 服務 tab → 點入剛剛的「陪診師」需求
3. 看到「候選服務人員：陳照護員」
4. 點「**同意候選**」

**驗證**：
- [ ] 狀態變為「**家屬確認**」（caregiver_confirmed）

#### 11b. Provider 確認接案

5. **登出** caregiver 帳號（首頁右上角或設定）
6. 重新登入 `provider.demo@remotecare.dev` / `Provider1234!`
7. 看到底部 3 個 tab：我的任務、通知、個人資料
8. 進入確認接案頁面（透過通知或直接導航）
9. 點「**確認接案**」

**驗證**：
- [ ] 兩方都確認後，狀態自動變為「**已安排**」（arranged）
- [ ] 展示重點：雙向確認閉環

> **替代驗證**：回到 Admin 後台需求詳情頁，可以看到 caregiver_confirmed_at 和 provider_confirmed_at 兩個時間戳

---

### Step 12（7:30-8:00）— Provider 完成任務

**裝置**：Mobile（provider 帳號已登入）

1. 「**我的任務**」tab
2. 找到狀態為「已安排」的任務
3. 點入任務詳情
4. 點「**開始服務**」

**驗證**：
- [ ] 狀態變為「**服務中**」（in_service）

5. 點「**完成服務**」

**驗證**：
- [ ] 狀態變為「**已完成**」（completed）
- [ ] 展示重點：四角色閉環

---

## 額外驗證（選做）

### Patient 角色

1. 登出 provider
2. 登入 `patient.demo@remotecare.dev` / `Patient1234!`
3. 看到底部 2 個 tab：我的健康、提醒行程

**驗證**：
- [ ] 「我的健康」顯示王奶奶的量測數據（唯讀，無新增按鈕）
- [ ] 「提醒行程」顯示通知列表
- [ ] 介面為唯讀子集，不可執行寫入操作

### Admin 各頁面

- [ ] Dashboard：6 KPI 卡片 + 2 列表
- [ ] 需求單管理：狀態篩選 + 分頁
- [ ] 服務人員管理：列表 + 審核（通過/停用）
- [ ] 被照護者總覽：搜尋 + 委託人/量測統計
- [ ] 服務類別管理：8 類別 + 啟用/停用切換

---

## 通過標準

對應 `docs/implementation-spec.md` Section P 驗收標準：

### 功能驗收
- [ ] 12 步驟全部可操作
- [ ] 四角色（caregiver/patient/provider/admin）都能登入並看到正確介面
- [ ] 狀態機完整運轉：submitted → screening → candidate_proposed → caregiver_confirmed → (provider_confirmed →) arranged → in_service → completed
- [ ] Dashboard KPI 數據正確反映實際資料
- [ ] 異常量測有紅色標記
- [ ] AI 報告可生成或展示 seed 報告

### 技術驗收
- [ ] `pnpm lint` 通過（0 warnings）
- [ ] `pnpm typecheck` 通過
- [ ] `pnpm test` 通過（所有 test files pass）
- [ ] `pnpm build` 通過

### 狀態機完整路徑

```
submitted（已送出）
  ↓ admin 審核
screening（審核中）
  ↓ admin 提出候選
candidate_proposed（已推薦候選）
  ↓ caregiver 同意
caregiver_confirmed（家屬確認）
  ↓ provider 確認接案
arranged（已安排）← 自動轉換（雙方都確認時）
  ↓ provider 開始服務
in_service（服務中）
  ↓ provider 完成服務
completed（已完成）
```
