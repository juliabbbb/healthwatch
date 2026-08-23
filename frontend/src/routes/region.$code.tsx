import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, GitCompare } from "lucide-react";
import { AcfChart, DecompositionChart, ForecastChart } from "@/components/hw/Charts";
import { ClassificationInfo } from "@/components/hw/ClassificationInfo";
import { InterventionPanel } from "@/components/hw/InterventionPanel";
import { RiskBadge, SeasonTag } from "@/components/hw/RiskBadge";
import {
  CURRENT_WEEK_INDEX,
  HIST_WEEKS,
  ILLNESSES,
  REGION_BY_CODE,
  assessRegion,
  climate,
  interventions,
  seriesFor,
  weekMeta,
} from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/region/$code")({
  loader: ({ params }) => {
    const region = REGION_BY_CODE[params.code];
    if (!region) throw notFound();
    return { name: region.name, short: region.short };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Region unavailable — HEALTHWATCH" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.name} outbreak forecast — HEALTHWATCH`;
    const description = `Seasonal decomposition, 12-week case forecast, hotspot risk classification and recommended interventions for ${loaderData.name} (${loaderData.short}).`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: RegionDetail,
});

const HORIZONS = [4, 8, 12];

function RegionDetail() {
  const { code } = Route.useParams();
  const region = REGION_BY_CODE[code]!;
  const [illness, setIllness] = useState("all");
  const [horizon, setHorizon] = useState(12);
  const [seasonFilter, setSeasonFilter] = useState<"all" | "wet" | "dry">("all");

  const a = assessRegion(code, illness, CURRENT_WEEK_INDEX + horizon);
  const series = seriesFor(code, illness);
  const forecastRows = series
    .slice(HIST_WEEKS, HIST_WEEKS + horizon)
    .filter((p) => seasonFilter === "all" || p.season === seasonFilter);
  const events = interventions(code).slice(-8).reverse();
  const clim = climate(code);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to map
          </Link>
          <h1 className="font-display text-3xl">{region.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            PSGC {region.code} · {region.short} · {region.island} · {region.classification} ·{" "}
            {region.population.toLocaleString()} population · {region.density.toLocaleString()}{" "}
            persons/km²
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge risk={a.risk} size="md" />
          <SeasonTag season={weekMeta(a.weekIndex).season} />
          <ClassificationInfo mode={a.mode} thresholds={a.thresholds} label="Risk method" />
          <Link
            to="/compare"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            <GitCompare className="size-3.5" /> Compare
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Chip active={illness === "all"} onClick={() => setIllness("all")}>
          All illnesses
        </Chip>
        {ILLNESSES.map((i) => (
          <Chip key={i.id} active={illness === i.id} onClick={() => setIllness(i.id)}>
            {i.name}
          </Chip>
        ))}
        <span className="mx-2 h-5 w-px bg-border" />
        {HORIZONS.map((h) => (
          <Chip key={h} active={horizon === h} onClick={() => setHorizon(h)}>
            {h}-week horizon
          </Chip>
        ))}
        <span className="mx-2 h-5 w-px bg-border" />
        {(["all", "wet", "dry"] as const).map((s) => (
          <Chip key={s} active={seasonFilter === s} onClick={() => setSeasonFilter(s)}>
            {s === "all" ? "All seasons" : `${s} season`}
          </Chip>
        ))}
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label={`Predicted (${weekMeta(a.weekIndex).label})`}
          value={a.point.cases.toLocaleString()}
          sub={`CI ${a.point.lower.toLocaleString()}–${a.point.upper.toLocaleString()}`}
        />
        <Kpi
          label="Historical percentile"
          value={`${a.percentileRank}th`}
          sub={`P50 ${Math.round(a.thresholds.p50).toLocaleString()} · P75 ${Math.round(a.thresholds.p75).toLocaleString()}`}
        />
        <Kpi
          label="4-week change"
          value={`${a.changePct >= 0 ? "+" : ""}${a.changePct}%`}
          sub="vs. same series 4 weeks prior"
        />
        <Kpi
          label="Dominant illness"
          value={a.dominantIllness.shortName}
          sub={a.dominantIllness.driver}
        />
      </div>

      {/* Forecast */}
      <Panel
        title="Case volume forecast"
        subtitle={`Reported 2016–2021 with ${horizon}-week predicted horizon and 95% interval, wet-season shading.`}
      >
        <ForecastChart regionCode={code} illness={illness} horizon={horizon} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="label-caps">
              <tr>
                <th className="py-1.5">Week</th>
                <th>Season</th>
                <th className="text-right">Predicted</th>
                <th className="text-right">Lower</th>
                <th className="text-right">Upper</th>
              </tr>
            </thead>
            <tbody>
              {forecastRows.map((p) => (
                <tr key={p.index} className="border-t border-border">
                  <td className="py-1.5">{p.label}</td>
                  <td className="capitalize text-muted-foreground">{p.season}</td>
                  <td className="text-right tabular-nums">{p.cases.toLocaleString()}</td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {p.lower.toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {p.upper.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Decomposition */}
      <Panel
        title="Seasonal pattern decomposition"
        subtitle="Observed series split into trend, week-of-year seasonality and irregular residual (STL-equivalent)."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {(["observed", "trend", "seasonal", "residual"] as const).map((c) => (
            <div key={c}>
              <p className="label-caps mb-1">{c}</p>
              <DecompositionChart regionCode={code} illness={illness} component={c} />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <p className="label-caps mb-1">Autocorrelation (lag in weeks)</p>
          <AcfChart regionCode={code} illness={illness} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            The marked spike at lag 52 confirms a recurring annual outbreak cycle for this region.
          </p>
          <Link
            to="/seasonality"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Open seasonal pattern identification
          </Link>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Intervention recommendations">
          <InterventionPanel assessment={a} />
        </Panel>

        <Panel
          title="Intervention history"
          subtitle="Recorded LGU and DOH response activities."
        >
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No public intervention logs are available for this region. DOH and LGU response
              activities are not published as structured weekly open data, so this panel is left
              empty rather than showing estimated events.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li
                  key={`${e.weekIndex}-${e.type}`}
                  className="flex gap-3 border-b border-border pb-2 text-xs last:border-0"
                >
                  <span className="w-20 shrink-0 text-muted-foreground">{e.date}</span>
                  <span>
                    <span className="font-medium">{e.type}</span>
                    <span className="block text-muted-foreground">{e.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Environmental indicators"
        subtitle="PAGASA climatological normals used as exogenous seasonal drivers."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="label-caps">
              <tr>
                <th className="py-1.5">Month</th>
                {clim.map((c) => (
                  <th key={c.month} className="text-right">
                    {c.month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Rainfall (mm)" values={clim.map((c) => c.rainfall)} />
              <Row label="Mean temp (°C)" values={clim.map((c) => c.temp)} />
              <Row label="Humidity (%)" values={clim.map((c) => c.humidity)} />
              <tr className="border-t border-border">
                <td className="py-1.5 text-muted-foreground">Season</td>
                {clim.map((c) => (
                  <td
                    key={c.month}
                    className="text-right capitalize"
                    style={{ color: c.season === "wet" ? "var(--wet)" : "var(--dry)" }}
                  >
                    {c.season}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </main>
  );
}

function Row({ label, values }: { label: string; values: number[] }) {
  return (
    <tr className="border-t border-border">
      <td className="py-1.5 text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="text-right tabular-nums">
          {v}
        </td>
      ))}
    </tr>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-card/40 p-4">
      <h2 className="font-display text-lg">{title}</h2>
      {subtitle && <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      {children}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] capitalize transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
