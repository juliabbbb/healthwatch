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
          "Data sources, forecasting approach, classification thresholds and known limitations behind the HEALTHWATCH Philippine outbreak prediction system.",
      },
      { property: "og:title", content: "Data & Methodology — HEALTHWATCH" },
      {
        property: "og:description",
        content:
          "DOH PIDSR surveillance, PAGASA seasonal indicators, STL decomposition and percentile-based hotspot classification.",
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
            <strong>DOH PIDSR weekly surveillance (2017–2023)</strong> — reported case counts per
            region and illness, the backbone of the historical series.
          </li>
          <li>
            <strong>Mendeley Philippine disease &amp; epidemiological datasets</strong> —
            supplementary morbidity records used for cross-validation of regional baselines.
          </li>
          <li>
            <strong>PAGASA climatological normals</strong> — monthly rainfall, mean temperature and
            relative humidity, plus the wet (June–November) / dry (December–May) season split.
          </li>
          <li>
            <strong>PSA PSGC boundaries</strong> — region-level GeoJSON used for the choropleth and
            for keying every record to a PSGC code.
          </li>
          <li>
            <strong>LGU intervention logs</strong> — dated cleanup drives, vector-control
            operations, vaccination campaigns and supply pre-positioning, annotated on all charts.
          </li>
        </ul>
        <p className="mt-3 rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
          This build runs on a deterministic seeded surrogate of the above sources so the interface
          is fully demoable. Swap <code>src/lib/healthwatch/data.ts</code> for reads against the
          <code> forecasts</code> table to wire in the live pipeline — the UI contract does not
          change.
        </p>
      </Section>

      <Section title="Model approach">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/85">
          <li>
            <strong>Decomposition.</strong> Each region × illness weekly series is split into trend
            (centered 52-week moving average), seasonality (week-of-year mean of the detrended
            series) and irregular residual — an STL-equivalent structure.
          </li>
          <li>
            <strong>Cycle detection.</strong> The autocorrelation function is computed to lag 60;
            the spike at lag 52 confirms the annual transmission cycle used by the forecaster.
          </li>
          <li>
            <strong>Forecasting.</strong> Seasonal-naive plus trend and ENSO drift generate a 4–12
            week horizon. Production runs replace this with Prophet / SARIMA / XGBoost trained
            offline in Python, publishing point forecasts and intervals into the backend table.
          </li>
          <li>
            <strong>Intervals.</strong> Confidence bands widen roughly 2 percentage points per week
            of horizon and are clamped at zero.
          </li>
        </ol>
      </Section>

      <Section title="Hotspot classification">
        <p className="text-sm text-foreground/85">
          Each region is classified against its <em>own</em> 2017–2023 weekly distribution for the
          selected illness filter, restricted to a ±6-week calendar window around the target week,
          so dry-season lulls and sparsely populated regions are judged against their own seasonal
          norm:
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li>
            <span className="font-medium" style={{ color: "var(--risk-low)" }}>
              Low
            </span>{" "}
            — predicted cases below the 50th percentile.
          </li>
          <li>
            <span className="font-medium" style={{ color: "var(--risk-moderate)" }}>
              Moderate
            </span>{" "}
            — between the 50th and 75th percentile.
          </li>
          <li>
            <span className="font-medium" style={{ color: "var(--risk-high)" }}>
              High
            </span>{" "}
            — above the 75th percentile.
          </li>
        </ul>
      </Section>

      <Section title="Epidemiological rules enforced">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>Non-negativity: no predicted or lower-bound value may fall below zero.</li>
          <li>Season flagging: every week carries a PAGASA wet/dry tag, shaded on all charts.</li>
          <li>
            Intervention awareness: historical LGU campaigns are marked on the timeline so drops in
            case counts are read as response effects, not model noise.
          </li>
          <li>
            Illness-specific drivers are surfaced with each forecast rather than bare numbers.
          </li>
        </ul>
      </Section>

      <Section title="Illnesses tracked">
        <div className="grid gap-3 sm:grid-cols-2">
          {ILLNESSES.map((i) => (
            <div key={i.id} className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-sm font-medium">{i.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{i.driver}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Climatological peak ≈ week {i.peakWeek} ({i.season} season)
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Limitations">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>
            No real-time IoT sensor or live hospital admission feeds; weekly reporting cadence.
          </li>
          <li>
            Region-level resolution only — province and city-level hotspots are a later phase.
          </li>
          <li>Rare and non-seasonal diseases are out of scope by design.</li>
          <li>
            Reporting lag and under-reporting in remote areas bias historical baselines downward.
          </li>
          <li>
            Forecasts are advisory. They inform intervention planning; they do not replace clinical
            or epidemiological judgment.
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
