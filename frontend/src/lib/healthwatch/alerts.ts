/**
 * Client-side alert derivation for the Bantay-style alerts panel and
 * notification bell. Everything here reads the series/threshold caches the
 * app already holds — no new backend surface.
 */

import {
  METRIC_META,
  TOTAL_WEEKS,
  classify,
  formatMetric,
  getSeries,
  metricValue,
  weekLabel,
  type RegionAssessment,
} from "./data";

export interface AlertItem {
  id: string;
  kind: "high-now" | "crossing";
  regionCode: string;
  title: string;
  detail: string;
  week: string; // ISO week label of the triggering week
  /** Sort key: current-risk alerts rank by percentile, crossings by soonest week. */
  order: number;
}

const HORIZON = 12;

/**
 * Builds the active-alert list for the selected illness/week:
 *  - "high-now": regions classified High at the currently scrubbed week.
 *  - "crossing": regions whose 12-week forecast first crosses into High.
 */
export function deriveAlerts(assessments: RegionAssessment[], illnessId: string): AlertItem[] {
  const out: AlertItem[] = [];

  for (const a of assessments) {
    if (a.risk === "high") {
      out.push({
        id: `high-${a.region.code}`,
        kind: "high-now",
        regionCode: a.region.code,
        title: `${a.region.short} at high outbreak risk`,
        detail: `${formatMetric(a.value, a.mode)} ${METRIC_META[a.mode].unit} — ${a.percentileRank}th percentile of the seasonal norm.`,
        week: weekLabel(a.weekIndex),
        order: a.percentileRank,
      });
    }

    const series = getSeries(a.region.code, illnessId);
    let prevRisk = a.risk;
    const end = Math.min(a.weekIndex + 1 + HORIZON, TOTAL_WEEKS);
    for (let i = a.weekIndex + 1; i < end; i++) {
      const p = series[i];
      if (!p) break;
      const risk = classify(metricValue(p.cases, a.region, a.mode), a.thresholds);
      if (risk === "high" && prevRisk !== "high") {
        out.push({
          id: `cross-${a.region.code}`,
          kind: "crossing",
          regionCode: a.region.code,
          title: `${a.region.short} forecast crosses into high risk`,
          detail: `Predicted ${formatMetric(metricValue(p.cases, a.region, a.mode), a.mode)} ${METRIC_META[a.mode].unit} that week — pre-position response capacity.`,
          week: p.label,
          // sooner crossings first: invert distance from the current week
          order: -(i - a.weekIndex),
        });
        break;
      }
      prevRisk = risk;
    }
  }

  return out.sort((x, y) =>
    x.kind === y.kind ? y.order - x.order : x.kind === "high-now" ? -1 : 1,
  );
}
