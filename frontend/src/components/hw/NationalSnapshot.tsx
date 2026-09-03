import { Link } from "@tanstack/react-router";
import {
  ILLNESSES,
  METRIC_META,
  RISK_META,
  formatMetric,
  type MetricMode,
  type RiskLevel,
} from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";
import { LiveClock } from "./LiveClock";

/**
 * National snapshot readout containing headline stats, unified hotspot legend,
 * illness filters, classification metric controls, and methodology link.
 * Designed with a spacious, multi-card layout that scales cleanly from 320px to desktop.
 */
export function NationalSnapshot({
  weekLabel,
  isForecast,
  value,
  mode,
  onModeChange,
  illness = "all",
  onIllnessChange,
  counts,
  dominantIllness,
  className,
}: {
  weekLabel: string;
  isForecast: boolean;
  value: number;
  mode: MetricMode;
  onModeChange?: (m: MetricMode) => void;
  illness?: string;
  onIllnessChange?: (i: string) => void;
  counts: Record<RiskLevel, number>;
  dominantIllness: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass-panel pointer-events-auto flex flex-col gap-4 rounded-xl p-5 sm:p-6 shadow-xl w-full",
        className,
      )}
    >
      {/* 1. Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <span className="label-caps text-[11px] font-bold text-foreground">
            National Snapshot
          </span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="font-mono text-xs font-semibold text-foreground">{weekLabel}</span>
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
            style={{
              color: isForecast ? "var(--risk-moderate)" : "var(--muted-foreground)",
              backgroundColor: isForecast
                ? "color-mix(in oklab, var(--risk-moderate), transparent 85%)"
                : "var(--secondary)",
            }}
          >
            {isForecast ? "Predicted" : "Reported"}
          </span>
        </div>
        <LiveClock />
      </div>

      {/* 2. Spacious Key Metrics Grid (3 Independent Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card A: National Incidence */}
        <div className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-4 flex flex-col gap-3">
          <p className="label-caps text-[10px]">National Incidence</p>
          <div>
            <p className="font-mono text-3xl font-bold tracking-tight tabular-nums text-foreground leading-none">
              {formatMetric(value, mode)}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">
              {METRIC_META[mode].unit}
            </p>
          </div>
        </div>

        {/* Card B: Regional Risk Breakdown */}
        <div className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-4 flex flex-col gap-3">
          <p className="label-caps text-[10px]">Risk Distribution</p>
          <div className="flex flex-row sm:flex-col gap-2.5">
            {(["high", "moderate", "low"] as RiskLevel[]).map((r) => (
              <div key={r} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: RISK_META[r].color }}
                  />
                  <span className="text-muted-foreground text-xs font-medium">
                    {RISK_META[r].label}
                  </span>
                </span>
                <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                  {counts[r]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card C: Dominant Illness */}
        <div className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-4 flex flex-col gap-3">
          <p className="label-caps text-[10px]">Dominant Illness</p>
          <div>
            <p className="text-base font-bold text-foreground">{dominantIllness}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-tight">
              Primary outbreak driver
            </p>
          </div>
        </div>
      </div>

      {/* 3. Controls Section: Illness Filter & Metric Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/70 pt-3">
        {/* Illness Filters */}
        {onIllnessChange && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="label-caps text-[10px] shrink-0">Illness:</span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onIllnessChange("all")}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  illness === "all"
                    ? "border-primary/60 bg-primary/20 text-primary font-semibold shadow-xs"
                    : "border-border/80 bg-secondary/20 text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {ILLNESSES.map((i) => (
                <button
                  key={i.id}
                  onClick={() => onIllnessChange(i.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    illness === i.id
                      ? "border-primary/60 bg-primary/20 text-primary font-semibold shadow-xs"
                      : "border-border/80 bg-secondary/20 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {i.shortName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Metric Mode Toggle */}
        {onModeChange && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="label-caps text-[10px] shrink-0">Metric:</span>
            <div className="flex rounded-lg border border-border/80 bg-secondary/30 p-0.5">
              {(["percapita", "raw"] as MetricMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
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

      {/* 4. Methodology Link */}
      <div className="border-t border-border/70 pt-2 text-xs">
        <Link
          to="/methodology"
          className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-[11px]"
        >
          Data sources &amp; methodology →
        </Link>
      </div>
    </div>
  );
}
