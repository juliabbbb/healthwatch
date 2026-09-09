# HEALTHWATCH — Implementation Plan 2 of 8
**Item:** Unified FilterPanel Component 
**Execute this plan fully before moving to Plan 3.**


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

## ITEM 3 — Unify the Filter Control Panel Across Seasonality and Compare Pages

### Goal
Both the Seasonality page and the Compare page must use one identical shared FilterPanel component. Same sizing, same spacing, same label style, same control heights, same layout. Currently they have separate implementations that are visually inconsistent.

### Step 1 — Audit both pages before touching anything
Open the Seasonality page component and the Compare page component. Read and understand:
- What component or JSX block handles region selection on each page
- What component or JSX block handles illness selection on each page
- What props/state they use (selected values, onChange handlers, available options lists)
- Whether any shared filter component already exists — if it does, note its location

Do not change anything yet in this step.

### Step 2 — Create the shared FilterPanel component
Create `src/components/FilterPanel.tsx` (or the established components directory of this project). If a FilterPanel component already exists, extend it — do not replace it entirely without reading its current implementation first.

The FilterPanel must accept these props:

```ts
interface FilterPanelProps {
  // Region selection
  regions: string[];                        // list of available region options
  selectedRegions: string[];                // currently selected regions
  onRegionsChange: (val: string[]) => void; // handler — keep existing signature
  multiSelectRegion?: boolean;              // true on Compare, false on Seasonality

  // Illness selection
  illnesses: string[];                      // list of available illness options
  selectedIllness: string;                  // currently selected illness
  onIllnessChange: (val: string) => void;   // handler

  // Date slider (optional — shown only when provided)
  showDateSlider?: boolean;
  dateRange?: { min: string; max: string }; // "YYYY-MM" values for slider bounds
  selectedDate?: string;                    // "YYYY-MM" current slider value
  onDateChange?: (val: string) => void;     // handler
}
```

Adapt the prop names to match whatever the existing pages already use — do not force a rename of existing state variables in the parent pages. Use the existing handler signatures.

### Step 3 — FilterPanel visual layout rules
The FilterPanel component must implement this layout:

**Desktop (≥ 768px):**
- Single horizontal row containing all controls
- Controls are baseline-aligned
- Each control has a short label above it (`text-sm font-medium` in the project's label color token)
- Region select and illness select are the same width
- Date slider (when shown) fills the remaining horizontal space
- Container: light background using the project's card/surface token, `rounded-lg border border-border px-6 py-4`
- Gap between controls: `gap-6`

**Mobile (< 768px):**
- Stacked vertically, each control full width
- `gap-4` between controls

**Do not introduce any new color tokens.** Use only what is already defined in the project's Tailwind config or CSS custom properties.

### Step 4 — Replace filter sections on both pages
In the Seasonality page and the Compare page:
- Remove the existing filter section JSX (region select, illness select, and date slider if present on Compare)
- Import and render `<FilterPanel>` with the appropriate props, wiring the existing state variables and handlers directly — do not change the state management logic, only the JSX layer

### Step 5 — Spacing between FilterPanel and page content
After the `<FilterPanel>` closing tag on both pages, ensure there is at least `mt-6` margin before the first content section (charts, tables, etc.).

### What NOT to touch
- The underlying state variables and their types in either page
- The TanStack Query hooks or API calls triggered by filter changes
- Any other page or component not listed here
- The date slider component itself (only wire it — do not rewrite it)

### Verification
After this plan is complete:
- Both the Seasonality and Compare pages show visually identical filter panels
- All three controls (region, illness, date slider on Compare) are the same height and baseline-aligned on desktop
- Changing filters on either page still triggers the correct data fetch and chart update
- No other page is affected