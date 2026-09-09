# HEALTHWATCH — Implementation Plan 6 of 8
**Item:** Fix PDF Export Formatting — Prevent Overlap with Multiple Regions
**Execute this plan fully before moving to Plan 7.**


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

**DO NOT touch:** FastAPI backend, Prophet pipeline, SQLAlchemy models, Supabase/PostgreSQL config, classification algorithm, evaluation logic, CSV export, routing config, render.yaml, any non-PDF component.

---

## ITEM 5 — Fix PDF Export Formatting to Prevent Overlap with Multiple Regions

### Goal
The current PDF export overlaps content when many regions are selected. Fix this with per-region page breaks, fixed column widths, correct font sizing, a cover page, and a summary page.

### Step 1 — Locate all React PDF document components
Search the codebase for files that import from `@react-pdf/renderer`. List every file found. These are the only files this plan touches.

### Step 2 — Read the current PDF template structure
Before changing anything, read the current template structure completely. Identify:
- Where the loop over selected regions occurs
- How charts or chart data are rendered in the PDF (as images, as tables, or as React PDF shapes)
- What the current page margins are
- What font family is currently used

### Step 3 — Implement per-region page breaks
In the region loop within the PDF document component, wrap each region's content block in a `<View break>`. The `break` prop on a React PDF `<View>` forces a page break before that view.

```tsx
{selectedRegions.map((region, index) => (
  <View key={region} break={index > 0}>
    {/* All content for this region goes here */}
  </View>
))}
```

Note: `break={index > 0}` skips the page break before the very first region.

### Step 4 — Per-region page content structure
Each region block (inside the `<View break>`) must contain the following in order:

1. Region name — bold, large text (`fontSize: 18, fontWeight: 'bold'`)
2. Risk classification badge — a colored `<View>` rectangle with the tier label:
   - High: background `#EF4444`, white text
   - Moderate: background `#F59E0B`, white text
   - Low: background `#22C55E`, white text
3. Forecast table — monthly predictions for the forecast period (columns: Month | Predicted Cases | Lower Bound | Upper Bound | Risk Tier)
4. Seasonal Outbreak Indicator — text line showing Rule A and Rule B results for the region
5. A thin horizontal divider line at the bottom of the section (optional, omit if it creates spacing issues)

### Step 5 — Fix all table column widths
Every table in the PDF must use explicit column widths that sum to the usable page width. For A4 portrait with standard margins (left: 40pt, right: 40pt), usable width is approximately 515pt.

Example for the forecast table (5 columns):
```tsx
// Column widths must sum to ~515pt
const COL_WIDTHS = {
  month:          100, // "Sep 2026"
  predictedCases: 110, // "Predicted Cases"
  lowerBound:     100, // "Lower Bound"
  upperBound:     100, // "Upper Bound"
  riskTier:       105, // "Risk Tier"
};
// Total: 515pt
```

Apply the same fixed-width discipline to every other table in the PDF template. No table column may have undefined or auto width.

### Step 6 — Fix font sizes for dense tables
- Table header row: `fontSize: 9, fontWeight: 'bold'`
- Table data rows: `fontSize: 9`
- If any table has more than 6 columns, reduce to `fontSize: 8`
- Cell text must not wrap mid-word — set `numberOfLines: 1` on text cells that should not wrap, and ensure column widths are sufficient

### Step 7 — Add a cover page
Insert a new `<Page>` as the very first page of the `<Document>`. The cover page must contain:
[HealthWatch logo or system name as styled text]
[Bold, large: "Regional Outbreak Comparison Report"]
or "Seasonal Pattern Analysis Report" for the Seasonality PDF

Illness: Dengue
Forecast Period: [formatted as "Mon YYYY to Mon YYYY" using formatMonthYear]
Regions Included: [count] regions
Generated: [current date formatted as "Mon YYYY"]
Source: DOH PIDSR Surveillance Data

[Horizontal rule]

Regions in this export:
[Numbered list of all selected region names]


### Step 8 — Add a summary page at the end
Insert a new `<Page>` as the very last page of the `<Document>`. The summary page must contain:

- Title: "Summary — All Regions" (`fontSize: 16, fontWeight: 'bold'`)
- A table with columns: Rank | Region | Risk Tier | Predicted Cases (Next Season) | Outbreak Flag
- Rows sorted by predicted cases descending (highest predicted case count first)
- Risk Tier cell background colors:
  - High: `#EF4444` background, white text
  - Moderate: `#F59E0B` background, white text
  - Low: `#22C55E` background, white text
- Outbreak Flag: show "⚠ Yes" if Rule A or Rule B fired, "—" if neither fired
- Column widths must sum to ~515pt

### Step 9 — Apply formatMonthYear to all date labels in the PDF
All date values rendered as visible text in the PDF must use the `formatMonthYear` utility from Plan 1. Import it and apply it to all month/date cells and labels in the PDF templates.

### What NOT to touch
- Any non-PDF component
- The CSV export
- The map export (Plan 8)
- The forecast data pipeline
- The Seasonality PDF template (Plan 7 adds this — do not create it here)

### Verification
After this plan is complete:
- Export the Compare page PDF with all 18 regions selected
- Confirm: no content overlap anywhere in the document
- Confirm: each region starts on a new page
- Confirm: cover page is the first page with all required fields
- Confirm: summary page is the last page with all regions ranked
- Confirm: all dates in the PDF show "Mon YYYY" format
- Confirm: all table columns are aligned and none overflow their bounds