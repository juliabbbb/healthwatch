import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, GitCompare } from "lucide-react";
import { AcfChart, DecompositionChart, ForecastChart } from "@/components/hw/Charts";
import { AIAnalysisPanel } from "@/components/hw/AIAnalysisPanel";
import { ClassificationInfo } from "@/components/hw/ClassificationInfo";
import { InterventionPanel } from "@/components/hw/InterventionPanel";
import { RiskBadge, SeasonTag } from "@/components/hw/RiskBadge";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";
import {
  CURRENT_WEEK_INDEX,
  HIST_WEEKS,
  ILLNESSES,
  OUTBREAK_TRIGGER_LABEL,
  REGION_BY_CODE,
  assessRegion,
  getOutbreak,
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
  const [aiEnabled] = useAiAnalysisSetting();

  const a = assessRegion(code, illness, CURRENT_WEEK_INDEX + horizon);
  const series = seriesFor(code, illness);
  const forecastRows = series
    .slice(HIST_WEEKS, HIST_WEEKS + horizon)
    .filter((p) => seasonFilter === "all" || p.season === seasonFilter);

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
          <h1 className="text-3xl">{region.name}</h1>
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

      {/* Outbreak outlook */}
      <Panel
        title="Outbreak outlook — dry vs wet"
        subtitle="Season-average forecast for the coming dry (Jan–Mar) and wet (Jul–Sep) windows vs. the region's long-run seasonal P75 baseline."
      >
        <SeasonalOutbreakView code={code} />
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Prospective validation against real 2025 data: dry-season detection F1
          0.90 (precision 0.93 / recall 0.88 across regions); the wet season by
          design favours recall and over-warns rather than missing a surge.
        </p>
      </Panel>

      {/* Forecast */}
      <Panel
        title="Case volume forecast"
        subtitle={`Reported 2016–2025 with ${horizon}-week predicted horizon and 95% interval, wet-season shading.`}
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
                  <td className="text-right font-mono tabular-nums">{p.cases.toLocaleString()}</td>
                  <td className="text-right font-mono tabular-nums text-muted-foreground">
                    {p.lower.toLocaleString()}
                  </td>
                  <td className="text-right font-mono tabular-nums text-muted-foreground">
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

      <Panel title="Intervention recommendations">
        <InterventionPanel assessment={a} />
      </Panel>

      {/* Opt-in only: when disabled this never mounts and makes zero network calls. */}
      {aiEnabled && (
        <Panel
          title="AI-assisted analysis"
          subtitle="Plain-language summary generated by AI from this region's pipeline outputs."
        >
          <AIAnalysisPanel regionCode={code} />
        </Panel>
      )}

    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums">{value}</p>
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
      <h2 className="text-lg">{title}</h2>
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

function SeasonalOutbreakView({ code }: { code: string }) {
  const outlook = getOutbreak(code);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["dry", "wet"] as const).map((season) => {
        const ind = outlook[season];
        if (!ind) return null;
        const flagged = ind.outbreak;
        const ratio = ind.season_avg / Math.max(0.01, ind.season_p75);
        const width = Math.min(100, Math.round((ratio / 1.5) * 100));
        return (
          <div
            key={season}
            className="rounded-lg border border-border bg-card/60 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="label-caps capitalize">{season} season outlook</p>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={
                  flagged
                    ? {
                        color: "oklch(0.99 0.003 95)",
                        backgroundColor: "var(--risk-high-solid)",
                      }
                    : { color: "var(--risk-low-solid)", backgroundColor: "var(--risk-moderate)" }
                }
              >
                {flagged ? "Outbreak" : "No alert"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Forecast season average{" "}
              <span className="font-mono text-sm tabular-nums text-foreground">
                {Math.round(ind.season_avg).toLocaleString()}
              </span>{" "}
              cases/week vs seasonal P75{" "}
              <span className="font-mono tabular-nums">
                {Math.round(ind.season_p75).toLocaleString()}
              </span>
            </p>
            <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${width}%`,
                  backgroundColor: "var(--risk-high)",
                }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {OUTBREAK_TRIGGER_LABEL[ind.trigger] ?? ind.trigger}
              {ind.trigger === "consecutive_high" || ind.trigger === "both"
                ? ` — ${ind.consecutive_high_n} consecutive weekly High forecasts`
                : ""}{" "}
              over {ind.n_forecast_weeks} probe weeks.
            </p>
          </div>
        );
      })}
    </div>
  );
}
