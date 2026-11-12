import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { BackToTop } from "@/components/BackToTop";
import { ResearchComparison } from "@/components/hw/ResearchComparison";

export const Route = createFileRoute("/methodology")({
  head: () => ({ meta: [{ title: "Data & Methodology — HEALTHWATCH" }, { name: "description", content: "Source eligibility, regional forecasts, chronological research comparisons and their limitations." }] }),
  component: Methodology,
});

function Methodology() {
  return <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10" data-explain="methodology-page">
    <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to map</Link>
    <h1 className="text-2xl font-bold tracking-tight">Data &amp; Methodology</h1>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">HealthWatch presents reported regional disease counts, forecasts and historical-reference signals. Source confirmation, model comparison and operational deployment are separate evidence states.</p>
    <div className="mt-6 space-y-4 text-sm leading-relaxed">
      <CollapsibleSection title="Sources and unresolved interpretations" defaultOpen={true}>
        <p>Dengue, acute bloody diarrhea, cholera and typhoid use explicit numeric count fields. ILI uses a provisional apparent year/week header reversal. The weekly ISO-Thursday mapping and week-53 folding remain conditional on source confirmation. Hep A uses a provisional row count and must not be treated as a confirmed broader acute viral hepatitis measure.</p>
        <p className="mt-3">Leptospirosis uses a user-authorized provisional one-case-per-nonblank-source-record rule across all years. S/P/C are classifications; numeric Cases/Deaths fields are retained for audit and are not added to record counts. Fatality measures remain unresolved. Heat records are annual reference aggregates, with no monthly forecast or risk series.</p>
      </CollapsibleSection>
      <CollapsibleSection title="Preprocessing, missingness and coverage" defaultOpen={true}>
        <p>Rows retain source identifiers and duplicate candidates. Missing reports, valid zero, invalid values and out-of-coverage dates have different meanings. Date-typed age labels remain unresolved. National values sum available regional reports and do not establish complete national incidence. Geographic changes, reporting delays and sparse coverage limit comparisons.</p>
        <p className="mt-3">The declared legacy observation cutoff is August 2026; this is not independent proof that every source is complete. Individual sources and regions can end earlier. All Illnesses lists an eligible subset of reports, not unique persons. Marginal model interval bounds are not summed as a calibrated aggregate interval.</p>
      </CollapsibleSection>
      <CollapsibleSection title="Operational forecasts and uncertainty">
        <p>The operational baseline remains Prophet, independently fitted per eligible disease-region series, with multiplicative mode, automatic trend changes, yearly/weekly/daily seasonality disabled and a June–November calendar indicator. Actual weather is not a forecasting regressor. Lag and rolling features belong to the separate Random Forest experiment.</p>
        <p className="mt-3">At least 24 observed training months are required. For the four FWBD sources only, internal gaps between existing regional reports use a user-relayed DOH zero-case rule. Leading/trailing periods and other sources remain missing; a zero-case rule does not establish zero deaths. Forecasts start after the declared training calendar, permit zero, and expose the actual target dates. Prophet's configured 80% model interval has not been calibrated empirically here. Descriptive error badges are not outbreak probabilities.</p>
      </CollapsibleSection>
      <CollapsibleSection title="Four-model chronological research comparison">
        <p>The research compares Seasonal Naive, Prophet, SARIMAX and native WEKA Random Forest. Training begins in January 2019. Three expanding-history validation years (2022–2024) inform selection, followed by a retrospective 2025 evaluation. Fixed-origin twelve-month predictions do not learn held-out actuals during the forecast horizon; this differs from the operational monthly-refit evaluation.</p>
        <p className="mt-3">Models share eligible actual/prior-year score dates. MAE and RMSE retain count units, MAPE excludes observed zeros and is undefined without nonzero actuals, and MASE scales error using training seasonal differences. Primary selection balances the four numeric-count diseases; National and provisional sources do not choose the winner. Forecast error and alert recall can favor different models. A comparison result does not itself replace the operational model.</p>
        <ResearchComparison disease="Dengue" region="National" />
      </CollapsibleSection>
      <CollapsibleSection title="Canonical monthly risk and seasonal reference rules">
        <p>Each disease-region's own historical calendar-month P50/P75 defines the canonical tier: Low below P50, Moderate including both boundaries, High strictly above P75. A cross-region percentile describes relative burden and is not this canonical risk. Insufficient thresholds or unavailable values produce Unavailable, not Low.</p>
        <p className="mt-3">Rule A requires three consecutive High months in a complete probe. Rule B requires the probe mean to exceed the P75 of historical monthly observations pooled within its calendar season. Either rule raises the seasonal reference flag. The benchmark uses exact January–March and July–September 2025 probes with matching past-only threshold pools. Missing prerequisites are excluded from confusion counts, never converted to negative labels.</p>
        <p className="mt-3">These are rule-derived reference labels, not independent official outbreak declarations. The 2019 analysis uses a baseline including that year and is a retrospective consistency check.</p>
      </CollapsibleSection>
      <CollapsibleSection title="Explanations, exports and evidence limits">
        <p>Explanations are constrained by the analytical payload. Unverified generated claims fall back to deterministic text; numeric overlap alone cannot prove semantic fidelity. No completed live-AI corpus or participant comprehension benefit is claimed. Weather advisories are contextual guidance rather than an evaluated causal disease forecast.</p>
        <p className="mt-3">PDF and CSV exports use the selected dates and canonical row-level risk. Seasonal flags identify their retrospective benchmark window separately from operational forecasts. Source policy and validation status accompany interpretation. Research results and operational snapshots carry separate run/experiment identities; unavailable windows are not silently substituted.</p>
        <p className="mt-3">Source-owner clarification, calibrated intervals, a new independent future-period evaluation, authorized live-provider assessment and an actual participant study remain necessary before stronger claims.</p>
      </CollapsibleSection>
    </div><BackToTop />
  </main>;
}
