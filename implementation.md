# HEALTHWATCH — Final Implementation Plan

Scope-locked after codebase audit (option A: keep glass/token design system; include month-of-year chart; drop national donut). Implement in the order below. Verify with `npm run lint`, `npx tsc --noEmit`, and `impeccable detect --json <changed files>`.

## 1. Verified architecture (read before coding)

- **Data path (frontend):** one `/dashboard` fetch at startup loads `seriesCache` / `metricsCache` / `outbreakCache` in `frontend/src/lib/healthwatch/data.ts`; every component reads synchronously via `assessRegion()`, `getSeries()`, `getOutbreak()`, `modelMetrics()`. **Do not add per-region React Query data hooks** — this is the data path.
- **Map info surfaces:** `components/hw/ForecastCard.tsx` renders in both the desktop right dock (`routes/index.tsx:136-149`) and mobile bottom sheet (`MobileBottomSheet.tsx` imports it). One component serves both via `variant="panel"|"sheet"` — refactor it in place.
- **Analysis page:** `/seasonality?region=<code>` (`routes/seasonality.tsx`); `/region/$code` redirects there. Horizon ("Forecast horizon:" chips, `HORIZONS=[4,8,12]`) **already lives here** — nothing to relocate from the map.
- **Backend AI:** Groq only — `_llm_narrate()` (`src/api.py:542`, model `GROQ_MODEL` default `openai/gpt-oss-120b`, gpt-oss models don't accept `temperature`). Existing narration endpoints `/analysis/{region}` + `/analysis/seasonality` (20/min each). No Anthropic/Claude — never introduce.
- **Design system:** oklch CSS-var tokens (`--chart-1..4`, `--risk-*`, `--wet`, `--dry`, `--border`, `--color-muted-foreground`), light/dark themes, glass panels. Charts already use custom tooltips, `axisLine={false}`/`tickLine={false}`, `clip()` to ≥0, `YAxis domain={[0,"auto"]}`. Governed by `DESIGN.md` / `.impeccable/design.json`.

## 2. Files

**Create**
- `frontend/src/lib/chartConfig.ts` — token-sourced chart constants (CSS vars only, no hex), shared `axis` + `clamp()`.
- `frontend/src/components/hw/ChartCard.tsx` — titled/subtitled card wrapper; expand via existing `ChartExpandModal` + `ui/dialog`.
- `frontend/src/components/hw/KpiCard.tsx`, `KpiStrip.tsx` (4 cards, `grid-cols-2 lg:grid-cols-4`), `ForecastSparkline.tsx` (**hand-rolled SVG** — do NOT pull recharts onto the map page; see `Charts.lazy.tsx` bundling note), `RiskDistributionRow.tsx` (3 pills), `OutbreakBanner.tsx`, `HotspotTimeline.tsx` (12 cells, Radix `Tooltip`), `AiInsightLine.tsx`, `ValidationMetricsPanel.tsx`.

**Modify**
- `components/hw/ForecastCard.tsx` — replace the dense "6-Month Forecast Horizon" bars and "Forecast & Outlook" sections with: `OutbreakBanner` (conditional) → `KpiStrip` → `ForecastSparkline` (6 mo) → `RiskDistributionRow` → `AiInsightLine` → keep existing `/seasonality` CTA (`:444-450`), header, metric toggle, model info. Mobile sheet updates automatically.
- `routes/seasonality.tsx` — `HotspotTimeline` under page header; `MonthOfYearChart` in a `SeasonalityChartCard`; `ValidationMetricsPanel`; rename label "Forecast horizon:" → "Forecast Window" (`:644`), optionally `HORIZONS=[3,6,12]` (`:92`).
- `routes/methodology.tsx` — collapsible Developer API section at bottom (real endpoints from `docs/api_contract.md`, base URL `https://healthwatch-api-xepv.onrender.com`, `<pre>` blocks + copy buttons following `ChartExpandModal.tsx:209-225` precedent) + `ValidationMetricsPanel`.
- `components/hw/Charts.tsx` — add `MonthOfYearChart`; promote shared axis/clamp into `chartConfig` (no visual churn; existing `clip()`/domain/tooltips stay).
- `components/hw/AIAnalysisPanel.tsx` — render structured narrative in 3 labeled blocks.
- `src/api.py` — add `GET /ai-insight?region=&disease=` (Groq `openai/gpt-oss-20b`, reuse `_llm_narrate`, `@limiter.limit("20/minute")`, 503 fail-soft, returns `{region, narrative, model}`); tighten `_ANALYSIS_SYSTEM_PROMPT` to require exactly three headings: **Current Situation / Seasonal Outlook / Recommended Actions**.

**Not changed:** `NationalSnapshot.tsx` (keeps existing risk cards, no donut), map routes, data layer async behavior, themes/palette.

## 3. Data wiring for map KPIs (sync accessors, no new hooks)

Given `a = assessRegion(code, illness, monthIndex, mode)`:
- Next-month forecast: `a.forecastWindow[0]` → `.cases` / `.lower` / `.upper` (already ≥0 clipped).
- Current risk: `a.risk`; icon/tone from `RISK_META`.
- Season outlook: `getOutbreak(code)[upcomingSeasonForMonth(monthMeta(monthIndex).month)]` → `.outbreak`, `.trigger` (`both|consecutive_high|season_p75` — use `OUTBREAK_TRIGGER_LABEL`), `.season_avg`, `.season_p75`.
- Historical peak: max over `getSeries(code, disease)` + its month label.
- Risk pills: `a.forecastWindow.slice(0,6)` → `classify(metricValue(p.cases, region, mode), a.thresholds)`.
- `AiInsightLine`: gated by `useAiAnalysisSetting()` (zero calls when off — mirror `AIAnalysisPanel.tsx`), module-level cache keyed `region+month`, skeleton while loading, hide on error.

## 4. Phases

**Phase 1 — Foundation.** `chartConfig.ts` (token mappings), `ChartCard.tsx`, Zod schemas (`lib/schemas.ts`) only for runtime payloads: forecast point, validation metrics, `/validation/outbreak`.

**Phase 2 — Map KPI panel.** Build the six atoms; refactor `ForecastCard` to compose them; no route/sheet changes.

**Phase 3 — AI.** Add `/ai-insight` endpoint; mount `AiInsightLine` in `ForecastCard`; tighten analysis prompt; 3-section rendering in `AIAnalysisPanel`.

**Phase 4 — Charts.** `MonthOfYearChart` (bar per calendar month from historical `getSeries`, wet/dry Cell colors, P50/P75 `ReferenceLine`s) added to Seasonality page in a `SeasonalityChartCard`. All chart colors from `chartConfig` tokens.

**Phase 5 — Objective gaps.** `HotspotTimeline` (Seasonality top), `ValidationMetricsPanel` (Seasonality + Methodology; pull precision/recall/f1 + tp/fp/fn from `/validation/outbreak`, MAE/RMSE/MAPE + `skill_vs_naive_pct` from `/metrics/{region}` — no hardcoded numbers), Developer API section (Methodology).

**Phase 6 — Housekeeping.** Rename horizon label; `npm run lint`; `npx tsc --noEmit`; `impeccable detect --json` on touched UI files; confirm recharts absent from map page; confirm light/dark render clean.

## 5. Acceptance checklist

- Map (desktop + mobile sheet): 4 KPI cards, SVG 6-month sparkline, 3 risk pills, outbreak banner only when flagged and naming the trigger, AI line gated, CTA → `/seasonality?region=`.
- No horizon selector on the map; "Forecast Window" chips only on Seasonality.
- Analysis page: HotspotTimeline, month-of-year chart with P50/P75 lines, P50/P75 risk-method dialog (already exists — placement only), 3-section AI, live validation panel.
- Methodology: Developer API section with correct endpoints/base URL + copy buttons; validation panel.
- Colors from design tokens; `impeccable detect` clean; lint + tsc pass.