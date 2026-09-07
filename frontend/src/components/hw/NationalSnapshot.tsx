import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
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
  monthLabel,
  isForecast,
  value,
  mode,
  onModeChange,
  illness = "all",
  onIllnessChange,
  counts,
  dominantIllness,
  showOutbreakMarkers = false,
  onOutbreakMarkersChange,
  className,
}: {
  monthLabel: string;
  isForecast: boolean;
  value: number;
  mode: MetricMode;
  onModeChange?: (m: MetricMode) => void;
  illness?: string;
  onIllnessChange?: (i: string) => void;
  counts: Record<RiskLevel, number>;
  dominantIllness: string;
  showOutbreakMarkers?: boolean;
  onOutbreakMarkersChange?: (v: boolean) => void;
  className?: string;
}) {
  const [legendOpen, setLegendOpen] = useState(false);
  return (
    <div
      className={cn(
        "glass-panel pointer-events-auto flex flex-col gap-3.5 rounded-xl p-4 sm:p-5 shadow-xl w-full",
        className,
      )}
    >
      {/* 1. Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caps text-[11px] font-bold text-foreground">
            National Snapshot
          </span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="font-mono text-xs font-semibold text-foreground">{monthLabel}</span>
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

      {/* 2. Key Metrics Grid (3 Cards: grid of 3 with balanced padding and zero text clipping) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* Card A: National Incidence */}
        <div className="rounded-xl border border-border/70 bg-secondary/30 p-3 sm:p-3.5 flex flex-col justify-between min-w-0 overflow-hidden">
          <p className="label-caps text-[10px] text-muted-foreground truncate">National Incidence</p>
          <div className="mt-1.5">
            <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-foreground leading-none">
              {formatMetric(value, mode)}
            </p>
            <p className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground font-medium truncate">
              {METRIC_META[mode].unit}
            </p>
          </div>
        </div>

        {/* Card B: Regional Risk Breakdown with legend tooltip */}
        <div className="relative rounded-xl border border-border/70 bg-secondary/30 p-3 sm:p-3.5 flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-1 min-w-0">
            <p className="label-caps text-[10px] text-muted-foreground truncate">Risk Distribution</p>
            <span
              className="relative shrink-0 flex items-center"
              onMouseEnter={() => setLegendOpen(true)}
              onMouseLeave={() => setLegendOpen(false)}
            >
              <button
                type="button"
                onClick={() => setLegendOpen((v) => !v)}
                aria-expanded={legendOpen}
                aria-label="What these map colors mean"
                className="flex size-4 cursor-pointer items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Info className="size-2.5" />
              </button>
              {legendOpen && (
                <div className="glass-panel absolute right-0 top-full z-50 mt-1.5 w-56 sm:w-64 rounded-lg border border-border p-2.5 text-[11px] leading-relaxed text-muted-foreground shadow-lg">
                  Colors show monthly risk tier (Low/Moderate/High). The alert marker shows a
                  seasonal outbreak flag for the upcoming dry or wet season.
                </div>
              )}
            </span>
          </div>
          <div className="flex flex-col gap-1 mt-1.5">
            {(["high", "moderate", "low"] as RiskLevel[]).map((r) => (
              <div key={r} className="flex items-center justify-between gap-1 text-xs">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: RISK_META[r].color }}
                  />
                  <span className="text-muted-foreground text-[11px] font-medium truncate capitalize">
                    {r}
                  </span>
                </span>
                <span className="font-mono text-xs font-bold tabular-nums text-foreground shrink-0">
                  {counts[r]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card C: Dominant Illness */}
        <div className="rounded-xl border border-border/70 bg-secondary/30 p-3 sm:p-3.5 flex flex-col justify-between min-w-0 overflow-hidden">
          <p className="label-caps text-[10px] text-muted-foreground truncate">Dominant Illness</p>
          <div className="mt-1.5">
            <p className="text-base sm:text-lg font-bold text-foreground truncate">{dominantIllness}</p>
            <p className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground leading-tight truncate">
              Primary outbreak driver
            </p>
          </div>
        </div>
      </div>

      {/* 3. Controls Section: Structured Clean Rows */}
      <div className="flex flex-col gap-2.5 border-t border-border/70 pt-3">
        {/* Top Controls Row: Illness Filter */}
        {onIllnessChange && (
          <div className="flex items-center justify-between gap-2">
            <span className="label-caps text-[10px] text-muted-foreground shrink-0">Illness:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto hw-scroll py-0.5">
              <button
                type="button"
                onClick={() => onIllnessChange("all")}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer shrink-0",
                  illness === "all"
                    ? "border-primary/60 bg-primary/20 text-primary font-semibold shadow-xs"
                    : "border-border/80 bg-secondary/20 text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {ILLNESSES.map((i) => (
                <button
                  type="button"
                  key={i.id}
                  onClick={() => onIllnessChange(i.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer shrink-0",
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

        {/* Bottom Controls Row: Metric Mode & Outbreak Marker Toggle */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {onModeChange && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="label-caps text-[10px] text-muted-foreground shrink-0">Metric:</span>
              <div className="flex items-center rounded-lg border border-border/80 bg-secondary/30 p-0.5">
                {(["percapita", "raw"] as MetricMode[]).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => onModeChange(m)}
                    aria-pressed={mode === m}
                    className={cn(
                      "rounded-md px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer",
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

          {onOutbreakMarkersChange && (
            <button
              type="button"
              onClick={() => onOutbreakMarkersChange(!showOutbreakMarkers)}
              aria-pressed={showOutbreakMarkers}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer",
                showOutbreakMarkers
                  ? "border-primary/60 bg-primary/20 text-primary font-semibold shadow-xs"
                  : "border-border/80 bg-secondary/20 text-muted-foreground hover:text-foreground",
              )}
            >
              Outbreak markers: <span className="font-semibold">{showOutbreakMarkers ? "on" : "off"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Methodology Link */}
      <div className="border-t border-border/70 pt-2 text-xs flex items-center justify-between">
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
