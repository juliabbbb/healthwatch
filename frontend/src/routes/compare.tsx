import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ForecastChart } from "@/components/hw/Charts";
import { ClassificationInfo } from "@/components/hw/ClassificationInfo";
import { InterventionPanel } from "@/components/hw/InterventionPanel";
import { RiskBadge } from "@/components/hw/RiskBadge";
import {
  CURRENT_WEEK_INDEX,
  ILLNESSES,
  METRIC_META,
  REGIONS,
  RISK_META,
  assessRegion,
  formatMetric,
  metricValue,
  weekMeta,
  type MetricMode,
} from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Regions — HEALTHWATCH" },
      {
        name: "description",
        content:
          "Side-by-side comparison of Philippine regions by predicted case volume, hotspot risk classification and recommended public health interventions.",
      },
      { property: "og:title", content: "Compare Regions — HEALTHWATCH" },
      {
        property: "og:description",
        content:
          "Benchmark two or more Philippine regions on forecast case load, risk tier and intervention priorities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

export default function ComparePage() {
  const [selected, setSelected] = useState<string[]>(["130000000", "040000000", "070000000"]);
  const [illness, setIllness] = useState("all");
  const [horizon, setHorizon] = useState(8);
  const [season, setSeason] = useState<"all" | "wet" | "dry">("all");
  const [mode, setMode] = useState<MetricMode>("percapita");

  const weekIndex = CURRENT_WEEK_INDEX + horizon;
  const rows = useMemo(
    () => selected.map((code) => assessRegion(code, illness, weekIndex, mode)),
    [selected, illness, weekIndex, mode],
  );

  const meta = METRIC_META[mode];
  const maxValue = Math.max(1, ...rows.map((r) => r.value));

  const toggle = (code: string) =>
    setSelected((s) =>
      s.includes(code) ? s.filter((c) => c !== code) : s.length >= 4 ? s : [...s, code],
    );

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to map
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Comparative dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Benchmark up to four regions on forecast load, risk tier and intervention priority ·{" "}
            {weekMeta(weekIndex).label} ({weekMeta(weekIndex).season} season) · ranked on{" "}
            {meta.label.toLowerCase()}
          </p>
        </div>
        <ClassificationInfo mode={mode} thresholds={rows[0]?.thresholds} />
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <Chip key={r.code} active={selected.includes(r.code)} onClick={() => toggle(r.code)}>
              {r.short}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={illness === "all"} onClick={() => setIllness("all")}>
            All illnesses
          </Chip>
          {ILLNESSES.map((i) => (
            <Chip key={i.id} active={illness === i.id} onClick={() => setIllness(i.id)}>
              {i.shortName}
            </Chip>
          ))}
          <span className="mx-2 h-5 w-px bg-border" />
          {[4, 8, 12].map((h) => (
            <Chip key={h} active={horizon === h} onClick={() => setHorizon(h)}>
              {h}w
            </Chip>
          ))}
          <span className="mx-2 h-5 w-px bg-border" />
          {(["all", "wet", "dry"] as const).map((s) => (
            <Chip key={s} active={season === s} onClick={() => setSeason(s)}>
              {s === "all" ? "All seasons" : `${s} season`}
            </Chip>
          ))}
          <span className="mx-2 h-5 w-px bg-border" />
          {(["percapita", "raw"] as const).map((m) => (
            <Chip key={m} active={mode === m} onClick={() => setMode(m)}>
              {METRIC_META[m].short}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card/40">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="label-caps">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5">Region</th>
              <th>Risk</th>
              <th className="text-right">Predicted ({meta.unit})</th>
              <th className="text-right">95% CI</th>
              <th className="text-right">Percentile</th>
              <th className="text-right">4w change</th>
              <th>Dominant illness</th>
              <th className="pr-4">Relative load</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.region.code} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">
                  <Link
                    to="/region/$code"
                    params={{ code: a.region.code }}
                    className="hover:text-primary"
                  >
                    {a.region.name}
                  </Link>
                </td>
                <td>
                  <RiskBadge risk={a.risk} />
                </td>
                <td className="text-right tabular-nums">{formatMetric(a.value, mode)}</td>
                <td className="text-right tabular-nums text-muted-foreground">
                  {formatMetric(metricValue(a.point.lower, a.region, mode), mode)}–
                  {formatMetric(metricValue(a.point.upper, a.region, mode), mode)}
                </td>
                <td className="text-right tabular-nums">{a.percentileRank}th</td>
                <td
                  className="text-right tabular-nums"
                  style={{ color: a.changePct >= 0 ? "var(--risk-high)" : "var(--risk-low)" }}
                >
                  {a.changePct >= 0 ? "+" : ""}
                  {a.changePct}%
                </td>
                <td>{a.dominantIllness.shortName}</td>
                <td className="py-2.5 pr-4">
                  {/* Choropleth-matched bar: same risk colour ramp as the map. */}
                  <span className="block h-1.5 w-full max-w-[140px] rounded-full bg-secondary">
                    <span
                      className="block h-1.5 rounded-full"
                      style={{
                        width: `${Math.max(6, (a.value / maxValue) * 100)}%`,
                        backgroundColor: RISK_META[a.risk].color,
                      }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {rows.map((a) => (
          <section key={a.region.code} className="rounded-xl border border-border bg-card/40 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-display text-base">{a.region.name}</h2>
              <RiskBadge risk={a.risk} />
            </div>
            <ForecastChart
              regionCode={a.region.code}
              illness={illness}
              horizon={horizon}
              weeksBack={52}
              height={220}
              mode={mode}
            />
            <div className="mt-3 border-t border-border pt-3">
              <InterventionPanel assessment={a} limit={3} compact />
            </div>
          </section>
        ))}
      </div>
      {season !== "all" && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          Season filter applied to chart shading and intervention context: showing {season}-season
          emphasis (June–November is the PAGASA wet season).
        </p>
      )}
    </main>
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
