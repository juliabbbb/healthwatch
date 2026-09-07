import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, ShieldAlert, TrendingDown, TrendingUp, X } from "lucide-react";
import { ClassificationInfo } from "@/components/hw/ClassificationInfo";
import { SEASON_CONFIG } from "@/components/hw/ForecastCard";
import { RiskBadge } from "@/components/hw/RiskBadge";
import {
  CURRENT_MONTH_INDEX,
  ILLNESSES,
  METRIC_META,
  REGIONS,
  RISK_META,
  assessRegion,
  formatMetric,
  metricValue,
  monthMeta,
  recommendations,
  seriesFor,
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
        name: "twitter:title",
        content: "Compare Regions — HEALTHWATCH",
      },
      {
        property: "og:description",
        content:
          "Benchmark Philippine regions on forecast case load, risk tier and intervention priorities with side-by-side trend sparklines and expandable intervention recommendations.",
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
  const [horizon, setHorizon] = useState(6);
  const [season, setSeason] = useState<"all" | "wet" | "dry">("all");
  const [mode, setMode] = useState<MetricMode>("percapita");

  // Floating expandable drawer state
  const [inspectedRegionCodes, setInspectedRegionCodes] = useState<string[]>(["130000000"]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const monthIndex = CURRENT_MONTH_INDEX + horizon;
  const rows = useMemo(
    () => selected.map((code) => assessRegion(code, illness, monthIndex, mode)),
    [selected, illness, monthIndex, mode],
  );

  const meta = METRIC_META[mode];

  // Global maximum across all selected regions in the sparkline window to ensure consistent scale
  const globalMax = useMemo(() => {
    let max = 1;
    for (const r of rows) {
      const series = seriesFor(r.region.code, illness);
      const windowSlice = series.slice(Math.max(0, monthIndex - 11), monthIndex + 1);
      for (const p of windowSlice) {
        const v = metricValue(p.cases, r.region, mode);
        if (v > max) max = v;
      }
    }
    return max;
  }, [rows, illness, monthIndex, mode]);

  const toggle = (code: string) => {
    setSelected((s) => {
      if (s.includes(code)) {
        if (s.length <= 1) return s; // keep at least one region
        const next = s.filter((c) => c !== code);
        setInspectedRegionCodes((prev) => prev.filter((c) => c !== code));
        return next;
      }
      return [...s, code];
    });
  };

  const toggleInspected = (code: string) => {
    setInspectedRegionCodes((prev) => {
      if (prev.includes(code)) {
        if (prev.length <= 1) return prev; // keep at least 1 inspected
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  const handleCardClick = (code: string) => {
    if (!inspectedRegionCodes.includes(code)) {
      setInspectedRegionCodes([code]);
    }
    setIsDrawerOpen(true);
  };

  const inspectedAssessments = useMemo(() => {
    return inspectedRegionCodes
      .map((code) => rows.find((r) => r.region.code === code))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [inspectedRegionCodes, rows]);

  const currentSeasonLabel =
    monthMeta(monthIndex).season === "wet" ? SEASON_CONFIG.wet.display : SEASON_CONFIG.dry.display;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 sm:px-6 py-8 pb-32">
      {/* Navigation & Header */}
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to map
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Comparative dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Side-by-side benchmark of Philippine regions on forecast load, risk tier and public
            health interventions · {monthMeta(monthIndex).label} ({currentSeasonLabel}) · ranked on{" "}
            {meta.label.toLowerCase()}
          </p>
        </div>
        <ClassificationInfo mode={mode} thresholds={rows[0]?.thresholds} />
      </div>

      {/* Filter Toolbar */}
      <div className="mt-6 space-y-3">
        {/* Region selector chips */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="label-caps text-[10px] text-muted-foreground/80">
              Selected Regions ({selected.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(["130000000", "040000000", "070000000", "110000000"])}
                className="text-[10px] text-primary hover:underline"
              >
                Key Metros
              </button>
              <span className="text-muted-foreground/40 text-[10px]">·</span>
              <button
                type="button"
                onClick={() => setSelected(REGIONS.map((r) => r.code))}
                className="text-[10px] text-primary hover:underline"
              >
                Select All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REGIONS.map((r) => (
              <Chip key={r.code} active={selected.includes(r.code)} onClick={() => toggle(r.code)}>
                {r.short}
              </Chip>
            ))}
          </div>
        </div>

        {/* Secondary filters (Illness, Horizon, Season, Mode) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {/* Illness */}
          <Chip active={illness === "all"} onClick={() => setIllness("all")}>
            All illnesses
          </Chip>
          {ILLNESSES.map((i) => (
            <Chip key={i.id} active={illness === i.id} onClick={() => setIllness(i.id)}>
              {i.shortName}
            </Chip>
          ))}

          <span className="mx-1.5 h-4 w-px bg-border/80" />

          {/* Forecast Horizon - Default 6m to match 6-month info panel horizon */}
          {[1, 3, 6, 12].map((h) => (
            <Chip key={h} active={horizon === h} onClick={() => setHorizon(h)}>
              {h}m {h === 6 ? "horizon" : ""}
            </Chip>
          ))}

          <span className="mx-1.5 h-4 w-px bg-border/80" />

          {/* Season convention */}
          {(["all", "wet", "dry"] as const).map((s) => (
            <Chip key={s} active={season === s} onClick={() => setSeason(s)}>
              {s === "all"
                ? "All seasons"
                : s === "wet"
                  ? SEASON_CONFIG.wet.display
                  : SEASON_CONFIG.dry.display}
            </Chip>
          ))}

          <span className="mx-1.5 h-4 w-px bg-border/80" />

          {/* Metric Mode */}
          {(["percapita", "raw"] as const).map((m) => (
            <Chip key={m} active={mode === m} onClick={() => setMode(m)}>
              {METRIC_META[m].short}
            </Chip>
          ))}
        </div>
      </div>

      {/* Part 2A: Side-by-Side Region Overview Cards */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2.5">
          <p className="label-caps text-[10px] text-muted-foreground/80 tracking-wider">
            Side-by-Side Regional Overview
          </p>
          <span className="text-[11px] text-muted-foreground">
            Tap a card to expand interventions · Global scale: 0–
            {formatMetric(globalMax, mode)} {meta.unit}
          </span>
        </div>

        <div className="flex gap-3.5 overflow-x-auto pb-4 pt-1 hw-scroll snap-x">
          {rows.map((a) => {
            const isInspected = isDrawerOpen && inspectedRegionCodes.includes(a.region.code);

            return (
              <div
                key={a.region.code}
                onClick={() => handleCardClick(a.region.code)}
                className={cn(
                  "group w-72 sm:w-80 shrink-0 snap-start flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 cursor-pointer select-none",
                  isInspected
                    ? "border-primary/70 bg-primary/5 ring-2 ring-primary/20 shadow-md"
                    : "border-border/70 bg-card/60 hover:border-primary/40 hover:bg-card/90 hover:shadow-xs",
                )}
              >
                <div>
                  {/* Card Header: Region short code, density & remove toggle */}
                  <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="label-caps font-semibold text-foreground">
                          {a.region.short}
                        </span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {a.region.classification}
                        </span>
                      </div>
                      <h2 className="text-sm font-semibold text-foreground truncate mt-0.5">
                        {a.region.name}
                      </h2>
                      <p className="text-[10px] text-muted-foreground">
                        {a.region.density.toLocaleString()} persons/km²
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <RiskBadge risk={a.risk} />
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(a.region.code);
                          }}
                          aria-label={`Remove ${a.region.short} from comparison`}
                          className="rounded-md p-1 text-muted-foreground/60 hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Primary Key Metric & Stats */}
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <div>
                      <p className="text-[9px] uppercase font-semibold tracking-wider text-muted-foreground">
                        Predicted · {meta.unit}
                      </p>
                      <p className="font-mono text-2xl font-bold tabular-nums text-foreground leading-tight">
                        {formatMetric(a.value, mode)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase font-medium tracking-wider text-muted-foreground">
                        3-Mo Trend
                      </p>
                      <span
                        className="inline-flex items-center gap-1 font-mono text-xs font-semibold"
                        style={{
                          color: a.changePct >= 0 ? "var(--risk-high)" : "var(--risk-low)",
                        }}
                      >
                        {a.changePct >= 0 ? (
                          <TrendingUp className="size-3 shrink-0" />
                        ) : (
                          <TrendingDown className="size-3 shrink-0" />
                        )}
                        {a.changePct >= 0 ? "+" : ""}
                        {a.changePct}%
                      </span>
                    </div>
                  </div>

                  {/* Stat badges */}
                  <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    <div className="rounded-md bg-secondary/40 border border-border/40 px-2 py-1">
                      <span className="text-[8px] uppercase font-medium tracking-wider text-muted-foreground block">
                        Nat'l Percentile
                      </span>
                      <span className="font-mono text-xs font-semibold text-foreground block">
                        {a.percentileRank}th %ile
                      </span>
                    </div>
                    <div className="rounded-md bg-secondary/40 border border-border/40 px-2 py-1">
                      <span className="text-[8px] uppercase font-medium tracking-wider text-muted-foreground block">
                        Dominant Illness
                      </span>
                      <span className="text-xs font-semibold text-foreground truncate block">
                        {a.dominantIllness.shortName}
                      </span>
                    </div>
                  </div>

                  {/* Scaled Mini Sparkline Chart */}
                  <div className="mt-3.5">
                    <RegionSparkline
                      regionCode={a.region.code}
                      illness={illness}
                      monthIndex={monthIndex}
                      mode={mode}
                      globalMax={globalMax}
                      riskColor={RISK_META[a.risk].color}
                    />
                  </div>
                </div>

                {/* Card Footer Action Indicator */}
                <div className="mt-4 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-medium transition-colors",
                      isInspected
                        ? "text-primary font-semibold"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <ShieldAlert className="size-3.5 shrink-0" />
                    {isInspected ? "Inspecting actions" : "View interventions"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/80 font-mono">
                    95% CI: {formatMetric(metricValue(a.point.lower, a.region, mode), mode)}–
                    {formatMetric(metricValue(a.point.upper, a.region, mode), mode)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Part 2C: Summary Comparison Table */}
      <section className="mt-6 rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/30">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Regional Benchmark Reference Table
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Cross-regional risk tiers, predicted volume, confidence bands and dominant pathology
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {rows.length} region{rows.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="label-caps">
              <tr className="border-b border-border/60 bg-secondary/15">
                <th className="px-4 py-2.5">Region</th>
                <th>Risk</th>
                <th className="text-right">Predicted ({meta.unit})</th>
                <th className="text-right">95% CI</th>
                <th className="text-right">Percentile</th>
                <th className="text-right">3m Change</th>
                <th>Dominant Illness</th>
                <th className="pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.region.code}
                  className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium">
                    <Link
                      to="/region/$code"
                      params={{ code: a.region.code }}
                      className="hover:text-primary transition-colors inline-flex items-center gap-1.5"
                    >
                      <span>{a.region.name}</span>
                      <span className="label-caps text-[9px] text-muted-foreground">
                        ({a.region.short})
                      </span>
                    </Link>
                  </td>
                  <td className="py-2.5">
                    <RiskBadge risk={a.risk} />
                  </td>
                  <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                    {formatMetric(a.value, mode)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                    {formatMetric(metricValue(a.point.lower, a.region, mode), mode)}–
                    {formatMetric(metricValue(a.point.upper, a.region, mode), mode)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{a.percentileRank}th</td>
                  <td
                    className="py-2.5 text-right font-mono tabular-nums font-medium"
                    style={{
                      color: a.changePct >= 0 ? "var(--risk-high)" : "var(--risk-low)",
                    }}
                  >
                    {a.changePct >= 0 ? "+" : ""}
                    {a.changePct}%
                  </td>
                  <td className="py-2.5">{a.dominantIllness.shortName}</td>
                  <td className="py-2.5 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleCardClick(a.region.code)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <ShieldAlert className="size-3" /> Interventions
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Clutter-reduced synchronized season footnote */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border/40 pt-3">
        <p>
          PAGASA climatological boundaries: Wet season ({SEASON_CONFIG.wet.months}) · Dry season (
          {SEASON_CONFIG.dry.months}). Fixed calendar rules ensure deterministic, reproducible
          surveillance.
        </p>
        <p className="font-mono text-[10px]">
          Operational horizon: {horizon}m · Metric: {meta.label}
        </p>
      </div>

      {/* Part 2B: Expandable Floating / Docked Interventions Drawer */}
      {isDrawerOpen && inspectedAssessments.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none px-3 sm:px-6 pb-0">
          <div className="pointer-events-auto max-h-[82vh] w-full max-w-7xl rounded-t-2xl border-t border-x border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Drawer Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3.5 bg-card/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="rounded-lg bg-primary/15 p-1.5 text-primary">
                  <ShieldAlert className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Public Health Interventions & Assessment Detail
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {inspectedAssessments.length === 1
                      ? `Viewing recommended actions for ${inspectedAssessments[0]?.region.name}`
                      : `Comparing recommended actions across ${inspectedAssessments.length} regions`}
                  </p>
                </div>
              </div>

              {/* Drawer Controls: Region Toggles & Dismiss Button */}
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => setInspectedRegionCodes(rows.map((r) => r.region.code))}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                      inspectedRegionCodes.length === rows.length
                        ? "bg-primary/20 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    All ({rows.length})
                  </button>
                  {rows.map((r) => {
                    const isInspected = inspectedRegionCodes.includes(r.region.code);
                    return (
                      <button
                        key={r.region.code}
                        type="button"
                        onClick={() => toggleInspected(r.region.code)}
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                          isInspected
                            ? "bg-primary/20 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {r.region.short}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Dismiss interventions drawer"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Drawer Body: Distinct labeled sub-sections per inspected region */}
            <div className="overflow-y-auto p-5 hw-scroll max-h-[calc(82vh-4.5rem)] space-y-4">
              <div
                className={cn(
                  "grid gap-4",
                  inspectedAssessments.length === 1
                    ? "grid-cols-1"
                    : inspectedAssessments.length === 2
                      ? "grid-cols-1 md:grid-cols-2"
                      : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
                )}
              >
                {inspectedAssessments.map((a) => {
                  const recs = recommendations(a);
                  return (
                    <div
                      key={a.region.code}
                      className="flex flex-col justify-between rounded-xl border border-border/80 bg-secondary/20 p-4 shadow-xs"
                    >
                      <div>
                        {/* Labeled Sub-section Header */}
                        <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="label-caps font-semibold text-foreground">
                                {a.region.short}
                              </span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[11px] text-muted-foreground">
                                {a.region.classification}
                              </span>
                            </div>
                            <h4 className="text-sm font-semibold text-foreground truncate mt-0.5">
                              {a.region.name}
                            </h4>
                          </div>
                          <RiskBadge risk={a.risk} />
                        </div>

                        {/* Status diagnostic rationale */}
                        <div className="mt-2.5 rounded-lg border border-border/50 bg-card/50 p-2.5 space-y-1 text-xs">
                          <p className="text-muted-foreground text-[11px]">
                            Triggered by a{" "}
                            <span className="font-semibold text-foreground capitalize">
                              {a.risk}
                            </span>{" "}
                            tier at{" "}
                            <span className="font-mono font-bold text-foreground">
                              {formatMetric(a.value, mode)} {meta.unit}
                            </span>{" "}
                            ({a.percentileRank}th national percentile).
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-muted-foreground border-t border-border/40">
                            <span>
                              95% CI:{" "}
                              <span className="font-mono text-foreground">
                                {formatMetric(metricValue(a.point.lower, a.region, mode), mode)}–
                                {formatMetric(metricValue(a.point.upper, a.region, mode), mode)}
                              </span>
                            </span>
                            <span>
                              Dominant:{" "}
                              <span className="font-medium text-foreground">
                                {a.dominantIllness.shortName}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Public Health Interventions List */}
                        <div className="mt-3">
                          <p className="label-caps text-[9px] text-muted-foreground mb-2">
                            Recommended Interventions ({recs.length})
                          </p>
                          <ul className="space-y-2">
                            {recs.map((r) => (
                              <li
                                key={r.title}
                                className="rounded-lg border border-border/60 bg-card/70 p-2.5"
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <p className="text-xs font-semibold text-foreground">{r.title}</p>
                                  <RiskBadge risk={r.urgency} />
                                </div>
                                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                                  {r.detail}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Region Analysis Link CTA */}
                      <div className="mt-4 pt-3 border-t border-border/50">
                        <Link
                          to="/region/$code"
                          params={{ code: a.region.code }}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                        >
                          Open full {a.region.short} analysis <ArrowUpRight className="size-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Re-open Button when Drawer is Dismissed */}
      {!isDrawerOpen && (
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-lg hover:shadow-xl hover:opacity-95 transition-all animate-in fade-in duration-200"
        >
          <ShieldAlert className="size-4" />
          <span>View Interventions ({inspectedAssessments.length})</span>
        </button>
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
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] capitalize transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary font-medium"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface SparklineProps {
  regionCode: string;
  illness: string;
  monthIndex: number;
  mode: MetricMode;
  globalMax: number;
  riskColor: string;
}

function RegionSparkline({
  regionCode,
  illness,
  monthIndex,
  mode,
  globalMax,
  riskColor,
}: SparklineProps) {
  const series = seriesFor(regionCode, illness);
  const region = useMemo(() => REGIONS.find((r) => r.code === regionCode)!, [regionCode]);

  // Recent 12-month window up to target assessment month
  const windowSlice = useMemo(() => {
    return series.slice(Math.max(0, monthIndex - 11), monthIndex + 1);
  }, [series, monthIndex]);

  const width = 260;
  const height = 52;
  const padTop = 6;
  const padBottom = 8;
  const drawHeight = height - padTop - padBottom;
  const effectiveMax = Math.max(0.01, globalMax);

  const points = useMemo(() => {
    return windowSlice.map((p, i) => {
      const v = metricValue(p.cases, region, mode);
      const x =
        windowSlice.length <= 1 ? width / 2 : (i / (windowSlice.length - 1)) * (width - 16) + 8;
      const y = padTop + drawHeight - (Math.min(v, effectiveMax) / effectiveMax) * drawHeight;
      return { x, y, v, forecast: p.forecast, label: p.label };
    });
  }, [windowSlice, region, mode, effectiveMax, drawHeight]);

  if (points.length === 0) return null;

  const linePath = points.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const lastPoint = points[points.length - 1]!;
  const firstPoint = points[0]!;
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${height - padBottom} L ${firstPoint.x.toFixed(1)} ${height - padBottom} Z`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
        <span>
          12-Mo Trend ({firstPoint.label}–{lastPoint.label})
        </span>
        <span className="font-mono tabular-nums">Peak {formatMetric(effectiveMax, mode)}</span>
      </div>
      <div className="relative h-[52px] w-full rounded-md bg-secondary/30 border border-border/40 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`grad-${regionCode}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={riskColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={riskColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Reference line for 50% scale */}
          <line
            x1="8"
            y1={padTop + drawHeight / 2}
            x2={width - 8}
            y2={padTop + drawHeight / 2}
            stroke="var(--border)"
            strokeDasharray="2 3"
            strokeWidth="0.8"
          />

          {/* Area fill */}
          <path d={areaPath} fill={`url(#grad-${regionCode})`} />

          {/* Trend line */}
          <path
            d={linePath}
            fill="none"
            stroke={riskColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Highlight end point */}
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3.5"
            fill="var(--background)"
            stroke={riskColor}
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
}
