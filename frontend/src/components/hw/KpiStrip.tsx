import { Activity, CalendarDays, CloudSun, ShieldCheck } from "lucide-react";
import { RISK_META, type RiskLevel } from "@/lib/healthwatch/data";
import { KpiCard } from "./KpiCard";

export interface KpiStripData {
  /** Next-month forecast + 95% CI. */
  nextMonth: { value: string; sub: string };
  /** Current risk tier of the active baseline month. */
  currentRisk: { level: RiskLevel; sub: string };
  /** Upcoming-season outlook signal. */
  season: { label: string; sub?: string };
  /** Highest recorded monthly total in the visible history. */
  peak: { value: string; sub: string };
}

/** Terraced 2×2 (mobile) → 1×4 (lg) KPI strip for the region info panel. */
export function KpiStrip({ data }: { data: KpiStripData }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <KpiCard
        label="Next Month Forecast"
        value={data.nextMonth.value}
        sub={data.nextMonth.sub}
        icon={<CalendarDays className="size-4" />}
        accent="var(--chart-1)"
      />
      <KpiCard
        label="Current Risk Level"
        value={RISK_META[data.currentRisk.level].label}
        sub={data.currentRisk.sub}
        icon={<ShieldCheck className="size-4" />}
        accent={RISK_META[data.currentRisk.level].color}
      />
      <KpiCard
        label="Season Outlook"
        value={data.season.label}
        sub={data.season.sub}
        icon={<CloudSun className="size-4" />}
        accent="var(--chart-2)"
      />
      <KpiCard
        label="Historical Peak"
        value={data.peak.value}
        sub={data.peak.sub}
        icon={<Activity className="size-4" />}
        accent="var(--chart-4)"
      />
    </div>
  );
}