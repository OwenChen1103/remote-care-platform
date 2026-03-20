# UX EXECUTION BACKLOG v1.0

> Aligned to: `implementation-spec.md` v1.2.0, `implementation-plan.md` v1.1.0, `ux-refinement-framework-v1.md` v1.0

---

## PART 1 — Alignment Audit Summary

### Where the Refinement Framework Is Strong

1. **12 UX principles (P1-P12)** — Well-tailored to the four-role healthcare context. All principles are compatible with spec and plan. Nothing in them contradicts documented requirements.
2. **Design system tokens** — The proposed color, typography, spacing, radius, and elevation scales are purely additive. They do not contradict any spec requirement. The spec does not prescribe a design system, so defining one is within scope.
3. **Shared component inventory** — StatusPill, Card, Chip, Toast, EmptyState, ErrorState, InfoRow, ConfirmDialog — all address real inconsistencies observable from the spec's page definitions. Spec requires "all list pages have empty state" and "all async operations have loading indicator" (Section P.3), directly supporting this work.
4. **Interaction patterns** — Loading/empty/error/success/destructive patterns are well-aligned with spec Section P.3 non-functional acceptance requirements.
5. **Prioritization matrix** — Role ordering (caregiver > admin > provider > patient) aligns with spec's emphasis on caregiver as primary user and demo script focus.

### Where It Is Aligned with Spec/Plan

| Framework Claim | Spec/Plan Support |
|----------------|-------------------|
| Trends page needs a line chart | Spec G.2.5-G.2.6 explicitly requires dual-line BP chart + single-line BG chart + abnormal zone shading + red dots. Demo Step 5 requires showing line chart. |
| Profile/Settings page is missing | Spec G.2.11 explicitly defines `profile/index.tsx` with name/email/phone/timezone + edit + reminder settings + logout. |
| Admin recipients page lacks measurement data | Spec H.2.5 explicitly requires: name, caregiver, disease tags, latest BP, latest BG, latest abnormal + click-to-expand. |
| Service request detail needs status timeline | Spec G.2.9 explicitly states "status timeline showing conversion timestamps". |
| Admin needs multi-filter on service requests | Spec H.2.3 explicitly requires: status dropdown, service category, candidate/assigned provider, keyword search. |
| Admin provider management should have "Add New" | Spec H.2.4 explicitly includes "+ Add" button and new/edit page. |
| Admin service categories should be full CRUD | Spec H.2.6 explicitly states: new / edit / disable toggle. |
| Patient summary should show 7-day simplified trend | Spec G.2.4 explicitly states "近 7 天簡化趨勢圖（唯讀）". |
| Patient schedule should show appointments + service status | Spec G.2.8 explicitly requires: reminder list + 30-day appointments (read-only) + service progress summary card. |
| Provider task list should have status filter | Spec G.2.14 explicitly states "Status filter: arranged / in_service / completed". |

### Where It Drifts from Spec/Plan

1. **Framework calls trends chart "missing"** — This should be classified as "spec-defined, verify implementation status" because Slice 3 in the plan explicitly requires "Mobile 趨勢圖與空狀態完整". The chart may already exist in code but not match spec visual requirements, or it may genuinely be unimplemented despite the slice being marked complete.

2. **Framework says "no profile page exists"** — Same issue. Spec defines it (G.2.11) and Slice 1 includes `GET/PUT /auth/me`. The page may exist but simply not be wired into navigation, or it may be missing entirely. Needs code verification.

3. **Framework overstates certain "missing" admin features** — Admin provider creation, admin multi-filters, admin recipient measurements — these are all explicitly in spec and should have been delivered in their respective slices. If they are truly missing, they are **MVP gaps**, not "polish items". The framework incorrectly categorizes some of these as Phase 2 polish when they are committed MVP scope.

4. **Framework proposes `Alert.alert` → Toast migration** — This is a pure UX improvement not mentioned in spec. Spec only says "frontend displays human-readable errors" (P.3). The Toast pattern is a valid improvement but should be classified as HYPOTHESIS_TO_VERIFY (i.e., is Alert.alert actually the current pattern?) and as polish, not gap-fill.

5. **Home page AI summary fetch** — Framework describes fetching AI reports per-recipient on the home page. Spec G.2.3 says home should show "most recent BP/BG readings with abnormal red dot indicator" — it does NOT mention AI summary on the home card. The AI summary on home cards may be an implementation choice beyond spec.

6. **Service request status colors** — Framework documents specific hex values. Spec G.2.9 lists colors as "(gray) → (blue) → (indigo) → (cyan) → (green) → (dark green) → (orange) → (green) → (red)" but does not specify exact hex values. The current implementation colors are valid as long as they match the described hue families.

### Where It Makes Assumptions Needing Verification

- All claims about "current code uses X" (e.g., specific hex values, specific component patterns, specific line counts) are based on code reading but need re-verification before acting on them.
- Claims about what is "missing" vs. what is "implemented but incomplete" need code verification.
- The assumption that emoji icons are used for notifications needs code verification.
- The assumption that `Alert.alert` is used for success feedback needs code verification per page.

---

## PART 2 — Assumption Cleanup Table

| # | Item | Framework Statement | Status | Source Section | Corrected Interpretation | Action Needed |
|---|------|-------------------|--------|---------------|-------------------------|---------------|
| 1 | Trends line chart | "NO CHART — spec requires line chart... Currently only shows stats + table" | CONFIRMED_BY_SPEC | Spec G.2.5-G.2.6, Demo Step 5, Plan Slice 3 | Spec requires line chart. Plan Slice 3 says "Mobile 趨勢圖與空狀態完整". If chart is truly absent, this is an **MVP gap**, not polish. | VERIFY implementation. If absent, classify as P0 MVP gap, not UX polish. |
| 2 | Profile/Settings page | "No independent Profile page, logout button is on home header" | CONFIRMED_BY_SPEC | Spec G.2.11, Plan Slice 1 (`GET/PUT /auth/me`) | Spec explicitly defines profile page with name/email/phone/timezone + edit + reminder settings + logout. If absent, this is an **MVP gap**. | VERIFY implementation. If absent, classify as P0 MVP gap. |
| 3 | Admin recipients measurement data | "Missing measurement data — spec requires latest BP, BG, and abnormal" | CONFIRMED_BY_SPEC | Spec H.2.5 | Spec requires: name, caregiver, disease tags, latest BP, latest BG, latest abnormal, click-to-expand. If missing, this is an **MVP gap**. | VERIFY implementation. If absent, classify as P0-P1 MVP gap. |
| 4 | Admin provider "Add New" form | "No new provider creation form" | CONFIRMED_BY_SPEC | Spec H.2.4, Plan Slice 9 | Spec explicitly includes "+ Add" button + `/providers/new/page.tsx`. Plan Slice 9 includes providers CRUD. If absent, **MVP gap**. | VERIFY implementation. If absent, classify as P1 MVP gap. |
| 5 | Admin multi-filter on service requests | "Only one filter (status dropdown)" | CONFIRMED_BY_SPEC | Spec H.2.3 | Spec requires: status dropdown + service category + candidate/assigned provider + keyword search. If only one filter exists, **MVP gap**. | VERIFY implementation. If partially implemented, classify gap items. |
| 6 | Admin provider multi-filter | "Only one filter (review status)" | CONFIRMED_BY_SPEC | Spec H.2.4 | Spec requires: approval status + level + availability status. | VERIFY implementation. |
| 7 | Service request status timeline | "No status timeline" | CONFIRMED_BY_SPEC | Spec G.2.9 | Spec explicitly requires "status timeline showing conversion timestamps". If absent, **MVP gap**. | VERIFY implementation. |
| 8 | Admin service categories CRUD | "No add/edit capability (only toggle)" | CONFIRMED_BY_SPEC | Spec H.2.6 | Spec requires: new / edit / disable toggle. If add/edit is missing, **MVP gap**. | VERIFY implementation. |
| 9 | Patient summary 7-day trend chart | "No trend chart on patient summary" | CONFIRMED_BY_SPEC | Spec G.2.4 | Spec explicitly requires "近 7 天簡化趨勢圖（唯讀）". | VERIFY implementation. |
| 10 | Patient summary service request status | Not explicitly checked in framework | CONFIRMED_BY_SPEC | Spec G.2.4 | Spec requires "most recent service request status (if any)". | VERIFY implementation. |
| 11 | Patient schedule shows appointments | Framework says "shows raw notifications, not structured schedule data" | CONFIRMED_BY_SPEC | Spec G.2.8 | Spec requires: reminder list + 30-day appointments (read-only) + service progress summary card. | VERIFY if implementation shows appointments or only notifications. |
| 12 | Provider task status filter | "No status filter" | CONFIRMED_BY_SPEC | Spec G.2.14 | Spec explicitly includes "Status filter: arranged / in_service / completed". | VERIFY implementation. |
| 13 | Home page shows AI summary | Framework describes AI summary on home cards | HYPOTHESIS_TO_VERIFY | Spec G.2.3 | Spec says home shows "most recent BP/BG readings with abnormal red dot" — does NOT mention AI summary on home card. AI on home may be bonus implementation. | VERIFY: Is this a spec-defined feature or an implementation addition? If addition, it's fine to keep but not required. |
| 14 | Alert.alert used for success | "Replace all Alert.alert success messages with toast" | HYPOTHESIS_TO_VERIFY | Not in spec | Spec says "frontend displays human-readable errors" but does not prescribe the mechanism (Toast vs Alert). | VERIFY actual usage per page. Toast is a UX improvement, not a spec requirement. |
| 15 | Emoji used for notification icons | "Uses Unicode emoji (⏰⚠️📅📦📊)" | HYPOTHESIS_TO_VERIFY | Not in spec | Spec does not prescribe icon type. Emoji vs vector icons is a UX polish choice. | VERIFY actual implementation. Classify as polish, not gap. |
| 16 | Tab route separation | "All roles share (tabs) route group" | HYPOTHESIS_TO_VERIFY | Eng standards G.2.1 references separate tab groups | Engineering standards recommend physical separation but this may be aspirational vs. required. | VERIFY current implementation. Classify as architectural polish, low priority. |
| 17 | Document upload for providers | "Not implemented" | CONFIRMED_BY_PLAN | Plan Slice 9: "文件上傳（presign / confirm / list / download）" but also "Slice 9 document upload fine details can defer" | Plan marks document upload as deferrable if time is short. Partial implementation is acceptable for MVP. | VERIFY implementation level. If basic upload works, defer fine details. |
| 18 | Notification click-to-navigate | "Card tap marks as read but doesn't navigate to related content" | CONFIRMED_BY_SPEC | Spec G.2.10 | Spec says "click notification → mark read + navigate to relevant page". If navigation is missing, **MVP gap**. | VERIFY implementation. |
| 19 | Dashboard recent items clickable | "Recent request items aren't clickable links" | CONFIRMED_BY_SPEC | Spec H.2.2 says "quick links" for latest 5 pending requests | Spec calls them "quick links" implying clickable. If not clickable, **partial MVP gap**. | VERIFY implementation. |
| 20 | Provider profile capabilities | Framework says "No ability to edit specialties or service areas" | HYPOTHESIS_TO_VERIFY | Spec G.2.14 mentions provider self-service; Plan Slice 9: `GET/PUT /provider/me` | Provider self-update schema (`ProviderSelfUpdateSchema`) allows phone, specialties, certifications, experience_years, service_areas, availability_status. UI may not expose all of these. | VERIFY what fields are editable in current UI vs. what the API supports. |

---

## PART 3 — Standardize-First Backlog

### A. Theme / Tokens

| ID | Title | Why It Matters | Role/Page Impact | Source Alignment | Scope | Priority | Complexity | Dependencies | Done Definition |
|----|-------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------------|
| STD-A01 | Create `apps/mobile/lib/theme.ts` with unified design tokens | Eliminates 5+ background grays, 3+ button blues, 10+ font sizes scattered across 25+ files. Single source of truth. | All mobile pages | Spec P.3: "loading states, empty states" implies consistent patterns. Plan: "validation, error handling, loading/empty/error states". | UI_ONLY | P0 | M | None | File exists, exports color/typography/spacing/radius/shadow tokens. All values from framework Section 3. |
| STD-A02 | Create `apps/web/lib/theme.ts` with Tailwind class mappings | Ensures admin pages reference consistent class names for colors, typography, spacing. | All admin pages | Same as above | UI_ONLY | P0 | S | None | File exists, exports Tailwind class constant objects. |

### B. Shared Constants

| ID | Title | Why It Matters | Role/Page Impact | Source Alignment | Scope | Priority | Complexity | Dependencies | Done Definition |
|----|-------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------------|
| STD-B01 | Extract unified status display config to `packages/shared/src/constants/status-display.ts` | Service request status labels + colors are duplicated in mobile `services/index.tsx` and admin `service-requests/page.tsx` with slight differences. Single source eliminates drift. | All pages showing service request status (6+ pages) | Spec G.2.9 defines status colors. Both platforms must match. | UI_PLUS_MINOR_SHARED_LOGIC | P0 | S | None | File exists in shared package. Exports `SERVICE_REQUEST_STATUS_DISPLAY`, `AI_STATUS_DISPLAY`, `PROVIDER_REVIEW_STATUS_DISPLAY`. Both mobile and admin import from it. |
| STD-B02 | Extract time slot labels to shared constants | `morning/afternoon/evening` label mapping duplicated across new-request, request detail, provider tasks. | Service-related pages | Plan Slice 7-8 scope | UI_PLUS_MINOR_SHARED_LOGIC | P1 | S | None | Shared constant exported, all pages import from it. |

### C. Shared Components (Mobile)

| ID | Title | Why It Matters | Role/Page Impact | Source Alignment | Scope | Priority | Complexity | Dependencies | Done Definition |
|----|-------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------------|
| STD-C01 | Build `StatusPill` component | Used on 6+ pages. Currently re-implemented per page with varying styles. Highest cross-product consistency impact. | Service list/detail, provider tasks, AI report, admin tables | Spec defines status colors per G.2.9 | UI_ONLY | P0 | S | STD-B01 | Component renders pill with text + bg color from shared status config. Supports service request, AI health, and provider review status types. |
| STD-C02 | Build `Card` component | Currently some cards use shadow-only, some border-only, some both. Spec P.3 implies consistent UI. | Every page with cards | Spec P.3 consistency | UI_ONLY | P0 | S | STD-A01 | Component wraps content with consistent bg, border, radius, shadow, padding from theme. Variants: default, interactive (press feedback), selected. |
| STD-C03 | Build `EmptyState` component | Spec P.3 explicitly requires "All list pages have empty state". Currently inconsistent — some show plain text, some have guidance. | Every list/table page | CONFIRMED_BY_SPEC: P.3 | UI_ONLY | P0 | S | STD-A01 | Component renders icon (optional) + title + description + action button (optional). Used by all FlatLists and tables. |
| STD-C04 | Build `Toast` component | Replaces blocking `Alert.alert` for success feedback. Non-blocking, auto-dismiss. Better UX per P11 principle. | All form submission pages (8+) | HYPOTHESIS_TO_VERIFY: current Alert.alert usage | UI_ONLY | P0 | M | STD-A01 | Component shows bottom-positioned toast with icon + message. Auto-dismiss after 2.5s. Variants: success (green), info (blue), warning (yellow). Accessible. |
| STD-C05 | Build `ErrorState` component | Spec P.3 requires error handling. Currently 3+ different error display patterns. | Every data-fetching page | CONFIRMED_BY_SPEC: P.3 | UI_ONLY | P0 | S | STD-A01 | Component renders error message + retry button. Inline style (not full-screen). |
| STD-C06 | Build `LoadingState` / skeleton component | Spec P.3 requires "All async operations have loading indicator". Only home currently has skeleton. | Every data-fetching page | CONFIRMED_BY_SPEC: P.3 | UI_ONLY | P1 | M | STD-A01 | Component renders skeleton cards matching approximate shape of real content. ActivityIndicator variant for detail pages. |
| STD-C07 | Build `Chip` component | Recipient selector, type toggle, time slot picker all use chips but styled differently per page. | Health, AI, services, export pages | Spec implies consistent UI | UI_ONLY | P1 | S | STD-A01 | Component supports selection (single/multi) and display modes. Active/inactive styles from theme. |
| STD-C08 | Build `InfoRow` component | Label-value pair display reimplemented in 5+ detail pages with varying styles. | Recipient detail, service request detail, provider task detail, provider profile | Spec detail pages | UI_ONLY | P1 | S | STD-A01 | Component renders label (left) + value (right) with optional bottom border. Styles from theme. |
| STD-C09 | Build `SectionHeader` component | Section titles within pages use different sizes and styles. | Detail pages, long-form pages | UI consistency | UI_ONLY | P1 | S | STD-A01 | Component renders heading text with consistent size, color, margin from theme. |
| STD-C10 | Build `ConfirmDialog` component | Destructive actions need explicit confirmation per P4 principle. Currently uses `Alert.alert` with inconsistent button labels. | Cancel request, logout, reject candidate, status transitions | Spec: "illegal transitions rejected" (P.1 Module 7) | UI_ONLY | P1 | M | STD-A01 | Modal with title + description + cancel button + confirm button. Confirm label describes action (not generic "確定"). |
| STD-C11 | Build `ButtonPrimary` / `ButtonSecondary` / `ButtonDanger` components | 3+ button color variations across pages. | All pages with actions | UI consistency | UI_ONLY | P1 | S | STD-A01 | Three button components with loading state (spinner + text), disabled state, consistent padding/radius/color from theme. |
| STD-C12 | Build `PageHeader` component | Page titles use different sizes and positioning across pages. Some have back buttons, some don't. | All sub-pages | UI consistency | UI_ONLY | P2 | S | STD-A01 | Component renders title + optional back button + optional right action. |

### D. Copy / Tone Consistency

| ID | Title | Why It Matters | Role/Page Impact | Source Alignment | Scope | Priority | Complexity | Dependencies | Done Definition |
|----|-------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------------|
| STD-D01 | Audit all empty state copy for guidance tone | Spec P.3 requires empty states. Framework P10 says "empty states should teach, not just inform". Many currently say only "尚無資料". | All list pages | CONFIRMED_BY_SPEC: P.3 | UI_ONLY | P1 | S | STD-C03 | Every empty state includes: what is missing + why it matters + action to populate. |
| STD-D02 | Audit AI disclaimer consistency | Spec G.2.7 requires disclaimer "固定顯示、灰色小字、不可隱藏". Must appear on every AI output. | AI report page, share text | CONFIRMED_BY_SPEC: G.2.7 | VERIFY_ONLY | P0 | S | None | Disclaimer present on all AI outputs. Text matches spec. Not dismissible. Included in share text. |
| STD-D03 | Audit patient-facing copy for calm tone | Patient UI must avoid alarming language. "異常" → "需留意", "建議就醫" must be calm. | Patient summary, patient schedule | Spec: patient is read-only subset | UI_ONLY | P1 | S | None | All patient-facing copy reviewed. No diagnosis-like language. Calm advisory tone. |
| STD-D04 | Unify status labels across mobile and admin | Status labels like review status ("審核中"/"待審核") may differ between platforms. | Provider profile, admin providers | Spec defines statuses | UI_PLUS_MINOR_SHARED_LOGIC | P1 | S | STD-B01 | All status labels come from shared constants. Mobile and admin show identical labels for identical statuses. |

### E. Analytics / Events

| ID | Title | Why It Matters | Role/Page Impact | Source Alignment | Scope | Priority | Complexity | Dependencies | Done Definition |
|----|-------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------------|
| STD-E01 | Define event taxonomy for key user actions | Not in spec but needed for product iteration. | All pages | Not in spec — HYPOTHESIS | UI_ONLY | P2 | M | None | Event names defined. Not necessarily instrumented in this phase. |

### F. Accessibility

| ID | Title | Why It Matters | Role/Page Impact | Source Alignment | Scope | Priority | Complexity | Dependencies | Done Definition |
|----|-------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------------|
| STD-F01 | Add `accessibilityLabel` to all interactive elements (mobile) | Screen reader support. Healthcare users may have visual impairments. | All mobile pages | Not explicitly in spec — good practice | UI_ONLY | P2 | M | None | All TouchableOpacity, TextInput, Switch, button elements have accessibilityLabel. |
| STD-F02 | Add `scope="col"` to admin table headers | Screen reader table navigation support. | All admin table pages | Not explicitly in spec — good practice | UI_ONLY | P2 | S | None | All `<th>` elements have `scope="col"`. |

---

## PART 4 — Page Refinement Backlog by Priority

### CAREGIVER PAGES

| ID | Page / Flow | Why Important | User Value | Source Alignment | Must-Preserve | Likely UX Issue | Refinement Tasks | Scope | Priority | Complexity | Dependencies | Non-Goals |
|----|------------|--------------|-----------|-----------------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------|
| CG-01 | Health Trends | Demo Step 5 requires line chart. Core value proposition. | Caregiver sees visual patterns in health data. | CONFIRMED_BY_SPEC: G.2.5-G.2.6, Demo Step 5 | 7/30-day toggle, BP/BG toggle, stats (min/max/avg/abnormal), empty state | **VERIFY**: Is line chart implemented? If not, this is P0 MVP gap. Stats table may exist but chart may not. | 1. VERIFY chart implementation status. 2. If missing: implement LineChart (dual-line BP, single-line BG). 3. Add abnormal zone shading. 4. Add red dots for abnormal points. 5. Make stats compact below chart. 6. Add collapsible daily detail table. 7. Apply theme tokens. | UI_PLUS_MINOR_API_WIRING (chart library) | P0 | L | STD-A01 | Do not add chart interaction features beyond spec (no zoom, no pan). |
| CG-02 | Home Dashboard | First screen daily. Sets trust tone. | Caregiver sees all recipients' status at a glance. | CONFIRMED_BY_SPEC: G.2.3 | Recipient cards with name/age/tags/BP/BG, abnormal indicator, unread badge, FAB | Logout in header is dangerous. Possible visual density issues. | 1. Apply Card/StatusPill/Chip components. 2. Move logout to profile page (see CG-10). 3. Replace emoji bell with icon. 4. Ensure skeleton loading state. 5. Ensure proper empty state. 6. Apply theme tokens. | UI_ONLY | P0 | M | STD-A01, STD-C01, STD-C02, STD-C03 | Do not add AI summary to home cards if not in spec. |
| CG-03 | Recipient Detail | Central hub for per-recipient actions. | Caregiver sees full recipient info + takes action. | CONFIRMED_BY_SPEC: G.2.3 (detail subsection) | Basic info, quick actions (BP/BG/trends/appointments), recent measurements, reminders | Page is very long. Quick actions visually identical. Edit at bottom. | 1. Group into sections with SectionHeader. 2. Add icons to quick action buttons. 3. Move edit to header. 4. Apply Card/InfoRow/Chip components. 5. Section-level error handling (measurements fail ≠ whole page fails). | UI_ONLY | P1 | M | STD-C02, STD-C08, STD-C09 | Do not restructure data fetching. |
| CG-04 | Add Measurement | Highest frequency form. Done daily. | Fast, clear measurement recording. | CONFIRMED_BY_SPEC: G.2.5 (input spec) | BP: systolic(40-300)/diastolic(20-200)/HR(30-250 opt). BG: value(10-800)/timing. Validation. Abnormal flag. | Alert.alert blocks user on success. No range hints. No recipient name in header. | 1. Replace Alert.alert with Toast. 2. Add range hint below inputs. 3. Show recipient name in header. 4. Apply theme tokens. 5. Ensure numeric keyboard. | UI_ONLY | P1 | S | STD-A01, STD-C04 | Do not add DateTimePicker for measurement time (spec uses measured_at ISO field). |
| CG-05 | AI Report | Key differentiator. Trust-critical. | Caregiver gets easy-to-understand health summary. | CONFIRMED_BY_SPEC: G.2.7 | 4 report types, status label, disclaimer (always visible), share, fallback, rate limit. | File is 654 lines. Rate limit styled as error. Disclaimer may be too small. | 1. Decompose into ReportCard/ChatResult/HistorySection sub-components. 2. Ensure disclaimer is prominent (own container). 3. Rate limit → informational banner, not error. 4. Apply StatusPill. 5. Apply theme. | UI_ONLY | P1 | M | STD-A01, STD-C01, STD-C04 | Do not add new report types. Do not change AI behavior. |
| CG-06 | Service Request Detail | Status tracking + action center. | Caregiver knows request status and can confirm/reject. | CONFIRMED_BY_SPEC: G.2.9 | Status display, status timeline, candidate confirm/reject (when `candidate_proposed`), assigned provider info, operations notes | **VERIFY**: Status timeline may be missing (spec requires it). Confirm/reject flow needs verification. | 1. VERIFY timeline implementation. If missing, implement. 2. Apply StatusPill. 3. Apply InfoRow. 4. Apply ConfirmDialog for confirm/reject/cancel. 5. Apply theme. | UI_ONLY or UI_PLUS_MINOR_API_WIRING | P1 | M | STD-B01, STD-C01, STD-C08, STD-C10 | Do not add status transition controls (caregiver cannot change status directly). |
| CG-07 | Service Request List | Track all requests. | Caregiver sees all requests at a glance. | CONFIRMED_BY_SPEC: G.2.9 | Status-colored cards, category, recipient, date, FAB | No status filter. No action-needed highlighting. | 1. Add horizontal status filter chips. 2. Highlight cards where action needed. 3. Apply Card/StatusPill. 4. Ensure bottom padding for FAB. | UI_ONLY | P1 | S | STD-C01, STD-C02, STD-C07 | Do not add search (not in mobile spec). |
| CG-08 | New Service Request | Core business flow entry. | Caregiver submits care service request. | CONFIRMED_BY_SPEC: G.2.10 (service request section) | Recipient selector, 8 categories, date, time slot, location, description (10-1000 chars), confirmation modal | Alert.alert for success. No confirmation step before submit. | 1. Replace Alert.alert with Toast. 2. Add ConfirmDialog before submit. 3. Apply Chip/Card components. 4. Inline validation. | UI_ONLY | P1 | S | STD-C04, STD-C07, STD-C10 | Do not change required fields. |
| CG-09 | Notifications | Trust signal — alerts working. | Caregiver sees important notifications. | CONFIRMED_BY_SPEC: G.2.10 | Icon by type, title, preview, timestamp, read/unread, mark all read, **click → navigate to relevant page** | **VERIFY**: Click-to-navigate may be missing (spec requires it). Emoji icons. | 1. VERIFY click-to-navigate implementation. 2. Replace emoji with vector icons. 3. Apply Card component. 4. Apply theme. | UI_ONLY or UI_PLUS_MINOR_API_WIRING | P1 | M | STD-C02 | Do not add notification filters (not in spec). |
| CG-10 | Profile / Settings | Spec-defined page. Logout should move here. | Caregiver manages personal info and reminders. | CONFIRMED_BY_SPEC: G.2.11 | Name, email, phone, timezone display. Edit personal data. Reminder settings (enable/disable, time). Logout. | **VERIFY**: Page may not exist in navigation. Spec explicitly defines it. | 1. VERIFY if page exists. 2. If missing, implement per spec. 3. Wire into navigation (gear icon in header or profile tab). 4. Move logout here from home header. | UI_PLUS_MINOR_API_WIRING | P0 | M | STD-A01, STD-C08 | Do not add password change (not in spec). |
| CG-11 | Appointments | Schedule management. | Caregiver manages medical appointments. | CONFIRMED_BY_SPEC: G.2.8 (caregiver subsection) | Recipient selector, 30-day future list, add/edit, timeline order | Different background color. Add button may cover last item. | 1. Unify background to `bg-screen`. 2. Apply Card component. 3. Ensure bottom padding. 4. Split into upcoming/past sections. | UI_ONLY | P2 | S | STD-A01, STD-C02 | Do not add calendar picker (Phase 2). |
| CG-12 | Export | Data sharing utility. | Caregiver exports health records to share with doctor. | CONFIRMED_BY_SPEC: G.2.5 (export subsection) | Recipient selector, type, date range, text preview, copy/share | Minor styling inconsistencies. | 1. Apply Chip/Card components. 2. Apply theme. | UI_ONLY | P2 | S | STD-A01, STD-C07 | Do not add PDF export. |

### PATIENT PAGES

| ID | Page / Flow | Why Important | User Value | Source Alignment | Must-Preserve | Likely UX Issue | Refinement Tasks | Scope | Priority | Complexity | Dependencies | Non-Goals |
|----|------------|--------------|-----------|-----------------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------|
| PT-01 | Patient Summary | Only main screen for this role. | Patient sees own health status simply. | CONFIRMED_BY_SPEC: G.2.4 | Today's summary (latest BP/BG, abnormal alert, next reminder). **7-day simplified trend chart (read-only)**. Latest service request status. **No write controls.** | **VERIFY**: 7-day trend chart may be missing. Service request status may be missing. Values shown without context. Language may be alarming ("異常"). | 1. VERIFY 7-day trend chart. If missing, implement simplified chart. 2. VERIFY service request status section. If missing, implement. 3. Add contextual labels to readings ("血壓正常" / "血壓偏高，請留意"). 4. Soften language ("異常筆數" → "需留意的紀錄"). 5. Unify colors with design system. 6. Increase text sizes for readability. | UI_PLUS_MINOR_API_WIRING | P1 | M | STD-A01, CG-01 (chart component reuse) | Do not add any interactive controls. Do not add measurement input. |
| PT-02 | Patient Schedule | Reminders + appointments. | Patient sees what's coming up. | CONFIRMED_BY_SPEC: G.2.8 | Reminder list. **30-day appointments (read-only)**. **Service progress summary card**. | **VERIFY**: May only show notifications, not structured appointments + service status. Spec requires three distinct sections. | 1. VERIFY implementation against spec. 2. If only notifications shown, add appointment cards + service status card. 3. Group by "今天" / "即將到來". 4. Apply theme. | UI_PLUS_MINOR_API_WIRING | P1 | M | STD-A01, STD-C02 | Do not add any write controls. |

### PROVIDER PAGES

| ID | Page / Flow | Why Important | User Value | Source Alignment | Must-Preserve | Likely UX Issue | Refinement Tasks | Scope | Priority | Complexity | Dependencies | Non-Goals |
|----|------------|--------------|-----------|-----------------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------|
| PV-01 | Provider Task List | Core workflow entry. | Provider sees all assigned tasks. | CONFIRMED_BY_SPEC: G.2.14 | **Status filter: arranged / in_service / completed**. Task cards with category/recipient/date/location/status. Pending count. | **VERIFY**: Status filter may be missing (spec requires it). No urgency indicators. | 1. VERIFY status filter implementation. If missing, add. 2. Add urgency indicator for approaching dates (≤3 days). 3. Apply Card/StatusPill. 4. Apply theme. | UI_ONLY | P1 | S | STD-B01, STD-C01, STD-C02 | Do not add notification badge on tab (not in spec). |
| PV-02 | Provider Task Detail | Task execution + progress reporting. | Provider starts/completes service, adds notes. | CONFIRMED_BY_SPEC: G.2.14 | Status update buttons (start/complete). Notes input. Post-submission confirmation. | Alert.alert for success. Action buttons may require scrolling. | 1. Replace Alert.alert with Toast. 2. Apply Card/InfoRow. 3. Add timestamp to completed state. 4. Apply theme. | UI_ONLY | P1 | S | STD-C04, STD-C08, STD-C10 | Do not add structured task checklists (not in spec). |
| PV-03 | Provider Confirm Case | Accept/reject case assignment. | Provider confirms or declines a task. | CONFIRMED_BY_SPEC: G.2.14, Plan Slice 8 | Case info (read-only). Note input. Confirm/reject buttons. | Styling may differ from task detail. | 1. Apply Card/InfoRow. 2. Apply ConfirmDialog. 3. Apply theme. | UI_ONLY | P2 | S | STD-C08, STD-C10 | N/A |
| PV-04 | Provider Profile | Self-service info + availability. | Provider updates availability and views profile. | CONFIRMED_BY_SPEC: G.2.14, Plan Slice 9 (`GET/PUT /provider/me`) | View profile info. Update availability (available/busy/offline). **VERIFY**: Spec/API may support editing specialties/service_areas/phone but UI may not expose all fields. | No loading indicator on availability change. Review status labels may differ from admin. | 1. Add toast on availability update. 2. Unify status labels via shared constants. 3. Apply InfoRow/Card. 4. VERIFY which fields are editable vs. display-only. | UI_ONLY | P2 | S | STD-B01, STD-C04, STD-C08 | Do not add document upload UI (deferrable per plan). |

### ADMIN PAGES

| ID | Page / Flow | Why Important | User Value | Source Alignment | Must-Preserve | Likely UX Issue | Refinement Tasks | Scope | Priority | Complexity | Dependencies | Non-Goals |
|----|------------|--------------|-----------|-----------------|---------------|-----------------|-----------------|-------|----------|-----------|--------------|-----------|
| AD-01 | Dashboard | Operations overview. Demo Step 10. | Admin sees platform health at a glance. | CONFIRMED_BY_SPEC: H.2.2 | 6 KPI cards. Latest 5 pending requests (**quick links**). Latest 5 abnormal notifications. | KPI cards lack icons. **VERIFY**: Recent items may not be clickable (spec says "quick links"). | 1. Add icons to KPI cards. 2. VERIFY clickable links. If not, make clickable. 3. Highlight action-required KPIs when count > 0. 4. Apply theme. | UI_ONLY | P1 | S | STD-A02 | Do not add auto-refresh. |
| AD-02 | Service Request List | Primary work queue. | Admin triages and manages requests. | CONFIRMED_BY_SPEC: H.2.3 | Table with ID/caregiver/recipient/category/date/status/assigned/created. **Filters: status + category + provider + search**. Pagination. | **VERIFY**: May only have single status filter. Spec requires 4 filter dimensions. | 1. VERIFY current filter count. 2. If only single filter, add: category dropdown, provider dropdown, search input. 3. Unify status colors via shared constants. 4. Apply theme. | UI_PLUS_MINOR_API_WIRING | P1 | M | STD-B01, STD-A02 | Do not add bulk actions. |
| AD-03 | Service Request Detail | Core operations page. Demo Step 10. | Admin reviews, proposes candidates, advances status. | CONFIRMED_BY_SPEC: H.2.3 | Complete info. Status update (next legal states). Propose candidate (approved + available providers). Dual confirmation tracking. Operations notes. Operation history. | **VERIFY**: Status timeline, operation history may be missing. Action buttons may be ungrouped. Provider dropdown may lack context. | 1. VERIFY timeline/history implementation. 2. Group action buttons by intent. 3. Add specialty/level info to provider dropdown options. 4. Add breadcrumb navigation. 5. Apply theme. | UI_ONLY or UI_PLUS_MINOR_API_WIRING | P1 | M | STD-B01, STD-A02 | Do not change state machine logic. |
| AD-04 | Provider Management (List + Detail) | Provider lifecycle management. | Admin reviews/approves providers. | CONFIRMED_BY_SPEC: H.2.4, Plan Slice 9 | CRUD. **Filters: approval status + level + availability**. Level (L1/L2/L3). Document upload. Approve/suspend. **"+ Add" button + new/edit form**. | **VERIFY**: Add/edit form may not exist. Multi-filter may not exist. | 1. VERIFY add/edit form existence. If missing, implement. 2. VERIFY filter count. If only one, add remaining. 3. Apply theme. | UI_PLUS_MINOR_API_WIRING | P1 | M | STD-A02 | Do not implement document upload if deferred per plan. |
| AD-05 | Recipients Overview | Care recipient visibility. | Admin sees all recipients with health data. | CONFIRMED_BY_SPEC: H.2.5 | **Read-only**. Name, **caregiver**, disease tags, **latest BP, latest BG, latest abnormal**. Search. Pagination. **Click → expand detailed measurements (modal/drawer)**. | **VERIFY**: May only show basic info without measurements. May lack caregiver column. May lack search. May lack click-to-expand. | 1. VERIFY columns present. 2. If missing measurement columns, add (requires admin recipients API to return measurement data). 3. Add search. 4. Add click-to-expand. | UI_PLUS_MINOR_API_WIRING | P1 | M | STD-A02 | Admin CANNOT edit recipient data. Read-only only. |
| AD-06 | Service Categories | Category management. | Admin manages service offerings. | CONFIRMED_BY_SPEC: H.2.6 | **CRUD**: new / edit / disable toggle. Name, description, sort order, enabled. | **VERIFY**: May only have toggle, missing add/edit. | 1. VERIFY add/edit capability. If missing, implement add/edit form (modal or inline). 2. Apply theme. | UI_PLUS_MINOR_API_WIRING | P2 | M | STD-A02 | Do not add category reordering drag-drop. |
| AD-07 | Admin Login | Entry point. | Admin accesses backend. | CONFIRMED_BY_SPEC: H.2.1 | Email + password. Error display. JWT cookie. | Minor: subtitle, error positioning. | 1. Apply theme. 2. Minor copy polish. | UI_ONLY | P2 | S | STD-A02 | N/A |
| AD-08 | Admin Sidebar / Layout | Navigation shell. | Admin navigates between sections. | CONFIRMED_BY_SPEC: H.2.1 | 5 nav items + logout. Active state. Sidebar always visible. | No responsive behavior for small screens. No icons. | 1. Add icons to nav items. 2. Consider responsive collapse (Phase 2 if not urgent). | UI_ONLY | P2 | S | STD-A02 | Do not add breadcrumbs in this item (covered per-page). |

---

## PART 5 — Sprintable Execution Plan

### Sprint A — Foundation Standardization

**Goal**: Create the shared infrastructure that all subsequent page polish depends on.

**Included Backlog IDs**: STD-A01, STD-A02, STD-B01, STD-C01, STD-C02, STD-C03, STD-C04, STD-C05, STD-D02

**Expected files/modules affected**:
- `apps/mobile/lib/theme.ts` (new)
- `apps/web/lib/theme.ts` (new)
- `packages/shared/src/constants/status-display.ts` (new)
- `packages/shared/src/index.ts` (add export)
- `apps/mobile/components/ui/StatusPill.tsx` (new)
- `apps/mobile/components/ui/Card.tsx` (new)
- `apps/mobile/components/ui/EmptyState.tsx` (new)
- `apps/mobile/components/ui/Toast.tsx` (new)
- `apps/mobile/components/ui/ErrorState.tsx` (new)

**Backend/schema changes**: None. Only shared constants extraction (no API changes).

**Verification**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass. Components render correctly in isolation.

**Demo outcome**: No visible product changes yet, but foundation is in place.

---

### Sprint B — Caregiver High-Frequency Flow Polish + MVP Gap Fill

**Goal**: Fix the highest-impact caregiver flows. Fill any confirmed MVP gaps (trends chart, profile page, status timeline).

**Included Backlog IDs**: CG-01, CG-02, CG-04, CG-10, CG-06

**Pre-sprint**: Run verification checks on CG-01 (chart), CG-10 (profile), CG-06 (timeline) to classify as gap-fill or polish.

**Expected files/modules affected**:
- `apps/mobile/app/(tabs)/health/trends.tsx` (major: add chart)
- `apps/mobile/app/(tabs)/home/index.tsx` (refactor: apply components, move logout)
- `apps/mobile/app/(tabs)/health/add-measurement.tsx` (minor: Toast, hints)
- `apps/mobile/app/(tabs)/services/[requestId].tsx` (medium: timeline, ConfirmDialog)
- `apps/mobile/app/profile/` or equivalent (new or wired: profile page)
- `apps/mobile/app/(tabs)/_layout.tsx` (minor: add profile entry point)
- `apps/mobile/package.json` (possible: add chart library)

**Backend/schema changes**: Likely none. Chart data comes from existing `/measurements/stats` API. Profile uses existing `/auth/me`. Timeline may need `updated_at` from existing API response — VERIFY.

**Verification**: Demo Steps 4-5 (measurement + trends with chart). Profile page accessible. Service request detail shows timeline.

**Demo outcome**: Caregiver can see trend charts, has a profile page, sees status timelines.

---

### Sprint C — Admin Operational Flow Polish + MVP Gap Fill

**Goal**: Bring admin pages up to spec — multi-filters, clickable dashboard links, recipient measurements, provider add form.

**Included Backlog IDs**: AD-01, AD-02, AD-03, AD-04, AD-05

**Pre-sprint**: Run verification checks on AD-02 (filters), AD-04 (add form), AD-05 (measurement columns) to classify as gap-fill or polish.

**Expected files/modules affected**:
- `apps/web/app/admin/dashboard/page.tsx` (medium: icons, clickable links)
- `apps/web/app/admin/service-requests/page.tsx` (medium: multi-filter)
- `apps/web/app/admin/service-requests/[id]/page.tsx` (medium: timeline, action grouping)
- `apps/web/app/admin/providers/page.tsx` (medium: multi-filter)
- `apps/web/app/admin/providers/[id]/page.tsx` (minor: polish)
- `apps/web/app/admin/providers/new/page.tsx` (new if missing)
- `apps/web/app/admin/recipients/page.tsx` (medium: add columns, search, expand)

**Backend/schema changes**: AD-05 (recipients with measurements) may require the admin recipients API to return measurement data. VERIFY current API response shape. If API already returns measurements, this is UI_ONLY. If not, minor API enhancement needed.

**Verification**: Demo Step 10 (admin dashboard + request management). All admin tables have proper filters per spec.

**Demo outcome**: Admin dashboard is spec-compliant with filters, clickable links, and measurement visibility.

---

### Sprint D — Patient Simplification + Trust Pass

**Goal**: Ensure patient pages match spec (7-day trend, appointments, service status) and use calm, accessible language.

**Included Backlog IDs**: PT-01, PT-02, STD-D03

**Pre-sprint**: Verify PT-01 (7-day chart, service status) and PT-02 (appointments section, service summary card) implementation status.

**Expected files/modules affected**:
- `apps/mobile/app/(tabs)/patient/summary.tsx` (medium: add chart, add service status, soften copy)
- `apps/mobile/app/(tabs)/patient/schedule.tsx` (medium: add appointment cards, add service summary, group by time)

**Backend/schema changes**: Likely none. Data available from existing APIs.

**Verification**: Patient login → sees 7-day trend + latest readings with context + upcoming appointments + service status. All read-only.

**Demo outcome**: Patient experience is spec-compliant, calm, and accessible.

---

### Sprint E — Provider Workspace Polish

**Goal**: Polish provider task management flow. Ensure status filter exists per spec.

**Included Backlog IDs**: PV-01, PV-02, PV-03, PV-04, STD-D04

**Expected files/modules affected**:
- `apps/mobile/app/(tabs)/services/provider-tasks.tsx` (medium: add filter, urgency)
- `apps/mobile/app/(tabs)/services/provider-task-detail.tsx` (minor: Toast, timestamps)
- `apps/mobile/app/(tabs)/services/provider-confirm.tsx` (minor: ConfirmDialog, theme)
- `apps/mobile/app/(tabs)/services/provider-profile.tsx` (minor: Toast, unified labels)

**Backend/schema changes**: None.

**Verification**: Provider login → sees filtered task list → starts/completes service with toast feedback → profile shows unified labels.

**Demo outcome**: Provider workflow is smooth, spec-compliant, and consistent.

---

### Sprint F — Final Consistency / QA / Accessibility Pass

**Goal**: Apply remaining shared components to all pages. Complete remaining backlog items.

**Included Backlog IDs**: CG-03, CG-05, CG-07, CG-08, CG-09, CG-11, CG-12, AD-06, AD-07, AD-08, STD-C06 through STD-C12, STD-D01, STD-B02, STD-F01, STD-F02

**Expected files/modules affected**: All remaining mobile and admin pages.

**Backend/schema changes**: None expected.

**Verification**: Full 12-step demo script passes. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green. All pages have consistent loading/empty/error states.

**Demo outcome**: Product feels cohesive, consistent, and polished across all four roles.

---

## PART 6 — File / Module Impact Guess

| Backlog ID(s) | Likely Files Affected | Confidence |
|--------------|----------------------|------------|
| STD-A01 | `apps/mobile/lib/theme.ts` (new) | High — framework defines this |
| STD-A02 | `apps/web/lib/theme.ts` (new) | High |
| STD-B01 | `packages/shared/src/constants/status-display.ts` (new), `packages/shared/src/index.ts` | High |
| STD-C01-C05 | `apps/mobile/components/ui/*.tsx` (new dir) | High — standard pattern |
| CG-01 | `apps/mobile/app/(tabs)/health/trends.tsx`, possibly `apps/mobile/package.json` (chart lib) | High |
| CG-02 | `apps/mobile/app/(tabs)/home/index.tsx` | High |
| CG-04 | `apps/mobile/app/(tabs)/health/add-measurement.tsx` | High |
| CG-05 | `apps/mobile/app/(tabs)/ai/index.tsx` → split into `components/ai/ReportCard.tsx`, `ChatResult.tsx`, `HistorySection.tsx` | Medium — depends on decomposition approach |
| CG-06 | `apps/mobile/app/(tabs)/services/[requestId].tsx` | High |
| CG-10 | `apps/mobile/app/(tabs)/home/profile.tsx` or `apps/mobile/app/profile/index.tsx` (new or verify), `apps/mobile/app/(tabs)/_layout.tsx` | Medium — path depends on existing implementation |
| AD-01 | `apps/web/app/admin/dashboard/page.tsx` | High |
| AD-02 | `apps/web/app/admin/service-requests/page.tsx` | High |
| AD-03 | `apps/web/app/admin/service-requests/[id]/page.tsx` | High |
| AD-04 | `apps/web/app/admin/providers/page.tsx`, possibly `apps/web/app/admin/providers/new/page.tsx` (new) | Medium |
| AD-05 | `apps/web/app/admin/recipients/page.tsx`, possibly `apps/web/app/api/v1/admin/recipients/route.ts` | Medium — may need API check |
| PT-01 | `apps/mobile/app/(tabs)/patient/summary.tsx` | High |
| PT-02 | `apps/mobile/app/(tabs)/patient/schedule.tsx` | High |
| PV-01 | `apps/mobile/app/(tabs)/services/provider-tasks.tsx` | High |

---

## PART 7 — Acceptance Checklists

### STD-A01: Mobile Theme Tokens
- [ ] File `apps/mobile/lib/theme.ts` exists
- [ ] Exports `colors`, `typography`, `spacing`, `radius`, `shadows` objects
- [ ] All values match framework Section 3 definitions
- [ ] No runtime dependencies (pure constants)
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass

### STD-B01: Shared Status Display Constants
- [ ] File `packages/shared/src/constants/status-display.ts` exists
- [ ] Exports `SERVICE_REQUEST_STATUS_DISPLAY` with all 9 statuses
- [ ] Exports `AI_STATUS_DISPLAY` with 3 statuses (stable/attention/consult_doctor)
- [ ] Exports `PROVIDER_REVIEW_STATUS_DISPLAY` with 3 statuses (pending/approved/suspended)
- [ ] Each entry has `label` (Traditional Chinese) + `color` + `bg` fields
- [ ] Exported from `packages/shared/src/index.ts`
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

### STD-C01: StatusPill Component
- [ ] Component file exists at `apps/mobile/components/ui/StatusPill.tsx`
- [ ] Accepts `status` string + `type` enum (serviceRequest | aiHealth | providerReview)
- [ ] Renders pill with text + background color from STD-B01 constants
- [ ] Falls back gracefully for unknown status values
- [ ] Uses theme tokens for radius, typography
- [ ] Has `accessibilityLabel`
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass

### STD-C03: EmptyState Component
- [ ] Component file exists at `apps/mobile/components/ui/EmptyState.tsx`
- [ ] Accepts `title`, `description`, `actionLabel` (optional), `onAction` (optional)
- [ ] Renders centered layout with text hierarchy
- [ ] Action button visible only when `onAction` provided
- [ ] Uses theme tokens
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass

### STD-C04: Toast Component
- [ ] Component file exists at `apps/mobile/components/ui/Toast.tsx`
- [ ] Supports `success`, `info`, `warning` variants
- [ ] Auto-dismisses after configurable duration (default 2.5s)
- [ ] Bottom-positioned, does not block interaction
- [ ] Accessible (announced by screen reader)
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass

### STD-D02: AI Disclaimer Verification
- [ ] Disclaimer text present on AI report page
- [ ] Disclaimer visible without scrolling past report content
- [ ] Disclaimer not dismissible
- [ ] Disclaimer included in share text output
- [ ] Disclaimer text matches spec G.2.7 wording
- [ ] No diagnosis-like language in AI output display

### CG-01: Health Trends (Chart)
- [ ] Line chart renders for blood pressure (dual line: systolic + diastolic)
- [ ] Line chart renders for blood glucose (single line)
- [ ] Abnormal zone shading visible on chart background
- [ ] Abnormal data points marked with red dots
- [ ] 7-day and 30-day period toggle works
- [ ] BP/BG type toggle works
- [ ] Statistics cards (min/max/avg/abnormal) display below chart
- [ ] Empty state shown when no data
- [ ] Loading state shown during fetch
- [ ] Data comes from existing `/measurements/stats` API
- [ ] No new API endpoints introduced
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass
- [ ] Demo Step 5 scenario passable

### CG-02: Home Dashboard
- [ ] Recipient cards use shared Card component
- [ ] Abnormal indicator uses color + text (not color alone)
- [ ] Notification badge uses theme colors
- [ ] Bell icon is vector icon (not emoji)
- [ ] Logout button NOT in header (moved to profile or settings)
- [ ] Skeleton loading state (2-3 cards)
- [ ] Empty state with guidance text + action
- [ ] RBAC preserved: only caregiver's own recipients shown
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

### CG-10: Profile / Settings
- [ ] Page exists and is accessible from navigation
- [ ] Shows: name, email, phone, timezone
- [ ] Edit personal data functionality works
- [ ] Measurement reminder settings: enable/disable, time adjustment
- [ ] Logout button present and functional
- [ ] Uses existing `GET /auth/me` and `PUT /auth/me` APIs
- [ ] RBAC: user can only view/edit own profile
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

### PT-01: Patient Summary
- [ ] Shows today's summary card: latest BP, latest BG, abnormal alert, next reminder
- [ ] Shows 7-day simplified trend chart (read-only)
- [ ] Shows latest service request status (if any)
- [ ] No interactive controls (no buttons, no inputs, no toggles)
- [ ] Values have contextual labels ("血壓正常" / "血壓偏高，請留意")
- [ ] Language is non-alarming (no "異常" visible to patient)
- [ ] RBAC: patient can only see own data
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

### AD-02: Admin Service Request List (Multi-Filter)
- [ ] Status filter dropdown present
- [ ] Service category filter dropdown present
- [ ] Provider filter dropdown present (if spec requires it)
- [ ] Search input present
- [ ] Filters apply immediately on change
- [ ] Status colors match shared constants
- [ ] Table pagination works
- [ ] Row click navigates to detail
- [ ] Empty state for no results
- [ ] RBAC: admin role required
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

### AD-05: Admin Recipients Overview
- [ ] Table shows: name, caregiver, disease tags, latest BP, latest BG, latest abnormal
- [ ] Search input present
- [ ] Pagination works
- [ ] Click row → expand detailed measurement data (modal or drawer)
- [ ] Page is read-only (no edit/delete controls)
- [ ] RBAC: admin role required
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

---

## PART 8 — Risk / Verification Notes

### Must-Verify Before Execution

| # | Area | Risk | What to Check | Impact if Confirmed |
|---|------|------|--------------|-------------------|
| R1 | Trends chart | Framework says "NO CHART". Plan Slice 3 says chart should be complete. | Read `apps/mobile/app/(tabs)/health/trends.tsx` — does it import/render a chart component? | If truly absent: P0 MVP gap (not polish). If present but incomplete: P1 polish. |
| R2 | Profile page | Framework says "no profile page". Spec defines one. | Check if `profile/index.tsx` or equivalent exists. Check if it's in navigation. | If absent: P0 MVP gap. If exists but not in nav: P1 wiring fix. |
| R3 | Status timeline | Framework says "no timeline". Spec requires it. | Read service request detail pages — is there a timeline component? | If absent: P1 MVP gap. |
| R4 | Admin recipients measurement columns | Framework says "only basic info". Spec requires BP/BG/abnormal. | Read admin recipients page — what columns exist? Read admin recipients API — does it return measurement data? | If API doesn't return measurements: requires API enhancement. If API returns but UI doesn't show: UI_ONLY fix. |
| R5 | Admin provider add form | Framework says "no add form". Spec requires it. | Check if `providers/new/page.tsx` exists. | If absent: P1 MVP gap requiring new page. |
| R6 | Admin multi-filters | Framework says "single filter only". Spec requires multiple. | Read admin service-requests and providers pages — how many filter controls? | If single: MVP gap requiring filter additions. API must support filter params. |
| R7 | Admin service categories add/edit | Framework says "only toggle". Spec says CRUD. | Read services page — any add/edit UI? Read API — do POST/PUT endpoints exist? | If only toggle: P2 MVP gap. |
| R8 | Patient schedule structure | Framework says "shows raw notifications". Spec requires appointments + service status. | Read patient schedule page — does it show appointment cards and service status card? | If only notifications: P1 MVP gap. |
| R9 | Notification click-to-navigate | Framework says "doesn't navigate". Spec requires navigation on click. | Read notification list page — does card tap navigate? | If no navigation: P1 MVP gap. |
| R10 | Provider task status filter | Framework says "no filter". Spec requires it. | Read provider task list — is there a filter UI? | If absent: P1 MVP gap. |
| R11 | Dashboard clickable links | Framework says "not clickable". Spec says "quick links". | Read dashboard page — are recent items wrapped in `<Link>`? | If not clickable: P1 minor fix. |
| R12 | Alert.alert usage | Framework recommends replacing with Toast. | Grep codebase for `Alert.alert` usage to confirm scope. | Determines STD-C04 impact scope. |
| R13 | Home page AI summary | Framework describes AI reports fetched per-recipient on home. | Verify if this is in spec or implementation-only addition. | If not in spec, it's a bonus feature — no need to remove, but don't treat as spec requirement. |

### Low-Risk Items (Proceed Without Blocking Verification)

- Theme token creation (STD-A01, A02): Pure additive, no verification needed.
- Shared status constants (STD-B01): Extract from existing code, verify values match spec.
- Shared component creation (STD-C01-C12): Pure additive UI components.
- Copy/tone audit (STD-D01-D04): Can proceed page-by-page.
- Accessibility (STD-F01-F02): Additive, no risk.

---

## PART 9 — Recommended Immediate Next Sprint

### Sprint Name: **Sprint A — Foundation Standardization**

### Why This Sprint Should Go First

1. **Every subsequent sprint depends on it.** Without shared theme tokens and components, each page polish creates new ad-hoc styles that must be refactored again later. Standardize once, apply everywhere.

2. **Zero risk.** This sprint creates only new files (theme, constants, components). It modifies nothing existing. It cannot break current functionality. CI will confirm.

3. **Highest leverage per line of code.** A single `StatusPill.tsx` component will be reused on 6+ pages across all four roles. A single `status-display.ts` file eliminates color drift between mobile and admin.

4. **Unblocks accurate verification.** The shared constants file (STD-B01) also serves as the single source of truth that makes R1-R13 verification checks actionable.

### What It Unlocks Afterward

- Sprint B can immediately apply these components to caregiver pages.
- Any MVP gap discovered during Sprint B verification (chart, profile, timeline) can be filled using the standardized foundation.
- Sprint C-E can proceed in parallel if team capacity allows.

### What NOT to Touch Yet

- Do not modify any existing page files in Sprint A.
- Do not install chart libraries yet (that's Sprint B).
- Do not add new API endpoints.
- Do not change navigation structure.
- Do not touch admin pages.

### Execution Order Inside Sprint A

1. **STD-A01**: Create `apps/mobile/lib/theme.ts` — all color/typography/spacing/radius/shadow tokens.
2. **STD-A02**: Create `apps/web/lib/theme.ts` — Tailwind class mappings.
3. **STD-B01**: Create `packages/shared/src/constants/status-display.ts` — extract and unify all status label/color definitions from spec G.2.9.
4. **STD-C02**: Build `Card.tsx` — simplest component, establishes the component file pattern.
5. **STD-C01**: Build `StatusPill.tsx` — depends on STD-B01.
6. **STD-C05**: Build `ErrorState.tsx` — simple, no dependencies beyond theme.
7. **STD-C03**: Build `EmptyState.tsx` — simple, no dependencies beyond theme.
8. **STD-C04**: Build `Toast.tsx` — slightly more complex (animation, auto-dismiss).
9. **STD-D02**: Verify AI disclaimer compliance against spec G.2.7. Document findings.
10. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — confirm green.

**After Sprint A completes**: Execute R1-R13 verification checks to classify all HYPOTHESIS_TO_VERIFY items before Sprint B begins. This ensures Sprint B addresses confirmed gaps, not assumed ones.

---

*End of UX Execution Backlog v1.0*
