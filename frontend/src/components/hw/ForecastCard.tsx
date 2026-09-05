import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, TrendingDown, TrendingUp, X } from "lucide-react";
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
  recommendations,
  REPORT_DATE,
  REPORT_UPCOMING_SEASON,
  SEASON_START_MONTH,
  monthMeta,
  type MetricMode,
  type OutbreakIndicator,
  type RiskLevel,
  type Season,
} from "@/lib/healthwatch/data";
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
  outbreakSeason = REPORT_UPCOMING_SEASON,
  onOutbreakSeasonChange,
}: ForecastCardProps) {
  const a = assessRegion(regionCode, illness, monthIndex, mode);
  const meta = monthMeta(monthIndex);
  const recs = recommendations(a);
  const validation = modelMetrics(regionCode, illness);
  const unit = METRIC_META[mode].unit;
  const outlookData = getOutbreak(regionCode);
  const flagged = Boolean(outlookData[outbreakSeason]?.outbreak);
  const [compareOpen, setCompareOpen] = useState(false);

  const isSheet = variant === "sheet";

  return (
    <div
      className={cn(
        isSheet
          ? "w-full"
          : "glass-panel w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl",
        className,
      )}
    >
      {/* Header Row */}
      {showHeader && (
        <div className="flex items-start justify-between gap-2 border-b border-border/70 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="label-caps">{a.region.short}</p>
            <h2 className="text-lg font-semibold leading-tight text-foreground truncate">{a.region.name}</h2>
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

      {/* Primary Key Metric Readout */}
      <div className="px-4 py-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="label-caps">
              {meta.forecast ? "Predicted" : "Reported"} · {unit}
            </p>
            <p className="font-mono text-3xl font-bold leading-none tracking-tight tabular-nums text-foreground">
              {formatMetric(a.value, mode)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {meta.label}
              {mode === "percapita" ? ` · ${a.point.cases.toLocaleString()} cases` : ""}
              {meta.forecast
                ? ` · CI ${formatMetric(metricValue(a.point.lower, a.region, mode), mode)}–${formatMetric(metricValue(a.point.upper, a.region, mode), mode)}`
                : " · PIDSR reported"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <RiskBadge risk={a.risk} />
            <SeasonTag season={meta.season} />
            <OutbreakChip flagged={flagged} season={outbreakSeason} />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {a.changePct >= 0 ? (
            <TrendingUp className="size-3.5 shrink-0" style={{ color: "var(--risk-high)" }} />
          ) : (
            <TrendingDown className="size-3.5 shrink-0" style={{ color: "var(--risk-low)" }} />
          )}
          <span>
            <strong className="text-foreground font-medium">
              {a.changePct >= 0 ? "+" : ""}
              {a.changePct}%
            </strong>{" "}
            vs 3 months ago · <strong className="text-foreground font-medium">{a.percentileRank}th</strong> national percentile
          </span>
        </div>
      </div>

      {/* Streamlined Data Controls: Data Layers & Classification Metric */}
      {(onLayerChange || onModeChange) && (
        <div className="border-t border-border/70 px-4 py-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {onLayerChange && (
              <div>
                <p className="label-caps mb-1 text-[10px]">Data Layer</p>
                <div className="flex rounded-lg border border-border/80 p-0.5 bg-secondary/30">
                  <button
                    onClick={() => onLayerChange("hotspot")}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors text-center",
                      layer === "hotspot"
                        ? "bg-primary/20 text-primary font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Hotspot
                  </button>
                  <button
                    onClick={() => onLayerChange("density")}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors text-center",
                      layer === "density"
                        ? "bg-primary/20 text-primary font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Density
                  </button>
                </div>
              </div>
            )}
            {onModeChange && (
              <div>
                <p className="label-caps mb-1 text-[10px]">Metric</p>
                <div className="flex rounded-lg border border-border/80 p-0.5 bg-secondary/30">
                  {(["percapita", "raw"] as MetricMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => onModeChange(m)}
                      aria-pressed={mode === m}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors text-center",
                        mode === m
                          ? "bg-primary/20 text-primary font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {METRIC_META[m].short}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] leading-tight text-muted-foreground">
            Hotspots ranked on <span className="text-foreground">{METRIC_META[mode].label.toLowerCase()}</span>.
          </p>
        </div>
      )}

      {/* Outbreak outlook */}
      {outlookData[outbreakSeason] && (
        <div className="border-t border-border/70 px-4 py-3">
          <p className="label-caps mb-1.5 text-[10px]">Outbreak outlook</p>
          <OutbreakHeadline season={outbreakSeason} ind={outlookData[outbreakSeason]} />
          <SeasonBasis isManual={outbreakSeason !== REPORT_UPCOMING_SEASON} />
          <button
            onClick={() => setCompareOpen((o) => !o)}
            aria-expanded={compareOpen}
            className="mt-2 flex w-full items-center justify-between rounded-lg border border-border/80 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
          >
            Compare seasons
            <ChevronDown
              className={cn("size-3.5 transition-transform", compareOpen && "rotate-180")}
            />
          </button>
          {compareOpen && (
            <div className="mt-2">
              <div className="mb-2 grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  onClick={() => onOutbreakSeasonChange?.("dry")}
                  aria-pressed={outbreakSeason === "dry"}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-left transition-colors",
                    outbreakSeason === "dry"
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Dry · Jan–Mar
                </button>
                <button
                  onClick={() => onOutbreakSeasonChange?.("wet")}
                  aria-pressed={outbreakSeason === "wet"}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-left transition-colors",
                    outbreakSeason === "wet"
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Wet · Jul–Sep
                </button>
              </div>
              {(["dry", "wet"] as Season[]).map((s) => {
                const ind = outlookData[s];
                if (!ind) return null;
                const ratio = ind.season_avg / Math.max(0.01, ind.season_p75);
                const width = Math.min(100, Math.round((ratio / 1.5) * 100));
                return (
                  <div
                    key={s}
                    className={cn(
                      "mt-1.5 rounded-lg bg-secondary/50 px-2.5 py-2 transition-opacity",
                      s !== outbreakSeason && "opacity-45",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="label-caps capitalize">{s} window</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                        style={
                          ind.outbreak
                            ? { color: "oklch(0.99 0.003 95)", backgroundColor: "var(--risk-high-solid)" }
                            : { color: "var(--risk-low)", backgroundColor: "color-mix(in oklab, var(--risk-low), transparent 85%)" }
                        }
                      >
                        {ind.outbreak ? "Alert" : "Clear"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono tabular-nums text-foreground">
                      {Math.round(ind.season_avg).toLocaleString()} / {Math.round(ind.season_p75).toLocaleString()} P75
                    </p>
                    <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${width}%`, backgroundColor: "var(--risk-high)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Progressive Disclosure: Collapsible Model Validation */}
      <div className="border-t border-border/70 px-4 py-2.5">
        <details className="group [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer items-center justify-between py-1 text-xs select-none">
            <span className="label-caps text-[10px]">Model validation</span>
            <div className="flex items-center gap-1.5">
              <StatusChip className="text-[10px] py-0.5 px-2">
                {validation.label} · MAPE {validation.mape}%
              </StatusChip>
              <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </div>
          </summary>
          <div className="mt-2.5 space-y-2 pt-1 animate-in fade-in-50 duration-200">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { k: "MAE", v: validation.mae.toLocaleString() },
                { k: "RMSE", v: validation.rmse.toLocaleString() },
                { k: "MAPE", v: `${validation.mape}%` },
              ].map((m) => (
                <div key={m.k} className="rounded-lg bg-secondary/50 px-2 py-1.5 border border-border/40">
                  <p className="label-caps text-[9px]">{m.k}</p>
                  <p className="font-mono text-xs font-semibold tabular-nums mt-0.5">{m.v}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">{validation.note}</p>
          </div>
        </details>
      </div>

      {/* 12-Month Forecast Horizon */}
      <div className="border-t border-border/70 px-4 py-3">
        <p className="label-caps mb-2 text-[10px]">12-month forecast</p>
        <ul className="space-y-2">
          {a.forecastWindow.map((p) => {
            const v = metricValue(p.cases, a.region, mode);
            const risk: RiskLevel = classify(v, a.thresholds);
            return (
              <li key={p.index} className="flex items-center gap-2.5 text-xs">
                <span className="w-16 font-mono text-[11px] text-muted-foreground">{p.label}</span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (v / Math.max(0.01, a.thresholds.p75 * 1.6)) * 100)}%`,
                      backgroundColor: RISK_META[risk].color,
                    }}
                  />
                </span>
                <span className="w-24 text-right font-mono text-[11px] tabular-nums text-foreground/90">
                  {formatMetric(metricValue(p.lower, a.region, mode), mode)}–
                  {formatMetric(metricValue(p.upper, a.region, mode), mode)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Dominant Illness & Recommended Intervention */}
      <div className="border-t border-border/70 px-4 py-3">
        <p className="label-caps mb-1 text-[10px]">Dominant illness</p>
        <p className="text-sm font-semibold text-foreground">{a.dominantIllness.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{a.dominantIllness.driver}</p>
        <p className="label-caps mt-3 mb-1 text-[10px]">Recommended intervention</p>
        <p className="text-xs leading-relaxed text-foreground/90">
          <span className="font-semibold text-primary">{recs[0]!.title}.</span> {recs[0]!.detail}
        </p>
      </div>

      {/* Action CTA */}
      <div className={cn(
        "border-t border-border/70 px-4 py-3",
        isSheet ? "sticky bottom-0 bg-card/95 backdrop-blur-md pb-6 pt-3" : "sticky bottom-0 bg-card/95 backdrop-blur-md rounded-b-xl z-10"
      )}>
        <Link
          to="/region/$code"
          params={{ code: regionCode }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 hover:shadow active:scale-[0.99]"
        >
          Open region analysis <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

const SEASON_WINDOW: Record<Season, string> = {
  dry: "Dry · Jan–Mar",
  wet: "Wet · Jul–Sep",
};

function SeasonBasis({ isManual }: { isManual: boolean }) {
  const start = SEASON_START_MONTH[REPORT_UPCOMING_SEASON];
  return (
    <p
      className={cn(
        "mt-1.5 text-[10px] leading-relaxed",
        isManual ? "text-muted-foreground/70" : "text-muted-foreground",
      )}
    >
      Based on the current report date ({REPORT_DATE}) — upcoming season derived
      from a fixed calendar rule (wet: Jun–Nov, dry: Dec–May), starting {start}.{" "}
      {isManual && "Showing the other season for comparison."}
    </p>
  );
}

function OutbreakHeadline({ season, ind }: { season: Season; ind: OutbreakIndicator }) {
  const cap = season === "dry" ? "Dry" : "Wet";
  const avg = Math.round(ind.season_avg).toLocaleString();
  const p75 = Math.round(ind.season_p75).toLocaleString();
  return ind.outbreak ? (
    <p className="text-xs leading-relaxed text-foreground/90">
      <span className="font-semibold text-foreground">
        Next season ({SEASON_WINDOW[season]}): outbreak alert.
      </span>{" "}
      Expected cases ({avg}) exceed this region's historical {cap}-season P75 threshold ({p75}).
    </p>
  ) : (
    <p className="text-xs leading-relaxed text-foreground/90">
      <span className="font-semibold text-foreground">
        Next season ({SEASON_WINDOW[season]}): no outbreak alert.
      </span>{" "}
      Expected cases within this region's normal seasonal range.
    </p>
  );
}

function OutbreakChip({ flagged, season }: { flagged: boolean; season: Season }) {
  if (!flagged) {
    return (
      <span className="inline-flex items-center gap-1 uppercase tracking-wider rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {season} outbreak · no alert
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 uppercase tracking-wider rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        color: "oklch(0.99 0.003 95)",
        backgroundColor: RISK_META.high.solidColor,
      }}
    >
      {season} outbreak alert
    </span>
  );
}