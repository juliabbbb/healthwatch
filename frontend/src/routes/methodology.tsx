import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ILLNESSES, REGIONS } from "@/lib/healthwatch/data";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Data & Methodology — HEALTHWATCH" },
      {
        name: "description",
        content:
          "How HEALTHWATCH works: DOH Epidemiology Bureau dengue surveillance (2016–2021), per-region Prophet forecasting with a PAGASA wet/dry season regressor, percentile-based hotspot classification and walk-forward validation.",
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
      <h1 className="font-display text-3xl">Data &amp; Methodology</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        HEALTHWATCH is a regional time-series decision-support prototype for seasonal illness
        outbreak prediction and hotspot classification across the {REGIONS.length} administrative
        regions of the Philippines.
      </p>

      <Section title="Data sources">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>
            <strong>DOH Epidemiology Bureau dengue surveillance (2016–2021)</strong> — weekly
            reported dengue cases per PSGC-coded administrative region, published as an open
            research dataset (Mendeley Data, DOH-Epi dump). This is the backbone of every series in
            the system.
          </li>
          <li>
            <strong>PAGASA seasonal definition</strong> — the wet (June–November) / dry
            (December–May) split used as an exogenous regressor in the forecasting model.
          </li>
          <li>
            <strong>PSA PSGC boundaries</strong> — region-level GeoJSON used for the choropleth and
            for keying every record to a PSGC code.
          </li>
        </ul>
        <p className="mt-3 rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
          This dashboard runs live: case series, forecasts, risk tiers and validation metrics are
          served by a FastAPI backend reading from a SQLite database built entirely by the Python
          pipeline (<code>src/</code>). No values shown are synthetic.
        </p>
      </Section>

      <Section title="Model approach — how the forecast is trained">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/85">
          <li>
            <strong>Cleaning &amp; resampling.</strong> Raw regional reports are standardised to
            PSGC codes, deduplicated, converted to ISO week starting dates and resampled to
            contiguous weekly series per region.
          </li>
          <li>
            <strong>Feature engineering.</strong> Each week receives a PAGASA wet/dry season flag;
            non-negativity clipping is enforced on all counts before modelling.
          </li>
          <li>
            <strong>Forecasting model.</strong> One <strong>Prophet</strong> model per region
            (additive trend with automatic changepoint detection + Fourier yearly seasonality +
            wet/dry season regressor). Model parameters are learned from data via Bayesian
            estimation — this is the machine-learning step. The training window deliberately ends
            <strong> December 2019</strong>: the COVID-19 response collapsed routine dengue
            reporting from 2020 onward, and including those years would corrupt the learned trend.
          </li>
          <li>
            <strong>Horizon.</strong> Each regional model publishes a 12-week ahead forecast with
            uncertainty intervals, stored in the backend and rendered here with 95% bands.
          </li>
        </ol>
      </Section>

      <Section title="Validation — proving the model generalises">
        <p className="text-sm text-foreground/85">
          Models are evaluated on weeks they never saw, using two chronological holdout windows:
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground/85">
          <li>
            <strong>Pre-COVID window</strong> — the last 52 reported weeks before 2020 (primary
            quality measure).
          </li>
          <li>
            <strong>COVID stress-test</strong> — the final 52 weeks of the dataset (2020–2021),
            where reporting was disrupted; a model that still beats its baseline here is robust.
          </li>
        </ul>
        <p className="mt-3 text-sm text-foreground/85">
          Reported metrics per region: MAE, RMSE, MAPE, and{" "}
          <strong>skill versus a seasonal-naïve baseline</strong> (“same week last year”). The
          Prophet models beat the naïve baseline in 18 of 18 region-series during the COVID
          stress window and 12 of 18 pre-COVID. The confidence chip shown on each region page is
          derived from MAPE (&lt;15% high · 15–30% moderate · &gt;30% low).
        </p>
      </Section>

      <Section title="Hotspot classification">
        <p className="text-sm text-foreground/85">
          Risk tiers answer one question: <em>how abnormal is this week for this region?</em> Every
          region-week threshold comes from the region&rsquo;s <em>own</em> historical weekly
          distribution, restricted to a ±6-week calendar window around the target week, so
          dry-season lulls and sparsely populated regions are judged against their own seasonal
          norm:
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
          The pipeline stores the full 936-row region × week percentile table (P50/P75) used to
          grade tier accuracy: ~52% of validation weeks landed in the correct tier versus ~33%
          expected from random assignment across three classes.
        </p>
      </Section>

      <Section title="Deterministic rules enforced">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>Non-negativity: no predicted or lower-bound value may fall below zero.</li>
          <li>Season flagging: every week carries a PAGASA wet/dry tag, shaded on all charts.</li>
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
                Historical transmission peak ≈ week {i.peakWeek} ({i.season} season)
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Dengue is the pilot disease: it is notifiable, weekly-reported and strongly seasonal. The
          data contract (region × week series → forecast → tier) is disease-agnostic, so additional
          DOH surveillance tables can be added without UI changes.
        </p>
      </Section>

      <Section title="Limitations">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>
            <strong>COVID-era disruption.</strong> 2020–2021 reporting reflects altered healthcare-
            seeking behaviour; those years are excluded from training and used only as a
            stress-test window.
          </li>
          <li>
            <strong>Negative-skill regions.</strong> In 6 of 36 region-window validation runs —
            CAR, Caraga, NCR and Regions I, III and IV-B in the pre-COVID window — a seasonal-naive
            baseline outperformed the model by 11–22% MAPE. Outbreak timing in these areas was too
            irregular for the available history to learn reliably; the metrics panel surfaces each
            region's skill so low-confidence forecasts are visible rather than hidden.
          </li>
          <li>
            <strong>No intervention logs.</strong> LGU/DOH response activities are not published as
            structured open weekly data, so intervention panels are intentionally empty rather than
            showing estimated events.
          </li>
          <li>
            <strong>No weather map layers.</strong> Precipitation, temperature and humidity
            overlays were removed because they are not live feeds; the model's only
            weather-adjacent signal is the deterministic PAGASA wet/dry season flag.
          </li>
          <li>
            Region-level resolution only — province and city-level hotspots are a later phase.
          </li>
          <li>
            Weekly reporting cadence, with lag and under-reporting in remote areas biasing
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
      <h2 className="mb-3 font-display text-lg">{title}</h2>
      {children}
    </section>
  );
}
