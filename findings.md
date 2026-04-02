# Slice 3 (Measurements) — Research Findings

## Repo Current State Audit

### Already Exists (Reusable)

| Asset | Location | Notes |
|-------|----------|-------|
| **Measurement Prisma model** | `schema.prisma:55-77` | All fields, indexes, FK to Recipient |
| **MeasurementCreateSchema** | `packages/shared/schemas/measurement.ts` | Discriminated union BP/BG, matches spec E.1 |
| **MeasurementQuerySchema** | Same file | recipient_id, type, from, to, page, limit |
| **MeasurementStatsQuerySchema** | Same file | recipient_id, type, period (7d/30d) |
| **BP_THRESHOLDS / BG_THRESHOLDS** | `packages/shared/constants/thresholds.ts` | Exact match with spec D.4 |
| **checkBloodPressureLevel()** | Same file | Returns 'normal'/'elevated'/'abnormal' |
| **checkBloodGlucoseLevel()** | Same file | Timing-aware (fasting/after_meal/random) |
| **ABNORMAL_ALERT_RULES** | Same file | RECENT_COUNT=3, ABNORMAL_THRESHOLD=2, DEDUP_HOURS=24 |
| **Enums** | `enums.ts` | MEASUREMENT_TYPES, GLUCOSE_TIMINGS, MEASUREMENT_SOURCES, NOTIFICATION_TYPES |
| **Notification model** | schema.prisma:195-209 | Already in DB schema |
| **Auth/CSRF/API helpers** | `apps/web/lib/` | verifyAuth, checkOrigin, successResponse/errorResponse/paginatedResponse |
| **API client (mobile)** | `apps/mobile/lib/api-client.ts` | get/post/put/delete with auth |

### Missing (Must Create)

- API routes: measurements CRUD + stats + export
- MeasurementExportQuerySchema (shared)
- formatMeasurement helper (web lib)
- Abnormal notification creation logic
- Seed: 30-day data + 李爺爺 recipient
- Mobile: health tab + 4 screens (index, add-measurement, trends, export)
- Integration tests + threshold unit tests
- Update recipient detail to show quick actions + recent measurements

## Notification Dependency

Spec F.3.3 says POST should "自動建立通知" on consecutive abnormal. But Slice 5 owns the full notification system.

**Resolution**: Slice 3 does the minimal `prisma.notification.create()` inline in POST handler. Slice 5 builds read/unread/count API and UI.

## Spec vs Plan Mismatches

1. **Abnormal notification**: Spec F.3.3 requires it in POST; Plan Slice 3 acceptance script doesn't mention it. → Follow spec.
2. **Recipient detail quick actions (G.2.4)**: Spec requires "記錄血壓/記錄血糖/看趨勢" buttons + recent 5 measurements. This is Slice 3 scope since it depends on measurement API. → Include.
3. **Device ingestion (E.2)**: Spec says "MVP 預留接口". Plan does NOT place it in Slice 3. → Defer.
4. **Chart library**: Plan suggests react-native-chart-kit. → Install at execution time.
