# HEALTHWATCH — Implementation Plan 5 of 8
**Item:** Global UI/UX Polish Pass
**Execute this plan fully before moving to Plan 6.**


---

## ⚠️ STANDING DIRECTIVE — READ BEFORE EXECUTING ANYTHING

DO NOT touch, refactor, rename, restructure, or rewrite any file, component, function, variable, route, API endpoint, database schema, model, or configuration that is not explicitly listed in this plan.

This system is a live academic research tool (HealthWatch) with a validated forecasting pipeline and a live deployment on Render. Any unrequested change risks breaking the Prophet pipeline, the Supabase connection, the walk-forward evaluation results, the PDF export, or the deployment itself.

The rule is: if it is not in this plan, do not touch it. If you are unsure whether something is in scope, do not touch it. Stop and flag it instead.

CRITICAL: Do not restructure any page's component tree. Do not rename or reorganize any file. Do not change any component's data fetching, state, or business logic. Only modify visual/styling properties: font sizes, font weights, spacing, padding, color contrast, border radii, and line heights within existing containers. This is a styling-only pass.

---

## SYSTEM CONTEXT

HealthWatch is a regional public health decision-support tool for Philippine LGUs and the DOH. It forecasts dengue case volumes per region using Facebook Prophet with a wet/dry seasonal regressor, classifies each of the 18 Philippine regions (+ National aggregate) as Low / Moderate / High risk using P50/P75 percentile thresholds, and presents findings through a dashboard, map, seasonality page, compare page, and export module.

**Tech stack (frontend):** React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS 4 + Recharts + Leaflet + React PDF Renderer + TypeScript 5.8

**DO NOT touch:** FastAPI backend, Prophet pipeline, SQLAlchemy models, Supabase/PostgreSQL config, classification algorithm, evaluation logic, CSV export, routing config, render.yaml, Leaflet map configuration, component tree structure, routing, state management.

---

## ITEM 8 — Global UI/UX Polish Pass

Execute the following sub-items in order: A → B → C → D → E → F.

---

### 8A — Typography Scale

**File:** The global CSS file (likely `src/index.css` or wherever CSS custom properties / Tailwind base styles are defined).

Find the `:root` block or the base styles section. Update or add the following font size custom properties. Do not remove any existing custom property — only update values or add new ones:

```css
:root {
  font-size: 16px; /* increase base from likely 14px */

  --font-size-xs:   0.75rem;    /* 12px — badges, fine print only */
  --font-size-sm:   0.875rem;   /* 14px — secondary labels */
  --font-size-base: 1rem;       /* 16px — body default */
  --font-size-md:   1.0625rem;  /* 17px — comfortable reading */
  --font-size-lg:   1.125rem;   /* 18px — section labels */
  --font-size-xl:   1.25rem;    /* 20px — card titles */
  --font-size-2xl:  1.5rem;     /* 24px — page titles */
  --font-size-3xl:  1.875rem;   /* 30px — hero numbers */
}
```

Apply `text-base` as the default body font size on the `body` selector if it is not already set.

Page titles (the main `<h1>` on each page): must be `text-2xl font-semibold` minimum.
Card titles: `text-xl font-semibold`.
Section labels: `text-lg font-medium`.
Body/table content: `text-base`.
Secondary labels above controls (FilterPanel labels): `text-sm font-medium`.
Badge/chip text: `text-xs`.

Do not make any existing text element smaller than it currently is. Only equal or larger.

---

### 8B — Color and Contrast

**Files:** Global CSS and any component that uses inline color values or non-standard color tokens.

Rules:
- Do not change the core brand palette
- Do not introduce any new color tokens
- Work only with what is already defined in the project

Corrections to make:
- Any body text or label using a gray token lighter than `gray-500` on a white or light background must be shifted to `gray-600` minimum to meet WCAG AA 4.5:1 contrast
- Risk tier badge colors must remain semantically unambiguous:
  - High risk: red family — do not soften to orange or pink
  - Moderate risk: amber/yellow family
  - Low risk: green family
- If any chart legend text is currently lighter than `gray-600`, darken it to `gray-600`

---

### 8C — Spacing and Layout Density

**Files:** Global layout wrapper component, page-level components, card components, table components.

Apply the following spacing corrections only where the current value is less than specified. Do not reduce any spacing that is already at or above the target:

- Page-level horizontal padding: `px-6` on desktop (`md:px-6`), `px-4` on mobile — check the main layout wrapper and update if below this
- Section gaps between major content blocks on a page: `gap-8` or `space-y-8`
- Card internal padding: `p-5` minimum — if any card currently uses `p-3` or `p-4`, increase to `p-5`
- Table cell padding: data rows `py-3 px-4`, header rows `py-2 px-4` — update table components globally
- Gap between FilterPanel and first content section below it: `mt-6` minimum on all pages where FilterPanel is used

---

### 8D — Visual Clutter Reduction

**Files:** Individual page components.

For each item below, locate the element and remove or simplify it. Do not remove anything not listed here:

1. **Redundant subtitle paragraphs:** If any page has a subtitle or description paragraph directly below the page title that simply restates what the title already communicates (adds no new information), remove that paragraph only. If the subtitle adds genuinely new information (a date range, a data source note, a specific instruction), keep it.

2. **Double-border visual stacking:** If any card or panel has both an outer container border and an inner child element border creating a double-border effect with no semantic purpose, remove the inner border only. Keep the outer border.

3. **Oversized empty/loading state padding:** If any loading spinner or empty state message has vertical padding greater than `py-16`, reduce it to `py-12` to center the message in the visible viewport without pushing other content.

---

### 8E — Navigation and Page Headers

**Files:** Navigation component.

- The active page link in the nav bar must have a clear active visual treatment. Check what is currently applied. If it is not already using at minimum `font-semibold` plus either an underline, a fill, or the project's accent color, add `font-semibold` and the project's existing accent color class to the active nav link's className
- Do not add icons, new nav items, or restructure the nav component
- Page `<h1>` elements on all pages: ensure they use `font-semibold` or `font-bold` — not `font-medium` or `font-normal`

---

### 8F — Chart Readability

**Files:** All Recharts chart components across all pages.

Make only these changes to Recharts components — do not change chart types, colors, data series, or data-related props:

- `<XAxis>`: add or update `tick={{ fontSize: 12 }}` if current fontSize is below 12
- `<YAxis>`: add or update `tick={{ fontSize: 12 }}` if current fontSize is below 12
- `<Legend>`: add or update `wrapperStyle={{ fontSize: '12px' }}` if not already set
- Any `<ReferenceLine>` with a `label` prop: add `label={{ fontSize: 12 }}` if not already set
- `<Tooltip>` content components: ensure the rendered text inside custom tooltip components is at minimum 13px font size — add `style={{ fontSize: '13px' }}` to the tooltip content wrapper if below this

---

### What to ABSOLUTELY NOT change in this entire plan
- Any route or page file name
- Any component's export or import structure beyond removing genuinely orphaned imports
- Any component's data fetching, state shape, or business logic
- The Tailwind config in ways that break or rename existing token names used elsewhere
- The Leaflet map component styling in any way
- The Prophet pipeline or any backend file
- The classification algorithm or evaluation logic
- The PDF export templates (handled in Plan 6)
- The CSV export

### Verification
After this plan is complete:
- All pages render without layout breakage
- All font sizes are equal to or larger than before this plan
- No color has changed except contrast corrections on gray text
- No component tree has been restructured
- The map renders correctly on the dashboard page
- All charts still show correct data
- Navigation active state is visually clear