# REMOTE CARE PLATFORM — UX REFINEMENT FRAMEWORK v1.0

---

## PART 1 — Product Refinement Diagnosis

### Current Stage

The product is a **functionally complete MVP**. All 10 core modules are implemented end-to-end: auth, recipients, measurements, trends, AI reports, notifications, appointments, service requests, matching, and provider workspace. The 12-step demo flow is runnable. API routes exist for every domain entity. Four-role RBAC is enforced.

However, the product was built **slice-by-slice over 10 iterations**, and each slice introduced its own styling decisions in isolation. The result is a product that works correctly but feels **assembled rather than designed**. There is no shared design system, no centralized theme, and no consistent interaction vocabulary.

### What the Next Refinement Phase Should Focus On

1. **Visual consistency** — Unify the 12+ background grays, 3+ button blues, 10+ font sizes, and 4+ card styles into a single coherent system.
2. **Interaction consistency** — Standardize how loading, error, empty, success, and destructive-action states are handled across all 25+ screens.
3. **Information hierarchy** — Several pages (home, recipient detail, AI report) pack too much into a flat visual structure. Establish clear primary/secondary/tertiary content tiers.
4. **Role-appropriate density** — Patient sees the same component patterns as caregiver. Provider sees service-request cards identical to caregiver's. Admin tables lack filtering depth. Each role needs density calibrated to its mental model.
5. **Trust signals** — Health data and AI features need consistent, calm visual treatment that communicates reliability without alarm.
6. **Missing spec items** — Trend charts, profile page, admin recipient measurements, and multi-filter admin views.

### What Should NOT Be the Focus Right Now

- New features beyond current scope (payments, chat, push, marketplace)
- Architecture migration (the monorepo + expo-router + Next.js stack is fine)
- API restructuring (the API surface is stable and well-designed)
- Performance optimization (premature at this stage)
- Multi-language support (out of MVP scope)
- Animated transitions or micro-interactions (polish, not foundation)

---

## PART 2 — Product UX Principles

These 12 principles are tailored to this product's four-role healthcare context:

### P1. The user always knows whose data they are viewing
Every screen that displays health data, service requests, or notifications must show the recipient's name prominently. When a caregiver manages multiple recipients, the active context must be unambiguous — never rely on the user remembering which recipient they selected three taps ago.

### P2. Health information should be understandable in under 5 seconds
A caregiver glancing at a measurement card should immediately know: what type, what value, whether it's normal, and when it was taken. Use color + icon + text redundancy for abnormal states so no single channel (color alone) carries the meaning.

### P3. The next step should always be obvious
Every page should have a clear primary action. If the page is informational, the next navigation should be obvious. Avoid dead-end screens. Empty states should guide the user toward the action that populates them.

### P4. Risky or irreversible actions require explicit confirmation
Cancelling a service request, logging out, deleting a recipient, or changing provider availability must present a confirmation dialog with clear description of the consequence. Never auto-proceed on a destructive tap.

### P5. Patient UI must remove unnecessary decisions
The patient role is read-only by design. Patient screens should present information with zero interactive choices beyond scrolling and pull-to-refresh. No toggles, no selectors, no forms. Reduce cognitive load to "read and understand."

### P6. Provider workflows should emphasize task status and required action
Providers are task-oriented. Their UI should answer two questions instantly: "What do I need to do?" and "What is the status of my current tasks?" Minimize navigation depth. Surface the next required action on every task card.

### P7. Operational workflows should minimize context switching
Admin users triage, review, and update. Their flows should support: scan list → identify item → take action → return to list. Detail pages should have all action controls visible without scrolling past the fold. Filters should persist across navigation.

### P8. Status transitions should be visually traceable
Service requests pass through 9 states. The current status must be immediately clear (badge), and the history of transitions should be traceable (timeline). Both caregiver and admin should be able to answer "what happened and when?"

### P9. AI-generated content must be clearly marked as advisory
Every AI report must carry a visible, non-dismissible disclaimer. AI status labels (穩定/需注意/建議就醫) must never use alarming visual treatments that could be mistaken for medical diagnosis. Use calm colors and advisory language.

### P10. Empty states should teach, not just inform
"尚無資料" is insufficient. Every empty state should explain what the missing data is, why it matters, and offer a single action button to begin populating it. Example: "尚未記錄健康數據。定期量測血壓與血糖，有助於掌握長輩健康狀況。" + [開始記錄] button.

### P11. Feedback should be immediate, consistent, and non-blocking
Success: brief toast at bottom, auto-dismiss in 2s. Error: inline message near the trigger, with retry option. Loading: skeleton for first load, spinner for refresh. Never use `Alert.alert` for success feedback — it blocks the user and requires a tap to dismiss.

### P12. Visual consistency is a trust signal
In healthcare-adjacent products, inconsistent styling erodes user confidence. A button that is blue-500 on one page and blue-600 on another, or a card that has shadow on one page and border on another, creates subconscious distrust. Every pixel decision should come from a single source of truth.

---

## PART 3 — Design System Lite v1

### 3.1 Color Roles

**Current problem**: The codebase uses 5+ background grays (`#f5f5f5`, `#f8fafc`, `#F9FAFB`, `#f3f4f6`, `#f0f7ff`), 3+ primary blues (`#3b82f6`, `#2563eb`, `#1d4ed8`), and ad-hoc status colors that differ between mobile and admin.

**Proposed unified palette:**

| Role | Token Name | Mobile Value | Admin (Tailwind) | Usage |
|------|-----------|-------------|------------------|-------|
| **Background** | `bg-screen` | `#F9FAFB` | `bg-gray-50` | All screen backgrounds |
| **Surface** | `bg-surface` | `#FFFFFF` | `bg-white` | Cards, sections, modals |
| **Surface Elevated** | `bg-surface-alt` | `#F3F4F6` | `bg-gray-100` | Secondary surfaces, inactive chips |
| **Border** | `border-default` | `#E5E7EB` | `border-gray-200` | Card borders, dividers |
| **Border Strong** | `border-strong` | `#D1D5DB` | `border-gray-300` | Input borders, focus rings |
| **Primary** | `color-primary` | `#2563EB` | `text-blue-600` / `bg-blue-600` | Primary buttons, active states, links |
| **Primary Light** | `color-primary-light` | `#DBEAFE` | `bg-blue-100` | Selected chip bg, light highlights |
| **Primary Text** | `color-primary-text` | `#1D4ED8` | `text-blue-700` | Text on primary-light bg |
| **Text Primary** | `text-primary` | `#111827` | `text-gray-900` | Headings, names, important values |
| **Text Secondary** | `text-secondary` | `#374151` | `text-gray-700` | Body text, labels |
| **Text Tertiary** | `text-tertiary` | `#6B7280` | `text-gray-500` | Captions, hints, timestamps |
| **Text Disabled** | `text-disabled` | `#9CA3AF` | `text-gray-400` | Disabled text, placeholders |

### 3.2 Semantic Colors

| Semantic Role | Token | Mobile Hex | Admin Tailwind | Usage |
|--------------|-------|-----------|----------------|-------|
| **Success** | `semantic-success` | `#15803D` | `text-green-700` | Completed, confirmed, stable |
| **Success Light** | `semantic-success-light` | `#DCFCE7` | `bg-green-100` | Success badges, backgrounds |
| **Warning** | `semantic-warning` | `#A16207` | `text-yellow-700` | Screening, attention needed |
| **Warning Light** | `semantic-warning-light` | `#FEF9C3` | `bg-yellow-100` | Warning badges, backgrounds |
| **Danger** | `semantic-danger` | `#DC2626` | `text-red-600` | Errors, abnormal, cancel |
| **Danger Light** | `semantic-danger-light` | `#FEE2E2` | `bg-red-100` | Error backgrounds, danger badges |
| **Info** | `semantic-info` | `#2563EB` | `text-blue-600` | Informational badges, submitted |
| **Info Light** | `semantic-info-light` | `#DBEAFE` | `bg-blue-100` | Info backgrounds |

### 3.3 Status Color System (Unified Mobile + Admin)

| Status | Text Color | Background | Label |
|--------|-----------|------------|-------|
| `submitted` | `#1D4ED8` | `#DBEAFE` | 已送出 |
| `screening` | `#A16207` | `#FEF9C3` | 審核中 |
| `candidate_proposed` | `#7C3AED` | `#EDE9FE` | 已推薦 |
| `caregiver_confirmed` | `#4338CA` | `#E0E7FF` | 家屬確認 |
| `provider_confirmed` | `#0F766E` | `#CCFBF1` | 服務者確認 |
| `arranged` | `#0E7490` | `#CFFAFE` | 已安排 |
| `in_service` | `#C2410C` | `#FFEDD5` | 服務中 |
| `completed` | `#15803D` | `#DCFCE7` | 已完成 |
| `cancelled` | `#6B7280` | `#F3F4F6` | 已取消 |

This mapping already exists in mobile `services/index.tsx` and should be extracted to `packages/shared/src/constants/status-display.ts` and imported by both mobile and admin.

### 3.4 AI Health Status Colors

| Status | Text | Background | Label |
|--------|------|------------|-------|
| `stable` | `#166534` | `#DCFCE7` | 穩定 |
| `attention` | `#854D0E` | `#FEF9C3` | 需注意 |
| `consult_doctor` | `#991B1B` | `#FEE2E2` | 建議就醫 |

### 3.5 Typography Scale

**Current problem**: 11+ font sizes (11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28) with no semantic naming.

**Proposed scale (Mobile):**

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `heading-xl` | 24px | 700 | Page titles (login, register) |
| `heading-lg` | 20px | 700 | Section page titles |
| `heading-md` | 17px | 600 | Card titles, section headers |
| `heading-sm` | 15px | 600 | Sub-section titles |
| `body-lg` | 16px | 400 | Primary input text, large body |
| `body-md` | 14px | 400 | Default body text, list items |
| `body-sm` | 13px | 400 | Secondary descriptions |
| `caption` | 12px | 400 | Timestamps, hints, tags |
| `caption-sm` | 11px | 400 | Disclaimers, fine print |

**Proposed scale (Admin — Tailwind):**

| Token | Tailwind | Usage |
|-------|----------|-------|
| `heading-page` | `text-2xl font-bold` | Page titles |
| `heading-section` | `text-lg font-semibold` | Card/section titles |
| `heading-sub` | `text-base font-medium` | Sub-headers |
| `body` | `text-sm` | Default text |
| `caption` | `text-xs` | Badges, timestamps |

### 3.6 Spacing Scale

**Standardize to 4px base grid:**

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Inline gaps, tag padding-y |
| `space-2` | 8px | Icon gaps, chip gaps |
| `space-3` | 12px | Input padding, card inner gaps |
| `space-4` | 16px | Card padding, section gaps, screen padding |
| `space-5` | 20px | Section padding (large) |
| `space-6` | 24px | Page margins, major section gaps |
| `space-8` | 32px | Large vertical separators |

### 3.7 Radius Scale

**Current problem**: 4, 8, 10, 12, 16, 20, 28 all used.

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 8px | Inputs, small buttons, inline badges |
| `radius-md` | 12px | Cards, sections, action buttons |
| `radius-lg` | 16px | Status pills, chips |
| `radius-full` | 9999px | Circular badges, dots |

### 3.8 Elevation / Shadow

**Standardize to two levels only:**

| Token | Mobile StyleSheet | Admin Tailwind | Usage |
|-------|------------------|----------------|-------|
| `elevation-low` | `shadowOpacity: 0.06, shadowRadius: 2, elevation: 1` | `shadow-sm` | Cards, list items |
| `elevation-high` | `shadowOpacity: 0.15, shadowRadius: 6, elevation: 4` | `shadow-md` | FAB, modals, floating elements |

**Rule**: Cards should use `border + elevation-low` (not one or the other). This solves the current inconsistency where some cards use shadow-only and some use border-only.

### 3.9 Icon Usage Rules

- Mobile: Use a single icon library. Currently uses emoji (⏰⚠️📅📦📊). Replace with `@expo/vector-icons` (Ionicons or MaterialCommunityIcons) for consistency, accessibility labels, and size control.
- Admin: Use a consistent inline SVG icon set or Heroicons via `@heroicons/react`. Dashboard stat cards, sidebar nav items, and table actions should all use the same icon family.
- Never mix emoji and icon-font within the same screen.
- Every icon must have an `accessibilityLabel` (mobile) or `aria-label` (web).

### 3.10 Layout Rules

**Mobile:**
- Screen padding: `space-4` (16px) horizontal, `space-4` top
- Card padding: `space-4` (16px)
- Card margin-bottom: `space-3` (12px)
- List padding-bottom: 80px (clear FAB / tab bar)
- FlatList always uses `contentContainerStyle` for padding (never wrapper View padding)

**Admin:**
- Page content padding: `p-6`
- Card padding: `p-6`
- Grid gap: `gap-6` (between major sections), `gap-4` (between cards)
- Table cell padding: `px-4 py-3`
- Sidebar: `w-64` fixed

### 3.11 Content Density by Role

| Role | Density | Principle |
|------|---------|-----------|
| **Caregiver** | Medium | Show enough to reassure, link to details. Cards should show 3-4 key fields max. |
| **Patient** | Low | Large text, large touch targets, minimal information per card. No interactive controls. |
| **Provider** | Medium-High | Task-oriented lists. Show status + next action + key details on each card. |
| **Admin** | High | Tables with filters. Dense but well-organized. Support scanning 20+ rows. |

---

### 3.12 Core Component Specifications

#### Component: PageShell

**Purpose**: Wraps every screen with consistent background, padding, safe-area handling.
**Where used**: Every screen.
**Where NOT used**: Modals (they have their own container).
**Mobile**: `SafeAreaView` + `flex:1` + `bg-screen` background. Handles keyboard avoidance for form pages.
**Admin**: Already handled by `layout.tsx` sidebar + content area.
**State variants**: Standard (scrollable), Fixed (non-scrollable with footer).

#### Component: PageHeader

**Purpose**: Page title + optional subtitle + optional right-side action.
**Where used**: Every page except full-screen modals.
**Style**: `heading-lg` title + optional `body-sm text-tertiary` subtitle.
**Mobile variant**: May include back button for sub-pages.
**Admin variant**: Always `text-2xl font-bold text-gray-900 mb-6`.

#### Component: TabBar (Mobile)

**Purpose**: Bottom navigation per role.
**Where used**: `(tabs)/_layout.tsx`.
**Rules**: Max 4 tabs for caregiver, 3 for provider, 2 for patient. Icons must be consistent family. Active tab uses `color-primary`, inactive uses `text-tertiary`.

#### Component: SideNav (Admin)

**Purpose**: Persistent left sidebar for admin navigation.
**Where used**: `admin/layout.tsx`.
**Rules**: Active item `bg-blue-50 text-blue-700`. Include icon per nav item. Logout at bottom with separator.
**Missing**: Responsive collapse for mobile viewports.

#### Component: Card

**Purpose**: Primary content container.
**Where used**: Everywhere — recipient cards, measurement cards, stat cards, info sections.
**Style rules**: Always `bg-surface` + `border border-default` + `radius-md` + `elevation-low` + `padding: space-4`. Never mix shadow-only and border-only variants.
**State variants**: Default, Interactive (with hover/press feedback), Selected (with `border-primary`).

#### Component: SectionHeader

**Purpose**: Label for content sections within a page.
**Where used**: Inside ScrollViews to separate logical groups.
**Style**: `heading-sm` + `text-secondary` + `marginBottom: space-2` + `marginTop: space-4`.

#### Component: ButtonPrimary

**Purpose**: Primary call-to-action.
**Where used**: Form submit, generate report, main page action.
**Style**: `bg-primary` + white text + `radius-md` + `paddingVertical: 14` + `body-lg font-600`.
**State variants**: Default, Loading (show spinner + text), Disabled (opacity 0.5).
**Rule**: Maximum one primary button per screen.

#### Component: ButtonSecondary

**Purpose**: Secondary actions (share, export, cancel).
**Style**: `bg-primary-light` + `color-primary-text` + same sizing as primary.
**Where NOT used**: Never for destructive actions.

#### Component: ButtonDanger

**Purpose**: Destructive actions (cancel request, reject).
**Style**: `bg-danger-light` + `color-danger` text.
**Rule**: Always paired with confirmation dialog.

#### Component: TextInput

**Purpose**: Single-line and multi-line text entry.
**Style**: `bg-surface` + `border border-strong` + `radius-sm` + `padding: space-3` + `body-lg`.
**Focus state**: `border-primary` + optional ring.
**Error state**: `border-danger` + error message below in `caption text-danger`.
**Rule**: Always has a label above (never placeholder-only).

#### Component: DateInput

**Purpose**: Date entry. **Currently a plain TextInput — should remain so for MVP** but with format mask hint and validation.
**Style**: Same as TextInput + placeholder showing `YYYY-MM-DD`.
**Future**: Replace with DateTimePicker in Phase 2.

#### Component: Chip / Tag

**Purpose**: Selection chips (recipient selector, time slot, type toggle) and display tags (medical tags).
**Selection chip style**: `radius-lg` + `paddingHorizontal: 14, paddingVertical: 8`. Inactive: `bg-surface-alt` + `text-secondary`. Active: `bg-primary-light` + `text-primary-text` + `font-600`.
**Display tag style**: `radius-lg` + `paddingHorizontal: 10, paddingVertical: 3`. `bg-primary-light` + `text-primary-text` + `caption`.

#### Component: StatusPill

**Purpose**: Display service request status or AI health status.
**Style**: `radius-lg` + `paddingHorizontal: 10, paddingVertical: 3` + `caption font-500`. Colors from unified status color system.
**Rule**: Always include text label (never color-only).

#### Component: Table (Admin only)

**Purpose**: Data display for lists > 5 items.
**Style**: `rounded-lg border border-gray-200 overflow-hidden`. Header: `bg-gray-50 text-sm font-medium text-gray-700`. Rows: `divide-y`. Cells: `px-4 py-3 text-sm`.
**State variants**: Loading (skeleton rows), Empty (centered message), Error (red banner + retry).

#### Component: ListItem (Mobile)

**Purpose**: Individual item in a FlatList.
**Style**: Card component with domain-specific content slots.
**Rule**: Every list item should have a clear visual hierarchy — title line + 1-2 detail lines + optional right-side badge/indicator.

#### Component: StatBlock

**Purpose**: Display a single KPI number.
**Mobile**: `bg-surface` card with `heading-xl` number + `caption` label.
**Admin**: `border border-gray-200 bg-white p-6 rounded-lg` with `text-3xl font-bold` number (colored by domain) + `text-sm text-gray-500` label.

#### Component: EmptyState

**Purpose**: Shown when a list/page has no data.
**Structure**: Icon (optional) + title (`heading-sm`) + description (`body-sm text-tertiary`) + action button (optional).
**Rule**: Every FlatList and every table must have a dedicated empty state. The description should explain what data would appear and how to create it.

#### Component: LoadingState

**Purpose**: Shown during first data load.
**Mobile**: Skeleton cards (2-3 placeholder cards matching the shape of real cards) for list pages. ActivityIndicator + text for detail pages.
**Admin**: `animate-pulse` skeleton matching the layout shape.
**Rule**: Never show a blank screen during loading. Never show only a centered spinner without context text.

#### Component: ErrorState

**Purpose**: Shown when data fetch fails.
**Structure**: Error icon + message (`body-md text-danger`) + retry button.
**Style**: Inline within the content area, never a full-screen takeover for recoverable errors.
**Rule**: Always include a retry mechanism.

#### Component: Toast

**Purpose**: Brief success/info feedback.
**Style**: Bottom-positioned, `bg-surface` with `elevation-high` + left color bar (green for success). Auto-dismiss 2.5s.
**Where used**: After successful form submission, status update, copy-to-clipboard.
**Where NOT used**: Never for errors (use inline error states). Never for confirmations (use dialog).

#### Component: ConfirmDialog

**Purpose**: Explicit confirmation before irreversible actions.
**Structure**: Title + description + Cancel button (secondary) + Confirm button (danger or primary depending on action).
**Rule**: The confirm button label must describe the action ("取消需求", not "確定"). The description must explain the consequence.

#### Component: Timeline (new)

**Purpose**: Display status transition history for service requests.
**Structure**: Vertical line with status dots, labels, and timestamps.
**Where used**: Service request detail (mobile + admin).
**Where NOT used**: Not for general activity logs.

#### Component: InfoRow

**Purpose**: Label-value pair display.
**Style**: `flexDirection: row`, label (`body-md text-tertiary`) left, value (`body-md text-primary font-500`) right.
**Where used**: Detail pages (recipient, service request, provider, task).
**Rule**: Use `borderBottomWidth: hairline` between rows for visual grouping.

---

## PART 4 — Shared Interaction Patterns

### Loading Pattern
- **First load**: Show skeleton matching content shape. Include brief text like "載入中..."
- **Refresh**: Show pull-to-refresh spinner (mobile) or inline spinner (admin). Do not clear existing content.
- **Action in progress**: Button shows spinner + text change ("送出中...", "產生中..."). Button is disabled.
- **AI generation**: Pulsing skeleton card + text "AI 正在分析健康數據..." (not just a spinner).

### Empty Pattern
- Show centered illustration/icon + title + description + action button.
- Title: State what's empty ("尚無量測紀錄").
- Description: Guide toward the action ("定期記錄有助掌握健康狀況").
- Action: Single button to create first item ("開始記錄").
- Admin tables: Show "目前沒有符合條件的資料" with a suggestion to adjust filters.

### Error Pattern
- **API error**: Inline red box below the page header or within the affected section. Include error message + "重試" button.
- **Form validation error**: Inline below the offending field in `caption text-danger`. Do not use Alert.alert.
- **Network error**: Full-section error state with retry.
- **Rule**: Never silently fail. Never show raw error codes to users.

### Success Pattern
- **Form submission**: Toast at bottom ("量測紀錄已儲存") + auto-navigate back after 1s delay. **Replace all `Alert.alert` success messages with toast + navigation.**
- **Status update**: Toast ("狀態已更新") + refresh affected data in place.
- **Copy to clipboard**: Brief toast ("已複製到剪貼簿").

### Destructive Action Pattern
1. User taps destructive button (styled `ButtonDanger`).
2. ConfirmDialog appears with specific description.
3. Confirm button uses danger styling and specific label.
4. On confirm: show loading state → execute → show success toast.
5. On cancel: dismiss dialog, no side effects.

### Status Transition Pattern
- Display current status as `StatusPill` at top of detail page.
- Show transition buttons only for valid next states (use `VALID_STATUS_TRANSITIONS` from shared constants).
- Each transition button has a specific label (not generic "更新").
- After transition: refresh detail page, show toast.
- Admin: Include admin notes textarea before transition buttons.

### Notification Entry Points
- Mobile: Bell icon in home header with unread count badge. Tap → full notification list.
- Provider: Notification tab in bottom nav.
- Patient: Inline in schedule page.
- Admin: No in-app notifications (out of scope for MVP).

### Search / Filter / Sort
- Admin tables: Dropdowns above table for each filter dimension. Filters apply immediately on change (no "Apply" button needed for single-select dropdowns).
- Mobile lists: Horizontal chip selector for recipients. Status filter via horizontal scrollable chips where applicable.
- Sort: Default by most recent. No user-configurable sort for MVP.

### Pagination vs Infinite Scroll
- Admin: Traditional pagination (previous/next + page indicator). Consistent across all tables.
- Mobile: Simple paginated fetch with "load more" or FlatList `onEndReached` for lists likely to exceed 20 items (measurements). Fixed-limit fetch for small lists (appointments, service requests).

### Form Validation Pattern
- Validate on submit, not on every keystroke.
- Show all errors simultaneously (not one at a time).
- Scroll to first error field.
- Error text appears below the field in `caption text-danger`.
- Required fields marked with `*` in the label.
- Clear field-level errors when the user begins typing in that field.

### AI Report Generation Waiting State
1. User taps "更新近況" or "生成報告".
2. Button shows spinner + "正在整理近況..." text.
3. Content area shows pulsing skeleton matching report card shape.
4. On success: skeleton replaced with report card + toast.
5. On error: skeleton replaced with error message + retry button.
6. On rate limit: show specific message "已達更新上限（每小時 3 次），請稍後再試" without making it look like an error.

### Service Request Status Display
- List view: StatusPill on each card showing current status.
- Detail view: StatusPill at top + future Timeline component showing transition history.
- Caregiver view: When `candidate_proposed`, show prominent action card for confirm/reject.
- Admin view: Show dual confirmation status (✓/○ for caregiver and provider) next to candidate info.

### Bilateral Confirmation Display
- Show two-line confirmation tracker:
  - "家屬確認: ✓ 已確認 (2026-03-15 14:30)" or "○ 等待確認"
  - "服務者確認: ✓ 已確認 (2026-03-15 15:00)" or "○ 等待確認"
- Use green checkmark for confirmed, gray circle for pending.
- Timestamps in `caption text-tertiary`.

### Provider Task Reporting Flow
1. Provider opens task detail.
2. If `arranged`: Shows "開始服務" button.
3. Taps → confirmation dialog → status changes to `in_service` → toast.
4. If `in_service`: Shows note textarea + "完成服務" button.
5. Taps → confirmation dialog → status changes to `completed` → toast + completed card.
6. No ability to go backward (completed is terminal).

### Admin Operational Review Flow
1. Admin opens service request detail.
2. Sees current status + basic info + candidate/provider info.
3. Available actions shown as button group at bottom of right column.
4. Admin types optional note → clicks action button → confirmation → toast → page refreshes.
5. When proposing candidate: dropdown of approved providers → purple "提出候選" button.

---

## PART 5 — Prioritization Matrix

### 5.1 Roles by UX Importance

| Rank | Role | Reasoning |
|------|------|-----------|
| 1 | **Caregiver** | Primary user. Drives all data entry, views all health data, initiates all service requests. Highest frequency, highest business value. |
| 2 | **Admin** | Operational bottleneck. If admin UX is slow/confusing, service requests stall. Highest business process risk. |
| 3 | **Provider** | Task executor. Simple workflow but must be friction-free. Medium frequency but high trust impact. |
| 4 | **Patient** | Read-only consumer. Lowest interaction frequency. Important for trust but lowest complexity. |

### 5.2 User Flows by UX Importance

| Rank | Flow | Role | Reasoning |
|------|------|------|-----------|
| 1 | Record measurement → view result | Caregiver | Highest frequency action. Done daily. Must be fast and clear. |
| 2 | View home → check recipient status | Caregiver | First screen seen every session. Sets trust tone. |
| 3 | View trends → understand health trajectory | Caregiver | **Missing chart is a critical gap.** Core value proposition. |
| 4 | Generate AI report → read/share | Caregiver | Key differentiator. Must feel trustworthy. |
| 5 | Submit service request → track status | Caregiver | Core business flow. Must be clear and anxiety-reducing. |
| 6 | Triage requests → propose candidate → track confirmation | Admin | Core operations. Must be efficient. |
| 7 | View task → start/complete → report | Provider | Must be zero-friction. |
| 8 | Login → see own health data | Patient | Simple but must feel safe and clear. |

### 5.3 Pages by UX Importance

| Rank | Page | Role | Reasoning |
|------|------|------|-----------|
| 1 | Home / Recipient List | Caregiver | First impression, daily landing |
| 2 | Health Trends | Caregiver | **Missing chart — critical gap** |
| 3 | Recipient Detail | Caregiver | Central hub for per-recipient actions |
| 4 | AI Report | Caregiver | Key differentiator, trust-critical |
| 5 | Add Measurement | Caregiver | Highest frequency form |
| 6 | Service Request Detail | Caregiver + Admin | Status tracking + action center |
| 7 | Admin Dashboard | Admin | Operations overview |
| 8 | Admin Service Request List | Admin | Primary work queue |
| 9 | Provider Task List + Detail | Provider | Core workflow |
| 10 | Patient Summary | Patient | Only screen that matters for this role |
| 11 | Login | All | First touchpoint |
| 12 | Notifications | Caregiver | Trust signal — are alerts working? |

### 5.4 Components by UX Leverage

| Rank | Component | Impact Reasoning |
|------|-----------|-----------------|
| 1 | **StatusPill** | Used on 6+ pages across all roles. Unifying this fixes consistency everywhere. |
| 2 | **Card** | Used everywhere. Standardizing card style fixes the single biggest visual inconsistency. |
| 3 | **EmptyState** | Every list page needs one. Currently inconsistent or missing. |
| 4 | **Toast** | Replaces 10+ `Alert.alert` calls. Biggest interaction quality improvement. |
| 5 | **LoadingState / Skeleton** | Currently only home has skeleton. Expanding to all list pages adds polish. |
| 6 | **Chip** | Used for recipient selector, type toggle, time slot. Currently styled differently per page. |
| 7 | **InfoRow** | Used in 5+ detail pages. Currently reimplemented per page. |
| 8 | **ConfirmDialog** | Currently uses `Alert.alert` with inconsistent button labels. |
| 9 | **ErrorState** | Currently 3+ different error display patterns. |
| 10 | **ButtonPrimary/Secondary/Danger** | 3+ button colors/styles currently. |

### 5.5 Refinement Phasing

**Immediately (before any page redesign):**
1. Create shared theme constants file: `apps/mobile/lib/theme.ts` and `apps/web/lib/theme.ts`
2. Extract `STATUS_CONFIG` to `packages/shared/src/constants/status-display.ts`
3. Build `Toast` component (replaces Alert.alert for success)
4. Build `EmptyState` component
5. Build `StatusPill` component
6. Standardize `Card` wrapper component
7. Standardize `Chip` component
8. Build `InfoRow` component
9. Build `ErrorState` component
10. Build `LoadingState` / skeleton component

**Phase 1 — High-impact page polish:**
- Home dashboard
- Health trends (add chart)
- Add measurement
- AI report
- Recipient detail
- Service request detail (both mobile and admin)
- Admin dashboard
- Provider task list + detail
- Patient summary

**Phase 2 — Completeness polish:**
- Login / register
- Notifications
- Appointments
- Export
- New service request
- Profile/settings page (new)
- Admin provider management
- Admin recipients (add measurements)
- Admin service categories

**Defer:**
- Animated transitions
- Tab route physical separation (functional, not UX-critical)
- Admin responsive sidebar
- File upload for providers
- Admin new-provider creation form

---

## PART 6 — Role-Based Flow Map

### CAREGIVER

**Primary goal**: Monitor family members' health, coordinate care services, and feel reassured.

**Top 3 tasks**:
1. Record daily health measurements (BP/BG)
2. Check health status and trends
3. Request and track care services

**Likely MVP frustrations**:
- No chart on trends page — just numbers in a table, hard to spot patterns
- Success feedback uses blocking Alert.alert dialogs
- Home screen is information-dense but visually flat — hard to scan
- Date inputs require knowing exact format (no picker)
- Logout button on home header is dangerously positioned

**UX success criteria**:
- Can record a measurement in < 30 seconds from home
- Can understand health status of any recipient in < 5 seconds from home
- Can submit a service request in < 2 minutes
- Feels confident that the AI report is advisory, not diagnostic

**Highest-risk moments**:
- Seeing an abnormal measurement — needs calm but clear presentation
- Reading AI "建議就醫" — must not cause panic
- Waiting for service request status update — needs transparency
- Confirming a candidate provider — irreversible decision

**Screens involved**: Login → Home → Recipient Detail → Add Measurement → Trends → AI Report → Services List → New Request → Request Detail → Appointments → Notifications

**Critical states**: Abnormal measurement display, AI report loading/failure, empty recipient list, service request status transitions, candidate confirmation

---

### PATIENT

**Primary goal**: See own health data and upcoming schedule without confusion.

**Top 3 tasks**:
1. View latest health readings
2. See upcoming appointments/reminders
3. Check service request status

**Likely MVP frustrations**:
- Schedule page shows raw notifications, not a clean schedule view
- No clear "your next appointment" card
- Medical values shown without context (what's normal?)
- Interface may feel sparse without enough guidance

**UX success criteria**:
- Can understand own health status in < 10 seconds
- Never encounters an interactive control they can't use
- Feels safe and informed, not confused

**Highest-risk moments**:
- Seeing abnormal values without context (patient may not understand BP numbers)
- Empty state with no guidance

**Screens involved**: Login → Summary → Schedule

**Critical states**: Empty measurements, abnormal value display, no upcoming appointments

---

### PROVIDER

**Primary goal**: View assigned tasks, execute service, report completion.

**Top 3 tasks**:
1. Check new task assignments
2. Start and complete assigned services
3. Update availability status

**Likely MVP frustrations**:
- Task list doesn't show urgency (all cards look the same regardless of date proximity)
- Confirm-case and task-detail are separate screens requiring navigation
- No notification badge on task tab to indicate new assignments
- Profile page requires navigating to a separate tab

**UX success criteria**:
- Can see all pending tasks in < 3 seconds
- Can start a service in < 3 taps
- Can complete and report in < 1 minute
- Can update availability in < 5 seconds

**Highest-risk moments**:
- Missing a new task assignment (no push notifications)
- Accidentally confirming/rejecting a case
- Forgetting to complete a task after service

**Screens involved**: Login → Task List → Task Detail → Confirm Case → Profile

**Critical states**: No assigned tasks, pending confirmation, task in progress, completed task display

---

### ADMIN

**Primary goal**: Triage service requests, manage providers, monitor platform health.

**Top 3 tasks**:
1. Review and advance service requests through status pipeline
2. Propose candidate providers and track confirmations
3. Review and approve new providers

**Likely MVP frustrations**:
- Only one filter dimension per table (single dropdown)
- Dashboard recent lists aren't clickable links
- No search functionality on any table
- Service request detail requires scrolling to reach action buttons
- No breadcrumb navigation
- Recipients page shows no health data

**UX success criteria**:
- Can find and advance a service request in < 30 seconds
- Can see platform-wide status at a glance from dashboard
- Can complete a provider review in < 1 minute
- Never takes an action without clear confirmation

**Highest-risk moments**:
- Proposing wrong candidate provider
- Advancing status incorrectly (wrong button)
- Missing a request that's been waiting too long

**Screens involved**: Login → Dashboard → Service Requests (list + detail) → Providers (list + detail) → Recipients → Service Categories

**Critical states**: No pending requests, provider list empty, request stuck in status, dual confirmation pending

---

## PART 7 — Page Polish Spec Template

```
=== PAGE POLISH SPEC ===

1. PAGE NAME:
2. ROLE:
3. PAGE GOAL:
4. USER INTENT (why the user opens this page):
5. PRIMARY CTA:
6. SECONDARY CTA(S):
7. CRITICAL INFORMATION HIERARCHY:
   - Tier 1 (must see immediately):
   - Tier 2 (see on scan):
   - Tier 3 (available on demand):
8. MAIN MODULES / SECTIONS (top to bottom):
9. DATA DEPENDENCIES (APIs called):
10. EDGE CASES:
11. STATES:
    - Loading:
    - Empty:
    - Error:
    - Success:
12. TRUST / SAFETY MESSAGING:
13. UX ISSUES IN CURRENT IMPLEMENTATION:
14. VISUAL HIERARCHY IMPROVEMENTS:
15. MOBILE BEHAVIOR NOTES:
16. ACCESSIBILITY NOTES:
17. IMPLEMENTATION NOTES:
18. DESIGN SYSTEM COMPONENTS USED:
19. ANALYTICS SUGGESTIONS:
20. ACCEPTANCE CHECKLIST:
```

---

## PART 8 — First Audit Batch

### 8.1 CAREGIVER — Login

```
1. PAGE NAME: Login
2. ROLE: All (shared entry point)
3. PAGE GOAL: Authenticate user and route to role-appropriate home
4. USER INTENT: "I want to access my account"
5. PRIMARY CTA: 登入 button
6. SECONDARY CTA: 還沒有帳號？註冊
7. INFORMATION HIERARCHY:
   - T1: Email + Password fields + Login button
   - T2: App branding
   - T3: Register link
8. MODULES: Branding header → Error display → Form → Submit → Register link
9. DATA: POST /auth/login
10. EDGE CASES: Wrong credentials, network error, expired session redirect
11. STATES:
    - Loading: Button shows spinner + "登入中..."
    - Error: Red box above form with message
    - Success: Navigate to role home
12. TRUST: Display app name prominently. No alarming colors.
13. UX ISSUES:
    - Subtitle says "委託人登入" — misleading for patient/provider/admin
    - No password visibility toggle
    - Error box above form fields pushes layout down
    - No "forgot password" (acceptable for MVP but note for later)
14. HIERARCHY IMPROVEMENTS:
    - Change subtitle to "登入您的帳號" (role-neutral)
    - Add app tagline: "守護家人健康的好幫手"
    - Move error message below submit button or as inline toast
15. MOBILE NOTES: KeyboardAvoidingView works. Could benefit from ScrollView
    wrapper for very small screens.
16. ACCESSIBILITY: Add accessibilityLabel to inputs. Add accessibilityRole
    to button.
17. IMPLEMENTATION:
    - Swap subtitle text string
    - Add secureTextEntry toggle icon
    - Change error display position
18. COMPONENTS: PageShell, TextInput (x2), ButtonPrimary, ErrorState (inline)
19. ANALYTICS: Track login_attempt, login_success, login_failure (with error
    code)
20. CHECKLIST:
    [ ] Subtitle is role-neutral
    [ ] Error displays without layout shift
    [ ] Loading state on button
    [ ] Keyboard avoidance works on iOS + Android
    [ ] Navigate to correct role home on success
```

### 8.2 CAREGIVER — Home Dashboard

```
1. PAGE NAME: Home / Recipient List
2. ROLE: Caregiver
3. PAGE GOAL: Overview of all care recipients + quick access to actions
4. USER INTENT: "Show me how my family members are doing"
5. PRIMARY CTA: Tap recipient card → go to detail
6. SECONDARY CTA: FAB → add recipient; Bell → notifications
7. INFORMATION HIERARCHY:
   - T1: Recipient name + health status indicator
   - T2: Medical tags + latest AI summary
   - T3: AI report date + detail arrow
8. MODULES: Header (greeting + bell + logout) → Recipient FlatList → FAB
9. DATA: GET /recipients, GET /ai/reports (per recipient), GET /notifications/unread-count
10. EDGE CASES: 0 recipients, 10 recipients (max), AI reports failed to load,
    all recipients healthy, one abnormal
11. STATES:
    - Loading: 2-3 skeleton cards
    - Empty: EmptyState with "新增您的第一位被照護者" + FAB highlight
    - Error: ErrorState with retry
    - Success: Populated list
12. TRUST: Health status dot must be accompanied by text label ("穩定"/"需注意").
    Never color-only.
13. UX ISSUES:
    - Logout button in header is dangerously close to bell icon
    - AI summary fetched per-recipient in parallel → potential N+1 request storm
    - Header shows "今日家人安心報" as section hint but AI summary is per-
      recipient, not aggregated
    - Card information density is high (name + age + tags + AI status + summary
      + date + arrow)
    - Bell uses emoji (🔔), not a proper icon
14. HIERARCHY IMPROVEMENTS:
    - Move logout to a profile/settings page (add profile tab or menu)
    - Simplify card: Name + age on line 1, tags on line 2, status pill + one-
      line summary on line 3. Remove date from card face.
    - Replace emoji bell with icon component
    - Add notification badge as overlay dot (current implementation is fine,
      just ensure it uses design system colors)
    - Consider capping AI report fetch to first 5 recipients, lazy-load rest
15. MOBILE NOTES: FlatList performance is fine for <10 items. Ensure
    contentContainerStyle has bottom padding for FAB clearance.
16. ACCESSIBILITY: Each card needs accessibilityLabel combining recipient name
    + status. Bell needs "通知" label. FAB needs "新增被照護者" label.
17. IMPLEMENTATION:
    - Extract card to RecipientCard component
    - Move logout to future profile page
    - Replace emoji with Ionicons icon
    - Apply unified Card component wrapper
    - Apply unified StatusPill for AI status
18. COMPONENTS: PageShell, PageHeader, Card, StatusPill, Chip (tags),
    EmptyState, LoadingState (skeleton), FAB
19. ANALYTICS: Track home_viewed, recipient_card_tapped, notification_bell_
    tapped, fab_tapped
20. CHECKLIST:
    [ ] Skeleton loading state (not spinner)
    [ ] Empty state with action guidance
    [ ] Card uses unified Card component
    [ ] Status pill uses unified StatusPill
    [ ] Bell icon replaced with vector icon
    [ ] Logout moved out of header
    [ ] Accessibility labels on all interactive elements
```

### 8.3 CAREGIVER — Recipient Detail

```
1. PAGE NAME: Recipient Detail
2. ROLE: Caregiver
3. PAGE GOAL: Deep view of one recipient + action hub
4. USER INTENT: "Show me everything about this person and let me take action"
5. PRIMARY CTA: Quick action buttons (record BP/BG, trends, appointments)
6. SECONDARY CTA: Edit button
7. INFORMATION HIERARCHY:
   - T1: Name + age + health status
   - T2: Quick action buttons
   - T3: Recent measurements + reminders
8. MODULES: Header → Tags → Info section → Quick actions → Recent
   measurements → Reminders → Edit button
9. DATA: GET /recipients/:id, GET /measurements?recipient_id&limit=5,
   GET /recipients/:id/reminders
10. EDGE CASES: No measurements yet, no reminders set, all measurements
    normal, recent abnormal, recipient has no tags
11. STATES:
    - Loading: Skeleton for header + skeleton for measurements section
    - Empty measurements: "尚無量測紀錄。定期記錄有助追蹤健康趨勢。"
    - Error: Section-level error (don't block whole page if measurements fail)
12. TRUST: Abnormal measurements clearly marked but not alarming. Use
    semantic-warning not semantic-danger for elevated readings.
13. UX ISSUES:
    - Page is very long — requires extensive scrolling
    - Reminder time editing is inline with raw TextInput (HH:mm) — fragile
    - Quick action buttons are visually identical (same color, no icon)
    - Edit button is at the very bottom — hard to find
    - Info section shows gender/DOB/contact in a flat list without grouping
14. HIERARCHY IMPROVEMENTS:
    - Group into clear sections with SectionHeaders: "基本資訊" / "快捷操作" /
      "最近量測" / "量測提醒"
    - Add icons to quick action buttons to differentiate them
    - Move edit button to header (icon button, top-right)
    - Consider collapsing "基本資訊" section if > 4 fields (expandable)
    - Limit recent measurements to 3 (not 5) with "查看更多" link
15. MOBILE NOTES: ScrollView is appropriate here. Ensure safe bottom padding.
16. ACCESSIBILITY: Quick action buttons need distinct accessibilityLabels.
    Reminder switches need labels.
17. IMPLEMENTATION:
    - Extract to sections with SectionHeader component
    - Add icons to quick action buttons
    - Move edit to header TouchableOpacity
    - Use InfoRow component for basic info fields
    - Apply Card component to each section
18. COMPONENTS: PageShell, PageHeader (with back + edit), Card, SectionHeader,
    InfoRow, Chip (tags), StatusPill (measurement abnormal), ButtonSecondary
    (quick actions), Switch, EmptyState (per section), LoadingState
19. ANALYTICS: Track recipient_detail_viewed, quick_action_tapped (with type),
    reminder_toggled, edit_tapped
20. CHECKLIST:
    [ ] Clear section grouping with headers
    [ ] Quick actions have icons
    [ ] Edit button accessible without scrolling
    [ ] Abnormal measurements visually distinct but not alarming
    [ ] Empty measurement state with guidance
    [ ] Reminder toggle works without page reload
```

### 8.4 CAREGIVER — Add Measurement

```
1. PAGE NAME: Add Measurement
2. ROLE: Caregiver
3. PAGE GOAL: Record a BP or BG reading for a recipient
4. USER INTENT: "I just took a measurement, let me record it quickly"
5. PRIMARY CTA: 儲存 button
6. SECONDARY CTA: None (back navigation)
7. INFORMATION HIERARCHY:
   - T1: Type toggle (BP vs BG) + input fields
   - T2: Optional note
   - T3: Validation feedback
8. MODULES: Type toggle → Conditional inputs → Note → Submit
9. DATA: POST /measurements
10. EDGE CASES: Value out of range, abnormal result, network error mid-submit,
    switching type clears values
11. STATES:
    - Loading: Button spinner
    - Error: Inline below fields
    - Success: Toast + navigate back
    - Abnormal result: Toast with advisory message (not blocking alert)
12. TRUST: Abnormal warning should be calm: "此次數值偏高，建議留意。" Not alarming.
13. UX ISSUES:
    - Uses Alert.alert for both success and abnormal — blocks user
    - Glucose timing buttons wrap unpredictably on narrow screens
    - No visual indication of what "normal range" is while entering
    - Heart rate field label doesn't say "(選填)" clearly
    - Type toggle uses same visual weight as form inputs
14. HIERARCHY IMPROVEMENTS:
    - Replace Alert.alert with Toast for success
    - Show range hint below each input ("正常範圍：90-130 mmHg")
    - Make type toggle visually prominent (larger, top of page, clear active state)
    - Glucose timing: use 2x2 grid instead of wrapping row
    - Add recipient name in header so user knows whose data they're recording
15. MOBILE NOTES: KeyboardAvoidingView needed. Ensure number inputs use numeric
    keyboard.
16. ACCESSIBILITY: Input fields need accessibilityLabel with range info.
17. IMPLEMENTATION:
    - Replace Alert.alert with Toast component
    - Add range hints as caption text below inputs
    - Show recipient name in PageHeader
    - Apply theme typography and spacing
18. COMPONENTS: PageShell, PageHeader, Chip (type toggle), TextInput (with
    hint), ButtonPrimary, Toast, ErrorState (inline)
19. ANALYTICS: Track measurement_type_selected, measurement_submitted,
    measurement_abnormal_flagged
20. CHECKLIST:
    [ ] Toast replaces Alert.alert for success
    [ ] Abnormal advisory is non-blocking
    [ ] Range hints visible below inputs
    [ ] Recipient name in header
    [ ] Numeric keyboard for number fields
    [ ] Validation errors inline below fields
```

### 8.5 CAREGIVER — Health Trends

```
1. PAGE NAME: Trends
2. ROLE: Caregiver
3. PAGE GOAL: Visualize health data patterns over time
4. USER INTENT: "Is the trend getting better or worse?"
5. PRIMARY CTA: Type/period toggles (exploration, not action)
6. SECONDARY CTA: None
7. INFORMATION HIERARCHY:
   - T1: Trend chart (MISSING — critical gap)
   - T2: Summary stats (count, abnormal, min/max/avg)
   - T3: Daily data table
8. MODULES: Type toggle → Period toggle → [Chart] → Stats grid → Daily table
9. DATA: GET /measurements/stats
10. EDGE CASES: No data for selected period, all normal, all abnormal,
    single day data
11. STATES:
    - Loading: Skeleton chart + skeleton stats
    - Empty: "尚無此期間的量測資料"
    - Error: Inline error with retry
12. TRUST: Chart must clearly label axes and show abnormal zones without making
    them look alarming.
13. UX ISSUES:
    - **NO CHART** — spec requires line chart with abnormal zone shading and
      red dots for abnormal points. Currently only shows stats + table.
    - Stats grid works well but lacks visual differentiation
    - Daily table rows are dense without clear date grouping
    - Abnormal "!" indicator is a red circle with text — should be a proper icon
14. HIERARCHY IMPROVEMENTS:
    - ADD LINE CHART as primary visual (use react-native-chart-kit or
      victory-native). BP: dual line (systolic + diastolic). BG: single line.
      Shade abnormal zones in light red. Mark abnormal points with red dots.
    - Move stats to compact row below chart
    - Daily table becomes secondary (collapsible "每日明細")
    - Abnormal count stat should use semantic-danger color
15. MOBILE NOTES: Chart must be horizontally scrollable if > 14 data points.
    Touch to show data point tooltip.
16. ACCESSIBILITY: Chart needs text alternative. Stats are fine.
17. IMPLEMENTATION:
    - Install react-native-chart-kit (already in expo ecosystem)
    - Build TrendChart component wrapping LineChart
    - Daily data available from stats API (daily_data array)
    - Make daily table collapsible
18. COMPONENTS: PageShell, Chip (type toggle, period toggle), TrendChart (new),
    StatBlock, Card, EmptyState
19. ANALYTICS: Track trends_viewed (with type + period), trends_type_changed,
    trends_period_changed
20. CHECKLIST:
    [ ] Line chart renders for BP (dual line) and BG (single line)
    [ ] Abnormal zone shading on chart
    [ ] Red dots on abnormal data points
    [ ] Stats show below chart
    [ ] Daily table is collapsible
    [ ] Empty state for no data
    [ ] Chart handles 7 and 30 day ranges
```

### 8.6 CAREGIVER — AI Report

```
1. PAGE NAME: AI 安心報
2. ROLE: Caregiver
3. PAGE GOAL: Generate and read AI health summary
4. USER INTENT: "Give me an easy-to-understand health update"
5. PRIMARY CTA: 更新近況
6. SECONDARY CTA: 分享給家人, 更多功能
7. INFORMATION HIERARCHY:
   - T1: Status label + summary sentence
   - T2: Reasons + suggestions
   - T3: Disclaimer + share
8. MODULES: Recipient selector → Current report card → Generate button →
   More options (collapsible) → History
9. DATA: GET /recipients, GET /ai/reports, POST /ai/health-report, POST /ai/chat
10. EDGE CASES: No reports yet, AI failure (fallback text), rate limited,
    multiple recipients, long suggestion lists
11. STATES:
    - Loading (initial): Skeleton report card + "載入近況中..."
    - Loading (generating): Pulsing skeleton + "AI 正在分析健康數據..."
    - Error: Inline error + retry
    - Rate limited: Informational message (not error-styled)
    - Fallback: Report with "(AI 暫時無法回應，以上為預設文字)" note
    - Success: Full report card
12. TRUST: CRITICAL. Disclaimer must always be visible. Status labels use calm
    colors. "建議就醫" uses warm red, not alarming red. Share text must include
    disclaimer.
13. UX ISSUES:
    - 654 lines in one file — too complex, needs decomposition
    - "More features" collapsible section hides useful functionality
    - Chat task and report type selectors look the same but behave differently
    - History section is visually subordinate (small cards at bottom)
    - Rate limit message styled as error — should be informational
    - Share button builds text manually — could miss fields
14. HIERARCHY IMPROVEMENTS:
    - Split into sub-components: ReportCard, ChatCard, ReportHistory
    - Make report type selection more prominent (not hidden in "more")
    - Rate limit: Use info banner, not error styling
    - History: Add date grouping, show report type icon
    - Disclaimer: Give it its own visual container (light gray box, not just
      tiny text)
15. MOBILE NOTES: ScrollView with proper bottom padding. Report card should
    not exceed one screen height if possible.
16. ACCESSIBILITY: Status label needs accessibilityLabel. Disclaimer must not be
    skippable by screen reader.
17. IMPLEMENTATION:
    - Extract ReportCard, ChatResult, HistorySection components
    - Apply unified StatusPill for status label
    - Apply Card component for report container
    - Apply design system typography
    - Disclaimer in its own bordered container
18. COMPONENTS: PageShell, Chip (recipient selector, type selector),
    StatusPill, Card, ButtonPrimary, ButtonSecondary, EmptyState, LoadingState
    (skeleton), InfoBanner (rate limit), Disclaimer (new small component)
19. ANALYTICS: Track ai_report_generated (type), ai_report_shared,
    ai_chat_generated (task), ai_rate_limited
20. CHECKLIST:
    [ ] Disclaimer always visible and in distinct container
    [ ] Status label uses StatusPill component
    [ ] Rate limit is informational, not error-styled
    [ ] Report card has clear visual hierarchy
    [ ] Share includes all content + disclaimer
    [ ] Loading state is skeleton, not spinner
    [ ] File decomposed to < 300 lines per component
```

### 8.7 CAREGIVER — Service Request Detail

```
1. PAGE NAME: Service Request Detail
2. ROLE: Caregiver
3. PAGE GOAL: View request status and take action if needed
4. USER INTENT: "What's happening with my request? Do I need to do anything?"
5. PRIMARY CTA: Confirm/Reject candidate (when applicable)
6. SECONDARY CTA: Cancel request
7. INFORMATION HIERARCHY:
   - T1: Current status + action required indicator
   - T2: Service info (category, recipient, date, location)
   - T3: Provider info + confirmation status
8. MODULES: Status badge → Service info → Provider section → Action buttons → Cancel
9. DATA: GET /service-requests/:id, PUT /confirm-caregiver
10. EDGE CASES: No candidate yet, candidate proposed (action needed), both confirmed,
    cancelled, completed
11. STATES: Standard loading/error/success
12. TRUST: Status must be clear. When action is needed, it should be visually
    prominent.
13. UX ISSUES:
    - No status timeline (spec requires transition history)
    - Confirm/reject buttons appear only when candidate_proposed — user may not
      understand why buttons appear/disappear
    - Cancel button at bottom looks like a primary action
    - No explanation of what each status means
14. HIERARCHY IMPROVEMENTS:
    - Add Timeline component showing status history with timestamps
    - When action needed: show prominent action card at top with explanation
      ("平台已為您推薦服務人員，請確認是否同意")
    - Cancel button: move to bottom, use ButtonDanger with ConfirmDialog
    - Add brief status explanation text below badge
15. COMPONENTS: PageShell, PageHeader, StatusPill, Card, InfoRow, Timeline
    (new), ButtonPrimary (confirm), ButtonDanger (reject/cancel),
    ConfirmDialog, Toast
16. CHECKLIST:
    [ ] Status timeline shows transition history
    [ ] Action needed is visually prominent
    [ ] Cancel uses ConfirmDialog
    [ ] Status badge uses StatusPill
```

### 8.8 CAREGIVER — Service Request List

```
1. PAGE NAME: Service Request List
2. ROLE: Caregiver
3. PAGE GOAL: Track all submitted service requests
4. USER INTENT: "What's the status of my requests?"
5. PRIMARY CTA: Tap card → detail; FAB → new request
6. SECONDARY CTA: None
7. INFORMATION HIERARCHY:
   - T1: Status + category
   - T2: Recipient + date
   - T3: Location
8. UX ISSUES:
   - No filter by status (all mixed)
   - No visual distinction between action-needed requests and passive ones
   - FAB label "+ 新增需求" may overlap with last card
9. IMPROVEMENTS:
   - Add horizontal status filter chips
   - Highlight cards where caregiver action is needed (candidate_proposed)
   - Ensure FAB has 80px bottom padding clearance
10. COMPONENTS: PageShell, Card, StatusPill, Chip (filter), FAB, EmptyState
```

### 8.9 CAREGIVER — New Service Request

```
1. PAGE NAME: New Service Request
2. ROLE: Caregiver
3. PAGE GOAL: Submit a new service request
4. USER INTENT: "I need help with care for my family member"
5. PRIMARY CTA: 送出需求
6. INFORMATION HIERARCHY:
   - T1: Recipient + category selection
   - T2: Date + time + location
   - T3: Description
7. UX ISSUES:
   - Category grid uses 48% width — 2nd column may misalign
   - Date input is plain text (YYYY-MM-DD)
   - Uses Alert.alert for success — should be Toast
   - No confirmation step before submission
   - Error display at top pushes form down
8. IMPROVEMENTS:
   - Replace Alert.alert with Toast + navigate back
   - Add confirmation dialog before submit ("確認送出此服務需求？")
   - Show recipient name + category name in confirmation
   - Move error to inline per-field validation
9. COMPONENTS: PageShell, Chip (recipient, time slot), Card (category grid),
   TextInput, ButtonPrimary, ConfirmDialog, Toast
```

### 8.10 CAREGIVER — Appointments

```
1. PAGE NAME: Appointments
2. ROLE: Caregiver
3. PAGE GOAL: View and manage upcoming medical appointments
4. USER INTENT: "When are the next doctor visits?"
5. PRIMARY CTA: + 新增行程
6. UX ISSUES:
   - Different background (#f8fafc) from other screens (#F9FAFB)
   - Days label color logic is good but could use text reinforcement
   - Past appointments shown with opacity 0.6 — could be confusing
   - Add button fixed at bottom may cover last item
7. IMPROVEMENTS:
   - Unify background color
   - Split list: "即將到來" section + "已過期" section (collapsible)
   - Ensure bottom padding for add button clearance
   - Apply Card component
8. COMPONENTS: PageShell, Card, SectionHeader, ButtonPrimary, EmptyState
```

### 8.11 CAREGIVER — Notifications

```
1. PAGE NAME: Notifications
2. ROLE: Caregiver
3. PAGE GOAL: View all notifications and mark as read
4. USER INTENT: "What alerts do I have?"
5. PRIMARY CTA: Mark all as read
6. UX ISSUES:
   - Emoji icons (⏰⚠️📅📦📊) lack accessibility labels
   - Back button at bottom-left is unusual positioning
   - Body truncated to 2 lines — may hide important information
   - No notification type filter
   - Card tap marks as read but doesn't navigate to related content
7. IMPROVEMENTS:
   - Replace emoji with vector icons
   - Remove floating back button (use header back nav)
   - Tap notification → navigate to related content (measurement, appointment,
     service request)
   - Add unread count in section header
8. COMPONENTS: PageShell, PageHeader, Card, ListItem, ButtonSecondary
   (mark all read), EmptyState
```

### 8.12 CAREGIVER — Profile/Settings (NEW PAGE)

```
1. PAGE NAME: Profile / Settings
2. ROLE: Caregiver
3. PAGE GOAL: View and edit personal settings, access logout
4. USER INTENT: "Let me check my settings or log out"
5. PRIMARY CTA: Logout
6. SECONDARY CTA: Edit profile fields
7. INFORMATION HIERARCHY:
   - T1: Name + email + role
   - T2: Phone + timezone
   - T3: Logout
8. MODULES: Profile info section → Settings → Logout button
9. DATA: GET /auth/me, PUT /auth/me
10. NOTE: This page does not exist yet. It should be created to move logout
    out of the home header. Can be added as a sub-page accessible from a
    gear icon in the home header, or as a future 5th tab.
11. COMPONENTS: PageShell, PageHeader, Card, InfoRow, TextInput, ButtonPrimary,
    ButtonDanger (logout), ConfirmDialog
```

### 8.13 PATIENT — Summary

```
1. PAGE NAME: Patient Health Summary
2. ROLE: Patient
3. PAGE GOAL: See own health status at a glance
4. USER INTENT: "How am I doing?"
5. PRIMARY CTA: None (read-only)
6. SECONDARY CTA: Pull to refresh
7. INFORMATION HIERARCHY:
   - T1: Latest readings (BP + BG) with normal/abnormal indicator
   - T2: Simple stats (count, abnormal count)
   - T3: Measurement history list
8. MODULES: Profile card → Latest readings → Stats → History
9. DATA: GET /recipients?limit=1, GET /measurements
10. EDGE CASES: Patient not linked to recipient, no measurements, all normal,
    recent abnormal
11. STATES: Standard
12. TRUST: Values should show context ("正常範圍" reference). Abnormal should
    say "建議告知家人或醫師" not just turn red.
13. UX ISSUES:
    - Measurement values shown without context (patient may not know what
      120/80 means)
    - Stats show "異常筆數" which could alarm patients
    - Cards use different background/border system than caregiver screens
    - No link to explain what the numbers mean
    - Uses different gray palette (#f8fafc, #e2e8f0, #1e293b) than caregiver screens
14. HIERARCHY IMPROVEMENTS:
    - Add simple normal/abnormal indicator with text label next to each reading
      ("血壓正常" in green or "血壓偏高，請留意" in warm yellow)
    - Rename "異常筆數" to "需留意的紀錄" (softer language)
    - Unify color palette with design system
    - Add larger text for latest values (patient may have vision limitations)
    - Consider adding a simple emoji-style overall status ("😊 今日狀況良好")
15. MOBILE NOTES: Large touch targets. Large text. High contrast.
16. ACCESSIBILITY: Large font sizes. High contrast ratios. Screen reader
    should read "血壓 120/80，正常" not just numbers.
17. IMPLEMENTATION:
    - Apply design system colors (replace #f8fafc with bg-screen, etc.)
    - Add contextual text to readings
    - Increase heading sizes for patient role
18. COMPONENTS: PageShell, Card, StatBlock, ListItem, EmptyState
19. CHECKLIST:
    [ ] Values have contextual labels (normal/elevated)
    [ ] Language is non-alarming
    [ ] Text sizes are large enough for older users
    [ ] Color palette unified with design system
```

### 8.14 PATIENT — Schedule

```
1. PAGE NAME: Patient Schedule
2. ROLE: Patient
3. PAGE GOAL: See upcoming reminders and appointments
4. USER INTENT: "What do I need to do today?"
5. UX ISSUES:
   - Shows raw notifications, not structured schedule data
   - No distinction between types (measurement reminder vs appointment)
   - Different styling from other patient pages
   - No "today" / "upcoming" grouping
7. IMPROVEMENTS:
   - Group notifications by "今天" / "即將到來"
   - Add type icons (from vector icon library, not emoji)
   - If appointment data is available, show structured appointment cards
     (not notification cards)
   - Unify styling with patient summary page
8. COMPONENTS: PageShell, SectionHeader, Card, ListItem, EmptyState
```

### 8.15 PROVIDER — Task List

```
1. PAGE NAME: Provider Task List
2. ROLE: Provider
3. PAGE GOAL: See all assigned tasks and their status
4. USER INTENT: "What do I need to do?"
5. PRIMARY CTA: Tap task → go to detail
6. SECONDARY CTA: None
7. INFORMATION HIERARCHY:
   - T1: Task status + required action indicator
   - T2: Category + recipient + date
   - T3: Location
8. MODULES: Task FlatList
9. DATA: GET /provider/tasks
10. EDGE CASES: No tasks, all completed, mix of statuses
11. STATES: Standard
12. TRUST: Task urgency should be clear (approaching dates highlighted).
13. UX ISSUES:
    - No urgency indicators (a task due tomorrow looks same as one due in 2 weeks)
    - No status filter (all statuses mixed together)
    - No "new" indicator for freshly assigned tasks
    - Cards identical to service request cards — should emphasize action needed
14. HIERARCHY IMPROVEMENTS:
    - Add status filter chips at top (全部/待執行/服務中/已完成)
    - Add urgency indicator: approaching dates (≤3 days) in warm color
    - Add "需要您的操作" badge on tasks requiring action
    - Group by status (pending first, then in progress, then completed)
15. COMPONENTS: PageShell, Chip (filter), Card, StatusPill, ListItem,
    EmptyState
16. CHECKLIST:
    [ ] Status filter chips
    [ ] Urgency indicators for approaching dates
    [ ] Action-needed indicator on relevant tasks
    [ ] Empty state with appropriate message
```

### 8.16 PROVIDER — Task Detail + Progress

```
1. PAGE NAME: Provider Task Detail
2. ROLE: Provider
3. PAGE GOAL: View task details and report progress
4. USER INTENT: "Let me see the details and update status"
5. PRIMARY CTA: Start Service / Complete Service (status-dependent)
6. UX ISSUES:
   - Note input only appears for certain statuses — no visual hint that notes
     are welcome
   - Completed state shows a green card but no timestamp
   - Action buttons are at bottom — need scrolling to reach
   - Uses Alert.alert for success — should be Toast
7. IMPROVEMENTS:
   - Show action button prominently (sticky bottom or floating)
   - Add timestamp to completed state
   - Replace Alert.alert with Toast
   - Add service checklist or structured fields for common task types (future)
8. COMPONENTS: PageShell, PageHeader, Card, InfoRow, TextInput (note),
   ButtonPrimary, ButtonDanger, ConfirmDialog, Toast
```

### 8.17 PROVIDER — Profile

```
1. PAGE NAME: Provider Profile
2. ROLE: Provider
3. PAGE GOAL: View/update own profile and availability
4. USER INTENT: "Let me check my info and update availability"
5. UX ISSUES:
   - Availability toggle requires API call on each tap — no loading indicator
   - Review status labels ("審核中"/"已核准"/"未通過") are hardcoded differently
     from admin ("待審核"/"已核准"/"已停權")
   - No ability to edit specialties or service areas (only availability)
   - Info layout is clean but uses different InfoRow style from task detail
7. IMPROVEMENTS:
   - Add loading indicator on availability change
   - Unify review status labels with shared constants
   - Unify InfoRow component
   - Add toast on successful availability update
8. COMPONENTS: PageShell, PageHeader, Card, InfoRow, Chip (tags),
   SelectionCard (availability), Toast
```

### 8.18 ADMIN — Dashboard

```
1. PAGE NAME: Admin Dashboard
2. ROLE: Admin
3. PAGE GOAL: Platform health overview + quick access to pending items
4. USER INTENT: "What needs my attention right now?"
5. PRIMARY CTA: Click pending request → go to detail
6. SECONDARY CTA: "查看全部" links
7. INFORMATION HIERARCHY:
   - T1: Pending requests count + abnormal alerts count (action items)
   - T2: Other KPIs
   - T3: Recent lists
8. MODULES: KPI grid → Recent pending requests → Recent abnormal alerts
9. DATA: GET /admin/dashboard
10. EDGE CASES: Zero pending, zero abnormal, high counts
11. STATES: Loading skeleton, Error with retry
12. TRUST: Numbers must be accurate and current.
13. UX ISSUES:
    - KPI cards lack icons (6 numbers without visual differentiation)
    - Recent request items aren't clickable links (missing navigation)
    - All 6 KPIs have equal visual weight — action-required items should
      stand out
    - No auto-refresh / staleness indicator
    - Skeleton is good but could match card layout better
14. HIERARCHY IMPROVEMENTS:
    - Add icons to each KPI card
    - Make pending requests and pending reviews visually prominent (larger,
      or use semantic-warning background when count > 0)
    - Make recent list items clickable (Link to detail)
    - Add "最後更新: {time}" at top
    - Consider: highlight row for abnormal alerts count > 0
15. COMPONENTS: StatBlock (with icon), Card, ListItem (clickable),
    SectionHeader, LoadingState (skeleton), ErrorState
16. CHECKLIST:
    [ ] KPI cards have icons
    [ ] Action-required KPIs visually highlighted when > 0
    [ ] Recent items are clickable links
    [ ] Skeleton matches final layout shape
```

### 8.19 ADMIN — Service Request List

```
1. PAGE NAME: Service Request Management — List
2. ROLE: Admin
3. PAGE GOAL: Triage and manage all service requests
4. USER INTENT: "Which requests need my attention?"
5. PRIMARY CTA: Click row → go to detail
6. SECONDARY CTA: Filter controls
7. INFORMATION HIERARCHY:
   - T1: Status + category (what and where in pipeline)
   - T2: Recipient + date (who and when)
   - T3: Location + created date
8. MODULES: Filter bar → Table → Pagination
9. DATA: GET /service-requests (paginated + filtered)
10. EDGE CASES: No results for filter, many pages, long location text
11. STATES: Standard
12. TRUST: Status must be accurate and up-to-date.
13. UX ISSUES:
    - Only one filter (status dropdown). Spec requires: status + category +
      provider + search
    - No search functionality
    - Table truncates location with max-w-xs — might hide important info
    - Status badge colors differ slightly from mobile (admin uses Tailwind
      100/800, mobile uses custom hex)
    - Pagination shows "共 X 筆" but page size isn't selectable
14. HIERARCHY IMPROVEMENTS:
    - Add multi-filter bar: status dropdown + category dropdown + search input
    - Unify status colors with shared constants
    - Add row hover highlight for scan-ability
    - Consider adding "days waiting" column to identify stale requests
    - Highlight rows for requests in submitted/screening status (action needed)
15. COMPONENTS: Table, StatusPill, Pagination, FilterBar (new), SearchInput,
    EmptyState, LoadingState, ErrorState
16. CHECKLIST:
    [ ] Multi-dimension filtering
    [ ] Search input
    [ ] Status colors from shared constants
    [ ] Row click navigates to detail
    [ ] Empty state for no results
```

### 8.20 ADMIN — Service Request Detail

```
1. PAGE NAME: Service Request Detail
2. ROLE: Admin
3. PAGE GOAL: Review request, propose candidate, advance status
4. USER INTENT: "Let me review this and take the next step"
5. PRIMARY CTA: Status action buttons (context-dependent)
6. SECONDARY CTA: Propose candidate
7. INFORMATION HIERARCHY:
   - T1: Current status + available actions
   - T2: Basic request info
   - T3: Provider info + confirmation status + admin notes
8. MODULES: Header (back + title + status) → 2-col grid: Left (basic info) +
   Right (provider + actions)
9. DATA: GET /service-requests/:id, GET /providers (for dropdown),
   PUT /service-requests/:id/status, PUT /propose-candidate
10. EDGE CASES: All action states (9 statuses × available transitions)
11. STATES: Standard + action in progress
12. TRUST: Actions must have clear labels and confirmations.
13. UX ISSUES:
    - Action buttons use generic confirmation (no consequence description)
    - Propose candidate dropdown shows all approved providers without context
      (specialty, area match)
    - Confirmation indicators (✓/○) are plain Unicode, not styled
    - Admin notes textarea is small (3 rows)
    - No timeline of status transitions
    - Many action buttons can appear simultaneously — visual noise
14. HIERARCHY IMPROVEMENTS:
    - Add status timeline in left column (below basic info)
    - Group actions logically: advance forward (primary colors) vs. return/
      cancel (secondary/danger)
    - Provider dropdown: show specialty + level + area for each option
    - Expand admin notes textarea (5 rows)
    - Styled confirmation indicators with green checkmark / gray circle icons
    - Add breadcrumb: Dashboard > 需求單管理 > #ID
15. COMPONENTS: Card, InfoRow, StatusPill, Timeline, ConfirmDialog, ButtonPrimary,
    ButtonDanger, Select (provider dropdown), Textarea, Breadcrumb
16. CHECKLIST:
    [ ] Status timeline visible
    [ ] Action buttons grouped by intent
    [ ] Provider dropdown shows specialty/level
    [ ] Confirmation status uses styled indicators
    [ ] All actions have ConfirmDialog
```

### 8.21 ADMIN — Provider Management

```
1. PAGE NAME: Provider List + Detail
2. ROLE: Admin
3. PAGE GOAL: Review and manage service providers
4. USER INTENT: "Which providers need review? Let me approve/reject."
5. UX ISSUES:
   - Only one filter (review status) — spec requires level + availability too
   - Detail page requires scrolling to reach review actions
   - Approve/suspend buttons are enabled even when already in that state
   - No "new provider" creation form (spec mentions it)
   - Specialty/area tags on detail page are small and low-contrast
7. IMPROVEMENTS:
   - Add multi-filter: review status + level + availability
   - Disable buttons for current state (already implemented — verify)
   - Increase tag size and contrast on detail page
   - Move review actions higher (before specialties/areas, or sticky)
8. COMPONENTS: Table, StatusPill, FilterBar, Card, InfoRow, Chip (tags),
   ButtonPrimary (approve), ButtonDanger (suspend), Textarea, ConfirmDialog
```

### 8.22 ADMIN — Recipients Overview

```
1. PAGE NAME: Recipients Overview
2. ROLE: Admin
3. PAGE GOAL: View all care recipients on the platform
4. USER INTENT: "Who is being cared for and are there any issues?"
5. UX ISSUES:
   - **Missing measurement data** — spec requires latest BP, BG, and abnormal
     readings. Currently only shows basic info.
   - No search functionality
   - Read-only table but no click-to-expand for details
   - No caregiver name shown (spec mentions it)
7. IMPROVEMENTS:
   - Add columns: caregiver name, latest BP, latest BG, latest abnormal
   - Add search input
   - Add row click → expand drawer/modal showing recent measurements
   - Highlight rows with recent abnormal readings
8. COMPONENTS: Table, Chip (medical tags), SearchInput, Pagination,
   Drawer/Modal (measurement detail), StatusPill
```

### 8.23 ADMIN — Service Categories

```
1. PAGE NAME: Service Category Management
2. ROLE: Admin
3. PAGE GOAL: View and toggle service categories
4. USER INTENT: "Are all categories configured correctly?"
5. UX ISSUES:
   - Inactive rows have opacity 0.6 — subtle but functional
   - Toggle button styling is fine
   - No add/edit capability (only toggle active/inactive)
   - Description column may truncate
7. IMPROVEMENTS:
   - Add tooltip or expandable row for long descriptions
   - Consider adding edit capability for name/description (Phase 2)
   - Show service request count per category (helpful context)
8. COMPONENTS: Table, StatusPill, ButtonSecondary (toggle), EmptyState
```

---

## PART 9 — Refinement Roadmap

### Phase 0: Foundation (Do Before Any Page Work)
**Estimated scope: ~2-3 days**

1. Create `apps/mobile/lib/theme.ts` — export all design tokens (colors, typography, spacing, radius, shadows)
2. Create `apps/web/lib/theme.ts` — export Tailwind class mappings for consistent reference
3. Create `packages/shared/src/constants/status-display.ts` — unified status labels + colors for all 9 service request statuses + 3 AI statuses + 3 provider review statuses
4. Build shared mobile components:
   - `apps/mobile/components/ui/Card.tsx`
   - `apps/mobile/components/ui/StatusPill.tsx`
   - `apps/mobile/components/ui/Chip.tsx`
   - `apps/mobile/components/ui/EmptyState.tsx`
   - `apps/mobile/components/ui/ErrorState.tsx`
   - `apps/mobile/components/ui/LoadingState.tsx`
   - `apps/mobile/components/ui/Toast.tsx`
   - `apps/mobile/components/ui/InfoRow.tsx`
   - `apps/mobile/components/ui/SectionHeader.tsx`
   - `apps/mobile/components/ui/ConfirmDialog.tsx`
   - `apps/mobile/components/ui/ButtonPrimary.tsx`
   - `apps/mobile/components/ui/ButtonSecondary.tsx`
   - `apps/mobile/components/ui/ButtonDanger.tsx`
   - `apps/mobile/components/ui/PageHeader.tsx`
5. CI must pass after foundation: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

### Phase 1: High-Impact Pages (~5-7 days)

| Order | Page | Key Changes |
|-------|------|-------------|
| 1.1 | Home Dashboard | Apply Card/StatusPill, move logout, replace emoji, skeleton loading |
| 1.2 | Add Measurement | Toast replaces Alert, range hints, recipient name in header |
| 1.3 | Health Trends | **Add line chart**, collapsible daily table, unified stats |
| 1.4 | AI Report | Decompose file, styled disclaimer, rate limit banner, unified StatusPill |
| 1.5 | Recipient Detail | Section grouping, edit in header, InfoRow, icon quick actions |
| 1.6 | Service Request Detail (Mobile) | Timeline, action card prominence, ConfirmDialog |
| 1.7 | Patient Summary | Contextual labels, softer language, larger text, unified colors |
| 1.8 | Provider Task List | Status filter chips, urgency indicators |
| 1.9 | Provider Task Detail | Toast, sticky action button |
| 1.10 | Admin Dashboard | Icons on KPI, clickable recent items, highlight action KPIs |
| 1.11 | Admin Service Request Detail | Timeline, grouped actions, provider dropdown context |

### Phase 2: Completeness (~4-5 days)

| Order | Page | Key Changes |
|-------|------|-------------|
| 2.1 | Login | Role-neutral subtitle, error position |
| 2.2 | Register | Unified styling |
| 2.3 | Notifications | Vector icons, tap-to-navigate, remove floating back button |
| 2.4 | Appointments | Section split, unified background |
| 2.5 | Add Appointment | Unified styling |
| 2.6 | New Service Request | Confirmation dialog, inline validation |
| 2.7 | Service Request List (Mobile) | Status filter chips |
| 2.8 | Export | Unified styling |
| 2.9 | Patient Schedule | Structured grouping, unified styling |
| 2.10 | Provider Profile | Toast on availability change, unified InfoRow |
| 2.11 | Provider Confirm | Unified styling |
| 2.12 | Admin Service Request List | Multi-filter, search |
| 2.13 | Admin Provider List | Multi-filter |
| 2.14 | Admin Provider Detail | Unified styling |
| 2.15 | Admin Recipients | Add measurement columns, search |
| 2.16 | Admin Service Categories | Minor polish |
| 2.17 | Profile/Settings Page (new) | New page for caregiver (name, email, logout, reminders) |

### Deferred

- Tab route physical separation (cosmetic architecture, not UX-impacting)
- Admin responsive sidebar
- File/document upload for providers
- Admin new-provider creation form
- Animated page transitions
- DatePicker component (use text input with validation for now)
- Push notifications

---

## PART 10 — Immediate Next Actions

### For Engineering:

1. **Create `apps/mobile/lib/theme.ts`** with all design tokens from Section 3. This is the single most impactful file to create — it becomes the source of truth that all component refactors reference.

2. **Create `packages/shared/src/constants/status-display.ts`** extracting `STATUS_CONFIG` from `services/index.tsx` (mobile) and `STATUS_LABELS` from `service-requests/page.tsx` (admin) into one shared file. Both platforms import from here.

3. **Build the mobile `Toast` component** — this unblocks replacing `Alert.alert` across 8+ screens, which is the single biggest interaction quality win.

4. **Build the mobile `Card` component** — wrapping the current inline card styles into a reusable component with consistent border + radius + shadow + padding.

5. **Build the mobile `StatusPill` component** — consuming status colors from the shared constants file.

6. After these 5 items are in place, begin Phase 1 page polish starting with **Home Dashboard** (highest-visibility) and **Health Trends** (highest-gap — missing chart).

### For Design Review:

1. Validate the unified color palette (Section 3.1-3.4) against actual device screenshots. Ensure sufficient contrast ratios.
2. Review the AI report trust language — confirm that "建議就醫" styling is calm enough.
3. Review patient typography sizes — confirm readability for older users.
4. Sign off on the chart style for trends (line chart with abnormal zone shading).

### Guiding Rule:

**Standardize components first, then apply to pages.** Do not start redesigning individual pages before the shared components exist. Every page that gets polished without shared components creates new technical debt.

---

*End of Refinement Framework v1.0*
