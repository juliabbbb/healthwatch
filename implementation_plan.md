# HEALTHWATCH — Implementation Plan 3 of 8
**Item:** Add Date Slider to Seasonality Page 
**Execute this plan fully before moving to Plan 4.**


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

## ITEM 4 — Add a Date Slider to the Seasonality Page

### Goal
The Seasonality page currently has no date/forecast period slider. It must have the same date slider as the Compare page, wired to the FilterPanel (from Plan 2) via `showDateSlider={true}`, and its selected value must drive the Seasonality page's forecast horizon.

### Step 1 — Read the Compare page date slider before touching anything
Open the Compare page component. Read the date slider's:
- Component name and file location
- Props interface (min, max, value, onChange)
- How its value is stored in state (variable name and type)
- How its value is passed to the data fetch / TanStack Query hook
- What the min and max bounds represent (earliest available data month, furthest forecast month)

Do not change the Compare page in this step.

### Step 2 — Add date slider state to the Seasonality page
In the Seasonality page component, add a state variable for the selected forecast date using the same type as the Compare page uses. Initialize it to the same default value the Compare page uses.

```ts
// Match the exact type and default the Compare page uses — do not invent a new type
const [selectedDate, setSelectedDate] = useState<string>(/* same default as Compare */);
```

### Step 3 — Pass the date slider into FilterPanel on the Seasonality page
On the Seasonality page, update the `<FilterPanel>` rendered in Plan 2 to include:

```tsx
<FilterPanel
  // ... existing region and illness props already wired in Plan 2 ...
  showDateSlider={true}
  dateRange={{ min: /* earliest month */, max: /* furthest forecast month */ }}
  selectedDate={selectedDate}
  onDateChange={setSelectedDate}
/>
```

Use the same min/max bounds the Compare page uses — do not hardcode arbitrary dates. If the bounds come from a TanStack Query result, use the same query on the Seasonality page.

### Step 4 — Wire selectedDate to the Seasonality page data fetch
In the Seasonality page's TanStack Query hook (or wherever the API call is made for chart data), pass `selectedDate` as a parameter to the forecast horizon argument — replacing any hardcoded or default forecast period value currently used. Do not change the API endpoint or the backend — only pass the value as a query parameter that was previously hardcoded.

### Step 5 — Date label formatting
All labels on the date slider (tick marks, current value display, tooltip) on the Seasonality page must use `formatMonthYear` from Plan 1. Confirm the Compare page's slider also uses it — if it does not yet, apply it there too as part of this step.

### What NOT to touch
- The Compare page's date slider behavior or state
- The date slider component's internal implementation
- Any other page or component
- The FastAPI backend

### Verification
After this plan is complete:
- The Seasonality page shows the date slider inside the FilterPanel
- Moving the slider updates the Seasonality page's charts and data
- Slider labels show "Sep 2026" format, not "2026-09"
- The Compare page's slider is unaffected