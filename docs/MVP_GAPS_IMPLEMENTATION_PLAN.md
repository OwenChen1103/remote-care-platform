# MVP 補齊實作計畫

> **文件版本**：1.0.0
> **建立日期**：2026-05-09
> **依據**：業主需求 PDF「健康平台App規劃資料.pdf」+ `docs/mvp-optimization-plan.md`
> **目的**：把目前 MVP 範圍內**真正還缺的**資料／服務／表單欄位補齊，避免新舊邏輯並存。
> **撰寫前置**：本文每個項目都已實際讀過對應檔案的當前實作，確認是「真的缺」而非「以為缺」。

---

## 0. 重要前提

### 0.1 文件對其他文件的關係

- `docs/mvp-optimization-plan.md` v1.1.0 — Sprint 1~8 共 28 個 OPT 項目的計畫
- 本文 — Sprint 1~8 完成後，再次對 PDF 做欄位級 audit 找出的**剩餘 12 個缺口**

### 0.2 命名規約

本文用 **G1~G12** 編號（Gap 1~12），跟舊的 OPT 編號**完全分開**，避免混淆。

### 0.3 動工順序原則

**A (純前端微調) → B (前端表單擴充) → C (Schema/API 補齊) → D (大工程)**

每階段獨立、可單獨 ship，不互相 block。

---

## 1. 已驗證 ✅ 已實作（重要：不要再做一遍）

下列 5 項在前一輪總檢時被誤判為缺，**實際已做**：

| 項目 | 已實作位置 | 命名線索（之前 grep 沒抓到的原因） |
|---|---|---|
| **OPT-15 補遺** Provider 任務頁 7 天行事曆 bar | [provider-tasks.tsx:301-322](apps/mobile/app/(tabs)/services/provider-tasks.tsx#L301-L322) + [:526-540](apps/mobile/app/(tabs)/services/provider-tasks.tsx#L526-L540) | 變數叫 `weekDates`，不是 `calendar`/`dateBar` |
| Provider 候選卡顯示 photo_url | [(tabs)/services/[requestId].tsx:566-567](apps/mobile/app/(tabs)/services/[requestId].tsx#L566-L567) | 顯示端 OK，缺的只是上傳端（見 G12） |
| Recipient lifestyle_habits 寫入端 + Schema | [packages/shared/src/schemas/recipient.ts:16-23](packages/shared/src/schemas/recipient.ts#L16-L23) + [add-recipient.tsx:182-194](apps/mobile/app/(tabs)/home/add-recipient.tsx#L182-L194) | 寫入完整，但**讀回缺**（見 G2 + G6） |
| Provider 審核通知 fan-out | [providers/[id]/review/route.ts:94](apps/web/app/api/v1/providers/[id]/review/route.ts#L94) | 已有 `prisma.notification.create` |
| Health-score utility | [packages/shared/src/utils/health-score.ts](packages/shared/src/utils/health-score.ts) | 純函式已抽出 |

**動工前再次驗收**：開始任何 G 項目前先 grep 一次本表的「命名線索」確認沒被搬家。

---

## 2. 缺漏項一覽（共 12 項，依階段排序）

| 編號 | 項目 | 階段 | 工時 | 影響範圍 | 需要 migration |
|---|---|---|---|---|---|
| G1 | Provider onboarding 缺「居住地址」 | A | 30 min | 1 file | ❌ |
| G2 | 委託人 profile 必填驗證 | A | 30 min | 1 file | ❌ |
| G3 | 漢堡選單「設定」項目 | A | 30 min | 1 file | ❌ |
| G4 | 陪診「診別」+ G4.b metadata 顯示端共用基建 | A | **1.5 hr** | 1 file (寫) + 3 files (顯示) + 1 共用常數 | ❌ |
| G5 | Provider「相關證照 vs 其他證照」UI 拆 | A | 1 hr | 1 file | ❌ |
| G6 | Recipient edit 補生活習慣 + 後端讀回 + **詳情顯示** | B+C | **3 hr** | 6 files (含 mobile 詳情 + admin 詳情)| ❌ |
| G7 | Provider post-onboarding 補編輯入口 | B | 4 hr | 1 new file + 1 modify | ❌ |
| G8 | 服務需求 — 證照偏好 metadata（顯示端沿用 G4.b）| B | 1 hr | 1 file | ❌ |
| G9 | 陪診 — 醫院 dropdown | B | 1.5 hr | 2 files (+ 常數) | ❌ |
| G10 | 服務需求 — 縣市/區域階層 | B | 2.5 hr | 2 files (+ 常數) | ❌ |
| G11 | Recipient 聯絡電話 label 改名 | C | 30 min | 5 files | ❌ |
| G12 | Provider 個人照片上傳（含 G12.0 api.upload helper）| D | 1.5 day | 6+ files + 新 dep | ⚠️ 視選法 |

**Phase A 總計：~4 hr**（無 migration、純 UI + metadata 顯示端）
**Phase B 總計：~12 hr**（純前端、metadata 擴充、無 migration）
**Phase C 總計：~30 min**（純 label 改名）
**Phase D 總計：~1.5 day**（涉及檔案儲存基礎建設）

**新增工時來源**：
- G4 +1 hr（補 metadata 顯示端，含既有欄位 department/doctor_name 等）
- G6 +1 hr（補 lifestyle_habits 顯示端）
- G12 隱含 +1 hr（補 api.upload helper，已併入 1.5 day）

---

## 3. Phase A — 純前端微調（3 hr）

### G1 · Provider onboarding 補「居住地址」

**業主原文（PDF p7）**：「基本資料：姓名*、生日*、email*、聯絡方式*、**居住地址***、學歷科系...」

**現況（已驗）**：
- `User.address` 欄位**已存在**（OPT-07 加的）
- `PUT /api/v1/auth/me` **已支援** `address`（[auth/me/route.ts:74-78](apps/web/app/api/v1/auth/me/route.ts#L74-L78)，UpdateProfileSchema 已含 address）
- Provider onboarding [`provider-profile.tsx:344-417`](apps/mobile/app/(tabs)/services/provider-profile.tsx#L344-L417) 沒這個欄位，現有結構：聯絡電話 → 生日 → 學歷科系 → 年資

**修法**：完全不動 backend 跟 schema，只在 onboarding form 加一個 address TextInput，跟生日一樣走 `PUT /auth/me`。

**注意（避免重複）**：
- 生日已經這樣做了（line 215-220），mirror 同樣的 partial-success 模式（如果地址送失敗也不要 fail 整張表）
- 不要把 address 放進 Provider model，因為 User.address 是單一真相來源

**具體改法（在 `provider-profile.tsx`）**：

1. State：在 line 162 附近加 `const [obAddress, setObAddress] = useState('');`
2. 表單：在「生日」（line ~362-394）和「學歷科系」之間插一個 address field（複用 `s.input` style）
3. 送出：在 `submitOnboarding` 的 dobError 處理區塊（line 215-226）合併送出
   ```ts
   if (obAddress.trim() || obDateOfBirth.trim()) {
     try {
       await api.put('/auth/me', {
         ...(obDateOfBirth.trim() ? { date_of_birth: obDateOfBirth.trim() } : {}),
         ...(obAddress.trim() ? { address: obAddress.trim() } : {}),
       });
     } catch (e) {
       dobError = e instanceof ApiError ? e.message : '個人資料儲存失敗';
     }
   }
   ```
   把 dobError 的 alert 訊息從「生日未能儲存」改成「個人資料未能儲存」（涵蓋範圍變大）

---

### G2 · 委託人 profile 必填驗證

**業主原文（PDF p1-2）**：姓名*、生日*、email*、聯絡方式*、居住地址*（5 項都標 ★）

**現況（已驗）**：
- [profile.tsx:113-116](apps/mobile/app/(tabs)/home/profile.tsx#L113-L116) `handleSave` **只驗證 name**
- 其他 4 個都是 optional + placeholder「選填」

**業務決策**：**業主說過必填，就認真當必填**。寬鬆放行會造成媒合時資料不全。

**修法**：在 [profile.tsx:113](apps/mobile/app/(tabs)/home/profile.tsx#L113) 後加：
```ts
if (!phone.trim()) { setError('聯絡電話為必填'); return; }
if (!dateOfBirth.trim()) { setError('生日為必填'); return; }
if (!address.trim()) { setError('居住地址為必填'); return; }
```

**並更新 placeholder 拿掉「選填」字樣**（line 200, 214, 251）。

**注意（避免重複）**：
- 不要動 `UpdateProfileSchema`（後端寬鬆讓 PUT 部分欄位更新是有意的，admin 改帳號時不該被前端必填擋）
- 必填只在 UI 層做，schema 維持選填

---

### G3 · 漢堡選單「設定」項目

**業主原文（PDF p1）**：「左下漢堡頁：個人資料管理、首頁、訂單紀錄、**設定**等項目」

**現況（已驗）**：
- 目前 menu groups（[home/index.tsx:757-818](apps/mobile/app/(tabs)/home/index.tsx#L757-L818)）：
  - 「我的」：個人資料、通知中心
  - 「照護管理」：新增被照護者、服務需求紀錄
  - 登出
- 沒有「設定」入口

**修法（最小入侵）**：
- 不新建設定頁
- 在「我的」 group 加一個「量測提醒設定」item
- 點擊後若只有 1 位 recipient，直接跳到 `/(tabs)/home/{recipientId}` 該 recipient 的提醒區段；若 0 位，alert「請先新增被照護者」；若多位，跳到 recipients 列表並提示

**為什麼這樣做**：
- recipient detail 頁已經有 measurement_reminders 區（避免重做）
- 業主原文寫「設定」是泛稱，量測提醒是 MVP 唯一有意義的設定項目

**具體改法（在 [home/index.tsx](apps/mobile/app/(tabs)/home/index.tsx)）**：

1. 在 line 759-761「我的」group 陣列加：
   ```ts
   { label: '量測提醒', icon: 'bell', onPress: () => {
     if (recipients.length === 0) Alert.alert('提示', '請先新增被照護者');
     else if (recipients.length === 1) router.push(`/(tabs)/home/${recipients[0]!.id}#reminders`);
     else router.push('/(tabs)/home');
   }},
   ```
2. icon 直接複用 'bell'（已經有 SVG path）— 但通知中心也用 bell 重複；改用新 icon 'clock' 或 'alarm'，新增對應 SVG

**注意**：
- 不要建獨立 `/(tabs)/home/settings.tsx`，會跟既有 reminder UI 並存
- 等到有第 2、3 種設定再考慮獨立頁面

---

### G4 · 陪診表單補「診別」

**業主原文（PDF p3 (5)）**：「預約時間：醫院掛號**科別、診別**、醫師姓名、掛號號碼」

**現況（已驗）**：
- [new-request.tsx:228-230](apps/mobile/app/(tabs)/services/new-request.tsx#L228-L230) metadata 寫 `department`、`doctor_name`、`registration_number`
- 沒有「診別」（早診/午診/夜診）

**修法**：metadata 加 `session` 欄位（chip 三選一）。

**為什麼放 metadata 不開新欄位**：
- ServiceRequest schema 已有 `metadata Json` 容器，設計上就是給 category-specific 欄位用的
- 開 column 會破壞 metadata 設計初衷，造成混亂

**具體改法（[new-request.tsx](apps/mobile/app/(tabs)/services/new-request.tsx)）**：

1. State：在 line 145 附近加 `const [session, setSession] = useState('');`
2. Reset：在 `useEffect` reset 區塊（line 176-188）加 `setSession('');`
3. 表單：在「掛號號碼」（line 513-521）下方加：
   ```tsx
   <Text style={styles.label}>診別</Text>
   <View style={styles.chipRow}>
     {[
       { value: 'morning',   label: '早診' },
       { value: 'afternoon', label: '午診' },
       { value: 'evening',   label: '夜診' },
     ].map((opt) => {
       const isActive = session === opt.value;
       return (
         <TouchableOpacity
           key={opt.value}
           style={[styles.chip, isActive && styles.chipActive]}
           onPress={() => setSession(isActive ? '' : opt.value)}
           activeOpacity={0.7}
         >
           <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
         </TouchableOpacity>
       );
     })}
   </View>
   ```
4. metadata 寫入：line 228 區塊加 `if (session) metadata.session = session;`

**Backend 行為**：metadata 是 `z.record(z.unknown())`（[service-request.ts:41](packages/shared/src/schemas/service-request.ts#L41)），自動接受新 key，不需動。

#### G4.b — Metadata 顯示端（共用於 G4 + G8）

**重要前提**：經 audit 發現 ServiceRequest 的 `metadata` 在**所有顯示端目前都沒被讀出來**。包括既有的 `department` / `doctor_name` / `registration_number` / `needs_pickup` / `preferred_gender` 等也是收了不顯示。

**範圍**：這已是預存問題，但這次新增 G4 (`session`) + G8 (`preferred_certifications`) 收了還沒顯示也是同問題。**這次一次補完**。

**3 個顯示點**：

1. **[mobile [requestId].tsx](apps/mobile/app/(tabs)/services/[requestId].tsx)** — 需求單詳情頁（caregiver/patient 看）
   - 在「服務類別」與「Timeline」之間加「**詳細資訊**」section，呈現所有 metadata key
   - 用簡單 KV 列表（`<Row label="掛號科別" value={metadata.department} />`）

2. **[mobile provider-task-detail.tsx](apps/mobile/app/(tabs)/services/provider-task-detail.tsx)** — provider 看任務詳情
   - 同樣加「詳細資訊」section
   - 服務人員需要這些資訊才能準備（科別、診別、醫院等）

3. **[admin/service-requests/[id]/page.tsx](apps/web/app/admin/service-requests/[id]/page.tsx)** — admin 詳情頁
   - 加 metadata 顯示區塊，admin 媒合時要看

**統一的 label 對照表**（在 packages/shared 加 `metadata-labels.ts` 共用，避免三處抄三遍）：

```ts
export const SERVICE_METADATA_LABELS: Record<string, { label: string; format?: (v: unknown) => string }> = {
  department: { label: '掛號科別' },
  doctor_name: { label: '醫師姓名' },
  registration_number: { label: '掛號號碼' },
  session: { label: '診別', format: (v) => ({ morning: '早診', afternoon: '午診', evening: '夜診' } as Record<string, string>)[v as string] ?? String(v) },
  needs_pickup: { label: '需要接送', format: (v) => v ? '是' : '否' },
  preferred_gender: { label: '服務人員性別偏好', format: (v) => ({ female: '女性', male: '男性' } as Record<string, string>)[v as string] ?? '不限' },
  preferred_certifications: { label: '證照偏好', format: (v) => Array.isArray(v) ? (v as string[]).join('、') : String(v) },
  exercise_type: { label: '運動類型', format: (v) => ({ post_surgery: '術後保養', muscle_training: '肌力訓練', general: '一般運動' } as Record<string, string>)[v as string] ?? String(v) },
  space_size: { label: '空間坪數', format: (v) => `${v} 坪` },
  has_pets: { label: '有養寵物', format: (v) => v ? '是' : '否' },
};
```

3 個顯示頁面都 import 這個常數，遍歷 metadata 用 label 顯示。

**工時調整**：G4 從 30 min 變 **30 min + 1 hr 顯示端 = 1.5 hr**；G8 從 1 hr 變 **1 hr + 0 hr (沿用 G4 的顯示端)** = 1 hr 不變。

---

### G5 · Provider「相關證照 vs 其他證照」UI 拆兩格

**業主原文（PDF p7）**：「**相關證照、其他證照**、可接案項目（陪診、基礎檢測、運動養生、居家打掃）」

**現況（已驗）**：
- [provider-profile.tsx:430-434](apps/mobile/app/(tabs)/services/provider-profile.tsx#L430-L434) 只有一個 obCertifications 文字框
- Schema `Provider.certifications` 是 `Json default([])`（單一 array）

**業務決策**：
- **不動 schema**（避免遷移成本）
- UI 拆兩格：「相關證照」、「其他證照」
- 兩格內容用 `;` 串起放進同一個 certifications array：`'護理師執照,照服員證;駕照,急救證'`
  - 前面的是相關，後面是其他
  - 用 `;` 分隔兩類，沒有就省略
  - Backend 只看到 `certifications: string[]`，無感

**為什麼這樣做**：
- 業主提這兩個欄位的差異主要是給人類看的分類（相關 vs 其他）
- Schema 拆兩個 column 會牽動候選卡片顯示、Admin 審核頁面等多處，不划算
- 用 `;` 分隔是輕量約定，未來真的要區分也只是後端解析改造

**具體改法（[provider-profile.tsx](apps/mobile/app/(tabs)/services/provider-profile.tsx)）**：

1. State：把 `obCertifications` 拆成 `obRelatedCerts` + `obOtherCerts`（line 167）
2. UI：把現有 line 426-435 那塊拆成兩個 field：
   ```tsx
   <View style={s.field}>
     <Text style={s.fieldLabel}>相關證照</Text>
     <TextInput
       style={s.input}
       value={obRelatedCerts}
       onChangeText={setObRelatedCerts}
       placeholder="跟接案項目相關的證照（多項以逗號分隔）"
       placeholderTextColor={colors.textDisabled}
     />
   </View>
   <View style={s.field}>
     <Text style={s.fieldLabel}>其他證照</Text>
     <TextInput
       style={s.input}
       value={obOtherCerts}
       onChangeText={setObOtherCerts}
       placeholder="其他擁有的證照（選填）"
       placeholderTextColor={colors.textDisabled}
     />
   </View>
   ```
3. 送出：line 197-199 改成：
   ```ts
   const related = obRelatedCerts.split(',').map(s => s.trim()).filter(Boolean);
   const other = obOtherCerts.split(',').map(s => s.trim()).filter(Boolean);
   if (related.length > 0 || other.length > 0) {
     payload.certifications = other.length > 0
       ? [...related, ';', ...other]  // ';' 作為類別分隔標記
       : related;
   }
   ```

**顯示端（已驗無改動）**：[provider-profile.tsx:657-673](apps/mobile/app/(tabs)/services/provider-profile.tsx#L657-L673) 顯示 certifications 是平鋪的 chip group，看到 `;` 會渲染成空 chip — 需要在這裡 filter 掉 `;`：
```tsx
profile.certifications.filter(c => c !== ';').map((c) => ...)
```

候選卡片 [(tabs)/services/[requestId].tsx:587-588](apps/mobile/app/(tabs)/services/[requestId].tsx#L587-L588) 同樣處理。

---

## 4. Phase B — 前端表單擴充（10 hr）

### G6 · Recipient edit 補生活習慣 + 後端讀回

**業主原文（PDF p2）**：被照護者資料 7. 生活習慣*（每日喝水量、運動頻次、運動強度、澱粉補充量、蛋白質補充量）+ 可勾選「讓健康管家幫忙填寫」

**現況（已驗）**：
- [add-recipient.tsx:130-194](apps/mobile/app/(tabs)/home/add-recipient.tsx#L130-L194) ✅ **寫入完整**
- [`[recipientId]/edit.tsx`](apps/mobile/app/(tabs)/home/[recipientId]/edit.tsx) ❌ **讀取與寫入都沒這 6 個欄位**
- ⚠️ **重要漏洞**：[format-recipient.ts:9-44](apps/web/lib/format-recipient.ts#L9-L44) **不回傳 `lifestyle_habits`**！意思是即使 add-recipient 寫進 DB 了，GET /recipients/{id} 讀回來的物件**沒有 `lifestyle_habits` 欄位**。
- ⚠️ [shared/schemas/recipient.ts:39-58](packages/shared/src/schemas/recipient.ts#L39-L58) `RecipientResponseSchema` 也沒列 `lifestyle_habits`

**修法**：跨前後端三步走

#### G6.1 — 後端 formatRecipient 加上 lifestyle_habits

**檔案**：[apps/web/lib/format-recipient.ts](apps/web/lib/format-recipient.ts)

```ts
// In type signature (line 9-25)
export function formatRecipient(r: {
  ...existing fields...
  lifestyle_habits: unknown;  // 新增
}) {
  return {
    ...existing fields...
    lifestyle_habits: (r.lifestyle_habits as Record<string, unknown>) ?? {},  // 新增
    ...
  };
}
```

**確認 select 帶得進來**：搜尋 `formatRecipient(` 在 codebase 全部呼叫處，確認 prisma query 有 `select: { ..., lifestyle_habits: true }` 或沒有 select（預設返回所有欄位）。**用 grep 驗證所有 caller**。

#### G6.2 — Shared schema 加上 lifestyle_habits

**檔案**：[packages/shared/src/schemas/recipient.ts](packages/shared/src/schemas/recipient.ts)

`RecipientResponseSchema`（line 39-58）加：
```ts
lifestyle_habits: z.object({
  water_intake: z.string().optional(),
  exercise_frequency: z.string().optional(),
  exercise_intensity: z.string().optional(),
  starch_intake: z.string().optional(),
  protein_intake: z.string().optional(),
  manager_fill: z.boolean().optional(),
}).default({}),
```

**為什麼複製貼上 not 抽出 const**：
- `RecipientCreateSchema.lifestyle_habits` 是 `.optional()`（line 16-23）
- `RecipientResponseSchema.lifestyle_habits` 應是 `.default({})`（永遠回傳物件）
- 語義不同，分開定義更清楚

#### G6.3 — Mobile edit.tsx 加 UI

**檔案**：[apps/mobile/app/(tabs)/home/[recipientId]/edit.tsx](apps/mobile/app/(tabs)/home/[recipientId]/edit.tsx)

1. **Type**：line 41 附近 `Recipient` interface 加 `lifestyle_habits?: Record<string, unknown>;`
2. **State**（line 122 附近）：
   ```ts
   const [waterIntake, setWaterIntake] = useState('');
   const [exerciseFrequency, setExerciseFrequency] = useState('');
   const [exerciseIntensity, setExerciseIntensity] = useState('');
   const [starchIntake, setStarchIntake] = useState('');
   const [proteinIntake, setProteinIntake] = useState('');
   const [managerFillLifestyle, setManagerFillLifestyle] = useState(false);
   ```
3. **fetchRecipient hydrate**（line 161-172）：
   ```ts
   const lh = (data.lifestyle_habits ?? {}) as Record<string, string | boolean | undefined>;
   setWaterIntake(typeof lh.water_intake === 'string' ? lh.water_intake : '');
   setExerciseFrequency(typeof lh.exercise_frequency === 'string' ? lh.exercise_frequency : '');
   setExerciseIntensity(typeof lh.exercise_intensity === 'string' ? lh.exercise_intensity : '');
   setStarchIntake(typeof lh.starch_intake === 'string' ? lh.starch_intake : '');
   setProteinIntake(typeof lh.protein_intake === 'string' ? lh.protein_intake : '');
   setManagerFillLifestyle(lh.manager_fill === true);
   ```
4. **handleSave 序列化**（line 198-217）：複製 [add-recipient.tsx:182-194](apps/mobile/app/(tabs)/home/add-recipient.tsx#L182-L194) 那段 lifestyle payload 邏輯
5. **UI**：複製 add-recipient 對應 section（你需要去看 add-recipient.tsx 全貌，本文不重複貼）

**避免重複的鐵則**：
- ⚠️ **不要**為了 edit 寫一個跟 add 不同的 lifestyle UI，會兩套並存
- 建議抽出一個共用 component `<LifestyleHabitsForm>`，add 和 edit 都引用，只傳 state setter
  - 路徑建議：`apps/mobile/components/forms/LifestyleHabitsForm.tsx`
  - 工時：抽出 + 兩處引用 ≈ 抽不抽差不多 1 hr，但**未來改一次就 OK**
  - 如趕進度可以先複製貼上，標 TODO 等下次重構

#### G6.4 — Recipient 詳情頁顯示 lifestyle_habits

**現況（已驗）**：[mobile [recipientId]/index.tsx](apps/mobile/app/(tabs)/home/[recipientId]/index.tsx) 跟 [admin/recipients/[id]/page.tsx](apps/web/app/admin/recipients/[id]/page.tsx) **都沒顯示** lifestyle_habits — 收了沒地方看。

**修法**：在兩處詳情頁加「生活習慣」section：
- 顯示 5 個欄位：每日喝水量 / 運動頻次 / 運動強度 / 澱粉補充量 / 蛋白質補充量
- 若 `manager_fill === true`，顯示「（由健康管家代填）」標籤
- 若全空且非 manager_fill → 顯示空狀態「尚未填寫」

**工時**：mobile 30 min + admin 30 min = 額外 **1 hr**，併進 G6 總工時 → G6 從 2 hr 變 3 hr。

#### G6.5 — formatRecipient caller 的 prisma select 檢查

**為什麼要這步**：如果某個呼叫者用了 `select: { ... }` 顯式限制欄位（沒 select lifestyle_habits），就算 formatRecipient 加了，回傳還是 undefined。

**檢查清單**（grep `formatRecipient(` 的所有 caller）：
- [`apps/web/app/api/v1/recipients/route.ts`](apps/web/app/api/v1/recipients/route.ts)
- [`apps/web/app/api/v1/recipients/[id]/route.ts`](apps/web/app/api/v1/recipients/[id]/route.ts)
- [`apps/web/app/api/v1/admin/recipients/route.ts`](apps/web/app/api/v1/admin/recipients/route.ts)
- [`apps/web/app/api/v1/admin/recipients/[id]/route.ts`](apps/web/app/api/v1/admin/recipients/[id]/route.ts)

每個檔案找 prisma query → 若用 `select`，加上 `lifestyle_habits: true`；若用預設（無 select），不用動。

---

### G7 · Provider post-onboarding 補編輯入口（含可接案時段）

**業主原文（PDF p7 一般登入）**：「可接案資料設定（**日期、時段**、項目、備註）」

**現況（已驗）**：
- Schema 已有 `available_schedule Json`、`schedule_note String?`（已 migrate）
- API `PUT /provider/me` 已支援這兩個欄位（[ProviderSelfUpdateSchema:48-49](packages/shared/src/schemas/provider.ts#L48-L49)）
- **但 mobile UI 完全沒有編輯入口**：[provider-profile.tsx:511-720](apps/mobile/app/(tabs)/services/provider-profile.tsx#L511-L720) post-onboarding 模式整個是 read-only InfoRow + 兩個 toggle（availability_status + available_services）

**範圍提醒**：這不是只有「可接案時段」缺，而是**整個 approved 後的個人資料編輯都沒做**。Provider 想改電話、學歷、證照都改不了。需求單上的服務人員資料一旦審核完就凍結。

**修法**：在 post-onboarding view 加「編輯個人資料」按鈕 + 編輯模態（或子頁）。

**設計選擇 — 模態 vs 子頁**：

| 選項 | 優點 | 缺點 |
|---|---|---|
| 模態（同頁 Modal）| 不切頁、體驗連貫 | 內容多時會擠 |
| 子頁（push provider-edit.tsx）| 內容多容納佳、跟 add-recipient/edit 模式一致 | 多一個檔案 |

**建議走子頁**（跟 recipient 模式一致），新增 `apps/mobile/app/(tabs)/services/provider-edit.tsx`。

**檔案配置**：
```
apps/mobile/app/(tabs)/services/
├── provider-profile.tsx   ← 顯示用（已存在），加「編輯」按鈕
└── provider-edit.tsx      ← 新建，編輯 form
```

**provider-edit.tsx 大綱**：
```ts
// 從 GET /provider/me 拿初值（跟 onboarding 一樣）
// 同時 GET /auth/me 拿 phone/address/date_of_birth（這些在 User 不在 Provider）
// 表單欄位：
//   - 聯絡電話        → PUT /provider/me { phone }
//   - 學歷科系        → PUT /provider/me { education }
//   - 年資            → PUT /provider/me { experience_years }
//   - 相關證照        → PUT /provider/me { certifications: [...] }
//   - 其他證照        → 同上（用 ';' 分隔，見 G5）
//   - 服務區域        → PUT /provider/me { service_areas: [...] }
//   - 可接案項目       → PUT /provider/me { available_services: [...] }
//   - 可接案時段       → PUT /provider/me { available_schedule, schedule_note }  ← G7 重點
//   - 居住地址        → PUT /auth/me { address }  ← 走 user
//   - 生日            → PUT /auth/me { date_of_birth }  ← 走 user
```

**「可接案時段」UI 規格**：

7 天 × 3 時段網格（mon/tue/.../sun × morning/afternoon/evening）

```ts
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const SLOTS = ['morning', 'afternoon', 'evening'] as const;
const DAY_LABELS = { mon: '一', tue: '二', wed: '三', thu: '四', fri: '五', sat: '六', sun: '日' };

// State: Record<DayKey, SlotKey[]>
const [schedule, setSchedule] = useState<Record<string, string[]>>({});

function toggleSlot(day: string, slot: string) {
  setSchedule((prev) => {
    const slots = prev[day] ?? [];
    const next = slots.includes(slot) ? slots.filter(s => s !== slot) : [...slots, slot];
    return { ...prev, [day]: next };
  });
}

// UI: 7 row, 每 row 是 day label + 3 個 chip
```

**送出**：
```ts
await api.put('/provider/me', {
  available_schedule: schedule,
  schedule_note: scheduleNote.trim() || null,
});
```

**已存在的 ProviderSelfUpdateSchema 對應**（line 48）：
```ts
available_schedule: z.record(z.array(z.string())).optional(),
```
完全相容。

**注意（避免重複）**：
- 不要在 provider-profile.tsx 直接 inline 編輯 — 那檔已經很長
- 編輯按鈕加在 [provider-profile.tsx:531](apps/mobile/app/(tabs)/services/provider-profile.tsx#L531) heroBadgesRow 旁邊，或 line 720 上方
- 同樣抽 `<ProviderEditForm>` component 是 nice-to-have 但 MVP 直接 inline 在 provider-edit.tsx 即可

---

### G8 · 服務需求補「相關專業證照偏好」

**業主原文（PDF p3 (6)）**：「其他設定：是否需要接送/服務人員性別/**相關專業證照**」

**現況（已驗）**：
- [new-request.tsx:228-240](apps/mobile/app/(tabs)/services/new-request.tsx#L228-L240) 陪診 metadata 寫 `department`/`doctor_name`/`registration_number`/`needs_pickup`/`preferred_gender`
- 沒有「指定要求服務人員具備什麼證照」的欄位

**業務理解**：
- 這欄位的意義是「我希望媒合到的服務人員具備 ___ 類證照」（如「護理師執照」、「照服員證」）
- 是給 Admin 媒合時的篩選參考，不是必填

**修法**：metadata 加 `preferred_certifications: string[]`，UI 用多選 chip。

**陪診 + 運動養生兩處都要加**（PDF p3、p4）。

**具體改法（[new-request.tsx](apps/mobile/app/(tabs)/services/new-request.tsx)）**：

1. State（line 145 附近）：`const [preferredCerts, setPreferredCerts] = useState<string[]>([]);`
2. Reset：useEffect reset 區加 `setPreferredCerts([]);`
3. 常數：檔案頂部加：
   ```ts
   const CERTIFICATION_OPTIONS = [
     { value: 'nursing',          label: '護理師' },
     { value: 'caregiver',        label: '照服員' },
     { value: 'physical_therapy', label: '物理治療師' },
     { value: 'occupational',     label: '職能治療師' },
     { value: 'first_aid',        label: '急救證照' },
   ] as const;
   ```
4. UI：在陪診的「服務人員性別偏好」（line 534-553）下方加 chip 多選 group
5. 同樣的 UI 也加到運動養生 section（line 575-638），位置在「服務人員性別偏好」上方
6. metadata 寫入：陪診 + 運動養生兩個 if 區塊都加 `if (preferredCerts.length > 0) metadata.preferred_certifications = preferredCerts;`

**Admin 端使用**：本次先**不**做 candidate 自動篩選（避免 scope 蔓延）。Admin 在 [admin/service-requests/[id]/page.tsx](apps/web/app/admin/service-requests/[id]/page.tsx) 看到 metadata.preferred_certifications 後手動參考即可。

---

### G9 · 陪診補「醫院 dropdown 選單」

**業主原文（PDF p3）**：「抵達地：縣市/區域/**醫院選單**（保留其他可手動填寫）」

**現況（已驗）**：
- [new-request.tsx:486-493](apps/mobile/app/(tabs)/services/new-request.tsx#L486-L493) destination 是純 TextInput
- 沒有醫院 preset list

**修法**：新增常數檔 + UI 改為「常見醫院 chip + 自填」混合模式。

**檔案 1（新增）**：`apps/mobile/lib/constants/hospitals.ts`

```ts
/**
 * Common hospitals presets — lightweight curated list (not authoritative).
 * For MVP. Future: replace with an API-backed Hospital table if needed.
 */
export const COMMON_HOSPITALS = [
  '台大醫院',
  '台北榮民總醫院',
  '三軍總醫院',
  '馬偕紀念醫院',
  '林口長庚醫院',
  '台中榮民總醫院',
  '中國醫藥大學附設醫院',
  '高雄醫學大學附設醫院',
  '高雄長庚醫院',
  '成大醫院',
];
```

**檔案 2 修改**：[new-request.tsx](apps/mobile/app/(tabs)/services/new-request.tsx)

UI 改成：
```tsx
<Text style={styles.label}>目的地（醫院）</Text>
<View style={styles.chipRow}>
  {COMMON_HOSPITALS.map((h) => {
    const isActive = destination === h;
    return (
      <TouchableOpacity key={h} style={[styles.chip, isActive && styles.chipActive]}
        onPress={() => setDestination(isActive ? '' : h)} activeOpacity={0.7}>
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{h}</Text>
      </TouchableOpacity>
    );
  })}
</View>
<TextInput
  style={styles.input}
  value={COMMON_HOSPITALS.includes(destination) ? '' : destination}
  onChangeText={setDestination}
  placeholder="不在清單內？直接輸入醫院名稱或地址"
  placeholderTextColor={colors.textDisabled}
/>
```

**為什麼用 chip + free text 並存**：
- chip 點選會把 destination 設成醫院名（覆蓋 free text）
- free text 在沒選 chip 時可手動輸入；當 destination 是 preset 醫院時 free text 會清空避免顯示重複

**注意**：
- 不要建 `Hospital` table — MVP 用常數即可
- 後端 `destination` 仍是 free string（不需 schema 改）

---

### G10 · 服務需求補「縣市/區域階層」

**業主原文（PDF p4 運動養生 (3)(4)、p5 居家打掃 (3)(4)）**：「縣市」「區域」**兩個獨立欄位**

**現況（已驗）**：
- 只有單一 `location` 文字欄位
- 沒有縣市常數，沒有階層 dropdown

**修法**：新增常數檔 + UI 用兩級 dropdown 組合，最終 location 仍是字串（後端不變）。

**檔案 1（新增）**：`apps/mobile/lib/constants/taiwan-regions.ts`

```ts
/**
 * Minimal Taiwan city/district list (top 6 cities for MVP).
 * Future: expand or fetch from API.
 */
export const TW_REGIONS: { city: string; districts: string[] }[] = [
  { city: '台北市', districts: ['中正區','大同區','中山區','松山區','大安區','萬華區','信義區','士林區','北投區','內湖區','南港區','文山區'] },
  { city: '新北市', districts: ['板橋區','三重區','中和區','永和區','新莊區','新店區','土城區','蘆洲區','汐止區','樹林區','其他'] },
  { city: '桃園市', districts: ['桃園區','中壢區','平鎮區','八德區','楊梅區','龜山區','龍潭區','其他'] },
  { city: '台中市', districts: ['中區','東區','南區','西區','北區','北屯區','南屯區','西屯區','太平區','大里區','其他'] },
  { city: '台南市', districts: ['東區','南區','北區','安南區','安平區','永康區','其他'] },
  { city: '高雄市', districts: ['新興區','前金區','苓雅區','鹽埕區','鼓山區','三民區','左營區','楠梓區','其他'] },
];
```

**檔案 2 修改**：[new-request.tsx](apps/mobile/app/(tabs)/services/new-request.tsx)

新增 city/district state，渲染兩級 chip 或 picker：

```ts
const [city, setCity] = useState('');
const [district, setDistrict] = useState('');

const districtOptions = useMemo(() => 
  TW_REGIONS.find(r => r.city === city)?.districts ?? [], [city]);

useEffect(() => { setDistrict(''); }, [city]);  // 換縣市清空區域

// 在 location label 區塊上方加：
<Text style={styles.label}>縣市</Text>
<View style={styles.chipRow}>
  {TW_REGIONS.map(r => /* chip for r.city */)}
</View>
{city && (
  <>
    <Text style={styles.label}>區域</Text>
    <View style={styles.chipRow}>
      {districtOptions.map(d => /* chip for d */)}
    </View>
  </>
)}
```

**送出時**：
```ts
// location 用兩級組合 + 詳細地址
const composedLocation = [city, district, location].filter(Boolean).join(' ');
await api.post('/service-requests', {
  ...其他,
  location: composedLocation,
});
```

**重要**：
- 「服務地點」label 改成「**詳細地址**」（line 450），placeholder 改「街道門牌號」
- 業主原文 location 對運動養生＋居家打掃才需要拆，**陪診不需要**（陪診用 departure_location/destination）
- 因此這兩個 chip group 只在 `selectedCategoryCode === 'exercise_program' || selectedCategoryCode === 'home_cleaning'` 時 render

**避免重複**：
- 不要為陪診的 departure_location 也做 city/district — 那是 outoff scope，PDF 沒明確要求
- 縣市資料不要寫進 packages/shared（純 mobile 顯示用，不需要型別共用）

---

## 5. Phase C — 涉及 Schema/Backend 的補齊

### G11 · Recipient 主要聯絡電話（語義決策）

**業主原文（PDF p2 (5)）**：家屬資料「**聯絡方式***」（被照護者本人的）

**現況（已驗）**：
- Recipient 表單填的是 `emergency_contact_name` + `emergency_contact_phone`（**緊急聯絡人**的，是另一個人）
- 如果被照護者沒綁 patient User → 沒地方存他本人的電話

**業務決策（兩選一）**：

#### 選項 A — 改 label（30 min，無 migration）
不動 schema，把 `emergency_contact` 在 UI 重新定義為「主要聯絡電話 / 備援聯絡人」。Recipient 表單把這欄改名：

| 舊 label | 新 label | 說明 |
|---|---|---|
| 緊急聯絡人姓名 | 主要聯絡人姓名 | 通常就是被照護者自己；無自理能力者填家屬 |
| 緊急聯絡人電話 | 主要聯絡電話 | 同上 |

**優點**：零成本、無 migration
**缺點**：語義不夠精確（沒有 emergency 跟 primary 的區別）

#### 選項 B — 加新欄位（2 hr，有 migration）
Schema 加 `Recipient.recipient_phone String?`，跟 emergency_contact_phone 並存，意義分開。

需要：
- Prisma migration（additive）
- Shared `RecipientCreateSchema`/`UpdateSchema`/`ResponseSchema` 加 recipient_phone
- formatRecipient 加 recipient_phone
- Mobile add-recipient + edit + 詳情頁顯示

**優點**：語義清楚
**缺點**：成本高，且實務上 90% 案例 primary = emergency

**建議**：**走選項 A**。MVP 不值得為這個語義差距開新欄位。Phase 2 再考慮。

**選項 A 具體改法**（5 個顯示點，已逐一驗證）：

1. [`apps/mobile/app/(tabs)/home/add-recipient.tsx`](apps/mobile/app/(tabs)/home/add-recipient.tsx) — 表單 label「緊急聯絡人」→「主要聯絡人」
2. [`apps/mobile/app/(tabs)/home/[recipientId]/edit.tsx`](apps/mobile/app/(tabs)/home/[recipientId]/edit.tsx) — 同上
3. [`apps/mobile/app/(tabs)/home/[recipientId]/index.tsx`](apps/mobile/app/(tabs)/home/[recipientId]/index.tsx) — 詳情頁 label
4. [`apps/web/app/admin/recipients/page.tsx:93`](apps/web/app/admin/recipients/page.tsx#L93) — admin 列表表頭「緊急聯絡人」→「主要聯絡人」
5. [`apps/web/app/admin/recipients/[id]/page.tsx:234`](apps/web/app/admin/recipients/[id]/page.tsx#L234) — admin 詳情頁 Row label
6. **schema 完全不動，欄位名 `emergency_contact_*` 保留**（DB 不破壞，只 UI 改名）

---

## 6. Phase D — 大工程

### G12 · Provider 個人照片上傳

**業主原文（PDF p7）**：「上傳近 3 個月個人清晰照片（需正面、露出耳朵）」

**現況（已驗）**：
- Schema `Provider.photo_url String?` 已有（OPT-28 加的）
- 顯示端 [`(tabs)/services/[requestId].tsx:566-567`](apps/mobile/app/(tabs)/services/[requestId].tsx#L566-L567) 有 `<Image source={{ uri: provider.photo_url }} />`
- **完全沒有上傳基礎建設**：
  - mobile package.json 沒裝 expo-image-picker、expo-file-system
  - web 沒安裝 cloud storage SDK（Cloudinary / Supabase Storage / S3 等）
  - apps/web/app/api/v1/provider/ 沒上傳路由
  - apps/web/lib/ 沒檔案 helper

**業務決策**：MVP 是否必要？
- 業主在 PDF p3, p4, p7 都提到照片
- mvp-optimization-plan 把它列為 OPT-28 補遺（MVP 範圍內）
- 但這是這 12 項中最貴的（1.5 day），值得單獨 sprint

**修法（最簡架構）**：用 Supabase Storage（已用 Supabase 當 DB，最少新增依賴）

#### G12.0 — Mobile api-client 補 upload helper

**現況（已驗）**：[`apps/mobile/lib/api-client.ts`](apps/mobile/lib/api-client.ts) 沒有 multipart/FormData 上傳的方法（只有 get/post/put/delete JSON 版本）。

**修法**：加一個 `api.upload(path, formData)` 方法：
```ts
async upload<T = unknown>(path: string, formData: FormData): Promise<T> {
  const url = `${this.baseUrl}${path}`;
  const token = await this.getToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      // ⚠️ 不要設 Content-Type — 讓 fetch 自動加 multipart boundary
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    credentials: 'include',
  });
  // 沿用既有的 error handling 邏輯
  return this.handleResponse<T>(res);
}
```

**注意**：這個 helper 也可以未來給其他檔案上傳用（藥單、醫囑單等 Phase 2 項目）。

---

#### G12.1 — 設定 Supabase Storage
1. Supabase dashboard 建 bucket `provider-photos`（public read 或 signed URL，MVP 走 public read 簡單）
2. RLS policy：authenticated user 可 upload 自己的 provider photo
   ```sql
   create policy "Provider can upload own photo" on storage.objects
   for insert with check (
     bucket_id = 'provider-photos'
     and auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

#### G12.2 — Backend route
**新增**：[apps/web/app/api/v1/provider/me/photo/route.ts](apps/web/app/api/v1/provider/me/photo/route.ts)

```ts
// POST: receive multipart, write to Supabase Storage, update Provider.photo_url
// DELETE: clear photo_url + remove from storage
```

需要：
- `npm i @supabase/supabase-js` 在 apps/web
- env 加 `SUPABASE_SERVICE_ROLE_KEY`（只在 server 用）
- 驗證 auth → role='provider' → 找到自己的 Provider record → upload

#### G12.3 — Mobile 上傳 UI
**修改**：provider-edit.tsx（G7 新建的）+ provider-profile.tsx（onboarding 區段）

```bash
npm i expo-image-picker  # in apps/mobile
```

UI：
```tsx
import * as ImagePicker from 'expo-image-picker';

async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return;
  const asset = result.assets[0];
  
  const formData = new FormData();
  formData.append('photo', {
    uri: asset.uri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  } as any);
  
  await api.upload('/provider/me/photo', formData);  // 新增 api.upload helper
}
```

**注意（避免重複）**：
- 不要在 ProviderDocument table 上做（會跟 photo_url 並存）
- photo_url 是 single source of truth，ProviderDocument 留給 Phase 2 的身分證、證書等多文件
- 只在 onboarding 完成 + edit 兩處提供上傳，不要做第三處

**為什麼 MVP 還是要做**：
- 委託人選候選服務人員時看不到照片，識別困難
- 三處 UI 已預留 photo_url 顯示，缺一塊讓 schema 「形同虛設」

---

## 7. 明確排除（Phase 2 — 不做）

下列 14 項在 PDF 內但已標 🚫 Phase 2，**這次絕對不做**：

| PDF 項目 | 排除原因 |
|---|---|
| 三方 OAuth (FB/Google/LINE) | 整合成本高 |
| 金流（綠界 ECPay） | 業務模式未定 |
| 訂閱人 vs 使用者 + 付費規則 | 跟金流綁定 |
| 多家屬綁定驗證碼 | 模型大改 |
| 服務啟動驗證碼 + GPS 定位 | 服務頁全新功能 |
| 錄音/錄影 + STT + AI 醫囑摘要 | 雲端音檔架構 |
| 服務評價系統（4 維度） | 全新 model |
| 續訂 + 行事曆連動 | 排程基建 |
| 注意事項勾選 / 錄音同意 checkbox | 跟錄音/法務同源 |
| 預估金額自動計算 → 走金流 | UI 已顯示估算，不接金流 |
| 安全問卷 / 切結書 / 電子簽名 | 法務工作流 |
| 第二階段補件（健檢/良民證/學歷影本） | 多文件上傳 |
| 服務報告檔案上傳（藥單/醫囑單）| 同 G12 之延伸 |
| 委託人**自身**的病史/生活習慣 | （注意：被照護者的有做，是不同人）|
| 推薦影片 / 廣告版位 / footer | 純行銷 UI |

---

## 8. 已決議不做（MVP 內也不做）

### K · PDF「增加其他家屬+」展開式表單
- PDF p2 (10) 暗示同一表單可加多個家屬
- 目前實作：每位被照護者各自建一個 recipient
- **行為等價，僅體驗不同**
- 重做為展開式表單 = 4-6 hr，CP 值低
- **保持現狀**

---

## 9. 整合測試重點

完成 G1~G12 後，跑下列驗收：

### 9.1 Caregiver 流程
- [ ] 註冊 caregiver → 進個人資料頁 → 試送出空白 → 應擋住 phone/birthday/address（**G2**）
- [ ] 漢堡選單看到「量測提醒」入口（**G3**），點擊跳到 recipient detail
- [ ] 新增 recipient → 詳情頁 → 編輯 → 看到生活習慣 section（**G6**）→ 修改後 reload 仍正確
- [ ] 詳情頁的「緊急聯絡人」label 改成「主要聯絡人」（**G11**）

### 9.2 Provider 流程
- [ ] 註冊 provider → onboarding 看到居住地址 input（**G1**）
- [ ] 證照拆「相關 / 其他」兩個 input（**G5**）
- [ ] 送出後 Approved → 個人資料頁有「編輯」按鈕（**G7**）
- [ ] 編輯頁可改可接案時段（7×3 grid）+ 證照 + 區域 + 地址 + 生日
- [ ] 送出後 GET /provider/me 跟 GET /auth/me 都更新

### 9.3 服務需求流程
- [ ] 開陪診單 → 看到醫院 chip（**G9**）+ 診別 chip（**G4**）+ 證照偏好 chip（**G8**）
- [ ] 開運動養生單 → 看到縣市/區域兩級（**G10**）+ 證照偏好（**G8**）
- [ ] 開居家打掃單 → 看到縣市/區域兩級（**G10**）
- [ ] Admin 看 service-request 詳情 → metadata 區塊正確顯示新加的所有 keys

### 9.4 G12 (照片) 整合
- [ ] Provider edit 頁可以選照片上傳 → photo_url 寫入 Provider table
- [ ] 委託人收到候選 → 候選卡顯示照片
- [ ] Admin 候選列表也顯示照片
- [ ] 刪除照片 → photo_url 清空

---

## 10. 風險與相容性

### 10.1 Schema 變更
- **G6.1, G6.2**：`formatRecipient` 加 `lifestyle_habits` — **新增欄位，向後相容**
- **G11**（選 A）：無 schema 變更
- **G12**：可能需要 migration 加 storage URL 欄位（其實 photo_url 已有，不需）

### 10.2 並存風險
| 項目 | 並存風險 | 緩解方法 |
|---|---|---|
| G5 證照拆兩格 | 顯示端遇到舊資料（無 `;`）會把全部當「相關」 | OK，這是預期行為 |
| G6 LifestyleHabitsForm component | add 跟 edit 邏輯不同步 | 抽 component 共用，或留 TODO |
| G7 ProviderEditForm | 跟 onboarding 邏輯重複 | 兩處本來流程就不一樣（onboarding 一次性 + 觸發 submitted_at；edit 是反覆改），不抽更清楚 |
| G9 醫院常數老舊 | 醫院改名/合併 | 標 TODO 「Phase 2 改 API-backed」 |
| G10 縣市/區域常數 | 同上 | 同上 |
| G12 ProviderDocument vs photo_url | 兩種儲存方式並存 | 文件已強調 photo_url 是 SoT，ProviderDocument 留給 Phase 2 |

### 10.3 測試覆蓋
本次新增的東西大多是 UI 跟 metadata 擴充：
- **新增 vitest 測試**：G6.1 formatRecipient lifestyle_habits 出現在 response（1 test）
- **新增 vitest 測試**：G6.2 RecipientResponseSchema 接受 lifestyle_habits（1 test）
- **新增 vitest 測試**：G12 POST /provider/me/photo — auth、role、檔案大小（3 tests）
- 其他純 UI 改動由手動測試驗證即可

---

## 11. 推薦動工順序

> 每個 phase 內的項目可平行做，跨 phase 嚴格依賴

```
Day 1 上午: A 全部 (G1+G2+G3+G4+G5)
        ↓
Day 1 下午: B 中等項目 (G6 + G8)
        ↓
Day 2 上午: B 大項目 (G7 + G9 + G10)
        ↓
Day 2 下午: C (G11) + 整合測試
        ↓
Day 3-4: D (G12) ← 可獨立排到下週
```

**最小可發布版（MVS）**：A + B + C = ~14 hr（兩個工作天）就能補齊絕大部分 PDF MVP 欄位差距。G12 視照片是否硬需求決定是否本週內做。

---

## 附錄 A：本次 audit 中**沒有變動**的東西（避免誤判）

下列 schema/API 在本次計畫中**完全不動**，務必不要因為改 UI 順手 refactor：

- `Recipient.medical_tags` 的 `__manager_fill__` magic string（add-recipient.tsx:179）— 是現有約定，本次保持
- `User.address` / `User.date_of_birth`（已 OPT-07 加好）
- `Provider.available_schedule` / `schedule_note`（已 OPT-14 加好，只缺 UI）
- `Provider.photo_url`（已 OPT-28 schema 加好，只缺上傳）
- `ServiceRequest.metadata` 的 `z.record(z.unknown())` 寬鬆 schema — 不要為了 G4/G8 改成嚴格 schema（會限縮其他類別擴充）
- `formatRecipient()` 既有欄位順序（只新增 lifestyle_habits 到尾端）
- `ProviderSelfUpdateSchema` 既有欄位（已支援所有要編輯的欄位）

## 附錄 B：本次 audit 中**確認不要新建**的檔案

- ❌ `apps/web/app/api/v1/provider/me/address/route.ts` — 用既有 `/auth/me`
- ❌ `apps/web/app/api/v1/provider/me/schedule/route.ts` — 用既有 `/provider/me`
- ❌ `apps/mobile/app/(tabs)/home/settings.tsx` — G3 用 menu link 跳既有頁面
- ❌ `Recipient.recipient_phone` column — G11 選 A 走 label 重命名
- ❌ `Hospital` table — G9 用常數
- ❌ `Region` table — G10 用常數

## 附錄 C：完成 checklist 模板

```
Phase A (4 hr)
  [ ] G1   Provider onboarding 居住地址 (寫端)
  [ ] G2   Caregiver profile 必填驗證
  [ ] G3   漢堡選單「量測提醒」項
  [ ] G4   陪診表單診別 chip (寫端)
  [ ] G4.b SERVICE_METADATA_LABELS 常數 (shared)
  [ ] G4.b mobile [requestId].tsx 顯示 metadata
  [ ] G4.b mobile provider-task-detail.tsx 顯示 metadata
  [ ] G4.b admin/service-requests/[id]/page.tsx 顯示 metadata
  [ ] G5   Provider 證照 UI 拆兩格 (寫 + 顯示端 filter ';')

Phase B (12 hr)
  [ ] G6.1 formatRecipient + lifestyle_habits
  [ ] G6.2 RecipientResponseSchema + lifestyle_habits
  [ ] G6.3 edit.tsx 補生活習慣 UI
  [ ] G6.4 mobile recipient 詳情頁顯示 lifestyle
  [ ] G6.4 admin recipient 詳情頁顯示 lifestyle
  [ ] G6.5 grep formatRecipient caller 確認 prisma select
  [ ] G7   provider-edit.tsx 新建 (含可接案時段)
  [ ] G7   provider-profile.tsx 加「編輯」按鈕入口
  [ ] G7   editable 後 useFocusEffect 重抓 profile
  [ ] G8   服務需求證照偏好 metadata (顯示端沿用 G4.b)
  [ ] G9   陪診醫院 dropdown + 常數檔
  [ ] G10  縣市/區域階層 + 常數檔

Phase C (30 min)
  [ ] G11  Recipient 聯絡人 label 改名 (5 files)

Phase D (1.5 day)
  [ ] G12.0 api-client 加 upload helper
  [ ] G12.1 Supabase Storage bucket + RLS
  [ ] G12.2 Backend POST/DELETE /provider/me/photo
  [ ] G12.3 Mobile expo-image-picker + UI (onboarding + edit)
  [ ] G12.4 移除照片時 photo_url 同步清空

Tests
  [ ] formatRecipient lifestyle_habits 測試
  [ ] RecipientResponseSchema 測試
  [ ] /provider/me/photo 測試 (G12 階段)

Manual QA
  [ ] Caregiver 流程驗收
  [ ] Provider 流程驗收 (含照片上傳)
  [ ] 服務需求 3 類驗收 (含 metadata 顯示端)
  [ ] Recipient 詳情頁 lifestyle_habits 顯示驗收
  [ ] G12 整合驗收
```
