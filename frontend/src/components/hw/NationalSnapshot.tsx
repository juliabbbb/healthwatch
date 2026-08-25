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
}) {
  return (
    <div className="glass-panel pointer-events-auto flex flex-col gap-3 rounded-xl px-4 py-3">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
        <p className="label-caps">
          National snapshot · {weekLabel} ·{" "}
          <span style={{ color: isForecast ? "var(--risk-moderate)" : undefined }}>
            {isForecast ? "predicted" : "reported"}
          </span>
        </p>
        <LiveClock />
      </div>

      {/* Stats & Unified Hotspot Legend Row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Headline stat */}
        <div className="leading-none">
          <p className="font-mono text-2xl tabular-nums">{formatMetric(value, mode)}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{METRIC_META[mode].unit}</p>
        </div>

        <span className="h-8 w-px bg-border" aria-hidden="true" />

        {/* Hotspot Legend & Count Indicators */}
        <div className="flex items-center gap-3">
          {(["high", "moderate", "low"] as RiskLevel[]).map((r) => (
            <span key={r} className="flex items-center gap-1.5 text-[11px] leading-none">
              <span
                className="size-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: RISK_META[r].color }}
              />
              <span className="font-medium">{RISK_META[r].label} Risk</span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                ({counts[r]})
              </span>
            </span>
          ))}
        </div>

        <span className="h-8 w-px bg-border" aria-hidden="true" />

        {/* Dominant illness */}
        <div className="leading-tight">
          <p className="label-caps">Dominant illness</p>
          <p className="text-xs font-medium">{dominantIllness}</p>
        </div>
      </div>

      {/* Integrated Controls Row: Illness Filter & Metric Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-2.5">
        {/* Illness Filters */}
        {onIllnessChange && (
          <div className="flex items-center gap-2">
            <span className="label-caps text-[10px]">Illness:</span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onIllnessChange("all")}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  illness === "all"
                    ? "border-primary/50 bg-primary/15 text-primary font-medium"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {ILLNESSES.map((i) => (
                <button
                  key={i.id}
                  onClick={() => onIllnessChange(i.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                    illness === i.id
                      ? "border-primary/50 bg-primary/15 text-primary font-medium"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {i.shortName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Classification Metric Controls */}
        {onModeChange && (
          <div className="flex items-center gap-2">
            <span className="label-caps text-[10px]">Metric:</span>
            <div className="flex rounded-md border border-border p-0.5">
              {(["percapita", "raw"] as MetricMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "rounded-[5px] px-2 py-0.5 text-[11px] font-medium transition-colors",
                    mode === m
                      ? "bg-primary/20 text-primary"
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

      {/* Integrated Methodology Link */}
      <div className="border-t border-border/50 pt-2 text-xs">
        <Link to="/methodology" className="text-primary hover:underline font-medium">
          Data sources &amp; methodology →
        </Link>
      </div>
    </div>
  );
}
