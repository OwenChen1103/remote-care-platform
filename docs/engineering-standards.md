# 遠端照護平台 — 嚴格代碼規範與流程規範

> **文件版本**：1.1.0
> **最後更新**：2026-03-07
> **狀態**：定案（Approved）
> **維護者**：工程團隊
>
> **v1.1.0 變更摘要**：Lint 門檻收緊為零 warning、Rate Limit 改用 Upstash Redis、修正 Request ID middleware 實作、新增 Prisma 連線池規範、統一 Auth 雙策略說明。

---

## 目錄

- [A. 不可談判的品質門檻](#a-不可談判的品質門檻)
- [B. Monorepo 規範](#b-monorepo-規範)
- [C. TypeScript 規範](#c-typescript-規範)
- [D. 命名規範與程式碼風格](#d-命名規範與程式碼風格)
- [E. API 規範](#e-api-規範)
- [F. 安全規範](#f-安全規範)
- [G. 前端規範（Expo Mobile）](#g-前端規範expo-mobile)
- [H. 前端規範（Next.js Admin）](#h-前端規範nextjs-admin)
- [I. 測試策略](#i-測試策略)
- [J. Git 工作流與 PR 規範](#j-git-工作流與-pr-規範)
- [K. CI/CD 規範](#k-cicd-規範)
- [L. Observability 規範](#l-observability-規範)
- [M. 文件與變更管理](#m-文件與變更管理)

---

## A. 不可談判的品質門檻

以下品質門檻為**不可談判的硬性要求**。任何 PR 若未通過以下所有檢查，**一律不得合併**。

### A.1 CI Gate（全部必須通過）

| Gate | 說明 | 失敗即阻擋 |
|------|------|:----------:|
| Lint | ESLint 零錯誤 **且零 warning**（見下方規則） | ✅ |
| Type Check | `tsc --noEmit` 零錯誤 | ✅ |
| Test | 所有測試通過 | ✅ |
| Build | `turbo build` 成功 | ✅ |

### A.2 PR 規則

- **嚴禁** direct push 到 `main` 分支
- 所有變更必須透過 PR 提交
- PR 必須至少 **1 位** reviewer approve（兩人團隊互審）
- PR 必須通過所有 CI gates
- 合併策略：**Squash and Merge**（保持 main 歷史乾淨）

### A.3 Lint Warning 零容忍政策

- CI 中 ESLint **必須**以 `--max-warnings 0` 執行，任何 warning 皆視為失敗
- 若某條規則確實需要暫時降級為 warning（例如漸進式遷移），必須建立 GitHub Issue 追蹤，並在 `.eslintrc` 中加註理由與預計修復日期
- **嚴禁**透過全域 `eslint-disable` 或 `--quiet` 繞過 warning

ESLint script 必須為：

```json
{
  "lint": "eslint . --ext .ts,.tsx --max-warnings 0"
}
```

### A.4 必要 npm scripts

以下 scripts 必須存在於根目錄 `package.json`：

```json
{
  "scripts": {
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "build": "turbo build",
    "dev": "turbo dev",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:migrate": "cd apps/web && pnpm prisma migrate dev",
    "db:seed": "cd apps/web && pnpm prisma db seed",
    "db:studio": "cd apps/web && pnpm prisma studio"
  }
}
```

每個 app 內的 `package.json` 必須定義：

```json
// apps/web/package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma migrate deploy && next build",
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

```json
// apps/mobile/package.json
{
  "scripts": {
    "dev": "expo start",
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "build:preview": "eas build --profile preview"
  }
}
```

```json
// packages/shared/package.json
{
  "scripts": {
    "lint": "eslint . --ext .ts --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "build": "tsup src/index.ts --format cjs,esm --dts"
  }
}
```

---

## B. Monorepo 規範

### B.1 Workspace 設定

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {},
    "typecheck": {},
    "test": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### B.2 共享契約規範（`packages/shared`）

- Zod schema 為前後端 API 契約的**唯一真實來源**
- 所有 API request/response 型別必須從 Zod schema 推導（`z.infer<typeof Schema>`）
- **嚴禁**在 apps/web 或 apps/mobile 中重複定義已存在於 shared 的型別
- 新增 API 時，必須先在 shared 定義 Zod schema，再寫 API handler 與前端呼叫

匯出規範：

```typescript
// packages/shared/src/index.ts
// 統一從此處匯出所有 schemas、types、constants

export * from './schemas/auth';
export * from './schemas/recipient';
export * from './schemas/measurement';
export * from './schemas/appointment';
export * from './schemas/service-request';
export * from './schemas/notification';
export * from './schemas/provider';
export * from './schemas/ai';
export * from './schemas/device';

export * from './constants/error-codes';
export * from './constants/enums';
export * from './constants/thresholds';

export * from './types';
```

### B.3 跨 App 依賴規則

- `apps/web` 可依賴 `packages/shared` ✅
- `apps/mobile` 可依賴 `packages/shared` ✅
- `packages/shared` **嚴禁**依賴任何 `apps/*` ❌
- `apps/web` **嚴禁**依賴 `apps/mobile` ❌
- `apps/mobile` **嚴禁**依賴 `apps/web` ❌
- 循環依賴一律**零容忍**

依賴宣告方式：

```json
// apps/web/package.json
{
  "dependencies": {
    "@remote-care/shared": "workspace:*"
  }
}
```

---

## C. TypeScript 規範

### C.1 基礎設定

```json
// tsconfig.base.json（根目錄）
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### C.2 Monorepo Type 相容性注意事項

本專案的 `apps/web`（React 19）與 `apps/mobile`（React 18）使用不同版本的 React。pnpm 的 hoisting 行為可能導致 `@types/react` 版本衝突（React 19 的型別被提升，使 React 18 的 JSX 元件型別不相容）。

**已採用的解法**：

1. **根目錄 `package.json` 的 `pnpm.overrides`**：將 `@types/react` 固定為 `~18.3.0`，避免 React 19 型別被意外提升。
2. **`apps/mobile/tsconfig.json` 的 `skipLibCheck: true`**：跳過第三方 `.d.ts` 的型別檢查，避免 Expo 生態系套件的內部型別衝突。

> **注意**：新增使用不同 React 版本的 workspace 時，必須確認 `pnpm.overrides` 的 `@types/react` 版本仍適用。當所有 app 統一升級至同一 React 版本後，可移除此 override。

### C.3 嚴禁 `any`

- `any` 型別**嚴禁使用**，無例外
- ESLint 規則 `@typescript-eslint/no-explicit-any: "error"` 必須啟用
- 若遇到第三方套件型別不完整，使用 `unknown` + type guard
- 唯一允許 `any` 的情況：第三方套件的 `.d.ts` 覆寫（必須加註 `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- [具體理由]`）

### C.4 Type Guard 範例

```typescript
// ✅ 正確做法
function isApiError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

// ❌ 禁止做法
function handleError(error: any) { ... }
```

### C.5 統一錯誤處理

```typescript
// packages/shared/src/constants/error-codes.ts

export const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_OWNERSHIP_DENIED: 'RESOURCE_OWNERSHIP_DENIED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_INVALID_TYPE: 'FILE_INVALID_TYPE',
  DEVICE_AUTH_FAILED: 'DEVICE_AUTH_FAILED',
  DEVICE_RECIPIENT_NOT_FOUND: 'DEVICE_RECIPIENT_NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RECIPIENT_LIMIT_EXCEEDED: 'RECIPIENT_LIMIT_EXCEEDED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

後端統一錯誤回應工具函式：

```typescript
// apps/web/lib/api-response.ts

import { NextResponse } from 'next/server';
import type { ErrorCode } from '@remote-care/shared';

const ERROR_STATUS_MAP: Record<string, number> = {
  AUTH_REQUIRED: 401,
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  RESOURCE_OWNERSHIP_DENIED: 403,
  VALIDATION_ERROR: 400,
  DUPLICATE_ENTRY: 409,
  INVALID_STATE_TRANSITION: 400,
  RATE_LIMIT_EXCEEDED: 429,
  AI_GENERATION_FAILED: 502,
  AI_RATE_LIMITED: 429,
  AI_INVALID_RESPONSE: 502,
  FILE_TOO_LARGE: 400,
  FILE_INVALID_TYPE: 400,
  DEVICE_AUTH_FAILED: 401,
  DEVICE_RECIPIENT_NOT_FOUND: 404,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  RECIPIENT_LIMIT_EXCEEDED: 400,
};

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(code: ErrorCode, message: string, details?: unknown[]) {
  const status = ERROR_STATUS_MAP[code] ?? 500;
  return NextResponse.json(
    { success: false, error: { code, message, details: details ?? [] } },
    { status }
  );
}

export function paginatedResponse<T>(data: T[], meta: { page: number; limit: number; total: number }) {
  return NextResponse.json({ success: true, data, meta });
}
```

---

## D. 命名規範與程式碼風格

### D.1 命名規範

| 範疇 | 規則 | 範例 |
|------|------|------|
| 變數、函式 | camelCase | `getUserById`, `recipientList` |
| React 元件 | PascalCase | `MeasurementCard`, `TrendChart` |
| 型別、介面 | PascalCase | `Recipient`, `MeasurementInput` |
| 常數 | UPPER_SNAKE_CASE | `MAX_RECIPIENTS`, `API_BASE_URL` |
| 檔案（元件） | PascalCase | `MeasurementCard.tsx` |
| 檔案（非元件） | kebab-case | `api-client.ts`, `use-measurements.ts` |
| 資料夾 | kebab-case | `service-requests/`, `ai-reports/` |
| DB 欄位 | snake_case | `caregiver_id`, `measured_at` |
| DB 表名 | snake_case 複數 | `users`, `measurements`, `service_requests` |
| API 路徑 | kebab-case | `/api/v1/service-requests` |
| 環境變數 | UPPER_SNAKE_CASE | `DATABASE_URL`, `JWT_SECRET` |
| Zod schema | PascalCase + Schema 後綴 | `MeasurementCreateSchema` |

### D.2 檔案規範

| 規則 | 限制 |
|------|------|
| 單一檔案最大行數 | 300 行（超過必須拆分） |
| 單一函式最大行數 | 50 行（超過必須拆分） |
| 單一 React 元件最大行數 | 200 行 |
| 每個檔案匯出 | 建議 1 個主要匯出；工具函式檔可多個 |
| 巢狀深度 | 最多 3 層（超過需重構） |

### D.3 註解規範

- **不寫**自明程式碼的註解（如 `// 取得使用者` → `const user = getUser()`）
- **必寫**業務邏輯不明顯之處（如異常判斷規則、狀態機轉換）
- **必寫** TODO 格式：`// TODO(姓名): 描述 [#issue-number]`
- **嚴禁** 註解掉的程式碼留在 codebase（直接刪除，git 有歷史）

### D.4 Anti-Pattern 清單

以下為**嚴禁**的做法，Code Review 時必須攔截：

1. **使用 `any` 型別**（見 C.2）
2. **在 API handler 中直接寫 SQL**（必須使用 Prisma）
3. **前端直接存取 `process.env`**（Mobile 必須用 `expo-constants`；Web 用 `NEXT_PUBLIC_` 前綴）
4. **在元件中直接呼叫 `fetch`**（必須透過集中式 API client）
5. **在 API handler 中不做 Zod 驗證**
6. **在 API handler 中不做 ownership 檢查**（涉及 recipient 的 endpoint）
7. **硬編碼 magic number**（如閾值、限制數值，必須用 constants）
8. **在前端硬編碼 API URL**（必須用環境變數 + API client）
9. **使用 `console.log` 做 production logging**（必須用 structured logger）
10. **在 error response 中回傳 stack trace**
11. **在 log 中輸出密碼、token、完整個資**（見 implementation-spec L.3）
12. **跨 app 直接 import**（`apps/mobile` import `apps/web` 的檔案）
13. **在 shared package 中 import app-specific 套件**（如 `next`、`expo`）
14. **不處理非同步錯誤**（所有 async 函式必須有 try/catch 或由上層統一攔截）
15. **在 React 元件中使用 `useEffect` 做資料取得但不處理 loading/error**
16. **重複定義已在 shared 中存在的型別或 schema**
17. **在 Prisma query 中使用 `findFirst` 但不檢查 null**
18. **使用 `dangerouslySetInnerHTML`**（嚴禁）
19. **在 commit message 中寫 "fix" 但不說明修了什麼**
20. **在 PR 中包含與 PR 描述無關的變更**

---

## E. API 規範

### E.1 路徑與版本

- Base path：`/api/v1`
- 命名：kebab-case、複數名詞（`/recipients`、`/service-requests`）
- 動作不放在路徑中（用 HTTP method 表達）
  - ✅ `PUT /api/v1/service-requests/:id/status`
  - ❌ `POST /api/v1/update-service-request-status`

### E.2 Response Envelope

所有 API **必須**使用統一 envelope：

```typescript
// 成功（單一物件）
{ "success": true, "data": { ... } }

// 成功（列表）
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 100 } }

// 錯誤
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": [] } }
```

### E.3 Pagination 與 Filtering

- 分頁：`?page=1&limit=20`
- `page` 從 1 開始
- `limit` 預設 20，最大 100
- 排序：`?sort=created_at&order=desc`
- 篩選：各 endpoint 自行定義，以 query param 傳遞

### E.4 Validation

- 所有 API request body **必須**使用 Zod 驗證
- 驗證失敗回傳 `VALIDATION_ERROR` + `details` 陣列（每個欄位的錯誤訊息）
- 驗證邏輯放在 route handler 的最前面

```typescript
// 標準 pattern
export async function POST(request: Request) {
  const body = await request.json();
  const result = MeasurementCreateSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      '輸入資料驗證失敗',
      result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
    );
  }
  // ... 繼續處理
}
```

### E.5 API Handler 標準結構

每個 route handler 必須遵循以下順序：

1. 解析 request body / query params
2. Zod 驗證
3. JWT 認證檢查
4. 角色權限檢查
5. Ownership 檢查（若適用）
6. 業務邏輯
7. 回傳標準 envelope

```typescript
// apps/web/app/api/v1/measurements/route.ts
import { NextRequest } from 'next/server';
import { MeasurementCreateSchema } from '@remote-care/shared';
import { verifyAuth } from '@/lib/auth';
import { checkRecipientOwnership } from '@/lib/ownership';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  // 1. 解析
  const body = await request.json();

  // 2. 驗證
  const parsed = MeasurementCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', '輸入資料驗證失敗', parsed.error.issues);
  }

  // 3. 認證
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', '請先登入');

  // 4. 角色（此 endpoint caregiver 可用）
  // 5. Ownership
  const isOwner = await checkRecipientOwnership(auth.userId, parsed.data.recipient_id);
  if (!isOwner) return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此被照護者');

  // 6. 業務邏輯
  const measurement = await prisma.measurement.create({ data: { ... } });

  // 7. 回傳
  return successResponse(measurement, 201);
}
```

---

## F. 安全規範

### F.1 Secrets 管理

- 所有機密資訊**一律**放在環境變數中
- `.env` 檔案**必須**在 `.gitignore` 中
- 提供 `.env.example` 列出所有必要變數（值為空或為範例值）
- Vercel 環境變數必須按 environment（Development/Preview/Production）分別設定
- **嚴禁**在程式碼中硬編碼任何 secret、API key、密碼

### F.2 Token Handling

| 端 | 儲存方式 | 說明 |
|----|---------|------|
| Mobile | `expo-secure-store` | 加密儲存於裝置安全區域 |
| Web Admin | httpOnly cookie | `SameSite=Strict`、`Secure=true`（production） |

- JWT payload 只包含：`userId`、`role`、`iat`、`exp`
- **嚴禁**在 JWT 中放入密碼、個資、健康資料
- Token 過期時間：7 天
- Refresh token：MVP 不做（過期重新登入即可）

**雙認證策略**：API middleware 必須同時支援 `Authorization: Bearer {token}`（Mobile 端）與 `Cookie: auth_token={token}`（Web Admin 端）。詳細實作見 implementation-spec L.1。兩種方式共用同一組 API endpoint，middleware 按優先順序判斷（Bearer 優先 → Cookie fallback）。**嚴禁** Web 端將 JWT 存入 `localStorage`。

### F.3 CSRF 防護（Origin 檢查）

所有 mutation 端點（POST / PUT / DELETE）**必須**在 handler 最前面呼叫 `checkOrigin(request)` 進行 Origin 白名單檢查。

```typescript
// apps/web/lib/csrf.ts
import { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://localhost:8081',
].filter(Boolean) as string[];

export function checkOrigin(request: NextRequest): boolean {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return true;
  }
  const origin = request.headers.get('origin');
  // Mobile apps (React Native) don't send Origin header
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}
```

- `SameSite=Strict` cookie 為第一道防線，Origin 檢查為第二道
- Mobile 端（React Native）不帶 Origin header，故 `origin === null` 時放行
- 新增部署 domain 時必須同步更新 `ALLOWED_ORIGINS` 清單
- 不通過時回傳 `AUTH_FORBIDDEN`（403）

### F.4 CORS

```typescript
// apps/web/next.config.js 中設定或 middleware
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,  // Vercel 部署 domain
  'http://localhost:8081',           // Expo dev
  'http://localhost:3000',           // Next.js dev
];
```

- 非列表中的 origin **一律拒絕**
- `Access-Control-Allow-Credentials: true`（for cookie auth）

### F.5 Rate Limiting（Upstash Redis）

**重要**：Vercel serverless 每次請求可能在不同 instance 執行，記憶體不共享。**嚴禁**使用 in-memory Map 做 rate limit。

**MVP 定案**：使用 **Upstash Redis**（`@upstash/ratelimit`），免費額度 10,000 commands/day 足夠 MVP。

| Endpoint 類別 | 限制 | Rate Limit Key |
|--------------|------|---------------|
| 全域 | 100 req/min per IP | `global:{ip}` |
| Auth（login/register） | 10 req/min per IP | `auth:{ip}` |
| AI（report/chat） | 見 implementation-spec I.4 與 L.2 | `ai:{userId}:*` |
| Device Ingest | 60 req/min per token | `device:{token}` |

必要環境變數（對齊 implementation-spec N.2）：

| 變數名 | 說明 |
|--------|------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

超限時必須回傳：
- HTTP Status：`429`
- Error Code：`RATE_LIMIT_EXCEEDED`
- Header：`Retry-After: {seconds}`

實作參考見 implementation-spec L.2 的程式碼範例。

### F.6 Logging 脫敏

以下欄位**嚴禁**出現在任何 log output 中：

| 禁止欄位 | 允許替代 |
|---------|---------|
| `password` / `password_hash` | `[REDACTED]` |
| 完整 `email` | `u***@domain.com` |
| 完整 `phone` | `****5678` |
| `token` / `jwt` | 前 8 字元 + `...` |
| 健康數據原始值 | measurement ID |
| AI prompt 中的個資 | `[REDACTED]` |

### F.7 Dependency 安全

- 每週執行 `pnpm audit`
- 啟用 GitHub Dependabot（自動建立 security update PR）
- High/Critical 漏洞**必須**在 72 小時內修復
- **嚴禁**安裝已知有重大安全漏洞的套件

### F.8 資料庫連線規範（Prisma + Serverless）

以下規範對齊 implementation-spec N.3，在此強調工程實作面：

- **`DATABASE_URL`**：runtime 查詢**必須**使用 Supabase pooled 連線（pgbouncer，port `6543`，加上 `?pgbouncer=true`）
- **`DIRECT_URL`**：**僅用於** `prisma migrate dev` / `prisma migrate deploy`，runtime **嚴禁**使用
- **Prisma Client**：必須使用 singleton pattern（見 implementation-spec N.3 程式碼），**嚴禁**在每個 route handler 中各自 `new PrismaClient()`
- **連線數監控**：開發階段注意 Supabase Dashboard 的 active connections 數量；Free tier 上限為 60

---

## G. 前端規範（Expo Mobile）

### G.1 API Client 集中管理

```typescript
// apps/mobile/lib/api-client.ts

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;

class ApiClient {
  private async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync('auth_token');
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const json = await response.json();

    if (!json.success) {
      throw new ApiError(json.error.code, json.error.message, json.error.details);
    }

    return json.data as T;
  }

  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }
  put<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
  }
  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
```

- 所有 API 呼叫**必須**透過此 client
- **嚴禁**在元件中直接使用 `fetch`

### G.2 狀態管理

- **伺服器狀態**：使用 `@tanstack/react-query`（TanStack Query）
  - 所有 API 資料取得使用 `useQuery`
  - 所有 API 寫入使用 `useMutation`
  - 設定全域 `staleTime: 30_000`（30 秒）
  - Error 統一由 QueryClient `onError` 處理

- **客戶端狀態**：使用 React Context（僅限 Auth 狀態）
  - `AuthContext`：`user`、`token`、`login()`、`logout()`
  - **嚴禁**使用 Redux、MobX 等重型狀態管理（MVP 不需要）

### G.3 必備 UI 狀態

每個資料取得頁面**必須**處理以下三種狀態：

| 狀態 | 要求 |
|------|------|
| Loading | 顯示 skeleton 或 spinner |
| Empty | 顯示友善空狀態文案 + 引導操作 |
| Error | 顯示錯誤訊息 + retry 按鈕 |

```typescript
// ✅ 標準 pattern
function MeasurementList({ recipientId }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['measurements', recipientId],
    queryFn: () => api.get(`/measurements?recipient_id=${recipientId}`),
  });

  if (isLoading) return <SkeletonList />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!data || data.length === 0) return <EmptyState message="尚無量測資料" />;

  return <FlatList data={data} ... />;
}
```

### G.4 表單 Validation

- 使用 `react-hook-form` + `@hookform/resolvers/zod`
- Zod schema 從 `@remote-care/shared` 匯入
- 錯誤訊息使用中文
- 表單送出後禁止重複提交（button disable + loading）

### G.5 Component 拆分規則

| 規則 | 說明 |
|------|------|
| 單一職責 | 每個元件只做一件事 |
| 行數限制 | 超過 200 行必須拆分 |
| 資料取得 | Container/Presenter 分離：Container 負責取資料，Presenter 負責渲染 |
| 共用元件 | 放在 `components/` 目錄；2 處以上重複才抽取 |
| 頁面元件 | 放在 `app/` 目錄（expo-router 規範） |

---

## H. 前端規範（Next.js Admin）

### H.1 Route 結構

- 所有 Admin 頁面放在 `app/admin/` 下
- API route handlers 放在 `app/api/v1/` 下
- 首頁 `/` 重導到 `/admin/dashboard`

### H.2 API Route Handlers（定案）

- **採用 Route Handlers**（`route.ts` 中的 `GET`/`POST`/`PUT`/`DELETE`）
- **不使用 Server Actions**（MVP 階段統一用 REST API，保持 Mobile 與 Admin 共用同一組 API）
- 理由：Mobile App 只能呼叫 REST API，Admin 也用同一組 API 保持一致性

### H.3 Admin Auth 保護

```typescript
// apps/web/app/admin/layout.tsx
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) redirect('/admin/login');

  const payload = await verifyJwt(token);
  if (!payload || payload.role !== 'admin') redirect('/admin/login');

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

### H.4 UI 框架

- 使用 **Tailwind CSS**（Next.js 內建支援）
- 元件庫：**shadcn/ui**（可選，加速開發；或自行用 Tailwind 手刻）
- 表格：使用 `@tanstack/react-table`（若需複雜排序/篩選）或簡單 HTML table
- 表單：`react-hook-form` + Zod（與 Mobile 統一）

---

## I. 測試策略

### I.1 測試框架

| 項目 | 工具 |
|------|------|
| apps/web（API tests） | Vitest |
| apps/mobile（Component tests） | Jest + React Native Testing Library |
| packages/shared（Unit tests） | Vitest |
| E2E | MVP 不做自動化 E2E（用 Demo 劇本手動驗證） |

### I.2 必要測試範圍

#### 後端 Route Handler Tests（必要）

| Endpoint 群組 | 測試案例 |
|--------------|---------|
| Auth | 註冊成功 / email 重複 / 密碼太短 / 登入成功 / 密碼錯誤 |
| Recipients | 建立成功 / ownership 驗證 / 超過上限 / 更新成功 |
| Measurements | 建立 BP 成功 / 建立 BG 成功 / validation 失敗 / ownership 驗證 / 異常判斷正確 |
| Service Requests | 建立成功 / 狀態更新合法 / 狀態更新非法 / 指派 provider / ownership 驗證 |
| AI | 成功生成（mock LLM）/ fallback / 頻率限制 |
| Providers（Admin） | CRUD / 審核 / 文件上傳 / 非 admin 拒絕 |

#### 前端 Component Tests（必要）

| 元件 | 測試案例 |
|------|---------|
| 新增量測表單 | 正確填寫送出 / validation 錯誤顯示 / loading 狀態 |
| 送出需求單表單 | 正確填寫送出 / 必填欄位驗證 |
| 登入表單 | 成功登入跳轉 / 錯誤訊息顯示 |

#### Shared Package Tests（必要）

| 項目 | 測試案例 |
|------|---------|
| Zod schemas | 各 schema 的 valid/invalid input |
| 閾值常數 | 異常判斷邏輯正確 |

### I.3 覆蓋率目標

| 階段 | 行覆蓋率 |
|------|---------|
| MVP v1.0 | ≥ 60% |
| MVP v1.1 | ≥ 70% |
| Phase 2 | ≥ 80% |

### I.4 測試資料策略

- 測試中使用 **factory functions** 建立資料（不依賴 seed）
- Mock 外部服務（OpenAI API、S3）
- DB 測試使用 Prisma + SQLite in-memory 或 test database
- 每個 test suite 獨立（不依賴執行順序）

```typescript
// apps/web/__tests__/factories.ts
export function createTestUser(overrides = {}) {
  return {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPass1234',
    name: '測試使用者',
    role: 'caregiver',
    ...overrides,
  };
}

export function createTestMeasurement(overrides = {}) {
  return {
    type: 'blood_pressure',
    systolic: 120,
    diastolic: 80,
    heart_rate: 72,
    unit: 'mmHg',
    source: 'manual',
    measured_at: new Date().toISOString(),
    ...overrides,
  };
}
```

---

## J. Git 工作流與 PR 規範

### J.1 Branch 命名

```
格式：{type}/{short-description}

type 可選：
  feat/     — 新功能
  fix/      — 修 bug
  refactor/ — 重構
  docs/     — 文件
  test/     — 測試
  chore/    — 雜務（設定、依賴更新）

範例：
  feat/auth-login
  feat/measurement-crud
  fix/bp-threshold-calc
  chore/add-eslint-config
```

- **嚴禁**使用中文或空格
- **嚴禁**直接在 `main` 上開發

### J.2 Conventional Commits

```
格式：{type}({scope}): {description}

type：feat | fix | refactor | docs | test | chore | ci
scope：auth | recipient | measurement | ai | service-request | provider | admin | notification | mobile | web | shared | ci

範例：
  feat(measurement): add blood pressure CRUD endpoints
  fix(ai): handle timeout with fallback response
  chore(shared): update zod schemas for service request
  test(auth): add login error cases
```

- 描述使用英文、小寫開頭、不加句號
- body（可選）：解釋 why，不解釋 what
- 若 PR 包含 breaking change：`feat(api)!: rename measurement endpoint`

### J.3 PR Template

以下模板必須放在 `.github/pull_request_template.md`：

```markdown
## 變更摘要

<!-- 用 1-3 句描述這個 PR 做了什麼 -->

## 變更類型

- [ ] 新功能（feat）
- [ ] Bug 修復（fix）
- [ ] 重構（refactor）
- [ ] 測試（test）
- [ ] 文件（docs）
- [ ] 設定/依賴（chore）

## 影響範圍

- [ ] apps/mobile
- [ ] apps/web（API）
- [ ] apps/web（Admin UI）
- [ ] packages/shared
- [ ] CI/CD
- [ ] 資料庫 schema

## 測試

- [ ] 新增/更新了對應的測試
- [ ] 所有既有測試通過
- [ ] 手動測試過以下場景：
  -

## 截圖（UI 變更時必須提供）

## Checklist

- [ ] 程式碼符合 engineering-standards.md 規範
- [ ] ESLint 零錯誤且零 warning（`--max-warnings 0`）
- [ ] 無 `any` 型別
- [ ] API 使用 Zod 驗證
- [ ] API 有 ownership 檢查（若適用）
- [ ] 回應使用標準 envelope
- [ ] 無硬編碼 secret
- [ ] 無 console.log（使用 structured logger）
- [ ] Loading/Empty/Error 狀態已處理（前端）
- [ ] 免責聲明已顯示（AI 功能）
- [ ] 不超出 MVP 範圍（對照 implementation-spec A.5）
```

### J.4 Review Checklist

Reviewer 必須逐項檢查以下項目：

**功能性（8 項）**
1. ✅ 功能是否符合 implementation-spec 中的規格
2. ✅ API request/response 是否符合合約
3. ✅ 錯誤處理是否完整（所有 error path 都有處理）
4. ✅ 邊界條件是否處理（空值、超長輸入、非法輸入）
5. ✅ 狀態機轉換是否合法（service request status）
6. ✅ Ownership 檢查是否正確
7. ✅ 分頁/篩選是否正確實作
8. ✅ 時區處理是否正確（DB UTC、顯示轉換）

**程式碼品質（8 項）**
9. ✅ 無 `any` 型別
10. ✅ 命名是否符合規範（D.1）
11. ✅ 檔案/函式是否超過行數限制
12. ✅ 無 anti-pattern（D.4 清單）
13. ✅ Zod schema 是否從 shared 匯入
14. ✅ 無重複程式碼（>3 行相同邏輯應抽取）
15. ✅ 無不必要的依賴引入
16. ✅ async/await 錯誤處理是否完整

**安全性（5 項）**
17. ✅ 無硬編碼 secret
18. ✅ 無 SQL injection 風險（使用 Prisma）
19. ✅ 無 XSS 風險（無 dangerouslySetInnerHTML）
20. ✅ log 中無敏感資訊
21. ✅ API 有認證檢查

**測試（4 項）**
22. ✅ 新功能有對應測試
23. ✅ 測試覆蓋 happy path + error path
24. ✅ 測試資料使用 factory（不依賴外部狀態）
25. ✅ 所有測試通過

**範圍（2 項）**
26. ✅ 不超出 MVP 範圍
27. ✅ 不包含與 PR 描述無關的變更

---

## K. CI/CD 規範

### K.1 GitHub Actions Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SKIP_ENV_VALIDATION: true
```

### K.2 Branch Protection Rules

在 GitHub repo settings 中設定 `main` 分支保護：

- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Require status checks to pass: `lint`, `typecheck`, `test`, `build`
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

### K.3 Release Tagging

```bash
# 格式：v{major}.{minor}.{patch}
# MVP 從 v0.1.0 開始

# 可 Demo 版本
git tag -a v0.1.0 -m "MVP v0.1.0 - Core flow complete"
git push origin v0.1.0
```

- 每次可 Demo 的里程碑打一次 tag
- Tag 附帶 release notes（GitHub Releases）

### K.4 Vercel 部署

- `main` 分支自動部署到 Production
- PR 分支自動產生 Preview Deployment
- 環境變數按 Environment 設定（Development/Preview/Production）
- Build command：`cd apps/web && pnpm build`
- Output directory：`apps/web/.next`
- Root directory：`apps/web`

### K.5 Expo 部署

- MVP 階段使用 Expo Go 掃 QR code
- 正式發佈前使用 EAS Build：`eas build --profile preview --platform all`
- OTA 更新：`eas update --branch preview`

---

## L. Observability 規範

### L.1 Logger 格式

所有後端 log 必須為 **JSON 格式**，包含以下欄位：

```typescript
// apps/web/lib/logger.ts

interface LogEntry {
  timestamp: string;    // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  request_id: string;   // 從 x-request-id header 取得（由 middleware 注入）
  message: string;
  method?: string;      // HTTP method
  path?: string;        // API path
  status?: number;      // HTTP status code
  duration_ms?: number; // 回應時間
  user_id?: string;     // 已脫敏
  user_role?: string;
  error_code?: string;  // 自訂 error code
  [key: string]: unknown;
}

export function createLogger(requestId: string) {
  return {
    info: (message: string, meta?: Record<string, unknown>) =>
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', request_id: requestId, message, ...meta })),
    warn: (message: string, meta?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'warn', request_id: requestId, message, ...meta })),
    error: (message: string, meta?: Record<string, unknown>) =>
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', request_id: requestId, message, ...meta })),
  };
}
```

### L.2 Request ID

- 每個 API 請求必須有唯一 `request_id`
- 來源：client 傳入 `X-Request-Id` header，或由 server 自動生成 UUID
- 回應 header 中回傳 `X-Request-Id`
- 所有 log 必須包含 `request_id`

#### 實作方式：Next.js Middleware 轉傳 Request ID

> **注意**：Next.js middleware 中 `request.headers` 為唯讀，不可直接 `request.headers.set()`。必須建立新的 `Headers` 物件並透過 `NextResponse.next({ request: { headers } })` 傳遞給下游 route handler。

```typescript
// apps/web/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 取得或生成 request ID
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();

  // 建立新的 request headers（包含 request ID）
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  // 透過 NextResponse.next 的 request option 傳遞修改後的 headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 在 response 中也回傳 request ID
  response.headers.set('x-request-id', requestId);

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

#### Route Handler 中讀取 Request ID

```typescript
// 在任何 route handler 中
export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const logger = createLogger(requestId);
  // ...
}
```

- 即使 middleware 已注入，route handler 仍應做 fallback（`?? crypto.randomUUID()`）以防 middleware 被繞過
- **嚴禁**使用 `import { randomUUID } from 'crypto'`（Edge Runtime 不支援 Node.js `crypto` module），改用 Web API `crypto.randomUUID()`

### L.3 Sentry 設定

- **apps/web**：使用 `@sentry/nextjs`
- **apps/mobile**：使用 `@sentry/react-native`（或 `sentry-expo`）
- 所有未捕獲的 exception 自動上報
- AI 呼叫失敗必須手動呼叫 `Sentry.captureException(error, { extra: { ... } })`
- 設定 `environment`：`development` / `staging` / `production`

### L.4 必要事件紀錄

以下事件**必須**產生 structured log（`level: 'info'` 或 `'warn'`）：

| # | 事件 | Level | 額外欄位 |
|---|------|-------|---------|
| 1 | 使用者註冊 | info | `user_id` |
| 2 | 登入成功 | info | `user_id` |
| 3 | 登入失敗 | warn | `email`（脫敏）、`reason` |
| 4 | 被照護者建立 | info | `recipient_id`、`caregiver_id` |
| 5 | 量測資料建立 | info | `measurement_id`、`type`、`is_abnormal` |
| 6 | 異常通知觸發 | warn | `recipient_id`、`type`、`threshold` |
| 7 | AI 報告生成成功 | info | `report_id`、`model`、`input_tokens`、`output_tokens`、`duration_ms` |
| 8 | AI 報告生成失敗 | error | `error_code`、`model`、`duration_ms` |
| 9 | 服務需求單建立 | info | `request_id`、`category` |
| 10 | 需求單狀態變更 | info | `request_id`、`from_status`、`to_status`、`admin_id` |
| 11 | 服務人員審核變更 | info | `provider_id`、`from_status`、`to_status`、`admin_id` |
| 12 | Cron job 執行 | info | `job_name`、`duration_ms`、`items_processed` |
| 13 | 檔案上傳 | info | `provider_id`、`file_size`、`mime_type` |
| 14 | Device API 呼叫 | info | `device_id`、`type`、`is_abnormal` |

---

## M. 文件與變更管理

### M.1 Change Request 流程

任何超出 implementation-spec 定義範圍的需求變更，必須走以下流程：

1. 提出者填寫 Change Request（見模板）
2. 兩位工程師討論影響範圍
3. 確認是否屬於 MVP 範圍（對照 implementation-spec A.5）
4. 若超出 MVP → **拒絕**並記錄到 Phase 2 backlog
5. 若屬於 MVP 範圍內的調整 → 評估工時 → 更新 spec → 執行

### M.2 Change Request 模板

```markdown
# Change Request

## 日期
YYYY-MM-DD

## 提出者
[姓名]

## 變更描述
<!-- 用 1-3 句話描述想要變更的內容 -->

## 變更理由
<!-- 為什麼需要這個變更？ -->

## 影響範圍
- [ ] 資料庫 schema
- [ ] API 合約
- [ ] Mobile 頁面
- [ ] Admin 頁面
- [ ] AI 行為
- [ ] 通知規則
- [ ] 部署配置

## 預估工時
<!-- 小時數 -->

## MVP 範圍判定
- [ ] 屬於 MVP 10 模組範圍內的調整
- [ ] 超出 MVP 範圍 → 移至 Phase 2

## 決議
- [ ] 核准
- [ ] 拒絕
- [ ] 延後至 Phase 2

## 備註
```

### M.3 Spec 更新規則

- 任何核准的 Change Request 必須**同步更新** `implementation-spec.md`
- Spec 更新必須以 PR 方式提交（同程式碼審核流程）
- 更新 spec 的 commit 必須使用：`docs(spec): {描述}`

### M.4 MVP 邊界守門規則

以下情境**一律拒絕**，不進入 Change Request 評估：

1. 涉及 implementation-spec A.5「嚴格排除」清單中的項目
2. 需要新增第三方付費服務（超出已定案的技術棧）
3. 需要超過 8 工時且無法拆分的功能
4. 涉及新增角色（超出 `caregiver` + `admin`）
5. 涉及新增通知通道（超出 in-app）
6. 涉及新增資料類型（超出血壓/血糖）

> **最高原則**：MVP 的目的是「可上線、可展示、可驗證市場、可拉投資」。任何偏離此目標的變更都應該被挑戰。

---

> **文件結束**。本文件與 `implementation-spec.md` 共同構成團隊的工程規範依據，所有成員必須遵守。
