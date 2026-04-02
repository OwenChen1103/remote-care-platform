# Sprint 8 MVP Optimization — Task Plan (Final)

> **Status**: IN PROGRESS
> **Created**: 2026-03-27
> **Scope**: OPT-23 ~ OPT-28（二次比對新增項 — 最終 Sprint）
> **Depends on**: Sprint 1-7 complete

---

## Phases

| Phase | OPT | Description | Status |
|-------|-----|-------------|--------|
| 0 | — | 深入閱讀所有相關 code | ✅ Complete |
| 1 | OPT-25 | 需求單「重新選擇」按鈕 | ✅ Complete |
| 2 | OPT-27 | Caregiver 個人資料管理頁 | ✅ Complete |
| 3 | OPT-26 | 需求單狀態時間軸 | ✅ Complete |
| 4 | OPT-23 | 身體分數圖（calculateHealthScore + SVG 環形圖） | ✅ Complete |
| 5 | OPT-24 | AI 調窗 BottomSheet | ✅ Complete |
| 6 | OPT-28 | Provider 照片（photo_url + migration） | ✅ Complete |
| 7 | — | 自我檢查 + TypeScript check | ✅ Complete |

---

## Key Notes
- OPT-28 需要 1 次 Prisma migration（Provider 加 photo_url）
- OPT-23 需要新建 shared util（calculateHealthScore）+ SVG 元件
- OPT-24 改動首頁結構最大，需謹慎
- OPT-25, OPT-27 改動最小

## Files Modified

### New Files
- `packages/shared/src/utils/health-score.ts` — calculateHealthScore + HEALTH_LEVEL_LABELS
- `apps/mobile/app/(tabs)/home/profile.tsx` — Caregiver 個人資料管理頁
- `apps/web/prisma/migrations/20260327300000_add_provider_photo_url/migration.sql`

### Modified — Shared
- `packages/shared/src/index.ts` — export health-score utils

### Modified — Schema
- `apps/web/prisma/schema.prisma` — Provider +photo_url

### Modified — API
- `apps/web/app/api/v1/service-requests/[id]/route.ts` — include photo_url

### Modified — Mobile
- `apps/mobile/app/(tabs)/services/new-request.tsx` — 重新選擇按鈕
- `apps/mobile/app/(tabs)/services/[requestId].tsx` — 狀態時間軸 + Provider 照片
- `apps/mobile/app/(tabs)/home/[recipientId]/index.tsx` — 身體分數環形圖
- `apps/mobile/app/(tabs)/home/index.tsx` — AI BottomSheet + 個人資料管理 menu link
- `apps/mobile/app/(tabs)/_layout.tsx` — 註冊 profile hidden screen

## Self-Review Issues Fixed
- Fixed: OPT-26 cancelled dot 使用 STATUS_CONFIG 顏色而非硬編碼
- Fixed: OPT-27 profile phone 清空時送 null 而非 undefined
- Kept intentional: OPT-25 reset 保留 recipientId（加註解說明設計意圖）

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| shared module export not found | 1 | 需 pnpm build shared 後 mobile tsc 才能識別新 export |
