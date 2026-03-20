# Sprint B Planning Pack v1

> Sprint B — Caregiver High-Frequency Flow Polish
> Depends on: Sprint A foundation (complete), visual-direction-v1 (complete)
> Source of truth: implementation-spec.md, implementation-plan.md

---

## PART 1 — Sprint B Objective

### Goal

Apply Sprint A shared primitives (theme tokens, Card, StatusPill, EmptyState, ErrorState, Toast) and visual-direction-v1 rules to the caregiver's highest-frequency mobile pages, creating a consistent, trustworthy, polished experience across the core daily-use flow.

### What Sprint B Delivers

- Every caregiver page touched in Sprint B will: use theme tokens (zero hardcoded hex), use shared components (Card, StatusPill, EmptyState, ErrorState, Toast), follow visual-direction-v1 hierarchy and spacing rules.
- The caregiver's most-used flow (home → recipient → health → add measurement → AI report) will feel like one cohesive product, not a collection of individually-styled screens.
- Sprint A primitives get real-world validation through adoption.

### What Sprint B Avoids

- No new features. No new API endpoints. No schema changes.
- No admin, provider, or patient page changes.
- No chart library installation (trends chart is deferred — see PART 3).
- No navigation/routing changes.
- No profile/settings page creation (verified missing — see PART 3).

---

## PART 2 — Candidate Scope Review

### STRONG_SPRINT_B_CANDIDATE

| Page | Why |
|------|-----|
| **home/index.tsx** (Home Dashboard) | Highest frequency page. First thing caregiver sees. Uses inline STATUS_DISPLAY, inline cards, hardcoded colors, Alert.alert. Maximum visual leverage. |
| **health/index.tsx** (Health Measurements) | Second-highest frequency. Measurement list is the core data view. Inline cards, inline chip colors, hardcoded hex throughout. |
| **health/add-measurement.tsx** (Add Measurement) | Core action page. Uses Alert.alert for success. Inline form styling. High trust impact — recording health data must feel reliable. |
| **ai/index.tsx** (AI Report) | High trust impact. Inline STATUS_COLORS, inline cards. AI disclaimer is critical. Duplicate code with health/ai-report.tsx needs reconciliation. |
| **services/index.tsx** (Service Request List) | Core workflow page. Inline STATUS_CONFIG duplicated across files. Inline cards. |
| **services/new-request.tsx** (New Service Request) | Core action page. Uses Alert.alert. Inline styling. Width calculation hack. |
| **home/notifications.tsx** (Notifications) | Frequently accessed. Inline cards, hardcoded colors, emoji icons, awkward back-button placement. |

### POSSIBLE_BUT_NOT_FIRST

| Page | Why |
|------|-----|
| **home/[recipientId]/index.tsx** (Recipient Detail) | Important but lower frequency than list pages. Contains reminder management with Switch — more complex to refactor. |
| **home/[recipientId]/edit.tsx** (Edit Recipient) | Lower frequency. Form refactoring is straightforward but not high-leverage. |
| **home/add-recipient.tsx** (Add Recipient) | Lower frequency. Simple form. Partial loading states. |
| **services/[requestId].tsx** (Service Request Detail) | Important for trust but depends on status timeline decision (VERIFY_FIRST). |
| **home/appointments.tsx** (Appointments List) | Medium frequency. Inline date-color logic. |
| **home/add-appointment.tsx** (Add Appointment) | Low frequency. Simple form. No loading indicator. |
| **health/export.tsx** (Export) | Low frequency. Partial states. |

### VERIFY_FIRST

| Page | Why |
|------|-----|
| **health/trends.tsx** (Trends) | Verified: NO chart exists — table/text only. Visual-direction-v1 defines chart specs but implementation requires a chart library. Sprint B should NOT install chart libs. Classify as DEFER. |
| **Profile/Settings** | Verified: NO caregiver profile/settings page exists. This is an MVP gap vs spec. Sprint B should NOT create new pages. Classify as DEFER + document as DISCOVERED_MVP_GAP. |
| **health/ai-report.tsx** (AI Report sub-page) | Duplicate of ai/index.tsx logic. Need to verify whether both are reachable or if one is dead code. |

### DEFER

| Page | Why |
|------|-----|
| **health/trends.tsx** | Needs chart library. Deferred to dedicated chart sprint. |
| **Profile/Settings** | Does not exist. New page creation is out of Sprint B scope. |

---

## PART 3 — Verification-First Items

### V-01: Trends Chart Reality

| Field | Detail |
|-------|--------|
| **Item** | health/trends.tsx chart implementation |
| **Why verification matters** | visual-direction-v1 defines detailed chart specs (dual-line BP, single-line BG, threshold bands). Sprint B must know if chart polish is possible or requires new dependency. |
| **Verification result** | **VERIFIED: No chart exists.** Page renders stats cards + daily table rows only. No chart library imported. All data displayed as text/numbers. |
| **Blocks Sprint B?** | No. Trends chart work is classified as DEFER_TO_CHART_SPRINT. Sprint B can still polish the stats cards and table on this page if desired, but chart creation is out of scope. |
| **Action** | Exclude chart implementation from Sprint B. Document as future work requiring chart library decision (react-native-chart-kit, victory-native, or react-native-svg-charts). |

### V-02: Profile/Settings Page

| Field | Detail |
|-------|--------|
| **Item** | Caregiver profile/settings page existence |
| **Why verification matters** | visual-direction-v1 mentions moving logout to profile page. ux-execution-backlog-v1 references profile polish. |
| **Verification result** | **VERIFIED: Does not exist.** Caregiver tab layout has 4 tabs (首頁/健康/安心報/服務). No profile tab. Only provider role has provider-profile.tsx. |
| **Blocks Sprint B?** | Partially. Cannot move logout to profile page. Can still polish existing logout placement. |
| **Action** | DISCOVERED_MVP_GAP. Spec section G.2.10 defines profile page. This needs a dedicated task in a future sprint. Sprint B should NOT create it. Sprint B should note that logout currently sits in home header — keep it there for now. |

### V-03: AI Report Duplicate Pages

| Field | Detail |
|-------|--------|
| **Item** | ai/index.tsx vs health/ai-report.tsx — are both reachable? |
| **Why verification matters** | Both files contain nearly identical AI report logic with duplicated STATUS_COLORS. Refactoring one without the other creates inconsistency. |
| **Verification result** | Both are reachable. ai/index.tsx is the tab entry (安心報 tab). health/ai-report.tsx is a sub-page accessible from the health tab. Both render AI reports with similar but not identical code. |
| **Blocks Sprint B?** | No, but both must be polished together to avoid divergence. |
| **Action** | Polish ai/index.tsx as the primary AI report page. Then apply the same changes to health/ai-report.tsx. Consider whether they should share a common component (HYPOTHESIS — evaluate during implementation). |

### V-04: Service Request Detail Timeline

| Field | Detail |
|-------|--------|
| **Item** | services/[requestId].tsx status timeline |
| **Why verification matters** | visual-direction-v1 defines a timeline with vertical line + colored dots. But does the current page already have this? |
| **Verification result** | **VERIFIED: No timeline exists.** Only a single status badge at top. No status progression visualization. No history of status changes displayed. |
| **Blocks Sprint B?** | No. Timeline is a new UI element, not a polish item. Classify as future enhancement. Sprint B can polish the existing status badge display. |
| **Action** | Defer timeline UI to Sprint B+ or Sprint C. Sprint B polishes what exists: status badge → StatusPill, inline colors → theme tokens, card styles → Card component. |

---

## PART 4 — Final Sprint B Scope

### Selected Pages (8 pages)

| # | Page | File | Why In Sprint B | Polish Goals | Risk |
|---|------|------|----------------|-------------|------|
| B-01 | Home Dashboard | home/index.tsx | Highest frequency, highest visual leverage | Theme tokens, Card, StatusPill, EmptyState, ErrorState adoption. Remove Alert.alert. | Low — purely UI. |
| B-02 | Health Measurements | health/index.tsx | Second-highest frequency | Theme tokens, Card, chip consistency, EmptyState/ErrorState adoption. | Low — purely UI. |
| B-03 | Add Measurement | health/add-measurement.tsx | Core action, trust-critical | Theme tokens, form consistency, Toast for success, loading state improvement. | Low — purely UI. |
| B-04 | AI Report (Tab) | ai/index.tsx | Trust-critical, AI disclaimer must be correct | Theme tokens, Card, StatusPill for AI status, EmptyState, disclaimer verification. | Low — purely UI. |
| B-05 | AI Report (Health sub) | health/ai-report.tsx | Must stay consistent with B-04 | Same changes as B-04. | Low — apply same pattern. |
| B-06 | Service Request List | services/index.tsx | Core workflow page | Theme tokens, Card, StatusPill from shared constants, EmptyState/ErrorState. | Low — purely UI. |
| B-07 | New Service Request | services/new-request.tsx | Core action, form consistency | Theme tokens, form styling, Toast for success, fix width hack. | Low — purely UI. |
| B-08 | Notifications | home/notifications.tsx | Frequently accessed, visible inconsistency | Theme tokens, Card, EmptyState, remove awkward back-button. | Low — purely UI. |

### Excluded from Sprint B (with reason)

| Page | Reason |
|------|--------|
| home/[recipientId]/index.tsx | POSSIBLE_BUT_NOT_FIRST — complex reminder/Switch refactoring |
| home/[recipientId]/edit.tsx | Lower frequency form |
| home/add-recipient.tsx | Lower frequency form |
| services/[requestId].tsx | Status timeline is deferred; basic badge polish can ride later |
| home/appointments.tsx | Medium frequency, simpler fix |
| home/add-appointment.tsx | Low frequency form |
| health/trends.tsx | Chart requires new library — DEFER |
| health/export.tsx | Low frequency |
| Profile/Settings | Does not exist — MVP gap — DEFER |

---

## PART 5 — Page Implementation Order

```
B-01  Home Dashboard             ← highest leverage, validates all primitives
B-02  Health Measurements        ← second-highest frequency, similar pattern
B-03  Add Measurement            ← core action page following health flow
B-04  AI Report (Tab)            ← trust-critical, validates StatusPill for AI statuses
B-05  AI Report (Health sub)     ← near-identical to B-04, apply same pattern
B-06  Service Request List       ← validates StatusPill for service request statuses
B-07  New Service Request        ← core form, follows service flow
B-08  Notifications              ← independent page, low dependency
```

### Rationale

1. **B-01 first**: Home is the entry point. Polishing it validates Card + StatusPill + EmptyState + ErrorState + theme adoption all in one page. Every subsequent page follows the same pattern.
2. **B-02 → B-03**: Natural flow continuation (view measurements → add measurement). Health tab is the second most-used.
3. **B-04 → B-05**: AI pages together to ensure consistency. B-05 mirrors B-04.
4. **B-06 → B-07**: Service flow together (list → create).
5. **B-08 last**: Notifications is independent with no flow dependency. Lowest risk to defer if Sprint B runs long.

---

## PART 6 — Page-by-Page Adoption Plan

### B-01: Home Dashboard (home/index.tsx)

| Field | Detail |
|-------|--------|
| **Page goal** | Show all recipients with AI health status at a glance. Answer "Is everyone okay?" |
| **Current UX weaknesses** | Hardcoded colors (#22c55e, #eab308 etc). Inline STATUS_DISPLAY object. Inline card styles with shadow. Alert.alert on delete. Emoji bell icon (🔔). Logout button in header next to bell. ActivityIndicator-only loading. Plain-text empty state. |
| **Shared primitives to adopt** | theme (all colors, typography, spacing, radius, shadows), Card (recipient cards), StatusPill (AI status badge per card), EmptyState (no recipients), ErrorState (load failure), Toast (if any success feedback needed) |
| **Visual-direction rules** | Card padding 16px. Section breathing 24px. StatusPill in card header top-right. AI status as small colored pill. Tags as blue tinted pills below name. FAB retains shadows.high. Greeting text uses headingLg. |
| **Likely files affected** | `apps/mobile/app/(tabs)/home/index.tsx` |
| **Backend changes** | None |
| **Scope** | UI_ONLY |

### B-02: Health Measurements (health/index.tsx)

| Field | Detail |
|-------|--------|
| **Page goal** | View measurement history for a selected recipient. Quick access to add, trends, export. |
| **Current UX weaknesses** | Hardcoded chip colors. Inline card with left-border. Hardcoded abnormal badge. Inline empty/error text. |
| **Shared primitives to adopt** | theme (colors, typography, spacing), Card (measurement list items), EmptyState (no measurements), ErrorState (load failure) |
| **Visual-direction rules** | Recipient selector chips: inactive #F3F4F6/#374151, active #DBEAFE/#1D4ED8. Measurement cards use Card with 4px left-border accent (green normal, red abnormal). Quick-action buttons as secondary style. |
| **Likely files affected** | `apps/mobile/app/(tabs)/health/index.tsx` |
| **Backend changes** | None |
| **Scope** | UI_ONLY |

### B-03: Add Measurement (health/add-measurement.tsx)

| Field | Detail |
|-------|--------|
| **Page goal** | Record a blood pressure or blood glucose reading for a recipient. |
| **Current UX weaknesses** | Alert.alert for success. Inconsistent type-toggle and timing-button styles. No loading spinner during submission. Error messages not visually prominent. Partial loading states. |
| **Shared primitives to adopt** | theme (colors, typography, spacing, radius), Toast (success feedback), ErrorState (if needed) |
| **Visual-direction rules** | Form inputs: white bg, 1px borderStrong, 8px radius, 12px padding, 16px font. Label above input (14px, weight 600, textSecondary). Type toggle: chip-style (inactive=bgSurfaceAlt, active=primaryLight). Timing buttons: same chip style. Primary submit button: full-width, solid primary blue, 12px radius. Loading state: button text → "儲存中..." with disabled. |
| **Likely files affected** | `apps/mobile/app/(tabs)/health/add-measurement.tsx` |
| **Backend changes** | None |
| **Scope** | UI_ONLY |

### B-04: AI Report — Tab Entry (ai/index.tsx)

| Field | Detail |
|-------|--------|
| **Page goal** | View AI health summary for a recipient. Generate/refresh reports. View history. |
| **Current UX weaknesses** | Inline STATUS_COLORS duplicated from health/ai-report.tsx. Inline resultCard/historyCard styles. Inline empty card. Generic loading text. Rate limit not differentiated from error. |
| **Shared primitives to adopt** | theme (all tokens), Card (report card, history cards, empty card), StatusPill type="aiHealth" (穩定/需注意/建議就醫), EmptyState (no report yet), ErrorState (API failure) |
| **Visual-direction rules** | Report card padding 20px (wider than standard). AI status pill in header right-aligned, 14px text. Summary text 16px, line-height 24px. Disclaimer: 11px gray italic, hairline border-top separator. Rate limit: info-blue banner (#DBEAFE bg, #1D4ED8 text), NOT error-red. Generate button: full-width primary. History cards: compact, 12px padding. |
| **Likely files affected** | `apps/mobile/app/(tabs)/ai/index.tsx` |
| **Backend changes** | None |
| **Scope** | UI_ONLY |

### B-05: AI Report — Health Sub-page (health/ai-report.tsx)

| Field | Detail |
|-------|--------|
| **Page goal** | Same as B-04 but accessed from health tab navigation. |
| **Current UX weaknesses** | Same as B-04 — duplicated STATUS_COLORS, inline cards, inline styles. |
| **Shared primitives to adopt** | Same as B-04 |
| **Visual-direction rules** | Same as B-04. Must be visually identical. |
| **Likely files affected** | `apps/mobile/app/(tabs)/health/ai-report.tsx` |
| **Backend changes** | None |
| **Scope** | UI_ONLY |

### B-06: Service Request List (services/index.tsx)

| Field | Detail |
|-------|--------|
| **Page goal** | View all service requests with status. Navigate to create new or view detail. |
| **Current UX weaknesses** | Inline STATUS_CONFIG (9 statuses hardcoded). Inline card styles. FAB with inconsistent positioning. No pull-to-refresh despite having props. |
| **Shared primitives to adopt** | theme (all tokens), Card (request cards), StatusPill type="serviceRequest" (all 9 statuses), EmptyState (no requests), ErrorState (load failure) |
| **Visual-direction rules** | Card padding 16px. StatusPill in card header top-right. Category name as card title (headingSm). Recipient name + date as secondary info (bodySm, textTertiary). FAB: 56px circle, primary blue, shadows.high. |
| **Likely files affected** | `apps/mobile/app/(tabs)/services/index.tsx` |
| **Backend changes** | None |
| **Scope** | UI_ONLY |

### B-07: New Service Request (services/new-request.tsx)

| Field | Detail |
|-------|--------|
| **Page goal** | Submit a new service request by choosing category, recipient, time, location, notes. |
| **Current UX weaknesses** | Alert.alert for success. Category card width hack (`width: '48%' as unknown as number`). Time slot labels defined inline. Chip and category card styling inconsistent. |
| **Shared primitives to adopt** | theme (all tokens), Card (category selection cards), Toast (success feedback) |
| **Visual-direction rules** | Category grid: 2 columns with proper gap calculation using theme spacing. Category cards: Card component with centered text, selected state = 2px primary border. Time slot chips: standard chip styling (inactive/active). Form inputs: standard form rules from visual-direction. Submit button: full-width primary, bottom of form. Time slot labels should reference TIME_SLOT_DISPLAY from shared constants. |
| **Likely files affected** | `apps/mobile/app/(tabs)/services/new-request.tsx` |
| **Backend changes** | None |
| **Scope** | UI_ONLY |

### B-08: Notifications (home/notifications.tsx)

| Field | Detail |
|-------|--------|
| **Page goal** | View all notifications with read/unread state. Mark as read. |
| **Current UX weaknesses** | Hardcoded colors. Inline card styles. Emoji notification type icons. Awkward absolute-positioned back button at bottom-left. |
| **Shared primitives to adopt** | theme (all tokens), Card (notification items), EmptyState (no notifications), ErrorState (load failure) |
| **Visual-direction rules** | Notification cards: Card component, 16px padding. Unread indicator: small 8px primary-blue dot left of title, or slightly tinted card background (#F0F7FF). Read state: standard white card. Notification type icon: keep emoji for now (matches NOTIFICATION_TYPE_DISPLAY), but wrap in a consistent 32px circle container. Remove floating back button — rely on expo-router's built-in back navigation. |
| **Likely files affected** | `apps/mobile/app/(tabs)/home/notifications.tsx` |
| **Backend changes** | None |
| **Scope** | UI_ONLY |

---

## PART 7 — Visual Direction Application Rules

### HARD_RULE (must be enforced on every Sprint B page)

| # | Rule | Enforcement |
|---|------|------------|
| HR-01 | Zero hardcoded hex values | Every color reference must use `colors.xxx` from `@/lib/theme`. Search for `#` in StyleSheet after refactoring — must be zero (except inside theme.ts itself). |
| HR-02 | Every card uses `<Card>` component | No inline card styling (borderRadius + shadow + border + bg). Import from `@/components/ui`. |
| HR-03 | Every status badge uses `<StatusPill>` | No inline STATUS_CONFIG / STATUS_DISPLAY / STATUS_COLORS objects. Import StatusPill from `@/components/ui`. |
| HR-04 | Every empty list uses `<EmptyState>` | No inline "尚無資料" text. Must include title + description + optional action. |
| HR-05 | Every error state uses `<ErrorState>` | No inline red error text. Must include message + retry button. |
| HR-06 | No Alert.alert for success | Replace with `<Toast>` component. Alert.alert allowed only for destructive confirmation dialogs. |
| HR-07 | Typography from theme | Font sizes, weights reference `typography.xxx` from theme. |
| HR-08 | Spacing from theme | Padding, margins, gaps reference `spacing.xxx` from theme. |
| HR-09 | Radius from theme | Border radius references `radius.xxx` from theme. |

### PREFERRED_DIRECTION (should be applied, minor deviation acceptable with justification)

| # | Direction | Notes |
|---|----------|-------|
| PD-01 | Card padding is 16px (spacing.lg) for caregiver pages | May be 12px for tighter card areas if justified. |
| PD-02 | Section breathing between card groups is 24px (spacing['2xl']) | Between sections, not between cards in same group. |
| PD-03 | Primary button full-width at bottom of forms | If form area is narrow, centered button acceptable. |
| PD-04 | Loading uses skeleton pattern for lists, ActivityIndicator for detail pages | ActivityIndicator acceptable everywhere if skeleton is not yet implemented. |
| PD-05 | Recipient selector chips use standard active/inactive chip styling | Active: primaryLight bg + primaryText. Inactive: bgSurfaceAlt + textSecondary. |

### PAGE_SPECIFIC_GUIDANCE

| Page | Guidance |
|------|---------|
| B-01 Home | Add 4px left-border accent on recipient cards colored by AI status (green/yellow/red). |
| B-03 Add Measurement | Type toggle (BP/BG) and timing selector (空腹/餐前/餐後) use chip styling. |
| B-04/B-05 AI Report | Report card uses 20px padding. Disclaimer is 11px italic with hairline top border. Rate limit = info banner, not error. |
| B-07 New Request | Category grid uses flex with proper gap, no percentage-width hack. |
| B-08 Notifications | Unread items have subtle bg tint. Remove absolute-positioned back button. |

---

## PART 8 — Shared Primitive Adoption Matrix

| Page | theme | status-display | Card | StatusPill | EmptyState | ErrorState | Toast |
|------|-------|---------------|------|-----------|-----------|-----------|-------|
| B-01 Home Dashboard | ✅ | ✅ AI_STATUS_DISPLAY | ✅ recipient cards | ✅ AI status | ✅ no recipients | ✅ load failure | — |
| B-02 Health Measurements | ✅ | — | ✅ measurement items | — | ✅ no measurements | ✅ load failure | — |
| B-03 Add Measurement | ✅ | — | — | — | — | — | ✅ success |
| B-04 AI Report (Tab) | ✅ | ✅ AI_STATUS_DISPLAY | ✅ report + history | ✅ AI status | ✅ no report | ✅ load failure | — |
| B-05 AI Report (Health) | ✅ | ✅ AI_STATUS_DISPLAY | ✅ report + history | ✅ AI status | ✅ no report | ✅ load failure | — |
| B-06 Service Request List | ✅ | ✅ SERVICE_REQUEST_STATUS | ✅ request cards | ✅ request status | ✅ no requests | ✅ load failure | — |
| B-07 New Service Request | ✅ | ✅ TIME_SLOT_DISPLAY | ✅ category cards | — | — | — | ✅ success |
| B-08 Notifications | ✅ | ✅ NOTIFICATION_TYPE | ✅ notification items | — | ✅ no notifications | ✅ load failure | — |

**Summary**: theme is universal. Card is adopted on 7/8 pages. StatusPill on 4/8. EmptyState on 6/8. ErrorState on 6/8. Toast on 2/8.

---

## PART 9 — Non-Goals and Deferred Items

### Sprint B Non-Goals

| # | Non-Goal | Why |
|---|---------|-----|
| 1 | **Chart library installation** | trends.tsx has no chart. Adding one requires library evaluation + dependency. Defer to chart-focused sprint. |
| 2 | **Profile/Settings page creation** | Does not exist. New page creation is beyond polish scope. Defer to dedicated feature task. |
| 3 | **Status timeline UI** | services/[requestId].tsx has no timeline. Creating one is a new feature. Defer. |
| 4 | **Logout relocation to profile** | Profile page doesn't exist. Keep logout in current position (home header). |
| 5 | **Admin page polish** | Sprint C scope. |
| 6 | **Patient page polish** | Sprint D scope. |
| 7 | **Provider page polish** | Sprint E scope. |
| 8 | **Navigation/routing changes** | Tab layout is working. No changes. |
| 9 | **API contract changes** | All work is UI_ONLY. |
| 10 | **New shared UI components** | Sprint B uses only Sprint A primitives. No new components unless a clear gap emerges during implementation. |

### Deferred to Later Sprints

| Item | Target Sprint | Reason |
|------|--------------|--------|
| Trends chart implementation | Chart Sprint (new) | Requires chart library decision |
| Profile/Settings page | Feature Sprint (new) | New page — MVP gap |
| Status timeline in request detail | Sprint B+ or Sprint C | New UI pattern |
| Recipient detail polish | Sprint B+ | Complex (Switch/reminders) |
| Edit/Add recipient polish | Sprint B+ | Lower frequency forms |
| Appointments polish | Sprint B+ | Medium frequency |
| Service request detail polish | Sprint B+ | Depends on timeline decision |
| Export page polish | Sprint B+ | Low frequency |
| Skeleton loading states | Cross-sprint | Preferred but not required for B |

---

## PART 10 — Acceptance Checklists

### B-01: Home Dashboard

- [ ] All hex values replaced with theme token references
- [ ] Inline STATUS_DISPLAY removed, StatusPill component used for AI status
- [ ] Inline card styles removed, Card component used for recipient cards
- [ ] Alert.alert replaced with appropriate feedback (Toast or confirm dialog)
- [ ] EmptyState used when no recipients (with title + description + "新增被照護者" action)
- [ ] ErrorState used on load failure (with message + retry)
- [ ] Loading state uses ActivityIndicator with muted text
- [ ] FAB uses theme colors + shadows.high
- [ ] Bell icon is emoji (acceptable) or text indicator, consistently styled
- [ ] Greeting text uses typography.headingLg
- [ ] Card spacing follows spacing.md (12px) between cards
- [ ] Section spacing follows spacing['2xl'] (24px) between sections
- [ ] No new features introduced
- [ ] No API changes
- [ ] pnpm lint && pnpm typecheck && pnpm test && pnpm build all pass

### B-02: Health Measurements

- [ ] All hex values replaced with theme tokens
- [ ] Inline card styles replaced with Card component
- [ ] Recipient selector chips use theme chip styling (active: primaryLight/primaryText, inactive: bgSurfaceAlt/textSecondary)
- [ ] Abnormal measurement indicator uses theme semantic colors (dangerLight bg, danger text)
- [ ] EmptyState for no measurements (with action button to add measurement)
- [ ] ErrorState for load failure
- [ ] Quick-action buttons (新增/趨勢/匯出) use consistent secondary button styling
- [ ] No API changes
- [ ] CI green

### B-03: Add Measurement

- [ ] All hex values replaced with theme tokens
- [ ] Alert.alert success replaced with Toast ("量測紀錄已儲存" for success)
- [ ] Type toggle (BP/BG) uses chip styling from theme
- [ ] Timing selector uses chip styling from theme
- [ ] Form inputs use: white bg, 1px borderStrong, radius.sm, 12px padding
- [ ] Labels above inputs: 14px weight 600 textSecondary
- [ ] Submit button: full-width, primary blue, radius.md
- [ ] Loading state: button text → "儲存中..." with opacity reduction
- [ ] Error display for validation uses danger color
- [ ] Toast component added to render tree
- [ ] No API changes
- [ ] CI green

### B-04: AI Report (Tab)

- [ ] All hex values replaced with theme tokens
- [ ] Inline STATUS_COLORS removed, StatusPill type="aiHealth" used
- [ ] Report card uses Card component with 20px padding
- [ ] History cards use Card component with 12px padding
- [ ] EmptyState for no report (title + description + generate button)
- [ ] ErrorState for API failure
- [ ] Disclaimer: 11px, textTertiary, italic, hairline borderTop, 10px paddingTop
- [ ] Rate limit message uses infoLight bg + info text (NOT dangerLight)
- [ ] Generate button: full-width primary
- [ ] Chip selector for recipients uses standard chip styling
- [ ] AI summary text: 16px bodyLg, line-height ≥24px
- [ ] No API changes
- [ ] CI green

### B-05: AI Report (Health Sub)

- [ ] Same checklist as B-04
- [ ] Visually identical to B-04 result
- [ ] No divergent styling from B-04

### B-06: Service Request List

- [ ] All hex values replaced with theme tokens
- [ ] Inline STATUS_CONFIG removed, StatusPill type="serviceRequest" used
- [ ] Inline card styles replaced with Card component
- [ ] EmptyState for no requests (title + description + create action)
- [ ] ErrorState for load failure
- [ ] FAB: 56px circle, theme primary, shadows.high
- [ ] Card layout: category name headingSm, recipient + date as bodySm textTertiary
- [ ] StatusPill positioned top-right in card header row
- [ ] No API changes
- [ ] CI green

### B-07: New Service Request

- [ ] All hex values replaced with theme tokens
- [ ] Alert.alert success replaced with Toast ("需求已送出")
- [ ] Category grid: fixed with flex + gap, NO percentage-width hack
- [ ] Category cards use Card component with selected variant (2px primary border)
- [ ] Time slot chips use standard chip styling
- [ ] Time slot labels reference TIME_SLOT_DISPLAY from shared constants
- [ ] Form inputs follow standard form rules
- [ ] Submit button: full-width primary at bottom
- [ ] Toast component added to render tree
- [ ] No API changes
- [ ] CI green

### B-08: Notifications

- [ ] All hex values replaced with theme tokens
- [ ] Inline card styles replaced with Card component
- [ ] EmptyState for no notifications (title + description)
- [ ] ErrorState for load failure
- [ ] Unread notifications: subtle bg tint (e.g., colors.infoLight at 30% or similar)
- [ ] Notification type icons: keep emoji per NOTIFICATION_TYPE_DISPLAY, wrap in consistent container
- [ ] Awkward absolute-positioned back button removed (rely on expo-router stack navigation)
- [ ] "全部已讀" button uses secondary button styling
- [ ] No API changes
- [ ] CI green

---

## PART 11 — Recommended Implementation Sequence

### First page: B-01 Home Dashboard

**Why it should go first:**
1. Highest user frequency — every session starts here
2. Validates ALL Sprint A primitives in one page (theme, Card, StatusPill, EmptyState, ErrorState)
3. Establishes the refactoring pattern that all subsequent pages will follow
4. Maximum visual leverage — the page that sets first impressions

**Recommended implementation order within B-01:**
1. Replace all hardcoded hex values with theme token imports
2. Replace inline card styles with Card component
3. Replace inline STATUS_DISPLAY with StatusPill component
4. Replace empty state with EmptyState component
5. Replace error state with ErrorState component
6. Replace Alert.alert with appropriate feedback
7. Apply visual-direction spacing/hierarchy rules
8. Run verification (lint, typecheck, test, build)

**What happens immediately after B-01:**
- B-02 (Health Measurements) — follows the same refactoring pattern established in B-01
- The pattern should now be mechanical: import theme → replace cards → replace status → replace states → apply spacing → verify

**Human review checkpoint:**
- **RECOMMENDED after B-01 completion.** Home dashboard is the most visible page. Human review at this point confirms the refactoring pattern is visually correct before applying it to 7 more pages.
- After B-01 review is approved, B-02 through B-08 can proceed with auto-continue (same pattern, lower risk).

### Pause Checkpoints

| Checkpoint | When | Why |
|-----------|------|-----|
| **Checkpoint 1** | After B-01 Home Dashboard complete | Validate refactoring pattern visually |
| **Checkpoint 2** | After B-04 + B-05 AI Reports complete | Validate AI-specific visual rules (disclaimer, rate limit, 20px padding) |
| **Checkpoint 3** | After all B-01 through B-08 complete | Sprint B final review before moving to Sprint C |

---

*End of Sprint B Planning Pack v1*
