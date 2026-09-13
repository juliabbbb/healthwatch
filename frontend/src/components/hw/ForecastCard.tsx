import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingDown, TrendingUp, X } from "lucide-react";
import type { DataLayer } from "./MapCanvas";
import { cn } from "@/lib/utils";
import {
  METRIC_META,
  RISK_META,
  assessRegion,
  classify,
  formatMetric,
  getOutbreak,
  metricValue,
  modelMetrics,
  monthMeta,
  OUTBREAK_BENCHMARK_SEASON,
  OUTBREAK_BENCHMARK_LABEL,
  OUTBREAK_BENCHMARK_WINDOW,
  type MetricMode,
  type OutbreakIndicator,
  type RiskLevel,
  type Season,
} from "@/lib/healthwatch/data";
import { formatMonthYear } from "@/utils/formatDate";
import { RiskBadge, SeasonTag } from "./RiskBadge";
import { StatusChip } from "./StatusChip";

export interface ForecastCardProps {
  regionCode: string;
  illness: string;
  monthIndex: number;
  mode?: MetricMode;
  onModeChange?: (m: MetricMode) => void;
  layer?: DataLayer;
  onLayerChange?: (l: DataLayer) => void;
  onClose?: () => void;
  variant?: "panel" | "sheet";
  className?: string;
  showHeader?: boolean;
  outbreakSeason?: Season;
  onOutbreakSeasonChange?: (s: Season) => void;
}

export const SEASON_CONFIG: Record<Season, { label: string; months: string; display: string }> = {
  dry: { label: "Dry", months: "Dec–May", display: "Dry · Dec–May" },
  wet: { label: "Wet", months: "Jun–Nov", display: "Wet · Jun–Nov" },
};

export const SEASON_WINDOW: Record<Season, string> = {
  dry: "Dry · Dec–May",
  wet: "Wet · Jun–Nov",
};

export function ForecastCard({
  regionCode,
  illness,
  monthIndex,
  mode = "percapita",
  onModeChange,
  onClose,
  layer = "hotspot",
  onLayerChange,
  variant = "panel",
  className,
  showHeader = true,
  outbreakSeason = OUTBREAK_BENCHMARK_SEASON,
  onOutbreakSeasonChange,
}: ForecastCardProps) {
  const a = assessRegion(regionCode, illness, monthIndex, mode);
  const meta = monthMeta(monthIndex);
  const validation = modelMetrics(regionCode, illness);
  const unit = METRIC_META[mode].unit;
  const outlookData = getOutbreak(regionCode);

  const [selectedSeason, setSelectedSeason] = useState<Season>(outbreakSeason);

  useEffect(() => {
    setSelectedSeason(outbreakSeason);
  }, [outbreakSeason]);

  const handleSeasonChange = (s: Season) => {
    setSelectedSeason(s);
    onOutbreakSeasonChange?.(s);
  };

  const isSheet = variant === "sheet";

  return (
    <div
      className={cn(
        isSheet
          ? "w-full space-y-3"
          : "glass-panel w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl flex flex-col overflow-hidden",
        className,
      )}
    >
      {/* 1. Region Header (unchanged) */}
      {showHeader && (
        <div className="flex items-start justify-between gap-2 border-b border-border/70 px-5 py-3 bg-card/40">
          <div className="min-w-0 flex-1">
            <p className="label-caps">{a.region.short}</p>
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground truncate">
              {a.region.name}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {a.region.classification} · {a.region.density.toLocaleString()} persons/km²
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close region details"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      {/* 2. Current Status Card */}
      <section className="border-b border-border/70 px-5 py-3.5">
        <p className="label-caps text-[10px] text-muted-foreground tracking-wider mb-2.5">
          CURRENT STATUS
        </p>

        {/* Visual Anchor: Large Primary Metric beside Badges with integrated toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="label-caps text-[10px]">
              {meta.forecast ? "Predicted" : "Reported"} · {unit}
            </p>
            <p className="font-mono text-3xl sm:text-4xl font-bold leading-none tracking-tight tabular-nums text-foreground mt-1">
              {formatMetric(a.value, mode)}
            </p>

            {/* Animated iOS-style sliding switch toggle for Per 100k / Raw Cases */}
            {onModeChange && (
              <div
                role="radiogroup"
                aria-label="Metric representation"
                className="relative mt-2.5 inline-flex h-7 w-44 items-center rounded-full border border-border/80 bg-secondary/50 p-0.5 shadow-inner select-none"
              >
                {/* Sliding indicator pill */}
                <div
                  className={cn(
                    "absolute top-0.5 bottom-0.5 w-[calc(50%-3px)] rounded-full bg-primary shadow-xs transition-all duration-200 ease-out",
                    mode === "percapita" ? "left-0.5" : "left-[calc(50%+1.5px)]",
                  )}
                  aria-hidden="true"
                />

                {(["percapita", "raw"] as MetricMode[]).map((m) => {
                  const isActive = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => onModeChange(m)}
                      className={cn(
                        "relative z-10 flex-1 text-center text-[10px] font-semibold transition-colors duration-200 py-0.5",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {METRIC_META[m].short}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <RiskBadge risk={a.risk} />
            <SeasonTag season={meta.season} label={SEASON_CONFIG[meta.season].display} />
            {onLayerChange && (
              <div className="mt-1 inline-flex rounded-lg border border-border/70 p-0.5 bg-secondary/30">
                {(["hotspot", "density"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => onLayerChange(l)}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[9px] font-medium capitalize transition-colors text-center",
                      layer === l
                        ? "bg-primary/20 text-primary font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Labeled Stat Chips Grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5">
            <span className="label-caps text-[9px] block">Period</span>
            <span className="font-mono text-xs font-semibold text-foreground truncate block">
              {formatMonthYear(meta.label)}
            </span>
          </div>

          <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5">
            <span className="label-caps text-[9px] block">Cases</span>
            <span className="font-mono text-xs font-semibold text-foreground truncate block">
              {a.point.cases.toLocaleString()}
            </span>
          </div>

          <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5">
            <span className="label-caps text-[9px] block">3-Mo Trend</span>
            <span
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold"
              style={{ color: a.changePct >= 0 ? "var(--risk-high)" : "var(--risk-low)" }}
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

          <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5">
            <span className="label-caps text-[9px] block">Nat'l Rank</span>
            <span className="font-mono text-xs font-semibold text-foreground truncate block">
              {a.percentileRank}th %ile
            </span>
          </div>

          <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5 col-span-2 sm:col-span-4">
            <span className="label-caps text-[9px] block">Data Source</span>
            <span className="text-[11px] font-medium text-muted-foreground truncate block">
              {meta.forecast
                ? `Prophet Forecast · 95% CI ${formatMetric(metricValue(a.point.lower, a.region, mode), mode)}–${formatMetric(metricValue(a.point.upper, a.region, mode), mode)}`
                : "DOH Epidemiology Bureau PIDSR Surveillance"}
            </span>
          </div>
        </div>
      </section>

      {/* 3. 6-Month Forecast Horizon (trimmed to 6 upcoming months) */}
      <section className="border-b border-border/70 px-5 py-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <p className="label-caps text-[10px] text-muted-foreground tracking-wider">
            6-Month Forecast Horizon
          </p>
          <span className="text-[10px] text-muted-foreground">Range / 95% CI</span>
        </div>

        <ul className="space-y-2.5">
          {/* Highlighted Current Month Anchor */}
          <li className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs transition-colors">
            <div className="w-20 shrink-0 flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-bold text-primary">
                {formatMonthYear(a.point.label)}
              </span>
              <span className="rounded bg-primary/25 px-1 py-0.2 text-[8px] font-semibold uppercase tracking-wider text-primary">
                Now
              </span>
            </div>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (a.value / Math.max(0.01, a.thresholds.p75 * 1.6)) * 100)}%`,
                  backgroundColor: RISK_META[a.risk].color,
                }}
              />
            </span>
            <span className="w-24 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums text-foreground">
              {formatMetric(a.value, mode)}
            </span>
          </li>

          {/* 6 Forecast Horizon Bars */}
          {a.forecastWindow.slice(0, 6).map((p) => {
            const v = metricValue(p.cases, a.region, mode);
            const risk: RiskLevel = classify(v, a.thresholds);
            const seasonConf = SEASON_CONFIG[p.season];
            return (
              <li key={p.index} className="flex items-center gap-2.5 px-2.5 py-1 text-xs">
                <div className="w-20 shrink-0 flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatMonthYear(p.label)}
                  </span>
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    title={seasonConf.display}
                    style={{
                      backgroundColor: p.season === "wet" ? "var(--wet)" : "var(--dry)",
                    }}
                  />
                </div>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (v / Math.max(0.01, a.thresholds.p75 * 1.6)) * 100)}%`,
                      backgroundColor: RISK_META[risk].color,
                    }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatMetric(metricValue(p.lower, a.region, mode), mode)}–
                  {formatMetric(metricValue(p.upper, a.region, mode), mode)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 4. Forecast & Outlook Card */}
      <section className="border-b border-border/70 px-5 py-3.5">
        <p className="label-caps text-[10px] text-muted-foreground tracking-wider mb-2">
          FORECAST & OUTLOOK
        </p>

        {/* Outbreak Outlook Summary Text */}
        {outlookData[selectedSeason] && (
          <div className="space-y-1">
            <OutbreakHeadline season={selectedSeason} ind={outlookData[selectedSeason]} />
            <SeasonBasis isManual={selectedSeason !== OUTBREAK_BENCHMARK_SEASON} />
          </div>
        )}

        {/* Season Comparison Tool */}
        <div className="mt-3 rounded-lg bg-secondary/30 border border-border/60 p-2.5">
          {/* Season Selector Pills */}
          <div className="grid grid-cols-2 gap-1.5">
            {(["dry", "wet"] as Season[]).map((s) => {
              const isSelected = selectedSeason === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSeasonChange(s)}
                  aria-pressed={isSelected}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all text-center",
                    isSelected
                      ? "border border-primary/50 bg-primary/20 text-primary font-semibold shadow-xs"
                      : "border border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                  )}
                >
                  {SEASON_CONFIG[s].display}
                </button>
              );
            })}
          </div>

          {/* Active Season Data Only */}
          {(() => {
            const ind = outlookData[selectedSeason];
            if (!ind) return null;
            const ratio = ind.season_avg / Math.max(0.01, ind.season_p75);
            const width = Math.min(100, Math.round((ratio / 1.5) * 100));
            return (
              <div className="mt-2.5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Current / P75 threshold</span>
                  {ind.outbreak && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                      style={{
                        color: "oklch(0.99 0.003 95)",
                        backgroundColor: "var(--risk-high-solid)",
                      }}
                    >
                      Alert
                    </span>
                  )}
                </div>
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {Math.round(ind.season_avg).toLocaleString()}{" "}
                  <span className="font-normal text-xs text-muted-foreground">/</span>{" "}
                  {Math.round(ind.season_p75).toLocaleString()}{" "}
                  <span className="font-normal text-[11px] text-muted-foreground">cases</span>
                </p>
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                    style={{ width: `${width}%`, backgroundColor: "var(--risk-high)" }}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* 5. Model Info (permanently visible, no chevron dropdown) */}
      <section className="border-b border-border/70 px-5 py-2.5">
        <div className="flex items-center justify-between py-0.5 text-xs">
          <span className="label-caps text-[10px] text-muted-foreground tracking-wider">
            MODEL INFO
          </span>
          <StatusChip className="text-[10px] py-0.5 px-2 text-muted-foreground">
            {validation.label} · MAPE {validation.mape}%
          </StatusChip>
        </div>
        <div className="mt-2 space-y-1.5 pt-0.5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: "MAE", v: validation.mae.toLocaleString() },
              { k: "RMSE", v: validation.rmse.toLocaleString() },
              { k: "MAPE", v: `${validation.mape}%` },
            ].map((m) => (
              <div
                key={m.k}
                className="rounded-lg bg-secondary/40 px-2 py-1 border border-border/40"
              >
                <p className="label-caps text-[9px] text-muted-foreground">{m.k}</p>
                <p className="font-mono text-xs font-semibold tabular-nums text-muted-foreground mt-0.5">
                  {m.v}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{validation.note}</p>
        </div>
      </section>

      {/* 6. Pinned Action CTA (Unchanged) */}
      <div
        className={cn(
          "px-5 py-3",
          isSheet
            ? "sticky bottom-0 bg-card/95 backdrop-blur-md pb-6 pt-3 border-t border-border/70"
            : "sticky bottom-0 bg-card/95 backdrop-blur-md rounded-b-xl z-10 border-t border-border/70",
        )}
      >
        <Link
          to="/seasonality"
          search={{ region: regionCode }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 hover:shadow active:scale-[0.99]"
        >
          Open region analysis <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function SeasonBasis({ isManual }: { isManual: boolean }) {
  return (
    <p
      className={cn(
        "mt-1 text-[10px] leading-relaxed",
        isManual ? "text-muted-foreground" : "text-muted-foreground",
      )}
    >
      {OUTBREAK_BENCHMARK_LABEL}: frozen 2025-dated probe forecasts, fit through 2024-12-31 and
      checked prospectively against observed 2025 — a fixed benchmark, not a clock-derived upcoming
      season. {isManual && "Showing the alternate benchmark window for comparison."}
    </p>
  );
}

function OutbreakHeadline({ season, ind }: { season: Season; ind?: OutbreakIndicator }) {
  if (!ind) return null;
  const cap = season === "dry" ? "Dry" : "Wet";
  const window = OUTBREAK_BENCHMARK_WINDOW[season];
  const avg = Math.round(ind.season_avg).toLocaleString();
  const p75 = Math.round(ind.season_p75).toLocaleString();
  return ind.outbreak ? (
    <p className="text-xs leading-relaxed text-foreground/90">
      <span className="font-semibold text-foreground">
        {window} benchmark: outbreak alert.
      </span>{" "}
      Expected cases ({avg}) exceed this region's historical {cap}-season P75 threshold ({p75}).
    </p>
  ) : (
    <p className="text-xs leading-relaxed text-foreground/90">
      <span className="font-semibold text-foreground">
        {window} benchmark: no outbreak alert.
      </span>{" "}
      Expected cases within this region's normal seasonal range.
    </p>
  );
}
