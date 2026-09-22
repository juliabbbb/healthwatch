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

/** Clean 2×2 KPI strip for the region info panel, avoiding text crowding. */
export function KpiStrip({ data }: { data: KpiStripData }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <KpiCard
        label="Next Month Forecast"
        value={data.nextMonth.value}
        sub={data.nextMonth.sub}
      />
      <KpiCard
        label="Current Risk Level"
        value={RISK_META[data.currentRisk.level].label}
        sub={data.currentRisk.sub}
        valueColor={RISK_META[data.currentRisk.level].color}
      />
      <KpiCard
        label="Season Outlook"
        value={data.season.label}
        sub={data.season.sub}
      />
      <KpiCard
        label="Historical Peak"
        value={data.peak.value}
        sub={data.peak.sub}
      />
    </div>
  );
}