import {
  METRIC_META,
  RISK_META,
  formatMetric,
  type MetricMode,
  type RiskLevel,
} from "@/lib/healthwatch/data";
import { RiskDot } from "./RiskBadge";
import { LiveClock } from "./LiveClock";

/**
 * Bantay-style "national snapshot" readout: one headline number, the tier
 * legend with live counts, dominant illness and a PHT clock — docked above
 * the map layers so it never obstructs them.
 */
export function NationalSnapshot({
  weekLabel,
  isForecast,
  value,
  mode,
  counts,
  dominantIllness,
}: {
  weekLabel: string;
  isForecast: boolean;
  value: number;
  mode: MetricMode;
  counts: Record<RiskLevel, number>;
  dominantIllness: string;
}) {
  return (
    <div className="glass-panel pointer-events-auto rounded-xl px-4 py-3">
      <p className="label-caps mb-1.5">
        National snapshot · {weekLabel} ·{" "}
        <span style={{ color: isForecast ? "var(--risk-moderate)" : undefined }}>
          {isForecast ? "predicted" : "reported"}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Headline stat */}
        <div className="leading-none">
          <p className="font-mono text-2xl tabular-nums">{formatMetric(value, mode)}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{METRIC_META[mode].unit}</p>
        </div>

        <span className="h-8 w-px bg-border" aria-hidden="true" />

        {/* Risk tier legend */}
        <div className="flex flex-col gap-1">
          {(["high", "moderate", "low"] as RiskLevel[]).map((r) => (
            <span key={r} className="flex items-center gap-1.5 text-[11px] leading-none">
              <RiskDot risk={r} />
              <span className="w-16">{RISK_META[r].label}</span>
              <span className="font-mono tabular-nums text-muted-foreground">{counts[r]}</span>
            </span>
          ))}
        </div>

        <span className="h-8 w-px bg-border" aria-hidden="true" />

        {/* Dominant illness */}
        <div className="leading-tight">
          <p className="label-caps">Dominant illness</p>
          <p className="text-xs font-medium">{dominantIllness}</p>
        </div>

        <span className="h-8 w-px bg-border" aria-hidden="true" />

        <LiveClock />
      </div>
    </div>
  );
}
