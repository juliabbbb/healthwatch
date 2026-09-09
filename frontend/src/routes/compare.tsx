import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  History,
  Info,
  Layers,
  Maximize2,
  FileDown,
  SlidersHorizontal,
  Table,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { ClassificationInfo } from "@/components/hw/ClassificationInfo";
import { SEASON_CONFIG } from "@/components/hw/ForecastCard";
import { RiskBadge } from "@/components/hw/RiskBadge";
import { ExportCustomizationModal } from "@/components/modals/ExportCustomizationModal";
import {
  CURRENT_MONTH_INDEX,
  HIST_MONTHS,
  ILLNESSES,
  METRIC_META,
  REGIONS,
  RISK_META,
  TOTAL_MONTHS,
  assessRegion,
  formatMetric,
  getCurrentMonthPHT,
  metricValue,
  modelMetrics,
  monthMeta,
  recommendations,
  seriesFor,
  type MetricMode,
  type RegionAssessment,
} from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): { baseline?: string; horizon?: number } => {
    const rawBaseline = search["baseline"];
    const rawHorizon = search["horizon"];
    const res: { baseline?: string; horizon?: number } = {};
    if (typeof rawBaseline === "string" && rawBaseline) {
      res.baseline = rawBaseline;
    } else {
      res.baseline = getCurrentMonthPHT();
    }
    if (typeof rawHorizon === "number") {
      res.horizon = rawHorizon;
    }
    return res;
  },
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
  const search = Route.useSearch();
  // Spec #1: Top region selection row is the single source of truth (starts empty per #2)
  const [selected, setSelected] = useState<string[]>([]);
  const [illness, setIllness] = useState("all");

  // Spec #2: Month slider extended to include past & forecast months (-12m to +12m)
  // Default to 0m (Current baseline Now: 2026-09)
  const [horizon, setHorizon] = useState<number>(() => search.horizon ?? 0);
  const [season, setSeason] = useState<"all" | "wet" | "dry">("all");
  const [mode, setMode] = useState<MetricMode>("percapita");

  // Spec #3 & #4: Centered floating modal state for Regional Benchmark Reference Table
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [benchmarkFocusedRegion, setBenchmarkFocusedRegion] = useState<string | null>(null);
  // Spec #4: Interventions load on click inside the benchmark table, not automatically
  const [expandedInterventions, setExpandedInterventions] = useState<Record<string, boolean>>({});

  // Spec #4: Dedicated Detailed Card View Modal state (distinct from benchmark table)
  const [detailedCardRegionCode, setDetailedCardRegionCode] = useState<string | null>(null);

  // PDF Export Engine modal
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Computed month index within bounds [0, TOTAL_MONTHS - 1]
  const monthIndex = Math.max(0, Math.min(TOTAL_MONTHS - 1, CURRENT_MONTH_INDEX + horizon));
  const currentMonth = monthMeta(monthIndex);
  const baselineMonth = monthMeta(CURRENT_MONTH_INDEX);
  const isHistorical = horizon < 0;
  const isCurrent = horizon === 0;
  const isForecast = horizon > 0;

  const meta = METRIC_META[mode];
  const currentSeasonLabel =
    currentMonth.season === "wet" ? SEASON_CONFIG.wet.display : SEASON_CONFIG.dry.display;

  // Selected regions assessment rows
  const rows = useMemo(
    () => selected.map((code) => assessRegion(code, illness, monthIndex, mode)),
    [selected, illness, monthIndex, mode],
  );

  // Global maximum across all selected regions in the sparkline window for consistent scaling
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

  // Selection toggle handlers (Single source of truth per Spec #1)
  const toggle = useCallback((code: string) => {
    setSelected((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  }, []);

  const selectKeyMetros = () => {
    setSelected(["130000000", "040000000", "070000000", "110000000"]);
  };

  const selectAll = () => {
    setSelected(REGIONS.map((r) => r.code));
  };

  const clearAll = () => {
    setSelected([]);
  };

  // Spec #4: Distinct trigger for opening the Regional Benchmark Reference Table modal
  const handleOpenBenchmarkTable = (code?: string) => {
    if (code) setBenchmarkFocusedRegion(code);
    setIsBenchmarkModalOpen(true);
  };

  // Spec #4: Distinct trigger for opening the Detailed Card View modal
  const handleOpenDetailedCard = (code: string) => {
    setDetailedCardRegionCode(code);
  };

  // Toggle intervention expansion for a specific region in the benchmark table
  const toggleInterventions = (code: string) => {
    setExpandedInterventions((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isBenchmarkModalOpen) setIsBenchmarkModalOpen(false);
        if (detailedCardRegionCode) setDetailedCardRegionCode(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBenchmarkModalOpen, detailedCardRegionCode]);

  // Detailed assessment object for the active detailed card modal
  const detailedAssessment = useMemo(() => {
    if (!detailedCardRegionCode) return null;
    return assessRegion(detailedCardRegionCode, illness, monthIndex, mode);
  }, [detailedCardRegionCode, illness, monthIndex, mode]);

  const detailedMetrics = useMemo(() => {
    if (!detailedCardRegionCode) return null;
    return modelMetrics(detailedCardRegionCode, illness);
  }, [detailedCardRegionCode, illness]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 sm:px-6 py-6 sm:py-8 pb-32">
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
            Comparative Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Side-by-side benchmark of Philippine regions on forecast load, risk tier and public
            health interventions · {currentMonth.label} ({currentSeasonLabel}) · ranked on{" "}
            {meta.label.toLowerCase()}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <ClassificationInfo mode={mode} thresholds={rows[0]?.thresholds} />
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            disabled={selected.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shadow-xs disabled:opacity-50"
            title={
              selected.length === 0
                ? "Select at least one region to export"
                : "Export a customizable epidemiological report PDF"
            }
          >
            <FileDown className="size-4" />
            <span className="hidden sm:inline">Export Surveillance Report</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Top Filter & Selection Toolbar */}
      <div className="mt-6 space-y-4">
        {/* Spec #1 & #5: Single source of truth Region Selection row with responsive wrapping & checkmark states */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="label-caps text-[11px] font-semibold text-foreground">
                Region Selection
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                {selected.length} of {REGIONS.length} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectKeyMetros}
                className="text-xs font-medium text-primary hover:underline transition-colors"
              >
                Key Metros
              </button>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-medium text-primary hover:underline transition-colors"
              >
                Select All
              </button>
              {selected.length > 0 && (
                <>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear All
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Equal height (h-8), equal spacing, baseline aligned, clear border separation */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
            {REGIONS.map((r) => {
              const isSelected = selected.includes(r.code);
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => toggle(r.code)}
                  aria-pressed={isSelected}
                  className={cn(
                    "h-8 px-2.5 py-1 text-xs rounded-lg font-medium inline-flex items-center gap-1.5 transition-all select-none border min-h-[32px]",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                      : "bg-secondary/20 hover:bg-secondary/50 text-muted-foreground hover:text-foreground border-border/80",
                  )}
                >
                  {isSelected && <Check className="size-3.5 shrink-0 stroke-[2.5]" />}
                  <span>{r.short}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spec #2 & #5: Extended Month Picker / Slider (-12m past to +12m forecast) */}
        <div className="rounded-xl border border-border/80 bg-card/40 p-3.5 sm:p-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Temporal Status Headline */}
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                <SlidersHorizontal className="size-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                  Surveillance & Forecast Period
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="font-mono text-base font-bold text-foreground">
                    {currentMonth.label}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                      isHistorical && "bg-secondary text-muted-foreground border-border",
                      isCurrent && "bg-primary/20 text-primary border-primary/40",
                      isForecast &&
                        "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
                    )}
                  >
                    {isHistorical && `${Math.abs(horizon)}m past reported`}
                    {isCurrent && "Current baseline (Now)"}
                    {isForecast && `+${horizon}m forecast`}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: currentMonth.season === "wet" ? "var(--wet)" : "var(--dry)",
                      color: "#ffffff",
                    }}
                  >
                    {currentSeasonLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Slider Scrubber & Indicator Track */}
            <div className="flex flex-col gap-1.5 w-full md:max-w-md">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-0.5">
                <span className="flex items-center gap-1">
                  <History className="size-3" />
                  <span>Past (-12m)</span>
                </span>
                <span
                  className={cn(
                    "transition-colors",
                    horizon === 0 ? "text-primary font-bold" : "text-muted-foreground",
                  )}
                >
                  Now (0) · {baselineMonth.label}
                </span>
                <span>Forecast (+12m)</span>
              </div>

              {/* Range slider with generous touch target for mobile */}
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
                className="w-full accent-primary h-2.5 cursor-pointer bg-secondary rounded-lg my-1"
                aria-label="Temporal surveillance scrubber from -12 past months to +12 forecast months"
              />

              {/* Quick Jump Buttons covering both Past and Future */}
              <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                {[
                  { label: "-12m", val: -12 },
                  { label: "-6m", val: -6 },
                  { label: "-3m", val: -3 },
                  { label: "Now", val: 0 },
                  { label: "+3m", val: 3 },
                  { label: "+6m", val: 6 },
                  { label: "+12m", val: 12 },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setHorizon(s.val)}
                    className={cn(
                      "rounded-md px-1.5 sm:px-2 py-1 text-[10px] font-mono font-medium transition-colors border min-w-[32px] text-center",
                      horizon === s.val
                        ? "border-primary bg-primary/15 text-primary font-bold shadow-xs"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary filters (Illness, Season convention, Metric mode) */}
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

      {/* Primary Comparison Section: Spec #1 populated directly from top selection */}
      <section className="mt-8">
        {selected.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/20 py-16 px-6 text-center max-w-xl mx-auto my-6">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-secondary/50 text-muted-foreground">
              <Layers className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              No regions selected for comparison
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Use the region buttons above to choose regions to compare. Once selected, side-by-side
              cards with actual vs. predicted case trends will appear here.
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={selectKeyMetros}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 transition-all"
              >
                + Compare Key Metros (NCR, R-IV-A, R-VII, R-XI)
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Section Header with Benchmark Table Modal launcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="label-caps text-[11px] font-semibold text-foreground tracking-wider">
                  Side-by-Side Regional Overview ({selected.length} active)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Global scale: 0–{formatMetric(globalMax, mode)} {meta.unit} · Tap card for
                  detailed view
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenBenchmarkTable(rows[0]?.region.code)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shadow-xs"
              >
                <Table className="size-3.5" />
                <span>Open Benchmark Table Modal</span>
              </button>
            </div>

            {/* Spec #1 & #5: Responsive Card Grid (stacks on mobile, multi-column on tablet/desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rows.map((a) => (
                <RegionalOverviewCard
                  key={a.region.code}
                  assessment={a}
                  currentMonth={currentMonth}
                  meta={meta}
                  mode={mode}
                  illness={illness}
                  monthIndex={monthIndex}
                  globalMax={globalMax}
                  onOpenModal={handleOpenDetailedCard}
                  onToggle={toggle}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Clutter-reduced synchronized season footnote */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border/40 pt-3">
        <p>
          PAGASA climatological boundaries: Wet season ({SEASON_CONFIG.wet.months}) · Dry season (
          {SEASON_CONFIG.dry.months}). Fixed calendar rules ensure deterministic, reproducible
          surveillance.
        </p>
        <p className="font-mono text-[10px]">
          Surveillance month index: {monthIndex} · Metric: {meta.label}
        </p>
      </div>

      {/* Spec #3 & #4: Centered Floating Modal for Regional Benchmark Reference Table */}
      {isBenchmarkModalOpen && rows.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="benchmark-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsBenchmarkModalOpen(false);
            }
          }}
        >
          <div className="relative w-full max-w-5xl max-h-[90vh] sm:max-h-[88vh] rounded-2xl border border-border/80 bg-card shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/70 px-4 sm:px-5 py-3.5 sm:py-4 bg-secondary/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="rounded-lg bg-primary/15 p-2 text-primary">
                  <Table className="size-4" />
                </div>
                <div>
                  <h3 id="benchmark-modal-title" className="text-base font-bold text-foreground">
                    Regional Benchmark Reference Table
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Cross-regional risk tiers, predicted volume, confidence bands and dominant
                    pathology · {currentMonth.label}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                  {rows.length} region{rows.length !== 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setIsBenchmarkModalOpen(false)}
                  aria-label="Close benchmark table modal"
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Upgraded Table with clear divisions & On-click Interventions */}
            <div className="overflow-y-auto p-3 sm:p-5 hw-scroll space-y-4 max-h-[calc(90vh-4.5rem)]">
              <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
                <table className="w-full min-w-[720px] text-left text-xs border-collapse">
                  <thead className="label-caps">
                    <tr className="border-b border-border/80 bg-secondary/35 text-[10px] tracking-wider uppercase font-semibold text-muted-foreground">
                      <th className="px-4 py-3 border-r border-border/50">Region</th>
                      <th className="px-3 py-3 border-r border-border/50">Risk</th>
                      <th className="px-3 py-3 text-right border-r border-border/50">
                        {currentMonth.forecast ? "Predicted" : "Reported"} ({meta.unit})
                      </th>
                      <th className="px-3 py-3 text-right border-r border-border/50">95% CI</th>
                      <th className="px-3 py-3 text-right border-r border-border/50">Percentile</th>
                      <th className="px-3 py-3 text-right border-r border-border/50">3m Change</th>
                      <th className="px-3 py-3 border-r border-border/50">Dominant Illness</th>
                      <th className="px-4 py-3 text-center">Interventions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const isExpanded = Boolean(expandedInterventions[a.region.code]);
                      const recs = recommendations(a);
                      const isFocused = benchmarkFocusedRegion === a.region.code;

                      return (
                        <tr
                          key={a.region.code}
                          className={cn(
                            "border-b border-border/40 transition-colors odd:bg-card/40 even:bg-secondary/15 hover:bg-secondary/30",
                            isFocused && "ring-1 ring-primary/40 bg-primary/5",
                          )}
                        >
                          <td className="px-4 py-3 font-medium border-r border-border/40">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{a.region.name}</span>
                              <span className="label-caps text-[9px] text-muted-foreground">
                                ({a.region.short})
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3 border-r border-border/40">
                            <RiskBadge risk={a.risk} />
                          </td>

                          <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-foreground border-r border-border/40">
                            {formatMetric(a.value, mode)}
                          </td>

                          <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground border-r border-border/40">
                            {formatMetric(metricValue(a.point.lower, a.region, mode), mode)}–
                            {formatMetric(metricValue(a.point.upper, a.region, mode), mode)}
                          </td>

                          <td className="px-3 py-3 text-right font-mono tabular-nums border-r border-border/40">
                            {a.percentileRank}th
                          </td>

                          <td
                            className="px-3 py-3 text-right font-mono tabular-nums font-semibold border-r border-border/40"
                            style={{
                              color: a.changePct >= 0 ? "var(--risk-high)" : "var(--risk-low)",
                            }}
                          >
                            {a.changePct >= 0 ? "+" : ""}
                            {a.changePct}%
                          </td>

                          <td className="px-3 py-3 border-r border-border/40 font-medium">
                            {a.dominantIllness.shortName}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleInterventions(a.region.code)}
                              aria-expanded={isExpanded}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors border min-h-[28px]",
                                isExpanded
                                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                                  : "border-border/80 text-primary hover:bg-primary/10",
                              )}
                            >
                              <span>Interventions ({recs.length})</span>
                              {isExpanded ? (
                                <ChevronUp className="size-3" />
                              ) : (
                                <ChevronDown className="size-3" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Spec #3: Expanded Interventions — Duplicate diagnostic details removed per spec */}
              {rows.some((r) => expandedInterventions[r.region.code]) && (
                <div className="space-y-4 pt-2">
                  <p className="label-caps text-[10px] text-muted-foreground uppercase tracking-wider">
                    Recommended Public Health Actions
                  </p>
                  {rows
                    .filter((r) => expandedInterventions[r.region.code])
                    .map((a) => {
                      const recs = recommendations(a);
                      return (
                        <div
                          key={`expanded-${a.region.code}`}
                          className="rounded-xl border border-border/80 bg-secondary/20 p-4 shadow-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-200"
                        >
                          {/* Region Header (clean, without repeating columns already visible in table) */}
                          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="label-caps font-bold text-foreground text-xs">
                                {a.region.short}
                              </span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-xs font-semibold text-foreground">
                                {a.region.name}
                              </span>
                            </div>
                            <RiskBadge risk={a.risk} />
                          </div>

                          {/* Recommended Interventions List */}
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {recs.map((r) => (
                              <div
                                key={r.title}
                                className="rounded-lg border border-border/60 bg-card p-3 shadow-xs"
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <p className="text-xs font-semibold text-foreground">{r.title}</p>
                                  <RiskBadge risk={r.urgency} />
                                </div>
                                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                                  {r.detail}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Button to open full region analysis page */}
                          <div className="pt-2 flex justify-end">
                            <Link
                              to="/region/$code"
                              params={{ code: a.region.code }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                            >
                              <span>Open full {a.region.short} analysis</span>
                              <ArrowUpRight className="size-3.5" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spec #4: Detailed Card View Modal (Triggered by clicking card body) */}
      {detailedAssessment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detailed-card-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDetailedCardRegionCode(null);
            }
          }}
        >
          <div className="relative w-full max-w-3xl max-h-[92vh] rounded-2xl border border-border/80 bg-card shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/70 p-4 sm:p-5 bg-card/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="label-caps text-xs font-bold text-foreground">
                    {detailedAssessment.region.short}
                  </span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-xs text-muted-foreground">
                    {detailedAssessment.region.classification}
                  </span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground uppercase">
                    {detailedAssessment.region.island}
                  </span>
                </div>
                <h2
                  id="detailed-card-title"
                  className="text-lg sm:text-xl font-bold text-foreground mt-0.5"
                >
                  {detailedAssessment.region.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {detailedAssessment.region.density.toLocaleString()} persons/km² ·{" "}
                  {detailedAssessment.region.population.toLocaleString()} population
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <RiskBadge risk={detailedAssessment.risk} />
                <button
                  type="button"
                  onClick={() => setDetailedCardRegionCode(null)}
                  aria-label="Close detailed card view"
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-4 sm:p-5 hw-scroll space-y-5">
              {/* Primary Metric & Key Stats Strip with High Visual Contrast */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-border/80 bg-secondary/35 p-3.5 shadow-xs">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-foreground">
                    {currentMonth.forecast ? "Predicted Volume" : "Reported Cases"}
                  </p>
                  <p className="font-mono text-xl sm:text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                    {formatMetric(detailedAssessment.value, mode)}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                    {meta.unit}
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-secondary/35 p-3.5 shadow-xs">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-foreground">
                    3-Mo Trajectory
                  </p>
                  <p
                    className="font-mono text-xl sm:text-2xl font-extrabold mt-1 tabular-nums"
                    style={{
                      color:
                        detailedAssessment.changePct >= 0 ? "var(--risk-high)" : "var(--risk-low)",
                    }}
                  >
                    {detailedAssessment.changePct >= 0 ? "+" : ""}
                    {detailedAssessment.changePct}%
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                    vs preceding quarter
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-secondary/35 p-3.5 shadow-xs">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-foreground">
                    National Percentile
                  </p>
                  <p className="font-mono text-xl sm:text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                    {detailedAssessment.percentileRank}th
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                    seasonal distribution
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-secondary/35 p-3.5 shadow-xs">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-foreground">
                    Dominant Pathology
                  </p>
                  <p className="text-sm sm:text-base font-bold text-foreground truncate mt-1">
                    {detailedAssessment.dominantIllness.shortName}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground truncate mt-0.5">
                    {detailedAssessment.dominantIllness.season} season driver
                  </p>
                </div>
              </div>

              {/* Expanded Detailed Trajectory Chart */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground">
                    Detailed Surveillance & Forecast Trajectory
                  </p>
                  <span className="text-[10px] font-mono font-medium text-foreground/80">
                    Target: {currentMonth.label}
                  </span>
                </div>

                <DetailedChart
                  regionCode={detailedAssessment.region.code}
                  illness={illness}
                  monthIndex={monthIndex}
                  mode={mode}
                  riskColor={RISK_META[detailedAssessment.risk].color}
                />
              </div>

              {/* Model Validation & Epidemiological Notes */}
              {detailedMetrics && (
                <div className="rounded-xl border border-border/60 bg-secondary/15 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="label-caps text-[10px] font-semibold text-muted-foreground">
                      Prophet Model Backtest & Reliability
                    </p>
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{
                        backgroundColor: RISK_META[detailedMetrics.tone].color,
                        color: "#ffffff",
                      }}
                    >
                      {detailedMetrics.label} Reliability
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                    <div className="rounded bg-card/60 p-2 border border-border/40">
                      <span className="text-[9px] uppercase text-muted-foreground block">MAPE</span>
                      <span className="font-bold text-foreground">{detailedMetrics.mape}%</span>
                    </div>
                    <div className="rounded bg-card/60 p-2 border border-border/40">
                      <span className="text-[9px] uppercase text-muted-foreground block">MAE</span>
                      <span className="font-bold text-foreground">
                        {detailedMetrics.mae.toFixed(1)}
                      </span>
                    </div>
                    <div className="rounded bg-card/60 p-2 border border-border/40">
                      <span className="text-[9px] uppercase text-muted-foreground block">RMSE</span>
                      <span className="font-bold text-foreground">
                        {detailedMetrics.rmse.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
                    {detailedMetrics.note} Primary transmission driver:{" "}
                    <span className="text-foreground font-medium">
                      {detailedAssessment.dominantIllness.driver}
                    </span>
                    .
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer: Full-Width Balanced Action Bar */}
            <div className="p-4 sm:p-5 border-t border-border/70 bg-secondary/25 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/80 px-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {detailedAssessment.region.name}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {detailedAssessment.region.short} ({detailedAssessment.region.island})
                  </span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/85">95% CI Range:</span>{" "}
                  {formatMetric(
                    metricValue(detailedAssessment.point.lower, detailedAssessment.region, mode),
                    mode,
                  )}
                  –
                  {formatMetric(
                    metricValue(detailedAssessment.point.upper, detailedAssessment.region, mode),
                    mode,
                  )}{" "}
                  {meta.unit}
                </div>
              </div>

              <Link
                to="/region/$code"
                params={{ code: detailedAssessment.region.code }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 hover:shadow-md transition-all active:scale-[0.99] min-h-[44px]"
              >
                <span>Open Full {detailedAssessment.region.name} Analysis</span>
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
      {/* PDF Export Engine modal */}
      <ExportCustomizationModal
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        regionCodes={selected}
        illness={illness}
        monthIndex={monthIndex}
        mode={mode}
      />
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
        "rounded-full border px-3 py-1 text-[11px] capitalize transition-colors min-h-[28px]",
        active
          ? "border-primary/50 bg-primary/15 text-primary font-medium"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface RegionalOverviewCardProps {
  assessment: RegionAssessment;
  currentMonth: ReturnType<typeof monthMeta>;
  meta: (typeof METRIC_META)[MetricMode];
  mode: MetricMode;
  illness: string;
  monthIndex: number;
  globalMax: number;
  onOpenModal: (code: string) => void;
  onToggle: (code: string) => void;
}

function RegionalOverviewCard({
  assessment: a,
  currentMonth,
  meta,
  mode,
  illness,
  monthIndex,
  globalMax,
  onOpenModal,
  onToggle,
}: RegionalOverviewCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenModal(a.region.code);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenModal(a.region.code)}
      onKeyDown={handleKeyDown}
      aria-label={`Open detailed analysis for ${a.region.name}`}
      className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-4 transition-all duration-200 cursor-pointer select-none hover:border-teal-500/50 hover:shadow-lg hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
    >
      <div>
        {/* Card Header: Region short code, density & action buttons */}
        <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="label-caps font-semibold text-foreground">{a.region.short}</span>
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
            {/* Expand Icon indicator for Detailed Card View */}
            <div
              title="Click card for detailed view"
              className="rounded-md p-1 text-muted-foreground/50 group-hover:text-teal-500 transition-colors"
            >
              <Maximize2 className="size-3.5" />
            </div>
            {/* Quick-remove button with stopPropagation */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(a.region.code);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                }
              }}
              aria-label={`Remove ${a.region.short} from comparison`}
              className="rounded-md p-1 text-muted-foreground/60 hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Primary Key Metric & Stats */}
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div>
            <p className="text-[9px] uppercase font-semibold tracking-wider text-muted-foreground">
              {currentMonth.forecast ? "Predicted" : "Reported"} · {meta.unit}
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

        {/* Mini-Chart showing actual cases and predicted cases */}
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
    </div>
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

// Compact Mini-Chart showing actual cases and predicted cases
function RegionSparkline({
  regionCode,
  illness,
  monthIndex,
  mode,
  globalMax,
  riskColor,
}: SparklineProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const series = seriesFor(regionCode, illness);
  const region = useMemo(() => REGIONS.find((r) => r.code === regionCode)!, [regionCode]);

  // Recent 12-month window up to target assessment month
  const windowSlice = useMemo(() => {
    return series.slice(Math.max(0, monthIndex - 11), monthIndex + 1);
  }, [series, monthIndex]);

  const width = 280;
  const height = 62;
  const padTop = 10;
  const padBottom = 12;
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

  // Split points into actual (historical) and predicted (forecast) segments
  const actualPoints = points.filter((p) => !p.forecast);
  const predictedPoints = points.filter((p) => p.forecast);

  // If there are predicted points, connect the last actual point to the first predicted point
  const forecastBridgePoints =
    actualPoints.length > 0 && predictedPoints.length > 0
      ? [actualPoints[actualPoints.length - 1]!, ...predictedPoints]
      : predictedPoints;

  const actualPath = actualPoints.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const forecastPath = forecastBridgePoints.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const lastPoint = points[points.length - 1]!;
  const firstPoint = points[0]!;
  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="w-full" onMouseLeave={() => setHoveredIdx(null)}>
      {/* Visual mini-chart legend showing Actual vs Predicted & active readout */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1 font-mono">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2.5 h-0.5 bg-foreground/75 rounded-full" />
            <span className="text-foreground/85 font-medium">Actual</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-0.5 border-b border-dashed"
              style={{ borderColor: riskColor }}
            />
            <span style={{ color: riskColor }} className="font-semibold">
              Predicted
            </span>
          </span>
        </div>
        {activePoint ? (
          <span className="text-foreground font-semibold tabular-nums">
            {activePoint.label}: {formatMetric(activePoint.v, mode)}
          </span>
        ) : (
          <span className="tabular-nums">Peak {formatMetric(effectiveMax, mode)}</span>
        )}
      </div>

      <div className="relative h-[62px] w-full rounded-md bg-secondary/30 border border-border/40 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
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

          {/* Actual series: Solid line */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="var(--foreground)"
              strokeOpacity="0.75"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Forecast series: Dashed line with risk tone */}
          {forecastPath && (
            <path
              d={forecastPath}
              fill="none"
              stroke={riskColor}
              strokeWidth="2"
              strokeDasharray="3.5 2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Static Point Dots for all historical & forecast data nodes */}
          {points.map((p, idx) => {
            const isForecast = p.forecast;
            const isHovered = hoveredIdx === idx;
            return (
              <g key={p.label}>
                {/* Hit area for touch/hover */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="7"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
                {/* Static Marker Dot (r=2.5) / Active Hover Dot (r=5) */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5 : 2.5}
                  fill="var(--background)"
                  stroke={isForecast ? riskColor : "var(--foreground)"}
                  strokeWidth={isHovered ? 2 : 1.2}
                  className="transition-all duration-150 pointer-events-none"
                />
                {/* Hover High Contrast Ring */}
                {isHovered && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill="none"
                    stroke={isForecast ? riskColor : "var(--foreground)"}
                    strokeWidth="1.5"
                    strokeOpacity="0.45"
                    className="pointer-events-none animate-ping"
                  />
                )}
              </g>
            );
          })}

          {/* Highlight target forecast month endpoint */}
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3.5"
            fill="var(--background)"
            stroke={riskColor}
            strokeWidth="2.2"
            className="pointer-events-none"
          />
        </svg>
      </div>
      <div className="flex items-center justify-between text-[8px] text-muted-foreground/85 mt-0.5 font-mono">
        <span>{firstPoint.label}</span>
        <span className="font-semibold text-foreground/85">Target: {lastPoint.label}</span>
      </div>
    </div>
  );
}

// Expanded Detailed Chart for the Detailed Card View Modal (Spec #4)
function DetailedChart({
  regionCode,
  illness,
  monthIndex,
  mode,
  riskColor,
}: {
  regionCode: string;
  illness: string;
  monthIndex: number;
  mode: MetricMode;
  riskColor: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const series = seriesFor(regionCode, illness);
  const region = useMemo(() => REGIONS.find((r) => r.code === regionCode)!, [regionCode]);

  // Extended 24-month window for high-resolution analysis
  const windowSlice = useMemo(() => {
    return series.slice(Math.max(0, monthIndex - 18), monthIndex + 1);
  }, [series, monthIndex]);

  const width = 560;
  const height = 195;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 30;
  const drawWidth = width - padLeft - padRight;
  const drawHeight = height - padTop - padBottom;

  const maxVal = useMemo(() => {
    let m = 0.01;
    for (const p of windowSlice) {
      const v = metricValue(p.upper || p.cases, region, mode);
      if (v > m) m = v;
    }
    return m * 1.12;
  }, [windowSlice, region, mode]);

  const points = useMemo(() => {
    return windowSlice.map((p, i) => {
      const v = metricValue(p.cases, region, mode);
      const vLower = metricValue(p.lower || p.cases * 0.85, region, mode);
      const vUpper = metricValue(p.upper || p.cases * 1.15, region, mode);

      const x =
        windowSlice.length <= 1
          ? padLeft + drawWidth / 2
          : padLeft + (i / (windowSlice.length - 1)) * drawWidth;
      const y = padTop + drawHeight - (v / maxVal) * drawHeight;
      const yLower = padTop + drawHeight - (vLower / maxVal) * drawHeight;
      const yUpper = padTop + drawHeight - (vUpper / maxVal) * drawHeight;

      return {
        x,
        y,
        yLower,
        yUpper,
        v,
        vLower,
        vUpper,
        forecast: p.forecast,
        label: p.label,
        season: p.season,
      };
    });
  }, [windowSlice, region, mode, maxVal, drawWidth, drawHeight]);

  if (points.length === 0) return null;

  const actualPoints = points.filter((p) => !p.forecast);
  const predictedPoints = points.filter((p) => p.forecast);

  const forecastBridgePoints =
    actualPoints.length > 0 && predictedPoints.length > 0
      ? [actualPoints[actualPoints.length - 1]!, ...predictedPoints]
      : predictedPoints;

  const actualPath = actualPoints.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const forecastPath = forecastBridgePoints.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  // Area polygon for forecast CI envelope
  const ciAreaPath =
    predictedPoints.length > 1
      ? `${predictedPoints.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.yUpper.toFixed(1)}`, "")} ${[...predictedPoints].reverse().reduce((acc, pt) => `${acc} L ${pt.x.toFixed(1)} ${pt.yLower.toFixed(1)}`, "")} Z`
      : "";

  const lastPoint = points[points.length - 1]!;
  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="w-full select-none" onMouseLeave={() => setHoveredIdx(null)}>
      {/* Legend & Peak Header */}
      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-foreground" />
            <span className="text-foreground font-semibold">Actual</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: riskColor }} />
            <span style={{ color: riskColor }} className="font-semibold">
              Predicted & 95% CI
            </span>
          </span>
        </div>
        <span className="font-semibold text-foreground/80">Peak {formatMetric(maxVal, mode)}</span>
      </div>

      {/* Chart SVG with Floating Tooltip */}
      <div className="relative h-[195px] w-full rounded-xl bg-secondary/20 border border-border/60 overflow-hidden">
        {/* Floating Tooltip Card with Key-Value labels */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-border/80 bg-popover/95 backdrop-blur-md px-3 py-2 text-xs shadow-xl transition-all duration-100"
            style={{
              left: `${Math.min(Math.max(8, (hoveredPoint.x / width) * 100 - 15), 65)}%`,
              top: `${Math.max(8, (hoveredPoint.y / height) * 100 - 45)}%`,
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-1 font-mono text-[10px]">
              <span className="font-bold text-foreground">{hoveredPoint.label}</span>
              <span
                className="rounded px-1.5 py-0.2 font-semibold uppercase text-[9px]"
                style={{
                  color: hoveredPoint.forecast ? riskColor : "var(--foreground)",
                  backgroundColor: hoveredPoint.forecast
                    ? "color-mix(in oklab, currentColor 15%, transparent)"
                    : "var(--secondary)",
                }}
              >
                {hoveredPoint.forecast ? "Predicted" : "Reported"}
              </span>
            </div>
            <div className="mt-1 space-y-0.5 font-mono text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {hoveredPoint.forecast ? "Predicted Value:" : "Actual Value:"}
                </span>
                <span className="font-bold text-foreground">
                  {formatMetric(hoveredPoint.v, mode)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                <span>95% CI Bounds:</span>
                <span className="font-medium text-foreground/80">
                  {formatMetric(hoveredPoint.vLower, mode)} –{" "}
                  {formatMetric(hoveredPoint.vUpper, mode)}
                </span>
              </div>
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Horizontal Grid lines & High Contrast Y-Axis Labels */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padTop + drawHeight * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  strokeWidth="0.8"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="currentColor"
                  className="font-mono text-foreground/80 font-medium"
                >
                  {formatMetric(maxVal * ratio, mode)}
                </text>
              </g>
            );
          })}

          {/* Forecast 95% CI Envelope */}
          {ciAreaPath && <path d={ciAreaPath} fill={riskColor} fillOpacity="0.18" />}

          {/* Actual series */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Forecast series */}
          {forecastPath && (
            <path
              d={forecastPath}
              fill="none"
              stroke={riskColor}
              strokeWidth="2.2"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Distinct Point Dots (r=2.5, strokeWidth=1.2) & Active Hover Rings (r=5, strokeWidth=2) */}
          {points.map((p, idx) => {
            const isForecast = p.forecast;
            const isHovered = hoveredIdx === idx;
            const color = isForecast ? riskColor : "var(--foreground)";
            return (
              <g key={p.label}>
                {/* Hit area */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="9"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                />

                {/* Point dot marker */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5 : 2.5}
                  fill="var(--background)"
                  stroke={color}
                  strokeWidth={isHovered ? 2 : 1.2}
                  className="transition-all duration-150 pointer-events-none"
                />

                {/* Active High Contrast Hover Ring */}
                {isHovered && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="10"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeOpacity="0.45"
                    className="pointer-events-none animate-ping"
                  />
                )}
              </g>
            );
          })}

          {/* Highlight Target Endpoint Node */}
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="5"
            fill="var(--background)"
            stroke={riskColor}
            strokeWidth="2.5"
            className="pointer-events-none"
          />

          {/* High Contrast X Axis Month Labels */}
          {points.map((p, idx) => {
            if (idx % 3 !== 0 && idx !== points.length - 1) return null;
            return (
              <text
                key={p.label}
                x={p.x}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                className="font-mono text-foreground/80 font-medium"
              >
                {p.label.slice(2)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
