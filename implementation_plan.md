# HEALTHWATCH — Implementation Plan 8 of 8
**Item:** Fix and Scope the Map Page Export Button
**This is the final plan.**

---

## ⚠️ STANDING DIRECTIVE — READ BEFORE EXECUTING ANYTHING

DO NOT touch, refactor, rename, restructure, or rewrite any file, component, function, variable, route, API endpoint, database schema, model, or configuration that is not explicitly listed in this plan.

This system is a live academic research tool (HealthWatch) with a validated forecasting pipeline and a live deployment on Render. Any unrequested change risks breaking the Prophet pipeline, the Supabase connection, the walk-forward evaluation results, the PDF export, or the deployment itself.

The rule is: if it is not in this plan, do not touch it. If you are unsure whether something is in scope, do not touch it. Stop and flag it instead.

CRITICAL FOR THIS PLAN: Do not touch the Leaflet map component's initialization, configuration, tile layer, choropleth logic, or event handlers in any way. The map is only captured as an image for export — it is not restructured.

---

## SYSTEM CONTEXT

HealthWatch is a regional public health decision-support tool for Philippine LGUs and the DOH. It forecasts dengue case volumes per region using Facebook Prophet with a wet/dry seasonal regressor, classifies each of the 18 Philippine regions (+ National aggregate) as Low / Moderate / High risk using P50/P75 percentile thresholds, and presents findings through a dashboard, map, seasonality page, compare page, and export module.

**Tech stack (frontend):** React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS 4 + Recharts + Leaflet + React PDF Renderer + TypeScript 5.8

**DO NOT touch:** FastAPI backend, Prophet pipeline, SQLAlchemy models, Supabase/PostgreSQL config, classification algorithm, evaluation logic, any PDF template from Plans 6–7, CSV export, routing config, render.yaml, Leaflet map internals.

---

## ITEM 6 — Fix and Scope the Map Page Export Button

### Goal
The map/dashboard/homepage export button currently exports too much (or the wrong content). It must export ONLY: the HealthWatch logo, the Leaflet choropleth map, the right-side information panel, and the National Snapshot section. It must strictly exclude: the date slider, Active Alerts, the page navigation bar, the search bar, and all filter controls.

### Step 1 — Read the current export implementation
Open the map/dashboard page component. Find the export button and read its current onClick handler completely. Note:
- What library or method it currently uses for export (html2canvas, a screenshot utility, jsPDF, etc.)
- What element or ref it currently targets

Do not change anything in this step.

### Step 2 — Define the export container
In the map/dashboard page component JSX, identify the elements that must be included in the export:

**INCLUDE:**
- The HealthWatch logo element
- The Leaflet map container element
- The right-side information/details panel (risk tier info, region details, outbreak flags)
- The National Snapshot section (aggregate national stats)

**EXCLUDE (do not wrap in the export container — leave them outside):**
- The date slider
- The Active Alerts section
- The page navigation bar
- The search bar
- Any other control or filter

Wrap ONLY the included elements in a single `<div ref={mapExportRef}>` wrapper. If these elements are already inside a shared wrapper that also contains excluded elements, do not use that wrapper — instead add a new inner wrapper around only the included elements. Make the new wrapper `<div ref={mapExportRef} style={{ display: 'contents' }}>` if needed to avoid affecting layout, or a standard `<div>` if it does not break the existing layout.

### Step 3 — Implement the scoped export
Use `html2canvas` for the PNG export (check if already a dependency — if not, `bun add html2canvas`).

```ts
const handleMapExport = async (format: 'png' | 'pdf') => {
  if (!mapExportRef.current) return;

  const canvas = await html2canvas(mapExportRef.current, {
    backgroundColor: '#ffffff',
    useCORS: true,        // required for Leaflet tile images
    allowTaint: false,
    scale: 2,             // 2x for crisp export on high-DPI screens
  });

  if (format === 'png') {
    const link = document.createElement('a');
    link.download = `healthwatch-map-${new Date().toISOString().slice(0, 7)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (format === 'pdf') {
    const imageDataUrl = canvas.toDataURL('image/png');
    // Use @react-pdf/renderer to wrap in a PDF with a HealthWatch header
    // Structure: cover header (logo text + timestamp) → full-width map image → footer
    // Create an inline PDF document here or in a separate small component
    // Download using pdf(...).toBlob() + programmatic link
  }
};
```

Note on Leaflet and html2canvas: Leaflet map tiles may not render correctly with html2canvas due to CORS restrictions on tile servers. If tiles do not render in the captured image, use the Leaflet map container's canvas layer directly via `map.getCanvas()` if the renderer is canvas-based, or accept that tile layers may appear blank and only the choropleth overlay captures. Do not attempt to change the Leaflet tile provider or map configuration to work around this — document the limitation as a known constraint instead.

### Step 4 — Replace the export button with a two-option dropdown
Replace the current single export button on the map page with a small dropdown button offering two options:
- "Export as PNG"
- "Export as PDF"

Use the same dropdown/popover component pattern already established in the project (check if a `<DropdownMenu>` from Radix UI / shadcn is already used elsewhere — if yes, use the same pattern). Do not introduce a new UI library.

Wire each option to `handleMapExport('png')` and `handleMapExport('pdf')` respectively.

The button must show a loading/disabled state while export is in progress.

### Step 5 — PDF wrapper for map export
The PDF version of the map export must contain:

**Page 1:**
[Header: "HEALTHWATCH" bold, large]
[Subheader: "PH Outbreak Hotspot Map"]
[Export timestamp: formatMonthYear(current month)]
[Full-width map image — from canvas capture]
[Right panel data as text below the map:

National Risk Tier
National Snapshot stats
Any selected region's details currently shown in the right panel]
[Footer: "Generated by HealthWatch | DOH PIDSR Surveillance Data"]


### What NOT to touch
- The Leaflet map component — do not reinitialize, reconfigure, or restructure it
- The Active Alerts component — exclude from export only, do not remove from the UI
- The date slider — exclude from export only, do not remove from the UI
- The navigation bar and search bar — exclude from export only, do not remove from the UI
- Any other page or component

### Verification
After this plan is complete:
- Export as PNG: the downloaded image contains the map, right panel, national snapshot, and logo. It does not contain the date slider, alerts, nav bar, or search bar.
- Export as PDF: the downloaded PDF contains the same elements as the PNG export plus the HealthWatch header and footer text.
- The map page UI is completely unchanged — all excluded elements (date slider, alerts, nav, search) still appear and function normally in the browser.
- The Leaflet map still functions correctly after the ref wrapper was added.
- No other page is affected.