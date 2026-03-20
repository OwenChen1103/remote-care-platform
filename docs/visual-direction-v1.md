# Visual Direction / UI Style Exploration v1

> For: Remote Care Platform — Sprint B/C/D page polish guidance
> Built on: Sprint A foundation (theme.ts, status-display.ts, Card/StatusPill/EmptyState/ErrorState/Toast)
> Source of truth: implementation-spec.md, implementation-plan.md

---

## PART 1 — Visual Direction Summary

This product serves four roles across a care coordination workflow. The visual direction must accomplish one thing above all: **make health data feel safe to look at**.

Families checking on elderly relatives at 11pm should not feel anxious when they open the app. Admins triaging 30 service requests should be able to scan without fatigue. Providers should see their next task in under 2 seconds. Patients should never feel confused by what they see.

The visual direction is: **Soft Structure**. A structured, information-architecture-first UI layered with soft, warm surface treatments that prevent the clinical coldness of typical health dashboards. Not playful, not decorative — structured and softened.

### Core visual idea

The app should feel like a well-organized notebook, not a hospital monitor. Every element has a clear place. The surfaces are warm white, not cold white. The hierarchy is clear enough that you never have to search for the important thing — it finds your eye.

---

## PART 2 — Style Keywords and Anti-Keywords

### Style Keywords (what the product should feel like)

| Keyword | What It Means in Practice |
|---------|--------------------------|
| **Calm** | Low-contrast backgrounds. No saturated colors on large surfaces. Status colors only appear on small pills/badges, never as full-card backgrounds. |
| **Structured** | Every page has visible sections. Content is grouped with section headers. White space separates groups, not decorative elements. |
| **Readable** | Body text ≥14px on mobile. Line height ≥1.5x for multi-line content. Labels in muted gray, values in near-black. |
| **Warm** | Background is warm gray (#F9FAFB), not cold gray (#F0F0F0). White surfaces are true white (#FFFFFF), creating a gentle lift against the warm background. |
| **Trustworthy** | Consistent patterns. Same card looks the same everywhere. Status badges never change meaning. Blue means interactive. Green means good. Red means attention needed. |
| **Supportive** | Empty states offer guidance. Errors offer retry. Loading shows progress. The UI never leaves the user in a dead-end. |
| **Efficient** | For admin/provider roles: higher density, less padding, more rows visible. Information is scannable, not just readable. |

### Anti-Keywords (what the product must NOT feel like)

| Anti-Keyword | What to Avoid |
|-------------|---------------|
| **Clinical** | No harsh white backgrounds. No all-caps labels. No monospaced data displays. No cold blue-on-white dashboards. |
| **Playful** | No emoji as primary UI elements (acceptable in notification type indicators only per current implementation). No rounded cartoon icons. No bouncy animations. |
| **Dense-consumer** | No Instagram-style stacked feeds. No infinite scroll without structure. No bottom sheets stacked on bottom sheets. |
| **Enterprise-gray** | No gray-on-gray-on-gray. No tiny 11px body text. No overwhelming toolbar ribbons. |
| **Alarming** | No flashing red elements. No "DANGER" styling on health data. Abnormal readings use warm amber and soft red backgrounds, not saturated alarm red. |
| **Decorative** | No gradient backgrounds. No patterned surfaces. No decorative illustrations. No empty-space-filling artwork. |

---

## PART 3 — Color and Surface Language

### Color Mood

The product's color mood is **blue-anchored neutral with semantic accents**.

- **Blue** is the only "brand" color. It appears on: primary buttons, active navigation, interactive links, and the info status family. It signals "you can tap this" or "this is active."
- **Gray** is the foundation. Background, borders, labels, timestamps, disabled states — all gray. Gray is the resting state of the interface.
- **Semantic colors** (green/yellow/red) appear ONLY on status badges, measurement indicators, and small accent elements. They are never used as large surface fills.

### Color Usage Hierarchy

```
Most area:    #F9FAFB (screen background — warm light gray)
              #FFFFFF (card/surface — clean white)
              #F3F4F6 (surface alt — subtle grouping)

Mid area:     #E5E7EB, #D1D5DB (borders, dividers)
              #6B7280, #9CA3AF (secondary text, captions)

Least area:   #2563EB (primary blue — buttons, links, active states)
              Semantic colors (status pills, badges — small surface only)
```

**Critical rule**: Semantic colors (green, yellow, red, purple, cyan, orange) must NEVER fill an entire card or section background. They appear only on:
- StatusPill components (small pill badges)
- Left-border accent on measurement cards (4px wide)
- Small indicator dots (10px)
- AI status badge within the report card

This keeps the interface calm. The semantic color pops precisely because it's surrounded by neutral.

### Surface Language

The product uses three surface levels:

| Level | Mobile | Web Admin | Usage |
|-------|--------|-----------|-------|
| **Screen** | `#F9FAFB` | `bg-gray-50` | Page background. Everything sits on this. |
| **Surface** | `#FFFFFF` with 1px `#E5E7EB` border + `shadows.low` | `bg-white` with `border border-gray-200` | Cards, sections, form containers, table containers. |
| **Inset** | `#F3F4F6` | `bg-gray-100` | Inactive chips, code blocks, disabled input backgrounds, collapsed sections. |

**No fourth level.** There are no "elevated" surfaces floating above cards. Modals and toasts use `shadows.high` but are transient, not persistent layout elements.

**Card rule**: Every card gets BOTH border AND subtle shadow on mobile. The border provides structure in bright light. The shadow provides depth in low light. Neither alone is sufficient.

---

## PART 4 — Typography, Spacing, Radius, Shadow Direction

### Typography Feel

The product uses the system font stack (San Francisco on iOS, Roboto on Android, system sans-serif on web). This is deliberate — healthcare-adjacent products benefit from the familiarity and readability of the platform's native font.

**No custom fonts.** Custom fonts add loading time, increase bundle size, and risk rendering inconsistencies. The system font is already optimized for each platform's screen density and locale (Traditional Chinese renders beautifully in both SF and Noto Sans CJK).

**Typography hierarchy rule**: Only three visual levels should be distinguishable at a glance:

| Level | Mobile | Web Admin | When to Use |
|-------|--------|-----------|-------------|
| **Loud** | 20-24px, weight 700 | `text-2xl font-bold` | Page titles. Only one per screen. |
| **Medium** | 15-17px, weight 600 | `text-lg font-semibold` | Section headers, card titles, stat values. |
| **Quiet** | 13-14px, weight 400 | `text-sm` | Body text, descriptions, list content. |

Everything else (captions at 11-12px) is functionally invisible at first glance — timestamps, disclaimers, supplementary labels. This is correct. They should be findable but not competing for attention.

**CJK-specific**: Traditional Chinese characters are visually denser than Latin characters at the same font size. This means:
- Body text should be 14px minimum (never 12px for readable content)
- Line height should be at least 1.5x (21px for 14px text)
- Labels can be 12-13px because they are short (1-4 characters)

### Spacing Rhythm

The product uses a 4px base grid, but the *felt rhythm* is defined by three spacing zones:

| Zone | Value | Usage |
|------|-------|-------|
| **Tight** | 4-8px | Inside compact elements: between icon and label, between badge text and badge edge, between list item details. |
| **Comfortable** | 12-16px | Inside cards (card padding), between card sections, form field gaps. This is the dominant rhythm. |
| **Breathing** | 20-32px | Between major page sections, above/below page titles, between card groups. |

**Caregiver/Patient mobile**: Use generous Comfortable spacing. Cards breathe.
**Provider mobile**: Slightly tighter Comfortable (12px padding instead of 16px). Cards are denser.
**Admin web**: Standard Comfortable (p-6 for cards, gap-6 between sections). Tables use Tight cell padding for scan density.

### Radius Direction

| Element | Radius | Why |
|---------|--------|-----|
| Cards, sections, modals | 12px (`radius.md`) | Softens the box feel without looking bubbly. |
| Inputs, small buttons | 8px (`radius.sm`) | Functional, tappable, not playful. |
| Status pills, chips | 16px (`radius.lg`) | Pill-shaped — clearly badges, not buttons. |
| Circular indicators | 9999px (`radius.full`) | Notification dots, avatar placeholders. |

**No fully-rounded buttons.** Buttons use 8-12px radius, not pill-shaped. Pill-shaped is reserved for non-interactive badges. This distinction helps users distinguish "I can tap this to do something" (rectangular-ish) from "this is showing me a status" (pill-shaped).

### Shadow Direction

Shadows in this product should be **barely noticeable** — they exist to create depth separation between surface levels, not to create visual drama.

| Level | Appearance | Usage |
|-------|-----------|-------|
| `shadows.low` | 1px soft drop, opacity 0.06 | All cards. Persistent, subtle. |
| `shadows.high` | 2px drop, opacity 0.15 | FAB, toast, modal. Transient, noticeable. |

**No inner shadows.** No colored shadows. No large diffuse shadows. The shadow language is strictly utilitarian.

On admin web: shadows are even less important because border-defined cards are the norm. Use `shadow-sm` sparingly (only on hover for clickable cards).

---

## PART 5 — Component Style Direction

### Cards

- **Default state**: White background, 1px gray-200 border, 12px radius, 16px padding, low shadow.
- **Pressed/hover state**: Very subtle — background shifts to `#F9FAFB` (screen color). No scale transform. No border color change.
- **Selected state** (for multi-select scenarios only): 2px blue border replaces 1px gray border. No background change.
- **Cards should NOT** have colored backgrounds, colored borders (except left-accent for measurements), or varying radius.

### Status Pills / Badges

- **Shape**: Pill (radius-lg), horizontal padding 10px, vertical padding 3px.
- **Text**: 12px, weight 500. Legible but clearly subordinate to card titles.
- **Colors**: Always from status-display.ts. Light tinted background + darker tinted text of the same hue. Never outline-only — the filled background provides scan speed.
- **Position**: Top-right of a card header row (aligned with card title on the left). Never floating, never overlapping.

### Chips (Selection)

- **Inactive**: `#F3F4F6` background, `#374151` text. Quiet, recessive.
- **Active**: `#DBEAFE` background, `#1D4ED8` text, weight 600. Clearly selected.
- **Shape**: 16px radius (pill-like), 14px horizontal padding, 8px vertical padding.
- **Never mix chip colors** in the same selector row. All chips in a set use the same active/inactive pair. Color differentiation is for status badges only.

### Tags (Display-Only)

Medical condition tags on recipient cards:
- **Style**: `#DBEAFE` background, `#1D4ED8` text, 12px font, pill-shaped.
- **Purpose**: Quick scan identification. "This person has 高血壓 and 糖尿病."
- **Never interactive.** Tags do not have tap handlers.

### Buttons

| Type | Style | Usage |
|------|-------|-------|
| **Primary** | Solid `#2563EB` background, white text, 12px radius, 14px vertical padding | One per screen. The main action. |
| **Secondary** | `#DBEAFE` background, `#1D4ED8` text, same size | Supporting actions (share, export). |
| **Danger** | `#FEE2E2` background, `#DC2626` text, same size | Cancel, reject, delete. Always with confirmation. |
| **Ghost** | Transparent background, `#2563EB` text, no border | Inline links, "查看更多", "重試". |

**Button rule**: Primary button is always the lowest element in a form/action area (visually and in scroll order). Users scan top-to-bottom; the action is the conclusion.

### Form Inputs

- **Resting**: White background, 1px `#D1D5DB` border, 8px radius, 12px padding, 16px font.
- **Focused**: Border becomes `#2563EB`, optional 1px ring in `#DBEAFE`.
- **Error**: Border becomes `#DC2626`, error text appears below in 12px `#DC2626`.
- **Label**: Always above the input (never placeholder-only). 14px, weight 600, `#374151`.
- **Spacing**: 16px between form fields. 8px between label and input.
- **Textarea**: Same border treatment. Min-height 80px. Top-aligned text.

### Tables (Admin Only)

- **Container**: White background, 1px gray-200 border, 12px radius, no shadow.
- **Header row**: `#F9FAFB` background, 13px weight 500 text in `#374151`. Sticky on scroll.
- **Body rows**: White background, 1px divider between rows. 14px text.
- **Row hover**: Background shifts to `#F9FAFB`.
- **No zebra striping.** Zebra striping adds visual noise without sufficient benefit for tables under 50 rows.
- **Cell density**: `px-4 py-3` for standard tables. `px-3 py-2` for dense tables (admin recipients).
- **Action links**: `#2563EB` text with underline on hover. Never styled as buttons within table rows.

### Section Headers

- **Mobile**: 15px, weight 600, `#374151`. No border, no background. Just text + breathing space above (20px margin-top) and tight space below (8px margin-bottom).
- **Admin**: `text-lg font-semibold text-gray-900` with `mb-4`. Optional right-aligned action link.

---

## PART 6 — Role-Specific Visual Density Model

### Caregiver — Comfortable, Reassuring

| Aspect | Specification |
|--------|--------------|
| **Card padding** | 16px |
| **Card gap** | 12px |
| **Section breathing** | 24px |
| **Body font** | 14px |
| **Heading font** | 20px (page), 17px (section) |
| **Cards per screen** | 2-3 fully visible |
| **Primary color usage** | Frequent — FAB, action buttons, navigation |
| **Emotional cue** | "Everything is organized. Here's what needs your attention." |

Caregiver pages prioritize **overview + action**. The home screen should show enough at a glance to answer "Is everyone okay?" without tapping in. Cards are generous, text is readable, and the primary action (add measurement, submit request) is always reachable.

### Patient — Spacious, Simple

| Aspect | Specification |
|--------|--------------|
| **Card padding** | 20px |
| **Card gap** | 16px |
| **Section breathing** | 32px |
| **Body font** | 15-16px |
| **Heading font** | 22px (page), 17px (section) |
| **Cards per screen** | 1-2 fully visible |
| **Primary color usage** | Minimal — no action buttons, no FAB |
| **Emotional cue** | "Here's how you're doing. Everything is clear." |

Patient pages are **deliberately sparse**. Larger text, larger spacing, fewer elements per screen. No interactive controls. The patient should never feel overwhelmed. Value labels should include plain-language context ("血壓正常" next to the number).

### Provider — Compact, Task-Focused

| Aspect | Specification |
|--------|--------------|
| **Card padding** | 14px |
| **Card gap** | 10px |
| **Section breathing** | 16px |
| **Body font** | 14px |
| **Heading font** | 18px (page), 16px (section) |
| **Cards per screen** | 3-4 fully visible |
| **Primary color usage** | Action-oriented — "開始服務", "完成服務" buttons prominent |
| **Emotional cue** | "Here are your tasks. Here's what to do next." |

Provider pages are **workstation-style**. Task cards show the essential information (what, where, when, status) without wrapping text. The next required action is the most visible element in each card. No decorative content.

### Admin — Dense, Structured

| Aspect | Specification |
|--------|--------------|
| **Card padding** | 24px (stat cards), table padding per cell |
| **Grid gap** | 16-24px |
| **Section breathing** | 24-32px |
| **Body font** | 14px (Tailwind `text-sm`) |
| **Heading font** | 24px page title, 18px section |
| **Rows per screen** | 8-10 visible table rows |
| **Primary color usage** | Action buttons in detail pages. Stat card accent colors. |
| **Emotional cue** | "Here's the full picture. Filter to find what you need." |

Admin pages are **operational dashboards**. Tables are the primary layout pattern. Filters sit above tables. Stat cards use colored number text (not colored backgrounds) to differentiate KPIs. Detail pages use 2-column grids with info on the left and actions on the right.

---

## PART 7 — Key Screen Visual Standards

### 7.1 Caregiver Home Dashboard

**Visual purpose**: Reassurance overview — "Are my family members okay?"

**Hierarchy model**:
1. **Greeting + notification indicator** (top, lightweight)
2. **Recipient cards** (primary — 80% of screen area)
3. **FAB** (floating, persistent access to add)

**Dominant UI blocks**: Recipient Card. Each card is the star of this page.

**Density target**: 2 recipient cards fully visible at once. Third card peeking.

**Emotional tone**: Organized calm. Like opening a well-kept family health notebook.

**What should visually stand out**:
- Recipient name (17px weight 600)
- AI status indicator (small pill in top-right of card: 穩定/需注意/建議就醫)
- Medical tags (small pills below name)

**What should be visually de-emphasized**:
- Age calculation (small text next to name)
- AI summary text (body font, secondary color)
- Report date (caption, tertiary color)
- Notification badge count (small, red — visible but not dominant)

**Style cues**:
- Each recipient card should have a subtle left-border accent colored by AI status (4px wide, green/yellow/red) as a rapid visual scan indicator
- Card header area (name + tags) separated from summary area by a hairline divider
- Bell icon replaces emoji with vector icon, sized 20px

### 7.2 Caregiver Service Request Status

**Visual purpose**: Pipeline tracker — "Where is my request in the process?"

**Hierarchy model**:
1. **Current status** (large pill at top)
2. **Key info** (category, recipient, date — structured rows)
3. **Action area** (confirm/reject when applicable — prominent)
4. **Timeline** (chronological status history — scrollable)

**Density target**: Status + key info visible without scrolling. Timeline below fold is acceptable.

**Emotional tone**: Transparent process. "We're handling this. Here's exactly where things stand."

**What should visually stand out**:
- The current status pill (larger than usual: 14px text, more padding)
- Action-needed indicator when caregiver must confirm candidate (yellow-tinted action card)
- Assigned provider name (when available)

**What should be de-emphasized**:
- Location, description (secondary info rows)
- Admin notes (if shown, in muted section)
- Cancel button (bottom of page, danger-light style, not prominent)

**Style cues**:
- Timeline uses vertical line (2px, `#E5E7EB`) with small colored dots per status transition
- Each timeline node: status label + timestamp on the right
- Action card (when applicable) uses `#FEF9C3` (warm yellow) background to attract attention without alarming

### 7.3 Patient Summary

**Visual purpose**: Personal health glance — "How am I doing?"

**Hierarchy model**:
1. **Profile card** (name + conditions — grounding identity)
2. **Latest readings** (big numbers — the most important data)
3. **7-day mini chart** (visual trend — secondary)
4. **Measurement history** (detailed list — tertiary)

**Density target**: Profile + latest readings fill the first screen. User scrolls for history.

**Emotional tone**: Calm clarity. Like checking a bathroom scale, not reading a lab report.

**What should visually stand out**:
- Latest BP and BG values (20px, weight 700)
- Contextual label next to each reading ("血壓正常" in green text, or "血壓偏高，請留意" in amber)

**What should be de-emphasized**:
- Stat counts ("近期量測數")
- Measurement timestamps (caption text)
- Section headers (minimal, just text)

**Style cues**:
- Reading cards use larger padding (20px) and larger value text than caregiver equivalents
- No interactive elements whatsoever — even pull-to-refresh should feel like the only gesture available
- Contextual health labels ("正常" / "偏高，請留意") use 13px text in semantic color next to the value, never as a separate badge

### 7.4 Provider Task List / Task Detail

**Visual purpose**: Work queue — "What's my next job?"

**Hierarchy model (list)**:
1. **Filter chips** (top — arranged/in_service/completed)
2. **Task cards** (vertical list — each card is one assignment)

**Hierarchy model (detail)**:
1. **Status + action button** (top — what to do next)
2. **Case info** (structured rows — what, where, when, who)
3. **Notes input** (when applicable — bottom of page)

**Density target (list)**: 3-4 task cards visible. Each card is compact — 3 lines of text max.

**Density target (detail)**: Status + info visible without scrolling. Action button always visible (consider sticky bottom).

**Emotional tone**: Professional workstation. No emotional language. Just facts and actions.

**What should visually stand out (list)**:
- Status pill on each card (the first thing scanned)
- Date proximity indicator (tasks within 3 days get warm amber date text)
- Category name (what kind of service)

**What should be de-emphasized**:
- Location (third line, tertiary color)
- Description (hidden on list cards, shown on detail only)

**Style cues**:
- Task cards are slightly more compact than caregiver cards (14px padding vs 16px)
- Action button on detail page is the most visually prominent element — full-width, solid color, 16px text
- "開始服務" = amber/orange primary, "完成服務" = green primary. Status-appropriate button colors.

### 7.5 Admin Dashboard

**Visual purpose**: Operational overview — "What needs my attention?"

**Hierarchy model**:
1. **KPI stat cards** (3-column grid — numbers at a glance)
2. **Action-needed lists** (pending requests, abnormal alerts — items requiring triage)

**Density target**: All 6 KPI cards + first 2-3 list items visible on a 1080p screen without scrolling.

**Emotional tone**: Control tower. Calm but information-rich.

**What should visually stand out**:
- KPI numbers with values > 0 that require action (pending requests, pending reviews)
- KPI numbers use domain-colored text (blue for caregivers, green for recipients, orange for pending, red for abnormal)

**What should be de-emphasized**:
- KPI labels (small text below numbers)
- Timestamps on list items
- "查看全部" links (subtle, blue text)

**Style cues**:
- KPI cards: white background, border, NO background fill. Number is the hero element (text-3xl font-bold). Label is small gray text below.
- When a KPI count is > 0 and actionable (pending requests, pending reviews, abnormal alerts): add a very subtle warm tint to the card background (`#FFFBEB` for warning-adjacent, `#FEF2F2` for danger-adjacent). This creates an "attention needed" signal without being alarming.
- List items are clickable. Hover background shift on web. Each item shows: category/title + timestamp right-aligned.

### 7.6 Admin Service Request List

**Visual purpose**: Work queue — "Which requests need action?"

**Hierarchy model**:
1. **Filter bar** (top — multi-dimension filtering)
2. **Table** (primary content — sortable, paginated)
3. **Pagination** (bottom — page navigation)

**Density target**: 8-10 visible rows. Columns: status, category, recipient, date, location (truncated), created, action link.

**Emotional tone**: Operational efficiency. Like a well-organized spreadsheet.

**Style cues**:
- Filter bar: horizontal row of dropdowns + search input, separated from table by 16px gap
- Table header: sticky, `#F9FAFB` background, 13px weight 500
- Status column: uses StatusPill component (small, colored, pill-shaped)
- Row hover: `#F9FAFB` background
- "查看" action link: blue text, right-aligned column
- Truncated columns (location, description): use `max-w-xs truncate` with title tooltip

### 7.7 AI Report Page

**Visual purpose**: Health intelligence — "What does AI think about my family member's health?"

**Hierarchy model**:
1. **Recipient selector** (top — who are we looking at?)
2. **Current report card** (primary — the AI's assessment)
3. **Action button** (generate/refresh)
4. **History** (past reports — scrollable, below fold)

**Density target**: Selector + full report card visible on first screen. History below fold.

**Emotional tone**: Thoughtful advisor. Like reading a well-written note from a health consultant, not a diagnostic machine readout.

**What should visually stand out**:
- AI status pill (穩定/需注意/建議就醫) — larger than typical pills (14px text, 12px radius, generous padding)
- Summary sentence (16px, weight 400, line-height 24px — the most readable text on the page)
- "更新近況" button (primary blue, full-width)

**What should be de-emphasized**:
- Reason/suggestion bullet lists (body text, secondary color)
- Disclaimer (11px, gray, top-border separator — visible but clearly subordinate)
- History cards (compact, muted)
- "更多功能" expand toggle (ghost text)

**Style cues**:
- Report card has slightly more padding than typical cards (20px) to give the AI content breathing room
- AI status pill sits in the report card header next to recipient name, right-aligned
- Bullet lists use `•` prefix, not numbered. Each bullet is a complete sentence.
- Disclaimer container: separated by hairline, uses 11px gray italic. This is correct as-is. Do not make it more prominent (that would increase anxiety) or less prominent (that would violate spec G.2.7).
- Rate limit message: Use info-blue banner (`#DBEAFE` bg, `#1D4ED8` text), not error-red. Being rate-limited is not an error.

---

## PART 8 — Chart / AI / State UI Style Direction

### Chart Style (for trends page — Sprint B CG-01)

**Overall feel**: Clinical-neutral. Not playful (no rounded line caps, no gradient fills under curves). Not harsh (no stark grid lines). Informative and clean.

**Line chart specifications**:
- **BP chart**: Dual lines — systolic in `#2563EB` (primary blue), diastolic in `#60A5FA` (lighter blue). 2px line width. Dot markers at each data point (4px radius).
- **BG chart**: Single line in `#2563EB`. Same line width and markers.
- **Abnormal zone**: Horizontal band in `#FEE2E2` (danger-light) at 10% opacity spanning the abnormal threshold range. Subtle — like a faint highlight, not a warning stripe.
- **Abnormal data points**: Dot marker changes to `#DC2626` (danger red) with 6px radius. This is the primary visual signal.
- **Grid**: Horizontal only. `#E5E7EB` at 0.5px. 4-5 gridlines. No vertical grid.
- **Axes**: X-axis shows dates (MM/DD format). Y-axis shows values. Labels in 11px, `#9CA3AF`.
- **Background**: White (`#FFFFFF`), matching the card surface it sits inside.
- **Tooltip on touch**: Show exact value + date in a small card-like tooltip near the touched point.

**What to avoid in charts**:
- No gradient fill under lines
- No animated line drawing on load
- No 3D effects
- No pie charts or bar charts (not in spec)
- No multi-colored segments within a single line

### AI Report Visual Treatment

- **Report card** is visually distinct from data cards — it uses 20px padding and the AI status pill is the only colored element.
- **Bullet lists** (reasons, suggestions) use `•` prefix, 14px body text, 22px line-height. Each item on its own line.
- **Disclaimer** is architecturally separate: hairline border-top, 10px padding-top, 11px gray italic text. It is the "footer" of the report card.
- **Share button**: Secondary style (`#DBEAFE` bg, blue text). Not prominent — sharing is optional, not the primary action.
- **Fallback state** (when AI fails): Same card layout, but content replaced with calm message. No error styling. Gray italic note: "（AI 暫時無法回應，以上為預設文字）".
- **Rate limit state**: Info banner above the generate button. Blue-tinted, not red. Message: "已達更新上限（每小時 3 次），請稍後再試".
- **Generating state**: Pulsing skeleton matching report card shape. Text below: "AI 正在分析健康數據..." in muted gray.

### Empty State Visual Treatment

- **Layout**: Centered in the available space. Vertical stack: title (15px weight 600) → description (13px, tertiary color, line-height 20px) → action button (optional, primary style).
- **Tone**: Guiding, not apologetic. "尚無量測紀錄" + "定期記錄血壓與血糖，有助於掌握健康狀況。" + [開始記錄]
- **No illustrations.** Empty states use text only. Illustrations add visual weight that competes with the guidance message and are difficult to maintain consistently.
- **Vertical position**: Centered vertically in the list area, not at the top. The centering creates a deliberate pause that communicates "this space is waiting to be filled."

### Loading State Visual Treatment

- **First load (list pages)**: 2-3 skeleton cards matching approximate card shape. Skeleton uses `#E5E7EB` background blocks with `animate-pulse`. Blocks approximate title line (60% width, 16px height) + detail lines (40% width, 12px height).
- **First load (detail pages)**: ActivityIndicator (system default) + muted text "載入中..." centered.
- **Refresh**: Pull-to-refresh spinner (system default). Do NOT clear existing content during refresh.
- **Action in progress**: Button text changes to "處理中..." with inline spinner. Button becomes disabled.

### Error State Visual Treatment

- **Layout**: Inline within the content area (not a modal, not full-screen). `#FEE2E2` background, `#DC2626` text, 12px radius, 12px padding.
- **Content**: Error message (human-readable) + retry button (primary blue).
- **Tone**: Factual and helpful. "載入失敗，請稍後再試" — not "Oops!" or "Something went wrong!".
- **Position**: Where the content would have been. If a section fails, only that section shows the error. Other sections remain functional.

---

## PART 9 — Premium Feel Guidelines

### What "Premium" Means for This Product

Premium in a healthcare-adjacent product does NOT mean:
- ~~luxury gradients~~
- ~~animated transitions~~
- ~~custom fonts~~
- ~~micro-interactions~~

Premium DOES mean:

1. **Consistency.** The same card looks the same on every page. The same status badge uses the same color everywhere. The same button size appears on every form. This communicates professionalism.

2. **Completeness.** Every possible state is handled: loading shows a skeleton, empty shows guidance, error shows retry, success shows confirmation. No blank screens. No mysterious spinners. No dead ends. This communicates care.

3. **Restraint.** The interface doesn't try to impress. It doesn't draw attention to itself. It draws attention to the health data, the task, the status. The UI is a lens, not a frame.

4. **Precision.** Spacing is consistent. Alignment is perfect. Text doesn't wrap awkwardly. Cards have equal height in a row. Borders meet cleanly. This is the most visible form of quality — and the easiest to get wrong.

5. **Confidence.** The interface makes clear decisions. One primary action per screen. Clear hierarchy. No "you might also want..." suggestions. No competing CTAs. The product knows what the user needs next.

### Implementation Checklist for "Premium"

- [ ] Every FlatList has a skeleton loading state (not just ActivityIndicator)
- [ ] Every FlatList has a guidance-oriented empty state (not just "尚無資料")
- [ ] Every form uses Toast for success feedback (not Alert.alert)
- [ ] Every destructive action uses ConfirmDialog with specific consequence description
- [ ] Every card uses the shared Card component (consistent border + shadow + radius)
- [ ] Every status badge uses the shared StatusPill component (consistent colors)
- [ ] Every page uses theme tokens (no hardcoded hex values)
- [ ] Every page has at most one primary button (the main action)
- [ ] No emoji used as UI icons (except notification type indicators where already established)
- [ ] Abnormal health values always pair color with text ("偏高" or "正常" — never color-only)

---

## PART 10 — Visual Mistakes to Avoid

| # | Mistake | Why It's Wrong | What To Do Instead |
|---|---------|---------------|-------------------|
| 1 | **Using saturated red for abnormal readings** | Causes anxiety. Families will panic seeing bright red numbers. | Use `#DC2626` only on small indicators (4px left border, small badge). The number itself stays in `textPrimary` with a contextual label in softer color. |
| 2 | **Multiple primary buttons on one screen** | User doesn't know what to do next. Visual noise. | One primary (solid blue) per screen. Other actions are secondary (light blue bg) or ghost (text-only). |
| 3 | **Cards with colored backgrounds** | Creates visual cacophony when multiple cards have different background colors. | Cards are always white. Color appears only on small elements inside: pills, left-border accents, indicator dots. |
| 4 | **Varying card styles on the same page** | Breaks the "one product" feel. Home cards with shadow, service cards with border — looks like two different apps. | All cards use the Card component. Same border, same shadow, same radius, same padding. |
| 5 | **Using color as the only differentiator** | Colorblind users cannot distinguish status. | Status pills always include text labels. Measurement indicators include text ("偏高") alongside color. |
| 6 | **Tiny text for important data** | Older caregivers and patients may struggle to read 11-12px values. | Health values: ≥18px. Body text: ≥14px. Only timestamps and disclaimers go below 13px. |
| 7 | **Alert.alert for success feedback** | Blocks the user. Requires a tap to dismiss. Interrupts flow. | Use Toast component. Auto-dismisses. Non-blocking. |
| 8 | **Empty states that only say "尚無資料"** | Teaches nothing. User doesn't know what to do. | Include what the missing data is, why it matters, and a single action button to begin. |
| 9 | **Admin tables without row hover** | Tables feel static and unresponsive. | Add `hover:bg-gray-50` to all table rows. Subtle but important for scan-ability. |
| 10 | **Logout in the header next to other actions** | Dangerous proximity to notification bell. One-tap catastrophe. | Move logout to a dedicated profile/settings page. |

---

## PART 11 — Implementation Notes for Sprint B/C/D

### What Sprint B Should Apply (Caregiver Pages)

1. **Replace all inline card styles** with `<Card>` component import. Remove per-page shadow/border/radius/padding definitions.
2. **Replace all inline STATUS_CONFIG** objects with `<StatusPill>` component importing from shared constants.
3. **Replace all `Alert.alert` success messages** with `Toast` component.
4. **Apply theme tokens** to all color, fontSize, spacing, and radius values. Search-and-replace hex values with theme references.
5. **Home page specific**: Add 4px left-border accent to recipient cards colored by AI status. Replace emoji bell with 20px icon. Move logout to profile.
6. **AI report specific**: Increase report card padding to 20px. Rate limit message uses info banner not error styling.
7. **Trends page**: When implementing chart, follow chart specs in Part 8. Dual-line for BP, single for BG. Minimal grid. White background inside card.

### What Sprint C Should Apply (Admin Pages)

1. **Import `tw` and `twLayout` from theme.ts** for all Tailwind class references.
2. **Import status display constants** from shared package. Replace per-page STATUS_LABELS objects.
3. **Dashboard**: Add domain-colored KPI numbers. Make recent items clickable with `<Link>`. Add subtle warm-tint to actionable KPI cards when count > 0.
4. **Table pages**: Add `hover:bg-gray-50` to all table rows. Sticky table headers where possible.
5. **Detail pages**: Use 2-column grid consistently. Info left, actions right. Breadcrumb at top.

### What Sprint D Should Apply (Patient Pages)

1. **Increase spacing** throughout patient pages. Card padding 20px. Section breathing 32px.
2. **Increase text sizes** for values (20px+). Add contextual health labels next to readings.
3. **Soften language**: "異常筆數" → "需留意的紀錄". "異常" → "偏高" / "偏低".
4. **Remove all interactive controls** that may have leaked in. Patient is strictly read-only.

### What Sprint E Should Apply (Provider Pages)

1. **Add filter chips** to task list per spec (arranged/in_service/completed).
2. **Tighten card density** — 14px padding, 10px gap.
3. **Date proximity indicators** — approaching dates (≤3 days) use `#A16207` (warning) text color.
4. **Action buttons** on task detail use status-appropriate colors: amber for "開始服務", green for "完成服務".

### Cross-Sprint Rule

Before touching any page file, verify it:
1. Imports from `@/lib/theme` (not hardcoded values)
2. Uses `<Card>` (not inline card styles)
3. Uses `<StatusPill>` (not inline status configs)
4. Uses `<Toast>` for success (not Alert.alert)
5. Uses `<EmptyState>` for empty lists (not plain text)
6. Uses `<ErrorState>` for errors (not inline red text)

If any of these are violated, fix them as part of the page's sprint task. Do not leave inconsistencies.

---

*End of Visual Direction v1*
