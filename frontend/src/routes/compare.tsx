import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers,
  SlidersHorizontal,
  Table,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
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
  // Spec #2: Empty default state — no preloaded regions on first open
  const [selected, setSelected] = useState<string[]>([]);
  const [illness, setIllness] = useState("all");
  // Spec #2: Month picker/slider control state (1 to 12 months horizon)
  const [horizon, setHorizon] = useState(6);
  const [season, setSeason] = useState<"all" | "wet" | "dry">("all");
  const [mode, setMode] = useState<MetricMode>("percapita");

  // Spec #2 & #4: Centered floating modal state for Regional Benchmark Reference Table
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [focusedRegionCode, setFocusedRegionCode] = useState<string | null>(null);
  // Spec #4: Interventions load on click, not automatically (initially empty)
  const [expandedInterventions, setExpandedInterventions] = useState<Record<string, boolean>>({});

  // Ref for multi-select slider deck horizontal scrolling
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  const monthIndex = CURRENT_MONTH_INDEX + horizon;
  const currentMonth = monthMeta(monthIndex);
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

  // Selection toggle handlers
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

  // Spec #2: Clicking a card opens the centered floating modal
  const handleCardClick = (code: string) => {
    setFocusedRegionCode(code);
    setIsModalOpen(true);
  };

  // Spec #4: Toggle intervention expansion for a specific region in the benchmark table
  const toggleInterventions = (code: string) => {
    setExpandedInterventions((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  // Horizontal scroll controls for multi-select slider
  const scrollSlider = (direction: "left" | "right") => {
    if (!sliderTrackRef.current) return;
    const offset = direction === "left" ? -280 : 280;
    sliderTrackRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

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
            health interventions · {currentMonth.label} ({currentSeasonLabel}) · ranked on{" "}
            {meta.label.toLowerCase()}
          </p>
        </div>
        <ClassificationInfo mode={mode} thresholds={rows[0]?.thresholds} />
      </div>

      {/* Top Filter & Selection Toolbar */}
      <div className="mt-6 space-y-4">
        {/* Spec #5: Aligned, clearly separated region selection buttons with distinct selected states */}
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

          {/* Spec #5: Equal height (h-8), equal spacing (gap-2), baseline aligned, clear border separation */}
          <div className="flex flex-wrap gap-2 items-center">
            {REGIONS.map((r) => {
              const isSelected = selected.includes(r.code);
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => toggle(r.code)}
                  aria-pressed={isSelected}
                  className={cn(
                    "h-8 px-2.5 py-1 text-xs rounded-lg font-medium inline-flex items-center gap-1.5 transition-all select-none border",
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

        {/* Spec #2: Month Picker / Slider alongside selection controls */}
        <div className="rounded-xl border border-border/80 bg-card/40 p-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                Surveillance & Forecast Month
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-sm font-bold text-foreground">
                  {currentMonth.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  (+{horizon}m {horizon === 6 ? "baseline" : "horizon"})
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

          {/* Horizon Scrub Slider */}
          <div className="flex items-center gap-3 flex-1 max-w-md min-w-[240px]">
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">+1m</span>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="w-full accent-primary h-2 cursor-pointer bg-secondary rounded-lg"
              aria-label="Forecast horizon in months"
            />
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">+12m</span>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {[1, 3, 6, 12].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-mono font-medium transition-colors border",
                    horizon === h
                      ? "border-primary bg-primary/15 text-primary font-bold"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {h}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Spec #6: Prominent, freely-usable Multi-Select Slider */}
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="label-caps text-[11px] font-semibold text-foreground">
                  Multi-Region Selector Slider
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Pick specific cards freely to compare
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollSlider("left")}
                aria-label="Slide left"
                className="rounded-lg border border-border/80 p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollSlider("right")}
                aria-label="Slide right"
                className="rounded-lg border border-border/80 p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {/* Slider track of freeform selectable cards */}
          <div
            ref={sliderTrackRef}
            className="flex gap-3 overflow-x-auto pb-2 pt-1 hw-scroll snap-x scroll-smooth"
          >
            {REGIONS.map((r) => {
              const isSelected = selected.includes(r.code);
              return (
                <div
                  key={r.code}
                  onClick={() => toggle(r.code)}
                  className={cn(
                    "w-48 shrink-0 snap-start flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-200 cursor-pointer select-none",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                      : "border-border/70 bg-card/80 hover:border-primary/40 hover:bg-card hover:shadow-xs",
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="label-caps text-xs font-bold text-foreground">
                        {r.short}
                      </span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground uppercase">
                        {r.island}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate mt-1">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.density.toLocaleString()} persons/km²
                    </p>
                  </div>

                  {/* Prominent freeform selection toggle switch */}
                  <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {isSelected ? "In comparison" : "Add to deck"}
                    </span>
                    <div
                      className={cn(
                        "h-5 px-2 rounded-full inline-flex items-center gap-1 text-[10px] font-semibold transition-colors border",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary/40 text-muted-foreground border-border/70",
                      )}
                    >
                      {isSelected ? (
                        <>
                          <Check className="size-3 stroke-[2.5]" />
                          <span>Active</span>
                        </>
                      ) : (
                        <span>+ Pick</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Secondary filters (Illness, Season, Mode) */}
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

      {/* Main Comparative Section */}
      <section className="mt-8">
        {/* Spec #2: Empty default state when no regions are selected */}
        {selected.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/20 py-16 px-6 text-center max-w-xl mx-auto my-6">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-secondary/50 text-muted-foreground">
              <Layers className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              No regions selected for comparison
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Use the region buttons or the multi-select slider above to choose regions to compare.
              Once selected, side-by-side cards with actual vs. predicted case trends will appear
              here.
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
            {/* Side-by-Side Region Overview Cards */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="label-caps text-[11px] font-semibold text-foreground tracking-wider">
                  Side-by-Side Regional Overview ({selected.length} active)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Global scale: 0–{formatMetric(globalMax, mode)} {meta.unit} · Tap any card to open
                  the centered benchmark table
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFocusedRegionCode(rows[0]?.region.code ?? null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <Table className="size-3.5" />
                <span>Open Benchmark Table Modal</span>
              </button>
            </div>

            <div className="flex gap-3.5 overflow-x-auto pb-4 pt-1 hw-scroll snap-x">
              {rows.map((a) => (
                <div
                  key={a.region.code}
                  onClick={() => handleCardClick(a.region.code)}
                  className="group w-72 sm:w-80 shrink-0 snap-start flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-4 transition-all duration-200 cursor-pointer select-none hover:border-primary/50 hover:bg-card hover:shadow-md"
                >
                  <div>
                    {/* Card Header: Region short code, density & quick-remove button */}
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
                        {/* Quick-remove button with stopPropagation */}
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

                    {/* Spec #2: On-demand Mini-Chart showing actual cases and predicted cases */}
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

                  {/* Spec #3: Removed redundant bottom-right intervention button; clean drilldown prompt */}
                  <div className="mt-4 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary group-hover:underline">
                      <Table className="size-3.5 shrink-0" />
                      <span>Benchmark details</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 font-mono">
                      95% CI: {formatMetric(metricValue(a.point.lower, a.region, mode), mode)}–
                      {formatMetric(metricValue(a.point.upper, a.region, mode), mode)}
                    </span>
                  </div>
                </div>
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
          Operational horizon: +{horizon}m · Metric: {meta.label}
        </p>
      </div>

      {/* Spec #2: Upgraded Regional Benchmark Reference Table as a FLOATING MODAL centered in middle of screen */}
      {isModalOpen && rows.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="benchmark-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div className="relative w-full max-w-5xl max-h-[88vh] rounded-2xl border border-border/80 bg-card shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 bg-secondary/20">
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
                <span className="text-xs text-muted-foreground font-mono">
                  {rows.length} region{rows.length !== 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Close benchmark table modal"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Spec #1 Upgraded Table with clear field divisions & Spec #4 On-click Interventions */}
            <div className="overflow-y-auto p-5 hw-scroll space-y-4 max-h-[calc(88vh-4.5rem)]">
              <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
                <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                  {/* Spec #1: Clear field labels/headers with consistent divisions */}
                  <thead className="label-caps">
                    <tr className="border-b border-border/80 bg-secondary/35 text-[10px] tracking-wider uppercase font-semibold text-muted-foreground">
                      <th className="px-4 py-3 border-r border-border/50">Region</th>
                      <th className="px-3 py-3 border-r border-border/50">Risk</th>
                      <th className="px-3 py-3 text-right border-r border-border/50">
                        Predicted ({meta.unit})
                      </th>
                      <th className="px-3 py-3 text-right border-r border-border/50">95% CI</th>
                      <th className="px-3 py-3 text-right border-r border-border/50">Percentile</th>
                      <th className="px-3 py-3 text-right border-r border-border/50">3m Change</th>
                      <th className="px-3 py-3 border-r border-border/50">Dominant Illness</th>
                      {/* Spec #4: Interventions column */}
                      <th className="px-4 py-3 text-center">Interventions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const isExpanded = Boolean(expandedInterventions[a.region.code]);
                      const recs = recommendations(a);
                      const isFocused = focusedRegionCode === a.region.code;

                      return (
                        <tr
                          key={a.region.code}
                          className={cn(
                            "border-b border-border/40 transition-colors odd:bg-card/40 even:bg-secondary/15 hover:bg-secondary/30",
                            isFocused && "ring-1 ring-primary/40 bg-primary/5",
                          )}
                        >
                          {/* Spec #1: Vertical cell borders (border-r) & spaced column gutters (px-3.5 py-3) */}
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

                          {/* Spec #4: Interventions field/button that loads on click, not automatically */}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleInterventions(a.region.code)}
                              aria-expanded={isExpanded}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors border",
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

              {/* Spec #4: Interventions Content Revealed ONLY on deliberate user click */}
              {rows.some((r) => expandedInterventions[r.region.code]) && (
                <div className="space-y-4 pt-2">
                  <p className="label-caps text-[10px] text-muted-foreground uppercase tracking-wider">
                    Expanded Public Health Interventions
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
                          <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="label-caps font-bold text-foreground">
                                  {a.region.short}
                                </span>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">
                                  {a.region.name}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Triggered by a{" "}
                                <span className="font-semibold text-foreground capitalize">
                                  {a.risk}
                                </span>{" "}
                                tier at{" "}
                                <span className="font-mono font-bold text-foreground">
                                  {formatMetric(a.value, mode)} {meta.unit}
                                </span>{" "}
                                ({a.percentileRank}th national percentile). Dominant illness:{" "}
                                <span className="font-medium text-foreground">
                                  {a.dominantIllness.shortName}
                                </span>
                                .
                              </p>
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

                          {/* Spec #4: Button labeled to open full region analysis page */}
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

// Spec #2: On-demand Mini-Chart showing actual cases and predicted cases
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

  const width = 280;
  const height = 58;
  const padTop = 8;
  const padBottom = 10;
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

  return (
    <div className="w-full">
      {/* Spec #2: Visual mini-chart legend showing Actual vs Predicted */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1 font-mono">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2.5 h-0.5 bg-foreground/70 rounded-full" />
            <span className="text-foreground/80 font-medium">Actual</span>
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
        <span className="tabular-nums">Peak {formatMetric(effectiveMax, mode)}</span>
      </div>

      <div className="relative h-[58px] w-full rounded-md bg-secondary/30 border border-border/40 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`grad-forecast-${regionCode}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={riskColor} stopOpacity="0.25" />
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

          {/* Actual series: Solid line */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="var(--foreground)"
              strokeOpacity="0.6"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Forecast series: Dashed high-contrast line with risk tone */}
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

          {/* Highlight target forecast month endpoint */}
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3.5"
            fill="var(--background)"
            stroke={riskColor}
            strokeWidth="2.2"
          />
        </svg>
      </div>
      <div className="flex items-center justify-between text-[8px] text-muted-foreground/80 mt-0.5 font-mono">
        <span>{firstPoint.label}</span>
        <span>Target: {lastPoint.label}</span>
      </div>
    </div>
  );
}
