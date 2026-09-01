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
  recommendations,
  weekMeta,
  type MetricMode,
  type RiskLevel,
  type Season,
} from "@/lib/healthwatch/data";
import { RiskBadge, SeasonTag } from "./RiskBadge";
import { StatusChip } from "./StatusChip";

export function ForecastCard({
  regionCode,
  illness,
  weekIndex,
  mode = "percapita",
  onModeChange,
  layer = "hotspot",
  onLayerChange,
  onClose,
}: {
  regionCode: string;
  illness: string;
  weekIndex: number;
  mode?: MetricMode;
  onModeChange?: (m: MetricMode) => void;
  layer?: DataLayer;
  onLayerChange?: (l: DataLayer) => void;
  breakout?: never;
  onClose: () => void;
  outbreakSeason?: Season;
  onOutbreakSeasonChange?: (s: Season) => void;
}) {
  const a = assessRegion(regionCode, illness, weekIndex, mode);
  const meta = weekMeta(weekIndex);
  const recs = recommendations(a);
  const validation = modelMetrics(regionCode, illness);
  const unit = METRIC_META[mode].unit;
  const outlookData = getOutbreak(regionCode);

  return (
    <div className="glass-panel w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="label-caps">{a.region.short}</p>
          <h2 className="text-lg leading-tight">{a.region.name}</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {a.region.classification} · {a.region.density.toLocaleString()} persons/km²
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close region card"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="label-caps">
              {meta.forecast ? "Predicted" : "Reported"} · {unit}
            </p>
            <p className="font-mono text-3xl leading-none tabular-nums">{formatMetric(a.value, mode)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {meta.label}
              {mode === "percapita" ? ` · ${a.point.cases.toLocaleString()} cases` : ""}
              {meta.forecast
                ? ` · CI ${formatMetric(metricValue(a.point.lower, a.region, mode), mode)}–${formatMetric(metricValue(a.point.upper, a.region, mode), mode)}`
                : " · PIDSR reported"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <RiskBadge risk={a.risk} />
            <SeasonTag season={meta.season} />
            <OutbreakChip regionCode={regionCode} />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {a.changePct >= 0 ? (
            <TrendingUp className="size-3.5" style={{ color: "var(--risk-high)" }} />
          ) : (
            <TrendingDown className="size-3.5" style={{ color: "var(--risk-low)" }} />
          )}
          <span>
            {a.changePct >= 0 ? "+" : ""}
            {a.changePct}% vs 4 weeks ago · {a.percentileRank}th national percentile
          </span>
        </div>
      </div>

      {/* Regional Data Layers & Classification Controls */}
      <div className="border-t border-border px-4 py-3">
        <p className="label-caps mb-2">Data layers</p>
        {onLayerChange && (
          <div className="mb-2.5 flex rounded-md border border-border p-0.5">
            <button
              onClick={() => onLayerChange("hotspot")}
              className={cn(
                "flex-1 rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                layer === "hotspot"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Hotspot classification
            </button>
            <button
              onClick={() => onLayerChange("density")}
              className={cn(
                "flex-1 rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                layer === "density"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Case density
            </button>
            <button
              onClick={() => onLayerChange("outbreak")}
              className={cn(
                "flex-1 rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                layer === "outbreak"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Seasonal outbreak outlook
            </button>
          </div>
        )}
        {onModeChange && (
          <>
            <p className="label-caps mb-1.5">Classification metric</p>
            <div className="flex rounded-md border border-border p-0.5">
              {(["percapita", "raw"] as MetricMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "flex-1 rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                    mode === m
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {METRIC_META[m].short}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Hotspots are ranked on{" "}
              <span className="text-foreground">{METRIC_META[mode].label.toLowerCase()}</span>.
            </p>
          </>
        )}
      </div>

      {/* Seasonal outbreak outlook */}
      {outlookData.dry && (
        <div className="border-t border-border px-4 py-3">
          <p className="label-caps mb-2">Seasonal outbreak outlook</p>
          <div className="mb-2 grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              onClick={() => onOutbreakSeasonChange?.("dry")}
              className={cn(
                "rounded-md border px-2 py-1 text-left transition-colors",
                outbreakSeason === "dry"
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Dry · Jan–Mar
            </button>
            <button
              onClick={() => onOutbreakSeasonChange?.("wet")}
              className={cn(
                "rounded-md border px-2 py-1 text-left transition-colors",
                outbreakSeason === "wet"
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
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
              <div key={s} className="mt-1.5 rounded-md bg-secondary/50 px-2.5 py-2">
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
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            Dry-season detection F1 0.90 (precision 0.93 / recall 0.88 against
            real 2025 data); wet season by design favours recall and over-warns.
          </p>
        </div>
      )}

      <div className="border-t border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="label-caps">Model validation</p>
          <StatusChip>
            {validation.label} · MAPE {validation.mape}%
          </StatusChip>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { k: "MAE", v: validation.mae.toLocaleString() },
            { k: "RMSE", v: validation.rmse.toLocaleString() },
            { k: "MAPE", v: `${validation.mape}%` },
          ].map((m) => (
            <div key={m.k} className="rounded-md bg-secondary/50 px-2 py-1.5">
              <p className="label-caps text-[9px]">{m.k}</p>
              <p className="font-mono text-sm tabular-nums">{m.v}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{validation.note}</p>
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="label-caps mb-2">4-week forecast</p>
        <ul className="space-y-1.5">
          {a.fourWeek.map((p) => {
            const v = metricValue(p.cases, a.region, mode);
            const risk: RiskLevel = classify(v, a.thresholds);
            return (
              <li key={p.index} className="flex items-center gap-3 text-xs">
                <span className="w-16 text-muted-foreground">{p.label}</span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${Math.min(100, (v / Math.max(0.01, a.thresholds.p75 * 1.6)) * 100)}%`,
                      backgroundColor: RISK_META[risk].color,
                    }}
                  />
                </span>
                <span className="w-24 text-right font-mono tabular-nums">
                  {formatMetric(metricValue(p.lower, a.region, mode), mode)}–
                  {formatMetric(metricValue(p.upper, a.region, mode), mode)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="label-caps mb-1">Dominant illness</p>
        <p className="text-sm font-medium">{a.dominantIllness.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{a.dominantIllness.driver}</p>
        <p className="label-caps mt-3 mb-1">Recommended intervention</p>
        <p className="text-xs leading-relaxed text-foreground/85">
          <span className="font-medium">{recs[0]!.title}.</span> {recs[0]!.detail}
        </p>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3 rounded-b-xl z-10">
        <Link
          to="/region/$code"
          params={{ code: regionCode }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Open region analysis <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function OutbreakChip({ regionCode }: { regionCode: string }) {
  const outlook = getOutbreak(regionCode);
  const flagged =
    Boolean(outlook.dry?.outbreak) || Boolean(outlook.wet?.outbreak);
  if (!flagged) return null;
  return (
    <span
      className="inline-flex items-center gap-1 uppercase tracking-wider rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        color: "oklch(0.99 0.003 95)",
        backgroundColor: RISK_META.high.solidColor,
      }}
    >
      Seasonal outbreak watch
    </span>
  );
}
