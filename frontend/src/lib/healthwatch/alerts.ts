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
  getOutbreak,
  getSeries,
  metricValue,
  weekLabel,
  type RegionAssessment,
  type Season,
} from "./data";

export interface AlertItem {
  id: string;
  kind: "high-now" | "crossing" | "outbreak";
  regionCode: string;
  title: string;
  detail: string;
  week: string; // ISO week label (or probe window) of the triggering week
  /** Sort key: current-risk alerts rank by percentile, crossings by soonest week. */
  order: number;
}

const HORIZON = 12;

const SEASON_WINDOW: Record<Season, string> = {
  dry: "Jan–Mar",
  wet: "Jul–Sep",
};

/**
 * Builds the active-alert list for the selected illness/week:
 *  - "high-now": regions classified High at the currently scrubbed week.
 *  - "crossing": regions whose 12-week forecast first crosses into High.
 *  - "outbreak": regions with a Rule A/B seasonal outbreak flag on the active
 *    (upcoming) probe window. Weekly risk and seasonal outbreak phrasing stay
 *    deliberately separate — never combined in one sentence.
 */
export function deriveAlerts(
  assessments: RegionAssessment[],
  illnessId: string,
  activeSeason: Season,
): AlertItem[] {
  const out: AlertItem[] = [];

  for (const a of assessments) {
    if (a.risk === "high") {
      out.push({
        id: `high-${a.region.code}`,
        kind: "high-now",
        regionCode: a.region.code,
        title: `${a.region.short} — High risk this week`,
        detail: `${formatMetric(a.value, a.mode)} ${METRIC_META[a.mode].unit} — ${a.percentileRank}th percentile of the seasonal norm.`,
        week: weekLabel(a.weekIndex),
        order: a.percentileRank,
      });
    }

    const flag = getOutbreak(a.region.code)[activeSeason];
    if (flag?.outbreak) {
      const avg = Math.round(flag.season_avg);
      const p75 = Math.round(flag.season_p75);
      out.push({
        id: `outbreak-${a.region.code}`,
        kind: "outbreak",
        regionCode: a.region.code,
        title: `${a.region.short} — Seasonal outbreak alert`,
        detail: `${SEASON_WINDOW[activeSeason]} window: expected ${avg.toLocaleString()} cases/week vs the region's seasonal P75 (${p75.toLocaleString()}).`,
        week: SEASON_WINDOW[activeSeason],
        // busiest seasons (highest avg/P75 ratio) rank first within this kind
        order: (flag.season_avg / Math.max(0.01, flag.season_p75)) * 100,
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
          title: `${a.region.short} — forecast crosses into high risk`,
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

  const weight: Record<AlertItem["kind"], number> = {
    "high-now": 0,
    outbreak: 1,
    crossing: 2,
  };
  return out.sort(
    (x, y) =>
      weight[x.kind] !== weight[y.kind]
        ? weight[x.kind] - weight[y.kind]
        : y.order - x.order,
  );
}
