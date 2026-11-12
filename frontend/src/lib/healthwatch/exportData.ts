import { assessRegion, availabilityForRegion, METRIC_META, metricValue, monthMeta, provenanceForDisease, REGION_BY_CODE, seriesFor, type MetricMode, type MonthPoint } from "./data";

export function buildExportData(dataset: "comparison" | "forecast" | "timeseries", codes: string[], disease: string, index: number, mode: MetricMode) {
  const common = ["disease", "source_status", "operational_run_id", "validation_status", "model", "region_code", "region", "unit"];
  const pointHeader = ["date", "is_forecast", "observation_status", "coverage_basis", "source_record_count", "cases", "lower", "upper", "risk_tier"];
  const header = dataset === "comparison" ? [...common, ...pointHeader, "reported_latest_date", "reported_latest", "percentile_rank", "change_3m_pct"] : [...common, ...pointHeader];
  const rows: (string | number)[][] = [];
  for (const code of codes) {
    const region = REGION_BY_CODE[code]; if (!region) continue;
    const assessment = assessRegion(code, disease, index, mode);
    const history = seriesFor(code, disease);
    const provenance = provenanceForDisease(disease);
    const prefix = [disease, availabilityForRegion(code,disease)?.source_status ?? "conditional_aggregate", provenance?.run_id ?? "unavailable", provenance?.validation_status ?? "unavailable", "Prophet", code, region.name, METRIC_META[mode].unit];
    const points = dataset === "comparison" ? [assessment.point] : dataset === "forecast" ? assessment.forecastWindow.filter((p) => p.forecast && Number.isFinite(p.cases)) : history;
    for (const p of points) {
      const value = (n: number) => metricValue(n, region, mode);
      const row: (string | number)[] = [...prefix, p.date, p.forecast ? 1 : 0, p.observation_status ?? (p.forecast ? "forecast" : "missing_report"), p.coverage_basis ?? "", p.source_record_count ?? "", value(p.cases), value(p.lower), value(p.upper), assessRegion(code,disease,p.index,mode).risk];
      if (dataset === "comparison") {
        const last = [...history].reverse().find((q) => !q.forecast && q.raw >= 0 && Number.isFinite(q.cases));
        row.push(last?.date ?? "", last ? value(last.cases) : NaN, assessment.percentileRank, assessment.changePct);
      }
      rows.push(row);
    }
  }
  return { header, rows, filename: `HealthWatch_${dataset}_${monthMeta(index).label}.csv` };
}
