---
## PLAN 3 — FIX COMPARE DASHBOARD REGION BUTTONS LAYOUT

### Standing Directive
You are working on HealthWatch — a Philippine regional dengue forecasting system. Frontend is React 19 + Tailwind CSS 4 + Radix UI (shadcn/ui pattern) + TanStack Router. Do not change business logic, data fetching, or routing. Only fix the visual layout of the Compare Dashboard region selector buttons. Read the component first, then fix.

### System Context
The Compare Dashboard page allows users to select multiple Philippine regions to compare their outbreak risk and forecast data side by side. The region selection buttons are currently broken in layout — they are squished into equal-width squares so the region name text is invisible or truncated. The user wants the buttons to be equal in SIZE (same height, same padding, same appearance) but properly sized to accommodate text — not forced into literal square shapes that hide the label.

### Item 4 — Fix Compare Dashboard Region Selector Buttons

**Step 1 — Locate the component.**
Find the Compare Dashboard page and its region selector (likely `src/pages/compare.tsx` or `src/components/compare/RegionSelector.tsx`). Read the full JSX and Tailwind class list for the buttons.

**Step 2 — Identify the layout bug.**
Common causes in Tailwind CSS 4 for this issue:
- `aspect-square` class applied to buttons, making width = height and crushing text.
- A grid container with `grid-cols-N` where N is too high and `auto-fit` or fixed column widths are squeezing buttons.
- `w-full` on buttons inside a flex container with `flex-wrap` and fixed `gap` that produces equal-width but tiny columns.
- Button text has `overflow-hidden` or `truncate` without enough width budget.
- `whitespace-nowrap` clashing with narrow button width.

**Step 3 — Apply the fix.**
The correct layout for these region buttons:
- Container: `flex flex-wrap gap-2` — let buttons wrap naturally.
- Each button: `px-3 py-2 text-sm font-medium rounded-md border transition-colors` — same padding/height for visual consistency, width determined by content.
- Remove any `aspect-square`, `w-full` (on individual buttons inside flex-wrap), or fixed `w-[Xpx]` that's too narrow.
- Selected state: `bg-primary text-primary-foreground border-primary`
- Unselected state: `bg-background text-foreground border-border hover:bg-accent`
- The 18 Philippine regions should all be readable. Test with the longest region name: "Autonomous Region in Muslim Mindanao" (BARMM) — if this fits, all others will.
- If a region abbreviation/code is used instead of full name, ensure the tooltip or aria-label shows the full name.

**Step 4 — Verify interactive behavior.**
- Clicking a region button should toggle its selected state.
- At least 2 regions must be selectable for comparison.
- The Compare Dashboard's chart/table below should update when button selection changes.
- Do not break the existing selection logic — only fix the visual classes.

**Step 5 — Responsive check.**
On mobile (< 640px), the buttons should still wrap cleanly. If the current layout breaks on mobile, add `text-xs px-2 py-1` via a responsive prefix: `sm:text-sm sm:px-3 sm:py-2`.