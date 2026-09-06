import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ILLNESSES, REGIONS } from "@/lib/healthwatch/data";

/* Computed by `python -m src.validate_known_epidemic` — keep in sync. */
const EPIDEMIC_ROWS: { date: string; cases: number; p50: number; p75: number; tier: string }[] = [
  { date: "2019-07-21", cases: 18820, p50: 6951, p75: 11618.5, tier: "High" },
  { date: "2019-07-28", cases: 20266, p50: 8489, p75: 12111, tier: "High" },
  { date: "2019-08-04", cases: 19969, p50: 9121, p75: 13764, tier: "High" },
  { date: "2019-08-11", cases: 19231, p50: 9244, p75: 14246, tier: "High" },
  { date: "2019-08-18", cases: 19981, p50: 8902, p75: 14259, tier: "High" },
  { date: "2019-08-25", cases: 19093, p50: 8150, p75: 12922, tier: "High" },
  { date: "2019-09-01", cases: 18601, p50: 7989, p75: 11986, tier: "High" },
];

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Data & Methodology — HEALTHWATCH" },
      {
        name: "description",
        content:
          "How HEALTHWATCH works: DOH Epidemiology Bureau monthly dengue surveillance (2022–2026), per-region Prophet forecasting with a calendar-based wet/dry season regressor, percentile-based hotspot classification, seasonal outbreak indicators with prospective 2025 validation and walk-forward validation.",
      },
      { property: "og:title", content: "Data & Methodology — HEALTHWATCH" },
      {
        property: "og:description",
        content:
          "Prophet forecasting over DOH dengue surveillance with percentile risk tiers and honest validation.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Methodology,
});

function Methodology() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to map
      </Link>
      <h1 className="text-3xl">Data &amp; Methodology</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        HEALTHWATCH is a regional time-series decision-support prototype for seasonal illness
        outbreak prediction and hotspot classification across the {REGIONS.length} administrative
        regions of the Philippines.
      </p>

      <Section title="Data sources">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>
            <strong>DOH Epidemiology Bureau monthly dengue surveillance (2022–2026)</strong>{" "}
            — the PIDSR morbidity-week case series per administrative region, summed to calendar
            months, republished for open research by the UPRI-NOAH dengue-rainfall dataset
            (Zenodo 10.5281/zenodo.19448854, ODC-ODbL). This canonical file is the backbone of every
            series in the system.
          </li>
          <li>
            <strong>PSA PSGC boundaries</strong> — region-level GeoJSON used for the choropleth and
            for keying every record to a PSGC code.
          </li>
        </ul>
        <p className="mt-3 rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
          This dashboard runs live: case series, forecasts, risk tiers and validation metrics are
          served by a FastAPI backend reading from a PostgreSQL database on Supabase, built
          entirely by the Python pipeline (<code>src/</code>). No values shown are synthetic.
        </p>
      </Section>

      <Section title="Model approach — how the forecast is trained">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/85">
          <li>
            <strong>Cleaning &amp; resampling.</strong> Raw regional reports are standardised to
            PSGC codes, deduplicated, and summed from morbidity weeks to contiguous calendar-month
            series per region (56 months: January 2022 through August 2026).
          </li>
          <li>
            <strong>Feature engineering.</strong> Each month receives a calendar-based wet/dry season
            flag; non-negativity clipping is enforced on all counts before modelling. Lag features
            (1 and 12 months) and a 3-month rolling mean capture short-memory and same-month-last-year
            persistence.
          </li>
          <li>
            <strong>Forecasting model.</strong> One <strong>Prophet</strong> model per region
            (additive trend with automatic changepoint detection + Fourier yearly seasonality +
            wet/dry season regressor). Model parameters are learned from data via Bayesian
            estimation — this is the machine-learning step. The production forecast trains through
            <strong>August 2026</strong> and publishes the next 12 months; the two validation
            windows train through 31 December 2024 (prospective) and August 2025 (recent).
          </li>
          <li>
            <strong>Horizon.</strong> Each regional model publishes a 12-month ahead forecast with
            uncertainty intervals, stored in the backend and rendered here with 95% bands.
          </li>
        </ol>
      </Section>

      <Section title="Validation — proving the model generalises">
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
          <strong>skill versus a seasonal-naïve baseline</strong> (“same month last year”). Raw
          MAPE alone is not used for tiering because near-zero case months inflate it into triple
          digits even when forecasts are epidemiologically useful.
        </p>
      </Section>

      <Section title="Hotspot classification">
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
          The pipeline stores the 228-row (19 × 12) region × month percentile table (P50/P75) used
          to grade tier accuracy: on the 2025 prospective holdout ~27% of region-months landed in
          the exact tier and severe (Low-or-Moderate → High) misses were ~45% — a deliberately
          simple, deterministic analog of established epidemic-threshold methods such as the WHO
          Moving Epidemic Method, which likewise derives intensity bands from historical
          distributions rather than fitted parameters.
        </p>
      </Section>

      <Section title="Seasonal outbreak indicator">
        <p className="text-sm text-foreground/85">
          On top of the monthly tier, the pipeline publishes a season-level outbreak flag for the
          coming{" "}
          <strong>dry window (Jan–Mar)</strong> and{" "}
          <strong>wet window (Jul–Sep, the climatological peak)</strong>. Each purpose-built
          Prophet probe forecasts the 3 months of that window; a region is flagged when either
          rule fires on the probe:
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
          The upcoming season used for outbreak detection is determined automatically from the
          current date using a fixed calendar boundary (wet: Jun–Nov, dry: Dec–May, per PAGASA's
          climatological definition) — it is not pulled from PAGASA or any live weather source.
          This keeps the indicator reproducible and directly
          implements Objective 2's goal of predicting cases "during an upcoming season (dry or
          wet)" as the basis for outbreak detection (Objective 2 → feeds Objective 3's
          classification).
        </p>
        <p className="mt-3 text-sm text-foreground/85">
          Crucially, these flags were <strong>locked without retuning</strong> after a prospective
          test: probes were generated from data through 31 December 2024 and compared against the
          real, observed 2025 monthly series (never part of training). Across the 18 regions the
          flag scored <strong>precision 0.43, recall 0.68, F1 0.53</strong> (13 true positives, 17
          false positives, 6 missed surges). Dry-season accuracy was strong while the wet season
          over-warns rather than misses a surge; that conservative posture is deliberate for a
          public-health alerting layer and is the reason wet-season flags are framed as a watch,
          not a confirmation.
        </p>
      </Section>

      <Section title="Known-epidemic check">
        <p className="text-sm text-foreground/85">
          As an independent sanity check, the classification method was run against a real,
          pre-declared national emergency: DOH declared a national dengue epidemic on 6 August
          2019. Because the monthly pipeline (2022–2026) does not cover 2019, the check reuses the
          standalone 2016–2021 weekly fixture and grades the surrounding national weekly counts
          with weekly equivalents of the same percentile thresholds:
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-secondary/60 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Week ending</th>
                <th className="px-3 py-2 font-medium">National cases</th>
                <th className="px-3 py-2 font-medium">P50 / P75</th>
                <th className="px-3 py-2 font-medium">Tier</th>
              </tr>
            </thead>
            <tbody>
              {EPIDEMIC_ROWS.map((r) => (
                <tr key={r.date} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono">{r.date}</td>
                  <td className="px-3 py-1.5">{r.cases.toLocaleString()}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {r.p50.toLocaleString()} / {r.p75.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5" style={{ color: "var(--risk-high)" }}>
                    {r.tier}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          All 7 of 7 weeks classify as High against the fixture&rsquo;s 2016–2018 weekly reference
          distribution. Reproduce with{" "}
          <code>python -m src.validate_known_epidemic</code>.
        </p>
      </Section>

      <Section title="Deterministic rules enforced">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>Non-negativity: no predicted or lower-bound value may fall below zero.</li>
          <li>Season flagging: every month carries a calendar-based wet/dry tag, shaded on all charts.</li>
          <li>
            Transparent tiers: thresholds are plain percentiles — reproducible without refitting
            any model.
          </li>
        </ul>
      </Section>

      <Section title="Diseases covered">
        <div className="grid gap-3 sm:grid-cols-2">
          {ILLNESSES.map((i) => (
            <div key={i.id} className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-sm font-medium">{i.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{i.driver}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Historical transmission peak ≈ month {i.peakMonth} ({i.season} season)
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Dengue is the pilot disease: it is notifiable, monthly-reported and strongly seasonal. The
          data contract (region × month series → forecast → tier) is disease-agnostic, so additional
          DOH surveillance tables can be added without UI changes.
        </p>
      </Section>

      <Section title="Limitations">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>
            <strong>Short monthly history.</strong> The monthly series spans 56 months (2022–2026),
            giving only ~4 full seasonal cycles — enough to fit a yearly Fourier seasonality but not
            to model multi-year epidemic super-cycles.
          </li>
          <li>
            <strong>Negative-skill windows.</strong> In several region-window validation runs a
            seasonal-naive baseline outperformed the model — most on the 2025 prospective window
            (whose skill is mostly negative by design, left un-retuned). The metrics panel surfaces
            each region's skill so low-confidence forecasts are visible rather than hidden.
          </li>
          <li>
            <strong>Weak prospective tier accuracy.</strong> Only ~27% of 2025 holdout months landed
            in the exact risk tier and roughly 45% of wet-season surges were under-classified as
            Low/Moderate. These numbers stayed locked; they are the honest cost of using plain
            month-of-year percentiles on a short, high-variance series.
          </li>
          <li>
            <strong>Outbreak-flag over-warning.</strong> The locked 2025 prospective flags scored
            precision 0.43 (17 false positives) with recall 0.68. Wet-season flags by design favour
            recall over precision so no surge is missed.
          </li>
          <li>
            <strong>No intervention logs.</strong> LGU/DOH response activities are not published as
            structured open data, so intervention panels are intentionally sparse rather than
            showing estimated events.
          </li>
          <li>
            <strong>No weather map layers.</strong> Precipitation, temperature and humidity
            overlays were removed because they are not live feeds; the model's only
            weather-adjacent signal is the deterministic calendar-based wet/dry season flag.
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
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg">{title}</h2>
      {children}
    </section>
  );
}
