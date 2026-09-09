# Implementation Plan: Comparative Dashboard UI Refactor & Dynamic PDF Export Engine

Refactor the Comparative Dashboard to fix temporal synchronization, card redundancy, modal layout, and universal chart marker styling, and build a full-featured, customizable PDF Export Engine using `@react-pdf/renderer` and `html2canvas`.

---

## User Review Required

> [!IMPORTANT]
> - **React 19 Compatibility**: `@react-pdf/renderer` (v4.3.0) and `html2canvas` (v1.4.1) have been installed and verified via TypeScript check.
> - **Off-Screen & Live Chart Rasterization**: The export engine will capture live chart DOM wrappers using `html2canvas` at `scale: 2` (high-DPI) or off-screen SVG renderers to embed crisp graphics in the PDF.
> - **Timezone**: All baseline calculations and timestamps are locked to `Asia/Manila` (PHT, UTC+8) evaluating dynamically to `2026-09` as the current active baseline month.

---

## Proposed Changes

### Dashboard Fixes & UI/UX Refactor

#### [MODIFY] [frontend/src/lib/healthwatch/data.ts](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/lib/healthwatch/data.ts)
- Enforce dynamic date evaluation locked to `Asia/Manila` (PHT, UTC+8) using `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' })`.
- Ensure `CURRENT_BASELINE_DATE` and `CURRENT_MONTH_INDEX` accurately evaluate to `2026-09` (index 56).
- Export helpers for dynamic baseline manipulation and formatted PHT date strings.

#### [MODIFY] [frontend/src/routes/compare.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/routes/compare.tsx)
- **Task 1.1**: Connect dynamic baseline date synchronization. Ensure the "Now (0)" slider thumb position, top status badge, and target indicators (`Target: 2026-09`) update automatically with slider offsets (`-12m` to `+12m`).
- **Task 1.2**: Remove any redundant bottom footer element from `RegionalOverviewCard`. Maintain full clickability on the outer container with `hover:border-teal-500/50 transition-all cursor-pointer` and keyboard accessibility (`tabIndex={0}`, `onKeyDown` handling `Enter`/`Space`).
- **Task 1.3**: Refactor the Detailed Card View Modal so `"Open Full [Region] Analysis ↗"` occupies `w-full` (100% width) across the bottom row. Boost contrast of metric labels (`REPORTED CASES`, `3-MO TRAJECTORY`, `NATIONAL PERCENTILE`, `DOMINANT PATHOLOGY`) and chart X/Y axis ticks. Upgrade chart tooltips with structured key-value pairs (Month/Year, Actual Value, Predicted Value, 95% CI bounds).
- **Task 1.4**: Ensure `RegionSparkline` and `DetailedChart` render static data point markers (`r={2.5}`) and high-contrast hover dots (`r={5}`, `strokeWidth={2}`).
- Integrate the `"Export Surveillance Report"` action button in the dashboard header that opens `ExportCustomizationModal`.

#### [MODIFY] [frontend/src/components/hw/Charts.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/hw/Charts.tsx)
- Ensure all Recharts lines (`ForecastChart`, `DecompositionChart`) adhere to the universal data point visualization standard (`r={2.5}` static dot, `r={5}` active hover dot).

---

### Dynamic & Customizable PDF Export Engine

#### [NEW] [frontend/src/utils/pdfChartExporter.ts](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/utils/pdfChartExporter.ts)
- Implement `captureChartAsImage(elementIdOrElement: string | HTMLElement): Promise<string>` using `html2canvas` with `scale: 2`, `useCORS: true`, and transparent/dark background preservation.
- Provide batch rasterization utilities for capturing all chart wrappers on demand with step-by-step progress callbacks.

#### [NEW] [frontend/src/components/pdf/styles/pdfStyles.ts](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/pdf/styles/pdfStyles.ts)
- Define modern dark executive theme using Navy (`#0f172a`), Slate (`#1e293b`), Card Slate (`#182234`), Teal (`#0d9488`), and Off-white text (`#f8fafc`).
- Setup A4 page dimensions, margins, typography, flexbox table grids, and risk tier color accents.

#### [NEW] [frontend/src/components/pdf/sections/PDFHeader.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/pdf/sections/PDFHeader.tsx)
- Header displaying report title, generated PHT timestamp (Asia/Manila), active baseline (`2026-09`), selected pathology, and Philippine DOH / HEALTHWATCH metadata badge.

#### [NEW] [frontend/src/components/pdf/sections/PDFRegionalProfile.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/pdf/sections/PDFRegionalProfile.tsx)
- Demographic profiles, island group, population, density, risk classification badge, and key surveillance metrics.
- Uses `wrap={false}` to avoid clipping across pages.

#### [NEW] [frontend/src/components/pdf/sections/PDFComparativeTable.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/pdf/sections/PDFComparativeTable.tsx)
- Side-by-side flexbox table comparing selected regions on reported/predicted cases, 3-mo trajectory, national percentile rank, and risk tier.
- Formatted with clean borders and `wrap={false}` per row.

#### [NEW] [frontend/src/components/pdf/sections/PDFPredictionSection.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/pdf/sections/PDFPredictionSection.tsx)
- Embedded rasterized trajectory charts, 95% CI lower/upper ranges, and Prophet backtest metrics ($MAPE$, $MAE$, $RMSE$).

#### [NEW] [frontend/src/components/pdf/sections/PDFSeasonalitySection.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/pdf/sections/PDFSeasonalitySection.tsx)
- Embedded seasonality decomposition graphs and wet/dry drivers per region.

#### [NEW] [frontend/src/components/pdf/sections/PDFFooter.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/pdf/sections/PDFFooter.tsx)
- Page numbering (`Page X of Y`), generation date, and official DOH surveillance confidentiality notice.

#### [NEW] [frontend/src/components/pdf/SurveillanceReportPDF.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/pdf/SurveillanceReportPDF.tsx)
- Main `@react-pdf/renderer` document assembling sections conditionally based on user-selected preset or modular sections.
- Supports Executive 1-Page Summary, Comprehensive Technical Report, and Custom Comparison Matrix layouts.

#### [NEW] [frontend/src/components/modals/ExportCustomizationModal.tsx](file:///c:/Users/Gerald%20Villanueva/healthwatch/frontend/src/components/modals/ExportCustomizationModal.tsx)
- Modal dialog with:
  1. Preset Layout selection (Executive 1-Page Summary, Comprehensive Technical Report, Custom Comparison Matrix).
  2. Filter Controls: Date range picker (defaulting to baseline `2026-09` PHT), Pathology selector (`All`, `Dengue`, `Influenza-like Illness`, `Leptospirosis`), Regional multi-select with "Select All" / "Clear All".
  3. Modular Section checkboxes (Overview, Comparative Matrix, Trajectory, Seasonality, Model Performance, Recommendations).
  4. Step-by-step progress loader (*"Rasterizing chart visuals..."* -> *"Building PDF document..."* -> *"Downloading..."*).
  5. Triggers clean PDF download as `Epidemiological_Report_2026-09.pdf`.

---

## Verification Plan

### Automated Verification
- Run TypeScript compiler: `npx tsc --noEmit` to verify type safety across all components and PDF renderer types.
- Run build: `npm run build` to confirm production bundle builds without errors or SSR/dynamic evaluation issues.

### Manual & Interactive Verification
- Verify `2026-09` is displayed as baseline date across the slider, top bar, and target indicators (`Target: 2026-09`).
- Verify slider offsets update target dates across all cards (e.g., `-12m` to `+12m`).
- Verify Regional cards have no redundant bottom buttons and clicking any card opens the modal; keyboard accessibility (`Enter`/`Space`) works.
- Verify modal bottom CTA button spans 100% width and metric labels have high contrast.
- Verify line charts render visible static data points (`r=2.5`) and hover markers (`r=5`).
- Click "Export Surveillance Report", test preset switches, customize modular checkboxes, and trigger export.
- Verify high-resolution chart rasterization and automatic download of `Epidemiological_Report_2026-09.pdf`.
