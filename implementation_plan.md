---
## PLAN 1 — EXPORT PDF FIX: SEASONALITY PAGE + MAP PAGE

### Standing Directive
You are working on HealthWatch — a Philippine regional dengue outbreak forecasting and hotspot classification system. The frontend is React 19 + Vite + TanStack Router + TanStack React Query + Tailwind CSS 4 + Recharts + Leaflet + React PDF Renderer. The backend is FastAPI + SQLAlchemy + Prophet + PostgreSQL (Supabase in prod, SQLite fallback). Deployment is on Render. Package manager is Bun. Do not introduce new dependencies unless strictly necessary and explicitly justified. Do not touch unrelated files. Think before you act — read existing code first, then fix.

### System Context
HealthWatch has two pages with broken export functionality:
1. The **Seasonality page** has an export-to-PDF button that triggers but the exported PDF is empty or missing the actual page data (charts, tables, risk classifications, seasonal patterns).
2. The **Map page** has an export button that does absolutely nothing — no download, no PDF, no CSV, no response.

### Item 1 — Fix Seasonality Page PDF Export

**Step 1 — Audit the existing export code.**
- Locate the Seasonality page component (likely `src/pages/seasonality.tsx` or similar). Find the PDF export handler. Read it fully.
- Locate the React PDF Renderer usage (look for `@react-pdf/renderer` imports, `Document`, `Page`, `View`, `Text`, `Image` components).
- Identify what data the PDF is currently trying to render and compare it to what is visually on the screen. Find the gap.

**Step 2 — Identify root causes (check all of these):**
- Is the PDF Document component receiving the actual queried data (forecasts, risk tier, seasonal decomposition, chart images) or is it rendering with undefined/empty state?
- Are Recharts chart elements being captured as images for PDF inclusion? If not, implement `html2canvas` capture of chart refs (or use SVG export from Recharts directly — `recharts` exposes SVG natively, prefer this over html2canvas to avoid adding deps).
- Is the PDF triggered before React Query has resolved the data? Ensure the export button is disabled or the handler awaits data readiness.
- Is the PDF renderer running server-side (SSR via Nitro) where DOM APIs are unavailable? Guard all canvas/SVG capture logic with `typeof window !== 'undefined'`.

**Step 3 — Fix the PDF content.**
The Seasonality page PDF export must include, in this order:
1. Header: HealthWatch logo text, report title "Seasonal Pattern Analysis Report", generation timestamp (Philippine Standard Time, UTC+8), selected region and illness.
2. Seasonal decomposition summary table: trend direction, seasonal amplitude, residual range — one row per metric.
3. Risk tier classification result: Low / Moderate / High, with the P50 and P75 thresholds used.
4. Seasonal outbreak indicator result: Rule A status, Rule B status, combined outbreak signal.
5. Case volume chart: export as SVG string from Recharts ref or render a simplified table of forecast values if SVG capture fails.
6. Footer: "Data sourced from DOH PIDSR. For official use only."

**Step 4 — Wire up the fixed export.**
- Replace the broken handler with the corrected one.
- The export button should show a loading spinner while generating, then trigger `window.URL.createObjectURL` + `<a>` click download pattern.
- Filename format: `HealthWatch_Seasonality_{RegionSlug}_{YYYYMMDD}.pdf`

---

### Item 2 — Fix Map Page Export Button

**Step 1 — Audit the Map page export button.**
- Locate the Map page component (likely `src/pages/map.tsx` or `src/pages/index.tsx` since map is the landing). Find the export button element and its `onClick` handler.
- If the handler is empty, a no-op, or commented out — that is the bug. Document what you find.

**Step 2 — Implement Map page export as CSV.**
The map page shows regional hotspot classifications (Low/Moderate/High per region). Export this as a CSV with the following columns:
`Region, Risk Tier, Predicted Cases (Next Season), P50 Threshold, P75 Threshold, Outbreak Signal (Rule A), Outbreak Signal (Rule B), Season, Illness, Export Date`

- Pull data from the existing React Query cache that is already powering the map choropleth — do not make a new API call.
- Use a pure in-memory CSV string builder (no new deps): `encodeURIComponent`, `data:text/csv` URI, or `Blob` + `URL.createObjectURL`.
- Trigger download via a temporary `<a>` tag with `download` attribute.
- Filename format: `HealthWatch_MapExport_{Season}_{YYYYMMDD}.csv`

**Step 3 — Also add a PDF summary option to the map export (secondary, only if time allows).**
- A one-page PDF showing the regional risk tier table (all 18 regions + National), sorted High → Moderate → Low.
- Use the same React PDF Renderer pattern from Item 1.
- If not done now, leave a clearly marked `// TODO: Map PDF export` comment with the spec above.

**Step 4 — UX.**
- The export button on the map page must provide visual feedback: show "Exporting…" text or a spinner, then revert to normal after the download is triggered.
- Disable the button during export to prevent double-clicks.