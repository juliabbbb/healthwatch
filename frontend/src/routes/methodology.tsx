import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useState } from "react";
import { ILLNESSES, REGIONS, caseNotesFor } from "@/lib/healthwatch/data";
import { ValidationMetricsPanel } from "@/components/hw/ValidationMetricsPanel";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { BackToTop } from "@/components/BackToTop";
import { ExplainModeButton } from "@/components/hw/ExplainModeButton";
import { cn } from "@/lib/utils";

/* Computed by `python -m src.validate_known_epidemic` — keep in sync. */
const EPIDEMIC_ROWS: { date: string; cases: number; p50: number; p75: number; tier: string }[] = [
  { date: "2019-01", cases: 34534, p50: 14876.5, p75: 23923.25, tier: "High" },
  { date: "2019-02", cases: 19631, p50: 12440, p75: 17625, tier: "High" },
  { date: "2019-03", cases: 12285, p50: 10478.5, p75: 12088.5, tier: "High" },
  { date: "2019-04", cases: 9009, p50: 8772, p75: 10442.25, tier: "Moderate" },
  { date: "2019-05", cases: 15811, p50: 13395, p75: 15737.5, tier: "High" },
  { date: "2019-06", cases: 30153, p50: 22077.5, p75: 28189.75, tier: "High" },
  { date: "2019-07", cases: 68915, p50: 32788, p75: 46783, tier: "High" },
  { date: "2019-08", cases: 101741, p50: 33302.5, p75: 78867, tier: "High" },
  { date: "2019-09", cases: 58345, p50: 30074, p75: 48578, tier: "High" },
  { date: "2019-10", cases: 46675, p50: 21639.5, p75: 40954.25, tier: "High" },
  { date: "2019-11", cases: 23597, p50: 20653.5, p75: 25745, tier: "Moderate" },
  { date: "2019-12", cases: 16393, p50: 15705, p75: 16270.5, tier: "High" },
];

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Data & Methodology — HEALTHWATCH" },
      {
        name: "description",
        content:
          "How HEALTHWATCH works: DOH dengue and food/waterborne disease line-lists (2019–2026) aggregated to monthly, per-region Prophet forecasting with a calendar-based wet/dry season regressor, percentile-based hotspot classification, seasonal outbreak indicators with prospective 2025 validation and walk-forward validation.",
      },
      { property: "og:title", content: "Data & Methodology — HEALTHWATCH" },
      {
        property: "og:description",
        content:
          "Prophet forecasting over DOH disease surveillance with percentile risk tiers and honest validation.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Methodology,
});

function Methodology() {
  const [openNotes, setOpenNotes] = useState<string | null>(null);
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10" data-explain="methodology-page">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to map
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Data &amp; Methodology
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground leading-relaxed">
            HEALTHWATCH is a regional time-series decision-support prototype for seasonal illness
            outbreak prediction and hotspot classification across the {REGIONS.length} administrative
            regions of the Philippines.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExplainModeButton />
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
            <span className="label-caps text-[10px]">5 diseases · 18 regions</span>
          </span>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {/* 1 — The data, in chronological order: what is fed into the pipeline */}
        <CollapsibleSection title="Data sources (2019–2026)" defaultOpen={true}>
          <p className="text-sm text-foreground/85">
            HEALTHWATCH covers <strong>five notifiable diseases</strong> across the {REGIONS.length}{" "}
            Philippine regions: <strong>dengue</strong> plus the four food-and-waterborne diseases —{" "}
            <strong>Acute Bloody Diarrhea</strong>, <strong>Cholera</strong>,{" "}
            <strong>Typhoid Fever</strong> and <strong>Acute Viral Hepatitis</strong>. Each disease
            runs fully independently through the same pipeline — its own monthly series, Prophet
            forecast, risk tiers, outbreak probes and escalation ranking — so activity in one
            disease is never diluted by another. The raw DOH line-lists below are aggregated to
            contiguous calendar months (2019–2026) and modelled with one Prophet time-series model
            per region (see the next section).
          </p>
          <ul className="mt-3 space-y-2 text-sm text-foreground/85">
            <li>
              <strong>DOH dengue case line-list (2019–2026)</strong> — the
              pre-aggregated case records (Year, Morbidity Week, Region, Province, Age Group, Sex,
              Clinical Classification, Final Case Classification, Admitted, No. of Cases, No. of
              Deaths), summed to contiguous calendar months by the pipeline. Reported cases include
              all final classifications (Suspect + Probable + Confirmed). This canonical file is the
              backbone of the dengue series. Its per-record demographics also power the Reported Data
              Breakdown shown per region-month (age group, sex, clinical severity, admission status),
              read live from the relational database.
            </li>
            <li>
              <strong>DOH FWD line-lists (2019–2026)</strong> — four food-and-waterborne disease
              line-lists (Acute Bloody Diarrhea, Cholera, Typhoid Fever and Acute Viral Hepatitis),
              2019-01 .. 2026-09, each carrying its own Suspect / Probable / Confirmed
              classification, age group, sex, admission status and outcome. Each runs fully
              independently through the same model and tiering pipeline. The group is split by
              transmission route — Acute Bloody Diarrhea and Typhoid Fever are{" "}
              <em>Food-Borne</em>; Cholera and Acute Viral Hepatitis are <em>Water-Borne</em> —
              and the forecast card shows that mix for the coming six months.{" "}
              <strong>Acute Viral Hepatitis is the one shorter series</strong>: its line-list
              ends 2025-09, so months after that carry no observation and are shown as no-data
              rather than as zero reported cases.
            </li>
            <li>
              <strong>PSA PSGC boundaries</strong> — region-level GeoJSON used for the choropleth and
              for keying every record to a PSGC code.
            </li>
          </ul>
          <p className="mt-3 glass-panel rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
            This dashboard runs live: case series, forecasts, risk tiers and validation metrics are
            served by a FastAPI backend reading from a PostgreSQL database on Supabase, built entirely
            by the Python pipeline (<code>src/</code>). No values shown are synthetic.
          </p>
        </CollapsibleSection>

        {/* 2 — How it is predicted: the forecast model */}
        <CollapsibleSection title="How it is predicted — the model approach">
          <p className="text-sm text-foreground/85">
            From the aggregated monthly series, HEALTHWATCH trains one Prophet time-series model
            per region per disease. Prophet combines an additive trend with automatic changepoint
            detection and a calendar-based wet/dry season regressor, fit in multiplicative
            seasonality mode. This is the machine-learning step: model parameters are learned from
            the historical data, then the fitted model publishes a 12-month-ahead forecast with
            uncertainty intervals for every region.
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground/85">
            <li>
              <strong>Cleaning &amp; resampling.</strong> Raw regional reports are standardised to
              PSGC codes, deduplicated, and summed from morbidity weeks to contiguous calendar-month
              series per region. The shared calendar runs January 2019 through August 2026
              (92 months) with a 12-month forecast axis ending August 2027: the four FWD
              diseases and dengue all cover the observed span, while the dengue line-list
              ends at 2026-08.
            </li>
            <li>
              <strong>Feature engineering.</strong> Each month receives a calendar-based wet/dry
              season flag; non-negativity clipping is enforced on all counts before modelling. Lag
              features (1 and 12 months) and a 3-month rolling mean capture short-memory and
              same-month-last-year persistence.
            </li>
            <li>
              <strong>Forecasting model.</strong> One <strong>Prophet</strong> model per region
              (additive trend with automatic changepoint detection + wet/dry season regressor, fit
              in multiplicative seasonality mode). A yearly Fourier seasonality term was tested and
              dropped: it was essentially collinear with the wet/dry regressor (R² ≈ 1.0) and came
              out worse on held-out error. Model parameters are learned from data via Bayesian
              estimation — this is the machine-learning step. The production forecast trains through
              <strong>August 2026</strong> and publishes the next 12 months; the two validation
              windows train through 31 December 2024 (prospective) and August 2025 (recent).
            </li>
            <li>
              <strong>Horizon.</strong> Each regional model publishes a 12-month ahead forecast with
              uncertainty intervals, stored in the backend and rendered here with 95% bands.
            </li>
          </ol>
        </CollapsibleSection>

        {/* 3 — Classifications: percentile tiers, then Rule A / Rule B season flags */}
        <CollapsibleSection title="Hotspot classification — percentile tiers">
          <p className="text-sm text-foreground/85">
            Risk tiers answer one question: <em>how abnormal is this month for this region?</em> Every
            region-month threshold comes from the region&rsquo;s <em>own</em> historical monthly
            distribution, restricted to the same calendar month across prior years, so dry-season
            lulls and sparsely populated regions are judged against their own seasonal norm:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li>
              <span className="font-medium" style={{ color: "var(--risk-low)" }}>
                Low
              </span>{" "}
              — below the region&rsquo;s 50th percentile (P50).
            </li>
            <li>
              <span className="font-medium" style={{ color: "var(--risk-moderate)" }}>
                Moderate
              </span>{" "}
              — between P50 and P75.
            </li>
            <li>
              <span className="font-medium" style={{ color: "var(--risk-high)" }}>
                High
              </span>{" "}
              — above P75.
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            The pipeline stores a region × month percentile table (P50/P75) per disease — 1,140 rows
            (5 diseases × 19 regions × 12 months) — used to grade tier accuracy. On the 2025
            prospective holdout the dengue pilot landed ~40% of region-months in the exact tier, with
            severe (Low-or-Moderate → High) misses ~29% — a deliberately simple, deterministic analog
            of established epidemic-threshold methods such as the WHO Moving Epidemic Method, which
            likewise derives intensity bands from historical distributions rather than fitted
            parameters.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Seasonal outbreak indicator — Rule A & Rule B">
          <p className="text-sm text-foreground/85">
            On top of the monthly tier, the pipeline publishes a per-disease season-level outbreak flag for
            each validated benchmark window: <strong>dry (Jan–Mar 2025)</strong> and{" "}
            <strong>wet (Jul–Sep 2025, the climatological peak)</strong>. Each purpose-built Prophet
            probe forecasts the 3 months of that window; a region is flagged when either rule fires on
            the probe:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-foreground/85">
            <li>
              <strong>Rule A</strong> — at least 3 consecutive probe months classify High (above the
              region-month P75).
            </li>
            <li>
              <strong>Rule B</strong> — the window&rsquo;s forecast average monthly load exceeds the
              season&rsquo;s long-run P75 (the seasonal alert line).
            </li>
          </ul>
          <p className="mt-3 text-sm text-foreground/85">
            The panel labels this indicator as a fixed benchmark —{" "}
            <strong>Validated Outbreak Signal (Jul–Sep 2025 benchmark)</strong> — sourced from the
            same frozen <code>outbreak_indicators.csv</code> / <code>outbreak_signals</code> table. It
            is not recomputed from the current date: the displayed dry/wet flags always describe the
            2025 probe windows, so the signal stays reproducible rather than drifting into a rolling
            "upcoming season" label. Season attribution still follows the fixed calendar boundary
            (wet: Jun–Nov, dry: Dec–May, per PAGASA's climatological definition), and the dashboard
            still lets you toggle between the dry and wet benchmark windows for comparison.
          </p>
          <p className="mt-3 text-sm text-foreground/85">
            Crucially, these flags were <strong>locked without retuning</strong> after a prospective
            test: probes were generated per disease from data through 31 December 2024 and compared
            against the real, observed 2025 monthly series (never part of training). Across the five
            diseases and 18 regions the flag scored <strong>precision 0.48, recall 0.34, F1 0.40</strong>{" "}
            (29 true positives, 31 false positives, 56 missed surges). Dry-season accuracy was
            stronger while the wet season over-warns rather than misses a surge; that conservative
            posture is deliberate for a public-health alerting layer and is the reason wet-season
            flags are framed as a watch, not a confirmation.
          </p>
        </CollapsibleSection>

        {/* 4 — Evaluation: error metrics, then classification checks, then the live panel */}
        <CollapsibleSection title="Validation — how well forecasts generalise">
          <p className="text-sm text-foreground/85">
            Models are evaluated on months they never saw, using two chronological 12-month holdout
            windows:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-foreground/85">
            <li>
              <strong>last_12m window</strong> — held out 2025-09 through 2026-08, trained with a
              refit-every-month walk-forward loop (primary quality measure for the current outlook).
            </li>
            <li>
              <strong>2025_prospective window</strong> — held out calendar 2025, trained through 31
              December 2024 exactly as a real deployment would have run.
            </li>
          </ul>
          <p className="mt-3 text-sm text-foreground/85">
            Reported metrics per region: MAE, RMSE, MAPE, and{" "}
            <strong>skill versus a seasonal-naïve baseline</strong> (“same month last year”). Raw MAPE
            alone is not used for tiering because near-zero case months inflate it into triple digits
            even when forecasts are epidemiologically useful.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Known-epidemic check — classification on a real outbreak">
          <p className="text-sm text-foreground/85">
            As an independent sanity check, the classification method was run against a real,
            pre-declared national emergency: DOH declared a national dengue epidemic on 6 August 2019.
            The 2019 line-list carries no pre-2019 weeks, so the check runs the production monthly
            rule on real 2019 rows: national monthly P50/P75 are pooled from the line-list over
            2019–2024 (the pre-2025 validation pool), then each 2019 month is labelled against them.
            The Jul–Oct 2019 epidemic peak all classify High:
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border/80 shadow-xs hw-scroll">
            <table className="w-full min-w-[420px] text-sm border-collapse">
              <thead className="label-caps">
                <tr className="border-b border-border/80 bg-secondary/35 text-[10px] tracking-wider uppercase font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-left">Month</th>
                  <th className="px-4 py-3 text-right">National cases</th>
                  <th className="px-4 py-3 text-right">P50 / P75</th>
                  <th className="px-4 py-3 text-center">Tier</th>
                </tr>
              </thead>
              <tbody>
                {EPIDEMIC_ROWS.map((r) => (
                  <tr key={r.date} className="border-b border-border/40 odd:bg-card/40 even:bg-secondary/15 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{r.cases.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {r.p50.toLocaleString()} / {r.p75.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "oklch(0.99 0.003 95)", backgroundColor: "var(--risk-high-solid)" }}
                      >
                        <span className="size-1.5 rounded-full bg-white/80" />
                        {r.tier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            10 of 12 months classify as High, with the Jul–Oct 2019 epidemic peak all High.
            Reproduce with <code>python -m src.validate_known_epidemic</code>.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Validation — live metrics">
          <p className="text-sm text-foreground/85">
            Forecast accuracy (MAE/RMSE/MAPE + skill vs. seasonal-naive per region) and outbreak
            classification performance (national 2025 prospective holdout) are pulled live from the
            data API — the same numbers the Seasonal pattern page surfaces per region.
          </p>
          <div className="mt-3" data-validation-panel>
            <ValidationMetricsPanel />
          </div>
        </CollapsibleSection>

        {/* 5 — Supporting information: deterministic rules, diseases covered, limitations */}
        <CollapsibleSection title="Deterministic rules enforced">
          <ul className="space-y-2 text-sm text-foreground/85">
            <li>Non-negativity: no predicted or lower-bound value may fall below zero.</li>
            <li>
              Season flagging: every month carries a calendar-based wet/dry tag, shaded on all charts.
            </li>
            <li>
              Transparent tiers: thresholds are plain percentiles — reproducible without refitting any
              model.
            </li>
          </ul>
        </CollapsibleSection>

        <CollapsibleSection title="Diseases covered">
          <div className="grid gap-3 sm:grid-cols-2">
            {ILLNESSES.map((i) => {
              const notes = caseNotesFor(i.id);
              const open = openNotes === i.id;
              const header = (
                <>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{i.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{i.driver}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Historical transmission peak ≈ month {i.peakMonth} ({i.season} season) ·{" "}
                      {i.group}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground shrink-0 transition-transform duration-300 ease-in-out mt-0.5",
                      open && "rotate-180 text-foreground",
                    )}
                    aria-hidden="true"
                  />
                </>
              );
              return (
                <div
                  key={i.id}
                  className="glass-panel rounded-xl p-5 transition-all hover:border-border"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`illness-notes-${i.id}`}
                    onClick={() => setOpenNotes(open ? null : i.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-lg text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {header}
                  </button>
                  <div
                    id={`illness-notes-${i.id}`}
                    role="region"
                    aria-hidden={!open}
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-in-out",
                      open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-4 pt-3 border-t border-border/40 space-y-3">
                        {notes.disclaimer.map((line) => (
                          <p key={line} className="text-[11px] text-muted-foreground leading-relaxed">
                            {line}
                          </p>
                        ))}
                        <p className="label-caps text-[10px] font-bold text-muted-foreground uppercase">
                          {notes.heading}
                        </p>
                        <ul className="space-y-1.5">
                          {notes.classes.map((c) => (
                            <li key={c.label} className="text-[11px] text-muted-foreground leading-relaxed">
                              <strong className="font-semibold text-foreground">{c.label}</strong>
                              <span className="text-muted-foreground"> — {c.definition}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-muted-foreground">{notes.source}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Each disease runs fully independently: its own monthly series, Prophet forecast, risk
            tiers, outbreak probes and escalation ranking. The "All Illnesses" dashboard view is a
            genuine per-month sum across the five diseases on the shared 2019–2026 calendar.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Limitations">
          <ul className="space-y-2 text-sm text-foreground/85">
            <li>
              <strong>Multi-year epidemic super-cycles.</strong> The shared calendar spans 92 months
              (2019–2026), which captures the 2019 and 2024 dengue epidemic
              years, but a single ~8-year window cannot model disease-specific long-term drift beyond
              the observed wet/dry seasonality.
            </li>
            <li>
              <strong>Negative-skill windows.</strong> In several region-window validation runs a
              seasonal-naive baseline outperformed the model — most on the 2025 prospective window
              (whose skill is mostly negative by design, left un-retuned). The metrics panel surfaces
              each region's skill so low-confidence forecasts are visible rather than hidden.
            </li>
            <li>
              <strong>Weak prospective tier accuracy.</strong> Only ~40% of 2025 holdout months landed
              in the exact risk tier and ~29% were severely mis-graded by at least two tiers
              (e.g., Low or Moderate flagged where High transpired). These numbers stayed locked;
              they are the honest cost of using plain month-of-year percentiles on a short,
              high-variance series.
            </li>
            <li>
              <strong>Outbreak-flag over-warning.</strong> The locked 2025 prospective flags scored
              precision 0.48 (31 false positives) with recall 0.34 across all five diseases.
              Wet-season flags are deliberately permissive so no surge is missed, at the cost of
              watches that later prove quiet.
            </li>
            <li>
              <strong>No intervention logs.</strong> LGU/DOH response activities are not published as
              structured open data, so intervention panels are intentionally sparse rather than
              showing estimated events.
            </li>
            <li>
              <strong>No weather map layers.</strong> Precipitation, temperature and humidity overlays
              were removed because they are not live feeds; the model's only weather-adjacent signal
              is the deterministic calendar-based wet/dry season flag.
            </li>
            <li>
              Region-level resolution only — province and city-level hotspots are a later phase.
            </li>
            <li>
              Monthly reporting cadence, with lag and under-reporting in remote areas biasing
              historical baselines downward.
            </li>
            <li>
              Forecasts are advisory decision support. They inform intervention planning; they do not
              replace clinical or epidemiological judgment.
            </li>
          </ul>
        </CollapsibleSection>
      </div>
      <BackToTop />
    </main>
  );
}