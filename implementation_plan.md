# HEALTHWATCH — Implementation Plan 1 of 8
**Item:** Date Formatting Utility 
**Execute this plan fully before moving to Plan 2.**

---

## ⚠️ STANDING DIRECTIVE — READ BEFORE EXECUTING ANYTHING

DO NOT touch, refactor, rename, restructure, or rewrite any file, component, function, variable, route, API endpoint, database schema, model, or configuration that is not explicitly listed in this plan.

This system is a live academic research tool (HealthWatch) with a validated forecasting pipeline and a live deployment on Render. Any unrequested change risks breaking the Prophet pipeline, the Supabase connection, the walk-forward evaluation results, the PDF export, or the deployment itself.

The rule is: if it is not in this plan, do not touch it. If you are unsure whether something is in scope, do not touch it. Stop and flag it instead.

All changes must be surgical, minimal, and scoped to the exact files described below.

---

## SYSTEM CONTEXT

HealthWatch is a regional public health decision-support tool for Philippine LGUs and the DOH. It forecasts dengue case volumes per region using Facebook Prophet with a wet/dry seasonal regressor, classifies each of the 18 Philippine regions (+ National aggregate) as Low / Moderate / High risk using P50/P75 percentile thresholds, and presents findings through a dashboard, map, seasonality page, compare page, and export module.

**Tech stack (frontend):** React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS 4 + Recharts + Leaflet + React PDF Renderer + TypeScript 5.8

**DO NOT touch:** FastAPI backend, Prophet pipeline, SQLAlchemy models, Supabase/PostgreSQL config, classification algorithm, evaluation logic, CSV export, routing config, render.yaml.

---

## ITEM 7 — Format All Dates as "Mon YYYY" Throughout the Application

### Goal
All dates displayed to the user must render as "Sep 2026" format instead of raw ISO "2026-09" format. Only the display layer changes. Internal state, API calls, and database values stay as "YYYY-MM".

### Step 1 — Create the shared date formatter utility
Create the file `src/utils/formatDate.ts` (or the equivalent utils directory in this project). Do not overwrite any existing file — if a formatDate utility already exists, extend it by adding the new function below without removing anything already there.

```ts
/**
 * Formats a date string or Date object to "Mon YYYY" display format.
 * Input accepts: "YYYY-MM", "YYYY-MM-DD", or a Date object.
 * Example: "2026-09" → "Sep 2026"
 * Uses en-PH locale — HealthWatch is a Philippine public health system.
 */
export function formatMonthYear(input: string | Date): string {
  const date =
    typeof input === 'string'
      ? new Date(input.length === 7 ? `${input}-01` : input)
      : input;
  return date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}
```

### Step 2 — Apply formatMonthYear to every date display location
Search the entire frontend codebase for any place where a date value is rendered as visible text to the user. Replace all such instances with `formatMonthYear(...)`. Target locations:

- Recharts `<XAxis>` and `<YAxis>` tick formatters on all chart components — add or update the `tickFormatter` prop: `tickFormatter={(val) => formatMonthYear(val)}`
- Date slider tick labels and current value display labels on the Compare page
- Any table column that renders a month or date value as display text
- Tooltip content inside Recharts charts that shows a date or month label
- The National Snapshot section's date range display (e.g., "2026-01 to 2026-12" should become "Jan 2026 to Dec 2026")
- Any other visible date string in the UI

### Step 3 — Do NOT change any of the following
- Date values passed as query parameters or request bodies to the FastAPI backend — keep as "YYYY-MM"
- Date values stored in React state, TanStack Query cache, or Zod schemas — keep as "YYYY-MM" internally
- Any date used in sorting, comparison, or arithmetic logic
- Any database value
- Any backend file

### Verification
After this plan is complete:
- All chart X-axis labels show months as "Jan 2026", "Feb 2026", etc. — not "2026-01"
- All slider value displays show "Sep 2026" — not "2026-09"
- All table date columns show "Sep 2026" — not "2026-09"
- API network requests (check browser DevTools Network tab) still send "YYYY-MM" format
- No existing functionality is broken