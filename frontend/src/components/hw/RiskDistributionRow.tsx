import type { RiskLevel } from "@/lib/healthwatch/data";

export interface RiskCounts {
  low: number;
  moderate: number;
  high: number;
}

const TIERS: { key: keyof RiskCounts; label: string; color: string; solid: string }[] = [
  { key: "low", label: "Low", color: "var(--risk-low)", solid: "var(--risk-low-solid)" },
  { key: "moderate", label: "Moderate", color: "var(--risk-moderate)", solid: "var(--risk-moderate-solid)" },
  { key: "high", label: "High", color: "var(--risk-high)", solid: "var(--risk-high-solid)" },
];

/** Three pill counters: how many of the next `months` fall in each risk tier. */
export function RiskDistributionRow({
  counts,
  months = 6,
}: {
  counts: RiskCounts;
  months?: number;
}) {
  return (
    <dl className="flex flex-wrap gap-2">
      {TIERS.map((t) => {
        const value = counts[t.key];
        const total = months;
        return (
          <span
            key={t.key}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
            style={{
              color: t.solid,
              borderColor: `color-mix(in oklab, ${t.color} 35%, transparent)`,
              backgroundColor: `color-mix(in oklab, ${t.color} 12%, transparent)`,
            }}
            title={`${value} of the next ${total} months forecast as ${t.label}`}
          >
            <span className="font-mono text-[11px] font-bold tabular-nums">{value}</span>
            <span>mo · {t.label}</span>
          </span>
        );
      })}
    </dl>
  );
}

/** Reduce a risk-level slice to per-tier counts for RiskDistributionRow. */
export function riskCountsFor(risks: RiskLevel[]): RiskCounts {
  return {
    low: risks.filter((r) => r === "low").length,
    moderate: risks.filter((r) => r === "moderate").length,
    high: risks.filter((r) => r === "high").length,
  };
}